/**
 * What "reproducible from the seed" actually promises.
 *
 * ── THE GAP ──────────────────────────────────────────────────────────────
 *
 * AGENTS.md says runs must be reproducible from their seed, and every
 * stochastic system in the engine obeys it. The run seed was never the whole
 * of the input, though: a run is lived INSIDE a world, and the world has its
 * own seed. `createWorld` mints that seed with `randomUUID()` when none is
 * given, and `activeWorld()` calls it with no options on an installation that
 * has no world yet - so a fresh database gets a world nobody chose.
 *
 * That is deliberate. A minted seed is persisted, which is what makes the
 * world the installation's own rather than a default every installation
 * shares, and worlds outlive their runs by design. What was missing is the
 * consequence being written down anywhere: the same run seed against two fresh
 * databases meets a different several hundred people, so "I attack someone of
 * my own rank" fights a different person, and no played test could pin a seed
 * to an outcome. `a-bout-two-people-agreed-to.test.ts` sweeps thirty seeds and
 * asserts a RATE for exactly this reason.
 *
 * ── WHAT IS PINNED HERE ──────────────────────────────────────────────────
 *
 * Both halves of the promise, from opposite sides:
 *
 *   same run seed, same world seed -> the same life, exchange for exchange.
 *   same run seed, different world -> a different population, and the run seed
 *                                     alone did not promise otherwise.
 *
 * The second is not a defect being tolerated. It is the boundary of the
 * promise, and a test that asserts it is a test that stops somebody
 * "fixing" the world seed back into the run seed - which would give every run
 * its own world and delete cross-run persistence, one of the two designs
 * `cultivation-world.ts` explicitly rejects.
 */

import { describe, it, expect } from 'vitest';

import { worldForRun, resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { makeGame, makeGameInWorld, cultivatorRow } from './harness';

/** Who is alive, at what rung, and where - the part a run meets. */
async function population(game: { state(): { run: unknown } }): Promise<string[]> {
    const world = await worldForRun(game.state().run as never);
    // Keyed WITHOUT the row id, for the reason the confrontation test below
    // states in its own words: ids are `randomUUID()` everywhere in this engine
    // and are not a function of any seed, so they are not what reproducibility
    // means. Including one made this test fail on exactly one row out of 428 -
    // the player's own - while every other field of every other NPC matched,
    // which is the engine keeping the promise and the test asking for
    // something else.
    return world.npcs.map(
        npc => `${npc.name}:${npc.cultivation.realmOrdinal}:${npc.locationId ?? '-'}`
    );
}

describe('a run is reproducible inside a world, not on its own', () => {
    /**
     * Two fresh in-memory databases in ONE process, which is the condition
     * that used to differ: same run seed, world left to mint its own.
     */
    it('does not fix the population from the run seed alone', async () => {
        resetCultivationWorlds();
        const first = makeGame({ seed: 'same-run-seed', worldEnabled: true });
        await first.game.newRun('Wen Shu');
        const one = await population(first.game);

        resetCultivationWorlds();
        const second = makeGame({ seed: 'same-run-seed', worldEnabled: true });
        await second.game.newRun('Wen Shu');
        const two = await population(second.game);

        expect(one.length).toBeGreaterThan(0);
        expect(two).not.toEqual(one);
    }, 120_000);

    /** And with the world pinned as well, it is the same world exactly. */
    it('fixes the population from the run seed and the world seed together', async () => {
        const first = await makeGameInWorld({ seed: 'same-run-seed', worldSeed: 'pinned' });
        await first.game.newRun('Wen Shu');
        const one = await population(first.game);

        const second = await makeGameInWorld({ seed: 'same-run-seed', worldSeed: 'pinned' });
        await second.game.newRun('Wen Shu');
        const two = await population(second.game);

        expect(one.length).toBeGreaterThan(0);
        expect(two).toEqual(one);
    }, 120_000);

    /**
     * The reason it matters, played rather than inspected.
     *
     * A confrontation reaches for somebody of the player's own rank out of the
     * world's population, so this is the whole chain - who is there, who is
     * chosen, and what the fight did - compared end to end.
     */
    it('replays a played confrontation exactly, with both seeds pinned', async () => {
        const run = async () => {
            const { db, game } = await makeGameInWorld({ seed: 'replay', worldSeed: 'pinned-fight' });
            const { cultivator } = await game.newRun('Duellist');
            await game.act('I look around');
            const result = await game.act('I attack someone of my own rank');
            // Row ids are `randomUUID()` everywhere in this engine and the
            // timestamps are wall clock, so neither is a function of any seed
            // and neither is what reproducibility means.
            const { id, run_id, created_at, updated_at, ...state } = cultivatorRow(db, cultivator.id);
            return {
                calls: result.toolCalls.map(c => `${c.name}/${c.action}/${c.ok}/${c.summary}`),
                state
            };
        };

        const first = await run();
        const second = await run();

        // Vacuous otherwise: a sentence that never reached the combat tool
        // would compare two identical refusals and prove nothing.
        expect(first.calls.some(call => call.startsWith('combat_manage.'))).toBe(true);
        expect(second.calls).toEqual(first.calls);
        expect(second.state).toEqual(first.state);
    }, 120_000);
});
