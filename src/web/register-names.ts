/**
 * One answer to "what is this id called", for every register module.
 *
 * WHY IT IS A MODULE AND NOT A LINE IN EACH FILE. Five register modules each
 * grew the same four-catalog lookup, and a fifth catalog is exactly what they
 * all missed: a DESTROYED dao house is not in `SECTS`, so `house-iron-tally-court`,
 * `house-nine-stone-array` and `house-nine-nether` rendered as raw ids in the
 * middle of three sentences on the published page. Measured on the built sheet:
 * three leaks, all of them houses somebody ended, all of them named in the
 * catalog that records the ending.
 *
 * THE LAST RESORT IS THE ID, DELIBERATELY. An id on the page is ugly and it is
 * a fault in the catalogs rather than in the sheet, so it is left visible: a
 * placeholder like "a house nobody recorded" would hide a dangling reference
 * behind a sentence that reads as content.
 */

import { DESTROYED_DAO_HOUSES, getSect } from '../data/cultivation/sects.js';
import { getApexInstitution, getCourt } from '../data/cultivation/hierarchy.js';
import { REGIONS } from '../data/cultivation/regions.js';

export function factionName(id: string): string {
    return getSect(id)?.name
        ?? getApexInstitution(id)?.name
        ?? getCourt(id)?.name
        ?? REGIONS.find(region => region.id === id)?.name
        ?? DESTROYED_DAO_HOUSES.find(house => house.id === id)?.name
        ?? id;
}
