/**
 * Where a cultivator is standing, as a province and a place.
 *
 * ── Why this is its own file ─────────────────────────────────────────────
 *
 * It lived in `cultivation-mortal.ts` and it is used by anything that has to
 * price something: `localPrice` needs a region id, and a region id is what this
 * answers. That made it the one thing in that module a handler on the other
 * side of the tool set wants, and importing the whole of `cultivation-mortal`
 * to get it walks into a live module cycle.
 *
 * The cycle is real and pre-existing: `cultivation-mortal.ts` imports
 * `RATION_COST_STONES` from `cultivation-manage.ts`, and `cultivation-manage.ts`
 * imports `WorkSchema` from `cultivation-mortal.ts` and reads it at module
 * scope. Whether that resolves depends entirely on which of the two is entered
 * first, and today it survives only because `game.ts` happens to import
 * `cultivation-manage` before anything reaches `cultivation-mortal`. Adding one
 * ordinary import to `alchemy-manage.ts` flipped that order and took the whole
 * server out at boot with `Cannot access 'WorkSchema' before initialization` -
 * a failure with no test in front of it, because tests import modules in a
 * different order than the server does.
 *
 * So this function moves to a leaf that imports nothing but the gazetteer, and
 * `cultivation-mortal.ts` re-exports it so every existing caller is untouched.
 * That is `AGENTS.md`'s rule for renaming in a busy tree, applied to a move: the
 * module goes, the old path keeps exporting it, and nobody's import line has to
 * be edited inside somebody else's live work.
 *
 * The underlying cycle is NOT fixed here and is worth fixing: the honest repair
 * is `RATION_COST_STONES` living somewhere both files can read, which means
 * editing `cultivation-support.ts`, which another session is holding.
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
 *
 * The cultivator's `location` is a string by design - the engine holds no map -
 * so this is a name match and nothing cleverer. An unrecognised place is not an
 * error: it is a road, a cave or a hillside, and the honest answer is that
 * there is no market there.
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
    // STANDING ON A PROVINCE ITSELF, which is an ordinary thing to do: the
    // world holds a row for each one and "I travel to The Quiet Marches" lands
    // the player on it. Without this the loop above found no place, fell
    // through to the home region, and reported somebody standing in the Quiet
    // Marches as being in the Low Fall - so `where can I go` listed the wrong
    // province's towns and could not name the gate of a house they had just
    // been told about, in the province they were actually in.
    //
    // Checked AFTER places, so a town that shares its province's name still
    // wins: a town is somewhere you can walk to and a province is not.
    //
    // Article-insensitive, because the parser strips a leading "the" off the
    // destination and every province in the world is named "The" something.
    // Matching elsewhere already works this way - see `loosePlaceKey` - and a
    // run without the world layer loaded has no world row to canonicalise
    // against, so this branch is the only thing standing between "I travel to
    // The Quiet Marches" and a cultivator reported as being somewhere else.
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
