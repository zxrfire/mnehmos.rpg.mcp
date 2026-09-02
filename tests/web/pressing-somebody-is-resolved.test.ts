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
import { makeGameInWorld, engineCalls } from './harness';

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
    /**
     * ── THIS TEST WAS A COIN FLIP, AND THAT IS WHY IT "ONLY FAILS UNDER
     *    LOAD" ──
     *
     * It used to open with `makeGame({ seed: 'press', worldEnabled: true })`.
     * A run seed is not a world seed: `createWorld` mints `randomUUID()` when
     * the installation has none, so the same run seed against a fresh database
     * meets a different several hundred people every single execution.
     * Measured, eight consecutive runs of exactly this fixture:
     *
     *   He Wanya - refused.  Cao Lanya - refused.  Xiao Zhaoshan - refused.
     *   Qiu Lantao - refused.  Han Lielin - agreed, and took hold of it.
     *
     * A different person and a different outcome each time. Nothing about that
     * is load; a re-run is simply another draw, and the draws that pass are the
     * ones that get reported as "passes in isolation". `AGENTS.md` names this
     * exactly: a played test that pins a seed to an outcome without pinning the
     * world is pinning a coincidence.
     */
    it('reports an outcome, the odds, the days and every term', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'press', worldSeed: 'world-press' });
        const { cultivator } = await game.newRun('Presser');
        db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?').run(cultivator.id);
        await game.act('I look around');

        const acted = await game.act('I try to charm the nearest cultivator');

        // Not the dead end any more.
        expect(acted.narration).not.toMatch(/a sentence with a hole in it/);
        expect(acted.narration).not.toMatch(/Nothing is settled by it/);

        const call = engineCalls(acted).find(c => c.name === 'engine.resolveAttempt');
        expect(call, 'the resolver was never called').toBeDefined();
        // Every claim this used to make, made against the sentence form the
        // channel now speaks. The rewrite kept every figure and resolved every
        // enum, so what changed is the shape and not the content.
        //
        // ── FIVE OUTCOMES, ONE OF THEM ──────────────────────────────────
        //
        // This said "four" and listed three phrasings, and the resolver has had
        // five since `countered` was added - the failure state that is not a
        // refusal, where somebody with an open want the asker could reach says
        // what they would take instead. `HOW_IT_WENT` in
        // `saying-what-an-ask-cost-and-how-likely-it-was.ts` had no row for it
        // either, so a countered attempt reached the player as the bare word
        // `countered` through the table's fallback. Both are fixed, and the
        // assertion is re-derived rather than widened: it enumerates the
        // resolver's whole enum, so a SIXTH outcome fails here.
        expect(call!.summary).toMatch(
            /they agreed|they said no, and it stayed|they said no, and it reached their house|they did not agree and did not close the door/
        );
        // And the raw enum never reaches prose. This is the claim the line
        // above cannot make on its own: a table that has fallen behind the
        // resolver prints its key, which reads like a word and is a field name.
        expect(call!.summary).not.toMatch(/\b(?:taken|turned|countered|refused|reported)\b/);
        // The days reach the clock: an attempt that costs nothing is not play.
        expect(call!.summary).toMatch(/\d+ days? went into it/);
        // Every term named. The only thing that will ever reveal one has gone
        // wrong, and the reason it is on the mechanical channel.
        expect(call!.summary).toMatch(/Starting from \d+ points/);
        expect(call!.summary).toMatch(/the gap in standing between them|Nothing came from/);
        // The leverage, resolved. `attachment` is the asker themselves.
        expect(call!.summary).toContain('with themselves');
        // And no field names anywhere in it.
        expect(call!.summary).not.toMatch(/[A-Za-z_][A-Za-z0-9_.]*=/);
    }, 120_000);
});
