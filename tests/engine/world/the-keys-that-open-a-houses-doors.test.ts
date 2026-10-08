/**
 * Audit 2026-10-03: architecture generated lock ids, but no ordinary key row
 * existed. Rank could not unlock a door and no played borrower could obtain its
 * key. Opening keys must use the real office deal and normal possession; they
 * are never replacement keys created by succession or yearly housekeeping.
 * These small fixtures name their arranged rooms/persons, not generated offices.
 * Death uses the generic estate path, without a key exception. Audit found its
 * body-link overwrites existing title, contrary to items.md147-177 and its own
 * header; the generic estate-title correction preserves known ownership. These key
 * assertions protect actual physical loss and history without pinning that bug.
 * Claims are not fabricated beside the existing generic claim mechanism.
 */
import { expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation, evaluateAccess } from '../../../src/engine/world/locations.js';
import { seedTheKeysThatOpenAHouse } from '../../../src/engine/world/the-keys-that-open-a-houses-doors.js';
import { portfoliosIn } from '../../../src/engine/social-leverage/authority-for-an-order.js';
import { transferPossession } from '../../../src/engine/world/possessions.js';
import { advanceTime, settleNpcDeath } from '../../../src/engine/world/time.js';
import { theDoorKeysTheyActuallyCarry } from '../../../src/web/the-door-keys-they-actually-carry.js';
import { FALSE_IMMORTAL_ORDINAL } from '../../../src/engine/cultivation/realms.js';

function lockedHouse() {
    const state = createWorld({ seed: 'opening-door-keys', regionCount: 0, skipPriorAges: true });
    const house = makeFaction({ id: 'key-house', name: 'Key House', ranks: ['Junior', 'Elder', 'Head'] });
    const court = makeLocation({ id: 'key-court', name: 'Forecourt', kind: 'hall', controllingFactionId: house.id });
    const room = makeLocation({ id: 'key-treasury', name: 'Treasury fixture', kind: 'hall',
        controllingFactionId: house.id, sealed: true,
        data: { factionId: house.id, purpose: 'treasury', keyId: 'key:fixture:treasury' } });
    const custodian = createNpc(state.seed, { id: 'key-custodian', name: 'Custodian fixture',
        bornOnDay: -7300, onDay: 0, locationId: court.id });
    custodian.factionId = house.id;
    custodian.factionRankIndex = 2;
    state.factions.push(house);
    state.locations.push(court, room);
    state.npcs.push(custodian);
    state.objects.push(...seedTheKeysThatOpenAHouse(state));
    const key = state.objects.find(o => o.kind === 'key')!;
    return { state, house, court, room, custodian, key };
}

it('the actual office holder carries the ordinary key and rank alone never opens the door', () => {
    const h = lockedHouse();
    expect(h.key.data.keyId).toBe(h.room.data.keyId);
    expect(h.key.description).toContain(`${h.room.name} is engraved`);
    expect(h.key.ownerId).toBe(h.house.id);
    expect(h.key.possessorId).toBe(h.custodian.id);
    expect(evaluateAccess(h.room, { realmOrdinal: FALSE_IMMORTAL_ORDINAL }).closed).toBe(true);
    expect(evaluateAccess(h.room, { realmOrdinal: FALSE_IMMORTAL_ORDINAL,
        keyIds: theDoorKeysTheyActuallyCarry(h.state.objects, h.custodian.id) }).closed).toBe(false);
});

it('the existing acting office cover holds the opening key when there is no separate office holder', () => {
    const h = lockedHouse();
    const rooms = ['archive', 'punishment_hall', 'treasury'] as const;
    for (const purpose of rooms.filter(p => p !== 'treasury')) h.state.locations.push(makeLocation({
        id: `key-${purpose}`, name: `${purpose} fixture`, kind: 'hall', controllingFactionId: h.house.id,
        sealed: true, data: { factionId: h.house.id, purpose, keyId: `key:fixture:${purpose}` } }));
    const offices = portfoliosIn({ locations: h.state.locations, sectId: h.house.id,
        roll: [{ id: h.custodian.id, rankIndex: h.custodian.factionRankIndex }], rankCount: h.house.ranks.length });
    const acting = offices.find(p => p.actingId !== null && p.actingId !== undefined)!;
    expect(acting).toBeDefined();
    expect(acting.holderId).toBe(acting.actingId);
    const room = h.state.locations.find(p => p.data.purpose === acting.purpose)!;
    const key = seedTheKeysThatOpenAHouse(h.state).find(k => k.data.keyId === room.data.keyId)!;
    expect(key.possessorId).toBe(acting.actingId);
});

it('an empty office leaves its key stored in the actual room, without fabricating a custodian', () => {
    const h = lockedHouse();
    h.state.npcs = [];
    const keys = seedTheKeysThatOpenAHouse(h.state);
    expect(keys).toHaveLength(1);
    expect(keys[0].possessorId).toBeNull();
    expect(keys[0].locationId).toBe(h.room.id);
});

it('the office can pass to another real member without moving the physical key', () => {
    const h = lockedHouse();
    const replacement = createNpc(h.state.seed, { id: 'new-custodian', name: 'Replacement fixture',
        bornOnDay: -7300, onDay: 0, locationId: h.court.id });
    replacement.factionId = h.house.id;
    replacement.factionRankIndex = 2;
    h.custodian.factionRankIndex = 0;
    h.state.npcs.push(replacement);
    const offices = portfoliosIn({ locations: h.state.locations, sectId: h.house.id,
        roll: h.state.npcs.map(n => ({ id: n.id, rankIndex: n.factionRankIndex })), rankCount: h.house.ranks.length });
    expect(offices.find(p => p.purpose === 'treasury')?.holderId).toBe(replacement.id);
    expect(h.key.possessorId).toBe(h.custodian.id);
    expect(theDoorKeysTheyActuallyCarry(h.state.objects, replacement.id)).toEqual([]);
});

it('theft and loss move the same key and an ordinary year does not mint its replacement', () => {
    const h = lockedHouse();
    const stolen = transferPossession(h.key, { onDay: 0, toHolderId: 'fixture-thief', toHolderName: 'Thief', how: 'stolen' });
    expect(stolen.id).toBe(h.key.id);
    expect(stolen.ownerId).toBe(h.house.id);
    expect(theDoorKeysTheyActuallyCarry([stolen], h.custodian.id)).toEqual([]);
    const lost = transferPossession(stolen, { onDay: 0, toHolderId: null, toHolderName: 'Nobody', how: 'lost' });
    h.state.objects = h.state.objects.map(o => o.id === lost.id ? { ...lost, locationId: h.court.id } : o);
    const later = advanceTime(h.state, 366, { stopOnInterrupt: false }).state;
    expect(later.objects.filter(o => o.data.keyId === h.room.data.keyId)).toHaveLength(1);
    expect(later.objects.find(o => o.id === lost.id)?.possessorId).toBeNull();
    later.objects = later.objects.filter(o => o.id !== lost.id);
    const absentLater = advanceTime(later, 366, { stopOnInterrupt: false }).state;
    expect(absentLater.objects.some(o => o.data.keyId === h.room.data.keyId)).toBe(false);
});

it('death leaves the same key at the body through the current generic estate rule', () => {
    const h = lockedHouse();
    h.custodian.status = 'physically_dead';
    settleNpcDeath(h.state, h.custodian, 0);
    const left = h.state.objects.find(o => o.id === h.key.id)!;
    expect(left.possessorId).toBeNull();
    expect(left.locationId).toBe(h.court.id);
    expect(left.provenance.some(p => p.source === h.house.name)).toBe(true);
});
