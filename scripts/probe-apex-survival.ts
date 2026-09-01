/**
 * Does the top of the world survive its own clock, across more than one seed?
 *
 * `demography.test.ts` asserts the strongest living cultivator after 500 years
 * is within one rung of the strongest at seeding, and it does so on a SINGLE
 * seed. That is a threshold on one sample of a stochastic world, so it can go
 * red for a trajectory change that is not a regression - and it can stay green
 * through one that is. This runs several seeds and reports the distribution.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
const rows: { seed: string; before: number; after: number; drop: number }[] = [];
for (const seed of ['demography', 'flow', 'population-shape', 'apex-a', 'apex-b', 'apex-c']) {
    let { state } = seedWorld({ seed, catalog });
    const top = (s: any) => s.npcs.filter((n: any) => n.status === 'alive')
        .reduce((m: number, n: any) => Math.max(m, n.cultivation.realmOrdinal), 0);
    const before = top(state);
    state = advanceWorldYears(state, 500).state;
    const after = top(state);
    rows.push({ seed, before, after, drop: before - after });
}
console.log('seed'.padEnd(20) + 'top at seeding'.padStart(16) + 'top at 500y'.padStart(13) + 'drop'.padStart(7));
for (const r of rows) {
    console.log(r.seed.padEnd(20) + String(r.before).padStart(16)
        + String(r.after).padStart(13) + String(r.drop).padStart(7));
}
const drops = rows.map(r => r.drop).sort((a, b) => a - b);
console.log(`\n  drop: min ${drops[0]}, median ${drops[Math.floor(drops.length / 2)]}, max ${drops[drops.length - 1]}`);
console.log(`  seeds where the apex fell more than one rung: ${drops.filter(d => d > 1).length} of ${drops.length}`);
console.log(drops.filter(d => d > 1).length > drops.length / 2
    ? '\n  The apex tier does not survive. That is a real regression, not one seed being unlucky.'
    : '\n  The apex mostly holds; the single-seed threshold is catching variance.');
