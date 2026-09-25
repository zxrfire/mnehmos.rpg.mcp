/**
 * What the world currently has to lose: how many ties the living hold, how
 * many still point at somebody, and how many people have a friend at all.
 *
 * A measurement of the tie passes rather than a step of any of them, so it
 * lives beside the test and the audit that read it.
 */

import { isBelowTheLid } from '../../src/engine/world/layers.js';
import type { NpcRecord } from '../../src/engine/world/npc-state.js';
import type { WorldState } from '../../src/engine/world/world-state.js';

/** Alive and in the lower world: somebody whose ties are the world's to lose. */
function isHere(npc: NpcRecord): boolean {
    return npc.status === 'alive' && isBelowTheLid(npc);
}

export interface TieSupply {
    /** Directed rows held by living people, whoever they point at. */
    ties: number;
    /**
     * Rows pointing at somebody still in the world.
     */
    liveTies: number;
    byKind: Record<string, number>;
    /**
     * People with at least one LIVING tie at or above the friendship standing.
     * The population an absence can actually cost something.
     */
    withSomebody: number;
    /**
     * People with no living tie above that standing.
     */
    withNobody: number;
    living: number;
    /** Living ties per living person. The inflation number. */
    perHead: number;
}

/**
 * What the world currently has to lose.
 */
export function tieSupply(state: WorldState, friendshipStanding: number): TieSupply {
    const alive = new Set<string>();
    for (const npc of state.npcs) if (isHere(npc)) alive.add(npc.id);

    const byKind: Record<string, number> = {};
    let ties = 0;
    let liveTies = 0;
    let withSomebody = 0;
    let withNobody = 0;

    for (const npc of state.npcs) {
        if (!isHere(npc)) continue;
        let any = false;
        for (const rel of npc.relationships) {
            ties++;
            if (!alive.has(rel.targetId)) continue;
            liveTies++;
            byKind[rel.kind] = (byKind[rel.kind] ?? 0) + 1;
            if (rel.standing >= friendshipStanding) any = true;
        }
        if (any) withSomebody++; else withNobody++;
    }
    const living = alive.size;
    return {
        ties,
        liveTies,
        byKind,
        withSomebody,
        withNobody,
        living,
        perHead: living === 0 ? 0 : Math.round((liveTies / living) * 100) / 100
    };
}
