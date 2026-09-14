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
 * ── AND A REFUSAL HAD NOTHING TO SAY ─────────────────────────────────────
 *
 * The second half is what makes the first worth fixing. Reaching the ground was
 * not the same as meeting a door: the seat is open at an entry threshold of
 * zero, so the compound's own walls did their job three courts further in and
 * nothing at all happened at the gate.
 *
 * So a house's name resolves to its seat, and arriving there is arriving at the
 * gate with the market around it. What the gate says carries the market, the
 * standing crowd outside it, and all three roads in - which is the standing
 * rule: **not having the standing to go in is not the same as seeing
 * nothing.**
 */

import { getSect } from '../data/cultivation/sects.js';
import {
    standingAtTheGateOf,
    whoseGateThisIs,
    type SomebodyOfTheHouse,
    type WhatTheGateSays
} from '../engine/world/standing-at-the-gate-of-a-house.js';
import { sectGroundId } from '../engine/world/seeding.js';
import {
    rankIndexOnAHousesRoll,
    whereSomebodyStandsOnAHousesRoll,
    type TheRollsToRead,
    type WhereTheyStandOnARoll
} from '../engine/world/where-somebody-stands-on-a-houses-roll.js';
import type { LocationRecord } from '../engine/world/locations.js';
import type { WorldState } from '../engine/world/world-state.js';
import { ledgerAbout, type ObligationDb } from '../storage/repos/obligation.repo.js';
import { whichWayItPoints } from '../engine/social/grudges.js';
import type { Cultivator } from '../schema/cultivation.js';
import { loosePlaceKey } from './knowledge.js';
import type { GameService } from './turn-engine.js';

/** A house and the ground its gate stands on, once a name has reached one. */
export interface AHouseYouCouldWalkTo {
    factionId: string;
    factionName: string;
    /** The seat: the gate, the forecourt, and the walls behind them. */
    seat: LocationRecord;
}

/**
 * The house a typed name reaches, or null where it reaches none.
 *
 * Matched on the world's own faction rows rather than the sect catalog, because
 * the seat is a world row and a world may hold houses the catalog does not.
 * `<house> grounds` matches too, so the name the player was told and the name
 * the world stores reach the same door.
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
            seat
        };
    }
    return null;
}

/** The house whose gate this place is, from a place name. Null for anywhere else. */
export function theHouseWhoseGateThisIs(
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
            ?? here!
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
    hostedBy: SomebodyOfTheHouse | null = null
): WhatTheGateSays {
    const catalog = getSect(house.factionId);
    const world = game.atHand;
    const faction = world?.factions.find(row => row.id === house.factionId) ?? null;
    const ranks = faction?.ranks ?? catalog?.ranks ?? [];

    const onTheRoll = whereSomebodyStandsOnAHousesRoll(theRollsOf(game), cultivator.id);
    const standing = onTheRoll && onTheRoll.factionId === house.factionId
        ? onTheRoll.rankIndex
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
        hostedBy
    });
}

/**
 * The two stores, wired to a game handle.
 *
 * The rung itself is not decided here and has not been since the mirror on the
 * cultivator row was removed: `where-somebody-stands-on-a-houses-roll.ts` is
 * the one answer in the repo, and this is the adapter that hands it the world
 * and the roll. A caller with no `GameService` builds its own.
 */
export function theRollsOf(game: GameService): TheRollsToRead {
    return {
        world: game.atHand ?? null,
        rollRowFor: id => game.repos.sects.getMembership(id)
    };
}

/** Where somebody sits on a house's ladder, or -1 where nothing says. */
export function rankIndexOf(game: GameService, personId: string, rankCount: number): number {
    return rankIndexOnAHousesRoll(theRollsOf(game), personId, rankCount);
}

export type WhereYouStandOnARoll = WhereTheyStandOnARoll;

/**
 * The rung this cultivator holds, as an index, or -1 at none.
 *
 * For the callers that want the number and not the word. It is a wrapper and
 * not a second read: every one of them used to work the index out for itself
 * from the mirrored rank string by searching the catalog ladder for it.
 */
export function theRungTheyHold(game: GameService, cultivator: Cultivator): number {
    return whereYouStandOnYourHousesRoll(game, cultivator)?.rankIndex ?? -1;
}

/**
 * The rung you hold on your own house's roll.
 *
 * `status` never said it. A player on a house's roll asking how they were doing
 * was told their realm, their age, their purse and their load, and nothing at
 * all about which rung of the house they held - which is the fact that decides
 * what they may take off the board and who has to be asked for anything.
 *
 * Null for somebody on no roll, which is a fact about them and not a gap.
 */
export function whereYouStandOnYourHousesRoll(
    game: GameService,
    cultivator: Cultivator
): WhereYouStandOnARoll | null {
    return whereSomebodyStandsOnAHousesRoll(theRollsOf(game), cultivator.id);
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
    // ── WHICH WAY THE ROW POINTS IS NOT THE SAME FOR THE TWO KINDS ───────
    //
    // This read it off the columns - holder over here, subject over there -
    // and a `debt` and a `favor` do not agree about which column is the ower.
    // `whichWayItPoints` says so outright: a debt's HOLDER has to make it good
    // and a favour's SUBJECT does. So the hand-rolled filter found hosts the
    // player owed a favour TO, which is the opposite of the sentence two
    // paragraphs up, and the guest road was offered by exactly the people with
    // no reason to take a risk for you.
    //
    // Asking the one function rather than restating it is also why this cannot
    // drift again: there is one answer in the repo about which way an
    // obligation runs, and this is now a caller of it rather than a copy.
    const owesYou = new Set<string>();
    for (const row of ledgerAbout(game.repos.db as unknown as ObligationDb, cultivator.id)) {
        if (row.status !== 'open') continue;
        if (row.kind !== 'debt' && row.kind !== 'favor') continue;
        const points = whichWayItPoints(row);
        if (points.sense !== 'owes') continue;
        if (points.owedId === cultivator.id && points.owerId !== null) {
            owesYou.add(points.owerId);
        }
    }
    return candidates.find(person => owesYou.has(person.id)) ?? null;
}


