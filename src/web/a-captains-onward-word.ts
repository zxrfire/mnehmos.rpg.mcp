/** A captain's actual agreed onward word is a meeting in the existing calendar.
 * The immutable agreement is not a boarding or a copied hull position. At B,
 * existing SQL/body and hull/custody/quote authorities either admit real people
 * or record why the conditional word cannot proceed. Incidental B passengers
 * receive no new claim, fare, activity, party or C entitlement.
 */
import type Database from 'better-sqlite3';
import type {Cultivator} from '../schema/cultivation.js';
import type {GameService} from './turn-engine.js';
import type {WorldState} from '../engine/world/world-state.js';
import {makeScheduledEffect} from '../engine/world/world-state.js';
import {makeFact,type HistoricalFact} from '../engine/world/history.js';
import {appendWorldFact} from '../engine/world/who-was-there-when-it-happened.js';
import {factsWithDataValue,witnessIndexFor} from '../engine/world/witness-reaction-index.js';
import {shipPassengerAt} from '../engine/world/passenger-on-a-vessel.js';
import {quotePublicPassageOnActualHull,recordPublicPassage} from '../engine/world/public-shipping.js';
import {bindShipCrewToPassage} from '../engine/world/ship-crew.js';
import {routineTime} from '../engine/world/npc-routines.js';
import {CultivatorRepository} from '../storage/repos/cultivator.repo.js';
import {RunRepository} from '../storage/repos/run.repo.js';
import {worldLocationFor} from './entities.js';
import {writeTheVoyage} from './a-ship-at-sea.js';

export function agreeToOnwardPublicPassage(game:GameService,body:Cultivator,
 receiptId:string,operatorId:string,toId:string):{ok:boolean;lines:string[]} {
 const world=game.atHand,day=world&&routineTime(world);
 if(!world||day===null||day===undefined||!body.alive)return{ok:false,lines:['No living passenger can receive an onward word.']};
 const actual=shipPassengerAt(world,receiptId,day),operator=actual?.crew.find(n=>n.id===operatorId);
 const quote=actual&&!actual.arrived&&!actual.unavailable&&operator?.identity.occupation==='shipmaster'
  ?quotePublicPassageOnActualHull(world,actual.vesselId,actual.toId,toId,actual.arrivalDay,1,[],undefined,[body.id]):null;
 if(!actual||!quote||body.spiritStones<quote.fareStones)return{ok:false,lines:[quote?
  'The onward berth is '+quote.fareStones+' spirit stones; this purse has '+body.spiritStones+'. No onward word is booked.':
  'No actual onward water line is available from the present course endpoint. The hull retains its course.']};
 const fact=appendWorldFact(world,makeFact({day,kind:'gathering',visibility:'secret',
  locationId:actual.locationId,actors:[{id:operatorId,name:operator!.name,role:'operator'},
   {id:body.id,name:body.name,role:'continuing passenger'}],causes:[receiptId],
  summary:'The operator agreed to an onward passage after the actual present landfall.',
  data:{captainOnwardAgreement:true,vesselId:actual.vesselId,operatorId,passengerId:body.id,
   fromReceiptId:receiptId,toLocationId:toId,maximumFareStones:quote.fareStones}}),{recur:false});
 world.schedule.push(makeScheduledEffect({id:'onward-word:'+fact.id,kind:'meeting',dueOnDay:actual.arrivalDay,
  summary:'The agreed onward passage can be considered at the actual landfall.',actorIds:[operatorId,body.id],
  locationId:actual.toId,data:{captainOnwardWordId:fact.id}}));
 game.theWorldMoved();
 return{ok:true,lines:['The actual operator agreed to consider the onward berth at the current landfall, for at most '+quote.fareStones+' spirit stones.',
  'The current hull still goes to its actual endpoint first. Onward payment and boarding wait for real arrival and fresh living operator, custody, berth and purse checks.',
  'Other passengers remain bound to their own landfalls. No incidental party or onward consent was created for them.']};
}
function pendingWords(world:WorldState):HistoricalFact[]{
 const out:HistoricalFact[]=[];
 for(const task of world.schedule){const id=task.data.captainOnwardWordId;
  if(typeof id!=='string'||factsWithDataValue(world,'onwardAgreementResolved',id).length)continue;
  const fact=witnessIndexFor(world).byId.get(id);
  if(fact?.data.captainOnwardAgreement===true && fact.data.service!=='carriage'&&fact.data.service!=='owned')out.push(fact);
 }
 return out;
}
export function playersAwaitingOnwardPassage(world:WorldState):string[]{
 return pendingWords(world).flatMap(f=>typeof f.data.passengerId==='string'?[f.data.passengerId]:[]);
}
function closeWord(world:WorldState,fact:HistoricalFact,day:number,reason:string,carried:boolean):void{
 appendWorldFact(world,makeFact({day,kind:'gathering',visibility:'secret',actors:fact.actors,
  causes:[fact.id],summary:reason,data:{onwardAgreementResolved:fact.id,onwardBoarded:carried}}),{recur:false});
}
/** Called only after actual old-leg passengers have been projected at this boundary. */
export function beginAgreedOnwardPassagesAtPort(db:Database.Database,world:WorldState,day:number):void{
 const repos=new CultivatorRepository(db),runs=new RunRepository(db);
 const groups=new Map<string,{fact:HistoricalFact;body:Cultivator;actual:NonNullable<ReturnType<typeof shipPassengerAt>>}[]>();
 for(const fact of pendingWords(world)){
  const d=fact.data;
  if(typeof d.fromReceiptId!=='string'||typeof d.passengerId!=='string'||typeof d.operatorId!=='string'||typeof d.toLocationId!=='string')continue;
  const actual=shipPassengerAt(world,d.fromReceiptId,day),body=repos.getById(d.passengerId);
  if(actual && !actual.arrived && !actual.unavailable)continue;
  if(!actual||actual.unavailable||!body?.alive||!runs.getActiveRun(body.id)
   ||worldLocationFor(world,body.location)?.id!==actual.toId
   ||!actual.crew.some(n=>n.id===d.operatorId&&n.identity.occupation==='shipmaster')){
   closeWord(world,fact,day,'The onward word cannot proceed: its actual passenger, operator or landfall is unavailable.',false);continue;
  }
  const key=JSON.stringify([actual.vesselId,actual.toId,d.toLocationId,d.operatorId]);
  const group=groups.get(key)??[];group.push({fact,body,actual});groups.set(key,group);
 }
 for(const records of groups.values()){
  const group=[...new Map(records.map(one=>[one.body.id,one])).values()];
  const first=group[0]!,toId=String(first.fact.data.toLocationId),ids=[...new Set(group.map(one=>one.body.id))];
  const quote=quotePublicPassageOnActualHull(world,first.actual.vesselId,first.actual.toId,toId,day,ids.length,[],undefined,ids);
  if(!quote){
   for(const one of records)closeWord(world,one.fact,day,'The onward word could not board: the real hull, quoted berth, agreed fare ceiling or purse no longer permits it.',false);continue;
  }
  // The public quote has one fare for the quoted heads, never a new fare formula.
  // Each person's one-head quote owns their debit; group capacity is checked once.
  const personal=group.map(one=>quotePublicPassageOnActualHull(world,quote.vesselId,quote.fromId,quote.toId,day,1,[],undefined,[one.body.id]));
  if(personal.some(q=>!q)||group.some((one,i)=>one.body.spiritStones<personal[i]!.fareStones
      ||personal[i]!.fareStones>Number(one.fact.data.maximumFareStones))){
   for(const one of records)closeWord(world,one.fact,day,'The actual individual onward fare cannot be met.',false);continue;
  }
  db.transaction(()=>{
   bindShipCrewToPassage(world,quote);
   const crew=world.npcs.filter(n=>n.status==='alive'&&n.tags.includes('crew-of:'+quote.vesselId));
   for(let i=0;i<group.length;i++){
    const one=group[i]!,paid=personal[i]!,run=runs.getActiveRun(one.body.id)!;
    const receipt=recordPublicPassage(world,paid,day,paid.fromId,[one.body.id],one.actual.receipt.id,
     {runId:run.id,elapsedDays:run.elapsedDays},[{id:one.body.id,name:one.body.name}],one.fact.id);
    repos.applyDeltas(one.body.id,{spiritStones:-paid.fareStones});
    writeTheVoyage(db,one.body.id,{receiptId:receipt.id,from:world.locations.find(p=>p.id===paid.fromId)!.name,
     bound:world.locations.find(p=>p.id===paid.toId)!.name,lane:paid.lane,sailed:0,days:paid.days,quoted:paid.days,
     hullRationDays:paid.provision.rationDaysAboard,crew:crew.length});
    for(const promised of records.filter(record=>record.body.id===one.body.id))
     closeWord(world,promised.fact,day,'The actual agreed passenger boarded the same hull for its admitted onward passage.',true);
   }
  })();
 }
}
