/**
 * The Azure Cloud Pavilion teaches a road to the top of the ladder, its head
 * stands on the rung that opens it, and after three centuries she is not
 * holding it. Which clause of `newlyEntitled` refuses her?
 *
 * Run: npx tsx scripts/probe-can-the-pavilion-head-open-her-own-road.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { shelfOf, shelfReach, suitsRoot, newlyEntitled, admissionOffer } from '../src/engine/world/manuals.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'deep-road-probe', catalog });

const head = (state.npcs as any[])
    .filter(n => n.factionId === 'sect-azure-cloud-pavilion' && n.status === 'alive')
    .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal)[0];

const faction = state.factions.find(f => f.id === 'sect-azure-cloud-pavilion')!;
const shelf = shelfOf(state as any, faction.id);
const reach = head.tags.includes('chosen')
    ? shelf.length
    : shelfReach(head.factionRankIndex, faction.ranks.length, shelf.length);

console.log(`head: ord ${head.cultivation.realmOrdinal} rank#${head.factionRankIndex} of ${faction.ranks.length}`);
console.log(`root: ${head.cultivation.spiritRoot}   chosen: ${head.tags.includes('chosen')}`);
console.log(`admission offer: ${admissionOffer(faction.id, state.seed)}`);
console.log(`shelfReach: ${reach} of ${shelf.length}`);
console.log('\nclause by clause, per book on the shelf:');
for (const m of shelf.slice(0, reach)) {
    console.log(
        `  ${m.id.padEnd(34)} req<=ord ${m.requiredOrdinal <= head.cultivation.realmOrdinal}` +
        `  suitsRoot ${suitsRoot(head.cultivation.spiritRoot, m.element)}` +
        `  alreadyHeld ${head.cultivation.techniqueIds.includes(m.id)}`
    );
}
console.log(`\nnewlyEntitled -> ${JSON.stringify(newlyEntitled(state as any, head))}`);

// ── AND IS THAT THIS SEED, OR THE ROAD? ─────────────────────────────────
// Ru Anwei is authored in `members.ts` and her spirit root is not: the seeder
// rolls it. So "the head cannot read the house's own book" is either one
// unlucky roll or a property of putting an element on a road at this height,
// and the two want different answers. `conflictsWithRoot` refuses an element
// whenever the root carries what that element OVERCOMES, so a metal road is
// refused to every root carrying wood - which is most of them.
const SEEDS = Array.from({ length: 24 }, (_, i) => `sweep-${i}`);
let fits = 0;
const rootsSeen: string[] = [];
for (const s of SEEDS) {
    const w = seedWorld({ seed: s, catalog }).state;
    const h = (w.npcs as any[])
        .filter(n => n.factionId === 'sect-azure-cloud-pavilion' && n.status === 'alive')
        .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal)[0];
    if (!h) continue;
    rootsSeen.push(h.cultivation.spiritRoot);
    if (suitsRoot(h.cultivation.spiritRoot, 'metal')) fits++;
}
console.log(`\nacross ${rootsSeen.length} seeds, the Pavilion's strongest member can read a METAL road ` +
    `${fits} times (${(100 * fits / rootsSeen.length).toFixed(0)}%)`);
console.log(`roots rolled: ${[...new Set(rootsSeen)].join(', ')}`);
