/**
 * Of everybody in this world who cracks, how many are ever mended?
 *
 * The one number the structural-repair medicine has to be judged on. The design
 * target, from the designer: RARE TO A DEGREE WHERE MOST PEOPLE JUST LIVE WITH
 * IT - and living with it usually means dying at the wall, because a broken
 * structure shuts the road and the span the rung granted them then runs out at
 * that rung.
 *
 * The loop is not here. It is
 * `src/engine/world/how-many-of-the-broken-are-ever-mended.ts`, so that this
 * probe and the test that guards the target cannot drift apart - which is the
 * first item on AGENTS.md's list of ways a measurement goes wrong.
 *
 * Run: npx tsx scripts/probe-who-gets-mended.ts
 * The same measurement runs as an assertion in
 * `tests/engine/world/structural-repair-medicine.test.ts`.
 */
import {
    measureWhoGetsMended,
    NEW_CULTIVATORS_PER_YEAR,
    HOUSEHOLD_ORIGINS
} from '../src/engine/world/how-many-of-the-broken-are-ever-mended.js';
import {
    readAllRepairMedicine,
    sentDownLedgerTotals
} from '../src/engine/cultivation/what-structural-repair-medicine-can-reach.js';

const SAMPLE = 20_000;
const n = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d });
const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

console.log('\nTHE TABLE');
for (const m of readAllRepairMedicine()) {
    console.log(`  ${m.name.padEnd(24)} ${m.grade.padEnd(9)} to ordinal ${String(m.reachesUpToOrdinal).padStart(2)}`
        + `  worth ${n(m.weightInStones).padStart(12)}`
        + `  ${m.cashPrice === null ? 'no cash price' : 'for sale'}`
        + `  = ${m.shareOfAGrandAscensionLifetime.toFixed(2)} of a Grand Ascension life's earnings`);
}

const ledger = sentDownLedgerTotals();
console.log(`\nTHE SENT-DOWN COUNT: ${ledger.standing} standing, ${ledger.spent} spent, `
    + `${ledger.unaccounted} unaccounted, ${ledger.everArrived} ever arrived `
    + `(${ledger.reconciles ? 'reconciles' : 'DOES NOT RECONCILE'})`);

const result = measureWhoGetsMended({ sample: SAMPLE });

console.log(`\nTHE COHORT - ${n(SAMPLE)} lives drawn from the world's own birth distribution`);
console.log(`  crossed at least one wall  : ${n(result.reachedAWall)}`);
console.log(`  arrived broken at some wall: ${n(result.broken)}  (${pct(result.broken / SAMPLE)} of all lives)`);
console.log(`  spread over                : ${n(result.years)} years at ${NEW_CULTIVATORS_PER_YEAR} new cultivators a year`);

console.log('\nWHERE THEY BROKE');
for (const row of result.byBreak) {
    console.log(`  ${row.woundKey.padEnd(28)} at ${String(row.atOrdinal).padStart(2)}`
        + `  broken ${String(row.broken).padStart(5)}`
        + `  connected ${String(row.connected).padStart(4)}`
        + `  doses ${row.dosesAvailable === null ? '   -' : String(Math.floor(row.dosesAvailable)).padStart(4)}`
        + `  mended ${String(row.mended).padStart(4)}`);
}

console.log('\nTHE TWO SCARCITIES');
console.log(`  of the broken, born inside a body that could hold one: ${n(result.connected)} of ${n(result.broken)}  (${pct(result.connectedShare)})`);
console.log(`    the births that count: ${HOUSEHOLD_ORIGINS.join(', ')}`);
console.log(`  doses in the world or refined over the span          : ${n(result.dosesInPlay, 1)}`);

console.log('\nTHE ANSWER');
console.log(`  broken cultivators ever mended: ${n(result.mended)} of ${n(result.broken)}  = ${pct(result.mendedShare)}`);
console.log(`  the rest                      : ${n(result.broken - result.mended)}, who stop at the rung they reached`);
console.log(result.mendedShare < 0.01
    ? '\n  Under one in a hundred. Most break, stay broken, and the road is shut for good.'
    : '\n  TOO AVAILABLE. Either there are too many doses or too many people standing near one.');
