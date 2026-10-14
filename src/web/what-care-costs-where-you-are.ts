/** The same local physician prices for an offered course and a question about it. */
import { carePricesOnThisGround, PHYSICIAN_COURSE_PRICE } from '../engine/world/what-a-physicians-care-costs.js';
export { PHYSICIAN_VISIT_PRICE, PHYSICIAN_COURSE_PRICE } from '../engine/world/what-a-physicians-care-costs.js';
import { getPrice } from '../data/cultivation/mortal-world.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';


/** Read only. The existing transaction decides what is bought and writes the fee. */
export function carePricesHere(game: GameService, cultivator: Cultivator) {
    const regionId = standingOf(cultivator, game.atHand).regionId;
    const groundHere = game.groundPriceMultiplier(cultivator, getPrice(PHYSICIAN_COURSE_PRICE)!.category);
    return { ...carePricesOnThisGround(regionId, groundHere), regionId, groundHere };
}
