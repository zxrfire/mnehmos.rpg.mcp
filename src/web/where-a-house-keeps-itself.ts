/**
 * Somebody local pointing at a house's own ground.
 *
 * ── THE DEAD END THIS CLOSES ─────────────────────────────────────────────
 *
 * FOUND BY PLAYING BLIND, on turn four of a fresh run. The sequence a new
 * player actually walks:
 *
 *     > i want to join a sect
 *     The Burnt Earth Temple would seat you as a Lamp Novice, and the Azure Dew
 *     Sect would take you as a Dew Servant... There are four other houses that
 *     would accept someone of your standing.
 *
 *     > i go to the azure dew sect
 *     You have the name. You do not have the road. Whoever they are, they have
 *     not said where they keep themselves, and a name is not a direction.
 *
 *     > where can I go
 *     You carry five other names in your head, but they are just words; you do
 *     not know the roads that lead to them. Somebody would have to tell you
 *     where.
 *
 * Seven houses offered, no road to any of them, and the game stating the remedy
 * in its own voice - *somebody would have to tell you where*. Nobody could.
 * `whoCouldPointAtAGround` offers DAO GROUNDS and nothing else, so the only
 * roads a player could ever be given led to veins and villages. A house's seat
 * is a first-class location (`kind: 'sect_seat'`, parented to its region) and
 * `seatLocationId` has been on the faction record since the world state was
 * written; the two were never joined.
 *
 * The refusal, the destinations read and the join listing were each correct on
 * their own. Together they were a closed door with a sign on it describing the
 * key.
 *
 * ── WHO CAN POINT, AND WHY IT IS THE MODEST RULE ─────────────────────────
 *
 * Two cases, and both are ordinary knowledge rather than anything earned:
 *
 *   THEIR OWN HOUSE. Somebody on a house's roll knows the way home. There is no
 *   weaker claim available about a person and their own compound.
 *
 *   A HOUSE SEATED IN THE REGION THEY ARE STANDING IN. This is the dao-ground
 *   rule's own reasoning, one subject over: *somebody here can point at it
 *   because it is ordinary to them*. A compound with a gate, in the province
 *   you live in, is a landmark.
 *
 * Deliberately NOT power, and deliberately not `startingAwareness`. A house
 * being famous enough to NAME is a different question from somebody being able
 * to walk you to the door, and the second is local where the first is not - the
 * whole point of `lore.ts`'s floor is that a great house's name travels further
 * than its road does. Nothing here hands out a road across a province.
 *
 * ── AND IT GRANTS A PLACE, WHICH IS THE POINT ────────────────────────────
 *
 * The caller records it at `placed`, the same stage the dao-ground channel
 * uses, which is what `resolvePlace` needs before a move will run. Knowing OF a
 * house stays what it was; this is the separate fact of knowing where it is.
 */

import type { WorldState } from '../engine/world/world-state.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import { npcsAt } from '../engine/world/world-state.js';

/** A house's own ground, as somebody standing here could describe it. */
export interface AHouseSomebodyCanPlace {
    /** The faction. */
    readonly houseId: string;
    readonly houseName: string;
    /** The location id of its seat, which is what a move resolves against. */
    readonly seatId: string;
    readonly seatName: string;
    /** True where the speaker is on that house's own roll. */
    readonly theirOwn: boolean;
}

export interface SomebodyWhoKnowsTheRoad {
    readonly speaker: NpcRecord;
    readonly house: AHouseSomebodyCanPlace;
}

/** The region a location sits in, walking up the parent chain. */
function regionOf(state: WorldState, locationId: string | null): string | null {
    let at = locationId;
    const seen = new Set<string>();
    while (at !== null && !seen.has(at)) {
        seen.add(at);
        const row = state.locations.find(l => l.id === at);
        if (!row) return null;
        if (row.kind === 'region') return row.id;
        at = row.parentId ?? null;
    }
    return null;
}

/**
 * Everybody standing here who could walk somebody to a house's gate.
 *
 * Ordered by speaker id and then by house id, so one world answers one way.
 */
export function whoCouldPointAtAHouse(
    state: WorldState,
    locationId: string
): SomebodyWhoKnowsTheRoad[] {
    const hereRegion = regionOf(state, locationId);
    const out: SomebodyWhoKnowsTheRoad[] = [];

    const seated = state.factions
        .filter(house => typeof house.seatLocationId === 'string' && house.seatLocationId.length > 0)
        .sort((a, b) => (a.id < b.id ? -1 : 1));

    for (const npc of [...npcsAt(state, locationId)].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        for (const house of seated) {
            const seatId = house.seatLocationId as string;
            const seat = state.locations.find(l => l.id === seatId);
            if (!seat) continue;

            // Standing ON the ground is not being told where it is, and a
            // player who is already there does not need pointing at it.
            if (seat.id === locationId) continue;

            const theirOwn = npc.factionId === house.id;
            const local = hereRegion !== null && regionOf(state, seatId) === hereRegion;
            if (!theirOwn && !local) continue;

            out.push({
                speaker: npc,
                house: {
                    houseId: house.id,
                    houseName: house.name,
                    seatId,
                    seatName: seat.name,
                    theirOwn
                }
            });
        }
    }
    return out;
}

/**
 * What somebody would say about a house's ground, in one sentence.
 *
 * Composed from the row and never authored per house, the same rule the
 * dao-ground sentence keeps. Two facts and no more: where it is, and how the
 * speaker comes to know. Whether the listener would be taken is not the
 * speaker's business and is not said - the join read owns that and says it
 * better.
 */
export function whatSomebodyWouldSayAboutAHouse(
    house: AHouseSomebodyCanPlace,
    speaker: string
): string {
    return house.theirOwn
        ? `${speaker} is of ${house.houseName} and says where the gate is without being asked `
          + 'twice. It is a road like any other once somebody has walked it.'
        : `${speaker} can point at ${house.seatName}. It is in the province and it has a gate on `
          + 'it; knowing that much is ordinary here.';
}

/** What the player ends up holding about it. */
export function whatTheyNowHoldAboutAHouse(house: AHouseSomebodyCanPlace): string {
    return `${house.seatName} is where ${house.houseName} keeps itself, and you could set out `
        + 'for it.';
}
