/**
 * A minority stay, fight and die with a house that is finished.
 *
 * Ruled by the design owner. Everywhere the world decides who scatters -
 * `releaseTheRoll` when a house stops existing, `whetherTheyFall` when somebody
 * comes for the compound - every single person was trying to leave. Some are
 * not, more of them where the roll is a family and where the house asked its
 * people to believe something, and they are always the few.
 *
 * ── WHAT WAS MEASURED, seed `stay-a` at world open ───────────────────────
 *
 *     family / righteous    2 houses,  34 people,  10 would stay  (29.4%)
 *     family / neutral      4 houses,  63 people,  10 would stay  (15.9%)
 *     sect   / righteous    9 houses, 130 people,  20 would stay  (15.4%)
 *     sect   / neutral     16 houses, 204 people,  21 would stay  (10.3%)
 *     family / demonic      1 house,   17 people,   1 would stay   (5.9%)
 *     sect   / demonic      5 houses,  81 people,   1 would stay   (1.2%)
 *
 * And one house through the door end to end: Earth Vein Tower, 22 on the roll,
 * 3 taken in by another house, 16 on the road, 3 standing where it stood.
 */

import { describe, it, expect } from 'vitest';
import {
    howManyWouldStay,
    wouldGoDownWithTheHouse,
    MOST_PEOPLE_SCATTER,
    STAYED_WITH
} from '../../../src/engine/world/who-goes-down-with-the-house.js';
import {
    releaseTheRoll,
    whetherTheyFall,
    ROGUE_HOUSE_FELL
} from '../../../src/engine/world/what-becomes-of-a-houses-people-when-it-is-gone.js';
import { createNpc, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeFaction, type FactionRecord, type WorldState } from '../../../src/engine/world/world-state.js';

const SEED = 'who-stays';
const SEAT = 'loc-the-seat';

function aHouse(id: string, over: Partial<FactionRecord> = {}): FactionRecord {
    return { ...makeFaction({ id, name: id, ranks: ['Outer', 'Inner', 'Elder'] }), seatLocationId: SEAT, ...over };
}

function aRoll(house: FactionRecord, howMany: number): NpcRecord[] {
    const people: NpcRecord[] = [];
    for (let i = 0; i < howMany; i++) {
        const npc = createNpc(SEED, {
            id: `npc-${i}`, bornOnDay: 0, onDay: 0, cultivation: { realmOrdinal: 8 }
        });
        people.push({ ...npc, factionId: house.id, factionRankIndex: 0, locationId: SEAT });
    }
    return people;
}

function aWorld(house: FactionRecord, people: NpcRecord[]): WorldState {
    return {
        seed: SEED, currentDay: 1000, factions: [house], npcs: people, locations: []
    } as unknown as WorldState;
}

describe('how many would not walk away', () => {
    it('is more in a house whose roll is its blood, and less where nobody was ever asked', () => {
        const plain = aHouse('h-plain', { kind: 'sect', alignment: 'neutral' });
        const family = aHouse('h-family', { kind: 'clan', alignment: 'neutral' });
        const believed = aHouse('h-righteous', { kind: 'sect', alignment: 'righteous' });
        const demonic = aHouse('h-demonic', { kind: 'sect', alignment: 'demonic' });
        expect(howManyWouldStay(family)).toBeGreaterThan(howManyWouldStay(plain));
        expect(howManyWouldStay(believed)).toBeGreaterThan(howManyWouldStay(plain));
        expect(howManyWouldStay(demonic)).toBeLessThan(howManyWouldStay(plain));
    });

    it('stays a minority in the house that holds its people hardest', () => {
        const hardest = aHouse('h-hardest', { kind: 'clan', alignment: 'righteous', tags: ['bloodline'] });
        expect(howManyWouldStay(hardest)).toBeLessThanOrEqual(MOST_PEOPLE_SCATTER);
        expect(MOST_PEOPLE_SCATTER).toBeLessThan(0.5);
    });

    it('is who somebody is: the same answer every time, and not the same in two houses', () => {
        const one = aHouse('h-one', { kind: 'clan', alignment: 'righteous' });
        const two = aHouse('h-two', { kind: 'clan', alignment: 'righteous' });
        const people = aRoll(one, 200);
        for (const npc of people.slice(0, 20)) {
            expect(wouldGoDownWithTheHouse(SEED, npc, one))
                .toBe(wouldGoDownWithTheHouse(SEED, npc, one));
        }
        const here = people.filter(n => wouldGoDownWithTheHouse(SEED, n, one)).map(n => n.id);
        const there = people.filter(n => wouldGoDownWithTheHouse(SEED, n, two)).map(n => n.id);
        expect(here.length).toBeGreaterThan(0);
        expect(here).not.toEqual(there);
    });
});

describe('a house that stops existing', () => {
    it('leaves the ones who would not walk away standing where it stood', () => {
        const house = aHouse('h-fell', { kind: 'clan', alignment: 'righteous' });
        const people = aRoll(house, 120);
        const staying = new Set(people.filter(n => wouldGoDownWithTheHouse(SEED, n, house)).map(n => n.id));
        expect(staying.size, 'nobody would stay at all').toBeGreaterThan(0);
        expect(staying.size, 'this is supposed to be a minority').toBeLessThan(people.length / 2);

        const state = aWorld(house, people);
        const went = releaseTheRoll(state, house, state.currentDay, ROGUE_HOUSE_FELL);

        expect(new Set(went.stayed)).toEqual(staying);
        for (const id of went.stayed) {
            expect(went.rogues, `${id} both stayed and took to the road`).not.toContain(id);
            expect(went.takenIn.map(t => t.npcId)).not.toContain(id);
            const row = state.npcs.find(n => n.id === id)!;
            expect(row.factionId, 'there is no roll left to be on').toBeNull();
            expect(row.tags).toContain(`${STAYED_WITH}${house.id}`);
            expect(row.locationId, 'they left the ground the house stood on').toBe(SEAT);
        }
        // And everybody else went one of the two ways that were already there.
        expect(went.stayed.length + went.rogues.length + went.takenIn.length).toBe(people.length);
    });

    it('takes nobody who would have stayed off to another house', () => {
        const house = aHouse('h-taken', { kind: 'sect', alignment: 'righteous' });
        const people = aRoll(house, 150);
        const state = aWorld(house, people);
        const went = releaseTheRoll(state, house, state.currentDay, ROGUE_HOUSE_FELL);
        for (const taken of went.takenIn) {
            expect(wouldGoDownWithTheHouse(SEED, { id: taken.npcId }, house)).toBe(false);
        }
    });
});

describe('somebody who came for the compound', () => {
    it('does not take the ones who stand: they fall whatever their rung says', () => {
        const house = aHouse('h-stormed', { kind: 'clan', alignment: 'righteous' });
        const people = aRoll(house, 120);
        const state = aWorld(house, people);
        // An attacker no higher than the people in front of them: almost nobody
        // would be lost on the rung reading alone.
        const staying = people.filter(n => wouldGoDownWithTheHouse(SEED, n, house));
        const scattering = people.filter(n => !wouldGoDownWithTheHouse(SEED, n, house));
        expect(staying.length).toBeGreaterThan(0);
        for (const npc of staying) {
            expect(whetherTheyFall(state, npc, 8, state.currentDay), `${npc.id} got out`).toBe(true);
        }
        const fell = scattering.filter(npc => whetherTheyFall(state, npc, 8, state.currentDay));
        expect(fell.length, 'everybody fell, so standing still means nothing')
            .toBeLessThan(scattering.length);
    });
});
