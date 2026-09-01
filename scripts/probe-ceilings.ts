/**
 * Does the region ceiling reach the code that enforces it, and does anybody climb?
 *
 * `pressure.ts` reads `region.data.localCeilingOrdinal ?? 20` in two places and caps
 * every NPC's advancement at it. The catalog declares 44 for the Low Fall and 6 for
 * the Quiet Marches, so the fallback should never fire. The open question is the
 * second one: a ceiling that is never approached is the same as no ladder at all,
 * and `audit-world-drift.ts` reporting a strongest of 44 at every era does not
 * distinguish "somebody climbed there" from "somebody was seeded there and lived".
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'ceiling-probe', catalog });

console.log('SEEDED REGION LOCATIONS');
for (const r of (state.locations as any[]).filter(l => l.kind === 'region')) {
    console.log(`  ${r.name.padEnd(24)} data.localCeilingOrdinal = ${JSON.stringify(r.data?.localCeilingOrdinal)}`);
}

const ord = (n: any): number => n.cultivation.realmOrdinal;
const living = (s: any) => (s.npcs as any[]).filter(n => n.status === 'alive');
const top = (s: any) => living(s).reduce((m, n) => Math.max(m, ord(n)), 0);

const before = new Map((state.npcs as any[]).map(n => [n.id, ord(n)]));
console.log(`\nbefore: living ${living(state).length}, top ordinal ${top(state)}`);

const after = advanceWorldYears(state, 200).state as any;
let rose = 0, crossed20 = 0, newAbove20 = 0, mostGained = 0;
for (const n of living(after)) {
    const was = before.get(n.id);
    if (was === undefined) { if (ord(n) > 20) newAbove20++; continue; }
    if (ord(n) > was) { rose++; mostGained = Math.max(mostGained, ord(n) - was); }
    if (ord(n) > 20 && was <= 20) crossed20++;
}
console.log(`after 200y: living ${living(after).length}, top ordinal ${top(after)}`);
console.log(`  seeded NPCs who rose at all:        ${rose}  (biggest single gain: ${mostGained} rungs)`);
console.log(`  seeded NPCs who crossed ordinal 20: ${crossed20}`);
console.log(`  NPCs born after seeding now >20:    ${newAbove20}`);
const dist = new Map<number, number>();
for (const n of living(after)) { const b = Math.floor(ord(n) / 5) * 5; dist.set(b, (dist.get(b) ?? 0) + 1); }
console.log('  living by band: ' + [...dist].sort((a, b) => a[0] - b[0]).map(([b, c]) => `${b}-${b + 4}:${c}`).join('  '));

// Nobody rose. `deriveOrdinal` is called with a stable per-NPC stream, so for a
// given person it is a pure function of age - it should climb as they age. Ask it
// directly whether it does.
const { deriveOrdinal } = await import('../src/engine/world/seeding.js');
const { forStream } = await import('../src/engine/cultivation/rng.js');
const someone = living(after)[0];
console.log(`\nderiveOrdinal vs age for one seeded cultivator (${someone.cultivation.spiritRoot}, now ${ord(someone)}):`);
const region = (after.locations as any[]).find((l: any) => l.kind === 'region');
const row: string[] = [];
for (const age of [16, 30, 60, 120, 250, 500, 1000]) {
    const d = deriveOrdinal(
        someone.cultivation.spiritRoot, someone.cultivation.attributes, age,
        Number(region?.data.ambientRateMultiplier ?? 1),
        Number(region?.data.localCeilingOrdinal ?? 20),
        forStream(after.seed, 'advance-npc', someone.id)
    );
    row.push(`age ${age}: ${d}`);
}
console.log('  ' + row.join('   '));
