/**
 * Gemma finding 36: an order to kneel opened a strike round. The prompt also
 * sent "empty your pockets" to physical coercion despite its hands/words
 * distinction. Spoken demands need their own clear reading in the speak lane.
 */
import { expect, it } from 'vitest';
import { validatePlan } from '../../src/web/planned-action.js';
import { makeGameInWorld, ScriptedProvider } from './harness.js';

it('carries a spoken demand as speech with leverage, never physical coercion', () => {
    expect(validatePlan({ lane: 'speak', intent: 'demand_with_words', target: 'the man', topic: 'kneel before me' }))
        .toMatchObject({ ok: true, action: { action: 'interact', intent: 'threaten', topic: 'kneel before me' } });
});

it('executes the spoken order without an unrequested player strike', async () => {
    const provider = new ScriptedProvider({ plans: [JSON.stringify({ lane: 'speak', intent: 'demand_with_words',
        target: 'the nearest', topic: 'kneel before me' })], narrations: ['The order is spoken.'] });
    const h = await makeGameInWorld({ seed: 'reading-spoken-order', worldSeed: 'reading-spoken-order-world', provider });
    try {
        await h.game.newRun('Speaker');
        expect(h.game.present(h.game.currentRun().cultivator).length).toBeGreaterThan(0);
        const turn = await h.game.act('I order the man standing nearby to kneel before me');
        expect(turn.toolCalls.some(call => call.name === 'narrator.plan' && call.source === 'model')).toBe(true);
        expect(turn.toolCalls.some(call => call.name === 'combat.round' || call.name === 'combat_manage.resolve')).toBe(false);
        expect(h.game.state().fight).toBeNull();
    } finally { h.db.close(); }
});
