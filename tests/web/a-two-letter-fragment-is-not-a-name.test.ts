/**
 * A short fragment buried in a word is not a reference to that thing.
 *
 * Found by playing. After buying the Lesser Qi-Gathering Manual, `I learn it`
 * answered about **Bitter Frost Needle** - a rung-8 art the cultivator had
 * never heard of - because "it" sits inside "B-it-ter" and `matchScore`'s
 * containment branch returns 60, which clears `MATCH_THRESHOLD` of 55.
 * `I learn the manual` was correct the whole time, so the bug was invisible to
 * anybody testing with full names.
 *
 * Two separate holes, and both are covered here because either one alone still
 * lets the reported sentence through:
 *
 *   1. containment scoring a two-letter fragment at all
 *   2. a bare pronoun being scored against the catalog in the first place
 *
 * The second is the more general fix: resolving what "it" refers to is a
 * different job from matching a name, and this module does not do that job.
 * Returning null lets the caller refuse in words instead of confidently
 * answering about the wrong object - which is the failure mode that makes this
 * worse than a miss. A player told "that does not resolve" tries again; a
 * player told about Bitter Frost Needle believes the game understood them.
 */

import { describe, it, expect } from 'vitest';
import { matchScore, MATCH_THRESHOLD, STANDS_IN_FOR_A_THING } from '../../src/web/entities.js';
import { TECHNIQUES } from '../../src/data/cultivation/techniques.js';

/** What `best` does, exercised through the scorer it is built on. */
const wouldMatch = (query: string): boolean =>
    TECHNIQUES.some(t => matchScore(query, t.name) >= MATCH_THRESHOLD);

describe('a two-letter fragment is not a name', () => {
    it('does not let "it" match inside "Bitter Frost Needle"', () => {
        expect(matchScore('it', 'Bitter Frost Needle')).toBeLessThan(MATCH_THRESHOLD);
    });

    it('still matches a fragment long enough to be distinctive', () => {
        // The branch is narrowed, not removed: partial names must keep working.
        expect(matchScore('frost needle', 'Bitter Frost Needle'))
            .toBeGreaterThanOrEqual(MATCH_THRESHOLD);
        expect(matchScore('qi-gathering', 'Lesser Qi-Gathering Manual'))
            .toBeGreaterThanOrEqual(MATCH_THRESHOLD);
    });

    it('is symmetric - a two-letter candidate inside a long query loses too', () => {
        expect(matchScore('I go to the market at dawn', 'Ma')).toBeLessThan(MATCH_THRESHOLD);
    });

    /**
     * Two guards, and this is why both are needed rather than one.
     *
     * The length guard in `matchScore` stops "it", and stops nothing longer.
     * "her" is three letters, clears it, and still finds a real art to sit
     * inside - so a pronoun of any length is refused before it is ever scored,
     * in `best`, which is the layer that decides what a sentence meant.
     */
    it('refuses every bare pronoun before it is scored at all', () => {
        for (const pronoun of ['it', 'them', 'they', 'him', 'her', 'he', 'she',
                               'that', 'this', 'those', 'these', 'one', 'its']) {
            expect(STANDS_IN_FOR_A_THING.test(pronoun), `"${pronoun}" was not caught`).toBe(true);
        }
    });

    it('shows why the length guard alone is not enough', () => {
        // Caught by the stop list, NOT by length: it would otherwise match.
        expect(wouldMatch('her')).toBe(true);
        expect(STANDS_IN_FOR_A_THING.test('her')).toBe(true);
    });

    it('does not swallow real names that merely start like a pronoun', () => {
        for (const name of ['one-thousand hands', 'that which returns', 'heron']) {
            expect(STANDS_IN_FOR_A_THING.test(name), `"${name}" was swallowed`).toBe(false);
        }
    });

    it('still resolves the technique when it is actually named', () => {
        expect(wouldMatch('Lesser Qi-Gathering Manual')).toBe(true);
        expect(wouldMatch('lesser qi-gathering manual')).toBe(true);
    });
});
