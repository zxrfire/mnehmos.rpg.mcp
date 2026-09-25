/**
 * Every name a player digest is permitted to use.
 *
 * For asserting the hard rule that a digest names nobody the reader could not
 * name: nothing in the game asks it, because `buildPlayerDigest` is what
 * decides it.
 */

import type { PlayerDigest } from '../../src/engine/world/digest.js';

export function namesPermitted(digest: PlayerDigest): { factions: Set<string>; npcs: Set<string> } {
    const factions = new Set<string>();
    const npcs = new Set<string>();
    for (const line of digest.lines) {
        for (const id of line.namableFactionIds) factions.add(id);
        for (const id of line.namableNpcIds) npcs.add(id);
    }
    return { factions, npcs };
}
