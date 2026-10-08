/** A dated wreck is not licence to merge everybody projected onto one sea ID.
 * This control boards a second real public hull through the ordinary NPC fare/
 * booking/crew factory. The other course genuinely overlaps on the same coarse
 * water, so the current scene must still derive only the actual failed course.
 * Losing a hull neither fabricates a surviving deck nor hides its actual nearby
 * living operator. No rescue, widened crowd cap or passenger roster is added.
 * Native35326 failed at setup: the already-departed dock had no second hull.
 * This successor uses actual public calendars and ordinary lane projection to
 * find two genuinely overlapping accepted hulls. Native52637 then reached the
 * actual wreck: all five foreign-hull bodies entered the 14-person coarse sea
 * read and ten intact deck areas survived. This successor filters the actual
 * caused loss receipt before placement. It is not a rescue or carrier repair.
 */
import {expect,it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {atTheActualCaptain} from './fixtures/at-the-real-captain.js';
import {createNpc} from '../../src/engine/world/npc-state.js';
import {publicShipLinesFrom,earliestQuotedPublicPassage} from '../../src/engine/world/public-shipping.js';
import {startNpcPassage,isWater} from '../../src/engine/world/places-on-the-way.js';
import {commitNpcPublicPassage} from '../../src/engine/world/ship-crew.js';
import {shipPassengerAt,settleLostPublicPassages} from '../../src/engine/world/passenger-on-a-vessel.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {ruin} from '../../src/engine/world/possessions.js';
import {locationOnNpcJourney} from '../../src/engine/world/places-on-the-way.js';
import {advanceWorldForPlay} from '../../src/engine/world/driver.js';
import {projectActualPassengers} from '../../src/web/passengers-at-the-actual-clock.js';
import {peopleInThisPlace} from '../../src/web/hearsay.js';
import {worldLocationFor} from '../../src/web/entities.js';
it('keeps the failed-course people distinct from a different real hull on the same water and offers no intact deck',async()=>{
 const f=await atTheActualCaptain();try{
  const today=routineTime(f.world),old=shipPassengerAt(f.world,f.receipt.id,today)!;
  // Read all authored public docks, including opposite ends of real lanes. The
  // old fixture asked only the already-departed dock at one exact date, where
  // native run 35326 correctly found no second available hull. No physics ran.
  const born=createNpc(f.world.seed,{id:'other-real-wreck-control-passenger',locationId:null,onDay:today,
   bornOnDay:today-25*365,occupation:'merchant',takenNames:new Set(f.world.npcs.map(n=>n.name))});
  const choices=f.world.locations.filter(p=>p.tags.includes('city')).flatMap(port=>
   publicShipLinesFrom(f.world,port.name,today).flatMap(line=>{
    const to=worldLocationFor(f.world,line.to);if(!to)return [];
    const q=earliestQuotedPublicPassage(f.world,port.id,to.id,today,old.arrivalDay+line.days,1);
    if(!q||q.vesselId===old.vesselId||q.departureDay+.125>=old.arrivalDay)return [];
    const candidate=startNpcPassage(f.world.locations,{...born,locationId:port.id,spiritStones:5000},
     {lane:q.lane,destinationId:q.toId,onDay:q.departureDay,days:q.days,fareStones:q.fareStones,purpose:'An independently paid passage.'});
    const otherGround=candidate&&locationOnNpcJourney(f.world.locations,candidate,q.departureDay+.125);
    const original=shipPassengerAt(f.world,f.receipt.id,q.departureDay+.125);
    const water=otherGround&&f.world.locations.find(row=>row.id===otherGround);
    return candidate&&water&&isWater(water)&&original?.locationId===otherGround?[{quote:q,candidate}]:[];
   })).sort((a,b)=>a.quote.departureDay-b.quote.departureDay);
  fs.appendFileSync(path.join(process.cwd(),'.claude/public-wreck-presence-setup-20261007-05.jsonl'),JSON.stringify({
   today,originalVessel:old.vesselId,originalArrival:old.arrivalDay,
   choices:choices.map(c=>({vessel:c.quote.vesselId,from:c.quote.fromId,to:c.quote.toId,departure:c.quote.departureDay,arrival:c.quote.arrivalDay}))
  })+'\n');
  const selected=choices[0];expect(selected,'Two native bookable hulls with actual overlapping water ground are required.').toBeTruthy();
  const another=selected!.quote;
  if(another.departureDay>today)advanceWorldForPlay(f.world,{days:another.departureDay-today,preciseDays:true,stopOnInterrupt:false,
   atWorldBoundary:(world,day)=>projectActualPassengers(f.db,world,f.game.currentRun().cultivator.id,day)});
  const passenger=startNpcPassage(f.world.locations,{...born,locationId:another.fromId,spiritStones:5000},{lane:another!.lane,destinationId:another!.toId,
   onDay:another.departureDay,days:another!.days,fareStones:another!.fareStones,purpose:'An independently paid passage.'})!;
  f.world.npcs.push(passenger);expect(commitNpcPublicPassage(f.world,passenger)).toBe(true);
  advanceWorldForPlay(f.world,{days:.125,preciseDays:true,stopOnInterrupt:false,atWorldBoundary:(world,day)=>projectActualPassengers(f.db,world,f.game.currentRun().cultivator.id,day)});
  const now=routineTime(f.world),actual=shipPassengerAt(f.world,f.receipt.id,now)!;
  expect(locationOnNpcJourney(f.world.locations,f.world.npcs.find(n=>n.id===passenger.id)!,now)).toBe(actual.locationId);
  const at=f.world.objects.findIndex(o=>o.id===actual.vesselId);f.world.objects[at]=ruin(f.world.objects[at]!,{onDay:now,source:'The actual hull was lost here.'});
  settleLostPublicPassages(f.world,now);settleLostPublicPassages(f.world,now);
  projectActualPassengers(f.db,f.world,f.game.currentRun().cultivator.id,now);f.game.theWorldMoved();
  const lossReceipts=f.world.history.facts.filter(fact=>fact.data.publicPassageLost===true&&fact.causes.includes(f.receipt.id));

  const body=f.game.currentRun().cultivator,place=worldLocationFor(f.world,body.location)!,read=peopleInThisPlace(f.game.repos,body,f.world,place);
  const foreign=new Set(f.world.npcs.filter(n=>n.activity?.vesselId===another!.vesselId).map(n=>n.id));
  fs.appendFileSync(path.join(process.cwd(),'.claude/public-wreck-presence-review-20261007-01.jsonl'),JSON.stringify({
   at:now,originalReceipt:f.receipt.id,failedVessel:actual.vesselId,otherVessel:another!.vesselId,
   body:{id:body.id,location:body.location,standingIn:body.standingIn},
   people:read.people.map(p=>({id:p.id,name:p.name})),areas:read.areas,whereIs:[...read.whereIs],
   failedCourse:f.world.history.facts.filter(fact=>fact.data.publicPassageLost===true).map(fact=>({id:fact.id,data:fact.data,actors:fact.actors,causes:fact.causes})),
   foreign:[...foreign],captainId:f.captain.id
  })+'\n');
  expect(read.people.some(person=>foreign.has(person.id)),JSON.stringify({people:read.people.map(p=>p.id),areas:read.areas})).toBe(false);
  expect(lossReceipts).toHaveLength(1);
  expect(lossReceipts[0]!.data.toLocationId).toBe(actual.locationId);
  expect(read.whereIs.has(f.captain.id)).toBe(true);
  expect(f.game.present(f.game.currentRun().cultivator).some(person=>person.id===f.captain.id)).toBe(true);
  expect(read.areas.some(area=>area.for==='deck'||area.for==='room')).toBe(false);
  f.plans.push(JSON.stringify({action:'interact',target:'captain',intent:'talk',topic:'hello'}));
  const talked=await f.game.act('I greet the captain who was beside me.');
  expect(talked.toolCalls.some(call=>call.name==='engine.askedAbout'&&call.ok&&call.summary.startsWith('Asked '+f.captain.name+' about ')),JSON.stringify(talked.toolCalls)).toBe(true);
 }finally{f.db.close();}
});
