/* Adding the later passenger changes actual area placement under three other
 * people plus party. Start the first offer beside its real listener after that
 * addition, as the second offer already does. The original request cost and
 * every three-course, fuel, custody, waiting body and arrival check remain. */
/** Public-service tallies and personal rides are separate authorities. A free
 * owned ride produces no tally or public fare; even a paid carried public tally
 * cannot replace a person's consent to board this privately held craft. */
/** Guard02 native57434 measured the real quote and exchange at landfall:
 * driver100000/rider1000/open oath became driver100005/rider993/settled once.
 * Direct metric air duration .5771698190364987 days burns2 stones; the fixture's
 * historical walking route quote was3days/9stones. The exact7 difference in
 * expected driver funds was fuel, not missed or repeated payment. Native arrival
 * had already settled the agreed7. No payment/time/geometry source is changed.
 * Keep the original published route/body arrangement; expectations now ask the
 * same quoteAnAirJourney with native witness context used by played boarding.
 * Each explicit outward/alone-return/second-load leg pays its real quote, keeps
 * the waiting rider physical, and records its own actual course. Their elapsed
 * lower bound is the sum of those real leg quotes, never three walking days.
 * Original no-double-exchange/status, custody, consent and landfall checks remain. */
/** Retained04 actual stopped fact f397 recorded 365001 before accepted arrival 365001.03550315235.
 * The living SQL pilot mirror carries the-player and isTheWorldsToMove=false.
 * Its null NPC activity was misread as loss of the actual operator/custody.
 * This inverse restores ONLY that row-presence guard; original free/cash/goods,
 * real fuel, consent, capacity and three-course assertions remain unchanged. */
/** Ride04 red native6 intended settlement failures plus1 observer mismatch;
 * Ride07 preserved diagnostic proved the unavailable rider was truthfully
 * refused before all costs/movement: full native history394 before AND after,
 * changed facts0/removed0, passage facts0/0, actual body/activity/location,
 * hull owner/possessor/data, accepted claim, purse and clocks all unchanged.
 * My broad Ride03 builder had accidentally filtered only the ORIGINAL snapshot
 * to passage facts[], while its unchanged assertion compared the FULL394 rows.
 * Ride08 restores that original full-history snapshot; no runtime/permission,
 * settlement assertion or legitimate native history is waived or rewritten.
 * New capacity controls keep their matching receipt-specific snapshots. */
/** Compiler21 Ride02 measured two unsupported traded-mode uses and one
 * exhaustive request glossary omission. Ride03 uses the existing bought mode
 * used by ownership-transfer/exchange for received goods, and registers passage
 * in the one existing request glossary. No new acquisition mode or trade store.
 * Further static audit found on-foot always appears in whatTheyCouldRide, so
 * offer availability now requires a real current owned/held craft. Native per-leg
 * capacity and explicit names/alone selection keep physical boarding distinct
 * from ongoing company. Original01/02 source/proof remains frozen/unaccepted. */
/**
 * Source audit found owned passage moved actual bodies, but a player offering
 * free/cash/goods passage had no consent/terms/boarding/exchange front door.
 * An offered ride is an ordinary accepted oath, not party membership or a
 * passenger roster. Actual individual native landfall is the settlement proof.
 * These controls play the raw offer through the ordinary intent safety gate,
 * actual social resolver, explicit owned boarding and native course/time.
 * Operator setup places existing living people and existing tracked goods at
 * an actual advertised route, gives a held ordinary hull and records navigator
 * knowledge. It creates no person, destination, payment goods or arrival fact.
 * The original helper replaced the acceptance sample. It has been removed;
 * the same pinned people now accept through their ordinary decision. All
 * availability, payment, capacity, custody, time and landfall remain native.
 * Returning to Emerald Water City also pays the existing Jade registration;
 * that receipt is distinct from the craft's actual fuel cost.
 * Ride02 also protects explicit selection: asking for passengers with no
 * accepted rider refuses before departure; a promise followed by riding alone
 * neither summons its holder nor exchanges payment. Ride01 stays frozen.
 * The station walk must persist its area through the area writer. A general
 * body update left the rider in the street and repeatedly charged the walk.
 * Scripted routing proves engine play, not actual-model prose acceptance.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { prepareWorldClockForPreciseSpan, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { routineOf, routineTime } from '../../src/engine/world/npc-routines.js';
import { setLocation, setRealm, PLAYER_ROW_TAG } from '../../src/engine/world/npc-state.js';
import { takeThemWithYou } from '../../src/engine/world/who-is-on-the-road-with-you.js';
import { publicTransportFrom } from '../../src/engine/world/public-transport-at-a-place.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { walkingDaysFrom } from '../../src/engine/world/locations.js';
import { priceJourney } from '../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { quoteAnAirJourney } from '../../src/engine/world/what-an-air-journey-takes.js';
import { witnessIndexFor } from '../../src/engine/world/witness-reaction-index.js';
import { requireConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { aVehicleOf, takeItAlong } from '../../src/engine/world/a-vehicle.js';
import { isTracked, isRuined } from '../../src/engine/world/possessions.js';
import { ownedPassageClaim, acceptOwnedPassage } from '../../src/web/an-owned-passage.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { realiseAcceptedPublicShipHull } from '../../src/engine/world/a-public-ship-hull.js';
import { publicShipLinesFrom, quotePublicPassage, recordPublicPassage, activityOfAPublicPassage } from '../../src/engine/world/public-shipping.js';
import { ensureShipCrew, bindShipCrewToPassage, placeShipCrew } from '../../src/engine/world/ship-crew.js';
import { buyTalliesForActualPublicBoarding } from '../../src/web/buying-the-tallies-for-an-actual-public-boarding.js';
import { recordActualBodyArrival, arrivalCourseOfFact, actualBodiesArrivedTogether } from '../../src/engine/world/a-body-that-actually-arrived.js';
import { offerTheNextPublicCarriage, acceptPublicCarriageOffer } from '../../src/engine/world/the-next-public-carriage-is-an-ordinary-trip.js';
import { makePassageTally } from '../../src/engine/world/a-passage-tally-is-the-seat-you-own.js';
import { makeFact } from '../../src/engine/world/history.js';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened.js';
import { transferActualSpiritStones } from '../../src/web/transferring-actual-spirit-stones.js';
import { agreedRideOn } from '../../src/web/an-offered-ride-is-an-agreement.js';
import { getPrice, stonesForACashPrice } from '../../src/data/cultivation/mortal-world.js';

async function scene() {
 const plans:string[]=[];
 const h=await makeGameInWorld({seed:'precise-owned-ocean',worldSeed:'precise-owned-ocean-world',provider:new ScriptedProvider({plans,narrations:[]})});
 await h.game.newRun('Passage giver');let now=h.game.currentRun();
 h.game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
 const world=h.game.atHand,day=routineTime(world);
 const routes=world.locations.filter(p=>p.kind==='settlement').flatMap(from=>publicTransportFrom(world,from.name,day)
  .filter(line=>line.service==='ship'&&line.runsFromDay===null).flatMap(line=>{
   const to=worldLocationFor(world,line.to);if(!to)return[];
   const walking=walkingDaysFrom(world.locations,from.id).get(to.id);if(!walking)return[];
   const boat=aVehicleOf({id:'agreed-ride-held-hull',conveyanceId:'conv-spirit-boat',ownerId:now.cultivator.id,ownerName:now.cultivator.name,at:from.id});
   const quote=priceJourney({walkingDays:walking,conveyance:requireConveyance('conv-spirit-boat'),power:boat.power,heads:3});
   return quote.trips===1&&quote.daysOneWay>2?[{from,to,boat,quote}]:[];
  })).sort((a,b)=>a.quote.daysOneWay-b.quote.daysOneWay);
 const route=routes[0];expect(route,'actual route and capacity').toBeDefined();const {from,to,boat}=route!;
 h.repos.cultivators.update(now.cultivator.id,{location:from.name,standingIn:null,realmOrdinal:29,hp:100000,maxHp:100000,spiritStones:100000});now=h.game.currentRun();
 const goods=world.objects.find(o=>isTracked(o)&&!isRuined(o)&&o.ownerId!==null&&o.ownerId===o.possessorId&&world.npcs.some(n=>n.id===o.ownerId&&n.status==='alive'&&!n.tags.includes(PLAYER_ROW_TAG)));
 expect(goods,'payment uses existing genuinely owned and carried tracked goods').toBeDefined();
 const rider=world.npcs.find(n=>n.id===goods!.ownerId)!;
 const member=world.npcs.find(n=>n.status==='alive'&&n.id!==rider.id&&!n.tags.includes(PLAYER_ROW_TAG))!;
 for(const p of [rider,member]){
  const index=world.npcs.findIndex(n=>n.id===p.id);
  world.npcs[index]={...setRealm(setLocation(p,from.id,day),29,day),spiritStones:1000,
   activity:{kind:'mustering',sinceDay:day,untilDay:day+100,note:'Waiting to discuss the actual journey.',withIds:[],returnTo:from.id}};
 }
 const company=takeThemWithYou(world.npcs,{party:[{id:member.id,name:member.name}],leaderId:now.cultivator.id,note:'An established travelling agreement.',onDay:day,untilDay:null})[0]!;
 world.npcs[world.npcs.findIndex(n=>n.id===member.id)]=company;
 world.objects.push(boat);takeItAlong(world.objects,boat,now.cultivator.id);h.game.theWorldMoved();
 const read=peopleInThisPlace(h.repos,now.cultivator,world,from);expect(read.whereIs.has(rider.id)).toBe(true);
 h.repos.cultivators.standIn(now.cultivator.id,read.whereIs.get(rider.id)!);now=h.game.currentRun();
 expect(h.game.present(now.cultivator).some(n=>n.id===rider.id)).toBe(true);
 for(const p of [rider,member])h.game.theyGaveTheirName(now.cultivator,now.run,p);
 for(const id of [to.id,to.name])h.game.knowledge.learnIfNew({holderId:now.cultivator.id,kind:'place',id,name:to.name,onDay:now.run.elapsedDays,sourceKind:'witnessed',stage:'encountered'});
 const oaths=()=>ledgerAbout(h.db,now.cultivator.id).filter(o=>agreedRideOn(o)?.riderId===rider.id);
 const party=()=>h.game.whoIsWithYouOnTheRoad(h.game.currentRun().cultivator).map(p=>p.id);
 const currentRider=()=>h.game.atHand!.npcs.find(n=>n.id===rider.id)!;
 const actualQuote=quoteAnAirJourney(world.locations,from.id,to.id,requireConveyance('conv-spirit-boat'),boat.power,3,{facts:witnessIndexFor(world).byId,onDay:routineTime(world)});
 expect(actualQuote,'native direct air quote for the already selected actual route').not.toBeNull();
 return {...h,plans,from,to,boat,quote:actualQuote!,rider,member,goods:goods!,oaths,party,currentRider};
}
async function offer(h:Awaited<ReturnType<typeof scene>>,payment:string,utterance?:string){
 const before=h.game.currentRun(),stones=h.currentRider().spiritStones;
 h.plans.push(JSON.stringify({action:'request',intent:'passage',target:h.rider.name,topic:h.to.name}));
 const said=utterance??('I offer '+h.rider.name+' a '+(payment==='free'?'free ':'')+'ride to '+h.to.name+(payment==='free'?'':' for '+payment)+'.');
 const accepted=await h.game.act(said);
 expect(accepted.toolCalls.some(c=>c.name==='world.agreeToPassage'&&c.ok),
  JSON.stringify({calls:accepted.toolCalls,narration:accepted.narration})).toBe(true);
 expect(h.oaths()).toHaveLength(1);expect(h.oaths()[0]!.status).toBe('open');
 expect(h.currentRider().activity?.kind).not.toBe('travelling');expect(h.currentRider().spiritStones).toBe(stones);
 expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
 expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.125,8);
 expect(h.party()).toContain(h.member.id);expect(h.party()).not.toContain(h.rider.id);
}
async function land(h:Awaited<ReturnType<typeof scene>>){
 const departed=h.game.currentRun().run.elapsedDays;
 h.plans.push(JSON.stringify({action:'ride',target:h.to.name,topic:'my spirit boat'}));
 const result=await h.game.act('I ride my spirit boat to '+h.to.name+' with passengers.');
 expect(result.toolCalls.some(c=>c.name==='engine.priceJourney'&&c.ok),JSON.stringify({calls:result.toolCalls,narration:result.narration})).toBe(true);
 expect(h.game.currentRun().run.elapsedDays-departed).toBeLessThanOrEqual(h.quote.daysOneWay+.25+1e-8);
 const accepted=ownedPassageClaim(h.db,h.game.currentRun().cultivator.id);
 const rider=h.currentRider();
 // The played ride may already finish; otherwise follow its real accepted leg.
 const arrival=accepted? rArrival(h):routineTime(h.game.atHand!);
 for(let i=0;i<12&&!journeyTimeHasReached(routineTime(h.game.atHand!),arrival);i++){
  const now=h.game.currentRun(),at=routineTime(h.game.atHand!);
  await passHours(h.game,now.run,now.cultivator,(arrival-at)*24);
  expect(routineTime(h.game.atHand!)).toBeGreaterThan(at);expect(h.game.currentRun().cultivator.alive).toBe(true);
 }
 h.plans.push(JSON.stringify({action:'status'}));await h.game.act('I check my status.');
 const body=h.game.currentRun().cultivator,world=h.game.atHand!,actual=h.currentRider();
 expect(worldLocationFor(world,body.location)?.id).toBe(h.to.id);expect(routineOf(world,actual).locationId).toBe(h.to.id);
 expect(actualBodiesArrivedTogether(world,[{id:body.id,name:body.name,alive:body.alive,locationId:h.to.id},{id:actual.id,name:actual.name,alive:actual.status==='alive',locationId:routineOf(world,actual).locationId}],h.to.id,agreedRideOn(h.oaths()[0]!)!.acceptedWorldDay)).toBe(true);
 expect(h.party()).toContain(h.member.id);expect(h.party()).not.toContain(h.rider.id);
 return {rider,body};
}
function rArrival(h:Awaited<ReturnType<typeof scene>>){
 const a=h.currentRider().activity;expect(a?.kind).toBe('travelling');return a!.untilDay!;
}
for(const payment of ['free','7 spirit stones','goods'] as const){
 it('actual accepted '+payment+' passage exchanges once after shared native landfall',async()=>{
  const h=await scene();try{
   const before=h.game.currentRun().cultivator.spiritStones;
   await offer(h,payment==='goods'?h.goods.name:payment);
   const cash=h.currentRider().spiritStones;
   await land(h);expect(h.oaths()[0]!.status).toBe('settled');
   if(payment==='free'){
    expect(h.game.atHand!.objects.filter(object=>object.tags.includes('passage-tally')&&object.data.vesselId===h.boat.id)).toEqual([]);
    expect(h.game.atHand!.history.facts.filter(fact=>fact.data.vesselId===h.boat.id
     && (fact.data.publicPassage===true||fact.data.passageTallyPurchase===true))).toEqual([]);
   }
   if(payment==='7 spirit stones'){
    expect(h.currentRider().spiritStones).toBe(cash-7);
    expect(h.game.currentRun().cultivator.spiritStones).toBe(before-h.quote.stonesBurned+7);
   }else expect(h.currentRider().spiritStones).toBe(cash);
   if(payment==='goods'){
    const actual=h.game.atHand!.objects.find(o=>o.id===h.goods.id)!;
    expect(actual.ownerId).toBe(h.game.currentRun().cultivator.id);
    expect(actual.provenance.some(e=>e.how==='bought'&&e.source===h.oaths()[0]!.id)).toBe(true);
   }
   const after=h.game.currentRun().cultivator.spiritStones,goods=structuredClone(h.game.atHand!.objects.find(o=>o.id===h.goods.id));
   h.plans.push(JSON.stringify({action:'status'}));await h.game.act('I check my status.');
   expect(h.game.currentRun().cultivator.spiritStones).toBe(after);expect(h.game.atHand!.objects.find(o=>o.id===h.goods.id)).toEqual(goods);expect(h.oaths()).toHaveLength(1);
  }finally{h.db.close();resetCultivationWorlds();}
 },180000);
}
it('an accepted rider who became physically absent is refused before fuel, time or new course',async()=>{
 const h=await scene();try{
  await offer(h,'free');const world=h.game.atHand!,day=routineTime(world),at=world.npcs.findIndex(n=>n.id===h.rider.id);
  world.npcs[at]={...setLocation(world.npcs[at]!,h.to.id,day),activity:null};h.game.theWorldMoved();
  const before=h.game.currentRun(),facts=structuredClone(world.history.facts);
  h.plans.push(JSON.stringify({action:'ride',target:h.to.name,topic:'my spirit boat'}));
  const answer=await h.game.act('I ride my spirit boat to '+h.to.name+' with passengers.');
  expect(answer.toolCalls.some(c=>!c.ok&&c.name==='world.availableForOwnedBoarding')).toBe(true);
  expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
  expect(ownedPassageClaim(h.db,before.cultivator.id)).toBeNull();expect(h.oaths()[0]!.status).toBe('open');expect(world.history.facts).toEqual(facts);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);

it('asking for passengers without actual consent refuses before boarding or any cost',async()=>{
 const h=await scene();try{
  const before=h.game.currentRun(),day=routineTime(h.game.atHand!);
  h.plans.push(JSON.stringify({action:'ride',target:h.to.name,topic:'my spirit boat'}));
  const answer=await h.game.act('I ride my spirit boat to '+h.to.name+' with passengers.');
  expect(answer.toolCalls.some(c=>c.name==='world.availableForOwnedBoarding'&&!c.ok)).toBe(true);
  expect(h.oaths()).toHaveLength(0);expect(ownedPassageClaim(h.db,before.cultivator.id)).toBeNull();
  expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
  expect(routineTime(h.game.atHand!)).toBe(day);expect(h.currentRider().activity?.vesselId).not.toBe(h.boat.id);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);
it('accepting passage does not summon a rider when the driver explicitly travels alone',async()=>{
 const h=await scene();try{
  await offer(h,'7 spirit stones');const cash=h.currentRider().spiritStones;
  h.plans.push(JSON.stringify({action:'ride',target:h.to.name,topic:'my spirit boat'}));
  const answer=await h.game.act('I ride my spirit boat to '+h.to.name+'.');
  expect(answer.toolCalls.some(c=>c.name==='engine.priceJourney'&&c.ok)).toBe(true);
  expect(h.currentRider().activity?.vesselId).not.toBe(h.boat.id);
  expect(h.currentRider().spiritStones).toBe(cash);expect(h.oaths()[0]!.status).toBe('open');
  expect(h.party()).not.toContain(h.rider.id);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);

for(const form of ['free after the destination','take in exchange'] as const){
 it('ordinary '+form+' offer binds validated raw terms and completes real passage',async()=>{
  const h=await scene();try{
   const cash=h.currentRider().spiritStones;
   const raw=form==='free after the destination'?'I offer '+h.rider.name+' a ride aboard my spirit boat to '+h.to.name+' for free.'
    :'I offer to take '+h.rider.name+' to '+h.to.name+' in exchange for 7 spirit stones aboard my craft.';
   await offer(h,form==='free after the destination'?'free':'7 spirit stones',raw);
   expect(agreedRideOn(h.oaths()[0]!)!.payment.kind).toBe(form==='free after the destination'?'free':'stones');
   await land(h);expect(h.oaths()[0]!.status).toBe('settled');
   expect(h.currentRider().spiritStones).toBe(cash-(form==='take in exchange'?7:0));
  }finally{h.db.close();resetCultivationWorlds();}
 },180000);
}
it('a free ride offer requires an actual owned held craft rather than the always available on-foot entry',async()=>{
 const h=await scene();try{
  const world=h.game.atHand!,body=h.game.currentRun().cultivator;
  world.objects=world.objects.filter(o=>o.id!==h.boat.id);h.game.theWorldMoved();
  expect(h.game.whatTheyCouldRide(body).some(row=>row.rowId&&world.objects.some(o=>o.id===row.rowId&&o.ownerId===body.id))).toBe(false);
  const before=h.game.currentRun();h.plans.push(JSON.stringify({action:'request',intent:'passage',target:h.rider.name,topic:h.to.name}));
  const result=await h.game.act('I offer '+h.rider.name+' a free ride to '+h.to.name+'.');
  expect(result.toolCalls.some(c=>c.name==='world.agreeToPassage'&&!c.ok)).toBe(true);expect(h.oaths()).toHaveLength(0);
  expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);
it('an actual overfull hull refuses before receipt, time, fuel or body transfer in both played and native acceptance',async()=>{
 const h=await scene();try{
  const world=h.game.atHand!,day=routineTime(world),body=h.game.currentRun().cultivator;
  const people=world.npcs.filter(n=>n.status==='alive'&&!n.tags.includes(PLAYER_ROW_TAG)).slice(0,requireConveyance('conv-spirit-boat').heads);
  expect(people).toHaveLength(requireConveyance('conv-spirit-boat').heads);
  for(const person of people){const at=world.npcs.findIndex(n=>n.id===person.id);world.npcs[at]={...setRealm(setLocation(person,h.from.id,day),29,day),activity:null};}
  const agreed=takeThemWithYou(world.npcs,{party:people.map(p=>({id:p.id,name:p.name})),leaderId:body.id,note:'Existing actual agreement before first-leg selection.',onDay:day,untilDay:null});
  for(const person of agreed)world.npcs[world.npcs.findIndex(n=>n.id===person.id)]=person;
  h.game.theWorldMoved();const before=h.game.currentRun(),passageFacts=()=>h.game.atHand!.history.facts.filter(f=>f.data?.ownedPassage===true),facts=structuredClone(passageFacts());
  const physical=()=>people.map(p=>{const n=h.game.atHand!.npcs.find(n=>n.id===p.id)!;return {id:n.id,status:n.status,location:routineOf(h.game.atHand!,n).locationId,kind:n.activity?.kind,since:n.activity?.sinceDay,vessel:n.activity?.vesselId};});const rows=physical();
  h.plans.push(JSON.stringify({action:'ride',target:h.to.name,topic:'my spirit boat'}));
  const result=await h.game.act('I ride my spirit boat to '+h.to.name+' with my party.');
  expect(result.toolCalls.some(c=>c.name==='engine.priceJourney'&&!c.ok)).toBe(true);
  expect(result.narration).toContain(String(requireConveyance('conv-spirit-boat').heads));expect(result.narration).toContain(String(people.length+1));
  expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  expect(physical()).toEqual(rows);expect(ownedPassageClaim(h.db,body.id)).toBeNull();expect(passageFacts()).toEqual(facts);
  const walking=walkingDaysFrom(world.locations,h.from.id).get(h.to.id)!;
  expect(()=>acceptOwnedPassage(h.game,before.run,before.cultivator,{vesselId:h.boat.id,pilotId:body.id,fromId:h.from.id,toId:h.to.id,walkingDays:walking,days:h.quote.daysOneWay,conveyanceId:'conv-spirit-boat',power:h.boat.power,companions:people.map(p=>p.id)})).toThrow(/exceed this leg capacity/);
  expect(physical()).toEqual(rows);expect(ownedPassageClaim(h.db,body.id)).toBeNull();expect(passageFacts()).toEqual(facts);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);
it('explicit first leg, fuelled return alone and second load are three actual courses without summoning the waiting rider',async()=>{
 const h=await scene();try{
  const world=h.game.atHand!,body=h.game.currentRun().cultivator,day=routineTime(world);
  const second=world.npcs.find(n=>n.status==='alive'&&!n.tags.includes(PLAYER_ROW_TAG)&&n.id!==h.member.id&&n.id!==h.rider.id)!;expect(second).toBeDefined();
  const index=world.npcs.findIndex(n=>n.id===second.id);world.npcs[index]={...setRealm(setLocation(second,h.from.id,day),29,day),activity:{kind:'mustering',note:'Waiting for the actual later leg.',withIds:[],sinceDay:day,untilDay:null}};
  h.game.theWorldMoved();const secondRow=()=>h.game.atHand!.npcs.find(n=>n.id===second.id)!;
  const secondOaths=()=>ledgerAbout(h.db,body.id).filter(o=>agreedRideOn(o)?.riderId===second.id);
  const firstRead=peopleInThisPlace(h.repos,h.game.currentRun().cultivator,h.game.atHand!,h.from);
  expect(firstRead.whereIs.has(h.rider.id)).toBe(true);
  h.repos.cultivators.standIn(body.id,firstRead.whereIs.get(h.rider.id)!);
  expect(h.game.present(h.game.currentRun().cultivator).some(p=>p.id===h.rider.id)).toBe(true);
  await offer(h,'free');let now=h.game.currentRun();
  const read=peopleInThisPlace(h.repos,now.cultivator,h.game.atHand!,h.from);expect(read.whereIs.has(second.id)).toBe(true);
  h.repos.cultivators.standIn(body.id,read.whereIs.get(second.id)!);now=h.game.currentRun();h.game.theyGaveTheirName(now.cultivator,now.run,secondRow());
  const h2={...h,rider:second,currentRider:secondRow,oaths:secondOaths};await offer(h2,'free');
  for(const id of [h.from.id,h.from.name])h.game.knowledge.learnIfNew({holderId:body.id,kind:'place',id,name:h.from.name,onDay:now.run.elapsedDays,sourceKind:'witnessed',stage:'encountered'});
  const start=h.game.currentRun(),started=routineTime(h.game.atHand!);let burned=0,gatePayments=0,quotedDays=0;
  async function leg(to:typeof h.to,names:string[],alone=false){
   const current=h.game.currentRun(),at=routineTime(h.game.atHand!),from=worldLocationFor(h.game.atHand!,current.cultivator.location)!;
   const quote=quoteAnAirJourney(h.game.atHand!.locations,from.id,to.id,requireConveyance('conv-spirit-boat'),h.boat.power,1+names.length,{facts:witnessIndexFor(h.game.atHand!).byId,onDay:at});
   expect(quote,'actual direct air quote for this explicit leg').not.toBeNull();expect(quote!.trips).toBe(1);
   const purse=current.cultivator.spiritStones,factsBefore=new Set(h.game.atHand!.history.facts.map(f=>f.id));
   h.plans.push(JSON.stringify({action:'ride',target:to.name,topic:'my spirit boat'}));
   const result=await h.game.act('I ride my spirit boat to '+to.name+(alone?' alone.':' with '+names.join(' and ')+'.'));
   expect(result.toolCalls.some(c=>c.name==='engine.priceJourney'&&c.ok),JSON.stringify({calls:result.toolCalls,narration:result.narration})).toBe(true);
   for(let i=0;i<12&&ownedPassageClaim(h.db,body.id);i++){
    const claim=ownedPassageClaim(h.db,body.id)!,fact=h.game.atHand!.history.facts.find(f=>f.id===claim.receiptId)!;
    const arrival=Number(fact.data.arrivalDay),moment=routineTime(h.game.atHand!);if(journeyTimeHasReached(moment,arrival))break;
    const fresh=h.game.currentRun();await passHours(h.game,fresh.run,fresh.cultivator,(arrival-moment)*24);
    h.plans.push(JSON.stringify({action:'status'}));await h.game.act('I check my status.');
   }
   h.plans.push(JSON.stringify({action:'status'}));await h.game.act('I check my status.');
   expect(worldLocationFor(h.game.atHand!,h.game.currentRun().cultivator.location)?.id).toBe(to.id);
   expect(routineTime(h.game.atHand!)-at).toBeGreaterThanOrEqual(quote!.daysOneWay-1e-8);quotedDays+=quote!.daysOneWay;
   const registrations=h.game.atHand!.history.facts.filter(f=>!factsBefore.has(f.id)
    &&f.data.gateRegistration===true&&f.data.gateRegistrant===body.id&&typeof f.data.stones==='number');
   for(const registration of registrations)
    expect(registration.data.stones).toBe(stonesForACashPrice(getPrice('price-gate-registration')!.cash));
   const fees=registrations.reduce((sum,f)=>sum+Number(f.data.stones),0);
   expect(purse-h.game.currentRun().cultivator.spiritStones).toBe(quote!.stonesBurned+fees);
   burned+=quote!.stonesBurned;gatePayments+=fees;
  }
  await leg(h.to,[h.member.name,h.rider.name]);
  expect(h.oaths()[0]!.status).toBe('settled');expect(secondOaths()[0]!.status).toBe('open');
  expect(routineOf(h.game.atHand!,secondRow()).locationId).toBe(h.from.id);expect(secondRow().activity?.vesselId).not.toBe(h.boat.id);
  expect(h.party()).toContain(h.member.id);expect(h.party()).not.toContain(second.id);
  await leg(h.from,[],true);
  const first=h.game.atHand!.npcs.find(n=>n.id===h.rider.id)!,member=h.game.atHand!.npcs.find(n=>n.id===h.member.id)!;
  expect(routineOf(h.game.atHand!,first).locationId).toBe(h.to.id);expect(routineOf(h.game.atHand!,member).locationId).toBe(h.to.id);
  expect(secondOaths()[0]!.status).toBe('open');expect(h.party()).toContain(h.member.id);
  await leg(h.to,[second.name]);expect(secondOaths()[0]!.status).toBe('settled');expect(h.oaths()[0]!.status).toBe('settled');
  expect(start.cultivator.spiritStones-h.game.currentRun().cultivator.spiritStones).toBe(burned+gatePayments);expect(burned).toBeGreaterThan(0);
  expect(routineTime(h.game.atHand!)-started).toBeGreaterThanOrEqual(quotedDays-1e-8);
  expect(h.game.atHand!.history.facts.filter(f=>f.data?.ownedPassage===true&&f.data.ownerId===body.id&&f.day>=started)).toHaveLength(3);
  expect(h.party()).toContain(h.member.id);expect(h.party()).not.toContain(second.id);
 }finally{h.db.close();resetCultivationWorlds();}
},240000);

it("a paid public tally in the pack does not obtain consent for someone else\'s private craft",async()=>{
 const h=await scene();try{
  const world=h.game.atHand!,day=routineTime(world),rider=h.currentRider();
  const line=publicTransportFrom(world,h.from.name,day).find(line=>line.service==='carriage')!;
  expect(line,'the ticket names an actual advertised public road service').toBeDefined();
  const destination=world.locations.find(place=>place.name===line.to)!;
  const offer=offerTheNextPublicCarriage(world,h.from.id,destination.id,rider.id)!;
  expect(offer).not.toBeNull();
  const driver=acceptPublicCarriageOffer(world,offer)!;
  expect(driver).not.toBeNull();
  const terms={...offer.departure.terms,seat:offer.seat,fareStones:offer.departure.fareStones};
  expect(transferActualSpiritStones(h.game,rider.id,driver.id,terms.fareStones).ok).toBe(true);
  const purchase=appendWorldFact(world,makeFact({day,kind:'gathering',locationId:h.from.id,
   summary:'A public passage seat was bought.',actors:[{id:rider.id,name:rider.name,role:'buyer'},
    {id:driver.id,name:driver.name,role:'carrier'}],data:{passageTallyPurchase:true,
     service:terms.service,vesselId:terms.vesselId,fromLocationId:terms.fromId,toLocationId:terms.toId,
     departureDay:terms.departureDay,seat:terms.seat,fareStones:terms.fareStones}}),{bystanders:false,recur:false});
  const tally=makePassageTally({terms,buyer:rider,fromName:h.from.name,
   toName:world.locations.find(place=>place.id===terms.toId)!.name,onDay:day,purchase});
  world.objects.push(tally);h.game.theWorldMoved();
  const before=h.game.currentRun();
  h.plans.push(JSON.stringify({action:'ride',target:h.to.name,topic:'my spirit boat'}));
  const refused=await h.game.act('I ride my spirit boat to '+h.to.name+' with '+rider.name+'.');
  expect(refused.toolCalls.some(call=>call.name==='world.availableForOwnedBoarding'&&!call.ok),refused.narration).toBe(true);
  expect(h.oaths()).toHaveLength(0);expect(ownedPassageClaim(h.db,before.cultivator.id)).toBeNull();
  expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
  expect(world.objects.find(object=>object.id===tally.id)?.possessorId).toBe(rider.id);
  expect(h.currentRider().activity?.vesselId).not.toBe(h.boat.id);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);

/** A public landfall is an arranged payment-scene precondition, never a private ride outcome. */
it('a shared public arrival does not complete or charge an earlier private ride agreement',async()=>{
 const h=await scene();try{
  await offer(h,'7 spirit stones');
  const before=h.game.currentRun(),world=h.game.atHand!,day=routineTime(world),rider=h.currentRider();
  const line=publicShipLinesFrom(world,h.from.name,day).find(line=>line.to===h.to.name)!;
  expect(line,'the payment scene follows a real public lane').toBeDefined();
  const quote=quotePublicPassage(world,h.from.id,h.to.id,day,2)!;
  expect(quote).not.toBeNull();
  const crew=ensureShipCrew(world,quote.lane,h.from.id,day);
  const operator=crew.find(person=>person.identity.occupation==='shipmaster')!;
  bindShipCrewToPassage(world,quote);
  expect(realiseAcceptedPublicShipHull(world,quote,world.npcs.find(person=>person.id===operator.id)!)).not.toBeNull();
  const passengers=[{id:before.cultivator.id,name:before.cultivator.name},{id:rider.id,name:rider.name}];
  const receipt=recordPublicPassage(world,quote,day,h.from.id,
   [...passengers.map(person=>person.id),...crew.map(person=>person.id)],undefined,
   {runId:before.run.id,elapsedDays:before.run.elapsedDays},passengers,undefined,false,
   accepted=>{expect(buyTalliesForActualPublicBoarding(h.game,accepted,before.cultivator,passengers,quote.fareStones),
    'actual public tally purchase at the real carrier').toBe(true);});
  // This control starts its observation with both bodies already at the public landing.
  // The canonical writer accepts only their actual destination and the finite quoted date.
  world.currentDay=Math.floor(quote.arrivalDay);world.currentHour=(quote.arrivalDay-world.currentDay)*24;
  placeShipCrew(world,quote.lane,h.to.id,quote.arrivalDay);
  const at=world.npcs.findIndex(person=>person.id===rider.id);
  world.npcs[at]=setLocation({...world.npcs[at]!,activity:{...activityOfAPublicPassage(quote,'The paid public passage ended.'),
   untilDay:quote.arrivalDay}},h.to.id,quote.arrivalDay);
  h.game.repos.cultivators.update(before.cultivator.id,{location:h.to.name,standingIn:null,
   age:before.cultivator.age+quote.days/365});
  h.game.repos.runs.advanceDays(before.run.id,quote.days);
  const bodies=passengers.map(person=>({...person,alive:true,locationId:h.to.id}));
  for(const body of bodies)expect(recordActualBodyArrival(world,body,arrivalCourseOfFact(receipt),quote.arrivalDay,receipt)).not.toBeNull();
  expect(actualBodiesArrivedTogether(world,bodies,h.to.id,day),'the two canonical public arrivals share their actual course').toBe(true);
  h.game.theWorldMoved();
  const seen=await h.game.act('I look around');
  expect(h.oaths()).toHaveLength(1);
  expect(h.oaths()[0]!.status,seen.narration).toBe('open');
  expect(seen.narration).not.toContain('paid the agreed 7 spirit stones');
 }finally{h.db.close();resetCultivationWorlds();}
});
