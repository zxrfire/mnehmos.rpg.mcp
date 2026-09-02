/**
 * What is said about somebody, what is known about them, and the gap between
 * the two.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * REPUTATION IS NOT THE LEDGER, AND THE GAP IS THE FEATURE
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   THE LEDGER IS WHAT HAPPENED.   Grudges, favours, oaths. The engine knows
 *                                  these for certain and they never move.
 *   REPUTATION IS WHAT IS SAID.    It is downstream of the ledger and NOT EQUAL
 *                                  TO IT, because it travels through people,
 *                                  and people are partial, ignorant, loyal and
 *                                  afraid.
 *
 * So this module computes, it never stores. There is no reputation column, no
 * score, and no `reputationType` field - AGENTS.md's *a field nothing writes*
 * entry ends with the rule that produced this design: **prefer deriving to
 * storing where the answer moves.** A written reputation goes stale the instant
 * somebody does something, and then it lies with a straight face.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE WHOLE MODEL IS ONE ASYMMETRY
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   TRUTH DEPENDS ON PROXIMITY. At a distance you get the story and cannot
 *   tell whether it is true. Close in you get the fact.
 *
 * Everything falls out of that and nothing is enumerated:
 *
 *   A GOOD NAME THAT IS DESERVED     favours on the ledger, and the story
 *                                    agrees with them.
 *   A GOOD NAME THAT IS NOT          people say generous things; what is on the
 *                                    ledger is held by three people who were
 *                                    there and has never been said out loud.
 *   NOBODY SPEAKS WELL OF A DECENT   the ledger is clean or better; the stories
 *   PERSON                           in circulation are bad ones, and a bad
 *                                    report is NOT evidence of a bad deed.
 *   THE HOUSE KNOWS WHAT HE IS       near observers hold the records; distant
 *                                    ones hold the praise. Same person, two
 *                                    completely different answers, no branch.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * TWO FIELDS, AND THEY ARE DELIBERATELY NOT THE SAME FIELD
 * ═════════════════════════════════════════════════════════════════════════
 *
 * CONCEALMENT is about who HOLDS a fact - `heldBy` in `shame.ts`, and the
 * `participants` on an obligation. Few know; nothing is said either way.
 *
 * A FAKE GOOD NAME is about what is actively SAID. Praise, in circulation, that
 * is not earned. That needs speech, not silence.
 *
 * You can have either without the other, and one field could not carry both -
 * a wrong nobody has any opinion about would be indistinguishable from a man
 * being admired for things he did not do. So {@link WhatIsSaid} keeps `heard`
 * and `known` apart and never reconciles them. The caller reads the gap.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * SLANDER IS REAL AND IS NOT EVIDENCE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The hard constraint, and the one that keeps this from collapsing back into
 * reputation-is-truth-with-extra-steps: **a bad report must not imply a bad
 * deed.** Nothing in this file checks a rumour against the ledger, and nothing
 * upgrades a story into a fact because it was repeated. The gossip layer
 * already produces `misattributed` (somebody real, named for somebody else's
 * real deed) and `invented` (two real events run together), and both arrive
 * here rendered exactly as confidently as the truth does. Somebody with enemies
 * can acquire a name they did not earn, and the only cure is that somebody gets
 * near enough to know better.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT IT READS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `hands` is the proximity axis for speech and there is no second distance
 * model: *"this reached you sixth-hand"* and *"you are a long way from where it
 * happened"* are the same statement, and `what-people-are-saying.ts` already
 * computes it off real distances the world stores. {@link Told} is declared
 * structurally rather than imported so this module stays in the social layer
 * and takes no dependency on `WorldState`; the world's own `Rumour` satisfies
 * it as it stands.
 *
 * Pure. No state, no rolls, no I/O, no ladder.
 */

import type { DayIndex } from './common.js';
import type { ObligationRecord } from './grudges.js';
import type { ShameRecord } from './shame.js';
import {
    closeEnoughToKnow,
    howNearTheyStand,
    type Nearness,
    type Proximity,
    type TheOtherPerson,
    type WhereTheyStand
} from './how-near-you-stand-to-somebody.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT REACHED THEM
// ─────────────────────────────────────────────────────────────────────────

/**
 * One thing somebody said, as it arrived.
 *
 * Structurally the world layer's `Rumour`, minus the fields this module has no
 * business reading. Note what is NOT here: any flag saying whether it is true.
 * The teller does not know and neither does the listener, and a field carrying
 * the answer would be the rumour with the solution printed underneath it.
 */
export interface Told {
    /** What was actually said. */
    text: string;
    /** How many people it passed through. One means they were there. */
    hands: number;
    /** 0..1, what survived the retelling. Never a probability of anything. */
    fidelity: number;
    /** Everybody the telling names. Ids, so a caller can filter by subject. */
    namedIds: readonly string[];
    /**
     * Whether the telling puts the subject in a good light or a bad one.
     *
     * Supplied by whoever rendered it, because it is a property of the SENTENCE
     * rather than of the world - and it is the whole of what makes praise
     * different from silence. A telling that says nothing either way is
     * `neither`, which is the commonest value and is not a failure.
     */
    colour: 'well' | 'ill' | 'neither';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THEY END UP WITH
// ─────────────────────────────────────────────────────────────────────────

/** Which way a body of evidence points, as a word. Computed, never stored. */
export type Standing = 'well spoken of' | 'ill spoken of' | 'nothing said';

/**
 * Whether what is said and what is true are the same thing, from here.
 *
 * Derived at read time from the two lists and thrown away afterwards. It is
 * NOT a classification of the person: the same subject produces a different
 * value for every observer, which is the entire point.
 */
export type TheGap =
    /** They stand too far off to have anything but the story. */
    | 'no way of telling from here'
    /** What is said and what they can vouch for agree. */
    | 'it matches'
    /** They are praised, and this observer holds records that say otherwise. */
    | 'better than he is'
    /** They are ill spoken of, and this observer holds nothing that supports it. */
    | 'worse than he is'
    /** Nothing is said in either direction, and there is something to say. */
    | 'nobody is saying anything';

export interface WhatIsSaid {
    subjectId: string;
    observerId: string;
    proximity: Proximity;
    /** The stories that reached this observer, as they reached them. */
    heard: Told[];
    /** What the stories add up to. Speech only. Never checked against anything. */
    saidToBe: Standing;
    /**
     * The records this observer stands near enough to hold as fact.
     *
     * Empty for a stranger even when the ledger is full, which is correct and
     * is the mechanism the whole model runs on.
     */
    known: ObligationRecord[];
    /** Shames this observer is on the short list for. */
    knownShames: ShameRecord[];
    /** What the records add up to. Nothing here is speech. */
    knownToBe: Standing;
    gap: TheGap;
    /**
     * How many records exist that this observer is too far away to hold.
     *
     * The measure of their own ignorance, which they do not have access to -
     * it is here for the engine, for probes, and for a caller that wants to say
     * "there is more to this person than you have any way of knowing."
     */
    outOfReach: number;
    /** One factual line for the mechanical channel. Never narration. */
    note: string;
}

// ─────────────────────────────────────────────────────────────────────────
// THE READ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Everything one person could honestly believe about another, right now.
 *
 * Two independent passes that are never allowed to inform each other:
 *
 *   WHAT REACHED THEM   filtered by whether the subject is named in it. No
 *                       ledger lookup anywhere in this pass.
 *   WHAT THEY HOLD      filtered by `closeEnoughToKnow`. No rumour lookup
 *                       anywhere in this pass.
 *
 * Then the gap is read off the two answers. Keeping the passes apart is not
 * tidiness; it is the only reason slander survives contact with this function.
 */
export function whatIsSaidAbout(input: {
    subjectId: string;
    observer: WhereTheyStand;
    /** Where the subject is and what house they answer to. */
    subject: TheOtherPerson;
    /** Everything in circulation that reached this observer. */
    heard?: readonly Told[];
    /** Every record on the ledger touching the subject, in any capacity. */
    ledger?: readonly ObligationRecord[];
    /** Every shame the subject carries. */
    shames?: readonly ShameRecord[];
    /** Only records incurred on or before this day, when the caller has one. */
    asOfDay?: DayIndex;
}): WhatIsSaid {
    const observerId = input.observer.observerId;
    const proximity = howNearTheyStand(input.observer, input.subject);

    // ── WHAT REACHED THEM ────────────────────────────────────────────────
    const heard = (input.heard ?? []).filter(t => t.namedIds.includes(input.subjectId));
    const saidToBe = weighTheTalk(heard);

    // ── WHAT THEY HOLD ───────────────────────────────────────────────────
    const known: ObligationRecord[] = [];
    let outOfReach = 0;
    for (const record of input.ledger ?? []) {
        if (record.status !== 'open') continue;
        if (input.asOfDay !== undefined && record.incurredOnDay > input.asOfDay) continue;
        if (record.holderId !== input.subjectId && record.subjectId !== input.subjectId) continue;
        const wasThere =
            record.holderId === observerId
            || record.subjectId === observerId
            || record.participants.includes(observerId);
        // No `heldBy` for an obligation, and that is the difference between the
        // two record types rather than an oversight. A shame carries an
        // explicit short list of who knows and that list is the whole of the
        // fact. An obligation does not: its parties hold it, and everybody
        // NEAR them can find out, which is exactly how a house comes to know
        // what one of its own did without anybody having published it.
        if (closeEnoughToKnow({ proximity: proximity.nearness, observerId, wasThere })) {
            known.push(record);
        } else {
            outOfReach++;
        }
    }

    const knownShames: ShameRecord[] = [];
    for (const shame of input.shames ?? []) {
        if (shame.subjectId !== input.subjectId) continue;
        if (shame.status !== 'carried') continue;
        if (input.asOfDay !== undefined && shame.incurredOnDay > input.asOfDay) continue;
        if (shame.common || closeEnoughToKnow({
            proximity: proximity.nearness,
            heldBy: shame.heldBy,
            observerId
        })) {
            knownShames.push(shame);
        } else {
            outOfReach++;
        }
    }

    const knownToBe = weighTheRecords(input.subjectId, known, knownShames);

    return {
        subjectId: input.subjectId,
        observerId,
        proximity,
        heard,
        saidToBe,
        known,
        knownShames,
        knownToBe,
        gap: readTheGap(saidToBe, knownToBe, known.length + knownShames.length),
        outOfReach,
        note: noteFor(proximity.nearness, saidToBe, knownToBe, outOfReach)
    };
}

/**
 * What a body of talk amounts to.
 *
 * Counted, not weighted, and counted over the sentences rather than over the
 * events behind them - which is the honest arithmetic for a reputation, because
 * a thing said forty times by forty people IS said more than a thing said once,
 * whether or not it happened. Fidelity is not consulted here on purpose: a
 * badly-degraded story is repeated in exactly the same tone as a fresh one, and
 * a listener has no way to discount it.
 */
function weighTheTalk(heard: readonly Told[]): Standing {
    let well = 0;
    let ill = 0;
    for (const told of heard) {
        if (told.colour === 'well') well++;
        else if (told.colour === 'ill') ill++;
    }
    if (well === 0 && ill === 0) return 'nothing said';
    return well > ill ? 'well spoken of' : ill > well ? 'ill spoken of' : 'nothing said';
}

/**
 * What the records this observer can actually vouch for amount to.
 *
 * A favour the subject HOLDS is something they did for somebody. A grudge held
 * ABOUT them is something they did to somebody. Both directions of both kinds
 * are read, because the ledger is symmetric and a reputation that only counted
 * the ugly half would be a claim about the world that nobody has made.
 *
 * Nothing is scored and nothing accumulates: this returns which side there is
 * more of, and any caller that wants a number has misread the design.
 */
function weighTheRecords(
    subjectId: string,
    known: readonly ObligationRecord[],
    shames: readonly ShameRecord[]
): Standing {
    let well = 0;
    let ill = 0;
    for (const record of known) {
        const theirs = record.holderId === subjectId;
        if (record.kind === 'favor') {
            // They hold it: they did somebody a kindness. It is held about
            // them: somebody did them one, which says nothing about them.
            if (theirs) well++;
        } else if (record.kind === 'grudge' || record.kind === 'blood_feud') {
            if (!theirs) ill++;
        } else if (record.kind === 'debt') {
            if (theirs) ill++;
        }
        // `leverage` is deliberately counted on neither side. Somebody holding
        // a thing over this person says nothing about what this person is like
        // - and its whole value is that it has not been said out loud, so a
        // reputation that moved when one was written would be leaking the fact
        // the row exists to keep.
    }
    ill += shames.length;
    if (well === 0 && ill === 0) return 'nothing said';
    return well > ill ? 'well spoken of' : ill > well ? 'ill spoken of' : 'nothing said';
}

/**
 * Whether the story and the facts agree, from where this observer stands.
 *
 * The first branch is the load-bearing one and it is a refusal rather than an
 * answer: somebody far away holds no facts, so there is nothing to compare the
 * story to and the honest report is that they cannot tell. Returning `it
 * matches` there would be the engine quietly confirming a rumour, which is the
 * exact failure this module exists to prevent.
 */
function readTheGap(
    saidToBe: Standing,
    knownToBe: Standing,
    recordsHeld: number
): TheGap {
    // Nothing held means nothing to check the story against, whatever the
    // story says. Returning `it matches` here would be the engine quietly
    // confirming a rumour, which is the exact failure this module prevents.
    if (recordsHeld === 0) return 'no way of telling from here';
    if (saidToBe === 'nothing said') return 'nobody is saying anything';
    if (saidToBe === knownToBe) return 'it matches';
    if (saidToBe === 'well spoken of' && knownToBe === 'ill spoken of') return 'better than he is';
    if (saidToBe === 'ill spoken of' && knownToBe === 'well spoken of') return 'worse than he is';
    // Said one way, and what is held points neither way. Still a disagreement:
    // the person is being talked about for something this observer, who is
    // close enough to hold records, has nothing on.
    return saidToBe === 'well spoken of' ? 'better than he is' : 'worse than he is';
}

function noteFor(
    nearness: Nearness,
    saidToBe: Standing,
    knownToBe: Standing,
    outOfReach: number
): string {
    if (nearness === 'distant' || nearness === 'nearby') {
        return saidToBe === 'nothing said'
            ? 'Nobody has said anything about them within earshot, which is most of what most '
              + 'people are.'
            : `They are ${saidToBe} out here. From this far away there is no way to find out `
              + 'whether any of it is true, and a story about a decent person sounds exactly '
              + 'like a story about a bad one.';
    }
    if (saidToBe === 'nothing said' && knownToBe !== 'nothing said') {
        return 'Nobody says anything about them either way, and there is something to say. Being '
            + 'close enough to know is not the same as anybody having told you.';
    }
    if (saidToBe !== knownToBe) {
        return `They are ${saidToBe}, and what the people around them actually hold does not `
            + `support it${outOfReach > 0
                ? '. And there is more on the ledger than even this vantage reaches'
                : ''}.`;
    }
    return `What is said about them and what the people near them hold agree${
        outOfReach > 0 ? ', as far as this vantage goes' : ''}.`;
}
