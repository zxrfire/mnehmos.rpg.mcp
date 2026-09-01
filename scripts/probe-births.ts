/**
 * Does the world stop being able to produce children?
 *
 * Population runs 565 -> 493 at 500 years -> 147 at 1500 -> ZERO at 2500. That
 * is not a ladder problem, it is extinction, and the likeliest cause is a change
 * I made: births used to fall back to the region container when a province had
 * no habitable ground left, and I replaced that with "then no child is born".
 * If habitable ground can vanish world-wide, that turns a cosmetic fallback into
 * a sterilisation.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'decay', catalog });
let years = 0;
console.log('years'.padStart(7) + 'alive'.padStart(7) + 'habitable places'.padStart(18)
    + 'sealed'.padStart(8) + 'entry>0'.padStart(9) + 'survival>0'.padStart(12));
for (const step of [0, 500, 500, 500, 500]) {
    if (step > 0) { state = advanceWorldYears(state, step).state; years += step; }
    const alive = state.npcs.filter(n => n.status === 'alive').length;
    const places = state.locations.filter(l => l.kind === 'settlement' || l.kind === 'sect_seat');
    const habitable = places.filter(l => !l.sealed && l.thresholds.entry <= 0 && l.thresholds.survival <= 0);
    console.log(String(years).padStart(7) + String(alive).padStart(7)
        + `${habitable.length} of ${places.length}`.padStart(18)
        + String(places.filter(l => l.sealed).length).padStart(8)
        + String(places.filter(l => l.thresholds.entry > 0).length).padStart(9)
        + String(places.filter(l => l.thresholds.survival > 0).length).padStart(12));
}

// Where did they go - deleted, or turned into something else?
const kinds = new Map<string, number>();
for (const l of state.locations) kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + 1);
console.log('\n  all locations at the end: ' + state.locations.length);
console.log('  by kind: ' + [...kinds].sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`).join('  '));
const scars = state.locations.filter(l => l.kind === 'scar');
console.log(`\n  scars carrying a change history: `
    + `${scars.filter(l => (l.changes ?? []).length > 0).length} of ${scars.length}`);
const sample = scars.find(l => (l.changes ?? []).length > 0);
if (sample) {
    console.log(`  e.g. ${sample.name}: `
        + (sample.changes ?? []).slice(-3).map((c: any) => c.kind).join(' -> '));
}
