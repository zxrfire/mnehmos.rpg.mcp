/**
 * What a house makes of somebody leaving a post before its term is out.
 *
 * The owner's case is a full realm risen, "cuz circumstances change", and the general one is
 * "will the sect be happy with my update?". So this is one judgement, the house's view of the
 * change, and a leave the house would welcome ends the post cleanly. Anything else is a post
 * abandoned, and costs face by how much of the term was left.
 *
 * Every case reads a fact the engine already holds. Add a case as a row.
 */

import type { Severity } from '../social/grudges.js';

/** What is true of a post being left, read by the caller off the world and the ledger. */
export interface APostLeftEarly {
    /** `realmIndexOf` when the post was taken, and now. */
    realmWhenTaken: { index: number; name: string };
    realmNow: { index: number; name: string };
    /** The house is at war (`at_war` on its record). */
    houseAtWar: boolean;
    /** The house has sent for them since: a summons of its own waiting, or a posting put to them. */
    sentForByTheHouse: boolean;
    /** Contribution credited with the house since the post was taken. */
    meritSinceTaken: number;
    /** What the unserved part of the term pays, in contribution. */
    whatTheRestWasWorth: number;
    daysLeft: number;
    termDays: number;
}

export type WhatTheHouseMakesOfIt =
    | { welcome: true; because: string }
    | { welcome: false; because: string; severity: Severity };

/** The changes a house welcomes, in the order they are asked. The first that holds is the answer. */
const WHAT_A_HOUSE_WELCOMES: ReadonlyArray<{
    holds: (left: APostLeftEarly) => boolean;
    because: (left: APostLeftEarly) => string;
}> = [
    {
        holds: left => left.realmNow.index >= left.realmWhenTaken.index + 1,
        because: left => `You took it at ${left.realmWhenTaken.name} and stand at ${left.realmNow.name} now, `
            + 'and the house has better use for you than the post.'
    },
    {
        holds: left => left.houseAtWar,
        because: () => 'The house is at war and wants its people for it.'
    },
    {
        holds: left => left.sentForByTheHouse,
        because: () => 'The house has sent for you, and its word comes before the post.'
    },
    {
        holds: left => left.whatTheRestWasWorth > 0 && left.meritSinceTaken >= left.whatTheRestWasWorth,
        because: left => `You have brought the house ${left.meritSinceTaken} contribution since you took it, `
            + `more than the ${left.whatTheRestWasWorth} the rest of the term was worth.`
    }
];

/** How badly a post abandoned sits, by how much of it was left. */
function howMuchWasLeft(daysLeft: number, termDays: number): Severity {
    const share = termDays > 0 ? daysLeft / termDays : 1;
    if (share < 0.25) return 'slight';
    if (share < 0.5) return 'serious';
    if (share < 0.75) return 'grave';
    return 'unforgivable';
}

export function whatTheHouseMakesOfAPostLeftEarly(left: APostLeftEarly): WhatTheHouseMakesOfIt {
    const welcomed = WHAT_A_HOUSE_WELCOMES.find(row => row.holds(left));
    if (welcomed) return { welcome: true, because: welcomed.because(left) };
    return {
        welcome: false,
        because: `The house takes it as a post abandoned: ${left.daysLeft} days of the term were left.`,
        severity: howMuchWasLeft(left.daysLeft, left.termDays)
    };
}
