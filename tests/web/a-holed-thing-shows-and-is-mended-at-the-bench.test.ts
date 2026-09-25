/**
 * A thing holed short of breaking says so, and a hand at its rung mends it.
 *
 * The owner: items have durability of the partial-damage kind, and *"every
 * player is an artisan"*. So a holed thing is a fact on the inventory read,
 * and "I mend it" is the `craft` verb reaching `mend` in `object-damage.ts`:
 * days at the work, the rung gate, one piece of the material its grade's
 * recipe starts with (owner ruling 2026-09-25), and the row put back whole.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld, type Harness } from './harness.js';
import { activeWorld } from '../../src/server/state/cultivation-world.js';
import { isBroken, isHoled } from '../../src/engine/world/object-damage.js';
import { addToPouch, pouchQuantity } from '../../src/server/consolidated/cultivation-support.js';
import { whatMendingItTakes, whatWouldFill } from '../../src/data/cultivation/what-an-artifact-is-made-of.js';

const TALLY = 'artifact-azure-sword-tally';
/** One piece that fills earth grade's first slot mends a hole in earth-grade work. */
const MATERIAL = whatWouldFill(whatMendingItTakes('earth', false)![0]!)[0]!;
/** And what a break costs: the whole earth recipe, one piece a slot. */
const THE_WHOLE_RECIPE = whatMendingItTakes('earth', true)!.map(slot => whatWouldFill(slot)[0]!);

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

/** A player at `ordinal` holding the tally, with one hole in it, and `pieces` of the material. */
async function holdingAHoledTally(seed: string, ordinal: number, pieces = 1): Promise<Harness> {
    const harness = await makeGameInWorld({ seed, worldSeed: 'a-holed-thing', adminMode: true });
    await harness.game.newRun('Shen Yue');
    await harness.game.act(`ADMIN set_realm ordinal=${ordinal}`);
    await harness.game.act(`ADMIN grant_item itemId=${TALLY}`);
    if (pieces > 0) addToPouch(harness.db, harness.game.state().cultivator.id, MATERIAL.id, 'herb', pieces);
    // What a fight past what it was made for leaves, written as the fight
    // writes it (`writeBack` in `object-damage.ts`).
    const state = (await activeWorld()).state;
    const at = state.objects.findIndex(o => o.id === TALLY);
    const row = state.objects[at]!;
    // In their hands, so the Pavilion's own yearly mending does not reach it
    // while they work (`a-house-mends-what-it-owns.ts`).
    state.objects[at] = {
        ...row,
        possessorId: harness.game.state().cultivator.id,
        power: row.power! - 1,
        tags: [...row.tags, 'damaged', 'holed'],
        // Earth-grade work, as a made thing carries its grade on the row.
        data: { ...row.data, grade: 'earth', scars: 1, ratedWhole: row.power }
    };
    return harness;
}

const pieces = (harness: Harness) =>
    pouchQuantity(harness.db, harness.game.state().cultivator.id, MATERIAL.id);

/** A player at `ordinal` holding the tally, broken. */
async function holdingABrokenTally(seed: string, ordinal: number, stocked: boolean): Promise<Harness> {
    const harness = await holdingAHoledTally(seed, ordinal, 0);
    const id = harness.game.state().cultivator.id;
    if (stocked) for (const material of THE_WHOLE_RECIPE) addToPouch(harness.db, id, material.id, 'herb', 1);
    const state = (await activeWorld()).state;
    const at = state.objects.findIndex(o => o.id === TALLY);
    const row = state.objects[at]!;
    state.objects[at] = {
        ...row,
        power: 16,
        tags: [...row.tags.filter(t => t !== 'holed'), 'broken'],
        data: { ...row.data, scars: 3, ratedWhole: 16 }
    };
    return harness;
}

describe('a broken thing', () => {
    it('is restored to whole at the bench, for the whole recipe, and reads whole again', async () => {
        await withAdmin(async () => {
            const harness = await holdingABrokenTally('broken-restored', 20, true);
            const before = (await harness.game.act('what am I carrying')).narration;
            expect(before).toContain('broken, works at half');
            const daysBefore = harness.game.state().run.elapsedDays;
            await harness.game.act('I mend it');
            const row = (await activeWorld()).state.objects.find(o => o.id === TALLY)!;
            expect(isBroken(row)).toBe(false);
            expect(row.power).toBe(16);
            expect(harness.game.state().run.elapsedDays).toBeGreaterThan(daysBefore);
            const id = harness.game.state().cultivator.id;
            for (const material of THE_WHOLE_RECIPE) expect(pouchQuantity(harness.db, id, material.id)).toBe(0);
            const after = (await harness.game.act('what am I carrying')).narration;
            expect(after).not.toContain('broken, works at half');
        });
    }, 60_000);

    it('is refused on a hole\'s worth of material, naming what is short, and costs nothing', async () => {
        await withAdmin(async () => {
            const harness = await holdingABrokenTally('broken-short', 20, false);
            addToPouch(harness.db, harness.game.state().cultivator.id, MATERIAL.id, 'herb', 1);
            const daysBefore = harness.game.state().run.elapsedDays;
            const said = (await harness.game.act('I mend it')).narration;
            expect(said).toContain('Restoring');
            const row = (await activeWorld()).state.objects.find(o => o.id === TALLY)!;
            expect(isBroken(row)).toBe(true);
            expect(harness.game.state().run.elapsedDays).toBe(daysBefore);
        });
    }, 60_000);
});

describe('a holed thing', () => {
    it('shows its condition on the inventory read, as a fact', async () => {
        await withAdmin(async () => {
            const harness = await holdingAHoledTally('holed-shows', 20);
            const said = (await harness.game.act('what am I carrying')).narration;
            expect(said).toContain('holed once, standing at 15 of the 16 it was made at');
        });
    }, 60_000);

    it('is mended by a hand at the rung it was made at, for one piece of material', async () => {
        await withAdmin(async () => {
            const harness = await holdingAHoledTally('holed-mended', 20, 2);
            const daysBefore = harness.game.state().run.elapsedDays;
            await harness.game.act('I mend it');
            const row = (await activeWorld()).state.objects.find(o => o.id === TALLY)!;
            expect(row.power).toBe(16);
            expect(isHoled(row)).toBe(false);
            expect(harness.game.state().run.elapsedDays).toBeGreaterThan(daysBefore);
            expect(pieces(harness)).toBe(1);
        });
    }, 60_000);

    it('is refused with nothing to mend it with, naming what would do, and costs nothing', async () => {
        await withAdmin(async () => {
            const harness = await holdingAHoledTally('holed-no-material', 20, 0);
            const daysBefore = harness.game.state().run.elapsedDays;
            const said = (await harness.game.act('I mend it')).narration;
            expect(said).toContain(MATERIAL.name);
            const row = (await activeWorld()).state.objects.find(o => o.id === TALLY)!;
            expect(row.power).toBe(15);
            expect(harness.game.state().run.elapsedDays).toBe(daysBefore);
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
            expect(pieces(harness)).toBe(1);
        });
    }, 60_000);
});
