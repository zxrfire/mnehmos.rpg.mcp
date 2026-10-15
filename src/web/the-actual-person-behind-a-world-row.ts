/** SQL people read their real sheet; world people remain their actual Native row. */
import type { GameService } from './turn-engine.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import { isTheWorldsToMove } from '../engine/world/npc-state.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { standInTheWorld } from './the-player-as-a-row-the-world-can-invite.js';

export function actualPersonFor(game: GameService, id: string): NpcRecord | undefined {
    const world = game.atHand;
    if (!world) return undefined;
    const body = game.repos.cultivators.getById(id);
    if (!body) return world.npcs.find(person => person.id === id && isTheWorldsToMove(person));
    const membership = game.repos.sects.getMembership(id);
    const row = standInTheWorld({ ...world, npcs: world.npcs.slice() }, body,
        { factionId: membership?.sectId ?? null, rankIndex: membership?.rankIndex ?? -1,
            contribution: membership?.contribution ?? 0 }, routineTime(world));
    return row ? { ...row, cultivation: { ...row.cultivation, seal: body.qiSeal }, soulState: body.soulState,
        locationId: game.worldPlaceOf(body), activity: body.standingIn ? {
        kind: 'their_own_business', note: '', withIds: [], sinceDay: routineTime(world),
        standingIn: body.standingIn } : null } : undefined;
}
