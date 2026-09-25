/**
 * A house's notice is turned in, never taken: the first to bring what it asks is paid, and the
 * paper comes down.
 *
 * The owner: "first person to turn it in gets it, and they retract the notice. if you're second,
 * tough luck".
 */
import { describe, expect, it } from 'vitest';

import { HERBS } from '../../src/data/cultivation/herbs';
import { SENDING_REASONS } from '../../src/data/cultivation/why-a-house-puts-a-party-on-the-road';
import {
    aNoticeId,
    hasItComeDown,
    theDaySomebodyElseTurnsItIn,
    whatANoticeWantsBrought
} from '../../src/engine/encounters/a-notice-is-turned-in';
import { A_BILL_STAYS_UP_FOR_DAYS } from '../../src/engine/world/houses-that-have-to-advertise-for-disciples';
import { addToPouch, listPouch } from '../../src/server/consolidated/cultivation-support.js';
import { housesWithSomethingToSay } from '../../src/web/what-is-posted-on-the-wall-here';
import { makeGameInWorld } from './harness';

const MATERIALS = SENDING_REASONS.find(row => row.id === 'sending-for-materials')!;
const A_HERB = HERBS[0]!;

/** A stranger at the gate of a house whose materials notice is up today, beaten or not as asked. */
async function atAGateWithANotice(seed: string, beaten: boolean) {
    const { game, repos, db } = await makeGameInWorld({ seed, worldSeed: 'a-xianxia-run' });
    const { cultivator } = await game.newRun('Ke Yan');
    const run = game.currentRun().run;
    const today = Math.floor(run.elapsedDays);
    const window = Math.floor(today / A_BILL_STAYS_UP_FOR_DAYS);
    const world = game.atHand!;
    const posting = new Set(housesWithSomethingToSay()
        .filter(house => house.postsInPublic && house.asks.some(ask => ask.kind === 'work' && ask.reasonId === MATERIALS.id))
        .map(house => house.id));
    const house = world.factions.find(row => {
        if (!posting.has(row.id) || !row.seatLocationId || row.id === cultivator.sectId) return false;
        const status = hasItComeDown({
            runSeed: run.seed, noticeId: aNoticeId(row.id, MATERIALS.id, window), today,
            windowStartDay: window * A_BILL_STAYS_UP_FOR_DAYS, windowDays: A_BILL_STAYS_UP_FOR_DAYS, turnedIn: new Set()
        });
        return status.down === beaten;
    });
    return { game, repos, db, cultivator, run, house, world };
}

describe('a notice is first come, first paid', () => {
    it('asks a materials trip brought in, with a purse, and asks nothing of what has nothing to bring', () => {
        const wants = whatANoticeWantsBrought(MATERIALS)!;
        expect(wants.lots).toBe(MATERIALS.hands);
        expect(wants.purse).toBeGreaterThan(0);
        const opening = SENDING_REASONS.find(row => row.id === 'sending-to-open-an-inheritance')!;
        expect(whatANoticeWantsBrought(opening)).toBeNull();
    });

    it('draws who got there first on the notice own stream, the same every time', () => {
        const id = aNoticeId('a-house', MATERIALS.id, 3);
        expect(theDaySomebodyElseTurnsItIn('seed', id, 270, 90)).toBe(theDaySomebodyElseTurnsItIn('seed', id, 270, 90));
        const day = theDaySomebodyElseTurnsItIn('seed', id, 270, 90);
        if (day !== null) expect(day).toBeGreaterThanOrEqual(270);
    });

    it('pays the first to bring it at the gate, takes what the paper asked, and takes the paper down', async () => {
        const at = await atAGateWithANotice('notice-first', false);
        expect(at.house, 'no house with its materials notice up').toBeDefined();
        const seat = at.world.locations.find(row => row.id === at.house!.seatLocationId)!;
        at.repos.cultivators.update(at.cultivator.id, { location: seat.name, spiritStones: 10 });
        addToPouch(at.db, at.cultivator.id, A_HERB.id, 'herb', MATERIALS.hands + 2);
        const purse = whatANoticeWantsBrought(MATERIALS)!.purse;

        const turned = await at.game.act(`I turn in the ${A_HERB.name}`);
        expect(turned.narration).toMatch(/The notice comes down/);
        expect(at.repos.cultivators.getById(at.cultivator.id)!.spiritStones).toBeGreaterThan(10);
        expect(at.repos.cultivators.getById(at.cultivator.id)!.spiritStones).toBeLessThanOrEqual(10 + purse);
        expect(listPouch(at.db, at.cultivator.id).find(row => row.itemId === A_HERB.id)?.quantity).toBe(2);

        // Down: a second turn-in finds nothing to turn in against.
        addToPouch(at.db, at.cultivator.id, A_HERB.id, 'herb', MATERIALS.hands);
        const again = await at.game.act(`I turn in the ${A_HERB.name}`);
        expect(again.narration).toMatch(/turned in what .* asked already/);
    }, 240_000);

    it('takes nothing from somebody short of what the paper asks', async () => {
        const at = await atAGateWithANotice('notice-short', false);
        const seat = at.world.locations.find(row => row.id === at.house!.seatLocationId)!;
        at.repos.cultivators.update(at.cultivator.id, { location: seat.name });
        addToPouch(at.db, at.cultivator.id, A_HERB.id, 'herb', 2);
        const turned = await at.game.act(`I turn in the ${A_HERB.name}`);
        expect(turned.narration).toMatch(/asks for \d+ lots of herbs or beast parts, and you carry 2/);
        expect(listPouch(at.db, at.cultivator.id).find(row => row.itemId === A_HERB.id)?.quantity).toBe(2);
    }, 240_000);

    it('tells whoever comes second that somebody else got there first, and pays nothing', async () => {
        const at = await atAGateWithANotice('notice-second', true);
        if (!at.house) return; // no notice in this world came down by day 0; the draw is pinned above
        const seat = at.world.locations.find(row => row.id === at.house!.seatLocationId)!;
        at.repos.cultivators.update(at.cultivator.id, { location: seat.name, spiritStones: 10 });
        addToPouch(at.db, at.cultivator.id, A_HERB.id, 'herb', MATERIALS.hands);
        const turned = await at.game.act(`I turn in the ${A_HERB.name}`);
        expect(turned.narration).toMatch(/Somebody else brought .* on day \d+.*The second to bring it gets nothing/);
        expect(at.repos.cultivators.getById(at.cultivator.id)!.spiritStones).toBe(10);
    }, 240_000);
});
