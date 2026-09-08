/**
 * A square with people in it, rather than a square with rows in it.
 *
 * The design owner, on a played scene: *"the world doesn't feel alive nor
 * narrative at all"*, and the two examples that say what would fix it - *"you
 * could overhear a junior sister eating ramen while sighing about how tough it
 * is"*, *"a senior brother monologue about how nice his borrowed sword is"*.
 *
 * What the square said before this was what everybody was AT. An activity makes
 * a person furniture that moves. What was never said was what anybody was
 * preoccupied WITH, and that is the half that makes somebody a person.
 *
 * Four claims, and the fourth is the one that keeps it from becoming the next
 * thing a player learns to skip.
 */

import { describe, it, expect } from 'vitest';

import {
    whatTheyWouldBeHeardOnAbout,
    THE_ROAD_IS_RUNNING_OUT,
    AHEAD_OF_THE_ROAD,
    A_RUNG_WORTH_BEING_YOUNG_AT
} from '../../../src/engine/world/what-somebody-here-is-chewing-on';
import { lifespanForOrdinal, MAX_ORDINAL } from '../../../src/engine/cultivation/realms';

/** Somebody with nothing on their mind, which is the default and the majority. */
const ORDINARY = { ordinal: 5, age: 20, rank: null, chosen: false };

/** Years that put a person at a given fraction of what their rung buys. */
const yearsAt = (ordinal: number, fraction: number) =>
    lifespanForOrdinal(ordinal) * fraction;

describe('what somebody standing here would be heard on', () => {
    it('says nothing about most people', () => {
        expect(whatTheyWouldBeHeardOnAbout(ORDINARY)).toBeNull();
    });

    it('reads the road running out off the years the rung actually buys', () => {
        // The owner's junior sister. Not a mood and not a number: the fact is
        // that the years are mostly spent and the wall has not moved.
        const spent = {
            ...ORDINARY, ordinal: 5, age: yearsAt(5, THE_ROAD_IS_RUNNING_OUT + 0.05)
        };
        expect(whatTheyWouldBeHeardOnAbout(spent)).toMatch(/still standing at the same wall/);

        // And the same person, younger, has nothing to say about it at all.
        expect(whatTheyWouldBeHeardOnAbout({
            ...spent, age: yearsAt(5, THE_ROAD_IS_RUNNING_OUT - 0.15)
        })).toBeNull();
    });

    it('reads being ahead of it only at a rung where that is remarkable', () => {
        const young = yearsAt(A_RUNG_WORTH_BEING_YOUNG_AT, AHEAD_OF_THE_ROAD - 0.02);
        expect(whatTheyWouldBeHeardOnAbout({
            ...ORDINARY, ordinal: A_RUNG_WORTH_BEING_YOUNG_AT, age: young
        })).toMatch(/young enough at this rung/);

        // BEING TWENTY AT QI CONDENSATION IS NOT AN ACHIEVEMENT. Everybody in
        // the setting starts there and most of them are young when they do, so
        // a reading that fired on it would fire on half the world.
        expect(whatTheyWouldBeHeardOnAbout({
            ...ORDINARY, ordinal: 2, age: yearsAt(2, AHEAD_OF_THE_ROAD - 0.02)
        })).toBeNull();
    });

    it('reads a house\'s mark, and the bottom of a house\'s roll', () => {
        expect(whatTheyWouldBeHeardOnAbout({ ...ORDINARY, chosen: true }))
            .toMatch(/decided to spend on/);
        for (const rank of ['Outer Disciple', 'junior disciple', 'Servant']) {
            expect(whatTheyWouldBeHeardOnAbout({ ...ORDINARY, rank }), rank)
                .toMatch(/lowest rank their house gives out/);
        }
        // A rank that is not the bottom of anything says nothing on its own.
        expect(whatTheyWouldBeHeardOnAbout({ ...ORDINARY, rank: 'Core Disciple' })).toBeNull();
    });

    /**
     * AND MOST OF THE WORLD STAYS QUIET.
     *
     * `theOneThingWorthSayingAbout` states the rule: *"a world where everybody
     * is a character is a world where nobody is."* It holds with more force for
     * speech, and the ambient qi reading is the worked example of what happens
     * when it does not: five turns in six opening on the same sentence until a
     * player stops reading the first line at all.
     *
     * So this is a bar, not a rate to tune. What is asserted is that the
     * ordinary case - somebody partway through their years, no rank worn, not
     * marked - is silent across the whole ladder.
     */
    it('is silent for the ordinary case at every rung on the ladder', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const midway = {
                ordinal, age: yearsAt(ordinal, 0.3), rank: 'Inner Disciple', chosen: false
            };
            expect(whatTheyWouldBeHeardOnAbout(midway), `ordinal ${ordinal}`).toBeNull();
        }
    });

    it('puts the thing with a clock on it ahead of the rest', () => {
        // Somebody who is BOTH out of road and marked by a house has the first
        // of those on their mind, because it is the only one that gets worse on
        // its own while they stand there.
        const both = {
            ordinal: 5, age: yearsAt(5, 0.9), rank: 'Outer Disciple', chosen: true
        };
        expect(whatTheyWouldBeHeardOnAbout(both)).toMatch(/still standing at the same wall/);
    });
});
