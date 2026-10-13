/** Captain emergencies use actual bodies and ordinary decisions, never an
 * emergency odds table. A healthy body carrying a stable meridian injury is
 * not an acute case. An actual stricken passenger can make a Native pilot
 * divert the same real craft, paying actual fuel and retaining real people.
 */
import { expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc,setRealm,bodyTaken,maxBodyOf } from '../../../src/engine/world/npc-state.js';
import { createInjury } from '../../../src/engine/cultivation/injuries.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { bodilyTroubleAboard } from '../../../src/engine/world/a-captain-answers-trouble.js';
import { nativePilotAtTheirAppointment } from '../../../src/engine/world/a-native-pilot-answers-trouble.js';
import { aVehicleOf,takeItAlong } from '../../../src/engine/world/a-vehicle.js';
import { beginAnAirCourse,recordPaidAirCourseFuel,actualNpcPilotOfAirCourse } from '../../../src/engine/world/an-air-course-in-the-world.js';
import { quoteAnAirJourney } from '../../../src/engine/world/what-an-air-journey-takes.js';
import { requireConveyance } from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { witnessIndexFor,factsWithDataValue } from '../../../src/engine/world/witness-reaction-index.js';

it('stable old wounds on a recovered body do not make every voyage a medical emergency',()=>{
 const person=createNpc('stable-wound',{id:'recovered-sailor',onDay:100,bornOnDay:100-30*365});
 person.cultivation.injuries=[createInjury({severity:'serious',source:'combat',turn:0},forStream('stable-wound','injury'))];
 expect(bodilyTroubleAboard(person,100)).toBeNull();
 expect(bodilyTroubleAboard(bodyTaken(person,Math.ceil(maxBodyOf(person)/3),100),100)).not.toBeNull();
});

it('an actual Native pilot diverts a stricken passenger on the same hull with an actual personal fuel debit',()=>{
 const world=createWorld({seed:'native-captain-air',regionCount:0,skipPriorAges:true});
 world.currentDay=100;world.currentHour=0;
 const from=makeLocation({id:'native-flight-home',name:'Departure town',kind:'settlement',data:{metricXLi:0,metricYLi:0}});
 const to=makeLocation({id:'native-flight-destination',name:'Destination town',kind:'settlement',data:{metricXLi:6000,metricYLi:0}});
 world.locations.push(from,to);
 let captain=setRealm(createNpc(world.seed,{id:'actual-native-pilot',name:'The actual pilot',onDay:100,
  bornOnDay:100-40*365,locationId:from.id,homeLocationId:from.id,spiritStones:100000}),29,100);
 let patient=createNpc(world.seed,{id:'actual-native-passenger',onDay:100,bornOnDay:100-25*365,locationId:from.id});
 world.npcs.push(captain,patient);
 const boat=aVehicleOf({id:'actual-native-care-hull',conveyanceId:'conv-spirit-boat',ownerId:captain.id,ownerName:captain.name,at:from.id});
 world.objects.push(boat);takeItAlong(world.objects,boat,captain.id);
 const craft=requireConveyance('conv-spirit-boat');
 const destination=world.locations.filter(place=>place.kind==='settlement'&&!place.tags.includes('interior'))
  .map(place=>({place,quote:quoteAnAirJourney(world.locations,from.id,place.id,craft,boat.power,2,{facts:witnessIndexFor(world).byId,onDay:100})}))
  .find(row=>row.quote&&row.quote.trips===1&&row.quote.daysOneWay>.25)!;
 expect(destination).toBeDefined();
 const accepted=beginAnAirCourse(world,{bodyId:captain.id,bodyName:captain.name,fromId:from.id,toId:destination.place.id,
  conveyanceId:craft.id,power:boat.power,vesselId:boat.id,artId:null,onDay:100,heads:2,
  owned:{ownerId:captain.id,pilotId:captain.id},actualLoad:[captain,patient]})!;
 expect(accepted).not.toBeNull();
 captain=world.npcs.find(person=>person.id===captain.id)!;
 patient=world.npcs.find(person=>person.id===patient.id)!;
 captain.spiritStones-=accepted.quote.stonesBurned;
 recordPaidAirCourseFuel(world,accepted.fact.id,captain.id,100+accepted.quote.daysOneWay,accepted.quote.stonesBurned,100);
 captain=world.npcs.find(person=>person.id===captain.id)!;
 patient=world.npcs.find(person=>person.id===patient.id)!;
 for(const person of [captain,patient]){person.locationId=accepted.location.id;person.activity={kind:'travelling',note:'The accepted private flight.',
  withIds:[captain.id,patient.id].filter(id=>id!==person.id),fromLocationId:from.id,returnTo:destination.place.id,
  sinceDay:100,untilDay:100+accepted.quote.daysOneWay,vesselId:boat.id,conveyanceId:craft.id,airCourseLocationId:accepted.location.id};}
 world.currentHour=3;
 patient.cultivation.plague={outbreakId:'actual-native-flight-plague',contractedOnDay:100.125,endsOnDay:130,fatalOnDay:null,treatedOnDay:null};
 const trouble=bodilyTroubleAboard(patient,100.125)!;
 for(let sample=0;sample<10000;sample++){
  const seed=`native-pilot-diverts-${sample}`;
  if(forStream(seed,'captain-duty-decision',captain.id,trouble.key).next()<.01){world.seed=seed;break;}
 }
 const before=captain.spiritStones;
 expect(actualNpcPilotOfAirCourse(world,accepted.fact.id)).not.toBeNull();
 const answer=nativePilotAtTheirAppointment(world,accepted.fact.id,100.125)!;
 expect(answer).not.toBeNull();expect(answer.data.responseCarriedOut).toBe(true);
 const changed=world.history.facts.find(fact=>fact.data.changedOwnedCourse===true&&fact.causes.includes(accepted.fact.id))!;
 expect(changed).toBeDefined();expect(changed.data.vesselId).toBe(boat.id);
 expect(changed.data.fromLocationId).toBe(accepted.location.id);
 expect(world.npcs.find(person=>person.id===patient.id)!.activity!.airCourseLocationId).not.toBe(accepted.location.id);
 const fuel=factsWithDataValue(world,'airFuelPaidFor',changed.id).reduce((sum,fact)=>sum+Number(fact.data.stonesDebited),0);
 expect(fuel).toBeGreaterThan(0);expect(world.npcs.find(person=>person.id===captain.id)!.spiritStones).toBe(before-fuel);
 expect(world.npcs.find(person=>person.id===patient.id)!.cultivation.plague!.treatedOnDay).toBeNull();
});
