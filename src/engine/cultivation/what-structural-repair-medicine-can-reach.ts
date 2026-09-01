/**
 * How far a structural repair reaches, what one costs, and what moves it.
 *
 * The catalog next door says what exists. This says what it does, and every
 * number here is READ OFF THE LADDER rather than chosen, for the reason
 * AGENTS.md gives: a figure with a measurement behind it survives the next
 * content pass and a figure somebody picked does not.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE TWO CEILINGS, AND THEY ARE ENFORCED HERE RATHER THAN DESCRIBED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * NOTHING BELOW IMMORTAL GRADE REACHES ABOVE THE END OF DEITY TRANSFORMATION.
 * Not expensively, not at auction, not from a house that owes you. A Void
 * Refinement cultivator with a torn spirit sense and every stone in the province
 * is looking at a shelf with nothing on it, and the only object in the world
 * that answers them is one nobody here can make.
 *
 * AND NOTHING REACHES THE CROSSING INTO TRIBULATION TRANSCENDENCE. This one is
 * a RULE rather than a shortage and the distinction is load-bearing: getting to
 * ordinal 41 is your own effort, helpers are allowed at that crossing and
 * medicine is not, so the object that would answer a broken step is barred at
 * exactly the rung that needs it. `REPAIRED_IN_THE_CRUCIBLE` states the same
 * rule from the tribulation's side and the two are checked against each other
 * in the tests - if they ever disagree, one of them is a bug rather than a
 * design difference.
 *
 * Both are functions, not comments. `mendsThisBreak` is the gate every caller
 * goes through, and there is no path around it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE PRICE, AND WHY IT IS QUOTED IN LIFETIMES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A number of spirit stones is meaningless on its own; the whole of what a
 * price means in this world is how it sits against what somebody can actually
 * accumulate. So the unit here is A LIFETIME'S ACCUMULATION: what a cultivator
 * at a given rung clears, after upkeep, across the whole of the span their realm
 * grants them. Both halves already exist - `netEarningsPerYear` and
 * `lifespanForOrdinal` - and neither of them is retyped here.
 *
 * {@link REPAIR_PRICE_IN_LIFETIMES} is the one authored number in this module,
 * and it is authored where it can be argued with: A DOSE COSTS TWELVE TIMES
 * EVERYTHING THE PERSON IT WOULD SAVE COULD EARN IN THE WHOLE OF THE LIFE THEIR
 * RUNG GRANTED THEM. That single sentence produces the entire design:
 *
 *   NO PATIENT EVER BUYS THEIR OWN. Twelve lifetimes is not a saving plan. It
 *   is why this is a thing houses do to people rather than a thing people do.
 *
 *   THE LOW GRADES ARE A RICH FAMILY'S PURCHASE AND NOTHING ELSE'S. The mortal
 *   grade is about twelve Foundation Establishment lifetimes and the earth grade
 *   about twelve Core Formation ones, which is out of reach of every individual
 *   at those rungs and inside what a wealthy house can find. That is the
 *   concrete mechanism behind the advantage of birth: a well-born child who
 *   cracks is mended and goes on, and everybody else stops there.
 *
 *   THE MIDDLE GRADE IS PRICED AGAINST THE TOP OF THE LADDER, and it falls out
 *   rather than being set. Measured against what a Grand Ascension cultivator
 *   could accumulate across thirty thousand years, a Soul-Seating Pill is about
 *   a third of everything they will ever have, and against a Tribulation
 *   Transcender it is about a tenth. So the price is payable at exactly two
 *   heights in the world and it hurts at the lower of them, which is what
 *   {@link shareOfALifetimeAt} exists to state as a number rather than a claim.
 *
 *   AND THE DEITY-TRANSFORMATION REPAIR IS INSTITUTIONS-ONLY BY ARITHMETIC.
 *   Nothing declares that. It is simply that the figure exceeds what any
 *   individual below the Lid accumulates, so the only bodies that can hold one
 *   are bodies rather than people.
 *
 * The income curve caps (`EARNINGS_RANK_CAP`), which means the accumulation
 * curve above Nascent Soul is driven by lifespan alone. That is correct and it
 * is the setting: rank stops making anybody richer per year quite early, and
 * what the top of the ladder actually has more of is time.
 *
 * Pure. State in, numbers out. No world types, no I/O, no rolling.
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
    REPAIRED_IN_THE_CRUCIBLE,
    brokenStatusFor,
    clearBrokenStatus
} from './what-goes-wrong-at-a-realm-boundary.js';
import type { Injury } from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// THE CEILINGS
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * Computed off the catalog rather than written down: the highest reach among
 * the medicines that can actually be refined here. Today that is the end of
 * Deity Transformation, and a catalog edit that changed it would move this by
 * itself rather than leaving a constant behind to disagree.
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
 *
 * THE ONE GATE. Every caller goes through it and there is no path around it.
 * Four things have to be true and each of them is a different refusal:
 *
 *   the wound is structural at all      a heart demon is not this table's
 *                                       business, and neither is a torn
 *                                       meridian
 *   the medicine names it, or outranks   a grade reaches everything a lower
 *   something that names it              grade reaches
 *   the rung is under the medicine's     nothing below immortal grade above 28
 *   own ceiling
 *   the rung is under the world's        nothing at all above 40
 *   ceiling
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
 * A refusal is data. Somebody who asks a physician about a torn spirit sense
 * should be told which of these it is - that nothing made here reaches it is a
 * completely different answer from that the pill in the box is the wrong grade,
 * and the second one has a next step.
 */
export function repairRefusalReason(
    medicine: StructuralRepairMedicine,
    woundKey: string | null,
    atOrdinal: number
): string | null {
    if (!woundKey || !BROKEN_STATUSES.includes(woundKey)) {
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
    if (!medicine.mends.includes(woundKey) && !reachesFromBelow(medicine, woundKey)) {
        return 'Wrong grade. This is made for a different structure and it will not find this one, which is the ordinary way a house wastes one: the box was right, the break was not.';
    }
    return null;
}

/**
 * Whether a higher-graded medicine reaches a break a lower one is named for.
 *
 * The "or better" in `wounds.ts`: a Core-Knitting Pill answers a cracked core,
 * and so does everything above it. Expressed as a reach comparison rather than
 * as a grade ladder, so a new row declares its own coverage.
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
 * nothing.
 *
 * Null is the important answer and callers must not soften it. For a broken
 * step it is null forever; for a torn spirit sense it is an object nobody on
 * this side can make, which is a different kind of null and is why the refusal
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
 *
 * DROPPED rather than marked treated, and it is `clearBrokenStatus` next door
 * that does it rather than a second copy here - because it was not treated. The
 * structure was reseated and the injury is no longer a fact about this person.
 * Marking it treated would leave it counting as scar tissue against
 * `SCAR_PLATEAU` and charge somebody attrition for a wound they no longer have.
 *
 * Returns the wound list unchanged where the medicine does not reach, which is
 * the honest outcome: the dose is gone and the person is exactly where they
 * were. Check `mendsThisBreak` first if you need to know which happened.
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

// ─────────────────────────────────────────────────────────────────────────
// THE PRICE
// ─────────────────────────────────────────────────────────────────────────

/**
 * How many whole lifetimes of the patient's own accumulation a dose costs.
 *
 * The one authored number here. Twelve, because it has to be a figure no
 * individual can ever reach by saving and a figure a wealthy institution can
 * reach by deciding - and twelve puts the low grades inside what a great house
 * holds and the middle grade at a third of what the strongest cultivator in the
 * world will ever accumulate. Anything from about eight to about twenty tells
 * the same story; the round number in the middle is the one that does not have
 * to be defended against a content edit.
 */
export const REPAIR_PRICE_IN_LIFETIMES = 12;

/**
 * Everything somebody at this rung clears, after upkeep, across the whole span
 * their realm grants them.
 *
 * The unit every price on this page is quoted in. Note that it flattens above
 * Nascent Soul on the income side - `EARNINGS_RANK_CAP` - so what makes the top
 * of the ladder rich is span rather than rank, which is the setting stated as
 * arithmetic.
 */
export function lifetimeAccumulationAt(ordinal: number): number {
    return Math.max(0, netEarningsPerYear(ordinal)) * lifespanForOrdinal(ordinal);
}

/**
 * What a dose is WORTH in spirit stones - which is not always what it can be
 * bought for, and for two of the four it never is.
 *
 * Quoted at the rung the grade is the cheapest answer for, because that is the
 * rung the market for it exists at. Rounded to whole stones, because nobody
 * quotes a fraction of one at this scale.
 */
export function repairWeightInStones(medicine: StructuralRepairMedicine): number {
    return Math.round(REPAIR_PRICE_IN_LIFETIMES * lifetimeAccumulationAt(medicine.pricedAtOrdinal));
}

/**
 * What one actually costs to buy, or null where money is not the medium.
 *
 * Null for the immortal grade always, and null for the middle grade in the
 * ordinary case: there is no standing price for a Soul-Seating Pill, and the
 * only event that puts one in front of a buyer is a court body under enough
 * financial pressure to put its own up. {@link auctionReserveInStones} is what
 * that court would be looking for when it happens.
 *
 * Callers must not fall back to {@link repairWeightInStones} on a null. A thing
 * with a weight and no price is the entire point of the barter tier.
 */
export function repairCashPrice(medicine: StructuralRepairMedicine): number | null {
    return medicine.terms === 'private_sale' ? repairWeightInStones(medicine) : null;
}

/**
 * What a court putting one up would be looking for, or null where no auction
 * could ever happen.
 *
 * The same weight, because a distressed seller does not get a premium and the
 * bodies that could bid know exactly what the seller's position is. The reserve
 * existing at all is the concession; the price is not.
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
 * accumulate. 1 means it costs their whole life's earnings.
 *
 * The number that makes "for a Grand Ascension cultivator the price would hurt"
 * a fact rather than a phrase, and the one to quote when somebody asks whether a
 * person - as opposed to an institution - could pay.
 */
export function shareOfALifetimeAt(medicine: StructuralRepairMedicine, ordinal: number): number {
    const lifetime = lifetimeAccumulationAt(ordinal);
    if (!(lifetime > 0)) return Infinity;
    return repairWeightInStones(medicine) / lifetime;
}

/**
 * Whether an individual standing at this rung could ever pay for this out of
 * their own accumulation, spending everything they will ever have.
 *
 * The apex-only rule, computed rather than declared. Nobody anywhere passes this
 * for the Deity-Transformation repair, which is why only institutions hold one.
 */
export function anIndividualCouldPay(
    medicine: StructuralRepairMedicine,
    ordinal: number
): boolean {
    return shareOfALifetimeAt(medicine, ordinal) <= 1;
}

/**
 * The lowest rung at which one whole lifetime's accumulation would cover this,
 * or null where no rung on the ladder ever does.
 *
 * Reads out as the sentence the design asked for: the middle grade is payable
 * at the top of the ladder and nowhere else.
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

// ─────────────────────────────────────────────────────────────────────────
// THE SENT-DOWN COUNT
//
// The figure the standing register carries. Added up here rather than in the
// catalog, so the catalog stays inert and so the parts are forced to reconcile.
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// A READING OF THE WHOLE TABLE
// One row per medicine, everything derived, for the register and the probes.
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * The physician's answer sheet, and the honest one: three of these rows have no
 * medicine below the Lid and one has none anywhere. Derived from the wound keys
 * the crossing layer actually produces, so a break added there turns up here
 * with a null instead of being silently missing.
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
 *
 * A break is left by a crossing that LANDED, so the carrier is standing one
 * rung above the wall that broke them. Found by walking the ladder and asking
 * the crossing layer's own `brokenStatusFor` which status each wall leaves -
 * there is no second map of walls to breaks anywhere, and adding a realm
 * therefore does not require touching this file.
 */
export function ordinalCarrying(woundKey: string): number {
    for (let from = 0; from < MAX_ORDINAL; from++) {
        if (brokenStatusFor(from) === woundKey) return from + 1;
    }
    return NOTHING_REPAIRS_ABOVE_ORDINAL + 1;
}

/** The medicine row for an id, for callers holding only the id. */
export { getStructuralRepairMedicine };
