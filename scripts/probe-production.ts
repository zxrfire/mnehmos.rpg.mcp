/**
 * What a house can PRODUCE, as against what it happens to contain.
 *
 * `faction-character.ts` has carried `production.reliableOrdinal` - "highest
 * ordinal it can currently produce reliably, from its own intake" - alongside
 * `peakOrdinal` and `yearsSinceLastPeak`, and states in its own header that the
 * gap between `powerOrdinal` and `reliableOrdinal` is the real prestige metric.
 *
 * `catalog.ts` then collapses the whole structure to one 0..1 self-sufficiency
 * number and throws the ordinals away, so nothing downstream can read it. This
 * measures what is being discarded.
 */
import { FACTION_CHARACTER } from '../src/data/cultivation/faction-character.js';
import { SECTS } from '../src/data/cultivation/sects.js';

const power = new Map((SECTS as any[]).map(s => [s.id, { name: s.name, power: s.powerOrdinal ?? 0 }]));
const rows: { name: string; power: number; reliable: number; peak: number; since: number; gap: number }[] = [];
for (const [id, c] of Object.entries(FACTION_CHARACTER as Record<string, any>)) {
    const p = power.get(id);
    if (!p || !c.production) continue;
    rows.push({
        name: p.name, power: p.power,
        reliable: Number(c.production.reliableOrdinal ?? 0),
        peak: Number(c.production.peakOrdinal ?? 0),
        since: Number(c.production.yearsSinceLastPeak ?? 0),
        gap: p.power - Number(c.production.reliableOrdinal ?? 0)
    });
}
rows.sort((a, b) => b.gap - a.gap);
console.log('house'.padEnd(32) + 'power'.padStart(6) + 'reliable'.padStart(9)
    + 'gap'.padStart(5) + 'peak'.padStart(6) + 'yrs since peak'.padStart(16));
for (const r of rows) {
    console.log(r.name.slice(0, 31).padEnd(32) + String(r.power).padStart(6)
        + String(r.reliable).padStart(9) + String(r.gap).padStart(5)
        + String(r.peak).padStart(6) + String(r.since).padStart(16));
}
const gaps = rows.map(r => r.gap);
console.log(`\n${rows.length} houses carry a production tier`);
console.log(`gap between strongest member and what they can still make: `
    + `min ${Math.min(...gaps)}, max ${Math.max(...gaps)}, `
    + `mean ${(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1)}`);
console.log(`houses living on inheritance (gap >= 4): ${rows.filter(r => r.gap >= 4).length}`);
console.log(`houses whose peak is behind them (peak > reliable): ${rows.filter(r => r.peak > r.reliable).length}`);
