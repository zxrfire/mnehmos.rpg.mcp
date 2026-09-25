/**
 * How far up the ladder sitting still gets a beast, and what asking costs.
 *
 *   npx tsx scripts/probe-what-a-beast-becomes-if-nobody-kills-it.ts [seed]
 *
 * Two questions, and the second is the one the design turned on.
 *
 *   HOW MANY EVER STAND UP. Over every cored species on a spread of ground,
 *   at a spread of horizons: how many have moved a rung and how many are past
 *   `BEAST_CHANGE_ORDINAL`. The ruling this answers is *"the top doesn't have
 *   to grow but beasts should eventually hit 29 naturally"* - both halves.
 *
 *   WHAT IT COSTS THE ADVANCE. The world advance is already superlinear, so
 *   the climb had to be a reading rather than a sweep. This times the reading
 *   against the human branch it replaces in `applyAdvancement`, and times a
 *   simulated year with and without beast rows standing in the world.
 *
 * No provider, no model, no network.
 */

import {
    thePaceThisOneKeeps,
    whatTheYearsDidToTheOneHere
} from '../src/engine/world/a-beast-climbs-by-sitting-where-it-is.js';
import {
    standUpTheOneOnThisGround,
    theSpeciesItIs
} from '../src/engine/world/a-beast-with-a-core-is-somebody-in-particular.js';
import type { WorldState } from '../src/engine/world/world-state.js';
import { BEASTS, BEAST_CHANGE_ORDINAL } from '../src/data/cultivation/beasts.js';
import { hasACore } from '../src/engine/world/hunting-a-spirit-beast.js';
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../tests/support/advance-world-years.js';
import { rankName } from '../src/engine/cultivation/realms.js';

const SEED = process.argv[2] ?? 'beast-climb-probe';
const GROUNDS = Array.from({ length: 200 }, (_, i) => `ground-${i}`);
const HORIZONS = [0, 200, 400, 800, 1200, 2000, 5000];
const cored = BEASTS.filter(hasACore);

function howManyStandUp(): void {
    console.log('WHAT SITTING STILL DOES, OVER EVERY CORED SPECIES ON 200 PIECES OF GROUND');
    const pairs = cored.length * GROUNDS.length;
    const never = cored.flatMap(beast => GROUNDS.filter(
        ground => thePaceThisOneKeeps({ beast, locationId: ground, worldSeed: SEED }) === 0));
    console.log(`  ${pairs} species/ground pairs, of which ${never.length} `
        + `(${Math.round(100 * never.length / pairs)}%) never move at all`);
    for (const years of HORIZONS) {
        let moved = 0;
        let crossed = 0;
        let newlyCrossed = 0;
        for (const beast of cored) {
            for (const ground of GROUNDS) {
                const sat = whatTheYearsDidToTheOneHere({
                    beast, locationId: ground, worldSeed: SEED, years
                });
                if (sat.rungsClimbed > 0) moved++;
                if (sat.crossed) crossed++;
                if (sat.crossed && beast.ordinal < BEAST_CHANGE_ORDINAL) newlyCrossed++;
            }
        }
        console.log(
            `  ${String(years).padStart(5)}y  moved ${String(moved).padStart(5)} `
            + `(${String(Math.round(100 * moved / pairs)).padStart(2)}%)   `
            + `past the change ${String(crossed).padStart(5)} `
            + `(${String(Math.round(100 * crossed / pairs)).padStart(2)}%)   `
            + `of which stood up rather than authored ${newlyCrossed}`);
    }

    console.log('\nWHICH SPECIES GET THERE, AND HOW LONG THE FIRST ONE TAKES');
    for (const beast of cored.filter(b => b.ordinal < BEAST_CHANGE_ORDINAL)) {
        let first: number | null = null;
        for (const years of [200, 400, 800, 1200, 2000, 5000, 20_000]) {
            const any = GROUNDS.some(ground => whatTheYearsDidToTheOneHere({
                beast, locationId: ground, worldSeed: SEED, years
            }).crossed);
            if (any) { first = years; break; }
        }
        const top = Math.max(...GROUNDS.map(ground => whatTheYearsDidToTheOneHere({
            beast, locationId: ground, worldSeed: SEED, years: 5000
        }).ordinal));
        console.log(`  ${beast.id.padEnd(34)} ${String(beast.ordinal).padStart(2)} -> `
            + `${String(top).padStart(2)} (${rankName(top)}) at 5,000y; first crossing by `
            + `${first === null ? 'never' : `${first}y`}`);
    }
}

async function whatItCosts(): Promise<void> {
    const catalog = await loadCultivationCatalog();

    console.log('\nWHAT ONE READING COSTS');
    const beast = cored[0];
    const runs = 200_000;
    const started = performance.now();
    let sink = 0;
    for (let i = 0; i < runs; i++) {
        sink += whatTheYearsDidToTheOneHere({
            beast, locationId: GROUNDS[i % GROUNDS.length], worldSeed: SEED, years: 3000
        }).ordinal;
    }
    const each = (performance.now() - started) / runs;
    console.log(`  ${runs} readings in ${Math.round(each * runs)}ms - `
        + `${(each * 1000).toFixed(2)}us each (sink ${sink})`);

    console.log('\nWHAT A SIMULATED YEAR COSTS, WITH AND WITHOUT BEASTS STANDING IN IT');
    for (const howMany of [0, 25, 100]) {
        const { state } = seedWorld({ seed: `${SEED}-cost`, catalog });
        const ground = state.locations.filter(l => l.kind !== 'region');
        for (let i = 0; i < howMany; i++) {
            const species = cored[i % cored.length];
            const where = ground[i % ground.length];
            if (state.npcs.some(n => n.locationId === where.id
                && n.tags.includes(`beast:${species.id}`))) continue;
            state.npcs.push(standUpTheOneOnThisGround({
                beast: species,
                locationId: where.id,
                seed: state.seed,
                onDay: state.currentDay
            }));
        }
        const years = 200;
        const at = performance.now();
        advanceWorldYears(state, years);
        const ms = performance.now() - at;
        console.log(`  ${String(howMany).padStart(3)} beast rows  ${Math.round(ms)}ms for `
            + `${years} years  (${(ms / years).toFixed(1)}ms/year, `
            + `${state.npcs.filter(n => n.status === 'alive').length} alive at the end)`);
        if (howMany > 0) howManyOfThemDied(state, howMany, years);
    }
}

/**
 * The lid, measured off the same walk rather than off a second one.
 *
 * The ruling this answers is that there is no cap on the climb and mortality
 * is the whole of it, so the figure that matters is what share of them are
 * still standing at the end of a span and what the dead left behind.
 */
function howManyOfThemDied(state: WorldState, stood: number, years: number): void {
    const rows = state.npcs.filter(n => theSpeciesItIs(n) !== null);
    const dead = rows.filter(n => n.status !== 'alive');
    const bodies = state.objects.filter(o => o.tags.includes('off_a_body_nobody_claimed'));
    const onTheGround = state.statuses.filter(s => s.kind === 'a_body_on_the_ground');
    const top = rows.reduce((best, n) => Math.max(best, n.cultivation.realmOrdinal), 0);
    console.log(`       of ${stood} stood up, ${dead.length} dead in ${years} years `
        + `(${(100 * dead.length / Math.max(1, rows.length)).toFixed(0)}%), `
        + `${bodies.length} piece(s) of body lying about, ${onTheGround.length} body status(es) `
        + `written, deepest survivor at ${top}`);
}

howManyStandUp();
await whatItCosts();
