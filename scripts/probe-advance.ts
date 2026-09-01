/**
 * Why does nobody in the world ever gain a rung?
 *
 * `applyAdvancement` recomputes an ordinal with `deriveOrdinal` and keeps it only
 * if it beats what the NPC already has. `deriveOrdinal`'s only rising input is
 * age. So the whole macro ladder rests on one question: does that curve keep
 * climbing over a cultivator's lifetime, and does it reach where seeding already
 * put people?
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { deriveOrdinal } from '../src/engine/world/seeding.js';
import { forStream } from '../src/engine/cultivation/rng.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'advance-probe', catalog });
const region = (state.locations as any[]).filter(l => l.kind === 'region')
    .sort((a, b) => Number(b.data?.localCeilingOrdinal ?? 0) - Number(a.data?.localCeilingOrdinal ?? 0))[0];
const ceiling = Number(region.data.localCeilingOrdinal);
const rate = Number(region.data.ambientRateMultiplier ?? 1);
const AGES = [30, 60, 120, 300, 600, 1200, 3000];

console.log(`region ceiling ${ceiling}, rate ${rate}`);
console.log('\nASYMPTOTE BY SPIRIT ROOT  (best of 40 sampled cultivators per root)');
console.log('  root'.padEnd(30) + AGES.map(a => `a${a}`.padStart(7)).join(''));

const living = (state.npcs as any[]).filter(n => n.status === 'alive');
const byRoot = new Map<string, any[]>();
for (const n of living) {
    const r = n.cultivation.spiritRoot;
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r)!.push(n);
}
const asymptotes: number[] = [];
for (const [root, people] of [...byRoot].sort()) {
    const best = AGES.map(age => Math.max(...people.slice(0, 40).map(n =>
        deriveOrdinal(n.cultivation.spiritRoot, n.cultivation.attributes, age, rate, ceiling,
            forStream(state.seed, 'advance-npc', n.id)))));
    asymptotes.push(best[best.length - 1]);
    console.log('  ' + root.padEnd(28) + best.map(v => String(v).padStart(7)).join(''));
}
console.log(`\n  highest ordinal ANY root reaches at any age: ${Math.max(...asymptotes)}`);
console.log(`  the region permits:                          ${ceiling}`);

let frozen = 0, movable = 0;
for (const n of living) {
    const d = deriveOrdinal(n.cultivation.spiritRoot, n.cultivation.attributes, 3000, rate, ceiling,
        forStream(state.seed, 'advance-npc', n.id));
    if (d <= n.cultivation.realmOrdinal) frozen++; else movable++;
}
console.log(`\n  living cultivators who can NEVER advance, at any age: ${frozen} of ${frozen + movable}`);
