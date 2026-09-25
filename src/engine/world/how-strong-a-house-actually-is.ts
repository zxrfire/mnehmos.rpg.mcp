/**
 * How strong a house actually is, which is not who its strongest member is.
 *
 * `powerOrdinal` says *"Realm ordinal of its strongest member. Sets who it can
 * bully."* Those are two facts wearing one name, and the second one is wrong: a
 * house with one monster and forty children read identical to a house with
 * twenty solid elders, and every consumer asking how strong a house is has been
 * getting an answer about one person. The design owner: *"right now the power
 * rating is of its strongest member, which is wrong, obviously."*
 *
 * NOTHING HERE REPLACES `powerOrdinal`. It is a true fact plenty of code wants -
 * who is the strongest person in this house - and redefining it would be the
 * same defect in the other direction with a blast radius across seeding,
 * bullying, admission and the register. This sits beside it.
 *
 * ── IT IS A COMPOSITE INDEX, AND THAT IS DELIBERATE ──────────────────────
 *
 * Nobody ranks a military by its best soldier. They roll up manpower, materiel,
 * finance and readiness into one figure, and the figure is worth something only
 * because the components under it are named and can be argued with. Five
 * components here, each scored on its own terms and then weighted; the weights
 * are where the judgement lives and are constants with a reason each, so a
 * reader who disagrees can disagree with a weight rather than with the whole
 * thing. `WhatAHouseCanField` returns every component beside the index for
 * exactly that reason.
 *
 * ── THE AGGREGATION IS THE RESOLVER'S, NOT THIS FILE'S ───────────────────
 *
 * Depth needs a rate of exchange against height, and picking one is how the
 * first cut went wrong - see `theRungsItCouldField`, which records what the
 * chosen curve cost. What is used instead is `war-melee.ts`'s own arithmetic,
 * which has decided this for every fight in the game: a threshold at one major
 * realm, and above it `min(MAX_NUMBERS_MULTIPLIER, effectiveBodies ^
 * NUMBERS_EXPONENT)`.
 *
 * Measured on it: twenty cultivators at Core Formation weigh 28 rungs. So do a
 * hundred, and so do six hundred - numbers saturate at about five equal bodies
 * and the rest are witnesses - and one body at 30 out-weighs every one of those
 * crowds. Which is the genre, and is what a curve could not say.
 *
 * ── AND FOUR DISTINCTIONS THAT ARE NOT ARITHMETIC ────────────────────────
 *
 *   a store is not an income   stones in a vault are spent once; a vein pays
 *                              every year. Summed together, a house that sold
 *                              everything it owns would read at its strongest.
 *   issued is not held         a thing already in somebody's hands is
 *                              committed. `whereThisThingActuallyIs` draws
 *                              that line and MATERIEL counts only what the
 *                              house can still choose who to give.
 *   a one-off is not a flow    a sealed ancestor is a warhead: enormous, once,
 *                              and gone - `sealedCeilingOrdinal` zeroes
 *                              permanently on waking. Its own component and
 *                              its own weight, priced as what waking it would
 *                              CHANGE rather than as the rung it stands at.
 *   a person is conserved      somebody seconded to a posting is on two rolls
 *                              and their weight across the two sums to one.
 *                              See `whoCountsTowardThisHouse`.
 *   capable is not ready       a house that COULD field something and cannot
 *                              do it today is not the same house. A dark
 *                              compound and a peak four centuries cold are
 *                              READINESS, not capability.
 *
 * ── WHAT IS NOT IN IT, AND WHY ───────────────────────────────────────────
 *
 * A patron above the Lid still sending things down is the one fact the design
 * owner asked for that this world does not author. `ABOVE_THE_LID_TRANSMISSION`
 * says how arts at those rungs exist and pass; `HIGH_REALM_PROVENANCE` says
 * where a house's high-realm people CAME from, always long ago. Neither is a
 * standing relationship, and no field anywhere says somebody up there is
 * sending to this house now. It wants authoring across all thirty-eight the way
 * `veinWorth` and `trade` were - it is a flow rather than a one-off, so it
 * would be its own component - and it is not invented here.
 */

import { MAX_ORDINAL, realmIndexOf } from '../cultivation/realms.js';
import {
    combatPowerForOrdinal, NUMBERS_EXPONENT, MAX_NUMBERS_MULTIPLIER
} from '../cultivation/combat.js';
import type { WorldState, FactionRecord } from './world-state.js';
import { whatTheTownsBringIn } from './locations.js';

/**
 * ── WHAT THE FIRST CUT GOT WRONG, AND IT WAS THE WHOLE AGGREGATION ───────
 *
 * There was a `WHAT_ONE_RUNG_IS_WORTH = Math.SQRT2` here, derived from the x4
 * per realm this repo measures, and a log-sum over the roll. It is defensible
 * for two people and it is wrong for a house, because it has no THRESHOLD: on
 * that scale twenty Core Formation cultivators weighed what one body at 33.6
 * weighed, and in this genre twenty Core Formation cultivators do not beat a
 * Body Integration cultivator, they lose and it is not close.
 *
 * The consequence, measured: the Empyrean Court - four immortals - came out
 * TWELFTH, below the Frostmirror Court, which the Empyrean Court could end by
 * sending three people. The design owner: *"someone like 3 ordinals up blows
 * many many many people away of 3 ordinals below; its not linear."*
 *
 * ── AND THE ANSWER WAS ALREADY WRITTEN, IN THE RESOLVER ──────────────────
 *
 * `war-melee.ts` has decided this for every fight in the game since before this
 * file existed, and its rule is a threshold rather than a slope:
 *
 *     "Numbers are counted against the ladder. A body a full realm below the
 *      best thing facing it buys nothing, however many of them came."
 *
 * and above that line numbers are worth `min(MAX_NUMBERS_MULTIPLIER,
 * effectiveBodies ^ NUMBERS_EXPONENT)`, where neither constant was chosen here
 * either: the exponent is whatever makes two equal bodies come out at
 * `EDGE_VALUES.numbers`, and the cap is two because a realm is worth four and a
 * mob that could reach four would beat anybody a rung up.
 *
 * So the aggregation is not a curve of this file's own. It is the resolver's,
 * applied to a roll instead of to a side, and what it produces is what the
 * house would actually bring against something able to match its best. Numbers
 * buy time, never force; the sixth equal body through the six-hundredth are
 * witnesses; and a hundred mortals against a Nascent Soul are a hundred
 * mortals.
 */

/**
 * The weights. This is where the judgement is, and it is all in one place.
 *
 * They sum to one, and the index is the weighted sum times a hundred so a
 * reader is not asked to hold a fraction in their head.
 */
export const WHAT_EACH_COMPONENT_IS_WORTH = {
    /**
     * The heaviest, because a house IS its people. Everything else on this list
     * is something the people use, and a house with nobody on the roll has
     * nothing to use it.
     */
    ranks: 0.55,
    /**
     * What it can put into hands on the day. Real and second to the hands: an
     * instrument makes a good cultivator better and does nothing on its own.
     */
    materiel: 0.10,
    /**
     * Whether it can pay for itself. A force that cannot fund its own halls
     * degrades, and this is exactly where the starving camel meets its limit -
     * the vault is deep and nothing is refilling it.
     */
    finance: 0.15,
    /**
     * The one-off under the hall. Weighted below the roll because it is spent
     * once: a house that wakes its ancestor wins a day and is an ordinary house
     * the morning after, permanently.
     */
    oneOffs: 0.10,
    /**
     * Whether it can do today what it could do. Weighted level with the one-off
     * because a dark compound and a cold peak cost a house every year, where a
     * sleeping ancestor costs it nothing until it is spent.
     */
    readiness: 0.10
} as const;

/** Everything the rating reads. World-side facts are optional. */
export interface WhatAHouseHasToField {
    /** Every rung standing on the roll today. The one indispensable input. */
    rollOrdinals: readonly number[];
    /** The one-off it can field once and never again. Zero once spent. */
    sealedCeilingOrdinal: number;
    /** How much of its inherited compound still runs, 0..1. */
    formationIntegrity: number;
    /** What it can still turn out from its own intake. */
    reliableOrdinal: number;
    /** The highest it has ever produced. */
    peakOrdinal: number;
    /** How long since it last produced anyone at that peak. */
    yearsSinceLastPeak: number;
    /**
     * What it takes off what it holds in a year, and what it owes.
     *
     * Absent where no world has been seeded, in which case FINANCE reads as
     * unknown rather than as zero - a house nobody has costed is not a house
     * that cannot pay.
     */
    purse?: {
        holdingsPerYear: number;
        tributeStonesPerYear: number;
        /** Stones the house itself holds. A buffer, spent once. */
        stones: number;
    };
    /**
     * The power of each artifact the house still OWNS AND HAS NOT ISSUED.
     *
     * Issued is not held: a furnace lent to a disciple is still the house's and
     * is not something the house can hand to somebody else on the day.
     */
    unissuedArtifactPowers?: readonly number[];
}

/** The index, and every component that produced it. */
export interface WhatAHouseCanField {
    /** 0..100. Never compare it with a figure in stones. */
    index: number;
    /**
     * The roll weighed and put back on the ladder, in rungs.
     *
     * The figure to hold beside `powerOrdinal`, and the one that shows what the
     * old number was missing.
     */
    rungsItCouldField: number;
    components: {
        ranks: number;
        materiel: number;
        finance: number;
        oneOffs: number;
        readiness: number;
    };
    /** Whether it is still making people of the quality it once made. */
    condition: 'still making them' | 'living on the inheritance' | 'spent';
    /** Rungs between what it has and what it can still produce. */
    inheritanceGap: number;
}

/**
 * Force put back on the ladder: the rung a single body would have to stand at
 * to weigh what all of these weigh together.
 *
 * Exported because it is the honest answer to "how strong is this house" on its
 * own, for anything that wants rungs rather than an index.
 */
export function theRungsItCouldField(ordinals: readonly number[]): number {
    return theRungsTheseBodiesCouldField(ordinals.map(realmOrdinal => ({ realmOrdinal, weight: 1 })));
}

/**
 * The same, for bodies a house has only a share of.
 *
 * A secondment splits one person between a posting and the house that sent
 * them (`whoCountsTowardThisHouse`), and the share enters exactly where a
 * fraction of a body belongs: in `summed`, which is what `sideStrength` divides
 * to get `effectiveBodies`. A tenth of somebody is a tenth of a body toward the
 * numbers and is never the strongest thing present, which is the right answer -
 * a house does not get to field a warden who is four provinces away.
 */
export function theRungsTheseBodiesCouldField(
    bodies: readonly { realmOrdinal: number; weight: number }[]
): number {
    const standing = bodies.filter(b =>
        Number.isFinite(b.realmOrdinal) && b.realmOrdinal > 0 && b.weight > 0);
    if (standing.length === 0) return 0;

    // THE THRESHOLD, and it is `war-melee.ts`'s, not this file's. A body a full
    // major realm below the best thing on the field buys nothing, so a house is
    // measured by what it can bring against something able to match its own
    // best - which is the case the question is ever asked in.
    const topRealm = realmIndexOf(Math.max(...standing.map(b => b.realmOrdinal)));
    const counted = standing.filter(b => realmIndexOf(b.realmOrdinal) >= topRealm);

    // The strongest is the strongest body ACTUALLY PRESENT, so a share of
    // somebody cannot set the height of the house on its own.
    const strongest = counted.reduce(
        (best, b) => Math.max(best, combatPowerForOrdinal(b.realmOrdinal) * b.weight), 0);
    const summed = counted.reduce(
        (total, b) => total + combatPowerForOrdinal(b.realmOrdinal) * b.weight, 0);

    // `sideStrength`'s arithmetic, unchanged: bodies are weighed rather than
    // counted, and the count is compressed and then capped.
    const effectiveBodies = strongest > 0 ? summed / strongest : counted.length;
    const multiplier = Math.min(
        MAX_NUMBERS_MULTIPLIER,
        effectiveBodies <= 1 ? 1 : effectiveBodies ** NUMBERS_EXPONENT
    );
    return theRungThatWeighsThisMuch(strongest * multiplier);
}

/**
 * The inverse of `combatPowerForOrdinal`: the rung one body would have to stand
 * at to weigh this much.
 *
 * A scan rather than an algebraic inverse, because the forward function is
 * piecewise - it interpolates inside a realm by `WITHIN_REALM_PEAK` - and a
 * closed form here would be a second copy of it that goes stale the first time
 * somebody reshapes a tier.
 */
function theRungThatWeighsThisMuch(weight: number): number {
    if (!(weight > 0)) return 0;
    let previous = combatPowerForOrdinal(0);
    if (weight <= previous) return 0;
    for (let rung = 1; rung <= MAX_ORDINAL; rung++) {
        const here = combatPowerForOrdinal(rung);
        if (weight <= here) {
            return here === previous
                ? rung
                : rung - 1 + (weight - previous) / (here - previous);
        }
        previous = here;
    }
    // Past the top of the ladder, which a house of immortals with numbers
    // behind them genuinely is. Extrapolated at the last rung's own rate rather
    // than clamped, so two such houses do not tie at `MAX_ORDINAL`.
    const step = combatPowerForOrdinal(MAX_ORDINAL) / combatPowerForOrdinal(MAX_ORDINAL - 1);
    return MAX_ORDINAL + Math.log(weight / previous) / Math.log(step);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/**
 * What a house could actually put in a room, as an index and its parts.
 */
export function howStrongAHouseActuallyIs(has: WhatAHouseHasToField): WhatAHouseCanField {
    const rungsItCouldField = theRungsItCouldField(has.rollOrdinals);
    const ranks = clamp01(rungsItCouldField / MAX_ORDINAL);

    // ── EVERY OTHER COMPONENT IS A DELTA IN RUNGS, AND TWO CUTS WERE NOT ──
    //
    // Both of these were scored on scales of their own - the vault against the
    // roll, a sealed ancestor against `MAX_ORDINAL` - and both saturated:
    // materiel read 1.00 for thirty-four of thirty-eight houses, and a sealed
    // 42 was worth 0.913 to a house whose own best is 36, which is most of the
    // index for one body it can use once. Between them they put the EMPYREAN
    // COURT - four immortals - thirteenth, behind a house it could end by
    // sending three people.
    //
    // So each one is now what it ADDS to what the house can field, in rungs,
    // against the same ladder RANKS is measured on. A thing that would not
    // change what turns up is worth nothing, which is the honest answer and is
    // what neither scale could say.
    //
    // MATERIEL is bounded by the hands. `combat.ts`: *"A rated object is worth
    // a second body of that rank"* - so the vault is scored as one instrument
    // per pair of hands, best first, and the hundred and fortieth blade in the
    // store is worth nothing this afternoon.
    const issuable = [...(has.unissuedArtifactPowers ?? [])]
        .sort((a, b) => b - a)
        .slice(0, has.rollOrdinals.length);
    const withKit = theRungsItCouldField([...has.rollOrdinals, ...issuable]);
    const materiel = clamp01((withKit - rungsItCouldField) / MAX_ORDINAL);

    // A house nobody has costed reads at the middle rather than at zero. Not
    // knowing whether it can pay is not the same as knowing it cannot, and this
    // function is called with and without a world.
    let finance = 0.5;
    if (has.purse) {
        const payroll = has.rollOrdinals.length * A_STIPEND_PER_MEMBER_PER_YEAR;
        const owed = payroll + has.purse.tributeStonesPerYear * WHAT_A_YEAR_OF_TRIBUTE_COSTS;
        // ── WHAT IT EARNS AGAINST WHAT IT MUST PAY, COMPRESSED NOT CLIPPED ──
        //
        // The first cut clamped this ratio at one, on the reasoning that above
        // the line more money is not more force. Measured over a seeded
        // century, that made the component useless and broke the property this
        // rating exists for: payrolls here are hundreds of stones and veins pay
        // thousands, so thirty-five of thirty-eight houses read exactly 1.00
        // and AN APEX THAT LOST A VEIN CAME OUT UNCHANGED. A rating that does
        // not move when a house loses its ground is a label.
        //
        // So it compresses instead: every step above the line is worth less
        // than the one before, and no house in the catalog reaches the top of
        // the curve, so every vein anybody loses shows up.
        const ratio = owed > 0 ? Math.max(0, has.purse.holdingsPerYear / owed) : AT_EASE;
        const covers = clamp01(Math.log1p(ratio) / Math.log1p(AT_EASE));
        // And the vault, which is a BUFFER and not an income: years of payroll
        // it could cover out of the vault, capped at the few that mean anything.
        const buffer = owed > 0
            ? clamp01(has.purse.stones / (owed * YEARS_OF_BUFFER_THAT_MEAN_ANYTHING))
            : 1;
        finance = covers * WHAT_PAYING_ITS_OWN_WAY_IS_WORTH
            + buffer * (1 - WHAT_PAYING_ITS_OWN_WAY_IS_WORTH);
    }

    // The one-off, priced as what waking it would change and nothing more. A
    // sealed ancestor one realm above the house is enormous; one at the rung
    // the house already fields adds a body and is worth about what a body is.
    const woken = has.sealedCeilingOrdinal > 0
        ? theRungsItCouldField([...has.rollOrdinals, has.sealedCeilingOrdinal])
        : rungsItCouldField;
    const oneOffs = clamp01((woken - rungsItCouldField) / MAX_ORDINAL);

    // Readiness is two facts and neither is capability: how much of the ground
    // still answers, and whether the house has produced anybody of its own
    // quality inside a lifetime.
    const peakIsCold = clamp01(has.yearsSinceLastPeak / A_LIFETIME_OF_YEARS);
    const stillMakingThem = has.peakOrdinal > 0
        ? clamp01(has.reliableOrdinal / has.peakOrdinal)
        : 1;
    const readiness = clamp01(has.formationIntegrity) * WHAT_ITS_OWN_GROUND_IS_WORTH
        + (stillMakingThem * (1 - peakIsCold)) * (1 - WHAT_ITS_OWN_GROUND_IS_WORTH);

    const w = WHAT_EACH_COMPONENT_IS_WORTH;
    const index = 100 * (
        ranks * w.ranks + materiel * w.materiel + finance * w.finance
        + oneOffs * w.oneOffs + readiness * w.readiness
    );

    const strongest = has.rollOrdinals.reduce((max, n) => Math.max(max, n), 0);
    const inheritanceGap = Math.max(0, strongest - has.reliableOrdinal);

    return {
        index: Number(index.toFixed(2)),
        rungsItCouldField: Number(rungsItCouldField.toFixed(2)),
        components: {
            ranks: Number(ranks.toFixed(4)),
            materiel: Number(materiel.toFixed(4)),
            finance: Number(finance.toFixed(4)),
            oneOffs: Number(oneOffs.toFixed(4)),
            readiness: Number(readiness.toFixed(4))
        },
        condition: has.reliableOrdinal <= 0
            ? 'spent'
            : inheritanceGap >= A_GAP_THAT_IS_AN_INHERITANCE
                ? 'living on the inheritance'
                : 'still making them',
        inheritanceGap
    };
}

/**
 * The same reading, off the world as it currently stands.
 *
 * DERIVED EVERY TIME AND CACHED NOWHERE, which is the whole point. The design
 * owner: *"then the rating changes for obvious reasons, which is as it should
 * be."* A rating written to `resources` or to the catalog is a label: it would
 * go on saying what the house was on the day somebody remembered to write it.
 * Everything below is read live -
 *
 *   the roll        whoever is alive and on it today, at the rung they are at
 *                   today. A war takes elders and the figure falls the same
 *                   year.
 *   the one-off     `sealed_ceiling_ordinal`, which the world zeroes
 *                   permanently on waking. Spend it and the component is gone
 *                   the morning after.
 *   the ground      `formationNodesLit` against the total, off the SEAT, which
 *                   is where the world darkens them.
 *   the purse       the same four terms the yearly economy charges, read off
 *                   `resources` and the locations, so a vein taken off a house
 *                   shows up here the year it is taken.
 *   the vault       what the house owns and has not issued.
 *
 * `decline` is the one thing that cannot be read off the world: how high a
 * house once stood and how long ago is authored history, and nothing in the
 * simulation revises it. Pass it from the catalog; without it the reading is
 * still correct about everything a century can change.
 */
export function howStrongThisHouseIsNow(
    state: Pick<WorldState, 'npcs' | 'locations' | 'objects'>,
    faction: FactionRecord,
    decline: { peakOrdinal: number; yearsSinceLastPeak: number } = {
        peakOrdinal: 0, yearsSinceLastPeak: 0
    }
): WhatAHouseCanField {
    const rollOrdinals: number[] = [];
    for (const npc of state.npcs) {
        if (npc.status === 'alive' && npc.factionId === faction.id) {
            rollOrdinals.push(npc.cultivation.realmOrdinal);
        }
    }

    const seat = faction.seatLocationId
        ? state.locations.find(l => l.id === faction.seatLocationId)
        : undefined;
    const total = Number(seat?.data.formationNodesTotal ?? 0);
    const lit = Number(seat?.data.formationNodesLit ?? 0);

    const share = clamp01(Number(faction.resources.reliable_ordinal ?? 0) / MAX_ORDINAL);
    const holdingsPerYear =
        Number(faction.resources.veins ?? 0) * 5_000 * (0.5 + share)
        + Number(faction.resources.levy_per_year ?? 0)
        + Number(faction.resources.trade_per_year ?? 0)
        + whatTheTownsBringIn(state.locations, faction.id);

    // Owned, and not in anybody's hands. A furnace lent to a disciple is still
    // the house's and is not something it can hand to somebody else today.
    const unissuedArtifactPowers: number[] = [];
    for (const object of state.objects ?? []) {
        if (object.ownerId !== faction.id) continue;
        if (object.possessorId !== null) continue;
        if (typeof object.power === 'number' && object.power > 0) {
            unissuedArtifactPowers.push(object.power);
        }
    }

    return howStrongAHouseActuallyIs({
        rollOrdinals,
        sealedCeilingOrdinal: Number(faction.resources.sealed_ceiling_ordinal ?? 0),
        formationIntegrity: total > 0 ? lit / total : 1,
        reliableOrdinal: Number(faction.resources.reliable_ordinal ?? 0),
        peakOrdinal: decline.peakOrdinal,
        yearsSinceLastPeak: decline.yearsSinceLastPeak,
        purse: {
            holdingsPerYear,
            tributeStonesPerYear: Number(faction.resources.tribute_owed_per_year ?? 0),
            stones: Number(faction.resources.spirit_stones ?? 0)
        },
        unissuedArtifactPowers
    });
}

/**
 * A member's stipend, restated from the yearly economy rather than re-derived.
 *
 * It is a COST and never a capability: a long rank ladder and a generous
 * stipend say what a house spends, not what it can field, and the only place
 * either belongs in this file is on the bill FINANCE has to cover.
 */
const A_STIPEND_PER_MEMBER_PER_YEAR = 45;

/** The share of a stated tribute the yearly economy actually moves. */
const WHAT_A_YEAR_OF_TRIBUTE_COSTS = 0.1;

/**
 * How much of FINANCE is paying its own way rather than holding a reserve.
 *
 * Weighted hard toward the income because that is the distinction the design
 * owner drew: the vault is deep and nothing is refilling it. A house living off
 * its reserve is on a clock and the rating should say so while the reserve
 * lasts, not after.
 */
const WHAT_PAYING_ITS_OWN_WAY_IS_WORTH = 0.7;

/**
 * The multiple of its own yearly bill at which money stops constraining a house.
 *
 * Read off the published wage table rather than chosen. The dearest standing
 * commitment anybody in this world can buy is `job-lid-assay` at five million
 * cash a month - 600,000 stones a year - and an ordinary house's payroll is
 * about 360. A house earning sixteen hundred times its own bill could retain
 * the most expensive body in the world for ever out of income and has nothing
 * left that money would buy it; below that, every loss is felt.
 *
 * Measured: NO HOUSE IN THE CATALOG REACHES IT, and that is what the figure has
 * to do. An earlier cut clamped this at one, and then at a hundred, and both
 * times the richest houses sat on the flat top - so an apex that lost one of
 * eight veins over a century came out with an unchanged rating, which is the
 * one thing this rating may not do.
 */
const AT_EASE = 1_600;

/**
 * Years of its own bill a vault has to cover to be worth a full mark.
 *
 * Three, because that is about how long a house can be in trouble before
 * somebody comes for its ground - `a-house-that-cannot-pay-reaches-for-ground`
 * is the mechanic this is sized against. A deeper vault than that is not more
 * survivable, it is just deeper.
 */
const YEARS_OF_BUFFER_THAT_MEAN_ANYTHING = 3;

/** How much of READINESS is the ground rather than the intake. */
const WHAT_ITS_OWN_GROUND_IS_WORTH = 0.6;

/**
 * How long a peak has to be cold before it stops counting as this house's.
 *
 * Three hundred years: long enough that nobody who was taught by that person is
 * still teaching, which is the point at which a house has the record and not
 * the method.
 */
const A_LIFETIME_OF_YEARS = 300;

/**
 * The gap at which a house is living on what it inherited rather than making
 * it. Four rungs, because that is one major realm in `realms.ts` - a house
 * whose strongest stands a whole realm above anything it can still produce did
 * not produce them.
 */
const A_GAP_THAT_IS_AN_INHERITANCE = 4;
