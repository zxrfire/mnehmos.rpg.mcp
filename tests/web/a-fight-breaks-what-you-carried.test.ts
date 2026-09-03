/**
 * A fight takes the weapon, and the record says whose it was.
 *
 * ── THE GAP THIS PINS ────────────────────────────────────────────────────
 *
 * `ConfrontationResult.brokenObjects` has been filled by the resolver for as
 * long as a weapon could be passed to it, and nothing in the played game read
 * it. A player's blade came apart inside the resolution - the fight was even
 * repriced without it, mid-round - and it was still whole in their pouch when
 * the turn ended. `applyBoutBreakages` in `gatherings.ts` and
 * `writeBackWhatBroke` in `war-melee.ts` are the world's two halves of that
 * writeback; the player had none.
 *
 * ── WHAT IS ACTUALLY BEING ASSERTED ──────────────────────────────────────
 *
 * Two writes, because a player's holding is written down twice. The pouch row
 * goes; the world row is RUINED and kept, with its owner, its claims and every
 * link of its provenance, plus one more saying where it ended. Breaking
 * somebody's thing does not transfer it, so ownership must not move.
 *
 * And the tier below it, which needs no branch and must not grow one: a
 * `mundane` row is a KIND standing in for several hundred of the thing, the
 * seeder seats none of them, so there is no row to ruin and nowhere to write
 * the scar. The pouch write still happens. That is
 * `docs/world/things/items.md`'s counted tier arriving on its own.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld, type Harness } from './harness.js';
import { activeWorld } from '../../src/server/state/cultivation-world.js';
import { getArtifact } from '../../src/data/cultivation/artifacts.js';
import { isRuined } from '../../src/engine/world/possessions.js';

/**
 * A rung at which an ordinary house artifact is scrap in your hand.
 *
 * Both fighters stand here, so the GAP is nothing and it is a real fight
 * rather than a no-contest - and the blade is fourteen rungs under the body it
 * is swung into, which is past two realms and therefore not a chance. Those
 * are two different subtractions and the test needs both, which is why the
 * opponent is set to the player's own height rather than towering over them.
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
        .prepare('SELECT quantity AS q FROM cultivator_pouch WHERE cultivator_id = ? AND item_id = ?')
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
 * Swing until the fight is over.
 *
 * A fight is held open across turns now, so one `attack` is one round. The
 * budget is the engine's; this only has to outlast it, and it stops the moment
 * nothing is standing.
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

describe('a fight breaks what the player was carrying', () => {
    it('takes the pouch row and ruins the world row, keeping its owner', async () => {
        await withAdmin(async () => {
            // Held by nobody in the world, so the player comes to hold it
            // without a house quietly losing property - and rated sixteen,
            // which a body at thirty is several realms past.
            const id = 'artifact-azure-sword-tally';
            const catalogRow = getArtifact(id)!;
            expect(catalogRow.power).toBe(16);

            const harness = await aFightCarrying('broke-tally', id);
            expect(pouchCount(harness, id)).toBe(1);

            const before = (await activeWorld()).state.objects.find(o => o.id === id)!;
            expect(isRuined(before)).toBe(false);
            const linksBefore = before.provenance.length;

            await fightItOut(harness);

            // ── THE POUCH ────────────────────────────────────────────────
            expect(pouchCount(harness, id)).toBe(0);

            // ── THE RECORD ───────────────────────────────────────────────
            const after = (await activeWorld()).state.objects.find(o => o.id === id)!;
            expect(isRuined(after)).toBe(true);
            expect(after.possessorId).toBeNull();
            expect(after.power).toBeNull();
            // Spent is not gone. The row, the name and the whole chain stay,
            // and it gains one link saying where it ended.
            expect(after.name).toBe(catalogRow.name);
            expect(after.provenance).toHaveLength(linksBefore + 1);
            expect(after.provenance[after.provenance.length - 1].how).toBe('lost');

            // ── AND OWNERSHIP DID NOT MOVE ───────────────────────────────
            // Breaking somebody's thing is not a way of acquiring it. This is
            // the thread that makes the object findable, and it is the one
            // assertion here that would still matter two centuries later.
            expect(after.ownerId).toBe(catalogRow.ownerId);
            expect(after.ownerId).toBe('sect-azure-cloud-pavilion');
        });
    }, 60_000);

    it('tells the player they are unarmed, and who still owns the pieces', async () => {
        await withAdmin(async () => {
            const harness = await aFightCarrying('broke-said', 'artifact-azure-sword-tally');
            const said = await fightItOut(harness);

            // Said, not merely written. A consequence computed and shown to
            // nobody is the same as one that did not happen - and a player who
            // is not told they are unarmed goes on playing as though they are
            // not.
            expect(said).toContain('You are not carrying A Sword Elder\'s Tally any more.');
            expect(said).toContain('The Azure Cloud Pavilion');
        });
    }, 60_000);

    it('takes a counted thing off them with no row to ruin, and no branch saying so', async () => {
        await withAdmin(async () => {
            // A notched sabre off a dead bandit. `significance: 'mundane'`, so
            // it is a KIND and the seeder seats no row for it - which is
            // exactly why there is nowhere to write a scar. The pouch write is
            // the whole of what happens, and that is correct.
            const id = 'artifact-notched-sabre';
            expect(getArtifact(id)!.significance).toBe('mundane');

            const harness = await aFightCarrying('broke-sabre', id);
            expect(pouchCount(harness, id)).toBe(1);

            await fightItOut(harness);

            expect(pouchCount(harness, id)).toBe(0);
            expect((await activeWorld()).state.objects.some(o => o.id === id)).toBe(false);
        });
    }, 60_000);
});
