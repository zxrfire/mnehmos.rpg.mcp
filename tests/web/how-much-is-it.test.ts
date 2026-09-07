/**
 * Asking the price of a named thing.
 *
 * PLAYED: "how much is a healing pill" was answered with all FORTY-THREE things
 * on the board, beginning with a bowl of millet - and the pill was not among
 * the lines shown. The very next sentence bought one for 44 spirit stones, so
 * the figure existed the whole time.
 *
 * The subject was thrown away twice: `extractSubject` had no pattern for "how
 * much is", and the market handler read its target only for a CATEGORY word,
 * which the name of a thing is not.
 */

import { describe, expect, it } from 'vitest';
import { makeGame } from './harness';
import { parseIntent } from '../../src/web/actions';

describe('asking what a thing costs', () => {
    it('carries the thing that was named', () => {
        for (const said of [
            'how much is a healing pill',
            'what is the price of a healing pill',
            'the cost of a healing pill'
        ]) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('market');
            expect(plan.target, said).toMatch(/healing pill/i);
        }
    });

    it('and answers about that thing rather than the whole board', async () => {
        const { game, db } = makeGame({ seed: 'how-much', worldEnabled: true });
        const { cultivator } = await game.newRun('Buyer');
        db.prepare('UPDATE cultivators SET spirit_stones = 4000 WHERE id = ?').run(cultivator.id);
        await game.act('I look around');

        const asked = await game.act('how much is a healing pill') as unknown as {
            narration: string;
        };
        expect(asked.narration).toMatch(/Lesser Healing Pill/);
        expect(asked.narration).toMatch(/spirit stones/);
        // Not the board, which is what this used to be.
        expect(asked.narration).not.toMatch(/Bowl of millet/);
        expect(asked.narration).not.toMatch(/things on offer/);
    }, 300_000);

    it('and quotes the figure the counter actually charges', async () => {
        // ONE PRICING RULE. A quote that disagrees with the till is worse than
        // no quote: the player budgets against it.
        const { game, db, repos } = makeGame({ seed: 'quote-matches', worldEnabled: true });
        const { cultivator } = await game.newRun('Buyer');
        db.prepare('UPDATE cultivators SET spirit_stones = 4000 WHERE id = ?').run(cultivator.id);
        await game.act('I look around');

        const asked = await game.act('how much is a healing pill') as unknown as {
            narration: string;
        };
        const quoted = /which is (\d+) spirit stone/.exec(asked.narration)?.[1];
        expect(quoted, 'no figure was quoted').toBeDefined();

        const before = repos.cultivators.getById(cultivator.id)!.spiritStones;
        await game.act('I buy a healing pill');
        const after = repos.cultivators.getById(cultivator.id)!.spiritStones;
        expect(before - after).toBe(Number(quoted));
    }, 300_000);

    it('and still shows the whole board when no thing was named', async () => {
        const { game } = makeGame({ seed: 'the-board', worldEnabled: true });
        await game.newRun('Buyer');
        await game.act('I look around');
        const board = await game.act('what is for sale') as unknown as { narration: string };
        expect(board.narration).toMatch(/things on offer/);
    }, 300_000);
});
