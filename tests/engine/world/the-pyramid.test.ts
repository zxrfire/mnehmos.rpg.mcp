/**
 * The shape of the population across the nine realms, and the guard against
 * inflating it from the bottom up.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A TEST AND NOT A PROBE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `AMBIENT_QI_RATE_MULTIPLIER` runs 0.5x on thin ground to 4x in a spirit tide.
 * Anything that lifts the floor of that range lifts EVERY cultivator in the
 * world at once, and the damage does not show up where people look for it. The
 * top of the ladder is not made scarce by anything at the top; it is made
 * scarce by how few people get out of the bottom. So a change that "makes the
 * ceiling reachable" by raising the ambient rate does not add a few people at
 * the summit - it moves the whole distribution up, and a world where
 * Tribulation Transcendence is ordinary has lost the only thing that made it
 * worth reaching.
 *
 * The design owner's constraint, in their own words, is that we must not blow
 * the world up with Tribulation Transcendence cultivators. This file is that
 * sentence with a test under it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE INVARIANT IS THE SHAPE, NOT THE PERCENTAGES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file used to assert five fixed bars - Qi Condensation over 50%, the
 * share above Void Refinement under 5%, and so on. They were the wrong
 * instrument and were retired on the design owner's ruling: *"the pyramid test
 * is too restrictive. Variation is fine, as long as the SHAPE takes hold."*
 *
 * Fixed bars fail on their own terms. Every legitimate content pass nudges
 * them, each nudge has a good reason, and the bar gets loosened by whoever is
 * holding the good reason - so a number chosen to be loose enough not to trip
 * is not measuring anything. Measured here: root conditioning moved the largest
 * band by four points and not one bar went red.
 *
 * What makes this a pyramid is that each band is smaller than the one below it.
 * That is scale-free, needs no calibration, survives any content pass that does
 * not change the regime, and requires nothing to be renegotiated when somebody
 * adds nine roads.
 *
 * ── AND STRICT MONOTONICITY EVERYWHERE IS ALSO WRONG ─────────────────────
 *
 * *"its not impossible for a temporary rarity for one band to exceed those
 * below. but this can only happen when N is small, right?"* - and that is
 * exactly right. Two bands near the top holding a handful of people each will
 * swap places by chance. A test that calls that a defect goes red on honest
 * worlds and gets switched off, which is worse than not having it.
 *
 * So the discriminator is NOISE VERSUS STRUCTURE, and the data already shows
 * what separates them: an inversion that REPRODUCES ACROSS SEEDS is not two
 * small samples trading places. A genuine small-N inversion appears on one seed
 * and not the next. A structural one appears on every seed at every horizon.
 *
 * ── TWO RULES, BECAUSE THE TWO ENDS OF THE LADDER ARE NOT ALIKE ──────────
 *
 * *"you could have more void than DT... which is fine. but more Foundation
 * than Qi? no no no no no"* - and the reason those are different is N, not
 * altitude.
 *
 *   1. WHERE BOTH BANDS ARE POPULATIONS, THE ORDERING IS ABSOLUTE. Qi
 *      Condensation holds three hundred people and Foundation Establishment
 *      holds eighty. Samples that size do not trade places by chance, so an
 *      inversion there is structural on the spot: it fails on a single seed,
 *      with no pooling and no reproduction requirement. This is the pyramid's
 *      load-bearing claim and the floor of the whole guard.
 *
 *   2. WHERE EITHER BAND IS INDIVIDUALS, THE ORDERING HOLDS ONLY IN
 *      AGGREGATE. Four people against six will swap for ordinary reasons.
 *      An inversion there is reported, and fails only when it holds on EVERY
 *      seed and the pooled counts are thick enough to mean anything.
 *
 * ── WHERE THE BOUNDARY SITS, AND WHY THERE ─────────────────────────────
 *
 * Off the histogram rather than off anybody's judgement. Per-seed headcounts at
 * this horizon, five seeds:
 *
 *     qi_condensation            306 .. 332
 *     foundation_establishment    73 ..  99
 *     core_formation              33 ..  48
 *     nascent_soul                22 ..  34
 *     deity_transformation        11 ..  14
 *     ---------------------------------------- nothing lands at 9 or 10
 *     body_integration             7 ..   8
 *     void_refinement              4 ..   6
 *     grand_ascension              2
 *     tribulation_transcendence    2
 *
 * The counts fall by roughly an order of magnitude down the ladder and there is
 * a clean gap: everything at Deity Transformation and below is double or triple
 * digits, everything above it is single digits, and NO BAND SITS AT 9 OR 10. So
 * the boundary goes at ten, in the empty space, where a small drift in either
 * direction cannot flip a band's classification.
 *
 * It is applied per band per seed rather than as a fixed list of realms, so a
 * band that thins out stops being held to the hard rule automatically instead
 * of producing a false failure. That is the degradation the fixed-bar version
 * of this file never had.
 *
 * Both kinds get printed either way. A one-seed inversion is information; a
 * reproducing one fails and names itself.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT CATCHES TODAY, AND WHY THAT IS THE POINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Body Integration is larger than the Void Refinement band beneath it - 1.57 to
 * 1.60 against 0.98 to 1.20 - on every seed, at 200 years and at 500 years, in
 * both arms of the root-conditioning control. Numbers that stable are not a
 * small-N swap.
 *
 * ── RETRACTED: "NOBODY ARRIVES ABOVE ORDINAL 32" WAS MY OWN BUG ──────────
 *
 * This block used to say the upper bands were a FOSSIL - the same handful of
 * people the seeder placed, never added to, with nobody arriving above ordinal
 * 32 in five hundred years - and called that a transmission defect. I reported
 * it in that form repeatedly. It is false, and the error was in my probe rather
 * than in the world.
 *
 * The probe split the living into "seeded" and "arrived" by asking whether an
 * id was present at world creation. That is a question about WHERE SOMEBODY
 * CAME FROM, not about whether they climbed - so a person the seeder placed at
 * ordinal 20 who then climbed to 33 was counted as "seeded" in the band they
 * had climbed into. Every genuine climber who happened to exist at year zero
 * was invisible to it, which is most of them over a few centuries. AGENTS.md
 * documents the mirror image of this exact mistake, a column that counted
 * everybody not present at world creation; I made the other half of it.
 *
 * Measured properly - counting somebody as having arrived when they are seen
 * standing in a band above the lowest one they were ever seen in - over two
 * thousand years on one seed:
 *
 *     climbed into 13-16   1571        climbed into 25-28    65
 *     climbed into 17-20    528        climbed into 29-32    22
 *     climbed into 21-24    195        climbed into 33-44     2
 *
 * The inflow is not zero. It is roughly one arrival into Void Refinement per
 * ninety years and one into Body Integration and above per thousand, and the
 * 29-32 band grows over that span rather than holding still. At a rate that
 * low, a five-hundred-year window containing no arrival is an ordinary sample
 * and proves nothing whatsoever - which is what my figure actually was.
 *
 * ── SO WHAT IS RULE 2 BELOW ACTUALLY CATCHING? ──────────────────────────
 *
 * An open question, and it should be treated as one rather than as a defect
 * report. The inversion is real and reproduces on all five seeds at 200 years.
 * But a band holding four to eight people, whose members carry lifespans in the
 * tens of thousands of years and who sit still by choice while working on the
 * last crossing, is stock rather than flow, and two tiny stocks sitting in the
 * wrong order relative to each other may be perfectly legitimate.
 *
 * The honest position: Rule 2 is measuring an ordering at a horizon too short
 * for these bands to be populations, and the discriminator that would settle it
 * is not ordering at all - it is whether the band ever gains anybody, which the
 * numbers above now say it does. Until somebody decides what the guard should
 * ask instead, this failure is a QUESTION rather than a verdict, and it must
 * not be quoted as evidence that the top of the ladder is broken.
 *
 * ── AND THE TOP BAND IS STATIC ON PURPOSE, WITH A NUMBER BEHIND IT ───────
 *
 * The remaining question was what the people at 41-44 are doing, and whether
 * anybody ever attempts the last crossing. Both are answered in the engine and
 * neither is a defect.
 *
 * `applyLastCrossing` in `the-world-changing-on-its-own.ts` owns the attempt and
 * fires at `1 / LAST_CROSSING_YEARS` per figure per year, where
 * LAST_CROSSING_YEARS is 35,000 - twenty thousand for a prodigy and fifty for
 * everybody else, out of a hundred-thousand-year span. With one or two figures
 * standing at 44, that is one attempt somewhere in the world roughly every
 * seventeen thousand years. Its own comment says the value of the pass is not
 * that it fires but that when the top of the world does change there is a named
 * cause rather than attrition.
 *
 * And `readyToStrike` refuses to touch ordinal 44 at all, returning
 * `yearsNeeded: Infinity`, so the ordinary wall-striking pass cannot
 * double-drive it. That guard also carries a measurement: without it the pass
 * struck at the crossing every eight hundred years, forty times too often, and
 * over five thousand years it emptied the apex - both seeded Tribulation
 * Transcendence figures gone and the world ceiling standing at 38.
 *
 * So a static 41-44 band over two hundred or two thousand years is not evidence
 * of anything. It is arithmetic: the only modelled exit from that band is an
 * event with a seventeen-thousand-year return period, against lifespans of a
 * hundred thousand. ANY horizon this test can afford will show it standing
 * still, and Rule 2 asking an ordering question of it is asking a question the
 * horizon cannot answer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BASELINE, MEASURED - AND IT IS A LOG, NOT A CONSTANT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The shape rule above catches a regime change in one step. It does not catch a
 * slow walk: four separate changes, each individually reasonable and each
 * leaving the ordering intact, can move the largest band a long way with
 * nothing ever going red. Rows catch that. Re-take when something lands that
 * plausibly touches the climb, write the new row beside the old one, and say
 * what moved it. One step is noise; three rows leaning the same way is a
 * finding.
 *
 * `scripts/probe-the-pyramid.ts`. Two horizons, because they are not
 * interchangeable and the first two columns are the only controlled pair:
 *
 *                              200y, 2 seeds        200y, 2 seeds     500y, 5 seeds
 *                              WITHOUT root cond.   WITH (current)    WITH (current)
 *     qi_condensation           66.47 .. 67.67      59.88 .. 66.40    59.81 .. 67.98
 *     foundation_establishment  13.25 .. 14.79      14.60 .. 19.37    13.36 .. 17.06
 *     core_formation             7.30 ..  7.63       6.60 ..  8.61     6.85 .. 12.04
 *     nascent_soul               5.02 ..  5.52       6.00 ..  6.65     4.56 ..  7.53
 *     deity_transformation       2.76 ..  3.21       2.15 ..  2.80     2.18 ..  3.69
 *     void_refinement            0.99 ..  1.00       0.98 ..  1.20     0.78 ..  1.38
 *     body_integration           1.38 ..  1.41       1.57 ..  1.60     1.17 ..  1.59
 *     grand_ascension            0.39 ..  0.40       0.39 ..  0.40     0.39 ..  0.40
 *     tribulation_transcendence  0.39 ..  0.40       0.39 ..  0.40     0.39 ..  0.40
 *
 * What separates the first two columns: root conditioning in `5ccbaab`, so a
 * seeded house member's root now follows from the road their house teaches.
 * Measured here back-to-back in one command - `seeding.ts` and `catalog.ts`
 * checked out at `5ccbaab^`, run, restored, run - it is worth -3.93 points of
 * mean Qi Condensation, redistributed upward. Its author measured -2.49 pooled
 * over five seeds at 500 years with the living population unchanged at 2556 vs
 * 2557, so it is redistribution rather than growth.
 *
 * ── WHAT MOVES IT, AND THE GUESS THAT DID NOT SURVIVE ────────────────────
 *
 * This file used to say the mechanism was "the obvious one: members who fit
 * their house's road can read its books, so more of them get out of the bottom
 * band" - meaning the SOFT term, the reweighted draw. Both of us believed it
 * and we were both partly wrong, so the correction is recorded rather than
 * quietly swapped.
 *
 * The prediction that failed was specifically that the HARD filter contributes
 * nothing to the histogram, on the reasoning that pinning root-refused members
 * to the servant rung parks people who were going nowhere anyway. Measured by
 * separating the two terms over identical seeds (`349d00b`):
 *
 *     arm                                          qi @ 500y
 *     A  no conditioning at all                       64.06%
 *     B  soft fit only, hard filter and servant       62.38%   A -> B  -1.68
 *        rule off
 *     C  full, as it ships                            60.22%   B -> C  -2.16
 *
 * B to C is the LARGER of the two. The filter does not merely park the stuck:
 * pinning refused roots to the servant rung changes the COMPOSITION of the pool
 * that gets promoted, and a better-composed pool climbs better. So it is still
 * a fit effect, which is the half of the guess that held - but it acts through
 * who is ELIGIBLE rather than through who can read what.
 *
 * DO NOT QUOTE THOSE MAGNITUDES AS CONSTANTS. The A > B > C ordering is paired
 * on identical seeds and is safe. The differences are not: the qi column is
 * three seeds, and unpaired seed-to-seed spread on this measure has been seen
 * at five points, which is larger than either difference above.
 *
 * ── RATIOS WERE CONSIDERED AND DID NOT EARN THEIR PLACE ──────────────────
 *
 * Ordering alone permits a flattened pyramid, so a scale-free ratio bound - each
 * band at most some fraction of the one below - was the obvious companion
 * invariant. Measured across five seeds at 500 years, the largest ratio among
 * the flowing bands is 0.800 (Core Formation over Foundation Establishment).
 * Any bound safe against that is about 0.9, which is barely stronger than the
 * ordering rule it would sit beside, and it would be a number to renegotiate.
 * Dropped, and recorded here so the next person does not re-derive it.
 *
 * ── AND THE FIRST FIGURES IN THIS FILE WERE CONTAMINATED ─────────────────
 *
 * The baseline originally committed here as the pre-change reading was not one.
 * It was taken off a working tree that already held the root-conditioning edits
 * UNCOMMITTED - `git status` showed `M src/engine/world/seeding.ts` at the time
 * and I noted the file was another agent's and did not think through what that
 * meant for a number I was reading out of it. So the "before" and "after" I
 * would have quoted differed by nothing, because both were after.
 *
 * This is the hazard AGENTS.md states as "a number taken across a gap is
 * worthless while other agents are committing", and the lesson is sharper than
 * the version I had internalised: it is not only about the gap BETWEEN two
 * measurements. A single measurement off a shared tree is already a
 * measurement of somebody else's unfinished work, and it does not announce
 * itself - the figures looked entirely reasonable and sat in a committed test
 * as the authority. The control arm above is the first clean "without" reading
 * this file has ever had.
 */
import { describe, expect, it } from 'vitest';

import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { REALM_TIERS, realmForOrdinal, type RealmKey } from '../../../src/engine/cultivation/realms.js';

const YEARS = 200;

/**
 * Five, because the whole discriminator is whether an inversion reproduces.
 * One seed cannot tell noise from structure and two can barely try.
 */
const SEEDS = ['pyr-a', 'pyr-b', 'pyr-c', 'pyr-d', 'pyr-e'] as const;

/**
 * Pooled headcount below which an inversion says nothing at all.
 *
 * Not a balance number and not tuned against the current world - it is the
 * point where two bands trading places stops being arithmetic worth reading.
 * Pooling across five seeds is what keeps the top of the ladder above it at
 * all, and a pair still under it is reported rather than judged.
 */
const MIN_POOLED_TO_JUDGE = 20;

/**
 * Per-seed headcount at which a band stops being individuals and becomes a
 * population whose ordering is not negotiable.
 *
 * Read off the histogram in the header, not chosen: the bands run 306, 99, 48,
 * 34, 14 and then 8, 6, 2, 2, so there is an empty gap between the lowest
 * population band and the highest individual one, and this sits in it. Nothing
 * in the world is at 9 or 10, so a band drifting a little either way cannot
 * flip its own classification.
 */
const LARGE_BAND_MIN = 10;

/** The ladder, bottom to top. Adjacent pairs are what the shape rule reads. */
const LADDER: readonly RealmKey[] = REALM_TIERS.map(t => t.key);

const catalog = await loadCultivationCatalog();

/** Headcount standing in each realm after the world has run. */
function pyramid(seed: string): { count: Map<RealmKey, number>; alive: number } {
    const { state } = seedWorld({ seed, catalog });
    const after = advanceWorldYears(state, YEARS).state;
    const count = new Map<RealmKey, number>(LADDER.map(k => [k, 0]));
    let alive = 0;
    for (const npc of after.npcs) {
        if (npc.status !== 'alive') continue;
        alive++;
        const key = realmForOrdinal(npc.cultivation.realmOrdinal).key;
        count.set(key, (count.get(key) ?? 0) + 1);
    }
    return { count, alive };
}

const RUNS = SEEDS.map(s => ({ seed: s, ...pyramid(s) }));

type Verdict = 'ordered' | 'noise' | 'structural_small' | 'structural_large' | 'too_few';

interface PairFinding {
    lower: RealmKey;
    upper: RealmKey;
    invertedOn: string[];
    /** Seeds where BOTH bands were populations, so the ordering was absolute. */
    invertedWhileLarge: string[];
    pooledLower: number;
    pooledUpper: number;
    verdict: Verdict;
}

/** Every adjacent band pair, classified by whichever of the two rules applies. */
const FINDINGS: PairFinding[] = LADDER.slice(1).map((upper, i) => {
    const lower = LADDER[i];
    const inverted = RUNS.filter(r => (r.count.get(upper) ?? 0) > (r.count.get(lower) ?? 0));
    const invertedOn = inverted.map(r => r.seed);
    // Rule 1 applies only where both bands were populations ON THAT SEED, so a
    // band that thins out drops to the lenient rule by itself.
    const invertedWhileLarge = inverted
        .filter(r => (r.count.get(lower) ?? 0) >= LARGE_BAND_MIN
            && (r.count.get(upper) ?? 0) >= LARGE_BAND_MIN)
        .map(r => r.seed);
    const pooledLower = RUNS.reduce((s, r) => s + (r.count.get(lower) ?? 0), 0);
    const pooledUpper = RUNS.reduce((s, r) => s + (r.count.get(upper) ?? 0), 0);

    let verdict: Verdict;
    if (invertedWhileLarge.length > 0) verdict = 'structural_large';
    else if (invertedOn.length === 0) verdict = 'ordered';
    else if (pooledLower + pooledUpper < MIN_POOLED_TO_JUDGE) verdict = 'too_few';
    else if (invertedOn.length === SEEDS.length) verdict = 'structural_small';
    else verdict = 'noise';

    return { lower, upper, invertedOn, invertedWhileLarge, pooledLower, pooledUpper, verdict };
});

describe('the pyramid holds its shape', () => {
    it('keeps a world in it at all', () => {
        for (const run of RUNS) {
            expect(run.alive, `${run.seed} has no living population`).toBeGreaterThan(100);
        }
    });

    it('reports every inversion, so the ones that do not fail are still visible', () => {
        // Not an assertion about the world - a printout, so that a pair drifting
        // from noise toward structure is visible in the log BEFORE it starts
        // failing. A finding that only appears the day it breaks the build is a
        // finding nobody saw coming.
        const interesting = FINDINGS.filter(f => f.verdict !== 'ordered');
        for (const f of interesting) {
            console.log(
                `[pyramid] ${f.upper} over ${f.lower}: ${f.verdict} - ` +
                `inverted on ${f.invertedOn.length}/${SEEDS.length} seeds ` +
                `(${f.invertedOn.join(', ') || 'none'}), ` +
                `pooled ${f.pooledUpper} against ${f.pooledLower}`
            );
        }
        expect(FINDINGS.length, 'the ladder has no adjacent pairs').toBe(LADDER.length - 1);
    });

    it('never puts one population band above another, on any seed', () => {
        // RULE 1, AND IT IS THE FLOOR OF THE WHOLE GUARD. Where both bands hold
        // ten people or more, the ordering is not negotiable and there is no
        // reproduction requirement: three hundred people and eighty people do
        // not trade places by chance, so one seed is proof. This is the rule
        // that answers "more Foundation than Qi? no no no no no", and it is
        // checked before anything else because everything else is conditional.
        const broken = FINDINGS.filter(f => f.verdict === 'structural_large');
        const described = broken.map(f =>
            `${f.upper} is larger than ${f.lower} on ${f.invertedWhileLarge.join(', ')} ` +
            `while both were populations`
        );
        expect(
            broken.map(f => `${f.upper}>${f.lower}`),
            described.length
                ? `the pyramid has inverted where the counts are large: ${described.join('; ')}. ` +
                  'This is not sampling noise at these headcounts - the regime has changed.'
                : 'populations correctly ordered'
        ).toEqual([]);
    });

    it('has no inversion among the small bands that reproduces on every seed', () => {
        // RULE 2. Near the top a band is a handful of people, and two handfuls
        // swap for ordinary reasons - so an inversion here is reported and
        // forgiven unless it holds on EVERY seed, which is what separates noise
        // from a fact about the population.
        //
        // Fails today on body_integration over void_refinement, and what that
        // failure MEANS is now an open question rather than a verdict. See the
        // retraction in the header: the claim it used to rest on - that nobody
        // arrives above ordinal 32 - was an artifact of my own probe, and
        // measured properly there are 22 arrivals into 29-32 and 2 into 33-44
        // over two thousand years.
        //
        // So this may be catching a real ordering defect, or it may be asking
        // an ordering question of two four-person stocks at a horizon far too
        // short for them to be populations. Do not quote it as evidence that
        // the top of the ladder is broken until somebody has decided which.
        const structural = FINDINGS.filter(f => f.verdict === 'structural_small');
        const described = structural.map(f =>
            `${f.upper} (${f.pooledUpper} pooled) is larger than ${f.lower} ` +
            `(${f.pooledLower} pooled) on all ${SEEDS.length} seeds`
        );
        expect(
            structural.map(f => `${f.upper}>${f.lower}`),
            described.length
                ? `a band above another one, reproducibly: ${described.join('; ')}. ` +
                  'A flowing population cannot do this. Check whether anybody ARRIVES ' +
                  'in the upper band or whether it is seeded inventory standing still.'
                : 'no reproducing inversion'
        ).toEqual([]);
    });
});
