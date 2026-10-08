/** A current driver's agreed onward word keeps the admitted road to B first.
 * Existing public lines/fare and actual carriage assessment own the onward
 * quote; no new road, spare driver, free berth or vehicle is made. Payment waits
 * for real B and each independently consenting person's fresh native admission.
 */
import type Database from 'better-sqlite3';
import type {GameService} from './turn-engine.js';
import type {Cultivator} from '../schema/cultivation.js';
import type {WorldState} from '../engine/world/world-state.js';
import {makeScheduledEffect} from '../engine/world/world-state.js';
import {makeFact,type HistoricalFact} from '../engine/world/history.js';
import {appendWorldFact} from '../engine/world/who-was-there-when-it-happened.js';
import {factsWithDataValue,witnessIndexFor} from '../engine/world/witness-reaction-index.js';
import {publicCarriagePassage,quotePublicCarriageOnActualHull,commitPublicCarriage} from '../engine/world/public-carriages.js';
import {publicTransportFrom} from '../engine/world/public-transport-at-a-place.js';
import {A_HIRED_CARRIAGE_BY_GRADE,theHireOf} from './a-seat-on-a-ship-or-a-carriage.js';
import {stonesFor} from '../engine/world/the-fare-and-calendar-of-a-passage.js';
import {routineTime} from '../engine/world/npc-routines.js';
import {CultivatorRepository} from '../storage/repos/cultivator.repo.js';
import {RunRepository} from '../storage/repos/run.repo.js';
import {worldLocationFor} from './entities.js';
import {keepThePaidCarriage} from './a-paid-carriage-on-the-road.js';
export function quoteDriversOnward(game:Pick<GameService,'atHand'>,body:Cultivator,receiptId:string,toId:string){
 const world=game.atHand;if(!world)return null;
 const old=publicCarriagePassage(world,receiptId,body.id,routineTime(world));if(!old)return null;
 return quoteAtEndpoint(world,body,old,toId,old.leg.arrivalDay);
}
function quoteAtEndpoint(world:WorldState,body:Cultivator,old:NonNullable<ReturnType<typeof publicCarriagePassage>>,toId:string,day:number){
 const b=world.locations.find(p=>p.id===old.leg.toId),c=world.locations.find(p=>p.id===toId);
 if(!b||!c||!body.alive)return null;
 const line=publicTransportFrom(world,b.name,day).find(l=>l.service==='carriage'&&worldLocationFor(world,l.to)?.id===c.id);
 if(!line)return null;
 const hired=old.receipt.data.hired===true,grade=A_HIRED_CARRIAGE_BY_GRADE.find(g=>g.conveyanceId===old.leg.conveyanceId);
 if(hired&&!grade)return null;
 const fare=stonesFor(hired?theHireOf(line,grade!).cash:line.cashPerSeat);
 // Forecast place is derived from this person's actual accepted finite B leg;
 // the real commitment below uses a freshly projected SQL body at B instead.
 return quotePublicCarriageOnActualHull(world,old.leg.vesselId,{fromId:b.id,toId:c.id,day,
  conveyanceId:old.leg.conveyanceId,passengerIds:[body.id],fareStones:fare,hired,
  playedPassenger:{id:body.id,locationId:b.id,alive:body.alive}});
}
export function agreeToDriversOnward(game:GameService,body:Cultivator,receiptId:string,operatorId:string,toId:string){
 const world=game.atHand,quote=quoteDriversOnward(game,body,receiptId,toId);
 const actual=world&&publicCarriagePassage(world,receiptId,body.id,routineTime(world));
 if(!world||!quote||!actual||actual.driver.id!==operatorId||body.spiritStones<quote.fareStones)
  return {ok:false,lines:['The actual onward road, driver, carriage or quoted purse is unavailable. No new passage begins.']};
 const fact=appendWorldFact(world,makeFact({day:routineTime(world),kind:'gathering',visibility:'secret',locationId:actual.locationId,
  actors:[{id:operatorId,name:actual.driver.name,role:'operator'},{id:body.id,name:body.name,role:'continuing passenger'}],causes:[receiptId],
  summary:'The actual driver agreed to consider an onward road passage at the current landfall.',
  data:{captainOnwardAgreement:true,service:'carriage',operatorId,passengerId:body.id,fromReceiptId:receiptId,
   vesselId:actual.leg.vesselId,toLocationId:toId,maximumFareStones:quote.fareStones}}),{recur:false});
 world.schedule.push(makeScheduledEffect({id:'onward-word:'+fact.id,kind:'meeting',dueOnDay:actual.leg.arrivalDay,
  actorIds:[operatorId,body.id],locationId:actual.leg.toId,summary:'The agreed onward carriage passage is considered at the reached endpoint.',data:{onwardAgreementId:fact.id}}));
 game.theWorldMoved();return {ok:true,lines:['The admitted road still reaches its actual endpoint first.',
  'The same driver agreed to consider the existing onward road for at most '+quote.fareStones+' spirit stones after actual arrival.',
  'Actual driver, hull, road, seats and purse are rechecked there. Other passengers retain their own endpoints.']};
}
function words(world:WorldState):HistoricalFact[]{return world.schedule.flatMap(task=>{
 const id=task.data.onwardAgreementId;if(typeof id!=='string'||factsWithDataValue(world,'onwardAgreementResolved',id).length)return [];
 const fact=witnessIndexFor(world).byId.get(id);return fact?.data.captainOnwardAgreement===true&&fact.data.service==='carriage'?[fact]:[];
});}
export function playersAwaitingDriversWord(world:WorldState){return words(world).flatMap(f=>typeof f.data.passengerId==='string'?[f.data.passengerId]:[]);}
function close(world:WorldState,fact:HistoricalFact,day:number,ok:boolean,reason:string){appendWorldFact(world,makeFact({day,kind:'gathering',visibility:'secret',actors:fact.actors,causes:[fact.id],
 summary:reason,data:{onwardAgreementResolved:fact.id,onwardBoarded:ok}}),{recur:false});}
export function beginDriversOnwardAtEndpoint(db:Database.Database,world:WorldState,day:number):void {
 const bodies=new CultivatorRepository(db),runs=new RunRepository(db);
 for(const fact of words(world)){
  const d=fact.data;if(typeof d.passengerId!=='string'||typeof d.fromReceiptId!=='string'||typeof d.operatorId!=='string'||typeof d.toLocationId!=='string')continue;
  const priorId=d.fromReceiptId;
  const old=publicCarriagePassage(world,priorId,d.passengerId,day);
  if(old&&!old.arrived)continue;
  const body=bodies.getById(d.passengerId),run=body&&runs.getActiveRun(body.id);
  const quote=old?.arrived&&body?.alive&&run&&worldLocationFor(world,body.location)?.id===old.leg.toId
   &&old.driver.id===d.operatorId?quoteAtEndpoint(world,body,old,d.toLocationId,day):null;
  if(!quote||!body||!run||body.spiritStones<quote.fareStones||quote.fareStones>Number(d.maximumFareStones)){
   close(world,fact,day,false,'The actual onward carriage word cannot board under its fresh road, driver, hull, seat or purse facts.');continue;
  }
  db.transaction(()=>{
   const receipt=commitPublicCarriage(world,quote,{runId:run.id,elapsedDays:run.elapsedDays},{receiptId:priorId,agreementId:fact.id});
   if(!receipt){close(world,fact,day,false,'The actual carriage changed before its accepted onward boarding.');return;}
   bodies.applyDeltas(body.id,{spiritStones:-quote.fareStones});keepThePaidCarriage(db,body.id,receipt.id);
   close(world,fact,day,true,'The consenting actual passenger boarded the same carriage for its admitted onward road.');
  })();
 }
}
