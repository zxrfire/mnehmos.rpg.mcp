/**
 * Does the shape of the world's population change, and does it change sensibly?
 *
 * "Stable" and "alive" are different things and only one of them is wanted. A
 * headcount that holds steady while the distribution underneath it never moves
 * is a world that replaces the dead with identical copies. A headcount that
 * holds steady while the SHAPE shifts - the ladder thinning at the top, a
 * generation ageing through, a disaster cutting a band out - is a world.
 *
 * So this reports the pyramid at intervals and, more importantly, what MOVED
 * between them.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'population-shape', catalog });

const BANDS: [string, number, number][] = [
    ['mortal 0', 0, 0], ['qi 1-12', 1, 12], ['found 13-16', 13, 16], ['core 17-20', 17, 20],
    ['nascent 21-24', 21, 24], ['deity 25-28', 25, 28], ['void 29-32', 29, 32],
    ['body 33-36', 33, 36], ['grand 37-40', 37, 40], ['trib 41-44', 41, 44]
];

const snap = () => {
    const alive = state.npcs.filter(n => n.status === 'alive');
    const byBand = BANDS.map(([, lo, hi]) =>
        alive.filter(n => n.cultivation.realmOrdinal >= lo && n.cultivation.realmOrdinal <= hi).length);
    const ages = alive.map(n => (state.currentDay - n.identity.bornOnDay) / 365).sort((a, b) => a - b);
    return {
        alive: alive.length,
        byBand,
        medianAge: Math.round(ages[Math.floor(ages.length / 2)] ?? 0),
        oldest: Math.round(ages[ages.length - 1] ?? 0),
        under40: ages.filter(a => a < 40).length
    };
};

const marks: { label: string; s: ReturnType<typeof snap> }[] = [];
marks.push({ label: 'seeding', s: snap() });
for (const [label, step] of [['50y', 50], ['150y', 100], ['300y', 150], ['500y', 200]] as const) {
    state = advanceWorldYears(state, step).state;
    marks.push({ label, s: snap() });
}

console.log('THE LADDER, BY BAND');
console.log('  ' + 'when'.padEnd(9) + 'alive'.padStart(6)
    + BANDS.map(([n]) => n.split(' ')[0].padStart(8)).join(''));
for (const m of marks) {
    console.log('  ' + m.label.padEnd(9) + String(m.s.alive).padStart(6)
        + m.s.byBand.map(v => String(v).padStart(8)).join(''));
}

console.log('\nAGE STRUCTURE');
console.log('  ' + 'when'.padEnd(9) + 'median age'.padStart(12) + 'oldest'.padStart(9) + 'under 40'.padStart(10));
for (const m of marks) {
    console.log('  ' + m.label.padEnd(9) + String(m.s.medianAge).padStart(12)
        + String(m.s.oldest).padStart(9) + String(m.s.under40).padStart(10));
}

console.log('\nWHAT MOVED');
const first = marks[0].s, last = marks[marks.length - 1].s;
let moved = 0, flat = 0;
BANDS.forEach(([name], i) => {
    const a = first.byBand[i], b = last.byBand[i];
    if (a === b) { flat++; return; }
    moved++;
    const dir = b > a ? 'grew' : 'thinned';
    console.log(`  ${name.padEnd(15)} ${String(a).padStart(4)} -> ${String(b).padStart(4)}  ${dir}`);
});
console.log(`\n  ${moved} of ${BANDS.length} bands changed; ${flat} held exactly still.`);
console.log(`  headcount ${first.alive} -> ${last.alive}`);
console.log(`  median age ${first.medianAge} -> ${last.medianAge}`);
// Counting how many bands MOVED is not the test, and the first version of this
// file failed because of it: nine of ten bands changed and it reported a living
// world, while five consecutive bands in the middle had gone to zero. A
// distribution can move a great deal while collapsing.
const middle = BANDS.map(([n], i) => ({ n, i })).filter(({ i }) => i >= 2 && i <= 6);
const hollow = middle.filter(({ i }) => last.byBand[i] === 0);
console.log();
if (hollow.length > 0) {
    console.log(`  HOLLOW. ${hollow.length} of the ${middle.length} middle bands hold NOBODY at the end:`);
    console.log('    ' + hollow.map(h => h.n).join(', '));
    console.log('  A world with a floor and a ceiling and nothing between them is not a pyramid.');
    console.log('  The ancients at the top are seeded survivors, not people who climbed.');
} else if (moved >= BANDS.length - 2) {
    console.log('  The distribution moves and the middle stays occupied. The world replaces its');
    console.log('  dead with different people rather than with copies, and somebody is climbing.');
} else {
    console.log('  Too much of the shape is static: the total may move while the world does not.');
}
