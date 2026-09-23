/**
 * Does the world end somebody a catalog states is standing?
 *
 * Run: npx tsx scripts/probe-does-the-world-contradict-what-a-catalog-states.ts [years] [worlds]
 *
 * ── BOTH ARMS IN ONE COMMAND, AND NEITHER IS A RERUN ─────────────────────
 *
 * The arm is the TAG rather than the code: one seeded world is copied, the
 * `catalog-states:standing` tag is stripped from the copy, and both are advanced
 * the same number of years in the same process against the same tree. So there
 * is no stash, no toggle of a source line, and no second run minutes later
 * reading a tree six other people are editing.
 *
 * The unguarded arm is what makes the guarded one worth anything: it says the
 * passes ACTUALLY FIRE on the path being measured. A guard over a pass that
 * never triggers proves nothing, and "0 of 24" with nothing having tried is a
 * false clean bill.
 *
 * It names nobody. The subjects are whoever the catalogs state, so a second one
 * is measured by the same run on the day somebody adds the field.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import {
    CATALOG_STATES_STANDING_TAG,
    theCatalogStatesTheyAreStanding,
    type NpcRecord
} from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const years = Number(process.argv[2] ?? 200);
const worlds = Number(process.argv[3] ?? 24);

interface Row {
    seed: string;
    id: string;
    name: string;
    from: number;
    to: number;
    status: string;
    note: string;
}

function readThem(state: WorldState, watch: readonly { id: string; name: string; from: number }[], seed: string): Row[] {
    return watch.map(who => {
        const now = state.npcs.find((n: NpcRecord) => n.id === who.id);
        return {
            seed,
            id: who.id,
            name: who.name,
            from: who.from,
            to: now?.cultivation.realmOrdinal ?? -1,
            status: now?.status ?? 'deleted',
            note: now?.endNote ?? ''
        };
    });
}

function report(label: string, rows: Row[]): void {
    const byStatus = new Map<string, number>();
    for (const r of rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    const ended = rows.filter(r => r.status !== 'alive');
    console.log(`\n${label}`);
    for (const [status, n] of [...byStatus].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${status.padEnd(20)} ${n}`);
    }
    console.log(`    climbed a rung or more: ${rows.filter(r => r.to > r.from).length} of ${rows.length}`);
    console.log(`    ended by the world:     ${ended.length} of ${rows.length}`);
    for (const r of ended) {
        console.log(`      ${r.seed.padEnd(14)} ${r.name} ${r.status} - ${r.note}`);
    }
}

const catalog = await loadCultivationCatalog();
const guarded: Row[] = [];
const unguarded: Row[] = [];

for (let i = 0; i < worlds; i++) {
    const seed = `standing-${i}`;
    const { state } = seedWorld({ seed, catalog });
    const watch = state.npcs.filter(theCatalogStatesTheyAreStanding)
        .map(n => ({ id: n.id, name: n.name, from: n.cultivation.realmOrdinal }));
    if (watch.length === 0) continue;

    const withoutTheClaim = structuredClone(state) as WorldState;
    for (const npc of withoutTheClaim.npcs) {
        npc.tags = npc.tags.filter((t: string) => t !== CATALOG_STATES_STANDING_TAG);
    }

    guarded.push(...readThem(advanceWorldYears(state, years).state, watch, seed));
    unguarded.push(...readThem(advanceWorldYears(withoutTheClaim, years).state, watch, seed));
}

console.log(`${worlds} worlds, ${years} years, ${guarded.length} stated-standing rows in each arm`);
report('WITHOUT THE CLAIM  (the same rows, the tag stripped)', unguarded);
report('WITH THE CLAIM     (what the catalog states)', guarded);
console.log(
    unguarded.filter(r => r.status !== 'alive').length === 0
        ? '\n  Nothing tried to end them in either arm. The guard is UNTESTED by this run.'
        : '\n  The passes fire, and the claim is what stopped them.'
);
