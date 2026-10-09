/** A travelling counter carries finite house goods and returns with its receipts. */
import { waresMadeBy } from '../../data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { getPill } from '../../data/cultivation/pills.js';
import { pillCashPrice } from '../cultivation/buying-and-bartering-pills.js';
import { whatAnIngredientIs } from '../cultivation/what-a-cauldron-will-take.js';
import { forStream } from '../cultivation/rng.js';
import { quoteSale } from '../cultivation/market.js';
import { localPrice, regionIdOfPlace, whatKindOfPlace } from '../../data/cultivation/regions.js';
import { makeObject, transferPossession, isRuined, type ObjectRecord } from './possessions.js';
import { whatThisThingIs } from './what-a-house-gives-merit-for.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue, pendingAuctionLots, witnessIndexFor } from './witness-reaction-index.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import type { AnOfferStandingHere } from './what-somebody-standing-here-would-part-with.js';
import type { WorldState } from './world-state.js';
import { locationOnNpcJourney } from './places-on-the-way.js';
import { routeQueriesFor, type RouteQueries } from './locations.js';
import { drawBackgroundIncidents, isPlayerInvolved } from './background-incident-draw.js';

/** A dispatch buys one consignment; looking never restocks a counter. */
export function loadExchangeConsignment(state: WorldState, seller: NpcRecord, day: number, routes?: RouteQueries): void {
    const house = state.factions.find(h => h.id === seller.factionId);
    if (!house || !seller.activity || !seller.locationId) return;
    const ground = locationOnNpcJourney(state.locations, seller, day, routes);
    if (!ground) return;
    const mission=seller.activity.capitalMissionId?witnessIndexFor(state).byId.get(seller.activity.capitalMissionId):undefined;
    const destinationId=typeof mission?.data.destinationId==='string'?mission.data.destinationId:seller.locationId;
    const destination = state.locations.find(l => l.id === destinationId)?.name ?? destinationId;
    const rng = forStream(state.seed, 'exchange-consignment', house.id, seller.id, day);
    const wares = [...waresMadeBy(house.id)].sort((a, b) =>
        forStream(state.seed, 'exchange-ware', seller.id, day, a).next()
        - forStream(state.seed, 'exchange-ware', seller.id, day, b).next()).slice(0, rng.int(1, 3));
    for (const id of wares) {
        const objectId = `exchange:${seller.id}:${day}:${id}`;
        if (state.objects.some(o => o.id === objectId)) continue;
        const ingredient = whatAnIngredientIs(id);
        const pill = getPill(id);
        const price = ingredient?.value ?? (pill ? pillCashPrice(pill) : null);
        if (price == null || price <= 0) continue;
        const purse = Number(house.resources.spirit_stones ?? 0);
        if (purse < price) continue;
        house.resources.spirit_stones = purse - price;
        const name = ingredient?.name ?? pill!.name;
        const fact = appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: 'faction',
            summary: `${house.name} loaded ${name} for ${destination}.`,
            locationId: ground, factionIds: [house.id],
            actors: [{ id: seller.id, name: seller.name, role: 'factor' }],
            data: { exchangeConsignment: true, objectId, stintDay: day } }), { recur: false });
        const object = makeObject({ id: objectId, name, kind: ingredient ? 'material' : 'pill',
            ownerId: house.id, ownerName: house.name, possessorId: seller.id, locationId: ground,
            tags: ['exchange', `house:${house.id}`, `grade:${ingredient?.grade ?? pill!.grade}`],
            data: { ...(ingredient ? { materialId: id } : { pillId: id }), stintDay: day },
            provenance: [{ onDay: day, holderId: null, holderName: house.name, how: ingredient ? 'found' : 'crafted',
                source: house.name, previousHolderId: null, previousHolderName: null, factId: fact.id,
                note: 'Workshop output or gathered regional export, paid out of the house stores.' }] });
        state.objects.push(transferPossession(object, { onDay: day, toHolderId: seller.id,
            toHolderName: seller.name, how: 'lent', transfersOwnership: false, factId: fact.id,
            note: 'Consigned to the exchange for this stint.' }));
    }
}

function exchangeOfferForObject(state: WorldState, seller: NpcRecord, object: ObjectRecord,
    auctioned: ReadonlySet<unknown>): AnOfferStandingHere | null {
    if (!seller.activity || seller.status !== 'alive' || !object.tags.includes('exchange')
        || object.possessorId !== seller.id || object.ownerId !== seller.factionId
        || isRuined(object) || auctioned.has(object.id)) return null;
    const thing = whatThisThingIs(object);
    if (!thing || thing.marketStones == null) return null;
    const price = object.kind === 'pill' ? pillCashPrice(getPill(thing.kindId)!) : thing.marketStones;
    if (price == null) return null;
    const region = regionIdOfPlace(state.locations.find(l => l.id === seller.locationId)?.name);
    const ask = region ? localPrice(region, price) : price;
    return { sellerId: seller.id, sellerName: seller.name, thingId: object.id, objectId: object.id,
        name: object.name, why: 'it_is_what_they_deal_in',
        askStones: ask, listStones: price, counterStones: ask, usableFrom: 0, usefulUntil: 0,
        whoWouldWantAWord: null, awkwardToHold: 0, fromTheMortalBoard: false };
}

/** These are ordinary local offers, backed by the exact objects in this person's hands. */
export function exchangeOffers(state: WorldState, seller: NpcRecord,
    stockPositions?: readonly number[], auctionedIds?: ReadonlySet<unknown>, day = state.currentDay,
    positions?: ReadonlyMap<string, string | null>): AnOfferStandingHere[] {
    if (!seller.activity || seller.status !== 'alive'
        || (positions?.has(seller.id) ? positions.get(seller.id) : locationOnNpcJourney(state.locations, seller, day)) !== seller.locationId) return [];
    const mission=seller.activity.capitalMissionId
        ?witnessIndexFor(state).byId.get(seller.activity.capitalMissionId):null;
    if(seller.activity.capitalMissionId&&mission?.data.destinationId!==seller.locationId)return [];
    const objects = stockPositions === undefined
        ? state.objects.filter(o => o.tags.includes('exchange') && o.possessorId === seller.id
            && o.ownerId === seller.factionId && !isRuined(o))
        : stockPositions.map(i => state.objects[i]!);
    if (!objects.length) return [];
    const auctioned = auctionedIds ?? new Set(pendingAuctionLots(state).map(f => f.data.objectId));
    const offers: AnOfferStandingHere[] = [];
    for (const object of objects) {
        const offer = exchangeOfferForObject(state, seller, object, auctioned);
        if (offer) offers.push(offer);
    }
    return offers;
}

/** Both ends pay out of actual purses and move this object through the ordinary provenance chain. */
export function tradeExchangeObject(state: WorldState, seller: NpcRecord, buyer: NpcRecord,
    objectId: string, day: number, playerAt?: { id: string; locationId: string | null },
    positions?: ReadonlyMap<string, string | null>): number | null {
    const objectAt = state.objects.findIndex(o => o.id === objectId);
    const object = state.objects[objectAt];
    const placeOf = (n: NpcRecord) => n.id === playerAt?.id ? playerAt.locationId
        : positions?.has(n.id) ? positions.get(n.id) ?? null : locationOnNpcJourney(state.locations, n, day);
    const venue = state.locations.find(l => l.id === placeOf(seller));
    if (!venue || !(venue.tags.includes('city') || whatKindOfPlace(venue.name) === 'provincial capital') || placeOf(buyer) !== venue.id || seller.id === buyer.id
        || seller.status !== 'alive' || buyer.status !== 'alive' || !object || isRuined(object)
        || object.possessorId !== seller.id) return null;
    const offering = object.ownerId === seller.factionId
        ? exchangeOfferForObject(state, seller, object,
            new Set(pendingAuctionLots(state).map(f => f.data.objectId))) : null;
    const thing = whatThisThingIs(object);
    if (!thing || thing.marketStones == null || (object.ownerId !== seller.id && !offering)) return null;
    const listPrice = object.kind === 'pill' ? pillCashPrice(getPill(thing.kindId)!) : thing.marketStones;
    if (listPrice === null) return null;
    const region = regionIdOfPlace(venue.name);
    const stones = offering?.askStones ?? quoteSale({ listStones: listPrice,
        quantity: thing.quantity, seller: { ordinal: seller.cultivation.realmOrdinal },
        localMultiplier: region ? localPrice(region, 100) / 100 : 1 }).offeredStones;
    if (stones <= 0 || buyer.spiritStones < stones) return null;
    const sellerAt = state.npcs.findIndex(n => n.id === seller.id);
    const buyerAt = state.npcs.findIndex(n => n.id === buyer.id);
    if (sellerAt < 0 || buyerAt < 0) return null;
    const fact = appendWorldFact(state, makeFact({ day, kind: 'gathering', locationId: venue.id,
        summary: `${object.name} sold for ${stones} spirit stones at ${venue.name}.`,
        actors: [{ id: seller.id, name: seller.name, role: 'seller' }, { id: buyer.id, name: buyer.name, role: 'buyer' }],
        factionIds: seller.factionId ? [seller.factionId] : [],
        data: { exchangeSale: true, objectId, sellerId: seller.id, houseId: offering ? seller.factionId : null,
            stintDay: seller.activity?.sinceDay ?? day, stones } }), { recur: false });
    state.npcs[sellerAt] = { ...state.npcs[sellerAt]!, spiritStones: seller.spiritStones + stones };
    state.npcs[buyerAt] = { ...state.npcs[buyerAt]!, spiritStones: buyer.spiritStones - stones };
    state.objects[objectAt] = { ...transferPossession(object, { onDay: day, toHolderId: buyer.id,
        toHolderName: buyer.name, how: 'bought', transfersOwnership: true, factId: fact.id,
        source: seller.name }), locationId: venue.id };
    return stones;
}

/** One seasonal sample per counter, never a loop over a person's days. */
export function tradeAtCapitalExchanges(state: WorldState, day: number): void {
    const cities = new Set(state.locations.filter(l => l.tags.includes('city') || whatKindOfPlace(l.name) === 'provincial capital').map(l => l.id));
    // A seasonal trade changes goods and purses, not places, activities or the clock.
    const routes = routeQueriesFor(state.locations);
    const positions = new Map(state.npcs.map(n => [n.id, locationOnNpcJourney(state.locations, n, day, routes)]));
    const stockPositions = new Map<string, number[]>();
    for (let i = 0; i < state.objects.length; i++) {
        const object = state.objects[i]!;
        if (!object.tags.includes('exchange') || !object.possessorId) continue;
        const held = stockPositions.get(object.possessorId) ?? [];
        held.push(i);
        stockPositions.set(object.possessorId, held);
    }
    const auctioned = new Set(pendingAuctionLots(state).map(f => f.data.objectId));
    const eligible = state.npcs.filter(n => isTheWorldsToMove(n) && n.status === 'alive'
        && n.activity && cities.has(positions.get(n.id) ?? ''));
    const distant = eligible.filter(person => !isPlayerInvolved(state, person));
    const selectedCounters = new Set((distant.length <= 4 ? distant : drawBackgroundIncidents(
        distant.map(value => ({ value, rate: 1 })), forStream(state.seed, 'background-exchange-counters', day), 4))
        .map(person => person.id));
    for (const selected of eligible.filter(person => selectedCounters.has(person.id) || isPlayerInvolved(state, person))) {
        const seller = state.npcs.find(n => n.id === selected.id)!;
        if (seller.status === 'alive' && seller.activity?.kind === 'stationed'
            && cities.has(positions.get(seller.id) ?? '')
            && !exchangeOffers(state, seller, stockPositions.get(seller.id) ?? [], auctioned, day, positions).length) {
            const before = state.objects.length;
            loadExchangeConsignment(state, seller, day, routes);
            for (let i = before; i < state.objects.length; i++) {
                const held = stockPositions.get(seller.id) ?? [];
                held.push(i);
                stockPositions.set(seller.id, held);
            }
        }
        const offers = exchangeOffers(state, seller, stockPositions.get(seller.id) ?? [], auctioned, day, positions);
        if (!offers.length) continue;
        const buyers = state.npcs.filter(n => isTheWorldsToMove(n) && n.status === 'alive'
            && positions.get(n.id) === seller.locationId
            && n.id !== seller.id && n.factionId !== seller.factionId);
        const rng = forStream(state.seed, 'exchange-sale', seller.id, day);
        if (!buyers.length || !rng.chance(0.5)) continue;
        tradeExchangeObject(state, seller, buyers[rng.int(0, buyers.length - 1)]!,
            offers[rng.int(0, offers.length - 1)]!.objectId!, day, undefined, positions);
    }
}

/** An ended stint returns unsold stock and its receipts exactly once. */
export function returnExchangeConsignment(state: WorldState, seller: NpcRecord, day: number,
    stintDay = seller.activity?.sinceDay, houseId = seller.factionId, stockPositions?: readonly number[]): void {
    const house = state.factions.find(h => h.id === houseId);
    if (!house || stintDay == null) return;
    if (factsWithDataValue(state, 'sellerId', seller.id).some(f => f.data.exchangeReturn === true
        && f.data.stintDay === stintDay
        && (f.data.houseId === house.id || f.data.houseId == null && seller.factionId === house.id))) return;
    const receipts = exchangeReceipts(state, seller.id, house.id, stintDay);
    const remit = Math.min(receipts, seller.spiritStones);
    const unsold: number[] = [];
    for (const i of stockPositions ?? state.objects.map((_, at) => at)) {
        const object = state.objects[i]!;
        if (object.tags.includes('exchange') && object.possessorId === seller.id && object.ownerId === house.id) unsold.push(i);
    }
    if (!receipts && !unsold.length) return;
    appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: 'faction', locationId: house.seatLocationId,
        factionIds: [house.id], actors: [{ id: seller.id, name: seller.name, role: 'factor' }],
        summary: `${seller.name} returned ${remit} spirit stones and ${unsold.length} unsold consignments to ${house.name}.`,
        data: { exchangeReturn: true, sellerId: seller.id, houseId: house.id, stintDay,
            stones: remit, short: receipts - remit } }), { recur: false });
    house.resources.spirit_stones = Number(house.resources.spirit_stones ?? 0) + remit;
    const at = state.npcs.findIndex(n => n.id === seller.id);
    if (at >= 0) state.npcs[at] = { ...state.npcs[at]!, spiritStones: state.npcs[at]!.spiritStones - remit };
    // Fact append and purse settlement do not reorder or insert object rows.
    for (const i of unsold) {
        const object = state.objects[i]!;
        state.objects[i] = { ...transferPossession(object, { onDay: day, toHolderId: null, toHolderName: house.name,
            how: 'lent', transfersOwnership: false, note: 'Unsold exchange consignment returned.' }), locationId: house.seatLocationId };
    }
}

function exchangeReceipts(state: WorldState, sellerId: string, houseId: string, stintDay: number): number {
    const earned = factsWithDataValue(state, 'sellerId', sellerId)
        .filter(f => f.data.stintDay === stintDay
            && (f.data.exchangeSale === true && f.data.houseId === houseId
                || f.data.auctionResult === true && f.data.payeeId === houseId
                || f.data.exchangeHandover === true && f.data.houseId === houseId))
        .reduce((sum, f) => sum + Number(f.data.stones), 0);
    const handed = factsWithDataValue(state, 'fromSellerId', sellerId)
        .filter(f => f.data.exchangeHandover === true && f.data.houseId === houseId
            && f.data.fromStintDay === stintDay)
        .reduce((sum, f) => sum + Number(f.data.stones), 0);
    return Math.max(0, earned - handed);
}

/** House goods remain with a carrier until that carrier reaches the house. */
export function hasExchangeConsignment(state: WorldState, seller: NpcRecord,
    houseId = seller.factionId, stintDay = seller.activity?.sinceDay): boolean {
    if (!houseId || stintDay == null) return false;
    return exchangeReceipts(state, seller.id, houseId, stintDay) > 0
        || state.objects.some(o => o.tags.includes('exchange') && o.possessorId === seller.id
            && o.ownerId === houseId);
}

/** A factor present at the same counter can take the old house's load onward. */
export function handOverExchangeConsignment(state: WorldState, seller: NpcRecord,
    receiver: NpcRecord, day: number): boolean {
    const houseId = seller.factionId;
    const stintDay = seller.activity?.sinceDay;
    const receiverStintDay = receiver.activity?.sinceDay;
    const venue = locationOnNpcJourney(state.locations, seller, day);
    if (!houseId || stintDay == null || receiverStintDay == null || !venue
        || seller.id === receiver.id || receiver.factionId !== houseId
        || seller.status !== 'alive' || receiver.status !== 'alive'
        || locationOnNpcJourney(state.locations, receiver, day) !== venue) return false;
    const stock = state.objects.filter(o => o.tags.includes('exchange')
        && o.possessorId === seller.id && o.ownerId === houseId);
    const receipts = exchangeReceipts(state, seller.id, houseId, stintDay);
    if (!stock.length && receipts <= 0) return false;
    const stones = Math.min(receipts, seller.spiritStones);
    const fact = appendWorldFact(state, makeFact({ day, kind: 'gathering',
        visibility: 'faction', locationId: venue, factionIds: [houseId],
        summary: `${seller.name} handed ${receiver.name} ${stock.length} consignments and ${stones} spirit stones.`,
        actors: [{ id: seller.id, name: seller.name, role: 'outgoing factor' },
            { id: receiver.id, name: receiver.name, role: 'receiving factor' }],
        data: { exchangeHandover: true, fromSellerId: seller.id, fromStintDay: stintDay,
            sellerId: receiver.id, stintDay: receiverStintDay, houseId, stones,
            short: receipts - stones } }), { recur: false });
    const fromAt = state.npcs.findIndex(n => n.id === seller.id);
    const toAt = state.npcs.findIndex(n => n.id === receiver.id);
    state.npcs[fromAt] = { ...state.npcs[fromAt]!, spiritStones: state.npcs[fromAt]!.spiritStones - stones };
    state.npcs[toAt] = { ...state.npcs[toAt]!, spiritStones: state.npcs[toAt]!.spiritStones + stones };
    for (let i = 0; i < state.objects.length; i++) {
        const object = state.objects[i]!;
        if (!stock.some(o => o.id === object.id)) continue;
        state.objects[i] = { ...transferPossession(object, { onDay: day,
            toHolderId: receiver.id, toHolderName: receiver.name, how: 'lent',
            transfersOwnership: false, factId: fact.id,
            note: 'House consignment passed to its returning factor.' }), locationId: venue };
    }
    return true;
}
