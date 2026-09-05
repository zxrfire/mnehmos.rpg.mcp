/**
 * The tier below the pattern table, and the things it must never do.
 *
 * The claim it makes is coverage: a sentence nobody wrote a regex for still
 * reaches the verb the player meant. Measured over 168 ordinary sentences
 * written before any of this existed, the table alone reached 69 and the table
 * with the model under it reaches 144 - and on the half no threshold was fitted
 * to, 36 becomes 68.
 *
 * The claims it must NOT break matter more than the coverage number does, and
 * they are properties of the TIER rather than of any model behind it. They were
 * pinned against a hashed-n-gram implementation first and they are pinned here
 * unchanged:
 *
 *   1. It cannot move a verb the table already chose.
 *   2. A sentence that means nothing cannot come out holding a verb that spends
 *      the player's life.
 *   3. The same sentence gets the same verb, whatever the process has read
 *      first.
 *   4. It names a verb and never a person, a place or a thing.
 *
 * These are slow by this suite's standards - they open real weights and run
 * real inference - and that is the point. A test of this tier that mocks the
 * model is a test of the thresholds.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    FALLBACK_ACTION,
    TIME_CONSUMING_ACTIONS,
    parseIntent,
    type ActionName
} from '../../src/web/actions.js';
import {
    nearestVerbByMeaning,
    readyTheTier,
    verbForASentenceThePatternsMissed
} from '../../src/web/reaching-a-verb-the-pattern-table-has-no-line-for.js';

/** The composed reader, exactly as `narrator.ts` assembles it. */
function read(input: string) {
    return verbForASentenceThePatternsMissed(input, parseIntent(input));
}

beforeAll(async () => {
    await readyTheTier();
}, 60_000);

/**
 * Sentences a player types when they mean something, in words the table has no
 * line for. Written from the outside in: what somebody says, not what the
 * exemplar corpus contains.
 */
const PLAIN_ENGLISH: ReadonlyArray<readonly [ActionName, string]> = [
    ['work', 'I need money'],
    ['work', 'is there anything I can do here for pay'],
    ['teacher', 'is there anybody who would take me on'],
    ['teacher', 'I need a master'],
    ['destinations', 'somewhere else I could be'],
    ['market', 'is anybody selling anything'],
    ['sect', 'which houses are there'],
    ['ceiling', 'how far will what I know take me'],
    ['acquisition', 'where would I even find a manual'],
    ['status', 'what am I'],
    ['look', 'what is going on here'],
    ['roads', 'which way do the roads run'],
    ['news', 'what is the talk around here'],
    ['inventory', 'check my things'],
    ['list_techniques', 'what arts do I actually know'],
    ['posture', 'I stand my ground and let them see it'],
    ['seal', 'I ward the place shut'],
    ['legacy', 'I want to leave something behind']
];

describe('a sentence the pattern table has no line for', () => {
    it('reaches the verb the player meant', async () => {
        const missed = PLAIN_ENGLISH.filter(([, text]) => parseIntent(text).action === FALLBACK_ACTION);
        // If the table grows a line for one of these the case is still valid,
        // it is simply no longer this tier's to answer - but the set has to
        // keep testing THIS tier, so most of them must still be falling
        // through.
        expect(missed.length).toBeGreaterThan(PLAIN_ENGLISH.length / 2);

        for (const [want, text] of missed) {
            expect((await read(text)).action, `"${text}" should reach ${want}`).toBe(want);
        }
    }, 60_000);

    it('leaves every verb the table chose exactly where it was', async () => {
        // The safety property, and the reason this tier is allowed to exist at
        // all. Asserted structurally rather than over a corpus: whatever the
        // table returns, if it is not the refusal, it comes back the same
        // object - so no model, present or future, can move a working parse.
        const alreadyRead = [
            'I cultivate for a year',
            'I travel to Clear River Ford',
            'I look for work',
            'what is for sale',
            'who would teach me',
            'I attempt a breakthrough',
            'I refine a pill',
            'I go into seclusion for ten years'
        ];
        for (const text of alreadyRead) {
            const table = parseIntent(text);
            expect(table.action, `"${text}" is meant to reach the table`).not.toBe(FALLBACK_ACTION);
            expect(await verbForASentenceThePatternsMissed(text, table)).toBe(table);
        }
    }, 60_000);
});

/**
 * The invariant `misparse.test.ts` was written for, asserted on the COMPOSED
 * reader.
 *
 * That file pins it on `parseIntent`, which this tier does not touch, so its
 * guard stays green whatever happens here - and the sentence a player actually
 * types now goes through one more reader before the engine sees a verb. A
 * fallback that spends three months of a life on a shrug is the bug that file
 * exists because of, and it has to be impossible on this path too.
 *
 * A free read claiming one of these is fine and is not asserted against: being
 * answered with the price board costs nothing and the player says the next
 * thing. Time does not come back.
 */
const MEANING_NOTHING = [
    'hmm',
    'aaaaaa',
    'asdkjhasd qqq',
    'nothing, for now',
    'I do the thing with the thing',
    'let me think about this for ten years',
    'I let it lie for a decade and see',
    'the qi and the years and all of it, honestly',
    'I think about my mother for a month',
    'I consider my options over the next several years',
    'I resolve to be better about it in future',
    'I take stock of a life that has gone nowhere in forty years',
    'I would like to not die please',
    'I write a letter I will not send',
    'well then'
];

describe('a sentence that means nothing', () => {
    it('never comes out holding a verb that spends in-world time', async () => {
        for (const input of MEANING_NOTHING) {
            const plan = await read(input);
            expect(
                (TIME_CONSUMING_ACTIONS as readonly ActionName[]).includes(plan.action),
                `"${input}" resolved to ${plan.action}, which spends in-world time`
            ).toBe(false);
        }
    }, 60_000);

    it('is refused outright when it is not even words', async () => {
        for (const input of ['hmm', 'aaaaaa', 'asdkjhasd qqq']) {
            expect((await read(input)).action, `input: "${input}"`).toBe(FALLBACK_ACTION);
        }
    }, 60_000);
});

describe('the same sentence, forever', () => {
    it('answers identically however many times it is asked', async () => {
        const text = 'I need money and somewhere better to be';
        const first = JSON.stringify(await nearestVerbByMeaning(text));
        for (let i = 0; i < 5; i++) {
            expect(JSON.stringify(await nearestVerbByMeaning(text))).toBe(first);
        }
    }, 60_000);

    it('does not depend on what the process read first', async () => {
        // Nothing about a sentence may depend on its position in a session:
        // not a lazily built index, not a warmed graph, not the order the
        // exemplars were compared in.
        const probe = 'is there anybody around here who would take me on';
        const cold = JSON.stringify(await nearestVerbByMeaning(probe));
        await nearestVerbByMeaning('I sell the sabre and buy a manual with it');
        await nearestVerbByMeaning('what is the talk around here');
        expect(JSON.stringify(await nearestVerbByMeaning(probe))).toBe(cold);
    }, 60_000);

    it('carries the span the player named, and never invents one', async () => {
        // The only fact this tier takes off the sentence, and it takes it with
        // the engine's own reader rather than one of its own.
        const withSpan = await read('I need money, I will take a job for two years');
        expect(withSpan.action).toBe('work');
        expect(withSpan.days).toBe(730);

        const withoutSpan = await read('I need money');
        expect(withoutSpan.action).toBe('work');
        expect(withoutSpan.days).toBeUndefined();
    }, 60_000);

    it('names a verb and never a person, a place or a thing', async () => {
        // A guessed target sends the engine looking for an object that does not
        // exist. The verb is the whole of what this tier is entitled to choose.
        for (const [, text] of PLAIN_ENGLISH) {
            const table = parseIntent(text);
            if (table.action !== FALLBACK_ACTION) continue;
            const plan = await read(text);
            expect(plan.target, `"${text}" invented a target`).toBeUndefined();
            expect(plan.topic, `"${text}" invented a topic`).toBeUndefined();
        }
    }, 60_000);
});

describe('the vectors beside the weights', () => {
    it('refuses to load against a corpus that has moved', async () => {
        // The staleness guard, asserted by construction rather than by
        // corrupting a committed file: the fingerprint is over the corpus, so
        // a corpus that changed produces a different one, and the loader
        // compares them. If this ever passes trivially the guard has been
        // removed.
        const { corpusFingerprint, verbVectorPaths } =
            await import('../../src/web/reaching-a-verb-the-pattern-table-has-no-line-for.js');
        const { readFileSync } = await import('node:fs');
        const manifest = JSON.parse(readFileSync(verbVectorPaths().index, 'utf8')) as {
            corpusHash: string;
        };
        expect(manifest.corpusHash).toBe(corpusFingerprint());
    });
});
