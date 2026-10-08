/** Driver and captain name the same real pilot. A privately held spirit boat's
 * owner can ask that pilot for a different destination through the ordinary
 * request resolver; ownership alone does not settle their answer. These native
 * frontdoor controls ADMIN-land only consent, not movement, boarding or fuel.
 * The old admitted ocean course reaches B first, then the same actual hull may
 * board its native return course from B. A pilot death at B cannot be undone.
 * The original accepted passage/fuel and any existing company remain facts;
 * the onward word is not a new roster, free fuel or permission to teleport.
 * These scratch controls are uncompiled/unrun. Immediate private mid-edge
 * course changes remain separate; this bounded candidate is endpoint onward.
 */
import {expect,it} from 'vitest';
import {makeGame,ScriptedProvider} from './harness.js';
import {ProviderNarrator} from '../../src/web/narrator.js';
import {createWorld,resetCultivationWorlds,prepareWorldClockForPreciseSpan} from '../../src/server/state/cultivation-world.js';
import {createNpc,setRealm,PLAYER_ROW_TAG} from '../../src/engine/world/npc-state.js';
import {aVehicleOf,takeItAlong,whoItIsWith} from '../../src/engine/world/a-vehicle.js';
import {publicShipLinesFrom} from '../../src/engine/world/public-shipping.js';
import {worldLocationFor} from '../../src/web/entities.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {walkingDaysFrom,walkingRouteFrom} from '../../src/engine/world/locations.js';
import {priceJourney} from '../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import {requireConveyance} from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {isWater,journeyTimeHasReached} from '../../src/engine/world/places-on-the-way.js';
import {acceptOwnedPassage,ownedPassageClaim,ownedCarrierAt} from '../../src/web/an-owned-passage.js';
import {passHours} from '../../src/web/routine-invitations.js';
import {withTheAttemptLanding} from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
async function aboard(){
 const plans:string[]=[],{game,db}=makeGame({seed:'private-pilot-course-world',worldEnabled:true,
  narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-review',timeoutMs:0})});
 resetCultivationWorlds();await createWorld({seed:'precise-owned-ocean-world',presentYear:0});await game.newRun('Ocean traveller');
 let now=game.currentRun();game.repos.cultivators.update(now.cultivator.id,{location:'Emerald Water City',standingIn:null,
  realmOrdinal:29,hp:1000,maxHp:1000,satiety:100,spiritStones:5000});now=game.currentRun();
 game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);const world=game.atHand,day=routineTime(world);
 const from=worldLocationFor(world,now.cultivator.location)!,line=publicShipLinesFrom(world,from.name,day).find(l=>l.runsFromDay===null)!;
 expect(line).toBeTruthy();const to=worldLocationFor(world,line.to)!;
 // Keep the fully seeded actual graph/catalog; remove unrelated actor tasks
 // only after ordinary population/property seeding has completed its contracts.
 world.factions=[];world.schedule=[];world.objects=[];world.npcs=[createNpc(world.seed,{id:now.cultivator.id,name:now.cultivator.name,
  locationId:from.id,onDay:day,bornOnDay:day-20*365,tags:[PLAYER_ROW_TAG]})];
 const pilot=setRealm(createNpc(world.seed,{id:'actual-owned-course-pilot',locationId:from.id,onDay:day,bornOnDay:day-40*365}),29,day);
 world.npcs.push(pilot);const boat=aVehicleOf({id:'actual-owned-course-hull',conveyanceId:'conv-spirit-boat',ownerId:now.cultivator.id,ownerName:now.cultivator.name,at:from.id});
 world.objects.push(boat);takeItAlong(world.objects,boat,now.cultivator.id);
 const distance=walkingDaysFrom(world.locations,from.id).get(to.id)!,conv=requireConveyance('conv-spirit-boat');
 const quote=priceJourney({walkingDays:distance,conveyance:conv,power:boat.power,heads:2});expect(quote.trips).toBe(1);
 const receiptId=acceptOwnedPassage(game,now.run,now.cultivator,{vesselId:boat.id,pilotId:pilot.id,fromId:from.id,toId:to.id,
  walkingDays:distance,days:quote.daysForEverybody,conveyanceId:conv.id,power:boat.power,companions:[pilot.id]});
 const route=walkingRouteFrom(world.locations,from.id,to.id)!,at=route.findIndex((p,i)=>i>0&&isWater(world.locations.find(l=>l.id===p.locationId)!));
 expect(at).toBeGreaterThan(0);const start=route[at-1]!.days/distance*quote.daysForEverybody,end=route[at]!.days/distance*quote.daysForEverybody;
 expect(end-start).toBeGreaterThan(.125);const approach=await passHours(game,game.currentRun().run,game.currentRun().cultivator,((start+end-.125)/2)*24);
 expect(approach.finished,JSON.stringify(approach.spent?.calls)).toBe(true);expect(isWater(worldLocationFor(world,game.currentRun().cultivator.location)!)).toBe(true);
 expect(game.present(game.currentRun().cultivator).some(n=>n.id===pilot.id)).toBe(true);return {game,db,plans,world,from,to,pilot,boat,receiptId,quote};
}
for(const dead of [false,true])it(dead?'retains actual pilot death at B instead of beginning the agreed private onward course':'asks the actual private pilot and begins its same-hull onward course only after B',async()=>{
 const f=await aboard();try{
  const before=f.game.currentRun();f.plans.push(JSON.stringify({action:'request',target:'captain',intent:'course_change',topic:'take me back to '+f.from.name}));
  const asked=(await withTheAttemptLanding('request',()=>f.game.act('I ask the captain to take me back to '+f.from.name+'.'))).result;
  expect(asked.toolCalls.find(c=>c.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
  expect(asked.toolCalls.some(c=>c.name==='engine.actualCaptainCourse'&&c.ok),JSON.stringify(asked.toolCalls)).toBe(true);
  expect(f.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.125,12);expect(f.game.currentRun().run.turn-before.run.turn).toBe(1);
  const old=f.world.history.facts.find(fact=>fact.id===f.receiptId)!,arrival=Number(old.data.arrivalDay);
  if(dead)f.world.npcs.find(n=>n.id===f.pilot.id)!.cultivation.lifespanEndsOnDay=arrival;
  const remaining=arrival-routineTime(f.world),spent=await passHours(f.game,f.game.currentRun().run,f.game.currentRun().cultivator,remaining*24);
  expect(journeyTimeHasReached(routineTime(f.world),arrival)).toBe(true);
  const onward=f.world.history.facts.filter(fact=>fact.data.ownedPassage===true&&typeof fact.data.onwardAgreementId==='string');
  if(dead){expect(onward).toHaveLength(0);expect(f.world.npcs.find(n=>n.id===f.pilot.id)!.status).not.toBe('alive');}
  else{
   expect(spent.finished,JSON.stringify(spent.spent?.calls)).toBe(true);expect(onward).toHaveLength(1);const next=onward[0]!;
   expect(next.causes).toContain(f.receiptId);expect(next.data.vesselId).toBe(f.boat.id);expect(next.data.pilotId).toBe(f.pilot.id);
   expect(next.data.fromLocationId).toBe(f.to.id);expect(next.data.toLocationId).toBe(f.from.id);
   expect(ownedPassageClaim(f.db,before.cultivator.id)?.receiptId).toBe(next.id);
   expect(ownedCarrierAt(f.world,next.id,f.game.currentRun().cultivator,routineTime(f.world))?.locationId).toBe(f.to.id);
   expect(before.cultivator.spiritStones-f.game.currentRun().cultivator.spiritStones).toBeGreaterThan(0);
  }
  expect(f.game.currentRun().cultivator.location).toBe(f.to.name);
  expect(f.game.currentRun().cultivator.spiritStones).toBe(5000-f.quote.stonesBurned);
  expect(spent.spent?.calls.some(c=>c.name==='engine.priceJourney'&&c.ok),JSON.stringify(spent.spent?.calls)).toBe(true);
  const currentBoat=f.world.objects.find(o=>o.id===f.boat.id)!;expect(currentBoat.ownerId).toBe(before.cultivator.id);expect(whoItIsWith(currentBoat)).toBe(before.cultivator.id);
 }finally{f.db.close();resetCultivationWorlds();}
});
