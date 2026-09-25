/**
 * A greeting, or "who are you", is answered by the people asked with their own
 * names. Nothing is guessed and nobody else's name is said.
 *
 * Played: "hello" to the room came through as the topic `greeting`, resolved to
 * nothing, and each of three people answered "with confidence" and dropped a
 * stranger's name. "who are you?" came through as `identity` and went the same
 * way.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';
import { parseIntent } from '../../src/web/actions';
import {
    A_GREETING_TOPIC,
    A_TOPIC_ABOUT_THEMSELVES,
    selfFactFromTopic
} from '../../src/engine/social/what-somebody-knows-about-themselves';

type Played = { narration?: string; toolCalls: { name: string; action: string; summary: string }[] };

/** A game whose model reads the next sentence as `plan`, pushed after the run opens. */
async function withAModel(seed: string) {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['(scripted)'] });
    const harness = await makeGameInWorld({ seed, worldSeed: 'road-world', provider });
    const { cultivator } = await harness.game.newRun('Probe');
    return { ...harness, provider, plans, cultivator };
}

function asked(done: Played) {
    return done.toolCalls.filter(call => call.name === 'engine.askedAbout');
}

function nothingGuessedOrDropped(done: Played) {
    expect(done.toolCalls.map(call => call.action)).not.toContain('name_dropped');
    for (const call of asked(done)) expect(call.summary).not.toContain('Reach: guesses');
}

describe('the words reach the self-question', () => {
    it('reads a greeting and "who are you" as questions about the person', () => {
        expect(parseIntent('hello')).toMatchObject({
            action: 'interact', target: 'everyone here', topic: A_GREETING_TOPIC
        });
        expect(parseIntent('who are you?')).toMatchObject({
            action: 'interact', topic: A_TOPIC_ABOUT_THEMSELVES.name
        });
        expect(parseIntent('where are you from?')).toMatchObject({
            action: 'interact', topic: A_TOPIC_ABOUT_THEMSELVES.house
        });
        expect(parseIntent('I greet the ferryman').topic).toBe(A_GREETING_TOPIC);
    });

    it('takes the topics a model gives them as the same question', () => {
        for (const topic of ['greeting', 'identity', 'who he is', 'introduction']) {
            expect(selfFactFromTopic(topic), topic).toBe('name');
        }
        expect(selfFactFromTopic('the Empyrean Court')).toBeNull();
    });
});

describe('played', () => {
    it('"hello" to the room: up to three give their own names, nothing guessed or dropped', async () => {
        const { game, plans, provider, cultivator } = await withAModel('greet-room');
        expect(game.present(cultivator).length).toBeGreaterThanOrEqual(2);
        plans.push(JSON.stringify({
            action: 'interact', target: 'everyone_here', intent: 'talk', topic: 'greeting'
        }));
        const mark = provider.calls.length;
        const done = await game.act('hello') as Played;

        const answers = asked(done);
        expect(answers.length).toBeGreaterThanOrEqual(1);
        expect(answers.length).toBeLessThanOrEqual(3);
        for (const call of answers) expect(call.summary).toContain('Reach: answers');
        nothingGuessedOrDropped(done);

        const shown = provider.calls.slice(mark)
            .map(call => call.messages.find(m => m.role === 'user')?.content ?? '').join(' ');
        // A stranger gives their name; somebody known from home returns the greeting.
        expect(shown).toMatch(/gives their name|returns the greeting/);
        expect(shown).not.toContain('answers with confidence');
    }, 300_000);

    it('"hello" with no model reads the same', async () => {
        const { game } = await makeGameInWorld({ seed: 'greet-table', worldSeed: 'road-world' });
        await game.newRun('Probe');
        const done = await game.act('hello') as Played;
        expect(asked(done).length).toBeGreaterThanOrEqual(1);
        nothingGuessedOrDropped(done);
        expect(done.narration ?? '').toMatch(/gives their name|returns the greeting/);
        expect(done.narration ?? '').not.toContain('answers with confidence');
    }, 300_000);

    it('"who are you?" to one person gives their own name and files it', async () => {
        const { game, plans, cultivator } = await withAModel('who-are-you');
        const them = game.present(cultivator)
            .find(row => !game.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id));
        expect(them, 'nobody here is a stranger').toBeDefined();
        if (!them) return;
        plans.push(JSON.stringify({
            action: 'interact', target: them.name, intent: 'talk', topic: 'identity'
        }));
        const done = await game.act('who are you?') as Played;

        const answers = asked(done);
        expect(answers).toHaveLength(1);
        expect(answers[0]!.summary).toContain('Reach: answers');
        nothingGuessedOrDropped(done);
        expect(game.knowledge.isAwareOf(cultivator.id, 'cultivator', them.id)).toBe(true);
    }, 300_000);
});
