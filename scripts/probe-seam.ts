/**
 * Is the shelf gap an off-by-one in `capOf`, or missing shelf entries?
 * Test the counterfactual: re-cap every manual at realmEnd (Perfection) and
 * keep every requiredOrdinal where it is, then ask whether the WORLD chain
 * (not any one shelf) still joins up.
 */
import { TECHNIQUES } from '../src/data/cultivation/techniques.js';
import { REALM_TIERS, MAX_ORDINAL, progressRequiredForOrdinal } from '../src/engine/cultivation/realms.js';

const MANUALS = TECHNIQUES.filter(t => t.class === 'cultivation' && t.cap != null)
  .map(t => ({ id: t.id, req: t.requiredOrdinal, cap: Number(t.cap) }));

const realmEndOf = (n: number) => REALM_TIERS.find(r => n >= r.ordinalStart && n <= r.ordinalEnd)!.ordinalEnd;

function walls(books: { id: string; req: number; cap: number }[], label: string) {
    const w: number[] = [];
    for (let o = 0; progressRequiredForOrdinal(o) !== null; o++) {
        const open = books.filter(b => b.req <= o);
        const best = open.length ? Math.max(...open.map(b => b.cap)) : -1;
        if (best <= o) w.push(o);
    }
    console.log(`${label.padEnd(34)} walls at: ${w.length ? w.join(', ') : 'NONE'}`);
}

walls(MANUALS, 'catalog as it stands (cap=end+1)');
walls(MANUALS.map(b => ({ ...b, cap: realmEndOf(b.req) })), 'proposed (cap=realm Perfection)');
walls(MANUALS.map(b => ({ ...b, cap: realmEndOf(b.req) })).map(b => b), 'proposed, req unchanged');
// And the proposal's own successor rule: req == predecessor.cap + 1
const proposed = MANUALS.map(b => ({ ...b, cap: realmEndOf(b.req) }));
console.log('\nhandoffs under each scheme (cap -> the lowest req that can be opened standing on it)');
for (const scheme of [{ n: 'current ', books: MANUALS }, { n: 'proposed', books: proposed }]) {
    for (const cap of [...new Set(scheme.books.map(b => b.cap))].sort((a, b) => a - b)) {
        const opens = scheme.books.filter(b => b.req <= cap && b.cap > cap).length;
        console.log(`  ${scheme.n}  standing on cap ${String(cap).padStart(2)}: ${opens} book(s) open that go further`);
    }
}
