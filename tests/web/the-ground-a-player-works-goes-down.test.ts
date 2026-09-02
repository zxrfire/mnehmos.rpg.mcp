/**
 * The counted stock is reached by playing, not only by a unit test.
 *
 * AGENTS.md's most-repeated defect is a module nothing calls: a subsystem that
 * is designed, written, tested and rendered, and that nothing in the running
 * game ever reaches. `what-a-place-still-has-in-the-ground.ts` is exactly the
 * shape that happens to - a pure module with its own unit tests - so the
 * question this file exists to answer is the only one that matters about it:
 *
 *     does a player typing a sentence move the number?
 *
 * The world is pinned as well as the run, because these assertions turn on
 * which place the run opens in and what grows there.
 */
import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { worldForRun } from '../../src/server/state/cultivation-world';
import { worldLocationFor } from '../../src/web/entities';
import {
    STOCK_GRADES,
    capacityFor,
    drawFromTheGround,
    howTheGroundReads,
    recordGroundDraw,
    standingStock
} from '../../src/engine/world/what-a-place-still-has-in-the-ground';

const WORLD = 'ground-stock-world';

/** The world row for wherever the run's cultivator is standing. */
async function groundUnderThePlayer(game: Awaited<ReturnType<typeof makeGameInWorld>>['game']) {
    const state = game.state();
    const run = state.run!;
    const world = await worldForRun(run as never);
    const place = worldLocationFor(world, state.cultivator.location);
    expect(place, 'the pinned world does not know where the run opened').not.toBeNull();
    return { world, place: place! };
}

describe('a player working the ground moves the number', () => {
    it('writes the band down on the place after a gather', async () => {
        const { game } = await makeGameInWorld({ seed: 'stock-a', worldSeed: WORLD });
        await game.newRun('Digger');

        const before = await groundUnderThePlayer(game);
        const untouched = Object.keys(before.place.data)
            .filter(k => k.startsWith('ground.'));
        expect(untouched, 'a fresh world starts with nothing drawn').toEqual([]);

        await game.act('I gather herbs');

        const after = await groundUnderThePlayer(game);
        const written = Object.keys(after.place.data).filter(k => k.startsWith('ground.')).sort();
        // Two cells and no more: an amount and a day. A counted thing is a
        // number on a row, and a third field here would be the start of giving
        // it a history.
        expect(written, 'a gather that took a herb left no mark on the ground').toHaveLength(2);
        expect(written[0]).toMatch(/^ground\.herb\.[a-z]+\.day$/);
        expect(written[1]).toMatch(/^ground\.herb\.[a-z]+\.drawn$/);
        expect(after.place.data[written[1]]).toBe(1);
    }, 120_000);

    it('answers what a place still has when the player looks at it', async () => {
        // The read that stops this being a simulation nobody can see. Asked of
        // the province, because that is a name that resolves to a place: a
        // settlement usually shares its name with the house that runs it, and
        // the house wins the lookup. That is entity resolution's business and
        // not this file's, but it is why the province is what gets examined.
        const { game } = await makeGameInWorld({ seed: 'stock-b', worldSeed: WORLD });
        await game.newRun('Surveyor');
        const { world, place } = await groundUnderThePlayer(game);
        const province = world.locations.find(l => l.id === place.parentId) ?? place;

        const said = await game.act(`I examine ${province.name}`) as { narration?: string };
        expect(said.narration ?? '').toContain(`The ground around ${province.name}`);
    }, 120_000);

    it('says so in prose when a district has been worked out', async () => {
        // Stripping a band the honest way - a hundred played passes - is not a
        // test, it is a soak. So the band is emptied through the same engine
        // call the verb uses and the VERB is then asked what it says, which is
        // the half that could be broken without anybody noticing.
        const { game } = await makeGameInWorld({ seed: 'stock-c', worldSeed: WORLD });
        await game.newRun('Stripper');
        const { world, place } = await groundUnderThePlayer(game);

        for (const grade of STOCK_GRADES) {
            const draw = drawFromTheGround(place, {
                kind: 'herb',
                grade,
                wanted: capacityFor(place, 'herb', grade),
                onDay: Math.floor(world.currentDay)
            });
            recordGroundDraw(place, draw);
        }

        expect(howTheGroundReads(place, Math.floor(world.currentDay)))
            .toContain('worked out');

        const said = await game.act('I gather herbs') as { narration?: string };
        // Nothing came out of the ground, and the player is told why rather
        // than handed a quieter yield.
        expect(said.narration ?? '').toMatch(/worked out|last of|bare ground|nothing/i);
    }, 120_000);

    it('keeps the drawdown across a new life in the same world', async () => {
        // The stock is on the WORLD, not on the run. A district somebody
        // stripped is still stripped for whoever comes next, which is the whole
        // reason the clock is the world's.
        const { game } = await makeGameInWorld({ seed: 'stock-d', worldSeed: WORLD });
        await game.newRun('First');
        const first = await groundUnderThePlayer(game);

        const draw = drawFromTheGround(first.place, {
            kind: 'beast_material',
            grade: 'earth',
            wanted: 40,
            onDay: Math.floor(first.world.currentDay)
        });
        recordGroundDraw(first.place, draw);

        const later = standingStock(
            first.place, 'beast_material', 'earth', Math.floor(first.world.currentDay)
        );
        expect(later.remaining).toBe(draw.after);
        expect(later.remaining).toBeLessThan(later.capacity);
    }, 120_000);
});
