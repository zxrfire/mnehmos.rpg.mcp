/**
 * A number a player types is a number the engine has to answer for.
 *
 * The same family as the silent cultivation clamp: the engine reads a figure,
 * quietly substitutes its own, and reports its own as though it were what was
 * asked. Two more of them, both found by edge-case probing.
 */

import { parseIntent } from '../../src/web/actions';
import { makeGame } from './harness';

describe('a count of rations', () => {
    /**
     * "buy rations" reached provisioning and "buy 20 rations" did not - the
     * clause had no numeric alternative, so it fell through to the eat rule,
     * which matches any `rations?`, and bought ONE MEAL. A player who named a
     * number got it silently discarded; a player who was not hungry got "you
     * are not hungry", which reads as though provisioning were impossible.
     */
    it('provisions, rather than buying a single meal', () => {
        for (const text of ['I buy 20 rations', 'I buy 500 rations', 'I buy twenty rations']) {
            expect(parseIntent(text).action, text).toBe('provision');
        }
    });

    it('carries the number through', () => {
        expect(parseIntent('I buy 20 rations').rations).toBe(20);
        expect(parseIntent('I buy 500 rations').rations).toBe(500);
    });

    /**
     * A SPAN and a COUNT are different asks, and the conversion is not the
     * parser's to make: how long a ration lasts depends on the body carrying
     * it, because hunger tapers by realm.
     */
    it('keeps a span a span', () => {
        expect(parseIntent('I buy 2 years of rations').days).toBe(730);
        expect(parseIntent('I buy 2 years of rations').rations).toBeUndefined();
        expect(parseIntent('I buy rations').rations).toBeUndefined();
    });

    it('still lets somebody eat a meal', () => {
        expect(parseIntent('I eat a meal').action).toBe('eat');
        expect(parseIntent('I buy food').action).toBe('eat');
    });

    it('actually buys the number named', async () => {
        const { db, game } = makeGame({ seed: 'rations-count', worldEnabled: true });
        const { cultivator } = await game.newRun('Eater');
        db.prepare('UPDATE cultivators SET spirit_stones = 50000 WHERE id = ?').run(cultivator.id);

        const acted = await game.act('I buy 20 rations');

        expect(acted.narration).toMatch(/20 rations/);
        expect(acted.narration).not.toMatch(/not hungry/);
    }, 60_000);
});

describe('a span longer than the engine will price', () => {
    /**
     * `parseDuration` caps at MAX_CULTIVATION_DAYS, so nine thousand years of
     * rations arrived as a hundred and the account reported a hundred as though
     * that were the ask. The honest form was already three lines away: a purse
     * that covers less than the ask says "which is less than you went in for".
     */
    it('says it was cut down, rather than reporting its own figure as the ask', async () => {
        const { db, game } = makeGame({ seed: 'rations-clamp', worldEnabled: true });
        const { cultivator } = await game.newRun('Eater');
        db.prepare('UPDATE cultivators SET spirit_stones = 50000 WHERE id = ?').run(cultivator.id);

        const acted = await game.act('I buy 9999 years of rations');

        expect(acted.narration).toMatch(/9999 years was asked for/);
        expect(acted.narration).toMatch(/100 years/);
    }, 60_000);

    it('says nothing about a clamp when nothing was clamped', async () => {
        const { db, game } = makeGame({ seed: 'rations-noclamp', worldEnabled: true });
        const { cultivator } = await game.newRun('Eater');
        db.prepare('UPDATE cultivators SET spirit_stones = 50000 WHERE id = ?').run(cultivator.id);

        const acted = await game.act('I buy 2 years of rations');

        expect(acted.narration).not.toMatch(/was asked for/);
    }, 60_000);
});
