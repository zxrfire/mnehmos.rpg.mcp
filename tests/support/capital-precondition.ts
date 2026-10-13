/** A real visiting house factor physically at a capital with an ordinary unsold consignment. */
import type { WorldState } from '../../src/engine/world/world-state.js';
import { capitalPlaces } from '../../src/engine/world/capital-missions-and-calendar.js';
import { locationOnNpcJourney } from '../../src/engine/world/places-on-the-way.js';
import { isRuined } from '../../src/engine/world/possessions.js';
import { whatThisThingIs } from '../../src/engine/world/what-a-house-gives-merit-for.js';
import { pendingAuctionLots, witnessIndexFor } from '../../src/engine/world/witness-reaction-index.js';
import { getPill } from '../../src/data/cultivation/pills.js';
import { pillCashPrice } from '../../src/engine/cultivation/buying-and-bartering-pills.js';

export function theActualFactorsCargo(world: WorldState, personId: string, cityId: string): string[] {
    const person = world.npcs.find(person => person.id === personId);
    if (!person || person.status !== 'alive' || !person.factionId || person.locationId !== cityId
        || !world.factions.some(house => house.id === person.factionId && house.dissolvedOnDay === null)
        || !person.activity || !['stationed', 'out_with_a_party'].includes(person.activity.kind)
        || !capitalPlaces(world).some(city => city.id === cityId)
        || locationOnNpcJourney(world.locations, person, world.currentDay) !== cityId) return [];
    const mission = person.activity.capitalMissionId ? witnessIndexFor(world).byId.get(person.activity.capitalMissionId) : null;
    if (person.activity.capitalMissionId && mission?.data.destinationId !== cityId) return [];
    const auctioned = new Set(pendingAuctionLots(world).map(lot => lot.data.objectId));
    return world.objects.filter(object => {
        if (!object.tags.includes('exchange') || object.possessorId !== personId || object.ownerId !== person.factionId
            || isRuined(object) || auctioned.has(object.id)) return false;
        const thing = whatThisThingIs(object);
        if (!thing || thing.marketStones == null) return false;
        return object.kind !== 'pill' || !!getPill(thing.kindId) && pillCashPrice(getPill(thing.kindId)!) !== null;
    }).map(object => object.id);
}

export const isAnActualCapitalFactor = (world: WorldState, personId: string, cityId: string): boolean =>
    theActualFactorsCargo(world, personId, cityId).length > 0;
