/**
 * A house holds a door with a count on it, and deals the places out.
 *
 * ── THE NUMBER IS THE STATEMENT ──────────────────────────────────────────
 *
 * How many places your house gets from theirs is what they think of you, said
 * out loud in front of everybody who also asked. So it is not a constant and it
 * is not a share of the field: it comes off standing, off what the two houses
 * hold against each other, and off what you paid them - and a house that is
 * given nothing has been told something, which is why a refusal here carries a
 * reason rather than being an absence from the list.
 *
 * ── THE SAME MECHANISM STAFFS A POSTING ──────────────────────────────────
 *
 * A place at a door is one opening and a posting is a tour, and that is the only
 * difference. Both are a fixed count of places at somebody else's body, dealt
 * out per sending house by what the body thinks of each of them, and neither is
 * drawn only from the apex - a lesser house that pays and is not hated gets one.
 * `Dealt` is the shape; `whatEachPlaceIs` is the parameter that separates them.
 *
 * ── AND IT IS EXACTLY AS MANY AS THERE ARE ───────────────────────────────
 *
 * Largest remainder, so the dealt places sum to the count the door has and not
 * to a rounding of it. A door that seats eighteen seats eighteen.
 *
 * Pure. Standings and a count in, an allocation out. Nothing here moves anybody.
 */

import { ALLIED_STANDING } from './gatherings.js';

/** What a place bought is: one opening at a door, or a tour at a posting. */
export type WhatEachPlaceIs = 'one_opening' | 'a_tour';

/**
 * A house asking for places, as the allocation needs it.
 */
export interface AHouseAsking {
    id: string;
    name: string;
    /** What the holder thinks of them, -1..1. */
    standingFromTheHolder: number;
    /** What they think of the holder. A rival who asks is still asking. */
    standingTowardTheHolder: number;
    /** Stones paid this year for the door. Zero for a house that pays nothing. */
    paid: number;
}

/**
 * What one house came away with, and why that number.
 */
export interface PlacesDealt {
    houseId: string;
    houseName: string;
    places: number;
    /** The unnormalised weight. A harness reads the distribution off this. */
    weight: number;
    /** What decided it. Said plainly, because the number is a statement. */
    because: string;
}

export interface TheDeal {
    places: number;
    /** Host first, then by places dealt, then by id. Every asker appears. */
    dealt: readonly PlacesDealt[];
    /** Houses given nothing. A subset of `dealt`, for the caller that wants it. */
    turnedAway: readonly string[];
}

/**
 * What the holder keeps for its own before anything is dealt.
 *
 * A house that stands at a door and gives away every place at it is not holding
 * the door, it is administering it for other people. Half, which is the share
 * that leaves a genuine allocation to argue over.
 */
export const WHAT_THE_HOLDER_KEEPS = 0.5;

/**
 * The standing below which a house is not given places at all.
 *
 * The same line `alliesOf` uses to decide who a house will sit down with, read
 * from the other end: a body either side of that line is one you do not receive,
 * and you do not hand a place at your door to somebody you would not receive.
 */
export const TOO_HOSTILE_TO_BE_GIVEN_A_PLACE = -ALLIED_STANDING;

/**
 * What a year's payment is worth against a point of standing.
 *
 * Priced off the levy, which is what this world charges for a door: one post at
 * a road takes 400 a year, so 400 buys the weight one full step of standing
 * carries. A house that is thought nothing of and pays a road's worth is level
 * with a house that is thought well of and pays nothing, which is the whole
 * relation the design wants between the two.
 */
export const STONES_PER_POINT_OF_STANDING = 400;

/**
 * The weight one asking house carries, and it can be zero.
 *
 * Standing from the holder is the term that matters; what the asker thinks back
 * is a HALF term, because a house that resents its benefactor is still given
 * places and is given fewer of them. Both are bounded at the line, so a rivalry
 * one side of neutral cannot be bought off entirely by paying.
 */
export function weightOfAnAsk(house: AHouseAsking): number {
    if (house.standingFromTheHolder <= TOO_HOSTILE_TO_BE_GIVEN_A_PLACE) return 0;
    if (house.standingTowardTheHolder <= TOO_HOSTILE_TO_BE_GIVEN_A_PLACE) return 0;
    const bought = Math.max(0, house.paid) / STONES_PER_POINT_OF_STANDING;
    const thought = house.standingFromTheHolder + house.standingTowardTheHolder * 0.5;
    // Floored at nothing rather than at a fraction: a house nobody thinks
    // anything of and that pays nothing has no claim, and saying so is the
    // point. `1 +` is the ask itself - turning up is worth something.
    return Math.max(0, 1 + thought + bought);
}

/** Why the number is the number, in one sentence. */
function because(house: AHouseAsking, places: number): string {
    if (house.standingFromTheHolder <= TOO_HOSTILE_TO_BE_GIVEN_A_PLACE) {
        return 'Nothing. They will not have them at the door.';
    }
    if (house.standingTowardTheHolder <= TOO_HOSTILE_TO_BE_GIVEN_A_PLACE) {
        return 'Nothing. They would not take one on those terms.';
    }
    if (places === 0) {
        return house.paid > 0
            ? 'Nothing left by the time they were reached, and they had paid.'
            : 'Nothing. They are thought nothing of and they paid nothing.';
    }
    if (house.paid > 0 && house.standingFromTheHolder < 0) {
        return `${places} bought rather than given.`;
    }
    return house.standingFromTheHolder >= ALLIED_STANDING
        ? `${places}, which is what they are thought of.`
        : `${places}, and no more than that.`;
}

/**
 * Deal the places at one door, or the tours at one posting.
 *
 * The holder is dealt first and off the top. Everybody else is dealt largest
 * remainder over the weights, so the total is exact and the ordering is
 * deterministic - ties fall to the heavier weight and then to the id, never to
 * whatever order the caller happened to build the list in.
 */
export function dealThePlaces(input: {
    places: number;
    holderId: string;
    holderName: string;
    asking: readonly AHouseAsking[];
    /** A place at a door, or a tour at a posting. Defaults to the door. */
    whatEachPlaceIs?: WhatEachPlaceIs;
}): TheDeal {
    const aTour = (input.whatEachPlaceIs ?? 'one_opening') === 'a_tour';
    const places = Math.max(0, Math.floor(input.places));
    const asking = input.asking.filter(h => h.id !== input.holderId);

    const kept = Math.min(places, Math.max(
        // The holder keeps at least one place at its own door whenever there is
        // one to keep. A house that stood there and got nothing is not holding.
        places > 0 ? 1 : 0,
        Math.round(places * WHAT_THE_HOLDER_KEEPS)
    ));
    const toDeal = places - kept;

    const weights = asking.map(h => ({ house: h, weight: weightOfAnAsk(h) }));
    const total = weights.reduce((sum, w) => sum + w.weight, 0);

    const exact = weights.map(w => ({
        ...w,
        share: total > 0 ? (w.weight / total) * toDeal : 0
    }));
    const floors = exact.map(e => ({ ...e, places: Math.floor(e.share) }));
    let left = toDeal - floors.reduce((sum, f) => sum + f.places, 0);

    // Largest remainder. Only houses with a weight take one, so a house that is
    // refused cannot be handed a place by a rounding - which is the whole of
    // the case where every asker is refused: the shares are all zero, every
    // remainder is zero, and an unguarded loop would deal the door's places
    // round the very houses it will not have at it.
    const byRemainder = [...floors].sort((a, b) =>
        (b.share - b.places) - (a.share - a.places)
        || b.weight - a.weight
        || (a.house.id < b.house.id ? -1 : 1));
    for (const row of byRemainder) {
        if (left <= 0) break;
        if (row.weight <= 0) continue;
        row.places++;
        left--;
    }

    const dealt: PlacesDealt[] = [
        {
            houseId: input.holderId,
            houseName: input.holderName,
            // AND WHATEVER NOBODY MAY BE GIVEN STAYS WITH THE HOLDER. A door
            // that seats eighteen seats eighteen whether or not there is
            // anybody in the province it will have at it.
            places: kept + Math.max(0, left),
            weight: Number.POSITIVE_INFINITY,
            because: aTour
                ? `${kept + Math.max(0, left)} of their own standing the watch.`
                : `${kept + Math.max(0, left)} kept, because it is their door.`
        },
        ...floors
            .sort((a, b) => b.places - a.places
                || b.weight - a.weight
                || (a.house.id < b.house.id ? -1 : 1))
            .map(row => ({
                houseId: row.house.id,
                houseName: row.house.name,
                places: row.places,
                weight: row.weight,
                because: because(row.house, row.places)
            }))
    ];

    return {
        places,
        dealt,
        turnedAway: dealt.filter(d => d.places === 0).map(d => d.houseId)
    };
}
