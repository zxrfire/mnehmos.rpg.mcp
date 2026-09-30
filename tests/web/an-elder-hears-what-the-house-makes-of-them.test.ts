/**
 * An elder asking where they stand hears whether the house still expects them to
 * climb, and how many of its other elders are done climbing and over no office.
 *
 * `whatTheHouseMakesOfThem` and `officePressureIn` were written, tested and read
 * by nothing: the standing read of a player at an elder's rung said the title,
 * the contribution and the next rung, and never what the house made of them.
 *
 * Asserted on the rule, not the wording: the same elder reads as still climbing
 * fresh at their rung and as done once past what the rung credits, and nobody
 * below the elder line hears either.
 */

import { makeGameInWorld } from './harness';
import { getSect } from '../../src/data/cultivation/sects';
import { elderRungOf } from '../../src/engine/cultivation/leadership';
import { stagnationYearsForOrdinal } from '../../src/schema/cultivation';

const HOUSE = 'sect-azure-dew-sect';

/** A member at this rung, `spent` times what their own rung credits into it. */
async function aMemberAt(rankIndex: number, spent: number) {
    const h = await makeGameInWorld({ seed: 'elder-standing', worldSeed: 'elder-standing' });
    const { cultivator } = await h.game.newRun('Elder');
    h.game.repos.sects.addMember(HOUSE, cultivator.id, rankIndex);
    h.game.repos.cultivators.applyDeltas(cultivator.id, {
        yearsAtCurrentRealm: stagnationYearsForOrdinal(cultivator.realmOrdinal) * spent
    });
    return (await h.game.act('what is my standing')).narration;
}

describe('an elder hears what the house makes of them', () => {
    const ranks = getSect(HOUSE)!.ranks;
    const elder = elderRungOf(ranks.length);

    it('is still expected to climb when fresh at the rung', async () => {
        const said = await aMemberAt(elder, 0);
        expect(said).toMatch(/still expects you to climb/i);
    }, 120_000);

    it('is done climbing once past what the rung credits', async () => {
        const said = await aMemberAt(elder, 2);
        expect(said).toMatch(/no longer expects you to climb/i);
    }, 120_000);

    it('says nothing of it below the elder line', async () => {
        const said = await aMemberAt(0, 0);
        expect(said).not.toMatch(/expects you to climb/i);
    }, 120_000);
});
