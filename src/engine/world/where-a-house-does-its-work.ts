/** House work uses its dedicated room or suitable ordinary ground already in the compound. */
import { CELL_HOLDING_INTEGRITY, purposeOf, type RoomPurpose } from './architecture.js';
import type { LocationRecord } from './locations.js';
import type { WorldState } from './world-state.js';

/** Physical prerequisites are not supplied by assigning ordinary house work. */
const NEEDS_ITS_OWN_GROUND = new Set<RoomPurpose>([
    'vein_chamber', 'tribute_room', 'alchemy_hall', 'furnace_room',
    'artifact_refining_hall', 'workshop', 'formation_node'
]);

/** Read institutional craft support from the rooms the house was founded with. */
export function housesWithACraftHall(locations: readonly LocationRecord[],
    purpose: 'alchemy_hall' | 'artifact_refining_hall'): Set<string> {
    const houses = new Set<string>();
    for (const room of locations) {
        if (purposeOf(room) !== purpose) continue;
        const houseId = room.data.factionId ?? room.controllingFactionId;
        if (typeof houseId === 'string') houses.add(houseId);
    }
    return houses;
}

export function roomForHouseWork(locations: readonly LocationRecord[], houseId: string,
    work: RoomPurpose): LocationRecord | null {
    const rooms = locations.filter(room => room.data.factionId === houseId
        || room.controllingFactionId === houseId);
    const dedicated = rooms.find(room => purposeOf(room) === work);
    if (dedicated || NEEDS_ITS_OWN_GROUND.has(work)) return dedicated ?? null;
    const ordinary: readonly RoomPurpose[] = work === 'infirmary' ? ['dormitory', 'residence']
        : work === 'archive' ? ['scripture_pavilion', 'residence']
        : work === 'scripture_pavilion' ? ['archive', 'residence']
        : work === 'audience_hall' || work === 'mission_hall' ? ['forecourt', 'gatehouse', 'residence']
        : work === 'refectory' ? ['dormitory', 'residence'] : ['residence', 'dormitory'];
    for (const purpose of ordinary) {
        const room = rooms.filter(candidate => purposeOf(candidate) === purpose)
            .sort((a, b) => Number(a.data.precinctIndex ?? 0) - Number(b.data.precinctIndex ?? 0)
                || a.id.localeCompare(b.id))[0];
        if (room) return room;
    }
    return null;
}

export function nameOfTheCareRoom(room: LocationRecord): string {
    return purposeOf(room) === 'infirmary' ? room.name
        : `a room in ${room.name} set aside for the wounded`;
}

/** Hearing a charge needs a room; holding a cultivator also needs working arrays. */
export function theHouseHasHoldingCells(state: Pick<WorldState, 'locations' | 'factions'>, houseId: string): boolean {
    const house = state.factions.find(row => row.id === houseId);
    const seat = state.locations.find(room => room.id === house?.seatLocationId);
    const total = Number(seat?.data.formationNodesTotal ?? 0);
    const lit = Number(seat?.data.formationNodesLit ?? 0);
    return total > 0 && lit / total >= CELL_HOLDING_INTEGRITY
        && state.locations.some(room => room.data.factionId === houseId && purposeOf(room) === 'punishment_hall');
}
