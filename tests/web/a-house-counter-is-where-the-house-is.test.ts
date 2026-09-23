/**
 * A row a house owns is bought at that house, and a row nobody owns anywhere.
 *
 * `buy` paid for gate registration, oath witnessing and a realm placement
 * wherever the player stood, though each names its own house's counter
 * (`whereThisIsActuallyDone`). Now:
 *
 *   AWAY     refused, saying where it is done, and nothing is spent
 *   THERE    at the house's own compound it is bought
 *   NOBODY'S a letter written is bought wherever the player is
 *
 * THE WORLD IS PINNED, because where the house stands is read off it.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { whoseCounterThisSitsAt, getPrice } from '../../src/data/cultivation/mortal-world';
import type { WorldState } from '../../src/engine/world/world-state';

const WORLD = 'a-house-counter';

async function aPlayer() {
    const h = await makeGameInWorld({ seed: WORLD, worldSeed: WORLD, worldEnabled: true });
    const { cultivator } = await h.game.newRun('Buyer');
    h.db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?').run(cultivator.id);
    await h.game.act('I look around');
    return { ...h, id: cultivator.id };
}

describe('a house\'s counter', () => {
    const registration = getPrice('price-gate-registration')!;
    const house = whoseCounterThisSitsAt(registration)!;

    it('is not where the player is standing, so nothing is bought and nothing spent', async () => {
        const h = await aPlayer();
        const before = h.repos.cultivators.getById(h.id)!.spiritStones;
        const turn = await h.game.act('I buy gate registration') as unknown as { narration: string };
        expect(turn.narration).toMatch(new RegExp(house.name.replace(/^the\s+/i, ''), 'i'));
        expect(h.repos.cultivators.getById(h.id)!.spiritStones).toBe(before);
    }, 300_000);

    it('is where the house stands, and there it is bought', async () => {
        const h = await aPlayer();
        const world = (h.game as unknown as { atHand: WorldState }).atHand;
        const seatId = world.factions.find(row => row.id === house.factionId)?.seatLocationId;
        const seat = world.locations.find(row => row.id === seatId);
        expect(seat, `${house.factionId} has no seat in this world`).toBeDefined();
        h.db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(seat!.name, h.id);
        const before = h.repos.cultivators.getById(h.id)!.spiritStones;
        await h.game.act('I buy gate registration');
        expect(h.repos.cultivators.getById(h.id)!.spiritStones).toBeLessThan(before);
    }, 300_000);

    it('is nobody\'s for a letter, which is bought wherever the player is', async () => {
        const h = await aPlayer();
        const before = h.repos.cultivators.getById(h.id)!.spiritStones;
        await h.game.act('I buy a letter written');
        expect(h.repos.cultivators.getById(h.id)!.spiritStones).toBeLessThan(before);
    }, 300_000);
});
