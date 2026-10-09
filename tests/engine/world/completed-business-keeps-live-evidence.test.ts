/** At year1150 routine business held 273,945 gathering facts and 113,675
 * objects. Completed offscreen dockets can leave; current terms, witnessed
 * deeds, visits and counted amounts must survive the ordinary boundary. */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { keepTheBusinessStillOnTheBooks } from '../../../src/engine/world/the-business-the-world-still-keeps.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { whatThisThingIs } from '../../../src/engine/world/what-a-house-gives-merit-for.js';
import { referenceKeys, witnessIndexFor } from '../../../src/engine/world/witness-reaction-index.js';
import { resolveWithPlayerPresent } from '../../../src/engine/world/background-incident-draw.js';

function arrangement() {
    const world = createWorld({ seed: 'completed-dockets', presentYear: 200, regionCount: 0, skipPriorAges: true });
    world.locations.push(makeLocation({ id: 'town', name: 'A town', kind: 'settlement' }));
    world.npcs.push(setRealm(createNpc(world.seed, { id: 'person', locationId: 'town',
        bornOnDay: -30 * 365, onDay: world.currentDay }), 21, world.currentDay));
    const docket = (day: number, data: Record<string, string | number | boolean | null> = {}) => appendWorldFact(world,
        makeFact({ day, kind: 'gathering', locationId: 'town', actors: [{ id: 'person', name: 'A person', role: 'factor' }],
            summary: `House business on day ${day}.`, data: { exchangeReturn: true, ...data } }), { recur: false });
    return { world, docket };
}

it('the live boundary retains visits, current obligations and referenced evidence while pruning completed dockets', () => {
    const { world, docket } = arrangement();
    const obsolete = docket(1), evidence = docket(2), current = docket(world.currentDay - 1, { receiptId: evidence.id });
    const visited = docket(3);
    advanceWorldForPlay(world, { days: 1, stopOnInterrupt: false });
    const index = witnessIndexFor(world);
    expect(index.byId.has(obsolete.id)).toBe(false);
    for (const fact of [evidence, current, visited]) expect(index.byId.has(fact.id)).toBe(true);
    for (const person of world.npcs) for (const id of person.historyFactIds) expect(index.byId.has(id)).toBe(true);
    expect(referenceKeys(index.byId.get(current.id)!)).toContain(evidence.id);
});

it('keeps exact foreground careers and played testimony regardless of age', () => {
    const { world, docket } = arrangement();
    const first = docket(1), second = docket(2);
    const player = createNpc(world.seed, { id: 'player', locationId: 'town', bornOnDay: world.currentDay - 30 * 365,
        onDay: world.currentDay, tags: [PLAYER_ROW_TAG] });
    world.npcs.push(player);
    resolveWithPlayerPresent(world, 'town', () => keepTheBusinessStillOnTheBooks(world));
    expect(world.history.facts.map(fact => fact.id)).toEqual([first.id, second.id]);
});

it('folds only unclaimed background counted goods at the same actual custody and ground', () => {
    const { world, docket } = arrangement();
    docket(1); docket(2);
    const stock = (id: string, ownerId = 'house', grade = 'mortal') => makeObject({ id, name: 'Clear Meridian Pill',
        kind: 'pill', ownerId, locationId: 'town', tags: [`grade:${grade}`], data: { pillId: 'pill-clear-meridian', quantity: 2 } });
    world.objects.push(stock('first'), stock('second'), stock('other', 'another-house'));
    keepTheBusinessStillOnTheBooks(world);
    expect(world.objects).toHaveLength(2);
    expect(world.objects.map(object => [object.ownerId, whatThisThingIs(object)?.quantity])).toEqual([
        ['house', 4], ['another-house', 2]
    ]);
});
