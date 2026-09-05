/**
 * What each rung of a house's own ladder requires, and where a newcomer sits.
 */

/** Realm ordinals a disciple must gain per rank step above admission. */
export const ORDINALS_PER_SECT_RANK = 4;

/** Contribution required for the first promotion; triples each step after. */
export const BASE_PROMOTION_CONTRIBUTION = 100;

/** In-world days per stipend payment. Sects pay monthly, like everyone else. */
export const STIPEND_PERIOD_DAYS = 30;

export function requiredOrdinalForRank(admissionOrdinal: number, rankIndex: number): number {
    return admissionOrdinal + rankIndex * ORDINALS_PER_SECT_RANK;
}

export function requiredContributionForRank(rankIndex: number): number {
    return Math.round(BASE_PROMOTION_CONTRIBUTION * Math.pow(3, Math.max(0, rankIndex - 1)));
}

/**
 * The seat somebody who has just arrived is put in, from what they visibly are.
 */
export function entryRankIndexFor(
    ranks: readonly string[],
    admissionOrdinal: number,
    ordinal: number
): number {
    for (let index = ranks.length - 2; index > 0; index--) {
        if (ordinal >= requiredOrdinalForRank(admissionOrdinal, index)) return index;
    }
    return 0;
}
