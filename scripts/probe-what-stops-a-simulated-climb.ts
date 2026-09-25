/**
 * What stops somebody the simulation made, and where the world's height comes from.
 *
 * Splits the living into people the catalog wrote and people the simulation made,
 * reports the band table for each, and for the simulated people standing highest
 * asks which of the five gates is actually shut: the province ceiling, the book
 * in their hands, nobody to teach them, the settling allowance, or the span.
 *
 * Run: npx tsx scripts/probe-what-stops-a-simulated-climb.ts [years] [step] [seed]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../tests/support/advance-world-years.js';
import { catalogPersonBehind } from '../src/engine/world/a-catalog-person-and-their-world-row.js';
import { reachableCeilingFor, manualCeilingOf, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';
import { REALM_TIERS, rankName } from '../src/engine/cultivation/realms.js';

const YEARS = Number(process.argv[2] ?? 1000);
const STEP = Number(process.argv[3] ?? 25);
const SEED = process.argv[4] ?? 'pyramid';
const HORIZONS = new Set([0, 100, 300, 1000, 2000, 3000, 5000, 10000]);

const catalog = await loadCultivationCatalog();
let state = seedWorld({ seed: SEED, catalog }).state as any;

function authored(n: any): boolean {
    return catalogPersonBehind(n.id) !== null;
}

function regionCeilingFor(n: any): number {
    const tag = (n.tags as string[]).find(t => t.startsWith('region:'))?.slice(7);
    const region = state.locations.find(
        (l: any) => l.kind === 'region' && String(l.data.catalogRegionId ?? '') === tag
    ) ?? state.locations.find((l: any) => l.id === n.locationId);
    return Number(region?.data.localCeilingOrdinal ?? 20);
}

function report(year: number): void {
    const alive = (state.npcs as any[]).filter(n => n.status === 'alive');
    const sim = alive.filter(n => !authored(n));
    const auth = alive.filter(n => authored(n));
    const hi = (xs: any[]) => xs.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), -1);

    console.log(`\n═══ YEAR ${year} ═══  alive ${alive.length}` +
        `  simulated ${sim.length} (highest ${hi(sim)})  authored ${auth.length} (highest ${hi(auth)})`);

    console.log('  band                         sim   auth');
    for (const t of REALM_TIERS) {
        const s = sim.filter(n => n.cultivation.realmOrdinal >= t.ordinalStart
            && n.cultivation.realmOrdinal <= t.ordinalEnd).length;
        const a = auth.filter(n => n.cultivation.realmOrdinal >= t.ordinalStart
            && n.cultivation.realmOrdinal <= t.ordinalEnd).length;
        if (s === 0 && a === 0) continue;
        console.log(`  ${t.name.padEnd(26)} ${String(s).padStart(5)} ${String(a).padStart(6)}`);
    }

    // WHY THE HIGHEST SIMULATED PEOPLE ARE STANDING STILL.
    const top = sim
        .filter(n => n.cultivation.realmOrdinal >= 24)
        .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal)
        .slice(0, 12);
    if (top.length === 0) return;
    console.log('  ── the highest simulated, and what is shut ──');
    for (const n of top) {
        const o = n.cultivation.realmOrdinal;
        const book = manualCeilingOf(n);
        const reach = reachableCeilingFor(state, n) || BOOKLESS_CEILING;
        const region = regionCeilingFor(n);
        console.log(`  ord ${String(o).padStart(2)} ${rankName(o).padEnd(28)}` +
            ` book ${String(book).padStart(2)} reach ${String(reach).padStart(2)}` +
            ` province ${String(region).padStart(2)}` +
            ` house ${String(n.factionId ?? '-').padEnd(22)}` +
            ` rank ${n.factionRankIndex}`);
    }
}

// THE CEILING HISTOGRAM: what the books in the world's hands actually allow.
function ceilings(year: number): void {
    const sim = (state.npcs as any[]).filter(n => n.status === 'alive' && !authored(n));
    const byReach = new Map<number, number>();
    const byRegion = new Map<number, number>();
    for (const n of sim) {
        const r = reachableCeilingFor(state, n) || BOOKLESS_CEILING;
        byReach.set(r, (byReach.get(r) ?? 0) + 1);
        const g = regionCeilingFor(n);
        byRegion.set(g, (byRegion.get(g) ?? 0) + 1);
    }
    console.log(`  reachable book ceilings, year ${year}: ` +
        [...byReach.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '));
    console.log(`  province ceilings,       year ${year}: ` +
        [...byRegion.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '));
}

report(0);
ceilings(0);
for (let y = STEP; y <= YEARS; y += STEP) {
    state = advanceWorldYears(state, STEP).state;
    if (HORIZONS.has(y)) { report(y); ceilings(y); }
}
