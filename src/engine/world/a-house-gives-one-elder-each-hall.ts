import { theOneIdAPersonIsKnownBy } from './a-catalog-person-and-their-world-row.js';
/** One hall head is read from existing office claims and the ordinary chair order. */
import { elderRungOf } from '../cultivation/leadership.js';
import { theRoomsThisHouseHas } from '../social-leverage/authority-for-an-order.js';
import { whoIsInChargeOfWhat } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { whoDecidesIn } from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import { byStanding, meritNeededFor } from './promotion-inside-a-house.js';
import { hallForRoom, hallsForRooms, type HouseHall } from './house-halls.js';
import { purposeOf as purposeOfRoom, roomAuthorityOf, type RoomPurpose } from './architecture.js';
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import type { LocationRecord } from './locations.js';
import type { OnTheRoll } from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';

export interface HallResponsibility {
    hall: HouseHall;
    holderId: string | null;
    /** Existing office claimants retain their elder seats, including those not heading this hall. */
    existingClaimants: readonly string[];
    room: RoomPurpose;
    covering: boolean;
}

/** Pure: no member is promoted, demoted or moved by reading the halls. */
export function hallResponsibilities(state: Pick<WorldState, 'locations' | 'npcs' | 'factions'>,
    houseId: string): HallResponsibility[] {
    const house = state.factions.find(row => row.id === houseId && row.dissolvedOnDay === null);
    if (!house) return [];
    const members = state.npcs.filter(person => person.status === 'alive' && person.factionId === houseId);
    const roll = members.map(person => ({ id: person.id, rankIndex: person.factionRankIndex }));
    return responsibilitiesFor({ rooms: theRoomsThisHouseHas(state.locations, house.id),
        sectId: house.id, roll, rankCount: house.ranks.length, npcs: members, locations: state.locations });
}

/** The supplied roll remains authoritative, including a SQL player's actual seat. */
export function responsibilitiesFor(input: { rooms: readonly RoomPurpose[]; sectId: string;
    roll: readonly OnTheRoll[]; rankCount: number; npcs: readonly NpcRecord[];
    locations?: readonly LocationRecord[] }): HallResponsibility[] {
    const { rooms, roll } = input;
    const deciders = whoDecidesIn({ roll, rankCount: input.rankCount });
    const records = new Map<string, NpcRecord>();
    for (const person of input.npcs) {
        records.set(person.id, person);
        records.set(theOneIdAPersonIsKnownBy(person.id), person);
    }
    const needed = meritNeededFor(elderRungOf(input.rankCount));
    const people = { memberIds: new Set(roll.flatMap(person => {
        const actual = records.get(person.id);
        return actual ? [person.id, actual.id, theOneIdAPersonIsKnownBy(actual.id)] : [person.id];
    })) };
    const chairs = deciders.map(person => person.id).sort((a, b) => {
        const first = records.get(a), second = records.get(b);
        return first && second ? byStanding(first, second, input.sectId, needed, people) : 0;
    });
    // The built room order preserves founding draws. An office appended after
    // the lamp hall must not enter the earlier office round.
    const lampAt = rooms.indexOf('life_lamp_hall');
    const former = rooms.filter((room, at) => lampAt < 0 || at <= lampAt || !roomAuthorityOf(room).office);
    const legacy = whoIsInChargeOfWhat({ rooms: former, roll, rankCount: input.rankCount });
    const claims = new Set(legacy.flatMap(portfolio => portfolio.holderId ? [portfolio.holderId] : []));
    const present = hallsForRooms(rooms);
    const responsibilities = present.map(hall => {
        const held = legacy.filter(portfolio => hallForRoom(portfolio.purpose)?.id === hall.id);
        const ids = [...new Set(held.flatMap(portfolio => portfolio.holderId ? [portfolio.holderId] : []))];
        const appointment = input.locations?.find(room => room.data.factionId === input.sectId
            && room.data.hallOfficeId === hall.id);
        const incumbent = appointment?.data.hallHolderId;
        const chairFor = (id: string) => chairs.find(chair => theOneIdAPersonIsKnownBy(chair) === theOneIdAPersonIsKnownBy(id));
        const incumbentChair = typeof incumbent === 'string' ? chairFor(incumbent) : undefined;
        const formerClaimants = appointment?.data.hallClaimantIds;
        const claimants = typeof formerClaimants === 'string'
            ? formerClaimants.split('\n').flatMap(id => { const chair = chairFor(id); return chair ? [chair] : []; }) : ids;
        const holder = incumbentChair ?? chairs.find(id => claimants.includes(id)) ?? chairs.find(id => ids.includes(id));
        const anchor = (appointment ? purposeOfRoom(appointment) : null)
            ?? held.find(portfolio => portfolio.holderId === holder)?.purpose
            ?? hall.rooms.find(room => rooms.includes(room))!;
        return { hall, holderId: holder ?? null, existingClaimants: claimants,
            room: anchor, covering: incumbentChair === holder && typeof appointment?.data.hallCovering === 'boolean'
                ? appointment.data.hallCovering : holder !== undefined
                    && !held.some(portfolio => portfolio.holderId === holder && !portfolio.actingId) };
    });
    const free = chairs.filter(id => !claims.has(id));
    const heads = chairs.filter(id => responsibilities.some(hall => hall.holderId === id));
    const pool = free.length ? free : heads.length ? heads : chairs;
    let at = 0;
    for (const responsibility of responsibilities) {
        if (responsibility.holderId !== null || pool.length === 0) continue;
        responsibility.holderId = pool[at % pool.length]!;
        responsibility.covering = free.length === 0 || at >= free.length;
        at++;
    }
    return responsibilities;
}

/** The appointment is kept once in its responsible room; adding people does not re-deal it. */
export function keepTheHallChairs(state: Pick<WorldState, 'locations' | 'npcs' | 'factions'>, houseId: string): void {
    for (const responsibility of hallResponsibilities(state, houseId)) {
        const room = state.locations.find(row => row.data.factionId === houseId
            && row.data.hallOfficeId === responsibility.hall.id)
            ?? state.locations.find(row => row.data.factionId === houseId && purposeOfRoom(row) === responsibility.room);
        if (!room) continue;
        room.data.hallOfficeId = responsibility.hall.id;
        room.data.hallHolderId = responsibility.holderId;
        room.data.hallCovering = responsibility.covering;
        room.data.hallClaimantIds = responsibility.existingClaimants.join('\n');
    }
}
