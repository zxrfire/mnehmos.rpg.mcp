/**
 * Person-directed item trading used catalog allowlists, so a held token had no
 * cash trade path. A passage tally is one ordinary owned inventory item: the
 * same offer, consent, purse and custody path must move it and other goods.
 * Real public seats are arranged through the counter, and an actual willing
 * buyer is selected through the ordinary item proposal reader, never an RNG
 * override. The holder's answer remains a played act, including refusal.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness';
import { makeObject, type ObjectKind } from '../../src/engine/world/possessions';
import { makeLocation } from '../../src/engine/world/locations';
import { addToPouch, pouchQuantity } from '../../src/server/consolidated/cultivation-support';
import { PILLS } from '../../src/data/cultivation/pills';
import { wouldBuyHeldItem } from '../../src/engine/world/a-person-is-offered-a-price-for-what-they-hold';
import { createNpc, addGoal, upsertRelationship } from '../../src/engine/world/npc-state';
import { worldLocationFor } from '../../src/engine/world/place-lookup';
import { aVehicleOf } from '../../src/engine/world/a-vehicle';
import { carriageIdForRoad, publicCarriageRoadTerms } from '../../src/engine/world/public-carriages';
import { routineTime } from '../../src/engine/world/npc-routines';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { makeScheduledEffect } from '../../src/engine/world/world-state';
import { publicTransportFrom } from '../../src/engine/world/public-transport-at-a-place';
import { stonesFor } from '../../src/engine/world/the-fare-and-calendar-of-a-passage';
import { buyPublicCarriageTally } from '../../src/web/public-carriage-tallies-at-the-counter';
import { passageTallyTerms, passageDepartureKey } from '../../src/engine/world/a-passage-tally-is-the-seat-you-own';
import { priceOfferedForHeldItem, openHeldItemOffers, wouldPartWithHeldItem } from '../../src/engine/world/a-person-is-offered-a-price-for-what-they-hold';
import { standInTheWorld } from '../../src/web/the-player-as-a-row-the-world-can-invite';
import { offerTheNextPublicCarriage } from '../../src/engine/world/the-next-public-carriage-is-an-ordinary-trip';

async function counter(playerOwns: boolean) {
    const h = await makeGameInWorld({ seed: 'held-tally-trade', worldSeed: 'held-tally-trade-world' });
    const { cultivator } = await h.game.newRun('Traveller');
    let world = h.game.atHand!;
    const from = worldLocationFor(world, 'The Furnace Flank')!, to = worldLocationFor(world, 'Emerald Water City')!;
    const day = routineTime(world), leaves = Math.floor(day) + 3.5;
    const driver = createNpc(world.seed, { id: 'resale-driver', name: 'Driver Wen', locationId: from.id, onDay: day, bornOnDay: day - 12000, occupation: 'carter' });
    const vesselId = carriageIdForRoad(from.id, to.id, 'conv-carriage-mortal');
    const vehicle = aVehicleOf({ id: vesselId, conveyanceId: 'conv-carriage-mortal', ownerId: driver.id, ownerName: driver.name, at: from.id });
    vehicle.tags.push('public-road-service'); world.objects.push(vehicle); world.npcs.push(driver);
    const station = theAreasOf(world, from).areas.find(a => a.for === 'carriage_station')!;
    driver.activity = { kind: 'idle', note: 'Keeping the public carriage.', withIds: [], sinceDay: day, untilDay: null, standingIn: station.id };
    h.repos.cultivators.update(cultivator.id, { location: from.name, spiritStones: 5000 });
    h.repos.cultivators.standIn(cultivator.id, station.id); h.game.theWorldMoved(); await h.game.act('I look around');
    const road = publicCarriageRoadTerms(world, from.id, to.id, 'conv-carriage-mortal')!;
    const fare = stonesFor(publicTransportFrom(world, from.name, Math.floor(day)).find(l => l.to === to.name)!.cashPerSeat);
    const terms = { service: 'carriage' as const, vesselId, fromId: from.id, toId: to.id, departureDay: leaves };
    const effect = makeScheduledEffect({ id: 'public-departure:' + passageDepartureKey(terms), kind: 'meeting', dueOnDay: leaves,
        locationId: from.id, actorIds: [driver.id], summary: 'The public carriage leaves at its accepted time.',
        data: { publicCarrierDeparture: true, service: 'carriage', vesselId, operatorId: driver.id,
            fromLocationId: from.id, toLocationId: to.id, arrivalDay: leaves + road.days, fareStones: fare, conveyanceId: 'conv-carriage-mortal' } });
    world.schedule.push(effect); driver.activity.publicDepartureId = effect.id;
    const buyers = [];
    for (let i = 0; i < (playerOwns ? 2 : 3); i++) {
        const person = createNpc(world.seed, { id: 'resale-passenger-' + i, name: 'Passenger ' + i,
            locationId: from.id, onDay: day, bornOnDay: day - 9000 });
        person.spiritStones = 200; person.activity = { kind: 'idle', note: 'At the counter.', withIds: [], sinceDay: day, untilDay: null, standingIn: station.id };
        world.npcs.push(person);
        expect(buyPublicCarriageTally(h.game, from.id, to.id, person, person, driver.id).ok).toBe(true);
        world.npcs.find(p => p.id === person.id)!.activity!.standingIn = theAreasOf(world, from).areas.find(a => a.id !== station.id)!.id; // Waiting elsewhere does not release the paid seat.
        buyers.push(person);
    }
    const player = standInTheWorld(world, h.game.currentRun().cultivator, { factionId: null, rankIndex: -1, contribution: 0 }, routineTime(world))!;
    if (playerOwns) await h.game.act(`I buy a passage tally to ${to.name}`);
    world = h.game.atHand!;
    const item = world.objects.find(o => o.possessorId === cultivator.id && passageTallyTerms(o));
    let buyer = null;
    for (let i = 0; i < 64; i++) {
        let proposed = createNpc(world.seed, { id: 'item-buyer-' + i, name: 'Traveller Lin', locationId: from.id,
            onDay: day, bornOnDay: day - 7000 });
        proposed.spiritStones = 500;
        proposed = addGoal(proposed, { kind: 'discovery', text: 'Reach the city before the appointed meeting.',
            targetId: to.id, priority: 1, deadlineOnDay: leaves + road.days + .25 }, day);
        proposed.activity = { kind: 'idle', note: 'Waiting at the counter to ask about goods.', withIds: [], sinceDay: day, untilDay: leaves, standingIn: station.id };
        // The owner has shown this item to the prospective buyer at the counter.
        if (item) {
            if (!priceOfferedForHeldItem(world,{...item,knownOwnershipBy:[...item.knownOwnershipBy,proposed.id]},player,proposed)) continue;
            item.knownOwnershipBy.push(proposed.id);
        }
        buyer = proposed; break;
    }
    expect(buyer).toBeTruthy(); world.npcs.push(buyer!); h.game.theWorldMoved();
    h.game.noteEncounter(h.game.currentRun().cultivator, h.game.currentRun().run, { kind: 'cultivator', id: buyer!.id, name: buyer!.name }, 'told', 'A traveller gave their name at the counter.');
    for (const person of buyers) h.game.noteEncounter(h.game.currentRun().cultivator, h.game.currentRun().run,
        { kind: 'cultivator', id: person.id, name: person.name }, 'told', 'A passenger gave their name at the counter.');
    if (playerOwns) await h.game.act('I look around');
    return { ...h, from, to, cultivator, buyer: buyer!, driver, buyers, fare, terms,
        get world() { return h.game.atHand!; }, diagnostic: () => JSON.stringify({ now: routineTime(h.game.atHand!), body: {location: h.game.currentRun().cultivator.location, standingIn: h.game.currentRun().cultivator.standingIn}, station: station.id, buyerArea: h.game.atHand!.npcs.find(p=>p.id===buyer!.id)?.activity?.standingIn, seen: h.game.present(h.game.currentRun().cultivator).map(p => p.id), buyer: buyer!.id, purchases: h.game.atHand!.history.facts.filter(f => f.data.passageTallyPurchase === true).map(f => ({seat:f.data.seat,who:f.witnessIds})), offers: h.game.atHand!.history.facts.filter(f => f.data.heldItemOffer === true).map(f=>f.summary) }) };
}

it('receives a real premium offer and can sell its held seat', async () => {
    const h = await counter(true);
    const offer = openHeldItemOffers(h.world, h.cultivator.id)[0]!;
    expect(offer, h.diagnostic()).toBeTruthy(); expect(offer.data.stones).toBeGreaterThan(h.fare);
    const before = h.game.currentRun().cultivator.spiritStones, buyerPurse = h.world.npcs.find(p => p.id === h.buyer.id)!.spiritStones;
    const turn = await h.game.act(`I accept ${h.buyer.name}'s offer for my passage tally`);
    expect(h.game.currentRun().cultivator.spiritStones, turn.narration).toBe(before + Number(offer.data.stones));
    expect(h.world.npcs.find(p => p.id === h.buyer.id)!.spiritStones).toBe(buyerPurse - Number(offer.data.stones));
    expect(h.world.objects.find(o => o.id === offer.data.objectId)?.possessorId).toBe(h.buyer.id);
});

it('can refuse the same real offer without selling or moving money', async () => {
    const h = await counter(true); const offer = openHeldItemOffers(h.world, h.cultivator.id)[0]!;
    expect(offer, h.diagnostic()).toBeTruthy(); const before = h.game.currentRun().cultivator.spiritStones;
    const turn = await h.game.act(`I refuse ${h.buyer.name}'s offer for my passage tally`);
    expect(h.game.currentRun().cultivator.spiritStones, turn.narration).toBe(before);
    expect(h.world.objects.find(o => o.id === offer.data.objectId)?.possessorId).toBe(h.cultivator.id);
    expect(openHeldItemOffers(h.world, h.cultivator.id)).toHaveLength(0);
});

it('puts an actual price to a passenger on the full departure and buys only with their consent', async () => {
    const h = await counter(false); const seller = h.world.npcs.find(p => p.id === h.buyers[0]!.id)!;
    seller.activity!.standingIn = h.game.currentRun().cultivator.standingIn;
    const at = h.world.npcs.findIndex(p => p.id === seller.id);
    h.world.npcs[at] = upsertRelationship(seller, { targetId: h.cultivator.id, targetName: h.cultivator.name, kind: 'ally', standing: .8 }, routineTime(h.world));
    const object = h.world.objects.find(o => o.possessorId === seller.id && passageTallyTerms(o))!;
    const next = offerTheNextPublicCarriage(h.world, h.from.id, h.to.id, seller.id)!;
    const actor = h.world.npcs.find(p => p.id === h.cultivator.id)!;
    const price = [h.fare * 2, h.fare * 10, 100, 500].find(n => wouldPartWithHeldItem(h.world, h.world.npcs[at]!, actor, object, n,
        { replacementStones: next.departure.fareStones, waitingDays: next.departure.terms.departureDay - h.terms.departureDay, missesTheirPurpose: false }));
    expect(price).toBeDefined(); h.game.theWorldMoved(); const before = h.game.currentRun().cultivator.spiritStones;
    const turn = await h.game.act(`I offer ${seller.name} ${price} spirit stones for their passage tally`);
    expect(h.world.objects.find(o => o.id === object.id)?.possessorId, turn.narration).toBe(h.cultivator.id);
    expect(h.game.currentRun().cultivator.spiritStones).toBe(before - price!);
    expect(h.world.npcs.find(p => p.id === seller.id)!.spiritStones).toBe(200 - h.fare + price!);
});

async function ordinaryInventory(kind: ObjectKind, counted=false, provider?: ScriptedProvider) {
    const h=await makeGameInWorld({seed:'any-owned-inventory',worldSeed:'any-owned-inventory-world',provider});
    const {cultivator}=await h.game.newRun('Trader');
    const world=h.game.atHand!,now=routineTime(world);
    const place=makeLocation({id:'owned-item-market',name:'Small Market',kind:'settlement',tags:['city']});world.locations.push(place);
    const area=theAreasOf(world,place).areas.find(a=>a.for==='market')!;
    h.repos.cultivators.update(cultivator.id,{location:place.name,spiritStones:100});h.repos.cultivators.standIn(cultivator.id,area.id);
    const pill=PILLS.find(p=>p.grade==='mortal')??PILLS[0]!;
    const object=makeObject({id:'owned-'+kind,name:counted?pill.name:'Plain '+kind,kind,ownerId:cultivator.id,
        ownerName:cultivator.name,possessorId:cultivator.id,data:counted?{pillId:pill.id}:{}});
    if(counted)addToPouch(h.db,cultivator.id,pill.id,'pill',2);else world.objects.push(object);
    const player=standInTheWorld(world,h.game.currentRun().cultivator,{factionId:null,rankIndex:-1,contribution:0},now)!;
    const candidates=Array.from({length:64},(_,i)=>{
        let p=createNpc(world.seed,{id:'ordinary-trader-'+i,name:'Trader Lin',locationId:place.id,onDay:now,bornOnDay:now-7300});p.spiritStones=100;
        p=addGoal(p,{kind:'discovery',text:'Obtain the named item.',targetId:counted?pill.id:object.id,priority:1},now);
        p.activity={kind:'trade',note:'Trading goods at the market.',withIds:[],sinceDay:now,untilDay:now+1,standingIn:area.id};return p;
    });
    const buyer=candidates.find(p=>wouldBuyHeldItem(world,p,player,object,7))!;expect(buyer).toBeDefined();world.npcs.push(buyer);
    h.game.noteEncounter(h.game.currentRun().cultivator,h.game.currentRun().run,{kind:'cultivator',id:buyer.id,name:buyer.name},'told','The trader gave their name.');
    h.game.theWorldMoved();return {...h,cultivator,buyer,object,pill};
}
for(const kind of ['manual','pill','artifact','material','key','token','currency','corpse','other'] as const) {
    it(`sells a held ${kind} through ordinary person-directed item trade`,async()=>{
        const h=await ordinaryInventory(kind);
        const turn=await h.game.act(`I sell my ${h.object.name} to ${h.buyer.name} for 7 spirit stones`);
        expect(h.game.atHand!.objects.find(o=>o.id===h.object.id)?.possessorId,turn.narration).toBe(h.buyer.id);
        expect(h.game.currentRun().cultivator.spiritStones).toBe(107);
        expect(h.game.atHand!.npcs.find(p=>p.id===h.buyer.id)!.spiritStones).toBe(93);
    });
}
it('puts counted inventory through the same buyer decision and moves only the sold unit',async()=>{
    const h=await ordinaryInventory('pill',true),before=pouchQuantity(h.db,h.cultivator.id,h.pill.id);
    const turn=await h.game.act(`I sell my ${h.pill.name} to ${h.buyer.name} for 7 spirit stones`);
    const sold=h.game.atHand!.history.facts.find(f=>f.data.heldItemSale===true&&f.data.sellerId===h.cultivator.id);
    expect(turn.narration).toMatch(/sold for 7 spirit stones|refused to buy/i);
    expect(pouchQuantity(h.db,h.cultivator.id,h.pill.id)).toBe(before-(sold?1:0));
    expect(h.game.currentRun().cultivator.spiritStones).toBe(100+(sold?7:0));
    if(sold){expect(pouchQuantity(h.db,h.buyer.id,h.pill.id)).toBe(1);
        expect(h.game.atHand!.objects.find(o=>o.id===sold.data.objectId)?.possessorId).toBe(h.buyer.id);}
});

it('a model-selected ordinary trade request moves the same owned item and both actual purses',async()=>{
    const plans:string[]=[],provider=new ScriptedProvider({plans,narrations:['(scripted)']});
    const h=await ordinaryInventory('key',false,provider);
    plans.push(JSON.stringify({action:'request',intent:'a_trade',target:h.buyer.name,topic:h.object.name}));
    await h.game.act(`I sell my ${h.object.name} to ${h.buyer.name} for 7 spirit stones`);
    expect(h.game.atHand!.objects.find(o=>o.id===h.object.id)?.possessorId).toBe(h.buyer.id);
    expect(h.game.currentRun().cultivator.spiritStones).toBe(107);
    expect(h.game.atHand!.npcs.find(p=>p.id===h.buyer.id)!.spiritStones).toBe(93);
});

it('an ordinary sale without a named buyer puts an owned token to somebody actually here',async()=>{
    const h=await ordinaryInventory('token');
    const turn=await h.game.act(`I sell my ${h.object.name} for 7 spirit stones`);
    expect(h.game.atHand!.objects.find(o=>o.id===h.object.id)?.possessorId,turn.narration).toBe(h.buyer.id);
    expect(h.game.currentRun().cultivator.spiritStones).toBe(107);
});
it('asks the real holder for terms on an uncatalogued item without a kind refusal',async()=>{
    const h=await ordinaryInventory('token');
    const gift=await h.game.act(`I give ${h.object.name} to ${h.buyer.name}`);
    expect(h.game.atHand!.objects.find(o=>o.id===h.object.id)?.possessorId,gift.narration).toBe(h.buyer.id);
    const turn=await h.game.act(`I ask ${h.buyer.name} what they would take for the ${h.object.name}`);
    expect(turn.narration).toContain(h.object.name);
    expect(turn.narration).not.toMatch(/nothing.*(?:called|name)|not.*(?:trade|barter).*kind/i);
    expect(h.game.atHand!.objects.find(o=>o.id===h.object.id)?.possessorId).toBe(h.buyer.id);
    expect(h.game.currentRun().cultivator.spiritStones).toBe(100);
});
