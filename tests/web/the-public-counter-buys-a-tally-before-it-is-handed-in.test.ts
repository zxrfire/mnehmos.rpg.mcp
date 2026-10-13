/**
 * The counter paid the carrier and boarded the traveller without ever making
 * the physical passage tally. Immediate passage now issues the paid item in
 * the native boarding commit, hands it to the actual driver or crew member,
 * and deletes it there. These played controls observe the ordinary transfer
 * itself, including the receiver's temporary possession and the final SQLite
 * deletion. They retain actual travel and its interruptions. Advance bookings,
 * a full departure's next run and negotiated resale remain separate work.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeGameInWorld } from './harness';
import * as possessions from '../../src/engine/world/possessions';
import { createNpc } from '../../src/engine/world/npc-state';
import { worldLocationFor } from '../../src/engine/world/place-lookup';
import { aVehicleOf } from '../../src/engine/world/a-vehicle';
import { carriageIdForRoad, quotePublicCarriage, commitPublicCarriage } from '../../src/engine/world/public-carriages';
import { routineTime } from '../../src/engine/world/npc-routines';
import { publicShipLinesFrom } from '../../src/engine/world/public-shipping';
import { buyTalliesForActualPublicBoarding } from '../../src/web/buying-the-tallies-for-an-actual-public-boarding';
import { whatRunsFromHere, stonesFor } from '../../src/web/a-seat-on-a-ship-or-a-carriage';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { makeFact } from '../../src/engine/world/history';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened';
import { makePassageTally, passageTalliesForDeparture } from '../../src/engine/world/a-passage-tally-is-the-seat-you-own';
import { transferActualSpiritStones } from '../../src/web/transferring-actual-spirit-stones';

async function prepared() {
    const h = await makeGameInWorld({ seed: 'actual-public-fare', worldSeed: 'actual-public-fare-world' });
    const { cultivator } = await h.game.newRun('Traveller');
    const world = h.game.atHand!;
    const from = worldLocationFor(world, 'The Furnace Flank')!;
    const to = worldLocationFor(world, 'Emerald Water City')!;
    const day = routineTime(world);
    const driver = createNpc(world.seed, { id: 'tally-counter-driver', locationId: from.id,
        onDay: day, bornOnDay: day - 30 * 365, occupation: 'carter' });
    driver.spiritStones = 40;
    driver.activity = { kind: 'idle', note: 'Keeping the carriage at the station.',
        withIds: [], sinceDay: day, untilDay: null };
    world.npcs.push(driver);
    const vehicle = aVehicleOf({ id: carriageIdForRoad(from.id, to.id, 'conv-carriage-mortal'),
        conveyanceId: 'conv-carriage-mortal', ownerId: driver.id, ownerName: driver.name, at: from.id });
    vehicle.tags.push('public-road-service');
    world.objects.push(vehicle);
    h.game.repos.cultivators.update(cultivator.id, { location: from.name, standingIn: null,
        spiritStones: 100 });
    h.game.theWorldMoved();
    return { ...h, world, from, to, cultivator, driver, vehicle };
}

afterEach(() => vi.restoreAllMocks());

describe('the public counter buys the item before hand-in', () => {
    it('a gifted paid tally lets its current holder board with an empty purse', async () => {
        const h = await prepared();
        const buyer = createNpc(h.world.seed, { id: 'original-tally-buyer', locationId: h.from.id,
            onDay: routineTime(h.world), bornOnDay: routineTime(h.world) - 7300 });
        buyer.spiritStones = 100;
        h.world.npcs.push(buyer);
        const line = whatRunsFromHere(h.game, h.game.currentRun().cultivator,
            Math.floor(h.world.currentDay)).find(line => line.to === h.to.name && line.service === 'carriage')!;
        const fare = stonesFor(line.cashPerSeat);
        const quote = quotePublicCarriage(h.world, { fromId: h.from.id, toId: h.to.id,
            day: routineTime(h.world), conveyanceId: 'conv-carriage-mortal',
            passengerIds: [buyer.id], fareStones: fare, hired: false })!;
        expect(quote).not.toBeNull();
        // Arrange an accepted paid item before departure. Advance counter
        // scheduling is not asserted here; this exercises its gifted holder.
        expect(transferActualSpiritStones(h.game, buyer.id, h.driver.id, fare, () => {
            const terms = { ...quote, service: 'carriage' as const, seat: 1 };
            const purchase = appendWorldFact(h.world, makeFact({ day: routineTime(h.world), kind: 'gathering',
                summary: 'A passage tally was bought.', visibility: 'secret',
                actors: [{ id: buyer.id, name: buyer.name, role: 'buyer' }],
                data: { passageTallyPurchase: true, service: terms.service, vesselId: terms.vesselId,
                    fromLocationId: terms.fromId, toLocationId: terms.toId,
                    departureDay: terms.departureDay, seat: terms.seat, fareStones: fare, stones: fare } }),
                { recur: false, bystanders: false });
            const tally = makePassageTally({ terms, buyer, purchase, onDay: routineTime(h.world),
                fromName: h.from.name, toName: h.to.name });
            h.world.objects.push(possessions.transferPossession(tally, { onDay: routineTime(h.world),
                toHolderId: h.cultivator.id, toHolderName: h.cultivator.name,
                how: 'gifted', transfersOwnership: true }));
        }).ok).toBe(true);
        const station = theAreasOf(h.world, h.from).areas.find(area => area.for === 'carriage_station')!;
        h.game.repos.cultivators.standIn(h.cultivator.id, station.id);
        h.game.repos.cultivators.update(h.cultivator.id, { spiritStones: 0 });
        h.game.theWorldMoved();
        const handover = vi.spyOn(possessions, 'transferPossession');
        const turn = await h.game.act(`I take the carriage to ${h.to.name}`);
        const diagnostic = JSON.stringify({ purchasedAt: quote.departureDay, now: routineTime(h.world),
            from: h.from.id, to: h.to.id, vehicle: quote.vesselId,
            body: h.game.currentRun().cultivator.location,
            bodyId: h.game.currentRun().cultivator.id, sameWorld: h.world === h.game.atHand,
            heldHere: passageTalliesForDeparture(h.game.atHand!, { service: 'carriage', vesselId: quote.vesselId,
                fromId: h.from.id, toId: h.to.id, departureDay: routineTime(h.game.atHand!) }).length,
            activeClock: routineTime(h.game.atHand!),
            activePurchases: h.game.atHand!.history.facts.filter(fact => fact.data.passageTallyPurchase === true)
                .map(fact => ({ id: fact.id, data: fact.data })),
            standingIn: h.game.currentRun().cultivator.standingIn,
            items: h.world.objects.filter(object => object.tags.includes('passage-tally'))
                .map(object => ({ possessor: object.possessorId, data: object.data })) });
        expect(handover.mock.calls.filter(call => call[0].tags.includes('passage-tally')),
            turn.narration + '\n' + diagnostic).toHaveLength(1);
        expect(h.game.repos.cultivators.getById(h.cultivator.id)!.spiritStones).toBe(0);
        const boarded = h.world.history.facts.find(fact => fact.data.publicPassage === true
            && fact.actors.some(actor => actor.id === h.cultivator.id && actor.role === 'passenger'))!;
        expect(boarded, turn.narration).toBeDefined();
        expect(boarded.data.fareStones).toBe(0);
        expect(h.world.history.facts.some(fact => fact.data.publicPassagePayment === boarded.id)).toBe(false);
        expect(h.world.objects.some(object => object.tags.includes('passage-tally')
            && object.possessorId === h.cultivator.id)).toBe(false);
    });

    it.each(['carriage', 'ship'] as const)('hands the played %s tally to a real receiver, then deletes it', async service => {
        const h = await prepared();
        let destination = h.to.name;
        if (service === 'ship') {
            const port = worldLocationFor(h.world, 'Emerald Water City')!;
            const line = publicShipLinesFrom(h.world, port.name, routineTime(h.world))
                .find(line => line.runsFromDay === null)!;
            expect(line).toBeDefined();
            destination = line.to;
            h.game.repos.cultivators.update(h.cultivator.id, { location: port.name,
                standingIn: null, spiritStones: 500 });
        }
        const handover = vi.spyOn(possessions, 'transferPossession');
        const turn = await h.game.act(`I take the ${service} to ${destination}`);
        const transfers = handover.mock.calls.flatMap((call, index) =>
            call[0].tags.includes('passage-tally') ? [{ before: call[0], after: handover.mock.results[index]!.value }] : []);
        expect(transfers, turn.narration).toHaveLength(1);
        const { before, after } = transfers[0]!;
        expect(before.possessorId).toBe(h.cultivator.id);
        const receiver = h.world.npcs.find(person => person.id === after.possessorId)!;
        expect(receiver.status).toBe('alive');
        expect(after.provenance.at(-1).previousHolderId).toBe(h.cultivator.id);
        expect(after.provenance.at(-1).holderId).toBe(receiver.id);
        const purchase = h.world.history.facts.find(fact => fact.id === before.provenance[0]!.factId)!;
        expect(purchase.data.passageTallyPurchase).toBe(true);
        const payment = h.world.history.facts.find(fact => fact.data.publicPassagePayment === purchase.data.boardingReceiptId)!;
        expect(payment.data.payerId).toBe(h.cultivator.id);
        const vessel = h.world.objects.find(object => object.id === purchase.data.vesselId)!;
        expect(payment.data.receiverId).toBe(vessel.ownerId);
        expect(payment.data.stones).toBe(purchase.data.fareStones);
        expect(h.world.objects.some(object => object.id === before.id)).toBe(false);
        expect(h.db.prepare('SELECT id FROM world_objects WHERE id = ?').get(before.id)).toBeUndefined();
        expect(h.world.history.facts.some(fact => fact.data.tokenId === before.id && fact.data.missedDeparture === true)).toBe(false);
    });

    it('a sponsored companion holds their own seat without a second charge or invented personal spending', async () => {
        const h = await prepared();
        const companion = createNpc(h.world.seed, { id: 'tally-companion', name: 'Companion',
            locationId: h.from.id, bornOnDay: -30 * 365, onDay: routineTime(h.world) });
        companion.spiritStones = 17;
        h.world.npcs.push(companion);
        const passengers = [h.cultivator, companion];
        const quote = quotePublicCarriage(h.world, { fromId: h.from.id, toId: h.to.id,
            day: routineTime(h.world), conveyanceId: 'conv-carriage-mortal',
            passengerIds: passengers.map(person => person.id), fareStones: 6, hired: false,
            playedPassenger: { id: h.cultivator.id, locationId: h.from.id, alive: true } })!;
        expect(quote).not.toBeNull();
        const handover = vi.spyOn(possessions, 'transferPossession');
        const receipt = commitPublicCarriage(h.world, quote, undefined, undefined, accepted => {
            expect(buyTalliesForActualPublicBoarding(h.game, accepted, h.cultivator, passengers, 6)).toBe(true);
            expect(h.world.objects.filter(object => object.tags.includes('passage-tally'))
                .map(object => object.possessorId).sort()).toEqual(passengers.map(person => person.id).sort());
            expect(buyTalliesForActualPublicBoarding(h.game, accepted, h.cultivator, passengers, 6)).toBe(true);
        })!;
        expect(receipt).not.toBeNull();
        const purchases = h.world.history.facts.filter(fact => fact.data.boardingReceiptId === receipt.id);
        expect(purchases).toHaveLength(2);
        expect(new Set(purchases.map(fact => fact.data.seat)).size).toBe(2);
        expect(purchases.find(fact => fact.actors.some(actor => actor.id === companion.id && actor.role === 'buyer'))!
            .data.stones).toBe(0);
        expect(h.game.repos.cultivators.getById(h.cultivator.id)!.spiritStones).toBe(94);
        expect(h.world.npcs.find(person => person.id === h.driver.id)!.spiritStones).toBe(46);
        expect(h.world.npcs.find(person => person.id === companion.id)!.spiritStones).toBe(17);
        expect(handover.mock.calls.filter(call => call[0].tags.includes('passage-tally'))).toHaveLength(2);
        expect(h.world.objects.some(object => object.tags.includes('passage-tally'))).toBe(false);
    });

    it('an accepted receipt without a living taker cannot buy or delete a tally', async () => {
        const h = await prepared();
        const quote = quotePublicCarriage(h.world, { fromId: h.from.id, toId: h.to.id,
            day: routineTime(h.world), conveyanceId: 'conv-carriage-mortal',
            passengerIds: [h.cultivator.id], fareStones: 3, hired: false,
            playedPassenger: { id: h.cultivator.id, locationId: h.from.id, alive: true } })!;
        const receipt = commitPublicCarriage(h.world, quote)!;
        h.world.npcs.find(person => person.id === h.driver.id)!.status = 'dead';
        expect(buyTalliesForActualPublicBoarding(h.game, receipt, h.cultivator, [h.cultivator], 3)).toBe(false);
        expect(h.game.repos.cultivators.getById(h.cultivator.id)!.spiritStones).toBe(100);
        expect(h.world.history.facts.some(fact => fact.data.passageTallyPurchase === true)).toBe(false);
    });
});
