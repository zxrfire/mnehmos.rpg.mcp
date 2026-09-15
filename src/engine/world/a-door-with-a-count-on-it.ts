/**
 * How many a door admits, and who decides which of them walks through it.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * Measured on three pinned worlds at two hundred years: 42, 35 and 39 ruins,
 * 0 held by anybody and 0 admitting a count. Every door in the world was the
 * everyone-walks-in cell, so a place at a find was never scarce, never
 * allocated, and never worth anything to be given.
 *
 * ── TWO QUESTIONS, NOT A LIST ────────────────────────────────────────────
 *
 *                 slots                          no slots
 *   held    doled out per house                  open on the holder's terms
 *   unheld  N places and nobody to assign them   anybody who turns up goes in
 *
 * Both questions are read off facts the record already holds. Neither is
 * stored, because both would drift: a door's season runs for the life of the
 * world and a holding changes hands in a war.
 *
 * ── WHAT COUNTS AT A DOOR ────────────────────────────────────────────────
 *
 * A formation on a season. Ground that shuts itself and opens itself lets
 * through what its opening lets through - that is what an opening IS - and
 * `LocationRecord.cycle` is the world's own record of having one. Ground
 * somebody has to break into, and ground built to stand open, have nothing at
 * the door doing arithmetic: whoever gets through is through.
 *
 * A HOLDER DOES NOT MAKE SLOTS. Slots are a property of the ground, which is
 * why the two questions are independent and the table has four cells rather
 * than three. A house standing at a hole in a hillside can turn people away,
 * charge them, or wave them past; what it cannot do is invent a count the door
 * does not have.
 *
 * ── HOW MANY ─────────────────────────────────────────────────────────────
 *
 * The ways in still standing, times the hands an opening takes. Both already
 * exist: `wingsOf` is what `provenance.ts` calls "ways in that are still
 * standing", and `whatItTakesToHold` prices the party off the catalog's own
 * `sending-to-open-an-inheritance`. So a three-way door seats three parties of
 * six, which over a province of four or five houses is the three or four places
 * apiece the allocation deals out.
 *
 * Pure. A location record in, a reading out. Nothing here writes anything.
 */

import { ordinaryBandFor } from './qi-scale.js';
import { whatItTakesToHold } from './a-house-that-shuts-a-public-ruin.js';
import { howThisGroundIsKept, type HowThisGroundIsKept } from './how-long-a-door-stays-shut.js';
import type { LocationRecord } from './locations.js';
import { wingsOf } from './provenance.js';
import { WHAT_ONE_POST_TAKES_IN_A_YEAR } from './seeding.js';

/** Kinds of place a door can be cut into. Everything else has no door at all. */
const GROUND_WITH_A_DOOR: ReadonlySet<string> = new Set(['ruin', 'grave', 'secret_realm']);

/** Whether this row is ground anybody would be asking to be let into. */
export function isGroundWithADoor(location: LocationRecord): boolean {
    return GROUND_WITH_A_DOOR.has(location.kind);
}

/**
 * The ways into this ground that are still standing.
 */
export function waysInTo(ruin: LocationRecord): number {
    return wingsOf(ruin).length;
}

/**
 * Places at this door, or null where nothing at it is counting.
 */
export function placesAtThisDoor(ruin: LocationRecord): number | null {
    if (!isGroundWithADoor(ruin)) return null;
    if (ruin.cycle === null) return null;
    return waysInTo(ruin) * whatItTakesToHold(ruin).hands;
}

/** The four cells of the table, named for what a person at the door meets. */
export type HowADoorIsKept =
    /** Held, and counted. You are given a place or you are not. */
    | 'doled_out'
    /** Held, uncounted. You go in, on whatever terms the holder keeps. */
    | 'open_on_the_holders_terms'
    /** Counted, and nobody to assign them. Settled with fists at the door. */
    | 'settled_with_fists'
    /** Neither. Anybody who turns up goes in. */
    | 'anybody_who_turns_up';

/**
 * Whether a house is handing the places out at this door.
 *
 * The one thing the four cells say that a person left off a roster needs to
 * know, and the reason it is read here rather than decided by whoever is
 * writing a sentence: only `doled_out` has a house with a count in its hand.
 * At the other three the door hands out nothing - either nobody holds it, or
 * the holder holds ground with no count on it - so a roster is a house's list
 * and not the door's, and turning up anyway is not a thing anybody has to beat.
 */
export type WhoDecidesWhoGoesIn = 'a_house_hands_them_out' | 'nobody_hands_them_out';

export function whoDecidesWhoGoesIn(cell: HowADoorIsKept): WhoDecidesWhoGoesIn {
    return cell === 'doled_out' ? 'a_house_hands_them_out' : 'nobody_hands_them_out';
}

/**
 * What a holder does with uncounted ground, and it is the same three shapes the
 * world already has for how ground is kept.
 *
 * `never_shut` was built to be found and a holder who leaves it that way has
 * left it that way. `a_season` opens on its own schedule, so the holder's own
 * people have it the rest of the time. Ground that had to be broken open was
 * broken open BY the holder, which is the one case where the terms are entirely
 * theirs - so that is the door somebody pays at.
 */
export type WhatTheHolderDoes = 'left_open' | 'open_in_season' | 'you_pay';

/** Which of the three, off how the ground is kept. */
export function whatTheHolderDoesWithIt(ruin: LocationRecord, hoardCount: number,
    leftByName: boolean): WhatTheHolderDoes {
    const kept: HowThisGroundIsKept = howThisGroundIsKept({
        id: ruin.id, hoardCount, leftByName
    });
    if (kept === 'never_shut') return 'left_open';
    if (kept === 'a_season') return 'open_in_season';
    return 'you_pay';
}

/**
 * What a door somebody pays at takes in a year, in spirit stones.
 *
 * ONE TOLL IN THIS WORLD, and this is not a second one. `WHAT_ONE_POST_TAKES_IN_A_YEAR`
 * prices a levy post by the traffic over it, off `price-gate-registration`; a
 * ruin somebody pays to enter is a post, and the traffic over it is what is
 * behind the door. Thin ground is a trickle nobody walks to. A spirit tide is a
 * province, and the whole province comes.
 */
export function whatADoorSomebodyPaysAtTakesInAYear(ruin: LocationRecord): number {
    switch (ordinaryBandFor(ruin.qiDensity)) {
        case 'spirit_tide': return WHAT_ONE_POST_TAKES_IN_A_YEAR['a province'];
        case 'dense': return WHAT_ONE_POST_TAKES_IN_A_YEAR['a city gate'];
        case 'normal': return WHAT_ONE_POST_TAKES_IN_A_YEAR['a road'];
        default: return WHAT_ONE_POST_TAKES_IN_A_YEAR['a trickle'];
    }
}

export interface WhatADoorAdmits {
    /** Null where nothing at the door is counting. */
    places: number | null;
    waysIn: number;
    heldBy: string | null;
    cell: HowADoorIsKept;
    /** Only set for held, uncounted ground. Null in the other three cells. */
    holdersTerms: WhatTheHolderDoes | null;
    /** What is here, why it is not yours, and what would change that. */
    account: string;
}

/**
 * Which cell this door is in, and how many places are behind it.
 *
 * `hoardCount` and `leftByName` are only read for held, uncounted ground -
 * `howThisGroundIsKept` needs them to tell a bequest from a thing that has to be
 * dug open - and a caller that has neither gets the paying door, which is what
 * ground nobody recorded a builder for is.
 */
export function whatADoorAdmits(input: {
    ruin: LocationRecord;
    hoardCount?: number;
    leftByName?: boolean;
}): WhatADoorAdmits {
    const { ruin } = input;
    const places = placesAtThisDoor(ruin);
    const waysIn = waysInTo(ruin);
    const heldBy = ruin.controllingFactionId;

    if (heldBy !== null && places !== null) {
        return {
            places, waysIn, heldBy, cell: 'doled_out', holdersTerms: null,
            account: `${ruin.name} opens for ${places} and the house at the door `
                + 'decides which of them. There is no going anyway.'
        };
    }
    if (heldBy !== null) {
        const terms = whatTheHolderDoesWithIt(
            ruin, input.hoardCount ?? 0, input.leftByName ?? false);
        return {
            places: null, waysIn, heldBy, cell: 'open_on_the_holders_terms', holdersTerms: terms,
            account: terms === 'left_open'
                ? `${ruin.name} stands open and the house at the door has left it that way.`
                : terms === 'open_in_season'
                    ? `${ruin.name} is open while its season runs and is the house's own after it.`
                    : `${ruin.name} was opened by the house at the door, and they charge `
                        + `${whatADoorSomebodyPaysAtTakesInAYear(ruin)} a year to stand in it.`
        };
    }
    if (places !== null) {
        return {
            places, waysIn, heldBy: null, cell: 'settled_with_fists', holdersTerms: null,
            account: `${ruin.name} opens for ${places} and there is nobody to say which `
                + `${places}. Whoever is standing there when it opens settles it.`
        };
    }
    return {
        places: null, waysIn, heldBy: null, cell: 'anybody_who_turns_up', holdersTerms: null,
        account: `${ruin.name} is open ground. Anybody who turns up goes in, and what is `
            + 'down there is what decides whether they come out.'
    };
}
