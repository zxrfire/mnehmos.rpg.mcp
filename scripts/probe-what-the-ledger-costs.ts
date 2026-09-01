/**
 * What the ledger costs: rows, the longest single life, and wall-clock.
 *
 * The three numbers that decide whether the world's own history is a trajectory
 * anybody can follow or a wall of repetitions, and whether carrying it is
 * affordable. Every row is walked by every pass, every back-link and every
 * serialisation, so a duplicate row is not just noise - it is time.
 *
 * Run: npx tsx scripts/probe-what-the-ledger-costs.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const line = (s = '') => console.log(s);
const rule = (t: string) => { line(); line('='.repeat(92)); line('  ' + t); line('='.repeat(92)); };

const YEARS = Number(process.env.YEARS ?? 400);
const SEEDS = (process.env.SEEDS ?? 'ledger-a,ledger-b,ledger-c').split(',');

function longestLife(state: WorldState): { name: string; facts: number; distinct: number } {
    let best = { name: '(nobody)', facts: 0, distinct: 0 };
    const byId = new Map(state.history.facts.map(f => [f.id, f]));
    for (const npc of state.npcs) {
        if (npc.historyFactIds.length <= best.facts) continue;
        const summaries = new Set<string>();
        for (const id of npc.historyFactIds) {
            const f = byId.get(id);
            if (f) summaries.add(f.summary);
        }
        best = { name: npc.name, facts: npc.historyFactIds.length, distinct: summaries.size };
    }
    return best;
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();

    let totalMs = 0;
    for (const seed of SEEDS) {
        const seeded = seedWorld({ seed, catalog });
        const started = Date.now();
        const state = advanceWorldYears(seeded.state, YEARS, { pressure: { eventsPerYear: 1.2 } }).state;
        const ms = Date.now() - started;
        totalMs += ms;

        rule(`${seed}, ${YEARS} years`);
        const facts = state.history.facts;
        line(`  wall-clock            ${(ms / 1000).toFixed(2)}s`);
        line(`  rows                  ${facts.length}`);
        line(`  npcs                  ${state.npcs.length}`);

        const bySummary = new Map<string, number>();
        for (const f of facts) bySummary.set(f.summary, (bySummary.get(f.summary) ?? 0) + 1);
        const repeated = [...bySummary.values()].filter(n => n > 1);
        const wasted = repeated.reduce((sum, n) => sum + (n - 1), 0);
        line(`  distinct summaries    ${bySummary.size}`);
        line(`  rows past the first   ${wasted} (${((wasted / facts.length) * 100).toFixed(1)}% of the ledger)`);

        const byKind = new Map<string, number>();
        for (const f of facts) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
        line('  the heaviest kinds:');
        for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
            line(`    ${kind.padEnd(22)} ${n}`);
        }
        line('  the most repeated single statements:');
        for (const [summary, n] of [...bySummary].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
            line(`    x${String(n).padEnd(4)} ${summary.slice(0, 78)}`);
        }

        const life = longestLife(state);
        line(`  longest life          ${life.name}: ${life.facts} rows, ${life.distinct} distinct statements`);
    }

    rule('TOTAL');
    line(`  ${SEEDS.length} seeds x ${YEARS} years: ${(totalMs / 1000).toFixed(2)}s`);
}

main().catch(err => { console.error(err); process.exit(1); });
