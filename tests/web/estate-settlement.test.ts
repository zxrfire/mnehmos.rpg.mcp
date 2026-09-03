/**
 * Somebody dies with things on them, and the things are still there afterwards.
 *
 * Played, in a pinned world, against real state. The claim is the one the
 * repository kept failing: a system that binds the world must bind the player,
 * and until this landed the player's death reached the world layer not at all.
 * Measured before the fix, on a starved cultivator holding pills, herbs, a
 * rated object and thirty stones - every pouch row still on the corpse, zero
 * provenance rows naming them, zero chronicle rows naming them, their world row
 * still reading `alive`, and no grave anywhere.
 *
 * Every assertion below is on state. The narration is never read.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld, type Harness } from './harness';
import { settleWhatTheyWereCarrying } from '../../src/web/estate-settlement';
import { LegacyLedger } from '../../src/web/leaving-things-for-the-next-life';
import { worldForRun, saveWorldForRun } from '../../src/server/state/cultivation-world';
import { getNpc, getObject } from '../../src/engine/world/world-state';

/** ADMIN_MODE is read at call time, so a test can turn it on and put it back. */
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

/**
 * Spend a life until it runs out.
 *
 * At idle focus with no rations, `advance_days` is the survival layer doing
 * what it does; nothing here decides the death and nothing here asserts one
 * happened before the engine says so.
 */
async function liveUntilItEnds(harness: Harness): Promise<void> {
    for (let i = 0; i < 12; i += 1) {
        if (!harness.game.state().cultivator.alive) return;
        await harness.game.act('ADMIN advance_days years=5');
    }
}

/**
 * The one call `game.ts` will make at the line that declares a player dead.
 *
 * Assembled here rather than reached through `act`, because the wiring in
 * `game.ts` is held by another agent and the hunk is handed over separately.
 * Everything it touches is the real database and the real world.
 */
async function settle(harness: Harness, standingOver: { id: string; name: string }[] = []) {
    const run = harness.repos.runs.getById(harness.game.state().run.id)!;
    const cultivator = harness.repos.cultivators.getById(run.cultivatorId)!;
    const world = await worldForRun(run);
    const outcome = settleWhatTheyWereCarrying({
        db: harness.db,
        world,
        ledger: new LegacyLedger(harness.db),
        cultivator,
        runId: run.id,
        causeNote: `Died of ${run.deathCause ?? 'something the row does not name'}.`,
        standingOver
    });
    await saveWorldForRun(run);
    return { outcome, cultivator, world, run };
}

function pouchRows(harness: Harness, cultivatorId: string): number {
    return (harness.db
        .prepare('SELECT COUNT(*) AS n FROM cultivator_pouch WHERE cultivator_id = ? AND quantity > 0')
        .get(cultivatorId) as { n: number }).n;
}

describe('a death moves what the dead were carrying', () => {
    it('empties the body into the ground where they fell, and the world records it', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'estate-alone', worldSeed: 'estate-world' });
            const { game, db } = harness;
            const { cultivator } = await game.newRun('Shen Ke');
            const place = game.state().cultivator.location;

            // A rated object the world holds a row for and nobody is holding.
            // The two the seeder leaves unpossessed are the only ones a player
            // can come to hold without a house losing its property, which is
            // itself a finding and is reported rather than worked around.
            await game.act('ADMIN grant_item itemId=artifact-the-severed-ledger-blade');
            await game.act('ADMIN grant_item itemId=pill-qi-gathering quantity=2');
            await game.act('ADMIN grant_item itemId=herb-qi-grass quantity=3');

            expect(pouchRows(harness, cultivator.id)).toBeGreaterThan(0);
            const stonesHeld = game.state().cultivator.spiritStones;
            expect(stonesHeld).toBeGreaterThan(0);

            await liveUntilItEnds(harness);
            expect(game.state().cultivator.alive).toBe(false);

            const { outcome, world } = await settle(harness);

            // ── THE BODY ─────────────────────────────────────────────────
            expect(pouchRows(harness, cultivator.id)).toBe(0);
            expect((db.prepare('SELECT spirit_stones AS s FROM cultivators WHERE id = ?')
                .get(cultivator.id) as { s: number }).s).toBe(0);

            // ── THE GROUND ───────────────────────────────────────────────
            expect(outcome.estate.destination).toBe('in the ground');
            expect(outcome.cache).not.toBeNull();
            expect(outcome.cache!.place).toBe(place);
            expect(outcome.cache!.goods.spiritStones).toBe(stonesHeld);
            expect(outcome.cache!.goods.items.map(i => i.itemId).sort())
                .toEqual(['herb-qi-grass', 'pill-qi-gathering']);
            const site = db
                .prepare("SELECT kind, discovered FROM cultivation_sites WHERE id = ?")
                .get(outcome.cache!.id) as { kind: string; discovered: number };
            expect(site.kind).toBe('cache');
            // Nobody has found it. It is not a discovered site.
            expect(site.discovered).toBe(0);

            // ── THE TRACKED ROW, WITH THEIR NAME IN ITS CHAIN ────────────
            //
            // The state the brief reported a player could not reach. It is one
            // row in `world_object_provenance` keyed on the player's own id.
            const naming = db
                .prepare('SELECT COUNT(*) AS n FROM world_object_provenance WHERE holder_id = ?')
                .get(cultivator.id) as { n: number };
            expect(naming.n).toBeGreaterThan(0);

            const blade = getObject(world, 'artifact-the-severed-ledger-blade');
            expect(blade).not.toBeNull();
            expect(blade!.possessorId).toBeNull();
            expect(blade!.ownerId).toBe(cultivator.id);
            expect(blade!.provenance.some(p => p.previousHolderId === cultivator.id)).toBe(true);

            // ── THE RECORD ───────────────────────────────────────────────
            expect(outcome.factIds.length).toBeGreaterThan(0);
            const actors = db
                .prepare('SELECT COUNT(*) AS n FROM world_chronicle_actors WHERE actor_id = ?')
                .get(cultivator.id) as { n: number };
            expect(actors.n).toBeGreaterThan(0);
            const graves = db
                .prepare("SELECT COUNT(*) AS n FROM world_locations WHERE kind = 'grave'")
                .get() as { n: number };
            expect(graves.n).toBeGreaterThan(0);
        });
    }, 300000);

    it('lets the next life dig it up at the place the last one fell', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'estate-dig', worldSeed: 'estate-world-dig' });
            const { game } = harness;
            await game.newRun('Shen Ke');
            const place = game.state().cultivator.location;

            await game.act('ADMIN grant_item itemId=pill-qi-gathering quantity=2');
            const stonesLeft = game.state().cultivator.spiritStones;

            await liveUntilItEnds(harness);
            expect(game.state().cultivator.alive).toBe(false);
            await settle(harness);

            // The next life, in the same world, standing on the same ground.
            await game.act('ADMIN reset Lu Wen');
            const heir = game.state().cultivator;
            expect(heir.alive).toBe(true);
            await game.act(`ADMIN set_location location=${place}`);
            expect(game.state().cultivator.location).toBe(place);

            const before = game.state().cultivator.spiritStones;
            await game.act('I dig here for anything somebody left in the ground');
            const after = game.state();

            // State, not prose: the purse moved and the stock arrived.
            expect(after.cultivator.spiritStones).toBe(before + stonesLeft);
            expect(pouchRows(harness, after.cultivator.id)).toBeGreaterThan(0);
        });
    }, 300000);

    it('hands it to somebody standing over the body instead of the ground', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'estate-taken', worldSeed: 'estate-world-taken' });
            const { game, db } = harness;
            const { cultivator } = await game.newRun('Shen Ke');

            await game.act('ADMIN grant_item itemId=artifact-azure-sword-tally');
            const stonesHeld = game.state().cultivator.spiritStones;

            await liveUntilItEnds(harness);
            expect(game.state().cultivator.alive).toBe(false);

            const run = harness.repos.runs.getById(game.state().run.id)!;
            const world = await worldForRun(run);
            const watcher = world.npcs.find(n => n.status === 'alive' && n.id !== cultivator.id)!;
            const purseBefore = watcher.spiritStones;

            const { outcome } = await settle(harness, [{ id: watcher.id, name: watcher.name }]);

            expect(outcome.estate.destination).toBe('taken');
            expect(outcome.cache).toBeNull();
            expect(db.prepare("SELECT COUNT(*) AS n FROM cultivation_sites WHERE kind = 'cache'")
                .get()).toEqual({ n: 0 });

            const after = await worldForRun(run);
            expect(getNpc(after, watcher.id)!.spiritStones).toBe(purseBefore + stonesHeld);

            const tally = getObject(after, 'artifact-azure-sword-tally')!;
            expect(tally.possessorId).toBe(watcher.id);
            // Taking a thing does not make it yours.
            expect(tally.ownerId).toBe(cultivator.id);
            expect(tally.provenance.some(p => p.how === 'looted' && p.previousHolderId === cultivator.id))
                .toBe(true);

            // And the world knows they are dead, which it did not before.
            expect(getNpc(after, cultivator.id)!.status).not.toBe('alive');
        });
    }, 300000);
});
