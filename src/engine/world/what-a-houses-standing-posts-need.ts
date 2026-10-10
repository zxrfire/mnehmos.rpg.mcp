/**
 * How many people a house's standing posts take: its shopfronts (three a shopfront), the Temple's lower
 * cloisters (six a cloister), and the Span's surveyed terminals (kept like a shopfront).
 *
 * The owner, 2026-10-10: with the posts capped at about half the roll, "a house's roll might have to be
 * bigger too". So the roll a house keeps is never smaller than twice what its posts take: a full
 * staff away and as many at home. Read by the seeded roll and by the yearly intake alike.
 */
import { A_SHOPFRONT_HOLDS, shopfrontSitesOf } from './a-dao-house-shopfront.js';
import { A_BRANCH_HOLDS, templeBranchesOf } from './a-temple-branch.js';
import { publicWatchTargetsOf } from './where-a-house-keeps-its-public-watch.js';
import type { WorldState } from './world-state.js';

export function peopleAHousesStandingPostsTake(state: WorldState, houseId: string): number {
    const shopfronts = new Set([...shopfrontSitesOf(state, houseId), ...publicWatchTargetsOf(state, houseId)].map(site => site.id));
    return shopfronts.size * A_SHOPFRONT_HOLDS + templeBranchesOf(state, houseId).length * A_BRANCH_HOLDS;
}

/** The smallest roll that keeps a full staff on every standing post with as many at home. */
export function theRollItsPostsNeed(state: WorldState, houseId: string): number {
    return 2 * peopleAHousesStandingPostsTake(state, houseId);
}
