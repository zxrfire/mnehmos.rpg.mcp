/** The actual carriage driver is its captain. An ordinary routed request can
 * receive consent or refusal; ADMIN landing below proves only the agreed effect.
 * The carriage does not leave its admitted current road, skip B, mint another
 * driver or carry an incidental B passenger onward. The native public board and
 * graph supply both roads and both fares. Same-world configured controls clear
 * unrelated world actors after the ordinary seeder has fulfilled its contracts.
 * No rate, endpoint, resolver outcome or body/food span is reconstructed here.
 */
import {expect,it} from 'vitest';
import {makeGame,ScriptedProvider} from './harness.js';
import {ProviderNarrator} from '../../src/web/narrator.js';
import {createWorld,resetCultivationWorlds,prepareWorldClockForPreciseSpan} from '../../src/server/state/cultivation-world.js';
import {createNpc,PLAYER_ROW_TAG,markDead,setLocation} from '../../src/engine/world/npc-state.js';
import {publicTransportFrom} from '../../src/engine/world/public-transport-at-a-place.js';
import {quotePublicCarriage,commitPublicCarriage,publicCarriagePassage} from '../../src/engine/world/public-carriages.js';
import {stonesFor} from '../../src/engine/world/the-fare-and-calendar-of-a-passage.js';
import {keepThePaidCarriage,thePaidCarriageClaim} from '../../src/web/a-paid-carriage-on-the-road.js';
import {passHours} from '../../src/web/routine-invitations.js';
import {worldLocationFor} from '../../src/web/entities.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {advanceWorldForPlay} from '../../src/engine/world/driver.js';
import {projectActualPassengers} from '../../src/web/passengers-at-the-actual-clock.js';
import {journeyTimeHasReached} from '../../src/engine/world/places-on-the-way.js';
import {withTheAttemptLanding} from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
async function aboard(){
 const plans:string[]=[],{game,db}=makeGame({seed:'actual-driver-course-world',worldEnabled:true,
  narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-review',timeoutMs:0})});
 resetCultivationWorlds();await createWorld({seed:'physical-road-world',presentYear:0});await game.newRun('Road traveller');
 let now=game.currentRun();game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);const world=game.atHand;
 world.factions=[];world.objects=[];world.schedule=[];
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
 const receipt=commitPublicCarriage(world,quote,{runId:now.run.id,elapsedDays:now.run.elapsedDays})!;expect(receipt).toBeTruthy();
 game.repos.cultivators.applyDeltas(now.cultivator.id,{spiritStones:-quote.fareStones});keepThePaidCarriage(db,now.cultivator.id,receipt.id);game.theWorldMoved();
 const moved=await passHours(game,game.currentRun().run,game.currentRun().cultivator,3);expect(moved.finished,JSON.stringify(moved.spent?.calls)).toBe(true);
 const driver=game.somebodyAtHand('driver',game.currentRun().cultivator)!;expect(driver).toBeTruthy();
 return {game,db,plans,world,a,b,c,quote,onward,receipt,driver};
}
for(const lost of [false,true])it(lost?'does not board an onward road after the actual driver dies at B':'routes a request to the actual driver and admits the same carriage only after reaching B',async()=>{
 const f=await aboard();try{
  const before=f.game.currentRun();
  f.plans.push(JSON.stringify({action:'request',target:'driver',intent:'course_change',topic:'take me to '+f.c.name}));
  const asked=(await withTheAttemptLanding('request',()=>f.game.act('I ask the driver to take me to '+f.c.name+'.'))).result;
  expect(asked.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
  expect(asked.toolCalls.some(call=>call.name==='engine.resolveAttempt'),JSON.stringify(asked.toolCalls)).toBe(true);
  expect(asked.toolCalls.some(call=>call.name==='engine.actualCaptainCourse'&&call.ok),JSON.stringify(asked.toolCalls)).toBe(true);
  expect(f.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.125,12);expect(f.game.currentRun().run.turn-before.run.turn).toBe(1);
  expect(f.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  expect(publicCarriagePassage(f.world,f.receipt.id,before.cultivator.id,routineTime(f.world))!.leg.toId).toBe(f.b.id);
  const day=f.quote.arrivalDay;let reachedB=false;
  advanceWorldForPlay(f.world,{days:day-routineTime(f.world),preciseDays:true,stopOnInterrupt:false,atWorldBoundary:(world,at)=>{
   if(journeyTimeHasReached(at,day)&&!reachedB){reachedB=true;if(lost){const index=world.npcs.findIndex(n=>n.id===f.driver.id),n=world.npcs[index]!;
    world.npcs[index]=markDead(setLocation(n,f.b.id,at),at,'Actual driver death at reached endpoint.');}}
   projectActualPassengers(f.db,world,before.cultivator.id,at);
  }});f.game.theWorldMoved();
  expect(reachedB,'The old course must physically reach its endpoint before considering any onward word.').toBe(true);
  if(lost){expect(f.world.history.facts.some(fact=>fact.data.service==='carriage'&&typeof fact.data.onwardAgreementId==='string')).toBe(false);
   expect(f.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  }else{
   const claim=thePaidCarriageClaim(f.db,before.cultivator.id)!;expect(claim.receiptId).not.toBe(f.receipt.id);
   const newTrip=publicCarriagePassage(f.world,claim.receiptId,before.cultivator.id,routineTime(f.world))!;
   expect(newTrip.leg.vesselId).toBe(f.quote.vesselId);expect(newTrip.driver.id).toBe(f.driver.id);
   expect(newTrip.leg.fromId).toBe(f.b.id);expect(newTrip.leg.toId).toBe(f.c.id);expect(newTrip.receipt.causes).toContain(f.receipt.id);
   expect(f.game.currentRun().cultivator.location).toBe(f.b.name);
   expect(f.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones-stonesFor(f.onward.cashPerSeat));
  }
  expect(f.game.currentRun().cultivator.location).not.toBe(f.c.name);
 }finally{f.db.close();resetCultivationWorlds();}
});
