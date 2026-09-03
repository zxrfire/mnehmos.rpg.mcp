/**
 * The Standing Register's section on everything the world can track as a thing.
 *
 * A VIEW, like the rest of the register: nothing here authors anything, every
 * row is read off a catalog or off the engine function that already decides the
 * question, and a content edit moves the page without anybody opening this file.
 *
 * IT LIVES IN ITS OWN MODULE for the reason `register-structural-repair-
 * medicine.ts` gives: `register.ts` is three hundred kilobytes, and a section
 * that is one build call and one render call is a section nobody has to go
 * inside that file to add.
 *
 * ── WHY THIS IS NOT THE OBJECTS TAB ──────────────────────────────────────
 *
 * The Objects tab is the artifact catalog and the two immortal objects: things
 * with a `power` rating, sorted on it, because for those the ordering IS the
 * argument. That is one `ObjectKind` out of ten. The engine's own notion of a
 * tracked thing is `ObjectRecord` in `engine/world/possessions.ts`, and it
 * covers manuals, medicine, ingredients, comprehension materials, lots of
 * currency, graves and ground - none of which has a power rating, none of which
 * belongs in a table sorted on one, and every one of which is a row somebody
 * can hold, lose, steal and be asked about two centuries later.
 *
 * So this is the other question: NOT how hard does it hit, but what kinds of
 * thing exist, how many of each are catalogued, and how is each one kept.
 *
 * ── THE ONE LINE EVERYTHING IS ORGANISED ON ──────────────────────────────
 *
 * `docs/world/things/items.md` states the single decision that governs every item in
 * the world, and it is not value:
 *
 *     COUNTED   a holder and a number. Nobody cares which one you took.
 *     TRACKED   a row with a holder, a provenance and a story about how it was
 *               got. The test is whether this specific object moving is an
 *               event somebody should be able to find out about two centuries
 *               later.
 *
 * `ObjectSignificance` is the switch, and `mundane` is documented in
 * `possessions.ts` as the marker for a thing that gets no provenance at all.
 *
 * The same document makes a second claim, and it is the one worth MEASURING
 * rather than printing: a thing is cash-priced exactly where it is fungible and
 * barter-only exactly where it is singular, so the two boundaries are the same
 * boundary, and if they ever drift apart one of them is wrong. Two catalogs
 * answer both questions independently - pills through `pillCashPrice` and
 * `pillStorageModel`, repair medicine through `repairCashPrice` and
 * `repairStorageModel` - so the sheet joins them and reports agreement or names
 * the exceptions. Nothing here asserts that they agree. See {@link buildItemsRegister}.
 *
 * ── WHAT IS DELIBERATELY EMPTY ───────────────────────────────────────────
 *
 * Four of the ten kinds have no authored catalog: they are minted by the world
 * as it runs rather than written down in advance, and one has nothing behind it
 * at all. That is reported as an absence rather than hidden, because an absence
 * nobody has written down gets mistaken for a design decision - which is
 * exactly the failure `AGENTS.md` records under "what the engine does not model
 * yet". The kind table is typed `Record<ObjectKind, ...>`, so a kind added to
 * the engine fails this file to compile rather than quietly vanishing from the
 * page.
 */

import type { ObjectKind, ObjectSignificance } from '../engine/world/possessions.js';
import { PILLS, POTENCY_UNITS, NOT_REFINABLE_BELOW_THE_LID_PILL_IDS } from '../data/cultivation/pills.js';
import { HERBS } from '../data/cultivation/herbs.js';
import { RECIPES } from '../data/cultivation/recipes.js';
import { ARTIFACTS } from '../data/cultivation/artifacts.js';
import { IMMORTAL_ITEMS, THE_LAST_REALM_IS_UNBUYABLE } from '../data/cultivation/immortal-items.js';
import { TECHNIQUES } from '../data/cultivation/techniques.js';
import { LOST_MATERIALS } from '../data/cultivation/lost-ages.js';
import { SITES } from '../data/cultivation/inheritance-trials.js';
import {
    STRUCTURAL_REPAIR_MEDICINES,
    STRUCTURAL_REPAIR_HOLDINGS
} from '../data/cultivation/structural-repair-medicine.js';
import {
    pillCashPrice,
    pillStorageModel,
    COMMODITY_YEARS_OF_INCOME,
    yearsOfIncomeFor
} from '../engine/cultivation/buying-and-bartering-pills.js';
import { significanceOfPill } from '../engine/world/where-the-pills-actually-are.js';
import {
    repairStorageModel,
    significanceOfDose
} from '../engine/world/who-holds-the-structural-repair-medicine.js';
import { repairCashPrice } from '../engine/cultivation/what-structural-repair-medicine-can-reach.js';
import { MATERIAL_BANDS } from '../engine/world/single-use-dao-comprehension-materials.js';
import { pillBandOrdinal } from '../engine/cultivation/breakthrough.js';
import { OBJECT_CEILING_BELOW_THE_LID, rankName } from '../engine/cultivation/realms.js';
import { TechniqueGradeSchema } from '../schema/cultivation.js';

/**
 * The tier vocabulary, read off the contract rather than retyped.
 *
 * IT IS A VOCABULARY AND NOT A TOTAL ORDER. The first bands ascend; the top two
 * - immortal and chaos - are the same height and differ in variance, so nothing
 * here may rank one over the other. Read the words, never the index.
 */
const TIERS: readonly string[] = TechniqueGradeSchema.options;

/** A holder and a number, or a row with a history. The one line in `items.md`. */
export type KeptAs = 'counted' | 'tracked';

/**
 * One kind of thing the world can hold, and what the world has of it.
 *
 * `catalogued` is the count of authored instances, which is NOT the count of
 * things in a running world: a seeded world mints hundreds of manual rows off
 * 129 authored arts, and every grave in it is minted by somebody dying. Both
 * figures matter and they are different questions, so the column says which
 * one it is answering.
 */
export interface RegisterItemKind {
    kind: ObjectKind;
    /** What the kind is, in one line a reader can act on. */
    what: string;
    /** Where the authored rows are, or the module that mints them. */
    source: string;
    /** How many rows the catalogs hold. Zero where the world mints them. */
    catalogued: number;
    /** Counted, tracked, or both where the kind straddles the line. */
    keptAs: readonly KeptAs[];
    /** The tier axis this kind is graded on, or null where it has none. */
    gradeAxis: string | null;
    /** Whether a thing of this kind carries a combat rating. */
    ratedInPower: boolean;
    /** Where one comes from. */
    provenance: string;
    /** Who ends up holding one. */
    whoHolds: string;
}

/**
 * Which catalog a row was read out of.
 *
 * Carried explicitly rather than guessed back off the id: several catalogs mint
 * rows whose ids look alike, and a table that has to infer its own membership
 * is a table that will one day render somebody else's rows. A row says where it
 * came from, and the tables filter on that.
 *
 * THERE IS NO GROUP FOR EXTINCTION, AND THAT IS THE POINT. An extinct herb is a
 * herb with a property, so it is a row in the herb table carrying that property
 * - not a listing of its own. Splitting a table on a field means a reader has
 * to know the field exists before they can look in the right place, and it puts
 * the thing they were comparing against on another part of the page. The same
 * rule keeps the two objects that came down in the pill table rather than
 * beside it.
 */
export type ItemGroup =
    | 'pills'
    | 'repair medicine'
    | 'spirit herbs'
    | 'comprehension materials';

/**
 * One catalogued thing, in the columns that are common to every kind.
 *
 * Deliberately narrow. The per-catalog detail already has a home - pills carry
 * an effect and a toxicity, herbs a biome, artifacts an owner - and duplicating
 * all of it here would be a second version of five tables that can disagree
 * with the five. What this row carries is the answer to the four questions the
 * owner asked for and only those: what it is, how it is kept, where it comes
 * from, and the rung it is pitched at.
 */
export interface RegisterItemRow {
    kind: ObjectKind;
    group: ItemGroup;
    id: string;
    name: string;
    /** Grade or tier on whatever ladder this kind uses. Null where it has none. */
    grade: string | null;
    /**
     * The rung this thing is pitched at, and it does NOT mean the same thing
     * across kinds - which is why `pitchNote` travels with it. On a pill it is
     * the realm the medicine is made for; on a herb it is the rung below which
     * the ground it grows on kills you; on a repair dose it is the last break it
     * reaches; on a material it is the height understanding it carries somebody
     * to; on an artifact it is a combat rating. Flattening those into one
     * column without saying so would be the sheet inventing a comparison.
     */
    pitchedAt: number | null;
    pitchNote: string;
    significance: ObjectSignificance | null;
    keptAs: KeptAs;
    /** Spirit stones, or null where money is not the medium. */
    price: number | null;
    /** Why there is no figure, where there is not one. */
    priceNote: string;
    provenance: string;
    detail: string;
}

/**
 * Whether the counted/tracked line and the cash/barter line are the same line.
 *
 * Measured per catalog rather than asserted anywhere. `agree` counts the rows
 * where cash-priced and counted coincide (in either direction); `drift` names
 * every row where they do not, and an empty `drift` is the claim holding rather
 * than the claim being restated.
 */
export interface ItemBoundary {
    catalog: string;
    rows: number;
    agree: number;
    drift: { id: string; name: string; priced: boolean; counted: boolean }[];
}

export interface RegisterItems {
    counts: {
        kinds: number;
        kindsWithACatalog: number;
        catalogued: number;
        tracked: number;
        counted: number;
    };
    kinds: RegisterItemKind[];
    rows: RegisterItemRow[];
    boundaries: ItemBoundary[];
    /** True only where every catalog that answers both questions agrees. */
    boundariesAgree: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// THE KIND TABLE
//
// Typed against the engine's own union, so a kind added to `ObjectKind` breaks
// the build here instead of silently dropping off the page. That is the whole
// reason the table is a Record rather than an array.
// ─────────────────────────────────────────────────────────────────────────

type KindFacts = Omit<RegisterItemKind, 'kind' | 'catalogued'> & { catalogued: () => number };

const KINDS: Record<ObjectKind, KindFacts> = {
    artifact: {
        what: 'A thing that changes what you can survive. The only kind rated on the ladder people stand on.',
        source: 'data/cultivation/artifacts.ts, and the two objects in immortal-items.ts',
        catalogued: () => ARTIFACTS.length + IMMORTAL_ITEMS.length,
        // Both, and the exceptions are the three rows at the bottom of the
        // table whose own descriptions say several hundred exist. Those are
        // KINDS rather than objects, they carry `mundane`, and the seeder does
        // not seat one - see the banner in `engine/world/artifact-placement.ts`.
        keptAs: ['counted', 'tracked'],
        gradeAxis: 'power, 0 to the ceiling',
        ratedInPower: true,
        provenance: 'Forged below the Lid, sent down by somebody who crossed, or left as pieces of something that failed down here.',
        whoHolds: 'A house in its own vault, a person carrying it, or nobody - it is in the ground.'
    },
    manual: {
        what: 'An art written down. Paper, so it is the one thing under no rating ceiling at all.',
        source: 'data/cultivation/techniques.ts, made physical by engine/world/manuals.ts',
        catalogued: () => TECHNIQUES.length,
        keptAs: ['counted', 'tracked'],
        gradeAxis: 'the five grades, mortal to chaos',
        ratedInPower: false,
        provenance: 'Copied off a house shelf, bought at a stall beside the cooking pots, or read off a page out of a grave.',
        whoHolds: 'A sect library, a member the house granted a copy to, or whoever took it.'
    },
    pill: {
        what: 'The only reliable way to undo damage, and the reason a run has an economy at all.',
        source: 'data/cultivation/pills.ts and structural-repair-medicine.ts',
        catalogued: () => PILLS.length + STRUCTURAL_REPAIR_MEDICINES.length,
        keptAs: ['counted', 'tracked'],
        gradeAxis: 'the five grades, mortal to chaos',
        ratedInPower: false,
        provenance: 'Refined from herbs by a recipe, or - for the grades nobody below the Lid can make - sent down and never replaced.',
        whoHolds: 'A house shelf as a number, a house vault as a row, or a body that swallowed it.'
    },
    material: {
        what: 'Ingredients, and the comprehension pieces that are gone the moment they are understood.',
        source: 'data/cultivation/herbs.ts, lost-ages.ts, and engine/world/single-use-dao-comprehension-materials.ts',
        catalogued: () => HERBS.length + MATERIAL_BANDS.length,
        keptAs: ['counted', 'tracked'],
        gradeAxis: 'the five grades for herbs; the rung it carries to for a comprehension piece',
        ratedInPower: false,
        provenance: 'Picked where it grows, dug out of a place an older age left, or made above the Lid and sent down.',
        whoHolds: 'A forager, an alchemist, a house that cannot use it and will not sell it, or a ruin nobody has reached.'
    },
    currency: {
        what: 'Spirit stones, and only where a specific quantity came from somewhere worth remembering.',
        source: 'engine/world/possessions.ts, makeResourceLot',
        catalogued: () => 0,
        keptAs: ['counted', 'tracked'],
        gradeAxis: null,
        ratedInPower: false,
        provenance: 'A vein, a mine, a purse, a grave. The 108 stones out of an abandoned mine are one row; the stones somebody was paid last week are not tracked at all.',
        whoHolds: 'Anybody. A lot exists only where the story of where it came from does.'
    },
    token: {
        what: 'Proof of a thing rather than the thing: an admission token, a right of passage, a claim made portable.',
        source: 'no catalog',
        catalogued: () => 0,
        keptAs: ['tracked'],
        gradeAxis: null,
        ratedInPower: false,
        provenance: 'Nothing authors one yet. The kind exists on the record and the world does not mint any.',
        whoHolds: 'Nobody, currently.'
    },
    key: {
        what: 'What opens something that is shut. A seal key, a formation node, the thing a vault answers to.',
        source: 'no catalog',
        catalogued: () => 0,
        keptAs: ['tracked'],
        gradeAxis: null,
        ratedInPower: false,
        provenance: 'Nothing authors one yet, and the seals and vaults it would open are all described in prose on their holders.',
        whoHolds: 'Nobody, currently.'
    },
    corpse: {
        what: 'What is left, and what is on it. A grave is a location with an inventory rather than a person.',
        source: 'minted by engine/world/legacy.ts when somebody dies',
        catalogued: () => 0,
        keptAs: ['tracked'],
        gradeAxis: null,
        ratedInPower: false,
        provenance: 'Somebody died at a place, holding what they were holding. The late age is made of other people\'s failed runs.',
        whoHolds: 'The ground, until somebody digs.'
    },
    territory: {
        what: 'Ground, and the qi under it. Held, administered, and contested as three separate facts.',
        source: 'data/cultivation/regions.ts and governance-and-water-rights.ts',
        catalogued: () => 0,
        keptAs: ['tracked'],
        gradeAxis: null,
        ratedInPower: false,
        provenance: 'A grant from an apex, a court posting, or possession nobody has yet been strong enough to argue with.',
        whoHolds: 'An apex holds it, a court administers it, and a house sits on it. Those are three answers and they routinely differ.'
    },
    other: {
        what: 'The escape hatch on the record. Nothing in the world is filed under it.',
        source: 'no catalog',
        catalogued: () => 0,
        keptAs: ['tracked'],
        gradeAxis: null,
        ratedInPower: false,
        provenance: 'By construction, nothing. A row here would be a thing nobody had decided what to call.',
        whoHolds: 'Nobody.'
    }
};

/** The engine's kinds, in the order the record declares them. */
const KIND_ORDER = Object.keys(KINDS) as ObjectKind[];

// ─────────────────────────────────────────────────────────────────────────
// BUILD
// ─────────────────────────────────────────────────────────────────────────

const GRADE_WORD = (g: string): string => g;

/**
 * Every pill in the catalog, on the common columns.
 *
 * Both the storage model and the price come from the engine functions that
 * already decide them - never from a threshold restated here - which is what
 * makes the boundary measurement below worth anything.
 */
function pillRows(): RegisterItemRow[] {
    return PILLS.map(p => {
        const price = pillCashPrice(p);
        const band = pillBandOrdinal(p.grade);
        const sentDown = NOT_REFINABLE_BELOW_THE_LID_PILL_IDS.has(p.id);
        return {
            kind: 'pill' as const,
            group: 'pills' as const,
            id: p.id,
            name: p.name,
            grade: GRADE_WORD(p.grade),
            pitchedAt: band,
            pitchNote: 'the first rung of the realm the medicine is made for',
            significance: significanceOfPill(p),
            keptAs: (pillStorageModel(p) === 'count' ? 'counted' : 'tracked') as KeptAs,
            price,
            // Not "expensive": not for sale. The figure beside it is why, and
            // it is computed rather than asserted - how many years of their own
            // income somebody at the rank this pill is made for would have to
            // put aside, against the threshold where money stops being the
            // medium at all.
            priceNote: price === null
                ? `not for cash: ${Math.round(yearsOfIncomeFor(p))} years of income at its own rank, past the ${COMMODITY_YEARS_OF_INCOME}-year line`
                : '',
            provenance: sentDown
                ? 'sent down; nobody here can refine one'
                : 'refined from herbs, by a recipe somebody holds',
            detail: `${p.effect.replace(/_/g, ' ')} ${p.potency} ${POTENCY_UNITS[p.effect]}`
                + (p.toxicity > 0 ? `, toxicity ${p.toxicity}` : ', no toxicity')
        };
    });
}

/** The four repair medicines, on the same columns as everything else. */
function repairRows(): RegisterItemRow[] {
    return STRUCTURAL_REPAIR_MEDICINES.map(m => {
        const price = repairCashPrice(m);
        return {
            kind: 'pill' as const,
            group: 'repair medicine' as const,
            id: m.id,
            name: m.name,
            grade: GRADE_WORD(m.grade),
            pitchedAt: m.reachesUpToOrdinal,
            pitchNote: 'the last rung at which it still mends a break',
            significance: significanceOfDose(m),
            keptAs: (repairStorageModel(m) === 'count' ? 'counted' : 'tracked') as KeptAs,
            price,
            priceNote: price === null ? `terms: ${m.terms.replace(/_/g, ' ')}` : '',
            provenance: m.madeBelowTheLid
                ? `refined on this side, ${m.refinedPerCentury ?? 0} a century in the whole world`
                : 'sent down; the count only ever falls',
            detail: `mends ${m.mends.join(', ').replace(/_/g, ' ')}`
        };
    });
}

/** The extinctions, by the herb they took away. */
const EXTINCT_BY_HERB = new Map(LOST_MATERIALS.map(m => [m.herbId, m]));

/**
 * Every herb, extinct ones included and marked rather than filed elsewhere.
 *
 * An extinction is a property of a material, so it is columns on the material's
 * own row: it stops having a price, it stops being a count and becomes jars
 * somebody can name, and where it comes from stops being a biome and becomes
 * whatever an older age left behind. What no cell can hold - the recipes it
 * closed, the arts it fed, the object kinds nobody can make any more, and where
 * the last units are sitting - travels with the row underneath the table, in
 * {@link extinctionRecord}.
 */
function herbRows(): RegisterItemRow[] {
    return HERBS.map(h => {
        const gone = EXTINCT_BY_HERB.get(h.id);
        const left = gone ? gone.remaining.inArchives + gone.remaining.unfound : 0;
        return {
            kind: 'material' as const,
            group: 'spirit herbs' as const,
            id: h.id,
            name: h.name,
            grade: GRADE_WORD(h.grade),
            pitchedAt: h.harvestOrdinal,
            pitchNote: 'the rung below which the place it grows simply kills you',
            // An ingredient is bought, picked and used by the handful. The world
            // does not remember which stalk of qi grass went into which pill, and
            // `mundane` is what `possessions.ts` calls a thing that gets no
            // provenance at all. An extinct one is the opposite case: what is
            // left is a small number of named jars in named places, transfers of
            // which the Ninefold Ledger has certified, so each unit has a past.
            significance: (gone ? 'significant' : 'mundane') as ObjectSignificance,
            keptAs: (gone ? 'tracked' : 'counted') as KeptAs,
            price: gone ? null : h.value,
            priceNote: gone ? 'nothing grows any more, so no market and no restock' : '',
            provenance: gone
                ? `extinct; it grew on ${h.biome.replace(/_/g, ' ')} and nothing grows any more, so `
                    + 'what is left is what an older age put somewhere and did not come back for'
                : `grows on ${h.biome.replace(/_/g, ' ')}, draw weight ${h.rarityWeight}`,
            // Not the description. The herb catalog carries a sentence on every
            // row and forty-three of them turn this table into a wall - what a
            // reader wants HERE is the index, and the flavour is one file away.
            detail: gone
                ? `extinct - ${left} left, ${gone.remaining.inArchives} in archives and `
                    + `${gone.remaining.unfound} unfound across ${gone.remaining.placements.length} `
                    + `site${gone.remaining.placements.length === 1 ? '' : 's'}`
                : `${h.rarityWeight >= 100 ? 'common' : h.rarityWeight >= 25 ? 'uncommon' : h.rarityWeight >= 6 ? 'rare' : 'all but unobtainable'}`
        };
    });
}

/**
 * The two objects that came down, on the same columns as the pills.
 *
 * WHY THEY ARE IN THE PILL TABLE. `immortal` is a tier, and a tier is a column.
 * These sat in a listing of their own, which meant a reader comparing what an
 * object can do against what medicine can do had the two answers on different
 * parts of the page - and it is the arrangement `AGENTS.md` names outright as
 * the mistake to avoid: no parallel catalog for important things. The
 * Unbroken Pattern Pill is the worked example already on the sheet - an
 * immortal-grade dose sitting in the ordinary repair-medicine table with
 * `immortal` in its grade cell and nothing else marking it out.
 *
 * `pitchedAt` is null on purpose rather than for want of a number. Grade caps
 * the DESTINATION here, so each of these has three rungs and not one, and the
 * catalog states them in prose rather than as fields. A single figure in that
 * column would be the sheet inventing a comparison; the three are under the
 * table, where the catalog's own words are.
 */
function immortalRows(): RegisterItemRow[] {
    return IMMORTAL_ITEMS.map(i => ({
        // The engine files these under `artifact` - see the KIND table above,
        // which counts them there - and the form field says why one of them is
        // a pill and the other is not. What puts both in the pill table is the
        // tier, which is the column a reader is comparing on.
        kind: 'artifact' as const,
        group: 'pills' as const,
        id: i.id,
        name: i.name,
        grade: 'immortal',
        pitchedAt: null,
        pitchNote: '',
        significance: 'legendary' as ObjectSignificance,
        keptAs: 'tracked' as KeptAs,
        price: null,
        priceNote: 'not for cash: no price, no catalogue and no assay anywhere',
        provenance: 'sent down; nobody below the Lid can make one, so the count only ever falls',
        detail: `${i.form.replace(/_/g, ' ')} · ${i.effect.replace(/_/g, ' ')} · `
            + `${i.knownCount} of ${i.everKnown} ever known · higher ${i.knownByGrade.higher}, `
            + `middle ${i.knownByGrade.middle}, lower ${i.knownByGrade.lower}`
    }));
}

/**
 * The comprehension materials, by band rather than by instance.
 *
 * One row per band and the count beside it, because the instances are seeded
 * from the band by the engine and differ only in who ended up holding one. A
 * row per instance would be fifty rows saying the same thing seven ways.
 */
function materialRows(): RegisterItemRow[] {
    return MATERIAL_BANDS.map(b => ({
        kind: 'material' as const,
        group: 'comprehension materials' as const,
        id: `material-${b.forOrdinal}`,
        name: b.name,
        grade: null,
        pitchedAt: b.forOrdinal,
        pitchNote: 'the height understanding it carries somebody to, once',
        significance: (b.forOrdinal >= 32 ? 'legendary' : b.forOrdinal >= 24 ? 'significant' : 'notable') as ObjectSignificance,
        keptAs: 'tracked' as KeptAs,
        price: null,
        priceNote: 'not for cash: a favour owed, or another singular thing',
        provenance: 'made above the Lid and sent down, or out of a hole and made by nobody since',
        detail: `${b.inTheWorld} in the world at the start, single use`
    }));
}

/**
 * The two boundaries, joined and measured.
 *
 * Two catalogs answer "is there a cash price" and "is it a count or a row"
 * through separate engine functions, so the sheet can check the claim in
 * `items.md` rather than repeat it. Agreement in EITHER direction counts: a
 * priced thing that is counted agrees, an unpriced thing that is a row agrees,
 * and the two mixed cases are the drift.
 */
function measureBoundaries(): ItemBoundary[] {
    const measure = <T>(
        catalog: string,
        rows: readonly T[],
        id: (t: T) => string,
        name: (t: T) => string,
        priced: (t: T) => boolean,
        counted: (t: T) => boolean
    ): ItemBoundary => {
        const drift = rows
            .filter(t => priced(t) !== counted(t))
            .map(t => ({ id: id(t), name: name(t), priced: priced(t), counted: counted(t) }));
        return { catalog, rows: rows.length, agree: rows.length - drift.length, drift };
    };

    return [
        measure('pills', PILLS, p => p.id, p => p.name,
            p => pillCashPrice(p) !== null,
            p => pillStorageModel(p) === 'count'),
        measure('structural repair medicine', STRUCTURAL_REPAIR_MEDICINES, m => m.id, m => m.name,
            m => repairCashPrice(m) !== null,
            m => repairStorageModel(m) === 'count')
    ];
}

/** Build the section. Pure; reads catalogs and derives, decides nothing. */
export function buildItemsRegister(): RegisterItems {
    // NO SORT ANYWHERE IN HERE, AND ESPECIALLY NOT ON GRADE. The five bands are
    // not a total order at the top: `immortal` and `chaos` are peers - one
    // reliable, one as powerful with its effects drawn rather than chosen - so
    // anything that ranked them would be asserting a height difference that
    // does not exist. Rows appear in catalog order, which is stable and makes
    // no claim.
    const rows = [
        ...pillRows(),
        ...immortalRows(),
        ...repairRows(),
        ...herbRows(),
        ...materialRows()
    ];
    const kinds: RegisterItemKind[] = KIND_ORDER.map(kind => {
        const f = KINDS[kind];
        return {
            kind,
            what: f.what,
            source: f.source,
            catalogued: f.catalogued(),
            keptAs: f.keptAs,
            gradeAxis: f.gradeAxis,
            ratedInPower: f.ratedInPower,
            provenance: f.provenance,
            whoHolds: f.whoHolds
        };
    });
    const boundaries = measureBoundaries();

    return {
        counts: {
            kinds: kinds.length,
            kindsWithACatalog: kinds.filter(k => k.catalogued > 0).length,
            catalogued: kinds.reduce((n, k) => n + k.catalogued, 0),
            tracked: rows.filter(r => r.keptAs === 'tracked').length,
            counted: rows.filter(r => r.keptAs === 'counted').length
        },
        kinds,
        rows,
        boundaries,
        boundariesAgree: boundaries.every(b => b.drift.length === 0)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// RENDERING
//
// Kept here rather than in `renderRegisterHtml` so that adding this pane to the
// sheet is one call. The escaping helper is local for the same reason.
// ─────────────────────────────────────────────────────────────────────────

function esc(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const stones = (v: number): string => v.toLocaleString('en-US');

const keptChip = (kept: KeptAs): string =>
    `<span class="chip${kept === 'tracked' ? ' pin' : ''}">${kept}</span>`;

/**
 * One table of item rows, in the columns every kind shares.
 *
 * FIXED LAYOUT WITH DECLARED WIDTHS, and it is not decoration. Auto layout on
 * a hundred rows of free text sizes every column to its longest cell: measured,
 * the first draft produced a table 4,058px wide holding three rows, and a pill
 * table 13,280px tall for forty-one. A fixed table fits the sheet's own column
 * and wraps, which is what the reader wanted from a listing.
 */
function itemTable(caption: string, rows: readonly RegisterItemRow[]): string {
    if (!rows.length) return '';
    return `<div class="scroll"><table class="itemtbl">
  <caption>${esc(caption)}</caption>
  <!-- Names less, prose more. Price held fifteen per cent for a four-digit
       number while "Where it comes from" - the only column here anybody reads
       as a sentence - had twenty-four, and "Pitched at" was too narrow for the
       realm name it prints and overflowed into the column beside it. -->
  <colgroup><col style="width:23%"><col style="width:8%"><col style="width:18%"><col style="width:9%"><col style="width:9%"><col style="width:33%"></colgroup>
  <thead><tr><th>Name</th><th>Grade</th><th>Pitched at</th><th>Kept as</th><th>Price</th><th>Where it comes from</th></tr></thead>
  <tbody>${rows.map(r => `<tr>
    <td class="nm">${esc(r.name)}<span class="dim"> ${esc(r.detail)}</span></td>
    <td class="m">${r.grade === null ? '<span class="dim">none</span>' : esc(r.grade)}</td>
    <td class="n">${r.pitchedAt === null ? '<span class="dim">-</span>' : `${r.pitchedAt} <span class="dim">${esc(rankName(r.pitchedAt))}</span>`}</td>
    <td class="m">${keptChip(r.keptAs)}</td>
    <td class="q">${r.price === null ? `<span class="dim">${esc(r.priceNote)}</span>` : stones(r.price)}</td>
    <td class="q">${esc(r.provenance)}</td>
  </tr>`).join('')}</tbody>
</table></div>`;
}

/**
 * An id resolved to what people call it. Falls back to the id, visibly.
 *
 * A register that prints a slug at a reader has stopped being a document. The
 * extinction record used to print its site ids raw, which is the one column of
 * it a player could act on.
 */
const techniqueNameOf = (id: string): string => TECHNIQUES.find(t => t.id === id)?.name ?? id;
const recipeNameOf = (id: string): string => RECIPES.find(x => x.id === id)?.name ?? id;
const siteNameOf = (id: string): string => SITES.find(s => s.id === id)?.name ?? id;

/**
 * What each grade of a thing that came down actually reaches.
 *
 * THIS IS THE HALF A CELL CANNOT CARRY. The row above says the tier, the count
 * and where it came from; this says what a lower one does that a higher one
 * does not, which is the whole reason anybody cares which grade a holder has.
 * It sits directly under the table its rows are in rather than under a heading
 * of its own, because it is detail belonging to two rows and not a listing.
 */
function immortalGradeDetail(): string {
    return IMMORTAL_ITEMS.map(i => `<div class="objblk">
    <h3>${esc(i.name)} <span class="objmeta">${esc(i.form.replace(/_/g, ' '))} · ${esc(i.effect.replace(/_/g, ' '))} · ${i.knownCount} of ${i.everKnown} ever known</span></h3>
    <p class="objcount">higher ${i.knownByGrade.higher} · middle ${i.knownByGrade.middle} · lower ${i.knownByGrade.lower}</p>
    <dl class="grades">
      <dt>Higher</dt><dd>${esc(i.grades.higher)}</dd>
      <dt>Middle</dt><dd>${esc(i.grades.middle)}</dd>
      <dt>Lower</dt><dd>${esc(i.grades.lower)}</dd>
    </dl>
  </div>`).join('');
}

/**
 * What each extinction took with it, and where the last of the material is.
 *
 * THE ROW SAYS EXTINCT AND HOW MANY ARE LEFT. This says what went with it - an
 * extinction is not one loss, it is a list - and where the unfound units are
 * sitting, which is the difference between a wall and a search with an end.
 * None of it fits in a table cell and none of it may be dropped, so it travels
 * with the rows, immediately under the table they are in.
 */
function extinctionRecord(): string {
    const total = LOST_MATERIALS.reduce((n, m) => n + m.remaining.inArchives + m.remaining.unfound, 0);
    const unfound = LOST_MATERIALS.reduce((n, m) => n + m.remaining.unfound, 0);
    const byId = new Map(HERBS.map(h => [h.id, h.name]));

    const blocks = LOST_MATERIALS.map(m => {
        const closed = [
            m.closedRecipeIds.length
                ? `recipes it closed: ${m.closedRecipeIds.map(id => esc(recipeNameOf(id))).join(', ')}`
                : '',
            m.gatesTechniqueIds.length
                ? `arts it feeds: ${m.gatesTechniqueIds.map(id => esc(techniqueNameOf(id))).join(', ')}`
                : '',
            m.closedObjectKinds.length
                ? `what can no longer be made with it: ${m.closedObjectKinds.map(k => esc(k)).join('; ')}`
                : ''
        ].filter(Boolean);
        const where = m.remaining.placements.length
            ? m.remaining.placements.map(p =>
                `<li><strong>${p.units}</strong> at ${esc(siteNameOf(p.siteId))} - ${esc(p.note)}</li>`).join('')
            : '<li><span class="dim">nowhere anybody has placed</span></li>';
        return `<div class="objblk">
    <h3>${esc(byId.get(m.herbId) ?? m.herbId)} <span class="objmeta">extinct · ${m.remaining.inArchives} in archives · ${m.remaining.unfound} unfound</span></h3>
    <p class="objcount">${closed.length ? closed.join(' &middot; ') : 'nothing downstream is recorded against it'}</p>
    <p>${esc(m.remaining.whatIsKnownOfTheCount)}</p>
    <ul class="spendlist">${where}</ul>
  </div>`;
    }).join('');

    return `<h3 class="bandhead">What each extinction took with it <span>${LOST_MATERIALS.length}</span></h3>
  <p class="note"><strong>An extinction is not one loss, it is a list: the recipes it closed, the arts it fed, the object kinds nobody can make any more.</strong> ${total} units of the three exist in the world and ${unfound} of them are in ground nobody has opened. The figure is small on purpose - "nobody has any" is a wall, and a number with placements against it is a search with a destination and an end, where every unit somebody finds is one nobody else can ever have.</p>
  ${blocks}`;
}

/**
 * The pane, as HTML. Splice into the sheet inside a `div.pane`; it depends on
 * nothing else on the page.
 */
export function renderItemsSection(): string {
    const r = buildItemsRegister();
    const pitch = [...new Set(r.rows.filter(x => x.pitchNote).map(x => x.pitchNote))];
    const rowsOf = (group: ItemGroup): RegisterItemRow[] => r.rows.filter(x => x.group === group);

    // A zero means two different things and the chip says which. A kind whose
    // source is a module is minted by the world as it runs and is not empty;
    // a kind with no source at all has nothing behind it anywhere, and that is
    // the absence worth writing down.
    const zeroChip = (k: RegisterItemKind): string =>
        k.catalogued > 0 ? ''
            : k.source === 'no catalog'
                ? ' <span class="chip">nothing yet</span>'
                : ' <span class="chip">the world mints these</span>';

    const kindRows = r.kinds.map(k => `<tr>
    <td class="nm">${esc(k.kind)}${zeroChip(k)}<span class="dim"> ${esc(k.source)}</span></td>
    <td class="q">${esc(k.what)}</td>
    <td class="n">${k.catalogued || '<span class="dim">0</span>'}</td>
    <td class="m">${k.keptAs.map(keptChip).join(' ')}</td>
    <td class="m">${k.gradeAxis === null ? '<span class="dim">ungraded</span>' : esc(k.gradeAxis)}</td>
    <td class="q">${esc(k.whoHolds)}</td>
  </tr>`).join('');

    const boundaryRows = r.boundaries.map(b => `<tr>
    <td class="nm">${esc(b.catalog)}</td>
    <td class="n">${b.rows}</td>
    <td class="n">${b.agree}</td>
    <td class="q">${b.drift.length === 0
        ? '<span class="dim">the two lines coincide on every row</span>'
        : b.drift.map(d => `${esc(d.name)} is ${d.priced ? 'priced' : 'unpriced'} and ${d.counted ? 'counted' : 'a row'}`).join('; ')}</td>
  </tr>`).join('');

    return `
<section>
  <div class="sh"><h2>What the world can track</h2><span class="r">${r.counts.kinds} kinds &middot; ${r.counts.kindsWithACatalog} with a catalog</span></div>
  <p class="note"><strong>The artifact table is one of these ten kinds.</strong> It is on the Items tab, sorted on a combat rating, because for a thing that changes what you can survive the ordering is the argument. Every other kind of thing somebody can hold, lose, steal or be asked about two centuries later is here - and none of them has a power rating, which is exactly why none of them belongs in a table sorted on one.</p>
  <p class="note">The engine's own record of a thing is <em>ObjectRecord</em>, and these are its kinds. A row minted for a manual and a row minted for a grave are the same shape with different columns filled in: one owner field, one possessor field, one provenance chain, one claims list. There is no second table anywhere for important objects, and adding one is the mistake this arrangement exists to prevent.</p>
  <div class="scroll"><table class="itemtbl">
    <caption>Every kind of thing, and what the world has of it</caption>
    <!-- The Kind column has to hold a chip, and a chip is one unbreakable
         token: at sixteen per cent the widest of them hung fourteen pixels
         into the column beside it. -->
    <colgroup><col style="width:19%"><col style="width:24%"><col style="width:8%"><col style="width:9%"><col style="width:16%"><col style="width:24%"></colgroup>
    <thead><tr><th>Kind</th><th>What it is</th><th>Catalogued</th><th>Kept as</th><th>Graded on</th><th>Who holds one</th></tr></thead>
    <tbody>${kindRows}</tbody>
  </table></div>
  <p class="note"><strong>Catalogued is not how many exist.</strong> It counts authored rows. A seeded world mints a manual row for every copy on every shelf off ${TECHNIQUES.length} authored arts, and every grave in it is minted by somebody dying, so a zero on a kind marked <span class="chip">the world mints these</span> is not an empty kind. A zero marked <span class="chip">nothing yet</span> is: ${r.kinds.filter(k => k.source === 'no catalog').map(k => k.kind).join(', ')} exist on the record and nothing anywhere puts one in the world. That is an absence rather than a design decision, and it is stated here so it does not get mistaken for one.</p>
</section>

<section>
  <div class="sh"><h2>Counted or tracked</h2><span class="r">the single decision that governs every item</span></div>
  <p class="note"><strong>Some things are a quantity; some are a row with a history.</strong> A counted thing is a holder and a number, because nobody cares which one you took. A tracked thing is a row with a holder, a provenance and a story about how it was got. The test is not value in stones: it is whether the movement of this specific object is an event somebody should be able to find out about two centuries later.</p>
  <p class="note">Getting it wrong is expensive in both directions. Track the fungible and the tables are useless and the queries slow; aggregate the singular and the world forgets things it should never forget. The switch is <em>significance</em> on the record itself, and <em>mundane</em> is documented as the marker for a thing that gets no provenance at all - which is why a second field beside it would be two sources of truth waiting to disagree.</p>
  <p class="note"><strong>The claim worth checking, rather than repeating: a thing is cash-priced exactly where it is fungible and barter-only exactly where it is singular.</strong> Two catalogs answer both questions through separate engine functions that know nothing about each other, so the sheet joins them. ${r.boundariesAgree
      ? 'On every row of both, the two lines coincide. That is the claim holding, measured, and if a catalog edit ever moved one line without the other this table would say so instead of the prose going quietly stale.'
      : 'They do not coincide everywhere, and the exceptions are named below. One of the two lines is wrong.'}</p>
  <div class="scroll"><table class="itemtbl">
    <caption>The two boundaries, joined</caption>
    <colgroup><col style="width:28%"><col style="width:9%"><col style="width:9%"><col style="width:54%"></colgroup>
    <thead><tr><th>Catalog</th><th>Rows</th><th>Agree</th><th>Where they part</th></tr></thead>
    <tbody>${boundaryRows}</tbody>
  </table></div>
  <p class="note">Of the ${r.rows.length} catalogued things listed below, ${r.counts.counted} are kept as a count and ${r.counts.tracked} as a row.</p>
</section>

<section>
  <div class="sh"><h2>Every catalogued thing</h2><span class="r">${r.rows.length} rows &middot; by kind</span></div>
  <p class="note"><strong>The <em>pitched at</em> column is a rung, and it does not mean the same thing twice.</strong> ${esc(pitch.map(p => p.replace(/^the /, '')).join('; '))}. They are printed in one column because they are all positions on the one ladder and a reader wants them comparable, and they are annotated because flattening them silently would be the sheet inventing a comparison the engine does not make.</p>
  <p class="note"><strong>The tier column is one vocabulary and the top of it is a tie.</strong> ${TIERS.slice(0, -2).join(', ')}, then ${TIERS.slice(-2).join(' and ')} - the ones before them ascend, and the last two are peers rather than a further two steps. An immortal-grade thing is reliable and uniformly good; a chaos-grade one is as powerful and its effects are drawn rather than chosen, so it can go badly. Nothing on this page is sorted on the tier, because a sort would have to put one of those two above the other.</p>
  ${itemTable(`Pills - ${rowsOf('pills').length} of them, the only reliable way to undo damage, and the ${IMMORTAL_ITEMS.length} things that came down that nobody here can make`, rowsOf('pills'))}
  ${immortalGradeDetail()}
  <p class="note"><strong>Grade caps the destination, not the distance.</strong> Every grade of the two objects above performs the same single crossing - the top rung of one realm to the first rung of the next - and what a higher grade buys is permission to perform it further up the ladder. That is why the <em>pitched at</em> column is empty on those two rows: each of them is pitched at three rungs, one per grade, and the catalog states them:</p>
  <ul class="spendlist">${THE_LAST_REALM_IS_UNBUYABLE.theCeilings.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
  <p class="note">${esc(THE_LAST_REALM_IS_UNBUYABLE.theAbsolute)} Who is holding one is on the Items tab, and what each house holds altogether is on Holdings.</p>
  ${itemTable(`Structural repair medicine - ${rowsOf('repair medicine').length}, for a cultivator who crossed and arrived broken`, rowsOf('repair medicine'))}
  ${itemTable(`Comprehension materials - ${rowsOf('comprehension materials').length} bands, spent by being understood`, rowsOf('comprehension materials'))}
  ${itemTable(`Spirit herbs - ${rowsOf('spirit herbs').length}, the ingredient layer under all of it, ${LOST_MATERIALS.length} of them extinct`, rowsOf('spirit herbs'))}
  ${extinctionRecord()}
  <p class="note"><strong>A pill is only ever as obtainable as its rarest ingredient</strong>, which is where the real cost of the alchemy system lives. ${RECIPES.length} recipes turn the herbs above into the pills above; ${RECIPES.filter(x => x.provenance === 'recovered').length} of them exist only because somebody opened something that was sealed, and no recipe may name a herb this catalog does not hold.</p>
  <p class="note">Nothing on this side is rated above ${OBJECT_CEILING_BELOW_THE_LID} whatever kind it is, because an object rated at a rung lets whoever holds it strike at that rung. A manual is paper and is under no such rule, which is the one exception and the reason the arts have a sheet of their own. ${STRUCTURAL_REPAIR_HOLDINGS.length} opening holdings of repair medicine are recorded against named houses; who is holding what is on the Items tab, and what each house holds altogether is the Holdings tab.</p>
</section>`;
}
