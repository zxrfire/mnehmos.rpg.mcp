/**
 * Standing at a ruin that shuts, and which of the two roads through it is open.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * The convergence work landed whole and unreachable. `beingAtADoorOnTheDayItOpens`
 * prices both roads the design owner named and had no caller anywhere in
 * `src/web/`, so a player could walk onto a ruin on a sixty-year cycle and be told
 * nothing about the door at all - not that it shuts, not when, not what would get
 * them through it. This is the half that goes and gets the rows, the way
 * `walking-up-to-a-house.ts` is that half for a gate.
 *
 * ── WHAT IS SAYABLE FROM OUTSIDE, AND WHAT IS NOT ────────────────────────
 *
 * That a place stands open sometimes and shut the rest of the time is visible
 * from the ground in front of it; WHEN it is next due is not, and `readSchedule`
 * is that gate. So the wait, the window and the day are said only where the
 * reading reports `settingOutInAdvance`, and where it does not, its own refusal
 * is the line. `a-door-that-closes-is-not-a-door-nobody-opened.ts` states the same
 * rule from the other end: hand a narrator the ungated read and it says the day
 * out loud to somebody with no way of knowing it.
 *
 * The window is priced whole, from the day it opens, which is what the engine
 * function is for and is not the same question as how much of today's window is
 * left. That distinction stays in the structure channel.
 *
 * ── NOT GETTING THROUGH IS NOT SEEING NOTHING ────────────────────────────
 *
 * Where no road works, the two that would are named anyway, and both are read off
 * what is actually here rather than off a table: whoever is standing in this
 * square at the folding floor or above, and whatever unburnt teleportation talisman this
 * cultivator has on them.
 */

import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import { rankName } from '../engine/cultivation/realms.js';
import {
    beingAtADoorOnTheDayItOpens,
    type StandingAtTheDoor
} from '../engine/world/being-at-a-door-on-the-day-it-opens.js';
import {
    howThisGroundIsShut,
    whatShutsThisDoor,
    SPENT,
    WHAT_SHUTS_IT
} from '../engine/world/a-door-that-closes-is-not-a-door-nobody-opened.js';
import {
    A_TELEPORTATION_TALISMAN,
    isUnburnt
} from '../engine/world/a-talisman-is-one-act-somebody-already-paid-for.js';
import type { CapabilityActor } from '../engine/world/capability.js';
import { FOLD_FLOOR_ORDINAL } from '../engine/world/how-far-somebody-can-fold-space-and-what-it-costs.js';
import type { LocationRecord } from '../engine/world/locations.js';
import type { ObjectRecord } from '../engine/world/possessions.js';
import { wingsOf } from '../engine/world/provenance.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator } from '../schema/cultivation.js';
import { capabilityActorFor } from '../server/consolidated/cultivation-perception.js';
import { worldLocationFor } from './entities.js';
import type { GameService } from './turn-engine.js';

/** Somebody at hand who could fold a party in and stand there for the way back. */
export interface SomebodyWhoCouldFoldYouIn {
    id: string;
    name: string;
    ordinal: number;
}

/** The ruin this place name is, or null for anywhere that is not one. */
export function theRuinThisPlaceIs(
    world: WorldState,
    placeName: string | null | undefined
): LocationRecord | null {
    const here = worldLocationFor(world, placeName ?? null);
    return here && here.kind === 'ruin' ? here : null;
}

/**
 * Who in this square could take a party through.
 *
 * The roster every other verb reads, filtered by the one bar that decides it -
 * `FOLD_FLOOR_ORDINAL`, which is where folding starts and below which nothing
 * folds. Read the way `whatTheGateOfThisHouseSays` reads whose people are out
 * here: a name on a roll four provinces away cannot walk anybody anywhere.
 */
export function whoHereCouldFoldYouIn(
    game: GameService,
    cultivator: Cultivator
): SomebodyWhoCouldFoldYouIn | null {
    return game.present(cultivator)
        .filter(row => row.alive && row.realmOrdinal >= FOLD_FLOOR_ORDINAL)
        .map(row => ({ id: row.id, name: row.name, ordinal: row.realmOrdinal }))
        .sort((a, b) => b.ordinal - a.ordinal || (a.id < b.id ? -1 : 1))[0]
        ?? null;
}

/**
 * The unburnt teleportation talisman this cultivator has on them, or null.
 *
 * `cutATalisman` tags one `A_TELEPORTATION_TALISMAN` and stands it at the rung folded
 * into it, so the object's own `power` is what the second road is priced on and
 * nothing here keeps a second copy of that number.
 */
export function theTeleportationTalismanTheyCarry(
    world: WorldState,
    holderId: string
): ObjectRecord | null {
    return (world.objects ?? []).find(row =>
        row.possessorId === holderId
        && row.tags.includes(A_TELEPORTATION_TALISMAN)
        && isUnburnt(row)) ?? null;
}

export interface WhatTheDoorSays {
    lines: string[];
    structure: string[];
    /** Null for a ruin on no schedule, which is priced by nothing. */
    reading: StandingAtTheDoor | null;
}

export interface StandingAtThisRuin {
    site: LocationRecord;
    day: number;
    party: CapabilityActor;
    /** Days of road still between them and it. Zero when they are on it. */
    crossingDays: number;
    escort: SomebodyWhoCouldFoldYouIn | null;
    slip: ObjectRecord | null;
    /**
     * Houses with people standing here. {@link housesWithPeopleStandingHere}.
     *
     * A door that opens on a long window is a race - the world puts parties on
     * the road for one the day it opens - and three houses camped at the same
     * mouth is the most important thing about the place that season. Read off
     * who is actually in the square rather than off anybody's plan, so it says
     * nothing the eye cannot reach: a house's people are marked as its people.
     */
    housesStandingHere?: readonly string[];
}

/**
 * Which houses have somebody in this square, by name.
 */
export function housesWithPeopleStandingHere(
    game: GameService,
    cultivator: Cultivator
): readonly string[] {
    const seen = new Set<string>();
    for (const row of game.present(cultivator)) {
        if (!row.alive || row.sectName === null) continue;
        seen.add(row.sectName);
    }
    return [...seen].sort();
}

/** "A", "A and B", "A, B and C". */
function listed(names: readonly string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Years where it is years, days where it is less than one. */
function howLong(days: number): string {
    return days < DAYS_PER_YEAR
        ? `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`
        : `${Math.round(days / DAYS_PER_YEAR)} years`;
}

/**
 * What the door of this ruin says to this cultivator, here, now.
 */
export function whatTheDoorOfThisRuinSays(input: StandingAtThisRuin): WhatTheDoorSays {
    const { site, day, escort, slip } = input;
    const shut = howThisGroundIsShut(site, day);
    const lines: string[] = [];
    const structure: string[] = [];
    const houses = input.housesStandingHere ?? [];
    const whoElseIsHere = (): void => {
        if (houses.length === 0) return;
        lines.push(houses.length === 1
            ? `${listed(houses)} has people standing here.`
            : `${listed(houses)} all have people standing here.`);
    };

    if (!site.cycle) {
        if (shut.howItIsShut === 'shut_until_somebody_opens_it') {
            lines.push(`${site.name} is shut, and nothing opens it but somebody opening it.`);
        } else {
            // GROUND THAT NEVER SHUT, and the line has to say that the door is
            // not what is stopping anybody - otherwise a player reads the
            // silence as "walk in". What stops them is inside, and the bars are
            // `evaluateAccess`'s to state rather than this module's.
            lines.push(`${site.name} stands open. Nothing closes it and nothing ever did.`);
            lines.push('Whatever is in the way is inside it.');
        }
        whoElseIsHere();
        structure.push(
            `howThisGroundIsShut(${site.id}) on day ${day}: ${shut.howItIsShut}, `
            + `no schedule, spent=${shut.spent}.`
        );
        return { lines, structure, reading: null };
    }

    const deepest = wingsOf(site).reduce((deep, wing) => Math.max(deep, wing.depthDays), 0);
    const slipOrdinal = slip === null ? null : Math.max(0, Math.floor(Number(slip.power ?? 0)));
    const reading = beingAtADoorOnTheDayItOpens({
        location: site,
        day,
        party: input.party,
        crossingDays: input.crossingDays,
        depthWanted: deepest,
        escortOrdinal: escort?.ordinal ?? null,
        slipCutAtOrdinal: slipOrdinal
    });

    lines.push(shut.howItIsShut === 'open'
        ? `${site.name} is standing open.`
        : `${site.name} is shut.`);

    // WHAT SHUTS IT, which is not the same reading as WHEN. A formation still
    // standing on the ground is visible to anybody in front of it and a place
    // that comes and goes with a season is what the province calls it; the day
    // it is next due takes records nobody here keeps, and stays behind
    // `readSchedule` below.
    const shuts = whatShutsThisDoor(site);
    if (shuts !== null) lines.push(WHAT_SHUTS_IT[shuts]);

    whoElseIsHere();

    if (reading.settingOutInAdvance) {
        lines.push(`It stands open ${reading.windowDays} days at a time, `
            + `${reading.waitYears} years apart.`);
        if (shut.howItIsShut !== 'open' && shut.daysUntilItOpens !== null) {
            lines.push(`The next one is ${howLong(shut.daysUntilItOpens)} off.`);
        }
    } else if (reading.whatTheyCannotRead !== null) {
        lines.push(reading.whatTheyCannotRead);
    }

    // THE TWO WAYS ON FOOT FAILS ARE NOT THE SAME FAILURE, and the module keeps
    // them apart: a road longer than the window shuts the door before anybody is
    // there, and a window that is long enough to arrive in can still be too short
    // to reach the end of it and walk back.
    lines.push(reading.onFoot.works
        ? 'On foot you get to the end of it and back out before it shuts.'
        : reading.onFoot.windowLeft <= 0
            ? 'On foot the road is longer than the window. It shuts before you are there.'
            : 'On foot it shuts with you still inside.');

    if (escort !== null && reading.behindASenior !== null) {
        lines.push(reading.behindASenior.works
            ? `${escort.name} stands at ${rankName(escort.ordinal)} and could fold a party in `
                + 'and stay at the door for the way back.'
            : `${escort.name} could fold a party in, and it still does not get anybody `
                + 'back out.');
    }

    if (slip !== null && slipOrdinal !== null && reading.onASlip !== null) {
        lines.push(reading.onASlip.works
            ? `The ${slip.name} you are carrying was cut at ${rankName(slipOrdinal)}, and one `
                + 'fold out of it is enough.'
            : `The ${slip.name} you are carrying was cut at ${rankName(slipOrdinal)}, and one `
                + 'fold out of it is not enough.');
    }

    // WHAT WOULD OPEN IT. Being unable to get through is not being told nothing,
    // and the two roads are the answer whether or not anybody here is one.
    const anyRoad = [reading.onFoot, reading.behindASenior, reading.onASlip]
        .some(road => road !== null && road.works);
    if (!anyRoad) {
        lines.push(`Two things get a party in and back out: somebody at `
            + `${rankName(FOLD_FLOOR_ORDINAL)} or above who folds them in and stands at the `
            + 'door until they are out, or a teleportation talisman cut by a hand at that rung, burned '
            + 'once.');
    }

    structure.push(
        `beingAtADoorOnTheDayItOpens(${site.id}) on day ${day}: ${shut.howItIsShut}, `
        + `window ${reading.windowDays}d priced whole from the day it opens, `
        + `wait ${reading.waitYears}y, road ${reading.crossingDays}d, `
        + `deepest wing ${reading.depthWanted}d, schedule readable=${reading.settingOutInAdvance}, `
        + `spent(${SPENT})=${shut.spent}. ${reading.reason}`
    );
    for (const [label, road] of [
        ['on foot', reading.onFoot],
        ['behind a senior', reading.behindASenior],
        ['on a slip', reading.onASlip]
    ] as const) {
        if (road === null) continue;
        structure.push(`${label}: ${road.daysToTheDoor}d to the door, `
            + `${road.windowLeft}d of window left, buys ${road.depthItBuys}d of depth, `
            + `works=${road.works}${road.refusal === null ? '' : ` (${road.refusal})`}`);
    }

    return { lines, structure, reading };
}

/**
 * The same reading, off a live game, for a cultivator standing somewhere.
 *
 * Null where the place is not a ruin, which is nearly everywhere.
 */
export function whatTheDoorHereSays(
    game: GameService,
    cultivator: Cultivator,
    at: string | null | undefined,
    crossingDays: number
): WhatTheDoorSays | null {
    const world = game.atHand;
    if (!world) return null;
    const site = theRuinThisPlaceIs(world, at);
    if (!site) return null;
    return whatTheDoorOfThisRuinSays({
        site,
        day: world.currentDay,
        party: capabilityActorFor(cultivator),
        crossingDays,
        escort: whoHereCouldFoldYouIn(game, cultivator),
        slip: theTeleportationTalismanTheyCarry(world, cultivator.id),
        housesStandingHere: housesWithPeopleStandingHere(game, cultivator)
    });
}
