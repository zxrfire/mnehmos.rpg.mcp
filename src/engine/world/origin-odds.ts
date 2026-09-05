/**
 * What being born somewhere is actually worth, measured.
 */

import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { DAYS_PER_YEAR, computeCultivationRate } from '../cultivation/cultivation.js';
import { bestReadable } from '../cultivation/manual-quality.js';
import {
    MAX_ORDINAL,
    lifespanForOrdinal,
    progressRequiredForOrdinal,
    type ImmortalStatus
} from '../cultivation/realms.js';
import {
    MAX_PILL_BONUS,
    attemptBreakthrough,
    canAttemptBreakthrough
} from '../cultivation/breakthrough.js';
import { treatWorstInjuries } from '../cultivation/injuries.js';
import { rollAttributes, rollSpiritRoot } from '../cultivation/spirit-roots.js';
import {
    discoverableInsights,
    integrateInsight,
    recordAchievement
} from '../cultivation/understanding.js';
import {
    FOUNDATION_PILL_STONES,
    ORIGIN_TIERS,
    PRICE_GROWTH_PER_ORDINAL,
    STONES_PER_YEAR_OF_SECLUSION,
    affordablePillPotency,
    breakthroughPillPrice,
    expeditionSurvival,
    injuryTreatmentPrice,
    getOrigin,
    originProbability,
    withOriginAccess,
    type OriginTierKey
} from '../cultivation/origin.js';
import {
    AMBIENT_QI_RATE_MULTIPLIER,
    AMBIENT_QI_WEIGHTS,
    stagnationYearsForOrdinal,
    type AmbientQi,
    type FoundationQuality,
    type Injury,
    type Insight,
    type ManualQuality
} from '../../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// THE MODEL OF A LIFE
//
// Every constant below is a property of the WORLD, not of an origin. They are
// identical for every tier, and that is what makes the comparison honest.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where a life happens to be, drawn per life from the world's own distribution.
 */
const WORLD_AMBIENT_WEIGHTS: Record<AmbientQi, number> = AMBIENT_QI_WEIGHTS;

/** Fraction of the day that actually goes into it, while the holding lasts. */
const FUNDED_FOCUS = 0.7;

/** What focus drops to once a cultivator has to come out and earn. */
const UNFUNDED_FOCUS = 0.45;

/**
 * Somebody sitting in a pocket of qi nothing has drawn on does not come out.
 * They have stopped needing the economy, which is the whole of what the site
 * is worth and is not something anybody's family arranged.
 */
const SEALED_VEIN_FOCUS = 1;

/**
 * Stones a year a cultivator at this rank can make for themselves.
 */
function earningsPerYear(ordinal: number): number {
    return EARNINGS_AT_ORDINAL_ZERO * Math.pow(PRICE_GROWTH_PER_ORDINAL, Math.max(0, ordinal));
}

/**
 * Stones a year a mortal-rank cultivator can make.
 */
const EARNINGS_AT_ORDINAL_ZERO = 6;

/**
 * Ordinal from which a sect recruits on what you have reached rather than on whose
 * child you are.
 */
const MERIT_ADMISSION_ORDINAL = 5;

/**
 * How far up the world's shelf somebody climbing on merit can reach.
 */
const MERIT_ROAD: ManualQuality = 'pristine';

/** Support a sect gives anyone it admitted on merit. */
const MERIT_SECT_BONUS = 1.2;

/**
 * Ordinal from which a ruin is a thing a person could survive walking into.
 * Below Foundation Establishment it is simply a way to die.
 */
const RUIN_FLOOR = 13;

/**
 * Share of cultivators who are ever willing to walk into somewhere lethal.
 */
const RUIN_WILLINGNESS = 0.18;

/**
 * Chance a willing cultivator goes back in at any given rank.
 */
const RUIN_RETURN_RATE = 0.4;

/** Base survival of one attempt, before anything supplied is added. */
const RUIN_BASE_SURVIVAL = 0.45;

/** Chance a survived attempt turns up a pocket nothing has drawn on. */
const RUIN_VEIN_CHANCE = 0.02;

/** Chance a survived attempt turns up an inheritance worth comprehending. */
const RUIN_INHERITANCE_CHANCE = 0.18;

/**
 * What an opened sealed place turns out to have been holding.
 */
const WHAT_A_SEALED_PLACE_HOLDS: readonly string[] = [
    'mortality', 'debt', 'formation', 'refinement', 'sword', 'body'
];

/**
 * The ground a province has standing open in it that teaches a ROAD.
 */
const ROAD_GROUND_A_PROVINCE_HAS: string[] = [
    'ancient_battlefield',  // formation
    'tribulation_scar',     // void
    'sealed_tomb'           // karma
];

/**
 * The rung below which the road-bearing ground teaches nothing.
 */
const ROAD_GROUND_FLOOR = 12;

/**
 * And the rung by which the province's BURIED ground has been dug open.
 */
const ROAD_GROUND_FOUND_FLOOR = 20;

/** Stones a survived attempt is worth. The poor road's actual economics. */
const RUIN_STONES = 2_200;

/**
 * Per-rank chance a reachable comprehension is actually comprehended.
 */
const COMPREHENSION_BASE = 0.06;

/** How much Insight moves that. Still a chance, never a schedule. */
const COMPREHENSION_PER_INSIGHT = 0.03;

/**
 * Years of sitting with something before it gets another chance to arrive.
 */
const YEARS_PER_COMPREHENSION_CHANCE = 25;

/**
 * Cap on draws per rank. Deliberately far above what any crossable rank
 * produces: it is a runaway guard, not a balance knob. Binding it lower would
 * quietly assert that a cultivator who sat with something for four hundred
 * years has the same chances as one who sat with it for forty.
 */
const MAX_COMPREHENSION_DRAWS = 400;

/**
 * Hard stop, so a sweep cannot run away.
 */
const MAX_YEARS = 250_000;

/**
 * The rungs worth reporting a share for.
 */
export const REPORTED_THRESHOLDS: readonly number[] = [13, 21, 25, 29, 33, 37, 41, 45, MAX_ORDINAL];

/** First ordinal of Foundation Establishment. Where an origin actually bites. */
const FOUNDATION_ORDINAL = 13;

/** First ordinal of Core Formation. A complete cultivator, and the reference. */
const CORE_FORMATION_ORDINAL = 21;

/** Below this many lives in a denominator, a conditional share says nothing. */
const MIN_CONDITIONAL_DENOMINATOR = 30;

function betterAmbient(a: AmbientQi, b: AmbientQi): AmbientQi {
    return AMBIENT_QI_RATE_MULTIPLIER[b] > AMBIENT_QI_RATE_MULTIPLIER[a] ? b : a;
}

// ─────────────────────────────────────────────────────────────────────────
// ONE LIFE
// ─────────────────────────────────────────────────────────────────────────

export type LifeEnd =
    | 'died_in_breakthrough'
    | 'died_in_a_ruin'
    | 'lifespan'
    | 'settling'
    /**
     * Refused at a realm boundary for want of COMPREHENSION, not for want of qi or
     * of time.
     */
    | 'no_road'
    /** The last crossing completed. True Immortal, ordinal 46. */
    | 'summit'
    /**
     * The last crossing did NOT complete. False Immortal, ordinal 45.
     */
    | 'false_immortal'
    /** The runaway guard bound. Always a bug; reported so it cannot hide. */
    | 'guard';

export interface LifeResult {
    peakOrdinal: number;
    end: LifeEnd;
    /** Whether this life ever stood on a sealed vein. */
    foundVein: boolean;
    /** Ruins entered. Zero for the overwhelming majority. */
    ruinsEntered: number;
    /** Comprehensions formed. Zero is the ordinary case. */
    insightCount: number;
    /** Deepest degree reached. Below 3 is not a thing anybody would record. */
    deepestDegree: number;
    /**
     * Sum of degrees held. The blunt measure of total comprehension, and the
     * term the last three realms actually run on.
     */
    degreeTotal: number;
    /** Years lived. */
    ageAtEnd: number;
    /** What the foundation turned out to be. */
    foundation: FoundationQuality;
    /**
     * Which way the last crossing went, for the lives that attempted it.
     *
     * `'none'` for everybody who never stood at ordinal 44 with the price paid,
     * which is very nearly everybody.
     */
    immortalStatus: ImmortalStatus;
}

/**
 * Run one whole life and report where it stopped.
 */
export function simulateLife(
    seed: string,
    index: number,
    originKey: OriginTierKey
): LifeResult {
    const origin = getOrigin(originKey);
    const stream = (name: string, ...parts: (string | number)[]): CultivationRNG =>
        forStream(seed, name, originKey, index, ...parts);

    const rootRng = stream('origin-sweep-root');
    const attrRng = stream('origin-sweep-attrs');
    const root = rollSpiritRoot(rootRng.next());
    const attributes = rollAttributes([
        attrRng.next(), attrRng.next(), attrRng.next(), attrRng.next()
    ]);

    // Willingness to walk into somewhere lethal. Its own stream, and the same
    // distribution for every tier: nerve is not inherited.
    const nerveRng = stream('origin-sweep-nerve');
    const willing = nerveRng.next() < RUIN_WILLINGNESS;

    // Where this life happens to be, drawn from the world's own distribution,
    // with the family's holding as a floor under it and nothing more.
    let ambient = betterAmbient(
        stream('origin-sweep-ground', 0).weighted(WORLD_AMBIENT_WEIGHTS),
        origin.ground
    );
    let stones = origin.spiritStones;
    let suppliedLeft = origin.expeditions.supplied;
    let ruinsEntered = 0;
    let foundVein = false;
    let nearDeath = false;
    let survivedTribulation = false;

    // Access. Everything the birth put within reach, plus whatever a ruin
    // later adds. An origin with none contributes nothing and the cultivator
    // reaches their own root, which is the ordinary case.
    const inheritances: { subject: string; label: string }[] = [];

    // THE GROUND THEY WERE BORN NEAR
    const bornNearRng = stream('origin-sweep-born-near');
    const provinceGround = [...ROAD_GROUND_A_PROVINCE_HAS];
    const roadGround = provinceGround.splice(
        bornNearRng.int(0, provinceGround.length - 1), 1
    )[0];
    const buriedGround = provinceGround.length > 0
        ? provinceGround[bornNearRng.int(0, provinceGround.length - 1)]
        : null;
    const insights: Insight[] = [];

    let ordinal = 0;
    let peak = 0;
    let progress = 0;
    let age = 16;
    let yearsAtRank = 0;
    let attempt = 0;
    let foundation: FoundationQuality = 'none';
    let immortalStatus: ImmortalStatus = 'none';
    const injuries: Injury[] = [];
    // Only ever overwritten by a real clock or a real gate. If a life leaves
    // the loop still holding this, the guard bound, and that is a bug in the
    // harness rather than an outcome in the world.
    let end: LifeEnd = 'guard';

    while (age < MAX_YEARS) {
        // ── What a year costs, and whether it is funded ──────────────────
        const funded = stones > 0;
        const focus = foundVein ? SEALED_VEIN_FOCUS : funded ? FUNDED_FOCUS : UNFUNDED_FOCUS;

        // Placement is worth something only while it is the ONLY way in. Once a
        // cultivator has reached what a sect recruits at, the poor one who got
        // there alone draws the same support, and the well-born one's head
        // start has finished being a head start.
        const sectBonus =
            ordinal >= MERIT_ADMISSION_ORDINAL
                ? Math.max(MERIT_SECT_BONUS, 1)
                : origin.placement.sectBonus;

        // AND THE BOOK RETIRES ON THE SAME LINE THE PLACEMENT DOES.
        const reader = { spiritRoot: root.key, attributes, insights, foundationQuality: foundation };
        const road = ordinal >= MERIT_ADMISSION_ORDINAL
            ? bestReadable(MERIT_ROAD, reader)
            : bestReadable(origin.roadQuality, reader);

        const rate = computeCultivationRate(
            {
                spiritRoot: root.key,
                injuries,
                insights,
                foundationQuality: foundation,
                // Passed so the manual below is priced against a real reader
                // rather than against the schema pivot. Without it every origin
                // in this comparison reads a book at insight 2 and the axis
                // this function exists to measure goes flat.
                attributes,
                // The rung they are standing on. This was left out on purpose once,
                // and the note explaining why was right about the consequence and
                // wrong about the conclusion: supplying it moves this harness hard,
                // because the realm intake term compounds upward and the well-born
                // are the ones standing high enough to collect it. Top-tier
                // children reaching Core Formation go from about 4% to about 8%.
                realmOrdinal: ordinal
            },
            ambient,
            {
                focusMultiplier: focus,
                // An actual book, from the same place the ground and the stipend
                // come from. Replaces `1 + insight * 0.06`, a proxy for a manual
                // nobody was holding that also counted insight twice.
                techniqueQuality: road,
                sectBonus
            }
        ).perDay;
        if (rate <= 0) {
            end = 'settling';
            break;
        }

        const eligibility = canAttemptBreakthrough({
            realmOrdinal: ordinal,
            cultivationProgress: progress,
            spiritRoot: root.key,
            insights,
            alive: true
        });
        const required = progressRequiredForOrdinal(ordinal);
        // Above the Lid nothing is priced in qi, so the walk stops here.
        if (required === null) break;
        const need = Math.max(0, required - eligibility.progressSubstituted - progress);
        const yearsNeeded = Math.max(1 / DAYS_PER_YEAR, need / (rate * DAYS_PER_YEAR));

        if (yearsAtRank + yearsNeeded >= stagnationYearsForOrdinal(ordinal)) {
            end = 'settling';
            break;
        }
        if (age + yearsNeeded >= lifespanForOrdinal(ordinal)) {
            end = 'lifespan';
            break;
        }

        age += yearsNeeded;
        yearsAtRank += yearsNeeded;
        // Land just ABOVE the requirement rather than exactly on it. `need` is
        // `required - substituted - progress`, so adding it back reconstructs
        // `required` through two floating-point subtractions and lands a few ulps
        // below it about half the time. At ordinal 39 the requirement is around 1e7
        // and an ulp is a hundredth of a qi-unit, which is invisible - and
        // `canAttemptBreakthrough` then refuses the attempt for
        // `insufficient_progress`, silently stalling every run in the last three
        // realms. The epsilon is smaller than a day of accumulation at any rate
        // this harness produces.
        progress += need + Math.max(1e-6, required * 1e-9);
        // Upkeep, the stipend, and what this person can make for themselves.
        // Everybody earns; the well-born simply start with a holding as well.
        const stipend = ordinal >= MERIT_ADMISSION_ORDINAL ? 0 : origin.placement.stipendPerYear;
        stones = Math.max(
            0,
            stones +
                yearsNeeded *
                    (stipend + earningsPerYear(ordinal) * focus - STONES_PER_YEAR_OF_SECLUSION)
        );

        // ── Comprehension, gated by access and by nothing else ───────────
        // Every candidate here names a real AccessSource. A life with no
        // teacher, no manual and nothing underfoot has only its own root in
        // the candidate set, and effort does not widen it.
        const ctx = withOriginAccess(originKey, {
            inheritances: inheritances.slice(),
            locationTags: [
                ...(ordinal >= ROAD_GROUND_FLOOR ? [roadGround] : []),
                // The buried one, once somebody in the province has dug it
                // open. Later than the first, because that is exactly the
                // difference between ground that is standing there and ground
                // that is not.
                ...(buriedGround && ordinal >= ROAD_GROUND_FOUND_FLOOR ? [buriedGround] : []),
                ...(foundVein ? ['deep_cave'] : [])
            ],
            // Having stood under heavenly lightning and still been standing
            // after is access nobody's family arranges and nobody sells. It is
            // the only route to the void domain in this harness, and it is why
            // the last few rungs are reachable only from inside the last realm.
            survived: survivedTribulation ? 'tribulation' : nearDeath ? 'near_death' : null
        });
        const candidates = discoverableInsights({ spiritRoot: root.key }, ctx);
        const comprehendRng = stream('origin-sweep-comprehend', ordinal, attempt);
        const chance = COMPREHENSION_BASE + attributes.insight * COMPREHENSION_PER_INSIGHT;
        // ONE candidate per draw. Access decides WHICH comprehensions are on the
        // table, never how many come off it - a library does not make somebody
        // comprehend five things at once, it makes the thing they comprehend a
        // different thing. A cultivator with a single candidate and a cultivator
        // with nine roll the same odds on any given draw, and the number of draws
        // is a function of time sat, which nobody's family arranges.
        const draws = Math.min(
            MAX_COMPREHENSION_DRAWS,
            Math.max(1, Math.floor(yearsNeeded / YEARS_PER_COMPREHENSION_CHANCE))
        );
        for (let d = 0; d < draws && candidates.length > 0; d++) {
            if (!comprehendRng.chance(chance)) continue;
            const candidate = comprehendRng.pick(candidates);
            const achievement = recordAchievement(
                {
                    kind: 'profound_principle',
                    onDay: Math.floor(age * DAYS_PER_YEAR),
                    turn: attempt,
                    summary: `Comprehended something of ${candidate.subject}.`
                },
                comprehendRng
            );
            const merged = integrateInsight(insights, candidate, achievement);
            insights.length = 0;
            insights.push(...merged.insights);
        }

        // ── The ruin ─────────────────────────────────────────────────────
        // Where the ceiling is actually broken, and the only door in the world
        // that opens on nerve rather than on standing.
        // Repeatedly, and until they have what they went in for. Somebody
        // sitting on a pocket of qi nothing has drawn on has no further reason
        // to walk into anywhere lethal, and stops.
        if (willing && ordinal >= RUIN_FLOOR && !foundVein &&
            stream('origin-sweep-goes', ordinal, attempt).chance(RUIN_RETURN_RATE)) {
            const ruinRng = stream('origin-sweep-ruin', ordinal, attempt);
            const supplied = suppliedLeft > 0;
            if (supplied) suppliedLeft--;
            ruinsEntered++;
            const survival = expeditionSurvival(originKey, RUIN_BASE_SURVIVAL, supplied);
            if (!ruinRng.chance(survival)) {
                end = 'died_in_a_ruin';
                break;
            }
            stones += RUIN_STONES * Math.pow(PRICE_GROWTH_PER_ORDINAL, ordinal - RUIN_FLOOR);
            // Having stood close enough to see it is access in its own right,
            // and it is the one source a poor cultivator can reach.
            nearDeath = true;
            if (!foundVein && ruinRng.chance(RUIN_VEIN_CHANCE)) {
                // A pocket nothing has drawn on. Not conferred by anybody.
                ambient = 'sealed_vein';
                foundVein = true;
            }
            if (ruinRng.chance(RUIN_INHERITANCE_CHANCE)) {
                // WHAT IS IN THE HOLE IS NOT ALWAYS THE SAME THING. This drew
                // `mortality` every time, so however many sealed places a life
                // opened, the whole channel was worth exactly one road - and with
                // the dao gate live that capped a reckless poor life at ordinal 24,
                // which is the setting's own "the poor climb by being reckless"
                // failing at the first wall it should open.
                inheritances.push({
                    subject: ruinRng.pick(WHAT_A_SEALED_PLACE_HOLDS),
                    label: 'what was left behind in a sealed place'
                });
            }
        }

        // Where they are standing now. People move, and the world is drawn
        // rather than assigned - the family's holding is a floor under the
        // draw and never a band nobody else can reach. A sealed vein, once
        // found, is not re-rolled: they are sitting in it.
        if (!foundVein) {
            ambient = betterAmbient(
                stream('origin-sweep-ground', ordinal, attempt).weighted(WORLD_AMBIENT_WEIGHTS),
                origin.ground
            );
        }

        // ── The crossing ─────────────────────────────────────────────────
        const gate = canAttemptBreakthrough({
            realmOrdinal: ordinal,
            cultivationProgress: progress,
            spiritRoot: root.key,
            insights,
            // The same subject the attempt below is made with. `attemptBreakthrough`
            // runs this gate again against the full cultivator, so checking it
            // here against a subject that omits a field the gate reads reports
            // "eligible" and then throws a line later. Harmless while every
            // refusal was about progress; a cultivator halted at a wall carries
            // the reason in their wound list.
            injuries,
            alive: true
        });
        if (!gate.eligible) {
            // Never silently. A run that stops here has hit a gate rather than
            // a clock, and reporting it as a lifespan would hide the fact.
            end = gate.reason === 'at_ladder_summit' ? 'summit'
                : gate.reason === 'insufficient_dao' ? 'no_road'
                    : 'settling';
            break;
        }

        // Priced against the rank it is for. This is what stops a fortune
        // compounding: the pill that carries somebody through ordinal 24 is not
        // the object that carried them through ordinal 4, and is not priced
        // like one.
        const pillPrice = breakthroughPillPrice(ordinal);
        const potency = affordablePillPotency(stones, pillPrice);
        stones = Math.max(0, stones - potency * pillPrice);
        const foundationPotency =
            ordinal + 1 === RUIN_FLOOR ? affordablePillPotency(stones, FOUNDATION_PILL_STONES) : 0;
        stones = Math.max(0, stones - foundationPotency * FOUNDATION_PILL_STONES);

        const result = attemptBreakthrough(
            {
                realmOrdinal: ordinal,
                cultivationProgress: progress,
                spiritRoot: root.key,
                attributes,
                injuries,
                insights,
                foundationQuality: foundation,
                alive: true
            },
            {
                rng: forStream(seed, 'origin-sweep-bt', originKey, index, attempt++),
                ambient,
                turn: Math.floor(age),
                pill: potency > 0 ? { name: 'a pill', potency: potency * MAX_PILL_BONUS } : null,
                // Preparation is what the holding pays for: a chosen site, a
                // cleared schedule, nobody hunting you.
                foundation: {
                    preparation: Math.min(1, stones / (STONES_PER_YEAR_OF_SECLUSION * 40)),
                    pillPotency: foundationPotency
                },
                toll: { candidates: [] }
            }
        );

        progress = Math.max(0, progress - result.progressConsumed);
        for (const injury of result.injuriesSustained) injuries.push(injury);
        if (result.foundationEstablished) foundation = result.foundationEstablished;
        if (result.tribulation?.survived) survivedTribulation = true;

        // Torn meridians are the ratchet, and a healer costs stones. This is
        // the single largest thing a holding buys, and it is why a poor run
        // stalls in the low thirties on damage rather than on the clock.
        const treatmentPrice = injuryTreatmentPrice(ordinal);
        const affordable = Math.floor(stones / treatmentPrice);
        if (affordable > 0 && injuries.some(i => !i.treated)) {
            const healed = treatWorstInjuries(injuries, affordable);
            stones = Math.max(0, stones - healed.treatedCount * treatmentPrice);
            injuries.length = 0;
            injuries.push(...healed.injuries);
        }

        if (result.outcome === 'death') {
            end = 'died_in_breakthrough';
            break;
        }
        // The other landing of the last crossing
        if (result.outcome === 'false_immortal') {
            ordinal = result.toOrdinal;
            peak = Math.max(peak, ordinal);
            immortalStatus = result.immortalStatusGained ?? 'false_immortal';
            end = 'false_immortal';
            break;
        }
        if (result.outcome === 'success') {
            ordinal = result.toOrdinal;
            peak = Math.max(peak, ordinal);
            yearsAtRank = 0;
            if (ordinal >= MAX_ORDINAL) {
                immortalStatus = result.immortalStatusGained ?? 'true_immortal';
                end = 'summit';
                break;
            }
        }
    }

    return {
        peakOrdinal: peak,
        end,
        foundVein,
        ruinsEntered,
        insightCount: insights.length,
        deepestDegree: insights.reduce((best, i) => Math.max(best, i.degree), 0),
        degreeTotal: insights.reduce((sum, i) => sum + i.degree, 0),
        ageAtEnd: age,
        foundation,
        immortalStatus
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE REPORT
// ─────────────────────────────────────────────────────────────────────────

export interface OriginOutcomeRow {
    origin: OriginTierKey;
    name: string;
    /** Share of births that land here. */
    birthShare: number;
    sampleSize: number;
    /** Mean peak ordinal across the sample. */
    meanPeakOrdinal: number;
    /** Median peak ordinal. The number the mean hides. */
    medianPeakOrdinal: number;
    /** Share reaching each of {@link REPORTED_THRESHOLDS}, conditional on the tier. */
    reachedAtLeast: Record<number, number>;
    /**
     * Of the lives that got as far as Core Formation, the share that went on to the
     * last realm.
     */
    summitGivenCoreFormation: number | null;
    /** How the lives ended. */
    ends: Record<LifeEnd, number>;
    /** Share that ever stood on a sealed vein. */
    veinShare: number;
    /** Share that ever walked into somewhere lethal. */
    ruinShare: number;
    /** Share that ever comprehended anything at all, at any degree. */
    comprehendedShare: number;
    /**
     * Share holding a comprehension at intent degree or better.
     */
    deepComprehensionShare: number;
}

export interface OriginOutcomeReport {
    seed: string;
    perTierSampleSize: number;
    rows: OriginOutcomeRow[];
    /**
     * Run-level share reaching each threshold, weighted by the birth
     * distribution. Exact in the weights and sampled only in the conditionals,
     * which is the only way a 1-in-25,000 birth is measurable at all.
     */
    runLevel: Record<number, number>;
    /**
     * The whole point of the exercise: how much of the outcome distribution
     * privilege actually explains.
     */
    privilegeLift: {
        medianLift: number;
        meanLift: number;
        topLift: number;
        /**
         * The same ratio at Foundation Establishment, which is where an origin
         * actually bites. Reported beside `topLift` because the honest account
         * of this axis is "decisive in the first realm and a half, and a
         * constant factor inherited from that everywhere above it".
         */
        foundationLift: number;
        /**
         * Share of ALL runs reaching the last realm that were well-born, weighted
         * by the birth distribution.
         */
        wellBornShareOfSummits: number;
    };
}

export interface OriginSweepOptions {
    /** Lives per tier. The last realm wants a large one. */
    perTierSampleSize?: number;
}

/**
 * Measure every tier at the same sample size and report the comparison.
 */
export function measureOriginOutcomes(
    seed: string,
    opts: OriginSweepOptions = {}
): OriginOutcomeReport {
    const n = Math.max(1, opts.perTierSampleSize ?? 2_000);
    const rows: OriginOutcomeRow[] = [];

    for (const tier of ORIGIN_TIERS) {
        const peaks: number[] = [];
        const ends: Record<LifeEnd, number> = {
            died_in_breakthrough: 0,
            died_in_a_ruin: 0,
            lifespan: 0,
            settling: 0,
            no_road: 0,
            summit: 0,
            false_immortal: 0,
            guard: 0
        };
        let veins = 0;
        let ruins = 0;
        let comprehended = 0;
        let deeplyComprehended = 0;

        for (let i = 0; i < n; i++) {
            const life = simulateLife(seed, i, tier.key);
            peaks.push(life.peakOrdinal);
            ends[life.end]++;
            if (life.foundVein) veins++;
            if (life.ruinsEntered > 0) ruins++;
            if (life.insightCount > 0) comprehended++;
            if (life.deepestDegree >= 3) deeplyComprehended++;
        }

        const sorted = [...peaks].sort((a, b) => a - b);
        const reachedCore = peaks.filter(p => p >= CORE_FORMATION_ORDINAL).length;
        const reachedSummit = peaks.filter(p => p >= MAX_ORDINAL).length;
        const reachedAtLeast: Record<number, number> = {};
        for (const threshold of REPORTED_THRESHOLDS) {
            reachedAtLeast[threshold] = peaks.filter(p => p >= threshold).length / n;
        }

        rows.push({
            origin: tier.key,
            name: tier.name,
            birthShare: originProbability(tier.key),
            sampleSize: n,
            meanPeakOrdinal: peaks.reduce((a, b) => a + b, 0) / n,
            medianPeakOrdinal: sorted[Math.floor(n / 2)],
            reachedAtLeast,
            summitGivenCoreFormation:
                reachedCore >= MIN_CONDITIONAL_DENOMINATOR ? reachedSummit / reachedCore : null,
            ends,
            veinShare: veins / n,
            ruinShare: ruins / n,
            comprehendedShare: comprehended / n,
            deepComprehensionShare: deeplyComprehended / n
        });
    }

    const runLevel: Record<number, number> = {};
    for (const threshold of REPORTED_THRESHOLDS) {
        runLevel[threshold] = rows.reduce(
            (sum, r) => sum + r.birthShare * r.reachedAtLeast[threshold],
            0
        );
    }

    const poorest = rows[0];
    const richest = rows[rows.length - 1];
    const summitTotal = runLevel[MAX_ORDINAL] || 0;
    // "Well-born" here means anything a family placed: minor_clan and above.
    const wellBornSummits = rows
        .slice(2)
        .reduce((sum, r) => sum + r.birthShare * r.reachedAtLeast[MAX_ORDINAL], 0);

    return {
        seed,
        perTierSampleSize: n,
        rows,
        runLevel,
        privilegeLift: {
            medianLift: richest.medianPeakOrdinal - poorest.medianPeakOrdinal,
            meanLift: richest.meanPeakOrdinal - poorest.meanPeakOrdinal,
            // Floored at one life in the sample, so the ratio stays a finite
            // LOWER BOUND rather than an infinity that serialises as null.
            topLift:
                richest.reachedAtLeast[MAX_ORDINAL] /
                Math.max(poorest.reachedAtLeast[MAX_ORDINAL], 1 / n),
            foundationLift:
                rows[0].reachedAtLeast[FOUNDATION_ORDINAL] > 0
                    ? richest.reachedAtLeast[FOUNDATION_ORDINAL] /
                      rows[0].reachedAtLeast[FOUNDATION_ORDINAL]
                    : 0,
            wellBornShareOfSummits: summitTotal > 0 ? wellBornSummits / summitTotal : 0
        }
    };
}
