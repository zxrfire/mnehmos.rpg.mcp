/**
 * The province's senses and a place's customs reach the narrator.
 *
 * The prompt already rendered all three scene fields and nothing set them, so
 * every province smelled of whatever the model guessed and every death was
 * buried in the model's default. The senses go over every turn in a province;
 * a custom goes over only on the turn its situation happens.
 */

import { describe, expect, it } from 'vitest';

import { REGIONS, regionIdOfPlace } from '../../src/data/cultivation/regions';
import { makeGameInWorld, ScriptedProvider } from './harness';

function narrationsSince(provider: ScriptedProvider, from: number): string[] {
    return provider.calls.slice(from)
        .filter(call => !(call.messages.find(m => m.role === 'system')?.content ?? '')
            .startsWith('You are the intent router'))
        .map(call => call.messages.find(m => m.role === 'user')?.content ?? '');
}

const regionAt = (place: string | null) => REGIONS.find(r => r.id === regionIdOfPlace(place))!;

describe('how this place is', () => {
    it('hands over the province\'s senses, and no custom on a turn that touches none', async () => {
        const provider = new ScriptedProvider({ plans: ['{"action":"look"}'], narrations: ['(scripted)'] });
        const { game } = await makeGameInWorld({ seed: 'senses-1', worldSeed: 'road-world', provider });
        await game.newRun('Probe');
        const region = regionAt(game.state().cultivator.location);
        expect(region).toBeTruthy();

        const mark = provider.calls.length;
        await game.act('I look around');
        const prompt = narrationsSince(provider, mark).join('\n');
        expect(prompt).toContain(region.register.smell.trim().replace(/\.$/, ''));
        expect(prompt).not.toContain('THE WAY IT IS DONE HERE');
    }, 300_000);

    it('hands over the road\'s custom on a journey, from the province arrived in', async () => {
        const provider = new ScriptedProvider({
            plans: ['{"action":"move","target":"Buddha Precipice","intent":"travel"}'],
            narrations: ['(scripted)']
        });
        // The seed whose eleven days to the Buddha Precipice meet only a merchant.
        const { game } = await makeGameInWorld({ seed: 'road-5', worldSeed: 'road-world', provider });
        await game.newRun('Traveller');
        const before = game.state().cultivator.location;

        const mark = provider.calls.length;
        await game.act('I travel to the Buddha Precipice');
        const after = game.state().cultivator.location;
        expect(after).not.toBe(before);

        const prompt = narrationsSince(provider, mark).join('\n');
        expect(prompt).toContain('THE WAY IT IS DONE HERE');
        expect(prompt).toContain(regionAt(after).customs.threatModel);
    }, 300_000);
});
