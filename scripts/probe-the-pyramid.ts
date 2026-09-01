/**
 * The shape of the population across the nine realms, which is the acceptance
 * test for anything that touches how fast people climb.
 *
 * WHY THIS EXISTS. The ambient rate multiplier runs 0.5x on thin ground to 4x
 * in a spirit tide, and a change that lifts the floor lifts EVERY cultivator in
 * the world at once. The owner's constraint is that the world must not fill
 * with Tribulation Transcendence cultivators: the scarcity at the top is what
 * makes the top mean anything, and it is destroyed from the bottom up rather
 * than from the top down. So the histogram is the thing to check, before and
 * after, and it is checked on the SHAPE rather than on any single band.
 *
 * Read it as AGENTS.md describes it - nine buckets, chained, each one's outflow
 * being the next one's inflow. What is wanted at every stage is a steady volume
 * turning over slowly. What is not wanted is the middle climbing.
 *
 * Run: npx tsx scripts/probe-the-pyramid.ts [years] [seeds...]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { REALM_TIERS, realmForOrdinal } from '../src/engine/cultivation/realms.js';

const YEARS = Number(process.argv[2] ?? 500);
const SEEDS = process.argv.slice(3).length ? process.argv.slice(3) : ['pyr-a', 'pyr-b', 'pyr-c'];

const catalog = await loadCultivationCatalog();
const KEYS = REALM_TIERS.map(t => t.key);

function histogram(npcs: readonly any[]): Map<string, number> {
    const out = new Map<string, number>(KEYS.map(k => [k, 0]));
    for (const n of npcs) {
        if (n.status !== 'alive') continue;
        const k = realmForOrdinal(n.cultivation.realmOrdinal).key;
        out.set(k, (out.get(k) ?? 0) + 1);
    }
    return out;
}

function show(label: string, h: Map<string, number>, total: number): void {
    console.log(`\n${label}  (${total} alive)`);
    for (const k of KEYS) {
        const n = h.get(k) ?? 0;
        const pct = total ? (100 * n / total) : 0;
        console.log(`  ${k.padEnd(26)} ${String(n).padStart(5)}  ${pct.toFixed(2).padStart(6)}%  ` +
            '#'.repeat(Math.round(pct / 2)));
    }
}

const shares: Record<string, number[]> = Object.fromEntries(KEYS.map(k => [k, []]));

for (const seed of SEEDS) {
    const { state } = seedWorld({ seed, catalog });
    const before = histogram(state.npcs as any[]);
    const beforeTotal = [...before.values()].reduce((a, b) => a + b, 0);
    show(`SEED ${seed} - at world creation`, before, beforeTotal);

    const after = advanceWorldYears(state, YEARS).state as any;
    const h = histogram(after.npcs);
    const total = [...h.values()].reduce((a, b) => a + b, 0);
    show(`SEED ${seed} - after ${YEARS}y`, h, total);
    for (const k of KEYS) shares[k].push(total ? (100 * (h.get(k) ?? 0) / total) : 0);
}

// ── THE BASELINE, ACROSS SEEDS ──────────────────────────────────────────
console.log(`\n${'='.repeat(72)}`);
console.log(`BASELINE across ${SEEDS.length} seeds at ${YEARS}y - share of the living, per realm`);
console.log('  realm                        min      mean       max');
for (const k of KEYS) {
    const xs = shares[k];
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    console.log(
        `  ${k.padEnd(26)} ${Math.min(...xs).toFixed(2).padStart(6)}  ` +
        `${mean.toFixed(2).padStart(8)}  ${Math.max(...xs).toFixed(2).padStart(8)}`
    );
}

// The two numbers the owner's constraint is actually about.
const aboveVoid = SEEDS.map((_, i) =>
    ['body_integration', 'grand_ascension', 'tribulation_transcendence', 'immortal']
        .reduce((s, k) => s + shares[k][i], 0));
const tt = shares['tribulation_transcendence'];
console.log(`\n  share above Void Refinement : ${Math.min(...aboveVoid).toFixed(2)}% .. ${Math.max(...aboveVoid).toFixed(2)}%`);
console.log(`  share at Tribulation Transc.: ${Math.min(...tt).toFixed(2)}% .. ${Math.max(...tt).toFixed(2)}%`);
console.log(`  share at Qi Condensation    : ${Math.min(...shares['qi_condensation']).toFixed(2)}% .. ${Math.max(...shares['qi_condensation']).toFixed(2)}%`);
