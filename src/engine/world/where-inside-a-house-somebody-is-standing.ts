/**
 * Which room of a compound somebody is standing in.
 *
 * `growCompound` cuts every seated house a gatehouse, a forecourt, precincts
 * and rooms, and nobody ever stood in any of them: every one of a house's
 * people is written at the seat, so the lecture hall was empty, a shout inside
 * the walls reached nobody, and the discipline hall was a name.
 *
 * ── A ROOM IS READ OFF WHAT SOMEBODY IS AT, NOT WRITTEN ─────────────────
 *
 * `NpcRecord.locationId` stays where the world put them, which for a house's
 * own people is the seat. The room is read from it: somebody of the house,
 * standing at its seat, at a thing that is done in a room the house has, is in
 * that room. Nothing that sets an activity has to move anybody, and every
 * world read that asks whether two people share a seat is still right.
 *
 *   a room they were put in     where a row names a room outright - somebody
 *                               who came when they were sent for - they are
 *                               there, whatever they are at
 *   not of this house           a guest or a passer-by is in the forecourt,
 *                               which is the seat
 *   a scene with the player     where it was set. Attention given to somebody
 *                               who is not one of the world's people is given
 *                               where that person was standing, and the writer
 *                               of it puts the row there
 *   the work of their rank      the office they hold, where they hold one
 *   anything else in the table  the first room in `ROOMS_A_THING_IS_DONE_IN`
 *                               the house has
 *   otherwise                   the seat: the gate and the forecourt it opens on
 *
 * PURE. The world in, a location id out. No I/O, no RNG, and nothing in the
 * world is written: the one thing kept is who holds which office, on the read's
 * own index, so a roll is dealt once per compound rather than once per person.
 */

import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { whatTheyHold, type APortfolio } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import {
    ROOMS_A_THING_IS_DONE_IN,
    ROOMS_A_THING_IS_MADE_IN,
    purposeOf,
    type RoomPurpose,
    type WhatIsBeingMade
} from './architecture.js';
import { getPill } from '../../data/cultivation/pills.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { THE_COMMUNICATION_TALISMAN } from '../../data/cultivation/communication-talismans.js';
import type { LocationRecord } from './locations.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

/** One compound, as much of it as a placement read needs. */
export interface ACompound {
    seat: LocationRecord;
    houseId: string;
    /** Every interior row of the compound, precincts included. */
    inside: Set<string>;
    /** The room cut for each purpose, where the house has one. */
    rooms: Map<RoomPurpose, LocationRecord>;
    /** Who holds which office, read once and only when somebody needs it. */
    offices: APortfolio[] | null;
}

/** The compounds of a world, keyed by seat and by every room inside one. */
export interface WhereCompoundsAre {
    bySeat: Map<string, ACompound>;
    /** Any row inside a compound, to the seat of that compound. */
    seatOf: Map<string, string>;
}

/** The compound read, built once for a world. */
export function whereCompoundsAre(state: Pick<WorldState, 'locations'>): WhereCompoundsAre {
    const byId = new Map(state.locations.map(row => [row.id, row]));
    const bySeat = new Map<string, ACompound>();
    const seatOf = new Map<string, string>();

    for (const seat of state.locations) {
        if (seat.kind !== 'sect_seat') continue;
        const houseId = typeof seat.data.factionId === 'string' && seat.data.factionId.length > 0
            ? seat.data.factionId
            : seat.controllingFactionId;
        if (!houseId) continue;
        bySeat.set(seat.id, { seat, houseId, inside: new Set(), rooms: new Map(), offices: null });
        seatOf.set(seat.id, seat.id);
    }

    // `interior` is the generator's own word for a row cut inside a place, and
    // the only relation walked: a settlement's parent is its province, and a
    // province is not a wing of anything.
    for (const row of state.locations) {
        if (!row.tags.includes('interior')) continue;
        let cursor: LocationRecord | undefined = row;
        let guard = 0;
        while (cursor && cursor.kind !== 'sect_seat' && guard++ < 16) {
            cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
        }
        const compound = cursor ? bySeat.get(cursor.id) : undefined;
        if (!compound) continue;
        compound.inside.add(row.id);
        seatOf.set(row.id, compound.seat.id);
        const purpose = purposeOf(row);
        if (purpose !== null && !compound.rooms.has(purpose)) compound.rooms.set(purpose, row);
    }
    return { bySeat, seatOf };
}

/** Whether an activity is still running on this day. */
function stillAtIt(npc: Pick<NpcRecord, 'activity'>, day: number): boolean {
    const until = npc.activity?.untilDay;
    return npc.activity !== null && (until === null || until === undefined || until >= day);
}

/**
 * Where somebody is standing, down to the room.
 *
 * `people` is the world's own roster, for telling one of its people from
 * somebody who is not.
 */
export function whereTheyAreStanding(
    state: Pick<WorldState, 'locations' | 'npcs' | 'factions' | 'currentDay'>,
    compounds: WhereCompoundsAre,
    npc: NpcRecord,
    people: ReadonlySet<string>
): string | null {
    const stored = npc.locationId;
    if (stored === null) return null;
    const compound = compounds.bySeat.get(stored);
    // Not at a seat: either not in a compound at all, or put in a room by name.
    if (!compound) return stored;
    if (npc.factionId !== compound.houseId) return stored;

    const day = Math.floor(state.currentDay);
    if (!stillAtIt(npc, day)) return stored;
    const doing = npc.activity!;
    if (doing.withIds.some(id => !people.has(id))) return stored;

    if (doing.kind === 'the_work_of_their_rank') {
        // MAKING A THING IS DONE WHERE THAT THING IS MADE, before the office:
        // somebody at a cauldron is at the cauldron, whatever they hold.
        const making = whatIsBeingMade(doing.thingId ?? null);
        if (making !== null) {
            const room = ROOMS_A_THING_IS_MADE_IN[making]
                .map(purpose => compound.rooms.get(purpose))
                .find((one): one is LocationRecord => one !== undefined);
            if (room) return room.id;
        }
        if (compound.offices === null) {
            const faction = state.factions.find(row => row.id === compound.houseId);
            compound.offices = portfoliosIn({
                locations: state.locations,
                sectId: compound.houseId,
                roll: state.npcs
                    .filter(one => one.status === 'alive' && one.factionId === compound.houseId)
                    .map(one => ({ id: one.id, rankIndex: one.factionRankIndex })),
                rankCount: faction?.ranks.length ?? 0
            });
        }
        // THE SHALLOWEST OFFICE THEY HOLD, which is the one people come to
        // them in. The deal hands an elder several and deepest first, and
        // reading the deepest put every one of them in a vault and left the
        // discipline hall and the mission hall with nobody behind the desk.
        const office = whatTheyHold(compound.offices, npc.id)
            .map(purpose => compound.rooms.get(purpose))
            .filter((room): room is LocationRecord => room !== undefined)
            .at(-1);
        return office?.id ?? stored;
    }

    const room = (ROOMS_A_THING_IS_DONE_IN[doing.kind] ?? [])
        .map(purpose => compound.rooms.get(purpose))
        .find((one): one is LocationRecord => one !== undefined);
    return room?.id ?? stored;
}

/**
 * What kind of made thing an activity's `thingId` names, or null where it is
 * not one a room is cut for.
 *
 * Medicine is a pill id. A copy of an art is a technique id, and a
 * communication talisman is cut wherever the cutter sits; neither moves anybody.
 * Anything else being made is a made thing, which has no catalog of its own to
 * be looked up in - a blade somebody forges is named by whoever forged it - so
 * it is read as what is left rather than matched. NOT read off the artifact
 * catalog: that table is the world's named treasures, not what a bench turns
 * out, and importing it here put this module in an import cycle.
 */
export function whatIsBeingMade(thingId: string | null): WhatIsBeingMade | null {
    if (thingId === null || thingId.length === 0) return null;
    if (getPill(thingId) !== undefined) return 'medicine';
    if (getTechnique(thingId) !== undefined) return null;
    if (thingId === THE_COMMUNICATION_TALISMAN.id) return null;
    return 'an_artifact';
}

/**
 * Everybody standing in this place, down to the room.
 *
 * The same answer `npcsAt` gives anywhere a compound is not, and the same
 * order: alive, by id.
 */
export function npcsStandingIn(
    state: Pick<WorldState, 'locations' | 'npcs' | 'factions' | 'currentDay'>,
    locationId: string,
    compounds: WhereCompoundsAre = whereCompoundsAre(state)
): NpcRecord[] {
    const seatId = compounds.seatOf.get(locationId);
    if (seatId === undefined) {
        return state.npcs
            .filter(n => n.locationId === locationId && n.status === 'alive')
            .sort((a, b) => (a.id < b.id ? -1 : 1));
    }
    const compound = compounds.bySeat.get(seatId)!;
    const people = new Set(state.npcs.map(n => n.id));
    return state.npcs
        .filter(n => n.status === 'alive' && n.locationId !== null
            && (n.locationId === seatId || compound.inside.has(n.locationId)))
        .filter(n => whereTheyAreStanding(state, compounds, n, people) === locationId)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * Everybody anywhere inside this place: a seat and every room behind its gate.
 *
 * For the questions that are about the house's ground as a whole - how many
 * people draw on it, who could be sent for - rather than about who is in the
 * room with you.
 */
export function npcsWithin(
    state: Pick<WorldState, 'locations' | 'npcs'>,
    locationId: string,
    compounds: WhereCompoundsAre = whereCompoundsAre(state)
): NpcRecord[] {
    const compound = compounds.bySeat.get(locationId);
    return state.npcs
        .filter(n => n.status === 'alive' && n.locationId !== null
            && (n.locationId === locationId || (compound?.inside.has(n.locationId) ?? false)))
        .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** The seat of the compound this place is, or is inside; null for anywhere else. */
export function theSeatOfTheCompound(
    state: Pick<WorldState, 'locations'>,
    locationId: string | null,
    compounds: WhereCompoundsAre = whereCompoundsAre(state)
): LocationRecord | null {
    if (locationId === null) return null;
    const seatId = compounds.seatOf.get(locationId);
    return seatId === undefined ? null : compounds.bySeat.get(seatId)!.seat;
}
