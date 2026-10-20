/** Diagnostic carriage16649 found deleting founding uniform objects changes
 * opening-day authority to -Infinity and triggers year-zero contact practice.
 * This water fixture now preserves real founding objects; no mortality rule
 * or expected native operator outcome is changed.
 * A timber ship is not a flying spirit boat or a public ticket. Its real
 * owner/pilot boards an existing admitted dock lane, pays the existing chest
 * authority, eats actual native pack stock and occupies the lane's water.
 * The sea-cost commitDayOf ruling is shorter-way advice: after halfway a
 * feasible return is LONGER than going on, not physically prohibited.
 * These scratch native controls are not yet compiled/run. ADMIN lands only
 * NPC consent; weather/body/food/custody/clock/movement remain native. The
 * operator-arranged boundary ruin tests real source revalidation, not a
 * manufactured consent or successful endpoint. No incidental passenger party.
 */
import {expect,it} from 'vitest';
import {makeGame,ScriptedProvider} from './harness.js';
import {ProviderNarrator} from '../../src/web/narrator.js';
import {createWorld,resetCultivationWorlds,prepareWorldClockForPreciseSpan} from '../../src/server/state/cultivation-world.js';
import {createNpc,PLAYER_ROW_TAG} from '../../src/engine/world/npc-state.js';
import {aVehicleOf,takeItAlong,whoItIsWith} from '../../src/engine/world/a-vehicle.js';
import {publicShipLinesFrom} from '../../src/engine/world/public-shipping.js';
import {worldLocationFor} from '../../src/web/entities.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {quoteOwnedSeaDeparture} from '../../src/engine/world/an-owned-sea-course.js';
import {isWater,journeyTimeHasReached} from '../../src/engine/world/places-on-the-way.js';
import {acceptOwnedPassage,ownedPassageClaim,ownedCarrierAt} from '../../src/web/an-owned-passage.js';
import {quoteOwnedSeaCourseChange} from '../../src/web/changing-the-owned-sea-course.js';
import {passHours} from '../../src/web/routine-invitations.js';
import {withTheAttemptLanding} from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
import {witnessIndexFor} from '../../src/engine/world/witness-reaction-index.js';
import {whatTheChestBurns} from '../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import {requireConveyance} from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {ruin} from '../../src/engine/world/possessions.js';

async function aboard(npcPilot:boolean,playedBoarding=false){
 const plans:string[]=[],h=makeGame({seed:'private-timber-return',worldEnabled:true,
  narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-review',timeoutMs:0})});
 resetCultivationWorlds();await createWorld({seed:'precise-owned-ocean-world',presentYear:0});await h.game.newRun('Timber ship owner');
 let now=h.game.currentRun();h.repos.cultivators.update(now.cultivator.id,{location:'Emerald Water City',standingIn:null,
  hp:1000,maxHp:1000,satiety:100,spiritStones:10000});now=h.game.currentRun();
 h.game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
 const world=h.game.atHand,day=routineTime(world),from=worldLocationFor(world,now.cultivator.location)!;
 const line=publicShipLinesFrom(world,from.name,day).find(l=>l.runsFromDay===null&&l.days>2);
 expect(line,'Native fixture needs an actually open nonzero dock lane').toBeTruthy();
 const to=worldLocationFor(world,line!.to)!,quote=quoteOwnedSeaDeparture(world,from.id,to.id,day,npcPilot?2:1)!;
 expect(quote).toBeTruthy();
 // All ordinary population/property seeding completed before the operator's
 // controlled physical arrangement. Native graph/catalog and selected lane stay.
 world.factions=[];world.schedule=[];world.npcs=[createNpc(world.seed,{id:now.cultivator.id,
  name:now.cultivator.name,locationId:from.id,onDay:day,bornOnDay:day-20*365,tags:[PLAYER_ROW_TAG]})];
 const pilot=npcPilot?createNpc(world.seed,{id:'arranged-timber-pilot',locationId:from.id,onDay:day,bornOnDay:day-40*365}):null;
 if(pilot)world.npcs.push(pilot);
 const hull=aVehicleOf({id:'arranged-timber-hull',conveyanceId:'conv-water-ship',ownerId:now.cultivator.id,ownerName:now.cultivator.name,at:from.id});
 world.objects.push(hull);takeItAlong(world.objects,hull,now.cultivator.id);
 const bought=h.game.buyProvisions(now.cultivator,400);h.game.putBackWhatWasNotEaten(bought.cultivator,{endState:{rationsRemaining:bought.rations}});
 now=h.game.currentRun();
 h.game.knowledge.learnIfNew({holderId:now.cultivator.id,kind:'place',id:to.id,name:to.name,onDay:now.run.elapsedDays,sourceKind:'told',sourceNote:'Operator-arranged native lane directions.',stage:'placed',statement:'The route to '+to.name+' is known.'});
 if(playedBoarding){
  plans.push(JSON.stringify({action:'ride',target:to.name,topic:'timber ship'}));
  const result=await h.game.act('I ride my timber ship to '+to.name+'.');
  expect(result.toolCalls.find(c=>c.name==='narrator.plan')?.source,JSON.stringify(result.toolCalls)).toBe('model');
  const booked=world.history.facts.filter(f=>f.data.ownedPassage===true&&f.data.vesselId===hull.id);
  expect(booked,JSON.stringify(result.toolCalls)).toHaveLength(1);
  return {...h,plans,world,day,from,to,quote,hull,pilot,receiptId:booked[0]!.id};
 }
 const receiptId=acceptOwnedPassage(h.game,now.run,now.cultivator,{vesselId:hull.id,pilotId:pilot?.id??now.cultivator.id,
  fromId:from.id,toId:to.id,walkingDays:quote.walkingDays,days:quote.days,conveyanceId:'conv-water-ship',power:hull.power,companions:pilot?[pilot.id]:[],seaLane:quote.lane});
 h.game.knowledge.learnIfNew({holderId:now.cultivator.id,kind:'place',id:from.id,name:from.name,onDay:now.run.elapsedDays,
  sourceKind:'told',sourceNote:'Operator-arranged actual departure route.',stage:'placed',statement:'The route to '+from.name+' is known.'});
 const progressed=await passHours(h.game,h.game.currentRun().run,h.game.currentRun().cultivator,quote.days*.6*24);
 expect(progressed.finished,JSON.stringify(progressed.spent?.calls)).toBe(true);
 const source=ownedCarrierAt(world,receiptId,h.game.currentRun().cultivator,routineTime(world))!;
 expect(source.unavailable).toBeNull();expect(isWater(world.locations.find(l=>l.id===source.locationId)!)).toBe(true);
 expect(routineTime(world)-day).toBeGreaterThan(quote.days/2);
 return {...h,plans,world,day,from,to,quote,hull,pilot,receiptId};
}

it('the actual PC can steer its water-only ship back after midpoint through the played frontdoor',async()=>{
 const h=await aboard(false);try{
  const before=h.game.currentRun(),at=routineTime(h.world),read=quoteOwnedSeaCourseChange(h.game,before.cultivator,h.from.id)!;
  expect(read).toBeTruthy();expect(read.days).toBeGreaterThan(h.quote.days-(at-h.day));
  h.plans.push(JSON.stringify({action:'ride',target:h.from.name}));
  const result=await h.game.act('I steer my timber ship back to '+h.from.name+'.');
  expect(result.toolCalls.find(c=>c.name==='narrator.plan')?.source,JSON.stringify(result.toolCalls)).toBe('model');
  expect(result.toolCalls.some(c=>c.name==='engine.resolveAttempt')).toBe(false);
  const changes=h.world.history.facts.filter(f=>f.data.ownedPassage===true&&f.causes.includes(h.receiptId));
  expect(changes,JSON.stringify(result.toolCalls)).toHaveLength(1);const changed=changes[0]!;
  expect(changed.data.vesselId).toBe(h.hull.id);expect(changed.data.pilotId).toBe(before.cultivator.id);
  expect(changed.data.fromLocationId).toBe(read.fromId);expect(changed.data.toLocationId).toBe(h.from.id);
  expect(Number(changed.data.arrivalDay)-Number(changed.data.departureDay)).toBeCloseTo(read.days,12);
  expect(h.world.history.facts.find(f=>f.id===h.receiptId)?.data.toLocationId).toBe(h.to.id);
  expect(h.game.currentRun().run.turn-before.run.turn).toBe(1);
  expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeGreaterThan(0);
  const current=ownedPassageClaim(h.db,before.cultivator.id);
  if(current){expect(current.receiptId).toBe(changed.id);expect(isWater(worldLocationFor(h.world,h.game.currentRun().cultivator.location)!)).toBe(true);}
  else{expect(journeyTimeHasReached(routineTime(h.world),Number(changed.data.arrivalDay))).toBe(true);expect(h.game.currentRun().cultivator.location).toBe(h.from.name);}
  expect(whoItIsWith(h.world.objects.find(o=>o.id===h.hull.id)!)).toBe(before.cultivator.id);
  expect(h.game.currentRun().cultivator.spiritStones).toBeLessThan(before.cultivator.spiritStones);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);

for(const lost of [false,true])it(lost?'does not accept a private return after the actual hull is ruined during the request':'asks the actual mortal pilot for the longer feasible private return',async()=>{
 const h=await aboard(true);try{
  const before=h.game.currentRun(),at=routineTime(h.world),oldGround=before.cultivator.location;
  expect(h.game.present(before.cultivator).some(p=>p.id===h.pilot!.id)).toBe(true);
  if(lost){const advance=h.game.advancePreparedWorld.bind(h.game);let once=false;
   h.game.advancePreparedWorld=(...args)=>{const report=advance(...args);if(!once){once=true;const i=h.world.objects.findIndex(o=>o.id===h.hull.id);
    h.world.objects[i]=ruin(h.world.objects[i]!,{onDay:routineTime(h.world),source:'operator-arranged boundary loss'});}return report;};}
  h.plans.push(JSON.stringify({action:'request',target:'captain',intent:'course_change',topic:'take me back to '+h.from.name}));
  const result=(await withTheAttemptLanding('request',()=>h.game.act('I ask the captain to take me back to '+h.from.name+'.'))).result;
  expect(result.toolCalls.find(c=>c.name==='narrator.plan')?.source,JSON.stringify(result.toolCalls)).toBe('model');
  const changes=h.world.history.facts.filter(f=>f.data.ownedPassage===true&&f.causes.includes(h.receiptId));
  if(lost){expect(changes).toHaveLength(0);expect(h.game.currentRun().cultivator.location).toBe(oldGround);}
  else{
   expect(result.toolCalls.some(c=>c.name==='engine.actualCaptainCourse'&&c.ok),JSON.stringify(result.toolCalls)).toBe(true);
   expect(changes).toHaveLength(1);const changed=changes[0]!;
   expect(changed.data.pilotId).toBe(h.pilot!.id);expect(changed.data.vesselId).toBe(h.hull.id);
   expect(changed.data.toLocationId).toBe(h.from.id);expect(changed.data.fromLocationId).not.toBe(h.from.id);
   expect(Number(changed.data.arrivalDay)-Number(changed.data.departureDay)).toBeCloseTo(routineTime(h.world)-h.day,12);
   expect(ownedPassageClaim(h.db,before.cultivator.id)?.receiptId).toBe(changed.id);
   expect(isWater(worldLocationFor(h.world,h.game.currentRun().cultivator.location)!)).toBe(true);
   expect(h.world.npcs.find(n=>n.id===h.pilot!.id)?.activity?.untilDay).toBe(changed.data.arrivalDay);
  }
  expect(routineTime(h.world)-at).toBeCloseTo(.125,12);expect(h.game.currentRun().run.turn-before.run.turn).toBe(1);
  expect(h.game.currentRun().cultivator.alive).toBe(true);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);

it('refuses unsupported private mid-water destinations and insufficient native return fuel without changing the course',async()=>{
 const h=await aboard(false);try{
  const before=h.game.currentRun(),old=ownedPassageClaim(h.db,before.cultivator.id)!;
  expect(quoteOwnedSeaCourseChange(h.game,before.cultivator,h.to.id)).toBeNull();
  const read=quoteOwnedSeaCourseChange(h.game,before.cultivator,h.from.id)!;
  const needed=whatTheChestBurns({conveyance:requireConveyance('conv-water-ship'),daysOneWay:read.days,heads:1,trips:1});
  h.repos.cultivators.update(before.cultivator.id,{spiritStones:needed-1});
  const fresh=h.game.currentRun();h.plans.push(JSON.stringify({action:'ride',target:h.from.name}));
  const result=await h.game.act('I steer my timber ship back to '+h.from.name+'.');
  expect(result.toolCalls.some(c=>c.name==='engine.actualOwnedCourse'&&!c.ok),JSON.stringify(result.toolCalls)).toBe(true);
  expect(ownedPassageClaim(h.db,before.cultivator.id)).toEqual(old);
  expect(h.game.currentRun().cultivator.location).toBe(fresh.cultivator.location);
  expect(h.game.currentRun().cultivator.spiritStones).toBe(fresh.cultivator.spiritStones);
  expect(h.game.currentRun().run.elapsedDays).toBe(fresh.run.elapsedDays);
  expect(witnessIndexFor(h.world).byId.get(old.receiptId)?.data.toLocationId).toBe(h.to.id);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);


it('boards the actual owned timber ship through the played ride frontdoor without a public ticket or flying-pilot requirement',async()=>{
 const h=await aboard(false,true);try{
  const fact=witnessIndexFor(h.world).byId.get(h.receiptId)!;
  expect(fact.data.seaCourse).toBe(true);expect(fact.data.airCourse).not.toBe(true);
  expect(fact.data.seaLaneId).toBe(h.quote.lane.id);expect(fact.data.pilotId).toBe(h.game.currentRun().cultivator.id);
  expect(fact.data.fromLocationId).toBe(h.from.id);expect(fact.data.toLocationId).toBe(h.to.id);
  expect(Number(fact.data.arrivalDay)-Number(fact.data.departureDay)).toBeCloseTo(h.quote.days,12);
  expect(h.world.history.facts.some(f=>f.data.publicPassage===true&&f.data.vesselId===h.hull.id)).toBe(false);
  expect(h.world.objects.find(o=>o.id===h.hull.id)?.ownerId).toBe(h.game.currentRun().cultivator.id);
  const active=ownedPassageClaim(h.db,h.game.currentRun().cultivator.id);
  if(active)expect(active.receiptId).toBe(h.receiptId);
  else{expect(journeyTimeHasReached(routineTime(h.world),Number(fact.data.arrivalDay))).toBe(true);expect(h.game.currentRun().cultivator.location).toBe(h.to.name);}
 }finally{h.db.close();resetCultivationWorlds();}
},180000);
