/**
 * At a house's gate: "may I enter?" and "I enter the X" are answered by the
 * gate, and "who is a disciple of the X?" by who of it is standing here.
 *
 * Played at a gate: "may i enter?" came back as a 77-place destinations
 * listing; "I enter the azure dew sect" was read by the model as `site`,
 * refused as no site approached, and still wrote a public deed naming the
 * house; "who is a disciple of the azure dew sect?" read out the house's ranks.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';
import { parseIntent } from '../../src/web/actions';

type Played = { narration?: string; toolCalls: { name: string; action: string; summary: string }[] };

const HOUSE = 'Azure Dew Sect';

describe('the words', () => {
    it('reads asking to be let in as the gate, and a house never as a site', () => {
        expect(parseIntent('may i enter?')).toMatchObject({ action: 'look', intent: 'the_gate' });
        expect(parseIntent('let me in')).toMatchObject({ action: 'look', intent: 'the_gate' });
        expect(parseIntent(`may I enter the ${HOUSE}?`)).toMatchObject({
            action: 'look', intent: 'the_gate', target: `the ${HOUSE}`
        });
        expect(parseIntent('I enter the azure dew sect').action).not.toBe('site');
    });

    it('reads who of a house is here as the people present', () => {
        expect(parseIntent('who is a disciple of the azure dew sect?')).toMatchObject({
            action: 'look', intent: 'their_people_here'
        });
    });
});

async function atTheGate(provider?: ScriptedProvider) {
    const harness = await makeGameInWorld({
        seed: 'at-the-gate', worldSeed: 'road-world', ...(provider ? { provider } : {})
    });
    await harness.game.newRun('Probe');
    await harness.game.act(`I travel to the ${HOUSE}`);
    return harness;
}

describe('played at the gate', () => {
    it('answers "may i enter?" with the gate, not the road list', async () => {
        const { game } = await atTheGate();
        const done = await game.act('may i enter?') as Played;
        expect(done.toolCalls.map(call => call.name)).toContain('engine.standingAtTheGateOf');
        expect(done.toolCalls.map(call => call.action)).not.toContain('destinations');
    }, 300_000);

    it('answers "I enter" read as a site with the gate, and writes no public deed', async () => {
        const plans: string[] = [];
        const provider = new ScriptedProvider({ plans, narrations: ['(scripted)'] });
        const { game } = await atTheGate(provider);
        plans.push(JSON.stringify({ action: 'site', target: HOUSE }));
        const done = await game.act('I enter the azure dew sect') as Played;
        const names = done.toolCalls.map(call => call.name);
        expect(names).not.toContain('engine.resolveSite');
        expect(names).not.toContain('world.aDeedEntersTheWorld');
        expect(names).toContain('engine.standingAtTheGateOf');
    }, 300_000);

    it('answers who of the house is here with the people present, not its record', async () => {
        const { game } = await atTheGate();
        const done = await game.act('who is a disciple of the azure dew sect?') as Played;
        expect(done.narration ?? '').toMatch(/of the Azure Dew Sect/);
        expect(done.toolCalls.map(call => call.action)).not.toContain('investigate');
    }, 300_000);
});
