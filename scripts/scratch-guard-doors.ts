/**
 * The guard figure: seasonal doors still standing against seasonal doors emptied.
 *
 * `probe-how-often-the-world-opens-a-door.ts` reports `season` and `spent` over
 * EVERY ruin, so the two cannot be intersected from its output. This reports the
 * intersection, which is the number the door-race ruling is guarded on, plus how
 * many houses the world actually put on the road per opening.
 *
 *   npx esbuild scripts/scratch-guard-doors.ts --bundle --platform=node \
 *       --format=esm --external:better-sqlite3 --outfile=guard.mjs && node guard.mjs
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { applyPressure } from '../src/engine/world/pressure.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { howThisGroundIsShut } from '../src/engine/world/a-door-that-closes-is-not-a-door-nobody-opened.js';

const YEAR = 365;

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const seeds = (process.env.SEEDS ?? 'alpha,bravo,charlie').split(',');
    const years = Number(process.env.YEARS ?? 150);

    let cycled = 0;
    let standing = 0;
    let emptied = 0;
    let openNow = 0;
    let parties = 0;
    let knew = 0;
    let openings = 0;
    let ms = 0;
    for (const seed of seeds) {
        const state = seedWorld({ seed, catalog, presentYear: 1000, population: 250 }).state;
        const from = state.currentDay;
        const t0 = Date.now();
        applyPressure(state, from, from + years * YEAR, { maxEvents: 1_000_000 });
        ms += Date.now() - t0;
        const day = Math.floor(state.currentDay);
        for (const ruin of state.locations) {
            if (ruin.kind !== 'ruin' || !ruin.cycle) continue;
            cycled++;
            const read = howThisGroundIsShut(ruin, day);
            if (read.spent) emptied++;
            else if (read.howItIsShut === 'shut_until_its_season') standing++;
            else if (read.howItIsShut === 'open') openNow++;
        }
        for (const fact of state.history.facts) {
            if (fact.data?.pressure !== 'convergence_opened') continue;
            openings++;
            parties += Number(fact.data?.housesOnTheRoad ?? 0);
            knew += Number(fact.data?.housesThatKnewTheDate ?? 0);
        }
    }

    process.stdout.write(
        `seeds ${seeds.length} x ${years}y = ${seeds.length * years} world-years, ${ms} ms\n`
        + `cycled ruins ${cycled}: standing on a season ${standing}, `
        + `open right now ${openNow}, emptied ${emptied}\n`
        + `door openings ${openings}, houses put on the road ${parties} `
        + `(${openings === 0 ? '-' : (parties / openings).toFixed(2)} per opening), `
        + `of them already walking ${knew}\n`
    );
}

void main();
