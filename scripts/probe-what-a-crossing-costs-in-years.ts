/**
 * The middle bands do not empty because crossings fail. They empty because
 * crossings take longer than a life.
 *
 * `probe-pill-affordability.ts` measures the breakthrough roll inside Qi
 * Condensation at odds 0.899 with pills already being bought at mean potency
 * 0.39. The roll is not what stops anybody. `probe-origin-reaches-the-world.ts`
 * measures zero Foundation cultivators out of six thousand lives that end at age
 * sixty, and one in thirty-three out of the same lives run to a hundred - and
 * the world's median age is fifty-nine.
 *
 * So the binding resource is YEARS, and this prices them: what one rung costs in
 * accumulation, what a year of a cultivator's income is worth against that, and
 * therefore whether the pill catalog's `advance_progress` rows are a real lever
 * or a rounding error. They are the only pills in the catalog that buy time;
 * `boost_breakthrough` buys odds that are already ninety per cent.
 */
import { computeCultivationRate, DAYS_PER_YEAR } from '../src/engine/cultivation/cultivation.js';
import { progressRequiredForOrdinal, lifespanForOrdinal } from '../src/engine/cultivation/realms.js';
import { STONES_PER_YEAR_OF_SECLUSION } from '../src/engine/cultivation/origin.js';
import { earningsPerYear } from '../src/engine/world/seeding.js';
import { PILLS, isAdvancement } from '../src/data/cultivation/pills.js';

const n = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d });

// A median-ish cultivator: an ordinary root, ordinary ground, half the day in
// it, the crude primer nine births in ten are handed.
const rateAt = (ordinal: number) => computeCultivationRate(
    { spiritRoot: 'quad_metal_wood_earth_water', injuries: [], realmOrdinal: ordinal, attributes: { might: 2, insight: 2, fortune: 2, charm: 2 } },
    'normal',
    { focusMultiplier: 0.45, locationBonus: 1, techniqueQuality: 'crude' }
).perDay * DAYS_PER_YEAR;

console.log('WHAT ONE RUNG COSTS, FOR AN ORDINARY CULTIVATOR ON ORDINARY GROUND');
console.log('  ' + 'ord'.padStart(4) + 'qi needed'.padStart(12) + 'qi/year'.padStart(10)
    + 'years'.padStart(8) + 'cumulative'.padStart(12) + 'lifespan'.padStart(10)
    + 'net stones/yr'.padStart(15) + 'qi/yr bought'.padStart(14));

// Cheapest stones-per-qi-unit anywhere in the catalog, which is what an open
// market in progress pills would actually charge.
const progressPills = PILLS.filter(p => p.effect === 'advance_progress');
const bestRate = Math.min(...progressPills.map(p => p.value / p.potency));

let cumulative = 0;
for (let o = 0; o <= 20; o++) {
    const need = progressRequiredForOrdinal(o);
    if (need === null) break;
    const perYear = rateAt(o);
    const years = need / perYear;
    cumulative += years;
    const net = -0.45 * STONES_PER_YEAR_OF_SECLUSION + 0.55 * earningsPerYear(o);
    if (o % 2 === 0 || o === 13) {
        console.log('  ' + String(o).padStart(4) + n(need).padStart(12) + n(perYear).padStart(10)
            + n(years, 1).padStart(8) + n(cumulative, 1).padStart(12)
            + n(lifespanForOrdinal(o)).padStart(10)
            + n(net, 1).padStart(15)
            + (net > 0 ? n(net / bestRate) : '0').padStart(14));
    }
}

console.log(`\n  Cheapest progress in the catalog: ${bestRate.toFixed(2)} stones per qi-unit`);
console.log('  ' + 'pill'.padEnd(34) + 'grade'.padStart(9) + 'qi'.padStart(9)
    + 'stones'.padStart(9) + 'stones/qi'.padStart(11));
for (const p of progressPills) {
    console.log('  ' + p.name.padEnd(34) + p.grade.padStart(9) + n(p.potency).padStart(9)
        + n(p.value).padStart(9) + (p.value / p.potency).toFixed(2).padStart(11));
}

console.log('\nTHE CATALOG BY GRADE - what a tier split would fall on');
const grades = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'] as const;
console.log('  ' + 'grade'.padEnd(10) + 'pills'.padStart(7) + 'advancement'.padStart(13)
    + 'min value'.padStart(11) + 'max value'.padStart(11) + 'years of income at o=12'.padStart(24));
for (const g of grades) {
    const inGrade = PILLS.filter(p => p.grade === g);
    const net12 = -0.45 * STONES_PER_YEAR_OF_SECLUSION + 0.55 * earningsPerYear(12);
    const maxV = Math.max(...inGrade.map(p => p.value));
    console.log('  ' + g.padEnd(10) + String(inGrade.length).padStart(7)
        + String(inGrade.filter(p => isAdvancement(p.effect)).length).padStart(13)
        + n(Math.min(...inGrade.map(p => p.value))).padStart(11)
        + n(maxV).padStart(11)
        + n(maxV / net12, 1).padStart(24));
}
