/**
 * A house's notice is turned in, never taken: the first to bring what it asks is paid, and the
 * paper comes down. One notice names one thing and how many, and pays what its tier pays.
 *
 * The owner: "first person to turn it in gets it, and they retract the notice. if you're second,
 * tough luck", and "a notice is per herb and for a speciifc count, if they want a second herb its
 * a new notice. each notice is of a diff grade with a diff reward (fixed, but fixed per tier)".
 *
 * Demonic houses work human bone. These cases keep that ask on the existing notice path: the
 * alignment field adds bone at a usable grade, while the paper, payment and retraction stay the
 * same facts as every other material notice.
 */
import { describe, expect, it } from 'vitest';

import { SENDING_REASONS } from '../../src/data/cultivation/why-a-house-puts-a-party-on-the-road';
import { getSect } from '../../src/data/cultivation/sects';
import {
    A_NOTICE_OF_EACH_TIER,
    aNoticeId,
    hasItComeDown,
    theDaySomebodyElseTurnsItIn,
    whatAHouseWantsBrought
} from '../../src/engine/encounters/a-notice-is-turned-in';
import { A_BILL_STAYS_UP_FOR_DAYS } from '../../src/engine/world/houses-that-have-to-advertise-for-disciples';
import { addToPouch, listPouch } from '../../src/server/consolidated/cultivation-support.js';
import { housesWithSomethingToSay } from '../../src/web/what-is-posted-on-the-wall-here';
import { noticesOnTheWall } from '../../src/engine/world/houses-that-have-to-advertise-for-disciples';
import { makeGameInWorld } from './harness';

/**
 * A stranger at the gate of a house with a notice up today that somebody else has, or has not,
 * already turned in: the house, and the notice.
 */
async function atAGateWithANotice(seed: string, beaten: boolean) {
    const { game, repos, db } = await makeGameInWorld({ seed, worldSeed: 'a-xianxia-run' });
    const { cultivator } = await game.newRun('Ke Yan');
    const run = game.currentRun().run;
    const today = Math.floor(run.elapsedDays);
    const window = Math.floor(today / A_BILL_STAYS_UP_FOR_DAYS);
    const world = game.atHand!;
    for (const speaking of housesWithSomethingToSay(new Map(), today)) {
        const seated = world.factions.find(row => row.id === speaking.id && row.seatLocationId && row.id !== cultivator.sectId);
        if (!seated || !speaking.postsInPublic) continue;
        for (const ask of speaking.asks) {
            if (ask.kind !== 'work' || !ask.item) continue;
            const status = hasItComeDown({
                runSeed: run.seed, noticeId: aNoticeId(speaking.id, ask.item.id, window), today,
                windowStartDay: window * A_BILL_STAYS_UP_FOR_DAYS, windowDays: A_BILL_STAYS_UP_FOR_DAYS, turnedIn: new Set()
            });
            if (status.down !== beaten) continue;
            const seat = world.locations.find(row => row.id === seated.seatLocationId)!;
            repos.cultivators.update(cultivator.id, { location: seat.name, spiritStones: 10 });
            return { game, repos, db, id: cultivator.id, house: speaking, item: ask.item };
        }
    }
    return null;
}

/** A live demonic gate whose current paper includes a bone notice nobody else has claimed. */
async function atADemonicGateWithABoneNotice(seed: string) {
    const { game, repos, db } = await makeGameInWorld({ seed, worldSeed: 'a-xianxia-run' });
    const { cultivator } = await game.newRun('Ke Yan');
    const run = game.currentRun().run;
    const today = Math.floor(run.elapsedDays);
    const window = Math.floor(today / A_BILL_STAYS_UP_FOR_DAYS);
    const world = game.atHand!;
    for (const speaking of housesWithSomethingToSay(new Map(), today)) {
        if (getSect(speaking.id)?.alignment !== 'demonic') continue;
        const seated = world.factions.find(row => row.id === speaking.id && row.seatLocationId);
        const item = speaking.asks.flatMap(ask => ask.kind === 'work' && ask.item?.id.startsWith('material-bone-')
            ? [ask.item] : [])[0];
        if (!seated || !item) continue;
        const status = hasItComeDown({
            runSeed: run.seed, noticeId: aNoticeId(speaking.id, item.id, window), today,
            windowStartDay: window * A_BILL_STAYS_UP_FOR_DAYS, windowDays: A_BILL_STAYS_UP_FOR_DAYS, turnedIn: new Set()
        });
        if (status.down) continue;
        const seat = world.locations.find(row => row.id === seated.seatLocationId)!;
        seated.resources.spirit_stones = item.purse;
        game.theWorldMoved();
        repos.cultivators.update(cultivator.id, { location: seat.name, spiritStones: 10 });
        return { game, repos, db, id: cultivator.id, house: speaking, item };
    }
    return null;
}

describe('a notice is first come, first paid', () => {
    it('names one thing and how many, fixed per tier, and never the opening party', () => {
        const asks = whatAHouseWantsBrought({ id: 'a-house', powerOrdinal: 30, specialities: ['alchemy'] }, 0);
        expect(asks.length).toBeGreaterThan(0);
        for (const ask of asks) {
            expect(ask).toMatchObject(A_NOTICE_OF_EACH_TIER[ask.grade]);
        }
        // Two notices never ask the same tier: a second thing is a second notice.
        expect(new Set(asks.map(ask => ask.grade)).size).toBe(asks.length);
        const opening = SENDING_REASONS.find(row => row.id === 'sending-to-open-an-inheritance')!;
        expect(housesWithSomethingToSay().flatMap(house => house.asks)
            .some(ask => ask.kind === 'work' && ask.what === opening.what)).toBe(false);
    });

    it('puts a demonic house\'s bone notice on a wall', () => {
        const demonic = housesWithSomethingToSay().find(house => getSect(house.id)?.alignment === 'demonic')!;
        const boneAsks = demonic.asks.filter(ask => ask.kind === 'work' && ask.item?.id.startsWith('material-bone-'));
        const reading = noticesOnTheWall({
            field: [], placeName: 'A City', ground: 'city', placeProvinceId: null, onDay: 0, seed: 'bone-paper',
            speaking: [{
                ...demonic, asks: boneAsks
            }]
        });
        expect(boneAsks.length).toBeGreaterThan(0);
        expect(reading.some(notice => notice.item?.id.startsWith('material-bone-'))).toBe(true);
    });

    it('never gives righteous or neutral houses a bone notice', () => {
        for (const alignment of ['righteous', 'neutral'] as const) {
            const house = housesWithSomethingToSay().find(row => getSect(row.id)?.alignment === alignment)!;
            expect(house.asks.some(ask => ask.kind === 'work' && ask.item?.id.startsWith('material-bone-'))).toBe(false);
        }
    });

    it('pays the fixed tier purse for enough bone and takes that notice down', async () => {
        const at = await atADemonicGateWithABoneNotice('bone-notice-paid');
        expect(at, 'no demonic house with an open bone notice').not.toBeNull();
        addToPouch(at!.db, at!.id, at!.item.id, 'herb', at!.item.count);

        const before = at!.repos.cultivators.getById(at!.id)!.spiritStones;
        const turned = await at!.game.act(`I turn in the ${at!.item.name}`);
        expect(turned.narration).toContain('The notice comes down.');
        expect(at!.repos.cultivators.getById(at!.id)!.spiritStones).toBe(before + at!.item.purse);
        expect(listPouch(at!.db, at!.id).find(row => row.itemId === at!.item.id)).toBeUndefined();

        const again = await at!.game.act(`I turn in the ${at!.item.name}`);
        expect(again.narration).not.toContain('The notice comes down.');
    }, 240_000);

    it('refuses a bone at the wrong grade and leaves it in the pouch', async () => {
        const at = await atADemonicGateWithABoneNotice('bone-notice-wrong-grade');
        expect(at, 'no demonic house with an open bone notice').not.toBeNull();
        const wrong = at!.item.grade === 'mortal' ? 'material-bone-earth' : 'material-bone-mortal';
        addToPouch(at!.db, at!.id, wrong, 'herb', at!.item.count);

        const turned = await at!.game.act(`I turn in the ${at!.item.name}`);
        expect(turned.narration).toContain(`asks for ${at!.item.count} ${at!.item.name}, and you carry 0`);
        expect(listPouch(at!.db, at!.id).find(row => row.itemId === wrong)?.quantity).toBe(at!.item.count);
    }, 240_000);

    it('draws who got there first on the notice own stream, the same every time', () => {
        const id = aNoticeId('a-house', 'an-item', 3);
        expect(theDaySomebodyElseTurnsItIn('seed', id, 270, 90)).toBe(theDaySomebodyElseTurnsItIn('seed', id, 270, 90));
        const day = theDaySomebodyElseTurnsItIn('seed', id, 270, 90);
        if (day !== null) expect(day).toBeGreaterThanOrEqual(270);
    });

    it('pays the first to bring it at the gate, takes exactly what the paper asked, and takes it down', async () => {
        const at = await atAGateWithANotice('notice-first', false);
        expect(at, 'no house with a notice up').not.toBeNull();
        addToPouch(at!.db, at!.id, at!.item.id, 'herb', at!.item.count + 2);

        const turned = await at!.game.act(`I turn in the ${at!.item.name}`);
        expect(turned.narration).toMatch(/The notice comes down/);
        const stones = at!.repos.cultivators.getById(at!.id)!.spiritStones;
        expect(stones).toBeGreaterThan(10);
        expect(stones).toBeLessThanOrEqual(10 + at!.item.purse);
        expect(listPouch(at!.db, at!.id).find(row => row.itemId === at!.item.id)?.quantity).toBe(2);

        // Down: bringing the same again finds the notice gone.
        addToPouch(at!.db, at!.id, at!.item.id, 'herb', at!.item.count);
        const again = await at!.game.act(`I turn in the ${at!.item.name}`);
        expect(again.narration).not.toMatch(/The notice comes down/);
    }, 240_000);

    it('takes nothing from somebody short of what the paper asks', async () => {
        const at = await atAGateWithANotice('notice-short', false);
        addToPouch(at!.db, at!.id, at!.item.id, 'herb', 1);
        const turned = await at!.game.act(`I turn in the ${at!.item.name}`);
        expect(turned.narration).toMatch(new RegExp(`asks for ${at!.item.count} ${at!.item.name}, and you carry 1`));
        expect(listPouch(at!.db, at!.id).find(row => row.itemId === at!.item.id)?.quantity).toBe(1);
    }, 240_000);

    it('tells whoever comes second that somebody else got there first, and pays nothing', async () => {
        // The last day of the first window, and a house every one of whose notices somebody else
        // has turned in by then.
        const { game, repos, db } = await makeGameInWorld({ seed: 'notice-second', worldSeed: 'a-xianxia-run' });
        const { cultivator } = await game.newRun('Ke Yan');
        const run = game.currentRun().run;
        repos.runs.advanceDays(run.id, A_BILL_STAYS_UP_FOR_DAYS - 1);
        const today = A_BILL_STAYS_UP_FOR_DAYS - 1;
        const world = game.atHand!;
        const beaten = housesWithSomethingToSay(new Map(), today).find(house => {
            const items = house.asks.flatMap(ask => ask.kind === 'work' && ask.item ? [ask.item] : []);
            return house.postsInPublic && items.length > 0
                && world.factions.some(row => row.id === house.id && row.seatLocationId && row.id !== cultivator.sectId)
                && items.every(item => hasItComeDown({
                    runSeed: run.seed, noticeId: aNoticeId(house.id, item.id, 0), today,
                    windowStartDay: 0, windowDays: A_BILL_STAYS_UP_FOR_DAYS, turnedIn: new Set()
                }).byWhom === 'somebody else');
        });
        expect(beaten, 'no house had every notice turned in by somebody else').toBeDefined();
        const item = beaten!.asks.flatMap(ask => ask.kind === 'work' && ask.item ? [ask.item] : [])[0]!;
        const seat = world.locations.find(row => row.id === world.factions.find(f => f.id === beaten!.id)!.seatLocationId)!;
        repos.cultivators.update(cultivator.id, { location: seat.name, spiritStones: 10 });
        addToPouch(db, cultivator.id, item.id, 'herb', item.count);

        const turned = await game.act(`I turn in the ${item.name}`);
        expect(turned.narration).toMatch(/Somebody else brought .* on day \d+.*The second to bring it gets nothing/s);
        expect(repos.cultivators.getById(cultivator.id)!.spiritStones).toBe(10);
        expect(listPouch(db, cultivator.id).find(row => row.itemId === item.id)?.quantity).toBe(item.count);
    }, 240_000);
});
