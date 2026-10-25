/**
 * Replay R1/R3 on 7cd656b9: a greeting appended "Waiting of 3 hours";
 * approach then question appended further six-hour waits. Talking is not a
 * requested span. Actual movement and explicit waits retain their own cost.
 */
import { expect, it } from 'vitest';
import { lesserActionDays } from '../../src/web/lesser-action-costs.js';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { LOCAL_WALK_DAYS } from '../../src/engine/world/local-walking-cost.js';

it('does not price words or a counter exchange as an implicit wait', () => {
    expect(lesserActionDays({ action: 'interact', intent: 'talk' })).toBe(0);
    expect(lesserActionDays({ action: 'passage', intent: 'ticket' })).toBe(0);
    expect(lesserActionDays({ action: 'eat' })).toBe(0.125);
    expect(lesserActionDays({ action: 'move', target: 'the market' })).toBe(LOCAL_WALK_DAYS);
});

it('approaches a listener in the same area and asks without any wait span', async () => {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations: ['They answer.'] });
    const h = await makeGameInWorld({ seed: 'open-1', worldSeed: 'w-open-1', provider });
    try {
        await h.game.newRun('Visitor');
        const body = h.game.currentRun().cultivator;
        const person = h.game.present(body)[0]!;
        expect(person).toBeDefined();
        const place = worldLocationFor(h.game.atHand!, body.location)!;
        const area = peopleInThisPlace(h.repos, body, h.game.atHand!, place).whereIs.get(person.id)!;
        expect(area).toBeDefined();
        h.repos.cultivators.standIn(body.id, area);
        const before = h.game.currentRun().run.elapsedDays;
        plans.push(JSON.stringify({ steps: [
            { action: 'move', intent: 'approach', target: person.name, said: `I go over to ${person.name}` },
            { action: 'interact', intent: 'talk', target: person.name, topic: 'What are you looking for?', said: 'ask what you are looking for' }
        ] }));
        const turn = await h.game.act(`I go over to ${person.name} and ask what you are looking for`);
        expect(turn.toolCalls.some(call => call.action === 'interact' && call.ok)).toBe(true);
        expect(h.game.currentRun().run.elapsedDays, JSON.stringify(turn.toolCalls)).toBe(before);
        expect(turn.toolCalls.some(call => call.name === 'engine.lesserActionTime')).toBe(false);
        expect(turn.toolCalls.some(call => call.name === 'engine.simulateTimeSkip')).toBe(false);
    } finally { h.db.close(); }
});
