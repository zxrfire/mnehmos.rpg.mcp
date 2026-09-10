import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from '../web/harness.js';

describe('repro: cave food', () => {
    it('sweeps seeds looking for provisions_exhausted inside a stretch it said it covered', async () => {
        const hits: string[] = [];
        for (const seed of ['a1','a2','a3','a4','a5','a6','a7','a8','b1','b2','b3','b4','b5','b6','b7','b8']) {
            const { game, repos } = await makeGameInWorld({ seed, worldSeed: 'w1' });
            const { cultivator } = await game.newRun('Probe');
            repos.cultivators.applyDeltas(cultivator.id, { spiritStones: 400 });
            const sec = await game.act('seclude myself for three years anyway');
            const depleted = sec.events.find(e => e.kind === 'resource_depleted');
            const line = sec.toolCalls.find(c => c.action === 'buy_provisions')?.summary ?? '(no buy)';
            if (depleted) {
                hits.push(`${seed}: ${line}\n     >>> ${depleted.summary} (day+${depleted.dayOffset})`);
            }
            console.log(`${seed}: ${line} | events=${sec.events.map(e => e.kind).join(',')}`);
        }
        console.log('=== HITS ===');
        for (const h of hits) console.log(h);
        expect(true).toBe(true);
    }, 600000);
});
