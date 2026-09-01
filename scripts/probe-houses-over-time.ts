/**
 * Do houses only ever end?
 *
 * Places were the same story until resettlement landed: the world consumed them
 * and never made one, so it went extinct. Factions may be running the same
 * one-way street - a house dissolves and nothing anywhere founds one - and the
 * alliance graph is known to decay with no source of positive standing at all.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'houses', catalog });
const seededIds = new Set(state.factions.map(f => f.id));
let years = 0;

console.log('years'.padStart(7) + 'alive'.padStart(7) + 'houses'.padStart(8)
    + 'dissolved'.padStart(11) + 'founded since'.padStart(15)
    + 'in a house'.padStart(12) + 'allied pairs'.padStart(14));
for (const step of [0, 250, 250, 500, 1000, 1000, 2000]) {
    if (step > 0) { state = advanceWorldYears(state, step).state; years += step; }
    const live = state.factions.filter(f => f.dissolvedOnDay === null);
    const founded = live.filter(f => !seededIds.has(f.id)).length;
    let allied = 0;
    for (const f of live) {
        for (const [other, s] of Object.entries(f.standing ?? {})) {
            if (Number(s) >= 0.3 && f.id < other) allied++;
        }
    }
    console.log(String(years).padStart(7)
        + String(state.npcs.filter(n => n.status === 'alive').length).padStart(7)
        + String(live.length).padStart(8)
        + String(state.factions.filter(f => f.dissolvedOnDay !== null).length).padStart(11)
        + String(founded).padStart(15)
        + String(state.npcs.filter(n => n.status === 'alive' && n.factionId).length).padStart(12)
        + String(allied).padStart(14));
}
