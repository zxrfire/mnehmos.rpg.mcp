/**
 * Somebody holding an art that draws on another, with the subject at their
 * mercy, sometimes takes everything at once instead of keeping a furnace.
 *
 * The owner, on whether some kill rather than drain: of course - they do not
 * want to wait for you to cultivate, or the pairing does not match what the art
 * needs. So the odds of ending it rise with the realms the subject stands below
 * the holder, with a slow root, where the art does not answer between them, and
 * with a holder who goes at things head on. Each is a weight: the odds are
 * asserted as a band at the ends and never as zero or one.
 */

import { describe, expect, it } from 'vitest';

import { doTheyTakeItAll } from '../../../src/engine/social-leverage/furnace-kill-or-keep.js';

const even = {
    holderOrdinal: 14, subjectOrdinal: 13, subjectRootSpeed: 1, theArtAnswers: true, holderPush: 0
};

/** The chance, read back off the one exported decision by sweeping the sample. */
function chanceOf(input: typeof even): number {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (doTheyTakeItAll(input, mid)) lo = mid; else hi = mid;
    }
    return lo;
}

describe('keeping a furnace or taking it all', () => {
    it('keeps a subject at the holder own realm on an even root, most of the time', () => {
        const p = chanceOf(even);
        expect(p).toBeGreaterThan(0.05);
        expect(p).toBeLessThan(0.3);
    });

    it('ends it more often the longer the subject would take to be worth drawing', () => {
        expect(chanceOf({ ...even, subjectOrdinal: 4 })).toBeGreaterThan(chanceOf(even));
        expect(chanceOf({ ...even, subjectRootSpeed: 0.55 })).toBeGreaterThan(chanceOf(even));
    });

    it('ends it far more often where the art does not answer between them, and still not always', () => {
        const p = chanceOf({ ...even, theArtAnswers: false });
        expect(p).toBeGreaterThan(0.7);
        expect(p).toBeLessThan(1);
    });

    it('reads the holder temperament as a weight', () => {
        expect(chanceOf({ ...even, holderPush: 1 })).toBeGreaterThan(chanceOf({ ...even, holderPush: -1 }));
        expect(chanceOf({ ...even, holderPush: -1 })).toBeGreaterThan(0);
    });

    it('lands when an operator forces it, whatever the draw', () => {
        expect(doTheyTakeItAll(even, 0.999, true)).toBe(true);
        expect(doTheyTakeItAll(even, 0.999)).toBe(false);
    });
});
