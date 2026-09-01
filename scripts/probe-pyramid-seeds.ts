/**
 * Does the pyramid hold its shape across seeds, or did one world get lucky?
 *
 * A single seed showing an occupied middle is not evidence that the middle is
 * occupied. This runs several worlds to 500 years and reports the band table
 * for each, plus how many of them leave a hole.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
const BANDS: [string, number, number][] = [
    ['mortal', 0, 0], ['qi', 1, 12], ['found', 13, 16], ['core', 17, 20],
    ['nascent', 21, 24], ['deity', 25, 28], ['void', 29, 32],
    ['body', 33, 36], ['grand', 37, 40], ['trib', 41, 44]
];
const seeds = ['a', 'b', 'c', 'd', 'e'];
console.log('seed'.padEnd(7) + 'alive'.padStart(7) + BANDS.map(([n]) => n.padStart(8)).join(''));
let holed = 0;
const middleHoles = new Map<string, number>();
for (const seed of seeds) {
    let { state } = seedWorld({ seed: `pyr-${seed}`, catalog });
    state = advanceWorldYears(state, 500).state;
    const alive = state.npcs.filter(n => n.status === 'alive');
    const row = BANDS.map(([, lo, hi]) =>
        alive.filter(n => n.cultivation.realmOrdinal >= lo && n.cultivation.realmOrdinal <= hi).length);
    console.log(seed.padEnd(7) + String(alive.length).padStart(7) + row.map(v => String(v).padStart(8)).join(''));
    const holes = BANDS.slice(2, 7).filter((_, i) => row[i + 2] === 0);
    if (holes.length > 0) { holed++; for (const [n] of holes) middleHoles.set(n, (middleHoles.get(n) ?? 0) + 1); }
}
console.log(`\n  worlds with a hole anywhere in the middle five bands: ${holed} of ${seeds.length}`);
if (middleHoles.size > 0) {
    console.log('  which bands, and how often: '
        + [...middleHoles].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} x${c}`).join('  '));
}
console.log(holed === 0
    ? '\n  Every world keeps a populated middle. The pyramid is a shape, not a coincidence.'
    : `\n  ${holed} of ${seeds.length} worlds still hollow out. Not fixed, just improved.`);
