import { effectiveArtCooldownDays, type AnArtUseInterval } from '../engine/cultivation/an-art-that-is-ready-to-use.js';
/** Commit one held body's simulation at genuine world appointments. */
import type { Cultivator, Run, TimeSkipResult } from '../schema/cultivation.js';
import { simulateTimeSkipParts, type TimeSkipContext, type TimeSkipScene } from '../engine/cultivation/time-skip.js';
import { type CultivationRepos } from '../server/consolidated/cultivation-support.js';
import { applyTimeSkip, type ApplySkipResult } from './apply.js';

/** A cumulative target becomes one new portion, through the existing body projection. */
export function portionOfTimeSkip(
    cumulative: TimeSkipResult, previous: TimeSkipResult | null): TimeSkipResult {
    const consumed = previous?.simulatedDays ?? 0;
    if (cumulative.simulatedDays < consumed) throw new Error('A held span cannot move backward.');
    const injuries = cumulative.injuriesSustained.slice(previous?.injuriesSustained.length ?? 0);
    return {
        ...cumulative,
        requestedDays: cumulative.requestedDays - consumed,
        simulatedDays: cumulative.simulatedDays - consumed,
        // Events are rendered once from the final cumulative engine result.
        // Application writes new injuries, tolls and understanding, not prose.
        events: [],
        deltas: {
            cultivationProgress: cumulative.deltas.cultivationProgress - (previous?.deltas.cultivationProgress ?? 0),
            realmOrdinal: cumulative.deltas.realmOrdinal - (previous?.deltas.realmOrdinal ?? 0),
            hp: cumulative.deltas.hp - (previous?.deltas.hp ?? 0),
            qi: cumulative.deltas.qi - (previous?.deltas.qi ?? 0),
            satiety: cumulative.deltas.satiety - (previous?.deltas.satiety ?? 0),
            spiritStones: cumulative.deltas.spiritStones - (previous?.deltas.spiritStones ?? 0),
            age: cumulative.deltas.age - (previous?.deltas.age ?? 0),
            injuriesGained: injuries.length
        },
        injuriesSustained: injuries,
        tolls: cumulative.tolls.slice(previous?.tolls.length ?? 0),
        achievements: cumulative.achievements.slice(previous?.achievements.length ?? 0),
        insightsGained: cumulative.insightsGained.slice(previous?.insightsGained.length ?? 0),
        visions: cumulative.visions.slice(previous?.visions.length ?? 0),
        foundationEstablished: cumulative.foundationEstablished === previous?.foundationEstablished
            ? null : cumulative.foundationEstablished,
        immortalStatusGained: cumulative.immortalStatusGained === previous?.immortalStatusGained
            ? null : cumulative.immortalStatusGained
    };
}

export interface ASpanAtWorldBoundaries {
    /** Elapsed boundary of THIS held span, read again after every actual transition. */
    nextBoundary(elapsed: number, requestedDays: number): number | null;
    /** Advances the actual world by exactly the newly committed body portion. */
    advanceWorld(portionDays: number, applied: ApplySkipResult, interval: AnArtUseInterval): Promise<void>;
    /** Fresh physical sources decide whether a later portion can still happen. */
    whatStopsTheSpan(): string | null;
    /** Ground of the still-valid physical leg, including a body's death point. */
    groundAt?(elapsed: number): string | undefined;
    /** Fresh actual ground/rate inputs after passenger projection and consequences. */
    sceneNow?(): Partial<TimeSkipScene>;
    /** Return unopened real provisions before any boundary can inspect or change holdings. */
    commitProvisions?(cumulative: TimeSkipResult, finished: boolean): void;
    /** Actual pack/hull stock AFTER world effects and consumed provisions persist. */
    rationsNow?(): number;
    /** Passage remainders alone can request a nonintegral body's span. */
    preciseDays?: boolean;
    /** Original enclosing action completion; already completed replies must not count twice. */
    resolvesOnTurn?: number;
    /** A successful preparatory span leaves original action completion to its handler. */
    finishTurn?: boolean;
}

export interface ASpentWorldSpan {
    skip: TimeSkipResult;
    applied: ApplySkipResult;
}

/**
 * No resimulation, body rollback or stream restart. The iterator retains its own
 * original action turn and arithmetic; every portion persists only new quantities.
 */
export async function spendAtWorldBoundaries(repos: CultivationRepos, run: Run,
    initial: Cultivator, days: number, context: TimeSkipContext,
    clock: ASpanAtWorldBoundaries): Promise<ASpentWorldSpan> {
    const parts = simulateTimeSkipParts(initial, days, context, {
        nextBoundary: clock.nextBoundary,
        preciseDays: clock.preciseDays
    });
    const resolvesOnTurn = clock.resolvesOnTurn ?? run.turn + 1;
    let previous: TimeSkipResult | null = null;
    let next = parts.next();
    let latest: ApplySkipResult | null = null;
    const tollLines: string[] = [];
    const tollApplications: ApplySkipResult['tollApplications'] = [];
    let understanding = { insights: 0, achievements: 0 };
    for (;;) {
        const cumulative = next.value;
        const body = repos.cultivators.getById(initial.id);
        const liveRun = repos.runs.getById(run.id);
        if (!body || !liveRun) throw new Error('A spent span lost its actual body or run.');
        const portion = portionOfTimeSkip(cumulative, previous);
        // A boundary may have ended this actual body after its portion was
        // committed. The held generator then returns a stop-only completion;
        // applying that zero portion would try to mutate the native dead row.
        if (previous !== null && !body.alive) {
            if (!latest || portion.simulatedDays !== 0) {
                throw new Error('A dead body cannot have a new uncommitted span portion.');
            }
            return spanAfterTheWorldBoundary(cumulative,
                { ...latest, injuries: cumulative.injuriesSustained, tollLines, tollApplications, understanding },
                body, liveRun, cumulative.died ? null
                    : cumulative.interruptReason ?? 'The actual body died during the world span.');
        }
        latest = applyTimeSkip(repos, { before: previous === null ? initial : body, run: liveRun, skip: portion,
            // A stop-only final receipt has no new movement. Its reconciled body
            // and native completion still commit, but a departed course cannot
            // overwrite an actual relocation at the preceding world boundary.
            location: previous !== null && portion.simulatedDays === 0
                ? undefined : clock.groundAt?.(cumulative.simulatedDays),
            resolvesOnTurn, finishTurn: clock.finishTurn !== false && next.done === true && liveRun.turn < resolvesOnTurn,
            cooldownDays: effectiveArtCooldownDays(cumulative.simulatedDays, previous?.simulatedDays ?? 0) });
        tollLines.push(...latest.tollLines);
        tollApplications.push(...latest.tollApplications);
        understanding = { insights: understanding.insights + latest.understanding.insights,
            achievements: understanding.achievements + latest.understanding.achievements };
        clock.commitProvisions?.(cumulative, next.done === true);
        if (portion.simulatedDays > 0) await clock.advanceWorld(portion.simulatedDays, latest, {
            previousElapsed: previous?.simulatedDays ?? 0, cumulativeElapsed: cumulative.simulatedDays });
        const fresh = repos.cultivators.getById(initial.id);
        const freshRun = repos.runs.getById(run.id);
        if (!fresh || !freshRun) throw new Error('A boundary lost its authoritative sheet or run.');
        const stop = clock.whatStopsTheSpan() ?? (!fresh.alive && !cumulative.died
            ? 'The actual body died during the world span.' : null);
        if (next.done) return spanAfterTheWorldBoundary(cumulative,
            { ...latest, injuries: cumulative.injuriesSustained, tollLines, tollApplications, understanding },
            fresh, freshRun, stop);
        previous = cumulative;
        next = parts.next({
            stop: stop ?? undefined, body: fresh, scene: stop ? undefined : clock.sceneNow?.(),
            // Native dead custody is left to the existing death/estate path.
            // Even a stop reply evaluates argument expressions, so do not draw
            // the dead person's stock while completing this held frame.
            rations: !fresh.alive ? cumulative.endState.rationsRemaining
                : clock.rationsNow?.() ?? cumulative.endState.rationsRemaining
        });
    }
}

/** A final appointment is a real consequence too; it is never a cached arrival. */
export function spanAfterTheWorldBoundary(skip: TimeSkipResult, applied: ApplySkipResult,
    body: Cultivator, run: Run, stop: string | null): ASpentWorldSpan {
    return {
        // The time-skip's wounds/grants/death remain its own. An external loss
        // interrupts the passage without manufacturing a simulated death event.
        skip: stop ? { ...skip, interrupted: true, interruptReason: stop } : skip,
        applied: { ...applied, cultivator: body, run }
    };
}
