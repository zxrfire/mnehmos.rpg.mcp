/**
 * Settling, and why the allowance scales.
 *
 * Settling was a flat 50 years while rank cost grows at 1.35^ordinal, which
 * made it not a difficulty curve but a WALL: past roughly ordinal 17 a single
 * rank cost more years of accumulation than the plateau allowance permitted,
 * and nothing could rescue it - not insights, not pills, not dense qi, not
 * sect backing. A seeded sweep measured the chance of ever reaching Nascent
 * Soul at 0.00% in thin, normal AND dense qi.
 *
 * The allowance is now proportional to the lifespan the realm itself grants,
 * floored at STAGNATION_YEARS. The two properties that matter are tested here:
 * the early game did not move at all, and above it the allowance tracks the
 * realm's own timescale.
 */

import {
    STAGNATION_LIFESPAN_FRACTION,
    STAGNATION_YEARS,
    stagnationYearsForOrdinal
} from '../../../src/schema/cultivation.js';
import {
    MAX_ORDINAL,
    FOUNDATION_ORDINAL,
    REALM_TIERS,
    lifespanForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import { evaluateDeathConditions, stagnationRemaining } from '../../../src/engine/cultivation/survival.js';
import { makeCultivator } from './fixtures.js';

describe('the early game did not move', () => {
    it('keeps every Qi Condensation rank at exactly the old flat allowance', () => {
        for (let ordinal = 0; ordinal < FOUNDATION_ORDINAL; ordinal++) {
            expect(stagnationYearsForOrdinal(ordinal)).toBe(STAGNATION_YEARS);
        }
    });

    it('keeps every Foundation Establishment rank at exactly the old allowance', () => {
        // 84% of runs end at or below here, and that cruelty is load-bearing.
        const foundation = REALM_TIERS.find(t => t.key === 'foundation_establishment')!;
        for (let ordinal = foundation.ordinalStart; ordinal <= foundation.ordinalEnd; ordinal++) {
            expect(stagnationYearsForOrdinal(ordinal)).toBe(STAGNATION_YEARS);
        }
    });

    it('stays below the ceiling that would start relaxing Foundation', () => {
        // Foundation grants 200 years, so any fraction above 0.25 would lift
        // its allowance off the floor and quietly soften the early game.
        const ceiling = STAGNATION_YEARS / lifespanForOrdinal(FOUNDATION_ORDINAL);
        expect(STAGNATION_LIFESPAN_FRACTION).toBeLessThanOrEqual(ceiling);
    });

    it('still kills an early-game cultivator on exactly the fiftieth year', () => {
        const base = { realmOrdinal: 5, age: 60 };
        expect(
            evaluateDeathConditions(makeCultivator({ ...base, yearsAtCurrentRealm: 49.999 }))
        ).toBeNull();
        expect(
            evaluateDeathConditions(makeCultivator({ ...base, yearsAtCurrentRealm: 50 }))
        ).toBe('stagnation_aging');
    });
});

describe('above the early game the allowance tracks the realm', () => {
    it('grows with the lifespan the realm actually grants', () => {
        for (const tier of REALM_TIERS) {
            const allowance = stagnationYearsForOrdinal(tier.ordinalStart);
            expect(allowance).toBe(
                Math.max(STAGNATION_YEARS, tier.lifespanYears * STAGNATION_LIFESPAN_FRACTION)
            );
        }
    });

    it('never decreases as the ladder rises', () => {
        for (let ordinal = 1; ordinal <= MAX_ORDINAL; ordinal++) {
            expect(stagnationYearsForOrdinal(ordinal)).toBeGreaterThanOrEqual(
                stagnationYearsForOrdinal(ordinal - 1)
            );
        }
    });

    it('remains a real pressure rather than becoming decorative', () => {
        // A plateau must always cost a meaningful slice of the realm's own
        // span. If this ever exceeded a third, settling would stop mattering.
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const share = stagnationYearsForOrdinal(ordinal) / lifespanForOrdinal(ordinal);
            expect(share).toBeLessThanOrEqual(0.5);
            expect(share).toBeGreaterThan(0);
        }
    });

    it('gives a Core Formation cultivator more plateau than a mortal-span one', () => {
        expect(stagnationYearsForOrdinal(17)).toBeGreaterThan(stagnationYearsForOrdinal(12));
        expect(stagnationYearsForOrdinal(21)).toBeGreaterThan(stagnationYearsForOrdinal(17));
    });

    it('kills a high-realm cultivator on their own scaled threshold, not on 50', () => {
        const nascent = { realmOrdinal: 21, age: 300 };
        const allowance = stagnationYearsForOrdinal(21);
        expect(allowance).toBeGreaterThan(STAGNATION_YEARS);
        // Fifty years of plateau no longer kills a cultivator with 1000 to spend.
        expect(
            evaluateDeathConditions(makeCultivator({ ...nascent, yearsAtCurrentRealm: STAGNATION_YEARS }))
        ).toBeNull();
        expect(
            evaluateDeathConditions(makeCultivator({ ...nascent, yearsAtCurrentRealm: allowance - 0.001 }))
        ).toBeNull();
        expect(
            evaluateDeathConditions(makeCultivator({ ...nascent, yearsAtCurrentRealm: allowance }))
        ).toBe('stagnation_aging');
    });

    it('reports the remaining plateau against the scaled allowance', () => {
        const cultivator = makeCultivator({ realmOrdinal: 21, yearsAtCurrentRealm: 20 });
        expect(stagnationRemaining(cultivator)).toBe(stagnationYearsForOrdinal(21) - 20);
    });
});
