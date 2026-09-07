/**
 * "I ask what X" is a question, and the two words in front were costing money.
 *
 * FOUND BY PLAYING IT, and every one of these is the same shape: the question
 * works, and the same question with the player saying they are asking it does
 * not. That is the near-synonym rule in AGENTS.md - the phrasing somebody
 * reaches for first is the one that fails, and there is no way to find the
 * working half except by guessing.
 *
 *     what work does the sect have    -> a read
 *     I ask what work the sect has    -> NINETY DAYS OF HAULING
 *
 *     what rank am I                  -> status
 *     I ask what my rank is           -> talking to a bystander about a person
 *                                        called "what my rank is", which the
 *                                        engine then answered "matched nobody"
 *
 * The first of those is the one that matters: a question took three months off
 * the player's life because "what work the sect has" contains "work the", and
 * the mortal-economy rule reads that as employment.
 *
 * Both fixes are whole-sentence post-passes rather than guards inside each
 * verb, for the reason the mood pass already gives: a verb added tomorrow is
 * covered without its author having to know the rule exists.
 */

import { describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions';

describe('saying you are asking is not doing it', () => {
    it('does not sell three months of labour to somebody asking about work', () => {
        // THE ONE THAT COST SOMETHING. Everything else in this file is a wrong
        // answer; this one was a wrong answer that spent the player's year.
        const asked = parseIntent('I ask what work the sect has');
        expect(asked.action).toBe('work');
        expect(asked.intent).toBe('board');
        expect((asked as { days?: number }).days).toBeUndefined();
    });

    it('and answers a question about the player from the player', () => {
        expect(parseIntent('I ask what my rank is').action).toBe('status');
        expect(parseIntent('what rank am I').action).toBe('status');
    });

    it('and reads a question the same way whoever phrases it', () => {
        // The pair, stated as a pair. A question and the same question said out
        // loud have to land in the same place or the rule is not doing its job.
        for (const [plain, spoken] of [
            ['what my rank is', 'I ask what my rank is'],
            ['what my contribution is', 'I ask what my contribution is']
        ] as const) {
            expect(parseIntent(spoken).action).toBe(parseIntent(plain).action);
        }
    });

    it('but asking somebody to DO something is still asking them to do it', () => {
        // The whole distinction, and the reason an interrogative is required.
        // The design owner asked for this verb by name: *"you should be able to
        // ask your master to cut a slip or craft something for you."* A rule
        // that swallowed it would have taken a feature out to fix a phrasing.
        // A commission, put to the person named. It used to file a requisition
        // against a HOUSE - see `asking-somebody-to-make-you-a-thing.test.ts`
        // for that one - and what matters here is only that the mood pass did
        // not turn it into a read.
        const commissioned = parseIntent('I ask my master to craft me a talisman');
        expect(commissioned.action).toBe('request');
        expect(commissioned.intent).toBe('a_making');
        expect(commissioned.target).toBe('my master');
    });

    it('and a question about a person in front of you is still about them', () => {
        // Where the inside of the question says nothing on its own, the person
        // being asked is the answer. "I ask what he wants" is a person being
        // asked something, and must not become a read of the world.
        // Which verb takes it is the table's business - `request` and
        // `interact` both put the question to somebody. What matters is that it
        // did not become a read of the world with the person dropped out of it.
        const said = parseIntent('I ask what he wants');
        expect(['interact', 'request']).toContain(said.action);
        for (const world of ['status', 'inventory', 'recall', 'work']) {
            expect(said.action).not.toBe(world);
        }
    });

    it('and never turns a question into something that spends a day', () => {
        // The guard that makes the rest of it safe. Whatever is inside the
        // question, if answering it would cost, the question was not the thing
        // to act on - a player who asks what the missions are has not taken one.
        for (const said of [
            'I ask what work the sect has',
            'I ask what my rank is',
            'I ask what missions are open to me',
            'I ask what my contribution is'
        ]) {
            const parsed = parseIntent(said) as { days?: number; action: string };
            expect(parsed.days, `${said} committed days`).toBeUndefined();
            expect(parsed.action).not.toBe('cultivate');
            expect(parsed.action).not.toBe('travel');
        }
    });
});
