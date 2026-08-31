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
    type InjurySeverity
} from '../../schema/cultivation.js';
import {
    MAX_ORDINAL,
    REALM_TIERS,
    baseBreakthroughChance,
    hasCrossedTheLid,
    isLastCrossing,
    isRealmBoundary,
    progressRequiredForOrdinal,
    rankName,
    triggersHeavenlyTribulation
} from './realms.js';
import { getSpiritRoot, type SpiritRootGrade } from './spirit-roots.js';
import { ambientBreakthroughMod } from './ambient.js';
import { aggregateInjuryPenalties, createInjury, scarTempering } from './injuries.js';
import {
    assessFoundation,
    foundationEffect,
    foundationOf,
    laysFoundation,
    type FoundationConditions
} from './foundation.js';
import { evaluateToll, isTolled, type TollConditions } from './toll.js';
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
 * Spirit-root contribution, by grade.
 *
 * Note this is NOT `cultivationSpeed`. Speed decides how fast you arrive at the
 * bottleneck; this decides whether you get through it. Mutated roots are fast
 * and powerful but volatile - they get a smaller bonus than clean single roots
 * despite cultivating faster, because raw lightning is not the same as control.
 */
export const BREAKTHROUGH_ROOT_MOD: Record<SpiritRootGrade, number> = {
    single: 0.06,
    dual: -0.04,
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
export const MAX_COMPLETION_CHANCE = 0.45;

/** Cap on how much a single pill may contribute, however good the pill is. */
export const MAX_PILL_BONUS = 0.35;

/**
 * Failure severity tables. Each column is a cumulative threshold against one
 * [0,1) sample, checked in order: stable, injured, deviation, death.
 *
 * Sub-rank failure is mostly a wasted stretch of time. Boundary failure is a
 * 10% chance of dying on the spot and a 65% chance of taking a wound you will
 * still be carrying a decade later. This table is where "boundaries are the
 * bottlenecks that kill cultivators" is actually implemented.
 */
export const FAILURE_TABLE = {
    subRank: { stable: 0.55, injured: 0.9, deviation: 0.99 },
    boundary: { stable: 0.25, injured: 0.65, deviation: 0.9 }
} as const;

/** Fraction of the required progress burned by each failure outcome. */
export const FAILURE_PROGRESS_LOSS: Record<BreakthroughFailure, number> = {
    failure_stable: 0.25,
    failure_injured: 0.5,
    failure_deviation: 0.75,
    death: 1
};

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
    /** Flat probability bonus. Clamped to MAX_PILL_BONUS. */
    potency: number;
}

export interface BreakthroughContext {
    /** Stream for this attempt. Caller derives it, e.g. forStream(seed, 'breakthrough', turn). */
    rng: CultivationRNG;
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
}

export interface EligibilityCheck {
    eligible: boolean;
    /** Machine-readable reason when ineligible; null when eligible. */
    reason: string | null;
    progressRequired: number;
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
        Partial<Pick<Cultivator, 'immortalStatus' | 'spiritRoot' | 'insights'>>,
    ctx: Pick<BreakthroughContext, 'ranksGainedThisTurn' | 'relevance'> = {}
): EligibilityCheck {
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);
    // Understanding stands in for accumulation at a bottleneck. A caller that
    // has no root to hand (an NPC stub) simply gets no substitution rather
    // than an error - the effect is opt-in by having the data, never assumed.
    const substitution =
        cultivator.spiritRoot === undefined
            ? { substituted: 0 }
            : bottleneckSubstitution(
                  cultivator as Parameters<typeof bottleneckSubstitution>[0],
                  ctx.relevance
              );
    const available = cultivator.cultivationProgress + substitution.substituted;
    const base = {
        progressRequired: required,
        progressAvailable: available,
        progressAccumulated: cultivator.cultivationProgress,
        progressSubstituted: substitution.substituted
    };

    if (!cultivator.alive) {
        return { eligible: false, reason: 'dead', ...base };
    }
    // The Lid does not open twice for the same name. A False Immortal is
    // REFUSED, not merely made unlikely - this is a hard engine gate, and it is
    // the whole reason False Immortal is a status rather than a setback.
    if (hasCrossedTheLid(cultivator.immortalStatus ?? 'none')) {
        return { eligible: false, reason: 'barred:the_lid_opened_once', ...base };
    }
    if (cultivator.realmOrdinal >= MAX_ORDINAL) {
        return { eligible: false, reason: 'at_ladder_summit', ...base };
    }
    if ((ctx.ranksGainedThisTurn ?? 0) >= MAX_RANKS_PER_TURN) {
        return { eligible: false, reason: 'rank_cap_reached_this_turn', ...base };
    }
    if (available < required) {
        return { eligible: false, reason: 'insufficient_progress', ...base };
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
 * Compute the odds without rolling. Exposed separately so the UI can show a
 * player what they are about to do before they commit to doing it - which in a
 * permadeath game is the difference between a tragedy and a bug report.
 */
export function computeBreakthroughOdds(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'spiritRoot' | 'attributes' | 'injuries'> &
        Partial<Pick<Cultivator, 'foundationQuality' | 'insights'>>,
    ctx: Pick<BreakthroughContext, 'ambient' | 'pill'> & { relevance?: Partial<RelevanceContext> }
): BreakthroughOdds {
    const ordinal = cultivator.realmOrdinal;
    const boundary = isRealmBoundary(ordinal);
    const root = getSpiritRoot(cultivator.spiritRoot);
    const injuries = aggregateInjuryPenalties(cultivator.injuries);
    const foundation = foundationOf(cultivator);
    const tempering = scarTempering(cultivator.injuries);
    const understanding = understandingEffects(cultivator.insights ?? [], {
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

    if (ctx.pill) {
        modifiers.push({
            source: `pill:${ctx.pill.name}`,
            delta: Math.max(0, Math.min(MAX_PILL_BONUS, ctx.pill.potency))
        });
    }

    const raw = modifiers.reduce((sum, m) => sum + m.delta, 0);
    const clamped = Math.max(MIN_BREAKTHROUGH_CHANCE, Math.min(MAX_BREAKTHROUGH_CHANCE, raw));

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
> & Partial<Pick<Cultivator, 'foundationQuality' | 'name' | 'insights' | 'immortalStatus'>>;

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
    const succeeded = roll < odds.finalChance;

    if (!succeeded) {
        return resolveFailure(ctx, { fromOrdinal, required, odds, roll });
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
        injuriesSustained: frame.injuries,
        progressConsumed: frame.required,
        tribulation: frame.tribulation,
        toll,
        foundationEstablished,
        // Only the last crossing confers a status, and it does not route
        // through here - it has its own resolution.
        immortalStatusGained: null,
        narrationHint:
            `Breakthrough succeeded: ${rankName(fromOrdinal)} to ${rankName(toOrdinal)}` +
            `${odds.isBoundary ? ', crossing into a new realm' : ''}. ` +
            `Odds were ${(odds.finalChance * 100).toFixed(1)}%.` +
            foundationHint +
            tollHint
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

function resolveFailure(ctx: BreakthroughContext, frame: AttemptFrame): BreakthroughResult {
    const table = frame.odds.isBoundary ? FAILURE_TABLE.boundary : FAILURE_TABLE.subRank;
    const severityRoll = ctx.rng.next();

    let outcome: BreakthroughFailure;
    if (severityRoll < table.stable) outcome = 'failure_stable';
    else if (severityRoll < table.injured) outcome = 'failure_injured';
    else if (severityRoll < table.deviation) outcome = 'failure_deviation';
    else outcome = 'death';

    const injuries: Injury[] = [];
    if (outcome === 'failure_injured' || outcome === 'failure_deviation' || outcome === 'death') {
        const severity = failureInjurySeverity(outcome, frame.odds.isBoundary, ctx.rng);
        injuries.push(
            createInjury(
                {
                    severity,
                    source: outcome === 'failure_deviation' ? 'qi_deviation' : 'failed_breakthrough',
                    turn: ctx.turn
                },
                ctx.rng
            )
        );
    }

    const progressConsumed = frame.required * FAILURE_PROGRESS_LOSS[outcome];

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
        narrationHint: failureNarration(outcome, frame, injuries)
    };
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
    const injuries = aggregateInjuryPenalties(cultivator.injuries);
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
            injuries.push(
                createInjury(
                    {
                        severity: failedStrikes >= TRIBULATION_LETHAL_STRIKES ? 'crippling' : 'serious',
                        source: 'tribulation',
                        turn: ctx.turn,
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
    const injuries = aggregateInjuryPenalties(cultivator.injuries);

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
            narrationHint:
                `${weathered} The crossing completed: ${rankName(MAX_ORDINAL)}. ${toll.narrationHint}`
        };
    }

    // ── False Immortal. Survived, opened the Lid, did not go through. ──
    // The ordinal does not move. Something is taken regardless of any roll,
    // because "incomplete in a way that shows" is a fact of the setting and
    // never nothing.
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
        toOrdinal: frame.fromOrdinal,
        finalChance: frame.odds.finalChance,
        modifiers,
        roll: frame.roll,
        injuriesSustained: injuries,
        progressConsumed: frame.required,
        tribulation: { strikes, survived: true },
        toll,
        foundationEstablished: null,
        immortalStatusGained: 'false_immortal',
        narrationHint:
            `${weathered} The crossing did not complete. What is left stays on this side of the Lid, ` +
            `permanently: a False Immortal, barred from ever attempting again. ${toll.narrationHint}`
    };
}
