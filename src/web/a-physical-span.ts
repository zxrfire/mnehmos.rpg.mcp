/** One accepted physical span; the supplied source is reread at every actual boundary. */
import type { AcceptedPassageMoment } from '../engine/world/passage-moment.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { WorldReport } from './tool-result-prose.js';
import { prepareWorldClockForPreciseSpan } from '../server/state/cultivation-world.js';
import { nextWorldClockBoundary } from '../engine/world/world-clock-boundaries.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { spendAtWorldBoundaries, type ASpentWorldSpan } from './a-span-spent-at-world-boundaries.js';
import { daoHeartConditions, tollConditionsFor } from '../server/consolidated/cultivation-support.js';
import { PLAYER_ROLL_IDENTITY } from './encounters.js';

/** A transient read of existing accepted journey/object authority, never a new position store. */
export interface PhysicalCarrier {
    locationId: string | null;
    endsOnDay: number;
    /** Original accepted departure, derived from the existing receipt (including changed courses). */
    boardedOnDay?: number;
    boardingMoment?: AcceptedPassageMoment | null;
    unavailable: string | null;
    providedFoodUntilDay?: number;
    /** Derived ground-route moments only; ships and airborne craft do not supply them. */
    vertexDates?: readonly number[];
}

export async function spendWithPhysicalCarrier(game: GameService, run: Run, body: Cultivator,
    days: number, focus: number, source: (onDay?: number) => PhysicalCarrier | null,
    grainAbstinence = false, events: {
        dates?: readonly number[] | ((onDay: number) => readonly number[]);
        afterBoundary?(): void;
        beforeWorld?(onDay: number): void;
        stop?(): string | null;
        /** Derived from the original enclosing action, never stored. */
        resolvesOnTurn?: number;
        finishTurn?: boolean;
    } = {}): Promise<ASpentWorldSpan & { world: WorldReport }> {
    game.atHand = await prepareWorldClockForPreciseSpan(run, body);
    body = game.repos.cultivators.getById(body.id) ?? body;
    run = game.repos.runs.getById(run.id) ?? run;
    const start = routineTime(game.atHand);
    const world: WorldReport = { lines: [], structure: [] };
    const actualGround = (elapsed: number): string | undefined => {
        const id = source(start + elapsed)?.locationId;
        const place = id ? game.atHand?.locations.find(place => place.id === id) : null;
        // An airborne course is an actual unique site, not one of several rows named In the air.
        return place?.tags.includes('air-course') ? place.id : place?.name;
    };
    const actualScene = () => {
        const fresh = game.repos.cultivators.getById(body.id) ?? body;
        const ground = game.groundFor(fresh);
        return { locationId: fresh.location ?? '', locationDensity: ground?.density,
            providedFoodUntilDay: source()?.providedFoodUntilDay,
            options: { focusMultiplier: focus, ...game.rateTermsFor(fresh), ground } };
    };
    const held = game.drawFromPack(body, days);
    let packDrawn = true;
    let unopened = held;
    try {
        const spent = await spendAtWorldBoundaries(game.repos, run, body, days, {
            seed: run.seed, rollIdentity: PLAYER_ROLL_IDENTITY, turn: (events.resolvesOnTurn ?? run.turn + 1) - 1,
            startDay: start, ...actualScene(), rations: held, grainAbstinence,
            autoBreakthrough: false, randomEvents: true, spanIsASitting: false,
            understanding: game.understandingFor(run, body),
            ...daoHeartConditions(game.db, body, Math.floor(run.elapsedDays)),
            toll: tollConditionsFor(game.repos, body)
        }, {
            preciseDays: true, resolvesOnTurn: events.resolvesOnTurn, finishTurn: events.finishTurn,
            nextBoundary: (elapsed, requested) => {
                const state = game.atHand;
                if (!state) return null;
                const leg = source();
                const dated = typeof events.dates === 'function' ? events.dates(start + elapsed) : events.dates ?? [];
                const next = nextWorldClockBoundary(state, start + elapsed, start + requested,
                    [...(leg ? [leg.endsOnDay, ...(leg.vertexDates ?? [])] : []), ...dated]);
                return next ? next.onDay - start : null;
            },
            commitProvisions: cumulative => {
                events.beforeWorld?.(start + cumulative.simulatedDays);
                unopened = cumulative.endState.rationsRemaining;
                game.putBackWhatWasNotEaten(body, cumulative);
                packDrawn = false;
            },
            advanceWorld: async (portion, applied, artUseInterval) => {
                const leg = source();
                const report = await game.advanceWorld(portion, applied.cultivator, applied.run, {
                    preciseDays: true, artUseInterval, passageDates: leg ? [leg.endsOnDay] : [],
                    atWorldBoundary: state => { game.atHand = state; }
                });
                world.lines.push(...report.lines); world.structure.push(...report.structure);
                events.afterBoundary?.();
            },
            whatStopsTheSpan: () => {
                const current = source();
                return events.stop?.() ?? (!current ? 'The accepted physical carrier is no longer available.' : current.unavailable);
            },
            groundAt: actualGround,
            sceneNow: actualScene,
            rationsNow: () => {
                const fresh = game.repos.cultivators.getById(body.id) ?? body;
                packDrawn = true;
                unopened = game.drawFromPack(fresh, days);
                return unopened;
            }
        });
        return { ...spent, world };
    } finally {
        // A thrown world adapter must not strand unopened provisions in a local frame.
        // Normal final/interrupted checkpoints already returned their exact remainder.
        if (packDrawn) game.putBackWhatWasNotEaten(body, { endState: { rationsRemaining: unopened } });
    }
}
