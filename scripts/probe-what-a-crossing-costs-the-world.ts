/**
 * What the crossing toll actually costs the population, as opposed to the player.
 *
 * WHY THIS EXISTS. `BreakthroughResult.bodyCost` charges a share of the pool at
 * every rung and three times that at a realm boundary, and for a while it bound
 * the player and nobody else, because `NpcCultivation` had no body for it to
 * come out of. Giving the world one closes that; whether the charge then
 * REACHES anybody is a separate question, and a field that nothing ever writes
 * is the defect `AGENTS.md` calls "a field nothing writes is the same defect,
 * one size smaller". This is the instrument that answers it.
 *
 * It walks the world a year at a time and watches the body of every living
 * person, so a charge is observed rather than inferred:
 *
 *   CHARGES        how many times a body dropped, and by what share of the pool
 *   CARRYING       how many are standing below their own pool at the end, which
 *                  is the number that decides whether anything downstream - a
 *                  bout, a competition placing, `assessPower`'s condition line -
 *                  ever meets a body that paid
 *   AT A WALL      deaths the world attributes to a crossing, for scale. The
 *                  toll is charged only on a SUCCESS and clamps above zero, so
 *                  it cannot appear here; the column is what a crossing kills
 *                  anyway.
 *
 * Run: npx tsx scripts/probe-what-a-crossing-costs-the-world.ts [years] [seeds...]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { bodyStandingOn, maxBodyOf } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const YEARS = Number(process.argv[2] ?? 200);
const SEEDS = process.argv.slice(3).length
    ? process.argv.slice(3)
    : ['pyr-a', 'pyr-b', 'pyr-c'];

const catalog = await loadCultivationCatalog();

/** Everybody alive, as id -> what share of their own pool is standing. */
function shares(state: WorldState): Map<string, number> {
    const out = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        const max = maxBodyOf(npc);
        if (max <= 0) continue;
        out.set(npc.id, bodyStandingOn(npc, state.currentDay) / max);
    }
    return out;
}

let pooledCharges = 0;
let pooledTaken = 0;
let pooledDeepest = 0;
let pooledAlive = 0;
let pooledBelow = 0;
let pooledWallDeaths = 0;

for (const seed of SEEDS) {
    let { state } = seedWorld({ seed, catalog });
    let before = shares(state);
    let charges = 0;
    let taken = 0;
    let deepest = 0;

    for (let y = 0; y < YEARS; y++) {
        state = advanceWorldYears(state, 1).state;
        const after = shares(state);
        for (const [id, share] of after) {
            const was = before.get(id);
            // A DROP is the observation. Mending only ever raises the share and
            // a rung change carries it, so anything that falls was charged.
            if (was !== undefined && share < was - 1e-9) {
                charges++;
                taken += was - share;
                deepest = Math.max(deepest, was - share);
            }
        }
        before = after;
    }

    const alive = [...before.keys()].length;
    const below = [...before.values()].filter(s => s < 0.999).length;
    const wallDeaths = state.npcs.filter(
        n => n.status !== 'alive' && /crossing|tribulation/i.test(n.endNote)
    ).length;

    console.log(
        `${seed}: ${charges} charges over ${YEARS}y, mean ${(charges ? taken / charges : 0).toFixed(3)} `
        + `of the pool, deepest ${deepest.toFixed(3)}; ${below} of ${alive} alive standing below `
        + `their own pool at the end; ${wallDeaths} died at a wall`
    );

    pooledCharges += charges;
    pooledTaken += taken;
    pooledDeepest = Math.max(pooledDeepest, deepest);
    pooledAlive += alive;
    pooledBelow += below;
    pooledWallDeaths += wallDeaths;
}

console.log(
    `\npooled over ${SEEDS.length} seeds: ${pooledCharges} charges, mean `
    + `${(pooledCharges ? pooledTaken / pooledCharges : 0).toFixed(3)} of the pool, deepest `
    + `${pooledDeepest.toFixed(3)}; ${pooledBelow} of ${pooledAlive} alive carrying one at the `
    + `end; ${pooledWallDeaths} deaths at a wall.`
);
