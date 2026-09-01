/**
 * Can a house's shelf GROW while the world runs, or is it fixed at the catalog?
 *
 * The whole acquisition model - a neutral house paying a defector for the road
 * they walked in with, a righteous house being given one, a demonic house
 * shelving what it took - needs one thing to be true: that a road can join a
 * shelf after seeding, without a field being added to the faction record.
 *
 * `shelfOf` says it is "the catalog's statement UNION what the house is
 * holding", and `seedSectLibraries` writes those holdings into `state.objects`.
 * If that is right, then bringing a road to a house is one ordinary object row
 * and nothing else - and the shelf index picks it up because it invalidates on
 * `state.objects.length`.
 *
 * This checks it rather than reading it, because "the shelf is the union" is
 * exactly the kind of sentence that is true of the function and false of the
 * cache in front of it.
 *
 * Run: npx tsx scripts/probe-can-a-road-join-a-shelf-at-runtime.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { shelfOf, libraryObjectId, manualCeilingOf, reachableCeilingFor } from '../src/engine/world/manuals.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'shelf-growth', catalog });

// A house with a shallow shelf, and a road it has never held. The Sixmile
// Wardens teach one primer and stop; `verdant-longevity-canon` is the Verdant
// Spring Hall's wood road and carries to 17.
const HOUSE = 'sect-sixmile-wardens';
const INCOMING = 'verdant-longevity-canon';

const before = shelfOf(state as any, HOUSE);
console.log(`${HOUSE} shelf before: ${before.length} road(s)`);
for (const m of before) console.log(`   req ${m.requiredOrdinal} cap ${m.cap}  ${m.id}`);

// Exactly what a defector arriving with their road would be: one library row,
// possessed by the house, using the id the module already mints for holdings.
//
// THE POSSESSOR FIELD IS THE ONE THAT MATTERS and getting it wrong is silent.
// `shelvesOf` keys its index on `possessorId` and skips any manual row whose
// `possessorId` is null, so a first draft of this probe that set
// `possessorFactionId` instead reported that the shelf could not grow at all -
// a clean false negative that would have killed the whole acquisition model on
// a typo. `seedSectLibraries` puts the FACTION id in `possessorId`, and that is
// what a holding is.
state.objects.push({
    id: libraryObjectId(HOUSE, INCOMING),
    name: 'Verdant Longevity Canon',
    kind: 'manual',
    significance: 'notable',
    possessorId: HOUSE,
    ownerId: HOUSE,
    locationId: null,
    createdOnDay: state.currentDay,
    data: { techniqueId: INCOMING, cap: 17, copies: 1 },
    tags: []
} as any);

const after = shelfOf(state as any, HOUSE);
console.log(`\n${HOUSE} shelf after adding one object row: ${after.length} road(s)`);
for (const m of after) console.log(`   req ${m.requiredOrdinal} cap ${m.cap}  ${m.id}`);

const grew = after.length > before.length;
console.log(`\nshelf grew without a schema change: ${grew}${grew ? '' : '  <-- the model does not work'}`);

// And does it reach the people? A shelf that grew but changes nobody's ceiling
// is the same defect as a road held by nobody.
const members = (state.npcs as any[]).filter(n => n.factionId === HOUSE && n.status === 'alive');
console.log(`\nmembers of ${HOUSE}: ${members.length}`);
for (const n of members.slice(0, 6)) {
    console.log(
        `   ord ${String(n.cultivation.realmOrdinal).padStart(2)} rank#${n.factionRankIndex} ` +
        `root=${String(n.cultivation.spiritRoot).padEnd(28)} ` +
        `holds-ceiling ${manualCeilingOf(n)}  reachable ${reachableCeilingFor(state as any, n)}`
    );
}
