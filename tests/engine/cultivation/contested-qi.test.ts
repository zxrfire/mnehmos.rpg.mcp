/**
 * The ground: contested qi, and ground that stops you.
 *
 * Two rules `docs/world/climbing/qi.md` states plainly and the engine did not have. Both
 * were found by a lore-versus-mechanics audit, and both are quoted where they
 * are implemented in `cultivation.ts`.
 *
 *   "a region supports only so many cultivators. Qi drawn by one person is not
 *    available to another. A valley that comfortably carries thirty cultivators
 *    carries three hundred badly."
 *
 *   "In a genuinely qi-poor region, a cultivator does not merely progress
 *    slowly. They stop... Whole provinces exist where nobody has passed Qi
 *    Condensation in living memory."
 *
 * The second one's own heading is "Thin regions have a CEILING", which is why
 * it is a hard zero and not a smaller multiplier: a multiplier scales and never
 * stops, so at thin's x0.5 everybody passed Qi Condensation eventually and the
 * province where the higher realms are stories could not exist.
 */

import { describe, it, expect } from 'vitest';
import {
    BARREN_GROUND_CEILING,
    QI_BARREN_DENSITY,
    QI_CARRYING_CAPACITY,
    carryingCapacityFor,
    computeCultivationRate,
    crowdingMultiplier,
    groundExhausted,
    qiDrawOf,
    realmIntakeMultiplier
} from '../../../src/engine/cultivation/cultivation.js';
import { BAND_DENSITY_CENTRE } from '../../../src/engine/cultivation/ambient.js';
import { FOUNDATION_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import { makeCultivator } from './fixtures.js';

/** N cultivators at ordinal 0, each drawing one mortal share. */
const crowd = (n: number) => Array.from({ length: n }, () => 0);

describe('a valley carries only so many', () => {
    it('is calibrated on the doc: an ordinary valley carries thirty', () => {
        expect(carryingCapacityFor(BAND_DENSITY_CENTRE.normal)).toBe(30);
        expect(QI_CARRYING_CAPACITY).toBe(72);
    });

    it('carries thirty comfortably and three hundred badly', () => {
        const density = BAND_DENSITY_CENTRE.normal;
        expect(crowdingMultiplier({ density, occupantOrdinals: crowd(30) })).toBe(1);
        const three_hundred = crowdingMultiplier({ density, occupantOrdinals: crowd(300) });
        expect(three_hundred).toBeCloseTo(0.1, 10);
    });

    it('slows everybody a little more for every additional person', () => {
        const density = BAND_DENSITY_CENTRE.normal;
        let previous = 1;
        for (const n of [30, 40, 60, 100, 300]) {
            const share = crowdingMultiplier({ density, occupantOrdinals: crowd(n) });
            expect(share).toBeLessThanOrEqual(previous);
            previous = share;
        }
    });

    it('lets richer ground carry more, which is why veins are worth holding', () => {
        expect(carryingCapacityFor(BAND_DENSITY_CENTRE.dense))
            .toBeGreaterThan(carryingCapacityFor(BAND_DENSITY_CENTRE.normal));
        expect(carryingCapacityFor(BAND_DENSITY_CENTRE.normal))
            .toBeGreaterThan(carryingCapacityFor(BAND_DENSITY_CENTRE.thin));
    });

    it('measures occupancy in DRAW, so one elder crowds out many disciples', () => {
        // "Qi drawn by one person is not available to another" - and a Deity
        // Transformation cultivator does not draw what an outer disciple draws.
        const oneElder = qiDrawOf([25]);
        expect(oneElder).toBeCloseTo(realmIntakeMultiplier(25), 10);
        expect(oneElder).toBeGreaterThan(qiDrawOf(crowd(15)));
    });

    it('does nothing at all when the caller supplies no ground', () => {
        expect(crowdingMultiplier(null)).toBe(1);
        expect(crowdingMultiplier(undefined)).toBe(1);
        expect(crowdingMultiplier({ density: 0.42 })).toBe(1);
    });

    it('is a real term in the rate, not just a helper', () => {
        const roomy = computeCultivationRate(makeCultivator(), 'normal', {
            ground: { density: BAND_DENSITY_CENTRE.normal, occupantOrdinals: crowd(10) }
        }).perDay;
        const packed = computeCultivationRate(makeCultivator(), 'normal', {
            ground: { density: BAND_DENSITY_CENTRE.normal, occupantOrdinals: crowd(300) }
        }).perDay;
        expect(packed).toBeLessThan(roomy);
        expect(packed).toBeCloseTo(roomy * 0.1, 6);
    });
});

describe('poor ground stops you rather than slowing you', () => {
    it('draws the line at the centre of the thin band itself', () => {
        expect(QI_BARREN_DENSITY).toBe(BAND_DENSITY_CENTRE.thin);
    });

    it('carries nobody past Qi Condensation', () => {
        const barren = { density: QI_BARREN_DENSITY - 0.01 };
        expect(BARREN_GROUND_CEILING).toBe(FOUNDATION_ORDINAL - 1);
        expect(groundExhausted(BARREN_GROUND_CEILING, barren)).toBe(true);
        expect(
            computeCultivationRate(
                makeCultivator({ realmOrdinal: BARREN_GROUND_CEILING }), 'normal', { ground: barren }
            ).perDay
        ).toBe(0);
    });

    it('gathers on ordinals 0 to 11 and nothing on 12, which is the runway', () => {
        // Said precisely because one rung matters to a reader: twelve rungs of
        // ordinary gathering, then nothing on the thirteenth.
        const barren = { density: QI_BARREN_DENSITY * 0.9 };
        for (let ordinal = 0; ordinal < BARREN_GROUND_CEILING; ordinal++) {
            expect(
                computeCultivationRate(
                    makeCultivator({ realmOrdinal: ordinal }), 'normal', { ground: barren }
                ).perDay,
                `ordinal ${ordinal} should still gather`
            ).toBeGreaterThan(0);
        }
        expect(BARREN_GROUND_CEILING).toBe(12);
        expect(
            computeCultivationRate(
                makeCultivator({ realmOrdinal: 12 }), 'normal', { ground: barren }
            ).perDay
        ).toBe(0);
    });

    it('still lets them REACH the last rung, because 11 still gathers', () => {
        // All thirteen rungs stay reachable; only the thirteenth cannot be
        // gathered on. People live and cultivate on dead ground - they simply
        // never leave the realm, which is the lore sentence exactly.
        const barren = { density: QI_BARREN_DENSITY * 0.9 };
        expect(
            computeCultivationRate(
                makeCultivator({ realmOrdinal: BARREN_GROUND_CEILING - 1 }), 'normal',
                { ground: barren }
            ).perDay
        ).toBeGreaterThan(0);
    });

    it('is strict at the threshold: ground exactly on the constant is ordinary', () => {
        // A sharp edge, deliberately, and pinned so it cannot be rediscovered
        // as a bug. A reviewer testing AT the boundary read the rule as
        // unimplemented; testing below it is what shows the rule.
        expect(groundExhausted(12, { density: QI_BARREN_DENSITY })).toBe(false);
        expect(groundExhausted(12, { density: QI_BARREN_DENSITY * 0.9 })).toBe(true);
    });

    it('cannot be ground through by talent, discipline or years', () => {
        // "no amount of talent, discipline or years will manufacture it"
        const barren = { density: QI_BARREN_DENSITY - 0.01 };
        expect(
            computeCultivationRate(
                makeCultivator({ realmOrdinal: BARREN_GROUND_CEILING, spiritRoot: 'mutated_ice' }),
                'spirit_tide',
                { ground: barren, sectBonus: 5, locationBonus: 5, guideOrdinal: 44 }
            ).perDay
        ).toBe(0);
    });

    it('lifts the moment the cultivator stands somewhere better', () => {
        const ordinary = { density: BAND_DENSITY_CENTRE.normal };
        expect(groundExhausted(BARREN_GROUND_CEILING, ordinary)).toBe(false);
        expect(
            computeCultivationRate(
                makeCultivator({ realmOrdinal: BARREN_GROUND_CEILING }), 'normal', { ground: ordinary }
            ).perDay
        ).toBeGreaterThan(0);
    });

    it('imposes nothing when the caller supplies no ground', () => {
        expect(groundExhausted(44, null)).toBe(false);
        expect(groundExhausted(44, undefined)).toBe(false);
    });
});
