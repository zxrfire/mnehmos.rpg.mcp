/**
 * A finished subsystem that had no route from the player to it.
 *
 * `engine/social-leverage/` is a pressure model with four outcomes - taken,
 * refused, reported, turned - tone, leverage, audience, concealment, patience,
 * alignment-dependent fallout and delayed discovery, with 34 passing tests.
 * NPCs ran it on each other. The player got:
 *
 *   "I bribe the gate guard" -> "You put the words to Shen Wanshi. They look at
 *   you the way people look at a sentence with a hole in it."
 *
 * with the inspector saying `Stated intent: bribe. Carried for the narrator;
 * read by no conditional.` That is the AGENTS.md defect named first in the
 * file: a system built for the simulation that does not reach the played game.
 */

import { parseIntent } from '../../src/web/actions';
import { makeGame, engineCalls } from './harness';

describe('the verbs that put something on the table', () => {
    /**
     * `attachment` is already a member of `ApproachLeverageSchema`, priced by
     * the same machine as coin and force, so seduction needs no subsystem. The
     * parser names the leverage; nothing downstream branches on the verb.
     */
    it('recognises seduction and names its leverage', () => {
        for (const text of [
            'I try to charm the nearest cultivator',
            'I seduce the steward',
            'I woo the gate warden',
            'I flatter the elder'
        ]) {
            const parsed = parseIntent(text);
            expect(parsed.action, text).toBe('interact');
            expect(parsed.intent, text).toBe('seduce');
            expect(parsed.leverage, text).toBe('attachment');
        }
    });

    it('names the leverage behind coin and force too', () => {
        expect(parseIntent('I bribe the gate guard').leverage).toBe('coin');
        expect(parseIntent('I threaten the clerk').leverage).toBe('force');
    });

    /**
     * The guard the handing-off agent asked for by name: `seduce` sits ahead of
     * `negotiate` so it does not eat "beg", and `negotiate` still owns it.
     */
    it('does not eat beg', () => {
        // "for help" reaches `grant` through an earlier branch, which predates
        // this and is correct. What matters here is that `seduce` does not take
        // it: `flatter` and `beg` are neighbours in the same sentence shape,
        // which is exactly why the row was placed ahead of `negotiate`.
        expect(parseIntent('I beg the elder').intent).toBe('negotiate');
        expect(parseIntent('I beg the elder for help').intent).not.toBe('seduce');
    });

    it('leaves an ordinary conversation alone', () => {
        expect(parseIntent('I talk to the innkeeper').intent).toBe('talk');
        expect(parseIntent('I talk to the innkeeper').leverage).toBeUndefined();
    });
});

describe('an attempt actually resolves', () => {
    it('reports an outcome, the odds, the days and every term', async () => {
        const { db, game } = makeGame({ seed: 'press', worldEnabled: true });
        const { cultivator } = await game.newRun('Presser');
        db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?').run(cultivator.id);
        await game.act('I look around');

        const acted = await game.act('I try to charm the nearest cultivator');

        // Not the dead end any more.
        expect(acted.narration).not.toMatch(/a sentence with a hole in it/);
        expect(acted.narration).not.toMatch(/Nothing is settled by it/);

        const call = engineCalls(acted).find(c => c.name === 'engine.resolveAttempt');
        expect(call, 'the resolver was never called').toBeDefined();
        // Four outcomes, one of them.
        expect(call!.summary).toMatch(/^(taken|refused|reported|turned) at/);
        // The days reach the clock: an attempt that costs nothing is not play.
        expect(call!.summary).toMatch(/\d+ day\(s\)/);
        // Every term named. The only thing that will ever reveal one has gone
        // wrong, and the reason it is on the mechanical channel.
        expect(call!.summary).toMatch(/Terms: .*base=/);
        expect(call!.summary).toMatch(/leverage=attachment/);
    }, 120_000);
});
