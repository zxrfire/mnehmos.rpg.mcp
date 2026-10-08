/** Public transport offerings and physical hubs, derived from existing routes.
 * The original web line reader and province arrival selector live here once so
 * local knowledge, area navigation and ticket counters ask the same authority.
 * A public hub is common local knowledge; it is not a personal travel history.
 * This read creates no vehicle, provider, fare, booking or knowledge record.
 */
import { getOccupation } from '../../data/cultivation/mortal-world.js';
import { REGIONS, isOpenWater, placesNextTo, provinceRoadDays, regionIdOfPlace, requireRegion } from '../../data/cultivation/regions.js';
import { requireConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import { publicShipLinesFrom, theProvinceOf, type DockWorld } from './public-shipping.js';
import { daysByConveyance } from './what-a-conveyance-does-to-a-journey.js';
import { theSeatFare } from './the-fare-and-calendar-of-a-passage.js';
import { counterPlaceNameAt, routesFrom } from './where-the-measured-span-still-answers.js';
import { populationWeightOf, type LocationRecord } from './locations.js';
import { pathTo } from './architecture.js';
import { worldLocationFor } from './place-lookup.js';
import type { SeaLane } from './what-a-sea-crossing-costs.js';
type AService = 'ship' | 'carriage';
const THE_DRAWN_CARRIAGE = 'conv-carriage-mortal';
export interface ALine {
    service: AService;
    to: string;
    walkingDays: number;
    days: number;
    cashPerSeat: number;
    /** Null where it runs today; otherwise the first run day it does. */
    runsFromDay: number | null;
    /** The lane a ship sails; null for a carriage. */
    lane: SeaLane | null;
}


export function theMostPeopledPlaceIn(
    world: { locations: readonly LocationRecord[] },
    provinceId: string
): LocationRecord | null {
    let best: LocationRecord | null = null;
    for (const place of world.locations) {
        if (place.kind !== 'settlement' || place.sealed) continue;
        if (place.thresholds.entry > 0 || place.thresholds.survival > 0) continue;
        if (populationWeightOf(place) <= 0) continue;
        if (!pathTo(world.locations, place.id).some(step => step.id === provinceId)) continue;
        if (best === null || populationWeightOf(place) > populationWeightOf(best)) best = place;
    }
    return best;
}


/** Canonical province approach, moved unchanged from the web travel reader. */
export function whereTheRoadEndsIn(world: DockWorld, place: string): { name: string; provinceName: string | null } {
    const bare = (name: string) => name.replace(/^the\s+/i, '').toLowerCase();
    const worldRow = world ? worldLocationFor(world, place) : null;
    const asProvince = regionIdOfPlace(place) ? undefined : REGIONS.find(region => bare(region.name) === bare(place));
    const name = worldRow?.name ?? asProvince?.name ?? place;
    const row = world ? worldLocationFor(world, name) : null;
    if (!world || !row || row.kind !== 'region') return { name, provinceName: null };
    const town = theMostPeopledPlaceIn(world, row.id);
    return town ? { name: town.name, provinceName: row.name } : { name, provinceName: null };
}
/** Exact original public line logic; web retains its actual unfinished-road guard. */
export function publicTransportFrom(world: DockWorld, here: string, today: number, catalogRegion?: string): ALine[] {
    const regionId = catalogRegion ?? theProvinceOf(world, here);
    if (!regionId) return [];
    const lines: ALine[] = publicShipLinesFrom(world, here, today);
    if (isOpenWater(regionId) || isOpenWater(theProvinceOf(world, here))) return lines;

    const carriage = requireConveyance(THE_DRAWN_CARRIAGE);
    const byRoad = new Map<string, number>();
    for (const next of placesNextTo(here)) {
        if (next.kind === 'road') byRoad.set(next.name, next.travelDays);
    }
    // THE PROVINCE ROADS COME INTO ONE TOWN, and that town's station runs them.
    const province = requireRegion(regionId);
    if (whereTheRoadEndsIn(world, province.name).name === here) {
        for (const link of province.connections) {
            if (link.kind === 'sea_crossing' || isOpenWater(link.otherRegionId)) continue;
            const days = provinceRoadDays(province.id, link.otherRegionId);
            const other = REGIONS.find(region => region.id === link.otherRegionId);
            if (days === null || !other) continue;
            const town = whereTheRoadEndsIn(world, other.name).name;
            if (!regionIdOfPlace(town)) continue;
            byRoad.set(town, Math.min(days, byRoad.get(town) ?? Infinity));
        }
    }
    for (const [to, walkingDays] of [...byRoad].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))) {
        lines.push({
            service: 'carriage',
            to,
            walkingDays,
            days: daysByConveyance(walkingDays, carriage),
            cashPerSeat: theSeatFare(regionId, 'carriage', walkingDays, null),
            runsFromDay: null,
            lane: null
        });
    }
    return lines;
}


export type PublicHubKind = 'landing' | 'carriage_station' | 'span_counter';
export interface PublicHub { kind: PublicHubKind; name: string; destinations: string[] }
/** Physical public venues persist through closed timetables or occupied seats. */
export function publicTransportHubsAt(world: DockWorld, here: string, today: number): PublicHub[] {
    const lines = publicTransportFrom(world, here, today);
    const hubs: PublicHub[] = [];
    for (const [service, kind, name] of [['ship', 'landing', 'the landing'], ['carriage', 'carriage_station', 'the carriage station']] as const) {
        const destinations = lines.filter(line => line.service === service).map(line => line.to);
        if (destinations.length) hubs.push({ kind, name, destinations });
    }
    const counter = counterPlaceNameAt(here);
    if (counter) hubs.push({ kind: 'span_counter', name: 'the folding counter', destinations: routesFrom(counter).map(route => route.toPlace) });
    return hubs;
}

export type PublicCounterKind = 'inn' | PublicHubKind;
/** The original inn occupation/catalog eligibility, shared with physical placement. */
export function anInnIsKeptAt(here: string): boolean {
    const kind = REGIONS.flatMap(region => region.places).find(place => place.name.toLowerCase() === here.trim().toLowerCase())?.kind;
    const trade = getOccupation('job-innkeeper');
    return kind !== undefined && trade !== undefined && (trade.settlements as readonly string[]).includes(kind);
}
export function publicCountersAt(world: DockWorld, here: string, today: number): PublicCounterKind[] {
    return [...(anInnIsKeptAt(here) ? ['inn' as const] : []), ...publicTransportHubsAt(world, here, today).map(hub => hub.kind)];
}
