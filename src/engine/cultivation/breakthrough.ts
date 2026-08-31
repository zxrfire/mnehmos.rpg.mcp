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
    REALM_TIERS,
    baseBreakthroughChance,
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
 * Heavenly tribulation: strikes escalate as the cultivator climbs the final
 * realm, indexed by the DESTINATION ordinal rather than the origin.
 *
 * The 40 -> 41 crossing INTO Tribulation Transcendence is the lightest
 * tribulation at 3 strikes, then 4, 5 and 6 for the steps above it. Indexing
 * on the destination is what puts the lightest tribulation on the boundary
 * crossing, where it belongs: the Lid is deciding for the first time whether
 * this cultivator is worth the ash it will cost to seal behind them, and it has
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
     * Conditions for the Vault's toll, charged on a SUCCESSFUL realm-boundary
     * crossing. Omitting this does not skip the toll - the Vault does not wait
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
    cultivator: Pick<Cultivator, 'realmOrdinal' | 'spiritRoot' | 'attributes' | 'injuries'> &
        Partial<Pick<Cultivator, 'foundationQuality'>>,
    ctx: Pick<BreakthroughContext, 'ambient' | 'pill'>
): BreakthroughOdds {
    const ordinal = cultivator.realmOrdinal;
    const boundary = isRealmBoundary(ordinal);
    const root = getSpiritRoot(cultivator.spiritRoot);
    const injuries = aggregateInjuryPenalties(cultivator.injuries);
    const foundation = foundationOf(cultivator);
    const tempering = scarTempering(cultivator.injuries);

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
 * reads as 'none'; a missing name means the Vault has nothing legible to take
 * and simply cannot reach for one.
 */
export type BreakthroughSubject = Pick<
    Cultivator,
    'realmOrdinal' | 'cultivationProgress' | 'spiritRoot' | 'attributes' | 'injuries' | 'alive'
> & Partial<Pick<Cultivator, 'foundationQuality' | 'name'>>;

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
 * world charges for a success - the foundation at 12 -> 13 and the Vault's toll
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

    // ── The Vault's instalment, if this crossing is charged. ──
    // Never on a sub-rank step. Always on a boundary, whether or not the caller
    // remembered to supply candidates - the Vault does not wait to be ready.
    let toll: BreakthroughResult['toll'] = null;
    let tollHint = '';
    if (isTolled(fromOrdinal)) {
        toll = evaluateToll(
            {
                realmOrdinal: fromOrdinal,
                attributes: cultivator.attributes,
                name: cultivator.name,
                // The foundation laid by THIS crossing is what the Vault reaches
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
        // A failed crossing is not a crossing. The Vault charges for arriving,
        // not for trying, and a foundation you did not lay has no quality.
        toll: null,
        foundationEstablished: null,
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

/** First ordinal of Tribulation Transcendence: the destination of the 40 -> 41 crossing. */
const TRIBULATION_REALM_START = REALM_TIERS[REALM_TIERS.length - 1].ordinalStart;

/**
 * Lightning strikes an attempt from this ordinal must weather.
 *
 * Counted from the destination: from 40 -> 3 strikes, 41 -> 4, 42 -> 5,
 * 43 -> 6. Returns 0 for an attempt that summons no tribulation at all.
 */
export function tribulationStrikeCount(ordinal: number): number {
    if (!triggersHeavenlyTribulation(ordinal)) return 0;
    const destination = ordinal + 1;
    return TRIBULATION_BASE_STRIKES + (destination - TRIBULATION_REALM_START);
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
            narrationHint:
                `Heavenly tribulation was not survived: ${failedStrikes} of ${strikes} strikes struck home ` +
                `(${(perStrike * 100).toFixed(0)}% survival per strike). The cultivator was destroyed by the lightning.`
        };
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
