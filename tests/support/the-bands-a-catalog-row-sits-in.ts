/**
 * The windows a catalog row is authored inside. Nothing in the game reads
 * these: they are what the catalog tests hold every herb, pill and formula to,
 * so they live beside the tests.
 */

import type { PillEffect, TechniqueGrade } from '../../src/schema/cultivation.js';
import type { Band } from '../../src/data/cultivation/techniques.js';

/**
 * Value window per herb grade. Ascending and disjoint up to the peers, which
 * overlap: chaos and immortal are peers in power, so a chaos herb opens where
 * an immortal herb opens. The higher ceiling is scarcity, not rank.
 */
export const HERB_VALUE_BANDS: Record<TechniqueGrade, Band> = {
    mortal: { min: 1, max: 49 },
    earth: { min: 50, max: 499 },
    heaven: { min: 500, max: 4_999 },
    immortal: { min: 5_000, max: 49_999 },
    chaos: { min: 5_000, max: 500_000 }
} as const;

/**
 * Commonest a herb of each grade may be. Strictly falling, and not levelled
 * across the peers: rarity is a population statement, and there is less
 * chaos-grade material in the world than immortal-grade.
 */
export const HERB_RARITY_CEILING: Record<TechniqueGrade, number> = {
    mortal: 400,
    earth: 90,
    heaven: 25,
    immortal: 6,
    chaos: 1
} as const;

/** Most toxic a pill of each grade may be. Rising, and level across the peers. */
export const PILL_TOXICITY_CEILING: Record<TechniqueGrade, number> = {
    mortal: 1.5,
    earth: 4,
    heaven: 9,
    immortal: 40,
    chaos: 40
} as const;

/**
 * Base success window per formula grade. Chaos and immortal share one window:
 * the same cauldron at the same rung makes both, and what the pill does is
 * settled at use, not at refinement.
 */
export const RECIPE_SUCCESS_BANDS: Record<TechniqueGrade, Band> = {
    mortal: { min: 0.75, max: 0.9 },
    earth: { min: 0.55, max: 0.7 },
    heaven: { min: 0.35, max: 0.5 },
    immortal: { min: 0.05, max: 0.3 },
    chaos: { min: 0.05, max: 0.3 }
} as const;

/**
 * The pill effects that buy ADVANCEMENT rather than survival. `grain_abstinence`
 * is one: what it buys is the time that would have gone on feeding yourself,
 * and that time goes into cultivating.
 */
export const ADVANCEMENT_EFFECTS: ReadonlySet<PillEffect> = new Set<PillEffect>([
    'boost_breakthrough',
    'advance_progress',
    'extend_lifespan',
    'grain_abstinence'
]);

export function isAdvancement(effect: PillEffect): boolean {
    return ADVANCEMENT_EFFECTS.has(effect);
}
