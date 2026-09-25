/**
 * An elder looking at the reserves is told what is left in them, after what has
 * already gone - the same figure a month of taking reports at its end.
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { handleCultivationManage } from '../../src/server/consolidated/cultivation-manage.js';
import { handleSectManage } from '../../src/server/consolidated/sect-manage.js';
import { closeDb, getDb } from '../../src/storage/index.js';
import { ensureCultivationDb } from '../../src/server/consolidated/cultivation-support.js';
import { baseReservesFor, canReachReserves } from '../../src/engine/cultivation/embezzlement.js';

const HOUSE = 'sect-azure-dew-sect';
const ctx = undefined;

function payload(res: { content: Array<{ text?: string }> }): any {
    const text = res.content[0]?.text ?? '{}';
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return match ? JSON.parse(match[1]) : JSON.parse(text);
}

const cultivation = async (a: Record<string, unknown>) =>
    payload(await handleCultivationManage(a, ctx));
const sect = async (a: Record<string, unknown>) => payload(await handleSectManage(a, ctx));

describe('looking at the books', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
    });
    afterEach(() => { closeDb(); });

    it('reports what the reserves still hold after what was taken', async () => {
        const made = await cultivation({
            action: 'create_cultivator', name: 'Lu Zhen', seed: 'the-books', location: 'Emerald Water City'
        });
        expect(made.error).toBeUndefined();
        const id = made.cultivator.id as string;

        // Seated at the first rung that signs for the reserves: arranging the
        // precondition, not the read.
        const repos = ensureCultivationDb();
        const house = repos.sects.getById(HOUSE)!;
        const elder = house.ranks.findIndex((_, i) => canReachReserves(i, house.ranks.length));
        expect(elder).toBeGreaterThanOrEqual(0);
        repos.sects.addMember(HOUSE, id, elder);

        const base = baseReservesFor(house.stipend);
        const before = await sect({ action: 'siphon', cultivatorId: id });
        expect(before.reserves).toEqual({ held: base, originally: base });

        const month = await sect({ action: 'siphon', cultivatorId: id, pace: 'careful', months: 1 });
        expect(month.caught).toBe(false);
        expect(month.takenInTotal).toBeGreaterThan(0);

        const after = await sect({ action: 'siphon', cultivatorId: id });
        expect(after.reserves.held).toBe(month.reservesLeft);
        expect(after.reserves.held).toBe(base - month.takenInTotal);
        expect(after.narrationHint).toContain(after.reserves.held.toLocaleString());
    });
});
