/**
 * THE HONEST REFUSAL FOR A POINTER EXISTED AND WAS UNREACHABLE.
 *
 * `askingWhichOfWhatWasNamed` has always carried three answers, and the first
 * of them is *"That points at nothing"* - for a pointer whose previous turn
 * listed nothing. It was gated on `before !== null`, and `before` is null on
 * exactly the turns that need it: the first turn of a run, and any turn more
 * than one turn after the listing, because the memory is one turn deep.
 *
 * So the branch was reachable only when there WAS a record and it happened to
 * have named nothing, and the case a player actually meets - saying "the second
 * one" with nothing behind it at all - fell through to the blank look.
 *
 * Measured on a pinned world, with no listing on the turn before:
 *
 *     the second one   that one   the first one   I take it
 *     the intake       the last one   I take the first one   that
 *
 * All eight came back *"You turn the thought over and it does not resolve into
 * anything you could actually do standing here"*, followed by the square's
 * roster and three suggested sentences. All eight resolve when a listing is on
 * the turn before, which is what says the parser was never the defect: the
 * refusal was.
 *
 * The two answers are different events and the wording keeps them apart. A
 * pointer at a listing that named nothing is *the turn before this one listed
 * nothing*; a pointer with no turn behind it at all is *there is no turn before
 * this one*. Telling a player their memory lapsed and telling them the listing
 * was empty are not the same news.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';

const BLANK = 'does not resolve into anything';

const POINTERS = [
    'the second one', 'that one', 'the first one', 'I take it',
    'the intake', 'the last one', 'I take the first one', 'that'
];

describe('a pointer with no turn behind it', () => {
    it('is told there is no turn behind it, rather than looked at blankly', async () => {
        for (const said of POINTERS) {
            const { game } = await makeGameInWorld({
                seed: 'no-turn-behind', worldSeed: 'no-turn-behind-world'
            });
            await game.newRun('Prober');
            const turn = await game.act(said);
            expect(turn.narration.toLowerCase(), `${said}: ${turn.narration}`)
                .not.toContain(BLANK);
            expect(turn.narration, `${said}: ${turn.narration}`)
                .toMatch(/no turn before this one|nothing is remembered/i);
        }
    }, 600000);

    /**
     * And the memory really is one turn deep, which is the fact the refusal is
     * reporting. A listing two turns back is a listing that has lapsed, and
     * saying so is the answer.
     */
    it('says so when the listing has scrolled out of memory', async () => {
        const { game } = await makeGameInWorld({
            seed: 'lapsed', worldSeed: 'lapsed-world'
        });
        await game.newRun('Prober');
        await game.act('what sects are there');
        await game.act('I cultivate for a day');
        const turn = await game.act('the second one');
        expect(turn.narration.toLowerCase(), turn.narration).not.toContain(BLANK);
    }, 300000);

    /** Costs nothing, because a question that could not be answered is free. */
    it('spends no day being refused', async () => {
        const { game } = await makeGameInWorld({
            seed: 'no-turn-behind', worldSeed: 'no-turn-behind-world'
        });
        const opened = await game.newRun('Prober');
        const before = opened.run.elapsedDays;
        const turn = await game.act('the second one');
        expect(turn.state.run.elapsedDays).toBe(before);
    }, 300000);
});
