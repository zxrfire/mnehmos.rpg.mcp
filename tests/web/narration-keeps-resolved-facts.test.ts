/** Gemma findings 9, 10, 12, 17, 21 and 39: inspect the card sent to the model,
 * rather than assuming a scripted reply proves prose compliance. */
import { describe, expect, it } from 'vitest';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { observable, type Company } from '../../src/web/facts.js';
import { foldTheCallsIntoOneTurn } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { summariseToolBody } from '../../src/web/tool-result-prose.js';
import type { Execution } from '../../src/web/turn-wire-shapes.js';
import { ScriptedProvider } from './harness.js';

const scene = { place: 'the square', ambient: 'normal' as const };
const call = (headline: string, lines: string[]): Execution => ({
    facts: observable(headline, lines, ''), events: [], timeSkip: null,
    breakthrough: null, outcome: 'executed', calls: []
});
const userCard = (provider: ScriptedProvider) => provider.calls.at(-1)!.messages.find(message => message.role === 'user')!.content;

describe('the narrator receives resolved facts', () => {
    it('does not infer better qi from a change of scene (finding 17)', async () => {
        const provider = new ScriptedProvider({ narrations: ['The air is kinder here.'] });
        await new ProviderNarrator(provider, { model: 'test' }).narrate(
            observable('You look.', [], ''), { ...scene, ambient: 'thin' });
        expect(userCard(provider)).toContain("Do not invent a comparison with another place's qi");
    });
    it('keeps bought and quoted outcomes distinct through a folded turn (finding 9)', async () => {
        const provider = new ScriptedProvider({ narrations: ['She hands over the manual.', 'You hold the manual.'] });
        const narrator = new ProviderNarrator(provider, { model: 'test' });
        const facts = foldTheCallsIntoOneTurn([
            call('Pill, bought.', ['The pill cost 17 spirit stones.']),
            call('Manual, priced.', ['The manual costs 7 spirit stones a copy.'])
        ]).facts;
        await narrator.narrate(facts, scene);
        expect(userCard(provider)).toContain('Pill, bought.');
        expect(userCard(provider)).toContain('Manual, priced.');
        expect(userCard(provider)).toContain('a quote transfers nothing');
        await narrator.narrate(observable('You look.', ['You have a pill and no books.'], ''), scene);
        expect(userCard(provider)).toContain('Previous narration is prose, not evidence');
    });

    it('hands over a learned art as learned (finding 10)', async () => {
        const provider = new ScriptedProvider({ narrations: ['The art is learned; practice lies ahead.'] });
        const narrator = new ProviderNarrator(provider, { model: 'test' });
        await narrator.narrate(observable('Study finished.', summariseToolBody({ learned: true,
            technique: { name: 'the art', element: null } }), ''), scene);
        expect(userCard(provider)).toContain('learned');
        expect(userCard(provider)).not.toContain('Holding it is not being able to use it');
    });

    it('keeps a purchase headline when its detail only supplies the price (finding 39)', async () => {
        const provider = new ScriptedProvider({ narrations: ['You pay and take possession.'] });
        await new ProviderNarrator(provider, { model: 'test' }).narrate(
            observable('Boat bought.', ['The boat for 30 spirit stones. You have 0 now.'], ''), scene);
        expect(userCard(provider)).toContain('Boat bought.');
    });

    it('identifies the player separately from a present stranger (findings 12, 21)', async () => {
        const provider = new ScriptedProvider({ narrations: ['A stranger stands nearby.'] });
        const company: Company = { named: [], strangers: [{ ordinal: 0 }], total: 1 };
        await new ProviderNarrator(provider, { model: 'test' }).narrate(
            observable('Somebody is here.', ['A man stands in plain sight.'], ''), {
                ...scene, company, playerSaid: 'who is here', standing: {
                    name: 'Lin Mo', rank: 'Qi Condensation Layer 1', age: 20,
                    spiritStones: 0, booksHeld: [], methods: [], untreatedInjuries: 0, house: null
                }
            });
        expect(userCard(provider)).toContain('The player: Lin Mo');
        expect(userCard(provider)).toContain('A name on the player is never a name for a stranger');
        expect(userCard(provider)).toContain('Omitting a person from prose does not make them absent');
    });
});
