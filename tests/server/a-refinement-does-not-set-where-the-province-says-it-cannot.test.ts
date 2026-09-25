/**
 * A refinement does not set where the province says it cannot.
 *
 * Every province row carries `cultivation.missingDisciplines`: the disciplines
 * that do not work there at all, each with its reason. The Buddha Precipice's
 * says a refinement needs ambient qi to hold its shape while it sets, and
 * that every pill in the region is imported eleven days by cart. The Blown
 * Ground's says a furnace is a fixed installation and nothing there is fixed.
 *
 * `disciplineWorksIn` answered the question and nothing in the game asked it,
 * so a player standing in either refined exactly as they would at home. The
 * refusal now comes before the pouch, because no set of herbs changes it, and
 * it quotes the row's own reason.
 *
 * Red-checked by removing the gate in `handleRefine`: the first test then
 * fails on `missing_ingredients` never appearing, because the pill is made.
 */

import { handleAlchemyManage } from '../../src/server/consolidated/alchemy-manage.js';
import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { addToPouch, ensureCultivationDb, pouchQuantity } from '../../src/server/consolidated/cultivation-support.js';
import { RECIPES } from '../../src/data/cultivation/recipes.js';
import { REGIONS } from '../../src/data/cultivation/regions.js';

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
const FIRST_FORMULA = RECIPES.find(r => r.requiredOrdinal === 0)!;

/** A province whose own row says alchemy does not work there, read off the catalog. */
const NO_ALCHEMY = REGIONS.find(r => r.places.length > 0
    && r.cultivation.missingDisciplines.some(m => m.discipline === 'alchemy'))!;

/** And one whose row says nothing of the kind. */
const ALCHEMY_WORKS = REGIONS.find(r => r.places.length > 0
    && !r.cultivation.missingDisciplines.some(m => m.discipline === 'alchemy'))!;

async function anAlchemistAt(location: string): Promise<string> {
    const created = await cultivation({
        action: 'create_cultivator', name: 'Kiln', seed: 'no-refinement-sets-here', location
    });
    expect(created.error).toBeUndefined();
    const id = created.cultivator.id as string;
    const repos = ensureCultivationDb();
    for (const ingredient of FIRST_FORMULA.ingredients) {
        addToPouch(repos.db, id, ingredient.itemId, 'herb', ingredient.quantity);
    }
    return id;
}

describe('a refinement and the ground it is attempted on', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
    });

    afterEach(() => closeDb());

    it('is refused where the province says alchemy does not work, with the province\'s reason', async () => {
        const place = NO_ALCHEMY.places[0]!.name;
        const cultivatorId = await anAlchemistAt(place);

        const refused = await alchemy({ action: 'refine', cultivatorId, recipeId: FIRST_FORMULA.id });

        expect(refused.error).toBe('discipline_does_not_work_here');
        expect(refused.message).toContain(NO_ALCHEMY.name);
        const reason = NO_ALCHEMY.cultivation.missingDisciplines.find(m => m.discipline === 'alchemy')!.reason;
        expect(refused.message).toContain(reason);
    });

    it('spends nothing when it refuses', async () => {
        const cultivatorId = await anAlchemistAt(NO_ALCHEMY.places[0]!.name);
        await alchemy({ action: 'refine', cultivatorId, recipeId: FIRST_FORMULA.id });

        const repos = ensureCultivationDb();
        for (const ingredient of FIRST_FORMULA.ingredients) {
            expect(pouchQuantity(repos.db, cultivatorId, ingredient.itemId)).toBe(ingredient.quantity);
        }
    });

    it('is not refused on that ground where the province lets a refinement set', async () => {
        const cultivatorId = await anAlchemistAt(ALCHEMY_WORKS.places[0]!.name);
        const result = await alchemy({ action: 'refine', cultivatorId, recipeId: FIRST_FORMULA.id });
        expect(result.error).not.toBe('discipline_does_not_work_here');
    });
});
