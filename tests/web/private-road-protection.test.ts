/**
 * Private escort work formerly wrote an out_with_a_party label without moving
 * its people. A paid guard now joins the actual sponsored itinerary and shared
 * party risk. These played controls require SQL movement and real matching
 * arrival receipts, preserve the cargo's real holder, and fail an abandoned word.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { createNpc } from '../../src/engine/world/npc-state';
import { makeLocation, linkLocations } from '../../src/engine/world/locations';
import { routineTime } from '../../src/engine/world/npc-routines';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { offerPrivateWork } from '../../src/engine/world/private-paid-work';
import { privateWorkBodiesFor, settlePrivateWorkAtTheBody } from '../../src/web/private-work-with-a-person';
import { followedParty } from '../../src/web/following-the-party-leader';
import { factsWithDataValue } from '../../src/engine/world/witness-reaction-index';
import { makeObject } from '../../src/engine/world/possessions';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';

async function prepared(cargo = false) {
    const h = await makeGameInWorld({ seed: 'actual-private-road-guard', worldSeed: 'actual-private-road-guard-world' });
    const { cultivator } = await h.game.newRun('Guard');
    const world = h.game.atHand!, day = routineTime(world);
    const from = makeLocation({ id: 'guard-departure', name: 'Guard Departure', kind: 'settlement' });
    const to = makeLocation({ id: 'guard-destination', name: 'Guard Destination', kind: 'settlement' });
    linkLocations(from, to, 'road', 1);
    world.locations.push(from, to);
    const relative = createNpc(world.seed, { id: 'the-protected-traveller', name: 'Zhang Wen', locationId: from.id,
        bornOnDay: day - 40 * 365, onDay: day, spiritStones: 50, cultivation: { realmOrdinal: 30 } });
    world.npcs.push(relative);
    h.game.repos.cultivators.update(cultivator.id, { location: from.name });
    h.game.repos.cultivators.standIn(cultivator.id, theAreasOf(world, from).whereIs.get(relative.id)!);
    if (cargo) world.objects.push(makeObject({ id: 'the-real-cargo', name: 'The traveller cargo', kind: 'artifact',
        ownerId: relative.id, possessorId: relative.id, ownerName: relative.name }));
    const offer = offerPrivateWork(world, relative.id, cultivator.id, {
        objective: { kind: 'escort', personId: relative.id, destinationId: to.id, days: 0.25,
            ...(cargo ? { cargoId: 'the-real-cargo' } : {}) }, payment: { kind: 'stones', amount: 7 },
        dueOnDay: day + 10, description: `Guard ${relative.name}${cargo ? ' and the actual cargo' : ''} on the road to ${to.name}.` },
        day, privateWorkBodiesFor(h.game));
    expect(offer).not.toBeNull();
    h.game.theWorldMoved();
    return { ...h, body: h.game.currentRun().cultivator, relative, from, to, offer: offer! };
}

async function collectAtTheActualPayer(h: Awaited<ReturnType<typeof prepared>>) {
    const area = theAreasOf(h.game.atHand!, h.to).whereIs.get(h.relative.id)!;
    h.game.repos.cultivators.standIn(h.body.id, area);
    await h.game.act('look around');
}

describe('private road protection uses the actual party', () => {
    it('moves the SQL guard with the relative and pays only on a real joint arrival', async () => {
        const h = await prepared(), before = h.body.spiritStones;
        await h.game.act('I accept the private paid work');
        const party = followedParty(h.db, h.game.atHand!, h.body.id);
        expect(party?.leader.id).toBe(h.relative.id);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
        const trip = await h.game.act('I wait 1 day');
        expect(h.game.state().cultivator.location, trip.narration).toBe(h.to.name);
        expect(factsWithDataValue(h.game.atHand!, 'privateWorkCompleted', h.offer.id).some(fact => fact.data.finished)).toBe(true);
        await collectAtTheActualPayer(h);
        expect(h.game.state().cultivator.spiritStones, trip.narration).toBe(before + 7);
        expect(factsWithDataValue(h.game.atHand!, 'bodyId', h.body.id).some(fact => fact.data.actualBodyArrival
            && fact.locationId === h.to.id)).toBe(true);
        expect(factsWithDataValue(h.game.atHand!, 'privateWorkPayment', h.offer.id).some(fact => fact.data.paid)).toBe(true);
    }, 120000);
    it('guarding cargo protects its actual custody rather than handing it to the guard', async () => {
        const h = await prepared(true);
        await h.game.act('I accept the private paid work');
        await h.game.act('I wait 1 day');
        await collectAtTheActualPayer(h);
        const cargo = h.game.atHand!.objects.find(object => object.id === 'the-real-cargo')!;
        expect(cargo.possessorId).toBe(h.relative.id);
        expect(factsWithDataValue(h.game.atHand!, 'privateWorkPayment', h.offer.id).some(fact => fact.data.paid)).toBe(true);
    }, 120000);
    it('leaving the accepted road party breaks the paid guard word without a wage', async () => {
        const h = await prepared(), before = h.body.spiritStones;
        await h.game.act('I accept the private paid work');
        await h.game.act('I wait 3 hours');
        await h.game.act('I leave the party');
        settlePrivateWorkAtTheBody(h.game);
        expect(h.game.state().cultivator.spiritStones).toBe(before);
        expect(ledgerAbout(h.db, h.body.id).some(word => word.tags.includes('private-work-failed') && word.subjectId === h.body.id)).toBe(true);
    }, 120000);
});
