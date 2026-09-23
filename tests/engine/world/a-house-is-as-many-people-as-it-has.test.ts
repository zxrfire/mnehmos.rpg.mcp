/**
 * A house's real size is a number that moves.
 *
 * Ruled by the design owner: the real size is *"just a # that changes with
 * time"*. The only figure the world held was the dormitory the compound was
 * built with, which never moved. Seats per rank were ruled to come off it too;
 * measured, that turned the slice's pyramid over, and `assessPromotions` still
 * reads the roll until that is ruled on (see the note there).
 *
 * What is stored is a count of people - the ones nobody models - and the real
 * size is the roll plus them. See `how-many-people-a-house-has.ts` for the rule.
 */

import { describe, expect, it } from 'vitest';

import { A_ROLL_A_PLAYER_COULD_KNOW } from '../../../src/engine/world/a-house-raises-its-own.js';
import { elderRungOf } from '../../../src/engine/cultivation/leadership.js';
import { seatsAtRank } from '../../../src/engine/world/promotion-inside-a-house.js';
import {
    PEOPLE_NOBODY_MODELS,
    howManyNobodyModels,
    howManyPeopleAHouseHas,
    oneOfTheRestIsNowSomebody,
    theHousesAreCounted,
    theRestMoveWithTheRoll
} from '../../../src/engine/world/how-many-people-a-house-has.js';
import { createNpc, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const HOUSE = 'house-of-hundreds';
const RANKS = ['Outer', 'Inner', 'Core', 'True', 'Elder', 'Grand Elder', 'Head'];

function member(id: string, rank: number, ordinal: number, merit = 100_000): NpcRecord {
    const npc = createNpc('real-size', { id, bornOnDay: 0, onDay: 0, cultivation: { realmOrdinal: ordinal } });
    return { ...npc, factionId: HOUSE, factionRankIndex: rank, merit: { houseId: HOUSE, points: merit } };
}

function quarters(sleeps: number) {
    return [{ id: 'dorm', name: 'the quarters', kind: 'room', tags: [], data: { factionId: HOUSE, purpose: 'dormitory', capacity: sleeps } }];
}

function world(npcs: NpcRecord[], sleeps: number | null): WorldState {
    const house = makeFaction({
        id: HOUSE, name: 'The Hall of Hundreds', ranks: RANKS,
        resources: { admission_ordinal: 2, power_ordinal: 30, spirit_stones: 1_000_000 }
    });
    return { factions: [house], npcs, locations: sleeps === null ? [] : quarters(sleeps) } as unknown as WorldState;
}

describe('how many people a house has', () => {
    it('is its roll and whoever its quarters sleep beyond it, until anybody has been counted', () => {
        const state = world([member('a', 0, 3)], 300);
        expect(howManyNobodyModels(state, HOUSE)).toBe(299);
        expect(howManyPeopleAHouseHas(state, HOUSE)).toBe(300);
    });

    it('is its roll alone where it has no quarters, because that house takes nobody in', () => {
        const state = world([member('a', 0, 3), member('b', 0, 3)], null);
        expect(howManyNobodyModels(state, HOUSE)).toBe(0);
        expect(howManyPeopleAHouseHas(state, HOUSE)).toBe(2);
    });

    it('reads the count once there is one', () => {
        const state = world(Array.from({ length: 6 }, (_, i) => member(`m${i}`, 0, 3)), 300);
        state.factions[0]!.resources[PEOPLE_NOBODY_MODELS] = 40;
        expect(howManyPeopleAHouseHas(state, HOUSE)).toBe(46);
    });
});

describe('the people nobody models move with what happens to the roll', () => {
    it('lose the share the roll lost, and gain back the share it gained', () => {
        const lost = theRestMoveWithTheRoll({ nobodyModels: 280, rollThen: 20, rollNow: 15, quartersSleep: 300 });
        expect(lost).toBeCloseTo(210);
        expect(theRestMoveWithTheRoll({ nobodyModels: lost, rollThen: 15, rollNow: 20, quartersSleep: 300 }))
            .toBeCloseTo(280);
    });

    it('read a short roll as a sample, so its last death does not empty a compound', () => {
        const after = theRestMoveWithTheRoll({ nobodyModels: 300, rollThen: 1, rollNow: 0, quartersSleep: 400 });
        expect(after).toBeCloseTo(300 * (1 - 1 / A_ROLL_A_PLAYER_COULD_KNOW));
    });

    it('never outgrow what the quarters sleep beside the roll', () => {
        expect(theRestMoveWithTheRoll({ nobodyModels: 270, rollThen: 20, rollNow: 30, quartersSleep: 300 })).toBe(270);
    });

    it('are written once a year, starting from the quarters, and then follow the roll', () => {
        const npcs = Array.from({ length: 20 }, (_, i) => member(`m${i}`, 0, 3));
        const state = world(npcs, 400);
        theHousesAreCounted(state);
        expect(state.factions[0]!.resources[PEOPLE_NOBODY_MODELS]).toBe(380);
        for (let i = 0; i < 10; i++) state.npcs[i] = { ...state.npcs[i]!, status: 'physically_dead' };
        theHousesAreCounted(state);
        expect(state.factions[0]!.resources[PEOPLE_NOBODY_MODELS]).toBeCloseTo(190);
    });

    it('lose one to the roll when one of them becomes somebody, and the roll does not read it as a joining', () => {
        const npcs = Array.from({ length: 20 }, (_, i) => member(`m${i}`, 0, 3));
        const state = world(npcs, 400);
        theHousesAreCounted(state);
        state.npcs.push(member('raised', 0, 3));
        oneOfTheRestIsNowSomebody(state.factions[0]!);
        theHousesAreCounted(state);
        expect(state.factions[0]!.resources[PEOPLE_NOBODY_MODELS]).toBe(379);
        expect(howManyPeopleAHouseHas(state, HOUSE)).toBe(400);
    });
});

describe('which count a rung is seated against', () => {
    const RANKS = 7;
    const ROLL = 16;
    const HOUSE_SIZE = 400;

    it('seats the sampled rungs against the roll, so a house of hundreds does not unbind them', () => {
        for (let rank = 1; rank < elderRungOf(RANKS); rank++) {
            expect(seatsAtRank(rank, RANKS, ROLL, 0, HOUSE_SIZE), `rung ${rank}`)
                .toBe(seatsAtRank(rank, RANKS, ROLL, 0));
        }
    });

    it('seats the elder band against the house, which is the rung the roll holds completely', () => {
        const elder = elderRungOf(RANKS);
        expect(seatsAtRank(elder, RANKS, ROLL, 0, HOUSE_SIZE))
            .toBeGreaterThan(seatsAtRank(elder, RANKS, ROLL, 0));
    });

    it('keeps the head and the grand elder at one chair each, whatever the house holds', () => {
        expect(seatsAtRank(RANKS - 1, RANKS, ROLL, 0, HOUSE_SIZE)).toBe(1);
        expect(seatsAtRank(RANKS - 2, RANKS, ROLL, 0, HOUSE_SIZE)).toBe(1);
        // A ladder short enough that its second rung from the top IS the elder
        // rung has no grand elder to seat, and that rung is a band.
        expect(seatsAtRank(2, 4, ROLL, 0, HOUSE_SIZE)).toBeGreaterThan(1);
    });
});
