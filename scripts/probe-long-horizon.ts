/**
 * When the seeded ancients finally die, does anything stand at the top?
 *
 * Five hundred years is short for this world - the oldest living cultivator is
 * over twenty-five thousand. So a healthy-looking pyramid at 500y may simply be
 * the original elite not having died yet, with a climbing population underneath
 * that tops out far below them. Measured earlier: the highest rung anybody
 * CROSSED INTO over 500 years was 28, while people stand at 44.
 *
 * This runs long enough for that to matter and reports whether the top is held
 * by survivors or by arrivals.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'long-horizon', catalog });
const seededIds = new Set(state.npcs.map(n => n.id));

const report = (label: string) => {
    const alive = state.npcs.filter(n => n.status === 'alive');
    const high = alive.filter(n => n.cultivation.realmOrdinal >= 29);
    const survivors = high.filter(n => seededIds.has(n.id)).length;
    const arrivals = high.length - survivors;
    const top = alive.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), 0);
    console.log(`  ${label.padEnd(8)} alive ${String(alive.length).padStart(4)}`
        + `   top ${String(top).padStart(2)}`
        + `   at 29+: ${String(high.length).padStart(3)}`
        + `   of them seeded: ${String(survivors).padStart(3)}`
        + `   arrived since: ${String(arrivals).padStart(3)}`);
};

console.log('WHO HOLDS THE TOP, AND DID THEY CLIMB THERE?');
report('seeding');
for (const [label, step] of [['500y', 500], ['1500y', 1000], ['3000y', 1500],
                             ['6000y', 3000], ['12000y', 6000]] as const) {
    state = advanceWorldYears(state, step).state;
    report(label);
}

const alive = state.npcs.filter(n => n.status === 'alive');
const high = alive.filter(n => n.cultivation.realmOrdinal >= 29);
const arrivals = high.filter(n => !seededIds.has(n.id)).length;
console.log(arrivals > 0
    ? `\n  ${arrivals} cultivator(s) at 29+ were born after the seeding. The upper ladder is`
      + '\n  being reached, not merely inherited.'
    : '\n  NOBODY born after the seeding stands above ordinal 29. The top of this world is'
      + '\n  entirely inherited, and when the last survivor dies it is gone.');

// How high does anybody born after the seeding actually get, ever?
const born = state.npcs.filter(n => !seededIds.has(n.id));
const bestArrival = born.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), 0);
console.log(`\n  cultivators born after the seeding: ${born.length}`);
console.log(`  the highest any of them ever reached: ${bestArrival}`);
const dist = new Map<number, number>();
for (const n of born) {
    const b = Math.floor(n.cultivation.realmOrdinal / 4) * 4;
    dist.set(b, (dist.get(b) ?? 0) + 1);
}
console.log('  by band of four: ' + [...dist].sort((a, b) => a[0] - b[0])
    .map(([b, c]) => `${b}-${b + 3}:${c}`).join('  '));
