/**
 * Where a cultivator is standing, as a province and a place.
 */

import { HOME_REGION_ID, REGIONS, requireRegion } from '../../data/cultivation/regions.js';
import type { Settlement } from '../../data/cultivation/mortal-world.js';
import type { Cultivator } from '../../schema/cultivation.js';
import { getSect } from '../../data/cultivation/sects.js';
import type { WorldState } from '../../engine/world/world-state.js';
import { theProvinceAround } from '../../engine/world/ground-holder.js';

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
export function standingOf(cultivator: Cultivator, world: WorldState | null = null): Standing {
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
    const here = world?.locations.find(place => place.name.toLowerCase() === needle);
    const provinceId = here && theProvinceAround(world!.locations, here.id);
    const province = provinceId && world?.locations.find(place => place.id === provinceId);
    const catalog = province && REGIONS.find(region => region.id === province.data.catalogRegionId);
    if (here && catalog) return {
        regionId: catalog.id, regionName: catalog.name,
        settlementKind: here.tags.includes('gate_town') ? 'sect_town' : null,
        placeName: here.kind === 'sect_seat' ? null : here.name
    };

    // STANDING ON A PROVINCE ITSELF, which is an ordinary thing to do: the world
    // holds a row for each one and "I travel to The Buddha Precipice" lands the player
    // on it. Without this the loop above found no place, fell through to the home
    // region, and reported somebody standing in the Buddha Precipice as being in the
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

    // A HOUSE'S GROUNDS, which the world names `<house> grounds` and the
    // gazetteer does not name at all. They fell through to the home province,
    // so somebody at a house's gate was priced, listed and supplied as if they
    // stood at home. Played: Moraine Gate to the Tranquil Oasis grounds was a day,
    // and the same road back seventeen, from the wrong province.
    const housesProvince = REGIONS.find(region => region.factionIds.some(id => {
        const house = getSect(id)?.name.toLowerCase();
        return house !== undefined && (needle === house || needle === `${house} grounds` || needle === `${house} town`);
    }));
    if (housesProvince) {
        return {
            regionId: housesProvince.id,
            regionName: housesProvince.name,
            settlementKind: needle.endsWith(' town') ? 'sect_town' : null,
            placeName: needle.endsWith(' town') ? cultivator.location : null
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
