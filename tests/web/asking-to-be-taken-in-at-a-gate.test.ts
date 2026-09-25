/**
 * Asking to be taken in, at a house's gate, is asking that house.
 *
 * Played at the Tranquil Oasis gate:
 *
 *   > I bow to the disciple at the gate. "My family belongs to the Tranquil
 *   > Oasis Sect. I have come to ask to be taken in."
 *
 * The model read a bow and a join, which is right. The table read `child` -
 * `family` and the auxiliary `have` - so the join was declined as a model
 * inventing an act, and the notice quoted the whole sentence back as the part
 * that "did not happen". Said with no name, the ask got the province's listing.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { parseIntent } from '../../src/web/verb-pattern-table.js';
import { sayingWhatTheReadingDropped } from '../../src/web/a-sentence-can-be-more-than-one-call.js';

const T4 = 'I bow to the disciple at the gate. "My family belongs to the Tranquil Oasis Sect. '
    + 'I have come to ask to be taken in."';

describe('the table', () => {
    it('reads asking to be taken in as joining, and a family as nobody\'s child', () => {
        expect(parseIntent(T4)).toMatchObject({ action: 'sect', target: 'the Tranquil Oasis Sect' });
        expect(parseIntent('I have come to ask to be taken in.')).toEqual({ action: 'sect' });
        expect(parseIntent('I ask to be taken in.')).toEqual({ action: 'sect' });
    });

    it('still reads having a child, where the verb governs it', () => {
        for (const said of ['I want to have a child with Lin Mei', 'we start a family', 'I raise the children']) {
            expect(parseIntent(said).action, said).toBe('child');
        }
    });

    it('does not read being fooled as joining', () => {
        expect(parseIntent('I was taken in by his lies').action).not.toBe('sect');
    });
});

describe('the guard', () => {
    const modelSaying = (json: string) =>
        new ProviderNarrator(new ScriptedProvider({ plans: [json] }), { model: 'test' });

    it('lets a walk to a place the sentence names stand where the table read nothing', async () => {
        const said = 'I walk back to Moraine Gate for the Silver Island Hall intake.';
        expect(parseIntent(said).action).toBe('unclear');
        const plan = await modelSaying('{"action":"move","target":"Moraine Gate"}').plan(said, '');
        expect(plan.action).toMatchObject({ action: 'move', target: 'Moraine Gate' });
        expect(plan.source).toBe('model');
    });

    it('still declines a walk the table read as something cheaper', async () => {
        const plan = await modelSaying('{"action":"move","target":"Moraine Gate"}').plan('I ask about Moraine Gate', '');
        expect(plan.action.action).not.toBe('move');
    });
});

describe('the notice for a dropped step', () => {
    it('names a step that quotes the whole sentence by its act', () => {
        const notice = sayingWhatTheReadingDropped(
            [{ action: { action: 'sect', target: 'Tranquil Oasis Sect' }, said: T4 }], T4
        );
        expect(notice).not.toContain('My family belongs');
    });
});

describe('at the gate', () => {
    async function atTheOasisGate(plans: string[]) {
        const harness = await makeGameInWorld({
            worldSeed: 'walking-up-the-terraces-world',
            seed: 'taken-in-at-the-gate',
            narrator: new ProviderNarrator(
                new ScriptedProvider({ plans, narrations: ['The moment passes.'] }),
                { model: 'test-model', timeoutMs: 5000 }
            )
        });
        await harness.game.newRun('Shen Ruo');
        await harness.game.act('I travel to the Tranquil Oasis Sect');
        return harness;
    }

    const aJoinRan = (turn: { toolCalls: Array<{ name: string; action: string }> }) =>
        turn.toolCalls.some(row => row.name === 'engine.step' && row.action === 'sect');

    it('asks this house when no house is named', async () => {
        const { game } = await atTheOasisGate([
            '{"action":"move","target":"Tranquil Oasis Sect"}',
            '{"action":"sect"}'
        ]);
        const turn = await game.act('I have come to ask to be taken in.');
        // The house was asked - its own join path answered, at its own grounds -
        // rather than the listing of every house the player can name.
        const joined = turn.toolCalls.find(row => row.name === 'sect_manage.join');
        expect(joined, JSON.stringify(turn.toolCalls)).toBeDefined();
        expect(joined!.summary).toMatch(/at its grounds: true/);
    }, 120_000);

    it('runs the join the model read, beside the bow', async () => {
        const { game } = await atTheOasisGate([
            '{"action":"move","target":"Tranquil Oasis Sect"}',
            JSON.stringify({
                steps: [
                    { action: 'interact', intent: 'talk', target: 'the disciple at the gate', said: 'I bow to the disciple at the gate' },
                    { action: 'sect', target: 'Tranquil Oasis Sect' }
                ]
            })
        ]);
        const turn = await game.act(T4);
        expect(aJoinRan(turn), JSON.stringify(turn.toolCalls.map(r => [r.name, r.action]))).toBe(true);
        expect(turn.toolCalls.some(row => row.action === 'child')).toBe(false);
    }, 120_000);
});
