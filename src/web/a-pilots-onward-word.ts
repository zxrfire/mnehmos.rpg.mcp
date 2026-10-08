/** An agreed private pilot word waits for the actual old endpoint. Ownership
 * is not consent. Native body/company availability, hull custody, craft power,
 * geography, capacity and priceJourney fuel are re-read at actual boarding.
 * No old passengers acquire a new company agreement by sharing the hull. */
import type Database from 'better-sqlite3';
import type {Cultivator} from '../schema/cultivation.js';
import type {WorldState} from '../engine/world/world-state.js';
import type {GameService} from './turn-engine.js';
import {acceptOwnedPassage,ownedCarrierAt,peopleUnavailableForOwnedBoarding} from './an-owned-passage.js';
import {getConveyance} from '../data/cultivation/what-a-house-moves-its-people-on.js';
import {itWantsAPilot,A_SPIRIT_BOAT_ANSWERS_TO} from '../engine/world/a-vehicle.js';
import {walkingDaysFrom} from '../engine/world/locations.js';
import {journeyNeedsWater,journeyTimeHasReached} from '../engine/world/places-on-the-way.js';
import {priceJourney} from '../engine/world/what-a-conveyance-does-to-a-journey.js';
import {whoIsOnTheRoadWith} from '../engine/world/who-is-on-the-road-with-you.js';
import {routineTime} from '../engine/world/npc-routines.js';
import {makeFact,type HistoricalFact} from '../engine/world/history.js';
import {makeScheduledEffect} from '../engine/world/world-state.js';
import {appendWorldFact} from '../engine/world/who-was-there-when-it-happened.js';
import {factsWithDataValue,witnessIndexFor} from '../engine/world/witness-reaction-index.js';
import {CultivatorRepository} from '../storage/repos/cultivator.repo.js';
import {RunRepository} from '../storage/repos/run.repo.js';
import {worldLocationFor} from './entities.js';

export function quotePilotsOnward(world:WorldState,body:Cultivator,receiptId:string,toId:string,day:number,boarding=false){
 const old=witnessIndexFor(world).byId.get(receiptId),d=old?.data;
 if(!old||d?.ownedPassage!==true||d.ownerId!==body.id||typeof d.vesselId!=='string'||typeof d.pilotId!=='string'
  ||typeof d.toLocationId!=='string'||typeof d.arrivalDay!=='number'||typeof d.conveyanceId!=='string')return null;
 const actual=ownedCarrierAt(world,receiptId,body,routineTime(world));
 if(!actual||actual.unavailable)return null;
 const pilot=world.npcs.find(n=>n.id===d.pilotId),craft=getConveyance(d.conveyanceId);
 if(!pilot||pilot.status!=='alive'||!craft||(itWantsAPilot(craft)&&pilot.cultivation.realmOrdinal<A_SPIRIT_BOAT_ANSWERS_TO))return null;
 const distance=walkingDaysFrom(world.locations,d.toLocationId).get(toId);
 if(distance===undefined||distance<=0||(journeyNeedsWater(world.locations,d.toLocationId,toId)&&!craft.crossesGroundThatCannotBeWalked))return null;
 const companions=[...new Set([pilot.id,...whoIsOnTheRoadWith(world.npcs,body.id,day).map(n=>n.id)])];
 const priced=priceJourney({walkingDays:distance,conveyance:craft,power:typeof d.conveyancePower==='number'?d.conveyancePower:null,heads:1+companions.length});
 if(priced.trips!==1||priced.stonesBurned>body.spiritStones)return null;
 if(boarding&&(!journeyTimeHasReached(day,d.arrivalDay)||worldLocationFor(world,body.location)?.id!==d.toLocationId
  ||peopleUnavailableForOwnedBoarding(world,companions,d.toLocationId,day).length))return null;
 return {vesselId:d.vesselId,pilotId:pilot.id,fromId:d.toLocationId,toId,walkingDays:distance,days:priced.daysForEverybody,
  conveyanceId:craft.id,power:typeof d.conveyancePower==='number'?d.conveyancePower:null,companions,stonesBurned:priced.stonesBurned,arrivalDay:d.arrivalDay};
}

export function agreeToPilotsOnward(game:GameService,body:Cultivator,receiptId:string,pilotId:string,toId:string){
 const world=game.atHand,quote=world&&quotePilotsOnward(world,body,receiptId,toId,routineTime(world));
 if(!world||!quote||quote.pilotId!==pilotId)return {ok:false,lines:['The actual pilot, held craft or native onward route is unavailable. No new course begins.']};
 const fact=appendWorldFact(world,makeFact({day:routineTime(world),kind:'gathering',visibility:'secret',causes:[receiptId],
  actors:[{id:pilotId,name:world.npcs.find(n=>n.id===pilotId)!.name,role:'operator'},{id:body.id,name:body.name,role:'continuing owner'}],
  summary:'The actual pilot agreed to consider the privately held craft\'s onward course at its reached endpoint.',
  data:{captainOnwardAgreement:true,service:'owned',operatorId:pilotId,passengerId:body.id,fromReceiptId:receiptId,
   vesselId:quote.vesselId,toLocationId:toId,maximumFuelStones:quote.stonesBurned}}),{recur:false});
 world.schedule.push(makeScheduledEffect({id:'onward-word:'+fact.id,kind:'meeting',dueOnDay:quote.arrivalDay,actorIds:[pilotId,body.id],
  locationId:quote.fromId,summary:'The actual private pilot word is considered at the reached endpoint.',data:{onwardAgreementId:fact.id}}));
 game.theWorldMoved();return {ok:true,lines:['The privately held craft still completes its admitted current course first.',
  'The actual pilot agreed to consider its native onward course after arrival; actual custody, bodies, capacity and fuel are rechecked there.']};
}

function words(world:WorldState):HistoricalFact[]{return world.schedule.flatMap(task=>{
 const id=task.data.onwardAgreementId;if(typeof id!=='string'||factsWithDataValue(world,'onwardAgreementResolved',id).length)return [];
 const f=witnessIndexFor(world).byId.get(id);return f?.data.captainOnwardAgreement===true&&f.data.service==='owned'?[f]:[];
});}
export function playersAwaitingPilotsWord(world:WorldState){return words(world).flatMap(f=>typeof f.data.passengerId==='string'?[f.data.passengerId]:[]);}

export function beginPilotsOnwardAtEndpoint(db:Database.Database,world:WorldState,day:number){
 const bodies=new CultivatorRepository(db),runs=new RunRepository(db);
 for(const fact of words(world)){
  const d=fact.data;if(typeof d.passengerId!=='string'||typeof d.fromReceiptId!=='string'||typeof d.operatorId!=='string'||typeof d.toLocationId!=='string')continue;
  const old=witnessIndexFor(world).byId.get(d.fromReceiptId)?.data;
  if(typeof old?.arrivalDay==='number'&&!journeyTimeHasReached(day,old.arrivalDay))continue;
  const body=bodies.getById(d.passengerId),run=body&&runs.getActiveRun(body.id);
  const quote=body?.alive&&run?quotePilotsOnward(world,body,d.fromReceiptId,d.toLocationId,day,true):null;
  let boarded=false;
  if(quote&&body&&run&&quote.pilotId===d.operatorId&&quote.stonesBurned<=Number(d.maximumFuelStones)){
   acceptOwnedPassage({atHand:world,db,repos:{cultivators:bodies},theWorldMoved:()=>{}},run,body,
    {...quote,priorReceiptId:d.fromReceiptId,onwardAgreementId:fact.id});boarded=true;
  }
  appendWorldFact(world,makeFact({day,kind:'gathering',visibility:'secret',actors:fact.actors,causes:[fact.id],
   summary:boarded?'The consenting pilot and actual available company began the same private hull\'s onward course.':'The private pilot word could not board under its actual body, custody, native route, capacity or fuel facts.',
   data:{onwardAgreementResolved:fact.id,onwardBoarded:boarded}}),{recur:false});
 }
}
