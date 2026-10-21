/**
 * Gemma finding 31: bowing, apologising and begging forgiveness during a fight
 * took a guard round and became a faction question. Literal yield words worked.
 * The configured reader needs a semantic route to the existing surrender act;
 * a scripted interpretation tests execution without a live model in CI.
 */
import { expect, it } from 'vitest';
import { validatePlan } from '../../src/web/planned-action.js';
import { makeGameInWorld, ScriptedProvider } from './harness.js';

it('keeps the interpreted fight answer through plan validation', () => {
    expect(validatePlan({ action: 'interact', fightAnswer: 'yield' }))
        .toMatchObject({ ok: true, action: { fightAnswer: 'yield' } });
});

it('takes an interpreted plea for forgiveness through the ordinary yielding path', async () => {
    const provider = new ScriptedProvider({ plans: [
        JSON.stringify({ action: 'attack', target: 'someone of my own rank' }),
        JSON.stringify({ action: 'interact', fightAnswer: 'yield' })
    ], narrations: ['The fight is answered.'] });
    const h = await makeGameInWorld({ seed: 'open-1', worldSeed: 'w-open-1', provider });
    try {
        await h.game.newRun('Bower');
        await h.game.act('I attack someone of my own rank');
        expect(h.game.state().fight).not.toBeNull();
        const reply = await h.game.act('I bow low and say im sorry senior, I was wrong, please forgive me');
        // This arrangement is not yet beaten. Ordinary yielding can be rejected
        // as a trick; the reader must still choose yield rather than guard.
        const round = reply.toolCalls.find(call => call.name === 'combat.round');
        expect(round, JSON.stringify(reply.toolCalls)).toBeDefined();
        expect(round!.summary).toContain('answered "yield"');
        const read = provider.calls.filter(call => String(call.messages?.[0]?.content).startsWith('You are the intent router')).at(-1)!;
        expect(String(read.messages?.[1]?.content)).toContain('FIGHT IN PROGRESS');
    } finally { h.db.close(); }
});
