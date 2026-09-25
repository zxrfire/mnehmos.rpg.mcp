/**
 * A fight breaks the weapon, and the player keeps it, broken.
 *
 * ── THE GAP THIS PINS ────────────────────────────────────────────────────
 *
 * `ConfrontationResult.brokenObjects` has been filled by the resolver for as
 * long as a weapon could be passed to it, and nothing in the played game read
 * it. `applyBoutBreakages` in `gatherings.ts` and `writeBackWhatBroke` in
 * `war-melee.ts` are the world's two halves of that writeback; the player's is
 * `whatTheFightBroke`.
 *
 * ── WHAT IS ACTUALLY BEING ASSERTED ──────────────────────────────────────
 *
 * Owner ruling 2026-09-25: a broken thing is not destroyed or removed, keeps
 * its grade, and works at half. So the pouch row stays, and the world row is
 * broken in the same hands, with its owner, its claims and every link of its
 * provenance, plus one more saying where it broke. A `mundane` pouch thing has
 * no row, so one comes off the stack and is written as a row, broken, in the
 * player's hands.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld, type Harness } from './harness.js';
import { activeWorld } from '../../src/server/state/cultivation-world.js';
import { getArtifact } from '../../src/data/cultivation/artifacts.js';
import { isRuined } from '../../src/engine/world/possessions.js';
import { isBroken } from '../../src/engine/world/object-damage.js';

/**
 * A rung at which an ordinary house artifact is several realms outclassed.
 *
 * Both fighters stand here, so the GAP is nothing and it is a real fight
 * rather than a no-contest - and the blade is fourteen rungs under the body it
 * is swung into, which is past three realms and therefore a break.
 */
const BOTH_STAND_AT = 30;

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

function pouchCount(harness: Harness, itemId: string): number {
    const row = harness.db
        .prepare('SELECT quantity AS q FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?')
        .get(harness.game.state().cultivator.id, itemId) as { q: number } | undefined;
    return row?.q ?? 0;
}

/** A player at a real rung, carrying `itemId`, in a fight they can actually have. */
async function aFightCarrying(seed: string, itemId: string): Promise<Harness> {
    const harness = await makeGameInWorld({
        seed, worldSeed: 'broke-what-you-carried', adminMode: true
    });
    await harness.game.newRun('Shen Yue');
    await harness.game.act(`ADMIN set_realm ordinal=${BOTH_STAND_AT}`);
    await harness.game.act(`ADMIN grant_item itemId=${itemId}`);
    await harness.game.act(`ADMIN spawn_encounter ordinal=${BOTH_STAND_AT} name=Yun Shizhen`);
    return harness;
}

/**
 * Swing until the fight is over. A fight is held open across turns, so one
 * `attack` is one round; this only has to outlast the engine's budget.
 */
async function fightItOut(harness: Harness): Promise<string> {
    const said: string[] = [];
    for (let round = 0; round < 12; round++) {
        const answer = await harness.game.act('I attack Yun Shizhen');
        said.push(answer.narration);
        if (!harness.game.state().cultivator.alive) break;
        if (!/still standing|round/i.test(answer.narration)) break;
    }
    return said.join('\n');
}

describe('a fight breaks what the player was carrying, and they keep it', () => {
    it('keeps the pouch row and breaks the world row, keeping its owner and its grade', async () => {
        await withAdmin(async () => {
            // Held by nobody in the world, so the player comes to hold it
            // without a house quietly losing property.
            const id = 'artifact-azure-sword-tally';
            const catalogRow = getArtifact(id)!;
            expect(catalogRow.power).toBe(16);

            const harness = await aFightCarrying('broke-tally', id);
            expect(pouchCount(harness, id)).toBe(1);

            const before = (await activeWorld()).state.objects.find(o => o.id === id)!;
            expect(isBroken(before)).toBe(false);
            const linksBefore = before.provenance.length;

            await fightItOut(harness);

            expect(pouchCount(harness, id)).toBe(1);

            const after = (await activeWorld()).state.objects.find(o => o.id === id)!;
            expect(isBroken(after)).toBe(true);
            expect(isRuined(after)).toBe(false);
            expect(after.power).toBe(16);
            expect(after.possessorId).toBe(before.possessorId);
            expect(after.name).toBe(catalogRow.name);
            expect(after.provenance).toHaveLength(linksBefore + 1);

            // Breaking somebody's thing is not a way of acquiring it.
            expect(after.ownerId).toBe(catalogRow.ownerId);
            expect(after.ownerId).toBe('sect-azure-cloud-pavilion');
        });
    }, 60_000);

    it('tells the player it broke, that they still have it, and that it works at half', async () => {
        await withAdmin(async () => {
            const harness = await aFightCarrying('broke-said', 'artifact-azure-sword-tally');
            const said = await fightItOut(harness);
            expect(said).toContain(
                'A Sword Elder\'s Tally broke. You still have it; it keeps its grade and works at half.');
        });
    }, 60_000);

    it('writes a counted thing that broke as a row in their hands, broken', async () => {
        await withAdmin(async () => {
            // A notched sabre off a dead bandit: `mundane`, a KIND the seeder
            // seats no row for. The break needs a row to be written on.
            const id = 'artifact-notched-sabre';
            expect(getArtifact(id)!.significance).toBe('mundane');

            const harness = await aFightCarrying('broke-sabre', id);
            expect(pouchCount(harness, id)).toBe(1);

            await fightItOut(harness);

            expect(pouchCount(harness, id)).toBe(0);
            const playerId = harness.game.state().cultivator.id;
            const kept = (await activeWorld()).state.objects.find(o =>
                o.data.fromThePouch === id && o.possessorId === playerId);
            expect(kept).toBeDefined();
            expect(isBroken(kept!)).toBe(true);
            expect(kept!.power).toBe(getArtifact(id)!.power);

            const carrying = (await harness.game.act('what am I carrying')).narration;
            expect(carrying).toContain('broken, works at half');
        });
    }, 60_000);
});
