/**
 * "You did not say who", said to a sentence that said who.
 *
 * Measured over 744 played turns: `guard` refused 18 of 18, and every one of
 * them was `guard.whoIsHere` - the branch that fires when the sentence named
 * nobody. The three sentences in the corpus are:
 *
 *     I stand guard while she crosses
 *     I watch over his breakthrough
 *     I protect her while she attempts it
 *
 * All three point at somebody, and none of them uses a name. `whoIsBeingGuarded`
 * dropped every one: a bare "her" was mistaken for the possessive prefix it
 * strips, "his breakthrough" lost its owner along with the noun, and the clause
 * form named nobody at all. `attack` has answered the same gesture since it was
 * written - "I attack him while he is crossing" resolves through
 * `somebodyAtHand` - so one verb took a pointed finger and the other did not.
 *
 * The watch still refuses most of the time, and correctly: the arrangement is
 * the most complete trust in this world and a stranger does not extend it. What
 * changes is WHICH refusal arrives. `wouldStandGuard` says what the two of you
 * would have to be to each other; `readyToStrike` says they are not at a wall.
 * Both name something the player can act on. "You did not say who" names a
 * defect in the reader.
 */
import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

describe('a watch pointed at rather than named', () => {
    it('carries who was pointed at', () => {
        expect(parseIntent('I watch over his breakthrough').target).toBe('him');
        expect(parseIntent('I protect her while she attempts it').target).toBe('her');
        expect(parseIntent('I stand guard while she crosses').target).toBe('her');
        expect(parseIntent('I stand guard while he crosses').target).toBe('him');
    });

    it('still reads a name when the sentence gives one', () => {
        expect(parseIntent('I stand guard over Wen Shu').target).toBe('Wen Shu');
        // The count may be written out. `parseDuration` reads this as 100 days
        // and the who-rather-than-when strip did not, so the span stayed stuck
        // to the front of the name.
        expect(parseIntent('I stand guard over Wen Shu for a hundred days').target)
            .toBe('Wen Shu');
    });

    it('does not read a surname as a pronoun', () => {
        // `He`, `Shi`, `Wu` and `Hou` are surnames in this catalog. Read
        // case-insensitively, "while He Minxue crosses" is a finger pointed at
        // nobody, and the sentence stopped reaching `wouldStandGuard` at all.
        expect(parseIntent('I stand guard while He Minxue crosses, for a hundred days').target)
            .not.toBe('him');
    });

    it('is still the guard verb, not a swing', () => {
        for (const said of [
            'I watch over his breakthrough',
            'I protect her while she attempts it',
            'I stand guard while she crosses'
        ]) {
            expect(parseIntent(said).action, said).toBe('guard');
        }
    });
});
