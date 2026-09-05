/**
 * Four things a turn owes the player, all found by playing with no model.
 *
 * `AGENTS.md`, "It has to play as a game, not as a command line", names a floor
 * that holds at every reading tier because none of it costs a model: you are
 * told what happened, you can find out what you could do, a refusal names a
 * route, and nothing contradicts itself. Each block below is one place the
 * floor was through the boards, with the transcript that found it.
 *
 * All four are engine defects rather than tier defects, and that is the point
 * of the file: every one of them reads exactly the same with a model in front
 * of it, because a model narrates the facts the engine composed and cannot
 * narrate a fact the composer dropped.
 */

import { describe, it, expect } from 'vitest';
import { makeGame, makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';
import {
    readyTheTier,
    verbForASentenceThePatternsMissed
} from '../../src/web/reaching-a-verb-the-pattern-table-has-no-line-for';
import { ASKING_WHAT_IS_POSSIBLE } from '../../src/web/what-is-worth-doing-standing-here';

const WORLD = 'a-turn-says-what-it-did';

/** The whole deterministic reader: the table, then the embedding under it. */
async function read(sentence: string) {
    await readyTheTier();
    return verbForASentenceThePatternsMissed(sentence, parseIntent(sentence));
}

describe('asking what there is to do reaches the surface written for it', () => {
    /**
     * Nine phrasings, all matched by `ASKING_WHAT_IS_POSSIBLE`, and the
     * embedding tier used to answer six of them somewhere else:
     *
     *   "what can I do here"    -> market, 43 lines of millet and ferry fares
     *   "what can be done here" -> market
     *   "what can I do"         -> work
     *   "what now"              -> look
     *   "what next"             -> destinations
     *   "what is there to do"   -> look
     *
     * The other three reached `guidance` and its opening line, which is the
     * answer all nine were asking for: "Old River Village, at Qi Condensation Layer 1.
     * What is live for you here". A player cannot tell a game that answers
     * three of nine from a game that has no such surface at all.
     */
    const ASKED = [
        'what can I do here',
        'what can I do',
        'what can be done here',
        'what now',
        'what next',
        'what is there to do',
        'what is there to do here',
        'help',
        "I don't know what to do"
    ];

    it.each(ASKED)('"%s" is a question the table decided, not one it declined', async said => {
        expect(ASKING_WHAT_IS_POSSIBLE.test(said), said).toBe(true);
        // `unclear` is how `game.ts` reaches `guidance` at `case 'unclear'`.
        // The tier must leave it alone rather than reading it as a failure.
        expect((await read(said)).action, said).toBe('unclear');
    });

    it('answers with what is live here rather than with a price list', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'options' });
        await h.game.newRun('Lin Baoqing');
        const { narration } = await h.game.act('what can I do here');
        expect(narration).toContain('What is live for you here');
        // The market dump this used to return, by its own first line.
        expect(narration).not.toContain('things on offer');
    });
});

describe('a question about an act is not the act, whichever layer chose the verb', () => {
    /**
     * `readTheSentence` in `actions.ts` runs `ASKING_RATHER_THAN_DOING` as a
     * post-pass over the WHOLE sentence, and says why: "a verb added tomorrow
     * is covered without its author having to know this rule exists". The
     * embedding tier chooses its verb after that pass has run, so it was the
     * one verb in the game the rule did not cover, and it reopened the defect
     * `asking-is-not-doing.test.ts` was written about:
     *
     *   "how do I leave"           -> move           a journey, begun
     *   "can I leave"              -> move
     *   "should I leave"           -> move
     *   "what happens if I leave"  -> move
     */
    const ASKED_ABOUT_LEAVING = [
        'how do I leave',
        'can I leave',
        'should I leave',
        'what happens if I leave'
    ];

    it.each(ASKED_ABOUT_LEAVING)('"%s" does not put anybody on a road', async said => {
        expect((await read(said)).action, said).not.toBe('move');
    });

    it('still goes when the sentence commands it', async () => {
        // The guard is about mood, not about the verb. Nothing here bans a
        // journey; `AGENTS.md` is explicit that the answer to "may I" is
        // always "yes, and here is what it costs".
        expect(parseIntent('I leave for Autumn Gate').action).toBe('move');
    });
});

describe('a turn that spends the body says what it spent', () => {
    /**
     * Played, deterministic reader, no model. Twenty-five spirit stones in the
     * purse, a bowl of millet on sale for one cash, and seven foraging turns:
     * satiety 100 -> 44 -> 30 -> 16 -> 2 -> 0 -> five turns starving -> dead.
     * Every turn printed two sentences and neither was about hunger. The
     * killing turn printed "5 days bent over the ground around Old River Village. Found
     * and pouched: one Nine-Node Calamus" and shipped `alive: false` in the
     * same result; the death was discovered on the NEXT input, as a 409.
     *
     * `factsForTimeSkip` had both sentences and `factsForGather` composed a
     * fresh two-sentence `prose` over the top of it, which is what the
     * deterministic narrator ships - and dropped `required`, which is what
     * stops a model dropping it too. Wrong at both tiers, for one reason.
     */
    it('warns about hunger before it kills, and reports the death on the turn it happens', async () => {
        const h = makeGame({ seed: 'starve' });
        await h.game.newRun('Lin Baoqing');

        let warned = false;
        let deathSaid: string | null = null;

        for (let turn = 0; turn < 20; turn++) {
            const { narration, state } = await h.game.act('I gather herbs');
            if (/satiety is down to/i.test(narration)) warned = true;
            if (!state.cultivator.alive) {
                deathSaid = narration;
                break;
            }
        }

        // The run is meant to end this way - a nobody who never eats starves,
        // and that is the design. What is asserted is that they were told.
        expect(deathSaid, 'the forage loop never killed anybody; adjust the seed, not the assertion')
            .not.toBeNull();
        expect(warned, 'starved with no hunger ever mentioned').toBe(true);
        expect(deathSaid).toMatch(/is dead/i);
    });
});

describe('the asker can look at themselves', () => {
    /**
     * Ten of fifteen `examine` sentences on a fresh run came back with the
     * same refusal, and it named no route and did not even repeat the words
     * that failed:
     *
     *   > I examine myself / my injuries / my meridians / my body /
     *   >   my spirit root / my foundation / my cultivation
     *   "You go over Old River Village looking for it and it is not the kind of place
     *    that has one."
     *
     * The engine held every one of those facts and printed them well, one
     * sentence earlier, for "who am I". `resolveAnything` searches the roster
     * with the asker excluded by id, then houses, map and three catalogs, and
     * the asker is in none of them.
     */
    const ABOUT_THEMSELVES = [
        'myself',
        'my injuries',
        'my meridians',
        'my body',
        'my spirit root',
        'my foundation',
        'my cultivation'
    ];

    it.each(ABOUT_THEMSELVES)('"I examine %s" reads the sheet', async subject => {
        const h = makeGame({ seed: 'self' });
        const opened = await h.game.newRun('Lin Baoqing');
        const { narration } = await h.game.act(`I examine ${subject}`);

        expect(narration, subject).not.toMatch(/looking for it and it is not the kind of place/);
        expect(narration, subject).toContain(String(Math.floor(opened.cultivator.age)));
        // Nobody has to be asked for your own age: the closing clause that
        // makes an examination of somebody ELSE honest is a contradiction
        // pointed at the person doing the looking.
        expect(narration, subject).not.toMatch(/obliged to answer it/);
    });

    it('leaves an examination of somebody else exactly as it was', async () => {
        const h = await makeGameInWorld({ worldSeed: WORLD, seed: 'other' });
        await h.game.newRun('Lin Baoqing');
        const here = await h.game.act('who is here');
        const somebody = /^([A-Z][a-z]+ [A-Z][a-z]+)/.exec(here.narration)?.[1];
        if (!somebody) return; // Nobody about in this world; nothing to check.

        const { narration } = await h.game.act(`I examine ${somebody}`);
        expect(narration).toContain('obliged to answer it');
    });
});

describe('a count is not printed against a fixed plural', () => {
    it('says a year rather than 0.0 years on the turn a run opens', async () => {
        const h = makeGame({ seed: 'fresh' });
        await h.game.newRun('Lin Baoqing');
        const { narration } = await h.game.act('what is my situation');
        expect(narration).not.toContain('0.0 years');
        expect(narration).toMatch(/newly at this rung/i);
    });
});
