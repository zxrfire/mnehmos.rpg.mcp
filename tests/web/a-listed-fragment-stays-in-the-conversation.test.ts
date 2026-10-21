/**
 * Gemma finding 9: "the qi gathering one" after a manual listing bought a
 * similarly named pill. A partial-name pointer belongs to the printed list,
 * including when the model has prematurely expanded it to a catalog name.
 */
import { expect, it } from 'vitest';
import { resolvingAgainstTheLastTurn, whichOfTheNamedThings, type WhatTheLastTurnDid }
    from '../../src/web/last-turn-memory.js';

const named = [{ name: 'Lesser Qi-Gathering Manual', stones: 7 }, { name: 'Five-Breath Circulation Scripture', stones: 12 }];
const record: WhatTheLastTurnDid = { runId: 'run', cultivatorId: 'reader', onTurn: 1,
    outcome: 'executed', acts: [], named };

it('resolves a partial-name one against the manuals just listed', () => {
    expect(whichOfTheNamedThings('the qi gathering one', '', named)?.name).toBe(named[0].name);
});

it('does not let an expanded catalog guess replace the conversational referent', () => {
    const input = 'ok ill take the qi gathering one. how much?';
    const result = resolvingAgainstTheLastTurn({ source: 'model', action: { action: 'buy', target: 'Qi-Gathering Pill' } }, record, input);
    expect(result.plan.action.target).toBe(named[0].name);
});

it('also supplies the referent when the model retained only the purchase act', () => {
    const result = resolvingAgainstTheLastTurn({ source: 'model', action: { action: 'buy' } }, record,
        'I buy the qi gathering one');
    expect(result.plan.action.target).toBe(named[0].name);
});

it('does not pick arbitrarily between two printed matches', () => {
    const two = [...named, { name: 'Advanced Qi-Gathering Manual', stones: 50 }];
    expect(whichOfTheNamedThings('the qi gathering one', '', two)).toBeNull();
});

it('keeps an explicit pill purchase even after a manual listing', () => {
    const plan = { source: 'model' as const, action: { action: 'buy' as const, target: 'Qi-Gathering Pill' } };
    expect(resolvingAgainstTheLastTurn(plan, record, 'I buy a Qi-Gathering Pill').plan.action).toEqual(plan.action);
});
