/**
 * Overlay05's played route list displayed "Between ... and ...", but fallback
 * composition split the actual waypoint name at "and" and refused a made-up
 * first half. It spent zero days instead of returning along the four-day road.
 * The ordinary noun cleaner also removed that same name suffix. Literal ranges
 * from actual names preserve lexical identity only: they grant no discovery,
 * permission or outcome. A following independent request still runs in order.
 * Model, unavailable-provider and deterministic readers share this context.
 * No context keeps old splitting; two named candidates never choose a target.
 */
import { expect, it } from 'vitest';
import { makeLocation, linkLocations } from '../../src/engine/world/locations.js';
import { addPlacesOnTheWay, ROUTE_STOP } from '../../src/engine/world/places-on-the-way.js';
import { explicitNameSpansIn, theClausesOf, theWholeSentenceAsAPlan, restoreExplicitNameTarget,
    stepsOfThePlan } from '../../src/web/a-sentence-can-be-more-than-one-call.js';
import { parseIntent } from '../../src/web/actions.js';
import { DeterministicNarrator, ProviderNarrator } from '../../src/web/narrator.js';
import { ScriptedProvider } from './harness.js';

function displayedName() {
    const from = makeLocation({ id: 'name-origin', name: 'Naming departure', kind: 'settlement' });
    const to = makeLocation({ id: 'name-end', name: 'Naming destination', kind: 'settlement' });
    linkLocations(from, to, 'road', 8);
    const locations = [from, to]; addPlacesOnTheWay(locations);
    return locations.find(place => place.tags.includes(ROUTE_STOP))!.name;
}

it('preserves the actual displayed waypoint name in deterministic and both provider paths', async () => {
    const name = displayedName(), input = `I travel to ${name}`;
    const spans = explicitNameSpansIn(input, [name]);
    expect(theClausesOf(input, spans)).toEqual([input]);
    for (const narrator of [new DeterministicNarrator(),
        new ProviderNarrator(new ScriptedProvider({ plans: [JSON.stringify({ action: 'move',
            target: name.split(' and ')[0], intent: 'travel' })] }), { model: 'test' }),
        new ProviderNarrator(new ScriptedProvider({ plans: ['not a plan'] }), { model: 'test' }),
        new ProviderNarrator(new ScriptedProvider({ plans: [JSON.stringify({ steps: [{ action: 'move',
            target: name.split(' and ')[0], intent: 'travel', said: input }] })] }), { model: 'test' })]) {
        const plan = await narrator.plan(input, '', null, spans);
        expect(stepsOfThePlan(plan)).toHaveLength(1);
        expect(plan.action.target).toBe(name);
        expect(stepsOfThePlan(plan)[0]!.action.target).toBe(name);
    }
});

it('keeps a following real act after a protected full name', async () => {
    const name = displayedName(), go = `I travel to ${name}`, ask = 'I ask where I can eat';
    const input = `${go} and then ${ask}`, spans = explicitNameSpansIn(input, [name]);
    expect(theClausesOf(input, spans)).toEqual([go, ask]);
    const plan = await theWholeSentenceAsAPlan(input, [{ action: parseIntent(go), said: go },
        { action: parseIntent(ask), said: ask }], async clause => parseIntent(clause), spans);
    expect(plan.steps.map(step => step.action.action)).toEqual(['move', parseIntent(ask).action]);
    expect(plan.steps[0]!.action.target).toBe(name);
    expect(plan.steps[1]!.said).toBe(ask);
});

it('protects internal then and comma but keeps unmentioned and unknown words ordinary', () => {
    const name = 'First Dock, Then Last Dock';
    const go = `I travel to ${name}`, after = 'I wait for one day';
    const input = `${go} and ${after}`;
    expect(theClausesOf(input, explicitNameSpansIn(input, [name, 'Unmentioned and Hidden Dock'])))
        .toEqual([go, after]);
    expect(explicitNameSpansIn(input, ['Unmentioned and Hidden Dock'])).toEqual([]);
    expect(theClausesOf(input)).not.toEqual([go, after]);
    expect(explicitNameSpansIn('I travel to XFirst Dock, Then Last DockY', [name])).toEqual([]);
});

it('does not choose between two literal names with the same prefix or fill missing targets', () => {
    const names = ['First Dock and North Dock', 'First Dock and South Dock'];
    const input = `I ask about ${names[0]} and ${names[1]}`;
    const spans = explicitNameSpansIn(input, names);
    const partial = { action: 'destinations' as const, target: 'First Dock' };
    expect(restoreExplicitNameTarget(partial, input, spans)).toBe(partial);
    const absent = { action: 'move' as const };
    expect(restoreExplicitNameTarget(absent, input, spans)).toBe(absent);
    const article = { action: 'move' as const, target: 'the' };
    expect(restoreExplicitNameTarget(article, input, spans)).toBe(article);
});
