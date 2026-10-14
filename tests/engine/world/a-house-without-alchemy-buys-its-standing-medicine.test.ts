/**
 * Removing universal craft rooms left the medicine seeder and yearly refill
 * making ordinary pills for houses without alchemy support. The owner's
 * 2026-10-10 ruling requires those houses to buy supplies from actual makers.
 * The original controls cover the institutional stock prerequisite. The
 * purchase regression then measured a real factor beside a finite seller:
 * zero personal stones blocked the purchase despite a funded house purse.
 * House-funded trade must conserve both purses, retain physical carriage and
 * credit the shelf only on return. Personal crafting keeps its separate path.
 * A short purchasing mission was also unable to buy on its actual arrival:
 * its service activity is a party errand, rather than a long posting. The
 * ordinary arrival must execute that purchasing work before its real return.
 * A three-dose Clear Meridian consignment was quoted at 60 stones, the same
 * as one dose; its actual quoted total must be 180. Counted stock keeps its
 * quantity when ownership changes and when the factor unloads it.
 * The same purchasing duty must supply other ordinary counted pills. A house
 * without alchemy buys its healing and qi pills through the actual exchange;
 * neither its stock nor its supplier's money appears before the transaction.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { linkLocations, makeLocation } from '../../../src/engine/world/locations.js';
import { seedPillStock } from '../../../src/engine/world/where-the-pills-actually-are.js';
import { housesRefineTheirWoundMedicine } from '../../../src/engine/world/house-wound-medicine.js';
import { PILLS } from '../../../src/data/cultivation/pills.js';
import { pillStorageModel } from '../../../src/engine/cultivation/buying-and-bartering-pills.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { exchangeOffers, tradeExchangeObject, tradeAtCapitalExchanges, returnExchangeConsignment } from '../../../src/engine/world/wares-at-a-capital-exchange.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { advancePublicCapitalMission, sendHouseMission } from '../../../src/engine/world/capital-missions-and-calendar.js';

function medicineAtAnExchange() {
    const h = house(true);
    const buyerHouse = makeFaction({ id: 'buyer-house', name: 'Reed House', seatLocationId: 'buyer-seat',
        resources: { spirit_stones: 1000, reliable_ordinal: 10 } });
    h.state.factions.push(buyerHouse);
    h.state.locations.push(makeLocation({ id: 'venue', name: 'City', kind: 'settlement', tags: ['city'] }),
        makeLocation({ id: 'seat', name: 'Spring Grounds', kind: 'sect_seat' }),
        makeLocation({ id: 'buyer-seat', name: 'Reed Grounds', kind: 'sect_seat' }));
    const seller = h.state.npcs[0]!;
    seller.locationId = 'venue';
    seller.spiritStones = 0;
    seller.activity = { kind: 'stationed', note: 'Keeping the exchange counter.', sinceDay: 0,
        untilDay: 90, returnTo: 'seat', withIds: [] };
    const buyer = createNpc(h.state.seed, { id: 'buyer', factionId: buyerHouse.id,
        locationId: 'venue', bornOnDay: -10_000, onDay: 0 });
    buyer.spiritStones = 0;
    buyer.activity = { kind: 'stationed', note: 'Serving the house at the exchange.', sinceDay: 0,
        untilDay: 90, returnTo: buyerHouse.seatLocationId, withIds: [] };
    h.state.npcs.push(buyer);
    const pill = PILLS.find(row => row.effect === 'treat_injury' && pillStorageModel(row) === 'count')!;
    const object = makeObject({ id: 'actual-medicine', name: pill.name, kind: 'pill',
        ownerId: seller.factionId, possessorId: seller.id, locationId: 'venue',
        tags: ['exchange'], data: { pillId: pill.id, stintDay: 0 } });
    h.state.objects.push(object);
    return { ...h, buyerHouse, seller, buyer, pill, object };
}

function house(supported: boolean) {
    const state = createWorld({ seed: 'institutional-medicine-support', regionCount: 0, skipPriorAges: true });
    const faction = makeFaction({ id: 'house', name: 'Spring House', seatLocationId: 'seat',
        resources: { spirit_stones: 10_000, power_ordinal: 30, reliable_ordinal: 30 } });
    state.factions.push(faction);
    const member = setRealm(createNpc(state.seed, { id: 'maker', bornOnDay: -10_000, onDay: 0,
        locationId: 'seat', factionId: faction.id }), 30, 0);
    state.npcs.push(member);
    state.locations.push(makeLocation({ id: 'quarters', name: 'Quarters', kind: 'hall',
        data: { factionId: faction.id, purpose: 'dormitory' } }));
    if (supported) state.locations.push(makeLocation({ id: 'alchemy', name: 'Alchemy Hall', kind: 'hall',
        data: { factionId: faction.id, purpose: 'alchemy_hall' } }));
    return { state, faction };
}

function ordinaryStock(resources: Record<string, number>): number {
    return Object.entries(resources).filter(([key]) => key.startsWith('pill_stock:'))
        .reduce((sum, [, count]) => sum + count, 0);
}

describe('standing medicine requires actual alchemy support', () => {
    it('a report errand cannot spend the house purse as an unassigned purchasing duty', () => {
        const h = medicineAtAnExchange();
        const home = h.state.locations.find(row => row.id === h.buyerHouse.seatLocationId)!;
        const venue = h.state.locations.find(row => row.id === 'venue')!;
        linkLocations(home, venue, 'road', 1);
        h.buyer.locationId = home.id;
        h.buyer.activity = null;
        const mission = sendHouseMission(h.state, h.buyerHouse, venue, [h.buyer],
            'carrying the house report', 0, { days: 7 });
        expect(mission).not.toBeNull();
        const onDay = Number(mission!.data.publicServiceEnd) - 1;
        advancePublicCapitalMission(h.state, h.buyer.id, onDay);
        const present = h.state.npcs.find(row => row.id === h.buyer.id)!;
        expect(present.locationId).toBe(venue.id);
        expect(present.activity?.kind).toBe('out_with_a_party');
        expect(tradeExchangeObject(h.state, h.seller, present, h.object.id, onDay, undefined, undefined, true)).toBeNull();
        expect(h.state.objects.find(row => row.id === h.object.id)!.possessorId).toBe(h.seller.id);
        expect(h.buyerHouse.resources.spirit_stones).toBe(1000);
    });

    it('an actual short purchasing errand buys at arrival and carries the dose home on its own itinerary', () => {
        const h = medicineAtAnExchange();
        const home = h.state.locations.find(row => row.id === h.buyerHouse.seatLocationId)!;
        const venue = h.state.locations.find(row => row.id === 'venue')!;
        linkLocations(home, venue, 'road', 1);
        h.buyer.locationId = home.id;
        h.buyer.activity = null;
        const mission = sendHouseMission(h.state, h.buyerHouse, venue, [h.buyer],
            'trade and purchases', 0, { days: 7 });
        expect(mission).not.toBeNull();
        expect(h.state.objects.find(row => row.id === h.object.id)!.possessorId).toBe(h.seller.id);
        expect(ordinaryStock(h.buyerHouse.resources)).toBe(0);
        const returnedOn = Number(mission!.data.plannedReturnDay);
        expect(returnedOn).toBeGreaterThan(7);
        advancePublicCapitalMission(h.state, h.buyer.id, returnedOn);
        const purchase = h.state.history.facts.find(row => row.data.exchangeSale === true
            && row.data.buyerHouseId === h.buyerHouse.id);
        expect(purchase).toBeTruthy();
        expect(purchase!.locationId).toBe(venue.id);
        expect(purchase!.day).toBeGreaterThan(0);
        expect(purchase!.day).toBeLessThan(returnedOn);
        const returned = h.state.npcs.find(row => row.id === h.buyer.id)!;
        expect(returned.locationId).toBe(home.id);
        returnExchangeConsignment(h.state, returned, returnedOn);
        expect(ordinaryStock(h.buyerHouse.resources)).toBe(1);
        expect(h.state.objects.some(row => row.id === h.object.id)).toBe(false);
    });

    it('pays for every dose in an actual counted consignment', () => {
        const h = medicineAtAnExchange();
        const single = exchangeOffers(h.state, h.seller)[0]!.askStones;
        h.object.data.quantity = 3;
        expect(exchangeOffers(h.state, h.seller)[0]!.askStones).toBe(single * 3);
        const paid = tradeExchangeObject(h.state, h.seller, h.buyer, h.object.id, 1, undefined, undefined, true);
        expect(paid).toBe(single * 3);
        expect(h.buyerHouse.resources.spirit_stones).toBe(1000 - single * 3);
        const returned = h.state.npcs.find(row => row.id === h.buyer.id)!;
        returned.locationId = h.buyerHouse.seatLocationId;
        returned.activity = null;
        returnExchangeConsignment(h.state, returned, 3);
        expect(ordinaryStock(h.buyerHouse.resources)).toBe(3);
    });

    it('settles a house purchase through the existing background exchange pass', () => {
        const h = medicineAtAnExchange();
        h.seller.activity!.untilDay = 365;
        h.buyer.activity!.untilDay = 365;
        let bought = false;
        // The native seller declines the day-one trade. Settle the quarter reads
        // during this actual stint, preserving that ordinary trade decision.
        for (const day of [1, 91, 181, 271]) {
            expect(exchangeOffers(h.state, h.seller, undefined, undefined, day).some(row => row.objectId === h.object.id)).toBe(true);
            const willing = forStream(h.state.seed, 'exchange-sale', h.seller.id, day).chance(0.5);
            h.state.currentDay = day;
            tradeAtCapitalExchanges(h.state, day);
            bought = h.state.history.facts.some(row => row.data.exchangeSale === true
                && row.data.buyerHouseId === h.buyerHouse.id);
            expect(bought).toBe(willing);
            if (bought) break;
            expect(h.buyerHouse.resources.spirit_stones).toBe(1000);
        }
        expect(bought).toBe(true);
        expect(ordinaryStock(h.buyerHouse.resources)).toBe(0);
        expect(h.state.objects.find(row => row.id === h.object.id)?.ownerId).toBe(h.buyerHouse.id);
    });

    it('returns unsold goods even when depositing medicine removed an earlier row', () => {
        const h = medicineAtAnExchange();
        expect(tradeExchangeObject(h.state, h.seller, h.buyer, h.object.id, 1, undefined, undefined, true)).not.toBeNull();
        h.state.objects.push(makeObject({ id: 'unsold', name: h.pill.name, kind: 'pill',
            ownerId: h.buyerHouse.id, possessorId: h.buyer.id, locationId: 'venue',
            tags: ['exchange'], data: { pillId: h.pill.id } }));
        const returned = h.state.npcs.find(row => row.id === h.buyer.id)!;
        returned.locationId = h.buyerHouse.seatLocationId;
        returned.activity = null;
        returnExchangeConsignment(h.state, returned, 3, 0, h.buyerHouse.id, [1]);
        expect(ordinaryStock(h.buyerHouse.resources)).toBe(1);
        expect(h.state.objects.find(row => row.id === 'unsold')).toMatchObject({
            ownerId: h.buyerHouse.id, possessorId: null, locationId: h.buyerHouse.seatLocationId });
    });

    it('buys a finite dose with the house purse and puts it on the shelf only on an actual return', () => {
        const h = medicineAtAnExchange();
        const had = h.buyerHouse.resources.spirit_stones;
        const paid = tradeExchangeObject(h.state, h.seller, h.buyer, h.object.id, 1, undefined, undefined, true);
        expect(paid).not.toBeNull();
        expect(paid).toBeGreaterThan(0);
        expect(h.buyerHouse.resources.spirit_stones).toBe(had - paid!);
        expect(h.state.npcs.find(row => row.id === h.seller.id)!.spiritStones).toBe(paid);
        expect(h.state.npcs.find(row => row.id === h.buyer.id)!.spiritStones).toBe(0);
        expect(h.state.objects.find(row => row.id === h.object.id)).toMatchObject({
            ownerId: h.buyerHouse.id, possessorId: h.buyer.id });
        expect(ordinaryStock(h.buyerHouse.resources)).toBe(0);
        returnExchangeConsignment(h.state, h.state.npcs.find(row => row.id === h.buyer.id)!, 2);
        expect(ordinaryStock(h.buyerHouse.resources)).toBe(0);
        const returned = h.state.npcs.find(row => row.id === h.buyer.id)!;
        returned.locationId = h.buyerHouse.seatLocationId;
        returned.activity = null;
        returnExchangeConsignment(h.state, returned, 3);
        expect(ordinaryStock(h.buyerHouse.resources)).toBe(1);
        expect(h.state.objects.some(row => row.id === h.object.id)).toBe(false);
        returnExchangeConsignment(h.state, returned, 3);
        expect(ordinaryStock(h.buyerHouse.resources)).toBe(1);
        expect(h.state.history.facts.some(row => row.data.exchangeSale === true
            && row.data.buyerHouseId === h.buyerHouse.id && row.data.stones === paid)).toBe(true);
    });

    it('buys other ordinary counted pills through the same assigned factor and real delivery', () => {
        for (const effect of ['heal_hp', 'restore_qi']) {
            const h = medicineAtAnExchange();
            const pill = PILLS.find(row => row.effect === effect && row.grade === 'mortal'
                && pillStorageModel(row) === 'count')!;
            expect(pill, effect).toBeDefined();
            h.object.name = pill.name;
            h.object.data.pillId = pill.id;
            const had = h.buyerHouse.resources.spirit_stones;
            const paid = tradeExchangeObject(h.state, h.seller, h.buyer, h.object.id, 1, undefined, undefined, true);
            expect(paid, pill.name).not.toBeNull();
            expect(paid).toBeGreaterThan(0);
            expect(h.buyerHouse.resources.spirit_stones).toBe(had - paid!);
            expect(h.state.npcs.find(row => row.id === h.seller.id)!.spiritStones).toBe(paid);
            expect(ordinaryStock(h.buyerHouse.resources)).toBe(0);
            const returned = h.state.npcs.find(row => row.id === h.buyer.id)!;
            returned.locationId = h.buyerHouse.seatLocationId;
            returned.activity = null;
            returnExchangeConsignment(h.state, returned, 3);
            expect(ordinaryStock(h.buyerHouse.resources)).toBe(1);
            expect(h.state.objects.some(row => row.id === h.object.id)).toBe(false);
            expect(h.state.history.facts.some(row => row.data.houseMedicineDelivery === true
                && row.data.houseId === h.buyerHouse.id && row.data.pillId === pill.id)).toBe(true);
        }
    });

    it('leaves an unaffordable dose with the actual seller', () => {
        const h = medicineAtAnExchange();
        h.buyerHouse.resources.spirit_stones = 0;
        expect(tradeExchangeObject(h.state, h.seller, h.buyer, h.object.id, 1, undefined, undefined, true)).toBeNull();
        expect(h.state.objects[0]!.possessorId).toBe(h.seller.id);
        expect(h.state.npcs.find(row => row.id === h.seller.id)!.spiritStones).toBe(0);
        expect(ordinaryStock(h.buyerHouse.resources)).toBe(0);
    });

    it('cannot spend house stones for a factor who is elsewhere', () => {
        const h = medicineAtAnExchange();
        h.buyer.locationId = h.buyerHouse.seatLocationId;
        expect(tradeExchangeObject(h.state, h.seller, h.buyer, h.object.id, 1, undefined, undefined, true)).toBeNull();
        expect(h.buyerHouse.resources.spirit_stones).toBe(1000);
        expect(h.state.objects[0]!.possessorId).toBe(h.seller.id);
    });

    it('seeds ordinary stock only at a maker, without charging a nonmaker for an invented purchase', () => {
        const maker = house(true);
        const buyer = house(false);
        seedPillStock(maker.state);
        seedPillStock(buyer.state);
        expect(ordinaryStock(maker.faction.resources)).toBeGreaterThan(0);
        expect(ordinaryStock(buyer.faction.resources)).toBe(0);
        expect(buyer.faction.resources.spirit_stones).toBe(10_000);
    });

    it('does not refill a nonmaker merely because its member can work the grade', () => {
        const { state, faction } = house(false);
        expect(housesRefineTheirWoundMedicine(state, 1)).toEqual({ batches: 0, set: 0, stones: 0 });
        expect(ordinaryStock(faction.resources)).toBe(0);
        expect(faction.resources.spirit_stones).toBe(10_000);
    });

    it('retains the ordinary paid ingredient batches of a supported maker', () => {
        const { state, faction } = house(true);
        const refined = housesRefineTheirWoundMedicine(state, 1);
        expect(refined.batches).toBeGreaterThan(0);
        expect(refined.stones).toBeGreaterThan(0);
        expect(faction.resources.spirit_stones).toBe(10_000 - refined.stones);
        expect(ordinaryStock(faction.resources)).toBe(refined.set);
    });
});
