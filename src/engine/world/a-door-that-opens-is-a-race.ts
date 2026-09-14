/**
 * A door opens, and how much of a race it is is the window.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * A short window is a private find - a week on a sixty-year cycle is the
 * fastest-to-close case, and whoever happens to be standing there gets it. A
 * long one is a convergence: thirty days and up, and the houses that can reach
 * it send people. It is the loudest thing happening in the province that season.
 *
 * ── AND THE WINDOW DOES THE SCALING BY ITSELF ────────────────────────────
 *
 * There is no dial here and there deliberately is not one.
 * `beingAtADoorOnTheDayItOpens` already prices, per party, whether a window
 * covers the road and then the depth in and back out - so a seven-day door
 * comes back refused for almost every seat in the world and a hundred-and-eighty
 * day door comes back open for most of them. A second threshold on top of that
 * would be a second answer to how far anybody can get, which is the read this
 * module exists to reuse rather than to restate.
 *
 * Measured over twelve pinned worlds, every house seat priced against every
 * scheduled site (`probe-can-anybody-be-standing-there-on-the-day.ts`): a party
 * that hears the door is open and starts then reaches 43.9% of them, against
 * 75.0% for one that knew the date and was already walking. This pass asks the
 * FIRST of those, because the fact that opens a door is public and the day it
 * fires is the day the news gets out. A house that could read the schedule and
 * was standing there before it opened is not modelled - nothing gives a house
 * knowledge of a cycle - and that is the player's edge rather than a gap being
 * hidden.
 *
 * ── A HOUSE SENDS PEOPLE WHO WALK ────────────────────────────────────────
 *
 * The escort road is not asked for here, and that is the decision rather than
 * an omission. Somebody at the folding rungs taking a party in and standing at
 * the door for the way out is a FAVOUR a person does a person; a house's errand
 * machinery has never had a way to buy one, and `postingFor` and
 * `whoTheHouseCanSend` are the house's whole vocabulary for putting people on a
 * road. Measured, on the cut that did offer it: every house with anybody at the
 * folding rungs reached every door whatever its window - a fold at ordinal 40
 * covers 64 walking days against a map whose farthest seat is under thirty - so 18 of 38
 * houses turned up at an eighteen-day door and the window decided nothing at
 * all. The window is the mechanic. The fold stays where the design put it,
 * which is in the player's hands.
 *
 * ── WHAT IS NOT HERE ─────────────────────────────────────────────────────
 *
 * Anything about who wins. Whether a party comes back is `resolveSending`'s
 * question, on the reason the house opened and the tier it pitched at, exactly
 * as for every other errand in the world. Nothing about a door changes it.
 *
 * And SPENDING THE GROUND. A door on a season is not used up by the parties
 * that walk through one window of it: it shuts, and it comes round, and it is a
 * race again. The `emptied` tag belongs to ground somebody opened for good,
 * which is the other two thirds of the map - and a world that let its own
 * houses tag every door on its first opening would have spent the whole
 * category before any player reached one.
 *
 * Pure. Records and a day in, postings out. Nothing here moves anybody.
 */

import { SENDING_REASONS } from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { convergenceOf } from './convergence.js';
import { beingAtADoorOnTheDayItOpens } from './being-at-a-door-on-the-day-it-opens.js';
import type { LocationRecord } from './locations.js';
import { wingsOf } from './provenance.js';
import {
    isImpossibleTier,
    postingFor,
    tierFor,
    whoTheHouseCanSend,
    type Candidate,
    type Posting
} from './who-goes-out-for-a-house-and-what-comes-back.js';

/** A house as this question needs it: a name, a seat, and who is on the roll. */
export interface AHouseThatCouldGo {
    id: string;
    name: string;
    seatLocationId: string | null;
    roster: readonly Candidate[];
}

export interface AHouseOnTheRoad {
    houseId: string;
    houseName: string;
    /** Walking days between their seat and the door. */
    crossingDays: number;
    party: readonly Candidate[];
    posting: Posting;
}

/**
 * The errand a door is. One row in the catalog, and it is the same one
 * `whatItTakesToHold` prices a monopoly against.
 */
export function theErrandADoorIs(): typeof SENDING_REASONS[number] {
    const reason = SENDING_REASONS.find(r => r.needs === 'a_find');
    if (!reason) throw new Error('no sending reason answers a find');
    return reason;
}

/**
 * Who sets off for this door on the day it opens, nearest seat first.
 *
 * Arrival order, so a caller resolving them in turn is resolving them in the
 * order they actually get there - which is the whole of what makes a race a
 * race.
 */
export function whoSendsWhenADoorOpens(input: {
    door: LocationRecord;
    onDay: number;
    houses: readonly AHouseThatCouldGo[];
    /** Walking days from the door to a place. `walkingDaysFrom` over the links. */
    walkingDaysTo: (locationId: string) => number | undefined;
}): readonly AHouseOnTheRoad[] {
    const convergence = convergenceOf(input.door, input.onDay);
    if (!convergence.cyclical || !convergence.open) return [];

    const reason = theErrandADoorIs();
    const depthWanted = wingsOf(input.door).reduce((deep, w) => Math.max(deep, w.depthDays), 0);
    const out: AHouseOnTheRoad[] = [];

    for (const house of input.houses) {
        if (house.seatLocationId === null || house.roster.length === 0) continue;
        const crossingDays = input.walkingDaysTo(house.seatLocationId);
        if (crossingDays === undefined) continue;

        const reading = beingAtADoorOnTheDayItOpens({
            location: input.door,
            day: input.onDay,
            // A house that heard the door is open. See the header: nothing in
            // the world holds a house's reading of a cycle, so the arm this
            // pass can honestly ask for is the one that starts when the news
            // does.
            party: { id: house.id, realmOrdinal: 0 },
            crossingDays,
            depthWanted
        });
        if (!reading.onFoot.works) continue;

        const posting = postingFor({
            reason: {
                ...reason,
                // THE TERM OF THIS ERRAND IS THE WINDOW. The reason's own term
                // is the general case - a find somebody has to go and open
                // takes as long as it takes - and a door takes back the ground
                // when it shuts whatever anybody has finished.
                days: Math.min(reason.days, convergence.windowDays)
            },
            house,
            // What the ground asks of somebody who means to live through it.
            pitchOrdinal: input.door.thresholds.survival,
            locationId: input.door.id
        });
        const party = whoTheHouseCanSend(posting, house.roster);
        if (party.length === 0) continue;
        // A HOUSE DOES NOT SEND PEOPLE AT SOMETHING IT EXPECTS TO LOSE THEM TO.
        // The module's own predicate, not a bar invented here, and it is what
        // keeps a door out of reach of the houses it would simply kill.
        if (isImpossibleTier(tierFor(posting, party).band)) continue;

        out.push({
            houseId: house.id,
            houseName: house.name,
            crossingDays,
            party,
            posting
        });
    }

    return out.sort((a, b) =>
        a.crossingDays - b.crossingDays || (a.houseId < b.houseId ? -1 : 1));
}
