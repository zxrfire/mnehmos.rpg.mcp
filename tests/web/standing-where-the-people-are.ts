/**
 * Stand the player in the area of their place where the people a test needs are.
 *
 * A place is read into areas of at most three (`where-in-a-place-somebody-is-standing.ts`), and
 * moving somebody somewhere lands them where a road arrives. A test that moved the player and then
 * needs somebody standing with them walks them to where those people are, the way a player would.
 * `among` narrows who counts; with none, everybody does. Returns how many of them are there.
 */

import type { Harness } from './harness';
import { worldLocationFor } from '../../src/web/entities';
import { theAreasOf, type AnAreaOfAPlace } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import type { LocationRecord } from '../../src/engine/world/locations';
import type { WorldState } from '../../src/engine/world/world-state';

/** The area of a place the most people are standing in, the first among equals. */
export function theBusiestAreaOf(world: WorldState, place: LocationRecord): AnAreaOfAPlace {
    const { areas, whereIs } = theAreasOf(world, place);
    const count = (id: string) => [...whereIs.values()].filter(one => one === id).length;
    return areas.reduce((best, one) => (count(one.id) > count(best.id) ? one : best));
}

export async function standWhereThePeopleAre(
    harness: Pick<Harness, 'game' | 'repos'>,
    cultivatorId: string,
    among?: ReadonlySet<string>
): Promise<number> {
    const world = harness.game.atHand ?? await harness.game.loadWorld();
    const me = harness.repos.cultivators.getById(cultivatorId)!;
    const place = world ? worldLocationFor(world, me.location) : null;
    if (!world || !place) return 0;
    const { areas, whereIs } = theAreasOf(world, place);
    const counted = (areaId: string) => [...whereIs.entries()]
        .filter(([id, at]) => at === areaId && id !== cultivatorId && (among === undefined || among.has(id))).length;
    const best = areas.map(area => ({ area, here: counted(area.id) }))
        .reduce((top, one) => (one.here > top.here ? one : top));
    harness.repos.cultivators.standIn(cultivatorId, best.area.id);
    return best.here;
}
