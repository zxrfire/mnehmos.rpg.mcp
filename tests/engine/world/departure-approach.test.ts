/** Indoor departure is a real fifteen-minute walk. A lock changed during that walk
 * still holds; a due date alone cannot move a body or admit a passenger.
 * The finisher ignored currentHour when checking a fractional arrival. The
 * native control requires completion at the actual hour, not the next day. */
import { LOCAL_WALK_DAYS } from '../../../src/engine/world/local-walking-cost.js';
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
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
it('spends fifteen minutes walking an actual room to its enclosing berth before boarding', () => {
    const h = scene(), day = h.world.currentDay;
    const approach = beginActualDepartureApproach(h.world, h.npc.id, h.request, day);
    expect(approach.kind).toBe('approaching');
    if (approach.kind !== 'approaching') throw Error('Departure walk was not admitted');
    h.world.npcs[0] = approach.actor;
    expect(approach.actor.locationId).toBe(h.room.id);
    expect(approach.actor.activity?.untilDay).toBe(day + LOCAL_WALK_DAYS);
    expect((approach.actor.activity!.untilDay! - day) * 24 * 60).toBeCloseTo(15);
    expect(finishActualDepartureApproach(h.world, h.npc.id, h.request, day).kind).toBe('waiting');
    h.world.currentDay = day + LOCAL_WALK_DAYS;
    const arrived = finishActualDepartureApproach(h.world, h.npc.id, h.request, h.world.currentDay);
    expect(arrived.kind).toBe('ready');
    if (arrived.kind !== 'ready') throw Error('Actual walk did not arrive');
    expect(arrived.actor.locationId).toBe(h.ground.id);
    expect(arrived.actor.activity?.standingIn).toBe(h.request.target.areaId);
    expect(h.world.history.facts).toHaveLength(0);
});
it('finishes at the actual hour and refuses a future completion before that hour', () => {
    const h = scene(), day = h.world.currentDay;
    h.world.currentHour = 8;
    const approach = beginActualDepartureApproach(h.world, h.npc.id, h.request, day + 8 / 24);
    if (approach.kind !== 'approaching') throw Error('Departure walk was not admitted');
    h.world.npcs[0] = approach.actor;
    const arrival = approach.actor.activity!.untilDay!;
    h.world.currentHour = 8 + LOCAL_WALK_DAYS * 24 / 2;
    expect(finishActualDepartureApproach(h.world, h.npc.id, h.request, arrival).kind).toBe('waiting');
    h.world.currentHour = 8 + LOCAL_WALK_DAYS * 24;
    const arrived = finishActualDepartureApproach(h.world, h.npc.id, h.request, arrival);
    expect(arrived.kind).toBe('ready');
    if (arrived.kind !== 'ready') throw Error('The actual local walk did not arrive');
    expect(arrived.actor.locationId).toBe(h.ground.id);
    expect(arrived.actor.activity?.standingIn).toBe(h.request.target.areaId);
});
it('rechecks a door closed during the actual walk and never boards', () => {
    const h = scene(), day = h.world.currentDay;
    const approach = beginActualDepartureApproach(h.world, h.npc.id, h.request, day);
    if (approach.kind !== 'approaching') throw Error('Departure walk was not admitted');
    h.world.npcs[0] = approach.actor;
    h.room.sealed = true;
    h.world.currentDay = day + LOCAL_WALK_DAYS;
    expect(finishActualDepartureApproach(h.world, h.npc.id, h.request, h.world.currentDay).kind).toBe('refused');
    expect(h.world.npcs[0]!.locationId).toBe(h.room.id);
    expect(h.world.history.facts).toHaveLength(0);
});


it('reads the held key at each real locked exit, including its loss during the walk',()=>{
    const h=scene(),day=h.world.currentDay;
    h.room.sealed=true;h.room.data.keyId='dwelling-token';
    const key=makeObject({id:'dwelling-key',name:'Jade dwelling token',kind:'key',possessorId:h.npc.id,
        data:{keyId:'dwelling-token'}});
    h.world.objects.push(key);
    const approach=beginActualDepartureApproach(h.world,h.npc.id,h.request,day);
    expect(approach.kind).toBe('approaching');
    if(approach.kind!=='approaching')throw Error('The held key did not open the exit');
    h.world.npcs[0]=approach.actor;h.world.currentDay=day+LOCAL_WALK_DAYS;
    key.tags.push('ruined');
    expect(finishActualDepartureApproach(h.world,h.npc.id,h.request,h.world.currentDay).kind).toBe('refused');
    expect(h.world.npcs[0]!.locationId).toBe(h.room.id);
});
