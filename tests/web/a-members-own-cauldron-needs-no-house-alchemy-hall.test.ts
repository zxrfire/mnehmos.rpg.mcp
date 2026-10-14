/**
 * Institutional craft rooms became conditional on 2026-10-10. A member of a
 * house without alchemy support can still refine medicine with their own
 * cauldron and herbs in existing quarters. This played control checks the
 * actual work, ingredient spending and carried vessel, without choosing the
 * refinement's result. Both the world and run are pinned.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { purposeOf } from '../../src/engine/world/architecture.js';
import { makeObject } from '../../src/engine/world/possessions.js';
import { theBestVesselToHand } from '../../src/engine/world/the-vessel-somebody-works-at.js';
import { getRecipe } from '../../src/data/cultivation/recipes.js';
import { addToPouch, pouchQuantity } from '../../src/server/consolidated/cultivation-support.js';

describe('a member refining with their own cauldron', () => {
    it('works in existing quarters without an institutional alchemy room', async () => {
        const h = await makeGameInWorld({ seed: 'own-cauldron-work', worldSeed: 'own-cauldron-house' });
        const { cultivator } = await h.game.newRun('Maker');
        const world = (await h.game.loadWorld())!;
        const house = world.factions.find(row => row.dissolvedOnDay === null && row.seatLocationId
            && h.repos.sects.getById(row.id)
            && world.locations.some(room => room.data.factionId === row.id && purposeOf(room) === 'dormitory')
            && !world.locations.some(room => room.data.factionId === row.id && purposeOf(room) === 'alchemy_hall'));
        expect(house, 'a real house with quarters and no alchemy hall').toBeDefined();
        const quarters = world.locations.find(room => room.data.factionId === house!.id
            && purposeOf(room) === 'dormitory')!;
        h.repos.sects.addMember(house!.id, cultivator.id, 1);
        h.repos.cultivators.update(cultivator.id, { location: quarters.name });
        h.repos.cultivators.standIn(cultivator.id, null);
        const cauldron = makeObject({ id: 'a-members-own-cauldron', name: 'Fired clay cauldron', kind: 'other',
            ownerId: cultivator.id, possessorId: cultivator.id,
            tags: ['cauldron', 'grade:mortal'], data: { grade: 'mortal' } });
        world.objects.push(cauldron);
        h.game.atHand = world;
        h.game.theWorldMoved();
        expect(theBestVesselToHand(world.objects, cultivator.id, 'cauldron', cultivator.realmOrdinal)?.objectId)
            .toBe(cauldron.id);
        const recipe = getRecipe('recipe-minor-healing')!;
        const beforeIngredients = new Map<string, number>();
        for (const ingredient of recipe.ingredients) {
            addToPouch(h.db, cultivator.id, ingredient.itemId, 'herb', ingredient.quantity);
            beforeIngredients.set(ingredient.itemId, pouchQuantity(h.db, cultivator.id, ingredient.itemId));
        }
        const before = h.game.state().run.elapsedDays;
        const done = await h.game.act(`I refine ${recipe.name}`);
        expect(done.toolCalls.some(call => call.name === 'alchemy_manage.refine' && call.ok), done.narration).toBe(true);
        expect(h.game.state().run.elapsedDays).toBeGreaterThan(before);
        expect(h.game.state().cultivator.location).toBe(quarters.name);
        for (const ingredient of recipe.ingredients) {
            expect(pouchQuantity(h.db, cultivator.id, ingredient.itemId))
                .toBe(beforeIngredients.get(ingredient.itemId)! - ingredient.quantity);
        }
        const afterWorld = (await h.game.loadWorld())!;
        expect(afterWorld.objects.find(row => row.id === cauldron.id)).toMatchObject({
            ownerId: cultivator.id, possessorId: cultivator.id });
    });
});
