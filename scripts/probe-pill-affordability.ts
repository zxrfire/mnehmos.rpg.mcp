/**
 * Can anybody at the bottom of the ladder actually buy a breakthrough pill?
 *
 * The population probe says the middle of the ladder empties to zero across
 * five centuries. The designed lever for that is the pill, and `deriveLife`
 * already buys one at every crossing - so before tuning anything, the question
 * is whether the purchase is ever more than a rounding error.
 *
 * Two measurements, and the second is the one that counts:
 *
 *   THE TABLE      price against income against upkeep, rung by rung. Closed
 *                  form, from the engine's own exported constants.
 *   THE WALK       the real `deriveLife`, watched through `onAttempt`, over a
 *                  sample drawn from the world's own root / attribute / origin
 *                  distributions. No second copy of the loop.
 */
import {
    BREAKTHROUGH_PILL_STONES,
    STONES_PER_YEAR_OF_SECLUSION,
    breakthroughPillPrice,
    ORIGIN_TIERS,
    ORIGIN_WEIGHT_TOTAL,
    rollOrigin
} from '../src/engine/cultivation/origin.js';
import { deriveLife, earningsPerYear, type CrossingAttemptObservation } from '../src/engine/world/seeding.js';
import { rollAttributes, rollSpiritRoot } from '../src/engine/cultivation/spirit-roots.js';
import { forStream } from '../src/engine/cultivation/rng.js';
import { MAX_PILL_BONUS } from '../src/engine/cultivation/breakthrough.js';

const n = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d });

// ── THE TABLE ────────────────────────────────────────────────────────────
console.log('PRICE AGAINST INCOME, BY RUNG');
console.log('  Upkeep is ' + STONES_PER_YEAR_OF_SECLUSION + ' stones a secluded year.');
console.log('  The walk buys at a FLAT ' + BREAKTHROUGH_PILL_STONES + ' (`BREAKTHROUGH_PILL_STONES`),');
console.log('  while `breakthroughPillPrice(ordinal)` climbs. Both are shown.');
console.log();
console.log('  ' + 'ord'.padStart(4) + 'earn/yr'.padStart(10) + 'flat price'.padStart(12)
    + 'ranked price'.padStart(14) + 'net/yr f=.45'.padStart(14) + 'yrs per pill'.padStart(14));
for (const o of [0, 2, 4, 6, 8, 10, 12, 13, 16, 20, 24]) {
    const earn = earningsPerYear(o);
    const focus = 0.45;
    const net = -focus * STONES_PER_YEAR_OF_SECLUSION + (1 - focus) * earn;
    const yrs = net > 0 ? BREAKTHROUGH_PILL_STONES / net : Infinity;
    console.log('  ' + String(o).padStart(4) + n(earn, 1).padStart(10)
        + n(BREAKTHROUGH_PILL_STONES).padStart(12)
        + n(breakthroughPillPrice(o)).padStart(14)
        + n(net, 1).padStart(14)
        + (Number.isFinite(yrs) ? n(yrs, 1) : 'never').padStart(14));
}

console.log('\n  Break-even focus at each rung - above this the cultivator loses money:');
console.log('  ' + 'ord'.padStart(4) + 'break-even focus'.padStart(18));
for (const o of [0, 4, 8, 12, 16, 20]) {
    const earn = earningsPerYear(o);
    // -f*U + (1-f)*E = 0  =>  f = E / (E + U)
    console.log('  ' + String(o).padStart(4)
        + (earn / (earn + STONES_PER_YEAR_OF_SECLUSION)).toFixed(3).padStart(18));
}

console.log('\nWHAT AN ORIGIN STARTS WITH, AGAINST ONE PILL');
console.log('  ' + 'tier'.padEnd(18) + 'share'.padStart(9) + 'stones'.padStart(10) + 'pills'.padStart(9));
for (const t of ORIGIN_TIERS) {
    console.log('  ' + t.key.padEnd(18)
        + (t.weight / ORIGIN_WEIGHT_TOTAL * 100).toFixed(2).padStart(8) + '%'
        + n(t.spiritStones).padStart(10)
        + (t.spiritStones / BREAKTHROUGH_PILL_STONES).toFixed(2).padStart(9));
}

// ── THE WALK ─────────────────────────────────────────────────────────────
const SAMPLE = 4000;
const attempts: CrossingAttemptObservation[] = [];
const peaks: number[] = [];

for (let i = 0; i < SAMPLE; i++) {
    const r = forStream('pill-affordability', 'life', i);
    const root = rollSpiritRoot(r.next());
    const attributes = rollAttributes([r.next(), r.next(), r.next(), r.next()]);
    const origin = rollOrigin(r.next());
    // A whole life, against the ordinary province ceiling the driver uses.
    const life = deriveLife(root.key, attributes, 100, 1, 20,
        forStream('pill-affordability', 'walk', i),
        { origin: origin.key, onAttempt: a => attempts.push(a) });
    peaks.push(life.ordinal);
}

console.log(`\nTHE REAL WALK - ${n(SAMPLE)} lives to age 100, ceiling 20`);
console.log(`  ${n(attempts.length)} crossing attempts observed.`);

const BANDS: [string, number, number][] = [
    ['qi 0-3', 0, 3], ['qi 4-7', 4, 7], ['qi 8-12', 8, 12],
    ['found 13-16', 13, 16], ['core 17-20', 17, 20]
];
console.log('\n  ' + 'band'.padEnd(14) + 'attempts'.padStart(10) + 'mean potency'.padStart(14)
    + 'potency>=0.5'.padStart(14) + 'potency=0'.padStart(12) + 'mean odds'.padStart(11));
for (const [label, lo, hi] of BANDS) {
    const inBand = attempts.filter(a => a.ordinal >= lo && a.ordinal <= hi);
    if (inBand.length === 0) { console.log('  ' + label.padEnd(14) + '0'.padStart(10)); continue; }
    const mean = inBand.reduce((s, a) => s + a.potency, 0) / inBand.length;
    const full = inBand.filter(a => a.potency >= 0.5).length;
    const none = inBand.filter(a => a.potency <= 0).length;
    const odds = inBand.reduce((s, a) => s + a.finalChance, 0) / inBand.length;
    console.log('  ' + label.padEnd(14) + n(inBand.length).padStart(10)
        + mean.toFixed(4).padStart(14)
        + `${(full / inBand.length * 100).toFixed(1)}%`.padStart(14)
        + `${(none / inBand.length * 100).toFixed(1)}%`.padStart(12)
        + odds.toFixed(3).padStart(11));
}

// The headline: what one pill is actually worth to the odds, at the potency
// people can actually reach. `MAX_PILL_BONUS` is the whole span of the term.
const low = attempts.filter(a => a.ordinal <= 12);
const meanLowPotency = low.reduce((s, a) => s + a.potency, 0) / Math.max(1, low.length);
console.log(`\n  Qi Condensation: mean potency ${meanLowPotency.toFixed(4)} of a pill,`);
console.log(`  which through MAX_PILL_BONUS=${MAX_PILL_BONUS} is a multiplier of `
    + `${(1 + meanLowPotency * MAX_PILL_BONUS).toFixed(4)} on the odds.`);
console.log(`  A full pill would be ${(1 + MAX_PILL_BONUS).toFixed(2)}.`);

const pillsPerLife = attempts.filter(a => a.ordinal <= 12 && a.potency >= 0.5).length / SAMPLE;
console.log(`\n  Half-pills-or-better bought per Qi Condensation life: ${pillsPerLife.toFixed(3)}`);

const hist = new Map<number, number>();
for (const p of peaks) hist.set(p, (hist.get(p) ?? 0) + 1);
console.log('\n  Peak ordinal reached: '
    + [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([o, c]) => `${o}:${c}`).join(' '));
const reachedFoundation = peaks.filter(p => p >= 13).length;
console.log(`  Reached Foundation (13+): ${reachedFoundation} of ${SAMPLE}`
    + ` = 1 in ${reachedFoundation > 0 ? (SAMPLE / reachedFoundation).toFixed(0) : 'infinity'}`
    + '  (lore claims about 1 in 40)');
