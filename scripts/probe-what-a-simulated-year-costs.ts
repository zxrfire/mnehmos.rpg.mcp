/**
 * What a simulated year costs, and whether a change to the world moved it.
 *
 *   npx tsx scripts/probe-what-a-simulated-year-costs.ts 50,100,200,400,800,1200,1600
 *   npx tsx scripts/probe-what-a-simulated-year-costs.ts 400 --seeds a,b,c --fingerprint
 *
 * TWO INSTRUMENTS IN ONE, because a performance change has to carry both. The
 * table says what a year costs at each horizon; `--fingerprint` prints a total
 * and characteristic shape of the world that came out, and a change that is
 * only meant to be cheaper has to leave every line of it byte-identical.
 *
 * Cost per year rises with the size of the world's own two append-only arrays,
 * so a figure is only comparable against another taken at the SAME horizon on
 * the SAME tree. Measured on one seed before the lookup indexes went in: 31.2ms
 * per simulated year at 50 years, 32.0 at 400, 103.6 at 1,200 and 147.2 at
 * 1,600. See `OPEN-QUESTIONS.md` for what is still unbounded.
 *
 * To find WHERE the time goes rather than how much of it there is:
 *
 *   node --cpu-prof --cpu-prof-dir=<dir> --import <tsx loader> \
 *       scripts/probe-what-a-simulated-year-costs.ts 1200
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../tests/support/advance-world-years.js';
import type { WorldState } from '../src/engine/world/world-state.js';
import { worldShape } from '../tests/support/the-shape-of-a-world.js';

const args = process.argv.slice(2);
const horizons = (args[0] ?? '50,100,200,400,800').split(',').map(Number);
const seedsArg = args.includes('--seeds') ? args[args.indexOf('--seeds') + 1] : 'perf';
const seeds = seedsArg.split(',');
const wantFingerprint = args.includes('--fingerprint');

const catalog = await loadCultivationCatalog();

/**
 * Enough of the world to notice a simulation that moved.
 *
 * Deliberately not a hash: when one of these does move, the line says WHICH,
 * and a count that changed by one is a different finding from a ledger that
 * changed shape.
 */
function fingerprint(state: WorldState): Record<string, unknown> {
    const shape = worldShape(state);
    const kinds: Record<string, number> = {};
    for (const f of state.history.facts) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
    let standingSum = 0;
    let relCount = 0;
    for (const npc of state.npcs) {
        for (const rel of npc.relationships) {
            standingSum += rel.standing;
            relCount++;
        }
    }
    const factionStandings: Record<string, number> = {};
    for (const f of state.factions) {
        let sum = 0;
        for (const v of Object.values(f.standing)) sum += v;
        let res = 0;
        for (const v of Object.values(f.resources)) res += v;
        factionStandings[f.id] =
            Math.round(sum * 1e6) / 1e6 + res + f.controlledLocationIds.length;
    }
    return {
        day: shape.day,
        livingNpcs: shape.livingNpcs,
        totalNpcs: state.npcs.length,
        facts: shape.facts,
        unresolvedFacts: shape.unresolvedFacts,
        liveFactions: shape.liveFactions,
        dissolvedFactions: shape.dissolvedFactions,
        changedLocations: shape.changedLocations,
        locationChanges: shape.locationChanges,
        inheritedGrudges: shape.inheritedGrudges,
        inheritedFriendships: shape.inheritedFriendships,
        inheritedGoals: shape.inheritedGoals,
        realmHistogram: shape.realmHistogram,
        strongestOrdinal: shape.strongestOrdinal,
        unaccountedFor: shape.unaccountedFor,
        factIdHead: state.history.facts.slice(0, 3).map(f => f.id),
        factIdTail: state.history.facts.slice(-3).map(f => f.id),
        factKinds: kinds,
        relCount,
        standingSum,
        factionStandings
    };
}

const rows: string[] = ['horizon\tseed\tms\tms/year\tnpcs\tfacts'];
for (const horizon of horizons) {
    for (const seed of seeds) {
        const { state } = seedWorld({ seed, catalog });
        const t0 = performance.now();
        advanceWorldYears(state, horizon, { stopOnInterrupt: false });
        const ms = performance.now() - t0;
        rows.push(
            `${horizon}\t${seed}\t${ms.toFixed(0)}\t${(ms / horizon).toFixed(1)}\t` +
            `${state.npcs.length}\t${state.history.facts.length}`
        );
        if (wantFingerprint) {
            console.log(`FINGERPRINT ${horizon} ${seed} ` + JSON.stringify(fingerprint(state)));
        }
    }
}
console.log(rows.join('\n'));
