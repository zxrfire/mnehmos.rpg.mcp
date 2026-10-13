/**
 * The retention behavior test arranges one old referenced lot with a closing
 * receipt. These current-source cached worlds genuinely ran 100/500/1,000
 * years. Across two seeds they must contain the same isAClosedReferencedLot
 * precondition; its behavior is tested separately without replaying centuries.
 * The contract then passes an actual selected lot into that identical scenario.
 */
import { expect, it } from 'vitest';
import { sampledWorld } from '../../support/sampled-world.js';
import { isAClosedReferencedLot } from '../../support/auction-precondition.js';
import { aClosedLotSurvivesCleanup } from '../../support/auction-scenario.js';

it('finds actual old closed referenced lots in sampled lived worlds', async () => {
    for (const [seed, years] of [['drift-guard', 500], ['drift-guard', 1000], ['demography', 100]] as const) {
        const world = await sampledWorld(seed, { years });
        expect(world.history.facts.some(fact => fact.data.auctionLot === true && isAClosedReferencedLot(world, fact.id)),
            `${seed} at ${years} years`).toBe(true);
    }
}, 3_600_000);

it('passes a real closed referenced lot into the same cleanup scenario', async () => {
    const world = await sampledWorld('drift-guard', { years: 500 });
    const lot = world.history.facts.find(fact => fact.data.auctionLot === true && isAClosedReferencedLot(world, fact.id));
    expect(lot).toBeDefined();
    aClosedLotSurvivesCleanup(world, lot!.id);
}, 120_000);
