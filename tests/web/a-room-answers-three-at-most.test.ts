/**
 * Words put to a whole room are answered by three at most.
 *
 * The set loop ran the act once per person standing there, so a question
 * put to a square of twenty-eight came back as twenty-eight answers. The
 * owner caps a room at three; the rest are a count. A threat or a theft still
 * lands on everybody, because what it does to each of them matters.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';

async function putToTheRoom(intent: string) {
    const provider = new ScriptedProvider({
        plans: [JSON.stringify({ action: 'interact', target: 'everyone here', intent })],
        narrations: ['(scripted)']
    });
    // Six standing on this square at the start.
    const { game } = await makeGameInWorld({ seed: 'intro-1', worldSeed: 'road-world', provider });
    const { cultivator } = await game.newRun('Probe');
    const standing = game.present(cultivator).length;
    const mark = provider.calls.length;
    const done = await game.act('I greet everyone here');
    const prompts = provider.calls.slice(mark)
        .map(call => call.messages.find(m => m.role === 'user')?.content ?? '').join(' ');
    return { standing, done, prompts };
}

describe('a room answers three at most', () => {
    it('lets three answer a greeting and counts the rest', async () => {
        const { standing, done, prompts } = await putToTheRoom('talk');
        expect(standing).toBeGreaterThan(3);
        const answered = done.toolCalls.filter(call => call.name === 'engine.resolveParty');
        expect(answered).toHaveLength(3);
        expect(prompts).toContain('Whoever else is here hears it and goes on with what they were doing.');
    }, 300_000);
});
