/**
 * Which pills are for sale, which are only ever traded for a favour, and why
 * the line falls where it does.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT WAS MEASURED FIRST, BECAUSE IT CHANGED WHAT THIS MODULE IS FOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This was written to answer "the middle of the ladder empties to zero across
 * five centuries, so make breakthrough pills buyable and that should refill it".
 * The first half of that is true and the second half is not, and the measurement
 * is worth keeping because it is the reason this module sells progress rather
 * than odds.
 *
 *   THE PILL WAS NEVER THE PROBLEM. `scripts/probe-pill-affordability.ts` runs
 *   four thousand lives through the real `deriveLife` and watches every crossing
 *   attempt. Inside Qi Condensation the mean breakthrough odds are 0.899 and the
 *   mean pill already bought is 0.39 of a full one - 3.9 half-pills or better per
 *   life. Nobody at the bottom of the ladder is failing crossings, and nobody is
 *   failing to buy a pill.
 *
 *   THE PROBLEM IS YEARS. `scripts/probe-what-a-crossing-costs-in-years.ts`
 *   prices the rungs for an ordinary cultivator on ordinary ground. Ordinal 12 -
 *   the last rung of Qi Condensation - needs 10,661 qi-units at 86 a year, which
 *   is 123.6 YEARS, against a Qi Condensation lifespan of 100. The last rung of
 *   the realm costs more time than the realm grants. That is why the histogram
 *   piles up at 12 and Foundation reads zero, and no amount of breakthrough
 *   probability touches it: the roll is already ninety per cent, and it is never
 *   reached.
 *
 * So the lever that exists and is unused is `advance_progress`, not
 * `boost_breakthrough`. At ordinal 12 a cultivator's own net income is 127
 * stones a year and the cheapest progress in the catalog is 1.17 stones per
 * qi-unit, which buys 109 qi a year against 86 accrued. Money is a second road
 * up, and it is one the engine already had a price list for and never read.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO TIERS, AND THE LINE IS COMPUTED RATHER THAN LISTED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * There is no list of ids anywhere in this file and there must never be one.
 * The question a pill is asked is:
 *
 *     HOW MANY YEARS OF THEIR OWN INCOME WOULD SOMEBODY AT THE RANK THIS PILL
 *     IS MADE FOR HAVE TO PUT ASIDE TO BUY ONE?
 *
 * Both halves of that are already in the engine. `pillBandOrdinal` resolves a
 * grade to the first rung of the realm it is pitched at, off `REALM_TIERS`. And
 * `netEarningsPerYear` is what a cultivator at that rung clears after upkeep.
 * The catalog answers, by grade:
 *
 *     mortal        0.7 years    a purchase
 *     earth         5.0 years    a decision, and still a purchase
 *     heaven         45 years    most of a working life for one swallow
 *     immortal      375 years
 *     chaos       4,167 years
 *
 * The gap between 5 and 45 is an order of magnitude and it is where the line
 * goes. {@link COMMODITY_YEARS_OF_INCOME} is the threshold, and the split is a
 * consequence rather than an assignment: nothing here knows that earth is the
 * last cash grade, it computes it, and a catalog edit that repriced a grade
 * would move the line by itself.
 *
 *   COMMODITY   Bought and sold for spirit stones, openly, at a price. Made,
 *               eaten and replaced constantly; nobody cares which one you took.
 *   BARTER      Not for sale at any price, and the reason is not scarcity. It is
 *               that the price exceeds what the income of the rank it serves
 *               could ever accumulate, so no cash sum is a rational trade for
 *               one. What moves them is a favour owed, a very rare artifact, a
 *               technique. Anybody holding one does not need money.
 *
 * The barter reasons are NOT invented here. `whyNotSold` in
 * `engine/world/single-use-dao-comprehension-materials.ts` already enumerates
 * them for comprehension materials - `afraid_to_sell`, `rainy_day`, `tribute`,
 * `a_favour_owed` - along with the observation that an obligation from somebody
 * at a height your house cannot reach is worth more than any price, exactly
 * once. That is the same trade in a different object and it uses the same
 * vocabulary. Callers on the world side should read the reason from there.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE THRESHOLD, TWO CONSEQUENCES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The same line decides how a pill is STORED, and that is the good sign rather
 * than a coincidence: a pill is cash-priced exactly where it is fungible and
 * barter-only exactly where it is singular.
 *
 *   COMMODITY -> `count`  A quantity on a holder. Three hundred identically
 *                         identified breakthrough pills is pure bookkeeping cost
 *                         for a fact that is one number. This is the model
 *                         `makeResourceLot` already documents in
 *                         `possessions.ts`, and the one `manuals.ts` uses for a
 *                         house's twenty intake primers.
 *   BARTER    -> `row`    One `ObjectRecord` each, with a holder, a provenance
 *                         and probably a name attached to how it was got. Where
 *                         a pill is worth a favour from somebody your house
 *                         cannot reach, WHICH one it is matters, and the moment
 *                         it moves that movement is something somebody should be
 *                         able to find out about two centuries later.
 *
 * A barter pill that is swallowed leaves its row behind, spent, exactly as a
 * comprehension material does. A pill that vanishes cleanly from the record is a
 * pill nobody can ever be asked about.
 *
 * Pure. No I/O, no database, no world types.
 */

import type { Pill, TechniqueGrade } from '../../schema/cultivation.js';
import { PILLS } from '../../data/cultivation/pills.js';
import { pillBandOrdinal, pillBandDecay, PILL_GRADE_REALM } from './breakthrough.js';
import { netEarningsPerYear } from './origin.js';
import { REALM_TIERS } from './realms.js';

// ─────────────────────────────────────────────────────────────────────────
// THE LINE
// ─────────────────────────────────────────────────────────────────────────

export type PillTradeTier = 'commodity' | 'barter';

/**
 * Years of their own income somebody at the pill's own rank may be asked for
 * before the thing stops being sold for money at all.
 *
 * Ten. A decade of putting money aside is a real purchase somebody plans for and
 * a market can quote; a century is not a price, it is a reason to want something
 * other than money for it.
 *
 * The catalog's own figures are 0.7, 5.0, 45, 375 and 4,167 years by grade, so
 * anything between about 6 and 40 puts the line in the same place. It is set at
 * the round number nearest the middle of that range on purpose: a threshold that
 * sits in the middle of an order-of-magnitude gap is one a catalog edit has to
 * try quite hard to trip over accidentally.
 */
export const COMMODITY_YEARS_OF_INCOME = 10;

/**
 * How many years of income this pill costs the rank it was made for.
 *
 * The one number the tier split is read off. Infinite where the rank clears
 * nothing, which cannot happen on the present curve but would be the honest
 * answer if it did.
 */
export function yearsOfIncomeFor(pill: Pill): number {
    const income = netEarningsPerYear(pillBandOrdinal(pill.grade));
    if (!(income > 0)) return Infinity;
    return pill.value / income;
}

/**
 * The tier of a whole grade, decided by the DEAREST thing in it.
 *
 * A grade is a market, and a market is open or it is not. The same cauldron,
 * the same ingredients and the same refiner produce every row of a grade, so
 * whether that trade deals in stones is one fact about the trade rather than a
 * fact about each object it makes.
 *
 * This is not a technicality. Measured per pill, the line falls INSIDE heaven
 * grade: the Boundless Source Pill at 1,800 stones is 8.1 years of a Nascent
 * Soul cultivator's income and the Grain Abstinence Pill at 9,000 is 40.7, so a
 * per-row threshold splits one trade down the middle and makes "readable off
 * grade" false. Read off the dearest row the grades are 0.65, 5.0, 40.7, 374
 * and 4,161 years, and the gap between the second and the third is a clean
 * order of magnitude with {@link COMMODITY_YEARS_OF_INCOME} sitting in it.
 */
export function gradeTradeTier(grade: TechniqueGrade): PillTradeTier {
    const inGrade = PILLS.filter(p => p.grade === grade);
    if (inGrade.length === 0) return 'barter';
    const dearest = Math.max(...inGrade.map(yearsOfIncomeFor));
    return dearest <= COMMODITY_YEARS_OF_INCOME ? 'commodity' : 'barter';
}

/**
 * Whether this pill has a cash price at all.
 *
 * Its grade's answer, and only its grade's answer. There is no per-pill
 * exception here and there must never be one: a cheap row inside a barter grade
 * is still made by people who do not sell, and a list of ids is exactly the
 * bespoke rule this whole module exists to avoid.
 */
export function pillTradeTier(pill: Pill): PillTradeTier {
    return gradeTradeTier(pill.grade);
}

/**
 * What one costs in spirit stones, or null where money is not what buys it.
 *
 * Null is the whole point and callers must not fall back to `pill.value` when
 * they get one: a barter pill has a value - it is the most valuable thing in the
 * room - and it still does not have a price. The sentence for somebody who asked
 * is {@link cashRefusalReason}.
 */
export function pillCashPrice(pill: Pill): number | null {
    return pillTradeTier(pill) === 'commodity' ? pill.value : null;
}

/** Why the counter will not name a figure, or null where it will. */
export function cashRefusalReason(pill: Pill): string | null {
    if (pillTradeTier(pill) === 'commodity') return null;
    return 'Nobody sells one of these for stones. Not at a high price, not at an absurd one: '
        + 'anybody holding one is already past caring what a purse is worth, and what they will '
        + 'listen to is a favour owed, something out of a hole nobody else has been down, or an '
        + 'art. Name what you have, not what you can pay.';
}

// ─────────────────────────────────────────────────────────────────────────
// HOW IT IS KEPT
// ─────────────────────────────────────────────────────────────────────────

/** A quantity on a holder, or a row of its own. See the banner. */
export type PillStorageModel = 'count' | 'row';

/**
 * One threshold, the second consequence.
 *
 * Deliberately `pillTradeTier` and nothing else. If these two ever need to
 * disagree, the disagreement is the design question and it should be answered
 * out loud rather than by letting a second constant drift in beside the first.
 */
export function pillStorageModel(pill: Pill): PillStorageModel {
    return pillTradeTier(pill) === 'commodity' ? 'count' : 'row';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT MONEY ACTUALLY BUYS: TIME
//
// The commodity tier's whole mechanical consequence. A cultivator with stones
// converts them into cultivation progress at whatever the open market charges,
// which shortens the years a rung takes - and the years are what the middle of
// the ladder was running out of.
// ─────────────────────────────────────────────────────────────────────────

/** Progress pills anybody can simply buy. Derived, never listed. */
/**
 * Computed once. `PILLS` is a static catalog and `pillTradeTier` is pure over
 * it, so the answer cannot change inside a process - and this is asked for
 * every cultivator, every year, through `stonesPerQiUnitAt`. A CPU profile of a
 * thousand-year advance put this function and its two neighbours at 2.2s of
 * busy time, all of it recomputing the same filter over the same array.
 */
let commodityProgress: readonly Pill[] | null = null;

export function commodityProgressPills(): readonly Pill[] {
    commodityProgress ??=
        PILLS.filter(p => p.effect === 'advance_progress' && pillTradeTier(p) === 'commodity');
    return commodityProgress;
}

/**
 * The last rung the open market has anything for.
 *
 * The end of the last realm any commodity pill is made for, computed off the
 * catalog rather than written down: today that is the end of Core Formation,
 * because earth grade is the dearest thing anybody sells for stones and earth
 * grade is pitched at Core Formation.
 *
 * ABOVE THIS, MONEY BUYS NO PROGRESS AT ALL, and that is the two-tier design
 * stated as a mechanic rather than as a price. A cultivator past Core Formation
 * who wants their accumulation shortened is shopping for a heaven-grade pill,
 * and nobody sells one: what moves it is a favour, an artifact out of a hole, or
 * an art. So the last four realms are closed to a purse however large, and the
 * upper ladder stays thin for the reason the setting gives rather than because a
 * constant was tuned until it did.
 *
 * This is load-bearing and it was measured. Without it,
 * `scripts/probe-rogues-and-houses.ts` puts three unbacked cultivators above
 * ordinal 29 on two seeds in five, which breaks the "even above something like
 * 29 is crazy rare" claim in `audit-alive-world.ts`. With it, the same sweep
 * puts none there on any seed and the middle bands keep everything they gained.
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
 * Spirit stones per qi-unit of progress, at the best terms the open market
 * offers somebody standing at this rung.
 *
 * Two things decide it and both already exist. The catalog's own value-per-
 * potency is the list price, and `pillBandDecay` is how much of a pill survives
 * being taken this far above the band it was made for - the ordinary curve every
 * other pill effect is read through, halving every eight rungs, so a cheap pill
 * quietly stops being a bargain to somebody strong rather than being cut off by
 * a rule.
 *
 * The consequence is the shape the setting wants and none of it is written down
 * anywhere: at the bottom of the ladder a cultivator earns almost nothing and
 * this buys almost nothing; in the middle it roughly doubles what a year is
 * worth; and at the top the decay and the income cap between them make it
 * irrelevant, so no fortune buys the last realms. Infinity where nothing on the
 * open market is any use at all, which is the correct answer above the point
 * where the commodity tier stops meaning anything.
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
