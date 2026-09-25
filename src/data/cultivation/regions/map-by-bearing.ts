/**
 * Reading the world as five columns instead of one list: what sits at each
 * bearing, which houses are seated there, and where the apexes actually stand.
 *
 * Separate from `the-map.ts` because these answer a different question about
 * the same rows - not "what is this place" but "how is the world arranged" -
 * and the apex arrangement is the one most often assumed wrong.
 */

import type { Bearing, Region, RegionBranch } from './region-schema.js';
import { REGIONS } from './the-map.js';
import { ADJACENT_REGION_ID, HOME_REGION_ID } from './region-ids.js';

// ─────────────────────────────────────────────────────────────────────────
// THE MAP BY BEARING
//
// Reading the world as five columns rather than as one list. The arrangement
// is the answer to a specific complaint - that the lower world
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
//   west      the Buddha Precipice, the driven ground, and the bodies that work
//             it or work its edge
//   north     the White Stair, two courts and nothing else, which is not an
//             oversight - the province is emptying and two is what is left
//   south     the water, and three bodies none of which holds a strait
//
// The apexes are deliberately NOT one per bearing and `apexSeats` says so
// plainly rather than leaving a reader to infer a symmetry that is not there.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where the three apexes actually stand, and the honest statement that they
 * do not divide the compass between them.
 *
 * Two of the three are in the centre and one is in the west, and that is the
 * arrangement rather than an untidiness: the Earth Vein Tower administers the
 * arterial system the eleven Jade Gorge veins branch from, the Pavilion holds
 * the gorge outright, and the Myriad Course Hall holds driven ground of which the
 * Buddha Precipice is one province and not the largest. Nothing seats an apex in the
 * north or the east, and both absences are load-bearing - the Yellow Plain is
 * the province where nobody holds land, and the White Stair is administered
 * from over a pass by a body seated somewhere else.
 *
 * `seatedIn` was null for two of the three while those two were powers with no
 * roll. They are houses now, and a house stands somewhere: all three seats are
 * in a province's seating list. What still separates them is that only one of
 * the three can be NAMED by somebody who has not been told - see
 * `startingAwareness` on each apex row - so "a seat anybody can walk up to" is
 * a claim about awareness rather than about geography, and it is still true of
 * exactly one of them.
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
            apexId: 'apex-earth-vein-tower',
            name: 'The Earth Vein Tower',
            bearing: 'centre',
            seatedIn: HOME_REGION_ID,
            why: 'It holds the four arterial veins the eleven surveyed ones branch from, and the datum every survey in the province is measured against. Its seat is a vault under the centre, and it is in the Jade Gorge seating list because a house with a roll stands somewhere - which does not make it findable, since the province holds from it without being able to say so.'
        },
        {
            apexId: 'apex-azure-cloud',
            name: 'The Azure Cloud Pavilion',
            bearing: 'centre',
            seatedIn: HOME_REGION_ID,
            why: 'The only apex that is also a sect anybody can walk up to, holding the gorge vein at Emerald Water City outright and on no grant from anyone. It is in the Jade Gorge seating list because it is genuinely a house in the province as well as a power above it.'
        },
        {
            apexId: 'apex-myriad-course-hall',
            name: 'The Myriad Course Hall',
            bearing: 'west',
            seatedIn: ADJACENT_REGION_ID,
            why: 'It administers driven ground face by face, across five provinces of which the Buddha Precipice is the nearest and the smallest. It has no client sects, no leases and no vassals, so what is seated in the Buddha Precipice is the Hall itself: a schedule, a roll of everybody working a face, and a seat built around something that cannot be moved.'
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

