/**
 * What somebody knows of the land: which places they could find, which they have only heard
 * named, and which houses. And what kind of place each settlement is.
 *
 * The owner: "mark things as towns, cities, provincial capitals ... then knowledge increases and
 * you can tell where you are", "people in a town know where the nearest city is", "people in a
 * city know where the provincial capitals are", "start eveyone off with knowledge of at least 1-2
 * local sects", "keep the knowledge system, but most NPC's know far too little". And the rule it
 * all hangs on: knowledge goes by DISTANCE and by STANDING IN THE WORLD. "not EVERY cultivator
 * knows every sect in the province ... that's wild"; "depends on their standing in the world, so
 * their cultivation, their sect rank"; "if their sect is prestigious"; "if it's a court you
 * probably know a lot more than a random sect"; "inner disciples know more than outer".
 *
 * So nobody is on a rung for being a kind of person. How far somebody's knowledge reaches is a
 * sum of who they are - the size of the place they live, a life on the roads, their realm, their
 * rank on a house's roll and that house's standing - and what they know falls off with distance
 * from where they live against that reach. The size of the place widens only what they have
 * HEARD: "townsfolk have probably never left their town". Knowing the WAY comes of the rest. Which of the nearby houses a person happens to know is
 * theirs, drawn from who they are, so two people in one square answer differently. And in any
 * crowd somebody knows the way: "townsfolk probably don't know how but AT LEAST 1 PERSON OUGHT TO
 * KNOW THE WAY". See `whoAmongThemKnowsTheWay`.
 */

import { APEX_INSTITUTIONS } from '../../data/cultivation/governance-and-water-rights.js';
import { PLACE } from '../../data/cultivation/place-names.js';
import { REGIONS } from '../../data/cultivation/regions.js';
import { getSect } from '../../data/cultivation/sects.js';
import type { OriginTierKey } from '../cultivation/origin.js';
import { realmIndexOf } from '../cultivation/realms.js';
import { forStream } from '../cultivation/rng.js';
import type { WorldState } from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT KIND OF PLACE IT IS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The seat each province is governed from. The White Stair has none: it has "no court, no grant
 * book, three institutions and nothing else". The Burial Sands has none because no province
 * holds it.
 */
export const PROVINCIAL_CAPITALS: Readonly<Record<string, string>> = {
    'region-low-fall': PLACE.GREEN_FALL,
    'region-quiet-marches': PLACE.IRON_GATE,
    // "The largest of the nine, and the city the whole province sets its clocks by."
    'region-wide-field': PLACE.CLOUD_GATE,
    'region-drowned-reach': PLACE.SILVER_ISLE
};

export type ASettlementTier = 'hamlet' | 'village' | 'waystation' | 'town' | 'city' | 'provincial capital';

const CAPITALS = new Set(Object.values(PROVINCIAL_CAPITALS));

const PLACES = REGIONS.flatMap(region => region.places.map(place => ({ ...place, regionId: region.id })));

/** What kind of settlement a place is, by its name, or null for anything that is not one. */
export function whatKindOfPlace(name: string | null | undefined): ASettlementTier | null {
    if (!name) return null;
    if (CAPITALS.has(name)) return 'provincial capital';
    switch (PLACES.find(place => place.name === name)?.kind) {
        case 'hamlet': return 'hamlet';
        case 'village': return 'village';
        case 'waystation': return 'waystation';
        case 'market_town':
        case 'sect_town': return 'town';
        case 'city': return 'city';
        default: return null;
    }
}

const isACity = (name: string) => whatKindOfPlace(name) === 'city' || CAPITALS.has(name);
const settlementsOf = (regionId: string) =>
    PLACES.filter(place => place.regionId === regionId && place.kind !== 'site').map(place => place.name);
const citiesOf = (regionId: string) => settlementsOf(regionId).filter(isACity);

// ─────────────────────────────────────────────────────────────────────────
// AND WHAT SOMEBODY FROM THERE KNOWS
// ─────────────────────────────────────────────────────────────────────────

export interface WhatTheyKnowOfTheLand {
    /** `placed`: they could find it. `named`: they have heard of it. */
    places: { name: string; stage: 'placed' | 'named' }[];
    houses: { id: string; name: string; stage: 'placed' | 'named' }[];
}

/** The province a world row stands in, off its parents, as a catalog region id. */
function provinceOfRow(world: Pick<WorldState, 'locations'>, locationId: string | null): string | null {
    const byId = new Map(world.locations.map(row => [row.id, row]));
    for (let row = locationId ? byId.get(locationId) : undefined, steps = 0; row && steps < 12; steps++) {
        if (row.kind === 'region') return row.id.replace(/^loc-/, '');
        row = row.parentId ? byId.get(row.parentId) : undefined;
    }
    return null;
}

/** The province somebody from `from` is of: a catalog place, or a world row by name. */
function provinceOf(world: Pick<WorldState, 'locations'>, from: string | null): string | null {
    if (!from) return null;
    const place = PLACES.find(row => row.name === from);
    if (place) return place.regionId;
    const region = REGIONS.find(row => row.name === from);
    if (region) return region.id;
    return provinceOfRow(world, world.locations.find(row => row.name === from)?.id ?? null);
}

/** Provinces next door, nearest first. */
function nextDoor(regionId: string): string[] {
    const region = REGIONS.find(row => row.id === regionId);
    if (!region) return [];
    const days = new Map<string, number>();
    for (const connection of region.connections) {
        const had = days.get(connection.otherRegionId);
        if (had === undefined || connection.travelDays < had) days.set(connection.otherRegionId, connection.travelDays);
    }
    return [...days.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
}

/** Who somebody is, as far as what they know of the land goes. */
export interface WhoTheyAre {
    id: string;
    /** Where they live. */
    from: string | null;
    ordinal: number;
    /** Their house and the rung they hold on its roll, lowest first. */
    house?: { id: string; rankIndex: number } | null;
    /**
     * How much of the road their life has seen, 0 to 2: a carter, a courier or a caravan hand
     * is 2. See `howMuchOfTheRoadALifeHasSeen`, and `theRoadAnUpbringingSaw` for the player.
     */
    travelled?: number;
    /**
     * The player's: at least one house they know the way to. The owner: "ensure that it is
     * nonzero and reachable from where you start".
     */
    aWayToOneHouse?: boolean;
}

const WHAT_A_PLACE_GIVES: Record<ASettlementTier, number> = {
    hamlet: 0, village: 0, waystation: 0, town: 1, city: 2, 'provincial capital': 2
};

const APEXES = new Set(APEX_INSTITUTIONS.map(apex => apex.factionId).filter((id): id is string => !!id));

/** What the place they live gives: what is said in a city reaches further than a village. */
function whatTheirPlaceGives(from: string | null): number {
    const tier = whatKindOfPlace(from);
    return tier ? WHAT_A_PLACE_GIVES[tier] : 0;
}

/**
 * How far their knowledge reaches, as a sum of who they are. A village farmer is 0, a townsman 1,
 * a caravan hand from a city 4, an outer disciple barely above a townsman, an inner disciple more,
 * an elder of a court or an apex house the province and well beyond.
 */
export function howFarTheirKnowledgeReaches(
    world: Pick<WorldState, 'factions'>,
    who: Pick<WhoTheyAre, 'from' | 'ordinal' | 'house' | 'travelled'>
): number {
    const place = whatTheirPlaceGives(who.from);
    const road = Math.max(0, Math.min(2, who.travelled ?? 0));
    const realm = Math.max(0, realmIndexOf(who.ordinal));
    let standing = 0;
    if (who.house) {
        const house = world.factions.find(faction => faction.id === who.house!.id);
        // Each rung up the roll sees further: "inner disciples know more than outer".
        standing += Math.min(4, Math.max(0, who.house.rankIndex));
        // And the house's own standing: a court or an apex house sees further than a random sect.
        if (house?.kind === 'court' || APEXES.has(who.house.id)) standing += 2;
        else if ((getSect(who.house.id)?.powerOrdinal ?? 0) >= 30) standing += 1;
    }
    return place + road + realm + standing;
}

/** How much of the road a life has seen, off an occupation as the world wrote it. */
export function howMuchOfTheRoadALifeHasSeen(occupation: string | null | undefined): number {
    const work = (occupation ?? '').toLowerCase();
    if (/carter|courier|caravan|merchant|trader|peddl|messenger|boat|sailor|escort|drover|wander|rogue|pilgrim|smuggl/.test(work)) return 2;
    if (/market|stall|inn|ferry|porter|guard/.test(work)) return 1;
    return 0;
}

/** The houses that stand on sect ground, with the province each stands in. */
function theSeatedHouses(world: Pick<WorldState, 'locations' | 'factions'>) {
    const kinds = new Map(world.locations.map(row => [row.id, row.kind]));
    return world.factions
        .filter(faction => faction.seatLocationId && faction.dissolvedOnDay === null
            && kinds.get(faction.seatLocationId) === 'sect_seat')
        .map(faction => ({ faction, province: provinceOfRow(world, faction.seatLocationId) }));
}

export function whatSomebodyKnowsOfTheLand(
    world: Pick<WorldState, 'locations' | 'factions'>,
    who: WhoTheyAre
): WhatTheyKnowOfTheLand {
    const home = provinceOf(world, who.from);
    // What they have heard of, and how much of it they could find: the place they live widens
    // the first and not the second.
    const heard = howFarTheirKnowledgeReaches(world, who);
    const way = heard - whatTheirPlaceGives(who.from);
    const near = home ? nextDoor(home) : [];

    const places = new Map<string, 'placed' | 'named'>();
    const know = (name: string | null | undefined, stage: 'placed' | 'named') => {
        if (!name) return;
        if (places.get(name) !== 'placed') places.set(name, stage);
    };

    // Everybody: their own province and its capital, the nearest city, the provinces over the border.
    if (home) {
        for (const name of settlementsOf(home)) know(name, 'placed');
        know(PROVINCIAL_CAPITALS[home], 'placed');
        know([home, ...near].map(citiesOf).find(cities => cities.length > 0)?.[0], 'placed');
    }
    for (const id of near) know(REGIONS.find(row => row.id === id)?.name, 'named');
    // And outward: heard of with what is said where they live, found with what they have done.
    const stage = (placed: boolean) => (placed ? 'placed' : 'named');
    if (heard >= 1) for (const id of near) for (const name of citiesOf(id)) know(name, stage(way >= 1));
    if (heard >= 2) {
        for (const region of REGIONS) {
            know(region.name, 'named');
            // "people in a city know where the provincial capitals are": every road out of a city
            // is signed for one.
            know(PROVINCIAL_CAPITALS[region.id], 'placed');
            for (const name of citiesOf(region.id)) know(name, stage(way >= 2));
        }
    }
    if (heard >= 3) {
        for (const region of REGIONS) for (const name of settlementsOf(region.id)) know(name, 'named');
        if (way >= 3) for (const id of near) for (const name of settlementsOf(id)) know(name, 'placed');
    }
    if (way >= 5) for (const region of REGIONS) for (const name of settlementsOf(region.id)) know(name, 'placed');
    // A PROVINCE IS FOUND BY THE ROAD TOWARD IT. Next door, the border road is signed for it; further
    // off, whoever could find a town in it knows which way to set out. Played: asked the way to the
    // White Stair in a provincial capital, nobody could give it, because a province was only ever a
    // name.
    for (const region of REGIONS) {
        if (region.id === home || near.includes(region.id)
            || settlementsOf(region.id).some(name => places.get(name) === 'placed')) know(region.name, 'placed');
    }

    // THE HOUSES, nearest first and by standing.
    const seats = theSeatedHouses(world);
    const houses = new Map<string, { id: string; name: string; stage: 'placed' | 'named' }>();
    const knowHouse = (faction: { id: string; name: string }, stage: 'placed' | 'named') => {
        if (houses.get(faction.id)?.stage !== 'placed') houses.set(faction.id, { id: faction.id, name: faction.name, stage });
    };
    // Which of them this person happens to know is theirs: drawn from who they are.
    const draw = forStream(who.id, 'which-houses-they-know');
    const order = new Map(seats.map(seat => [seat.faction.id, draw.next()]));
    const ordinaryIn = (regionId: string | null) => seats
        .filter(seat => seat.province === regionId && !APEXES.has(seat.faction.id))
        .map(seat => seat.faction)
        .sort((a, b) => order.get(a.id)! - order.get(b.id)!);

    // The house that holds their own town, whose people they see every week.
    const holder = world.locations.find(row => row.name === who.from)?.controllingFactionId;
    const local = holder ? world.factions.find(faction => faction.id === holder) : undefined;
    if (local) knowHouse(local, 'placed');
    if (who.house) {
        const own = world.factions.find(faction => faction.id === who.house!.id);
        if (own) knowHouse(own, 'placed');
    }
    // Nearby: of their own province, or the nearest province that has any. One or two to anybody,
    // the way to the first on a coin (always, for the player); more of both with reach.
    const nearby = [home, ...near].map(ordinaryIn).find(list => list.length > 0) ?? [];
    const wayKnown = way >= 4 ? nearby.length : way;
    const heardOf = heard >= 4 ? nearby.length : heard + (draw.next() < 0.5 ? 1 : 2);
    const firstWay = who.aWayToOneHouse === true || draw.next() < 0.5;
    nearby.slice(0, heardOf).forEach((faction, i) => {
        knowHouse(faction, i < wayKnown || (i === 0 && firstWay) ? 'placed' : 'named');
    });
    // Next door by name, then by way; the apexes only to the well placed; the world by name.
    if (heard >= 3) for (const id of near) for (const faction of ordinaryIn(id)) knowHouse(faction, stage(way >= 5));
    if (heard >= 4) for (const seat of seats) if (APEXES.has(seat.faction.id)) knowHouse(seat.faction, 'named');
    if (heard >= 5) for (const seat of seats) knowHouse(seat.faction, 'named');

    return {
        places: [...places.entries()].map(([name, stage]) => ({ name, stage })),
        houses: [...houses.values()]
    };
}

/**
 * What standing somewhere shows anybody who arrives, without a word asked. The owner: "ensure you
 * can travel the world, broaden your horizons", and "you expand your horizons as you go further".
 * The roads out of a town are signed for where they go, so those can be found; the province's other
 * settlements are names a traveller hears inside a day; every town signs the road to its capital;
 * and a city's roads leave for the capitals of the provinces next door, which a town only names.
 * Nothing further than that is handed over: the rest is asked for, or walked to.
 */
export function whatStandingHereShows(
    world: Pick<WorldState, 'locations'>,
    here: string | null
): { name: string; stage: 'placed' | 'named' }[] {
    const province = provinceOf(world, here);
    if (!province || !here) return [];
    const shown = new Map<string, 'placed' | 'named'>();
    const show = (name: string | null | undefined, stage: 'placed' | 'named') => {
        if (!name || name === here) return;
        if (shown.get(name) !== 'placed') shown.set(name, stage);
    };
    for (const name of settlementsOf(province)) show(name, 'named');
    show(PROVINCIAL_CAPITALS[province], 'placed');
    // The roads out of here, whichever end of the road the catalog wrote them on.
    for (const place of PLACES.filter(row => row.regionId === province)) {
        if (place.name === here) for (const road of place.connections ?? []) show(road.otherPlaceName, 'placed');
        if ((place.connections ?? []).some(road => road.otherPlaceName === here)) show(place.name, 'placed');
    }
    const tier = whatKindOfPlace(here);
    const aCity = tier === 'city' || tier === 'provincial capital';
    for (const id of nextDoor(province)) {
        show(REGIONS.find(row => row.id === id)?.name, 'named');
        show(PROVINCIAL_CAPITALS[id], aCity ? 'placed' : 'named');
    }
    return [...shown.entries()].map(([name, stage]) => ({ name, stage }));
}

/**
 * Which of a crowd knows the way to a house, as an index into `people`, or -1 when nobody here
 * could be expected to. The one whose own knowledge reaches it, the furthest-reaching first. And
 * past that, the size of the place decides whether somebody in the crowd has been anyway: "AT
 * LEAST 1 PERSON OUGHT TO KNOW THE WAY" in a town, to the houses of its province; "following the
 * path of a town -> a city probably gets you to a sect", so a city adds the provinces next door;
 * "going further to the provincial capital will basically guarantee it", so a capital adds the
 * apexes too. A village guarantees nothing past what its people happen to know.
 */
export function whoAmongThemKnowsTheWay(
    world: Pick<WorldState, 'locations' | 'factions'>,
    here: string | null,
    people: readonly WhoTheyAre[],
    houseId: string
): number {
    if (people.length === 0) return -1;
    const byReach = theFurthestReachingFirst(world, people);
    for (const { i } of byReach) {
        if (whatSomebodyKnowsOfTheLand(world, people[i]!).houses.some(row => row.id === houseId && row.stage === 'placed')) return i;
    }
    const seat = theSeatedHouses(world).find(row => row.faction.id === houseId);
    const province = provinceOf(world, here);
    const tier = whatKindOfPlace(here);
    if (!seat || !province || !tier) return -1;
    const inProvince = seat.province === province;
    const nextDoorToIt = nextDoor(province).includes(seat.province ?? '');
    const apex = APEXES.has(houseId);
    const somebodyHasBeen =
        tier === 'provincial capital' ? inProvince || nextDoorToIt
        : tier === 'city' ? (inProvince || nextDoorToIt) && !apex
        : tier === 'town' ? inProvince && !apex
        : false;
    return somebodyHasBeen ? byReach[0]!.i : -1;
}

/**
 * The same for a place or a province, by name. A town's crowd has walked its own province and
 * knows the roads over its borders; a city's has been next door; and a provincial capital, where
 * the roads of every province come in, can set anybody on the road to any province, and to the
 * towns of its own and the ones next door.
 */
export function whoAmongThemKnowsTheWayToAPlace(
    world: Pick<WorldState, 'locations' | 'factions'>,
    here: string | null,
    people: readonly WhoTheyAre[],
    name: string
): number {
    if (people.length === 0) return -1;
    const byReach = theFurthestReachingFirst(world, people);
    for (const { i } of byReach) {
        if (whatSomebodyKnowsOfTheLand(world, people[i]!).places.some(row => row.name === name && row.stage === 'placed')) return i;
    }
    const province = provinceOf(world, here);
    const itsProvince = provinceOf(world, name);
    const tier = whatKindOfPlace(here);
    if (!province || !itsProvince || !tier) return -1;
    const aProvince = REGIONS.some(row => row.name === name);
    const inProvince = itsProvince === province;
    const nextDoorToIt = nextDoor(province).includes(itsProvince);
    const somebodyHasBeen =
        tier === 'provincial capital' ? inProvince || nextDoorToIt || aProvince
        : tier === 'city' ? inProvince || nextDoorToIt
        : tier === 'town' ? inProvince || (aProvince && nextDoorToIt)
        : false;
    return somebodyHasBeen ? byReach[0]!.i : -1;
}

/** A crowd in order of how far each one's knowledge reaches, the furthest first. */
function theFurthestReachingFirst(world: Pick<WorldState, 'factions'>, people: readonly WhoTheyAre[]) {
    return people.map((who, i) => ({ i, reach: howFarTheirKnowledgeReaches(world, who) }))
        .sort((a, b) => b.reach - a.reach);
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHERE A LIFE BEFORE THE GAME HAD ALREADY TAKEN THEM
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much of the road an upbringing saw. The owner: "pre-seed for the player some locations
 * based on their history prior to the game starting". A family that trades has seen further than
 * one that farms, and a clan's child has been taken to where the province is run from.
 */
export function theRoadAnUpbringingSaw(origin: OriginTierKey): number {
    switch (origin) {
        case 'thin_county': return 0;
        case 'market_town':
        case 'minor_clan':
        case 'sect_retainer': return 1;
        default: return 2;
    }
}

/**
 * The places a life before the game had them stand in, besides home: the market a farm sells at,
 * the city a trading family deals with, the seat a clan answers to, the house a family serves.
 */
export function whereALifeBeforeTookThem(
    world: Pick<WorldState, 'locations' | 'factions'>,
    who: { origin: OriginTierKey; from: string | null; houseId: string | null }
): string[] {
    const home = provinceOf(world, who.from);
    if (!home) return [];
    const nearestCity = [home, ...nextDoor(home)].map(citiesOf).find(cities => cities.length > 0)?.[0] ?? null;
    const aTown = settlementsOf(home).find(name => name !== who.from && whatKindOfPlace(name) === 'town') ?? nearestCity;
    const house = who.houseId ? world.factions.find(faction => faction.id === who.houseId) : undefined;
    const seat = house?.seatLocationId ? world.locations.find(row => row.id === house.seatLocationId)?.name ?? null : null;
    const been = (() => {
        switch (who.origin) {
            case 'thin_county': return [aTown];
            case 'market_town': return [nearestCity];
            case 'minor_clan':
            case 'established_clan': return [PROVINCIAL_CAPITALS[home] ?? nearestCity];
            default: return [seat ?? PROVINCIAL_CAPITALS[home] ?? nearestCity];
        }
    })();
    return been.filter((name): name is string => !!name && name !== who.from);
}
