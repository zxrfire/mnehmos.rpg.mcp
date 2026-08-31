/**
 * Alchemy recipes.
 *
 * One recipe per pill in `pills.ts`, keyed to ingredient ids in `herbs.ts`.
 * Nothing here decides whether a refinement succeeds — `baseSuccessRate` is the
 * floor the engine starts from before alchemy skill, cauldron quality, spirit
 * root and ambient qi are applied.
 *
 * INVARIANTS THIS FILE COMMITS TO
 * -------------------------------
 * 1. `producesPillId` always resolves to a real pill.
 * 2. Every ingredient id always resolves to a real herb.
 * 3. Success rate falls as pill grade rises, in disjoint bands: a chaos-grade
 *    refinement is never as likely to work as an immortal-grade one, and a
 *    mortal-grade one is never as risky. The bands are the whole difficulty
 *    curve of alchemy in one table.
 * 4. `requiredOrdinal` is at least the pill grade's band floor, and at least
 *    the harvest ordinal of every ingredient — an alchemist who can refine the
 *    pill can, in principle, reach everything it needs.
 * 5. The combined market value of the ingredients is strictly less than the
 *    pill's market value. Refinement adds value; if it did not, no alchemist
 *    would exist and the ingredient market would be the whole economy.
 */

import type { Recipe, TechniqueGrade } from '../../schema/cultivation.js';
import type { Band } from './techniques.js';

/**
 * Base success-rate window per produced-pill grade. Disjoint and descending.
 * A mortal pill fails roughly one time in eight; a chaos pill succeeds roughly
 * one time in ten, which is why so few of them exist.
 */
export const RECIPE_SUCCESS_BANDS: Record<TechniqueGrade, Band> = {
    mortal: { min: 0.75, max: 0.9 },
    earth: { min: 0.55, max: 0.7 },
    heaven: { min: 0.35, max: 0.5 },
    immortal: { min: 0.18, max: 0.3 },
    chaos: { min: 0.05, max: 0.15 }
} as const;

export const RECIPES: readonly Recipe[] = [
    // ═══════════════════════════════════════════════════════════════════
    // MORTAL — roadside reagents, a clay cauldron, and reasonable odds
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'recipe-minor-healing',
        name: 'Minor Healing Pill Formula',
        producesPillId: 'pill-minor-healing',
        ingredients: [
            { itemId: 'herb-blood-millet', quantity: 2 },
            { itemId: 'herb-qi-grass', quantity: 2 }
        ],
        baseSuccessRate: 0.9,
        requiredOrdinal: 0
    },
    {
        id: 'recipe-qi-gathering',
        name: 'Qi-Gathering Pill Formula',
        producesPillId: 'pill-qi-gathering',
        ingredients: [
            { itemId: 'herb-qi-grass', quantity: 3 },
            { itemId: 'herb-hollow-reed', quantity: 1 }
        ],
        baseSuccessRate: 0.9,
        requiredOrdinal: 0
    },
    {
        id: 'recipe-hunger-quelling',
        name: 'Hunger-Quelling Pill Formula',
        producesPillId: 'pill-hunger-quelling',
        ingredients: [
            { itemId: 'herb-cloudcap-mushroom', quantity: 1 }
        ],
        baseSuccessRate: 0.88,
        requiredOrdinal: 0
    },
    {
        id: 'recipe-blood-replenishing',
        name: 'Blood-Replenishing Pill Formula',
        producesPillId: 'pill-blood-replenishing',
        ingredients: [
            { itemId: 'herb-blood-millet', quantity: 3 },
            { itemId: 'herb-nine-node-calamus', quantity: 1 }
        ],
        baseSuccessRate: 0.86,
        requiredOrdinal: 1
    },
    {
        id: 'recipe-dust-clearing',
        name: 'Dust-Clearing Pill Formula',
        producesPillId: 'pill-dust-clearing',
        ingredients: [
            { itemId: 'herb-grave-lily', quantity: 1 },
            { itemId: 'herb-morning-dew-orchid', quantity: 1 },
            { itemId: 'herb-qi-grass', quantity: 2 }
        ],
        baseSuccessRate: 0.82,
        requiredOrdinal: 5
    },
    {
        id: 'recipe-clear-meridian',
        name: 'Clear Meridian Pill Formula',
        producesPillId: 'pill-clear-meridian',
        ingredients: [
            { itemId: 'herb-nine-node-calamus', quantity: 2 },
            { itemId: 'herb-iron-thread-moss', quantity: 2 },
            { itemId: 'herb-morning-dew-orchid', quantity: 1 }
        ],
        baseSuccessRate: 0.8,
        requiredOrdinal: 6
    },
    {
        id: 'recipe-spirit-dew',
        name: 'Spirit Dew Pill Formula',
        producesPillId: 'pill-spirit-dew',
        ingredients: [
            { itemId: 'herb-morning-dew-orchid', quantity: 3 },
            { itemId: 'herb-hollow-reed', quantity: 1 }
        ],
        baseSuccessRate: 0.78,
        requiredOrdinal: 8
    },
    {
        id: 'recipe-foundation-guiding',
        name: 'Foundation-Guiding Pill Formula',
        producesPillId: 'pill-foundation-guiding',
        ingredients: [
            { itemId: 'herb-thousand-day-root', quantity: 1 },
            { itemId: 'herb-clearwater-lotus-seed', quantity: 1 }
        ],
        baseSuccessRate: 0.76,
        requiredOrdinal: 10
    },
    {
        id: 'recipe-decade-lengthening',
        name: 'Decade-Lengthening Pill Formula',
        producesPillId: 'pill-decade-lengthening',
        ingredients: [
            { itemId: 'herb-thousand-day-root', quantity: 2 },
            { itemId: 'herb-bitter-frost-berry', quantity: 1 }
        ],
        baseSuccessRate: 0.75,
        requiredOrdinal: 11
    },

    // ═══════════════════════════════════════════════════════════════════
    // EARTH — a proper cauldron, a spirit fire, and a real chance of loss
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'recipe-azure-qi-return',
        name: 'Azure Qi-Return Pill Formula',
        producesPillId: 'pill-azure-qi-return',
        ingredients: [
            { itemId: 'herb-goldvein-ginseng', quantity: 1 },
            { itemId: 'herb-clearwater-lotus-seed', quantity: 1 },
            { itemId: 'herb-hollow-reed', quantity: 2 }
        ],
        baseSuccessRate: 0.7,
        requiredOrdinal: 13
    },
    {
        id: 'recipe-lean-month-fasting',
        name: 'Lean-Month Fasting Pill Formula',
        producesPillId: 'pill-lean-month-fasting',
        ingredients: [
            { itemId: 'herb-cloudcap-mushroom', quantity: 4 },
            { itemId: 'herb-goldvein-ginseng', quantity: 1 }
        ],
        baseSuccessRate: 0.68,
        requiredOrdinal: 13
    },
    {
        id: 'recipe-jade-mending',
        name: 'Jade Mending Pill Formula',
        producesPillId: 'pill-jade-mending',
        ingredients: [
            { itemId: 'herb-jade-bamboo-heart', quantity: 1 },
            { itemId: 'herb-blood-millet', quantity: 5 },
            { itemId: 'herb-morning-dew-orchid', quantity: 2 }
        ],
        baseSuccessRate: 0.68,
        requiredOrdinal: 14
    },
    {
        id: 'recipe-heart-settling',
        name: 'Heart-Settling Pill Formula',
        producesPillId: 'pill-heart-settling',
        ingredients: [
            { itemId: 'herb-moonwell-lotus', quantity: 1 },
            { itemId: 'herb-jade-bamboo-heart', quantity: 1 },
            { itemId: 'herb-bitter-frost-berry', quantity: 4 }
        ],
        baseSuccessRate: 0.62,
        requiredOrdinal: 15
    },
    {
        id: 'recipe-marrow-washing',
        name: 'Marrow-Washing Pill Formula',
        producesPillId: 'pill-marrow-washing',
        ingredients: [
            { itemId: 'herb-crimson-marrow-fungus', quantity: 3 },
            { itemId: 'herb-goldvein-ginseng', quantity: 1 },
            { itemId: 'herb-grave-lily', quantity: 2 }
        ],
        baseSuccessRate: 0.6,
        requiredOrdinal: 16
    },
    {
        id: 'recipe-golden-core-guiding',
        name: 'Golden Core Guiding Pill Formula',
        producesPillId: 'pill-golden-core-guiding',
        ingredients: [
            { itemId: 'herb-hundred-year-snow-ginseng', quantity: 1 },
            { itemId: 'herb-moonwell-lotus', quantity: 2 },
            { itemId: 'herb-qi-grass', quantity: 5 }
        ],
        baseSuccessRate: 0.57,
        requiredOrdinal: 18
    },
    {
        id: 'recipe-thousand-day-condensation',
        name: 'Thousand-Day Condensation Pill Formula',
        producesPillId: 'pill-thousand-day-condensation',
        ingredients: [
            { itemId: 'herb-spiritvein-quartz-bloom', quantity: 1 },
            { itemId: 'herb-thousand-day-root', quantity: 2 }
        ],
        baseSuccessRate: 0.58,
        requiredOrdinal: 19
    },
    {
        id: 'recipe-two-decade-longevity',
        name: 'Two-Decade Longevity Pill Formula',
        producesPillId: 'pill-two-decade-longevity',
        ingredients: [
            { itemId: 'herb-hundred-year-snow-ginseng', quantity: 2 },
            { itemId: 'herb-goldvein-ginseng', quantity: 2 }
        ],
        baseSuccessRate: 0.55,
        requiredOrdinal: 19
    },

    // ═══════════════════════════════════════════════════════════════════
    // HEAVEN — half the batches are lost, and the reagents are irreplaceable
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'recipe-boundless-source',
        name: 'Boundless Source Pill Formula',
        producesPillId: 'pill-boundless-source',
        ingredients: [
            { itemId: 'herb-purple-cloud-fruit', quantity: 2 },
            { itemId: 'herb-spiritvein-quartz-bloom', quantity: 1 }
        ],
        baseSuccessRate: 0.5,
        requiredOrdinal: 21
    },
    {
        id: 'recipe-nine-turn-restoration',
        name: 'Nine-Turn Restoration Pill Formula',
        producesPillId: 'pill-nine-turn-restoration',
        ingredients: [
            { itemId: 'herb-dragonwhisker-vine', quantity: 2 },
            { itemId: 'herb-crimson-marrow-fungus', quantity: 2 }
        ],
        baseSuccessRate: 0.48,
        requiredOrdinal: 21
    },
    {
        id: 'recipe-meridian-rebirth',
        name: 'Meridian Rebirth Pill Formula',
        producesPillId: 'pill-meridian-rebirth',
        ingredients: [
            { itemId: 'herb-nine-leaf-soul-grass', quantity: 3 },
            { itemId: 'herb-dragonwhisker-vine', quantity: 1 },
            { itemId: 'herb-crimson-marrow-fungus', quantity: 3 }
        ],
        baseSuccessRate: 0.42,
        requiredOrdinal: 24
    },
    {
        id: 'recipe-still-heart-nectar',
        name: 'Still-Heart Nectar Pill Formula',
        producesPillId: 'pill-still-heart-nectar',
        ingredients: [
            { itemId: 'herb-glacial-heart-flower', quantity: 1 },
            { itemId: 'herb-moonwell-lotus', quantity: 2 },
            { itemId: 'herb-bitter-frost-berry', quantity: 4 }
        ],
        baseSuccessRate: 0.44,
        requiredOrdinal: 25
    },
    {
        id: 'recipe-nascent-soul-guiding',
        name: 'Nascent Soul Guiding Pill Formula',
        producesPillId: 'pill-nascent-soul-guiding',
        ingredients: [
            { itemId: 'herb-nine-leaf-soul-grass', quantity: 4 },
            { itemId: 'herb-void-mist-fungus', quantity: 1 },
            { itemId: 'herb-goldvein-ginseng', quantity: 2 }
        ],
        baseSuccessRate: 0.38,
        requiredOrdinal: 26
    },
    {
        id: 'recipe-condensed-decade',
        name: 'Condensed Decade Pill Formula',
        producesPillId: 'pill-condensed-decade',
        ingredients: [
            { itemId: 'herb-millennium-blood-ganoderma', quantity: 1 },
            { itemId: 'herb-purple-cloud-fruit', quantity: 2 },
            { itemId: 'herb-spiritvein-quartz-bloom', quantity: 1 }
        ],
        baseSuccessRate: 0.4,
        requiredOrdinal: 27
    },
    {
        id: 'recipe-century-lotus',
        name: 'Century Lotus Pill Formula',
        producesPillId: 'pill-century-lotus',
        ingredients: [
            { itemId: 'herb-glacial-heart-flower', quantity: 2 },
            { itemId: 'herb-purple-cloud-fruit', quantity: 4 },
            { itemId: 'herb-frostvein-lichen', quantity: 2 }
        ],
        baseSuccessRate: 0.36,
        requiredOrdinal: 27
    },
    {
        // The hardest heaven-grade refinement in the catalog, deliberately.
        // The pill that ends the hunger problem should be the last thing an
        // alchemist of this tier learns to make, not the first.
        id: 'recipe-grain-abstinence',
        name: 'Grain Abstinence Pill Formula',
        producesPillId: 'pill-grain-abstinence',
        ingredients: [
            { itemId: 'herb-millennium-blood-ganoderma', quantity: 1 },
            { itemId: 'herb-purple-cloud-fruit', quantity: 5 },
            { itemId: 'herb-nine-leaf-soul-grass', quantity: 1 },
            { itemId: 'herb-clearwater-lotus-seed', quantity: 10 }
        ],
        baseSuccessRate: 0.35,
        requiredOrdinal: 28
    },

    // ═══════════════════════════════════════════════════════════════════
    // IMMORTAL — four failures for every success, at reagent prices that
    // fund a sect for a decade
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'recipe-void-source-return',
        name: 'Void Source Return Pill Formula',
        producesPillId: 'pill-void-source-return',
        ingredients: [
            { itemId: 'herb-jade-pool-spring-lotus', quantity: 2 },
            { itemId: 'herb-void-mist-fungus', quantity: 1 }
        ],
        baseSuccessRate: 0.3,
        requiredOrdinal: 29
    },
    {
        id: 'recipe-undying-flesh',
        name: 'Undying Flesh Pill Formula',
        producesPillId: 'pill-undying-flesh',
        ingredients: [
            { itemId: 'herb-jade-pool-spring-lotus', quantity: 2 },
            { itemId: 'herb-millennium-blood-ganoderma', quantity: 1 },
            { itemId: 'herb-phoenix-marrow-blossom', quantity: 1 }
        ],
        baseSuccessRate: 0.28,
        requiredOrdinal: 29
    },
    {
        id: 'recipe-clear-mind-of-the-hollow-sky',
        name: 'Clear Mind of the Hollow Sky Pill Formula',
        producesPillId: 'pill-clear-mind-of-the-hollow-sky',
        ingredients: [
            { itemId: 'herb-soulreturn-dew', quantity: 2 },
            { itemId: 'herb-glacial-heart-flower', quantity: 2 }
        ],
        baseSuccessRate: 0.26,
        requiredOrdinal: 31
    },
    {
        id: 'recipe-severed-meridian-restoration',
        name: 'Severed Meridian Restoration Pill Formula',
        producesPillId: 'pill-severed-meridian-restoration',
        ingredients: [
            { itemId: 'herb-soulreturn-dew', quantity: 2 },
            { itemId: 'herb-nine-leaf-soul-grass', quantity: 5 },
            { itemId: 'herb-millennium-blood-ganoderma', quantity: 1 }
        ],
        baseSuccessRate: 0.24,
        requiredOrdinal: 31
    },
    {
        id: 'recipe-condensed-century',
        name: 'Condensed Century Pill Formula',
        producesPillId: 'pill-condensed-century',
        ingredients: [
            { itemId: 'herb-primordial-earth-marrow', quantity: 3 },
            { itemId: 'herb-nine-transformation-fungus', quantity: 1 },
            { itemId: 'herb-purple-cloud-fruit', quantity: 5 }
        ],
        baseSuccessRate: 0.22,
        requiredOrdinal: 32
    },
    {
        id: 'recipe-void-refinement-guiding',
        name: 'Void Refinement Guiding Pill Formula',
        producesPillId: 'pill-void-refinement-guiding',
        ingredients: [
            { itemId: 'herb-star-fallen-iron-blossom', quantity: 1 },
            { itemId: 'herb-primordial-earth-marrow', quantity: 2 },
            { itemId: 'herb-jade-pool-spring-lotus', quantity: 1 },
            { itemId: 'herb-purple-cloud-fruit', quantity: 5 }
        ],
        baseSuccessRate: 0.2,
        requiredOrdinal: 33
    },
    {
        id: 'recipe-thousand-year-cypress',
        name: 'Thousand-Year Cypress Pill Formula',
        producesPillId: 'pill-thousand-year-cypress',
        ingredients: [
            { itemId: 'herb-immortal-cypress-heartwood', quantity: 2 },
            { itemId: 'herb-jade-pool-spring-lotus', quantity: 1 }
        ],
        baseSuccessRate: 0.19,
        requiredOrdinal: 34
    },
    {
        id: 'recipe-perpetual-grain-abstinence',
        name: 'Perpetual Grain Abstinence Pill Formula',
        producesPillId: 'pill-perpetual-grain-abstinence',
        ingredients: [
            { itemId: 'herb-jade-pool-spring-lotus', quantity: 8 },
            { itemId: 'herb-nine-transformation-fungus', quantity: 1 },
            { itemId: 'herb-millennium-blood-ganoderma', quantity: 3 },
            { itemId: 'herb-purple-cloud-fruit', quantity: 10 }
        ],
        baseSuccessRate: 0.18,
        requiredOrdinal: 35
    },

    // ═══════════════════════════════════════════════════════════════════
    // CHAOS — nine attempts in ten destroy reagents nobody can replace
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'recipe-kalpa-surviving',
        name: 'Kalpa-Surviving Pill Formula',
        producesPillId: 'pill-kalpa-surviving',
        ingredients: [
            { itemId: 'herb-kalpa-surviving-branch', quantity: 2 },
            { itemId: 'herb-soulreturn-dew', quantity: 2 }
        ],
        baseSuccessRate: 0.14,
        requiredOrdinal: 37
    },
    {
        id: 'recipe-primordial-qi-source',
        name: 'Primordial Qi Source Pill Formula',
        producesPillId: 'pill-primordial-qi-source',
        ingredients: [
            { itemId: 'herb-origin-qi-crystal-lotus', quantity: 1 },
            { itemId: 'herb-primordial-earth-marrow', quantity: 2 },
            { itemId: 'herb-jade-pool-spring-lotus', quantity: 1 }
        ],
        baseSuccessRate: 0.15,
        requiredOrdinal: 39
    },
    {
        id: 'recipe-heaven-mending',
        name: 'Heaven-Mending Pill Formula',
        producesPillId: 'pill-heaven-mending',
        ingredients: [
            { itemId: 'herb-origin-qi-crystal-lotus', quantity: 2 },
            { itemId: 'herb-kalpa-surviving-branch', quantity: 1 },
            { itemId: 'herb-immortal-cypress-heartwood', quantity: 2 }
        ],
        baseSuccessRate: 0.1,
        requiredOrdinal: 40
    },
    {
        id: 'recipe-soul-returning-clarity',
        name: 'Soul-Returning Clarity Pill Formula',
        producesPillId: 'pill-soul-returning-clarity',
        ingredients: [
            { itemId: 'herb-heavenly-tribulation-ash-fruit', quantity: 1 },
            { itemId: 'herb-soulreturn-dew', quantity: 5 },
            { itemId: 'herb-star-fallen-iron-blossom', quantity: 2 }
        ],
        baseSuccessRate: 0.11,
        requiredOrdinal: 41
    },
    {
        id: 'recipe-millennium-condensation',
        name: 'Millennium Condensation Pill Formula',
        producesPillId: 'pill-millennium-condensation',
        ingredients: [
            { itemId: 'herb-origin-qi-crystal-lotus', quantity: 4 },
            { itemId: 'herb-primordial-earth-marrow', quantity: 5 },
            { itemId: 'herb-nine-transformation-fungus', quantity: 2 }
        ],
        baseSuccessRate: 0.08,
        requiredOrdinal: 41
    },
    {
        id: 'recipe-tribulation-guiding',
        name: 'Tribulation Guiding Pill Formula',
        producesPillId: 'pill-tribulation-guiding',
        ingredients: [
            { itemId: 'herb-heavenly-tribulation-ash-fruit', quantity: 2 },
            { itemId: 'herb-kalpa-surviving-branch', quantity: 2 },
            { itemId: 'herb-star-fallen-iron-blossom', quantity: 2 }
        ],
        baseSuccessRate: 0.06,
        requiredOrdinal: 42
    },
    {
        id: 'recipe-immortal-longevity',
        name: 'Immortal Longevity Pill Formula',
        producesPillId: 'pill-immortal-longevity',
        ingredients: [
            { itemId: 'herb-chaos-seed', quantity: 1 },
            { itemId: 'herb-heavenly-tribulation-ash-fruit', quantity: 1 },
            { itemId: 'herb-immortal-cypress-heartwood', quantity: 4 }
        ],
        baseSuccessRate: 0.05,
        requiredOrdinal: 43
    }
] as const;

// ─────────────────────────────────────────────────────────────────────────
// INDICES + LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const RECIPE_BY_ID: ReadonlyMap<string, Recipe> = new Map(RECIPES.map(r => [r.id, r]));

const RECIPES_BY_PILL: ReadonlyMap<string, readonly Recipe[]> = (() => {
    const map = new Map<string, Recipe[]>();
    for (const r of RECIPES) {
        const bucket = map.get(r.producesPillId);
        if (bucket) bucket.push(r);
        else map.set(r.producesPillId, [r]);
    }
    return map;
})();

/** Reverse index: which recipes consume a given herb. Drives "what is this for". */
const RECIPES_BY_INGREDIENT: ReadonlyMap<string, readonly Recipe[]> = (() => {
    const map = new Map<string, Recipe[]>();
    for (const r of RECIPES) {
        for (const ing of r.ingredients) {
            const bucket = map.get(ing.itemId);
            if (bucket) bucket.push(r);
            else map.set(ing.itemId, [r]);
        }
    }
    return map;
})();

export function getRecipe(id: string): Recipe | undefined {
    return RECIPE_BY_ID.get(id);
}

export function requireRecipe(id: string): Recipe {
    const r = RECIPE_BY_ID.get(id);
    if (!r) throw new Error(`Unknown recipe: ${id}`);
    return r;
}

export function getRecipesForPill(pillId: string): readonly Recipe[] {
    return RECIPES_BY_PILL.get(pillId) ?? [];
}

export function getRecipesUsingHerb(herbId: string): readonly Recipe[] {
    return RECIPES_BY_INGREDIENT.get(herbId) ?? [];
}

/** Every recipe an alchemist at this ordinal is permitted to attempt. */
export function findRecipesForOrdinal(ordinal: number): Recipe[] {
    const cap = Math.max(0, Math.min(44, Math.floor(ordinal)));
    return RECIPES.filter(r => r.requiredOrdinal <= cap);
}
