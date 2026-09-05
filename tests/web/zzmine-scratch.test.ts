import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';

describe('where the high rungs stand', () => {
    it('counts', async () => {
        const { game } = await makeGameInWorld({ seed: 'hamlet', worldSeed: 'world-mine' });
        await game.newRun('Probe');
        const w = (await game.loadWorld())!;
        const loc = new Map(w.locations.map(l => [l.id, l as unknown as { name: string; kind?: string; settlementKind?: string }]));
        const high = w.npcs.filter(n => n.status === 'alive' && n.cultivation.realmOrdinal >= 37);
        console.log(`HIGH (37+) alive: ${high.length}`);
        for (const n of high.slice(0, 14)) {
            const l = n.locationId ? loc.get(n.locationId) : undefined;
            console.log(`   ord ${n.cultivation.realmOrdinal}  at ${l?.name ?? '(nowhere)'}  kind=${l?.kind ?? l?.settlementKind ?? '?'}`);
        }
        const kinds = new Set([...loc.values()].map(l => l.kind ?? l.settlementKind ?? '?'));
        console.log(`LOCATION KINDS: ${[...kinds].join(', ')}`);
        expect(true).toBe(true);
    }, 600_000);
});
