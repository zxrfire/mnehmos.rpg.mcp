/**
 * A thing holed short of breaking says so, and a hand at its rung mends it.
 *
 * The owner: items have durability of the partial-damage kind, and *"every
 * player is an artisan"*. So a holed thing is a fact on the inventory read,
 * and "I mend it" is the `craft` verb reaching `mend` in `object-damage.ts`:
 * days at the work, the rung gate, and the row put back whole.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld, type Harness } from './harness.js';
import { activeWorld } from '../../src/server/state/cultivation-world.js';
import { isHoled } from '../../src/engine/world/object-damage.js';

const TALLY = 'artifact-azure-sword-tally';

async function withAdmin<T>(fn: () => Promise<T>): Promise<T> {
    const before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
    try {
        return await fn();
    } finally {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    }
}

/** A player at `ordinal` holding the tally, with one hole in it. */
async function holdingAHoledTally(seed: string, ordinal: number): Promise<Harness> {
    const harness = await makeGameInWorld({ seed, worldSeed: 'a-holed-thing', adminMode: true });
    await harness.game.newRun('Shen Yue');
    await harness.game.act(`ADMIN set_realm ordinal=${ordinal}`);
    await harness.game.act(`ADMIN grant_item itemId=${TALLY}`);
    // What a fight past what it was made for leaves, written as the fight
    // writes it (`writeBack` in `object-damage.ts`).
    const state = (await activeWorld()).state;
    const at = state.objects.findIndex(o => o.id === TALLY);
    const row = state.objects[at]!;
    state.objects[at] = {
        ...row,
        power: row.power! - 1,
        tags: [...row.tags, 'damaged', 'holed'],
        data: { ...row.data, scars: 1, ratedWhole: row.power }
    };
    return harness;
}

describe('a holed thing', () => {
    it('shows its condition on the inventory read, as a fact', async () => {
        await withAdmin(async () => {
            const harness = await holdingAHoledTally('holed-shows', 20);
            const said = (await harness.game.act('what am I carrying')).narration;
            expect(said).toContain('holed once, standing at 15 of the 16 it was made at');
        });
    }, 60_000);

    it('is mended by a hand at the rung it was made at, and is whole again', async () => {
        await withAdmin(async () => {
            const harness = await holdingAHoledTally('holed-mended', 20);
            const daysBefore = harness.game.state().run.elapsedDays;
            await harness.game.act('I mend it');
            const row = (await activeWorld()).state.objects.find(o => o.id === TALLY)!;
            expect(row.power).toBe(16);
            expect(isHoled(row)).toBe(false);
            expect(harness.game.state().run.elapsedDays).toBeGreaterThan(daysBefore);
        });
    }, 60_000);

    it('is refused to a hand below that rung, with the rung, and costs nothing', async () => {
        await withAdmin(async () => {
            const harness = await holdingAHoledTally('holed-refused', 10);
            const daysBefore = harness.game.state().run.elapsedDays;
            const said = (await harness.game.act('I mend it')).narration;
            expect(said).toContain('16');
            const row = (await activeWorld()).state.objects.find(o => o.id === TALLY)!;
            expect(row.power).toBe(15);
            expect(harness.game.state().run.elapsedDays).toBe(daysBefore);
        });
    }, 60_000);
});
