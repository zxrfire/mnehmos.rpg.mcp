/**
 * Can a PLAYER pay the dao gate?
 *
 * ── WHAT IT USED TO COST, AND WHY THE ANSWER WAS NO ──────────────────────
 *
 * The gate asks for one road besides your own to form a nascent soul, and until
 * the one-rule change a played cultivator had exactly three ways to get one,
 * all in `time-skip.ts`: survive a heavenly tribulation, survive a CRIPPLING qi
 * deviation, or enter a meditative state, checked once a year. Measured across
 * the whole space at Insight 3, that last one runs
 *
 *     thin,  nothing matching                          0.6% per year
 *     dense, matched art + site of understanding       2.9% per year
 *     spirit tide, everything favourable               3.4% per year
 *
 * - one road per 35 years doing everything right, one per 165 doing the
 * ordinary thing. EVERY COMPLETED PLAYTEST RUN ENDED WITH `insights: []`.
 * Meanwhile every NPC in the world was handed one road per art they held, at
 * birth, free.
 *
 * ── WHAT THIS MEASURES ───────────────────────────────────────────────────
 *
 * Two arms, because they answer two different questions and only the first is
 * about the gate.
 *
 *   THE CLOCK   At what age does a cultivator holding k arts and standing on g
 *               grounds actually hold 1, 2, 3, 4, 5 roads - against the
 *               cumulative years the ladder charges to reach each crossing that
 *               asks for that many. This is the gate question and it is exact.
 *   THE CAREER  A life run the long way through `simulateTimeSkip`, which is
 *               the primitive the played game uses. Reported because it is the
 *               real path - and what it finds is NOT about the gate: see the
 *               note it prints.
 *
 *   npx tsx scripts/probe-can-a-player-pay-the-dao-gate.ts
 *   ARTS=3 GROUND=2 npx tsx scripts/probe-can-a-player-pay-the-dao-gate.ts
 */

import { simulateTimeSkip } from '../src/engine/cultivation/time-skip.js';
import { CultivatorSchema, type Cultivator } from '../src/schema/cultivation.js';
import { daoRequirementCurve } from '../src/engine/cultivation/breakthrough.js';
import {
    CULTIVATION_BEGINS_AT_AGE,
    YEARS_A_ROAD_COSTS,
    roadsWalkedBy,
    type RoadWithinReach
} from '../src/engine/cultivation/what-a-road-in-reach-costs-to-walk.js';
import { realmForOrdinal } from '../src/engine/cultivation/realms.js';
import { DAYS_PER_YEAR } from '../src/engine/cultivation/cultivation.js';

/** One art per domain, out of the real catalog. */
const ARTS = [
    'clear-terrace-ascension-canon',   // weapon
    'foundation-tempering-scripture',  // body
    'mountain-vein-devouring-canon'    // formation
];

/** Ordinary ground standing open in a province, teaching roads no art does. */
function ground(n: number): RoadWithinReach[] {
    const domains = ['alchemy', 'karma', 'time', 'void', 'life_death'] as const;
    return domains.slice(0, n).map((domain, i) => ({
        domain,
        subject: `the ${domain} of that place`,
        sourceId: `loc-ground-${i}`,
        sourceName: `Ground ${i + 1}`,
        how: 'ground_open' as const
    }));
}

const ARTS_HELD = Number(process.env.ARTS ?? 2);
const GROUNDS = Number(process.env.GROUND ?? 1);
const REACH = ground(GROUNDS);
const HELD_ARTS = ARTS.slice(0, ARTS_HELD);

const line = (s = '') => console.log(s);

/** Roads besides their own, by the one rule the wall asks. */
function roadsAt(age: number, insights: Cultivator['insights'] = []): number {
    return roadsWalkedBy({
        insights,
        knownTechniques: HELD_ARTS,
        roadsWithinReach: REACH,
        age
    }).filter(i => i.domain !== 'element').length;
}

// ═══════════════════════════════════════════════════════════════════════════
// ARM ONE: THE CLOCK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cumulative years of cultivation to reach each rung, for an ordinary
 * cultivator on ordinary ground, off
 * `scripts/probe-what-a-crossing-costs-in-years.ts`. Quoted rather than
 * recomputed: that probe is the authority and this one has no business having
 * a second opinion about what a rung costs.
 */
const CUMULATIVE_YEARS_TO: Readonly<Record<number, number>> = {
    12: 280, 16: 651, 20: 1224
};

line();
line(`  A cultivator holding ${ARTS_HELD} art(s) with ${GROUNDS} ground in reach.`);
line(`  Practice costs ${YEARS_A_ROAD_COSTS.practice} years a road, open ground `
    + `${YEARS_A_ROAD_COSTS.ground_open}, and cultivating starts at age ${CULTIVATION_BEGINS_AT_AGE}.`);
line();
line('  roads held   first at age');
line('  ' + '-'.repeat(28));
const firstAt = new Map<number, number>();
for (let age = 0; age <= 4000; age++) {
    const held = roadsAt(age);
    if (!firstAt.has(held)) firstAt.set(held, age);
}
for (const [held, age] of [...firstAt].sort((a, b) => a[0] - b[0])) {
    if (held === 0) continue;
    line(`  ${String(held).padStart(6)}       ${String(age).padStart(6)}`);
}
line();
line('  and what the ladder charges to get to each crossing that asks:');
line();
line('  crossing at                        asks   arrives at ~age   holds   verdict');
line('  ' + '-'.repeat(74));
for (const ordinal of [12, 16, 20]) {
    const asks = daoRequirementCurve(ordinal);
    const arrivesAt = CUMULATIVE_YEARS_TO[ordinal] + 16;
    const holds = roadsAt(arrivesAt);
    line(`  ${`${realmForOrdinal(ordinal).name} ${ordinal}`.padEnd(34)}`
        + `${String(asks).padStart(4)}   ${String(arrivesAt).padStart(15)}   `
        + `${String(holds).padStart(5)}   ${holds >= asks ? 'PASSES' : 'REFUSED'}`);
}
line();

// ═══════════════════════════════════════════════════════════════════════════
// ARM TWO: THE CAREER
// ═══════════════════════════════════════════════════════════════════════════

const SEEDS = Number(process.env.SEEDS ?? 12);
const YEARS = Number(process.env.YEARS ?? 400);

/** A repeat is a deepening, not a duplicate - the result schema says so. */
function mergeInsights(held: Cultivator['insights'], gained: Cultivator['insights']) {
    const out = [...held];
    for (const g of gained) {
        const at = out.findIndex(i => i.domain === g.domain && i.subject === g.subject);
        if (at >= 0) out[at] = g; else out.push(g);
    }
    return out;
}

function born(seed: string): Cultivator {
    return CultivatorSchema.parse({
        id: `player-${seed}`,
        name: 'A Nobody',
        kind: 'pc',
        spiritRoot: 'dual_water_fire',
        attributes: { might: 2, insight: 3, fortune: 2, charm: 2 },
        hp: 50, maxHp: 50, qi: 20, maxQi: 20,
        age: 16,
        knownTechniques: HELD_ARTS,
        insights: []
    });
}

const ends: { ordinal: number; age: number; roads: number; events: number }[] = [];

for (let s = 0; s < SEEDS; s++) {
    const seed = `career-${s}`;
    let c = born(seed);
    let day = 0;

    // Blocks, not decades. A skip INTERRUPTS - on a rank advance, on a wound
    // count, on anything notable - so a fixed count of ten-year calls simulates
    // whatever the interrupts left, which in an early draft of this probe was
    // forty years out of four hundred and read as a cultivator who had barely
    // aged. Run until the clock is actually spent.
    let decade = 0;
    while (day < YEARS * DAYS_PER_YEAR && decade < 4000) {
        decade++;
        const result = simulateTimeSkip(c, 10 * DAYS_PER_YEAR, {
            seed,
            locationId: 'somewhere-decent',
            locationDensity: 0.6,
            startDay: day,
            turn: decade,
            grainAbstinence: true,
            rollIdentity: c.id,
            techniqueElement: 'water',
            roadsWithinReach: REACH,
            // A house disciple's circumstances: a book that carries well past
            // the crossing, a sect, and somebody above them teaching.
            options: {
                techniqueBonus: 1.4,
                sectBonus: 1.2,
                locationBonus: 1.2,
                focusMultiplier: 1,
                techniqueCap: 28,
                guideOrdinal: 24
            },
            understanding: {
                techniqueSubjects: ['the edge'],
                techniqueElement: 'water',
                daoGrounds: REACH.map(r => ({
                    domain: r.domain, subject: r.subject, label: r.sourceName, id: r.sourceId
                }))
            }
        });
        day += result.simulatedDays;
        c = {
            ...c,
            realmOrdinal: c.realmOrdinal + result.deltas.realmOrdinal,
            cultivationProgress: Math.max(
                0, c.cultivationProgress + result.deltas.cultivationProgress
            ),
            age: c.age + result.deltas.age,
            // TREATED BETWEEN BLOCKS. Without this the second decade and
            // every one after it comes straight back interrupted on
            // `lethal_injury_threshold` - three wounds off the first few
            // crossings and the skip refuses to run - so the career arm
            // measured a cultivator lying untended in a cave for four
            // centuries. A disciple with a house has a medicine hall; this is
            // the generous arm and it should say so.
            injuries: [],
            hp: c.maxHp,
            insights: mergeInsights(c.insights, result.insightsGained)
        } as Cultivator;
        if (result.died) break;
        if (result.simulatedDays <= 0) break;
    }

    ends.push({
        ordinal: c.realmOrdinal,
        age: Math.round(c.age),
        roads: roadsAt(c.age, c.insights),
        events: c.insights.length
    });
}

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

line(`  ${SEEDS} lives run the long way through simulateTimeSkip, up to ${YEARS} years each`);
line();
line(`  ordinal at the end, mean   ${mean(ends.map(e => e.ordinal)).toFixed(1)}`);
line(`  age at the end, mean       ${mean(ends.map(e => e.age)).toFixed(0)}`);
line(`  ROADS WALKED, mean         ${mean(ends.map(e => e.roads)).toFixed(2)}`);
line(`  of which from an event     ${mean(ends.map(e => e.events)).toFixed(2)}`);
line();
line('  NOTE. These lives end one rung short of ordinal 12 - the FIRST realm');
line('  crossing - having run out of lifespan, and that is NOT the gate: the gate');
line('  asks nothing at all below ordinal 20. A hundred years is the whole span');
line('  below Foundation Establishment and reaching ordinal 12 costs 280 years of');
line('  cultivation, which is the separate and older finding');
line('  `probe-the-first-gate.ts` measures. What this arm is here to show is that');
line('  the roads column is no longer zero for a played cultivator, which it was');
line('  in every completed run before this - and arm one is the exact answer for');
line('  somebody who does reach the crossing.');
line();
