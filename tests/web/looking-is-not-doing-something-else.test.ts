/**
 * Asking how badly hurt you were cost 12 points and a permanent wound.
 *
 * FOUND BY PLAYING, and it is the worst thing in the combat sweep. Three
 * questions asked inside a standing fight, on seed `fq-1`:
 *
 *     "how hurt am I"        Ji Xushan lands 2 on you      26 -> 24
 *     "how hurt is he"       lands 3                       24 -> 21
 *     "what shape am I in"   lands 3, AND a serious meridian injury,
 *                            and it will not close on its own
 *
 * A player checking whether to run was charged for checking, and the charge is
 * what killed the option. Somebody at 26 who asks twice is at 21 and carrying a
 * wound that does not close - for looking.
 *
 * ── THE RULE UNDERNEATH IS RIGHT AND STAYS ───────────────────────────────
 *
 * `takeTheRoundFirst` gives a guard round to anybody who does something else
 * during a fight, which is correct: you cannot wander off mid-fight for free,
 * and its own header says so. What it could not do is tell an ACT from a LOOK.
 *
 * The first cut used `costsTheAskerNothing`, the predicate the asking pass uses
 * everywhere else, and it was too broad by a long way: it admits `look`,
 * `market` and `news`, so a player could browse a market stall mid-duel for
 * free. `a-fight-you-can-answer.test.ts` caught that within the hour and states
 * the rule outright - *the blade arrives and THEN they do the thing they asked
 * for. A fight is a situation, not a mode* - which is right for every one of
 * those verbs.
 *
 * So it is `status` and `assess` and nothing else. Those two are different in
 * KIND rather than in cost: checking what is left of your own body, and reading
 * the person swinging at you, are things a fighter does continuously and
 * without looking away. Everything else is looking away.
 *
 * The fight is untouched by them: no round, no blow, still standing when the
 * read is over.
 *
 * ── AND TWO OF THE THREE ANSWERED THE WRONG QUESTION ─────────────────────
 *
 * With the charge off, the answers were still wrong:
 *
 *     "how hurt am I"   -> the PHYSICIAN'S PRICE LIST
 *     "how hurt is he"  -> unclear
 *
 * The first is the same shape as "how many rations do I have" reaching a
 * grocery stall: a question about the player's own body answered with a shop.
 * It got there honestly - `treat` is the verb for being hurt, and the asking
 * pass turns a question about treating into the medicine board - but the
 * question was never about buying anything.
 *
 * What is left of ME is the sheet; what is left of HIM is an assessment. In a
 * fight where one of them decides whether to run, those are not interchangeable.
 */

import { describe, it, expect } from 'vitest';

// The harness FIRST. Importing the verb table ahead of it walks into a
// module-init cycle - `prompt.ts` runs `whichVerbsSpendSomething` at load
// and reaches `costsTheAskerNothing` before `actions.js` has finished
// initialising, which fails as `not a function` rather than as a compile
// error. Every other played test in this directory imports the harness
// first for the same reason.
import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';

const verb = (said: string) => parseIntent(said).action;

describe('what is left of me, and what is left of him', () => {
    it.each([
        'how hurt am I',
        'how badly am I hurt',
        'what shape am I in',
        'am I bleeding',
        'am I badly hurt'
    ])('reads %j off the sheet rather than a price list', said => {
        expect(verb(said)).toBe('status');
    });

    it.each([
        'how hurt is he',
        'is he close to done',
        'how is he doing',
        'is he beaten'
    ])('weighs the other side up from %j', said => {
        expect(verb(said)).toBe('assess');
    });

    /**
     * AND THE VERB THAT IS ACTUALLY ABOUT BUYING TREATMENT KEEPS IT.
     */
    it.each([
        ['I treat my wounds', 'treat'],
        ['I find a physician', 'treat'],
        ['what does a physician cost', 'market']
    ])('leaves %j alone', (said, want) => {
        expect(verb(said)).toBe(want);
    });
});

describe('a question inside a standing fight', () => {
    /**
     * PLAYED, because the charge only exists in a real fight and a unit test
     * cannot see it. The fight is opened for real and then asked about.
     */
    it('costs no blood and no round', async () => {
        const h = await makeGameInWorld({ seed: 'fq-1', worldSeed: 'fq-w' });
        const { cultivator } = await h.game.newRun('Probe');
        await h.game.act('I look around');

        const opened = await h.game.act('I attack someone');
        expect(String(opened.narration ?? ''), 'the seed no longer opens a fight; re-pin it')
            .toMatch(/lands \d+ on/);

        // Whatever the opening exchange left them on is the baseline. What is
        // asserted is that ASKING moves nothing from here.
        const readBodyFrom = (text: string): number | null => {
            const m = /(\d+) of \d+ left in the body/.exec(text);
            return m ? Number(m[1]) : null;
        };
        const first = await h.game.act('how hurt am I');
        const at = readBodyFrom(String(first.narration ?? ''));
        expect(at, 'the status read no longer reports the body').not.toBeNull();

        for (const said of ['how hurt is he', 'what shape am I in', 'how hurt am I']) {
            const before = h.repos.cultivators.getById(cultivator.id)?.hp;
            const answered = await h.game.act(said);
            const after = h.repos.cultivators.getById(cultivator.id)?.hp;
            expect(after, `${said} spent blood`).toBe(before);
            // No day either. A read is free in every other part of the game and
            // a fight does not change that.
            expect(answered.state?.run?.elapsedDays, `${said} spent a day`).toBe(0);
        }

        // And the body read still says the same thing at the end as it did at
        // the start, because nothing happened in between.
        const last = await h.game.act('how hurt am I');
        expect(readBodyFrom(String(last.narration ?? ''))).toBe(at);
    }, 240_000);

    /**
     * AND THE READ REPORTS THE FIGHT'S BODY, NOT THE STORED ROW.
     *
     * The row is not written until the fight settles - deliberately - so a read
     * taken mid-fight off the row alone would answer "30 of 30" to somebody at
     * 26. `asTheyStand` in `turn-engine.ts` already corrects for this and is
     * what makes the question worth asking at all.
     */
    it('answers with the body the fight left, not the one on file', async () => {
        const h = await makeGameInWorld({ seed: 'fq-1', worldSeed: 'fq-w' });
        const { cultivator } = await h.game.newRun('Probe');
        await h.game.act('I look around');
        await h.game.act('I attack someone');

        const said = String((await h.game.act('how hurt am I')).narration ?? '');
        const shown = /(\d+) of (\d+) left in the body/.exec(said);
        expect(shown, 'the body line is gone from the status read').not.toBeNull();

        const stored = h.repos.cultivators.getById(cultivator.id)?.hp ?? -1;
        // The fight has landed at least one blow, so the two must differ - and
        // the SHOWN figure is the one the player is standing in.
        expect(Number(shown![1])).toBeLessThan(stored);
    }, 240_000);
});
