/** The same shelf read for an arranged successor and one actually founded by the world. */
import { expect } from 'vitest';
import type { WorldState } from '../../src/engine/world/world-state.js';
import { getTechnique } from '../../src/data/cultivation/techniques.js';
import { shelfOf } from '../../src/engine/world/manuals.js';
import { isANewHouseWithAWrittenRoad, theSuccessorsWrittenRoad } from './ladder-precondition.js';

export function aSuccessorReadsItsPhysicalRoad(world: WorldState, houseId: string, openingDay: number): void {
    expect(isANewHouseWithAWrittenRoad(world, houseId, openingDay)).toBe(true);
    const road = theSuccessorsWrittenRoad(world, houseId)!;
    expect(shelfOf(world, houseId)).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: road.data.techniqueId, cap: getTechnique(String(road.data.techniqueId))!.cap })
    ]));
}
