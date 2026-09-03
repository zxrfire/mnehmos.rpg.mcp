/**
 * What is live here is shown to the narrator along with who is standing there.
 *
 * Phase 3 is sent `facts.lines` and never `facts.structure`. A state summary
 * that lives only on the mechanical channel describes a player the narrator
 * cannot see, and a model asked to write "you stand there with..." then has no
 * figure for the purse except the one in the player's own sentence.
 *
 * The player's sentence is a CLAIM. People describe their own situation from
 * memory - "I've got thirty stones and no idea what I'm doing" while holding
 * sixteen - so a number taken from it is stale by default rather than by
 * accident. The engine's figure has to be in the same prompt for the model to
 * prefer it.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import type { LLMProvider } from '../../src/agent/provider/types';

const seen: string[] = [];

function recording(plans: Array<Record<string, unknown>>): LLMProvider {
    const queue = [...plans];
    return {
        name: 'recording',
        async call(req: { messages: Array<{ role: string; content: string }> }) {
            const user = req.messages.find(m => m.role === 'user')?.content ?? '';
            if (user.includes('Respond with the JSON object only')) {
                return { text: JSON.stringify(queue.shift() ?? { action: 'look' }) };
            }
            seen.push(user);
            return { text: 'PROSE.' };
        }
    } as unknown as LLMProvider;
}

/** The facts block phase 3 was handed, and nothing else. */
function ruledIn(): string {
    const block = seen[seen.length - 1] ?? '';
    const from = block.indexOf('WHAT THE ENGINE RULED');
    const to = block.indexOf('\n\nWrite two');
    return from === -1 ? '' : block.slice(from, to === -1 ? undefined : to);
}

describe('the guidance read shows the narrator who is standing there', () => {
    it('carries the purse, and carries the one the engine holds', async () => {
        const { game } = await makeGameInWorld({
            worldSeed: 'guidance-shows-the-player',
            provider: recording([
                { action: 'buy', target: 'Lesser Qi-Gathering Manual' },
                { action: 'unclear' }
            ])
        });
        await game.newRun('Mo Qianshu');

        // Spend first, so the figure on the sheet is no longer the one a player
        // would remember from the opening.
        await game.act('I buy the Lesser Qi-Gathering Manual');
        const mid = await game.state();
        expect(mid.cultivator!.spiritStones, 'nothing was spent; the case is not set up')
            .not.toBe(30);

        seen.length = 0;
        await game.act("I've got thirty stones and no idea what I'm doing. Where should I start?");
        const ruled = ruledIn();

        expect(ruled).toMatch(/On them: \d+ spirit stones?/);
        expect(ruled).toContain(`On them: ${mid.cultivator!.spiritStones} spirit stone`);
        // And not the player's remembered one.
        expect(ruled).not.toMatch(/On them: 30 spirit stones/);
    }, 120_000);

    it('carries the body as well as the purse', async () => {
        const { game } = await makeGameInWorld({
            worldSeed: 'guidance-shows-the-player',
            provider: recording([{ action: 'unclear' }])
        });
        await game.newRun('Mo Qianshu');

        seen.length = 0;
        await game.act('what can I do here');
        const ruled = ruledIn();

        expect(ruled).toMatch(/satiety \d+ of 100/i);
        expect(ruled).toMatch(/physician could still close|nothing a physician would need/i);
    }, 120_000);

    /**
     * One sentence, not a column. What the dump rule forbids is a paragraph of
     * figures; this is the same three numbers the mechanical channel already
     * carries, said once.
     */
    it('says it in one line', async () => {
        const { game } = await makeGameInWorld({
            worldSeed: 'guidance-shows-the-player',
            provider: recording([{ action: 'unclear' }])
        });
        await game.newRun('Mo Qianshu');

        seen.length = 0;
        await game.act('what can I do here');

        const stateLines = ruledIn().split('\n').filter(l => /On them:/.test(l));
        expect(stateLines).toHaveLength(1);
    }, 120_000);
});
