/**
 * A journey with an end on open water is sailed, from a landing, on a seat bought there.
 *
 * Played blind at Sweet Spring Island: "ok then i'm going to silver island. how do i get on a
 * boat going there?" was read as a move and walked, four days through the haze to the coast and
 * four nights in the open, one turn after somebody there had said four days' sail. The Pearl
 * Ocean's place connections are `road` only because that is the engine's link kind, and every
 * sea crossing in the catalog has an end on open water, so an end there is the test
 * (`the-way-there-is-by-ship.ts`). At the landing a move says what the seat costs and who sells
 * it and spends nothing; anywhere else it walks to the landing and says the way on.
 *
 * Played on `road-world`, where a new run opens at The Furnace Flank, inland.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';

const WORLD = 'road-world';

async function atSweetSpringIsland() {
    const harness = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
    await harness.game.newRun('Rider');
    harness.db.prepare("UPDATE cultivators SET location = 'Sweet Spring Island', spirit_stones = 500 WHERE id = ?")
        .run(harness.game.state().cultivator.id);
    return harness;
}

describe('the way there is by ship', () => {
    it.each(['I go to Silver Island', 'I travel to Silver Island', 'I sail to Silver Island'])(
        'island to island is a seat at the landing, not nights on open ground: "%s"', async said => {
            const { game } = await atSweetSpringIsland();

            const done = await game.act(said);

            expect(done.narration).toMatch(/The way to Silver Island is by ship, not on foot\./);
            expect(done.narration).toMatch(/Silver Island by ship: \d+ days?, \d+ cash a seat \(\d+ stones\)/);
            expect(done.narration).toMatch(/sells the seats at the landing here/);
            expect(done.narration).not.toMatch(/nights? in the open|took to the road/);
            expect(game.state().cultivator.location).toBe('Sweet Spring Island');
            expect(game.state().run.elapsedDays).toBe(0);

            await game.act('I take the ship to Silver Island');
            expect(game.state().cultivator.location).toBe('Silver Island');
        }, 120_000);

    it('from inland, the move walks to the landing and says the way on is by ship', async () => {
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: WORLD });
        await game.newRun('Rider');

        const done = await game.act('I go to Silver Island');

        const landing = game.state().cultivator.location;
        expect(landing).not.toBe('Silver Island');
        expect(game.state().run.elapsedDays).toBeGreaterThan(0);
        expect(done.narration).toMatch(/The way on to Silver Island is by ship from here; .+ sells the seats at the landing\./);
        expect((await game.act('what ships are there')).narration).toMatch(/by ship: \d+ days?/);
        expect(game.state().cultivator.location).toBe(landing);
    }, 120_000);

    it('no carriage runs on open water', async () => {
        const { game } = await atSweetSpringIsland();

        const done = await game.act('what carriages are there');

        expect(done.narration).toMatch(/No carriage runs from Sweet Spring Island/);
        expect(done.narration).toMatch(/Silver Island by ship/);
    }, 120_000);

    it('every place on open water has its own dock, and none of them is walked to', async () => {
        // The owner: "all island places have a dock". Read off the world, so a house's grounds and a
        // ruin the seed put on the water are asked about as much as a port town.
        const { game } = await atSweetSpringIsland();
        const world = game.atHand!;
        const sea = world.locations.find(row => row.kind === 'region' && row.name === 'The Pearl Ocean')!;
        const onTheWater = world.locations.filter(row => row.parentId === sea.id).map(row => row.name);
        expect(onTheWater.length).toBeGreaterThan(9);

        const board = (await game.act('what ships are there')).narration;
        for (const name of onTheWater.filter(one => one !== 'Sweet Spring Island')) {
            expect(board, `no ship to ${name}`).toContain(`${name} by ship:`);
            const asked = await game.act(`I go to ${name}`);
            expect(asked.narration, name).toMatch(/is by ship, not on foot\./);
            expect(asked.narration, name).not.toMatch(/From .+ the way goes on to/);
            expect(game.state().cultivator.location).toBe('Sweet Spring Island');
        }
        expect(game.state().run.elapsedDays).toBe(0);
    }, 300_000);

    it.each(['Dragonvein Rock', 'Silver Island Hall grounds'])('a ship sails straight to %s and puts in at its dock', async named => {
        const { game } = await atSweetSpringIsland();

        await game.act(`I take the ship to ${named}`);

        expect(game.state().cultivator.location).toBe(named);
        expect(game.state().run.elapsedDays).toBeGreaterThan(0);
    }, 120_000);

    it('riding a mount or a cart to open water is a ship from the landing too', async () => {
        const { game } = await atSweetSpringIsland();

        const done = await game.act('I ride to Silver Island');

        expect(done.narration).toMatch(/The way to Silver Island is by ship, not on foot\./);
        expect(game.state().cultivator.location).toBe('Sweet Spring Island');
    }, 120_000);

    it('reads sailing somewhere as going there, and sailing on as carrying on', () => {
        expect(parseIntent('I sail to Silver Island')).toMatchObject({ action: 'move', target: 'Silver Island' });
        expect(parseIntent('sail on')).toMatchObject({ action: 'move' });
        expect(parseIntent('I sail on to Sweet Spring Island')).toMatchObject({ action: 'move', target: 'sweet spring island' });
    });
});
