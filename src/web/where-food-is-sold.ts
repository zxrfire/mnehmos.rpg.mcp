/**
 * Where a meal or a sack of dry food comes from, where somebody is standing: a settlement, the town
 * below a house's wall, or the house's own refectory for one of its own. Anywhere else the pack is
 * what there is.
 *
 * Played blind: a starving outsider at the Azure Dew Sect's gate said "i need to eat something
 * before i pass out", and a bowl was bought for a spirit stone with nothing saying where. The
 * narration, with nobody selling anything to put in the scene, still had them starving. The town
 * below the wall was selling it all along (`whatTradesBelow`: the grain market and the inn).
 */

import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import { REGIONS } from '../data/cultivation/regions.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import { whatTheTownIsBelow, whatTradesBelow } from '../engine/world/the-town-at-the-foot-of-a-house.js';
import { theAreaTheyAreIn } from './walking-across-a-place.js';
import { theHouseWhoseGateThisIs } from './walking-up-to-a-house.js';

/** Food to be had here and where it is bought, or none. */
export type WhereTheFoodIs = { sold: true; where: string } | { sold: false };

/**
 * Where food is bought here. The one seam for what feeds somebody where they stand: a hull's
 * rations aboard a ship belong here too, ahead of the pack.
 */
export function whereFoodComesFromHere(game: GameService, cultivator: Cultivator): WhereTheFoodIs {
    const standing = standingOf(cultivator);
    if (standing.settlementKind !== null) return { sold: true, where: `in ${standing.placeName ?? cultivator.location}` };
    const here = theAreaTheyAreIn(game.atHand, cultivator);
    const house = game.atHand && here ? theHouseWhoseGateThisIs(game.atHand, here.place.name) : null;
    if (!house) return { sold: false };
    if (cultivator.sectId === house.factionId
        || game.repos.sects.getMembership(cultivator.id)?.sectId === house.factionId) {
        return { sold: true, where: `at the ${house.factionName}'s refectory` };
    }
    const town = whatTheTownIsBelow(house.factionId);
    const trades = town ? whatTradesBelow(town).map(trade => trade.id) : [];
    if (trades.includes('inn')) return { sold: true, where: 'at the inn in the town below the gate' };
    if (trades.includes('grain')) return { sold: true, where: 'at the market in the town below the gate' };
    return { sold: false };
}

/** The settlements of this province the player knows by where they are, the largest first. */
export function theTownsTheyKnowHere(game: GameService, cultivator: Cultivator): string[] {
    const province = REGIONS.find(region => region.id === standingOf(cultivator).regionId);
    if (!province) return [];
    const known = new Set(game.knowledge.awareness(cultivator.id, 'place')
        .filter(row => row.stage !== 'unaware' && row.stage !== 'whisper' && row.stage !== 'named')
        .map(row => row.name.toLowerCase()));
    const SIZE: Record<string, number> = { city: 0, market_town: 1, sect_town: 2, village: 3, hamlet: 4 };
    return province.places
        .filter(place => place.kind in SIZE && known.has(place.name.toLowerCase())
            && place.name.toLowerCase() !== (cultivator.location ?? '').trim().toLowerCase())
        .sort((a, b) => SIZE[a.kind]! - SIZE[b.kind]!)
        .map(place => place.name);
}

/** What is said where nobody sells food: that, and the towns of this province they know. */
export function whereFoodIsSoldInstead(game: GameService, cultivator: Cultivator): string {
    const towns = theTownsTheyKnowHere(game, cultivator).slice(0, 2);
    return towns.length === 0
        ? 'Nobody here sells food.'
        : `Nobody here sells food. It is sold in the towns, and of this province's you know ${towns.join(' and ')}.`;
}
