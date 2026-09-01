/**
 * For everybody alive, what is actually stopping them going one rung further?
 *
 * Four answers, and only one of them is the ladder:
 *
 *   AT THE CEILING   their book or their province does not teach the next rung.
 *   SETTLED          the rung costs more years than the realm's settling
 *                    allowance or than the span they have left.
 *   STILL CLIMBING   the years are affordable and they have not stood here long
 *                    enough yet.
 *   READY            they have the requirement and will strike at their next
 *                    review.
 *
 * Reported by band, because the answer is different at every height and the
 * whole question of where an apex comes from is which of these bites at 33.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { reachableCeilingFor, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';
import { guideOrdinalFor, readyToStrike } from '../src/engine/world/an-npc-striking-at-the-next-wall.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import type { WorldState } from '../src/engine/world/world-state.js';
import type { AmbientQi } from '../src/schema/cultivation.js';

const BANDS: [string, number, number][] = [
    ['QiCond 0-12', 0, 12],
    ['Found 13-16', 13, 16],
    ['Core  17-20', 17, 20],
    ['Nasc  21-24', 21, 24],
    ['Deity 25-28', 25, 28],
    ['Void  29-32', 29, 32],
    ['Body  33-36', 33, 36],
    ['Grand 37-40', 37, 40],
    ['Trib  41-44', 41, 44]
];

function audit(state: WorldState) {
    const byId = new Map(state.npcs.map(n => [n.id, n]));
    const day = state.currentDay;
    const rows = BANDS.map(() => ({
        n: 0, byBook: 0, byProvince: 0, settled: 0, climbing: 0, ready: 0, guided: 0, book: 0
    }));

    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        const ord = npc.cultivation.realmOrdinal;
        const b = BANDS.findIndex(([, lo, hi]) => ord >= lo && ord <= hi);
        if (b < 0) continue;
        const row = rows[b];
        row.n++;

        const regionTag = npc.tags.find(t => t.startsWith('region:'))?.slice(7);
        const region = state.locations.find(
            l => l.kind === 'region' && String(l.data.catalogRegionId ?? '') === regionTag
        ) ?? state.locations.find(l => l.id === npc.locationId);
        const regionCeiling = Number(region?.data.localCeilingOrdinal ?? 20);
        const manualCeiling = reachableCeilingFor(state, npc) || BOOKLESS_CEILING;
        const ceiling = Math.min(regionCeiling, manualCeiling);
        row.book += manualCeiling;

        const guide = guideOrdinalFor(npc, byId);
        if (guide !== null && guide > ord) row.guided++;

        if (ceiling <= ord) {
            if (manualCeiling <= ord) row.byBook++; else row.byProvince++;
            continue;
        }
        const here = npc.locationId === null ? undefined
            : state.locations.find(l => l.id === npc.locationId);
        const ambient: AmbientQi = here?.ambient ?? region?.ambient ?? 'normal';
        const r = readyToStrike(npc, day, {
            ambient,
            rateMultiplier: Number(region?.data.ambientRateMultiplier ?? 1),
            guideOrdinal: guide,
            manualCeiling
        });
        if (r.ready) row.ready++;
        else if (r.settled) row.settled++;
        else row.climbing++;
    }

    console.log('  band          n   outOfBook  province  settled  climbing  ready  guided  meanBookCap');
    BANDS.forEach(([name], i) => {
        const r = rows[i];
        if (r.n === 0) return;
        console.log(
            `  ${name.padEnd(12)}${String(r.n).padStart(4)}`
            + String(r.byBook).padStart(12) + String(r.byProvince).padStart(10)
            + String(r.settled).padStart(9)
            + String(r.climbing).padStart(10) + String(r.ready).padStart(7)
            + String(r.guided).padStart(8)
            + (r.book / r.n).toFixed(1).padStart(13)
        );
    });
}

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: `stops-${process.env.SEED ?? 'a'}`, catalog });
console.log('at seeding:');
audit(state);
let done = 0;
for (const h of (process.env.HORIZONS ?? '500,1500').split(',').map(Number)) {
    advanceWorldYears(state, h - done, { stopOnInterrupt: false });
    done = h;
    console.log(`\nat ${h} years:`);
    audit(state);
}
