/** The house's counted and tracked craft, read from the yard it owns now. */
import { CARRIAGES_BY_GRADE, countedHolding, getConveyance, requireConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import type { Conveyance } from './what-a-conveyance-does-to-a-journey.js';
import { isRuined } from './possessions.js';
import { whereItStands, whoItIsWith } from './a-vehicle.js';
import type { FactionRecord, WorldState } from './world-state.js';

export function whatThisHouseCouldTakeOut(state: WorldState, faction: FactionRecord):
    { conveyance: Conveyance; power: number | null; rowId?: string }[] {
    const out: { conveyance: Conveyance; power: number | null; rowId?: string }[] = [];
    for (const id of CARRIAGES_BY_GRADE) {
        if (countedHolding(faction.resources, id) > 0) {
            out.push({ conveyance: requireConveyance(id), power: null });
        }
    }
    for (const thing of state.objects) {
        if (thing.ownerId !== faction.id || isRuined(thing)) continue;
        // The yard offers only its actual available hull, not one lent elsewhere.
        if (whereItStands(thing) !== faction.seatLocationId
            || thing.possessorId !== null && thing.possessorId !== faction.id
            || whoItIsWith(thing) !== null && whoItIsWith(thing) !== faction.id) continue;
        const id = thing.data.conveyanceId;
        if (typeof id !== 'string') continue;
        const kind = getConveyance(id);
        if (kind === undefined) continue;
        out.push({ conveyance: kind, power: thing.power ?? null, rowId: thing.id });
    }
    return out;
}
