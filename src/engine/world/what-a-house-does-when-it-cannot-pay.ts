/**
 * What a house does when it cannot pay its own people.
 *
 * The yearly economy gives every house a real income and a real payroll, and
 * the spread between houses is an order of magnitude - a house on a vein, a
 * house on a levy at a gate, a house taking three stones a head off a town it
 * administers. Measured on three seeded worlds at a century, between one and
 * eight of about thirty-five live houses hold NOTHING: `spirit_stones` clamped
 * at zero, the stipend unpaid, and every one of them holding no vein.
 *
 * Nothing in the world did anything about it. This file is the one fact that
 * closes that, and it adds no ledger, no second economy and no second notion of
 * what a house wants:
 *
 * > **A house that cannot pay its people is a house with a reason, and what it
 * > reaches for is the ground that would pay them.**
 *
 * ── AND IT IS ONE FACT ENTERING TWO DOORS THAT ALREADY EXISTED ───────────
 *
 * `what-a-house-opens-its-treasury-for.ts` is the pattern and it is followed
 * exactly: a situation moves the PEOPLE in the room, and nothing downstream of
 * `whatTheBodyWants` knows the situation exists. A war moves an elder there; an
 * empty purse moves one here, through the same door, on the same axis.
 *
 *   THE REASON   `ground_that_pays_somebody_else` is a `needs` key, and its
 *                predicate is the whole of the motive. A solvent house does not
 *                have this reason; a broke one does; and `reasonsOpenTo` is
 *                already read by the world's sending pass AND by the duty board
 *                a player stands in front of, so the motive is visible the day
 *                it arises without anything new being written to show it.
 *   THE NERVE    the sending pass declines an impossible tier outright. That
 *                `continue` IS the risk aversion, and it is correct for a house
 *                with something to lose. A house that cannot pay puts the same
 *                question to its own elders instead.
 *
 * ── WHAT MAKES IT A GAMBLE ───────────────────────────────────────────────
 *
 * The party is the strongest people the house has - `whoTheHouseCanSend` sorts
 * that way - and `resolveSending` is the resolver, unchanged. It finishes and
 * the ground moves; it does not and the house's best are `markMissing` and are
 * not coming back. A house that spends its seniors on a town it did not take is
 * poorer, smaller and easier to end than it was the year before.
 *
 * ── NO NEW RANDOMNESS ────────────────────────────────────────────────────
 *
 * Which ground is not a draw. It is the smallest piece of ground in the house's
 * own province that would cover its payroll, and where nothing would, the
 * largest thing there is. Two houses in the same province reach for different
 * ground because they owe different wages, which is readable off the world.
 */

import type { ObligationRecord } from '../social/grudges.js';
import {
    whatTheBodyWants,
    type OnTheRoll,
    type WhereTheBodyLands
} from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import { openHandednessOf } from '../social-leverage/how-freely-somebody-parts-with-what-they-have.js';

// ─────────────────────────────────────────────────────────────────────────
// THE PURSE
// ─────────────────────────────────────────────────────────────────────────

/**
 * How a house's purse is running, in the only unit a house cares about.
 *
 * Three states and not a number, for the reason `HowTheWarGoes` is three: what
 * it changes is what a ROOM OF PEOPLE will agree to, and a room does not read a
 * treasury as 0.63.
 *
 * Measured in YEARS OF ITS OWN WAGES rather than in stones, because a thousand
 * stones is a fortune to a house of four and a fortnight to a house of forty.
 * Both terms are already stored by the yearly economy and neither is a second
 * copy of anything: the purse is `spirit_stones` and the payroll is the roll
 * times the stipend the same pass charges itself.
 */
export type HowThePurseIsRunning =
    /** It could pay everybody for years without taking another stone. */
    | 'solvent'
    /** It could pay everybody, and not for long. */
    | 'thinning'
    /** It cannot pay everybody this year. */
    | 'cannot_pay';

/** Below a year of its own wages in hand, a house cannot pay. */
export const A_YEAR_OF_WAGES = 1;

/**
 * Years of wages above which nothing is wrong.
 *
 * Three, and the band between one and three exists so that the reading is not a
 * cliff: a house one bad decade from the edge is not the same as one that has
 * already gone over it, and only the second one gambles.
 */
export const WHAT_A_HOUSE_KEEPS_IN_HAND = 3;

/**
 * The purse, read against what the house owes its own people.
 *
 * A house that owes nobody anything is solvent by construction - there is
 * nobody to fail to pay - and that is the honest answer rather than a guard: a
 * body with an empty roll has no wages to be short of.
 */
export function howThePurseIsRunning(
    held: number,
    payrollPerYear: number
): HowThePurseIsRunning {
    if (!(payrollPerYear > 0)) return 'solvent';
    const years = Math.max(0, held) / payrollPerYear;
    if (years < A_YEAR_OF_WAGES) return 'cannot_pay';
    return years < WHAT_A_HOUSE_KEEPS_IN_HAND ? 'thinning' : 'solvent';
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IT MOVES IN A ROOM
// ─────────────────────────────────────────────────────────────────────────

/** The two things an empty purse is asked about. */
export type WhatAnEmptyPurseWouldDo =
    /** Walk the house's people onto ground somebody else is holding. */
    | 'taking_ground_that_pays'
    /** Send them at work the house would decline in an ordinary year. */
    | 'reaching_past_its_weight';

/**
 * How far an empty purse moves the person being asked.
 *
 * Added to what each decider already is, so the room's own character survives
 * and two houses in the same trouble answer differently. That is the whole of
 * why some broke houses act and others sit still, and it is a fact about who is
 * in the room rather than a roll.
 *
 * SOLVENT IS THE COLDEST ASK BY A LONG WAY. Neither of these is a thing a house
 * with money does: walking onto somebody's ground and sending juniors at work
 * nobody comes back from are both the acts of a body that has run out of the
 * ordinary ones. A thinning house is still cold to both and less so, which is
 * the whole content of there being three bands.
 */
export const WHAT_AN_EMPTY_PURSE_MOVES_A_ROOM: Readonly<
    Record<WhatAnEmptyPurseWouldDo, Readonly<Record<HowThePurseIsRunning, number>>>
> = {
    taking_ground_that_pays: { solvent: -0.9, thinning: -0.5, cannot_pay: 0.25 },
    reaching_past_its_weight: { solvent: -0.9, thinning: -0.5, cannot_pay: 0.3 }
};

/** The axis every reading is held to. */
const AXIS = 1;

/**
 * The purse, as a reading of one person.
 *
 * This is the whole of what this file contributes to a decision. Everything
 * else about a body making up its mind was already written and already tested.
 */
export function howAnEmptyPurseReadsToADecider(input: {
    what: WhatAnEmptyPurseWouldDo;
    purse: HowThePurseIsRunning;
    base?: (personId: string) => number;
}): (personId: string) => number {
    const base = input.base ?? openHandednessOf;
    const shift = WHAT_AN_EMPTY_PURSE_MOVES_A_ROOM[input.what][input.purse];
    return id => Math.max(-AXIS, Math.min(AXIS, base(id) + shift));
}

export interface WhetherTheHouseReaches {
    /** Where the room landed. A null leaning means there was no room to ask. */
    answer: WhereTheBodyLands;
    /** Whether the house does it at all. */
    reaches: boolean;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Whether the house does it, and who said so.
 *
 * Everything about the purse enters through `readingOf`, so this stays one
 * governance system rather than a second one wearing an empty purse.
 */
export function whetherTheHouseReaches(input: {
    what: WhatAnEmptyPurseWouldDo;
    purse: HowThePurseIsRunning;
    roll: readonly OnTheRoll[];
    rankCount: number;
    asking?: string | null;
    ledger?: readonly ObligationRecord[];
    asOfDay?: number;
    /** How open-handed each decider is. Defaults to the world's own reading. */
    readingOf?: (personId: string) => number;
}): WhetherTheHouseReaches {
    const answer = whatTheBodyWants({
        roll: input.roll,
        rankCount: input.rankCount,
        readingOf: howAnEmptyPurseReadsToADecider({
            what: input.what,
            purse: input.purse,
            ...(input.readingOf === undefined ? {} : { base: input.readingOf })
        }),
        ...(input.asking === undefined ? {} : { asking: input.asking }),
        ...(input.ledger === undefined ? {} : { ledger: input.ledger }),
        ...(input.asOfDay === undefined ? {} : { asOfDay: input.asOfDay })
    });
    const reaches = (answer.leaning ?? 0) > 0;
    return {
        answer,
        reaches,
        line: answer.leaning === null
            ? `${input.what}: no room to ask, so the house does nothing.`
            : `${input.what} while ${input.purse}: the room settled it ${answer.settledBy}, `
              + `leaning ${answer.leaning.toFixed(2)}. ${reaches ? 'It goes.' : 'It does not.'}`
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHICH GROUND
// ─────────────────────────────────────────────────────────────────────────

/**
 * One piece of ground, as this decision needs it.
 *
 * `paysAYear` is whatever the yearly economy would actually collect off it for
 * whoever holds it. Nothing here prices ground; the caller reads the same
 * function the economy reads, so the two cannot disagree about what a town is
 * worth.
 */
export interface GroundThatPays {
    locationId: string;
    name: string;
    paysAYear: number;
    /** Whose it is, or null where nobody holds it. */
    heldById: string | null;
    heldByName: string | null;
    /** The rung whoever holds it could answer with. Zero for unheld ground. */
    theirPowerOrdinal: number;
}

/**
 * The ground this house would reach for, or null.
 *
 * THE SMALLEST THING THAT WOULD DO, and then the largest thing there is. A
 * house short nine hundred stones a year does not walk its people onto a city
 * when the market town next door covers it, and a house that nothing in its
 * province would cover reaches for the biggest thing rather than giving up -
 * which is the difference between fixing the problem and surviving another
 * decade of it.
 *
 * Deterministic. Two houses in one province reach for different ground because
 * they owe different wages, and that is readable off the world rather than off
 * a stream.
 */
export function whichGroundWouldPayIt(
    ground: readonly GroundThatPays[],
    payrollPerYear: number
): GroundThatPays | null {
    let enough: GroundThatPays | null = null;
    let biggest: GroundThatPays | null = null;
    for (const row of ground) {
        if (row.paysAYear <= 0) continue;
        if (biggest === null || row.paysAYear > biggest.paysAYear) biggest = row;
        if (row.paysAYear < payrollPerYear) continue;
        if (enough === null || row.paysAYear < enough.paysAYear) enough = row;
    }
    return enough ?? biggest;
}
