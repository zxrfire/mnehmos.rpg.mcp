/**
 * Which houses hold a shelf that stops below the people standing in them.
 *
 * Not a root mismatch. These are members who CAN walk their house's road and
 * are standing above where it ends - the dead zone `manuals.ts` documents in
 * `newlyEntitled`, seen per house instead of in aggregate. A house in this
 * state cannot advance its own seniors whatever they do, and the only cures are
 * a deeper book or leaving.
 *
 * Prints two views, because they answer different questions:
 *   CATALOG   deepest road on the shelf against what the house has produced.
 *             A statement about the institution, stable across seeds.
 *   SEEDED    living members standing above every road of theirs they can
 *             actually read. A count of affected people.
 *
 * Run: npx tsx scripts/probe-which-shelves-stop-below-their-own-people.ts
 */
import { SECTS } from '../src/data/cultivation/sects.js';
import { FACTION_CHARACTER } from '../src/data/cultivation/faction-character.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { suitsRoot } from '../src/engine/world/manuals.js';

const roadsOf = (teaches: readonly string[]) =>
    teaches.map(id => getTechnique(id)).filter((t): t is any =>
        !!t && t.class === 'cultivation' && t.cap != null);

console.log('CATALOG VIEW - the shelf against what the house has produced');
console.log('deepest  peak  power  short by  house');
console.log('-'.repeat(78));
const short: { id: string; by: number }[] = [];
for (const s of SECTS as readonly any[]) {
    const roads = roadsOf(s.teaches ?? []);
    if (roads.length === 0) continue;
    const deepest = Math.max(...roads.map(t => Number(t.cap)));
    const peak = (FACTION_CHARACTER as any)[s.id]?.production?.peakOrdinal ?? s.powerOrdinal;
    const by = peak - deepest;
    if (by <= 0) continue;
    short.push({ id: s.id, by });
    console.log(
        String(deepest).padStart(7),
        String(peak).padStart(5),
        String(s.powerOrdinal).padStart(6),
        String(by).padStart(9),
        ' ' + s.id
    );
}
console.log(`\n${short.length} houses hold a shelf that stops below their own peak, ` +
    `worst short by ${short.length ? Math.max(...short.map(x => x.by)) : 0} rungs`);

// ── SEEDED VIEW ─────────────────────────────────────────────────────────
const catalog = await loadCultivationCatalog();
let stranded = 0;
const perHouse = new Map<string, number>();
for (const seed of ['gap-a', 'gap-b', 'gap-c', 'gap-d', 'gap-e']) {
    const { state } = seedWorld({ seed, catalog });
    for (const npc of state.npcs as any[]) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        const sect = (SECTS as readonly any[]).find(s => s.id === npc.factionId);
        if (!sect) continue;
        const walkable = roadsOf(sect.teaches ?? [])
            .filter(t => suitsRoot(npc.cultivation.spiritRoot, t.element ?? null));
        if (walkable.length === 0) continue;             // a root problem, not a shelf problem
        const best = Math.max(...walkable.map(t => Number(t.cap)));
        if (npc.cultivation.realmOrdinal <= best) continue;
        stranded++;
        perHouse.set(sect.id, (perHouse.get(sect.id) ?? 0) + 1);
    }
}
console.log(`\nSEEDED VIEW - across 5 worlds, members standing above every road they can read: ${stranded}`);
for (const [id, n] of [...perHouse.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${id}`);
}

// ── AND MOST OF THAT LIST IS NOT A DEFECT ───────────────────────────────
//
// `manuals.md` is explicit: a gap ABOVE a shelf is normal and expected. "A
// patriarch standing at 38 whose house's best manual stops at 36 is not
// evidence of a broken shelf" - their book carried them to their realm's
// perfection, which is the whole of what a complete book does, and the rungs
// past it came from a ruin, an inheritance or a lucky encounter. Every house
// short by one or two rungs is that sentence, not a hole.
//
// A `peakOrdinal` can also be a single historical figure rather than a
// pipeline. The Sweptground Temple reads short by 21 because an abbot crossed
// from it two and a half thousand years ago; the shelf is not failing to
// reproduce him.
//
// What IS a defect is a house whose deepest road is a PRIMER while it goes on
// producing people far above one - there the shelf is not a ladder with a gap
// at the top, it is a doorstep.
console.log('\nTHE OUTLIERS - deepest road at or below Foundation, against a peak well past it');
console.log('deepest  peak  short by  house');
for (const s of SECTS as readonly any[]) {
    const roads = roadsOf(s.teaches ?? []);
    if (roads.length === 0) continue;
    const deepest = Math.max(...roads.map(t => Number(t.cap)));
    const peak = (FACTION_CHARACTER as any)[s.id]?.production?.peakOrdinal ?? s.powerOrdinal;
    // A shelf that stops at or below Foundation while the house makes people a
    // realm or more above it. The bar is deliberately blunt.
    if (deepest > 21 || peak - deepest < 8) continue;
    console.log(
        String(deepest).padStart(7),
        String(peak).padStart(5),
        String(peak - deepest).padStart(9),
        ' ' + s.id
    );
}
console.log('\n(everything else on the catalog list is a gap of a few rungs above a complete\n' +
    ' book, which manuals.md says is the ordinary case and not a hole)');
