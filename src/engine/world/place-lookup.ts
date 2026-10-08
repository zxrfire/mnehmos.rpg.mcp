/** One name comparison and world-row lookup, shared by mechanics and the front door. */
import type { LocationRecord } from './locations.js';

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
export function worldLocationFor(world: { locations: readonly LocationRecord[] }, place: string | null): LocationRecord | null {
    const wanted = (place ?? '').trim().toLowerCase();
    if (wanted.length === 0) return null;

    const exact = world.locations.find(l => l.name.trim().toLowerCase() === wanted);
    if (exact) return exact;

    // "the Jade Gorge" against "Emerald Water City", and the id form for anything
    // that reached us already keyed.
    const key = placeKey(wanted);
    const loose = loosePlaceKey(wanted);
    return world.locations.find(l =>
        placeKey(l.name) === key
        || loosePlaceKey(l.name) === loose
        || l.id === wanted
        || l.id.endsWith(`-${key}`)
        || l.id.endsWith(`-${loose}`)) ?? null;
}

