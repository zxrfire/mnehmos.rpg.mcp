/**
 * What each rung of a house's own ladder requires. Where a newcomer sits is
 * `entry-offer.ts`: the bottom rung, or an elder's seat by the outsider's bar.
 */

/** Realm ordinals a disciple must gain per rank step above admission. */
export const ORDINALS_PER_SECT_RANK = 4;

/** Contribution required for the first promotion; triples each step after. */
export const BASE_PROMOTION_CONTRIBUTION = 100;

/** In-world days per stipend payment. Sects pay monthly, like everyone else. */
export const STIPEND_PERIOD_DAYS = 30;

export function requiredContributionForRank(rankIndex: number): number {
    return Math.round(BASE_PROMOTION_CONTRIBUTION * Math.pow(3, Math.max(0, rankIndex - 1)));
}
