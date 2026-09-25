/**
 * A mission above the outer rung is a post: taken at the board, held where it is, and served when
 * its day passes. Leaving early ends it cleanly where the house would welcome the change - the
 * owner's case is a full realm risen - and otherwise costs face.
 *
 * Arranged: a place on the roll, the realm, where they stand, and the days passing (the run's
 * clock moved forward, which is what any span of living there does). Played: the taking, the
 * sheet, the leaving and the settling.
 */

import { describe, expect, it } from 'vitest';
import { theFirstRungOf } from '../../src/engine/encounters/what-a-house-has-on-its-board';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { faceOf } from '../../src/engine/world/what-a-face-is-worth';
import { REGIONS, HOME_REGION_ID } from '../../src/data/cultivation/regions';
import { clearPendingSummons, readPendingSummons } from '../../src/web/pending-summons';
import { theDaysAPostsMeritCounts } from '../../src/engine/encounters/duties';
import { makeGameInWorld } from './harness';

const A_HOUSE = 'sect-azure-cloud-pavilion';
const A_MARKET_TOWN = REGIONS.find(region => region.id === HOME_REGION_ID)!
    .places.find(place => place.kind === 'market_town')!.name;

async function onPost(seed: string) {
    const { game, repos, db } = await makeGameInWorld({ seed, worldSeed: 'a-xianxia-run' });
    const { cultivator, run } = await game.newRun('Ke Yan');
    const world = (await game.loadWorld())!;
    const seat = world.locations.find(l => l.id === world.factions.find(f => f.id === A_HOUSE)!.seatLocationId)!;
    const ladder = repos.sects.getById(A_HOUSE)!.ranks;
    db.prepare('UPDATE cultivators SET realm_ordinal = 8 WHERE id = ?').run(cultivator.id);
    repos.sects.addMember(A_HOUSE, cultivator.id, theFirstRungOf('inner', ladder.length)!);
    repos.cultivators.update(cultivator.id, { location: seat.name });
    repos.cultivators.standIn(cultivator.id, theAreasOf(world, seat).areas.find(a => a.for === 'board')!.id);

    const took = (await game.act('I take the pass watch')).narration ?? '';
    const face = () => faceOf(game.atHand!.npcs.find(n => n.id === cultivator.id) ?? { face: 0 });
    return {
        game, repos, db, took, face,
        id: cultivator.id,
        // ARRANGED: whatever the house has sent for them about since is off the table, so the
        // leave is judged on the change the test is about. A summons waiting is its own case.
        nothingSentFor: () => clearPendingSummons(repos, cultivator.id),
        sentFor: () => readPendingSummons(repos, cultivator.id),
        days: () => game.state().run.elapsedDays,
        passTo: (day: number) => db.prepare('UPDATE runs SET elapsed_days = ? WHERE id = ?').run(day, run.id),
        sheet: async () => (await game.act('what is my status')).narration ?? ''
    };
}

describe('a post held until its day', () => {
    it('is taken without the years passing, stated on the sheet, and paid when its day passes', async () => {
        const at = await onPost('post-served');
        expect(at.took).toContain('You take up the post: Keep the pass watch below');
        expect(at.took).toMatch(/It runs to day \d+\./);
        expect(at.days(), 'the years were spent in one act').toBe(0);
        expect(await at.sheet()).toMatch(/On post: keep the pass watch below .+ until day \d+\./);

        const due = Number(/It runs to day (\d+)/.exec(at.took)![1]);
        const merit = at.repos.sects.getMembership(at.id)!.contribution;
        const stones = at.repos.cultivators.getById(at.id)!.spiritStones;
        at.passTo(due);
        const served = (await at.game.act('I look around')).narration ?? '';
        expect(served).toContain(`Your post is served, to day ${due}`);
        expect(at.repos.sects.getMembership(at.id)!.contribution).toBeGreaterThan(merit);
        expect(at.repos.cultivators.getById(at.id)!.spiritStones).toBeGreaterThan(stones);
        expect(await at.sheet()).not.toMatch(/On post:/);
    }, 240_000);

    it('costs face to leave early with nothing changed, and says how much was left', async () => {
        const at = await onPost('post-abandoned');
        const before = at.face();
        const merit = at.repos.sects.getMembership(at.id)!.contribution;
        const stones = at.repos.cultivators.getById(at.id)!.spiritStones;
        at.nothingSentFor();
        const left = (await at.game.act('I leave my post')).narration ?? '';
        expect(left).toMatch(/The house takes it as a post abandoned: \d+ days of the term were left\./);
        expect(at.face()).toBeLessThan(before);
        expect(at.repos.sects.getMembership(at.id)!.contribution, 'an abandoned post was paid').toBe(merit);
        expect(at.repos.cultivators.getById(at.id)!.spiritStones, 'an abandoned post was paid').toBe(stones);
        expect(await at.sheet()).not.toMatch(/On post:/);
    }, 240_000);

    it('costs face to walk away from it too', async () => {
        const at = await onPost('post-walked-off');
        const before = at.face();
        at.nothingSentFor();
        at.repos.cultivators.update(at.id, { location: A_MARKET_TOWN });
        const walked = (await at.game.act('I look around')).narration ?? '';
        expect(walked).toMatch(/The house takes it as a post abandoned/);
        expect(at.face()).toBeLessThan(before);
    }, 240_000);

    it('ends cleanly after a full realm risen, costs nothing, and pays for the days served', async () => {
        const at = await onPost('post-outgrown');
        const due = Number(/It runs to day (\d+)/.exec(at.took)![1]);
        const [, termPay, termStones] = /counts (\d+) contribution and pays (\d+) spirit stones/.exec(at.took)!.map(Number);
        const merit = at.repos.sects.getMembership(at.id)!.contribution;
        const stones = at.repos.cultivators.getById(at.id)!.spiritStones;
        // A quarter of the term lived at the post, then the breakthrough.
        const served = Math.floor(due / 4);
        at.passTo(served);
        at.nothingSentFor();
        at.db.prepare('UPDATE cultivators SET realm_ordinal = 13 WHERE id = ?').run(at.id);
        const before = at.face();
        const left = (await at.game.act('I leave my post')).narration ?? '';
        expect(left).toContain('It ends cleanly');
        expect(left).toContain('Foundation Establishment');
        expect(left).toContain(`pays for the ${served} days served`);
        expect(at.face()).toBe(before);
        // Contribution on the post's own curve, the first year in full; stones at the full rate.
        expect(at.repos.sects.getMembership(at.id)!.contribution - merit)
            .toBe(Math.round(termPay! * theDaysAPostsMeritCounts(served) / theDaysAPostsMeritCounts(due)));
        expect(at.repos.cultivators.getById(at.id)!.spiritStones - stones).toBe(Math.round(termStones! * served / due));
    }, 240_000);

    it('ends cleanly when the house has sent for them since', async () => {
        const at = await onPost('post-sent-for');
        // Played: the house puts a posting to them after they took the post, and it is waiting.
        expect(at.sentFor(), 'the house sent for nobody in this world').not.toBeNull();
        const before = at.face();
        const left = (await at.game.act('I leave my post')).narration ?? '';
        expect(left).toContain('The house has sent for you');
        expect(left).toContain('It ends cleanly');
        expect(at.face()).toBe(before);
    }, 240_000);

    it('refuses a second post while one is held', async () => {
        const at = await onPost('post-twice');
        const again = (await at.game.act('I take the pass watch')).narration ?? '';
        expect(again).toContain('A second post is taken when that one is served or left.');
    }, 240_000);
});
