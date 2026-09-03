/**
 * A clause that says WHY is not a second thing to do.
 *
 * Found by playing, and the question it produced had nothing in it to answer:
 *
 *   > I need to eat, so I take whatever work will feed me for a season
 *
 *   A turn spends at most one costly action. This sentence read as 2:
 *   eat(), work(any). None of them ran and nothing was spent.
 *   Which comes first? "I need to eat" or "taking the work any"?
 *
 * The player is stating why they are doing the thing in the second half. There
 * is one act in that sentence, and asking them to choose between a need and the
 * act that answers it is the reader being the only party at the table that
 * cannot see the sentence.
 *
 * Two separate fixes, and this file pins both:
 *
 *   A STATED NEED IS NOT A COMMAND, where a real act follows it. `need`,
 *   `want`, `must`, `should` in front of a verb are somebody describing a
 *   state. On its OWN it genuinely is the act - a hungry player typing "I need
 *   to eat" must be fed - and that distinction is the whole of the care here.
 *
 *   AND `so` FIXES THE ORDER even where both halves are real. The existing
 *   purpose clauses run *act, then why*; this is *why, then act*, joined by a
 *   connective people use constantly when they are explaining themselves.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import {
    theSentenceSaysItsOwnOrder,
    thisClauseIsAReasonNotAnAct,
    whatThisTurnMayRun,
    type PlanStep
} from '../../src/web/a-sentence-can-be-more-than-one-call.js';

const step = (action: string, said: string, target?: string): PlanStep => ({
    action: { action: action as PlanStep['action']['action'], ...(target ? { target } : {}) },
    said
});

describe('a stated need, and the act it is the reason for', () => {
    it('runs the act and does not ask which comes first', () => {
        const budget = whatThisTurnMayRun(
            [
                step('eat', 'I need to eat'),
                step('work', 'so I take whatever work will feed me for a season', 'any')
            ],
            'I need to eat, so I take whatever work will feed me for a season'
        );

        expect(budget.askAbout).toHaveLength(0);
        expect(budget.toRun.map(one => one.action.action)).toEqual(['work']);
        // Nothing vanishes silently. The reason is named in the engine channel.
        expect(budget.statedReasons.map(one => one.action.action)).toEqual(['eat']);
    });

    /**
     * The direction that has to stay open: said on its own, the need IS the
     * request, and a hungry player typing exactly that gets fed.
     */
    it('feeds somebody who only says they need to eat', () => {
        const budget = whatThisTurnMayRun([step('eat', 'I need to eat')], 'I need to eat');
        expect(budget.toRun.map(one => one.action.action)).toEqual(['eat']);
        expect(budget.statedReasons).toHaveLength(0);
    });

    /**
     * Two needs and no act keeps both, for the same reason: discounting all of
     * them would leave a turn with nothing in it, and then the question would
     * be replaced by silence, which is worse.
     */
    it('keeps every need when nothing else in the sentence is an act', () => {
        const budget = whatThisTurnMayRun(
            [step('eat', 'I need to eat'), step('work', 'and I need work', 'any')],
            'I need to eat and I need work'
        );
        expect(budget.statedReasons).toHaveLength(0);
        // Both survive, so the turn asks which comes first - which is right,
        // because two needs with nothing between them are two things to do and
        // the choice is the player's.
        expect(budget.askAbout.map(one => one.action.action)).toEqual(['eat', 'work']);
    });

    it('tells a stated need from an act said plainly', () => {
        for (const said of ['I need to eat', 'I want to buy a manual', 'I must have food']) {
            expect(thisClauseIsAReasonNotAnAct(step('eat', said)), said).toBe(true);
        }
        for (const said of ['I eat', 'I take the work going', 'I sit down and breathe']) {
            expect(thisClauseIsAReasonNotAnAct(step('eat', said)), said).toBe(false);
        }
    });
});

describe('a reason joined to a consequence says which came first', () => {
    it('reads the connectives people actually use', () => {
        for (const said of [
            'I need to eat, so I take whatever work will feed me',
            'I have no manual, so I go to the market',
            'I am broke and so I take the work going',
            'I take the work because I need to eat',
            'since I have no stones I take the work'
        ]) {
            expect(theSentenceSaysItsOwnOrder(said), said).toBe(true);
        }
    });

    /**
     * A sentence with no order in it still gets the question, which is the
     * whole point of the question: *"I sit for a year and take work for a
     * season"* names two things with nothing between them.
     */
    it('still asks where the sentence genuinely gives no order', () => {
        expect(
            theSentenceSaysItsOwnOrder('I sit for a year and take work for a season')
        ).toBe(false);
    });
});

describe('played', () => {
    it('spends the season on the work and nothing on the reason', async () => {
        const provider = new ScriptedProvider({
            plans: [JSON.stringify({
                steps: [
                    { action: 'eat', said: 'I need to eat' },
                    {
                        action: 'work',
                        target: 'any',
                        said: 'so I take whatever work will feed me for a season'
                    }
                ]
            })],
            narrations: ['The moment passes.']
        });
        const { game } = await makeGameInWorld({
            worldSeed: 'backref-world',
            seed: 'reason-run',
            narrator: new ProviderNarrator(provider, { model: 'test-model', timeoutMs: 5000 })
        });
        await game.newRun('Probe');

        const turn = await game.act(
            'I need to eat, so I take whatever work will feed me for a season'
        );

        // The act ran. State, not prose: a season of work moved the clock.
        expect(turn.state.run.elapsedDays).toBeGreaterThan(0);
        expect(turn.toolCalls.some(call => call.action === 'work')).toBe(true);
        // And nothing was asked, because there was nothing to answer.
        expect(turn.toolCalls.some(call => call.name === 'engine.whichComesFirst')).toBe(false);
    }, 180000);
});
