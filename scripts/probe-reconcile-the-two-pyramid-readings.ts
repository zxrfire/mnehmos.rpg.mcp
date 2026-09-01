/**
 * Two people measured the same world and got 84% and 56% for the bottom third.
 * This runs both methods over one world, side by side, in one command.
 *
 * THE ONLY DIFFERENCE THAT MATTERS IS THE BANDING. One method resolves a realm
 * with `realmForOrdinal`, which is `REALM_TIERS`. The other buckets on
 * `Math.floor(realmOrdinal / 4)`.
 *
 * Those agree everywhere except at the bottom, and the bottom is most of the
 * world. THE REALMS ARE NOT UNIFORMLY FOUR RUNGS WIDE: Qi Condensation spans
 * ordinals 0 to 12, THIRTEEN rungs, and every realm above it spans four. So
 * dividing by four splits Qi Condensation across four buckets and then labels
 * those buckets with the names of the realms above it - and a world where
 * people climb out of the first few rungs reads as one where Foundation has
 * overtaken Qi Condensation, when both figures are Qi Condensation.
 *
 * Run: npx tsx scripts/probe-reconcile-the-two-pyramid-readings.ts [pop] [seed]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { REALM_TIERS, realmForOrdinal } from '../src/engine/cultivation/realms.js';

const POP = Number(process.argv[2] ?? 2000);
const SEED = process.argv[3] ?? 'reconcile';
const catalog = await loadCultivationCatalog();
const KEYS = REALM_TIERS.map(t => t.key);
const SHORT = ['qi', 'found', 'core', 'nasc', 'deity', 'void', 'body', 'grand', 'trib', 'imm'];

let state = seedWorld({ seed: SEED, catalog, population: POP }).state as any;
let elapsed = 0;

console.log('REALM WIDTHS, which is the whole of the disagreement:');
for (const t of REALM_TIERS) {
    console.log(`  ${t.key.padEnd(26)} ordinals ${String(t.ordinalStart).padStart(2)}-${String(t.ordinalEnd).padStart(2)}` +
        `  ${String(t.ordinalEnd - t.ordinalStart + 1).padStart(2)} rungs` +
        (t.ordinalEnd - t.ordinalStart + 1 !== 4 ? '   <- not four' : ''));
}

for (const target of [200, 500, 1000, 2000]) {
    state = advanceWorldYears(state, target - elapsed).state;
    elapsed = target;
    const alive = (state.npcs as any[]).filter(n => n.status === 'alive');

    // METHOD A: resolve the realm the ladder actually declares.
    const byRealm = new Map<string, number>(KEYS.map(k => [k, 0]));
    // METHOD B: bucket on floor(ordinal / 4) and label the buckets in order.
    const byQuarter = new Map<number, number>();
    for (const n of alive) {
        const o = n.cultivation.realmOrdinal;
        const k = realmForOrdinal(o).key;
        byRealm.set(k, (byRealm.get(k) ?? 0) + 1);
        const q = Math.floor(o / 4);
        byQuarter.set(q, (byQuarter.get(q) ?? 0) + 1);
    }
    const pctA = (k: string) => (100 * (byRealm.get(k) ?? 0) / alive.length).toFixed(1).padStart(5);
    const pctB = (q: number) => (100 * (byQuarter.get(q) ?? 0) / alive.length).toFixed(1).padStart(5);

    console.log(`\n=== ${target}y, ${alive.length} alive ===`);
    console.log('  by REALM_TIERS   ' + KEYS.map((k, i) => `${SHORT[i]} ${pctA(k)}`).join('  '));
    console.log('  by floor(ord/4)  ' + SHORT.map((s, i) => `${s} ${pctB(i)}`).join('  '));

    const qi = byRealm.get('qi_condensation') ?? 0;
    const found = byRealm.get('foundation_establishment') ?? 0;
    console.log(`  hard floor: Qi ${qi} vs Foundation ${found}  ->  ` +
        (found > qi ? 'VIOLATED' : 'holds'));
    // What the quarter method calls the first three buckets is all one realm.
    const firstThree = (byQuarter.get(0) ?? 0) + (byQuarter.get(1) ?? 0) + (byQuarter.get(2) ?? 0);
    console.log(`  buckets 0,1,2 of floor(ord/4) = ordinals 0-11, ALL Qi Condensation: ` +
        `${(100 * firstThree / alive.length).toFixed(1)}%  (Qi Condensation really is ${pctA('qi_condensation')}%)`);
}
