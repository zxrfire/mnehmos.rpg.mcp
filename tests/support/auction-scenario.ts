/** One focused cleanup/settlement scenario accepts either an arranged or a lived starting world. */
import { expect } from 'vitest';
import type { WorldState } from '../../src/engine/world/world-state.js';
import { isAClosedReferencedLot } from './auction-precondition.js';
import { keepTheBusinessStillOnTheBooks } from '../../src/engine/world/the-business-the-world-still-keeps.js';
import { pendingAuctionLots } from '../../src/engine/world/witness-reaction-index.js';
import { settleCapitalAuctions } from '../../src/engine/world/a-capital-auction.js';

export function aClosedLotSurvivesCleanup(world: WorldState, lotId: string): void {
    expect(isAClosedReferencedLot(world, lotId)).toBe(true);
    keepTheBusinessStillOnTheBooks(world);
    // Cleanup may remove the whole obsolete docket. It cannot keep the lot
    // while forgetting that its real auction already ended.
    for (const copy of [world, JSON.parse(JSON.stringify(world)) as WorldState]) {
        expect(pendingAuctionLots(copy).some(lot => lot.id === lotId)).toBe(false);
        expect(settleCapitalAuctions(copy, copy.currentDay).some(result => result.data.lotId === lotId)).toBe(false);
    }
}
