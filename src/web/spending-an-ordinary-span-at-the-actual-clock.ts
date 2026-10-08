/** Native verb arithmetic uses one held body across actual world boundaries and current checks.
 * Retrieval appointments originally required this shared body; ordinary fractional spans
 * and native MCP callers use the same iterator and completion authority. */
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { TimeSkipContext } from '../engine/cultivation/time-skip.js';
import { simulateTimeSkip } from '../engine/cultivation/time-skip.js';
import { nextWorldClockBoundary } from '../engine/world/world-clock-boundaries.js';
import { routineTime } from '../engine/world/npc-routines.js';
import type { GameService } from './turn-engine.js';
import { applyTimeSkip } from './apply.js';
import { spendAtWorldBoundaries } from './a-span-spent-at-world-boundaries.js';
import type { WorldReport } from './tool-result-prose.js';

/** Only actual services read by the held native iterator; no GameService construction. */
export type OrdinarySpanServices = Pick<GameService,
    'worldEnabled' | 'atHand' | 'repos' | 'putBackWhatWasNotEaten' |
    'drawFromPack' | 'rationsHeld' | 'advanceWorld'> &
    (Pick<GameService, 'groundFor' | 'rateTermsFor'> | {
        sceneForSpan(body: Cultivator, context: TimeSkipContext):
            Partial<import('../engine/cultivation/time-skip.js').TimeSkipScene>;
    });

/** The caller prepares its body, encounters and context AFTER clock promotion. */
export async function spendAnOrdinarySpanAtTheActualClock(game: OrdinarySpanServices, run: Run,
    initial: Cultivator, days: number, context: TimeSkipContext,
    provisions: 'pack' | 'reserved', beforeWorld?: (portionDays: number) => void,
    resolvesOnTurn = run.turn + 1, groundAt?: (elapsed: number) => string | undefined,
    checks?: { dates: readonly number[]; afterBoundary(): void | Promise<void>; stop(): string | null },
    finishTurn = true) {
    const active = game.worldEnabled && game.atHand?.npcs.some(n => n.activity?.retrievalRequestId);
    // Ordinary nonintegral spans use the same held native body as appointments.
    // Whole inactive spans retain their existing fast path.
    if (!active && Number.isInteger(days) && !groundAt && !checks) {
        const skip = simulateTimeSkip(initial, days, context);
        if (provisions === 'pack') game.putBackWhatWasNotEaten(initial, skip);
        const applied = applyTimeSkip(game.repos, { before: initial, run, skip,
            resolvesOnTurn, finishTurn: finishTurn && run.turn < resolvesOnTurn });
        beforeWorld?.(skip.simulatedDays);
        const world = await game.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);
        const body = game.repos.cultivators.getById(initial.id);
        const currentRun = game.repos.runs.getById(run.id);
        if (!body || !currentRun) throw new Error('A completed span lost its actual body or run.');
        return { skip, applied: { ...applied, cultivator: body, run: currentRun }, world };
    }
    const start = game.atHand ? routineTime(game.atHand) : run.elapsedDays;
    const world: WorldReport = { lines: [], structure: [] };
    let unopened = context.rations ?? 0;
    let exposed = false;
    // A reserved sitting bundle is still the original purchased bundle. Other
    // pack stock is not silently recruited into this already-priced sitting.
    const reclaim = () => {
        const fresh = game.repos.cultivators.getById(initial.id);
        // The shared iterator can ask for rations even when its stop reply is
        // already set. A dead/missing body must never open or reclaim stock.
        if (!fresh?.alive) return 0;
        const actual = game.drawFromPack(fresh, days);
        const reserved = provisions === 'pack' ? actual : Math.min(unopened, actual);
        if (actual > reserved) game.putBackWhatWasNotEaten(initial,
            { endState: { rationsRemaining: actual - reserved } });
        exposed = false;
        unopened = reserved;
        return reserved;
    };
    const spent = await spendAtWorldBoundaries(game.repos, run, initial, days, context, {
        preciseDays: true, resolvesOnTurn, finishTurn, groundAt,
        nextBoundary: (elapsed, requested) => {
            const next = game.atHand && nextWorldClockBoundary(game.atHand,
                start + elapsed, start + requested, checks?.dates ?? []);
            return next ? next.onDay - start : null;
        },
        commitProvisions: cumulative => {
            unopened = cumulative.endState.rationsRemaining;
            game.putBackWhatWasNotEaten(initial, cumulative);
            exposed = true;
        },
        advanceWorld: async (portionDays, applied, artUseInterval) => {
            beforeWorld?.(portionDays);
            const report = await game.advanceWorld(portionDays, applied.cultivator, applied.run, {
                preciseDays: true, artUseInterval, atWorldBoundary: state => { game.atHand = state; }
            });
            world.lines.push(...report.lines); world.structure.push(...report.structure);
            // Cursor checkpoint and native world consequences precede current check input.
            await checks?.afterBoundary();
        },
        whatStopsTheSpan: () => {
            const fresh = game.repos.cultivators.getById(initial.id);
            return !fresh?.alive ? 'The actual body can no longer continue this span.' : checks?.stop() ?? null;
        },
        sceneNow: () => {
            const fresh = game.repos.cultivators.getById(initial.id) ?? initial;
            if ('sceneForSpan' in game) return game.sceneForSpan(fresh, context);
            const ground = game.groundFor(fresh);
            return { locationId: fresh.location ?? context.locationId,
                locationDensity: ground?.density,
                options: { ...context.options, ...game.rateTermsFor(fresh), ground } };
        },
        rationsNow: reclaim
    }).catch(error => {
        // A thrown adapter cannot strand unopened goods in the suspended frame.
        // Already-exposed goods remain in their canonical actual pack instead.
        if (!exposed) game.putBackWhatWasNotEaten(initial,
            { endState: { rationsRemaining: unopened } });
        throw error;
    });
    // A final appointment may change actual holdings too. Pack spans leave
    // their actual remainder in the pack; a sitting retains its own bundle in
    // the existing result/crossroads, as before, never both places at once.
    if (provisions === 'reserved' && !spent.applied.cultivator.alive) {
        // Unopened food already exposed before world consequences remains in
        // actual custody for native death/estate handling. There is no second
        // local bundle that a dead body could resume or reclaim.
        spent.skip = { ...spent.skip, endState: { ...spent.skip.endState,
            rationsRemaining: 0 } };
    } else if (provisions === 'reserved' && exposed) {
        const remaining = reclaim();
        spent.skip = { ...spent.skip, endState: { ...spent.skip.endState,
            rationsRemaining: remaining } };
    }
    if (provisions === 'pack') spent.skip = { ...spent.skip,
        endState: { ...spent.skip.endState, rationsRemaining: game.rationsHeld(initial) } };
    return { ...spent, world };
}
