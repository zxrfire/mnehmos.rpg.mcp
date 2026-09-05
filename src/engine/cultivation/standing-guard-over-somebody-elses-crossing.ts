/**
 * Standing guard over somebody else's crossing: the dao protector.
 *
 * Protection is a TIE, not a membership. A rogue with three old friends who can
 * matter is better protected than a sect disciple with a hall full of people who
 * do not care, and no branch here reads `factionId`, rank, or standing with a
 * house. The Hollow Court is not a special case in this file and must not become
 * one - it is four people at the top of the ladder who each hold a tie to the
 * other three.
 */

import {
    baseBreakthroughChance,
    isRealmBoundary,
    rankName,
    realmForOrdinal,
    REALM_TIERS,
    triggersHeavenlyTribulation
} from './realms.js';
import type { BreakthroughModifier, BreakthroughOdds } from './breakthrough.js';
import { MAX_PROTECTION_BONUS, MIN_BREAKTHROUGH_CHANCE, maxChanceFor } from './breakthrough.js';
import { createInjury } from './injuries.js';
import { ordinaryWoundFor } from './which-wound-an-ordinary-injury-is.js';
import type { CultivationRNG } from './rng.js';
import type { Injury, InjurySeverity } from '../../schema/cultivation.js';

// TUNING
// Every constant is a design statement. Read the comment before moving one.

/**
 * The most a watch can ever be worth, as a flat modifier.
 */
export { MAX_PROTECTION_BONUS } from './breakthrough.js';

/**
 * The summed protector weight at which HALF the bonus has arrived. One - so a
 * single protector who can fully matter is worth half of what any watch can ever be
 * worth, and the second is worth a third of what the first was.
 */
export const PROTECTION_HALF_AT = 1;

/**
 * What one protector one major realm below the subject contributes.
 */
export const WEIGHT_ONE_REALM_BELOW = 0.35;

/** Major-realm gap at which a protector stops being able to matter. */
export const PROTECTOR_HELPLESS_REALM_GAP = 2;

/**
 * The standing a protector must already hold with the subject before any risk is
 * counted.
 */
export const TRUST_FLOOR = 0.3;

/**
 * How steeply the bar rises with what is being risked.
 */
export const RISK_RAISES_THE_BAR_BY = 3;

/**
 * The chance a protector is hurt standing through the worst thing that arrives, at
 * full exposure.
 */
export const VIGIL_RISK_AT_FULL_EXPOSURE = 0.25;

// WHO CAN STAND, AND FOR WHOM

/**
 * A protector, as the little the engine needs to price one. Deliberately not an
 * `NpcRecord`: the world layer holds those and the cultivation layer must not
 * know about them. The player standing guard for an NPC and an NPC standing
 * guard for the player go through the same three fields.
 */
export interface Protector {
    id: string;
    name: string;
    realmOrdinal: number;
    /**
     * Their standing with the subject, -1 to +1, read off the tie that already
     * exists between them. Never invented for the occasion - see
     * {@link wouldStandGuard}.
     */
    standing: number;
    /**
     * Absolute day the tie between them opened. A protector arrangement is
     * "almost never made between parties who are not already bound by something
     * older than the arrangement", so how old the tie is is a term.
     */
    tieSinceDay?: number;
}

function realmIndexOf(ordinal: number): number {
    const key = realmForOrdinal(ordinal).key;
    return REALM_TIERS.findIndex(t => t.key === key);
}

/**
 * What this protector contributes, 0..1, against this rung.
 */
export function protectorWeight(protectorOrdinal: number, subjectOrdinal: number): number {
    const gap = realmIndexOf(protectorOrdinal) - realmIndexOf(subjectOrdinal);
    if (gap >= 0) return 1;
    if (gap <= -PROTECTOR_HELPLESS_REALM_GAP) return 0;
    return WEIGHT_ONE_REALM_BELOW;
}

/**
 * How exposed a protector is to what comes down, 0..1.
 */
export function vigilExposure(protectorOrdinal: number, subjectOrdinal: number): number {
    const gap = realmIndexOf(protectorOrdinal) - realmIndexOf(subjectOrdinal);
    if (gap >= 1) return 0.25;
    if (gap === 0) return 0.5;
    return 1;
}

/** How much of the worst case a crossing at this rung actually summons, 0..1. */
export function whatArrivesAt(subjectOrdinal: number): number {
    if (triggersHeavenlyTribulation(subjectOrdinal)) return 1;
    if (isRealmBoundary(subjectOrdinal)) return 0.4;
    return 0.1;
}

export interface GuardAnswer {
    willing: boolean;
    /** What was actually asked of them, 0..1. The risk half of the decision. */
    riskAsked: number;
    /** The standing this arrangement required. */
    standingRequired: number;
    /** Null when willing. Otherwise the plain reason, for a refusal to be data. */
    reason: 'cannot_matter' | 'not_bound_closely_enough' | 'tie_too_new' | null;
}

/** How old a tie has to be before it can carry a protector arrangement. */
export const TIE_MUST_PREDATE_BY_DAYS = 365 * 10;

/**
 * Would this person stand guard, and if not, why not.
 */
export function wouldStandGuard(protector: Protector, subjectOrdinal: number, onDay?: number): GuardAnswer {
    const weight = protectorWeight(protector.realmOrdinal, subjectOrdinal);
    const riskAsked = VIGIL_RISK_AT_FULL_EXPOSURE
        * whatArrivesAt(subjectOrdinal)
        * vigilExposure(protector.realmOrdinal, subjectOrdinal);
    const standingRequired = Math.min(1, TRUST_FLOOR + riskAsked * RISK_RAISES_THE_BAR_BY);

    if (weight <= 0) {
        return { willing: false, riskAsked, standingRequired, reason: 'cannot_matter' };
    }
    if (protector.standing < standingRequired) {
        return { willing: false, riskAsked, standingRequired, reason: 'not_bound_closely_enough' };
    }
    if (
        protector.tieSinceDay !== undefined && onDay !== undefined &&
        onDay - protector.tieSinceDay < TIE_MUST_PREDATE_BY_DAYS
    ) {
        return { willing: false, riskAsked, standingRequired, reason: 'tie_too_new' };
    }
    return { willing: true, riskAsked, standingRequired, reason: null };
}

// WHAT A WATCH IS WORTH

export interface Watch {
    /** Everybody who actually stood. Whoever refused is not in here. */
    protectors: readonly Protector[];
}

/** The summed contribution of a watch, in protector-weights. */
export function watchWeight(watch: Watch, subjectOrdinal: number): number {
    return watch.protectors.reduce(
        (sum, p) => sum + protectorWeight(p.realmOrdinal, subjectOrdinal), 0);
}

/**
 * What a watch is worth to an attempt, in [0, MAX_PROTECTION_BONUS).
 */
export function protectionBonus(watch: Watch, subjectOrdinal: number): number {
    const weight = watchWeight(watch, subjectOrdinal);
    if (weight <= 0) return 0;
    return MAX_PROTECTION_BONUS * (weight / (weight + PROTECTION_HALF_AT));
}

/**
 * The watch as a line in the odds ledger, or null where it buys nothing.
 */
export function protectionModifier(watch: Watch, subjectOrdinal: number): BreakthroughModifier | null {
    const delta = protectionBonus(watch, subjectOrdinal);
    if (delta <= 0) return null;
    const who = watch.protectors
        .filter(p => protectorWeight(p.realmOrdinal, subjectOrdinal) > 0)
        .map(p => p.name);
    return { source: `dao_protection:${who.join(', ')}`, delta };
}

/**
 * Fold a watch into an already-computed set of odds.
 */
export function foldProtectionIntoOdds(
    odds: BreakthroughOdds,
    watch: Watch,
    subjectOrdinal: number
): BreakthroughOdds {
    const line = protectionModifier(watch, subjectOrdinal);
    if (!line) return odds;

    const modifiers = odds.modifiers.concat(line);
    const raw = odds.finalChance + line.delta;
    const clamped = Math.max(
        MIN_BREAKTHROUGH_CHANCE,
        Math.min(maxChanceFor(subjectOrdinal), raw)
    );
    if (clamped !== raw) {
        modifiers.push({
            source: clamped > raw ? 'clamp:floor' : 'clamp:ceiling',
            delta: clamped - raw
        });
    }
    return { ...odds, finalChance: clamped, modifiers };
}

// WHAT IT COSTS THE PERSON STANDING THERE

export interface VigilCost {
    protectorId: string;
    /**
     * Days spent standing there. The protector's own climb does not advance
     * across them - not by a penalty applied here, but because they are not
     * cultivating, which the caller expresses by simply not advancing them.
     */
    vigilDays: number;
    /** Chance of taking a wound for somebody else, 0..1. */
    woundChance: number;
    /** What that wound would be if it lands. */
    woundSeverity: InjurySeverity;
    /**
     * What the subject now owes, as a standing gain on the protector's side of
     * a tie the world layer writes. Not applied here; this layer has no ties.
     */
    obligation: { note: string; standingGain: number };
}

/**
 * The most a single vigil can move a tie.
 */
export const MAX_OBLIGATION_GAIN = 0.3;

/**
 * What standing guard costs the person doing it.
 */
export function standingGuardCost(
    protector: Protector,
    subjectOrdinal: number,
    vigilDays: number
): VigilCost {
    const arrives = whatArrivesAt(subjectOrdinal);
    const exposure = vigilExposure(protector.realmOrdinal, subjectOrdinal);
    const woundChance = VIGIL_RISK_AT_FULL_EXPOSURE * arrives * exposure;
    // How bad it is if it lands is the product of the same two things the
    // chance is, and not the exposure alone: standing a realm below a sub-rank
    // step is the most exposed anybody can be to almost nothing at all.
    const share = arrives * exposure;
    return {
        protectorId: protector.id,
        vigilDays: Math.max(0, Math.floor(vigilDays)),
        woundChance,
        woundSeverity: share >= 0.5 ? 'crippling' : share >= 0.2 ? 'serious' : 'minor',
        obligation: {
            note: `Stood guard over their crossing at ${rankName(subjectOrdinal)}.`,
            standingGain: MAX_OBLIGATION_GAIN * arrives
        }
    };
}

export interface VigilOutcome {
    cost: VigilCost;
    /** What they actually took. Empty is the usual answer. */
    injuries: Injury[];
}

/**
 * Roll what the watch actually cost, once per protector.
 */
export function resolveVigil(
    watch: Watch,
    subjectOrdinal: number,
    rng: CultivationRNG,
    turn: number,
    vigilDays: number
): VigilOutcome[] {
    return watch.protectors.map(protector => {
        const cost = standingGuardCost(protector, subjectOrdinal, vigilDays);
        const hurt = rng.next() < cost.woundChance;
        return {
            cost,
            injuries: hurt
                ? [createInjury(
                    {
                        severity: cost.woundSeverity,
                        source: 'tribulation',
                        turn,
                        woundType: ordinaryWoundFor('tribulation', cost.woundSeverity),
                        description:
                            `Took part of what came down for somebody else's crossing at ` +
                            `${rankName(subjectOrdinal)}.`
                    },
                    rng
                )]
                : []
        };
    });
}

/**
 * What a watch is worth stated as a ratio, for a display that wants to say it in
 * words rather than in a delta.
 */
export function protectionAsAShareOfTheBase(watch: Watch, subjectOrdinal: number): number {
    const base = baseBreakthroughChance(subjectOrdinal);
    if (base <= 0) return 0;
    return protectionBonus(watch, subjectOrdinal) / base;
}
