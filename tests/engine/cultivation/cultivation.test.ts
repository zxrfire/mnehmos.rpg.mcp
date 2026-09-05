/**
 * Cultivation progress accrual.
 */

import {
    STAGNATION_YEARS,
    type AmbientQi,
    type SpiritRootKey
} from '../../../src/schema/cultivation.js';
import {
    BASE_PROGRESS_PER_DAY,
    DAYS_PER_YEAR,
    accrueProgress,
    computeCultivationRate,
    daysToNextBreakthrough,
    isBreakthroughEligible,
    progressFraction,
    progressRemaining
} from '../../../src/engine/cultivation/cultivation.js';
import {
    AMBIENT_QI_RATE_MULTIPLIER
} from '../../../src/schema/cultivation.js';
import {
    isRealmBoundary,
    progressRequiredForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import { getSpiritRoot } from '../../../src/engine/cultivation/spirit-roots.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

const EXPECTED_FACTOR_ORDER = [
    'spirit_root',
    // The body itself, beside the root because it is the same kind of fact:
    // dealt once at birth, never earned and never chosen. Present for everybody,
    // at a multiplier of 1 for the 98 people in a hundred who were born as
    // nothing in particular - a term a player cannot see is a term they cannot
    // reason about. `engine/cultivation/physiques.ts`.
    'physique',
    // What you were dealt, then where you have got to. Both are "what this
    // body is", which is why they sit together at the front, ahead of
    // everything that is circumstance.
    'realm',
    'foundation',
    'understanding',
    'ambient_qi',
    'untreated_injuries',
    // Open wounds and closed ones are two different facts about the same body
    // and get two lines. Folding scar tissue into the injury factor would have
    // left a breakdown reading "no untreated injuries" beside a multiplier that
    // was not one, which is the one thing a rate breakdown may never do.
    'scar_tissue',
    'technique',
    // How well the book was written, priced against what this reader can take
    // off the page. Immediately after the manual's own multiplier because it is
    // the second half of the same object: `technique` is what the caller was
    // handed, this is what the book actually is. See manual-quality.ts.
    'manual_quality',
    'sect',
    'location',
    'focus',
    // Soft brake and hard ceiling, in that order, and last because a zero
    // from the ceiling must be visibly the thing that stopped them.
    'guidance',
    // The ground: a soft share of contested qi, then the hard stop on ground
    // too poor to condense on at all.
    'crowding',
    'ground_ceiling',
    // The two halves of what the book in their hands is worth, in the order
    // they bite. `technique_opening` is the soft one - an exceptional manual
    // that reaches past its own realm is genuinely worse to begin than the
    // ordinary book a house teaches, and only wins over the long run. It sits
    // immediately before the ceiling because both are facts about the same
    // object, and after it because a zero from the ceiling must still be
    // visibly the thing that stopped them.
    'technique_opening',
    'technique_ceiling'
];

describe('computeCultivationRate', () => {
    it('itemises every factor, in a fixed order', () => {
        const rate = computeCultivationRate(makeCultivator(), 'normal');
        expect(rate.factors.map(f => f.source)).toEqual(EXPECTED_FACTOR_ORDER);
        for (const factor of rate.factors) {
            expect(factor.label.length).toBeGreaterThan(0);
            expect(Number.isFinite(factor.multiplier)).toBe(true);
        }
    });

    it('produces perDay as the product of base and every factor', () => {
        const rate = computeCultivationRate(
            makeCultivator({ spiritRoot: 'mutated_ice', injuries: makeInjuries(1, 'serious') }),
            'dense',
            { techniqueBonus: 1.4, sectBonus: 1.2, locationBonus: 1.1, focusMultiplier: 0.9 }
        );
        const product = rate.factors.reduce((n, f) => n * f.multiplier, rate.base);
        expect(rate.perDay).toBeCloseTo(product, 12);
        expect(rate.base).toBe(BASE_PROGRESS_PER_DAY);
    });

    it('makes the spirit root the dominant term', () => {
        const fast = computeCultivationRate(makeCultivator({ spiritRoot: 'mutated_ice' }), 'normal');
        const slow = computeCultivationRate(
            makeCultivator({ spiritRoot: 'muddled_five_element' }),
            'normal'
        );
        expect(fast.perDay / slow.perDay).toBeCloseTo(
            getSpiritRoot('mutated_ice').cultivationSpeed /
            getSpiritRoot('muddled_five_element').cultivationSpeed,
            10
        );
    });

    it('scales exactly with the ambient multiplier', () => {
        const cultivator = makeCultivator();
        for (const band of ['thin', 'normal', 'dense', 'spirit_tide'] as const) {
            const rate = computeCultivationRate(cultivator, band);
            const normal = computeCultivationRate(cultivator, 'normal');
            expect(rate.perDay).toBeCloseTo(normal.perDay * AMBIENT_QI_RATE_MULTIPLIER[band], 10);
        }
    });

    it('slows a wounded cultivator and never drives the rate negative', () => {
        const healthy = computeCultivationRate(makeCultivator(), 'normal');
        const wounded = computeCultivationRate(
            makeCultivator({ injuries: makeInjuries(2, 'serious') }),
            'normal'
        );
        const shattered = computeCultivationRate(
            makeCultivator({ injuries: makeInjuries(30, 'crippling') }),
            'normal'
        );
        expect(wounded.perDay).toBeLessThan(healthy.perDay);
        expect(shattered.perDay).toBeLessThan(wounded.perDay);
        expect(shattered.perDay).toBeGreaterThan(0);
    });

    it('survives a caller handing in a garbage bonus', () => {
        const rate = computeCultivationRate(makeCultivator(), 'normal', {
            techniqueBonus: Number.NaN
        });
        expect(Number.isFinite(rate.perDay)).toBe(true);
        expect(rate.perDay).toBeGreaterThan(0);
    });
});

describe('accrueProgress', () => {
    it('is linear in days and never mutates the cultivator', () => {
        const cultivator = makeCultivator();
        const before = JSON.parse(JSON.stringify(cultivator));

        const oneDay = accrueProgress(cultivator, 1, { ambient: 'normal' });
        const hundred = accrueProgress(cultivator, 100, { ambient: 'normal' });

        expect(hundred.progressGained).toBeCloseTo(oneDay.progressGained * 100, 10);
        expect(hundred.newProgress).toBeCloseTo(
            cultivator.cultivationProgress + hundred.progressGained,
            10
        );
        expect(cultivator).toEqual(before);
    });

    it('treats negative or non-finite day counts as zero', () => {
        const cultivator = makeCultivator();
        expect(accrueProgress(cultivator, -5, { ambient: 'normal' }).progressGained).toBe(0);
        expect(accrueProgress(cultivator, Number.NaN, { ambient: 'normal' }).progressGained).toBe(0);
    });

    it('returns the breakdown that produced the delta', () => {
        const result = accrueProgress(makeCultivator(), 10, { ambient: 'dense' });
        expect(result.rate.factors.map(f => f.source)).toEqual(EXPECTED_FACTOR_ORDER);
        expect(result.progressGained).toBeCloseTo(result.rate.perDay * 10, 10);
    });
});

describe('breakthrough eligibility arithmetic', () => {
    it('reports eligible exactly at the required progress', () => {
        const required = progressRequiredForOrdinal(0);
        expect(
            isBreakthroughEligible(makeCultivator({ cultivationProgress: required - 0.001 }))
        ).toBe(false);
        expect(
            isBreakthroughEligible(makeCultivator({ cultivationProgress: required }))
        ).toBe(true);
    });

    it('reports the remaining progress and fraction', () => {
        const required = progressRequiredForOrdinal(0);
        const half = makeCultivator({ cultivationProgress: required / 2 });
        expect(progressRemaining(half)).toBeCloseTo(required / 2, 10);
        expect(progressFraction(half)).toBeCloseTo(0.5, 10);
        expect(progressFraction(makeCultivator({ cultivationProgress: required * 3 }))).toBe(1);
        expect(progressRemaining(makeCultivator({ cultivationProgress: required * 3 }))).toBe(0);
    });

    it('returns Infinity days when the rate is zero rather than pretending', () => {
        expect(daysToNextBreakthrough(makeCultivator(), 0)).toBe(Infinity);
        expect(daysToNextBreakthrough(makeCultivator(), Number.NaN)).toBe(Infinity);
    });

    it('returns zero days when already eligible', () => {
        const ready = makeCultivator({ cultivationProgress: progressRequiredForOrdinal(0) });
        expect(daysToNextBreakthrough(ready, 1.5)).toBe(0);
    });
});

describe('balance shape', () => {
    /** Years one rank costs a given root, at a given ambient band. */
    function yearsForRank(
        root: SpiritRootKey,
        ordinal: number,
        ambient: AmbientQi = 'normal'
    ): number {
        const rate = computeCultivationRate(makeCultivator({ spiritRoot: root }), ambient).perDay;
        return progressRequiredForOrdinal(ordinal) / rate / DAYS_PER_YEAR;
    }

    function yearsToClearQiCondensation(root: SpiritRootKey, ambient: AmbientQi = 'normal'): number {
        let total = 0;
        for (let ordinal = 0; ordinal <= 12; ordinal++) {
            total += yearsForRank(root, ordinal, ambient);
        }
        return total;
    }

    it('costs a clean single root decades, not months, to clear Qi Condensation', () => {
        const years = yearsToClearQiCondensation('single_fire');
        expect(years).toBeGreaterThan(20);
        expect(years).toBeLessThan(80);
    });

    /**
     * The genre-defining asymmetry, and the reason a spirit root is the most
     * consequential number in a run: a muddled root cannot cross the Foundation
     * boundary in normal qi before STAGNATION_YEARS kills it. It does not take
     * a penalty. It loses.
     */
    it('makes the Foundation boundary unsurvivable for a muddled root in normal qi', () => {
        expect(yearsForRank('muddled_five_element', 12)).toBeGreaterThan(STAGNATION_YEARS);
        expect(yearsForRank('single_fire', 12)).toBeLessThan(STAGNATION_YEARS);
    });

    it('makes finding dense qi the thing that saves a bad root', () => {
        expect(yearsForRank('muddled_five_element', 12, 'dense')).toBeLessThan(STAGNATION_YEARS);
        expect(yearsToClearQiCondensation('muddled_five_element', 'dense')).toBeLessThan(
            yearsToClearQiCondensation('muddled_five_element', 'normal')
        );
    });

    it('makes the Foundation boundary the single most expensive step of the realm', () => {
        expect(isRealmBoundary(12)).toBe(true);
        const boundaryCost = progressRequiredForOrdinal(12);
        for (let ordinal = 0; ordinal < 12; ordinal++) {
            expect(boundaryCost).toBeGreaterThan(progressRequiredForOrdinal(ordinal));
        }
    });
});
