/** Indoor departure is a real quarter-day walk. A lock changed during that walk
 * still holds; a due date alone cannot move a body or admit a passenger. */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { beginActualDepartureApproach, finishActualDepartureApproach } from '../../../src/engine/world/departure-approach.js';

function scene() {
    const world = createWorld({ seed: 'walk-before-boarding', regionCount: 0, skipPriorAges: true });
    world.currentHour = 0;
    const ground = makeLocation({ id: 'grounds', name: 'Cloud Pine grounds', kind: 'sect_seat' });
    const room = makeLocation({ id: 'room', name: 'The dwelling', kind: 'chamber', parentId: ground.id, tags: ['interior'] });
    world.locations.push(ground, room);
    const npc = createNpc(world.seed, { id: 'traveller', locationId: room.id, onDay: world.currentDay, bornOnDay: world.currentDay - 20*365 });
    world.npcs.push(npc);
    const berth = theAreasOf(world, ground).areas.find(area => area.for === 'spirit_berth')!;
    expect(berth).toBeDefined();
    return { world, npc, room, ground, request: { intentId: 'selected', target: { locationId: ground.id, areaId: berth.id } } };
}
it('walks an actual room to its enclosing berth before boarding', () => {
    const h = scene(), day = h.world.currentDay;
    const approach = beginActualDepartureApproach(h.world, h.npc.id, h.request, day);
    expect(approach.kind).toBe('approaching');
    if (approach.kind !== 'approaching') throw Error('Departure walk was not admitted');
    h.world.npcs[0] = approach.actor;
    expect(approach.actor.locationId).toBe(h.room.id);
    expect(approach.actor.activity?.untilDay).toBe(day + .25);
    expect(finishActualDepartureApproach(h.world, h.npc.id, h.request, day).kind).toBe('waiting');
    h.world.currentDay = day + .25;
    const arrived = finishActualDepartureApproach(h.world, h.npc.id, h.request, h.world.currentDay);
    expect(arrived.kind).toBe('ready');
    if (arrived.kind !== 'ready') throw Error('Actual walk did not arrive');
    expect(arrived.actor.locationId).toBe(h.ground.id);
    expect(arrived.actor.activity?.standingIn).toBe(h.request.target.areaId);
    expect(h.world.history.facts).toHaveLength(0);
});
it('rechecks a door closed during the actual walk and never boards', () => {
    const h = scene(), day = h.world.currentDay;
    const approach = beginActualDepartureApproach(h.world, h.npc.id, h.request, day);
    if (approach.kind !== 'approaching') throw Error('Departure walk was not admitted');
    h.world.npcs[0] = approach.actor;
    h.room.sealed = true;
    h.world.currentDay = day + .25;
    expect(finishActualDepartureApproach(h.world, h.npc.id, h.request, h.world.currentDay).kind).toBe('refused');
    expect(h.world.npcs[0]!.locationId).toBe(h.room.id);
    expect(h.world.history.facts).toHaveLength(0);
});
