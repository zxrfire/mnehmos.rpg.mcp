/** Captain agreement audit found RidePayment and native shared-arrival settlement
 * already exist, but their adapter only accepted the played driver/NPC rider.
 * This component control reverses payment participants on a genuine accepted
 * owned course with an actual NPC pilot. It uses original RideCoherent actual
 * world/body/held-hull setup and native clocks/arrival receipts; no SQL NPC,
 * fake landfall, public-price exception or guaranteed captain consent.
 * Direct binding below represents already-resolved consent, not proof of
 * unforced dialogue acceptance. The existing captain frontdoor controls remain
 * required alongside these payment conservation controls. Union repairs the
 * obsolete provisioning call through its current native purchase/pack API, and
 * binds actual direct-air acceptance rather than pricing an unrelated road leg.
 * Immediate course change and onward agreement share preflight/binding; effect
 * success records terms without a second purse read discarding the oath. Checks unrun.
 * Actual environmental relief remains unbuilt: wounds do not imply arrival heals.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { prepareWorldClockForPreciseSpan, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { setLocation, setRealm, markDead, PLAYER_ROW_TAG } from '../../src/engine/world/npc-state.js';
import { takeThemWithYou } from '../../src/engine/world/who-is-on-the-road-with-you.js';
import { publicTransportFrom } from '../../src/engine/world/public-transport-at-a-place.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { quoteAnAirJourney } from '../../src/engine/world/what-an-air-journey-takes.js';
import { witnessIndexFor } from '../../src/engine/world/witness-reaction-index.js';
import { LI_PER_WALKING_DAY } from '../../src/engine/world/the-metric-ground-under-a-journey.js';
import { walkingDaysFrom } from '../../src/engine/world/locations.js';
import { priceJourney } from '../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import { requireConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { aVehicleOf, takeItAlong } from '../../src/engine/world/a-vehicle.js';
import { isTracked, isRuined, transferPossession } from '../../src/engine/world/possessions.js';
import { ownedPassageClaim, acceptOwnedPassage } from '../../src/web/an-owned-passage.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { agreedRideOn, bindAgreedRide, settleAgreedRides } from '../../src/web/an-offered-ride-is-an-agreement.js';
import { preparePrivateOperatorTerms } from '../../src/web/negotiating-with-an-actual-private-operator.js';
import { withTheAttemptLanding } from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
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
 for(const place of [from,to])for(const id of [place.id,place.name])h.game.knowledge.learnIfNew({holderId:now.cultivator.id,kind:'place',id,name:place.name,onDay:now.run.elapsedDays,sourceKind:'witnessed',stage:'encountered'});
 const oaths=()=>ledgerAbout(h.db,now.cultivator.id).filter(o=>agreedRideOn(o)?.riderId===rider.id);
 const party=()=>h.game.whoIsWithYouOnTheRoad(h.game.currentRun().cultivator).map(p=>p.id);
 const currentRider=()=>h.game.atHand!.npcs.find(n=>n.id===rider.id)!;
 const actualQuote=quoteAnAirJourney(world.locations,from.id,to.id,requireConveyance('conv-spirit-boat'),boat.power,3,{facts:witnessIndexFor(world).byId,onDay:routineTime(world)});
 expect(actualQuote,'native direct air quote for the already selected actual route').not.toBeNull();
 return {...h,plans,from,to,boat,quote:actualQuote!,rider,member,goods:goods!,oaths,party,currentRider};
}

async function accepted(air=true) {
 const h=await scene(),now=h.game.currentRun(),world=h.game.atHand!,pilot=world.npcs.find(n=>n.id===h.member.id)!;
 // Ordinary purchase supplies the actual food source. No stock count is authored.
 const purchased=h.game.buyProvisions(now.cultivator,60);
 h.game.putBackWhatWasNotEaten(purchased.cultivator,{endState:{rationsRemaining:purchased.rations}});
 const current=h.game.currentRun();
 const quote=quoteAnAirJourney(world.locations,h.from.id,h.to.id,requireConveyance('conv-spirit-boat'),h.boat.power,2,
  {facts:witnessIndexFor(world).byId,onDay:routineTime(world)});
 expect(quote,'actual accepted private air course').not.toBeNull();
 if(!quote)throw new Error('No actual private air course');
 const walking=walkingDaysFrom(world.locations,h.from.id).get(h.to.id)!;
 const acceptedDays=air?quote.daysForEverybody:priceJourney({walkingDays:walking,conveyance:requireConveyance('conv-spirit-boat'),power:h.boat.power,heads:2}).daysForEverybody;
 const receipt=acceptOwnedPassage(h.game,current.run,current.cultivator,{vesselId:h.boat.id,pilotId:pilot.id,
  fromId:h.from.id,toId:h.to.id,walkingDays:air?quote.distanceLi/LI_PER_WALKING_DAY:walking,days:acceptedDays,conveyanceId:'conv-spirit-boat',
  power:h.boat.power,companions:[pilot.id],air});
 const actual=witnessIndexFor(world).byId.get(receipt);
 expect(typeof actual?.data.arrivalDay).toBe('number');
 const first=h.game.currentRun();
 const portion=await passHours(h.game,first.run,first.cultivator,3);
 expect(portion.finished,JSON.stringify(portion.spent?.calls)).toBe(true);
 const physical=worldLocationFor(world,h.game.currentRun().cultivator.location);
 expect(physical,'accepted actual craft ground').not.toBeNull();
 const at=peopleInThisPlace(h.repos,h.game.currentRun().cultivator,world,physical!).whereIs.get(pilot.id);
 expect(at,'actual accepted pilot area').toBeDefined();h.repos.cultivators.standIn(current.cultivator.id,at!);
 expect(h.game.present(h.game.currentRun().cultivator).some(n=>n.id===pilot.id)).toBe(true);
 return {...h,pilot,receipt,arrival:Number(actual!.data.arrivalDay)};
}
async function landed(h:Awaited<ReturnType<typeof accepted>>) {
 while(!journeyTimeHasReached(routineTime(h.game.atHand!),h.arrival)){
  const now=h.game.currentRun(),before=routineTime(h.game.atHand!);
  expect(now.cultivator.alive).toBe(true);expect(ownedPassageClaim(h.db,now.cultivator.id)).not.toBeNull();
  await passHours(h.game,now.run,now.cultivator,(h.arrival-before)*24);
  expect(routineTime(h.game.atHand!)).toBeGreaterThan(before);
 }
 expect(worldLocationFor(h.game.atHand!,h.game.currentRun().cultivator.location)?.id).toBe(h.to.id);
}
for(const medium of ['stones','goods','free'] as const){
 it('actual NPC operator and PC rider exchange '+medium+' once only at native shared arrival',async()=>{
  const h=await accepted();try{
   const body=h.game.currentRun().cultivator,world=h.game.atHand!,cash=body.spiritStones;
   const pilotCash=world.npcs.find(n=>n.id===h.pilot.id)!.spiritStones;
   let payment='7 spirit stones';
   if(medium==='free')payment='free';
   if(medium==='goods'){
    const index=world.objects.findIndex(o=>o.id===h.goods.id);
    world.objects[index]=transferPossession(world.objects[index]!,{onDay:routineTime(world),toHolderId:body.id,toHolderName:body.name,
     how:'bought',transfersOwnership:true,source:'operator-payment-control',note:'Actual existing payment goods arranged for the played payer.'});
    payment=h.goods.name;
   }
   const prepared=preparePrivateOperatorTerms(h.game,body,h.pilot.id,h.to.id,payment);
   expect('terms' in prepared).toBe(true);if(!('terms' in prepared))throw new Error(prepared.reason);
   bindAgreedRide(h.game,h.pilot,body,prepared.terms,h.to.name);
   const oath=()=>ledgerAbout(h.db,body.id).find(o=>agreedRideOn(o)?.driverId===h.pilot.id)!;
   expect(settleAgreedRides(h.game,body)).toBeNull();expect(oath().status).toBe('open');
   expect(h.game.currentRun().cultivator.spiritStones).toBe(cash);
   expect(world.npcs.find(n=>n.id===h.pilot.id)!.spiritStones).toBe(pilotCash);
   await landed(h);const beforePayment=h.game.currentRun().cultivator.spiritStones;
   settleAgreedRides(h.game,h.game.currentRun().cultivator);expect(oath().status).toBe('settled');
   expect(h.game.currentRun().cultivator.spiritStones).toBe(beforePayment-(medium==='stones'?7:0));
   expect(world.npcs.find(n=>n.id===h.pilot.id)!.spiritStones).toBe(pilotCash+(medium==='stones'?7:0));
   if(medium==='goods')expect(world.objects.find(o=>o.id===h.goods.id)?.ownerId).toBe(h.pilot.id);
   const paid=h.game.currentRun().cultivator.spiritStones,goods=structuredClone(world.objects.find(o=>o.id===h.goods.id));
   expect(settleAgreedRides(h.game,h.game.currentRun().cultivator)).toBeNull();
   expect(h.game.currentRun().cultivator.spiritStones).toBe(paid);expect(world.objects.find(o=>o.id===h.goods.id)).toEqual(goods);
  }finally{h.db.close();resetCultivationWorlds();}
 },180000);
}
it('unavailable actual operator cannot bind a personal price or transfer goods before arrival',async()=>{
 const h=await accepted();try{
  const world=h.game.atHand!,body=h.game.currentRun().cultivator,before=body.spiritStones,objects=structuredClone(world.objects);
  const index=world.npcs.findIndex(n=>n.id===h.pilot.id);world.npcs[index]=markDead(world.npcs[index]!,routineTime(world),'Actual component operator unavailable through native death.');
  const result=preparePrivateOperatorTerms(h.game,body,h.pilot.id,h.to.id,'free');expect('reason' in result).toBe(true);
  expect(settleAgreedRides(h.game,body)).toBeNull();expect(h.game.currentRun().cultivator.spiritStones).toBe(before);
  expect(world.objects).toEqual(objects);expect(ledgerAbout(h.db,body.id).some(o=>agreedRideOn(o)?.driverId===h.pilot.id)).toBe(false);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);
it('played captain request binds explicit private service terms after the real reply without paying or waiving fuel',async()=>{
 const h=await accepted();try{
  const now=h.game.currentRun(),oldClaim=ownedPassageClaim(h.db,now.cultivator.id),cash=now.cultivator.spiritStones;
  h.plans.push(JSON.stringify({action:'request',intent:'course_change',target:h.pilot.name,
   topic:'take me back to '+h.from.name+' for 7 spirit stones'}));
  // Existing ADMIN draw pins acceptance only; native readiness, time, course,
  // capacity, custody and funds remain authoritative, not an unforced yes claim.
  const answer=(await withTheAttemptLanding('request',()=>h.game.act('I ask '+h.pilot.name+
   ' to take me back to '+h.from.name+' for 7 spirit stones.'))).result;
  expect(answer.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(answer.toolCalls)).toBe('model');
  expect(answer.toolCalls.some(call=>call.name==='engine.actualCaptainCourse'&&call.ok),JSON.stringify(answer.toolCalls)).toBe(true);
  const oath=ledgerAbout(h.db,now.cultivator.id).find(row=>agreedRideOn(row)?.driverId===h.pilot.id);
  expect(oath?.status).toBe('open');expect(agreedRideOn(oath!)?.payment).toEqual({kind:'stones',stones:7});
  expect(h.game.currentRun().run.elapsedDays-now.run.elapsedDays).toBeCloseTo(.125,12);
  expect(h.game.currentRun().run.turn-now.run.turn).toBe(1);
  const currentClaim=ownedPassageClaim(h.db,now.cultivator.id);
  expect(currentClaim).not.toBeNull();expect(currentClaim?.receiptId).not.toBe(oldClaim?.receiptId);
  const actual=witnessIndexFor(h.game.atHand!).byId.get(currentClaim!.receiptId);
  expect(actual?.causes).toContain(oldClaim!.receiptId);
  expect(actual?.data.toLocationId).toBe(h.from.id);
  expect(actual?.data.vesselId).toBe(h.boat.id);expect(actual?.data.pilotId).toBe(h.pilot.id);
  // Native private fuel can burn during the reply. No extra service payment
  // occurs until the independently dated changed course actually reaches home.
  expect(h.game.currentRun().cultivator.spiritStones).toBeLessThanOrEqual(cash);
  expect(settleAgreedRides(h.game,h.game.currentRun().cultivator)).toBeNull();
  expect(h.game.atHand!.objects.find(object=>object.id===h.boat.id)?.ownerId).toBe(now.cultivator.id);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);
for(const air of [false,true])for(const medium of ['stones','goods','free'] as const){
 it('played private '+(air?'immediate change':'onward word')+' retains accepted '+medium+' terms without early exchange',async()=>{
  const h=await accepted(air);try{
   const now=h.game.currentRun(),old=ownedPassageClaim(h.db,now.cultivator.id)!,world=h.game.atHand!;
   let payment=medium==='free'?'free':'7 spirit stones';
   if(medium==='goods'){
    const i=world.objects.findIndex(o=>o.id===h.goods.id);
    world.objects[i]=transferPossession(world.objects[i]!,{onDay:routineTime(world),toHolderId:now.cultivator.id,
     toHolderName:now.cultivator.name,how:'bought',transfersOwnership:true,source:'actual-operator-price-control',
     note:'The existing tracked goods are in the actual played payer custody.'});payment=h.goods.name;
   }
   const owner=world.objects.find(o=>o.id===h.boat.id)!.ownerId,pilotCash=world.npcs.find(n=>n.id===h.pilot.id)!.spiritStones;
   h.plans.push(JSON.stringify({action:'request',intent:'course_change',target:h.pilot.name,
    topic:'take me back to '+h.from.name+' for '+payment}));
   // ADMIN lands the ordinary seeded attempt only. The supported model plan
   // selects the request; current bodies, custody, route and resources decide its effect.
   const answer=(await withTheAttemptLanding('request',()=>h.game.act('I ask '+h.pilot.name+
    ' to take me back to '+h.from.name+' for '+payment+'.'))).result;
   expect(answer.toolCalls.find(c=>c.name==='narrator.plan')?.source,JSON.stringify(answer.toolCalls)).toBe('model');
   expect(answer.toolCalls.some(c=>c.name==='engine.resolveAttempt'),JSON.stringify(answer.toolCalls)).toBe(true);
   expect(answer.toolCalls.some(c=>c.name==='engine.actualCaptainCourse'&&c.ok),JSON.stringify(answer.toolCalls)).toBe(true);
   const oath=ledgerAbout(h.db,now.cultivator.id).find(o=>agreedRideOn(o)?.driverId===h.pilot.id)!;
   expect(oath?.status).toBe('open');const terms=agreedRideOn(oath)!;
   expect(terms.payment.kind).toBe(medium);expect(terms.toId).toBe(h.from.id);
   expect(h.game.currentRun().run.elapsedDays-now.run.elapsedDays).toBeCloseTo(.125,12);
   expect(h.game.currentRun().run.turn-now.run.turn).toBe(1);
   expect(world.npcs.find(n=>n.id===h.pilot.id)!.spiritStones).toBe(pilotCash);
   expect(world.objects.find(o=>o.id===h.boat.id)!.ownerId).toBe(owner);
   if(medium==='goods')expect(world.objects.find(o=>o.id===h.goods.id)!.ownerId).toBe(now.cultivator.id);
   if(air){const next=ownedPassageClaim(h.db,now.cultivator.id)!;expect(next.receiptId).not.toBe(old.receiptId);
    expect(witnessIndexFor(world).byId.get(next.receiptId)?.causes).toContain(old.receiptId);}
   else{expect(ownedPassageClaim(h.db,now.cultivator.id)).toEqual(old);
    expect(world.history.facts.some(f=>f.data.captainOnwardAgreement===true&&f.data.service==='owned'&&f.causes.includes(old.receiptId))).toBe(true);}
   expect(settleAgreedRides(h.game,h.game.currentRun().cultivator)).toBeNull();
  }finally{h.db.close();resetCultivationWorlds();}
 },180000);
}
it('a real changed private course retains accepted payment terms after subsequent actual payer shortage',async()=>{
 const h=await accepted();try{
  const now=h.game.currentRun(),old=ownedPassageClaim(h.db,now.cultivator.id)!;
  h.plans.push(JSON.stringify({action:'request',intent:'course_change',target:h.pilot.name,
   topic:'take me back to '+h.from.name+' for 7 spirit stones'}));
  const result=(await withTheAttemptLanding('request',()=>h.game.act('I ask '+h.pilot.name+
   ' to take me back to '+h.from.name+' for 7 spirit stones.'))).result;
  expect(result.toolCalls.find(c=>c.name==='narrator.plan')?.source,JSON.stringify(result.toolCalls)).toBe('model');
  expect(result.toolCalls.some(c=>c.name==='engine.actualCaptainCourse'&&c.ok),JSON.stringify(result.toolCalls)).toBe(true);
  const claim=ownedPassageClaim(h.db,now.cultivator.id)!;
  expect(claim.receiptId).not.toBe(old.receiptId);
  expect(witnessIndexFor(h.game.atHand!).byId.get(claim.receiptId)?.causes).toContain(old.receiptId);
  const oath=()=>ledgerAbout(h.db,now.cultivator.id).find(row=>agreedRideOn(row)?.driverId===h.pilot.id)!;
  expect(oath().status).toBe('open');expect(agreedRideOn(oath())?.payment).toEqual({kind:'stones',stones:7});
  // Actual purse mutation is ADMIN arrangement of later shortage, not a fake
  // fuel debit or consent effect. No synchronous course-change debit exists.
  const cash=h.game.currentRun().cultivator.spiritStones;
  h.repos.cultivators.applyDeltas(now.cultivator.id,{spiritStones:-cash});
  expect(oath().status).toBe('open');
  expect(agreedRideOn(oath())?.payment).toEqual({kind:'stones',stones:7});
  expect(settleAgreedRides(h.game,h.game.currentRun().cultivator)).toBeNull();
  expect(ownedPassageClaim(h.db,now.cultivator.id)?.receiptId).toBe(claim.receiptId);
  expect(h.game.atHand!.objects.find(o=>o.id===h.boat.id)?.ownerId).toBe(now.cultivator.id);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);
it('a payer whose current purse is short at real landfall leaves the same oath open and transfers nothing',async()=>{
 const h=await accepted();try{
  const body=h.game.currentRun().cultivator,prepared=preparePrivateOperatorTerms(h.game,body,h.pilot.id,h.to.id,'7 spirit stones');
  expect('terms' in prepared).toBe(true);if(!('terms' in prepared))throw new Error(prepared.reason);
  bindAgreedRide(h.game,h.pilot,body,prepared.terms,h.to.name);await landed(h);
  const available=h.game.currentRun().cultivator.spiritStones;
  h.repos.cultivators.applyDeltas(body.id,{spiritStones:-available});
  const before=h.game.atHand!.npcs.find(n=>n.id===h.pilot.id)!.spiritStones;
  const result=settleAgreedRides(h.game,h.game.currentRun().cultivator);
  expect(result?.lines.some(line=>line.includes('7 short'))).toBe(true);
  expect(h.game.atHand!.npcs.find(n=>n.id===h.pilot.id)!.spiritStones).toBe(before);
  expect(ledgerAbout(h.db,body.id).find(row=>agreedRideOn(row)?.driverId===h.pilot.id)?.status).toBe('open');
 }finally{h.db.close();resetCultivationWorlds();}
},180000);
it('goods no longer in the actual payer custody do not settle even after native shared arrival',async()=>{
 const h=await accepted();try{
  const body=h.game.currentRun().cultivator,world=h.game.atHand!,index=world.objects.findIndex(o=>o.id===h.goods.id);
  world.objects[index]=transferPossession(world.objects[index]!,{onDay:routineTime(world),toHolderId:body.id,toHolderName:body.name,
   how:'bought',transfersOwnership:true,source:'operator-payment-control',note:'Existing tracked goods arranged for the actual payer.'});
  const prepared=preparePrivateOperatorTerms(h.game,body,h.pilot.id,h.to.id,h.goods.name);
  expect('terms' in prepared).toBe(true);if(!('terms' in prepared))throw new Error(prepared.reason);
  bindAgreedRide(h.game,h.pilot,body,prepared.terms,h.to.name);
  world.objects[index]=transferPossession(world.objects[index]!,{onDay:routineTime(world),toHolderId:h.rider.id,toHolderName:h.rider.name,
   how:'bought',transfersOwnership:true,source:'operator-payment-unavailable-control',note:'Actual payer no longer owns and carries the promised goods.'});
  await landed(h);const actual=structuredClone(world.objects.find(o=>o.id===h.goods.id));
  expect(settleAgreedRides(h.game,h.game.currentRun().cultivator)?.lines.some(line=>line.includes('no longer owns and carries'))).toBe(true);
  expect(world.objects.find(o=>o.id===h.goods.id)).toEqual(actual);
  expect(ledgerAbout(h.db,body.id).find(row=>agreedRideOn(row)?.driverId===h.pilot.id)?.status).toBe('open');
 }finally{h.db.close();resetCultivationWorlds();}
},180000);
