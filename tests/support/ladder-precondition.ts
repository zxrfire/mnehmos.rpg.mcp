/** A generated successor holds an actual written physical road. */
import type { WorldState } from '../../src/engine/world/world-state.js';
import { SECTS } from '../../src/data/cultivation/sects.js';
import { getTechnique } from '../../src/data/cultivation/techniques.js';
import { isRuined } from '../../src/engine/world/possessions.js';

export function isANewHouseWithAWrittenRoad(world: WorldState, houseId: string, openingDay: number): boolean {
    const house = world.factions.find(house => house.id === houseId);
    if (!house || house.dissolvedOnDay !== null || house.foundedOnDay === null || house.foundedOnDay <= openingDay
        || house.foundedOnDay > world.currentDay
        || SECTS.some(row => row.id === houseId)) return false;
    return theSuccessorsWrittenRoad(world, houseId) !== null;
}

/** The predicate and scenario select physical stock through this one reader. */
export function theSuccessorsWrittenRoad(world: WorldState, houseId: string): WorldState['objects'][number] | null {
    return world.objects.find(object => {
        if (object.kind !== 'manual' || object.possessorId !== houseId || isRuined(object)
            || typeof object.data.techniqueId !== 'string') return false;
        const art = getTechnique(object.data.techniqueId);
        return art?.cap != null && art.cap > 12 && typeof object.data.writtenOutBy === 'string'
            && typeof object.data.writtenOnDay === 'number' && object.data.writtenOnDay <= world.currentDay
            && world.npcs.some(person => person.id === object.data.writtenOutBy);
    }) ?? null;
}
