/**
 * Gemma play, 2026-10-20, findings 2 and 10: a question about the current
 * place and a search for a corner both reached the destination table.
 * The model's routing guidance must distinguish local surroundings from
 * journeys. Scripted replies check that the local reading reaches play;
 * they do not measure a model's language comprehension.
 */
import { describe, expect, it } from 'vitest';
import { INTENT_SYSTEM_PROMPT } from '../../src/web/prompt';
import { THE_LANES } from '../../src/web/the-lanes-a-sentence-can-go-down';
import { makeGame, planned, ScriptedProvider } from './harness';

describe('questions about the current place', () => {
    it('teaches the model the local reading and the journey boundary', () => {
        expect(THE_LANES.perceive.says).toContain('where you are now');
        expect(THE_LANES.perceive.says).toContain('a corner here');
        expect(INTENT_SYSTEM_PROMPT).toContain('"where am I"');
        expect(INTENT_SYSTEM_PROMPT).toContain('"I find a quiet corner here"');
        expect(INTENT_SYSTEM_PROMPT).toContain('"where could I travel"');
    });

    it.each(['where am i', 'I find a quiet corner here'])('%s reaches a local look without a journey', async said => {
        const provider = new ScriptedProvider({
            plans: [JSON.stringify({ lane: 'perceive', intent: 'around' })],
            narrations: ['You look around.']
        });
        const { game, db } = makeGame({ provider, seed: 'local-question' });
        try {
            await game.newRun('Reader');
            const before = game.currentRun();
            const place = before.cultivator.location;
            if (place === null) throw new Error('A new life needs a physical place.');
            const answer = await game.act(said);
            expect(planned(answer)).toMatchObject({ source: 'model', action: 'look' });
            expect(answer.state.cultivator.location).toBe(before.cultivator.location);
            expect(answer.state.run.elapsedDays).toBe(before.run.elapsedDays);
            expect(answer.toolCalls.some(call => call.name === 'engine.readState' && call.action === 'look')).toBe(true);
            expect(answer.toolCalls.some(call => call.action === 'destinations')).toBe(false);
            const rulings = answer.state.log.filter(row => row.role === 'engine' && row.turn === answer.state.run.turn);
            expect(rulings.some(row => row.text.includes(place))).toBe(true);
            expect(rulings.map(row => row.text).join('\n')).not.toMatch(/places .*could be left for|Horizon|travel days/);
        } finally { db.close(); }
    });
});
