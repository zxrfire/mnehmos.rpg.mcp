/** An actual private driver holds or changes the same admitted road, without another fare. */
import type {GameService} from './turn-engine.js';
import type {Cultivator} from '../schema/cultivation.js';
import {ownedPassageClaim,ownedCarrierAt} from './an-owned-passage.js';
import {routineTime} from '../engine/world/npc-routines.js';
import {witnessIndexFor} from '../engine/world/witness-reaction-index.js';
import {isTheWorldsToMove} from '../engine/world/npc-state.js';
import {roadPositionOfNpc,journeyNeedsWater} from '../engine/world/places-on-the-way.js';
import {roadContinuationTo} from '../engine/world/road-course.js';
import {groundWhereACarriageStopped} from '../engine/world/where-a-carriage-stopped.js';
import {admittedRoadWalkingPace} from '../engine/world/the-pace-an-admitted-road-keeps.js';
import {requireConveyance} from '../data/cultivation/what-a-house-moves-its-people-on.js';
import {daysByConveyance} from '../engine/world/what-a-conveyance-does-to-a-journey.js';
import {appendWorldFact} from '../engine/world/who-was-there-when-it-happened.js';
import {makeFact} from '../engine/world/history.js';
import {writeFlag} from '../server/consolidated/cultivation-support.js';

export function quoteOwnedRoadCourseChange(game:GameService,body:Cultivator,targetId:string,
 known?:(place:import('../engine/world/locations.js').LocationRecord)=>boolean){
 const world=game.atHand,claim=ownedPassageClaim(game.db,body.id),day=world&&routineTime(world);
 if(!world||!claim||day==null)return null;
 const fact=witnessIndexFor(world).byId.get(claim.receiptId),d=fact?.data;
 if(!fact||!d||d.airCourse===true||d.seaCourse===true||typeof d.pilotId!=='string'||typeof d.vesselId!=='string'
  ||typeof d.conveyanceId!=='string'||typeof d.walkingDays!=='number'||typeof d.departureDay!=='number'
  ||typeof d.arrivalDay!=='number'||day>=d.arrivalDay)return null;
 const driver=world.npcs.find(person=>person.id===d.pilotId&&person.status==='alive'&&isTheWorldsToMove(person));
 const target=world.locations.find(place=>place.id===targetId);
 if(!target||!(known?known(target):game.canPointAtLocation(body,target)))return null;
 const source=ownedCarrierAt(world,fact.id,body,day),craft=requireConveyance(d.conveyanceId);
 if(!driver||!source?.locationId||source.unavailable||craft.crossesGroundThatCannotBeWalked)return null;
 const point=roadPositionOfNpc(world.locations,driver,day),course=point&&roadContinuationTo(world.locations,point,targetId);
 const pace=admittedRoadWalkingPace({walkingDays:d.walkingDays,departureDay:d.departureDay,arrivalDay:d.arrivalDay},
  {departureDay:d.departureDay,arrivalDay:d.arrivalDay,admittedRoad:driver.activity?.admittedRoad},day);
 if(!point||!course||pace===null||journeyNeedsWater(world.locations,course.endpointId,targetId))return null;
 const power=typeof d.conveyancePower==='number'?d.conveyancePower:null;
 const initial=course.partialDays*pace,days=initial+daysByConveyance(course.route.at(-1)?.days??0,craft,power,true);
 return days>0?{fact,driver,source,point,course,initial,days,day}:null;
}

export function changeOwnedRoadCourse(game:GameService,body:Cultivator,targetId:string,operatorId:string,
 departureDay?:number,heldForStatusId:string|null=null,known?:(place:import('../engine/world/locations.js').LocationRecord)=>boolean){
 const read=quoteOwnedRoadCourseChange(game,body,targetId,known),world=game.atHand;
 if(!read||!world||read.driver.id!==operatorId)return null;
 const departure=departureDay??read.day;if(departure<read.day)return null;
 const d=read.fact.data,people=world.npcs.filter(person=>isTheWorldsToMove(person)&&person.status==='alive'
  &&person.activity?.vesselId===d.vesselId&&person.activity.sinceDay===d.departureDay&&person.activity.untilDay===d.arrivalDay);
 const at=groundWhereACarriageStopped(world,d.vesselId as string,d.departureDay as number,read.day,read.point,read.source.locationId!);
 const receipt=appendWorldFact(world,makeFact({day:read.day,kind:'gathering',locationId:at,visibility:'secret',
  summary:'The actual private driver changed the admitted road course.',actors:read.fact.actors,causes:[read.fact.id],
  data:{...d,changedOwnedCourse:true,fromLocationId:at,toLocationId:targetId,departureDay:departure,
   arrivalDay:departure+read.days,walkingDays:read.course.days,heldOwnedForStatusId:heldForStatusId,
   runId:game.currentRun().run.id,boardingRunElapsedDays:game.currentRun().run.elapsedDays+departure-read.day}}),{recur:false,bystanders:false});
 for(const person of people){const index=world.npcs.findIndex(one=>one.id===person.id),fresh=world.npcs[index];
  const doing={...fresh.activity!,fromLocationId:at,returnTo:targetId,sinceDay:departure,untilDay:departure+read.days};
  if(person.id===operatorId)doing.admittedRoad={position:read.course.position,route:read.course.route,initialTravelDays:read.initial};
  else{delete doing.admittedRoad;doing.carrierOperatorId=operatorId;}
  world.npcs[index]={...fresh,locationId:at,activity:doing};
 }
 writeFlag(game.db,body.id,'owned_passage',JSON.stringify({receiptId:receipt.id}));game.theWorldMoved();return receipt;
}
