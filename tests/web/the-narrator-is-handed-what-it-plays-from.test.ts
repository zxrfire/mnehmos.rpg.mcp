/**
 * What the engine hands the narrator so it can play the world, rather than report it.
 *
 * Found by playing on gemma4:31b: the opening recited stall prices and intake bars in the one
 * turn that is about who somebody is; a follow-up question was answered by somebody with no
 * memory of the turn before; and a line the engine requires was always appended verbatim
 * under the prose, because the prompt forbade the narrator the engine's wording.
 */
import { describe, expect, it } from 'vitest';

import { composeNarrationUser } from '../../src/web/prompt';
import { makeGameInWorld, ScriptedProvider } from './harness';

const narrationPrompts = (provider: ScriptedProvider) => provider.calls
    .filter(call => !(call.messages.find(m => m.role === 'system')?.content ?? '')
        .startsWith('You are the intent router'))
    .map(call => call.messages.find(m => m.role === 'user')?.content ?? '');

describe('the opening is a life and a place, not a catalogue', () => {
    it('files what is live as its own entry and keeps it out of the opening narration', async () => {
        const provider = new ScriptedProvider({ plans: [], narrations: ['Sixteen years of grey dirt.'] });
        const { game } = await makeGameInWorld({ worldSeed: 'a-xianxia-run', seed: 'xianxia', provider });
        await game.newRun('Shen Wuyou');

        const opening = narrationPrompts(provider)[0]!;
        const facts = opening.slice(opening.indexOf('WHAT THE ENGINE RULED'));
        // Pinned world: this square has a stall and dated intakes, so the check is not vacuous.
        const engine = game.state().log.filter(entry => entry.role === 'engine').map(entry => entry.text);
        const live = engine.find(text => /intake|stall/i.test(text));
        expect(live, 'the pinned square has something live on it').toBeDefined();
        expect(facts).not.toMatch(/is holding an intake|A stall here/);
        expect(opening).toContain('THE LIFE BEHIND THIS CULTIVATOR');
    });
});

describe('a conversation carries over', () => {
    it('hands the narrator the turn before, and not on the opening', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"look"}', '{"action":"look"}'],
            narrations: ['The opening.', '"Fifteen," the stallholder says.', 'Later.']
        });
        const { game } = await makeGameInWorld({ worldSeed: 'a-xianxia-run', seed: 'xianxia', provider });
        await game.newRun('Shen Wuyou');
        await game.act('I look around');
        await game.act('I look around');

        const [opening, first, second] = narrationPrompts(provider);
        expect(opening).not.toContain('THE TURN BEFORE');
        expect(first).toContain('THE TURN BEFORE');
        expect(second).toContain('THE TURN BEFORE');
        expect(second).toContain('"Fifteen," the stallholder says.');
        expect(second).toContain('The player: "I look around"');
    });
});

describe('a line the engine requires is asked for, not appended', () => {
    it('puts required lines in their own block to be said word for word', () => {
        const message = composeNarrationUser(
            {
                headline: 'x',
                lines: ['Nothing accumulates.'],
                structure: [],
                prose: '',
                required: ['No cultivation method, so nothing accumulates however long you sit.']
            },
            { place: 'Wind Turn', ambient: 'thin' }
        );
        const at = message.indexOf('SAY THESE WORD FOR WORD');
        expect(at).toBeGreaterThan(-1);
        expect(message.slice(at)).toContain('- No cultivation method, so nothing accumulates however long you sit.');
    });
});

describe('the people in the square reach the narrator as people', () => {
    it('hands over a card for somebody standing there, with what they are at', async () => {
        const provider = new ScriptedProvider({ plans: ['{"action":"look"}'], narrations: ['x', 'y'] });
        const { game } = await makeGameInWorld({ worldSeed: 'a-xianxia-run', seed: 'xianxia', provider });
        await game.newRun('Shen Wuyou');
        await game.act('I look around');

        const prompt = narrationPrompts(provider).at(-1)!;
        expect(prompt).toContain('THE PEOPLE HERE');
        expect(prompt).toMatch(/Right now: /);
    });
});
