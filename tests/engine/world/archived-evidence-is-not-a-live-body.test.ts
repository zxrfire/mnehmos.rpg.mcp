/** The8210cf97 sixty-year guard reported seven forgotten-person references
 * in real closing results. Surviving lots/entries keep those immutable terms
 * through the existing settlement indices. They do not keep a current body.
 * These small records reproduce that distinction; a live companion reference
 * and a genuinely unheld row must still be rejected by the same guard. */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { witnessIndexFor } from '../../../src/engine/world/witness-reaction-index.js';
import { whatStillNames } from '../../support/forgotten-body-references.js';

const forgotten = 'an-old-seller';
function closedLot() {
    const world = createWorld({ seed: 'closed-archival-lot', presentYear: 0, regionCount: 0, skipPriorAges: true });
    const actor = { id: forgotten, name: 'An old seller', role: 'seller' };
    const add = (input: Parameters<typeof makeFact>[0]) => appendWorldFact(world, makeFact(input), { recur: false, bystanders: false });
    const lot = add({ day: 0, kind: 'gathering', summary: 'A lot was offered.', actors: [actor],
        data: { auctionLot: true, closesOnDay: 1, sellerId: forgotten } });
    expect([...witnessIndexFor(world).openAuctionLots].some(fact => fact.id === lot.id)).toBe(true);
    const result = add({ day: 1, kind: 'gathering', summary: 'The lot closed.', actors: [actor],
        data: { auctionResult: true, lotId: lot.id, sellerId: forgotten, stones: 3 } });
    world.currentDay = 2;
    return { world, lot, result, add };
}

it('reads a retained lot closing as archival identity without creating a seller body', () => {
    const { world, lot } = closedLot();
    expect([...witnessIndexFor(world).openAuctionLots].some(fact => fact.id === lot.id)).toBe(false);
    expect(world.npcs.some(person => person.id === forgotten)).toBe(false);
    expect(whatStillNames(world, new Set([forgotten]))).toEqual([]);
});

it('reads an actual board result kept by a surviving cited entry as archival', () => {
    const world = createWorld({ seed: 'closed-archival-board', presentYear: 0, regionCount: 0, skipPriorAges: true });
    const keeper = createNpc(world.seed, { id: 'keeper', onDay: 0, bornOnDay: -20 * 365 }); world.npcs.push(keeper);
    const actor = { id: forgotten, name: 'An old entrant', role: 'entrant' };
    const add = (input: Parameters<typeof makeFact>[0]) => appendWorldFact(world, makeFact(input), { recur: false, bystanders: false });
    const board = { openCompetition: true, hostId: 'host', contestDay: 0, venueId: 'yard', capitalCompetition: false };
    const entry = add({ day: 0, kind: 'gathering', summary: 'An entry was made.', actors: [actor], data: { ...board, entry: true } });
    add({ day: 0, kind: 'gathering', summary: 'The entrant placed second.', actors: [actor], data: { ...board, result: true, place: 2 } });
    add({ day: 1, kind: 'gathering', summary: 'A person kept the entry receipt.', causes: [entry.id],
        actors: [{ id: keeper.id, name: keeper.name, role: 'kept' }] });
    world.currentDay = 2;
    expect([...witnessIndexFor(world).competitions.values()].some(row => row.closed)).toBe(true);
    expect(whatStillNames(world, new Set([forgotten]))).toEqual([]);
});

it('still rejects a live-body reference and an uncited unrelated historical row', () => {
    const { world, add } = closedLot();
    const unheld = add({ day: 2, kind: 'gathering', summary: 'An unheld record.', data: { payeeId: forgotten } });
    const person = createNpc(world.seed, { id: 'current-person', onDay: 2, bornOnDay: -20 * 365 });
    person.activity = { kind: 'idle', note: 'With a companion.', withIds: [forgotten], sinceDay: 2, untilDay: null };
    world.npcs.push(person);
    const dangling = whatStillNames(world, new Set([forgotten]));
    expect(dangling.some(line => line.includes('withIds'))).toBe(true);
    expect(dangling.some(line => line.includes(unheld.id))).toBe(true);
});
