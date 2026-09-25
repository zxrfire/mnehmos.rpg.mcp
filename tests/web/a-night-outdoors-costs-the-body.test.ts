/**
 * A night outdoors costs a body below Foundation Establishment, and a room at the
 * inn is the roof that spares it.
 *
 * The owner: "to have an incentive to stay at an inn, you take weather damage
 * staying outside below foundation establishment". Before this, ten days waiting
 * in a square and ten days in a bed cost the body the same: nothing.
 *
 * Played at The Furnace Flank, where a new run opens on `road-world`: a sect town,
 * which keeps an inn by the innkeeper's own trade listing. Days are waited in the
 * square with no room, then the same span with one. Exposure alone stops at a
 * quarter of the body (`EXPOSURE_FLOOR_FRACTION`), so a year outdoors is sore and
 * not fatal.
 */

import { describe, expect, it } from 'vitest';

import { EXPOSURE_FLOOR_FRACTION } from '../../src/engine/cultivation/a-night-in-the-open';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';

const WORLD = 'road-world';

describe('a night outdoors costs the body', () => {
    it('costs the body for days waited in the open, and says so', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Sleeper');
        const before = game.state().cultivator;

        const done = await game.act('I wait thirty days');
        const after = game.state().cultivator;

        expect(after.hp).toBeLessThan(before.hp);
        expect(done.narration).toMatch(/nights? in the open cost the body \d+; it stands at \d+ of \d+/);
    }, 120_000);

    it('costs nothing for the same nights under a room at the inn', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Sleeper');
        const before = game.state().cultivator;

        const done = await game.act('I stay at the inn for thirty nights');
        const after = game.state().cultivator;

        expect(after.hp).toBe(before.hp);
        expect(after.spiritStones).toBeLessThan(before.spiritStones);
        expect(done.narration).toMatch(/room at the inn/i);
        expect(done.narration).not.toMatch(/in the open cost the body/);
        expect(game.state().run.elapsedDays).toBe(30);
    }, 120_000);

    it('takes a room without spending the nights, and the nights waited after are roofed', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Sleeper');
        const before = game.state().cultivator;

        const took = await game.act('I take a room at the inn for ten nights');
        expect(took.narration).toMatch(/10 nights/);
        expect(game.state().run.elapsedDays).toBe(0);

        await game.act('I wait ten days');
        expect(game.state().cultivator.hp).toBe(before.hp);
    }, 120_000);

    /**
     * Somebody keeps it, and a stranger is not named by the engine. Played: the
     * keeper's name was printed beside a census saying nobody here could be
     * named, and the narrator went on naming strangers.
     */
    it('has somebody keeping the inn, said as the innkeeper by somebody with no name for them', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Sleeper');

        const took = await game.act('I take a room at the inn');
        const keeper = /(\S+(?: \S+)?) keeps the inn/.exec(took.narration)?.[1];
        expect(keeper, took.narration).toBeDefined();
        // Named only where the player holds the name (this is their home town, so
        // they may); otherwise the innkeeper.
        const held = (game as unknown as { awarenessOf(c: typeof cultivator): { name: string }[] })
            .awarenessOf(cultivator).map(row => row.name);
        if (keeper !== 'The innkeeper') expect(held).toContain(keeper);

        const asked = await game.act('I talk to the innkeeper');
        expect(asked.narration).not.toMatch(/matched nobody|answers to that name/);
    }, 120_000);

    /** Played: "is there like an inn or somewhere i can crash tonight" was a look that never mentioned one. */
    it('shows the inn and its price to a look round', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Sleeper');

        const looked = await game.act('I look around');
        expect(looked.narration).toMatch(/There is an inn here: a room is \d+ cash a night, and a meal \d+\./);
    }, 120_000);

    it('ends the room when they leave the place, so coming back is outdoors again', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Sleeper');

        await game.act('I take a room at the inn for thirty nights');
        await game.act('I book a carriage to Green Water City');
        await game.act('I book a carriage to The Furnace Flank');
        expect(game.state().cultivator.location).toBe('The Furnace Flank');
        const back = game.state().cultivator;

        const done = await game.act('I wait ten days');

        expect(game.state().cultivator.hp).toBeLessThan(back.hp);
        expect(done.narration).toMatch(/in the open cost the body/);
    }, 120_000);

    it('never takes a body below the floor by weather alone', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Sleeper');
        const max = game.state().cultivator.maxHp;

        await game.act('I wait a year');
        const after = game.state().cultivator;

        expect(after.alive).toBe(true);
        expect(after.hp).toBeGreaterThanOrEqual(Math.ceil(max * EXPOSURE_FLOOR_FRACTION));
    }, 120_000);

    it('costs nothing at Foundation Establishment', async () => {
        const { game, db } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Sleeper');
        const id = game.state().cultivator.id;
        db.prepare('UPDATE cultivators SET realm_ordinal = 13 WHERE id = ?').run(id);
        const before = game.state().cultivator;

        const done = await game.act('I wait thirty days');

        expect(game.state().cultivator.hp).toBeGreaterThanOrEqual(before.hp);
        expect(done.narration).not.toMatch(/in the open/);
    }, 120_000);

    it('reads the ways a player asks for a room', () => {
        for (const said of ['I take a room at the inn', 'I rent a room', 'I get a room for the night', 'I book a room']) {
            expect(parseIntent(said), said).toMatchObject({ action: 'buy', target: 'a room for the night' });
        }
        expect(parseIntent('I stay at the inn for three nights')).toMatchObject({ action: 'wait', days: 3 });
        expect(parseIntent('I lodge at the inn')).toMatchObject({ action: 'wait', days: 1 });
    });
});
