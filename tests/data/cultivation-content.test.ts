/**
 * Cultivation content catalog validation.
 *
 * This suite is the contract between the content in `src/data/cultivation/` and
 * the schemas in `src/schema/cultivation.ts`. It walks every entry in every
 * catalog, parses it against its Zod schema, and then asserts the balance
 * invariants the content commits to in its own header comments. If an invariant
 * here fails, either the content is wrong or the invariant was a lie - both are
 * bugs worth failing a build over.
 */

import { describe, it, expect } from 'vitest';

import {
    TechniqueSchema,
    PillSchema,
    RecipeSchema,
    SectSchema,
    ElementSchema,
    TechniqueGradeSchema,
    TechniqueCategorySchema,
    PillEffectSchema,
    type TechniqueGrade,
    type Element
} from '../../src/schema/cultivation.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    LAST_CROSSING_ORDINAL,
    MAX_ORDINAL,
    OBJECT_CEILING_BELOW_THE_LID,
    TRUE_IMMORTAL_ORDINAL
} from '../../src/engine/cultivation/realms.js';
import {
    ABOVE_THE_LID_TRANSMISSION,
    CONTENT_MAX_ORDINAL,
    GRADE_BASELINE_OPACITY,
    TECHNIQUES,
    learningCostMultiplier,
    transmissionModeOf
} from '../../src/data/cultivation/techniques.js';
import { THE_DEEPEST_ROADS } from '../../src/data/cultivation/roads-to-the-top-of-the-ladder.js';
import { WANDERERS, getWanderer } from '../../src/data/cultivation/wanderers.js';
import { SPIRIT_ROOTS } from '../../src/engine/cultivation/spirit-roots.js';
import { DiceEngine } from '../../src/math/dice.js';

import {
    TECHNIQUES,
    GRADE_ORDINAL_BANDS,
    GRADE_QI_BANDS,
    GRADE_ORDER,
    gradeRank,
    getTechnique,
    isWideSpan,
    findTechniquesForOrdinal,
    findBestTechniquesForOrdinal,
    gradeForOrdinal,
    CONTENT_MAX_ORDINAL,
    getTechniquesByProvenance,
    getRecoveredTechniques,
    RUIN_ONLY_TECHNIQUE_IDS,
    GRAVE_ONLY_TECHNIQUE_IDS
} from '../../src/data/cultivation/techniques.js';
import {
    PILLS,
    PILL_VALUE_BANDS,
    PILL_TOXICITY_CEILING,
    POTENCY_UNITS,
    MINOR_HEALING_PILL_ID,
    GRAIN_ABSTINENCE_PILL_ID,
    getPill,
    getStartingPill,
    findCheapestPillFor
} from '../../src/data/cultivation/pills.js';
import {
    RECIPES,
    RECIPE_SUCCESS_BANDS,
    getRecipe,
    getRecipesForPill,
    getRecipesUsingHerb,
    getRecoveredRecipes,
    RECOVERED_RECIPE_IDS
} from '../../src/data/cultivation/recipes.js';
import {
    HERBS,
    HERB_VALUE_BANDS,
    HERB_RARITY_CEILING,
    HerbSchema,
    getHerb,
    rollHerb
} from '../../src/data/cultivation/herbs.js';
import {
    SECTS,
    SECT_ADMISSION,
    getSect,
    getSectsByAlignment,
    getSectsTeaching,
    stipendForRank,
    formationIntegrity,
    DAO_HOUSES,
    DESTROYED_DAO_HOUSES,
    DAO_HOUSE_DISPUTES,
    getDaoHouse,
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
    auditAncestralClaim
} from '../../src/data/cultivation/sects.js';
import {
    ENCOUNTERS,
    EncounterEntrySchema,
    getEncounter,
    getEncountersForOrdinal,
    rollEncounter,
    fillSummary,
    missingTokens,
    ruinWeightShare
} from '../../src/data/cultivation/encounters.js';
import {
    getCultivationCatalogCounts,
    findTechniquesForRoot,
    whereToLearn,
    getPillIngredientBill,
    findPillsForProblem,
    findAdmissibleSects,
    getRuinLootTable,
    CULTIVATION_CONTENT_PROVENANCE
} from '../../src/data/cultivation/index.js';

const GRADES = GRADE_ORDER;
const dice = new DiceEngine('cultivation-content-test');

/** Ids must be unique within a catalog; collisions silently shadow content. */
function expectUniqueIds(entries: readonly { id: string }[], label: string): void {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const e of entries) {
        if (seen.has(e.id)) dupes.push(e.id);
        seen.add(e.id);
    }
    expect(dupes, `duplicate ${label} ids`).toEqual([]);
    expect(seen.size).toBe(entries.length);
}

// ─────────────────────────────────────────────────────────────────────────
// THE LADDER HAS A TIE AT THE TOP, AND THESE HELPERS ARE WHERE IT LANDS
//
// `chaos` used to outrank `immortal` and no longer does. The ruling:
//
//   > chaos grade is equal to immortal grade but it's got random effects which
//   > may be bad (whereas immortal ones are uniformly positive). but chaos is
//   > powerful.
//
// So `GRADE_ORDER` is a LISTING order and `gradeRank` is the power order, and
// every band assertion below had to decide which of the two it was making a
// claim about. A band that steps up per rung of POWER must not step up between
// two grades that are equal in power - asserting it did is asserting the
// ordering this correction removed.
//
// Both helpers walk the listing order and split on `gradeRank`, so if a sixth
// grade is added as a peer of something, the split follows it with no edit.
// ─────────────────────────────────────────────────────────────────────────

/** Adjacent listing pairs that are a real step UP in power. Peers skipped. */
function eachStepUp(fn: (lower: TechniqueGrade, higher: TechniqueGrade) => void): void {
    for (let i = 1; i < GRADES.length; i++) {
        if (gradeRank(GRADES[i]) === gradeRank(GRADES[i - 1])) continue;
        fn(GRADES[i - 1], GRADES[i]);
    }
}

/** Adjacent listing pairs that are PEERS. Currently exactly one: immortal/chaos. */
function eachPeerPair(fn: (a: TechniqueGrade, b: TechniqueGrade) => void): void {
    for (let i = 1; i < GRADES.length; i++) {
        if (gradeRank(GRADES[i]) !== gradeRank(GRADES[i - 1])) continue;
        fn(GRADES[i - 1], GRADES[i]);
    }
}

/** Every value in `values` rises at a step up in power and ties between peers. */
function expectRisingWithPower(values: Record<TechniqueGrade, number>, label: string): void {
    eachStepUp((lower, higher) => {
        expect(
            values[higher],
            `${label}: ${higher} must exceed ${lower}`
        ).toBeGreaterThan(values[lower]);
    });
    eachPeerPair((a, b) => {
        expect(
            values[b],
            `${label}: ${a} and ${b} are peers in power and must not differ on this axis`
        ).toBe(values[a]);
    });
}

// ─────────────────────────────────────────────────────────────────────────
describe('cultivation content: catalog sizes', () => {
    it('meets the authored minimum sizes', () => {
        const counts = getCultivationCatalogCounts();
        expect(counts.techniques).toBeGreaterThanOrEqual(60);
        expect(counts.pills).toBeGreaterThanOrEqual(30);
        expect(counts.recipes).toBeGreaterThanOrEqual(30);
        expect(counts.herbs).toBeGreaterThanOrEqual(20);
        expect(counts.sects).toBeGreaterThanOrEqual(12);
        expect(counts.encounters).toBeGreaterThanOrEqual(30);
    });

    it('declares first-party provenance', () => {
        expect(CULTIVATION_CONTENT_PROVENANCE.gamesystem).toBe('xianxia-cultivation');
        expect(CULTIVATION_CONTENT_PROVENANCE.license.key).toBe('first-party');
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('techniques', () => {
    it('every entry parses against TechniqueSchema', () => {
        for (const t of TECHNIQUES) {
            expect(() => TechniqueSchema.parse(t), `technique ${t.id}`).not.toThrow();
        }
    });

    it('ids are unique', () => {
        expectUniqueIds(TECHNIQUES, 'technique');
    });

    it('every damage expression is parseable by the dice engine', () => {
        for (const t of TECHNIQUES) {
            if (t.damage === null) continue;
            expect(() => dice.parse(t.damage as string), `${t.id} damage "${t.damage}"`).not.toThrow();
        }
    });

    it('every damage expression rolls to a positive number', () => {
        for (const t of TECHNIQUES) {
            if (t.damage === null) continue;
            expect(dice.roll(t.damage).result, `${t.id}`).toBeGreaterThan(0);
        }
    });

    it('only uses elements that exist in the spirit-root system', () => {
        const rootElements = new Set<string>(SPIRIT_ROOTS.flatMap(r => r.elements));
        for (const t of TECHNIQUES) {
            if (t.element === null) continue;
            expect(() => ElementSchema.parse(t.element), `${t.id} element`).not.toThrow();
            expect(rootElements.has(t.element), `${t.id} element ${t.element} has no root`).toBe(true);
        }
    });

    it('covers every category and every grade', () => {
        const categories = new Set(TECHNIQUES.map(t => t.category));
        for (const c of TechniqueCategorySchema.options) {
            expect(categories.has(c), `missing category ${c}`).toBe(true);
        }
        const grades = new Set(TECHNIQUES.map(t => t.grade));
        for (const g of TechniqueGradeSchema.options) {
            expect(grades.has(g), `missing grade ${g}`).toBe(true);
        }
    });

    it('covers all five non-forbidden categories at every grade', () => {
        const core = ['attack', 'defense', 'movement', 'support', 'cultivation'] as const;
        for (const grade of GRADES) {
            for (const category of core) {
                const found = TECHNIQUES.some(t => t.grade === grade && t.category === category);
                expect(found, `no ${grade} ${category} technique`).toBe(true);
            }
        }
    });

    // ── balance invariants ────────────────────────────────────────────
    it('grade ordinal bands step up with POWER, and the two peers share a floor', () => {
        expect(GRADE_ORDINAL_BANDS.mortal.min).toBe(0);
        // Content stops at the last crossing. True Immortal is not a rank
        // anyone reads a manual at, and MAX_ORDINAL may move again.
        expect(GRADE_ORDINAL_BANDS.chaos.max).toBe(CONTENT_MAX_ORDINAL);
        expect(CONTENT_MAX_ORDINAL).toBeLessThanOrEqual(MAX_ORDINAL);
        eachStepUp((lower, higher) => {
            expect(GRADE_ORDINAL_BANDS[higher].min).toBe(GRADE_ORDINAL_BANDS[lower].max + 1);
            expect(GRADE_ORDINAL_BANDS[higher].max).toBeGreaterThan(GRADE_ORDINAL_BANDS[higher].min);
        });
        // A DECISION, PINNED HERE BECAUSE IT LIVES ONLY AS A NUMBER. Peers open
        // at the same rung: grade is not what puts one of them further up the
        // ladder than the other. Every chaos art in the catalog happens to sit
        // at 37 or above all the same, which is a fact about those arts and not
        // about the band - see `GRADE_ORDINAL_BANDS`.
        eachPeerPair((a, b) => {
            expect(
                GRADE_ORDINAL_BANDS[b].min,
                `${a} and ${b} are peers; a peer grade may not open higher`
            ).toBe(GRADE_ORDINAL_BANDS[a].min);
        });
    });

    it('required ordinal rises with grade: every art sits inside its grade band', () => {
        for (const t of TECHNIQUES) {
            const band = GRADE_ORDINAL_BANDS[t.grade];
            // A wide-span manual is exempt, and only a wide-span manual. See
            // `GRADE_ORDINAL_BANDS` for the reasoning: the band is what makes
            // the succession a ladder rather than a shop and every ordinary
            // book still obeys it, but it cannot describe a treasure, because
            // raising `requiredOrdinal` to satisfy it destroys the thing it is
            // gating - a cap-45 book that opens at 37 skips nothing.
            if (isWideSpan(t)) continue;
            expect(t.requiredOrdinal, `${t.id} requiredOrdinal`).toBeGreaterThanOrEqual(band.min);
            expect(t.requiredOrdinal, `${t.id} requiredOrdinal`).toBeLessThanOrEqual(band.max);
        }
    });

    it('more powerful grades cost more qi, and peers cost the same to fire', () => {
        eachStepUp((lower, higher) => {
            expect(GRADE_QI_BANDS[higher].min).toBeGreaterThan(GRADE_QI_BANDS[lower].max);
        });
        // Firing a chaos art is not dearer for being unpredictable.
        eachPeerPair((a, b) => {
            expect(GRADE_QI_BANDS[b].min).toBe(GRADE_QI_BANDS[a].min);
        });
        for (const t of TECHNIQUES) {
            const band = GRADE_QI_BANDS[t.grade];
            expect(t.qiCost, `${t.id} qiCost`).toBeGreaterThanOrEqual(band.min);
            expect(t.qiCost, `${t.id} qiCost`).toBeLessThanOrEqual(band.max);
        }
    });

    it('mutated-root arts are genuinely scarce', () => {
        const count = (el: Element): number => TECHNIQUES.filter(t => t.element === el).length;
        const wuxing: Element[] = ['metal', 'wood', 'water', 'fire', 'earth'];
        const mutated: Element[] = ['lightning', 'ice'];
        for (const m of mutated) {
            expect(count(m), `${m} arts must exist at all`).toBeGreaterThan(0);
            for (const w of wuxing) {
                expect(count(w), `${w} must be commoner than ${m}`).toBeGreaterThan(count(m));
            }
        }
        const elemental = TECHNIQUES.filter(t => t.element !== null).length;
        const mutatedTotal = mutated.reduce((sum, m) => sum + count(m), 0);
        expect(mutatedTotal / elemental).toBeLessThan(0.25);
    });

    it('keeps forbidden arts a small, costly minority', () => {
        const forbidden = TECHNIQUES.filter(t => t.category === 'forbidden');
        expect(forbidden.length).toBeGreaterThanOrEqual(3);
        expect(forbidden.length / TECHNIQUES.length).toBeLessThan(0.15);
        // Every forbidden art carries an explicit stated cost in its text.
        for (const t of forbidden) {
            expect(t.description.length, `${t.id} needs real flavour text`).toBeGreaterThan(80);
        }
    });

    it('every art has real flavour text, not a placeholder', () => {
        for (const t of TECHNIQUES) {
            expect(t.description.length, `${t.id} description too short`).toBeGreaterThan(60);
            expect(t.description.toLowerCase()).not.toContain('lorem');
            expect(t.description.toLowerCase()).not.toContain('tbd');
        }
    });

    it('elementless arts exist at every grade so any root has a path', () => {
        for (const grade of GRADES) {
            const elementless = TECHNIQUES.filter(t => t.grade === grade && t.element === null);
            expect(elementless.length, `no elementless ${grade} art`).toBeGreaterThan(0);
        }
    });

    it('there is always something to strive for: every ordinal has a higher-tier art ahead', () => {
        // Up to the last crossing. At the crossing itself what is ahead is not
        // a manual, it is the Lid.
        for (let o = 0; o < CONTENT_MAX_ORDINAL; o++) {
            const ahead = TECHNIQUES.filter(t => t.requiredOrdinal > o);
            expect(ahead.length, `nothing left to learn above ordinal ${o}`).toBeGreaterThan(0);
        }
    });

    // ── lookups ───────────────────────────────────────────────────────
    it('getTechnique resolves every id and rejects unknown ones', () => {
        for (const t of TECHNIQUES) expect(getTechnique(t.id)).toBe(t);
        expect(getTechnique('no-such-art')).toBeUndefined();
    });

    it('findTechniquesForOrdinal is monotone and gated', () => {
        let previous = -1;
        for (let o = 0; o <= MAX_ORDINAL; o++) {
            const found = findTechniquesForOrdinal(o);
            expect(found.length).toBeGreaterThanOrEqual(previous);
            previous = found.length;
            for (const t of found) expect(t.requiredOrdinal).toBeLessThanOrEqual(o);
        }
        expect(findTechniquesForOrdinal(MAX_ORDINAL).length).toBe(TECHNIQUES.length);
    });

    it('findTechniquesForOrdinal honours its filters', () => {
        const noForbidden = findTechniquesForOrdinal(MAX_ORDINAL, { excludeForbidden: true });
        expect(noForbidden.some(t => t.category === 'forbidden')).toBe(false);

        const fireOnly = findTechniquesForOrdinal(MAX_ORDINAL, { elements: ['fire'] });
        expect(fireOnly.every(t => t.element === null || t.element === 'fire')).toBe(true);

        const elementless = findTechniquesForOrdinal(MAX_ORDINAL, { elementlessOnly: true });
        expect(elementless.every(t => t.element === null)).toBe(true);
    });

    it('findBestTechniquesForOrdinal returns the top reachable POWER, which at the summit is two grades', () => {
        // THIS TEST USED TO ASSERT `every(t => t.grade === 'chaos')`, which was
        // a copy of the old ladder where chaos outranked immortal. It no longer
        // does: the two are peers, so the best a summit cultivator can reach is
        // both of them and a shelf offering only one is answering a question
        // nobody asked. What the function actually promises is a single POWER
        // rank, and that is what is asserted now.
        const best = findBestTechniquesForOrdinal(MAX_ORDINAL);
        expect(best.length).toBeGreaterThan(0);
        const ranks = new Set(best.map(t => gradeRank(t.grade)));
        expect(ranks.size, 'best should be one power rank, however many grades share it').toBe(1);
        expect(gradeRank([...best][0].grade)).toBe(gradeRank('chaos'));
        expect(gradeRank('immortal')).toBe(gradeRank('chaos'));
        expect(
            new Set(best.map(t => t.grade)).size,
            'both peer grades should be on offer at the summit'
        ).toBeGreaterThan(1);

        // At ordinal five the best ORDINARY art is mortal grade. The one
        // wide-span treasure that opens down here is chaos grade and is
        // correctly reported as reachable - it is reachable, that is the whole
        // point of it - so the ordinary claim is made about the ordinary
        // catalog rather than by pretending the treasure is not there.
        const earlyBest = findBestTechniquesForOrdinal(5).filter(t => !isWideSpan(t));
        expect(earlyBest.every(t => t.grade === 'mortal')).toBe(true);
        expect(
            findBestTechniquesForOrdinal(5).some(isWideSpan),
            'the treasure is reachable at five, which is what makes it a treasure'
        ).toBe(true);
    });

    it('gradeForOrdinal agrees with the band table', () => {
        for (let o = 0; o <= CONTENT_MAX_ORDINAL; o++) {
            const band = GRADE_ORDINAL_BANDS[gradeForOrdinal(o)];
            expect(o).toBeGreaterThanOrEqual(band.min);
            expect(o).toBeLessThanOrEqual(band.max);
        }
        // Above the last crossing there are no manuals; report the top band.
        expect(gradeForOrdinal(MAX_ORDINAL)).toBe('chaos');
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('pills', () => {
    it('every entry parses against PillSchema', () => {
        for (const p of PILLS) {
            expect(() => PillSchema.parse(p), `pill ${p.id}`).not.toThrow();
        }
    });

    it('ids are unique', () => {
        expectUniqueIds(PILLS, 'pill');
    });

    it('covers every PillEffect', () => {
        const effects = new Set(PILLS.map(p => p.effect));
        for (const e of PillEffectSchema.options) {
            expect(effects.has(e), `no pill provides ${e}`).toBe(true);
        }
        // And every effect has a documented potency unit.
        for (const e of PillEffectSchema.options) {
            expect(POTENCY_UNITS[e], `no potency unit documented for ${e}`).toBeTruthy();
        }
    });

    it('covers every grade', () => {
        for (const g of GRADES) {
            expect(PILLS.some(p => p.grade === g), `no ${g} pill`).toBe(true);
        }
    });

    it('value rises with POWER, peers share a floor, and every pill is in band', () => {
        eachStepUp((lower, higher) => {
            expect(PILL_VALUE_BANDS[higher].min).toBeGreaterThan(PILL_VALUE_BANDS[lower].max);
        });
        // Grade does not move the window between peers. A chaos pill opens
        // where an immortal pill opens; what carries the dearest of them past
        // the immortal ceiling is scarcity, which is not a power claim.
        eachPeerPair((a, b) => {
            expect(PILL_VALUE_BANDS[b].min).toBe(PILL_VALUE_BANDS[a].min);
        });
        for (const p of PILLS) {
            const band = PILL_VALUE_BANDS[p.grade];
            expect(p.value, `${p.id} value`).toBeGreaterThanOrEqual(band.min);
            expect(p.value, `${p.id} value`).toBeLessThanOrEqual(band.max);
        }
    });

    it('toxicity ceilings rise with power, tie between peers, and are respected', () => {
        // Toxicity is the KNOWN price, printed on the tin. A peer-magnitude
        // medicine loads the body the same amount whoever refined it, and what
        // separates the two top grades is not on this axis at all.
        expectRisingWithPower(PILL_TOXICITY_CEILING, 'pill toxicity ceiling');
        for (const p of PILLS) {
            expect(p.toxicity, `${p.id} toxicity`).toBeGreaterThanOrEqual(0);
            expect(p.toxicity, `${p.id} toxicity`).toBeLessThanOrEqual(PILL_TOXICITY_CEILING[p.grade]);
        }
    });

    it('every pill does something', () => {
        for (const p of PILLS) {
            expect(p.potency, `${p.id} potency`).toBeGreaterThan(0);
            expect(p.description.length, `${p.id} description`).toBeGreaterThan(60);
        }
    });

    it('breakthrough boosts stay inside a legal probability delta', () => {
        for (const p of PILLS.filter(x => x.effect === 'boost_breakthrough')) {
            expect(p.potency).toBeGreaterThan(0);
            expect(p.potency).toBeLessThanOrEqual(0.5);
        }
    });

    it('ships the Minor Healing Pill every run starts with', () => {
        const pill = getPill(MINOR_HEALING_PILL_ID);
        expect(pill).toBeDefined();
        expect(pill?.effect).toBe('heal_hp');
        expect(pill?.grade).toBe('mortal');
        expect(getStartingPill().id).toBe(MINOR_HEALING_PILL_ID);
    });

    it('prices the Grain Abstinence Pill as a real goal, not a purchase', () => {
        const pill = getPill(GRAIN_ABSTINENCE_PILL_ID);
        expect(pill).toBeDefined();
        expect(pill?.effect).toBe('grain_abstinence');
        // Removes hunger for years at a time.
        expect(pill!.potency).toBeGreaterThanOrEqual(365);
        // The most expensive thing at its grade, and orders of magnitude beyond
        // the 30 spirit stones a run begins with.
        for (const other of PILLS.filter(p => p.grade === pill!.grade)) {
            expect(pill!.value).toBeGreaterThanOrEqual(other.value);
        }
        expect(pill!.value).toBeGreaterThan(30 * 100);
    });

    it('findCheapestPillFor picks the cheapest sufficient option', () => {
        const cheap = findCheapestPillFor('heal_hp', 10);
        expect(cheap?.id).toBe(MINOR_HEALING_PILL_ID);
        const none = findCheapestPillFor('heal_hp', 1_000_000);
        expect(none).toBeUndefined();
    });

    it('findPillsForProblem returns cheapest-first', () => {
        const healers = findPillsForProblem('heal_hp');
        expect(healers.length).toBeGreaterThan(1);
        for (let i = 1; i < healers.length; i++) {
            expect(healers[i].value).toBeGreaterThanOrEqual(healers[i - 1].value);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('herbs', () => {
    it('every entry parses against HerbSchema', () => {
        for (const h of HERBS) {
            expect(() => HerbSchema.parse(h), `herb ${h.id}`).not.toThrow();
        }
    });

    it('ids are unique', () => {
        expectUniqueIds(HERBS, 'herb');
    });

    it('value rises with power and peers share a floor; rarity keeps falling', () => {
        eachStepUp((lower, higher) => {
            expect(HERB_VALUE_BANDS[higher].min).toBeGreaterThan(HERB_VALUE_BANDS[lower].max);
        });
        eachPeerPair((a, b) => {
            expect(HERB_VALUE_BANDS[b].min).toBe(HERB_VALUE_BANDS[a].min);
        });
        // ── AND RARITY IS DELIBERATELY NOT LEVELLED ACROSS THE PEERS ─────
        //
        // Pinned because it looks like an oversight next to the line above and
        // is not: rarity is a population statement and has nothing to do with
        // power. The two top grades are equally strong and there is still less
        // chaos-grade material in the world. If somebody later "fixes" this to
        // match the value band, they have confused scarcity with rank.
        for (let i = 1; i < GRADES.length; i++) {
            expect(HERB_RARITY_CEILING[GRADES[i]]).toBeLessThan(HERB_RARITY_CEILING[GRADES[i - 1]]);
        }
        for (const h of HERBS) {
            const band = HERB_VALUE_BANDS[h.grade];
            expect(h.value, `${h.id} value`).toBeGreaterThanOrEqual(band.min);
            expect(h.value, `${h.id} value`).toBeLessThanOrEqual(band.max);
            expect(h.rarityWeight, `${h.id} rarity`).toBeLessThanOrEqual(HERB_RARITY_CEILING[h.grade]);
        }
    });

    it('harvest ordinals sit at or above the grade band floor', () => {
        for (const h of HERBS) {
            expect(h.harvestOrdinal, `${h.id} harvestOrdinal`)
                .toBeGreaterThanOrEqual(GRADE_ORDINAL_BANDS[h.grade].min);
            expect(h.harvestOrdinal).toBeLessThanOrEqual(MAX_ORDINAL);
        }
    });

    it('rollHerb is deterministic for a given sample and respects the ordinal gate', () => {
        const a = rollHerb(0, 0.42);
        const b = rollHerb(0, 0.42);
        expect(a?.id).toBe(b?.id);
        expect(a?.harvestOrdinal).toBeLessThanOrEqual(0);

        for (const sample of [0, 0.25, 0.5, 0.75, 0.999999]) {
            const herb = rollHerb(MAX_ORDINAL, sample);
            expect(herb, `sample ${sample} produced nothing`).toBeDefined();
        }
        // A biome with nothing reachable at ordinal 0 yields nothing.
        expect(rollHerb(0, 0.5, 'abyss')).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('recipes', () => {
    it('every entry parses against RecipeSchema', () => {
        for (const r of RECIPES) {
            expect(() => RecipeSchema.parse(r), `recipe ${r.id}`).not.toThrow();
        }
    });

    it('ids are unique', () => {
        expectUniqueIds(RECIPES, 'recipe');
    });

    it('every producesPillId resolves to a real pill', () => {
        for (const r of RECIPES) {
            expect(getPill(r.producesPillId), `${r.id} produces unknown pill`).toBeDefined();
        }
    });

    it('every ingredient resolves to a real herb', () => {
        for (const r of RECIPES) {
            expect(r.ingredients.length, `${r.id} has no ingredients`).toBeGreaterThan(0);
            for (const ing of r.ingredients) {
                expect(getHerb(ing.itemId), `${r.id} needs unknown herb ${ing.itemId}`).toBeDefined();
                expect(ing.quantity).toBeGreaterThan(0);
            }
        }
    });

    it('every pill is craftable by at least one recipe', () => {
        for (const p of PILLS) {
            expect(getRecipesForPill(p.id).length, `${p.id} has no recipe`).toBeGreaterThan(0);
        }
    });

    it('success rate falls as power rises, and peers are the same work', () => {
        eachStepUp((lower, higher) => {
            expect(RECIPE_SUCCESS_BANDS[higher].max).toBeLessThan(RECIPE_SUCCESS_BANDS[lower].min);
        });
        // The same cauldron at the same rung produces both, and a cauldron
        // cannot know what the thing will turn out to do when swallowed. So
        // the two top grades share a window rather than chaos being harder.
        eachPeerPair((a, b) => {
            expect(RECIPE_SUCCESS_BANDS[b].min).toBe(RECIPE_SUCCESS_BANDS[a].min);
            expect(RECIPE_SUCCESS_BANDS[b].max).toBe(RECIPE_SUCCESS_BANDS[a].max);
        });
        for (const r of RECIPES) {
            const grade = getPill(r.producesPillId)!.grade;
            const band = RECIPE_SUCCESS_BANDS[grade];
            expect(r.baseSuccessRate, `${r.id} success rate`).toBeGreaterThanOrEqual(band.min);
            expect(r.baseSuccessRate, `${r.id} success rate`).toBeLessThanOrEqual(band.max);
        }
    });

    it('requiredOrdinal gates at the grade floor and at every ingredient site', () => {
        for (const r of RECIPES) {
            const grade = getPill(r.producesPillId)!.grade;
            expect(r.requiredOrdinal, `${r.id} below grade floor`)
                .toBeGreaterThanOrEqual(GRADE_ORDINAL_BANDS[grade].min);
            expect(r.requiredOrdinal).toBeLessThanOrEqual(MAX_ORDINAL);
            for (const ing of r.ingredients) {
                const herb = getHerb(ing.itemId)!;
                expect(r.requiredOrdinal, `${r.id} cannot reach ${herb.id}`)
                    .toBeGreaterThanOrEqual(herb.harvestOrdinal);
            }
        }
    });

    it('never demands an ingredient of a higher grade than the pill', () => {
        // `gradeRank` and not `GRADES.indexOf`: the question is power, and a
        // chaos herb in an immortal formula is a peer ingredient rather than an
        // over-reach. Indexing the listing order here would refuse it.
        const rank = gradeRank;
        for (const r of RECIPES) {
            const pillGrade = getPill(r.producesPillId)!.grade;
            for (const ing of r.ingredients) {
                const herb = getHerb(ing.itemId)!;
                expect(rank(herb.grade), `${r.id} uses ${herb.id} above pill grade`)
                    .toBeLessThanOrEqual(rank(pillGrade));
            }
        }
    });

    it('refinement adds value: ingredients always cost less than the pill', () => {
        for (const r of RECIPES) {
            const pill = getPill(r.producesPillId)!;
            const ingredientValue = r.ingredients.reduce(
                (sum, ing) => sum + getHerb(ing.itemId)!.value * ing.quantity,
                0
            );
            expect(ingredientValue, `${r.id} costs more than ${pill.id} sells for`).toBeLessThan(pill.value);
        }
    });

    it('lookups resolve both directions', () => {
        for (const r of RECIPES) expect(getRecipe(r.id)).toBe(r);
        expect(getRecipe('recipe-nonexistent')).toBeUndefined();

        const qiGrassRecipes = getRecipesUsingHerb('herb-qi-grass');
        expect(qiGrassRecipes.length).toBeGreaterThan(0);
        for (const r of qiGrassRecipes) {
            expect(r.ingredients.some(i => i.itemId === 'herb-qi-grass')).toBe(true);
        }
    });

    it('getPillIngredientBill reports a positive margin for every pill', () => {
        for (const p of PILLS) {
            const bill = getPillIngredientBill(p.id);
            expect(bill, `no bill for ${p.id}`).toBeDefined();
            expect(bill!.lines.length).toBeGreaterThan(0);
            expect(bill!.margin).toBeGreaterThan(0);
        }
        expect(getPillIngredientBill('pill-nonexistent')).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('sects', () => {
    it('every entry parses against SectSchema', () => {
        for (const s of SECTS) {
            expect(() => SectSchema.parse(s), `sect ${s.id}`).not.toThrow();
        }
    });

    it('ids are unique', () => {
        expectUniqueIds(SECTS, 'sect');
    });

    it('covers all three alignments', () => {
        expect(getSectsByAlignment('righteous').length).toBeGreaterThanOrEqual(3);
        expect(getSectsByAlignment('neutral').length).toBeGreaterThanOrEqual(3);
        expect(getSectsByAlignment('demonic').length).toBeGreaterThanOrEqual(3);
    });

    it('rank ladders are distinct and pair one-to-one with stipends', () => {
        const ladders = new Set<string>();
        for (const s of SECTS) {
            expect(s.ranks.length, `${s.id} needs a ladder`).toBeGreaterThanOrEqual(4);
            expect(s.stipend.length, `${s.id} stipend/rank mismatch`).toBe(s.ranks.length);
            for (let i = 1; i < s.stipend.length; i++) {
                expect(s.stipend[i], `${s.id} stipend falls at rank ${i}`)
                    .toBeGreaterThan(s.stipend[i - 1]);
            }
            ladders.add(s.ranks.join('|'));
        }
        expect(ladders.size, 'sect rank ladders must be distinct').toBe(SECTS.length);
    });

    it('every taught technique resolves and is within the sect\'s reach', () => {
        for (const s of SECTS) {
            if (!s.recruits) {
                // Powers that take no applicants transmit nothing.
                expect(s.teaches.length, `${s.id} does not recruit but teaches`).toBe(0);
                expect(s.signatureTechniqueId, `${s.id} needs no signature art`).toBeNull();
                continue;
            }
            if (s.id === 'sect-hollow-court') {
                // One book, and it is the whole library. This used to assert
                // zero, on the reasoning that everybody arriving is already
                // formed - which was true and did not follow: the Court admits
                // only people capable of reaching the last realm because that
                // is the only thing it is for, and a body with one purpose
                // holds the road to it. What it does not hold is a second
                // title, because a second title would be a second purpose.
                expect(s.teaches, 'the Court holds one road and nothing else')
                    .toEqual(['protected-crossing-canon']);
                expect(s.signatureTechniqueId).toBe('protected-crossing-canon');
                continue;
            }
            expect(s.teaches.length, `${s.id} teaches nothing`).toBeGreaterThan(0);
            for (const id of s.teaches) {
                const technique = getTechnique(id);
                expect(technique, `${s.id} teaches unknown technique ${id}`).toBeDefined();
                expect(technique!.requiredOrdinal, `${s.id} teaches ${id} above its own power`)
                    .toBeLessThanOrEqual(s.powerOrdinal);
            }
            expect(s.signatureTechniqueId, `${s.id} needs a signature art`).not.toBeNull();
            expect(s.teaches.includes(s.signatureTechniqueId!), `${s.id} signature art not taught`).toBe(true);
        }
    });

    it('admission is possible and below the sect\'s own power', () => {
        for (const s of SECTS) {
            expect(s.admissionOrdinal).toBeGreaterThanOrEqual(0);
            expect(s.admissionOrdinal, `${s.id} admits above its own strength`).toBeLessThan(s.powerOrdinal);
            const admission = SECT_ADMISSION[s.id];
            expect(admission, `${s.id} has no admission terms`).toBeDefined();
            expect(admission.minOrdinal).toBe(s.admissionOrdinal);
            expect(admission.requirement.length).toBeGreaterThan(10);
        }
    });

    it('rivalries resolve, are mutual, and are never self-directed', () => {
        for (const s of SECTS) {
            for (const rivalId of s.rivals) {
                expect(rivalId, `${s.id} rivals itself`).not.toBe(s.id);
                const rival = getSect(rivalId);
                expect(rival, `${s.id} rivals unknown sect ${rivalId}`).toBeDefined();
                expect(rival!.rivals.includes(s.id), `${rivalId} does not return ${s.id}'s feud`).toBe(true);
            }
        }
        // At least one cross-alignment feud exists, or the world has no tension.
        const crossAlignment = SECTS.some(s =>
            s.rivals.some(r => getSect(r)!.alignment !== s.alignment));
        expect(crossAlignment).toBe(true);
    });

    it('the demonic sects hold the forbidden arts', () => {
        const forbiddenIds = new Set(TECHNIQUES.filter(t => t.category === 'forbidden').map(t => t.id));
        for (const s of SECTS) {
            const teachesForbidden = s.teaches.some(id => forbiddenIds.has(id));
            if (teachesForbidden) {
                expect(s.alignment, `${s.id} teaches forbidden arts openly`).toBe('demonic');
            }
        }
        expect(getSectsByAlignment('demonic').some(s => s.teaches.some(id => forbiddenIds.has(id)))).toBe(true);
    });

    it('somewhere takes an ordinal-zero cultivator', () => {
        const open = SECTS.filter(s => s.admissionOrdinal === 0);
        expect(open.length, 'a new run must have somewhere to go').toBeGreaterThan(0);
    });

    it('lookups resolve', () => {
        for (const s of SECTS) expect(getSect(s.id)).toBe(s);
        expect(getSect('sect-nonexistent')).toBeUndefined();
        expect(stipendForRank(SECTS[0].id, 0)).toBe(SECTS[0].stipend[0]);
        expect(stipendForRank(SECTS[0].id, 99)).toBe(0);

        const teachers = getSectsTeaching('lesser-qi-gathering-manual');
        expect(teachers.length).toBeGreaterThan(0);

        const admissible = findAdmissibleSects(0);
        expect(admissible.righteous.length + admissible.neutral.length + admissible.demonic.length)
            .toBeGreaterThan(0);
    });

    it('every sect that teaches an art is reported by whereToLearn', () => {
        for (const s of SECTS) {
            for (const id of s.teaches) {
                expect(whereToLearn(id).some(w => w.sectId === s.id)).toBe(true);
            }
        }
        expect(whereToLearn('no-such-art')).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('encounters', () => {
    it('every entry parses against EncounterEntrySchema', () => {
        for (const e of ENCOUNTERS) {
            expect(() => EncounterEntrySchema.parse(e), `encounter ${e.id}`).not.toThrow();
        }
    });

    it('ids are unique', () => {
        expectUniqueIds(ENCOUNTERS, 'encounter');
    });

    it('every ordinal range is inside 0..44 and well-formed', () => {
        for (const e of ENCOUNTERS) {
            expect(e.minOrdinal, `${e.id} min`).toBeGreaterThanOrEqual(0);
            expect(e.maxOrdinal, `${e.id} max`).toBeLessThanOrEqual(MAX_ORDINAL);
            expect(e.minOrdinal, `${e.id} inverted range`).toBeLessThanOrEqual(e.maxOrdinal);
            expect(e.weight).toBeGreaterThan(0);
            if (e.threatOrdinal !== null) {
                expect(e.threatOrdinal).toBeGreaterThanOrEqual(0);
                expect(e.threatOrdinal).toBeLessThanOrEqual(MAX_ORDINAL);
            }
        }
    });

    it('summary templates declare exactly the tokens they use', () => {
        for (const e of ENCOUNTERS) {
            const used = new Set([...e.summaryTemplate.matchAll(/\{(\w+)\}/gu)].map(m => m[1]));
            const declared = new Set(e.tokens);
            for (const token of used) {
                expect(declared.has(token), `${e.id} uses undeclared token {${token}}`).toBe(true);
            }
            for (const token of declared) {
                expect(used.has(token), `${e.id} declares unused token ${token}`).toBe(true);
            }
            expect(e.tokens.length, `${e.id} has no facts to fill`).toBeGreaterThan(0);
        }
    });

    it('summaries are factual statements, not narration', () => {
        for (const e of ENCOUNTERS) {
            // Second person and first person both mean the content is trying to
            // narrate. The agent narrates; the engine reports.
            expect(/\byou\b|\byour\b|\bI\b/i.test(e.summaryTemplate), `${e.id} narrates`).toBe(false);
            expect(e.summaryTemplate.length).toBeGreaterThan(40);
        }
    });

    it('covers the whole playable ladder with something at every ordinal', () => {
        for (let o = 0; o <= CONTENT_MAX_ORDINAL; o++) {
            expect(getEncountersForOrdinal(o).length, `no encounter available at ordinal ${o}`)
                .toBeGreaterThan(0);
        }
    });

    it('offers both danger and opportunity at low and high realms', () => {
        for (const ordinal of [0, 10, 20, 30, 40]) {
            const pool = getEncountersForOrdinal(ordinal);
            expect(pool.some(e => e.threatOrdinal !== null), `no danger at ${ordinal}`).toBe(true);
            expect(pool.some(e => e.simEventKind === 'opportunity'), `no opportunity at ${ordinal}`).toBe(true);
        }
    });

    it('rollEncounter is deterministic, in-range, and filterable', () => {
        for (let o = 0; o <= CONTENT_MAX_ORDINAL; o++) {
            for (const sample of [0, 0.33, 0.66, 0.999999]) {
                const drawn = rollEncounter(o, sample);
                expect(drawn, `ordinal ${o} sample ${sample}`).toBeDefined();
                expect(drawn!.minOrdinal).toBeLessThanOrEqual(o);
                expect(drawn!.maxOrdinal).toBeGreaterThanOrEqual(o);
                expect(rollEncounter(o, sample)!.id).toBe(drawn!.id);
            }
        }

        const opportunity = rollEncounter(10, 0.5, { kind: 'opportunity' });
        expect(opportunity?.kind).toBe('opportunity');

        const uninterrupted = rollEncounter(10, 0.5, { interrupts: false });
        expect(uninterrupted?.interrupts).toBe(false);

        const nearThreat = rollEncounter(20, 0.5, { maxThreatGap: 0 });
        if (nearThreat && nearThreat.threatOrdinal !== null) {
            expect(nearThreat.threatOrdinal).toBeLessThanOrEqual(20);
        }
    });

    it('weighted draws spread across the eligible table', () => {
        const seen = new Set<string>();
        for (let i = 0; i < 200; i++) seen.add(rollEncounter(10, i / 200)!.id);
        expect(seen.size).toBeGreaterThan(5);
    });

    it('fillSummary substitutes declared tokens and flags missing ones', () => {
        const entry = getEncounter('enc-roadside-bandits')!;
        const filled = fillSummary(entry, {
            count: 4,
            place: 'the Third Ford',
            threatRank: 'Qi Condensation Layer 3',
            stones: 20
        });
        expect(filled).toContain('4 bandits');
        expect(filled).toContain('the Third Ford');
        expect(filled).not.toContain('{');
        expect(missingTokens(entry, { count: 4 })).toEqual(['place', 'threatRank', 'stones']);

        // An unfilled token is left visible rather than blanked.
        expect(fillSummary(entry, {})).toContain('{count}');
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the Late Age: provenance and the exploration loop', () => {
    it('marks every technique with a source, and the marked ids all resolve', () => {
        for (const t of TECHNIQUES) {
            expect(['taught', 'ruin', 'grave']).toContain(t.provenance);
            expect(t.sourceNote.length, `${t.id} sourceNote`).toBeGreaterThan(40);
        }
        for (const id of [...RUIN_ONLY_TECHNIQUE_IDS, ...GRAVE_ONLY_TECHNIQUE_IDS]) {
            expect(getTechnique(id), `provenance set names unknown technique ${id}`).toBeDefined();
        }
        expect(getTechniquesByProvenance('ruin').length).toBeGreaterThan(10);
        expect(getTechniquesByProvenance('grave').length).toBeGreaterThan(0);
    });

    it('teaches a chaos-grade art nowhere below the top of the world', () => {
        // This used to assert that no chaos art anywhere is taught, which was
        // the Late Age rule applied one step too far. The rule is that the last
        // age's height is out of reach of THIS age's houses - and the four
        // bodies at the top of the world are not this age's houses in the sense
        // that matters: each of them has somebody standing in the band the book
        // is written for, which is precisely what nobody else has.
        //
        // So the assertion is now the one that was actually intended. A chaos
        // art is either out of a ruin or a grave, or it is one of the four
        // roads to the top of the ladder, each held by exactly one of the four
        // bodies that could hold one. Holding it is still not the same as
        // handing it over: see `THE_DEEPEST_ROADS` for the one or two lent
        // copies and the one teacher, sometimes, at each of the three apexes.
        const deepRoadIds = new Set(THE_DEEPEST_ROADS.map(r => r.techniqueId));
        for (const t of TECHNIQUES.filter(x => x.grade === 'chaos')) {
            if (deepRoadIds.has(t.id)) continue;
            expect(t.provenance, `${t.id} cannot be taught in this age`).not.toBe('taught');
        }

        // And each of the four is on exactly one house's shelf, or on none at
        // all where the holder is an apex with no sect row - which is a fact
        // about the register's tables rather than about the world, and the
        // holding is recorded either way.
        for (const road of THE_DEEPEST_ROADS) {
            const houses = SECTS.filter(s => s.teaches.includes(road.techniqueId));
            expect(houses.length, `${road.techniqueId} is on ${houses.length} shelves`)
                .toBeLessThanOrEqual(1);
            if (houses.length === 1) expect(houses[0].id).toBe(road.factionId);
        }
    });

    it('never lets a sect teach something only a ruin holds', () => {
        for (const s of SECTS) {
            for (const id of s.teaches) {
                expect(getTechnique(id)!.provenance, `${s.id} teaches recovered-only art ${id}`)
                    .toBe('taught');
            }
        }
    });

    it('puts most of the upper ladder behind digging rather than teaching', () => {
        const upper = TECHNIQUES.filter(t => ['heaven', 'immortal', 'chaos'].includes(t.grade));
        const recovered = upper.filter(t => t.provenance !== 'taught');
        expect(recovered.length / upper.length,
            'the Late Age means most high-grade arts have no living teacher')
            .toBeGreaterThan(0.4);
        expect(getRecoveredTechniques().length).toBe(
            getTechniquesByProvenance('ruin').length + getTechniquesByProvenance('grave').length
        );
    });

    it('recovers rather than invents every high-grade alchemy method', () => {
        for (const r of RECIPES) {
            const grade = getPill(r.producesPillId)!.grade;
            if (grade === 'immortal' || grade === 'chaos') {
                expect(r.provenance, `${r.id} must be recovered, not devised`).toBe('recovered');
            }
            expect(r.sourceNote.length).toBeGreaterThan(40);
        }
        for (const id of RECOVERED_RECIPE_IDS) {
            expect(getRecipe(id), `recovered set names unknown recipe ${id}`).toBeDefined();
        }
        expect(getRecoveredRecipes().length).toBe(RECOVERED_RECIPE_IDS.size);
    });

    it('makes the Grain Abstinence formula a dig rather than a purchase', () => {
        const recipe = getRecipesForPill(GRAIN_ABSTINENCE_PILL_ID)[0];
        expect(recipe.provenance).toBe('recovered');
    });

    it('keeps ruins and graves a major weighted category across the ladder', () => {
        for (const ordinal of [0, 5, 10, 20, 30, 40, 44]) {
            expect(ruinWeightShare(ordinal), `digging is marginal at ordinal ${ordinal}`)
                .toBeGreaterThan(0.2);
        }
        const digging = ENCOUNTERS.filter(e => e.kind === 'ruin' || e.kind === 'grave');
        expect(digging.length).toBeGreaterThanOrEqual(20);
    });

    it('makes ruins dangerous in specific ways, not just inhabited', () => {
        const required = [
            'enc-guardian-formation-running',
            'enc-corpse-still-cultivating',
            'enc-inheritance-trial-dead-sect',
            'enc-seal-opened-wrong',
            'enc-formation-locked-door'
        ];
        for (const id of required) {
            const entry = getEncounter(id);
            expect(entry, `missing ruin hazard ${id}`).toBeDefined();
            expect(entry!.summaryTemplate.length).toBeGreaterThan(60);
        }
    });

    it('offers ordinary, unremarkable ruins from ordinal zero', () => {
        const lowRuins = getEncountersForOrdinal(0).filter(e => e.kind === 'ruin' || e.kind === 'grave');
        expect(lowRuins.length, 'a beginner must be able to dig').toBeGreaterThanOrEqual(4);
        expect(lowRuins.some(e => e.tags.includes('ordinary'))).toBe(true);
    });

    it('gives ruins a payoff the living world cannot supply', () => {
        const early = getRuinLootTable(12);
        const late = getRuinLootTable(44);
        expect(late.techniques.length).toBeGreaterThan(early.techniques.length);
        expect(late.techniques.every(t => t.provenance !== 'taught')).toBe(true);
        expect(late.recipes.every(r => r.provenance === 'recovered')).toBe(true);
        expect(late.recipes.length).toBeGreaterThan(0);
        // Nothing in the ruin table is obtainable from a sect.
        for (const t of late.techniques) {
            expect(getSectsTeaching(t.id).length, `${t.id} is also taught`).toBe(0);
        }
    });

    it('carries the five standing powers of the region', () => {
        const powers: Record<string, string> = {
            'sect-stonewright-consortium': 'neutral',
            'sect-lantern-hall': 'righteous',
            'sect-the-severed': 'demonic',
            'sect-hollow-court': 'neutral',
            'sect-kiln-wardens': 'neutral'
        };
        for (const [id, alignment] of Object.entries(powers)) {
            const sect = getSect(id);
            expect(sect, `missing power ${id}`).toBeDefined();
            expect(sect!.alignment, `${id} alignment`).toBe(alignment);
            expect(sect!.description.length).toBeGreaterThan(120);
        }
        // The one that famously takes no applicants at all.
        expect(getSect('sect-kiln-wardens')!.recruits).toBe(false);
        // The Court does recruit, and the bar is the point: Void Refinement,
        // with evidence the last realm is reachable. Nothing below that door
        // exists, which is why it reads to the province as not recruiting.
        const court = getSect('sect-hollow-court')!;
        expect(court.recruits).toBe(true);
        expect(court.admissionOrdinal).toBe(29);
        // And they are excluded from anything a player could join.
        const joinable = findAdmissibleSects(44);
        expect(joinable.neutral).not.toContain('sect-kiln-wardens');
    });

    it('has the sects squatting in compounds they did not build', () => {
        let inherited = 0;
        let incomplete = 0;
        for (const s of SECTS) {
            expect(s.compound.formationNodesLit, `${s.id} lights more nodes than it holds`)
                .toBeLessThanOrEqual(s.compound.formationNodesTotal);
            expect(s.compound.remnant.length, `${s.id} needs a legible remnant`).toBeGreaterThan(40);
            if (s.compound.inherited) inherited++;
            if (s.compound.formationNodesLit < s.compound.formationNodesTotal) incomplete++;
            const integrity = formationIntegrity(s.id);
            expect(integrity).toBeGreaterThanOrEqual(0);
            expect(integrity).toBeLessThanOrEqual(1);
        }
        expect(inherited / SECTS.length, 'most sects inherited their ground').toBeGreaterThan(0.7);
        expect(incomplete, 'most sects cannot run their whole inheritance').toBeGreaterThan(SECTS.length / 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('qi, veins and the Late Age', () => {
    it('carries no trace of the discarded ash metaphysics', () => {
        // Qi is ordinary ambient spiritual energy pooled in veins. It is not
        // the settled remains of ascended lives, nothing is breathed twice, and
        // the world is not a sealed vessel with a proper name.
        const banned = [
            /settled ash/i,
            /unbreathed/i,
            /ash (falling|is coming down|has (not )?been breathed)/i,
            /breath(e|ed|ing) (the )?(dead|ash)/i,
            /falling lives?/i,
            /\bthe Vault\b/
        ];
        const corpus: { label: string; text: string }[] = [
            ...TECHNIQUES.map(t => ({ label: t.id, text: `${t.name} ${t.description} ${t.sourceNote}` })),
            ...PILLS.map(p => ({ label: p.id, text: `${p.name} ${p.description}` })),
            ...HERBS.map(h => ({ label: h.id, text: `${h.name} ${h.description}` })),
            ...ENCOUNTERS.map(e => ({ label: e.id, text: `${e.name} ${e.summaryTemplate} ${e.tags.join(' ')}` })),
            ...SECTS.map(s => ({ label: s.id, text: `${s.name} ${s.description} ${s.territory} ${s.compound.remnant}` }))
        ];
        for (const { label, text } of corpus) {
            for (const pattern of banned) {
                expect(pattern.test(text), `${label} still carries the ash conceit: ${pattern}`).toBe(false);
            }
        }
    });

    it('renamed the Ashwright Consortium and kept it in the seeding catalog', () => {
        expect(getSect('sect-stonewright-consortium')).toBeDefined();
        expect(getSect('sect-ashwright-consortium')).toBeUndefined();
        expect(getSect('sect-stonewright-consortium')!.name).toBe('Stonewright Consortium');
        // Rivalry symmetry survived the rename.
        for (const rival of getSect('sect-stonewright-consortium')!.rivals) {
            expect(getSect(rival)!.rivals).toContain('sect-stonewright-consortium');
        }
    });

    it('states the vein economy in the sect catalog rather than implying it', () => {
        const veinAware = SECTS.filter(s =>
            /vein/i.test(`${s.description} ${s.territory} ${s.compound.remnant}`));
        expect(veinAware.length, 'a sect is old because it holds a vein').toBeGreaterThanOrEqual(5);
        // The Kiln Wardens guard the deep vein at the world's root.
        expect(getSect('sect-kiln-wardens')!.description).toMatch(/vein/i);
    });

    it('puts contested qi in the encounter table', () => {
        const contested = ENCOUNTERS.filter(e => e.tags.includes('contested-qi'));
        expect(contested.length).toBeGreaterThanOrEqual(4);
        // Including the conclusion nobody defends out loud.
        expect(getEncounter('enc-cull-for-qi')).toBeDefined();
        // And the hard ceiling that ends most lives without anybody's fault.
        expect(getEncounter('enc-thin-region-ceiling')).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('ancestral records', () => {
    it('every faction has records, and the wall of names is never empty', () => {
        for (const s of SECTS) {
            const records = getSectAncestry(s.id);
            expect(records, `${s.id} has no ancestral records`).toBeDefined();
            expect(records!.ancestors.length, `${s.id} records no ancestors`).toBeGreaterThan(0);
            expect(records!.standingNote.length, `${s.id} standing note`).toBeGreaterThan(60);
            for (const a of records!.ancestors) {
                expect(['dead', 'ascended', 'dormant', 'lost']).toContain(a.fate);
                expect(a.yearsAgo).toBeGreaterThanOrEqual(0);
                expect(a.rememberedFor.length, `${s.id}: ${a.name}`).toBeGreaterThan(30);
            }
        }
        // No stray entries for factions that do not exist.
        for (const id of Object.keys(SECT_ANCESTRY)) {
            expect(getSect(id), `ancestry for unknown faction ${id}`).toBeDefined();
        }
    });

    it('keeps a living ancestor rare enough to define a sect', () => {
        const claiming = getSectsClaimingLivingAncestor();
        expect(claiming.length).toBeGreaterThanOrEqual(2);
        expect(claiming.length, 'this must stay rare').toBeLessThanOrEqual(6);
        const trueClaims = claiming.filter(id => SECT_ANCESTRY[id].claimIsTrue);
        // Four powers hold immortal ancestors: the two apexes are not sects, so
        // among sects it is Azure Cloud, Sweptground, Storm Tyrant and the Court.
        expect(trueClaims.length).toBeGreaterThanOrEqual(2);
        expect(trueClaims.length).toBeLessThanOrEqual(5);
    });

    it('has at least one false claim, with traces a rival could pay to find', () => {
        const liars = getSectsClaimingLivingAncestor()
            .filter(id => !SECT_ANCESTRY[id].claimIsTrue);
        expect(liars.length, 'sects lie about this').toBeGreaterThanOrEqual(1);
        for (const id of liars) {
            const audit = auditAncestralClaim(id)!;
            expect(audit.claimed).toBe(true);
            expect(audit.true).toBe(false);
            expect(audit.traces.length, `${id} lies without evidence`).toBeGreaterThanOrEqual(3);
            for (const trace of audit.traces) expect(trace.length).toBeGreaterThan(30);
        }
        // An honest claim audits clean rather than being unauditable.
        const honest = getSectsClaimingLivingAncestor()
            .filter(id => SECT_ANCESTRY[id].claimIsTrue && SECT_ANCESTRY[id].recency !== 'several_ages');
        expect(honest.length).toBeGreaterThan(0);
        for (const id of honest) expect(auditAncestralClaim(id)!.traces).toEqual([]);
        // A faction making no claim cannot be audited for one.
        expect(auditAncestralClaim('sect-hollow-bell-wanderers')).toBeUndefined();
    });

    it('puts the politics in the middle of the decay curve', () => {
        // A true claim whose gift is gone: every incentive to keep it unexamined.
        const middle = Object.entries(SECT_ANCESTRY)
            .filter(([, r]) => r.claimIsTrue && r.recency === 'several_ages' && r.partingGift?.intact === false);
        expect(middle.length, 'nobody is on the interesting part of the curve').toBeGreaterThanOrEqual(1);
        for (const [id, r] of middle) {
            expect(r.discoverableTraces.length, `${id} gift loss leaves no trace`).toBeGreaterThanOrEqual(3);
            expect(r.lastOffering, `${id} should have offered at least once`).not.toBeNull();
        }
        // And the house that sells the examination exists and says so.
        const ledger = getDaoHouse('house-ninefold-ledger')!;
        expect(ledger.services.some(s => /certif/i.test(s) && /ancest/i.test(s))).toBe(true);
        expect(getEncounter('enc-ancestral-claim-verification')).toBeDefined();
    });

    it('designates exactly one preeminent institution, and shows its gift', () => {
        const preeminent = getPreeminentSect();
        expect(preeminent, 'no sect holds the last crossing').toBeDefined();

        const recentIntact = Object.values(SECT_ANCESTRY)
            .filter(r => r.claimIsTrue && r.recency === 'recent' && r.partingGift?.intact);
        expect(recentIntact.length, 'exactly one preeminent sect').toBe(1);

        const records = getSectAncestry(preeminent!.id)!;
        const gift = getPartingGift(preeminent!.id)!;
        expect(gift.id).toMatch(/^artifact-/);
        expect(gift.description.length).toBeGreaterThan(120);
        expect(gift.reserveTerms.length, 'a reserve artifact is held, not wielded')
            .toBeGreaterThan(60);
        expect(gift.intact).toBe(true);

        // The crossing is recent, and dated.
        const ascended = records.ancestors.find(a => a.fate === 'ascended')!;
        expect(ascended.yearsAgo).toBeLessThanOrEqual(600);

        // Standing comes from the ancestor, not from its living members: it is
        // not the strongest sect in the catalog by power ordinal.
        const strongest = Math.max(...SECTS.map(s => s.powerOrdinal));
        expect(preeminent!.powerOrdinal).toBeLessThan(strongest);

        // The politics are recorded: rivals resent it, and someone is working
        // on what happens when the gift is spent.
        expect(records.standingNote.length).toBeGreaterThan(120);
        expect(records.lastOffering, 'a recent ancestor gets offered to').not.toBeNull();
    });

    it('models dormant ancestors as a break-glass decision with a stated cost', () => {
        const dormant = getDormantAncestors();
        expect(dormant.length, 'the dangerous kind must exist').toBeGreaterThanOrEqual(2);
        // The class is deliberately larger than it once was - everyone at the
        // top ordinal is sealed under a mountain somewhere - so rarity is
        // carried by `sealed-ancestors.ts` rather than by a small count here.
        expect(dormant.length, 'and stay countable').toBeLessThanOrEqual(12);
        for (const { sectId, dormant: d } of dormant) {
            expect(getSect(sectId), `dormant ancestor for unknown ${sectId}`).toBeDefined();
            expect(d.dormantYears).toBeGreaterThan(100);
            expect(d.wakeCondition.length, `${sectId} wake condition`).toBeGreaterThan(40);
            expect(d.wakeCost.length, `${sectId} wake cost`).toBeGreaterThan(40);
            expect(d.restingPlace.length).toBeGreaterThan(30);
            // A dormant ancestor is in the world, so the sect's records agree.
            const records = getSectAncestry(sectId)!;
            expect(records.ancestors.some(a => a.fate === 'dormant'), `${sectId} records`).toBe(true);
            // Dormant is not ascended: no offering channel, no parting gift.
            // A sect may hold both kinds at once, and several do: an ascended
            // ancestor who answers, a parting gift from them, and a sealed one
            // under the floor who never left. Dormancy couples to none of it.
        }
        // Most are hidden, which is what makes the threat invisible.
        const hidden = dormant.filter(d => !d.dormant.publiclyKnown);
        expect(hidden.length).toBeGreaterThan(dormant.length / 2);
        // And at least one is published, because publishing it is a deterrent.
        expect(dormant.some(d => d.dormant.publiclyKnown)).toBe(true);
    });

    it('makes an offering cost the principal and return very little', () => {
        const offerings = Object.entries(SECT_ANCESTRY)
            .filter(([, r]) => r.lastOffering !== null);
        expect(offerings.length).toBeGreaterThanOrEqual(3);
        for (const [id, r] of offerings) {
            const o = r.lastOffering!;
            expect(o.cost.length, `${id} offering cost`).toBeGreaterThan(40);
            expect(o.consequence.length, `${id} offering consequence`).toBeGreaterThan(60);
            expect(o.yearsAgo).toBeGreaterThan(0);
            // A few words, or nothing at all.
            if (o.response !== null) {
                expect(o.response.split(/\s+/).length, `${id} answer is not a few words`)
                    .toBeLessThanOrEqual(12);
            }
        }
        // Somebody got silence and recorded it.
        expect(offerings.some(([, r]) => r.lastOffering!.response === null)).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('Dao houses', () => {
    it('carries six to eight houses, each on a distinct principle', () => {
        expect(DAO_HOUSES.length).toBeGreaterThanOrEqual(6);
        expect(DAO_HOUSES.length).toBeLessThanOrEqual(8);
        const principles = new Set(DAO_HOUSES.map(h => h.principle));
        expect(principles.size, 'two houses share a principle').toBe(DAO_HOUSES.length);
    });

    it('every house is also a valid sect', () => {
        for (const h of DAO_HOUSES) {
            expect(() => SectSchema.parse(h), `house ${h.id}`).not.toThrow();
            expect(SECTS.includes(h), `${h.id} missing from SECTS`).toBe(true);
            expect(isDaoHouse(h.id)).toBe(true);
            expect(getDaoHouse(h.id)).toBe(h);
        }
        for (const s of SECTS) {
            if (!DAO_HOUSES.includes(s as never)) expect(isDaoHouse(s.id)).toBe(false);
        }
    });

    it('is ancient, which is the entire point', () => {
        for (const h of DAO_HOUSES) {
            expect(h.foundedYearsAgo, `${h.id} is not old enough to be a house`)
                .toBeGreaterThanOrEqual(1_000);
        }
    });

    it('reaches into civilisation outside combat, and names who depends on it', () => {
        for (const h of DAO_HOUSES) {
            expect(h.principleDescription.length, `${h.id} principle`).toBeGreaterThan(120);
            expect(h.civilReach.length, `${h.id} civil reach`).toBeGreaterThanOrEqual(4);
            expect(h.services.length, `${h.id} services`).toBeGreaterThanOrEqual(2);
            expect(h.dependents.length, `${h.id} dependents`).toBeGreaterThanOrEqual(2);
            expect(h.afterwardsClause.length, `${h.id} afterwards clause`).toBeGreaterThan(80);
            // Civil authority is stated in specifics, not as a power level.
            for (const line of [...h.civilReach, ...h.services, ...h.dependents]) {
                expect(line.length).toBeGreaterThan(20);
            }
        }
    });

    it('is not martially dominant: no house teaches mostly attack arts', () => {
        for (const h of DAO_HOUSES) {
            const taught = h.teaches.map(id => getTechnique(id)!);
            const attacks = taught.filter(t => t.category === 'attack').length;
            expect(attacks / taught.length, `${h.id} is a war sect wearing a robe`)
                .toBeLessThan(0.5);
        }
    });

    it('every house has a named counter, mostly held by a rival house', () => {
        let heldByRival = 0;
        for (const h of DAO_HOUSES) {
            expect(h.counter.name.length, `${h.id} counter`).toBeGreaterThan(4);
            expect(h.counter.description.length).toBeGreaterThan(80);
            expect(h.counter.heldBy, `${h.id} counters itself`).not.toBe(h.id);
            if (h.counter.heldBy === null) continue;
            const holder = getDaoHouse(h.counter.heldBy);
            expect(holder, `${h.id} counter held by unknown ${h.counter.heldBy}`).toBeDefined();
            expect(getCounterHouse(h.id)).toBe(holder);
            if (h.rivals.includes(holder!.id)) heldByRival++;
        }
        expect(heldByRival, 'counters should mostly sit with a rival')
            .toBeGreaterThanOrEqual(DAO_HOUSES.length - 1);
    });

    it('every house is genuinely bad at things and genuinely troubled', () => {
        for (const h of DAO_HOUSES) {
            expect(h.blindSpots.length, `${h.id} blind spots`).toBeGreaterThanOrEqual(4);
            expect(h.internalFactions.length, `${h.id} internal factions`).toBeGreaterThanOrEqual(2);
            expect(h.weaknesses.length, `${h.id} weaknesses`).toBeGreaterThanOrEqual(3);
            for (const line of [...h.blindSpots, ...h.weaknesses]) {
                expect(line.length).toBeGreaterThan(25);
            }
        }
    });

    it('has at least two houses standing on a predecessor, with a rewritten record', () => {
        const withSuccession = DAO_HOUSES.filter(h => h.succession !== null);
        expect(withSuccession.length).toBeGreaterThanOrEqual(2);
        for (const h of withSuccession) {
            const s = h.succession!;
            expect(getDestroyedDaoHouse(s.predecessorId), `${h.id} predecessor unknown`).toBeDefined();
            expect(s.officialVersion.length).toBeGreaterThan(80);
            expect(s.trueVersion.length).toBeGreaterThan(80);
            expect(s.officialVersion, `${h.id} record was not rewritten`).not.toBe(s.trueVersion);
            expect(s.discoverableTraces.length, `${h.id} truth is unreachable`).toBeGreaterThanOrEqual(2);
            expect(s.yearsAgo).toBeGreaterThan(0);

            const accounts = getSuccessionAccounts(h.id)!;
            expect(accounts.official).toBe(s.officialVersion);
            expect(accounts.truth).toBe(s.trueVersion);
            expect(accounts.predecessor!.id).toBe(s.predecessorId);
        }
        // At least one succession where nobody alive knows what happened.
        expect(DESTROYED_DAO_HOUSES.some(d => d.destroyedBy === null)).toBe(true);
    });

    it('leaves destroyed houses that are still load-bearing', () => {
        expect(DESTROYED_DAO_HOUSES.length).toBeGreaterThanOrEqual(1);
        expectUniqueIds(DESTROYED_DAO_HOUSES, 'destroyed house');
        for (const d of DESTROYED_DAO_HOUSES) {
            expect(d.destroyedYearsAgo).toBeGreaterThan(0);
            expect(d.officialVersion).not.toBe(d.trueVersion);
            expect(d.traces.length, `${d.id} left no traces`).toBeGreaterThanOrEqual(3);
            for (const trace of d.traces) expect(trace.length).toBeGreaterThan(25);
            if (d.destroyedBy !== null) {
                expect(getSect(d.destroyedBy), `${d.id} destroyed by unknown faction`).toBeDefined();
            }
            expect(d.fragmentTechniqueIds.length, `${d.id} left no discipline`).toBeGreaterThan(0);
            for (const id of d.fragmentTechniqueIds) {
                const technique = getTechnique(id);
                expect(technique, `${d.id} fragment ${id} does not exist`).toBeDefined();
                // A dead house has no living teacher, by definition.
                expect(technique!.provenance, `${id} must be recovered`).not.toBe('taught');
                expect(technique!.fragmentOf, `${id} is not attributed to ${d.id}`).toBe(d.id);
                expect(getSectsTeaching(id).length, `${id} is taught by a living sect`).toBe(0);
            }
        }
    });

    it('attributes every fragment technique to a house that actually existed', () => {
        const fragments = TECHNIQUES.filter(t => t.fragmentOf !== null);
        expect(fragments.length).toBeGreaterThanOrEqual(5);
        for (const t of fragments) {
            expect(getDestroyedDaoHouse(t.fragmentOf!), `${t.id} names unknown house ${t.fragmentOf}`)
                .toBeDefined();
            expect(getDestroyedDaoHouse(t.fragmentOf!)!.fragmentTechniqueIds).toContain(t.id);
        }
    });

    it('records disagreements about reality, including a three-way one', () => {
        expect(DAO_HOUSE_DISPUTES.length).toBeGreaterThanOrEqual(2);
        expectUniqueIds(DAO_HOUSE_DISPUTES, 'dispute');
        for (const d of DAO_HOUSE_DISPUTES) {
            expect(d.subject.length).toBeGreaterThan(20);
            expect(d.consequence.length, `${d.id} disagreement does nothing`).toBeGreaterThan(80);
            expect(d.positions.length).toBeGreaterThanOrEqual(2);
            const seen = new Set<string>();
            for (const p of d.positions) {
                expect(getSect(p.houseId), `${d.id} names unknown faction ${p.houseId}`).toBeDefined();
                expect(p.position.length, `${d.id} position for ${p.houseId}`).toBeGreaterThan(80);
                expect(seen.has(p.houseId), `${d.id} lists ${p.houseId} twice`).toBe(false);
                seen.add(p.houseId);
            }
        }
        const threeWay = DAO_HOUSE_DISPUTES.find(d => d.positions.length >= 3);
        expect(threeWay, 'fate against karma against neither is absolute').toBeDefined();
        for (const p of threeWay!.positions) {
            expect(getDisputesFor(p.houseId)).toContain(threeWay);
        }
    });

    it('puts the houses in the encounter tables as civil obstacles, not fights', () => {
        const houseEncounters = ENCOUNTERS.filter(e => e.kind === 'dao_house');
        expect(houseEncounters.length).toBeGreaterThanOrEqual(6);
        for (const e of houseEncounters) {
            expect(e.threatOrdinal, `${e.id} solves itself as a fight`).toBeNull();
            expect(e.tags).toContain('dao-house');
        }
        // The frightening part is what happens afterwards, and it is in the table.
        expect(houseEncounters.some(e => e.tags.includes('afterwards'))).toBe(true);
        expect(getEncounter('enc-house-member-killed')).toBeDefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('cross-catalog: spirit roots and technique availability', () => {
    it('offers only safe arts by default, and conflicting ones on request', () => {
        for (const root of SPIRIT_ROOTS) {
            const safe = findTechniquesForRoot(root.key, MAX_ORDINAL);
            expect(safe.length, `${root.key} has nothing to learn`).toBeGreaterThan(0);
            expect(safe.every(m => !m.conflicts), `${root.key} offered a conflicting art`).toBe(true);
            expect(safe.every(m => m.technique.element === null || m.matched)).toBe(true);

            const all = findTechniquesForRoot(root.key, MAX_ORDINAL, { includeConflicting: true });
            expect(all.length).toBeGreaterThanOrEqual(safe.length);
        }
    });

    it('makes mutated roots strong but starved of manuals', () => {
        const ice = findTechniquesForRoot('mutated_ice', MAX_ORDINAL).length;
        const lightning = findTechniquesForRoot('mutated_lightning', MAX_ORDINAL).length;
        for (const single of ['single_metal', 'single_wood', 'single_water', 'single_fire', 'single_earth'] as const) {
            const count = findTechniquesForRoot(single, MAX_ORDINAL).length;
            expect(count, `${single} should out-supply mutated roots`).toBeGreaterThan(ice);
            expect(count, `${single} should out-supply mutated roots`).toBeGreaterThan(lightning);
        }
    });

    it('leaves every root a viable elementless path from ordinal zero', () => {
        for (const root of SPIRIT_ROOTS) {
            const starting = findTechniquesForRoot(root.key, 0);
            expect(starting.length, `${root.key} starts with nothing`).toBeGreaterThan(0);
            expect(starting.some(m => m.technique.category === 'cultivation')).toBe(true);
        }
    });
});

describe('shown or read', () => {
    it('splits every provenance into one of the two channels', () => {
        // The rule is general. There is no art anywhere in the catalog that is
        // acquired by some third means, at any grade.
        for (const entry of TECHNIQUES) {
            const mode = transmissionModeOf(entry.provenance);
            expect(['shown', 'read']).toContain(mode);
            expect(mode).toBe(entry.provenance === 'taught' ? 'shown' : 'read');
        }
    });

    it('charges the read channel and never the shown one', () => {
        for (const entry of TECHNIQUES) {
            expect(learningCostMultiplier(entry, 'shown')).toBe(1);
            expect(learningCostMultiplier(entry, 'read')).toBeGreaterThan(1);
        }
    });

    it('makes the penalty depend on the art rather than on its grade alone', () => {
        // Opacity is what decides how much the page loses, so two arts of the
        // same grade may cost very different amounts to read - and an art that
        // states its own figure is not bound by the baseline for its grade.
        const plain = { grade: 'chaos' as const, opacity: 0.05 };
        const opaque = { grade: 'mortal' as const, opacity: 0.95 };
        expect(learningCostMultiplier(plain, 'read'))
            .toBeLessThan(learningCostMultiplier(opaque, 'read'));
        // And a plain chaos art beats the chaos baseline, which is the point of
        // being allowed to say so.
        expect(learningCostMultiplier(plain, 'read'))
            .toBeLessThan(learningCostMultiplier({ grade: 'chaos' as const }, 'read'));
    });

    it('grows more opaque with grade by default, without ever being a rule', () => {
        const grades = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const;
        for (let i = 1; i < grades.length; i++) {
            expect(GRADE_BASELINE_OPACITY[grades[i]])
                .toBeGreaterThan(GRADE_BASELINE_OPACITY[grades[i - 1]]);
        }
        for (const g of grades) {
            expect(GRADE_BASELINE_OPACITY[g]).toBeGreaterThan(0);
            expect(GRADE_BASELINE_OPACITY[g]).toBeLessThan(1);
        }
    });

    it('gives each rung above the Lid exactly one channel, and opposite ones', () => {
        const { falseImmortal, trueImmortal } = ABOVE_THE_LID_TRANSMISSION;
        expect(falseImmortal.ordinal).toBe(FALSE_IMMORTAL_ORDINAL);
        expect(trueImmortal.ordinal).toBe(TRUE_IMMORTAL_ORDINAL);
        // 45 is shown and never read; 46 is read and almost never shown. The
        // two rungs are the same rule seen from both ends.
        expect(falseImmortal.mode).toBe('shown');
        expect(trueImmortal.mode).toBe('read');

        // The sole teacher at 45 is a real person in the catalog, standing at
        // that rung, and there is no second one.
        const lu = getWanderer(falseImmortal.soleTeacher);
        expect(lu, 'the sole teacher must exist').toBeDefined();
        expect(lu!.lastOrdinal).toBe(FALSE_IMMORTAL_ORDINAL);
        expect(WANDERERS.filter(w => w.lastOrdinal === FALSE_IMMORTAL_ORDINAL)).toHaveLength(1);

        // And the read channel still names the exception, because the exception
        // is the general rule rather than a special case for immortals.
        expect(trueImmortal.theExceptionStillApplies).toMatch(/breaths/i);
    });

    it('authors arts to the top of the ladder and no further', () => {
        // It used to stop at the last crossing, on the reasoning that nothing
        // circulates above it. Both rungs above the Lid have exactly one
        // channel each, both channels are real, and the catalog now writes the
        // far end of them down - so the ceiling is the ladder's own top and the
        // scarcity is carried by how few arts are up there.
        expect(CONTENT_MAX_ORDINAL).toBe(MAX_ORDINAL);
        for (const entry of TECHNIQUES) {
            expect(entry.requiredOrdinal).toBeLessThanOrEqual(CONTENT_MAX_ORDINAL);
        }
        // And it is still an authoring ceiling rather than the Lid. A manual is
        // paper; the ceiling on what can be HELD is a different number about a
        // different kind of thing, and it did not move.
        expect(OBJECT_CEILING_BELOW_THE_LID).toBeLessThan(CONTENT_MAX_ORDINAL);
        expect(LAST_CROSSING_ORDINAL).toBeLessThan(CONTENT_MAX_ORDINAL);
    });

    it('puts something at each of the two rungs above the Lid, with reach declared', () => {
        for (const ordinal of [FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL]) {
            const arts = TECHNIQUES.filter(t => t.requiredOrdinal === ordinal);
            expect(arts.length, `nothing authored at ordinal ${ordinal}`).toBeGreaterThan(0);
            for (const a of arts) {
                // Reach decides whether the top of the ladder means anything:
                // measured, a single-target art up here does not take a
                // mobilised apex at all and a wide one takes it in two rounds.
                // An entry that left it off would be deciding that quietly.
                expect(a.reach, `${a.id} is above the Lid and declares no reach`).toBeDefined();
                // Nobody teaches at these rungs, in either direction.
                expect(a.provenance, `${a.id} has a living teacher`).not.toBe('taught');
            }
            // And at least one of them lands on a place rather than a person.
            expect(arts.some(a => a.reach === 'field'), `ordinal ${ordinal} is all single-target`)
                .toBe(true);
        }
    });
});
