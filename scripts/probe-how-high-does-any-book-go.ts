/**
 * How far up the ladder does the paper actually reach, and who holds the top of it?
 *
 * `manualCeilingOf` is a hard stop for every cultivator in the world and for the
 * player alike, so the catalog's highest `cap` is the highest rung anybody can be
 * standing on that they climbed to rather than fell into. If no cultivation art
 * reaches ordinal 44, then 44 is not reachable by anyone, in any number of
 * centuries, and the top of the ladder is decoration.
 *
 * Prints every `class: 'cultivation'` art with its cap, its requiredOrdinal, its
 * gate, and every faction that lists it on a `teaches` array - so "taught by
 * exactly one house" is a count rather than a claim.
 *
 * Run: npx tsx scripts/probe-how-high-does-any-book-go.ts
 */
import { TECHNIQUES } from '../src/data/cultivation/techniques.js';
import { SECTS } from '../src/data/cultivation/sects.js';
import { MAX_ORDINAL } from '../src/engine/cultivation/realms.js';
import { rankName } from '../src/engine/cultivation/realms.js';

const teachersOf = new Map<string, string[]>();
for (const s of SECTS as readonly any[]) {
    for (const id of (s.teaches ?? []) as string[]) {
        const list = teachersOf.get(id) ?? [];
        list.push(s.id);
        teachersOf.set(id, list);
    }
}

const roads = TECHNIQUES.filter(t => t.class === 'cultivation');

console.log(`cultivation-class arts: ${roads.length} of ${TECHNIQUES.length}\n`);
console.log(
    'cap'.padStart(4),
    'req'.padStart(4),
    'grade'.padEnd(8),
    'prov'.padEnd(8),
    'id'.padEnd(44),
    'gate'.padEnd(18),
    'taught by'
);
console.log('-'.repeat(140));

const sorted = [...roads].sort((a, b) => {
    const ca = a.cap === null ? MAX_ORDINAL + 1 : a.cap;
    const cb = b.cap === null ? MAX_ORDINAL + 1 : b.cap;
    return ca - cb || a.requiredOrdinal - b.requiredOrdinal;
});

for (const t of sorted) {
    const houses = teachersOf.get(t.id) ?? [];
    const gate = t.domain ? `${t.domain}:${t.domainDegree}` : '-';
    console.log(
        String(t.cap ?? 'null').padStart(4),
        String(t.requiredOrdinal).padStart(4),
        t.grade.padEnd(8),
        t.provenance.padEnd(8),
        t.id.padEnd(44),
        gate.padEnd(18),
        houses.length === 0 ? '(nobody)' : houses.join(', ')
    );
}

// ── THE ANSWER ──────────────────────────────────────────────────────────
// Uncapped is excluded from "highest reached": null means the band runs off
// the top of the ladder, and both books that carry it open at ordinal 46,
// which nobody in the world stands on. A ceiling nobody can open is not a
// ceiling anybody reaches.
const capped = roads.filter(t => t.cap !== null) as { id: string; cap: number }[];
const highest = capped.reduce((m, t) => Math.max(m, t.cap), 0);
const atHighest = capped.filter(t => t.cap === highest);
const at44 = capped.filter(t => t.cap === 44);
const taughtAtHighest = atHighest.filter(t => (teachersOf.get(t.id) ?? []).length > 0);

console.log('\n' + '='.repeat(72));
console.log(`highest cap among capped cultivation arts: ${highest}  (${rankName(highest)})`);
console.log(`arts reaching it: ${atHighest.length}`);
for (const t of atHighest) {
    console.log(`   ${t.id}  taught by ${(teachersOf.get(t.id) ?? []).join(', ') || '(nobody)'}`);
}
console.log(`arts capping at exactly 44: ${at44.length}`);
for (const t of at44) {
    console.log(`   ${t.id}  taught by ${(teachersOf.get(t.id) ?? []).join(', ') || '(nobody)'}`);
}
console.log(`of the arts at the highest cap, taught by a living house: ${taughtAtHighest.length}`);
console.log(`uncapped (band runs off the ladder): ${roads.filter(t => t.cap === null).map(t => `${t.id}@${t.requiredOrdinal}`).join(', ')}`);

// Every art above the Void Refinement line, and how many houses hold it. The
// documented fact in docs/world/items.md, recounted rather than quoted.
const aboveVoid = capped.filter(t => t.cap > 32);
const counts = aboveVoid.map(t => (teachersOf.get(t.id) ?? []).length);
console.log(
    `\nabove the Void Refinement line: ${aboveVoid.length} arts, ` +
    `houses teaching each = [${counts.join(', ')}]`
);

// ── THE CORRIDOR ────────────────────────────────────────────────────────
// "Is there a road to 44 at all" is not answered by the top of the catalog. It
// is answered rung by rung: standing at each ordinal, what is learnable, and
// does any of it carry further than here? A rung where the best learnable cap
// is not above the rung itself is where the climb stops for everybody.
console.log('\nTHE CORRIDOR, rung by rung');
console.log(' ord  best cap  taught-best  continuations (id@cap)');
for (let o = 29; o <= 44; o++) {
    const learnable = roads.filter(t => t.requiredOrdinal <= o && (t.cap === null || t.cap > o));
    const bestCap = learnable.reduce((m, t) => Math.max(m, t.cap ?? MAX_ORDINAL + 1), -1);
    const taught = learnable.filter(t => (teachersOf.get(t.id) ?? []).length > 0);
    const bestTaught = taught.reduce((m, t) => Math.max(m, t.cap ?? MAX_ORDINAL + 1), -1);
    console.log(
        String(o).padStart(4),
        String(bestCap).padStart(9),
        String(bestTaught).padStart(12),
        ' ' + learnable.map(t => `${t.id}@${t.cap ?? 'null'}`).join(' ')
    );
}
