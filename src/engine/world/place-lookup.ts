/** One name comparison and world-row lookup, shared by mechanics and the front door. */
import { placeScopeFor, type LocationRecord, type PlaceScope } from './locations.js';

/** Stable id for a place, which has no row of its own to point at. */
export function placeKey(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed';
}

/**
 * `placeKey` with a leading article dropped. FOR COMPARISON ONLY - never for a
 * stored key, or every knowledge record ever written stops resolving.
 */
export function loosePlaceKey(name: string): string {
    // `^the-` rather than `^the`, so "Theodore's Rest" is not quietly renamed.
    return placeKey(name).replace(/^the-/, '') || 'unnamed';
}


/**
 * The world location a free-text place name refers to.
 */
export function worldLocationFor(world: { locations: readonly LocationRecord[] }, place: string | null, scope?:PlaceScope): LocationRecord | null {
    const wanted = (place ?? '').trim().toLowerCase();
    if (wanted.length === 0) return null;

    const index = placeIndexFor(world.locations,scope);
    const exact = index.byName.get(wanted);
    if (exact !== undefined) return world.locations[exact]!;

    // "the Jade Gorge" against "Emerald Water City", and the id form for anything
    // that reached us already keyed. The earliest place satisfying any of these wins.
    const key = placeKey(wanted);
    const loose = loosePlaceKey(wanted);
    const candidates = [index.byKey.get(key), index.byLoose.get(loose), index.byId.get(wanted),
        index.byIdSuffix.get(key), index.byIdSuffix.get(loose)].filter((at): at is number => at !== undefined);
    return candidates.length > 0 ? world.locations[Math.min(...candidates)]! : null;
}

interface PlaceIndex {
    built: number;
    byName: Map<string, number>; byKey: Map<string, number>; byLoose: Map<string, number>;
    byId: Map<string, number>; byIdSuffix: Map<string, number>;
}

/** The lookup tables for one unchanged place list, each holding the first index that answers. */
const PLACE_INDEXES = new WeakMap<object, PlaceIndex>();
function placeIndexFor(locations: readonly LocationRecord[],routes=placeScopeFor(locations)): PlaceIndex {
    let index = PLACE_INDEXES.get(routes);
    if (index?.built===locations.length) return index;
    index ??= { built:0,byName: new Map(), byKey: new Map(), byLoose: new Map(), byId: new Map(), byIdSuffix: new Map() };
    const first = (map: Map<string, number>, k: string, i: number) => { if (!map.has(k)) map.set(k, i); };
    for(let i=index.built;i<locations.length;i++){
        const l=locations[i]!;
        first(index!.byName, l.name.trim().toLowerCase(), i);
        first(index!.byKey, placeKey(l.name), i);
        first(index!.byLoose, loosePlaceKey(l.name), i);
        first(index!.byId, l.id, i);
        // `l.id.endsWith('-' + k)`: every suffix that follows a dash.
        for (let at = l.id.indexOf('-'); at >= 0; at = l.id.indexOf('-', at + 1)) first(index!.byIdSuffix, l.id.slice(at + 1), i);
    }
    index.built=locations.length;
    PLACE_INDEXES.set(routes, index);
    return index;
}
