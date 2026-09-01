/**
 * Design guards for waiting.
 *
 * `docs/world/tone.md` says a run is interesting when the player has to choose
 * between two things the world will make them regret, and gives as its first
 * example "breakthrough now at poor odds, or stagnate toward settling". That
 * sentence was false: nothing a player accumulated appeared in the odds at all,
 * so striking the instant the gate opened was strictly optimal at every rung.
 *
 * These pin BOTH directions, which is the whole difficulty - waiting has to be
 * worth something, and it must never be worth enough.
 */

import { describe, it, expect } from 'vitest';

import {
    computeBreakthroughOdds,
    overflowBonus,
    maxChanceFor,
    MAX_OVERFLOW_BONUS,
    OVERFLOW_HALF_AT,
    MAX_BOUNDARY_CHANCE,
    lifespanPressure
} from '../../../src/engine/cultivation/breakthrough.js';
import {
    isRealmBoundary,
    MAX_ORDINAL,
    progressRequiredForOrdinal
} from '../../../src/engine/cultivation/realms.js';
import { makeCultivator } from './fixtures.js';

function oddsAt(ordinal: number, multipleOfRequirement: number, age?: number): number {
    const required = progressRequiredForOrdinal(ordinal);
    if (required === null) return 0;
    return computeBreakthroughOdds(
        {
            ...makeCultivator(),
            realmOrdinal: ordinal,
            cultivationProgress: required * multipleOfRequirement,
            ...(age === undefined ? {} : { age })
        },
        { ambient: 'normal', pill: null }
    ).finalChance;
}

// ─────────────────────────────────────────────────────────────────────────
describe('waiting is worth something', () => {
    it('excess progress improves the odds, which it did not before', () => {
        // The measurement this whole term exists to correct. Rung 16 read
        // 32.4% at x1 the requirement and 32.4% at x4.
        for (const ordinal of [13, 16, 28]) {
            expect(oddsAt(ordinal, 2), `rung ${ordinal}`).toBeGreaterThan(oddsAt(ordinal, 1));
            expect(oddsAt(ordinal, 4), `rung ${ordinal}`).toBeGreaterThan(oddsAt(ordinal, 2));
        }
    });

    it('the gain is large enough to be a real decision', () => {
        // A few tenths of a percent would be a flavour note. The choice has to
        // be worth stopping to think about: at a realm boundary, patience is
        // worth roughly ten points of chance.
        expect(oddsAt(16, 4) - oddsAt(16, 1)).toBeGreaterThan(0.08);
    });

    it('is itemised, so a player can see what the decade bought', () => {
        const required = progressRequiredForOrdinal(16)!;
        const odds = computeBreakthroughOdds(
            { ...makeCultivator(), realmOrdinal: 16, cultivationProgress: required * 3 },
            { ambient: 'normal', pill: null }
        );
        const line = odds.modifiers.find(m => m.source === 'accumulated_overflow');
        expect(line).toBeDefined();
        expect(line!.delta).toBeGreaterThan(0);
        // The ledger must still sum exactly - that property is what makes the
        // breakdown trustworthy rather than decorative.
        const sum = odds.modifiers.reduce((total, m) => total + m.delta, 0);
        expect(sum).toBeCloseTo(odds.finalChance, 10);
    });

    it('nothing changes for a cultivator standing exactly on the requirement', () => {
        expect(overflowBonus(16, progressRequiredForOrdinal(16)!)).toBe(0);
        expect(overflowBonus(16, progressRequiredForOrdinal(16)! - 1)).toBe(0);
    });

    it('half the bonus arrives at 1.5x, which is where the curve is calibrated', () => {
        const required = progressRequiredForOrdinal(16)!;
        expect(overflowBonus(16, required * (1 + OVERFLOW_HALF_AT)))
            .toBeCloseTo(MAX_OVERFLOW_BONUS / 2, 10);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('waiting is never worth enough', () => {
    it('is bounded however long anybody sits', () => {
        // Saturating, not capped: it approaches the ceiling and never reaches
        // it, so there is no figure at which a player has "finished waiting".
        const required = progressRequiredForOrdinal(16)!;
        expect(overflowBonus(16, required * 1e9)).toBeLessThan(MAX_OVERFLOW_BONUS);
        expect(overflowBonus(16, required * 1e9)).toBeGreaterThan(MAX_OVERFLOW_BONUS * 0.99);
    });

    it('cannot make ANY realm boundary safe, at any amount of waiting', () => {
        // The property that matters most. A wall a player can grind down to a
        // formality is not a wall, and the rungs that kill have to go on
        // killing. Measured at a million times the requirement.
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            if (!isRealmBoundary(ordinal)) continue;
            if (progressRequiredForOrdinal(ordinal) === null) continue;
            const infinite = oddsAt(ordinal, 1e6);
            expect(infinite, `boundary ${ordinal}`).toBeLessThan(MAX_BOUNDARY_CHANCE);
            // And not merely under the clamp - comfortably under it. If this
            // ever starts passing only because of the clamp, the term has grown
            // and the clamp is doing work it was not sized for.
            expect(infinite, `boundary ${ordinal}`).toBeLessThan(0.6);
        }
    });

    it('the clamp is still the thing that holds the top, not this term', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            if (progressRequiredForOrdinal(ordinal) === null) continue;
            expect(oddsAt(ordinal, 1e6), `rung ${ordinal}`)
                .toBeLessThanOrEqual(maxChanceFor(ordinal));
        }
    });

    it('never pays comprehension twice - it reads accumulated progress only', () => {
        // Understanding already stands in for accumulation at a bottleneck via
        // `bottleneckSubstitution` and already has its own line in the ledger.
        // Letting substituted progress buy overflow as well would book the same
        // comprehension in two places.
        const required = progressRequiredForOrdinal(16)!;
        const short = computeBreakthroughOdds(
            { ...makeCultivator(), realmOrdinal: 16, cultivationProgress: required * 0.5 },
            { ambient: 'normal', pill: null }
        );
        expect(short.modifiers.find(m => m.source === 'accumulated_overflow')).toBeUndefined();
    });

    it('an unknown progress reads as no overflow, never as a penalty', () => {
        // Like `age`. Plenty of callers legitimately do not carry it - NPC
        // stubs, the reachability sweep - and they must not be silently taxed.
        expect(overflowBonus(16, undefined)).toBe(0);
        expect(overflowBonus(16, NaN)).toBe(0);
        const stub = computeBreakthroughOdds(
            { ...makeCultivator(), realmOrdinal: 16 },
            { ambient: 'normal', pill: null }
        );
        expect(stub.modifiers.find(m => m.source === 'accumulated_overflow')).toBeUndefined();
    });

    it('is inert above the Lid, where the requirement is not this currency', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            if (progressRequiredForOrdinal(ordinal) !== null) continue;
            expect(overflowBonus(ordinal, 1e9), `rung ${ordinal}`).toBe(0);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the dilemma is real, and it is the CLOCK that makes it', () => {
    it('the benefit of waiting is roughly flat with age, and the cost is not', () => {
        // Worth stating precisely, because it would be easy to claim an
        // asymmetry in the bonus that is not there. `lifespanPressure`
        // saturates at MAX_LIFESPAN_PRESSURE, so an old cultivator gains about
        // as much CHANCE from a decade as a young one does.
        //
        // The asymmetry is entirely in what the decade COSTS. A 50-year-old
        // spends years they have; somebody near the end of the rung's granted
        // span spends years they do not, and `lifespanPressure` is already
        // subtracting for it before they start. That is the trade with no right
        // answer, and it lives in the clock rather than in this term.
        const youngGain = oddsAt(16, 3, 40) - oddsAt(16, 1, 40);
        const oldGain = oddsAt(16, 3, 700) - oddsAt(16, 1, 700);
        expect(Math.abs(youngGain - oldGain)).toBeLessThan(0.05);

        // And the clock is genuinely pressing on the old one.
        expect(lifespanPressure(16, 700)).toBeLessThan(lifespanPressure(16, 40));
        expect(oddsAt(16, 1, 700)).toBeLessThan(oddsAt(16, 1, 40));
    });

    it('waiting does not rescue somebody the clock has already caught', () => {
        // Both options stay bad, which is what "two things the world will make
        // them regret" means. A cultivator deep into lifespan pressure who
        // waits is still worse off than a young one who struck immediately.
        expect(oddsAt(16, 4, 700)).toBeLessThan(oddsAt(16, 1, 40));
    });
});
