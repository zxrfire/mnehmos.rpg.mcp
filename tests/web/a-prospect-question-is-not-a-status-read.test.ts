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
 * And in all three the real answer already existed and was good. `billsOnTheWall`
 * returns actual intakes with dates and bars, so this is a routing fix rather
 * than a missing surface: the phrasings go to the rule that already reaches the
 * wall rather than getting a branch of their own.
 */

import { parseIntent } from '../../src/web/actions';

const asked = (line: string) => {
    const p = parseIntent(line) as { action: string; intent?: string };
    return `${p.action}${p.intent ? '/' + p.intent : ''}`;
};

describe('asking which houses would have you', () => {
    it('reaches the wall, not the membership row', () => {
        for (const line of [
            'is there a sect anywhere near here that would take me?',
            'is there a sect near here that would take me',
            'which houses would take me',
            'who would have me',
            'what sects would admit me',
            'is there a house that would have someone like me'
        ]) {
            expect(asked(line), line).toBe('look/bills');
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
