/**
 * What a journey eats, said as facts: before setting out whether the pack covers the road, and after it what was eaten.
 *
 * Only the player's own pack is counted; the world's people are not fed by
 * arithmetic. Days of food are `whatFeedingThisStretchCosts`'s, the one copy of
 * that sum, with nothing bought. A carriage seat feeds its passengers, so a
 * trip on one eats nothing from the pack. A ship feeds them from the hull's
 * rations, and a passage that outruns those opens the pack.
 */

import { SATIETY_MAX, type Cultivator } from '../schema/cultivation.js';
import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';
import { whatFeedingThisStretchCosts } from './what-feeding-a-stretch-of-seclusion-costs.js';

/** Said before a walk the food carried will not cover. Null where it does, or nobody needs to eat. */
export function whetherThePackCoversTheRoad(
    cultivator: Cultivator,
    rationsCarried: number,
    roadDays: number
): string | null {
    const plan = whatFeedingThisStretchCosts({ ...cultivator, spiritStones: 0 }, rationsCarried, roadDays);
    if (plan.hungerHasStopped || plan.coversTheWholeStretch) return null;
    return `The pack and the belly hold ${howMany(plan.covered, 'day')} of food; the road is ${roadDays}.`;
}

/** A paid seat's meals, which is why the pack was not opened. */
export function whatWasEatenOnBoard(after: Cultivator, rationsLeft: number): string {
    return `Meals were taken on board; nothing came out of the pack, which holds ${howMany(rationsLeft, 'ration')}. `
        + `The belly is at ${after.satiety} of ${SATIETY_MAX}.`;
}

/** A ship's meals: the hull's rations, and the pack once the passage outran them. */
export function whatTheHullFed(
    after: Cultivator,
    hullRationDays: number,
    daysAtSea: number,
    packEaten: number,
    rationsLeft: number
): string {
    if (daysAtSea <= hullRationDays) return whatWasEatenOnBoard(after, rationsLeft);
    return `The ship's rations ran out on day ${hullRationDays} of ${daysAtSea}; `
        + `${howMany(packEaten, 'ration')} came out of the pack, ${rationsLeft} left. `
        + `The belly is at ${after.satiety} of ${SATIETY_MAX}.`;
}

/** What the road ate out of the pack, and what is left. */
export function whatTheRoadAte(after: Cultivator, rationsCarried: number, rationsLeft: number): string {
    const eaten = Math.max(0, rationsCarried - rationsLeft);
    return `Eaten on the road: ${howMany(eaten, 'ration')} from the pack, ${rationsLeft} left; `
        + `the belly is at ${after.satiety} of ${SATIETY_MAX}.`;
}
