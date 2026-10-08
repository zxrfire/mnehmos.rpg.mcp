/** A passenger living inside a port walks to its actual landing before paying.
 * The ordinary world clock finishes that approach and commits the native hull;
 * closing the room's door during the walk must prevent boarding and payment.
 * Background transport must visit that deadline without turning an unrelated
 * person's practice into an exact appointment. Played advances retain both. */
import {expect,it} from 'vitest';
import {createWorld} from '../../../src/engine/world/world-state.js';
import {createNpc,setRealm} from '../../../src/engine/world/npc-state.js';
import {makeLocation} from '../../../src/engine/world/locations.js';
import {bookNpcPassageForRoute} from '../../../src/engine/world/places-on-the-way.js';
import {continueNpcDepartureApproach} from '../../../src/engine/world/npc-departure-approaches.js';
import {advanceWorldForPlay} from '../../../src/engine/world/driver.js';
import {startNpcJourney} from '../../../src/engine/world/dao-ground-stints.js';
import {aVehicleOf} from '../../../src/engine/world/a-vehicle.js';
import {nextWorldClockBoundary} from '../../../src/engine/world/world-clock-boundaries.js';
import {actualVesselRooms,vesselRoomAreaId} from '../../../src/engine/world/rooms-in-a-vessel.js';

function scene(){
 const world=createWorld({seed:'npc-walks-to-landing',regionCount:0,skipPriorAges:true});
 world.currentHour=0;world.populationTarget=0;
 const port=makeLocation({id:'port',name:'Emerald Water City',kind:'settlement'});
 const destination=makeLocation({id:'island',name:'Sweet Spring Island',kind:'settlement'});
 const room=makeLocation({id:'room',name:'The port lodging',kind:'chamber',parentId:port.id,tags:['interior']});
 world.locations.push(port,destination,room);
 const passenger={...createNpc(world.seed,{id:'passenger',locationId:room.id,onDay:world.currentDay,
  bornOnDay:world.currentDay-20*365}),spiritStones:100};
 world.npcs.push(passenger);
 const approach=bookNpcPassageForRoute(world,passenger,destination.id,world.currentDay,'Taking wares to the island.');
 expect(approach?.activity?.departureApproach).toBeDefined();
 world.npcs[0]=approach!;
 return {world,room,passenger,port,destination};
}
it('keeps transport deadlines exact without enumerating unrelated background practice',()=>{
 const h=scene(),day=h.world.currentDay;
 h.world.npcs.push({...createNpc(h.world.seed,{id:'practising-neighbour',locationId:h.port.id,
  onDay:day,bornOnDay:day-20*365}),activity:{kind:'their_practice',note:'Practising.',
  withIds:[],sinceDay:day,untilDay:day+.125,returnTo:h.port.id}});
 expect(nextWorldClockBoundary(h.world,day,day+1,[],{intensity:0},'transport')?.onDay).toBe(day+.25);
 expect(nextWorldClockBoundary(h.world,day,day+1,[],{intensity:0})?.onDay).toBe(day+.125);
});
it('an actual cabin occupant starts the same hull course without a shore approach',()=>{
 const h=scene(),day=h.world.currentDay;
 Object.assign(h.port.data,{metricXLi:0,metricYLi:0});
 Object.assign(h.destination.data,{metricXLi:40,metricYLi:0});
 const hull=aVehicleOf({id:'cabin-hull',conveyanceId:'conv-spirit-boat',ownerId:h.passenger.id,
  ownerName:h.passenger.name,at:h.port.id});
 hull.power=30;
 h.world.objects.push(hull);
 const cabin=actualVesselRooms(hull).find(room=>room.slot.access==='holder')!;
 expect(cabin).toBeDefined();
 const passenger={...setRealm(h.passenger,29,day),locationId:h.port.id,activity:{kind:'idle' as const,
  note:'In the cabin.',withIds:[],sinceDay:day,untilDay:null,
  standingIn:vesselRoomAreaId(h.port.id,hull.id,cabin.slot.id)}};
 h.world.npcs[0]=passenger;
 const moving=startNpcJourney(h.world,passenger,h.destination.id,day,'Travelling in the actual hull.',hull);
 expect(moving.activity?.departureApproach).toBeUndefined();
 expect(moving.activity?.airCourseLocationId).toBeTruthy();
 expect(moving.activity?.vesselId).toBe(hull.id);
 expect(moving.activity?.sinceDay).toBe(day);
 expect(h.world.currentDay).toBe(day);
 expect(h.world.history.facts.some(fact=>fact.data.airCourse===true&&fact.data.vesselId===hull.id)).toBe(true);
});
it('uses a timed station approach in the ordinary world driver before actual boarding',()=>{
 const h=scene(),day=h.world.currentDay;
 expect(h.world.npcs[0]!.spiritStones).toBe(h.passenger.spiritStones);
 expect(h.world.npcs[0]!.locationId).toBe(h.room.id);
 expect(h.world.objects).toHaveLength(0);
 const moved=advanceWorldForPlay(h.world,{days:.25,access:{actorId:'observer',locationId:h.port.id,factionId:null,
  knowsNpc:()=>false,knowsFaction:()=>false,knowsPlace:()=>false}});
 const actual=moved.state.npcs.find(n=>n.id===h.passenger.id)!;
 expect(actual.activity?.vesselId).toBeTruthy();
 expect(actual.activity?.sinceDay).toBeCloseTo(day+.25);
 expect(actual.spiritStones).toBeLessThan(h.passenger.spiritStones);
 expect(moved.state.history.facts.some(f=>f.data.actualBoarding===true&&f.actors.some(a=>a.id===actual.id))).toBe(true);
 expect(moved.state.objects.some(o=>o.id===actual.activity?.vesselId)).toBe(true);
});
it('leaves a locked-in passenger and their purse at the actual room',()=>{
 const h=scene();h.room.sealed=true;h.world.currentDay+=.25;
 expect(continueNpcDepartureApproach(h.world,h.world.npcs[0]!,h.world.currentDay)).toBe(true);
 expect(h.world.npcs[0]!.locationId).toBe(h.room.id);
 expect(h.world.npcs[0]!.spiritStones).toBe(h.passenger.spiritStones);
 expect(h.world.objects).toHaveLength(0);
 expect(h.world.history.facts).toHaveLength(0);
});
it('walks to the actual owned carriage station before beginning its finite road leg',()=>{
 const h=scene(),day=h.world.currentDay;
 h.world.npcs[0]=h.passenger;
 const town=makeLocation({id:'road-town',name:'Pine Bridge',kind:'settlement'});
 h.world.locations.push(town);
 h.port.links.push({toLocationId:town.id,kind:'road',travelDays:2,open:true,requiresKeyId:null,note:''});
 const carriage=aVehicleOf({id:'actual-carriage',conveyanceId:'conv-carriage-mortal',ownerId:h.passenger.id,
  ownerName:h.passenger.name,at:h.port.id});
 h.world.objects.push(carriage);
 const approach=startNpcJourney(h.world,h.passenger,town.id,day,'Carrying wares to Pine Bridge.',carriage);
 expect(approach.activity?.departureApproach?.vehicleId).toBe(carriage.id);
 expect(approach.locationId).toBe(h.room.id);expect(approach.activity?.vesselId).toBeUndefined();
 h.world.npcs[0]=approach;h.world.currentDay+=.25;
 continueNpcDepartureApproach(h.world,approach,h.world.currentDay);
 const actual=h.world.npcs[0]!;
 expect(actual.locationId).toBe(h.port.id);
 expect(actual.activity?.vesselId).toBe(carriage.id);
 expect(actual.activity?.fromLocationId,JSON.stringify(actual.activity)).toBe(h.port.id);
 expect(actual.activity?.returnTo).toBe(town.id);
 expect(actual.activity?.sinceDay).toBe(day+.25);
 expect(actual.activity!.untilDay).toBeGreaterThan(day+.25);
});
it('leaves its actual lodging before setting out on foot in the ordinary clock',()=>{
 const h=scene(),day=h.world.currentDay;
 h.world.npcs[0]=h.passenger;
 const town=makeLocation({id:'foot-town',name:'Pine Bridge',kind:'settlement'});
 h.world.locations.push(town);
 h.port.links.push({toLocationId:town.id,kind:'road',travelDays:2,open:true,requiresKeyId:null,note:''});
 const approach=startNpcJourney(h.world,h.passenger,town.id,day,'Walking to Pine Bridge.');
 expect(approach.locationId).toBe(h.room.id);
 expect(approach.activity?.departureApproach).toBeDefined();
 h.world.npcs[0]=approach;
 const moved=advanceWorldForPlay(h.world,{days:.25,access:{actorId:'observer',locationId:h.port.id,factionId:null,
  knowsNpc:()=>false,knowsFaction:()=>false,knowsPlace:()=>false}});
 const actual=moved.state.npcs.find(person=>person.id===h.passenger.id)!;
 expect(actual.locationId).toBe(h.port.id);
 expect(actual.activity?.fromLocationId,JSON.stringify(actual.activity)).toBe(h.port.id);
 expect(actual.activity?.returnTo).toBe(town.id);
 expect(actual.activity?.sinceDay).toBeCloseTo(day+.25);
 expect(actual.activity!.untilDay).toBeGreaterThan(day+.25);
 expect(actual.spiritStones).toBe(h.passenger.spiritStones);
 expect(actual.activity?.vesselId).toBeNull();
});
