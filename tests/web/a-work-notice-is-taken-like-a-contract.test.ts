/**
 * Hired work a house puts up on a town's wall is taken like a contract: by anybody, by its handle,
 * paid on completion, and buying no place on a roll.
 *
 * Played blind: the disciple on the Azure Dew gate named the house's hired work ("paying for hands
 * to gather herbs, ore, and beast parts"), and no verb could take it.
 */
import { describe, expect, it } from 'vitest';

import { REGIONS } from '../../src/data/cultivation/regions';
import { sectBoardFor } from '../../src/web/encounters';
import { theNoticeBehind } from '../../src/engine/encounters/a-work-notice-taken-off-a-wall';
import { makeGameInWorld } from './harness';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';

async function aStrangerAtAWallWithHiredWork(seed: string) {
    const { game, repos, db } = await makeGameInWorld({ seed, worldSeed: 'a-xianxia-run' });
    const { cultivator } = await game.newRun('Ke Yan');
    const deps = () => ({ repos, knowledge: game.knowledge, world: game.atHand });
    for (const place of REGIONS.flatMap(region => region.places)) {
        repos.cultivators.update(cultivator.id, { location: place.name });
        const offered = sectBoardFor(deps(), repos.cultivators.getById(cultivator.id)!).offers
            .find(offer => theNoticeBehind(offer.entry.id) !== null);
        if (offered) return { game, repos, db, id: cultivator.id, deps, place: place.name, offered };
    }
    throw new Error('no wall in this world carries a house\'s hired work');
}

describe('a work notice is taken like a contract', () => {
    it('is on a town wall as its task, pays stones and no contribution', async () => {
        const at = await aStrangerAtAWallWithHiredWork('notice-on-the-wall');
        const behind = theNoticeBehind(at.offered.entry.id)!;
        expect(at.offered.entry.name).toMatch(new RegExp(`${behind.reason.said}.* for the next `));
        expect(at.offered.terms.contribution).toBe(0);
        expect(at.offered.terms.stones).toBeGreaterThan(0);
        expect(at.offered.terms.days).toBe(behind.reason.days);
    }, 240_000);

    it('is taken off the wall by its handle', async () => {
        const at = await aStrangerAtAWallWithHiredWork('notice-taken');
        const said = theNoticeBehind(at.offered.entry.id)!.reason.said;
        const took = await at.game.act(`I take the ${said}`);
        expect(took.narration).not.toMatch(/is not on the board|nothing by that name/i);
        const day = at.repos.runs.getActiveRun(at.id)!.elapsedDays;
        expect(day).toBeGreaterThan(0);
        // The notice's own line, and not some other line that shares a word with it.
        expect(ledgerAbout(at.db as never, at.id).some(row => row.tags.includes(at.offered.entry.id))).toBe(true);
    }, 240_000);

    it('is never on a house\'s own board, which is inside its walls', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'notice-not-inside', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const world = game.atHand!;
        const house = world.factions.find(row => row.dissolvedOnDay === null && row.seatLocationId)!;
        const seat = world.locations.find(row => row.id === house.seatLocationId)!;
        repos.sects.addMember(house.id, cultivator.id, 0);
        repos.cultivators.update(cultivator.id, { sectId: house.id, location: seat.name });
        const board = sectBoardFor({ repos, knowledge: game.knowledge, world }, repos.cultivators.getById(cultivator.id)!);
        expect(board.offers.filter(offer => theNoticeBehind(offer.entry.id) !== null)).toEqual([]);
    }, 240_000);
});
