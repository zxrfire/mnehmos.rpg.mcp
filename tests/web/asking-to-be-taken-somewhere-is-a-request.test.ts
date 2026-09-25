/**
 * "Take me to X" said to a person asks them along; "how do I get to X" asks the
 * way. Neither is the player folding space.
 *
 * Played: "TAKE ME TO DRAGONVEIN, NOW", said to a messenger, was read by the
 * model as `fold`, and the guard let it through because asking somebody along
 * spends days too.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';
import { parseIntent } from '../../src/web/actions';

type Played = { narration?: string; toolCalls: { name: string; action: string; summary: string }[] };

const PLACE = 'Dragonvein Rock';

describe('the words', () => {
    it('reads "take me to X" said to somebody as asking them along, bound for X', () => {
        for (const said of [
            `take me to ${PLACE}`, `TAKE ME TO ${PLACE.toUpperCase()}, NOW`, `lead me to ${PLACE}`,
            `guide me to ${PLACE}`, `show me the way to ${PLACE}`, `will you take me to ${PLACE}`
        ]) {
            const plan = parseIntent(said);
            expect(plan, said).toMatchObject({ action: 'request', intent: 'company' });
            expect((plan.topic ?? '').toLowerCase(), said).toBe(PLACE.toLowerCase());
        }
        expect(parseIntent(`I ask him to take me to ${PLACE}`)).toMatchObject({
            action: 'request', intent: 'company', target: 'him', topic: PLACE
        });
        // Being put in front of somebody is still an introduction.
        expect(parseIntent('I ask him to take me to meet his master').intent).toBe('introduction');
    });

    it('reads "how do I get to X" as the way there, and never as a fold', () => {
        for (const said of [`how do I get to ${PLACE}?`, `which way to ${PLACE}?`, `where is ${PLACE}?`]) {
            expect(parseIntent(said), said).toMatchObject({ action: 'destinations', target: PLACE });
        }
        // Put to somebody, it is a question they answer.
        expect(parseIntent(`I ask him how to get to ${PLACE}`)).toMatchObject({
            action: 'interact', intent: 'talk', target: 'him', topic: `the way to ${PLACE}`
        });
        expect(parseIntent(`Elder, how do I get to ${PLACE}?`)).toMatchObject({
            action: 'interact', intent: 'talk', target: 'Elder', topic: `the way to ${PLACE}`
        });
    });

    it('keeps the fold for a sentence about folding', () => {
        expect(parseIntent(`I fold space to ${PLACE}`).action).toBe('fold');
    });
});

describe('played, with a model that read it as a fold', () => {
    it('asks the person along rather than folding', async () => {
        const plans: string[] = [];
        const provider = new ScriptedProvider({ plans, narrations: ['(scripted)'] });
        const { game } = await makeGameInWorld({ seed: 'take-me', worldSeed: 'road-world', provider });
        const { cultivator } = await game.newRun('Probe');
        const them = game.present(cultivator)[0]!;
        await game.act(`I talk to ${them.name}`);

        plans.push(JSON.stringify({ action: 'fold', target: PLACE }));
        const done = await game.act(`TAKE ME TO ${PLACE.toUpperCase()}, NOW`) as Played;
        const plan = done.toolCalls.find(call => call.name === 'narrator.plan');
        expect(plan?.action).toBe('request');
        expect(done.toolCalls.some(call => /fold/i.test(call.name))).toBe(false);
    }, 300_000);

    it('answers "how do I get to X" with the way, not a fold', async () => {
        const plans: string[] = [];
        const provider = new ScriptedProvider({ plans, narrations: ['(scripted)'] });
        const { game } = await makeGameInWorld({ seed: 'which-way', worldSeed: 'road-world', provider });
        await game.newRun('Probe');
        plans.push(JSON.stringify({ action: 'fold', target: PLACE }));
        const done = await game.act(`how do I get to ${PLACE}?`) as Played;
        expect(done.toolCalls.find(call => call.name === 'narrator.plan')?.action).toBe('destinations');
        expect(done.toolCalls.some(call => /fold/i.test(call.name))).toBe(false);
    }, 300_000);
});
