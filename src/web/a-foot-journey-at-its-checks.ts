import { chargeTheNightsInTheOpen } from './where-the-nights-were-spent.js';
/** Native foot travel checks read the actual cursor scene at their committed date. */
import type { GameService } from './turn-engine.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { TimeSkipContext } from '../engine/cultivation/time-skip.js';
import type { EncounterRoll } from '../engine/encounters/types.js';
import type { AcceptedPassageMoment } from '../engine/world/passage-moment.js';
import { passageCheckFrame } from '../engine/world/passage-moment.js';
import { encountersAtChecks } from '../engine/encounters/window.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { roadPositionOfNpc, journeyTimeHasReached, type firstTravellerOnTheWay } from '../engine/world/places-on-the-way.js';
import { sameRoadPosition } from '../engine/world/road-course.js';
import { stoppedRoadFor, type StoppedRoad } from './a-road-stopped-partway.js';
import { encounterInputFor, PLAYER_ROLL_IDENTITY, recordEncounters, withEncounterDeltas, type RecordedEncounters } from './encounters.js';
import { accountsComingDue } from './who-comes-to-settle-an-account.js';
import { comesAtYou, theyCameAtYou, foldTheFightIn } from './when-somebody-comes-at-you.js';
import { peopleInThisPlace } from './hearsay.js';
import { worldLocationFor } from './entities.js';
import { factsForToolResult } from './facts.js';
import type { Execution } from './turn-wire-shapes.js';
import { spendAnOrdinarySpanAtTheActualClock } from './spending-an-ordinary-span-at-the-actual-clock.js';

export interface FootCheckOptions {
    moment: AcceptedPassageMoment | null;
    newlyAccepted: boolean;
    resolvesOnTurn: number;
    /** The caller advances only its sole SQL cursor, after each committed portion. */
    checkpoint(portionDays: number): void;
    groundAt(elapsed: number): string | undefined;
    /** The current read must still be this admitted course, never a newer replacement. */
    occupiesCourse(cursor: StoppedRoad | null): boolean;
    contextFor(body: Cultivator, run: Run, rations: number): TimeSkipContext;
    meeting: ReturnType<typeof firstTravellerOnTheWay>;
    /** Actual course vertices, not new occasion/encounter checks. */
    vertexDates?: readonly number[];
}

export async function spendFootJourneyAtItsChecks(game: GameService, run: Run, body: Cultivator,
    days: number, options: FootCheckOptions) {
    const start = routineTime(game.atHand!);
    const initialCursor = stoppedRoadFor(game.db, body, game.atHand);
    if (!initialCursor) throw new Error('An admitted foot course lost its sole physical cursor.');
    let chargedNights = 0;
    // Projection/checkpoint zero already happened at actual acceptance, before input.
    const frame = passageCheckFrame(options.moment, start, run.elapsedDays, days);
    const inputNow = () => {
        const current = game.currentRun();
        return encounterInputFor({ repos: game.repos, knowledge: game.knowledge, world: game.atHand }, {
            seed: run.seed, startDay: frame.runStart, days: frame.elapsedOnThisCrossing + days,
            activity: 'travel', cultivator: current.cultivator, rollIdentity: PLAYER_ROLL_IDENTITY,
            comingForYou: accountsComingDue(game, current.cultivator)
        });
    };
    const cadence = encountersAtChecks(inputNow(), { departureOccasion: options.newlyAccepted && !frame.legacyUnknownMoment,
        afterDay: frame.afterDay, throughDay: frame.throughDay });
    let next = cadence.next();
    let roll: EncounterRoll = { occurrences: [], firstInterruptDay: null, checks: 0, poolSize: 0 };
    const delivered: EncounterRoll['occurrences'] = [];
    const recorded: RecordedEncounters = { events: [], lines: [], structure: [], learned: [], met: [] };
    let stop: string | null = null, fight: Execution | null = null, contactReached = false;
    const dates: number[] = [];
    const refreshDates = () => {
        dates.length = 0;
        dates.push(...(options.vertexDates ?? []));
        if (!next.done && next.value.kind === 'check') dates.push(frame.boardedOnDay + next.value.dayOffset);
        if (options.meeting && !contactReached) dates.push(start + options.meeting.afterDays);
    };
    const resolveHere = () => {
        const currentBody = game.currentRun().cultivator;
        if (!currentBody.alive) return;
        const cursorNow = stoppedRoadFor(game.db, currentBody, game.atHand);
        if (!options.occupiesCourse(cursorNow)) {
            stop = 'The actual body no longer occupies this admitted road.';
            refreshDates(); return;
        }
        // Native nights are charged cumulatively from committed cursor progress,
        // so splitting a real span cannot lose or multiply an exposure night.
        const nightsNow = Math.floor(Math.max(0, cursorNow!.walked - initialCursor.walked));
        if (nightsNow > chargedNights) {
            const nights = Array.from({length:nightsNow-chargedNights}, (_,i) => run.elapsedDays + chargedNights + i);
            const charged = chargeTheNightsInTheOpen(game, run, currentBody, nights);
            chargedNights = nightsNow;
            if (charged) { recorded.lines.push(charged.line); recorded.structure.push(charged.structure); }
        }
        const day = routineTime(game.atHand!);
        while (!stop && game.currentRun().cultivator.alive && game.currentRun().run.status === 'active'
            && !next.done && next.value.kind === 'check'
            && journeyTimeHasReached(day, frame.boardedOnDay + next.value.dayOffset)) {
            // No old departure cast or body is passed back into this suspended check.
            const resolved = cadence.next(inputNow());
            if (resolved.done || resolved.value.kind !== 'resolved') throw new Error('A native foot check lost its result.');
            roll = { ...resolved.value.roll, occurrences: delivered, firstInterruptDay: roll.firstInterruptDay };
            for (const occurrence of resolved.value.occurrences) {
                const current = game.currentRun();
                if (stop || !current.cultivator.alive || current.run.status !== 'active') break;
                delivered.push(occurrence);
                if (occurrence.interrupts && roll.firstInterruptDay === null) roll.firstInterruptDay = occurrence.absoluteDay;
                const single = { ...roll, occurrences: [occurrence], firstInterruptDay: occurrence.interrupts ? occurrence.absoluteDay : null };
                const adjusted = withEncounterDeltas(current.cultivator, single);
                game.repos.cultivators.applyDeltas(body.id, { hp: adjusted.hp - current.cultivator.hp,
                    spiritStones: adjusted.spiritStones - current.cultivator.spiritStones });
                const actual = game.currentRun();
                const fact = recordEncounters(game.knowledge, actual.cultivator, actual.run.elapsedDays,
                    single, game.repos, actual.run.elapsedDays, () => game.plagueEncounterAtTheBody());
                recorded.events.push(...fact.events); recorded.lines.push(...fact.lines);
                recorded.structure.push(...fact.structure); recorded.learned.push(...fact.learned); recorded.met.push(...fact.met);
                if (comesAtYou(occurrence)) {
                    fight = theyCameAtYou(game, actual.run, actual.cultivator,
                        game.ambientFor(actual.cultivator, actual.run), single);
                    stop = occurrence.event.summary;
                } else if (occurrence.interrupts) stop = occurrence.event.summary;
            }
            next = cadence.next();
            if (next.done) roll = { ...next.value, occurrences: delivered, firstInterruptDay: roll.firstInterruptDay };
        }
        // The prediction only offers a date. The actual actor/geometry must still match.
        if (!stop && game.currentRun().cultivator.alive && options.meeting && !contactReached
            && journeyTimeHasReached(day, start + options.meeting.afterDays)) {
            contactReached = true;
            const current = game.currentRun(), npc = game.atHand!.npcs.find(row => row.id === options.meeting!.npc.id);
            const cursor = stoppedRoadFor(game.db, current.cultivator, game.atHand);
            if (npc?.status === 'alive' && sameRoadPosition(cursor?.position ?? null,
                roadPositionOfNpc(game.atHand!.locations, npc, day))) {
                const place = worldLocationFor(game.atHand!, current.cultivator.location);
                const area = place && peopleInThisPlace(game.repos, current.cultivator, game.atHand!, place).whereIs.get(npc.id);
                if (area) {
                    game.repos.cultivators.standIn(body.id, area);
                    recorded.lines.push('Another actual traveller is here on this road.');
                    recorded.structure.push(`road-contact: actual person ${npc.id}; current geometry revalidated at ${day}.`);
                    stop = 'Another traveller is here on this road.';
                }
            }
        }
        refreshDates();
    };
    resolveHere();
    const afterOccasion = game.currentRun();
    if (stop || !afterOccasion.cultivator.alive || afterOccasion.run.status !== 'active') {
        const facts = factsForToolResult('The actual road stopped at departure.', recorded.lines);
        facts.structure.push(...recorded.structure);
        const early: Execution = { facts, events: recorded.events, timeSkip: null, breakthrough: null,
            outcome: 'executed', nights: 'charged', calls: [{ name: 'engine.encounterWindow', action: 'move', ok: true,
                summary: 'Interrupted at the actual departure; no body time or pack was spent.' }],
            cutShort: { askedDays: days, livedDays: 0, cause: 'the_world',
                what: stop ?? 'The actual body can no longer undertake this road.' } };
        if (afterOccasion.cultivator.alive && afterOccasion.run.status === 'active'
            && afterOccasion.run.turn < options.resolvesOnTurn)
            early.calls.push(...game.freeAction(afterOccasion.run, 'move', facts).calls);
        if (fight) foldTheFightIn(early, fight);
        game.theWorldMoved();
        return { early, spent: null, roll, recorded, fight, contactReached, carried: 0, cutShort: early.cutShort ?? null };
    }
    const carried = game.drawFromPack(afterOccasion.cultivator, days);
    const context = options.contextFor(afterOccasion.cultivator, afterOccasion.run, carried);
    const spent = await spendAnOrdinarySpanAtTheActualClock(game, afterOccasion.run, afterOccasion.cultivator,
        days, context, 'pack', options.checkpoint, options.resolvesOnTurn, options.groundAt,
        { dates, afterBoundary: resolveHere, stop: () => stop });
    game.theWorldMoved();
    // The held body receipt has skip/applied, not an Execution cut. Project the
    // actual native stop that was delivered at this check; never add a field to
    // an unrelated structural receipt or round away a fractional stopped span.
    const cutShort: Execution['cutShort'] = stop ? { askedDays: days,
        livedDays: spent.skip.simulatedDays, cause: 'the_world', what: stop } : null;
    return { early: null, spent, roll, recorded, fight, contactReached, carried, cutShort };
}
