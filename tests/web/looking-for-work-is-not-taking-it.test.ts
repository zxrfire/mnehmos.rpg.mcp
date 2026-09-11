/**
 * A sentence that proposes to LOOK must not sign a contract.
 *
 * FOUND BY PLAYING. "I look for work" returned "3 months of Shipmaster, and 65
 * spirit stones for it" - a season gone and the cultivation with it, from a
 * sentence that had committed to nothing. `ASKING_AFTER_WORK` already routed
 * questions to the board, but it was built from interrogative shapes ("is there
 * work going", "who is hiring") and a search carries no modal and names no
 * board, so it fell past to the taking rule.
 *
 * The board is the reversible answer: it lists, the player answers with an
 * ordinal, and `whichOfTheNamedThings` counts that against the printed order.
 */

import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions';

/** Searching. Every one of these is a question and must reach the board. */
const LOOKING = [
    'I look for work',
    'I look around for work',
    'looking for a job',
    'I search for paying work',
    'I seek work',
    'I ask around for work',
    'I hunt for work',
    'I cast about for a wage',
    'I look for employment'
];

/** Committing. These still take, and the guard must not have swallowed them. */
const TAKING = [
    'I take the second job',
    'I take work at the docks',
    'I work the fields'
];

describe('looking for work is not taking it', () => {
    it('sends a search to the board', () => {
        for (const said of LOOKING) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('work');
            expect(plan.intent, said).toBe('board');
        }
    });

    it('still lets a sentence that commits, commit', () => {
        for (const said of TAKING) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('work');
            expect(plan.intent, said).not.toBe('board');
        }
    });

    /**
     * The interrogative shapes this rule was built from, kept because the new
     * alternation sits in the same regex and a search pattern that broke them
     * would trade one silent misread for another.
     */
    it('keeps answering the questions it already answered', () => {
        for (const said of ['is there any work going', 'what work is here', 'who is hiring']) {
            expect(parseIntent(said).intent, said).toBe('board');
        }
    });
});
