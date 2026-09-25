/**
 * A place a model puts in a going act is in the sentence or in the turn before it.
 *
 * Played blind, starving at the Azure Dew Sect's gate: "ok ill go down to that town and buy
 * something to eat" meant the town below the wall. The model read move(Silver Island), nine days
 * back the way they came, and because eating spends an act too, the guard waved the walk through.
 * They walked into starvation.
 */
import { describe, expect, it } from 'vitest';

import { ProviderNarrator } from '../../src/web/narrator';
import { ScriptedProvider } from './harness';

function modelSaying(json: string) {
    return new ProviderNarrator(new ScriptedProvider({ plans: [json] }), { model: 'test' });
}

const TO_SILVER_ISLAND = '{"action":"move","target":"Silver Island","reason":"goes to the town"}';

describe('a destination is said or just named', () => {
    it('declines a walk to a place neither the sentence nor the turn before names', async () => {
        const plan = await modelSaying(TO_SILVER_ISLAND)
            .plan('ok ill go down to that town', '', 'Outside the wall there is a market town, and it is here because the house is.');
        expect(plan.source).toBe('fallback');
        expect(plan.note).toMatch(/going to Silver Island, which neither this sentence nor the turn before names/);
    });

    it('keeps a walk to a place the sentence names', async () => {
        const plan = await modelSaying(TO_SILVER_ISLAND).plan('ok i walk back to silver island', '');
        expect(plan.source).toBe('model');
        expect(plan.action).toMatchObject({ action: 'move', target: 'Silver Island' });
    });

    it('keeps a walk to "that town" when the turn before named it', async () => {
        const plan = await modelSaying(TO_SILVER_ISLAND)
            .plan('ok lets go to that town then', '', 'Silver Island is four days by sea, and the only city near.');
        expect(plan.source).toBe('model');
        expect(plan.action).toMatchObject({ action: 'move', target: 'Silver Island' });
    });
});
