/**
 * A SENTENCE MADE OF NOTHING BUT A REFERENCE REACHED `unclear` AT PARSE TIME.
 *
 * Measured on a replayed corpus - 744 turns, three situations, two pinned
 * worlds. 186 of the 508 refusals were `unclear`, and 60 of those 186 were one
 * class: a sentence whose whole content is a pointer back at what the turn
 * before it listed.
 *
 *     the second one   that one   the first one   I take it
 *     the intake       the last one              I take the first one
 *
 * Every piece of the machinery for these already existed and none of it ran.
 * `whichOfTheNamedThings` reads ordinals, comparatives and paper words
 * correctly; `resolvingAgainstTheLastTurn` substitutes what it finds. Both work
 * on the `target` and `topic` FIELDS of a plan, and a sentence that reaches
 * `unclear` has no fields - so the resolver was handed a plan with nothing to
 * substitute into and the turn came back as a blank look at a pointer the game
 * itself had printed a listing for one turn earlier.
 *
 * ── AND THE SEMANTIC TIER WAS GUESSING ON THEM ───────────────────────────
 *
 * `reaching-a-verb-the-pattern-table-has-no-line-for.ts` runs on anything the
 * table calls `unclear`, and `saysSomething` let these through: `one`, `that`
 * and `it` are on its contentless list and `take` and `first` are not. So
 * `I take the first one`, one turn after a wall read, was answered by the
 * nearest verb in the embedding space - measured as `consume_pill`, which
 * swallows something.
 *
 * A pointer has no meaning of its own to be near anything. The tier declines on
 * one and hands it to the resolver that reads listings, which is a lookup
 * rather than a guess.
 *
 * ── AND WITHDRAWING THE GUESS EXPOSED A GUARD PASSING FOR A WRONG REASON ─
 *
 * `narrator.ts` will not let a model turn a sentence into a verb that spends
 * days unless the deterministic side also reads it as one. `i take the second
 * one`, one turn after a work board, was routed by the model to `work` and got
 * through that guard ONLY because the semantic tier had independently guessed
 * `consume_pill` at 0.809 - two verbs with nothing to do with each other, and a
 * guard that passed on a coincidence. Withdraw the guess and the guard started
 * refusing a board-taking that was read correctly.
 *
 * A sentence that is nothing but a pointer has no second reading by
 * construction: what it means is entirely in the turn before it, which no
 * reader in that file can see. So its silence is not evidence of a model
 * inventing an act, and the guard stands aside for one - the listing in the
 * prompt block is what constrains the model there, and resolving a pointer
 * against it is the job that block explicitly hands over.
 * `a-board-can-be-pointed-at.test.ts` is the ratchet on that half and caught
 * this in one run.
 *
 * ── WHAT THE ANSWER IS ───────────────────────────────────────────────────
 *
 * Where the pointer settles on one listed thing and the last turn's act was
 * already aimed at a name, the act runs again at the new one: that is the
 * player choosing off a list, which is one act at a different object. Where the
 * act named nothing, saying which one it was and asking what about it is the
 * answer - a read re-aimed is not the same act, and `market` re-aimed at a book
 * off its own stall listing was measured answering *"nothing here prices the
 * Lesser Qi-Gathering Manual"* directly above the line pricing it. Where the
 * pointer settles on nothing, the listing goes back in the order it was
 * printed, which is the order `whichOfTheNamedThings` counts an ordinal
 * against, so the answer to the question has somewhere to land.
 *
 * And the gate is the whole plan, steps included: a plan can read as `unclear`
 * and still carry a target, and that plan is the field resolver's.
 */

import { describe, expect, it } from 'vitest';

import {
    theSentenceIsNothingButAPointer,
    whichOfTheNamedThings
} from '../../src/web/last-turn-memory';
import { verbForASentenceThePatternsMissed } from '../../src/web/reaching-a-verb-the-pattern-table-has-no-line-for';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';

describe('a sentence that is only a pointer', () => {
    it('is recognised whole, frame and all', () => {
        for (const said of [
            'the second one', 'that one', 'the first one', 'I take it',
            'the intake', 'the last one', 'I take the first one', 'that',
            "I'll have the cheaper one", 'give me the second one'
        ]) {
            expect(theSentenceIsNothingButAPointer(said), said).not.toBeNull();
        }
    });

    /**
     * The guard is the WHOLE sentence. A pointer inside a sentence that also
     * says what to do with it is an ordinary sentence, and the field-level
     * resolver has always handled those.
     */
    it('is not a sentence that says what to do as well', () => {
        for (const said of [
            'I buy the second manual',
            'I take the first road north',
            'I cultivate for a year',
            'I talk to the second man',
            'what is here'
        ]) {
            expect(theSentenceIsNothingButAPointer(said), said).toBeNull();
        }
    });

    it('is not guessed at by the tier that reads meaning', async () => {
        for (const said of ['I take the first one', 'the second one', 'I take it']) {
            const table = parseIntent(said);
            expect(table.action, said).toBe('unclear');
            const guessed = await verbForASentenceThePatternsMissed(said, table);
            expect(guessed.action, said).toBe('unclear');
        }
    });
});

describe('the pointer is counted against what was printed', () => {
    it('counts an ordinal against the order the listing was printed in', () => {
        const named = [{ name: 'Cold Sword Sect' }, { name: 'Hollow Bell Wanderers' }];
        expect(whichOfTheNamedThings('the second one', 'the second one', named)?.name)
            .toBe('Hollow Bell Wanderers');
    });
});

describe('played, a pointer at a listing is answered', () => {
    it('does not come back a blank look one turn after a listing', async () => {
        const { game } = await makeGameInWorld({
            seed: 'a-pointer', worldSeed: 'a-pointer-world'
        });
        await game.newRun('Prober');

        // A listing, read out of the game's own answer rather than assumed.
        await game.act('what sects are there');

        for (const said of ['the second one', 'the first one', 'I take it']) {
            const turn = await game.act(said);
            expect(
                turn.narration.toLowerCase(),
                `${said} was answered with the blank look: ${turn.narration}`
            ).not.toContain('does not resolve into anything');
            expect(turn.narration.trim().length, said).toBeGreaterThan(0);
        }
    }, 300000);
});
