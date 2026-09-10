/**
 * "I give him 20 stones" paid a stranger.
 *
 * FOUND BY PLAYING, in the social sweep, and it moves money. Measured against
 * the real parser:
 *
 *     "I give Shen Liefeng 20 stones"  -> give, target "Shen Liefeng"
 *     "I give him 20 stones"           -> give, NO TARGET AT ALL
 *     "I give him the manual"          -> give, NO TARGET AT ALL
 *
 * `whatIsBeingHandedOver` dropped the recipient whenever it was a pronoun,
 * testing it against `ANYBODY` - a set that holds `someone`, `anybody`,
 * `people` AND `him`, `her`, `them`. Then `giveSomething` reads an absent
 * recipient as *whoever is at hand*, which in code is `here[0]`: the first row
 * of the crowd order. So the stones left the purse, arrived with somebody the
 * player had never addressed, and the screen reported the gift as made.
 *
 * THE SPLIT WAS ALREADY MADE ONE FILE OVER, FOR THIS EXACT REASON. `parseAsk`
 * tests the same set with `ASKING_GENERALLY`, which is `around|about` and
 * nothing else, under a header that states the rule outright: every other
 * member of that set is a POINTER, and `somebodyAtHand` resolves pointers - a
 * pronoun to whoever was last dealt with. It was written after the same defect
 * was measured on the ask verb: *"I ask him where the sect is" came back with a
 * topic and no person at all*.
 *
 * And `somebodyAtHand` itself refuses this fall-through by name, in the next
 * paragraph of the same file: *falling through to the crowd order below is what
 * put a marriage proposal to a stranger the player had never mentioned*. Same
 * defect, same cause, one verb along, with a purse behind it.
 *
 * The parser's job here ends at CARRYING the pointer. Resolving it is
 * `somebodyAtHand`'s, reached through `partyPutTo`, and where it resolves to
 * nobody `handOver` refuses and spends nothing.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent, whatIsBeingHandedOver } from '../../src/web/verb-pattern-table';

describe('the recipient survives being a pronoun', () => {
    /**
     * THE POINTERS. Every one of these came back with no recipient.
     */
    it.each([
        ['I give him 20 stones', 'him'],
        ['I give her 20 stones', 'her'],
        ['I give them 20 stones', 'them'],
        ['I give him the manual', 'him'],
        ['I hand her the jade', 'her']
    ])('%j keeps %j as the person it was handed to', (said, who) => {
        const parsed = parseIntent(said);
        expect(parsed?.action).toBe('give');
        expect(parsed?.target?.toLowerCase()).toBe(who);
    });

    /**
     * AND A NAME IS STILL A NAME, which is the half that always worked.
     */
    it('keeps a name', () => {
        const parsed = parseIntent('I give Shen Liefeng 20 stones');
        expect(parsed?.action).toBe('give');
        expect(parsed?.target).toBe('Shen Liefeng');
    });

    /**
     * ASKING GENERALLY STILL NAMES NOBODY, and that is the whole of what the
     * old test was for. "I give people stones" points at no one person, and
     * carrying `people` forward as a name would send `somebodyAtHand` looking
     * for somebody called that.
     */
    it.each(['around', 'about'])('%j is not a person', word => {
        const handed = whatIsBeingHandedOver(`I pass ${word} the flask`);
        expect(handed?.to).toBeUndefined();
    });
});
