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

import { z } from 'zod';
import { AmbientQiSchema, type AmbientQi } from '../../schema/cultivation.js';
import { MAX_ORDINAL, REALM_TIERS } from '../../engine/cultivation/realms.js';
import { TraditionIdSchema } from './traditions.js';

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

export const RegionPlaceSchema = z.object({
    name: z.string().min(1),
    kind: z.enum(['hamlet', 'village', 'market_town', 'sect_town', 'city', 'waystation', 'site']),
    ambient: AmbientQiSchema,
    note: z.string().min(20)
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

// ─────────────────────────────────────────────────────────────────────────
// LOCAL VOCABULARY
// Every region relabels the same ladder. The Low Fall's labels happen to be
// the standard ones, because the standard vocabulary is the Low Fall's.
//
// Three of the five speak that vocabulary and two do not, and WHICH three is
// content rather than economy: the Wide Field speaks it because every lease in
// nine cities is written in it and no landlord signs a grade he cannot look up,
// and the Drowned Reach speaks it because it has no locals to have a word of
// its own. The Marches and the White Stair each reached the same rungs by a
// different road, so each named them.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Standard names, band for band, from the one ladder, with the local account
 * of why the standard names are the ones being used here.
 */
function standardBandsWith(localTheory: string, subRankNote: string): LocalRankBand[] {
    return REALM_TIERS.map(tier => ({
        fromOrdinal: tier.ordinalStart,
        toOrdinal: tier.ordinalEnd,
        standardName: tier.name,
        localName: tier.name,
        localTheory,
        localSubdivisions: tier.subRanks.length,
        standardSubdivisions: tier.subRanks.length,
        subRankCorrespondence: 'none' as const,
        subRankNote
    }));
}

const STANDARD_BANDS: LocalRankBand[] = standardBandsWith(
    'The Low Fall wrote the standard vocabulary and has never had cause to notice that it is a vocabulary rather than the thing itself.',
    'Trivially self-consistent here, and the Low Fall mistakes that for the sub-ranks being real. Asked to place a foreign cultivator inside a realm, its experts guess, and are confident.'
);

const FIELD_BANDS: LocalRankBand[] = standardBandsWith(
    'The Wide Field uses the Low Fall words because every lease in nine cities is written in them, and a landlord will not put his seal on a grade he cannot look up in a table somebody else keeps.',
    'The East is the only place where the sub-ranks have a price attached, because a lease is graded by them - which means everybody here has a commercial reason to be confident about a distinction that does not survive a border.'
);

const REACH_BANDS: LocalRankBand[] = standardBandsWith(
    'Everybody on this water learned their words somewhere else and brought them aboard, so the Drowned Reach has no vocabulary of its own and never developed one. There are no locals here to have invented anything.',
    'A hull carrying four provinces\' worth of titles settles a disagreement about rank the way a hull settles everything, which is by finding out what each of them can actually do before the weather does it for them.'
);

/**
 * The White Stair counts the same rungs against a wall of ice.
 *
 * Every band maps one to one onto `REALM_TIERS`. The argument in the North is
 * never about how many rungs there are, it is about where the face was when
 * somebody reached one - which is a question about a date, and the North does
 * not keep dates.
 */
const STAIR_BANDS: LocalRankBand[] = [
    {
        fromOrdinal: 0, toOrdinal: 12,
        standardName: 'Qi Condensation', localName: 'Below the Face',
        localTheory: 'Anybody drawing on ice that has already melted, which is everybody at every band the province still lives at. Most northerners are here when the cold takes them and the Court has no interest in them.',
        localSubdivisions: 5, standardSubdivisions: 13,
        subRankCorrespondence: 'none',
        subRankNote: 'Five hands against thirteen layers, and a hand is a measurement off the ice rather than a stage of anything. No table converts them and the North has never wanted one.'
    },
    {
        fromOrdinal: 13, toOrdinal: 16,
        standardName: 'Foundation Establishment', localName: 'At the Face',
        localTheory: 'Somebody permitted to stand in the forty paces. It is a place before it is a rank, and the North does not really distinguish the two: to be At the Face is to have been let in, and nobody is let in who could not survive it.',
        localSubdivisions: 2, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Two states, admitted and kept, against four stages. A visitor who hears "kept" as a probationary grade has it backwards - kept is the higher of the two and is where the Court stops explaining itself.'
    },
    {
        fromOrdinal: 17, toOrdinal: 20,
        standardName: 'Core Formation', localName: 'Standing Ice',
        localTheory: 'The cold holds inside the body without being maintained. The North is content to be told this is a golden core and will not argue about it, on the grounds that arguing with the Low Fall about words has never once changed a working face.',
        localSubdivisions: 3, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Three courses of ice against four stages. Both traditions can see instantly that somebody has crossed into the realm; where inside it they sit is not observable across the border and no correspondence exists.'
    },
    {
        fromOrdinal: 21, toOrdinal: 24,
        standardName: 'Nascent Soul', localName: 'Blue',
        localTheory: 'Old ice is blue, and so is a northerner at this realm, visibly, at the hands and around the mouth. It is the only rank in the world an illiterate can read off a stranger across a room.',
        localSubdivisions: 2, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Two shades against four stages, and the shades are not halves of the same span - the second is what a person goes when they have stopped needing to be near the face at all.'
    },
    {
        fromOrdinal: 25, toOrdinal: 28,
        standardName: 'Deity Transformation', localName: 'Unmelting',
        localTheory: 'Ice on a person that the summer does not take. Three are recorded in four hundred years, all three in the same Court, and the province regards the word as an administrative term rather than an achievement.',
        localSubdivisions: 0, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Undivided. The North has three instances and no basis on which to sort them, and would not sort them if it had.'
    },
    {
        fromOrdinal: 29, toOrdinal: 32,
        standardName: 'Void Refinement', localName: 'The Cold Below',
        localTheory: 'What is under the ice rather than in it. The Court holds that the curriculum it dug out describes this state and that nobody now alive has reached it, and the Court is the only party that has read the curriculum.',
        localSubdivisions: 0, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Curriculum vocabulary with one living claimant and no second party competent to check her. Any northern claim inside this realm rests entirely on the Frostmirror agreeing with it.'
    },
    {
        fromOrdinal: 33, toOrdinal: 36,
        standardName: 'Body Integration', localName: 'The Whole Winter',
        localTheory: 'Person and cold are one weather. This is the top of the province and it is occupied, which is the single most important political fact in the North and the reason nobody else here is going anywhere.',
        localSubdivisions: 0, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Undivided, with exactly one instance, and the instance declines to say where inside it she is on the grounds that nobody could check.'
    },
    {
        fromOrdinal: 37, toOrdinal: 40,
        standardName: 'Grand Ascension', localName: 'Above the Stair',
        localTheory: 'The curriculum names it and does not describe it. The Court teaches the word because the ice had the word in it, and teaches nothing else about it because there was nothing else.',
        localSubdivisions: 0, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Curriculum vocabulary, undivided and unattested anywhere north of the pass.'
    },
    {
        fromOrdinal: 41, toOrdinal: 44,
        standardName: 'Tribulation Transcendence', localName: 'The Last Winter',
        localTheory: 'A winter with nothing after it. The North assumes this means an ending and the Low Fall knows it means a beginning, and neither has ever put the question to anybody who would know.',
        localSubdivisions: 0, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Curriculum vocabulary. The Low Fall divides this realm into four and the White Stair into none, and the disagreement has never cost anybody anything because no northerner has been near it.'
    },
    {
        fromOrdinal: 45, toOrdinal: 46,
        standardName: 'Immortal', localName: 'Gone Up',
        localTheory: 'Two words, and the North means them the way it means anything about altitude: literally, and with no theory attached whatsoever.',
        localSubdivisions: 0, standardSubdivisions: 2,
        subRankCorrespondence: 'none',
        subRankNote: 'One phrase against two states, and the two states are not degrees of each other - one of them is over the Lid and one is through it. The North has never had occasion to want the distinction.'
    }
];

/**
 * The Marches counts the same rungs in cut stone. Every band below maps one
 * to one onto `REALM_TIERS`; the argument is about what the rung is made of,
 * never about how many there are.
 */
const MARCHES_BANDS: LocalRankBand[] = [
    {
        fromOrdinal: 0, toOrdinal: 12,
        standardName: 'Qi Condensation', localName: 'Chipping',
        localTheory: 'Taking loose qi out of broken stone with a hand chisel. Everyone starts here and most people are still here when the dust-lung takes them.',
        localSubdivisions: 7, standardSubdivisions: 13,
        subRankCorrespondence: 'none',
        subRankNote: 'Seven chisel grades against thirteen layers. No arithmetic maps one onto the other and both sides have stopped trying.'
    },
    {
        fromOrdinal: 13, toOrdinal: 16,
        standardName: 'Foundation Establishment', localName: 'Standing Cut',
        localTheory: 'The carver opens a face that stays open: a worked seam that keeps giving without collapsing. That somebody has done this is obvious to anyone from either tradition, which is why the realm itself is never in dispute.',
        localSubdivisions: 3, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Three courses against four stages, and the courses are not thirds of the same thing: a face does not stand at all until it is deep, so a first-course Standing Cut is already past where an outsider hears "first" and places them. This is the single most expensive misunderstanding in the catalog - see RANK_MISREADINGS.'
    },
    {
        fromOrdinal: 17, toOrdinal: 20,
        standardName: 'Core Formation', localName: 'Keystone',
        localTheory: 'A carver at Keystone has no golden core. What they have is a worked seam running through the body that holds load. The Marches maintains this is a different thing entirely and will explain why at length; both traditions nonetheless agree instantly on who has crossed into the realm, because it is visible.',
        localSubdivisions: 3, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Three courses again, and a Keystone carver will say which course they are on and mean something no Low Fall examiner can convert.'
    },
    {
        fromOrdinal: 21, toOrdinal: 24,
        standardName: 'Nascent Soul', localName: 'The Inner Face',
        localTheory: 'The carver opens a face inside themselves and can work it where there is no stone. The name is descriptive rather than metaphysical: there is no soul in it, and a carver told that the standard vocabulary calls this Nascent Soul will usually laugh.',
        localSubdivisions: 2, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Two states, opened and worked, against four stages. The Marches does not recognise a distinction between what the standard ladder calls Late and Perfection.'
    },
    {
        fromOrdinal: 25, toOrdinal: 28,
        standardName: 'Deity Transformation', localName: 'Loadbearing',
        localTheory: 'The body carries what the stone used to carry. Two carvers are recorded at Loadbearing in nine hundred years and both left for the Low Fall inside a decade.',
        localSubdivisions: 0, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'No subdivisions at all. The Marches has two instances and no basis on which to divide them.'
    },
    {
        fromOrdinal: 29, toOrdinal: 32,
        standardName: 'Void Refinement', localName: 'Hollowing',
        localTheory: 'Working out the last of the seam. The Marches has the word and no instance of it.',
        localSubdivisions: 0, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'A term from the inscription with nothing under it. Any local claim to a position inside this realm is fraud on its face.'
    },
    {
        fromOrdinal: 33, toOrdinal: 36,
        standardName: 'Body Integration', localName: 'The Whole Stone',
        localTheory: 'Carver and face are one piece. Known from a single inscription in the sealed part of the sorting-yard ruin, which is where most of the vocabulary above Keystone comes from.',
        localSubdivisions: 0, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Inscription vocabulary. The Marches uses the word and could not recognise the state if it walked into Kettle.'
    },
    {
        fromOrdinal: 37, toOrdinal: 40,
        standardName: 'Grand Ascension', localName: 'Capstone',
        localTheory: 'The last course laid. Nobody in the Marches can say what it means and the term is used anyway, because the inscription uses it.',
        localSubdivisions: 0, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Inscription vocabulary, undivided and unattested.'
    },
    {
        fromOrdinal: 41, toOrdinal: 44,
        standardName: 'Tribulation Transcendence', localName: 'The Open Cut',
        localTheory: 'A cut that goes all the way through, with the sky on the far side of it.',
        localSubdivisions: 0, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Inscription vocabulary. The Marches assumes it is one state and the Low Fall knows it is four, and neither has met anyone to ask.'
    },
    {
        fromOrdinal: 45, toOrdinal: 46,
        standardName: 'Immortal', localName: 'Through',
        localTheory: 'One word, no elaboration, and the inscription does not continue past it.',
        localSubdivisions: 0, standardSubdivisions: 2,
        subRankCorrespondence: 'none',
        subRankNote: 'One word against two states, and they are not variations on each other - one of them is over the Lid and the other is through it. The Marches has never had to tell them apart, which is a fact about the Marches and not about the Lid.'
    }
];

/**
 * The mapping is contested by parties with money on the outcome. This is the
 * politics, the danger and most of the comedy, and it costs the engine
 * nothing because the ordinals never move.
 */
export const TITLE_TRANSLATIONS: readonly TitleTranslation[] = [
    {
        party: 'The Ninefold Ledger',
        mapping: 'Band for band, exactly: Chipping is Qi Condensation, Standing Cut is Foundation Establishment, Keystone is Core Formation, and so on to the top.',
        interest: 'It arbitrates inheritance and debt across the border and needs one table that both sides are bound by. It is also correct, which it regards as incidental.'
    },
    {
        party: 'The Weir Office',
        mapping: 'Keystone sits above Core Formation, and Standing Cut above Foundation Establishment, on the argument that a carver reached it without ambient qi and is therefore worth more.',
        interest: 'Grant fees are priced by rank, and every band it can push upward is revenue. The Office has never submitted the claim to the Ledger for certification.'
    },
    {
        party: 'The Kettle Assay House',
        mapping: 'A third table used for insurance: Standing Cut is read one rank low, at Qi Condensation Perfection, because a carver with no formations and no alchemy fights like a weaker cultivator.',
        interest: 'The Stonewright Consortium underwrites escort contracts and pays out on deaths. Its table is the only one anybody uses commercially, and it is the one that gets outsiders killed.'
    },
    {
        party: 'The House of the Narrow Hour',
        mapping: 'Declines to publish a table on the grounds that a rank is a position in a convergence rather than a title, and that both other tables are answering a question nobody asked.',
        interest: 'It has one reader in the Marches, who has been asked for a mapping eleven times and has refused eleven times, and whose refusal is itself quoted in the Ledger\'s case notes.'
    }
];

/**
 * The gap between the realm and the sub-rank, written down as incidents.
 *
 * Alignment at the realm boundary is reliable: everyone can see that a person
 * has opened a standing face, and nobody argues about which realm that is.
 * Inside the realm there is no correspondence at all, and that is where people
 * die - not because anyone is a fool, but because there is no lookup that
 * settles it and both parties are guessing with confidence.
 */
export const RANK_MISREADINGS: readonly {
    localName: string;
    realmIsClear: string;
    insideIsNot: string;
    systematicDirection: string;
    recordedIncident: string;
}[] = [
    {
        localName: 'Standing Cut',
        realmIsClear:
            'Nobody disputes the realm. A face that stays open is Foundation Establishment and both traditions can see it across a room.',
        insideIsNot:
            'Three courses against four stages, and the courses are not thirds of the same span: a face does not stand at all until it is deep, so the first course already sits where the standard ladder would put Mid to Late.',
        systematicDirection:
            'Outsiders read Standing Cut low, consistently, in the same direction, because "first course" sounds like "Early". Carvers are therefore systematically underestimated by about two stages in the province next door, which is survivable for the carver and not for the person who challenged them.',
        recordedIncident:
            'The Scarwater duel, eleven years ago: a Sword Elder\'s disciple of the Azure Cloud Pavilion at Foundation Perfection accepted a challenge from a "first-course Standing Cut" carver on the assumption that first course meant Early Foundation. It did not. The carver was within a stage of him and immune to the soul-pressure art he opened with, and he died in the street at Scarwater in front of forty people. The Ninefold Ledger case note is the only document in the world that states the sub-division mismatch plainly, and the Kettle Assay House has not revised its insurance table since.'
    }
];

/**
 * The profession that exists in the gap. Placing a foreign cultivator inside a
 * realm cannot be done from a table, so it is done by people, badly, for money.
 */
export const PLACERS = {
    trade: 'placer',
    what:
        'Someone who can look at a cultivator from the other tradition and say, accurately, where inside a realm they sit. The realm is free - anyone can see that. The position inside it is the entire product.',
    whoSellsIt:
        'The Ninefold Ledger, as a second line of business beside ancestral certification, and about nine independents at Scarwater and Kettle who work the border road and undercut it.',
    priceNote:
        'Ledger placement of a single foreign cultivator costs more than a month of cave rent on a decent vein, and is still cheaper than being wrong once.',
    reliability:
        'The Ledger publishes its own error rate, which is roughly one in six, and it is the best figure anybody has. The independents do not publish one.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOG
// ─────────────────────────────────────────────────────────────────────────

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

export const REGIONS: readonly Region[] = [
    {
        id: HOME_REGION_ID,
        name: 'The Low Fall',
        role: 'home',
        traditionId: 'tradition-drawn',
        summary:
            'The centre, and the only province with a road to every other one: nine river towns, four sect mountains, a live trade in medicine and manuals, and seventeen institutions with overlapping claims on eleven veins. What limits a cultivator here is talent and money, not the ground.',
        governingFact:
            'The veins here are horizontal, shallow and surveyable, so the qi belongs to whoever holds the surface above it - and the surface has been held continuously for four hundred years.',
        derivations: [
            'Territory is the only currency of standing, so every border is an argument about a survey line rather than about strength',
            'Institutions outlast people, because a vein outlasts the cultivator who took it, so a sect can be formidable with no formidable members',
            'The whole apparatus of arbitration, oath-witnessing and certification exists because holdings must be provable to be defensible',
            'A surveyable vein is a vein that can be granted, so this is the only province in the world with a grant book, and therefore the only one with tenants, renewals, and a reason to be polite',
            'Everything that has to cross the world crosses here: four roads meet in one gorge and there is no fifth, which is why the Low Fall taxes traffic it never generated and why every other province resents it in the same words'
        ],
        register: {
            colour: 'green-grey: wet slate roofs, river haze, terraced hillsides that stay green into autumn',
            light: 'diffuse and damp, with the sun arriving late over the gorge wall and going early behind it',
            sound: 'water, constantly - eleven river towns, four fords and a gorge that carries every sound upstream',
            smell: 'river silt, wet stone, herb smoke off the Verdant Spring terraces, and frying oil at every ford market',
            food: 'river fish, glutinous rice steamed in leaves, pickled greens, and tea served bitter and free at any sect gate'
        },
        customs: {
            socialPrinciple: 'Rivalry between institutions, mediated by fee-charging third parties. Nobody is strong enough to stop anybody else, which is what keeps the arbitration houses in business.',
            death: 'Burial in family ground, with a tablet in a sect hall for anyone who died on sect business. The tablets are dusted; the graves are frequently not.',
            taboo: 'Do not repeat what was taken from someone at a crossing. Everyone knows who has lost a name and nobody says it aloud, and a visitor who asks is not corrected, merely never spoken to again.',
            threatModel: 'People. Sect politics kill more low-realm cultivators here than beasts, weather and ruins combined, and everybody plans around that.',
            naming: 'Two-syllable given names with clan surnames - Ru Anjing, Yan Duo, Mu Ganlu - and sect titles used in place of names once a person holds rank.',
            time: 'Years counted from the founding of whichever sect one belongs to, so dates are disputed as a matter of routine and every contract states two of them.'
        },
        cultivation: {
            method:
                'Ordinary drawing: sit on ground that has qi in the air and take it in. The Low Fall invented the standard vocabulary because it is the kind of place where the standard method works.',
            ambientRateMultiplier: 1,
            methodRateMultiplier: 1,
            deviationRiskModifier: 0,
            harderBoundaries: [],
            missingDisciplines: [],
            strongDisciplines: [
                'alchemy, which requires ambient qi to hold a refinement and has a guild here',
                'formations, which draw on the veins the province is built over',
                'every discipline, in fact, which is exactly what makes it unremarkable'
            ],
            costNote:
                'Advancement costs access and medicine: a cave on decent ground, pills for the boundaries, and the standing of a sect willing to spend on your crossing. All three are purchasable and all three are expensive.',
            localRankNames: STANDARD_BANDS
        },
        ambientProfile: { thin: 52, normal: 35, dense: 12, spirit_tide: 1 },
        localCeilingOrdinal: MAX_ORDINAL,
        ceilingNote:
            'No regional ceiling. The Low Fall holds veins good enough that a Grand Ascension cultivator could advance here, and the practical limit is that all of them are owned.',
        veinStatus:
            'Eleven surveyed veins, four of them rich, all claimed. The great sects are old because they hold veins and hold veins because they were old enough to take them.',
        politics: 'competing_sects',
        politicsNote:
            'Federated. Seventeen institutions holding single veins on twelve-year grants from something none of them names in public, competing for standing with whoever renews them rather than for the veins themselves - which is why the province argues constantly and burns rarely. It is the only province in the world where a holding can be granted at all, because it is the only one where a vein can be surveyed, and the four provinces around it each solved the same problem a different way. A newcomer with talent has options here, and every one of them is somebody else\'s tenant.',
        factionIds: [
            'sect-azure-cloud-pavilion',
            'sect-azure-mist-court',
            'sect-azure-dew-sect',
            'sect-verdant-spring-hall',
            'sect-nine-peaks-ascetic-order',
            'sect-clear-river-alliance',
            'sect-sweptground-temple',
            'sect-standing-grove',
            'sect-cinnabar-crucible-guild',
            'sect-ashen-forge-clan',
            'sect-kiln-wardens',
            'sect-hollow-court',
            'sect-crimson-abyss-hall',
            'sect-nine-abyss-flame-sect',
            'house-ninefold-ledger',
            'house-bound-word',
            'house-anchorhold'
        ],
        branches: [
            {
                parentSectId: 'sect-gleaners-company',
                localName: 'The Hollowmarket Factor at Scarwater',
                doesHere:
                    'Sells Marches salvage into the Low Fall market: sealed-site finds, scar-ground herbs, and the occasional manual in a grade the Marches has no teacher for. Buys nothing and is watched by the Bone Lantern Cult, which considers the trade its own.'
            },
            {
                parentSectId: 'sect-stonewright-consortium',
                localName: 'The Gorge Assay',
                doesHere:
                    'Assays and cuts to the Stonewright standard at the head of the eleven veins, and is the only reason a Low Fall grant can be priced at all. It holds no ground, sets the rate from nine cities away, and every sect in the province quotes a figure it did not set.'
            },
            {
                parentSectId: 'sect-hollow-bell-wanderers',
                localName: 'The Ford Bells',
                doesHere:
                    'Four bells on four fords, rehung whenever a member passes. It is the only current record of who is on the roads of this province and the only one nobody has thought to ask for.'
            }
        ],
        places: [
            { name: 'Low Fall', kind: 'city', ambient: 'normal', note: 'The province town under the gorge, and the Azure Cloud Pavilion\'s market.' },
            { name: 'Scarwater', kind: 'market_town', ambient: 'thin', note: 'The last ford before the border road, and where Marches goods are sold.' },
            { name: 'Sweptground', kind: 'sect_town', ambient: 'thin', note: 'Temple ground, no vein, and the treaty vault of the Bound Word.' },
            { name: 'Nine Peaks', kind: 'sect_town', ambient: 'dense', note: 'The deepest vein anyone has kept, and the Ascetic Order sitting on it.' }
        ],
        exports: [
            'refined pills and formulae, which the Marches cannot make at all',
            'manuals to heaven grade, and living teachers for them',
            'assayed spirit stones, cut to the Stonewright standard',
            'arbitration, certification and oath witnessing, all of which travel'
        ],
        imports: [
            'sealed-site salvage out of the Marches burn zones',
            'scar-ground herbs that only fruit on dead ground',
            'people: the Marches sends its young, and nobody on this side calls it an import'
        ],
        priceMultiplier: 1,
        hazards: [
            'contested ground: about a third of the province sits inside somebody\'s claim',
            'sect politics, which are the actual cause of death for most low-realm cultivators here'
        ],
        connections: [
            {
                kind: 'trade_route',
                otherRegionId: ADJACENT_REGION_ID,
                description:
                    'The border road from Scarwater to Kettle: eleven days by cart, four by Measured Span courier where the Span still runs it. Salvage and people out; pills, stones and grain in.',
                travelDays: 11
            },
            {
                kind: 'refugee_flow',
                otherRegionId: ADJACENT_REGION_ID,
                description:
                    'A steady drift of Marches-born carvers arriving at Scarwater with split hands, a cough, and a title nobody here prices correctly. Sweptground Temple takes most of them; the Crimson Abyss Hall recruits the rest.',
                travelDays: 11
            },
            {
                kind: 'shared_institution',
                otherRegionId: ADJACENT_REGION_ID,
                description:
                    'The Stonewright Consortium and Sweptground Temple both hold Marches outposts, and the Gleaners\' Company keeps a factor at Scarwater. Those three offices are the whole formal relationship between the regions.',
                travelDays: 11
            },
            {
                kind: 'unsettled_border',
                otherRegionId: ADJACENT_REGION_ID,
                description:
                    'The Anchorhold has surveyed to the burn edge and no further, so the last forty li before Kettle are on nobody\'s survey. Oaths sworn there do not bind, which several parties on both sides find useful.',
                travelDays: 11
            },
            {
                kind: 'trade_route',
                otherRegionId: EAST_REGION_ID,
                description:
                    'Six days down the gorge road to Ninewatch, and it is the busiest stretch of ground in the world: every pill, manual and assayed stone the Low Fall sells goes east, and every stone it uses to price them was rated in an eastern assay hall.',
                travelDays: 6
            },
            {
                kind: 'unsettled_border',
                otherRegionId: EAST_REGION_ID,
                description:
                    'The Anchorhold has never carried a survey past the watershed, so the whole eastern boundary is a matter of habit. Nothing sworn on the far side binds, which is why every arrangement the Low Fall makes with a city is a lease with a deposit rather than an oath.',
                travelDays: 6
            },
            {
                kind: 'trade_route',
                otherRegionId: NORTH_REGION_ID,
                description:
                    'Seventeen days over the pass to Rimefall, shut five months a year, carrying grain and timber up and ice-cut stones down. Everything the White Stair eats comes over this road and everybody in the Low Fall knows it.',
                travelDays: 17
            },
            {
                kind: 'shared_institution',
                otherRegionId: NORTH_REGION_ID,
                description:
                    'The Cinnabar Crucible Guild stands on the Ashfall flank and holds its grant from the Frostmirror Court, which is over the pass and on the other arterial - so an alchemy guild in this province answers to a court in that one, and neither province has a document that says so.',
                travelDays: 17
            },
            {
                kind: 'trade_route',
                otherRegionId: SOUTH_REGION_ID,
                description:
                    'Nine days down the river to the mouth and out to Watering, which is where the Low Fall\'s river ends and stops being a river. Salt up, pills and grain down, and the Clear River Alliance will take a hull that far and refuses to go further.',
                travelDays: 9
            }
        ],
        trueHereFalseThere: [
            'A holding can be granted. This is the only province with a surveyed vein under it, so it is the only one with a grant book, a renewal cycle, a tenant, and a reason for anybody to be polite to anybody.',
            'A pill above mortal grade can be bought over a counter, today, in four towns, and the counter is not a monopoly.',
            'An oath binds. The Bound Word witnesses on certified ground and there is certified ground here, which there is nowhere else in the world.',
            'Sitting still on ordinary ground, in the open, makes measurable progress - and it goes on making it all the way to the top of the ladder, which no other province can say at any rung.'
        ],
        crossingNotes: [
            'Coming in from anywhere, the noise is the first thing: sect patrols, courier traffic, and four separate parties claiming the same road.',
            'The air is wet. A carver arriving from the Marches usually stops within sight of the ford and has to be told what they are feeling.',
            'Medicine is purchasable. A Clear Meridian Pill is sixty stones and in stock, which no shop in three of the four provinces around this one can say.',
            'Somebody asks whose you are within an hour, and the question is not rude and is not idle: there is a book, your answer goes in it, and the answer decides which of eleven veins you are allowed to sit on.'
        ]
    },

    {
        id: ADJACENT_REGION_ID,
        name: 'The Quiet Marches',
        role: 'adjacent',
        traditionId: 'tradition-cut',
        summary:
            'The province people leave: the western end of the world, the last of five driven provinces, and the only place in it where cultivation is a trade with tools. Something broke here nine hundred years ago and drove the qi out of the air and into the rock, so the Marches does not breathe qi - it cuts it out of stone, and everything about the place follows from that. It has one road, it goes east, and there is nothing on the other side of the Marches but four more provinces like it that nobody here has seen.',
        governingFact:
            'The qi is not gone; it was driven into the stone. There is nothing in the air and a great deal in the rock, and the only way to get at it is to cut.',
        derivations: [
            'Cultivation is a trade with tools, a working day and an apprenticeship, so a carver at Standing Cut has the hands of a quarryman and the lungs of one',
            'Status is measured in worked face rather than land, so the Weir Office rents cut by the day and holds the region by holding the two faces still worth working',
            'The whole region is loud and grey with dust, in a place named for silence, because the silence people meant was the absence of qi in the air'
        ],
        register: {
            colour: 'grey on grey: rock dust on everything, whitened hands, pale rings around every mouth and nose that has worked a face',
            light: 'flat and hard, no haze, and a dust plume over Kettle visible from the border marker on a still day',
            sound: 'chisels. Two hundred of them, dawn to dark, and the silence when a face is worked out is how a district learns it is finished',
            smell: 'cut stone and wet grit, cold iron, and the vinegar the carvers rinse their mouths with against the dust',
            food: 'flatbread, salt, boiled roots, and a thin sour broth drunk hot to clear the throat - imported grain, because a fifth of the arable land is gone'
        },
        customs: {
            socialPrinciple: 'Patronage. One holder, a public and wholly discretionary grant book, and no second party to defect to, so the only political question anyone asks is who is on the book.',
            death: 'The dead are walled into the face they were working, and the face is finished around them. A worked-out district is therefore also a cemetery, and the Gleaners will not cut a face that holds somebody without asking the family.',
            taboo: 'Never leave a cut unfinished. Locals hold that an open cut spreads the deadening, and a visitor who chips a souvenir off a face and walks away has committed the one offence the Marches does not forgive.',
            threatModel: 'The ground. Dead zones that do not look dead, a burn edge that moves about a pace a year, and dust-lung, which kills more carvers than everything else combined.',
            naming: 'Tool-names and face-numbers rather than clan names: Chisel Ma, Third Face Ren, Stakes, Kettle Bo. A person who gives two names in the Low Fall style is announcing that they are leaving.',
            time: 'Counted in faces rather than years - a person is "four faces old" in the trade - and a working day ends when the dust has settled enough to see the far wall.'
        },
        cultivation: {
            method:
                'Carving. The carver cuts stone that holds driven qi and takes what comes out of the cut, which means the whole discipline is physical, apprenticed, tool-dependent, and performed standing up in a cloud of grit.',
            ambientRateMultiplier: 0.15,
            methodRateMultiplier: 1.1,
            deviationRiskModifier: 0.04,
            harderBoundaries: [12, 20],
            missingDisciplines: [
                {
                    discipline: 'alchemy',
                    reason: 'A refinement needs ambient qi to hold its shape while it sets. In the Marches it does not set: pills come out inert or come apart within the month, so every pill in the region is imported eleven days by cart.'
                },
                {
                    discipline: 'formations',
                    reason: 'Formations draw on ambient qi and there is none to draw on, so every formation in the region is a dead diagram. The Weir works run seven nodes because they were cut into the stone rather than laid on the ground.'
                }
            ],
            strongDisciplines: [
                'body-tempering, which the work does anyway and which nobody here regards as a discipline',
                'defensive arts, because a carver spends their life next to falling rock',
                'sealed-site work, because the region has more intact ruins than anywhere and the only people willing to enter them'
            ],
            costNote:
                'Advancement costs grant time and tools: forty stones a day for a face at the Gapwater, a chisel that survives about a season, and a set of lungs that will not. Nothing else in the region is for sale that helps.',
            localRankNames: MARCHES_BANDS
        },
        ambientProfile: { thin: 62, normal: 8, dense: 1, spirit_tide: 0 },
        localCeilingOrdinal: 6,
        ceilingNote:
            'Outside the two rented faces a carver stops at about Qi Condensation Layer 7, because the loose stone within reach of an unfunded person is worked out. Nobody born in the Marches has passed Chipping in living memory without buying grant time or leaving.',
        veinStatus:
            'The veins are not drawn down, they are driven: whatever happened here forced the qi out of the air into the rock and killed the ground above it, and the dead ground has been spreading about a pace a year ever since.',
        politics: 'single_hegemon',
        politicsNote:
            'Direct rule. The province is administered by the institution that holds it, through a local bureau of eleven people at the weir, and there are no client sects anywhere in it - no leases, no vassals, no local hierarchy to belong to. The Weir Office looks like a hegemon and is a counter. There is no rivalry here because there is nobody to be rival with: only application, refusal, and an appeal form that is logged and answered years later.',
        factionIds: [
            'sect-weir-office',
            'sect-sixmile-wardens',
            'sect-gleaners-company'
        ],
        branches: [
            {
                parentSectId: 'sect-stonewright-consortium',
                localName: 'The Kettle Assay House',
                doesHere:
                    'Buys salvage, assays and cuts stones, sells them back at nineteen percent over Low Fall, and publishes the insurance table that reads every Marches title one rank low. In a region where imported stones are the only alternative to grant time, the assay house is the second government.'
            },
            {
                parentSectId: 'sect-sweptground-temple',
                localName: 'The Kettle Mission',
                doesHere:
                    'Teaches the Lesser Qi-Gathering Manual and elementless basics free to anyone who turns up, and is the only institution in the region that will tell a carver plainly that their local titles and the standard ladder are the same rungs. Four monks, no face, no grant.'
            }
        ],
        places: [
            { name: 'Kettle', kind: 'market_town', ambient: 'thin', note: 'The Weir Office town: grant queue, assay house, mission, and a permanent dust plume.' },
            { name: 'Hollowmarket', kind: 'village', ambient: 'thin', note: 'The Gleaners\' sorting yard, where salvage is priced before it goes to Kettle.' },
            { name: 'Sixmile', kind: 'hamlet', ambient: 'thin', note: 'A shed, a survey, and the Wardens who repaint the stakes.' },
            { name: 'The Gapwater face', kind: 'site', ambient: 'dense', note: 'One of two workable faces. Grant access at forty stones a day, and a queue of eleven.' },
            { name: 'The Dead Verge', kind: 'site', ambient: 'thin', note: 'The current burn edge. It has moved about nine hundred paces since the survey was drawn.' }
        ],
        exports: [
            'sealed-site salvage, the region\'s only real product',
            'scar-ground herbs that will not fruit on healthy land',
            'carvers, who arrive in the Low Fall lopsided: hard bodies, no formations, no alchemy'
        ],
        imports: [
            'every pill in the region, because alchemy will not hold here',
            'grain, since the burn edge has taken about a fifth of the arable land',
            'spirit stones, which are not savings here but the only substitute for grant time'
        ],
        priceMultiplier: 1.4,
        hazards: [
            'dead ground, which looks like ordinary heath and is silent in a way visitors take a few minutes to identify',
            'burn-edge drift of about a pace a year, faster after wet winters',
            'dust-lung, the region\'s ordinary cause of death, and untreatable locally because pills do not hold',
            'sealed sites shut by people much stronger than anyone now working them'
        ],
        connections: [
            {
                kind: 'trade_route',
                otherRegionId: HOME_REGION_ID,
                description:
                    'The border road to Scarwater: eleven days by cart and the only route that does not cross dead ground. Salvage out, pills and grain in, at a fourteen percent premium before haggling.',
                travelDays: 11
            },
            {
                kind: 'refugee_flow',
                otherRegionId: HOME_REGION_ID,
                description:
                    'Everyone who can leave, leaves - perhaps two hundred a year for a century. It is why the Marches sects are small, why its inheritance disputes are rare, and why the Low Fall has a word for the cough.',
                travelDays: 11
            },
            {
                kind: 'shared_feud',
                otherRegionId: HOME_REGION_ID,
                description:
                    'The Gleaners\' Company and the Bone Lantern Cult both work sealed sites and have been undercutting, robbing and occasionally killing each other across the border for sixty years. Neither region\'s authorities regard it as their problem.',
                travelDays: 11
            },
            {
                kind: 'unsettled_border',
                otherRegionId: HOME_REGION_ID,
                description:
                    'The last forty li before Kettle are on no survey the Anchorhold will certify, so nothing sworn there binds and nothing owned there can be proved. The Gleaners and the Quiet Cut both use it, for opposite reasons.',
                travelDays: 11
            }
        ],
        trueHereFalseThere: [
            'Cultivation is a trade performed standing up with a tool in your hands, and a master carver has an apprentice rather than a disciple.',
            'There is no sect to join. The province is administered directly, so there is no intermediate institution of any kind: a cultivator deals with the administration itself, at a counter, and joining means being processed rather than accepted.',
            'No pill can be made, only imported, so a treatable injury becomes an eleven-day problem or a permanent one.',
            'A cultivator\'s rank is stated in a vocabulary that three parties translate differently, and the commercial table is the one that gets visitors killed.'
        ],
        crossingNotes: [
            'The qi thins about half a day before the border marker and keeps thinning. Cultivation that returned a day\'s progress at home returns something a visitor will first assume is a fault in their own circulation.',
            'Then the sound arrives before the town does: chisels, a couple of hundred of them, carried a long way on flat air.',
            'Everything is grey. Dust on the roofs, on the animals, in the bread, and a pale ring around every local mouth.',
            'The road is staked in painted wood rather than paved, and leaving the stakes is how people die here. The Sixmile Wardens explain this once, free, and are visibly tired of explaining it.',
            'Nobody asks what realm you are. They ask whether you hold a grant, and the answer decides the rest of the conversation.',
            'There are no sect patrols, no admission days and no gates with disciples on them - there is a counter, a register, a queue, and a clerk who is not empowered to make an exception and will say so pleasantly.',
            'Local ranks are trade titles - Chipping, Standing Cut, Keystone - and a visitor who hears "Standing Cut" as a labourer\'s grade has just misread a Foundation Establishment cultivator, which is the ordinary way outsiders get hurt here.',
            'No shop sells a pill above mortal grade, and no alchemist in the region can make one, because refinements do not set in air with nothing in it.',
            'Every carver has split white hands and a cough, including the rich ones, and a visitor with soft hands is assumed to be from the assay house or the mission.'
        ]
    },

    // ── EAST ─────────────────────────────────────────────────────────────
    // The province the catalog has been implying for a long time without ever
    // saying where it was. Six of the thirty-two houses describe themselves as
    // holding rooms in cities - nine reading halls, nine register houses,
    // auction floors in every city of consequence, cutting houses at the edge
    // of six of them - and there was one city in the world for all of it to be
    // in. This is where those rooms are.
    {
        id: EAST_REGION_ID,
        name: 'The Wide Field',
        role: 'adjacent',
        traditionId: 'tradition-drawn',
        summary:
            'The eastern plain: nine walled cities on flat ground over shallow veins, two thousand years of engagements fought across it, and not one institution in it that holds a foot of land. Everything here is rented, priced and renewable, and the ground is rich because of what has died on it.',
        governingFact:
            'There is no high ground. The Wide Field is one flat alluvial plain over veins that run everywhere and deep nowhere, so nothing here can be fortified and nothing here has ever been held for long.',
        derivations: [
            'An institution holds rooms rather than ground - a hall, a floor, a gate house, a stack room - all of it leased from a city that has outlived its last nine tenants, so the unit of value is the lease and a house that misses a renewal has nothing to fall back on',
            'The cities are mortal, ancient and enormous, and every cultivator institution inside one is the tenant of people it could kill in an afternoon; everybody has done that arithmetic, and the answer is that killing your landlord costs you the lease',
            'Ground that cannot be fortified gets fought over instead, so the East has more battlefields than the rest of the world together, and battlefield ground fruits herbs nothing else grows - which makes a killing field an asset with a harvest date',
            'Nothing is granted and nothing is sworn, so obligation here is priced rather than witnessed, and the house that sets the price of a spirit stone is the nearest thing the province has to a government'
        ],
        register: {
            colour: 'brown and gold: dust, wheat, brick, and roof tile that was glazed nine hundred years ago and has not been reglazed since',
            light: 'an enormous flat sky with sunrise and sunset visible end to end, and from the sixth month a permanent haze of field dust that turns the sun orange by noon',
            sound: 'people, and the bells. Nine cities, nine watches a day, and every gate in the province opening and shutting to a schedule a visitor can hear from a li out',
            smell: 'coal smoke, night soil, hot oil, cut wheat, and under all of it in certain fields a sweetness that everybody can identify and nobody names',
            food: 'wheat in every form - hand-pulled noodles, flatbread, boiled dumplings - with mutton, black vinegar, raw garlic, and tea drunk salted'
        },
        customs: {
            socialPrinciple: 'Tenancy. Nobody holds ground, everybody holds a lease, and the lease is priced in assayed stones by a house that holds no ground either. The whole of politics here is the renewal calendar, and it is public.',
            death: 'Burned outside the wall the same day, ashes broadcast on the field, because nine cities on a plain cannot bury two thousand years of people. Anybody who keeps a body is doing something, and everybody assumes the worst of them.',
            taboo: 'Never ask what a field grew before. Everyone knows which fields are battlefields, the price of the crop depends on nobody saying so at the gate, and a visitor who asks in a market has emptied it.',
            threatModel: 'People, in numbers, and the numbers are mortal. What kills a cultivator in the Wide Field is a city deciding it has had enough of them, which it does about once a century and does thoroughly.',
            naming: 'A wall before a clan: Ci of the Fourth Gate, Wan Hongfu out of Ninewatch, Shu Threewall. An easterner who gives a clan name first is either very old money or lying about where they are from.',
            time: 'Nine watches to the day, rung, so the whole province agrees on the hour to a few minutes. It does not agree on the year at all: each city counts from its own charter, and a contract carries three dates and a bell.'
        },
        cultivation: {
            method:
                'Ordinary drawing, on shallow veins that run under everything and are deep under nothing. It is the same road as the Low Fall, it starts faster because the ground is everywhere, and it stops earlier because the ground is thin - which the East explains as talent and which is in fact the plain.',
            ambientRateMultiplier: 0.85,
            methodRateMultiplier: 0.85,
            deviationRiskModifier: 0.01,
            harderBoundaries: [24, 32],
            missingDisciplines: [
                {
                    discipline: 'oath-binding',
                    reason: 'A Bound Word oath binds to certified ground and the Anchorhold has never carried a survey east of the watershed. An oath sworn in the Wide Field is a promise and nothing else, which is why every arrangement here is a lease with a deposit and why the province regards the Low Fall habit of swearing things as a charming affectation.'
                },
                {
                    discipline: 'containment',
                    reason: 'A perimeter needs a datum that stays where it was put, and two thousand years of ploughing, digging, walling and rewalling have left nothing in the East that has been in one place for a century. The Anchorhold maintains no perimeter here, has never applied to, and says so in writing when asked.'
                }
            ],
            strongDisciplines: [
                'appraisal and provenance, because the province is armed and furnished out of its own ground and somebody has to say which age a thing came out of',
                'grave and battlefield reading, which is a real science here with a rotation, a calendar and a price list',
                'severance arts, which work best where there is no certified ground for a cut to be traced across'
            ],
            costNote:
                'Advancement costs rent. There is no cave on a vein to hold and no grant to apply for; there is a room over an assay hall at a rate somebody else sets, and the difference between an easterner who rises and one who does not is almost entirely whether their house made its renewal.',
            localRankNames: FIELD_BANDS
        },
        ambientProfile: { thin: 44, normal: 41, dense: 14, spirit_tide: 1 },
        localCeilingOrdinal: 38,
        ceilingNote:
            'Thirty-eight, and it holds a rented room. Nobody in nine cities has passed the founder of the Severed in living memory, and the reason is the ground rather than the people: the East reliably makes Core Formation in quantity and Nascent Soul rarely, and every single thing above that arrived from somewhere else and is paying rent.',
        veinStatus:
            'Shallow and universal. There is a vein under almost every field in the Wide Field and not one of them is deep enough to be worth a war, which is why the province has never had a vein war and has had two thousand years of every other kind. The rich ground is battlefield ground, and it is rich for the reason everybody knows and nobody states at a market.',
        politics: 'single_hegemon',
        politicsNote:
            'One holder, and what it holds is the rate. Nobody in the Wide Field holds ground, so nobody can be leaned on through a grant; what can be leaned on is the price of an assayed stone, and one house sets that at the head of nine veins and in the assay hall of every city. It is a hegemony that has never fought anybody: it buys the seniors of houses it wants quiet, three of them now have none, and every institution in the province quotes a figure it did not set to pay a rent it cannot refuse.',
        factionIds: [
            'sect-stonewright-consortium',
            'sect-thousand-treasure-pavilion',
            'sect-lantern-hall',
            'sect-the-severed',
            'sect-bone-lantern-cult',
            'house-held-names',
            'house-narrow-hour',
            'house-quiet-cut'
        ],
        branches: [
            {
                parentSectId: 'house-ninefold-ledger',
                localName: 'The Eastern Circuit',
                doesHere:
                    'Nine of the forty-one arbitration benches, sitting in cities where nothing can be sworn and everything has to be proved. It is the busiest half of the Ledger\'s work and the half its auditors least want, because an eastern case is a lease dispute rather than a thread and there is no karma in a lease.'
            },
            {
                parentSectId: 'sect-crimson-abyss-hall',
                localName: 'The Wheatgate Table',
                doesHere:
                    'A table and a cash box outside the admission days of every city hall that runs one, paying the first month in advance to whoever was refused inside that morning. The eastern cities are the only place in the world where a recruiter can sit outside nine doors in one season.'
            }
        ],
        places: [
            { name: 'Ninewatch', kind: 'city', ambient: 'normal', note: 'The largest of the nine, and the city the whole province sets its clocks by. Every hall in it is leased and the leases are public.' },
            { name: 'Thirdwall', kind: 'city', ambient: 'thin', note: 'Walled three times in two thousand years, each wall further out, all three still standing. A third of the city lives between walls nobody defends.' },
            { name: 'Wheatgate', kind: 'market_town', ambient: 'normal', note: 'Where the crop off the old ground is sold, and where nobody at the counter asks what the field grew before it grew this.' },
            { name: 'Mudsummer', kind: 'site', ambient: 'dense', note: 'Twelve thousand died here in one afternoon a hundred and forty years ago, and the ground has been fruiting ever since. The name is what that season was called before it happened.' },
            { name: 'Millrun', kind: 'village', ambient: 'thin', note: 'A river village that was on the river until the river moved four li in one spring three hundred years ago. Nobody renamed it and the mills are still standing.' }
        ],
        exports: [
            'assayed spirit stones and the rate they are assayed at, which is the only export in the world that arrives before the goods do',
            'battlefield herbs on a hundred-and-forty-year rotation, which will not fruit on ground nothing died on',
            'dug goods of every age, with a provenance opinion attached and no question asked about the hole',
            'grain, in the quantity that feeds three provinces, which is why nobody has ever burned a field here'
        ],
        imports: [
            'refined pills and the manuals to make them, all of it out of the Low Fall, because an alchemist needs a still room and rents are what they are',
            'ice-cut stones out of the White Stair, which assay high and are bought at a discount justified by the carriage',
            'anybody who can teach above Core Formation, hired rather than raised, and never for long'
        ],
        priceMultiplier: 0.9,
        hazards: [
            'people in numbers: a city that has decided about you is not a fight, and there is no rank at which it becomes one',
            'battlefield ground, which is corrupt in a way that is worth money and kills the diggers who work it wrong',
            'formations left standing on ground nobody has surveyed since, still lit, still keyed to a house that is nine centuries gone',
            'the renewal calendar, which is not a hazard anywhere else and is the leading cause of institutional death here'
        ],
        connections: [
            {
                kind: 'trade_route',
                otherRegionId: HOME_REGION_ID,
                description:
                    'Six days up the gorge road, and it is the busiest ground in the world: pills, manuals and teachers coming east, stones and grain and appraised loot going west, and four parties taking a cut of each direction.',
                travelDays: 6
            },
            {
                kind: 'unsettled_border',
                otherRegionId: HOME_REGION_ID,
                description:
                    'No certified survey has ever crossed the watershed, so the whole boundary is habit. The Low Fall reads that as the East being lawless and the East reads it as the Low Fall being superstitious about paper.',
                travelDays: 6
            },
            {
                kind: 'shared_feud',
                otherRegionId: HOME_REGION_ID,
                description:
                    'The Bone Lantern Cult works the old grounds on both sides of the watershed and the Verdant Spring Hall has been trying to have it stopped for sixty years, in a province where nothing it says has any force at all.',
                travelDays: 6
            },
            {
                kind: 'sea_crossing',
                otherRegionId: SOUTH_REGION_ID,
                description:
                    'Twenty-one days from the eastern shore to Watering, three seasons in four, and every hull of it is provisioned against a passage with no landfall in the middle. It is how salt reaches nine cities and how what comes off drowned ground reaches an auction floor.',
                travelDays: 21
            }
        ],
        trueHereFalseThere: [
            'Nothing anybody swears binds. There is no certified ground east of the watershed, so an oath is a promise, a treaty is a lease, and every arrangement in the province carries a deposit instead of a witness.',
            'No institution holds a foot of land. Nine cities, thirty-odd halls, floors, gate houses and stack rooms, and every one of them rented from mortals who could evict the strongest thing in the province and have.',
            'A battlefield is an asset with a harvest date, worked on a published rotation by people the rest of the world will not sit next to, and the crop is sold at a market where asking about it empties the room.',
            'The hour is agreed to a few minutes across a whole province and the year is not agreed at all, because the bells are rung and the charters are not.'
        ],
        crossingNotes: [
            'The horizon arrives first. A Low Fall cultivator coming down the gorge road spends the first day unable to judge distance, because nothing here interrupts anything and the sky goes all the way down.',
            'Nobody asks what sect you are. They ask what you are paying and until when, and if the answer is nothing the conversation ends politely and immediately.',
            'The bells. Nine watches a day in nine cities, all of them audible from the road, and a visitor who has not learned the schedule inside a week is late to everything.',
            'Every wall in sight is older than every institution behind it, and the locals will tell you so, unprompted, in a tone the Low Fall finds insufferable.',
            'Somewhere in the second day somebody offers to buy something off you, sight unseen, at a price that is either insulting or extremely good, and there is no way for an outsider to know which.'
        ]
    },

    // ── NORTH ────────────────────────────────────────────────────────────
    // A wasting asset with two institutions standing on it. The governing fact
    // was already in `sects.ts`: the Frostmirror's glacier retreats forty spans
    // below its own working face. A province that knows exactly how long it has
    // is a different sort of place from one that does not.
    {
        id: NORTH_REGION_ID,
        name: 'The White Stair',
        role: 'adjacent',
        traditionId: 'tradition-drawn',
        summary:
            'Above the snowline, past a pass that is shut five months a year: the richest air anybody has ever stood in, in a band forty paces wide, moving uphill. Two institutions, no court, no register, no market and no arbitration, on ground that is measurably worth less every year and knows the figure.',
        governingFact:
            'The qi here is in the ice rather than under it, and the ice is going. What a northerner draws on is the melt face, which has retreated about forty spans in a working lifetime and is still retreating.',
        derivations: [
            'Status is elevation. A holding is a band of altitude rather than an area, everybody\'s band moves uphill by inches a year, and a house that cannot follow the ice up is finished inside three generations - so nobody in the North has ever argued about a boundary',
            'Nothing is built to last, because a hall at the working face is thirty years from being below it, which is why the province has no ruins worth robbing, no inheritance worth suing over and no architecture anybody would cross a pass to see',
            'The whole province is on a clock every party can read: the face figure is published annually and can be gone and looked at, so it is the only number in the world that nobody in a province disputes',
            'A discipline that requires the ground to stay where it was put cannot be practised on ice, so no array has been laid in four hundred years and the two courts that have one inherited it cut into rock - which means a newcomer to the North cannot build a compound, only occupy one'
        ],
        register: {
            colour: 'white, and then blue where the ice is old, and nothing else at all except paint, which is why every worked thing in the province is painted',
            light: 'enormous and flat and coming from underneath as well as above, with no shadow at noon and a glare that blinds anybody who has not blackened under the eyes',
            sound: 'the ice, which is never quiet: a crack carries four li on cold air and everybody stops for a moment and then goes on with what they were doing',
            smell: 'nothing whatsoever, which visitors find distressing inside a day and cannot explain, and which is the first thing a northerner notices about anywhere else',
            food: 'hard cheese, blood, fat, boiled snow, and imported grain that arrives seventeen days old and is rationed against the five months the pass is shut'
        },
        customs: {
            socialPrinciple: 'One curriculum and one holder of it. There is no politics of territory because the territory moves, and no politics of patronage because there is nothing to grant; there is only whether the Court will teach you, which your root decides and nothing you can offer changes.',
            death: 'The dead go into the ice at the face, and the ice gives them back about a century later at a lower band, in good condition, still recognisable. This is ordinary, there is a form for it, and the rest of the world regards it as the single most disturbing thing about the province.',
            taboo: 'Never cut below the working face. Taking ice that has not melted yet is stealing from the next century, and it is the one offence the North punishes rather than merely disapproving of.',
            threatModel: 'The ground, which is not ground. Crevasse fields under new snow that move every year and are surveyed by nobody, and cold that kills a Foundation cultivator in an afternoon if they stop walking.',
            naming: 'Elevation names: a person carries the band they were born at. Nine Hundred Ren, Above-the-Face Bai, Low Xu. A name goes down over a lifetime as the bands do, and everybody can hear how far.',
            time: 'Counted in retreats rather than years - four retreats ago is about a century - so two northerners can disagree about the date by twenty years without either of them being wrong or thinking the question interesting.'
        },
        cultivation: {
            method:
                'Drawing off the melt face: the qi comes out of the ice as the ice goes, in a band about forty paces wide that moves uphill every year. Everybody in the province cultivates inside that band or does not cultivate, and the band is not large enough for the province.',
            ambientRateMultiplier: 0.6,
            methodRateMultiplier: 1.8,
            deviationRiskModifier: 0.02,
            harderBoundaries: [12, 24],
            missingDisciplines: [
                {
                    discipline: 'formations',
                    reason: 'An array is laid on ground that stays where it is put, and ice does not: stones set in ice go out of square inside a decade and out of use inside two. The exception is the one the Quiet Marches already uses - a node cut into rock holds - so the two courts that predate the retreat have working perimeters on stone and nobody has laid a new array in the province in four hundred years. Nothing can be laid at the working face at all, which is the part that matters, because the face is where the qi is and it is the one place in the province a formation could not be worth having.'
                }
            ],
            strongDisciplines: [
                'ice arts, which exist nowhere else in the world because the curriculum was sealed in the ice and was dug out rather than inherited from anybody',
                'cold work on the body, which every northerner has whether they cultivate or not and which visitors mistake for a discipline',
                'reading a moving face, which is a survey trade practised on something that will not hold still and is the one skill the province sells'
            ],
            costNote:
                'Advancement costs altitude and a root. A season in the forty paces costs about what a season costs anywhere, and the Court will not sell one to anybody without a mutated ice root on the stated grounds that the arts kill everyone else. There is no second seller and there has never been one.',
            localRankNames: STAIR_BANDS
        },
        ambientProfile: { thin: 55, normal: 18, dense: 22, spirit_tide: 5 },
        localCeilingOrdinal: 36,
        ceilingNote:
            'Thirty-six, and it is a person rather than a property of the ground. Nobody in the White Stair has passed the Frostmirror Sovereign in living memory, and the ceiling is not the air, which is the best in the world: it is that one Court holds the only curriculum that survives standing in it, and everyone else in the province stops where the cold does.',
        veinStatus:
            'The cold vein is in the ice rather than under it, which is why nobody else can work it and why it is going. The face has retreated about forty spans in a working lifetime, the Court publishes the figure every year and anybody can walk up and check it, so the White Stair is the only province in the world that knows exactly how long it has left.',
        politics: 'competing_sects',
        politicsNote:
            'Two institutions and nothing else. Neither is granted through a court - both hold directly from an apex, on the one arterial in the world that has no administrator - so the province has no arbitration bench, no register, no assay house, no grant book and no third party of any kind to appeal to. What it has instead of politics is one running quarrel between a court that is climbing and a court that is falling, and neither can finish the other: one cannot reach a floating stone and the other cannot hold a glacier.',
        factionIds: [
            'sect-frostmirror-court',
            'sect-storm-tyrant-court'
        ],
        branches: [
            {
                parentSectId: 'sect-cinnabar-crucible-guild',
                localName: 'The Cold Crucible at Rimefall',
                doesHere:
                    'Four furnaces and a price list, and the only alchemy in the province. It stands here because the Guild\'s grant comes from the Frostmirror rather than from the Third Sill, which is an arrangement neither province has a document for and neither has asked about.'
            },
            {
                parentSectId: 'house-measured-span',
                localName: 'The Fourhands Terminal',
                doesHere:
                    'One of the nine stations, at the head of the pass, an hour from a station seventeen days\' walk away. It is the only reason anything reaches the North in the five months the road is shut, it opens four days in nine, and the Frostmirror pays for it in stones without ever having said what for.'
            }
        ],
        places: [
            { name: 'Rimefall', kind: 'sect_town', ambient: 'dense', note: 'The Frostmirror\'s town, moved uphill four times in four hundred years and carrying its name with it each time. Nothing in it is more than a century old.' },
            { name: 'The Giving', kind: 'site', ambient: 'spirit_tide', note: 'Forty paces of live ice where the qi comes out as the ice goes. Everybody calls it the Giving and nobody says what it is giving, or for how much longer.' },
            { name: 'Underhang', kind: 'site', ambient: 'thin', note: 'The ground beneath the floating stone: permanently in shadow, permanently in weather, and where the tether is inspected once a year by people who cannot repair it.' },
            { name: 'Undersnow', kind: 'village', ambient: 'thin', note: 'The last band anybody still lives at, four retreats below the face, and emptying at about nine households a decade.' },
            { name: 'Fourhands', kind: 'waystation', ambient: 'thin', note: 'The station at the head of the pass, named for the four men who kept it the winter it was cut. Three of them are in the wall and there were five.' }
        ],
        exports: [
            'ice-cut stones, which assay high and shatter if they are cut warm, so the whole trade moves in winter or not at all',
            'the only complete ice curriculum in the world, which is not for sale and is the reason anybody crosses the pass',
            'the face figure, published annually, which two provinces now use to price a carriage contract nobody in the North is party to'
        ],
        imports: [
            'grain, all of it, because nothing grows above the last inhabited band and the last band is going',
            'timber and every worked thing, since a province that moves uphill builds nothing twice and repairs nothing at all',
            'people with mutated ice roots, who are sent here from every province the moment somebody identifies one, and who mostly arrive alone'
        ],
        priceMultiplier: 1.7,
        hazards: [
            'cold that kills a Foundation Establishment cultivator in an afternoon if they stop walking, and does not care what realm anybody is',
            'crevasse fields under new snow, which move every year, are surveyed by nobody, and are the reason the road is staked and the stakes are not enough',
            'beasts that follow the face uphill and are only ever met above the last inhabited band, where there is nobody to tell anybody afterwards',
            'the working face itself, which calves without warning and has taken eleven people in nine years, all of them at the same band'
        ],
        connections: [
            {
                kind: 'trade_route',
                otherRegionId: HOME_REGION_ID,
                description:
                    'Seventeen days over the pass, shut five months a year: grain and timber up, ice-cut stones down, and a five-month gap every winter that the whole province is provisioned against and occasionally gets wrong.',
                travelDays: 17
            },
            {
                kind: 'shared_institution',
                otherRegionId: HOME_REGION_ID,
                description:
                    'The Frostmirror grants to an alchemy guild standing on a volcanic flank in another province, on the arterial that runs under both of them. It is the only lease in the world that crosses a provincial border, and neither province has a document that admits it exists.',
                travelDays: 17
            },
            {
                kind: 'sea_crossing',
                otherRegionId: SOUTH_REGION_ID,
                description:
                    'Thirty-four days round the western capes to a northern inlet, open two months a year, and the only route into the White Stair that does not pass through the Low Fall. Everything the Court would rather not have counted at a gorge counter comes this way, and about one hull in five does not arrive.',
                travelDays: 34
            }
        ],
        trueHereFalseThere: [
            'A holding is an elevation rather than an area, and every one of them moves uphill about forty spans in a working lifetime, so nobody in this province has ever argued about a boundary with anybody.',
            'Nobody can lay an array. Stones set in ice go out of square inside a decade, so the only working perimeters in the province are two that were cut into rock before the retreat began, and nothing has been laid here in four hundred years - least of all at the face, which is the one place worth defending.',
            'The dead come back. The ice returns what was put into it about a century later, at a lower band, in good condition and recognisable, and there is an ordinary administrative form for what to do about it.',
            'Everybody agrees the year to within twenty years and nobody agrees it closer, because the year here is a measurement of a moving face rather than a count of anything.'
        ],
        crossingNotes: [
            'The air gets better and then it turns out to be useless. A visitor notices the density climbing on the pass and assumes their luck has changed; it has not, because the qi is in a band forty paces wide that somebody else stands in.',
            'Nothing is square. Every wall leans, every door sticks, and the locals stopped treating either as a defect several centuries ago.',
            'The first question is not what realm you are and not whether you hold a grant. It is what your root is, and if the answer is not ice the conversation ends and nobody involved was being rude.',
            'There is no smell. A visitor from anywhere finds this distressing inside a day and usually cannot work out what is wrong with them until somebody tells them.',
            'Somebody says a year and means a face position, and a visitor who converts it to a date has just made an error of about twenty years that nobody local will think to correct.'
        ]
    },

    // ── SOUTH: THE WATER ─────────────────────────────────────────────────
    // This is not a fifth landmass. Every fact below follows from one sentence
    // in `docs/world/qi.md` - qi pools in veins, and veins are features of the
    // LAND - taken seriously rather than waived. There is no ground under the
    // open sea, so there is no vein, so there is nothing in the air; a
    // cultivator out here is on the same footing as a cultivator anywhere the
    // ambient will not carry them, which is to say they are burning stones.
    //
    // NOTHING HERE IS A MARITIME SUBSYSTEM. There are no ships in this file,
    // no hull rules, no weather table and no navigation. What is here is a
    // province whose numbers make maritime play possible and obviously wanted:
    // the lowest ceiling and the lowest rate in the world, the highest price
    // multiplier, a link kind the engine cannot yet read, and two institutions
    // that hold nothing. What it would need is named in `RegionConnectionSchema`
    // above and in `hazards` below, and it is somebody else's task.
    {
        id: SOUTH_REGION_ID,
        name: 'The Drowned Reach',
        role: 'adjacent',
        traditionId: 'tradition-drawn',
        summary:
            'Open water south of everything, with a drowned mountain range under it whose peaks are the islands. There is no vein within reach of anybody, so there is nothing in the air; cultivation out here is bought by the day out of a stone chest, and every institution that has ever tried to hold a strait has held it on paper.',
        governingFact:
            'There is no ground under you. Qi pools in veins and a vein is a feature of the land, and the land here is a hundred fathoms down, so the ambient over open water is not thin - it is absent, and it does not vary, season or run out, because there is none of it.',
        derivations: [
            'Cultivation at sea is purchased rather than drawn: a cultivator on open water burns assayed stones to hold what they have and burns more to gain anything, so a passage is priced in stones per head per day before it is priced in anything else',
            'Territory over water is a claim and never a fact, because closing a strait means keeping a hull on it in the weather every day of the year and nobody does - so a house that claims a strait and a house that can close one are different houses, and the second kind has never existed here',
            'The only ground is the islands, and an island is a drowned mountain with its vein under the sea, so every scrap of workable ground in the province is small, is somebody\'s, and is also the only place anybody can take on fresh water',
            'A Cut cultivator carries their vein in the stone they work and a Drawn cultivator carries theirs in a chest that empties, which makes this the one province in the world where the losing tradition is the stronger of the two, and neither of them holds a foot of it'
        ],
        register: {
            colour: 'grey and white with no line between them for days at a time, and the only strong colour anywhere in the province is paint on a hull',
            light: 'too much of it, and half of it from underneath: everybody at sea squints, and anybody who has been out five years has white lines at the corners of their eyes',
            sound: 'one sound, continuously, that a passenger stops hearing on the third day and then cannot sleep without for the rest of their life',
            smell: 'salt, tar, wet rope, and fish drying on every rail from the day a hull leaves to the day it makes a landfall',
            food: 'fish, fish, and rice carried in sealed stone jars, with fresh water rationed by the cup and counted aloud at the same hour every day'
        },
        customs: {
            socialPrinciple: 'None. Nothing on this water is granted, arbitrated, surveyed or certified, and the only two institutions that function here are the two whose entire doctrine was never holding anything in the first place.',
            death: 'Over the side, weighted, with the name said once and not written down. The Drowned Reach is the only province in the world that keeps no record of its dead, and all four of the others regard this as barbarism and say so.',
            taboo: 'Never count the stone chest aloud. What is in it is what everybody aboard is standing on, and saying the figure where it can be heard is the moment a crew stops being a crew and becomes a number of people with an interest.',
            threatModel: 'The weather and the arithmetic, in that order and usually together. Most people who die in the South die because a passage took eleven days longer than it was provisioned for, which is not misfortune, it is a sum somebody did wrong ashore.',
            naming: 'Hulls and landfalls instead of clans: Bell of the Third Landfall, Ma out of Kettle, Watering Xu. A person at sea is named for where they came aboard, and nobody asks past that.',
            time: 'Counted in passages and in stones burned. Nine passages is a career; a hull\'s age is the number of stones it has gone through, cut into the mast where anybody can read it, and it is the one figure in the province nobody argues with.'
        },
        cultivation: {
            method:
                'Burning. There is nothing in the air, so a cultivator at sea spends assayed stones to make progress exactly the way anybody anywhere spends them where the ground will not carry them. That is the ordinary rule from the ordinary system, and out here it is the whole of the rule rather than the exception to it.',
            ambientRateMultiplier: 0.05,
            methodRateMultiplier: 1,
            deviationRiskModifier: 0.06,
            harderBoundaries: [],
            missingDisciplines: [
                {
                    discipline: 'ordinary drawing',
                    reason: 'The standard method is taking qi out of the air and the air over deep water has none in it - not thin, absent. A Drawn cultivator on open water does not slow down, they stop, and everything they do from that hour on is paid for out of the chest. This is the single most important fact about the province and it is not a rule about the province: it is what the ambient system already says about ground with no vein under it.'
                },
                {
                    discipline: 'formations',
                    reason: 'A formation is laid on ground, and the ground is a hundred fathoms down. Every array anybody has tried to carry on a hull has failed the same way - it holds while the hull is still and comes apart the moment it is not, and there is no still hull.'
                }
            ],
            strongDisciplines: [
                'the stone economy, which everybody at sea can do in their head to a day, because a mistake in it is not a loss, it is the manner of death',
                'weather reading, which is not a cultivation art in any other province and is treated as one here by people who would be insulted to be told otherwise',
                'the Cut method, which is the only method that works out here and which nobody in the Drowned Reach was ever taught'
            ],
            costNote:
                'Advancement costs stones and costs nothing else, because nothing else is for sale. A day at sea is a fixed burn against a fixed chest, which makes this the only province where a cultivator\'s progress can be worked out exactly, in advance, on a counting board, by somebody who has never met them.',
            localRankNames: REACH_BANDS
        },
        ambientProfile: { thin: 96, normal: 3, dense: 1 },
        localCeilingOrdinal: 2,
        ceilingNote:
            'Three layers on the islands and nothing at all on open water, which makes it the lowest ceiling in the world by a distance. Nobody born in the Drowned Reach has passed Qi Condensation Layer 3 without leaving or without a chest somebody else paid for, and the reason is not that the ceiling is low: it is that there is no ground underneath it.',
        veinStatus:
            'There are veins under the Drowned Reach and every one of them is a hundred fathoms down. What put them there is not recorded anywhere anybody has read; what is recorded is the shape, which is a mountain range with its peaks above water, so every island in the province is a vein head with the whole of its vein out of reach beneath it.',
        politics: 'no_authority',
        politicsNote:
            'Nothing at all: no grant book, no bench, no court, no survey, no apex and no province in the administrative sense, because nothing here can be held and therefore nothing here can be given. Four straits are claimed by parties ashore and all four claims are sentences in documents. Two institutions operate on this water and neither holds anything - one because its whole doctrine is leaving, one because it never had anywhere to be - and that is not a gap in the province, it is the only kind of institution the province can support.',
        factionIds: [
            'house-measured-span',
            'sect-hollow-bell-wanderers'
        ],
        branches: [
            {
                parentSectId: 'sect-clear-river-alliance',
                localName: 'The Mouth Ferries',
                doesHere:
                    'Takes a hull from the river mouth as far as Watering and refuses to go one landfall further, on the stated principle that a ferryman who cannot see both banks is a passenger. It is the only regular service between the land and the water and it has never lost a hull, which is the same fact twice.'
            },
            {
                parentSectId: 'sect-thousand-treasure-pavilion',
                localName: 'The Watering Floor',
                doesHere:
                    'One auction floor on one island, sitting three weeks from the nearest city, buying what comes off drowned ground and asking nothing about which island it came off. Its appraisers are the only people in the world who can date something that has been underwater and they will not say how.'
            }
        ],
        places: [
            { name: 'Watering', kind: 'market_town', ambient: 'thin', note: 'The only island on the eastern passage with fresh water on it, which is the entire reason there is a town there and the entire reason four parties claim it.' },
            { name: 'Bellhead', kind: 'waystation', ambient: 'thin', note: 'A headland with a bell on it. A hull that rings it has come through, and a hull that does not is counted, and the counting is the only record anybody keeps out here.' },
            { name: 'The Sounding', kind: 'site', ambient: 'dense', note: 'One rock stands on a vein head that breaks the surface at low water. It is the best ground in the province, it is about forty paces across, and everybody waters at it.' },
            { name: 'Dryrun', kind: 'site', ambient: 'thin', note: 'The stretch of the eastern passage with no landfall in it. The name is a joke about the water ration and nobody finds it funny after the fourth day.' },
            { name: 'Farside', kind: 'waystation', ambient: 'thin', note: 'A gate station on a shore three weeks\' sail out and one hour from the Low Fall, when it opens, which is four days in nine and never in a storm.' }
        ],
        exports: [
            'passage, priced in stones per head per day, which is the only thing this province sells that anybody ashore actually wants',
            'salt, in quantity, which is why four straits are claimed at all and why the claims are worth writing down even though they are worth nothing else',
            'what comes off drowned ground, since an island is the top of something people used to walk on and they left things there before the water arrived'
        ],
        imports: [
            'every grain of food beyond what a rail can dry, and it arrives salted and is eaten salted',
            'fresh water in sealed stone jars, which is the actual binding constraint on every passage in the province and the reason the map is a list of wells',
            'spirit stones, which here are not savings and not fuel: they are the ground, and a hull with an empty chest is standing on nothing'
        ],
        priceMultiplier: 2.2,
        hazards: [
            'storms that shut a passage for a season at a time, and are the only authority on this water that anybody obeys',
            'water with no vein under it, where the ambient is thinner than any land in the world and a cultivator who stops paying stops',
            'beasts in deep water, which are ordinary beasts met on ground nobody can retreat across, at a distance from help measured in weeks',
            'a stone chest that runs out, which is the ordinary cause of death here, is arithmetic rather than misfortune, and is always somebody ashore having been wrong'
        ],
        connections: [
            {
                kind: 'trade_route',
                otherRegionId: HOME_REGION_ID,
                description:
                    'Nine days down the river and out to Watering, which is where the Low Fall\'s river stops being a river. Salt and drowned goods up, pills and grain down, and the Alliance turns round at the first landfall every time.',
                travelDays: 9
            },
            {
                kind: 'sea_crossing',
                otherRegionId: EAST_REGION_ID,
                description:
                    'Twenty-one days from Watering to the eastern shore, three seasons in four, across a stretch with no landfall in the middle of it. It is the busiest water in the province and every hull on it is a sum that has to come out right.',
                travelDays: 21
            },
            {
                kind: 'sea_crossing',
                otherRegionId: NORTH_REGION_ID,
                description:
                    'Thirty-four days round the western capes to a northern inlet, open two months a year, and the only route between two provinces that does not pass through the Low Fall. About one hull in five does not arrive and the trade continues, which says exactly what the alternative is worth.',
                travelDays: 34
            },
            {
                kind: 'refugee_flow',
                otherRegionId: HOME_REGION_ID,
                description:
                    'People who have run out of provinces. Nobody is born onto this water in any number, so the Reach is populated almost entirely by arrivals, and a hull will take anybody who can pay the burn and asks nothing whatever about why.',
                travelDays: 9
            }
        ],
        trueHereFalseThere: [
            'The standard method does not work. There is no vein within reach of anybody, so a Drawn cultivator on open water does not progress slowly, they progress not at all, and everything they gain is bought out of a chest that empties.',
            'Nothing is held. Four straits are claimed and no claim has ever been enforced for a single season, because closing water means keeping a hull on it in the weather every day and no institution in the world has ever done that.',
            'A cultivator\'s progress can be calculated exactly, in advance, by a stranger with a counting board, because it is a fixed burn against a fixed chest and there is no other term in the sum.',
            'The dead are not written down. This is the only province that keeps no record of them at all, and the other four have separate and equally confident explanations of what that says about the people out here.'
        ],
        crossingNotes: [
            'It goes first and it goes all at once. Within half a day of losing the coast the ambient is not thin, it is gone, and a cultivator who has never been out feels it as an injury and reaches for a physician.',
            'Somebody explains the burn on the first evening, with a board, and the number is per head per day and does not care what realm anybody is. It is the only place in the world where a Core Formation cultivator and a porter are quoted the same figure.',
            'The water ration is counted aloud at the same hour every day and everybody stops to hear it, including people who have made the passage forty times.',
            'Nobody asks what sect you are, what grant you hold or what your root is. They ask where you came aboard, and that is the whole of your name for the length of the passage.',
            'There is no horizon to judge anything against and no sound but the one, and a passenger from any province ashore sleeps badly for three nights and then better than they have in years.'
        ]
    }
];

// ─────────────────────────────────────────────────────────────────────────
// INDICES + LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const REGION_BY_ID: ReadonlyMap<string, Region> = new Map(REGIONS.map(r => [r.id, r]));

const REGION_BY_FACTION: ReadonlyMap<string, string> = (() => {
    const map = new Map<string, string>();
    for (const region of REGIONS) {
        for (const factionId of region.factionIds) map.set(factionId, region.id);
    }
    return map;
})();

export function getRegion(id: string): Region | undefined {
    return REGION_BY_ID.get(id);
}

export function requireRegion(id: string): Region {
    const r = REGION_BY_ID.get(id);
    if (!r) throw new Error(`Unknown region: ${id}`);
    return r;
}

export function getHomeRegion(): Region {
    return requireRegion(HOME_REGION_ID);
}

export function getRegionForFaction(factionId: string): Region | undefined {
    const id = REGION_BY_FACTION.get(factionId);
    return id ? REGION_BY_ID.get(id) : undefined;
}

export function getBranchesOf(factionId: string): { region: Region; branch: RegionBranch }[] {
    const out: { region: Region; branch: RegionBranch }[] = [];
    for (const region of REGIONS) {
        for (const branch of region.branches) {
            if (branch.parentSectId === factionId) out.push({ region, branch });
        }
    }
    return out;
}

/**
 * The local name for a rank. This is a relabelling of the shared ladder and
 * nothing else: the ordinal passed in is the ordinal that comes back out.
 */
export function localRankBand(regionId: string, ordinal: number): LocalRankBand | undefined {
    const clamped = Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
    return requireRegion(regionId).cultivation.localRankNames
        .find(b => clamped >= b.fromOrdinal && clamped <= b.toOrdinal);
}

export function localRankName(regionId: string, ordinal: number): string | undefined {
    return localRankBand(regionId, ordinal)?.localName;
}

/** Known cases where the realm is obvious and the position inside it is not. */
export function rankMisreadingFor(localName: string): typeof RANK_MISREADINGS[number] | undefined {
    const needle = localName.trim().toLowerCase();
    return RANK_MISREADINGS.find(m => m.localName.toLowerCase() === needle);
}

/**
 * Read a local title back to the ordinals it covers, with the disputes
 * attached. The band is authoritative; the disputes are what parties in the
 * world believe, and at least one of them is wrong in a way that kills people.
 */
export function translateLocalTitle(regionId: string, localName: string): {
    band: LocalRankBand;
    fromOrdinal: number;
    toOrdinal: number;
    standardName: string;
    disputes: readonly TitleTranslation[];
} | undefined {
    const needle = localName.trim().toLowerCase();
    const band = requireRegion(regionId).cultivation.localRankNames
        .find(b => b.localName.toLowerCase() === needle);
    if (!band) return undefined;
    return {
        band,
        fromOrdinal: band.fromOrdinal,
        toOrdinal: band.toOrdinal,
        standardName: band.standardName,
        disputes: TITLE_TRANSLATIONS
    };
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

/**
 * The provinces' contrast, as a table a tool can render directly.
 *
 * One row per aspect, one column per region, in catalog order. It was two
 * columns while there were two provinces; the shape had to change because a
 * `home`/`adjacent` pair silently stops being the world the moment there is a
 * third province, and a table that quietly omits three fifths of the map is
 * worse than no table.
 */
export function regionContrast(): {
    aspect: string;
    byRegion: Record<string, string | number>;
}[] {
    const row = (
        aspect: string,
        pick: (r: Region) => string | number
    ): { aspect: string; byRegion: Record<string, string | number> } => ({
        aspect,
        byRegion: Object.fromEntries(REGIONS.map(r => [r.id, pick(r)]))
    });
    return [
        row('factions seated', r => r.factionIds.length),
        row('tradition', r => r.traditionId),
        row('politics', r => r.politics),
        row('local ceiling (ordinal)', r => r.localCeilingOrdinal),
        row('ambient rate multiplier', r => r.cultivation.ambientRateMultiplier),
        row('disciplines that do not work', r => r.cultivation.missingDisciplines.length),
        row('price multiplier', r => r.priceMultiplier),
        row('places written', r => r.places.length),
        row('reachable provinces', r => new Set(r.connections.map(c => c.otherRegionId)).size)
    ];
}

// ─────────────────────────────────────────────────────────────────────────
// PLACE NAMES FOR THE GENERATED HALF OF THE MAP
//
// A seeded world holds twelve ruins and eight scars, and every one of them is
// currently called `the sealed compound at Lowhollow` or `the scar at
// Coldmouth`. That is the LocationKind leaking into the fiction: nobody in this
// world calls a place a sealed compound, and a scar is not called a scar by the
// people who watched it happen.
//
// WHERE IT COMES FROM, EXACTLY. Not this file. Two call sites, both in the
// world engine:
//
//   src/engine/world/history.ts:1221   name: `the sealed compound at ${seat}`
//   src/engine/world/locations.ts:1709 name: `the scar at ${scar.location}`
//
// `seat` and `scar.location` are themselves generated, by PLACE_HEAD x
// PLACE_TAIL at history.ts:864-871, and that half is fine: Sweptfall and
// Coldmouth sit beside Sweptground and Scarwater without embarrassing
// themselves. The defect is the concatenated kind in front of them, and it
// cannot be fixed from here because `src/engine/world/` is not this file's to
// edit. Both lines should draw from the tables below instead - the bridge is
// `loadCultivationCatalog()` in `engine/world/catalog.ts`, which is already the
// one sanctioned place content reaches the world layer.
//
// THE RULE THE TABLES OBEY, so a later addition matches:
//
//   1. Never the kind. No "Ruin of", no "Sealed Compound of", no "the X Scar".
//      If a reader cannot tell what sort of place it is without a label, that
//      is what the description field is for.
//   2. One of five sources, and the source is recorded per entry so the rule
//      stays checkable: what is visibly there, what happened, who held it (in
//      the possessive, and only where the holder is gone), what people do there
//      now, or a name that is wrong.
//   3. Slightly too plain for what it describes. The province kept saying it
//      because the province was there, not because it was apt.
//   4. It must not sound like a faction. `sects.ts` names are very good and the
//      registers must not blur - a place is duller than a house, always.
// ─────────────────────────────────────────────────────────────────────────

export const PlaceNameSourceSchema = z.enum([
    'what_is_visibly_there',
    'what_happened',
    'who_held_it',
    'what_people_do_there_now',
    'a_name_that_is_wrong'
]);
export type PlaceNameSource = z.infer<typeof PlaceNameSourceSchema>;

export const GeneratedPlaceNameSchema = z.object({
    name: z.string().min(1),
    source: PlaceNameSourceSchema,
    /** What the name is actually recording, in one line. */
    records: z.string().min(20)
});
export type GeneratedPlaceName = z.infer<typeof GeneratedPlaceNameSchema>;

/**
 * Names for a sealed compound: the walled seat of a house that fell, shut from
 * the inside in a richer age, with its manuals and its people still in it.
 *
 * Twenty against a draw of twelve, so a seeded world does not repeat.
 */
export const RUIN_NAMES: readonly GeneratedPlaceName[] = [
    { name: 'Ninebell', source: 'what_happened', records: 'The bells were counted on the last night and the count was passed outward. There were seven.' },
    { name: 'Quan\'s Shelf', source: 'who_held_it', records: 'A surname nobody in the province can now attach to anything else, on a terrace anybody can see from the road.' },
    { name: 'The Warm Gate', source: 'a_name_that_is_wrong', records: 'It has been cold for nine hundred years. The name is older than the sealing and was never revised.' },
    { name: 'Halfroof', source: 'what_is_visibly_there', records: 'What is left standing above the wall line, which is about half of one roof.' },
    { name: 'Threestone', source: 'what_is_visibly_there', records: 'Three array stones out of a ring nobody has ever counted the rest of.' },
    { name: 'The Millet Yard', source: 'a_name_that_is_wrong', records: 'Nothing has grown in it in an age, and the surrounding villages still call it that at market.' },
    { name: 'Digging', source: 'what_people_do_there_now', records: 'The only thing that has happened there for four hundred years, done by whoever is broke that season.' },
    { name: 'Nothing Standing', source: 'what_happened', records: 'What the first party back reported, which turned out to be wrong by about eleven buildings.' },
    { name: 'Muyang', source: 'who_held_it', records: 'The house name, used flat, with no honorific and no form of words around it.' },
    { name: 'Sixty Doors', source: 'what_is_visibly_there', records: 'Counted from outside by somebody who could not get through any of them.' },
    { name: 'The Long Rota', source: 'what_happened', records: 'The duty roster was still being kept for two years after the sealing, and the last page is legible.' },
    { name: 'Went Under', source: 'what_happened', records: 'Said of the seat rather than of the ground, and said the same way about a person.' },
    { name: 'Coldwell', source: 'what_is_visibly_there', records: 'The only well outside the wall, still good, and the reason anybody camps there at all.' },
    { name: 'Bai\'s Shortcut', source: 'who_held_it', records: 'A path around the perimeter named for the last steward, who was not using it to get anywhere.' },
    { name: 'The Wide Door', source: 'a_name_that_is_wrong', records: 'It is narrow, it faces the wrong way, and every account since the fall has called it wide.' },
    { name: 'Fivewinter', source: 'what_happened', records: 'How long the compound answered after it was shut, counted by the people who kept coming back to check.' },
    { name: 'Hookyard', source: 'what_people_do_there_now', records: 'Where the diggers dress and sort before they go in, named for the tools they leave in it.' },
    { name: 'The Second Wall', source: 'what_is_visibly_there', records: 'There is no first wall any more, so the surviving one is still called the second.' },
    { name: 'Ren\'s Landing', source: 'who_held_it', records: 'A stair head that carries the name of a Warden nobody can now place in any roll.' },
    { name: 'The Quiet Course', source: 'a_name_that_is_wrong', records: 'It is not quiet, it has never been quiet, and everybody who has been in says so and goes on calling it that.' }
];

/**
 * Names for a scar: ground something did to, permanently thin, that people
 * were standing near enough to name.
 *
 * Fourteen against a draw of eight. A scar name should be plainer than a ruin
 * name, because the people who chose it were describing weather.
 */
export const SCAR_NAMES: readonly GeneratedPlaceName[] = [
    { name: 'The Burn', source: 'what_happened', records: 'What the nearest village called it that week, and did not stop calling it.' },
    { name: 'Fourdays', source: 'what_happened', records: 'How long it took, counted from a hill by people who could not do anything else.' },
    { name: 'The Flat', source: 'what_is_visibly_there', records: 'It was not flat before, and the word does the whole of the work.' },
    { name: 'Nothing Grows', source: 'what_is_visibly_there', records: 'Stated as a fact rather than as a name, and used as one for two hundred years.' },
    { name: 'Wenzhi\'s Field', source: 'who_held_it', records: 'The farmer who held the ground, named because nobody could name what did it.' },
    { name: 'The Good Ground', source: 'a_name_that_is_wrong', records: 'It was, and the surveys still carry the old entry, and every local knows better.' },
    { name: 'Standing Water', source: 'what_is_visibly_there', records: 'It has not drained since, and nothing will drink it.' },
    { name: 'Threeyear', source: 'what_happened', records: 'The interval before anybody would cross it, agreed by nobody and observed by everybody.' },
    { name: 'The Short Way', source: 'a_name_that_is_wrong', records: 'It is the short way and it costs a day to go round, which is the joke and the warning at once.' },
    { name: 'Gleaning', source: 'what_people_do_there_now', records: 'People still work the edges for what the ground gives up, and are known by it.' },
    { name: 'Cutbank', source: 'what_is_visibly_there', records: 'The edge is sharp, and the sharpness of the edge is the thing everybody remarks on.' },
    { name: 'The Old Crossing', source: 'a_name_that_is_wrong', records: 'Nobody has crossed it in two centuries and the road signs have never been changed.' },
    { name: 'Hemu\'s Rest', source: 'who_held_it', records: 'A waystation keeper who did not leave, whose name outlasted the waystation and the road.' },
    { name: 'Whitewater', source: 'what_is_visibly_there', records: 'The stream that comes off it runs pale and has done since, and the colour is the name.' }
];

/** Ambient states present in a region at all, commonest first. */
export function ambientStatesIn(regionId: string): AmbientQi[] {
    const profile = requireRegion(regionId).ambientProfile;
    return (Object.entries(profile) as [AmbientQi, number][])
        .filter(([, share]) => share > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([state]) => state);
}

// ─────────────────────────────────────────────────────────────────────────
// PROVINCES, ARTERIALS AND PREFECTURES
//
// The tier below the apexes, made concrete. `FACTION_PARENTAGE` already says
// who holds from whom; this says WHERE, so that a grant is a place somebody
// can stand in rather than a line in a record.
//
// NOTHING HERE IS NEW GEOGRAPHY. Every name below was already forced by a
// number somewhere else in the catalog and has simply never been said out
// loud:
//
//   - the Deep Survey `holds` four arterials beneath the Low Fall, and there
//     are four Surveyors, one per arterial. So there are four arterials, and
//     they are named here.
//   - the Long Cut holds driven ground across FIVE provinces and the Ninth
//     Face Court administers "the Quiet Marches and four provinces beyond it".
//     So there are five, and Chi Yuanru's schedule bands are what tells them
//     apart.
//   - `court-third-sill` administers the third arterial, sits in the Low Fall,
//     and its `apexId` is `apex-long-cut`. That is not a note about a court.
//     It means the arterial that every surveyed vein in the Deep Survey's one
//     province branches from is administered by the other apex, and neither
//     of them has ever said so in a document.
//
// THE ASYMMETRY IS THE FINDING, and it was sitting in the data. The Long Cut
// is broad and shallow: five provinces, forty staff, everything administered
// directly, nothing delegated. The Deep Survey is narrow and deep: ONE
// province, four arterials under it, a filled ladder, and a storehouse it has
// already spent. An apex is not a bigger sect, and the two of them are not
// even the same shape.
//
// CONTRAST, NOT ADDITION
// ----------------------
// `docs/world/making-places-different.md` names the failure this section is
// most likely to commit: a gazetteer of interchangeable places with the proper
// nouns swapped. Two defences are built in.
//
//   1. A PREFECTURE IS NOT THE SAME KIND OF OBJECT IN THE TWO PROVINCES, and
//      the difference falls out of each region's governing fact rather than
//      being decorated on afterwards. The Low Fall's qi is in horizontal
//      surveyable veins, so a Low Fall prefecture is a CATCHMENT: a line on a
//      survey, held by a named institution with a gate, arbitrable, permanent,
//      inheritable, and argued about in writing. The Marches' qi is in the
//      stone, so a Marches prefecture is a FACE DISTRICT: a schedule entry
//      held by an OFFICE rather than by a sect, whose boundary is wherever the
//      work currently is, which moves when the work moves and stops existing
//      when the stone runs out. Crossing the border does not change what the
//      places are called. It changes what a place IS.
//
//   2. THE PROVINCES NOBODY HAS BEEN TO ARE THIN ON PURPOSE. The four driven
//      provinces past the Marches carry a name, a holder and one fact each,
//      and the one fact is a band in a schedule kept by one woman - which is
//      a single generic system telling five places apart, not five bespoke
//      descriptions. Their thinness is also diegetic: it is exactly what
//      anybody in either played province knows about them, which is a name
//      and a rumour of a queue position.
//
// HOLDING ON PAPER IS NOT HOLDING IN FACT
// ---------------------------------------
// `the-late-age.md`: every institution is operating a fraction of what it
// inherited. So `onPaper` and `onTheGround` are separate fields on every
// prefecture and they are allowed to disagree, in both directions - a house
// that holds less than the record says is the common case, and a house that
// holds more than any document mentions is the Standing Grove. `discrepancy`
// names which kind, and the catalog test asserts that a prefecture claiming
// `none` really does read the same in both fields.
//
// NO ARITHMETIC HERE. Nothing in this section decides who would win a dispute
// over a boundary, what a catchment is worth, or how many houses it takes to
// move one. Those are questions for the resolvers. This is a statement about
// what is standing where.
// ─────────────────────────────────────────────────────────────────────────

/** Whether a province is written to, or named and nothing else. */
export const ProvinceStandingSchema = z.enum([
    /** Written to. It has a `Region` above, with places, customs and a method. */
    'played',
    /**
     * Named and nothing else, deliberately. Somebody in the catalog knows it
     * exists because a number in their own records refers to it; nobody the
     * player can reach has been there.
     */
    'named_only'
]);
export type ProvinceStanding = z.infer<typeof ProvinceStandingSchema>;

export const ProvinceSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    standing: ProvinceStandingSchema,
    /** The `REGIONS` row, where one exists. Null for the named-only ones. */
    regionId: z.string().nullable(),
    /** The apex that holds it. Never a court: courts administer, apexes hold. */
    heldByApexId: z.string(),
    /** The court the holding is administered THROUGH, where there is one. */
    administeredByCourtId: z.string().nullable(),
    /**
     * The one physical fact everything else follows from. For a played
     * province this restates the region's own `governingFact` so the two
     * tiers cannot drift; for a named-only one it is all there is.
     */
    governingFact: z.string().min(40),
    /** What the holder's own records say it holds here. */
    onPaper: z.string().min(40),
    /** What it actually walks. Frequently smaller. Occasionally larger. */
    onTheGround: z.string().min(40),
    /** Prefecture ids seated in it, in the order the local record lists them. */
    prefectureIds: z.array(z.string()),
    /**
     * Named-only provinces: what anybody in a played province actually knows,
     * which is usually one number out of one schedule. Null for played ones.
     */
    whatIsKnownOfIt: z.string().min(40).nullable(),
    startingAwareness: z.enum(['unaware', 'whisper', 'named', 'placed', 'encountered', 'known'])
});
export type Province = z.infer<typeof ProvinceSchema>;

/**
 * An arterial vein. Not a place - a thing under places, which is why it has a
 * holder and no prefectures. The Deep Survey's whole position is four of these
 * and the one province standing on top of them.
 */
export const ArterialSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    /** First through fourth, as the Survey numbers them. */
    ordinalInSystem: z.number().int().min(1).max(4),
    provinceId: z.string(),
    /** Who administers it, or null where nobody does and the Survey says so. */
    administeredByCourtId: z.string().nullable(),
    /** Who is actually drawing on it, which is a different question. */
    drawnOnBy: z.string().min(30),
    note: z.string().min(60)
});
export type Arterial = z.infer<typeof ArterialSchema>;

/**
 * The two kinds of prefecture, and they are not two words for one thing.
 * See the section comment: the kind follows from the region's governing fact.
 */
export const PrefectureKindSchema = z.enum(['catchment', 'face_district']);
export type PrefectureKind = z.infer<typeof PrefectureKindSchema>;

/** Which direction the record and the ground disagree in. */
export const HoldingDiscrepancySchema = z.enum([
    'none',
    /** The commonest case in a late age: less is walked than is recorded. */
    'holds_less_than_recorded',
    /** Deference. The zone is real and appears on no document anywhere. */
    'holds_more_than_recorded',
    /** Ground the record carries with nobody's name against it. */
    'no_holder_of_record',
    /** The record names a holder who is not there and has not been for years. */
    'record_names_the_wrong_holder'
]);
export type HoldingDiscrepancy = z.infer<typeof HoldingDiscrepancySchema>;

export const PrefectureSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    provinceId: z.string(),
    kind: PrefectureKindSchema,
    /** The settlement it is run out of. A `RegionPlace` name where one exists. */
    seat: z.string().min(1),
    /** `RegionPlace` names inside it. Empty for ground nobody lives on. */
    places: z.array(z.string()),
    /**
     * The faction holding it. Null is a real answer and appears four times:
     * ground the record carries with no name against it.
     */
    heldByFactionId: z.string().nullable(),
    /**
     * Whose gift it is in: a court id, an apex id, or a sect id where the
     * holding is at one remove. Null where nothing granted it to anybody -
     * which is what the Pavilion, the Hollow Court and the Grove have in
     * common and is the only thing they have in common.
     */
    delegatedFromId: z.string().nullable(),
    /** Sub-holders inside it, by faction id, with what each holds. */
    subHoldings: z.array(z.object({
        factionId: z.string(),
        holds: z.string().min(20),
        /**
         * Whose gift THAT is in, which is not always the prefecture's holder.
         * Set to the faction's own id where nobody granted it, which is how an
         * unbacked body standing inside somebody else's catchment is recorded.
         */
        delegatedFromId: z.string()
    })),
    onPaper: z.string().min(40),
    onTheGround: z.string().min(40),
    discrepancy: HoldingDiscrepancySchema,
    note: z.string().min(40)
});
export type Prefecture = z.infer<typeof PrefectureSchema>;

export const LOW_FALL_PROVINCE_ID = 'province-low-fall';
export const QUIET_MARCHES_PROVINCE_ID = 'province-quiet-marches';

// ─── the four arterials ──────────────────────────────────────────────────
// One per Surveyor. Three of the four have nothing branching from them, which
// is why the loss of the third is not a quarter of the Survey's position.

export const ARTERIALS: readonly Arterial[] = [
    {
        id: 'arterial-hollow-run',
        name: 'The Hollow Run',
        ordinalInSystem: 1,
        provinceId: LOW_FALL_PROVINCE_ID,
        administeredByCourtId: null,
        drawnOnBy: 'The Hollow Court, which was not granted it and did not ask.',
        note:
            'The richest of the four and the only one the Survey has never had an administrator for. The first Surveyor is a real office with real duties and none of them are on the arterial itself; what the post actually does is keep a figure current and submit it, which is the same shape as the Kiln and is not admitted to be.'
    },
    {
        id: 'arterial-the-root',
        name: 'The Root',
        ordinalInSystem: 2,
        provinceId: LOW_FALL_PROVINCE_ID,
        administeredByCourtId: 'court-kiln',
        drawnOnBy: 'Nobody at all. Nine hundred lit nodes and no draw.',
        note:
            'The datum. Every survey in the province is ultimately measured against it without knowing whose datum it is, and the one figure the Kiln reports upward once a year is this arterial\'s, unchanged for the whole of Ji Wanluo\'s tenure.'
    },
    {
        id: 'arterial-the-eleven',
        name: 'The Eleven',
        ordinalInSystem: 3,
        provinceId: LOW_FALL_PROVINCE_ID,
        administeredByCourtId: 'court-third-sill',
        drawnOnBy: 'The eleven surveyed veins of the Low Fall, and through them every granted sect in the province.',
        note:
            'The only arterial anything branches from, and therefore the only one that generates a grant book, an apportionment, a courier and a queue. It is administered by a court that answers to the Long Cut. The Deep Survey has not stated in any document that its province\'s working arterial is administered by the other apex, the Long Cut has not either, and both are counting on the Low Fall never asking whose name is on the countersignature.'
    },
    {
        id: 'arterial-the-long-cold',
        name: 'The Long Cold',
        ordinalInSystem: 4,
        provinceId: LOW_FALL_PROVINCE_ID,
        administeredByCourtId: null,
        drawnOnBy: 'The Frostmirror Court at the head and the Storm Tyrant Court where it goes down, both holding directly from the Survey and neither able to reach the bottom.',
        note:
            'Runs under the glacier and out beneath the floating stone. The fourth Surveyor is the one who asked, two hundred and forty years ago, who would be sitting on the vault while the Lamp was walked to a dispute, and the minute records the question and no reply.'
    }
];

// ─── prefectures of the Low Fall: catchments ─────────────────────────────

const LOW_FALL_PREFECTURES: readonly Prefecture[] = [
    {
        id: 'prefecture-gorge-head',
        name: 'The Gorge Head',
        provinceId: LOW_FALL_PROVINCE_ID,
        kind: 'catchment',
        seat: 'Low Fall',
        places: ['Low Fall'],
        heldByFactionId: 'sect-azure-cloud-pavilion',
        delegatedFromId: null,
        subHoldings: [
            {
                factionId: 'sect-azure-mist-court',
                holds: 'The lower gorge and the mist terraces, on the runoff of the Pavilion\'s own vein.',
                delegatedFromId: 'sect-azure-cloud-pavilion'
            },
            {
                factionId: 'sect-azure-dew-sect',
                holds: 'Four hill villages at the head of the gorge, where the vein runs shallow.',
                delegatedFromId: 'sect-azure-mist-court'
            }
        ],
        onPaper:
            'Still carried on the Third Sill\'s book as one of the eleven, with nineteen renewals in the archive and no twentieth ever issued or asked for. The Sill has never struck the page and the Pavilion has never asked it to.',
        onTheGround:
            'Held outright and openly since the year Ru Anjing crossed, on no grant from anyone, with a front gate, a recruitment cycle and a published rank list.',
        discrepancy: 'record_names_the_wrong_holder',
        note:
            'The only catchment in the province where the paper says tenant and the ground says apex. Both parties have found the silence comfortable for three hundred and eighty years and the Low Fall reads it as whatever suits the speaker.'
    },
    {
        id: 'prefecture-nine-peaks',
        name: 'The Nine Peaks Catchment',
        provinceId: LOW_FALL_PROVINCE_ID,
        kind: 'catchment',
        seat: 'Nine Peaks',
        places: ['Nine Peaks'],
        heldByFactionId: 'sect-nine-peaks-ascetic-order',
        delegatedFromId: 'court-third-sill',
        subHoldings: [
            {
                factionId: 'sect-verdant-spring-hall',
                holds: 'The spring valley and its nine springs, a sub-grant one rung lower than the Hall lets on.',
                delegatedFromId: 'sect-nine-peaks-ascetic-order'
            }
        ],
        onPaper:
            'The oldest continuous grant in the Low Fall, twelve-year cycle, whole vein output above a fixed local allowance taken quarterly, three disciples upward per cycle.',
        onTheGround:
            'The same, and the Order has never seen a renewal document: the confirmation is spoken, by somebody who walks in without being announced.',
        discrepancy: 'none',
        note:
            'The Order\'s famous refusal to lease its vein is printed as principle and is a term of the grant. Three generations of the province have been allowed to believe otherwise because the alternative is explaining who sets it.'
    },
    {
        id: 'prefecture-ashfall',
        name: 'The Ashfall Catchment',
        provinceId: LOW_FALL_PROVINCE_ID,
        kind: 'catchment',
        seat: 'the furnace on the volcanic flank',
        places: [],
        heldByFactionId: 'sect-ashen-forge-clan',
        delegatedFromId: 'court-third-sill',
        subHoldings: [
            {
                factionId: 'sect-nine-abyss-flame-sect',
                holds: 'The caldera and the vent vein, on a grant the righteous sects of the province do not believe exists.',
                delegatedFromId: 'court-third-sill'
            },
            {
                factionId: 'sect-cinnabar-crucible-guild',
                holds: 'The field furnace halls and the refining hall with the method-script on the wall.',
                delegatedFromId: 'sect-frostmirror-court'
            }
        ],
        onPaper:
            'A grant that names the furnace as the thing granted and the ground as an appurtenance of it, which is backwards from how the clan understands its own history.',
        onTheGround:
            'Three institutions on one flank answering to two different courts on two different arterials, none of which has ever been drawn as a boundary.',
        discrepancy: 'none',
        note:
            'The clearest case in the province of the map and the paper disagreeing without anybody lying. The Crucible Guild stands inside the Ashfall and holds from a court on the fourth arterial, so the flank has no single line anybody could draw around it.'
    },
    {
        id: 'prefecture-cold-head',
        name: 'The Cold Head',
        provinceId: LOW_FALL_PROVINCE_ID,
        kind: 'catchment',
        seat: 'the glacier terrace',
        places: [],
        heldByFactionId: 'sect-frostmirror-court',
        delegatedFromId: 'apex-deep-survey',
        subHoldings: [],
        onPaper:
            'The glacier and the cold vein under it, on a grant nobody else has ever applied for, held directly from the Survey rather than through the Sill.',
        onTheGround:
            'The same, and the Frostmirror has been writing to the Third Sill about the cold-arterial figures for eleven years and has had four replies drafted and none of them sent. The glacier itself is seventeen days over the pass in the White Stair, and the Court has never sat in the province the register puts it in.',
        discrepancy: 'none',
        note:
            'One of the two catchments that hold from the Survey directly, which is the whole of the Survey\'s remaining presence on its own ground now that the Eleven is administered from elsewhere - and both of them are exclaves. The Long Cold runs under the glacier and out beneath the floating stone, so it leaves the province, and the Survey carries the two catchments over it on the Low Fall book because the arterial is Low Fall rather than because the ground is. Nobody has ever proposed correcting it, because correcting it would mean stating in writing that the Survey holds one province, four arterials and two pieces of somewhere else.'
    },
    {
        id: 'prefecture-floating-stone',
        name: 'The Floating Stone',
        provinceId: LOW_FALL_PROVINCE_ID,
        kind: 'catchment',
        seat: 'the stone itself',
        places: [],
        heldByFactionId: 'sect-storm-tyrant-court',
        delegatedFromId: 'apex-deep-survey',
        subHoldings: [
            {
                factionId: 'sect-crimson-abyss-hall',
                holds: 'The sinkhole and the thin vein beneath the town, the least valuable grant in the province.',
                delegatedFromId: 'sect-storm-tyrant-court'
            }
        ],
        onPaper:
            'The floating stone and the vein under it, held from the Survey, with an apportionment figure the Keeper of the Eleven revises on the same twelve-year cycle as everything else.',
        onTheGround:
            'The Court can no longer reach the bottom of its own vein and has not said so upward. The eleventh share has not been drawn in sixty years and the Keeper is fairly sure somebody is drawing it.',
        discrepancy: 'holds_less_than_recorded',
        note:
            'The one place in the province where the register and the ground disagree by an amount somebody has actually measured, and the man who measured it has been a Second Mark for nineteen walks because his figures keep disagreeing with the apportionment calculated off them. Like the Cold Head it is an exclave: the stone hangs over a storm in the White Stair, on the far side of a pass that is shut five months a year, and the Court\'s one Low Fall tenant is a sinkhole hall under a town nine days from anything the Court can see.'
    },
    {
        id: 'prefecture-scarwater',
        name: 'The Scarwater Catchment',
        provinceId: LOW_FALL_PROVINCE_ID,
        kind: 'catchment',
        seat: 'Scarwater',
        places: ['Scarwater'],
        heldByFactionId: null,
        delegatedFromId: null,
        subHoldings: [
            {
                factionId: 'sect-clear-river-alliance',
                holds: 'The fords and the traffic over them, which nobody granted and everybody uses.',
                delegatedFromId: 'sect-clear-river-alliance'
            },
            {
                factionId: 'sect-gleaners-company',
                holds: 'The Hollowmarket Factor at Scarwater, a shopfront for Marches salvage.',
                delegatedFromId: 'sect-weir-office'
            }
        ],
        onPaper:
            'Surveyed by the Anchorhold to the burn edge and no further, so the last forty li before the Marches border sit on no certified survey and the catchment has no closing line.',
        onTheGround:
            'Run by the Clear River Alliance, which holds no grant, keeps the fords open, takes a toll it has no authority to take, and is the reason the border road works at all.',
        discrepancy: 'no_holder_of_record',
        note:
            'Oaths sworn in the unsurveyed forty li do not bind and nothing owned there can be proved, which the Gleaners and the Quiet Cut both use, for opposite reasons.'
    },
    {
        id: 'prefecture-sweptground',
        name: 'Sweptground',
        provinceId: LOW_FALL_PROVINCE_ID,
        kind: 'catchment',
        seat: 'Sweptground',
        places: ['Sweptground'],
        heldByFactionId: 'sect-sweptground-temple',
        delegatedFromId: null,
        subHoldings: [
            {
                factionId: 'house-bound-word',
                holds: 'The treaty vault, which is a building rather than ground.',
                delegatedFromId: 'house-bound-word'
            }
        ],
        onPaper:
            'Carried on the apportionment with a nil figure against it, because there is no vein under it and never was, so the Keeper of the Eleven has nothing to apportion and has printed a zero for two hundred years.',
        onTheGround:
            'A temple, a treaty vault, and the largest concentration of Marches refugees in the province, on ground chosen for having nothing anybody needs to grant.',
        discrepancy: 'none',
        note:
            'The one catchment whose security is that it is worthless. Everything else in the province is defended by a document or by a belief; this is defended by a zero in a column.'
    },
    {
        id: 'prefecture-grove-verge',
        name: 'The Grove Verge',
        provinceId: LOW_FALL_PROVINCE_ID,
        kind: 'catchment',
        seat: 'the valley of old trees',
        places: [],
        heldByFactionId: 'sect-standing-grove',
        delegatedFromId: null,
        subHoldings: [],
        onPaper:
            'A valley, a mountain and four settlements, on no grant and on nobody\'s book. The Grove has never registered anything and has never been asked to.',
        onTheGround:
            'That core, plus a zone about eleven days across in every direction within which nobody encroaches and nobody applies for a grant - which appears on no document in the world, and which two granted sects have quietly moved leases into on the northern side in the last twenty years.',
        discrepancy: 'holds_more_than_recorded',
        note:
            'The only holding in the province that is larger in fact than in any record, and the only one that could evaporate in a season without anybody crossing a line. The zone is worth exactly what the last test was worth, and the last test was forty-one years ago.'
    },
    {
        id: 'prefecture-hollow-reach',
        name: 'The Hollow Reach',
        provinceId: LOW_FALL_PROVINCE_ID,
        kind: 'catchment',
        seat: 'the four mountains',
        places: [],
        heldByFactionId: 'sect-hollow-court',
        delegatedFromId: null,
        subHoldings: [],
        onPaper:
            'The first arterial\'s catchment, apportioned annually by the Keeper of the Eleven to nobody, on a figure that has not changed in living memory because there is nothing to revise it against.',
        onTheGround:
            'Occupied. Four mountains standing on the richest vein anyone has ever surveyed, held by people nothing in the world can make leave, who were not granted it, do not pay for it, and have never been asked.',
        discrepancy: 'no_holder_of_record',
        note:
            'Not a lease, not a claim and not a belief that could decay. Every party in the province has done the arithmetic and nobody raises it, so the register carries a catchment with a blank where the holder goes, and prints it again every twelve years.'
    }
];

// ─── prefectures of the Quiet Marches: face districts ────────────────────
// A different kind of object, for a reason one sentence long: there is nothing
// in the air, so a holding is not ground, it is work. Every one of these is
// held by an office or by nobody. Not one is held by a sect, because there are
// no sects here to hold one, and that absence is the region.

const QUIET_MARCHES_PREFECTURES: readonly Prefecture[] = [
    {
        id: 'district-gapwater',
        name: 'The Gapwater District',
        provinceId: QUIET_MARCHES_PROVINCE_ID,
        kind: 'face_district',
        seat: 'Kettle',
        places: ['The Gapwater face'],
        heldByFactionId: 'sect-weir-office',
        delegatedFromId: 'court-ninth-face',
        subHoldings: [],
        onPaper:
            'One of two workable faces in the province, entered on the Long Cut course schedule in the bottom band, administered by the Weir Office from a counter at Kettle.',
        onTheGround:
            'Grant access at forty stones a day and a queue of eleven. The Office holds nothing of its own here: it apportions somebody else\'s face on somebody else\'s schedule and has no authority to make an exception.',
        discrepancy: 'none',
        note:
            'The Office has an unpublished survey of how much workable stone is left. The Assessor of the Four Faces asked for it, was given it, kept the copy, and fears the figure is right.'
    },
    {
        id: 'district-fourth-face',
        name: 'The Fourth Face District',
        provinceId: QUIET_MARCHES_PROVINCE_ID,
        kind: 'face_district',
        seat: 'Kettle',
        places: [],
        heldByFactionId: 'sect-weir-office',
        delegatedFromId: 'court-ninth-face',
        subHoldings: [],
        onPaper:
            'The second of the two rented faces, on the same schedule line as the Gapwater, administered from the same counter by the same eleven people.',
        onTheGround:
            'Thinner than the Gapwater and worked by whoever cannot get onto the Gapwater queue, which the Office does not say out loud and which the queue works out inside a season.',
        discrepancy: 'none',
        note:
            'A district exists here because there is work in it. When the face is out, this entry does not change hands - it stops existing, and the ground under it becomes a cemetery.'
    },
    {
        id: 'district-hollowmarket',
        name: 'The Hollowmarket District',
        provinceId: QUIET_MARCHES_PROVINCE_ID,
        kind: 'face_district',
        seat: 'Hollowmarket',
        places: ['Hollowmarket'],
        heldByFactionId: 'sect-gleaners-company',
        delegatedFromId: 'sect-weir-office',
        subHoldings: [],
        onPaper:
            'Worked out, struck off the course, and carried on the Weir Office register only as the annual salvage contract over the burn zones inside it.',
        onTheGround:
            'A sorting yard, a price list, and several hundred finished faces with the carvers who worked them walled into the stone. The Gleaners will not cut a face that holds somebody without asking the family.',
        discrepancy: 'none',
        note:
            'The plainest statement of what a face district is: the boundary is the work, the work is finished, and what is left is a cemetery with a contract over it.'
    },
    {
        id: 'district-sixmile',
        name: 'The Sixmile District',
        provinceId: QUIET_MARCHES_PROVINCE_ID,
        kind: 'face_district',
        seat: 'Sixmile',
        places: ['Sixmile'],
        heldByFactionId: null,
        delegatedFromId: null,
        subHoldings: [
            {
                factionId: 'sect-sixmile-wardens',
                holds: 'Nine hundred painted stakes, a shed and a survey, none of which anybody has thought to grant.',
                delegatedFromId: 'sect-sixmile-wardens'
            }
        ],
        onPaper:
            'The staked road corridor. It is on the register as a line of survey with no face in it, and a district with no face has no holder, so the column is blank.',
        onTheGround:
            'Repainted every year by six people nobody pays, on ground the Long Cut has never scheduled, and leaving the stakes is how visitors die here.',
        discrepancy: 'no_holder_of_record',
        note:
            'The Marches answer to the Scarwater unsurvey, arrived at from the opposite direction: not ground too disputed to certify, but ground too worthless to schedule, kept alive by people who were never appointed to keep it.'
    },
    {
        id: 'district-dead-verge',
        name: 'The Dead Verge',
        provinceId: QUIET_MARCHES_PROVINCE_ID,
        kind: 'face_district',
        seat: 'no seat: nobody lives inside it',
        places: ['The Dead Verge'],
        heldByFactionId: null,
        delegatedFromId: 'court-ninth-face',
        subHoldings: [],
        onPaper:
            'The burn edge, redrawn every year, which makes it the only prefecture in either province whose boundary is a date rather than a line.',
        onTheGround:
            'It has moved about nine hundred paces since the survey was drawn, at roughly a pace a year, faster after wet winters, and it has taken about a fifth of the arable land with it.',
        discrepancy: 'no_holder_of_record',
        note:
            'A Low Fall catchment is argued about because two parties both want it. This is argued about by nobody, because what is in dispute is not who holds it but how much of the province it will be next century.'
    },
    {
        id: 'district-eleven-li',
        name: 'The Eleven Li',
        provinceId: QUIET_MARCHES_PROVINCE_ID,
        kind: 'face_district',
        seat: 'no seat: it is walked, not lived in',
        places: [],
        heldByFactionId: null,
        delegatedFromId: 'court-ninth-face',
        subHoldings: [],
        onPaper:
            'A face on the Long Cut course that cannot be worked, held by a Face Master of the Ninth Face Court, with a quarterly return that has read unchanged three hundred and sixty times.',
        onTheGround:
            'Eleven li of high Marches that has not held qi in ninety years, since a woman went up alone in the spring and attempted the crossing. There is no body, because a failed crossing does not leave one.',
        discrepancy: 'none',
        note:
            'The only prefecture in the catalog whose entire purpose is to be walked four times a year by somebody who does not want it struck off, and who writes the word out in full every time.'
    }
];

// ─── the provinces ───────────────────────────────────────────────────────

export const PROVINCES: readonly Province[] = [
    {
        id: LOW_FALL_PROVINCE_ID,
        name: 'The Low Fall',
        standing: 'played',
        regionId: HOME_REGION_ID,
        heldByApexId: 'apex-deep-survey',
        administeredByCourtId: 'court-kiln',
        governingFact:
            'The veins here are horizontal, shallow and surveyable, so the qi belongs to whoever holds the surface above it - and the surface has been held continuously for four hundred years.',
        onPaper:
            'The Deep Survey holds the arterial system and the province standing on it: four arterials, eleven surveyed veins, seventeen institutions, and a datum nobody local can place.',
        onTheGround:
            'Two of the four arterials have no administrator, one is a datum nobody draws on, and the fourth - the only one anything branches from - is administered by a court that answers to the Long Cut. The Survey holds one province and is present on two catchments of it, and both of those two are over the northern watershed and have been for as long as anybody has walked them.',
        prefectureIds: LOW_FALL_PREFECTURES.map(p => p.id),
        whatIsKnownOfIt: null,
        startingAwareness: 'known'
    },
    {
        id: QUIET_MARCHES_PROVINCE_ID,
        name: 'The Quiet Marches',
        standing: 'played',
        regionId: ADJACENT_REGION_ID,
        heldByApexId: 'apex-long-cut',
        administeredByCourtId: 'court-ninth-face',
        governingFact:
            'The qi is not gone; it was driven into the stone. There is nothing in the air and a great deal in the rock, and the only way to get at it is to cut.',
        onPaper:
            'One of five driven provinces held directly by the Long Cut, administered face by face through the Ninth Face Court, with no client sects, no leases and no vassals anywhere in the arrangement.',
        onTheGround:
            'Two workable faces, a worked-out cemetery district, a staked corridor nobody scheduled, a burn edge that moves, and a face that cannot be worked and is walked anyway. Eleven people at a counter administer all of it.',
        prefectureIds: QUIET_MARCHES_PREFECTURES.map(p => p.id),
        whatIsKnownOfIt: null,
        startingAwareness: 'known'
    },
    // ── the four the Marches has never heard named ────────────────────────
    // One fact each, and the fact is a band in the Assessor's schedule. A
    // single generic system telling five places apart is worth more than five
    // descriptions, and it is the honest amount: this IS what anybody in
    // either played province knows, which is a name and a queue position.
    {
        id: 'province-coldwater-cut',
        name: 'The Coldwater Cut',
        standing: 'named_only',
        regionId: null,
        heldByApexId: 'apex-long-cut',
        administeredByCourtId: 'court-ninth-face',
        governingFact:
            'The driven stone there is still deep, so the first century of the Long Cut course schedule is almost entirely Coldwater and everything else waits.',
        onPaper: 'First band of five on the course schedule, and it has held the position for as long as the schedule has existed.',
        onTheGround: 'Nobody in either played province has been, and the Long Cut does not publish what it takes out.',
        prefectureIds: [],
        whatIsKnownOfIt:
            'A name on a schedule the Weir Office countersigns once every twenty years without reading past its own line, and a rumour among Kettle carvers that there is somewhere the tools are better.',
        startingAwareness: 'unaware'
    },
    {
        id: 'province-hammerfall',
        name: 'Hammerfall',
        standing: 'named_only',
        regionId: null,
        heldByApexId: 'apex-long-cut',
        administeredByCourtId: 'court-ninth-face',
        governingFact: 'Second band. Worked hard for eleven hundred years and still returning enough to keep a course open.',
        onPaper: 'Second band of five, and the only one that has ever moved up rather than down.',
        onTheGround: 'Unknown here. The Assessor of the Four Faces rates it annually and the figure is not circulated.',
        prefectureIds: [],
        whatIsKnownOfIt: 'Nothing at all in the Marches. The name appears once on the schedule the Twenty-Year Hand carries and nobody at the Weir Office has ever asked what it is.',
        startingAwareness: 'unaware'
    },
    {
        id: 'province-the-sixteen-faces',
        name: 'The Sixteen Faces',
        standing: 'named_only',
        regionId: null,
        heldByApexId: 'apex-long-cut',
        administeredByCourtId: 'court-ninth-face',
        governingFact: 'Third band, and the only driven province where more than one face is open at a time, which is what the name is.',
        onPaper: 'Third band of five, and it has been third for two hundred years.',
        onTheGround: 'Unknown here, and the Long Cut has never had reason to describe it to anybody in the Marches.',
        prefectureIds: [],
        whatIsKnownOfIt: 'A name, and the fact that it is above the Marches in the queue, which is the only comparative figure anybody in Kettle has ever heard.',
        startingAwareness: 'unaware'
    },
    {
        id: 'province-greyhold',
        name: 'Greyhold',
        standing: 'named_only',
        regionId: null,
        heldByApexId: 'apex-long-cut',
        administeredByCourtId: 'court-ninth-face',
        governingFact: 'Fourth band, one place above the Marches, and it has been sliding for two centuries in the same direction the Marches slid.',
        onPaper: 'Fourth band of five, and it is the only one of the five that has ever moved downward twice.',
        onTheGround: 'Unknown here, and the Assessor believes it will change places with the Marches within her tenure and has not written that down.',
        prefectureIds: [],
        whatIsKnownOfIt:
            'The one name a Kettle carver might have heard, because it is the province directly above them in a queue nobody has told them they are in.',
        startingAwareness: 'unaware'
    }
];

export const PREFECTURES: readonly Prefecture[] = [
    ...LOW_FALL_PREFECTURES,
    ...QUIET_MARCHES_PREFECTURES
];

/**
 * The queue, which is the whole of what tells the five driven provinces apart.
 *
 * Not arithmetic and not a rule: a list, in the order the Assessor's schedule
 * puts them, kept because "the Marches is last of five" is a fact a player can
 * be told and a fact that explains everything about why nothing arrives.
 */
export const DRIVEN_PROVINCE_SCHEDULE_ORDER: readonly string[] = [
    'province-coldwater-cut',
    'province-hammerfall',
    'province-the-sixteen-faces',
    'province-greyhold',
    QUIET_MARCHES_PROVINCE_ID
];

// ─── province + prefecture lookups ───────────────────────────────────────

const PROVINCE_BY_ID: ReadonlyMap<string, Province> = new Map(PROVINCES.map(p => [p.id, p]));
const PREFECTURE_BY_ID: ReadonlyMap<string, Prefecture> = new Map(PREFECTURES.map(p => [p.id, p]));

/** Every faction with any interest in a prefecture, holder or sub-holder. */
const PREFECTURE_BY_FACTION: ReadonlyMap<string, string> = (() => {
    const map = new Map<string, string>();
    for (const pref of PREFECTURES) {
        if (pref.heldByFactionId) map.set(pref.heldByFactionId, pref.id);
    }
    for (const pref of PREFECTURES) {
        for (const sub of pref.subHoldings) {
            if (!map.has(sub.factionId)) map.set(sub.factionId, pref.id);
        }
    }
    return map;
})();

export function getProvince(id: string): Province | undefined {
    return PROVINCE_BY_ID.get(id);
}

export function requireProvince(id: string): Province {
    const p = PROVINCE_BY_ID.get(id);
    if (!p) throw new Error(`Unknown province: ${id}`);
    return p;
}

export function getPrefecture(id: string): Prefecture | undefined {
    return PREFECTURE_BY_ID.get(id);
}

export function prefecturesOf(provinceId: string): Prefecture[] {
    return PREFECTURES.filter(p => p.provinceId === provinceId);
}

/** The province a `REGIONS` row stands on. */
export function provinceForRegion(regionId: string): Province | undefined {
    return PROVINCES.find(p => p.regionId === regionId);
}

/** The prefecture a faction holds, or sits inside as a sub-holder. */
export function prefectureForFaction(factionId: string): Prefecture | undefined {
    const id = PREFECTURE_BY_FACTION.get(factionId);
    return id ? PREFECTURE_BY_ID.get(id) : undefined;
}

/** The province a faction's ground is in. */
export function provinceForFaction(factionId: string): Province | undefined {
    const pref = prefectureForFaction(factionId);
    return pref ? PROVINCE_BY_ID.get(pref.provinceId) : undefined;
}

/**
 * Whose gift a faction's ground is in, tracing sub-holdings up. Returns null
 * where nothing granted it - which is a real and important answer, and the
 * only thing the Pavilion, the Hollow Court, the Grove, the Clear River
 * Alliance and the Sixmile Wardens have in common.
 */
export function delegatedFrom(factionId: string): string | null {
    const pref = prefectureForFaction(factionId);
    if (!pref) return null;
    if (pref.heldByFactionId === factionId) return pref.delegatedFromId;
    const sub = pref.subHoldings.find(s => s.factionId === factionId);
    if (!sub) return null;
    return sub.delegatedFromId === factionId ? null : sub.delegatedFromId;
}

/** Arterials under a province, in the Survey's own numbering. */
export function arterialsOf(provinceId: string): Arterial[] {
    return ARTERIALS.filter(a => a.provinceId === provinceId)
        .sort((a, b) => a.ordinalInSystem - b.ordinalInSystem);
}

/** Prefectures where the record and the ground do not agree. */
export function contestedGround(): Prefecture[] {
    return PREFECTURES.filter(p => p.discrepancy !== 'none');
}

// ─────────────────────────────────────────────────────────────────────────
// UNGOVERNED GROUND
//
// WHY THIS IS NOT A SIXTH REGION, argued rather than assumed.
//
// A `Region` is not a shape on a map. It is a contract, and every clause of
// it presupposes a holder:
//
//   - `factionIds` - the catalog test requires at least two seated houses per
//     province, because a province with nobody in it was the defect that split
//     the map in the first place. Ungoverned ground is seated by nobody, and
//     satisfying the clause would mean inventing houses that hold it, which is
//     the exact thing this object exists to say does not happen.
//   - `politics` - all three values name a distribution of authority. There is
//     no value for "the question does not arise", and `no_authority` is
//     already taken by the water and means something specific and different
//     there: nobody CAN hold it. Reusing the word would flatten the two.
//   - `localRankNames` - a relabelling of the ladder by locals. There are no
//     locals. Everybody here brought their vocabulary with them, the same as
//     at sea, and the words actually in use are `ROGUE_STANDING` in
//     `rogues.ts`, which is the world's vocabulary for people with no house.
//   - `connections` - every region connects to the Low Fall and the only
//     bypass is water. This is a bypass and it is not water. Adding it as a
//     region would either break that invariant or make the ground a spoke,
//     and a spoke is not a vacuum, it is a suburb.
//   - `traditionId` - one tradition is seated per province. Both cross this
//     ground and neither is seated on it.
//
// Five invariants would have to be weakened to file this as a province, and
// each of them was written to keep the world honest. The ground is a different
// KIND of object, in exactly the sense `sea_crossing` is a different kind of
// link and a face district is a different kind of prefecture, so it gets its
// own small schema and reuses `RegionRegisterSchema`, `RegionCustomsSchema`
// and `RegionPlaceSchema` for everything that is genuinely the same question.
//
// AND IT IS NOT THE SEA WITH SAND IN IT.
// The Drowned Reach is ungoverned by SUBTRACTION: no ground, so no vein, so
// nothing in the air, so nothing to hold and nothing worth holding. This is
// ungoverned by the opposite: the vein is real, shallow and rich, and the
// cover on top of it moves. The two places fail the same institution for
// opposite reasons, and the failure mode is different at every step -
//
//   the sea    nothing is here          | the sand   a great deal is here
//   the sea    nobody wants it          | the sand   everybody wants it
//   the sea    a claim is unenforceable | the sand   a claim is true, and expires
//   the sea    empty of people          | the sand   full of them
//
// The ceiling makes the same point in one number: the water's is 2, the
// lowest in the world, and this ground's is 28 - fourteen times it, above both
// of the two provinces anybody in the world calls poor, and inside the top
// half of the gradient. Poverty is not what is wrong with it.
//
// (That figure was written as "higher than three of the five provinces" and
// the catalog test said two. The ceilings are 46, 38, 36, 6 and 2, so 28 is
// above the Marches and the water and below the other three. The claim above
// is the corrected one.)
//
// NOTHING BESPOKE. There is no rule below that applies only here. The ground
// is different because of what is under it, what is on top of that, what the
// thresholds are and who is standing on it. In particular the rate multiplier
// is 1 - the same as the Low Fall's, and the ONLY other 1 in the world -
// because there is no local method to express as a modifier. What varies is
// the `ambientProfile`, and the ordinary ambient system does the rest. Two
// places with the same multiplier that are nothing alike is the finding.
//
// WHAT THE ENGINE CANNOT READ YET, stated rather than papered over.
// `loadCultivationCatalog()` maps `REGIONS` and nothing else, so nothing here
// reaches `seeding.ts`, and a seeded world today has no ungoverned ground in
// it. What it would take is one more mapper beside `mapRegion` and a
// `LocationKind` that is not a settlement - which is somebody else's file and
// is deliberately not done from here. The geography declares the ground; the
// engine has not learned to read it.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A surfacing of the vein. The unit of possession here, and the reason there
 * is no possession here: it is real ground with real qi on it, and it closes.
 */
export const ShowSchema = z.object({
    /** What it is, in one line, with no arithmetic attached. */
    what: z.string().min(60),
    /** How they are found, which is a trade rather than a survey. */
    howFound: z.string().min(60),
    /** How long they last, in the terms the world uses. */
    howLong: z.string().min(60),
    /**
     * THE LOAD-BEARING COMPARISON. A grant is a twelve-year instrument
     * everywhere in the world that has one. A show is not.
     */
    againstTheGrantCycle: z.string().min(80),
    /** What a finder actually does with one, and why they do it that way. */
    whatAFinderDoes: z.string().min(60)
});
export type Show = z.infer<typeof ShowSchema>;

/** Somebody standing on ground nobody holds, and what they are doing there. */
export const OnTheGroundSchema = z.object({
    who: z.string().min(1),
    /** A catalog faction where one is present, null where nobody is. */
    factionId: z.string().nullable(),
    /**
     * What they hold. It is always nothing, and the field exists so that a
     * later editor has to type the word rather than quietly fill it in.
     */
    holds: z.literal('nothing'),
    doesHere: z.string().min(60),
    whyHere: z.string().min(60)
});
export type OnTheGround = z.infer<typeof OnTheGroundSchema>;

/** What a bordering province pays for the vacuum next door. */
export const LeakageSchema = z.object({
    regionId: z.string(),
    /** What comes out, or what does not go in. */
    what: z.string().min(60),
    /** What it costs them, in the terms that province already counts in. */
    cost: z.string().min(80)
});
export type Leakage = z.infer<typeof LeakageSchema>;

export const UngovernedGroundSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    /** Provinces it touches. It is between them and inside none of them. */
    borderingRegionIds: z.array(z.string()).min(3),
    summary: z.string().min(120),
    /** The single physical fact everything else follows from. */
    governingFact: z.string().min(80),
    /** Derived, so the derivation is checkable rather than asserted. */
    derivations: z.array(z.string().min(60)).min(4),
    /** Why the ground cannot be held, stated as a mechanism. */
    whyItCannotBeHeld: z.string().min(120),
    /** And why that is not the water's reason, said in full. */
    andWhyThatIsNotTheSeasReason: z.string().min(120),
    theShows: ShowSchema,
    /**
     * The load-bearing question. Order here is POSSIBLE and unpurchased: an
     * apex could impose it and has priced it and declined.
     */
    whyNobodyFixesIt: z.object({
        whatOrderWouldTake: z.string().min(80),
        whatItWouldCost: z.string().min(120),
        whatItWouldReturn: z.string().min(80),
        /** The reason nobody says out loud, which is also true. */
        theInterestedReason: z.string().min(120),
        /** Who believes which, so it is a dispute rather than an assertion. */
        whoBelievesWhich: z.string().min(120)
    }),
    /** What the neighbours say when asked why they put up with what they have. */
    whatItMakesTrue: z.string().min(150),
    whoIsOnIt: z.array(OnTheGroundSchema).min(5),
    /** No census exists. What figures there are, and whose they are. */
    howManyNote: z.string().min(100),
    /** Rank has no local vocabulary here, and what is used instead. */
    howRankIsSpoken: z.string().min(100),
    register: RegionRegisterSchema,
    customs: RegionCustomsSchema,
    ambientProfile: z.record(AmbientQiSchema, z.number().int().min(0).max(100)),
    /**
     * Read exactly as `Region.localCeilingOrdinal`: nobody here has passed it
     * in living memory. It is high, and that is the point.
     */
    ceilingOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    ceilingNote: z.string().min(100),
    /** Multiplier on ordinary drawing. One. See the section comment. */
    ambientRateMultiplier: z.number().min(0),
    veinStatus: z.string().min(80),
    places: z.array(RegionPlaceSchema).min(4),
    hazards: z.array(z.string().min(30)).min(4),
    /** The road that exists, is shorter, and is empty. */
    theRouteNobodyTakes: z.object({
        fromRegionId: z.string(),
        toRegionId: z.string(),
        directDays: z.number().int().min(1),
        throughTheCentreDays: z.number().int().min(1),
        whyItIsEmpty: z.string().min(120)
    }),
    whatItCostsTheNeighbours: z.array(LeakageSchema).min(4),
    /** Three things that are true here and false one province over. */
    trueHereFalseThere: z.array(z.string().min(60)).min(3),
    crossingNotes: z.array(z.string().min(60)).min(4)
});
export type UngovernedGround = z.infer<typeof UngovernedGroundSchema>;

export const BLOWN_GROUND_ID = 'ungoverned-blown-ground';

export const THE_BLOWN_GROUND: UngovernedGround = {
    id: BLOWN_GROUND_ID,
    name: 'The Blown Ground',
    borderingRegionIds: [
        HOME_REGION_ID,
        ADJACENT_REGION_ID,
        EAST_REGION_ID,
        SOUTH_REGION_ID
    ],
    summary:
        'The interior wedge the four arms of the world leave between them: eleven days of loose sand over a vein that is neither deep nor drawn down. The qi comes to the surface wherever the cover thins, in patches the size of a market square that are the best ground anybody has stood on outside the White Stair, and the cover does not stay where it is. Nobody holds it, everybody wants it, and most of the people on it were refused at a gate somewhere else - which `WHY_UNAFFILIATED` already says is the commonest origin of an unaffiliated cultivator anywhere.',
    governingFact:
        'The vein is shallow and rich and the ground on top of it is loose and moves. The qi is not buried, it is covered, and the cover walks about a li a year in a direction that depends on the season - so a place with the best air in three provinces on it is under nine feet of sand within a decade, and somewhere that had nothing on it is open.',
    derivations: [
        'The unit of possession is a surfacing rather than an area, and a surfacing closes, so nothing here outlives the instrument that would be used to hold it - which is why there is no grant book, no lease, no tenancy and nobody to be polite to',
        'A survey here is possible, cheap and correct, and is worth nothing within the year. This is the only ground in the world that is surveyed constantly and granted not at all, and the trade that thrives is finding rather than surveying',
        'Nothing is built, because a wall stops the sand for one season and is a dune the next, so every institution that has ever operated here is a camp, and a camp that stops moving is either buried or robbed',
        'There is no certified datum, so no oath binds and no boundary can be arbitrated - the same reason the Anchorhold maintains no perimeter in the Wide Field, arrived at from a different direction and much harder',
        'A find is sold once, immediately, to whoever is nearest, at the finder\'s price, because the buyer cannot go back for it - which inverts the whole salvage trade, where the seller\'s problem is provenance and here the buyer\'s problem is that the site will be gone',
        'People who cannot stand at a gate anywhere else can stand here, so the population is entirely arrivals with a reason, and everybody knows that about everybody'
    ],
    whyItCannotBeHeld:
        'Not because it is too strong, too poor or too far. Because the thing that would be held has a shorter life than the instrument that would hold it. Every holding in this world is an instrument with a term: a Low Fall grant runs twelve years and is renewed on a twelve-year cycle, a Wide Field lease runs to a renewal calendar that is public, a Marches face district exists for as long as there is work in it. A show is open for a season to about nine years. There is nothing here that can be the subject of a twelve-year document, so the apparatus that turns force into authority everywhere else - grant, renewal, apportionment, countersignature - has nothing to bite on. A party can occupy a show and hold it against all comers, and be holding a patch of ordinary sand at the end of it, having spent the whole term of a grant on something that expired inside it.',
    andWhyThatIsNotTheSeasReason:
        'The Drowned Reach is ungoverned by subtraction. There is no ground under open water, so there is no vein, so there is nothing in the air, so a claim over a strait is a sentence in a document and a hull is standing on whatever is in its own chest. Nobody holds it because there is nothing there to hold and no reason to want it. This is the opposite failure: the ground is real, the vein is real, the air on a show is better than anything for sale in three provinces, and every party in the world would take it if taking it stayed taken. The water defeats authority by having nothing in it. The sand defeats authority by having a great deal in it that will not stay in one place. Which is why the sea is empty and this is crowded, and why the sea\'s ceiling is the lowest in the world and this one is higher than three of the five provinces.',
    theShows: {
        what:
            'A patch where the cover has thinned to nothing and the vein is at the surface. Anything from forty paces across to about the size of Wheatgate\'s market, dense to spirit-tide the whole way over, and visible from a distance because nothing grows on it and the air above it stands wrong.',
        howFound:
            'By walking, by a change in the wind, and by the birds, which will not cross one. Finders work alone or in twos because a find is worth exactly what it is worth divided by the number of people who saw it, and the trade has no guild, no register and no way of establishing that anybody found anything first.',
        howLong:
            'A season at the short end and about nine years at the long. The average is two or three, nobody has kept the figures long enough for the average to mean anything, and every finder alive will tell you a different number with complete confidence.',
        againstTheGrantCycle:
            'A grant is twelve years, everywhere in the world that has one, and it is twelve years because that is how long a surveyed vein can be relied on to still be a surveyed vein. Not one show in living memory has run a full grant cycle. Long Open is nineteen years and is the exception the whole province argues about: two parties have quietly asked whether it could be granted, both of them asked a court that has no jurisdiction here, and both were told the ground would have to be certified first, which returns the question to the Anchorhold and to a datum that walks a li a year.',
        whatAFinderDoes:
            'Sells the location once, on the spot, in cash or stones, to whoever is at the Meet that week, and does not lead the buyer to it. The buyer takes the direction and the distance and finds it themselves or does not. There is no warranty, no recourse and no second sale, and a finder who sells the same show twice is not punished, they are simply never bought from again in a province with one market in it.'
    },
    whyNobodyFixesIt: {
        whatOrderWouldTake:
            'A standing occupation. Not a garrison on a place, because there is no place: a body large enough to be at every surfacing within a season of it opening, across eleven days of ground, permanently, with a survey that is redrawn every year and a court sitting on top of the survey to issue whatever the redrawn thing is issued as.',
        whatItWouldCost:
            'An institution that exists nowhere in the world. The Long Cut administers five provinces with forty staff on a course schedule measured in centuries. The Deep Survey has four Surveyors for four arterials. Neither is a body that could re-survey a province annually, and neither could become one without inventing a cadence, a court and a register that nothing else in its system uses - which is the same as saying an apex would have to run this ground on a different clock from everything else it holds. The pass-through cost is worse: an occupation is defended by force and a holding is defended by paper, and paper is what the whole tier above the provinces is made of. An apex that governed the Blown Ground would be doing it with people rather than with documents, indefinitely, and would have proved in public that it can be made to.',
        whatItWouldReturn:
            'What a finder can carry. There is no crop, no quarry, no city, no toll road and nothing to tax, because there is no traffic to tax and no fixed party to tax it at. The province exports material out of surfacings that close, and a show taken by force returns what one show returns and then stops.',
        theInterestedReason:
            'Four roads meet in one gorge and there is no fifth. The Low Fall taxes the traffic of the whole world because the whole world has to pass through it, and the direct line between the western arm and the eastern one - eight days shorter, on every map, empty - runs across this ground. Order here is a fifth road, and a fifth road is the end of the centre\'s position. Nobody has ever written that down. Nobody has had to.',
        whoBelievesWhich:
            'The Wide Field believes the interested reason flatly and says so at market, which the Low Fall reads as the usual eastern insinuation about paper. The Low Fall believes the honest one and is right about it, and has never noticed that being right about the reason does not make it disinterested. The Quiet Marches has no opinion, because the Marches has no opinion about anything it cannot get a grant for. And an apex that recognises whoever holds ground, without caring what they are, has both reasons available and has never been asked which it is using.'
    },
    whatItMakesTrue:
        'That "better than a power vacuum" is a comparison rather than a figure of speech. Every province bordering this ground can point at what the alternative looks like: nobody to write to, nobody who can be made to answer, nobody whose paper is worth taking, and a border that leaks people in both directions. A house on your border that eats its own disciples is a house that answers a letter, keeps a compound at a fixed address, can be arbitrated against, and can be leaned on through whatever it holds from whoever granted it. The neighbours are not tolerating demonic houses because they are broad-minded. They are tolerating them because they have seen eleven days of the other thing and would rather have a correspondent.',
    whoIsOnIt: [
        {
            who: 'Finders',
            factionId: null,
            holds: 'nothing',
            doesHere:
                'Walk, alone or in twos, looking for a change in the cover, and sell a location once at the Meet for cash or stones. The only trade native to the ground and the only one that could not be done anywhere else.',
            whyHere:
                'Because it is the one trade in the world that requires no house, no register, no teacher and no capital beyond water, and because the thing they sell cannot be taken off them until they have said where it is.'
        },
        {
            who: 'The refused',
            factionId: null,
            holds: 'nothing',
            doesHere:
                'Everything else: carrying water, digging out caravans, guarding a show for whoever bought one, and dying at a rate nobody counts. Most of them arrived inside the last five years and most of them will not be here in five more.',
            whyHere:
                'Refusal at a gate is the commonest origin of an unaffiliated cultivator in the world, and this is the only ground where being unable to be looked up in a register is not a disadvantage, because there is nobody here to look anybody up.'
        },
        {
            who: 'The Crimson Abyss Hall\'s recruiters',
            factionId: 'sect-crimson-abyss-hall',
            holds: 'nothing',
            doesHere:
                'Work the Meet the way they work the eastern admission days: a table, a cash box, and the first month paid in advance to anybody who will sign. They take more people out of this ground than they take out of any city in the Wide Field, and they take them out alive, which is a sentence their rivals find difficult.',
            whyHere:
                'It is the largest concentration of refused cultivators in the world and the only one with no gate, no register and no competing recruiter standing next to them.'
        },
        {
            who: 'The Bone Lantern Cult',
            factionId: 'sect-bone-lantern-cult',
            holds: 'nothing',
            doesHere:
                'Buys what the sand gives back. The cover keeps a body and returns it a decade later with its possessions on it, so the ground is the richest supply of intact dead in the world and the only one nobody has a claim on.',
            whyHere:
                'Everywhere else the dead belong to a family, a sect hall, a temple or an ice-form. Here they belong to whoever is standing over them, which is the whole of the Cult\'s procurement problem solved in one province.'
        },
        {
            who: 'The Gleaners\' Company',
            factionId: 'sect-gleaners-company',
            holds: 'nothing',
            doesHere:
                'Buys at the Meet, by weight, on the same manifest rule it uses at Hollowmarket, and will not send a crew in. The Company is the only institution operating here that publishes what it does here, and what it publishes is that it buys and does not dig.',
            whyHere:
                'A yard four days away in Kettle and a market with one buyer at it is the same trade the Company already runs, with the sorting done by somebody else and the losses taken by somebody else.'
        },
        {
            who: 'The Measured Span',
            factionId: 'house-measured-span',
            holds: 'nothing',
            doesHere:
                'One gate station, at Midway, on ground so worthless the question of granting it has never arisen - which is the house\'s own account of all nine of its stations and is more literally true here than anywhere. It opens on the station\'s own cycle and not on anybody\'s convenience, and it is why the ground is survivable for people who can pay a gate fee and lethal for everybody else.',
            whyHere:
                'The house carries for everyone and is owed nothing by anyone, and this is the only ground in the world where that doctrine costs it nothing, because there is nobody here who could have owed it anything.'
        },
        {
            who: 'The Thousand Treasure Pavilion\'s buyers',
            factionId: 'sect-thousand-treasure-pavilion',
            holds: 'nothing',
            doesHere:
                'Two men at the Meet in season, buying dug goods and asking nothing about the hole, exactly as the Pavilion buys everywhere. What they will not do is catalogue where a lot came from, because a lot from here has no provenance that would survive being written down.',
            whyHere:
                'It is the only source in the world of material out of dense ground that nobody owns, which means it is the only material on the circuit that no house can post a notice against.'
        },
        {
            who: 'The Held Names, at one remove',
            factionId: 'house-held-names',
            holds: 'nothing',
            doesHere:
                'Nothing, in person. It posts a standing rate at nine city gates for an unregistered cultivator brought in upright, and this ground is where the unregistered are. The house has never sent anybody in and has no intention of doing so.',
            whyHere:
                'It is not here. It is the reason a proportion of the people here cannot leave, which is a different kind of presence and is the one that shapes the population.'
        }
    ],
    howManyNote:
        'Nobody has counted and nobody could. The two figures that exist are the Meet\'s own head count in the week it assembles, which has run between about eight hundred and about four thousand depending on the season and on how many shows are open, and the standing bounty postings at nine eastern gates, which count the people who have been noticed rather than the people who are here. Both are quoted as if they were the population and neither is.',
    howRankIsSpoken:
        'In the words the world already uses for people with no house - loose cultivator, wandering senior, solitary - which are `ROGUE_STANDING` in `rogues.ts` and are the only rank vocabulary in use here, because a rank vocabulary is a thing houses maintain and there are no houses. The words are not honours and nobody confers them: they are what a place starts calling somebody once "they must be somebody\'s" has been checked and found false. This is the one ground in the world where that check comes back false as a matter of course.',
    register: {
        colour: 'yellow-white and shadowless, with one exception: a show is dark, because nothing grows on it and the sand has been scoured off the rock',
        light: 'flat, enormous and from every direction at once off the sand, so nothing casts a useful shadow and distance cannot be judged at all after the first hour',
        sound: 'wind, and nothing else whatsoever - no water, no bells, no chisels, no people at any distance - which is why a voice carries absurdly far and everybody here speaks quietly by habit',
        smell: 'hot stone and old leather, and no organic smell of any kind, which visitors from the Wide Field find harder to sit with than the heat',
        food: 'dried mutton, hard flatbread and whatever came off the last caravan, eaten in the dark because nobody lights a fire where it can be seen from a rise'
    },
    customs: {
        socialPrinciple: 'Nothing that outlasts a season. What stands in for it is the finder\'s custom - a location is sold once, on the spot, and not led to - kept because there is one market in eleven days of ground and it is the only sanction anybody has.',
        death: 'Left where they fell, and the cover takes them within the year and gives them back a decade later with their possessions still on them. Nobody is buried and nobody is burned, and the dead belong to whoever is standing over them when the sand puts them out again.',
        taboo: 'Never point. Indicating where a show is, in company, with your hand, is how a finder is killed, and a visitor who does it at the Meet has the conversation ended for them by somebody else before they have finished the gesture.',
        threatModel: 'People, and specifically people who have already been refused everywhere. There is no institution to answer for anyone and nothing to be taken away from anyone, so what a stranger will do is decided entirely by what they think they can get, and everybody plans on that being the whole of it.',
        naming: 'The gate that refused you: Refused-at-Thirdwall Ma, Wheatgate Bo, Kettle-Queue Ren. Where the Drowned Reach names a person for where they came aboard and asks nothing past it, this ground names them for where they were turned away and asks a great deal past it, because who refused you is the only prior anybody has on you.',
        time: 'Counted in shows. "Two shows ago" is anything from a season to nine years and nobody converts it, and the only fixed calendar anybody here observes is the posting cycle at nine city gates, which is imported, resented and universally known.'
    },
    ambientProfile: { thin: 78, normal: 4, dense: 12, spirit_tide: 6 },
    ceilingOrdinal: 28,
    ceilingNote:
        'Twenty-eight, which is above both of the provinces anybody calls poor and fourteen times the water\'s, and is not a statement about the air - the air on a show is the best unowned ground in the world. It is where the road stops needing things that can be found and starts needing things that have to be made. A show is unowned dense ground, and unowned dense ground is the one place single-use material comes out of the earth rather than out of a house - which makes this the likeliest answer to the question `rogues.ts` says a province would dearly like to put to a solitary and cannot. What it cannot supply is a teacher or a refinement, and above Deity Transformation the road needs both. So the ground carries an unbacked cultivator to twenty-eight and stops, one rung below the height at which the world\'s word for them turns wary. It makes solitaries and it cannot keep one.',
    ambientRateMultiplier: 1,
    veinStatus:
        'Shallow, rich, unmapped and unsurveyable in any way that lasts. It is one vein rather than several, it runs the length of the wedge, and what varies is not the vein but the depth of the cover over it - which is why the ground is worth more than the Quiet Marches and less than nothing to anybody who wants to own it.',
    places: [
        { name: 'The Meet', kind: 'market_town', ambient: 'thin', note: 'The one market, which assembles for about six weeks after the wind turns and disperses. Everything sold here is sold once and nothing bought here comes with a name attached.' },
        { name: 'The Sink', kind: 'site', ambient: 'thin', note: 'Water under the sand, dug for and shared because there is no second one within four days. The only fixed point in the whole wedge and the only thing here nobody has ever fought over.' },
        { name: 'Long Open', kind: 'site', ambient: 'spirit_tide', note: 'A show that has been open nineteen years, which is longer than a grant runs, and is consequently the only ground here anybody has killed over more than once.' },
        { name: 'The Fortnight', kind: 'site', ambient: 'thin', note: 'The direct line, named for the saving it promises against the gorge road. It saves eight days when it works and nobody has published how often it works.' },
        { name: 'Tuo\'s Wall', kind: 'site', ambient: 'thin', note: 'Where a house tried to stand still. About two hundred paces of it are above the sand and the rest is not, and nobody now living can name what it was called.' },
        { name: 'Midway', kind: 'waystation', ambient: 'thin', note: 'The gate station, which is not midway and is about a third of the way, and which everybody provisions against as though it were half.' }
    ],
    hazards: [
        'no water: four days between the Sink and anything else, and the ordinary cause of death here is a sum somebody did before setting out',
        'cover that moves about a li a year, so a route walked last season is not a route, and the stakes the Sixmile Wardens paint stop at the Marches survey',
        'other people, in a place where nobody can be complained about to anybody, and where a stranger has no institution behind them and nothing to lose',
        'shows that close while somebody is sitting on one, which is not dangerous in itself and strands people who provisioned for a season on ground they were being paid to guard',
        'buried caravans that are worth opening, which is how a proportion of the population arrived at the trade and how a proportion of it stopped'
    ],
    theRouteNobodyTakes: {
        fromRegionId: ADJACENT_REGION_ID,
        toRegionId: EAST_REGION_ID,
        directDays: 9,
        throughTheCentreDays: 17,
        whyItIsEmpty:
            'Eleven days to Scarwater and six down the gorge is seventeen days and a toll; the direct line is nine and is free. It is empty because no convoy can be insured across it - the Consortium will not write the policy at any price, which is the strongest thing a commercial house can say about anything - and because a cart that is robbed on it has been robbed by nobody, in nowhere, with no bench that would hear it. Every party that has tried the shortcut with goods has arrived, or has not, and the ones that did not are the reason the eight days are still there to be saved.'
    },
    whatItCostsTheNeighbours: [
        {
            regionId: HOME_REGION_ID,
            what: 'Nothing comes out at the Low Fall, and that is the cost: the ground sits behind the province rather than beside it, and the province is the centre because of it.',
            cost: 'The Low Fall\'s whole position - four roads in one gorge, a toll on traffic it never generated, and every other province resenting it in the same words - rests on the fact that the fifth road crosses ground nobody administers. The centre is being paid for by a vacuum it does not run, does not want run, and has never had to defend in any document. If the Blown Ground were ever held, the Low Fall would find out what it is worth without a chokehold, and no institution in the province has ever put that question in writing.'
        },
        {
            regionId: ADJACENT_REGION_ID,
            what: 'People. The sand starts about a day past the last painted stake, and the carvers who cannot get onto the Gapwater queue do not all go east.',
            cost: 'The Marches loses about two hundred a year to the Low Fall and nobody counts what it loses this way, because the ones who go this way are the ones nobody at the Weir counter has a record of. The Sixmile Wardens repaint nine hundred stakes a year on ground the Long Cut has never scheduled, and the stakes stop where the sand starts, and the Wardens will tell a visitor once, free, that they stop there for a reason.'
        },
        {
            regionId: EAST_REGION_ID,
            what: 'Raiding on the western fields, and the thing the East does about it, which is to pay a demonic house to get there first.',
            cost: 'The Consortium prices every convoy west of Thirdwall against losses it attributes to weather, and the Wheatgate Table sits outside nine admission days with a cash box paying the first month in advance to whoever was refused inside that morning. The East knows exactly what it is doing: a refused cultivator who signs with the Crimson Abyss Hall is a person with an address, a rank list and an institution that can be written to, and a refused cultivator who walks west is not. Nine cities have decided that a demonic house is cheaper than the alternative, and the alternative is nine days\' walk away and can be pointed at.'
        },
        {
            regionId: SOUTH_REGION_ID,
            what: 'A coast with nothing on it. The sand runs down to the water on the northern side of the eastern passage, and there is no fresh water anywhere along it.',
            cost: 'It is why the eastern passage has a stretch in the middle with no landfall in it, why that stretch is called Dryrun, and why the water ration on every hull in the province is counted aloud at the same hour every day. A coast is normally a place a hull can put in. Twenty-one days of this one is not, and the whole arithmetic of the busiest water in the South is set by ground nobody has ever governed.'
        }
    ],
    trueHereFalseThere: [
        'A survey is correct and expires. Everywhere else a survey is permanent and grantable, or impossible, or beside the point; this is the only ground in the world that is measured constantly, measured accurately, and granted to nobody, because what it measures walks about a li a year.',
        'Dense ground has nobody on it. In every province in the world a vein is owned before it is found, and here a cultivator with no house, no register entry and no teacher can sit on spirit-tide ground for as long as it lasts - which is where every solitary in the world got what a book alone cannot buy.',
        'A find is sold once, at the finder\'s price, to whoever is nearest. Everywhere else the seller\'s problem is proving where a thing came from; here the buyer\'s problem is that the place it came from will not be there next season, and no warranty, bench or bond exists that would cover it.',
        'The shortest road in the world runs through here and it is empty. Every other route in the world is used, tolled and argued over; this one is on every map, saves eight days between two provinces, costs nothing, and carries no cart, no courier and no insured convoy at all.'
    ],
    crossingNotes: [
        'The stakes stop. Whichever side a traveller comes in from there is a last painted marker, a Warden or a Ledger boundary stone or the end of a lease line, and then there is not one, and the change is abrupt enough that most people stop walking without deciding to.',
        'It is silent in a way the Quiet Marches is not. The Marches is loud and named for a silence that is about the air; here the air is fine in patches and the silence is literal, and a visitor notices within an hour that they can hear their own clothes.',
        'The qi is wrong twice in one day. A cultivator crossing feels less than the thinnest ground they have ever sat on for most of a morning, and then walks onto a show and feels better ground than anything they have ever been allowed near, and both of those are the same province and neither belongs to anybody.',
        'Nobody asks what sect you are, what grant you hold, what your root is or where you came aboard. They ask which gate turned you down, they ask it early, and the answer is not idle: it is the only thing anybody here can check about anybody.',
        'There is no counter, no bench, no register, no bell and no queue. A visitor from any of the four provinces spends the first day looking for the thing that decides matters and finds that the answer is the person in front of them.'
    ]
};

// ─────────────────────────────────────────────────────────────────────────
// UNGOVERNED LOOKUPS
// Lookups only. Nothing here decides anything - who would win a fight over a
// show, what one is worth, how many it takes to hold one - because those are
// questions for the resolvers and a weight function living in a lore file is
// a second combat system.
// ─────────────────────────────────────────────────────────────────────────

export const UNGOVERNED_GROUND: readonly UngovernedGround[] = [THE_BLOWN_GROUND];

/** Ungoverned ground on a province's border, if any. */
export function ungovernedGroundBordering(regionId: string): UngovernedGround[] {
    return UNGOVERNED_GROUND.filter(g => g.borderingRegionIds.includes(regionId));
}

/** What this ground costs a named province, in that province's own terms. */
export function leakageInto(groundId: string, regionId: string): Leakage | undefined {
    return UNGOVERNED_GROUND
        .find(g => g.id === groundId)
        ?.whatItCostsTheNeighbours.find(l => l.regionId === regionId);
}

/**
 * Whether an unbacked cultivator at this ordinal still has anything to gain
 * from ungoverned ground. Same reading as `canAdvanceHere`, and the answer at
 * 28 is the whole point of the place.
 */
export function canAdvanceOnUngoverned(groundId: string, ordinal: number): boolean {
    const ground = UNGOVERNED_GROUND.find(g => g.id === groundId);
    return ground !== undefined && ordinal < ground.ceilingOrdinal;
}
