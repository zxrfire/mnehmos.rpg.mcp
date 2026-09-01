/**
 * Two rules for "how high must you stand to hold this rank", and they disagree.
 *
 * `rankRealmBand` (members.ts) is the existing authority: a catalog test
 * enforces that every seeded member's realm falls inside it, and it caps a rank
 * at what the house can RELIABLY PRODUCE plus a little headroom.
 *
 * `ordinalExpectedAt` (promotion-inside-a-house.ts) is one I wrote for the
 * promotion pass, and it interpolates to `powerOrdinal` - the house's strongest
 * member - instead. Where a house's strongest member is far above its pipeline,
 * which is the normal case and averages twelve rungs, my bar is much higher.
 *
 * That means promoted members obey a different rule from seeded ones, and the
 * bar may be so high nobody can ever clear it.
 */
import { SECTS } from '../src/data/cultivation/sects.js';
import { rankRealmBand } from '../src/data/cultivation/members.js';
import { ordinalExpectedAt } from '../src/engine/world/promotion-inside-a-house.js';

console.log('house'.padEnd(30) + 'rank'.padStart(5) + 'rankRealmBand.min'.padStart(19)
    + 'ordinalExpectedAt'.padStart(19) + 'mine higher by'.padStart(16));
let worse = 0, total = 0, sum = 0;
for (const s of (SECTS as any[]).slice(0, 8)) {
    const ranks = s.ranks ?? [];
    for (let r = 1; r < ranks.length; r++) {
        const band = rankRealmBand(s.id, r);
        if (!band) continue;
        const mine = ordinalExpectedAt(r, ranks.length, s.admissionOrdinal ?? 0, s.powerOrdinal ?? 0);
        const diff = mine - band.minOrdinal;
        total++; sum += diff; if (diff > 0) worse++;
        console.log(s.name.slice(0, 29).padEnd(30) + String(r).padStart(5)
            + String(band.minOrdinal).padStart(19) + String(mine).padStart(19)
            + (diff > 0 ? `+${diff}` : String(diff)).padStart(16));
    }
}
console.log(`\nacross the whole catalog:`);
let allWorse = 0, allTotal = 0, allSum = 0, unreachable = 0;
for (const s of SECTS as any[]) {
    const ranks = s.ranks ?? [];
    for (let r = 1; r < ranks.length; r++) {
        const band = rankRealmBand(s.id, r);
        if (!band) continue;
        const mine = ordinalExpectedAt(r, ranks.length, s.admissionOrdinal ?? 0, s.powerOrdinal ?? 0);
        allTotal++; allSum += mine - band.minOrdinal;
        if (mine > band.minOrdinal) allWorse++;
        if (mine > band.maxOrdinal) unreachable++;
    }
}
console.log(`  rank bars compared: ${allTotal}`);
console.log(`  where my bar is HIGHER than the authority's floor: ${allWorse}`);
console.log(`  where my bar is above the authority's CEILING for that rank: ${unreachable}`);
console.log(`  mean difference: ${(allSum / allTotal).toFixed(1)} rungs`);
