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
import { lifespanForOrdinal, realmForOrdinal, REALM_TIERS, MAX_ORDINAL } from './realms.js';
import { netEarningsPerYear } from './origin.js';
import {
    BROKEN_STATUSES,
    brokenStatusKeyOf,
    REPAIRED_IN_THE_CRUCIBLE,
    brokenStatusFor,
    clearBrokenStatus
} from './what-goes-wrong-at-a-realm-boundary.js';
import type { Injury } from '../../schema/cultivation.js';

// THE CEILINGS

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
 */
export function repairRefusalReason(
    medicine: StructuralRepairMedicine,
    woundKey: string | null,
    atOrdinal: number
): string | null {
    // Resolved once and used throughout, so a saved row carrying a retired key
    // is recognised as a break AND matched against `mends`. Refusing one on a
    // stale string would tell somebody carrying a real structural wound that
    // nothing is wrong with them, and matching `mends` on it would refuse the
    // dose that is made for exactly their break.
    const key = brokenStatusKeyOf(woundKey);
    if (key === null) {
        return 'This mends a structure that did not set. What is wrong here is not a structure, so there is nothing for it to reach for - it would be swallowed, it would be gone, and the wound would be exactly where it was.';
    }
    if (atOrdinal > NOTHING_REPAIRS_ABOVE_ORDINAL) {
        return 'Nothing reaches this rung and nothing ever will. Getting into the last realm is your own effort - helpers are allowed at that crossing and medicine is not - so the thing that would answer this is barred at precisely the wall that needs it. That is a rule rather than a shortage, and no amount of money, standing or luck moves it.';
    }
    // Reach before fit, deliberately. "Nothing made here goes that high" is a
    // more useful sentence than "wrong box", and it is the one that closes the
    // conversation instead of sending somebody looking for a better shelf.
    if (atOrdinal > medicine.reachesUpToOrdinal) {
        if (medicine.madeBelowTheLid && atOrdinal > ordinaryGradeCeiling()) {
            return 'Nothing refined on this side of the Lid reaches a break above Deity Transformation. Not this, not a better one, not one made anywhere: the ceiling is on the refining rather than on the price, and every guild in the two provinces has established it independently and stopped trying.';
        }
        return 'Below its grade. It sets, it holds for a while, and it does not take - and the taker is out one dose and a year, which is the more common of the two disasters.';
    }
    if (!medicine.mends.includes(key) && !reachesFromBelow(medicine, key)) {
        return 'Wrong grade. This is made for a different structure and it will not find this one, which is the ordinary way a house wastes one: the box was right, the break was not.';
    }
    return null;
}

/**
 * Whether a higher-graded medicine reaches a break a lower one is named for.
 */
function reachesFromBelow(medicine: StructuralRepairMedicine, woundKey: string): boolean {
    for (const other of STRUCTURAL_REPAIR_MEDICINES) {
        if (!other.mends.includes(woundKey)) continue;
        if (medicine.reachesUpToOrdinal > other.reachesUpToOrdinal) return true;
    }
    return false;
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

/** The whole table as readings, cheapest first. */
export function readAllRepairMedicine(): RepairMedicineReading[] {
    return STRUCTURAL_REPAIR_MEDICINES
        .map(readRepairMedicine)
        .sort((a, b) => a.weightInStones - b.weightInStones);
}

/**
 * Every structural break, and what the world has for it.
 */
export interface BreakCoverage {
    woundKey: string;
    /** The rung somebody carrying this is standing at. */
    atOrdinal: number;
    medicineId: string | null;
    madeBelowTheLid: boolean | null;
    /** Whether a successful crossing would clear it instead. */
    theCrucibleClearsIt: boolean;
}

export function coverageOfEveryBreak(): BreakCoverage[] {
    return BROKEN_STATUSES.map(woundKey => {
        const atOrdinal = ordinalCarrying(woundKey);
        const medicine = cheapestMedicineFor(woundKey, atOrdinal);
        return {
            woundKey,
            atOrdinal,
            medicineId: medicine?.id ?? null,
            madeBelowTheLid: medicine?.madeBelowTheLid ?? null,
            theCrucibleClearsIt: REPAIRED_IN_THE_CRUCIBLE[woundKey] ?? false
        };
    });
}

/**
 * The rung a cultivator carrying this break is standing at.
 */
export function ordinalCarrying(woundKey: string): number {
    for (let from = 0; from < MAX_ORDINAL; from++) {
        if (brokenStatusFor(from) === woundKey) return from + 1;
    }
    return NOTHING_REPAIRS_ABOVE_ORDINAL + 1;
}

/** The medicine row for an id, for callers holding only the id. */
export { getStructuralRepairMedicine };
