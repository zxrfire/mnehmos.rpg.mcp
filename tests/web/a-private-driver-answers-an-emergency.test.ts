/** Private drivers need the same duty response as public drivers. The actual
 * admitted road point and pace survive a medical return or a danger hold;
 * lifting the real status resumes the same hull without a fare or a cure.
 * A real hold was initially hidden from the passenger because its future
 * departure was mistaken for boarding. Notices must read the original boarding.
 */
import {expect,it} from 'vitest';
import {makeGameInWorld,ScriptedProvider} from './harness.js';
import {ProviderNarrator} from '../../src/web/narrator.js';
import {prepareWorldClockForPreciseSpan} from '../../src/server/state/cultivation-world.js';
import {worldLocationFor} from '../../src/engine/world/place-lookup.js';
import {walkingDaysFrom} from '../../src/engine/world/locations.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {createNpc,setRealm} from '../../src/engine/world/npc-state.js';
import {aVehicleOf,takeItAlong} from '../../src/engine/world/a-vehicle.js';
import {requireConveyance} from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {daysByConveyance} from '../../src/engine/world/what-a-conveyance-does-to-a-journey.js';
import {acceptOwnedPassage,ownedPassageClaim,ownedCarrierAt} from '../../src/web/an-owned-passage.js';
import {passHours} from '../../src/web/routine-invitations.js';
import {roadPositionOfNpc,journeyNeedsWater} from '../../src/engine/world/places-on-the-way.js';
import {sameRoadPosition} from '../../src/engine/world/road-course.js';
import {makeAreaStatus,liftStatus,STOPS_PASSAGE} from '../../src/engine/world/what-is-true-of-a-place-right-now.js';
import {forStream} from '../../src/engine/cultivation/rng.js';
import {bodilyTroubleAboard} from '../../src/engine/world/a-captain-answers-trouble.js';
import {privateWorkBodies} from '../../src/web/private-work-with-a-person.js';
import {witnessIndexFor} from '../../src/engine/world/witness-reaction-index.js';

async function departure(){
 const plans:string[]=[];
 const h=await makeGameInWorld({seed:'private-driver-duty',worldSeed:'road-world',
  narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-review',timeoutMs:0})});
 try{
  await h.game.newRun('Private carriage owner');let now=h.game.currentRun();
  h.repos.cultivators.update(now.cultivator.id,{location:'Wind Turn',standingIn:null,realmOrdinal:20,hp:1000,maxHp:1000,spiritStones:100000,satiety:100});
  now=h.game.currentRun();h.game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
  const world=h.game.atHand!,day=routineTime(world),from=worldLocationFor(world,now.cultivator.location)!;
  const craft=requireConveyance('conv-carriage-earth'),distances=walkingDaysFrom(world.locations,from.id);
  const to=world.locations.find(place=>place.kind==='settlement'&&place.id!==from.id
   &&!journeyNeedsWater(world.locations,from.id,place.id)
   &&distances.has(place.id)&&daysByConveyance(distances.get(place.id)!,craft)>1
   &&daysByConveyance(distances.get(place.id)!,craft)<10)!;
  expect(to).toBeDefined();
  const pilot=setRealm(createNpc(world.seed,{id:'private-actual-driver',name:'Private driver',onDay:day,
   bornOnDay:day-35*365,locationId:from.id,occupation:'carter'}),20,day);
  pilot.activity={kind:'out_with_a_party',note:'The actual arranged private company.',withIds:[now.cultivator.id],sinceDay:day,untilDay:day+100};
  world.npcs.push(pilot);
  const cart=aVehicleOf({id:'private-emergency-cart',conveyanceId:craft.id,ownerId:now.cultivator.id,ownerName:now.cultivator.name,at:from.id});
  world.objects.push(cart);takeItAlong(world.objects,cart,now.cultivator.id);
  const root=acceptOwnedPassage(h.game,now.run,now.cultivator,{vesselId:cart.id,pilotId:pilot.id,fromId:from.id,toId:to.id,
   walkingDays:distances.get(to.id)!,days:daysByConveyance(distances.get(to.id)!,craft),conveyanceId:craft.id,power:cart.power,companions:[pilot.id]});
  world.factions=[];world.schedule=[];world.npcs=world.npcs.filter(person=>person.id===pilot.id||person.id===now.cultivator.id);
  expect((await passHours(h.game,h.game.currentRun().run,h.game.currentRun().cultivator,3)).finished).toBe(true);
  return {...h,plans,world:h.game.atHand!,from,to,pilot,cart,root};
 }catch(error){h.db.close();throw error;}
}

function choose(world:Awaited<ReturnType<typeof departure>>['world'],operatorId:string,key:string){
 for(let sample=0;sample<10000;sample++){
  const seed=`private-driver-answers-${sample}`;
  if(forStream(seed,'captain-duty-decision',operatorId,key).next()<.01){world.seed=seed;return;}
 }
 throw Error('No ordinary consenting driver draw.');
}

it('a private driver returns a real stricken passenger from their actual admitted point',async()=>{
 const h=await departure();try{
  const now=h.game.currentRun(),day=routineTime(h.world),driver=h.world.npcs.find(person=>person.id===h.pilot.id)!;
  const point=roadPositionOfNpc(h.world.locations,driver,day)!;
  const plague={outbreakId:'actual-private-road-plague',contractedOnDay:day,endsOnDay:day+30,fatalOnDay:null,treatedOnDay:null};
  h.repos.cultivators.update(now.cultivator.id,{plague});
  const actual=privateWorkBodies(h.game).person(now.cultivator.id)!;
  const trouble=bodilyTroubleAboard({...actual,cultivation:{...actual.cultivation,plague}},day)!;
  choose(h.world,driver.id,trouble.key);const stones=h.game.currentRun().cultivator.spiritStones;
  h.plans.push(JSON.stringify({action:'look'}));expect((await h.game.act('I look around')).narration).toContain('for care');
  const claim=ownedPassageClaim(h.db,now.cultivator.id)!,fact=witnessIndexFor(h.world).byId.get(claim.receiptId)!;
  expect(fact.causes).toContain(h.root);expect(fact.data.vesselId).toBe(h.cart.id);
  expect(fact.data.toLocationId).toBe(h.from.id);
  expect(sameRoadPosition(point,roadPositionOfNpc(h.world.locations,h.world.npcs.find(person=>person.id===driver.id)!,day))).toBe(true);
  expect(h.game.currentRun().cultivator.location).not.toBe(h.from.name);
  expect(h.game.currentRun().cultivator.plague!.treatedOnDay).toBeNull();
  expect(h.game.currentRun().cultivator.spiritStones).toBe(stones);
 }finally{h.db.close();}
},120_000);

it('a private driver holds at the real road point and resumes after the actual danger is lifted',async()=>{
 const h=await departure();try{
  const now=h.game.currentRun(),day=routineTime(h.world),driver=h.world.npcs.find(person=>person.id===h.pilot.id)!;
  const point=roadPositionOfNpc(h.world.locations,driver,day)!,source=ownedCarrierAt(h.world,h.root,now.cultivator,day)!;
  const status=makeAreaStatus({id:'actual-private-road-danger',areaId:source.locationId!,kind:'roadblock',
   statement:'The road is blocked here.',cause:{what:'The actual blocked road.',decidedById:null,factId:null},
   stops:[STOPS_PASSAGE],beganOnDay:day,reviewOnDay:day+5});
  h.world.statuses.push(status);choose(h.world,driver.id,`owned-passage:${status.id}:${status.reviewOnDay}`);
  h.game.theWorldMoved();
  h.plans.push(JSON.stringify({action:'look'}));const told=await h.game.act('I look around');
  expect(told.narration).toContain('hold the carriage');
  const held=ownedPassageClaim(h.db,now.cultivator.id)!;
  expect(witnessIndexFor(h.world).byId.get(held.receiptId)!.data.heldOwnedForStatusId).toBe(status.id);
  expect(sameRoadPosition(point,roadPositionOfNpc(h.world.locations,h.world.npcs.find(person=>person.id===driver.id)!,day))).toBe(true);
  h.world.statuses[h.world.statuses.findIndex(row=>row.id===status.id)]=liftStatus(status,day);
  h.plans.push(JSON.stringify({action:'look'}));expect((await h.game.act('I look around')).narration).toContain('resumed the accepted voyage');
  const resumed=ownedPassageClaim(h.db,now.cultivator.id)!,fact=witnessIndexFor(h.world).byId.get(resumed.receiptId)!;
  expect(fact.data.departureDay).toBe(day);expect(fact.data.vesselId).toBe(h.cart.id);expect(fact.data.toLocationId).toBe(h.to.id);
  expect((await passHours(h.game,h.game.currentRun().run,h.game.currentRun().cultivator,3)).finished).toBe(true);
  expect(sameRoadPosition(point,roadPositionOfNpc(h.world.locations,h.world.npcs.find(person=>person.id===driver.id)!,routineTime(h.world)))).toBe(false);
 }finally{h.db.close();}
},120_000);
