/**
 * Who is standing at the end of everything they can reach, and how high?
 *
 * Nobody in a simulated world has ever crossed above rung 28, so the entire
 * upper ladder is seeded survivors and the world is terminal at the top: run it
 * long enough and there is nothing above Qi Condensation. The design's answer to
 * a capped cultivator is the acquisition routes - a later volume, a teacher
 * above you, a house's shelf, writing one yourself - and the world layer uses
 * none of them.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { reachableCeilingFor, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'capped', catalog });
state = advanceWorldYears(state, 300).state;

const alive = state.npcs.filter(n => n.status === 'alive');
const capped = alive.filter(n => {
    const c = reachableCeilingFor(state, n) || BOOKLESS_CEILING;
    return n.cultivation.realmOrdinal >= c;
});
console.log(`living ${alive.length}, standing at their own ceiling: ${capped.length}`);
const byOrd = new Map<number, number>();
for (const n of capped) byOrd.set(n.cultivation.realmOrdinal, (byOrd.get(n.cultivation.realmOrdinal) ?? 0) + 1);
console.log('  at which ordinal: ' + [...byOrd].sort((a, b) => a[0] - b[0])
    .map(([o, k]) => `${o}:${k}`).join('  '));
const above12 = capped.filter(n => n.cultivation.realmOrdinal >= 13);
console.log(`  capped at 13 or above - the ones a route would actually matter to: ${above12.length}`);
const inHouse = above12.filter(n => n.factionId).length;
console.log(`  of those, in a house: ${inHouse}   unbacked: ${above12.length - inHouse}`);

// What the world's shelves could offer them if anything could reach past a shelf.
const { TECHNIQUES } = await import('../src/data/cultivation/techniques.js');
const roads = (TECHNIQUES as any[]).filter(t => t.class === 'cultivation' && t.cap != null);
console.log(`\n  cultivation manuals in the catalog: ${roads.length}`);
for (const lo of [21, 29, 37, 41]) {
    console.log(`    capping above ${lo}: ${roads.filter(t => Number(t.cap) > lo).length}`);
}
