/**
 * What a price board holds, and how one line of it reads.
 *
 * A stall's stock arrives as `MarketPrice` rows; `boardSample` decides which of
 * them a player is shown, because a board of forty lines is the engine talking
 * to itself; `priceOf` renders a single line in whichever currency that row is
 * denominated in, and `describePurseCash` says what the purse holds in the same
 * terms. `MORTAL_CATEGORIES` is the split between what anybody can buy and what
 * wants spirit stones.
 *
 * Moved out of `game.ts` unchanged. Two things read this - the `market` verb,
 * which builds the board, and `summariseToolBody`, which renders a board that
 * has already been built into the mechanical channel - and they must agree
 * about what a line says, which is the whole reason it is one module.
 */
import { round2 } from '../server/consolidated/cultivation-support.js';

/**
 * A price as the mortal-economy tool reports it.
 *
 * Both currencies, because the world has two on purpose: `mortal-world.ts`
 * anchors a hundred cash to the spirit stone precisely so that ordinary life
 * is priced in cash and cultivation is priced in stones.
 */
export interface MarketPrice {
    name?: string;
    category?: string;
    unit?: string;
    cash?: number;
    spiritStones?: number;
    affordable?: boolean;
}

/**
 * Categories that belong to ordinary life and are priced in cash.
 *
 * Rendering a bowl of millet as 0.01 spirit stones throws away the whole point
 * of the second currency and produces a number nobody can hold in their head.
 * One cash for the millet, a hundred and twenty for a month of rations: those
 * are figures a player can reason with.
 */
const MORTAL_CATEGORIES = new Set(['food', 'lodging', 'transport', 'medicine', 'service']);

const MARKET_LINES = 8;

/**
 * Which lines of a price board get read out, when it will not all fit.
 *
 * NOT the cheapest eight, which is what it used to be and which hid an entire
 * category of goods from every player in the game. `handleMarket` sorts by
 * price ascending; medicine runs 2,000-6,000 cash against a bowl of millet at
 * 1, so a board of 41 things showed millet, a ferry, salt, an inn, a letter, a
 * night's lodging, firewood and a bell - and the pills that close a torn
 * meridian sat thirty lines below the fold.
 *
 * That is not a cosmetic problem. Untreated meridian injuries are the leading
 * cause of death in this game, the cure is ON THIS BOARD, and a playtester
 * reading this list concluded across dozens of runs that no settlement sells
 * pills at all. They were there the whole time and off the bottom of the page.
 *
 * One line per category first, cheapest of each, so nothing a market sells can
 * be invisible; then the cheapest of whatever is left, so the board still opens
 * with what a poor cultivator can actually afford. The order within the result
 * is by price, because that is how a board reads.
 */
export function boardSample(prices: MarketPrice[]): MarketPrice[] {
    if (prices.length <= MARKET_LINES) return prices;

    const firstOfCategory = new Map<string, MarketPrice>();
    for (const item of prices) {
        const category = String(item.category ?? 'other');
        if (!firstOfCategory.has(category)) firstOfCategory.set(category, item);
    }

    const chosen = new Set<MarketPrice>([...firstOfCategory.values()].slice(0, MARKET_LINES));
    for (const item of prices) {
        if (chosen.size >= MARKET_LINES) break;
        chosen.add(item);
    }
    return prices.filter(item => chosen.has(item));
}

export function priceOf(item: MarketPrice): string {
    const unit = item.unit ? ` the ${item.unit}` : '';
    const mortal = item.category === undefined || MORTAL_CATEGORIES.has(item.category);

    if (mortal && typeof item.cash === 'number') {
        return `${Math.round(item.cash)} cash${unit}`;
    }
    // NOTHING IS PRICED IN A FRACTION OF A STONE.
    //
    // A stone is a large denomination - a hundred cash - so a bolt of cloth
    // came out as "0.5 spirit stones the bolt", which is not a price anybody
    // says out loud. It was invisible while the board only ever showed its
    // eight cheapest lines, all of which are food and lodging and quoted in
    // cash; surfacing one line per category brought it straight up, and
    // `presence.test.ts` had the rule written down waiting for it.
    //
    // Sub-stone goods are quoted in cash whatever their category. Cultivator
    // goods that genuinely cost stones still read in stones, which is the
    // distinction the currency exists to make.
    if (typeof item.spiritStones === 'number') {
        if (item.spiritStones < 1 && typeof item.cash === 'number') {
            return `${Math.round(item.cash)} cash${unit}`;
        }
        return `${round2(item.spiritStones)} spirit stones${unit}`;
    }
    return `an unmarked price${unit}`;
}

/**
 * The purse, in both currencies.
 *
 * The conversion appears here and almost nowhere else, which is where it
 * belongs: changing a stone for cash is the small moment a cultivator has when
 * they discover their savings are somebody's month of dinners.
 */
export function describePurseCash(purse: { cash?: number; spiritStones?: number }): string {
    const stones = typeof purse.spiritStones === 'number' ? purse.spiritStones : 0;
    const cash = typeof purse.cash === 'number' ? purse.cash : stones * 100;
    if (stones === 0) return `${Math.round(cash)} cash and no stones`;
    return `${stones} spirit stones, which is ${Math.round(cash)} cash`;
}

/** Market board categories the parser can narrow to. */
export const MARKET_CATEGORIES = [
    'food', 'lodging', 'transport', 'medicine', 'land', 'service', 'tool', 'information'
] as const;
