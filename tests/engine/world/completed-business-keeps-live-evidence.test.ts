/** At year1150 routine business held 273,945 gathering facts and 113,675
 * objects. Completed offscreen dockets can leave; current terms, witnessed
 * deeds and counted amounts must survive the ordinary boundary.
 *
 * Visits are kept for the foreground only, the people a card is built for (owner, 2026-10-09: the
 * card system is the foreground/background line). A background person's routine is read off their
 * role and activity when they are met, so their old settled dockets go like any other.
 * The later audit found that forgotten mundane events alone could not start
 * the sweep: its early gate checked only business dockets. Nobody needs an
 * unrelated expired receipt before the world can forget an unwitnessed event.
 * Living participants and actual grievances still retain their evidence.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm, markDead, PLAYER_ROW_TAG } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { keepTheBusinessStillOnTheBooks } from '../../../src/engine/world/the-business-the-world-still-keeps.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { whatThisThingIs } from '../../../src/engine/world/what-a-house-gives-merit-for.js';
import { referenceKeys, witnessIndexFor } from '../../../src/engine/world/witness-reaction-index.js';
import { resolveWithPlayerPresent } from '../../../src/engine/world/background-incident-draw.js';
import { createObligation } from '../../../src/engine/social/grudges.js';

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

function anOldMundaneEvent(withWitness = false) {
    const { world } = arrangement();
    world.npcs[0] = markDead(world.npcs[0]!, world.currentDay - 1, 'Their life ended.');
    if (withWitness) world.npcs.push(createNpc(world.seed, { id: 'witness', locationId: 'town',
        bornOnDay: world.currentDay - 30 * 365, onDay: world.currentDay }));
    const event = appendWorldFact(world, makeFact({ day: 1, kind: 'opportunity',
        locationId: 'town', summary: 'A person heard of available work.',
        actors: [{ id: 'person', name: 'A person', role: 'listener' }],
        witnessIds: withWitness ? ['witness'] : [] }), { recur: false });
    return { world, event };
}

it('forgets a mundane event without requiring an unrelated old business docket', () => {
    const { world, event } = anOldMundaneEvent();
    keepTheBusinessStillOnTheBooks(world);
    expect(witnessIndexFor(world).byId.has(event.id)).toBe(false);
    expect(world.npcs[0]!.historyFactIds).not.toContain(event.id);
});

it('keeps a mundane event while a living witness can still remember it', () => {
    const { world, event } = anOldMundaneEvent(true);
    keepTheBusinessStillOnTheBooks(world);
    expect(witnessIndexFor(world).byId.has(event.id)).toBe(true);
});

it('keeps forgotten mundane evidence when an actual grievance points at it', () => {
    const { world, event } = anOldMundaneEvent();
    const holder = createNpc(world.seed, { id: 'holder', locationId: 'town',
        bornOnDay: world.currentDay - 30 * 365, onDay: world.currentDay });
    world.npcs.push(holder);
    world.obligations.push(createObligation({ kind: 'grudge', holderId: holder.id,
        subjectId: 'person', cause: 'broken_oath', severity: 'slight', onDay: world.currentDay,
        triggeringEventId: event.id, description: 'They did not keep their promised work.' }));
    keepTheBusinessStillOnTheBooks(world);
    expect(witnessIndexFor(world).byId.has(event.id)).toBe(true);
});

it('the live boundary retains current business and referenced evidence while pruning a background person\'s settled dockets', () => {
    const { world, docket } = arrangement();
    const obsolete = docket(1), evidence = docket(2), current = docket(world.currentDay - 1, { receiptId: evidence.id });
    const visited = docket(3);
    advanceWorldForPlay(world, { days: 1, stopOnInterrupt: false });
    const index = witnessIndexFor(world);
    for (const fact of [obsolete, visited]) expect(index.byId.has(fact.id)).toBe(false);
    for (const fact of [evidence, current]) expect(index.byId.has(fact.id)).toBe(true);
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
