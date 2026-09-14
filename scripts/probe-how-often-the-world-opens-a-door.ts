/**
 * How often the world opens a door on its own, and what the pass costs.
 *
 * Three questions in one sweep, because they are answered off the same worlds:
 *
 *   how long the cycles are    the distribution of `periodDays`, in years.
 *   how many doors move        `convergence_opened` and `convergence_closed`
 *                              facts per century, which is the count that was
 *                              zero.
 *   what the pass costs        wall clock over the same span, per simulated
 *                              year, so a door-opening pass cannot hide a
 *                              per-year cost behind a nice-sounding feature.
 *
 *   npx esbuild scripts/probe-how-often-the-world-opens-a-door.ts \
 *       --bundle --platform=node --format=esm --external:better-sqlite3 \
 *       --outfile=probe.mjs && node probe.mjs
 *
 * SEEDS and YEARS override the defaults.
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { applyPressure } from '../src/engine/world/pressure.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { howThisGroundIsShut } from '../src/engine/world/a-door-that-closes-is-not-a-door-nobody-opened.js';
import { nextOpeningDay } from '../src/engine/world/locations.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const YEAR = 365;

function line(s = ''): void { process.stdout.write(s + '\n'); }

/**
 * `emit` files the pressure kind in `data.pressure`; the fact's own `kind` is
 * the scale word (`opportunity`). The first cut of this probe filtered on
 * `fact.kind === 'convergence_opened'`, which is never true of anything, and
 * would have reported zero doors however well the pass worked.
 */
function doorFacts(state: WorldState, pressureKind: string): number {
    return state.history.facts.filter(f => f.data?.pressure === pressureKind).length;
}

function doorCounts(state: WorldState, label: string): void {
    const ruins = state.locations.filter(l => l.kind === 'ruin');
    const day = Math.floor(state.currentDay);
    let cycled = 0, open = 0, season = 0, somebody = 0, spent = 0;
    const periods: number[] = [];
    const windows: number[] = [];
    for (const r of ruins) {
        const read = howThisGroundIsShut(r, day);
        if (r.cycle) {
            cycled++;
            periods.push(Math.round(r.cycle.periodDays / YEAR));
            windows.push(r.cycle.openDays);
        }
        if (read.howItIsShut === 'open') open++;
        else if (read.howItIsShut === 'shut_until_its_season') season++;
        else somebody++;
        if (read.spent) spent++;
    }
    const opened = doorFacts(state, 'convergence_opened');
    const closed = doorFacts(state, 'convergence_closed');
    // `nextOpeningDay` used to answer null for anything sealed, and every cycled
    // ruin is sealed, so the pass that asked it opened nothing. The schedule is
    // now the authority and the column is a reading of it, so there is one
    // expression again rather than two; this counts how many cycled rows it can
    // name a day for, which was 3 of 72 and should be all of them.
    let canName = 0;
    for (const r of ruins) {
        if (!r.cycle) continue;
        if (nextOpeningDay(r, day) !== null) canName++;
    }
    line(`  ${label}: ruins ${ruins.length} cycled ${cycled} open ${open} `
        + `season ${season} somebody ${somebody} spent ${spent} `
        + `| opened ${opened} closed ${closed}`
        + ` | schedule readable ${canName}/${cycled}`);
    if (periods.length > 0) {
        const tally = new Map<number, number>();
        for (const p of periods) tally.set(p, (tally.get(p) ?? 0) + 1);
        line(`    periods(years): ${[...tally].sort((a, b) => a[0] - b[0])
            .map(([p, n]) => `${p}x${n}`).join(' ')}`);
        const sw = [...windows].sort((a, b) => a - b);
        line(`    windows(days): min ${sw[0]} median ${sw[Math.floor(sw.length / 2)]} `
            + `max ${sw[sw.length - 1]}`);
    }
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const years = Number(process.env.YEARS ?? 200);
    const seeds = (process.env.SEEDS
        ?? 'alpha,bravo,charlie,delta,echo,foxtrot,golf,hotel,india,juliet,kilo,lima').split(',');

    let totalOpened = 0, totalClosed = 0, totalMs = 0, totalCycled = 0, totalRuins = 0;
    const allPeriods: number[] = [];
    for (const seed of seeds) {
        const state = seedWorld({ seed, catalog, presentYear: 1000, population: 250 }).state;
        line(`SEED ${seed}`);
        doorCounts(state, 'day 0');
        for (const r of state.locations) {
            if (r.kind === 'ruin') {
                totalRuins++;
                if (r.cycle) { totalCycled++; allPeriods.push(Math.round(r.cycle.periodDays / YEAR)); }
            }
        }
        const from = state.currentDay;
        const t0 = Date.now();
        applyPressure(state, from, from + years * YEAR, { maxEvents: 1_000_000 });
        const ms = Date.now() - t0;
        totalMs += ms;
        doorCounts(state, `${years} years`);
        const opened = doorFacts(state, 'convergence_opened');
        const closed = doorFacts(state, 'convergence_closed');
        totalOpened += opened;
        totalClosed += closed;
        line(`    ${ms} ms for ${years} years = ${(ms / years).toFixed(2)} ms/simulated year`);
        line();
    }

    const tally = new Map<number, number>();
    for (const p of allPeriods) tally.set(p, (tally.get(p) ?? 0) + 1);
    line('POOLED');
    line(`  worlds ${seeds.length}  ruins ${totalRuins}  with a cycle ${totalCycled}`);
    line(`  period distribution(years): ${[...tally].sort((a, b) => a[0] - b[0])
        .map(([p, n]) => `${p}x${n}`).join(' ')}`);
    line(`  doors opened ${totalOpened}  shut ${totalClosed}  over ${seeds.length * years} world-years`);
    line(`  = ${(totalOpened / (seeds.length * years) * 100).toFixed(2)} openings per century per world`);
    line(`  simulation ${totalMs} ms total = ${(totalMs / (seeds.length * years)).toFixed(2)} ms/simulated year`);
}

void main();
