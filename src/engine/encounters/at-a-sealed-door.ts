/**
 * Somebody who came to settle an account reaches a sealed door, and what they do there.
 *
 * They behave as people do. How badly they want what they came for is the
 * account's own severity, and nothing else is added:
 *
 *   slight          nobody smashes a door over it. They go, and the account keeps
 *                   its ordinary timing for another day.
 *   serious and up  they try. Their strength against the door's rung decides it,
 *                   by the engine's one rule for force against a rated thing
 *                   (`canUnmake`: a rung reaches what is rated at it): reaching it,
 *                   the door breaks and the fight follows; short of it, they are
 *                   stopped, and either wait outside or go.
 *
 * Waiting is a weighted draw, never a gate: the heavier the account the likelier
 * and the longer, and the holder's temperament (`howHardTheyPush`: somebody who
 * goes around a thing and lets it come to them) moves both. Somebody still
 * waiting when the sitter comes out is at the door, and it is the same
 * confrontation the account would have been. Somebody who went leaves a trace
 * the sitter perceives on coming out - unless they stood a whole major realm
 * above the sitter, which leaves nothing a person that far below could read.
 *
 * Pure. The strength, the temperament and the door are the caller's.
 */

import type { Severity } from '../social/grudges.js';
import { realmIndexOf } from '../cultivation/realms.js';
import { canUnmake } from '../cultivation/whether-a-weapon-survives-being-used.js';

/** The door, as this file reads it. `door-materials.ts`'s `TheDoor` satisfies it. */
export interface TheDoorTheySitBehind {
    readonly name: string;
    readonly standsAt: number;
    readonly whose: 'the_inn' | 'the_house' | 'yours';
}

/** The lightest account that is worth putting a shoulder to a door for. */
export const WORTH_BREAKING_A_DOOR_FOR: readonly Severity[] = Object.freeze(['serious', 'grave', 'unforgivable']);

/**
 * How likely somebody stopped at the door waits outside it rather than going, by
 * how badly they want it. Before temperament.
 */
export const HOW_OFTEN_THEY_WAIT: Readonly<Record<Severity, number>> = Object.freeze({
    slight: 0,
    serious: 0.3,
    grave: 0.55,
    unforgivable: 0.75
});

/**
 * How long they wait, in days, by how badly they want it. Before temperament. A
 * grave account waits a season and more; one written to end somebody waits years.
 */
export const DAYS_THEY_WAIT: Readonly<Record<Severity, number>> = Object.freeze({
    slight: 0,
    serious: 20,
    grave: 150,
    unforgivable: 720
});

/**
 * How much temperament moves both, at the ends of `howHardTheyPush`. Somebody at
 * -1 (goes around, waits) waits half again as often and as long; somebody at +1
 * (goes at things head on) half as much.
 */
export const HOW_MUCH_TEMPERAMENT_MOVES_IT = 0.5;

export type WhatTheyDidAtTheDoor =
    /** Not worth a door. Nothing happened here. */
    | { what: 'did_not_try' }
    | { what: 'broke_in' }
    | { what: 'stopped'; waitingUntilDay: number; leftATrace: boolean };

/** Whether somebody going away from this sitter's door left anything they could perceive. */
export function leftATraceFor(theirOrdinal: number, yourOrdinal: number): boolean {
    return realmIndexOf(theirOrdinal) - realmIndexOf(yourOrdinal) < 1;
}

/** Patience on 0.5..1.5, off how hard they push. */
function patienceOf(push: number): number {
    const p = Number.isFinite(push) ? Math.max(-1, Math.min(1, push)) : 0;
    return 1 - p * HOW_MUCH_TEMPERAMENT_MOVES_IT;
}

/** The chance a stopped holder of this severity and temperament waits. */
export function theChanceTheyWait(severity: Severity, push: number): number {
    return Math.min(0.95, HOW_OFTEN_THEY_WAIT[severity] * patienceOf(push));
}

/** How many days a waiting holder of this severity and temperament waits. */
export function theDaysTheyWait(severity: Severity, push: number): number {
    return Math.round(DAYS_THEY_WAIT[severity] * patienceOf(push));
}

export function whatTheyDoAtASealedDoor(input: {
    severity: Severity;
    /** Their rung, plus whatever they carry that breaks things. */
    strength: number;
    theirOrdinal: number;
    yourOrdinal: number;
    door: TheDoorTheySitBehind;
    /** `howHardTheyPush`, -1..1. Zero where it is not known. */
    push: number;
    arrivedOnDay: number;
    /** `[0,1)`, the wait draw. Read only when they were stopped. */
    sample: number;
    /** An operator forcing the wait. */
    waitingIsForced?: boolean;
}): WhatTheyDidAtTheDoor {
    if (!WORTH_BREAKING_A_DOOR_FOR.includes(input.severity)) return { what: 'did_not_try' };
    if (canUnmake(input.strength, input.door.standsAt).reaches) return { what: 'broke_in' };

    const waits = input.waitingIsForced === true
        || input.sample < theChanceTheyWait(input.severity, input.push);
    return {
        what: 'stopped',
        waitingUntilDay: input.arrivedOnDay
            + (waits ? Math.max(1, theDaysTheyWait(input.severity, input.push)) : 0),
        leftATrace: leftATraceFor(input.theirOrdinal, input.yourOrdinal)
    };
}

/** What a stopped holder going away leaves, by whose door it was. Never a name. */
export const WHAT_GOING_AWAY_LEAVES: Readonly<Record<TheDoorTheySitBehind['whose'], string>> = Object.freeze({
    the_inn: 'While you sat, somebody came up to your door, did not get through it, and went '
        + 'away again. The inn\'s people say so.',
    the_house: 'While you sat, somebody came to your door, did not get through it, and went away '
        + 'again. One of the people quartered with you saw them go.',
    yours: 'While you sat, somebody worked at your door and did not get through it. The marks '
        + 'are on it.'
});
