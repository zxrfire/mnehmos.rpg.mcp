import { whoIsOnTheRoadWith } from './who-is-on-the-road-with-you.js';
import { workersAtPublicCounters } from './who-is-working-at-a-public-counter.js';
import { getConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import { publicCountersAt, publicTransportHubsAt, type PublicCounterKind } from './public-transport-at-a-place.js';
/**
 * Which area somebody stands in: three other people, plus the observer's party.
 *
 * The owner: "AT MOST 3 people per room, 3 NPCs", "like 3 character cards per room", "for others,
 * they can be in a diff room", where a room is any area of a place. Measured before this, on
 * `road-world`: the square a new run opened on held 6, 11, 21 and 28 people (seeds intro-1,
 * road-5, road-17, intro-2), because a place was one square and everybody in it stood in it.
 *
 * ── READ OFF WHAT SOMEBODY IS AT, AS A COMPOUND'S ROOMS ARE ─────────────
 *
 * `NpcRecord.locationId` stays the place. Which area of it they are in is read, the way
 * `where-inside-a-house-somebody-is-standing.ts` reads a house's people into its rooms, and it is
 * read over whoever that read leaves in the row. What they are at decides the kind of area:
 *
 *   a town         a counter or a hired hand's work at a market or in the street, where shops
 *                  line it; a table or a sitting at an inn; anything else in the street, which
 *                  is where a road comes in
 *   a house's seat the one on watch, and anybody not of the house, outside the gate; the
 *                  house's own in the forecourt
 *   open water     the decks of a hull, since nobody stands on the sea itself
 *   anywhere else  one kind
 *
 * and each kind leaves space for roughly one or two people per area, with three the ceiling.
 * The dead who fell there are counted. Each person stands in the area a draw of their own points at, or the next with room, so
 * a death pulls nobody across from elsewhere. People in one activity together
 * (`withIds`) are kept in one area. The draw includes the day and three-hour part of the day. Nothing
 * writes an area: a new activity is a new reading. Active party members and followers
 * stand with the observer without consuming one of the three places for other people.
 *
 * ── AN AREA IS NOT A LOCATION ROW ────────────────────────────────────────
 *
 * `the-town-at-the-foot-of-a-house.ts` measured what a second settlement row per house did to the
 * demography. An area is `<place id>#<kind>#<slug>`: not somewhere a road goes, a birth is
 * weighted to, or a seeded draw picks from. `npcsAt` and `npcsStandingIn` still answer for the
 * whole row.
 *
 * PURE. The world in, an id or a list out.
 */

import { forStream } from '../cultivation/rng.js';
import { isOpenWater } from '../../data/cultivation/regions.js';
import { whatKindOfPlace } from './what-somebody-knows-of-the-land.js';
import { SEA_LANES } from '../../data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { isAwayOnSomething, isActing, PLAYER_ROW_TAG, type ActivityKind, type NpcRecord } from './npc-state.js';
import type { LocationRecord, RouteQueries, PlaceScope } from './locations.js';
import {routeQueriesFor} from './locations.js';
import type { WorldState } from './world-state.js';
import { routineOf, routineTime } from './npc-routines.js';
import { theLodgingsOfAHouse, whichRoomARungGets } from './the-room-a-house-gives-you.js';
import { townHasAClinic, physicianIsWorking } from './who-is-actually-seeing-to-wounds.js';
import { shopfrontsAt, theShopfrontOf, type ShopfrontKind } from './a-dao-house-shopfront.js';
import {
    npcsStandingIn,
    npcsWithin,
    whereCompoundsAre,
    type WhereCompoundsAre
} from './where-inside-a-house-somebody-is-standing.js';

/** Three people outside the observer's active party; companions are additional. */
export const AT_MOST_IN_AN_AREA = 3;

/** Presentation fallbacks use the same ceiling without cutting off companions. */
export function threeOthersAndTheParty<T extends {id: string}>(people: readonly T[], partyIds: ReadonlySet<string>): T[] {
    let others = 0;
    return people.filter(person => partyIds.has(person.id) || others++ < AT_MOST_IN_AN_AREA);
}


/** What an area of a place is for. */
export type WhatAnAreaIsFor = 'street' | 'market' | 'table' | 'gate' | 'forecourt' | 'board' | 'here' | 'room' | 'deck' | 'exchange' | 'clinic' | 'landing' | 'carriage_station' | 'span_counter' | 'spirit_berth' | 'register_gate' | 'star_office';

export interface AnAreaOfAPlace {
    /** `<place id>#<kind>#<slug>`. */
    id: string;
    placeId: string;
    /** Its own name, as a player would say it: `the cloth row`. */
    name: string;
    for: WhatAnAreaIsFor;
}

type State = Pick<WorldState, 'seed' | 'currentDay' | 'currentHour' | 'locations' | 'npcs' | 'factions'>
    & Partial<Pick<WorldState, 'objects'>>;

interface StandingWith {
    id: string;
    standingIn?: string | null;
    sectId?: string | null;
    /** Active party ids derived by the caller, including stored followers. */
    partyIds?: ReadonlySet<string>;
    /** People held outside the world roster, with their own area when known. */
    others?: readonly { id: string; standingIn?: string | null }[];
    physical?: { accepts: (npc: NpcRecord) => boolean; betweenEndpoints: boolean;
        /** Supplied by an accepted physical carrier read, never a stored passenger roster. */
        hull?: { key: string; operatorId: string; areaKind: 'deck' | 'here';
            /** Authored current hull slots and a validated single NPC area fact. */
            rooms?: readonly AnAreaOfAPlace[];
            actualAreaFor?: (npc: NpcRecord) => string | null } }; 
}

const MARK = '#';

/**
 * The names a town's areas take, by the catalog kind it was seeded as, most ordinary first.
 *
 * A kind needs as many as its busiest town has threes: measured on three seeded worlds, a city
 * holds up to 37 and about seven in ten are at a counter.
 */
const WHAT_A_TOWN_HAS: Readonly<Record<string, { market: readonly string[]; table: readonly string[] }>> = {
    city: {
        market: ['the grain market', 'the cloth row', 'the salt and oil stalls', 'the horse lines',
            'the night market', 'the fish market', 'the pawnshop lane', 'the herb stalls',
            "the ironmongers' row", 'the silk row', 'the tea stalls', "the dyers' lane"],
        table: ['the inn', 'the teahouse', 'the wine shop', 'the noodle stall']
    },
    market_town: {
        market: ['the market', 'the cloth row', 'the grain stalls', 'the pawnshop lane', 'the tea stalls', 'the herb stalls'],
        table: ['the inn', 'the teahouse', 'the noodle stall']
    },
    sect_town: {
        market: ['the market', 'the herb stalls', "the smiths' row", 'the talisman stalls', 'the grain stalls', 'the pawnshop lane'],
        table: ['the inn', 'the teahouse', 'the noodle stall']
    },
    village: {
        market: ['the stalls by the well', 'the market lane', 'the threshing floor stalls', 'the carts by the bridge'],
        table: ['the wine shop', 'the noodle stall']
    },
    hamlet: { market: ['the stalls', 'the carts by the road'], table: ['the wine shop'] },
    waystation: { market: ['the stalls', 'the carters\' yard'], table: ['the inn', 'the noodle stall'] }
};

const WHAT_ANY_OTHER_TOWN_HAS = { market: ['the market', 'the stalls'], table: ['the inn'] } as const;

const THE_STREETS = ['the street', 'the lane behind the street', 'the square', 'the well', 'the bridge', 'the temple steps'];
const OUTSIDE_THE_GATE = ['outside the gate', 'along the wall', 'the foot of the steps'];
const ABOARD = ['the deck', 'the foredeck', 'the stern', 'below decks', 'the afterdeck'];
const THE_FORECOURT = ['the forecourt', 'the far side of the forecourt', 'the steps of the hall', 'the corner of the forecourt'];
/**
 * Where a house's missions hang, inside its walls. A thing and not a person, so nobody is dealt
 * into it and it takes none of the three places. See `the-mission-board-inside-a-house.ts`.
 */
const THE_MISSION_BOARD = ['the mission board'];

/** What each activity is done at in a town. Anything not here is in the street. */
const WHERE_A_THING_IS_DONE_IN_A_TOWN: Readonly<Partial<Record<ActivityKind, WhatAnAreaIsFor>>> = {
    trade: 'market',
    // Minding a stall, unloading a cart, sweeping a shop's doorway: a hired hand where goods move.
    the_work_of_their_rank: 'market',
    at_a_table: 'table',
    // A cultivator sitting down to work in a town has taken a room at an inn.
    their_practice: 'table',
    comprehending: 'table',
    mending: 'table'
};

function slug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Whether this row is a town. */
export function isATown(location: Pick<LocationRecord, 'kind'> | null | undefined): boolean {
    return location?.kind === 'settlement';
}

/** The house whose seat this is, or null. */
function theHouseOfTheSeat(place: Pick<LocationRecord, 'kind' | 'data' | 'controllingFactionId'>): string | null {
    if (place.kind !== 'sect_seat') return null;
    const id = (place.data as { factionId?: unknown }).factionId;
    return typeof id === 'string' && id.length > 0 ? id : place.controllingFactionId;
}

/**
 * Whether this row is open water, where whoever is on it is aboard a hull: the province that is
 * sea, and the stretches of it a lane names as its open water.
 */
function isOpenWaterRow(place: Pick<LocationRecord, 'kind' | 'data' | 'name'>): boolean {
    const id = (place.data as { catalogRegionId?: unknown }).catalogRegionId;
    if (place.kind === 'region') return typeof id === 'string' && isOpenWater(id);
    return SEA_LANES.some(lane => lane.water?.toLowerCase() === place.name.toLowerCase());
}

/** The kinds of area a place has, the one a road arrives in first. */
function theKindsOf(place: Pick<LocationRecord, 'kind' | 'data' | 'controllingFactionId' | 'name' | 'tags'>): WhatAnAreaIsFor[] {
    if (isATown(place)) {
        const kinds: WhatAnAreaIsFor[] = place.tags.includes('city') || whatKindOfPlace(place.name) === 'provincial capital'
            ? ['street', 'market', 'exchange', 'table'] : ['street', 'market', 'table'];
        if (townHasAClinic(place)) kinds.push('clinic');
        return kinds;
    }
    if (isOpenWaterRow(place)) return ['deck'];
    if (theHouseOfTheSeat(place) !== null) return ['gate', 'forecourt', 'board'];
    return ['here'];
}

/** A place's own name, without the house glued to the front of a room's. */
function itsOwnName(place: Pick<LocationRecord, 'name'>): string {
    const at = place.name.indexOf(': ');
    return at < 0 ? place.name : place.name.slice(at + 2);
}

/** The names the areas of one kind take, in order. */
function theNamesFor(place: Pick<LocationRecord, 'name' | 'tags'>, what: WhatAnAreaIsFor): readonly string[] {
    const town = WHAT_A_TOWN_HAS[place.tags.find(tag => tag in WHAT_A_TOWN_HAS) ?? ''] ?? WHAT_ANY_OTHER_TOWN_HAS;
    switch (what) {
        case 'street': return THE_STREETS;
        case 'market': return town.market;
        case 'exchange': return ['the exchange', 'the exchange counters', 'the exchange courtyard', 'the exchange galleries', 'the auction house'];
        case 'landing': return ['the landing'];
        case 'carriage_station': return ['the carriage station'];
        case 'span_counter': return ['the folding counter'];
        case 'spirit_berth': return ['the Spirit Boat Berth'];
        case 'register_gate': return ['the Jade Register gatehouse'];
        case 'star_office': return ['the Flowing Star office'];
        case 'clinic': return ["the physician's clinic"];
        case 'table': return town.table;
        case 'gate': return OUTSIDE_THE_GATE;
        case 'forecourt': return THE_FORECOURT;
        case 'board': return THE_MISSION_BOARD;
        case 'deck': return ABOARD;
        case 'here': {
            const own = itsOwnName(place);
            return [own, `the far side of ${own}`, `further along ${own}`, `the edge of ${own}`];
        }
        // Nobody is dealt into a room somebody paid for; see `aRoomOfTheirOwn`.
        case 'room': return [];
    }
}

/** The area a Dao house's shopfront keeps, by its kind. */
const A_SHOPFRONT_AREA: Record<ShopfrontKind, WhatAnAreaIsFor | null> = {
    register_gate: 'register_gate', star_office: 'star_office', auction_floor: 'exchange'
};

const ORDINALS = ['second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

/** The name of the area at this index of a kind; past the list, a further corner of the first. */
function theNameAt(names: readonly string[], index: number): string {
    if (index < names.length) return names[index]!;
    const past = index - names.length;
    return `the ${ORDINALS[past % ORDINALS.length]} corner of ${names[0]!.replace(/^the /, '')}`
        + (past >= ORDINALS.length ? ` ${Math.floor(past / ORDINALS.length) + 1}` : '');
}

function anArea(place: Pick<LocationRecord, 'id'>, what: WhatAnAreaIsFor, name: string): AnAreaOfAPlace {
    return { id: `${place.id}${MARK}${what}${MARK}${slug(name)}`, placeId: place.id, name, for: what };
}

/** Facilities have their first area regardless of who is standing there. */
export function departureAreaAt(state: State, place: LocationRecord,
    kind: 'landing' | 'carriage_station' | 'spirit_berth',scope?:PlaceScope): AnAreaOfAPlace | undefined {
    return theKindsAt(state,place,routineTime(state),kind,scope).includes(kind)
        ?anArea(place,kind,theNamesFor(place,kind)[0]!):undefined;
}

function theKindsAt(state: State,place: LocationRecord,now: number,
    only?:'landing'|'carriage_station'|'spirit_berth',scope?:PlaceScope): WhatAnAreaIsFor[] {
    return [...(only?[]:theKindsOf(place)),
        // A Dao house's shopfront is a counter of its own; the Terrace's floor is the exchange's auction house.
        ...(only?[]:shopfrontsAt(state,place).map(shop=>A_SHOPFRONT_AREA[shop.kind]).filter((k):k is WhatAnAreaIsFor=>k!==null)),
        ...(only==='spirit_berth'?[]:publicTransportHubsAt(state,place.name,now,
            {scope,kind:only}).map(hub=>hub.kind)),
        ...((!only||only==='carriage_station')&&(state.objects??[]).some(object=>{
            if(object.locationId!==place.id||!object.tags.includes('conveyance'))return false;
            const craft=getConveyance(String(object.data.conveyanceId??''));
            return craft&&!craft.crossesGroundThatCannotBeWalked&&!craft.waterOnly;
        })?['carriage_station' as const]:[]),
        ...((!only||only==='spirit_berth')&&(place.kind==='sect_seat'||(state.objects??[]).some(object=>object.locationId===place.id
            &&object.tags.includes('conveyance')
            &&getConveyance(String(object.data.conveyanceId??''))?.crossesGroundThatCannotBeWalked))
            ?['spirit_berth' as const]:[])];
}

/**
 * A room somebody has paid for at an inn here, as an area of the place: nobody is dealt into it,
 * so standing in it is standing alone but for whoever is with them. The owner: "go to your room,
 * sleep ... in the room is just yourself (unless ur with a party)". Its id carries the holder,
 * so two lodgers are never in each other's room. Null for any other id.
 */
export function aRoomOfTheirOwn(place: Pick<LocationRecord, 'id' | 'kind'> & Partial<Pick<LocationRecord, 'data'>>, holderId: string): AnAreaOfAPlace {
    // The owner: a room is an area "at an inn (or in your sect, or a cave)". A cave
    // of their own is the whole place and needs no area inside it.
    const name = place.kind === 'sect_seat' || ['dormitory', 'residence'].includes(String(place.data?.purpose))
        ? 'your quarters' : 'your room at the inn';
    return { id: `${place.id}${MARK}room${MARK}${holderId}`, placeId: place.id, name, for: 'room' };
}

/**
 * Who is on watch at a house's gate: of the house's own the compound read leaves at its seat, the
 * lowest rung, then the lowest id. Null where none of them is there, and then the gate is shut.
 */
export function theOneOnWatchAtTheGate(
    state: State,
    seat: Pick<LocationRecord, 'id' | 'kind' | 'data' | 'controllingFactionId'>,
    compounds: WhereCompoundsAre = whereCompoundsAre(state),
    routes?: RouteQueries
): NpcRecord | null {
    const house = theHouseOfTheSeat(seat);
    if (house === null) return null;
    return npcsStandingIn(state, seat.id, compounds, routes)
        .filter(n => n.factionId === house && !routineOf(state, n, routes).home
            && !(n.activity !== null && isAwayOnSomething(n.activity.kind)))
        .sort((a, b) => a.factionRankIndex - b.factionRankIndex || (a.id < b.id ? -1 : 1))[0] ?? null;
}

/**
 * Who of a house could be sent down to its gate when nobody is at it: the lowest rung anywhere
 * inside its walls and not away. Null where the house has nobody home.
 */
export function whoCouldBeSentToTheGate(
    state: State,
    seat: Pick<LocationRecord, 'id' | 'kind' | 'data' | 'controllingFactionId'>,
    compounds: WhereCompoundsAre = whereCompoundsAre(state)
): NpcRecord | null {
    const house = theHouseOfTheSeat(seat);
    if (house === null) return null;
    return npcsWithin(state, seat.id, compounds)
        .filter(n => n.factionId === house && !(n.activity !== null && isAwayOnSomething(n.activity.kind)))
        .sort((a, b) => a.factionRankIndex - b.factionRankIndex || (a.id < b.id ? -1 : 1))[0] ?? null;
}

/** A place read into its areas: every area there is, and which one each of its people is in. */
export interface APlaceReadIntoAreas {
    areas: AnAreaOfAPlace[];
    whereIs: Map<string, string>;
    whereBodiesAre: Map<string, string>;
}

/**
 * Every area of a place, and where each of the people standing in it is.
 *
 * Each kind has at least its first area, so the street, a market, an inn, the gate and the
 * forecourt are somewhere to stand even with nobody in them.
 */
export function theAreasOf(
    state: State,
    place: LocationRecord,
    compounds: WhereCompoundsAre = whereCompoundsAre(state),
    standingWith?: StandingWith,
    routes?: RouteQueries
): APlaceReadIntoAreas {
    routes ??= routeQueriesFor(state.locations);
    const day = Math.floor(state.currentDay);
    const people = npcsStandingIn(state, place.id, compounds, routes)
        .filter(n => !n.tags.includes(PLAYER_ROW_TAG) && n.id !== standingWith?.id
            && (!standingWith?.physical || standingWith.physical.accepts(n)));
    const betweenEndpoints = standingWith?.physical?.betweenEndpoints === true;
    const here = new Map(people.map(n => [n.id, n]));
    const routines = new Map(people.map(n => [n.id, routineOf(state, n, routes, standingWith?.physical?.hull?.actualAreaFor)]));
    const house = theHouseOfTheSeat(place);
    const watch = betweenEndpoints || house === null ? null : theOneOnWatchAtTheGate(state, place, compounds, routes);
    const aboard = isOpenWaterRow(place) || standingWith?.physical?.hull?.areaKind === 'deck';
    const now = routineTime(state);
    const partyIds = new Set(standingWith ? [...standingWith.partyIds ?? [],
        ...whoIsOnTheRoadWith(state.npcs, standingWith.id, now).map(person => person.id)] : []);
    const othersIn = (group: readonly NpcRecord[]) => group.filter(person => !partyIds.has(person.id)).length;
    const hullOf = new Map<string, string>();
    if (standingWith?.physical?.hull) {
        for (const npc of people) hullOf.set(npc.id, standingWith.physical.hull.key);
    } else if (aboard) for (const npc of people) {
        const routine = routines.get(npc.id)!;
        const trip = routine.activity;
        if (trip?.kind !== 'travelling' || routine.standingIn || !trip.vesselId || !trip.seaLaneId
            || !trip.fromLocationId || !trip.returnTo || trip.untilDay == null
            || !Number.isFinite(trip.sinceDay) || !Number.isFinite(trip.untilDay)
            || now < trip.sinceDay || now >= trip.untilDay) continue;
        hullOf.set(npc.id, JSON.stringify([trip.vesselId, trip.seaLaneId, trip.fromLocationId, trip.returnTo]));
    }
    const hullmates = new Map<string, NpcRecord[]>();
    for (const npc of people) {
        const hull = hullOf.get(npc.id);
        if (hull) hullmates.set(hull, [...(hullmates.get(hull) ?? []), npc]);
    }

    // ONE SCENE, ONE AREA: people in an activity together, joined over everybody standing here.
    const groupOf = new Map<string, NpcRecord[]>();
    for (const npc of people) {
        if (groupOf.has(npc.id)) continue;
        const group: NpcRecord[] = [];
        const queue = [npc];
        while (queue.length > 0) {
            const one = queue.pop()!;
            if (groupOf.has(one.id)) continue;
            groupOf.set(one.id, group);
            group.push(one);
            const hull = hullOf.get(one.id);
            if (hull) {
                for (const other of hullmates.get(hull) ?? []) if (!groupOf.has(other.id)) queue.push(other);
                continue;
            }
            const activity = routines.get(one.id)!.activity;
            if (!activity) continue;
            for (const id of activity.withIds) {
                const other = here.get(id);
                if (other && !hullOf.has(other.id) && !groupOf.has(other.id)) queue.push(other);
            }
        }
    }
    const deckOrder = (npc: NpcRecord): number => npc.id === standingWith?.physical?.hull?.operatorId || npc.identity.occupation === 'shipmaster' ? 0
        : npc.tags.some(tag => tag.startsWith('crew-of:')) ? 2 : 1;
    const groups = [...new Set(groupOf.values())].map(group => group.sort((a, b) =>
        (hullOf.has(a.id) ? deckOrder(a) - deckOrder(b) : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));

    const exchangeHands = new Set<string>();
    if (place.tags.includes('city') || whatKindOfPlace(place.name) === 'provincial capital') for (const object of state.objects ?? []) {
        if (!object.tags.includes('exchange')) continue;
        for (const entry of object.provenance) {
            const person = entry.holderId ? here.get(entry.holderId) : undefined;
            if (entry.how === 'lent' && person?.activity && entry.onDay >= person.activity.sinceDay)
                exchangeHands.add(person.id);
        }
    }
    const workers = betweenEndpoints ? new Map<PublicCounterKind, NpcRecord>() : workersAtPublicCounters(state, place.name, people, publicCountersAt(state, place.name, state.currentDay,routes), routes);
    const countersByPerson = new Map([...workers].map(([counter, person]) => [person.id, counter]));
    const kindOf = (group: NpcRecord[]): WhatAnAreaIsFor => {
        if (standingWith?.physical?.hull) return standingWith.physical.hull.areaKind;
        if (betweenEndpoints) return 'here';
        if (routines.get(group[0]!.id)!.home) return 'room';
        const counter = countersByPerson.get(group[0]!.id);
        if (counter) return counter === 'inn' ? 'table' : counter;
        // Somebody a Dao house keeps on post here works its shopfront.
        const shop = group[0]!.activity?.kind === 'stationed' ? theShopfrontOf(state, group[0]!.factionId, place) : null;
        if (shop && A_SHOPFRONT_AREA[shop.kind]) return A_SHOPFRONT_AREA[shop.kind]!;
        if (house !== null) {
            return group.some(n => n.id === watch?.id) || group.every(n => n.factionId !== house) ? 'gate' : 'forecourt';
        }
        if (!isATown(place)) return aboard ? 'deck' : 'here';
        if (group.some(n => physicianIsWorking(state, n))) return 'clinic';
        if (group.some(n => exchangeHands.has(n.id))) return 'exchange';
        const anchor = group[0]!;
        const kind = routines.get(anchor.id)!.activity?.kind;
        return (kind === undefined ? undefined : WHERE_A_THING_IS_DONE_IN_A_TOWN[kind]) ?? 'street';
    };

    // The kind of area somebody who died here was standing in, read the way the living are.
    const fallenKind = (npc: NpcRecord): WhatAnAreaIsFor => {
        if (house !== null) return npc.factionId === house ? 'forecourt' : 'gate';
        if (!isATown(place)) return aboard ? 'deck' : 'here';
        const kind = npc.activity?.kind;
        return (kind === undefined ? undefined : WHERE_A_THING_IS_DONE_IN_A_TOWN[kind]) ?? 'street';
    };

    const areas: AnAreaOfAPlace[] = [...(standingWith?.physical?.hull?.rooms ?? [])];
    const whereIs = new Map<string, string>();
    const whereBodiesAre = new Map<string, string>();
    // Quarters belong to the whole living roll, even while their holders are working or away.
    // The lodging building is shared; the holder's door and storage are separate.
    if (!betweenEndpoints && !standingWith?.physical?.hull && ['dormitory', 'residence'].includes(String(place.data.purpose)) && place.controllingFactionId) {
        const lodgings = theLodgingsOfAHouse(state, place.controllingFactionId);
        const quartered = state.npcs.filter(npc => isActing(npc.status) && npc.factionId === place.controllingFactionId
            && whichRoomARungGets(lodgings, npc.factionRankIndex)?.locationId === place.id)
            .sort((a, b) => a.id.localeCompare(b.id));
        for (const npc of quartered) {
            const room = aRoomOfTheirOwn(place, npc.id);
            room.name = `private quarters at door ${areas.length + 1}`;
            areas.push(room);
        }
    }
    for (const group of groups.filter(group => kindOf(group) === 'room')) {
        for (const npc of group) {
            const existing = areas.find(area => area.id === aRoomOfTheirOwn(place, npc.id).id);
            const room = existing ?? aRoomOfTheirOwn(place, npc.id);
            if (!existing) {
                room.name = (place.kind === 'sect_seat' || ['dormitory', 'residence'].includes(String(place.data.purpose)))
                    ? `private quarters at door ${areas.length + 1}` : `a home at door ${areas.length + 1}`;
                areas.push(room);
            }
            whereIs.set(npc.id, room.id);
        }
    }
    for (const what of (standingWith?.physical?.hull ? [standingWith.physical.hull.areaKind]
        : betweenEndpoints ? ['here' as const] : theKindsAt(state,place,now,undefined,routes))) {
        // Three other people per piece; the active party does not consume their places.
        // The watch and each person's existing draw keep their ordinary placement order.
        const pieces = groups.filter(group => kindOf(group) === what)
            .flatMap(group => {
                const pieces: NpcRecord[][] = [[]];
                for (const person of group) {
                    if (!partyIds.has(person.id) && othersIn(pieces.at(-1)!) >= AT_MOST_IN_AN_AREA) pieces.push([]);
                    pieces.at(-1)!.push(person);
                }
                return pieces.filter(piece => piece.length);
            })
            .map(piece => ({
                piece,
                hull: hullOf.get(piece[0]!.id),
                first: piece.some(n => n.id === watch?.id),
                // The same selected worker belongs at the actual service, not a random table.
                // Explicit rooms, company and accepted carriers retain their physical claim.
                counter: !betweenEndpoints && !standingWith?.physical?.hull && piece.length === 1
                    && groupOf.get(piece[0]!.id)!.length === 1
                    && !routines.get(piece[0]!.id)!.standingIn
                    ? countersByPerson.get(piece[0]!.id) : undefined,
                draw: standingWith?.physical?.hull
                    // An accepted hull has the same decks between conversational clock checks.
                    // Town routines may shuffle hourly; that does not move these passengers.
                    ? forStream(state.seed, 'which-area-of-a-place', standingWith.physical.hull.key, piece[0]!.id).next()
                    : forStream(state.seed, 'which-area-of-a-place', place.id, piece[0]!.id,
                        day, Math.floor((state.currentHour ?? 8) / 3)).next()
            }))
            .sort((a, b) => Number(b.counter !== undefined) - Number(a.counter !== undefined)
                || Number(b.first) - Number(a.first) || a.draw - b.draw);
        const total = pieces.reduce((n, p) => n + othersIn(p.piece), 0);
        const names = theNamesFor(place, what);
        // Spare space is physical room, not a quota to fill. Fallen bodies still take space.
        const fallen = state.npcs.filter(n => !isActing(n.status) && n.locationId === place.id
            && (!standingWith?.physical || standingWith.physical.accepts(n))
            && fallenKind(n) === what).sort((a, b) => a.id.localeCompare(b.id));
        const bins: NpcRecord[][] = Array.from(
            { length: Math.max(names.length, Math.ceil((total + fallen.length) / 1.5)) }, () => []);
        const heldByAHull = new Set<number>();
        for (const { piece, first, draw, hull, counter } of pieces) {
            // These candidates already share the observer's exact unfinished edge.
            // Its coarse endpoint label cannot scatter that one contact point
            // among the endpoint's ordinary named areas. Keep the existing cap.
            // Existing area catalogs put the service's primary venue first.
            const serviceBin = counter === undefined ? -1 : 0;
            const from = serviceBin >= 0 ? serviceBin
                : first || betweenEndpoints ? 0 : Math.floor(draw * bins.length);
            const at = Array.from({ length: bins.length }, (_, k) => (from + k) % bins.length)
                .find(i => !heldByAHull.has(i) && (hull ? bins[i]!.length === 0
                    : othersIn(bins[i]!) + othersIn(piece) <= AT_MOST_IN_AN_AREA));
            const chosen = at ?? bins.length;
            if (at !== undefined) bins[at]!.push(...piece);
            else bins.push([...piece]);
            if (hull) heldByAHull.add(chosen);
        }
        const fallenIn = Array.from({ length: bins.length }, () => [] as NpcRecord[]);
        for (const npc of fallen) {
            const from = forStream(state.seed, 'where-a-body-fell', place.id, npc.id).int(0, bins.length - 1);
            const at = Array.from({ length: bins.length }, (_, k) => (from + k) % bins.length)
                .find(i => !heldByAHull.has(i) && othersIn(bins[i]!) + fallenIn[i]!.length < AT_MOST_IN_AN_AREA);
            if (at !== undefined) fallenIn[at]!.push(npc);
            else { bins.push([]); fallenIn.push([npc]); }
        }
        bins.forEach((bin, i) => {
            const area = anArea(place, what, theNameAt(names, i));
            areas.push(area);
            for (const npc of bin) whereIs.set(npc.id, area.id);
            for (const npc of fallenIn[i]!) whereBodiesAre.set(npc.id, area.id);
        });
    }
    // A visit names an area explicitly; overflow stays in a public area of the same place.
    for (const npc of people) {
        const desired = routines.get(npc.id)!.standingIn;
        if (!desired || betweenEndpoints) continue;
        const area = standingWith?.physical?.hull
            ? areas.find(one => one.id === desired && (one.for === standingWith.physical!.hull!.areaKind || standingWith.physical!.hull!.rooms?.some(room => room.id === one.id)))
            : areaTheyStandIn(place, areas, desired, npc.factionId);
        if (!area) continue;
        if (!areas.some(one => one.id === area.id)) areas.push(area);
        if (partyIds.has(npc.id) || [...whereIs.entries(), ...whereBodiesAre.entries()]
            .filter(([id, at]) => !partyIds.has(id) && at === area.id).length < AT_MOST_IN_AN_AREA) {
            whereIs.set(npc.id, area.id);
        }
    }
    if (standingWith) {
        const count = (id: string) => [...whereIs.entries(), ...whereBodiesAre.entries()]
            .filter(([person, at]) => !partyIds.has(person) && at === id).length;
        const elsewhere = (from: AnAreaOfAPlace): AnAreaOfAPlace => {
            const kind = from.for === 'room' ? (house === null ? 'table' : 'forecourt') : from.for;
            const room = areas.find(area => area.for === kind && count(area.id) < AT_MOST_IN_AN_AREA);
            if (room) return room;
            const made = anArea(place, kind, theNameAt(theNamesFor(place, kind), areas.filter(area => area.for === kind).length));
            areas.push(made);
            return made;
        };
        // Visitors are placed before the observer moves, so walking to them keeps them there.
        for (const other of standingWith.others ?? []) {
            if (other.id === standingWith.id) continue;
            const desired = standingWith.physical?.hull
                ? areas.find(one => one.id === other.standingIn && (one.for === standingWith.physical!.hull!.areaKind || standingWith.physical!.hull!.rooms?.some(room => room.id === one.id)))
                    ?? areas.find(one => one.for === standingWith.physical!.hull!.areaKind)!
                : areaTheyStandIn(place, areas, other.standingIn, null);
            if (!areas.some(area => area.id === desired.id)) areas.push(desired);
            whereIs.delete(other.id);
            whereIs.set(other.id, (partyIds.has(other.id) || count(desired.id) < AT_MOST_IN_AN_AREA ? desired : elsewhere(desired)).id);
        }
        // Aboard, the hull's own area; where the hull has no area here yet, the ordinary reading.
        const aboardAt = standingWith.physical?.hull
            ? areas.find(one => one.id === standingWith.standingIn && (one.for === standingWith.physical!.hull!.areaKind || standingWith.physical!.hull!.rooms?.some(room => room.id === one.id)))
                ?? areas.find(one => one.for === standingWith.physical!.hull!.areaKind)
            : undefined;
        const at = aboardAt ?? areaTheyStandIn(place, areas, standingWith.standingIn, standingWith.sectId ?? null);
        if (!areas.some(area => area.id === at.id)) areas.push(at);
        const companions = people.filter(n => (!standingWith.physical?.hull || at.for !== 'room') && partyIds.has(n.id))
            // Following a leader cannot override this person's actual chosen hull area.
            .filter(n => !standingWith.physical?.hull || !areas.some(area =>
                area.id === routines.get(n.id)!.standingIn && (area.for === standingWith.physical!.hull!.areaKind || standingWith.physical!.hull!.rooms?.some(room => room.id === area.id))))
            .sort((a, b) => a.id.localeCompare(b.id));
        // Actual companions join the observer; the three other people keep their places.
        for (const companion of companions) {
            if (whereIs.get(companion.id) === at.id) continue;
            whereIs.set(companion.id, at.id);
        }
    }
    // A road arrives at the public entrance at every hour, including when residents sleep.
    areas.sort((a, b) => Number(a.for === 'room') - Number(b.for === 'room'));
    return { areas, whereIs, whereBodiesAre };
}

/** Everybody alive standing in this area, by id. */
export function npcsInTheArea(state: State, areaId: string): NpcRecord[] {
    const placeId = areaId.slice(0, areaId.indexOf(MARK));
    const place = state.locations.find(row => row.id === placeId);
    if (!place) return [];
    const { whereIs } = theAreasOf(state, place);
    return state.npcs
        .filter(n => isActing(n.status) && whereIs.get(n.id) === areaId)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * The area of a place somebody the play layer holds is standing in.
 *
 * `standingIn` is the area they walked to, as stored. An area of this place that has since gone
 * (fewer people, fewer areas) is the first of its kind; anything else is where a road arrives: the
 * street of a town, the forecourt of a seat for somebody of that house, and outside its gate for
 * anybody else.
 */
export function whereInThisPlaceTheyStand(
    state: State,
    place: LocationRecord,
    standingIn: string | null | undefined,
    ofTheHouse: string | null,
    readAreas?: readonly AnAreaOfAPlace[]
): AnAreaOfAPlace {
    const areas = readAreas ?? theAreasOf(state, place).areas;
    return areaTheyStandIn(place, areas, standingIn, ofTheHouse);
}

function areaTheyStandIn(
    place: LocationRecord,
    areas: readonly AnAreaOfAPlace[],
    standingIn: string | null | undefined,
    ofTheHouse: string | null
): AnAreaOfAPlace {
    const exact = areas.find(area => area.id === standingIn);
    if (exact) return exact;
    const aRoom = `${place.id}${MARK}room${MARK}`;
    if (standingIn?.startsWith(aRoom)) return aRoomOfTheirOwn(place, standingIn.slice(aRoom.length));
    const [placeId, kind] = (standingIn ?? '').split(MARK);
    const sameKind = placeId === place.id ? areas.find(area => area.for === kind) : undefined;
    if (sameKind) return sameKind;
    const house = theHouseOfTheSeat(place);
    const door = house !== null ? areas.find(area => area.for === (ofTheHouse === house ? 'forecourt' : 'gate')) : undefined;
    if (door) return door;
    // Sleeping residents are private doors, never the entrance reached by a road. Where the only
    // areas read so far are private rooms, the place's own first public area is still there.
    const open = areas.find(area => area.for !== 'room');
    if (open) return open;
    const first = theKindsOf(place).find(k => k !== 'room') ?? 'here';
    return anArea(place, first, theNamesFor(place, first)[0] ?? itsOwnName(place));
}

/**
 * Everybody in this person's area after companions and arrivals have taken room.
 */
export function npcsWhereTheyStand(
    state: State,
    place: LocationRecord,
    standingIn: string | null | undefined,
    person: { id: string; sectId?: string | null },
    others?: StandingWith['others']
): NpcRecord[] {
    const { areas, whereIs } = theAreasOf(state, place, undefined, { ...person, standingIn, others });
    const area = areaTheyStandIn(place, areas, standingIn, person.sectId ?? null);
    return state.npcs.filter(n => isActing(n.status) && n.id !== person.id && whereIs.get(n.id) === area.id)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
}
