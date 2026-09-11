/**
 * Four points and a round, for the parser failing to read you.
 *
 * FOUND BY PLAYING BLIND, three rounds into a fight the player might have won:
 *
 *     > what happened to him
 *     Wei Suilu lands a blow that drives four points into you. The impact is
 *     clean... You ask what happened to him, but the question finds no answer
 *     in the air.
 *
 * A blow, and then nothing. The tool calls on that turn were `combat.round`
 * followed by the reads, so the round was real: the sentence reached `unclear`,
 * and `unclear` was taking a guard round.
 *
 * ── TWO DEFECTS, AND THE SECOND IS THE PRINCIPLED ONE ────────────────────
 *
 * THE ROUTING. `how hurt is he` and `how is he doing` already reached `assess`,
 * which `takeTheRoundFirst` charges nothing for - its header says why, and the
 * measurement behind it is twelve points and a permanent meridian injury for
 * three questions. Four more ways of asking the same thing were not on that
 * list, and they are the ones a person reaches for while somebody is swinging
 * at them: `what happened to him`, `what shape is he in`, `how much has he got
 * left`, `who is winning`. The near-synonym trap, in the place where failing it
 * costs the most.
 *
 * AND `unclear` MUST NOT COST A ROUND AT ALL. This is the wider one and it is
 * the engine's own rule being broken: the `unclear` branch is documented as
 * *the cheapest action available, and the whole reason it is in the closed set:
 * no time, no food, no roll, no death. A player may type something ambiguous a
 * hundred times and lose nothing but a moment.* A guard round is all four of
 * those.
 *
 * And the reason it is different in kind from `status` and `assess`: those are
 * things a fighter does without looking away, and they ANSWER. A turn that
 * produced nothing must not also take something - charging for it charges the
 * player for the parser's failure to read them.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/verb-pattern-table';
import { FALLBACK_ACTION } from '../../src/web/actions';

describe('reading the person swinging at you', () => {
    it.each([
        'what happened to him',
        'what shape is he in',
        'what state is he in',
        'how much has he got left',
        'who is winning',
        'am i winning',
        'how hurt is he',
        'how is he doing',
        'is he nearly done'
    ])('%s is a read and not a guess', said => {
        expect(parseIntent(said).action).toBe('assess');
    });

    /**
     * AND THE OTHER HALF OF THE PAIR IS STILL THE SHEET. What is left of ME and
     * what is left of HIM are different reads, and the branch above this one
     * owns the first; both are free in a fight and neither may take the other's
     * sentences.
     */
    it.each(['how badly am i hurt', 'how hurt am i', 'am i badly hurt', 'what shape am i in'])(
        '%s reads the sheet', said => {
            expect(parseIntent(said).action).toBe('status');
        }
    );

    /**
     * AND A SENTENCE ABOUT SOMETHING ELSE IS NOT SWALLOWED. `what happened to
     * him` is narrow on purpose - the pronoun is required, so a question about
     * a thing or about the world at large is untouched.
     */
    it.each(['what happened to my manual', 'what happened'])('%s is not this read', said => {
        expect(parseIntent(said).action).not.toBe('assess');
    });
});

describe('a sentence the engine could not read', () => {
    /**
     * THE LIST THE FIGHT CHARGES NOTHING FOR, asserted here rather than in the
     * turn engine because what matters is WHICH verbs are on it. The engine
     * passes `status`, `assess` and the fallback; anything else pays a guard
     * round, which is the rule `a-fight-you-can-answer.test.ts` states - *the
     * blade arrives and THEN they do the thing they asked for. A fight is a
     * situation, not a mode.*
     */
    it('is the fallback action, which is what the fight now exempts', () => {
        expect(parseIntent('mrrp gronk the vestibule').action).toBe(FALLBACK_ACTION);
    });

    /**
     * AND A REAL ACT IS STILL AN ACT. Without this, the exemption could be
     * widened into "nothing costs a round", which is the opposite of the rule.
     */
    it.each([
        ['i go to the market', 'market'],
        ['i gather herbs', 'gather'],
        ['i cultivate for a year', 'cultivate']
    ])('%s is not the fallback', (said, verb) => {
        expect(parseIntent(said).action).toBe(verb);
        expect(parseIntent(said).action).not.toBe(FALLBACK_ACTION);
    });
});
