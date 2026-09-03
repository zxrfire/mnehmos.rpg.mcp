/**
 * A standing read for somebody with no house names the route out of that.
 *
 * It is the answer a player gets when what they asked was whether anybody would
 * take them, so stating the absence and stopping is a dead end at the one rung
 * where the whole question is how to leave it.
 *
 * The route has to be a phrasing the player can type and a wall that is really
 * there: houses short of people advertise, with a bar and a date on the paper.
 */

import { makeGameInWorld } from './harness';

describe('being nobody, and being told what to do about it', () => {
    it('names the wall and a way to read it', async () => {
        const h = await makeGameInWorld({ seed: 'route', worldSeed: 'world-route-1' });
        await h.game.newRun('Nobody');

        const said = (await h.game.act('what is my standing')).narration;

        expect(said).toMatch(/Unaffiliated/);
        expect(said, 'the route out is named').toMatch(/what is posted here/i);
        expect(said, 'and what would be on it').toMatch(/bar and a date|intake/i);
    }, 60_000);

    /** And the route it names reaches something, or it is worse than silence. */
    it('and the phrasing it names actually reads the wall', async () => {
        const h = await makeGameInWorld({ seed: 'route', worldSeed: 'world-route-1' });
        await h.game.newRun('Nobody');

        const before = h.game.state();
        const read = await h.game.act('what is posted here');
        const after = h.game.state();

        expect(read.narration.length).toBeGreaterThan(40);
        expect(after.run.elapsedDays, 'reading the wall costs nothing, as the note says')
            .toBe(before.run.elapsedDays);
    }, 60_000);

    /**
     * A member's standing read is untouched: it has no way out to name, because
     * they are not looking for one.
     */
    it('says nothing about intakes to somebody already on a roll', async () => {
        const h = await makeGameInWorld({ seed: 'route', worldSeed: 'world-route-1' });
        const { cultivator } = await h.game.newRun('Member');
        h.game.repos.sects.addMember('sect-azure-dew-sect', cultivator.id, 0);

        const said = (await h.game.act('what is my standing')).narration;

        expect(said).not.toMatch(/what is posted here/i);
    }, 60_000);
});
