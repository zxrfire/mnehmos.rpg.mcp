/**
 * Found while making work rooms real: played refinement rolled and consumed its
 * ingredients before walking to the cauldron or living its work days. A stopped
 * span could already have a finished pill. Readiness now shares the MCP handler's
 * validation; interrupted work reaches neither the roll nor the pouch writes.
 * The interrupted span is scripted here to isolate ordering from encounter draws.
 */
import { describe, it, expect, vi } from 'vitest';
import { makeGame } from './harness';
import { getRecipe } from '../../src/data/cultivation/recipes';
import { addToPouch, pouchQuantity } from '../../src/server/consolidated/cultivation-support';
import { prepareRefine, isRefinePreparation } from '../../src/server/consolidated/alchemy-manage';

async function atACauldron() {
    const h = makeGame({ seed: 'refine-order' });
    const { cultivator } = await h.game.newRun('Maker');
    h.repos.cultivators.update(cultivator.id, { location: 'Emerald Water City' });
    const recipe = getRecipe('recipe-minor-healing')!;
    for (const ingredient of recipe.ingredients)
        addToPouch(h.db, cultivator.id, ingredient.itemId, 'herb', ingredient.quantity);
    return { ...h, cultivator, recipe };
}

describe('a refinement lives its work before making a pill', () => {
    it('the shared readiness read leaves the pouch, clock and turn untouched', async () => {
        const { game, db, cultivator, recipe } = await atACauldron();
        const before = game.state();
        expect(isRefinePreparation(prepareRefine({ action: 'refine', cultivatorId: cultivator.id,
            recipeId: recipe.id, supplements: [] }))).toBe(true);
        for (const ingredient of recipe.ingredients)
            expect(pouchQuantity(db, cultivator.id, ingredient.itemId)).toBe(ingredient.quantity);
        expect(pouchQuantity(db, cultivator.id, recipe.producesPillId)).toBe(0);
        expect(game.state().run.turn).toBe(before.run.turn);
        expect(game.state().run.elapsedDays).toBe(before.run.elapsedDays);
    });

    it('an interrupted work span cannot burn the herbs or make the pill', async () => {
        const { game, db, cultivator, recipe } = await atACauldron();
        const work = vi.spyOn(game, 'shortSkip').mockImplementation(async (run, _body, _ambient, _focus, _label, days) => ({
            ...game.freeAction(run, 'refine', { headline: 'Work interrupted.', prose: 'Work interrupted.',
                lines: ['Work interrupted.'], structure: [] }),
            cutShort: { askedDays: days ?? 1, livedDays: 0, cause: 'the_world' as const, what: 'Work interrupted.' }
        }));
        try {
            const done = await game.act(`I refine ${recipe.name}`);
            expect(work).toHaveBeenCalled();
            expect(done.toolCalls.some(c => c.name === 'alchemy_manage.refine' && c.ok)).toBe(false);
            for (const ingredient of recipe.ingredients)
                expect(pouchQuantity(db, cultivator.id, ingredient.itemId)).toBe(ingredient.quantity);
            expect(pouchQuantity(db, cultivator.id, recipe.producesPillId)).toBe(0);
        } finally { work.mockRestore(); }
    });
});
