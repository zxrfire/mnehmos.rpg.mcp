/**
 * The crew of a ship: a shipmaster and two or three hands, real people, kept from one voyage to the next.
 *
 * The owner: a crew "helps with gathering knowledge". So they are ordinary world rows, mortals or
 * low cultivators, who can be talked to and remember what they see, and whose trade is the water:
 * `sailor` is an occupation that has seen the road (`howMuchOfTheRoadALifeHasSeen`), so they know
 * the lanes and the ports as far as their lives reach.
 *
 * ONE SHIP TO A LANE, crewed the first time anybody boards it. Its people are written then and not
 * before, the way a beast with a core is given a row on contact, so no world is seeded with crews
 * nobody sails with. They carry the ship on a tag, so boarding that lane again finds the same
 * people. Somebody of the crew who has died stays dead: at the next boarding the place they left is
 * taken by somebody new, whose id carries the day they were taken on. Never the dead one's id,
 * because the world forgets its mortal dead (`theWorldForgetsTheMortalDead`) and an id written
 * again after that is a resurrection the store refuses.
 *
 * WHEN THE SHIP IS ATTACKED they are who defends it (`theRestOfTheFight`), on their own bodies,
 * and one who falls is dead ({@link theCrewWhoFell}).
 *
 * WHERE THEY ARE is where the ship is: aboard with the passenger at sea, and put in with them at
 * the far end. They work the ship together, so they stand on one deck, three at most to an area
 * like anybody (`where-in-a-place-somebody-is-standing.ts`), and the passenger stands with the
 * shipmaster.
 */

import type { SeaLane } from '../engine/world/what-a-sea-crossing-costs.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { markDead, type NpcRecord } from '../engine/world/npc-state.js';
import { ensureShipCrew, bindShipCrewToPassage, placeShipCrew } from '../engine/world/ship-crew.js';
import { shipIdForLane } from '../engine/world/the-ship-on-a-lane.js';
import type { PublicPassageLeg } from '../engine/world/public-shipping.js';
import { recordPublicPassage } from '../engine/world/public-shipping.js';
import { worldLocationFor } from './entities.js';
import type { GameService } from './turn-engine.js';
import type { AVoyage } from './a-ship-at-sea.js';

export function theCrewOfTheShip(game: GameService, lane: SeaLane, at: string, onDay: number): NpcRecord[] {
    if (!game.atHand) return [];
    const before = game.atHand.npcs.length;
    const crew = ensureShipCrew(game.atHand, lane, at, onDay);
    if (game.atHand.npcs.length !== before) game.theWorldMoved();
    return crew;
}

function voyageLeg(game: GameService, voyage: AVoyage, onDay: number): PublicPassageLeg | undefined {
    const world = game.atHand;
    const from = world && worldLocationFor(world, voyage.from);
    const to = world && worldLocationFor(world, voyage.bound);
    if (!from || !to) return undefined;
    return { lane: voyage.lane, vesselId: shipIdForLane(voyage.lane), fromId: from.id, toId: to.id,
        departureDay: onDay - voyage.sailed, arrivalDay: onDay + voyage.days - voyage.sailed };
}

export function theCrewAreOnThisVoyage(game: GameService, voyage: AVoyage, onDay: number): void {
    const leg = voyageLeg(game, voyage, onDay);
    if (!game.atHand || !leg) return;
    bindShipCrewToPassage(game.atHand, leg, onDay);
    recordPublicPassage(game.atHand, leg, onDay, leg.fromId);
    game.theWorldMoved();
}

export function theCrewIsWhereTheShipIs(game: GameService, lane: SeaLane, where: string,
    passengerId: string, onDay: number, atSea: boolean, voyage?: AVoyage): NpcRecord[] {
    const world = game.atHand;
    const row = world ? worldLocationFor(world, where) : null;
    if (!world || !row) return [];
    const crew = placeShipCrew(world, lane, row.id, onDay, atSea && voyage ? voyageLeg(game, voyage, onDay) : undefined);
    if (atSea && voyage) {
        const leg = voyageLeg(game, voyage, onDay);
        if (leg) recordPublicPassage(world, leg, onDay, row.id, crew.map(npc => npc.id));
    }
    game.theWorldMoved();
    const master = crew.find(npc => npc.identity.occupation === 'shipmaster') ?? crew[0];
    const deck = master ? theAreasOf(world, row).whereIs.get(master.id) : undefined;
    if (atSea && deck) game.repos.cultivators.standIn(passengerId, deck);
    return crew;
}

/** The crew who fell defending the ship are dead, where and when they fell. */
export function theCrewWhoFell(game: GameService, ids: readonly string[], onDay: number, where: string): void {
    const world = game.atHand;
    if (!world || ids.length === 0) return;
    for (const id of ids) {
        const at = world.npcs.findIndex(npc => npc.id === id && npc.status === 'alive');
        if (at >= 0) world.npcs[at] = markDead(world.npcs[at]!, onDay, `Killed defending the ship, ${where}.`);
    }
    game.theWorldMoved();
}
