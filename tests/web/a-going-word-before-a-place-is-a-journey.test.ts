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
        'heading to emerald water then',
        'aight thx old man. heading to emerald water then'
    ])('stands on a name shortened the way people say it: %s', async said => {
        const plan = await modelSaying('{"action":"move","target":"Emerald Water City"}').plan(said, '');
        expect(plan.action.action).toBe('move');
        expect(plan.action.target).toBe('Emerald Water City');
    });

    // Played: "ugh. keep going to iron ridge" read as a wait, and "ok head up to my room" as
    // nothing, where the same sentences without the word in front were a walk.
    it.each([
        ['ugh. keep going to iron crest', 'iron crest'],
        ['keep going to Iron Crest', 'iron crest'],
        ['ok head up to my room', 'my room'],
        ['sweet, I head to Silver Island', 'Silver Island']
    ])('reads the walk past a word that only fills the front: %s', (said, where) => {
        expect(parseIntent(said)).toMatchObject({ action: 'move', target: where });
    });

    it('leaves a word that is the whole answer, or means something, alone', () => {
        expect(parseIntent('ok').action).not.toBe('move');
        expect(parseIntent('right hook to his jaw').action).not.toBe('move');
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
