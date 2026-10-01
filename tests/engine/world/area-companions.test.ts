/**
 * Companions were removed from the area bins and appended to whoever was already
 * there. Seven people talking to the player could therefore occupy one area;
 * the web roster hid the overflow with a slice while offers still read everyone.
 * Arrivals now take space in the same read. Overflow remains in another area,
 * including in a private room, and corpses and individually tracked beasts count.
 * Red-checked with a four-person cap: all three cases reject it.
 */
import { describe, expect, it } from 'vitest';
import { makeLocation } from '../../../src/engine/world/locations';
import { createNpc, markDead, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state';
import {
    aRoomOfTheirOwn, npcsWhereTheyStand, theAreasOf
} from '../../../src/engine/world/where-in-a-place-somebody-is-standing';

function arrangement() {
    const place = makeLocation({ id: 'town', name: 'A town', kind: 'settlement' });
    const npcs = Array.from({ length: 10 }, (_, i) => createNpc('area-cap', {
        id: `person-${i}`, name: `Person ${i}`, bornOnDay: -7300, onDay: 0, locationId: place.id
    }));
    for (const npc of npcs.slice(0, 7)) {
        npc.activity = { kind: 'talking', note: '', withIds: ['player'], sinceDay: 0, untilDay: 2 };
    }
    npcs[8]!.tags.push('spirit-beast');
    npcs[9] = markDead(npcs[9]!, 0, 'Died here.');
    npcs.push(createNpc('area-cap', {
        id: 'player', name: 'Player', bornOnDay: -7300, onDay: 0,
        locationId: place.id, tags: [PLAYER_ROW_TAG]
    }));
    return { place, state: { seed: 'area-cap', currentDay: 0, locations: [place], npcs, factions: [] } };
}

function capped(read: ReturnType<typeof theAreasOf>) {
    for (const area of read.areas) {
        const count = [...read.whereIs.values(), ...read.whereBodiesAre.values()].filter(id => id === area.id).length;
        expect(count, area.name).toBeLessThanOrEqual(3);
    }
}

describe('companions take room in an area', () => {
    it('places every companion, beast and body, excludes the player, and mutates nothing', () => {
        const { state, place } = arrangement();
        const before = structuredClone(state);
        const read = theAreasOf(state, place, undefined, { id: 'player' });
        capped(read);
        expect(read.whereIs.size).toBe(9);
        expect(read.whereIs.has('player')).toBe(false);
        expect(read.whereIs.has(state.npcs[8]!.id)).toBe(true);
        expect(read.whereBodiesAre.has(state.npcs[9]!.id)).toBe(true);
        expect(npcsWhereTheyStand(state, place, null, { id: 'player' }).length).toBeLessThanOrEqual(3);
        expect(state).toEqual(before);
    });

    it('keeps only three companions in a private room and leaves the others reachable outside', () => {
        const { state, place } = arrangement();
        const room = aRoomOfTheirOwn(place, 'player');
        const read = theAreasOf(state, place, undefined, { id: 'player', standingIn: room.id });
        capped(read);
        const here = npcsWhereTheyStand(state, place, room.id, { id: 'player' });
        expect(here).toHaveLength(3);
        for (const companion of state.npcs.slice(0, 7).filter(n => !here.some(one => one.id === n.id))) {
            const elsewhere = read.whereIs.get(companion.id)!;
            expect(elsewhere).not.toBe(room.id);
            expect(npcsWhereTheyStand(state, place, elsewhere, { id: 'player' }).map(n => n.id)).toContain(companion.id);
        }
    });

    it('bins arrivals held in other stores and reads again after activity expiry and movement', () => {
        const { state, place } = arrangement();
        const others = Array.from({ length: 8 }, (_, i) => ({ id: `visitor-${i}` }));
        const read = theAreasOf(state, place, undefined, { id: 'player', others });
        capped(read);
        expect(read.whereIs.size).toBe(17);
        for (const one of others) expect(read.whereIs.has(one.id)).toBe(true);
        state.currentDay = 4;
        state.npcs[0]!.locationId = null;
        const later = theAreasOf(state, place, undefined, { id: 'player', others });
        capped(later);
        expect(later.whereIs.has(state.npcs[0]!.id)).toBe(false);
        expect(later.whereIs.size).toBe(16);
    });
});
