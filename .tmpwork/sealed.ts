import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { aSealHereMeansAnUndrawnPocket } from '../src/engine/world/locations.js';
import { ambientForLocationOnDay } from '../src/engine/cultivation/ambient.js';

const { state } = seedWorld({ seed: 'sealed-audit', catalog: await loadCultivationCatalog() });
const sealed = state.locations.filter(l => l.sealed);
const pockets = sealed.filter(l => aSealHereMeansAnUndrawnPocket(l.kind));
const doors = sealed.filter(l => !aSealHereMeansAnUndrawnPocket(l.kind));
console.log('sealed locations:', sealed.length, '| genuine pockets:', pockets.length, '| locked doors:', doors.length);

// What band does each report?
let doorsRich = 0;
for (const l of doors) {
    const band = ambientForLocationOnDay({
        seed: state.seed, locationId: l.id, day: state.currentDay,
        density: l.environment.spiritualDensity
    } as never);
    if (String(band) === 'sealed_vein') doorsRich++;
}
console.log('locked doors reporting the richest band:', doorsRich, 'of', doors.length);

const kinds = new Map<string, number>();
for (const l of doors) kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + 1);
console.log('locked-door kinds:', [...kinds.entries()].map(([k, n]) => `${k}:${n}`).join(', '));
