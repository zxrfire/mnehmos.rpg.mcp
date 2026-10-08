/** The ordinary two-row cash transfer, shared by gifts, lifts and agreed payment.
 * Reads the current stored body first, otherwise the actual world's purse.
 * Computes both balances once, writes SQL together, then publishes world changes.
 * This helper grants no consent, theft result, favour or payment entitlement. */
import type { GameService } from './turn-engine.js';
export function actualSpiritStones(game: GameService, id: string): number | null {
    const stored = game.repos.cultivators.getById(id);
    const npc = stored ? null : game.atHand?.npcs.find(row => row.id === id);
    return stored ? stored.spiritStones : npc ? npc.spiritStones : null;
}
export function transferActualSpiritStones(game: GameService, fromId: string, toId: string,
    stones: number, withinCommit?: () => void): { ok: boolean; available: number; short: number } {
    const from = actualSpiritStones(game, fromId), to = actualSpiritStones(game, toId);
    if (from === null || to === null || fromId === toId || !Number.isFinite(stones)
        || stones < 0 || Math.trunc(stones) !== stones || from < stones)
        return { ok: false, available: from ?? 0, short: Math.max(0, stones - (from ?? 0)) };
    const fromStored = game.repos.cultivators.getById(fromId), toStored = game.repos.cultivators.getById(toId);
    game.db.transaction(() => {
        if (stones > 0 && fromStored) game.repos.cultivators.applyDeltas(fromId, { spiritStones: -stones });
        if (stones > 0 && toStored) game.repos.cultivators.applyDeltas(toId, { spiritStones: stones });
        withinCommit?.();
    })();
    if (stones > 0) {
        if (!fromStored) game.atHand!.npcs.find(row => row.id === fromId)!.spiritStones = from - stones;
        if (!toStored) game.atHand!.npcs.find(row => row.id === toId)!.spiritStones = to + stones;
        if (!fromStored || !toStored) game.theWorldMoved();
    }
    return { ok: true, available: from - stones, short: 0 };
}
