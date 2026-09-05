/**
 * HOW MANY PEOPLE WERE BORN AS SOMETHING, AND HOW MANY ARE STILL STANDING.
 *
 * `engine/cultivation/physiques.ts` makes a rarity claim, and AGENTS.md is
 * specific that rarity here is a POPULATION STATEMENT rather than a price. The
 * claim has two halves and this measures both:
 *
 *   200 births in ten thousand carry something.
 *   FEWER PEOPLE ARE STANDING WITH ONE THAN WERE BORN WITH ONE.
 *
 * The second half is not a rule anybody wrote. It falls out of `lifespan` being
 * 0.35 on the two rows that are worth anything to somebody else, and it is the
 * whole content of the axis: the ones who are alive to be wanted are rarer than
 * the ones who were born, and everybody in the market knows it.
 *
 * ── MEASURED, and what tree it was measured on ──────────────────────────
 *
 * `body-a body-b body-c`, 200 years, 2026-09-04:
 *
 *   5,136 people ever on the roll, 1,619 alive at the end.
 *   ever born carrying something   103   2.01%   (catalog says 2.00%)
 *   alive carrying something        38   2.35%
 *
 *   profound_yin    lifespan x0.35   ever   12   alive    0    0.0% still standing
 *   pure_yang       lifespan x0.35   ever   16   alive    1    6.3% still standing
 *   hollow_marrow   lifespan x1.8    ever   75   alive   37   49.3% still standing
 *   an ordinary body                 ever 5033   alive 1581   31.4% still standing
 *
 * So a body worth taking is roughly NINE TIMES less likely to still be standing
 * than an ordinary one - 1 of 28, against 31.4% - and there is about one such
 * person alive across three whole provinces at any given moment, against
 * twenty-eight born over two centuries. That gap IS the claim, and it is not a
 * rule anybody wrote: `lifespan` is 0.35 and the arithmetic does the rest.
 *
 * ** A TUNING QUESTION FOR A PERSON, NOT FOR AN AGENT. ** One alive per three
 * provinces may be too rare to be met. The lever is one weight in the catalog
 * and this probe re-measures it, so raising it is a one-line data change - but
 * whether the girl in the square should be one-in-a-generation or one-per-town
 * is a design call and is deliberately left open rather than tuned to a number
 * an agent invented. The player's own odds are the other route in: 8 runs in a
 * thousand open as somebody carrying one.
 *
 * ── HALF OF EVERY DEALT PHYSIQUE IS DISCARDED, AND THAT IS THE POINT ────
 *
 * `createNpc` throws away a rolled physique whose own ceiling is already below
 * the age the person is being seeded at, because somebody standing here at sixty
 * could not have got here in a body that is finished at thirty-five. Measured
 * over four fresh worlds: 63 dealt, 31 kept, 32 discarded, and ZERO living
 * seeded people past their own span. Without that check half the physiques in a
 * fresh world are on bodies that could not exist.
 *
 * ── AND THE HONEST CAVEAT, WHICH IS AGENTS.md's OWN ─────────────────────
 *
 * Both readings were taken off a SHARED WORKING TREE with several other agents'
 * uncommitted catalog work in it, during a live place-name and content sweep. An
 * earlier run of this same probe, twenty minutes before, gave 5,187 / 1,597 /
 * 118 / 35 - the same story, different digits, because the catalog underneath
 * moved between the two. So read the ORDERING here and not the third digit: a
 * body that does not last is several times likelier to be gone, and that
 * comparison is internal to a single run and immune to the tree.
 *
 * If a content pass moves the weights or the lifespan figures, RUN THIS AGAIN
 * rather than reasoning from the new weight. The birth rate and the standing
 * rate are different numbers and only one of them is in the catalog.
 *
 * ── AND IT NAMES THE SEEDS THE PLAYED TEST PINS ─────────────────────────
 *
 * `tests/web/a-body-you-were-born-as-is-something-you-can-read.test.ts` has to
 * open a run as somebody carrying one, which is 4 births in a thousand. The
 * sweep below prints the first run seed that lands on each row, and that is
 * where `physique-seed-179` comes from.
 *
 * Run: npx tsx scripts/probe-a-body-somebody-was-born-as.ts [years] [seeds...]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { forStream } from '../src/engine/cultivation/rng.js';
import {
    PHYSIQUES,
    PHYSIQUE_WEIGHT_TOTAL,
    rollPhysique
} from '../src/engine/cultivation/physiques.js';

const YEARS = Number(process.argv[2] ?? 200);
const SEEDS = process.argv.slice(3).length
    ? process.argv.slice(3)
    : ['body-a', 'body-b', 'body-c'];

// ── THE RUN SEEDS THAT OPEN AS SOMEBODY ─────────────────────────────────
const SWEEP = 4000;
const firstSeedFor = new Map<string, string>();
const sweptCounts = new Map<string, number>();
for (let i = 0; i < SWEEP; i++) {
    const seed = `physique-seed-${i}`;
    const p = rollPhysique(forStream(seed, 'creation', 'physique').next());
    if (!p) continue;
    sweptCounts.set(p.key, (sweptCounts.get(p.key) ?? 0) + 1);
    if (!firstSeedFor.has(p.key)) firstSeedFor.set(p.key, seed);
}
console.log(`Run seeds swept: ${SWEEP}`);
for (const p of PHYSIQUES) {
    const n = sweptCounts.get(p.key) ?? 0;
    console.log(
        `  ${p.key.padEnd(14)} ${String(n).padStart(3)}/${SWEEP} = `
        + `${(100 * n / SWEEP).toFixed(2)}%  (catalog ${(100 * p.weight / PHYSIQUE_WEIGHT_TOTAL).toFixed(2)}%)`
        + `  first: ${firstSeedFor.get(p.key) ?? '-'}`
    );
}

// ── THE WORLD, BEFORE AND AFTER IT HAS RUN ──────────────────────────────
const catalog = await loadCultivationCatalog();
let everBorn = 0, bornWith = 0, alive = 0, aliveWith = 0;
const bornBy = new Map<string, number>();
const aliveBy = new Map<string, number>();

for (const seed of SEEDS) {
    let { state } = seedWorld({ seed, catalog });
    state = advanceWorldYears(state, YEARS).state;
    for (const npc of state.npcs) {
        everBorn++;
        const key = npc.identity.physique;
        if (key) { bornWith++; bornBy.set(key, (bornBy.get(key) ?? 0) + 1); }
        if (npc.status !== 'alive') continue;
        alive++;
        if (key) { aliveWith++; aliveBy.set(key, (aliveBy.get(key) ?? 0) + 1); }
    }
}

const pct = (n: number, d: number) => `${(100 * n / Math.max(1, d)).toFixed(2)}%`;
console.log(`\n${SEEDS.length} seeds, ${YEARS} years.`);
console.log(`  ${everBorn} people ever on the roll, ${alive} alive at the end.`);
console.log(`  ever born carrying: ${bornWith} = ${pct(bornWith, everBorn)}`);
console.log(`  alive carrying:     ${aliveWith} = ${pct(aliveWith, alive)}`);
for (const p of PHYSIQUES) {
    const b = bornBy.get(p.key) ?? 0;
    const a = aliveBy.get(p.key) ?? 0;
    console.log(
        `  ${p.key.padEnd(14)} lifespan x${String(p.lifespan).padEnd(5)} `
        + `ever ${String(b).padStart(4)}  alive ${String(a).padStart(4)}  `
        + `still standing ${pct(a, b)}`
    );
}
console.log(
    `  ${'an ordinary body'.padEnd(14)} lifespan x1     `
    + `ever ${String(everBorn - bornWith).padStart(4)}  alive ${String(alive - aliveWith).padStart(4)}  `
    + `still standing ${pct(alive - aliveWith, everBorn - bornWith)}`
);
