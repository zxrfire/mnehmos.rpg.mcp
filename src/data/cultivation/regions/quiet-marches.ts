/**
 * The Silent Cliffs: driven stone cut with tools, the last of the five driven
 * provinces, and the one people leave.
 *
 * The map row, the vocabulary the Cut Road named for itself, and the six face
 * districts inside it. The districts are a different kind of object from the
 * Jade Gorge's catchments and the argument for why is kept here, where it was
 * written - see the banner above `QUIET_MARCHES_PREFECTURES` below.
 */

import { PLACE, REGION_NAME } from '../place-names.js';
import type { LocalRankBand, Region } from './region-schema.js';
import type { Prefecture } from './prefectures.js';
import { ADJACENT_REGION_ID, HOME_REGION_ID, QUIET_MARCHES_PROVINCE_ID } from './region-ids.js';

/**
 * The Silent Cliffs counts the same rungs in cut stone. Every band below maps one
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
        localTheory: 'A carver at Keystone has no golden core. What they have is a worked seam running through the body that holds load. The Silent Cliffs maintains this is a different thing entirely and will explain why at length; both traditions nonetheless agree instantly on who has crossed into the realm, because it is visible.',
        localSubdivisions: 3, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Three courses again, and a Keystone carver will say which course they are on and mean something no Jade Gorge examiner can convert.'
    },
    {
        fromOrdinal: 21, toOrdinal: 24,
        standardName: 'Nascent Soul', localName: 'The Inner Face',
        localTheory: 'The carver opens a face inside themselves and can work it where there is no stone. The name is descriptive rather than metaphysical: there is no soul in it, and a carver told that the standard vocabulary calls this Nascent Soul will usually laugh.',
        localSubdivisions: 2, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'Two states, opened and worked, against four stages. The Silent Cliffs does not recognise a distinction between what the standard ladder calls Late and Perfection.'
    },
    {
        fromOrdinal: 25, toOrdinal: 28,
        standardName: 'Deity Transformation', localName: 'Loadbearing',
        localTheory: 'The body carries what the stone used to carry. Two carvers are recorded at Loadbearing in nine hundred years and both left for the Jade Gorge inside a decade.',
        localSubdivisions: 0, standardSubdivisions: 4,
        subRankCorrespondence: 'none',
        subRankNote: 'No subdivisions at all. The Silent Cliffs has two instances and no basis on which to divide them.'
    },
    {
        fromOrdinal: 29, toOrdinal: 32,
        standardName: 'Void Refinement', localName: 'Hollowing',
        localTheory: 'Working out the last of the seam. The Silent Cliffs has the word and no instance of it.',
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
        subRankNote: 'Inscription vocabulary. The Silent Cliffs uses the word and could not recognise the state if it walked into Iron Gate.'
    },
    {
        fromOrdinal: 37, toOrdinal: 40,
        standardName: 'Grand Ascension', localName: 'Capstone',
        localTheory: 'The last course laid. Nobody in the Silent Cliffs can say what it means and the term is used anyway, because the inscription uses it.',
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
        subRankNote: 'Inscription vocabulary. The Silent Cliffs assumes it is one state and the Jade Gorge knows it is four, and neither has met anyone to ask.'
    },
    {
        fromOrdinal: 45, toOrdinal: 46,
        standardName: 'Immortal', localName: 'Through',
        localTheory: 'One word, no elaboration, and the inscription does not continue past it.',
        localSubdivisions: 0, standardSubdivisions: 2,
        subRankCorrespondence: 'none',
        subRankNote: 'One word against two states, and they are not variations on each other - one of them is over the Lid and the other is through it. The Silent Cliffs has never had to tell them apart, which is a fact about the Silent Cliffs and not about the Lid.'
    }
];

/** The western arm, as the map holds it. */
export const THE_QUIET_MARCHES: Region = {
    id: ADJACENT_REGION_ID,
    name: REGION_NAME.SILENT_CLIFFS,
    role: 'adjacent',
    bearing: 'west',
    traditionId: 'tradition-cut',
    summary:
        'The province people leave: the western end of the world, the last of five driven provinces, and the only place in it where cultivation is a trade with tools. Something broke here nine hundred years ago and drove the qi out of the air and into the rock, so the Silent Cliffs does not breathe qi - it cuts it out of stone, and everything about the place follows from that. It has one road, it goes east, and there is nothing on the other side of the Silent Cliffs but four more provinces like it that nobody here has seen.',
    governingFact:
        'The qi is not gone; it was driven into the stone. There is nothing in the air and a great deal in the rock, and the only way to get at it is to cut.',
    derivations: [
        'Cultivation is a trade with tools, a working day and an apprenticeship, so a carver at Standing Cut has the hands of a quarryman and the lungs of one',
        'Status is measured in worked face rather than land, so the Weir Office rents cut by the day and holds the region by holding the two faces still worth working',
        'The whole region is loud and grey with dust, in a place named for silence, because the silence people meant was the absence of qi in the air'
    ],
    register: {
        colour: 'grey on grey: rock dust on everything, whitened hands, pale rings around every mouth and nose that has worked a face',
        light: 'flat and hard, no haze, and a dust plume over Iron Gate visible from the border marker on a still day',
        sound: 'chisels. Two hundred of them, dawn to dark, and the silence when a face is worked out is how a district learns it is finished',
        smell: 'cut stone and wet grit, cold iron, and the vinegar the carvers rinse their mouths with against the dust',
        food: 'flatbread, salt, boiled roots, and a thin sour broth drunk hot to clear the throat - imported grain, because a fifth of the arable land is gone'
    },
    customs: {
        socialPrinciple: 'Patronage. One holder, a public and wholly discretionary grant book, and no second party to defect to, so the only political question anyone asks is who is on the book.',
        death: 'The dead are walled into the face they were working, and the face is finished around them. A worked-out district is therefore also a cemetery, and the Gleaners will not cut a face that holds somebody without asking the family.',
        taboo: 'Never leave a cut unfinished. Locals hold that an open cut spreads the deadening, and a visitor who chips a souvenir off a face and walks away has committed the one offence the Silent Cliffs does not forgive.',
        threatModel: 'The ground. Dead zones that do not look dead, a burn edge that moves about a pace a year, and dust-lung, which kills more carvers than everything else combined.',
        naming: 'Tool-names and face-numbers rather than clan names: Chisel Ma, Third Face Ren, Stakes, Iron Gate Bo. A person who gives two names in the Jade Gorge style is announcing that they are leaving.',
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
                reason: 'A refinement needs ambient qi to hold its shape while it sets. In the Silent Cliffs it does not set: pills come out inert or come apart within the month, so every pill in the region is imported eleven days by cart.'
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
            'Advancement costs grant time and tools: forty stones a day for a face at the Jade Face, a chisel that survives about a season, and a set of lungs that will not. Nothing else in the region is for sale that helps.',
        localRankNames: MARCHES_BANDS
    },
    ambientProfile: { thin: 62, normal: 8, dense: 1, spirit_tide: 0 },
    localCeilingOrdinal: 6,
    ceilingNote:
        'Outside the two rented faces a carver stops at about Qi Condensation Layer 7, because the loose stone within reach of an unfunded person is worked out. Nobody born in the Silent Cliffs has passed Chipping in living memory without buying grant time or leaving.',
    veinStatus:
        'The veins are not drawn down, they are driven: whatever happened here forced the qi out of the air into the rock and killed the ground above it, and the dead ground has been spreading about a pace a year ever since.',
    politics: 'single_hegemon',
    politicsNote:
        'Direct rule. The province is administered by the institution that holds it, through a local bureau of eleven people at the weir, and there are no client sects anywhere in it - no leases, no vassals, no local hierarchy to belong to. The Weir Office looks like a hegemon and is a counter. There is no rivalry here because there is nobody to be rival with: only application, refusal, and an appeal form that is logged and answered years later.',
    factionIds: [
        'sect-weir-office',
        'sect-sixmile-wardens',
        'sect-gleaners-company',
        'sect-sink-carriers'
    ],
    branches: [
        {
            parentSectId: 'sect-stonewright-consortium',
            localName: 'The Iron Gate Assay House',
            doesHere:
                'Buys salvage, assays and cuts stones, sells them back at nineteen percent over Jade Gorge, and publishes the insurance table that reads every Silent Cliffs title one rank low. In a region where imported stones are the only alternative to grant time, the assay house is the second government.'
        },
        {
            parentSectId: 'sect-sweptground-temple',
            localName: 'The Iron Gate Mission',
            doesHere:
                'Teaches the Lesser Qi-Gathering Manual and elementless basics free to anyone who turns up, and is the only institution in the region that will tell a carver plainly that their local titles and the standard ladder are the same rungs. Four monks, no face, no grant.'
        }
    ],
    places: [
        { name: PLACE.IRON_GATE, kind: 'market_town', ambient: 'thin', note: 'The Weir Office town: grant queue, assay house, mission, and a permanent dust plume.' },
        { name: PLACE.GRAVE_MARKET, kind: 'village', ambient: 'thin', note: 'The Gleaners\' sorting yard, where salvage is priced before it goes to Iron Gate.' },
        { name: PLACE.SIX_LI, kind: 'hamlet', ambient: 'thin', note: 'A shed, a survey, and the Wardens who repaint the stakes.' },
        { name: PLACE.JADE_FACE, kind: 'site', ambient: 'dense', note: 'One of two workable faces. Grant access at forty stones a day, and a queue of eleven.' },
        { name: PLACE.DEAD_STONE, kind: 'site', ambient: 'thin', note: 'The current burn edge. It has moved about nine hundred paces since the survey was drawn.' }
    ],
    exports: [
        'sealed-site salvage, the region\'s only real product',
        'scar-ground herbs that will not fruit on healthy land',
        'carvers, who arrive in the Jade Gorge lopsided: hard bodies, no formations, no alchemy'
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
                'The border road to Clear River Ford: eleven days by cart and the only route that does not cross dead ground. Salvage out, pills and grain in, at a fourteen percent premium before haggling.',
            travelDays: 11
        },
        {
            kind: 'refugee_flow',
            otherRegionId: HOME_REGION_ID,
            description:
                'Everyone who can leave, leaves - perhaps two hundred a year for a century. It is why the Silent Cliffs sects are small, why its inheritance disputes are rare, and why the Jade Gorge has a word for the cough.',
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
                'The last forty li before Iron Gate are on no survey the Anchorhold will certify, so nothing sworn there binds and nothing owned there can be proved. The Gleaners and the Quiet Cut both use it, for opposite reasons.',
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
        'The road is staked in painted wood rather than paved, and leaving the stakes is how people die here. The Six Li Wardens explain this once, free, and are visibly tired of explaining it.',
        'Nobody asks what realm you are. They ask whether you hold a grant, and the answer decides the rest of the conversation.',
        'There are no sect patrols, no admission days and no gates with disciples on them - there is a counter, a register, a queue, and a clerk who is not empowered to make an exception and will say so pleasantly.',
        'Local ranks are trade titles - Chipping, Standing Cut, Keystone - and a visitor who hears "Standing Cut" as a labourer\'s grade has just misread a Foundation Establishment cultivator, which is the ordinary way outsiders get hurt here.',
        'No shop sells a pill above mortal grade, and no alchemist in the region can make one, because refinements do not set in air with nothing in it.',
        'Every carver has split white hands and a cough, including the rich ones, and a visitor with soft hands is assumed to be from the assay house or the mission.'
    ]
};

// ─── prefectures of the Silent Cliffs: face districts ────────────────────
// A different kind of object, for a reason one sentence long: there is nothing
// in the air, so a holding is not ground, it is work. Every one of these is
// held by an office or by nobody. Not one is held by a sect, because there are
// no sects here to hold one, and that absence is the region.

export const QUIET_MARCHES_PREFECTURES: readonly Prefecture[] = [
    {
        id: 'district-gapwater',
        name: 'The Jade Face District',
        provinceId: QUIET_MARCHES_PROVINCE_ID,
        kind: 'face_district',
        seat: PLACE.IRON_GATE,
        places: [PLACE.JADE_FACE],
        heldByFactionId: 'sect-weir-office',
        delegatedFromId: 'court-ninth-face',
        subHoldings: [],
        onPaper:
            'One of two workable faces in the province, entered on the Long Cut course schedule in the bottom band, administered by the Weir Office from a counter at Iron Gate.',
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
        seat: PLACE.IRON_GATE,
        places: [],
        heldByFactionId: 'sect-weir-office',
        delegatedFromId: 'court-ninth-face',
        subHoldings: [],
        onPaper:
            'The second of the two rented faces, on the same schedule line as the Jade Face, administered from the same counter by the same eleven people.',
        onTheGround:
            'Thinner than the Jade Face and worked by whoever cannot get onto the Jade Face queue, which the Office does not say out loud and which the queue works out inside a season.',
        discrepancy: 'none',
        note:
            'A district exists here because there is work in it. When the face is out, this entry does not change hands - it stops existing, and the ground under it becomes a cemetery.'
    },
    {
        id: 'district-hollowmarket',
        name: 'The Willow Village District',
        provinceId: QUIET_MARCHES_PROVINCE_ID,
        kind: 'face_district',
        seat: PLACE.GRAVE_MARKET,
        places: [PLACE.GRAVE_MARKET],
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
        name: 'The Six Li District',
        provinceId: QUIET_MARCHES_PROVINCE_ID,
        kind: 'face_district',
        seat: PLACE.SIX_LI,
        places: [PLACE.SIX_LI],
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
            'The Silent Cliffs answer to the Clear River Ford unsurvey, arrived at from the opposite direction: not ground too disputed to certify, but ground too worthless to schedule, kept alive by people who were never appointed to keep it.'
    },
    {
        id: 'district-dead-verge',
        name: PLACE.DEAD_STONE,
        provinceId: QUIET_MARCHES_PROVINCE_ID,
        kind: 'face_district',
        seat: 'no seat: nobody lives inside it',
        places: [PLACE.DEAD_STONE],
        heldByFactionId: null,
        delegatedFromId: 'court-ninth-face',
        subHoldings: [],
        onPaper:
            'The burn edge, redrawn every year, which makes it the only prefecture in either province whose boundary is a date rather than a line.',
        onTheGround:
            'It has moved about nine hundred paces since the survey was drawn, at roughly a pace a year, faster after wet winters, and it has taken about a fifth of the arable land with it.',
        discrepancy: 'no_holder_of_record',
        note:
            'A Jade Gorge catchment is argued about because two parties both want it. This is argued about by nobody, because what is in dispute is not who holds it but how much of the province it will be next century.'
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
            'Eleven li of high Silent Cliffs that has not held qi in ninety years, since a woman went up alone in the spring and attempted the crossing. There is no body, because a failed crossing does not leave one.',
        discrepancy: 'none',
        note:
            'The only prefecture in the catalog whose entire purpose is to be walked four times a year by somebody who does not want it struck off, and who writes the word out in full every time.'
    }
];
