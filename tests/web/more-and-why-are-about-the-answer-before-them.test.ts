/**
 * "MORE" AND "WHY" WERE THE TWO THE LISTING FIX COULD NOT REACH.
 *
 * Measured on a 3472-turn refusal probe: ten back-reference sentences came back
 * as the blank look - *"it does not resolve into anything you could actually do
 * standing here"* - for 208 turns between them. Replayed here with a listing on
 * the immediately preceding turn, eight of the ten resolve and two never do:
 *
 *     the second one  that one  the first one  I take it        resolve
 *     the intake      the last one  I take the first one  that  resolve
 *     more                                                      blank look
 *     why                                                       blank look
 *
 * They never resolve because they are not references at all. Every other
 * sentence on that list points at an ITEM in a listing, and `whichOfTheNamedThings`
 * has read ordinals, comparatives and paper words all along. These two point at
 * the ANSWER: "why" asks the engine to account for what it just said, and
 * "more" asks for the rest of what it just showed. Neither has a referent in
 * the listing, so the resolver correctly declined and nothing else was asked.
 *
 * ── WHAT THE ENGINE ACTUALLY HOLDS, AND WHAT IT DOES NOT ─────────────────
 *
 * The turn memory is one turn deep. It held what the turn DID and what it
 * NAMED, and neither answers either question, so both were genuinely
 * unanswerable rather than merely unrouted.
 *
 * Two things were added to the record, and only two, because they are the two
 * the previous screen had and the next turn could not reach:
 *
 *   the headline and the engine's own account of the turn   answers "why"
 *   how many the listing was a sample OF                    answers "more"
 *
 * Neither is a second copy of anything: the previous turn's prose is gone by
 * the time the next sentence arrives, and the record is the only place it can
 * live.
 *
 * "Why" is therefore answered by putting back what the engine did to arrive at
 * the answer, which is the structure channel, said once and in full. It does
 * not reason about the refusal and must not: an engine that explains a refusal
 * in words nothing computed is a narrator deciding an outcome.
 *
 * "More" is answered honestly in three different situations, which is the whole
 * of the point:
 *
 *   the listing was whole       everything named goes back, and it says so
 *   the listing was a sample    it says how many of how many, and what gets a
 *                               different cut - the engine holds the sample it
 *                               printed and not the board behind it
 *   nothing was listed          it says so plainly rather than looking blank
 *
 * A game master never fails to understand "why". They may have nothing to add,
 * and saying so is an answer; the blank look is not.
 */

import { describe, expect, it } from 'vitest';

import { theSentenceAsksAboutTheLastAnswer } from '../../src/web/last-turn-memory';
import { makeGameInWorld } from './harness';

const WORLD = { seed: 'more-and-why', worldSeed: 'more-and-why-world' };
const BLANK = 'does not resolve into anything';

describe('a follow-up about the answer is read as one', () => {
    it('reads the ways somebody asks for the rest of it', () => {
        for (const said of [
            'more', 'more please', 'what else', 'anything else', 'the rest',
            'tell me more', 'is there more', 'any more', 'what else is there',
            'show me the rest'
        ]) {
            expect(theSentenceAsksAboutTheLastAnswer(said), said).toBe('more');
        }
    });

    it('reads the ways somebody asks the engine to account for itself', () => {
        for (const said of ['why', 'why not', 'why is that', 'how come', 'why though']) {
            expect(theSentenceAsksAboutTheLastAnswer(said), said).toBe('why');
        }
    });

    /**
     * "More of the same" and "again" already mean CARRY ON WITH THE ACT, and
     * that reading is older and is right. A follow-up about the answer is the
     * whole sentence and nothing else.
     */
    it('is not a sentence that says what to do as well', () => {
        for (const said of [
            'more of the same', 'again', 'keep at it', 'I buy more pills',
            'I ask why she left', 'more rations', 'why did the sect refuse me'
        ]) {
            expect(theSentenceAsksAboutTheLastAnswer(said), said).toBeNull();
        }
    });
});

describe('played, "why" answers for the turn before it', () => {
    it('is not a blank look after a refusal', async () => {
        const { game } = await makeGameInWorld(WORLD);
        await game.newRun('Prober');
        const refused = await game.act('I take the second one');
        expect(refused.narration.length).toBeGreaterThan(0);

        const asked = await game.act('why');
        expect(asked.narration.toLowerCase(), asked.narration).not.toContain(BLANK);
        expect(asked.narration, asked.narration).toMatch(/turn before this one/i);
    }, 300000);

    it('is not a blank look after a read that ran', async () => {
        const { game } = await makeGameInWorld(WORLD);
        await game.newRun('Prober');
        await game.act('what is for sale here');
        const asked = await game.act('why');
        expect(asked.narration.toLowerCase(), asked.narration).not.toContain(BLANK);
    }, 300000);

    it('says plainly that there is nothing behind it when there is no turn behind it', async () => {
        const { game } = await makeGameInWorld(WORLD);
        await game.newRun('Prober');
        const asked = await game.act('why');
        expect(asked.narration.toLowerCase(), asked.narration).not.toContain(BLANK);
        expect(asked.narration, asked.narration).toMatch(/no turn just gone|nothing is remembered/i);
    }, 300000);
});

describe('played, "more" answers for the listing before it', () => {
    it('puts back what the listing named, in the order it named them', async () => {
        const { game } = await makeGameInWorld(WORLD);
        await game.newRun('Prober');
        const listed = await game.act('what sects are there');
        const asked = await game.act('more');

        expect(asked.narration.toLowerCase(), asked.narration).not.toContain(BLANK);
        // Read a name out of the listing rather than assuming one.
        const aName = /([A-Z][\w']*(?: [A-Z][\w']*)+ (?:Sect|Court|Hall|Pavilion|Wanderers))/
            .exec(listed.narration)?.[1];
        expect(aName, `no house was named: ${listed.narration}`).toBeDefined();
        expect(asked.narration, asked.narration).toContain(aName!);
    }, 300000);

    it('says how many of how many when the listing was a sample', async () => {
        const { game } = await makeGameInWorld(WORLD);
        await game.newRun('Prober');
        const board = await game.act('what is for sale here');
        const of = /of (\d+) things on offer/.exec(board.narration);
        expect(of, `the board was not a sample: ${board.narration}`).not.toBeNull();

        const asked = await game.act('more');
        expect(asked.narration.toLowerCase(), asked.narration).not.toContain(BLANK);
        expect(asked.narration, asked.narration).toContain(of![1]!);
    }, 300000);

    it('says there is nothing more of it when nothing was listed', async () => {
        const { game } = await makeGameInWorld(WORLD);
        await game.newRun('Prober');
        await game.act('I cultivate for a day');
        const asked = await game.act('more');
        expect(asked.narration.toLowerCase(), asked.narration).not.toContain(BLANK);
        expect(asked.narration, asked.narration).toMatch(/nothing more of it|did not put a list/i);
    }, 300000);

    it('spends no day answering either of them', async () => {
        const { game } = await makeGameInWorld(WORLD);
        await game.newRun('Prober');
        await game.act('what sects are there');
        const before = (await game.act('more')).state.run.elapsedDays;
        const after = (await game.act('why')).state.run.elapsedDays;
        expect(after).toBe(before);
    }, 300000);
});
