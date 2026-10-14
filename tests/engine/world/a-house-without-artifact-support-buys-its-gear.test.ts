/**
 * A house without an Artifact Hall must buy its gear. The capital exchange
 * could only read pills, manuals and materials, so a real finished artifact
 * produced no offer and its assigned factor could not spend the house purse.
 * These controls keep one finite made object, the existing commission price,
 * both actual purses and physical delivery. Wealth supplies no free object.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { transferPossession } from '../../../src/engine/world/possessions.js';
import { mintAMadeThing } from '../../../src/engine/social-leverage/whether-the-work-holds.js';
import { whatACommissionComesTo } from '../../../src/engine/social-leverage/commissioning-a-craft.js';
import { exchangeOffers, loadExchangeConsignment, tradeExchangeObject, returnExchangeConsignment, tradeAtCapitalExchanges }
    from '../../../src/engine/world/wares-at-a-capital-exchange.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { sendHouseMission } from '../../../src/engine/world/capital-missions-and-calendar.js';
import { advanceWorldForPlay } from '../../../src/engine/world/driver.js';

function arrangement() {
    const state = createWorld({ seed: 'actual-house-gear-purchase', regionCount: 0, skipPriorAges: true });
    const makerHouse = makeFaction({ id: 'maker-house', name: 'Iron House', seatLocationId: 'maker-seat',
        resources: { spirit_stones: 1000 } });
    const buyerHouse = makeFaction({ id: 'buyer-house', name: 'Reed House', seatLocationId: 'buyer-seat',
        resources: { spirit_stones: 1000 } });
    state.factions.push(makerHouse, buyerHouse);
    state.locations.push(makeLocation({ id: 'venue', name: 'City', kind: 'settlement', tags: ['city'] }),
        makeLocation({ id: 'maker-seat', name: 'Iron Grounds', kind: 'sect_seat' }),
        makeLocation({ id: 'buyer-seat', name: 'Reed Grounds', kind: 'sect_seat' }),
        makeLocation({ id: 'quarters', name: 'Quarters', kind: 'hall',
            data: { factionId: buyerHouse.id, purpose: 'dormitory' } }),
        makeLocation({ id: 'forge', name: 'Artifact Hall', kind: 'hall',
            data: { factionId: makerHouse.id, purpose: 'artifact_refining_hall' } }));
    const seller = createNpc(state.seed, { id: 'seller', bornOnDay: -7300, onDay: 0,
        factionId: makerHouse.id, locationId: 'venue' });
    const buyer = createNpc(state.seed, { id: 'buyer', bornOnDay: -7300, onDay: 0,
        factionId: buyerHouse.id, locationId: 'venue' });
    seller.spiritStones = buyer.spiritStones = 0;
    for (const person of [seller, buyer]) person.activity = { kind: 'stationed',
        note: 'Serving the house at the exchange.', sinceDay: 0, untilDay: 365,
        returnTo: person.factionId === makerHouse.id ? makerHouse.seatLocationId : buyerHouse.seatLocationId,
        withIds: [] };
    state.npcs.push(seller, buyer);
    const smith = createNpc(state.seed, { id: 'smith', bornOnDay: -7300, onDay: 0,
        factionId: makerHouse.id, locationId: 'forge', cultivation: { realmOrdinal: 0 } });
    state.npcs.push(smith);
    const artifact = { ...transferPossession(mintAMadeThing({ id: 'actual-sabre',
        ask: { named: 'Iron sabre', grade: 'mortal' },
        maker: { id: smith.id, name: smith.name, ordinal: smith.cultivation.realmOrdinal }, onDay: 0 }),
        { onDay: 0, toHolderId: makerHouse.id, toHolderName: makerHouse.name,
            how: 'crafted', transfersOwnership: true }),
        possessorId: seller.id, locationId: 'venue', tags: ['made', 'grade:mortal', 'exchange'] };
    state.objects.push(artifact);
    return { state, makerHouse, buyerHouse, seller, buyer, artifact };
}

describe('a nonmaking house buys finite finished gear', () => {
    it('loads actual finished goods set out for sale without taking private house gear', () => {
        const h = arrangement();
        const home = h.state.locations.find(l => l.id === h.makerHouse.seatLocationId)!;
        const venue = h.state.locations.find(l => l.id === 'venue')!;
        linkLocations(home, venue, 'road', 1);
        h.seller.activity!.fromLocationId = home.id;
        h.artifact.possessorId = null;
        h.artifact.locationId = home.id;
        h.state.objects.push({ ...h.artifact, id: 'private-sabre', tags: ['made', 'grade:mortal'] });
        loadExchangeConsignment(h.state, h.seller, 0);
        const loaded = h.state.objects.find(o => o.id === h.artifact.id)!;
        expect(loaded.possessorId).toBe(h.seller.id);
        expect(loaded.ownerId).toBe(h.makerHouse.id);
        expect(h.state.objects.find(o => o.id === 'private-sabre')!.possessorId).toBeNull();
        expect(exchangeOffers(h.state, h.seller, undefined, undefined, 0)).toEqual([]);
        expect(exchangeOffers(h.state, h.seller, undefined, undefined, 1)
            .some(offer => offer.objectId === h.artifact.id)).toBe(true);
        expect(h.state.objects.filter(o => o.id === h.artifact.id)).toHaveLength(1);
    });

    it('quotes the made object through the existing materials and maker-time price', () => {
        const h = arrangement();
        const offers = exchangeOffers(h.state, h.seller);
        expect(offers).toHaveLength(1);
        expect(offers[0]!.askStones).toBe(whatACommissionComesTo('mortal', false, 0));
    });

    it('pays from the house purse and carries the same object home to ordinary stores', () => {
        const h = arrangement();
        const price = whatACommissionComesTo('mortal', false, 0)!;
        expect(tradeExchangeObject(h.state, h.seller, h.buyer, h.artifact.id, 1,
            undefined, undefined, true)).toBe(price);
        expect(h.buyerHouse.resources.spirit_stones).toBe(1000 - price);
        expect(h.state.npcs.find(n => n.id === h.buyer.id)!.spiritStones).toBe(0);
        expect(h.state.npcs.find(n => n.id === h.seller.id)!.spiritStones).toBe(price);
        const carried = h.state.objects.find(o => o.id === h.artifact.id)!;
        expect(carried.ownerId).toBe(h.buyerHouse.id);
        expect(carried.possessorId).toBe(h.buyer.id);
        returnExchangeConsignment(h.state, h.buyer, 2);
        expect(h.state.objects.find(o => o.id === h.artifact.id)!.possessorId).toBe(h.buyer.id);
        h.buyer.locationId = h.buyerHouse.seatLocationId;
        h.buyer.activity = null;
        returnExchangeConsignment(h.state, h.buyer, 3);
        const stored = h.state.objects.find(o => o.id === h.artifact.id)!;
        expect(stored.ownerId).toBe(h.buyerHouse.id);
        expect(stored.possessorId).toBeNull();
        expect(stored.locationId).toBe('quarters');
        expect(h.state.history.facts.some(f => f.data.exchangeSale === true
            && f.data.buyerHouseId === h.buyerHouse.id && f.data.stones === price)).toBe(true);
        returnExchangeConsignment(h.state, h.state.npcs.find(n => n.id === h.seller.id)!, 365);
        expect(h.makerHouse.resources.spirit_stones).toBe(1000 + price);
        expect(h.state.npcs.find(n => n.id === h.seller.id)!.spiritStones).toBe(0);
    });

    it('leaves an unaffordable artifact and both purses unchanged', () => {
        const h = arrangement();
        h.buyerHouse.resources.spirit_stones = 0;
        expect(tradeExchangeObject(h.state, h.seller, h.buyer, h.artifact.id, 1,
            undefined, undefined, true)).toBeNull();
        expect(h.state.objects.find(o => o.id === h.artifact.id)!.possessorId).toBe(h.seller.id);
        expect(h.seller.spiritStones).toBe(0);
        expect(h.buyerHouse.resources.spirit_stones).toBe(0);
    });

    it('does not keep buying equivalent weapons after the actual roll has gear', () => {
        const h = arrangement();
        h.state.objects.push({ ...h.artifact, id: 'existing-sabre', ownerId: h.buyerHouse.id,
            possessorId: null, locationId: 'quarters', tags: ['made', 'grade:mortal'] });
        expect(tradeExchangeObject(h.state, h.seller, h.buyer, h.artifact.id, 1,
            undefined, undefined, true)).toBeNull();
        expect(h.buyerHouse.resources.spirit_stones).toBe(1000);
    });

    it('does not mistake stolen house gear for equipment still available to its roll', () => {
        const h = arrangement();
        h.state.objects.push({ ...h.artifact, id: 'stolen-sabre', ownerId: h.buyerHouse.id,
            possessorId: h.seller.id, locationId: 'venue', tags: ['made', 'grade:mortal'] });
        expect(tradeExchangeObject(h.state, h.seller, h.buyer, h.artifact.id, 1,
            undefined, undefined, true)).toBe(whatACommissionComesTo('mortal', false, 0));
    });

    it('keeps tracked-grade artifacts beyond an ordinary cash counter', () => {
        const h = arrangement();
        h.state.objects[0] = { ...h.artifact, tags: ['made', 'grade:heaven', 'exchange'] };
        expect(exchangeOffers(h.state, h.seller)).toEqual([]);
        expect(tradeExchangeObject(h.state, h.seller, h.buyer, h.artifact.id, 1,
            undefined, undefined, true)).toBeNull();
        expect(h.buyerHouse.resources.spirit_stones).toBe(1000);
    });

    it('buys and delivers through an actual purchasing errand and the world clock', () => {
        const h = arrangement();
        const home = h.state.locations.find(l => l.id === h.buyerHouse.seatLocationId)!;
        const venue = h.state.locations.find(l => l.id === 'venue')!;
        linkLocations(home, venue, 'road', 1);
        h.buyer.locationId = home.id;
        h.buyer.activity = null;
        const mission = sendHouseMission(h.state, h.buyerHouse, venue, [h.buyer],
            'trade and purchases', 0, { days: 7 });
        expect(mission).not.toBeNull();
        const returnedOn = Number(mission!.data.plannedReturnDay);
        advanceWorldForPlay(h.state, { days: returnedOn + 1, stopOnInterrupt: false });
        const purchase = h.state.history.facts.find(f => f.data.exchangeSale === true
            && f.data.objectId === h.artifact.id && f.data.buyerHouseId === h.buyerHouse.id);
        expect(purchase).toBeTruthy();
        expect(purchase!.day).toBeLessThan(returnedOn);
        const stored = h.state.objects.find(o => o.id === h.artifact.id)!;
        expect(stored.ownerId).toBe(h.buyerHouse.id);
        expect(stored.possessorId).toBeNull();
        expect(stored.locationId).toBe('quarters');
        expect(h.state.history.facts.some(f => f.data.houseArtifactDelivery === true
            && f.data.objectId === h.artifact.id)).toBe(true);
    });

    it('uses the existing seasonal sale decision for a factor with no personal money', () => {
        const h = arrangement();
        let bought = false;
        for (const day of [1, 91, 181, 271]) {
            const willing = forStream(h.state.seed, 'exchange-sale', h.seller.id, day).chance(0.5);
            h.state.currentDay = day;
            tradeAtCapitalExchanges(h.state, day);
            bought = h.state.history.facts.some(f => f.data.exchangeSale === true
                && f.data.buyerHouseId === h.buyerHouse.id);
            expect(bought).toBe(willing);
            if (bought) break;
            expect(h.buyerHouse.resources.spirit_stones).toBe(1000);
        }
        expect(bought).toBe(true);
    });
});
