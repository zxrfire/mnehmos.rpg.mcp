/**
 * Birth - where a run opens, and whose child it opens as. Draws an origin from
 * the frozen tier weights and turns it into ordinary starting values: a place, a
 * purse, a house, and some names heard at home.
 *
 * THE LINE THIS MODULE MUST NOT CROSS, inherited from origin.ts without
 * softening: *"Placement is a rate multiplier and a ceiling that is the house's
 * rather than the province's. NEVER A RANK, NEVER ADMISSION."* So {@link Birth}
 * carries no ordinal, progress, rank index, foundation or insight, and there is
 * deliberately no field on it that could.
 *
 * {@link RaisedInside} is MEMBERSHIP and is not a rank: being on a roll and
 * being on a rung are different facts. Running the two together cost measurably
 * - over 400 births, not one landed on any of the 34 sect seats the world
 * builds, and no birth carried a house membership of any kind.
 *
 * There is no branch on a tier key anywhere in this file and there must never be
 * one. Pure. Deterministic in the run seed.
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

// THE WORLD A BIRTH IS DRAWN FROM
//
// Passed in rather than reached for, so this module is testable against a
// three-place world and so a caller holding a live world's locations can
// widen the pool without this file learning about the world layer.

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
 * `engine/world/seeding.ts` builds a `sect_seat` location under this name and a
 * run's `location` is matched by name, so a birth that composes it differently
 * opens the run somewhere the world has never heard of.
 * `tests/engine/birth/birth.test.ts` pins the two against each other.
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
     * The `REGIONS` row this house is seated in, or null where the catalog places
     * it nowhere.
     */
    regionId: string | null;
    /**
     * Whether the house advertises a door below its own membership bar.
     */
    publishesADoorAtTheFloor: boolean;
    /**
     * What kind of roll this house keeps, read off `intakeRouteOf`.
     */
    roster: IntakeRoute;
    /**
     * Whether this house has anywhere to put its own members' children.
     */
    keepsItsMembersChildren: boolean;
    /**
     * The ground this house holds, or null where the catalog seats it nowhere.
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

// GROUND

/**
 * The bands the ground itself can be, and how often.
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
 * The fallback matters: a world with no dense settlement must not make a dense
 * draw throw and must not silently drop the birth onto thin ground either. It
 * resolves upward first, because the draw is a FLOOR.
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

// THE HOUSE A FAMILY BELONGS TO

/**
 * The standing band a tier's own house sits in.
 *
 * This used to read `placement.reach` and it was wrong both ways. Measured over
 * 200 forced births per tier: `dao_house_bloodline` reaches 38 and drew {Azure
 * Cloud Pavilion, Hollow Court, the Severed} - the seven Dao houses stand at 29
 * to 35, so a tier named "A Dao house, by blood" drew a Dao house ZERO times;
 * `apex_sect_members_child` reaches 29 and drew from a sixteen-house band
 * containing no apex. `reach` is what a family's WORD reaches;
 * `familyHouse.standingFrom` is what the family IS.
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
 * Houses whose names get said at home. Exactly what the family's word reaches,
 * which is origin.ts's number and not this module's to reinterpret.
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
 * This was `commonlyNamedHouse`, singular - the lowest bar among recruiters,
 * tie-broken by id - and measured that is far worse than it reads. Thirteen
 * houses admit at rung 2 or below and SEVEN ARE TIED AT ZERO, so the
 * alphabetical tie-break made `sect-azure-dew-sect` the winner and the other six
 * permanently unreachable in every run; it returned a global minimum, so a child
 * in the Silent Cliffs was told the name of a house in the Jade Gorge; and for
 * nine births in ten it was the ENTIRE roll a life began with.
 *
 * Now: houses that would take anybody HERE (own region, at a bar somebody with
 * no cultivation already meets), plus any house that publishes a door at the
 * floor wherever it is seated, because a house whose intake is people walking up
 * the mountain needs its name to travel further than its province. Nothing is
 * enumerated - a house that wants to be on this list lowers its bar.
 */
export function commonlyNamedHouses(
    houses: readonly BirthHouse[],
    regionId: string | null
): BirthHouse[] {
    const recruiting = houses.filter(h => h.recruits);

    // LOCAL ONLY, AND THAT IS A RULING RATHER THAN A SIMPLIFICATION
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

// THE DRAW

/**
 * One name this person starts out having heard.
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
 * A CHILD BORN TO THE LINE IS NONE OF THE THREE FLOORS. Guest, servant and
 * disciple are all things somebody OUTSIDE clears to get IN; a person born
 * inside was never outside and holds no rung either. Being on a roll and being
 * on a rung are different facts, and `Cultivator` already carries both.
 *
 * AND IT MUST NOT SKIP A BAR SOMEBODY ELSE HAS TO CLEAR. {@link stillToClear} is
 * the house's own floors, unmodified, at ordinal zero. The one route that moves
 * a bar is `'by taking'`, and `spending-a-word-to-place-a-child.ts` writes the
 * obligation carried for it.
 */
export interface RaisedInside {
    house: BirthHouse;
    /**
     * How the house's roll carries them, or null where it does not.
     */
    onTheRoll: 'by blood' | 'by taking' | null;
/**
 * Every floor of this house that is still above the person standing here. Empty
 * means the house takes anybody at the floor. It is NEVER shortened by being
 * born inside, and the test for this change is that it is not.
 */
    stillToClear: readonly { door: 'guest' | 'servant' | 'disciple'; ordinal: number }[];
    /**
     * Whether a word was spent to put them here, and therefore whether somebody in
     * the world is carrying an obligation for it.
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
 * Draw a birth from the run seed. Four named sub-streams, none of which consumes
 * from another, so adding one later cannot perturb a seed already played.
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

    // WHERE THE RUN OPENS
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
 * What growing up inside this house made somebody, at the moment a run opens. No
 * branch on a tier key and no branch on a faction id: the route comes from the
 * table's own `familyHouse.onTheRoll` and the bars from the house's own floors.
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
 */
const OPENS_AT_ORDINAL = 0;

function requireTier(key: OriginTierKey): OriginTier {
    const tier = ORIGIN_TIERS.find(t => t.key === key);
    if (!tier) throw new Error(`Unknown origin tier: ${key}`);
    return tier;
}

/**
 * What this person has heard of on the day the run opens. The gate is
 * `placement.reach` and nothing else, so an origin gets no special case in the
 * knowledge layer - it seeds ordinary rows, and every difference between a farm
 * child's world and a court child's falls out of how many rows each got.
 */
/**
 * What the house they grew up in is to them, said without naming a rank.
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

    // THE PROVINCE, WHERE THE COUNTY LAYER CANNOT SUPPLY IT
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

// REPORTING IT

/**
 * The engine's own factual line about the opening position.
 */
/**
 * Whose they are, and what is still in front of them.
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
