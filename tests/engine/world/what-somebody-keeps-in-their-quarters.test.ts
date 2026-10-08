/**
 * A house's rooms existed, but a member's working place stood in for their home
 * and every finite belonging stayed on their body. Assignment must survive a
 * posting, and storing reserves must conserve the objects rather than populate
 * an attractive room with invented treasure. Worn gear and a usable weapon stay
 * ready. Ordinary admission and departure use the same holdings as world open.
 *
 * Death is the important separation: goods at home stay on that ground even
 * when the person dies elsewhere, including the cached multi-death path. These
 * fixtures explicitly arrange rooms and goods; their IDs are fixture references,
 * never guesses about generated names or the world's distribution.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { linkLocations, makeLocation } from '../../../src/engine/world/locations.js';
import { makeObject, WORN_TAG } from '../../../src/engine/world/possessions.js';
import { whereAHouseLetsYouKeepThings } from '../../../src/engine/world/the-room-a-house-gives-you.js';
import { handBackTheirQuarters, handBackVacatedQuarters, keepTheirQuartersInOrder, physicalObjectPlace,
    putAwayWhatTheyDoNotCarry, quartersHolding, readQuartersTogether, releaseTheirQuartersAtDeath }
    from '../../../src/engine/world/what-somebody-keeps-in-their-quarters.js';
import { readDeathsTogether } from '../../../src/engine/world/reading-the-estates-settled-together.js';
import { settleNpcDeath } from '../../../src/engine/world/time.js';
import { enterWhoeverHasReachedTheHouse } from '../../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house.js';

function household() {
    const state = createWorld({ seed: 'quarters-belongings', regionCount: 0, skipPriorAges: true });
    const house = makeFaction({ id: 'fixture-house', name: 'Fixture House' });
    const home = makeLocation({ id: 'fixture-home', name: 'Shared lodging', kind: 'hall',
        controllingFactionId: house.id, data: { purpose: 'dormitory', precinctIndex: 0 } });
    const high = makeLocation({ id: 'fixture-high', name: 'Private lodging', kind: 'hall',
        controllingFactionId: house.id, data: { purpose: 'residence', precinctIndex: 2 } });
    const away = makeLocation({ id: 'fixture-away', name: 'Away ground', kind: 'wilds' });
    const npc = createNpc(state.seed, { id: 'fixture-person', name: 'Member', bornOnDay: -7300,
        onDay: 0, locationId: home.id });
    npc.factionId = house.id;
    npc.factionRankIndex = 0;
    state.npcs.push(npc);
    state.factions.push(house);
    state.locations.push(home, high, away);
    const holder = whereAHouseLetsYouKeepThings(house.id, npc.id);
    return { state, house, npc, home, high, away, holder };
}

describe('real belongings have a home independent of the working body', () => {
    it('keeps a travelling body\'s goods on the route rather than already at its stored destination', () => {
        const { state, npc, home, away } = household();
        const road = makeLocation({ id: 'fixture-road', name: 'Road stop', kind: 'wilds' });
        state.locations.push(road);
        linkLocations(away, road, 'road', 4);
        linkLocations(road, home, 'road', 4);
        npc.locationId = home.id;
        npc.activity = { kind: 'out_with_a_party', note: 'On the road.', withIds: [],
            fromLocationId: away.id, sinceDay: 0, untilDay: 30, returnTo: away.id };
        state.currentDay = 5;
        const goods = makeObject({ id: 'carried', name: 'Carried medicine', kind: 'pill', possessorId: npc.id });
        state.objects.push(goods, { ...goods, id: 'reserve' });
        const read = readQuartersTogether(state);
        expect(physicalObjectPlace(state, goods, read)?.locationId).toBe(road.id);
        expect(physicalObjectPlace(state, goods, read)?.locationId).not.toBe(home.id);
        expect(putAwayWhatTheyDoNotCarry(state, read)).toBe(0);
        expect(state.objects.every(object => object.possessorId === npc.id)).toBe(true);
    });
    it('keeps nested belongings at their holder\'s real place while a shared read follows a return', () => {
        const { state, npc, home, away, holder } = household();
        const chest = makeObject({ id: 'chest', name: 'Chest', kind: 'other', possessorId: holder });
        const book = makeObject({ id: 'book', name: 'Book', kind: 'manual', possessorId: chest.id });
        state.objects.push(chest, book);
        npc.locationId = away.id;
        const read = readQuartersTogether(state);
        expect(physicalObjectPlace(state, book, read)?.locationId).toBe(home.id);
        handBackTheirQuarters(state, npc.id, npc.factionId!, read);
        expect(physicalObjectPlace(state, book, read)?.locationId).toBe(away.id);
        expect(read.carrying(holder)).toEqual([]);
    });
    it('assigns the room while away and follows promotion without changing its holder', () => {
        const { state, npc, home, high, away, holder } = household();
        npc.locationId = away.id;
        expect(quartersHolding(state, holder)?.locationId).toBe(home.id);
        const goods = makeObject({ id: 'stored', name: 'Stored medicine', kind: 'pill',
            possessorId: holder, locationId: home.id });
        state.objects.push(goods);
        npc.factionRankIndex = 2;
        expect(physicalObjectPlace(state, goods)?.locationId).toBe(high.id);
        expect(goods.possessorId).toBe(holder);
    });

    it('puts duplicate finite goods away without altering wealth, ownership or worn gear', () => {
        const { state, npc, holder } = household();
        const gear = makeObject({ id: 'gear', name: 'Worn gear', kind: 'artifact',
            possessorId: npc.id, tags: [WORN_TAG] });
        const blade = makeObject({ id: 'blade', name: 'Usable blade', kind: 'artifact',
            possessorId: npc.id, power: 1 });
        const first = makeObject({ id: 'dose', name: 'Medicine', kind: 'pill', possessorId: npc.id,
            ownerId: npc.id, data: { catalogId: 'fixture-medicine' } });
        const spare = { ...first, id: 'reserve' };
        state.objects.push(gear, blade, first, spare);
        const wealth = npc.spiritStones;
        const before = state.objects.map(o => ({ id: o.id, ownerId: o.ownerId,
            volume: o.volume, weight: o.weight, data: o.data }));
        expect(putAwayWhatTheyDoNotCarry(state)).toBeGreaterThan(0);
        expect(state.objects.find(o => o.id === spare.id)?.possessorId).toBe(holder);
        for (const id of [gear.id, blade.id, first.id]) {
            expect(state.objects.find(o => o.id === id)?.possessorId).toBe(npc.id);
        }
        expect(state.objects.map(o => ({ id: o.id, ownerId: o.ownerId,
            volume: o.volume, weight: o.weight, data: o.data }))).toEqual(before);
        expect(npc.spiritStones).toBe(wealth);
    });

    it('does not move a remote body\'s possessions home', () => {
        const { state, npc, away } = household();
        npc.locationId = away.id;
        state.objects.push(...['a', 'b'].map(id => makeObject({ id, name: 'Medicine', kind: 'pill',
            possessorId: npc.id })));
        expect(putAwayWhatTheyDoNotCarry(state)).toBe(0);
        expect(state.objects.every(o => o.possessorId === npc.id)).toBe(true);
    });

    it('issues only ordinary mundane robes at opening, once even if stolen', () => {
        const { state, npc, holder, away, home } = household();
        npc.locationId = away.id;
        expect(keepTheirQuartersInOrder(state, 0)).toBe(0);
        expect(keepTheirQuartersInOrder(state, 0, true)).toBeGreaterThan(0);
        expect(state.objects.every(o => o.tags.includes('uniform') && o.significance === 'mundane')).toBe(true);
        expect(state.objects.some(o => o.possessorId === holder)).toBe(true);
        const issued = state.objects.length;
        state.objects[0] = { ...state.objects[0], possessorId: 'thief' };
        npc.locationId = home.id;
        keepTheirQuartersInOrder(state, 1);
        expect(state.objects).toHaveLength(issued);
        expect(state.objects[0].possessorId).toBe('thief');
    });

    it('reaches the same room holdings through the ordinary house-arrival pass', () => {
        const { state, holder } = household();
        enterWhoeverHasReachedTheHouse(state, 1);
        expect(state.objects.some(o => o.possessorId === holder && o.tags.includes('uniform'))).toBe(true);
    });

    it('hands back the actual goods on leaving without another copy', () => {
        const { state, npc, holder } = household();
        const stored = makeObject({ id: 'stored', name: 'Personal book', kind: 'manual',
            possessorId: holder, ownerId: npc.id });
        state.objects.push(stored);
        npc.factionId = null;
        expect(handBackVacatedQuarters(state)).toBe(1);
        expect(state.objects).toHaveLength(1);
        expect(state.objects[0]).toMatchObject({ id: stored.id, possessorId: npc.id,
            ownerId: npc.id, locationId: null });
    });

    it('leaves stored goods at home when death settles elsewhere, updating the shared read', () => {
        const { state, npc, holder, home, away } = household();
        state.objects.push(makeObject({ id: 'stored', name: 'Personal book', kind: 'manual',
            possessorId: holder, ownerId: npc.id, locationId: home.id }));
        npc.locationId = away.id;
        npc.status = 'physically_dead';
        const read = readDeathsTogether(state);
        settleNpcDeath(state, npc, 1, read);
        expect(state.objects.find(o => o.id === 'stored')).toMatchObject({
            possessorId: null, ownerId: npc.id, locationId: home.id });
        expect(read.carrying(holder)).toEqual([]);
        expect(read.carrying(npc.id)).toEqual([]);
        expect(releaseTheirQuartersAtDeath(state, npc, read)).toBe(0);
    });
});
