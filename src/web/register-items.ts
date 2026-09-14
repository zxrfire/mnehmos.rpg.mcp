/**
 * The Standing Register's section on everything the world can track as a thing.
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
import {
    repairCashPrice,
    readAllRepairMedicine,
    ordinaryGradeCeiling,
    NOTHING_REPAIRS_ABOVE_ORDINAL
} from '../engine/cultivation/what-structural-repair-medicine-can-reach.js';
import {
    BEASTS,
    BEAST_MATERIALS,
    BEAST_TIDES,
    BEAST_CORE_ORDINAL,
    BEAST_CHANGE_ORDINAL,
    getBeast
} from '../data/cultivation/beasts.js';
import {
    bandOf,
    howAMaterialIsStored,
    significanceOf as significanceOfBeastMaterial
} from '../engine/world/hunting-a-spirit-beast.js';
import {
    CONVEYANCES,
    CONVEYANCE_RECIPES,
    TRACKED_CRAFT,
    conveyancesNobodyBuilds,
    craftAgeInYears,
    kindOfCraft
} from '../data/cultivation/what-a-house-moves-its-people-on.js';
import {
    REACH_IN_WALKING_DAYS,
    walkingDaysPerDay
} from '../engine/world/what-a-conveyance-does-to-a-journey.js';
import {
    coresRequired,
    requiredOrdinalForRecipe,
    totalComponentsRequired
} from '../engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import {
    WHAT_AN_ARTIFACT_IS_MADE_OF,
    whatWouldFill,
    type Recipe
} from '../data/cultivation/what-an-artifact-is-made-of.js';
import { REGIONS } from '../data/cultivation/regions.js';
import { MATERIAL_BANDS } from '../engine/world/single-use-dao-comprehension-materials.js';
import { whatAnArtCanRaiseTo } from '../engine/world/a-formation-stands-at-the-lower-of-the-art-and-the-builder.js';
import { pillBandOrdinal } from '../engine/cultivation/breakthrough.js';
import { OBJECT_CEILING_BELOW_THE_LID, rankName } from '../engine/cultivation/realms.js';
import { TechniqueGradeSchema } from '../schema/cultivation.js';
import { hoistConstantColumns, hoistedLine } from './register-constant-columns.js';
import { isSettledOnUse, RECORD_CAVEAT } from '../engine/cultivation/grade-spread.js';

/**
 * The tier vocabulary, read off the contract rather than retyped.
 */
const TIERS: readonly string[] = TechniqueGradeSchema.options;

/** A holder and a number, or a row with a history. The one line in `items.md`. */
export type KeptAs = 'counted' | 'tracked';

/**
 * One kind of thing the world can hold, and what the world has of it.
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
 */
export type ItemGroup =
    | 'pills'
    | 'repair medicine'
    | 'spirit herbs'
    | 'beast materials'
    | 'comprehension materials';

/**
 * One catalogued thing, in the columns that are common to every kind.
 */
export interface RegisterItemRow {
    kind: ObjectKind;
    group: ItemGroup;
    id: string;
    name: string;
    /** Grade or tier on whatever ladder this kind uses. Null where it has none. */
    grade: string | null;
    /**
     * The rung this thing is pitched at, and it does NOT mean the same thing across
     * kinds - which is why `pitchNote` travels with it. On a pill it is the realm
     * the medicine is made for; on a herb it is the rung below which the ground it
     * grows on kills you; on a repair dose it is the last break it reaches; on a
     * material it is the height understanding it carries somebody to; on an
     * artifact it is a combat rating. Flattening those into one column without
     * saying so would be the sheet inventing a comparison.
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

// THE KIND TABLE

/**
 * The arts that describe how to lay a formation, and how far up each one
 * reaches, read off the technique catalog.
 *
 * A formation has no catalog of its own - what exists is the road, and the two
 * arts currently on it are both sword arts, which is the whole of what "a sword
 * formation" is in this engine. Naming them here is the register's only way of
 * saying that without a second table to say it in.
 */
const ARTS_THAT_RAISE_ONE: string = (() => {
    const raisers = TECHNIQUES
        .map(t => ({ name: t.name, to: whatAnArtCanRaiseTo(t) }))
        .filter((r): r is { name: string; to: number } => r.to !== null)
        .sort((a, b) => a.to - b.to);
    if (raisers.length === 0) {
        return 'arts that describe the work, of which the catalog currently holds none';
    }
    return `${raisers.length} art${raisers.length === 1 ? '' : 's'} that describe the work: `
        + raisers.map(r => `${r.name}, to ${r.to}`).join('; ');
})();

type KindFacts = Omit<RegisterItemKind, 'kind' | 'catalogued'> & { catalogued: () => number };

const KINDS: Record<ObjectKind, KindFacts> = {
    artifact: {
        what: 'A thing that changes what you can survive. The only kind rated on the ladder people stand on.',
        // THE TRACKED CRAFT ARE FILED HERE AND WERE NOT COUNTED HERE. A hull is
        // an `artifact` row with a conveyance kind in its data, made by the same
        // `makeObject` factory and rated on the same ladder - so a count that
        // left them out was reporting a smaller world than the catalogs hold.
        source: 'data/cultivation/artifacts.ts, the two objects in immortal-items.ts, '
            + 'and the named craft in what-a-house-moves-its-people-on.ts',
        catalogued: () => ARTIFACTS.length + IMMORTAL_ITEMS.length + TRACKED_CRAFT.length,
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
        what: 'Ingredients, grown and taken off a body, and the comprehension pieces that are gone the moment they are understood.',
        // The beast table was missing from this count for as long as this row
        // existed, which is the half of the ingredient layer somebody has to
        // kill something for. A cauldron takes both through one resolver and
        // does not ask which table a row came out of.
        source: 'data/cultivation/herbs.ts, the material table in beasts.ts, lost-ages.ts, '
            + 'and engine/world/single-use-dao-comprehension-materials.ts',
        catalogued: () => HERBS.length + BEAST_MATERIALS.length + MATERIAL_BANDS.length,
        keptAs: ['counted', 'tracked'],
        gradeAxis: 'the five grades for a herb or a beast material; the rung it carries to for a comprehension piece',
        ratedInPower: false,
        provenance: 'Picked where it grows, cut off something that had to be killed first, dug out of a place an older age left, or made above the Lid and sent down.',
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
    formation: {
        what: 'A made thing that stands where it was made and is never carried. Rated on the ladder people stand on, and it is the lower of the art that described it and the hand that laid it.',
        source: 'engine/world/a-formation-stands-at-the-lower-of-the-art-and-the-builder.ts',
        // Zero because no catalog authors a formation. What IS authored is the
        // art that raises one, and those are counted under `manual` with every
        // other art - there is no second catalog of formations and there must
        // not be one.
        //
        // THE LAST VERSION OF THIS COMMENT SAID NOBODY COULD RAISE ONE, and it
        // was true when it was written and false the day two sword arts joined
        // the formation road. So the sentence below is computed off the road
        // rather than typed, and cannot go stale the same way again.
        catalogued: () => 0,
        keptAs: ['tracked'],
        gradeAxis: 'power, the rung it was raised at',
        ratedInPower: true,
        provenance: `Laid by somebody standing at a rung, out of one of the ${ARTS_THAT_RAISE_ONE}. It never gets stronger afterwards and every hole in it costs a rung.`,
        whoHolds: 'Nobody holds one. A house may own the ground it stands on; a formation still running over a dead house is owned by nobody at all.'
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
            // WHAT THE PILL PROMISES, AND WHETHER THAT IS A PROMISE.
            detail: `${p.effect.replace(/_/g, ' ')} ${p.potency} ${POTENCY_UNITS[p.effect]}`
                + (p.toxicity > 0 ? `, toxicity ${p.toxicity}` : ', no toxicity')
                + (isSettledOnUse(p.grade) ? ' - settled on use, not on the label' : '')
        };
    });
}

/**
 * The four repair medicines, on the same columns as everything else.
 */
function repairRows(): RegisterItemRow[] {
    const readings = new Map(readAllRepairMedicine().map(r => [r.id, r]));
    return STRUCTURAL_REPAIR_MEDICINES.map(m => {
        const price = repairCashPrice(m);
        const worth = readings.get(m.id)?.weightInStones ?? null;
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
            // TERMS ON EVERY ROW, PRICED OR NOT. They used to appear only where
            // there was no cash figure, so the two rows that do have one lost
            // the fact entirely when their own table was folded in - and how a
            // thing changes hands is a different question from what it costs.
            priceNote: price === null ? `terms: ${m.terms.replace(/_/g, ' ')}` : '',
            provenance: m.madeBelowTheLid
                ? `refined on this side, ${m.refinedPerCentury ?? 0} a century in the whole world`
                : 'sent down; the count only ever falls',
            // WORTH AND TERMS, EACH SAID ONCE PER ROW AND NEVER BOTH IN THE SAME
            // CELL AS THE PRICE. `repairCashPrice` IS the weight in stones wherever
            // a thing is sold privately, so on those rows the price cell already
            // carries the worth and what is missing is the terms; on the rows money
            // cannot buy, the price cell carries the terms and what is missing is
            // the worth. Printing both columns unconditionally is how the merged
            // table said one number twice.
            detail: `mends ${m.mends.join(', ').replace(/_/g, ' ')}`
                + (price === null
                    ? (worth === null ? '' : ` · worth ${stones(worth)} stones`)
                    : ` · ${m.terms.replace(/_/g, ' ')}`)
        };
    });
}

/** The extinctions, by the herb they took away. */
const EXTINCT_BY_HERB = new Map(LOST_MATERIALS.map(m => [m.herbId, m]));

/**
 * Every herb, extinct ones included and marked rather than filed elsewhere.
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
            // which the Ninefold Karma Palace has certified, so each unit has a past.
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
 * How a material came off, in the words the difference is worth saying in.
 *
 * A kill and a scavenge reach the same row and are not the same act: one is a
 * thing somebody did to the animal and the other is what was left after
 * something else did. The bottom of the beast trade is the second and the third.
 */
const HOW_IT_CAME_OFF: Record<string, string> = {
    kill: 'the body has to be taken first',
    shed: 'shed, and picked up off the ground',
    scavenge: 'off a body something else finished'
};

/**
 * Every beast material, on the same columns as the herbs.
 *
 * The two catalogs are the same shape on purpose - grade, value, draw weight,
 * and a `harvestOrdinal` meaning the rung below which getting it kills you - so
 * they are printed on one set of columns and an alchemist comparing a core
 * against a root is reading one table's arithmetic twice rather than two.
 */
function beastMaterialRows(): RegisterItemRow[] {
    return BEAST_MATERIALS.map(m => {
        const source = getBeast(m.sourceBeastId);
        return {
            kind: 'material' as const,
            group: 'beast materials' as const,
            id: m.id,
            name: m.name,
            grade: GRADE_WORD(m.grade),
            pitchedAt: m.harvestOrdinal,
            pitchNote: 'the rung below which taking this off the body is not survivable',
            // Read off the engine rather than off `core`. Both are decided by
            // the grade, and a second rule here would be the copy that drifts.
            significance: significanceOfBeastMaterial(m),
            keptAs: howAMaterialIsStored(m) as KeptAs,
            price: m.value,
            priceNote: '',
            provenance: `${source?.name ?? m.sourceBeastId}; ${HOW_IT_CAME_OFF[m.taking] ?? m.taking}`,
            // The same index word the herb rows carry, off the same field, and
            // for the same reason: the catalog's own sentence is one file away
            // and ninety-one of them would be a wall.
            detail: (m.core ? 'a core, condensed cultivation - ' : '')
                + (m.rarityWeight >= 100 ? 'common' : m.rarityWeight >= 25 ? 'uncommon' : m.rarityWeight >= 6 ? 'rare' : 'all but unobtainable')
        };
    });
}

/**
 * The two objects that came down, on the same columns as the pills.
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
        ...beastMaterialRows(),
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
 */
function itemTable(caption: string, rows: readonly RegisterItemRow[]): string {
    if (!rows.length) return '';

    const HEADS = ['Name', 'Grade', 'Pitched at', 'Kept as', 'Price', 'Where it comes from'];
    // WIDTHS AND CELL CLASSES TRAVEL WITH THEIR COLUMN, not with its position,
    // because a hoisted column takes its slot out of the row and everything to
    // its right would otherwise be sized and aligned as its neighbour.
    const WIDTH = ['23%', '8%', '18%', '9%', '18%', '24%'];
    const CLASS = ['nm', 'm', 'n', 'm', 'q', 'q'];

    const cells = rows.map(r => [
        `${esc(r.name)}<span class="dim"> ${esc(r.detail)}</span>`,
        r.grade === null ? '<span class="dim">none</span>' : esc(r.grade),
        r.pitchedAt === null
            ? '<span class="dim">-</span>'
            : `${r.pitchedAt} <span class="dim">${esc(rankName(r.pitchedAt))}</span>`,
        keptChip(r.keptAs),
        r.price === null ? `<span class="dim">${esc(r.priceNote)}</span>` : stones(r.price),
        esc(r.provenance)
    ]);

    // A COLUMN SAYING ONE THING ON EVERY ROW IS SAID ONCE, ABOVE THE TABLE.
    // Measured here: the comprehension materials carried four such columns
    // across seven rows. Computed rather than written into the caption, so the
    // column returns by itself the moment a catalog edit makes two rows differ.
    const { heads, rows: body, kept, hoisted } = hoistConstantColumns(HEADS, cells);

    return `<div class="scroll"><table class="itemtbl">
  <caption>${esc(caption)}</caption>
  <!-- Names less, prose more. Price held fifteen per cent for a four-digit
       number while "Where it comes from" - the only column here anybody reads
       as a sentence - had twenty-four, and "Pitched at" was too narrow for the
       realm name it prints and overflowed into the column beside it.

       PRICE THEN TOOK EIGHTEEN, because it is not a number on the rows that
       matter. Twenty-five of the forty-three pills are not for sale and the
       cell holds the reason instead, which at nine per cent broke one
       character to a line and stood the row 238px tall. -->
  <colgroup>${kept.map(i => `<col style="width:${WIDTH[i]}">`).join('')}</colgroup>
  <thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${body.map(r => `<tr>${r.map((cell, i) =>
        `<td class="${CLASS[kept[i]]}">${cell}</td>`).join('')}</tr>`).join('')}</tbody>
</table></div>
${hoistedLine(hoisted, rows.length)}`;
}

/**
 * An id resolved to what people call it. Falls back to the id, visibly.
 */
const techniqueNameOf = (id: string): string => TECHNIQUES.find(t => t.id === id)?.name ?? id;
const recipeNameOf = (id: string): string => RECIPES.find(x => x.id === id)?.name ?? id;
const siteNameOf = (id: string): string => SITES.find(s => s.id === id)?.name ?? id;

/**
 * Where repair medicine stops, which is the one thing its rows cannot carry.
 */
const repairCeilings = (): { madeBelowTheLid: number; anythingAtAll: number } => ({
    madeBelowTheLid: ordinaryGradeCeiling(),
    anythingAtAll: NOTHING_REPAIRS_ABOVE_ORDINAL
});

/**
 * What each grade of a thing that came down actually reaches.
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

// ─────────────────────────────────────────────────────────────────────────
// THE THREE LISTINGS THE SHEET NEVER CARRIED
//
// Beast materials, what a house moves its people on, and what an artifact is
// made of. All three catalogs were authored, wired and invisible: the register
// named no export of any of them, so a reader browsing the sheet could not find
// out that the world has spirit boats in it, or that a core is an ingredient.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A table on the sheet's own columns, with any column that says one thing on
 * every row lifted out above it.
 *
 * The same construction `itemTable` uses, factored out because three more
 * tables wanted it. It carries no opinion about its columns - widths and cell
 * classes travel with the column rather than with its position, because a
 * hoisted column takes its slot out of every row.
 */
function gridTable(
    caption: string,
    heads: readonly string[],
    width: readonly string[],
    cls: readonly string[],
    cells: readonly string[][]
): string {
    if (!cells.length) return '';
    const hoist = hoistConstantColumns(heads, cells);
    return `<div class="scroll"><table class="itemtbl">
  <caption>${esc(caption)}</caption>
  <colgroup>${hoist.kept.map(i => `<col style="width:${width[i]}">`).join('')}</colgroup>
  <thead><tr>${hoist.heads.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${hoist.rows.map(r => `<tr>${r.map((cell, i) =>
        `<td class="${cls[hoist.kept[i]]}">${cell}</td>`).join('')}</tr>`).join('')}</tbody>
</table></div>
${hoistedLine(hoist.hoisted, cells.length)}`;
}

const words = (value: string): string => value.replace(/_/g, ' ');

/**
 * The cheapest grade a core exists at anywhere, read off the catalog.
 *
 * The conveyance bills carry a heaven-grade core inside an earth-grade carriage
 * and the file beside them explains it by this fact. Computed rather than
 * retyped, so the claim cannot outlive the catalog it is about.
 */
const LOWEST_CORE_GRADE: string =
    TIERS.find(g => BEAST_MATERIALS.some(m => m.core && m.grade === g)) ?? 'no grade at all';

const rung = (ordinal: number): string =>
    `${ordinal} <span class="dim">${esc(rankName(ordinal))}</span>`;

/** What the Late Age has left of a species, in the words the reader wants. */
const WHERE_IT_IS_LEFT: Record<string, string> = {
    open_world: 'ordinary ground, and duller than the old records say',
    thin_remnant: 'drawn-down ground, small and sparse on it',
    vein_only: 'only where the ground is still rich, so always somebody\'s problem',
    sealed_only: 'only inside places nothing has drawn on'
};

/** What it does to a vein, which is the half of it that is political. */
const WHAT_IT_DOES_TO_A_VEIN: Record<string, string> = {
    indifferent: '',
    follows: 'follows the richest ground and arrives in numbers',
    holds: 'holds one vein and will not be moved off it',
    drains: 'draws the vein down while it is there'
};

/** How much the world bothers to remember about one. */
const HOW_ONE_IS_HELD: Record<string, string> = {
    counted: 'counted',
    tracked: 'tracked',
    person: 'somebody'
};

/**
 * Every species, on the columns that say what kind of problem it is.
 *
 * Not `hard` and not `note`, both of which are a sentence per row and would
 * stand this table two hundred rows tall. What is here is the index: the rung,
 * which is the only measure of danger the catalog carries, and the four fields
 * that decide whether somebody can go and find one.
 */
function beastTable(): string {
    const cells = BEASTS.map(b => [
        `${esc(b.name)}<span class="dim"> ${esc(words(b.nature))} &middot; ${esc(b.ability.name)}</span>`,
        rung(b.ordinal),
        `<span class="chip${bandOf(b) === 'counted' ? '' : ' pin'}">${HOW_ONE_IS_HELD[bandOf(b)]}</span>`,
        esc(words(b.biome)),
        b.element === null ? '<span class="dim">nothing in particular</span>' : esc(b.element),
        b.groupSize === 1 ? '<span class="dim">alone</span>' : `${b.groupSize}`,
        esc([WHERE_IT_IS_LEFT[b.persistence] ?? b.persistence, WHAT_IT_DOES_TO_A_VEIN[b.veinRelation]]
            .filter(Boolean).join('; '))
    ]);
    return gridTable(
        `Spirit beasts - ${BEASTS.length} species, on the same ladder as everybody else`,
        ['Species', 'Rung', 'Held as', 'Ground', 'Made of', 'Together', 'Where it is still found'],
        ['23%', '13%', '9%', '13%', '8%', '7%', '27%'],
        ['nm', 'n', 'm', 'm', 'm', 'n', 'q'],
        cells
    );
}

/** A region id resolved to what it is called. Falls back to the id, visibly. */
const regionNameOf = (id: string): string => REGIONS.find(r => r.id === id)?.name ?? id;

/**
 * The tides, which are the reason several species are somewhere they were not.
 */
function tideBlocks(): string {
    const beastName = (id: string): string => getBeast(id)?.name ?? id;
    return BEAST_TIDES.map(t => `<div class="objblk">
    <h3>${esc(t.name)} <span class="objmeta">${esc(regionNameOf(t.regionId))} &middot; ordinal ${t.minOrdinal} to ${t.maxOrdinal} &middot; ${t.beastIds.length} species &middot; ${t.causeKnownLocally ? 'the cause is known locally' : 'the cause is not known locally'}</span></h3>
    <p class="objcount">${t.driverBeastId === null
        ? 'Nothing is at the back of it, so there is nothing to kill'
        : `At the back of it: ${esc(beastName(t.driverBeastId))}`} &middot; ${esc(t.beastIds.map(beastName).join(', '))}</p>
    <p>${esc(t.cause)}</p>
    <ul class="spendlist">${t.precursors.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    <p>${esc(t.whoAbsorbsIt)} ${esc(t.aftermath)}</p>
  </div>`).join('');
}

/** The rungs a house moves its people on, and what each one is for. */
function conveyanceTable(): string {
    const cells = CONVEYANCES.map(c => [
        `${esc(c.name)}<span class="dim">${c.drawnByBeast ? ' a beast in the traces' : ''}</span>`,
        c.grade === null ? '<span class="dim">made of nothing</span>' : esc(c.grade),
        c.range === 'crossing'
            ? 'anywhere there is a way'
            : `${esc(c.range)} <span class="dim">to ${REACH_IN_WALKING_DAYS[c.range]} walking days</span>`,
        `${c.heads}`,
        `<span class="chip${c.holding === 'tracked' ? ' pin' : ''}">${esc(c.holding)}</span>`,
        esc([
            `${walkingDaysPerDay(c)} walking day${walkingDaysPerDay(c) === 1 ? '' : 's'} a day`,
            c.crossesGroundThatCannotBeWalked ? 'crosses water and dead ground' : 'needs ground under it',
            c.seenComing ? 'read at the gate before anybody speaks' : 'arrives unremarked'
        ].join('; '))
    ]);
    return gridTable(
        `What a house moves its people on - ${CONVEYANCES.length} rungs, on foot at the bottom`,
        ['What it is', 'Grade', 'What it is for', 'Heads', 'Held as', 'What it does'],
        ['22%', '10%', '19%', '7%', '10%', '32%'],
        ['nm', 'm', 'q', 'n', 'm', 'q'],
        cells
    );
}

/**
 * The bills of materials, as blocks rather than as a table.
 *
 * A bill is a list and a table row is not, and the numbers a reader wants -
 * pieces, cores, work days - are already in the heading, so nothing here is
 * said twice.
 */
function conveyanceRecipeBlocks(): string {
    return CONVEYANCE_RECIPES.map(r => `<div class="objblk">
    <h3>${esc(r.name)} <span class="objmeta">${esc(r.grade)} grade &middot; ${totalComponentsRequired(r)} pieces, ${coresRequired(r)} of them cores &middot; ${stones(r.workDays)} work days for one pair of hands &middot; ${Math.round(r.baseSuccessRate * 100)}% at ordinal ${requiredOrdinalForRecipe(r)}</span></h3>
    <ul class="spendlist">${r.components.map(c =>
        `<li><strong>${c.count}</strong> ${esc(c.grade)} grade - ${esc(c.wants)}${c.mustBeCore ? ' <span class="chip">a core, and nothing else will do</span>' : ''}</li>`).join('')}</ul>
  </div>`).join('');
}

/**
 * The two worked recipes, and how many things fill each slot.
 *
 * The count is the point. A slot is a predicate rather than a list of ids, so
 * what fills it is resolved against the two ingredient catalogs at the moment
 * the question is asked - and a recipe whose slots each had one answer would be
 * a recipe nobody finishes.
 */
function artifactRecipeBlocks(): string {
    return (Object.entries(WHAT_AN_ARTIFACT_IS_MADE_OF) as [string, Recipe][])
        .map(([grade, recipe]) => `<div class="objblk">
    <h3>${esc(grade)} grade <span class="objmeta">${recipe.length} slots, and one thing fills one slot</span></h3>
    <ul class="spendlist">${recipe.map(slot => {
        const fills = whatWouldFill(slot);
        const cheapest = fills[0];
        return `<li>${esc(slot.what)} - <strong>${fills.length}</strong> things fill it`
            + (cheapest === undefined
                ? ''
                : `, cheapest ${esc(cheapest.name)} at ${stones(cheapest.value)} stone${cheapest.value === 1 ? '' : 's'}`)
            + '</li>';
    }).join('')}</ul>
  </div>`).join('');
}

/**
 * The named craft, on the Ledger rather than here.
 *
 * Every row names an owner, a mooring and an age, which is the ledger's
 * question exactly - what a conveyance IS belongs on the Objects tab with the
 * rest of the almanac. Exported so that adding it to the sheet is one call.
 */
export function renderTrackedCraftSection(): string {
    const mooring = (row: { data: Record<string, unknown> }): string =>
        typeof row.data.mooredAt === 'string' ? row.data.mooredAt : '';
    const cells = TRACKED_CRAFT.map(c => [
        `${esc(c.name)}<span class="dim"> ${esc(c.significance)}</span>`,
        `${c.power}`,
        esc(kindOfCraft(c)?.name ?? 'unknown kind'),
        c.ownerId === null
            ? '<span class="chip">nobody</span>'
            : esc(c.ownerName),
        esc(mooring(c)),
        `${craftAgeInYears(c)} <span class="dim">years</span>`
    ]);
    const unowned = TRACKED_CRAFT.filter(c => c.ownerId === null).length;
    return `
<section>
  <div class="sh"><h2>The craft that are objects</h2><span class="r">${TRACKED_CRAFT.length} rows &middot; ${new Set(TRACKED_CRAFT.map(c => c.ownerId).filter(Boolean)).size} houses</span></div>
  <p class="note"><strong>Everything else that moves a party is an amount; these are rows.</strong> A house has four shod carriages and could not say which of them went anywhere last spring. It can say where each of these is, who built it, and what it cost, and the rating in the second column is the ladder every other object on this tab is rated on.</p>
  ${gridTable(
        `Named craft - ${TRACKED_CRAFT.length}, ${TRACKED_CRAFT.filter(c => kindOfCraft(c)?.id === 'conv-spirit-boat').length} of them hulls`,
        ['Craft', 'Rated', 'What it is', 'Whose it is', 'Where it sits', 'Built'],
        ['20%', '8%', '15%', '19%', '28%', '10%'],
        ['nm', 'n', 'm', 'q', 'q', 'n'],
        cells
    )}
  ${unowned === 0
        ? ''
        : `<p class="note"><strong>${unowned} of them has no owner and no holder.</strong> That is a hole in the chain rather than a kind of ownership: somebody built it and somebody owned it, and the record carries neither. The four layers - owner, possessor, location, provenance - are kept apart so that a gap in one of them can be stated instead of guessed at.</p>`}
</section>`;
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
  <p class="note"><strong>The tier column is one vocabulary and the top of it is a tie.</strong> ${TIERS.slice(0, -2).join(', ')}, then ${TIERS.slice(-2).join(' and ')} - the ones before them ascend, and the last two are peers rather than a further two steps. An immortal-grade thing does what it says every time; a chaos-grade one is as powerful and its effect is settled when it is used rather than when it was made, so what it does is drawn rather than chosen and the draw includes outcomes nobody wanted. Nothing on this page is sorted on the tier, because a sort would have to put one of those two above the other.</p>
  <p class="note"><strong>Which is why a row marked <em>settled on use, not on the label</em> is not telling you what the thing does.</strong> The figure beside it is one outcome the material has been seen to have, and it is on the row rather than gathered into this paragraph on purpose: a reader scanning one line has to see that that line's number is not a promise. ${esc(RECORD_CAVEAT)}</p>
  ${itemTable(`Pills - ${rowsOf('pills').length} of them, the only reliable way to undo damage, and the ${IMMORTAL_ITEMS.length} things that came down that nobody here can make`, rowsOf('pills'))}
  ${immortalGradeDetail()}
  <p class="note"><strong>Grade caps the destination, not the distance.</strong> Every grade of the two objects above performs the same single crossing - the top rung of one realm to the first rung of the next - and what a higher grade buys is permission to perform it further up the ladder. That is why the <em>pitched at</em> column is empty on those two rows: each of them is pitched at three rungs, one per grade, and the catalog states them:</p>
  <ul class="spendlist">${THE_LAST_REALM_IS_UNBUYABLE.theCeilings.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
  <p class="note">${esc(THE_LAST_REALM_IS_UNBUYABLE.theAbsolute)} Who is holding one is on the Items tab, and what each house holds altogether is on Holdings.</p>
  <p class="note"><strong>What mends a cultivator who crossed and arrived broken.</strong> Nothing refined below the Lid reaches a break above ordinal ${repairCeilings().madeBelowTheLid}, and nothing at all reaches above ordinal ${repairCeilings().anythingAtAll} - the crossing into the last realm is your own effort, and medicine is barred at it by rule. Who is holding a dose, and what has been spent on whom, is on the Items tab.</p>
  ${itemTable(`Structural repair medicine - ${rowsOf('repair medicine').length}, for a cultivator who crossed and arrived broken`, rowsOf('repair medicine'))}
  ${itemTable(`Comprehension materials - ${rowsOf('comprehension materials').length} bands, spent by being understood`, rowsOf('comprehension materials'))}
  ${itemTable(`Spirit herbs - ${rowsOf('spirit herbs').length}, the half of the ingredient layer that grows, ${LOST_MATERIALS.length} of them extinct`, rowsOf('spirit herbs'))}
  ${extinctionRecord()}
  <p class="note"><strong>The other half of the ingredient layer has to be killed first.</strong> A beast material carries the same columns a herb carries - the five grades, a value in stones, a draw weight, and a rung below which getting it is not survivable - and one resolver hands both to a cauldron without asking which table the row came out of. What differs is not the arithmetic, it is that somebody has to be standing where a herb grows and somebody has to deal with the animal.</p>
  <p class="note"><strong>A core is the one row that is not a part of an animal.</strong> It is condensed cultivation, which is why nothing below ordinal ${BEAST_CORE_ORDINAL} has one and why the cheapest core in the world is ${LOWEST_CORE_GRADE} grade. ${rowsOf('beast materials').filter(x => x.detail.startsWith('a core')).length} of the ${rowsOf('beast materials').length} rows below are cores. What a species is, and what has to be done to reach one, is under the table.</p>
  ${itemTable(`Beast materials - ${rowsOf('beast materials').length}, off ${new Set(BEAST_MATERIALS.map(m => m.sourceBeastId)).size} of the ${BEASTS.length} species`, rowsOf('beast materials'))}
  <p class="note"><strong>A pill is only ever as obtainable as its rarest ingredient</strong>, which is where the real cost of the alchemy system lives. ${RECIPES.length} recipes turn the herbs above into the pills above; ${RECIPES.filter(x => x.provenance === 'recovered').length} of them exist only because somebody opened something that was sealed, and no recipe may name a herb this catalog does not hold.</p>
  <p class="note">Nothing on this side is rated above ${OBJECT_CEILING_BELOW_THE_LID} whatever kind it is, because an object rated at a rung lets whoever holds it strike at that rung. A manual is paper and is under no such rule, which is the one exception and the reason the arts have a sheet of their own. ${STRUCTURAL_REPAIR_HOLDINGS.length} opening holdings of repair medicine are recorded against named houses; who is holding what is on the Items tab, and what each house holds altogether is the Holdings tab.</p>
</section>

<section>
  <div class="sh"><h2>What a beast material comes off</h2><span class="r">${BEASTS.length} species &middot; ${BEAST_TIDES.length} tides</span></div>
  <p class="note"><strong>A beast is on the same ladder as everybody else, with everything human taken off it.</strong> No manual, no teacher, no medicine, no crossing ceremony: progress is time multiplied by the density of the air. It is slower per year than a cultivator on the same ground and it never stops, which is why the oldest things in the world are not people.</p>
  <p class="note"><strong>Two rungs decide what a species is to a hunter, and they are twelve apart.</strong> At ordinal ${BEAST_CORE_ORDINAL} a beast condenses a core and can say nothing about it. At ordinal ${BEAST_CHANGE_ORDINAL} it takes a shape and a voice and is thereafter a party who can decline. The <em>held as</em> column is that boundary: counted below the core, tracked between, and somebody above.</p>
  <p class="note"><strong>The species column is not the rung.</strong> A rung gives what it gives everybody. What is in the name beside each species is the other axis - a tortoise's defence, a fox's fire - which no amount of cultivation confers on a human and which nothing can teach, buy or take off a shelf.</p>
  ${beastTable()}
  <p class="note"><strong>A tide is a symptom with a cause, and the cause is always a change to the ground or to a seal.</strong> Killing the front of one does not address it. ${BEAST_TIDES.filter(t => t.driverBeastId === null).length} of the ${BEAST_TIDES.length} below have nothing at the back of them to kill at all, which is the worse kind.</p>
  ${tideBlocks()}
</section>

<section>
  <div class="sh"><h2>What a house moves its people on</h2><span class="r">${CONVEYANCES.length} rungs &middot; ${CONVEYANCE_RECIPES.length} of them buildable</span></div>
  <p class="note"><strong>Arriving is a statement before anybody speaks, and the table is not a ladder.</strong> A named carriage is heaven grade and reaches a district; a hull is heaven grade and crosses water. What a house owns says what it can reach and what it is willing to be seen reaching for, and the two are different questions.</p>
  ${conveyanceTable()}
  <p class="note"><strong>${conveyancesNobodyBuilds().length} of the ${CONVEYANCES.length} have no bill of materials.</strong> Walking is made of nothing, flight on one's own blade is an art rather than property, and a broken beast is a hunt rather than a build. Everything else below is made out of what a hunt brings back, which is what joins this table to the beast materials above.</p>
  <p class="note"><strong>A core in the frame is the line a house cannot buy its way past.</strong> Nothing below ordinal ${BEAST_CORE_ORDINAL} carries one, so the cheapest core obtainable anywhere is ${LOWEST_CORE_GRADE} grade and every craft with one in it is paying that price whatever else it is made of.</p>
  ${conveyanceRecipeBlocks()}
</section>

<section>
  <div class="sh"><h2>What an artifact is made of</h2><span class="r">${Object.keys(WHAT_AN_ARTIFACT_IS_MADE_OF).length} worked grades</span></div>
  <p class="note"><strong>A slot says what kind of thing fills it and never names a row.</strong> What would do is resolved against the herbs and the beast materials at the moment the question is asked, so a row regraded, renamed or added arrives in every recipe that should have it. A list of ids would be a second copy of both catalogs.</p>
  <p class="note"><strong>Mortal grade asks for nothing and the last two grades have no recipe at all.</strong> Roadside work would refuse nobody, and nothing below the Lid makes an immortal or a chaos-grade thing, so the question never reaches a bench. What is left is the two grades below.</p>
  <p class="note"><strong>Heaven grade asks for one heaven-grade thing rather than three, and the slot takes a grown thing as readily as a taken one.</strong> Heaven-grade material comes off something standing at ordinal ${BEAST_CHANGE_ORDINAL} or above, which has a shape and a voice, so a recipe demanding three of them would route every heaven-grade artifact in the world through that act.</p>
  ${artifactRecipeBlocks()}
</section>`;
}
