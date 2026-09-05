/**
 * What each house makes, and what crosses the water because it makes it.
 *
 * Two subjects that are actually one, which is why they are in one file: a
 * trade route with nothing on it is a line on a map, and a workshop that
 * ships nowhere is scenery. The file is named for both because naming it for
 * either would hide the half a reader is looking for.
 *
 * ARTISANS ARE NOT A NEW INSTITUTION
 * ----------------------------------
 * Every faction in the catalog has people who make things. That is not a
 * system and it must not become one: it is an ordinary and unremarkable fact
 * about what a body IS, and stating it is the point rather than modelling it.
 * A sect that holds a furnace has smiths in the same sense that it has cooks,
 * and nobody in the world finds either remarkable.
 *
 * It matters here for one reason. A trade layer needs a SOURCE. Merchants who
 * conjure stock out of nowhere would be exactly the parallel-system mistake
 * AGENTS.md warns about - goods move between houses because houses make them,
 * and a trader is somebody who carries what one house made to somewhere it is
 * wanted. Take the workshops away and the cargo has no origin, so the cargo
 * would have to be invented, and an invented cargo is a second economy beside
 * the market.
 *
 * THE DERIVATION IS THE DESIGN, AND IT IS WHY THIS TABLE IS SHORT
 * ---------------------------------------------------------------
 * A house's craft follows from what the house already is - its holdings, its
 * exports, its trade. Most of it is already written: `regions.ts` carries an
 * `exports` list per province and the faction catalog says what every body
 * does. So `artisansOf` FALLS BACK to the province's exports for any house
 * without a row here, and the fallback is not a shortcut - it is the
 * derivation, made executable. A Wide Field house with no row makes what the
 * Wide Field exports, because that is what there is to make on that ground
 * with those materials.
 *
 * Rows exist only where the craft is SPECIFIC enough that the province's list
 * would get it wrong, and every row says what the house cannot make as well as
 * what it can - because the second half is what creates a trade. A body that
 * makes everything imports nothing and ships nothing.
 *
 * WHAT THIS DELIBERATELY IS NOT
 * -----------------------------
 * There is no production simulation here: no recipes, no throughput, no
 * inputs consumed, no crafting verbs. `recipes.ts` and `pills.ts` already
 * carry refinement, `artifacts.ts` carries the objects, and the market carries
 * the prices. This file says WHO MAKES WHAT and lets those three do the rest.
 * If a later change starts wanting a quantity per season, that is the moment
 * to stop and ask whether a second economy is being built.
 *
 * ONE CONNECTION WORTH RECORDING. Nothing in the engine currently reproduces a
 * house's ARTS: `newlyEntitled` hands out cultivation roads only, so a house
 * the world founds for itself has no arts and never will. Artisans are the
 * obvious shape of an answer to that - a house that makes a thing is a house
 * that could teach making it - but the answer would live in the world engine
 * rather than here, and it is recorded in `THE_ARTS_A_NEW_HOUSE_HAS` below
 * rather than taken on.
 */

import { z } from 'zod';
import { REGIONS, getRegionForFaction, SOUTH_REGION_ID } from './regions.js';
import { PLACE } from './place-names.js';
import type { SeaLane } from '../../engine/world/what-a-sea-crossing-costs.js';

// ─────────────────────────────────────────────────────────────────────────
// ARTISANS
// ─────────────────────────────────────────────────────────────────────────

export const HouseArtisansSchema = z.object({
    factionId: z.string(),
    /** The trade, in the words the house itself uses for it. */
    craft: z.string().min(30),
    /** Who these people actually are inside the house, and what they are not. */
    whoTheyAre: z.string().min(60),
    /** What comes out, in things somebody could buy. */
    makes: z.array(z.string().min(15)).min(2),
    /**
     * What it cannot make, which is what creates the trade. A house that makes
     * everything ships nothing and buys nothing.
     */
    cannotMake: z.string().min(60),
    /** Whether any of it leaves the house, and on what terms. */
    soldOutside: z.string().min(60)
});
export type HouseArtisans = z.infer<typeof HouseArtisansSchema>;

/**
 * Rows only where the province's export list would be wrong about the house.
 * Everybody else is covered by `artisansOf`, which reads the ground.
 */
export const HOUSE_ARTISANS: readonly HouseArtisans[] = [
    {
        factionId: 'sect-ashen-forge-clan',
        craft: 'Reforging. The clan does not smelt - it takes broken metal with a history in it and makes it into something that works.',
        whoTheyAre: 'Two thirds of the clan roll, and the ranks are forge ranks rather than cultivation ranks, so a smith who never passes Foundation still rises. It is the only house in the catalog where the makers outnumber the fighters and nobody regards that as a decline.',
        makes: [
            'reforged blades from ploughed-up fragments, at a quarter the price of new work and with the fragment\'s provenance attached',
            'furnace tools nobody else in the province can cut, which is why four sects send their own smiths here to be taught',
            'the mortal steel sword in the price table, which is Ashen Forge work wherever it is sold'
        ],
        cannotMake: 'Anything that needs a formation to hold its shape while it sets, because the clan has never held a working diagram and has no formationist. Every artifact above the grade where a binding array is required leaves the compound unfinished and is finished elsewhere, which the clan resents and has never solved.',
        soldOutside: 'Openly, over a counter, at a published price, and the clan has delivered eleven blades to the Azure Cloud Pavilion at cost in four years without an order and without acknowledgement.'
    },
    {
        factionId: 'sect-cinnabar-crucible-guild',
        craft: 'Refining. Four furnaces, a fixed price list, and the only alchemy anybody in two provinces can buy over a counter.',
        whoTheyAre: 'The guild IS its artisans - there is no distinction here between a member and a maker, and a Guild rank is a furnace rank. Its cold branch at Rimefall is four furnaces and a price list and nothing else.',
        makes: [
            'the healing, gathering and clear-meridian pills that the whole price table is anchored against',
            'crossing pills bought by every house in the province for its own people, at a price nobody negotiates',
            'furnace time, sold by the day to anybody who brings their own formula and their own materials'
        ],
        cannotMake: 'Anything at all in the Quiet Marches, and this is the single largest fact about the world\'s pill trade. A refinement needs ambient qi to hold its shape while it sets, and in the Marches it does not set - so every pill in that province is imported eleven days by cart, and the Guild has tried and abandoned a western furnace three times.',
        soldOutside: 'To everybody, at the list price, without exception and without discount, which is the Guild\'s entire reputation and the reason its list is quoted in provinces it has never operated in.'
    },
    {
        factionId: 'sect-verdant-spring-hall',
        craft: 'Growing and preparing. Nine warm springs, terraced beds, and physicians who prepare what they pick.',
        whoTheyAre: 'Gardeners and physicians, and the Hall does not rank them below its cultivators - it lives on its physicians, which is stated in its own territory line and is the reason a hall on ground with no vein worth the name is still standing.',
        makes: [
            'prepared herbs by the catty, graded and dated, which is the input half of most of the Guild\'s list',
            'mortal medicine that works on mortals, sold at prices a village can raise',
            'the only cultivated stock of four herbs that everybody else has to find'
        ],
        cannotMake: 'Scar-ground herbs, which will not fruit on healthy land at any price and are the one thing the Hall has to buy from the Marches and the Wide Field. Nine warm springs cannot reproduce ground that something died on.',
        soldOutside: 'Freely, and the Hall prices mortal medicine below cost on purpose, which two of its own elders have argued about for thirty years without either of them winning.'
    },
    {
        factionId: 'sect-stonewright-consortium',
        craft: 'Assay and cutting. Refining houses at the head of nine veins, and the standard everybody else\'s stones are cut to.',
        whoTheyAre: 'Assayers and cutters, and the Consortium is the rare house where the artisans set the policy: the rate is a technical judgement before it is a commercial one, and the cutters are the people who make it.',
        makes: [
            'assayed spirit stones cut to the Stonewright standard, which is the currency everything else in this file is priced in',
            'the published rate itself, which is the only export in the world that arrives before the goods do',
            'the insurance table that reads a Marches title one rank low, which is a product and gets people killed'
        ],
        cannotMake: 'Its own stones. The Consortium holds no vein and cuts what other people dig, so it is the wealthiest body in two provinces and owns none of the material it is wealthy from.',
        soldOutside: 'It sells nothing else. Every stone it touches belongs to somebody when it arrives and to somebody when it leaves, and the Consortium takes the cut and the rate.'
    },
    {
        factionId: 'sect-gleaners-company',
        craft: 'Not making - recovering. The Company is the one body here whose product was made by somebody who is dead.',
        whoTheyAre: 'Diggers and sorters. The barrow yard at Hollowmarket is a sorting floor rather than a workshop and the distinction is the whole of the Marches: a province that cuts its qi out of stone does not have artisans in the ordinary sense, it has extractors.',
        makes: [
            'sorted sealed-site salvage, priced at Hollowmarket before it goes to Kettle',
            'scar-ground herbs that only fruit on dead ground, which are the Low Fall\'s single largest import from the west',
            'nothing that did not already exist, which is stated plainly in the Company\'s own manifest rule'
        ],
        cannotMake: 'Anything whatsoever. There is no forge, no furnace and no bed in the Marches that works, because alchemy will not set and the ambient will not hold a refinement - so the region\'s entire economy is moving other people\'s finished goods and other ages\' leavings.',
        soldOutside: 'By weight, on a published manifest rule, to the Kettle Assay House and to its own factor at Scarwater, and to the Thousand Treasure Pavilion when the Pavilion sends a buyer.'
    },
    {
        factionId: 'sect-halfwater-rail',
        craft: 'Making nothing, and that is the whole of the port. What the Rail produces is the transaction.',
        whoTheyAre: 'Coopers, ropewalkers, a cistern crew and eleven caulkers, and every one of them is maintenance rather than manufacture. The port makes barrels, cordage and repairs because a hull that cannot be repaired at Halfwater is a hull that stops coming.',
        makes: [
            'water casks and sealed stone jars, which are the binding constraint on every passage in the province',
            'cordage, canvas and hull repair, sold at the same fortieth as everything else',
            'the transaction itself: a counter a weak seller can walk up to without being robbed, which is the actual product'
        ],
        cannotMake: 'Every single thing it trades. There is no vein under the port, no forge worth the name, no bed and no furnace, so a market that turns over more than the nine cities between them manufactures nothing but barrels. Everything on the quay was made somewhere with ground under it.',
        soldOutside: 'The repairs are sold on the quay. The transaction is sold everywhere, and the margin on it is the port\'s entire income - the tax is a fortieth and the spread is where the money is.'
    },
    {
        factionId: 'sect-sink-carriers',
        craft: 'Carrying, and the only thing the shed makes is skins to carry in.',
        whoTheyAre: 'Sewers and pitchers, mostly people too broken to walk a string any more, working under the shed roof beside the tally boards. It is the one job at the Carriers that a person can hold after the sand has finished with them, and everybody there knows what being moved to it means.',
        makes: [
            'water skins, pitched and stitched, forty to sixty of which are a string',
            'nothing else at all, because a body that has to rewalk its own route every season cannot carry a workshop'
        ],
        cannotMake: 'Anything that needs a fixed place to make it in. That is the Blown Ground\'s governing fact applied to a trade: a workshop is a fixed point, a fixed point is under nine feet of sand within a decade, and the shed itself has been rebuilt four times around a stack of boards.',
        soldOutside: 'Nothing is sold. The skins go out full and come back empty and are restitched, and a carrier who loses one pays for it out of their share.'
    }
];

const ARTISANS_BY_FACTION: ReadonlyMap<string, HouseArtisans> =
    new Map(HOUSE_ARTISANS.map(a => [a.factionId, a]));

/**
 * What a house makes. A written row where the craft is specific, and the
 * province's own export list where it is not.
 *
 * The fallback is the whole design. Every faction has artisans, and for most
 * of them what they make is simply what there is to make on the ground they
 * stand on with the materials that ground yields - which `regions.ts` already
 * states, per province, and has stated since the map was written.
 */
export function artisansOf(factionId: string): {
    factionId: string;
    craft: string;
    makes: readonly string[];
    /** True where this is the province's list rather than a written row. */
    derivedFromProvince: boolean;
} | undefined {
    const written = ARTISANS_BY_FACTION.get(factionId);
    if (written) {
        return {
            factionId,
            craft: written.craft,
            makes: written.makes,
            derivedFromProvince: false
        };
    }
    const region = getRegionForFaction(factionId);
    if (!region) return undefined;
    return {
        factionId,
        craft: `Whatever ${region.name} makes. The house has workshops the way it has kitchens, and what comes out of them is the province's own list.`,
        makes: region.exports,
        derivedFromProvince: true
    };
}

/** Every house whose craft was specific enough to be written out. */
export function housesWithAWrittenCraft(): readonly string[] {
    return HOUSE_ARTISANS.map(a => a.factionId);
}

// ─────────────────────────────────────────────────────────────────────────
// THE LANES
//
// Named water, in the shape `what-a-sea-crossing-costs.ts` reads. The three
// `sea_crossing` connections in `regions.ts` say which coasts are joined and
// how many days it is; a lane says where the middle is, whether there is
// anywhere to stop in it, and what the weather does - which is what the
// arithmetic actually needs and what a road never has.
// ─────────────────────────────────────────────────────────────────────────

export const SEA_LANES: readonly SeaLane[] = [
    {
        id: 'lane-eastern-passage',
        fromPlace: PLACE.WATERING,
        toPlace: PLACE.NINEWATCH,
        expectedDays: 21,
        openMonthsPerYear: 9,
        // Halfwater at nine days is the reason this is the busiest water in the
        // world and the reason the port exists at all: it is the only lane with
        // a landfall inside the commit point, so it is the only long crossing
        // anybody can turn back from having already gone most of the way.
        intermediateLandfallDays: [9],
        weatherSeverity: 1
    },
    {
        id: 'lane-the-northern-capes',
        fromPlace: PLACE.SALT_REACH,
        toPlace: 'Rimefall inlet',
        expectedDays: 34,
        openMonthsPerYear: 2,
        // Nothing. Eleven days of it is The Long Middle, and about one hull in
        // five does not arrive - which the province knows and the trade
        // continues anyway, because the alternative is seventeen days over a
        // pass that is shut five months a year and a toll at the gorge.
        intermediateLandfallDays: [],
        weatherSeverity: 2.1
    },
    {
        id: 'lane-the-river-mouth',
        fromPlace: 'The river mouth below Low Fall',
        toPlace: PLACE.WATERING,
        expectedDays: 9,
        openMonthsPerYear: 12,
        // Coastal the whole way, which is why the Clear River Alliance will
        // work it and will not go one landfall further: their stated principle
        // is that a ferryman who cannot see both banks is a passenger.
        intermediateLandfallDays: [3, 6],
        weatherSeverity: 0.6
    }
];

export function getSeaLane(id: string): SeaLane | undefined {
    return SEA_LANES.find(l => l.id === id);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS ON THE HULLS
//
// A cargo row is a maker, a lane and a buyer, and it is not allowed to be
// anything else. Every good named here is made by a house named in
// `HOUSE_ARTISANS` or is on a province's export list, and every one of them
// is wanted where it is going for a reason already in the catalogs. Nothing
// in this table introduces a good the world did not already have.
// ─────────────────────────────────────────────────────────────────────────

export const CargoSchema = z.object({
    id: z.string(),
    what: z.string().min(15),
    /** The house whose artisans made it, or null for what the ground gives. */
    madeByFactionId: z.string().nullable(),
    laneId: z.string(),
    /** Which way along the lane. */
    direction: z.enum(['outbound', 'inbound']),
    /** Who carries it, and it is always somebody in the faction catalog. */
    carriedByFactionId: z.string(),
    /** Who wants it at the far end, and why they cannot get it nearer. */
    boughtBy: z.string().min(40),
    /** Why it goes by water when there is a road. */
    whyByWater: z.string().min(60)
});
export type Cargo = z.infer<typeof CargoSchema>;

export const SEA_CARGO: readonly Cargo[] = [
    {
        id: 'cargo-pills-south',
        what: 'Refined pills, in sealed stone jars, packed in salt against the damp',
        madeByFactionId: 'sect-cinnabar-crucible-guild',
        laneId: 'lane-the-river-mouth',
        direction: 'outbound',
        carriedByFactionId: 'sect-clear-river-alliance',
        boughtBy: 'Everybody at Halfwater, and the Guild does not send a factor - it sells at the list price at Low Fall and the port pays the carriage, which is why a pill costs more than twice as much on the quay as it does in the Guild hall.',
        whyByWater: 'There is no road. The Drowned Reach is water, so every grain of food and every pill in it arrived on a hull, and this is the only regular service between the land and the water at all.'
    },
    {
        id: 'cargo-salt-north',
        what: 'Salt, in quantity, raked off the drying flats at Salt Reach',
        madeByFactionId: null,
        laneId: 'lane-the-river-mouth',
        direction: 'inbound',
        carriedByFactionId: 'sect-clear-river-alliance',
        boughtBy: 'Nine cities that tax it at the gate, and every village between them that does not. It is the commonest smuggled good in the world and is punished as one.',
        whyByWater: 'It is made on the water. Four straits are claimed at all because of the salt and the claims are worth writing down for no other reason, and none of them has ever been enforced for a season.'
    },
    {
        id: 'cargo-assayed-stones-east',
        what: 'Assayed spirit stones, cut to the Stonewright standard and sealed under a factor\'s mark',
        madeByFactionId: 'sect-stonewright-consortium',
        laneId: 'lane-eastern-passage',
        direction: 'inbound',
        carriedByFactionId: 'sect-halfwater-rail',
        boughtBy: 'The port itself, and then everybody at it. Stones out here are not savings and not fuel - they are the ground, so the largest single buyer of stones in the world is a market with no vein under it.',
        whyByWater: 'The road east goes through the gorge and is taxed there. A hull out of Ninewatch reaches Halfwater in twelve days having paid nobody, which is the whole of why the port is on that lane and not on a coast.'
    },
    {
        id: 'cargo-ice-stones-south',
        what: 'Ice-cut stones, moved in winter or not at all, because they shatter if they are cut warm',
        madeByFactionId: 'sect-frostmirror-court',
        laneId: 'lane-the-northern-capes',
        direction: 'outbound',
        carriedByFactionId: 'sect-halfwater-rail',
        boughtBy: 'The Thousand Treasure Pavilion\'s floor at Watering and the Stonewright assay at Kettle, both of which pay a premium for stones that assay high and neither of which will insure the carriage.',
        whyByWater: 'The pass is shut five months a year and the five months it is shut are the five months the stones can be moved. This lane is open two months a year and both of them are inside that window, which is the only reason a route that loses one hull in five carries anything at all.'
    },
    {
        id: 'cargo-drowned-goods-east',
        what: 'What comes off drowned ground, with no provenance and no question asked about the island',
        madeByFactionId: null,
        laneId: 'lane-eastern-passage',
        direction: 'outbound',
        carriedByFactionId: 'sect-thousand-treasure-pavilion',
        boughtBy: 'The Watering Floor first and the eastern auction houses after, and the Pavilion\'s appraisers are the only people in the world who can date a thing that has been underwater and will not say how.',
        whyByWater: 'An island is the top of something people used to walk on, so the material only exists where the hulls are, and nothing about it can be got at from a road.'
    },
    {
        id: 'cargo-water-jars',
        what: 'Fresh water in sealed stone jars, and the casks and cordage that carry it',
        madeByFactionId: 'sect-halfwater-rail',
        laneId: 'lane-eastern-passage',
        direction: 'outbound',
        carriedByFactionId: 'sect-halfwater-rail',
        boughtBy: 'Every hull leaving the port, without exception, and it is the one thing on the quay the Rail sells at a margin nobody complains about, because a shipmaster arguing about the water price in front of a crew has already lost the crew.',
        whyByWater: 'It is the constraint rather than the cargo. Water is the actual binding limit on every passage in the province and the reason the map is a list of wells rather than a list of places.'
    }
];

export function cargoOnLane(laneId: string): Cargo[] {
    return SEA_CARGO.filter(c => c.laneId === laneId);
}

export function cargoMadeBy(factionId: string): Cargo[] {
    return SEA_CARGO.filter(c => c.madeByFactionId === factionId);
}

export function cargoCarriedBy(factionId: string): Cargo[] {
    return SEA_CARGO.filter(c => c.carriedByFactionId === factionId);
}

// ─────────────────────────────────────────────────────────────────────────
// WHO CARRIES IT
//
// Four bodies move goods across this water and no two of them are the same
// kind of operator. That is the content: "traders" as one undifferentiated
// noun would be a guild with a different name, and what makes a sea trade
// interesting is that the people on it disagree about what they are doing.
// ─────────────────────────────────────────────────────────────────────────

export const SEA_TRADERS: readonly {
    factionId: string;
    whatKindOfOperator: string;
    whereItWillNotGo: string;
    howItIsPaid: string;
}[] = [
    {
        factionId: 'sect-clear-river-alliance',
        whatKindOfOperator: 'A river body that goes to sea reluctantly and only as far as the first landfall. It is the only regular service between the land and the water, and it has never lost a hull, which is the same fact twice.',
        whereItWillNotGo: 'One landfall past Watering, on the stated principle that a ferryman who cannot see both banks is a passenger. The Alliance has been offered the eastern passage four times.',
        howItIsPaid: 'In crossings owed rather than in cash, wherever it can arrange it, which is how it prices a ford and is the only pricing the Alliance has ever used.'
    },
    {
        factionId: 'sect-halfwater-rail',
        whatKindOfOperator: 'A port rather than a carrier, and it works both lanes it touches only because nobody else will. What it actually sells is the counter, and the hulls are what keeps the counter stocked.',
        whereItWillNotGo: 'Anywhere that would make it a second port. A network is a party and a party has enemies, and the Rail Master has put that to the Factors twice in those words.',
        howItIsPaid: 'A fortieth on what crosses the rail, and the spread on what it buys from people who have no other buyer. The second is much the larger and is the reason the first can stay a fortieth.'
    },
    {
        factionId: 'sect-thousand-treasure-pavilion',
        whatKindOfOperator: 'A buyer with hulls rather than a carrier with goods. It ships only what it has bought, only to its own floors, and it will not take a consignment for anybody.',
        whereItWillNotGo: 'It does not carry for hire at all, at any price, and the refusal is old enough that nobody asks. Its hulls are inventory movement and are treated as an overhead.',
        howItIsPaid: 'On the hammer, at its own floors, and the carriage never appears as a line - which means nobody outside the Pavilion knows what the eastern passage actually costs it.'
    },
    {
        factionId: 'house-measured-span',
        whatKindOfOperator: 'Not a carrier and the reason the others survive. Nine gate stations, no two within a month\'s walk and all of them an hour apart, including Farside on a shore three weeks\' sail out.',
        whereItWillNotGo: 'It carries goods for nobody. The Span moves people and letters through a door on its own cycle, four days in nine and never in a storm, and a consignment has never once gone through one.',
        howItIsPaid: 'A gate fee, in stones, priced by true rather than walked distance, which nobody outside the Span can verify and everybody pays.'
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE PORT'S TERMS
//
// A free port lives on terms rather than on force, so the terms are the
// institution and belong in the catalog where a caller can read them. Every
// number here is ordinary: a rate, a wage, a margin. Nothing about the port
// is a rule that applies only to the port.
// ─────────────────────────────────────────────────────────────────────────

export const HALFWATER_TERMS = {
    portFactionId: 'sect-halfwater-rail',
    regionId: SOUTH_REGION_ID,

    theRate:
        'A fortieth of what crosses the rail, published, unchanged in ninety years, and refused upward four times in writing. It is light on purpose and not out of generosity: the traffic is where the profit is, and a port that squeezes the traffic moves it somewhere else and is then holding forty acres of rock.',

    whereTheMoneyActuallyIs:
        'The spread. The Rail buys from people who have no other buyer and sells on at what the thing is worth, and that margin is several times the rate. A weak cultivator holding something valuable cannot sell it to an individual, because the individual can simply take it and nobody is coming for them - so the port is not competing on price, it is the only counterparty in the world that a person in that position can safely approach.',

    discretionIsPriced:
        'A seller who wants no name attached takes less for the lot and knows they are taking less. It is a service with a margin on it rather than a courtesy, and it is exactly what somebody holding a thing they should not be holding will pay for. The port does not pretend this is kindness and nobody at the quay has ever thought it was.',

    theLineItDraws:
        'Buying quietly is the service. Buying from somebody an apex is actively hunting is a different proposition, because the hunt arrives at the port and the port has nothing to meet it with - so the Rail refuses those lots, refuses them in front of whoever is standing there, and has the refusal copied to the seller\'s face. It has cost the port four large lots in ninety years and is the reason the arrangement that protects it has never been tested.',

    // ── the two regimes of order, and only one of them is the port's ──
    theWatch: {
        strength: 'Thirty-odd cultivators on a wage, none above Foundation Establishment, funded out of the rate.',
        handles:
            'Theft, brawls, debt, short weight, and the ordinary business of a crowded quay. Money moves people at that height, so a funded watch is genuinely sufficient there and is what makes the port safe enough for a weak seller to walk onto.',
        topRungItCanHold: 16,
        whyItStopsThere:
            'It stops where the money stops. The port cannot field power at a higher rung without becoming a power itself, and it cannot borrow one from an apex without ceasing to be neutral - either would end the thing it sells. Paying for what it can afford and declining to reach past it is the only posture that leaves the port what it is, and it is more honest than most bodies are about where their writ ends.'
    },

    abovePartiesGuaranteeThemselves:
        'Above the watch, the Rail does not police anybody and says so at the gate. A high cultivator at Halfwater is protected by what they are and by who would come for them, which is why it is usually quiet up there: nobody robs a Nascent Soul cultivator, because everybody knows what that person will do and how long they will take about it. When it does happen it is spectacular, it is a private war, and the port neither stops it nor is party to it.',

    theSeam: {
        ordinalFrom: 17,
        ordinalTo: 20,
        what:
            'Somebody above what the watch can hold, with nobody in the world who would come for them. Deterrence needs an avenger and a rogue at Core Formation frequently has none, so the port\'s two regimes leave a gap exactly the width of one realm.',
        whatHappensThere:
            'The last three killings on the quay were all of that shape and the Factors have discussed each as an incident rather than as the pattern. It is the one thing a player could exploit at Halfwater, and the one thing a player could fall into.'
    },

    whyNobodyTakesIt:
        'Not strength and not distance. Whoever held the port would be holding forty acres of rock with a cistern on it, because the traffic is the asset and the traffic is there because no party owns it. Every power in the world is worse off the day it falls, including the power that would take it - so its security is a standing arrangement nobody signed, which is also the shape of its fragility: it holds exactly as long as it stays useful to all sides, and a party that stopped needing it would stop having a reason to protect it.'
} as const;

/**
 * WHAT THE ENGINE STILL DOES NOT DO, recorded rather than left implied.
 *
 * `newlyEntitled` in the world engine hands out cultivation roads only, so a
 * house the world founds for itself has no arts and never will. Artisans are
 * the obvious shape of an answer - a house that makes a thing is a house that
 * could teach making it, and `artisansOf` already derives a craft for any
 * faction from the ground it stands on, including one the world invented.
 *
 * It is not taken on here. The change would live in the world engine rather
 * than in a content catalog, and this file has no business reaching into how
 * a founded house is populated.
 */
export const THE_ARTS_A_NEW_HOUSE_HAS = {
    absence: 'A house the world founds during a run is given cultivation roads and no arts, and nothing will ever give it any.',
    whyArtisansAreTheShapeOfTheAnswer:
        'Every faction has makers, and `artisansOf` derives what they make from the province a house stands in - which works for a house nobody authored, because the ground is authored even where the house is not.',
    whereItWouldGo: 'The world engine, beside `newlyEntitled`. Not here.',
    status: 'recorded, not built'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

/** Provinces reachable from the water, with the lane that reaches them. */
export function lanesTouchingWater(): { laneId: string; days: number; landfalls: number }[] {
    return SEA_LANES.map(l => ({
        laneId: l.id,
        days: l.expectedDays,
        landfalls: l.intermediateLandfallDays.length
    }));
}

/** Every province's export list, which is the artisan fallback made visible. */
export function whatEachProvinceMakes(): { regionId: string; name: string; makes: readonly string[] }[] {
    return REGIONS.map(r => ({ regionId: r.id, name: r.name, makes: r.exports }));
}
