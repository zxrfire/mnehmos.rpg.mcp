/**
 * Regions - five of them, and the contrast between them is the content.
 */

import type { AmbientQi } from '../../../schema/cultivation.js';
import type { HerbBiome } from '../herbs.js';
import type {
    Region,
    RegionPlaceConnection
} from './region-schema.js';
import { BLOWN_GROUND_ID } from './region-ids.js';
import { THE_LOW_FALL } from './low-fall.js';
import { THE_QUIET_MARCHES } from './quiet-marches.js';
import { THE_WIDE_FIELD } from './wide-field.js';
import { THE_WHITE_STAIR } from './white-stair.js';
import { THE_DROWNED_REACH } from './drowned-reach.js';
import { THE_BLOWN_GROUND_AS_REGION } from './the-blown-ground.js';
import type { RegionConnection } from './region-schema.js';


/**
 * THE SPINE AS AUTHORED. Five provinces, and every province invariant is about
 * these.
 */
const THE_FIVE_PROVINCES: readonly Region[] = [
    THE_LOW_FALL,
    THE_QUIET_MARCHES,
    THE_WIDE_FIELD,
    THE_WHITE_STAIR,
    THE_DROWNED_REACH
];

// ─────────────────────────────────────────────────────────────────────────
// INDICES + LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

/**
 * BUILT ON FIRST USE, NOT AT THIS LINE, AND THE REASON IS ORDERING.
 */
interface RegionIndices {
    byId: ReadonlyMap<string, Region>;
    byFaction: ReadonlyMap<string, string>;
    ambientByPlaceName: ReadonlyMap<string, AmbientQi>;
    regionIdByPlaceName: ReadonlyMap<string, string>;
    /** Only the places that state their own. A province's list is on the region. */
    groundsByPlaceName: ReadonlyMap<string, readonly HerbBiome[]>;
    /**
     * Every place road, filed under BOTH of its ends off one declared row.
     */
    placeRoadsFrom: ReadonlyMap<string, ReadonlyMap<string, RegionPlaceConnection>>;
}

let INDICES: RegionIndices | null = null;

function indices(): RegionIndices {
    if (INDICES) return INDICES;
    const byId = new Map<string, Region>();
    const byFaction = new Map<string, string>();
    const ambientByPlaceName = new Map<string, AmbientQi>();
    const regionIdByPlaceName = new Map<string, string>();
    const groundsByPlaceName = new Map<string, readonly HerbBiome[]>();
    const placeRoadsFrom = new Map<string, Map<string, RegionPlaceConnection>>();
    const fileRoad = (from: string, road: RegionPlaceConnection): void => {
        const key = from.trim().toLowerCase();
        let out = placeRoadsFrom.get(key);
        if (!out) placeRoadsFrom.set(key, out = new Map());
        const to = road.otherPlaceName.trim().toLowerCase();
        // A shorter row wins where a province states two ways between one
        // pair, which is the rule `daysOnTheRoadTo` already applies to
        // province roads: a road is as long as the shortest road there is.
        const seen = out.get(to);
        if (!seen || road.travelDays < seen.travelDays) out.set(to, road);
    };
    for (const region of REGIONS) {
        byId.set(region.id, region);
        for (const factionId of region.factionIds) byFaction.set(factionId, region.id);
        for (const place of region.places) {
            ambientByPlaceName.set(place.name.toLowerCase(), place.ambient);
            regionIdByPlaceName.set(place.name.toLowerCase(), region.id);
            if (place.grounds) groundsByPlaceName.set(place.name.toLowerCase(), place.grounds);
            for (const road of place.connections ?? []) {
                // The declared direction, and the mirror of it.
                fileRoad(place.name, road);
                fileRoad(road.otherPlaceName, { ...road, otherPlaceName: place.name });
            }
        }
    }
    // A PROVINCE IS SOMEWHERE YOU CAN STAND, so its own name has to answer too.
    for (const region of REGIONS) {
        const key = region.name.toLowerCase();
        if (!regionIdByPlaceName.has(key)) regionIdByPlaceName.set(key, region.id);
    }
    INDICES = {
        byId, byFaction, ambientByPlaceName, regionIdByPlaceName, groundsByPlaceName, placeRoadsFrom
    };
    return INDICES;
}

/**
 * The road between two named places of one province, or undefined.
 */
export function placeRoadBetween(
    fromPlaceName: string | null | undefined,
    toPlaceName: string | null | undefined
): RegionPlaceConnection | undefined {
    if (!fromPlaceName || !toPlaceName) return undefined;
    return indices().placeRoadsFrom
        .get(fromPlaceName.trim().toLowerCase())
        ?.get(toPlaceName.trim().toLowerCase());
}

/**
 * What getting there costs on foot, in walking days, or null where no chain of
 * stated roads joins the two.
 *
 * ── WHY THIS IS A ROUTE AND NOT A LOOKUP ─────────────────────────────────
 *
 * It was `placeRoadBetween(...)?.travelDays`, and a pair with no row of its own
 * fell through `daysOnTheRoadTo` to the flat day every unpriced journey costs.
 * That was right while the catalog stated two roads in the whole world. Once
 * the provinces were roaded it became a contradiction the player can see: the
 * head of the White Stair pass is two days from the terraces and three more
 * from the last inhabited band, and asking for the town above that band - which
 * is further than either - came back as one day, because no row named that pair.
 * So the long way cost five days and the direct way cost one.
 *
 * Summing stated legs is not the fabrication the flat-day rule guards against.
 * The fabrication is the engine picking a number, and every number here was
 * authored; the province files already reason this way out loud, where the
 * Drowned Reach checks its own legs against the three weeks its gate station
 * claims. A pair with no chain between them still returns null, which is what
 * keeps `daysOnTheRoadTo` falling through to the province scale.
 *
 * Dijkstra rather than a hop count, because the legs are unequal - one day
 * across an anchorage and eleven across the northern crossing - and because a
 * cheap road through a third place is a real answer and not a shortcut.
 */
export function placeRoadDays(
    fromPlaceName: string | null | undefined,
    toPlaceName: string | null | undefined
): number | null {
    if (!fromPlaceName || !toPlaceName) return null;
    const from = fromPlaceName.trim().toLowerCase();
    const to = toPlaceName.trim().toLowerCase();
    if (from === to) return null;

    const roads = indices().placeRoadsFrom;
    if (!roads.has(from) || !roads.has(to)) return null;

    const best = new Map<string, number>([[from, 0]]);
    const settled = new Set<string>();
    for (;;) {
        let at: string | null = null;
        let cost = Infinity;
        for (const [place, days] of best) {
            if (!settled.has(place) && days < cost) { at = place; cost = days; }
        }
        if (at === null) return null;
        if (at === to) return cost;
        settled.add(at);
        for (const [next, road] of roads.get(at) ?? []) {
            const through = cost + road.travelDays;
            if (through < (best.get(next) ?? Infinity)) best.set(next, through);
        }
    }
}

/**
 * Everywhere the catalog says is next to this place, in walking days.
 */
export function placesNextTo(
    placeName: string | null | undefined
): Array<{ name: string; travelDays: number; kind: RegionPlaceConnection['kind']; description: string }> {
    if (!placeName) return [];
    const roads = indices().placeRoadsFrom.get(placeName.trim().toLowerCase());
    if (!roads) return [];
    return [...roads.values()]
        .map(road => ({
            name: road.otherPlaceName,
            travelDays: road.travelDays,
            kind: road.kind,
            description: road.description
        }))
        .sort((a, b) => a.travelDays - b.travelDays || a.name.localeCompare(b.name));
}

/**
 * The band a named settlement's ground ordinarily gives.
 */
export function regionIdOfPlace(placeName: string | null | undefined): string | undefined {
    if (!placeName) return undefined;
    return indices().regionIdByPlaceName.get(placeName.trim().toLowerCase());
}

/**
 * What a named place says is underfoot, where it says anything.
 *
 * Undefined means the place is made of its province, which is the ordinary
 * case and is not the same answer as an empty list.
 */
export function groundsDeclaredAt(
    placeName: string | null | undefined
): readonly HerbBiome[] | undefined {
    if (!placeName) return undefined;
    return indices().groundsByPlaceName.get(placeName.trim().toLowerCase());
}

export function declaredAmbientAt(placeName: string | null | undefined): AmbientQi | undefined {
    if (!placeName) return undefined;
    return indices().ambientByPlaceName.get(placeName.trim().toLowerCase());
}

export function getRegion(id: string): Region | undefined {
    return indices().byId.get(id);
}

export function requireRegion(id: string): Region {
    const r = indices().byId.get(id);
    if (!r) throw new Error(`Unknown region: ${id}`);
    return r;
}

export function getRegionForFaction(factionId: string): Region | undefined {
    const id = indices().byFaction.get(factionId);
    return id ? indices().byId.get(id) : undefined;
}

/**
 * Whether a cultivator at this ordinal has anything left to gain from the
 * local ground unaided. False means the region is done with them: buy access,
 * buy stones, or leave.
 */
export function canAdvanceHere(regionId: string, ordinal: number): boolean {
    return ordinal < requireRegion(regionId).localCeilingOrdinal;
}

/** Price of a listed good in this region, before haggling. */
export function localPrice(regionId: string, basePrice: number): number {
    return Math.round(basePrice * requireRegion(regionId).priceMultiplier);
}

/** Whether a discipline works at all in this region. */
export function disciplineWorksIn(regionId: string, discipline: string): boolean {
    return !requireRegion(regionId).cultivation.missingDisciplines
        .some(m => m.discipline.toLowerCase() === discipline.trim().toLowerCase());
}

/** Ambient states present in a region at all, commonest first. */
export function ambientStatesIn(regionId: string): AmbientQi[] {
    const profile = requireRegion(regionId).ambientProfile;
    return (Object.entries(profile) as [AmbientQi, number][])
        .filter(([, share]) => share > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([state]) => state);
}

// THE MAP

/**
 * Every row the map has, spine and wedge, with the roads joined up.
 */
export const REGIONS: readonly Region[] = (() => {
    const back = new Map<string, RegionConnection>();
    for (const link of THE_BLOWN_GROUND_AS_REGION.connections) {
        back.set(link.otherRegionId, {
            kind: link.kind,
            otherRegionId: THE_BLOWN_GROUND_AS_REGION.id,
            description: link.description,
            travelDays: link.travelDays
        });
    }
    const spine = THE_FIVE_PROVINCES.map(province => {
        const edge = back.get(province.id);
        return edge
            ? { ...province, connections: [...province.connections, edge] }
            : province;
    });
    return [...spine, THE_BLOWN_GROUND_AS_REGION];
})();

/**
 * The five arms, and the subject of every province invariant in the catalog tests:
 * two seated houses, a tradition, a road to the centre, a ceiling nobody else
 * shares.
 */
export const SPINE_REGIONS: readonly Region[] = REGIONS.filter(r => r.id !== BLOWN_GROUND_ID);
