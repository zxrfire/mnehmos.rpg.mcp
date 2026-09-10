/**
 * Settling a debt is not sitting down, and it cost years.
 *
 * FOUND BY PLAYING, in the social sweep. Measured against the real parser:
 *
 *     "I settle my debt"      -> cultivate
 *     "I settle up"           -> cultivate
 *     "I settle my account"   -> cultivate
 *
 * `settle` is a sitting word - *settle down*, *settle in* - and the cultivate
 * branch admits it. So a sentence about paying somebody back sat the player
 * down and spent a span of YEARS: the most expensive thing the verb table can
 * do to anybody, for one of the commonest sentences in the genre. Nothing on
 * the screen would have told them why, because from the engine's side it was
 * an ordinary sitting.
 *
 * The guard for this already existed and already knew why it had to. Its own
 * header says `settle` is one of the two weak members of the cultivation list
 * BECAUSE it carries idioms, and it held two of them - `settled with his
 * hands`, `sits tight`. This was the third, and it was the one with a price on
 * it.
 *
 * THE POSITIVE HALF IS THE POINT OF THE TEST. A guard against an idiom is one
 * regex away from eating the verb it guards, and `settle down to cultivate` is
 * what the cultivate branch is FOR. Both halves are pinned here, because a fix
 * that stops the years being spent wrongly and also stops them being spent
 * rightly is not a fix.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';

describe('settling an account is not a sitting', () => {
    /**
     * THE THREE THAT SPENT YEARS. Every one of these reached `cultivate`.
     */
    it.each([
        'I settle my debt',
        'I settle my debts',
        'I settle the debt',
        'I settle my account',
        'I settle up',
        'I settle up with him',
        'I am settling my debt',
        'I settled my account'
    ])('%j does not sit the player down', said => {
        expect(parseIntent(said)?.action).not.toBe('cultivate');
    });

    /**
     * AND THE SITTING STILL SITS. `settle` reaching the cultivate branch is
     * correct for every one of these, and the guard above must not touch them.
     */
    it.each([
        'I settle down to cultivate',
        'I settle in for a long sitting',
        'I settle down and begin to cultivate',
        'I settle into meditation'
    ])('%j is still a sitting', said => {
        expect(parseIntent(said)?.action).toBe('cultivate');
    });
});
