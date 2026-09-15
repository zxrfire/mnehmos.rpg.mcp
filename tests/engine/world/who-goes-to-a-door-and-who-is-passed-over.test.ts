/**
 * Three places and eight names.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * No door in the world admitted a count, so no house ever had to choose which
 * of its own went, so nobody was ever passed over and nobody ever had a reason
 * to be. The third motive the conclave work was asked for - a sect backing its
 * own disciple, and the disciples who lose that backing - had nothing to sit on.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 *   the selection is the competition   `holdAConclaveForThePlaces` calls
 *                                      `rankAField`, which is `runCompetition`'s
 *                                      own board. A second ranking beside it
 *                                      would disagree with it the first time
 *                                      anything about either moved.
 *   being passed over DOES something   a goal on the record naming the person
 *                                      who took the place, and a tie moving
 *                                      against them. A measurement that comes
 *                                      back "nothing" means the motive is not
 *                                      wired, so it is asserted rather than
 *                                      counted.
 *   it is read downstream              enough of it, repeated, takes the pair
 *                                      past `NOTHING_LEFT_BUT_TO_END_IT`, which
 *                                      is what `whyTheyStoodUp` reads at the
 *                                      next gathering. The consequence is wired,
 *                                      not recorded.
 *   the obstacle reads the door        "there is no going anyway" is true of
 *                                      exactly one of the door table's four
 *                                      cells. It was written unconditionally,
 *                                      which told everybody left off every
 *                                      roster the one thing that would have
 *                                      stopped them - and it is false at a door
 *                                      with no count on it, where the roster is
 *                                      the house's list and not the door's. That
 *                                      is the trope of somebody going anyway
 *                                      being reachable at all.
 *   a person is seconded once          the caveat `whoCountsTowardThisHouse`
 *                                      states: two secondments for one person
 *                                      counts them 0.9 twice and the
 *                                      conservation needs a divisor nobody has
 *                                      written.
 *
 * Red-checked: deleting the `addGoal` call turns the motive assertions red;
 * removing the `seen` set in `secondmentsFor` turns the once-at-a-time one red.
 */

import { describe, expect, it } from 'vitest';

import { forStream } from '../../../src/engine/cultivation/rng.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import {
    NOTHING_LEFT_BUT_TO_END_IT
} from '../../../src/engine/world/nobody-is-invincible.js';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import {
    whoDecidesWhoGoesIn,
    type HowADoorIsKept,
    type WhoDecidesWhoGoesIn
} from '../../../src/engine/world/a-door-with-a-count-on-it.js';
import {
    WHAT_BEING_PASSED_OVER_COSTS,
    holdAConclaveForThePlaces,
    secondmentsFor,
    whatBeingPassedOverDoes
} from '../../../src/engine/world/who-goes-to-a-door-and-who-is-passed-over.js';

const DOOR = 'Cold Spring';

/** The three cells of the door table where nobody is handing a place out. */
const UNCOUNTED: readonly HowADoorIsKept[] = [
    'open_on_the_holders_terms', 'settled_with_fists', 'anybody_who_turns_up'
];

function build(count: number): { state: WorldState; wanting: NpcRecord[] } {
    const state = createWorld({ seed: 'conclave-test', skipPriorAges: true, regionCount: 0 });
    const wanting: NpcRecord[] = [];
    for (let i = 0; i < count; i++) {
        let npc = createNpc(state.seed, {
            id: `npc-${i}`,
            bornOnDay: state.currentDay - 365 * 60,
            onDay: state.currentDay,
            locationId: null,
            occupation: 'disciple'
        });
        // Spread across one realm so they all land on one board and the
        // ranking is a ranking rather than four brackets of one.
        npc = setRealm(npc, 10 + (i % 3), state.currentDay);
        npc = { ...npc, factionId: 'house-a', factionRankIndex: 1 };
        state.npcs.push(npc);
        wanting.push(npc);
    }
    return { state, wanting };
}

function conclave(
    places: number,
    count: number,
    whoDecides: WhoDecidesWhoGoesIn = 'a_house_hands_them_out'
) {
    const { state, wanting } = build(count);
    const decided = holdAConclaveForThePlaces({
        state,
        factionId: 'house-a',
        forWhat: DOOR,
        whoDecides,
        places,
        wanting,
        day: state.currentDay,
        rng: forStream('conclave-test', 'suite')
    });
    return { state, decided };
}

describe('who goes to a door and who is passed over', () => {
    it('sends as many as there are places and passes over the rest', () => {
        const { decided } = conclave(3, 8);
        expect(decided).not.toBeNull();
        expect(decided!.going).toHaveLength(3);
        expect(decided!.passedOver).toHaveLength(5);
    });

    it('is not held where there is nothing to settle', () => {
        expect(conclave(3, 3).decided).toBeNull();
        expect(conclave(8, 3).decided).toBeNull();
        expect(conclave(0, 8).decided).toBeNull();
    });

    it('ranks them on the same board a competition ranks a field on', () => {
        const { decided } = conclave(3, 8);
        // Every person who stood has a placing, and the ones going are the top
        // of the order the board produced rather than a second choosing.
        expect(decided!.placings).toHaveLength(8);
        const going = new Set(decided!.going.map(g => g.npcId));
        for (const person of decided!.passedOver) {
            expect(going.has(person.npcId)).toBe(false);
        }
        expect(decided!.going.every(g => g.bracket.length > 0)).toBe(true);
    });

    it('names, for every person passed over, the one who took the place', () => {
        const { decided } = conclave(3, 8);
        for (const person of decided!.passedOver) {
            expect(person.tookItId).not.toHaveLength(0);
            expect(person.tookItId).not.toBe(person.npcId);
        }
        // All of them measure themselves against the same person: the last one
        // in. Nobody resents the winner for being the winner.
        expect(new Set(decided!.passedOver.map(p => p.tookItId)).size).toBe(1);
    });

    // ── AND THEY DO SOMETHING ABOUT IT ───────────────────────────────────

    it('opens a goal and a grudge for everybody left standing there', () => {
        const { state, decided } = conclave(3, 8);
        const said = whatBeingPassedOverDoes(state, decided!, state.currentDay);
        expect(said).toHaveLength(decided!.passedOver.length);

        for (const person of decided!.passedOver) {
            const npc = state.npcs.find(n => n.id === person.npcId)!;
            const goal = npc.goals.find(g => g.status === 'active' && g.targetId === person.tookItId);
            expect(goal).toBeDefined();
            expect(goal!.text).toContain(DOOR);
            expect(goal!.obstacles.join(' ')).toContain('no going anyway');

            const tie = npc.relationships.find(r => r.targetId === person.tookItId);
            expect(tie).toBeDefined();
            expect(tie!.standing).toBeLessThan(0);
        }
    });

    it('does not tell somebody there is no going anyway at a door with no count', () => {
        // The three cells that are not `doled_out`. Nothing at any of them
        // hands out a place, so the roster is the house's and a person left
        // off it has a hole in a hillside to walk up to.
        for (const cell of UNCOUNTED) {
            expect(whoDecidesWhoGoesIn(cell)).toBe('nobody_hands_them_out');
            const { state, decided } = conclave(3, 8, whoDecidesWhoGoesIn(cell));
            whatBeingPassedOverDoes(state, decided!, state.currentDay);
            for (const person of decided!.passedOver) {
                const npc = state.npcs.find(n => n.id === person.npcId)!;
                const goal = npc.goals.find(
                    g => g.status === 'active' && g.targetId === person.tookItId)!;
                const said = goal.obstacles.join(' ');
                expect(said).not.toContain('no going anyway');
                expect(said).toContain('Nothing at the door hands out a place');
            }
        }
    });

    it('opens one ambition per door rather than one per year', () => {
        const { state, decided } = conclave(3, 8);
        for (let year = 0; year < 5; year++) {
            whatBeingPassedOverDoes(state, decided!, state.currentDay + year * 365);
        }
        const person = decided!.passedOver[0]!;
        const npc = state.npcs.find(n => n.id === person.npcId)!;
        expect(npc.goals.filter(g => g.targetId === person.tookItId)).toHaveLength(1);
    });

    it('passes the pair over the line a bout stops being a test at', () => {
        const { state, decided } = conclave(3, 8);
        const person = decided!.passedOver[0]!;
        // Three times for the same place is what the number is stated against.
        const times = Math.ceil(NOTHING_LEFT_BUT_TO_END_IT / WHAT_BEING_PASSED_OVER_COSTS);
        for (let n = 0; n < times; n++) {
            whatBeingPassedOverDoes(state, decided!, state.currentDay + n * 365);
        }
        const npc = state.npcs.find(n => n.id === person.npcId)!;
        const tie = npc.relationships.find(r => r.targetId === person.tookItId)!;
        expect(tie.standing).toBeLessThanOrEqual(NOTHING_LEFT_BUT_TO_END_IT);
        // One afternoon must not reach it. A single passing-over is a slight.
        expect(WHAT_BEING_PASSED_OVER_COSTS).toBeGreaterThan(NOTHING_LEFT_BUT_TO_END_IT);
    });

    // ── THE POSTING IS THE SAME MECHANISM WITH A TERM ON IT ──────────────

    it('emits exactly what the faction rating counts, and no more', () => {
        const { state } = build(4);
        const out = secondmentsFor({
            postingFactionId: 'posting-kiln',
            sending: [{ factionId: 'house-a', people: state.npcs }]
        });
        expect(out).toHaveLength(4);
        for (const row of out) {
            expect(Object.keys(row).sort()).toEqual(
                ['personId', 'postingFactionId', 'realmOrdinal', 'sendingFactionId']);
            expect(row.postingFactionId).toBe('posting-kiln');
            expect(row.sendingFactionId).toBe('house-a');
        }
    });

    it('never seconds one person twice at once', () => {
        const { state } = build(4);
        const out = secondmentsFor({
            postingFactionId: 'posting-kiln',
            sending: [
                { factionId: 'house-a', people: state.npcs },
                { factionId: 'house-b', people: state.npcs }
            ],
            alreadyOut: new Set(['npc-0'])
        });
        expect(out.map(r => r.personId).sort()).toEqual(['npc-1', 'npc-2', 'npc-3']);
    });

    it('does not second anybody to their own house', () => {
        const { state } = build(2);
        expect(secondmentsFor({
            postingFactionId: 'house-a',
            sending: [{ factionId: 'house-a', people: state.npcs }]
        })).toHaveLength(0);
    });
});
