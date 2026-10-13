/** The 1,500-year walk retained 5,442 overdue auction lots, all over a year old.
 * A consignment can remain in an object's provenance after its closing receipt ages out.
 * Keeping that consignment must keep its existing closing receipt: forgetting paperwork
 * does not put the same goods up for sale again. Unheld routine receipts still age out. */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { makeObject, transferPossession } from '../../../src/engine/world/possessions.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { keepTheBusinessStillOnTheBooks } from '../../../src/engine/world/the-business-the-world-still-keeps.js';
import { pendingAuctionLots } from '../../../src/engine/world/witness-reaction-index.js';

function closedLot(keepGoods: boolean) {
    const world = createWorld({ seed: 'closed-auction-paperwork', regionCount: 0, skipPriorAges: true });
    const lot = appendWorldFact(world, makeFact({ day: 0, kind: 'gathering', summary: 'Qi Grass was consigned.',
        data: { auctionLot: true, objectId: 'goods', sellerId: 'seller', payeeId: 'seller', closesOnDay: 7 } }), { recur: false });
    const receipt = appendWorldFact(world, makeFact({ day: 7, kind: 'gathering', summary: 'Qi Grass was not sold.',
        data: { auctionResult: true, lotId: lot.id, objectId: 'goods', stones: 0 } }), { recur: false });
    if (keepGoods) world.objects.push(transferPossession(makeObject({ id: 'goods', name: 'Qi Grass', kind: 'material',
        ownerId: 'seller', possessorId: 'seller', data: { materialId: 'herb-qi-grass', quantity: 1 } }), {
        onDay: 0, toHolderId: 'seller', toHolderName: 'Seller', how: 'lent', transfersOwnership: false, factId: lot.id
    }));
    world.currentDay = 730;
    return { world, lot, receipt };
}

it('keeps the closing receipt with a consignment retained by actual goods', () => {
    const { world, lot, receipt } = closedLot(true);
    expect(pendingAuctionLots(world)).toEqual([]);
    keepTheBusinessStillOnTheBooks(world);
    expect(world.history.facts.some(fact => fact.id === lot.id)).toBe(true);
    expect(world.history.facts.some(fact => fact.id === receipt.id)).toBe(true);
    expect(pendingAuctionLots(world)).toEqual([]);
});

it('lets both unheld routine records age out', () => {
    const { world } = closedLot(false);
    keepTheBusinessStillOnTheBooks(world);
    expect(world.history.facts).toEqual([]);
    expect(pendingAuctionLots(world)).toEqual([]);
});
