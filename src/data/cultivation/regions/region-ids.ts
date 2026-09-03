/**
 * The stable ids of every province and of the ground between them.
 *
 * Their own file because both the region rows and the political layer need
 * them, and a province file that imported its id from the assembled map would
 * make the map depend on the rows and the rows on the map. These are the one
 * thing everything can depend on.
 *
 * A rename changes what a place is CALLED, in `place-names.ts`. It does not
 * change these: an id is written into saved worlds and is not a display name.
 */

export const HOME_REGION_ID = 'region-low-fall';
/**
 * The Quiet Marches, and the name is historical: it was the only adjacent
 * region when there were two. It is now the western one of four, and the id is
 * left alone because a great deal of content outside this file names it.
 */
export const ADJACENT_REGION_ID = 'region-quiet-marches';
export const EAST_REGION_ID = 'region-wide-field';
export const NORTH_REGION_ID = 'region-white-stair';
export const SOUTH_REGION_ID = 'region-drowned-reach';

export const BLOWN_GROUND_ID = 'ungoverned-blown-ground';

/** The political layer's ids for the two provinces the map also has a row for. */
export const LOW_FALL_PROVINCE_ID = 'province-low-fall';
export const QUIET_MARCHES_PROVINCE_ID = 'province-quiet-marches';
