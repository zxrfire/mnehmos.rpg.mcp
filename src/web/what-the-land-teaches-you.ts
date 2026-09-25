/**
 * What the player knows of the land: what people where they were raised know, and the world once
 * they are on a house's roll. See `what-somebody-knows-of-the-land.ts` for the ladder.
 *
 * Nothing else is handed over. The owner: "you should make the player work for it"; the rest is
 * asked of the people they meet. Learned into the knowledge gate as told, and only ever upward.
 */

import type { OriginTierKey } from '../engine/cultivation/origin.js';
import {
    theRoadAnUpbringingSaw,
    whatSomebodyKnowsOfTheLand,
    whereALifeBeforeTookThem
} from '../engine/world/what-somebody-knows-of-the-land.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import { theRungTheyHold } from './walking-up-to-a-house.js';

/** Where they were raised and what their family was, for the life before the game. */
export interface AnUpbringing {
    at: string;
    origin: OriginTierKey;
    /** The house their family belongs to or serves, if any. */
    houseId: string | null;
}

/**
 * Learns what the land teaches them, and says how many things they had not known. At birth, off
 * their upbringing: the owner, "in a 16 year life you probably have seen at least a few sect
 * disciples", so at least one or two houses by name, where each is a matter of luck, and a name
 * is something to ask after: "if you know 1-2 sects, you can figure out where they are". On a
 * turn, only once they are on a house's roll.
 */
export function learnWhatTheLandTeachesThem(game: GameService, cultivator: Cultivator, raised?: AnUpbringing): number {
    const world = game.atHand;
    if (!world || (raised === undefined && cultivator.sectId === null)) return 0;
    const rankIndex = cultivator.sectId ? theRungTheyHold(game, cultivator) : -1;
    const known = whatSomebodyKnowsOfTheLand(world, {
        id: cultivator.id,
        from: raised?.at ?? cultivator.location,
        ordinal: cultivator.realmOrdinal,
        house: cultivator.sectId ? { id: cultivator.sectId, rankIndex: Math.max(0, rankIndex) } : null,
        travelled: raised ? theRoadAnUpbringingSaw(raised.origin) : 0,
        aWayToOneHouse: true
    });
    const onDay = Math.floor(world.currentDay);
    let learned = 0;
    // The places their life had already taken them, stood in rather than heard of.
    for (const name of raised ? whereALifeBeforeTookThem(world, { origin: raised.origin, from: raised.at, houseId: raised.houseId }) : []) {
        if (game.knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'place', id: name, name, onDay,
            sourceKind: 'witnessed', stage: 'encountered',
            sourceNote: 'Somewhere your life before had already taken you.'
        })) learned++;
    }
    for (const place of known.places) {
        if (game.knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'place', id: place.name, name: place.name, onDay,
            sourceKind: 'told', stage: place.stage,
            sourceNote: 'What people where you have lived know of the land.'
        })) learned++;
    }
    for (const house of known.houses) {
        if (game.knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'sect', id: house.id, name: house.name, onDay,
            sourceKind: 'told', stage: house.stage,
            sourceNote: house.stage === 'placed'
                ? 'A house whose disciples you have seen, and whose gate you could find.'
                : 'A house people where you have lived know of.'
        })) learned++;
    }
    return learned;
}
