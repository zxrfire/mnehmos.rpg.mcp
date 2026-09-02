/**
 * How often does a world produce an ascension, and does its pyramid survive it?
 *
 * We have three crossings across two seeds, which proves POSSIBLE and says
 * nothing about RATE. `applyLastCrossing` fires at 1 / 35,000 per figure per
 * year, so with a handful of people standing at 44 the expected interval is
 * thousands of world-years and any small sample is dominated by luck.
 *
 * The paired question matters more than the rate. A world that produced an
 * ascension is BY DEFINITION the world where somebody climbed furthest, so it
 * is the stress case for the population shape - and reporting the shape only
 * from worlds that did not produce one would be measuring the easy half.
 *
 * Emits one line per world so a long run can be read while it is still going.
 *
 * Run: npx tsx scripts/survey-ascensions-and-the-shape.ts [years] [pop] [seeds...]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { REALM_TIERS, realmForOrdinal, FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL } from '../src/engine/cultivation/realms.js';
import { ageInYears } from '../src/engine/world/npc-state.js';

const YEARS = Number(process.argv[2] ?? 5000);
const POP = Number(process.argv[3] ?? 400);
const SEEDS = process.argv.slice(4).length
    ? process.argv.slice(4)
    : ['s1', 's2', 's3', 's4', 's5', 's6'];
const STEP = 100;

const catalog = await loadCultivationCatalog();
const KEYS = REALM_TIERS.map(t => t.key);

interface Crossing { seed: string; year: number; who: string; id: string; ordinal: number }
const allCrossings: Crossing[] = [];

console.log(`survey: ${SEEDS.length} seeds, ${YEARS}y each, population ${POP}`);
console.log(`world-years total: ${SEEDS.length * YEARS}\n`);
console.log('seed      cross  topOrd  alive   qi%   found%  bottom  middle   top   floor');
console.log('-'.repeat(84));

for (const seed of SEEDS) {
    let state = seedWorld({ seed, catalog, population: POP }).state as any;
    const lowest = new Map<string, number>();
    const seenCrossed = new Set<string>();
    const crossings: Crossing[] = [];
    const climbedTo44: string[] = [];

    for (let y = 0; y <= YEARS; y += STEP) {
        if (y > 0) state = advanceWorldYears(state, STEP).state;
        for (const n of state.npcs as any[]) {
            if (n.status !== 'alive') continue;
            const o = n.cultivation.realmOrdinal;
            const low = lowest.get(n.id);
            if (low === undefined) { lowest.set(n.id, o); continue; }
            if (o < low) { lowest.set(n.id, o); continue; }
            if (o >= 44 && low < 44 && !climbedTo44.includes(n.id)) climbedTo44.push(n.id);
        }
        for (const n of state.npcs as any[]) {
            if (n.cultivation.realmOrdinal < FALSE_IMMORTAL_ORDINAL) continue;
            if (seenCrossed.has(n.id)) continue;
            seenCrossed.add(n.id);
            const c = { seed, year: y, who: n.name, id: n.id, ordinal: n.cultivation.realmOrdinal };
            crossings.push(c); allCrossings.push(c);
        }
    }

    const alive = (state.npcs as any[]).filter(n => n.status === 'alive');
    const count = new Map<string, number>(KEYS.map(k => [k, 0]));
    for (const n of alive) {
        const k = realmForOrdinal(n.cultivation.realmOrdinal).key;
        count.set(k, (count.get(k) ?? 0) + 1);
    }
    const share = (k: string) => (100 * (count.get(k) ?? 0) / alive.length);
    const third = (a: number, b: number) => KEYS.slice(a, b).reduce((s, k) => s + (count.get(k) ?? 0), 0);
    const bottom = third(0, 3), middle = third(3, 6), top = third(6, KEYS.length);
    const qi = count.get('qi_condensation') ?? 0;
    const found = count.get('foundation_establishment') ?? 0;
    const topOrd = alive.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), 0);

    console.log(
        seed.padEnd(9),
        String(crossings.length).padStart(5),
        String(topOrd).padStart(7),
        String(alive.length).padStart(6),
        share('qi_condensation').toFixed(1).padStart(6),
        share('foundation_establishment').toFixed(1).padStart(7),
        String(bottom).padStart(7),
        String(middle).padStart(7),
        String(top).padStart(5),
        (found > qi ? '  VIOLATED' : '   holds').padStart(8),
        `   climbed-to-44 ${climbedTo44.length}`
    );
}

const worldYears = SEEDS.length * YEARS;
console.log(`\nASCENSIONS: ${allCrossings.length} over ${worldYears} world-years` +
    `  =  ${(1000 * allCrossings.length / worldYears).toFixed(3)} per world per 1000y`);
const bySeed = new Map<string, number>();
for (const c of allCrossings) bySeed.set(c.seed, (bySeed.get(c.seed) ?? 0) + 1);
console.log(`worlds that produced one: ${bySeed.size} of ${SEEDS.length}`);
for (const c of allCrossings) {
    console.log(`  ${c.seed} y${String(c.year).padStart(5)}  ${c.who} -> ordinal ${c.ordinal}` +
        (c.ordinal === TRUE_IMMORTAL_ORDINAL ? '  TRUE IMMORTAL' : '  False Immortal'));
}
