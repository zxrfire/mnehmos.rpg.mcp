/**
 * Scratch: per-year cost of `advanceWorldYears`, and a fingerprint of what the
 * world produced, so a performance change can be proved not to have moved the
 * simulation.
 *
 *   npx tsx scripts/scratch-perf-table.ts 50,100,200,400,800 > out.txt
 *   npx tsx scripts/scratch-perf-table.ts 400 --seeds a,b,c --fingerprint
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears, worldShape } from '../src/engine/world/driver.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const args = process.argv.slice(2);
const horizons = (args[0] ?? '50,100,200,400,800').split(',').map(Number);
const seedsArg = args.includes('--seeds') ? args[args.indexOf('--seeds') + 1] : 'perf';
const seeds = seedsArg.split(',');
const wantFingerprint = args.includes('--fingerprint');

const catalog = await loadCultivationCatalog();

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

const rows: string[] = [];
rows.push('horizon\tseed\tms\tms/year\tnpcs\tfacts');
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
