import io
p = 'src/engine/world/what-a-house-keeps-in-its-treasury.ts'
s = io.open(p, encoding='utf-8').read()

s = s.replace(""" * ── A DEFAULT AND NOT A LAW ──────────────────────────────────────────────
 *
 * *"Good ones in the treasury (for elders to lend, you'd imagine, for example.
 * NON EXHAUSTIVE, NOT STRICT)."* This is where a thing sits when nothing has
 * happened to it. A furnace lent out, a blade taken down, a book somebody is
 * holding are all somewhere else, and `possessorId` already says so.
 */""",
""" * ── A DEFAULT AND NOT A LAW ──────────────────────────────────────────────
 *
 * *"Good ones in the treasury (for elders to lend, you'd imagine, for example.
 * NON EXHAUSTIVE, NOT STRICT)."*
 *
 * This is where the HOUSE would put a thing, and it is not where the thing is.
 * The owner: *"where an object is needs to be tracked. I should be able to
 * leave my sword in the pill refining room. Or any item, really. And it still
 * belongs to me, it's just there."*
 *
 * Which is three independent facts and the row already has three fields for
 * them: `ownerId` is whose it is, `possessorId` is who is carrying it, and
 * `locationId` is where it is when nobody is. A sword left in a furnace room is
 * an owner who has not changed, a possessor of null, and a location that is a
 * room - and no part of that needs this function's opinion. Ask
 * `whereThisThingActuallyIs` for where a thing IS; ask this only for where a
 * house files one it has never moved.
 */""")

s = s.replace("""export function whatIsInEachRoom(
    objects: readonly ObjectRecord[],
    factionId: string
): Map<RoomPurpose | null, ObjectRecord[]> {
    const rooms = new Map<RoomPurpose | null, ObjectRecord[]>();
    for (const row of whatThisHouseHolds(objects, factionId)) {
        const room = whereInTheHouseItSits(row.kind, row.significance, row.tags);
        const held = rooms.get(room) ?? [];
        held.push(row);
        rooms.set(room, held);
    }
    return rooms;
}""",
"""export function whatIsInEachRoom(
    objects: readonly ObjectRecord[],
    factionId: string
): Map<RoomPurpose | null, ObjectRecord[]> {
    const rooms = new Map<RoomPurpose | null, ObjectRecord[]>();
    for (const row of whatThisHouseHolds(objects, factionId)) {
        const room = whereInTheHouseItSits(row.kind, row.significance, row.tags);
        const held = rooms.get(room) ?? [];
        held.push(row);
        rooms.set(room, held);
    }
    return rooms;
}

/**
 * WHERE A THING ACTUALLY IS, which is not the same question as whose it is.
 *
 * The design owner: *"where an object is needs to be tracked. I should be able
 * to leave my sword in the pill refining room. Or any item, really. And it
 * still belongs to me, it's just there."*
 *
 * Three fields, three facts, and none of them implies another:
 *
 *   `ownerId`      whose it is. A sword left in somebody else's furnace room
 *                  is still yours, and this does not move when it does.
 *   `possessorId`  who is carrying it. Null is a real answer and the whole
 *                  point of this one: a thing put down is held by nobody.
 *   `locationId`   where it is when nobody is holding it. A room, and rooms
 *                  are real map locations - 706 of them in a seeded world.
 *
 * WHAT THIS RETURNS IS NEVER A GUESS. Somebody is carrying it, or it is in a
 * named place, or the world genuinely does not know where it is - which is a
 * state things get into and is the one this used to hide by falling back on
 * where the thing would have been filed.
 */
export type WhereAThingIs =
    | { at: 'on_somebody'; personId: string }
    | { at: 'in_a_place'; locationId: string; room: RoomPurpose | null }
    | { at: 'nobody_knows' };

export function whereThisThingActuallyIs(
    object: Pick<ObjectRecord, 'possessorId' | 'locationId'>,
    /** The world's locations, for naming the room a location is. */
    roomOf: (locationId: string) => RoomPurpose | null = () => null
): WhereAThingIs {
    if (object.possessorId !== null) {
        return { at: 'on_somebody', personId: object.possessorId };
    }
    if (object.locationId !== null) {
        return {
            at: 'in_a_place',
            locationId: object.locationId,
            room: roomOf(object.locationId)
        };
    }
    return { at: 'nobody_knows' };
}""")

# ── and the seeder files things into the ACTUAL room ─────────────────────
s = s.replace("""export function seedTreasuries(state: WorldState): ObjectRecord[] {
    const out: ObjectRecord[] = [];
    const today = Math.floor(state.currentDay);

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        const acting = sectThreat(house.id)?.acting ?? 0;
        if (acting <= 0) continue;

        const name = SECTS.find(s => s.id === house.id)?.name ?? house.name;
        const where = house.seatLocationId;""",
"""export function seedTreasuries(state: WorldState): ObjectRecord[] {
    const out: ObjectRecord[] = [];
    const today = Math.floor(state.currentDay);

    // THE ROOMS ARE REAL PLACES, so a thing goes in one rather than being
    // filed against the compound as a whole. A seeded world has seven hundred
    // of them under the compounds, laid out by `architecture.ts`, and putting a
    // house's clay cauldrons in its furnace room is what gives anybody a reason
    // to walk to a furnace room.
    const roomsOf = new Map<string, Map<RoomPurpose, string>>();
    for (const location of state.locations) {
        const purpose = purposeOf(location);
        if (purpose === null) continue;
        const seat = seatAbove(state, location);
        if (seat === null) continue;
        const held = roomsOf.get(seat) ?? new Map<RoomPurpose, string>();
        if (!held.has(purpose)) held.set(purpose, location.id);
        roomsOf.set(seat, held);
    }

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        const acting = sectThreat(house.id)?.acting ?? 0;
        if (acting <= 0) continue;

        const name = SECTS.find(s => s.id === house.id)?.name ?? house.name;
        const seat = house.seatLocationId;
        const rooms = seat === null ? undefined : roomsOf.get(seat);
        // The room where there is one, and the compound where the house has no
        // room of that purpose - a hill sect with no archive still owns books.
        const roomFor = (purpose: RoomPurpose | null): string | null =>
            (purpose === null ? null : rooms?.get(purpose) ?? null) ?? seat;
        const where = seat;""")

s = s.replace("""        plain.locationId = where;""",
"""        plain.locationId = roomFor(whereInTheHouseItSits('other', 'mundane', ['cauldron']));""")
s = s.replace("""                power: whatACauldronIsWorthInAFight(grade),
                locationId: where,""",
"""                power: whatACauldronIsWorthInAFight(grade),
                locationId: roomFor(
                    whereInTheHouseItSits('artifact', howMuchACauldronIsWorthTracking(grade), ['cauldron'])
                ),""")
s = s.replace("""        out.push(...whatElseTheHouseKeeps(house.id, name, where, acting, today));""",
"""        out.push(...whatElseTheHouseKeeps(house.id, name, roomFor, acting, today));""")

s = s.replace("""function whatElseTheHouseKeeps(
    houseId: string,
    houseName: string,
    where: string | null,
    acting: number,
    today: number
): ObjectRecord[] {""",
"""function whatElseTheHouseKeeps(
    houseId: string,
    houseName: string,
    roomFor: (purpose: RoomPurpose | null) => string | null,
    acting: number,
    today: number
): ObjectRecord[] {""")
s = s.replace("""            lot.locationId = where;
            lot.tags = [thing.kind, `grade:${thing.grade}`];""",
"""            lot.locationId = roomFor(whereInTheHouseItSits(thing.kind, significance));
            lot.tags = [thing.kind, `grade:${thing.grade}`];""")
s = s.replace("""            power: null,
            locationId: where,
            tags: [thing.kind, `grade:${thing.grade}`],""",
"""            power: null,
            locationId: roomFor(whereInTheHouseItSits(thing.kind, significance)),
            tags: [thing.kind, `grade:${thing.grade}`],""")

s = s.replace("import type { RoomPurpose } from './architecture.js';",
              "import { purposeOf, type RoomPurpose } from './architecture.js';")

s += """
/**
 * The compound a room is under, walking up as far as a seat.
 *
 * Rooms hang off precincts and precincts off the seat, so a room is two links
 * down and not one. Bounded rather than recursive-until-null: a cycle in the
 * parent chain would otherwise hang the seeder, and no location is more than a
 * few links from its region.
 */
function seatAbove(state: WorldState, from: { id: string; parentId: string | null }): string | null {
    let at: string | null = from.parentId;
    for (let hops = 0; hops < HOW_FAR_UP_A_ROOM_SITS && at !== null; hops++) {
        const parent = state.locations.find(l => l.id === at);
        if (parent === undefined) return null;
        if (parent.kind === 'sect_seat') return parent.id;
        at = parent.parentId;
    }
    return null;
}

/** Room, precinct, seat. Three links is the whole of a compound. */
const HOW_FAR_UP_A_ROOM_SITS = 3;
"""
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
