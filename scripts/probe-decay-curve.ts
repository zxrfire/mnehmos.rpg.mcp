/**
 * When does the world stop holding a ladder at all?
 *
 * At five hundred years the pyramid is healthy and every band occupied. At five
 * thousand the highest living cultivator is ordinal 11. Somewhere between those
 * the world stops being able to hold anybody up, and the shape of that curve
 * says whether it is a slow bleed or a cliff.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { reachableCeilingFor, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'decay', catalog });
let years = 0;
console.log('years'.padStart(7) + 'alive'.padStart(7) + 'top'.padStart(6)
    + 'at 13+'.padStart(8) + 'at 21+'.padStart(8) + 'inHouse'.padStart(9)
    + 'holding a road'.padStart(16) + 'best ceiling'.padStart(14));
for (const step of [0, 250, 250, 500, 500, 1000, 1000, 1500]) {
    if (step > 0) { state = advanceWorldYears(state, step).state; years += step; }
    const alive = state.npcs.filter(n => n.status === 'alive');
    const top = alive.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), 0);
    const road = alive.filter(n => (reachableCeilingFor(state, n) || 0) > 0).length;
    const bestCeil = alive.reduce((m, n) => Math.max(m, reachableCeilingFor(state, n) || BOOKLESS_CEILING), 0);
    console.log(String(years).padStart(7) + String(alive.length).padStart(7)
        + String(top).padStart(6)
        + String(alive.filter(n => n.cultivation.realmOrdinal >= 13).length).padStart(8)
        + String(alive.filter(n => n.cultivation.realmOrdinal >= 21).length).padStart(8)
        + String(alive.filter(n => n.factionId).length).padStart(9)
        + String(road).padStart(16) + String(bestCeil).padStart(14));
}
