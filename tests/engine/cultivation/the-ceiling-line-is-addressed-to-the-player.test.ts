/**
 * A stranger in the room, once per turn, for the whole opening of the game.
 *
 * FOUND BY PLAYING BLIND. Nearly every early turn of a fresh run ended on this
 * paragraph, under second-person prose and behind a day stamp:
 *
 *     At the outset: No cultivation method, so nothing accumulates however long
 *     they sit. What closes that is a book, or somebody willing to teach them
 *     one.
 *
 * Read as a reader reads it, `they` is somebody else - a third party the player
 * has not met, being discussed in front of them. It is the single most repeated
 * sentence a new player sees, because three different reads all correctly
 * report the same ceiling, and every one of them is about the reader.
 *
 * ── THE CAUSE: TWO FIELDS, ONE VOICE ─────────────────────────────────────
 *
 * `techniqueCeiling` returns `label` and `line` and they were written as though
 * they were the same channel. They are not.
 *
 *   `label` is a row in the rate breakdown - a factor printed beside its
 *   multiplier, ABOUT a cultivator. It stays person-free and this file asserts
 *   that it does.
 *
 *   `line` has three consumers and every one hands it to the player in the
 *   player's own voice: the time-skip digest pushes it as an event beside lines
 *   that already say *this stretch will strike on your behalf*; the seclusion
 *   read puts it in `required`, the channel that exists to reach the player
 *   verbatim; and the cultivate refusal sets it against a pointer reading
 *   *carries further than you stand*. `simulateTimeSkip` is imported only from
 *   `src/web/`, so no NPC is ever the subject of any of them.
 *
 * The tell that the fact was right and only the person was wrong:
 * `whyProgressHasStopped` needed the same sentence and wrote its own
 * second-person copy rather than use this one.
 *
 * ── WHAT IS PINNED HERE, AND WHAT IS DELIBERATELY NOT ────────────────────
 *
 * Not the wording. The branch-selection assertions live in `no-method.test.ts`
 * and `ceiling-above-the-lid.test.ts` and they were rewritten off the pronoun
 * so that they pin the ERRAND rather than the grammar. This file pins only the
 * thing that was wrong: who the sentence is addressed to, across every branch
 * that produces one.
 */

import { describe, it, expect } from 'vitest';

import { NO_MANUAL_CEILING, techniqueCeiling } from '../../../src/engine/cultivation/cultivation';

/** A copy in the bag, named because the line names it. */
const A_COPY_IN_THE_BAG = 'Five-Breath Circulation Scripture';

/**
 * Every shape of `techniqueCeiling` that returns a line at all. Both states,
 * both sides of the copy-in-the-bag branch, and both sides of the Lid - because
 * the defect was in four separate string literals and fixing three of them
 * would leave the fourth to surface on the turn that reaches it.
 */
const EVERY_BRANCH_THAT_SPEAKS = [
    ['no method, climbing, empty handed', () => techniqueCeiling(0, NO_MANUAL_CEILING)],
    ['no method, climbing, carrying a copy', () => techniqueCeiling(0, NO_MANUAL_CEILING, [A_COPY_IN_THE_BAG])],
    ['no method, above the Lid', () => techniqueCeiling(46, NO_MANUAL_CEILING)],
    ['no method, above the Lid, carrying a copy', () => techniqueCeiling(46, NO_MANUAL_CEILING, [A_COPY_IN_THE_BAG])],
    ['the manual has ended, climbing', () => techniqueCeiling(20, 20)],
    ['the manual has ended, above the Lid', () => techniqueCeiling(46, 46)]
] as const;

/**
 * The words that make the reader a bystander. `their` and `them` are here
 * because the exhausted branch said *the manual in their hands*, which is the
 * same defect wearing a different case.
 */
const SOMEBODY_ELSE = /\b(they|them|their|theirs)\b/i;

describe('the ceiling line speaks to the person who is stalled', () => {
    for (const [what, read] of EVERY_BRANCH_THAT_SPEAKS) {
        it(`does not discuss the player in the third person: ${what}`, () => {
            const line = read().line;
            expect(line, 'this branch is meant to produce a line').not.toBeNull();
            expect(line!).not.toMatch(SOMEBODY_ELSE);
        });
    }

    /**
     * AND IT IS STILL ADDRESSED TO SOMEBODY. A line scrubbed of pronouns
     * entirely would pass the assertion above while reading like a notice on a
     * wall, which is the other half of what was wrong with it.
     */
    it('addresses the reader', () => {
        for (const [what, read] of EVERY_BRANCH_THAT_SPEAKS) {
            expect(read().line!, what).toMatch(/\b(you|your)\b/i);
        }
    });

    /**
     * THE OTHER FIELD IS NOT PROSE AND MUST NOT ACQUIRE A READER.
     *
     * `label` sits in a column of rate factors beside a multiplier. Saying
     * "you" there would put second-person address inside an operator table,
     * which is the same category error pointing the other way.
     */
    it('leaves the breakdown label person-free', () => {
        for (const [what, read] of EVERY_BRANCH_THAT_SPEAKS) {
            const label = read().label;
            expect(label, what).not.toMatch(SOMEBODY_ELSE);
            expect(label, what).not.toMatch(/\b(you|your)\b/i);
        }
    });
});
