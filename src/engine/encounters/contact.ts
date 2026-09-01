/**
 * The people you live with.
 *
 * `duties.ts` gives a member obligations and access. Neither of those is what
 * makes a sect feel like somewhere you live. That is the senior sister who
 * comes to check whether you are still breathing, the rival at your own rung
 * who has decided something about you, the elder who remembers your name, and
 * the junior who resents that you were promoted and they were not.
 *
 * None of it is a duty and none of it is danger. It is the texture of
 * belonging, and without it a membership is a stipend and a list of chores.
 *
 * ── There is no contact catalog either ───────────────────────────────────
 *
 * `members.ts` already generates a real roster per faction - 164 people with
 * names, rungs, ranks, and four fields this module lives on:
 *
 *   role         peer / rival / master / senior
 *   wants        what they are actually after
 *   fears        what they will not say out loud
 *   detail       the small true thing they do
 *   rivalry      a grievance, and why they can be beaten
 *   teaching     what they know, what they may not say, what saying it costs
 *   goodCompany  whether being around them is any good
 *
 * That is a cast. This file decides which of them turns up, what KIND of
 * contact it is, and what it does to the record - and it authors no person, no
 * grievance and no line of dialogue.
 *
 * ── What kind of contact it is, is derived ───────────────────────────────
 *
 * From two things: their role, and where they stand relative to you. A senior
 * with something to teach offers it; a senior without checks on you; a peer
 * with a grievance is friction; a peer who is good company is company; anybody
 * below you who watched you rise has an opinion about it. No branch names a
 * person, and adding a member to `members.ts` gives them a social life for
 * free.
 *
 * ── Accumulation is the whole point ──────────────────────────────────────
 *
 * The failure this exists to avoid is a world of first meetings. Every contact
 * carries a `tie` describing what it does to the `relationships` row for that
 * pair, and because `createRelationship` derives a stable id from the pair, the
 * caller reads, applies and writes back. Meeting the same person twelve times
 * over forty years is one relationship with twelve events on it, moving from
 * `sect_mate` through `friend` or `rival` and, for a master who kept teaching,
 * to `master`. Strength rises with diminishing returns, so a tie deepens fast
 * at first and then slowly, which is how they actually work.
 */

import { regardFor } from '../cultivation/regard.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import type { EncounterActivity, Locatability, Membership } from './types.js';
import { locatabilityApplies, socialReach } from './activity.js';

// ─────────────────────────────────────────────────────────────────────────
// CADENCE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Chance per turn that somebody from the house turns up, at full reach.
 *
 * Higher than any other check in this layer, and deliberately so. Danger
 * should be rare and company should not be: the whole point is that belonging
 * is something you feel constantly rather than twice a decade.
 */
export const CONTACT_TURN_CHANCE = 0.16;
/** Chance per grid check across a span. */
export const CONTACT_SPAN_CHANCE = 0.02;

// ─────────────────────────────────────────────────────────────────────────
// THE CAST
// ─────────────────────────────────────────────────────────────────────────

/** Somebody on the house's roster, as this module reads them. */
export interface ContactPerson {
    id: string;
    name: string;
    /** Index into the house's own rank array. */
    rankIndex: number;
    realmOrdinal: number;
    role: 'peer' | 'rival' | 'master' | 'senior';
    /** What they are after. Content from `members.ts`, never composed here. */
    wants?: string | null;
    fears?: string | null;
    detail?: string | null;
    goodCompany?: boolean;
    /** They hold a personal grievance, and what it is over. */
    grievance?: string | null;
    /** They have something bounded to teach, and what it is. */
    teaches?: string | null;
    /** True when the player already has a knowledge record for them. */
    known?: boolean;
    /** What the record already says. Null the first time they meet. */
    standing?: Standing | null;
}

/** The relationship row as it stands, reduced to what accumulation needs. */
export interface Standing {
    type: string;
    strength: number;
    /** How many recorded events are already on it. */
    times: number;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT KIND OF CONTACT
// ─────────────────────────────────────────────────────────────────────────

export type ContactKind =
    /** Somebody senior noticed they had not been seen. */
    | 'checked_on'
    /** An elder who remembers their name offers something bounded. */
    | 'instruction'
    /** Ordinary company. A meal, a walk, blades sharpened badly for the company. */
    | 'company'
    /** A rival at their own rung who has decided something about them. */
    | 'friction'
    /** Somebody below who watched them rise and has an opinion. */
    | 'resentment'
    /** Somebody junior asking them for something. */
    | 'asked'
    /** Ordinary house business, carried by a person rather than a notice. */
    | 'errand';

export interface Contact {
    kind: ContactKind;
    person: ContactPerson;
    /** Engine-authored and factual. Built from the member's own fields. */
    line: string;
    /**
     * Whether this hands control back.
     *
     * Most contact does not. Company is not a decision, and stopping the game
     * for it would make belonging feel like an interruption, which is the
     * opposite of the intent. An offer and a challenge do stop it, because
     * both are asking for an answer.
     */
    interrupts: boolean;
    /** What this does to the record for this pair. */
    tie: TieChange;
}

/**
 * The accumulation instruction.
 *
 * Deltas rather than absolutes, so the caller reads the existing row, applies
 * this, and writes it back. Nothing here computes a final state, because the
 * final state depends on a row this module has never seen.
 */
export interface TieChange {
    /** `RelationshipType` from the social layer, as a string. */
    type: string;
    /** Added to `strength`, already damped for diminishing returns. */
    strengthDelta: number;
    significance: 'incidental' | 'notable' | 'defining';
    /** Plain words, per the social layer's contract. Never a number. */
    attitude: string;
    /** `relationship_events.kind`. */
    eventKind: string;
    /** `relationship_events.summary`. Factual. */
    eventSummary: string;
    /** Roles to add: 'owes_a_favour', 'shares_a_secret'. */
    roles: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// THE DRAW
// ─────────────────────────────────────────────────────────────────────────

export interface ContactInput {
    ordinal: number;
    membership: Membership | null;
    /** The house's roster. Supplied; this module invents nobody. */
    roster: readonly ContactPerson[];
    activity: EncounterActivity;
    locatability: Locatability;
    /** Absolute day, for the record. */
    onDay: number;
    rng: CultivationRNG;
}

/**
 * Somebody from the house, turning up.
 *
 * Returns null with no membership, with an empty roster, and when nobody on
 * the roster is at a rung where contact would happen at all - the Pavilion
 * Master does not drop in on a Sword Servant to see how they are getting on.
 */
export function contactFor(input: ContactInput): Contact | null {
    if (!input.membership || input.roster.length === 0) return null;

    // Somebody has to know where you are to drop in on you. This is the same
    // reach the rest of the layer uses, and it is what makes a seclusion on
    // house ground a different act from one nobody has an address for: the
    // senior sister who checks on you cannot check on somebody she cannot find.
    const reach = locatabilityApplies(input.activity)
        ? socialReach(input.locatability)
        : 1;
    if (reach <= 0 || input.rng.next() >= reach) return null;

    const pool = withinSocialRange(input.roster, input.ordinal);
    if (pool.length === 0) return null;

    // Weighted toward people already known, because a house is a small number
    // of people you keep running into rather than a stream of strangers. This
    // is the mechanical form of "accumulate rather than reset".
    const person = pickPerson(pool, input.ordinal, input.rng);
    const kind = kindFor(person, input.ordinal);

    return {
        kind,
        person,
        line: lineFor(kind, person, input.membership, input.ordinal),
        interrupts: kind === 'instruction' || kind === 'friction',
        tie: tieFor(kind, person, input.onDay)
    };
}

/**
 * How often somebody at this distance turns up, relative to a peer.
 *
 * A weighting rather than a cut, and the asymmetry is the point. Contact
 * upward is INITIATED BY THEM: an elder nine rungs above a servant can decide
 * to notice that servant, and when it happens it is one of the more
 * significant things in that servant's life. Cutting it off entirely - which
 * the first version of this file did - deleted the "elder who remembers your
 * name" case the whole module was asked for, because in every real roster the
 * people with something to teach are exactly the people far above you.
 *
 * Downward is different. `dismissed` is seventeen or more rungs below, and
 * that is not somebody you have a social life with; it is somebody who has
 * been told to stay out of your way.
 */
const SOCIAL_WEIGHT: Readonly<Record<string, number>> = {
    unreachable: 0.15,
    overmatched: 0.6,
    stretch: 1,
    matched: 1,
    assured: 1,
    beneath: 0.4,
    dismissed: 0
};

export function socialWeightFor(personOrdinal: number, ordinal: number): number {
    return SOCIAL_WEIGHT[regardFor(personOrdinal, ordinal).band] ?? 1;
}

/**
 * Who could turn up at all.
 *
 * Only `dismissed` is excluded outright. Everybody else is in, at a frequency
 * {@link socialWeightFor} decides.
 */
export function withinSocialRange(
    roster: readonly ContactPerson[],
    ordinal: number
): ContactPerson[] {
    return roster.filter(person => socialWeightFor(person.realmOrdinal, ordinal) > 0);
}

/**
 * Somebody they already know, usually.
 *
 * Three quarters of the weight on people with a standing record. A house where
 * every encounter is a new face is a hotel.
 */
function pickPerson(
    pool: readonly ContactPerson[],
    ordinal: number,
    rng: CultivationRNG
): ContactPerson {
    const weights = pool.map(p =>
        (p.standing ? 3 : 1) * socialWeightFor(p.realmOrdinal, ordinal));
    const total = weights.reduce((a, b) => a + b, 0);
    let cursor = rng.next() * total;
    for (let i = 0; i < pool.length; i++) {
        cursor -= weights[i];
        if (cursor < 0) return pool[i];
    }
    return pool[pool.length - 1];
}

/**
 * What sort of contact this is.
 *
 * Read off the member's own columns and the gap. Every row here is a fact
 * about the person that `members.ts` already stated.
 */
export function kindFor(person: ContactPerson, ordinal: number): ContactKind {
    const above = person.realmOrdinal - ordinal;

    // A grievance is a grievance whoever holds it, and it is the loudest thing
    // about them.
    if (person.grievance) return above < -2 ? 'resentment' : 'friction';
    if (person.role === 'rival') return above < -2 ? 'resentment' : 'friction';

    if (above >= 2) {
        // Somebody above with something bounded to give, gives it. Somebody
        // above with nothing to give still notices you are not about.
        return person.teaches ? 'instruction' : 'checked_on';
    }
    if (above <= -2) return 'asked';
    return person.goodCompany ? 'company' : 'errand';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT SAYS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The factual line.
 *
 * Built entirely from what `members.ts` already holds about this person -
 * their `detail`, their `wants`, their `fears`, their grievance, what they
 * teach. The narrator writes the scene; this is the fact it is written from,
 * and a beat that named nothing true about the person would be this module
 * inventing a character.
 */
function lineFor(
    kind: ContactKind,
    person: ContactPerson,
    membership: Membership,
    ordinal: number
): string {
    const who = `${person.name} of ${membership.factionName}`;
    const detail = person.detail ? ` ${person.detail}` : '';

    switch (kind) {
        case 'checked_on':
            return `${who}, ${ranksAbove(person, membership, ordinal)}, has come to see whether ` +
                `this cultivator is still about.${detail} Nothing was required and nothing ` +
                'was asked for.';
        case 'instruction':
            return `${who} has offered instruction in what they actually hold: ` +
                `${trim(person.teaches)}. They have not said what it costs them to say it.${detail}`;
        case 'company':
            return `${who} has spent the evening in this cultivator's company for no ` +
                `stated reason.${detail}` +
                (person.wants ? ` What they are after, if anybody asked: ${trim(person.wants)}.` : '');
        case 'friction':
            return `${who} has a standing grievance, and it is this: ${trim(person.grievance)}. ` +
                `They have brought it up in front of others.${detail}`;
        case 'resentment':
            return `${who}, below this cultivator on the house ladder, has been saying ` +
                `things.${person.grievance ? ` The quarrel is this: ${trim(person.grievance)}.` : ''}` +
                `${person.fears ? ` What they will not say out loud: ${trim(person.fears)}.` : ''}`;
        case 'asked':
            return `${who}, junior to this cultivator, has asked them for something.` +
                `${person.wants ? ` What they want is ${trim(person.wants)}.` : ''}${detail}`;
        case 'errand':
            return `${who} has brought house business in person rather than by notice.${detail}`;
    }
}

/**
 * Where they stand, said in whichever ladder actually separates the two.
 *
 * Rank and realm are different ladders and they routinely disagree - thirty-one
 * years an outer disciple is a real thing to be - so saying "at the same rung"
 * about somebody two realms above reads as a mistake. Rank first, because it is
 * what a house cares about; realm when rank does not separate them.
 */
function ranksAbove(person: ContactPerson, membership: Membership, ordinal: number): string {
    const rankGap = person.rankIndex - membership.rankIndex;
    if (rankGap > 0) return rankGap === 1 ? 'one rung above them' : `${rankGap} rungs above them`;

    const realmGap = person.realmOrdinal - ordinal;
    if (realmGap > 0) {
        return `at the same rung of the house and ${realmGap} ` +
            `${realmGap === 1 ? 'realm' : 'realms'} further on`;
    }
    return 'at the same rung of the house';
}

/** Content from `members.ts`, trimmed of a trailing stop so it can be embedded. */
function trim(text: string | null | undefined): string {
    return (text ?? '').trim().replace(/[.]+$/u, '');
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT DOES TO THE RECORD
// ─────────────────────────────────────────────────────────────────────────

/** Added strength on a first meeting, before damping. */
export const CONTACT_STRENGTH_STEP = 0.11;

/**
 * Where a tie stands after this, as a delta.
 *
 * Diminishing returns: the step is scaled by how much room is left, so a tie
 * deepens quickly at first and slowly after, which is how they actually work
 * and which stops forty years of company producing a strength of 1 by year
 * three.
 */
export function tieFor(kind: ContactKind, person: ContactPerson, onDay: number): TieChange {
    const standing = person.standing;
    const current = standing?.strength ?? 0;
    const times = (standing?.times ?? 0) + 1;
    const strengthDelta = round4(CONTACT_STRENGTH_STEP * (1 - current));
    const next = Math.min(1, current + strengthDelta);

    const warm = kind === 'company' || kind === 'checked_on' ||
        kind === 'instruction' || kind === 'asked';

    return {
        type: typeFor(kind, person, next),
        strengthDelta,
        significance: next >= 0.6 ? 'defining' : next >= 0.25 ? 'notable' : 'incidental',
        attitude: attitudeFor(times, warm),
        eventKind: kind,
        eventSummary: `[day ${onDay}] ${EVENT_SUMMARY[kind]} (${times} recorded between them).`,
        roles: kind === 'instruction'
            ? ['owes_a_favour']
            : kind === 'asked'
                ? ['is_owed_a_favour']
                : []
    };
}

/**
 * The tie's name, which changes as it accumulates.
 *
 * `sect_mate` is where everybody starts, because it is the institutional fact
 * and it is true of the whole roster. What it becomes is earned by repetition,
 * and the ladder is short on purpose: most people in a house stay sect-mates
 * for three hundred years, and the handful who do not are the story.
 */
function typeFor(kind: ContactKind, person: ContactPerson, strength: number): string {
    if (kind === 'friction' || kind === 'resentment') {
        return strength >= 0.55 ? 'enemy' : strength >= 0.25 ? 'rival' : 'faction_rival';
    }
    if (kind === 'instruction' && strength >= 0.55) return 'master';
    if (person.role === 'senior' && strength >= 0.4) return 'senior_brother';
    if (strength >= 0.45) return 'friend';
    return 'sect_mate';
}

/**
 * In plain words, per the social layer's contract.
 *
 * The table is explicit that attitude is prose and must never be reduced to a
 * number, because "a bitter former disciple has a very strong tie and a hostile
 * attitude" is a plot a single scalar erases.
 */
function attitudeFor(times: number, warm: boolean): string {
    if (!warm) {
        return times <= 1
            ? 'has decided something about them and has not said what'
            : times < 4
                ? 'a standing dislike that has now been aired more than once'
                : 'settled hostility, and long past explaining itself';
    }
    return times <= 1
        ? 'nothing much yet, beyond having been in the same room'
        : times < 4
            ? 'the beginnings of something, unstated on both sides'
            : times < 9
                ? 'the easy familiarity of people who keep turning up'
                : 'one of the few people they would actually go to';
}

const EVENT_SUMMARY: Readonly<Record<ContactKind, string>> = {
    checked_on: 'Came to see whether they were still about',
    instruction: 'Offered instruction and did not say what it cost them',
    company: 'Kept them company for no stated reason',
    friction: 'Aired a standing grievance in front of others',
    resentment: 'Has been saying things, from below',
    asked: 'Asked them for something',
    errand: 'Brought house business in person'
};

function round4(n: number): number {
    return Math.round(n * 10000) / 10000;
}
