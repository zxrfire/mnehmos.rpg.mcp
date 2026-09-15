/**
 * Where the chain of books a house can actually teach runs out.
 *
 * A manual carries a reader from its own `requiredOrdinal` to its `cap`, and
 * `cap` is the first rung of the next realm up. So climbing past a realm needs a
 * book that OPENS inside that realm, and the only books a house hands out are
 * the ones on its shelf. This counts, for every rung, how many books in the
 * whole catalog open there and how many of those any house in the world teaches.
 *
 * Run: npx tsx scripts/probe-the-hole-in-the-teaching-ladder.ts
 */
import { SECTS } from '../src/data/cultivation/sects.js';
import { TECHNIQUES, getTechnique } from '../src/data/cultivation/techniques.js';
import { houseTeachingCeiling } from '../src/data/cultivation/index.js';
import { MAX_ORDINAL, rankName, realmForOrdinal } from '../src/engine/cultivation/realms.js';

const taughtAnywhere = new Set<string>();
for (const sect of SECTS) {
    for (const id of sect.teaches) taughtAnywhere.add(id);
    if (sect.signatureTechniqueId) taughtAnywhere.add(sect.signatureTechniqueId);
}

console.log('rung  realm                       opens-here(catalog)  of-those-taught  cap');
for (let o = 0; o <= MAX_ORDINAL; o++) {
    const opens = TECHNIQUES.filter(t => Number(t.requiredOrdinal ?? 0) === o);
    if (opens.length === 0) continue;
    const taught = opens.filter(t => taughtAnywhere.has(t.id));
    const caps = [...new Set(opens.map(t => String(t.cap ?? 'none')))].join('/');
    console.log(
        `${String(o).padStart(4)}  ${realmForOrdinal(o).name.padEnd(26)}` +
        `${String(opens.length).padStart(19)}${String(taught.length).padStart(17)}   ${caps}`
        + (taught.length === 0 ? '   <- no house teaches anything that opens here' : '')
    );
}

console.log('\nthe highest cap any house teaches, per house:');
const ceilings = new Map<number, number>();
for (const sect of SECTS) {
    const c = houseTeachingCeiling(sect.id);
    if (c === null) continue;
    ceilings.set(c, (ceilings.get(c) ?? 0) + 1);
}
for (const [cap, n] of [...ceilings.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  cap ${String(cap).padStart(2)} (${rankName(cap)}): ${n} house${n === 1 ? '' : 's'}`);
}

console.log('\nbooks that carry a reader INTO Tribulation Transcendence (cap 41), and who teaches them:');
for (const t of TECHNIQUES) {
    if (Number(t.cap ?? 0) !== 41) continue;
    const who = SECTS.filter(s => s.teaches.includes(t.id) || s.signatureTechniqueId === t.id);
    console.log(`  ${t.id} opens ${t.requiredOrdinal} -> ${t.cap}   taught by ${who.length === 0 ? 'NOBODY' : who.map(s => s.id).join(', ')}`);
}

console.log('\nbooks that carry a reader to the Lid (cap 45), and who teaches them:');
for (const t of TECHNIQUES) {
    if (Number(t.cap ?? 0) !== 45) continue;
    const who = SECTS.filter(s => s.teaches.includes(t.id) || s.signatureTechniqueId === t.id);
    console.log(`  ${t.id} opens ${t.requiredOrdinal} -> ${t.cap}   taught by ${who.length === 0 ? 'NOBODY' : who.map(s => s.id).join(', ')}`);
}

console.log('\nand who can write one out: masteryBar is the cap, so a cap-45 book needs a holder at 45.');
console.log(`uncapped arts (carry to the summit): ${TECHNIQUES.filter(t => t.cap == null).map(t => `${t.id}@${t.requiredOrdinal}`).join(', ')}`);

// ── A GAP INSIDE A SHELF, which docs/world/climbing/manuals.md calls a defect:
// "A primer capping at 13 followed by a book requiring 21 is eight rungs nobody
// in the house can cross." Walk each shelf from the bottom and see where the
// running cap stops reaching the next book's opening rung.
console.log('\ngaps INSIDE a shelf - rungs a house teaches nobody across:');
let housesWithAGap = 0;
for (const sect of SECTS) {
    const ids = [...sect.teaches, ...(sect.signatureTechniqueId ? [sect.signatureTechniqueId] : [])];
    const shelf = ids
        .map(id => getTechnique(id))
        .filter((t): t is NonNullable<typeof t> => t != null && t.cap != null)
        .map(t => ({ id: t.id, opens: Number(t.requiredOrdinal ?? 0), cap: Number(t.cap) }))
        .sort((a, b) => a.opens - b.opens || a.cap - b.cap);
    if (shelf.length === 0) continue;

    let reach = shelf[0].opens;
    const gaps: string[] = [];
    for (const m of shelf) {
        if (m.opens > reach) gaps.push(`${reach}..${m.opens - 1} before ${m.id}`);
        reach = Math.max(reach, m.cap);
    }
    if (gaps.length === 0) continue;
    housesWithAGap++;
    console.log(`  ${sect.id.padEnd(34)} tops out at ${reach}   gap: ${gaps.join('; ')}`);
}
console.log(`  ${housesWithAGap} of ${SECTS.length} houses have a gap inside the shelf.`);
