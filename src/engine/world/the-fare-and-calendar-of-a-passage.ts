/** The public board's existing pure fare and calendar reads, shared with NPC booking. */
import { cashToStones, getPrice } from '../../data/cultivation/mortal-world.js';
import { localPrice } from '../../data/cultivation/regions.js';
import { quotePassage, type SeaLane } from './what-a-sea-crossing-costs.js';

/** Li walked in a day, which turns the caravan's per-hundred-li fare into a fare a walked day. */
const LI_WALKED_IN_A_DAY = 60;

/** The run day's month, 1 to 12. */
export function monthOf(day: number): number {
    const inTheYear = ((Math.floor(day) % 365) + 365) % 365;
    return Math.min(12, Math.floor(inTheYear / (365 / 12)) + 1);
}

/** A seat's fare in cash, for this service and road, at the rate where they stand. */
export function theSeatFare(regionId: string, service: 'ship' | 'carriage', walkingDays: number, lane: SeaLane | null): number {
    if (service === 'ship') {
        if (!lane) throw new Error('A ship fare requires its sea lane.');
        const row = getPrice(lane && lane.intermediateLandfallDays.length === 0
            ? 'price-deck-passage-open-water'
            : 'price-sea-passage')!;
        return quotePassage(lane, 1,
            localPrice(regionId, row.cash)).fareCash;
    }
    const perHundredLi = localPrice(regionId, getPrice('price-caravan-passage')!.cash);
    return Math.round(perHundredLi * LI_WALKED_IN_A_DAY / 100) * walkingDays;
}

export function stonesFor(cash: number): number {
    return Math.max(1, Math.ceil(cashToStones(cash)));
}
