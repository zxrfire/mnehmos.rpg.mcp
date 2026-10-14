/** Deep institutions keep more actual hands and elders; their existing chairs do not multiply. */
import { REALM_TIERS } from '../cultivation/realms.js';
import { STONES_PER_YEAR_OF_SECLUSION } from '../cultivation/origin.js';
import { purposeOf } from './architecture.js';
import { hallsForRooms } from './house-halls.js';
import type { WorldState } from './world-state.js';

/** The existing upper mortal realm is the standing needed for an institutional reserve. */
export const A_DEEP_INSTITUTIONS_STANDING = REALM_TIERS.find(realm => realm.key === 'tribulation_transcendence')!.ordinalStart;

export function hallStaffingDepth(state: Pick<WorldState, 'factions'>, houseId: string): number {
    const house = state.factions.find(row => row.id === houseId && row.dissolvedOnDay === null);
    const power = house?.resources.power_ordinal ?? 0;
    if (!house || power < A_DEEP_INSTITUTIONS_STANDING) return 1;
    const depth = 1 + Math.floor(power / A_DEEP_INSTITUTIONS_STANDING);
    return (house.resources.spirit_stones ?? 0) >= depth * STONES_PER_YEAR_OF_SECLUSION ? depth : 1;
}

/** A posted complement, a practice complement, and elders beyond the hall chairs. */
export function theRollItsHallsNeed(state: Pick<WorldState, 'factions' | 'locations'>, houseId: string): { people: number; elders: number } {
    const depth = hallStaffingDepth(state, houseId);
    if (depth === 1) return { people: 0, elders: 0 };
    const rooms = state.locations.filter(room => room.data.factionId === houseId).flatMap(room => {
        const purpose = purposeOf(room); return purpose ? [purpose] : [];
    });
    const halls = hallsForRooms(rooms);
    const work = halls.reduce((sum, hall) => sum + depth + (hall.posts?.length ?? 0) + (hall.chores ? 1 : 0), 0);
    const elders = halls.length + depth;
    return { people: 2 * work + elders, elders };
}
