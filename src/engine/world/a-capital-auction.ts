/** Auction lots are existing possessions; bids, payment and departures stay in the ledger. */
import { forStream } from '../cultivation/rng.js';
import { pillCashPrice } from '../cultivation/buying-and-bartering-pills.js';
import { getPill } from '../../data/cultivation/pills.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { whetherItLeavesTheStore } from '../social-leverage/who-has-to-agree-before-it-leaves-the-store.js';
import { whereInTheHouseItSits } from './what-a-house-keeps-in-its-treasury.js';
import { whatThisThingIs } from './what-a-house-gives-merit-for.js';
import { whatThisPersonWouldPartWith } from './what-somebody-standing-here-would-part-with.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { inOneScene } from './how-far-a-seeing-reaches.js';
import { factsWithDataValue, pendingAuctionLots, witnessIndexFor } from './witness-reaction-index.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { isRuined, transferPossession, type ObjectRecord } from './possessions.js';
import type { CapitalOccasion } from './capital-missions-and-calendar.js';
import type { WorldState } from './world-state.js';
import { getNpc, getObject, indexById } from './world-state.js';
import { locationOfNpcOnItsJourney } from './places-on-the-way.js';
import { routeQueriesFor } from './locations.js';
import { drawBackgroundIncidents, isPlayerInvolved } from './background-incident-draw.js';
import { theGradeItWasMadeAt } from './a-house-mends-what-it-owns.js';
import { whatACommissionComesTo } from '../social-leverage/commissioning-a-craft.js';
import { isAVehicle } from './a-vehicle.js';
import { isAStorageRing } from './a-storage-ring.js';

function saleValue(object: ObjectRecord): number | null {
    if (isRuined(object) || object.kind === 'manual') return null;
    if (object.kind === 'artifact' && !isAVehicle(object))
        return whatACommissionComesTo(theGradeItWasMadeAt(object), isAStorageRing(object), object.power ?? undefined);
    const thing = whatThisThingIs(object);
    if (!thing || thing.marketStones === null) return null;
    const pill = object.kind === 'pill' ? getPill(thing.kindId) : undefined;
    if (object.kind === 'pill' && (!pill || pillCashPrice(pill) === null)) return null;
    return Math.max(1, Math.round(thing.marketStones * thing.quantity));
}

/** Unsettled catalogue rows are the only lot store. A read never creates stock. */
export function capitalAuctionLots(state: WorldState, venueId: string, day: number): HistoricalFact[] {
    return pendingAuctionLots(state, venueId).filter(f => f.day <= day && Number(f.data.closesOnDay) >= day);
}

function theLotIsStillHeld(object: ObjectRecord | undefined, lot: HistoricalFact, seller: NpcRecord | undefined): boolean {
    return seller !== undefined && object !== undefined && !isRuined(object) && object.possessorId === seller.id
        && object.ownerId === lot.data.payeeId;
}

/** The ordinary store approval releases house property; a personal owner decides by their ordinary sale read. */
export function consignCapitalAuction(state: WorldState, occasion: CapitalOccasion,
    day = occasion.opensOnDay): void {
    const venue = state.locations.find(l => l.id === occasion.venueId);
    if (!venue) return;
    const holder = state.factions.find(h => h.id === occasion.hostId);
    const routes = routeQueriesFor(state.locations);
    const present = state.npcs.filter(n => n.status === 'alive' && isTheWorldsToMove(n)
        && locationOfNpcOnItsJourney(state, n, day, routes) === venue.id);
    const distant = present.filter(person => !isPlayerInvolved(state, person));
    const selected = new Set((distant.length <= 4 ? distant : drawBackgroundIncidents(
        distant.map(value => ({ value, rate: 1 })), forStream(state.seed, 'background-auction-sellers', venue.id, day), 4))
        .map(person => person.id));
    const here = present.filter(person => selected.has(person.id) || isPlayerInvolved(state, person));
    const activeObjects = new Set(pendingAuctionLots(state).map(f => String(f.data.objectId)));
    const houseSellers = new Map<string, NpcRecord>();
    for (const seller of here) if (seller.factionId && !houseSellers.has(seller.factionId)) {
        houseSellers.set(seller.factionId, seller);
    }
    const personalSellers = new Set(here.map(seller => seller.id));
    const houseStock = new Map<string, { object: ObjectRecord; reserve: number }[]>();
    const personalStock = new Map<string, { object: ObjectRecord; reserve: number }[]>();
    for (const object of state.objects) {
        if (activeObjects.has(object.id)) continue;
        const houseSeller = object.ownerId ? houseSellers.get(object.ownerId) : undefined;
        const houseCanOffer = houseSeller && (object.possessorId === null && object.locationId === venue.id
            || object.possessorId === houseSeller.id && object.tags.includes('exchange'));
        const personalCanOffer = object.ownerId !== null && object.ownerId === object.possessorId
            && personalSellers.has(object.ownerId);
        if (!houseCanOffer && !personalCanOffer) continue;
        const reserve = saleValue(object);
        if (reserve === null) continue;
        if (houseCanOffer) {
            const stock = houseStock.get(object.ownerId!) ?? [];
            stock.push({ object, reserve }); houseStock.set(object.ownerId!, stock);
        }
        if (personalCanOffer) {
            const stock = personalStock.get(object.ownerId!) ?? [];
            stock.push({ object, reserve }); personalStock.set(object.ownerId!, stock);
        }
    }
    const consign = (seller: NpcRecord, ownerId: string, objectId: string, reserve: number) => {
        const at = state.objects.findIndex(o => o.id === objectId);
        if (at < 0 || activeObjects.has(objectId)) return;
        const object = state.objects[at]!;
        const fact = appendWorldFact(state, makeFact({ day, kind: 'gathering',
            visibility: 'public', locationId: venue.id,
            summary: `${object.name} is entered in the ${venue.name} auction${holder ? ` under the ${holder.name}'s witness` : ''} at a reserve of ${reserve} spirit stones.`,
            actors: [{ id: seller.id, name: seller.name, role: 'seller' }],
            factionIds: seller.factionId ? [seller.factionId] : [], data: { auctionLot: true,
                objectId, sellerId: seller.id, payeeId: ownerId, reserve, closesOnDay: occasion.endsOnDay } }));
        state.objects[at] = { ...transferPossession(object, { onDay: day,
            toHolderId: seller.id, toHolderName: seller.name, how: 'lent', transfersOwnership: false,
            source: object.ownerName, factId: fact.id, note: 'Consigned for auction; unsold property returns.' }), locationId: venue.id };
        activeObjects.add(objectId);
    };
    for (const house of state.factions) {
        const seller = houseSellers.get(house.id);
        if (!seller || house.dissolvedOnDay !== null) continue;
        const stock = (houseStock.get(house.id) ?? []).filter(row => !activeObjects.has(row.object.id));
        const rng = forStream(state.seed, 'auction-consignment', venue.id, occasion.onDay, house.id);
        if (!stock.length) continue;
        const { object, reserve } = stock[rng.int(0, stock.length - 1)]!;
        const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id)
            .map(n => ({ id: n.id, rankIndex: n.factionRankIndex }));
        const allowed = whetherItLeavesTheStore({ significance: object.significance, meaning: 'pass_it_on',
            room: whereInTheHouseItSits(object.kind, object.significance, object.tags),
            portfolios: portfoliosIn({ locations: state.locations, sectId: house.id, roll, rankCount: house.ranks.length }),
            roll, rankCount: house.ranks.length, askerId: seller.id, asOfDay: day });
        if (allowed.allowed || object.tags.includes('exchange') && object.possessorId === seller.id) consign(seller, house.id, object.id, reserve);
    }
    for (const seller of here) {
        const holding = (personalStock.get(seller.id) ?? []).filter(row => !activeObjects.has(row.object.id));
        const read = whatThisPersonWouldPartWith({ id: seller.id, name: seller.name,
            ordinal: seller.cultivation.realmOrdinal, spiritStones: seller.spiritStones, factionId: seller.factionId },
        holding.map(({ object, reserve }) => ({ id: object.id, name: object.name,
            usableFrom: object.power ?? 0, usefulUntil: object.power ?? 0,
            listStones: reserve, awkwardToHold: 0, whoWouldWantAWord: null, copyable: false })));
        const offer = read.offers[0];
        if (offer) consign(seller, seller.id, offer.thingId, offer.askStones);
    }
}

/** NPCs and the player submit the same bid, checked against presence and their real purse. */
export function bidAtCapitalAuction(state: WorldState, bidder: NpcRecord, venueId: string,
    lotId: string, stones: number, day: number, playerLocationId?: string | null,
    positions?: ReadonlyMap<string, string | null>): HistoricalFact | null {
    if (!Number.isSafeInteger(stones) || stones <= 0 || bidder.status !== 'alive'
        || (isTheWorldsToMove(bidder)
            ? positions?.has(bidder.id) ? positions.get(bidder.id) : locationOfNpcOnItsJourney(state, bidder, day)
            : playerLocationId) !== venueId) return null;
    const index = witnessIndexFor(state);
    const lot = index.byId.get(lotId);
    if (!lot || !index.openAuctionLots.has(lot) || lot.locationId !== venueId
        || !(lot.day <= day && Number(lot.data.closesOnDay) >= day)
        || bidder.id === lot.data.sellerId || bidder.id === lot.data.payeeId
        || stones < Number(lot.data.reserve) || stones > bidder.spiritStones) return null;
    if (!theLotIsStillHeld(typeof lot.data.objectId === 'string' ? getObject(state, lot.data.objectId) ?? undefined : undefined, lot,
        typeof lot.data.sellerId === 'string' ? getNpc(state, lot.data.sellerId) ?? undefined : undefined)) return null;
    const bids = factsWithDataValue(state, 'lotId', lotId).filter(f => f.data.auctionBid === true);
    if (bids.some(f => Number(f.data.stones) >= stones)) return null;
    const committed = new Map<string, number>();
    for (const fact of index.factsByPerson.get(bidder.id) ?? []) {
        if (fact.data.auctionBid !== true || fact.actors[0]?.id !== bidder.id || fact.data.lotId === lotId) continue;
        const other = index.byId.get(String(fact.data.lotId));
        if (!other || !index.openAuctionLots.has(other) || !(Number(other.data.closesOnDay) >= day)) continue;
        committed.set(String(fact.data.lotId), Math.max(committed.get(String(fact.data.lotId)) ?? 0, Number(fact.data.stones)));
    }
    if (stones + [...committed.values()].reduce((s, n) => s + n, 0) > bidder.spiritStones) return null;
    return appendWorldFact(state, makeFact({ day, kind: 'gathering', locationId: venueId,
        visibility: 'public', summary: `${bidder.name} bid ${stones} spirit stones for the auction lot.`,
        actors: [{ id: bidder.id, name: bidder.name, role: 'bidder' }],
        data: { auctionBid: true, lotId, stones } }));
}

/** Once at closing: real bids, conserved purses and the ordinary possession transfer. */
export function settleCapitalAuctions(state: WorldState, day: number,
    playerAt?: { id: string; locationId: string | null }): HistoricalFact[] {
    return inOneScene(() => settleThem(state, day, playerAt));
}

function settleThem(state: WorldState, day: number,
    playerAt?: { id: string; locationId: string | null }): HistoricalFact[] {
    const results: HistoricalFact[] = [];
    // Settlement changes no player's identity, location, activity or goals.
    // Reuse the existing involvement read within this settlement only.
    const involvement = new Map<string, boolean>();
    const playerInvolved = (person: NpcRecord): boolean => {
        if (!involvement.has(person.id)) involvement.set(person.id, isPlayerInvolved(state, person));
        return involvement.get(person.id)!;
    };
    const positionsByDay = new Map<number, Map<string, string | null>>();
    const routes = routeQueriesFor(state.locations);
    const positionOn = (npc: NpcRecord, onDay: number): string | null => {
        let positions = positionsByDay.get(onDay);
        if (!positions) { positions = new Map(); positionsByDay.set(onDay, positions); }
        // Somebody with no activity is where their row says (`projectNpcJourney` returns it); only a
        // person who is doing something can be somewhere else on the day, so only they are projected.
        if (!positions.has(npc.id)) positions.set(npc.id, npc.activity
            ? locationOfNpcOnItsJourney(state, npc, onDay, routes) : npc.locationId);
        return positions.get(npc.id) ?? null;
    };
    const lots = pendingAuctionLots(state).filter(f => Number(f.data.closesOnDay) <= day);
    const presentObjectIds = new Set(state.objects.map(object => object.id));
    // Only purses, history links and custody change during settlement. Keep
    // attendance positions for this call; refresh each attendee's row per lot
    // so one purchase changes what they can afford at the next closing.
    const attendanceByDay = new Map<number, Map<string | null, number[]>>();
    const attending = (onDay: number, venue: string | null): NpcRecord[] => {
        let attendance = attendanceByDay.get(onDay);
        if (!attendance) {
            attendance = new Map();
            for (let at = 0; at < state.npcs.length; at++) {
                const npc = state.npcs[at]!;
                if (npc.status !== 'alive') continue;
                const place = npc.id === playerAt?.id ? playerAt.locationId : positionOn(npc, onDay);
                const rows = attendance.get(place) ?? [];
                rows.push(at); attendance.set(place, rows);
            }
            attendanceByDay.set(onDay, attendance);
        }
        return (attendance.get(venue) ?? []).map(at => state.npcs[at]!);
    };
    for (const lot of lots) {
        const closes = Number(lot.data.closesOnDay);
        const bids = factsWithDataValue(state, 'lotId', lot.id).filter(f => f.data.auctionBid === true);
        if (!playerAt && bids.some(f => f.actors.some(a => {
            const npc = getNpc(state, a.id);
            return npc !== null && !isTheWorldsToMove(npc);
        }))) continue;
        const objectAt = typeof lot.data.objectId === 'string' && presentObjectIds.has(lot.data.objectId)
            ? indexById(state.objects, lot.data.objectId) : -1;
        const object = state.objects[objectAt];
        const seller = typeof lot.data.sellerId === 'string' ? getNpc(state, lot.data.sellerId) : null;
        const available = theLotIsStillHeld(object, lot, seller ?? undefined);
        const participants = available ? attending(closes, lot.locationId) : [];
        const previous = Math.max(Number(lot.data.reserve) - 1, ...bids.map(b => Number(b.data.stones)));
        const possible = participants.filter(isTheWorldsToMove);
        const distant = possible.filter(person => !playerInvolved(person));
        const selected = new Set((distant.length <= 4 ? distant : drawBackgroundIncidents(
            distant.map(value => ({ value, rate: 1 })), forStream(state.seed, 'background-auction-bidders', lot.id), 4))
            .map(person => person.id));
        for (const npc of possible.filter(person => selected.has(person.id) || playerInvolved(person))) {
            if (npc.id === lot.data.sellerId || npc.id === lot.data.payeeId) continue;
            const rng = forStream(state.seed, 'auction-bid', lot.id, npc.id);
            const interested = npc.goals.some(g => g.status === 'active'
                && (g.targetId === object?.id || g.kind === 'wealth' || g.kind === 'cultivation'));
            if (!rng.chance(interested ? 0.65 : 0.35)) continue;
            const ceiling = Math.floor(Number(lot.data.reserve) * rng.float(1, interested ? 1.8 : 1.3));
            const amount = Math.min(npc.spiritStones, ceiling);
            if (amount <= previous) continue;
            // Settlement changes purses and objects, but never a person's position or the clock.
            const bid = bidAtCapitalAuction(state, npc, lot.locationId!, lot.id, amount, closes,
                undefined, positionsByDay.get(closes));
            if (bid) bids.push(bid);
        }
        const valid = available
            ? bids.sort((a, b) => Number(b.data.stones) - Number(a.data.stones) || a.id.localeCompare(b.id))
                .find(b => participants.some(n => n.id === b.actors[0]?.id && n.spiritStones >= Number(b.data.stones))) : undefined;
        const winner = valid ? participants.find(n => n.id === valid.actors[0]?.id) : undefined;
        const stones = winner && valid ? Number(valid.data.stones) : 0;
        const name = object?.name ?? 'The withdrawn lot';
        const fact = appendWorldFact(state, makeFact({ day: closes, kind: 'gathering', visibility: 'public',
            scale: 'regional', magnitude: 0.4, locationId: lot.locationId,
            summary: winner ? `${name} sold to ${winner.name} for ${stones} spirit stones.` : `${name} was not sold.`,
            actors: [...(seller ? [{ id: seller.id, name: seller.name, role: 'seller' }] : []),
                ...(winner ? [{ id: winner.id, name: winner.name, role: 'buyer' }] : [])],
            factionIds: [...new Set(participants.map(n => n.factionId).filter((id): id is string => id !== null))],
            data: { auctionResult: true, lotId: lot.id, objectId: String(lot.data.objectId), stones,
                winnerId: winner?.id ?? null, sellerId: seller?.id ?? null, payeeId: lot.data.payeeId,
                stintDay: seller?.activity?.sinceDay ?? null } }));
        results.push(fact);
        if (winner && object) {
            const at = indexById(state.npcs, winner.id);
            state.npcs[at] = { ...state.npcs[at]!, spiritStones: state.npcs[at]!.spiritStones - stones };
            const house = state.factions.find(h => h.id === lot.data.payeeId);
            if (house && seller) {
                const sellerAt = indexById(state.npcs, seller.id);
                state.npcs[sellerAt] = { ...state.npcs[sellerAt]!, spiritStones: state.npcs[sellerAt]!.spiritStones + stones };
            }
            else {
                const payeeAt = typeof lot.data.payeeId === 'string' ? indexById(state.npcs, lot.data.payeeId) : -1;
                if (payeeAt >= 0) state.npcs[payeeAt] = { ...state.npcs[payeeAt]!, spiritStones: state.npcs[payeeAt]!.spiritStones + stones };
            }
            state.objects[objectAt] = { ...transferPossession(object, { onDay: closes, toHolderId: winner.id,
                toHolderName: winner.name, how: 'bought', transfersOwnership: true,
                source: seller?.name ?? object.ownerName, factId: fact.id }), locationId: lot.locationId };
        } else if (object && object.possessorId === seller?.id && object.ownerId === lot.data.payeeId && lot.data.payeeId !== seller?.id && !object.tags.includes('exchange')) {
            const house = state.factions.find(h => h.id === lot.data.payeeId);
            state.objects[objectAt] = { ...transferPossession(object, { onDay: closes, toHolderId: null,
                toHolderName: house?.name ?? object.ownerName, how: 'lent', transfersOwnership: false,
                source: seller?.name, factId: fact.id, note: 'Unsold consignment returned.' }),
                locationId: house?.seatLocationId ?? object.locationId };
        }
    }
    return results;
}
