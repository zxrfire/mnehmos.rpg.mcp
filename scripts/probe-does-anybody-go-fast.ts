/**
 * Does being rich or gifted actually make anybody faster, and is there a tail?
 *
 * The Hollow Court admits at ordinal 29 and age 250 or under, which is not a
 * status check but a PREDICTION: reach Void Refinement that fast and your
 * trajectory ends above the Lid. So the Court is by construction selecting the
 * tail of the age distribution. If the world produces no tail, nobody qualifies,
 * the Court cannot recruit, and every link below that is downstream of one
 * missing thing.
 *
 * Wealth, spirit root and innate attributes all exist in this world. This asks
 * whether any of them shows up as SPEED, measured on the same people rather than
 * across different ones - dwell time between bands for individuals who actually
 * made the transition, split by origin tier and by root and by insight.
 *
 * A world with prodigies has a long left tail on these dwells and a visible gap
 * between the top and bottom of each split. A world without one has neither, and
 * then all the origin and root work is decorative at the level that matters.
 *
 * Run: npx tsx scripts/probe-does-anybody-go-fast.ts [years] [step]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';

const YEARS = Number(process.argv[2] ?? 600);
const STEP = Number(process.argv[3] ?? 5);
const catalog = await loadCultivationCatalog();

const BANDS: [string, number, number][] = [
    ['0-12', 0, 12], ['13-16', 13, 16], ['17-20', 17, 20], ['21-24', 21, 24],
    ['25-28', 25, 28], ['29-32', 29, 32], ['33-44', 33, 44]
];
const bandOf = (o: number): string => BANDS.find(b => o >= b[1] && o <= b[2])![0];

let state = seedWorld({ seed: 'go-fast', catalog }).state as any;
const firstSeen = new Map<string, Map<string, number>>();
const who = new Map<string, any>();

function sample(year: number): void {
    for (const n of state.npcs as any[]) {
        if (n.status !== 'alive') continue;
        who.set(n.id, n);
        let m = firstSeen.get(n.id);
        if (!m) { m = new Map(); firstSeen.set(n.id, m); }
        const b = bandOf(n.cultivation.realmOrdinal);
        if (!m.has(b)) m.set(b, year);
    }
}

sample(0);
for (let y = STEP; y <= YEARS; y += STEP) {
    state = advanceWorldYears(state, STEP).state;
    sample(y);
}

const pct = (xs: number[], p: number): number =>
    xs.length ? xs[Math.min(xs.length - 1, Math.floor(xs.length * p))] : 0;

interface Run { id: string; dwell: number; npc: any }

function runsFor(from: string, to: string): Run[] {
    const out: Run[] = [];
    for (const [id, m] of firstSeen) {
        const a = m.get(from);
        const b = m.get(to);
        if (a === undefined || b === undefined || b <= a) continue;
        // Only people who CLIMBED into `from`, so somebody seeded partway up
        // the band does not contribute a spuriously short dwell.
        const belowIdx = BANDS.findIndex(x => x[0] === from) - 1;
        if (belowIdx >= 0 && !m.has(BANDS[belowIdx][0])) continue;
        out.push({ id, dwell: b - a, npc: who.get(id) });
    }
    return out;
}

for (const [from, to] of [['13-16', '17-20'], ['17-20', '21-24'], ['21-24', '25-28']]) {
    const runs = runsFor(from, to).filter(r => r.npc);
    if (runs.length < 4) { console.log(`\n${from} -> ${to}: only ${runs.length} climbed it, too few to split\n`); continue; }
    const dwells = runs.map(r => r.dwell).sort((x, y) => x - y);
    console.log(`\n${from} -> ${to}   n=${runs.length}`);
    console.log(`  dwell  p5 ${pct(dwells, 0.05)}   p50 ${pct(dwells, 0.5)}   p95 ${pct(dwells, 0.95)}   ` +
        `fastest ${dwells[0]}   slowest ${dwells[dwells.length - 1]}   spread p50/p5 ` +
        `${pct(dwells, 0.05) ? (pct(dwells, 0.5) / pct(dwells, 0.05)).toFixed(2) : '-'}x`);

    const split = (label: string, key: (n: any) => string) => {
        const groups = new Map<string, number[]>();
        for (const r of runs) {
            const k = key(r.npc);
            groups.set(k, [...(groups.get(k) ?? []), r.dwell]);
        }
        const rows = [...groups.entries()]
            .filter(([, v]) => v.length >= 3)
            .map(([k, v]) => ({ k, n: v.length, med: pct(v.sort((a, b) => a - b), 0.5) }))
            .sort((a, b) => a.med - b.med);
        if (rows.length < 2) return;
        console.log(`  by ${label}:`);
        for (const r of rows) console.log(`     ${r.k.padEnd(28)} n=${String(r.n).padStart(3)}  median ${r.med}`);
    };
    split('origin', n => String(n.identity?.origin ?? 'unknown'));
    split('spirit root', n => String(n.cultivation.spiritRoot));
    split('insight', n => 'insight ' + String(n.cultivation.attributes?.insight ?? '?'));
}
