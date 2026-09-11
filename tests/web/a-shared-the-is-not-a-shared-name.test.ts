/**
 * "The Abbot?" they said, to somebody who had asked about the flame palm.
 *
 * FOUND BY PLAYING BLIND:
 *
 *     > i use the flame palm
 *     You turn the thought over and it does not resolve into anything you could
 *     actually do standing here. Cao Kebo does not know it and has two it could
 *     be. "Nine Abyss Flame Sect?" they say. "Or The Abbot." They wait for you
 *     to pick one.
 *
 * The first offer shares `flame` and is a fair thing for a person to say. The
 * second shares `the`.
 *
 * ── THE CAUSE, AND IT IS A CLASS THIS FILE HAS SEEN BEFORE ───────────────
 *
 * `matchScore`'s last rule counts words over two letters shared between the
 * sentence and the name, and `the` is three letters long. So a shared article
 * scored 30 - the identical score a genuinely shared distinctive word earns -
 * and every name in the world beginning with an article was a candidate for
 * every sentence containing one.
 *
 * A guard testing typography rather than meaning, which is the same class as
 * the defect already recorded two rules above it in that function: `I learn it`
 * resolving to Bitter Frost Needle, because `it` is inside `B-it-ter`.
 *
 * ── AND THE BAR THAT SHOULD HAVE CAUGHT IT WAS NOT A BAR ─────────────────
 *
 * `CLOSE_ENOUGH_TO_OFFER` is documented as how close a name has to be before
 * somebody offers it. It was `0.34`, compared against whatever `likeness`
 * returned - and both callers in the repository pass `matchScore`, which runs 0
 * to 100. The threshold had never excluded anything in play.
 *
 * It now comes from the caller, in the caller's own units, for the same reason
 * the header already gives for `likeness`: one answer to "are these the same
 * name", and no way for the two to drift. And it is set at the lowest score one
 * shared distinctive word earns, so the module's documented generosity is kept
 * deliberately rather than by the bar being broken.
 */
import { describe, expect, it } from 'vitest';

import { matchScore, WORTH_OFFERING } from '../../src/web/entities.js';
import { whatSomebodyHereWouldAsk } from '../../src/web/what-somebody-here-would-ask.js';

describe('a word that carries none of the name', () => {
    it('scores nothing, where it used to score a shared name', () => {
        // The played pair, both figures.
        expect(matchScore('the flame palm', 'The Abbot')).toBe(0);
        expect(matchScore('the flame palm', 'Nine Abyss Flame Sect')).toBeGreaterThan(0);
    });

    it.each([
        ['what is the way to the gate', 'The Abbot'],
        ['i ask him for that', 'That Which Waits'],
        ['who is with her', 'Her Own Road']
    ])('%s places nothing on "%s"', (said, name) => {
        expect(matchScore(said, name)).toBe(0);
    });

    /**
     * AND A NAME MADE MOSTLY OF THEM STILL MATCHES ITSELF. The rule drops the
     * empty words from the SHARED count; it does not make a name unsayable.
     */
    it('still matches a name a player types in full', () => {
        expect(matchScore('the hollow court', 'The Hollow Court')).toBe(100);
        expect(matchScore('the hollow court', 'The Hollow Court Annex')).toBeGreaterThan(0);
    });

    /** And a genuinely shared distinctive word is untouched. */
    it('leaves a real shared word alone', () => {
        expect(matchScore('the hollow one', 'The Hollow Court')).toBeGreaterThan(0);
    });
});

describe('the bar on what somebody offers', () => {
    const asker = { id: 'asker', name: 'Shen Yuan' };

    /**
     * Driven through the module with the production matcher and the production
     * bar, which is the pairing that was broken: a 0-to-100 score against a
     * threshold of 0.34.
     */
    it('excludes what it says it excludes, in the caller\'s own units', () => {
        const asked = whatSomebodyHereWouldAsk({
            askedFor: 'the flame palm',
            asker,
            theyCanPlace: {
                inFrontOfThem: [
                    { id: 'a', name: 'The Abbot', kind: 'person' },
                    { id: 'b', name: 'Nine Abyss Flame Sect', kind: 'house' }
                ],
                ownHouseWouldKnow: []
            },
            likeness: matchScore,
            closeEnough: WORTH_OFFERING
        });
        expect(asked.offered).toEqual(['Nine Abyss Flame Sect']);
    });

    /**
     * AND IT IS STILL GENEROUS, which is what the module asks for in writing:
     * one shared distinctive word is enough to be worth saying out loud.
     */
    it('still offers a name that shares one real word', () => {
        expect(WORTH_OFFERING).toBeLessThanOrEqual(matchScore('flame palm', 'Nine Abyss Flame Sect'));
    });
});
