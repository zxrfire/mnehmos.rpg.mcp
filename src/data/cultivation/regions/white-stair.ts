/**
 * The White Stair: the qi is in the ice and the ice is going. A holding here
 * is an elevation, and it moves uphill.
 *
 * The map row and the vocabulary the North counts its rungs in, which maps one
 * to one onto the shared ladder and argues about dates instead of about rungs.
 */

import { PLACE, REGION_NAME } from '../place-names.js';
import type { LocalRankBand, Region } from './region-schema.js';
import { HOME_REGION_ID, NORTH_REGION_ID, SOUTH_REGION_ID } from './region-ids.js';

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
        subRankNote: 'Undivided, with two instances now and no way to order them: one at the top of the ice and one nine retreats below the face, neither of whom will say where inside the band she stands, on the shared and correct grounds that nobody in the province could check.'
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

// ── NORTH ────────────────────────────────────────────────────────────
// A wasting asset with three institutions standing on it, two of them on the
// ice and one below it. The governing fact was already in `sects.ts`: the
// Frostmirror's glacier retreats forty spans below its own working face. A
// province that knows exactly how long it has is a different sort of place
// from one that does not - and the third body is the one that stopped
// following the ice up, which is the only other thing anybody here can do
// with that figure.
export const THE_WHITE_STAIR: Region = {
    id: NORTH_REGION_ID,
    name: REGION_NAME.WHITE_STAIR,
    role: 'adjacent',
    bearing: 'north',
    traditionId: 'tradition-drawn',
    summary:
        'Above the snowline, past a pass that is shut five months a year: the richest air anybody has ever stood in, in a band forty paces wide, moving uphill. Three institutions, no register, no market and no arbitration, on ground that is measurably worth less every year and knows the figure - and one of the three is not on the ice at all.',
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
        'Three institutions and nothing else. None of them is granted through a court, because there is no court and no grant book here to be granted through - two hold directly from an apex, on the one arterial in the world that has no administrator, and the third holds from nobody at all and was offered and refused. So the province has no arbitration bench, no register, no assay house and no third party of any kind to appeal to. What it has instead of politics is one running quarrel between a court that is climbing and a court that is falling, neither of which can finish the other - one cannot reach a floating stone and the other cannot hold a glacier - and a third body below the face that both of them have stopped writing to.',
    factionIds: [
        'sect-frostmirror-court',
        'sect-storm-tyrant-court',
        'sect-orchid-court'
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
        { name: PLACE.RIMEFALL, kind: 'sect_town', ambient: 'dense', note: 'The Frostmirror\'s town, moved uphill four times in four hundred years and carrying its name with it each time. Nothing in it is more than a century old.' },
        { name: PLACE.THE_GIVING, kind: 'site', ambient: 'spirit_tide', note: 'Forty paces of live ice where the qi comes out as the ice goes. Everybody calls it the Giving and nobody says what it is giving, or for how much longer.' },
        { name: PLACE.UNDERHANG, kind: 'site', ambient: 'thin', note: 'The ground beneath the floating stone: permanently in shadow, permanently in weather, and where the tether is inspected once a year by people who cannot repair it.' },
        { name: PLACE.UNDERSNOW, kind: 'village', ambient: 'thin', note: 'The last band anybody still lives at, four retreats below the face, and emptying at about nine households a decade.' },
        { name: PLACE.FOURHANDS, kind: 'waystation', ambient: 'thin', note: 'The station at the head of the pass, named for the four men who kept it the winter it was cut. Three of them are in the wall and there were five.' },
        {
            name: PLACE.ORCHID_COURT,
            kind: 'sect_town',
            ambient: 'normal',
            note: 'Terraces cut into rock nine retreats below the face, and the Orchid Court on them, holding the one band in the province that has stopped moving.',
            // The place road this file could not state before
            // `RegionPlaceConnectionSchema` landed. It is a day down and the
            // Court walks it twice a day in the setting weeks, which is a fact
            // about a house and its ground that a prefecture list cannot
            // carry: `places[]` says two names are in one catchment without
            // saying either is near the other, and the North has no
            // prefectures at all.
            //
            // Declared on this end only. Read both ways - see the schema.
            connections: [
                {
                    kind: 'path',
                    otherPlaceName: PLACE.ORCHID_VALLEY,
                    description:
                        'A cut stair down the shaded side to the valley floor, kept clear by the people who use it and by nobody else. It is a day down and a day back because of what the fog does to footing, not because of the distance.',
                    travelDays: 1
                }
            ]
        },
        {
            name: PLACE.ORCHID_VALLEY,
            kind: 'site',
            // Dense, and it is the province's own argument rather than an
            // exception to it: the qi here came out of the ice and did not go
            // anywhere. Everything above the face is richer and everything
            // above the face is also moving uphill every year. This is not.
            ambient: 'dense',
            note: 'A north-facing valley below the working face that the melt fog settles into and never leaves, with frost on the floor every night of the year and the only ground in the province anything grows on.'
        }
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
};
