/**
 * Why does anybody inside a house hold no book?
 *
 * A house exists to teach. 126 of its members holding no road at all is either
 * a gate nobody can pass or a rule with a deadlock in it.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { manualCeilingOf, admissionOffer, newlyEntitled } from '../src/engine/world/manuals.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'bookless', catalog });
state = advanceWorldYears(state, 300).state;

const alive = state.npcs.filter(n => n.status === 'alive');
const inHouse = alive.filter(n => n.factionId);
const bookless = inHouse.filter(n => manualCeilingOf(n) === 0);
console.log(`in a house: ${inHouse.length}, of whom holding no road: ${bookless.length}`);

const byOffer = new Map<string, number>();
const byRank = new Map<number, number>();
for (const n of bookless) {
    const offer = admissionOffer(n.factionId!, state.seed);
    byOffer.set(offer, (byOffer.get(offer) ?? 0) + 1);
    byRank.set(n.factionRankIndex, (byRank.get(n.factionRankIndex) ?? 0) + 1);
}
console.log('  by what their house offers on admission: '
    + [...byOffer].map(([k, v]) => `${k}:${v}`).join('  '));
console.log('  by rank: ' + [...byRank].sort((a, b) => a[0] - b[0]).map(([r, v]) => `${r}:${v}`).join('  '));

let wouldGet = 0;
for (const n of bookless) if (newlyEntitled(state, n).length > 0) wouldGet++;
console.log(`  who WOULD be handed something if asked right now: ${wouldGet} of ${bookless.length}`);

const teacherHouses = new Set(inHouse.map(n => n.factionId!)
    .filter(f => admissionOffer(f, state.seed) === 'a_teacher'));
console.log(`\n  houses that teach in person rather than handing over a book: ${teacherHouses.size}`);
const inTeacherHouses = inHouse.filter(n => teacherHouses.has(n.factionId!));
console.log(`  members of those houses: ${inTeacherHouses.length}, `
    + `of whom bookless: ${inTeacherHouses.filter(n => manualCeilingOf(n) === 0).length}`);
console.log(`  and at rank 0 (never promoted, so never entitled): `
    + `${inTeacherHouses.filter(n => n.factionRankIndex === 0 && manualCeilingOf(n) === 0).length}`);
