/**
 * One instrument for the whole job: standing distribution, arrivals, books,
 * wounds, and cost. Run before and after and diff the columns.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { BROKEN_STATUSES } from '../src/engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { getTechnique } from '../src/data/cultivation/techniques.js';
import type { WorldState } from '../src/engine/world/world-state.js';

const BANDS: [string, number, number][] = [
    ['QiCond', 0, 12],
    ['Found', 13, 16],
    ['Core', 17, 20],
    ['Nasc', 21, 24],
    ['Deity', 25, 28],
    ['Void', 29, 32],
    ['Body', 33, 36],
    ['Grand', 37, 40],
    ['TribT', 41, 44],
    ['Immo', 45, 46]
];

const EXTANT = new Set(['alive', 'missing', 'sealed', 'soul_preserved', 'possessing', 'reconstructed']);

function report(tag: string, state: WorldState, seeded: Set<string>, ms: number, years: number) {
    const alive = state.npcs.filter(n => n.status === 'alive');
    const extant = state.npcs.filter(n => EXTANT.has(n.status));
    const bandCounts = BANDS.map(([, lo, hi]) =>
        alive.filter(n => n.cultivation.realmOrdinal >= lo && n.cultivation.realmOrdinal <= hi).length);

    const at = (n: number) => extant.filter(p => p.cultivation.realmOrdinal >= n).length;
    const arrivedAt = (n: number) =>
        extant.filter(p => p.cultivation.realmOrdinal >= n && !seeded.has(p.id)).length;

    // Distinct techniques held by the living, split, because the two halves
    // decay for different reasons and only one of them is a road. A ROAD is a
    // cultivation manual with a cap - the thing that decides how far somebody
    // can climb. An ART is everything else a house teaches, and nothing in the
    // engine reproduces one: `newlyEntitled` hands out roads only, and
    // `artsOf` reads a static catalog list keyed on a house somebody wrote by
    // hand, so a founded house has none and never will.
    const roads = new Set<string>();
    const arts = new Set<string>();
    for (const n of alive) {
        for (const id of n.cultivation.techniqueIds) {
            const t = getTechnique(id) as { class?: string; cap?: number | null } | undefined;
            if (t && t.class === 'cultivation' && t.cap != null) roads.add(id); else arts.add(id);
        }
    }

    // Wounds and broken statuses on NPC records.
    const anyState = state as unknown as { npcs: { cultivation: Record<string, unknown>; status: string }[] };
    let wounded = 0, brokenCount = 0, woundTotal = 0, incompleteBase = 0;
    const byStatus = new Map<string, number>();
    for (const n of anyState.npcs) {
        if (n.status !== 'alive') continue;
        const injuries = (n.cultivation as { injuries?: { woundType?: string | null }[] }).injuries;
        if (!Array.isArray(injuries) || injuries.length === 0) continue;
        wounded++;
        woundTotal += injuries.length;
        for (const inj of injuries) {
            const w = inj?.woundType ?? null;
            if (!w) continue;
            // The failure table's gravest row. It does NOT halt - the bar reads
            // BROKEN_STATUSES only - so it is counted beside them, not as one.
            if (w === 'incomplete-cultivation') incompleteBase++;
            if (BROKEN_STATUSES.includes(w)) {
                brokenCount++;
                byStatus.set(w, (byStatus.get(w) ?? 0) + 1);
            }
        }
    }

    const top = extant.reduce((m, n) => Math.max(m, n.cultivation.realmOrdinal), 0);
    console.log(
        tag.padEnd(14)
        + String(alive.length).padStart(6)
        + BANDS.map((_, i) => String(bandCounts[i]).padStart(6)).join('')
        + String(top).padStart(5)
        + `  41+:${at(41)}(${arrivedAt(41)}new)`
        + ` 37+:${at(37)}(${arrivedAt(37)})`
        + ` 33+:${at(33)}(${arrivedAt(33)})`
        + ` 29+:${at(29)}(${arrivedAt(29)})`
        + ` 13+:${at(13)}(${arrivedAt(13)})`
        + `  roads:${roads.size} arts:${arts.size}`
        + `  wounded:${wounded}/${woundTotal}w broken:${brokenCount} incomplete-base:${incompleteBase}`
        + `  ${(ms / (years / 100)).toFixed(0)}ms/century`
    );
    if (byStatus.size > 0) console.log('              broken: ' + [...byStatus].map(([k, v]) => `${k} x${v}`).join(', '));
}

const catalog = await loadCultivationCatalog();
const seeds = (process.env.SEEDS ?? 'a,b,c').split(',');
const horizons = (process.env.HORIZONS ?? '500,1500,5000').split(',').map(Number);

console.log('run'.padEnd(14) + 'alive'.padStart(6)
    + BANDS.map(([n]) => n.padStart(6)).join('') + 'top'.padStart(5));

for (const seed of seeds) {
    const { state } = seedWorld({ seed: `m-${seed}`, catalog });
    const seeded = new Set(state.npcs.map(n => n.id));
    report(`${seed} @0`, state, seeded, 1, 100);
    let done = 0;
    for (const h of horizons) {
        const step = h - done;
        const t0 = Date.now();
        advanceWorldYears(state, step, { stopOnInterrupt: false });
        const ms = Date.now() - t0;
        done = h;
        report(`${seed} @${h}`, state, seeded, ms, step);
    }
    console.log('');
}
