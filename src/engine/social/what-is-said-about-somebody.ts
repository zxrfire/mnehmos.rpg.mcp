/**
 * What is said about somebody, what is known about them, and the gap between the
 * two.
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

/**
 * One thing somebody said, as it arrived. Structurally the world layer's
 * `Rumour`, minus the fields this module has no business reading. Note what is
 * NOT here: any flag saying whether it is true. The teller does not know and
 * neither does the listener.
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
     * Supplied by whoever rendered it, because it is a property of the SENTENCE
     * rather than of the world. `neither` is the commonest value and is not a
     * failure.
     */
    colour: 'well' | 'ill' | 'neither';
}

/** Which way a body of evidence points, as a word. Computed, never stored. */
export type Standing = 'well spoken of' | 'ill spoken of' | 'nothing said';

/**
 * Whether what is said and what is true are the same thing, from here. Derived
 * at read time and thrown away afterwards. NOT a classification of the person:
 * the same subject produces a different value for every observer.
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
     * The records this observer stands near enough to hold as fact. Empty for a
     * stranger even when the ledger is full, which is the mechanism the whole
     * model runs on.
     */
    known: ObligationRecord[];
    /** Shames this observer is on the short list for. */
    knownShames: ShameRecord[];
    /** What the records add up to. Nothing here is speech. */
    knownToBe: Standing;
    gap: TheGap;
    /**
     * How many records exist that this observer is too far away to hold. The
     * measure of their own ignorance, which they have no access to - it is here
     * for the engine and for a caller that wants to say "there is more to this
     * person than you have any way of knowing."
     */
    outOfReach: number;
    /** One factual line for the mechanical channel. Never narration. */
    note: string;
}

/**
 * Everything one person could honestly believe about another, right now.
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

    const heard = (input.heard ?? []).filter(t => t.namedIds.includes(input.subjectId));
    const saidToBe = weighTheTalk(heard);

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
        // explicit short list of who knows; an obligation does not, so its
        // parties hold it and everybody NEAR them can find out.
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
 * What a body of talk amounts to. Counted over the SENTENCES rather than the events
 * behind them, because a thing said forty times by forty people is said more than a
 * thing said once, whether or not it happened. Fidelity is not consulted on
 * purpose: a badly-degraded story is repeated in the same tone as a fresh one and a
 * listener has no way to discount it.
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
 * What the records this observer can vouch for amount to. A favour the subject
 * HOLDS is something they did for somebody; a grudge held ABOUT them is something
 * they did to somebody. Both directions of both kinds are read, because the ledger
 * is symmetric. Nothing is scored: this returns which side there is more of, and a
 * caller wanting a number has misread the design.
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
        // `leverage` is deliberately counted on neither side. Its whole value
        // is that it has not been said out loud, so a reputation that moved
        // when one was written would leak the fact the row exists to keep.
    }
    ill += shames.length;
    if (well === 0 && ill === 0) return 'nothing said';
    return well > ill ? 'well spoken of' : ill > well ? 'ill spoken of' : 'nothing said';
}

/** Whether the story and the facts agree, from where this observer stands. */
function readTheGap(
    saidToBe: Standing,
    knownToBe: Standing,
    recordsHeld: number
): TheGap {
    // First, and load-bearing: nothing held means nothing to check the story
    // against, whatever it says. Returning `it matches` here would be the
    // engine quietly confirming a rumour, the failure this module prevents.
    if (recordsHeld === 0) return 'no way of telling from here';
    if (saidToBe === 'nothing said') return 'nobody is saying anything';
    if (saidToBe === knownToBe) return 'it matches';
    if (saidToBe === 'well spoken of' && knownToBe === 'ill spoken of') return 'better than he is';
    if (saidToBe === 'ill spoken of' && knownToBe === 'well spoken of') return 'worse than he is';
    // Said one way, and what is held points neither way. Still a disagreement:
    // an observer close enough to hold records has nothing on what is said.
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
