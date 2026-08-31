/**
 * A misparse must never cost the player anything.
 *
 * The bug this file exists for, found by playing rather than by testing:
 *
 *     A cultivator with no stones, no food and five days of life left types
 *     "I take whatever work the village will give me for a season". The parser
 *     did not know "take work", fell through to a rule that fired on any
 *     sentence containing a duration, matched "a season", and returned
 *     cultivate(90). The player asked for the one action that saves them and
 *     got the one action that kills them. The run closed permanently.
 *
 * Two defects, and the second is the real one. The verb coverage was missing,
 * which is a gap. The FALLBACK was a time-consuming action, which is a design
 * error: an action the engine is not confident about must be the cheapest one
 * available, never the most expensive.
 *
 * Every test here reads the parser's own output rather than an outcome,
 * because the parser is the entire intent path when no provider is configured.
 */

import { describe, it, expect } from 'vitest';
import {
    ACTION_NAMES,
    FALLBACK_ACTION,
    TIME_CONSUMING_ACTIONS,
    isBareDuration,
    parseIntent,
    type ActionName
} from '../../src/web/actions';
import { makeGame, planned, engineCalls } from './harness';

/**
 * Sentences nothing in the parser is meant to recognise.
 *
 * Deliberately varied, and deliberately full of durations and cultivation
 * vocabulary, because those are what dragged the original bug into a fatal
 * branch. If a future verb claims one of these, that is fine - what must never
 * happen is one of them resolving to something that spends time.
 */
const UNRECOGNISED = [
    'I ponder the nature of the Lid for a while',
    'hmm',
    'asdkjhasd qqq',
    'I do the thing with the thing',
    'what now',
    'I consider my options over the next several years',
    'I make peace with it, in a manner of speaking, for a season',
    'let me think about this for ten years',
    'I resolve to be better about it in future',
    'the qi and the years and all of it, honestly',
    'I write a letter I will not send',
    'nothing, for now',
    'I think about my mother for a month',
    'aaaaaa',
    'I would like to not die please',
    'I let it lie for a decade and see',
    'I take stock of a life that has gone nowhere in forty years'
];

describe('the fallback is inert', () => {
    it('resolves nothing unrecognised to anything that spends time', () => {
        // The invariant. It must keep holding as verbs are added, which is why
        // it is written against the list rather than against a fixed answer.
        for (const input of UNRECOGNISED) {
            const parsed = parseIntent(input);
            expect(
                TIME_CONSUMING_ACTIONS.includes(parsed.action),
                `"${input}" resolved to ${parsed.action}, which spends in-world time`
            ).toBe(false);
        }
    });

    it('resolves them to the declared fallback', () => {
        for (const input of UNRECOGNISED) {
            expect(parseIntent(input).action, `input: ${input}`).toBe(FALLBACK_ACTION);
        }
    });

    it('declares a fallback that is itself inert', () => {
        expect(TIME_CONSUMING_ACTIONS.includes(FALLBACK_ACTION)).toBe(false);
    });

    it('keeps the two lists honest about every action in the enum', () => {
        // A new verb has to be classified one way or the other, or the guard
        // above silently stops covering it.
        const inert: ActionName[] = [
            'look', 'status', 'investigate', 'interact', 'assess', 'market', 'unclear',
            // `sect` is a listing until a sect is named, and a life's allegiance
            // after. Neither half spends in-world time, so it is inert here.
            'sect'
        ];
        for (const name of ACTION_NAMES) {
            const timed = TIME_CONSUMING_ACTIONS.includes(name);
            expect(timed || inert.includes(name), `${name} is classified neither way`).toBe(true);
        }
    });
});

describe('the sentence that killed a run', () => {
    const FATAL = 'I take whatever work the village will give me for a season';

    it('reads as work, not as three months of sitting still', () => {
        const parsed = parseIntent(FATAL);
        expect(parsed.action).toBe('work');
        expect(parsed.days).toBe(90);
    });

    it('does not resolve to cultivate through any phrasing of taking work', () => {
        const phrasings = [
            'I take whatever work the village will give me for a season',
            'find work',
            'I look for work in the village',
            'take a job for a month',
            'I hire myself out',
            'odd jobs, anything',
            'I need to earn some stones',
            'work the fields for a year',
            'day labour',
            'I make myself useful for a while'
        ];
        for (const input of phrasings) {
            expect(parseIntent(input).action, `input: ${input}`).toBe('work');
        }
    });

    it('reaches the market too', () => {
        for (const input of ['what is for sale', 'I go to the market', 'the price of food', 'what can I buy here']) {
            expect(parseIntent(input).action, `input: ${input}`).toBe('market');
        }
    });

    it('reaches assess without attempting anything', () => {
        for (const input of ['could I survive that cave', 'size up the valley', 'is it safe to go in']) {
            expect(parseIntent(input).action, `input: ${input}`).toBe('assess');
        }
    });
});

describe('a bare duration is still seclusion, and only a bare duration', () => {
    it('reads a duration on its own as cultivation', () => {
        for (const input of ['ten years', 'three months', 'a decade', 'for another year', 'spend 90 days']) {
            const parsed = parseIntent(input);
            expect(parsed.action, `input: ${input}`).toBe('cultivate');
            expect(parsed.days).toBeGreaterThan(0);
        }
    });

    it('does not read a duration buried in a sentence about something else', () => {
        for (const input of [
            'I take whatever work the village will give me for a season',
            'I think about my mother for a month',
            'I write to the elder and wait a year for an answer'
        ]) {
            expect(isBareDuration(input), `input: ${input}`).toBe(false);
        }
    });

    it('still recognises an explicit request to sit for a span', () => {
        expect(parseIntent('I sit in seclusion for ten years').action).toBe('cultivate');
        expect(parseIntent('I seal the cave for ten years').action).toBe('seclude');
    });
});

describe('through the front door', () => {
    it('costs a starving cultivator nothing to be misunderstood', async () => {
        const { db, game } = makeGame({ seed: 'misparse' });
        const { cultivator } = await game.newRun('Ke Yan');

        // The exact bind: no stones, no food, the starvation clock running.
        db.prepare(
            'UPDATE cultivators SET spirit_stones = 0, satiety = 0, starvation_turns = 4 WHERE id = ?'
        ).run(cultivator.id);

        const before = db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id);
        const result = await game.act('I ponder the nature of the Lid for a while');

        // Not one day, not one point of satiety, not one row.
        expect(db.prepare('SELECT * FROM cultivators WHERE id = ?').get(cultivator.id)).toEqual(before);
        expect(result.state.run.elapsedDays).toBe(0);
        expect(result.state.cultivator.alive).toBe(true);
        expect(planned(result).action).toBe('unclear');
    });

    it('says so in the world voice, and files the raw sentence for the inspector', async () => {
        const { game } = makeGame({ seed: 'misparse2' });
        await game.newRun('Ke Yan');

        const result = await game.act('I do the thing with the thing');

        expect(result.narration).toMatch(/does not resolve into anything you could actually do/i);
        expect(result.narration).not.toMatch(/\bparser\b|\bengine\b|\bintent\b/i);

        const mechanical = engineCalls(result).map(c => c.summary).join(' ');
        expect(mechanical).toMatch(/Intent not recognised/);
        expect(mechanical).toContain('I do the thing with the thing');
    });

    it('lets the same player be misunderstood a hundred times for free', async () => {
        const { db, game } = makeGame({ seed: 'patience' });
        const { cultivator } = await game.newRun('Ke Yan');
        db.prepare('UPDATE cultivators SET spirit_stones = 0, satiety = 2 WHERE id = ?')
            .run(cultivator.id);

        for (let i = 0; i < 100; i++) {
            await game.act(UNRECOGNISED[i % UNRECOGNISED.length]);
        }

        const state = game.state();
        expect(state.cultivator.alive).toBe(true);
        expect(state.run.elapsedDays).toBe(0);
        expect(state.cultivator.satiety).toBe(2);
    });
});

describe('every verb is reachable from plain English', () => {
    /**
     * One ordinary phrasing per action.
     *
     * This is the guard that would have caught the original bug on its own.
     * `cultivate` was matched by a pattern that could never fire - `\bcultivat\b`
     * cannot match "cultivate", because the trailing boundary falls between two
     * letters - and it only appeared to work because the duration fallthrough
     * guessed cultivate for any sentence with a span in it. Removing that rule
     * uncovered it. A verb reachable only by accident is a verb waiting to be
     * deleted by an unrelated change.
     */
    const PHRASINGS: Record<Exclude<ActionName, 'unclear'>, string> = {
        cultivate: 'I cultivate for three years.',
        seclude: 'I seal the cave for ten years',
        breakthrough: 'break through',
        train_technique: 'I practise the Lid-Watching Stance technique',
        refine: 'I brew a pill in the cauldron',
        gather: 'forage for herbs',
        eat: 'I buy a meal',
        wait: 'I wait',
        work: 'find work',
        market: 'what is for sale',
        move: 'travel to the Low Fall',
        interact: 'I bribe the gate steward',
        investigate: 'examine the inscription',
        assess: 'could I survive that cave',
        look: 'I look around.',
        status: 'how am I doing',
        sect: 'I look for a sect that will take me'
    };

    for (const [action, phrasing] of Object.entries(PHRASINGS)) {
        it(`reaches ${action}`, () => {
            expect(parseIntent(phrasing).action, `"${phrasing}"`).toBe(action);
        });
    }

    it('covers every action in the enum except the fallback', () => {
        const covered = new Set(Object.keys(PHRASINGS));
        for (const name of ACTION_NAMES) {
            if (name === FALLBACK_ACTION) continue;
            expect(covered.has(name), `${name} has no plain-English phrasing under test`).toBe(true);
        }
    });
});
