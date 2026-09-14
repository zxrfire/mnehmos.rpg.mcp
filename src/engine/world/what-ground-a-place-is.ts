/**
 * What is underfoot where somebody is standing.
 *
 * ── THE MEASUREMENT ──────────────────────────────────────────────────────
 *
 * `beastsOnThisGround` has always taken a biome and **no caller ever passed
 * one**. `beastGroundFor` in the turn engine built its `GroundForBeasts` out of
 * `sealed` and `onAVein` and left the third field off, so every square in the
 * world drew from the whole catalog filtered only by whether a thing survives
 * in the open. The consequence is the one you can feel while playing: the
 * glacier province and the grain province put up the same animals.
 *
 * Nothing on a location row could have answered it. `climate` is the string
 * 'temperate' on every row the seeder writes - it is a constant in
 * `seeding.ts`, not a reading - and a hazard is a sentence of prose. So the
 * ground is authored, on the province, in `region-schema.ts`.
 *
 * ── A LIST, BECAUSE THE CATALOGS ARE SMALL ───────────────────────────────
 *
 * 64 beasts across 18 of the 19 biomes, grown from 19 across 12 once this read
 * existed and the pools could be measured. Narrowing a province to one biome
 * would still leave every square in it thin, and would do that permanently -
 * which is a worse world than the undifferentiated one, not a better one. A
 * province is several kinds of ground; the author says which; and the draw is
 * the union.
 *
 * ── THE SPECIFIC BEATS THE GENERAL, AND THE KIND IS THE MOST SPECIFIC ────
 *
 * A cave is a cave whatever province it is in. So a location whose KIND already
 * names a ground answers with that and stops, a place may state its own, and
 * only then does the province speak. That order is the whole of the resolution
 * and it is stated once, here.
 */

import type { HerbBiome } from '../../data/cultivation/herbs.js';
import { getRegion, groundsDeclaredAt } from '../../data/cultivation/regions/the-map.js';
import { isOpenOn, type LocationKind, type LocationRecord } from './locations.js';
import { getLocation, type WorldState } from './world-state.js';

/**
 * The kinds that ARE a ground, wherever they sit.
 *
 * Deliberately short. A kind earns a row here only where the word names the
 * ground itself rather than what somebody built on it: a settlement is a
 * settlement on whatever the province is made of, and a sect seat is a
 * compound, which is not a biome.
 */
const GROUND_A_KIND_IS: Partial<Record<LocationKind, readonly HerbBiome[]>> = Object.freeze({
    cave: ['cave'],
    vein: ['spirit_vein'],
    ruin: ['ruins'],
    grave: ['ruins'],
    scar: ['battlefield'],
    // Ground that stopped being ordinary. Both are sealed or shut by somebody
    // much stronger than whoever is looking at them now, which is what the
    // abyss rows in both catalogs are for.
    forbidden_zone: ['abyss'],
    sealed_domain: ['abyss']
});

/**
 * Density at which the ground under a place is a vein whatever else it says.
 *
 * Geology, not usability: `qiDensity` is what the vein under this place holds
 * and `environment.spiritualDensity` is what anybody can draw, which is why a
 * sealed pocket nobody can use is exactly the ground something has been growing
 * on undisturbed.
 */
const VEIN_DENSITY = 60;

/** How far up a parent chain to look before giving up. Guards a cycle, not depth. */
const WALLS_WALKED_AT_MOST = 8;

/**
 * What is underfoot here, or null where nothing says.
 *
 * Null is the honest answer for a world row the catalog has never heard of and
 * it means the whole map, which is what every caller got before this existed.
 * It is not the same as an empty list, which no path returns.
 */
export function whatGroundThisIs(
    world: WorldState,
    place: LocationRecord | null
): readonly HerbBiome[] | null {
    if (!place) return null;

    // `getLocation` and not a Map built here: the world already keeps a memo of
    // id to position beside the rows, and a fresh map per call would walk 1,159
    // locations on every hunt to answer one question about one square.
    let here: LocationRecord | null = place;
    for (let walked = 0; here && walked < WALLS_WALKED_AT_MOST; walked++) {
        const kind = GROUND_A_KIND_IS[here.kind];
        if (kind) return kind;

        const declared = groundsDeclaredAt(here.name);
        if (declared) return declared;

        const region = getRegion(String(here.data.catalogRegionId ?? ''));
        if (region) return region.grounds;

        here = here.parentId ? getLocation(world, here.parentId) : null;
    }
    return null;
}

/**
 * Whether this place sits on a vein, which decides what `vein_only` can live here.
 *
 * TWO SOURCES AND THE AUTHORED ONE WINS. The density and the resource list are
 * a proxy - good ones, and they are what every caller had - but a province file
 * can say outright that a square is a vein head, and a statement beats a proxy.
 * Dragonvein Rock is the measurement: it declares `spirit_vein`, its seeded row
 * reports a density of 17, and every vein species is `vein_only`, so the one
 * square in its province named for a vein was the only square in the world with
 * nothing living on it at all.
 *
 * Here rather than in the turn engine because the test that guards it would
 * otherwise have to restate the rule, and a rule stated twice is the thing this
 * file exists to stop.
 */
export function isOnAVein(
    world: WorldState,
    place: LocationRecord | null,
    grounds: readonly HerbBiome[] | null = whatGroundThisIs(world, place)
): boolean {
    if (!place) return false;
    return place.qiDensity >= VEIN_DENSITY
        || place.environment.resources.includes('qi')
        || (grounds?.includes('spirit_vein') ?? false);
}

/**
 * Whether this place is closed ground TODAY, which decides what `sealed_only`
 * can be standing in it.
 *
 * `place.sealed` is the world's RECORD that a door moved and is refreshed at a
 * year boundary, so on a place with a season it can be a year out of date -
 * and the schedule is the authority (`isOpenOn` ignores the column wherever a
 * cycle exists). Two callers were reading the column straight and drawing a
 * beast pool off a door that had shut or opened months ago.
 *
 * `onDay` omitted falls back to the column, which is the honest answer for a
 * caller that genuinely has no day: it is what they had before, and a place
 * with no cycle has no other answer anyway.
 */
export function isSealedOn(place: LocationRecord, onDay?: number | null): boolean {
    if (onDay === undefined || onDay === null) return place.sealed;
    return !isOpenOn(place, Math.floor(onDay));
}
