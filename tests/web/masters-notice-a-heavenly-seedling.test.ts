/**
 * Masters notice a heavenly seedling.
 *
 * The design owner: most juniors have no master, *"unless you are a heavenly
 * seedling"* - a talent like that is sought after, by more than one master, and
 * by masters who were not looking. The world does this to its own at the opening
 * and every year (`the-disciples-a-world-opens-with.ts`); this is the same read
 * pointed at the player.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   a player whose root reads as a seedling, standing where masters are, is told
 *   who would take them on, and is told once per master
 *   an ordinary root is told nothing
 *   nothing is written on anybody: the bond is still the discipleship path
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { elderRungOf } from '../../src/engine/cultivation/leadership.js';
import { FOUNDATION_ORDINAL } from '../../src/engine/cultivation/realms.js';
import {
    mastersNoticeAHeavenlySeedling,
    mastersWhoWouldOfferToTakeThemOn,
    thePlayerReadsAsASeedling
} from '../../src/web/masters-notice-a-heavenly-seedling.js';

const WORLD = 'a-seedling-is-noticed';

/** A player standing in a hall that has masters in it. */
async function standingAmongMasters(seed: string, root: 'mutated_ice' | 'muddled_five_element') {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { cultivator } = await harness.game.newRun('Seedling');
    const world = (await harness.game.loadWorld())!;
    const ranks = new Map(world.factions.map(f => [f.id, f.ranks.length] as const));
    const master = world.npcs.find(n => n.status === 'alive' && n.factionId !== null && n.locationId !== null
        && n.cultivation.realmOrdinal >= FOUNDATION_ORDINAL
        && n.factionRankIndex >= elderRungOf(ranks.get(n.factionId!) ?? 0))!;
    const where = world.locations.find(l => l.id === master.locationId)!;
    harness.repos.cultivators.update(cultivator.id, { location: where.name, spiritRoot: root, realmOrdinal: 3 });
    return { ...harness, master, where };
}

describe('a player whose talent reads as a heavenly seedling', () => {
    it('is told who would take them on, once for each master, and nothing is written on anybody', async () => {
        const { game, repos, master } = await standingAmongMasters('seedling-noticed', 'mutated_ice');
        const player = repos.cultivators.getById(game.currentRun().cultivator.id)!;
        expect(thePlayerReadsAsASeedling(player)).toBe(true);
        expect(mastersWhoWouldOfferToTakeThemOn(game.atHand!, {
            id: player.id, locationId: game.worldPlaceOf(player), ordinal: player.realmOrdinal
        }).some(m => m.id === master.id)).toBe(true);

        const first = mastersNoticeAHeavenlySeedling(game, player);
        expect(first?.lines.join(' ')).toMatch(/would take you as a disciple/);
        expect(game.atHand!.npcs.find(n => n.id === master.id)!.relationships
            .some(r => r.targetId === player.id), 'an offer is not a bond').toBe(false);

        expect(mastersNoticeAHeavenlySeedling(game, player), 'said once for each master').toBeNull();
    }, 120_000);

    it('and an ordinary root is told nothing', async () => {
        const { game, repos } = await standingAmongMasters('seedling-ordinary', 'muddled_five_element');
        const player = repos.cultivators.getById(game.currentRun().cultivator.id)!;
        expect(thePlayerReadsAsASeedling(player)).toBe(false);
        expect(mastersNoticeAHeavenlySeedling(game, player)).toBeNull();
    }, 120_000);
});
