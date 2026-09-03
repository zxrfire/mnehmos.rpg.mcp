/**
 * The Region contract: every Zod shape a province row is built out of.
 *
 * Split out of `regions.ts` so that the six region files each depend on the
 * contract and on nothing else in the map. Moving code only - no schema here
 * has been changed, relaxed or tightened. In particular `RegionPlace.connections`
 * is OPTIONAL on purpose: a required field crashed the seeder on every
 * hand-built catalog, and tightening it is not a tidy-up.
 *
 * The political layer one level down - `Province`, `Prefecture`, `Arterial` -
 * keeps its contracts beside its own data, in `provinces.ts`, `prefectures.ts`
 * and `arterials.ts`.
 */

import { z } from 'zod';
import { AmbientQiSchema } from '../../../schema/cultivation.js';
import { MAX_ORDINAL } from '../../../engine/cultivation/realms.js';
import { TraditionIdSchema } from '../traditions.js';

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// No region contract exists in `src/schema/cultivation.ts` yet, so it is
// declared here and exported, ready to be lifted when storage needs it.
// ─────────────────────────────────────────────────────────────────────────

/** How power is distributed, which is what actually changes the politics. */
export const RegionPoliticsSchema = z.enum([
    'competing_sects',
    'single_hegemon',
    'no_authority'
]);
export type RegionPolitics = z.infer<typeof RegionPoliticsSchema>;

/**
 * WHERE A PLACE IS, WHICH THE MAP COULD NOT SAY UNTIL NOW.
 *
 * The header of this file has described a spine - centre, west, east, north,
 * water to the south, and a wedge in the interior - since the day the fifth
 * province was written. None of that was ever in the DATA. `Region` carried a
 * `role` of `home` or `adjacent`, which is a statement about the player and
 * not about the world, so every consumer of this catalog saw five provinces
 * in array order with no bearing on any of them and no way to derive one.
 *
 * The cost was not theoretical. The lower world map in the web client groups
 * by containment and by kind, so it could show that eleven houses are in the
 * Low Fall and could not show that the Low Fall is in the MIDDLE. Everything
 * the setting says about the centre - four roads meeting in one gorge, no
 * fifth road, every province resenting the same toll in the same words - is a
 * fact about bearings, and the only place it was written down was a comment.
 *
 * `interior` is not a compass point and is deliberately in the same enum. The
 * Blown Ground is between the four arms and inside none of them, which is a
 * position, and giving it its own word keeps it from being filed north or east
 * by somebody who wanted a complete set.
 */
export const BearingSchema = z.enum(['centre', 'north', 'east', 'south', 'west', 'interior']);
export type Bearing = z.infer<typeof BearingSchema>;

/**
 * A local name for one band of the shared ladder. `fromOrdinal`/`toOrdinal`
 * must match a `REALM_TIERS` entry exactly - this is a relabelling, not a
 * scale.
 */
export const LocalRankBandSchema = z.object({
    fromOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    toOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** What the standard vocabulary calls it. */
    standardName: z.string().min(1),
    /** What the locals call it. */
    localName: z.string().min(1),
    /** Why the locals say it is not the same thing. They are wrong, mostly. */
    localTheory: z.string().min(40),
    /**
     * How many stages the locals divide this realm into. The standard ladder
     * divides Qi Condensation into thirteen and every other realm into four;
     * where these numbers disagree, no correspondence exists inside the realm
     * and none can be constructed.
     */
    localSubdivisions: z.number().int().min(0),
    standardSubdivisions: z.number().int().min(1),
    /**
     * ALIGNMENT HAPPENS AT REALM BOUNDARIES, NOT INSIDE THEM.
     *
     * Both traditions can see that somebody has formed a core - that they have
     * crossed into the third realm - and that is not really disputable. Where
     * they sit inside that realm is not observable across traditions, because
     * the sub-division schemes do not correspond and there is no table that
     * would make them. The absence of that table is the point: it is what makes
     * reading a foreign title one rank low an ordinary mistake made by honest,
     * competent people rather than a blunder.
     */
    subRankCorrespondence: z.literal('none'),
    subRankNote: z.string().min(40)
});
export type LocalRankBand = z.infer<typeof LocalRankBandSchema>;

/** A party's reading of the local titles, and what it costs them to be wrong. */
export const TitleTranslationSchema = z.object({
    party: z.string().min(1),
    /** Their published mapping, in one line. */
    mapping: z.string().min(40),
    /** Why they hold it, and what they have riding on it. */
    interest: z.string().min(40)
});
export type TitleTranslation = z.infer<typeof TitleTranslationSchema>;

/**
 * How cultivation is done here, expressed strictly as modifiers over the
 * shared ordinals. There is no second progression system in this object and
 * there must never be one.
 */
export const RegionCultivationSchema = z.object({
    /** The road, not the rungs. */
    method: z.string().min(40),
    /** Multiplier on progress from ordinary ambient drawing. */
    ambientRateMultiplier: z.number().min(0),
    /** Multiplier on progress when using the local method, with access. */
    methodRateMultiplier: z.number().min(0),
    /** Added to the per-turn qi deviation chance while cultivating here. */
    deviationRiskModifier: z.number().min(-1).max(1),
    /** Realm boundaries that are materially worse here, by ordinal. */
    harderBoundaries: z.array(z.number().int().min(0).max(MAX_ORDINAL)),
    /** Disciplines that simply do not work here, and why. */
    missingDisciplines: z.array(z.object({
        discipline: z.string().min(3),
        reason: z.string().min(40)
    })),
    /** What local cultivators are unusually good at, as a consequence. */
    strongDisciplines: z.array(z.string().min(10)),
    /** What advancing actually costs here, in plain terms. */
    costNote: z.string().min(60),
    localRankNames: z.array(LocalRankBandSchema)
});
export type RegionCultivation = z.infer<typeof RegionCultivationSchema>;

/**
 * How two provinces are joined.
 *
 * `sea_crossing` IS NOT A ROUTE WITH A DIFFERENT NUMBER ON IT
 * ----------------------------------------------------------
 * The five land kinds all describe a relationship between two places that are
 * both on the ground: a road somebody maintains, people walking off one and
 * onto the other, a quarrel, an office with two doors, a line nobody has
 * agreed. A sea crossing is a different sort of object and the difference is
 * mechanical rather than atmospheric:
 *
 *   - It is not there when the weather says it is not. Every other connection
 *     in this catalog is open unless a party closes it. A crossing is closed by
 *     a season and by a storm, which is nobody's decision and cannot be
 *     appealed to, bought off or arbitrated.
 *   - Nothing is maintained. A road is worked on. A crossing is provisioned
 *     against, which is a different verb and a different profession.
 *   - It joins two coasts that no road joins, and it is the only kind here
 *     that does. Every land connection in the world runs through the Low Fall.
 *
 * WHAT THIS DOES NOT DO, AND WHAT IT WOULD TAKE.
 * `LinkKind` in `engine/world/locations.ts` is `road|path|tunnel|gate|portal|
 * seam`, and `seeding.ts` links EVERY region connection as `'road'` regardless
 * of kind - so in a seeded world today an eleven-day cart road and a
 * thirty-four-day open-water passage are the same object with different
 * numbers. A sea crossing is not a `path` either: a path in that file is short
 * unmaintained GROUND between a seat and its vein.
 *
 * It wants its own `LinkKind`, and the reason is exactly the first bullet:
 * `crossing` would be the only link whose `open` flag is set by the world
 * rather than by a holder or a key, which is what `OpeningCycle` in that same
 * file already exists to express. That is two lines of somebody else's file -
 * one union member and one ternary at the `linkLocations` call - and it is
 * deliberately not made here. The geography declares the crossing; the engine
 * has not learned to read it yet, and this comment is the record of that.
 */
export const RegionConnectionSchema = z.object({
    kind: z.enum([
        'trade_route',
        'refugee_flow',
        'shared_feud',
        'shared_institution',
        'unsettled_border',
        'sea_crossing'
    ]),
    otherRegionId: z.string(),
    description: z.string().min(40),
    travelDays: z.number().int().min(0)
});
export type RegionConnection = z.infer<typeof RegionConnectionSchema>;

/**
 * How two places INSIDE one province are joined. An adjacency list with a
 * time, which is the shape one level up and deliberately the same one.
 *
 * WHY THIS EXISTS
 * ---------------
 * `connections` above is province-to-province. Inside a province the only
 * containment was `Prefecture.places[]`, and prefectures exist in two of the
 * provinces - so in the other three there was no way to say that two places
 * are near each other at all, and the played game charged the same flat day
 * for stepping across a valley as for crossing the world.
 *
 * IT IS NOT A SECOND DISTANCE, AND THAT IS THE WHOLE CONSTRAINT
 * ------------------------------------------------------------
 * `how-far-somebody-can-fold-space-and-what-it-costs.ts` states the rule this
 * obeys: every road in this world is quoted in WALKING DAYS, on
 * `travelDays`, and a second unit would be a second opinion about how far
 * apart two places are. So this carries the same field, in the same unit,
 * read by the same function - `daysOnTheRoadTo` in `src/web/travel-verbs.ts`
 * is the single reader of what a journey costs and it is the single reader of
 * this too.
 *
 * The two layers cannot quote different numbers for one pair because their
 * domains are disjoint by rule: a province connection prices a crossing
 * BETWEEN provinces, a place connection prices a road WITHIN one, and
 * `bothEndsAreInOneProvince` below is asserted by a test. There is no pair of
 * places for which both layers have an answer.
 *
 * STORED ONCE, READ BOTH WAYS
 * ---------------------------
 * A road is declared on exactly one of its two ends and
 * {@link placeRoadDays} walks it in either direction. Province connections
 * are stored twice - each region lists the other - and two rows that can
 * disagree eventually will; there is nothing to gain from repeating that at a
 * scale where a whole province's roads sit in one file, in front of one
 * reader. `linkLocations` in `engine/world/locations.ts` already writes both
 * directions into the runtime graph and calls a one-way road a bug, so the
 * seeded world is symmetric by construction from a single catalog row.
 *
 * SPARSE, AND ABSENCE IS NOT UNREACHABILITY
 * -----------------------------------------
 * Most places have no neighbour here and should not. A pair with no row falls
 * through to whatever priced the journey before - the flat `SHORT_ACTION_DAYS`
 * inside a province - exactly as it did. Nothing becomes unreachable for
 * lacking a row, and `daysOnTheRoadTo` returns null rather than a number,
 * which it already documents as meaning "unpriced" and never "free".
 *
 * `kind` IS THE ENGINE'S OWN `LinkKind`, NOT A NEW VOCABULARY
 * ----------------------------------------------------------
 * The province-scale kinds are SOCIAL - a trade route, a refugee flow, a
 * shared feud - because what two provinces have between them is a
 * relationship. Two towns of one province do not have a refugee flow; what
 * they have is a way, and how the way is made is what decides whether it is
 * open, whether it needs a key, and what the map draws. That is exactly
 * `LinkKind` in `engine/world/locations.ts`, which already carries all three
 * behaviours, so this enum is that union restated rather than a second
 * vocabulary beside it - and `seeding.ts` hands the value straight to
 * `linkLocations` with no mapping table, which is what makes the typechecker
 * the guard rather than a test.
 */
export const RegionPlaceConnectionSchema = z.object({
    /** `LinkKind` in `engine/world/locations.ts`. Passed through untranslated. */
    kind: z.enum(['road', 'path', 'tunnel', 'gate', 'portal', 'seam']),
    /** The `name` of the other place, in the same province. */
    otherPlaceName: z.string().min(1),
    description: z.string().min(40),
    /** Walking days. The same unit and the same field as a province road. */
    travelDays: z.number().int().min(0)
});
export type RegionPlaceConnection = z.infer<typeof RegionPlaceConnectionSchema>;

export const RegionPlaceSchema = z.object({
    name: z.string().min(1),
    kind: z.enum(['hamlet', 'village', 'market_town', 'sect_town', 'city', 'waystation', 'site']),
    ambient: AmbientQiSchema,
    note: z.string().min(20),
    /**
     * Places next to this one, declared on one end only. Sparse: absence
     * means "no special adjacency", never "unreachable". See
     * {@link RegionPlaceConnectionSchema}.
     */
    connections: z.array(RegionPlaceConnectionSchema).optional()
});
export type RegionPlace = z.infer<typeof RegionPlaceSchema>;

export const RegionBranchSchema = z.object({
    parentSectId: z.string(),
    localName: z.string().min(1),
    doesHere: z.string().min(40)
});
export type RegionBranch = z.infer<typeof RegionBranchSchema>;

/** The sensory identity, held for every scene in the region. */
export const RegionRegisterSchema = z.object({
    colour: z.string().min(3),
    light: z.string().min(20),
    sound: z.string().min(20),
    smell: z.string().min(20),
    food: z.string().min(20)
});
export type RegionRegister = z.infer<typeof RegionRegisterSchema>;

/** The things it is easiest to leave uniform between regions, varied on purpose. */
export const RegionCustomsSchema = z.object({
    socialPrinciple: z.string().min(40),
    death: z.string().min(40),
    taboo: z.string().min(40),
    threatModel: z.string().min(40),
    naming: z.string().min(40),
    time: z.string().min(40)
});
export type RegionCustoms = z.infer<typeof RegionCustomsSchema>;

export const RegionSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    role: z.enum(['home', 'adjacent']),
    /**
     * Where it is. `role` says what the province is to the player; this says
     * what it is to the map, and the two are different questions. See
     * `BearingSchema`.
     */
    bearing: BearingSchema,
    /** The cultivation tradition seated here. See `traditions.ts`. */
    traditionId: TraditionIdSchema,
    summary: z.string().min(80),
    /**
     * The single physical fact everything else follows from. A reader should
     * hear it and correctly predict three other things about the place.
     */
    governingFact: z.string().min(60),
    /** What follows from it, stated so the derivation is checkable. */
    derivations: z.array(z.string().min(40)),
    register: RegionRegisterSchema,
    customs: RegionCustomsSchema,
    cultivation: RegionCultivationSchema,
    ambientProfile: z.record(AmbientQiSchema, z.number().int().min(0).max(100)),
    localCeilingOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    ceilingNote: z.string().min(60),
    veinStatus: z.string().min(60),
    politics: RegionPoliticsSchema,
    politicsNote: z.string().min(60),
    factionIds: z.array(z.string()),
    branches: z.array(RegionBranchSchema),
    places: z.array(RegionPlaceSchema),
    exports: z.array(z.string()),
    imports: z.array(z.string()),
    priceMultiplier: z.number().min(0.1).max(10),
    hazards: z.array(z.string()),
    connections: z.array(RegionConnectionSchema),
    /** Three things that are true here and false one province over. */
    trueHereFalseThere: z.array(z.string().min(40)),
    /** What a cultivator actually notices, in order, on crossing in. */
    crossingNotes: z.array(z.string().min(40))
});
export type Region = z.infer<typeof RegionSchema>;
