/**
 * A house's mission board: a thing standing in one area of its seat, behind the gate.
 *
 * The owner: the board is "there, inside the sect", and "almost an NPC, you can't talk to an npc
 * not in your area". So it is read the way a person is spoken to. It stands in the seat's `board`
 * area (`where-in-a-place-somebody-is-standing.ts`); somebody elsewhere inside the walls is walked
 * over to it first, the way naming a person across the square crosses to them; and from outside
 * the walls, or from the road, it is not there to read. Who gets into the area is the gate's
 * question and nothing here asks the roll about it: an intruder at the board reads it.
 *
 * Taking from it is the roll's question. A member takes their own rung's missions and every
 * rung's below (`aRungMayTake`); a rung above is not their wall, and naming one is told which rung
 * it is posted to. Anybody else at the board is told it is posted for the house's own.
 *
 * This is the one check on where the reader stands, upstream of `sectBoardFor`, which reads whose
 * board it is by place.
 */

import type { HouseMission } from '../data/cultivation/what-a-house-posts-for-its-own.js';
import { aContractAsAnOffer, theContractBehind } from '../engine/encounters/paper-on-a-town-wall.js';
import {
    aMissionAsAnOffer,
    aRungMayTake,
    theFirstRungOf,
    theMissionBehind
} from '../engine/encounters/what-a-house-has-on-its-board.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { theSeatOfTheCompound } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import type { LocationRecord } from '../engine/world/locations.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { DutyCandidate } from '../engine/encounters/duties.js';
import type { SectBoard } from './encounters.js';
import { positionIn } from './standing.js';
import type { GameService } from './turn-engine.js';
import { theAreaTheyAreIn } from './walking-across-a-place.js';

/** A line on the wall that is not put to this reader, and why. */
export interface WithheldHere {
    entryId: string;
    name: string;
    reason: string;
    /** Posted to a rung above theirs: not read out with their wall, but named when asked for. */
    notOnTheirWall?: true;
}

export interface TheWallWhereTheyStand extends SectBoard {
    refusals: WithheldHere[];
}

/** The house whose seat this is, off the seat row. */
function theHouseOf(seat: LocationRecord): string | null {
    const id = (seat.data as { factionId?: unknown }).factionId;
    return typeof id === 'string' && id.length > 0 ? id : seat.controllingFactionId;
}

/** The seat whose walls somebody standing here is inside, past the gate, or null. */
function theSeatTheyAreInside(world: WorldState, cultivator: Cultivator): LocationRecord | null {
    const here = theAreaTheyAreIn(world, cultivator);
    if (!here) return null;
    if (here.place.kind === 'sect_seat') return here.area.for === 'gate' ? null : here.place;
    return theSeatOfTheCompound(world, here.place.id);
}

/** The seat whose board this reader is standing at, or null. */
export function theBoardTheyStandAt(world: WorldState | null, cultivator: Cultivator): LocationRecord | null {
    if (!world) return null;
    const here = theAreaTheyAreIn(world, cultivator);
    return here && here.place.kind === 'sect_seat' && here.area.for === 'board' ? here.place : null;
}

/**
 * Somebody inside a seat's walls and not at its board, walked over to it. Null where they are
 * not inside one or are at it already. No time passes, as for any walk across a place.
 */
export function walkOverToTheBoard(
    game: GameService,
    cultivator: Cultivator
): { cultivator: Cultivator; line: string; structure: string } | null {
    const world = game.atHand;
    if (!world || theBoardTheyStandAt(world, cultivator) !== null) return null;
    const seat = theSeatTheyAreInside(world, cultivator);
    const board = seat === null ? null : theAreasOf(world, seat).areas.find(area => area.for === 'board') ?? null;
    if (seat === null || board === null) return null;
    const from = theAreaTheyAreIn(world, cultivator);
    if (from?.place.id !== seat.id) game.repos.cultivators.update(cultivator.id, { location: seat.name });
    game.repos.cultivators.standIn(cultivator.id, board.id);
    return {
        cultivator: game.repos.cultivators.getById(cultivator.id) ?? cultivator,
        line: `You walk over to ${board.name}.`,
        structure: `walkOverToTheBoard: ${from?.area.id ?? cultivator.location} to ${board.id}. No time passed.`
    };
}

/**
 * The wall as this reader can read it where they stand. A house's missions only at its board:
 * by rung for its own, and refused for anybody else. Contracts and missions are worded with the
 * place they are for. Every other line is left as it was.
 */
export function theWallWhereTheyStand(
    game: GameService,
    cultivator: Cultivator,
    board: SectBoard
): TheWallWhereTheyStand {
    const world = game.atHand;
    const seat = theBoardTheyStandAt(world, cultivator);
    const houseId = seat === null ? null : theHouseOf(seat);
    const house = world?.factions.find(f => f.id === houseId) ?? null;
    const held = positionIn(game.repos, cultivator.id);
    const ours = held !== null && held.sectId === houseId ? held : null;
    const ladder: readonly string[] = ours?.ranks ?? house?.ranks ?? [];
    const houseName = house?.name ?? ours?.sectName ?? 'The house';
    const ground = world?.locations.find(row => houseId !== null && row.controllingFactionId === houseId)?.name ?? null;

    // A mission on THIS board, undefined for a line that is no mission, null for one that is not
    // here to be read: another house's, a band this ladder does not have, or no board at all.
    const onThisBoard = (entryId: string): HouseMission | null | undefined => {
        const mission = theMissionBehind(entryId);
        if (!mission) return undefined;
        if (seat === null || !entryId.endsWith(`@${houseId}`)) return null;
        return theFirstRungOf(mission.rung, ladder.length) === null ? null : mission;
    };
    const titled = (entryId: string, name: string, mission: HouseMission | undefined): string => {
        const contract = theContractBehind(entryId);
        if (contract) return aContractAsAnOffer(contract, cultivator.location?.trim() || null).name;
        if (!mission || seat === null) return name;
        const place = mission.at === 'its_ground' ? ground ?? seat.name : seat.name;
        return aMissionAsAnOffer(mission, { id: houseId ?? '', name: houseName }, place).name;
    };
    const whyNot = (mission: HouseMission): Omit<WithheldHere, 'entryId' | 'name'> | null => {
        if (ours === null) return { reason: `${houseName} posts this for its own, and you are not on its roll.` };
        if (aRungMayTake(ours.rankIndex, ours.rankCount, mission.rung)) return null;
        const postedTo = ladder[theFirstRungOf(mission.rung, ladder.length) ?? 0] ?? mission.rung;
        return {
            reason: `${houseName} posts this to ${postedTo} and above, and you stand at ${ladder[ours.rankIndex] ?? 'a rung under it'}.`,
            notOnTheirWall: true
        };
    };

    const offers: DutyCandidate[] = [];
    const refusals: WithheldHere[] = [];
    for (const offer of board.offers) {
        const mission = onThisBoard(offer.entry.id);
        if (mission === null) continue;
        const entry = { ...offer.entry, name: titled(offer.entry.id, offer.entry.name, mission) };
        const no = mission === undefined ? null : whyNot(mission);
        if (no === null) offers.push({ ...offer, entry });
        else refusals.push({ entryId: entry.id, name: entry.name, ...no });
    }
    for (const row of board.refusals) {
        const mission = onThisBoard(row.entryId);
        if (mission === null) continue;
        const name = titled(row.entryId, row.name, mission);
        const no = mission === undefined ? null : whyNot(mission);
        refusals.push({ entryId: row.entryId, name, ...(no ?? { reason: row.reason }) });
    }
    return { ...board, offers, refusals };
}
