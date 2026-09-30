/**
 * Reading the world as five columns instead of one list: what sits at each
 * bearing, which houses are seated there, and where the apexes actually stand.
 *
 * Separate from `the-map.ts` because these answer a different question about
 * the same rows - not "what is this place" but "how is the world arranged" -
 * and the apex arrangement is the one most often assumed wrong.
 */

import type { Region, RegionBranch } from './region-schema.js';
import { REGIONS } from './the-map.js';

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
// The apexes are deliberately NOT one per bearing; the region seating lists say so
// plainly rather than leaving a reader to infer a symmetry that is not there.
// ─────────────────────────────────────────────────────────────────────────

export function getBranchesOf(factionId: string): { region: Region; branch: RegionBranch }[] {
    const out: { region: Region; branch: RegionBranch }[] = [];
    for (const region of REGIONS) {
        for (const branch of region.branches) {
            if (branch.parentSectId === factionId) out.push({ region, branch });
        }
    }
    return out;
}

