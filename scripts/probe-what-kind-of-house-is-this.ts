/**
 * The axes a shelf could be fitted to, printed together so "dependent on
 * faction type" can be a rule rather than a taste.
 *
 * There is no `type` field on a sect and there should not be one - what kind of
 * institution something is falls out of things it already declares. This prints
 * the candidates side by side: whether it recruits, what its admission bar is,
 * how deep its rank ladder runs, its alignment, its governance tier, its
 * declared specialities, and how many roads it currently teaches.
 *
 * Run: npx tsx scripts/probe-what-kind-of-house-is-this.ts
 */
import { SECTS, SECT_ADMISSION } from '../src/data/cultivation/sects.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';
import { tierOf } from '../src/data/cultivation/governance-and-water-rights.js';

const roads = (teaches: readonly string[]) =>
    teaches.map(id => getTechnique(id)).filter((t): t is any => !!t && t.class === 'cultivation');

console.log('rec adm ranks tier align      roads elem  power  specialities            house');
console.log('-'.repeat(120));
for (const s of [...(SECTS as readonly any[])].sort((a, b) => b.powerOrdinal - a.powerOrdinal)) {
    const r = roads(s.teaches ?? []);
    const elemental = r.filter(t => t.element !== null);
    console.log(
        (s.recruits ? ' y ' : ' n ').padEnd(4),
        String(s.admissionOrdinal).padStart(3),
        String(s.ranks.length).padStart(5),
        String(tierOf(s.id)).padStart(4),
        s.alignment.padEnd(11),
        String(r.length).padStart(5),
        String(elemental.length).padStart(4),
        String(s.powerOrdinal).padStart(6),
        ' ' + (s.specialities ?? []).join('/').padEnd(23),
        s.id
    );
}

// ── ELEMENTS ────────────────────────────────────────────────────────────
// A shelf conditioned on roots needs elemental roads to condition on. How many
// are there, and what does the ladder look like per element?
console.log('\nCULTIVATION ROADS BY ELEMENT (the surface root-conditioning has to work with)');
const byElement = new Map<string, { id: string; cap: number | null; houses: number }[]>();
const holders = new Map<string, number>();
for (const s of SECTS as readonly any[]) {
    for (const t of roads(s.teaches ?? [])) holders.set(t.id, (holders.get(t.id) ?? 0) + 1);
}
const { TECHNIQUES } = await import('../src/data/cultivation/techniques.js');
for (const t of TECHNIQUES.filter(x => x.class === 'cultivation')) {
    const k = t.element ?? '(elementless)';
    byElement.set(k, [...(byElement.get(k) ?? []), { id: t.id, cap: t.cap, houses: holders.get(t.id) ?? 0 }]);
}
for (const [el, list] of [...byElement.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const taught = list.filter(x => x.houses > 0);
    console.log(`\n  ${el}  (${list.length} roads, ${taught.length} on any shelf)`);
    for (const x of [...list].sort((a, b) => (a.cap ?? 99) - (b.cap ?? 99))) {
        console.log(`     cap ${String(x.cap ?? 'null').padStart(4)}  houses ${String(x.houses).padStart(2)}  ${x.id}`);
    }
}
