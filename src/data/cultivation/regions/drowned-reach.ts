/**
 * The Drowned Sea: open water, no ground under it, so no vein under it, so
 * nothing in the air. Nobody holds it and nobody can.
 *
 * The lowest ceiling and the lowest rate in the world against the highest
 * price multiplier. Nothing here is a maritime subsystem - the note above the
 * row below says what this province is and is not, and it was written to stop
 * one being added.
 */

import { PLACE, REGION_NAME } from '../place-names.js';
import type { LocalRankBand, Region } from './region-schema.js';
import { standardBandsWith } from './local-rank-names.js';
import { EAST_REGION_ID, HOME_REGION_ID, NORTH_REGION_ID, SOUTH_REGION_ID } from './region-ids.js';

const REACH_BANDS: LocalRankBand[] = standardBandsWith(
    'Everybody on this water learned their words somewhere else and brought them aboard, so the Drowned Sea has no vocabulary of its own and never developed one. There are no locals here to have invented anything.',
    'A hull carrying four provinces\' worth of titles settles a disagreement about rank the way a hull settles everything, which is by finding out what each of them can actually do before the weather does it for them.'
);

// ── SOUTH: THE WATER ─────────────────────────────────────────────────
// This is not a fifth landmass. Every fact below follows from one sentence
// in `docs/world/climbing/qi.md` - qi pools in veins, and veins are features of the
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
export const THE_DROWNED_REACH: Region = {
    id: SOUTH_REGION_ID,
    name: REGION_NAME.DROWNED_SEA,
    role: 'adjacent',
    bearing: 'south',
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
        death: 'Over the side, weighted, with the name said once and not written down. The Drowned Sea is the only province in the world that keeps no record of its dead, and all four of the others regard this as barbarism and say so.',
        taboo: 'Never count the stone chest aloud. What is in it is what everybody aboard is standing on, and saying the figure where it can be heard is the moment a crew stops being a crew and becomes a number of people with an interest.',
        threatModel: 'The weather and the arithmetic, in that order and usually together. Most people who die in the South die because a passage took eleven days longer than it was provisioned for, which is not misfortune, it is a sum somebody did wrong ashore.',
        naming: 'Hulls and landfalls instead of clans: Bell of the Third Landfall, Ma out of Iron Gate, Sweet Spring Island Xu. A person at sea is named for where they came aboard, and nobody asks past that.',
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
            'the Cut method, which is the only method that works out here and which nobody in the Drowned Sea was ever taught'
        ],
        costNote:
            'Advancement costs stones and costs nothing else, because nothing else is for sale. A day at sea is a fixed burn against a fixed chest, which makes this the only province where a cultivator\'s progress can be worked out exactly, in advance, on a counting board, by somebody who has never met them.',
        localRankNames: REACH_BANDS
    },
    ambientProfile: { thin: 96, normal: 3, dense: 1 },
    localCeilingOrdinal: 2,
    ceilingNote:
        'Three layers on the islands and nothing at all on open water, which makes it the lowest ceiling in the world by a distance. Nobody born in the Drowned Sea has passed Qi Condensation Layer 3 without leaving or without a chest somebody else paid for, and the reason is not that the ceiling is low: it is that there is no ground underneath it.',
    veinStatus:
        'There are veins under the Drowned Sea and every one of them is a hundred fathoms down. What put them there is not recorded anywhere anybody has read; what is recorded is the shape, which is a mountain range with its peaks above water, so every island in the province is a vein head with the whole of its vein out of reach beneath it.',
    politics: 'no_authority',
    politicsNote:
        'Nothing at all: no grant book, no bench, no court, no survey, no apex and no province in the administrative sense, because nothing here can be held and therefore nothing here can be given. Four straits are claimed by parties ashore and all four claims are sentences in documents. Three institutions operate on this water and none of them holds a strait - one because its whole doctrine is leaving, one because it never had anywhere to be, and one because it holds forty acres of island instead and would be worth nothing if it held any more. That is not a gap in the province, it is the only kind of institution the province can support, and the third of them is the interesting case: the Silver Island Rail is unbacked not because nobody could take it but because everybody would lose by it, which is the only security arrangement in the world that nobody signed and nobody can withdraw from unilaterally.',
    factionIds: [
        'house-measured-span',
        'sect-hollow-bell-wanderers',
        'sect-halfwater-rail'
    ],
    branches: [
        {
            parentSectId: 'sect-clear-river-alliance',
            localName: 'The Mouth Ferries',
            doesHere:
                'Takes a hull from the river mouth as far as Sweet Spring Island and refuses to go one landfall further, on the stated principle that a ferryman who cannot see both banks is a passenger. It is the only regular service between the land and the water and it has never lost a hull, which is the same fact twice.'
        },
        {
            parentSectId: 'sect-thousand-treasure-pavilion',
            localName: 'The Sweet Spring Island Floor',
            doesHere:
                'One auction floor on one island, sitting three weeks from the nearest city, buying what comes off drowned ground and asking nothing about which island it came off. Its appraisers are the only people in the world who can date something that has been underwater and they will not say how.'
        }
    ],
    places: [
        { name: PLACE.SWEETSPRING_ISLE, kind: 'market_town', ambient: 'thin', note: 'The only island on the eastern passage with fresh water on it, which is the entire reason there is a town there and the entire reason four parties claim it.' },
        { name: PLACE.BRONZE_BELL_CAPE, kind: 'waystation', ambient: 'thin', note: 'A headland with a bell on it. A hull that rings it has come through, and a hull that does not is counted, and the counting is the only record anybody keeps out here.' },
        { name: PLACE.DRAGONVEIN_ROCK, kind: 'site', ambient: 'dense', note: 'One rock stands on a vein head that breaks the surface at low water. It is the best ground in the province, it is about forty paces across, and everybody waters at it.' },
        { name: PLACE.THE_BITTER_CROSSING, kind: 'site', ambient: 'thin', note: 'The stretch of the eastern passage with no landfall in it. Hulls carry their own water across and the ration is what the name is about; nobody finds it clever after the fourth day.' },
        { name: PLACE.THE_FAR_SHORE, kind: 'waystation', ambient: 'thin', note: 'A gate station on a shore three weeks\' sail out and one hour from the Jade Gorge, when it opens, which is four days in nine and never in a storm.' },
        // ── the middle of the water, which was a gap in the map ────────
        //
        // The province was written as coasts and the water between them
        // was nothing: Sweet Spring Island and Bronze Bell Cliff and The Far Shore are all edges,
        // and The Bitter Crossing - the one entry that is actually open sea - is named
        // for the absence of anything. So the busiest water in the world
        // had no place on it a narrator could put a scene, and a crossing
        // was a number of days between two landfalls with a blank in the
        // middle. These four are that blank, and every one of them is
        // somewhere a hull is rather than somewhere a hull calls.
        { name: PLACE.SILVER_ISLE, kind: 'city', ambient: 'thin', note: 'An island at the middle of the eastern passage with a deep anchorage, no vein and no patron, where every party in the world buys and sells because none of them owns it. The largest market outside the nine cities and the only one an apex has never had a seat at.' },
        { name: PLACE.THE_WAITING_SAILS, kind: 'site', ambient: 'thin', note: 'The anchorage off Silver Island, where forty hulls lie waiting on wind, water or a price, close enough to hear each other\'s bells. A quarter of the port\'s business is done between hulls without anybody going ashore.' },
        { name: PLACE.THE_BOUNDLESS, kind: 'site', ambient: 'thin', note: 'Eleven days of the northern crossing with no landfall, no bottom a line will reach and nothing on the horizon in any direction. What everybody at sea means when they say they were out.' },
        { name: PLACE.THE_SALT_FIELDS, kind: 'site', ambient: 'thin', note: 'Shoal water on the western capes where the salt is raked off drying flats a hull can stand into, and where four claims overlap and none of them has ever been enforced for a season.' }
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
                'Nine days down the river and out to Sweet Spring Island, which is where the Jade Gorge\'s river stops being a river. Salt and drowned goods up, pills and grain down, and the Alliance turns round at the first landfall every time.',
            travelDays: 9
        },
        {
            kind: 'sea_crossing',
            otherRegionId: EAST_REGION_ID,
            description:
                'Twenty-one days from Sweet Spring Island to the eastern shore, three seasons in four, across a stretch with no landfall in the middle of it. It is the busiest water in the province and every hull on it is a sum that has to come out right.',
            travelDays: 21
        },
        {
            kind: 'sea_crossing',
            otherRegionId: NORTH_REGION_ID,
            description:
                'Thirty-four days round the western capes to a northern inlet, open two months a year, and the only route between two provinces that does not pass through the Jade Gorge. About one hull in five does not arrive and the trade continues, which says exactly what the alternative is worth.',
            travelDays: 34
        },
        {
            kind: 'refugee_flow',
            otherRegionId: HOME_REGION_ID,
            description:
                'People who have run out of provinces. Nobody is born onto this water in any number, so the Drowned Sea is populated almost entirely by arrivals, and a hull will take anybody who can pay the burn and asks nothing whatever about why.',
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
};
