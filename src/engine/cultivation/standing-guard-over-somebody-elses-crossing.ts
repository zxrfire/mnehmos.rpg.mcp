/**
 * Standing guard over somebody else's crossing: the dao protector.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THIS IMPLEMENTS SOMETHING THE SETTING ALREADY CLAIMED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `data/cultivation/crossings.ts` has described dao protection for as long as it
 * has existed, in `DAO_PROTECTOR`, `CROSSING_PRACTICE` and
 * `HOLLOW_COURT_COLLABORATION`, and the engine had no mechanic for it. That is
 * the failure mode AGENTS.md names: a claim the lore makes and the engine
 * ignores is worse than one nobody made. Everything below is that authored
 * material turned into arithmetic, and where the two would disagree the prose is
 * what gives.
 *
 * The four claims, and what each one is here:
 *
 *   "The cultivator is entirely committed and entirely helpless for the
 *    duration and cannot defend themselves. A protector is the only defence
 *    that exists."
 *        -> a positive, labelled term in the odds breakdown. See
 *           {@link protectionBonus}.
 *
 *   "The protector must be strong enough to matter against whatever arrives."
 *        -> what a protector contributes is their own standing relative to the
 *           rung being attempted, in major realms, at exactly the gap the combat
 *           layer already calls not-a-fight. Two realms below and they
 *           contribute nothing at all. See {@link protectorWeight}.
 *
 *   "They must be willing to spend that on somebody else's advancement rather
 *    than their own, and be physically present for the whole of it."
 *        -> {@link standingGuardCost}. The vigil is days the protector does not
 *           spend on their own climb, plus a real chance of taking what came
 *           down for somebody else.
 *
 *   "A protector arrangement is almost never made between parties who are not
 *    already bound by something older than the arrangement."
 *        -> {@link wouldStandGuard}. The standing a protector must already hold
 *           with the subject rises with what they are being asked to risk, so at
 *           a low wall a friend will do it and at the last crossing only
 *           somebody who would die for you will. Nothing else gates it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THERE IS NO FACTION ANYWHERE IN THIS FILE, AND THAT IS THE POINT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Protection is a tie, not a membership. A rogue with three old friends who can
 * matter is better protected than a sect disciple with a hall full of people who
 * do not care, and no branch here reads `factionId`, rank, or standing with a
 * house. What a house actually buys is the same thing it buys everywhere else:
 * proximity to people strong enough to be worth having, and the odds of one of
 * them owing you something. The Hollow Court is not a special case in this file
 * and must not become one - it is four people at the top of the ladder who each
 * hold a tie to the other three, which is what
 * `HOLLOW_COURT_COLLABORATION.whyNobodyElseCanCopyIt` already says it is.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE DOES NOT MODEL
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The betrayal. `DAO_PROTECTOR.theBetrayal` keeps one instance in seventeen
 * hundred years, and the reason it is not here is that it is not a term in
 * anybody's odds - it is one person killing another, which `combat.ts` already
 * resolves, against a target who cannot act. The missing piece is a helpless
 * defender in the combat layer, and that is a combat-layer question rather than
 * this one's. Until it exists, an engine-driven protector cannot turn, and the
 * arrangement is safer than the setting says it is. Written down here rather
 * than left to be discovered, because an absence nobody recorded gets mistaken
 * for a design decision.
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

// ─────────────────────────────────────────────────────────────────────────
// TUNING
// Every constant is a design statement. Read the comment before moving one.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The most a watch can ever be worth, as a flat modifier.
 *
 * MOVED to `breakthrough.ts` and re-exported here, because it is a constant in
 * CHANCE units and its own argument sizes it against terms that live in that
 * file's ledger - a spirit root at +0.06, a boundary at -0.08, the overflow cap
 * at +0.15. `computeBreakthroughOdds` now books the watch's line itself and
 * cannot import this module without closing a cycle, so the constant sits with
 * the other numbers in its own unit and the concept stays here.
 *
 * Re-exported rather than relocated in name: every existing reader of
 * `MAX_PROTECTION_BONUS` from this module keeps working, and this is where
 * somebody looking for what a watch is worth will come.
 */
export { MAX_PROTECTION_BONUS } from './breakthrough.js';

/**
 * The summed protector weight at which HALF the bonus has arrived. One - so a
 * single protector who can fully matter is worth half of what any watch can
 * ever be worth, and the second is worth a third of what the first was.
 *
 * The same saturating shape as `overflowBonus`, for the same reason: it
 * approaches the ceiling and never reaches it, so there is no number of
 * protectors at which somebody has "finished" arranging a watch. It also states
 * the thing the Hollow Court demonstrates - three protectors are better than one
 * and not three times better, and the hard part was always getting the first.
 */
export const PROTECTION_HALF_AT = 1;

/**
 * What one protector one major realm below the subject contributes.
 *
 * `combat.ts` calls one realm below "outmatched and can be overturned by
 * someone who brought something", and two realms below not a fight at all. Both
 * readings are used here unchanged: a protector one realm down is worth about a
 * third of one who is level, and a protector two realms down is worth nothing,
 * which is `HELPLESS_REALM_GAP` doing the same job it does everywhere else.
 */
export const WEIGHT_ONE_REALM_BELOW = 0.35;

/** Major-realm gap at which a protector stops being able to matter. */
export const PROTECTOR_HELPLESS_REALM_GAP = 2;

/**
 * The standing a protector must already hold with the subject before any risk
 * is counted.
 *
 * 0.3 is where the world's own "serves under" ties sit. Below it there is no
 * arrangement to make at any wall; above it, what decides is how much is being
 * asked, which is the term that follows.
 */
export const TRUST_FLOOR = 0.3;

/**
 * How steeply the bar rises with what is being risked.
 *
 * Three, and the reason is the spread it produces against the ties the world
 * actually writes. At the first realm boundary the bar sits around 0.45, so an
 * ally, a kinsman or a master will stand and somebody who merely serves in the
 * same hall will not. At the last crossing it sits around 0.68, which is above
 * every ally tie the world produces and below a parent, a child or a spouse -
 * and for a protector standing a full realm below the attempt it goes past 1,
 * so nobody in the world qualifies at all.
 *
 * That is `DAO_PROTECTOR.whyAlmostNobodyHasOne` and
 * `theBetrayal.whyItStillMatters` falling out of one line rather than out of a
 * rule per realm: the arrangement is made between parties bound by something
 * older than it, and at the top the only bond that is old enough is family.
 */
export const RISK_RAISES_THE_BAR_BY = 3;

/**
 * The chance a protector is hurt standing through the worst thing that arrives,
 * at full exposure.
 *
 * Not a second tribulation system. The strikes are resolved for the subject by
 * `resolveTribulation`, which is the only place lightning is counted; this is
 * the separate and much smaller question of whether somebody standing beside it
 * takes some. A protector who is hurt takes an ordinary wound through the same
 * `createInjury` path everybody else does and dies, if they die, the way anybody
 * dies - by carrying too many. There is no protector death branch anywhere.
 */
export const VIGIL_RISK_AT_FULL_EXPOSURE = 0.25;

// ─────────────────────────────────────────────────────────────────────────
// WHO CAN STAND, AND FOR WHOM
// ─────────────────────────────────────────────────────────────────────────

/**
 * A protector, as the little the engine needs to price one.
 *
 * Deliberately not an `NpcRecord`: the world layer holds those and the
 * cultivation layer must not know about them. The player standing guard for an
 * NPC and an NPC standing guard for the player go through the same three fields.
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
 *
 * Counted in major realms rather than ordinals, because that is the unit the
 * setting is built in and the unit the combat layer already reads gaps in. The
 * comparison is against the SUBJECT's rung and not against the other
 * protectors, because what has to be survived is calibrated to the person
 * crossing: "strong enough to matter against whatever arrives" is a statement
 * about what arrives, and what arrives is the subject's.
 */
export function protectorWeight(protectorOrdinal: number, subjectOrdinal: number): number {
    const gap = realmIndexOf(protectorOrdinal) - realmIndexOf(subjectOrdinal);
    if (gap >= 0) return 1;
    if (gap <= -PROTECTOR_HELPLESS_REALM_GAP) return 0;
    return WEIGHT_ONE_REALM_BELOW;
}

/**
 * How exposed a protector is to what comes down, 0..1.
 *
 * The mirror of the weight and not the same number. Standing level with the
 * attempt is dangerous; standing a realm below it is far more dangerous, because
 * the thing arriving was never calibrated for you. Somebody a realm ABOVE is
 * exposed least, which is why the one arrangement the world can point at is four
 * people who are all at the top.
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
 *
 * A refusal is data and is returned as data. `DAO_PROTECTOR.theBetrayal` says
 * the one recorded treachery "is quoted by every cultivator who declines to
 * guard somebody", so declining is an ordinary, expected, sayable thing, and the
 * reason a house's strongest member said no is exactly the kind of fact a
 * narrator should be able to render without inventing it.
 *
 * The bar rises with what is being asked. That single line produces the whole
 * social shape the setting describes without a rule per realm: at a low wall
 * almost any ally will stand, and at the last crossing the standing required
 * approaches what only somebody who would die for you holds.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT A WATCH IS WORTH
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * Saturating rather than capped, so there is no number of protectors at which
 * the arrangement is finished and each additional one is worth measurably less
 * than the last.
 */
export function protectionBonus(watch: Watch, subjectOrdinal: number): number {
    const weight = watchWeight(watch, subjectOrdinal);
    if (weight <= 0) return 0;
    return MAX_PROTECTION_BONUS * (weight / (weight + PROTECTION_HALF_AT));
}

/**
 * The watch as a line in the odds ledger, or null where it buys nothing.
 *
 * Labelled with who stood, because the whole point of the breakdown is that a
 * player can read where a number came from, and "somebody was standing there"
 * is not an answer to that when the identity of the somebody is the entire
 * mechanic.
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
 *
 * THIS IS THE INTEGRATION POINT AND IT IS DELIBERATELY OUTSIDE
 * `computeBreakthroughOdds`. Written as a fold rather than as a parameter so
 * that the odds path stays exactly what it was for every caller that has no
 * watch, and so this module owns its own arithmetic. The one-line version -
 * a `ctx.watch` term booked beside `accumulated_overflow` - is strictly nicer
 * and belongs to whoever owns that file next.
 *
 * The identity the ledger rests on is preserved: `sum(modifiers)` still equals
 * `finalChance` exactly, because the term is appended and the re-clamp is booked
 * as its own line the same way `computeBreakthroughOdds` books its own. Nothing
 * earlier in the list is rewritten, which matters because the pill term
 * multiplies a mid-list clamp that must keep meaning what it meant.
 *
 * A watch cannot push an attempt past the rung's ceiling. That is correct and it
 * is the honest limit on the mechanic: protection buys a crossing that is not
 * interfered with, and there was never a wall that a guard could open.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT COSTS THE PERSON STANDING THERE
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * `DAO_PROTECTOR.theTrust` calls accepting a protector the most complete trust
 * available in this world. Having extended it and had it honoured is the largest
 * single thing that can happen to a relationship, and it is sized to say so: one
 * watch at the last crossing takes an ally to somebody who would die for you.
 */
export const MAX_OBLIGATION_GAIN = 0.3;

/**
 * What standing guard costs the person doing it.
 *
 * `vigilDays` is supplied rather than derived. The engine has no single figure
 * for how long a crossing takes and this file is not the place to invent one -
 * the caller is spending that span on the subject already and knows it.
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
 *
 * Seeded and pure. One sample per protector whatever it decides, so the number
 * of draws depends only on how many stood - the same stream discipline
 * `resolveTribulation` keeps, and for the same reason.
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
 * What a watch is worth stated as a ratio, for a display that wants to say it
 * in words rather than in a delta.
 *
 * Reads the base chance rather than the full odds on purpose: "a watch like this
 * is worth about half again on a crossing at this rung" is a fact about the rung
 * and the watch, not about how injured the person happens to be today.
 */
export function protectionAsAShareOfTheBase(watch: Watch, subjectOrdinal: number): number {
    const base = baseBreakthroughChance(subjectOrdinal);
    if (base <= 0) return 0;
    return protectionBonus(watch, subjectOrdinal) / base;
}
