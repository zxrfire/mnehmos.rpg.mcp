/**
 * Certification found a former Clearwater Ward worker still at its indefinite
 * post after joining Myriad Course Hall at ages 175/200. Leaving now settles
 * membership, work and property together. Unpaid accounts survive the roll.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeObject, transferPossession, WORN_TAG } from '../../../src/engine/world/possessions.js';
import { aUniformFor, holdsTheTokenOf } from '../../../src/engine/world/a-recruit-is-given-their-lamp-at-the-house.js';
import { issueTo, theHouseTheirTokenNames } from '../../../src/engine/world/a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { offTheRoll, releaseTheRoll, ROGUE_EXPELLED } from '../../../src/engine/world/what-becomes-of-a-houses-people-when-it-is-gone.js';
import { settleLeavingHouse } from '../../../src/engine/world/leaving-a-house.js';
import { createDebt } from '../../../src/engine/social/grudges.js';
import { readTheRollAgainstTheHall } from '../../../src/engine/world/what-the-roll-and-the-lamps-say.js';
import { whoIsInChargeOfWhat } from '../../../src/engine/social-leverage/what-an-elder-is-in-charge-of.js';
import { whereAHouseLetsYouKeepThings } from '../../../src/engine/world/the-room-a-house-gives-you.js';
import { aStorageRing } from '../../../src/engine/world/a-storage-ring.js';

function fixture() {
    const state = createWorld({ seed: 'leaving', skipPriorAges: true, regionCount: 0 });
    const house = makeFaction({ id: 'house', name: 'The House', seatLocationId: 'seat' });
    state.factions.push(house);
    state.locations.push(makeLocation({ id: 'seat', name: 'Seat', kind: 'sect_seat' }),
        makeLocation({ id: 'lamps', name: 'Lamps', kind: 'hall', parentId: 'seat',
            data: { purpose: 'life_lamp_hall', factionId: house.id } }));
    const person = createNpc(state.seed, { id: 'member', name: 'Member', bornOnDay: 0, onDay: 1,
        factionId: house.id, factionRankIndex: house.ranks.length - 2, locationId: 'seat' });
    person.activity = { kind: 'stationed', note: 'Hall work.', withIds: [], sinceDay: 1, untilDay: null,
        returnTo: 'seat', houseWorkFactId: 'appointment',
        houseWorkSchedule: { periodDays: 7, offset: 0, shift: 'day', rota: true } };
    state.npcs.push(person);
    const issued = issueTo({ memberId: person.id, memberName: person.name,
        houseId: house.id, houseName: house.name, lampRoomId: 'lamps', onDay: 1 });
    const robes = aUniformFor({ memberId: person.id, houseId: house.id, houseName: house.name, onDay: 1 });
    const loan = transferPossession(makeObject({ id: 'loan', name: 'Loaned blade', kind: 'artifact',
        ownerId: house.id, ownerName: house.name, power: 1 }), {
        toHolderId: person.id, toHolderName: person.name, onDay: 2, how: 'lent', source: house.name
    });
    state.objects.push(issued.token, issued.lamp, robes, loan);
    return { state, house, person, issued, robes, loan };
}

describe('leaving is one settlement', () => {
    it('returns issued and lent property, releases work and office, and keeps gifts and accounts', () => {
        const { state, house, person, issued, robes, loan } = fixture();
        const gift = makeObject({ id: 'gift', name: 'Their blade', kind: 'artifact', power: 1,
            ownerId: person.id, possessorId: person.id });
        const kept = makeObject({ id: 'kept', name: 'Their book', kind: 'manual', ownerId: person.id,
            possessorId: whereAHouseLetsYouKeepThings(house.id, person.id) });
        state.objects.push(gift, kept);
        const debt = createDebt({ holderId: person.id, subjectId: house.id, cause: 'lent_resource',
            severity: 'serious', onDay: 1, description: 'Unpaid stones.', terms: 'Repay the stones.' });
        state.obligations.push(debt);
        const offices = () => whoIsInChargeOfWhat({ rooms: ['treasury'], rankCount: house.ranks.length,
            roll: state.npcs.filter(n => n.factionId === house.id).map(n => ({ id: n.id, rankIndex: n.factionRankIndex })) });
        expect(offices().some(office => office.holderId === person.id)).toBe(true);
        expect(readTheRollAgainstTheHall(state, house.id).some(row => row.memberId === person.id)).toBe(true);
        state.npcs[0] = offTheRoll(state, person, 10, `${ROGUE_EXPELLED}${house.id}`);
        expect(state.npcs[0]!.factionId).toBeNull();
        expect(state.npcs[0]!.factionRankIndex).toBe(-1);
        expect(state.npcs[0]!.activity?.houseWorkFactId).toBeUndefined();
        expect(state.npcs[0]!.activity?.houseWorkSchedule).toBeUndefined();
        expect(offices().some(office => office.holderId === person.id)).toBe(false);
        expect(readTheRollAgainstTheHall(state, house.id).some(row => row.memberId === person.id)).toBe(false);
        expect(state.objects.find(o => o.id === issued.lamp.id)).toEqual(issued.lamp);
        for (const object of [issued.token, robes, loan]) {
            const after = state.objects.find(o => o.id === object.id)!;
            expect(after.possessorId).toBeNull();
            expect(after.ownerId).toBe(house.id);
            expect(after.locationId).toBe(house.seatLocationId);
            expect(after.tags).not.toContain(WORN_TAG);
        }
        expect(theHouseTheirTokenNames(state.objects, person.id, () => true)).toBeNull();
        expect(state.objects.find(o => o.id === gift.id)).toEqual(gift);
        expect(state.objects.find(o => o.id === kept.id)?.possessorId).toBe(person.id);
        expect(state.obligations).toEqual([debt]);
    });

    it('cancels a token in other hands without taking their body or the stolen robe', () => {
        const { state, house, person, issued, robes } = fixture();
        for (const id of [issued.token.id, robes.id]) {
            const at = state.objects.findIndex(o => o.id === id);
            state.objects[at] = { ...state.objects[at]!, possessorId: 'thief' };
        }
        offTheRoll(state, person, 10, `${ROGUE_EXPELLED}${house.id}`);
        expect(theHouseTheirTokenNames(state.objects, 'thief', () => true)).toBeNull();
        expect(state.objects.find(o => o.id === robes.id)?.possessorId).toBe('thief');
        expect(state.objects.find(o => o.id === robes.id)?.ownerId).toBe(house.id);
    });

    it('keeps unreturned loans as distinct real debts, without duplicating or forgiving them', () => {
        const { state, house, person, loan } = fixture();
        const at = state.objects.findIndex(o => o.id === loan.id);
        state.objects[at] = { ...loan, possessorId: 'another-person' };
        state.objects.push({ ...loan, id: 'second-loan', possessorId: 'another-person' });
        offTheRoll(state, person, 10, `${ROGUE_EXPELLED}${house.id}`);
        expect(state.obligations).toHaveLength(2);
        expect(new Set(state.obligations.map(row => row.id)).size).toBe(2);
        for (const debt of state.obligations) expect(debt).toMatchObject({ kind: 'debt',
            holderId: person.id, subjectId: house.id, status: 'open', settlement: null });
        settleLeavingHouse(state, person, house.id, 11);
        expect(state.obligations).toHaveLength(2);
        state.objects[at] = { ...state.objects[at]!, possessorId: person.id };
        settleLeavingHouse(state, person, house.id, 12);
        expect(state.obligations.filter(row => row.status === 'settled')).toHaveLength(1);
        expect(state.objects[at]!.possessorId).toBeNull();
    });

    it('uses the same settlement when the house ends', () => {
        const { state, house, person, loan } = fixture();
        house.dissolvedOnDay = 10;
        releaseTheRoll(state, house, 10, 'rogue:house-fell:');
        expect(state.npcs[0]!.factionId).toBeNull();
        expect(state.npcs[0]!.activity?.houseWorkFactId).toBeUndefined();
        expect(state.objects.find(o => o.id === loan.id)?.possessorId).toBeNull();
        expect(state.npcs[0]!.id).toBe(person.id);
    });

    it('leaves remote property in its real hands, owed to its owner', () => {
        const { state, house, person, loan, robes } = fixture();
        state.locations.push(makeLocation({ id: 'town', name: 'Town', kind: 'settlement' }));
        state.npcs[0] = { ...person, locationId: 'town' };
        state.npcs[0] = offTheRoll(state, state.npcs[0]!, 10, `${ROGUE_EXPELLED}${house.id}`);
        for (const object of [loan, robes]) {
            expect(state.objects.find(o => o.id === object.id)?.possessorId).toBe(person.id);
            expect(state.objects.find(o => o.id === object.id)?.ownerId).toBe(house.id);
        }
        expect(state.obligations.filter(row => row.status === 'open')).toHaveLength(3);
        expect(theHouseTheirTokenNames(state.objects, person.id, () => true)).toBeNull();
        expect(holdsTheTokenOf(state.objects, person.id, house.id)).toBe(false);
        state.npcs[0] = { ...state.npcs[0]!, locationId: 'seat' };
        settleLeavingHouse(state, person, house.id, 12);
        expect(state.objects.find(o => o.id === loan.id)?.possessorId).toBeNull();
        expect(state.obligations.every(row => row.status === 'settled')).toBe(true);
    });

    it('returns a loan inside an accessible ring and keeps personal contents of a borrowed ring', () => {
        const { state, house, person, loan } = fixture();
        const ring = aStorageRing({ id: 'ring', grade: 'earth', ownerId: person.id,
            ownerName: person.name, ownerOrdinal: 10 });
        state.objects.push({ ...ring, tags: [...ring.tags, WORN_TAG] });
        const at = state.objects.findIndex(object => object.id === loan.id);
        state.objects[at] = { ...loan, possessorId: ring.id };
        const borrowedRing = transferPossession({ ...ring, id: 'borrowed-ring', ownerId: house.id }, {
            onDay: 2, toHolderId: person.id, toHolderName: person.name, how: 'lent' });
        state.objects.push({ ...borrowedRing, tags: [...borrowedRing.tags, WORN_TAG] },
            makeObject({ id: 'private', name: 'Private letter', kind: 'other', ownerId: person.id,
                possessorId: borrowedRing.id }));
        offTheRoll(state, person, 10, `${ROGUE_EXPELLED}${house.id}`);
        expect(state.objects.find(object => object.id === loan.id)?.possessorId).toBeNull();
        expect(state.objects.find(object => object.id === borrowedRing.id)?.possessorId).toBeNull();
        expect(state.objects.find(object => object.id === 'private')?.possessorId).toBe(person.id);
        expect(state.objects.find(object => object.id === ring.id)?.possessorId).toBe(person.id);
    });
});
