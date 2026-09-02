/**
 * Birth - where a run opens, and whose child it opens as.
 *
 * `src/engine/cultivation/origin.ts` says what an origin is WORTH.
 * `src/engine/world/origin-odds.ts` measures whether that worth stays honest.
 * Neither of them puts anybody anywhere: origin-odds closes with "nothing here
 * feeds back into the simulation, it measures and it reports", and until this
 * module existed that was true of the whole axis. Every run opened at the same
 * address with the same purse.
 *
 * This is the missing third piece, and it is deliberately small. It draws an
 * origin from the frozen tier weights and turns it into ORDINARY STARTING
 * VALUES:
 *
 *   a place        the house's own ground where the family belongs to one, and
 *                  a settlement drawn from the world's own distribution
 *                  otherwise - with the family's holding as a FLOOR under the
 *                  ground and never a band nobody else can reach
 *   a purse        the tier's `spiritStones`, unchanged
 *   a house        the faction the family belongs to, drawn from the real
 *                  catalog by standing, or null for the nine births in ten
 *                  that belong to nobody
 *   some names     knowledge rows, which is the whole of why a court's child
 *                  can say a word a farm child cannot
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE LINE THIS MODULE MUST NOT CROSS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * origin.ts states it and this module inherits it without softening:
 *
 *   > Placement is a rate multiplier and a ceiling that is the house's rather
 *   > than the province's. NEVER A RANK, NEVER ADMISSION.
 *
 * So {@link Birth} carries no realm ordinal, no cultivation progress, no rank
 * index, no foundation and no insight, and there is deliberately no field on it
 * that could. A patriarch's child opens at ordinal zero like everybody else.
 * What they have is a better address, a heavier purse, and a longer list of
 * names they have heard said at home.
 *
 * ─── AND, SINCE THIS FILE'S OWN CONTRACT USED TO SAY OTHERWISE ───────────
 *
 * It also carries {@link RaisedInside}, which is MEMBERSHIP and is not a rank.
 * The two were run together here for as long as this module existed, and the
 * cost was measurable: `dao_house_bloodline` and `apex_sect_members_child` both
 * existed as tiers, both described being born inside a house, and neither put
 * anybody in one. Measured over 400 births, not one landed on any of the 34
 * sect seats the world builds, and no birth carried a house membership of any
 * kind.
 *
 * The distinction that makes it safe is one sentence: BEING ON A ROLL AND BEING
 * ON A RUNG ARE DIFFERENT FACTS. A roll says whose the house considers you and
 * can be inherited. A rung says what you have done and cannot. So a child of a
 * Dao house's line is on its roll from birth, at no rank in it, standing in
 * front of exactly the floors a stranger stands in front of - which the object
 * carries, in {@link RaisedInside.stillToClear}, so that a reader does not have
 * to take it on trust.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS BESPOKE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * There is no branch on a tier key anywhere in this file, and there must never
 * be one. Being born into the strongest house in the world is the same code
 * path as being born on a hillside: a weighted draw over the same catalog,
 * bounded by numbers that already existed. The Hollow Court is reachable as a
 * birth house for exactly one reason - its `powerOrdinal` is 44 and the top
 * tier's placement `reach` is 38, so it falls in the top band - and if the
 * catalog changed, the answer would change with it and nothing here would.
 *
 * Pure. Deterministic in the run seed. No I/O, no database, no LLM.
 */

import {
    AMBIENT_QI_RATE_MULTIPLIER,
    AMBIENT_QI_WEIGHTS,
    type AmbientQi
} from '../../schema/cultivation.js';
import { BAND_DENSITY_CENTRE } from '../cultivation/ambient.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import {
    ORIGIN_TIERS,
    openingPosition,
    rollOrigin,
    type OpeningPosition,
    type OriginTier,
    type OriginTierKey
} from '../cultivation/origin.js';
import type { SourceKind, Stance } from '../social/knowledge.js';
import { REGIONS, provinceForFaction } from '../../data/cultivation/regions.js';
import { SECTS, intakeRouteOf, type IntakeRoute } from '../../data/cultivation/sects.js';
import { NO_PLACE_FOR_THEIR_OWN } from '../../data/cultivation/bodies-that-cannot-keep-their-members-children.js';
import { houseFloorsOf } from '../../data/cultivation/the-three-floors-a-house-admits-at.js';
import { housesWithTwoDoors } from './spending-a-word-to-place-a-child.js';

// ─────────────────────────────────────────────────────────────────────────
// THE WORLD A BIRTH IS DRAWN FROM
//
// Passed in rather than reached for, so this module is testable against a
// three-place world and so a caller holding a live world's locations can
// widen the pool without this file learning about the world layer.
// ─────────────────────────────────────────────────────────────────────────

/** Settlement kinds a person is born in. Work faces and burn edges are not. */
export const INHABITED_KINDS: readonly string[] = [
    'hamlet', 'village', 'market_town', 'sect_town', 'city'
];

export interface BirthPlace {
    name: string;
    /** What the ground under it gives in an ordinary month. */
    ground: AmbientQi;
    kind: string;
    regionId: string;
    /** The catalog's own line about the place. Factual, not an assessment. */
    note: string;
}

/**
 * What the world calls the ground a house holds.
 *
 * ONE STRING, TWO WRITERS, AND THEY MUST AGREE. `seedSectGround` in
 * `engine/world/seeding.ts` builds a `sect_seat` location under this name, and
 * a run's `location` is matched against the world's table by name - so a birth
 * that composes it differently opens the run somewhere the world has never
 * heard of, which is the "travelled to Nowhereville" failure with a
 * plausible-looking address. It is derived here rather than imported because
 * this module does not depend on the world layer, and
 * `tests/engine/birth/birth.test.ts` pins the two against each other so the
 * agreement is checked rather than hoped for.
 */
export function seatNameOf(houseName: string): string {
    return `${houseName} grounds`;
}

/** A faction, reduced to the three numbers a birth actually reads. */
export interface BirthHouse {
    id: string;
    name: string;
    /** Realm ordinal of its strongest member. What "standing" means here. */
    powerOrdinal: number;
    /** Its own floor, which being somebody's child does not move. */
    admissionOrdinal: number;
    recruits: boolean;
    /**
     * The `REGIONS` row this house is seated in, or null where the catalog
     * places it nowhere.
     *
     * Here because what an ordinary person has heard of is overwhelmingly a
     * question of where they were standing when they heard it, and until this
     * existed nothing in the birth path could ask it. See
     * {@link commonlyNamedHouses}.
     */
    regionId: string | null;
    /**
     * Whether the house advertises a door below its own membership bar.
     *
     * A house whose intake model is people walking up the mountain needs its
     * name to travel further than its province, or the model does not work -
     * which is why this is read at all. Derived through `housesWithTwoDoors`
     * so there is one authority on which houses have two doors.
     */
    publishesADoorAtTheFloor: boolean;
    /**
     * What kind of roll this house keeps, read off `intakeRouteOf`.
     *
     * `'adoption'` is a roster that is a lineage; `'open'` is one people are
     * admitted to; `'closed'` is a posting nobody joins at all. This is the
     * single fact that decides whether being born to somebody here is
     * membership, and it is a property of what a house IS rather than of which
     * house it is - which is the whole reason it is read rather than listed.
     */
    roster: IntakeRoute;
    /**
     * Whether this house has anywhere to put its own members' children.
     *
     * `NO_PLACE_FOR_THEIR_OWN` names three bodies that do not, for two opposite
     * reasons - a bar that only wants people capable of the last realm, and a
     * posting nobody can be appointed to as a child. A run cannot open as
     * somebody growing up inside one of those, because in the world nobody
     * does: that catalog's whole subject is where those children go instead,
     * which is what `fostered_on_a_word` is.
     */
    keepsItsMembersChildren: boolean;
    /**
     * The ground this house holds, or null where the catalog seats it nowhere.
     *
     * The place a run opens at when the family lives here. The band carried on
     * it is a placeholder: the compound's own vein is the world's to know -
     * `sectGroundDensity` computes it and `ambientFor` asks the world at the
     * moment somebody stands there - so what a birth reports is the floor the
     * family's standing guarantees, filled in at draw time exactly as it is
     * for a settlement.
     */
    seat: BirthPlace | null;
    /**
     * The three floors this house admits at, as they stand. Carried so a birth
     * can report what is still in front of somebody without restating a single
     * admission figure - `the-three-floors-a-house-admits-at.ts` owns all of
     * them.
     */
    floors: { guest: number | null; servant: number | null; disciple: number };
}

export interface BirthWorld {
    places: readonly BirthPlace[];
    houses: readonly BirthHouse[];
}

/** The world as the content catalogs describe it. */
export function catalogBirthWorld(): BirthWorld {
    const places: BirthPlace[] = [];
    for (const region of REGIONS) {
        for (const place of region.places) {
            if (!INHABITED_KINDS.includes(place.kind)) continue;
            places.push({
                name: place.name,
                ground: place.ambient,
                kind: place.kind,
                regionId: region.id,
                note: place.note
            });
        }
    }

    const publishesADoor = new Set(housesWithTwoDoors().map(d => d.factionId));
    const noPlaceForTheirOwn = new Set(NO_PLACE_FOR_THEIR_OWN.map(row => row.factionId));
    const houses: BirthHouse[] = SECTS.map(sect => {
        // The `REGIONS` row, reached through the province the catalog seats the
        // house in. `Province.regionId` is the existing link between the two id
        // spaces and is read rather than restated - `region-low-fall` and
        // `province-low-fall` are different ids for related things and pairing
        // them by hand is how that goes wrong.
        const regionId = provinceForFaction(sect.id)?.regionId ?? null;
        // WHERE THE HOUSE STANDS, WHICH IS A WIDER QUESTION THAN WHICH
        // PREFECTURE HOLDS IT. `provinceForFaction` answers for the 19 houses
        // that sit inside a granted holding and returns null for the other 15 -
        // an apex answers to nobody, an occupation nothing can move, a zone
        // held by a belief. The world seats all 34 anyway, through
        // `REGIONS[].factionIds`, and this reads the same list so that a birth
        // and the world agree about which houses have ground at all.
        const seatRegionId = regionId
            ?? REGIONS.find(r => r.factionIds.includes(sect.id))?.id
            ?? null;
        const floors = houseFloorsOf(sect.id);
        return {
            id: sect.id,
            name: sect.name,
            powerOrdinal: sect.powerOrdinal,
            admissionOrdinal: sect.admissionOrdinal,
            recruits: sect.recruits,
            regionId,
            publishesADoorAtTheFloor: publishesADoor.has(sect.id),
            roster: intakeRouteOf(sect.id) ?? 'closed',
            keepsItsMembersChildren: !noPlaceForTheirOwn.has(sect.id),
            seat: seatRegionId === null ? null : {
                name: seatNameOf(sect.name),
                // Filled in at draw time from the same geology draw every other
                // birth gets, floored by the family's holding. See `seat`.
                ground: 'thin',
                kind: 'sect_seat',
                regionId: seatRegionId,
                note: sect.territory
            },
            floors: {
                guest: floors?.guest ?? null,
                servant: floors?.servant ?? null,
                disciple: floors?.disciple ?? sect.admissionOrdinal
            }
        };
    });

    return { places, houses };
}

// ─────────────────────────────────────────────────────────────────────────
// GROUND
// ─────────────────────────────────────────────────────────────────────────

/**
 * The bands the ground itself can be, and how often.
 *
 * Taken from the schema's own ambient weights with the two bands that are not
 * geology removed: `spirit_tide` is somebody finishing rather than a property
 * of a place, and `sealed_vein` carries weight zero everywhere for the reason
 * origin.ts gives - a family can put a child on good ground and cannot put
 * them on a pocket nobody has drawn on, because that has to be walked into.
 *
 * Derived rather than retyped, so a change to the schema's distribution moves
 * this with it.
 */
export const GEOLOGY_WEIGHTS: Record<'thin' | 'normal' | 'dense', number> = {
    thin: AMBIENT_QI_WEIGHTS.thin,
    normal: AMBIENT_QI_WEIGHTS.normal,
    dense: AMBIENT_QI_WEIGHTS.dense
};

/** The richer of two bands, ordered by what they are actually worth. */
export function betterGround(a: AmbientQi, b: AmbientQi): AmbientQi {
    return AMBIENT_QI_RATE_MULTIPLIER[b] > AMBIENT_QI_RATE_MULTIPLIER[a] ? b : a;
}

/**
 * Usable density of a band, 0..1, for `ambientForBlock`'s `density` option.
 *
 * The web layer currently lets the engine GUESS a place's density from its
 * name, which is a stable guess and a wrong one: the catalog says Nine Peaks
 * stands on the deepest vein anyone has kept, and an implied density does not
 * know that. Handing this to the ambient roll is what makes the ground a birth
 * was placed on the ground it is actually cultivated on.
 */
export function densityForBand(band: AmbientQi): number {
    if (band === 'dense' || band === 'spirit_tide' || band === 'sealed_vein') {
        return BAND_DENSITY_CENTRE.dense;
    }
    if (band === 'normal') return BAND_DENSITY_CENTRE.normal;
    return BAND_DENSITY_CENTRE.thin;
}

/**
 * The density of a named place, or null where the catalog has never heard of
 * it. Null means "carry on guessing", which is what every caller did before.
 */
export function groundDensityFor(
    place: string,
    world: BirthWorld = catalogBirthWorld()
): number | null {
    const wanted = place.trim().toLowerCase();
    const found = world.places.find(p => p.name.toLowerCase() === wanted);
    return found ? densityForBand(found.ground) : null;
}

/**
 * Places standing on this band, or on the nearest band the world actually has.
 *
 * The fallback matters: a world with no dense settlement must not make a
 * dense draw throw, and it must not silently drop the birth onto thin ground
 * either. It resolves upward first, because the draw is a FLOOR.
 */
function placesOnBand(places: readonly BirthPlace[], band: AmbientQi): BirthPlace[] {
    const exact = places.filter(p => p.ground === band);
    if (exact.length > 0) return exact;

    const wanted = AMBIENT_QI_RATE_MULTIPLIER[band];
    const above = places.filter(p => AMBIENT_QI_RATE_MULTIPLIER[p.ground] > wanted);
    const pool = above.length > 0 ? above : places.slice();
    if (pool.length === 0) return [];

    // The closest band in the direction we were forced to move.
    const best = above.length > 0
        ? Math.min(...pool.map(p => AMBIENT_QI_RATE_MULTIPLIER[p.ground]))
        : Math.max(...pool.map(p => AMBIENT_QI_RATE_MULTIPLIER[p.ground]));
    return pool.filter(p => AMBIENT_QI_RATE_MULTIPLIER[p.ground] === best);
}

// ─────────────────────────────────────────────────────────────────────────
// THE HOUSE A FAMILY BELONGS TO
// ─────────────────────────────────────────────────────────────────────────

/**
 * The standing band a tier's own house sits in.
 *
 * ── THIS USED TO READ `placement.reach` AND IT WAS WRONG BOTH WAYS ───────
 *
 * The old rule was "a family's word reaches as far as the house they belong
 * to", so the band ran from `reach` upward. Measured over 200 forced births per
 * tier:
 *
 *   `dao_house_bloodline` reaches 38 and drew from {Azure Cloud Pavilion,
 *   Hollow Court, the Severed}. The seven Dao houses stand at 29 to 35, so a
 *   tier whose name is "A Dao house, by blood" drew a Dao house ZERO times, and
 *   was instead born under the one house in the world that will not move a bar
 *   for anybody.
 *
 *   `apex_sect_members_child` reaches 29 - deliberately, because its own row
 *   says an apex will not lend its name to a placement - and drew from a
 *   sixteen-house band containing no apex.
 *
 * So `reach` is what a family's WORD reaches and `familyHouse.standingFrom` is
 * what the family IS. The band now runs between the standings the table itself
 * declares, and every number still comes from `ORIGIN_TIERS`.
 *
 * Null where the family belongs to nobody, which is nine births in ten.
 */
export function houseBandFor(tier: OriginTier): { from: number; to: number } | null {
    const family = tier.familyHouse;
    if (!family) return null;
    const from = family.standingFrom;
    const above = ORIGIN_TIERS
        .map(t => t.familyHouse?.standingFrom)
        .filter((standing): standing is number => standing !== undefined && standing > from);
    return { from, to: above.length > 0 ? Math.min(...above) : Number.POSITIVE_INFINITY };
}

/**
 * Houses this family could be the family of. Empty where it belongs to nobody.
 *
 * Three conditions, and none of them names a faction:
 *
 *   1. The house stands in the family's own band.
 *   2. Its roll is of the kind the family keeps - a lineage is not an intake,
 *      and a body nobody joins at all is neither.
 *   3. It has somewhere to put its own members' children. Three bodies do not,
 *      and the catalog that says so also says where those children go instead.
 */
export function housesAtStanding(
    tier: OriginTier,
    houses: readonly BirthHouse[]
): BirthHouse[] {
    const family = tier.familyHouse;
    const band = houseBandFor(tier);
    if (!family || !band) return [];

    const couldRaiseThem = (h: BirthHouse): boolean =>
        h.keepsItsMembersChildren
        && h.roster === (family.roster === 'a lineage' ? 'adoption' : 'open');

    const inBand = houses.filter(
        h => couldRaiseThem(h) && h.powerOrdinal >= band.from && h.powerOrdinal < band.to
    );
    // A band the catalog cannot fill falls back to everything above the floor,
    // so a trimmed catalog produces a weaker house rather than no house at all.
    return inBand.length > 0
        ? inBand
        : houses.filter(h => couldRaiseThem(h) && h.powerOrdinal >= band.from);
}

/**
 * Houses whose names get said at home.
 *
 * Exactly what the family's word reaches, which is the number origin.ts
 * already defines and this module does not get to reinterpret. A house above
 * that line is a name this person has genuinely never heard, and travel and
 * application will refuse it until somebody says it to them.
 */
export function housesWithinEarshot(
    tier: OriginTier,
    houses: readonly BirthHouse[]
): BirthHouse[] {
    const reach = tier.placement.reach;
    if (reach <= 0) return [];
    return houses.filter(h => h.powerOrdinal <= reach);
}

/**
 * The houses a person with no standing at all would have heard mentioned.
 *
 * ── WHAT THIS USED TO BE, AND WHY IT WAS THE WHOLE OPENING PROBLEM ───────
 *
 * `commonlyNamedHouse`, singular: the lowest bar among recruiters, tie-broken
 * by id. Measured, that is a much worse rule than it reads as:
 *
 *   - Thirteen houses in the catalog admit at rung 2 or below and SEVEN OF
 *     THEM ARE TIED AT ZERO. The tie-break is alphabetical on the faction id,
 *     so `sect-azure-dew-sect` won on the letter A and the other six were
 *     unreachable to every player in every run, permanently.
 *   - It scanned the whole world and returned a global minimum, so a child
 *     born in the Quiet Marches was told the name of a house in the Low Fall
 *     and none of the three standing around them.
 *   - The three lowest origin tiers have `placement.reach` of 0 or 12 and
 *     `housesWithinEarshot` returns nothing for any of them, so for nine
 *     births in ten this single name was the ENTIRE roll of houses a life
 *     began with.
 *
 * Played, that is a new cultivator who can name one door, in a world with
 * thirteen open ones. The doors were never the problem; being able to see
 * them was.
 *
 * ── THE RULE NOW, AND IT IS STILL ONE SENTENCE ───────────────────────────
 *
 * What everybody in the county says is the name of the houses that would take
 * anybody, HERE. Two clauses:
 *
 *   IN YOUR OWN REGION, at a bar somebody with no cultivation already meets.
 *   This is ordinary local knowledge and it is the same claim the county layer
 *   already makes about settlements - you can point at the next town, and you
 *   can name the order that takes people from it.
 *
 *   PLUS ANY HOUSE THAT PUBLISHES A DOOR AT THE FLOOR, wherever it is seated,
 *   because a house whose entire intake is people walking up the mountain
 *   needs its name to travel further than its province or the intake does not
 *   work. That is not a favour to the player; it is the only way that house's
 *   own model is coherent.
 *
 * Nothing is invented and nothing is enumerated: a house that wants to be on
 * this list lowers its bar or publishes a door, and a region with neither
 * produces the fallback below.
 *
 * Still at the lowest stance the knowledge layer has - what everyone says and
 * nobody has checked - so this is a set of names to walk towards rather than
 * an introduction to anybody.
 */
export function commonlyNamedHouses(
    houses: readonly BirthHouse[],
    regionId: string | null
): BirthHouse[] {
    const recruiting = houses.filter(h => h.recruits);

    // ── LOCAL ONLY, AND THAT IS A RULING RATHER THAN A SIMPLIFICATION ────
    //
    // A first draft also named every house that publishes a door at the floor,
    // wherever it was seated, on the reasoning that an intake of "people walk
    // up the mountain" needs the name to travel. `docs/world/houses/origin.md` says
    // otherwise, in terms specific enough that it is clearly deliberate: the
    // Pavilion's standing "sits above what any family's name reaches, so
    // nobody is ever placed there - a child of the strongest house alive has
    // not heard it named at home." A test asserts it.
    //
    // So the cross-region clause is gone and the rule is one clause. Where such
    // a house is seated in your own region it still appears, on the same
    // footing as any other open door - which is the case the owner's ruling is
    // about, and it arrives without a special case.
    const nearby = regionId === null
        ? []
        : recruiting.filter(h => h.regionId === regionId && h.admissionOrdinal <= 0);

    if (nearby.length > 0) return dedupeById(nearby);

    // A region with no open door of its own. Rather than leaving somebody with
    // nothing, fall back to the world's floor - which is what the old rule
    // always did, for everybody, and is correct as a floor and wrong as the
    // whole answer.
    const lowest = recruiting.reduce<number | null>(
        (best, h) => best === null || h.admissionOrdinal < best ? h.admissionOrdinal : best,
        null
    );
    if (lowest === null) return [];
    return dedupeById(recruiting.filter(h => h.admissionOrdinal === lowest));
}

function dedupeById(houses: readonly BirthHouse[]): BirthHouse[] {
    const seen = new Set<string>();
    const out: BirthHouse[] = [];
    for (const h of houses) {
        if (seen.has(h.id)) continue;
        seen.add(h.id);
        out.push(h);
    }
    return out.sort((a, b) => a.admissionOrdinal - b.admissionOrdinal || a.id.localeCompare(b.id));
}

// ─────────────────────────────────────────────────────────────────────────
// THE DRAW
// ─────────────────────────────────────────────────────────────────────────

/**
 * One name this person starts out having heard.
 *
 * Shaped as the web layer's awareness input minus the holder and the day, so
 * seeding is a spread rather than a translation. This module knows nothing
 * about where the rows are stored.
 */
export interface BirthKnowledge {
    kind: 'place' | 'sect';
    id: string;
    name: string;
    stance: Stance;
    sourceKind: SourceKind;
    sourceNote: string;
    statement: string;
    confidence: number;
}

/**
 * Somebody who grew up inside a house rather than near one.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A CHILD BORN TO THE LINE IS NONE OF THE THREE FLOORS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `the-three-floors-a-house-admits-at.ts` says a house admits at guest,
 * servant and disciple. All three are things somebody OUTSIDE clears to get
 * IN. A person born inside was never outside and has cleared nothing, so they
 * hold none of the three - and the honest consequence is that they hold no rung
 * either.
 *
 * That is the whole design and it is a small one: BEING ON A ROLL AND BEING ON
 * A RUNG ARE DIFFERENT FACTS. The roll says whose the house considers you. The
 * rung says what you have done. `Cultivator` already carries both separately
 * and already prints the state - `entities.ts` has "at the rank of X" against
 * "at no rank in it" - so nothing new is stored anywhere to say this.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * AND IT MUST NOT SKIP A BAR SOMEBODY ELSE HAS TO CLEAR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * {@link stillToClear} is the check, carried on the object rather than left to
 * a reader: it is the house's own floors, unmodified, at the moment the run
 * opens, when the cultivator stands at ordinal zero. A born member of the Azure
 * Cloud Pavilion is at 0 against a probation door at 0 and a disciple bar at 3,
 * which is precisely what somebody who walked up the mountain this morning is
 * standing in front of. The Pavilion says the same words to both of them.
 *
 * The one route that does move a bar is `'by taking'`, and it moves it the way
 * the mechanic already says it does: somebody spent a word, and
 * `spending-a-word-to-place-a-child.ts` writes the obligation they now carry
 * for it. A skipped bar with a receipt is the mechanic working.
 */
export interface RaisedInside {
    house: BirthHouse;
    /**
     * How the house's roll carries them, or null where it does not.
     *
     * `'by blood'` and `'by taking'` are the SAME for membership, standing, the
     * name they answer to and the ladder in front of them, and different for
     * the line: an adopted child holds the name and not the blood. The world
     * writes a lineage edge and does not write the surname, so a person can
     * inherit a grudge from somebody they cannot name - and, once they are
     * consequential enough that anyone bothers to read a record, be found to
     * have been somebody's all along.
     */
    onTheRoll: 'by blood' | 'by taking' | null;
    /**
     * Every floor of this house that is still above the person standing here.
     *
     * Empty means the house takes anybody at the floor and there was nothing to
     * clear in the first place. It is NEVER shortened by being born inside, and
     * the test for this change is that it is not.
     */
    stillToClear: readonly { door: 'guest' | 'servant' | 'disciple'; ordinal: number }[];
    /**
     * Whether a word was spent to put them here, and therefore whether somebody
     * in the world is carrying an obligation for it.
     *
     * False for a child of the line, who needed nobody. False at a house whose
     * door already stands at the floor, which is the one placement in the world
     * where nobody is carrying a debt - there was nothing to buy, so nothing was
     * bought. True everywhere else a house took somebody in.
     */
    somebodyIsOwedForIt: boolean;
}

export interface Birth {
    origin: OriginTierKey;
    /** The factual account of what the birth was worth. No assessment. */
    opening: OpeningPosition;
    /** Where the run opens. */
    place: BirthPlace;
    /** The band under that place. At or above the family's floor, always. */
    ground: AmbientQi;
    /** That band as a density, for the ambient roll. */
    density: number;
    /** The tier's own figure, unchanged. */
    spiritStones: number;
    /** The house the family belongs to, or null for nine births in ten. */
    house: BirthHouse | null;
    /**
     * What growing up inside that house made them, or null where the family
     * lives near a house rather than in it, and null for the nine births in ten
     * with no house at all.
     */
    raisedInside: RaisedInside | null;
    /** Rows to seed. Nothing outside this list has been heard of. */
    knowledge: readonly BirthKnowledge[];
}

export interface DrawBirthOptions {
    world?: BirthWorld;
    /**
     * Force a tier. For tests and for a deliberate replay only - a run draws
     * its birth the same way it draws its spirit root, and neither the player
     * nor the narrator gets to ask for one.
     */
    origin?: OriginTierKey;
}

/**
 * Draw a birth from the run seed.
 *
 * Four named sub-streams, none of which consumes from another, so adding one
 * later cannot perturb a seed that has already been played - the same
 * discipline `rollTalent` states for the origin stream it added.
 */
export function drawBirth(seed: string, opts: DrawBirthOptions = {}): Birth {
    const world = opts.world ?? catalogBirthWorld();
    const tier = opts.origin
        ? requireTier(opts.origin)
        : rollOrigin(forStream(seed, 'creation', 'origin').next());

    // Where this life happens to be, drawn from the world's own distribution
    // with the family's holding as a floor under it. This is the same shape
    // `origin-odds.ts` measures, and it is what keeps a good birth from being
    // a band nobody else can reach: half the world is thin and one life in
    // twenty is standing on something good, whoever their parents were.
    const groundRng: CultivationRNG = forStream(seed, 'creation', 'birth-ground');
    const ground = betterGround(groundRng.weighted(GEOLOGY_WEIGHTS), tier.ground);

    const atStanding = housesAtStanding(tier, world.houses);
    const house = atStanding.length > 0
        ? forStream(seed, 'creation', 'birth-house').pick(atStanding)
        : null;

    // ── WHERE THE RUN OPENS ──────────────────────────────────────────────
    //
    // At the house, when the family belongs to one. This is the gap the
    // package README listed in its own words - "A birth house has no seat to be
    // born at ... the house a family belongs to does not currently decide where
    // the run opens. Both are drawn, and they can disagree" - and it was
    // measured before it was fixed: 400 births landed 147 in a city, 112 in a
    // market town, 77 in a village, 43 in a sect TOWN and 21 in a hamlet, and
    // NOT ONE of them at any of the 34 sect seats the world builds. A sect town
    // is a town beside a house. It is not the house.
    //
    // A settlement otherwise, drawn from the world's own distribution with the
    // family's holding as a floor under it - unchanged, and it is what nine
    // births in ten still get, along with every family that has a hall of its
    // own. A cultivating clan holds its own vein and is not somebody's tenant;
    // the house on its row is one it is attached to, not one it is in.
    const seat = tier.familyHouse?.whereTheyLive === 'inside it'
        ? house?.seat ?? null
        : null;
    let place: BirthPlace;
    if (seat) {
        // The band is the same draw everybody else gets. The compound's own
        // vein is the world's to know and `ambientFor` asks it at the moment
        // somebody stands here; what a birth may report is the floor the
        // family's standing guarantees, and `MAX_ORIGIN_AMBIENT` still bounds
        // that floor at ordinary ground.
        place = { ...seat, ground };
    } else {
        const candidates = placesOnBand(world.places, ground);
        if (candidates.length === 0) {
            throw new Error('drawBirth: the world has nowhere anybody could be born');
        }
        place = forStream(seed, 'creation', 'birth-place').pick(candidates);
    }

    const inside = seat && house ? raisedInside(tier, house) : null;

    return {
        origin: tier.key,
        opening: openingPosition(tier.key),
        place,
        // The place is the authority once it has been chosen. A draw that had
        // to fall back to a band the world does not have must report the
        // ground somebody is actually standing on, not the one it wanted.
        ground: place.ground,
        density: densityForBand(place.ground),
        spiritStones: tier.spiritStones,
        house,
        raisedInside: inside,
        knowledge: seedKnowledge(tier, world, place, house, inside)
    };
}

/**
 * What growing up inside this house made somebody, at the moment a run opens.
 *
 * No branch on a tier key and no branch on a faction id. The route comes from
 * the table's own `familyHouse.onTheRoll`; what is still in front of them comes
 * from the house's own floors; and whether anybody is owed for it comes from
 * whether there was a bar to skip at all.
 */
function raisedInside(tier: OriginTier, house: BirthHouse): RaisedInside {
    const onTheRoll = tier.familyHouse?.onTheRoll ?? null;

    // A cultivator at ordinal zero, on the day the run opens, against the
    // house's own floors as they stand. Nothing here subtracts anything.
    const doors: { door: 'guest' | 'servant' | 'disciple'; ordinal: number }[] = [];
    const { guest, servant, disciple } = house.floors;
    if (guest !== null && guest > OPENS_AT_ORDINAL) doors.push({ door: 'guest', ordinal: guest });
    if (servant !== null && servant > OPENS_AT_ORDINAL) doors.push({ door: 'servant', ordinal: servant });
    if (disciple > OPENS_AT_ORDINAL) doors.push({ door: 'disciple', ordinal: disciple });

    // The lowest way in, which is what a word would have had to buy. Where it
    // is already at the floor there was nothing to buy, and nobody is carrying
    // a debt for a door that was open - which is the Azure Cloud Pavilion's
    // whole position, arriving here without being written down about it.
    const lowestDoor = Math.min(
        house.floors.guest ?? Number.POSITIVE_INFINITY,
        house.floors.servant ?? Number.POSITIVE_INFINITY,
        house.floors.disciple
    );

    return {
        house,
        onTheRoll,
        stillToClear: doors,
        somebodyIsOwedForIt: onTheRoll === 'by taking' && lowestDoor > OPENS_AT_ORDINAL
    };
}

/**
 * The ordinal a run opens at. Zero, for everybody, forever.
 *
 * Named rather than written as a literal because it is the thing every bar on
 * this page is being compared against, and a birth that opened at anything else
 * would be the failure this whole module exists to prevent.
 */
const OPENS_AT_ORDINAL = 0;

function requireTier(key: OriginTierKey): OriginTier {
    const tier = ORIGIN_TIERS.find(t => t.key === key);
    if (!tier) throw new Error(`Unknown origin tier: ${key}`);
    return tier;
}

/**
 * What this person has heard of on the day the run opens.
 *
 * The knowledge gate is already the thing that decides whether a name can be
 * travelled to, applied to or spoken, and it is well liked for it. So an
 * origin does not get a special case there: it seeds ordinary rows, and every
 * difference between a farm child's world and a court child's falls out of how
 * many rows each of them got.
 *
 * The gate is `placement.reach` and nothing else. A house above the family's
 * reach is a name they have never heard, which is why a child of the strongest
 * house in the world still cannot name the one house above it unless they were
 * born inside it.
 */
/**
 * What the house they grew up in is to them, said without naming a rank.
 *
 * Three sentences for three routes, and each of them is careful about the same
 * thing: the roll and the ladder are different facts, and the second one has
 * not been touched. "On the roll at no rank in it" is not a hedge - it is the
 * state, and `entities.ts` already prints it in those words for anybody.
 */
function whatTheHouseIsToThem(house: BirthHouse, inside: RaisedInside | null): string {
    if (!inside) return `${house.name} is the house their family belongs to.`;
    if (inside.onTheRoll === 'by blood') {
        return `${house.name} is the house they were born into. Its roll is its own family and `
            + 'they are on it, at no rank in it, with the whole of its ladder still above them.';
    }
    if (inside.onTheRoll === 'by taking') {
        return `${house.name} is the house that raised them. Its roll carries them, at no rank `
            + 'in it, and how they came to be on it was never explained to them.';
    }
    return `${house.name} is the house their family belongs to. They grew up inside its walls `
        + 'and are not on its roll, and its own door is where they would have to start.';
}

function seedKnowledge(
    tier: OriginTier,
    world: BirthWorld,
    place: BirthPlace,
    house: BirthHouse | null,
    inside: RaisedInside | null
): BirthKnowledge[] {
    const rows: BirthKnowledge[] = [];
    const seen = new Set<string>();
    const add = (row: BirthKnowledge): void => {
        const key = `${row.kind}:${row.id.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push(row);
    };

    add({
        kind: 'place',
        id: place.name,
        name: place.name,
        stance: 'knows',
        sourceKind: 'witnessed',
        sourceNote: 'Where they grew up.',
        statement: `${place.name} is where they are from.`,
        confidence: 1
    });

    if (house) {
        add({
            kind: 'sect',
            id: house.id,
            name: house.name,
            stance: 'knows',
            sourceKind: 'witnessed',
            sourceNote: 'The house the family belongs to.',
            // Never a rank, in any of the three cases. Being on a roll and
            // being on a rung are different facts and only the first of them
            // can be inherited.
            statement: whatTheHouseIsToThem(house, inside),
            confidence: 1
        });
    }

    // ── THE PROVINCE, WHERE THE COUNTY LAYER CANNOT SUPPLY IT ────────────
    //
    // `seedStartingAwareness` in the web layer names the province a home is in,
    // and it finds it through `regionOfPlace`, which matches a name against
    // `REGIONS[].places`. A house's ground is not in that table - it is built
    // by the world seeder - so for a birth inside a house that call contributes
    // nothing at all, and somebody born in a compound would not be able to name
    // the province it stands in. That is the "trapped in your birthplace"
    // defect the county layer exists to fix, arriving through a new door.
    //
    // Written here rather than by widening `regionOfPlace`, because a seat is a
    // place the world owns and this module is not entitled to teach the lore
    // table about it.
    if (inside) {
        const region = REGIONS.find(r => r.id === place.regionId);
        if (region) {
            add({
                kind: 'place',
                id: region.name,
                name: region.name,
                stance: 'believes',
                sourceKind: 'told',
                sourceNote: 'The province the house stands in. Everybody inside it knows its name.',
                statement: `${region.name} is the province ${place.name} is in.`,
                confidence: 0.6
            });
        }
    }

    // Everything the family's word reaches has been named in front of them at
    // some point. For nine births in ten the reach is zero and this is empty.
    for (const within of housesWithinEarshot(tier, world.houses)) {
        add({
            kind: 'sect',
            id: within.id,
            name: within.name,
            stance: 'believes',
            sourceKind: 'told',
            sourceNote: 'A name said at home. The family corresponds this far.',
            statement: `${within.name} exists, and the family's name is known to it.`,
            confidence: 0.6
        });
    }

    // A family with any standing at all has business outside its own valley,
    // and its children have heard the province named. A family with none has
    // not, which is the whole of the difference.
    if (tier.placement.reach > 0) {
        for (const near of world.places) {
            if (near.regionId !== place.regionId) continue;
            add({
                kind: 'place',
                id: near.name,
                name: near.name,
                stance: 'believes',
                sourceKind: 'told',
                sourceNote: 'Somewhere the family has business.',
                statement: `${near.name} exists and can be travelled to.`,
                confidence: 0.6
            });
        }
    }

    // And the one name everybody in the county says, whoever they are. Last,
    // so it is a duplicate rather than a demotion for anyone who already holds
    // it at a firmer stance.
    for (const common of commonlyNamedHouses(world.houses, place.regionId)) {
        add({
            kind: 'sect',
            id: common.id,
            name: common.name,
            stance: 'believes',
            sourceKind: 'told',
            sourceNote: 'What everyone in the county says. Nobody has checked.',
            statement: common.publishesADoorAtTheFloor
                ? `${common.name} takes anybody who walks up, tests them, and spends years `
                  + 'finding out what they are. Everyone has heard that and nobody local has done it.'
                : `${common.name} exists somewhere out there and takes disciples.`,
            confidence: 0.5
        });
    }

    return rows;
}

// ─────────────────────────────────────────────────────────────────────────
// REPORTING IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The engine's own factual line about the opening position.
 *
 * States what was dealt and stops. It does not say whether it is good, because
 * the world does not know either - and it names no rank, because there is not
 * one to name.
 */
/**
 * Whose they are, and what is still in front of them.
 *
 * The second half is not decoration. A line that says somebody is on an apex's
 * roll and stops there reads as a head start, and it would be the softening
 * this module is built to refuse - so the bars come with it, in the same
 * sentence, every time.
 */
function whoTheyAre(birth: Birth): string {
    const inside = birth.raisedInside;
    if (!inside) {
        return birth.house
            ? `${birth.opening.name}; the family belongs to ${birth.house.name}, `
              + 'which is not a rank and not an admission.'
            : `${birth.opening.name}.`;
    }

    const bars = inside.stillToClear.length === 0
        ? `${inside.house.name} takes anybody who walks up, and always has.`
        : 'Still to clear: ' + inside.stillToClear
            .map(d => `${d.door} at ${d.ordinal}`).join(', ') + '.';

    if (inside.onTheRoll === 'by blood') {
        return `${birth.opening.name}; on ${inside.house.name}'s roll from birth because its `
            + `roll is its family, at no rank in it. ${bars}`;
    }
    if (inside.onTheRoll === 'by taking') {
        return `${birth.opening.name}; on ${inside.house.name}'s roll because it took them in, `
            + `at no rank in it, and nobody has told them why. ${bars}`;
    }
    return `${birth.opening.name}; grew up inside ${inside.house.name} and is not on its roll. `
        + bars;
}

export function describeBirth(birth: Birth): string {
    const where =
        `Born in ${birth.place.name}, a ${birth.place.kind.replace(/_/g, ' ')} ` +
        `on ${birth.ground.replace(/_/g, ' ')} ground.`;
    const who = whoTheyAre(birth);
    const years = birth.opening.provisionedYears;
    const purse =
        `${birth.spiritStones} spirit stones, ` +
        (years < 1
            ? 'under a year of seclusion.'
            : `about ${Math.round(years)} years of seclusion.`);
    const names = `${birth.knowledge.length} name${birth.knowledge.length === 1 ? '' : 's'} known.`;
    return `${where} ${who} ${purse} ${names}`;
}
