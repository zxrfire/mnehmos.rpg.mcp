/** Assistance had an unreachable other-vessel branch: the water reader selected
 * only passengers on the same hull. This uses two actually admitted public
 * courses meeting at an existing canonical water vertex. A real held dose,
 * ordinary duty/disposal decisions and the actual span must produce the aid.
 * Sharing an ocean outside that crossing must not produce a second response.
 * Native appointments must start at the admitted year boundary, before the
 * world clock advances. Disabling only that producer made the Native control
 * fail while the lived crossing passed; restoring it passed both controls.
 */
import { expect,it } from 'vitest';
import { atTheActualCaptain } from './fixtures/at-the-real-captain.js';
import { createNpc,isTheWorldsToMove } from '../../src/engine/world/npc-state.js';
import { advanceWorldForPlay } from '../../src/engine/world/driver.js';
import { publicShipLinesFrom,quotePublicPassage,thePortsShipsPutInAt } from '../../src/engine/world/public-shipping.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { commitNpcPublicPassage } from '../../src/engine/world/ship-crew.js';
import { firstTravellerOnTheWay,isWater,startNpcPassage } from '../../src/engine/world/places-on-the-way.js';
import { walkingRouteFrom } from '../../src/engine/world/locations.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { bodilyTroubleAboard } from '../../src/engine/world/a-captain-answers-trouble.js';
import { makeObject } from '../../src/engine/world/possessions.js';
import { PILLS } from '../../src/data/cultivation/pills.js';
import { forStream } from '../../src/engine/cultivation/rng.js';

async function crossingArrangement(){
 const h=await atTheActualCaptain();try{
  const world=h.game.atHand!,day=routineTime(world),own=shipPassengerAt(world,h.receipt.id,day)!;
  const route=walkingRouteFrom(world.locations,own.fromId,own.toId)!;
  let other:ReturnType<typeof startNpcPassage>=null;
  const services=thePortsShipsPutInAt(world).flatMap(name=>{
   const from=worldLocationFor(world,name);
   return from?publicShipLinesFrom(world,from.name,own.departureDay).map(line=>({from,line})):[];
  });
  for(const {from,line} of services){
   const to=worldLocationFor(world,line.to);
   if(!to)continue;
   const theirRoute=walkingRouteFrom(world.locations,from.id,to.id);
   const site=route.find(stop=>theirRoute?.some(one=>one.locationId===stop.locationId)
      &&isWater(world.locations.find(place=>place.id===stop.locationId)!));
   if(!site||!theirRoute)continue;
   const theirSite=theirRoute.find(stop=>stop.locationId===site.locationId)!;
   const crossing=own.departureDay+(own.arrivalDay-own.departureDay)*site.days/route.at(-1)!.days;
   let departure=crossing-line.days*theirSite.days/theirRoute.at(-1)!.days;
   let quote=quotePublicPassage(world,from.id,to.id,departure,1);
   for(let refine=0;quote&&refine<3;refine++){
    departure=crossing-quote.days*theirSite.days/theirRoute.at(-1)!.days;
    quote=quotePublicPassage(world,from.id,to.id,departure,1);
   }
   if(!quote||quote.vesselId===own.vesselId)continue;
   const person=createNpc(world.seed,{id:'patient-on-the-other-actual-hull',name:'The other passenger',
      onDay:departure,bornOnDay:departure-25*365,locationId:from.id,spiritStones:10000});
   const accepted=startNpcPassage(world.locations,person,{lane:quote.lane,destinationId:to.id,
      onDay:quote.departureDay,days:quote.days,fareStones:quote.fareStones,purpose:'An actual other voyage.'});
   if(!accepted||accepted.activity?.vesselId===own.vesselId)continue;
   const contact=firstTravellerOnTheWay({locations:world.locations,npcs:[accepted],fromId:own.fromId,toId:own.toId,
      onDay:day,days:own.arrivalDay-day,overWater:true,journey:{sinceDay:own.departureDay,untilDay:own.arrivalDay}});
   if(contact){other=accepted;break;}
  }
  expect(other,'Two actually admitted public courses must cross at a real water vertex.').not.toBeNull();
  world.npcs.push(other!);expect(commitNpcPublicPassage(world,other!)).toBe(true);
  const patient=world.npcs.find(person=>person.id===other!.id)!;
  patient.cultivation.plague={outbreakId:'other-vessel-plague',contractedOnDay:day,endsOnDay:day+30,fatalOnDay:null,treatedOnDay:null};
  const trouble=bodilyTroubleAboard(patient,day)!;
  const theirCaptain=world.npcs.find(person=>person.tags.includes(`crew-of:${patient.activity!.vesselId}`)&&person.identity.occupation==='shipmaster')!;
  const pill=PILLS.find(pill=>pill.effect==='treat_injury'&&pill.grade==='mortal')!;
  world.objects.push(makeObject({id:'captains-actual-aid-dose',name:pill.name,kind:'pill',ownerId:h.captain.id,
      possessorId:h.captain.id,data:{pillId:pill.id,quantity:1}}));
  let selected=false;
  for(let sample=0;sample<2_000_000;sample++){
   const seed=`captain-real-crossing-${sample}`;
   if(forStream(seed,'captain-duty-decision',h.captain.id,`distress:${patient.activity!.vesselId}:${trouble.key}`).next()<.01
      &&forStream(seed,'captain-aid-goods',h.captain.id,patient.activity!.vesselId!,trouble.key).next()<.01
      &&forStream(seed,'captain-duty-decision',theirCaptain.id,trouble.key).next()>.99){world.seed=seed;selected=true;break;}
  }
  expect(selected,'The fixture needs an ordinary aid draw and the other master continuing.').toBe(true);
  const contact=firstTravellerOnTheWay({locations:world.locations,npcs:[patient],fromId:own.fromId,toId:own.toId,
      onDay:day,days:own.arrivalDay-day,overWater:true,journey:{sinceDay:own.departureDay,untilDay:own.arrivalDay}})!;
  return {...h,patient,contact};
 }catch(error){h.db.close();throw error;}
}

it('the actual captain assists another real vessel at its crossing and spends their own held medicine',async()=>{
 const h=await crossingArrangement();try{
  const world=h.game.atHand!,{patient,contact}=h;
  const stones=h.game.currentRun().cultivator.spiritStones;
  h.game.theWorldMoved();
  h.plans.push(JSON.stringify({action:'wait',days:contact.afterDays+.001}));
  const reached=await h.game.act('I wait aboard until the crossing.');
  expect(reached.narration).toContain('render assistance');
  expect(reached.narration.match(/render assistance/g)).toHaveLength(1);
  expect(world.npcs.find(person=>person.id===patient.id)!.cultivation.plague!.treatedOnDay).not.toBeNull();
  expect(world.objects.find(object=>object.id==='captains-actual-aid-dose')!.data.spent).toBe(true);
  expect(h.game.currentRun().cultivator.spiritStones).toBe(stones);
  expect(h.game.currentRun().cultivator.location).not.toBe(h.to.name);
  h.plans.push(JSON.stringify({action:'look'}));
  expect((await h.game.act('I look around')).narration).not.toContain('render assistance');
 }finally{h.db.close();}
},120_000);

it('an NPC-only calendar reaches the same actual crossing without a foreground passage caller',async()=>{
 const h=await crossingArrangement();try{
  const world=h.game.atHand!;
  world.npcs=world.npcs.filter(isTheWorldsToMove);world.runs=[];
  const before=h.game.currentRun().cultivator.location;
  advanceWorldForPlay(world,{days:h.contact.afterDays+.001});
  expect(world.history.facts.some(fact=>fact.data.responseCarriedOut===true
    &&fact.actors.some(actor=>actor.id===h.captain.id)&&fact.summary.includes('render assistance'))).toBe(true);
  expect(world.npcs.find(person=>person.id===h.patient.id)!.cultivation.plague!.treatedOnDay).not.toBeNull();
  expect(world.objects.find(object=>object.id==='captains-actual-aid-dose')!.data.spent).toBe(true);
  expect(h.game.currentRun().cultivator.location).toBe(before);
 }finally{h.db.close();}
},120_000);
