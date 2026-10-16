/**
 * The owner ruled on 2026-10-10 that a small house does the same necessary work
 * without dedicated departments. Its existing quarters can keep the wounded,
 * its residence can keep the chest, and its forecourt can receive a visitor.
 * Assigning that work does not create a vein, tribute arrangement or craft hall.
 */
import { describe, expect, it } from 'vitest';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { roomForHouseWork, nameOfTheCareRoom, theHouseHasHoldingCells } from '../../../src/engine/world/where-a-house-does-its-work.js';
import { makeFaction } from '../../../src/engine/world/world-state.js';
import { hallsForRooms } from '../../../src/engine/world/house-halls.js';

const rooms = ['dormitory', 'residence', 'forecourt'].map(purpose => makeLocation({
    id: purpose, name: `Small House ${purpose}`, kind: 'hall',
    data: { factionId: 'small-house', purpose }
}));

describe('a house does its work with its actual rooms', () => {
    it('uses its quarters for care, residence for stores and forecourt for visitors', () => {
        expect(roomForHouseWork(rooms, 'small-house', 'infirmary')?.id).toBe('dormitory');
        expect(roomForHouseWork(rooms, 'small-house', 'treasury')?.id).toBe('residence');
        expect(roomForHouseWork(rooms, 'small-house', 'archive')?.id).toBe('residence');
        expect(roomForHouseWork(rooms, 'small-house', 'audience_hall')?.id).toBe('forecourt');
        expect(nameOfTheCareRoom(roomForHouseWork(rooms, 'small-house', 'infirmary')!)).toContain('set aside for the wounded');
        expect(rooms).toHaveLength(3);
    });

    it('prefers a dedicated room when the house has one', () => {
        const clinic = makeLocation({ id: 'clinic', name: 'Small House infirmary', kind: 'hall',
            data: { factionId: 'small-house', purpose: 'infirmary' } });
        expect(roomForHouseWork([...rooms, clinic], 'small-house', 'infirmary')).toBe(clinic);
        expect(nameOfTheCareRoom(clinic)).toBe(clinic.name);
    });

    it('supplies neither a physical craft facility nor a resource arrangement', () => {
        for (const purpose of ['vein_chamber', 'tribute_room', 'alchemy_hall', 'artifact_refining_hall'] as const)
            expect(roomForHouseWork(rooms, 'small-house', purpose)).toBeNull();
        expect(hallsForRooms(['dormitory', 'residence', 'forecourt']).map(hall => hall.id))
            .toEqual(['outer-affairs', 'internal-affairs']);
    });

    it('still hears charges after its holding arrays go dark', () => {
        const seat = makeLocation({ id: 'seat', name: 'Small House', kind: 'sect_seat',
            data: { factionId: 'small-house', formationNodesTotal: 20, formationNodesLit: 10 } });
        const discipline = makeLocation({ id: 'discipline', name: 'Discipline Hall', kind: 'hall',
            data: { factionId: 'small-house', purpose: 'punishment_hall' } });
        const state = { locations: [...rooms, seat, discipline], factions: [makeFaction({
            id: 'small-house', name: 'Small House', seatLocationId: seat.id })] };
        expect(theHouseHasHoldingCells(state, 'small-house')).toBe(true);
        seat.data.formationNodesLit = 0;
        expect(theHouseHasHoldingCells(state, 'small-house')).toBe(false);
        expect(roomForHouseWork(state.locations, 'small-house', 'punishment_hall')).toBe(discipline);
    });
});
