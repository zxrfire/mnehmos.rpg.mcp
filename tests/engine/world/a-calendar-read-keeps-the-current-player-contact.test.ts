/**
 * Flight boundary reads filtered the whole population for players once per
 * native person. One synchronous read may share that lookup, but must retain
 * an enclosing contact's date and area and release its scope afterward.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state.js';
import { isPlayerInvolved, playerAtTheContact, readPlayerInvolvementTogether,
    resolveWithPlayerPresent } from '../../../src/engine/world/background-incident-draw.js';

it('reads the same involved people and releases its temporary player scope', () => {
    const world = createWorld({ seed: 'calendar-contact', regionCount: 0, skipPriorAges: true });
    const player = createNpc(world.seed, { id: 'player', locationId: 'home', bornOnDay: -7300, onDay: 0, tags: [PLAYER_ROW_TAG] });
    const nearby = createNpc(world.seed, { id: 'nearby', locationId: 'home', bornOnDay: -7300, onDay: 0 });
    const distant = createNpc(world.seed, { id: 'distant', locationId: 'away', bornOnDay: -7300, onDay: 0 });
    world.npcs.push(player, nearby, distant);
    const read = () => world.npcs.map(person => isPlayerInvolved(world, person));
    const before = read();
    expect(readPlayerInvolvementTogether(world, read)).toEqual(before);
    expect(before).toEqual([true, true, false]);
    world.npcs.splice(0, 1);
    expect(readPlayerInvolvementTogether(world, read)).toEqual([false, false]);
});

it('preserves an enclosing dated contact and restores it when a nested read throws', () => {
    const world = createWorld({ seed: 'dated-calendar-contact', regionCount: 0, skipPriorAges: true });
    world.currentDay = 20;
    const player = createNpc(world.seed, { id: 'player', locationId: null, bornOnDay: -7300, onDay: 0, tags: [PLAYER_ROW_TAG] });
    const companion = createNpc(world.seed, { id: 'companion', locationId: null, bornOnDay: -7300, onDay: 0 });
    companion.activity = { kind: 'idle', sinceDay: 0, untilDay: 10, withIds: [player.id], note: 'Travelling together.' };
    world.npcs.push(player, companion);
    const contact = { placeId: 'contact-ground', areaId: 'contact-area', person: player };
    resolveWithPlayerPresent(world, contact, () => {
        expect(readPlayerInvolvementTogether(world, () => isPlayerInvolved(world, companion))).toBe(true);
        expect(() => readPlayerInvolvementTogether(world, () => { throw new Error('read failed'); })).toThrow('read failed');
        expect(playerAtTheContact(world)).toMatchObject({ id: player.id, placeId: contact.placeId, areaId: contact.areaId });
        expect(isPlayerInvolved(world, companion)).toBe(true);
    }, 5);
    expect(isPlayerInvolved(world, companion)).toBe(false);
    expect(playerAtTheContact(world)).toBeNull();
});

