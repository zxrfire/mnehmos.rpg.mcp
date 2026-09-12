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
 * ── WHAT CHANGED, AND WHY IT WAS RIGHT TO CHANGE ─────────────────────────
 *
 * This file used to assert that all three reached `unclear` from a standing
 * start, on the argument that *"a reader that supplied somebody at your mercy
 * would be deciding that a fight was happening"*. That argument is right and is
 * kept. What was wrong was the conclusion drawn from it: `unclear` is not the
 * engine saying there is nobody at your mercy. It is the engine saying it could
 * not read the sentence, which is false - and a later probe measured the same
 * three at 28 turns each, plus "I stand between them", all of them
 * `engine.parseIntent/unclear`, 112 turns of a blank look at four of the most
 * ordinary sentences in the genre.
 *
 * So the reader still supplies nobody. What it does now is route the sentence
 * to a handler that LOOKS, and the handler says which of the two answers it is:
 *
 *   somebody is beaten     `letThemGo` resolves it. That state is
 *   in front of you        `FLAG_YIELDING_TO_YOU`, written when a coercion ends
 *                          in a submission, and only the taking half of it was
 *                          reachable by any sentence.
 *   nobody is              it refuses, and names what is missing.
 *
 * Both halves are pinned in `sparing-somebody-needs-somebody-to-spare.test.ts`.
 * What this file keeps is the gate: the READER decides nothing about whether a
 * fight is happening, and the three phrasings are still not confused with the
 * three answers that share their words.
 *
 * One real hole came out of writing the first version: `show him mercy` matched
 * nothing, while `show mercy` and `show them mercy` both did. The pronoun
 * alternation carried the separating space on one branch only -
 * `(?:him|her|them )` - which is the commonest way a list of pronouns fails on
 * two thirds of itself.
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

    /**
     * The reader routes; it does not decide anybody is at the player's mercy.
     *
     * The intent is the whole of the distinction between this and a blow: the
     * verb is `attack` because that is where a fight's own answers plan to, and
     * a plan without the intent would swing at the person being spared.
     */
    it('routes to an act that looks, rather than to a blank look', () => {
        for (const said of ['I let him go', 'I spare her', 'I stay my hand']) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('attack');
            expect(plan.intent, said).toBe('let_them_go');
            // Nothing is aimed. Who a sparing lands on is whoever is beaten in
            // front of the player, and the reader does not get an opinion.
            expect(plan.target, said).toBeUndefined();
        }
    });

    /**
     * The words a sparing shares with acts that are not one, from the other
     * side: the table must not take any of these.
     */
    it('leaves alone the sentences that only look like it', () => {
        expect(parseIntent('I let him off what he owes').action).toBe('oath');
        expect(parseIntent('I let it go').action).not.toBe('attack');
        expect(parseIntent('I buy enough').action).not.toBe('attack');
    });
});
