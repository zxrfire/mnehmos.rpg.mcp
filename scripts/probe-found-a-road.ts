/**
 * How often does anybody actually find a road past their shelf, and how high?
 *
 * `mightFindARoad` is the world's only route out of a house's library, and its
 * odds halve with every realm above Foundation. If that decay is too steep the
 * route exists on paper and never fires where it matters - which would explain
 * why isolated lives reach ordinal 41 while nobody in a living world has ever
 * exceeded 29.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { reachableCeilingFor, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'found-a-road', catalog });
const ceilingBefore = new Map<string, number>();
for (const n of state.npcs) ceilingBefore.set(n.id, reachableCeilingFor(state, n) || BOOKLESS_CEILING);

const raised = new Map<number, number>();
for (let era = 0; era < 10; era++) {
    state = advanceWorldYears(state, 500).state;
    for (const n of state.npcs) {
        if (n.status !== 'alive') continue;
        const now = reachableCeilingFor(state, n) || BOOKLESS_CEILING;
        const was = ceilingBefore.get(n.id);
        if (was !== undefined && now > was) {
            const band = Math.floor(was / 4) * 4;
            raised.set(band, (raised.get(band) ?? 0) + 1);
        }
        ceilingBefore.set(n.id, now);
    }
}
console.log('CEILINGS RAISED over 5,000 years, by the ceiling they were stuck at');
for (const [band, n] of [...raised].sort((a, b) => a[0] - b[0])) {
    console.log(`  stuck at ${String(band).padStart(2)}-${String(band + 3).padStart(2)}: `
        + `${String(n).padStart(4)} raised  ${'#'.repeat(Math.min(50, n))}`);
}
const above = [...raised].filter(([b]) => b >= 21).reduce((s, [, n]) => s + n, 0);
console.log(`\n  raised from a ceiling of 21 or above: ${above}`);
const alive = state.npcs.filter(n => n.status === 'alive');
console.log(`  highest ceiling anybody can now reach: `
    + `${Math.max(...alive.map(n => reachableCeilingFor(state, n) || BOOKLESS_CEILING))}`);
console.log(`  highest ordinal alive: ${Math.max(...alive.map(n => n.cultivation.realmOrdinal))}`);
