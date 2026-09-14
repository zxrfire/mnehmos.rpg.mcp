/**
 * A glacier and a rice terrace handed the player the same forty-three herbs.
 *
 * `rollHerb` has taken a third argument - what is underfoot - since the day it
 * was written, and `findHerbsForOrdinal` narrows to it. The MCP path passes one.
 * The played `gather` verb in `turn-engine.ts` did not, so the one surface a
 * player actually touches drew from the whole catalog wherever they stood, and
 * the two surfaces disagreed about what a place is made of.
 *
 * It is the same shape as the defect `what-ground-a-place-is.ts` was written to
 * end for the hunt: a reading that exists, is correct, and has nothing routed
 * to it.
 *
 * ── WHY THERE IS A TEST AND NOT JUST A FIX ──────────────────────────────
 *
 * Because the fix was made once and lost. It was written into a hot file, was
 * overwritten before it was committed, and nothing failed - `git log -S` finds
 * no commit that ever carried it. Nothing in the suite could tell the two
 * behaviours apart, which is why the loss was silent for hours. This file is
 * the thing that would have said so.
 *
 * It asserts against the catalog rather than against a named province: which
 * grounds Cloudmist or the Vent Vein are is authored content in
 * `src/data/cultivation/regions/`, and a second copy of it here would be a test
 * that has to be edited every time the map is.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld, engineCalls } from './harness';
import { activeWorld } from '../../src/server/state/cultivation-world';
import { worldLocationFor } from '../../src/web/entities';
import { whatGroundThisIs } from '../../src/engine/world/what-ground-a-place-is';
import { HERBS, findOfferedHerbs } from '../../src/data/cultivation/herbs';

/** The sentence the table routes to `gather`, in a player's own words. */
const GO_PICK = 'I go out and pick herbs';

/**
 * Several worlds, because one province proves nothing.
 *
 * The defect is invisible wherever the ground happens to be broad: a draw off
 * the whole catalog can land inside a wide pool by luck. It only shows on
 * narrow ground, and which seed puts the player on narrow ground is not
 * something this file should be pinning.
 */
const SEEDS = ['picked-ground-a', 'picked-ground-b', 'picked-ground-c', 'picked-ground-d'];

interface OneGather {
    /** The herb the engine says grows here, by name, or null if it offered none. */
    readonly named: string | null;
    /** Everything this ground could have offered somebody at this height. */
    readonly onThisGround: readonly string[];
    /** Everything the catalog could have offered them, ground ignored. */
    readonly anywhere: readonly string[];
}

async function gatherOnce(seed: string): Promise<OneGather> {
    const { game } = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const { cultivator } = await game.newRun('Yun Shiqing');

    const world = (await activeWorld()).state;
    const here = worldLocationFor(world, cultivator.location);
    const underfoot = here ? whatGroundThisIs(world, here) : null;

    const result = await game.act(GO_PICK);
    // The gather call names what the ground gave up, whether or not any of it
    // ended in the pouch - a herb too high to take safely is still a statement
    // about what grows here, and is exactly as wrong if the ground was ignored.
    const summary = engineCalls(result)
        .filter(call => call.action === 'gather')
        .map(call => call.summary)
        .join(' ');

    const ordinal = cultivator.realmOrdinal;
    const offered = (where: readonly string[] | null) =>
        findOfferedHerbs(ordinal, where ?? undefined).map(h => h.name);

    return {
        named: HERBS.map(h => h.name).find(name => summary.includes(name)) ?? null,
        onThisGround: offered(underfoot),
        anywhere: offered(null)
    };
}

describe('what a gather turns up', () => {
    it('is something that grows on the ground the player is standing on', async () => {
        const runs = [];
        for (const seed of SEEDS) runs.push(await gatherOnce(seed));

        for (const [index, run] of runs.entries()) {
            if (run.named === null) continue;
            expect(
                [SEEDS[index], run.onThisGround.includes(run.named)],
                `${run.named} does not grow on this ground`
            ).toEqual([SEEDS[index], true]);
        }

        // AND THE CLAIM ABOVE HAS TO MEAN SOMETHING. If every ground the seeds
        // put the player on offered the whole catalog, the assertion would pass
        // against the broken engine too. At least one of them must narrow.
        const narrowed = runs.filter(r => r.onThisGround.length < r.anywhere.length);
        expect(narrowed.length, 'no seed stood the player on ground that narrows the draw')
            .toBeGreaterThan(0);

        // And the gather has to have happened at all - all four returning null
        // would make the loop above vacuous.
        expect(runs.filter(r => r.named !== null).length).toBeGreaterThan(0);
    }, 120_000);
});
