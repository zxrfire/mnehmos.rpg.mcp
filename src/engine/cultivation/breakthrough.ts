/**
 * Breakthrough - the centrepiece.
 *
 * Everything else in the cultivation layer exists to set up this one roll. A
 * breakthrough is the only moment where accumulated advantage converts into
 * rank, and the only routine moment where a run can simply end.
 *
 * Three rules shape the whole design:
 *
 *  1. THE ENGINE SHOWS ITS WORK. Every modifier is itemised in
 *     `result.modifiers`, and the deltas sum exactly to `finalChance`. The UI
 *     must be able to print "0.33 base, -0.06 injuries, +0.08 insight" without
 *     recomputing anything, and a player who dies must be able to see why the
 *     odds were what they were. This invariant is tested.
 *
 *  2. NEVER 0%, NEVER 100%. Clamping to (0,1) is not a numerical nicety - it is
 *     the genre. The heavens are never certain and never merciful. A cultivator
 *     with every advantage still rolls; a cripple in thin qi still has a
 *     sliver. When the clamp bites, it appears in the modifier list as its own
 *     line so the arithmetic stays auditable.
 *
 *  3. REALM BOUNDARIES ARE A DIFFERENT KIND OF EVENT. `baseBreakthroughChance`
 *     already applies a 0.45x tax at a boundary. This module adds a second,
 *     more interesting difference: the FAILURE TABLE. Failing a sub-rank step
 *     is usually just a wasted month. Failing a realm boundary is where torn
 *     meridians, qi deviation and corpses come from. Boundaries are not merely
 *     less likely to succeed - they are far more expensive to fail.
 *
 * Tribulation Transcendence adds heavenly lightning on top, on every crossing
 * into it, within it, and out of it: the primary roll gets you to the
 * tribulation, and then a multi-strike sequence decides whether you survive
 * having gotten there.
 *
 * The last crossing, 44 -> 45, is the only attempt in the game that resolves
 * three ways rather than two. See THE LAST CROSSING near the bottom of the
 * file.
 *
 * Note what is NOT in the odds: Fortune. Luck generates opportunity, not
 * success, and a breakthrough is a causal outcome. See FORTUNE_PER_POINT.
 */

import {
    MAX_RANKS_PER_TURN,
    type AmbientQi,
    type BreakthroughFailure,
    type BreakthroughResult,
    type Cultivator,
    type Injury,
    type InjurySeverity,
    type TechniqueGrade,
    type Insight,
    type InsightDomain,
    type ManualQuality,
    InsightDomainSchema
} from '../../schema/cultivation.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    LAST_CROSSING_ORDINAL,
    MAX_ORDINAL,
    REALM_TIERS,
    baseBreakthroughChance,
    hasCrossedTheLid,
    isLastCrossing,
    isRealmBoundary,
    lifespanForOrdinal,
    progressRequiredForOrdinal,
    rankName,
    realmForOrdinal,
    triggersHeavenlyTribulation,
    type RealmKey
} from './realms.js';
import { getSpiritRoot, type SpiritRootGrade } from './spirit-roots.js';
import {
    roadsWalkedBy,
    type RoadBearer,
    type RoadWithinReach
} from './what-a-road-in-reach-costs-to-walk.js';
import { getWoundType } from '../../data/cultivation/wounds.js';
import { readManual } from './manual-quality.js';
import { ambientBreakthroughMod } from './ambient.js';
import { aggregateInjuryPenalties, createInjury, scarTempering } from './injuries.js';
import { ordinaryWoundFor } from './which-wound-an-ordinary-injury-is.js';
import {
    assessFoundation,
    foundationEffect,
    foundationOf,
    laysFoundation,
    type FoundationConditions
} from './foundation.js';
import { evaluateToll, isTolled, type TollConditions } from './toll.js';
import {
    BROKEN_STATUS_STRAIN,
    brokenStatusOf,
    brokenStatusRepairedBy,
    resolveCrossingFailure,
    rollArrivesBroken,
    structuralBlockOn,
    trialForOrdinal,
    type CrossingConsequence,
    type TrialKind
} from './what-goes-wrong-at-a-realm-boundary.js';
import {
    bottleneckSubstitution,
    understandingEffects,
    type RelevanceContext
} from './understanding.js';
import type { CultivationRNG } from './rng.js';

// ─────────────────────────────────────────────────────────────────────────
// TUNING CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The floor and ceiling on breakthrough probability.
 *
 * 2% and 97%. Deliberately not 0 and 1: see rule 2 above. The floor also stops
 * a badly-injured cultivator's odds going negative and turning `roll < chance`
 * into an unreachable branch that tests can never cover.
 */
export const MIN_BREAKTHROUGH_CHANCE = 0.02;
export const MAX_BREAKTHROUGH_CHANCE = 0.97;

/**
 * The ceiling on a REALM BOUNDARY, which is a different ceiling and much lower.
 *
 * This is the correction that recalibrated the top of the ladder, and it is
 * worth stating plainly because the old single ceiling looked harmless.
 *
 * Preparation is additive here - root, comprehension, foundation, the site, a
 * pill - and a cultivator who has all of it clears +1.0 of modifiers before the
 * base is even counted. Against one ceiling of 0.97 that meant a fully prepared
 * cultivator crossed EVERY realm boundary at 97%, so the nine walls of the
 * ladder were nine formalities and the only thing that could end such a run was
 * the clock. Measured, that produced 73% of best-case lives arriving above the
 * Lid, which is not a ladder, it is a corridor.
 *
 * A wall you can prepare your way through at 97% is not a wall. Preparation buys
 * you the ATTEMPT - the right to stand in front of it with the qi gathered and
 * your meridians whole - and the crossing decides the rest. FIVE IN SIX IS AS
 * GOOD AS A REALM BOUNDARY EVER GETS, for anybody, ever.
 *
 * The figure is deliberately not punitive, and it is not where the rarity of
 * the top of the ladder is supposed to live. Perfect conditions are meant to be
 * GOOD odds; what makes an immortal rare is that almost nobody ever gets those
 * conditions, which is a fact about spirit roots, sealed veins and living
 * teachers rather than about this constant. Measured over whole lives, the cap
 * moves the best-case share finishing above the Lid from 73% to about a half,
 * and the share coming out True Immortal from 28% to about 14%.
 *
 * It is also as low as it can go. The population structure below depends on a
 * thin-county farmer who finds a vein still being able to reach Void Refinement
 * - the setting's own "the well-born climb by being supplied and the poor climb
 * by being reckless" - and that road runs through the Deity Transformation wall
 * on a single attempt the clock will not let them repeat. At 0.80 it closes
 * entirely: 30,000 sampled poor lives, none past ordinal 28. The existence
 * proof is one life in thirty thousand either way, so treat this constant as
 * load-bearing for `tests/engine/world/origin-outcomes.test.ts` and re-run that
 * file before moving it.
 *
 * -- AND THE DAO GATE NOW BINDS THE SAME ROAD, WHICH IS A REAL TENSION -----
 *
 * Written down rather than resolved quietly, because it is a design question
 * and not a tuning one. `daoRequirementCurve` charges 3 roads at the crossing
 * out of ordinal 28, and a thin-county life has no house, no shelf and nobody
 * to teach it. Measured across 60,000 poor lives with the gate live: 36 reach
 * that wall and 2 of them are allowed to strike at it. The rest are refused for
 * want of comprehension rather than for want of qi, which the origin sweep now
 * reports as its own `no_road` end instead of burying it in `settling`.
 *
 * So the poor road to Void Refinement is NOT closed - it runs through ruins and
 * through whatever the province left standing open, rather than through a sect
 * - but it is far narrower than this constant alone implies, and the narrowing
 * is the gate rather than the ceiling.
 *
 * That is arguably the gate working exactly as intended. Its whole purpose is
 * that "nothing on the ladder ever asked a cultivator for anything they could
 * only get from somebody else, so joining a sect meant nothing and sitting in a
 * cave forever was a complete strategy" - and a rogue farmer stopped at the
 * Void Refinement wall is that sentence coming true. It is still a change to a
 * stated design commitment and it belongs to the design owner.
 *
 * If the farmer's road has to stay as wide as it was, THE LEVER IS THE SUPPLY -
 * more open ground, more in the holes - and not this constant and not the
 * curve. Re-run `scripts/probe-can-the-world-feed-the-dao-gate.ts` alongside
 * the origin sweep before moving either.
 */
export const MAX_BOUNDARY_CHANCE = 0.85;

/**
 * The last crossing is exempt, and gets the ordinary ceiling back.
 *
 * Not a softening. At an ordinary boundary the primary roll asks whether the
 * cultivator can open the wall; at 44 there is no wall to open. The price has
 * been paid, the tribulation is coming down whether or not anyone is ready for
 * it, and the primary roll only asks whether the cultivator can hold what they
 * gathered long enough to call it. What is genuinely in doubt at the last
 * crossing is the lightning and the seam, and those are rolled separately - see
 * THE LAST CROSSING at the bottom of the file. Capping the primary roll here as
 * well would have priced the same danger twice.
 */
export function maxChanceFor(ordinal: number): number {
    if (isLastCrossing(ordinal)) return MAX_BREAKTHROUGH_CHANCE;
    return isRealmBoundary(ordinal) ? MAX_BOUNDARY_CHANCE : MAX_BREAKTHROUGH_CHANCE;
}

/**
 * Spirit-root contribution, by grade.
 *
 * Note this is NOT `cultivationSpeed`. Speed decides how fast you arrive at the
 * bottleneck; this decides whether you get through it. Mutated roots are fast
 * and powerful but volatile - they get a smaller bonus than clean single roots
 * despite cultivating faster, because raw lightning is not the same as control.
 *
 * dual through muddled is one descending run, and the steps shorten as it
 * falls: the difference between two elements and three is felt at a
 * bottleneck, the difference between four and five barely is. By then the
 * intake is already divided past the point where one more division matters.
 */
export const BREAKTHROUGH_ROOT_MOD: Record<SpiritRootGrade, number> = {
    single: 0.06,
    dual: -0.04,
    triple: -0.05,
    quad: -0.055,
    muddled: -0.06,
    mutated: 0.02
};

/**
 * Insight is comprehension, and comprehension is what a bottleneck actually
 * tests. Centred on 2 (the middle of the 1-4 range), so the range runs
 * -0.04 to +0.08.
 */
export const INSIGHT_PIVOT = 2;
export const INSIGHT_PER_POINT = 0.04;

/**
 * Fortune contributes NOTHING here, and that is a deliberate correction.
 *
 * Luck generates opportunity, not success. A breakthrough is a causal outcome -
 * it is decided by talent, comprehension, preparation, ambient qi, the state
 * of the meridians and what was swallowed beforehand - and none of those are
 * things luck should be allowed to buy. A cultivator does not punch through a
 * bottleneck because the dice liked them.
 *
 * Fortune's real weight lives in the time-skip's event generation, where it
 * selects among branches the world already permits: whether an opportunity is
 * drawn at all, whether the window is still open when you arrive, whether the
 * patrol took the other road. It biases timing, presence and availability. It
 * never softens a resolution and never reaches into a probability that
 * represents a real capability gap. It also still moves the Toll, where it
 * means "the crossing happened to pass over lightly", not "this one is harder to
 * charge".
 *
 * The constant is kept, at zero, so the intent is legible at the call site
 * instead of being an unexplained absence.
 */
export const FORTUNE_PER_POINT = 0;

/** Extra strain at a realm boundary, on top of the 0.45x already in the base. */
export const REALM_BOUNDARY_STRAIN = -0.08;

/**
 * Additional strain on the last crossing, 44 -> 45, on top of the boundary tax
 * and the boundary strain. The hardest attempt in the game by a wide margin,
 * and the only one whose failure table is not the end of the story.
 */
export const LAST_CROSSING_STRAIN = -0.15;

/**
 * Chance that a SURVIVED last crossing actually completes, before modifiers.
 *
 * Low on purpose. Surviving seven strikes of heavenly lightning only earns the
 * right to find out whether the seam stays open long enough, and for most of
 * those who get that far it does not. False Immortal is the common outcome and
 * True Immortal is the rare one - that asymmetry is the Hollow Court's actual
 * membership, and the reason nobody currently alive has crossed.
 */
export const TRUE_IMMORTAL_BASE_COMPLETION = 0.12;
/** Each strike that landed is damage the crossing has to carry through the seam. */
export const COMPLETION_PER_LANDED_STRIKE = -0.05;
export const MIN_COMPLETION_CHANCE = 0.01;
/**
 * A quarter, and the ceiling is the whole point of the number.
 *
 * Everything that helps a crossing - the site, the foundation, a clean
 * tribulation - is additive and a well-prepared cultivator clears the raw
 * figure easily, so in practice this cap is what every crossing worth making
 * actually resolves at. That makes it a design statement rather than a
 * safeguard: THREE OUT OF FOUR CROSSINGS THAT SURVIVE THE LIGHTNING DO NOT GO
 * THROUGH. The Hollow Court is three times the size of the company on the other
 * side, and it is that way because the seam closes, not because those people
 * were worse.
 *
 * It was 0.45, which put the ratio at roughly 1.2 False to 1 True and quietly
 * made the good ending the likely one.
 */
export const MAX_COMPLETION_CHANCE = 0.25;

// ─────────────────────────────────────────────────────────────────────────
// PILLS
//
// A pill MULTIPLIES the odds; it does not add percentage points to them. That
// distinction is the whole of this section, and getting it wrong the other way
// made consumption a solution to the ladder.
//
// The measurement that settles it: the last crossing at ordinal 44 resolves at
// finalChance 0.0200. Read additively, a +0.35 pill takes that to 37% - one
// purchase handing a player the ascension the entire setting is built on being
// out of reach. Read multiplicatively it goes to 2.1%, which is what a pill
// should be. The same pill at a rung already sitting at 60% takes it to 81%:
// help where you are already likely, never a substitute for being ready.
//
// ── Three curves, and they all bend the same way ─────────────────────────
//
//   effective = 1 + (gradeFactor - 1) * bandDecay(grade, ordinal)
//                                     * toleranceDecay(priorPillsTaken)
//
// 1. GRADE sets the base factor, and it DESCENDS as the grade climbs. This is
//    the inversion, and it is deliberate: an upper-grade pill is not a bigger
//    lower-grade pill. It is rarer, dearer, harder to make, and it buys less
//    than the cheap one bought a cultivator at the bottom. Set against the
//    catalog's own values, which ascend from 75 spirit stones to 750,000:
//
//      grade     factor   at its own rung   catalogued guiding pill      value
//      mortal    1.35     +35%             Foundation-Guiding               75
//      earth     1.25     +25%             Golden Core Guiding             650
//      heaven    1.18     +18%             Nascent Soul Guiding          7,500
//      immortal  1.12     +12%             Void Refinement Guiding      60,000
//      chaos     1.08     +8%              Tribulation Guiding         750,000
//
//    THE RATIO THAT IS THE DESIGN STATEMENT: the cheapest pill in the world
//    lifts the Foundation wall by a third. The dearest lifts the last crossing
//    by a sixteenth. Four and a half times less help for ten thousand times the
//    price - so the curve bends against a cultivator from both directions at
//    once, and the higher they get the less any amount of money can do. A
//    cultivator at the bottom can meaningfully buy their way through a rung.
//    One near the top cannot buy their way through anything, however rich.
//    An upper-grade pill is worth a fortune precisely because it is the LAST
//    marginal help available, not because it is powerful.
//
// 2. BAND handles altitude. Each grade is pitched at a rung - the realm its
//    guiding pill is named for - and the effect halves every
//    PILL_BAND_HALF_LIFE_RUNGS above it. Below its rung a pill works in full:
//    taking a Foundation pill at Layer 3 is a waste of money, not a penalty.
//    A mortal pill at ordinal 44 sits 31 rungs above its band and delivers
//    +2.4%, which is the "close to noise at Tribulation Transcendence" the
//    design asks for, reached by a curve rather than by a cutoff.
//
// 3. TOLERANCE handles repetition, and it is PERMANENT. Each pill already
//    taken leaves PILL_TOLERANCE_RETENTION of the next one's effect: the
//    second is worth 60%, the fourth 22%, the sixth 8%. Permanent rather than
//    windowed because this is a game where the body is a finite resource and
//    scar tissue is forever, and because a window would only teach players to
//    wait it out. It is what makes hoarding one good pill for the one attempt
//    that matters the correct play, and "just take another" stop working.
//
// ── Where the clamps sit, which is a real decision ───────────────────────
//
// The pill multiplies the chance AFTER the ordinary floor and ceiling have been
// applied, and the result is clamped again. So a pill can never carry anyone
// past `maxChanceFor(ordinal)` - that ceiling is the design statement about how
// often a realm boundary may ever be crossed, and a purchasable exception to it
// would be the same defect in a different place. Someone already at the ceiling
// gets nothing for their pill, correctly.
//
// `MAX_COMPLETION_CHANCE` does not interact: `completionChance` takes no pill
// and never has. Whether the Lid stays open is not for sale.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The fractional lift of the strongest pill reading, as a bare fraction.
 *
 * Retained under its original name because `engine/world/origin-odds.ts` and
 * `engine/world/seeding.ts` scale a 0..1 preparation quality by it. Under the
 * multiplicative reading this is "+35%", not "+35 points" - the same number,
 * a different meaning - and {@link MAX_PILL_MULTIPLIER} is the clearer way to
 * say it. The two are tied by construction so they cannot drift.
 */
export const MAX_PILL_BONUS = 0.35;

/** The most a pill may multiply breakthrough odds by. A mortal-grade pill. */
export const MAX_PILL_MULTIPLIER = 1 + MAX_PILL_BONUS;

/**
 * Base multiplier by pill grade, DESCENDING. See the banner above for why.
 *
 * Reuses the five-grade vocabulary every other consumable catalog already
 * uses - herbs, techniques, pills - rather than inventing a second "lower /
 * middle / upper" scale beside it. Lower/middle/upper is what the top, middle
 * and bottom of this table read as.
 */
export const PILL_GRADE_FACTOR: Readonly<Record<TechniqueGrade, number>> = {
    mortal: MAX_PILL_MULTIPLIER,
    earth: 1.25,
    heaven: 1.18,
    immortal: 1.12,
    chaos: 1.08
};

/**
 * The realm each pill grade is pitched at, as a realm key.
 *
 * Read off the catalog's own guiding-pill line - Foundation-Guiding is mortal,
 * Golden Core Guiding is earth, and so on up - and resolved to an ordinal
 * through `REALM_TIERS` rather than by writing the rung numbers down, so the
 * band follows the ladder if the ladder moves. `tests/engine/cultivation/
 * pills.test.ts` asserts this still matches the catalog.
 */
export const PILL_GRADE_REALM: Readonly<Record<TechniqueGrade, RealmKey>> = {
    mortal: 'foundation_establishment',
    earth: 'core_formation',
    heaven: 'nascent_soul',
    immortal: 'void_refinement',
    chaos: 'tribulation_transcendence'
};

/** Rungs above its own band over which a pill loses half its effect. */
export const PILL_BAND_HALF_LIFE_RUNGS = 8;

/** Share of a pill's effect that survives each pill already taken. Permanent. */
export const PILL_TOLERANCE_RETENTION = 0.6;

/** First ordinal of the realm a pill of this grade is made for. */
export function pillBandOrdinal(grade: TechniqueGrade): number {
    const key = PILL_GRADE_REALM[grade];
    const tier = REALM_TIERS.find(t => t.key === key);
    // Unreachable while PILL_GRADE_REALM names real realms; a loud 0 rather
    // than a throw, because a bad edit here should fail a test, not a run.
    return tier?.ordinalStart ?? 0;
}

/**
 * How much of a pill survives being taken this far above its own band.
 *
 * 1 at or below the band. Never reaches zero: a curve rather than a cutoff, so
 * that "this pill is beneath you now" arrives as a shrinking number a player
 * can watch rather than as a rule that fires.
 */
export function pillBandDecay(grade: TechniqueGrade, realmOrdinal: number): number {
    const above = Math.max(0, realmOrdinal - pillBandOrdinal(grade));
    return Math.pow(0.5, above / PILL_BAND_HALF_LIFE_RUNGS);
}

/** How much of a pill survives the ones already eaten. Permanent, compounding. */
export function pillToleranceDecay(priorPillsTaken: number): number {
    const taken = Number.isFinite(priorPillsTaken) ? Math.max(0, Math.floor(priorPillsTaken)) : 0;
    return Math.pow(PILL_TOLERANCE_RETENTION, taken);
}

/**
 * The multiplier a pill actually applies, after grade, altitude and tolerance.
 *
 * Never below 1: a pill is never a penalty. Never above
 * {@link MAX_PILL_MULTIPLIER}.
 */
export function pillMultiplier(pill: ConsumedPill, realmOrdinal: number): number {
    // A graded pill takes the real curve. One without a grade is a legacy or
    // synthetic caller - `origin-odds.ts` and `seeding.ts` both build a pill
    // out of a 0..1 preparation quality - and keeps the plain reading, where a
    // higher potency means more help and nothing decays. Passing a grade is
    // strictly better and should be done wherever a catalog row is in hand.
    const base = pill.grade
        ? PILL_GRADE_FACTOR[pill.grade]
        : 1 + Math.max(0, Math.min(MAX_PILL_BONUS, pill.potency ?? 0));

    const decay = pill.grade
        ? pillBandDecay(pill.grade, realmOrdinal) * pillToleranceDecay(pill.priorPillsTaken ?? 0)
        : pillToleranceDecay(pill.priorPillsTaken ?? 0);

    const effective = 1 + (base - 1) * decay;
    return Math.max(1, Math.min(MAX_PILL_MULTIPLIER, effective));
}

// ─────────────────────────────────────────────────────────────────────────
// THE CLOCK
//
// Most bad attempts in this world are not made by fools. They are made by
// people who have run out of road: the rung grants a span, the span is most of
// the way gone, and there will not be a second chance to gather this much qi
// again. So they strike at odds they can read perfectly well, because the
// alternative is to sit down and wait to die at the rung they are on.
//
// The engine has to price that, because a cultivator who forces a crossing on a
// body with a decade left in it is not attempting the same thing as one who has
// nine tenths of their span in hand. Nothing here decides WHETHER to strike -
// that is the player's, and for NPCs the caller's, and `assessLastCrossing`
// below is what they consult. This only makes the late attempt worse, which is
// the fact that makes the decision a real one.
// ─────────────────────────────────────────────────────────────────────────

/** Share of the rung's granted span that may be spent before the clock bites. */
export const LIFESPAN_PRESSURE_ONSET = 0.5;
/** Worst the clock can be worth, at the very end of a span. */
export const MAX_LIFESPAN_PRESSURE = -0.2;

/**
 * Failure severity tables. Each column is a cumulative threshold against one
 * [0,1) sample, checked in order: stable, injured, deviation, death.
 *
 * Sub-rank failure is mostly a wasted stretch of time. Boundary failure is a
 * 15% chance of dying on the spot and a 63% chance of taking a wound you will
 * still be carrying a decade later. This table is where "boundaries are the
 * bottlenecks that kill cultivators" is actually implemented.
 *
 * The boundary column carried a 10% death share until it was measured against
 * whole lives rather than single rolls. A cultivator who fails a boundary does
 * not stop; they heal, re-gather and strike again, so what matters is not the
 * chance of dying on one roll but the chance of dying before the wall opens,
 * and at 10% against the ceiling above that came to almost nobody.
 *
 * The last crossing has its own column and it is the worst in the game. There is
 * no walking away from a tribulation you summoned and could not hold: nearly
 * half of the cultivators who lose their grip on it are killed by what they
 * called down, and the ones who are not have nothing left to try again with.
 */
export const FAILURE_TABLE = {
    subRank: { stable: 0.55, injured: 0.9, deviation: 0.99 },
    boundary: { stable: 0.22, injured: 0.6, deviation: 0.85 },
    lastCrossing: { stable: 0.05, injured: 0.3, deviation: 0.55 }
} as const;

/**
 * The DEEPEST a failure of each severity costs, as a fraction of the rung's
 * requirement. The top of the range; `failureProgressLoss` decides where in it
 * a given failure actually lands.
 */
export const FAILURE_PROGRESS_LOSS: Record<BreakthroughFailure, number> = {
    failure_stable: 0.25,
    failure_injured: 0.5,
    failure_deviation: 0.75,
    death: 1
};

// ─────────────────────────────────────────────────────────────────────────
// EVERY REALM IS A BUCKET
//
// The model the whole ladder is tuned to, in the designer's words:
//
//     "think of it as a bucket with an input and an output. the bucket always
//      has some volume to it but its shifting."
//
// and the scope, in theirs as well: "each cultivation stage". Nine buckets, one
// per realm, and they are CHAINED - the outflow of one is the inflow of the
// next, minus whatever dies or settles on the way. No band can be tuned in
// isolation: widening Core Formation's outflow fills Nascent Soul, and choking
// Foundation Establishment starves everything above it.
//
// What that rules out in both directions:
//
//   VOLUME FALLING            outflow exceeds inflow. The original defect - the
//                             world produced nobody above Void Refinement and
//                             every person there was a seeded survivor.
//   VOLUME STEADY, INFLOW
//   THE SIZE OF THE VOLUME    the whole contents turn over inside the window.
//                             The correction after the first fix went too far:
//                             "arrivals should be HARD", "cultivation should
//                             not be easy", "90-95% is too much".
//   VOLUME CLIMBING FOREVER   outflow too slow. Nothing has shown this yet.
//   VOLUME HEALTHY, NO INFLOW living on inheritance. Where the apex started.
//
// The target is a SLOW inflow and a SLOW outflow holding a steady volume, so
// the band always contains a mix of long residents and recent arrivals. The
// arrivals share is a diagnostic that falls out of the three numbers; it is
// not a target and no constant here should be set from it.
//
// TWO OUTFLOWS THAT ARE NOT OUTFLOWS. Settling and a structural break both stop
// somebody climbing without removing them from the world, so they pad a band's
// volume while contributing nothing upward. A bucket can therefore read healthy
// and be feeding nothing, which means the outflow that FEEDS THE NEXT BUCKET
// has to be measured separately from the outflow that merely ends.
//
// `scripts/probe-the-bucket-at-each-realm.ts` is the instrument. It reports
// volume, inflow, upward outflow, ending outflow, how long somebody stays and -
// the number that says whether a realm's span is buying them anything - what
// fraction of that span the stay is.
//
// ─────────────────────────────────────────────────────────────────────────
// THE SHAPE OF THE LOSS, WHICH IS THE PYRAMID'S STRONGEST LEVER
//
// READ THIS BEFORE CHANGING FAILURE_LOSS_SHAPE. It is not a flavour constant.
// It silently decides how many cultivators the world ever produces, and it was
// arrived at by measurement rather than chosen.
//
// ── What the lever is ────────────────────────────────────────────────────
//
// A failed crossing costs a RANGE, not a figure. The severity above sets the
// deep end of that range; `SHALLOWEST_LOSS` sets the shallow end; and what
// decides where inside it a particular failure lands is HOW FAR SHORT THE
// ATTEMPT FELL. A near miss disperses a little; a rout disperses most of it.
// That reads off the roll already made, so this adds no draw to the stream and
// no caller's stream ordering moves.
//
// The lever is not the endpoints. It is how probability is spread across them:
//
//     loss = deepEnd * (SHALLOWEST_LOSS + (1 - SHALLOWEST_LOSS) * shortfall^k)
//
// with `k` = FAILURE_LOSS_SHAPE. `shortfall` is uniform on [0,1) - it is the
// primary roll rescaled past the odds - so `k` is exactly the shape of the
// distribution over the range:
//
//     k > 1   mass toward the SHALLOW end. Most failures cost little, careers
//             survive several of them, and the pyramid widens at every rung.
//     k = 1   flat. Every depth in the range equally likely.
//     k < 1   mass toward the DEEP end. A failure is usually most of a career's
//             accumulation and the pyramid narrows hard.
//
// ── What it was tuned against, and the numbers ───────────────────────────
//
// The standing distribution of the living world, not a per-attempt feel.
// Measured with `scripts/probe-does-the-world-produce-its-apex.ts` and the
// unaided sweep in `ladder-odds.ts`, and the two shapes below bracket it.
//
// Three shapes, 3,000 lives per band on each of three seeds, unaided climb, and
// the two rejected ones bracket the one that is here. Ranges are across seeds.
//
//   shape                 band     Found     Core    Nascent  Deity      Void
//   ------------------------------------------------------------------------
//   k = 1.8, THIS ONE     dense   46-48%   19-20%   7.7-8.0%  2.5-3.0%  0.5-0.8%
//                         normal  16-17%   3.8-4.6% 0.9-1.3%  0.3-0.4%  0.0-0.1%
//   flat at the deep end  dense   44-46%   18.0%    7.3%      2.4-2.8%  0.5-0.8%
//   (what this had        normal  14.4%    3.7%     0.9%      0.27%     0.0-0.1%
//    before, i.e. k -> 0)
//   the whole requirement dense   38-39%   14.3%    5.7%      1.8-2.3%  0.5-0.6%
//   at every severity     normal  10.5%    2.7%     0.6%      0.18%     -
//
// AND ABOVE DEITY TRANSFORMATION ALL THREE ARE THE SAME. Body Integration sits
// at 0.17-0.27%, Grand Ascension at 0.03-0.07% and Tribulation Transcendence at
// 0-0.03% under every one of them, and the origin sweep's share reaching
// ordinal 41 moved from 0.475% to 0.431% across 120,000 and 200,000 lives,
// which is inside the noise on a tail that thin.
//
// That is the finding that decided which end of the ladder this lever controls.
// At a high rung the limit is the settling allowance's total SPAN rather than
// how many attempts fit inside it, so a harsher failure cannot make the apex
// rarer - it only thins Foundation Establishment. The third shape is what a
// plain reading of "you lose the qi" implies and it costs the bottom of the
// ladder a quarter of its throughput to buy nothing at the top.
//
// Which is why the shape leans shallow. The pyramid needs its lower-middle
// bands populated, the apex is kept rare by the book and the clock rather than
// by the cost of failing, and a lever that only punishes beginners is not the
// lever anybody wanted.
//
// ── If you move it ───────────────────────────────────────────────────────
//
// Raising `k` widens Foundation Establishment and Core Formation and does very
// little above Deity Transformation. Lowering it empties the middle of the
// ladder first and the top last. Re-run both probes and put the new table here;
// a figure without its measurement does not survive the next content pass.
//
// AND IT IS AN INFLOW LEVER, WHICH IS HALF OF A BUCKET. If a band's volume is
// wrong, ask which side is wrong before reaching for this. Measured over forty
// centuries, the answer at the top was the OUTFLOW every time: residence as a
// share of the realm's own span ran 100% at Qi Condensation and fell to 10% by
// Void Refinement, where 77% of departures were violent against 10% of age. No
// value of `k` fixes that, because it is not about how many people arrive.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The shallow end of the range, as a fraction of the severity's deep end.
 *
 * Never zero. A failure that cost nothing at all would make striking at a wall
 * free, and the whole reason a cultivator waits and prepares is that it is not.
 */
export const SHALLOWEST_LOSS = 0.4;

/**
 * How probability is spread across the loss range. See the banner above.
 *
 * 1.8 leans clearly shallow: the median failure costs about 57% of its
 * severity's deep end rather than 100%, so a stable boundary failure disperses
 * roughly 14% of the requirement instead of 25% and a cultivator gets about
 * half again as many attempts inside the same settling clock.
 */
export const FAILURE_LOSS_SHAPE = 1.8;

/**
 * How much preparation moves the mass toward the shallow end.
 *
 * "More prepared, less loss." Preparation already buys the ODDS; this is its
 * second payoff, and it is the one that matters to somebody who has already
 * failed once - what they brought to the wall decides how much of the last
 * eighty years it took with it.
 *
 * Additive on the exponent rather than multiplicative on the result, so a fully
 * prepared cultivator faces a different SHAPE rather than a discount on a rolled
 * number. That is the same thing preparation does everywhere else in this file.
 *
 * INTEGRATION POINT. Anything that counts as having prepared for a crossing
 * feeds `BreakthroughContext.preparation` and nothing else - a pill, a chosen
 * site, an unhurried foundation, and whoever is standing guard over the
 * attempt. There must not be a second preparation term beside this one.
 */
export const PREPARED_LOSS_SHAPE_BONUS = 1.4;

/**
 * Where in the range this particular failure landed.
 *
 * `roll` is the primary breakthrough roll and `finalChance` the odds it was
 * measured against, so `shortfall` is how far past the line it fell, rescaled
 * to [0,1). Reading the roll rather than drawing again is deliberate: it costs
 * no sample, it keeps every caller's stream ordering exactly where it was, and
 * it means the same attempt always costs the same amount.
 */
export function failureProgressLoss(
    outcome: BreakthroughFailure,
    roll: number,
    finalChance: number,
    preparation = 0
): number {
    const deepEnd = FAILURE_PROGRESS_LOSS[outcome];
    const room = Math.max(1e-9, 1 - finalChance);
    const shortfall = Math.min(1, Math.max(0, (roll - finalChance) / room));
    const shape = FAILURE_LOSS_SHAPE
        + PREPARED_LOSS_SHAPE_BONUS * Math.min(1, Math.max(0, preparation));
    return deepEnd * (SHALLOWEST_LOSS + (1 - SHALLOWEST_LOSS) * Math.pow(shortfall, shape));
}

/**
 * A failed last crossing costs the whole accumulation, whatever the severity.
 *
 * The qi was not dispersed, it was SPENT - thrown at the Lid and kept. A
 * cultivator who survives a failed crossing is standing on Tribulation
 * Transcendence Perfection with nothing in them, needing the full price again
 * to try a second time, and the settling clock at that rung does not grant two
 * of those. This is what makes the crossing a single shot in practice without
 * a special-case rule saying so, and it is why so many of the people the world
 * calls "the ones who refused to step through" are in fact the ones who tried
 * once and cannot afford to again.
 */
export const LAST_CROSSING_PROGRESS_LOSS = 1;

/**
 * Heavenly tribulation: strikes escalate as the cultivator climbs the final
 * realm, indexed by the DESTINATION ordinal rather than the origin.
 *
 * The 40 -> 41 crossing INTO Tribulation Transcendence is the lightest
 * tribulation at 3 strikes, then 4, 5 and 6 for the steps above it. Indexing
 * on the destination is what puts the lightest tribulation on the boundary
 * crossing, where it belongs: the Lid is deciding for the first time whether
 * this cultivator is worth the qi it will cost to seal behind them, and it has
 * not yet made up its mind.
 *
 * That crossing is consequently the single worst moment in a run - it is a
 * realm boundary (0.45x base odds and the brutal boundary failure table), a
 * heavenly tribulation, AND a toll, all at once.
 */
export const TRIBULATION_BASE_STRIKES = 3;
/** Failed strikes that kill outright. Two you can walk away from. */
export const TRIBULATION_LETHAL_STRIKES = 3;
/** Base per-strike survival before fortune, ambient and injuries. */
export const TRIBULATION_BASE_SURVIVAL = 0.6;
export const MIN_TRIBULATION_SURVIVAL = 0.15;
export const MAX_TRIBULATION_SURVIVAL = 0.95;

// ─────────────────────────────────────────────────────────────────────────
// CONTEXT AND ELIGIBILITY
// ─────────────────────────────────────────────────────────────────────────

export interface ConsumedPill {
    name: string;
    /**
     * The pill's grade, from the catalog row. THE input that matters: it sets
     * the base multiplier and the realm band the pill is made for. Supply it
     * wherever a catalog row is in hand.
     */
    grade?: TechniqueGrade;
    /**
     * Legacy strength, as a FRACTIONAL lift rather than percentage points:
     * 0.35 means x1.35, not +35 points. Read only when no `grade` is given -
     * `engine/world/origin-odds.ts` and `engine/world/seeding.ts` synthesise a
     * pill from a 0..1 preparation quality and have no catalog row to grade.
     * Clamped to MAX_PILL_BONUS.
     */
    potency?: number;
    /**
     * How many breakthrough pills this cultivator has ALREADY taken in their
     * life. Drives permanent tolerance - see the PILLS banner. Omitted reads as
     * zero, which is the no-tolerance behaviour; a caller that persists a count
     * gets the real curve.
     */
    priorPillsTaken?: number;
}

export interface BreakthroughContext {
    /** Stream for this attempt. Caller derives it, e.g. forStream(seed, 'breakthrough', turn). */
    rng: CultivationRNG;
    /**
     * Whether the primary roll is decided rather than sampled.
     *
     * ADMIN's forced verb, and NOTHING ELSE, sets this - see
     * `server/consolidated/forcing-an-attempt-to-land.ts` for the law. It is an
     * explicit input rather than an ambient one on purpose: this module is a
     * pure resolver, and a hidden reading would make its answer depend on
     * something its seed does not carry.
     *
     * It decides ONE question, the one the engine was already going to ask -
     * did the barrier give - and it decides nothing else. Eligibility is a
     * GATE and is checked above, unchanged: somebody with an empty accumulator
     * still cannot attempt a crossing, and `set_realm` is the honest way to
     * stand at a rung. Everything a success costs is still charged, because
     * the success is resolved by the same code that resolves an earned one:
     * the accumulator is spent, the Price of Advancement is taken, the
     * tribulation is met, the foundation is sampled.
     *
     * The roll is still DRAWN below and then overridden, so the stream is left
     * in the same place either way.
     */
    theAttemptLands?: boolean;
    ambient: AmbientQi;
    /** Turn number, stamped onto any injuries sustained. */
    turn: number;
    /** Pill consumed immediately before the attempt, if any. */
    pill?: ConsumedPill | null;
    /**
     * Ranks already gained this turn. Guards MAX_RANKS_PER_TURN: a cultivator
     * who has banked enough progress for three ranks still climbs them one turn
     * at a time. Bottlenecks are supposed to be lived through.
     */
    ranksGainedThisTurn?: number;
    /**
     * Conditions for the price of advancement, charged on a SUCCESSFUL realm-boundary
     * crossing. Omitting this does not skip the toll - the crossing does not wait
     * for a caller to be ready - it charges with no candidates, which surfaces
     * as `nothing_left` in the result. A caller that owns bonds, memories and
     * techniques must supply them here.
     */
    toll?: TollConditions;
    /**
     * Conditions for the foundation laid by a successful 12 -> 13 crossing.
     * Ignored at every other ordinal. Omitting it means an unprepared crossing,
     * which is a real answer rather than a neutral one.
     */
    foundation?: Omit<FoundationConditions, 'ambient'>;
    /**
     * What is being practised, which decides WHICH insights bear on this
     * attempt. Omitted means the cultivator's own root elements and the
     * universal domains only.
     */
    relevance?: Partial<RelevanceContext>;
    /**
     * How well the manual this cultivator climbed the realm on was written.
     *
     * PREPARATION, NEVER INSTRUCTION. The crossing is not in the book and no
     * book can put it there - `triggersHeavenlyTribulation` takes an ordinal
     * and nothing else, so two cultivators at the same boundary meet the same
     * thing whatever they practise. What a better manual contributes is the
     * foundation it spent the whole realm building, arriving here with them.
     *
     * Priced against what the reader could take out of it, so a canon far over
     * somebody's head arrives having built almost nothing. See
     * `manual-quality.ts`; omitted contributes no line at all.
     */
    manualQuality?: ManualQuality | null;
    /**
     * How much was done before the attempt, 0..1. THE ONE PREPARATION TERM.
     *
     * Preparation already buys the odds through the ordinary modifiers - a
     * pill, a settled foundation, a manual that built the realm properly. This
     * is the same fact expressed once, as a number, for the thing the modifiers
     * cannot express: how much a FAILURE costs. See `PREPARED_LOSS_SHAPE_BONUS`.
     *
     * Anything that counts as having prepared feeds this and nothing else - a
     * chosen site, an unhurried approach, and whoever is standing guard over
     * the crossing. There must not be a second preparation term beside it.
     *
     * Omitted is not zero: `preparationOf` reads what the context already
     * carries, so a caller that supplies a pill and a foundation is credited
     * for them without having to say so twice. Supply it to override.
     */
    preparation?: number;
    /**
     * How much of a watch is standing over this crossing, 0..1.
     *
     * THE PROTECTOR LAYER'S INTEGRATION POINT, and the reason it is a separate
     * field rather than folded into `preparation` by the caller: a caller with
     * a watch should not have to recompute the pill, the site and the
     * foundation in order to say so. `standing-guard-over-somebody-elses-crossing.ts`
     * owns what a watch is worth to the ODDS and this is the same fact reaching
     * the other half - what a failure costs - so
     * `protectionBonus(watch, ordinal) / MAX_PROTECTION_BONUS` is the value to
     * pass. There is no second protection term in this file and there must not
     * be one.
     */
    protection?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// THE ROADS BESIDES YOUR OWN
//
// The structural gate: past Qi Condensation, a realm boundary asks for
// comprehension that a cultivator's own body cannot supply, and refuses the
// attempt when it is not there.
//
// ── Why this exists ──────────────────────────────────────────────────────
//
// Measured over 400 hand-played lives: 94% of deaths land on a boundary rung,
// in a clean survivorship curve - 137 at ordinal 12, 123 at 16, 52 at 20, 31 at
// 24, 13 at 28, 6 at 32, 8 at 36 - and a sect elder dies at the same rungs at
// the same rates as a rogue. The ladder was hard and it was not STRUCTURAL:
// nothing on it ever asked a cultivator for anything they could only get from
// somebody else, so joining a sect meant nothing and sitting in a cave forever
// was a complete strategy that merely had bad odds.
//
// Comprehension was the obvious lever and it was only ever a bonus - insight
// entered as an additive modifier and no rung anywhere could be refused for
// want of it.
//
// ── Why counting NON-ELEMENT domains is the right measure ────────────────
//
// Not a new system. `discoverableInsights` already decides what is in reach,
// and it is already access-shaped: the `own_root` source - the one access
// everybody is born with - grants comprehension in the `element` domain and in
// no other. Every one of the other eight domains requires a manual that can be
// read, a teacher willing to teach, an artifact, an inheritance, the inside of
// a Dao house, a place with something in it, or having survived something.
//
// So "how many domains do you hold outside `element`" is exactly "how far have
// you got out of your own body", read off data that already exists, with no
// new field, no migration and no branch on who anybody is. A cave in a starting
// area yields the root's elements and stops. A muddled five-element root - the
// worst draw in the game - reaches five `element` insights and still counts
// zero, which is the hole a naive breadth requirement would have left open.
//
// ── ACCESS, NOT EFFORT ───────────────────────────────────────────────────
//
// This is the constraint that shapes everything above, and it must not be
// eroded later: the requirement names WHAT MUST BE IN REACH, never what must be
// done. There is no minimum number of years, no deed, no quest, no suffering
// requirement. A cultivator sealed in a sect's library with the right manuals
// is sitting just as still as one in a cave and should reach the top, because
// the library has things in it and the cave does not. Being handed an
// inheritance counts. Being taught counts. Reading counts. Theft counts.
//
// The interesting question therefore stops being "have you put in the time" and
// becomes "how did you get in the room" - and rank, patronage, inheritance,
// birth and burglary all become real strategies, all of them already modelled.
//
// ── The curve, and where it bites ────────────────────────────────────────
//
// One road per realm already climbed, capped at the eight that exist:
//
//   12 -> 13  Foundation Establishment   1 road   the transition
//   16 -> 17  Core Formation             2
//   20 -> 21  Nascent Soul               3
//   24 -> 25  Deity Transformation       4
//   28 -> 29  Void Refinement            5
//   32 -> 33  Body Integration           6
//   36 -> 37  Grand Ascension            7
//   40 -> 41  Tribulation Transcendence  8   every road there is
//   44        the last crossing          8
//
// The transition sits at 12 -> 13 deliberately, and it is the same rung the
// mortal-grade pill band is pitched at, so that the moment a cultivator needs
// help they cannot make alone is ONE moment rather than two. It is where the
// setting already says almost nobody gets past, and it is early enough that a
// player who has been soloing still has most of a fifty-year settling clock in
// which to go and join something.
//
// Within-realm rungs are NOT gated. The soloable feel between walls is
// preserved; it is the walls that ask.
//
// A refusal here is not a death. It is a redirect, and it should read like the
// progress gate reads - the measurement first, and no encouragement attached.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The rung a cultivator stands on for the first crossing the dao gate asks of.
 *
 * Twenty, and it is Core Formation Perfection rather than Nascent Soul Early
 * because a requirement is charged where the attempt is MADE. "Turned on at
 * Nascent Soul" is a statement about which crossing pays it - the one INTO
 * Nascent Soul - and the person paying is standing at 20 when they do.
 *
 * Documentation rather than a switch. `daoRequirementCurve` derives the same
 * boundary from the realm index and does not read this, so the two cannot
 * disagree; a test asserts they agree at every ordinal. The switch is
 * `DAO_GATE_ENFORCED` below.
 */
export const DAO_GATE_FROM_ORDINAL = 20;

/**
 * WHETHER THE CURVE IS CHARGED. Now TRUE, and what it was waiting for exists.
 *
 * ── Why it was held off, measured twice, independently ───────────────────
 *
 * `canAttemptBreakthrough` reads `roadsWalked(cultivator.insights)`. A played
 * cultivator has an insight list and `src/web/game.ts` populates the discovery
 * context that fills it, so the gate always bound a player correctly. AN NPC
 * RECORD HAS NO INSIGHT LIST AT ALL. The world ran ruins, phenomena, teachers
 * and near-deaths and wrote none of them down, because there was nowhere on an
 * NPC to write one and nothing in any catalog that granted one.
 *
 * So the gate bound the player and not the world - the same one-sided
 * enforcement, in the other direction, that the wound layer had. Measured:
 * 0 of 1,511 living NPCs held a single road besides their own, 100 of 100 NPCs
 * standing at a gated wall were refused, and at 1,500 years:
 *
 *     band            people   mean roads   needed   would pass
 *     Core 17-20          28      1.18          1      28 / 28
 *     Nascent 21-24       20      1.30          2       5 / 20
 *     Deity 25-28          7      1.86          3       0 / 7
 *     Void 29-32           2      2.50          4       0 / 2
 *     Body 33-36           3      2.00          5       0 / 3
 *     Grand 37-40          1      3.00          6       0 / 1
 *
 * Nothing crossed ordinal 28 again. Not thinned - stopped.
 *
 * ── What was built, and the same table afterwards ────────────────────────
 *
 * The supply, in `engine/world/how-a-cultivator-comes-by-a-road.ts`, in four
 * channels that all cost something:
 *
 *   PRACTICE   `roadsWalkedBy` - the domains of the arts in somebody's hands.
 *              This half already existed and cannot reach past three roads;
 *              `alchemy` is taught by no technique in the catalog at all.
 *   GROUND     Twenty named places in `data/cultivation/places-that-teach-a-dao.ts`.
 *              Nine are HELD by a house and let its own people in by STANDING,
 *              which is what membership is finally worth. Seven stand OPEN in
 *              a province, so a road is partly a hand dealt at birth.
 *   RUINS      Four are BURIED and teach nobody until somebody digs them out,
 *              on the world's clock rather than on anybody's merit.
 *   MATERIALS  Single-use objects, spent once on one person and then gone, with
 *              the spent row left in the world carrying who used it.
 *
 * Re-measured with all four live - `scripts/probe-can-the-world-feed-the-dao-gate.ts`,
 * four seeds at 800 years, 2,037 living:
 *
 *     band            people   mean roads   needed   would pass   arrivals
 *     Core 17-20          87      1.71          1     87 / 87       100%
 *     Nascent 21-24       66      2.67          2     47 / 66       100%
 *     Deity 25-28         36      3.36          3     22 / 36        81%
 *     Void 29-32          26      4.12          4     15 / 26        46%
 *     Body 33-36          21      3.81          5      9 / 21         0%
 *     Grand 37-40          5      4.20          5      2 / 5          0%
 *     Trib 41-44           6      4.17          5      2 / 6          0%
 *
 * A survivor at every rung, and roughly half of each high band refused - which
 * is a gate rather than a wall, and is what the switch was held back for.
 *
 * ── The control that matters more than the table ─────────────────────────
 *
 * THE SAME PROBE WITH THE GATE OFF, three seeds at 800 years, produces bands of
 * 62 / 43 / 21 / 20 / 20 / 2 / 5 against 58 / 44 / 18 / 18 / 20 / 3 / 5 with it
 * on. The distributions are the same to inside the noise, INCLUDING at the top,
 * and the arrival shares move by single points. So the gate is not what limits
 * the apex in this world and never was; the settling clock, the manual ceiling
 * and the span are. Anybody re-tuning this constant on the strength of a thin
 * upper band is about to chase the wrong cause, and should run the gate-off arm
 * first - it takes one edit and one command, and it is the only way to tell a
 * gate that bites from a world that was already shaped that way.
 */
export const DAO_GATE_ENFORCED = true;

/** The one domain a cultivator's own root can supply unaided. */
const SELF_TAUGHT_DOMAIN: InsightDomain = 'element';

/** Every domain that requires access to something outside the cultivator. */
export const ROADS_BESIDES_YOUR_OWN: readonly InsightDomain[] = InsightDomainSchema.options
    .filter(domain => domain !== SELF_TAUGHT_DOMAIN);

/**
 * Distinct comprehension domains this cultivator holds beyond their own root.
 *
 * The measure the boundary gate reads. Degree is deliberately not consulted:
 * this asks how many roads have been stepped onto, not how far along any of
 * them the cultivator has got. Depth is what the odds already price.
 */
export function roadsWalked(insights: readonly Insight[] | undefined): number {
    const domains = new Set<InsightDomain>();
    for (const insight of insights ?? []) {
        if (insight.domain !== SELF_TAUGHT_DOMAIN) domains.add(insight.domain);
    }
    return domains.size;
}

/**
 * What the gate ACTUALLY asks, for anybody: comprehension that happened, plus
 * whatever access and years between them have paid for.
 *
 * ── THE ASYMMETRY THIS REPLACES ──────────────────────────────────────────
 *
 * `roadsWalked` above counts a finished list, and until this function existed
 * the two sides of the wall filled that list by rules that had nothing in
 * common. A player's list held only insights formed by surviving something -
 * measured at between 0.6% and 3.4% a year, so one road per 35 years at the
 * absolute best and none at all in every completed playtest run. An NPC's list
 * was SYNTHESISED at the moment of asking: one road per art held, dated to the
 * day they were born, plus one for every dao ground they could get at and every
 * material ever spent on them, none of it charged for. Standing in Nascent Soul
 * at 800 years an NPC held 2.09 roads and a player held none.
 *
 * There is now one rule and it is in
 * `what-a-road-in-reach-costs-to-walk.ts`: access puts a road in reach, years
 * of practice are what walk it, and an insight that actually happened counts
 * free because the event was the price. Both sides hand this the same two
 * fields. Neither has a path of its own any more.
 *
 * The caller supplies `roadsWithinReach` from wherever their world lives - a
 * SQLite row for a player, `WorldState` for everybody else. Omitting it is
 * legitimate and means "nothing is in reach", which is the right answer for an
 * odds harness and for a subject built without a world to look at.
 */
export function roadsWalkedIncludingExposure(
    bearer: RoadBearer,
    bornOnDay = 0
): number {
    return roadsWalked(roadsWalkedBy(bearer, bornOnDay));
}

/**
 * Roads besides their own that a cultivator must hold to attempt this rung.
 *
 * ── WHERE IT STARTS ──────────────────────────────────────────────────────
 *
 * At the NASCENT SOUL CROSSING, and nowhere below it. Qi Condensation,
 * Foundation Establishment and Core Formation ask nothing of understanding at
 * all - a cultivator can climb three whole realms on a root, a book and time,
 * which is what keeps the bottom of the ladder soloable and what makes the
 * first three realms the ones a nobody can actually walk.
 *
 * You cannot form a nascent soul without a dao. That is the design sentence
 * and it is why the curve begins at exactly one: not a set of roads, ONE road
 * besides your own, held by somebody who has been up three realms.
 *
 * ── AND IT RISES ─────────────────────────────────────────────────────────
 *
 * One more road per realm above that, so the ask is a function of height and
 * never a single bar that everything above inherits:
 *
 *     into Nascent Soul               1
 *     into Deity Transformation       2
 *     into Void Refinement            3
 *     into Body Integration           4
 *     into Grand Ascension            5
 *     into Tribulation Transcendence  5
 *     the last crossing               5
 *
 * ── AND IT STOPS AT FIVE, WHICH IS A MEASUREMENT ─────────────────────────
 *
 * `MOST_ROADS_THE_WORLD_SUPPLIES` is the cap, and it was 8 - the whole set
 * besides your own - which read as a reasonable bound and was in fact a closed
 * door. With the supply in `how-a-cultivator-comes-by-a-road.ts` live, three
 * seeds at 1,500 years, share of each standing band holding at least k roads:
 *
 *     band              >=3     >=4     >=5     >=6     >=7
 *     Deity 25-28      69.2%   53.8%   46.2%   11.5%    0.0%
 *     Void 29-32      100.0%   75.0%   62.5%   12.5%    0.0%
 *     Body 33-36       92.9%   64.3%   50.0%   21.4%    0.0%
 *     Grand 37-40     100.0%   60.0%   60.0%   40.0%    0.0%
 *     Trib 41-44      100.0%  100.0%   20.0%   20.0%    0.0%
 *
 * NOBODY IN THE WORLD HOLDS SEVEN, IN ANY BAND, ON ANY SEED. Six is held by
 * between an eighth and two fifths of the people who get that high, and five
 * by about half. A requirement of 7 at the last crossing is therefore not a
 * hard gate - it is a rung nobody may ever attempt again, which is the exact
 * failure the whole switch was held back for, relocated to the top of the
 * ladder where it would have been much harder to notice.
 *
 * Five is where about half of a high band stands, so the wall refuses about
 * half of them and the other half may strike. That is a gate. It is also the
 * number that has to move if the supply ever widens: the cap is a claim about
 * WHAT THE WORLD CAN FEED, not about what the ladder deserves to ask, and
 * re-running `scripts/probe-can-the-world-feed-the-dao-gate.ts` is what settles
 * it. Raise the supply first and this second, in that order and never the
 * other way round.
 *
 * The rising part is unchanged and is the design claim: each realm asks more
 * understanding than the last, for five realms, which is every realm anybody
 * in the measured world actually climbs through.
 *
 * The shape is derived from the realm index rather than tabulated, so it
 * follows the ladder if a realm is ever inserted or removed.
 */
export function daoRequirementCurve(ordinal: number): number {
    if (!isRealmBoundary(ordinal) && !isLastCrossing(ordinal)) return 0;
    const realmIndex = REALM_TIERS.indexOf(realmForOrdinal(ordinal));
    if (realmIndex < 0) return 0;
    // Nothing is asked below the Nascent Soul crossing, and the subtraction is
    // what makes that true by construction rather than by a second guard: the
    // realm you stand in to attempt Nascent Soul is Core Formation, so its
    // index is the zero point and every realm below it comes out negative.
    const steps = realmIndex - CORE_FORMATION_REALM_INDEX;
    if (steps < 0) return 0;
    return Math.min(MOST_ROADS_THE_WORLD_SUPPLIES, steps + 1);
}

/**
 * The most roads the curve may ever ask for. See the table above.
 *
 * Deliberately smaller than `ROADS_BESIDES_YOUR_OWN.length`: the number of
 * domains that EXIST is a fact about the schema, and the number the world can
 * actually put into one cultivator's reach is a fact about sects, provinces,
 * ruins and single-use objects. Only the second one may bound a requirement,
 * and reading the first as though it were the second is what made the top of
 * this curve unpayable.
 */
export const MOST_ROADS_THE_WORLD_SUPPLIES = 5;

/** The realm a cultivator stands in to attempt Nascent Soul. The curve's zero. */
const CORE_FORMATION_REALM_INDEX = REALM_TIERS.findIndex(t => t.key === 'core_formation');

/**
 * What this rung ACTUALLY asks for right now - the curve, behind the switch.
 *
 * Zero everywhere while `DAO_GATE_ENFORCED` is false. Read
 * `daoRequirementCurve` for what the design says, and that constant for what
 * has to exist before the two become the same function.
 */
export function daoRequirementFor(ordinal: number): number {
    if (!DAO_GATE_ENFORCED) return 0;
    return daoRequirementCurve(ordinal);
}

export interface EligibilityCheck {
    eligible: boolean;
    /** Machine-readable reason when ineligible; null when eligible. */
    reason: string | null;
    /** Roads besides their own this rung asks for. Zero off a boundary. */
    daoRequired: number;
    /** Distinct non-element comprehension domains actually held. */
    daoHeld: number;
    /**
     * Null above the Lid, where the requirement is not denominated in this
     * currency and no amount of it would do. Reported rather than flattened to
     * zero so a caller cannot render "0 required" beside a refusal.
     */
    progressRequired: number | null;
    /** Accumulated PLUS what understanding stands in for. What is compared. */
    progressAvailable: number;
    /** Qi-units actually gathered. */
    progressAccumulated: number;
    /** Qi-units understanding stood in for. The gap between the two above. */
    progressSubstituted: number;
}

/**
 * Whether an attempt is legal at all. Callers - especially the time-skip -
 * should consult this instead of catching the throw from `attemptBreakthrough`.
 */
export function canAttemptBreakthrough(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'cultivationProgress' | 'alive'> &
        Partial<Pick<
            Cultivator,
            'immortalStatus' | 'spiritRoot' | 'insights' | 'injuries' | 'age' | 'knownTechniques'
        >> & {
            /**
             * Roads access has put in reach and that years have not yet paid
             * for. THE FIELD THAT MAKES THE GATE ONE RULE - see
             * `roadsWalkedIncludingExposure`. Supplied by whichever adapter
             * can see this person's world; absent means nothing is in reach,
             * which is the honest answer for an odds harness.
             */
            roadsWithinReach?: readonly RoadWithinReach[];
        },
    ctx: Pick<BreakthroughContext, 'ranksGainedThisTurn' | 'relevance'> = {}
): EligibilityCheck {
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);
    // ONE RULE, BOTH SIDES, and it is computed once and then read three times
    // below. Not `cultivator.insights`: that is only comprehension that has
    // already HAPPENED, which a player could reach at between 0.6% and 3.4% a
    // year and which the world layer got round by synthesising an insight per
    // art held, at birth, free. See `roadsWalkedIncludingExposure`.
    const comprehension = roadsWalkedBy(cultivator);
    // Understanding stands in for accumulation at a bottleneck. A caller that
    // has no root to hand (an NPC stub) simply gets no substitution rather
    // than an error - the effect is opt-in by having the data, never assumed.
    const substitution =
        cultivator.spiritRoot === undefined
            ? { substituted: 0 }
            : bottleneckSubstitution(
                  { ...cultivator, insights: comprehension } as
                      Parameters<typeof bottleneckSubstitution>[0],
                  ctx.relevance
              );
    const available = cultivator.cultivationProgress + substitution.substituted;
    const daoRequired = daoRequirementFor(cultivator.realmOrdinal);
    const daoHeld = roadsWalked(comprehension);
    const base = {
        progressRequired: required,
        progressAvailable: available,
        progressAccumulated: cultivator.cultivationProgress,
        progressSubstituted: substitution.substituted,
        daoRequired,
        daoHeld
    };

    if (!cultivator.alive) {
        return { eligible: false, reason: 'dead', ...base };
    }
    // The summit first. Both gates catch a True Immortal - they are at the top
    // AND they have crossed - and only one of them describes their situation.
    // Checked the other way round, somebody standing on the last rung of the
    // ladder was told the Lid had been opened against their name and would not
    // open again, which is the False Immortal's sentence, not theirs.
    if (cultivator.realmOrdinal >= MAX_ORDINAL) {
        return { eligible: false, reason: 'at_ladder_summit', ...base };
    }
    // The Lid does not open twice for the same name. A False Immortal is
    // REFUSED, not merely made unlikely - a hard engine gate, and the only
    // thing stopping them: they sit at 45 with a legal rung above them.
    if (hasCrossedTheLid(cultivator.immortalStatus ?? 'none')) {
        return { eligible: false, reason: 'barred:the_lid_opened_once', ...base };
    }
    if ((ctx.ranksGainedThisTurn ?? 0) >= MAX_RANKS_PER_TURN) {
        return { eligible: false, reason: 'rank_cap_reached_this_turn', ...base };
    }
    // NOTE: a broken status is deliberately NOT a gate here.
    //
    // Trying to advance on a broken foundation or a cracked core is suicidal,
    // and suicidal is not the same as forbidden. The engine lets them strike;
    // what stops people is the arithmetic, which `BROKEN_STATUS_STRAIN` makes
    // appalling and `computeBreakthroughOdds` itemises before anybody commits.
    // The correct play is to stop and live out a long life at the rung, and
    // that has to be a decision somebody can refuse to take rather than a
    // refusal the engine hands them - the same reason `assessLastCrossing`
    // exists instead of the engine declining the last crossing on your behalf.
    //
    // And the desperate path is not merely survivable, it is curative: clearing
    // a crossing while carrying the status removes it. See THE CRUCIBLE below.
    //
    // A CRACKED STRUCTURE, HOWEVER, REFUSES THE NEXT REALM CROSSING, and that
    // one is mechanical rather than punitive: the core will not form on a
    // cracked foundation, the same way a core cannot form before a foundation
    // exists at all. Structural only - a heart demon crosses with you, a
    // severed meridian crosses with you, a burnt span crosses with you. Mental
    // and physical wounds travel up the ladder and are priced by the ordinary
    // injury penalty; only a broken version of the thing the next thing is
    // built on stops the build.
    //
    // Sub-rank steps are NOT gated, so they can still fill out the realm they
    // are standing in. That is what leaves them a long life at their rung
    // rather than quietly executing them on the settling clock.
    if (isRealmBoundary(cultivator.realmOrdinal)) {
        const block = structuralBlockOn(cultivator.injuries ?? []);
        if (block) {
            return { eligible: false, reason: `barred:${block}`, ...base };
        }
    }
    if (required === null || available < required) {
        return { eligible: false, reason: 'insufficient_progress', ...base };
    }
    // The structural gate, and deliberately AFTER progress: a cultivator who
    // has neither should be told about the qi first, because that is the one
    // they can fix by sitting still, and hearing "go and find a teacher" while
    // still eighty qi-units short would be advice about the wrong problem.
    if (daoHeld < daoRequired) {
        return { eligible: false, reason: 'insufficient_dao', ...base };
    }
    return { eligible: true, reason: null, ...base };
}

// ─────────────────────────────────────────────────────────────────────────
// ODDS
// ─────────────────────────────────────────────────────────────────────────

export interface BreakthroughModifier {
    source: string;
    delta: number;
}

export interface BreakthroughOdds {
    finalChance: number;
    /** Itemised. `sum(delta) === finalChance` exactly, clamp line included. */
    modifiers: BreakthroughModifier[];
    isBoundary: boolean;
}

/**
 * What the clock is worth to an attempt, as a flat modifier in
 * [MAX_LIFESPAN_PRESSURE, 0].
 *
 * Zero until half the rung's granted span is gone, then falling linearly to the
 * end of it. Age is optional throughout the odds path because plenty of callers
 * legitimately do not carry it - NPC stubs from the world layer, the reachability
 * sweep - and an unknown age has to read as "no pressure" rather than as the
 * worst case, or every one of those callers would silently be penalised.
 */
export function lifespanPressure(ordinal: number, age?: number): number {
    if (age === undefined || !Number.isFinite(age)) return 0;
    const span = lifespanForOrdinal(ordinal);
    if (span <= 0) return 0;
    const spent = Math.max(0, Math.min(1, age / span));
    if (spent <= LIFESPAN_PRESSURE_ONSET) return 0;
    const through = (spent - LIFESPAN_PRESSURE_ONSET) / (1 - LIFESPAN_PRESSURE_ONSET);
    return MAX_LIFESPAN_PRESSURE * through;
}

/**
 * The age at which `lifespanPressure` starts biting at this rung, in years.
 *
 * The same fact as the function above, read the other way round, and it exists
 * because a display cannot say the useful half of it otherwise. "Your crossing
 * is penalised 16%" tells a player what they have already lost; "the penalty
 * starts at 50, and you are 16" tells them how much runway they are standing
 * on, which is the number that decides whether to strike now or gather longer.
 *
 * It is also where the reward for climbing young becomes visible without
 * anything having to award it. Crossing into Foundation Establishment at thirty
 * and at ninety-five leave the same rung and the same 200-year span, but one
 * cultivator has seventy years before the clock bites and the other has none -
 * so the advantage falls out of `age / lifespanForOrdinal(ordinal)` on its own,
 * which is exactly where it should come from. There is no young-cultivator
 * bonus anywhere in this file and there must not be one.
 */
export function lifespanPressureOnsetAge(ordinal: number): number {
    return lifespanForOrdinal(ordinal) * LIFESPAN_PRESSURE_ONSET;
}

// ─────────────────────────────────────────────────────────────────────────
// WAITING
//
// `docs/world/writing/tone.md` says a run is interesting when the player has to choose
// between two things the world will make them regret, and gives the first
// example as "breakthrough now at poor odds, or stagnate toward settling".
//
// That sentence was false. Measured before this was written: at rung 16
// (requires 30,803 progress) the odds were 32.4% at x1 the requirement and
// 32.4% at x4. Nothing a player ACCUMULATED appeared in the modifier list at
// all, so striking the instant the gate opened was strictly optimal at every
// one of the ladder's rungs, and sitting longer cost years off the settling
// clock for literally nothing. The doc described a dilemma; the engine made it
// an automatic move, forty-six times a life.
//
// So overflow past the requirement buys odds. Three properties hold it in
// place, and each is pinned by a test:
//
//   IT MUST NOT BECOME "ALWAYS WAIT". Diminishing returns - half the available
//   bonus at 1.5x the requirement, and the last third of it never arrives at
//   any finite figure. Against the settling clock and `lifespanPressure`, which
//   is subtractive and unbounded in the other direction, patience is defensible
//   for the young and indefensible for the old. That asymmetry is the point.
//
//   IT MUST NOT MAKE A BOUNDARY SAFE. `maxChanceFor` still clamps a realm
//   boundary at MAX_BOUNDARY_CHANCE, and this term is inside that clamp rather
//   than outside it. No amount of sitting grinds a wall down to a formality;
//   the rungs that kill go on killing.
//
//   IT COMPOSES, AND DOES NOT REPLACE. Ground, foundation, comprehension and a
//   pill were the only four levers, three of them slow. Patience is a fifth,
//   which is what makes the others read as choices rather than as the only path.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The most that waiting can ever be worth, as a flat modifier.
 *
 * Sized against the terms it sits beside: a single spirit root is +0.06 and a
 * realm boundary costs -0.08, so a life spent waiting is worth a little more
 * than being born with the best root in the world and a little less than two
 * boundaries' strain. Enough to be the reason somebody sits; nowhere near
 * enough to be the reason they succeed.
 */
export const MAX_OVERFLOW_BONUS = 0.15;

/**
 * The overflow ratio at which HALF the bonus has arrived. 0.5 - so half of it
 * is bought by 1.5x the requirement and the rest costs progressively more.
 *
 * The curve is `max * r / (r + half)`, which saturates rather than capping: it
 * approaches the ceiling and never reaches it, so there is no figure at which
 * a player has "finished waiting" and every additional decade is worth
 * measurably less than the one before. A hard cap would create exactly the
 * grind-to-the-number behaviour this is meant to avoid.
 */
export const OVERFLOW_HALF_AT = 0.5;

/**
 * What sitting on a full gate is worth to an attempt, in [0, MAX_OVERFLOW_BONUS).
 *
 * Reads ACCUMULATED progress only, never `progressAvailable`. Understanding
 * already stands in for accumulation at a bottleneck via
 * `bottleneckSubstitution` and already has its own line in the ledger; letting
 * substituted progress buy overflow as well would pay comprehension twice for
 * the same thing.
 *
 * Optional throughout, like `age`, because plenty of callers legitimately do
 * not carry it - NPC stubs, the reachability sweep - and an unknown progress
 * has to read as "no overflow" rather than as a penalty.
 */
export function overflowBonus(ordinal: number, cultivationProgress?: number): number {
    if (cultivationProgress === undefined || !Number.isFinite(cultivationProgress)) return 0;
    const required = progressRequiredForOrdinal(ordinal);
    // Null above the Lid, where the requirement is not denominated in this
    // currency and no amount of it would do.
    if (required === null || required <= 0) return 0;
    const overflow = (cultivationProgress - required) / required;
    if (overflow <= 0) return 0;
    return MAX_OVERFLOW_BONUS * (overflow / (overflow + OVERFLOW_HALF_AT));
}

/**
 * Compute the odds without rolling. Exposed separately so the UI can show a
 * player what they are about to do before they commit to doing it - which in a
 * permadeath game is the difference between a tragedy and a bug report.
 */
export function computeBreakthroughOdds(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'spiritRoot' | 'attributes' | 'injuries'> &
        Partial<Pick<
            Cultivator,
            'foundationQuality' | 'insights' | 'age' | 'cultivationProgress' | 'knownTechniques'
        >>
        & { roadsWithinReach?: readonly RoadWithinReach[] },
    ctx: Pick<BreakthroughContext, 'ambient' | 'pill' | 'manualQuality'>
        & { relevance?: Partial<RelevanceContext> }
): BreakthroughOdds {
    const ordinal = cultivator.realmOrdinal;
    const boundary = isRealmBoundary(ordinal);
    const root = getSpiritRoot(cultivator.spiritRoot);
    const injuries = aggregateInjuryPenalties(cultivator.injuries ?? []);
    const foundation = foundationOf(cultivator);
    const tempering = scarTempering(cultivator.injuries ?? []);
    // The same merged list the gate counts, for the same reason. A road walked
    // by standing somewhere for forty years is comprehension at the shallowest
    // degree, and the odds have always priced degree - so reading only
    // `insights` here would have paid a player nothing for the exposure the
    // gate had just accepted, and would have quietly taken the odds bonus away
    // from every NPC in the world, who used to get it off insights this layer
    // synthesised for them at birth.
    const understanding = understandingEffects(roadsWalkedBy(cultivator), {
        rootElements: getSpiritRoot(cultivator.spiritRoot).elements,
        techniqueElement: ctx.relevance?.techniqueElement ?? null,
        techniqueSubject: ctx.relevance?.techniqueSubject ?? null
    });

    const modifiers: BreakthroughModifier[] = [];

    // The base already folds in the ladder's own boundary tax; the label says so.
    modifiers.push({
        source: `base:${rankName(ordinal)}`,
        delta: baseBreakthroughChance(ordinal)
    });

    if (boundary) {
        modifiers.push({ source: 'realm_boundary_strain', delta: REALM_BOUNDARY_STRAIN });
    }

    if (isLastCrossing(ordinal)) {
        modifiers.push({ source: 'last_crossing_strain', delta: LAST_CROSSING_STRAIN });
    }

    // Striking on a structure that did not set. Booked as its own enormous line
    // so a player weighing it sees exactly what it costs before committing -
    // the attempt is legal, it is suicidal, and the ledger is where that gets
    // said. Success would repair the break; almost nothing succeeds.
    const brokenStatus = brokenStatusOf(cultivator.injuries ?? []);
    if (brokenStatus) {
        modifiers.push({ source: `broken:${brokenStatus}`, delta: BROKEN_STATUS_STRAIN });
    }

    modifiers.push({
        source: `spirit_root:${root.key}`,
        delta: BREAKTHROUGH_ROOT_MOD[root.grade]
    });

    modifiers.push({
        source: 'insight',
        delta: (cultivator.attributes.insight - INSIGHT_PIVOT) * INSIGHT_PER_POINT
    });

    // No Fortune line. Luck does not buy a breakthrough; see FORTUNE_PER_POINT.

    modifiers.push({
        source: `ambient_qi:${ctx.ambient}`,
        delta: ambientBreakthroughMod(ctx.ambient)
    });

    if (foundation !== 'none') {
        modifiers.push({
            source: `foundation:${foundation}`,
            delta: foundationEffect(foundation).breakthroughModifier
        });
    }

    // What the book made of them, standing here with them.
    //
    // Booked immediately after the foundation because it is the same kind of
    // fact and the two are read together: the foundation is what the crossing
    // INTO this realm left, and this is what the realm's method built on top of
    // it. A damaged text leaves gaps a crossing finds; an author's own copy
    // leaves somebody who has already been shown what the end of this realm
    // looks like. Neither of them teaches the crossing - see `manualQuality` on
    // `BreakthroughContext` for why that is not a thing a book can do.
    if (ctx.manualQuality) {
        const reading = readManual({ quality: ctx.manualQuality }, cultivator, ctx.relevance);
        if (reading.breakthroughModifier !== 0) {
            modifiers.push({
                source: `manual:${ctx.manualQuality}`,
                delta: reading.breakthroughModifier
            });
        }
    }

    if (injuries.untreatedCount > 0) {
        modifiers.push({
            source: `untreated_injuries:${injuries.untreatedCount}`,
            delta: -injuries.breakthroughPenalty
        });
    }

    if (understanding.breakthroughModifier > 0) {
        modifiers.push({
            source: `understanding:${understanding.contributing.length}`,
            delta: understanding.breakthroughModifier
        });
    }

    if (tempering.scars > 0) {
        // Closed wounds. Not a reward for failing - a return on having paid to
        // heal, which is a real cost that competed with everything else the
        // pills could have bought. Capped at MAX_TEMPERING.
        modifiers.push({
            source: `tempering:${tempering.scars}_scars`,
            delta: tempering.breakthroughBonus
        });
    }

    if (tempering.wornScars > 0) {
        // And the other side of the same record. Booked as its own line rather
        // than netted against the tempering above, because a player looking at
        // this list should be able to see both that their scars taught them
        // something and that there are now too many of them.
        modifiers.push({
            source: `scar_tissue:${tempering.wornScars}_worn`,
            delta: -tempering.breakthroughAttrition
        });
    }

    const pressure = lifespanPressure(ordinal, cultivator.age);
    if (pressure < 0) {
        modifiers.push({ source: 'lifespan_pressure', delta: pressure });
    }

    // Waiting, and the term the clock above is the counterweight to. Booked
    // immediately after the pressure so a player reading the ledger sees the
    // two halves of the same decision on consecutive lines: what another decade
    // of gathering bought, and what it cost off the span.
    const overflow = overflowBonus(ordinal, cultivator.cultivationProgress);
    if (overflow > 0) {
        modifiers.push({ source: 'accumulated_overflow', delta: overflow });
    }

    // ── The pill, which multiplies rather than adds. ──
    //
    // Booked as a DERIVED additive line so the ledger below still sums exactly
    // to finalChance. The base it multiplies is the chance this cultivator
    // would have faced without it, floor-and-ceiling clamped, because a
    // multiplier applied to a raw sum that is negative or already over the
    // ceiling is not a chance at all. That pre-clamp is itself booked, so the
    // reader can see the floor carry them and then the pill act on it.
    if (ctx.pill) {
        const rawBeforePill = modifiers.reduce((sum, m) => sum + m.delta, 0);
        const beforePill = Math.max(
            MIN_BREAKTHROUGH_CHANCE,
            Math.min(maxChanceFor(ordinal), rawBeforePill)
        );
        if (beforePill !== rawBeforePill) {
            modifiers.push({
                source: beforePill > rawBeforePill ? 'clamp:floor' : 'clamp:ceiling',
                delta: beforePill - rawBeforePill
            });
        }
        const factor = pillMultiplier(ctx.pill, ordinal);
        if (factor !== 1) {
            modifiers.push({
                source: `pill:${ctx.pill.name}`,
                delta: beforePill * (factor - 1)
            });
        }
    }

    const raw = modifiers.reduce((sum, m) => sum + m.delta, 0);
    const clamped = Math.max(MIN_BREAKTHROUGH_CHANCE, Math.min(maxChanceFor(ordinal), raw));

    // Keep sum(modifiers) === finalChance an exact identity by booking the
    // clamp itself as a line item rather than silently discarding the overflow.
    if (clamped !== raw) {
        modifiers.push({
            source: clamped > raw ? 'clamp:floor' : 'clamp:ceiling',
            delta: clamped - raw
        });
    }

    return { finalChance: clamped, modifiers, isBoundary: boundary };
}

// ─────────────────────────────────────────────────────────────────────────
// THE ATTEMPT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Attempt to advance one rank.
 *
 * Pure with respect to the cultivator: nothing is mutated. The returned
 * `BreakthroughResult` carries everything the caller needs to apply -
 * `toOrdinal`, `progressConsumed`, `injuriesSustained` - plus the full
 * arithmetic that produced it.
 *
 * Throws when the attempt is not legal. Call `canAttemptBreakthrough` first;
 * a throw here means a caller skipped its own gate, which is a bug, not a
 * game outcome.
 */
/**
 * `name` and `foundationQuality` are optional because most callers legitimately
 * do not carry them - NPC stubs from the world layer, rows written before
 * foundations existed, the time-skip's internal snapshot. A missing foundation
 * reads as 'none'; a missing name means the crossing has nothing legible to take
 * and simply cannot reach for one.
 */
export type BreakthroughSubject = Pick<
    Cultivator,
    'realmOrdinal' | 'cultivationProgress' | 'spiritRoot' | 'attributes' | 'injuries' | 'alive'
> & Partial<Pick<
    Cultivator,
    'foundationQuality' | 'name' | 'insights' | 'immortalStatus' | 'age' | 'knownTechniques'
>>
    // What the world put in reach. Carried through to the gate and the odds by
    // the same rule that answers for an NPC. See `roadsWalkedIncludingExposure`.
    & { roadsWithinReach?: readonly RoadWithinReach[] };

export function attemptBreakthrough(
    cultivator: BreakthroughSubject,
    ctx: BreakthroughContext
): BreakthroughResult {
    const eligibility = canAttemptBreakthrough(cultivator, ctx);
    if (!eligibility.eligible) {
        throw new Error(
            `Breakthrough not permitted (${eligibility.reason}): ` +
            `${eligibility.progressAvailable.toFixed(1)}/${eligibility.progressRequired} progress ` +
            `at ${rankName(cultivator.realmOrdinal)}`
        );
    }

    const fromOrdinal = cultivator.realmOrdinal;
    const required = eligibility.progressRequired;
    const odds = computeBreakthroughOdds(cultivator, ctx);

    // Roll order is fixed: primary first, then severity/tribulation, then the
    // foundation sample, then the toll's three. A stream keyed to
    // (seed, 'breakthrough', turn) therefore replays identically.
    const roll = ctx.rng.next();
    // Drawn first and asked about second: a decided attempt leaves this stream
    // exactly where a sampled one leaves it, so nothing downstream of the
    // crossing - the severity draw, the foundation sample, the toll's three -
    // shifts because an operator arranged the answer.
    const succeeded = ctx.theAttemptLands === true || roll < odds.finalChance;

    // Unreachable: `canAttemptBreakthrough` refuses everything above the Lid
    // before an attempt gets this far. Asserted rather than defaulted, so a
    // future caller that skips the eligibility check fails loudly instead of
    // resolving a breakthrough against a requirement of zero.
    if (required === null) {
        throw new Error(`No breakthrough is denominated in qi at ordinal ${fromOrdinal}`);
    }

    if (!succeeded) {
        return resolveFailure(cultivator, ctx, { fromOrdinal, required, odds, roll });
    }

    // ── Success path. Tribulation ordinals still have to survive the sky. ──
    if (triggersHeavenlyTribulation(fromOrdinal)) {
        return resolveTribulation(cultivator, ctx, { fromOrdinal, required, odds, roll });
    }

    return finishSuccess(cultivator, ctx, {
        fromOrdinal,
        required,
        odds,
        roll,
        injuries: [],
        tribulation: null
    });
}

interface SuccessFrame {
    fromOrdinal: number;
    required: number;
    odds: BreakthroughOdds;
    roll: number;
    injuries: Injury[];
    tribulation: { strikes: number; survived: boolean } | null;
}

/**
 * The one place a successful crossing is assembled, so that the two things the
 * world charges for a success - the foundation at 12 -> 13 and the price of advancement
 * at every realm boundary - cannot be forgotten on one path and applied on
 * another. Both the ordinary success return and the survived-tribulation return
 * come through here.
 */
function finishSuccess(
    cultivator: BreakthroughSubject,
    ctx: BreakthroughContext,
    frame: SuccessFrame
): BreakthroughResult {
    const { fromOrdinal, odds } = frame;
    const toOrdinal = fromOrdinal + 1;

    // ── The foundation, if this is the crossing that lays one. ──
    // Exactly one sample, always, on this path only.
    let foundationEstablished: BreakthroughResult['foundationEstablished'] = null;
    let foundationHint = '';
    if (laysFoundation(fromOrdinal)) {
        const assessment = assessFoundation(
            cultivator,
            { ...(ctx.foundation ?? {}), ambient: ctx.ambient },
            ctx.rng.next()
        );
        foundationEstablished = assessment.quality;
        foundationHint = ` ${assessment.narrationHint}`;
    }

    // ── Did the crossing land clean? ──
    //
    // The success side of the boundary trial, and the half the whole design is
    // actually for: a cultivator who CROSSED and can never cross again. They
    // are at the new rung. They made it. They are finished.
    //
    // One sample on every boundary crossing, whatever it decides, so the stream
    // stays aligned. Not rolled on a sub-rank step, and not on the last
    // crossing - 44 lands on its own two rungs and has its own answer.
    // ── The crucible. ──
    //
    // A crossing cleared while carrying a repairable break REPAIRS it. The same
    // pressure that failed to seat the structure is the only thing that reseats
    // it, which is what makes the suicidal attempt tempting to somebody with
    // nothing left. Legend-rare, because `BROKEN_STATUS_STRAIN` puts the
    // attempt at the floor - but when it lands, it lands.
    //
    // Reported rather than applied: the caller drops the wound with
    // `clearBrokenStatus`, the same way it applies every other delta here.
    const brokenStatusCleared = brokenStatusRepairedBy(cultivator.injuries ?? []);

    const brokenInjuries: Injury[] = [];
    let brokenStatus: string | null = null;
    if (isRealmBoundary(fromOrdinal) && !isLastCrossing(fromOrdinal)) {
        brokenStatus = rollArrivesBroken(fromOrdinal, ctx.rng, foundationOf(cultivator));
        if (brokenStatus) {
            brokenInjuries.push(
                createInjury(
                    { severity: 'crippling', source: 'failed_breakthrough', turn: ctx.turn, woundType: brokenStatus },
                    ctx.rng
                )
            );
        }
    }

    // ── The price of the crossing, if this one is charged. ──
    // Never on a sub-rank step. Always on a boundary, whether or not the caller
    // remembered to supply candidates - the crossing does not wait to be ready.
    let toll: BreakthroughResult['toll'] = null;
    let tollHint = '';
    if (isTolled(fromOrdinal)) {
        toll = evaluateToll(
            {
                realmOrdinal: fromOrdinal,
                attributes: cultivator.attributes,
                name: cultivator.name,
                // The foundation laid by THIS crossing is what the severance reaches
                // into on the way past, so a freshly assessed one counts.
                foundationQuality: foundationEstablished ?? foundationOf(cultivator)
            },
            { ...(ctx.toll ?? {}), rng: ctx.rng, ambient: ctx.ambient }
        );
        tollHint = ` ${toll.narrationHint}`;
    }

    return {
        outcome: 'success',
        fromOrdinal,
        toOrdinal,
        finalChance: odds.finalChance,
        modifiers: odds.modifiers,
        roll: frame.roll,
        injuriesSustained: [...frame.injuries, ...brokenInjuries],
        progressConsumed: frame.required,
        tribulation: frame.tribulation,
        toll,
        foundationEstablished,
        // Only the last crossing confers a status, and it does not route
        // through here - it has its own resolution.
        immortalStatusGained: null,
        // Lightning and successful crossings are authored elsewhere; the
        // boundary trial table is only consulted for a survived failure.
        crossing: null,
        arrivedBroken: brokenStatus,
        brokenStatusCleared,
        narrationHint:
            `Breakthrough succeeded: ${rankName(fromOrdinal)} to ${rankName(toOrdinal)}` +
            `${odds.isBoundary ? ', crossing into a new realm' : ''}. ` +
            `Odds were ${(odds.finalChance * 100).toFixed(1)}%.` +
            foundationHint +
            tollHint +
            (brokenStatus
                ? ` The crossing did not land clean: ${getWoundType(brokenStatus)?.name ?? brokenStatus}. ` +
                  'They are at the new rung, and striking at the next wall on this would be suicide.'
                : '') +
            (brokenStatusCleared
                ? ` They carried ${getWoundType(brokenStatusCleared)?.name ?? brokenStatusCleared} into this ` +
                  'and the crossing reseated it. The structure is whole. This is the kind of thing a ' +
                  'prefecture is still talking about a century later.'
                : '')
    };
}

interface AttemptFrame {
    fromOrdinal: number;
    required: number;
    odds: BreakthroughOdds;
    roll: number;
}

// ─────────────────────────────────────────────────────────────────────────
// FAILURE
// ─────────────────────────────────────────────────────────────────────────

/**
 * What this cultivator brought to the wall, as one number in 0..1.
 *
 * Read off what the context already carries rather than asked for separately,
 * so a caller that bought a pill and prepared a site is credited for it without
 * having to state the same fact twice and without any risk of the two
 * disagreeing. An explicit `ctx.preparation` overrides the reading, which is
 * how a layer that knows something this cannot see - somebody standing guard
 * over the crossing - supplies it.
 *
 * Three terms, evenly weighted, because there is no evidence for weighting them
 * and an invented weighting would be a balance decision hiding inside a helper:
 *
 *   the pill     bought and consumed for this attempt
 *   the site     `foundation.preparation`, which is already "a chosen site, a
 *                cleared schedule, nobody hunting you"
 *   the body     a foundation better than the ordinary good outcome
 *
 * A watch is folded in afterwards rather than averaged with them, and it closes
 * a share of whatever preparation is still missing rather than counting as a
 * fourth quarter. That is what somebody standing guard actually does - they
 * cover the part you could not cover yourself - and it means adding the term
 * moved nobody who has no protector, which every existing caller is.
 */
function preparationOf(
    cultivator: BreakthroughSubject,
    ctx: BreakthroughContext
): number {
    if (typeof ctx.preparation === 'number') {
        return Math.min(1, Math.max(0, ctx.preparation));
    }
    const pill = ctx.pill ? Math.min(1, Math.max(0, Number(ctx.pill.potency ?? 0))) : 0;
    const site = Math.min(1, Math.max(0, Number(ctx.foundation?.preparation ?? 0)));
    const foundation = foundationOf(cultivator);
    const body = foundation === 'exceptional' ? 1
        : foundation === 'transformed' ? 0.6
            : foundation === 'stable' ? 0.4
                : 0;
    const alone = (pill + site + body) / 3;
    const watch = Math.min(1, Math.max(0, Number(ctx.protection ?? 0)));
    return Math.min(1, alone + watch * (1 - alone));
}

function resolveFailure(
    cultivator: BreakthroughSubject,
    ctx: BreakthroughContext,
    frame: AttemptFrame
): BreakthroughResult {
    const lastCrossing = isLastCrossing(frame.fromOrdinal);
    const table = lastCrossing
        ? FAILURE_TABLE.lastCrossing
        : frame.odds.isBoundary
          ? FAILURE_TABLE.boundary
          : FAILURE_TABLE.subRank;
    const severityRoll = ctx.rng.next();

    let outcome: BreakthroughFailure;
    if (severityRoll < table.stable) outcome = 'failure_stable';
    else if (severityRoll < table.injured) outcome = 'failure_injured';
    else if (severityRoll < table.deviation) outcome = 'failure_deviation';
    else outcome = 'death';

    const wounds = outcome === 'failure_injured' || outcome === 'failure_deviation' || outcome === 'death';

    // ── What KIND of ruin this was. ──
    //
    // Consulted only for a SURVIVED, WOUNDING failure at a realm boundary that
    // is not a tribulation ordinal. Three exclusions, each deliberate:
    //
    //   not a stable failure  `failure_stable` means the qi dispersed without
    //                         damage, and it still does. A trial that attached
    //                         a heart demon to a clean miss would contradict
    //                         the narration on the same line.
    //   not a death           somebody who did not survive the wall is not also
    //                         half mad. The one thing that happened already
    //                         happened.
    //   not lightning         `trialForOrdinal` returns 'heavenly_lightning'
    //                         for 40-44 and 'none' for a sub-rank step, and
    //                         `resolveCrossingFailure` hands back a null
    //                         outcome for both.
    //
    // And it REPLACES the generic wound rather than adding to it. Failing a
    // realm boundary was always where torn meridians came from; the table's job
    // is to say which wound this particular wall leaves, not to leave two.
    const trial: TrialKind = trialForOrdinal(frame.fromOrdinal);
    const consultTrial =
        wounds && outcome !== 'death' && trial !== 'none' && trial !== 'heavenly_lightning';

    const injuries: Injury[] = [];
    let crossing: BreakthroughResult['crossing'] = null;
    let consequence: CrossingConsequence | null = null;

    if (consultTrial) {
        const failure = resolveCrossingFailure(
            {
                realmOrdinal: frame.fromOrdinal,
                injuries: cultivator.injuries,
                foundationQuality: cultivator.foundationQuality,
                age: cultivator.age
            },
            ctx.rng,
            { turn: ctx.turn }
        );
        if (failure.outcome) {
            consequence = failure.consequence;
            injuries.push(...failure.consequence.injuries);
            crossing = {
                trial: failure.trial,
                outcome: failure.outcome.key,
                foundationQuality: failure.consequence.foundationQuality ?? null,
                yearsBurned: failure.consequence.yearsBurned ?? 0,
                soulStateFloor: failure.consequence.soulStateFloor ?? null,
                identityContinuityFactor: failure.consequence.identityContinuityFactor ?? null,
                halted: failure.consequence.halted ?? false
            };
        }
    }

    // The generic wound, for every failure the trial table did not speak for:
    // sub-rank steps, the tribulation ordinals, and death.
    if (outcome !== 'failure_stable' && injuries.length === 0) {
        const severity = failureInjurySeverity(outcome, frame.odds.isBoundary, ctx.rng);
        const source = outcome === 'failure_deviation' ? 'qi_deviation' : 'failed_breakthrough';
        injuries.push(
            createInjury(
                { severity, source, turn: ctx.turn, woundType: ordinaryWoundFor(source, severity) },
                ctx.rng
            )
        );
    }

    // The last crossing costs the whole accumulation whatever the severity and
    // whatever was brought to it - see `LAST_CROSSING_PROGRESS_LOSS`. Every
    // other failure costs somewhere in a range, and where in it is decided by
    // how far short the attempt fell and by what the cultivator prepared. See
    // THE SHAPE OF THE LOSS.
    const progressConsumed =
        frame.required *
        (lastCrossing
            ? LAST_CROSSING_PROGRESS_LOSS
            : failureProgressLoss(
                outcome, frame.roll, frame.odds.finalChance, preparationOf(cultivator, ctx)
            ));

    return {
        outcome,
        fromOrdinal: frame.fromOrdinal,
        toOrdinal: frame.fromOrdinal,
        finalChance: frame.odds.finalChance,
        modifiers: frame.odds.modifiers,
        roll: frame.roll,
        injuriesSustained: injuries,
        progressConsumed,
        tribulation: null,
        // A failed crossing is not a crossing. The price is charged for arriving,
        // not for trying, and a foundation you did not lay has no quality.
        toll: null,
        foundationEstablished: null,
        immortalStatusGained: null,
        crossing,
        arrivedBroken: null,
        brokenStatusCleared: null,
        narrationHint:
            failureNarration(outcome, frame, injuries) +
            (consequence && crossing ? ` ${crossingNarration(crossing)}` : '')
    };
}

/** Factual account of the ruin, appended to the ordinary failure line. */
function crossingNarration(crossing: NonNullable<BreakthroughResult['crossing']>): string {
    const parts: string[] = [];
    if (crossing.foundationQuality) {
        parts.push(`The foundation is now ${crossing.foundationQuality}.`);
    }
    if (crossing.yearsBurned > 0) {
        parts.push(`${Math.round(crossing.yearsBurned)} years of the span were spent getting through it.`);
    }
    if (crossing.halted) {
        parts.push('They will not cross another realm boundary.');
    }
    return parts.join(' ');
}

/**
 * A failure at a realm boundary escalates the wound table. Failing to form a
 * golden core does not sprain something; it breaks what you were forming it
 * from.
 */
function failureInjurySeverity(
    outcome: Exclude<BreakthroughFailure, 'failure_stable'>,
    boundary: boolean,
    rng: CultivationRNG
): InjurySeverity {
    if (outcome === 'death') return 'crippling';
    const roll = rng.next();
    if (boundary || outcome === 'failure_deviation') {
        if (roll < 0.25) return 'minor';
        if (roll < 0.7) return 'serious';
        return 'crippling';
    }
    if (roll < 0.65) return 'minor';
    if (roll < 0.95) return 'serious';
    return 'crippling';
}

function failureNarration(
    outcome: BreakthroughFailure,
    frame: AttemptFrame,
    injuries: readonly Injury[]
): string {
    const where = `${rankName(frame.fromOrdinal)}${frame.odds.isBoundary ? ' (realm boundary)' : ''}`;
    const odds = `${(frame.odds.finalChance * 100).toFixed(1)}%`;
    switch (outcome) {
        case 'failure_stable':
            return `Breakthrough failed at ${where} at ${odds}. The qi dispersed without damage; a quarter of the accumulated progress is gone.`;
        case 'failure_injured':
            return `Breakthrough failed at ${where} at ${odds}. ${injuries[0].severity} meridian injury sustained; half the accumulated progress is gone.`;
        case 'failure_deviation':
            return `Breakthrough failed at ${where} at ${odds} and collapsed into qi deviation. ${injuries[0].severity} meridian injury sustained; three quarters of the accumulated progress is gone.`;
        case 'death':
            return `Breakthrough failed catastrophically at ${where} at ${odds}. The meridians ruptured completely. The cultivator is dead.`;
    }
}

// ─────────────────────────────────────────────────────────────────────────
// HEAVENLY TRIBULATION
// Ordinals 41-44. The primary roll only earns the right to be struck at.
// ─────────────────────────────────────────────────────────────────────────

/**
 * First ordinal of Tribulation Transcendence: the destination of the 40 -> 41
 * crossing.
 *
 * Looked up by key rather than taken as the last tier, because the last tier is
 * now True Immortal. Reading it positionally was correct only while
 * Tribulation Transcendence was the summit.
 */
const TRIBULATION_REALM_START = REALM_TIERS.find(
    t => t.key === 'tribulation_transcendence'
)!.ordinalStart;

/**
 * Lightning strikes an attempt from this ordinal must weather.
 *
 * Counted from the destination: from 40 -> 3 strikes, 41 -> 4, 42 -> 5,
 * 43 -> 6, and the last crossing at 44 -> 7, the heaviest in the game.
 * Returns 0 for an attempt that summons no tribulation at all.
 */
export function tribulationStrikeCount(ordinal: number): number {
    if (!triggersHeavenlyTribulation(ordinal)) return 0;
    const destination = ordinal + 1;
    return TRIBULATION_BASE_STRIKES + (destination - TRIBULATION_REALM_START);
}

/**
 * Per-strike survival probability, before any strike is rolled.
 *
 * Might, ambient qi and the state of the meridians only. Surviving a lightning
 * strike is as causal as an outcome gets - it is how much qi the body can hold
 * before it starts holding you - and Fortune has been removed from it for the
 * same reason it was removed from breakthrough odds.
 */
export function tribulationStrikeSurvival(
    cultivator: Pick<Cultivator, 'attributes' | 'injuries'>,
    ambient: AmbientQi
): number {
    const injuries = aggregateInjuryPenalties(cultivator.injuries ?? []);
    const raw =
        TRIBULATION_BASE_SURVIVAL +
        cultivator.attributes.might * 0.02 +
        ambientBreakthroughMod(ambient) -
        injuries.breakthroughPenalty;
    return Math.max(MIN_TRIBULATION_SURVIVAL, Math.min(MAX_TRIBULATION_SURVIVAL, raw));
}

function resolveTribulation(
    cultivator: BreakthroughSubject,
    ctx: BreakthroughContext,
    frame: AttemptFrame
): BreakthroughResult {
    const strikes = tribulationStrikeCount(frame.fromOrdinal);
    const perStrike = tribulationStrikeSurvival(cultivator, ctx.ambient);

    const injuries: Injury[] = [];
    let failedStrikes = 0;

    // Every strike is rolled, even after the third failure, so the number of
    // samples drawn depends only on the ordinal. That keeps the stream aligned
    // for anything a caller rolls afterwards on the same RNG.
    for (let strike = 0; strike < strikes; strike++) {
        const survived = ctx.rng.next() < perStrike;
        if (survived) continue;
        failedStrikes++;
        if (failedStrikes <= TRIBULATION_LETHAL_STRIKES) {
            const severity = failedStrikes >= TRIBULATION_LETHAL_STRIKES ? 'crippling' : 'serious';
            injuries.push(
                createInjury(
                    {
                        severity,
                        source: 'tribulation',
                        turn: ctx.turn,
                        woundType: ordinaryWoundFor('tribulation', severity),
                        description: `Heavenly lightning, strike ${strike + 1} of ${strikes}, struck home.`
                    },
                    ctx.rng
                )
            );
        }
    }

    const survived = failedStrikes < TRIBULATION_LETHAL_STRIKES;

    if (!survived) {
        return {
            outcome: 'death',
            fromOrdinal: frame.fromOrdinal,
            toOrdinal: frame.fromOrdinal,
            finalChance: frame.odds.finalChance,
            modifiers: frame.odds.modifiers,
            roll: frame.roll,
            injuriesSustained: injuries,
            progressConsumed: frame.required,
            tribulation: { strikes, survived: false },
            // Nobody arrived, so nobody is charged. Cultivators who fail
            // tribulation do not leave a body; they leave a scar on the ground.
            toll: null,
            foundationEstablished: null,
            immortalStatusGained: null,
        // Lightning and successful crossings are authored elsewhere; the
        // boundary trial table is only consulted for a survived failure.
        crossing: null,
        arrivedBroken: null,
        brokenStatusCleared: null,
            narrationHint:
                `Heavenly tribulation was not survived: ${failedStrikes} of ${strikes} strikes struck home ` +
                `(${(perStrike * 100).toFixed(0)}% survival per strike). The cultivator was destroyed by the lightning.`
        };
    }

    // ── The last crossing resolves three ways, not two. ──
    if (isLastCrossing(frame.fromOrdinal)) {
        return resolveLastCrossing(cultivator, ctx, frame, {
            strikes,
            failedStrikes,
            perStrike,
            injuries
        });
    }

    // Survived. Route through the shared success path so the toll is charged
    // exactly once, on every arriving crossing, including this one - the
    // 40 -> 41 boundary is tribulation AND toll.
    const result = finishSuccess(cultivator, ctx, {
        fromOrdinal: frame.fromOrdinal,
        required: frame.required,
        odds: frame.odds,
        roll: frame.roll,
        injuries,
        tribulation: { strikes, survived: true }
    });

    return {
        ...result,
        narrationHint:
            `Heavenly tribulation weathered: ${strikes} strikes, ${failedStrikes} struck home ` +
            `(${(perStrike * 100).toFixed(0)}% survival per strike). ` +
            `${rankName(frame.fromOrdinal)} to ${rankName(frame.fromOrdinal + 1)}.` +
            (result.toll ? ` ${result.toll.narrationHint}` : '')
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE LAST CROSSING
// The attempt from Tribulation Transcendence Perfection, and the only one in
// the game that does not resolve as success-or-failure. The lightning decides
// whether the cultivator lives; if they do, a second roll decides whether the
// seam stays open long enough for them to actually go through.
// ─────────────────────────────────────────────────────────────────────────

interface TribulationOutcome {
    strikes: number;
    failedStrikes: number;
    perStrike: number;
    injuries: Injury[];
}

/**
 * Chance a survived last crossing completes.
 *
 * Deliberately does NOT read Fortune. Whether the Lid stays open is the most
 * causal thing in the setting - it is the world deciding whether the hole is
 * worth the qi it will cost to seal - and luck is not permitted to buy it.
 * What moves it is how cleanly the tribulation went, the structure the
 * cultivator is built on, and how much ambient qi there is at the moment.
 */
export function completionChance(
    cultivator: Pick<Cultivator, 'injuries'> & Partial<Pick<Cultivator, 'foundationQuality'>>,
    ambient: AmbientQi,
    failedStrikes: number
): { chance: number; modifiers: BreakthroughModifier[] } {
    const foundation = foundationOf(cultivator);
    const injuries = aggregateInjuryPenalties(cultivator.injuries ?? []);

    const modifiers: BreakthroughModifier[] = [
        { source: 'base:completion', delta: TRUE_IMMORTAL_BASE_COMPLETION },
        {
            source: `strikes_landed:${failedStrikes}`,
            delta: failedStrikes * COMPLETION_PER_LANDED_STRIKE
        },
        { source: `ambient_qi:${ambient}`, delta: ambientBreakthroughMod(ambient) }
    ];

    if (foundation !== 'none') {
        modifiers.push({
            source: `foundation:${foundation}`,
            delta: foundationEffect(foundation).breakthroughModifier
        });
    }
    if (injuries.untreatedCount > 0) {
        modifiers.push({
            source: `untreated_injuries:${injuries.untreatedCount}`,
            delta: -injuries.breakthroughPenalty
        });
    }

    const raw = modifiers.reduce((sum, m) => sum + m.delta, 0);
    const chance = Math.max(MIN_COMPLETION_CHANCE, Math.min(MAX_COMPLETION_CHANCE, raw));
    if (chance !== raw) {
        modifiers.push({
            source: chance > raw ? 'clamp:floor' : 'clamp:ceiling',
            delta: chance - raw
        });
    }
    return { chance, modifiers };
}

// ─────────────────────────────────────────────────────────────────────────
// DECLINING
//
// The top of the ladder is a QUESTION, not an outcome, and until this existed
// nothing in play ever asked it. A cultivator arrived at Tribulation
// Transcendence Perfection and either struck or ran out of clock, and the
// difference between those two was luck rather than judgement.
//
// It should be judgement. Most of the people who reach the last rung do not
// attempt the crossing, and they do not attempt it because they can read their
// own odds: worn meridians, most of a span spent getting here, and a completion
// chance that was never better than a quarter for anybody. Sitting down at 44
// buys a hundred thousand years of being the most powerful thing in a province.
// Striking buys a coin-flip against a scar in the ground.
//
// `hierarchy.ts` has recorded the distinction in its courts for a long time -
// `highWaterMark.end` is 'attempted' or 'declined' - and nothing in the engine
// could produce either. This is the missing half: the engine tells a caller
// what the attempt is actually worth, and the caller (a player, or an NPC
// driver) decides. The engine still owns every number; it does not own the
// decision, and it must not, because a decision the engine makes for you is not
// a decision you made.
// ─────────────────────────────────────────────────────────────────────────

/** What the engine thinks of a crossing this cultivator is considering. */
export type LastCrossingVerdict =
    /** Not standing at 44 at all, or already through the Lid. */
    | 'not_at_the_rung'
    /** The price is not gathered. Nothing to decide yet. */
    | 'not_yet_priced'
    /** As good as this ever gets. Still likelier to end at 45 than 46. */
    | 'as_ready_as_anyone_gets'
    /** Attemptable, and the numbers are worse than the cultivator's remaining life. */
    | 'marginal'
    /** Worn, late, or both. Striking is a way of choosing how to die. */
    | 'hopeless';

export interface LastCrossingAssessment {
    verdict: LastCrossingVerdict;
    /** Whether an attempt would be legal right now. */
    attemptable: boolean;
    /** Odds of holding the gathered qi long enough to summon at all. */
    summonChance: number;
    /** Per-strike survival, and how many strikes are coming. */
    strikes: number;
    perStrikeSurvival: number;
    /** Probability of weathering the tribulation, given it is summoned. */
    tribulationSurvival: number;
    /** Chance the seam holds, given a clean weathering. */
    completionChance: number;
    /** End-to-end, from standing at the rung to each of the four endings. */
    trueImmortalChance: number;
    falseImmortalChance: number;
    deathChance: number;
    /**
     * Survived a failed summon: alive at 44, the whole price spent, and no
     * realistic prospect of gathering it again inside the settling clock. The
     * outcome nobody plans for and a good number of the courts are full of.
     */
    strandedChance: number;
    /** Years of the rung's span still unspent, or null when age is unknown. */
    yearsRemaining: number | null;
    /** Itemised, in the house style: every figure above is derivable from these. */
    modifiers: BreakthroughModifier[];
}

/**
 * Everything the engine knows about the crossing, before anybody commits to it.
 *
 * Read-only and roll-free. It exists so that "should I go up the mountain" can
 * be answered with the same arithmetic the mountain will use, which is the only
 * way declining can be a decision rather than a guess. A caller that wants to
 * model a decline records the choice and stops offering the attempt; the
 * cultivator stays at 44 with their span and their standing, and the world gets
 * one more of the quiet ones the courts have always been full of.
 */
export function assessLastCrossing(
    cultivator: BreakthroughSubject,
    ambient: AmbientQi,
    opts: { pill?: ConsumedPill | null; relevance?: Partial<RelevanceContext> } = {}
): LastCrossingAssessment {
    const relevance = opts.relevance;
    const ordinal = cultivator.realmOrdinal;
    const eligibility = canAttemptBreakthrough(cultivator, { relevance });
    // The pill is part of the question, not a surprise sprung afterwards: a
    // cultivator weighing the crossing knows exactly what they intend to
    // swallow going up the mountain, and an assessment that ignored it would
    // be advising a different person.
    const odds = computeBreakthroughOdds(cultivator, { ambient, pill: opts.pill ?? null, relevance });
    const strikes = tribulationStrikeCount(LAST_CROSSING_ORDINAL);
    const perStrike = tribulationStrikeSurvival(cultivator, ambient);
    const survival = tribulationSurvivalChance(strikes, perStrike);
    // Assessed against a clean weathering: the strikes that land are not known
    // in advance, and quoting the crossing at its worst would be as misleading
    // as quoting it at its best.
    const completion = completionChance(cultivator, ambient, 0);

    // Four endings, and they sum to one. Summon, then weather, then the seam;
    // a failed summon is not a wasted month up here, it is the price gone.
    const summon = odds.finalChance;
    const failedSummonKills = 1 - FAILURE_TABLE.lastCrossing.deviation;
    const trueChance = summon * survival * completion.chance;
    const falseChance = summon * survival * (1 - completion.chance);
    const deathChance = summon * (1 - survival) + (1 - summon) * failedSummonKills;
    const strandedChance = (1 - summon) * (1 - failedSummonKills);

    const span = lifespanForOrdinal(ordinal);
    const yearsRemaining =
        cultivator.age === undefined ? null : Math.max(0, span - cultivator.age);

    let verdict: LastCrossingVerdict;
    if (!isLastCrossing(ordinal) || hasCrossedTheLid(cultivator.immortalStatus ?? 'none')) {
        verdict = 'not_at_the_rung';
    } else if (!eligibility.eligible) {
        verdict = 'not_yet_priced';
    } else if (trueChance >= 0.15) {
        verdict = 'as_ready_as_anyone_gets';
    } else if (trueChance >= 0.05) {
        verdict = 'marginal';
    } else {
        verdict = 'hopeless';
    }

    return {
        verdict,
        attemptable: eligibility.eligible,
        summonChance: summon,
        strikes,
        perStrikeSurvival: perStrike,
        tribulationSurvival: survival,
        completionChance: completion.chance,
        trueImmortalChance: trueChance,
        falseImmortalChance: falseChance,
        deathChance,
        strandedChance,
        yearsRemaining,
        modifiers: [
            ...odds.modifiers,
            ...completion.modifiers.map(m => ({ source: `completion.${m.source}`, delta: m.delta }))
        ]
    };
}

/**
 * Probability of taking fewer than TRIBULATION_LETHAL_STRIKES hits out of
 * `strikes`, closed-form, so the assessment does not have to sample.
 */
function tribulationSurvivalChance(strikes: number, perStrike: number): number {
    const fail = 1 - perStrike;
    let survived = 0;
    for (let k = 0; k < TRIBULATION_LETHAL_STRIKES; k++) {
        survived += binomial(strikes, k) * Math.pow(fail, k) * Math.pow(perStrike, strikes - k);
    }
    return Math.max(0, Math.min(1, survived));
}

function binomial(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    let out = 1;
    for (let i = 0; i < k; i++) out = (out * (n - i)) / (i + 1);
    return out;
}

function resolveLastCrossing(
    cultivator: BreakthroughSubject,
    ctx: BreakthroughContext,
    frame: AttemptFrame,
    tribulation: TribulationOutcome
): BreakthroughResult {
    const { strikes, failedStrikes, perStrike, injuries } = tribulation;
    const completion = completionChance(cultivator, ctx.ambient, failedStrikes);
    const completionRoll = ctx.rng.next();
    const completed = completionRoll < completion.chance;

    const weathered =
        `Heavenly tribulation weathered at the last crossing: ${strikes} strikes, ` +
        `${failedStrikes} struck home (${(perStrike * 100).toFixed(0)}% survival per strike). ` +
        `The Lid opened at ${(completion.chance * 100).toFixed(1)}%.`;

    // Modifiers carry the primary odds plus the completion arithmetic, so a UI
    // can show both halves of a crossing that had two independent gates.
    const modifiers = [
        ...frame.odds.modifiers,
        ...completion.modifiers.map(m => ({ source: `completion.${m.source}`, delta: m.delta }))
    ];

    if (completed) {
        // ── True Immortal. The account is closed in full. ──
        const toll = evaluateToll(
            {
                realmOrdinal: frame.fromOrdinal,
                attributes: cultivator.attributes,
                name: cultivator.name,
                foundationQuality: foundationOf(cultivator)
            },
            { ...(ctx.toll ?? {}), rng: ctx.rng, ambient: ctx.ambient, collectInFull: true }
        );

        return {
            outcome: 'success',
            fromOrdinal: frame.fromOrdinal,
            toOrdinal: MAX_ORDINAL,
            finalChance: frame.odds.finalChance,
            modifiers,
            roll: frame.roll,
            injuriesSustained: injuries,
            progressConsumed: frame.required,
            tribulation: { strikes, survived: true },
            toll,
            foundationEstablished: null,
            immortalStatusGained: 'true_immortal',
            crossing: null,
            arrivedBroken: null,
            brokenStatusCleared: null,
            narrationHint:
                `${weathered} The crossing completed: ${rankName(MAX_ORDINAL)}. ${toll.narrationHint}`
        };
    }

    // ── False Immortal. Survived, opened the Lid, did not go through. ──
    // The ordinal moves to 45: something did happen, and they are strictly
    // above anything still under the Lid. What it does not do is move again -
    // 46 is one rung up and permanently shut. Something is taken regardless of
    // any roll, because "incomplete in a way that shows" is a fact of the
    // setting and never nothing.
    const toll = evaluateToll(
        {
            realmOrdinal: frame.fromOrdinal,
            attributes: cultivator.attributes,
            name: cultivator.name,
            foundationQuality: foundationOf(cultivator)
        },
        { ...(ctx.toll ?? {}), rng: ctx.rng, ambient: ctx.ambient, guaranteed: true }
    );

    return {
        outcome: 'false_immortal',
        fromOrdinal: frame.fromOrdinal,
        toOrdinal: FALSE_IMMORTAL_ORDINAL,
        finalChance: frame.odds.finalChance,
        modifiers,
        roll: frame.roll,
        injuriesSustained: injuries,
        progressConsumed: frame.required,
        tribulation: { strikes, survived: true },
        toll,
        foundationEstablished: null,
        immortalStatusGained: 'false_immortal',
        crossing: null,
        arrivedBroken: null,
        brokenStatusCleared: null,
        narrationHint:
            `${weathered} The crossing did not complete: ${rankName(FALSE_IMMORTAL_ORDINAL)}, ` +
            `over the Lid and not through it, barred from ever attempting again. ${toll.narrationHint}`
    };
}
