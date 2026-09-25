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
    GREEN_FALL: 'Emerald Water City',
    STONE_FORD: 'Clear River Ferry',
    // The home province had no `village` row at all, so a birth here could
    // only open in a city or a sect town - which is the one origin the setting
    // most wants available and the only province that could not supply it.
    CLEAR_CREEK_VILLAGE: 'Clear Creek Village',
    BURNT_EARTH: 'Burnt Earth',
    NINE_PEAKS: 'Nine Peaks',
    // ── THE VOLCANO WAS WRITTEN AND NEVER PUT ANYWHERE ──────────────────
    //
    // `prefecture-ashfall` has existed since the political layer was written: a
    // basin held by the Ashen Anvil Clan whose seat is "the furnace on the
    // volcanic flank", with the caldera and the vent vein sub-held by the Nine
    // Abyss Flame Sect and the field furnace halls by the Cinnabar Crucible
    // Sect. Its `places: []` was empty, so none of it was ever ground anybody
    // could stand on - and `volcanic` was the one biome in the world with herbs
    // growing on it and nowhere for them to grow.
    THE_FLANK: 'The Furnace Flank',
    THE_CALDERA: 'The Caldera',
    THE_VENT_VEIN: 'The Vent Vein',
    // ── THE FOUR SETTLEMENTS THAT EXISTED IN ONE SENTENCE ───────────────
    //
    // The Ashfall story again, with a cost that could be measured. The Grove
    // Basin's `onPaper` says the Grove holds "a valley, a mountain and four
    // settlements" and its `places` was empty, so the one house in the province
    // that administers settlements DIRECTLY - no levy, no charter, no
    // intermediate tier - collected nothing from any of them: 175 stones a
    // year on a seeded world, last of thirty-eight houses, below the Bone
    // Lantern Cult.
    //
    // They are ordinary-tier names because that is what the house is. It has
    // never registered anything, so no document anywhere ever fixed a name
    // here, and what people call a place is what is standing in it.
    PLUM_VILLAGE: 'Plum Village',
    TWO_STREAMS: 'Two Streams',
    SMOKE_RIDGE: 'Smoke Crest',
    PINE_SPRING: 'Pine Spring',

    // ─── The Buddha Precipice ───────────────────────────────────────────────
    IRON_GATE: 'Iron Crest',
    GRAVE_MARKET: 'Willow Village',
    SIX_LI: 'Six Li',
    JADE_FACE: 'The Jade Face',
    DEAD_STONE: 'Nine Hundred Paces',

    // ─── The Yellow Plain ──────────────────────────────────────────────────
    CLOUD_GATE: 'Cloud Gate',
    THREE_WALLS: 'Three Walls',
    AUTUMN_GATE: 'Autumn Gate',
    // A solar term, like the one it replaced: the season the insects wake, which is
    // what it was called before twelve thousand died there.
    GRAIN_RAIN: 'Insects Awaken',
    OLD_RIVER: 'Old River Village',

    // ─── The White Stair ─────────────────────────────────────────────────
    // The town has moved uphill four times behind the retreating ice, so it always
    // stands on the rubble the ice left behind it.
    COLD_PEAK: 'Moraine Gate',
    THE_LIVING_ICE: 'The Living Ice',
    // `shadow` is a FOLLOWING VERB - "I shadow him" - so `Stone Shadow` sent
    // every sentence about this place to the wrong subsystem: "I travel to Stone
    // Shadow" planned a `move/follow` rather than a `move/travel`, and "tell me
    // about Stone Shadow" reached `interact/follow` with nothing to follow. Same
    // class as FOUR_GRAVES and found by the same sweep. The name says what it
    // said before with the province's own vocabulary, which is elevations: this
    // is the band under the floating stone, and the North would call it that.
    STONE_SHADOW: 'Under Stone',
    DEEP_SNOW: 'Deep Drift Village',
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
    // `Four Names` was the same story with the burial word taken out, and it went
    // too: *four* is one letter from *your* and *names* one from *name*, so "what
    // is your name?" was read as a question about the station. `Fourfold Stele`
    // is the stone the list is cut on - four names, and there were five men. The
    // number is the memorial and the wrongness is the point. The KEY is unchanged - it
    // is a stable identifier and the catalog is full of keys that carry a
    // retired name (GREEN_FALL, IRON_GATE, GRAVE_MARKET); a rename changes the
    // value alone.
    FOUR_GRAVES: 'Fourfold Stele',
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
    // already had the pattern - Moraine Gate is the town and the Frostmirror
    // Court is the house on it - and this now follows it.
    ORCHID_TERRACE: 'Orchid Terrace',

    // ─── The Pearl Ocean ───────────────────────────────────────────────
    SWEETSPRING_ISLE: 'Sweet Spring Island',
    BRONZE_BELL_CAPE: 'Bronze Gong Cliff',
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
    // season that convenes it - which is the register `Insects Awaken` is in.
    WIND_MARKET: 'Wind Turn',
    SAND_WELL: 'Truce Spring',
    STUBBORN_PIT: 'Stubborn Pit',
    THE_SHORT_ROAD: 'The Short Road',
    TUOS_WALL: 'Tuo\'s Rampart',
    HALFWAY_GATE: 'Halfway Gate'
} as const;

/** The name of any place the map has a row for. */
export type PlaceName = typeof PLACE[keyof typeof PLACE];

/**
 * THE ID A PLACE WAS FIRST SEEDED UNDER, FOR THE PLACES RENAMED SINCE.
 *
 * A seeded place's location id is a slug of its display name
 * (`placeLocationId` in `seeding.ts`), and ids feed seeded streams and pinned
 * worlds. So a rename that moved the id would reshuffle every world that was
 * ever pinned, for a change that was only ever meant to be to what a player
 * reads. These places were renamed because a word of each was a word the
 * player types (AGENTS.md, "A name evokes what it is"), and their ids stay
 * where they were. The slugs are written as slugs, not as the old names, so
 * that a name search never finds a retired name here and "restores" it.
 */
const THE_SLUG_A_RENAMED_PLACE_KEEPS: ReadonlyMap<string, string> = new Map([
    [PLACE.GREEN_FALL, 'green-water-city'],
    [PLACE.STONE_FORD, 'clear-river-ford'],
    [PLACE.SMOKE_RIDGE, 'smoke-ridge'],
    [PLACE.IRON_GATE, 'iron-ridge'],
    [PLACE.GRAIN_RAIN, 'grain-rain'],
    [PLACE.COLD_PEAK, 'cold-peak'],
    [PLACE.DEEP_SNOW, 'deep-snow-village'],
    [PLACE.FOUR_GRAVES, 'four-names'],
    [PLACE.BRONZE_BELL_CAPE, 'bronze-bell-cliff'],
    [PLACE.SAND_WELL, 'sand-well'],
    [PLACE.TUOS_WALL, 'tuo-s-wall']
]);

/**
 * The name a renamed place's random draws were keyed on.
 *
 * A few streams take the place's display name as their key - which bills go
 * up on its wall, what a forage there turns up - and a rename would redraw
 * every one of them. These are the names those draws were first keyed on, and
 * the only place the retired names are still written: they are keys, and a
 * player never reads them.
 */
const THE_KEY_A_RENAMED_PLACE_DRAWS_UNDER: ReadonlyMap<string, string> = new Map([
    [PLACE.GREEN_FALL, 'Green Water City'],
    [PLACE.STONE_FORD, 'Clear River Ford'],
    [PLACE.SMOKE_RIDGE, 'Smoke Ridge'],
    [PLACE.IRON_GATE, 'Iron Ridge'],
    [PLACE.GRAIN_RAIN, 'Grain Rain'],
    [PLACE.COLD_PEAK, 'Cold Peak'],
    [PLACE.DEEP_SNOW, 'Deep Snow Village'],
    [PLACE.FOUR_GRAVES, 'Four Names'],
    [PLACE.BRONZE_BELL_CAPE, 'Bronze Bell Cliff'],
    [PLACE.SAND_WELL, 'Sand Well'],
    [PLACE.TUOS_WALL, 'Tuo\'s Wall']
]);

/** What a random draw keyed on a place's name is keyed on - see above. */
export function placeSeedKey(name: string): string {
    return THE_KEY_A_RENAMED_PLACE_DRAWS_UNDER.get(name) ?? name;
}

/** The slug a place's ids are built from: its name's, unless it was renamed. */
export function placeIdSlug(name: string): string {
    return THE_SLUG_A_RENAMED_PLACE_KEEPS.get(name)
        ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * The provinces, and the wedge between them. Kept apart from {@link PLACE}
 * because `Emerald Water City` the town and `The Jade Gorge` the province are two
 * different rows that a reader will otherwise conflate - which is a live
 * confusion in the played game, not a hypothetical one: see `seatSharesTheName`
 * in `src/web/lore.ts`, which exists to stop a narrator being handed both.
 */
export const REGION_NAME = {
    JADE_GORGE: 'The Jade Gorge',
    SILENT_CLIFFS: 'The Buddha Precipice',
    YELLOW_PLAIN: 'The Yellow Plain',
    WHITE_STAIR: 'The White Stair',
    DROWNED_SEA: 'The Pearl Ocean',
    BURIAL_SANDS: 'The Burial Sands'
} as const;

/** The name of any province, or of the ungoverned interior. */
export type RegionName = typeof REGION_NAME[keyof typeof REGION_NAME];
