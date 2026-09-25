/**
 * Which area of a place somebody is standing in, and no area holds more than three.
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
 *   anywhere else  one kind
 *
 * and each kind has as few areas as hold its people three at a time, the dead who fell there
 * counted. Each person stands in the area a draw of their own points at, or the next with room, so
 * a death pulls nobody across from elsewhere. People in one activity together
 * (`withIds`) are kept in one area. The draw is on its own stream, so nothing else moves. Nothing
 * writes an area: a new activity is a new reading.
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
import { isAwayOnSomething, PLAYER_ROW_TAG, type ActivityKind, type NpcRecord } from './npc-state.js';
import type { LocationRecord } from './locations.js';
import type { WorldState } from './world-state.js';
import {
    npcsStandingIn,
    npcsWithin,
    whereCompoundsAre,
    type WhereCompoundsAre
} from './where-inside-a-house-somebody-is-standing.js';

/** The owner's ceiling: three of the world's people to an area. */
export const AT_MOST_IN_AN_AREA = 3;

/** What an area of a place is for. */
export type WhatAnAreaIsFor = 'street' | 'market' | 'table' | 'gate' | 'forecourt' | 'board' | 'here' | 'room';

export interface AnAreaOfAPlace {
    /** `<place id>#<kind>#<slug>`. */
    id: string;
    placeId: string;
    /** Its own name, as a player would say it: `the cloth row`. */
    name: string;
    for: WhatAnAreaIsFor;
}

type State = Pick<WorldState, 'seed' | 'currentDay' | 'locations' | 'npcs' | 'factions'>;

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

/** The kinds of area a place has, the one a road arrives in first. */
function theKindsOf(place: Pick<LocationRecord, 'kind' | 'data' | 'controllingFactionId'>): WhatAnAreaIsFor[] {
    if (isATown(place)) return ['street', 'market', 'table'];
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
        case 'table': return town.table;
        case 'gate': return OUTSIDE_THE_GATE;
        case 'forecourt': return THE_FORECOURT;
        case 'board': return THE_MISSION_BOARD;
        case 'here': {
            const own = itsOwnName(place);
            return [own, `the far side of ${own}`, `further along ${own}`, `the edge of ${own}`];
        }
        // Nobody is dealt into a room somebody paid for; see `aRoomOfTheirOwn`.
        case 'room': return [];
    }
}

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

/**
 * A room somebody has paid for at an inn here, as an area of the place: nobody is dealt into it,
 * so standing in it is standing alone but for whoever is with them. The owner: "go to your room,
 * sleep ... in the room is just yourself (unless ur with a party)". Its id carries the holder,
 * so two lodgers are never in each other's room. Null for any other id.
 */
export function aRoomOfTheirOwn(place: Pick<LocationRecord, 'id' | 'kind'>, holderId: string): AnAreaOfAPlace {
    // The owner: a room is an area "at an inn (or in your sect, or a cave)". A cave
    // of their own is the whole place and needs no area inside it.
    const name = place.kind === 'sect_seat' ? 'your quarters' : 'your room at the inn';
    return { id: `${place.id}${MARK}room${MARK}${holderId}`, placeId: place.id, name, for: 'room' };
}

/** Whether an activity is still running on this day. */
function stillAtIt(npc: NpcRecord, day: number): boolean {
    const at = npc.activity;
    return at !== null && (at.untilDay === null || at.untilDay === undefined || at.untilDay >= day);
}

/**
 * Who is on watch at a house's gate: of the house's own the compound read leaves at its seat, the
 * lowest rung, then the lowest id. Null where none of them is there, and then the gate is shut.
 */
export function theOneOnWatchAtTheGate(
    state: State,
    seat: Pick<LocationRecord, 'id' | 'kind' | 'data' | 'controllingFactionId'>,
    compounds: WhereCompoundsAre = whereCompoundsAre(state)
): NpcRecord | null {
    const house = theHouseOfTheSeat(seat);
    if (house === null) return null;
    return npcsStandingIn(state, seat.id, compounds)
        .filter(n => n.factionId === house && !(n.activity !== null && isAwayOnSomething(n.activity.kind)))
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
    compounds: WhereCompoundsAre = whereCompoundsAre(state)
): APlaceReadIntoAreas {
    const day = Math.floor(state.currentDay);
    // WITH THE ONE BEING PLAYED, whose row stands nowhere, is with them wherever they walked, and
    // takes no room in an area (`npcsWhereTheyStand` adds them).
    const nowhere = new Set(state.npcs.filter(n => n.tags.includes(PLAYER_ROW_TAG)).map(n => n.id));
    const people = npcsStandingIn(state, place.id, compounds)
        .filter(n => !(stillAtIt(n, day) && n.activity!.withIds.some(id => nowhere.has(id))));
    const here = new Map(people.map(n => [n.id, n]));
    const house = theHouseOfTheSeat(place);
    const watch = house === null ? null : theOneOnWatchAtTheGate(state, place, compounds);

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
            if (!stillAtIt(one, day)) continue;
            for (const id of one.activity!.withIds) {
                const other = here.get(id);
                if (other && !groupOf.has(other.id)) queue.push(other);
            }
        }
    }
    const groups = [...new Set(groupOf.values())].map(group => group.sort((a, b) => (a.id < b.id ? -1 : 1)));

    const kindOf = (group: NpcRecord[]): WhatAnAreaIsFor => {
        if (house !== null) {
            return group.some(n => n.id === watch?.id) || group.every(n => n.factionId !== house) ? 'gate' : 'forecourt';
        }
        if (!isATown(place)) return 'here';
        const anchor = group[0]!;
        const kind = stillAtIt(anchor, day) ? anchor.activity!.kind : undefined;
        return (kind === undefined ? undefined : WHERE_A_THING_IS_DONE_IN_A_TOWN[kind]) ?? 'street';
    };

    // The kind of area somebody who died here was standing in, read the way the living are.
    const fallenKind = (npc: NpcRecord): WhatAnAreaIsFor => {
        if (house !== null) return npc.factionId === house ? 'forecourt' : 'gate';
        if (!isATown(place)) return 'here';
        const kind = npc.activity?.kind;
        return (kind === undefined ? undefined : WHERE_A_THING_IS_DONE_IN_A_TOWN[kind]) ?? 'street';
    };

    const areas: AnAreaOfAPlace[] = [];
    const whereIs = new Map<string, string>();
    for (const what of theKindsOf(place)) {
        // Anybody bigger than an area is taken three at a time; then in the order of a draw per
        // person on its own stream, the one on watch first so the gate a road reaches has them.
        const pieces = groups.filter(group => kindOf(group) === what)
            .flatMap(group => Array.from({ length: Math.ceil(group.length / AT_MOST_IN_AN_AREA) },
                (_, i) => group.slice(i * AT_MOST_IN_AN_AREA, (i + 1) * AT_MOST_IN_AN_AREA)))
            .map(piece => ({
                piece,
                first: piece.some(n => n.id === watch?.id),
                draw: forStream(state.seed, 'which-area-of-a-place', place.id, piece[0]!.id).next()
            }))
            .sort((a, b) => Number(b.first) - Number(a.first) || a.draw - b.draw);
        const total = pieces.reduce((n, p) => n + p.piece.length, 0);
        const names = theNamesFor(place, what);
        // AS FEW AREAS AS HOLD THEM, counting the dead who fell here: each piece goes to the area
        // its own draw points at, or the next one with room. A death leaves the count and so every
        // other draw where it was: kill the three in front of you and the room is empty, not
        // refilled from across the square.
        const fallen = state.npcs.filter(n => n.status !== 'alive' && n.locationId === place.id
            && fallenKind(n) === what).length;
        const bins: NpcRecord[][] = Array.from(
            { length: Math.max(1, Math.ceil((total + fallen) / AT_MOST_IN_AN_AREA)) }, () => []);
        for (const { piece, first, draw } of pieces) {
            const from = first ? 0 : Math.floor(draw * bins.length);
            const at = Array.from({ length: bins.length }, (_, k) => (from + k) % bins.length)
                .find(i => bins[i]!.length + piece.length <= AT_MOST_IN_AN_AREA);
            if (at !== undefined) bins[at]!.push(...piece);
            else bins.push([...piece]);
        }
        bins.forEach((bin, i) => {
            const area = anArea(place, what, theNameAt(names, i));
            areas.push(area);
            for (const npc of bin) whereIs.set(npc.id, area.id);
        });
    }
    return { areas, whereIs };
}

/** Everybody alive standing in this area, by id. */
export function npcsInTheArea(state: State, areaId: string): NpcRecord[] {
    const placeId = areaId.slice(0, areaId.indexOf(MARK));
    const place = state.locations.find(row => row.id === placeId);
    if (!place) return [];
    const { whereIs } = theAreasOf(state, place);
    return state.npcs
        .filter(n => whereIs.get(n.id) === areaId)
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
    ofTheHouse: string | null
): AnAreaOfAPlace {
    const { areas } = theAreasOf(state, place);
    const exact = areas.find(area => area.id === standingIn);
    if (exact) return exact;
    const aRoom = `${place.id}${MARK}room${MARK}`;
    if (standingIn?.startsWith(aRoom)) return aRoomOfTheirOwn(place, standingIn.slice(aRoom.length));
    const [placeId, kind] = (standingIn ?? '').split(MARK);
    const sameKind = placeId === place.id ? areas.find(area => area.for === kind) : undefined;
    if (sameKind) return sameKind;
    const house = theHouseOfTheSeat(place);
    if (house !== null) return areas.find(area => area.for === (ofTheHouse === house ? 'forecourt' : 'gate'))!;
    return areas[0]!;
}

/**
 * Everybody standing with somebody the play layer holds: the area of the place they are in, and
 * anybody at this place whose activity names them, who is with them wherever they walked.
 */
export function npcsWhereTheyStand(
    state: State,
    place: LocationRecord,
    standingIn: string | null | undefined,
    person: { id: string; sectId?: string | null }
): NpcRecord[] {
    const area = whereInThisPlaceTheyStand(state, place, standingIn, person.sectId ?? null);
    const day = Math.floor(state.currentDay);
    const inRow = new Set(npcsStandingIn(state, place.id).map(n => n.id));
    const withThem = state.npcs.filter(n => inRow.has(n.id) && stillAtIt(n, day) && n.activity!.withIds.includes(person.id));
    const byId = new Map([...npcsInTheArea(state, area.id), ...withThem].map(n => [n.id, n]));
    return [...byId.values()].filter(n => n.id !== person.id).sort((a, b) => (a.id < b.id ? -1 : 1));
}
