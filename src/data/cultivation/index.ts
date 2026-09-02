/**
 * Cultivation content catalog - barrel export and cross-catalog lookups.
 *
 * Structured after `src/content/open5e-catalog.ts`: one typed entry point, all
 * lookups O(1) against prebuilt Maps, and explicit provenance so a caller can
 * always say where a piece of content came from. Unlike the Open5e catalog,
 * this content is first-party and compiled in rather than loaded from a JSON
 * pack, so there is no fetch, no cache and no schema-version negotiation - the
 * TypeScript types are the contract and the tests are the validator.
 *
 * Every catalog in this directory is inert data. The engine owns all decisions;
 * this module only answers questions about what exists.
 */

import type { Element, Technique, TechniqueCategory, TechniqueGrade, Pill, PillEffect, Recipe } from '../../schema/cultivation.js';
import { getSpiritRoot, conflictsWithRoot, type SpiritRootKey } from '../../engine/cultivation/spirit-roots.js';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';

import { TECHNIQUES, findTechniquesForOrdinal, getTechnique, type TechniqueEntry, type TechniqueQuery } from './techniques.js';
import { PILLS, getPill } from './pills.js';
import { RECIPES, getRecipesForPill, type RecipeEntry } from './recipes.js';
import { HERBS, getHerb } from './herbs.js';
import { BEASTS, BEAST_MATERIALS, BEAST_TIDES } from './beasts.js';
import { SECTS, DAO_HOUSES, DESTROYED_DAO_HOUSES, getSect } from './sects.js';
import { ENCOUNTERS } from './encounters.js';
import { REGIONS } from './regions.js';
import { TRADITIONS } from './traditions.js';
import { OCCUPATIONS, PRICES, SETTLEMENTS } from './mortal-world.js';
import { FACTION_CHARACTER } from './faction-character.js';
import { APEX_INSTITUTIONS, COURTS, FACTION_PARENTAGE, GUEST_ELDERS } from './hierarchy.js';
import { IMMORTAL_ITEMS, IMMORTAL_HOLDINGS } from './immortal-items.js';
import { WANDERERS } from './wanderers.js';
import { FALSE_IMMORTALS, MADNESS_STAGES } from './false-immortals.js';
import { MEMBERS } from './members.js';
import { IMMORTAL_CHANNELS } from './crossings.js';
import { AGES, DEAD_CIVILISATIONS, LID_THEORIES, ORIGIN_ACCOUNTS, CALENDARS } from './history.js';
import { CONTINGENCIES } from './contingencies.js';
import { HELD_INSTRUMENTS, UNOWNED_ANCESTORS } from './sealed-ancestors.js';
import { INHERITANCE_TRIALS, GRAVES } from './inheritance-trials.js';
import {
    HOUSE_ARTISANS,
    SEA_LANES,
    SEA_CARGO,
    SEA_TRADERS
} from './what-each-house-makes-and-what-crosses-the-water.js';

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
    getFragmentTechniques,
    FRAGMENT_TECHNIQUE_ORIGINS,
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
    BEASTS,
    BEAST_MATERIALS,
    BEAST_TIDES,
    BEAST_CHANGE_ORDINAL,
    BEAST_CORE_ORDINAL,
    WHAT_GIVES_A_CHANGED_BEAST_AWAY,
    THE_BEAST_ROAD,
    ESTIMATING_A_BEAST,
    THE_CONTRACT,
    CONTRACT_ENGINE_REQUIREMENTS,
    BeastSchema,
    BeastNatureSchema,
    BeastPersistenceSchema,
    BeastMaterialSchema,
    BeastTideSchema,
    MaterialTakingSchema,
    VeinRelationSchema,
    getBeast,
    requireBeast,
    getBeastsByBiome,
    getBeastsByNature,
    getBeastMaterial,
    requireBeastMaterial,
    materialsOf,
    coreOf,
    getBeastTide,
    tidesInRegion,
    beastsInTide,
    describeBeastRealm,
    findBeastsForOrdinal,
    findThreatsAboveOrdinal,
    veinContenders,
    sealedOnlyBeasts,
    negotiableBeasts,
    rollBeast,
    type Beast,
    type BeastNature,
    type BeastPersistence,
    type BeastMaterial,
    type BeastTide,
    type MaterialTaking,
    type VeinRelation
} from './beasts.js';

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
    DAO_HOUSES,
    DESTROYED_DAO_HOUSES,
    DAO_HOUSE_DISPUTES,
    getDaoHouse,
    requireDaoHouse,
    getDaoHouseByPrinciple,
    getDestroyedDaoHouse,
    getCounterHouse,
    getDisputesFor,
    getSuccessionAccounts,
    isDaoHouse,
    SECT_ANCESTRY,
    getSectAncestry,
    getDormantAncestors,
    getSectsClaimingLivingAncestor,
    getPartingGift,
    getPreeminentSect,
    auditAncestralClaim,
    type SectEntry,
    type SectAdmission,
    type SectCompound,
    type DaoHouseEntry,
    type DaoHouseCounter,
    type DaoHouseSuccession,
    type DaoHouseDispute,
    type DaoPrinciple,
    type DestroyedDaoHouse,
    type AncestralRecords,
    type AncestralRecency,
    type AncestorFate,
    type SectAncestor,
    type DormantAncestor,
    type PartingGift,
    type MillennialOffering
} from './sects.js';

export * from './regions.js';
export * from './traditions.js';
export * from './mortal-world.js';
export * from './faction-character.js';
export * from './faction-history.js';
export * from './bodies-that-cannot-keep-their-members-children.js';
export * from './a-favour-skips-the-admission-bar.js';
export * from './demonic-sects-and-what-they-are-willing-to-do.js';
export * from './hierarchy.js';
export * from './immortal-items.js';
export * from './wanderers.js';
export * from './false-immortals.js';
export * from './the-three-floors-a-house-admits-at.js';
export * from './members.js';
export * from './crossings.js';
export * from './history.js';
export * from './contingencies.js';
export * from './sealed-ancestors.js';
export * from './named-figures.js';
export * from './inheritance-trials.js';
export * from './what-each-house-makes-and-what-crosses-the-water.js';
export * from './lost-ages.js';
export * from './rumours-and-what-they-get-wrong.js';
export * from './structural-repair-medicine.js';

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
    /** Subset of `sects`: the ancient houses, which are sects to the engine. */
    daoHouses: number;
    /** Houses that no longer exist and are still load-bearing. */
    destroyedDaoHouses: number;
    encounters: number;
    regions: number;
    traditions: number;
    occupations: number;
    prices: number;
    settlements: number;
    /** Factions with a full distinctness record. Should equal `sects`. */
    charactered: number;
    /** Institutions above the map. A starting cultivator knows of none. */
    apexInstitutions: number;
    courts: number;
    guestElders: number;
    /** Factions placed in the governance stack. Should equal `sects`. */
    placedInStack: number;
    /** Consumables that came down from above. Tiny by construction. */
    immortalItems: number;
    /** Individual holdings of them, across every faction in the world. */
    immortalHoldings: number;
    /** Unattached figures worth asking. Vanishingly few. */
    wanderers: number;
    /**
     * Historical False Immortals the world remembers, every one of them with
     * an end recorded. None is serving and none is resident.
     */
    falseImmortals: number;
    /** Stages of the trajectory. Contiguous, ordered, covering the rung's span. */
    madnessStages: number;
    /** The population that is not human, and is on the same ladder. */
    beasts: number;
    /** What comes off them, priced in the herb catalog's bands. */
    beastMaterials: number;
    /** Regional displacement events. Each one has a stated cause. */
    beastTides: number;
    /** Institutions with somebody above the Lid still answering, plus gifts. */
    immortalChannels: number;
    /** Plans held by parties, waiting on events that have not happened. */
    contingencies: number;
    /** Sealed high-realm beings: held instruments and unowned hazards. */
    heldInstruments: number;
    unownedAncestors: number;
    /** Doors somebody set on purpose. The interior of each is entry-gated. */
    inheritanceTrials: number;
    /** Sites nobody arranged. What is in one depends on how the occupant died. */
    graves: number;
    /** Houses whose craft is specific enough to be written out rather than derived. */
    houseArtisans: number;
    /** Named stretches of open water, with the middle of each one in them. */
    seaLanes: number;
    /** What is actually on the hulls, each row a maker, a lane and a buyer. */
    seaCargo: number;
    /** Bodies that move goods across water, no two the same kind of operator. */
    seaTraders: number;
    /** Named people inside the factions, at the scale a player can know. */
    members: number;
    /** Named ages, including the present one. */
    ages: number;
    /** Civilisations that are gone and whose works the present is using. */
    deadCivilisations: number;
    /** Competing accounts of where cultivation came from. None endorsed. */
    originAccounts: number;
    /** Incompatible theories of the Lid, held by serious institutions. */
    lidTheories: number;
    /** Reckonings in use. Two of them are provincial and disagree. */
    calendars: number;
}

/** Catalog sizes, for tool responses and for the content smoke test. */
export function getCultivationCatalogCounts(): CultivationCatalogCounts {
    return {
        techniques: TECHNIQUES.length,
        pills: PILLS.length,
        recipes: RECIPES.length,
        herbs: HERBS.length,
        sects: SECTS.length,
        daoHouses: DAO_HOUSES.length,
        destroyedDaoHouses: DESTROYED_DAO_HOUSES.length,
        encounters: ENCOUNTERS.length,
        regions: REGIONS.length,
        traditions: TRADITIONS.length,
        occupations: OCCUPATIONS.length,
        prices: PRICES.length,
        settlements: SETTLEMENTS.length,
        charactered: Object.keys(FACTION_CHARACTER).length,
        apexInstitutions: APEX_INSTITUTIONS.length,
        courts: COURTS.length,
        guestElders: GUEST_ELDERS.length,
        placedInStack: Object.keys(FACTION_PARENTAGE).length,
        immortalItems: IMMORTAL_ITEMS.length,
        immortalHoldings: IMMORTAL_HOLDINGS.length,
        wanderers: WANDERERS.length,
        falseImmortals: FALSE_IMMORTALS.length,
        madnessStages: MADNESS_STAGES.length,
        beasts: BEASTS.length,
        beastMaterials: BEAST_MATERIALS.length,
        beastTides: BEAST_TIDES.length,
        immortalChannels: IMMORTAL_CHANNELS.length,
        contingencies: CONTINGENCIES.length,
        heldInstruments: HELD_INSTRUMENTS.length,
        unownedAncestors: UNOWNED_ANCESTORS.length,
        inheritanceTrials: INHERITANCE_TRIALS.length,
        graves: GRAVES.length,
        houseArtisans: HOUSE_ARTISANS.length,
        seaLanes: SEA_LANES.length,
        seaCargo: SEA_CARGO.length,
        seaTraders: SEA_TRADERS.length,
        members: MEMBERS.length,
        ages: AGES.length,
        deadCivilisations: DEAD_CIVILISATIONS.length,
        originAccounts: ORIGIN_ACCOUNTS.length,
        lidTheories: LID_THEORIES.length,
        calendars: CALENDARS.length
    };
}

/**
 * Techniques a specific spirit root may cultivate at this ordinal without a
 * wuxing conflict. Elementless arts always qualify, which is exactly why the
 * catalog carries so many of them: a muddled or dual root would otherwise have
 * almost nothing safe to learn.
 *
 * `includeConflicting` returns the dangerous ones too, flagged, because
 * choosing to cultivate a conflicting art is a legitimate - and frequently
 * fatal - player decision, not something content should hide.
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
/**
 * The highest rung a house's own books can carry one of its disciples to.
 *
 * The cross-catalog join that makes `production.reliableOrdinal` checkable.
 * The cap belongs to the MANUAL, never to the house - nothing anywhere
 * branches on a sect - so a house's ceiling is simply the best cap among the
 * books it teaches, and the faction catalog's claim about what it can produce
 * is either supported by that number or it is not.
 *
 * Null means it teaches no cultivation manual at all. For a closed house
 * (`recruits: false`) that is correct and complete: the Hollow Court reads
 * `reliableOrdinal: 0` while sitting at power ordinal 40, and its own note
 * says why - "produces nobody, by construction: it takes no disciples". Zero
 * there is a statement about INTAKE, not about the quality of anything it
 * could teach. For a house that DOES recruit, null is a content gap: it takes
 * disciples and hands them nothing to practise.
 */
export function houseTeachingCeiling(sectId: string): number | null {
    const sect = getSect(sectId);
    if (!sect) return null;
    const taught = [
        ...sect.teaches,
        ...(sect.signatureTechniqueId ? [sect.signatureTechniqueId] : [])
    ];
    let ceiling: number | null = null;
    for (const id of taught) {
        const technique = getTechnique(id);
        if (!technique || technique.class !== 'cultivation') continue;
        // An uncapped manual carries somebody the whole way. No house teaches
        // one - they are all ruin or grave - but if that ever changed, the
        // ceiling is the top of the ladder rather than a missing number.
        const cap = technique.cap ?? MAX_ORDINAL;
        ceiling = ceiling === null ? cap : Math.max(ceiling, cap);
    }
    return ceiling;
}

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
    const clamped = Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
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
 * the exploration loop - the reason a cultivator without talent digs instead
 * of cultivating, since ambient qi in a drawn-down age will not close the gap to a
 * single-root prodigy and a recovered chaos-grade manual might.
 */
export function getRuinLootTable(ordinal: number): {
    techniques: TechniqueEntry[];
    recipes: RecipeEntry[];
} {
    const clamped = Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
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
    const clamped = Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
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
