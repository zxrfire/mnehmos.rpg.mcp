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
 *     must be able to print "0.33 base, -0.06 injuries, +0.09 fortune" without
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
 * Tribulation Transcendence (ordinals 41-44) adds heavenly lightning on top:
 * the primary roll gets you to the tribulation, and then a multi-strike
 * sequence decides whether you survive having gotten there.
 */

import {
    MAX_RANKS_PER_TURN,
    type AmbientQi,
    type BreakthroughOutcome,
    type BreakthroughResult,
    type Cultivator,
    type Injury,
    type InjurySeverity
} from '../../schema/cultivation.js';
import {
    MAX_ORDINAL,
    baseBreakthroughChance,
    isRealmBoundary,
    progressRequiredForOrdinal,
    rankName,
    triggersHeavenlyTribulation,
    realmForOrdinal
} from './realms.js';
import { getSpiritRoot, type SpiritRootGrade } from './spirit-roots.js';
import { ambientBreakthroughMod } from './ambient.js';
import { aggregateInjuryPenalties, createInjury } from './injuries.js';
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
 * Fortune is pure luck and may legally be 0, so it is a one-sided bonus rather
 * than a centred modifier: 0 to +0.09. A player with Fortune 0 is not cursed,
 * they simply never get the gift.
 */
export const FORTUNE_PER_POINT = 0.03;

/** Extra strain at a realm boundary, on top of the 0.45x already in the base. */
export const REALM_BOUNDARY_STRAIN = -0.08;

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
export const FAILURE_PROGRESS_LOSS: Record<Exclude<BreakthroughOutcome, 'success'>, number> = {
    failure_stable: 0.25,
    failure_injured: 0.5,
    failure_deviation: 0.75,
    death: 1
};

/**
 * Heavenly tribulation: strikes escalate through the final realm. Early gets 3,
 * Perfection would get 6 - though ordinal 44 is the top of the ladder and never
 * attempts anything, so 41/42/43 give 3/4/5 in practice.
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
}

export interface EligibilityCheck {
    eligible: boolean;
    /** Machine-readable reason when ineligible; null when eligible. */
    reason: string | null;
    progressRequired: number;
    progressAvailable: number;
}

/**
 * Whether an attempt is legal at all. Callers - especially the time-skip -
 * should consult this instead of catching the throw from `attemptBreakthrough`.
 */
export function canAttemptBreakthrough(
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'cultivationProgress' | 'alive'>,
    ctx: Pick<BreakthroughContext, 'ranksGainedThisTurn'> = {}
): EligibilityCheck {
    const required = progressRequiredForOrdinal(cultivator.realmOrdinal);
    const base = {
        progressRequired: required,
        progressAvailable: cultivator.cultivationProgress
    };

    if (!cultivator.alive) {
        return { eligible: false, reason: 'dead', ...base };
    }
    if (cultivator.realmOrdinal >= MAX_ORDINAL) {
        return { eligible: false, reason: 'at_ladder_summit', ...base };
    }
    if ((ctx.ranksGainedThisTurn ?? 0) >= MAX_RANKS_PER_TURN) {
        return { eligible: false, reason: 'rank_cap_reached_this_turn', ...base };
    }
    if (cultivator.cultivationProgress < required) {
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
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'spiritRoot' | 'attributes' | 'injuries'>,
    ctx: Pick<BreakthroughContext, 'ambient' | 'pill'>
): BreakthroughOdds {
    const ordinal = cultivator.realmOrdinal;
    const boundary = isRealmBoundary(ordinal);
    const root = getSpiritRoot(cultivator.spiritRoot);
    const injuries = aggregateInjuryPenalties(cultivator.injuries);

    const modifiers: BreakthroughModifier[] = [];

    // The base already folds in the ladder's own boundary tax; the label says so.
    modifiers.push({
        source: `base:${rankName(ordinal)}`,
        delta: baseBreakthroughChance(ordinal)
    });

    if (boundary) {
        modifiers.push({ source: 'realm_boundary_strain', delta: REALM_BOUNDARY_STRAIN });
    }

    modifiers.push({
        source: `spirit_root:${root.key}`,
        delta: BREAKTHROUGH_ROOT_MOD[root.grade]
    });

    modifiers.push({
        source: 'insight',
        delta: (cultivator.attributes.insight - INSIGHT_PIVOT) * INSIGHT_PER_POINT
    });

    modifiers.push({
        source: 'fortune',
        delta: cultivator.attributes.fortune * FORTUNE_PER_POINT
    });

    modifiers.push({
        source: `ambient_qi:${ctx.ambient}`,
        delta: ambientBreakthroughMod(ctx.ambient)
    });

    if (injuries.untreatedCount > 0) {
        modifiers.push({
            source: `untreated_injuries:${injuries.untreatedCount}`,
            delta: -injuries.breakthroughPenalty
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
export function attemptBreakthrough(
    cultivator: Pick<
        Cultivator,
        'realmOrdinal' | 'cultivationProgress' | 'spiritRoot' | 'attributes' | 'injuries' | 'alive'
    >,
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

    // Roll order is fixed: primary first, then severity/tribulation. A stream
    // keyed to (seed, 'breakthrough', turn) therefore replays identically.
    const roll = ctx.rng.next();
    const succeeded = roll < odds.finalChance;

    if (!succeeded) {
        return resolveFailure(ctx, { fromOrdinal, required, odds, roll });
    }

    // ── Success path. Tribulation ordinals still have to survive the sky. ──
    if (triggersHeavenlyTribulation(fromOrdinal)) {
        return resolveTribulation(cultivator, ctx, { fromOrdinal, required, odds, roll });
    }

    return {
        outcome: 'success',
        fromOrdinal,
        toOrdinal: fromOrdinal + 1,
        finalChance: odds.finalChance,
        modifiers: odds.modifiers,
        roll,
        injuriesSustained: [],
        progressConsumed: required,
        tribulation: null,
        narrationHint:
            `Breakthrough succeeded: ${rankName(fromOrdinal)} to ${rankName(fromOrdinal + 1)}` +
            `${odds.isBoundary ? ', crossing into a new realm' : ''}. ` +
            `Odds were ${(odds.finalChance * 100).toFixed(1)}%.`
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

    let outcome: Exclude<BreakthroughOutcome, 'success'>;
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
        narrationHint: failureNarration(outcome, frame, injuries)
    };
}

/**
 * A failure at a realm boundary escalates the wound table. Failing to form a
 * golden core does not sprain something; it breaks what you were forming it
 * from.
 */
function failureInjurySeverity(
    outcome: Exclude<BreakthroughOutcome, 'success' | 'failure_stable'>,
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
    outcome: Exclude<BreakthroughOutcome, 'success'>,
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

/** Number of lightning strikes an attempt from this ordinal must weather. */
export function tribulationStrikeCount(ordinal: number): number {
    const tier = realmForOrdinal(ordinal);
    return TRIBULATION_BASE_STRIKES + (ordinal - tier.ordinalStart);
}

/** Per-strike survival probability, before any strike is rolled. */
export function tribulationStrikeSurvival(
    cultivator: Pick<Cultivator, 'attributes' | 'injuries'>,
    ambient: AmbientQi
): number {
    const injuries = aggregateInjuryPenalties(cultivator.injuries);
    const raw =
        TRIBULATION_BASE_SURVIVAL +
        cultivator.attributes.fortune * FORTUNE_PER_POINT +
        cultivator.attributes.might * 0.02 +
        ambientBreakthroughMod(ambient) -
        injuries.breakthroughPenalty;
    return Math.max(MIN_TRIBULATION_SURVIVAL, Math.min(MAX_TRIBULATION_SURVIVAL, raw));
}

function resolveTribulation(
    cultivator: Pick<Cultivator, 'attributes' | 'injuries'>,
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

    return {
        outcome: survived ? 'success' : 'death',
        fromOrdinal: frame.fromOrdinal,
        toOrdinal: survived ? frame.fromOrdinal + 1 : frame.fromOrdinal,
        finalChance: frame.odds.finalChance,
        modifiers: frame.odds.modifiers,
        roll: frame.roll,
        injuriesSustained: injuries,
        progressConsumed: frame.required,
        tribulation: { strikes, survived },
        narrationHint: survived
            ? `Heavenly tribulation weathered: ${strikes} strikes, ${failedStrikes} struck home ` +
              `(${(perStrike * 100).toFixed(0)}% survival per strike). ` +
              `${rankName(frame.fromOrdinal)} to ${rankName(frame.fromOrdinal + 1)}.`
            : `Heavenly tribulation was not survived: ${failedStrikes} of ${strikes} strikes struck home ` +
              `(${(perStrike * 100).toFixed(0)}% survival per strike). The cultivator was destroyed by the lightning.`
    };
}
