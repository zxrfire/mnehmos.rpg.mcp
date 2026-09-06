/**
 * What the ground somebody is standing on adds to a price, by type of good.
 *
 * The rule itself is `whatTheGroundDoesToPrices` in the world layer and lives
 * nowhere else. This is the glue that finds the world and the place for an MCP
 * caller, and it is a module rather than a private function because it was one:
 * the market board asked, and every other surface that quotes a figure - the
 * cure named after a pill that did not reach, the physician's price - did not,
 * so a war on the ground moved one of them.
 *
 * A run with no world at all is not an error and not a reason to refuse
 * anything. It reads as a quiet market, which is what it is.
 */

import type { Cultivator, Run } from '../../schema/cultivation.js';
import {
    whatTheGroundDoesToPrices,
    type GoodCategory,
    type GroundPricing
} from '../../engine/world/what-is-true-of-a-place-right-now.js';
import { worldForRun } from '../state/cultivation-world.js';
import { worldLocationFor } from '../../web/entities.js';

/** Nothing is going on here, or there is no world to ask. */
const A_QUIET_MARKET: GroundPricing = { everythingElse: 1, byCategory: {} };

/** Every type this ground has moved, and by how much. One pass, whole board. */
export async function whatThisGroundDoesToPrices(
    run: Run,
    cultivator: Cultivator
): Promise<GroundPricing> {
    try {
        const world = await worldForRun(run);
        const place = worldLocationFor(world, cultivator.location);
        if (!place) return A_QUIET_MARKET;
        return whatTheGroundDoesToPrices(
            world.statuses, world.locations, place.id, Math.floor(world.currentDay)
        );
    } catch {
        return A_QUIET_MARKET;
    }
}

/**
 * And the point read, for a caller pricing one row.
 *
 * Off the same aggregate rather than a second walk of the statuses, so the
 * board and the counter cannot come to different numbers for the same good.
 */
export async function whatThisGroundAddsToAPrice(
    run: Run,
    cultivator: Cultivator,
    category?: GoodCategory
): Promise<number> {
    const ground = await whatThisGroundDoesToPrices(run, cultivator);
    return dialFor(ground, category);
}

/** The dial for one type off an already-read ground. */
export function dialFor(ground: GroundPricing, category?: GoodCategory): number {
    if (category === undefined) return ground.everythingElse;
    return ground.byCategory[category] ?? ground.everythingElse;
}
