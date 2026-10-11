/**
 * The played room census read ten people across Clear River Alliance's rooms
 * but nine in its whole compound. Room placement already read actual journeys;
 * the whole-ground reader instead counted each stored destination. A departing
 * member was dropped before leaving, and an incoming member could count before
 * arriving. Both readings must use the same actual position, without moving a
 * body, finishing its trip or keeping another roster.
 */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { npcsStandingIn, npcsWithin, whereCompoundsAre } from '../../../src/engine/world/where-inside-a-house-somebody-is-standing.js';
import { whenTheyReachTheirPost } from '../../../src/engine/world/places-on-the-way.js';

for (const outward of [true, false]) {
    it(`counts a member only while their ${outward ? 'outward' : 'incoming'} posting actually puts them inside`, () => {
        const world = createWorld({ seed: 'actual-compound-census', regionCount: 0, skipPriorAges: true });
        world.currentDay = 10;
        world.currentHour = 0;
        const seat = makeLocation({ id: 'seat', name: 'Spring House grounds', kind: 'sect_seat',
            links: [{toLocationId:'town',kind:'road',travelDays:1,requiresKeyId:null,open:true,note:''}],
            data: { factionId: 'house' } });
        const town = makeLocation({ id: 'town', name: 'A nearby town', kind: 'settlement',
            links: [{toLocationId:'seat',kind:'road',travelDays:1,requiresKeyId:null,open:true,note:''}] });
        world.locations.push(seat,town);
        world.factions.push(makeFaction({ id: 'house', name: 'Spring House', seatLocationId: seat.id }));
        const person = createNpc(world.seed, { id: 'member', name: 'A posted member', onDay: 10,
            bornOnDay: -20 * 365, factionId: 'house', locationId: outward ? town.id : seat.id });
        person.activity = { kind: 'stationed', note: 'Serving the house post.', withIds: [],
            sinceDay: 10, untilDay: 50, fromLocationId: outward ? seat.id : town.id, returnTo: seat.id };
        world.npcs.push(person);
        const compounds = whereCompoundsAre(world), before = structuredClone(world);
        expect(npcsStandingIn(world,seat.id,compounds).map(npc=>npc.id)).toEqual(outward ? [person.id] : []);
        expect(npcsWithin(world,seat.id,compounds).map(npc=>npc.id)).toEqual(outward ? [person.id] : []);
        expect(world).toEqual(before);
        const reached = whenTheyReachTheirPost(world.locations,person);
        expect(reached).not.toBeNull();
        expect(reached!).toBeGreaterThan(world.currentDay);
        world.currentDay = reached!;
        const arrived = structuredClone(world);
        expect(npcsStandingIn(world,seat.id,compounds).map(npc=>npc.id)).toEqual(outward ? [] : [person.id]);
        expect(npcsWithin(world,seat.id,compounds).map(npc=>npc.id)).toEqual(outward ? [] : [person.id]);
        expect(world).toEqual(arrived);
    });
}
