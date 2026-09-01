/**
 * Selling - the missing half of the market.
 *
 * ── What was wrong ───────────────────────────────────────────────────────
 *
 * Found by playing, not by reading. Foraging works, the pouch is real, and the
 * engine prices every stalk as it goes in: "one Qi Grass, mortal grade, worth
 * about 2 spirit stones." Nothing anywhere converted that back into stones. The
 * price board is one-directional - twenty-five lines, all of them things to buy
 * - and "I sell a Qi Grass" reached the party resolver and came back "no
 * knowledge record and nobody co-located".
 *
 * So the one trade a cultivator at the bottom of the ladder actually has - walk
 * into the hills, come back with something worth money - did not exist, and
 * alchemy had no economic point either, because a pill you cannot sell is a pill
 * you refined for nothing. That is most of why the bottom of the economy reads
 * as unfundable.
 *
 * ── What this is, and what it deliberately is not ────────────────────────
 *
 * It is a pure pricing function and nothing else. It holds no catalog, reads no
 * database, and knows about no particular kind of item: the caller passes the
 * list value the item's own catalog row already carries, and the row itself so
 * that `regardOf` can read the rung it is pitched at out of whichever column
 * that catalog happens to use (`harvestOrdinal` for a herb, `requiredOrdinal`
 * for a pill). There is no second price table here and there must never be one -
 * a sale is the buy board read from the other side.
 *
 * The margin is one constant applied through the ordinary regard multiplier,
 * which means the interesting behaviour falls out rather than being written:
 *
 *   selling something pitched at your own rung    ~60% of list
 *   selling something well beneath you            ~78% - nobody haggles with you
 *   selling something several rungs above you     ~20% - the room can see that
 *                                                  you cannot hold it, and prices
 *                                                  accordingly
 *
 * That last row is the one worth keeping. A beginner who finds a heaven-grade
 * herb is not robbed by a special case; they are met by the same table that
 * decides whether a job is offered to them.
 *
 * ── What the engine has no answer for yet ────────────────────────────────
 *
 * Selling something far above your rung should attract attention - a fence who
 * talks, a sect that hears, somebody waiting on the road out. `rogues.ts`
 * describes exactly that happening and the engine models none of it. The price
 * knows; nothing else does.
 */

import { regardOf, type Regard, type RegardAskerInput } from './regard.js';

/**
 * The buyer's cut at ordinary terms, as a fraction of list.
 *
 * 0.4 - a buyer pays about three fifths of what a thing is worth, which is the
 * usual figure for anyone selling to a trade rather than to an end user, and is
 * large enough to be a real reason to refine or hold rather than a rounding
 * error. It is deliberately one number: the whole variation between one sale
 * and another comes from regard, so there is exactly one place to tune this and
 * no per-catalog exception anywhere.
 */
export const BUYER_MARGIN = 0.4;

/**
 * The least any buyer will offer, as a fraction of list.
 *
 * Nobody gets nothing for a real object. Below this the transaction stops being
 * a bad price and becomes a refusal, and a refusal that arrives disguised as an
 * offer of zero is the worst of both.
 */
export const SALE_FLOOR_FRACTION = 0.1;

/** Nothing is ever bought for more than it is worth. */
export const SALE_CEILING_FRACTION = 1;

export interface SaleInput {
    /**
     * The catalog row being sold. Read ONLY by `regardOf`, for whichever gate
     * column that catalog uses. Pass the row itself rather than an ordinal so
     * that a record carrying a `regard` profile is honoured the same way it is
     * everywhere else.
     */
    item?: unknown;
    /** List value of ONE unit, in spirit stones, from the item's own row. */
    listStones: number;
    /** How many are being sold. Floored, and at least zero. */
    quantity: number;
    /** Who is standing at the counter. */
    seller: RegardAskerInput;
    /**
     * The region's own price multiplier, if the caller has one. The same
     * number the buy board is quoted through, so a province where things cost
     * more is a province where things fetch more.
     */
    localMultiplier?: number;
}

export interface SaleQuote {
    quantity: number;
    /** List value of one unit, before anything is applied. */
    listStones: number;
    /** What the whole lot is nominally worth: list x quantity x local. */
    grossStones: number;
    /** Fraction of gross actually offered, after margin and regard. */
    offeredFraction: number;
    /** What the buyer pays, in whole spirit stones. Never exceeds gross. */
    offeredStones: number;
    /** Stones per unit, for a line a player can check. May be fractional. */
    perUnitStones: number;
    /** The regard that priced it, so a caller can show its `reaction`. */
    regard: Regard;
    /** Engine-authored factual line. The narrator dresses it; it does not invent it. */
    line: string;
}

/**
 * Price a lot of one item, for one seller, at one counter.
 *
 * Pure. Same inputs, same quote, every time - there is no roll in a sale and
 * there should not be one: haggling that is a die roll makes the board a
 * slot machine, and the ladder is supposed to be the thing that decides.
 */
export function quoteSale(input: SaleInput): SaleQuote {
    const quantity = Number.isFinite(input.quantity) ? Math.max(0, Math.floor(input.quantity)) : 0;
    const listStones = Number.isFinite(input.listStones) ? Math.max(0, input.listStones) : 0;
    const local = Number.isFinite(input.localMultiplier ?? 1)
        ? Math.max(0, input.localMultiplier ?? 1)
        : 1;

    const regard = regardOf(input.item ?? null, input.seller);

    // The one line of arithmetic in the module. `priceMultiplier` is what this
    // person would PAY for a thing at this rung; the same distance from the
    // same rung is what the counter takes off them for selling one. Somebody
    // standing well above the ask is not cheated, and somebody holding
    // something they visibly cannot defend is.
    const offeredFraction = Math.max(
        SALE_FLOOR_FRACTION,
        Math.min(SALE_CEILING_FRACTION, 1 - BUYER_MARGIN * regard.priceMultiplier)
    );

    const grossStones = listStones * quantity * local;
    // Floored on the TOTAL, not per unit, so selling five things worth a stone
    // each is not five separate roundings down to nothing.
    const offeredStones = Math.floor(grossStones * offeredFraction);

    return {
        quantity,
        listStones,
        grossStones,
        offeredFraction,
        offeredStones,
        perUnitStones: quantity > 0 ? (grossStones * offeredFraction) / quantity : 0,
        regard,
        line: describeSale(quantity, grossStones, offeredStones, offeredFraction, regard)
    };
}

function describeSale(
    quantity: number,
    grossStones: number,
    offeredStones: number,
    fraction: number,
    regard: Regard
): string {
    if (quantity === 0) return 'Nothing was put on the counter.';
    if (offeredStones === 0) {
        return `Worth about ${round1(grossStones)} spirit stones the lot, and not enough of that ` +
            'survives a buyer\'s margin to be worth counting out. Nobody is being unfair; it is ' +
            'simply not much.';
    }
    const pct = Math.round(fraction * 100);
    const posture =
        regard.priceMultiplier > 1
            ? 'The counter can see this is worth more than the person holding it, and prices that in.'
            : regard.priceMultiplier < 1
                ? 'Nobody haggles at this counter, and the terms adjust without being asked.'
                : 'Ordinary terms.';
    return `${quantity} sold at ${pct} of what it is worth: ${offeredStones} spirit stone` +
        `${offeredStones === 1 ? '' : 's'} against a list of ${round1(grossStones)}. ${posture}`;
}

function round1(n: number): number {
    return Math.round(n * 10) / 10;
}

/**
 * The whole pouch, priced.
 *
 * Convenience for the commonest ask - "I sell what I gathered" - and nothing
 * more: it is `quoteSale` per lot plus a sum. The caller supplies the rows and
 * their list values, because the engine holds no catalog.
 */
export interface SaleLot {
    itemId: string;
    name: string;
    item?: unknown;
    listStones: number;
    quantity: number;
}

export interface PouchSaleQuote {
    lots: (SaleQuote & { itemId: string; name: string })[];
    /** Total stones the whole lot fetches. */
    offeredStones: number;
    /** Total list value of everything offered. */
    grossStones: number;
}

export function quotePouchSale(
    lots: readonly SaleLot[],
    seller: RegardAskerInput,
    localMultiplier = 1
): PouchSaleQuote {
    const priced = lots.map(lot => ({
        ...quoteSale({
            item: lot.item,
            listStones: lot.listStones,
            quantity: lot.quantity,
            seller,
            localMultiplier
        }),
        itemId: lot.itemId,
        name: lot.name
    }));
    return {
        lots: priced,
        offeredStones: priced.reduce((sum, lot) => sum + lot.offeredStones, 0),
        grossStones: priced.reduce((sum, lot) => sum + lot.grossStones, 0)
    };
}
