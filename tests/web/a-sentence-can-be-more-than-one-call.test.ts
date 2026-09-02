/**
 * The law that lets one sentence make several engine calls.
 *
 * Read as a law rather than as a behaviour: every case here is a claim about
 * what a turn may spend and in what order, and none of them needs a database.
 * The played half - that a plan actually reaches the engine, in order, and that
 * two costly acts produce a question - is in
 * `tests/web/a-sentence-that-contains-a-plan.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
    MOST_CALLS_IN_ONE_TURN,
    foldTheCallsIntoOneTurn,
    sayingWhatIsStillToCome,
    sayingWhereItStopped,
    spendsSomething,
    stepsInTheResponse,
    everyVerbTheQuestionCouldName,
    stepsOfThePlan,
    theClauseThisStepQuotes,
    theQuestionStillStands,
    theWorldStoppedHere,
    whatThisStepIsCalled,
    whatTheQuestionAsks,
    whatThisTurnMayRun,
    whichOneTheyChose,
    type OneCall,
    type PlanStep,
    type WhichComesFirst
} from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import type { ActionName } from '../../src/web/actions.js';

function step(action: ActionName, extra: Partial<PlanStep['action']> = {}, said?: string): PlanStep {
    return { action: { action, ...extra }, ...(said ? { said } : {}) };
}

const THEFT = step('interact', { target: 'Cao Antao', intent: 'steal' }, "take Cao Antao's purse");
const HANDOFF = step('interact', { target: 'Shen Liefeng', intent: 'give' }, 'press it into his hand');
const WALK = step('move', { target: 'the far gate' }, 'walk away');
const LOOK = step('look');

describe('which steps cost the player something', () => {
    it('reads the cost off the plan and not off the verb', () => {
        // `interact` is the whole reason this is a function rather than a list.
        expect(spendsSomething(step('interact', { intent: 'talk' }))).toBe(false);
        expect(spendsSomething(step('interact', { intent: 'steal' }))).toBe(true);
        expect(spendsSomething(step('look'))).toBe(false);
        expect(spendsSomething(step('cultivate'))).toBe(true);
    });
});

describe('the budget', () => {
    it('lets free reads chain, as many as the sentence needs', () => {
        const budget = whatThisTurnMayRun([LOOK, step('recall'), step('status'), step('inventory')]);
        expect(budget.toRun).toHaveLength(4);
        expect(budget.askAbout).toHaveLength(0);
    });

    it('runs one costly act with free reads around it', () => {
        const budget = whatThisTurnMayRun([LOOK, THEFT, step('status')]);
        expect(budget.toRun.map(s => s.action.action)).toEqual(['look', 'interact', 'status']);
        expect(budget.askAbout).toHaveLength(0);
    });

    it('KEEPS THE PLAYER\'S ORDER - a free step after a costly one is not sorted forward', () => {
        // The heart of the framing example. Sort the free step to the front and
        // the purse is handed over before it is taken, which is not a smaller
        // version of the sentence - it is nonsense, and it is nonsense the
        // engine would have executed.
        const budget = whatThisTurnMayRun([THEFT, HANDOFF]);
        expect(budget.toRun.map(s => s.said)).toEqual([
            "take Cao Antao's purse", 'press it into his hand'
        ]);
        expect(spendsSomething(budget.toRun[0]!)).toBe(true);
        expect(spendsSomething(budget.toRun[1]!)).toBe(false);
    });

    /**
     * A FINDING, PINNED SO IT CANNOT BE LOST.
     *
     * The design owner's own sentence - "I take his purse, hand it to the man
     * beside him, and walk away" - contains TWO costly acts by this engine's
     * pricing, not one. `move` is in `TIME_CONSUMING_ACTIONS` and spends a day,
     * whether the sentence means a journey to the next province or three paces
     * back from an exchange, and there is no verb in the set for the latter.
     *
     * So the law asks which comes first, which is what the law is for and is
     * the correct behaviour of the code as written. Whether "walk away" SHOULD
     * cost a day is a design question about `move`, not about this file, and it
     * is reported rather than quietly worked around: making the departure free
     * here would be a second pricing of a verb, reachable by choosing your
     * words, which is the softening AGENTS.md forbids by name.
     */
    it('and the framing sentence costs two acts, because a departure is a day', () => {
        const budget = whatThisTurnMayRun([THEFT, HANDOFF, WALK]);
        expect(budget.toRun.map(s => s.action.action)).toEqual([]);
        expect(budget.askAbout.map(s => s.action.action)).toEqual(['interact', 'move']);
    });

    it('stops at the FIRST costly act when there are two, and runs nothing costly', () => {
        const budget = whatThisTurnMayRun([LOOK, THEFT, step('cultivate', { days: 3650 })]);
        expect(budget.toRun.map(s => s.action.action)).toEqual(['look']);
        expect(budget.askAbout.map(s => s.action.action)).toEqual(['interact', 'cultivate']);
        expect(budget.heldForTheQuestion.map(s => s.action.action)).toEqual(['interact', 'cultivate']);
    });

    it('the free reads before the question still run, so the question can name them', () => {
        const budget = whatThisTurnMayRun([step('investigate', { target: 'Gu Peiyan' }), THEFT, WALK]);
        expect(budget.toRun.map(s => s.action.action)).toEqual(['investigate']);
    });

    it('names what it cut off rather than dropping it', () => {
        const many = Array.from({ length: MOST_CALLS_IN_ONE_TURN + 2 }, () => LOOK);
        const budget = whatThisTurnMayRun(many);
        expect(budget.toRun).toHaveLength(MOST_CALLS_IN_ONE_TURN);
        expect(budget.overTheBound).toHaveLength(2);
    });
});

/**
 * FOUND BY PLAYING, on a live run. Typed:
 *
 *   > I settle in and work at the manual until I have enough to break through
 *
 * "work at the manual" matched both the `work` pattern and the
 * `train_technique` pattern, and the turn asked the player to choose between
 * two readings of ONE clause. A player cannot answer that. Worse, handed two
 * verb names for one object the model invented a second manual to make the
 * question sensible: "the work manual" and "the technique manual".
 */
describe('one clause is one act, however many patterns claim it', () => {
    it('does not ask about two readings of the same object', () => {
        const budget = whatThisTurnMayRun([
            step('work', { target: 'manual' }),
            step('train_technique', { target: 'manual' })
        ]);
        expect(budget.askAbout).toHaveLength(0);
        expect(budget.toRun.map(s => s.action.action)).toEqual(['work']);
    });

    it('shows the reading it did not take rather than swallowing it', () => {
        const budget = whatThisTurnMayRun([
            step('work', { target: 'manual' }),
            step('train_technique', { target: 'manual' })
        ]);
        expect(budget.secondReadings).toHaveLength(1);
        expect(budget.secondReadings[0]!.taken.action.action).toBe('work');
        expect(budget.secondReadings[0]!.alsoRead.action.action).toBe('train_technique');
    });

    it('and two acts on the same target ARE two acts when the clauses differ', () => {
        const budget = whatThisTurnMayRun([
            step('attack', { target: 'him' }, 'I hit him'),
            step('interact', { target: 'him', intent: 'steal' }, 'then take his purse')
        ]);
        expect(budget.askAbout).toHaveLength(2);
        expect(budget.secondReadings).toHaveLength(0);
    });

    it('two readings of one clause quoted the same way are one act', () => {
        const budget = whatThisTurnMayRun([
            step('work', {}, 'work at the manual'),
            step('train_technique', {}, 'work at the manual until I can break through')
        ]);
        expect(budget.askAbout).toHaveLength(0);
    });
});

/**
 * FOUND BY PLAYING. Typed:
 *
 *   > I go to Ninewatch and then sit down and cultivate for a year
 *
 * The turn asked which came first. The player had written "and then". Asking
 * somebody to repeat themselves is not handing them a choice, and the question
 * earns its place only where the order is genuinely open.
 */
describe('where the sentence gives its own order, the turn takes it', () => {
    const JOURNEY = step('move', { target: 'Ninewatch' }, 'go to Ninewatch');
    const SITTING = step('cultivate', { days: 365 }, 'sit down and cultivate for a year');

    it('runs the first act and asks nothing', () => {
        const budget = whatThisTurnMayRun(
            [JOURNEY, SITTING], 'I go to Ninewatch and then sit down and cultivate for a year'
        );
        expect(budget.askAbout).toHaveLength(0);
        expect(budget.theOrderWasGiven).toBe(true);
        expect(budget.toRun.map(s => s.action.action)).toEqual(['move']);
        expect(budget.heldForTheQuestion.map(s => s.action.action)).toEqual(['cultivate']);
    });

    it('still asks where the sentence gives no order', () => {
        const budget = whatThisTurnMayRun(
            [JOURNEY, SITTING], 'I go to Ninewatch and sit down and cultivate for a year'
        );
        expect(budget.theOrderWasGiven).toBe(false);
        expect(budget.askAbout).toHaveLength(2);
        expect(budget.toRun).toHaveLength(0);
    });

    it('reads as what is still ahead, never as a report about the executor', () => {
        const said = sayingWhatIsStillToCome([SITTING]);
        expect(said).toContain('Sit down and cultivate for a year');
        expect(said).toContain('still ahead of you');
        expect(said).not.toMatch(/step \d|not executed|declined|refus/i);
    });
});

describe('the question never requires a player to know a string', () => {
    it('has plain words for every verb that could ever cost the player', () => {
        for (const verb of everyVerbTheQuestionCouldName()) {
            const name = whatThisStepIsCalled(step(verb));
            expect(name, `${verb} has no plain name`).not.toContain('_');
            expect(name.length, `${verb} has no plain name`).toBeGreaterThan(verb.length - 2);
        }
    });

    it('prefers the player\'s own words over any of them', () => {
        expect(whatThisStepIsCalled(step('train_technique', { target: 'manual' }, 'work at the manual')))
            .toBe('work at the manual');
    });
});

describe('the same words, for a plan, means the clause', () => {
    const said = 'I look over the stalls, ask who is selling, and take the work going';

    it('gives back the clause when the player really typed it', () => {
        expect(theClauseThisStepQuotes(step('work', {}, 'take the work going'), said))
            .toBe('take the work going');
    });

    it('refuses a clause the player never typed, so it cannot license an escalation', () => {
        expect(theClauseThisStepQuotes(step('attack', {}, 'I draw my blade and kill him'), said))
            .toBeNull();
    });

    it('refuses a one-word clause, which would match almost anything', () => {
        expect(theClauseThisStepQuotes(step('work', {}, 'work'), said)).toBeNull();
    });
});

describe('a plan with no steps is the old single call, untouched', () => {
    it('yields exactly one step whose action is the plan\'s own', () => {
        const only = stepsOfThePlan({ action: { action: 'cultivate', days: 30 }, source: 'fallback' });
        expect(only).toHaveLength(1);
        expect(only[0]!.action).toEqual({ action: 'cultivate', days: 30 });
    });

    it('and an empty steps array is treated the same way', () => {
        const only = stepsOfThePlan({ action: { action: 'look' }, source: 'model', steps: [] });
        expect(only).toEqual([{ action: { action: 'look' } }]);
    });
});

describe('reading a sequence out of a model response', () => {
    it('validates every step through the same closed gate a single plan uses', () => {
        const steps = stepsInTheResponse({
            steps: [
                { action: 'look' },
                // An invented action name, and an invented state field beside a
                // real one. Neither may survive.
                { action: 'ascend' },
                { action: 'cultivate', days: 30, realmOrdinal: 44, spiritStones: 9999 }
            ]
        }, 'I look around then cultivate for a month');

        expect(steps!.map(s => s.action.action)).toEqual(['look', 'cultivate']);
        expect(steps![1]!.action).not.toHaveProperty('realmOrdinal');
        expect(steps![1]!.action).not.toHaveProperty('spiritStones');
    });

    it('returns null when the response is an ordinary single plan', () => {
        expect(stepsInTheResponse({ action: 'look' }, 'I look around')).toBeNull();
    });

    it('carries what only the sentence knows onto each step', () => {
        // `leverage` is set by the parser and is not in the phase-1 schema, so a
        // model can never emit it. Without the carry a threat inside a plan
        // would reach the social resolver priced as a bare ask.
        const steps = stepsInTheResponse(
            { steps: [{ action: 'interact', target: 'the steward', intent: 'threaten' }] },
            'I threaten the steward into handing over the ledger'
        );
        expect(steps![0]!.action.leverage).toBe('force');
    });
});

describe('two costly acts raise a question rather than a truncation', () => {
    const fork: WhichComesFirst = {
        runId: 'r', cultivatorId: 'c', raisedOnTurn: 4, acts: [THEFT, WALK]
    };

    it('asks in the player\'s own words, and does not read as a refusal', () => {
        const asked = whatTheQuestionAsks(fork);
        expect(asked).toContain("take Cao Antao's purse");
        expect(asked).toContain('walk away');
        expect(asked).toContain('Which comes first?');
        // Nothing failed here. The sentence was understood in full.
        expect(asked).not.toMatch(/cannot|could not|unable|failed|refus/i);
    });

    it('takes an ordinal for an answer', () => {
        expect(whichOneTheyChose('the second one', fork)).toBe(WALK);
        expect(whichOneTheyChose('first', fork)).toBe(THEFT);
    });

    it('takes a distinctive word for an answer', () => {
        expect(whichOneTheyChose('the purse', fork)).toBe(THEFT);
        expect(whichOneTheyChose('walk', fork)).toBe(WALK);
    });

    it('CHOOSES NOTHING when the answer fits both, because that is not a choice', () => {
        const two: WhichComesFirst = {
            ...fork,
            acts: [step('cultivate', {}, 'sit for a year'), step('cultivate', {}, 'sit for a decade')]
        };
        expect(whichOneTheyChose('cultivate', two)).toBeNull();
    });

    it('IS NOT A MODAL JAIL - any other sentence is an ordinary turn', () => {
        expect(whichOneTheyChose('I go and look for work in the next county instead', fork)).toBeNull();
        expect(whichOneTheyChose('what can I do', fork)).toBeNull();
        expect(whichOneTheyChose('', fork)).toBeNull();
    });

    it('lapses with the run and the cultivator it was raised against', () => {
        expect(theQuestionStillStands(fork, 'r', 'c')).toBe(true);
        expect(theQuestionStillStands(fork, 'other-run', 'c')).toBe(false);
        expect(theQuestionStillStands(fork, 'r', 'somebody-else')).toBe(false);
        expect(theQuestionStillStands(null, 'r', 'c')).toBe(false);
    });

    it('falls back to the verb\'s own name when the reader gave no words', () => {
        expect(whatThisStepIsCalled(step('cultivate'))).toBe('sitting down to cultivate');
        expect(whatThisStepIsCalled(step('move', { target: 'Scarwater' })))
            .toBe('the journey to Scarwater');
    });
});

describe('a plan that stops halfway is an outcome, not an error', () => {
    function call(outcome: 'executed' | 'refused', rows: Array<[string, boolean]>): OneCall {
        return {
            facts: { headline: 'h', lines: ['l'], structure: ['s'], prose: 'p' },
            events: [], timeSkip: null, breakthrough: null, outcome,
            calls: rows.map(([action, ok]) => ({ name: 'engine.x', action, summary: 'x', ok }))
        };
    }

    it('stops when the engine refused the step', () => {
        expect(theWorldStoppedHere(call('refused', [['interact', false]]), THEFT)).toBe(true);
    });

    it('stops when the step resolved and did not come off', () => {
        expect(theWorldStoppedHere(call('executed', [['interact', false]]), THEFT)).toBe(true);
    });

    it('does NOT stop on a false row belonging to some other verb the step touched', () => {
        expect(theWorldStoppedHere(call('executed', [['interact', true], ['look', false]]), THEFT))
            .toBe(false);
    });

    /**
     * FOUND BY PLAYING, against a live model on the coordinator's own run.
     *
     *   > I look over the stalls, ask who is selling a manual, and buy the
     *   > cheapest one they have
     *
     * The middle step - a free `interact` whose target was "merchants" - matched
     * nobody, stopped the plan, and threw away the buy the whole sentence was
     * for. A free read that outranks a costly act is the exact thing AGENTS.md
     * forbids: the one act a turn spends must be the one they asked for.
     */
    it('a FREE read that found nothing does not stop the plan', () => {
        const nobody = step('interact', { target: 'merchants', intent: 'talk' }, 'ask who is selling');
        expect(theWorldStoppedHere(call('refused', [['interact', false]]), nobody)).toBe(false);
        expect(theWorldStoppedHere(call('refused', [['look', false]]), LOOK)).toBe(false);
    });

    it('names the FIRST failure, not the second consequence of it', () => {
        const said = sayingWhereItStopped(THEFT, [HANDOFF, WALK]);
        expect(said).toContain(`"take Cao Antao's purse" did not come off`);
        // A parser talking about itself is what this must not be.
        expect(said).not.toMatch(/step \d|not executed|index/i);
    });
});

describe('folding several calls into one turn', () => {
    function call(prose: string, line: string, required?: string): OneCall {
        return {
            facts: {
                headline: prose, lines: [line], structure: [`structure: ${line}`], prose,
                ...(required ? { required: [required] } : {})
            },
            events: [], timeSkip: null, breakthrough: null, outcome: 'executed',
            calls: [{ name: 'engine.x', action: 'look', summary: line, ok: true }]
        };
    }

    it('keeps every word the engine said, on every channel', () => {
        const folded = foldTheCallsIntoOneTurn([
            call('first', 'the purse is in your hand'),
            call('second', 'he is holding it now', 'He is holding it now.')
        ]);
        expect(folded.facts.lines).toEqual(['the purse is in your hand', 'he is holding it now']);
        expect(folded.facts.prose).toBe('first\n\nsecond');
        expect(folded.facts.structure).toHaveLength(2);
        expect(folded.facts.required).toEqual(['He is holding it now.']);
    });

    it('keeps every call, in the order it ran', () => {
        const folded = foldTheCallsIntoOneTurn([call('a', 'a'), call('b', 'b'), call('c', 'c')]);
        expect(folded.calls.map(row => row.summary)).toEqual(['a', 'b', 'c']);
    });

    it('a refused read beside a landed act is not a refused turn', () => {
        const refusedRead = { ...call('no', 'no'), outcome: 'refused' as const };
        expect(foldTheCallsIntoOneTurn([refusedRead, call('yes', 'yes')]).outcome).toBe('executed');
    });

    it('a single call is returned as itself, byte for byte', () => {
        const one = call('only', 'only');
        expect(foldTheCallsIntoOneTurn([one])).toBe(one);
    });
});
