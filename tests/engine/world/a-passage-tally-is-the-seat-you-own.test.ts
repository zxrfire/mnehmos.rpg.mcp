/**
 * The owner ruled that a passage tally is a tracked physical seat, issued
 * after purchase, transferable as an ordinary possession and deleted at
 * boarding. Hand-in first transfers it to a living receiver actually present,
 * then deletes their physical item. An unused tally crumbles only when its actual departure leaves.
 * These controls arrange accepted purchase receipts and exercise the item
 * lifecycle. Public buying, later departures and resale decisions remain
 * separate unfinished work; the fixtures do not claim to play those actions.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as possessions from '../../../src/engine/world/possessions.js';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import { makeLocation, linkLocations } from '../../../src/engine/world/locations.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { transferPossession } from '../../../src/engine/world/possessions.js';
import { makePassageTally, passageTallyTerms, handInPassageTally, theHeldPassageTally,
    unusedPassageTalliesGoToDust, whatStopsHandingInPassageTally, type PassageTallyTerms }
    from '../../../src/engine/world/a-passage-tally-is-the-seat-you-own.js';
import { quotePublicCarriage, commitPublicCarriage, carriageIdForRoad }
    from '../../../src/engine/world/public-carriages.js';
import { recordPublicPassage, publicShipLinesFrom, quotePublicPassage }
    from '../../../src/engine/world/public-shipping.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { bookNpcPassageForRoute } from '../../../src/engine/world/places-on-the-way.js';
import { commitNpcPublicPassage } from '../../../src/engine/world/ship-crew.js';
import { routineTime } from '../../../src/engine/world/npc-routines.js';
import { resolveWithPlayerPresent } from '../../../src/engine/world/background-incident-draw.js';
import { theAreasOf } from '../../../src/engine/world/where-in-a-place-somebody-is-standing.js';

function arrangement() {
    const state = createWorld({ seed: 'physical-passage-tallies', regionCount: 0, skipPriorAges: true });
    const now = routineTime(state);
    state.locations.push(makeLocation({ id: 'reed', name: 'Reed Station', kind: 'settlement' }),
        makeLocation({ id: 'stone', name: 'Stone Station', kind: 'settlement' }));
    linkLocations(state.locations[0]!, state.locations[1]!, 'road', 2);
    const buyer = createNpc(state.seed, { id: 'buyer', name: 'Buyer', locationId: 'reed',
        bornOnDay: -7300, onDay: 0 });
    const passenger = createNpc(state.seed, { id: 'passenger', name: 'Passenger', locationId: 'reed',
        bornOnDay: -7300, onDay: 0 });
    const receiver = createNpc(state.seed, { id: 'receiver', name: 'Receiver', locationId: 'reed',
        occupation: 'carter', bornOnDay: -7300, onDay: 0 });
    state.npcs.push(buyer, passenger, receiver);
    const terms: PassageTallyTerms = { service: 'carriage', fromId: 'reed', toId: 'stone',
        vesselId: carriageIdForRoad('reed', 'stone', 'conv-carriage-mortal'), departureDay: now,
        seat: 1, fareStones: 3 };
    const issue = (holder = buyer, override: Partial<PassageTallyTerms> = {}) => {
        const accepted = { ...terms, ...override };
        const purchase = appendWorldFact(state, makeFact({ day: now, kind: 'gathering',
            summary: 'The accepted passage seat was bought.',
            actors: [{ id: holder.id, name: holder.name, role: 'buyer' }],
            data: { passageTallyPurchase: true, service: accepted.service,
                vesselId: accepted.vesselId, fromLocationId: accepted.fromId, toLocationId: accepted.toId,
                departureDay: accepted.departureDay, seat: accepted.seat, fareStones: accepted.fareStones } }),
            { bystanders: false, recur: false });
        const tally = makePassageTally({ terms: accepted, buyer: holder, fromName: 'Reed Station',
            toName: 'Stone Station', onDay: now, purchase });
        state.objects.push(tally);
        return tally;
    };
    return { state, buyer, passenger, receiver, terms, issue };
}

afterEach(() => vi.restoreAllMocks());

describe('the passage tally is the physical seat', () => {
    it('states its accepted route, departure and seat in one carried tracked item', () => {
        const h = arrangement();
        const tally = h.issue();
        expect(tally.kind).toBe('token');
        expect(tally.ownerId).toBe(h.buyer.id);
        expect(tally.possessorId).toBe(h.buyer.id);
        expect(tally.name).toContain('Reed Station to Stone Station');
        expect(passageTallyTerms(tally)).toEqual(h.terms);
    });

    it('lets the current holder hand it in after an ordinary gift', () => {
        const h = arrangement();
        const tally = h.issue();
        h.state.objects[0] = transferPossession(tally, { onDay: 0, toHolderId: h.passenger.id,
            toHolderName: h.passenger.name, how: 'gifted', transfersOwnership: true });
        expect(theHeldPassageTally(h.state, h.buyer.id, h.terms)).toBeNull();
        const handover = vi.spyOn(possessions, 'transferPossession');
        expect(handInPassageTally(h.state, h.passenger.id, h.terms, h.receiver.id)).toEqual(h.terms);
        const handed = handover.mock.results[0]!.value;
        expect(handed.id).toBe(tally.id);
        expect(handed.possessorId).toBe(h.receiver.id);
        expect(handed.provenance.at(-1).previousHolderId).toBe(h.passenger.id);
        expect(h.state.objects.some(o => o.id === tally.id)).toBe(false);
        expect(h.state.objects.some(o => o.id === tally.id && o.possessorId === h.receiver.id)).toBe(false);
        expect(handInPassageTally(h.state, h.passenger.id, h.terms, h.receiver.id)).toBeNull();
    });

    it('reads custody rather than the original owner after theft', () => {
        const h = arrangement();
        const tally = h.issue();
        h.state.objects[0] = transferPossession(tally, { onDay: 0, toHolderId: h.passenger.id,
            toHolderName: h.passenger.name, how: 'stolen', transfersOwnership: false });
        expect(h.state.objects[0]!.ownerId).toBe(h.buyer.id);
        expect(handInPassageTally(h.state, h.passenger.id, h.terms, h.receiver.id)).toEqual(h.terms);
    });

    it('does not hand another holder or departure the same seat', () => {
        const h = arrangement();
        const tally = h.issue();
        expect(handInPassageTally(h.state, h.passenger.id, h.terms, h.receiver.id)).toBeNull();
        expect(handInPassageTally(h.state, h.buyer.id, { ...h.terms, departureDay: 1 }, h.receiver.id)).toBeNull();
        expect(h.state.objects.some(o => o.id === tally.id)).toBe(true);
    });

    it('keeps the tally when no real living receiver is at this departure', () => {
        const h = arrangement();
        const tally = h.issue();
        expect(whatStopsHandingInPassageTally(h.state, h.buyer.id, h.terms, null))
            .toBe('Nobody is here to receive that passage tally.');
        expect(handInPassageTally(h.state, h.buyer.id, h.terms, null)).toBeNull();
        h.receiver.locationId = 'stone';
        expect(whatStopsHandingInPassageTally(h.state, h.buyer.id, h.terms, h.receiver.id))
            .toBe('The person receiving that passage tally is not at this departure.');
        expect(handInPassageTally(h.state, h.buyer.id, h.terms, h.receiver.id)).toBeNull();
        h.receiver.locationId = 'reed';
        h.receiver.status = 'physically_dead';
        expect(handInPassageTally(h.state, h.buyer.id, h.terms, h.receiver.id)).toBeNull();
        expect(h.state.objects.find(o => o.id === tally.id)?.possessorId).toBe(h.buyer.id);
    });

    it('keeps a tally past its printed day until the actual departure leaves', () => {
        const h = arrangement();
        const tally = h.issue();
        h.state.currentDay = 2;
        expect(theHeldPassageTally(h.state, h.buyer.id, h.terms)?.id).toBe(tally.id);
        unusedPassageTalliesGoToDust(h.state, h.terms, 2);
        expect(h.state.objects.some(o => o.id === tally.id)).toBe(false);
        const missed = h.state.history.facts.find(f => f.data.missedDeparture === true)!;
        expect(missed.day).toBe(2);
        expect(missed.actors.some(a => a.id === h.buyer.id)).toBe(true);
        expect(missed.data.costStones).toBe(h.terms.fareStones);
    });

    it('expires only this departure and records the actual holder once', () => {
        const h = arrangement();
        const tally = h.issue();
        const later = h.issue(h.buyer, { departureDay: 2, seat: 2 });
        h.state.objects[0] = transferPossession(tally, { onDay: 0, toHolderId: h.passenger.id,
            toHolderName: h.passenger.name, how: 'gifted', transfersOwnership: true });
        unusedPassageTalliesGoToDust(h.state, h.terms, h.terms.departureDay);
        expect(h.state.objects.map(o => o.id)).toEqual([later.id]);
        const missed = h.state.history.facts.filter(f => f.data.missedDeparture === true);
        expect(missed).toHaveLength(1);
        expect(missed[0]!.actors.map(a => a.id)).toEqual([h.passenger.id]);
        expect(missed[0]!.data.costStones).toBe(0);
        unusedPassageTalliesGoToDust(h.state, h.terms, h.terms.departureDay);
        expect(h.state.history.facts.filter(f => f.data.missedDeparture === true)).toHaveLength(1);
    });

    it('hands in the boarding passenger tally and dusts the unused one on a real carriage departure', () => {
        const h = arrangement();
        const unused = h.issue();
        const boarded = h.issue(h.passenger, { seat: 2 });
        const quote = quotePublicCarriage(h.state, { fromId: 'reed', toId: 'stone', day: h.terms.departureDay,
            conveyanceId: 'conv-carriage-mortal', passengerIds: [h.passenger.id], fareStones: 3, hired: false });
        expect(quote).not.toBeNull();
        expect(commitPublicCarriage(h.state, quote!)).not.toBeNull();
        expect(h.state.objects.some(o => o.id === unused.id || o.id === boarded.id)).toBe(false);
        const missed = h.state.history.facts.filter(f => f.data.missedDeparture === true);
        expect(missed.map(f => f.data.tokenId)).toEqual([unused.id]);
    });

    it('uses actual ship boarding, rather than a historic booking, as the trigger', async () => {
        const state = seedWorld({ seed: 'tally-actual-public-ship',
            catalog: await loadCultivationCatalog(), presentYear: 0 }).state;
        const from = state.locations.find(p => p.name === 'Emerald Water City')!;
        const line = publicShipLinesFrom(state, from.name, state.currentDay).find(l => l.runsFromDay === null)!;
        const to = state.locations.find(p => p.name === line.to)!;
        const quote = quotePublicPassage(state, from.id, to.id, routineTime(state))!;
        expect(quote).not.toBeNull();
        const holder = createNpc(state.seed, { id: 'absent-tally-holder', locationId: from.id,
            onDay: state.currentDay, bornOnDay: state.currentDay - 25 * 365 });
        const passenger = { ...createNpc(state.seed, { id: 'boarding-passenger', locationId: from.id,
            onDay: state.currentDay, bornOnDay: state.currentDay - 25 * 365 }), spiritStones: 100_000 };
        passenger.activity = { kind: 'idle', note: 'Waiting at the landing to buy a berth.', withIds: [],
            sinceDay: quote.departureDay, untilDay: quote.departureDay + 1,
            standingIn: theAreasOf(state, from).areas.find(area => area.for === 'landing')!.id };
        state.npcs.push(holder, passenger);
        const terms: PassageTallyTerms = { service: 'ship', ...quote, seat: 1 };
        const purchase = appendWorldFact(state, makeFact({ day: state.currentDay, kind: 'gathering',
            summary: 'An accepted ship seat was bought.', actors: [{ id: holder.id, name: holder.name, role: 'buyer' }],
            data: { passageTallyPurchase: true, service: 'ship', vesselId: quote.vesselId,
                fromLocationId: from.id, toLocationId: to.id, departureDay: quote.departureDay,
                seat: 1, fareStones: quote.fareStones } }), { bystanders: false, recur: false });
        const tally = makePassageTally({ terms, buyer: holder, fromName: from.name, toName: to.name,
            onDay: state.currentDay, purchase });
        state.objects.push(tally);
        recordPublicPassage(state, quote);
        expect(state.objects.some(o => o.id === tally.id)).toBe(true);
        const accepted = resolveWithPlayerPresent(state, from.id, () => bookNpcPassageForRoute(state,
            passenger, to.id, quote.departureDay, 'Taking the actual public ship passage.'));
        expect(accepted).not.toBeNull();
        state.npcs[state.npcs.findIndex(n => n.id === passenger.id)] = accepted!;
        expect(commitNpcPublicPassage(state, accepted!)).toBe(true);
        expect(state.objects.some(o => o.id === tally.id)).toBe(false);
    });
});
