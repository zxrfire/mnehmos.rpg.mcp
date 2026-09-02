/**
 * What each rung of a house's own ladder requires, and where a newcomer sits.
 *
 * Lifted out of `server/consolidated/sect-manage.ts` unchanged. It was always
 * mechanics rather than tool plumbing - a house's rank ladder is content, and
 * the curve that prices climbing it is the engine's - and it had to move for a
 * concrete reason as well as a tidy one: the probation placement in
 * `server/consolidated/sect-probation.ts` seats people by exactly this rule,
 * and importing it from `sect-manage.ts` closed a cycle through
 * `sect-guest.ts` that left `GuestSchema` undefined at module-init time
 * depending on which file a caller reached first. Eight tests, one error, and
 * no line of it anywhere near the thing that was actually wrong.
 *
 * `sect-manage.ts` re-exports all of it, so every existing importer is
 * unchanged.
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
 *
 * The promotion ladder read backwards, so the seat somebody is given on
 * arrival and the seat they could be raised to afterwards can never disagree.
 *
 * Contribution is deliberately not read: it is service rendered to THIS house
 * and a newcomer has none, which is exactly why this is entry and not
 * promotion. And the headship is excluded, because the top seat is a
 * succession rather than a promotion - filling it by the ordinary route would
 * quietly install a weaker head over a living master, which the world already
 * refuses to its own people and must therefore refuse to the player.
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
