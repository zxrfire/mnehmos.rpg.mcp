/**
 * Cultivation content catalog — barrel export and cross-catalog lookups.
 *
 * Structured after `src/content/open5e-catalog.ts`: one typed entry point, all
 * lookups O(1) against prebuilt Maps, and explicit provenance so a caller can
 * always say where a piece of content came from. Unlike the Open5e catalog,
 * this content is first-party and compiled in rather than loaded from a JSON
 * pack, so there is no fetch, no cache and no schema-version negotiation — the
 * TypeScript types are the contract and the tests are the validator.
 *
 * Every catalog in this directory is inert data. The engine owns all decisions;
 * this module only answers questions about what exists.
 */

import type { Element, Technique, TechniqueCategory, TechniqueGrade, Pill, PillEffect, Recipe } from '../../schema/cultivation.js';
import { getSpiritRoot, conflictsWithRoot, type SpiritRootKey } from '../../engine/cultivation/spirit-roots.js';

import { TECHNIQUES, findTechniquesForOrdinal, getTechnique, type TechniqueEntry, type TechniqueQuery } from './techniques.js';
import { PILLS, getPill } from './pills.js';
import { RECIPES, getRecipesForPill, type RecipeEntry } from './recipes.js';
import { HERBS, getHerb } from './herbs.js';
import { SECTS } from './sects.js';
import { ENCOUNTERS } from './encounters.js';

// ─────────────────────────────────────────────────────────────────────────
// RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────

export {
    TECHNIQUES,
    GRADE_ORDINAL_BANDS,
    GRADE_QI_BANDS,
    GRADE_ORDER,
    gradeRank,
    gradeForOrdinal,
    getTechnique,
    requireTechnique,
    getTechniquesByCategory,
    getTechniquesByGrade,
    getTechniquesByElement,
    getTechniquesByProvenance,
    getRecoveredTechniques,
    findTechniquesForOrdinal,
    findBestTechniquesForOrdinal,
    RUIN_ONLY_TECHNIQUE_IDS,
    GRAVE_ONLY_TECHNIQUE_IDS,
    type Band,
    type TechniqueEntry,
    type TechniqueProvenance,
    type TechniqueQuery
} from './techniques.js';

export {
    PILLS,
    PILL_VALUE_BANDS,
    PILL_TOXICITY_CEILING,
    POTENCY_UNITS,
    MINOR_HEALING_PILL_ID,
    GRAIN_ABSTINENCE_PILL_ID,
    PERPETUAL_GRAIN_ABSTINENCE_DAYS,
    getPill,
    requirePill,
    getPillsByEffect,
    getPillsByGrade,
    getStartingPill,
    findCheapestPillFor
} from './pills.js';

export {
    RECIPES,
    RECIPE_SUCCESS_BANDS,
    getRecipe,
    requireRecipe,
    getRecipesForPill,
    getRecipesUsingHerb,
    findRecipesForOrdinal,
    getRecoveredRecipes,
    RECOVERED_RECIPE_IDS,
    type RecipeEntry,
    type RecipeProvenance
} from './recipes.js';

export {
    HERBS,
    HERB_VALUE_BANDS,
    HERB_RARITY_CEILING,
    HerbSchema,
    HerbBiomeSchema,
    getHerb,
    requireHerb,
    getHerbsByBiome,
    getHerbsByGrade,
    findHerbsForOrdinal,
    rollHerb,
    type Herb,
    type HerbBiome
} from './herbs.js';

export {
    SECTS,
    SECT_ADMISSION,
    getSect,
    requireSect,
    getSectsByAlignment,
    getSectsTeaching,
    getSectAdmission,
    findSectsForOrdinal,
    stipendForRank,
    formationIntegrity,
    type SectEntry,
    type SectAdmission,
    type SectCompound
} from './sects.js';

export {
    ENCOUNTERS,
    EncounterEntrySchema,
    EncounterKindSchema,
    getEncounter,
    requireEncounter,
    getEncountersByKind,
    getEncountersForOrdinal,
    rollEncounter,
    fillSummary,
    missingTokens,
    encounterSimEventKinds,
    ruinWeightShare,
    type EncounterEntry,
    type EncounterKind,
    type EncounterQuery
} from './encounters.js';

// ─────────────────────────────────────────────────────────────────────────
// PROVENANCE
// First-party content. Recorded in the same spirit as the Open5e catalog's
// provenance block so any tool output can state its source and licence.
// ─────────────────────────────────────────────────────────────────────────

export const CULTIVATION_CONTENT_PROVENANCE = {
    provider: 'rpg-mcp',
    gamesystem: 'xianxia-cultivation',
    packVersion: '1.0.0',
    /** Written for this engine. No external SRD or third-party text is included. */
    license: {
        key: 'first-party',
        name: 'First-party original content',
        attribution: 'Original cultivation content authored for the rpg-mcp engine.'
    }
} as const;

// ─────────────────────────────────────────────────────────────────────────
// CROSS-CATALOG LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

export interface CultivationCatalogCounts {
    techniques: number;
    pills: number;
    recipes: number;
    herbs: number;
    sects: number;
    encounters: number;
}

/** Catalog sizes, for tool responses and for the content smoke test. */
export function getCultivationCatalogCounts(): CultivationCatalogCounts {
    return {
        techniques: TECHNIQUES.length,
        pills: PILLS.length,
        recipes: RECIPES.length,
        herbs: HERBS.length,
        sects: SECTS.length,
        encounters: ENCOUNTERS.length
    };
}

/**
 * Techniques a specific spirit root may cultivate at this ordinal without a
 * wuxing conflict. Elementless arts always qualify, which is exactly why the
 * catalog carries so many of them: a muddled or dual root would otherwise have
 * almost nothing safe to learn.
 *
 * `includeConflicting` returns the dangerous ones too, flagged, because
 * choosing to cultivate a conflicting art is a legitimate — and frequently
 * fatal — player decision, not something content should hide.
 */
export interface RootTechniqueMatch {
    technique: TechniqueEntry;
    /** True when the art's element matches one the root can channel. */
    matched: boolean;
    /** True when cultivating it risks qi deviation for this root. */
    conflicts: boolean;
}

export function findTechniquesForRoot(
    rootKey: SpiritRootKey,
    ordinal: number,
    opts: TechniqueQuery & { includeConflicting?: boolean } = {}
): RootTechniqueMatch[] {
    const root = getSpiritRoot(rootKey);
    const out: RootTechniqueMatch[] = [];
    for (const technique of findTechniquesForOrdinal(ordinal, opts)) {
        if (technique.element === null) {
            out.push({ technique, matched: false, conflicts: false });
            continue;
        }
        const element = technique.element as Element;
        const matched = root.elements.includes(element);
        const conflicts = conflictsWithRoot(root, element);
        // An unmatched, non-conflicting element is still unusable in practice:
        // a fire root does not have water qi to spend. Only matched elements
        // and elementless arts are offered unless the caller asks for more.
        if (!matched && !opts.includeConflicting) continue;
        if (conflicts && !opts.includeConflicting) continue;
        out.push({ technique, matched, conflicts });
    }
    return out;
}

/**
 * Which sects, if any, will teach a given technique. Combined with
 * `SECT_ADMISSION` this answers the question a player actually asks: "where do
 * I get this, and what will they want from me".
 */
export function whereToLearn(techniqueId: string): { sectId: string; sectName: string; admissionOrdinal: number }[] {
    const technique = getTechnique(techniqueId);
    if (!technique) return [];
    const out: { sectId: string; sectName: string; admissionOrdinal: number }[] = [];
    for (const sect of SECTS) {
        if (sect.teaches.includes(techniqueId)) {
            out.push({ sectId: sect.id, sectName: sect.name, admissionOrdinal: sect.admissionOrdinal });
        }
    }
    return out;
}

/** Full ingredient bill for a pill, resolved through its recipes. */
export interface PillIngredientLine {
    herbId: string;
    herbName: string;
    quantity: number;
    unitValue: number;
    lineValue: number;
}

export function getPillIngredientBill(pillId: string): {
    pill: Pill;
    recipe: RecipeEntry;
    lines: PillIngredientLine[];
    ingredientValue: number;
    margin: number;
} | undefined {
    const pill = getPill(pillId);
    if (!pill) return undefined;
    const recipe = getRecipesForPill(pillId)[0];
    if (!recipe) return undefined;

    const lines: PillIngredientLine[] = [];
    let ingredientValue = 0;
    for (const ing of recipe.ingredients) {
        const herb = getHerb(ing.itemId);
        if (!herb) continue;
        const lineValue = herb.value * ing.quantity;
        ingredientValue += lineValue;
        lines.push({
            herbId: herb.id,
            herbName: herb.name,
            quantity: ing.quantity,
            unitValue: herb.value,
            lineValue
        });
    }
    return { pill, recipe, lines, ingredientValue, margin: pill.value - ingredientValue };
}

/**
 * Everything relevant to a cultivator standing at `ordinal` with `rootKey`:
 * what they can learn, what they can join, what medicine exists for them, and
 * what can happen to them. Intended as the single call a `content_lookup` MCP
 * action would make.
 */
export interface CultivationOptions {
    ordinal: number;
    spiritRoot: SpiritRootKey;
    techniques: RootTechniqueMatch[];
    sects: { id: string; name: string; alignment: string; admissionOrdinal: number }[];
    pills: Pill[];
    recipes: RecipeEntry[];
    encounterCount: number;
    /** What exists at this ordinal but can only be dug up, never taught. */
    recoverableTechniques: number;
}

export function getCultivationOptions(
    ordinal: number,
    spiritRoot: SpiritRootKey,
    opts: { category?: TechniqueCategory; grade?: TechniqueGrade; excludeForbidden?: boolean } = {}
): CultivationOptions {
    const clamped = Math.max(0, Math.min(44, Math.floor(ordinal)));
    return {
        ordinal: clamped,
        spiritRoot,
        techniques: findTechniquesForRoot(spiritRoot, clamped, opts),
        sects: SECTS
            .filter(s => s.admissionOrdinal <= clamped)
            .map(s => ({ id: s.id, name: s.name, alignment: s.alignment, admissionOrdinal: s.admissionOrdinal })),
        pills: PILLS.filter(p => affordableGradeForOrdinal(clamped).includes(p.grade)),
        recipes: RECIPES.filter(r => r.requiredOrdinal <= clamped),
        encounterCount: ENCOUNTERS.filter(e => e.minOrdinal <= clamped && e.maxOrdinal >= clamped).length,
        recoverableTechniques: getRuinLootTable(clamped).techniques.length
    };
}

/**
 * What a sealed site at this ordinal can plausibly be holding: the arts and
 * methods the living world cannot supply at all. This is the payoff half of
 * the exploration loop — the reason a cultivator without talent digs instead
 * of cultivating, since ambient ash in this age will not close the gap to a
 * single-root prodigy and a recovered chaos-grade manual might.
 */
export function getRuinLootTable(ordinal: number): {
    techniques: TechniqueEntry[];
    recipes: RecipeEntry[];
} {
    const clamped = Math.max(0, Math.min(44, Math.floor(ordinal)));
    return {
        techniques: TECHNIQUES.filter(t => t.provenance !== 'taught' && t.requiredOrdinal <= clamped),
        recipes: RECIPES.filter(r => r.provenance === 'recovered' && r.requiredOrdinal <= clamped)
    };
}

/**
 * Pill grades a cultivator at this ordinal can take without the medicine being
 * more dangerous than the injury. One grade above the current band is included
 * deliberately: overdosing upward is a real option, and a costly one.
 */
function affordableGradeForOrdinal(ordinal: number): TechniqueGrade[] {
    if (ordinal <= 12) return ['mortal', 'earth'];
    if (ordinal <= 20) return ['mortal', 'earth', 'heaven'];
    if (ordinal <= 28) return ['mortal', 'earth', 'heaven', 'immortal'];
    return ['mortal', 'earth', 'heaven', 'immortal', 'chaos'];
}

/** Pills that address a given problem, cheapest first. */
export function findPillsForProblem(effect: PillEffect): Pill[] {
    return PILLS.filter(p => p.effect === effect).sort((a, b) => a.value - b.value);
}

/** Sect ids that would take this cultivator, split by alignment. */
export function findAdmissibleSects(ordinal: number): { righteous: string[]; neutral: string[]; demonic: string[] } {
    const clamped = Math.max(0, Math.min(44, Math.floor(ordinal)));
    const out = { righteous: [] as string[], neutral: [] as string[], demonic: [] as string[] };
    for (const sect of SECTS) {
        // Powers that take no applicants are facts about the world, not doors.
        if (!sect.recruits) continue;
        if (sect.admissionOrdinal > clamped) continue;
        out[sect.alignment].push(sect.id);
    }
    return out;
}

/** Convenience re-export shapes used by the helpers above. */
export type { Technique, Pill, Recipe, PillEffect, TechniqueCategory, TechniqueGrade, Element };
