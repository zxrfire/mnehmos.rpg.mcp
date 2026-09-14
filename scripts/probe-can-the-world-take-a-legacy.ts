/**
 * Ground that never shut: what is in it, and how often the world takes one.
 *
 * Three questions off the same worlds:
 *
 *   what the population is   how many never-shut grounds a world opens with,
 *                            and how they split into legacies and treasuries.
 *   what the world takes     grounds tagged `emptied`, and unrecovered stock
 *                            brought out of them, per century.
 *   what the pass costs      wall clock per simulated year, so a legacy pass
 *                            cannot hide a per-place sweep behind a feature.
 *
 *   npx esbuild scripts/probe-can-the-world-take-a-legacy.ts \
 *       --bundle --platform=node --format=esm --external:better-sqlite3 \
 *       --outfile=probe.mjs && node probe.mjs
 *
 * SEEDS and YEARS override the defaults.
 *
 * ── WHAT IT SAID ─────────────────────────────────────────────────────────
 *
 * Before ground that never shut was in `ruin_opened`'s pool, nine pinned
 * worlds run 1,800 years: 13 never-shut grounds, 1 emptied, and that one was a
 * site prospecting minted afterwards. The category the world opens holding was
 * untouchable.
 *
 * After, over alpha/bravo/charlie/echo - 7 never-shut grounds, 48 ruins:
 *
 *     50 years     0 of 7
 *     100 years    4 of 7
 *     200 years    7 of 7
 *
 * The rate is not the gate. The `openable` pool at day 0 is ONE OR TWO
 * LOCATIONS and all of it is never-shut ground, because a never-shut site is
 * `discovered` by construction and a sealed ruin is not until prospecting finds
 * it - so every firing of a weight-8 event lands on this category. 7% to 35% of
 * the living are up to each ground's `mastery`, which is why nothing happens at
 * all until the world's ladder rises and then it goes at once.
 *
 * Cost: 22 to 48 ms per simulated year on a shared box, against 18 to 20 ms
 * reported by `probe-how-often-the-world-opens-a-door.ts` on the same box for a
 * pass with no legacy handling. The added work is one more arm on a filter the
 * pass already ran and one walk of `state.objects` on the branch that just
 * declared a place empty. There is no per-place sweep.
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { applyPressure } from '../src/engine/world/pressure.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { LEFT_TO_BE_FOUND, type LocationRecord } from '../src/engine/world/locations.js';
import { whatThisGroundWasLeftHolding } from '../src/engine/world/a-legacy-has-a-name-on-it-and-a-treasury-has-stock.js';
import { TECHNIQUES } from '../src/data/cultivation/techniques.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const YEAR = 365;

function line(s = ''): void { process.stdout.write(s + '\n'); }

function neverShut(state: WorldState): LocationRecord[] {
    return state.locations.filter(l => l.tags.includes(LEFT_TO_BE_FOUND));
}

interface Tally {
    grounds: number;
    legacies: number;
    treasuries: number;
    emptied: number;
    legaciesEmptied: number;
    treasuriesEmptied: number;
    stockOnTheGround: number;
    stockStillThere: number;
    /** Grounds with somebody in the world at or above the survival threshold. */
    reachable: number;
}

function tallyOf(state: WorldState): Tally {
    const grounds = neverShut(state);
    const ids = new Set(grounds.map(g => g.id));
    const best = state.npcs.reduce(
        (top, n) => n.status === 'alive' ? Math.max(top, n.cultivation.realmOrdinal) : top, 0);
    const out: Tally = {
        grounds: grounds.length,
        legacies: 0, treasuries: 0,
        emptied: 0, legaciesEmptied: 0, treasuriesEmptied: 0,
        stockOnTheGround: 0, stockStillThere: 0,
        reachable: 0
    };
    for (const ground of grounds) {
        const held = whatThisGroundWasLeftHolding(ground);
        const spent = ground.tags.includes('emptied');
        if (held === 'a_legacy') { out.legacies++; if (spent) out.legaciesEmptied++; }
        else { out.treasuries++; if (spent) out.treasuriesEmptied++; }
        if (spent) out.emptied++;
        if (best >= ground.thresholds.survival) out.reachable++;
    }
    for (const object of state.objects) {
        if (object.locationId === null || !ids.has(object.locationId)) continue;
        out.stockOnTheGround++;
        if (object.possessorId === null) out.stockStillThere++;
    }
    return out;
}

/** The two candidate derivations, side by side, before one was settled on. */
function splits(state: WorldState): string {
    const byProvenance = new Map<string, number>();
    const byComposition = new Map<string, number>();
    for (const ground of neverShut(state)) {
        const standing = String(ground.data.provenanceStanding ?? 'none');
        byProvenance.set(standing, (byProvenance.get(standing) ?? 0) + 1);
        const key = `${ground.data.techniqueCount}m/${ground.data.treasureCount}o`;
        byComposition.set(key, (byComposition.get(key) ?? 0) + 1);
    }
    const show = (m: Map<string, number>): string =>
        [...m].sort().map(([k, n]) => `${k}x${n}`).join(' ');
    return `provenance: ${show(byProvenance)} | hoard: ${show(byComposition)}`;
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();
    const years = Number(process.env.YEARS ?? 1800);
    const seeds = (process.env.SEEDS
        ?? 'alpha,bravo,charlie,delta,echo,foxtrot,golf,hotel,india,juliet,kilo,lima').split(',');

    let ruins = 0, grounds = 0, legacies = 0, treasuries = 0;
    let emptied = 0, legaciesEmptied = 0, treasuriesEmptied = 0;
    let stockAtSeeding = 0, stockTaken = 0, reachable = 0, totalMs = 0;

    for (const seed of seeds) {
        const state = seedWorld({ seed, catalog, presentYear: 1000, population: 250 }).state;
        const before = tallyOf(state);
        ruins += state.locations.filter(l => l.kind === 'ruin').length;
        grounds += before.grounds;
        legacies += before.legacies;
        treasuries += before.treasuries;
        stockAtSeeding += before.stockOnTheGround;
        reachable += before.reachable;

        line(`  ${splits(state)}`);
        {
            const living = state.npcs.filter(n => n.status === 'alive');
            const pool = state.locations.filter(l =>
                !l.tags.includes('emptied') && l.discovered &&
                ((l.kind === 'ruin' && l.sealed) || l.tags.includes('ruined')
                    || l.tags.includes(LEFT_TO_BE_FOUND) || l.cycle !== null));
            const upTo = neverShut(state).map(g =>
                `${g.thresholds.mastery}:${living.filter(
                    n => n.cultivation.realmOrdinal >= g.thresholds.mastery).length}`);
            line(`  pool ${pool.length} of which never shut `
                + `${pool.filter(l => l.tags.includes(LEFT_TO_BE_FOUND)).length}`
                + `  living ${living.length}  up to each ground (rung:people) ${upTo.join(' ')}`);
        }

        const from = state.currentDay;
        const t0 = Date.now();
        applyPressure(state, from, from + years * YEAR, { maxEvents: 1_000_000 });
        const ms = Date.now() - t0;
        totalMs += ms;

        const after = tallyOf(state);
        // What the grant actually put into the world, so a legacy pass cannot
        // quietly move the ladder: how many bodies now carry a ruin-only art,
        // and how high anybody below the Lid stands.
        const ruinOnly = new Set(TECHNIQUES
            .filter(t => t.provenance === 'ruin').map(t => t.id));
        const carrying = state.npcs.filter(n =>
            n.cultivation.techniqueIds.some(id => ruinOnly.has(id)));
        const top = state.npcs.reduce(
            (best, n) => n.status === 'alive' ? Math.max(best, n.cultivation.realmOrdinal) : best, 0);
        line(`  carrying a ruin-only art: ${carrying.length}  `
            + `deepest alive: ${top}  arts: ${carrying.flatMap(n =>
                n.cultivation.techniqueIds.filter(id => ruinOnly.has(id))).join(', ')}`);
        emptied += after.emptied;
        legaciesEmptied += after.legaciesEmptied;
        treasuriesEmptied += after.treasuriesEmptied;
        stockTaken += before.stockStillThere - after.stockStillThere;

        line(`SEED ${seed}  never shut ${before.grounds} `
            + `(legacy ${before.legacies} treasury ${before.treasuries}) `
            + `reachable ${before.reachable} stock ${before.stockOnTheGround} `
            + `| after ${years}y: emptied ${after.emptied} `
            + `(legacy ${after.legaciesEmptied} treasury ${after.treasuriesEmptied}) `
            + `stock left ${after.stockStillThere}  ${ms} ms`);
    }

    const worldYears = seeds.length * years;
    line();
    line('POOLED');
    line(`  worlds ${seeds.length}  ruins ${ruins}  never shut ${grounds} `
        + `(${(grounds / Math.max(1, ruins) * 100).toFixed(1)}% of ruins)`);
    line(`  legacies ${legacies}  treasuries ${treasuries}`);
    line(`  somebody alive could survive it: ${reachable}/${grounds}`);
    line(`  emptied over ${worldYears} world-years: ${emptied}/${grounds} `
        + `(legacy ${legaciesEmptied}/${legacies} treasury ${treasuriesEmptied}/${treasuries})`);
    line(`  = ${(emptied / Math.max(1, grounds) / years * 100 * 100).toFixed(2)}% of the `
        + `category consumed per century`);
    line(`  stock at seeding ${stockAtSeeding}, brought out ${stockTaken}`);
    line(`  simulation ${totalMs} ms = ${(totalMs / worldYears).toFixed(2)} ms/simulated year`);
}

void main();
