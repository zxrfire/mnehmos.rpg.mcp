/**
 * 2026-10-03 recovered spatial audit: the web auction adapter read every city
 * lot from a street or private inn room and synchronized a bidder's world
 * purse before refusing. Public dates are information; inspecting finite stock
 * and bidding require the actual auction-house scene. These boundary controls
 * arrange a real factory object and an ordinary lot fact, using existing people,
 * then check observations and state. The existing capital-events played test
 * owns closing/payment/provenance. A remote presence is a real scene actor;
 * checking its auction area must not walk the physical body into another city.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { attendACapitalAuction } from '../../src/web/attending-a-capital-auction';
import { capitalPlaces } from '../../src/engine/world/capital-missions-and-calendar';
import { theAreasOf, aRoomOfTheirOwn } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { makeObject } from '../../src/engine/world/possessions';
import { makeFact } from '../../src/engine/world/history';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened';
import { sendAProxy } from '../../src/engine/world/something-acting-in-your-place';
import { setRealm } from '../../src/engine/world/npc-state';
import { NASCENT_SOUL_ORDINAL } from '../../src/engine/cultivation/existence';
import { writeFlag } from '../../src/server/consolidated/cultivation-support';

async function opened() {
    const h = await makeGameInWorld({ seed: 'auction-boundary', worldSeed: 'capital-play' });
    const { cultivator } = await h.game.newRun('Visitor');
    const world = h.game.atHand!;
    const city = capitalPlaces(world)[0]!;
    const seller = world.npcs.find(n => n.status === 'alive' && n.id !== cultivator.id)!;
    const object = makeObject({ id: 'boundary-lot', name: 'Boundary Cargo', kind: 'material',
        ownerId: seller.id, ownerName: seller.name, possessorId: seller.id, locationId: city.id });
    world.objects.push(object);
    appendWorldFact(world, makeFact({ day: world.currentDay, kind: 'gathering', summary: 'Boundary Cargo offered.',
        locationId: city.id, data: { auctionLot: true, objectId: object.id, sellerId: seller.id,
            payeeId: seller.id, reserve: 100, closesOnDay: world.currentDay + 3 } }));
    h.repos.cultivators.update(cultivator.id, { location: city.name, spiritStones: 1000 });
    const auction = theAreasOf(world, city).areas.find(a => a.name === 'the auction house')!;
    // Make a premature mirror sync observable even when the sheet differs.
    world.npcs.find(n => n.id === cultivator.id)!.spiritStones = 17;
    h.game.theWorldMoved();
    return { ...h, world, run: h.game.currentRun().run, cultivator, city, object, auction };
}

describe('auction stock is local to its house', () => {
    it.each(['street', 'private inn room'] as const)('refuses lots and bids from the %s without changing money or stock', async area => {
        const h = await opened();
        if (area === 'private inn room') {
            writeFlag(h.db, h.cultivator.id, 'lodged_at', JSON.stringify({ place: h.city.name, paidThroughDay: 3 }));
            h.repos.cultivators.standIn(h.cultivator.id, aRoomOfTheirOwn(h.city, h.cultivator.id).id);
        }
        const me = h.repos.cultivators.getById(h.cultivator.id)!;
        const before = JSON.stringify({ objects: h.world.objects, facts: h.world.history.facts,
            purses: h.world.npcs.map(n => [n.id, n.spiritStones]) });
        for (const said of ['I look at the auction lots', 'I bid 900 spirit stones on Boundary Cargo', 'I attend the auction']) {
            const done = await attendACapitalAuction(h.game, h.run, me, { action: 'market', intent: 'auction' }, said);
            expect(done!.outcome).toBe('refused');
            expect(done!.facts.lines.join(' ')).toContain(h.auction.name);
            expect(done!.facts.lines.join(' ')).not.toContain(h.object.name);
            expect(JSON.stringify({ objects: h.world.objects, facts: h.world.history.facts,
                purses: h.world.npcs.map(n => [n.id, n.spiritStones]) })).toBe(before);
            expect(h.repos.cultivators.getById(me.id)!.standingIn).toBe(me.standingIn);
            expect(h.repos.cultivators.getById(me.id)!.spiritStones).toBe(me.spiritStones);
        }
    });

    it('reads public calendar dates at the city without revealing a lot or spending/moving', async () => {
        const h = await opened();
        const me = h.repos.cultivators.getById(h.cultivator.id)!;
        const before = h.repos.runs.getById(h.run.id)!;
        const done = await attendACapitalAuction(h.game, h.run, me, { action: 'market', intent: 'auction' }, 'When is the auction scheduled?');
        expect(done!.outcome).toBe('executed');
        expect(done!.timeDisposition).toBe('free_read');
        expect(done!.facts.lines.join(' ')).toMatch(/day|scheduled/);
        expect(done!.facts.lines.join(' ')).not.toContain(h.object.name);
        expect(done!.facts.lines.join(' ')).not.toMatch(/Lot \d/);
        expect(h.repos.runs.getById(h.run.id)!.elapsedDays).toBe(before.elapsedDays);
        expect(h.repos.cultivators.getById(me.id)!.standingIn).toBe(me.standingIn);
        expect(h.world.npcs.find(n => n.id === me.id)!.spiritStones).toBe(17);
    });

    it('uses a real remote auction-house actor and leaves its physical body where it was', async () => {
        const h = await opened();
        const mirror = h.world.npcs.find(n => n.id === h.cultivator.id)!;
        Object.assign(mirror, setRealm(mirror, NASCENT_SOUL_ORDINAL, h.world.currentDay));
        const physical = h.world.locations.find(p => p.id !== h.city.id)!;
        h.repos.cultivators.update(h.cultivator.id, { location: physical.name });
        mirror.locationId = physical.id;
        const proxy = sendAProxy(h.world, mirror, 'soul', h.city.id).proxy!;
        expect(proxy).toBeTruthy();
        proxy.data.standingIn = h.auction.id;
        h.game.theWorldMoved();
        const body = h.repos.cultivators.getById(h.cultivator.id)!;
        const listed = await attendACapitalAuction(h.game, h.run, body, { action: 'market', intent: 'auction' }, 'I look at the auction lots');
        expect(listed!.outcome).toBe('executed');
        expect(listed!.facts.lines.join(' ')).toContain(h.object.name);
        expect(h.repos.cultivators.getById(body.id)!.location).toBe(physical.name);
        expect(h.repos.cultivators.getById(body.id)!.standingIn).toBe(body.standingIn);
        expect(proxy.data.standingIn).toBe(h.auction.id);
    });
});
