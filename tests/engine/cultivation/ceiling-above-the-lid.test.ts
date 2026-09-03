/**
 * What the manual axis says to somebody who has nothing left above them.
 *
 * `techniqueCeiling` writes the sentence a player reads when the sitting is
 * returning nothing, and it had one answer for the whole ladder: *what is
 * missing is a book*. Above the Lid that is false. `progressRequiredForOrdinal`
 * is null at ordinal 45 and 46 - what is above is not denominated in qi and no
 * amount of it would do - so a manual carries a True Immortal nowhere, and the
 * advice was pointing them at a search that cannot pay.
 *
 * Found by playing, not by reading: a single status read at ordinal 46 printed
 * "There is nothing above this rung that qi buys, so there is no figure to
 * report" and "What is missing is not years and not discipline. It is a book"
 * four lines apart. Nothing lies or contradicts itself is a floor at every
 * tier, and that read broke it against itself.
 *
 * The multiplier does not move. Zero was always right; only the reason was
 * wrong, and this pins both halves so a later edit cannot restore the advice
 * while keeping the arithmetic or the other way round.
 */

import { describe, it, expect } from 'vitest';

import { techniqueCeiling, NO_MANUAL_CEILING } from '../../../src/engine/cultivation/cultivation';
import {
    FALSE_IMMORTAL_ORDINAL,
    MAX_ORDINAL,
    progressRequiredForOrdinal
} from '../../../src/engine/cultivation/realms';

/** The rungs the claim is about, read off the ladder rather than typed out. */
const ABOVE_THE_LID = [FALSE_IMMORTAL_ORDINAL, MAX_ORDINAL];

describe('the manual axis above the Lid', () => {
    it('the rungs this is about are exactly the ones qi does not buy', () => {
        // The predicate the fix keys on. If the ladder ever grows a rung above
        // the Lid that IS bought with qi, this fails first and loudly rather
        // than the sentence quietly becoming wrong again.
        for (const ordinal of ABOVE_THE_LID) {
            expect(progressRequiredForOrdinal(ordinal)).toBeNull();
        }
        expect(progressRequiredForOrdinal(FALSE_IMMORTAL_ORDINAL - 1)).not.toBeNull();
    });

    it('does not send somebody at the top of the ladder looking for a book', () => {
        for (const ordinal of ABOVE_THE_LID) {
            const read = techniqueCeiling(ordinal, NO_MANUAL_CEILING);

            expect(read.state).toBe('no_method');
            expect(read.multiplier).toBe(0);
            expect(read.line).not.toBeNull();
            // The advice that was wrong.
            expect(read.line).not.toMatch(/it is a book/i);
            expect(read.line).not.toMatch(/willing to teach them one/i);
            // And what is true instead, including the axis that is left.
            expect(read.line).toMatch(/no rung above this one that qi buys/i);
            expect(read.line).toMatch(/what they understand/i);
        }
    });

    it('does not send them looking for the next volume either', () => {
        // An exhausted manual above the Lid: same fact, other branch. A cap of
        // 45 is exhausted at 45 and at 46 both.
        for (const ordinal of ABOVE_THE_LID) {
            const read = techniqueCeiling(ordinal, FALSE_IMMORTAL_ORDINAL);

            expect(read.state).toBe('exhausted');
            expect(read.multiplier).toBe(0);
            expect(read.line).not.toMatch(/the next volume/i);
            expect(read.line).toMatch(/no rung above this one that qi buys/i);
        }
    });

    it('leaves the sentence below the Lid exactly as it was', () => {
        // The narrow half of the fix. Every rung that is still climbing keeps
        // the advice that is correct there, and the two branches keep saying
        // different things - "there is no book" and "the book has ended" are
        // different facts and printing one for the other is the defect this
        // function was written to fix in the first place.
        const noBook = techniqueCeiling(20, NO_MANUAL_CEILING);
        expect(noBook.state).toBe('no_method');
        expect(noBook.line).toMatch(/It is a book, or somebody willing to teach them one/);

        const ended = techniqueCeiling(20, 20);
        expect(ended.state).toBe('exhausted');
        expect(ended.line).toMatch(/What is missing is the next volume/);

        const carrying = techniqueCeiling(20, 21);
        expect(carrying.state).toBe('teaching');
        expect(carrying.multiplier).toBe(1);
        expect(carrying.line).toBeNull();
    });
});
