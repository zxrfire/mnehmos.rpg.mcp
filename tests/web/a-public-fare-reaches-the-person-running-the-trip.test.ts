/**
 * Public boarding removed the fare from the player's purse without crediting
 * the person running the service. These controls use the same ordinary cash
 * writer as agreed rides: an actual accepted boarding pays the real owner,
 * repeats charge once, and a person outside that receipt supplies no payment.
 * The played counter control retains normal travel and encounter resolution;
 * it does not force an arrival or bypass capacity. Both world and run are pinned.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { createNpc } from '../../src/engine/world/npc-state';
import { worldLocationFor } from '../../src/engine/world/place-lookup';
import { aVehicleOf } from '../../src/engine/world/a-vehicle';
import { carriageIdForRoad, quotePublicCarriage, commitPublicCarriage } from '../../src/engine/world/public-carriages';
import { routineTime } from '../../src/engine/world/npc-routines';
import { payForAcceptedPublicPassage } from '../../src/web/paying-the-actual-public-carrier';

async function prepared() {
    const h = await makeGameInWorld({ seed: 'actual-public-fare', worldSeed: 'actual-public-fare-world' });
    const { cultivator } = await h.game.newRun('Traveller');
    const world = h.game.atHand!;
    const from = worldLocationFor(world, 'The Furnace Flank')!;
    const to = worldLocationFor(world, 'Emerald Water City')!;
    expect(from).toBeDefined();
    expect(to).toBeDefined();
    const day = routineTime(world);
    const driver = createNpc(world.seed, { id: 'actual-fare-driver', locationId: from.id,
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

describe('an ordinary public fare pays the actual service', () => {
    it('moves both purses once against the accepted native receipt', async () => {
        const h = await prepared();
        const quote = quotePublicCarriage(h.world, { fromId: h.from.id, toId: h.to.id,
            day: routineTime(h.world), conveyanceId: 'conv-carriage-mortal',
            passengerIds: [h.cultivator.id], fareStones: 3, hired: false,
            playedPassenger: { id: h.cultivator.id, locationId: h.from.id, alive: true } });
        expect(quote).not.toBeNull();
        const receipt = commitPublicCarriage(h.world, quote!)!;
        expect(receipt).not.toBeNull();
        expect(payForAcceptedPublicPassage(h.game, receipt.id, h.cultivator, 3)).toBe(true);
        expect(h.game.repos.cultivators.getById(h.cultivator.id)!.spiritStones).toBe(97);
        expect(h.world.npcs.find(row => row.id === h.driver.id)!.spiritStones).toBe(43);
        expect(payForAcceptedPublicPassage(h.game, receipt.id, h.cultivator, 3)).toBe(true);
        expect(h.game.repos.cultivators.getById(h.cultivator.id)!.spiritStones).toBe(97);
        expect(h.world.npcs.find(row => row.id === h.driver.id)!.spiritStones).toBe(43);
        expect(h.world.history.facts.filter(fact => fact.data.publicPassagePayment === receipt.id)).toHaveLength(1);
    });

    it('cannot turn a different fare or a stranger into an accepted payment', async () => {
        const h = await prepared();
        const quote = quotePublicCarriage(h.world, { fromId: h.from.id, toId: h.to.id,
            day: routineTime(h.world), conveyanceId: 'conv-carriage-mortal',
            passengerIds: [h.cultivator.id], fareStones: 3, hired: false,
            playedPassenger: { id: h.cultivator.id, locationId: h.from.id, alive: true } });
        const receipt = commitPublicCarriage(h.world, quote!)!;
        expect(payForAcceptedPublicPassage(h.game, receipt.id, h.cultivator, 4)).toBe(false);
        expect(payForAcceptedPublicPassage(h.game, receipt.id, { id: 'stranger', name: 'Stranger' }, 3)).toBe(false);
        expect(h.game.repos.cultivators.getById(h.cultivator.id)!.spiritStones).toBe(100);
        expect(h.world.npcs.find(row => row.id === h.driver.id)!.spiritStones).toBe(40);
        expect(h.world.history.facts.some(fact => fact.data.publicPassagePayment === receipt.id)).toBe(false);
    });

    it('the played public counter pays the actual carriage owner', async () => {
        const h = await prepared();
        const turn = await h.game.act(`I take a carriage to ${h.to.name}`);
        const receipt = h.world.history.facts.find(fact => fact.data.publicPassage === true
            && fact.data.vesselId === h.vehicle.id)!;
        expect(receipt, turn.narration).toBeDefined();
        const paid = h.world.history.facts.find(fact => fact.data.publicPassagePayment === receipt.id)!;
        expect(paid).toBeDefined();
        expect(paid.data.receiverId).toBe(h.driver.id);
        expect(paid.data.stones).toBe(receipt.data.fareStones);
        expect(h.world.npcs.find(row => row.id === h.driver.id)!.spiritStones)
            .toBeGreaterThanOrEqual(40 + Number(receipt.data.fareStones));
        expect(h.game.repos.cultivators.getById(h.cultivator.id)!.spiritStones)
            .toBeLessThanOrEqual(100 - Number(receipt.data.fareStones));
    });
});
