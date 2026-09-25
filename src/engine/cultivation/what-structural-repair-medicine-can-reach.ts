/**
 * How far a structural repair reaches, what one costs, and what moves it.
 */

import {
    STRUCTURAL_REPAIR_MEDICINES,
    getStructuralRepairMedicine,
    SENT_DOWN_EVER_ARRIVED,
    SENT_DOWN_SPENDINGS,
    SENT_DOWN_UNACCOUNTED,
    STRUCTURAL_REPAIR_HOLDINGS,
    type StructuralRepairMedicine
} from '../../data/cultivation/structural-repair-medicine.js';
import { lifespanForOrdinal, realmForOrdinal, REALM_TIERS } from './realms.js';
import { netEarningsPerYear } from './origin.js';
import { clearBrokenStatus } from './what-goes-wrong-at-a-realm-boundary.js';
import { currentWoundKey, isPermanentWound, woundNature } from '../../data/cultivation/wounds.js';
import { PILLS } from '../../data/cultivation/pills.js';
import type { Injury } from '../../schema/cultivation.js';

// THE CEILINGS

/**
 * The one permanent wound that is off this road for a reason other than rank.
 *
 * A spent span is not a structure. Named once here rather than matched inline,
 * because it is a ruling and a bare string in a condition is a ruling nobody
 * can find.
 */
const A_SPAN_ALREADY_SPENT = 'burnt-span';

/**
 * The last rung anything at all repairs at.
 *
 * The end of Grand Ascension, read off the ladder. Above it is the crossing
 * into Tribulation Transcendence, and that crossing is your own effort.
 */
export const NOTHING_REPAIRS_ABOVE_ORDINAL =
    REALM_TIERS.find(t => t.key === 'grand_ascension')!.ordinalEnd;

/**
 * The last rung anything made on this side of the Lid repairs at.
 */
export function ordinaryGradeCeiling(): number {
    let top = -1;
    for (const m of STRUCTURAL_REPAIR_MEDICINES) {
        if (!m.madeBelowTheLid) continue;
        top = Math.max(top, m.reachesUpToOrdinal);
    }
    return top;
}

/**
 * Whether this medicine mends this break, in this body, at this rung.
 */
export function mendsThisBreak(
    medicine: StructuralRepairMedicine,
    woundKey: string | null,
    atOrdinal: number
): boolean {
    return repairRefusalReason(medicine, woundKey, atOrdinal) === null;
}

/**
 * Why it will not work, in words a physician would use, or null where it will.
 *
 * ── THE AXIS IS THE RANK, AND IT USED TO BE THE NAMED BREAK ─────────────
 *
 * This refused anything that was not one of `BROKEN_STATUSES` - *"This mends a
 * structure that did not set"* - and then refused again on `mends` if the grade
 * was made for a different one. So a body short an arm, or carrying a channel
 * parted rather than torn, was turned away by a medicine that dissolves and
 * re-lays what a cultivator is made of, and an agent reading that reasonably
 * concluded the world had no answer and wrote a new pill.
 *
 * The design owner overruled the premise rather than the reading: **a dose
 * repairs every permanent injury at its rank.** One axis, and it is the one the
 * catalog already carries - `reachesUpToOrdinal`, which is what separates a
 * Second Pour from an Unbroken Pattern. So the grade buys HEIGHT and nothing
 * else, and the `mends` column is now what each grade was MADE for rather than
 * the limit of what it finds.
 *
 * ── AND THE BOUNDS ON THAT ARE RULINGS, NOT INFERENCES ──────────────────
 *
 * Both were put to the design owner because the literal reading of "every
 * permanent injury" reached further than the catalog's own rows said it should,
 * and in each case the row was right and nothing was reading it.
 *
 *   NOT A MIND. *"No a repair dose does not reach wounds"* of the mind. A
 *   medicine that takes a cultivation base apart and lays it again does not
 *   close a rooted heart demon; `cleanse_deviation` is the line for that.
 *
 *   NOT SPENT YEARS. *"It doesn't hand back burnt lifespan, that's what that
 *   immortal pill is for."* The `burnt-span` row has said so all along - *"Nothing
 *   below the Lid returns spent years. The rung above returns them, which is
 *   exactly the trap"* - and `extend_lifespan` is the line, with the Immortal
 *   Longevity Pill at the end of it.
 *
 * So the axis is rank, and what is off it is the mind and the span.
 *
 * The two ceilings are untouched and are still the whole design: nothing
 * refined below the Lid reaches past Deity Transformation, and nothing at all
 * reaches the crossing into Tribulation Transcendence.
 *
 * What still gets refused is a wound that mends on its own. An ordinary tear
 * closes with time or with the graded treat-injury line, and spending one of
 * eleven objects in the world on one is the waste this sentence exists to
 * prevent.
 */
export function repairRefusalReason(
    medicine: StructuralRepairMedicine,
    woundKey: string | null,
    atOrdinal: number
): string | null {
    // The CURRENT key, so a saved row carrying a retired name is still
    // recognised as the wound it is. Refusing one on a stale string would tell
    // somebody carrying a real wound that nothing is wrong with them.
    const key = currentWoundKey(woundKey);
    if (key === null || !isPermanentWound(key)) {
        return 'This is for what does not close on its own. What is wrong here does - with time, or with medicine a counter sells - so there is nothing for it to reach for: it would be swallowed, it would be gone, and the wound would mend on the schedule it was already going to mend on.';
    }
    if (woundNature(key) !== 'physical') {
        return 'This works on a body. What is wrong here is not in the body, and a medicine that takes a cultivation base apart and lays it again does not find it - the base is sound. What is asked for here is a mind, and that is a different line of medicine entirely.';
    }
    if (key === A_SPAN_ALREADY_SPENT) {
        return 'This lays a structure again. It does not hand back years, and nothing below the Lid does - what returns a spent span is the rung above, which is exactly the trap, or the one medicine at the end of the lifespan line. Swallowing this would mend a body that is not what is wrong.';
    }
    if (atOrdinal > NOTHING_REPAIRS_ABOVE_ORDINAL) {
        return 'Nothing reaches this rung and nothing ever will. Getting into the last realm is your own effort - helpers are allowed at that crossing and medicine is not - so the thing that would answer this is barred at precisely the wall that needs it. That is a rule rather than a shortage, and no amount of money, standing or luck moves it.';
    }
    if (atOrdinal > medicine.reachesUpToOrdinal) {
        if (medicine.madeBelowTheLid && atOrdinal > ordinaryGradeCeiling()) {
            return 'Nothing refined on this side of the Lid reaches a break above Deity Transformation. Not this, not a better one, not one made anywhere: the ceiling is on the refining rather than on the price, and every hall in the two provinces has established it independently and stopped trying.';
        }
        return 'Below its grade. It sets, it holds for a while, and it does not take - and the taker is out one dose and a year, which is the more common of the two disasters.';
    }
    return null;
}

/**
 * The cheapest thing in the world that would mend this, or null where there is
 * nothing. Null is the important answer and callers must not soften it: for a
 * broken step it is null forever; for a torn spirit sense it is an object nobody
 * on this side can make, which is a different kind of null and is why the refusal
 * reason exists beside this.
 */
export function cheapestMedicineFor(
    woundKey: string | null,
    atOrdinal: number
): StructuralRepairMedicine | null {
    let best: StructuralRepairMedicine | null = null;
    for (const m of STRUCTURAL_REPAIR_MEDICINES) {
        if (!mendsThisBreak(m, woundKey, atOrdinal)) continue;
        if (!best || repairWeightInStones(m) < repairWeightInStones(best)) best = m;
    }
    return best;
}

/**
 * Take the dose. The break is gone from the wound list.
 */
export function applyStructuralRepair(
    injuries: readonly Injury[],
    medicine: StructuralRepairMedicine,
    woundKey: string,
    atOrdinal: number
): Injury[] {
    if (!mendsThisBreak(medicine, woundKey, atOrdinal)) return [...injuries];
    return clearBrokenStatus(injuries, woundKey);
}

// THE PRICE

/**
 * How many whole lifetimes of the patient's own accumulation a dose costs.
 */
export const REPAIR_PRICE_IN_LIFETIMES = 12;

/**
 * Everything somebody at this rung clears, after upkeep, across the whole span
 * their realm grants them.
 */
export function lifetimeAccumulationAt(ordinal: number): number {
    return Math.max(0, netEarningsPerYear(ordinal)) * lifespanForOrdinal(ordinal);
}

/**
 * What a dose is WORTH in spirit stones - which is not always what it can be bought
 * for, and for two of the four it never is.
 */
export function repairWeightInStones(medicine: StructuralRepairMedicine): number {
    return Math.round(REPAIR_PRICE_IN_LIFETIMES * lifetimeAccumulationAt(medicine.pricedAtOrdinal));
}

/**
 * What one actually costs to buy, or null where money is not the medium. Callers
 * must not fall back to {@link repairWeightInStones} on a null: a thing with a
 * weight and no price is the entire point of the barter tier.
 */
export function repairCashPrice(medicine: StructuralRepairMedicine): number | null {
    return medicine.terms === 'private_sale' ? repairWeightInStones(medicine) : null;
}

/**
 * What a court putting one up would be looking for, or null where no auction could
 * ever happen.
 */
export function auctionReserveInStones(medicine: StructuralRepairMedicine): number | null {
    return medicine.terms === 'court_auction_only' ? repairWeightInStones(medicine) : null;
}

/** Why the counter will not name a figure, or null where it will. */
export function cashRefusalReason(medicine: StructuralRepairMedicine): string | null {
    switch (medicine.terms) {
        case 'private_sale':
            return null;
        case 'court_auction_only':
            return 'There is no price on it because there is no market for it. One reaches open sale when a court needs money badly enough to put its own up, which has happened rarely enough that the last time is a date people cite. Until that happens the answer to what it costs is that nobody is selling.';
        case 'favour_or_singular_thing':
            return 'Money is not what moves this and offering it reads as not understanding what you are looking at. It came down from above the Lid, nobody here can make another, and the holder does not need stones. What they will listen to is an obligation from a height their house cannot reach, or another singular thing, and they will listen exactly once.';
    }
}

/**
 * A dose priced as a share of everything a cultivator at this rung will ever
 * accumulate. THE MIDDLE GRADE IS PRICED AGAINST THE TOP OF THE LADDER and it
 * falls out rather than being set: a Soul-Seating Pill is about a third of
 * everything a Grand Ascension cultivator will ever have across thirty thousand
 * years, and about a tenth of a Tribulation Transcender's. So the price is payable
 * at exactly two heights in the world and it hurts at the lower of them.
 */
export function shareOfALifetimeAt(medicine: StructuralRepairMedicine, ordinal: number): number {
    const lifetime = lifetimeAccumulationAt(ordinal);
    if (!(lifetime > 0)) return Infinity;
    return repairWeightInStones(medicine) / lifetime;
}

/**
 * Whether an individual standing at this rung could ever pay for this out of their
 * own accumulation, spending everything they will ever have.
 */
export function anIndividualCouldPay(
    medicine: StructuralRepairMedicine,
    ordinal: number
): boolean {
    return shareOfALifetimeAt(medicine, ordinal) <= 1;
}

/**
 * The lowest rung at which one whole lifetime's accumulation would cover this, or
 * null where no rung on the ladder ever does.
 */
export function lowestRungThatCouldPay(medicine: StructuralRepairMedicine): number | null {
    for (let o = 0; o <= NOTHING_REPAIRS_ABOVE_ORDINAL; o++) {
        if (anIndividualCouldPay(medicine, o)) return o;
    }
    return null;
}

/** The realm name a price is payable at, for a reader. Null where none is. */
export function lowestRealmThatCouldPay(medicine: StructuralRepairMedicine): string | null {
    const o = lowestRungThatCouldPay(medicine);
    return o === null ? null : realmForOrdinal(o).name;
}

// THE SENT-DOWN COUNT
//
// The figure the standing register carries. Added up here rather than in the
// catalog, so the catalog stays inert and so the parts are forced to reconcile.

export interface SentDownLedger {
    /** Everything the record says has ever come down. */
    everArrived: number;
    /** Spent, with an entry in the dated record. */
    spent: number;
    /** Receipted, entered, and not on the shelf. */
    unaccounted: number;
    /** Standing in the world right now, at the start of it. */
    standing: number;
    /** True where the parts add up, which the tests require. */
    reconciles: boolean;
}

/**
 * The whole supply of the only medicine that reaches above ordinal 28.
 *
 * `standing` is the number the user asked the register to carry, and it is
 * summed from the holdings rather than restated, so a holdings edit moves it.
 */
export function sentDownLedgerTotals(): SentDownLedger {
    const sentDownIds = new Set(
        STRUCTURAL_REPAIR_MEDICINES.filter(m => !m.madeBelowTheLid).map(m => m.id)
    );
    const standing = STRUCTURAL_REPAIR_HOLDINGS
        .filter(h => sentDownIds.has(h.medicineId))
        .reduce((n, h) => n + h.count, 0);
    const spent = SENT_DOWN_SPENDINGS.length;
    const unaccounted = SENT_DOWN_UNACCOUNTED.count;
    return {
        everArrived: SENT_DOWN_EVER_ARRIVED,
        spent,
        unaccounted,
        standing,
        reconciles: standing + spent + unaccounted === SENT_DOWN_EVER_ARRIVED
    };
}

// A READING OF THE WHOLE TABLE
// One row per medicine, everything derived, for the register and the probes.

export interface RepairMedicineReading {
    id: string;
    name: string;
    grade: string;
    mends: readonly string[];
    reachesUpToOrdinal: number;
    reachesUpToRealm: string;
    madeBelowTheLid: boolean;
    terms: string;
    weightInStones: number;
    cashPrice: number | null;
    auctionReserve: number | null;
    cashRefusal: string | null;
    /** Share of a whole lifetime's accumulation, at the rung it is priced for. */
    lifetimesAtItsOwnRung: number;
    /** The same share for the strongest cultivator on the ladder. */
    shareOfAGrandAscensionLifetime: number;
    lowestRealmThatCouldPay: string | null;
}

export function readRepairMedicine(medicine: StructuralRepairMedicine): RepairMedicineReading {
    const grandAscensionStart = REALM_TIERS.find(t => t.key === 'grand_ascension')!.ordinalStart;
    return {
        id: medicine.id,
        name: medicine.name,
        grade: medicine.grade,
        mends: medicine.mends,
        reachesUpToOrdinal: medicine.reachesUpToOrdinal,
        reachesUpToRealm: realmForOrdinal(medicine.reachesUpToOrdinal).name,
        madeBelowTheLid: medicine.madeBelowTheLid,
        terms: medicine.terms,
        weightInStones: repairWeightInStones(medicine),
        cashPrice: repairCashPrice(medicine),
        auctionReserve: auctionReserveInStones(medicine),
        cashRefusal: cashRefusalReason(medicine),
        lifetimesAtItsOwnRung: shareOfALifetimeAt(medicine, medicine.pricedAtOrdinal),
        shareOfAGrandAscensionLifetime: shareOfALifetimeAt(medicine, grandAscensionStart),
        lowestRealmThatCouldPay: lowestRealmThatCouldPay(medicine)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE LADDER, AND WHY ITS TOP RUNG IS NOT IN THE ARRAY ABOVE
// ─────────────────────────────────────────────────────────────────────────

/**
 * One rung of the road a permanent injury is answered on.
 *
 * FIVE RUNGS, MORTAL THROUGH CHAOS, and the design owner asked for the chaos
 * one on this list. It is READ rather than stored as a fifth array row, and the
 * reasons are checkable rather than aesthetic:
 *
 *   IT IS A PILL, AND PILLS ARE REACHABLE. The chaos rung sits in a pouch, is
 *   refined from a recovered formula, and is swallowed through
 *   `alchemy-manage`'s resolver on its own seeded draw. `STRUCTURAL_REPAIR_
 *   MEDICINES` has no player-facing path at all - `applyStructuralRepair` has
 *   no caller outside its own tests, because those four are institutional
 *   objects that houses spend on their own people. Moving the chaos rung into
 *   that array would delete the one permanent-injury medicine a player can
 *   actually take.
 *
 *   THE TWO ROWS CARRY DIFFERENT FACTS. A repair row carries `madeBelowTheLid`,
 *   a per-century refining rate, terms instead of a price, faction holdings and
 *   a sent-down ledger that has to reconcile. The chaos rung has a formula
 *   anybody at the right rung can attempt and no holdings anywhere, and
 *   inventing a provenance and a rate for it would be authoring content to fit
 *   a shape rather than recording a fact.
 *
 *   AND ITS `mends` IS EMPTY ON PURPOSE. The repair schema requires at least
 *   one named wound; the chaos rung names none, because nobody made it for
 *   anything. That is the row saying something, and relaxing the schema to
 *   admit it would weaken the invariant for the other four.
 *
 * So the ladder is a reading over two catalogs, which is the one place the five
 * rungs are stated, and nothing keeps a second copy of either.
 */
export interface RepairRung {
    id: string;
    name: string;
    grade: string;
    /** The last rung it repairs at, or null for the one that reaches any rank. */
    reachesUpToOrdinal: number | null;
    /** What it was made for. Empty for the rung that was made for nothing. */
    mends: readonly string[];
    /**
     * Whether the taker gets to say which injury it closes. False for the chaos
     * rung, which is the price of reaching past the rank ladder at all.
     */
    choosesTheWound: boolean;
}

/**
 * The whole road, lowest rung first.
 *
 * The four institutional doses by rank, then the one that reaches any rank and
 * does not let you choose. Read off both catalogs so a content edit in either
 * moves it and nothing here authors a rung.
 */
export function theRungsThatRepairAPermanentInjury(): RepairRung[] {
    const byRank: RepairRung[] = [...STRUCTURAL_REPAIR_MEDICINES]
        .sort((a, b) => a.reachesUpToOrdinal - b.reachesUpToOrdinal)
        .map(m => ({
            id: m.id,
            name: m.name,
            grade: m.grade,
            reachesUpToOrdinal: m.reachesUpToOrdinal,
            mends: m.mends,
            choosesTheWound: true
        }));
    const drawn = PILLS.filter(p => p.effect === 'mends_what_will_not_close');
    for (const pill of drawn) {
        byRank.push({
            id: pill.id,
            name: pill.name,
            grade: pill.grade,
            reachesUpToOrdinal: null,
            mends: pill.mends ?? [],
            choosesTheWound: (pill.mends ?? []).length > 0
        });
    }
    return byRank;
}

/** The whole table as readings, cheapest first. */
export function readAllRepairMedicine(): RepairMedicineReading[] {
    return STRUCTURAL_REPAIR_MEDICINES
        .map(readRepairMedicine)
        .sort((a, b) => a.weightInStones - b.weightInStones);
}

/** The medicine row for an id, for callers holding only the id. */
export { getStructuralRepairMedicine };
