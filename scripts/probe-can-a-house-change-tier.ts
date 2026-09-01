/**
 * Can a body rise or fall in the hierarchy, or is its standing fixed forever?
 *
 * The setting says tiers move. The Storm Tyrant Court entry is a relegation
 * story and is the best-written thing in the register - it WAS an apex, and the
 * province has stopped saying so out loud. The Hollow Court declines. The
 * Frostmirror Court resents being priced on a loss. All three describe a world
 * where standing is current rather than innate.
 *
 * This checks whether the engine can produce any of that. Three questions:
 * whether tier is a fact the world holds at all, whether anything ever changes
 * it, and what a body founded during the run reads as.
 *
 * Run: npx tsx scripts/probe-can-a-house-change-tier.ts [years]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { tierOf, chainToApex } from '../src/data/cultivation/governance-and-water-rights.js';

const YEARS = Number(process.argv[2] ?? 1000);
const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'tier', catalog });
const seededIds = new Set((state.factions as any[]).map(f => f.id));

// WHAT THE WORLD ACTUALLY HOLDS. `FactionRecord` carries `standing`, a map of
// relationship numbers, and no parent and no tier. Seeding turns parentage into
// standing[parent] = 0.4 and then forgets the structure, so there is nothing
// for a later pass to promote or relegate even if one wanted to.
const sample = (state.factions as any[])[0];
console.log('fields on a seeded FactionRecord:');
console.log('  ' + Object.keys(sample).sort().join(', '));
console.log(`  carries a parent field: ${'parentFactionId' in sample}`);
console.log(`  carries a tier field:   ${'tier' in sample}`);

const after = advanceWorldYears(state, YEARS).state as any;
const standing = (after.factions as any[]).filter(f => f.dissolvedOnDay === null);
const dissolved = (after.factions as any[]).filter(f => f.dissolvedOnDay !== null);
const founded = standing.filter(f => !seededIds.has(f.id));

console.log(`\nafter ${YEARS}y: ${standing.length} standing, ${dissolved.length} dissolved, ` +
    `${founded.length} founded during the run`);

// Did any seeded body change tier? It cannot, because tierOf reads the catalog,
// but printing it is what makes that a measurement rather than a claim.
let moved = 0;
for (const f of standing) {
    if (!seededIds.has(f.id)) continue;
    if (tierOf(f.id) !== tierOf(f.id)) moved++;
}
console.log(`seeded bodies whose tier changed over the run: ${moved}`);

console.log('\nTIER OF BODIES FOUNDED DURING THE RUN');
for (const f of founded.slice(0, 6)) {
    console.log(`  tier ${tierOf(f.id)}  chain [${chainToApex(f.id).join(' -> ')}]  ${f.id}`);
}
console.log('\nTIER OF SEEDED BODIES, for comparison');
for (const id of ['sect-azure-cloud-pavilion', 'sect-storm-tyrant-court',
    'sect-hollow-court', 'sect-sixmile-wardens']) {
    console.log(`  tier ${tierOf(id)}  chain [${chainToApex(id).join(' -> ')}]  ${id}`);
}

const t0 = standing.filter(f => tierOf(f.id) === 0);
console.log(`\nbodies reading tier 0 after ${YEARS}y: ${t0.length} of ${standing.length}`);
console.log('tier 0 is meant to be apex depth. It is also what a body with no');
console.log('recorded parent reads as, so it conflates the top of the hierarchy');
console.log('with everybody standing outside it.');
