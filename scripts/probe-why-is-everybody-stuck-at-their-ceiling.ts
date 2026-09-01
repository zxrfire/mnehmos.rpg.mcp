/**
 * Roughly 38% of the living stand at or above their own book ceiling in EVERY
 * band. This asks why, per person, and sorts the answers.
 *
 * The figure is the best lead anybody has produced for the frozen top of the
 * ladder, and it is not a wall: it is a near-constant per-band attrition that
 * compounds across nine bands to approximately nobody. But "stuck" is four
 * different situations with four different fixes, and an aggregate that does
 * not separate them cannot tell you which one to build:
 *
 *   NO ROAD          holding nothing at all. The bookless ceiling is 6.
 *   HOUSE EXHAUSTED  at the cap of the best thing their house shelves. The
 *                    house cannot take them further and nobody in it can.
 *   RANK             the house HAS a deeper book and their rank does not reach
 *                    up the shelf to it. A promotion fixes this.
 *   ROOT             the house has a deeper book, their rank reaches it, and it
 *                    fights their spirit root. Nothing they do fixes this.
 *   UNAFFILIATED     no house, so no shelf.
 *
 * Only the first three are transmission problems and only two of them are the
 * institution's fault. Run this before proposing anything that claims to fix
 * the attrition, because the four have nothing in common.
 *
 * Run: npx tsx scripts/probe-why-is-everybody-stuck-at-their-ceiling.ts [years]
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import {
    reachableCeilingFor, shelfOf, shelfReach, suitsRoot, manualCeilingOf, BOOKLESS_CEILING
} from '../src/engine/world/manuals.js';

const YEARS = Number(process.argv[2] ?? 300);
const SEEDS = ['stuck-a', 'stuck-b', 'stuck-c'];

const catalog = await loadCultivationCatalog();

type Reason = 'no road' | 'house exhausted' | 'rank' | 'root' | 'unaffiliated' | 'not stuck';

const tally = new Map<string, Map<Reason, number>>();
const bandOf = (o: number): string =>
    o <= 12 ? '00-12' : o <= 16 ? '13-16' : o <= 20 ? '17-20' : o <= 24 ? '21-24'
    : o <= 28 ? '25-28' : o <= 32 ? '29-32' : '33-44';

function whyStuck(state: any, npc: any): Reason {
    const ordinal = npc.cultivation.realmOrdinal;
    const ceiling = reachableCeilingFor(state, npc) || BOOKLESS_CEILING;
    if (ceiling > ordinal) return 'not stuck';
    if (manualCeilingOf(npc) === 0) return npc.factionId ? 'no road' : 'unaffiliated';
    if (!npc.factionId) return 'unaffiliated';

    const shelf = shelfOf(state, npc.factionId);
    const deeper = shelf.filter(m => m.cap > ordinal);
    if (deeper.length === 0) return 'house exhausted';

    // Does their rank reach that far up the shelf at all?
    const faction = state.factions.find((f: any) => f.id === npc.factionId);
    const rankCount = Math.max(1, faction?.ranks.length ?? 1);
    const reach = npc.tags.includes('chosen')
        ? shelf.length
        : shelfReach(npc.factionRankIndex, rankCount, shelf.length);
    const withinRank = shelf.slice(0, reach).filter(m => m.cap > ordinal);
    if (withinRank.length === 0) return 'rank';

    // Within reach, but does any of it suit them?
    const suited = withinRank.filter(m => suitsRoot(npc.cultivation.spiritRoot, m.element));
    return suited.length === 0 ? 'root' : 'rank';
}

for (const seed of SEEDS) {
    const { state } = seedWorld({ seed, catalog });
    const after = advanceWorldYears(state, YEARS).state as any;
    for (const npc of after.npcs as any[]) {
        if (npc.status !== 'alive') continue;
        const band = bandOf(npc.cultivation.realmOrdinal);
        if (!tally.has(band)) tally.set(band, new Map());
        const row = tally.get(band)!;
        const r = whyStuck(after, npc);
        row.set(r, (row.get(r) ?? 0) + 1);
    }
}

const REASONS: Reason[] = ['no road', 'house exhausted', 'rank', 'root', 'unaffiliated'];
console.log(`pooled over ${SEEDS.length} seeds at ${YEARS}y\n`);
console.log('band     alive   stuck        no road  exhausted     rank     root  unaffil.');
console.log('-'.repeat(84));
const totals = new Map<Reason, number>();
let allAlive = 0, allStuck = 0;
for (const band of [...tally.keys()].sort()) {
    const row = tally.get(band)!;
    const alive = [...row.values()].reduce((a, b) => a + b, 0);
    const stuck = REASONS.reduce((s, r) => s + (row.get(r) ?? 0), 0);
    allAlive += alive; allStuck += stuck;
    for (const r of REASONS) totals.set(r, (totals.get(r) ?? 0) + (row.get(r) ?? 0));
    console.log(
        band.padEnd(8),
        String(alive).padStart(5),
        `${String(stuck).padStart(5)} (${String(Math.round(100 * stuck / alive)).padStart(2)}%)`,
        REASONS.map(r => String(row.get(r) ?? 0).padStart(8)).join(' ')
    );
}
console.log('-'.repeat(84));
console.log(
    'ALL'.padEnd(8),
    String(allAlive).padStart(5),
    `${String(allStuck).padStart(5)} (${String(Math.round(100 * allStuck / allAlive)).padStart(2)}%)`,
    REASONS.map(r => String(totals.get(r) ?? 0).padStart(8)).join(' ')
);
console.log('\nshare of the STUCK, by reason:');
for (const r of REASONS) {
    const n = totals.get(r) ?? 0;
    console.log(`  ${r.padEnd(18)} ${String(n).padStart(5)}  ${(100 * n / allStuck).toFixed(1)}%`);
}
