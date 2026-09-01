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
            'sect-storm-tyrant-court',
            'sect-kiln-wardens',
            'sect-hollow-court',
            'sect-the-severed',
            'sect-crimson-abyss-hall',
            'sect-bone-lantern-cult',
            'sect-nine-abyss-flame-sect',
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
            'The same, and the Frostmirror has been writing to the Third Sill about the cold-arterial figures for eleven years and has had four replies drafted and none of them sent.',
        discrepancy: 'none',
        note:
            'One of the two catchments that hold from the Survey directly, which is the whole of the Survey\'s remaining presence on its own ground now that the Eleven is administered from elsewhere.'
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
            'The one place in the province where the register and the ground disagree by an amount somebody has actually measured, and the man who measured it has been a Second Mark for nineteen walks because his figures keep disagreeing with the apportionment calculated off them.'
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
            'The Deep Survey holds the arterial system and the province standing on it: four arterials, eleven surveyed veins, twenty-seven institutions, and a datum nobody local can place.',
        onTheGround:
            'Two of the four arterials have no administrator, one is a datum nobody draws on, and the fourth - the only one anything branches from - is administered by a court that answers to the Long Cut. The Survey holds one province and is present on two catchments of it.',
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
