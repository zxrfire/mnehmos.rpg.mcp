/**
 * The pass that puts houses at doors and places in disciples' hands.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `shutAPublicRuin` is a finished mechanism - the party it takes, the province
 * that loses access, the severity, the accounts, the patch, the fact - with no
 * caller anywhere outside its own test. Measured on three pinned worlds at two
 * hundred years: 42, 35 and 39 ruins, 0 held. Not a rule about ruins; an unwired
 * module.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 * That the pass ROUTES rather than rebuilds, and that the routing reaches all
 * four cells of the table. The counts a run produces belong to the seed and are
 * not asserted; what is asserted is that a door taken is a door whose row moved
 * cell, that the places go out only in the year the season falls, and that
 * everybody passed over does something.
 *
 * Measured with the pass on the yearly line for a century after year 200, three
 * seeds: 7 to 10 doors shut, 12 to 30 places dealt, 2 to 12 conclaves, 11 to 41
 * people passed over and 11 to 41 who did something about it - one each, never
 * zero.
 */

import { describe, expect, it } from 'vitest';

import {
    HOW_OFTEN_A_HOUSE_MOVES_ON_A_DOOR,
    applyDoorsAndTheirPlaces,
    opensInTheYearFrom,
    whoWouldStandForAPlace
} from '../../../src/engine/world/a-year-at-the-doors.js';
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
 * A real door waits sixty to six hundred years for a window of a few weeks, and
 * the year it is TAKEN is almost never the year its window falls - which is
 * correct and is what makes a place at one worth anything. It also means a
 * fixture on a real schedule would run for centuries between the two halves of
 * what is being tested, so the wait is collapsed here and only the wait.
 */
const SEASON: OpeningCycle = { periodDays: YEAR, openDays: 300, phaseDay: 0 };

function build(opts: { cycle?: OpeningCycle | null; perHouse?: number } = {}): WorldState {
    const onASeason = opts.cycle === undefined ? SEASON : opts.cycle;
    const state = createWorld({ seed: 'doors-year', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({
        id: 'loc-region', name: 'The Province', kind: 'region'
    }));
    state.locations.push(makeLocation({
        id: 'loc-ruin', name: 'Cold Spring', kind: 'ruin', parentId: 'loc-region',
        qiDensity: 60, thresholds: makeThresholds(4, 8, 14, 20),
        // Sealed only where there is a season to make the column a reading of.
        // Ground with no schedule and the column set is ground nobody can
        // enter, and nobody shuts a door that is already shut.
        sealed: onASeason !== null, discovered: true,
        cycle: onASeason
    }) as LocationRecord);

    let seq = 0;
    for (const id of ['house-a', 'house-b', 'house-c']) {
        state.locations.push(makeLocation({
            id: `seat-${id}`, name: `${id} seat`, kind: 'sect_seat', parentId: 'loc-region'
        }));
        state.factions.push(makeFaction({
            id, name: id, seatLocationId: `seat-${id}`, foundedOnDay: 0,
            resources: { spirit_stones: 100_000, power_ordinal: id === 'house-a' ? 30 : 20 }
        }));
        for (let i = 0; i < (opts.perHouse ?? 12); i++) {
            let npc = createNpc(state.seed, {
                id: `npc-${seq++}`,
                bornOnDay: DAY - 365 * 80,
                onDay: DAY,
                locationId: `seat-${id}`,
                occupation: 'disciple'
            });
            // Above the ground's survival bar, so every one of them could go.
            npc = setRealm(npc, 20 + (i % 3), DAY);
            state.npcs.push({ ...npc, factionId: id, factionRankIndex: 1 });
        }
    }
    // House-a thinks well of b and will not have c at the door at all.
    state.factions[0]!.standing['house-b'] = 0.6;
    state.factions[1]!.standing['house-a'] = 0.6;
    state.factions[0]!.standing['house-c'] = -0.9;
    return state;
}

/** Run the pass until something takes the door, or give up. */
function untilTaken(state: WorldState, years = 2000) {
    for (let y = 0; y < years; y++) {
        const rows = applyDoorsAndTheirPlaces(state, 200 + y, DAY + y * YEAR);
        if (rows.some(r => r.shut !== null)) return rows;
    }
    return null;
}

describe('a year at the doors', () => {
    it('reads a window anywhere inside the year, not only on the day it runs', () => {
        const door = makeLocation({
            id: 'loc-d', name: 'd', kind: 'ruin',
            cycle: { periodDays: 60 * YEAR, openDays: 7, phaseDay: DAY + 200 }
        });
        expect(opensInTheYearFrom(door, DAY)).toBe(true);
        expect(opensInTheYearFrom(door, DAY + YEAR)).toBe(false);
        expect(opensInTheYearFrom(makeLocation({
            id: 'loc-e', name: 'e', kind: 'ruin'
        }), DAY)).toBe(false);
    });

    it('asks the door\'s own band who would stand for a place, not a tag', () => {
        const state = build();
        const door = state.locations.find(l => l.id === 'loc-ruin')!;
        const wanting = whoWouldStandForAPlace(state, 'house-a', door);
        expect(wanting).toHaveLength(12);
        for (const person of wanting) {
            expect(person.cultivation.realmOrdinal)
                .toBeGreaterThanOrEqual(door.thresholds.survival);
        }
    });

    /**
     * Ground closed above a line is what keeps the head of a house off the
     * list, and there is no rule anywhere about heads of houses. The column is
     * the one `whatTheDeadLeftUnder` already writes for a site that refuses
     * power - see `THE_THREE_WAYS_GROUND_IS_CLOSED`.
     */
    it('leaves out anybody the ground is shut above', () => {
        const state = build();
        const at = state.locations.findIndex(l => l.id === 'loc-ruin');
        state.locations[at] = {
            ...state.locations[at]!,
            data: { ...state.locations[at]!.data, ceilingOrdinal: 21 }
        };
        const door = state.locations[at]!;
        const wanting = whoWouldStandForAPlace(state, 'house-a', door);
        expect(wanting.length).toBeGreaterThan(0);
        expect(wanting.length).toBeLessThan(12);
        for (const person of wanting) {
            expect(person.cultivation.realmOrdinal).toBeLessThanOrEqual(21);
        }
    });

    // ── THE DOOR CHANGES CELL WHEN SOMEBODY TAKES IT ─────────────────────

    it('routes the monopoly module and moves the door into the dealt cell', () => {
        const state = build();
        const before = whatADoorAdmits({
            ruin: state.locations.find(l => l.id === 'loc-ruin')!
        });
        expect(before.cell).toBe('settled_with_fists');

        const rows = untilTaken(state);
        expect(rows).not.toBeNull();
        const row = rows!.find(r => r.shut !== null)!;
        // Routed, not rebuilt: the accounts and the party come back off the
        // module that already prices them.
        expect(row.shut!.accounts.length).toBeGreaterThan(0);
        expect(row.shut!.posted.length).toBe(row.shut!.takes.hands);
        expect(row.admits.cell).toBe('doled_out');
        expect(state.locations.find(l => l.id === 'loc-ruin')!.controllingFactionId)
            .not.toBeNull();
    });

    it('deals the places out and holds a conclave for each house that got some', () => {
        const state = build();
        const rows = untilTaken(state);
        const row = rows!.find(r => r.shut !== null)!;
        expect(row.deal).not.toBeNull();
        expect(row.deal!.dealt.reduce((sum, d) => sum + d.places, 0)).toBe(row.admits.places);
        // The house it will not have at the door got nothing, and was told.
        const refused = row.deal!.dealt.find(d => d.houseId === 'house-c');
        expect(refused?.places).toBe(0);
        expect(refused?.because).not.toHaveLength(0);
        expect(row.conclaves.length).toBeGreaterThan(0);
    });

    it('leaves somebody standing there, and every one of them does something', () => {
        const state = build();
        const rows = untilTaken(state);
        const row = rows!.find(r => r.shut !== null)!;
        const passed = row.conclaves.reduce((sum, c) => sum + c.passedOver.length, 0);
        expect(passed).toBeGreaterThan(0);
        // One line per person. A count with no lines behind it is a motive
        // that was recorded and not wired.
        expect(row.andTheyDid).toHaveLength(passed);
    });

    it('deals nothing at ground with no count on it, however firmly held', () => {
        const state = build({ cycle: null });
        for (let y = 0; y < 2000; y++) {
            for (const row of applyDoorsAndTheirPlaces(state, 200 + y, DAY + y * YEAR)) {
                expect(row.deal).toBeNull();
                expect(row.conclaves).toHaveLength(0);
            }
        }
        const held = state.locations.find(l => l.id === 'loc-ruin')!;
        expect(held.controllingFactionId).not.toBeNull();
        expect(whatADoorAdmits({ ruin: held }).cell).toBe('open_on_the_holders_terms');
    });

    /**
     * ONE TOLL IN THIS WORLD. A door somebody pays at is a levy post, and the
     * stones move - a holder holding a door for money has more of it and the
     * house that bought its way in has less. A `paid` figure that never came
     * off anybody's purse would be a price nothing in the world charged.
     */
    it('takes the levy off the house that buys its way in', () => {
        const state = build();
        // House-b is tolerated and no more, which is the one position a purse
        // is the difference in: an ally is given what it would have bought.
        state.factions[0]!.standing['house-b'] = 0.1;
        state.factions[1]!.standing['house-a'] = 0.1;
        const before = Number(state.factions[1]!.resources.spirit_stones);
        const holderBefore = Number(state.factions[0]!.resources.spirit_stones);

        const rows = untilTaken(state);
        const row = rows!.find(r => r.shut !== null)!;
        const paid = holderBefore - Number(state.factions[0]!.resources.spirit_stones);

        expect(row.deal).not.toBeNull();
        expect(Number(state.factions[1]!.resources.spirit_stones)).toBeLessThan(before);
        // What one side lost the other gained, and the holder paid nothing.
        expect(paid).toBeLessThan(0);
        expect(before - Number(state.factions[1]!.resources.spirit_stones)).toBe(-paid);
    });

    it('does not charge a house it is going to give places to anyway', () => {
        const state = build();
        const before = Number(state.factions[1]!.resources.spirit_stones);
        untilTaken(state);
        // house-b stands at 0.6 with house-a, which is over the alliance line.
        expect(Number(state.factions[1]!.resources.spirit_stones)).toBe(before);
    });

    it('keeps the rate in one place', () => {
        expect(HOW_OFTEN_A_HOUSE_MOVES_ON_A_DOOR).toBeGreaterThan(0);
        expect(HOW_OFTEN_A_HOUSE_MOVES_ON_A_DOOR).toBeLessThan(1);
    });
});
