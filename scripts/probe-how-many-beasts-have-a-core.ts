/**
 * How many beasts at `BEAST_CORE_ORDINAL` or above would a world hold if a
 * cored beast got a row?
 *
 * Measured BEFORE building anything: a careless per-entity store on this world
 * has already been measured at 28,488 rows at a thousand years.
 *
 * Run: npx tsx scripts/probe-how-many-beasts-have-a-core.ts
 */

import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { beastsOnThisGround } from '../src/engine/world/hunting-a-spirit-beast.js';
import { BEAST_CORE_ORDINAL, BEAST_CHANGE_ORDINAL } from '../src/data/cultivation/beasts.js';
import type { WorldState } from '../src/engine/world/world-state.js';


const line = (s = '') => console.log(s);

/** The four interior kinds. A room inside a compound is not ground. */
const INTERIOR = new Set(['precinct', 'hall', 'chamber', 'vault']);

function groundOf(l: any): { sealed: boolean; onAVein: boolean } {
    return {
        sealed: Boolean(l.sealed),
        onAVein: (l.qiDensity ?? 0) >= 60
            || Boolean(l.environment?.resources?.includes?.('qi'))
    };
}

function report(label: string, state: WorldState): void {
    const locs = state.locations;
    const outdoor = locs.filter(l => !INTERIOR.has(l.kind));
    const byKind = new Map<string, number>();
    for (const l of locs) byKind.set(l.kind, (byKind.get(l.kind) ?? 0) + 1);

    const slots = (set: readonly any[], floor: number) => set.reduce((sum, l) =>
        sum + beastsOnThisGround(groundOf(l)).filter(b => b.ordinal >= floor).length, 0);

    const alive = state.npcs.filter(n => n.status === 'alive');
    const atOrAbove = (n: number) =>
        alive.filter(p => p.cultivation.realmOrdinal >= n).length;

    line();
    line(`── ${label} ${'─'.repeat(Math.max(0, 50 - label.length))}`);
    line(`  day                            ${Math.floor(state.currentDay)}`);
    line(`  locations (all)                ${locs.length}`);
    line(`  locations (ground, not rooms)  ${outdoor.length}`);
    line(`  npc rows (all)                 ${state.npcs.length}`);
    line(`  npc rows (alive)               ${alive.length}`);
    line(`    alive at ordinal 0           ${alive.filter(p => p.cultivation.realmOrdinal === 0).length}`);
    line(`    alive at >= ${BEAST_CORE_ORDINAL}                ${atOrAbove(BEAST_CORE_ORDINAL)}`);
    line(`    alive at >= ${BEAST_CHANGE_ORDINAL}                ${atOrAbove(BEAST_CHANGE_ORDINAL)}`);
    line(`  facts                          ${state.history.facts.length}`);
    line(`  objects                        ${(state as any).objects?.length ?? 0}`);
    line();
    line('  IF EVERY PIECE OF GROUND HELD EVERY SPECIES IT COULD (the naive shape):');
    line(`    over all locations,  >=${BEAST_CORE_ORDINAL}   ${slots(locs, BEAST_CORE_ORDINAL)}`);
    line(`    over ground only,    >=${BEAST_CORE_ORDINAL}   ${slots(outdoor, BEAST_CORE_ORDINAL)}`);
    line(`    over ground only,    >=${BEAST_CHANGE_ORDINAL}   ${slots(outdoor, BEAST_CHANGE_ORDINAL)}`);
    line();
    line(`  kinds: ${[...byKind.entries()].sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k}=${n}`).join(' ')}`);
}

async function main(): Promise<void> {
    const catalog = await loadCultivationCatalog();

    const t0 = Date.now();
    const seeded = seedWorld({ seed: 'cored-beast-measure', catalog });
    line(`seedWorld: ${Date.now() - t0} ms`);
    let state = seeded.state;

    report('DAY 0', state);

    const t1 = Date.now();
    state = advanceWorldYears(state, 200).state;
    const advMs = Date.now() - t1;

    report('AFTER 200 YEARS', state);
    line();
    line(`  advanceWorldYears(200): ${advMs} ms  (${(advMs / 200).toFixed(1)} ms/year)`);
}

main().catch(err => { console.error(err); process.exit(1); });
