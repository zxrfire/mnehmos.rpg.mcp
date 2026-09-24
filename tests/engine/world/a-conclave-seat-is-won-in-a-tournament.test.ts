/**
 * The conclave rung is the one that rotates, and a tournament settles it.
 *
 * `docs/world/houses/offices-and-succession.md` says conclave is held against
 * the pool and inner is for life; the design owner ruled that the comparison is
 * settled by a contest on each house's own cycle. See
 * `a-conclave-seat-is-won-in-a-tournament.ts`.
 */

import { describe, expect, it } from 'vitest';

import { SECTS } from '../../../src/data/cultivation/sects.js';
import { rankRealmBand } from '../../../src/data/cultivation/members.js';
import {
    itsContestFallsIn,
    theConclaveRungOf,
    theConclavesAreContested,
    yearsBetweenConclaveContestsIn
} from '../../../src/engine/world/a-conclave-seat-is-won-in-a-tournament.js';
import { elderRungOf } from '../../../src/engine/cultivation/leadership.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const HOUSE = SECTS.find(s => s.id === 'sect-azure-cloud-pavilion')!;
const RUNG = theConclaveRungOf(HOUSE.ranks.length);
const BAND = rankRealmBand(HOUSE.id, RUNG)!;
const DAY = 500 * 365;

function member(id: string, rank: number, ordinal: number): NpcRecord {
    const npc = createNpc('conclave', { id, bornOnDay: DAY - 365 * 60, onDay: DAY, locationId: 'loc-seat' });
    return { ...setRealm(npc, ordinal, DAY), factionId: HOUSE.id, factionRankIndex: rank, activity: null };
}

function world(people: NpcRecord[]): WorldState {
    const state = createWorld({ seed: 'conclave-contest', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({ id: 'loc-region', name: 'The Province', kind: 'region' }));
    state.locations.push(makeLocation({ id: 'loc-seat', name: 'The Seat', kind: 'sect_seat', parentId: 'loc-region' }));
    state.factions.push(makeFaction({
        id: HOUSE.id, name: HOUSE.name, ranks: HOUSE.ranks.slice(), seatLocationId: 'loc-seat', foundedOnDay: 0,
        resources: { spirit_stones: 500_000, admission_ordinal: HOUSE.admissionOrdinal, power_ordinal: HOUSE.powerOrdinal }
    }));
    state.npcs.push(...people);
    return state;
}

/** The year this house's contest falls in, at or after `from`. */
function nextContestYear(state: WorldState, from: number): number {
    for (let year = from; year < from + 600; year++) {
        if (itsContestFallsIn(state.seed, state.factions[0]!, year)) return year;
    }
    throw new Error('no contest in six centuries');
}

describe('the schedule is the height it is contested at', () => {
    it('runs on a cycle of years, and a taller conclave contests less often', () => {
        const foundation = yearsBetweenConclaveContestsIn(
            SECTS.find(s => s.id === 'sect-azure-cloud-pavilion')! as never);
        const core = yearsBetweenConclaveContestsIn(
            SECTS.find(s => s.id === 'sect-frostmirror-court')! as never);
        const top = yearsBetweenConclaveContestsIn(
            SECTS.find(s => s.id === 'sect-hollow-court')! as never);
        // MEASURED on the shipped catalog. See the module header.
        expect(foundation).toBe(13);
        expect(core).toBe(25);
        expect(top).toBe(500);
    });

    it('falls once per cycle, in the house own year', () => {
        const house = SECTS.find(s => s.id === 'sect-azure-cloud-pavilion')! as never;
        const every = yearsBetweenConclaveContestsIn(house);
        let fell = 0;
        for (let year = 1000; year < 1000 + every; year++) {
            if (itsContestFallsIn('a-seed', house, year)) fell++;
        }
        expect(fell).toBe(1);
    });

    it('puts the conclave rung under the lowest elder rung of the house', () => {
        expect(RUNG).toBe(elderRungOf(HOUSE.ranks.length) - 1);
    });
});

describe('the contest settles who holds the places', () => {
    /** Three holders who have stopped, and five of the rung below who have not. */
    function aFieldWorthWatching(): NpcRecord[] {
        const people: NpcRecord[] = [];
        for (let i = 0; i < 40; i++) people.push(member(`outer-${i}`, 0, HOUSE.admissionOrdinal));
        for (let i = 0; i < 3; i++) people.push(member(`holder-${i}`, RUNG, BAND.minOrdinal));
        for (let i = 0; i < 5; i++) people.push(member(`rising-${i}`, RUNG - 1, BAND.maxOrdinal));
        return people;
    }

    it('raises the people who won and sends the beaten holders back to inner', () => {
        const state = world(aFieldWorthWatching());
        const year = nextContestYear(state, 500);
        const settled = theConclavesAreContested(state, year, DAY)[0]!;
        expect(settled.entrants).toBe(8);
        expect(settled.raised.length).toBeGreaterThan(0);
        expect(settled.stepped.length).toBe(settled.raised.length);
        for (const id of settled.raised) {
            expect(state.npcs.find(n => n.id === id)!.factionRankIndex).toBe(RUNG);
        }
        for (const id of settled.stepped) {
            // Back to inner, and never past it: inner is for life.
            expect(state.npcs.find(n => n.id === id)!.factionRankIndex).toBe(RUNG - 1);
        }
        const onTheRung = state.npcs.filter(n => n.factionRankIndex === RUNG).length;
        expect(onTheRung).toBe(settled.seats);
    });

    it('says both halves out loud, so a house can be read on it afterwards', () => {
        const state = world(aFieldWorthWatching());
        const year = nextContestYear(state, 500);
        theConclavesAreContested(state, year, DAY);
        expect(state.history.facts.some(f => f.summary.includes('was beaten for their place'))).toBe(true);
        expect(state.history.facts.some(f => f.actors.some(a => a.role === 'raised'))).toBe(true);
    });

    it('holds nothing in a year that is not the house own one, and nothing where nobody is pressing', () => {
        const state = world(aFieldWorthWatching());
        const year = nextContestYear(state, 500);
        expect(theConclavesAreContested(state, year + 1, DAY)).toHaveLength(0);

        const nobodyRising = world([
            ...Array.from({ length: 40 }, (_, i) => member(`outer-${i}`, 0, HOUSE.admissionOrdinal)),
            ...Array.from({ length: 3 }, (_, i) => member(`holder-${i}`, RUNG, BAND.minOrdinal))
        ]);
        expect(theConclavesAreContested(nobodyRising, nextContestYear(nobodyRising, 500), DAY)).toHaveLength(0);
    });
});
