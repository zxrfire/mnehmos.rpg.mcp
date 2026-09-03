/**
 * The map, as a barrel. Every export this file used to hold is still exported
 * from here and nothing that imported it has changed.
 *
 * It was one 3,694-line file holding six kinds of thing, and three separate
 * pieces of work needed it at once. The structure now mirrors the world, so
 * two people working on two different parts of it are working on two different
 * files. Where each subject went:
 *
 *   regions/region-schema.ts        the `Region` contract, and nothing else
 *   regions/region-ids.ts           the stable ids of every province and the wedge
 *   regions/local-rank-names.ts     the helper that relabels the one ladder
 *   regions/rank-translation.ts     who disputes a title, and what it costs
 *   regions/ruin-and-scar-names.ts  names for the half of the map worldgen makes
 *
 *   regions/low-fall.ts             the centre, its vocabulary, its nine catchments
 *   regions/quiet-marches.ts        the west, its vocabulary, its six face districts
 *   regions/wide-field.ts           the east
 *   regions/white-stair.ts          the north
 *   regions/drowned-reach.ts        the south, which is water
 *   regions/the-blown-ground.ts     the wedge nobody holds, and its projection
 *
 *   regions/the-map.ts              the six rows assembled, indexed and asked
 *   regions/map-by-bearing.ts       the world read as five columns
 *   regions/provinces.ts            the political layer and its lookups
 *   regions/prefectures.ts          what a prefecture is, and all of them joined
 *   regions/arterials.ts            the four arterials under the Low Fall
 *
 * The world header that used to open this file - the spine, the ceilings, one
 * ladder, two traditions - is at the top of `regions/the-map.ts`, which is what
 * it describes.
 *
 * A barrel is a barrel: nothing but re-exports belongs here. The moment logic
 * lands in this file it has stopped being one.
 */

export * from './regions/region-schema.js';
export * from './regions/region-ids.js';
export * from './regions/local-rank-names.js';
export * from './regions/ruin-and-scar-names.js';

export * from './regions/low-fall.js';
export * from './regions/quiet-marches.js';
export * from './regions/wide-field.js';
export * from './regions/white-stair.js';
export * from './regions/drowned-reach.js';
export * from './regions/the-blown-ground.js';

export * from './regions/the-map.js';
export * from './regions/map-by-bearing.js';
export * from './regions/rank-translation.js';

export * from './regions/arterials.js';
export * from './regions/prefectures.js';
export * from './regions/provinces.js';
