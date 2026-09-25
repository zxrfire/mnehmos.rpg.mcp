/**
 * Spoken to, somebody gives their name.
 *
 * The card tells the narrator never to name a face "until a ruling has them
 * give their name", and no ruling did: talking to somebody filed an
 * approach at the default statement, which the card reads as a face with no
 * name. A word that settles nothing now draws the name out, at `known`,
 * with a statement of its own.
 */

import { describe, expect, it } from 'vitest';

import { KnowledgeGate } from '../../src/web/knowledge';
import { thePlayerIsSureItIsThem } from '../../src/web/the-narrator-plays-the-world';
import { makeGameInWorld, ScriptedProvider } from './harness';

/** Somebody on the pinned square the player cannot yet be sure of, read off a first game on the same seeds. */
async function aStrangerOn(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'road-world' });
    const { cultivator } = await harness.game.newRun('Probe');
    const gate = new KnowledgeGate(harness.db);
    const stranger = harness.game.present(cultivator)
        .find(p => !thePlayerIsSureItIsThem(p.name, gate.awareness(cultivator.id, 'cultivator')));
    expect(stranger, 'nobody here the player is unsure of').toBeTruthy();
    return stranger!;
}

async function playedAgainst(seed: string, plan: object) {
    const provider = new ScriptedProvider({ plans: [JSON.stringify(plan)], narrations: ['(scripted)'] });
    const harness = await makeGameInWorld({ seed, worldSeed: 'road-world', provider });
    const { cultivator } = await harness.game.newRun('Probe');
    return { ...harness, provider, cultivator, gate: new KnowledgeGate(harness.db) };
}

describe('spoken to, they give their name', () => {
    it('files the name as the player\'s own, and says it on the page', async () => {
        const stranger = await aStrangerOn('intro-1');
        const { game, provider, cultivator, gate } = await playedAgainst(
            'intro-1', { action: 'interact', target: stranger.name, intent: 'talk' }
        );
        const mark = provider.calls.length;
        await game.act('I greet them');
        const prompts = provider.calls.slice(mark)
            .map(call => call.messages.find(m => m.role === 'user')?.content ?? '').join(' ');

        expect(thePlayerIsSureItIsThem(stranger.name, gate.awareness(cultivator.id, 'cultivator'))).toBe(true);
        expect(gate.stageOf(cultivator.id, 'cultivator', stranger.id)).toBe('known');
        // A ruling for the narrator to write inside the scene, not a sentence appended after it.
        expect(prompts).toContain(`${stranger.name} gives you their name.`);
    }, 300_000);

    it('gives no name to somebody being threatened', async () => {
        const stranger = await aStrangerOn('intro-2');
        const { game, cultivator, gate } = await playedAgainst(
            'intro-2', { action: 'interact', target: stranger.name, intent: 'threaten' }
        );
        await game.act('I threaten them');
        expect(gate.stageOf(cultivator.id, 'cultivator', stranger.id)).not.toBe('known');
    }, 300_000);
});
