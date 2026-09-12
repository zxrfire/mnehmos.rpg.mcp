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
    whatTheyCarryForSomebodyElse,
    whatTheyWouldBeHeardOnAbout,
    THE_ROAD_IS_RUNNING_OUT,
    AHEAD_OF_THE_ROAD,
    A_RUNG_WORTH_BEING_YOUNG_AT
} from '../../../src/engine/world/what-somebody-here-is-chewing-on';
import { lifespanForOrdinal, MAX_ORDINAL } from '../../../src/engine/cultivation/realms';

/** Somebody with nothing on their mind, which is the default and the majority. */
const ORDINARY = { ordinal: 5, age: 20, rank: null, chosen: false, carriesForSomebodyElse: null };

/** Years that put a person at a given fraction of what their rung buys. */
const yearsAt = (ordinal: number, fraction: number) =>
    lifespanForOrdinal(ordinal) * fraction;

/**
 * The reading as a player with no narrator reads it.
 *
 * Most of this file was written when the function returned one string. It now
 * returns two renderings of one state - see `WhatIsOnTheirMind` - and the
 * assertions below are about the plain one, which is the sentence the engine
 * itself prints. The note the narrator is handed has its own case.
 */
const plainly = (person: Parameters<typeof whatTheyWouldBeHeardOnAbout>[0]) =>
    whatTheyWouldBeHeardOnAbout(person)?.plainly ?? null;

describe('what somebody standing here would be heard on', () => {
    it('says nothing about most people', () => {
        expect(plainly(ORDINARY)).toBeNull();
    });

    it('reads the road running out off the years the rung actually buys', () => {
        // The owner's junior sister. Not a mood and not a number: the fact is
        // that the years are mostly spent and the wall has not moved.
        const spent = {
            ...ORDINARY, ordinal: 5, age: yearsAt(5, THE_ROAD_IS_RUNNING_OUT + 0.05)
        };
        expect(plainly(spent)).toMatch(/still standing at the same wall/);

        // And the same person, younger, has nothing to say about it at all.
        expect(plainly({
            ...spent, age: yearsAt(5, THE_ROAD_IS_RUNNING_OUT - 0.15)
        })).toBeNull();
    });

    it('reads being ahead of it only at a rung where that is remarkable', () => {
        const young = yearsAt(A_RUNG_WORTH_BEING_YOUNG_AT, AHEAD_OF_THE_ROAD - 0.02);
        expect(plainly({
            ...ORDINARY, ordinal: A_RUNG_WORTH_BEING_YOUNG_AT, age: young
        })).toMatch(/young enough at this rung/);

        // BEING TWENTY AT QI CONDENSATION IS NOT AN ACHIEVEMENT. Everybody in
        // the setting starts there and most of them are young when they do, so
        // a reading that fired on it would fire on half the world.
        expect(plainly({
            ...ORDINARY, ordinal: 2, age: yearsAt(2, AHEAD_OF_THE_ROAD - 0.02)
        })).toBeNull();
    });

    it('reads a house\'s mark, and the bottom of a house\'s roll', () => {
        expect(plainly({ ...ORDINARY, chosen: true }))
            .toMatch(/decided to spend on/);
        for (const rank of ['Outer Disciple', 'junior disciple', 'Servant']) {
            expect(plainly({ ...ORDINARY, rank }), rank)
                .toMatch(/lowest rank their house gives out/);
        }
        // A rank that is not the bottom of anything says nothing on its own.
        expect(plainly({ ...ORDINARY, rank: 'Core Disciple' })).toBeNull();
    });

    /**
     * EVERY CLAUSE IS WRITTEN TO FOLLOW `they`, AND FIVE OF THE SIX WERE NOT.
     *
     * FOUND BY PLAYING. The only renderer of this column composes `What Gu Kelu
     * can be heard on, unprompted and not to you: they ${clause}`, and the
     * clauses had been written to follow a name - so the scene read *"they has
     * spent most of the years this rung allows"*. Singular `they` takes plural
     * agreement, and every branch here is read as a stranger, so there is no
     * caller that wants the singular form.
     */
    it('reads grammatically after the pronoun its only renderer puts in front', () => {
        const clauses = [
            plainly({
                ...ORDINARY, age: yearsAt(5, THE_ROAD_IS_RUNNING_OUT + 0.05)
            }),
            plainly({
                ...ORDINARY, carriesForSomebodyElse: { noun: 'blade', from: 'a house' }
            }),
            plainly({
                ...ORDINARY, carriesForSomebodyElse: { noun: 'blade', from: 'a person' }
            }),
            plainly({
                ...ORDINARY,
                ordinal: A_RUNG_WORTH_BEING_YOUNG_AT,
                age: yearsAt(A_RUNG_WORTH_BEING_YOUNG_AT, AHEAD_OF_THE_ROAD - 0.02)
            }),
            plainly({ ...ORDINARY, chosen: true }),
            plainly({ ...ORDINARY, rank: 'Outer Disciple' })
        ];
        expect(clauses.filter(clause => clause !== null)).toHaveLength(clauses.length);

        const SINGULAR = /\bthey (?:has|is|was|does|carries|wears|knows|owes|spends)\b/;
        const wrong = clauses
            .map(clause => `they ${clause}`)
            .filter(said => SINGULAR.test(said));
        expect(wrong, wrong.join(' ;; ')).toEqual([]);
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
            expect(plainly(midway), `ordinal ${ordinal}`).toBeNull();
        }
    });

    /**
     * AND THE BAR HAS TO BE ABOVE THE MIDDLE OF A REAL POPULATION.
     *
     * The claim above was made and never measured, and it was false. Counted
     * across the whole living population of three seeded worlds - 1,325 people
     * - `THE_ROAD_IS_RUNNING_OUT` at 0.55 sat below the median spend of 0.66,
     * so 57.4% of everybody came back on the same clause and 71.4% came back on
     * something. Played, four consecutive asks all produced that clause.
     *
     * The figures below are the ones that decide the bar. 0.66 is the median of
     * a freshly seeded world; 0.51 and 0.79 are the median and upper quartile
     * of the same worlds after the clock has moved ten years, which culls the
     * cohort the seeder places already past what its rung allows. A bar that
     * fires on any of them is a bar that fires on the ordinary person.
     *
     * Pinned as measurements rather than as offsets from the constant, so
     * lowering the constant fails here instead of quietly moving the goalposts.
     */
    it('says nothing about the person in the middle of a measured population', () => {
        for (const spent of [0.51, 0.66, 0.79]) {
            for (const ordinal of [2, 5, 9, 14]) {
                expect(
                    plainly({
                        ...ORDINARY, ordinal, age: yearsAt(ordinal, spent)
                    }),
                    `${spent} of the rung at ordinal ${ordinal}`
                ).toBeNull();
            }
        }
    });

    /**
     * THE BORROWED SWORD, which needed nothing built to represent it.
     *
     * The owner's second example: *"a senior brother monologue about how nice
     * his borrowed sword is"*. The possessions table has kept `ownerId` apart
     * from `possessorId` all along so that a house can lend somebody a thing,
     * and `seeding.ts` names that exact case while filling the treasuries -
     * *"lending a disciple a furnace"*. So this reads a fact the world already
     * writes.
     */
    it('reads a thing carried for somebody else, by kind and never by name', () => {
        const objects = [
            { kind: 'blade', ownerId: 'sect-azure-cloud-pavilion', possessorId: 'them' }
        ];
        expect(whatTheyCarryForSomebodyElse(objects, 'them'))
            .toEqual({ noun: 'blade', from: 'a house' });

        // A thing nobody owns is a thing they simply have, and so is a thing
        // they own themselves. Only the third case has terms attached.
        expect(whatTheyCarryForSomebodyElse(
            [{ kind: 'blade', ownerId: null, possessorId: 'them' }], 'them'
        )).toBeNull();
        expect(whatTheyCarryForSomebodyElse(
            [{ kind: 'blade', ownerId: 'them', possessorId: 'them' }], 'them'
        )).toBeNull();
        // And somebody else's loan is not theirs to be heard on.
        expect(whatTheyCarryForSomebodyElse(objects, 'somebody-else')).toBeNull();

        expect(plainly({
            ...ORDINARY, carriesForSomebodyElse: { noun: 'blade', from: 'a house' }
        })).toMatch(/carry a blade their house owns and they do not/);

        // AND A PERSON'S LOAN IS A DIFFERENT FACT. The owner: *"PEOPLE lend
        // too. Like you might lend your treasure to a junior brother or
        // sister."* A thing owed back to a house is owed to a roll and a
        // rule; a thing owed back to a person is owed to somebody who will be
        // standing there.
        expect(plainly({
            ...ORDINARY, carriesForSomebodyElse: { noun: 'blade', from: 'a person' }
        })).toMatch(/somebody above them lent out of their own hands/);
        // AND THE ARTICLE AGREES WITH THE NOUN. The first cut said "a
        // artifact", which tells a reader a machine wrote the sentence even
        // when everything else about it is right.
        expect(plainly({
            ...ORDINARY, carriesForSomebodyElse: { noun: 'urn', from: 'a house' }
        })).toMatch(/carry an urn/);
    });

    /**
     * WHAT A PERSON WOULD CALL IT, not what the column calls it.
     *
     * Measured on a seeded world: every tracked thing out on loan read as
     * "an artifact their house owns", because `kind` is a storage category and
     * only some of its values are words anybody says. The last word of a
     * thing's name is its noun, here and in general, so that is where the noun
     * comes from - and taking ONLY the last word is what keeps this inside the
     * discovery gate, since the full name is a proper noun a player may not
     * have earned.
     */
    it('calls a thing what it is, off the noun its name ends in', () => {
        const carried = (name: string, kind = 'artifact') => whatTheyCarryForSomebodyElse(
            [{ name, kind, ownerId: 'a-house', possessorId: 'them' }], 'them'
        );
        expect(carried('The Severing Canon')?.noun).toBe('canon');
        expect(carried("A Sword Elder's Tally")?.noun).toBe('tally');
        // One thing, not the lot it came out of.
        expect(carried('fired clay cauldrons')?.noun).toBe('cauldron');
        // And the storage category is the fallback, never the first answer.
        expect(carried('', 'manual')?.noun).toBe('manual');
    });

    it('puts the thing with a clock on it ahead of the rest', () => {
        // Somebody who is BOTH out of road and marked by a house has the first
        // of those on their mind, because it is the only one that gets worse on
        // its own while they stand there.
        const both = {
            ordinal: 5, age: yearsAt(5, 0.9), rank: 'Outer Disciple', chosen: true
        };
        expect(plainly(both)).toMatch(/still standing at the same wall/);
    });

    /**
     * AND WHAT THE NARRATOR IS HANDED IS NOT A SENTENCE.
     *
     * FOUND BY PLAYING. Four consecutive people came back on the identical
     * sentence - *"have spent most of the years this rung allows"* - and
     * raising the bar only makes that rarer, not different. The genre says this
     * state in an unbounded number of ways; the engine had six strings, and six
     * canned sentences buy a player six repetitions instead of one.
     *
     * The instruction to rewrite already exists in the phase-3 prompt and does
     * not work, because this model reproduces engine wording close to verbatim.
     * What does work is having nothing to lift, so `state` is a NOTE: no
     * subject, no finished verb, nothing that can be pasted into prose without
     * it reading as broken.
     *
     * `plainly` is the other half and is not a defect - a run with no narrator
     * configured is a shipping mode, and there the engine's own sentence is the
     * whole of what the player reads.
     *
     * What is asserted is the property, not the wording: every state is a
     * fragment, no state is the plain sentence, and the two are never equal.
     */
    it('hands the narrator a state to write from and not a line to carry over', () => {
        const everyReading = [
            { ...ORDINARY, age: yearsAt(5, THE_ROAD_IS_RUNNING_OUT + 0.05) },
            { ...ORDINARY, carriesForSomebodyElse: { noun: 'blade', from: 'a house' as const } },
            { ...ORDINARY, carriesForSomebodyElse: { noun: 'blade', from: 'a person' as const } },
            {
                ...ORDINARY,
                ordinal: A_RUNG_WORTH_BEING_YOUNG_AT,
                age: yearsAt(A_RUNG_WORTH_BEING_YOUNG_AT, AHEAD_OF_THE_ROAD - 0.02)
            },
            { ...ORDINARY, chosen: true },
            { ...ORDINARY, rank: 'Outer Disciple' }
        ].map(person => whatTheyWouldBeHeardOnAbout(person));

        expect(everyReading.filter(read => read !== null)).toHaveLength(everyReading.length);

        for (const read of everyReading) {
            // A predicate for `they` IS a sentence once the renderer puts the
            // pronoun in front, which is exactly why the narrator's copy must
            // not be one: the verb is what makes it liftable.
            expect(read!.state, read!.state).not.toMatch(
                /^(?:have|has|carry|carries|are|is|wear|wears)\b/
            );
            expect(read!.state).not.toBe(read!.plainly);
            expect(read!.plainly, read!.plainly).toMatch(
                /^(?:have|carry|are|wear)\b/
            );
        }
    });
});
