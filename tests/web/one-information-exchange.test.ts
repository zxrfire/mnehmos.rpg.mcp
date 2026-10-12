/**
 * Actual rooms07 model play preserved the player's greeting, name and work
 * questions in its plan, but topic normalization clipped everything after the
 * greeting. The resulting engine deflection left the narrator without answers.
 * Ordinary questions to one person must survive as one complete exchange, just
 * as clinical questions do. Actual purchases, treatment and departures remain
 * separate decisions, and this structural reader does not answer the questions.
 * Oct10 integration reproduced health and medicine-price reads becoming
 * conversations because their nouns were clinical. A standalone question
 * carries no greeting/context to combine and retains its ordinary reader.
 * A cure-price inquiry also lost its named object at the comma: stating what
 * is needed supplies the question's context, not a separate action.
 */
import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions.js';
import { theClausesOf } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { informationQuestionsOf, isOneInformationExchange } from '../../src/web/one-information-exchange.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { ScriptedProvider } from './harness.js';

const question = 'I greet the member working in this hall. May I ask your name, and where a new member goes to take work?';

describe('one ordinary information exchange', () => {
    it('keeps a price question with its named object without swallowing a later act', () => {
        for (const object of ['a Meridian Rebirth Pill', 'a sword', 'passage to the capital']) {
            const input = `I need ${object}, what's your price?`;
            expect(parseIntent(input)).toMatchObject({ action: 'request', intent: 'weigh' });
            expect(theClausesOf(input)).toEqual([input]);
            expect(theClausesOf(`${input} and then I leave`)).toEqual([input, 'I leave']);
        }
        expect(theClausesOf("I buy a sword, what's your price?")).toHaveLength(2);
    });

    it('keeps the full topic and each question in order', () => {
        expect(parseIntent(question).topic).toBe(question);
        expect(theClausesOf(question)).toEqual([question]);
        expect(informationQuestionsOf(question)).toEqual([
            'May I ask your name', 'where a new member goes to take work'
        ]);
    });

    it('restores a complete question from short and split model plans', async () => {
        for (const answer of [
            { action: 'interact', intent: 'talk', topic: question },
            { action: 'interact', intent: 'talk', topic: 'greeting' },
            { steps: [
                { action: 'interact', intent: 'talk', topic: 'greeting', said: 'I greet the member working in this hall' },
                { action: 'interact', intent: 'talk', topic: 'name', said: 'May I ask your name' },
                { action: 'interact', intent: 'talk', topic: 'work', said: 'where a new member goes to take work' }
            ] }
        ]) {
            const narrator = new ProviderNarrator(new ScriptedProvider({ plans: [JSON.stringify(answer)] }), { model: 'test-model', timeoutMs: 5000 });
            const plan = await narrator.plan(question, 'A member is working in this hall.');
            expect(plan.action.topic).toBe(question);
            expect(plan.steps?.length ?? 1).toBe(1);
        }
    });

    it('leaves requested acts separate and unrelated questions on their own route', () => {
        for (const act of ['I buy medicine', 'treat me', 'I go to the mission hall', 'I cultivate for a day']) {
            const input = `${question} and then ${act}`;
            expect(isOneInformationExchange(input)).toBe(false);
            expect(informationQuestionsOf(input)).toEqual([]);
            expect(theClausesOf(input)).toEqual([question, act]);
        }
        expect(isOneInformationExchange('What are my statistics?')).toBe(false);
        for (const input of ['How hurt am I?', 'How hurt is he?',
            'What injuries do I have?', 'How much is a healing pill?']) {
            expect(isOneInformationExchange(input), input).toBe(false);
        }
    });
});
