/**
 * How long does a cultivator actually spend in each band, measured on the same
 * people rather than across different ones?
 *
 * WHY THE OBVIOUS READING IS WRONG. A table of median age per band looks like a
 * table of dwell times and is not one. Each row is a DIFFERENT POPULATION, and
 * the upper rows are selected for having climbed fast enough to be there at all.
 * Read cross-sectionally, this world says band 21-24 to 25-28 costs 246 years
 * and band 25-28 to 29-32 costs 52 - a stretch that is three times more
 * expensive in qi taking a fifth of the time. That cannot be a transition time.
 * It is survivorship, on n=3.
 *
 * So this follows individuals. Sample the world every few years, record the
 * first year each person is seen in each band, and count a dwell only where the
 * SAME person is later seen in the band above. Anybody who never makes the
 * transition contributes nothing, which is the honest thing for a dwell time and
 * is also why the funnel counts beside it matter more than the durations.
 *
 * Run: npx tsx scripts/probe-where-do-the-years-go.ts [years] [step]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { progressRequiredForOrdinal } from '../src/engine/cultivation/realms.js';

const YEARS = Number(process.argv[2] ?? 500);
const STEP = Number(process.argv[3] ?? 5);
const catalog = await loadCultivationCatalog();

const BANDS: [string, number, number][] = [
    ['0-12', 0, 12], ['13-16', 13, 16], ['17-20', 17, 20], ['21-24', 21, 24],
    ['25-28', 25, 28], ['29-32', 29, 32], ['33-44', 33, 44]
];
const bandOf = (o: number): string => BANDS.find(b => o >= b[1] && o <= b[2])![0];

let state = seedWorld({ seed: 'years-go', catalog }).state as any;
/** npcId -> band -> first year seen standing in it. */
const firstSeen = new Map<string, Map<string, number>>();

function sample(year: number): void {
    for (const n of state.npcs as any[]) {
        if (n.status !== 'alive') continue;
        const b = bandOf(n.cultivation.realmOrdinal);
        let m = firstSeen.get(n.id);
        if (!m) { m = new Map(); firstSeen.set(n.id, m); }
        if (!m.has(b)) m.set(b, year);
    }
}

sample(0);
for (let y = STEP; y <= YEARS; y += STEP) {
    state = advanceWorldYears(state, STEP).state;
    sample(y);
}

console.log(`sampled every ${STEP}y to ${YEARS}y, ${firstSeen.size} people ever seen alive\n`);
console.log('transition        completed   median dwell   min   max      cost      implied years');
console.log('-'.repeat(90));
for (let i = 1; i < BANDS.length; i++) {
    const from = BANDS[i - 1][0];
    const to = BANDS[i][0];
    const dwells: number[] = [];
    for (const m of firstSeen.values()) {
        const a = m.get(from);
        const b = m.get(to);
        // Only where the same person was seen in both, in order. Somebody
        // seeded straight into the upper band has no dwell to report.
        if (a === undefined || b === undefined || b <= a) continue;
        dwells.push(b - a);
    }
    let cost = 0;
    for (let o = BANDS[i - 1][1]; o <= BANDS[i - 1][2]; o++) cost += progressRequiredForOrdinal(o) ?? 0;
    dwells.sort((x, y2) => x - y2);
    const median = dwells.length ? dwells[Math.floor(dwells.length / 2)] : 0;
    console.log(
        `${from} -> ${to}`.padEnd(18),
        String(dwells.length).padStart(9),
        String(median).padStart(14),
        String(dwells.length ? dwells[0] : 0).padStart(5),
        String(dwells.length ? dwells[dwells.length - 1] : 0).padStart(5),
        String(cost).padStart(10),
        (median ? (cost / median).toFixed(0) : '-').padStart(16) + ' qi/yr'
    );
}
