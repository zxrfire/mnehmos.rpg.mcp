/**
 * Place names - one source of truth for what every place is called.
 *
 * A place has no id. `RegionPlaceSchema` is `{name, kind, ambient, note}`, so
 * the display string IS the key, and `regionIdOfPlace`, `declaredAmbientAt` and
 * `prefectureCarrying` all match on it. Every one of them fails OPEN: an
 * unmatched name returns `undefined` and the caller falls back to the home
 * province or a default band. So a name spelt two ways does not throw. It
 * quietly answers with the wrong province, which is why the 53 loose string
 * literals this file replaced were a defect rather than a tidiness problem.
 *
 * > One source of truth for a name, exported as a const, imported everywhere.
 * > Never retyped as a string literal.
 *
 * `regions.ts` builds its `places[]` from these consts, so a rename is one line
 * here - for the CODE. Authored prose that mentions a place is a sentence
 * rather than a reference: roughly 700 lines across ~150 files, which a rename
 * still has to sweep by hand. That cost is irreducible and interpolating consts
 * into prose to shrink it makes the prose worse; `NARRATOR-CORE.md` is against
 * it. A prefecture's `seat` stays a bare `string` for the same reason - six of
 * the fourteen are prose rather than places.
 *
 * Add the const here first, then use it in `regions.ts`.
 * `tests/data/place-name-drift.test.ts` fails in both directions: a place with
 * no const is the defect this file exists to stop, and a const with no place is
 * a name nobody can reach. It does NOT scan `tests/`, so the ~470 place
 * literals asserted there are a rename's silent breakage surface and have to be
 * swept by hand.
 *
 * WHAT THE NAMES SHOULD SOUND LIKE is `docs/world/writing/place-names.md`.
 */

/**
 * Every settlement, site and waystation the map has a row for, grouped by the
 * province that holds it. The KEY is stable and the VALUE is what a player
 * sees; a rename changes the value alone.
 */
export const PLACE = {
    // ─── The Jade Gorge ────────────────────────────────────────────────────
    GREEN_FALL: 'Green Water City',
    STONE_FORD: 'Clear River Ford',
    // The home province had no `village` row at all, so a birth here could
    // only open in a city or a sect town - which is the one origin the setting
    // most wants available and the only province that could not supply it.
    CLEAR_CREEK_VILLAGE: 'Clear Creek Village',
    BURNT_EARTH: 'Burnt Earth',
    NINE_PEAKS: 'Nine Peaks',

    // ─── The Silent Cliffs ───────────────────────────────────────────────
    IRON_GATE: 'Iron Ridge',
    GRAVE_MARKET: 'Willow Village',
    SIX_LI: 'Six Li',
    JADE_FACE: 'The Jade Face',
    DEAD_STONE: 'Nine Hundred Paces',

    // ─── The Yellow Plain ──────────────────────────────────────────────────
    CLOUD_GATE: 'Cloud Gate',
    THREE_WALLS: 'Three Walls',
    AUTUMN_GATE: 'Autumn Gate',
    GRAIN_RAIN: 'Grain Rain',
    OLD_RIVER: 'Old River Village',

    // ─── The White Stair ─────────────────────────────────────────────────
    COLD_PEAK: 'Cold Peak',
    THE_LIVING_ICE: 'The Living Ice',
    // `shadow` is a FOLLOWING VERB - "I shadow him" - so `Stone Shadow` sent
    // every sentence about this place to the wrong subsystem: "I travel to Stone
    // Shadow" planned a `move/follow` rather than a `move/travel`, and "tell me
    // about Stone Shadow" reached `interact/follow` with nothing to follow. Same
    // class as FOUR_GRAVES and found by the same sweep. The name says what it
    // said before with the province's own vocabulary, which is elevations: this
    // is the band under the floating stone, and the North would call it that.
    STONE_SHADOW: 'Under Stone',
    DEEP_SNOW: 'Deep Snow Village',
    // A PLACE IS NOT NAMED AFTER A GAME CATEGORY, and this one was for a while.
    // The station is named for the four men who kept it the winter the pass was
    // cut - three of them are in the wall and there were five - so the name is a
    // count read off the record, and the record is wrong. `Four Graves` carried
    // that and also carried `graves`, which is an inheritance-site noun in
    // `src/web/site-phrasings.ts`: measured on a played turn, "I travel to Four
    // Graves" came back as the site LISTING and nobody moved. `outsideAnyName`
    // fixed the parser in general and this fixes the name, because a category
    // word inside a place name is a coin-flip for the model that classifies the
    // sentence as well as for the table that parses it.
    //
    // `Four Names` is the same story with the burial word taken out: what the
    // station has is a written list of four, and there were five men. The number
    // is the memorial and the wrongness is the point. The KEY is unchanged - it
    // is a stable identifier and the catalog is full of keys that carry a
    // retired name (GREEN_FALL, IRON_GATE, GRAVE_MARKET); a rename changes the
    // value alone.
    FOUR_GRAVES: 'Four Names',
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
    // already had the pattern - Cold Peak is the town and the Frostmirror
    // Court is the house on it - and this now follows it.
    ORCHID_TERRACE: 'Orchid Terrace',

    // ─── The Drowned Sea ───────────────────────────────────────────────
    SWEETSPRING_ISLE: 'Sweet Spring Island',
    BRONZE_BELL_CAPE: 'Bronze Bell Cliff',
    DRAGONVEIN_ROCK: 'Dragonvein Rock',
    THE_BITTER_CROSSING: 'The Bitter Crossing',
    THE_FAR_SHORE: 'The Far Shore',
    SILVER_ISLE: 'Silver Island',
    THE_WAITING_SAILS: 'Waiting Sails',
    THE_BOUNDLESS: 'Boundless Sea',
    THE_SALT_FIELDS: 'Salt Fields',

    // ─── The Burial Sands (no province holds it) ─────────────────────────
    // A PLACE IS NOT NAMED AFTER A GAME CATEGORY, again. `market` is the word
    // the market board answers to, so "I go to Wind Market" and "I walk to Wind
    // Market" opened a price board instead of moving anybody, and "where is Wind
    // Market" was read as an offer to trade. The town is a market and is allowed
    // to be described as one; it may not be CALLED one. It assembles for about
    // six weeks after the wind turns and then is not there, so the name is the
    // season that convenes it - which is the register `Grain Rain` is in.
    WIND_MARKET: 'Wind Turn',
    SAND_WELL: 'Sand Well',
    LONG_VEIN: 'Long Vein',
    THE_SHORT_ROAD: 'The Short Road',
    TUOS_WALL: 'Tuo\'s Wall',
    HALFWAY_GATE: 'Halfway Gate'
} as const;

/** The name of any place the map has a row for. */
export type PlaceName = typeof PLACE[keyof typeof PLACE];

/** Every place name, in catalog order. */
export const PLACE_NAMES: readonly PlaceName[] = Object.freeze(
    Object.values(PLACE) as PlaceName[]
);

/**
 * The provinces, and the wedge between them. Kept apart from {@link PLACE}
 * because `Green Water City` the town and `The Jade Gorge` the province are two
 * different rows that a reader will otherwise conflate - which is a live
 * confusion in the played game, not a hypothetical one: see `seatSharesTheName`
 * in `src/web/lore.ts`, which exists to stop a narrator being handed both.
 */
export const REGION_NAME = {
    JADE_GORGE: 'The Jade Gorge',
    SILENT_CLIFFS: 'The Silent Cliffs',
    YELLOW_PLAIN: 'The Yellow Plain',
    WHITE_STAIR: 'The White Stair',
    DROWNED_SEA: 'The Drowned Sea',
    BURIAL_SANDS: 'The Burial Sands'
} as const;

/** The name of any province, or of the ungoverned interior. */
export type RegionName = typeof REGION_NAME[keyof typeof REGION_NAME];

/** Every province name, in catalog order. */
export const REGION_NAMES: readonly RegionName[] = Object.freeze(
    Object.values(REGION_NAME) as RegionName[]
);
