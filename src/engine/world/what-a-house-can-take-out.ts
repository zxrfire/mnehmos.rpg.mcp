/** The house's counted and tracked craft, read from the yard it owns now. */
import { CARRIAGES_BY_GRADE, countedHolding, getConveyance, requireConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import type { Conveyance } from './what-a-conveyance-does-to-a-journey.js';
import { bestForThisRoad, priceJourney } from './what-a-conveyance-does-to-a-journey.js';
import { walkingDaysFrom } from './locations.js';
import { journeyNeedsWater } from './places-on-the-way.js';
import type { NpcRecord } from './npc-state.js';
import type { FactionRecord, WorldState } from './world-state.js';

export function whatThisHouseCouldTakeOut(state: WorldState, faction: FactionRecord):
    { conveyance: Conveyance; power: number | null }[] {
    const out: { conveyance: Conveyance; power: number | null }[] = [];
    for (const id of CARRIAGES_BY_GRADE) {
        if (countedHolding(faction.resources, id) > 0) {
            out.push({ conveyance: requireConveyance(id), power: null });
        }
    }
    for (const thing of state.objects) {
        if (thing.ownerId !== faction.id) continue;
        const id = thing.data.conveyanceId;
        if (typeof id !== 'string') continue;
        const kind = getConveyance(id);
        if (kind === undefined) continue;
        out.push({ conveyance: kind, power: thing.power ?? null });
    }
    return out;
}

/** A receiving house pays for the selected disciple's actual route to its seat. */
export function journeyToHouseSeat(state: WorldState, house: FactionRecord,
    npc: NpcRecord, day: number): NpcRecord | null {
    const from = npc.locationId;
    const to = house.seatLocationId;
    if (!from || !to) return null;
    if (from === to) return { ...npc, activity: null, updatedOnDay: day };
    const distance = walkingDaysFrom(state.locations, from).get(to);
    if (distance === undefined) return null;
    const water = journeyNeedsWater(state.locations, from, to);
    const purse = Number(house.resources.spirit_stones ?? 0);
    const taking = bestForThisRoad(whatThisHouseCouldTakeOut(state, house), distance, 1, water, purse);
    if (water && !taking) return null;
    const quote = taking ? priceJourney({ walkingDays: distance,
        conveyance: taking.conveyance, power: taking.power, heads: 1,
        crossesGroundThatCannotBeWalked: water }) : null;
    if (quote && quote.stonesBurned > purse) return null;
    if (quote && quote.stonesBurned > 0) house.resources.spirit_stones = purse - quote.stonesBurned;
    return { ...npc, activity: { kind: 'travelling',
        note: `Travelling to ${house.name} after selection.`, withIds: [],
        sinceDay: day, untilDay: day + (quote?.daysForEverybody ?? Math.max(1, Math.ceil(distance))),
        fromLocationId: from, returnTo: to,
        conveyanceId: taking?.conveyance.id ?? null,
        conveyancePower: taking?.power ?? null }, updatedOnDay: day };
}
