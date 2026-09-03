/**
 * The Blown Ground: a rich vein under loose cover that moves, in the wedge the
 * four arms leave between them, held by nobody because nothing here lasts long
 * enough to be granted.
 *
 * The sixth row on the map and the only one that is not a province. It carries
 * its own richer shape - `UngovernedGround`, with the shows, the Meet, the
 * finders and the leakage into each neighbour - and a lossy one-way projection
 * into `Region` so the engine can act on it at all. The argument for why it is
 * not a sixth province, and why it is nonetheless on the map, is in the two
 * banners below and none of it has been weakened.
 */

import { z } from 'zod';
import { AmbientQiSchema } from '../../../schema/cultivation.js';
import { MAX_ORDINAL } from '../../../engine/cultivation/realms.js';
import { PLACE, REGION_NAME } from '../place-names.js';
import {
    RegionCustomsSchema,
    RegionPlaceSchema,
    RegionRegisterSchema,
    type Region
} from './region-schema.js';
import { standardBandsWith } from './local-rank-names.js';
import {
    ADJACENT_REGION_ID,
    BLOWN_GROUND_ID,
    EAST_REGION_ID,
    HOME_REGION_ID,
    SOUTH_REGION_ID
} from './region-ids.js';

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
    /**
     * Always `interior`, and typed rather than assumed so that the map has a
     * position for a thing that is in none of the four arms. See
     * `BearingSchema`.
     */
    bearing: z.literal('interior'),
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

/**
 * IT IS NOW SOMEWHERE SOMEBODY CAN STAND, AND HERE IS WHAT THAT COST.
 *
 * This block used to open by saying the opposite, and the measurement it
 * recorded was correct: `THE_BLOWN_GROUND` was not in the list the catalog
 * loader reads, so `seedRegions` minted no location for it, none of its
 * `places` became a settlement, no road linked it, nobody stood on it, and
 * `ADMIN set_location location=The Blown Ground` came back *"is not a place.
 * The map has no entry for it under that name or anything close enough to be
 * sure of."* Nothing in `src/` read this object or any of its lookups. Eleven
 * days of sand, the shows, the Meet, the finders and the six parties working
 * it were a very good page of prose and nothing else - the defect `AGENTS.md`
 * calls *a module nothing calls*, at the scale of a province.
 *
 * {@link THE_BLOWN_GROUND_AS_REGION} is the fix, and the three steps it took
 * were the three the measurement predicted: a `Region` projection, edges on
 * the travel graph, and `politics: 'no_authority'` so `ground-holder.ts` can
 * answer *nobody holds this*.
 *
 * WHAT THE MEASUREMENT GOT WRONG, because it matters to the next reader. It
 * proposed "a projection into `REGIONS`" as though `REGIONS` were one thing.
 * It was two things wearing one name: the spine of five provinces that every
 * catalog invariant is written about, and the set of rows the map, the seeder
 * and the travel graph need. Those are now `SPINE_REGIONS` and `REGIONS`, and
 * that split is the whole of why this could be done without weakening any of the
 * five clauses the section comment above defends. Nothing about a province
 * became optional; "region" stopped meaning "province".
 *
 * STILL OPEN: the shows. A surfacing is dense ground with a life of a season
 * to nine years and `LocationRecord` has no expiry, so the six `places` below
 * are seeded as permanent ground and Long Open will still be open in four
 * hundred years. `OpportunityWindow` in `opportunities.ts` and `AreaStatus` in
 * `what-is-true-of-a-place-right-now.ts` are the nearest machinery and which
 * of them owns a patch of ground that closes is a design question rather than
 * a port. It is the province's actual subject and it is not answered here.
 */
export const THE_BLOWN_GROUND: UngovernedGround = {
    id: BLOWN_GROUND_ID,
    name: REGION_NAME.BLOWN_GROUND,
    bearing: 'interior',
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
        },
        {
            who: 'The Sink Carriers',
            factionId: 'sect-sink-carriers',
            holds: 'nothing',
            doesHere:
                'Runs water out from the Sink to whatever shows are open, in strings of forty to sixty skins, and takes a share of what comes off the ground it watered rather than a price at the well. It holds neither the water nor the show and could not hold either: the Sink is the one thing on this ground nobody has ever fought over and a show is gone inside nine years, so what the Carriers actually own is a route that has to be rewalked every season and a reputation for arriving.',
            whyHere:
                'It is the only ground in the world where carrying water is a trade rather than a chore, because it is the only ground with rich air on it and no well within four days of the air. Everywhere else the two things are in the same place.'
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
        { name: PLACE.THE_MEET, kind: 'market_town', ambient: 'thin', note: 'The one market, which assembles for about six weeks after the wind turns and disperses. Everything sold here is sold once and nothing bought here comes with a name attached.' },
        { name: PLACE.THE_SINK, kind: 'site', ambient: 'thin', note: 'Water under the sand, dug for and shared because there is no second one within four days. The only fixed point in the whole wedge and the only thing here nobody has ever fought over.' },
        { name: PLACE.LONG_OPEN, kind: 'site', ambient: 'spirit_tide', note: 'A show that has been open nineteen years, which is longer than a grant runs, and is consequently the only ground here anybody has killed over more than once.' },
        { name: PLACE.THE_FORTNIGHT, kind: 'site', ambient: 'thin', note: 'The direct line, named for the saving it promises against the gorge road. It saves eight days when it works and nobody has published how often it works.' },
        { name: PLACE.TUOS_WALL, kind: 'site', ambient: 'thin', note: 'Where a house tried to stand still. About two hundred paces of it are above the sand and the rest is not, and nobody now living can name what it was called.' },
        { name: PLACE.MIDWAY, kind: 'waystation', ambient: 'thin', note: 'The gate station, which is not midway and is about a third of the way, and which everybody provisions against as though it were half.' }
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
            cost: 'It is why the eastern passage has a stretch in the middle with no landfall in it, why that stretch is called The Bitter Crossing, and why the water ration on every hull in the province is counted aloud at the same hour every day. A coast is normally a place a hull can put in. Twenty-one days of this one is not, and the whole arithmetic of the busiest water in the South is set by ground nobody has ever governed.'
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

/**
 * The Blown Ground as a `Region`, so the map can hold it.
 *
 * THE THREE FIELDS THAT ARE NOT A COPY, because each is a decision:
 *
 * `traditionId` is the one place the projection has to say something the
 * ground does not believe. Both traditions cross it and neither is seated on
 * it, and the schema has no third value. `tradition-drawn` is taken for the
 * same reason the Drowned Reach takes it - everybody here brought their
 * vocabulary from somewhere else, and most of them were refused at a Drawn
 * gate - but it is a default rather than a fact about the ground, and nothing
 * here should be read as the Drawn Road holding anything.
 *
 * `factionIds` is empty and must stay empty. Nine parties work this ground and
 * every one of them is seated in a province; putting any of them here would
 * seat a house twice and would say the thing the whole object exists to deny.
 * They arrive instead as `branches` - a presence that is not a seat, which is
 * exactly what `RegionBranch` already means everywhere else in this file.
 *
 * `connections` is TWO, not four, and the catalog is what says so. The ground
 * borders four provinces and carries one road: the direct line the world does
 * not use, from the Marches to the Wide Field. The other two borders are
 * described in `whatItCostsTheNeighbours` as borders WITHOUT a road - the Low
 * Fall's row says the ground "sits behind the province rather than beside it",
 * and giving the centre an edge onto it would make the wedge a spoke, which
 * the section comment above names as the failure ("a spoke is not a vacuum, it
 * is a suburb"). The South's row is twenty-one days of coast with no landfall
 * on it, which is the opposite of a link. Two edges, from a catalog that
 * prices one road.
 */
function ungovernedGroundAsRegion(ground: UngovernedGround): Region {
    const route = ground.theRouteNobodyTakes;
    // THE HALVES OF THE ONE ROAD THE CATALOG PRICES.
    //
    // `directDays` is the whole line and the catalog states no figure for
    // either half, so the only derivation that keeps the world's arithmetic
    // true is one that sums back to it: nine days across, against seventeen
    // through the gorge, which is the eight days `theRouteNobodyTakes` and
    // `whyNobodyFixesIt.theInterestedReason` both turn on. A pair of invented
    // numbers that summed to ten would quietly delete the shortcut.
    const nearLeg = Math.floor(route.directDays / 2);
    const farLeg = route.directDays - nearLeg;

    return {
        id: ground.id,
        name: ground.name,
        role: 'adjacent',
        bearing: ground.bearing,
        traditionId: 'tradition-drawn',
        summary: ground.summary,
        governingFact: ground.governingFact,
        derivations: ground.derivations.slice(),
        register: ground.register,
        customs: ground.customs,
        cultivation: {
            method:
                'None of its own. A cultivator here sits on a surfacing and draws, which is the ordinary method on ground nobody has taught anybody anything about, and it is the whole of the road: there is no local technique, no school and nobody to learn one from.',
            ambientRateMultiplier: ground.ambientRateMultiplier,
            // No local method, so there is nothing for a method multiplier to
            // multiply and it is the ordinary rate. Not a bonus withheld - an
            // absence, and the same absence `method` above states in words.
            methodRateMultiplier: ground.ambientRateMultiplier,
            deviationRiskModifier: 0,
            harderBoundaries: [],
            missingDisciplines: [
                {
                    discipline: 'alchemy',
                    reason: 'A furnace is a fixed installation and nothing here is fixed. Every institution that has ever operated on this ground is a camp, and a camp that stops moving is buried or robbed, so what the sand produces leaves it raw and is refined four days away in Kettle by somebody else.'
                },
                {
                    discipline: 'formations',
                    reason: 'A formation is anchored to ground and the ground walks about a li a year. Tuo\'s Wall is what the province has instead of an argument about this: two hundred paces of it are above the sand, the rest is not, and nobody now living can name what it was called.'
                }
            ],
            strongDisciplines: [
                'reading ground, which is the one trade native to the sand and cannot be learned anywhere else',
                'sitting on dense ground with nobody\'s permission, which every solitary in the world got here or did not get at all'
            ],
            costNote:
                'Nothing, and that is the point: no grant, no tenancy, no tribute and nobody to be polite to. What it costs instead is water, four days of it between the Sink and anything else, and the ordinary cause of death here is a sum somebody did before setting out.',
            localRankNames: standardBandsWith(
                ground.howRankIsSpoken,
                'Nobody here confers a band and nobody checks one. The words are the world\'s ordinary words for a person with no house, so they tile the shared ladder trivially and mean nothing more than that somebody has been asked whose they are and had no answer.'
            )
        },
        ambientProfile: { ...ground.ambientProfile },
        localCeilingOrdinal: ground.ceilingOrdinal,
        ceilingNote: ground.ceilingNote,
        veinStatus: ground.veinStatus,
        // STEP THREE, AND THE ONLY MECHANICAL CONSEQUENCE THAT ALREADY EXISTS.
        // `seedRegions` copies this onto the location record and
        // `ground-holder.ts` reads it to answer "nobody holds this", which is
        // the floor of the trust term in `ground-trust.ts` - and that term
        // already puts unheld ground BELOW a demonic house, for the reason
        // `whatItMakesTrue` gives.
        politics: 'no_authority',
        politicsNote: ground.whyItCannotBeHeld,
        factionIds: [],
        branches: ground.whoIsOnIt
            .filter((p): p is typeof p & { factionId: string } => p.factionId !== null)
            .map(p => ({
                parentSectId: p.factionId,
                localName: p.who,
                doesHere: p.doesHere
            })),
        places: ground.places.map(p => ({ ...p })),
        exports: [
            'what comes out of a surfacing before it closes, sold once, at the finder\'s price, with no provenance that would survive being written down',
            'intact dead, which the cover keeps and gives back a decade later with their possessions still on them',
            'locations, which is the only thing a finder actually sells and the only export in the world that stops existing when it is used'
        ],
        imports: [
            'water, in strings of forty to sixty skins, which is the binding constraint on everything anybody does here',
            'food, since nothing grows on sand and nothing grows at all on a show',
            'people, refused at a gate somewhere else, which is the whole of the population and everybody knows it about everybody'
        ],
        // Dearer than any land province and cheaper than the water. Everything
        // is carried across four days with no well on them to a market that
        // assembles for six weeks; a passage south is still provisioned in
        // months, which is why the sea keeps the top of the scale.
        priceMultiplier: 1.9,
        hazards: ground.hazards.slice(),
        connections: [
            {
                kind: 'unsettled_border',
                otherRegionId: route.fromRegionId,
                description:
                    'The stakes stop. The Sixmile Wardens repaint nine hundred a year and the last of them is about a day short of the sand, and the Wardens will tell a visitor once, free, that they stop there for a reason.',
                travelDays: nearLeg
            },
            {
                kind: 'refugee_flow',
                otherRegionId: route.toRegionId,
                description:
                    'The direct line, walked in both directions by people rather than by carts: the refused going west out of nine admission days, and the Crimson Abyss Hall\'s recruiters coming the other way with a cash box and the first month paid in advance.',
                travelDays: farLeg
            }
        ],
        trueHereFalseThere: ground.trueHereFalseThere.slice(),
        crossingNotes: ground.crossingNotes.slice()
    };
}

/** The Blown Ground, in the shape the engine can act on. */
export const THE_BLOWN_GROUND_AS_REGION: Region = ungovernedGroundAsRegion(THE_BLOWN_GROUND);
