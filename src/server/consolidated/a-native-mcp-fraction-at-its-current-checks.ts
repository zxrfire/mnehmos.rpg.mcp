/** Direct MCP fractions borrow the same held body and current-check calendar as play. */
import type { Cultivator, Run } from '../../schema/cultivation.js';
import type { TimeSkipContext, TimeSkipScene } from '../../engine/cultivation/time-skip.js';
import type { EncounterActivity, EncounterRoll } from '../../engine/encounters/types.js';
import type { WorldState } from '../../engine/world/world-state.js';
import { routineTime } from '../../engine/world/npc-routines.js';
import { journeyTimeHasReached } from '../../engine/world/places-on-the-way.js';
import { encountersAtChecks } from '../../engine/encounters/window.js';
import { advanceWorldForCultivator, worldForRun, saveWorldForRun, type WorldAdvance } from '../state/cultivation-world.js';
import type { CultivationRepos } from './cultivation-support.js';
import { KnowledgeGate } from '../../web/knowledge.js';
import { encounterInputFor, recordEncounters, withEncounterDeltas, PLAYER_ROLL_IDENTITY,
    type RecordedEncounters } from '../../web/encounters.js';
import { reportFromDigest } from '../../web/tool-result-prose.js';
import { spendAnOrdinarySpanAtTheActualClock, type OrdinarySpanServices } from '../../web/spending-an-ordinary-span-at-the-actual-clock.js';
import { paidCarrierSource } from '../../web/an-actual-paid-passage.js';
import { thePaidCarriageClaim } from '../../web/a-paid-carriage-on-the-road.js';
import { recordedVoyage } from '../../web/a-ship-at-sea.js';
import { drawFromPack, putBackWhatWasNotEaten, rationsHeld } from '../../web/rations-in-the-actual-pack.js';
import { settlePlagueOnActualBody, plagueEncounterAtActualBody, type ActualPlagueServices } from '../../web/plague-on-the-actual-body.js';
import { worldLocationFor } from '../../web/entities.js';
import { betweenRoadEndpoints } from '../../web/a-road-stopped-partway.js';
import { npcsWhereTheyStand } from '../../engine/world/where-in-a-place-somebody-is-standing.js';

export interface McpCurrentFraction {
    repos: CultivationRepos;
    run: Run;
    body: Cultivator;
    days: number;
    /** Prepared after actual clock promotion; never a whole-day surrogate. */
    world: WorldState | null;
    context: TimeSkipContext;
    activity: EncounterActivity;
    randomEvents: boolean;
    /** Caller reuses its existing options, standing and discovery readers. */
    sceneFor(body: Cultivator, run: Run): Promise<Partial<TimeSkipScene>>;
}

/** Receipt formatting only: each portion already applied its own knowledge authority. */
export function nativeDigestOfThePortions(portions: readonly WorldAdvance[]) {
    if (portions.length === 0) return null;
    const first = portions[0], last = portions[portions.length - 1];
    const digests = portions.flatMap(portion => portion.result.digest ? [portion.result.digest] : []);
    return {
        fromDay: first.result.digest?.fromDay ?? first.fromDay,
        toDay: last.result.digest?.toDay ?? last.toDay,
        headline: digests.map(digest => digest.headline).filter(Boolean).join('\n') || null,
        heard: digests.flatMap(digest => digest.lines),
        unheard: digests.reduce((sum, digest) => sum + digest.unheard, 0),
        unattributed: digests.reduce((sum, digest) => sum + digest.unattributed, 0),
        note: "Filtered through this cultivator's knowledge at each committed portion. Anything named here is a name they hold; anything unattributed must stay unattributed in narration."
    };
}

export async function spendMcpFractionAtItsCurrentChecks(input: McpCurrentFraction) {
    const { repos, run, body, days } = input;
    let actualWorld = input.world;
    let stop: string | null = null, worldError: string | null = null;
    const readScene = async (person: Cultivator, actualRun: Run) => {
        const scene = await input.sceneFor(person, actualRun);
        if (!actualWorld) return scene;
        const carrier = paidCarrierSource({ atHand: actualWorld }, person.id,
            thePaidCarriageClaim(repos.db, person.id)?.receiptId,
            recordedVoyage(repos.db, person.id) ?? undefined, routineTime(actualWorld));
        if (carrier?.unavailable) stop = carrier.unavailable;
        // The SQL body has already been projected by the native passenger boundary.
        // Preserve the caller's effective ground/ambient alias instead of replacing
        // it with a second independently chosen location id.
        return { ...scene, providedFoodUntilDay: carrier?.providedFoodUntilDay };
    };
    let scene = await readScene(body, run);
    const portions: WorldAdvance[] = [];
    const worldStart = actualWorld ? routineTime(actualWorld) : run.elapsedDays;
    const recorded: RecordedEncounters = { events: [], lines: [], structure: [], learned: [], met: [] };
    const delivered: EncounterRoll['occurrences'] = [];
    let roll: EncounterRoll = { occurrences: [], firstInterruptDay: null, checks: 0, poolSize: 0 };
    const knowledge = new KnowledgeGate(repos.db, () => actualWorld);
    const current = () => {
        const liveBody = repos.cultivators.getById(body.id), liveRun = repos.runs.getById(run.id);
        if (!liveBody || !liveRun) throw new Error('A native MCP fraction lost its actual body or run.');
        return { body: liveBody, run: liveRun };
    };
    let plagueMoved = false;
    const plagueServices: ActualPlagueServices = {
        repos, db: repos.db,
        get atHand() { return actualWorld; }, set atHand(state) { actualWorld = state; },
        currentRun: () => ({ run: current().run, cultivator: current().body }),
        worldPlaceOf: person => actualWorld && !betweenRoadEndpoints(repos.db, person)
            ? worldLocationFor(actualWorld, person.location)?.id ?? null : null,
        theWorldMoved: () => { plagueMoved = true; },
        present: person => {
            const placeId = plagueServices.worldPlaceOf(person);
            const place = actualWorld?.locations.find(place => place.id === placeId);
            return actualWorld && place ? npcsWhereTheyStand(actualWorld, place, person.standingIn, { id: person.id }) : [];
        }
    };
    const inputNow = () => encounterInputFor({ repos, knowledge, world: actualWorld }, {
        seed: run.seed, startDay: run.elapsedDays, days, activity: input.activity,
        cultivator: current().body, rollIdentity: PLAYER_ROLL_IDENTITY
    });
    // The window owns its ordinary occasion/calendar streams. The precise endpoint
    // bounds its existing grid; no fractional private cadence is introduced here.
    const cadence = input.randomEvents ? encountersAtChecks(inputNow(), {
        afterDay: run.elapsedDays, throughDay: run.elapsedDays + days
    }) : null;
    let next = cadence?.next();
    const dates: number[] = [];
    const refreshDates = () => {
        dates.length = 0;
        if (next && !next.done && next.value.kind === 'check')
            dates.push(worldStart + next.value.absoluteDay - run.elapsedDays);
    };
    const resolveHere = () => {
        const now = current();
        if (!now.body.alive || now.run.status !== 'active') return;
        const worldNow = actualWorld ? routineTime(actualWorld) : now.run.elapsedDays;
        while (!stop && cadence && next && !next.done && next.value.kind === 'check'
            && journeyTimeHasReached(worldNow, worldStart + next.value.absoluteDay - run.elapsedDays)) {
            const reply = cadence.next(inputNow());
            if (reply.done || reply.value.kind !== 'resolved') throw new Error('A native MCP check lost its result.');
            roll = { ...reply.value.roll, occurrences: delivered, firstInterruptDay: roll.firstInterruptDay };
            for (const occurrence of reply.value.occurrences) {
                const before = current();
                if (stop || !before.body.alive || before.run.status !== 'active') break;
                delivered.push(occurrence);
                if (occurrence.interrupts && roll.firstInterruptDay === null) roll.firstInterruptDay = occurrence.absoluteDay;
                const single = { ...roll, occurrences: [occurrence],
                    firstInterruptDay: occurrence.interrupts ? occurrence.absoluteDay : null };
                const changed = withEncounterDeltas(before.body, single);
                repos.cultivators.applyDeltas(body.id, { hp: changed.hp - before.body.hp,
                    spiritStones: changed.spiritStones - before.body.spiritStones });
                const after = current();
                const receipt = recordEncounters(knowledge, after.body, after.run.elapsedDays,
                    single, repos, after.run.elapsedDays, () => plagueEncounterAtActualBody(plagueServices));
                recorded.events.push(...receipt.events); recorded.lines.push(...receipt.lines);
                recorded.structure.push(...receipt.structure); recorded.learned.push(...receipt.learned);
                recorded.met.push(...receipt.met);
                // Like the existing MCP span, an interruption returns the actual
                // encounter for the caller to answer; it does not silently fight.
                if (occurrence.interrupts) stop = occurrence.event.summary;
            }
            next = cadence.next();
            if (next.done) roll = { ...next.value, occurrences: delivered,
                firstInterruptDay: roll.firstInterruptDay };
        }
        refreshDates();
    };
    // Occasion belongs to the actual accepted starting scene, before body time.
    resolveHere();
    const initial = current();
    scene = await readScene(initial.body, initial.run);
    const service: OrdinarySpanServices = {
        repos, worldEnabled: actualWorld !== null,
        settlePlagueAtTheBodyBoundary: () => settlePlagueOnActualBody(plagueServices),
        get atHand() { return actualWorld; }, set atHand(state) { actualWorld = state; },
        drawFromPack: (person, span) => drawFromPack(repos.db, person, span),
        putBackWhatWasNotEaten: (person, skip) => putBackWhatWasNotEaten(repos.db, person, skip),
        rationsHeld: person => rationsHeld(repos.db, person),
        sceneForSpan: () => scene,
        advanceWorld: async (portion, person, actualRun, options) => {
            try {
                const native = await advanceWorldForCultivator(actualRun, person, portion, {
                    ...options, preciseDays: true,
                    atWorldBoundary: (state, onDay) => {
                        actualWorld = state;
                        options?.atWorldBoundary?.(state, onDay);
                    }
                });
                if (native) portions.push(native);
                actualWorld = await worldForRun(actualRun);
                const fresh = current();
                scene = await readScene(fresh.body, fresh.run);
                return reportFromDigest(native?.result.digest ?? null);
            } catch (error) {
                worldError = error instanceof Error ? error.message : String(error);
                stop = 'The native world could not continue this span: ' + worldError;
                return { lines: [], structure: [] };
            }
        }
    };
    // Zero-time occasion interruptions retain the old native zero-skip completion
    // and unopened reserved receipt; no extra lesser-action charge is appended.
    const spent = await spendAnOrdinarySpanAtTheActualClock(service, initial.run, initial.body,
        stop ? 0 : days, { ...input.context, ...scene }, 'reserved', undefined, run.turn + 1,
        undefined, { dates, afterBoundary: async () => {
            resolveHere();
            const fresh = current();
            if (fresh.body.alive) scene = await readScene(fresh.body, fresh.run);
        }, stop: () => stop });
    if (plagueMoved) await saveWorldForRun(current().run);
    return { ...spent, roll, recorded, portions, digest: nativeDigestOfThePortions(portions), worldError };
}
