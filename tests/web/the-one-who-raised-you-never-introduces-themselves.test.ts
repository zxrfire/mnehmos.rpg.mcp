/**
 * Somebody the player grew up with never gives them their name as though meeting them. Played:
 * the woman who raised the player answered a question, "gave you their name" was written over
 * the row saying she raised them, and the next card handed her over as a stranger.
 */
import { describe, expect, it } from 'vitest';

import { whatTheyAreToYou } from '../../src/web/the-narrator-plays-the-world.js';
import { makeGameInWorld } from './harness.js';

describe('the one who raised you', () => {
    it('keeps the tie when they answer, and is not introduced', async () => {
        const { game } = await makeGameInWorld({ seed: 'raised-by', worldSeed: 'a-fresh-start' });
        const { cultivator, run } = await game.newRun('Wen Qiu');
        const people = game.knowledge.awareness(cultivator.id, 'cultivator');
        const raiser = people.find(row => /raised you/.test(row.statement));
        expect(raiser).toBeDefined();

        expect(game.theyGaveTheirName(cultivator, run, { id: raiser!.id, name: raiser!.name })).toBe(false);
        const after = game.knowledge.awareness(cultivator.id, 'cultivator');
        expect(whatTheyAreToYou(raiser!.name, after)).toMatch(/raised you/);
    }, 180_000);
});
