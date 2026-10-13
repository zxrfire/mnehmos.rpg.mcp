/**
 * Capital census presence must describe people who can actually do their work.
 * Arrange a visiting member's physically held consignment through ordinary
 * writers, then run the shared offer scenario. The separate cached capitals
 * census finds isAnActualCapitalFactor across ages/seeds and passes a real
 * visiting factor into that same scenario as a contract check.
 */
import { it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { PROVINCIAL_CAPITALS } from '../../../src/data/cultivation/regions.js';
import { anActualCapitalFactorOffersItsCargo } from '../../support/capital-scenario.js';

it('offers the actual consignment at its physically occupied capital', () => {
    const world = createWorld({ seed: 'actual-capital-counter', presentYear: 0, regionCount: 0, skipPriorAges: true });
    const city = makeLocation({ id: 'capital', name: Object.values(PROVINCIAL_CAPITALS)[0]!, kind: 'settlement', tags: ['city'] });
    const house = makeFaction({ id: 'sending-house', name: 'Reed House' });
    const person = createNpc(world.seed, { id: 'factor', name: 'Factor', locationId: city.id,
        bornOnDay: -20 * 365, onDay: world.currentDay });
    person.factionId = house.id;
    person.activity = { kind: 'stationed', note: 'The house counter.', sinceDay: world.currentDay, untilDay: null, withIds: [] };
    world.locations.push(city); world.factions.push(house); world.npcs.push(person);
    world.objects.push(makeObject({ id: 'held-consignment', name: 'Qi Grass', kind: 'material',
        ownerId: house.id, possessorId: person.id, locationId: city.id, tags: ['exchange'], data: { materialId: 'herb-qi-grass' } }));
    anActualCapitalFactorOffersItsCargo(world, person.id, city.id);
});
