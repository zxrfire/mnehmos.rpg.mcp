import { describe, it } from 'vitest';
import { makeGameInWorld } from './harness.js';

describe('muster', () => {
    it('exists in worlds', async () => {
        for (const world of ['co-world-1', 'who-would-come-a', 'who-would-come-b']) {
            const harness = await makeGameInWorld({ seed: `m-${world}`, worldSeed: world });
            await harness.game.newRun('Asker');
            const npcs = (harness.game as any).atHand?.npcs ?? [];
            const kinds: Record<string, number> = {};
            for (const n of npcs) {
                const k = n.activity?.kind ?? 'none';
                kinds[k] = (kinds[k] ?? 0) + 1;
            }
            const musters = npcs.filter((n: any) => n.activity?.kind === 'mustering');
            console.log(world, 'npcs', npcs.length, JSON.stringify(kinds));
            console.log('  musters:', musters.length,
                musters.slice(0, 3).map((m: any) => `${m.name} withIds=${m.activity.withIds.length}`));
        }
    }, 300_000);
});
