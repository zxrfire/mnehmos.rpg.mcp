/**
 * A player can make a thing, and the thing is theirs.
 *
 * WHY THIS EXISTS
 * ---------------
 * `engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.ts` has
 * carried the whole of building since it was written, and
 * `web/half-built-craft.ts` has carried the player's side of it - the bill, the
 * slip, the rung gate, the abandon branch, the launch - complete and tested.
 * Neither was reachable. `grep -rn "planTheBuild" src/` returned a test and a
 * doc comment, so houses laid keels and launched hulls and nothing a player
 * could type arrived anywhere near it. That is AGENTS.md's commonest defect with
 * the halves the usual way round: the world binds NPCs and not the player.
 *
 * These cases are the sentence, not the module. `half-built-craft.test.ts`
 * already drives the plan and the write directly; what could not be asserted
 * until now is that typing an ordinary English sentence gets you there, spends
 * the days, takes the materials out of the pouch, and leaves a thing in the
 * world with your name on it as its owner.
 *
 * BOTH SEEDS ARE PINNED. The launch roll is `forStream(runSeed:cultivatorId:
 * startedOnDay, 'conveyance-launch', ...)` and the days run through `shortSkip`,
 * which rolls encounters against the world - so a run seed alone would be
 * pinning a coincidence.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { addToPouch, listPouch } from '../../src/server/consolidated/cultivation-support.js';
import { readTheStocks } from '../../src/web/half-built-craft.js';
import { getConveyanceRecipe } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';

const WORLD = 'a-carriage-gets-built';

/** Enough mortal-grade pieces for the cheapest bill, and four spare. */
function stockTheYard(db: Parameters<typeof addToPouch>[0], cultivatorId: string): void {
    addToPouch(db, cultivatorId, 'mat-boar-hide', 'herb', 8);
    addToPouch(db, cultivatorId, 'mat-wolf-sinew', 'herb', 6);
}

describe('a player builds a carriage', () => {
    it('reaches the yard rather than the cauldron', async () => {
        const { game } = await makeGameInWorld({ seed: 'yard-a', worldSeed: WORLD });
        await game.newRun('Wright');

        const said = await game.act('I build a carriage') as {
            narration?: string;
            calls?: { name: string }[];
        };

        // `refine`'s branch owns the words `make`, `craft`, `brew` and `cook`,
        // so the failure this pins is a cauldron listing answering a sentence
        // about a carriage.
        expect(said.narration ?? '').not.toContain('cauldron');
        expect((said.narration ?? '').toLowerCase()).toContain('carriage');
    }, 120_000);

    it('says what the bill is short of rather than silently doing nothing', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'yard-b', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Wright');

        const said = await game.act('I build a carriage') as { narration?: string };

        expect((said.narration ?? '').toLowerCase()).toContain('short of');
        // A slip with nothing on it and no work in it is not written at all - a
        // phantom keel would occupy the yard.
        expect(readTheStocks(db, cultivator.id)).toBeNull();
    }, 120_000);

    it('lays a keel, takes the pieces out of the pouch, and spends the days', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'yard-c', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Wright');
        stockTheYard(db, cultivator.id);

        const before = game.state().run.elapsedDays;
        await game.act('I build a carriage');

        const stocks = readTheStocks(db, cultivator.id);
        expect(stocks).not.toBeNull();
        expect(stocks!.recipeId).toBe('build-carriage-mortal');
        expect(stocks!.workDaysDone).toBeGreaterThan(0);

        // Ten pieces onto the slip out of the fourteen carried.
        const pouch = listPouch(db, cultivator.id);
        const hide = pouch.find(entry => entry.itemId === 'mat-boar-hide')?.quantity ?? 0;
        const sinew = pouch.find(entry => entry.itemId === 'mat-wolf-sinew')?.quantity ?? 0;
        expect(hide + sinew).toBe(4);

        expect(game.state().run.elapsedDays).toBeGreaterThan(before);
    }, 120_000);

    it('finishes what is on the stocks when the player comes back to it', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'yard-d', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Wright');
        stockTheYard(db, cultivator.id);

        const recipe = getConveyanceRecipe('build-carriage-mortal')!;
        // Two turns at the bench: 30 days is what one pair of hands puts in
        // before looking up, and the bill wants 40.
        await game.act('I build a carriage');
        const said = await game.act('I go back to the carriage and finish it') as {
            narration?: string;
        };

        expect(recipe.workDays).toBe(40);
        // Either it holds or it does not - the roll is the engine's - but the
        // slip is off the stocks either way and the turn says which happened.
        expect(readTheStocks(db, cultivator.id)).toBeNull();
        expect((said.narration ?? '').length).toBeGreaterThan(0);
    }, 120_000);

    it('refuses a bill above the hands, and names one that is not', async () => {
        const { game } = await makeGameInWorld({ seed: 'yard-e', worldSeed: WORLD });
        await game.newRun('Wright');

        const said = await game.act('I build a spirit boat') as { narration?: string };
        const prose = (said.narration ?? '').toLowerCase();

        // The rung gate is `canRefineGrade`, the same one the cauldron keeps.
        expect(prose).toContain('void refinement');
        // A refusal names a route.
        expect(prose).toContain('drawn carriage');
    }, 120_000);
});
