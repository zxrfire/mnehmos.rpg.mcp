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
 *   a place        drawn from the world's own settlements, with the family's
 *                  holding as a FLOOR under the ground and never a band
 *                  nobody else can reach
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
 * So {@link Birth} carries no realm ordinal, no cultivation progress, no sect
 * id, no sect rank, no foundation and no insight, and there is deliberately no
 * field on it that could. A patriarch's child and a Hollow Court Seat's child
 * both open at ordinal zero, unattached, in the outer world like everybody
 * else. What they have is a better address, a heavier purse, and a longer list
 * of names they have heard said at home.
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
import { SECTS } from '../../data/cultivation/sects.js';
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
    const houses: BirthHouse[] = SECTS.map(sect => ({
        id: sect.id,
        name: sect.name,
        powerOrdinal: sect.powerOrdinal,
        admissionOrdinal: sect.admissionOrdinal,
        recruits: sect.recruits,
        // The `REGIONS` row, reached through the province the catalog seats the
        // house in. `Province.regionId` is the existing link between the two id
        // spaces and is read rather than restated - `region-low-fall` and
        // `province-low-fall` are different ids for related things and pairing
        // them by hand is how that goes wrong.
        regionId: provinceForFaction(sect.id)?.regionId ?? null,
        publishesADoorAtTheFloor: publishesADoor.has(sect.id)
    }));

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
 * A family's `placement.reach` is the strongest house their word reaches. The
 * house they actually belong to is one at that standing - so the band runs
 * from their reach up to the next tier's reach, and the top tier's band is
 * open at the top because there is nothing above it to bound against.
 *
 * Every number here comes from `ORIGIN_TIERS`. There is no constant of this
 * module's own, which is what stops the bands drifting away from the table
 * that defines them.
 */
export function houseBandFor(tier: OriginTier): { from: number; to: number } {
    const from = tier.placement.reach;
    const above = ORIGIN_TIERS
        .map(t => t.placement.reach)
        .filter(reach => reach > from);
    return { from, to: above.length > 0 ? Math.min(...above) : Number.POSITIVE_INFINITY };
}

/** Houses at this tier's own standing. Empty for a family with no standing. */
export function housesAtStanding(
    tier: OriginTier,
    houses: readonly BirthHouse[]
): BirthHouse[] {
    if (tier.placement.reach <= 0) return [];
    const band = houseBandFor(tier);
    const inBand = houses.filter(
        h => h.powerOrdinal >= band.from && h.powerOrdinal < band.to
    );
    // A band the catalog cannot fill falls back to everything above the floor,
    // so a trimmed catalog produces a weaker house rather than no house at all.
    return inBand.length > 0
        ? inBand
        : houses.filter(h => h.powerOrdinal >= band.from);
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

    const candidates = placesOnBand(world.places, ground);
    if (candidates.length === 0) {
        throw new Error('drawBirth: the world has nowhere anybody could be born');
    }
    const place = forStream(seed, 'creation', 'birth-place').pick(candidates);

    const atStanding = housesAtStanding(tier, world.houses);
    const house = atStanding.length > 0
        ? forStream(seed, 'creation', 'birth-house').pick(atStanding)
        : null;

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
        knowledge: seedKnowledge(tier, world, place, house)
    };
}

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
function seedKnowledge(
    tier: OriginTier,
    world: BirthWorld,
    place: BirthPlace,
    house: BirthHouse | null
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
            // Deliberately not "they are a member". They are somebody's child,
            // which is not a rank and confers no admission anywhere.
            statement: `${house.name} is the house their family belongs to.`,
            confidence: 1
        });
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
export function describeBirth(birth: Birth): string {
    const where =
        `Born in ${birth.place.name}, a ${birth.place.kind.replace(/_/g, ' ')} ` +
        `on ${birth.ground.replace(/_/g, ' ')} ground.`;
    const who = birth.house
        ? `${birth.opening.name}; the family belongs to ${birth.house.name}, ` +
          'which is not a rank and not an admission.'
        : `${birth.opening.name}.`;
    const years = birth.opening.provisionedYears;
    const purse =
        `${birth.spiritStones} spirit stones, ` +
        (years < 1
            ? 'under a year of seclusion.'
            : `about ${Math.round(years)} years of seclusion.`);
    const names = `${birth.knowledge.length} name${birth.knowledge.length === 1 ? '' : 's'} known.`;
    return `${where} ${who} ${purse} ${names}`;
}
