/**
 * Where a ship puts in: every lane's landfalls, and every place on open water, each at its own dock.
 *
 * The owner: "all island places have a dock". So nothing on open water is walked to, and nothing
 * is hand-listed: a dock is every place the world stands directly on a province that is open water
 * (`openWater` in the catalog), a house's grounds and a ruin as much as a port town, and without a
 * world the catalog's own places there. A room inside a house's walls is reached through the dock
 * of the ground it stands in.
 *
 * How far apart two docks are is the catalog's chain of passages between them (`placeRoadDays`).
 * A dock only the world knows (a house's grounds, a ruin, the vein) has no passages of its own,
 * so it is a day out from the catalog port nearest it ({@link thePortADockIsNear}) and takes that
 * port's days plus the one. Two catalog places no chain joins are the flat unpriced day apart.
 */

import { REGIONS, isOpenWater, placeRoadDays, regionIdOfPlace, requireRegion } from '../data/cultivation/regions.js';
import { forStream } from '../engine/cultivation/rng.js';
import { SEA_LANES } from '../data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { regionCatalogIdOf } from '../engine/world/how-a-cultivator-comes-by-a-road.js';
import type { LocationRecord } from '../engine/world/locations.js';
import { worldLocationFor } from './entities.js';
import { loosePlaceKey } from './knowledge.js';
import { SHORT_ACTION_DAYS } from './turn-constants.js';
import type { GameService } from './turn-engine.js';

type World = GameService['atHand'];

/** The catalog place a lane's landfall names, where it names one. */
export function theLandfall(named: string): string | null {
    const wanted = named.trim().toLowerCase();
    let best: string | null = null;
    for (const region of REGIONS) {
        for (const place of region.places) {
            const name = place.name.toLowerCase();
            if (name === wanted) return place.name;
            if (wanted.includes(name) && (best === null || name.length > best.length)) best = place.name;
        }
    }
    return best;
}

/** The province a place is in, by the catalog or the world's row. */
export function theProvinceOf(world: World, place: string): string | null {
    const named = regionIdOfPlace(place);
    if (named) return named;
    const row = world ? worldLocationFor(world, place) : null;
    return row && world ? regionCatalogIdOf(world, row.id) : null;
}

function isOpenWaterProvinceRow(row: LocationRecord | undefined): boolean {
    const id = (row?.data as { catalogRegionId?: unknown } | undefined)?.catalogRegionId;
    return row?.kind === 'region' && typeof id === 'string' && isOpenWater(id);
}

/** Every place standing directly on open water, each of which has a dock. */
function theDocksOnOpenWater(world: World): string[] {
    const docks = REGIONS.filter(region => isOpenWater(region.id)).flatMap(region => region.places.map(place => place.name));
    if (!world) return docks;
    const byId = new Map(world.locations.map(row => [row.id, row]));
    for (const row of world.locations) {
        if (row.parentId && isOpenWaterProvinceRow(byId.get(row.parentId)) && !docks.includes(row.name)) docks.push(row.name);
    }
    return docks;
}

/** Every place a ship puts in at. */
export function thePortsShipsPutInAt(world: World): string[] {
    const ports = new Set<string>();
    for (const lane of SEA_LANES) {
        for (const end of [theLandfall(lane.fromPlace), theLandfall(lane.toPlace)]) if (end) ports.add(end);
    }
    for (const dock of theDocksOnOpenWater(world)) ports.add(dock);
    return [...ports];
}

/**
 * The dock a place is reached by: itself where it has one, and for a room behind a house's walls
 * on open water, the dock of the ground the house stands on. Null where no ship puts in.
 */
export function theDockOf(world: World, place: string): string | null {
    const ports = thePortsShipsPutInAt(world);
    const own = ports.find(port => loosePlaceKey(port) === loosePlaceKey(place));
    if (own) return own;
    if (!world) return null;
    const byId = new Map(world.locations.map(row => [row.id, row]));
    let row = worldLocationFor(world, place) ?? undefined;
    for (let hops = 0; row && hops < 12; hops++) {
        const parent = row.parentId ? byId.get(row.parentId) : undefined;
        if (isOpenWaterProvinceRow(parent)) return ports.find(port => loosePlaceKey(port) === loosePlaceKey(row!.name)) ?? null;
        row = parent;
    }
    return null;
}

/**
 * The catalog port a dock only the world knows lies near: the port its house holds, for a house's
 * grounds; otherwise the one of its province's ports its own draw points at, since the world keeps
 * no distance for it. A catalog place is its own.
 */
export function thePortADockIsNear(world: World, dock: string): string {
    const province = regionIdOfPlace(dock);
    if (province) return requireRegion(province).places.find(place => loosePlaceKey(place.name) === loosePlaceKey(dock))!.name;
    const row = world ? worldLocationFor(world, dock) : null;
    const regionId = row && world ? regionCatalogIdOf(world, row.id) : null;
    const ports = regionId ? requireRegion(regionId).places.filter(place => place.kind !== 'site') : [];
    if (!row || ports.length === 0) return dock;
    const house = row.controllingFactionId ?? (row.data as { factionId?: unknown }).factionId;
    const held = typeof house === 'string' ? ports.find(place => place.heldByFactionId === house) : undefined;
    if (held) return held.name;
    return ports[Math.floor(forStream(world!.seed, 'the-port-a-dock-is-near', row.id).next() * ports.length)]!.name;
}

/** Days of sailing between two docks of one open-water province. */
export function daysOfSailingBetween(world: World, from: string, to: string): number {
    const [a, b] = [thePortADockIsNear(world, from), thePortADockIsNear(world, to)];
    const out = (a === from ? 0 : 1) + (b === to ? 0 : 1);
    return (a === b ? 0 : placeRoadDays(a, b) ?? SHORT_ACTION_DAYS) + out;
}
