/**
 * Why does nobody cross into Foundation Establishment?
 *
 * Measured over 500 years: the bands from 13 to 32 all fall to ZERO, while ~347
 * cultivators sit in Qi Condensation and 138 are still mortal. The world is not
 * ageing into a thin top - it is failing to promote anybody out of the bottom
 * realm at all, and the ancients above are seeded survivors.
 *
 * Ordinal 12 -> 13 is the first realm crossing. This asks what is standing in
 * the way for the people actually queued at it.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { manualCeilingOf, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'population-shape', catalog });
state = advanceWorldYears(state, 300).state;

const alive = state.npcs.filter(n => n.status === 'alive');
const qi = alive.filter(n => n.cultivation.realmOrdinal >= 1 && n.cultivation.realmOrdinal <= 12);
console.log(`living ${alive.length}, of whom ${qi.length} stand inside Qi Condensation`);

const atTop = qi.filter(n => n.cultivation.realmOrdinal >= 10);
console.log(`  at ordinal 10-12, i.e. queued at the first crossing: ${atTop.length}`);

const ceilHist = new Map<number, number>();
for (const n of qi) { const c = manualCeilingOf(n); ceilHist.set(c, (ceilHist.get(c) ?? 0) + 1); }
console.log('  their manual ceilings: '
    + [...ceilHist].sort((a, b) => a[0] - b[0]).map(([c, k]) => `${c || 'none'}:${k}`).join('  '));

const capped = qi.filter(n => {
    const c = manualCeilingOf(n) || BOOKLESS_CEILING;
    return n.cultivation.realmOrdinal >= c;
});
console.log(`  standing AT their own ceiling already: ${capped.length} of ${qi.length}`);

const couldGoFurther = qi.filter(n => {
    const c = manualCeilingOf(n) || BOOKLESS_CEILING;
    return c > 12;
});
console.log(`  holding a book that reaches PAST 12 at all: ${couldGoFurther.length}`);

const inHouse = qi.filter(n => n.factionId).length;
console.log(`  in a house: ${inHouse}   unbacked: ${qi.length - inHouse}`);

console.log('\nAnd the ordinal histogram inside Qi Condensation:');
const ord = new Map<number, number>();
for (const n of qi) ord.set(n.cultivation.realmOrdinal, (ord.get(n.cultivation.realmOrdinal) ?? 0) + 1);
console.log('  ' + [...ord].sort((a, b) => a[0] - b[0]).map(([o, k]) => `${o}:${k}`).join('  '));

// ── Is the life-walk refusing to move people it thinks are already too high? ──
//
// `applyAdvancement` recomputes an ordinal with `deriveOrdinal` - a walk of a
// whole life from scratch - and keeps it only if it BEATS what the NPC already
// has. The walk does not know where they are standing; it answers "where would
// somebody of this talent and this age be". Anybody sitting above that answer
// is frozen: the walk keeps returning a number lower than their own and the
// comparison keeps rejecting it.
const { deriveOrdinal } = await import('../src/engine/world/seeding.js');
const { forStream } = await import('../src/engine/cultivation/rng.js');
const region = (state.locations as any[]).find(l => l.kind === 'region');
const ceilingOf = (n: any) => Math.min(
    Number(region?.data.localCeilingOrdinal ?? 20),
    manualCeilingOf(n) || BOOKLESS_CEILING
);

let frozen = 0, movable = 0;
const gaps: number[] = [];
for (const n of qi) {
    const age = Math.floor((state.currentDay - n.identity.bornOnDay) / 365);
    const d = deriveOrdinal(n.cultivation.spiritRoot, n.cultivation.attributes, age,
        Number(region?.data.ambientRateMultiplier ?? 1), ceilingOf(n),
        forStream(state.seed, 'advance-npc', n.id));
    if (d <= n.cultivation.realmOrdinal) { frozen++; gaps.push(n.cultivation.realmOrdinal - d); }
    else movable++;
}
console.log(`\nTHE WALK VERSUS WHERE THEY STAND`);
console.log(`  frozen - the walk returns no better than where they already are: ${frozen}`);
console.log(`  movable                                                        : ${movable}`);
if (gaps.length > 0) {
    gaps.sort((a, b) => a - b);
    console.log(`  how far ABOVE the walk's answer the frozen ones stand: `
        + `median ${gaps[Math.floor(gaps.length / 2)]}, max ${gaps[gaps.length - 1]}`);
}
