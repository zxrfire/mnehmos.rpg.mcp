/**
 * A house holds a competition for the sake of training its own disciples.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `runCompetition` moved prestige, wrote ties between adjacent placings and
 * could take another house's champion onto the host's roll, and NOBODY WAS ANY
 * BETTER FOR HAVING BEEN THERE. Read against the ladder, a competition was a
 * scoreboard: not one field on any entrant's cultivation moved, so a house that
 * held one every fifteen years for five centuries produced exactly the same
 * disciples as one that held none.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * The credit is days of progress, paid by moving `accumulatingSinceDay` back -
 * the one clock `readyToStrike` reads, so a credit here is a wall struck sooner
 * and nothing else in the ladder has to know this exists.
 *
 * AND IT IS PAID BY HOW FAR UP THE BOARD SOMEBODY WAS PUSHED, not by where they
 * finished. Winning is already paid in prestige; paying it again here would be
 * paying for being strong rather than for getting better, and a strong disciple
 * walking through a weak field has not learned anything. Two consequences fall
 * out and both are wanted: a bigger field teaches more than a small one, and the
 * house at the top of a board gets least out of holding it - which is why it
 * invites anybody.
 *
 * A board of one pays nothing, which is the same reading `runCompetition`
 * already applies to prestige: a bracket with one person in it is somebody
 * standing on a stage alone.
 *
 * Red-checked: returning zero days from `whatAContestIsWorthToThePeopleInIt`
 * turns every assertion below red except the board-of-one one.
 */

import { describe, expect, it } from 'vitest';

import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import { creditWhatTheyLearned } from '../../../src/engine/world/gatherings.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import {
    MOST_ONE_CONTEST_IS_WORTH_YEARS,
    whatAContestIsWorthToThePeopleInIt
} from '../../../src/engine/world/what-a-contest-is-worth-to-the-people-in-it.js';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';

const daysFor = (place: number, fieldSize: number): number =>
    whatAContestIsWorthToThePeopleInIt([{ npcId: 'x', place, fieldSize }])[0]!.days;

/**
 * A world already a century old.
 *
 * `createWorld({ skipPriorAges })` opens on day zero, and a clock at zero
 * cannot be moved back - which is a real property of a world that has only just
 * opened and is not the one under test here.
 */
function world(count: number): { state: WorldState; people: NpcRecord[] } {
    const state = createWorld({ seed: 'trained', skipPriorAges: true, regionCount: 0 });
    state.currentDay = 365 * 100;
    const people: NpcRecord[] = [];
    for (let i = 0; i < count; i++) {
        let npc = createNpc(state.seed, {
            id: `npc-${i}`,
            bornOnDay: state.currentDay - 365 * 60,
            onDay: state.currentDay,
            locationId: null,
            occupation: 'disciple'
        });
        npc = setRealm(npc, 10, state.currentDay);
        state.npcs.push(npc);
        people.push(npc);
    }
    return { state, people };
}

describe('a competition trains the people in it', () => {
    it('pays everybody who stood on a board of more than one', () => {
        const paid = whatAContestIsWorthToThePeopleInIt(
            [1, 2, 3, 4].map(place => ({ npcId: `n${place}`, place, fieldSize: 4 })));
        expect(paid).toHaveLength(4);
        for (const row of paid) expect(row.days).toBeGreaterThan(0);
    });

    it('pays the people who were pushed, not the person who won', () => {
        expect(daysFor(4, 4)).toBeGreaterThan(daysFor(1, 4));
        expect(daysFor(2, 4)).toBeGreaterThan(daysFor(1, 4));
    });

    it('pays more out of a deep field than out of a shallow one', () => {
        expect(daysFor(8, 12)).toBeGreaterThan(daysFor(2, 3));
    });

    it('pays nothing for standing on a stage alone', () => {
        expect(daysFor(1, 1)).toBe(0);
    });

    it('cannot hand somebody a decade for an afternoon', () => {
        expect(daysFor(60, 60)).toBeLessThanOrEqual(
            MOST_ONE_CONTEST_IS_WORTH_YEARS * DAYS_PER_YEAR);
    });

    // ── AND IT REACHES THE LADDER ────────────────────────────────────────

    it('moves the clock the ladder reads, and nothing else about them', () => {
        const { state, people } = world(4);
        const before = people.map(p => ({ ...p.cultivation }));
        creditWhatTheyLearned(state, people.map((p, i) => ({
            npcId: p.id,
            name: p.name,
            factionId: null,
            place: i + 1,
            score: 100 - i,
            bracket: 'qi_condensation'
        })), state.currentDay);

        for (let i = 0; i < people.length; i++) {
            const after = state.npcs.find(n => n.id === people[i]!.id)!.cultivation;
            // First place still gains: turning up and standing there is worth
            // something, even when nobody above you taught you anything.
            expect(after.accumulatingSinceDay).toBeLessThan(before[i]!.accumulatingSinceDay);
            expect(after.realmOrdinal).toBe(before[i]!.realmOrdinal);
            expect(after.lastAdvancedOnDay).toBe(before[i]!.lastAdvancedOnDay);
        }

        // And the one who was pushed furthest gained most.
        const clockOf = (id: string): number =>
            state.npcs.find(n => n.id === id)!.cultivation.accumulatingSinceDay;
        expect(clockOf('npc-3')).toBeLessThan(clockOf('npc-0'));
    });

    it('never moves a clock past the opening of the world', () => {
        const { state, people } = world(2);
        for (const person of people) {
            const at = state.npcs.findIndex(n => n.id === person.id);
            state.npcs[at] = {
                ...state.npcs[at]!,
                cultivation: {
                    ...state.npcs[at]!.cultivation,
                    accumulatingSinceDay: 1,
                    lastAdvancedOnDay: 1
                }
            };
        }
        creditWhatTheyLearned(state, people.map((p, i) => ({
            npcId: p.id, name: p.name, factionId: null,
            place: i + 1, score: 1, bracket: 'qi_condensation'
        })), state.currentDay);
        for (const person of people) {
            expect(state.npcs.find(n => n.id === person.id)!.cultivation.accumulatingSinceDay)
                .toBeGreaterThanOrEqual(0);
        }
    });
});
