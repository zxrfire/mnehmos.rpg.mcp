/**
 * A house's counter is where the house is.
 *
 * `whoseCounterThisSitsAt` reads the three rows an institution owns off the
 * board (gate registration, oath witnessing, a realm placement) and
 * `whereThisIsActuallyDone` has said where each is done since it was written,
 * for "a board, a refusal and a scene" to say. The refusal was never written:
 * `buy` paid for any of the three wherever the player stood, so a hamlet sold a
 * place on a register held at nine city gates.
 *
 * WHERE A HOUSE IS: its own compound, and anywhere one of its people is standing
 * in front of the player. A house's postings are its people, which is how a
 * register can be kept at a city gate without the compound being there.
 */

import { whereThisIsActuallyDone, whoseCounterThisSitsAt, type Price } from '../data/cultivation/mortal-world.js';
import { theSeatOfTheCompound } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import type { Cultivator } from '../schema/cultivation.js';
import { worldLocationFor } from './entities.js';
import type { GameService } from './turn-engine.js';

export type WhetherTheCounterIsHere =
    | { here: true }
    | { here: false; houseName: string; line: string };

export function whetherTheHousesCounterIsHere(
    game: Pick<GameService, 'atHand' | 'present'>,
    cultivator: Cultivator,
    price: Pick<Price, 'name'>
): WhetherTheCounterIsHere {
    const house = whoseCounterThisSitsAt(price);
    if (house === null) return { here: true };
    const said = whereThisIsActuallyDone(price) ?? '';

    const world = game.atHand;
    const place = world ? worldLocationFor(world, cultivator.location) : null;
    const seat = world?.factions.find(row => row.id === house.factionId)?.seatLocationId ?? null;
    const atTheCompound = world !== null && place !== null && seat !== null
        && (place.id === seat || theSeatOfTheCompound(world, place.id)?.id === seat);
    const oneOfItsPeople = game.present(cultivator).some(person => person.sectId === house.factionId);
    if (atTheCompound || oneOfItsPeople) return { here: true };

    return {
        here: false,
        houseName: house.name,
        line: `${said} Nobody of the ${house.name.replace(/^the\s+/i, '')} is here to do it.`
    };
}
