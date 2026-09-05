/**
 * One attempt to work on a person: what it takes, what it costs, and what it
 * leaves behind whether or not it lands.
 *
 * NOTHING HERE READS `Approach.intent`. `actions.ts` forbids branching on it.
 * What is priced is `Approach.leverage`, the closed enum saying what is on the
 * table, so seduction (`attachment`) runs through the same machine as a purse.
 * Nothing reads `factionId` or `alignment` either: charm works everywhere, and
 * what varies by house is the GROUND, a fact about the place. See `ground-trust.ts`.
 *
 * Pure. State in, deltas out, every roll from the caller's seeded stream.
 */

import {
    APPROACH_PATIENCE_EFFECT,
    type Approach,
    type ApproachLeverage,
    type SectAlignment
} from '../../schema/cultivation.js';
import { earningsPerYear } from '../cultivation/origin.js';
import { regardFor } from '../cultivation/regard.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import type { ObligationInput, ObligationRecord, Severity } from '../social/grudges.js';
import { severityRank } from '../social/grudges.js';
import type {
    Relationship,
    RelationshipEventInput,
    RelationshipType,
    Significance
} from '../social/relationships.js';
import type { DayIndex } from '../social/common.js';
import { groundWeight, type TheGroundUnderYou } from './ground-trust.js';
import { openHandednessOf } from './how-freely-somebody-parts-with-what-they-have.js';

/**
 * How much the thing you want would cost the person you want it from. This and
 * not the verb is what makes an approach hard.
 */
export type AskWeight =
    /** A name, a direction, an introduction. Costs them nothing. */
    | 'a_courtesy'
    /** Time, money, or a word put in somewhere. Costs them something. */
    | 'a_real_favour'
    /** They end up worse off, and they can see that while agreeing. */
    | 'against_their_interest'
    /** It ends them if it is ever found out. */
    | 'a_betrayal';

/** What the ask costs them, as resistance. Read once, in `oddsOf`. */
const ASK_RESISTANCE: Record<AskWeight, number> = {
    a_courtesy: 0.05,
    a_real_favour: 0.25,
    against_their_interest: 0.5,
    a_betrayal: 0.75
} as const;

/** Days an attempt at this weight consumes before patience is applied. */
const ASK_DAYS: Record<AskWeight, number> = {
    a_courtesy: 1,
    a_real_favour: 3,
    against_their_interest: 14,
    /** A season and a half: nobody is talked into ending themselves in an afternoon. */
    a_betrayal: 45
} as const;

/**
 * Leverage you would rather nobody saw change hands. A name and a sect are
 * absent because you brought those along precisely so the room would see them.
 */
const DISCREET_LEVERAGE: readonly ApproachLeverage[] = Object.freeze([
    'coin', 'secret', 'attachment'
] as const);

/** Added resistance when discreet leverage is put down in front of people. */
const AUDIENCE_RESISTANCE: Record<NonNullable<Approach['audience']>, number> = {
    alone: 0,
    few: 0.05,
    crowd: 0.15,
    peers: 0.2,
    superiors: 0.25,
    enemies: 0.3
} as const;

/**
 * Where an attempt starts before anything about these two people is read.
 * Deliberately below even: the default answer to a stranger is no.
 */
const BASE_ODDS = 0.35;

/** Per point of charm away from the middle of its 1..3 range. */
const CHARM_PER_POINT = 0.06;

/** Per rung of social gap, clamped. The dominant term. */
const PER_RUNG = 0.05;
const RUNG_CLAMP = 6;

/** Their existing view of you, at full strength. */
const TIE_WEIGHT = 0.3;

/** Per open favour or debt they carry your way, up to three. */
const OWED_PER_RECORD = 0.08;
const OWED_CAP = 3;

/** An open grudge they hold, by its stored severity. */
const GRUDGE_BASE = 0.1;
const GRUDGE_PER_RANK = 0.1;

/** They have an open goal you are in a position to move. */
const THEY_WANT_SOMETHING = 0.15;

// THE PURSE. Priced against the SUBJECT'S own income curve (`earningsPerYear`,
// the one the world seeds every purse from) rather than a table here, so a
// hundred stones is a year of a guard's life and a rounding error to an elder.
// Saturating: doubling an offer already worth ten years moves the odds under a
// percent. And reaching only as far as money reaches in this world -
// `docs/world/things/items.md` holds the line above which "cash is simply not
// the medium. Not 'expensive' - not for sale."

/**
 * The most a purse can ever be worth, before the ask damps it. Deliberately
 * under one realm of standing (`RUNG_CLAMP * PER_RUNG` = 0.3) and under a tie
 * at full strength: money is a term and it is never the term.
 */
const PURSE_MAX = 0.2;

/**
 * The offer, in years of the SUBJECT'S own income, worth half of `PURSE_MAX`.
 * The curve is `years / (years + this)`: three years reaches 0.75 of the
 * ceiling, nine 0.9, ninety-nine 0.99.
 */
const PURSE_HALF_AT_YEARS = 1;

/**
 * How far a purse reaches into what is being asked. Never zero at the far end,
 * because "typically does not" is not "never".
 */
const PURSE_REACH: Record<AskWeight, number> = {
    a_courtesy: 1,
    a_real_favour: 0.6,
    against_their_interest: 0.2,
    a_betrayal: 0.05
} as const;

// DISPOSITION. The design owner's ruling: *"some people are greedy some
// generous, this should be part of their character - kind elders exist just as
// greedy demonic cultivators exist."* One scalar on -1..+1 from
// `openHandednessOf`, multiplied in. Nothing switches on a personality name.

/**
 * The most a disposition can ever be worth, at either end. Above `PURSE_MAX`
 * (who somebody is outweighs a stranger's purse) and well under `TIE_WEIGHT`
 * and a realm of standing, or the world would turn on a coin the player cannot
 * see.
 */
const DISPOSITION_MAX = 0.18;

/**
 * How far being open-handed reaches into what is being asked. It discounts COST,
 * not DANGER, which is why this is a reach table and not a flat multiplier:
 * `AskWeight` runs cost at the bottom and risk at the top, and a generous person
 * hands over the book without being likelier to end their own standing.
 */
const DISPOSITION_REACH: Record<AskWeight, number> = {
    a_courtesy: 0.15,
    a_real_favour: 1,
    against_their_interest: 0.35,
    a_betrayal: 0.1
} as const;

/** Nothing is certain and nothing is impossible. The floor is AGENTS.md's rule. */
const ODDS_FLOOR = 0.02;
const ODDS_CEILING = 0.95;

/** One side of the attempt, read off whatever record the caller holds. */
export interface Party {
    id: string;
    name: string;
    /** Their rung. Read by `regard.ts` and nowhere else in this file. */
    ordinal: number;
    /** 1..3. Absent for a body the caller has no attribute row for. */
    charm?: number;
    factionId: string | null;
    /** Their house's alignment, when they have a house. */
    alignment: SectAlignment | null;
    /** A ranked member has somewhere to take a refusal; a hired hand does not. */
    ranked?: boolean;
    /**
     * How freely this person parts with what they have, on -1..+1. Absent means
     * DRAWN FROM THEIR ID, not neutral - see `dispositionWeight`.
     *
     * Never compute this from an alignment, a faction or a rung. It would read
     * plausibly every time and would break the ruling it exists to serve.
     */
    openHandedness?: number;
}

/**
 * The whole of what this module reads off an existing tie. A full
 * {@link Relationship} satisfies it structurally, and so does the world layer's
 * `NpcRelationship` once its `standing` is floored at zero.
 *
 * Do not drop that link: it is the only thing keeping the `Relationship` import
 * used, and removing it breaks the build under `noUnusedLocals`.
 */
export interface TieReading {
    active: boolean;
    /** 0..1, how consequential. Not warmth, and not derived from anyone's rung. */
    strength: number;
}

export interface AttemptInput {
    actor: Party;
    subject: Party;
    onDay: DayIndex;
    /** What you want out of them. Never the verb they used to ask. */
    ask: AskWeight;
    /** Tone, leverage, audience, patience, a concealed rung. `intent` is never read. */
    approach?: Approach;
    /**
     * The ground the two of them are standing on. Filled by the impure caller
     * (`whoHoldsTheGround`, then `theGroundUnderYou`) because this resolver is
     * pure and may not reach for the world's locations.
     *
     * Absent means the caller does not know where this is, and weighs nothing.
     * Not the same as ground NOBODY holds, which weighs a great deal.
     */
    where?: TheGroundUnderYou | null;
    /**
     * The subject's view of the actor, if there already is one. Nothing here may
     * read `attitude` or `history`: those are narrator prose, not engine input.
     */
    theirTie?: TieReading | null;
    /** The actor's view of the subject, if there already is one. */
    yourTie?: TieReading | null;
    /** The open obligation ledger between these two, in either direction. */
    ledger?: readonly ObligationRecord[];
    /**
     * True when the subject has an open goal this actor could plausibly move.
     * Read off a real goal row - `activeGoals` in `npc-state.ts` via
     * `whatTheyWantThatYouCouldReach` - never off a model's opinion.
     */
    theyWantSomethingFromYou?: boolean;
    /** Spirit stones actually put down. Only spent when the attempt lands. */
    stonesOffered?: number;
    /**
     * How many times this actor has already put THIS ask to THIS subject. Lives
     * with the caller: it is a fact about a pair, not about one attempt.
     */
    timesAskedBefore?: number;
    /**
     * Whether what the actor is asking for cannot wait. Read off the actor's own
     * state, never off how the sentence was phrased. Half of `theRefusalWasWrong`.
     */
    askersNeedIsPressing?: boolean;
    /** The other half: their own claim on it is a maybe rather than a now. */
    theirHoldOnItIsMerelyReserved?: boolean;
    /**
     * Whether saying yes was ever theirs to say. Defaults to yes.
     *
     * The discriminator that keeps a grudge honest. A body that counts a finite
     * stock and needs a quorum to touch it has not wronged anybody by saying no
     * - `immortal-items.ts`: *"there is no version of the problem where the
     * player finds the right person and applies enough pressure."*
     */
    theAnswerWasTheirsToGive?: boolean;
    /**
     * Whether the first roll below is decided rather than sampled. ADMIN's forced
     * verb sets this and nothing else does; the law is in
     * `server/consolidated/forcing-an-attempt-to-land.ts`.
     *
     * It decides ONE question - did they move. Days, stones, whether they turned,
     * the tie, the obligation and the record are all untouched. It does not make
     * an illegal ask legal: whatever refuses before the roll still refuses.
     */
    theAttemptLands?: boolean;
    rng: CultivationRNG;
}

/**
 * `taken` they did it. `turned` they did it and took hold of you, leaving a
 * second record pointing the other way. `countered` no door closed: there is
 * something they want, so the answer is terms. `refused` no. `reported` no, and
 * it reached their house.
 */
export type AttemptOutcome = 'taken' | 'turned' | 'countered' | 'refused' | 'reported';

/** One side of a tie the attempt asks the caller to write. */
export interface TieSide {
    type: RelationshipType;
    strength: number;
    significance: Significance;
    roles: string[];
}

/**
 * The relationship change, both halves, deliberately allowed to disagree - the
 * case `relationships.ts` exists to store: *"he thinks they are friends; she has
 * been waiting nine years for an opening."*
 */
export interface TieMove {
    /** The subject's view of the actor. */
    theirs: TieSide;
    /** The actor's view of the subject. */
    yours: TieSide;
    event: RelationshipEventInput;
}

/**
 * What the world is now carrying that it was not before. Every field is a record
 * the caller persists; nothing here is narration.
 */
export interface AttemptMarks {
    /** They can name what you tried. True on every outcome except a clean take. */
    theyKnowWhatYouTried: boolean;
    /** True when the refusal travelled past the person who made it. */
    reachedTheHouse: boolean;
    /** A grudge, debt or oath the attempt opened. Written as-is. */
    obligation: ObligationInput | null;
    /** The one pointing the other way. On `turned`, this is the whole event. */
    counterObligation: ObligationInput | null;
    tie: TieMove | null;
    /**
     * Set when the tie that formed is not what the other party thinks it is.
     * Nothing has gone wrong yet; `when-somebody-works-out-what-you-did.ts` reads
     * it every time the world advances.
     */
    unspoken: UnspokenTruth | null;
}

/**
 * An attachment that is doing work its holder does not know about. Not a secret
 * in `secrets.ts` - it is what the numbers on the tie already imply, written
 * down so the discovery check has something to read.
 */
export interface UnspokenTruth {
    heldById: string;
    aboutId: string;
    /** How strongly the subject is attached. What they stand to feel. */
    theirStrength: number;
    /** How strongly the actor is. What makes it a lie. */
    yourStrength: number;
    /** The ask that was riding on it, which is what makes it instrumental. */
    ask: AskWeight;
    /** How public the manoeuvre was. Decides who else could work it out. */
    audience: NonNullable<Approach['audience']>;
    formedOnDay: DayIndex;
}

export interface AttemptResult {
    outcome: AttemptOutcome;
    /** The odds the engine actually used, for the mechanical channel. */
    odds: number;
    /** Every term, named, so a probe can print why it went the way it did. */
    terms: Readonly<Record<string, number>>;
    /** Days the attempt consumed. */
    days: number;
    /** Stones actually gone. Zero unless coin was put down and taken. */
    stonesSpent: number;
    marks: AttemptMarks;
    /** Engine-authored factual line. Never narration. */
    line: string;
}

function clamp(n: number, lo: number, hi: number): number {
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}

function round4(n: number): number {
    return Math.round(n * 1e4) / 1e4;
}

/** Open records where the subject owes the actor. Both directions of "owed". */
function owedYourWay(input: AttemptInput): number {
    const ledger = input.ledger ?? [];
    let count = 0;
    for (const record of ledger) {
        if (record.status !== 'open') continue;
        // "A debt is owed by the holder; a favour is owed to them."
        const theyOweAsDebtor =
            record.kind === 'debt' &&
            record.holderId === input.subject.id &&
            record.subjectId === input.actor.id;
        const theyOweAsFavourGiven =
            record.kind === 'favor' &&
            record.holderId === input.actor.id &&
            record.subjectId === input.subject.id;
        if (theyOweAsDebtor || theyOweAsFavourGiven) count++;
    }
    return Math.min(count, OWED_CAP);
}

/** The worst open grudge the subject holds against the actor, or null. */
function grudgeAgainstYou(input: AttemptInput): Severity | null {
    let worst: Severity | null = null;
    for (const record of input.ledger ?? []) {
        if (record.status !== 'open') continue;
        if (record.kind !== 'grudge' && record.kind !== 'blood_feud') continue;
        if (record.holderId !== input.subject.id) continue;
        if (record.subjectId !== input.actor.id) continue;
        if (!worst || severityRank(record.severity) > severityRank(worst)) worst = record.severity;
    }
    return worst;
}

/**
 * What the money on the table is worth to the person it is in front of. Zero
 * unless `leverage` is coin, because a sum nobody put down is not on the table.
 * Exported so a probe can price an offer without resolving one.
 */
export function purseWeight(input: AttemptInput): number {
    if ((input.approach?.leverage ?? 'none') !== 'coin') return 0;
    const offered = Math.max(0, Math.trunc(input.stonesOffered ?? 0));
    if (offered === 0) return 0;

    // Their year, not a market rate and not the actor's.
    const theirYear = earningsPerYear(Math.max(0, input.subject.ordinal));
    if (!(theirYear > 0)) return 0;

    const years = offered / theirYear;
    return PURSE_MAX * (years / (years + PURSE_HALF_AT_YEARS)) * PURSE_REACH[input.ask];
}

/**
 * What kind of person the subject is about parting with things, as odds.
 *
 * DERIVED FROM THE SUBJECT'S ID WHEN THE CALLER DOES NOT SUPPLY IT. The default
 * is where the answer comes from, not a fallback: `resolveAttempt` has two
 * callers (`web/game.ts` and `world/the-world-changing-on-its-own.ts`) and a
 * field either could forget is a field one of them will forget.
 */
export function dispositionWeight(input: AttemptInput): number {
    const supplied = input.subject.openHandedness;
    const leaning = supplied === undefined || !Number.isFinite(supplied)
        ? openHandednessOf(input.subject.id)
        : supplied;
    return clamp(leaning, -1, 1) * DISPOSITION_MAX * DISPOSITION_REACH[input.ask];
}

/** Every term, computed and named. The mechanical channel shows these verbatim. */
export function oddsOf(input: AttemptInput): { odds: number; terms: Record<string, number> } {
    const approach = input.approach;
    const leverage = approach?.leverage ?? 'none';

    // Tone, leverage and concealment are already folded in by `regard.ts`.
    const regard = regardFor(input.subject.ordinal, {
        ordinal: input.actor.ordinal,
        approach
    });
    const standing = clamp(regard.socialGap, -RUNG_CLAMP, RUNG_CLAMP) * PER_RUNG;

    const charm = ((input.actor.charm ?? 2) - 2) * CHARM_PER_POINT;
    const tie = (input.theirTie?.active ? input.theirTie.strength : 0) * TIE_WEIGHT;
    const owed = owedYourWay(input) * OWED_PER_RECORD;
    const wants = input.theyWantSomethingFromYou ? THEY_WANT_SOMETHING : 0;

    const heldGrudge = grudgeAgainstYou(input);
    const grudge = heldGrudge === null
        ? 0
        : -(GRUDGE_BASE + severityRank(heldGrudge) * GRUDGE_PER_RANK);

    const ask = -ASK_RESISTANCE[input.ask];

    const audienceKind = approach?.audience ?? 'alone';
    const room = DISCREET_LEVERAGE.includes(leverage)
        ? -AUDIENCE_RESISTANCE[audienceKind]
        : 0;

    const terms = {
        base: BASE_ODDS,
        standing: round4(standing),
        charm: round4(charm),
        tie: round4(tie),
        owed: round4(owed),
        wants: round4(wants),
        grudge: round4(grudge),
        ask: round4(ask),
        purse: round4(purseWeight(input)),
        room: round4(room),
        disposition: round4(dispositionWeight(input)),
        // Damped by the tie they already hold: the trust ruling is about a
        // STRANGER, and somebody who has known you thirty years reads you the
        // same in a market town and in a demonic house's forecourt. The sign
        // flips where leverage is force - "the more lawless somewhere is, the
        // more credible the threat". See `RECOURSE_AGAINST_A_THREAT`.
        ground: round4(groundWeight({
            ground: input.where ?? null,
            ask: input.ask,
            theirTieStrength: input.theirTie?.active ? input.theirTie.strength : 0,
            ...(input.approach?.leverage ? { leverage: input.approach.leverage } : {})
        }))
    };

    const raw = Object.values(terms).reduce((sum, n) => sum + n, 0);
    return { odds: round4(clamp(raw, ODDS_FLOOR, ODDS_CEILING)), terms };
}

/**
 * Whether somebody who agreed also took hold of you: they take the coin, do the
 * thing, and now hold the fact that you asked. Not a punishment roll.
 *
 * Reads no faction and no alignment. Charm works everywhere; what a house is
 * shows up downstream, in what it costs afterwards.
 */
function turnOdds(input: AttemptInput): number {
    const above = clamp(input.subject.ordinal - input.actor.ordinal, 0, RUNG_CLAMP) * 0.06;
    const ask = ASK_RESISTANCE[input.ask] * 0.4;
    return clamp(above + ask, 0, 0.85);
}

/**
 * Whether a refusal travels. The ask outweighs the rank: nobody reports being
 * offered a drink, and everybody reports being asked to open a gate.
 */
function reportOdds(input: AttemptInput): number {
    const ask = ASK_RESISTANCE[input.ask] * 0.6;
    const ranked = input.subject.ranked && input.subject.factionId ? 0.2 : 0;
    const audienceKind = input.approach?.audience ?? 'alone';
    const seen = AUDIENCE_RESISTANCE[audienceKind];
    return clamp(ask + ranked + seen, 0, 0.9);
}

/**
 * Their side always grows. Yours grows only when you asked for nothing, which is
 * the whole of the difference between courting somebody and working them.
 */
const THEIR_STEP = 0.22;
const YOUR_STEP_WHEN_YOU_ASKED_NOTHING = 0.15;

/** Below this on your side, with them above the other, the tie is a lie. */
const INSTRUMENTAL_TIE_FLOOR = 0.3;
const EXPLOITABLE_TIE_FLOOR = 0.45;

/**
 * The name a tie has reached, by how strong the holder's side of it is. A ladder
 * rather than a declaration: nothing anywhere gets to assert two people are
 * lovers, they arrive there one landed approach at a time.
 */
function attachmentTypeFor(strength: number, ask: AskWeight): RelationshipType {
    if (strength >= 0.8 && (ask === 'against_their_interest' || ask === 'a_betrayal')) {
        return 'spouse';
    }
    if (strength >= 0.6) return 'lover';
    if (strength >= 0.35) return 'friend';
    return 'acquaintance';
}

function significanceFor(strength: number): Significance {
    if (strength >= 0.6) return 'defining';
    if (strength >= 0.3) return 'notable';
    return 'incidental';
}

function tieForAttachment(input: AttemptInput, turned: boolean): TieMove {
    const priorTheirs = input.theirTie?.active ? input.theirTie.strength : 0;
    const priorYours = input.yourTie?.active ? input.yourTie.strength : 0;

    const theirStrength = round4(clamp(priorTheirs + THEIR_STEP, 0, 1));
    const yourStrength = round4(clamp(
        priorYours + (input.ask === 'a_courtesy' ? YOUR_STEP_WHEN_YOU_ASKED_NOTHING : 0),
        0, 1
    ));

    // On `turned` the strengths are the same and the ROLES invert.
    const theirRoles = turned
        ? ['attached', 'knows_what_this_is']
        : ['attached'];
    const yourRoles = yourStrength < INSTRUMENTAL_TIE_FLOOR && theirStrength >= EXPLOITABLE_TIE_FLOOR
        ? ['holds_an_attachment_they_do_not_return']
        : ['attached'];

    return {
        theirs: {
            type: attachmentTypeFor(theirStrength, input.ask),
            strength: theirStrength,
            significance: significanceFor(theirStrength),
            roles: theirRoles
        },
        yours: {
            type: attachmentTypeFor(yourStrength, input.ask),
            strength: yourStrength,
            significance: significanceFor(yourStrength),
            roles: yourRoles
        },
        event: {
            onDay: input.onDay,
            kind: 'attachment_formed',
            summary:
                `${input.actor.name} and ${input.subject.name} came to an understanding` +
                (input.ask === 'a_courtesy' ? '.' : ', and something was asked of it.'),
            significance: theirStrength >= 0.6 ? 'defining' : 'notable',
            tags: ['attachment', `ask:${input.ask}`]
        }
    };
}

/**
 * The tie a transaction leaves: client and patron, not fondness.
 *
 * Asymmetric. Writing both sides the same number said a bribed official and
 * their briber were equally invested, and made every bought tie look mutual to
 * anything reading the graph for one-sided ones.
 */
function tieForTransaction(input: AttemptInput, turned: boolean): TieMove {
    const theirs: TieSide = (() => {
        const strength = round4(clamp(
            (input.theirTie?.active ? input.theirTie.strength : 0) + 0.1, 0, 1
        ));
        return {
            type: turned ? 'client' : 'patron',
            strength,
            significance: significanceFor(strength),
            roles: turned ? ['bought_them'] : ['was_bought']
        };
    })();
    const yours: TieSide = (() => {
        // The buyer's own side does not grow.
        const strength = round4(clamp(input.yourTie?.active ? input.yourTie.strength : 0, 0, 1));
        return {
            type: turned ? 'patron' : 'client',
            strength,
            significance: significanceFor(strength),
            roles: turned ? ['was_bought'] : ['bought_them']
        };
    })();
    return {
        theirs,
        yours,
        event: {
            onDay: input.onDay,
            kind: 'arrangement_made',
            summary: `${input.actor.name} got something out of ${input.subject.name}.`,
            significance: 'notable',
            tags: ['transaction', `ask:${input.ask}`]
        }
    };
}

/**
 * A REFUSAL IS NOT AUTOMATICALLY AN OFFENCE. The design owner's ruling:
 * *"refusals immediately turning into grudges was too simplistic"*. Measured
 * before the change, when every refusal wrote one: a `slight` grudge is worth
 * -0.1, which takes a COURTESY - the very act the refusal advises - from about
 * 29% to about 9%. One no made the cheapest lever in the game three times
 * harder, permanently.
 *
 * Two ways to do something wrong, producing grudges that point opposite ways.
 * THE ASK WAS WRONG: coercion, or cash where `items.md` says *"offering it reads
 * as not understanding what you are looking at"*, or wearing somebody down.
 * THE REFUSAL WAS WRONG: *"if we're in the same sect, my son is dying and you
 * refuse because you want to keep it for later, this might be a grudge."*
 *
 * Do not add a list of offences. Each test below is a structural fact about what
 * was put down or held back; a fifth kind of wrong is a different reading of the
 * same rows, not a new case.
 */

/**
 * Below this, money is not what buys the thing. Read off `PURSE_REACH` so the
 * insult test and the pricing can never disagree about where the cash line falls.
 */
export const COIN_STOPS_BEING_THE_MEDIUM_AT = 0.2;

/**
 * How many times the same thing can be asked before patience is a fair cost.
 * Counted per pair and per kind by the caller, which is where the count lives.
 */
export const PATIENCE_RUNS_OUT_AFTER_ASKS = 5;

/** Whether these two are bound to each other at all, off rows only. */
function boundToEachOther(input: AttemptInput): boolean {
    const sameHouse = input.actor.factionId !== null
        && input.actor.factionId === input.subject.factionId;
    const tie = input.theirTie?.active === true || input.yourTie?.active === true;
    const ledger = (input.ledger ?? []).some(record => record.status === 'open');
    return sameHouse || tie || ledger;
}

/** Whether the asking itself was wrong. Three readings of what was put down,
 * none of them about the answer - coercion offends whether or not it works. */
function theAskWasWrong(input: AttemptInput): boolean {
    const leverage = input.approach?.leverage ?? 'none';
    if (leverage === 'force' || leverage === 'secret') return true;
    if (leverage === 'coin' && PURSE_REACH[input.ask] <= COIN_STOPS_BEING_THE_MEDIUM_AT) {
        return true;
    }
    return (input.timesAskedBefore ?? 0) >= PATIENCE_RUNS_OUT_AFTER_ASKS;
}

/**
 * Whether the REFUSING was wrong. All the conditions, because dropping any one
 * of them turns an ordinary no into an injury. `theAnswerWasTheirsToGive` is
 * checked first: it settles the question whatever the others say.
 */
function theRefusalWasWrong(input: AttemptInput): boolean {
    if (input.theAnswerWasTheirsToGive === false) return false;
    return input.askersNeedIsPressing === true
        && input.theirHoldOnItIsMerelyReserved === true
        && boundToEachOther(input);
}

/**
 * The severity written on a refusal, decided once at creation - `grudges.ts`
 * forbids recomputing it.
 *
 * Never above SERIOUS. Grave and unforgivable are written by
 * `when-somebody-works-out-what-you-did.ts`, and the gap is the point: being
 * turned down is not the injury, being used and finding out later is.
 */
function severityOfARefusal(leverage: ApproachLeverage, ask: AskWeight): Severity {
    if (leverage === 'secret' || leverage === 'force') return 'serious';
    if (ask === 'a_betrayal') return 'serious';
    return 'slight';
}

/**
 * What a refusal leaves behind, usually nothing. When it is not null, which way
 * it points is decided by which of the two wrongs happened.
 */
function whatARefusalLeaves(input: AttemptInput, reached: boolean): ObligationInput | null {
    const leverage = input.approach?.leverage ?? 'none';

    if (theRefusalWasWrong(input)) {
        return {
            kind: 'grudge',
            // The ASKER holds this one. They were the one turned away.
            holderId: input.actor.id,
            subjectId: input.subject.id,
            cause: 'betrayal',
            severity: 'serious',
            onDay: input.onDay,
            description:
                `${input.subject.name} had it, ${input.actor.name} needed it, and `
                + `${input.subject.name} kept it back against something that may never come.`,
            participants: input.subject.factionId ? [input.subject.factionId] : [],
            tags: ['refused_a_present_need', `ask:${input.ask}`, 'held_in_reserve']
        };
    }

    if (!theAskWasWrong(input)) return null;

    return {
        kind: 'grudge',
        // The AGGRIEVED party holds it.
        holderId: input.subject.id,
        subjectId: input.actor.id,
        cause: 'humiliation',
        severity: severityOfARefusal(leverage, input.ask),
        onDay: input.onDay,
        description:
            `${input.actor.name} came to ${input.subject.name} with ` +
            `${describeLeverage(leverage)} and was turned down.`,
        participants: reached && input.subject.factionId ? [input.subject.factionId] : [],
        tags: [
            'refused_approach',
            `leverage:${leverage}`,
            `ask:${input.ask}`,
            ...(reached ? ['reached_the_house'] : [])
        ]
    };
}

/** Factual, not narration. Used in record descriptions and in `line`. */
function describeLeverage(leverage: ApproachLeverage): string {
    switch (leverage) {
        case 'coin': return 'money on the table';
        case 'favour': return 'a favour to call in';
        case 'debt': return 'a debt they could not deny';
        case 'name': return 'their own name';
        case 'sect': return 'a house standing behind them';
        case 'force': return 'what they could do about a refusal';
        case 'secret': return 'something they would pay not to have said aloud';
        case 'attachment': return 'themselves';
        default: return 'nothing but the asking';
    }
}

/**
 * Resolve one attempt. Three rolls at most, all from the caller's seeded stream.
 */
export function resolveAttempt(input: AttemptInput): AttemptResult {
    const { odds, terms } = oddsOf(input);
    const leverage = input.approach?.leverage ?? 'none';
    const patience = APPROACH_PATIENCE_EFFECT[input.approach?.patience ?? 'normal'];
    const days = Math.max(1, Math.round(ASK_DAYS[input.ask] * patience.duration));
    const audience = input.approach?.audience ?? 'alone';

    // Drawn first, asked about second: a decided attempt must leave this stream
    // exactly where a sampled one leaves it, or the report and turn draws shift
    // because an operator arranged the answer. Do not short-circuit this.
    const landed = input.rng.next() < odds || input.theAttemptLands === true;

    if (!landed) {
        // Read BEFORE the report roll: a counter-offer is not a refusal and
        // there is nothing about it to carry to anybody's house. Leaves no
        // ledger row and moves no tie; the days are still spent.
        if (input.theyWantSomethingFromYou === true) {
            return {
                outcome: 'countered',
                odds,
                terms,
                days,
                stonesSpent: 0,
                marks: {
                    theyKnowWhatYouTried: true,
                    reachedTheHouse: false,
                    obligation: null,
                    counterObligation: null,
                    tie: null,
                    unspoken: null
                },
                line: `${input.subject.name} did not agree and did not close the door. `
                    + 'There is something they want, and they said so.'
            };
        }

        const reached = input.rng.next() < reportOdds(input);
        const outcome: AttemptOutcome = reached ? 'reported' : 'refused';
        return {
            outcome,
            odds,
            terms,
            days,
            stonesSpent: 0,
            marks: {
                theyKnowWhatYouTried: true,
                reachedTheHouse: reached,
                obligation: whatARefusalLeaves(input, reached),
                counterObligation: null,
                tie: null,
                unspoken: null
            },
            line: reached
                ? `${input.subject.name} refused, and did not keep it to themselves.`
                : `${input.subject.name} refused.`
        };
    }

    const turned = input.rng.next() < turnOdds(input);
    const outcome: AttemptOutcome = turned ? 'turned' : 'taken';
    const tie = leverage === 'attachment'
        ? tieForAttachment(input, turned)
        : tieForTransaction(input, turned);

    // A DEBT carried by the actor, not a grudge: it does not go away by being
    // nice to them.
    const counterObligation: ObligationInput | null = turned
        ? {
            kind: 'debt',
            holderId: input.actor.id,
            subjectId: input.subject.id,
            cause: 'other',
            severity: input.ask === 'a_betrayal' ? 'grave' : 'serious',
            onDay: input.onDay,
            description:
                `${input.subject.name} did it, and kept what it cost ` +
                `${input.actor.name} to ask.`,
            terms:
                'Unstated, and that is the point. It is called in when it is worth ' +
                'calling in, and not before.',
            tags: ['turned', `leverage:${leverage}`, `ask:${input.ask}`]
        }
        : null;

    // A favour is owed TO its holder.
    const obligation: ObligationInput | null =
        !turned && input.ask !== 'a_courtesy'
            ? {
                kind: 'favor',
                holderId: input.actor.id,
                subjectId: input.subject.id,
                cause: 'other',
                severity: input.ask === 'a_betrayal' ? 'grave' : 'serious',
                onDay: input.onDay,
                description: `${input.subject.name} did it, at ${describeCost(input.ask)}.`,
                tags: ['taken', `leverage:${leverage}`, `ask:${input.ask}`]
            }
            : null;

    const unspoken: UnspokenTruth | null =
        leverage === 'attachment' &&
        !turned &&
        tie.yours.strength < INSTRUMENTAL_TIE_FLOOR &&
        tie.theirs.strength >= EXPLOITABLE_TIE_FLOOR
            ? {
                heldById: input.actor.id,
                aboutId: input.subject.id,
                theirStrength: tie.theirs.strength,
                yourStrength: tie.yours.strength,
                ask: input.ask,
                audience,
                formedOnDay: input.onDay
            }
            : null;

    return {
        outcome,
        odds,
        terms,
        days,
        stonesSpent: leverage === 'coin' ? Math.max(0, Math.trunc(input.stonesOffered ?? 0)) : 0,
        marks: {
            // A clean take is the one outcome nobody has anything on you for.
            theyKnowWhatYouTried: turned,
            reachedTheHouse: false,
            obligation,
            counterObligation,
            tie,
            unspoken
        },
        line: turned
            ? `${input.subject.name} agreed, and is holding the fact that they were asked.`
            : `${input.subject.name} agreed.`
    };
}

function describeCost(ask: AskWeight): string {
    switch (ask) {
        case 'a_courtesy': return 'no cost to themselves';
        case 'a_real_favour': return 'some cost to themselves';
        case 'against_their_interest': return 'real cost to themselves';
        case 'a_betrayal': return 'a cost that ends them if it is found out';
    }
}

/** Exported for tests and probes that pin the tables. */
export const LEVERAGE_ATTEMPT_CONSTANTS = Object.freeze({
    ASK_RESISTANCE,
    ASK_DAYS,
    PURSE_MAX,
    PURSE_HALF_AT_YEARS,
    PURSE_REACH,
    DISPOSITION_MAX,
    DISPOSITION_REACH,
    DISCREET_LEVERAGE,
    AUDIENCE_RESISTANCE,
    BASE_ODDS,
    ODDS_FLOOR,
    ODDS_CEILING,
    INSTRUMENTAL_TIE_FLOOR,
    EXPLOITABLE_TIE_FLOOR
});
