/**
 * What the player knows of the land: what people where they were raised know, what standing
 * wherever they have got to shows them, and the world once they are on a house's roll. See
 * `what-somebody-knows-of-the-land.ts` for the ladder.
 *
 * Nothing else is handed over. The owner: "you should make the player work for it", and the work
 * is going further and asking: "you expand your horizons as you go further". Learned into the
 * knowledge gate, and only ever upward.
 */

import type { OriginTierKey } from '../engine/cultivation/origin.js';
import {
    A_HOUSE_HEARD_OF_AT_HOME,
    A_HOUSE_SEEN_GROWING_UP,
    theRoadAnUpbringingSaw,
    whatSomebodyKnowsOfTheLand,
    whatStandingHereShows,
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
 * turn, what standing where they are shows them, and the world once they are on a house's roll.
 */
export function learnWhatTheLandTeachesThem(game: GameService, cultivator: Cultivator, raised?: AnUpbringing): number {
    const world = game.atHand;
    if (!world) return 0;
    const onDay = Math.floor(world.currentDay);
    let learned = 0;
    // What the roads out of here are signed for, and the names a traveller hears in a day.
    for (const place of whatStandingHereShows(world, cultivator.location)) {
        if (game.knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'place', id: place.name, name: place.name, onDay,
            sourceKind: place.stage === 'placed' ? 'witnessed' : 'overheard', stage: place.stage,
            sourceNote: place.stage === 'placed'
                ? `The road out of ${cultivator.location} is signed for it.`
                : `A name you heard said in ${cultivator.location}.`
        })) learned++;
    }
    if (raised === undefined && cultivator.sectId === null) return learned;
    const rankIndex = cultivator.sectId ? theRungTheyHold(game, cultivator) : -1;
    const known = whatSomebodyKnowsOfTheLand(world, {
        id: cultivator.id,
        from: raised?.at ?? cultivator.location,
        ordinal: cultivator.realmOrdinal,
        house: cultivator.sectId ? { id: cultivator.sectId, rankIndex: Math.max(0, rankIndex) } : null,
        travelled: raised ? theRoadAnUpbringingSaw(raised.origin) : 0,
        aWayToOneHouse: true
    });
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
            sourceNote: raised
                ? (house.stage === 'placed' ? A_HOUSE_SEEN_GROWING_UP : A_HOUSE_HEARD_OF_AT_HOME)
                : house.stage === 'placed'
                    ? 'A house whose disciples you have seen, and whose gate you could find.'
                    : 'A house people where you have lived know of.'
        })) learned++;
    }
    return learned;
}
