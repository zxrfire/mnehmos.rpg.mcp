/**
 * What being born somewhere is actually worth, measured.
 *
 * `docs/world/origin.md` makes a claim the design lives or dies on:
 *
 *   > A privileged origin should be VISIBLE IN THE RUN'S OPENING POSITION and
 *   > NOT VISIBLE IN ITS OUTCOME DISTRIBUTION, except at the very top where it
 *   > is one required term among several. If being well-born reliably produces
 *   > high-realm cultivators, the axis has been implemented wrong.
 *
 * That is a measurable statement, so it is measured here rather than asserted
 * in a comment. This module runs whole lives through the real engine -
 * `computeCultivationRate`, `attemptBreakthrough`, `assessFoundation`, the real
 * settling and lifespan clocks - once per origin tier, and reports where they
 * stopped.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE HARNESS SPENDS AN ORIGIN ON
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Exactly the five things the axis confers, and nothing else:
 *
 *   ground        the best band the family can put them on, capped at dense.
 *                 A sealed vein is never conferred; it has to be walked into.
 *   stones        spent, and gone. Upkeep every year, a pill at every attempt,
 *                 a healer for every torn meridian. A patriarch's fortune runs
 *                 out over a thousand-year climb like everyone else's, later.
 *   placement     a rate multiplier and a ceiling that is the house's rather
 *                 than the province's. Never a rank, never admission.
 *   access        which comprehensions are in reach AT ALL, through
 *                 `discoverableInsights`. With none, a life reaches its own
 *                 root and nothing else however long it sits.
 *   supplied      a bounded addition to the survival odds of walking into
 *   risk          somewhere lethal, and a count that runs out.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND WHAT IT DOES NOT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * No origin touches the spirit root, the attributes, the breakthrough roll
 * directly, whether a ruin contains anything, or whether this person is
 * willing to walk into it. Willingness is drawn per life from its own stream
 * and is the same draw for a farmer and a patriarch's son - which is most of
 * why the outcome distributions converge, and it is deliberate: declining the
 * ruin is the rational choice, and the reason the ones who went are talked
 * about.
 *
 * Nothing here feeds back into the simulation. It measures and it reports.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE FALSE IMMORTAL WAS BEING DISCARDED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Corrected here, and written down because every population figure this module
 * produced before the fix was wrong at the top of the ladder in the same way.
 *
 * `attemptBreakthrough` answers the last crossing with THREE outcomes:
 * `'success'` (True Immortal, ordinal 46), `'false_immortal'` (ordinal 45), and
 * the ordinary failures. The walk below handled `'death'` and `'success'` and
 * had no branch for the middle one - so a crossing that landed False fell
 * through every branch, the ordinal never moved, and the cultivator went round
 * the loop still standing at 44 with the accumulation spent
 * (`LAST_CROSSING_PROGRESS_LOSS` is total). Because the harness also never
 * carried an `ImmortalStatus`, `hasCrossedTheLid` was never consulted, and the
 * re-attempt the engine bars PERMANENTLY was allowed - repeatedly, until the
 * roll came up True or a clock ran out.
 *
 * The effect was not a small bias. Measured over 1,200,000 lives immediately
 * before the fix, at ordinal 44:
 *
 *     false_immortal      58      <- the commonest landing, and all 58 discarded
 *     success             28
 *     death               27
 *     failure_injured     19
 *     failure_deviation   18
 *
 * and yet ZERO lives ended at peak ordinal 45, against 28 at 46. Every sweep
 * anybody has run off this module was therefore measuring a world in which the
 * Hollow Court does not exist, while `MAX_COMPLETION_CHANCE` (0.25) says three
 * crossings in four should end there.
 *
 * WHAT IT DID NOT DO IS INFLATE THE SUMMIT. The obvious second worry - that
 * rerolling a barred crossing manufactured True Immortals - is measurable and
 * did not happen: over 1,800,000 lives the count reaching ordinal 46 was 40
 * before the fix and 40 after it, while ordinal 45 went from 0 to 123. A second
 * attempt costs the whole last-crossing price again (`LAST_CROSSING_TAX` is 3)
 * and the settling clock at 44 essentially never affords one, so the illegal
 * re-attempt was available in principle and almost never taken. The damage was
 * a missing population, not a corrupted one.
 *
 * A life that lands at 45 now stops climbing, which is what the setting says:
 * the Lid does not open twice for the same name.
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
 *
 * This is the correction that stops the comparison lying. Pinning every
 * unplaced life to thin ground would hand the well-born a permanent fourfold
 * rate advantage that the world does not actually give them: half the world is
 * thin, but a third of it is ordinary and one life in twenty is born standing
 * on something good. What an origin buys is a FLOOR under that draw, not a
 * band nobody else can reach.
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
 *
 * Everyone earns. A poor cultivator is not locked out of the pill market
 * forever, they arrive at it late and buy less - which is the difference
 * between a road being long and a road being closed, and is the whole of what
 * this axis is trying to be.
 */
function earningsPerYear(ordinal: number): number {
    return EARNINGS_AT_ORDINAL_ZERO * Math.pow(PRICE_GROWTH_PER_ORDINAL, Math.max(0, ordinal));
}

/**
 * Stones a year a mortal-rank cultivator can make.
 *
 * Income grows at the SAME rate prices do, which makes affordability
 * scale-invariant: at every rank on the ladder, roughly eighty years of a
 * cultivator's own earnings buys one pill at full potency. Nothing about the
 * economy gets structurally easier or harder as the realms climb.
 *
 * That is what confines a starting fortune to being a HEAD START rather than a
 * standing advantage. It moves a cultivator a fixed number of rungs further up
 * before they have to start buying out of income, and above that line the
 * patriarch's son and the farmer are shopping in the same market on the same
 * terms.
 */
const EARNINGS_AT_ORDINAL_ZERO = 6;

/**
 * Ordinal from which a sect recruits on what you have reached rather than on
 * whose child you are.
 *
 * Above it, placement is worth nothing at all: the poor cultivator who got
 * here on their own is admitted on the same terms and draws the same support.
 * This is what confines the value of being placed to the years when it
 * actually mattered, and it is the mechanical form of the Hollow Court's rule
 * one ladder down.
 */
const MERIT_ADMISSION_ORDINAL = 5;

/**
 * How far up the world's shelf somebody climbing on merit can reach.
 *
 * The whole of it, and that is not generosity - `bestReadable` still stops them
 * at what they can actually work, so the limit becomes the reader rather than
 * their parents. That is precisely the axis `docs/world/origin.md` asks for:
 * privilege visible in the opening position and not in the outcome.
 *
 * A mediocre cultivator who climbs here is handed the working book and takes
 * the working book. Somebody who has spent a life accumulating comprehension
 * reaches the top of it, which is the conjunction the last realm already
 * requires - a vein, a ruin, and twenty degrees of understanding.
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
 *
 * Drawn per life, identical across tiers. Declining is the rational choice and
 * most people make it - which is exactly why the ones who went are the ones
 * anybody has heard of.
 */
const RUIN_WILLINGNESS = 0.18;

/**
 * Chance a willing cultivator goes back in at any given rank.
 *
 * The doc's conjunction requires risk taken REPEATEDLY, so going once is not
 * the shape being modelled. It is also why almost nobody who takes this road
 * arrives anywhere: the survival roll is made again every time.
 */
const RUIN_RETURN_RATE = 0.4;

/** Base survival of one attempt, before anything supplied is added. */
const RUIN_BASE_SURVIVAL = 0.45;

/** Chance a survived attempt turns up a pocket nothing has drawn on. */
const RUIN_VEIN_CHANCE = 0.02;

/** Chance a survived attempt turns up an inheritance worth comprehending. */
const RUIN_INHERITANCE_CHANCE = 0.18;

/** Stones a survived attempt is worth. The poor road's actual economics. */
const RUIN_STONES = 2_200;

/**
 * Per-rank chance a reachable comprehension is actually comprehended.
 *
 * Small on purpose. Most cultivators live and die having comprehended nothing
 * anyone would record, and access decides WHICH things are on the table rather
 * than how many come off it.
 */
const COMPREHENSION_BASE = 0.06;

/** How much Insight moves that. Still a chance, never a schedule. */
const COMPREHENSION_PER_INSIGHT = 0.03;

/**
 * Years of sitting with something before it gets another chance to arrive.
 *
 * Comprehension is a function of time spent, not of ranks crossed. A rank near
 * the top of the ladder is centuries long and a rank near the bottom is a
 * decade, and a cultivator who spent three hundred years on a vein with a
 * library has had three hundred years of chances - which is how a run reaches
 * the degrees the last realms actually need.
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
 *
 * Set ABOVE the largest lifespan on the ladder - Tribulation Transcendence
 * grants a hundred thousand years - so that the guard can never bind before
 * the real clocks do. A guard below the top realm's lifespan is not a guard,
 * it is an invisible ceiling: at 6,000 it silently truncated every run in the
 * last three realms, and reported them as having died of old age.
 */
const MAX_YEARS = 250_000;

/**
 * The rungs worth reporting a share for.
 *
 * `MAX_ORDINAL` must be the last entry, and this list has been wrong about
 * that. It stopped at 45 while the ladder tops out at 46, so
 * `reachedAtLeast[MAX_ORDINAL]` was `undefined`, `privilegeLift.topLift` was
 * `NaN` on every run - serialising as `null` - and `wellBornShareOfSummits` was
 * a hard zero. Those two are the report's headline numbers and they are exactly
 * the ones that check the design constraint in `docs/world/origin.md`: that
 * origin is not visible in the outcome distribution EXCEPT AT THE VERY TOP.
 * The exception clause had therefore never been measured at all.
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
    /** The last crossing completed. True Immortal, ordinal 46. */
    | 'summit'
    /**
     * The last crossing did NOT complete. False Immortal, ordinal 45.
     *
     * A separate end because it is a separate landing, and because this harness
     * used to have no name for it at all - see THE FALSE IMMORTAL WAS BEING
     * DISCARDED in the header.
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
 *
 * Deterministic in (seed, index, origin). The origin is a parameter rather
 * than a draw so a tier can be measured at a usable sample size; the run-level
 * number is composed from the tier weights afterwards, which is exact rather
 * than sampled.
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
        //
        // This was got wrong once and the suite caught it. Feeding
        // `origin.roadQuality` all the way up made the road a PERMANENT term -
        // the one thing an origin confers that never expires - and privilege
        // became visible in the outcome distribution, which `docs/world/origin.md`
        // says is the failure condition for the whole axis. Measured: 9.8% of
        // top-tier children reached Core Formation against a 5% bar, and a
        // farmer's best life fell from ordinal 30 to 20 because the stall primer
        // followed them for a thousand years.
        //
        // A book is not a body. Above the merit line the house that admitted
        // this person opens its shelf to them, and `manuals.md` is explicit that
        // rank reaches up a shelf - so what they read is the ordinary working
        // book, whoever their parents were. Below it, they read what their
        // family could reach. Exactly the shape `sectBonus` already has, for
        // exactly the same reason.
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
                // The rung they are standing on. This was left out on purpose
                // once, and the note explaining why was right about the
                // consequence and wrong about the conclusion: supplying it
                // moves this harness hard, because the realm intake term
                // compounds upward and the well-born are the ones standing
                // high enough to collect it. Top-tier children reaching Core
                // Formation go from about 4% to about 8%.
                //
                // It is supplied now anyway, for two reasons. It is what the
                // played game does - `time-skip.ts` passes the ordinal - so
                // withholding it here measured a ladder nobody actually
                // climbs. And the effect it produces is the thing this file
                // exists to measure: that backing shortens the road. A harness
                // that flattened the advantage in order to keep a bar was
                // reporting a smaller advantage than the engine grants.
                //
                // The same defect was found and fixed in `seeding.ts`'s
                // `deriveLife` and in `ladder-odds.ts`, where it had the
                // ladder stopping dead at Core Formation.
                realmOrdinal: ordinal
            },
            ambient,
            {
                focusMultiplier: focus,
                // An actual book, from the same place the ground and the
                // stipend come from. Replaces `1 + insight * 0.06`, a proxy for
                // a manual nobody was holding that also counted insight twice.
                //
                // Placement stops mattering at `MERIT_ADMISSION_ORDINAL` above
                // and the road does NOT: a book is an object somebody was
                // handed and kept, and reaching the rung a sect recruits at
                // does not retroactively improve the copy in your bag.
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
        // Land just ABOVE the requirement rather than exactly on it.
        // `need` is `required - substituted - progress`, so adding it back
        // reconstructs `required` through two floating-point subtractions and
        // lands a few ulps below it about half the time. At ordinal 39 the
        // requirement is around 1e7 and an ulp is a hundredth of a qi-unit,
        // which is invisible - and `canAttemptBreakthrough` then refuses the
        // attempt for `insufficient_progress`, silently stalling every run in
        // the last three realms. The epsilon is smaller than a day of
        // accumulation at any rate this harness produces.
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
            locationTags: foundVein ? ['deep_cave'] : [],
            // Having stood under heavenly lightning and still been standing
            // after is access nobody's family arranges and nobody sells. It is
            // the only route to the void domain in this harness, and it is why
            // the last few rungs are reachable only from inside the last realm.
            survived: survivedTribulation ? 'tribulation' : nearDeath ? 'near_death' : null
        });
        const candidates = discoverableInsights({ spiritRoot: root.key }, ctx);
        const comprehendRng = stream('origin-sweep-comprehend', ordinal, attempt);
        const chance = COMPREHENSION_BASE + attributes.insight * COMPREHENSION_PER_INSIGHT;
        // ONE candidate per draw. Access decides WHICH comprehensions are on
        // the table, never how many come off it - a library does not make
        // somebody comprehend five things at once, it makes the thing they
        // comprehend a different thing. A cultivator with a single candidate
        // and a cultivator with nine roll the same odds on any given draw, and
        // the number of draws is a function of time sat, which nobody's family
        // arranges.
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
                inheritances.push({
                    subject: 'mortality',
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
            end = gate.reason === 'at_ladder_summit' ? 'summit' : 'settling';
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
        // ── The other landing of the last crossing ───────────────────────
        //
        // `attemptBreakthrough` answers the crossing from ordinal 44 with THREE
        // possible outcomes, not two: 'success' (True Immortal, 46),
        // 'false_immortal' (45), or a failure. This branch used to be absent,
        // and its absence is why every sweep this harness has ever produced
        // reported a world with no False Immortals in it. See the header.
        //
        // The ordinal moves, and the walk STOPS: `hasCrossedTheLid` bars a
        // re-attempt permanently, so a life that lands here is finished
        // climbing whatever its remaining span. Falling through to the loop
        // instead is what re-rolled the crossing until it came up True.
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
     * Of the lives that got as far as Core Formation, the share that went on to
     * the last realm.
     *
     * The cleanest test of the design's central claim. If an origin buys the
     * ENTRANCE and not the summit, this number should be roughly the same for a
     * farmer's child and a patriarch's - the well-born are simply far more
     * likely to be in the denominator at all. Null when the denominator is too
     * small to say anything, which is the honest answer at these rates.
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
     *
     * The "anything anyone would record" bar. A glimpse of your own root
     * element is not a thing the world notices, and counting it as
     * comprehension would make the axis look far more generous than it is.
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
     *
     * `medianLift` is the difference in median peak ordinal between the most
     * and least privileged tiers. `topLift` is the ratio of their shares at
     * the last realm. The design wants the first near zero and the second
     * large, which is "visible at the top and nowhere else" stated as two
     * numbers.
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
         * Share of ALL runs reaching the last realm that were well-born,
         * weighted by the birth distribution.
         *
         * Read this one with care: at any tractable sample size it is dominated
         * by sampling noise in the two enormous tiers, because a single summit
         * among a hundred thousand thin-county lives outweighs thirty among a
         * hundred thousand top-tier ones once the 90%-versus-0.004% birth
         * weights are applied. What it is genuinely good for is the sign: the
         * poor are so much more numerous that most of the world's immortals are
         * still poor people who walked into a ruin, however much likelier any
         * INDIVIDUAL patriarch's child is to arrive.
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
 *
 * Equal N per tier rather than a weighted draw: a 1-in-25,000 birth would
 * otherwise contribute a handful of lives to any tractable sweep and the
 * conditional would be pure noise. The weights are then applied exactly, in
 * `runLevel`, which is both cheaper and more accurate than sampling them.
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
