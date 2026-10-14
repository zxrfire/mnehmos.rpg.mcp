/**
 * A calendar invitation alone is not an auction or a contest. Closing must
 * transfer the existing lot and its price once, and a board must use entrants
 * physically attending that venue. Two venues may share a host and date.
 * These small arrangements pin money, provenance, attendance and house face;
 * the century census measures rates separately.
 */
import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeObject } from '../../../src/engine/world/possessions.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { bidAtCapitalAuction, capitalAuctionLots, consignCapitalAuction, settleCapitalAuctions } from '../../../src/engine/world/a-capital-auction.js';
import { enterAnOpenCompetition, settleOpenCompetitions } from '../../../src/engine/world/entering-an-open-competition.js';

function arrangement() {
    const state = createWorld({ seed: 'capital-ledger', regionCount: 0, skipPriorAges: true });
    state.locations.push(makeLocation({ id: 'seat', name: 'Grounds', kind: 'sect_seat' }),
        makeLocation({ id: 'venue', name: 'City', kind: 'settlement', tags: ['city'] }),
        makeLocation({ id: 'other', name: 'Other city', kind: 'settlement', tags: ['city'] }));
    const host = makeFaction({ id: 'host', name: 'Host', seatLocationId: 'seat' });
    state.factions.push(host, makeFaction({ id: 'guest', name: 'Guest', seatLocationId: 'seat' }));
    for (const [id, factionId] of [['seller', 'host'], ['buyer', 'guest'], ['absent', 'guest']] as const) {
        state.npcs.push({ ...setRealm(createNpc(state.seed, { id, name: id, locationId: id === 'absent' ? 'seat' : 'venue',
            bornOnDay: -20 * 365, onDay: 0 }), 8, 0), spiritStones: 1000, factionId });
    }
    return { state, host, seller: state.npcs[0]!, buyer: state.npcs[1]!, absent: state.npcs[2]! };
}
function lot(state: ReturnType<typeof arrangement>['state'], seller: ReturnType<typeof arrangement>['seller'], id: string) {
    state.objects.push(makeObject({ id, name: id, kind: 'material', ownerId: seller.id,
        ownerName: seller.name, possessorId: seller.id, locationId: 'venue' }));
    return appendWorldFact(state, makeFact({ day: 0, kind: 'gathering', summary: 'A lot was offered.', locationId: 'venue',
        data: { auctionLot: true, objectId: id, sellerId: seller.id, payeeId: seller.id, reserve: 100, closesOnDay: 7 } }));
}

describe('capital event ledgers', () => {
    it('rejects bids for missing, ruined or transferred goods and closes without new bids', () => {
        // A closing receipt must not invite new bids on goods the seller can no longer deliver.
        for (const unavailable of ['missing', 'ruined', 'transferred', 'missing-seller'] as const) {
            const { state, seller, buyer } = arrangement();
            const offered = lot(state, seller, 'cargo');
            if (unavailable === 'missing') state.objects = [];
            else if (unavailable === 'ruined') state.objects[0]!.tags.push('ruined');
            else if (unavailable === 'transferred') state.objects[0]!.possessorId = buyer.id;
            else state.npcs = state.npcs.filter(person => person.id !== seller.id);
            expect(bidAtCapitalAuction(state, buyer, 'venue', offered.id, 900, 0)).toBeNull();
            expect(settleCapitalAuctions(state, 7)).toHaveLength(1);
            expect(state.history.facts.some(fact => fact.data.auctionBid === true)).toBe(false);
            expect(state.npcs.every(person => person.spiritStones === 1000)).toBe(true);
            expect(settleCapitalAuctions(state, 8)).toEqual([]);
        }
    });

    it('conserves payment, transfers the tracked lot once and rejects an absent or unaffordable bidder', () => {
        const { state, seller, buyer, absent } = arrangement();
        const offered = lot(state, seller, 'cargo');
        expect(bidAtCapitalAuction(state, absent, 'venue', offered.id, 100, 0)).toBeNull();
        expect(bidAtCapitalAuction(state, buyer, 'venue', offered.id, 1001, 0)).toBeNull();
        expect(bidAtCapitalAuction(state, buyer, 'venue', offered.id, 900, 0)).not.toBeNull();
        const second = lot(state, seller, 'second-cargo');
        second.data.reserve = 200;
        expect(bidAtCapitalAuction(state, buyer, 'venue', second.id, 200, 0)).toBeNull();
        const results = settleCapitalAuctions(state, 7);
        const sold = results.find(f => f.data.lotId === offered.id)!;
        expect(sold.data).toMatchObject({ winnerId: buyer.id, stones: 900 });
        expect(state.npcs.find(n => n.id === buyer.id)!.spiritStones).toBe(100);
        expect(state.npcs.find(n => n.id === seller.id)!.spiritStones).toBe(1900);
        const cargo = state.objects.find(o => o.id === 'cargo')!;
        expect(cargo.ownerId).toBe(buyer.id);
        expect(cargo.possessorId).toBe(buyer.id);
        expect(cargo.provenance.at(-1)).toMatchObject({ how: 'bought', factId: sold.id });
        expect(capitalAuctionLots(state, 'venue', 7)).toEqual([]);
        expect(settleCapitalAuctions(state, 8)).toEqual([]);
    });

    it('consigns an existing personal surplus without duplicating it', () => {
        const { state, seller } = arrangement();
        state.objects.push(makeObject({ id: 'surplus', name: 'Qi Grass', kind: 'material', ownerId: seller.id,
            ownerName: seller.name, possessorId: seller.id, locationId: 'venue', data: { materialId: 'herb-qi-grass' } }));
        consignCapitalAuction(state, { venueId: 'venue', hostId: 'host', kind: 'auction', opensOnDay: 0, onDay: 4, endsOnDay: 7 });
        expect(capitalAuctionLots(state, 'venue', 0).some(f => f.data.objectId === 'surplus')).toBe(true);
        expect(state.objects.filter(o => o.id === 'surplus')).toHaveLength(1);
        expect(state.objects[0]!.ownerId).toBe(seller.id);
    });

    // Attendance is shared across simultaneous lots, but purchases must change
    // the next lot's affordability. A shared row snapshot would sell both.
    it('reads the current purse at each lot and uses each actual closing date', () => {
        const { state, seller, buyer } = arrangement();
        state.npcs = state.npcs.map(person => ({ ...person,
            spiritStones: person.id === buyer.id ? 100 : 0 }));
        const first = lot(state, seller, 'first');
        const second = lot(state, seller, 'second');
        appendWorldFact(state, makeFact({ day: 1, kind: 'gathering', locationId: 'venue', summary: 'First bid.',
            actors: [{ id: buyer.id, name: buyer.name, role: 'bidder' }],
            data: { auctionBid: true, lotId: first.id, stones: 100 } }), { recur: false });
        appendWorldFact(state, makeFact({ day: 1, kind: 'gathering', locationId: 'venue', summary: 'Second bid.',
            actors: [{ id: buyer.id, name: buyer.name, role: 'bidder' }],
            data: { auctionBid: true, lotId: second.id, stones: 100 } }), { recur: false });
        const results = settleCapitalAuctions(state, 7);
        expect(results.find(fact => fact.data.lotId === first.id)?.data.winnerId).toBe(buyer.id);
        expect(results.find(fact => fact.data.lotId === second.id)?.data.winnerId).toBeNull();
        expect(state.npcs.find(person => person.id === buyer.id)?.spiritStones).toBe(0);
    });

    it('keeps each owner’s eligible stock and reserve when unrelated objects are inserted', () => {
        const arrangeStock = (withUnrelated: boolean) => {
            const { state, seller, buyer, host } = arrangement();
            const add = (id: string, ownerId: string, possessorId: string | null, tags: string[] = ['exchange'],
                kind: 'material' | 'manual' = 'material', quantity = 1) => state.objects.push(makeObject({
                id, name: id, kind, ownerId, ownerName: ownerId, possessorId, locationId: 'venue', tags,
                data: { materialId: 'herb-qi-grass', quantity }
            }));
            if (withUnrelated) add('unrelated-before', 'nobody-here', null);
            add('host-first', host.id, seller.id, ['exchange'], 'material', 2);
            add('host-second', host.id, seller.id);
            add('host-ruined', host.id, seller.id, ['exchange', 'ruined']);
            add('host-manual', host.id, seller.id, ['exchange'], 'manual');
            add('host-active', host.id, seller.id);
            if (withUnrelated) add('unrelated-middle', 'nobody-here', null);
            add('guest-first', 'guest', buyer.id);
            add('guest-second', 'guest', buyer.id, ['exchange'], 'material', 3);
            add('guest-away', 'guest', 'absent');
            add('personal', seller.id, seller.id, []);
            const active = appendWorldFact(state, makeFact({ day: 0, kind: 'gathering',
                summary: 'The earlier lot is still open.', locationId: 'venue',
                data: { auctionLot: true, objectId: 'host-active', sellerId: seller.id,
                    payeeId: host.id, reserve: 50, closesOnDay: 7 } }));
            consignCapitalAuction(state, { venueId: 'venue', hostId: host.id, kind: 'auction',
                opensOnDay: 0, onDay: 4, endsOnDay: 7 });
            const newLots = capitalAuctionLots(state, 'venue', 0).filter(f => f.id !== active.id);
            return new Map(newLots.map(f => [String(f.data.payeeId),
                { objectId: f.data.objectId, reserve: f.data.reserve }]));
        };
        const baseline = arrangeStock(false);
        expect([...baseline.keys()].sort()).toEqual(['guest', 'host', 'seller']);
        expect(['host-first', 'host-second']).toContain(baseline.get('host')!.objectId);
        expect(['guest-first', 'guest-second']).toContain(baseline.get('guest')!.objectId);
        expect(baseline.get('seller')!.objectId).toBe('personal');
        expect([...baseline.values()].every(lot => Number(lot.reserve) > 0)).toBe(true);
        expect(arrangeStock(true)).toEqual(baseline);
    });

    it('keeps simultaneous venues separate, excludes absentees and gives the winning house face', () => {
        const { state, host, seller, buyer, absent } = arrangement();
        enterAnOpenCompetition(state, host, seller, 7, 0, 'venue');
        enterAnOpenCompetition(state, host, buyer, 7, 0, 'venue');
        enterAnOpenCompetition(state, host, absent, 7, 0, 'venue');
        enterAnOpenCompetition(state, host, absent, 7, 0, 'other');
        const before = state.npcs.reduce((sum, n) => sum + (n.face ?? 0), 0);
        const results = settleOpenCompetitions(state, 7, 7);
        expect(results.filter(f => f.data.venueId === 'venue' && typeof f.data.place === 'number')).toHaveLength(2);
        expect(results.some(f => f.data.venueId === 'other' && f.data.absent === true)).toBe(true);
        expect(results.find(f => f.data.venueId === 'venue' && f.actors[0]?.id === absent.id)!.data.absent).toBe(true);
        expect(state.npcs.reduce((sum, n) => sum + (n.face ?? 0), 0)).toBeGreaterThan(before);
        expect(settleOpenCompetitions(state, 7, 7)).toEqual([]);
    });
});
