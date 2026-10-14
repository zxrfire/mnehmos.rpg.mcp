/**
 * The world moves while the player does.
 *
 * Forty years in a cave must come out into a world that had forty years. These
 * tests pin the join at this layer's end: the same span reaches both clocks,
 * the digest reaches the narrator but its arithmetic does not, and a new life
 * begins in the world the last one left.
 *
 * The world itself is owned by `src/server/state/cultivation-world.ts`. This
 * layer holds no world of its own - an earlier version of these tests exercised
 * a second `WorldSession` living here, which was exactly the duplication that
 * had to go.
 *
 * Seeding a world is not cheap, so `worldEnabled` is off by default in the
 * harness and every test here turns it on deliberately, with both seeds pinned.
 * The integrated log shares its mechanical channel with the player: unheard
 * accounting stays on the native digest instead of becoming news. Absolute
 * date subtraction is checked at floating-point precision, without rounding
 * away any fraction of the lived span.
 */

import { describe, it, expect } from 'vitest';
import { KnowledgeGate } from '../../src/web/knowledge';
import { reportFromDigest } from '../../src/web/game';
import { worldForRun, resetCultivationWorlds } from '../../src/server/state/cultivation-world';
import { makeGame, makeGameInWorld, engineCalls } from './harness';
import type { PlayerDigest } from '../../src/engine/world/digest.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';

function inWorld(seed: string) {
    return makeGameInWorld({ seed, worldSeed: `world-clock-${seed}`, worldEnabled: true });
}

describe('one span, both clocks', () => {
    it('advances the world by exactly the days the cultivator lived', async () => {
        resetCultivationWorlds();
        const { db, game } = await inWorld('clocks');
        const { cultivator } = await game.newRun('Wen Shu');
        db.prepare('UPDATE cultivators SET spirit_stones = 900 WHERE id = ?').run(cultivator.id);

        const openedAt = game.state().run.elapsedDays;
        const before = routineTime(await worldForRun(game.state().run as never));
        const { timeSkip, state } = await game.cultivate(20 * 365, { anyway: true });
        const after = routineTime(await worldForRun(game.state().run as never));

        // Not the days requested. A seclusion broken in year three does not get
        // seventeen more years of world.
        // The run starts at 08:00; the spent span still reaches both clocks exactly.
        expect(state.run.elapsedDays - openedAt).toBe(timeSkip.simulatedDays);
        expect(timeSkip.simulatedDays).toBeGreaterThan(0);
        expect(after - before).toBeCloseTo(timeSkip.simulatedDays, 8);
    }, 60_000);

    it('reports what reached the player, on the narratable channel', async () => {
        resetCultivationWorlds();
        const { db, game } = await inWorld('digest');
        const { cultivator } = await game.newRun('Wen Shu');
        db.prepare('UPDATE cultivators SET spirit_stones = 900 WHERE id = ?').run(cultivator.id);

        const result = await game.act('I sit in seclusion for eighty years anyway.');
        const worldRows = engineCalls(result).filter(c => c.name === 'world.advanceWorldForPlay');

        expect(worldRows.length).toBeGreaterThan(0);
        expect(worldRows.map(r => r.summary).join(' ')).toMatch(/World digest:/);
    }, 60_000);

    it('never puts the arithmetic of what was withheld into the prose', async () => {
        resetCultivationWorlds();
        const { db, game } = await inWorld('ratio');
        const { cultivator } = await game.newRun('Nobody');
        db.prepare('UPDATE cultivators SET spirit_stones = 900 WHERE id = ?').run(cultivator.id);

        const result = await game.act('I sit in seclusion for eighty years anyway.');

        // How much a player never heard about is a fact about the simulation.
        // The moment it becomes a sentence, "the world is mostly none of your
        // business" turns into a status line.
        expect(result.narration).not.toMatch(/no channel at all/i);
        expect(result.narration).not.toMatch(/\bunheard\b/i);
        expect(result.narration).not.toMatch(/World digest/);
        expect(result.narration).not.toMatch(/magnitude=|occurrences=/);
    }, 60_000);

    it('does not move the world for an action that costs no time', async () => {
        resetCultivationWorlds();
        const { game } = await inWorld('free');
        await game.newRun('Watcher');

        const result = await game.act('I look around.');
        expect(engineCalls(result).some(c => c.name === 'world.advanceWorldForPlay')).toBe(false);
    }, 60_000);

    it('keeps playing when the world is switched off', async () => {
        const { game } = makeGame({ seed: 'worldless' });
        expect(game.worldEnabled).toBe(false);
        await game.newRun('Alone');

        const { timeSkip } = await game.cultivate(365, { anyway: true });
        expect(timeSkip.simulatedDays).toBeGreaterThan(0);
    });
});

describe('a life begins in the world the last one left', () => {
    it('draws the new seed from the world rather than inventing one', async () => {
        resetCultivationWorlds();
        const { db, game } = await inWorld('legacy');
        const { cultivator } = await game.newRun('The First');

        // Kill the first life so there is a world with a finished run in it.
        db.prepare('UPDATE cultivators SET spirit_stones = 0 WHERE id = ?').run(cultivator.id);
        for (let i = 0; i < 20 && game.state().run.status === 'active'; i++) {
            await game.cultivate(2000, { anyway: true }).catch(() => undefined);
        }
        expect(game.state().run.status).toBe('dead');

        const firstSeed = game.state().run.id;
        const next = await game.newRun('The Second');

        expect(next.run.id).not.toBe(firstSeed);
        // The world's note about how this life stands to the last one reaches
        // the log, which is the only place the relation is stated.
        const opening = game.state().log
            .filter(e => e.role === 'narrator')
            .map(e => e.text)
            .join('\n');
        expect(opening).toMatch(/connection|Descended|Studied under|first life/i);
    }, 120_000);
});

describe('the digest folding', () => {
    it('reports nothing when there is no digest', () => {
        expect(reportFromDigest(null)).toEqual({ lines: [], structure: [] });
    });

    it('retains native unheard accounting while emitting no received news', () => {
        const digest: PlayerDigest = {
            fromDay: 0, toDay: 365, lines: [], unheard: 41, unattributed: 3,
            headline: 'No news reached them.'
        };
        const before = structuredClone(digest);
        const report = reportFromDigest(digest);
        expect(report).toEqual({ lines: [], structure: [] });
        expect(digest).toEqual(before);
    });

    it('puts the line text on the narratable channel and the shape on the other', () => {
        const report = reportFromDigest({
            fromDay: 0,
            toDay: 365,
            unheard: 900,
            unattributed: 12,
            lines: [{
                factId: 'f1',
                occurrences: 3,
                day: 100,
                year: 1002,
                kind: 'faction_conflict',
                channel: 'market',
                form: 'unattributed',
                text: 'The road through the valley has been shut for a season and nobody will say by whom.',
                namableFactionIds: [],
                namableNpcIds: [],
                magnitude: 2
            }]
        } as never);

        expect(report.lines[0]).toContain('The road through the valley');
        expect(report.lines[0]).toContain('3 times over the span');
        // The counts and the channel names stay off the prose channel.
        expect(report.lines.join(' ')).not.toMatch(/unheard|magnitude|channel/);
        expect(report.structure.join(' ')).toMatch(/900 event\(s\)/);
        expect(report.structure.join(' ')).toMatch(/via market/);
    });
});

describe('the seam with the knowledge gate', () => {
    it('is the same table both layers read', async () => {
        resetCultivationWorlds();
        const { db, game } = await inWorld('seam');
        const { cultivator } = await game.newRun('Villager');
        const gate = new KnowledgeGate(db);

        // The world layer's access is built from this gate, so what the player
        // has heard of on this side is what they can be told on that side. One
        // contract, not a translation.
        const heard = gate.awareness(cultivator.id, 'sect');
        expect(heard.length).toBeGreaterThan(0);
        expect(gate.isAwareOf(cultivator.id, 'sect', heard[0].id)).toBe(true);
        expect(gate.isAwareOf(cultivator.id, 'sect', 'faction-that-does-not-exist')).toBe(false);
    }, 60_000);
});
