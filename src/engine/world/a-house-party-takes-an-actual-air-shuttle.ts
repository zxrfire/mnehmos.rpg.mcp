/** An owned shuttle has one existing sending intent and real native accepted
 * loads. Waiting and delivered people are read from current actors and actual
 * receipts; no future course or second passenger/attendance ledger is kept. */
import type {WorldState,FactionRecord} from './world-state.js';
import type {NpcRecord,NpcActivity} from './npc-state.js';
import type {ObjectRecord} from './possessions.js';
import {isRuined} from './possessions.js';
import {isWithThem,whereItStands,itWantsAPilot,A_SPIRIT_BOAT_ANSWERS_TO} from './a-vehicle.js';
import {quoteHouseAirDuty,theHouseLendsAnActualDutyCraft} from './a-house-party-takes-an-actual-air-leg.js';
import {beginAnAirCourse,readAnAirCourseAdmission,recordPaidAirCourseFuel,settleWorldAirTravellers} from './an-air-course-in-the-world.js';
import {theExteriorGroundsOfAnNpcAirDeparture} from './an-actual-npc-air-course.js';
import {getConveyance} from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import {quoteAnAirJourney} from './what-an-air-journey-takes.js';
import {witnessIndexFor} from './witness-reaction-index.js';
import {appendWorldFact} from './who-was-there-when-it-happened.js';
import {makeFact,type HistoricalFact} from './history.js';
import {journeyTimeHasReached} from './places-on-the-way.js';
import {aPostingForItsActualLegs} from './who-goes-out-for-a-house-and-what-comes-back.js';
import {isLostTrackOf} from './who-a-house-has-lost-track-of.js';
import {whatThisHouseCouldTakeOut} from './what-a-house-can-take-out.js';
import type {APortfolio} from '../social-leverage/what-an-elder-is-in-charge-of.js';
import type {OnTheRoll} from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import { departureSceneFor, beginActualDepartureApproach, finishActualDepartureApproach } from './departure-approach.js';
import { departureAreaAt } from './where-in-a-place-somebody-is-standing.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { routeQueriesFor, walkingDaysFrom } from './locations.js';
import { sendASelectedHousePartyOnAnAvailableAirHull } from './a-house-party-takes-an-actual-air-leg.js';
type Sending=NonNullable<WorldState['pendingSendings']>[number];
type Phase='delivery'|'collecting'|'homebound'|'reloading';
/** Selection reserves no fuel or custody. Each body walks before actual admission. */
export function beginHouseSendingAssembly(state:WorldState,house:FactionRecord,row:Sending,day:number){
 if(!house.seatLocationId||!row.locationId||!journeyTimeHasReached(state.currentDay,day)
  ||!journeyTimeHasReached(day,state.currentDay))return null;
 const ground=state.locations.find(place=>place.id===house.seatLocationId);
 if(!ground)return null;
 const routes=routeQueriesFor(state.locations);
 const berth=departureAreaAt(state,ground,'spirit_berth',routes);
 if(!berth)return null;
 const intention=makeFact({day,kind:'gathering',locationId:ground.id,visibility:'faction',
  factionIds:[house.id],actors:row.party.map(person=>({id:person.id,name:person.name,role:'delegate'})),
  summary:'House members were called to the Spirit Boat Berth.',data:{houseAssembly:true}});
 const request={intentId:'assembly',target:{locationId:ground.id,areaId:berth.id}};
 const scene=departureSceneFor(state,routes);
 const read=row.party.map(member=>beginActualDepartureApproach(state,member.id,request,day,undefined,routes,scene));
 if(read.some(result=>result.kind==='refused'||result.kind==='needs_geographic_leg'))return null;
 const intent=appendWorldFact(state,intention,{recur:false,bystanders:false});
 for(const result of read){if(result.kind==='approaching'){
   const at=state.npcs.findIndex(person=>person.id===result.actor.id);state.npcs[at]={...state.npcs[at]!,activity:{...result.actor.activity!,capitalMissionId:intent.id},updatedOnDay:day};
  }else if(result.kind==='ready'){
   const at=state.npcs.findIndex(person=>person.id===result.actor.id);state.npcs[at]={...state.npcs[at]!,
    activity:{kind:'out_with_a_party',note:'At the Spirit Boat Berth.',withIds:[],standingIn:berth.id,
     sinceDay:day,untilDay:day,capitalMissionId:intent.id}};
  }}
 return {...row,dispatchFactId:intent.id};
}
function continueAssembly(state:WorldState,row:Sending,day:number){
 const house=state.factions.find(h=>h.id===row.posting.houseId&&h.dissolvedOnDay===null);
 const ground=state.locations.find(place=>place.id===house?.seatLocationId);
 if(!house||!ground||!row.locationId)return;
 const routes=routeQueriesFor(state.locations);
 const berth=departureAreaAt(state,ground,'spirit_berth',routes);if(!berth)return;
 const request={intentId:row.dispatchFactId!,target:{locationId:ground.id,areaId:berth.id}};
 const scene=departureSceneFor(state,routes);
 const results=row.party.map(member=>finishActualDepartureApproach(state,member.id,request,day,routes,scene));
 if(results.some(result=>result.kind!=='ready'))return;
 for(const result of results)if(result.kind==='ready'){
  const at=state.npcs.findIndex(person=>person.id===result.actor.id);state.npcs[at]=result.actor;
 }
 const people=row.party.map(member=>state.npcs.find(person=>person.id===member.id)!);
 const roll=state.npcs.filter(n=>n.status==='alive'&&n.factionId===house.id)
  .map(n=>({id:n.id,rankIndex:n.factionRankIndex}));
 const portfolios=portfoliosIn({locations:state.locations,sectId:house.id,roll,rankCount:house.ranks.length});
 const selected={...row,departsOnDay:day};
 const walking=walkingDaysFrom(state.locations,ground.id).get(row.locationId);
 if(walking===undefined)return;
 const admitted=sendASelectedHousePartyOnAnAvailableAirHull(state,house,people,row.locationId,day,
  walking,false,Number(house.resources.spirit_stones??0),read=>new Map(people.map(person=>[person.id,{
   kind:'out_with_a_party' as const,note:'On house business.',withIds:[],standingIn:berth.id,
   sinceDay:day,untilDay:day+aPostingForItsActualLegs(row.posting,read.quote.daysForEverybody,read.back.daysForEverybody).days,
   returnTo:ground.id,fromLocationId:ground.id
  }])),portfolios,roll,selected);
 if(!admitted){
  // An unaccepted hull request ends the assembly, without a voyage or service.
  appendWorldFact(state,makeFact({day,kind:'gathering',locationId:ground.id,visibility:'faction',
   factionIds:[house.id],actors:people.map(person=>({id:person.id,name:person.name,role:'delegate'})),
   causes:[row.dispatchFactId!],summary:'The house sending did not board an air hull.',
   data:{houseAssemblyCancelled:row.dispatchFactId!}}),{recur:false,bystanders:false});
  for(const person of people){const at=state.npcs.findIndex(n=>n.id===person.id),current=state.npcs[at];
   if(current?.activity?.capitalMissionId===row.dispatchFactId)
    state.npcs[at]={...current,activity:null,updatedOnDay:day};
  }
  return;
 }
 row.departsOnDay=day;row.posting={...aPostingForItsActualLegs(row.posting,admitted.read.quote.daysForEverybody,
  admitted.read.back.daysForEverybody),stonesBurned:admitted.fuel};row.dispatchFactId=admitted.dispatchFactId;
}
function stopped(state:WorldState,receipt:HistoricalFact){return [...(witnessIndexFor(state).references.get(receipt.id)??[])]
 .some(fact=>fact.data.airCourseStopped===receipt.id);}
function receipts(state:WorldState,row:Sending){return row.dispatchFactId?
 [...(witnessIndexFor(state).references.get(row.dispatchFactId)??[])].filter(fact=>
  fact.data.airCourse===true&&fact.data.houseDutyDispatchId===row.dispatchFactId):[];}
function latestDelivery(state:WorldState,row:Sending,id:string){return receipts(state,row).filter(fact=>
 fact.data.houseDutyPhase==='delivery'&&fact.data.toLocationId===row.locationId&&fact.actors.some(actor=>actor.id===id))
 .sort((a,b)=>Number(b.data.departureDay)-Number(a.data.departureDay))[0];}
function bound(npc:NpcRecord,row:Sending){return npc.status==='alive'&&npc.activity?.kind==='out_with_a_party'&&npc.activity.capitalMissionId===row.dispatchFactId;}
function funding(state:WorldState,row:Sending){const fact=row.dispatchFactId?witnessIndexFor(state).byId.get(row.dispatchFactId):undefined;
 if(!fact||fact.data.houseAirShuttle!==true||typeof fact.data.originId!=='string'||typeof fact.data.pilotId!=='string'
  ||typeof fact.data.vesselId!=='string'||typeof fact.data.fuelCommitted!=='number')return null;
 return {fact,origin:fact.data.originId,pilotId:fact.data.pilotId,vesselId:fact.data.vesselId,fuel:fact.data.fuelCommitted};}
function spent(state:WorldState,row:Sending){const index=witnessIndexFor(state);return receipts(state,row).reduce((total,receipt)=>
 total+[...(index.references.get(receipt.id)??[])].reduce((sum,fact)=>sum+(fact.data.airFuelPaidFor===receipt.id
  &&typeof fact.data.stonesDebited==='number'?fact.data.stonesDebited:0),0),0);}
function currentPilot(state:WorldState,row:Sending){const read=funding(state,row);if(!read)return null;
 const house=state.factions.find(h=>h.id===row.posting.houseId&&h.dissolvedOnDay===null),pilot=state.npcs.find(n=>n.id===read.pilotId);
 const hull=state.objects.find(o=>o.id===read.vesselId&&!isRuined(o)),craft=hull?getConveyance(String(hull.data.conveyanceId??'')):null;
 if(!house||!pilot||!bound(pilot,row)||isLostTrackOf(state,pilot)||!hull||!craft||hull.ownerId!==house.id
  ||hull.possessorId!==pilot.id||!isWithThem(hull,pilot.id,pilot.locationId)
  ||itWantsAPilot(craft)&&pilot.cultivation.realmOrdinal<A_SPIRIT_BOAT_ANSWERS_TO)return null;
 return {...read,house,pilot,hull,craft};}
function latestLeg(state:WorldState,row:Sending){return receipts(state,row).sort((a,b)=>Number(b.data.departureDay)-Number(a.data.departureDay))[0];}
/** The first genuine homeward departure closes service. Later collecting legs
 * cannot pretend the pilot was continuously at the post. */
export function actualShuttleService(state:WorldState,npc:NpcRecord,row:Sending){
 if(!bound(npc,row)||isLostTrackOf(state,npc))return null;
 const delivery=latestDelivery(state,row,npc.id),arrival=delivery?.data.arrivalDay;
 if(!delivery||typeof arrival!=='number'||stopped(state,delivery))return null;
 const homeward=receipts(state,row).filter(fact=>fact.data.houseDutyPhase==='homebound'
  &&fact.actors.some(actor=>actor.id===npc.id)&&fact.causes.includes(delivery.id))
  .sort((a,b)=>Number(a.data.departureDay)-Number(b.data.departureDay))[0];
 const until=homeward?Number(homeward.data.departureDay):state.currentDay;
 const atSite=homeward!==undefined||npc.locationId===row.locationId&&!npc.activity?.airCourseLocationId;
 if(!atSite||!journeyTimeHasReached(until,arrival))return null;
 return {delivery,fromDay:arrival,untilDay:until};
}
export function aShuttleMemberActuallyServed(state:WorldState,npc:NpcRecord,row:Sending){const site=actualShuttleService(state,npc,row);
 return !!site&&site.untilDay>site.fromDay&&(row.posting.reason.termBasis!=='on_site'
  ||journeyTimeHasReached(site.untilDay,site.fromDay+row.posting.reason.days));}
export function actualShuttleReturnDay(state:WorldState,npc:NpcRecord,row:Sending){const read=funding(state,row);
 if(!read||!bound(npc,row)||npc.locationId!==read.origin||npc.activity?.airCourseLocationId)return null;
 const back=receipts(state,row).filter(fact=>fact.data.houseDutyPhase==='homebound'&&fact.actors.some(a=>a.id===npc.id))
  .sort((a,b)=>Number(b.data.departureDay)-Number(a.data.departureDay))[0];
 return back&&typeof back.data.arrivalDay==='number'&&!stopped(state,back)
  &&journeyTimeHasReached(state.currentDay,back.data.arrivalDay)?back.data.arrivalDay:null;
}
function admitLoad(state:WorldState,row:Sending,pilot:NpcRecord,hull:ObjectRecord,people:readonly NpcRecord[],to:string,
 day:number,phase:Phase,priorOutwards:readonly HistoricalFact[]=[]){
 const read=funding(state,row),craft=getConveyance(String(hull.data.conveyanceId??''));
 if(!read||!craft||!pilot.locationId||hull.possessorId!==pilot.id||hull.ownerId!==row.posting.houseId
  ||!isWithThem(hull,pilot.id,pilot.locationId)||isRuined(hull)||!people.some(n=>n.id===pilot.id))return null;
 const routes=routeQueriesFor(state.locations),scene=departureSceneFor(state,routes);
 if(people.some(person=>state.npcs.find(n=>n.id===person.id)!==person||!bound(person,row)
   ||theExteriorGroundsOfAnNpcAirDeparture(state,person,to,day,undefined,routes,scene)?.from.id!==pilot.locationId))return null;
 const quote=quoteAnAirJourney(state.locations,pilot.locationId,to,craft,hull.power,people.length,
  {facts:witnessIndexFor(state).byId,onDay:day},1);
 if(!quote||quote.trips!==1||quote.stonesBurned>read.fuel-spent(state,row))return null;
 const accepted=beginAnAirCourse(state,{bodyId:pilot.id,bodyName:pilot.name,fromId:pilot.locationId,toId:to,
  conveyanceId:craft.id,power:hull.power,vesselId:hull.id,artId:null,onDay:day,heads:people.length,
  owned:{ownerId:row.posting.houseId,pilotId:pilot.id},actualLoad:people,houseDutyDispatchId:row.dispatchFactId,
  ...(phase==='homebound'&&row.party.every(member=>{const n=state.npcs.find(body=>body.id===member.id);
    return !n||n.status!=='alive'||people.some(person=>person.id===n.id)||n.locationId===read.origin;})
    ?{houseDutyReturnOf:priorOutwards.find(fact=>fact.actors.some(actor=>actor.id===pilot.id))?.id}:{}),
  houseDutyPhase:phase,dutyCauses:priorOutwards.map(fact=>fact.id)});
 if(!accepted)return null;
 placeAcceptedLoad(state,row,pilot,hull,people,day,accepted,quote.stonesBurned,read.origin);
 return {accepted,fuel:quote.stonesBurned};
}
function placeAcceptedLoad(state:WorldState,row:Sending,pilot:NpcRecord,hull:ObjectRecord,people:readonly NpcRecord[],
 day:number,accepted:NonNullable<ReturnType<typeof beginAnAirCourse>>,fuel:number,origin:string){
 recordPaidAirCourseFuel(state,accepted.fact.id,row.posting.houseId,Number(accepted.fact.data.arrivalDay),fuel,day);
 const objectAt=state.objects.findIndex(o=>o.id===hull.id);
 state.objects[objectAt]={...hull,locationId:accepted.location.id,data:{...hull.data,withId:pilot.id}};
 for(const person of people){const at=state.npcs.findIndex(n=>n.id===person.id);
  const actual=state.npcs[at]!;
  state.npcs[at]={...actual,locationId:accepted.location.id,activity:{...actual.activity!,kind:'out_with_a_party',
   capitalMissionId:row.dispatchFactId,withIds:people.filter(n=>n.id!==person.id).map(n=>n.id),
   sinceDay:day,untilDay:row.departsOnDay+row.posting.days,fromLocationId:pilot.locationId,returnTo:origin,
   vesselId:hull.id,airCourseLocationId:accepted.location.id,airDutyReceiptId:accepted.fact.id},updatedOnDay:day};}
}
/** All quote/custody/funding gates precede the one real commitment. Only the
 * first load is admitted; the remainder stay physically at their departure. */
export function beginAnActualHouseAirShuttle(state:WorldState,house:FactionRecord,people:readonly NpcRecord[],
 pilot:NpcRecord,hull:ObjectRecord,row:Sending,day:number,activities:ReadonlyMap<string,NpcActivity|null>,
 portfolios:readonly APortfolio[],roll:readonly OnTheRoll[],batch?:Parameters<typeof quoteHouseAirDuty>[8]){
 if(!journeyTimeHasReached(day,state.currentDay)||!journeyTimeHasReached(state.currentDay,day))return null;
 if(!whatThisHouseCouldTakeOut(state,house).some(row=>row.rowId===hull.id))return null;
 const read=quoteHouseAirDuty(state,house,people,pilot,hull,row.locationId??'',day,false,batch);
 if(!read||read.quote.trips<=1||!read.quote.pilotedLoads||!read.back.pilotedLoads
  ||whereItStands(hull)!==read.from||people.some(n=>state.npcs.find(p=>p.id===n.id)!==n||!activities.get(n.id)))return null;
 const fuel=read.quote.stonesBurned+read.back.stonesBurned,purse=Number(house.resources.spirit_stones??0);
 if(fuel>purse)return null;
 const loan=theHouseLendsAnActualDutyCraft(state,house,pilot,hull,portfolios,roll,day);if(!loan?.object)return null;
 const posting=aPostingForItsActualLegs(row.posting,read.quote.daysForEverybody,read.back.daysForEverybody);
 const first=[pilot,...people.filter(n=>n.id!==pilot.id).slice(0,read.quote.pilotedLoads[0]!.heads-1)];
 const admission={bodyId:pilot.id,bodyName:pilot.name,fromId:read.from,toId:row.locationId!,
  conveyanceId:read.conveyance.id,power:hull.power,vesselId:hull.id,artId:null,onDay:day,heads:first.length,
  owned:{ownerId:house.id,pilotId:pilot.id},actualLoad:first,houseDutyPhase:'delivery' as const};
 if(!readAnAirCourseAdmission(state,admission))return null;
 const dispatch=appendWorldFact(state,makeFact({day,causes:row.dispatchFactId?[row.dispatchFactId]:[],kind:'gathering',visibility:'faction',locationId:read.from,
  factionIds:[house.id],actors:people.map(n=>({id:n.id,name:n.name,role:'delegate'})),
  summary:'An actual house party approved a real hull to carry its selected people.',
  data:{houseAirShuttle:true,originId:read.from,pilotId:pilot.id,vesselId:hull.id,fuelCommitted:fuel}}),{recur:false,bystanders:false});
 const actualRow={...row,posting,dispatchFactId:dispatch.id};
 const accepted=beginAnAirCourse(state,{...admission,houseDutyDispatchId:dispatch.id});
 if(!accepted)return null; // No purse, custody or activity was changed on refusal.
 house.resources.spirit_stones=purse-fuel;
 for(const person of people){const at=state.npcs.findIndex(n=>n.id===person.id),activity=activities.get(person.id)!;
  const actual=state.npcs[at]!;
  state.npcs[at]={...actual,activity:{...activity,capitalMissionId:dispatch.id,airDutyReceiptId:undefined,
   untilDay:day+posting.days},updatedOnDay:day};}
 const actualPeople=first.map(n=>state.npcs.find(person=>person.id===n.id)!);
 placeAcceptedLoad(state,actualRow,actualPeople[0]!,loan.object,actualPeople,day,accepted,
  accepted.quote.stonesBurned,read.from);
 const admitted={accepted,fuel:accepted.quote.stonesBurned};
 return {...admitted,fuel,read,row:actualRow};
}
/** One due boundary is derived from the accepted current leg, or from the
 * pilot's final actual delivery plus the authored site service. */
export function nextActualHouseShuttleBoundary(state:WorldState,row:Sending):number|null{
 if(row.dispatchFactId&&witnessIndexFor(state).byId.get(row.dispatchFactId)?.data.houseAssembly===true){
  const people=row.party.map(member=>state.npcs.find(n=>n.id===member.id));
  if(people.some(n=>!n||n.status!=='alive'||n.activity?.capitalMissionId!==row.dispatchFactId))return null;
  const due=people.map(n=>n!.activity?.untilDay).filter((day):day is number=>day!=null);
  return due.length?Math.max(...due):null;
 }
 const read=currentPilot(state,row),leg=latestLeg(state,row);if(!read||!leg||stopped(state,leg))return null;
 const arrival=leg.data.arrivalDay;if(typeof arrival!=='number')return null;
 if(!journeyTimeHasReached(state.currentDay,arrival))return arrival;
 const allDelivered=row.party.filter(member=>state.npcs.find(n=>n.id===member.id)?.status==='alive')
  .every(member=>latestDelivery(state,row,member.id)!==undefined);
 if(allDelivered&&leg.data.houseDutyPhase==='delivery'){
  if(row.posting.reason.termBasis==='on_site')return arrival+row.posting.reason.days;
  const back=readQuoteBack(state,row,read);return back?row.departsOnDay+row.posting.days-back.daysForEverybody:null;
 }
 return arrival;
}
function readQuoteBack(state:WorldState,row:Sending,read:NonNullable<ReturnType<typeof currentPilot>>){return row.locationId?
 quoteAnAirJourney(state.locations,row.locationId,read.origin,read.craft,read.hull.power,row.party.length,
  {facts:witnessIndexFor(state).byId,onDay:state.currentDay},1):null;}
/** Continue only from an actual reached receipt, never from a nominal deadline. */
export function continueActualHouseAirShuttle(state:WorldState,row:Sending,day:number):boolean{
 if(!row.dispatchFactId)return false;
 // Annual reports cannot create a genuinely accepted load in their past.
 if(!journeyTimeHasReached(day,state.currentDay)||!journeyTimeHasReached(state.currentDay,day))return true;
 if(witnessIndexFor(state).byId.get(row.dispatchFactId)?.data.houseAssembly===true){continueAssembly(state,row,day);return true;}
 const read=currentPilot(state,row),leg=latestLeg(state,row);if(!read||!leg||stopped(state,leg))return true;
 const arrival=leg.data.arrivalDay;if(typeof arrival!=='number'||!journeyTimeHasReached(day,arrival))return true;
 settleWorldAirTravellers(state,day);
 const actual=currentPilot(state,row);if(!actual||actual.pilot.activity?.airCourseLocationId)return true;
 const original=row.party.map(member=>state.npcs.find(n=>n.id===member.id));
 if(original.some(n=>!n||n.status==='alive'&&(!bound(n,row)||isLostTrackOf(state,n))))return true;
 const alive=original.filter((n):n is NpcRecord=>!!n&&n.status==='alive');
 const waiting=alive.filter(n=>n.id!==actual.pilot.id&&n.locationId===actual.origin&&!latestDelivery(state,row,n.id));
 const allDelivered=alive.every(n=>latestDelivery(state,row,n.id)!==undefined);
 const pilot=actual.pilot,hull=actual.hull;
 if(!allDelivered){
  if(pilot.locationId===row.locationId){admitLoad(state,row,pilot,hull,[pilot],actual.origin,day,'reloading');return true;}
  if(pilot.locationId===actual.origin&&waiting.length){const quote=quoteAnAirJourney(state.locations,actual.origin,row.locationId!,
    actual.craft,hull.power,waiting.length+1,{facts:witnessIndexFor(state).byId,onDay:day},1);
   if(!quote)return true;
   const heads=quote.pilotedLoads?.[0]?.heads??waiting.length+1;
   admitLoad(state,row,pilot,hull,[pilot,...waiting.slice(0,heads-1)],row.locationId!,day,'delivery');return true;}
  return true;
 }
 if(pilot.locationId===row.locationId){
  const here=alive.filter(n=>n.locationId===row.locationId&&!n.activity?.airCourseLocationId);
  if(here.some(n=>!aShuttleMemberActuallyServed(state,n,row)))return true;
  const first=nextActualHouseShuttleBoundary(state,row);if(first==null||!journeyTimeHasReached(day,first))return true;
  const quote=quoteAnAirJourney(state.locations,row.locationId!,actual.origin,actual.craft,hull.power,here.length,
    {facts:witnessIndexFor(state).byId,onDay:day},1);
  if(!quote)return true;
  const heads=quote.pilotedLoads?.[0]?.heads??here.length;
  const load=[pilot,...here.filter(n=>n.id!==pilot.id).slice(0,heads-1)];
  const outwards=load.map(n=>latestDelivery(state,row,n.id)).filter((fact):fact is HistoricalFact=>!!fact);
  admitLoad(state,row,pilot,hull,load,actual.origin,day,'homebound',outwards);return true;
 }
 if(pilot.locationId===actual.origin&&alive.some(n=>n.locationId===row.locationId))
  admitLoad(state,row,pilot,hull,[pilot],row.locationId!,day,'collecting');
 return true;
}
