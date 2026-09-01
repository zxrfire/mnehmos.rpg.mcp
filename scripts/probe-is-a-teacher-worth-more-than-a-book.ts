/**
 * Is being taught worth more than reading, and does the world ever deliver it?
 *
 * The design ruling is that teaching beats a book, and that the best case is
 * not one great teacher but a CHAIN - somebody at the right rung waiting at
 * every band, from the first morning to the last crossing. This probe asks the
 * three questions that ruling turns into, and takes every arm in ONE process so
 * no catalog edit can land between two readings.
 *
 *   PART 1  What the guidance term is worth in the world as it stands. For
 *           everybody alive below the Lid: do they have a LIVING master above
 *           them, and what multiplier are they actually getting?
 *
 *   PART 2  The chain, band by band. Of the people in each band who are in a
 *           house, how many are being taught by somebody far enough above them
 *           to be worth anything? A gap in this table is a gap in the chain.
 *
 *   PART 3  The best case as pure arithmetic. One subject with the best legal
 *           sheet in the game, climbing 0 to 29 under three regimes:
 *             READING     nobody teaching them, ever
 *             AS BUILT    the tie the world actually forms - one master, taken
 *                         once at intake, never replaced
 *             CHAIN       the right teacher at every rung, continuously
 *           Reported as age at ordinal 29 against the Hollow Court's bar of 250.
 */
import { seedWorld } from '../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../src/engine/world/catalog.js';
import { advanceWorldYears } from '../src/engine/world/driver.js';
import { reachableCeilingFor, BOOKLESS_CEILING } from '../src/engine/world/manuals.js';
import { readyToStrike } from '../src/engine/world/an-npc-striking-at-the-next-wall.js';
import { isBelowTheLid } from '../src/engine/world/layers.js';
import {
    computeCultivationRate,
    guidanceMultiplier,
    GUIDANCE_FULL_GAP,
    DAYS_PER_YEAR
} from '../src/engine/cultivation/cultivation.js';
import { progressRequiredForOrdinal } from '../src/engine/cultivation/realms.js';
import type { WorldState } from '../src/engine/world/world-state.js';
import type { AmbientQi } from '../src/schema/cultivation.js';


// Read off the record rather than imported from the module under test, so this
// probe runs unchanged in both arms of a before-and-after. Importing
// `masterIdsOf` made the control arm fail to load at all, which reads as a
// broken control and is entirely the harness.
function masterIdsOn(npc: { relationships: readonly { kind: string; targetId: string }[] }): string[] {
    return npc.relationships.filter(r => r.kind === 'master').map(r => r.targetId);
}

/** The deepest LIVING master, which is what the changed engine reads. */
function bestGuide(
    npc: { relationships: readonly { kind: string; targetId: string }[] },
    byId: ReadonlyMap<string, { status: string; cultivation: { realmOrdinal: number } }>
): number | null {
    let best: number | null = null;
    for (const id of masterIdsOn(npc)) {
        const m = byId.get(id);
        if (!m || m.status !== 'alive') continue;
        if (best === null || m.cultivation.realmOrdinal > best) best = m.cultivation.realmOrdinal;
    }
    return best;
}

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

// ── PART 1 + 2: what the world delivers ─────────────────────────────────

function auditGuidance(state: WorldState) {
    const byId = new Map(state.npcs.map(n => [n.id, n]));
    const rows = BANDS.map(() => ({
        n: 0, inHouse: 0, hasTie: 0, tieDead: 0, liveAbove: 0,
        multSum: 0, gapSum: 0, gapN: 0, full: 0,
        needSum: 0, stoodSum: 0, clockN: 0, atCeiling: 0, settled: 0, tieCount: 0
    }));

    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        const ord = npc.cultivation.realmOrdinal;
        const b = BANDS.findIndex(([, lo, hi]) => ord >= lo && ord <= hi);
        if (b < 0) continue;
        const row = rows[b];
        row.n++;
        if (npc.factionId) row.inHouse++;

        const ties = masterIdsOn(npc);
        if (ties.length > 0) {
            row.hasTie++;
            // Counted as "every master they hold is a grave", which is the
            // fact that matters: one live master out of three is not being
            // abandoned.
            if (ties.every(id => byId.get(id)?.status !== 'alive')) row.tieDead++;
            row.tieCount += ties.length;
        }
        const guide = bestGuide(npc, byId);
        const mult = guidanceMultiplier(ord, guide);
        row.multSum += mult;
        if (guide !== null && guide > ord) {
            row.liveAbove++;
            row.gapSum += guide - ord;
            row.gapN++;
            if (guide - ord >= GUIDANCE_FULL_GAP) row.full++;
        }

        // What this rung is costing them, split into the part a rate term can
        // reach and the part it cannot.
        const regionTag = npc.tags.find(t => t.startsWith('region:'))?.slice(7);
        const region = state.locations.find(
            l => l.kind === 'region' && String(l.data.catalogRegionId ?? '') === regionTag
        ) ?? state.locations.find(l => l.id === npc.locationId);
        const manualCeiling = reachableCeilingFor(state, npc) || BOOKLESS_CEILING;
        if (manualCeiling <= ord) row.atCeiling++;
        const here = npc.locationId === null ? undefined
            : state.locations.find(l => l.id === npc.locationId);
        const r = readyToStrike(npc, state.currentDay, {
            ambient: here?.ambient ?? region?.ambient ?? 'normal',
            rateMultiplier: Number(region?.data.ambientRateMultiplier ?? 1),
            guideOrdinal: guide,
            manualCeiling
        });
        if (r.settled) row.settled++;
        if (Number.isFinite(r.yearsNeeded)) {
            row.needSum += r.yearsNeeded;
            row.stoodSum += r.yearsStood;
            row.clockN++;
        }
    }

    // THE QUESTION BEHIND THE QUESTION. Guidance and ground are both RATE
    // terms, so both can only ever divide the accrual half of a rung's cost.
    // If the years people actually spend standing at a rung are mostly not
    // accrual - failed crossings, the settling clock, waiting on a book - then
    // no rate multiplier reaches them, and teaching is the wrong lever however
    // large it is made. Measured here rather than assumed.
    console.log('  band          n  inHouse  hasTie  tieDead  liveAbove  meanGap  atFullGap  meanMult  tiesEach');
    BANDS.forEach(([name], i) => {
        const r = rows[i];
        if (r.n === 0) return;
        console.log(
            `  ${name.padEnd(12)}${String(r.n).padStart(4)}`
            + String(r.inHouse).padStart(9) + String(r.hasTie).padStart(8)
            + String(r.tieDead).padStart(9) + String(r.liveAbove).padStart(11)
            + (r.gapN ? (r.gapSum / r.gapN).toFixed(1) : '-').padStart(9)
            + String(r.full).padStart(11)
            + (r.multSum / r.n).toFixed(3).padStart(10) + (r.tieCount / Math.max(1, r.n)).toFixed(2).padStart(10)
        );
    });

    console.log('\n  what a rung is costing, accrual against everything else:');
    console.log('  band          n   yrsNeeded   yrsStood   stood/needed   outOfBook   settled');
    BANDS.forEach(([name], i) => {
        const r = rows[i];
        if (r.clockN === 0) return;
        const need = r.needSum / r.clockN;
        const stood = r.stoodSum / r.clockN;
        console.log(
            `  ${name.padEnd(12)}${String(r.clockN).padStart(4)}`
            + need.toFixed(1).padStart(12) + stood.toFixed(1).padStart(11)
            + (need > 0 ? (stood / need).toFixed(1) : '-').padStart(15)
            + String(r.atCeiling).padStart(12) + String(r.settled).padStart(10)
        );
    });
}

// ── PART 3: the best case as arithmetic ─────────────────────────────────

const TARGET_ORDINAL = 29;

/**
 * Years to climb 0 to `TARGET_ORDINAL` for the best legal sheet in the game,
 * with guidance supplied by `guideAt`.
 *
 * The sheet is built LEGALLY - `might` caps at 3 and `insight` at 4 in
 * `schema/cultivation.ts`, and a probe using 5s is not measuring this game.
 * Everything else is set to the best the catalogs offer so that the only thing
 * varying between arms is who is standing in front of them.
 */
function yearsToTarget(
    guideAt: (ordinal: number) => number | null,
    label: string,
    ambient: AmbientQi = 'sealed_vein'
): { years: number; perBand: Map<string, number> } {
    let total = 0;
    const perBand = new Map<string, number>();
    for (let ord = 0; ord < TARGET_ORDINAL; ord++) {
        const required = progressRequiredForOrdinal(ord);
        if (required === null) continue;
        const rate = computeCultivationRate(
            {
                spiritRoot: 'mutated_lightning',
                injuries: [],
                realmOrdinal: ord,
                // `exceptional` and not `transformed`: the faster one is the
                // mark of something non-human having reworked the body, which
                // is not a thing an ordinary best case gets to assume.
                foundationQuality: 'exceptional',
                insights: [],
                attributes: { might: 3, insight: 4, fortune: 3, charm: 3 }
            },
            // A parameter, because ground is the largest term in the whole
            // model and a best case measured only on the rarest band in the
            // world is not a claim about anybody's actual career.
            //
            // There is no band called `abundant` - naming one produced an
            // undefined multiplier, a NaN rate and a perDay of 0 at every rung,
            // which reads exactly like "the ladder is impassable" and was
            // entirely the harness.
            ambient,
            {
                // A book that always teaches the next rung. The best case is
                // not about running out of book, so the ceiling is held open
                // and the comparison is purely who is teaching.
                techniqueCap: TARGET_ORDINAL + 1,
                techniqueBonus: 1 + 4 * 0.06,
                guideOrdinal: guideAt(ord)
            }
        ).perDay;
        if (rate <= 0) {
            console.log(`  ${label}: rate went to zero at ordinal ${ord}`);
            return { years: Infinity, perBand };
        }
        const years = required / (rate * DAYS_PER_YEAR);
        total += years;
        const band = BANDS.find(([, lo, hi]) => ord >= lo && ord <= hi)?.[0] ?? '?';
        perBand.set(band, (perBand.get(band) ?? 0) + years);
    }
    return { years: total, perBand };
}

// ── run ─────────────────────────────────────────────────────────────────

const catalog = await loadCultivationCatalog();
const { state } = seedWorld({ seed: `teaching-${process.env.SEED ?? 'a'}`, catalog });
const horizon = Number(process.env.HORIZON ?? 1500);
advanceWorldYears(state, horizon, { stopOnInterrupt: false });

console.log(`PART 1+2 - who is actually being taught, at ${horizon} years\n`);
auditGuidance(state);

console.log('\nPART 3 - the best legal sheet in the game, 0 to 29\n');

// AS BUILT: the tie the world forms is with the LOWEST ranked person who can
// carry them, taken once at intake and never replaced. Modelled at its most
// generous: a master a full realm (4 rungs) above them on the day they join,
// who then stands still while the student climbs past.
const AS_BUILT_MASTER_AT = 4;

const arms: [string, (o: number) => number | null][] = [
    ['READING  (nobody teaching)', () => null],
    [`AS BUILT (one master at ${AS_BUILT_MASTER_AT}, never replaced)`, () => AS_BUILT_MASTER_AT],
    [`CHAIN    (right teacher at every rung, +${GUIDANCE_FULL_GAP})`, o => o + GUIDANCE_FULL_GAP]
];

// Ground is swept alongside guidance because it is the competing candidate for
// the missing multiplier, and the two have to be read against each other: a
// term worth x1.5 at its theoretical maximum is not the lever if the term
// beside it is worth x8 and most people are standing on the wrong end of it.
const GROUNDS: AmbientQi[] = ['normal', 'dense', 'spirit_tide', 'sealed_vein'];

console.log('  age at ordinal 29, by ground and by who is teaching:\n');
console.log('    ground        ' + arms.map(([l]) => l.slice(0, 8).padStart(11)).join(''));
for (const g of GROUNDS) {
    const row = arms.map(([label, fn]) => yearsToTarget(fn, label, g).years);
    console.log(
        `    ${g.padEnd(14)}`
        + row.map(y => (y > 9999 ? '  -' : y.toFixed(0) + 'y').padStart(11)).join('')
        + (row.some(y => y <= 250) ? '' : '   <- none reach the bar')
    );
}

console.log('\n  what each lever is worth, end to end:');
const atNormal = arms.map(([label, fn]) => yearsToTarget(fn, label, 'normal').years);
console.log(`    teaching, perfect chain vs reading   x${(atNormal[0] / atNormal[2]).toFixed(2)}`);
const groundOnly = GROUNDS.map(g => yearsToTarget(() => null, 'x', g).years);
console.log(`    ground, sealed_vein vs normal        x${(groundOnly[0] / groundOnly[3]).toFixed(2)}`);

console.log('\n  where the years go on ordinary ground, by band:');
const detail = arms.map(([label, fn]) => ({ label, ...yearsToTarget(fn, label, 'normal') }));
const bandNames = [...detail[0].perBand.keys()];
console.log('    band          ' + detail.map((_, i) => `arm${i}`.padStart(10)).join(''));
for (const band of bandNames) {
    console.log(
        `    ${band.padEnd(14)}`
        + detail.map(r => (r.perBand.get(band) ?? 0).toFixed(0).padStart(10)).join('')
    );
}
