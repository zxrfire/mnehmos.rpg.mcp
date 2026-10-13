/**
 * Year-300 drift-guard had 1,104 overdue lots across 666 closing dates. A kept
 * consignment could retain its lot but lose the result during annual cleanup,
 * reopening settled business every year. Arrange exactly that old referenced
 * lot and its real unsold receipt, then test cleanup and once-only settlement.
 * The shared isAClosedReferencedLot predicate is also required by the separate
 * pre-baked-world reachability test; unrelated years and population are not
 * preconditions for this defect.
 * That file's contract also passes a real closed referenced lot into the same
 * aClosedLotSurvivesCleanup scenario used here.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { settleCapitalAuctions } from '../../../src/engine/world/a-capital-auction.js';
import { isAClosedReferencedLot } from '../../support/auction-precondition.js';
import { aClosedLotSurvivesCleanup } from '../../support/auction-scenario.js';

it('retains the actual closing proof with a kept lot, including after a JSON reload', () => {
    const world = createWorld({ seed: 'kept-unsold-lot', presentYear: 10, regionCount: 0, skipPriorAges: true });
    world.locations.push(makeLocation({ id: 'venue', name: 'The exchange', kind: 'settlement' }));
    const seller = createNpc(world.seed, { id: 'seller', name: 'Seller', locationId: 'venue', onDay: 0, bornOnDay: -20 * 365 });
    world.npcs.push(seller);
    const lot = appendWorldFact(world, makeFact({ day: 0, kind: 'gathering', locationId: 'venue',
        actors: [{ id: seller.id, name: seller.name, role: 'seller' }], summary: 'The consignment was offered.',
        data: { auctionLot: true, objectId: 'consignment', sellerId: seller.id, payeeId: 'house', reserve: 100, closesOnDay: 7 } }));
    world.objects.push(makeObject({ id: 'consignment', name: 'Qi Grass', kind: 'material',
        ownerId: 'house', possessorId: seller.id, locationId: 'venue', tags: ['exchange'],
        data: { materialId: 'herb-qi-grass' }, provenance: [{ onDay: 0, holderId: seller.id,
            holderName: seller.name, how: 'lent', source: 'house', previousHolderId: 'house',
            previousHolderName: 'house', factId: lot.id, note: 'Consigned at the exchange.' }] }));
    const closed = settleCapitalAuctions(world, 7);
    expect(closed).toHaveLength(1);
    expect(closed[0]!.data.winnerId).toBeNull();
    expect(isAClosedReferencedLot(world, lot.id)).toBe(true);
    aClosedLotSurvivesCleanup(world, lot.id);
});
