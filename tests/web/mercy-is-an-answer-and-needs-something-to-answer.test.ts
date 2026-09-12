/**
 * Staying your hand exists, and it exists only where it can mean anything.
 *
 * Measured over 744 played turns, "I let him go", "I spare her" and "I stay my
 * hand" each reached `unclear` 6 times out of 6 - 18 refusals - and that read
 * as a missing mechanic. It is not one. `FightAnswer` has carried a `spare`
 * member since the multi-turn fight was written, `combat-verbs.ts` opens a
 * `spared` favour for it, and `THE_ANSWER_IS_TO_SPARE` reads all three
 * phrasings. What the probe measured is that none of the three was said INSIDE
 * a fight, because `whatTheySaidInTheFight` is consulted only while one stands.
 *
 * That gate is the design and this pins both halves of it:
 *
 *   IN A FIGHT   all three are `spare`, and it is not confused with the three
 *                answers that share its words - pressing takes "let him hit
 *                me", breaking off takes "let me go", yielding is the same act
 *                from the other end.
 *   OUT OF ONE   nothing is invented. There is nobody at your mercy in an empty
 *                square, and a reader that supplied one would be deciding that
 *                a fight was happening.
 *
 * So the 18 refusals stay refusals, and the header is here so the next person
 * reading that line of the probe does not build a mercy verb over the top of a
 * working one.
 *
 * One real hole came out of writing it: `show him mercy` matched nothing, while
 * `show mercy` and `show them mercy` both did. The pronoun alternation carried
 * the separating space on one branch only - `(?:him|her|them )` - which is the
 * commonest way a list of pronouns fails on two thirds of itself.
 */
import { describe, expect, it } from 'vitest';

import { whatTheySaidInTheFight } from '../../src/web/fight-answers';
import { parseIntent } from '../../src/web/verb-pattern-table';

describe('staying your hand', () => {
    it('is read as sparing while a fight stands', () => {
        for (const said of ['I let him go', 'I spare her', 'I stay my hand', 'I show him mercy']) {
            expect(whatTheySaidInTheFight(said)?.kind, said).toBe('spare');
        }
    });

    it('is not any of the three answers it shares words with', () => {
        expect(whatTheySaidInTheFight('I let him hit me')?.kind).toBe('press');
        expect(whatTheySaidInTheFight('I back off')?.kind).toBe('break_off');
        expect(whatTheySaidInTheFight('I yield')?.kind).toBe('yield');
    });

    it('is not reachable from a standing start, because there is nobody to spare', () => {
        // The caller's own gate: `whatTheySaidInTheFight` is asked only while a
        // fight stands. Asserted as the absence it is - the phrasings are not
        // in the verb table either, and adding them there would mean the reader
        // deciding somebody was at the player's mercy.
        for (const said of ['I let him go', 'I spare her', 'I stay my hand']) {
            expect(parseIntent(said).action, said).toBe('unclear');
        }
    });
});
