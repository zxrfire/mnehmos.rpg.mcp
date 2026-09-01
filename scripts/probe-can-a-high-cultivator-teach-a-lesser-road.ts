/**
 * Can somebody at the top of the ladder teach an ordinary road, or only the one
 * they personally walk?
 *
 * `teachableIn` in `manuals.ts` is the world's whole transmission rule, and it
 * keys on `other.cultivation.techniqueIds` - the arts a person HOLDS. So a
 * cultivator at 44 can carry a disciple through a road only if that exact road
 * is in their own hands. Nothing anywhere says "you have stood above every rung
 * this book covers, so you can teach it".
 *
 * The design claim being tested: somebody at the top is not restricted to their
 * own deep road. They climbed through every rung below them and know it, so a
 * Hollow Court seat taking a Foundation disciple can teach an ordinary art, and
 * is better at it than whoever normally would.
 *
 * If people accumulate the shallow roads as they climb, the rule already allows
 * this and the gap is presentational. If they hold only their deepest, then the
 * entire top of the ladder is structurally unable to teach anything ordinary.
 *
 * Run: npx tsx scripts/probe-can-a-high-cultivator-teach-a-lesser-road.ts
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { shelfOf } from '../src/engine/world/manuals.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'lesser-roads', catalog });
const after = advanceWorldYears(state, 300).state as any;
const alive = (after.npcs as any[]).filter(n => n.status === 'alive');

const roadsHeldBy = (n: any): string[] => (n.cultivation.techniqueIds as string[])
    .filter(id => { const t = getTechnique(id); return !!t && t.class === 'cultivation'; });

console.log('HOW MANY CULTIVATION ROADS A PERSON HOLDS, BY BAND');
console.log('band     n    mean roads held   hold exactly 1   hold 0');
for (const [lo, hi] of [[0,12],[13,16],[17,20],[21,24],[25,28],[29,32],[33,44]]) {
    const band = alive.filter(n => n.cultivation.realmOrdinal >= lo && n.cultivation.realmOrdinal <= hi);
    if (!band.length) continue;
    const counts = band.map(roadsHeldBy).map(r => r.length);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    console.log(
        (lo + '-' + hi).padEnd(8),
        String(band.length).padStart(4),
        mean.toFixed(2).padStart(15),
        String(counts.filter(c => c === 1).length).padStart(16),
        String(counts.filter(c => c === 0).length).padStart(8)
    );
}

// ── WHAT THE TOP OF THE LADDER CAN ACTUALLY TEACH ───────────────────────
console.log('\nEVERYBODY AT 29 OR ABOVE: WHAT THEY HOLD AND WHAT THEIR HOUSE SHELVES');
console.log(' ord  house                       holds  shelf  can teach  the roads they hold');
for (const n of alive.filter(x => x.cultivation.realmOrdinal >= 29)
    .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal)) {
    const held = roadsHeldBy(n);
    const shelf = n.factionId ? shelfOf(after, n.factionId) : [];
    // The existing rule: they can teach a shelf road only if they hold it AND
    // stand at or above its opening.
    const canTeach = shelf.filter(m => held.includes(m.id)
        && n.cultivation.realmOrdinal >= m.requiredOrdinal);
    console.log(
        String(n.cultivation.realmOrdinal).padStart(4),
        (n.factionId ?? '(rogue)').padEnd(28),
        String(held.length).padStart(5),
        String(shelf.length).padStart(6),
        String(canTeach.length).padStart(10),
        ' ' + held.join(', ')
    );
}

// ── THE COUNTERFACTUAL ──────────────────────────────────────────────────
// What the same people COULD teach under the design claim: any road on their
// house's shelf whose whole span sits at or below where they stand, because
// they climbed through all of it.
console.log('\nWHAT WOULD CHANGE IF STANDING ABOVE A ROAD MEANT YOU COULD TEACH IT');
let nowTotal = 0, thenTotal = 0, people = 0;
for (const n of alive) {
    if (!n.factionId) continue;
    const held = roadsHeldBy(n);
    const shelf = shelfOf(after, n.factionId);
    if (shelf.length === 0) continue;
    const now = shelf.filter(m => held.includes(m.id)
        && n.cultivation.realmOrdinal >= m.requiredOrdinal).length;
    const then = shelf.filter(m => held.includes(m.id)
        ? n.cultivation.realmOrdinal >= m.requiredOrdinal
        : n.cultivation.realmOrdinal >= m.cap).length;
    nowTotal += now; thenTotal += then; people++;
}
console.log(`  ${people} affiliated living cultivators`);
console.log(`  roads teachable under the current rule : ${nowTotal}`);
console.log(`  roads teachable if climbing counted     : ${thenTotal}`);

// And the number that matters: how many houses gain a teacher for a road that
// currently has none anywhere in the building.
const gained: string[] = [];
for (const f of (after.factions as any[])) {
    if (f.dissolvedOnDay !== null) continue;
    const members = alive.filter(n => n.factionId === f.id);
    const shelf = shelfOf(after, f.id);
    for (const m of shelf) {
        const teachableNow = members.some(n => roadsHeldBy(n).includes(m.id)
            && n.cultivation.realmOrdinal >= m.requiredOrdinal);
        const teachableThen = teachableNow
            || members.some(n => n.cultivation.realmOrdinal >= m.cap);
        if (!teachableNow && teachableThen) gained.push(`${f.id} / ${m.id}`);
    }
}
console.log(`\n  house-road pairs with NO teacher now that would gain one: ${gained.length}`);
for (const g of gained.slice(0, 25)) console.log(`     ${g}`);
