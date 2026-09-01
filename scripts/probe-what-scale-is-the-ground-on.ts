/**
 * Is every place in the world thin, or is somebody banding the wrong column?
 *
 * A playtest report gave densities of 0, 0.1937, 0.3475, 0.4937, 0.6475,
 * 0.7167, 0.9333 and 1.0 with `thin` for all thirty-one, and concluded that
 * ambient is pinned at 0.5x everywhere and the game is not completable.
 *
 * Those numbers are on the 0..1 scale. `ordinaryBandFor` reads the 1..100 one,
 * and `clampQiDensity` rounds - so 1.0 becomes 1, which is `QI_DENSITY_MIN`,
 * which is `thin`. A location row carries BOTH columns: `qiDensity` (1..100,
 * geology) and `environment.spiritualDensity` (0..1, what you can draw). Band
 * the second with the first's function and every place in the world reads thin
 * including the best ground there is.
 *
 * So this prints three things: the real distribution off a seeded world, the
 * same distribution deliberately banded off the wrong column, and a sweep of
 * `ordinaryBandFor` over the 0..1 values the report quoted.
 *
 * Run: npx tsx scripts/probe-what-scale-is-the-ground-on.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { ordinaryBandFor, qiFraction, QI_BAND_FLOORS } from '../src/engine/world/qi-scale.js';
import { AMBIENT_QI_RATE_MULTIPLIER } from '../src/schema/cultivation.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'ground-probe', catalog });

const locs = (state.locations as any[]).filter(l => typeof l.qiDensity === 'number');
console.log(`locations with a density: ${locs.length}\n`);

// ── 1. THE RIGHT COLUMN, THE RIGHT FUNCTION ─────────────────────────────
const bands = new Map<string, number>();
for (const l of locs) {
    const b = ordinaryBandFor(l.qiDensity);
    bands.set(b, (bands.get(b) ?? 0) + 1);
}
console.log('BANDS off qiDensity (1..100), which is the pairing the engine uses:');
for (const b of ['thin', 'normal', 'dense', 'spirit_tide']) {
    const n = bands.get(b) ?? 0;
    console.log(`  ${b.padEnd(12)} ${String(n).padStart(4)}  rate x${AMBIENT_QI_RATE_MULTIPLIER[b as never]}`);
}
const ds = [...new Set(locs.map(l => l.qiDensity))].sort((a, b) => a - b);
console.log(`  distinct densities: ${ds.join(', ')}`);

// ── 2. THE WRONG COLUMN, THE SAME FUNCTION ──────────────────────────────
const wrong = new Map<string, number>();
for (const l of locs) {
    const fraction = l.environment?.spiritualDensity ?? qiFraction(l.qiDensity);
    wrong.set(ordinaryBandFor(fraction), (wrong.get(ordinaryBandFor(fraction)) ?? 0) + 1);
}
console.log('\nBANDS off environment.spiritualDensity (0..1) through the SAME function:');
for (const [b, n] of wrong) console.log(`  ${b.padEnd(12)} ${String(n).padStart(4)}`);
console.log('  ^ if this is thin for everything, that is the reported symptom reproduced');

// ── 3. THE REPORTED VALUES, BANDED ──────────────────────────────────────
console.log('\nTHE REPORTED VALUES PUT THROUGH ordinaryBandFor:');
for (const v of [0, 0.1937, 0.3475, 0.4937, 0.6475, 0.7167, 0.9333, 1.0]) {
    console.log(`  ${String(v).padEnd(8)} -> ${ordinaryBandFor(v)}`);
}
console.log(`  floors: thin ${QI_BAND_FLOORS.thin}, normal ${QI_BAND_FLOORS.normal}, ` +
    `dense ${QI_BAND_FLOORS.dense}, spirit_tide ${QI_BAND_FLOORS.spirit_tide}`);

// ── 4. THE NARROW BUG THAT IS REAL ──────────────────────────────────────
// `DEFAULTS.qiDensity` in seeding.ts is 0.34, a fraction, and it is handed to
// `createWorld` as the 1..100 figure. Any caller that does not pass one of its
// own gets ground that clamps to the floor of the scale.
const bare = seedWorld({ seed: 'ground-probe-bare', catalog, regionCount: 0 } as never).state;
const bareDs = [...new Set((bare.locations as any[])
    .filter(l => typeof l.qiDensity === 'number')
    .map(l => l.qiDensity))].sort((a, b) => a - b);
console.log(`\nseeded with no explicit qiDensity, distinct values: ${bareDs.join(', ')}`);
console.log('  a value under 1 here is a fraction sitting in the 1..100 column');
