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
 * of seclusion got a year and was told nothing - the sentence was understood,
 * the number was not, and the turn looked entirely ordinary.
 */
import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions';

const daysOf = (said: string): number | undefined =>
    (parseIntent(said) as { days?: number }).days;

describe('a span said in words', () => {
    it('lets the count in front of a magnitude answer', () => {
        // These read 100 years, 100 years and one year: three different wrong
        // answers to three sentences that differ by a factor of five.
        //
        // They used to be asserted against MAX_CULTIVATION_DAYS, because the
        // parser then clamped every one of them to a flat century and the
        // three sentences really did mean the same thing by the time anything
        // downstream saw them. The clamp is gone - what bounds a span is the
        // life asking for it, applied where the cultivator is and said out
        // loud - so the counts are now the whole of what is asserted.
        expect(daysOf('I cultivate for five hundred years')).toBe(500 * 365);
        expect(daysOf('I cultivate for two hundred years')).toBe(200 * 365);
        expect(daysOf('I cultivate for a thousand years')).toBe(1000 * 365);
    });

    it('keeps every span that already worked', () => {
        expect(daysOf('I cultivate for ten years')).toBe(3650);
        expect(daysOf('I cultivate for a year')).toBe(365);
        expect(daysOf('I cultivate for three months')).toBe(90);
        expect(daysOf('I cultivate for 500 years')).toBe(500 * 365);
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
