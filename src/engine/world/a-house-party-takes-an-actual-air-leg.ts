/** A native house dispatch lends the actual tracked hull through the ordinary
 * store authority. Work selection never supplies custody permission. The accepted
 * leg receipt holds its actual arrival and pre-paid return commitment; activities
 * keep their service terms and reference that receipt, not a copied arrival. */
import type {WorldState,FactionRecord} from './world-state.js';
import type {NpcRecord,NpcActivity} from './npc-state.js';
import type {ObjectRecord} from './possessions.js';
import {transferPossession,isRuined} from './possessions.js';
import {whereInTheHouseItSits} from './what-a-house-keeps-in-its-treasury.js';
import {whetherItLeavesTheStore} from '../social-leverage/who-has-to-agree-before-it-leaves-the-store.js';
import type {APortfolio} from '../social-leverage/what-an-elder-is-in-charge-of.js';
import type {OnTheRoll} from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import {getConveyance} from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import {itWantsAPilot,A_SPIRIT_BOAT_ANSWERS_TO,isWithThem,whereItStands} from './a-vehicle.js';
import {beginAnAirCourse,recordPaidAirCourseFuel} from './an-air-course-in-the-world.js';
import {quoteAnAirJourney} from './what-an-air-journey-takes.js';
import {theExteriorGroundsOfAnNpcAirDeparture} from './an-actual-npc-air-course.js';
import {witnessIndexFor} from './witness-reaction-index.js';
import {whatThisHouseCouldTakeOut} from './what-a-house-can-take-out.js';
import {bestForThisRoad} from './what-a-conveyance-does-to-a-journey.js';
import {beginAnActualHouseAirShuttle} from './a-house-party-takes-an-actual-air-shuttle.js';

export function theHouseLendsAnActualDutyCraft(state:WorldState,house:FactionRecord,pilot:NpcRecord,
 craft:ObjectRecord,portfolios:readonly APortfolio[],roll:readonly OnTheRoll[],day:number){
 const conveyance=getConveyance(String(craft.data.conveyanceId??''));
 if(!conveyance || !conveyance.crossesGroundThatCannotBeWalked || isRuined(craft)
  || craft.ownerId!==house.id || pilot.factionId!==house.id || pilot.status!=='alive'
  || itWantsAPilot(conveyance)&&pilot.cultivation.realmOrdinal<A_SPIRIT_BOAT_ANSWERS_TO)return null;
 const said=whetherItLeavesTheStore({significance:craft.significance,meaning:'use_it_and_return_it',
  room:whereInTheHouseItSits(craft.kind,craft.significance,craft.tags),portfolios,roll,
  rankCount:house.ranks.length,askerId:pilot.id,ledger:state.obligations,asOfDay:day});
 return {said,object:said.allowed?transferPossession(craft,{onDay:day,toHolderId:pilot.id,
  toHolderName:pilot.name,how:'lent',source:house.name+' lent a duty craft',
  note:'The ordinary store authority agreed to use and return this actual hull.'}):null};
}
/** Pure quote of the actual selected group; multiple trips need an actual shuttle itinerary. */
export function quoteHouseAirDuty(state:WorldState,house:FactionRecord,people:readonly NpcRecord[],
 pilot:NpcRecord,craft:ObjectRecord,toId:string,day:number,singleLoad=true){
 const from=pilot.locationId,conveyance=getConveyance(String(craft.data.conveyanceId??''));
 if(!from||!conveyance?.crossesGroundThatCannotBeWalked || isRuined(craft)
  || house.dissolvedOnDay!==null || !people.some(person=>person.id===pilot.id)
  || new Set(people.map(person=>person.id)).size!==people.length
  || people.some(person=>person.status!=='alive'||person.factionId!==house.id
   ||theExteriorGroundsOfAnNpcAirDeparture(state,person,toId,day)?.from.id!==from)
  || itWantsAPilot(conveyance)&&pilot.cultivation.realmOrdinal<A_SPIRIT_BOAT_ANSWERS_TO)return null;
 const quote=quoteAnAirJourney(state.locations,from,toId,conveyance,craft.power,people.length,
  {facts:witnessIndexFor(state).byId,onDay:day},1);
 const back=quoteAnAirJourney(state.locations,toId,house.seatLocationId??from,conveyance,craft.power,people.length,
  {facts:witnessIndexFor(state).byId,onDay:day},1);
 if(!quote||!back||singleLoad&&(quote.trips!==1||back.trips!==1))return null;
 return {quote,back,from,conveyance};
}
/** Caller has already debited these exact native two-leg fuel quotes once. */
export function admitPaidHouseAirDuty(state:WorldState,house:FactionRecord,people:readonly NpcRecord[],
 pilot:NpcRecord,loan:ObjectRecord,toId:string,day:number,activities:ReadonlyMap<string,NpcActivity|null>){
 const read=quoteHouseAirDuty(state,house,people,pilot,loan,toId,day);
 if(!read||loan.possessorId!==pilot.id||!isWithThem(loan,pilot.id,read.from)
  ||people.some(person=>activities.get(person.id)==null))return null;
 const accepted=beginAnAirCourse(state,{bodyId:pilot.id,bodyName:pilot.name,fromId:read.from,toId,
  conveyanceId:read.conveyance.id,power:loan.power,vesselId:loan.id,artId:null,onDay:day,heads:people.length,
  owned:{ownerId:house.id,pilotId:pilot.id},houseDutyFunding:{houseId:house.id,returnStones:read.back.stonesBurned}});
 if(!accepted)return null;
 const objectAt=state.objects.findIndex(row=>row.id===loan.id);
 if(objectAt<0)throw Error('Approved real duty hull disappeared before its native acceptance');
 state.objects[objectAt]={...loan,locationId:accepted.location.id,data:{...loan.data,withId:pilot.id}};
 recordPaidAirCourseFuel(state,accepted.fact.id,house.id,day+read.quote.daysOneWay,read.quote.stonesBurned,day);
 for(const person of people){const at=state.npcs.findIndex(row=>row.id===person.id);
  if(at<0)throw Error('Selected actual duty body disappeared before native acceptance');
  const activity=activities.get(person.id);
  if(!activity)throw Error('Validated real duty activity disappeared before native acceptance');
  state.npcs[at]={...person,locationId:accepted.location.id,activity:{...activity,
   vesselId:loan.id,airCourseLocationId:accepted.location.id,airDutyReceiptId:accepted.fact.id},updatedOnDay:day};}
 return accepted;
}
/** A return uses only its already paid commitment and the still-held original hull. */
export function admitPaidHouseAirReturn(state:WorldState,npc:NpcRecord,day:number,activity:NpcActivity,returningPeers:readonly NpcRecord[]=[]){
 const oldId=npc.activity?.airDutyReceiptId,old=oldId?witnessIndexFor(state).byId.get(oldId):undefined;
 const data=old?.data;
 if(!oldId||!data||typeof data.houseDutyHouseId!=='string'||typeof data.houseDutyReturnStones!=='number'
  ||typeof data.vesselId!=='string'||typeof data.pilotId!=='string'||typeof data.fromLocationId!=='string'
  ||data.pilotId!==npc.id||npc.status!=='alive'||!npc.locationId)return null;
 if([...witnessIndexFor(state).byId.values()].some(fact=>fact.data.houseDutyReturnOf===oldId))return null;
 const house=state.factions.find(row=>row.id===data.houseDutyHouseId&&row.dissolvedOnDay===null);
 const craft=state.objects.find(row=>row.id===data.vesselId&&!isRuined(row)&&row.possessorId===npc.id);
 if(!house||!craft||craft.ownerId!==house.id||!isWithThem(craft,npc.id,npc.locationId))return null;
 const conveyance=getConveyance(String(craft.data.conveyanceId??''));
 if(!conveyance)return null;
 const people=[npc,...returningPeers];
 if(new Set(people.map(person=>person.id)).size!==people.length
  ||people.some(person=>person.status!=='alive'||person.factionId!==house.id
   ||person.locationId!==npc.locationId||person.activity?.airDutyReceiptId!==oldId))return null;
 const quote=quoteAnAirJourney(state.locations,npc.locationId,data.fromLocationId,conveyance,craft.power,people.length,
  {facts:witnessIndexFor(state).byId,onDay:day},1);
 if(!quote||quote.trips!==1||quote.stonesBurned>data.houseDutyReturnStones)return null;
 const accepted=beginAnAirCourse(state,{bodyId:npc.id,bodyName:npc.name,fromId:npc.locationId,
  toId:data.fromLocationId,conveyanceId:conveyance.id,power:craft.power,vesselId:craft.id,artId:null,
  onDay:day,heads:people.length,owned:{ownerId:house.id,pilotId:npc.id},houseDutyReturnOf:oldId});
 if(!accepted)return null;
 recordPaidAirCourseFuel(state,accepted.fact.id,house.id,day+quote.daysOneWay,quote.stonesBurned,day);
 const objectAt=state.objects.findIndex(row=>row.id===craft.id);
 state.objects[objectAt]={...craft,locationId:accepted.location.id};
 for(const person of people){const at=state.npcs.findIndex(row=>row.id===person.id);
  if(at<0)throw Error('Validated returning duty body disappeared');
  state.npcs[at]={...person,locationId:accepted.location.id,activity:{...activity,
   withIds:people.filter(peer=>peer.id!==person.id).map(peer=>peer.id),untilDay:day+quote.daysOneWay,
   vesselId:craft.id,airCourseLocationId:accepted.location.id,airDutyReceiptId:oldId},updatedOnDay:day};
 }
 return accepted;
}

/** A current selected sending obtains its real loan and two exact leg quotes
 * before fuel or custody changes. A multi-load quote is not an admitted itinerary. */
export function sendAnActualSelectedHouseParty(state:WorldState,house:FactionRecord,
 people:readonly NpcRecord[],pilot:NpcRecord,craft:ObjectRecord,toId:string,day:number,
 activities:ReadonlyMap<string,NpcActivity|null>,portfolios:readonly APortfolio[],roll:readonly OnTheRoll[]){
 if(!whatThisHouseCouldTakeOut(state,house).some(row=>row.rowId===craft.id)
  ||people.some(person=>state.npcs.find(row=>row.id===person.id)!==person
   ||activities.get(person.id)==null))return null;
 const read=quoteHouseAirDuty(state,house,people,pilot,craft,toId,day);
 if(!read||!(read.quote.daysOneWay>0)||whereItStands(craft)!==read.from)return null;
 const fuel=read.quote.stonesBurned+read.back.stonesBurned;
 const purse=Number(house.resources.spirit_stones??0);
 if(fuel>purse)return null;
 const loan=theHouseLendsAnActualDutyCraft(state,house,pilot,craft,portfolios,roll,day);
 if(!loan?.object)return null;
 // Synchronous admission has no intervening actor or callback. Its readiness is
 // the exact read above; a refusal has made no payment or custody write.
 house.resources.spirit_stones=purse-fuel;
 const accepted=admitPaidHouseAirDuty(state,house,people,pilot,loan.object,toId,day,activities);
 if(!accepted)throw Error('Validated paid current sending lost its actual air admission');
 return {accepted,fuel,read};
}

/** Reconsider each actual available hull after a physical or ordinary loan
 * refusal. The set lasts only for this current admission attempt; it records
 * no custody decision and cannot approve a spare. Existing selectors and
 * admission supply every quote, resource check and loan answer. */
export function sendASelectedHousePartyOnAnAvailableAirHull(state:WorldState,house:FactionRecord,
 people:readonly NpcRecord[],toId:string,day:number,walking:number,water:boolean,budget:number,
 activitiesFor:(read:NonNullable<ReturnType<typeof quoteHouseAirDuty>>,
 taking:ReturnType<typeof whatThisHouseCouldTakeOut>[number])=>ReadonlyMap<string,NpcActivity|null>,
 portfolios:readonly APortfolio[],roll:readonly OnTheRoll[],sending?:NonNullable<WorldState['pendingSendings']>[number]){
 const refusedCrafts=new Set<string>();
 for(;;){
  const taking=bestForThisRoad(whatThisHouseCouldTakeOut(state,house).filter(row=>
   row.conveyance.crossesGroundThatCannotBeWalked&&row.rowId!==undefined&&!refusedCrafts.has(row.rowId)),
   walking,people.length,water,budget);
  if(!taking?.rowId)return null;
  const craft=state.objects.find(row=>row.id===taking.rowId);
  if(craft){for(const pilot of people){
   const read=quoteHouseAirDuty(state,house,people,pilot,craft,toId,day,sending===undefined);
   if(!read)continue;
   const activities=activitiesFor(read,taking);
   if(sending&&read.quote.trips>1){
    const admitted=beginAnActualHouseAirShuttle(state,house,people,pilot,craft,sending,day,activities,portfolios,roll);
    if(admitted)return {...admitted,taking,dispatchFactId:admitted.row.dispatchFactId};
   }else{const admitted=sendAnActualSelectedHouseParty(state,house,people,pilot,craft,toId,day,
     activities,portfolios,roll);
    if(admitted)return {...admitted,taking,dispatchFactId:undefined};}

  }}
  refusedCrafts.add(taking.rowId);
 }
}
