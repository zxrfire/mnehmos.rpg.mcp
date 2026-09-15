/**
 * The room a house gives you, and what it will hold.
 *
 * `promotion-inside-a-house.ts` rests its whole model on seats being scarce
 * because the things that fill them are - stipends, quarters, a share of the
 * vein - and nothing anywhere gave anybody quarters. `seclusion-verbs.ts`
 * stated the opposite as settled fact: below the Lid, buildings are a house's
 * and not anybody's. The design owner, shown both: sects assign you rooms, so
 * you can put your things in your room.
 *
 * MEASURED ON A SEEDED WORLD before this existed: 38 houses, 1,154 locations,
 * 37 dormitories and 38 residences, every one of them already named for a rank
 * - `the outer disciples' quarters`, `the pavilion master's residence` - and
 * not one of them assigned to anybody. The buildings were there. Only the
 * assignment was missing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE FACTS, AND NO NEW STORE FOR ANY OF THEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   WHICH ROOM  the deepest lodging room the rung reaches, read off the
 *               compound. A house with quarters behind every wall and a house
 *               with one dormitory both answer, which is what lets a world
 *               seeded before this still give everybody somewhere.
 *   HOW MUCH    the stipend. A house already states, per rung, what it is
 *               willing to spend on somebody; quarters are that same statement
 *               in litres instead of stones. No ladder is invented here, and
 *               repricing a house's stipends moves its rooms with them.
 *   WHERE       a holder key for `cultivator_pouch`, which is keyed on a
 *               free-form `holder_id` - so quarters hold things by BEING a
 *               holder, and every read ever written over a pouch answers for
 *               them unchanged. `somewhere-that-is-theirs.ts` did this first
 *               for a residence and this is the second caller, not a second
 *               mechanism.
 *
 * THE KEY IS THE PERSON AND THE HOUSE, NEVER THE ROOM. Promotion changes which
 * room is yours, and a key on the room would strand everything in the old one
 * at the moment the house raised you - the exact reverse of what a promotion
 * is. Which room you are in is derived; what you left in it is stored.
 *
 * AND LOSING YOUR PLACE DOES NOT COST YOU YOUR THINGS. The design owner, on
 * expulsion and on walking out alike: an outer disciple just hands you your
 * stuff. Nobody makes a speech and the house keeps nothing, so leaving a thing
 * in a room is never a trap. `SectRepository.removeMember` does it, inside the
 * transaction that removes the row, because four call sites above that layer
 * remove a member and the one that forgot would leave somebody's possessions
 * under a key no verb can reach.
 */

import { purposeOf, type RoomPurpose } from './architecture.js';
import type { LocationRecord } from './locations.js';
import type { WorldState } from './world-state.js';
import { WHAT_A_RING_HOLDS } from './what-a-body-can-carry-and-what-a-ring-holds.js';

/**
 * The room purposes a house puts its own people to sleep in.
 *
 * Both already exist and both are already named for a rank. The dormitory is
 * the shared end and the residence is the far end, and a compound holds at
 * most one of each - which is why the rule below is "the deepest one you
 * reach" rather than "the one for your rank".
 */
export const WHERE_A_HOUSE_LODGES_PEOPLE: readonly RoomPurpose[] =
    Object.freeze(['dormitory', 'residence']) as readonly RoomPurpose[];

export interface LodgingRoom {
    locationId: string;
    name: string;
    purpose: RoomPurpose;
    /** How far into the compound it sits. 0 is outside the first wall. */
    precinctIndex: number;
    /** The house's own word for the rank whose wall it is behind. */
    rank: string;
}

export interface Quarters extends LodgingRoom {
    factionId: string;
    /** The `holder_id` the pack in this room is kept under. */
    holderId: string;
    /** Litres. What the house lets somebody at this rung keep here. */
    room: number;
    /**
     * Others on the roll quartered in the same place.
     *
     * Derived rather than declared, which is the whole of the owner's
     * distinction: an outer disciple shares because three hundred people are
     * behind the same wall, and a head has rooms of their own because nobody
     * else is behind theirs. Neither is a flag on a rank.
     */
    shareWith: number;
}

/** Every room this house lodges people in, outermost first. */
export function theLodgingsOfAHouse(state: WorldState, factionId: string): LodgingRoom[] {
    const rooms: LodgingRoom[] = [];
    for (const location of state.locations) {
        if (location.controllingFactionId !== factionId) continue;
        const purpose = purposeOf(location);
        if (purpose === null || !WHERE_A_HOUSE_LODGES_PEOPLE.includes(purpose)) continue;
        rooms.push(lodgingOf(location, purpose));
    }
    return rooms.sort((a, b) => a.precinctIndex - b.precinctIndex);
}

function lodgingOf(location: LocationRecord, purpose: RoomPurpose): LodgingRoom {
    const index = (location.data as { precinctIndex?: unknown }).precinctIndex;
    const rank = (location.data as { rank?: unknown }).rank;
    return {
        locationId: location.id,
        name: location.name,
        purpose,
        precinctIndex: typeof index === 'number' ? index : 0,
        rank: typeof rank === 'string' ? rank : ''
    };
}

/**
 * The room this rung is given, or null where the house lodges nobody.
 *
 * As deep as the rank reaches, which is the same rule `roomStageFor` already
 * uses to decide what somebody of a rank can see of a compound - a rank
 * reaches the precincts at or below its own. Somebody whose rung is outside
 * every lodging wall still sleeps somewhere, so they fall to the outermost.
 */
export function whichRoomARungGets(
    rooms: readonly LodgingRoom[],
    rankIndex: number
): LodgingRoom | null {
    if (rooms.length === 0) return null;
    const reached = rooms.filter(room => room.precinctIndex <= rankIndex);
    return reached.length > 0 ? reached[reached.length - 1] : rooms[0];
}

/**
 * How much room the house gives somebody at this rung, in litres.
 *
 * ANCHORED ON A THING THAT ALREADY EXISTS. The bottom rung's quarters hold
 * exactly what the cheapest storage ring in the world holds - "a travelling
 * chest. Everything a person owns, and not a cart." So the least a house can
 * give somebody is the thing they would otherwise have to be four realms up to
 * make, and it is a reason to join one.
 *
 * Above that it is the house's own stipend ratio and nothing else. A house
 * that pays its elders a hundred times what it pays its intake houses them a
 * hundred times better, and a house that pays nearly flat does not - which is
 * the difference between the two houses saying something rather than a table
 * here saying it about both.
 *
 * A house with no stipend for a rung gives the chest. That is a runtime
 * splinter rather than a seeded house, and a floor is more honest than a zero.
 */
export function howMuchRoomAQuartersHas(stipendAtRung: number, stipendAtEntry: number): number {
    const mine = Math.max(0, stipendAtRung);
    const bottom = Math.max(1, stipendAtEntry);
    return Math.round(WHAT_A_CHEST_HOLDS * Math.max(1, mine / bottom));
}

/**
 * Litres the least quarters in the world hold.
 *
 * `WHAT_A_RING_HOLDS.mortal` rather than a number, so the comparison in
 * `howMuchRoomAQuartersHas` stays true if rings are ever repriced.
 */
export const WHAT_A_CHEST_HOLDS = WHAT_A_RING_HOLDS.mortal;

/**
 * The holder key a house's quarters keep their pack under.
 *
 * Not a location id, deliberately. A location id is where the room IS, and two
 * people quartered in one dormitory would then share one pack. This is whose
 * corner of it this is, and it survives every promotion because neither half
 * of it moves.
 */
export function whereAHouseLetsYouKeepThings(factionId: string, personId: string): string {
    return `quarters:${factionId}:${personId}`;
}

export interface QuartersQuery {
    factionId: string;
    personId: string;
    rankIndex: number;
    /** The house's monthly stipend at this rung, in spirit stones. */
    stipendAtRung: number;
    /** What the same house pays its lowest rung. */
    stipendAtEntry: number;
}

/**
 * The whole answer for one person: which room, how much of it, and who else.
 *
 * Null only when the house lodges nobody anywhere - which is a house with no
 * intake and no seat built, and is a fact about that house rather than about
 * the person asking.
 */
export function theQuartersOf(state: WorldState, query: QuartersQuery): Quarters | null {
    const rooms = theLodgingsOfAHouse(state, query.factionId);
    const room = whichRoomARungGets(rooms, query.rankIndex);
    if (room === null) return null;
    return {
        ...room,
        factionId: query.factionId,
        holderId: whereAHouseLetsYouKeepThings(query.factionId, query.personId),
        room: howMuchRoomAQuartersHas(query.stipendAtRung, query.stipendAtEntry),
        shareWith: howManyAreQuarteredThere(state, query.factionId, rooms, room, query.personId)
    };
}

/**
 * How many other living members of the house are put in this same room.
 *
 * Runs every member's own rung through `whichRoomARungGets`, so it cannot
 * disagree with the assignment it is counting.
 */
export function howManyAreQuarteredThere(
    state: WorldState,
    factionId: string,
    rooms: readonly LodgingRoom[],
    room: LodgingRoom,
    exceptPersonId?: string
): number {
    let count = 0;
    for (const npc of state.npcs) {
        if (npc.factionId !== factionId || npc.status !== 'alive') continue;
        if (npc.factionRankIndex < 0 || npc.id === exceptPersonId) continue;
        if (whichRoomARungGets(rooms, npc.factionRankIndex)?.locationId === room.locationId) {
            count++;
        }
    }
    return count;
}
