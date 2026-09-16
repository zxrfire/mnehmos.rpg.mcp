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
 * 75.0% for one that knew the date and was already walking.
 *
 * ── WHICH OF THOSE A HOUSE GETS IS ASKED OF ITS PEOPLE ───────────────────
 *
 * This pass used to ask the first of them for everybody, because nothing
 * anywhere held a house's reading of a cycle. A house holds no such thing and
 * must not: `a-house-knows-a-date-because-somebody-in-it-does.ts` derives it
 * from the roll instead - somebody who can read the schedule AND has something
 * of that ground - and the party handed to the priced reading is that person's
 * rung. A caller that supplies no such reading gets the old arm unchanged, which
 * is the honest answer for a house nobody can speak for.
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
import {
    whoInTheHouseKnowsWhenItOpens,
    type HasAnythingOfTheGround
} from './a-house-knows-a-date-because-somebody-in-it-does.js';
import { convergenceOf } from './convergence.js';
import { whatADoorAdmits, whoDecidesWhoGoesIn } from './a-door-with-a-count-on-it.js';
import { beingAtADoorOnTheDayItOpens } from './being-at-a-door-on-the-day-it-opens.js';
import type { LocationRecord } from './locations.js';
import { bestForThisRoad, type Conveyance } from './what-a-conveyance-does-to-a-journey.js';
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
    /**
     * What the house could put the party on, counted and tracked alike.
     *
     * WHICH HOUSES TURN UP IS NOT AFFECTED BY THIS and must not be: the gate
     * below is `reading.onFoot`, deliberately, and the header's measurement is
     * what happens when a faster road is allowed to decide who reaches a door.
     * What a yard changes is how long they are gone and how many of them go,
     * which is `postingFor`'s answer off the craft's own capacity.
     *
     * Empty, or absent, and they walk - which is what every caller got before
     * a house's yard was readable from here at all.
     */
    yard?: readonly { conveyance: Conveyance; power: number | null }[];
    /**
     * What is in the chest. A craft whose burn this will not cover is not an
     * option, and a party is filled only as far as the chest carries it.
     */
    purse?: number | null;
}

export interface AHouseOnTheRoad {
    houseId: string;
    houseName: string;
    /** Walking days between their seat and the door. */
    crossingDays: number;
    party: readonly Candidate[];
    posting: Posting;
    /** They set out to arrive rather than hearing it was open and starting. */
    knewTheDate: boolean;
    /** Whose reading of the schedule the house walked on. Null when nobody's. */
    readerId: string | null;
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
    /**
     * Whether one of the world's own people has anything of this ground.
     *
     * Omitted, and nobody in any house can be early: the arm this pass asked for
     * the whole time it had nothing to ask the other with.
     */
    hasAnythingOfTheGround?: HasAnythingOfTheGround;
}): readonly AHouseOnTheRoad[] {
    const convergence = convergenceOf(input.door, input.onDay);
    if (!convergence.cyclical || !convergence.open) return [];

    // ── AND A DOOR SOMEBODY DOLES OUT IS NOT A RACE ──────────────────────
    //
    // The door table's own cell, read through its own function. `doled_out` is
    // the one cell of four where a house has a count in its hand, and what it
    // says in as many words is *there is no going anyway* - which is the whole
    // of why a place at one is worth ranking a field over.
    //
    // This pass asked nothing about who held the ground, so the province turned
    // up on opening day at a door whose places had just been dealt by a
    // conclave. Both mechanisms were live at once and the second one made the
    // first worth nothing: the disciple who won a place and the three who were
    // passed over were all standing in the same doorway.
    if (whoDecidesWhoGoesIn(whatADoorAdmits({ ruin: input.door }).cell)
        === 'a_house_hands_them_out') return [];

    const reason = theErrandADoorIs();
    const depthWanted = wingsOf(input.door).reduce((deep, w) => Math.max(deep, w.depthDays), 0);
    const out: AHouseOnTheRoad[] = [];

    for (const house of input.houses) {
        if (house.seatLocationId === null || house.roster.length === 0) continue;
        const crossingDays = input.walkingDaysTo(house.seatLocationId);
        if (crossingDays === undefined) continue;

        const holdsTheDate = input.hasAnythingOfTheGround === undefined
            ? null
            : whoInTheHouseKnowsWhenItOpens({
                door: input.door,
                onDay: input.onDay,
                houseId: house.id,
                roster: house.roster,
                hasAnythingOfTheGround: input.hasAnythingOfTheGround
            });

        const reading = beingAtADoorOnTheDayItOpens({
            location: input.door,
            day: input.onDay,
            // WHAT THE HOUSE SETS OUT ON, which is what one of its people can
            // say. `readSchedule` is the only thing the priced reading asks of
            // the party, and this is the rung it asks.
            party: holdsTheDate?.party ?? { id: house.id, realmOrdinal: 0 },
            crossingDays,
            depthWanted
        });
        if (!reading.onFoot.works) continue;

        // THE TERM OF THIS ERRAND IS THE WINDOW. The reason's own term is the
        // general case - a find somebody has to go and open takes as long as it
        // takes - and a door takes back the ground when it shuts whatever
        // anybody has finished.
        const term = { ...reason, days: Math.min(reason.days, convergence.windowDays) };
        const purse = house.purse ?? null;
        const taking = bestForThisRoad(house.yard ?? [], term.days, term.hands, false, purse);
        const posting = postingFor({
            reason: term,
            house,
            // What the ground asks of somebody who means to live through it.
            pitchOrdinal: input.door.thresholds.survival,
            locationId: input.door.id,
            conveyance: taking?.conveyance ?? null,
            conveyancePower: taking?.power ?? null,
            purse,
            // What this house has for it, through the eligibility filter the
            // party itself is drawn with two lines below.
            available: whoTheHouseCanSend(
                { ceilingOrdinal: term.ceilingOrdinal, hands: Number.MAX_SAFE_INTEGER },
                house.roster
            ).length
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
            posting,
            knewTheDate: reading.settingOutInAdvance,
            readerId: holdsTheDate?.readerId ?? null
        });
    }

    return out.sort((a, b) =>
        a.crossingDays - b.crossingDays || (a.houseId < b.houseId ? -1 : 1));
}
