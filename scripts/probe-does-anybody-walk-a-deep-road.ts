/**
 * Does the paper at the top of the ladder reach anybody, and does handing it
 * out move the middle of the world?
 *
 * Three questions, and they have to be asked of the same run, because the
 * interesting failure is that all three look right one at a time. A road that
 * exists is not a road anybody walks; somebody standing at 44 is not evidence
 * that they climbed there rather than being seeded there; and a ladder whose
 * top opens is worth nothing if the middle opened with it.
 *
 *   REACH     how many living people stand at each rung above Void Refinement,
 *             split into people the seeder placed and people who arrived, which
 *             is the split `audit-world-drift.ts` was reporting as one figure.
 *   INFLATION the whole rank histogram, so a middle that jumped is visible
 *             rather than inferred from the top.
 *   SCARCITY  how many distinct houses hold each deep road once the world has
 *             run, because copying is a thing the world does and the counting
 *             rule in docs/world/items.md is a measurement rather than a policy.
 *
 * Run: npx tsx scripts/probe-does-anybody-walk-a-deep-road.ts [years] [seed]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { manualCeilingOf } from '../src/engine/world/manuals.js';
import { THE_DEEPEST_ROADS } from '../src/data/cultivation/roads-to-the-top-of-the-ladder.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';
import { rankName } from '../src/engine/cultivation/realms.js';

const YEARS = Number(process.argv[2] ?? 300);
const SEED = process.argv[3] ?? 'deep-road-probe';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: SEED, catalog });

const seededIds = new Set((state.npcs as readonly any[]).map(n => n.id));
const alive = (s: any) => (s.npcs as any[]).filter(n => n.status === 'alive');
const ord = (n: any): number => n.cultivation.realmOrdinal;

function histogram(label: string, s: any): void {
    const living = alive(s);
    const bands: Record<string, number> = {};
    for (const n of living) {
        const key = rankName(ord(n)).replace(/ (Layer \d+|Early|Mid|Late|Perfection|First.*|Second.*|Third.*|Final.*|Rising.*|Sinew|Bone|Organ|Marrow)$/, '');
        bands[key] = (bands[key] ?? 0) + 1;
    }
    console.log(`\n${label}: ${living.length} alive`);
    for (const [k, v] of Object.entries(bands)) {
        console.log(`  ${k.padEnd(28)} ${String(v).padStart(5)}  ${(100 * v / living.length).toFixed(2)}%`);
    }
}

console.log(`seed ${SEED}, ${YEARS} years`);
histogram('BEFORE (seeded world)', state);

const t0 = Date.now();
const after = advanceWorldYears(state, YEARS).state as any;
console.log(`\n(advance took ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

histogram(`AFTER ${YEARS}y`, after);

// ── 1. REACH ────────────────────────────────────────────────────────────
console.log('\nHIGH RUNGS, SEEDED vs ARRIVED');
console.log(' ord  rank                              seeded arrived');
for (let o = 33; o <= 46; o++) {
    const at = alive(after).filter(n => ord(n) === o);
    if (at.length === 0) continue;
    const seeded = at.filter(n => seededIds.has(n.id)).length;
    console.log(
        String(o).padStart(4),
        rankName(o).padEnd(34),
        String(seeded).padStart(6),
        String(at.length - seeded).padStart(7)
    );
}
const top = alive(after).reduce((m, n) => Math.max(m, ord(n)), 0);
console.log(`highest living ordinal after ${YEARS}y: ${top} (${rankName(top)})`);

// A cultivator standing above the Lid who never crossed is the defect a cap of
// 45 would produce: paper carrying somebody onto a rung only the crossing
// reaches. Nothing should ever print here.
const aboveLidWithoutCrossing = alive(after)
    .filter(n => ord(n) >= 45 && (n.cultivation.immortalStatus ?? 'none') === 'none');
console.log(`above the Lid with immortalStatus 'none': ${aboveLidWithoutCrossing.length}` +
    (aboveLidWithoutCrossing.length ? '  <-- DEFECT' : ''));

// Nobody may be standing above what their own paper carries.
const overCeiling = alive(after).filter(n => {
    const c = manualCeilingOf(n);
    return c > 0 && ord(n) > c;
});
console.log(`standing above their own book's cap: ${overCeiling.length}`);

// ── 2b. THE HOUSES THEMSELVES ───────────────────────────────────────────
// A road held by nobody has three possible causes and they are different
// defects: the house is gone, the house is empty, or the house is full of
// people the shelf does not reach. Printing the roster distinguishes them.
console.log('\nTHE HOLDING HOUSES AFTER THE RUN');
for (const r of THE_DEEPEST_ROADS) {
    const f = (after.factions as any[]).find(x => x.id === r.factionId);
    if (!f) { console.log(`  ${r.factionId.padEnd(26)} no faction record at all`); continue; }
    const members = alive(after).filter(n => n.factionId === f.id);
    const best = members.reduce((m, n) => Math.max(m, ord(n)), -1);
    console.log(
        `  ${r.factionId.padEnd(26)} dissolved=${f.dissolvedOnDay !== null}  ` +
        `members ${String(members.length).padStart(3)}  strongest ord ${best}`
    );
}

// ── 3. SCARCITY ─────────────────────────────────────────────────────────
console.log('\nWHO HOLDS EACH DEEP ROAD AFTER THE RUN');
for (const r of THE_DEEPEST_ROADS) {
    const t = getTechnique(r.techniqueId) as { cap?: number | null } | undefined;
    const holders = alive(after).filter(n => n.cultivation.techniqueIds.includes(r.techniqueId));
    const houses = new Set(holders.map(n => n.factionId ?? '(rogue)'));
    console.log(
        `  ${r.techniqueId.padEnd(32)} cap ${String(t?.cap ?? 'null').padStart(4)}  ` +
        `holders ${String(holders.length).padStart(3)}  houses ${houses.size}  ` +
        `[${[...houses].join(', ')}]`
    );
}
