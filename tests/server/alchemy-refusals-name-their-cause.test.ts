/**
 * A refusal on the road to a pill has to say why it refused.
 *
 * Found by playing. Untreated meridian injuries are the leading cause of death
 * in this game - six of twelve rogue runs and five of six sect runs in one
 * sample - and refining is one of the three roads to the medicine that closes
 * one. A player carrying three torn meridians typed "I refine a Minor Healing
 * Pill" and was told, in full:
 *
 *     Minor Healing Pill Formula cannot be attempted.
 *
 * No cause, no shortfall, no route. That sentence is indistinguishable from an
 * unfinished subsystem, and it sat directly on the critical path out of the
 * commonest death in the game. The shortfall was in the payload the whole time
 * and no player has ever seen a payload.
 *
 * The sibling branch one line above it has always read properly - "requires Qi
 * Condensation Layer 7; Torn stands at Qi Condensation Layer 1" - so this is
 * about matching what the file already does, not about a new style.
 */

import { handleAlchemyManage } from '../../src/server/consolidated/alchemy-manage.js';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { addToPouch, ensureCultivationDb } from '../../src/server/consolidated/cultivation-support.js';
import { RECIPES } from '../../src/data/cultivation/recipes.js';
import { getHerb } from '../../src/data/cultivation/herbs.js';
import { getPill } from '../../src/data/cultivation/pills.js';

const ctx = { sessionId: 'test' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const alchemy = async (args: Record<string, unknown>) => payload(await handleAlchemyManage(args, ctx));
const cultivation = async (args: Record<string, unknown>) =>
    payload(await handleCultivationManage(args, ctx));

/** The formula every cultivator can attempt from the first day. */
const MINOR_HEALING = RECIPES.find(r => r.id === 'recipe-minor-healing')
    ?? RECIPES.find(r => r.requiredOrdinal === 0)!;

describe('the catalog keeps its own promise about ingredients', () => {
    /**
     * The refusal names the ground each missing herb grows on, and that is only
     * an instruction rather than a taunt if the ground will actually answer
     * somebody standing where the recipe says they must stand. Asserted here
     * because `alchemy-manage.ts` says out loud that it relies on it.
     */
    it('never asks for a herb that grows above the rung the formula demands', () => {
        const unreachable: string[] = [];
        for (const recipe of RECIPES) {
            for (const ingredient of recipe.ingredients) {
                const herb = getHerb(ingredient.itemId);
                if (herb && herb.harvestOrdinal > recipe.requiredOrdinal) {
                    unreachable.push(
                        `${recipe.name} (ordinal ${recipe.requiredOrdinal}) wants `
                        + `${herb.name} (harvest ${herb.harvestOrdinal})`
                    );
                }
            }
        }
        expect(unreachable).toEqual([]);
    });
});

describe('refusing to refine', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
    });

    afterEach(() => closeDb());

    async function anAlchemist() {
        const created = await cultivation({
            action: 'create_cultivator',
            name: 'Torn',
            seed: 'alchemy-refusal',
            location: 'Sweptground'
        });
        return created.cultivator.id as string;
    }

    it('names what the pouch is short of, and how much of it', async () => {
        const cultivatorId = await anAlchemist();
        const refused = await alchemy({ action: 'refine', cultivatorId, recipeId: MINOR_HEALING.id });

        expect(refused.error).toBe('missing_ingredients');
        for (const ingredient of MINOR_HEALING.ingredients) {
            const herb = getHerb(ingredient.itemId)!;
            expect(refused.message).toContain(herb.name);
        }
        // The shortfall, not the requirement: somebody holding one of two is
        // short of one, and being told "2 x Qi Grass" would send them to gather
        // twice what they need.
        expect(refused.message).toMatch(/short of/i);
    });

    it('counts what is already held rather than restating the recipe', async () => {
        const cultivatorId = await anAlchemist();
        const first = MINOR_HEALING.ingredients[0];
        const repos = ensureCultivationDb();
        addToPouch(repos.db, cultivatorId, first.itemId, 'herb', 1);

        const refused = await alchemy({ action: 'refine', cultivatorId, recipeId: MINOR_HEALING.id });
        const herb = getHerb(first.itemId)!;
        expect(refused.message).toContain(`${first.quantity - 1} x ${herb.name}`);
    });

    it('says where the missing herb grows, so the refusal is a next step', async () => {
        const cultivatorId = await anAlchemist();
        const refused = await alchemy({ action: 'refine', cultivatorId, recipeId: MINOR_HEALING.id });
        for (const ingredient of MINOR_HEALING.ingredients) {
            const herb = getHerb(ingredient.itemId)!;
            expect(refused.message).toContain(herb.biome.replace(/_/g, ' '));
        }
    });

    /**
     * The regression itself. Not "the message is long" - that is a proxy - but
     * that the message is no longer the bare sentence, and that the payload the
     * narrator renders carries the numbers rather than hiding them.
     */
    it('is not the bare sentence any more', async () => {
        const cultivatorId = await anAlchemist();
        const refused = await alchemy({ action: 'refine', cultivatorId, recipeId: MINOR_HEALING.id });
        expect(refused.message).not.toBe(`${MINOR_HEALING.name} cannot be attempted.`);
        expect(refused.missing.length).toBe(MINOR_HEALING.ingredients.length);
        for (const row of refused.missing) {
            expect(row.short).toBeGreaterThan(0);
            expect(typeof row.biome).toBe('string');
        }
    });

    /**
     * And the branch above it, which was always right, stays right. A refusal
     * that started explaining itself is worth nothing if it swallowed the one
     * that already did.
     */
    it('still refuses a formula above the alchemist by naming both ranks', async () => {
        const cultivatorId = await anAlchemist();
        const high = RECIPES.find(r => r.requiredOrdinal > 0)!;
        const refused = await alchemy({ action: 'refine', cultivatorId, recipeId: high.id });
        expect(refused.error).toBe('realm_too_low');
        expect(refused.message).toMatch(/requires .+; Torn stands at /);
    });

    /**
     * Two walls, and a player told the wrong one goes and does the wrong thing.
     *
     * The design owner's ruling is that a cultivator cannot work with materials
     * above their realm. That is a wall practice does not move: the answer is
     * rungs, and the refusal says which REALM rather than only which rank,
     * because the requirement is the realm and any rung of it will serve.
     */
    it('says which realm a grade wants when the grade is the wall', async () => {
        const cultivatorId = await anAlchemist();
        const heaven = RECIPES.find(r => getPill(r.producesPillId)!.grade === 'heaven')!;
        const refused = await alchemy({ action: 'refine', cultivatorId, recipeId: heaven.id });
        expect(refused.error).toBe('realm_too_low');
        expect(refused.blockedByGrade).toBe(true);
        expect(refused.grade).toBe('heaven');
        expect(refused.message).toContain('Void Refinement');
    });

    /**
     * And the wall that is not a rung at all. Immortal grade is refined below
     * the Lid by nobody, so a refusal quoting a rank somebody could climb to
     * would be a lie about a road - and one that removed the verb without
     * naming the roads still open would be the other failure AGENTS.md forbids.
     */
    it('names the other roads for a grade nobody here can refine', async () => {
        const cultivatorId = await anAlchemist();
        const immortal = RECIPES.find(r => getPill(r.producesPillId)!.grade === 'immortal')!;
        const refused = await alchemy({ action: 'refine', cultivatorId, recipeId: immortal.id });
        expect(refused.error).toBe('realm_too_low');
        expect(refused.blockedByGrade).toBe(true);
        expect(refused.message).toMatch(/sent down/i);
        expect(refused.message).toMatch(/found|bought|inherited|dug/i);
    });
});
