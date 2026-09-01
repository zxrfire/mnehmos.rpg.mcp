/**
 * What a house can PRODUCE, as against what it happens to contain.
 *
 * `faction-character.ts` has carried `production.reliableOrdinal` - "highest
 * ordinal it can currently produce reliably, from its own intake" - alongside
 * `peakOrdinal` and `yearsSinceLastPeak`, and states in its own header that the
 * gap between `powerOrdinal` and `reliableOrdinal` is the real prestige metric.
 *
 * `catalog.ts` then collapsed the whole structure to one 0..1 self-sufficiency
 * number and threw the ordinals away, so nothing downstream could read it. That
 * is now wired through, and this measures what is actually in the catalog.
 *
 * IT ALSO MEASURES THE DEFECT THIS FILE WAS EXTENDED FOR. The first run said:
 *
 *     32 houses carry a production tier
 *     gap: min 6, max 44, mean 12.1
 *     houses living on inheritance (gap >= 4): 32
 *     houses whose peak is behind them (peak > reliable): 32
 *
 * Thirty-two of thirty-two. Every institution in the world in decline, without
 * exception, which is a mood applied uniformly rather than a setting - and it
 * made the one genuinely declining house unremarkable. The distribution block
 * below is the check that it stayed fixed: the late age should be the large
 * majority and must never again be unanimous.
 */
import {
    FACTION_CHARACTER,
    productionState,
    productionConstraint,
    type ProductionState
} from '../src/data/cultivation/faction-character.js';
import { SECTS } from '../src/data/cultivation/sects.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';

/** The cap of the best cultivation manual a house teaches. Zero when it teaches none. */
function shelfCapOf(sect: any): number {
    let cap = 0;
    for (const id of (sect.teaches ?? []) as string[]) {
        const t: any = getTechnique(id);
        if (!t || t.class !== 'cultivation') continue;
        cap = Math.max(cap, Number(t.cap ?? 0));
    }
    return cap;
}

const power = new Map((SECTS as any[]).map(s => [s.id, { name: s.name, power: s.powerOrdinal ?? 0, shelf: shelfCapOf(s) }]));

type Row = {
    id: string; name: string; power: number; reliable: number; peak: number;
    since: number; gap: number; shelf: number; state: ProductionState;
    constraint: string; toward: number | null;
};
const rows: Row[] = [];
for (const [id, c] of Object.entries(FACTION_CHARACTER as Record<string, any>)) {
    const p = power.get(id);
    if (!p || !c.production) continue;
    rows.push({
        id, name: p.name, power: p.power,
        reliable: Number(c.production.reliableOrdinal ?? 0),
        peak: Number(c.production.peakOrdinal ?? 0),
        since: Number(c.production.yearsSinceLastPeak ?? 0),
        gap: p.power - Number(c.production.reliableOrdinal ?? 0),
        shelf: p.shelf,
        state: productionState(id, p.power)!,
        // A house teaching no manual at all has said nothing about its shelf,
        // so the diagnosis is unavailable rather than 'manual'.
        constraint: p.shelf > 0 ? productionConstraint(id, p.shelf)! : '-',
        toward: c.production.climbingToward ?? null
    });
}
rows.sort((a, b) => b.gap - a.gap);
console.log('house'.padEnd(32) + 'power'.padStart(6) + 'reliable'.padStart(9)
    + 'gap'.padStart(5) + 'peak'.padStart(6) + 'since'.padStart(8)
    + 'shelf'.padStart(7) + '  ' + 'state'.padEnd(14) + 'limit'.padEnd(10) + 'toward');
for (const r of rows) {
    console.log(r.name.slice(0, 31).padEnd(32) + String(r.power).padStart(6)
        + String(r.reliable).padStart(9) + String(r.gap).padStart(5)
        + String(r.peak).padStart(6) + String(r.since).padStart(8)
        + String(r.shelf).padStart(7) + '  ' + r.state.padEnd(14)
        + r.constraint.padEnd(10) + (r.toward === null ? '-' : String(r.toward)));
}

const gaps = rows.map(r => r.gap);
console.log(`\n${rows.length} houses carry a production tier`);
console.log(`gap between strongest member and what they can still make: `
    + `min ${Math.min(...gaps)}, max ${Math.max(...gaps)}, `
    + `mean ${(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1)}`);
console.log(`houses living on inheritance (gap >= 4): ${rows.filter(r => r.gap >= 4).length}`);
console.log(`houses whose peak is behind them (peak > reliable): ${rows.filter(r => r.peak > r.reliable).length}`);

// ── the distribution, which is the whole point ──────────────────────────────
const ORDER: ProductionState[] = ['declining', 'ascending', 'well-stocked', 'at-peak', 'complete'];
const BEFORE: Record<ProductionState, number> = {
    // Measured on the catalog as it stood before this pass, from the run
    // quoted in the header. Kept here so the comparison is in the output
    // rather than in somebody's memory.
    declining: 32, ascending: 0, 'well-stocked': 0, 'at-peak': 0, complete: 0
};
console.log('\nSTATE DISTRIBUTION        before   after');
for (const state of ORDER) {
    const after = rows.filter(r => r.state === state).length;
    const pct = ((after / rows.length) * 100).toFixed(0);
    console.log('  ' + state.padEnd(22) + String(BEFORE[state]).padStart(6)
        + String(after).padStart(8) + `   (${pct}%)`);
}
console.log(`  ${'total'.padEnd(22)}${String(rows.length).padStart(6)}${String(rows.length).padStart(8)}`);

const declining = rows.filter(r => r.state === 'declining').length;
console.log(`\nlate-age majority intact: ${declining} of ${rows.length} declining `
    + `(${((declining / rows.length) * 100).toFixed(0)}%)`);
console.log(`unanimous? ${declining === rows.length ? 'YES - THE DEFECT IS BACK' : 'no'}`);

console.log('\nMOVING TODAY');
for (const r of rows.filter(r => r.toward !== null).sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ${r.name.padEnd(32)} ${r.reliable} -> ${r.toward}  `
        + `waiting on ${FACTION_CHARACTER[r.id].production.waitingOn}`);
}

console.log('\nCONSTRAINT (reliable against the best manual the house teaches)');
for (const kind of ['manual', 'resource', '-']) {
    const named = rows.filter(r => r.constraint === kind).map(r => r.name);
    console.log(`  ${kind.padEnd(10)} ${String(named.length).padStart(2)}  ${named.join(', ')}`);
}
