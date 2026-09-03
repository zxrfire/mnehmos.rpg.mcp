/**
 * Place names - the one source of truth for what every place in the world is
 * called, so that nothing else ever retypes one.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `RegionPlaceSchema` in `regions.ts` is `{name, kind, ambient, note}` and has
 * no id. A place is therefore identified by its display string, and the string
 * is the key: `regionIdOfPlace`, `declaredAmbientAt` and `prefectureCarrying`
 * all match a place by name, and every one of them fails OPEN - an unmatched
 * name returns `undefined` and the caller falls back to the home province or
 * to a default band. So a name typed one way in the catalog and another way in
 * a route table does not throw. It quietly answers with the wrong province.
 *
 * Before this file there were 53 place-name string literals in `src/` outside
 * the catalog - member home towns, courier routes, trade legs, a rumour's
 * subject, the starting location, and a fallback in `facts.ts` that retyped
 * `STARTING_LOCATION` rather than importing it. Every one of them was a second
 * copy of a name whose first copy is in `regions.ts`, and a rename that missed
 * any of them would have produced exactly the silent wrong answer above.
 *
 * THE RULE
 * --------
 * > One source of truth for a name, exported as a public const, imported
 * > everywhere else. Never retyped as a string literal.
 *
 * `regions.ts` builds its `places[]` out of these consts, so the catalog and
 * this file cannot disagree about what a place is called. Renaming a place is
 * a change to ONE line here.
 *
 * WHAT THIS DOES NOT FIX, AND SHOULD NOT BE READ AS FIXING
 * --------------------------------------------------------
 * Authored PROSE that mentions a place - a `note`, a rumour's text, a
 * design comment, a paragraph of `docs/world/` - is a sentence, not a
 * reference. It cannot import anything, and a rename still has to sweep it.
 * That is roughly 700 lines across ~150 files and it is the irreducible cost
 * of renaming a place. Do not try to interpolate consts into prose to shrink
 * it: a sentence assembled from fragments reads worse than a sentence, and
 * `NARRATOR-CORE.md` is against it.
 *
 * WHAT IS DELIBERATELY STILL A STRING
 * -----------------------------------
 * A prefecture's `seat` is a place name in eight cases and free prose in six
 * ("the furnace on the volcanic flank", "no seat: nobody lives inside it"), so
 * the field stays `string` and the eight that are places use a const.
 *
 * The guard is `tests/data/a-place-name-has-one-source.test.ts`, which asserts
 * this table and the catalog agree in both directions and that no place-name
 * literal has reappeared anywhere in `src/`.
 *
 * ADDING A PLACE
 * --------------
 * Add the const here first, then use it in `regions.ts`. The guard fails in
 * both directions on purpose: a place with no const is the defect this file
 * exists to stop, and a const with no place is a name nobody can reach, which
 * is how a table like this goes stale. If the guard tells you the catalog has
 * a place this file does not name, the fix is one line here.
 */

/**
 * Every settlement, site and waystation the map has a row for, grouped by the
 * province that holds it. The KEY is stable and the VALUE is what a player
 * sees; a rename changes the value alone.
 */
export const PLACE = {
    // ─── The Low Fall ────────────────────────────────────────────────────
    LOW_FALL: 'Low Fall',
    SCARWATER: 'Scarwater',
    SWEPTGROUND: 'Sweptground',
    NINE_PEAKS: 'Nine Peaks',

    // ─── The Quiet Marches ───────────────────────────────────────────────
    KETTLE: 'Kettle',
    HOLLOWMARKET: 'Hollowmarket',
    SIXMILE: 'Sixmile',
    GAPWATER_FACE: 'The Gapwater face',
    DEAD_VERGE: 'The Dead Verge',

    // ─── The Wide Field ──────────────────────────────────────────────────
    NINEWATCH: 'Ninewatch',
    THIRDWALL: 'Thirdwall',
    WHEATGATE: 'Wheatgate',
    MUDSUMMER: 'Mudsummer',
    MILLRUN: 'Millrun',

    // ─── The White Stair ─────────────────────────────────────────────────
    RIMEFALL: 'Rimefall',
    THE_GIVING: 'The Giving',
    UNDERHANG: 'Underhang',
    UNDERSNOW: 'Undersnow',
    FOURHANDS: 'Fourhands',
    // 空谷幽蘭 - the orchid in the empty valley, which is the classical image
    // for worth that does not advertise itself and does not need to be seen to
    // be worth something. It is the house rather than a description of the
    // plant: a body that refused sponsorship and went where nobody looks, in
    // the one province where nothing grows.
    //
    // The catalog already held the OTHER half of the idiom before this
    // arrived, and that is a coincidence worth keeping rather than a
    // duplication worth fixing: `herb-morning-dew-orchid` is common, forest,
    // traded by the armful and worth about a fortnight of honest cultivation.
    // That is the roadside orchid. This is the other one, and the contrast is
    // the whole force of the image.
    ORCHID_VALLEY: 'Orchid Valley',
    // THE TERRACE IS NOT THE COURT, and the two were one name for an hour.
    // `buildLore` dedupes every mentionable by name and places are built
    // before houses, so a settlement called Orchid Court silently swallowed
    // the house of that name: a body at ordinal 34 that a carter could not
    // say, which `hearsay.ts` calls common currency and asserts. The world
    // already had the pattern - Rimefall is the town and the Frostmirror
    // Court is the house on it - and this now follows it.
    ORCHID_TERRACE: 'Orchid Terrace',

    // ─── The Drowned Reach ───────────────────────────────────────────────
    SWEETSPRING_ISLE: 'Sweetspring Isle',
    BRONZE_BELL_CAPE: 'Bronze Bell Cape',
    DRAGONVEIN_ROCK: 'Dragonvein Rock',
    THE_BITTER_CROSSING: 'The Bitter Crossing',
    THE_FAR_SHORE: 'The Far Shore',
    THOUSAND_SAIL_HARBOUR: 'Thousand Sail Harbour',
    THE_WAITING_SAILS: 'The Waiting Sails',
    THE_BOUNDLESS: 'The Boundless',
    THE_SALT_FIELDS: 'The Salt Fields',

    // ─── The Blown Ground (no province holds it) ─────────────────────────
    THE_MEET: 'The Meet',
    THE_SINK: 'The Sink',
    LONG_OPEN: 'Long Open',
    THE_FORTNIGHT: 'The Fortnight',
    TUOS_WALL: 'Tuo\'s Wall',
    MIDWAY: 'Midway'
} as const;

/** The name of any place the map has a row for. */
export type PlaceName = typeof PLACE[keyof typeof PLACE];

/** Every place name, in catalog order. */
export const PLACE_NAMES: readonly PlaceName[] = Object.freeze(
    Object.values(PLACE) as PlaceName[]
);

/**
 * The provinces, and the wedge between them. Kept apart from {@link PLACE}
 * because `Low Fall` the town and `The Low Fall` the province are two
 * different rows that a reader will otherwise conflate - which is a live
 * confusion in the played game, not a hypothetical one: see `seatSharesTheName`
 * in `src/web/lore.ts`, which exists to stop a narrator being handed both.
 */
export const REGION_NAME = {
    LOW_FALL: 'The Low Fall',
    QUIET_MARCHES: 'The Quiet Marches',
    WIDE_FIELD: 'The Wide Field',
    WHITE_STAIR: 'The White Stair',
    DROWNED_REACH: 'The Drowned Reach',
    BLOWN_GROUND: 'The Blown Ground'
} as const;

/** The name of any province, or of the ungoverned interior. */
export type RegionName = typeof REGION_NAME[keyof typeof REGION_NAME];

/** Every province name, in catalog order. */
export const REGION_NAMES: readonly RegionName[] = Object.freeze(
    Object.values(REGION_NAME) as RegionName[]
);
