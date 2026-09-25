/**
 * A house built a thing, and a house can sell it.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * The design owner, on sects trading with each other: *"why should they not?"*
 *
 * `WHAT_A_CRAFT_COSTS_TO_COMMISSION` has three carriage rows and no hull row,
 * and that absence is correct and deliberate: a hull is 2,400 days of work by
 * hands almost nobody has, so nobody commissions one new. The consequence
 * nobody had drawn is that a hull could therefore reach a second house by NO
 * route at all. `ownership-transfer.ts` names four ways a thing changes hands
 * and had functions for the two contested ones; the uncontested one - bought -
 * had none, so the only craft in the world worth trading could not be traded.
 *
 * ── WHAT IT GOES FOR IS THE BILL, NOT A NUMBER CHOSEN HERE ───────────────
 *
 * A fourth price row would be a second opinion about what a craft is worth, and
 * it would disagree with the commission table the first time either moved. So a
 * craft with no price of its own is priced against the dearest craft that HAS
 * one, by the only figure the two bills differ in that anybody pays for:
 * `workDays`. A titled carriage is 700 days and 40,000 stones; a hull is 2,400
 * days, so a hull is 40,000 x 2,400/700 = 137,143.
 *
 * That is a figure with a provenance rather than a feel, and it lands where the
 * setting already says it should: seeded house purses run 200 to 1,400
 * (`seeding.ts`), so no house in a fresh world can buy one at any price, and at
 * a hundred years the measured median purse is around 150,000 - a hull is the
 * whole of what a middling house has, and pocket change to the top tenth.
 *
 * ── WHO SELLS, AND WHO BUYS, ARE BOTH READINGS THAT EXIST ────────────────
 *
 * Not a rate and not a taste for trade. `howThePurseIsRunning` already answers
 * whether a house made payroll and `what-a-house-does-when-it-cannot-pay.ts`
 * already treats that answer as a motive; `circleCandidatesFor` is already the
 * one answer to which houses are on terms, and a gathering and a visit both run
 * off it. A sale asks those two rather than inventing a greed dial and a trade
 * partner rule.
 *
 * Which is also why there is no seller who is simply greedy: an object has no
 * preferences, what is true is that the elders agree to let it go, and what
 * moves them is the empty chest.
 *
 * Pure. Two houses and a thing in, a decision out. Nothing here moves a stone
 * or writes a ledger row - see `applyWhatAHouseHadToSell` for the half that does.
 */

import {
    WHAT_A_CRAFT_COSTS_TO_COMMISSION,
    getConveyance,
    recipeForConveyance
} from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import type { ObjectRecord } from './possessions.js';

/**
 * What one craft would fetch, or null where the world does not price it.
 *
 * Null is the honest answer for a row that is not property - soaring on one's
 * own blade - and for anything this file cannot reach a bill for. A caller
 * getting null has not been told zero.
 */
export function whatACraftWouldFetch(conveyanceId: string): number | null {
    const stated = WHAT_A_CRAFT_COSTS_TO_COMMISSION[conveyanceId];
    if (stated !== undefined) return stated;

    const kind = getConveyance(conveyanceId);
    if (kind === undefined || kind.holding === 'personal' || kind.holding === 'none') return null;
    const bill = recipeForConveyance(conveyanceId);
    if (bill === undefined) return null;

    // The dearest craft the table DOES price, and its bill. Read off the two
    // tables rather than named, so a fourth commission row or a fifth recipe
    // joins this without anybody editing it.
    let anchorId: string | null = null;
    let anchorPrice = -1;
    for (const [id, price] of Object.entries(WHAT_A_CRAFT_COSTS_TO_COMMISSION)) {
        if (price > anchorPrice && recipeForConveyance(id) !== undefined) {
            anchorId = id;
            anchorPrice = price;
        }
    }
    if (anchorId === null) return null;
    const anchorBill = recipeForConveyance(anchorId)!;
    if (anchorBill.workDays <= 0) return null;
    return Math.round(anchorPrice * (bill.workDays / anchorBill.workDays));
}

/** A house as this question needs it. */
export interface AHouseAtTheTable {
    id: string;
    name: string;
    purse: number;
}

export interface WhatChangedHands {
    craft: ObjectRecord;
    buyer: AHouseAtTheTable;
    price: number;
    /** What the seller was short of, in stones. The whole of why it went. */
    shortBy: number;
}

/**
 * The best thing this house could sell, and who would take it.
 *
 * Null where nothing goes: nothing to sell, nobody on terms who can pay, or a
 * sale that would not cover what the house is short of. That last one is the
 * one worth stating - a house does not sell its hull to be slightly less broke,
 * and a sale that leaves the roll unpaid is a house that lost its hull AND its
 * people.
 *
 * THE CHEAPEST THING THAT COVERS IT, not the dearest. A house short of a year's
 * wages sells the carriage before it sells the hull, and a rule that reached for
 * the most valuable thing first would have a house hand over the only craft in
 * the province to settle a debt a lesser one would have cleared. Ties break on
 * the object's own id, so the answer does not depend on what order the caller
 * walked its objects in.
 */
export function whatAHouseWouldSell(input: {
    seller: AHouseAtTheTable;
    /** Everything the seller owns. Filtered here; the caller need not know what a craft is. */
    owns: readonly ObjectRecord[];
    /** Houses it would sit down with. `circleCandidatesFor`, and no second rule. */
    circle: readonly AHouseAtTheTable[];
    /** What it failed to pay this year. A solvent house is not asked. */
    shortBy: number;
}): WhatChangedHands | null {
    if (input.shortBy <= 0) return null;

    const onOffer: { craft: ObjectRecord; price: number }[] = [];
    for (const thing of input.owns) {
        const id = thing.data.conveyanceId;
        if (typeof id !== 'string') continue;
        const price = whatACraftWouldFetch(id);
        if (price === null || price <= 0) continue;
        onOffer.push({ craft: thing, price });
    }
    if (onOffer.length === 0) return null;
    onOffer.sort((a, b) => a.price - b.price || (a.craft.id < b.craft.id ? -1 : 1));

    const buyers = [...input.circle].sort(
        (a, b) => b.purse - a.purse || (a.id < b.id ? -1 : 1));

    for (const offer of onOffer) {
        // WHAT IT WOULD FETCH IS NOT WHAT IT SETTLES. A sale that does not
        // cover the shortfall is a house handing over the one thing it has and
        // still not making payroll, which nobody agrees to.
        if (offer.price < input.shortBy) continue;
        const buyer = buyers.find(b => b.id !== input.seller.id && b.purse >= offer.price);
        if (buyer === undefined) continue;
        return { craft: offer.craft, buyer, price: offer.price, shortBy: input.shortBy };
    }
    return null;
}
