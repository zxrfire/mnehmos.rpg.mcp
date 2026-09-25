/**
 * A going word straight before the model's destination is a journey, whatever else the sentence
 * mentions. Played: "forget the board, i just walk to silver island myself" - the model read a
 * walk to Silver Island, the table read the duty board off "board", and the walk was dropped.
 */
import { describe, expect, it } from 'vitest';

import { ProviderNarrator } from '../../src/web/narrator';
import { parseIntent } from '../../src/web/actions';
import { ScriptedProvider } from './harness';

function modelSaying(json: string) {
    return new ProviderNarrator(new ScriptedProvider({ plans: [json] }), { model: 'test' });
}

const WALK = '{"action":"move","target":"Silver Island"}';

describe('a going word before a place', () => {
    it.each([
        'forget the board, i just walk to Silver Island myself',
        'i wanna see the sea. off to Silver Island',
        'ok then im heading back to Silver Island'
    ])('stands against a cheaper misreading: %s', async said => {
        const plan = await modelSaying(WALK).plan(said, '');
        expect(plan.action.action).toBe('move');
        expect(plan.action.target).toBe('Silver Island');
    });

    // Played: the name is only written back capitalised when it is typed whole.
    it.each([
        'heading to green water then',
        'aight thx old man. heading to green water then'
    ])('stands on a name shortened the way people say it: %s', async said => {
        const plan = await modelSaying('{"action":"move","target":"Green Water City"}').plan(said, '');
        expect(plan.action.action).toBe('move');
        expect(plan.action.target).toBe('Green Water City');
    });

    it('does not turn going over to the market into a journey', async () => {
        const plan = await modelSaying('{"action":"move","target":"the market"}').plan('i go to the market', '');
        expect(plan.action.action).not.toBe('move');
    });

    it('does not turn a question about a place into a journey', async () => {
        const said = 'I ask about Silver Island';
        expect(parseIntent(said).action).not.toBe('move');
        const plan = await modelSaying(WALK).plan(said, '');
        expect(plan.action.action).not.toBe('move');
    });
});
