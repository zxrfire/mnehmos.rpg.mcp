/**
 * Reading the world as five columns instead of one list: what sits at each
 * bearing, which houses are seated there, and where the apexes actually stand.
 *
 * Separate from `the-map.ts` because these answer a different question about
 * the same rows - not "what is this place" but "how is the world arranged" -
 * and the apex arrangement is the one most often assumed wrong.
 */

import type { Bearing, Region, RegionBranch } from './region-schema.js';
import { REGIONS, getRegionForFaction } from './the-map.js';
import { HOME_REGION_ID } from './region-ids.js';

// ─────────────────────────────────────────────────────────────────────────
// THE MAP BY BEARING
//
// Reading the world as five columns rather than as one list. The arrangement
// these produce is the answer to a specific complaint - that the lower world
// map showed a heap of houses with no compass on it - and the numbers are
// worth having in front of you when you edit a seating list, because the
// shape of the world is legible in them and is not otherwise legible
// anywhere:
//
//   centre    the Jade Gorge, and the majority of the catalog, because every
//             road in the world meets in one gorge and an institution goes
//             where the traffic is
//   east      the Yellow Plain, nine cities, and every body whose business is
//             a counter: the assay, the auction, the register, the reading
//             hall, the cutting house
//   west      the Silent Cliffs, the driven ground, and the bodies that work
//             it or work its edge
//   north     the White Stair, two courts and nothing else, which is not an
//             oversight - the province is emptying and two is what is left
//   south     the water, and three bodies none of which holds a strait
//
// The apexes are deliberately NOT one per bearing and `apexSeats` says so
// plainly rather than leaving a reader to infer a symmetry that is not there.
// ─────────────────────────────────────────────────────────────────────────

export function regionsByBearing(): Record<Bearing, Region[]> {
    const out = {
        centre: [], north: [], east: [], south: [], west: [], interior: []
    } as Record<Bearing, Region[]>;
    for (const r of REGIONS) out[r.bearing].push(r);
    return out;
}

export function regionAtBearing(bearing: Bearing): Region | undefined {
    return REGIONS.find(r => r.bearing === bearing);
}

/** Every seated house, grouped by where on the map it sits. */
export function factionsByBearing(): Record<Bearing, string[]> {
    const out = {
        centre: [], north: [], east: [], south: [], west: [], interior: []
    } as Record<Bearing, string[]>;
    for (const r of REGIONS) out[r.bearing].push(...r.factionIds);
    return out;
}

export function bearingOfFaction(factionId: string): Bearing | undefined {
    return getRegionForFaction(factionId)?.bearing;
}

/**
 * Where the three apexes actually stand, and the honest statement that they
 * do not divide the compass between them.
 *
 * Two of the three are in the centre and one is in the west, and that is the
 * arrangement rather than an untidiness: the Deep Survey administers the
 * arterial system the eleven Jade Gorge veins branch from, the Pavilion holds
 * the gorge outright, and the Long Cut holds driven ground of which the
 * Silent Cliffs is one province and not the largest. Nothing seats an apex in the
 * north or the east, and both absences are load-bearing - the Yellow Plain is
 * the province where nobody holds land, and the White Stair is administered
 * from over a pass by a body seated somewhere else.
 *
 * `seatedIn` is null for a body that holds provinces rather than a seat a
 * province contains, which is two of the three.
 */
export function apexSeats(): {
    apexId: string;
    name: string;
    bearing: Bearing;
    seatedIn: string | null;
    why: string;
}[] {
    return [
        {
            apexId: 'apex-deep-survey',
            name: 'The Deep Survey',
            bearing: 'centre',
            seatedIn: null,
            why: 'It holds the four arterial veins the eleven surveyed ones branch from, and the datum every survey in the province is measured against. Its seat is a vault under the centre and it appears in no province\'s seating list, because a province seats houses and the Survey is what the houses hold from.'
        },
        {
            apexId: 'apex-azure-cloud',
            name: 'The Azure Cloud Pavilion',
            bearing: 'centre',
            seatedIn: HOME_REGION_ID,
            why: 'The only apex that is also a sect anybody can walk up to, holding the gorge vein at Green Water City outright and on no grant from anyone. It is in the Jade Gorge seating list because it is genuinely a house in the province as well as a power above it.'
        },
        {
            apexId: 'apex-long-cut',
            name: 'The Long Cut',
            bearing: 'west',
            seatedIn: null,
            why: 'It administers driven ground face by face, across five provinces of which the Silent Cliffs is the nearest and the smallest. It has no client sects, no leases and no vassals, so there is nothing to seat: what it holds is a schedule, and the schedule is worked from a seat built around something that cannot be moved.'
        }
    ];
}

export function getBranchesOf(factionId: string): { region: Region; branch: RegionBranch }[] {
    const out: { region: Region; branch: RegionBranch }[] = [];
    for (const region of REGIONS) {
        for (const branch of region.branches) {
            if (branch.parentSectId === factionId) out.push({ region, branch });
        }
    }
    return out;
}

/**
 * The provinces' contrast, as a table a tool can render directly.
 *
 * One row per aspect, one column per region, in catalog order. It was two
 * columns while there were two provinces; the shape had to change because a
 * `home`/`adjacent` pair silently stops being the world the moment there is a
 * third province, and a table that quietly omits three fifths of the map is
 * worse than no table.
 */
export function regionContrast(): {
    aspect: string;
    byRegion: Record<string, string | number>;
}[] {
    const row = (
        aspect: string,
        pick: (r: Region) => string | number
    ): { aspect: string; byRegion: Record<string, string | number> } => ({
        aspect,
        byRegion: Object.fromEntries(REGIONS.map(r => [r.id, pick(r)]))
    });
    return [
        row('factions seated', r => r.factionIds.length),
        row('tradition', r => r.traditionId),
        row('politics', r => r.politics),
        row('local ceiling (ordinal)', r => r.localCeilingOrdinal),
        row('ambient rate multiplier', r => r.cultivation.ambientRateMultiplier),
        row('disciplines that do not work', r => r.cultivation.missingDisciplines.length),
        row('price multiplier', r => r.priceMultiplier),
        row('places written', r => r.places.length),
        row('reachable provinces', r => new Set(r.connections.map(c => c.otherRegionId)).size)
    ];
}
