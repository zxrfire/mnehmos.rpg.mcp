/** Existing lane position shared by real voyages and NPC passage activities. */
import { REGIONS, regionIdOfPlace } from '../../data/cultivation/regions.js';
import { commitDayOf, type SeaLane } from './what-a-sea-crossing-costs.js';

export function waterUnderSeaPassage(voyage: { from: string; bound: string; lane?: SeaLane; sailed: number }): string | null {
    if (voyage.lane?.water && voyage.sailed >= commitDayOf(voyage.lane)) return voyage.lane.water;
    const ends = [regionIdOfPlace(voyage.from), regionIdOfPlace(voyage.bound)];
    const water = REGIONS.find(region => region.openWater === true && ends.includes(region.id))
        ?? REGIONS.find(region => region.openWater === true);
    return water?.name ?? null;
}
