/**
 * What bounds a span is the life asking for it, and that held in seven places.
 *
 * ── The defect, as it stood ──────────────────────────────────────────────
 *
 * `lifespanCeilingFor` is the ceiling THIS body gets - rung, immortal status
 * and physique folded together - and it is what `evaluateDeathConditions` kills
 * on. Seven other places re-derived the answer from `lifespanForOrdinal`, the
 * rung on its own, and every one of them was wrong for a shortened body.
 *
 * The expensive one was inside the skip, and it was wrong TWICE over:
 *
 *   - `snapshot()` did not carry `physique`, so `evaluateDeathConditions` read
 *     it as undefined and priced the skip at the rung's ceiling. A Profound Yin
 *     body (0.35 of the rung's years) therefore could not die of
 *     `lifespan_exhausted` inside a skip at all.
 *   - `lifespanDays`, the chunk boundary, came off `lifespanForOrdinal` too, so
 *     the boundary sat 1/0.35 = 2.9x past the true ceiling and was never the
 *     reason the loop stopped.
 *
 * Measured here, ordinal 0, age 16, no events, no breakthrough, fed:
 *
 *     ordinary body      ceiling 100y   84 years left    30,660 days
 *     Profound Yin       ceiling  35y   19 years left     6,935 days
 *
 * and before the fix the Profound Yin life ran to the stagnation clock at 50
 * years instead - 18,250 days, 2.6x the span the body had.
 *
 * ── What these pin ───────────────────────────────────────────────────────
 *
 * That the days left are the ceiling minus the age and nothing else; that a
 * shortened body gets a shorter number; and that inside a skip the death lands
 * on exactly that day rather than on whichever 30-day ambient boundary falls
 * past it.
 *
 * Red-checked by reverting each of the two time-skip lines in turn: dropping
 * `physique` from `snapshot()` ends the Profound Yin life at 18,250 days of
 * stagnation, and restoring the rung-only `lifespanDays` leaves the death to
 * land on a grid point instead of on the ceiling.
 */

import { describe, it, expect } from 'vitest';

import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import {
    daysOfLifeRemaining,
    lifespanCeilingFor
} from '../../../src/engine/cultivation/survival.js';
import { physiqueOrNull } from '../../../src/engine/cultivation/physiques.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import { makeCultivator } from './fixtures.js';

const AGE = 16;

const body = (physique: 'profound_yin' | 'hollow_marrow' | null) =>
    makeCultivator({ realmOrdinal: 0, age: AGE, yearsAtCurrentRealm: 0, physique });

/**
 * Nothing in the way, so the only clock running is the lifespan.
 *
 * `focusMultiplier: 0` is what turns the deviation checks off: qi deviation is
 * the price of DRAWING qi, so a span that draws none cannot be interrupted by
 * one. Without it a Profound Yin body - 1.6x rate, and every one of those days
 * a deviation check - was ejected on `lethal_injury_threshold` around day 840,
 * which measures the deviation grid rather than the ceiling.
 */
const sit = (who: ReturnType<typeof body>, days: number) =>
    simulateTimeSkip(who, days, {
        seed: 'a-span-is-bounded-by-the-life',
        locationId: 'a cave like any other',
        locationDensity: 0.35,
        startDay: 0,
        autoBreakthrough: false,
        randomEvents: false,
        grainAbstinence: true,
        options: { focusMultiplier: 0 }
    });

describe('the days a body has left', () => {
    it('is the ceiling minus the age, and nothing else', () => {
        const ordinary = body(null);
        expect(daysOfLifeRemaining(ordinary))
            .toBe(Math.floor((lifespanCeilingFor(ordinary) - AGE) * DAYS_PER_YEAR));
    });

    it('is shorter for a shortened body, by the physique it was born with', () => {
        const ordinary = body(null);
        const yin = body('profound_yin');

        expect(daysOfLifeRemaining(yin)).toBeLessThan(daysOfLifeRemaining(ordinary));
        expect(daysOfLifeRemaining(yin)).toBe(
            Math.floor(
                (lifespanCeilingFor(ordinary) * physiqueOrNull('profound_yin')!.lifespan - AGE)
                * DAYS_PER_YEAR
            )
        );
    });

    it('is longer for a body the years do not hurry', () => {
        expect(daysOfLifeRemaining(body('hollow_marrow')))
            .toBeGreaterThan(daysOfLifeRemaining(body(null)));
    });

    it('is unbounded for somebody outside the arithmetic', () => {
        // The same condition the death gate uses: a True Immortal is through
        // the Lid and has no span to be measured against.
        expect(daysOfLifeRemaining(
            makeCultivator({ realmOrdinal: 46, age: 4000, immortalStatus: 'true_immortal' })
        )).toBe(Infinity);
    });
});

describe('a skip stops on the ceiling the death gate enforces', () => {
    it('ends a shortened body on exactly the day it runs out', () => {
        const yin = body('profound_yin');
        const left = daysOfLifeRemaining(yin);

        // A century asked for by somebody who has nineteen years.
        const skip = sit(yin, 100 * 365);

        expect(skip.deathCause).toBe('lifespan_exhausted');
        expect(skip.simulatedDays).toBe(left);
    });

    it('does not end the same life at the rung that body does not get', () => {
        const ordinary = body(null);
        const yin = body('profound_yin');

        // The span that kills the shortened body leaves the ordinary one
        // standing, which is the whole of what the physique costs.
        const skip = sit(ordinary, daysOfLifeRemaining(yin));

        expect(skip.deathCause).toBeNull();
        expect(skip.simulatedDays).toBe(daysOfLifeRemaining(yin));
    });

    it('lets a body sit down for the whole of what it has, and no further', () => {
        const yin = body('profound_yin');
        const left = daysOfLifeRemaining(yin);

        // Asking for exactly what is left is a coherent act and the engine
        // resolves the whole of it. The death at the end is the arithmetic,
        // not a refusal.
        const whole = sit(yin, left);
        expect(whole.simulatedDays).toBe(left);
        expect(whole.deathCause).toBe('lifespan_exhausted');

        // One day short and the life is still there to be spent.
        const almost = sit(yin, left - 1);
        expect(almost.simulatedDays).toBe(left - 1);
        expect(almost.deathCause).toBeNull();
    });
});
