/**
 * Where a cultivator is standing, as a province and a place.
 */

import { HOME_REGION_ID, REGIONS, requireRegion } from '../../data/cultivation/regions.js';
import type { Settlement } from '../../data/cultivation/mortal-world.js';
import type { Cultivator } from '../../schema/cultivation.js';

export interface Standing {
    regionId: string;
    regionName: string;
    /** Null when the place is not one the gazetteer names. */
    settlementKind: Settlement['kind'] | null;
    placeName: string | null;
}

/**
 * Match a free-text location against the gazetteer.
 */
export function standingOf(cultivator: Cultivator): Standing {
    const needle = (cultivator.location ?? '').trim().toLowerCase();
    for (const region of REGIONS) {
        for (const place of region.places) {
            if (place.name.toLowerCase() !== needle) continue;
            const kind = place.kind === 'waystation' || place.kind === 'site'
                ? null
                : (place.kind as Settlement['kind']);
            return {
                regionId: region.id,
                regionName: region.name,
                settlementKind: kind,
                placeName: place.name
            };
        }
    }
    // STANDING ON A PROVINCE ITSELF, which is an ordinary thing to do: the world
    // holds a row for each one and "I travel to The Silent Cliffs" lands the player
    // on it. Without this the loop above found no place, fell through to the home
    // region, and reported somebody standing in the Silent Cliffs as being in the
    // Jade Gorge - so `where can I go` listed the wrong province's towns and could
    // not name the gate of a house they had just been told about, in the province
    // they were actually in.
    const bare = (name: string) => name.replace(/^the\s+/i, '');
    const asProvince = REGIONS.find(region =>
        region.name.toLowerCase() === needle
        || bare(region.name.toLowerCase()) === bare(needle));
    if (asProvince) {
        return {
            regionId: asProvince.id,
            regionName: asProvince.name,
            settlementKind: null,
            placeName: asProvince.name
        };
    }

    const home = requireRegion(HOME_REGION_ID);
    return {
        regionId: home.id,
        regionName: home.name,
        settlementKind: null,
        placeName: null
    };
}
