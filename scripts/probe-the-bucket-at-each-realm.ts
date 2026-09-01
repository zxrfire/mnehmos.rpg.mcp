/**
 * EVERY REALM IS A BUCKET. Inflow, outflow, volume - measured, per realm.
 *
 * The designer's model, and it is the shape the whole ladder is aiming at:
 *
 *   "think of it as a bucket with an input and an output. the bucket always
 *    has some volume to it but its shifting."
 *
 * Nine buckets, one per realm, and they are CHAINED: the outflow of one is the
 * inflow of the next, minus whatever dies or settles on the way. So no band can
 * be tuned in isolation - widening Core Formation's outflow fills Nascent Soul,
 * and choking Foundation Establishment starves everything above it.
 *
 * ── WHY A SHARE IS THE WRONG INSTRUMENT ──────────────────────────────────
 *
 * An earlier pass reported "90-95% of the people above Void Refinement arrived
 * rather than being seeded" as good news. It is not a turnover measure at all:
 * it counts everybody not present at world creation, and after ten thousand
 * years that is essentially the entire living population whatever the ladder is
 * doing. The same figure read 82-94% BEFORE the change it was supposed to be
 * evidence for.
 *
 * So this measures the three numbers the share falls out of, and it identifies
 * band membership by ID across century snapshots rather than by birth date:
 *
 *   VOLUME    who is standing in the band right now
 *   INFLOW    ids in the band now that were not in it a century ago
 *   OUTFLOW   ids in it a century ago that are not now, SPLIT - because the two
 *             halves mean opposite things for the band above:
 *               CLIMBED   left upward. This is the next bucket's inflow.
 *               ENDED     died, or left the world. This feeds nothing.
 *
 * ── AND THE TWO OUTFLOWS THAT ARE NOT OUTFLOWS ───────────────────────────
 *
 * Settling and a structural break both stop somebody climbing without removing
 * them from the world. They stay in the band forever, so they PAD THE VOLUME
 * while contributing nothing upward - which means a bucket can read healthy and
 * be feeding nothing. Counted separately as `stuck`, because a band whose
 * volume is mostly stuck is the failure that a volume reading alone hides.
 *
 * ── HOW TO READ IT ───────────────────────────────────────────────────────
 *
 *   volume steady, inflow ~ climbed+ended     a working bucket
 *   volume steady, inflow ~ volume            too fast: the whole contents
 *                                             turn over inside the window
 *   volume falling                            outflow exceeds inflow
 *   volume climbing without bound             outflow too slow
 *   volume healthy, inflow near zero          living on inheritance
 *   volume healthy, climbed near zero         feeding nothing above it
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { REALM_TIERS, realmForOrdinal } from '../src/engine/cultivation/realms.js';
import { isHalted } from '../src/engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { woundsCarriedBy } from '../src/engine/world/npc-state.js';
import type { WorldState } from '../src/engine/world/world-state.js';

/**
 * STANDING means alive, and that is deliberate rather than careless.
 *
 * `EXTANT_STATES` is the right measure for the world's CEILING - a Tribulation
 * Transcender who has not been seen in a century is the ordinary condition, not
 * a loss - and it is the wrong measure for a bucket's volume. Nothing in the
 * engine ever resolves `missing`, so an extant count accumulates every person
 * who ever walked off, forever: measured that way, Foundation Establishment
 * drifted +206 over forty centuries in a world whose headcount never moved.
 *
 * So a volume is the living, and going missing counts as leaving the band -
 * which is what it is, from the band's point of view.
 */
const STANDING = new Set(['alive']);

interface Flow {
    volume: number[];
    inflow: number;
    climbed: number;
    ended: number;
    stuck: number;
    /** What ended them, by the note the world wrote. */
    endings: Map<string, number>;
    /** Summed residence, in centuries, over every id-century observed. */
    residenceCenturies: number;
    observations: number;
}

function bandOf(state: WorldState): Map<string, Set<string>> {
    const byRealm = new Map<string, Set<string>>();
    for (const tier of REALM_TIERS) byRealm.set(tier.key, new Set());
    for (const npc of state.npcs) {
        if (!STANDING.has(npc.status)) continue;
        const key = realmForOrdinal(npc.cultivation.realmOrdinal).key;
        byRealm.get(key)?.add(npc.id);
    }
    return byRealm;
}

const catalog = await loadCultivationCatalog();
const seeds = (process.env.SEEDS ?? 'a,b,c').split(',');
const centuries = Number(process.env.CENTURIES ?? 50);
const warmup = Number(process.env.WARMUP ?? 5);

const totals = new Map<string, Flow>();
for (const tier of REALM_TIERS) {
    totals.set(tier.key, {
        volume: [], inflow: 0, climbed: 0, ended: 0, stuck: 0,
        endings: new Map(), residenceCenturies: 0, observations: 0
    });
}

for (const seed of seeds) {
    const { state } = seedWorld({ seed: `bucket-${seed}`, catalog });
    // Warm up past the seeded snapshot before measuring, so the flows are the
    // world's own rather than the seeder's cohort dying off.
    advanceWorldYears(state, warmup * 100, { stopOnInterrupt: false });

    let previous = bandOf(state);
    const since = new Map<string, number>();   // id -> century it entered its band
    for (const [, ids] of previous) for (const id of ids) since.set(id, 0);

    for (let c = 1; c <= centuries; c++) {
        advanceWorldYears(state, 100, { stopOnInterrupt: false });
        const now = bandOf(state);
        const ordinalOf = new Map(state.npcs.map(n => [n.id, n.cultivation.realmOrdinal]));
        const byId = new Map(state.npcs.map(n => [n.id, n]));

        for (const tier of REALM_TIERS) {
            const flow = totals.get(tier.key)!;
            const was = previous.get(tier.key)!;
            const is = now.get(tier.key)!;
            flow.volume.push(is.size);

            for (const id of is) {
                if (!was.has(id)) { flow.inflow++; since.set(id, c); }
                flow.residenceCenturies += c - (since.get(id) ?? c);
                flow.observations++;
            }
            for (const id of was) {
                if (is.has(id)) continue;
                const ordinal = ordinalOf.get(id);
                // Climbed if they are still out there and standing higher.
                // Everything else - dead, or gone from the roster - ENDED, and
                // feeds nothing above.
                if (ordinal !== undefined && ordinal > tier.ordinalEnd
                    && [...now.values()].some(s => s.has(id))) { flow.climbed++; continue; }
                flow.ended++;
                const npc = byId.get(id);
                // Buckets, not people: what matters is the CATEGORY that took
                // them, so a hundred different killers read as one row.
                const note = npc ? (npc.endNote || '') : '';
                const bucket = npc === undefined ? 'gone from the roster'
                    : /^Killed by /.test(note) ? 'killed by a person'
                        : /^Killed when /.test(note) ? 'killed when a house came'
                            : /tribulation/i.test(note) ? 'the tribulation'
                                : /crossing|wall/i.test(note) ? 'a crossing that did not open'
                                    : npc.status === 'missing' ? 'went missing'
                                        : note ? note.replace(/\s+/g, ' ').slice(0, 44)
                                            : `status:${npc.status}`;
                flow.endings.set(bucket, (flow.endings.get(bucket) ?? 0) + 1);
            }
        }
        previous = now;
    }

    // Who is in each band and will never leave it upward.
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        if (!isHalted({ injuries: woundsCarriedBy(npc) })) continue;
        totals.get(realmForOrdinal(npc.cultivation.realmOrdinal).key)!.stuck++;
    }
}

const n = seeds.length;
const span = centuries;
console.log(
    `${n} seeds, ${warmup} centuries of warm-up, then ${span} centuries measured.\n`
);
// Mean residence by Little's law - volume over outflow - rather than by
// averaging elapsed time at each snapshot, which is dominated by whoever
// arrived in the window and reads an order of magnitude short.
console.log('  realm                    volume   inflow  climbed    ended   stuck    stay  of span');
console.log('                          (mean)    per century, per world             centuries    %');
for (const tier of REALM_TIERS) {
    const f = totals.get(tier.key)!;
    if (f.volume.length === 0) continue;
    const mean = f.volume.reduce((a, b) => a + b, 0) / f.volume.length;
    const first = f.volume.slice(0, Math.max(1, Math.floor(f.volume.length / 5)));
    const last = f.volume.slice(-Math.max(1, Math.floor(f.volume.length / 5)));
    const drift = (last.reduce((a, b) => a + b, 0) / last.length)
        - (first.reduce((a, b) => a + b, 0) / first.length);
    // How long somebody stays, and - the number that actually says whether a
    // realm's span is buying them anything - what fraction of that span it is.
    const outflow = (f.climbed + f.ended) / span / n;
    const stay = outflow > 0 ? mean / outflow : Infinity;
    console.log(
        `  ${tier.name.padEnd(24)}`
        + mean.toFixed(1).padStart(6)
        + (f.inflow / span / n).toFixed(2).padStart(9)
        + (f.climbed / span / n).toFixed(2).padStart(9)
        + (f.ended / span / n).toFixed(2).padStart(9)
        + (f.stuck / n).toFixed(1).padStart(8)
        + stay.toFixed(1).padStart(8)
        + `${(100 * stay * 100 / tier.lifespanYears).toFixed(0)}%`.padStart(8)
        + `  drift ${drift >= 0 ? '+' : ''}${drift.toFixed(1)}`
    );
    if (f.ended > 0) {
        const rows = [...f.endings].sort((a, b) => b[1] - a[1]).slice(0, 5);
        console.log('        ended by: ' + rows
            .map(([k, v]) => `${k} ${(100 * v / f.ended).toFixed(0)}%`).join(', '));
    }
}
