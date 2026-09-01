/**
 * Does the one sanctioned route to the top of the ladder ever actually fire?
 *
 * The Hollow Court recruits from about ordinal 29 upward out of any house
 * anywhere, at no cost to the house that raised the person - the original house
 * gains standing, the Court sends rewards back down, and nobody has ever gone to
 * war over it. Its lowest rank sits at Void Refinement, so it has no junior
 * intake, no primer shelf and no outer roster: its ladder starts where other
 * houses' ladders end.
 *
 * That makes it the pressure valve at exactly the rung where the population
 * decomposition puts a second cluster of stuck people - "house exhausted" at
 * 29-44, standing at the end of their own shelf with nothing above it.
 *
 * So: does it recruit in the simulation, or is its membership seeded and never
 * added to? If the latter, the one legitimate route to the summit exists in the
 * catalog and never opens, and the frozen top bands are explained from the
 * supply side.
 *
 * Run: npx tsx scripts/probe-does-the-hollow-court-ever-recruit.ts [years]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { shelfOf, reachableCeilingFor, admissionOffer, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';

const YEARS = Number(process.argv[2] ?? 300);
const COURT = 'sect-hollow-court';
const catalog = await loadCultivationCatalog();

for (const seed of ['court-a', 'court-b', 'court-c']) {
    const { state } = seedWorld({ seed, catalog });
    const before = (state.npcs as any[]).filter(n => n.factionId === COURT && n.status === 'alive');
    const seededIds = new Set((state.npcs as any[]).map(n => n.id));
    const house = (state.factions as any[]).find(f => f.id === COURT);

    const after = advanceWorldYears(state, YEARS).state as any;
    const afterHouse = (after.factions as any[]).find(f => f.id === COURT);
    const members = (after.npcs as any[]).filter(n => n.factionId === COURT && n.status === 'alive');
    const arrived = members.filter(n => !seededIds.has(n.id));
    // Somebody the seeder placed elsewhere who is now in the Court is a recruit.
    const beforeById = new Map((state.npcs as any[]).map(n => [n.id, n.factionId]));
    const transferred = members.filter(n => seededIds.has(n.id) && beforeById.get(n.id) !== COURT);

    // And the pool it could draw from: anybody at 29+ outside it.
    const pool = (after.npcs as any[]).filter(n =>
        n.status === 'alive' && n.factionId !== COURT && n.cultivation.realmOrdinal >= 29);

    console.log(`\nseed ${seed}`);
    console.log(`  admission ordinal ${house?.resources?.admission_ordinal}, ranks ${house?.ranks?.length}, ` +
        `offer ${admissionOffer(COURT, state.seed)}, shelf ${shelfOf(state as any, COURT).length}`);
    console.log(`  members at seeding: ${before.length}  [${before.map(n => n.cultivation.realmOrdinal).join(', ')}]`);
    console.log(`  dissolved by ${YEARS}y: ${afterHouse?.dissolvedOnDay !== null}`);
    console.log(`  members after ${YEARS}y: ${members.length}  ` +
        `[${members.map(n => n.cultivation.realmOrdinal).join(', ')}]`);
    console.log(`    born into it during the run : ${arrived.length}`);
    console.log(`    RECRUITED from another house: ${transferred.length}`);
    console.log(`  world pool it could draw from (29+, not in it): ${pool.length}` +
        (pool.length ? `  [${pool.map(n => n.cultivation.realmOrdinal).sort((a, b) => b - a).join(', ')}]` : ''));

    // What a Void Refinement recruit would actually get if it did take one.
    if (members.length) {
        const lowest = members.reduce((m, n) =>
            n.cultivation.realmOrdinal < m.cultivation.realmOrdinal ? n : m);
        console.log(`  lowest member stands at ${lowest.cultivation.realmOrdinal}, ` +
            `rank ${lowest.factionRankIndex}, reachable ceiling ` +
            `${reachableCeilingFor(after, lowest) || BOOKLESS_CEILING}`);
    }
}
