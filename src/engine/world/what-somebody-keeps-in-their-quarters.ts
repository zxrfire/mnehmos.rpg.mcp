/**
 * A person's room holds actual things, independently of where that person works.
 * The house/person holder is the stored fact; rank decides where it stands today.
 * Putting something away changes possession and place, never ownership or wealth.
 */
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';
import { indexById } from './world-state.js';
import type { readDeathsTogether } from './reading-the-estates-settled-together.js';
import { hadAs, isHeld, isWorn, type ObjectRecord } from './possessions.js';
import { theLodgingsOfAHouse, whereAHouseLetsYouKeepThings, whichRoomARungGets,
    howMuchRoomAQuartersHas } from './the-room-a-house-gives-you.js';
import { whatABodyCanCarry, whatStopsThemCarryingIt } from './what-a-body-can-carry-and-what-a-ring-holds.js';
import { whatTheirThingsTake } from './what-somebody-is-carrying-takes.js';
import { canReachInto, putIntoTheRing } from './a-storage-ring.js';
import { isSomethingYouWouldSwing } from './possessions.js';
import { SECTS } from '../../data/cultivation/sects.js';
import { aUniformFor } from './a-recruit-is-given-their-lamp-at-the-house.js';
import { isAStackOfCommunicationTalismans } from './a-communication-talisman-carries-word-home.js';
import { locationOnNpcJourney } from './places-on-the-way.js';

export interface QuartersHolding {
    personId: string;
    factionId: string;
    locationId: string;
    areaId: string;
}

/** One ephemeral projection per scene or housekeeping pass; never kept in world state. */
export function readQuartersTogether(state: WorldState) {
    const people = new Map(state.npcs.map(npc => [npc.id, npc]));
    const peoplePlaces = new Map(state.npcs.map(npc => [npc.id,
        locationOnNpcJourney(state.locations, npc, state.currentDay)]));
    const locations = new Map(state.locations.map(place => [place.id, place]));
    const rooms = new Map<string, ReturnType<typeof theLodgingsOfAHouse>>();
    const roomByHolder = new Map<string, QuartersHolding>();
    for (const npc of state.npcs) {
        if (npc.factionId === null || npc.factionRankIndex < 0) continue;
        let lodgings = rooms.get(npc.factionId);
        if (lodgings === undefined) {
            lodgings = theLodgingsOfAHouse(state, npc.factionId);
            rooms.set(npc.factionId, lodgings);
        }
        const room = whichRoomARungGets(lodgings, npc.factionRankIndex);
        if (room !== null) roomByHolder.set(whereAHouseLetsYouKeepThings(npc.factionId, npc.id), {
            personId: npc.id, factionId: npc.factionId, locationId: room.locationId,
            areaId: `${room.locationId}#room#${npc.id}`
        });
    }
    const objects = new Map<string, ObjectRecord>();
    const positions = new Map<string, number>();
    const holders = new Map<string, Set<string>>();
    const moved = (before: ObjectRecord | undefined, after: ObjectRecord, at: number) => {
        if (before?.possessorId) holders.get(before.possessorId)?.delete(before.id);
        objects.set(after.id, after);
        positions.set(after.id, at);
        if (after.possessorId !== null) {
            const held = holders.get(after.possessorId) ?? new Set<string>();
            held.add(after.id);
            holders.set(after.possessorId, held);
        }
    };
    state.objects.forEach((object, at) => moved(undefined, object, at));
    return { people, peoplePlaces, locations, roomByHolder, objects, positions, holders, moved,
        carrying: (holder: string) => [...holders.get(holder) ?? []].map(id => objects.get(id)!) };
}
type QuartersRead = ReturnType<typeof readQuartersTogether>;

/** No key splitting: authored ids may themselves contain colons. */
export function quartersHolding(state: WorldState, holderId: string, read?: QuartersRead): QuartersHolding | null {
    if (read) return read.roomByHolder.get(holderId) ?? null;
    for (const npc of state.npcs) {
        if (npc.factionId === null || npc.factionRankIndex < 0) continue;
        if (holderId !== whereAHouseLetsYouKeepThings(npc.factionId, npc.id)) continue;
        const lodging = whichRoomARungGets(theLodgingsOfAHouse(state, npc.factionId), npc.factionRankIndex);
        if (lodging === null) return null;
        return { personId: npc.id, factionId: npc.factionId, locationId: lodging.locationId,
            areaId: `${lodging.locationId}#room#${npc.id}` };
    }
    return null;
}

/** Stored goods follow their holder's promotion; a nested container follows its holder. */
export function physicalObjectPlace(state: WorldState, object: ObjectRecord,
    read = readQuartersTogether(state)): {
    locationId: string; areaId: string | null;
} | null {
    let current = object;
    const visited = new Set<string>();
    while (!visited.has(current.id)) {
        visited.add(current.id);
        if (current.possessorId !== null) {
            const room = quartersHolding(state, current.possessorId, read);
            if (room !== null) return room;
            const person = read.people.get(current.possessorId);
            if (person !== undefined) {
                const place = read.peoplePlaces.get(person.id) ?? null;
                return place === null ? null : { locationId: place, areaId: null };
            }
            const container = read.objects.get(current.possessorId);
            if (container !== undefined) { current = container; continue; }
        }
        return current.locationId === null ? null : { locationId: current.locationId,
            areaId: typeof current.data.areaId === 'string' ? current.data.areaId : null };
    }
    return null;
}

/** Goods left behind are not goods carried by the corpse. Leave them on their own ground. */
export function releaseTheirQuartersAtDeath(state: WorldState, deceased: NpcRecord,
    read?: ReturnType<typeof readDeathsTogether>): number {
    if (deceased.factionId === null) return 0;
    const holder = whereAHouseLetsYouKeepThings(deceased.factionId, deceased.id);
    const room = quartersHolding(state, holder);
    let released = 0;
    for (const object of read?.carrying(holder) ?? state.objects.slice()) {
        if (object.possessorId !== holder) continue;
        const releasedObject = { ...object, possessorId: null,
            locationId: room?.locationId ?? object.locationId,
            // Once the allotment is vacated these remain in the lodging, not
            // an inaccessible private area that only exists for living members.
            data: { ...object.data, areaId: null } };
        read?.moved(object, releasedObject);
        state.objects[indexById(state.objects, object.id)] = releasedObject;
        released++;
    }
    return released;
}

/** On departure the house hands back what the person left, even if the pack is now heavy. */
export function handBackTheirQuarters(state: WorldState, personId: string, factionId: string,
    read = readQuartersTogether(state)): number {
    const holder = whereAHouseLetsYouKeepThings(factionId, personId);
    let handed = 0;
    for (const object of read.carrying(holder)) {
        const at = read.positions.get(object.id)!;
        const returned = { ...hadAs(object, 'inventory'), possessorId: personId, locationId: null };
        read.moved(object, returned, at);
        state.objects[at] = returned;
        handed++;
    }
    return handed;
}

/** Membership can change through any door; vacated personal holders never become traps. */
export function handBackVacatedQuarters(state: WorldState): number {
    const read = readQuartersTogether(state);
    let handed = 0;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        for (const house of state.factions) {
            if (npc.factionId === house.id && house.dissolvedOnDay === null) continue;
            if (read.holders.has(whereAHouseLetsYouKeepThings(house.id, npc.id))) {
                handed += handBackTheirQuarters(state, npc.id, house.id, read);
            }
        }
    }
    return handed;
}

/**
 * The same infinite robe issue gives a member a change of clothes. It is a
 * mundane house-owned thing, not a minted treasure or a withdrawal of pills.
 * Its stable id is checked wherever it ended up: looking again cannot replace
 * a stolen change of robes in somebody else's hands.
 */
export function keepTheirQuartersInOrder(state: WorldState, onDay: number, opening = false): number {
    const read = readQuartersTogether(state);
    const houses = new Map(state.factions.filter(house => house.dissolvedOnDay === null).map(house => [house.id, house]));
    let issued = 0;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId === null || npc.factionRankIndex < 0
            || (!opening && !atTheirHouse(state, npc, read))) continue;
        const house = houses.get(npc.factionId);
        if (house === undefined) continue;
        const room = quartersHolding(state, whereAHouseLetsYouKeepThings(house.id, npc.id), read);
        if (room === null) continue;
        const change = aUniformFor({ memberId: npc.id, houseId: house.id, houseName: house.name,
            onDay, spare: true });
        if (read.objects.has(change.id)) continue;
        const issuedChange = { ...change, possessorId: whereAHouseLetsYouKeepThings(house.id, npc.id),
            locationId: room.locationId };
        read.moved(undefined, issuedChange, state.objects.length);
        state.objects.push(issuedChange);
        issued++;
    }
    return issued + putAwayWhatTheyDoNotCarry(state, read);
}

/** Only an actual body on its house's ground can put its carried things in its room. */
function atTheirHouse(state: WorldState, npc: NpcRecord, read?: QuartersRead): boolean {
    let place = read ? read.peoplePlaces.get(npc.id) ?? null
        : locationOnNpcJourney(state.locations, npc, state.currentDay);
    const seen = new Set<string>();
    while (place !== null && !seen.has(place)) {
        seen.add(place);
        const row = read ? read.locations.get(place) : state.locations.find(location => location.id === place);
        if (row === undefined) return false;
        if (row.controllingFactionId === npc.factionId) return true;
        place = row.parentId;
    }
    return false;
}

/**
 * Reserve copies and carried overflow go home. Worn gear, hands, proof of
 * membership and communication stay ready; one usable weapon stays with them.
 * The ring takes travel overflow first, and has its ordinary volume limit.
 * No finite item is created here and no thing moves from a remote body.
 */
export function putAwayWhatTheyDoNotCarry(state: WorldState, read = readQuartersTogether(state)): number {
    let moved = 0;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId === null || npc.factionRankIndex < 0
            || !atTheirHouse(state, npc, read)) continue;
        const holder = whereAHouseLetsYouKeepThings(npc.factionId, npc.id);
        const room = quartersHolding(state, holder, read);
        if (room === null) continue;
        const catalog = SECTS.find(house => house.id === npc.factionId);
        const capacity = howMuchRoomAQuartersHas(catalog?.stipend[npc.factionRankIndex] ?? 0,
            catalog?.stipend[0] ?? 0);
        let stored = read.carrying(holder)
            .reduce((sum, object) => sum + object.volume, 0);
        const carried = read.carrying(npc.id);
        const rings = carried.filter(object => canReachInto(object, npc.id));
        const weapon = carried.filter(object => isSomethingYouWouldSwing(object))
            .sort((a, b) => Number(isWorn(b) || isHeld(b)) - Number(isWorn(a) || isHeld(a))
                || (b.power ?? -1) - (a.power ?? -1))[0];
        const copies = new Set<string>();
        for (const object of carried) {
            const copy = `${object.kind}:${object.data.catalogId ?? object.name}`;
            const spare = copies.has(copy);
            copies.add(copy);
            if (isWorn(object) || isHeld(object) || object.id === weapon?.id
                || object.kind === 'token' || object.kind === 'key'
                || isAStackOfCommunicationTalismans(object)
                || object.tags.includes('long-range-communication') || object.tags.includes('long-range-communication-twin')
                || object.tags.includes('communication-jade') || object.tags.includes('storage-ring')
                || object.tags.includes('never-carried') || object.tags.includes('conveyance')
                || object.kind === 'formation' || object.kind === 'territory') continue;
            const overflow = whatStopsThemCarryingIt(whatTheirThingsTake(read.carrying(npc.id), npc.id),
                whatABodyCanCarry(npc.cultivation.realmOrdinal)) !== null;
            if (!spare && !overflow) continue;
            if (!spare && rings.some(ring => putIntoTheRing(state.objects, npc.id, ring, object) === 'stored')) {
                const at = read.positions.get(object.id)!;
                read.moved(object, state.objects[at]!, at);
                moved++; continue;
            }
            if (stored + object.volume > capacity) continue;
            const at = read.positions.get(object.id)!;
            const storedObject = { ...hadAs(object, 'inventory'), possessorId: holder, locationId: room.locationId };
            read.moved(object, storedObject, at);
            state.objects[at] = storedObject;
            stored += object.volume;
            moved++;
        }
    }
    return moved;
}
