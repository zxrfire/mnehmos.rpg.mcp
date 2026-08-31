import { deriveOrdinal } from '../../../src/engine/world/seeding.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { rollAttributes, rollSpiritRoot } from '../../../src/engine/cultivation/spirit-roots.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';

interface O { region: number; era?: number; ambient?: any; maxAge?: number }

function pop(label: string, opts: O, N = 4000) {
    const counts = new Array(46).fill(0);
    for (let i = 0; i < N; i++) {
        const r = forStream('npc', 'root', i), a = forStream('npc', 'attr', i);
        const root = rollSpiritRoot(r.next());
        const attrs = rollAttributes([a.next(), a.next(), a.next(), a.next()]);
        const age = 16 + forStream('npc', 'age', i).int(0, opts.maxAge ?? 300);
        const o = deriveOrdinal(root.key, attrs, age, opts.region, 44,
            forStream('npc', 'derive', i), { eraQiDensity: opts.era, ambient: opts.ambient });
        counts[o]++;
    }
    const atLeast = (x: number) => counts.slice(x).reduce((p: number, c: number) => p + c, 0) / N;
    const parts = REALM_TIERS.slice(1, 8).map(t =>
        `${t.name.slice(0, 4)}${t.ordinalStart}:${(atLeast(t.ordinalStart) * 100).toFixed(2)}%`);
    console.log(`${label.padEnd(36)} ${parts.join('  ')}`);
}

describe('npc derivation', () => {
    it('population shape', () => {
        console.log('\n=== ancients need ancient ages: era 0.95 + sealed vein ===');
        for (const maxAge of [300, 1000, 3000, 10000, 40000]) {
            pop(`age <= ${maxAge}`, { region: 1, era: 0.95, ambient: 'sealed_vein', maxAge });
        }
        console.log('\n=== era 0.95, open air (no sealed site) ===');
        for (const maxAge of [1000, 10000, 40000]) {
            pop(`age <= ${maxAge}`, { region: 1, era: 0.95, maxAge });
        }
        console.log('\n=== present day, open air, long-lived ===');
        pop('age <= 10000, era 0.35', { region: 1, era: 0.35, maxAge: 10000 });
        expect(true).toBe(true);
    });
});
