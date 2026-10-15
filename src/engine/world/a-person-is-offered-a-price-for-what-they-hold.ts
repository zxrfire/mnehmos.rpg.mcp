/** A person weighs an actual paid exchange through the ordinary decision path. */
import { oddsOf, type Party } from '../social-leverage/an-attempt-to-move-somebody.js';
import { earningsPerYear } from '../cultivation/origin.js';
import { forStream } from '../cultivation/rng.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue } from './witness-reaction-index.js';
import { relationshipWith, activeGoals, isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { transferPossession, type ObjectRecord } from './possessions.js';
import { routineTime } from './npc-routines.js';
import { whatThisThingIs } from './what-a-house-gives-merit-for.js';
import { whatACraftWouldFetch } from './a-house-sells-what-it-built.js';
import { whoHoldsTheGround } from './ground-holder.js';
import { theGroundUnderYou } from '../social-leverage/ground-trust.js';
import { statusesInArea } from './what-is-true-of-a-place-right-now.js';
import { locationOfNpcOnItsJourney } from './places-on-the-way.js';
import { witnessIndexFor } from './witness-reaction-index.js';
import type { WorldState } from './world-state.js';

export function partyForAnItemTrade(state: WorldState, person: NpcRecord): Party {
    return { id: person.id, name: person.name, ordinal: person.cultivation.realmOrdinal,
        charm: person.cultivation.attributes.charm, factionId: person.factionId, ranked: !!person.factionId,
        alignment: state.factions.find(h => h.id === person.factionId)?.alignment ?? null };
}

/** The premium is weighed against what accepting actually costs this holder. */
export function wouldPartWithHeldItem(state: WorldState, seller: NpcRecord, buyer: NpcRecord,
    object: ObjectRecord, price: number, value: { replacementStones: number; waitingDays: number; missesTheirPurpose: boolean },
    onDay = routineTime(state)): boolean {
    if (!isTheWorldsToMove(seller) || buyer.status !== 'alive' || buyer.id === seller.id || seller.status !== 'alive' || object.possessorId !== seller.id || object.ownerId !== seller.id
        || !Number.isInteger(price) || price < 0) return false;
    const tie = relationshipWith(seller, buyer.id);
    const input = { actor: partyForAnItemTrade(state, buyer), subject: partyForAnItemTrade(state, seller),
        onDay, ask: value.missesTheirPurpose ? 'against_their_interest' as const : 'a_real_favour' as const,
        approach: { leverage: 'coin' as const, audience: 'alone' as const }, stonesOffered: price,
        opportunityCostStones: Math.max(0, value.replacementStones)
            + Math.max(0, value.waitingDays) * earningsPerYear(seller.cultivation.realmOrdinal) / 365,
        theirTie: tie ? { active: true, strength: Math.max(0, tie.standing) } : null,
        ledger: state.obligations, where: itemTradeGround(state,seller.locationId,onDay),
        rng: forStream(state.seed, 'held-item-price', object.id, seller.id, buyer.id, onDay, price) };
    return input.rng.chance(oddsOf(input).odds);
}

/** Offers live as ordinary events; an answer is another event caused by it. */
export function openHeldItemOffers(state: WorldState, sellerId: string): HistoricalFact[] {
    const answers = new Set(factsWithDataValue(state, 'heldItemOfferAnswered', true).flatMap(f => f.causes));
    return factsWithDataValue(state, 'heldItemOffer', true).filter(f => !answers.has(f.id)
        && f.data.sellerId === sellerId && typeof f.data.objectId === 'string'
        && state.objects.some(o => o.id === f.data.objectId && o.possessorId === sellerId)
        && (typeof f.data.untilDay !== 'number' || f.data.untilDay >= routineTime(state)));
}

export function writeHeldItemOffer(state: WorldState, object: ObjectRecord, seller: NpcRecord,
    buyer: NpcRecord, stones: number, placeId: string, untilDay: number): HistoricalFact {
    return appendWorldFact(state, makeFact({ day: routineTime(state), kind: 'opportunity', locationId: placeId,
        visibility: 'secret', witnessIds: [seller.id, buyer.id], actors: [
            { id: buyer.id, name: buyer.name, role: 'buyer' }, { id: seller.id, name: seller.name, role: 'seller' }],
        summary: `${buyer.name} offered ${stones} spirit stones for ${seller.name}'s ${object.name}.`,
        data: { heldItemOffer: true, objectId: object.id, sellerId: seller.id, buyerId: buyer.id, stones, untilDay } }),
        { bystanders: false, recur: false });
}

/** The money writer owns both purses; the existing item writer owns custody. */
export function completeHeldItemSale(state: WorldState, objectId: string, seller: NpcRecord, buyer: NpcRecord,
    stones: number, placeId: string, pay: (commit: () => void) => boolean, offer?: HistoricalFact): boolean {
    const at = state.objects.findIndex(o => o.id === objectId), object = state.objects[at];
    if (!object || object.possessorId !== seller.id || seller.status !== 'alive' || buyer.status !== 'alive'
        || object.ownerId !== seller.id || seller.id === buyer.id || !Number.isInteger(stones) || stones < 0) return false;
    return pay(() => {
        const fact = appendWorldFact(state, makeFact({ day: routineTime(state), kind: 'gathering', locationId: placeId,
            visibility: 'secret', witnessIds: [seller.id, buyer.id], causes: offer ? [offer.id] : [],
            actors: [{ id: seller.id, name: seller.name, role: 'seller' }, { id: buyer.id, name: buyer.name, role: 'buyer' }],
            summary: `${object.name} sold by ${seller.name} to ${buyer.name} for ${stones} spirit stones.`,
            data: { heldItemSale: true, heldItemOfferAnswered: !!offer, objectId, sellerId: seller.id, buyerId: buyer.id, stones } }),
            { bystanders: false, recur: false });
        state.objects[at] = transferPossession(object, { onDay: routineTime(state), toHolderId: buyer.id,
            toHolderName: buyer.name, how: 'bought', transfersOwnership: true, factId: fact.id });
    });
}

/** Catalog value and actual acquisition evidence are reads, never sale eligibility. */
export function heldItemValue(state: WorldState, object: ObjectRecord): number {
    const thing = whatThisThingIs(object);
    if (thing?.marketStones != null) return thing.marketStones * thing.quantity;
    if (typeof object.data.conveyanceId === 'string') {
        const made = whatACraftWouldFetch(object.data.conveyanceId); if (made != null) return made;
    }
    const purchase = [...object.provenance].reverse().find(link => link.how === 'bought' && link.factId);
    const d = purchase?.factId ? witnessIndexFor(state).byId.get(purchase.factId)?.data : null;
    const price = d?.fareStones ?? d?.stones;
    return typeof price === 'number' && Number.isFinite(price) ? Math.max(0, price) : 0;
}

/** A person's actual goal can point at the item, its catalog source or what it supplies. */
export function heldItemNeed(state: WorldState, person: NpcRecord, object: ObjectRecord) {
    const thing = whatThisThingIs(object);
    const targets = new Set([object.id, thing?.kindId, object.data.toLocationId]);
    const goal = activeGoals(person).find(g => g.targetId != null && targets.has(g.targetId));
    const onDay = routineTime(state);
    const available = typeof object.data.departureDay === 'number' ? object.data.departureDay : onDay;
    const later = typeof object.data.vesselId === 'string' ? state.schedule.filter(e => e.dueOnDay > available
        && e.data.vesselId === object.data.vesselId && e.data.fromLocationId === object.data.fromLocationId
        && e.data.toLocationId === object.data.toLocationId).sort((a,b) => a.dueOnDay - b.dueOnDay)[0] : undefined;
    const waitingDays = later ? later.dueOnDay - available : 0;
    return { goal, replacementStones: heldItemValue(state, object), waitingDays,
        missesTheirPurpose: !!goal && goal.deadlineOnDay != null && goal.deadlineOnDay < available + waitingDays };
}

/** Receiving the item is a paid request too; the buyer keeps their own decision. */
export function wouldBuyHeldItem(state: WorldState, buyer: NpcRecord, seller: NpcRecord,
    object: ObjectRecord, price: number, onDay = routineTime(state)): boolean {
    if (!isTheWorldsToMove(buyer) || seller.status !== 'alive' || seller.id === buyer.id || buyer.status !== 'alive' || buyer.spiritStones < price
        || !Number.isInteger(price) || price < 0) return false;
    const need = heldItemNeed(state, buyer, object), tie = relationshipWith(buyer, seller.id);
    const rng = forStream(state.seed, 'buy-a-held-item', object.id, buyer.id, seller.id, onDay, price);
    return rng.chance(oddsOf({ actor: partyForAnItemTrade(state, seller), subject: partyForAnItemTrade(state, buyer),
        ask: price > heldItemValue(state, object) && !need.goal ? 'against_their_interest' : 'a_real_favour',
        theirTie: tie ? {active: true, strength: Math.max(0, tie.standing)} : null,
        theyWantSomethingFromYou: !!need.goal, approach: { leverage: 'coin', audience: 'alone' },
        goodsOfferedStones: heldItemValue(state, object), opportunityCostStones: price,
        ledger: state.obligations, where: itemTradeGround(state,buyer.locationId,onDay), onDay, rng }).odds);
}

/** One ordinary priced proposal, shared by exact player contact and native meetings. */
export function priceOfferedForHeldItem(state: WorldState, object: ObjectRecord,
    seller: NpcRecord, buyer: NpcRecord, onDay = routineTime(state)): {stones: number; untilDay: number} | null {
    if (!isTheWorldsToMove(buyer) || buyer.status !== 'alive' || seller.status !== 'alive'
        || object.ownerId !== seller.id || object.possessorId !== seller.id || buyer.spiritStones < 1) return null;
    const need = heldItemNeed(state, buyer, object);
    if (!need.goal) return null;
    if (!object.knownOwnershipBy.includes(buyer.id) && !object.provenance.some(link => link.factId
        && witnessIndexFor(state).byId.get(link.factId)?.witnessIds.includes(buyer.id))) return null;
    if (factsWithDataValue(state, 'heldItemOffer', true).some(f => f.data.objectId === object.id && f.data.buyerId === buyer.id)) return null;
    const rng = forStream(state.seed, 'offer-for-a-held-item', object.id, buyer.id, seller.id);
    const tie = relationshipWith(buyer, seller.id);
    if (!rng.chance(oddsOf({ actor: partyForAnItemTrade(state, seller), subject: partyForAnItemTrade(state, buyer),
        ask: 'a_real_favour', theyWantSomethingFromYou: true,
        theirTie: tie ? {active: true, strength: Math.max(0, tie.standing)} : null,
        ledger: state.obligations, onDay, rng }).odds)) return null;
    const list = heldItemValue(state, object);
    const budget = Math.min(buyer.spiritStones, Math.floor(list + need.goal.priority * (buyer.spiritStones - list)));
    if (budget < 1) return null;
    return { stones: rng.int(Math.min(Math.ceil(list) + 1, budget), budget),
        untilDay: typeof object.data.departureDay === 'number' ? object.data.departureDay : need.goal.deadlineOnDay ?? onDay + 1 };
}

/** An existing meeting/rates pass supplies the people actually together; no daily loop. */
export function tradeOwnedItemsAtAMeeting(state: WorldState, peopleIds: readonly string[], placeId: string,
    onDay = routineTime(state)): void {
    const ids=new Set(peopleIds);
    const people=state.npcs.filter(p=>ids.has(p.id)&&isTheWorldsToMove(p)&&p.status==='alive'
        &&locationOfNpcOnItsJourney(state,p,onDay)===placeId);
    const peopleSet=new Set(people.map(p=>p.id));
    const personSlots=new Map(state.npcs.map((person,at)=>[person.id,at]));
    const ownedBy=new Map<string,number[]>();
    for(let at=0;at<state.objects.length;at++) {
        const object=state.objects[at]!;
        if(!object.possessorId||object.possessorId!==object.ownerId||!peopleSet.has(object.possessorId))continue;
        const held=ownedBy.get(object.possessorId)??[];held.push(at);ownedBy.set(object.possessorId,held);
    }
    for (const sellerAtStart of people) for (const at of ownedBy.get(sellerAtStart.id)??[]) {
        const object=state.objects[at]!;
        for (const buyerAtStart of people) {
            const seller=state.npcs[personSlots.get(sellerAtStart.id)!]!;
            const buyer=state.npcs[personSlots.get(buyerAtStart.id)!]!;
            const held=state.objects[at];
            if (seller.id === buyer.id || held?.possessorId !== seller.id || held.ownerId !== seller.id) continue;
            const price = priceOfferedForHeldItem(state,object,seller,buyer,onDay); if (!price) continue;
            const offer = writeHeldItemOffer(state,object,seller,buyer,price.stones,placeId,price.untilDay);
            const value = heldItemNeed(state,seller,object);
            if (!wouldPartWithHeldItem(state,seller,buyer,object,price.stones,value,onDay)) continue;
            if (completeHeldItemSale(state,object.id,seller,buyer,price.stones,placeId, commit => {
                const payer = state.npcs.find(p=>p.id===buyer.id)!, payee=state.npcs.find(p=>p.id===seller.id)!;
                if (payer.spiritStones < price.stones) return false;
                payer.spiritStones -= price.stones; payee.spiritStones += price.stones;
                commit(); return true;
            },offer)) break;
        }
    }
}

function itemTradeGround(state: WorldState, placeId: string | null, onDay: number) {
    return placeId ? theGroundUnderYou(whoHoldsTheGround(state.locations,placeId),
        statusesInArea(state.statuses,state.locations,placeId,Math.floor(onDay))) : null;
}
