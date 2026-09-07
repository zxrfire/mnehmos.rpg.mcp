/**
 * Asking what a thing takes, and trying to buy the makings of it.
 *
 * PLAYED, and this one spent the player's money on the wrong article:
 *
 *   > I buy the materials for a qi-gathering pill
 *   One Qi-Gathering Pill for 26 spirit stone(s). The pill is in the pouch.
 *
 * The buy path resolves its target by name, "qi-gathering pill" sits inside
 * "materials for a qi-gathering pill", and the qualifier that is the whole
 * point of the sentence was read straight past. Somebody stocking a cauldron
 * was sold the finished article.
 *
 * Its question form reached nothing at all - "what do I need for a
 * qi-gathering pill" came back unrecognised - while the formula read has
 * always answered exactly that, down to which ground each herb grows on.
 */

import { describe, expect, it } from 'vitest';
import { makeGame } from './harness';
import { parseIntent } from '../../src/web/actions';

describe('what a thing is made of', () => {
    it('is a read, not a purchase of the finished thing', () => {
        for (const said of [
            'I buy the materials for a qi-gathering pill',
            'I buy the ingredients for a qi-gathering pill',
            'what do I need for a qi-gathering pill',
            'what does a qi-gathering pill need'
        ]) {
            expect(parseIntent(said).action, said).toBe('refine');
        }
    });

    it('and buying the thing itself is still buying it', () => {
        // The near miss. A guard that swallowed the ordinary purchase would
        // have taken a working verb out to fix a phrasing.
        const bought = parseIntent('I buy a qi-gathering pill');
        expect(bought.action).toBe('buy');
        expect(bought.target).toMatch(/qi-gathering pill/i);

        // And a herb by name is how somebody actually stocks the cauldron.
        const herb = parseIntent('I buy qi grass');
        expect(herb.action).toBe('buy');
        expect(herb.target).toMatch(/qi grass/i);
    });

    it('and nothing is spent finding out', async () => {
        const { game, db, repos } = makeGame({ seed: 'makings', worldEnabled: true });
        const { cultivator } = await game.newRun('Maker');
        db.prepare('UPDATE cultivators SET spirit_stones = 6000, realm_ordinal = 14 WHERE id = ?')
            .run(cultivator.id);
        await game.act('I look around');

        const before = repos.cultivators.getById(cultivator.id)!.spiritStones;
        const asked = await game.act('I buy the materials for a qi-gathering pill') as unknown as {
            narration: string;
        };
        const after = repos.cultivators.getById(cultivator.id)!.spiritStones;

        expect(after, 'money changed hands for a question').toBe(before);
        // And the answer is the one that was wanted: what it takes.
        expect(asked.narration).toMatch(/Formula/);
        expect(asked.narration).toMatch(/Short of/);
    }, 300_000);
});
