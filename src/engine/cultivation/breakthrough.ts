/**
 * Breakthrough - the centrepiece. Three rules shape the design:
 *
 *  1. THE ENGINE SHOWS ITS WORK. Every modifier is itemised in
 *     `result.modifiers` and the deltas sum exactly to `finalChance`. Tested.
 *  2. NEVER 0%, NEVER 100%. When the clamp bites it appears in the modifier
 *     list as its own line, so the arithmetic stays auditable.
 *  3. A REALM BOUNDARY IS A DIFFERENT KIND OF EVENT, not a harder step: 0.45x
 *     base odds, and its own failure table where the corpses come from.
 *
 * Fortune is deliberately NOT in the odds - see FORTUNE_PER_POINT. The last
 * crossing, 44 -> 45, is the only attempt that resolves three ways.
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
import { MAX_DAO_HEART_STRAIN } from './what-a-crossing-asks-of-the-dao-heart.js';
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

// TUNING CONSTANTS

/**
 * The floor and ceiling on breakthrough probability. Deliberately not 0 and 1:
 * the floor also stops an injured cultivator's odds going negative and turning
 * `roll < chance` into a branch no test can cover.
 */
export const MIN_BREAKTHROUGH_CHANCE = 0.02;
export const MAX_BREAKTHROUGH_CHANCE = 0.97;

/**
 * The ceiling on a REALM BOUNDARY, which is a different ceiling and much lower.
 * FIVE IN SIX IS AS GOOD AS A REALM BOUNDARY EVER GETS, for anybody, ever.
 *
 * Preparation is additive and a fully prepared cultivator clears +1.0 of
 * modifiers before the base is counted, so against a single 0.97 ceiling every
 * boundary was a formality: measured, 73% of best-case lives arrived above the
 * Lid. The cap moves that to about a half, and True Immortal from 28% to 14%.
 *
 * It is also as low as it can go. At 0.80 the poor road closes entirely -
 * 30,000 sampled poor lives, none past ordinal 28 - so this constant is
 * load-bearing for `tests/engine/world/origin-outcomes.test.ts`; re-run that
 * file before moving it.
 *
 * The dao gate narrows the same road further, and that is a design question
 * rather than a tuning one: across 60,000 poor lives with the gate live, 36
 * reach the ordinal-28 wall and 2 are allowed to strike at it. If the farmer's
 * road has to stay as wide as it was, THE LEVER IS THE SUPPLY - not this
 * constant and not the curve. Re-run
 * `scripts/probe-can-the-world-feed-the-dao-gate.ts` alongside the origin sweep
 * before moving either.
 */
export const MAX_BOUNDARY_CHANCE = 0.85;

/**
 * The last crossing is exempt, and gets the ordinary ceiling back. Not a
 * softening: at 44 there is no wall to open, and what is in doubt is the
 * lightning and the seam, which are rolled separately. Capping the primary roll
 * here as well would price the same danger twice.
 */
export function maxChanceFor(ordinal: number): number {
    if (isLastCrossing(ordinal)) return MAX_BREAKTHROUGH_CHANCE;
    return isRealmBoundary(ordinal) ? MAX_BOUNDARY_CHANCE : MAX_BREAKTHROUGH_CHANCE;
}

/**
 * Spirit-root contribution, by grade. NOT `cultivationSpeed`: speed decides how
 * fast you arrive at the bottleneck, this decides whether you get through it,
 * which is why mutated roots cultivate faster and get the smaller bonus.
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
 * Fortune contributes NOTHING here, and that is a deliberate correction. Luck
 * generates opportunity, not success; its weight lives in the time-skip's event
 * generation, where it biases timing, presence and availability. The constant is
 * kept, at zero, so the intent is legible at the call site rather than being an
 * unexplained absence.
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

// WHAT ARRIVING COSTS THE BODY
//
// The design owner's ruling: *"don't forget that crossing deals damage too
// (unless via admin panel) or the immortal pill that lets you skip a ordinal -
// that's the diff between the immortal pill and the ones that give you qi, the
// qi ones you still have to cross and risk it."*
//
// The size is derived, never chosen: A YEAR'S CLIMBING MUST COST LESS THAN A
// YEAR'S MENDING. `HP_RECOVERY_FRACTION_PER_DAY` is 0.0005, so a year returns
// 0.1825 of the pool; a boundary at 0.15 sits under that with room and a whole
// realm comes to 0.30. If the recovery rate ever moves, these move with it.
//
// The first pair was 0.08 and 0.25 and turned `root-cliff.test.ts` red inside
// the hour - "mutated_ice: 1 of 24 were killed by the root despite treatment",
// cause `qi_deviation` rather than a wall. Both arms against the same tree: 0
// deaths against 1, and `A_CROSSING_MAY_NOT_TAKE_MORE_THAN` was already in and
// did not save it. A boundary is the binding case because 0.25 exceeded a
// year's mending. Do not take the largest value a sweep happens to pass.

/** A rung inside a realm, as a fraction of the pool. */
export const BODY_COST_OF_A_STEP = 0.05;

/**
 * A realm boundary, as a fraction of the pool. Also what the last crossing
 * charges: the strikes are already the most expensive thing in the game and
 * arrive as real wounds, so there is no fourth multiplier on top.
 */
export const BODY_COST_OF_A_CROSSING = 0.15;

/**
 * What arriving at `toOrdinal` costs the body, as a fraction of the pool. Keyed
 * on the rung LEFT, the same argument `isRealmBoundary`, `isTolled` and
 * `baseBreakthroughChance` take, so what a crossing costs and what a crossing IS
 * cannot come apart.
 */
export function bodyCostOfArriving(fromOrdinal: number): number {
    return isRealmBoundary(fromOrdinal) ? BODY_COST_OF_A_CROSSING : BODY_COST_OF_A_STEP;
}

/**
 * The most of what is STANDING that a crossing may take, whatever it is owed.
 *
 * A COST THAT REDUCES AND NEVER ZEROES. Clamping at one point instead was not
 * enough: `root-cliff.test.ts` went red within the hour of the toll landing -
 * "mutated_ice: 1 of 24 were killed by the root despite treatment", cause
 * `qi_deviation` - because a crossing dropped the body to almost nothing and the
 * next deviation finished it. The toll never killed anybody and was the reason
 * they died, which is the worst shape a cost can take.
 *
 * `AGENTS.md` on defences: *"A defence reduces; it never zeroes."* A crossing
 * takes a share of the POOL or a share of WHAT IS THERE, whichever is less. A
 * half, because that makes the sentence exactly true: whatever you walk into a
 * wall with, you walk out with half of it at worst.
 */
export const A_CROSSING_MAY_NOT_TAKE_MORE_THAN = 0.5;

/**
 * What a crossing actually takes out of a body that is standing at `hp`. The one
 * derivation, so the played verb and the auto-breakthrough inside a seclusion
 * cannot clamp differently - which is exactly where two callers of one price
 * drift, and the player who found the cheaper door plays a different game.
 */
export function whatACrossingTakesFrom(
    hp: number,
    maxHp: number,
    bodyCost: number
): number {
    if (bodyCost <= 0 || hp <= 1) return 0;
    const owed = Math.max(1, Math.round(maxHp * bodyCost));
    const mostItMayTake = Math.floor(hp * A_CROSSING_MAY_NOT_TAKE_MORE_THAN);
    return Math.max(0, Math.min(owed, mostItMayTake, hp - 1));
}

/**
 * Chance that a SURVIVED last crossing actually completes, before modifiers.
 */
export const TRUE_IMMORTAL_BASE_COMPLETION = 0.12;
/** Each strike that landed is damage the crossing has to carry through the seam. */
export const COMPLETION_PER_LANDED_STRIKE = -0.05;
export const MIN_COMPLETION_CHANCE = 0.01;
/**
 * A quarter, and the ceiling is the whole point of the number. Everything that
 * helps a crossing is additive and a prepared cultivator clears the raw figure
 * easily, so this cap is what every crossing worth making actually resolves at:
 * THREE OUT OF FOUR CROSSINGS THAT SURVIVE THE LIGHTNING DO NOT GO THROUGH. It
 * was 0.45, which put the ratio at roughly 1.2 False to 1 True and quietly made
 * the good ending the likely one.
 */
export const MAX_COMPLETION_CHANCE = 0.25;

// PILLS
//
// A pill MULTIPLIES the odds; it does not add percentage points to them. The
// measurement that settles it: the last crossing resolves at finalChance
// 0.0200. Read additively a +0.35 pill takes that to 37%; read
// multiplicatively, to 2.1%. The same pill at a rung already at 60% takes it
// to 81%.
//
//   effective = 1 + (gradeFactor - 1) * bandDecay(grade, ordinal)
//                                     * toleranceDecay(priorPillsTaken)
//
// 1. GRADE DESCENDS as the grade climbs, against catalog prices that ascend
//    from 75 spirit stones to 750,000:
//
//      mortal    1.35  (+35%)  Foundation-Guiding             75
//      earth     1.25  (+25%)  Golden Core Guiding           650
//      heaven    1.18  (+18%)  Nascent Soul Guiding        7,500
//      immortal  1.12  (+12%)  Void Refinement Guiding    60,000
//      chaos     1.08  (+8%)   Tribulation Guiding       750,000
//
//    The cheapest pill in the world lifts the Foundation wall by a third; the
//    dearest lifts the last crossing by a sixteenth, for ten thousand times the
//    price. A cultivator at the bottom can buy their way through a rung; one
//    near the top cannot buy their way through anything, however rich.
//
// 2. BAND halves the effect every PILL_BAND_HALF_LIFE_RUNGS above the grade's
//    own rung and works in full below it, so a pill beneath you is a waste of
//    money and not a penalty. A mortal pill at ordinal 44 is 31 rungs up and
//    delivers +2.4%.
//
// 3. TOLERANCE is PERMANENT rather than windowed: the second pill is worth
//    60%, the fourth 22%, the sixth 8%. A window would only teach players to
//    wait it out.
//
// The pill multiplies AFTER the ordinary floor and ceiling and the result is
// clamped again, so no pill carries anyone past `maxChanceFor(ordinal)`.
// `MAX_COMPLETION_CHANCE` does not interact: `completionChance` takes no pill
// and never has.

/**
 * The fractional lift of the strongest pill reading, as a bare fraction. Under
 * the multiplicative reading this is "+35%", not "+35 points" - the same number,
 * a different meaning - and {@link MAX_PILL_MULTIPLIER} is the clearer way to
 * say it. Retained under this name because `engine/world/origin-odds.ts` and
 * `engine/world/seeding.ts` scale a 0..1 preparation quality by it.
 */
export const MAX_PILL_BONUS = 0.35;

/** The most a pill may multiply breakthrough odds by. A mortal-grade pill. */
export const MAX_PILL_MULTIPLIER = 1 + MAX_PILL_BONUS;

/**
 * Base multiplier by pill grade, DESCENDING. See the banner above for why.
 */
export const PILL_GRADE_FACTOR: Readonly<Record<TechniqueGrade, number>> = {
    mortal: MAX_PILL_MULTIPLIER,
    earth: 1.25,
    heaven: 1.18,
    immortal: 1.12,
    // LEVEL WITH IMMORTAL. The descent above is per BAND - a pill pitched
    // higher lifts a smaller share, because the odds it is lifting are worse -
    // and the two top grades are now pitched at the same band, so a step
    // between them would be chaos being strictly worse at the one thing both
    // are for. They are peers; the descent has run out of rungs to descend.
    chaos: 1.12
};

/**
 * The realm each pill grade is pitched at, as a realm key. Read off the catalog's
 * guiding-pill line and resolved through `REALM_TIERS` rather than by writing
 * rung numbers down, so the band follows the ladder if the ladder moves.
 * `tests/engine/cultivation/pills.test.ts` asserts it still matches the catalog.
 */
export const PILL_GRADE_REALM: Readonly<Record<TechniqueGrade, RealmKey>> = {
    mortal: 'foundation_establishment',
    earth: 'core_formation',
    heaven: 'nascent_soul',
    immortal: 'void_refinement',
    // LEVEL WITH IMMORTAL, AND IT IS THE LAST OF THE PEER RULING
    //
    // Both top grades are FOR 29 and up. Chaos sat at Tribulation
    // Transcendence, which was the old ladder's belief that it outranked
    // immortal wearing a different field, and it was the last place that
    // belief survived after `GRADE_POWER` tied them.
    //
    // Moving it down is not a softening. It is what gives the pitch a job:
    // a chaos-grade thing holds a fixed quantity of stored energy - what a
    // body at 29 is worth - and being UNDER that is what makes swallowing one
    // dangerous. `grade-spread.ts` reads this ordinal twice, for the overdraw
    // and for the detonation, because they are the same stored energy let go
    // two different ways.
    chaos: 'void_refinement'
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
 * How much of a pill survives being taken this far above its own band. 1 at or
 * below the band, and never zero: a curve rather than a cutoff, so "this pill is
 * beneath you now" arrives as a shrinking number rather than as a rule firing.
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

// THE CLOCK
//
// A cultivator who forces a crossing on a body with a decade left in it is not
// attempting the same thing as one with nine tenths of a span in hand, so the
// late attempt is priced worse. Nothing here decides WHETHER to strike - that
// is the player's, or the caller's, and `assessLastCrossing` is what they
// consult.

/** Share of the rung's granted span that may be spent before the clock bites. */
export const LIFESPAN_PRESSURE_ONSET = 0.5;
/** Worst the clock can be worth, at the very end of a span. */
export const MAX_LIFESPAN_PRESSURE = -0.2;

/**
 * Failure severity tables. Each column is a cumulative threshold against one
 * [0,1) sample, checked in order: stable, injured, deviation, death.
 *
 * The boundary column carried a 10% death share until it was measured against
 * whole lives rather than single rolls. A cultivator who fails heals, re-gathers
 * and strikes again, so what matters is the chance of dying before the wall
 * opens, and at 10% against the ceiling above that came to almost nobody.
 *
 * The last crossing's column is the worst in the game: nearly half of those who
 * lose their grip are killed by what they called down.
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

// EVERY REALM IS A BUCKET
//
// The model the ladder is tuned to, in the designer's words: *"think of it as a
// bucket with an input and an output. the bucket always has some volume to it
// but its shifting"*, scoped to "each cultivation stage". Nine buckets, and they
// are CHAINED - one realm's outflow is the next one's inflow - so no band can be
// tuned in isolation. The target is a slow inflow and a slow outflow holding a
// steady volume; the arrivals share is a diagnostic that falls out of the three
// numbers and no constant here may be set from it.
//
// TWO OUTFLOWS THAT ARE NOT OUTFLOWS: settling and a structural break both stop
// somebody climbing without removing them from the world, so a bucket can read
// healthy and be feeding nothing. The outflow that FEEDS THE NEXT BUCKET has to
// be measured separately from the one that merely ends.
// `scripts/probe-the-bucket-at-each-realm.ts` is the instrument.
//
// THE SHAPE OF THE LOSS, WHICH IS THE PYRAMID'S STRONGEST LEVER
//
// READ THIS BEFORE CHANGING FAILURE_LOSS_SHAPE. It silently decides how many
// cultivators the world ever produces, and it was measured rather than chosen.
//
//     loss = deepEnd * (SHALLOWEST_LOSS + (1 - SHALLOWEST_LOSS) * shortfall^k)
//
// `shortfall` is the primary roll rescaled past the odds and uniform on [0,1),
// so this adds no draw to the stream and no caller's stream ordering moves.
// k > 1 puts mass at the SHALLOW end and widens the pyramid at every rung;
// k < 1 puts it at the deep end and narrows it hard.
//
// Three shapes, 3,000 lives per band on each of three seeds, unaided climb.
// Ranges are across seeds:
//
//   shape                 band     Found     Core    Nascent  Deity      Void
//   ------------------------------------------------------------------------
//   k = 1.8, THIS ONE     dense   46-48%   19-20%   7.7-8.0%  2.5-3.0%  0.5-0.8%
//                         normal  16-17%   3.8-4.6% 0.9-1.3%  0.3-0.4%  0.0-0.1%
//   flat at the deep end  dense   44-46%   18.0%    7.3%      2.4-2.8%  0.5-0.8%
//   (k -> 0)              normal  14.4%    3.7%     0.9%      0.27%     0.0-0.1%
//   the whole requirement dense   38-39%   14.3%    5.7%      1.8-2.3%  0.5-0.6%
//   at every severity     normal  10.5%    2.7%     0.6%      0.18%     -
//
// ABOVE DEITY TRANSFORMATION ALL THREE ARE THE SAME - Body Integration
// 0.17-0.27%, Grand Ascension 0.03-0.07%, Tribulation Transcendence 0-0.03%
// under every one - so this lever controls the BOTTOM of the ladder and not the
// apex. At a high rung the limit is the settling allowance's total SPAN rather
// than how many attempts fit inside it.
//
// If you move it, re-run `scripts/probe-does-the-world-produce-its-apex.ts` and
// the unaided sweep in `ladder-odds.ts` and put the new table here. And it is an
// INFLOW lever, half of a bucket: measured over forty centuries the top's
// problem was the OUTFLOW every time - residence as a share of the realm's own
// span ran 100% at Qi Condensation and fell to 10% by Void Refinement, where 77%
// of departures were violent against 10% of age. No value of k fixes that.

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
 * 1.8 leans clearly shallow: the median failure costs about 57% of its severity's
 * deep end rather than 100%, so a stable boundary failure disperses roughly 14%
 * of the requirement instead of 25% and a cultivator gets about half again as
 * many attempts inside the same settling clock.
 */
export const FAILURE_LOSS_SHAPE = 1.8;

/**
 * How much preparation moves the mass toward the shallow end. Additive on the
 * exponent rather than multiplicative on the result, so preparation buys a
 * different SHAPE and not a discount on a rolled number.
 *
 * INTEGRATION POINT. Anything that counts as having prepared feeds
 * `BreakthroughContext.preparation` and nothing else. There must not be a second
 * preparation term beside this one.
 */
export const PREPARED_LOSS_SHAPE_BONUS = 1.4;

/**
 * Where in the range this particular failure landed. Reads the primary roll
 * rather than drawing again: it costs no sample, keeps every caller's stream
 * ordering exactly where it was, and means the same attempt always costs the
 * same amount.
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
 * A failed last crossing costs the whole accumulation, whatever the severity. The
 * qi was not dispersed, it was SPENT, and the settling clock at that rung does
 * not grant a second full price - which is what makes the crossing a single shot
 * in practice without a special-case rule saying so.
 */
export const LAST_CROSSING_PROGRESS_LOSS = 1;

/**
 * Heavenly tribulation: strikes escalate as the cultivator climbs the final
 * realm, indexed by the DESTINATION ordinal rather than the origin, which is what
 * puts the lightest tribulation on the 40 -> 41 boundary crossing.
 */
export const TRIBULATION_BASE_STRIKES = 3;
/** Failed strikes that kill outright. Two you can walk away from. */
export const TRIBULATION_LETHAL_STRIKES = 3;
/** Base per-strike survival before fortune, ambient and injuries. */
export const TRIBULATION_BASE_SURVIVAL = 0.6;
export const MIN_TRIBULATION_SURVIVAL = 0.15;
export const MAX_TRIBULATION_SURVIVAL = 0.95;

// CONTEXT AND ELIGIBILITY

export interface ConsumedPill {
    name: string;
    /**
     * The pill's grade, from the catalog row. THE input that matters: it sets
     * the base multiplier and the realm band the pill is made for. Supply it
     * wherever a catalog row is in hand.
     */
    grade?: TechniqueGrade;
    /**
     * Legacy strength, as a FRACTIONAL lift rather than percentage points: 0.35
     * means x1.35, not +35 points. Read only when no `grade` is given -
     * `engine/world/origin-odds.ts` and `engine/world/seeding.ts` synthesise a pill
     * from a 0..1 preparation quality and have no catalog row to grade. Clamped to
     * MAX_PILL_BONUS.
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
 * Whether the primary roll is decided rather than sampled. ADMIN's forced verb
 * and NOTHING ELSE sets this - see
 * `server/consolidated/forcing-an-attempt-to-land.ts`. An explicit input rather
 * than an ambient reading, because this module is a pure resolver.
 *
 * It decides ONE question - did the barrier give. Eligibility is a GATE and is
 * still checked above, and everything a success costs is still charged. The roll
 * is still DRAWN below and then overridden, so the stream is left in the same
 * place either way.
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
     * Conditions for the price of advancement, charged on a SUCCESSFUL
     * realm-boundary crossing. Omitting this does not skip the toll - the crossing
     * does not wait for a caller to be ready - it charges with no candidates, which
     * surfaces as `nothing_left` in the result. A caller that owns bonds, memories
     * and techniques must supply them here.
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
 * PREPARATION, NEVER INSTRUCTION: the crossing is not in the book and no book can
 * put it there - `triggersHeavenlyTribulation` takes an ordinal and nothing else.
 * Omitted contributes no line at all. See `manual-quality.ts`.
 */
    manualQuality?: ManualQuality | null;
/**
 * How much was done before the attempt, 0..1. THE ONE PREPARATION TERM: anything
 * that counts as having prepared feeds this and nothing else, and there must not
 * be a second one beside it. It prices what a FAILURE costs; see
 * `PREPARED_LOSS_SHAPE_BONUS`.
 *
 * Omitted is not zero - `preparationOf` reads what the context already carries.
 * Supply it to override.
 */
    preparation?: number;
/**
 * How much of a watch is standing over this crossing, 0..1. THE PROTECTOR LAYER'S
 * INTEGRATION POINT, separate from `preparation` so a caller with a watch need
 * not recompute the pill, the site and the foundation to say so. Pass
 * `protectionBonus(watch, ordinal) / MAX_PROTECTION_BONUS`. There is no second
 * protection term in this file and there must not be one.
 */
    protection?: number;
/**
 * Who is standing, for the line's own label. Not a second protection term - the
 * same one, named, because `protectionModifier` labels its line
 * `dao_protection:<names>` and `ctx.protection` carries no identities. Omitted
 * books the bare `dao_protection`.
 */
    protectionBy?: readonly string[];
/**
 * How much of this cultivator's record is unfinished, 0..1. 道心.
 * `whatACrossingAsksOfTheDaoHeart(...).share`, and nothing else may be passed
 * here. Charged at realm boundaries only. Absent or zero books no line, so every
 * caller without a ledger produces a byte-identical modifier list.
 */
    daoHeart?: number;
    /** How many unfinished accounts that share came from, for the line's label. */
    daoHeartOpen?: number;
}

// THE ROADS BESIDES YOUR OWN
//
// The structural gate: past Qi Condensation, a realm boundary asks for
// comprehension a cultivator's own body cannot supply, and refuses the attempt
// when it is not there.
//
// Measured over 400 hand-played lives before it existed: 94% of deaths land on
// a boundary rung, in a clean survivorship curve - 137 at ordinal 12, 123 at 16,
// 52 at 20, 31 at 24, 13 at 28, 6 at 32, 8 at 36 - and a sect elder died at the
// same rungs at the same rates as a rogue. The ladder was hard and it was not
// STRUCTURAL: nothing on it ever asked a cultivator for anything they could only
// get from somebody else, so joining a sect meant nothing.
//
// Counting NON-ELEMENT domains is the right measure because `discoverableInsights`
// is already access-shaped: `own_root`, the one access everybody is born with,
// grants comprehension in `element` and in no other domain. A muddled
// five-element root - the worst draw in the game - reaches five `element`
// insights and still counts zero, which is the hole a naive breadth requirement
// would have left open.
//
// ACCESS, NOT EFFORT, and it must not be eroded later: the requirement names
// WHAT MUST BE IN REACH, never what must be done. No minimum years, no deed, no
// quest, no suffering requirement. Being handed an inheritance counts, being
// taught counts, reading counts, theft counts.
//
// Within-realm rungs are NOT gated - the soloable feel between walls is
// preserved and it is the walls that ask. `daoRequirementCurve` below owns the
// curve and its cap. A refusal is a redirect and not a death, and it should read
// like the progress gate reads - the measurement first, no encouragement.

/**
 * The rung a cultivator stands on for the first crossing the dao gate asks of.
 * Documentation rather than a switch: `daoRequirementCurve` derives the same
 * boundary from the realm index and does not read this, and a test asserts the
 * two agree at every ordinal. The switch is `DAO_GATE_ENFORCED`.
 */
export const DAO_GATE_FROM_ORDINAL = 20;

/**
 * WHETHER THE CURVE IS CHARGED. Held off until the world could supply the roads:
 * a played cultivator had an insight list and an NPC record had none, so 0 of
 * 1,511 living NPCs held a single road besides their own and 100 of 100 standing
 * at a gated wall were refused. Nothing crossed ordinal 28 again - not thinned,
 * stopped.
 *
 * With the four supply channels in `engine/world/how-a-cultivator-comes-by-a-road.ts`
 * live - practice, held or open ground, buried ruins, single-use materials -
 * `scripts/probe-can-the-world-feed-the-dao-gate.ts`, four seeds at 800 years,
 * 2,037 living:
 *
 *     band            people   mean roads   needed   would pass
 *     Core 17-20          87      1.71          1     87 / 87
 *     Nascent 21-24       66      2.67          2     47 / 66
 *     Deity 25-28         36      3.36          3     22 / 36
 *     Void 29-32          26      4.12          4     15 / 26
 *     Body 33-36          21      3.81          5      9 / 21
 *     Grand 37-40          5      4.20          5      2 / 5
 *     Trib 41-44           6      4.17          5      2 / 6
 *
 * THE CONTROL MATTERS MORE THAN THE TABLE. The same probe with the gate OFF
 * gives bands of 62 / 43 / 21 / 20 / 20 / 2 / 5 against 58 / 44 / 18 / 18 / 20 /
 * 3 / 5 with it on - the same to inside the noise, including at the top. The gate
 * is not what limits the apex; the settling clock, the manual ceiling and the
 * span are. Anybody re-tuning this on the strength of a thin upper band should
 * run the gate-off arm first.
 */
export const DAO_GATE_ENFORCED = true;

/** The one domain a cultivator's own root can supply unaided. */
const SELF_TAUGHT_DOMAIN: InsightDomain = 'element';

/** Every domain that requires access to something outside the cultivator. */
export const ROADS_BESIDES_YOUR_OWN: readonly InsightDomain[] = InsightDomainSchema.options
    .filter(domain => domain !== SELF_TAUGHT_DOMAIN);

/**
 * Distinct comprehension domains this cultivator holds beyond their own root.
 * Degree is deliberately not consulted: this asks how many roads have been
 * stepped onto, not how far along any of them. Depth is what the odds price.
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
 * THE ASYMMETRY THIS REPLACES. A player's list held only insights formed by
 * surviving something, at 0.6% to 3.4% a year; an NPC's was SYNTHESISED at the
 * moment of asking and charged for nothing. Standing in Nascent Soul at 800
 * years an NPC held 2.09 roads and a player held none. One rule now, in
 * `what-a-road-in-reach-costs-to-walk.ts`.
 *
 * Omitting `roadsWithinReach` means "nothing is in reach", which is the right
 * answer for an odds harness and for a subject built without a world.
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
 * Starts at the NASCENT SOUL crossing and nowhere below it: you cannot form a
 * nascent soul without a dao, and the bottom three realms stay soloable. Then one
 * more road per realm, capped:
 *
 *     into Nascent Soul 1, Deity Transformation 2, Void Refinement 3,
 *     Body Integration 4, Grand Ascension 5, Tribulation Transcendence 5,
 *     the last crossing 5
 *
 * THE CAP AT FIVE IS A MEASUREMENT. It was 8 - the whole set besides your own -
 * which read as a bound and was a closed door. Three seeds at 1,500 years, share
 * of each standing band holding at least k roads:
 *
 *     band              >=3     >=4     >=5     >=6     >=7
 *     Deity 25-28      69.2%   53.8%   46.2%   11.5%    0.0%
 *     Void 29-32      100.0%   75.0%   62.5%   12.5%    0.0%
 *     Body 33-36       92.9%   64.3%   50.0%   21.4%    0.0%
 *     Grand 37-40     100.0%   60.0%   60.0%   40.0%    0.0%
 *     Trib 41-44      100.0%  100.0%   20.0%   20.0%    0.0%
 *
 * NOBODY IN THE WORLD HOLDS SEVEN, IN ANY BAND, ON ANY SEED. Five is where about
 * half of a high band stands, so the wall refuses about half and the rest may
 * strike. The cap is a claim about WHAT THE WORLD CAN FEED: raise the supply
 * first and this second, in that order and never the other way round, and re-run
 * `scripts/probe-can-the-world-feed-the-dao-gate.ts`.
 *
 * Derived from the realm index rather than tabulated, so it follows the ladder.
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
 * The most roads the curve may ever ask for. See the table above. Deliberately
 * smaller than `ROADS_BESIDES_YOUR_OWN.length`: how many domains EXIST is a fact
 * about the schema, how many the world can put in one cultivator's reach is a
 * fact about sects, provinces and ruins. Only the second may bound a requirement.
 */
export const MOST_ROADS_THE_WORLD_SUPPLIES = 5;

/** The realm a cultivator stands in to attempt Nascent Soul. The curve's zero. */
const CORE_FORMATION_REALM_INDEX = REALM_TIERS.findIndex(t => t.key === 'core_formation');

/**
 * What this rung ACTUALLY asks for right now - the curve, behind the switch. Zero
 * everywhere while `DAO_GATE_ENFORCED` is false; `daoRequirementCurve` is what
 * the design says.
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
             * Roads access has put in reach and that years have not yet paid for.
             * THE FIELD THAT MAKES THE GATE ONE RULE - see
             * `roadsWalkedIncludingExposure`. Supplied by whichever adapter can see
             * this person's world; absent means nothing is in reach, which is the
             * honest answer for an odds harness.
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

// ODDS

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
 * [MAX_LIFESPAN_PRESSURE, 0]. Zero until half the rung's granted span is gone,
 * then falling linearly. Age is optional because plenty of callers legitimately
 * do not carry it, and an unknown age must read as "no pressure" rather than as
 * the worst case.
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
 * The age at which `lifespanPressure` starts biting at this rung, in years. The
 * same fact read the other way round, so a display can say how much runway a
 * player is standing on rather than only what they have lost. It is also where
 * the reward for climbing young becomes visible without anything awarding it:
 * there is no young-cultivator bonus in this file and there must not be one.
 */
export function lifespanPressureOnsetAge(ordinal: number): number {
    return lifespanForOrdinal(ordinal) * LIFESPAN_PRESSURE_ONSET;
}

// WAITING
//
// `docs/world/writing/tone.md` gives "breakthrough now at poor odds, or stagnate
// toward settling" as its first example of a real dilemma. Measured before this
// was written, it was not one: at rung 16 (30,803 progress required) the odds
// were 32.4% at x1 the requirement and 32.4% at x4. Nothing a player ACCUMULATED
// appeared in the modifier list, so striking the instant the gate opened was
// strictly optimal at every rung, forty-six times a life.
//
// Three properties hold overflow in place, each pinned by a test:
//
//   IT MUST NOT BECOME "ALWAYS WAIT". Half the bonus at 1.5x the requirement and
//   the last third never arrives at any finite figure, against `lifespanPressure`
//   which is subtractive and unbounded in the other direction.
//
//   IT MUST NOT MAKE A BOUNDARY SAFE. The term is INSIDE `maxChanceFor`'s clamp
//   rather than outside it, so no amount of sitting grinds a wall down.
//
//   IT COMPOSES, AND DOES NOT REPLACE. A fifth lever beside ground, foundation,
//   comprehension and a pill, which is what makes the others read as choices.

/**
 * The most that waiting can ever be worth, as a flat modifier. Sized against the
 * terms beside it - a single spirit root is +0.06 and a realm boundary costs
 * -0.08 - so a life spent waiting is worth a little more than the best root in
 * the world and nowhere near enough to be the reason anybody succeeds.
 */
export const MAX_OVERFLOW_BONUS = 0.15;

/**
 * The most a watch can ever be worth, as a flat modifier, and larger than any
 * term beside it (root +0.06, boundary -0.08, last crossing -0.15, a whole life
 * of waiting +0.15). That is the setting's claim, not an oversight:
 * `CROSSING_PRACTICE.why` says protection is the thing secrecy substitutes for.
 * What makes it affordable is scarcity - at ordinal 44 a protector must be within
 * one major realm of Tribulation Transcendence - not a smaller number.
 */
export const MAX_PROTECTION_BONUS = 0.2;

/**
 * The overflow ratio at which HALF the bonus has arrived. 0.5 - so half is bought
 * by 1.5x the requirement and the rest costs progressively more. The curve is
 * `max * r / (r + half)`, which saturates rather than capping: a hard cap would
 * create exactly the grind-to-the-number behaviour this is meant to avoid.
 */
export const OVERFLOW_HALF_AT = 0.5;

/**
 * What sitting on a full gate is worth to an attempt, in [0, MAX_OVERFLOW_BONUS).
 * Reads ACCUMULATED progress only, never `progressAvailable`: `bottleneckSubstitution`
 * already lets understanding stand in for accumulation and has its own ledger
 * line, and letting substituted progress buy overflow would pay comprehension
 * twice. Optional, like `age`; unknown reads as "no overflow".
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
    ctx: Pick<
        BreakthroughContext,
        'ambient' | 'pill' | 'manualQuality' | 'protection' | 'protectionBy'
        | 'daoHeart' | 'daoHeartOpen'
    >
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

    // 道心, and it is charged at a wall and nowhere else.
    //
    // Booked beside the break rather than beside the foundation because the two
    // are the same kind of fact - something the cultivator arrived carrying that
    // no amount of qi answers - and a player weighing an attempt should read
    // them together. What it is worth is `MAX_DAO_HEART_STRAIN`; what is in it
    // is `what-a-crossing-asks-of-the-dao-heart.ts` and is not this file's.
    //
    // The label carries the COUNT and never the causes. A crossing that named
    // what it was asking about would be the engine publishing somebody's
    // record, at a moment they cannot decline, to whoever is reading the log.
    const daoHeart = boundary ? Math.min(1, Math.max(0, Number(ctx.daoHeart ?? 0))) : 0;
    if (daoHeart > 0) {
        const open = Math.max(0, Math.floor(Number(ctx.daoHeartOpen ?? 0)));
        modifiers.push({
            source: open > 0 ? `dao_heart:${open}_unfinished` : 'dao_heart',
            delta: -daoHeart * MAX_DAO_HEART_STRAIN
        });
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

    // The pill, which multiplies rather than adds.
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

    // The watch, last of all.
    //
    // `ctx.protection` is the share of a full watch that is standing, 0..1, and
    // it is THE protection term - the field's own note says there must not be a
    // second one in this file, and there is not. It was already read by the
    // failure-cost half; this is the same fact reaching the ODDS, which is the
    // half that had no reader at all.
    //
    // `foldProtectionIntoOdds` was written to do this from outside and is
    // unreachable in practice: every real crossing goes through
    // `attemptBreakthrough`, which computes its own odds internally and never
    // hands them out to be folded. That function's own docstring called this
    // the better version and left it to whoever owned this file next.
    //
    // Booked LAST, after the pill, for the reason the fold gives: nothing
    // earlier may be rewritten, because the pill term multiplies a mid-list
    // clamp that has to keep meaning what it meant. Absent or zero books no
    // line, so every caller without a watch produces a byte-identical ledger.
    // The clamp below is what stops a watch pushing an attempt past the rung's
    // ceiling - protection buys a crossing nobody interferes with, and there
    // was never a wall a guard could open.
    const watching = Math.min(1, Math.max(0, Number(ctx.protection ?? 0)));
    if (watching > 0) {
        const who = (ctx.protectionBy ?? []).filter(name => name.length > 0);
        modifiers.push({
            source: who.length > 0 ? `dao_protection:${who.join(', ')}` : 'dao_protection',
            delta: watching * MAX_PROTECTION_BONUS
        });
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

// THE ATTEMPT

/**
 * Attempt to advance one rank. Pure with respect to the cultivator: nothing is
 * mutated. Throws when the attempt is not legal - call `canAttemptBreakthrough`
 * first; a throw here means a caller skipped its own gate, which is a bug and not
 * a game outcome.
 */
/**
 * `name` and `foundationQuality` are optional because most callers legitimately do
 * not carry them - NPC stubs from the world layer, rows written before foundations
 * existed, the time-skip's internal snapshot. A missing foundation reads as 'none';
 * a missing name means the crossing has nothing legible to take and simply cannot
 * reach for one.
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

    // Success path. Tribulation ordinals still have to survive the sky.
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
 * world charges for a success - the foundation at 12 -> 13 and the price of
 * advancement at every realm boundary - cannot be forgotten on one path and applied
 * on another. Both the ordinary success return and the survived-tribulation return
 * come through here.
 */
function finishSuccess(
    cultivator: BreakthroughSubject,
    ctx: BreakthroughContext,
    frame: SuccessFrame
): BreakthroughResult {
    const { fromOrdinal, odds } = frame;
    const toOrdinal = fromOrdinal + 1;

    // The foundation, if this is the crossing that lays one.
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

    // Did the crossing land clean?
    //
    // The success side of the boundary trial, and the half the whole design is
    // actually for: a cultivator who CROSSED and can never cross again. They
    // are at the new rung. They made it. They are finished.
    //
    // One sample on every boundary crossing, whatever it decides, so the stream
    // stays aligned. Not rolled on a sub-rank step, and not on the last
    // crossing - 44 lands on its own two rungs and has its own answer.
    // The crucible.
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

    // The price of the crossing, if this one is charged.
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
        // What arriving cost. Every ordinary crossing in the game comes through
        // here - a sub-rank step, a realm boundary, and a survived tribulation
        // below the last one - so this is the one place it is charged.
        bodyCost: bodyCostOfArriving(fromOrdinal),
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

// FAILURE

/**
 * What this cultivator brought to the wall, as one number in 0..1. Read off what
 * the context already carries so a caller is credited without stating the same
 * fact twice; an explicit `ctx.preparation` overrides the reading.
 *
 * Three terms - the pill, the site (`foundation.preparation`) and the body -
 * evenly weighted, because there is no evidence for weighting them and an
 * invented weighting would be a balance decision hiding inside a helper. A watch
 * is folded in afterwards rather than averaged, closing a share of whatever
 * preparation is still missing, so adding the term moved nobody without one.
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

    // What KIND of ruin this was.
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
        // Nothing, and for the same reason the toll is nothing below: this is
        // what ARRIVING costs, and nobody arrived. A failure has its own wound
        // table and it is far more expensive; charging both would price one
        // event twice, and it would put the body cost on the branch where the
        // lethality already lives.
        bodyCost: 0,
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

// HEAVENLY TRIBULATION
// Ordinals 41-44. The primary roll only earns the right to be struck at.

/**
 * First ordinal of Tribulation Transcendence: the destination of the 40 -> 41
 * crossing. Looked up by key rather than taken as the last tier, which was
 * correct only while Tribulation Transcendence was the summit.
 */
const TRIBULATION_REALM_START = REALM_TIERS.find(
    t => t.key === 'tribulation_transcendence'
)!.ordinalStart;

/**
 * Lightning strikes an attempt from this ordinal must weather, counted from the
 * destination: from 40 -> 3 strikes, 41 -> 4, 42 -> 5, 43 -> 6, and the last
 * crossing at 44 -> 7, the heaviest in the game. 0 when no tribulation is summoned.
 */
export function tribulationStrikeCount(ordinal: number): number {
    if (!triggersHeavenlyTribulation(ordinal)) return 0;
    const destination = ordinal + 1;
    return TRIBULATION_BASE_STRIKES + (destination - TRIBULATION_REALM_START);
}

/**
 * Per-strike survival probability, before any strike is rolled. Might, ambient qi
 * and the state of the meridians only - Fortune is removed for the same reason it
 * is removed from breakthrough odds.
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
            // Nobody arrived. The lightning is what happened to them and it is
            // in `injuriesSustained` where it belongs.
            bodyCost: 0,
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

    // The last crossing resolves three ways, not two.
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

// THE LAST CROSSING
// The only attempt in the game that does not resolve as success-or-failure: the
// lightning decides whether the cultivator lives, and if they do a second roll
// decides whether the seam stays open long enough for them to go through.

interface TribulationOutcome {
    strikes: number;
    failedStrikes: number;
    perStrike: number;
    injuries: Injury[];
}

/**
 * Chance a survived last crossing completes. Deliberately does NOT read Fortune:
 * whether the Lid stays open is the world deciding whether the hole is worth the
 * qi it will cost to seal, and luck is not permitted to buy it.
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

// DECLINING
//
// The engine tells a caller what the attempt is actually worth and the caller -
// a player, or an NPC driver - decides. The engine owns every number and must
// not own the decision. `hierarchy.ts` has recorded the distinction in its
// courts all along: `highWaterMark.end` is 'attempted' or 'declined'.

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
 * Read-only and roll-free, so "should I go up the mountain" is answered with the
 * same arithmetic the mountain will use - which is the only way declining can be
 * a decision rather than a guess.
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
        // True Immortal. The account is closed in full.
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
            // The last crossing is a boundary like any other, priced the same.
            // The lightning above it is not a fourth multiplier on this figure -
            // the strikes arrive as real wounds, which is more expensive than
            // anything a fraction of the pool could say.
            bodyCost: bodyCostOfArriving(frame.fromOrdinal),
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

    // False Immortal. Survived, opened the Lid, did not go through.
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
        // They went over the Lid and not through it, and 45 is a rung they are
        // standing on. Something arrived, so something is charged.
        bodyCost: bodyCostOfArriving(frame.fromOrdinal),
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
