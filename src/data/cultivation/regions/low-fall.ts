/**
 * The Low Fall: the centre, the only province with a road to every other one,
 * and the only one in the world with no ceiling on it.
 *
 * Everything the world has that is about this province is here - the map row,
 * the vocabulary it wrote and everybody else borrowed, and the nine catchment
 * prefectures inside it. A prefecture is a subdivision of the province that
 * holds it, so it lives with the province rather than in a table of its own:
 * Nine Peaks is IN the Low Fall, and a change to the Low Fall should touch one
 * file.
 */

import { MAX_ORDINAL } from '../../../engine/cultivation/realms.js';
import { PLACE, REGION_NAME } from '../place-names.js';
import type { LocalRankBand, Region } from './region-schema.js';
import type { Prefecture } from './prefectures.js';
import { standardBandsWith } from './local-rank-names.js';
import {
    ADJACENT_REGION_ID,
    EAST_REGION_ID,
    HOME_REGION_ID,
    LOW_FALL_PROVINCE_ID,
    NORTH_REGION_ID,
    SOUTH_REGION_ID
} from './region-ids.js';

const STANDARD_BANDS: LocalRankBand[] = standardBandsWith(
    'The Low Fall wrote the standard vocabulary and has never had cause to notice that it is a vocabulary rather than the thing itself.',
    'Trivially self-consistent here, and the Low Fall mistakes that for the sub-ranks being real. Asked to place a foreign cultivator inside a realm, its experts guess, and are confident.'
);

/** The centre of the world, as the map holds it. */
export const THE_LOW_FALL: Region = {
    id: HOME_REGION_ID,
    name: REGION_NAME.LOW_FALL,
    role: 'home',
    bearing: 'centre',
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
        { name: PLACE.LOW_FALL, kind: 'city', ambient: 'normal', note: 'The province town under the gorge, and the Azure Cloud Pavilion\'s market.' },
        {
            name: PLACE.SCARWATER,
            kind: 'market_town',
            ambient: 'thin',
            note: 'The last ford before the border road, and where Marches goods are sold.',
            // THE LEG THE PROVINCE ROAD DOES NOT COVER, and it is the
            // reason this field exists rather than an illustration of it.
            //
            // The `trade_route` to the Quiet Marches below quotes its
            // eleven days as "the border road from Scarwater to Kettle" -
            // so the figure starts at the ford, and the stretch from the
            // province town out to the ford has never been priced by
            // anything. `daysOnTheRoadTo` charged a player one flat day
            // for it, the same day it charged for stepping anywhere else
            // inside a province, and the catalog had no way to say
            // otherwise: `Prefecture.places[]` puts two names in one
            // catchment without saying either is near the other.
            //
            // Two days, and it is authored here the way `travelDays: 11`
            // is authored twenty lines down - a gazetteer is where a
            // distance in this world comes from. What would have been the
            // fabrication is the ENGINE picking a number where the catalog
            // states none, which is the mistake `whereCouldTheyGo`
            // records having made once and which the null return from
            // `placeRoadDays` still prevents.
            connections: [
                {
                    kind: 'road',
                    otherPlaceName: PLACE.LOW_FALL,
                    description:
                        'The gorge road down from the province town to the ford, worked by carts in both directions every day of the year, and the stretch every quoted figure for the western road silently leaves off the front of itself.',
                    travelDays: 2
                }
            ]
        },
        { name: PLACE.SWEPTGROUND, kind: 'sect_town', ambient: 'thin', note: 'Temple ground, no vein, and the treaty vault of the Bound Word.' },
        { name: PLACE.NINE_PEAKS, kind: 'sect_town', ambient: 'dense', note: 'The deepest vein anyone has kept, and the Ascetic Order sitting on it.' },
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
                'Nine days down the river to the mouth and out to Sweetspring Isle, which is where the Low Fall\'s river ends and stops being a river. Salt up, pills and grain down, and the Clear River Fordhall will take a hull that far and refuses to go further.',
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
};

// ─── prefectures of the Low Fall: catchments ─────────────────────────────

export const LOW_FALL_PREFECTURES: readonly Prefecture[] = [
    {
        id: 'prefecture-gorge-head',
        name: 'The Gorge Head',
        provinceId: LOW_FALL_PROVINCE_ID,
        kind: 'catchment',
        seat: PLACE.LOW_FALL,
        places: [PLACE.LOW_FALL],
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
        seat: PLACE.NINE_PEAKS,
        places: [PLACE.NINE_PEAKS],
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
        seat: PLACE.SCARWATER,
        places: [PLACE.SCARWATER],
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
            'Run by the Clear River Fordhall, which holds no grant, keeps the fords open, takes a toll it has no authority to take, and is the reason the border road works at all.',
        discrepancy: 'no_holder_of_record',
        note:
            'Oaths sworn in the unsurveyed forty li do not bind and nothing owned there can be proved, which the Gleaners and the Quiet Cut both use, for opposite reasons.'
    },
    {
        id: 'prefecture-sweptground',
        name: PLACE.SWEPTGROUND,
        provinceId: LOW_FALL_PROVINCE_ID,
        kind: 'catchment',
        seat: PLACE.SWEPTGROUND,
        places: [PLACE.SWEPTGROUND],
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
