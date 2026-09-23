/**
 * Somebody is already on this ground, and they tell you to get off it.
 *
 * The owner: *"they tell the guy to f*** off out of their ruin or dao ground, he
 * says yes or no, if no then fight"*, and *"I mean even an unowned ruin"* - being
 * there first is the claim, and no house has to hold it. Telling people to get
 * lost is ordinary, so the demand is cheap and common and the fight is rare:
 * most arrivals who are weaker or outnumbered simply go.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ─────────────────────────────────────
 *
 * The world's own year does not play this out. It collapses the whole encounter
 * into odds (`why-one-cultivator-kills-another.ts`, and the *"told to leave"*
 * outcome in `a-year-of-people-acting-on-why-they-would-kill.ts`). This is the
 * other half of the same thing, for the ONE case where it is played instead of
 * drawn: a player walks up to ground somebody is working.
 *
 * So there are three answers and this file decides none of them:
 *
 *   go            the end of it, and a small slight held by whoever was sent
 *                 away. {@link WHAT_BEING_SENT_AWAY_COSTS}.
 *   offer them    the ordinary asking machinery, `resolveAttempt` in
 *   something     `an-attempt-to-move-somebody.ts`, with what is on the ground
 *                 as the thing being asked over. A deal struck is a tie, and a
 *                 deal broken afterwards is a grievance like any other.
 *   refuse        the ordinary confrontation, with the numbers on the far side.
 *                 {@link whatRefusingLooksLike} says what it would look like,
 *                 off the same reading the world's own year uses, so the player
 *                 is told the shape of it before they answer.
 *
 * Nothing here writes to the world. It reads who is standing there and states
 * what is being demanded, which is what a scene needs.
 *
 * UNMEASURED, and it cannot be measured here: no world pass calls it. What the
 * background year does with the same ground and the same numbers is measured in
 * `why-one-cultivator-kills-another.ts`; this is the played half, and its rate
 * is however often a player walks onto ground somebody is working.
 */

import {
    groundWorthBeingFirstOn,
    theirHeight,
    whatTheFightComesTo,
    type TheStakes
} from '../world/why-one-cultivator-kills-another.js';
import type { FactionRecord } from '../world/world-state.js';
import type { LocationRecord } from '../world/locations.js';

/** Somebody standing on the ground, as this question needs them. */
export interface SomebodyStandingThere {
    id: string;
    name: string;
    ordinal: number;
    factionId: string | null;
    factionName: string | null;
}

/** What it costs somebody to be sent away: the lowest slight there is, held by them. */
export const WHAT_BEING_SENT_AWAY_COSTS = 0.05;

/** How much stronger an arrival has to be before nobody bothers telling them anything. */
export const WHAT_MAKES_THEM_THINK_BETTER_OF_IT = 4;

export interface TheDemand {
    /** Who says it: the one standing highest among them. */
    saidBy: SomebodyStandingThere;
    /** Everybody on their side, the speaker included. */
    theirSide: readonly SomebodyStandingThere[];
    houseName: string | null;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

/**
 * Whether the people already here tell somebody who has just walked up to
 * leave, and who says it. Null where nobody does: the ground is not worth it,
 * they are alone against somebody well above them, or nobody is here.
 */
export function theyTellYouToLeave(input: {
    here: readonly SomebodyStandingThere[];
    arrival: SomebodyStandingThere;
    place: LocationRecord;
    /** The house that holds this ground, where one does. A claim on top of being here first. */
    heldBy?: FactionRecord | null;
}): TheDemand | null {
    const theirSide = input.here.filter(p => p.id !== input.arrival.id);
    if (theirSide.length === 0) return null;
    // Ground nobody would bother claiming: a town, a seat, open country. The one
    // reader for it, shared with the world's own year, so a scene and a year
    // cannot disagree about what is worth being first on. A mastery threshold
    // alone let a market square through, and a player was told to clear off the
    // square they opened the game standing in.
    if (!groundWorthBeingFirstOn(input.place)) return null;
    const saidBy = [...theirSide].sort((a, b) => b.ordinal - a.ordinal || (a.id < b.id ? -1 : 1))[0]!;
    // Nobody tells somebody that far above them anything.
    if (input.arrival.ordinal - theirHeight(asParty(theirSide)) >= WHAT_MAKES_THEM_THINK_BETTER_OF_IT) return null;

    const houseName = theirSide.every(p => p.factionId !== null && p.factionId === saidBy.factionId)
        ? saidBy.factionName
        : null;
    const claim = input.heldBy != null
        ? `${input.heldBy.name} holds this ground`
        : 'they were here first';
    return {
        saidBy,
        theirSide,
        houseName,
        line: `${saidBy.name}${theirSide.length > 1 ? ` and ${theirSide.length - 1} others` : ''}`
            + `${houseName === null ? '' : ` of the ${houseName}`} tell ${input.arrival.name} to leave `
            + `${input.place.name}: ${claim}, and ${theirSide.length > 1 ? 'there are more of them' : 'they mean it'}.`
    };
}

/** The three answers there are, in the world's own terms. */
export type WhatYouCanSay = 'go' | 'offer them something' | 'refuse';

export interface WhatRefusingLooksLike {
    /** Their effective height against yours: numbers included. */
    theirHeight: number;
    /** The outcome mix of the fight, from the same reading the world's own year uses. */
    mix: ReturnType<typeof whatTheFightComesTo>;
    /** Engine truth, one line. Never narration, and never a prediction of the result. */
    line: string;
}

/**
 * What refusing would look like, said before it is answered.
 *
 * The same distribution the background pass draws from, so a scene and a year of
 * the world cannot disagree about what a fight on this ground is.
 */
export function whatRefusingLooksLike(input: {
    demand: TheDemand;
    arrival: SomebodyStandingThere;
    place: LocationRecord;
    /** Somewhere with people to run to, which is what makes it everybody's business. */
    peopleNearby: boolean;
    /** What they are all standing on the ground for. */
    stakes?: TheStakes;
}): WhatRefusingLooksLike {
    const height = theirHeight(asParty(input.demand.theirSide));
    const stakes: TheStakes = input.stakes ?? { motive: 'a place', weight: 0.25, evil: false, objectIds: [] };
    const mix = whatTheFightComesTo({
        gap: height - input.arrival.ordinal,
        attackers: input.demand.theirSide.length,
        place: input.place,
        peopleNearby: input.peopleNearby,
        stakes,
        killersHouse: null
    });
    return {
        theirHeight: height,
        mix,
        line: `${input.demand.theirSide.length} of them, standing at ${height} against `
            + `${input.arrival.ordinal}. A fight here ends with somebody dead about `
            + `${Math.round(mix.killed * 100)} times in a hundred, and one of them `
            + `${Math.round(mix.fled * 100)} times away from it.`
    };
}

/** What going costs: nothing but the slight, held by the one who went. */
export function whatGoingCosts(): { heldBy: 'the one sent away'; standing: number } {
    return { heldBy: 'the one sent away', standing: -WHAT_BEING_SENT_AWAY_COSTS };
}

/** The two columns `theirHeight` reads, off the people standing here. */
function asParty(people: readonly SomebodyStandingThere[]): { cultivation: { realmOrdinal: number } }[] {
    return people.map(p => ({ cultivation: { realmOrdinal: p.ordinal } }));
}
