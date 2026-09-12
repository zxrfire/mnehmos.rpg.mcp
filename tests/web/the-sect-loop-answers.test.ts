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
     *
     * WHICH NOW NEEDS A BOARD WITH ONE THING ON IT, and a member of a house no
     * longer has one: the house posts its own work, so the wall holds about a
     * dozen lines. Somebody on nobody's roll is not being asked by anybody and
     * reads the catalogue alone, which at the bottom rung is a single job - so
     * that is where the rule is still expressible. See
     * `a-house-posts-what-it-needs-doing.test.ts`.
     */
    it('takes the only mission on the board when asked for "the mission"', async () => {
        const { game } = makeGame({ seed: 'take-the-mission', worldEnabled: true });
        await game.newRun('Rogue');
        const listed = await game.act('what missions are there');
        expect(listed.narration).toMatch(/What a Poor Prefecture/);

        const taken = await game.act('I take the mission');
        expect(planned(taken).action).toBe('sect');
        expect(taken.narration, 'the board refused the only thing on it')
            .not.toMatch(/it is not there/i);
        expect(taken.narration).toMatch(/Sect duty/i);
    }, 120_000);

    /**
     * AND SAYING WHERE IT IS DOES NOT STOP IT BEING FOUND.
     *
     * Found by playing: "I take a job from the board" was answered with "you
     * read it twice and it is not there", and the same sentence then printed
     * the one thing that was. Three phrasings did it - naming the wall the
     * line is posted on put the whole sentence past the matcher, which read
     * "job from the board" as a title no posting had.
     */
    it.each([
        'I take a job from the board',
        'I take a duty off the wall',
        'I take work from the board'
    ])('takes the only line when the sentence also names the wall: %s', async said => {
        const { game } = makeGame({ seed: `wall-named-${said.length}`, worldEnabled: true });
        await game.newRun('Rogue');
        const listed = await game.act('what missions are there');
        expect(listed.narration, 'the fixture needs one line on the wall')
            .toMatch(/What a Poor Prefecture/);

        const taken = await game.act(said);
        expect(planned(taken).action).toBe('sect');
        expect(taken.narration, 'naming the wall lost the line on it')
            .not.toMatch(/it is not there/i);
        expect(taken.narration).toMatch(/Sect duty/i);
    }, 120_000);

    /**
     * And with a wall full of them, the same sentence is a question.
     *
     * Measured before this: it came back "you read it twice and it is not
     * there", about a board holding twelve lines. A player pointing at "the
     * mission" has not said which one, and the useful answer is the list -
     * telling them the thing in front of them does not exist is not a refusal,
     * it is a wrong statement about the world.
     */
    it('and shows the wall when "the mission" could be any of a dozen', async () => {
        const { game } = await inAHouse('the-mission-is-ambiguous');
        const asked = await game.act('I take the mission');
        expect(asked.narration).not.toMatch(/it is not there/i);
        expect(asked.narration).not.toMatch(/Sect duty/i);
        // What is actually on it, so the next sentence can name one.
        expect(asked.narration).toMatch(/contribution/i);
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
        const parsed = parseIntent('I take What a Poor Prefecture Has Instead of Monsters');
        expect(parsed.action).toBe('sect');
        expect(parsed.intent).toBe('duty');
        expect(parsed.target).toMatch(/poor prefecture/i);

        const { game } = await inAHouse('take-by-title');
        const taken = await game.act('I take What a Poor Prefecture Has Instead of Monsters');
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
            .not.toMatch(/What a Poor Prefecture/);
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
