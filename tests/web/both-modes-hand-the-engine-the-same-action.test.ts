/**
 * The two ways a sentence becomes an action must produce the same action.
 *
 * With no provider, `parseIntent` reads the sentence. With one, a model
 * answers phase 1 and `validatePlan` checks the answer. If those two can hand
 * `game.ts` different objects for the same sentence, a configured provider and
 * an unconfigured one are two different games - which is the one defect in
 * this area worth more than any amount of parser coverage.
 *
 * They could, and did. `leverage` and `rations` are not in the phase-1 schema
 * the model is shown, and `validatePlan` dropped both. The `rations` case was
 * the worse of the two: `provision` is a timed action, so a stripped count was
 * replaced by a DEFAULTED thirty days, and a player who asked for two hundred
 * rations got a month without being told - but only with a narrator running.
 */

import { describe, expect, it } from 'vitest';

import {
    carryWhatOnlyTheSentenceKnows,
    parseIntent,
    validatePlan,
    type PlannedAction
} from '../../src/web/actions';
import { ProviderNarrator } from '../../src/web/narrator';
import { ScriptedProvider } from './harness';

/**
 * The best a PERFECT model could do: emit exactly what the parser read, as
 * JSON, and let the boundary check it. Anything lost here is lost to every
 * model there will ever be, not to a weak one.
 */
function throughTheModelPath(said: string): PlannedAction {
    const local = parseIntent(said);
    const checked = validatePlan(JSON.parse(JSON.stringify(local)));
    if (!checked.ok) throw new Error(`the parser's own output failed validation: ${checked.reason}`);
    return carryWhatOnlyTheSentenceKnows(checked.action, said);
}

describe('both modes hand the engine the same action', () => {
    const SENTENCES = [
        'I threaten the steward into handing over the ledger',
        'I flatter the sect elder about her sword',
        'I buy 40 rations',
        'I lay in 200 rations before I sit down',
        'I spar with Xiao Wanping',
        'I cultivate for ten years',
        'I travel to Nine Peaks',
        'I go into seclusion for a decade',
        'I donate 100 spirit stones to the sect',
        'who can teach me'
    ];

    it.each(SENTENCES)('reaches the engine identically either way: %s', said => {
        expect(throughTheModelPath(said)).toEqual(parseIntent(said));
    });

    it('keeps the leverage the social resolver reads', () => {
        // `resolveAttempt` reads `leverage` and never `intent` - that is the
        // whole design of it, and it is what keeps a threat priced by the same
        // machine as a purse. Losing the field made a threat a bare ask.
        const said = 'I threaten the steward into handing over the ledger';
        expect(parseIntent(said).leverage).toBe('force');
        expect(throughTheModelPath(said).leverage).toBe('force');
    });

    it('keeps a count of rations, and drops the span that was standing in for it', () => {
        const said = 'I lay in 200 rations before I sit down';
        const carried = throughTheModelPath(said);
        expect(carried.rations).toBe(200);
        // Both at once would be two contradictory instructions to `provision`,
        // and the defaulted month is the one that was never asked for.
        expect(carried.days).toBeUndefined();
    });

    it('leaves the model\'s verb alone when the two paths disagree about it', () => {
        // The carry only ever FILLS fields, and only when both paths already
        // agree on the verb. A leverage read off a sentence the parser
        // understood as a different action is a fact about a different action.
        const said = 'I threaten the steward into handing over the ledger';
        const modelSaidSomethingElse: PlannedAction = { action: 'investigate', target: 'steward' };
        expect(carryWhatOnlyTheSentenceKnows(modelSaidSomethingElse, said))
            .toEqual(modelSaidSomethingElse);
    });

    it('never overwrites a field the model did supply', () => {
        const said = 'I spar with Xiao Wanping';
        const modelWasExplicit: PlannedAction = { action: 'attack', target: 'Xiao Wanping', terms: 'open' };
        expect(carryWhatOnlyTheSentenceKnows(modelWasExplicit, said).terms).toBe('open');
    });

    it('carries through the real narrator seam, not only the helper', async () => {
        // The model answers with the verb and nothing else, which is what the
        // phase-1 prompt actually asks for - `leverage` is not in the schema it
        // is shown, so no model will ever volunteer it.
        const provider = new ScriptedProvider({ plans: ['{"action":"interact","intent":"threaten"}'] });
        const narrator = new ProviderNarrator(provider, { model: 'test' });

        const plan = await narrator.plan('I threaten the steward into handing over the ledger', '');

        expect(plan.source).toBe('model');
        expect(plan.action.action).toBe('interact');
        expect(plan.action.leverage).toBe('force');
    });
});
