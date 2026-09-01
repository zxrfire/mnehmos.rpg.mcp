/**
 * The core sect loop: the thing a member does every turn.
 *
 * Four failures found by playing, all the same habit - THE ENGINE HOLDS THE
 * ANSWER AND HANDS BACK A DIFFERENT ONE. Two were deflections rather than
 * refusals, which is the harder kind to notice: the player reads a confident
 * sentence and moves on.
 *
 *   "I take the mission"              refused, then named the thing it refused
 *   "I take <the exact title>"        did not resolve at all
 *   "how much contribution do I have" returned the mission board
 *   "what does my sect teach"         returned the answer given to strangers
 *
 * The first two mattered most: contribution gates promotion, promotion gates
 * the shelf, and missions are the visible way to earn contribution - so the
 * whole progression loop for a sect member terminated at a board they could
 * read and not act on.
 */

import { parseIntent } from '../../src/web/actions';
import { makeGame, planned } from './harness';

async function inAHouse(seed: string) {
    const { db, game } = makeGame({ seed, worldEnabled: true });
    const { cultivator } = await game.newRun('Joiner');
    db.prepare('UPDATE cultivators SET spirit_stones = 500 WHERE id = ?').run(cultivator.id);
    await game.act('I join the Azure Dew Sect');
    return { db, game, cultivator };
}

describe('the board can be acted on', () => {
    /**
     * The definite article resolves when there is one thing to resolve to. A
     * player should not have to retype a seven-word title to accept the only
     * job on the wall.
     */
    it('takes the only mission on the board when asked for "the mission"', async () => {
        const { game } = await inAHouse('take-the-mission');
        const listed = await game.act('what missions are there');
        expect(listed.narration).toMatch(/What a Poor District/);

        const taken = await game.act('I take the mission');
        expect(planned(taken).action).toBe('sect');
        expect(taken.narration, 'the board refused the only thing on it')
            .not.toMatch(/it is not there/i);
        expect(taken.narration).toMatch(/Sect duty/i);
    }, 120_000);

    /**
     * Any name the game prints is a name the game must accept. The title
     * carries no board noun, so a sentence made entirely of what the game had
     * just said fell through the duty branch and out of the parser.
     */
    it('takes a commission named by its printed title', async () => {
        // Asserted on the parser directly: `planned()` reports the verb the
        // planner chose and not the intent inside it, and the intent is the
        // whole point here.
        const parsed = parseIntent('I take What a Poor District Has Instead of Monsters');
        expect(parsed.action).toBe('sect');
        expect(parsed.intent).toBe('duty');
        expect(parsed.target).toMatch(/poor district/i);

        const { game } = await inAHouse('take-by-title');
        const taken = await game.act('I take What a Poor District Has Instead of Monsters');
        expect(taken.narration).not.toMatch(/it is not there/i);
        expect(taken.narration).toMatch(/Sect duty/i);
    }, 120_000);

    it('still reads the wall rather than taking off it when nothing is named', async () => {
        const { game } = await inAHouse('read-the-wall');
        const read = await game.act('what missions are there');
        expect(read.narration).not.toMatch(/Sect duty/i);
    }, 120_000);
});

describe('the numbers a member is judged on', () => {
    /**
     * `contribution` is a board noun, so the question about the BALANCE was
     * swallowed by the rule that lists jobs. And once routed, the standing
     * shape had no branch in `summariseToolBody` and came back "It is done."
     */
    it('answers how much contribution, and what the next rung wants', async () => {
        const { game } = await inAHouse('contribution');
        const asked = await game.act('how much contribution do I have');

        expect(asked.narration).not.toMatch(/It is done/);
        expect(asked.narration, 'answered with the job board instead of the balance')
            .not.toMatch(/What a Poor District/);
        expect(asked.narration).toMatch(/contribution/i);
        // The promotion refusal states both requirements and both current
        // values. This is held to the same standard before the refusal.
        expect(asked.narration).toMatch(/wants|no further requirement|no rung above/i);
    }, 120_000);
});

describe('what my own house teaches', () => {
    /**
     * The member was given the stranger's answer - "knowing a name is not an
     * introduction" - to the single most useful fact about belonging. The read
     * existed and sat behind the authority gate for REWRITING the shelf.
     */
    it('names the arts, to a member, without a seat', async () => {
        const { game } = await inAHouse('curriculum-read');
        const asked = await game.act('what does my sect teach');

        expect(asked.narration).not.toMatch(/not an introduction/i);
        expect(asked.narration, 'a rank refusal for reading a shelf')
            .not.toMatch(/does not do that in/i);
        expect(asked.narration).toMatch(/Canon|Scripture|Form|Art|teaches nothing/i);
    }, 120_000);
});

describe('the pressure the whole game runs on', () => {
    it('answers how long the cultivator has left', async () => {
        const { game } = await inAHouse('lifespan');
        expect(planned(await game.act('how long will I live')).action).toBe('status');
        expect(planned(await game.act('how many years do I have')).action).toBe('status');
    }, 120_000);
});
