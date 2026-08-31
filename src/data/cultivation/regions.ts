/**
 * Regions - two of them, and the contrast between them is the content.
 *
 * "Depth, not scale" is meaningless while every faction stands in one
 * province, because then it just means "small". It needs a second place where
 * the assumptions are different - not the scenery, the assumptions.
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

export const RegionConnectionSchema = z.object({
    kind: z.enum(['trade_route', 'refugee_flow', 'shared_feud', 'shared_institution', 'unsettled_border']),
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
// Both regions relabel the same ladder. The Low Fall's labels happen to be
// the standard ones, because the standard vocabulary is the Low Fall's.
// ─────────────────────────────────────────────────────────────────────────

/** Standard names, band for band, from the one ladder. */
const STANDARD_BANDS: LocalRankBand[] = REALM_TIERS.map(tier => ({
    fromOrdinal: tier.ordinalStart,
    toOrdinal: tier.ordinalEnd,
    standardName: tier.name,
    localName: tier.name,
    localTheory:
        'The Low Fall wrote the standard vocabulary and has never had cause to notice that it is a vocabulary rather than the thing itself.',
    localSubdivisions: tier.subRanks.length,
    standardSubdivisions: tier.subRanks.length,
    subRankCorrespondence: 'none',
    subRankNote:
        'Trivially self-consistent here, and the Low Fall mistakes that for the sub-ranks being real. Asked to place a foreign cultivator inside a realm, its experts guess, and are confident.'
}));

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
        fromOrdinal: 45, toOrdinal: 45,
        standardName: 'True Immortal', localName: 'Through',
        localTheory: 'One word, no elaboration, and the inscription does not continue past it.',
        localSubdivisions: 0, standardSubdivisions: 1,
        subRankCorrespondence: 'none',
        subRankNote: 'One word against one rank, which is the only place the two vocabularies accidentally agree on the shape of anything.'
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
export const ADJACENT_REGION_ID = 'region-quiet-marches';

export const REGIONS: readonly Region[] = [
    {
        id: HOME_REGION_ID,
        name: 'The Low Fall',
        role: 'home',
        traditionId: 'tradition-drawn',
        summary:
            'A drawn-down but working province: nine river towns, four sect mountains, a live trade in medicine and manuals, and twenty-six institutions with overlapping claims on eleven veins. What limits a cultivator here is talent and money, not the ground.',
        governingFact:
            'The veins here are horizontal, shallow and surveyable, so the qi belongs to whoever holds the surface above it - and the surface has been held continuously for four hundred years.',
        derivations: [
            'Territory is the only currency of standing, so every border is an argument about a survey line rather than about strength',
            'Institutions outlast people, because a vein outlasts the cultivator who took it, so a sect can be formidable with no formidable members',
            'The whole apparatus of arbitration, oath-witnessing and certification exists because holdings must be provable to be defensible'
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
            'Federated. Twenty-seven institutions holding single veins on twelve-year grants from something none of them names in public, competing for standing with whoever renews them rather than for the veins themselves - which is why the province argues constantly and burns rarely. A newcomer with talent has options here, and every one of them is somebody else\'s tenant.',
        factionIds: [
            'sect-azure-cloud-pavilion',
            'sect-azure-mist-court',
            'sect-azure-dew-sect',
            'sect-verdant-spring-hall',
            'sect-nine-peaks-ascetic-order',
            'sect-clear-river-alliance',
            'sect-sweptground-temple',
            'sect-lantern-hall',
            'sect-standing-grove',
            'sect-stonewright-consortium',
            'sect-thousand-treasure-pavilion',
            'sect-cinnabar-crucible-guild',
            'sect-ashen-forge-clan',
            'sect-hollow-bell-wanderers',
            'sect-frostmirror-court',
            'sect-kiln-wardens',
            'sect-hollow-court',
            'sect-the-severed',
            'sect-crimson-abyss-hall',
            'sect-bone-lantern-cult',
            'sect-nine-abyss-flame-sect',
            'sect-storm-tyrant-court',
            'house-ninefold-ledger',
            'house-narrow-hour',
            'house-bound-word',
            'house-quiet-cut',
            'house-held-names',
            'house-measured-span',
            'house-anchorhold'
        ],
        branches: [
            {
                parentSectId: 'sect-gleaners-company',
                localName: 'The Hollowmarket Factor at Scarwater',
                doesHere:
                    'Sells Marches salvage into the Low Fall market: sealed-site finds, scar-ground herbs, and the occasional manual in a grade the Marches has no teacher for. Buys nothing and is watched by the Bone Lantern Cult, which considers the trade its own.'
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
            }
        ],
        trueHereFalseThere: [
            'A pill above mortal grade can be bought over a counter, today, in four towns.',
            'A cultivator\'s rank is stated in a vocabulary every party to a contract already agrees on.',
            'Sitting still on ordinary ground, in the open, makes measurable progress.'
        ],
        crossingNotes: [
            'Coming the other way, the noise is the first thing: sect patrols, courier traffic, and four separate parties claiming the same road.',
            'The air is wet. A carver arriving from the Marches usually stops within sight of the ford and has to be told what they are feeling.',
            'Medicine is purchasable. A Clear Meridian Pill is sixty stones and in stock, which no shop in the Marches can say.'
        ]
    },

    {
        id: ADJACENT_REGION_ID,
        name: 'The Quiet Marches',
        role: 'adjacent',
        traditionId: 'tradition-cut',
        summary:
            'The province people leave, and the only place in the world where cultivation is a trade with tools. Something broke here nine hundred years ago and drove the qi out of the air and into the rock, so the Marches does not breathe qi - it cuts it out of stone, and everything about the place follows from that.',
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

/** The two regions' contrast, as a table a tool can render directly. */
export function regionContrast(): {
    aspect: string;
    home: string | number;
    adjacent: string | number;
}[] {
    const home = getHomeRegion();
    const away = requireRegion(ADJACENT_REGION_ID);
    return [
        { aspect: 'factions seated', home: home.factionIds.length, adjacent: away.factionIds.length },
        { aspect: 'method', home: 'ordinary drawing', adjacent: 'carving' },
        { aspect: 'politics', home: home.politics, adjacent: away.politics },
        { aspect: 'local ceiling (ordinal)', home: home.localCeilingOrdinal, adjacent: away.localCeilingOrdinal },
        { aspect: 'ambient rate multiplier', home: home.cultivation.ambientRateMultiplier, adjacent: away.cultivation.ambientRateMultiplier },
        { aspect: 'disciplines that do not work', home: home.cultivation.missingDisciplines.length, adjacent: away.cultivation.missingDisciplines.length },
        { aspect: 'price multiplier', home: home.priceMultiplier, adjacent: away.priceMultiplier }
    ];
}

/** Ambient states present in a region at all, commonest first. */
export function ambientStatesIn(regionId: string): AmbientQi[] {
    const profile = requireRegion(regionId).ambientProfile;
    return (Object.entries(profile) as [AmbientQi, number][])
        .filter(([, share]) => share > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([state]) => state);
}
