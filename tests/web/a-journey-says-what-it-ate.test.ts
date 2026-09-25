/**
 * A journey says what was eaten on it, and says before a walk when the food will
 * not cover the road.
 *
 * The owner: "you have to eat and drink too, if you travel, right? like have that
 * be part of the travel narration", and then "don't bother [with water], too
 * complicated just track rations", and "the road should say plainly before setting
 * out when the rations carried won't cover it". So the engine states rations eaten
 * from the pack and what is left, and a short pack is a fact at the top of the
 * journey and never a refusal: the player still goes.
 *
 * Played from The Furnace Flank on `road-world`, three days down the arms road to
 * Green Water City, and eleven into the Buddha Precipice.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';

const WORLD = 'road-world';

describe('a journey says what it ate', () => {
    it('says what came out of the pack and what the belly is at, and charges the nights', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Walker');

        const done = await game.act('I travel to Green Water City');

        expect(game.state().cultivator.location).toBe('Green Water City');
        expect(done.narration).toMatch(/Eaten on the road: \d+ rations? from the pack, \d+ left; the belly is at \d+ of 100/);
        // Rations only: the owner dropped water.
        expect(done.narration).not.toMatch(/\bdrank\b|\bwater from\b/);
    }, 120_000);

    it('says before a walk that the food carried will not cover the road, and still goes', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Walker');
        const id = game.state().cultivator.id;
        db.prepare('UPDATE cultivators SET satiety = 10 WHERE id = ?').run(id);
        db.prepare("DELETE FROM cultivator_flags WHERE cultivator_id = ? AND key = 'rations_held'").run(id);
        const before = game.state();

        const done = await game.act('I travel to the Buddha Precipice');

        expect(done.narration).toMatch(/The pack and the belly hold \d+ days? of food; the road is 11\./);
        expect(game.state().run.elapsedDays).toBeGreaterThan(before.run.elapsedDays);
    }, 120_000);
});
