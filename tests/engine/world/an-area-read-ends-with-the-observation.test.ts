/**
 * The aged look profile repeatedly placed the same people into the same areas
 * while building one synchronous state view. Sharing that default observation
 * must preserve placement and release it before a later death or movement,
 * including when a reader throws. No area or person's position is stored.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc, markDead } from '../../../src/engine/world/npc-state.js';
import { theAreasOf, withPlaceAreaReadScope } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';

it.each([false, true])('reads the changed people after the observation ends (throws=%s)', throws => {
    const world = createWorld({ seed: 'area-observation', regionCount: 0, skipPriorAges: true });
    const place = makeLocation({ id: 'here', name: 'The actual ground', kind: 'wilds' });
    world.locations.push(place);
    const person = createNpc(world.seed, { id: 'person', bornOnDay: -7300, onDay: 0, locationId: place.id });
    world.npcs.push(person);
    const ordinary = theAreasOf(world, place);
    expect(ordinary.whereIs.has(person.id)).toBe(true);
    const observation = () => withPlaceAreaReadScope(() => {
        expect(theAreasOf(world, place)).toEqual(ordinary);
        expect(theAreasOf(world, place)).toEqual(ordinary);
        if (throws) throw new Error('observation failed');
    });
    if (throws) expect(observation).toThrow('observation failed'); else observation();
    world.npcs[0] = markDead(person, world.currentDay, 'Died after the observation.');
    const changed = theAreasOf(world, place);
    expect(changed.whereIs.has(person.id)).toBe(false);
    expect(changed.whereBodiesAre.has(person.id)).toBe(true);
});
