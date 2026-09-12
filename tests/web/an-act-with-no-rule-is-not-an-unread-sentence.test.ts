/**
 * A sentence the engine has no rule for is not a sentence it failed to read.
 *
 * `unclear` tells the player *"you turn the thought over and it does not
 * resolve into anything you could actually do standing here"*, and on the
 * refusal probe's 744-turn corpus nine of the sentences it classed as the
 * engine failing to understand were ordinary acts a person can perform. For
 * half of them that answer is simply false: singing resolves perfectly well
 * into something a person can do.
 *
 * The split this pins, and it is the whole of the design:
 *
 *   no rule, nothing could follow   sing, pray, nap. Say it happened.
 *   no rule, the world would react  arson, vandalism, causing a scene. These
 *                                   are not free, and saying they happened
 *                                   with no consequence is worse than
 *                                   refusing - the player will believe the
 *                                   inn burned.
 *   incoherent                      still refuses, and the misparse surface
 *                                   that teaches somebody the verbs survives.
 *
 * The third of those is the ruling in `asking-is-not-doing.test.ts`, and the
 * last case here is what keeps this change from eroding it.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { anActNothingAnswers } from '../../src/web/an-act-nothing-in-the-world-answers';
import { verbForASentenceThePatternsMissed } from '../../src/web/reaching-a-verb-the-pattern-table-has-no-line-for';
import { makeGameInWorld } from './harness';

/** The half a game master would answer, and the verb each one performs. */
const ANSWERED: readonly [string, string][] = [
    ['I pray', 'pray'],
    ['I sing', 'sing'],
    ['I take a nap', 'nap'],
    ['I hum', 'hum'],
    ['I sigh', 'sigh'],
    ['I dance', 'dance'],
    ['I weep', 'weep'],
    ['I stretch', 'stretch'],
    ['I doze off', 'doze'],
    // The near-synonym rule: without the noun forms "I sing" answers and
    // "I sing a song" refuses, and nothing tells the player which is which.
    ['I sing a song', 'sing'],
    ['I have a laugh', 'laugh'],
    ['I pray quietly', 'pray'],
    ['I sing softly to myself', 'sing'],
    ['I pray to the heavens', 'pray'],
    ['I am humming', 'hum'],
    ['I just yawn', 'yawn']
];

/**
 * Coherent, and deliberately still refused. Every one of them either names
 * something the world holds or is aimed at somebody, so "it happened and
 * nothing came of it" would be a claim about the world rather than about the
 * speaker.
 */
const LEFT_REFUSING = [
    'I set fire to the inn',
    'I burn the village down',
    'I smash the stall',
    'I cause a scene',
    'I show off',
    'I climb the wall',
    'I dig a hole',
    'I shout',
    'I scream',
    'I bow to him',
    'I sing to the elder',
    'I pray at the shrine',
    // And the incoherent ones, which were never in question.
    'I frobnicate the widget',
    'the ground here safe to sit on for a decade?'
];

describe('what a body does alone, told apart from what the world would answer', () => {
    it('names the verb for an act nothing could follow from', () => {
        for (const [said, verb] of ANSWERED) {
            expect(anActNothingAnswers(said), said).toBe(verb);
        }
    });

    it('names nothing for an act the world would have to react to', () => {
        for (const said of LEFT_REFUSING) {
            expect(anActNothingAnswers(said), said).toBeNull();
        }
    });

    /**
     * The table is untouched. This tier only ever runs on a sentence that
     * reached `unclear`, which is the same safety property the spelling repair
     * and the sentence-model tier hold: a fallback that can move a working
     * parse is a second parser.
     */
    it('leaves every one of them reaching the table the way it already did', () => {
        for (const [said] of ANSWERED) {
            expect(parseIntent(said).action, said).toBe('unclear');
        }
    });

    /**
     * AND WHERE THE TABLE ALREADY HAS A LINE, THE TABLE KEEPS IT.
     *
     * "I say a prayer" reaches `interact` on the word `say`, and this class
     * would otherwise have taken it. It does not, because nothing here runs on
     * a sentence the table read - so the predicate below can class the sentence
     * and still change nothing about the turn. Pinned because that precedence
     * is the whole safety property, and it is invisible from the predicate.
     */
    it('never moves a sentence the table already reads', () => {
        expect(anActNothingAnswers('I say a prayer')).toBe('pray');
        expect(parseIntent('I say a prayer').action).toBe('interact');
    });

    /**
     * AND THE GUESSING TIER DOES NOT GET THEM FIRST.
     *
     * Measured before this existed, deterministic reader, no provider:
     * "I stretch" reached `market` - forty lines of millet and ferry fares for
     * somebody stretching - and "I say a prayer" reached `interact`/`talk`, a
     * person being spoken to who was never named. An act performed alone has
     * no verb in the space to be near, so the tier declines it the way it
     * declines a bare back-reference.
     */
    it('is not handed to the nearest verb by meaning', async () => {
        for (const [said] of ANSWERED) {
            const plan = await verbForASentenceThePatternsMissed(said, parseIntent(said));
            expect(plan.action, said).toBe('unclear');
        }
    }, 120_000);
});

describe('played, an act with no rule is answered and costs nothing', () => {
    it('says it happened, and spends no day, no stone and no year', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'a-song-nobody-asked-for' });
        await game.newRun('Shen Wuyou');

        for (const [said, verb] of [['I sing', 'sing'], ['I pray', 'pray'], ['I take a nap', 'nap']] as const) {
            const before = await game.state();
            const turn = await game.act(said);
            const after = await game.state();

            expect(turn.narration ?? '', said).toContain(`You ${verb}.`);
            expect(turn.narration ?? '', said)
                .not.toContain('does not resolve into anything');
            expect(turn.toolCalls.some((call: { ok: boolean }) => call.ok === false), said)
                .toBe(false);

            expect(after.run!.elapsedDays, `"${said}" spent days`)
                .toBe(before.run!.elapsedDays);
            expect(after.cultivator!.spiritStones, `"${said}" spent stones`)
                .toBe(before.cultivator!.spiritStones);
            expect(after.cultivator!.age, `"${said}" aged them`)
                .toBe(before.cultivator!.age);
        }
    }, 300_000);

    /**
     * THE TRAP THIS IS DESIGNED AGAINST. An arson answered with "nothing came
     * of it" is worse than a refusal, so the sentence keeps the blank look and
     * the list of what would work under it.
     */
    it('still refuses an act the world would have to answer', async () => {
        const { game } = await makeGameInWorld({ worldSeed: 'an-inn-that-did-not-burn' });
        await game.newRun('Shen Wuyou');

        for (const said of ['I set fire to the inn', 'I smash the stall']) {
            const turn = await game.act(said);
            expect(turn.narration ?? '', said).not.toContain('Nothing follows from it');
            expect(turn.toolCalls.some((call: { name: string; ok: boolean }) =>
                call.name === 'engine.parseIntent' && call.ok === false), said).toBe(true);
        }
    }, 300_000);
});
