/**
 * Is there room in the model for somebody to be dramatically faster than
 * average, and does the roll ever reach the best the schema permits?
 *
 * The world produces no outliers: measured, the fastest cultivator alive reaches
 * ordinal 29 about six years ahead of the median, against a Hollow Court
 * admission bar that wants 250 against a median of 658. Wealth, medicine and
 * talent are all named as things that should compress a timeline and none of
 * them visibly does.
 *
 * Two halves, and the second matters more than the first.
 *
 *   DOES THE ROLL REACH THE TOP? A maximum nobody rolls is not a maximum, it is
 *   a documentation artefact. This prints the full histogram per attribute over
 *   a large population and states the top-value frequency plainly.
 *
 *   IS THE RANGE WIDE ENOUGH TO MATTER? If the best possible attributes are
 *   barely better than average ones there is no room for a prodigy, and no
 *   amount of money or medicine makes one, because the term they multiply is
 *   nearly flat. Widening the schema fixes nothing if attributes are a small
 *   term next to ground or method - so this prices the terms against each other.
 *
 * Run: npx tsx scripts/probe-is-there-room-for-a-prodigy.ts [population]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { AMBIENT_QI_RATE_MULTIPLIER } from '../src/schema/cultivation.js';
import { SPIRIT_ROOTS } from '../src/engine/cultivation/spirit-roots.js';

const POP = Number(process.argv[2] ?? 4000);
const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: 'prodigy-room', catalog, population: POP });
const alive = (state.npcs as any[]).filter(n => n.status === 'alive');

console.log(`population ${alive.length}\n`);
console.log('ATTRIBUTE HISTOGRAM  (schema allows might 1-3, insight 1-4, fortune 0-3, charm 1-3)');
const TOPS: Record<string, number> = { might: 3, insight: 4, fortune: 3, charm: 3 };
for (const key of ['might', 'insight', 'fortune', 'charm']) {
    const vals = alive.map(n => n.cultivation.attributes?.[key]).filter(v => v !== undefined);
    const hist = new Map<number, number>();
    for (const v of vals) hist.set(v, (hist.get(v) ?? 0) + 1);
    const top = TOPS[key];
    const atTop = hist.get(top) ?? 0;
    console.log(`  ${key.padEnd(8)} ` +
        [...hist.entries()].sort((a, b) => a[0] - b[0])
            .map(([v, n]) => `${v}:${String(n).padStart(5)}`).join('  ') +
        `   top(${top}) = ${atTop} = ${(100 * atTop / vals.length).toFixed(1)}%`);
}

// The perfect roll, and how many people in the world have it.
const perfect = alive.filter(n => {
    const a = n.cultivation.attributes ?? {};
    return a.might === 3 && a.insight === 4 && a.fortune === 3 && a.charm === 3;
});
console.log(`\npeople with the best possible attribute roll (3/4/3/3): ${perfect.length}` +
    ` = ${(100 * perfect.length / alive.length).toFixed(2)}%`);

// ── WHAT ELSE SCALES A CLIMB, AND BY HOW MUCH ───────────────────────────
//
// The comparison that decides whether widening attributes would fix anything.
// Every figure below is a ratio of best to worst on that axis alone.
console.log('\nTERMS THAT SCALE A CLIMB, best over worst on each axis');
const amb = Object.values(AMBIENT_QI_RATE_MULTIPLIER);
console.log(`  ground (ambient band)     x${(Math.max(...amb) / Math.min(...amb)).toFixed(2)}` +
    `   (${Math.min(...amb)} thin to ${Math.max(...amb)} spirit tide)`);
const mults = SPIRIT_ROOTS.map(r => (r as any).cultivationSpeed ?? (r as any).speedMultiplier ?? null)
    .filter((x): x is number => typeof x === 'number');
if (mults.length) {
    console.log(`  spirit root               x${(Math.max(...mults) / Math.min(...mults)).toFixed(2)}` +
        `   (${Math.min(...mults)} to ${Math.max(...mults)})`);
} else {
    console.log('  spirit root               (no single speed field on the root; see spirit-roots.ts)');
}
console.log('  attributes (whole legal range, per AGENTS.md)  x1.50');
console.log('  one realm of ordinal                            x4.00');
console.log('\nIf attributes are worth x1.5 across their WHOLE legal range while the');
console.log('ground under somebody is worth x8, then attributes are not where a');
console.log('prodigy comes from and widening them moves very little.');
