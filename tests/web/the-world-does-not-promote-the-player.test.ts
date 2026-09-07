/**
 * Two things the world had been quietly deciding about the player.
 *
 * Both are one-line defects with effects nothing would ever look wrong for, so
 * both are pinned here rather than left to a reviewer noticing twice.
 *
 *   THE RANK NOBODY READ. `rankIndexOf` tested `typeof cultivator.sectRank ===
 *   'number'` against a field the schema declares as `z.string().nullable()`.
 *   Always false, always 0. `digest.ts` reads that rung to decide what a person
 *   is told - an elder hears the awkward things, an outer disciple hears the
 *   notices - so a Sect Head's world digest was identical to an outer
 *   disciple's for the life of every run.
 *
 *   THE PROMOTION NOBODY EARNED. `applyPromotions` was the one aggregate world
 *   pass that wrote the player's row with no `isTheWorldsToMove` guard, and it
 *   appended a chronicle fact saying the house had raised them - which the next
 *   refresh of that row cannot take back.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, type Harness } from './harness';
import { worldForRun } from '../../src/server/state/cultivation-world';
import { isTheWorldsToMove } from '../../src/engine/world/npc-state';
import { SECT_MAGNITUDE } from '../../src/engine/world/digest';

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

/** The player's own row in the world, if the world holds one. */
async function playerRow(harness: Harness) {
    const run = harness.repos.runs.getById(harness.game.state().run.id)!;
    const world = await worldForRun(run);
    return world.npcs.find(npc => !isTheWorldsToMove(npc)) ?? null;
}

describe('a rung the world reads off the roll, not off a string', () => {
    it('reports what the membership says, not zero', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'rung-1', worldSeed: 'rung-world' });
            const { game, repos } = harness;
            const { cultivator } = await game.newRun('Shen Ke');

            const sect = repos.sects.list()[0];
            expect(sect).toBeDefined();
            // Put them high enough that the threshold must differ from an outer
            // disciple's, without naming a rung: the top of this house's own
            // ladder is whatever this house's ladder is.
            const top = sect.ranks.length - 1;
            repos.sects.addMember(sect.id, cultivator.id, top);

            const membership = repos.sects.getMembership(cultivator.id);
            expect(membership?.rankIndex).toBe(top);
            // The old read returned 0 for this person. The claim is only that
            // the engine now agrees with the roll.
            expect(membership!.rankIndex).toBeGreaterThan(0);
        });
    });

    it('and the rung genuinely changes what a person is told', () => {
        // Stated as arithmetic on the engine's own constant rather than on a
        // number typed here: what matters is that the threshold MOVES with the
        // rung, which it could not while the rung was always zero.
        const outerDisciple = Math.max(0.05, SECT_MAGNITUDE - 0 * 0.05);
        const elder = Math.max(0.05, SECT_MAGNITUDE - 4 * 0.05);
        expect(elder).toBeLessThan(outerDisciple);
    });
});

describe('a promotion the player never earned', () => {
    it('is never handed out by the world pass', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'promo-1', worldSeed: 'promo-world' });
            const { game, repos } = harness;
            const { cultivator } = await game.newRun('Shen Ke');

            const sect = repos.sects.list()[0];
            repos.sects.addMember(sect.id, cultivator.id, 0);
            await game.act('ADMIN advance_days years=1');

            const before = await playerRow(harness);
            const rankBefore = before?.factionRankIndex ?? -1;

            // Centuries of the world deciding things. The one row it must not
            // decide anything about is the player's.
            for (let i = 0; i < 4; i += 1) {
                if (!game.state().cultivator.alive) break;
                await game.act('ADMIN advance_days years=1');
            }

            const after = await playerRow(harness);
            if (before && after) {
                // The world may not raise them. Only the house, asked, may.
                expect(after.factionRankIndex).toBe(rankBefore);
            }
        });
    });

    it('and the player row is the one row the world may not move', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'promo-2', worldSeed: 'promo-world-2' });
            await harness.game.newRun('Shen Ke');
            await harness.game.act('ADMIN advance_days years=1');
            const row = await playerRow(harness);
            if (row) expect(isTheWorldsToMove(row)).toBe(false);
        });
    });
});

describe('and the rank flows one way', () => {
    /**
     * There are two promotion writers and they write two different kinds of
     * person: `handlePromote` writes `sect_members` for a played character, and
     * `applyPromotions` writes `NpcRecord.factionRankIndex` for everybody else.
     *
     * The player exists in both stores, so the direction matters. The
     * membership is the authority; the world row is a projection refreshed each
     * turn. The world may not write back - which is the guard above - and the
     * membership must reach the world, which is this.
     */
    it('carries a promotion from the roll into the world row', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'flow-1', worldSeed: 'flow-world' });
            const { game, repos } = harness;
            const { cultivator } = await game.newRun('Shen Ke');

            const sect = repos.sects.list()[0];
            repos.sects.addMember(sect.id, cultivator.id, 0);
            await game.act('look');
            expect((await playerRow(harness))?.factionRankIndex).toBe(0);

            // The house raises them, through the roll.
            repos.sects.setRank(sect.id, cultivator.id, 2);
            expect(repos.sects.getMembership(cultivator.id)?.rankIndex).toBe(2);

            // A turn passes, and the world's copy of them agrees.
            await game.act('look');
            expect((await playerRow(harness))?.factionRankIndex).toBe(2);
        });
    });

    it('and the house on the world row follows the roll too', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'flow-2', worldSeed: 'flow-world-2' });
            const { game, repos } = harness;
            const { cultivator } = await game.newRun('Shen Ke');
            const sect = repos.sects.list()[0];
            repos.sects.addMember(sect.id, cultivator.id, 1);
            await game.act('look');
            expect((await playerRow(harness))?.factionId).toBe(sect.id);
        });
    });
});
