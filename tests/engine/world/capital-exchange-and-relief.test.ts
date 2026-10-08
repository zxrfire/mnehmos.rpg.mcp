/**
 * The owner ruled that exchange stock comes with real stints, and that relief
 * arrives before departure. These arrangements pin finite goods, conserved
 * purses and told knowledge. The century census measures the live composition.
 * The first per-account implementation's census exceeded two GB before its
 * ten-year checkpoint. Handover batches now refer to the original facts.
 * A seasonal stock index must show exactly the same finite offers as a live read.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from '../../../src/engine/world/what-one-of-the-worlds-own-people-knows.js';
import { theyAreRelieved } from '../../../src/engine/world/a-house-posts-the-one-being-played.js';
import { exchangeOffers, loadExchangeConsignment, returnExchangeConsignment, tradeExchangeObject } from '../../../src/engine/world/wares-at-a-capital-exchange.js';
import { enterAnOpenCompetition, settleOpenCompetitions } from '../../../src/engine/world/entering-an-open-competition.js';
import { theDayItFallsIn } from '../../../src/engine/world/a-competition-anybody-may-enter.js';
import { stageCeilingFor } from '../../../src/engine/social/discovery.js';
import { SECTS } from '../../../src/data/cultivation/sects.js';

function arrangement() {
    const state = createWorld({ seed: 'exchange-relief', regionCount: 0, skipPriorAges: true });
    const workshop = SECTS.find(h => h.id === 'sect-cinnabar-crucible-sect')!;
    const house = makeFaction({ id: workshop.id, name: workshop.name, seatLocationId: 'seat', resources: { spirit_stones: 10_000 } });
    state.factions.push(house);
    state.locations.push(makeLocation({ id: 'venue', name: 'City', kind: 'settlement', tags: ['city'] }),
        makeLocation({ id: 'seat', name: 'Grounds', kind: 'sect_seat' }));
    for (const id of ['seller', 'buyer']) state.npcs.push({ ...setRealm(createNpc(state.seed,
        { id, locationId: 'venue', onDay: 0, bornOnDay: -30 * 365 }), 8, 0), spiritStones: 1000,
        factionId: id === 'seller' ? house.id : null });
    const [seller, buyer] = state.npcs;
    seller!.activity = { kind: 'stationed', note: 'At the exchange.', sinceDay: 0, untilDay: 90, returnTo: 'seat', withIds: [] };
    return { state, house, seller: seller!, buyer: buyer! };
}

describe('exchange goods and continuous posts', () => {
    it('moves finite workshop stock in either direction and returns the house receipts', () => {
        const { state, house, seller, buyer } = arrangement();
        loadExchangeConsignment(state, seller, 0);
        const offered = exchangeOffers(state, seller)[0]!;
        expect(offered, 'workshop goods reach the counter').toBeTruthy();
        const stock = state.objects.length;
        const stockPositions = state.objects.map((_, i) => i);
        expect(exchangeOffers(state, seller, stockPositions)).toEqual(exchangeOffers(state, seller));
        loadExchangeConsignment(state, seller, 0);
        expect(state.objects).toHaveLength(stock);
        const total = seller.spiritStones + buyer.spiritStones + Number(house.resources.spirit_stones);
        expect(tradeExchangeObject(state, seller, buyer, offered.objectId!, 1)).toBe(offered.askStones);
        expect(exchangeOffers(state, state.npcs[0]!, stockPositions)).toEqual(exchangeOffers(state, state.npcs[0]!));
        expect(exchangeOffers(state, state.npcs[0]!).some(o => o.objectId === offered.objectId)).toBe(false);
        const object = state.objects.find(o => o.id === offered.objectId)!;
        expect(object.ownerId).toBe(buyer.id);
        expect(object.provenance.map(p => p.how)).toEqual(['crafted', 'lent', 'bought']);
        returnExchangeConsignment(state, state.npcs[0]!, 90);
        expect(state.npcs[0]!.spiritStones).toBe(seller.spiritStones);
        expect(state.npcs[0]!.spiritStones + state.npcs[1]!.spiritStones + Number(house.resources.spirit_stones)).toBe(total);
        expect(state.objects.filter(o => o.ownerId === house.id).every(o => o.possessorId === null && o.locationId === 'seat')).toBe(true);
        expect(tradeExchangeObject(state, state.npcs[1]!, state.npcs[0]!, object.id, 91)).toBeGreaterThan(0);
        expect(state.npcs[0]!.spiritStones + state.npcs[1]!.spiritStones + Number(house.resources.spirit_stones)).toBe(total);
    });

    it('hands over actual knowledge after arrival and keeps both hands present for the shared day', () => {
        const { state, house, seller, buyer } = arrangement();
        buyer.factionId = house.id;
        buyer.activity = { ...seller.activity!, sinceDay: 7, untilDay: 365 };
        const account = appendWorldFact(state, makeFact({ day: 3, kind: 'said_in_public', locationId: 'venue', visibility: 'secret',
            summary: 'The buyer owes a report.', actors: [{ id: seller.id, name: seller.name, role: 'heard it' }] }), { bystanders: false });
        buyer.locationId = 'seat';
        expect(theyAreRelieved(state, { relievedId: seller.id, replacementId: buyer.id, townId: 'venue', today: 7 })).toBe(false);
        buyer.locationId = 'venue';
        state.currentDay = 7;
        expect(whatOneOfTheWorldsOwnPeopleKnows(state)(buyer.id, 'event', account.id)).toBe('unaware');
        expect(theyAreRelieved(state, { relievedId: seller.id, replacementId: buyer.id, townId: 'venue', today: 7 })).toBe(true);
        expect(state.npcs[0]!.activity?.untilDay).toBe(8);
        expect(state.npcs.filter(n => n.locationId === 'venue')).toHaveLength(2);
        expect(whatOneOfTheWorldsOwnPeopleKnows(state)(buyer.id, 'event', account.id)).toBe(stageCeilingFor('told'));
        expect(theyAreRelieved(state, { relievedId: seller.id, replacementId: buyer.id, townId: 'venue', today: 7 })).toBe(false);
        const third = { ...setRealm(createNpc(state.seed, { id: 'third', locationId: 'venue', onDay: 14,
            bornOnDay: -30 * 365 }), 8, 14), factionId: house.id, activity: { ...buyer.activity!, sinceDay: 14 } };
        state.npcs.push(third);
        state.currentDay = 14;
        expect(theyAreRelieved(state, { relievedId: buyer.id, replacementId: third.id, townId: 'venue', today: 14 })).toBe(true);
        expect(whatOneOfTheWorldsOwnPeopleKnows(state)(third.id, 'event', account.id)).toBe(stageCeilingFor('told'));
        expect(state.history.facts.filter(f => f.data.postingHandover === true)).toHaveLength(2);
    });

    it('keeps internal entrants on the grounds and ranks only within their own realm', () => {
        const { state, house, seller, buyer } = arrangement();
        seller.locationId = buyer.locationId = 'seat';
        expect(enterAnOpenCompetition(state, house, buyer, 7, 0)).toBeNull();
        buyer.factionId = house.id;
        buyer.cultivation.realmOrdinal = 14;
        expect(enterAnOpenCompetition(state, house, seller, 7, 0)).not.toBeNull();
        expect(enterAnOpenCompetition(state, house, buyer, 7, 0)).not.toBeNull();
        const results = settleOpenCompetitions(state, 7, 7).filter(f => f.data.internalCompetition === true);
        expect(results).toHaveLength(2);
        expect(results.every(f => f.locationId === 'seat' && f.visibility === 'faction')).toBe(true);
        expect(new Set(results.map(f => f.data.bracket)).size).toBe(2);
        expect(results.every(f => f.data.place === 1)).toBe(true);
        const days = Array.from({ length: 28 }, (_, year) => theDayItFallsIn(state.seed, house, year)).filter(d => d !== null);
        expect(days).toHaveLength(4);
        expect(days.slice(1).every((day, i) => day! - days[i]! === 7 * 365)).toBe(true);
    });
});
