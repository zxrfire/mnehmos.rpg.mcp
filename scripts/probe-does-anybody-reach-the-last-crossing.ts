/**
 * Does anybody climb to ordinal 44, and does anybody ever reach for 45?
 *
 * The goal this serves, in the design owner words: we have to be able to make
 * it to 44-46 without the pyramid collapsing. Arrivals into the 33-44 band are
 * now real - 26 of them over two thousand years - but that band is twelve rungs
 * wide and the interesting question is the top four of it.
 *
 * `applyLastCrossing` fires at 1 / LAST_CROSSING_YEARS per figure per year,
 * where LAST_CROSSING_YEARS is 35,000. With a handful of people standing at 44
 * that is one attempt somewhere in the world every several thousand years, so a
 * horizon short enough to be comfortable proves nothing. This runs long.
 *
 * Counts an arrival as CLIMBED INTO - seen standing on a rung above the lowest
 * one they were ever seen on - because being seeded at 44 is not somebody
 * getting there.
 *
 * Run: npx tsx scripts/probe-does-anybody-reach-the-last-crossing.ts [years] [step]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { FALSE_IMMORTAL_ORDINAL, TRUE_IMMORTAL_ORDINAL, LAST_CROSSING_ORDINAL } from '../src/engine/cultivation/realms.js';

const YEARS = Number(process.argv[2] ?? 6000);
const STEP = Number(process.argv[3] ?? 50);
const catalog = await loadCultivationCatalog();

let state = seedWorld({ seed: process.argv[4] ?? 'last-crossing', catalog }).state as any;
const lowest = new Map<string, number>();
const reached = new Map<number, Set<string>>();   // ordinal -> who climbed to it
const crossings: string[] = [];
const seenImmortal = new Set<string>();

function sample(year: number): void {
    for (const n of state.npcs as any[]) {
        if (n.status !== 'alive') continue;
        const o = n.cultivation.realmOrdinal;
        const low = lowest.get(n.id);
        if (low === undefined) { lowest.set(n.id, o); continue; }
        if (o < low) { lowest.set(n.id, o); continue; }
        // Standing above the lowest rung we ever saw them on means they climbed.
        for (let r = low + 1; r <= o; r++) {
            if (r < 37) continue;                       // only the top of the ladder
            const at = reached.get(r) ?? new Set<string>();
            at.add(n.id); reached.set(r, at);
        }
    }
    // The crossing has three endings and two of them leave somebody standing.
    for (const n of state.npcs as any[]) {
        if (n.cultivation.realmOrdinal < FALSE_IMMORTAL_ORDINAL) continue;
        if (seenImmortal.has(n.id)) continue;
        seenImmortal.add(n.id);
        crossings.push(`year ${year}: ${n.name} reached ordinal ${n.cultivation.realmOrdinal}` +
            ` (${n.cultivation.realmOrdinal === TRUE_IMMORTAL_ORDINAL ? 'TRUE IMMORTAL' : 'False Immortal'})` +
            ` status=${n.status}`);
    }
}

sample(0);
for (let y = STEP; y <= YEARS; y += STEP) {
    state = advanceWorldYears(state, STEP).state;
    sample(y);
    if (y % 1000 === 0) {
        const alive = (state.npcs as any[]).filter(n => n.status === 'alive');
        const top = alive.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), 0);
        const at41 = alive.filter(n => n.cultivation.realmOrdinal >= 41).length;
        console.log(`year ${String(y).padStart(5)}  alive ${String(alive.length).padStart(4)}` +
            `  highest ${top}  standing at 41+ ${at41}`);
    }
}

console.log(`\nCLIMBED TO EACH RUNG OVER ${YEARS} YEARS`);
for (let r = 37; r <= TRUE_IMMORTAL_ORDINAL; r++) {
    const n = reached.get(r)?.size ?? 0;
    if (n === 0 && r > LAST_CROSSING_ORDINAL) continue;
    console.log(`  ordinal ${String(r).padStart(2)}  ${String(n).padStart(4)}` +
        (r === LAST_CROSSING_ORDINAL ? '   <- the last crossing is attempted FROM here' : ''));
}
console.log(`\nCROSSINGS: ${crossings.length}`);
for (const c of crossings) console.log(`  ${c}`);
