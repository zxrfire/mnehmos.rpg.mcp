/**
 * A conclave picked three people for a door, and nobody went.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `applyDoorsAndTheirPlaces` runs the whole allocation a counted door produces:
 * the holder deals the places it has, each house that got any ranks its own
 * people over a field, `creditWhatTheyLearned` pays out the training, and
 * `whatBeingPassedOverDoes` opens a goal and a tie against whoever took the last
 * place. It hands back `deal`, `conclaves` and `andTheyDid`.
 *
 * The yearly pass read `shut` and `storedFact` and dropped the rest on the
 * floor. So the world ranked a field, wrote the grudges, and then nobody walked
 * through the door - which makes the grudge about nothing. A place at a door
 * that costs the winner no risk and yields them nothing is not a place at a
 * door.
 *
 * ── WHAT THIS PINS, AND WHY IT IS THE CONCLAVE'S LIST ────────────────────
 *
 * Not that three people went, which is the seed's business. That the people who
 * went are the ones the DOOR would admit, which is the sharp difference between
 * the two candidate lists:
 *
 *   `whoWouldStandForAPlace`   the door's own band - at or above its survival
 *                              bar, at or below the ceiling the ground refuses
 *                              power over. The conclave ranks these.
 *   `whoTheHouseCanSend`       the strongest names on the roll, which is the
 *                              right answer for an errand a house invents and
 *                              the wrong one here.
 *
 * So the fixture puts people above the door's ceiling on every roll. If the walk
 * were drawn off the roster the strongest would go, and the ground is closed
 * over them. Red-checked by unwiring the pass: nobody moves at all.
 */

import { describe, expect, it } from 'vitest';

import { applyPressure } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { whatADoorAdmits } from '../../../src/engine/world/a-door-with-a-count-on-it.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import {
    makeLocation,
    makeThresholds,
    type LocationRecord,
    type OpeningCycle
} from '../../../src/engine/world/locations.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;
const DAY = 200 * YEAR;

/**
 * A season that runs most of every year.
 *
 * A real door waits sixty to six hundred years for a window of weeks, so a
 * fixture on a real schedule would run for centuries between the decision and
 * the walk. The wait is collapsed and only the wait - the same shortcut
 * `a-year-at-the-doors.test.ts` takes for the same reason.
 */
const SEASON: OpeningCycle = { periodDays: YEAR, openDays: 300, phaseDay: 0 };

/** The rung the ground refuses power over. Below the strongest on every roll. */
const CEILING = 20;

function build(): WorldState {
    const state = createWorld({ seed: 'walk-through', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({ id: 'loc-region', name: 'The Province', kind: 'region' }));
    state.locations.push(makeLocation({
        id: 'loc-door', name: 'Cold Spring', kind: 'ruin', parentId: 'loc-region',
        qiDensity: 60, thresholds: makeThresholds(4, 8, 14, 20),
        sealed: true, discovered: true, cycle: SEASON,
        // Held, and counted, which is the one cell of the four where anything
        // hands a place out. `whatADoorAdmits` is the reading.
        controllingFactionId: 'house-a',
        data: { ceilingOrdinal: CEILING }
    }) as LocationRecord);

    let seq = 0;
    for (const id of ['house-a', 'house-b', 'house-c']) {
        state.locations.push(makeLocation({
            id: `seat-${id}`, name: `${id} seat`, kind: 'sect_seat', parentId: 'loc-region'
        }));
        state.factions.push(makeFaction({
            id, name: id, seatLocationId: `seat-${id}`, foundedOnDay: 0,
            resources: { spirit_stones: 200_000, power_ordinal: 30, reliable_ordinal: 20 }
        }));
        for (let i = 0; i < 14; i++) {
            let npc = createNpc(state.seed, {
                id: `npc-${seq++}`,
                bornOnDay: DAY - 365 * 80,
                onDay: DAY,
                locationId: `seat-${id}`,
                occupation: 'disciple'
            });
            // Two thirds inside the door's band, a third above its ceiling.
            npc = setRealm(npc, i % 3 === 0 ? CEILING + 8 : 14 + (i % 3), DAY);
            state.npcs.push({ ...npc, factionId: id, factionRankIndex: 1 });
        }
    }
    // house-a holds the door and will deal to b, not to c.
    state.factions[0]!.standing['house-b'] = 0.6;
    state.factions[1]!.standing['house-a'] = 0.6;
    state.factions[0]!.standing['house-c'] = -0.9;
    return state;
}

/** Everybody standing at the door on the house's business, right now. */
function atTheDoor(state: WorldState) {
    return state.npcs.filter(n =>
        n.status === 'alive'
        && n.locationId === 'loc-door'
        && n.activity?.kind === 'out_with_a_party');
}

describe('the people a conclave chose walk through', () => {
    it('deals places at all, which is the precondition and not the claim', () => {
        const state = build();
        const door = state.locations.find(l => l.id === 'loc-door')!;
        const admits = whatADoorAdmits({ ruin: door });
        expect(admits.cell).toBe('doled_out');
        expect(admits.places).not.toBeNull();
        expect(admits.places!).toBeGreaterThan(0);
    });

    it('puts somebody at the door, where before nobody ever went', () => {
        const state = build();
        expect(atTheDoor(state)).toHaveLength(0);
        applyPressure(state, DAY, DAY + YEAR, { intensity: 0 });
        expect(atTheDoor(state).length).toBeGreaterThan(0);
    });

    /**
     * The whole of the ruling. A party drawn off the roll would be the house's
     * strongest, and this ground is closed over them.
     */
    it('sends the people the door would admit, not the strongest on the roll', () => {
        const state = build();
        const strongest = new Set(state.npcs
            .filter(n => n.cultivation.realmOrdinal > CEILING)
            .map(n => n.id));
        expect(strongest.size).toBeGreaterThan(0);

        applyPressure(state, DAY, DAY + YEAR, { intensity: 0 });
        const went = atTheDoor(state);
        expect(went.length).toBeGreaterThan(0);
        for (const person of went) {
            expect(strongest.has(person.id), `${person.id} is above the door's ceiling`).toBe(false);
        }
    });

    /** They went together, and the record says with whom. */
    it('records the party each of them went out with', () => {
        const state = build();
        applyPressure(state, DAY, DAY + YEAR, { intensity: 0 });
        const went = atTheDoor(state);
        const ids = new Set(went.map(n => n.id));
        for (const person of went) {
            expect(person.activity!.withIds.length).toBeGreaterThan(0);
            for (const other of person.activity!.withIds) expect(ids.has(other)).toBe(true);
            expect(person.activity!.withIds).not.toContain(person.id);
            // Somewhere to come back to, which is where they were standing.
            expect(person.activity!.returnTo).not.toBeNull();
            expect(person.activity!.returnTo).not.toBe('loc-door');
        }
    });

    /** Only the houses the holder actually dealt to. A door is not a public road. */
    it('sends nobody from a house the holder would not have at the door', () => {
        const state = build();
        applyPressure(state, DAY, DAY + YEAR, { intensity: 0 });
        for (const person of atTheDoor(state)) expect(person.factionId).not.toBe('house-c');
    });
});
