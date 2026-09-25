/**
 * Somebody holding an art that draws on another has the subject at their mercy: keep them as a cultivation furnace, or take everything at once.
 *
 * Taking it all at once kills the subject, and it yields exactly what the rite's
 * own killing draw yields (`useAFurnaceTechnique` with the death drawn): what a
 * dead furnace gave up it gave up, and nothing more is invented here. Where the
 * art does not answer between the two of them (`worksBetween`, the rite core's
 * own test), there is nothing to draw at all, and taking it all is only a killing.
 *
 * Three things make a holder likelier to end it than keep it, and each is a
 * WEIGHT, never a gate - anybody may keep a furnace and anybody may end one:
 *
 *   the wait     a subject whole realms below the holder, on a slow root, is a
 *                long time from being worth drawing on;
 *   the art      a pairing the art does not answer between is worth nothing kept;
 *   temperament  somebody who goes at things head on does not wait for anything
 *                (`howHardTheyPush`), and somebody who goes around a thing does.
 *
 * Pure. The sample and every reading are the caller's.
 */

import { realmIndexOf } from '../cultivation/realms.js';

/** What keeping a furnace weighs, against which everything below is set. */
export const KEEPING_THEM = 1;

/** What taking it all weighs before anything about the two of them is read. */
export const TAKING_IT_ALL_AT_ONCE = 0.15;

/** Added for each whole major realm the subject stands below the holder. */
export const FOR_EACH_REALM_THEY_WOULD_HAVE_TO_WAIT = 0.35;

/**
 * Added, at most, for a slow root: scaled by how far under an even pace
 * (`cultivationSpeed` 1) the subject's root cultivates.
 */
export const FOR_A_SLOW_ROOT = 0.6;

/** Added where the art does not answer between them, so keeping them draws nothing. */
export const WHEN_THE_ART_DOES_NOT_ANSWER = 3;

/** How far temperament moves the weight of taking it all, at the ends of the push axis. */
export const WHAT_TEMPERAMENT_DOES_TO_IT = 0.5;

export interface AtTheirMercy {
    holderOrdinal: number;
    subjectOrdinal: number;
    /** The subject's root's `cultivationSpeed`. */
    subjectRootSpeed: number;
    /** Whether the holder's art answers between the two of them. */
    theArtAnswers: boolean;
    /** The holder's `howHardTheyPush`, -1..1. */
    holderPush: number;
}

/** The chance the holder takes everything at once rather than keeping the subject. */
export function theChanceTheyTakeItAll(input: AtTheirMercy): number {
    const realms = Math.max(0, realmIndexOf(input.holderOrdinal) - realmIndexOf(input.subjectOrdinal));
    const slow = Math.max(0, Math.min(1, 1 - input.subjectRootSpeed));
    const push = Number.isFinite(input.holderPush) ? Math.max(-1, Math.min(1, input.holderPush)) : 0;
    const taking = (TAKING_IT_ALL_AT_ONCE
        + realms * FOR_EACH_REALM_THEY_WOULD_HAVE_TO_WAIT
        + slow * FOR_A_SLOW_ROOT
        + (input.theArtAnswers ? 0 : WHEN_THE_ART_DOES_NOT_ANSWER))
        * (1 + push * WHAT_TEMPERAMENT_DOES_TO_IT);
    return Number((taking / (taking + KEEPING_THEM)).toFixed(4));
}

/** Whether they take it all, off a `[0,1)` sample, or when an operator forces it. */
export function doTheyTakeItAll(input: AtTheirMercy, sample: number, forced = false): boolean {
    return forced || sample < theChanceTheyTakeItAll(input);
}
