/**
 * Spans written out in words, which is how people write long ones.
 *
 * Found by playing at the scale this game actually runs on. The old scan
 * walked the two tokens before the unit right to left and stopped at the
 * first that resolved, so a magnitude answered before the count in front of
 * it ever got a turn:
 *
 *     five hundred years  ->  100 years
 *     two hundred years   ->  100 years
 *     a thousand years    ->    1 year
 *
 * The last one is the worst of the three: `thousand` was in no table at all,
 * so the article behind it answered instead. A player asking for a millennium
 * of seclusion got a year and was told nothing — the sentence was understood,
 * the number was not, and the turn looked entirely ordinary.
 */
import { describe, expect, it } from 'vitest';
import { parseIntent, MAX_CULTIVATION_DAYS } from '../../src/web/actions';

const daysOf = (said: string): number | undefined =>
    (parseIntent(said) as { days?: number }).days;

describe('a span said in words', () => {
    it('lets the count in front of a magnitude answer', () => {
        // All three are above the cap, which is the point: before this they
        // came out at 100 years, 100 years and one year, three different
        // wrong answers to three sentences that all mean "longer than the
        // engine will run".
        expect(daysOf('I cultivate for five hundred years')).toBe(MAX_CULTIVATION_DAYS);
        expect(daysOf('I cultivate for two hundred years')).toBe(MAX_CULTIVATION_DAYS);
        expect(daysOf('I cultivate for a thousand years')).toBe(MAX_CULTIVATION_DAYS);
    });

    it('keeps every span that already worked', () => {
        expect(daysOf('I cultivate for ten years')).toBe(3650);
        expect(daysOf('I cultivate for a year')).toBe(365);
        expect(daysOf('I cultivate for three months')).toBe(90);
        expect(daysOf('I cultivate for 500 years')).toBe(MAX_CULTIVATION_DAYS);
    });

    it('stops an article answering for the word behind it', () => {
        // `a` is in the number table as 1, so it was ending the scan before
        // the `half` in front of it was reached.
        expect(daysOf('I cultivate for half a year')).toBe(183);
    });

    it('does not read a bare count as a span', () => {
        // The rule this file must not break: a number with no unit after it
        // is not a duration. "I strike the barrier 3 times" is one attempt.
        expect(parseIntent('I strike the barrier 3 times').action).toBe('breakthrough');
    });
});
