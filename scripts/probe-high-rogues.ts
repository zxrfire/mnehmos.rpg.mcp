/**
 * Who are the "high rogues" the alive-world audit is counting?
 *
 * The audit asserts they are vanishingly rare, and reports three - which the
 * pill-economy sweep suspected was a classifier artefact rather than a world
 * fact: `!npc.factionId` conflates somebody who chose no house with somebody
 * whose house DISSOLVED underneath them.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'alive-audit', catalog });
const seeded = new Set(state.npcs.map(n => n.id));
state = advanceWorldYears(state, 300).state;

const high = state.npcs.filter(n =>
    n.status === 'alive' && !n.factionId && n.cultivation.realmOrdinal > 29);
console.log(`unbacked above ordinal 29: ${high.length}`);
for (const n of high) {
    const age = Math.round((state.currentDay - n.identity.bornOnDay) / 365);
    console.log(`  ${n.name}  ord ${n.cultivation.realmOrdinal}  age ${age}`
        + `  seededAtStart=${seeded.has(n.id)}`);
    console.log(`    tags: ${n.tags.join(', ') || '(none)'}`);
}
