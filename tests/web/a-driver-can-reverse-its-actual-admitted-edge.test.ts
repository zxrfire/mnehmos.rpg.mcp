import {stoppedRoadPoint} from '../../src/engine/world/where-a-carriage-stopped.js';
import {sameRoadPosition} from '../../src/engine/world/road-course.js';
import {stoppedRoadFor} from '../../src/web/a-road-stopped-partway.js';
/** The driver's actual admitted edge is the sole carriage geometry. A paid
 * passenger can ASK for a reversal, not command it by changing a coarse place
 * name. The routed positive lands only ordinary consent administratively; the
 * native graph, body span, same driver/hull, resource and historical receipt
 * authorities still perform the whole movement. A native source death during
 * that request cannot commit a reverse course or mint another driver.
 * Diagnostic 16649 measured a false death control: deleting founding uniform
 * objects made the native opening day -Infinity, enabled year-zero contact
 * practice, and reset the arranged driver lifespan/body day. Preserve those
 * real objects. Its other failed setup closed a CITY-to-PARENT containment
 * step, whose native reverse cost is one despite no explicit raw link. The
 * closed-road control now advances this same accepted carriage to an actual
 * directed edge before closing that edge. Neither finding changes mortality
 * or containment authority. Native05 proved accepted reversal and genuine explicit closed reverse; the expiry control reached actual death and only its historical-owner assertion failed. Diagnostic07 measured forgotten driver and scrubbed historical driverId. Diagnostic76319 then measured point erasure: the rider and hull returned to the origin, both cursors disappeared, and another driver could sell the same hull for fare9. Dead title/history may legitimately be forgotten. The required invariant is the actually reached partial road, no origin reboarding, no new reverse, and unchanged paid resources. The loss site holds the immutable point; the SQL cursor only references it.
 * Partial edge time retains its original
 * actual admitted pace; any route beyond its reached endpoint uses the native
 * remaining-route quote once. New receipts capture the native original walking
 * quote; missing legacy historic price inputs cannot be fabricated.
 */
import {expect,it} from 'vitest';
import {makeGame,ScriptedProvider} from './harness.js';
import {ProviderNarrator} from '../../src/web/narrator.js';
import {createWorld,resetCultivationWorlds,prepareWorldClockForPreciseSpan} from '../../src/server/state/cultivation-world.js';
import {createNpc,PLAYER_ROW_TAG} from '../../src/engine/world/npc-state.js';
import {publicTransportFrom} from '../../src/engine/world/public-transport-at-a-place.js';
import {quotePublicCarriage,commitPublicCarriage,publicCarriagePassage,quoteActualCarriageReturn} from '../../src/engine/world/public-carriages.js';
import {stonesFor} from '../../src/engine/world/the-fare-and-calendar-of-a-passage.js';
import {keepThePaidCarriage,thePaidCarriageClaim} from '../../src/web/a-paid-carriage-on-the-road.js';
import {passHours} from '../../src/web/routine-invitations.js';
import {worldLocationFor} from '../../src/web/entities.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {journeyTimeHasReached,roadPositionOfNpc} from '../../src/engine/world/places-on-the-way.js';
import {roadVertexMoments} from '../../src/engine/world/road-course.js';
import {walkingStepDays} from '../../src/engine/world/locations.js';
import {LESSER_ACTION_DAYS} from '../../src/web/lesser-action-costs.js';
import {withTheAttemptLanding} from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
async function aboard(explicitEdge=false,withOtherPassengers=false){
 const plans:string[]=[],{game,db}=makeGame({seed:'actual-driver-course-world',worldEnabled:true,
  narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-review',timeoutMs:0})});
 resetCultivationWorlds();await createWorld({seed:'physical-road-world',presentYear:0});await game.newRun('Road traveller');
 let now=game.currentRun();game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);const world=game.atHand;
 world.factions=[];world.schedule=[];
 world.npcs=[createNpc(world.seed,{id:now.cultivator.id,name:now.cultivator.name,onDay:routineTime(world),bornOnDay:routineTime(world)-20*365,
  locationId:null,tags:[PLAYER_ROW_TAG]})];
 const offered=world.locations.filter(a=>a.tags.includes('city')).flatMap(a=>publicTransportFrom(world,a.name,routineTime(world)).filter(l=>l.service==='carriage').flatMap(line=>{
  const b=worldLocationFor(world,line.to);if(!b)return [];
  const onward=publicTransportFrom(world,b.name,routineTime(world)).find(l=>l.service==='carriage'&&worldLocationFor(world,l.to)?.id!==a.id);
  if(!onward)return [];const c=worldLocationFor(world,onward.to)!;
  const quote=quotePublicCarriage(world,{fromId:a.id,toId:b.id,day:routineTime(world),conveyanceId:'conv-carriage-mortal',passengerIds:[now.cultivator.id],
   fareStones:stonesFor(line.cashPerSeat),hired:false,playedPassenger:{id:now.cultivator.id,locationId:a.id,alive:true}});
  return quote&&quote.arrivalDay-quote.departureDay>1?[{a,b,c,quote,onward}]:[];
 }))[0];expect(offered,'Actual catalog board plus connected native graph must supply two real roads.').toBeTruthy();
 const {a,b,c,quote,onward}=offered!;
 game.repos.cultivators.update(now.cultivator.id,{location:a.name,standingIn:null,realmOrdinal:20,hp:1000,maxHp:1000,spiritStones:5000,satiety:100});now=game.currentRun();
 const survivors:ReturnType<typeof createNpc>[]=[];
 if(withOtherPassengers){
  for(const id of ['prior-carriage-companion','incidental-carriage-passenger'])survivors.push(createNpc(world.seed,{id,onDay:routineTime(world),bornOnDay:routineTime(world)-20*365,locationId:a.id,spiritStones:5000,takenNames:new Set([...world.npcs.map(n=>n.name),...survivors.map(n=>n.name)])}));
  world.npcs.push(...survivors);
  game.putThemOnTheRoadWithYou(now.cultivator,[{id:survivors[0]!.id,name:survivors[0]!.name}],{note:'A prior agreed journey together.',forDays:30});
  for(const peer of survivors){const ticket=quotePublicCarriage(world,{fromId:a.id,toId:b.id,day:routineTime(world),conveyanceId:quote.conveyanceId,passengerIds:[peer.id],fareStones:quote.fareStones,hired:false})!;
   expect(ticket).toBeTruthy();expect(commitPublicCarriage(world,ticket)).toBeTruthy();
   const at=world.npcs.findIndex(n=>n.id===peer.id),actual=world.npcs[at]!;world.npcs[at]={...actual,spiritStones:actual.spiritStones-ticket.fareStones};
  }
 }
 const receipt=commitPublicCarriage(world,quote,{runId:now.run.id,elapsedDays:now.run.elapsedDays})!;expect(receipt).toBeTruthy();
 game.repos.cultivators.applyDeltas(now.cultivator.id,{spiritStones:-quote.fareStones});keepThePaidCarriage(db,now.cultivator.id,receipt.id);game.theWorldMoved();
 const moved=await passHours(game,game.currentRun().run,game.currentRun().cultivator,3);expect(moved.finished,JSON.stringify(moved.spent?.calls)).toBe(true);
 const visibleDriver=game.somebodyAtHand('driver',game.currentRun().cultivator)!;expect(visibleDriver).toBeTruthy();
 let driver=world.npcs.find(n=>n.id===visibleDriver.id)!;expect(driver,'The visible actual operator must have its actual world NPC row.').toBeTruthy();
 if(explicitEdge){
  const route=driver.activity?.admittedRoad?.route;expect(route,'Accepted native driver route must exist.').toBeTruthy();
  const edgeIndex=route!.findIndex((stop,i)=>{if(i===0)return false;const from=world.locations.find(p=>p.id===route![i-1]!.locationId)!,to=world.locations.find(p=>p.id===stop.locationId)!;
   return from.parentId!==to.id&&to.parentId!==from.id&&from.links.some(l=>l.toLocationId===to.id&&l.open)&&to.links.some(l=>l.toLocationId===from.id&&l.open)
    &&walkingStepDays(world.locations,from.id,to.id)!==null&&walkingStepDays(world.locations,to.id,from.id)!==null;
  });expect(edgeIndex,'This actual accepted course needs a directed road, not an implicit containment step.').toBeGreaterThan(0);
  const dates=roadVertexMoments(route!,quote.departureDay,quote.arrivalDay-quote.departureDay),starts=edgeIndex===1?quote.departureDay:dates[edgeIndex-2]!,ends=dates[edgeIndex-1]!;
  const target=starts+Math.min((ends-starts)/2,LESSER_ACTION_DAYS.request/2);
  const advanced=await passHours(game,game.currentRun().run,game.currentRun().cultivator,(target-routineTime(world))*24);
  expect(advanced.finished,JSON.stringify(advanced.spent?.calls)).toBe(true);
  driver=world.npcs.find(n=>n.id===driver.id)!;
  const point=roadPositionOfNpc(world.locations,driver,routineTime(world));expect(point?.kind).toBe('edge');
  if(point?.kind==='edge'){expect(point.fromId).toBe(route![edgeIndex-1]!.locationId);expect(point.toId).toBe(route![edgeIndex]!.locationId);}
 }
 return {game,db,plans,world,a,b,c,quote,onward,receipt,driver,survivors};
}

for(const expires of [false,true])it(expires?'does not reverse after the actual driver dies during the requested consent span':'asks the actual driver and returns over its admitted reverse edge without a new seat fare',async()=>{
 const f=await aboard();try{
  const before=f.game.currentRun(),at=routineTime(f.world),index=f.world.npcs.findIndex(n=>n.id===f.driver.id);
  const operator=f.world.npcs[index]!;
  const point=roadPositionOfNpc(f.world.locations,operator,at);
  expect(point?.kind).toBe('edge');
  const quote=quoteActualCarriageReturn(f.world,f.receipt.id,before.cultivator.id,f.a.id,at);
  expect(quote,'The existing directed reverse edge and original accepted walking quote must supply this return.').toBeTruthy();
  if(expires)f.world.npcs[index]={...operator,cultivation:{...operator.cultivation,lifespanEndsOnDay:at+.0625}};
  f.plans.push(JSON.stringify({action:'request',target:'driver',intent:'course_change',topic:'take me back to '+f.a.name}));
  const asked=(await withTheAttemptLanding('request',()=>f.game.act('I ask the driver to take me back to '+f.a.name+'.'))).result;
  expect(asked.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
  const changed=f.world.history.facts.filter(fact=>fact.data.changedCarriageCourse===true);
  if(expires){
   expect(changed,JSON.stringify(asked.toolCalls)).toHaveLength(0);
   expect(f.world.npcs.find(n=>n.id===f.driver.id)?.status).not.toBe('alive');
   expect(asked.toolCalls.some(call=>call.name==='engine.actualCaptainCourse'&&call.ok),JSON.stringify(asked.toolCalls)).toBe(false);
   expect(f.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeGreaterThan(0);
   expect(f.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeLessThanOrEqual(.125);
  }else{
   expect(asked.toolCalls.some(call=>call.name==='engine.actualCaptainCourse'&&call.ok),JSON.stringify(asked.toolCalls)).toBe(true);
   expect(changed).toHaveLength(1);expect(changed[0]!.causes).toContain(f.receipt.id);
   const body=f.game.currentRun().cultivator,actual=publicCarriagePassage(f.world,f.receipt.id,body.id,routineTime(f.world))!;
   expect(actual.leg.vesselId).toBe(f.quote.vesselId);expect(actual.driver.id).toBe(f.driver.id);
   expect(actual.leg.toId).toBe(f.a.id);expect(thePaidCarriageClaim(f.db,body.id)!.receiptId).toBe(f.receipt.id);
   expect(actual.arrived).toBe(false);
   expect(f.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.125,12);
   expect(f.game.currentRun().run.turn-before.run.turn).toBe(1);
   const current=roadPositionOfNpc(f.world.locations,actual.driver,routineTime(f.world));
   expect(current?.kind).toBe('edge');
   const atAgreement=roadPositionOfNpc(f.world.locations,operator,changed[0]!.day);
   expect(atAgreement?.kind).toBe('edge');
   if(atAgreement?.kind==='edge'&&current?.kind==='edge'){
    expect(current.fromId).toBe(atAgreement.toId);expect(current.toId).toBe(atAgreement.fromId);
   }
   const arrived=await passHours(f.game,f.game.currentRun().run,body,actual.remainingDays*24);
   expect(arrived.finished,JSON.stringify(arrived.spent?.calls)).toBe(true);
   expect(f.game.currentRun().cultivator.location).toBe(f.a.name);
   expect(journeyTimeHasReached(routineTime(f.world),actual.leg.arrivalDay)).toBe(true);
   expect(f.world.history.facts.find(fact=>fact.id===f.receipt.id)!.data.toLocationId).toBe(f.b.id);
  }
  expect(f.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  if(expires){
   const actual=f.game.currentRun(),hull=f.world.objects.find(o=>o.id===f.quote.vesselId)!;
   const site=worldLocationFor(f.world,actual.cultivator.location)!;
   expect(site.tags).toContain('stopped-carriage');expect(hull.locationId).toBe(site.id);
   expect(site.id).not.toBe(f.a.id);expect(site.id).not.toBe(f.b.id);
   expect(thePaidCarriageClaim(f.db,actual.cultivator.id)).toBeNull();
   const cursor=stoppedRoadFor(f.db,actual.cultivator,f.world),lost=stoppedRoadPoint(f.world.locations,site.id);
   expect(cursor?.stoppedLocationId).toBe(site.id);expect(lost?.kind).toBe('edge');
   expect(sameRoadPosition(cursor?.position??null,lost)).toBe(true);
   expect(f.world.history.facts.find(fact=>fact.id===f.receipt.id)?.data.vesselId).toBe(f.quote.vesselId);
   const oldOriginOffer=quotePublicCarriage(f.world,{fromId:f.a.id,toId:f.b.id,day:routineTime(f.world),conveyanceId:f.quote.conveyanceId,passengerIds:[actual.cultivator.id],fareStones:f.quote.fareStones,hired:false,
    playedPassenger:{id:actual.cultivator.id,locationId:f.a.id,alive:true}});
   expect(oldOriginOffer,'A parked lost hull cannot be recalled to its former station.').toBeNull();
   const oldIds=new Set(f.world.npcs.map(n=>n.id)),oldFacts=new Set(f.world.history.facts.map(fact=>fact.id));
   f.plans.push(JSON.stringify({action:'passage',target:f.b.name,intent:'talk'}));
   const purchase=await f.game.act('I take the carriage to '+f.b.name+'.');
   expect(purchase.toolCalls.some(call=>call.name==='engine.passageCounterReach'&&!call.ok),JSON.stringify(purchase.toolCalls)).toBe(true);
   expect(f.game.currentRun().cultivator.spiritStones).toBe(actual.cultivator.spiritStones);
   expect(f.game.currentRun().run.elapsedDays).toBe(actual.run.elapsedDays);
   expect(f.world.npcs.filter(n=>!oldIds.has(n.id))).toHaveLength(0);
   expect(f.world.history.facts.filter(fact=>!oldFacts.has(fact.id)&&fact.data.publicPassage===true)).toHaveLength(0);
   expect(stoppedRoadFor(f.db,f.game.currentRun().cultivator,f.world)?.stoppedLocationId).toBe(site.id);
  }else expect(f.world.objects.find(o=>o.id===f.quote.vesselId)!.ownerId).toBe(f.driver.id);
 }finally{f.db.close();resetCultivationWorlds();}
});

it('does not treat a closed directed reverse edge as an immediate carriage reversal',async()=>{
 const f=await aboard(true);try{
  const before=f.game.currentRun(),day=routineTime(f.world),driver=f.world.npcs.find(n=>n.id===f.driver.id)!;
  const point=roadPositionOfNpc(f.world.locations,driver,day);expect(point?.kind).toBe('edge');if(point?.kind!=='edge')return;
  const at=f.world.locations.findIndex(p=>p.id===point.toId),row=f.world.locations[at]!;
  expect(row.links.some(link=>link.toLocationId===point.fromId&&link.open),'The actual admitted edge must expose its real directed reverse for this control.').toBe(true);
  f.world.locations[at]={...row,links:row.links.map(link=>link.toLocationId===point.fromId?{...link,open:false}:link)};
  expect(quoteActualCarriageReturn(f.world,f.receipt.id,before.cultivator.id,f.a.id,day)).toBeNull();
  f.plans.push(JSON.stringify({action:'request',target:'driver',intent:'course_change',topic:'take me back to '+f.a.name}));
  const asked=(await withTheAttemptLanding('request',()=>f.game.act('I ask the driver to take me back to '+f.a.name+'.'))).result;
  expect(f.world.history.facts.some(fact=>fact.data.changedCarriageCourse===true),JSON.stringify(asked.toolCalls)).toBe(false);
  // A genuinely feasible later B-to-A word is distinct from reversing this
  // closed edge now. No detour is presented as present-edge reversal.
  const actual=publicCarriagePassage(f.world,f.receipt.id,before.cultivator.id,routineTime(f.world))!;
  expect(actual.leg.toId).toBe(f.b.id);expect(actual.leg.departureDay).toBe(f.quote.departureDay);
  expect(actual.arrived).toBe(false);
  expect(f.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
 }finally{f.db.close();resetCultivationWorlds();}
});

it('keeps independently paid survivors on the reached point without creating or ending their party terms',async()=>{
 const f=await aboard(true,true);try{
  const before=f.game.currentRun(),day=routineTime(f.world),at=f.world.npcs.findIndex(n=>n.id===f.driver.id),operator=f.world.npcs[at]!;
  const prior=f.world.npcs.find(n=>n.id===f.survivors[0]!.id)!.activity!.passageCompany!;
  expect(prior.kind).toBe('out_with_a_party');
  f.world.npcs[at]={...operator,cultivation:{...operator.cultivation,lifespanEndsOnDay:day+.0625}};
  f.plans.push(JSON.stringify({action:'request',target:'driver',intent:'course_change',topic:'take me back to '+f.a.name}));
  const asked=(await withTheAttemptLanding('request',()=>f.game.act('I ask the driver to take me back to '+f.a.name+'.'))).result;
  expect(asked.toolCalls.some(call=>call.name==='engine.actualCaptainCourse'&&call.ok),JSON.stringify(asked.toolCalls)).toBe(false);
  const body=f.game.currentRun().cultivator,site=worldLocationFor(f.world,body.location)!;
  expect(site.tags).toContain('stopped-carriage');expect(f.world.objects.find(o=>o.id===f.quote.vesselId)!.locationId).toBe(site.id);
  const lost=stoppedRoadPoint(f.world.locations,site.id);expect(lost?.kind).toBe('edge');
  for(const peer of f.survivors){const actual=f.world.npcs.find(n=>n.id===peer.id)!;expect(actual.status).toBe('alive');expect(actual.locationId).toBe(site.id);
   expect(sameRoadPosition(roadPositionOfNpc(f.world.locations,actual,routineTime(f.world)),lost)).toBe(true);
   expect(actual.activity?.vesselId).toBeUndefined();expect(gamePresentIds(f.game)).toContain(peer.id);
  }
  const restored=f.world.npcs.find(n=>n.id===f.survivors[0]!.id)!.activity!;
  expect(restored.kind).toBe(prior.kind);expect(restored.note).toBe(prior.note);expect(restored.untilDay).toBe(prior.untilDay);expect(restored.withIds).toEqual(prior.withIds);
  expect(f.game.whoIsWithYouOnTheRoad(body).map(n=>n.id)).toContain(f.survivors[0]!.id);
  expect(f.game.whoIsWithYouOnTheRoad(body).map(n=>n.id)).not.toContain(f.survivors[1]!.id);
  expect(f.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  expect(thePaidCarriageClaim(f.db,body.id)).toBeNull();expect(stoppedRoadFor(f.db,body,f.world)?.stoppedLocationId).toBe(site.id);
 }finally{f.db.close();resetCultivationWorlds();}
});
function gamePresentIds(game:Awaited<ReturnType<typeof aboard>>['game']):string[]{return game.present(game.currentRun().cultivator).map(person=>person.id);}
