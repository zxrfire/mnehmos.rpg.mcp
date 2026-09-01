/**
 * What is actually on each house's shelf, and how far up it a person gets.
 *
 * `teaches` is one flat list mixing cultivation roads with the dao arts a house
 * fights with, so "the Pavilion teaches nine things" says nothing about how
 * many CAREERS it offers. Only the cultivation-class rows are a road; the rest
 * are what you do once you are on one.
 *
 * The four things this prints are the four the shelf has to express:
 *   ROADS       how many cultivation-class books, and what each caps at
 *   PRIMARY     the deepest road, which is the career the house is actually for
 *   SECONDARY   every road that stops short of it, and by how much
 *   SPREAD      how many houses hold each road, which is the exclusivity band
 *
 * Run: npx tsx scripts/probe-what-each-house-has-to-teach.ts
 */
import { SECTS } from '../src/data/cultivation/sects.js';
import { TECHNIQUES, getTechnique } from '../src/data/cultivation/techniques.js';
import { tierOf } from '../src/data/cultivation/governance-and-water-rights.js';

const roadsOf = (teaches: readonly string[]) =>
    teaches
        .map(id => getTechnique(id))
        .filter((t): t is NonNullable<typeof t> => !!t && t.class === 'cultivation');

const holders = new Map<string, string[]>();
for (const s of SECTS as readonly any[]) {
    for (const t of roadsOf(s.teaches ?? [])) {
        holders.set(t.id, [...(holders.get(t.id) ?? []), s.id]);
    }
}

console.log('EVERY HOUSE, ITS ROADS, AND WHERE EACH ONE STOPS');
console.log('roads dao  power tier  house                          primary  secondaries (cap, element)');
console.log('-'.repeat(132));

const rows = (SECTS as readonly any[]).map(s => {
    const roads = roadsOf(s.teaches ?? []);
    const caps = roads.map(t => t.cap ?? 99);
    return { s, roads, top: caps.length ? Math.max(...caps) : -1 };
}).sort((a, b) => b.top - a.top || b.roads.length - a.roads.length);

for (const { s, roads, top } of rows) {
    const dao = (s.teaches ?? []).length - roads.length;
    const primary = roads.filter(t => (t.cap ?? 99) === top);
    const secondary = roads.filter(t => (t.cap ?? 99) < top);
    console.log(
        String(roads.length).padStart(5),
        String(dao).padStart(3),
        String(s.powerOrdinal).padStart(6),
        String(tierOf(s.id)).padStart(4),
        ' ' + s.id.padEnd(30),
        String(top).padStart(7),
        ' ' + (secondary.length
            ? secondary.map(t => `${t.id}@${t.cap}/${t.element ?? '-'}`).join(' ')
            : '(none - one road only)')
    );
    if (primary.length > 1) {
        console.log(' '.repeat(60) + `  NOTE ${primary.length} roads tie at the top: ` +
            primary.map(t => `${t.id}/${t.element ?? '-'}`).join(' '));
    }
}

// ── EXCLUSIVITY AGAINST HEIGHT ──────────────────────────────────────────
// "It is more rare as we go" is a claim about the shape of this table, not
// about any one row. If it holds, houses-per-road falls monotonically as cap
// rises, and reaches one at the top.
console.log('\nHOW MANY HOUSES HOLD A ROAD, BY WHAT THE ROAD CARRIES');
console.log('  cap  roads  houses-per-road (min..max)  mean');
const byCap = new Map<number, number[]>();
for (const t of TECHNIQUES.filter(t => t.class === 'cultivation')) {
    const n = (holders.get(t.id) ?? []).length;
    const cap = t.cap ?? 99;
    byCap.set(cap, [...(byCap.get(cap) ?? []), n]);
}
for (const cap of [...byCap.keys()].sort((a, b) => a - b)) {
    const ns = byCap.get(cap)!;
    const mean = ns.reduce((a, b) => a + b, 0) / ns.length;
    console.log(
        String(cap).padStart(5),
        String(ns.length).padStart(6),
        `${Math.min(...ns)}..${Math.max(...ns)}`.padStart(28),
        mean.toFixed(2).padStart(6)
    );
}

console.log('\nROADS NO HOUSE TEACHES AT ALL');
for (const t of TECHNIQUES.filter(t => t.class === 'cultivation')) {
    if ((holders.get(t.id) ?? []).length === 0) {
        console.log(`  ${t.id.padEnd(40)} cap ${String(t.cap ?? 'null').padStart(4)}  ${t.provenance}`);
    }
}

// ── THE COUNTING RULE, MEASURED THE RIGHT WAY ───────────────────────────
//
// The table above averages houses-per-road across every road at a cap,
// INCLUDING the ruin and grave roads no house teaches at all. That drags the
// mean toward zero wherever untaught books cluster, which is the top - so it
// reported cap 25 as the most widely held band in the world (13.00) and cap 33
// as rarer than cap 45. Both are artifacts of dividing by roads nobody holds.
//
// "It is more rare as we go" is a claim about how widely the MOST widely held
// road at each height is held. That is the maximum, over taught roads only, and
// it has to be non-increasing.
console.log('\nTHE COUNTING RULE: the most widely held road at each height');
console.log('  cap  taught roads  widest hold  the road that is held widest');
let previous = Infinity;
const breaks: string[] = [];
for (const cap of [...byCap.keys()].sort((a, b) => a - b)) {
    const taught = TECHNIQUES
        .filter(t => t.class === 'cultivation' && (t.cap ?? 99) === cap)
        .map(t => ({ id: t.id, n: (holders.get(t.id) ?? []).length }))
        .filter(x => x.n > 0);
    if (taught.length === 0) continue;
    const widest = taught.reduce((m, x) => (x.n > m.n ? x : m));
    if (widest.n > previous) breaks.push(`cap ${cap} (${widest.n}) is held more widely than the band below it (${previous})`);
    previous = widest.n;
    console.log(
        String(cap).padStart(5),
        String(taught.length).padStart(13),
        String(widest.n).padStart(12),
        ' ' + widest.id
    );
}
console.log(breaks.length ? `\n  RULE BROKEN: ${breaks.join('; ')}` : '\n  rule holds: non-increasing all the way up');

// ── DOES ALIGNMENT ALREADY SHOW IN THE SHELF? ───────────────────────────
//
// The claim to test: a righteous house teaches a lineage - narrow and deep -
// and a demonic house teaches a trophy cabinet, wide and root-incoherent,
// because it took what it holds off bodies. Width is countable. Incoherence is
// countable too: how many DISTINCT elements the shelf spans, where elementless
// counts as no element at all rather than as one more.
console.log('\nSHELF SHAPE BY ALIGNMENT');
const byAlign = new Map<string, { roads: number[]; elems: number[]; depth: number[] }>();
for (const s of SECTS as readonly any[]) {
    const r = roadsOf(s.teaches ?? []);
    if (r.length === 0) continue;
    const distinctElements = new Set(r.map(t => t.element).filter(e => e !== null)).size;
    const bucket = byAlign.get(s.alignment) ?? { roads: [], elems: [], depth: [] };
    bucket.roads.push(r.length);
    bucket.elems.push(distinctElements);
    bucket.depth.push(Math.max(...r.map(t => t.cap ?? 99)));
    byAlign.set(s.alignment, bucket);
}
const mean = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
console.log('alignment    houses  mean roads  mean distinct elements  mean deepest cap');
for (const [a, b] of byAlign) {
    console.log(
        a.padEnd(12),
        String(b.roads.length).padStart(6),
        mean(b.roads).padStart(11),
        mean(b.elems).padStart(23),
        mean(b.depth).padStart(17)
    );
}

console.log('\nEVERY DEMONIC SHELF, ROAD BY ROAD');
for (const s of (SECTS as readonly any[]).filter(x => x.alignment === 'demonic')) {
    const r = roadsOf(s.teaches ?? []);
    console.log(`  ${s.id} (power ${s.powerOrdinal})`);
    for (const t of [...r].sort((a, b) => (a.cap ?? 99) - (b.cap ?? 99))) {
        console.log(`     cap ${String(t.cap ?? 'null').padStart(4)}  ${(t.element ?? 'elementless').padEnd(12)}` +
            `  held by ${String((holders.get(t.id) ?? []).length).padStart(2)} houses  ${t.id}`);
    }
}
