/**
 * Whether somebody's presence registers on you at all. Two ordinals and a
 * predicate in, a boolean out; no threshold of its own - it is the
 * `unreachable` band of `REGARD_BANDS` (nine rungs or more) and nothing else.
 * Not `concealmentScale`, which is a population share and would need a
 * threshold picked here. Never blindness: a known face wins at any height.
 */

import { regardFor } from '../cultivation/regard.js';

/**
 * The gap alone, ignoring anything either of them knows about the other.
 *
 * Asymmetric on purpose: the band is read from OBSERVER to OBSERVED, so
 * standing higher notices more people, and nobody is hidden by being beneath.
 */
export function heightAloneWouldHideThem(
    theirOrdinal: number,
    yourOrdinal: number
): boolean {
    // `regardFor(gate, asker)` reads the gap as asker minus gate, so the person
    // looked AT is the gate. Reversed it hides everybody beneath you - the
    // mirror-image bug, and it reads identically from the call site.
    // `band` and not `physicalBand`: a concealment that held should hide its
    // holder here too. With no approach declared the two are the same value.
    return regardFor(theirOrdinal, yourOrdinal).band === 'unreachable';
}

/**
 * `known` is checked first and wins outright: owner's ruling that a visible
 * elder, somebody who has spoken to you, or a figure whose presence is the
 * whole point of a scene stays visible at any height. It is any live
 * `isAwareOf` row, so a `whisper` counts - a person you can count but not name.
 */
export function noticesThatTheyAreThere(input: {
    theirOrdinal: number;
    yourOrdinal: number;
    known: boolean;
}): boolean {
    if (input.known) return true;
    return !heightAloneWouldHideThem(input.theirOrdinal, input.yourOrdinal);
}
