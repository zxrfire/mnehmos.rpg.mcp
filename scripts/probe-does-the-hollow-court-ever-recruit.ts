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
import { ageInYears } from '../src/engine/world/npc-state.js';

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

    // And the pool it could draw from. BOTH CONDITIONS, because the age cap is
    // the whole of the Court's selectivity: 29+ says they are strong enough,
    // and 250 or under says they got there fast enough to have any chance of
    // reaching the Lid before their years run out. It is a rate test wearing an
    // age limit, and measuring the rung alone overstates the pool enormously.
    const COURT_MAX_AGE = 250;
    const byRung = (after.npcs as any[]).filter(n =>
        n.status === 'alive' && n.factionId !== COURT && n.cultivation.realmOrdinal >= 29);
    const pool = byRung.filter(n => ageInYears(n, after.currentDay) <= COURT_MAX_AGE);

    console.log(`\nseed ${seed}`);
    console.log(`  admission ordinal ${house?.resources?.admission_ordinal}, ranks ${house?.ranks?.length}, ` +
        `offer ${admissionOffer(COURT, state.seed)}, shelf ${shelfOf(state as any, COURT).length}`);
    console.log(`  members at seeding: ${before.length}  [${before.map(n => n.cultivation.realmOrdinal).join(', ')}]`);
    console.log(`  dissolved by ${YEARS}y: ${afterHouse?.dissolvedOnDay !== null}`);
    console.log(`  members after ${YEARS}y: ${members.length}  ` +
        `[${members.map(n => n.cultivation.realmOrdinal).join(', ')}]`);
    console.log(`    born into it during the run : ${arrived.length}`);
    console.log(`    RECRUITED from another house: ${transferred.length}`);
    console.log(`  at 29+ and not in it:            ${byRung.length}  ` +
        `[${byRung.map(n => n.cultivation.realmOrdinal).sort((a, b) => b - a).join(', ')}]`);
    console.log(`  of those, aged ${COURT_MAX_AGE} or under: ${pool.length}` +
        (pool.length
            ? `  [${pool.map(n => `${n.cultivation.realmOrdinal}@${ageInYears(n, after.currentDay)}y`).join(', ')}]`
            : '   <- the door is narrow by design, and nobody clears it'));
    const ages = byRung.map(n => ageInYears(n, after.currentDay)).sort((a, b) => a - b);
    if (ages.length) {
        console.log(`  ages of the 29+ pool: youngest ${ages[0]}, median ` +
            `${ages[Math.floor(ages.length / 2)]}, oldest ${ages[ages.length - 1]}`);
    }

    // What a Void Refinement recruit would actually get if it did take one.
    if (members.length) {
        const lowest = members.reduce((m, n) =>
            n.cultivation.realmOrdinal < m.cultivation.realmOrdinal ? n : m);
        console.log(`  lowest member stands at ${lowest.cultivation.realmOrdinal}, ` +
            `rank ${lowest.factionRankIndex}, reachable ceiling ` +
            `${reachableCeilingFor(after, lowest) || BOOKLESS_CEILING}`);
    }
}
