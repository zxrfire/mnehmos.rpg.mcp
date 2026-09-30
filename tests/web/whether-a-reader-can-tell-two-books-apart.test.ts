/**
 * Asked about a book, the answer sets it beside the one the player already works,
 * and says whether this reader can see which is better written (`canTellApart`).
 */

import { describe, expect, it } from 'vitest';

import { TECHNIQUES } from '../../src/data/cultivation/techniques';
import { canTellApart } from '../../src/engine/cultivation/manual-quality';
import { makeGame } from './harness';

describe('asked about a book, beside the one they work', () => {
    it('says whether this reader can tell the two apart, and it is the engine\'s answer', async () => {
        const { game, repos } = makeGame({ seed: 'two-books' });
        const { cultivator } = await game.newRun('Reader');
        const held = TECHNIQUES.find(t => t.requiredOrdinal === 0 && t.category === 'cultivation')!;
        repos.techniques.upsert(held);
        repos.techniques.learn(cultivator.id, held.id, 0.1);
        const me = repos.cultivators.getById(cultivator.id)!;
        // No word shared with the held book's name, which the resolver prefers.
        const words = new Set(held.name.toLowerCase().split(/[\s-]+/));
        const other = TECHNIQUES.find(t =>
            t.id !== held.id && t.category === held.category && t.quality !== held.quality
            && t.survivingCopy
            && !t.name.toLowerCase().split(/[\s-]+/).some(word => words.has(word)))!;
        expect(other).toBeDefined();

        const said = await game.act(`what would it take to learn ${other.name}`);
        const expected = canTellApart(other, held, me)
            ? `Beside ${held.name}, you can tell the two apart`
            : `Beside ${held.name}, you cannot tell which of the two is the better written.`;
        expect(said.narration, other.name).toContain(expected);
    }, 200_000);
});
