/**
 * What a house teaches, which is what anybody asks before joining one.
 *
 * `what does the X have` reached a read for all 38 houses and `what does the
 * X teach` reached nothing, which is the wrong half of the pair to have
 * built: a purse is what you ask about a house you mean to rob, and a shelf
 * is what you ask about one you mean to spend a century in.
 *
 * The four claims, and the last two are the ones that make the answer worth
 * asking for rather than a list anybody could have read off the catalog:
 *
 *   1. The roads come out in the order somebody would climb them, each with
 *      the rung it opens at and the rung it ends at.
 *   2. A body with no shelf says so - eight of the world's 45 have none.
 *   3. The answer is about the ASKER: a root that cannot walk the deepest
 *      road is told where its own ceiling is, which is the difference between
 *      a career and a wasted century.
 *   4. The answer is about the ROSTER: a house can name a road nobody left
 *      there can open, and that is the one thing it would never volunteer.
 */

import { describe, it, expect } from 'vitest';

import { whatAHouseTeaches } from '../../src/web/what-a-house-teaches.js';
import { createWorld, type WorldState } from '../../src/engine/world/world-state.js';
import { createNpc, setRealm } from '../../src/engine/world/npc-state.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { TECHNIQUES } from '../../src/data/cultivation/techniques.js';

/** A world holding one house's people, at the rungs given. */
function withPeopleAt(rungs: readonly number[]): WorldState {
    const state = createWorld({ seed: 'shelf', skipPriorAges: true, regionCount: 0 });
    state.locations.push(makeLocation({
        id: 'seat', name: 'A Seat', kind: 'sect_seat', qiDensity: 0.4
    }));
    rungs.forEach((rung, index) => {
        let npc = createNpc(state.seed, {
            id: `npc-${index}`,
            bornOnDay: state.currentDay - 365 * 80,
            onDay: state.currentDay,
            locationId: 'seat',
            occupation: 'disciple'
        });
        npc = setRealm(npc, rung, state.currentDay);
        state.npcs.push({ ...npc, factionId: 'house' });
    });
    return state;
}

/**
 * Two real roads off the catalog, one elementless and one not.
 *
 * REAL IDS, BECAUSE THE READ RESOLVES THEM. A made-up id is silently dropped
 * by `getTechnique`, so a fixture built on invented ones would assert about an
 * empty shelf while claiming to assert about a full one.
 */
const aPrimer = TECHNIQUES.find(t => t.element === null && t.requiredOrdinal === 0)!;
const aMetalRoad = TECHNIQUES.find(t => t.element === 'metal' && t.requiredOrdinal >= 21)!;

describe('what a house teaches', () => {
    it('names each road with the rung it opens at and the rung it ends at', () => {
        const read = whatAHouseTeaches({
            world: withPeopleAt([40]),
            houseName: 'The Cold Sword Sect',
            factionId: 'house',
            teaches: [aMetalRoad.id, aPrimer.id],
            askersRoot: 'single_metal'
        });

        // CLIMBING ORDER, not catalog order. The fixture hands them deepest
        // first on purpose, because the order a shelf is listed in is the
        // order somebody would go up it.
        expect(read.roads.map(r => r.id)).toEqual([aPrimer.id, aMetalRoad.id]);
        expect(read.roads[0].opensAt).toBe(aPrimer.requiredOrdinal);
        expect(read.roads[1].endsAt).toBe(aMetalRoad.cap);
        expect(read.lines.join(' ')).toContain(aMetalRoad.name);
    });

    /**
     * EIGHT OF THE WORLD'S 45 BODIES TEACH NOTHING, and that is a real answer.
     *
     * The Kiln Wardens - a guard posting written as a sect, which teaches
     * nothing and takes nobody by standing ruling - four courts and three apex
     * institutions. An empty list would read as a missing answer; a sentence
     * saying the place is not one that teaches is the true one.
     */
    it('says outright that a body with no shelf is not a place that teaches', () => {
        const read = whatAHouseTeaches({
            world: withPeopleAt([30]),
            houseName: 'The Kiln Wardens',
            factionId: 'house',
            teaches: [],
            askersRoot: 'single_fire'
        });

        expect(read.roads).toEqual([]);
        expect(read.shelfEndsAt).toBeNull();
        expect(read.lines.join(' ')).toContain('teaches nothing');
    });

    /**
     * THE ANSWER IS ABOUT THE PERSON ASKING.
     *
     * `what-root-a-seeded-house-member-has.ts` already holds the rule for the
     * house's own people: a wood-rooted member of a water house is neither
     * excluded nor equal, they have a real career with a real ceiling and it
     * is their root that put it there. Said to the person at the door, it is
     * the difference between a century well spent and a century wasted, and
     * nothing said it to them.
     */
    it('tells a root that cannot walk the deepest road where its own ceiling is', () => {
        const read = whatAHouseTeaches({
            world: withPeopleAt([40]),
            houseName: 'The Cold Sword Sect',
            factionId: 'house',
            teaches: [aMetalRoad.id, aPrimer.id],
            askersRoot: 'single_wood'
        });

        expect(read.shelfEndsAt).toBe(aMetalRoad.cap);
        expect(read.endsForTheAskerAt, 'a wood root was sold a metal road').toBe(aPrimer.cap);
        expect(read.roads.find(r => r.id === aMetalRoad.id)!.suitsTheAsker).toBe(false);
        // The elementless primer is not a road a root is good at, it is a road
        // a root is not consulted about.
        expect(read.roads.find(r => r.id === aPrimer.id)!.suitsTheAsker).toBe(true);
    });

    /**
     * A HOUSE CAN NAME A ROAD NOBODY LEFT THERE CAN OPEN.
     *
     * The shelf is catalog and the roll is world, so the two drift apart the
     * moment a world runs. This is the half of the answer the house would not
     * volunteer and the half that decides whether its shelf is an offer or a
     * boast - and it is said as a fact about who is standing there, because
     * the book is fine and the people are the problem.
     */
    it('says when the top of the shelf is above everybody on the roll', () => {
        const read = whatAHouseTeaches({
            world: withPeopleAt([12, 8]),
            houseName: 'The Cold Sword Sect',
            factionId: 'house',
            teaches: [aMetalRoad.id, aPrimer.id],
            askersRoot: 'single_metal'
        });

        expect(read.tallestThere).toBe(12);
        expect(read.unopenable.map(r => r.id)).toEqual([aMetalRoad.id]);
        expect(read.lines.join(' ')).toContain('cannot read out');
    });

    /**
     * AND A WORLD THAT HOLDS NOBODY FOR THEM MAKES NO CLAIM EITHER WAY.
     *
     * The gap is read off the roster, so with no roster there is no gap to
     * report - and reporting one anyway would be the read inventing the most
     * damaging sentence it can say about a house out of an absence.
     */
    it('makes no claim about the roll when the world holds nobody for them', () => {
        const read = whatAHouseTeaches({
            world: null,
            houseName: 'The Cold Sword Sect',
            factionId: 'house',
            teaches: [aMetalRoad.id, aPrimer.id],
            askersRoot: 'single_metal'
        });

        expect(read.tallestThere).toBeNull();
        expect(read.unopenable).toEqual([]);
        expect(read.lines.join(' ')).not.toContain('cannot read out');
    });
});
