/** One refinement-odds authority for actual player and world hands. */
import type { TechniqueGrade } from '../../schema/cultivation.js';
import { whatThisCauldronAddsFor } from './what-you-refine-in.js';

/** Odds gained per realm ordinal above the recipe's requirement. */
export const REFINE_REALM_MARGIN_PER_ORDINAL = 0.015;
/** Ceiling on that margin. Standing above a formula stops helping eventually. */
export const REFINE_REALM_MARGIN_CAP = 0.2;
/** Odds gained per point of Insight above the 2-point pivot. */
export const REFINE_INSIGHT_PER_POINT = 0.03;
/** Ceiling on the contribution of supplementary herbs. */
export const REFINE_SUPPLEMENT_CAP = 0.15;

/** Mirrors the breakthrough clamp: never certain, never hopeless. */
export const MIN_REFINE_CHANCE = 0.02;
export const MAX_REFINE_CHANCE = 0.97;

/** The itemised odds. Exposed the same way breakthrough odds are: in full. */
export function refineChance(
    baseRate: number,
    ordinal: number,
    requiredOrdinal: number,
    insight: number,
    supplementBonus: number,
    /**
     * What they are actually refining IN, or null for the clay pot everybody
     * has. `recipes.ts` has named cauldron quality as an input to a refinement
     * since the file was written - *"the floor the engine starts from before
     * alchemy skill, CAULDRON QUALITY, spirit root and ambient qi are
     * applied"* - and until now there was no cauldron, so every alchemist in
     * the world worked out of the same nothing.
     */
    cauldron: TechniqueGrade | null = null
): { chance: number; modifiers: Array<{ source: string; delta: number }> } {
    const modifiers: Array<{ source: string; delta: number }> = [
        { source: 'recipe_base', delta: baseRate }
    ];

    const margin = Math.min(
        REFINE_REALM_MARGIN_CAP,
        Math.max(0, ordinal - requiredOrdinal) * REFINE_REALM_MARGIN_PER_ORDINAL
    );
    modifiers.push({ source: 'realm_margin', delta: margin });
    modifiers.push({ source: 'insight', delta: (insight - 2) * REFINE_INSIGHT_PER_POINT });
    // THE FURNACE, AND ONLY WHERE THE HAND CAN WORK IT. A great cauldron held
    // by somebody who cannot work its materials is a great cauldron full of
    // slag, so `whatThisCauldronAddsFor` returns nothing below the rung rather
    // than a bonus that could not have been earned. Nothing is subtracted for
    // the clay pot: it is the baseline every `baseSuccessRate` was written
    // against, and taxing it would silently reprice the whole table.
    if (cauldron !== null) {
        const fromTheFurnace = whatThisCauldronAddsFor(cauldron, ordinal);
        if (fromTheFurnace !== 0) {
            modifiers.push({ source: `cauldron:${cauldron}`, delta: fromTheFurnace });
        }
    }
    if (supplementBonus !== 0) {
        modifiers.push({ source: 'supplementary_herbs', delta: supplementBonus });
    }

    const raw = modifiers.reduce((sum, m) => sum + m.delta, 0);
    const clamped = Math.max(MIN_REFINE_CHANCE, Math.min(MAX_REFINE_CHANCE, raw));
    if (clamped !== raw) {
        modifiers.push({ source: clamped > raw ? 'clamp:floor' : 'clamp:ceiling', delta: clamped - raw });
    }
    return { chance: clamped, modifiers };
}
