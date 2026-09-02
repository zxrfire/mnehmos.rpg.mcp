/**
 * One attempt to work on a person: what it takes, what it costs, and what it
 * leaves behind whether or not it lands.
 *
 * WHAT WAS HERE BEFORE
 * --------------------
 * Nothing. `GameService.interact` resolved every approach to
 * `outcome = 'refused'` with the note *"Attempt recorded; outcome not
 * resolvable yet"*, and said in a comment exactly why: the social layer that
 * would decide it - relationships, obligations, what each side knows and wants
 * - was not something the web layer could invent. `bribe`, `deceive` and
 * `threaten` were words the parser recognised and nothing else. This module is
 * the missing half, and it is deliberately not in `engine/social/`: that
 * directory is STORAGE and its charter forbids scoring, weighting and any
 * reading of the ladder. This one does all three, so it lives beside it.
 *
 * WHAT IT IS NOT ALLOWED TO DO
 * ---------------------------
 * `actions.ts` states the rule this module was most at risk of breaking:
 *
 *   > `intent` is a free-ish label, and it is safe precisely because NOTHING in
 *   > the engine branches on it to decide an outcome. The moment a line of code
 *   > reads `if (intent === 'bribe')` to pick a result, the design has failed.
 *
 * So no function here has ever seen the player's intent string. What it reads
 * instead is {@link Approach.leverage} - the existing closed enum saying what
 * is actually on the table - and `attachment` is one member of it alongside
 * `coin`, `force` and `secret`. Seduction is therefore priced by the same
 * machine that prices a purse, with no branch anywhere on the word somebody
 * typed. Take the leverage away and there is no seduction system left over.
 *
 * THE ARITHMETIC, WHOLE
 * ---------------------
 * Everything in it is real stored state on one side or the other:
 *
 *     standing   the social gap from `regard.ts`, which already folds in tone,
 *                leverage, concealment and who is watching. The heaviest term,
 *                correctly: who you are outweighs how you ask.
 *     charm      the attribute, worth about a tenth either way across its whole
 *                legal 1..3 range. A first impression, not a lever.
 *     the tie    how strong THEIR view of you already is. Not yours of them.
 *     owed       open favours and debts on the obligation ledger, their way.
 *     grudges    open grudges they hold against you, by stored severity.
 *     the ask    what you are actually asking them to do, which is the term
 *                that makes a betrayal hard to buy at any price.
 *     the purse  what was actually put down, priced against what a year of
 *                THEIR life earns. Saturating, and reaching only as far into
 *                the ask as money reaches in this world. See THE PURSE.
 *     the room   discreet leverage does not survive an audience.
 *     who they   how freely THIS PARTICULAR PERSON parts with things, which is
 *      are       a fact about them and not about their house. See DISPOSITION.
 *
 * FIVE OUTCOMES, BECAUSE TWO IS NOT PLAY
 * --------------------------------------
 *   taken     they did it, and the tie or the obligation is real
 *   turned    they did it AND took hold of you - the bribe that buys somebody
 *             who then owns you back. A second record, pointing the other way.
 *   countered they did not do it and they did not close the door: there is
 *             something they want that you are in a position to reach, so the
 *             answer is terms rather than no. See THE FIFTH OUTCOME.
 *   refused   they said no, and now they know what you tried
 *   reported  they said no and it reached their house
 *
 * THE FIFTH OUTCOME
 * -----------------
 * `countered` was missing and its absence was load-bearing. Above the cash line
 * this world does not sell things - `items.md`: *"cash is simply not the
 * medium. Not 'expensive' - not for sale"* - and what moves people instead is a
 * favour owed, another singular thing, an oath, a name. Every one of those is a
 * NEGOTIATION, and a resolver whose failure states were only *no* and *no, and
 * they told somebody* had nowhere to put one. So a player who found the right
 * holder of the right object and put down the wrong thing got the same sentence
 * as somebody who had insulted them, and the whole barter tier - every
 * heaven-grade and above cure in the catalog among it - was unreachable in play
 * while the refusals correctly named what would have worked.
 *
 * It fires on exactly one condition, and the condition is a term this resolver
 * has priced since it was written: `theyWantSomethingFromYou`. Somebody with an
 * open want the person in front of them could move does not simply say no. They
 * say what they would take. So the fifth outcome needs no new input and no new
 * table - it is the existing term read for what it already means.
 *
 * It leaves nothing behind. No grudge, because being told the price is not
 * being refused; no tie, because nothing was agreed; no report, because there
 * is nothing to report. What it costs is the days, which are real. `AGENTS.md`
 * ruled the general form of this - *"a refusal is not automatically an
 * offence"* - and a counter-offer is the least offensive thing in the set: it
 * is the door being held open with a figure written on it.
 *
 * ROMANCE AND USING SOMEBODY ARE THE SAME MOVE UNTIL THE NUMBERS DIVERGE
 * ---------------------------------------------------------------------
 * The tie this writes is directed, because `relationships.ts` is directed, and
 * the asymmetry is the entire mechanic. Their side grows every time the
 * attempt lands. Your side grows ONLY when you asked nothing - when the ask was
 * a courtesy and the whole of what you spent was time. So a player who keeps
 * coming back without wanting something ends up in a mutual tie, and a player
 * who does not ends up holding a strong one-way attachment they can spend.
 * That second shape is what {@link AttemptMarks.unspoken} carries forward, and
 * it is what somebody can work out years later.
 *
 * Pure. State in, deltas out. No I/O, no repository, no mutation of inputs,
 * and every roll comes from the seeded stream the caller supplies.
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
import { openHandednessOf } from './how-freely-somebody-parts-with-what-they-have.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS BEING ASKED
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much the thing you want would cost the person you want it from.
 *
 * This and not the verb is what makes an approach hard. Asking a gate guard
 * for a name and asking the same guard to leave the gate unwatched are the
 * same sentence with the same charm behind it, and they are not remotely the
 * same attempt.
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
    /**
     * A season and a half. Nobody is talked into ending themselves over an
     * afternoon, and an attempt that takes real time is an attempt the world
     * has time to notice.
     */
    a_betrayal: 45
} as const;

/**
 * Leverage you would rather nobody saw change hands.
 *
 * Coin, a held secret and an attachment are all discreet by nature; a name and
 * a sect are things you brought along precisely so the room would see them.
 * This is why the same offer that moves somebody in a corridor gets refused in
 * a hall, and it needs no rule about corridors.
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

// ─────────────────────────────────────────────────────────────────────────
// THE TERMS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where an attempt starts before anything about these two people is read.
 *
 * Deliberately below even. The default answer to a stranger asking you for
 * something is no, and everything below has to argue it up from there.
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

// ─────────────────────────────────────────────────────────────────────────
// THE PURSE
//
// Money named a sum, was refused without one, and was debited on a take - and
// it did not appear in the odds at all. The player put stones on the table and
// bought exactly nothing, which is the softening the agency rule forbids in its
// most invisible form: the sentence was accepted, the purse moved, and the
// world's answer would have been identical had they offered nothing.
//
// Three properties, and each of them is a design constraint rather than a
// tuning choice.
//
// IT IS PRICED AGAINST THEM, NOT AGAINST A TABLE. A hundred stones is a year of
// a gate guard's life and a rounding error to an elder, and the difference has
// to come from an income curve that already exists rather than from a second
// one written here. `earningsPerYear` is the one the world runs on - the same
// function `holdingsFor` seeds every purse in the world from - so what a sum is
// WORTH is asked once and answered in one place.
//
// IT SATURATES. Past a point the problem is not the price. Doubling an offer
// that is already ten years of somebody's income moves the odds by under a
// percent, because what is stopping them at that point is not the number.
//
// IT DOES NOT REACH THE THINGS MONEY DOES NOT REACH. `docs/world/items.md`
// holds the line: below it things have prices, and above it "cash is simply not
// the medium. Not 'expensive' - not for sale." What a sum buys is the ORDINARY
// FAVOUR - a seat in a queue, a look the other way, an introduction, a release
// from a house - and PURSE_REACH is that line expressed against the ask rather
// than against a catalog tier. Never zero at the far end, because "typically
// does not" is not "never" and a desperate enough person in front of a large
// enough sum is a door that has to stay open.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The most a purse can ever be worth, before the ask damps it.
 *
 * Deliberately smaller than one realm of standing (`RUNG_CLAMP * PER_RUNG` is
 * 0.3) and smaller than an existing tie at full strength. Money is a term and
 * it is never the term: who you are and what they already think of you both
 * outweigh it, which is the whole reason this world is not bought.
 */
const PURSE_MAX = 0.2;

/**
 * The offer, in years of the SUBJECT'S own income, worth half of `PURSE_MAX`.
 *
 * A year of what somebody earns is a serious offer and gets half the ceiling.
 * The curve is `years / (years + this)`, so three years reaches 0.75 of it,
 * nine reaches 0.9, and ninety-nine reaches 0.99 - which is the saturation
 * stated as arithmetic instead of as a cap somebody has to remember.
 */
const PURSE_HALF_AT_YEARS = 1;

/**
 * How far a purse reaches into what is being asked.
 *
 * The ordinary favour at full weight, and almost nothing at the end of the
 * scale, because somebody weighing the end of their own house is not weighing
 * it against a number. At `a_betrayal` the whole term maxes out at one point of
 * a percent, which is a door left open rather than a price.
 */
const PURSE_REACH: Record<AskWeight, number> = {
    a_courtesy: 1,
    a_real_favour: 0.6,
    against_their_interest: 0.2,
    a_betrayal: 0.05
} as const;

// ─────────────────────────────────────────────────────────────────────────
// DISPOSITION
//
// The design owner's ruling: *"some people are greedy some generous, this
// should be part of their character - kind elders exist just as greedy demonic
// cultivators exist."*
//
// Every other term above is about the two of you, the room, or what is on the
// table. None of them is about WHO THE PERSON ASKED HAPPENS TO BE, so before
// this term two people at the same rung of the same house, equally owed and
// equally fond of you, answered the same request identically forever. That is
// the world as a set of doors with the same lock.
//
// THE SCALAR IS THE WHOLE MECHANISM, AND IT IS NOT A PERSONALITY.
// `openHandednessOf` in `how-freely-somebody-parts-with-what-they-have.ts`
// hands back one number on -1..+1 and this multiplies by it. There is nothing
// to switch on: a tenth kind of person is a different number with a different
// sentence beside it, and no branch anywhere reads a name. See that file for
// why it is drawn from the person's own id and cannot see an alignment.
//
// IT DISCOUNTS COST, NOT DANGER, and that distinction is why there is a reach
// table here at all rather than a flat multiplier on `ask`. `AskWeight` runs
// two different quantities up one scale - what a thing COSTS them at the bottom
// and what it RISKS them at the top - and generosity is about the first only.
// A generous person hands over the book. A generous person is not one rung
// likelier to end their own standing, because that was never a question about
// how tightly they hold things. So the table is shaped like `PURSE_REACH` and
// for the same reason: both are statements about how far a thing reaches into
// an ask, and both go to almost nothing at the far end.
//
// AND IT IS SMALL WHERE NOTHING IS BEING GIVEN UP. A courtesy costs them a
// sentence, so everybody is generous with it and the term is nearly flat there.
// That falls out of the table rather than being a rule about courtesies.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The most a disposition can ever be worth, at either end.
 *
 * Under `PURSE_MAX` would be wrong - who somebody is should outweigh what is in
 * a stranger's purse - and over a tie at full strength or a realm of standing
 * would be worse, because then the world would be decided by a coin the player
 * cannot see. Sat between the two: a hair under the purse's ceiling doubled,
 * and well under `TIE_WEIGHT`. The distance between the two extremes of the
 * axis is therefore about a third of the whole scale on a real favour, which is
 * enough to be the difference between a yes and a no and never enough to be the
 * only thing that was.
 */
const DISPOSITION_MAX = 0.18;

/**
 * How far being open-handed reaches into what is being asked.
 *
 * Read this next to `PURSE_REACH`. They are the same kind of table making
 * opposite-shaped statements: money reaches furthest at the bottom of the scale
 * and generosity reaches furthest where somebody is being asked to GIVE
 * something up, which is one row in.
 *
 *   a_courtesy             nothing is leaving their hands, so there is almost
 *                          nothing to be generous or grudging with
 *   a_real_favour          the whole of where this lives: time, standing, a
 *                          book they would rather keep
 *   against_their_interest they end up worse off, and how tightly they hold
 *                          things is now only part of what they are weighing
 *   a_betrayal             not a question about holding on to anything. Never
 *                          zero, because "typically does not" is not "never"
 */
const DISPOSITION_REACH: Record<AskWeight, number> = {
    a_courtesy: 0.15,
    a_real_favour: 1,
    against_their_interest: 0.35,
    a_betrayal: 0.1
} as const;

/**
 * Nothing is certain and nothing is impossible.
 *
 * The floor is what keeps "typically does not" from becoming "never" - the
 * rule AGENTS.md names. The ceiling is what stops a stacked approach from
 * turning a betrayal into a formality.
 */
const ODDS_FLOOR = 0.02;
const ODDS_CEILING = 0.95;

// ─────────────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────────────

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
    /**
     * Whether they hold a rank inside that house. A ranked member has
     * somewhere to take a refusal; a hired hand does not.
     */
    ranked?: boolean;
    /**
     * How freely this person parts with what they have, on -1..+1.
     *
     * Absent means DRAWN FROM THEIR ID, not neutral. See `dispositionWeight`
     * for why the default is where the answer comes from rather than a
     * fallback: a field two callers could each forget is a field one of them
     * will forget, and this world has been burned by that repeatedly.
     *
     * READ OFF THE PERSON, NEVER OFF THEIR HOUSE. `openHandednessOf` is the one
     * function that answers this and it takes an id and nothing else. Anything
     * that computes this field from an alignment, a faction or a rung has
     * broken the ruling it exists to serve, and would do it invisibly, because
     * the result would read plausibly every time.
     */
    openHandedness?: number;
}

/**
 * The whole of what this module reads off an existing tie.
 *
 * Two numbers. `Relationship` from `social/relationships.ts` satisfies it, and
 * so does the world layer's simpler `NpcRelationship` once its `standing` is
 * floored at zero - which is the entire translation between the two models.
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
    /**
     * Tone, leverage, audience, patience, a concealed rung. The engine reads
     * `leverage` to know what is on the table and hands the whole thing to
     * `regard.ts` for the standing term. It never reads `intent`.
     */
    approach?: Approach;
    /**
     * The subject's view of the actor, if there already is one.
     *
     * Typed as the two fields this module actually reads rather than as a
     * whole {@link Relationship}, so a full record satisfies it structurally
     * and the world layer - whose tie model is simpler - can pass its own
     * without a cast. Nothing here may read `attitude` or `history`: those are
     * the narrator's prose and the engine does not parse them.
     */
    theirTie?: TieReading | null;
    /** The actor's view of the subject, if there already is one. */
    yourTie?: TieReading | null;
    /**
     * The open obligation ledger between these two, in either direction. The
     * resolver picks out what is owed your way and what is held against you.
     */
    ledger?: readonly ObligationRecord[];
    /**
     * True when the subject has an open goal this actor could plausibly move.
     *
     * Must be read off a real goal row - `openGoalsOf` in `npc-state.ts` - and
     * never off a model's opinion about what somebody probably wants.
     */
    theyWantSomethingFromYou?: boolean;
    /** Spirit stones actually put down. Only spent when the attempt lands. */
    stonesOffered?: number;
    rng: CultivationRNG;
}

// ─────────────────────────────────────────────────────────────────────────
// OUTPUT
// ─────────────────────────────────────────────────────────────────────────

export type AttemptOutcome = 'taken' | 'turned' | 'countered' | 'refused' | 'reported';

/** One side of a tie the attempt asks the caller to write. */
export interface TieSide {
    type: RelationshipType;
    strength: number;
    significance: Significance;
    roles: string[];
}

/**
 * The relationship change, both halves, deliberately allowed to disagree.
 *
 * `relationships.ts` stores `from -> to` as two rows and its own header names
 * the case this produces: *"he thinks they are friends; she has been waiting
 * nine years for an opening."* This is the engine writing that shape down
 * rather than a narrator asserting it.
 */
export interface TieMove {
    /** The subject's view of the actor. */
    theirs: TieSide;
    /** The actor's view of the subject. */
    yours: TieSide;
    event: RelationshipEventInput;
}

/**
 * What the world is now carrying that it was not before.
 *
 * A successful attempt that leaves no mark is not play, and neither is a
 * failed one. Every field here is a record the caller persists; nothing is
 * narration and nothing is a flag that only this module understands.
 */
export interface AttemptMarks {
    /** They can name what you tried. True on every outcome except a clean take. */
    theyKnowWhatYouTried: boolean;
    /** True when the refusal travelled past the person who made it. */
    reachedTheHouse: boolean;
    /** A grudge, debt or oath the attempt opened. Written as-is. */
    obligation: ObligationInput | null;
    /**
     * The one pointing the other way.
     *
     * On `turned` this is the whole event: they took what you offered and you
     * are now the one carrying a debt. On `taken` with a heavy ask it is the
     * favour they can call in later.
     */
    counterObligation: ObligationInput | null;
    tie: TieMove | null;
    /**
     * Set when the tie that formed is not what the other party thinks it is.
     *
     * This is the delayed half. Nothing has gone wrong yet; the record simply
     * exists, and `when-somebody-works-out-what-you-did.ts` reads it every time
     * the world advances.
     */
    unspoken: UnspokenTruth | null;
}

/**
 * An attachment that is doing work its holder does not know about.
 *
 * Not a mood and not a secret in `secrets.ts` - it is a description of a tie
 * that the numbers on that tie already imply, kept in one place so the
 * discovery check has something to read.
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

// ─────────────────────────────────────────────────────────────────────────
// THE ODDS
// ─────────────────────────────────────────────────────────────────────────

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
 * What the money on the table is worth to the person it is in front of.
 *
 * Zero unless coin is what is being offered: `stonesOffered` is only ever SPENT
 * on a coin approach, and a sum nobody put down is not on the table. So this
 * reads the same closed `leverage` enum every other term reads and never the
 * word the player typed.
 *
 * Exported so a probe can price an offer without resolving one, and so the
 * curve is testable at the two ends that matter - the sum that is a year of
 * their life, and the sum that is a hundred.
 */
export function purseWeight(input: AttemptInput): number {
    if ((input.approach?.leverage ?? 'none') !== 'coin') return 0;
    const offered = Math.max(0, Math.trunc(input.stonesOffered ?? 0));
    if (offered === 0) return 0;

    // Their year, not a market rate and not the actor's. What a sum means is a
    // fact about the person it is being offered to.
    const theirYear = earningsPerYear(Math.max(0, input.subject.ordinal));
    if (!(theirYear > 0)) return 0;

    const years = offered / theirYear;
    return PURSE_MAX * (years / (years + PURSE_HALF_AT_YEARS)) * PURSE_REACH[input.ask];
}

/**
 * What kind of person the subject is about parting with things, as odds.
 *
 * DERIVED FROM THE SUBJECT WHEN THE CALLER DOES NOT SUPPLY IT, and that is the
 * whole reason this term is a feature rather than a module with tests. AGENTS.md
 * names "a module nothing calls" as the most-repeated defect in this project and
 * names its mirror image too: *"a rule that binds NPCs and not the player, or
 * the player and not NPCs, is the same failure with one caller instead of
 * none."* There are two callers of `resolveAttempt` - the played game in
 * `web/game.ts` and the world simulation in
 * `world/the-world-changing-on-its-own.ts` - and a field either of them could
 * forget to fill is a field that will be filled in one of them.
 *
 * So the default is not a fallback. It is where the answer comes from, and
 * `Party.openHandedness` is an override for a caller that already knows better.
 * This is the same shape as `purseWeight` reaching for `earningsPerYear` off the
 * subject's rung rather than being handed a figure: a fact about a person, asked
 * once and answered in one place.
 *
 * Exported for the same reason `purseWeight` is: the two are the terms most
 * likely to be mistuned, and a probe that cannot price one without resolving an
 * attempt cannot tell tuning from a bug.
 */
export function dispositionWeight(input: AttemptInput): number {
    const supplied = input.subject.openHandedness;
    const leaning = supplied === undefined || !Number.isFinite(supplied)
        ? openHandednessOf(input.subject.id)
        : supplied;
    return clamp(leaning, -1, 1) * DISPOSITION_MAX * DISPOSITION_REACH[input.ask];
}

/**
 * Every term, computed and named.
 *
 * Exported because a probe that cannot see the breakdown cannot tell a tuning
 * problem from a bug, and because the mechanical channel shows the player the
 * same numbers the engine used.
 */
export function oddsOf(input: AttemptInput): { odds: number; terms: Record<string, number> } {
    const approach = input.approach;
    const leverage = approach?.leverage ?? 'none';

    // Standing, via the module that already prices standing. The subject's own
    // rung is the gate; tone, leverage and concealment are already inside it.
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
        disposition: round4(dispositionWeight(input))
    };

    const raw = Object.values(terms).reduce((sum, n) => sum + n, 0);
    return { odds: round4(clamp(raw, ODDS_FLOOR, ODDS_CEILING)), terms };
}

// ─────────────────────────────────────────────────────────────────────────
// WHICH WAY IT FAILS, AND WHICH WAY IT SUCCEEDS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether somebody who agreed also took hold of you.
 *
 * Not a punishment roll. It is what happens when the person you thought you
 * were buying is standing above you and can see the whole shape of what you
 * are doing: they take the coin, do the thing, and now hold the fact that you
 * asked. The heavier the ask, the more there is to hold.
 *
 * Nothing here reads a faction or an alignment, and that is deliberate.
 * Charm works everywhere. A righteous elder, a demonic cultivator and a free-
 * port factor are all resolved by this same function against the same terms;
 * what their houses are shows up entirely downstream, in what it costs
 * afterwards. There is no body in this world that is immune to being asked.
 */
function turnOdds(input: AttemptInput): number {
    const above = clamp(input.subject.ordinal - input.actor.ordinal, 0, RUNG_CLAMP) * 0.06;
    const ask = ASK_RESISTANCE[input.ask] * 0.4;
    return clamp(above + ask, 0, 0.85);
}

/**
 * Whether a refusal travels.
 *
 * Somebody with a rank has a person to tell and a reason to be seen telling
 * them. Somebody with neither absorbs it. What was being asked matters more
 * than either: nobody reports being offered a drink, and everybody reports
 * being asked to open a gate.
 */
function reportOdds(input: AttemptInput): number {
    const ask = ASK_RESISTANCE[input.ask] * 0.6;
    const ranked = input.subject.ranked && input.subject.factionId ? 0.2 : 0;
    const audienceKind = input.approach?.audience ?? 'alone';
    const seen = AUDIENCE_RESISTANCE[audienceKind];
    return clamp(ask + ranked + seen, 0, 0.9);
}

// ─────────────────────────────────────────────────────────────────────────
// THE TIE
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far the subject's side of an attachment moves when an attempt lands.
 *
 * Their side always grows. Yours grows only when you asked for nothing, which
 * is the whole of the difference between courting somebody and working them.
 */
const THEIR_STEP = 0.22;
const YOUR_STEP_WHEN_YOU_ASKED_NOTHING = 0.15;

/** Below this on your side, with them above the other, the tie is a lie. */
const INSTRUMENTAL_TIE_FLOOR = 0.3;
const EXPLOITABLE_TIE_FLOOR = 0.45;

/**
 * The name a tie has reached, by how strong the holder's side of it is.
 *
 * A ladder rather than a declaration, so nothing anywhere gets to assert that
 * two people are lovers. They arrive there by the same arithmetic that got
 * them to acquaintance, one landed approach at a time, and `spouse` needs an
 * ask heavy enough to be a real undertaking because in this world it is one.
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

    // On `turned` the strengths are the same and the ROLES invert: they know
    // what this is and are keeping it because it is useful to them.
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
 * The tie a transaction leaves.
 *
 * Coin, a favour or a threat that lands does not make anybody fond of you. It
 * makes them your client and you their patron, and on a `turned` outcome it
 * makes them yours.
 */
function tieForTransaction(input: AttemptInput, turned: boolean): TieMove {
    // Asymmetric for the same reason an attachment is. Somebody who has come
    // to rely on an arrangement is more consequential to them than they are to
    // the person paying for it, and writing both sides the same number was
    // measured to be wrong twice over: it said a bribed official and their
    // briber were equally invested, and it made every bought tie look mutual
    // to anything reading the graph for one-sided ones.
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
        // The buyer's own side does not grow. They have a useful person, which
        // is not the same as having somebody who matters to them.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT A FAILURE IS WORTH
// ─────────────────────────────────────────────────────────────────────────

/**
 * The severity written on a refusal, decided once at creation.
 *
 * `grudges.ts` forbids recomputing severity, and this does not recompute it -
 * it is the judgement whoever writes the record has to make, made from what
 * was actually put down rather than from a mood. Being offered money is
 * insulting. Being shown a secret somebody was holding over you is a different
 * order of thing, because they cannot un-show it.
 *
 * Everything here is SLIGHT or SERIOUS. A refusal is an embarrassment. The
 * grave and unforgivable rows are written by
 * `when-somebody-works-out-what-you-did.ts`, and that gap is the point: being
 * turned down is not the injury. Being used and finding out later is.
 */
function severityOfARefusal(leverage: ApproachLeverage, ask: AskWeight): Severity {
    if (leverage === 'secret' || leverage === 'force') return 'serious';
    if (ask === 'a_betrayal') return 'serious';
    return 'slight';
}

function refusalGrudge(input: AttemptInput, reached: boolean): ObligationInput {
    const leverage = input.approach?.leverage ?? 'none';
    return {
        kind: 'grudge',
        // The AGGRIEVED party holds it, the way `combat-manage.ts` writes a feud.
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

// ─────────────────────────────────────────────────────────────────────────
// THE RESOLVER
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resolve one attempt.
 *
 * Three rolls at most, all from the caller's seeded stream: whether it lands,
 * and then which kind of landing or which kind of failure it was. Same seed
 * and same state give the same answer forever.
 */
export function resolveAttempt(input: AttemptInput): AttemptResult {
    const { odds, terms } = oddsOf(input);
    const leverage = input.approach?.leverage ?? 'none';
    const patience = APPROACH_PATIENCE_EFFECT[input.approach?.patience ?? 'normal'];
    const days = Math.max(1, Math.round(ASK_DAYS[input.ask] * patience.duration));
    const audience = input.approach?.audience ?? 'alone';

    const landed = input.rng.next() < odds;

    if (!landed) {
        // ── THE FIFTH OUTCOME ────────────────────────────────────────────
        //
        // Read before the report roll, because a counter-offer is not a
        // refusal and there is nothing about it to carry to anybody's house.
        // The one term it turns on is the one the resolver has always priced
        // and nothing ever set: somebody with an open want that the person in
        // front of them could move does not say no, they say what they would
        // take. Nothing is written to the ledger and no tie moves - see the
        // header - and the days are still spent, because the conversation
        // happened.
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
                obligation: refusalGrudge(input, reached),
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

    // The counter-record. On `turned` it is the whole event: they did what was
    // asked and are now holding the fact that it was asked. Written as a DEBT
    // carried by the actor, because that is what it is - not a grudge, and not
    // something that goes away by being nice to them.
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

    // What the actor now holds, when they got something that cost the other
    // party. A favour is owed TO its holder.
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
            // They know what happened; they do not know what it was.
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
