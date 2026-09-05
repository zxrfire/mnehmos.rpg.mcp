/**
 * Which pills are for sale, which are only ever traded for a favour, and what a
 * cash price actually is.
 *
 * THE PROBLEM IS YEARS. `scripts/probe-what-a-crossing-costs-in-years.ts` prices
 * ordinal 12 - the last rung of Qi Condensation - at 10,661 qi-units at 86 a
 * year, which is 123.6 YEARS against a Qi Condensation lifespan of 100. The last
 * rung of the realm costs more time than the realm grants, which is why the
 * histogram piles up at 12 and Foundation reads zero. No breakthrough probability
 * touches it: the roll is already ninety per cent, and it is never reached.
 *
 * There is no list of ids anywhere in this file and there must never be one.
 */

import type { Pill, TechniqueGrade } from '../../schema/cultivation.js';
import { PILLS } from '../../data/cultivation/pills.js';
import { pillBandOrdinal, pillBandDecay, PILL_GRADE_REALM } from './breakthrough.js';
import { netEarningsPerYear } from './origin.js';
import { REALM_TIERS } from './realms.js';

// THE LINE

export type PillTradeTier = 'commodity' | 'barter';

/**
 * Years of their own income somebody at the pill's own rank may be asked for
 * before the thing stops being a commodity.
 *
 * The catalog's own figures by grade are 0.7, 5.0, 45, 375 and 4,167 years, so
 * anything between about 6 and 40 puts the line in the same place; it sits at the
 * round number nearest the middle of that range so a catalog edit has to try hard
 * to trip over it. Read off the dearest row rather than per pill, because
 * per-pill the line falls INSIDE heaven grade - the Boundless Source Pill at
 * 1,800 stones is 8.1 years of a Nascent Soul's income and the Grain Abstinence
 * Pill at 9,000 is 40.7 - which would split one trade down the middle.
 */
export const COMMODITY_YEARS_OF_INCOME = 10;

/**
 * How many years of income this pill costs the rank it was made for.
 */
export function yearsOfIncomeFor(pill: Pill): number {
    const income = netEarningsPerYear(pillBandOrdinal(pill.grade));
    if (!(income > 0)) return Infinity;
    return pill.value / income;
}

/**
 * The tier of a whole grade, decided by the DEAREST thing in it.
 */
export function gradeTradeTier(grade: TechniqueGrade): PillTradeTier {
    const inGrade = PILLS.filter(p => p.grade === grade);
    if (inGrade.length === 0) return 'barter';
    const dearest = Math.max(...inGrade.map(yearsOfIncomeFor));
    return dearest <= COMMODITY_YEARS_OF_INCOME ? 'commodity' : 'barter';
}

/**
 * Whether this pill has a cash price at all. Its grade's answer and only its
 * grade's answer: there is no per-pill exception and there must never be one - a
 * cheap row inside a barter grade is still made by people who do not sell.
 */
export function pillTradeTier(pill: Pill): PillTradeTier {
    return gradeTradeTier(pill.grade);
}

/**
 * What one costs in spirit stones, or null where money is not what buys it. Null
 * is the whole point and callers must not fall back to `pill.value`: a barter
 * pill has a value - it is the most valuable thing in the room - and it still
 * does not have a price. The sentence is {@link cashRefusalReason}.
 */
export function pillCashPrice(pill: Pill): number | null {
    return pillTradeTier(pill) === 'commodity' ? pill.value : null;
}

/** Why the counter will not name a figure, or null where it will. */
export function cashRefusalReason(pill: Pill): string | null {
    if (pillTradeTier(pill) === 'commodity') return null;
    // AND THE SENTENCE NAMES THE VERB, BECAUSE THERE IS ONE NOW
    //
    // `asking.md`: *"a refusal may only name a door that exists."* This one
    // named three media and no way to offer any of them, and that was the whole
    // gap - every heaven-grade and above cure in the catalog was nameable,
    // priced, seeded onto real houses, and unobtainable, with this paragraph as
    // the closest the game came to admitting it. The last line is the sentence
    // a player can now type back, and
    // `tests/web/asking-what-it-would-take.test.ts` checks the parser accepts
    // it rather than trusting this string.
    return 'Nobody sells one of these for stones. Not at a high price, not at an absurd one: '
        + 'anybody holding one is already past caring what a purse is worth, and what they will '
        + 'listen to is a favour owed, something out of a hole nobody else has been down, or an '
        + 'art. Name what you have, not what you can pay - ask whoever is holding one what they '
        + 'would take for it, and then offer them that.';
}

// HOW IT IS KEPT

/** A quantity on a holder, or a row of its own. See the banner. */
export type PillStorageModel = 'count' | 'row';

/**
 * One threshold, the second consequence.
 */
export function pillStorageModel(pill: Pill): PillStorageModel {
    return pillTradeTier(pill) === 'commodity' ? 'count' : 'row';
}

// WHAT MONEY ACTUALLY BUYS: TIME
//
// The commodity tier's whole mechanical consequence. A cultivator with stones
// converts them into cultivation progress at whatever the open market charges,
// which shortens the years a rung takes - and the years are what the middle of
// the ladder was running out of.

/** Progress pills anybody can simply buy. Derived, never listed. */
/**
 * Computed once. `PILLS` is a static catalog and `pillTradeTier` is pure over it,
 * so the answer cannot change inside a process - and this is asked for every
 * cultivator, every year, through `stonesPerQiUnitAt`. A CPU profile of a
 * thousand-year advance put this function and its two neighbours at 2.2s of busy
 * time, all of it recomputing the same filter over the same array.
 */
let commodityProgress: readonly Pill[] | null = null;

export function commodityProgressPills(): readonly Pill[] {
    commodityProgress ??=
        PILLS.filter(p => p.effect === 'advance_progress' && pillTradeTier(p) === 'commodity');
    return commodityProgress;
}

/**
 * The last rung the open market has anything for.
 */
let marketCeiling: number | null = null;

export function commodityMarketCeiling(): number {
    if (marketCeiling !== null) return marketCeiling;
    let top = -1;
    for (const pill of PILLS) {
        if (pillTradeTier(pill) !== 'commodity') continue;
        const realm = REALM_TIERS.find(t => t.key === PILL_GRADE_REALM[pill.grade]);
        if (realm) top = Math.max(top, realm.ordinalEnd);
    }
    marketCeiling = top;
    return top;
}

/**
 * Spirit stones per qi-unit of progress, at the best terms the open market offers
 * somebody standing at this rung.
 */
const perQiUnit = new Map<number, number>();

export function stonesPerQiUnitAt(realmOrdinal: number): number {
    // Keyed on the rung, which is the whole of the input, and there are
    // forty-seven of them. Everything below is pure over the static catalog.
    const remembered = perQiUnit.get(realmOrdinal);
    if (remembered !== undefined) return remembered;

    // Past the last realm anybody sells for money, there is no price. Not a
    // high one - none. See `commodityMarketCeiling`.
    if (realmOrdinal > commodityMarketCeiling()) {
        perQiUnit.set(realmOrdinal, Infinity);
        return Infinity;
    }
    let best = Infinity;
    for (const pill of commodityProgressPills()) {
        const decay = pillBandDecay(pill.grade, realmOrdinal);
        const delivered = pill.potency * decay;
        if (!(delivered > 0)) continue;
        best = Math.min(best, pill.value / delivered);
    }
    perQiUnit.set(realmOrdinal, best);
    return best;
}

/**
 * Qi-units a year of this much spending actually buys at this rung.
 *
 * Zero for a cultivator with nothing spare, which is most of them and is the
 * reason the bottom of the ladder is untouched by any of this.
 */
export function purchasedQiPerYear(stonesPerYear: number, realmOrdinal: number): number {
    if (!Number.isFinite(stonesPerYear) || stonesPerYear <= 0) return 0;
    const price = stonesPerQiUnitAt(realmOrdinal);
    if (!Number.isFinite(price) || price <= 0) return 0;
    return stonesPerYear / price;
}
