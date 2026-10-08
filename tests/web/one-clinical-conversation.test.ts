/**
 * Model probe lived-rooms-05 split a greeting, sect origin and name+care question
 * into three interactions; the clinical question vanished after `and` splitting
 * and the physician was asleep by the third attempt. Those are clauses of one
 * conversation, not three decisions. Preserve the entire topic before clause
 * restoration, using the same clinical information reader as actual dialogue.
 * Treatment/payment/movement remain separate acts; information never authorizes care.
 */
import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions.js';
import { theClausesOf, theWholeSentenceAsAPlan } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { isOneClinicalConversation } from '../../src/web/one-clinical-conversation.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { ScriptedProvider } from './harness.js';

const question = 'I greet the physician. I have come from Azure Dew Sect. May I ask your name and what care you offer travellers?';

describe('one physician conversation', () => {
    it('preserves greeting, context, name and care as a single full topic', async () => {
        const action = parseIntent(question);
        expect(action.action).toBe('interact');
        expect(action.intent).toBe('talk');
        expect(action.topic).toBe(question);
        expect(theClausesOf(question)).toEqual([question]);
        const restored = await theWholeSentenceAsAPlan(question, [{ action, said: question }], async clause => parseIntent(clause));
        expect(restored.steps.map(step => step.action.topic)).toEqual([question]);
        expect(restored.backfilled).toHaveLength(0);
        // The same exchange at the house shelf must not acquire extra turns
        // merely because its provider is described as an attendant.
        const atTheShelf = 'I greet the attendant dispensing medicine here. May I ask your name, and what I should do if I am hurt?';
        expect(isOneClinicalConversation(atTheShelf)).toBe(true);
        expect(theClausesOf(atTheShelf)).toEqual([atTheShelf]);
        expect(parseIntent(atTheShelf).topic).toBe(atTheShelf);
    });

    it('keeps the whole question from a scripted phase-one answer without appending another interaction', async () => {
        for (const answer of [
            { action: 'interact', intent: 'talk', topic: question },
            { action: 'interact', intent: 'talk', topic: 'care' },
            { steps: [{ action: 'interact', intent: 'talk', topic: 'care', said: question }] },
            { steps: [
                { action: 'interact', intent: 'talk', topic: 'greeting', said: 'I greet the physician' },
                { action: 'interact', intent: 'talk', topic: 'origin', said: 'I have come from Azure Dew Sect' },
                { action: 'interact', intent: 'talk', topic: 'care', said: 'May I ask your name and what care you offer travellers?' }
            ] }
        ]) {
            const narrator = new ProviderNarrator(new ScriptedProvider({ plans: [JSON.stringify(answer)] }), { model: 'test-model', timeoutMs: 5000 });
            const plan = await narrator.plan(question, 'A working physician is here.');
            expect(plan.action.action).toBe('interact');
            expect(plan.action.topic).toBe(question);
            expect(plan.steps?.length ?? 1).toBe(1);
        }
    });

    it('does not absorb a requested treatment, purchase or departure into a care question', () => {
        for (const act of ['I buy medicine', 'treat me', 'I go to the mission hall', 'I cultivate for a day']) {
            const input = `${question} and then ${act}`;
            expect(isOneClinicalConversation(input), input).toBe(false);
            expect(theClausesOf(input), input).toEqual([question, act]);
        }
    });
});
