/**
 * Regions - five of them, and the contrast between them is the content.
 *
 * "Depth, not scale" is meaningless while every faction stands in one
 * province, because then it just means "small". It needs other places where
 * the assumptions are different - not the scenery, the assumptions.
 *
 * THE SPINE
 * ---------
 * Four provinces around a centre, and water to the south:
 *
 *     CENTRE  The Low Fall      horizontal surveyable veins, held for four
 *                               hundred years. The world's apex sits here.
 *     WEST    The Quiet Marches driven stone, cut with tools. The last of the
 *                               five driven provinces, and the one people leave.
 *     EAST    The Wide Field    flat, dug over, nine cities, and no high ground
 *                               anybody could fortify. Nobody holds land; every
 *                               institution in it holds a lease.
 *     NORTH   The White Stair   the qi is in the ice and the ice is going. A
 *                               holding is an elevation, and it moves uphill.
 *     SOUTH   The Drowned Reach open water. There is no ground under it, so
 *                               there is no vein under it, so there is nothing
 *                               in the air. Nobody holds it and nobody can.
 *                               The one exception is forty acres of island in
 *                               the middle of it - see `Thousand Sail Harbour` in the
 *                               places list - and the exception proves the
 *                               rule, because what makes that island holdable
 *                               is that holding it would make it worthless.
 *
 * Those five words are now a FIELD rather than a comment. `Region.bearing`
 * carries them, `regionsByBearing` and `factionsByBearing` read the world as
 * five columns, and `apexSeats` states where the three apexes actually stand
 * instead of leaving a reader to assume they divide the compass. See
 * `BearingSchema`, which is also the record of why this was missing.
 *
 * And one thing that is not a province, in the wedge the four arms leave
 * between them:
 *
 *     INTERIOR The Blown Ground  a rich vein under loose cover that moves. The
 *                               qi surfaces, and the surfacings close faster
 *                               than a grant runs. Nobody holds it because
 *                               nothing here lasts long enough to be granted.
 *                               See `THE_BLOWN_GROUND` at the foot of this file.
 *
 * Every region connects to the Low Fall, which is what makes it the centre.
 * The only route between two provinces that does not pass through it is by
 * water, and the water is the slowest, most expensive and least reliable way
 * to get anywhere in the world - see `sea_crossing` below.
 *
 * That sentence is about ROUTES, not about ground. There is a direct overland
 * line between the western arm and the eastern one, it is on every map, it is
 * about eight days shorter than going through the gorge, and nothing runs on
 * it - no cart, no courier, no insured convoy - because it crosses the ground
 * in `THE_BLOWN_GROUND` below, which is between the provinces and inside none
 * of them. "There is no fifth road" is what the world says and it means "there
 * is no fifth road anybody uses". The distinction is the whole of why the Low
 * Fall is the centre and why the centre is resented.
 *
 * THE CEILINGS ARE THE GRADIENT
 * -----------------------------
 * `localCeilingOrdinal` means nobody in this province has passed it in living
 * memory. It caps NPC advancement in `pressure.ts` and sets trial thresholds in
 * `seeding.ts`, so it is the single number that decides what a province is for.
 *
 *     Low Fall       MAX_ORDINAL   no ceiling. The only province in the world
 *                                  with none, which is how you can tell from
 *                                  one number where the apex is.
 *     Wide Field     38            the strongest thing in nine cities, and it
 *                                  rents its rooms.
 *     White Stair    36            a person, not a property of the ground.
 *     Quiet Marches   6            the loose stone within reach is worked out.
 *     Drowned Reach   2            three layers on the islands and nothing at
 *                                  all on open water.
 *
 * The cliff between 36 and 6 is the border between the traditions. The cliff
 * between 6 and 2 is the edge of the land.
 *
 * ONE LADDER, ALWAYS
 * ------------------
 * This is a hard constraint and this file is where it is easiest to break.
 * There is a single realm ladder and `realmOrdinal` is universally
 * authoritative. The Quiet Marches calls Core Formation "Keystone" and its
 * carvers will argue at length that Keystone is nothing like Core Formation.
 * They are wrong about the rung and right about the road: the ordinal is the
 * same everywhere, and only the vocabulary and the method differ.
 *
 * `localRankNames` therefore does not define a scale. It relabels the shared
 * one, band for band, and the catalog test asserts that the local bands tile
 * `REALM_TIERS` exactly - same boundaries, same count, no gaps, no overlap and
 * no conversion arithmetic anywhere.
 *
 * Everything else regional is expressed as modifiers over those shared
 * ordinals: rate curves, deviation risk, bottlenecks, missing disciplines,
 * costs. Never a second ladder, and never a rank number that means something
 * different here.
 *
 * TWO TRADITIONS
 * --------------
 * The Low Fall practises the Drawn Road and the Quiet Marches practises the
 * Cut Road, and they are not two flavours of one thing - they have different
 * bottlenecks, different costs, and different answers to being killed. See
 * `traditions.ts`. The border between the regions is also the border between
 * the traditions, which is why crossing it changes what the people are and not
 * merely where they live.
 *
 * The count is still two. Four of the five regions are Drawn and one is Cut,
 * which is not a taxonomy - it is the score. The Cut hold five driven
 * provinces and the Drawn hold everything a person can breathe in, and both
 * sides teach an account of the war that explains why.
 *
 * The exception is the water, and it follows from the traditions rather than
 * being written next to them: a Drawn cultivator takes qi out of the air and
 * there is none over deep water, while a Cut cultivator works qi out of stone
 * and stone can be carried. The open sea is the one place in the world where
 * the losing tradition is the stronger of the two, and neither of them has a
 * province on it to make anything of that.
 *
 * THE TRANSLATION IS THE CONTENT
 * ------------------------------
 * Outsiders map local titles onto the ladder, the mapping is disputed by
 * parties with money on the outcome, and reading a local title one rank low is
 * an ordinary and fatal mistake. See `TITLE_TRANSLATIONS`.
 */

import type { AmbientQi } from '../../../schema/cultivation.js';
import type {
    Region,
    RegionPlaceConnection
} from './region-schema.js';
import { BLOWN_GROUND_ID, HOME_REGION_ID } from './region-ids.js';
import { THE_LOW_FALL } from './low-fall.js';
import { THE_QUIET_MARCHES } from './quiet-marches.js';
import { THE_WIDE_FIELD } from './wide-field.js';
import { THE_WHITE_STAIR } from './white-stair.js';
import { THE_DROWNED_REACH } from './drowned-reach.js';
import { THE_BLOWN_GROUND_AS_REGION } from './the-blown-ground.js';
import type { RegionConnection } from './region-schema.js';


/**
 * THE SPINE AS AUTHORED. Five provinces, and every province invariant is
 * about these.
 *
 * Module-private, because it is not the whole map and a caller that took it
 * for one would be reading a world with a hole in the middle. The two
 * exported lists are at the foot of the file and mean different things:
 *
 *   SPINE_REGIONS  ground somebody holds, or could. Two seated houses each, a
 *                  tradition seated on it, a road to the centre, a ceiling
 *                  nobody else shares. Everything the catalog tests assert.
 *   REGIONS        ground the map has a row for, which is what a seeder, a
 *                  travel graph and a player standing somewhere need.
 *
 * Until the wedge was projected those were the same list, so "region" and
 * "province" were the same word and the distinction had nowhere to live. See
 * {@link THE_BLOWN_GROUND_AS_REGION}.
 */
const THE_FIVE_PROVINCES: readonly Region[] = [
    THE_LOW_FALL,
    THE_QUIET_MARCHES,
    THE_WIDE_FIELD,
    THE_WHITE_STAIR,
    THE_DROWNED_REACH
];

// ─────────────────────────────────────────────────────────────────────────
// INDICES + LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

/**
 * BUILT ON FIRST USE, NOT AT THIS LINE, AND THE REASON IS ORDERING.
 *
 * `REGIONS` is assembled at the FOOT of this file, because it holds the
 * projection of `THE_BLOWN_GROUND` and that object is declared down there
 * beside the rest of the ungoverned material. An index built at this line
 * would read a `const` that has not been initialised yet and throw on import.
 *
 * One memo for all four indices, so they cannot get out of step with each
 * other, and so the file is walked once rather than four times.
 *
 * WHAT EACH IS FOR, kept from the four comments this replaced:
 *
 * `ambientByPlaceName` is the band a named settlement's ground ordinarily
 * gives. Every place in `places` declares one, and until it was indexed
 * nothing read them at the point a cultivator was standing there:
 * `currentAmbient` fell through to `impliedDensityFor`, a hash of the run seed
 * and the location STRING, so Nine Peaks - "the deepest vein anyone has kept" -
 * rolled its qi off its own name and came out indistinguishable from a thin
 * market town. Found by playing: two consecutive looks at the same square
 * described the air as thick enough to notice on the first breath, and then as
 * unremarkable.
 *
 * `regionIdByPlaceName` is the province a named settlement sits in. Built for
 * the same reason: the engine holds no map, so anything that needs to know
 * where a place IS has to ask the catalog that authored it. Both return
 * undefined for a compound, a site or anything the catalog has never named,
 * which is the honest answer rather than a guess at the nearest province.
 */
interface RegionIndices {
    byId: ReadonlyMap<string, Region>;
    byFaction: ReadonlyMap<string, string>;
    ambientByPlaceName: ReadonlyMap<string, AmbientQi>;
    regionIdByPlaceName: ReadonlyMap<string, string>;
    /**
     * Every place road, filed under BOTH of its ends off one declared row.
     *
     * This is where "stored once, read both ways" is actually made true. The
     * catalog states a road on one end; this index files it under both, so no
     * reader anywhere has to know which end it was written on and there is
     * never a second row to disagree with the first.
     *
     * Nested rather than keyed on a joined pair string, because place names
     * have spaces in them and any separator a name can contain makes one
     * pair's key a prefix of another's.
     */
    placeRoadsFrom: ReadonlyMap<string, ReadonlyMap<string, RegionPlaceConnection>>;
}

let INDICES: RegionIndices | null = null;

function indices(): RegionIndices {
    if (INDICES) return INDICES;
    const byId = new Map<string, Region>();
    const byFaction = new Map<string, string>();
    const ambientByPlaceName = new Map<string, AmbientQi>();
    const regionIdByPlaceName = new Map<string, string>();
    const placeRoadsFrom = new Map<string, Map<string, RegionPlaceConnection>>();
    const fileRoad = (from: string, road: RegionPlaceConnection): void => {
        const key = from.trim().toLowerCase();
        let out = placeRoadsFrom.get(key);
        if (!out) placeRoadsFrom.set(key, out = new Map());
        const to = road.otherPlaceName.trim().toLowerCase();
        // A shorter row wins where a province states two ways between one
        // pair, which is the rule `daysOnTheRoadTo` already applies to
        // province roads: a road is as long as the shortest road there is.
        const seen = out.get(to);
        if (!seen || road.travelDays < seen.travelDays) out.set(to, road);
    };
    for (const region of REGIONS) {
        byId.set(region.id, region);
        for (const factionId of region.factionIds) byFaction.set(factionId, region.id);
        for (const place of region.places) {
            ambientByPlaceName.set(place.name.toLowerCase(), place.ambient);
            regionIdByPlaceName.set(place.name.toLowerCase(), region.id);
            for (const road of place.connections ?? []) {
                // The declared direction, and the mirror of it.
                fileRoad(place.name, road);
                fileRoad(road.otherPlaceName, { ...road, otherPlaceName: place.name });
            }
        }
    }
    // A PROVINCE IS SOMEWHERE YOU CAN STAND, so its own name has to answer too.
    //
    // The world holds a row for each province and a player can travel to one -
    // "I travel to The Quiet Marches" is an ordinary move and lands them on it.
    // With only place names in this map, that arrival resolved to NO province,
    // and every caller fell back to somewhere else: `where can I go` answered
    // for the birth province, so it listed the wrong towns and could not name
    // the gate of a house the player had just been told about, in the province
    // they were standing in.
    //
    // Places win, and are therefore set first and never overwritten. A town
    // named for its province is somewhere a person can walk to and a province
    // is not, so the narrower answer is the more useful one.
    for (const region of REGIONS) {
        const key = region.name.toLowerCase();
        if (!regionIdByPlaceName.has(key)) regionIdByPlaceName.set(key, region.id);
    }
    INDICES = { byId, byFaction, ambientByPlaceName, regionIdByPlaceName, placeRoadsFrom };
    return INDICES;
}

/**
 * The road between two named places of one province, or undefined.
 *
 * Undefined means UNPRICED and never unreachable - see
 * {@link RegionPlaceConnectionSchema}. Direction does not matter: the road is
 * declared on one end and indexed under both.
 */
export function placeRoadBetween(
    fromPlaceName: string | null | undefined,
    toPlaceName: string | null | undefined
): RegionPlaceConnection | undefined {
    if (!fromPlaceName || !toPlaceName) return undefined;
    return indices().placeRoadsFrom
        .get(fromPlaceName.trim().toLowerCase())
        ?.get(toPlaceName.trim().toLowerCase());
}

/**
 * What that road costs on foot, in walking days, or null where none is stated.
 *
 * The place-scale twin of the loop over `region.connections` in
 * `daysOnTheRoadTo`, and it returns the same thing in the same unit so that
 * the one function pricing a journey has one more source and still exactly
 * one answer.
 */
export function placeRoadDays(
    fromPlaceName: string | null | undefined,
    toPlaceName: string | null | undefined
): number | null {
    return placeRoadBetween(fromPlaceName, toPlaceName)?.travelDays ?? null;
}

/**
 * Everywhere the catalog says is next to this place, in walking days.
 *
 * Both the roads declared ON this place and the ones declared on its
 * neighbours pointing back at it, because a caller asking what is next to
 * somewhere should not have to know which end the author wrote it on.
 */
export function placesNextTo(
    placeName: string | null | undefined
): Array<{ name: string; travelDays: number; kind: RegionPlaceConnection['kind']; description: string }> {
    if (!placeName) return [];
    const roads = indices().placeRoadsFrom.get(placeName.trim().toLowerCase());
    if (!roads) return [];
    return [...roads.values()]
        .map(road => ({
            name: road.otherPlaceName,
            travelDays: road.travelDays,
            kind: road.kind,
            description: road.description
        }))
        .sort((a, b) => a.travelDays - b.travelDays || a.name.localeCompare(b.name));
}

/**
 * The band a named settlement's ground ordinarily gives.
 *
 * Every place in `places` declares one, and until this existed nothing read
 * them at the point a cultivator was standing there. `currentAmbient` fell
 * through to `impliedDensityFor`, which is a hash of the run seed and the
 * location STRING - so Nine Peaks, "the deepest vein anyone has kept", rolled
 * its qi off its own name and came out indistinguishable from a thin market
 * town. Found by playing: two consecutive looks at the same square described
 * the air as thick enough to notice on the first breath, and then as
 * unremarkable.
 *
 * Returns undefined for anything not in the catalog - a compound, a site, an
 * admin alias - and that is the honest answer rather than a default. The
 * implied guess is correct exactly where the ground genuinely is not known.
 */
export function regionIdOfPlace(placeName: string | null | undefined): string | undefined {
    if (!placeName) return undefined;
    return indices().regionIdByPlaceName.get(placeName.trim().toLowerCase());
}

export function declaredAmbientAt(placeName: string | null | undefined): AmbientQi | undefined {
    if (!placeName) return undefined;
    return indices().ambientByPlaceName.get(placeName.trim().toLowerCase());
}

export function getRegion(id: string): Region | undefined {
    return indices().byId.get(id);
}

export function requireRegion(id: string): Region {
    const r = indices().byId.get(id);
    if (!r) throw new Error(`Unknown region: ${id}`);
    return r;
}

export function getHomeRegion(): Region {
    return requireRegion(HOME_REGION_ID);
}

export function getRegionForFaction(factionId: string): Region | undefined {
    const id = indices().byFaction.get(factionId);
    return id ? indices().byId.get(id) : undefined;
}

/**
 * Whether a cultivator at this ordinal has anything left to gain from the
 * local ground unaided. False means the region is done with them: buy access,
 * buy stones, or leave.
 */
export function canAdvanceHere(regionId: string, ordinal: number): boolean {
    return ordinal < requireRegion(regionId).localCeilingOrdinal;
}

/** Price of a listed good in this region, before haggling. */
export function localPrice(regionId: string, basePrice: number): number {
    return Math.round(basePrice * requireRegion(regionId).priceMultiplier);
}

/** Whether a discipline works at all in this region. */
export function disciplineWorksIn(regionId: string, discipline: string): boolean {
    return !requireRegion(regionId).cultivation.missingDisciplines
        .some(m => m.discipline.toLowerCase() === discipline.trim().toLowerCase());
}

/** Ambient states present in a region at all, commonest first. */
export function ambientStatesIn(regionId: string): AmbientQi[] {
    const profile = requireRegion(regionId).ambientProfile;
    return (Object.entries(profile) as [AmbientQi, number][])
        .filter(([, share]) => share > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([state]) => state);
}

// ─────────────────────────────────────────────────────────────────────────
// THE MAP
//
// `SPINE_REGIONS` is the five arms. `REGIONS` is those plus the wedge between
// them, and it is what the catalog loader, the seeder, the travel graph and
// every "where am I standing" question read.
//
// WHY THE PROJECTION EXISTS AT ALL. The section comment above argues, at
// length and correctly, that the Blown Ground is not a sixth PROVINCE: five
// clauses of the `Region` contract presuppose a holder and every one of them
// would have to be weakened. None of that is retracted and none of it has
// been weakened - `SPINE_REGIONS` still holds exactly five rows and every
// catalog invariant about a province is asserted over that list.
//
// What the argument did not cover is that `Region` is also the only shape the
// engine can read. `loadCultivationCatalog` maps one list; `seedRegions`
// mints one location per row and links the roads; `requireRegion` is what
// `game.ts` calls to price a journey out of wherever somebody is standing. So
// "not a province" and "not on the map" were the same sentence, and the
// second half of it is what left eleven days of sand as a page of prose.
//
// The projection is therefore lossy ON PURPOSE and in one direction only.
// `UngovernedGround` is the richer object and stays authoritative for
// everything that has no `Region` field to go in - the shows, the Meet, the
// finders, the leakage, why nobody fixes it. What crosses is the subset the
// engine can act on.

/**
 * Every row the map has, spine and wedge, with the roads joined up.
 *
 * The back-links are derived rather than typed into the province rows, so
 * there is exactly one place in this file that states what the fifth road
 * costs and no way for the two ends to disagree about it. `game.ts` prices a
 * journey off the connections of the region somebody is STANDING in, so
 * without these the road would be walkable one way and unpriced the other.
 */
export const REGIONS: readonly Region[] = (() => {
    const back = new Map<string, RegionConnection>();
    for (const link of THE_BLOWN_GROUND_AS_REGION.connections) {
        back.set(link.otherRegionId, {
            kind: link.kind,
            otherRegionId: THE_BLOWN_GROUND_AS_REGION.id,
            description: link.description,
            travelDays: link.travelDays
        });
    }
    const spine = THE_FIVE_PROVINCES.map(province => {
        const edge = back.get(province.id);
        return edge
            ? { ...province, connections: [...province.connections, edge] }
            : province;
    });
    return [...spine, THE_BLOWN_GROUND_AS_REGION];
})();

/**
 * The five arms, and the subject of every province invariant in the catalog
 * tests: two seated houses, a tradition, a road to the centre, a ceiling
 * nobody else shares.
 *
 * Named for the spine rather than for provinces because `PROVINCES` in this
 * file is already the political layer - `Province`, with an apex over it and
 * prefectures under it - and the two are different questions about the same
 * five names.
 *
 * Filtered out of `REGIONS` rather than declared separately, so the rows in
 * the two lists are the same objects and a road added to one is a road in the
 * other.
 */
export const SPINE_REGIONS: readonly Region[] = REGIONS.filter(r => r.id !== BLOWN_GROUND_ID);
