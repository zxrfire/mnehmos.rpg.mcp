/**
 * "Who told you that?" - asked of somebody called *where*.
 *
 * FOUND BY PLAYING BLIND, one turn after the game had listed five destinations
 * by name and said which had room and which had thick air:
 *
 *     > i ask around about where to go
 *     Liang Lanru is the closest. He looks at you as you ask where to go, his
 *     expression flat. "Who told you that?" he asks. He does not wait for you
 *     to speak, his gaze already shifting toward Yun Ronghe. He steers the
 *     conversation toward a different subject.
 *
 * A deflection with a suspicious edge, about nothing, to a question nobody had
 * put to him.
 *
 * ── WHAT THE REQUEST READER DID WITH THE SENTENCE ────────────────────────
 *
 * `requestPutToSomebody` finds the request verb, finds the pivot where the ask
 * starts, and reads everything in between as the PERSON. With `ask` and `to`
 * as the two ends, what was in between was a question word. Measured across the
 * phrasings of one question:
 *
 *     "i ask where to go"           ->  person "where",         topic "go"
 *     "i ask around where to go"    ->  person "around where",  topic "go"
 *     "i ask someone where to go"   ->  person "someone where", topic "go"
 *     "i ask her where to go"       ->  person "her where",     topic "go"
 *
 * while `where can i go` and `where should i go` reached the destinations read
 * all along. Same question, and the phrasings a player actually types were the
 * broken ones - the near-synonym trap `AGENTS.md` names.
 *
 * ── TWO DEFECTS, AND THEY ARE NOT THE SAME ONE ───────────────────────────
 *
 * NOBODY WAS NAMED. `NAMES_NOBODY` already held the words that mean no
 * particular person - `someone`, `around`, `the locals`. It did not hold the
 * words that are not a person AT ALL. A request cannot be put to an
 * interrogative, and the three rows above that reach `destinations` now do so
 * because the request reader declines them rather than because the destinations
 * pattern out-raced it.
 *
 * AND SOMEBODY WAS NAMED, WITH THE QUESTION WORD STUCK TO THEM. "I ask her
 * where to go" names a real person and the interrogative rode along into the
 * target, so the engine went looking for somebody called *her where*. That one
 * is `cleanPerson`'s, and fixing it in the first place would have been wrong:
 * asking a named person where to go is a question put to a PERSON, and their
 * answer out of what they know is how the genre moves anybody anywhere.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';
import { requestPutToSomebody } from '../../src/web/what-a-request-asks-and-of-whom';

describe('asking nobody in particular where to go reads the destinations', () => {
    it.each([
        'i ask around about where to go',
        'i ask around where to go',
        'i ask where to go',
        'i ask someone where to go',
        'i ask anybody where to go',
        'i ask the locals where to go',
        'i ask for directions',
        'i ask around for directions'
    ])('%s reads the destinations', said => {
        expect(parseIntent(said).action).toBe('destinations');
    });

    /** And the phrasings that always worked still do. */
    it.each(['where can i go', 'where should i go'])('%s still reads the destinations', said => {
        expect(parseIntent(said).action).toBe('destinations');
    });

    /**
     * AND THE REQUEST READER DECLINES THEM AT SOURCE. Asserted separately from
     * the routing, because a destinations pattern that merely out-ran the
     * request branch would pass every case above and leave somebody called
     * `where` reachable from every other sentence shape.
     */
    it.each(['i ask where to go', 'i ask around where to go', 'i ask someone where to go'])(
        'puts %s to nobody', said => {
            expect(requestPutToSomebody(said)).toBeNull();
        }
    );
});

describe('asking a named person is still asking them', () => {
    it.each([
        ['i ask her where to go', 'her'],
        ['i ask him where to go', 'him'],
        ['i ask bai wanchen where to go', 'bai wanchen'],
        ['i ask the old woman where to go', 'old woman']
    ])('%s asks %s', (said, person) => {
        const plan = parseIntent(said);
        expect(plan.action).toBe('request');
        expect(plan.target).toBe(person);
    });

    /**
     * AND THE REQUESTS THAT HAVE NOTHING TO DO WITH A QUESTION WORD ARE
     * UNTOUCHED. The trailing trim is anchored to the end of the person, so a
     * name cannot lose a word to it in an ordinary ask.
     */
    it.each([
        ['i ask him for the manual', 'him'],
        ['i ask her to teach me', 'her'],
        ['i ask bai wanchen to teach me', 'bai wanchen']
    ])('%s asks %s', (said, person) => {
        expect(parseIntent(said).target).toBe(person);
    });
});
