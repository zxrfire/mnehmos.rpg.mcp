/**
 * The Pavilion teaches a road to the top of the ladder and not one of its
 * people is holding it. Which of the four gates is the one that closed?
 *
 * `manuals.ts` seeds a house's shelf, then hands copies out by rank reach,
 * root suitability and the manual's own `requiredOrdinal`. Any of those four
 * can produce "the house teaches it and nobody has it", and they are different
 * defects with different fixes, so this prints them separately rather than
 * reporting the zero.
 *
 * Run: npx tsx scripts/probe-why-nobody-holds-the-deep-roads.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { shelfOf, manualCeilingOf, admissionOffer } from '../src/engine/world/manuals.js';
import { THE_DEEPEST_ROADS } from '../src/data/cultivation/roads-to-the-top-of-the-ladder.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'deep-road-probe', catalog });

for (const r of THE_DEEPEST_ROADS) {
    const faction = state.factions.find(f => f.id === r.factionId);
    console.log(`\n${r.factionId}  (${r.techniqueId})`);
    if (!faction) {
        console.log('  NO FACTION RECORD IN THE WORLD. Nothing can hold this road.');
        continue;
    }
    const shelf = shelfOf(state as any, faction.id);
    console.log(`  ranks: ${faction.ranks.length}   admission offer: ${admissionOffer(faction.id, state.seed)}`);
    console.log(`  shelf (${shelf.length}):`);
    for (const m of shelf) {
        console.log(`     req ${String(m.requiredOrdinal).padStart(2)} cap ${String(m.cap).padStart(3)}  ${m.element ?? '-'}  ${m.id}`);
    }
    const members = (state.npcs as any[]).filter(n => n.factionId === faction.id && n.status === 'alive');
    console.log(`  living members: ${members.length}`);
    const byOrd = [...members].sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal);
    for (const n of byOrd.slice(0, 8)) {
        console.log(
            `     ord ${String(n.cultivation.realmOrdinal).padStart(2)} rank#${n.factionRankIndex} ` +
            `root=${n.cultivation.spiritRoot} ceiling=${manualCeilingOf(n)} ` +
            `holds=[${n.cultivation.techniqueIds.join(', ')}]`
        );
    }
    console.log(`  members at or above the road's requiredOrdinal: ` +
        `${members.filter(n => n.cultivation.realmOrdinal >= 41).length}`);
    console.log(`  members holding the road: ${members.filter(n => n.cultivation.techniqueIds.includes(r.techniqueId)).length}`);
}
