/** The same current-ground readiness read serves named requests and world people. */
import type { AmbientQi } from '../../schema/cultivation.js';
import { guidanceFor, readyToStrike, type Readiness } from './an-npc-striking-at-the-next-wall.js';
import { BOOKLESS_CEILING, reachableCeilingFor } from './manuals.js';
import { groundRateAt } from './the-ground-somebody-is-actually-standing-on.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

export function howCloseTheyStandToTheirWall(
    world: WorldState,
    npc: NpcRecord,
    ambient: AmbientQi,
    today: number
): Readiness {
    const location = npc.locationId === null
        ? undefined
        : world.locations.find(row => row.id === npc.locationId);
    const manualCeiling = reachableCeilingFor(world, npc) || BOOKLESS_CEILING;
    const byId = new Map(world.npcs.map(row => [row.id, row]));
    const guidance = guidanceFor(npc, byId, today);
    return readyToStrike(npc, today, {
        // The ground they are standing on. `ambient` is the band the turn
        // already computed for this square, and the rate is the one this
        // location supplies - today's figure rather than the yearly pass's
        // average over a chamber allocation, because this is a question about
        // one place on one day.
        ambient,
        rateMultiplier: groundRateAt(location) ?? 1,
        guideOrdinal: guidance?.ordinal ?? null,
        guideListeners: guidance?.listeners ?? 1,
        manualCeiling
    });
}
