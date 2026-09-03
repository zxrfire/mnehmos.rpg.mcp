/**
 * "Which houses would take me" was answered with whether I am in one.
 *
 * Played, unaffiliated:
 *
 *   is there a sect anywhere near here that would take me?
 *   -> "Unaffiliated. No stipend, no array, no elder, and nobody to notice if
 *      this run ends badly."
 *
 * THE THIRD INSTANCE OF ONE DEFECT, and the three together are what make the
 * shape legible - a prospect question answered with a status row:
 *
 *   is there WORK GOING here?         -> what is FOR SALE here
 *   WHERE SHOULD I START?             -> where you COULD WALK TO
 *   is there a sect THAT WOULD TAKE ME? -> WHETHER YOU ARE IN ONE
 *
 * Every one of them: what should I do next, answered with here is what
 * currently is.
 *
 * And in all three the real answer already existed and was good, so each was a
 * routing fix rather than a missing surface.
 *
 * -- BUT THE DESTINATION FOR THIS ONE WAS WRONG, AND IT IS RULED ---------
 *
 * These phrasings first went to the wall - `billsOnTheWall`, real intakes with
 * dates and bars. That is a grounded answer and it is not the answer to this
 * question. The two surfaces reply to different things:
 *
 *   THE WALL     whatever happens to be nailed up where the player is
 *                standing. A coincidence of position.
 *   THE REGISTER the houses that would actually have THIS asker, filtered by
 *                what they are.
 *
 * Somebody asking which houses would take them is asking about the world, not
 * about this noticeboard, so `sect` owns the family.
 *
 * -- AND IT WAS RULED BECAUSE TWO TEST FILES CONTRADICTED EACH OTHER -----
 *
 * This file required "which houses would TAKE me" to reach the wall while
 * `asking-about-a-named-thing.test.ts` required "which houses would HAVE me"
 * to reach `sect`. One question, one synonym swapped, opposite answers, and
 * whichever pattern happened to be tested first won - so widening a pattern
 * toward the wall moved the boundary and removing it moved it back. No parse
 * satisfies both. This file was the one that was wrong.
 *
 * IF YOU ARE HERE BECAUSE YOU WIDENED A PATTERN TOWARD THE WALL: that is the
 * thing this comment exists to stop. A pattern that reaches these sentences
 * before the join branch does not add a shape the table was missing; it takes
 * them off a surface that already answers them better.
 *
 * -- LOCALITY IS A FILTER ON THIS QUESTION, NOT A DIFFERENT QUESTION -----
 *
 * "near here" is the one discriminator genuinely present in the words, and it
 * was deliberately NOT used to route two of these six somewhere else. A player
 * asking "is there a sect near here that would take me" wants the same
 * register with reachability applied, and splitting a family the player
 * experiences as one - on an adverb - is the special-case-per-phrasing shape
 * this layer keeps paying for. If locality is worth anything it is an ordering
 * INSIDE the answer: the ones you could walk to first.
 *
 * -- AND THE REGISTER IS GATED ON WHAT THE ASKER KNOWS -------------------
 *
 * The wall answer was defensible because a bill leaks nothing - somebody
 * nailed it up. A register of houses that would have you is a better answer
 * and an easier way to hand over the answer key, so it names only houses this
 * cultivator has heard of and COUNTS the rest. Same discipline the travel read
 * keeps: names below `placed` are counted and never listed, because naming one
 * hands over a discovery that was meant to be earned.
 */

import { parseIntent } from '../../src/web/actions';

const asked = (line: string) => {
    const p = parseIntent(line) as { action: string; intent?: string };
    return `${p.action}${p.intent ? '/' + p.intent : ''}`;
};

describe('asking which houses would have you', () => {
    /**
     * The register, not the membership row and not the noticeboard. All six
     * including the two that name a locality: "near here" narrows this
     * question rather than asking a different one.
     */
    it('reaches the register of who would, not the membership row', () => {
        for (const line of [
            'is there a sect anywhere near here that would take me?',
            'is there a sect near here that would take me',
            'which houses would take me',
            'who would have me',
            'what sects would admit me',
            'is there a house that would have someone like me'
        ]) {
            expect(asked(line), line).toBe('sect');
        }
    });

    /**
     * THE DEFECT THIS FILE WAS OPENED FOR, which is unchanged: whichever
     * surface owns the family, it is not the sheet read. A prospect question
     * answered with "unaffiliated" is the failure, and it stays fixed.
     */
    it('is never answered with whether they are already in one', () => {
        for (const line of [
            'is there a sect anywhere near here that would take me?',
            'which houses would take me',
            'who would have me'
        ]) {
            expect(asked(line), line).not.toBe('sect/standing');
        }
    });

    /** The phrasing that already worked, kept as the control. */
    it('keeps the one that named the recruiting verb outright', () => {
        expect(asked('is anyone recruiting')).toBe('look/bills');
    });
});

/**
 * AND THE `sect` VERB KEEPS ITS OWN EXEMPLARS.
 *
 * `which houses take people` and `what would it take to be admitted` are listed
 * in `how-a-player-says-each-verb.ts` under `sect`, so they stay there rather
 * than being taken on a technicality. What this claims is the shape those two
 * do not have: somebody asking whether a house would take THEM.
 */
describe('and it takes nothing from the sect verb', () => {
    it('leaves the sect listing its own phrasings', () => {
        expect(asked('which houses take people')).toBe('sect');
        expect(asked('what would it take to be admitted')).toBe('sect');
    });

    it('leaves the membership read to somebody asking about themselves', () => {
        expect(asked('what is my standing')).not.toBe('look/bills');
        expect(asked('am I in a sect')).not.toBe('look/bills');
    });
});
