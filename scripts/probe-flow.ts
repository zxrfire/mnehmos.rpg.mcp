/**
 * How many people cross each rung per century, and where does the flow stop?
 *
 * A pyramid is not a stock, it is a flow: people enter at the bottom, some
 * fraction of them cross each rung, and the shape is whatever that leaves
 * standing. Measuring the stock says the middle is empty. Measuring the flow
 * says WHERE it stops, which is the only thing you can act on.
 *
 * So this watches individuals rather than counting bands: every advance any
 * living cultivator makes, tallied by the rung they crossed INTO.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { manualCeilingOf, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';

const catalog = await loadCultivationCatalog();
let { state } = seedWorld({ seed: 'flow', catalog });

const ordinalOf = new Map<string, number>();
for (const n of state.npcs) ordinalOf.set(n.id, n.cultivation.realmOrdinal);

const crossings = new Map<number, number>();
let advances = 0;

for (let century = 1; century <= 5; century++) {
    state = advanceWorldYears(state, 100).state;
    for (const n of state.npcs) {
        const was = ordinalOf.get(n.id);
        const now = n.cultivation.realmOrdinal;
        if (was !== undefined && now > was) {
            for (let r = was + 1; r <= now; r++) crossings.set(r, (crossings.get(r) ?? 0) + 1);
            advances++;
        }
        ordinalOf.set(n.id, now);
    }
}

console.log('CROSSINGS INTO EACH RUNG, over 500 years');
console.log('  rung  crossings');
for (let r = 1; r <= 46; r++) {
    const c = crossings.get(r) ?? 0;
    if (r > 20 && c === 0) continue;
    console.log(`  ${String(r).padStart(4)}  ${String(c).padStart(6)}  ${'#'.repeat(Math.min(60, c))}`);
}
console.log(`\n  total advances by individuals: ${advances}`);
const top = [...crossings.keys()].filter(r => (crossings.get(r) ?? 0) > 0).sort((a, b) => b - a)[0] ?? 0;
console.log(`  highest rung anybody crossed INTO: ${top}`);

// Where the bookless sit, since BOOKLESS_CEILING is a hard stop at 6.
const alive = state.npcs.filter(n => n.status === 'alive');
const bookless = alive.filter(n => manualCeilingOf(n) === 0);
const inHouseBookless = bookless.filter(n => n.factionId).length;
console.log(`\n  living ${alive.length}; holding no road at all: ${bookless.length}`
    + ` (${inHouseBookless} of them inside a house)`);
console.log(`  BOOKLESS_CEILING is ${BOOKLESS_CEILING}, so every one of those stops there.`);
const capped = alive.filter(n => {
    const c = manualCeilingOf(n) || BOOKLESS_CEILING;
    return n.cultivation.realmOrdinal >= c;
});
console.log(`  standing at their own ceiling right now: ${capped.length}`);
