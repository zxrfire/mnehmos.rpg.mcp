/**
 * Saying a house's name and getting a road.
 *
 * ── THE DEFECT, MEASURED ─────────────────────────────────────────────────
 *
 * Three pinned worlds, 38 seated houses in each, a starting player on day 0:
 * `I travel to <house>` reached **0 of 38** in every one. Both halves were
 * already built and neither knew about the other - `seedSectGround` puts a
 * `sect_seat` row in the world called `<house> grounds` with a whole compound
 * hanging off it, and `somewhereReal` matches a typed name against location
 * NAMES. So the ground existed, the road to it existed, and the only string
 * that reached it was one no player would type.
 *
 * ── AND A REFUSAL HAD NOWHERE TO PUT ANYBODY ─────────────────────────────
 *
 * The second half is the one that makes the first worth fixing. A house's gate
 * is a door somebody may be turned away from, and until `the-town-at-the-foot-
 * of-a-house.ts` there was no square to be turned away TO: the map went
 * province, then wall. A player refused at a gate would have been left standing
 * on the province road with the compound as a name again.
 *
 * So a house's name now resolves to the town at its foot, and the gate is a day
 * up the road from there. Arriving at the town says what the gate would say,
 * which is the whole of the standing rule: **not having the standing to go in
 * is not the same as seeing nothing.**
 */

import { getSect } from '../data/cultivation/sects.js';
import {
    footTownId,
    theHouseAboveThisTown
} from '../engine/world/the-town-at-the-foot-of-a-house.js';
import {
    standingAtTheGateOf,
    whoseGateThisIs,
    type SomebodyOfTheHouse,
    type WhatTheGateSays
} from '../engine/world/standing-at-the-gate-of-a-house.js';
import { sectGroundId } from '../engine/world/seeding.js';
import type { LocationRecord } from '../engine/world/locations.js';
import type { WorldState } from '../engine/world/world-state.js';
import { ledgerAbout, type ObligationDb } from '../storage/repos/obligation.repo.js';
import type { Cultivator } from '../schema/cultivation.js';
import { loosePlaceKey } from './knowledge.js';
import type { GameService } from './turn-engine.js';

/** A house, its ground and the town below it, once a name has reached one. */
export interface AHouseYouCouldWalkTo {
    factionId: string;
    factionName: string;
    /** The compound. Behind the gate. */
    seat: LocationRecord;
    /** Outside the wall. Where anybody may stand. Null for a world with none. */
    town: LocationRecord | null;
    /**
     * Whether the sentence said the HOUSE or said its ground.
     *
     * A player who says the house's name has named a body and not a place, and
     * the road they want ends in the town. A player who says `<house> grounds`
     * has named the compound, which is the second step and is theirs to take -
     * routing that one to the town as well would be the engine deciding a
     * player may not walk up to a door.
     */
    named: 'the house' | 'its ground';
}

/**
 * The house a typed name reaches, or null where it reaches none.
 *
 * Matched on the world's own faction rows rather than the sect catalog, because
 * the seat and the town are world rows and a world may hold houses the catalog
 * does not. `<house> grounds` matches too: a player who learned the seat's real
 * name should not be routed somewhere else for saying it.
 */
export function theHouseThisNameReaches(
    world: WorldState,
    typed: string | null | undefined
): AHouseYouCouldWalkTo | null {
    const wanted = loosePlaceKey(typed ?? '');
    if (wanted.length === 0) return null;

    const byId = new Map(world.locations.map(row => [row.id, row]));
    for (const faction of world.factions) {
        const name = loosePlaceKey(faction.name);
        if (name !== wanted && `${name}-grounds` !== wanted) continue;
        const seat = byId.get(faction.seatLocationId ?? sectGroundId(faction.id))
            ?? byId.get(sectGroundId(faction.id))
            ?? null;
        if (!seat || seat.kind !== 'sect_seat') continue;
        return {
            factionId: faction.id,
            factionName: faction.name,
            seat,
            town: byId.get(footTownId(faction.id)) ?? null,
            named: name === wanted ? 'the house' : 'its ground'
        };
    }
    return null;
}

/** The house whose gate the player is standing outside, from a place name. */
export function theHouseWhoseTownThisIs(
    world: WorldState,
    placeName: string | null | undefined
): AHouseYouCouldWalkTo | null {
    const wanted = loosePlaceKey(placeName ?? '');
    if (wanted.length === 0) return null;
    const here = world.locations.find(row => loosePlaceKey(row.name) === wanted);
    const factionId = whoseGateThisIs(here ?? null);
    if (!factionId) return null;
    const faction = world.factions.find(row => row.id === factionId);
    const byId = new Map(world.locations.map(row => [row.id, row]));
    return {
        factionId,
        factionName: faction?.name ?? getSect(factionId)?.name ?? factionId,
        seat: byId.get(faction?.seatLocationId ?? sectGroundId(factionId))
            ?? byId.get(sectGroundId(factionId))
            ?? here!,
        town: byId.get(footTownId(factionId)) ?? null,
        named: here?.kind === 'sect_seat' ? 'its ground' : 'the house'
    };
}

/**
 * What the house's gate says to this cultivator, here, now.
 *
 * The engine module is pure and this is the half that goes and gets the rows:
 * the player's rung on this house's roll, and which of the house's own people
 * are at hand to host or to ask.
 */
export function whatTheGateOfThisHouseSays(
    game: GameService,
    cultivator: Cultivator,
    house: AHouseYouCouldWalkTo,
    hostedBy: SomebodyOfTheHouse | null = null,
    atTheGate: boolean = true
): WhatTheGateSays {
    const catalog = getSect(house.factionId);
    const world = game.atHand;
    const faction = world?.factions.find(row => row.id === house.factionId) ?? null;
    const ranks = faction?.ranks ?? catalog?.ranks ?? [];

    const membership = game.repos.sects.getMembership(cultivator.id);
    const standing = membership && membership.sectId === house.factionId
        ? membership.rankIndex
        : null;

    // WHOSE PEOPLE ARE OUT HERE, and they are read off the same roster every
    // other verb reads rather than off the house's catalog roll: a name on the
    // roll who is four provinces away cannot walk anybody through a gate.
    const theirPeopleHere: SomebodyOfTheHouse[] = game.present(cultivator)
        .filter(row => row.sectId === house.factionId)
        .map(row => ({
            id: row.id,
            name: row.name,
            rankIndex: rankIndexOf(game, row.id, ranks.length)
        }))
        .filter(row => row.rankIndex >= 0);

    return standingAtTheGateOf({
        factionId: house.factionId,
        factionName: house.factionName,
        ranks,
        recruits: catalog?.recruits ?? true,
        admissionOrdinal: catalog?.admissionOrdinal ?? 0,
        standing,
        theirPeopleHere,
        hostedBy,
        atTheGate
    });
}

/**
 * Where somebody sits on a house's ladder, or -1 where nothing says.
 *
 * A world NPC carries the rung on its own row; a stored cultivator carries it
 * in the membership table. Both are asked, because `present` returns the two
 * mixed and neither is the authority for the other.
 */
function rankIndexOf(game: GameService, personId: string, rankCount: number): number {
    const top = Math.max(0, rankCount - 1);
    // THE WORLD ROW FIRST, and it matters. A person exists in two stores and the
    // two rolls disagree: `repos.sects` is rebuilt from the catalog and a world
    // NPC standing in a compound carries its rung on its own row. Asking the
    // membership table first read the house's own people a rung or two low, so
    // a conclave disciple came back as an outer one and could not host.
    const npc = game.atHand?.npcs.find(row => row.id === personId) ?? null;
    if (npc && typeof npc.factionRankIndex === 'number' && npc.factionRankIndex >= 0) {
        return Math.min(npc.factionRankIndex, top);
    }
    const membership = game.repos.sects.getMembership(personId);
    if (membership && typeof membership.rankIndex === 'number') {
        return Math.min(membership.rankIndex, top);
    }
    return -1;
}

/**
 * Who of those at the gate would actually walk this person through it.
 *
 * THE GUEST ROAD IS THE FAVOUR LADDER DOING ITS EXISTING JOB. A host takes a
 * risk and spends standing; the reason they do it is that they owe you. So the
 * read is the obligation ledger: an open `debt` or `favor` whose holder is the
 * host and whose subject is the person asking. Nothing new is stored and there
 * is no hosting table.
 *
 * An inner or outer disciple who owes you cannot bring you in on their own
 * word - that is `couldHostAGuest` - and what they can do is spend the same
 * favour upward. That second step is not yet a verb; the gate says so rather
 * than pretending it is unavailable.
 */
export function whoWouldWalkYouIn(
    game: GameService,
    cultivator: Cultivator,
    candidates: readonly SomebodyOfTheHouse[]
): SomebodyOfTheHouse | null {
    if (candidates.length === 0) return null;
    const owed = new Set(
        ledgerAbout(game.repos.db as unknown as ObligationDb, cultivator.id)
            .filter(row =>
                row.status === 'open'
                && (row.kind === 'debt' || row.kind === 'favor')
                && row.subjectId === cultivator.id)
            .map(row => row.holderId)
    );
    return candidates.find(person => owed.has(person.id)) ?? null;
}

/**
 * What standing in the town below a house is worth saying.
 *
 * The trades and the standing crowd are derived on every read from the house's
 * catalog row, so nothing here can drift from the house it describes.
 */
export function isTheTownBelowAHouse(location: LocationRecord | null | undefined): boolean {
    return location != null && theHouseAboveThisTown(location) !== null;
}
