/**
 * WHAT A HOUSE HAS TO ITS NAME.
 *
 * The question anybody asks about a body before they join it, rob it, marry
 * into it or move against it, and there was no sentence for it. Every part of
 * the answer was already somewhere:
 *
 *   THE PURSE   `resources.spirit_stones`, which is now a real store that goes
 *               down when it is robbed and up when it is given to.
 *   THE THINGS  `whatIsLeftInTheHold`, which is the rows in the one possessions
 *               table the house both owns and holds - the shape a settlement
 *               moves, and the same shape a curious person is asking about.
 *   THE GROUND  the seat, and what is standing over it.
 *
 * ── AND IT IS GATED THE WAY EVERY OTHER LOOK AT A HOUSE IS ───────────────
 *
 * What a house is sitting on is not public. Its SEAT is - everybody knows where
 * the compound is - and its wealth is the sort of thing people guess at and get
 * wrong. So the bands are the same three `who-stands-behind-them.ts` uses, for
 * the same reason: a cultivator low on the ladder gets what a person in a
 * market would say, and somebody who deals with houses gets the figures.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────
 *
 * A total. Adding a purse to a shelf of objects produces one number that says
 * nothing true - a house with nine medicines and no stones and a house with
 * stones and an empty vault are in completely different positions, and the
 * whole point of asking is to tell them apart. `items.md` says it about the
 * player's own possessions and it is the same rule here: what a thing is worth
 * depends on who wants it.
 */

import { isInert } from '../engine/world/object-damage.js';
import { isRuined, type ObjectRecord } from '../engine/world/possessions.js';
import {
    type HowMuchTheyKnow,
    howMuchTheyKnowAt
} from './who-stands-behind-them.js';
import {
    type WhatAHouseIsMadeOf,
    whatAHouseIsMadeOf
} from '../engine/world/what-a-house-is-made-of-and-what-brings-it-down.js';
import { HALLS_DOWN } from '../engine/world/what-a-year-of-war-does-to-a-compound.js';
import type { FactionRecord, WorldState } from '../engine/world/world-state.js';

/** One thing a house is sitting on. */
export interface AThingAHouseHolds {
    id: string;
    name: string;
    kind: string;
    /** The rung it stands at, where it has one. */
    ratedAt: number | null;
}

export interface WhatAHouseHasToItsName {
    factionId: string;
    houseName: string;
    reach: HowMuchTheyKnow;
    /** Stones in the treasury. Null where the reader cannot see the figure. */
    stones: number | null;
    things: AThingAHouseHolds[];
    seat: WhatAHouseIsMadeOf | null;
    /** Halls of the compound currently down, from a war that reached it. */
    hallsDown: number;
    lines: string[];
    structure: string;
}

/**
 * The things a house both owns and is holding, which is what it HAS.
 *
 * The same read `whatIsLeftInTheHold` does for a settlement, and deliberately
 * the same one: a thing a house owns but somebody else is carrying is not in
 * its vault, and the day it stops being true for a settlement it must stop
 * being true here too.
 */
export function theThingsAHouseIsSittingOn(
    objects: readonly ObjectRecord[],
    factionId: string
): AThingAHouseHolds[] {
    return objects
        .filter(row =>
            row.ownerId === factionId
            && row.possessorId === factionId
            && !isRuined(row)
            && !isInert(row))
        .map(row => ({
            id: row.id,
            name: row.name,
            kind: row.kind,
            ratedAt: row.power
        }));
}

export function whatAHouseHasToItsName(input: {
    world: WorldState | null;
    house: FactionRecord | null;
    houseName: string;
    factionId: string;
    readerOrdinal: number;
    today: number;
}): WhatAHouseHasToItsName {
    const reach = howMuchTheyKnowAt(input.readerOrdinal);
    const things = input.world === null
        ? []
        : theThingsAHouseIsSittingOn(input.world.objects, input.factionId);
    const seat = input.world === null || input.house?.seatLocationId == null
        ? null
        : whatAHouseIsMadeOf(input.world.objects, input.house.seatLocationId, input.today);
    const hallsDown = Math.max(0, Number(input.house?.resources[HALLS_DOWN] ?? 0));
    const stones = Number(input.house?.resources.spirit_stones ?? 0);

    const lines: string[] = [];

    // ── THE GROUND, WHICH IS PUBLIC ──────────────────────────────────────
    //
    // Where a house sits and what is standing over it is not a secret: a ward
    // that nobody can see is not deterring anybody, and a house raises one to
    // be known about. Said at every band.
    lines.push(seat === null
        ? `${input.houseName} has no seat anybody could walk to.`
        : seat.formationName === null
            ? `${input.houseName} sits behind walls and nothing else. There is no array over `
              + 'that ground.'
            : `${seat.formationName} stands over the whole of the ${input.houseName} compound.`);

    if (hallsDown > 0) {
        lines.push(
            `${hallsDown} of its halls are down and have not been put back up, which is a thing `
            + 'anybody walking past can see and nobody there will discuss.'
        );
    }

    // ── AND WHAT IS INSIDE, WHICH IS NOT ─────────────────────────────────
    if (reach === 'the_public_reckoning') {
        lines.push(
            'What is in the vault is not something anybody would tell you, and what people say '
            + 'about it is what people say about any house with a wall around it. You would have '
            + 'to be somebody they deal with.'
        );
        return {
            factionId: input.factionId, houseName: input.houseName, reach,
            stones: null, things: [], seat, hallsDown, lines,
            structure: theStructure(input.factionId, reach, null, 0, seat)
        };
    }

    lines.push(stones === 0
        ? `${input.houseName} is holding nothing at all in stones. A house at zero cannot pay `
          + 'its people, and the people are what a house is.'
        : `${input.houseName} holds about ${roughly(stones)} spirit stones against its name.`);

    lines.push(things.length === 0
        ? 'There is nothing on its shelves that anybody would come for.'
        : `On its shelves: ${things.map(saidPlainly).join(', ')}.`);

    return {
        factionId: input.factionId, houseName: input.houseName, reach,
        stones, things, seat, hallsDown, lines,
        structure: theStructure(input.factionId, reach, stones, things.length, seat)
    };
}

/**
 * A figure said the way a person would say it.
 *
 * Nobody outside the house has counted it, so nobody outside the house should
 * be handed it to the stone. Rounded to something a person would actually
 * repeat, which is also the honest precision of a thing nobody audited.
 */
function roughly(stones: number): string {
    if (stones >= 10_000) return `${Math.round(stones / 1_000)} thousand`;
    if (stones >= 1_000) return `${(Math.round(stones / 100) / 10).toFixed(1)} thousand`;
    return String(Math.round(stones / 10) * 10);
}

function saidPlainly(thing: AThingAHouseHolds): string {
    return thing.ratedAt === null || thing.ratedAt <= 0
        ? thing.name
        : `${thing.name} (rated ${thing.ratedAt})`;
}

function theStructure(
    factionId: string,
    reach: HowMuchTheyKnow,
    stones: number | null,
    things: number,
    seat: WhatAHouseIsMadeOf | null
): string {
    return `whatAHouseHasToItsName(${factionId}): reader saw ${reach.replace(/_/g, ' ')}. `
        + `${stones === null ? 'Purse withheld' : `Purse ${stones}`}, ${things} thing(s) both `
        + `owned and held. Seat ${seat === null ? 'none' : `warded at ${seat.formationStandsAt ?? 'nothing'}`
        }, masonry at ${seat?.buildingsStandAt ?? 'n/a'}. Read only, nothing spent.`;
}
