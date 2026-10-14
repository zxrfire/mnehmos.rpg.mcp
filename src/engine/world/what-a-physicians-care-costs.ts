/** The catalog and local ground price one physician's actual service. */
import { cashToStones, getPrice } from '../../data/cultivation/mortal-world.js';
import { localPrice } from '../../data/cultivation/regions.js';

export const PHYSICIAN_VISIT_PRICE = 'price-doctor-visit';
export const PHYSICIAN_COURSE_PRICE = 'price-splint-and-month';

export function carePricesOnThisGround(regionId: string, groundHere: number) {
    const visit = getPrice(PHYSICIAN_VISIT_PRICE)!;
    const course = getPrice(PHYSICIAN_COURSE_PRICE)!;
    const courseCash = Math.max(1, Math.round(localPrice(regionId, course.cash) * groundHere));
    const perWound = Math.max(1, Math.ceil(cashToStones(courseCash)));
    const visitCash = Math.max(1, Math.round(localPrice(regionId, visit.cash) * groundHere));
    const restingPrice = Math.max(1, Math.ceil(cashToStones(visitCash)));
    return { visit, course, courseCash, perWound, visitCash, restingPrice };
}
