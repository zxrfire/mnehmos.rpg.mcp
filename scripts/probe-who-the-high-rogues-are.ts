/**
 * Who exactly are the unbacked cultivators standing above ordinal 29?
 *
 * `audit-alive-world.ts` bars more than two of them and
 * `probe-rogues-and-houses.ts` finds three on two seeds in five. Before treating
 * that as something the pill economy caused, the question is whether they CLIMBED
 * there unbacked or ARRIVED there and lost their house - which are opposite
 * findings and the audit cannot tell them apart.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { commodityMarketCeiling, stonesPerQiUnitAt } from '../src/engine/cultivation/buying-and-bartering-pills.js';

console.log(`commodityMarketCeiling = ${commodityMarketCeiling()}`);
console.log('  stones per qi-unit at ordinal 12 / 17 / 20 / 21 / 29: '
    + [12, 17, 20, 21, 29].map(o => {
        const p = stonesPerQiUnitAt(o);
        return Number.isFinite(p) ? p.toFixed(2) : 'no market';
    }).join('  '));

const catalog = await loadCultivationCatalog();
for (const seed of ['alive-audit', 'rogues-c']) {
    let { state } = seedWorld({ seed, catalog });
    const seededIds = new Set(state.npcs.map(n => n.id));
    state = advanceWorldYears(state, 300).state;
    const high = state.npcs.filter(n =>
        n.status === 'alive' && !n.factionId && n.cultivation.realmOrdinal > 29);
    console.log(`\n${seed}: ${high.length} unbacked above 29`);
    for (const n of high) {
        const age = Math.round((state.currentDay - n.identity.bornOnDay) / 365);
        console.log('  ' + String(n.identity.name ?? n.id).padEnd(22)
            + `ord ${String(n.cultivation.realmOrdinal).padStart(2)}`
            + `  age ${String(age).padStart(6)}`
            + `  ${seededIds.has(n.id) ? 'present at seeding' : 'born during the run'}`
            + `  tags: ${n.tags.filter(t => !t.startsWith('region:')).join(',') || '-'}`);
    }
}
