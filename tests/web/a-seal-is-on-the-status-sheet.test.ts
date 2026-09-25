/**
 * Somebody under a qi seal is told so when they ask how they stand.
 *
 * A seal lids the pool at a tenth and stops the ground feeding them - see
 * `a-qi-seal-is-put-on-a-person.ts` - and a house can lay one on the player
 * (`a-room-hands-down-what-it-decided.ts`). The status sheet said nothing about
 * it: a sealed player asked how they were doing and was told their progress
 * toward a rung they could no longer draw toward. `whatTheSealLooksLike` had
 * the sentence and no caller.
 *
 * Their own seal is a thing they know, so it is on their own sheet. Red-checked
 * by removing the status line: the second assertion fails.
 */
import { describe, expect, it } from 'vitest';

import { makeGame } from './harness';

describe('a seal on the status sheet', () => {
    it('is said when one is on them, and not when none is', async () => {
        const { game, repos } = makeGame({ seed: 'a-sealed-life' });
        const { cultivator } = await game.newRun('Lu Ping');

        const unsealed = await game.act('status');
        expect(unsealed.narration).not.toMatch(/qi seal/i);

        repos.cultivators.update(cultivator.id, {
            qiSeal: { liftsOnDay: 1_000_000, byId: null, note: 'Held by their house.', sinceDay: 0 }
        });
        const sealed = await game.act('status');
        expect(sealed.narration).toMatch(/qi seal/i);
        expect(sealed.narration).toMatch(/days? left on it/);
    });
});
