/** The same local physician prices for an offered course and a question about it. */
import { cashToStones, getPrice } from '../data/cultivation/mortal-world.js';
import { localPrice } from '../data/cultivation/regions.js';
import { standingOf } from '../server/consolidated/cultivation-mortal.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';

export const PHYSICIAN_VISIT_PRICE = 'price-doctor-visit';
export const PHYSICIAN_COURSE_PRICE = 'price-splint-and-month';

/** Read only. The existing transaction decides what is bought and writes the fee. */
export function carePricesHere(game: GameService, cultivator: Cultivator) {
    const visit = getPrice(PHYSICIAN_VISIT_PRICE)!;
    const course = getPrice(PHYSICIAN_COURSE_PRICE)!;
    const regionId = standingOf(cultivator, game.atHand).regionId;
    const groundHere = game.groundPriceMultiplier(cultivator, course.category);
    const courseCash = Math.max(1, Math.round(localPrice(regionId, course.cash) * groundHere));
    const perWound = Math.max(1, Math.ceil(cashToStones(courseCash)));
    const visitCash = Math.max(1, Math.round(localPrice(regionId, visit.cash) * groundHere));
    const restingPrice = Math.max(1, Math.ceil(cashToStones(visitCash)));
    return { visit, course, regionId, groundHere, courseCash, perWound, visitCash, restingPrice };
}
