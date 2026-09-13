/**
 * A PARTY IS NOT A RECORD. IT IS EVERYBODY WHOSE OWN ACTIVITY NAMES YOU.
 *
 * `who-is-on-the-road-with-you.ts` was written for the escort duty, where a
 * house names the juniors and the senior takes them out, and it carries the
 * whole argument for reading a party rather than storing one. What it had no
 * reader for was the other direction: given ONE person, is there already a
 * party around them - which is the question that has to be answered before a
 * player can ask anybody to come, because a body is in one party at a time.
 *
 * WHAT THESE PIN, and all three are behaviour a player would notice:
 *
 *   1. The reading and the term agree. The day a term ends is the day the party
 *      stops naming somebody, and it is read off `untilDay` in both directions
 *      rather than by two functions that happen to agree today.
 *   2. Somebody dead is not in a party. `status` is checked in the reading and
 *      nowhere else, so a death needs no party code to know about it.
 *   3. The two shapes of `withIds` both answer. `takeThemWithYou` names whoever
 *      they are going WITH; the world sim's own sending names only the other
 *      people in the party and no leader at all. A read that assumed the first
 *      entry was a leader would be wrong about every party a house ever sent,
 *      which is nearly all of them - so the read hands back the list.
 *
 * They do NOT pin how many people a world puts anywhere, or any name: both are
 * the engine's choosing and neither is what this module is about.
 *
 * RED-CHECKED: dropping the `status !== 'alive'` guard from
 * `whoIsOnTheRoadWith` makes the dead test fail on the count; changing the term
 * test from `today < until` to `today <= until` makes the boundary test fail on
 * the day the term ends, which is the day a party stops existing.
 */

import { describe, expect, it } from 'vitest';

import {
    A_SEASON_ON_THE_ROAD,
    takeThemWithYou,
    whatThePartyIs,
    whoIsOnTheRoadWith,
    whoTheyAreOutWith
} from '../../../src/engine/world/who-is-on-the-road-with-you';
import type { NpcRecord } from '../../../src/engine/world/npc-state';

/** A body, with only the fields this module reads filled in. */
function somebody(id: string, name: string): NpcRecord {
    return {
        id,
        name,
        status: 'alive',
        locationId: 'loc-a',
        activity: null,
        cultivation: { realmOrdinal: 3 }
    } as unknown as NpcRecord;
}

const LEADER = 'the-one-they-are-with';

function aPartyOfTwo(untilDay: number): NpcRecord[] {
    const rows = [somebody('a', 'One'), somebody('b', 'Two')];
    const changed = takeThemWithYou(rows, {
        party: rows.map(row => ({ id: row.id, name: row.name })),
        leaderId: LEADER,
        note: 'Out on something.',
        onDay: 0,
        untilDay
    });
    return changed;
}

describe('who is on the road with somebody', () => {
    it('stops naming them on the day the term ends', () => {
        const party = aPartyOfTwo(10);
        expect(whoIsOnTheRoadWith(party, LEADER, 9)).toHaveLength(2);
        expect(whoIsOnTheRoadWith(party, LEADER, 10)).toHaveLength(0);
    });

    it('does not carry the dead', () => {
        const party = aPartyOfTwo(10).map((row, at) =>
            at === 0 ? { ...row, status: 'dead' as const } : row
        );
        const read = whoIsOnTheRoadWith(party, LEADER, 1);
        expect(read).toHaveLength(1);
        expect(read[0].name).toBe('Two');
    });

    it('says what the party is: who, how long, and what they are out on', () => {
        const said = whatThePartyIs(aPartyOfTwo(10), 4);
        expect(said).not.toBeNull();
        expect(said!.line).toContain('One');
        expect(said!.line).toContain('Two');
        // The term, as days left rather than as a day index nobody can place.
        expect(said!.line).toContain('6 more days');
        expect(said!.line).toContain('Out on something.');
        // The claim this whole module rests on, on the channel an operator reads.
        expect(said!.structure).toContain('No roster is stored anywhere');
    });

    it('has nothing to say when nobody is with you', () => {
        expect(whatThePartyIs([], 4)).toBeNull();
    });
});

describe('whether one person is already out with somebody', () => {
    it('names who they are out with, and until when', () => {
        const [first] = aPartyOfTwo(10);
        const out = whoTheyAreOutWith(first, 1);
        expect(out).not.toBeNull();
        expect(out!.withIds).toContain(LEADER);
        expect(out!.untilDay).toBe(10);
    });

    /**
     * The half a `leaderId` read would have got wrong. A house's sending writes
     * the party into `withIds` with nobody leading it, and that person is still
     * unavailable to anybody who asks them along.
     */
    it('answers for a party a house sent, which names no leader', () => {
        const sent: NpcRecord = {
            ...somebody('c', 'Three'),
            activity: {
                kind: 'out_with_a_party',
                note: 'Out for the house on a tribute run.',
                withIds: ['d', 'e'],
                sinceDay: 0,
                untilDay: 40,
                returnTo: 'loc-a'
            }
        } as unknown as NpcRecord;
        const out = whoTheyAreOutWith(sent, 1);
        expect(out).not.toBeNull();
        expect(out!.withIds).toEqual(['d', 'e']);
        expect(out!.withIds).not.toContain(LEADER);
    });

    it('answers nothing once the term is over', () => {
        const [first] = aPartyOfTwo(10);
        expect(whoTheyAreOutWith(first, 10)).toBeNull();
    });

    it('answers nothing for somebody at anything else', () => {
        expect(whoTheyAreOutWith(somebody('f', 'Four'), 1)).toBeNull();
    });
});

/**
 * The default term is not a taste. `bringHomeWhoeverIsDue` runs once a year in
 * the world's own pass, so a party whose term is a year or longer would be
 * ended by a different year's pass than the one that should have ended it.
 */
describe('the term a party runs on when nobody said one', () => {
    it('is shorter than the year the world brings parties home on', () => {
        expect(A_SEASON_ON_THE_ROAD).toBeGreaterThan(0);
        expect(A_SEASON_ON_THE_ROAD).toBeLessThan(365);
    });
});
