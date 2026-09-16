/**
 * The price question names the person it is put to.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT WAS PLAYED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * *"how much does the merchant want for what he is carrying"* reached
 * `interact/trade` with NO TARGET. In `haggleOverAPrice` that means the person
 * never becomes `facing`, so their own standing offers are never narrowed to
 * them and the answer falls through to the stall - where the rate is stamped
 * with whoever the screen before had named. A man with four standing offers of
 * his own was made to quote a book he does not hold.
 *
 * ── WHY THE SLOT WAS NARROW, AND WHY IT IS NOT ANY MORE ──────────────────
 *
 * `whoIsBeingOfferedSomething` reads the person out of the slot a ditransitive
 * verb puts them in, and it took only a pronoun or a capitalised name because
 * `offer the manual` puts a THING in that same slot - a shape that cannot tell
 * the two apart hands a resolver a book to look for a face in.
 *
 * The price question is not that shape. What follows the slot is `want`,
 * `take`, `ask` or `charge`, and a manual wants nothing, so the slot can only
 * hold somebody. It is widened to the words a player uses when nobody has told
 * them a name - "the merchant", "the old woman at the stall" - and the
 * thing-or-person guard still throws out anything that reads as an object.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ───────────────────────────────────
 *
 * Getting the right mouth is this change. What comes out of it is a separate
 * ruling being implemented elsewhere - which goods a mortal deals in and which
 * a cultivator does - and nothing here asserts an answer, only who was asked.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { whoIsBeingOfferedSomething } from '../../src/web/verb-pattern-table';

describe('asking what somebody wants for it names them', () => {
    it.each([
        ['how much does the merchant want for what he is carrying', 'the merchant'],
        ['how much does the old woman want for what she is carrying', 'the old woman'],
        ['how much does Shen Fuqing want for what they are carrying', 'Shen Fuqing'],
        ['how much would the stallholder take for the manual', 'the stallholder'],
        ['what will Shen Fuqing charge for it', 'Shen Fuqing']
    ])('%j is asked of %j', (said, who) => {
        expect(whoIsBeingOfferedSomething(said)).toBe(who);
    });

    /**
     * And it is still the haggle it was, put to the person the sentence named.
     * The verb and the label are what route it to `haggleOverAPrice`; the
     * target is what makes that routine narrow the offers to one person.
     */
    it('reaches the haggle with the person on it', () => {
        const plan = parseIntent('how much does the merchant want for what he is carrying');
        expect(plan.action).toBe('interact');
        expect(plan.intent).toBe('trade');
        expect(plan.target).toBe('the merchant');
    });

    /**
     * THE GUARD THE WIDER SLOT STILL SITS BEHIND. An offer puts a thing where a
     * person goes, and reading one as a face is the defect this slot was narrow
     * to avoid. `A_PORTABLE_THING` is the repo's own answer to thing-or-person
     * and both readers ask it.
     */
    it.each(['I offer the manual', 'I offer my sword', 'I offer twenty stones'])(
        '%j still names nobody',
        said => expect(whoIsBeingOfferedSomething(said)).toBeUndefined()
    );

    /** And the shapes that already worked are untouched. */
    it.each([
        ['I offer him twenty stones', 'him'],
        ['I offer Shen Liefeng the manual', 'Shen Liefeng'],
        ['how much does she want for it', 'she']
    ])('%j still reaches %j', (said, who) => {
        expect(whoIsBeingOfferedSomething(said)).toBe(who);
    });
});
