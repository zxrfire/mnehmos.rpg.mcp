import { PLAYER_ROW_TAG } from './npc-state.js';
/** The existing directions profile, projected from actual person/world rows.
 * One pure projection is shared by spoken directions and canonical NPC reads.
 * It records no knowledge and gives no actor a route or an entry permission. */
import type { WorldState } from './world-state.js';
import { howMuchOfTheRoadALifeHasSeen, theRoadAnUpbringingSaw, type WhoTheyAre }
    from './what-somebody-knows-of-the-land.js';
export interface LandKnowledgePerson {
    readonly id: string;
    readonly location: string | null;
    readonly realmOrdinal: number;
    readonly sectId: string | null;
}
export function whoTheyAreOf(world: Pick<WorldState, 'locations' | 'npcs'>, asked: LandKnowledgePerson): WhoTheyAre {
    const them = world.npcs.find(row => row.id === asked.id) ?? null;
    const native = them && !them.tags.includes(PLAYER_ROW_TAG) ? them : null;
    const houseId = native ? native.factionId : asked.sectId;
    return {
        id: asked.id,
        from: world.locations.find(row => row.id === (native?.locationId ?? null))?.name ?? asked.location,
        ordinal: native?.cultivation.realmOrdinal ?? asked.realmOrdinal,
        house: houseId ? { id: houseId, rankIndex: native?.factionRankIndex ?? 0 } : null,
        ...(native
            ? {
                travelled: Math.max(
                    theRoadAnUpbringingSaw(native.identity.origin),
                    howMuchOfTheRoadALifeHasSeen(native.identity.occupation)
                )
            }
            : {})
    };
}

