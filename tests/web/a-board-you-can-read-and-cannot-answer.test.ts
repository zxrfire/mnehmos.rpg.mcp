/**
 * The board names four jobs, and one sentence in the language takes one.
 *
 * FOUND BY PLAYING BLIND, and the finding did not survive contact with the
 * ruling already in the repo. Both halves are written down here, because the
 * half that was wrong is the more useful record.
 *
 * ── WHAT WAS PLAYED ──────────────────────────────────────────────────────
 *
 * A sixteen-year-old with twenty-three spirit stones, two open wounds and an
 * empty stomach, standing on the Azure Dew Sect grounds:
 *
 *     > i ask for a job
 *     Twelve days pass in the service of a shipmaster. The work is slow and the
 *     pay is ten spirit stones... seven of thirty remains.
 *
 *     > i take it
 *     Weng Er does not let go... He catches the hand and answers the robbery
 *     with a strike that opens the body... 1 of 30 left.
 *
 * ── THE HALF THAT WAS ALREADY DECIDED, AND STAYS DECIDED ─────────────────
 *
 * The first read of that was "an enquiry should never spend twelve days", and
 * it is wrong. `asking-for-work-is-not-taking-it.test.ts` settled this by
 * playing it from the other end, and its measurement is the stronger one:
 * routing a seeking sentence to a menu was tried and was worse. Its split is
 * QUESTION against STATEMENT OF INTENT - *any work going?* reads the board;
 * *I look for work*, *I ask around for work*, *I need a job* take one - and the
 * reason is that `work` is the verb that feeds a starving cultivator, and
 * answering somebody out of stones with a listing is a turn they do not have.
 *
 * `i ask for a job` is a statement of intent by that rule, so it takes work,
 * and nothing in this file moves it. The twelve days bought ten stones; the
 * turn was not the one that ended the run.
 *
 * ── THE HALF THAT WAS ACTUALLY MISSING ───────────────────────────────────
 *
 * The turn that ended it was `i take it`, and what was wrong there is that
 * saying yes had almost no vocabulary. Measured against the parser, off a board
 * that had just been listed:
 *
 *     i take the job        ->  work
 *     i accept the job      ->  unclear
 *     i take the notice     ->  unclear
 *     i take him up on it   ->  unclear
 *     i sign for the errand ->  unclear
 *
 * A board a player can read and cannot answer is data with no verb behind it,
 * and the one phrasing that worked is not a vocabulary.
 *
 * ── AND THE BARE PRONOUN IS DELIBERATELY NOT HERE ────────────────────────
 *
 * `i take it` and `i do it` are left with the classifier, which is handed the
 * previous turn and every name it printed and is told to resolve exactly this
 * kind of reference against that list. A demonstrative resolved by a pattern
 * table is a guess about which listing was meant; resolved against the last
 * turn it is a lookup. Every entry pinned below names the thing.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

/** What the sentence routed to, as `action/intent`. */
function routes(said: string): string {
    const plan = parseIntent(said);
    return plan.intent ? `${plan.action}/${plan.intent}` : plan.action;
}

describe('saying yes to a line on the board', () => {
    it.each([
        'i accept the job',
        'i take the notice',
        'i take him up on it',
        'i sign for the errand',
        'i accept the work',
        'i take the posting'
    ])('%s answers the board', said => {
        expect(routes(said)).toBe('work');
    });

    /** And the one phrasing that already worked still does. */
    it('leaves the sentence that worked alone', () => {
        expect(routes('i take the job')).toBe('work');
        expect(routes('i take work for a season')).toBe('work');
    });

    /**
     * AND `position` AND `contract` STAY WITH THEIR OWN VERBS. Both were
     * measured taking sentences that are not about a board line, which is why
     * neither is on the noun list. Asserted as "not work" rather than as a
     * destination, because where they belong is a separate question and pinning
     * it here would make this file fail for somebody else's fix.
     */
    it.each([
        'i accept a position in the sect',
        'i sign the contract with him',
        'i sign the oath'
    ])('%s is not a season of hauling', said => {
        expect(routes(said)).not.toBe('work');
    });

    /**
     * AND THE BARE PRONOUN IS STILL THE CLASSIFIER'S. Asserted so that a later
     * widening of the list above has to decide to take it rather than take it
     * by accident: a table that reads `i take it` as work would read it that way
     * standing in front of a stall, a corpse, or a man holding a sword.
     */
    it('does not decide what a bare "it" was', () => {
        expect(routes('i take it')).toBe('unclear');
        expect(routes('i do it')).toBe('unclear');
    });
});

describe('an order can say whose it is', () => {
    /**
     * FOUND IN THE SAME PASS. `i accept the order` matched the summons row and
     * `i accept the elder's order` did not, because the noun had to sit
     * immediately after the verb. Naming who sent for you is the more natural
     * sentence and it was the one that failed - the near-synonym trap AGENTS.md
     * names, where the phrasing a player reaches for first is the broken one.
     */
    it('accepts an order named by who sent it', () => {
        expect(routes("i accept the elder's order")).toBe('sect/accept');
        expect(routes('i accept the task the elder gave me')).toBe('sect/accept');
    });

    it.each(['i accept', 'i accept it', 'i accept the order', 'i accept the summons'])(
        '%s still accepts', said => {
            expect(routes(said)).toBe('sect/accept');
        }
    );

    /**
     * AND THE BOARD'S OWN WORD IS STILL THE BOARD'S. `sect-phrasings.ts` says so
     * outright: *"I accept the duty" has meant taking a line off the wall since
     * that verb was written*, and claiming it would answer somebody standing at
     * a noticeboard by telling them nobody has sent for them.
     */
    it('leaves the duty with the duty board', () => {
        expect(routes('i accept the duty')).toBe('sect/duty');
    });
});
