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
    howTheStepWent,
    sayingWhatIsStillToCome,
    sayingWhatItCostTheRest,
    sayingWhereItStopped,
    spendsSomething,
    stepsInTheResponse,
    anyClauseReadsAsThisVerb,
    carryingTheReferentForward,
    everyVerbTheQuestionCouldName,
    theClausesNoStepAccountsFor,
    theRowForADroppedClause,
    theseWereThePlayersOwnWords,
    theSelectionInThisClause,
    theWholeSentenceAsAPlan,
    whatTheChoiceFoundNobody,
    whatTheChoiceLandedOn,
    theClausesOf,
    theThingThisStepNamed,
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
import type { ActionName, PlannedAction } from '../../src/web/actions.js';

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
    /**
     * Asserted as "not the enum member", which is the only version of this that
     * bites. The old form allowed a name equal to the verb itself, so `give`
     * shipped with no plain words and a live question offered the player
     * `"give Shen Liefeng" or "walking away"`.
     */
    it('has plain words for every verb that could ever cost the player', () => {
        for (const verb of everyVerbTheQuestionCouldName()) {
            const name = whatThisStepIsCalled(step(verb));
            expect(name, `${verb} has no plain name`).not.toContain('_');
            expect(name, `${verb} is named by its own enum member`).not.toBe(verb);
            expect(name, `${verb} is named by its own enum member`)
                .not.toBe(verb.replace(/_/g, ' '));
        }
    });

    it('prefers the player\'s own words over any of them', () => {
        expect(whatThisStepIsCalled(step('train_technique', { target: 'manual' }, 'work at the manual')))
            .toBe('work at the manual');
    });
});

/**
 * FOUND BY PLAYING, and it ate the owner's own acceptance sentence.
 *
 *   > I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away
 *
 * The model returned all three steps, read correctly. The danger check declined
 * the first and third - because the reader had sent no `said`, so each was
 * compared against a reading of the WHOLE sentence, which the table calls
 * `give` - and replaced both with that reading. The plan became
 * give -> give -> give, `oneClauseIsOneAct` collapsed it to one, and the theft
 * vanished from a turn where the model had escalated nothing.
 */
describe("a costly step survives when the player's own words reach it", () => {
    const SAID = "I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away";

    it('cuts the sentence where a person would cut it', () => {
        expect(theClausesOf(SAID)).toEqual([
            "I take Cao Antao's purse",
            "press it into Shen Liefeng's hand",
            'walk away'
        ]);
    });

    it('finds the verb in a clause even when no clause was quoted', async () => {
        const reads = async (clause: string) =>
            (clause.includes('take') ? 'interact' : 'give') as ActionName;
        expect(await anyClauseReadsAsThisVerb(SAID, 'interact', reads)).toBe(true);
        expect(await anyClauseReadsAsThisVerb(SAID, 'attack', reads)).toBe(false);
    });
});

describe('a pronoun means what the clause before it named', () => {
    const THE_TAKE = step('interact', { target: 'Cao Antao', intent: 'steal' },
        "I take Cao Antao's purse");
    const THE_GIVE = step('give', { target: 'Shen Liefeng', topic: 'it' },
        "press it into Shen Liefeng's hand");

    it('reads the object out of the clause without a noun catalog', () => {
        expect(theThingThisStepNamed(THE_TAKE)).toBe("Cao Antao's purse");
        expect(theThingThisStepNamed(step('buy', {}, 'buy the cheapest manual')))
            .toBe('cheapest manual');
    });

    it('fills a bare pronoun and nothing else', () => {
        const carried = carryingTheReferentForward(THE_GIVE, "Cao Antao's purse");
        expect(carried.action.topic).toBe("Cao Antao's purse");
        // The person they named is untouched.
        expect(carried.action.target).toBe('Shen Liefeng');
    });

    it('never overwrites a thing the player named', () => {
        const named = step('give', { target: 'Shen Liefeng', topic: 'the jade seal' });
        expect(carryingTheReferentForward(named, "Cao Antao's purse")).toBe(named);
    });

    it('carries nothing when the clause before it named nothing', () => {
        expect(carryingTheReferentForward(THE_GIVE, null)).toBe(THE_GIVE);
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
    /**
     * FOUND BY PLAYING, and reported by the coordinator verbatim. Typed:
     *
     *   > I rob Cao Antao and then run away to Ninewatch
     *
     *   Cao Antao: taken.
     *   Reprisal: injured. Weighed as serious robbery against Shen Kuo.
     *   Lift: 0 of 0 stones, capped at 72
     *
     * and the summary said the approach "did not come off". It came off. The
     * man was carrying nothing, and the wound was the price of finding out.
     * Told as a failure it teaches the player that robbery does not work for
     * them, which is false, instead of that this man had an empty purse, which
     * is true and is the thing worth knowing.
     */
    it('a landed step is LANDED, however many false rows it files beside itself', () => {
        // What a taken theft actually files: the resolver true, and rows beside
        // it that are not - the lift that moved nothing, the empty purse.
        const theft = call('executed', [['interact', true], ['interact', false]]);
        expect(howTheStepWent(theft, THEFT)).toBe('landed');
        expect(theWorldStoppedHere(theft, THEFT)).toBe(false);
    });

    it('and a step with nothing but false rows on its own verb did not come off', () => {
        expect(howTheStepWent(call('executed', [['interact', false]]), THEFT))
            .toBe('did_not_come_off');
    });

    it('says what a landed step COST rather than calling it a failure', () => {
        const said = sayingWhatItCostTheRest(THEFT, [WALK]);
        expect(said).toContain('came off');
        expect(said).not.toContain('did not come off');
        expect(said).toContain('walk away');
    });

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

/**
 * A clause the READER never turned into a step is the worst of the three
 * dropped-clause shapes, because nothing downstream can know it existed - the
 * executor cannot report a step it was not given. Measured: on one live turn
 * the model split the owner's sentence into two steps, left the middle clause
 * out, and the prose then wrote the missing act as though it had happened.
 */
describe('a clause the split lost is found from the player’s own text', () => {
    const SAID = "I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away";
    // The WHOLE reading, not the bare verb: `interact` alone is free and
    // `interact/steal` is not, and pricing a lost theft off the verb name made
    // it look like a free read that nobody needed to be told about.
    const reads = async (clause: string): Promise<PlannedAction> =>
        clause.includes('take') ? { action: 'interact', target: 'Cao Antao', intent: 'steal' }
            : clause.includes('press') ? { action: 'give', target: 'Shen Liefeng' }
                : { action: 'move', target: 'away' };

    it('names a costly clause no step accounts for', async () => {
        const plan = [step('interact', { target: 'Cao Antao', intent: 'steal' }), step('move')];
        const lost = await theClausesNoStepAccountsFor(SAID, plan, reads);
        expect(lost.map(s => s.action.action)).toEqual(['give']);
        expect(lost[0]!.said).toBe("press it into Shen Liefeng's hand");
    });

    it('finds nothing when every clause is accounted for', async () => {
        const plan = [step('interact'), step('give'), step('move')];
        expect(await theClausesNoStepAccountsFor(SAID, plan, reads)).toHaveLength(0);
    });

    /**
     * The measured house rule, reproduced here the moment it was left out:
     * "who is here, what am I carrying, and what do I know of them" ran
     * look/status/recall, and the middle clause also reads as `inventory` - so
     * a free read the model had routed to its neighbour was announced to the
     * player as a thing that had not happened. Nothing was taken from them.
     */
    it('says nothing about a FREE clause, because nothing was taken', async () => {
        const asked = 'who is here, what am I carrying, and what do I know of them';
        const freeReads = async (clause: string): Promise<PlannedAction> =>
            clause.includes('carrying') ? { action: 'inventory' }
                : clause.includes('know') ? { action: 'recall' } : { action: 'look' };
        const plan = [step('look'), step('status'), step('recall')];
        expect(await theClausesNoStepAccountsFor(asked, plan, freeReads)).toHaveLength(0);
    });
});

/**
 * THE SENTENCE IS THE AUTHORITY ON HOW MANY ACTS ARE IN IT.
 *
 * Played, repeatedly, against a live model:
 *
 *   > I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away
 *   read as 2: interact(Cao Antao), move(away)
 *
 * Three clauses in, two acts out, and the one lost is the middle one - which is
 * the clause the other two exist for. Take and walk away is a person leaving;
 * the handover is what makes it a frame-up. Everything downstream behaved
 * correctly on what it was handed, and it was handed a smaller sentence than
 * the player typed.
 */
describe('an act the reader missed is put back where the player wrote it', () => {
    const SAID = "I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away";
    const reads = async (clause: string): Promise<PlannedAction> =>
        clause.includes('take') ? { action: 'interact', target: 'Cao Antao', intent: 'steal' }
            : clause.includes('press') ? { action: 'give', target: 'Shen Liefeng', topic: 'it' }
                : { action: 'move', target: 'away' };

    it('puts the missing act back IN SENTENCE POSITION, not at the end', async () => {
        const fromTheReader = [
            step('interact', { target: 'Cao Antao', intent: 'steal' }),
            step('move', { target: 'away' })
        ];
        const whole = await theWholeSentenceAsAPlan(SAID, fromTheReader, reads);

        expect(whole.steps.map(s => s.action.action)).toEqual(['interact', 'give', 'move']);
        expect(whole.backfilled.map(s => s.action.action)).toEqual(['give']);
        // And the whole reading of the clause, not just its verb - or the give
        // would reach the engine with nobody to give to.
        expect(whole.backfilled[0]!.action.target).toBe('Shen Liefeng');
        expect(whole.backfilled[0]!.action.topic).toBe('it');
    });

    it('never reorders what the reader sent', async () => {
        const fromTheReader = [
            step('move', { target: 'away' }),
            step('interact', { target: 'Cao Antao', intent: 'steal' })
        ];
        const whole = await theWholeSentenceAsAPlan(SAID, fromTheReader, reads);
        const kept = whole.steps.filter(s => !whole.backfilled.includes(s));
        expect(kept.map(s => s.action.action)).toEqual(['move', 'interact']);
    });

    it('adds nothing when the reader already sent every act', async () => {
        const fromTheReader = [
            step('interact', { target: 'Cao Antao', intent: 'steal' }),
            step('give', { target: 'Shen Liefeng', topic: 'it' }),
            step('move', { target: 'away' })
        ];
        const whole = await theWholeSentenceAsAPlan(SAID, fromTheReader, reads);
        expect(whole.backfilled).toHaveLength(0);
        expect(whole.steps).toHaveLength(3);
    });

    /**
     * The house rule, and the one that keeps this from being noise: a free read
     * the model routed to its neighbour must not be re-run. Nothing was taken,
     * so there is nothing to put back.
     */
    it('puts back only a clause that would COST something', async () => {
        const asked = 'who is here, what am I carrying, and what do I know of them';
        const freeReads = async (clause: string): Promise<PlannedAction> =>
            clause.includes('carrying') ? { action: 'inventory' }
                : clause.includes('know') ? { action: 'recall' } : { action: 'look' };
        const whole = await theWholeSentenceAsAPlan(
            asked, [step('look'), step('status'), step('recall')], freeReads
        );
        expect(whole.backfilled).toHaveLength(0);
    });

    it('leaves a one-clause sentence entirely alone', async () => {
        const only = [step('cultivate', { days: 365 })];
        const whole = await theWholeSentenceAsAPlan('I cultivate for a year', only, reads);
        expect(whole.steps).toEqual(only);
        expect(whole.backfilled).toHaveLength(0);
    });

    it('cannot invent an act, because every backfill is a clause they typed', async () => {
        const whole = await theWholeSentenceAsAPlan(SAID, [], reads);
        for (const put of whole.backfilled) {
            expect(SAID.toLowerCase()).toContain(put.said!.toLowerCase());
        }
    });
});

/**
 * FOUND BY PLAYING, and it is a lie in the direction that costs most.
 *
 *   > I press Cao Antao's purse into Shen Liefeng's hand and walk away
 *
 * The model added a third step - a theft the sentence does not ask for and
 * which had happened a turn earlier. The danger check declined it, correctly,
 * and the turn then told the player *"the approach to Cao Antao" was not part
 * of what happened... Say it on its own and it will run.* There is no such part
 * of the sentence. It teaches them their words were misread, and invites them
 * to say a thing they never said.
 */
describe('only the player’s own clauses are reported to the player', () => {
    const SAID = "I press Cao Antao's purse into Shen Liefeng's hand and walk away";

    it('a clause they typed is theirs', () => {
        const quoted = step('give', { target: 'Shen Liefeng' },
            "press Cao Antao's purse into Shen Liefeng's hand");
        expect(theseWereThePlayersOwnWords(quoted, SAID)).toBe(true);
    });

    it('a step the reader added quotes nothing, and is not theirs', () => {
        const added = step('interact', { target: 'Cao Antao', intent: 'steal' });
        expect(theseWereThePlayersOwnWords(added, SAID)).toBe(false);
    });

    it('and its inspector row says so, rather than blaming the sentence', () => {
        const added = step('interact', { target: 'Cao Antao', intent: 'steal' });
        expect(theRowForADroppedClause(added, false).summary).toContain('the reader added');
        expect(theRowForADroppedClause(added, false).summary).not.toContain('Say it on its own');
    });
});

/**
 * PICKING ONE OUT OF WHAT THE LAST STEP FOUND. Played, at ordinal 40:
 *
 *   > I look over who is here, pick the strongest one, and tell them I want
 *   > their sect to answer for something
 *
 *   read as 2: gather(strongest one), interact(unnamed cultivator)
 *   Which comes first? "pick the strongest one" or "the approach to unnamed
 *   cultivator"?
 *
 * The middle clause is a selection from what the first returned. Nothing
 * carried the set, so the third clause's target came out as a placeholder - and
 * because the selection landed on a costly verb, a three-clause sentence became
 * a question about a choice that spends nothing.
 */
describe('a clause that chooses is a choice, not an act', () => {
    const SAID = 'I look over who is here, pick the strongest one, '
        + 'and tell them I want their sect to answer for something';

    it('recognises the superlative, and which field it names', () => {
        expect(theSelectionInThisClause('pick the strongest one'))
            .toEqual({ field: 'rung', want: 'most', word: 'strongest' });
        expect(theSelectionInThisClause('choose the youngest of them'))
            .toEqual({ field: 'age', want: 'least', word: 'youngest' });
        expect(theSelectionInThisClause('find the cheapest one'))
            .toEqual({ field: 'price', want: 'least', word: 'cheapest' });
    });

    it('is a CHOICE only in a choosing frame, never in an act', () => {
        // The guard against swallowing every sentence with a superlative in it.
        expect(theSelectionInThisClause('I attack the strongest one')).toBeNull();
        expect(theSelectionInThisClause('I buy the cheapest manual')).toBeNull();
        expect(theSelectionInThisClause('I walk to the nearest town')).toBeNull();
    });

    it('costs nothing, so it can never be one of two costly acts', () => {
        const choice: PlanStep = {
            action: { action: 'look' }, said: 'pick the strongest one',
            selects: { field: 'rung', want: 'most', word: 'strongest' }
        };
        expect(spendsSomething(choice)).toBe(false);
    });

    it('supersedes a reader step that priced the choice as an act', async () => {
        // `pick the strongest one` reached `gather`, the herb verb. Whatever
        // anybody read it as, the clause only chooses.
        const reads = async (clause: string): Promise<PlannedAction> =>
            clause.includes('look over') ? { action: 'look' }
                : clause.includes('pick') ? { action: 'gather', target: 'strongest one' }
                    : { action: 'interact', target: 'unnamed cultivator', intent: 'threaten' };

        const whole = await theWholeSentenceAsAPlan(SAID, [
            { action: { action: 'gather', target: 'strongest one' } },
            { action: { action: 'interact', target: 'unnamed cultivator', intent: 'threaten' } }
        ], reads);

        expect(whole.steps.some(s => s.action.action === 'gather')).toBe(false);
        const choice = whole.steps.find(s => s.selects);
        expect(choice).toBeDefined();
        expect(choice!.selects!.field).toBe('rung');
        // And it is not counted among the acts that spend.
        expect(whole.steps.filter(spendsSomething).map(s => s.action.action)).toEqual(['interact']);
    });

    it('a reader placeholder for the chosen person resolves like a pronoun', () => {
        const later: PlanStep = {
            action: { action: 'interact', target: 'unnamed cultivator', intent: 'threaten' }
        };
        expect(carryingTheReferentForward(later, 'Gu Anzhi').action.target).toBe('Gu Anzhi');

        const bySuperlative: PlanStep = {
            action: { action: 'interact', target: 'the strongest one', intent: 'threaten' }
        };
        expect(carryingTheReferentForward(bySuperlative, 'Gu Anzhi').action.target).toBe('Gu Anzhi');
    });

    it('says who was picked and on what, so a player can correct it', () => {
        const selection = { field: 'rung' as const, want: 'most' as const, word: 'strongest' };
        const said = whatTheChoiceLandedOn(selection, 'Gu Anzhi', 'Core Formation');
        expect(said).toContain('Gu Anzhi');
        expect(said).toContain('strongest');
        expect(said).toContain('Core Formation');
        expect(said).toContain('say the name yourself if you meant somebody else');
    });

    it('refuses a field it holds no rows for, and names what would carry it', () => {
        const said = whatTheChoiceFoundNobody({ field: 'price', want: 'least', word: 'cheapest' });
        expect(said).toContain('price board');
        expect(said).not.toMatch(/^No\.?$/);
    });
});

/**
 * A FREE CLAUSE IS PUT BACK ONLY WHERE THE READER PLAINLY UNDER-SPLIT.
 *
 * Played: "I look over who is here, pick the strongest one of them, and ask
 * them about their sect" came back with ONE step, and the looking and the
 * asking - both free, both plainly asked for - simply did not happen. The
 * measured rule against re-running free reads is about a reader that answered
 * every clause and chose a different verb for one; it is a different thing when
 * the reader answered fewer acts than the sentence has clauses.
 */
describe('a free clause the reader lost is still the player’s', () => {
    const SAID = 'I look over who is here, pick the strongest one of them, '
        + 'and ask them about their sect';
    const reads = async (clause: string): Promise<PlannedAction> =>
        clause.includes('look over') ? { action: 'investigate', target: 'who is here' }
            : clause.includes('pick') ? { action: 'gather', target: 'strongest one' }
                : { action: 'interact', target: 'them', intent: 'talk' };

    it('puts back the free clauses when the reader answered fewer acts than clauses', async () => {
        const whole = await theWholeSentenceAsAPlan(SAID, [
            { action: { action: 'gather', target: 'strongest one' } }
        ], reads);
        expect(whole.steps.map(s => s.action.action)).toEqual(['investigate', 'look', 'interact']);
        expect(whole.steps.find(s => s.selects)).toBeDefined();
    });

    it('and leaves them alone when the reader answered every clause', async () => {
        // The measured false positive: look/status/recall over a sentence whose
        // middle clause also reads as `inventory`. Nothing was lost, so nothing
        // is re-run.
        const asked = 'who is here, what am I carrying, and what do I know of them';
        const freeReads = async (clause: string): Promise<PlannedAction> =>
            clause.includes('carrying') ? { action: 'inventory' }
                : clause.includes('know') ? { action: 'recall' } : { action: 'look' };
        const whole = await theWholeSentenceAsAPlan(
            asked, [step('look'), step('status'), step('recall')], freeReads
        );
        expect(whole.backfilled).toHaveLength(0);
    });
});

/**
 * Played: "ask them about their sect", after a clause that had chosen a person,
 * reached the engine as `interact()` with NO target - the table read the topic
 * and let the "them" go - so the approach landed on whoever happened to be
 * nearest rather than on the person the turn had just named.
 */
describe('a pronoun the table dropped is still a pronoun', () => {
    it('fills an absent target from the player’s own clause', () => {
        const asking: PlanStep = {
            action: { action: 'interact', topic: 'their sect', intent: 'talk' },
            said: 'ask them about their sect'
        };
        expect(carryingTheReferentForward(asking, 'Yu Lanyin').action.target).toBe('Yu Lanyin');
    });

    it('fills nothing where the clause names no pronoun', () => {
        const asking: PlanStep = {
            action: { action: 'interact', topic: 'their sect', intent: 'talk' },
            said: 'ask the gate warden about their sect'
        };
        expect(carryingTheReferentForward(asking, 'Yu Lanyin').action.target).toBeUndefined();
    });

    it('never overrides a target the player named', () => {
        const asking: PlanStep = {
            action: { action: 'interact', target: 'Cao Antao', intent: 'talk' },
            said: 'ask them about their sect'
        };
        expect(carryingTheReferentForward(asking, 'Yu Lanyin').action.target).toBe('Cao Antao');
    });
});
