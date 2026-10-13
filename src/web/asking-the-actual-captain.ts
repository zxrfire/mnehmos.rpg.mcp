import {quoteOwnedSeaCourseChange,changeOwnedSeaCourse} from './changing-the-owned-sea-course.js';
import {quoteOwnedRoadCourseChange,changeOwnedRoadCourse} from './changing-the-owned-road-course.js';
import {quoteOwnedAirCourseChange,changeOwnedAirCourse} from './changing-the-owned-air-course.js';
import { captainPaymentSaid, preparePrivateOperatorTerms } from './negotiating-with-an-actual-private-operator.js';
import { bindAgreedRide, type AgreedRideTerms } from './an-offered-ride-is-an-agreement.js';
import {ownedPassageClaim} from './an-owned-passage.js';
import {quotePilotsOnward,agreeToPilotsOnward} from './a-pilots-onward-word.js';
/** Requests put to the actual operator; fare buys passage, never course command. */
import {thePaidCarriageClaim} from './a-paid-carriage-on-the-road.js';
import {publicCarriagePassage,quoteActualCarriageReturn,returnActualCarriageAfterAgreement} from '../engine/world/public-carriages.js';
import {quoteDriversOnward,agreeToDriversOnward} from './a-drivers-onward-word.js';
import type {Cultivator} from '../schema/cultivation.js';
import type {GameService} from './turn-engine.js';
import type {RequestCosting} from './what-asking-this-person-for-this-would-cost-them.js';
import {actualCarrierScene} from './the-actual-carrier-scene.js';
import {recordedVoyage} from './a-ship-at-sea.js';
import {shipPassengerAt,returnPublicPassageAfterAgreement} from '../engine/world/passenger-on-a-vessel.js';
import {routineTime} from '../engine/world/npc-routines.js';
import {worldLocationFor} from './entities.js';
import {witnessIndexFor} from '../engine/world/witness-reaction-index.js';
import {quotePublicPassageOnActualHull} from '../engine/world/public-shipping.js';
import {agreeToOnwardPublicPassage} from './a-captains-onward-word.js';
export interface CaptainCourseRequest {
 sourceKey:string;operatorId:string;receiptId:string|null;destinationId:string|null; service?:'carriage'|'owned';
 destinationName:string;otherBoundPeople:number;kind:'continue'|'return'|'onward'|'unsupported';
 availableReturnDays:number|null;reason:string|null;negotiated?:AgreedRideTerms;
}
export function requestedCaptainCourse(game:GameService,body:Cultivator,
 operatorId:string,topic:string,raw:string):CaptainCourseRequest|null {
 const match=(topic+' '+raw).match(/\b(?:change (?:the )?(?:course|destination) to|turn back to|(?:sail|steer|drive) (?:back )?to|take (?:me|us) (?:back )?to)\s+(.+?)[.!?]*$/i);
 if (!match || !game.atHand) return null;
 // Prefer a complete model topic when supplied; raw contains the addressed question too.
 const own=topic.match(/\b(?:change (?:the )?(?:course|destination) to|turn back to|(?:sail|steer|drive) (?:back )?to|take (?:me|us) (?:back )?to)\s+(.+?)[.!?]*$/i);
 const full=(own?.[1]??match[1]!).trim(), offered=captainPaymentSaid(full);
 const said=offered?.destination??full;
 const world=game.atHand,day=routineTime(world),source=actualCarrierScene(game.repos,body,world,day);
 if (!source || source.operatorId!==operatorId || !game.present(body).some(npc=>npc.id===operatorId)) return null;
 const target=worldLocationFor(world,said),voyage=recordedVoyage(game.db,body.id);
 const actual=voyage?.receiptId ? shipPassengerAt(world,voyage.receiptId,day):null;
 const others=world.npcs.filter(npc=>source.accepts(npc)&&npc.id!==operatorId
   && !npc.tags.includes('crew-of:'+source.vesselId)).length;
 const base={sourceKey:source.key,operatorId,receiptId:voyage?.receiptId??null,
   destinationId:target?.id??null,destinationName:said,otherBoundPeople:others};
 const roadClaim=thePaidCarriageClaim(game.db,body.id),road=roadClaim?publicCarriagePassage(world,roadClaim.receiptId,body.id,day):null;
 if(offered && !privateOwnedService(game,body,operatorId))return {...base,kind:'unsupported',availableReturnDays:null,reason:'Personal negotiated terms do not replace the public quoted coin fare or public service authority.'};
 if(road && road.driver.id===operatorId){
  const common={...base,service:'carriage' as const,receiptId:roadClaim!.receiptId};
  if(target?.id===road.leg.toId)return {...common,kind:'continue',availableReturnDays:null,reason:null};
  const back=target&&quoteActualCarriageReturn(world,roadClaim!.receiptId,body.id,target.id,day);
  if(back)return {...common,kind:'return',availableReturnDays:back.days,reason:null};
  if(target&&quoteDriversOnward(game,body,roadClaim!.receiptId,target.id))
   return {...common,kind:'onward',availableReturnDays:null,reason:null};
  return {...common,kind:'unsupported',availableReturnDays:null,reason:'The actual driver must complete the admitted current road before another quoted road can start. No quoted onward road supplies that destination.'};
 }
 const privateClaim=ownedPassageClaim(game.db,body.id),privateData=privateClaim&&witnessIndexFor(world).byId.get(privateClaim.receiptId)?.data;
 if(privateClaim && privateData?.pilotId===operatorId){
  const negotiated=offered && target ? preparePrivateOperatorTerms(game,body,operatorId,target.id,offered.payment):null;
  const common={...base,service:'owned' as const,receiptId:privateClaim.receiptId,
   ...(negotiated && 'terms' in negotiated?{negotiated:negotiated.terms}:{})};
  if(negotiated && 'reason' in negotiated)return {...common,kind:'unsupported',availableReturnDays:null,reason:negotiated.reason};
  if(negotiated && target?.id===privateData.toLocationId)return {...common,kind:'unsupported',availableReturnDays:null,
   reason:'That is the already accepted endpoint. These explicit private service terms require a genuinely new onward course; the current passage and its existing costs remain unchanged.'};
  if(target?.id===privateData.toLocationId)return {...common,kind:'continue',availableReturnDays:null,reason:null};
  const direct=target&&quoteOwnedAirCourseChange(game,body,target.id);
  if(direct)return {...common,kind:'return',availableReturnDays:direct.quote.daysOneWay,reason:null};
  const sea=target&&quoteOwnedSeaCourseChange(game,body,target.id);
  if(sea)return {...common,kind:'return',availableReturnDays:sea.days,reason:null};
  const road=target&&quoteOwnedRoadCourseChange(game,body,target.id);
  if(road)return {...common,kind:'return',availableReturnDays:road.days,reason:null};
  if(target && quotePilotsOnward(world,body,privateClaim.receiptId,target.id,Number(privateData.arrivalDay)))
   return {...common,kind:'onward',availableReturnDays:null,reason:null};
  return {...common,kind:'unsupported',availableReturnDays:null,reason:'The actual privately held craft supplies no admitted onward course, capable pilot, available seats or fuel for that destination.'};
 }
 if (!actual || !voyage) return {...base,kind:'unsupported',availableReturnDays:null,
   reason:'The accepted passage supplies no quoted changed course from this unfinished edge; its existing course remains unchanged.'};
 if (target?.id===actual.toId) return {...base,kind:'continue',availableReturnDays:null,reason:null};
 const original=witnessIndexFor(world).byId.get(voyage.receiptId!)?.data;
 const elapsed=actual.sailed;
 if (target?.id===original?.fromLocationId && actual.sailed>0)
   return {...base,kind:'return',availableReturnDays:elapsed,reason:null};
 if(target && quotePublicPassageOnActualHull(world,actual.vesselId,actual.toId,target.id,actual.arrivalDay,1,[],undefined,[body.id]))
   return {...base,kind:'onward',availableReturnDays:null,reason:null};
 return {...base,kind:'unsupported',availableReturnDays:null,
   reason:'The native current maritime course does not supply that changed route. The actual forward endpoint is '+
    (world.locations.find(place=>place.id===actual.toId)?.name??actual.toId)+
    '; a new onward leg needs an admitted water line from that actual endpoint.'};
}
export function costOfCaptainCourse(request:CaptainCourseRequest):RequestCosting {
 return {ask:request.otherBoundPeople>0?'against_their_interest':'a_real_favour',
  lines:request.otherBoundPeople>0?['The operator is already carrying other people under this accepted course. Changing it leaves their existing passage obligation unsettled.']:['The operator is being asked to change the real work they are currently doing.'],
  structure:['Course request reads actual current operator, accepted receipt and native physical feasibility; no guaranteed consent.'],
  techniqueId:null,askBack:null,refusal:request.reason?{headline:'That changed course is not physically supplied.',prose:request.reason,structure:request.reason}:null};
}
/** Consent is already resolved; this performs no second roll, fare debit or recruitment. */
export function carryOutCaptainCourse(game:GameService,body:Cultivator,request:CaptainCourseRequest):{
 ok:boolean;lines:string[];
} {
 const world=game.atHand;
 const fresh=world&&body.alive?actualCarrierScene(game.repos,body,world,routineTime(world)):null;
 if (!fresh || fresh.key!==request.sourceKey || fresh.operatorId!==request.operatorId
   || !game.present(body).some(npc=>npc.id===request.operatorId))
  return {ok:false,lines:['The actual operator, hull or course changed during the request; no new course began.']};
 if(request.kind==='continue') return {ok:true,lines:['The same accepted hull continues its existing course. No new fare or journey was booked.']};
 // Validate accepted service payment once before either physical private effect.
 // Effect fuel may reduce the payer's purse; no second post-effect validation
 // may discard the already agreed oath. Actual later shortfall remains owed.
 if(request.negotiated){
  const payment=request.negotiated.payment;
  const prepared=preparePrivateOperatorTerms(game,body,request.operatorId,request.destinationId!,
   payment.kind==='free'?'free':payment.kind==='stones'?payment.stones+' spirit stones':payment.name);
  if('reason' in prepared || JSON.stringify(prepared.terms.payment)!==JSON.stringify(payment))
   return {ok:false,lines:['The actual agreed payment, operator or custody changed during the request; no changed course or onward word was bound.']};
 }
 const completePrivateEffect=(done:{ok:boolean;lines:string[]})=>{
  if(done.ok&&request.negotiated){
   const operator=world!.npcs.find(n=>n.id===request.operatorId)!;
   const bound=bindAgreedRide(game,operator,body,{...request.negotiated,acceptedWorldDay:routineTime(world!)},
    world!.locations.find(p=>p.id===request.destinationId)!.name);
   done.lines.push(...bound.lines,'These are personal operator service terms. Native fuel, physical capacity and boarding costs remain independently required.');
  }
  return done;
 };
 if(request.kind==='return' && request.destinationId && request.service==='owned'){
  const changed=changeOwnedAirCourse(game,body,request.destinationId,request.operatorId)
    ??changeOwnedSeaCourse(game,body,request.destinationId,request.operatorId)
    ??changeOwnedRoadCourse(game,body,request.destinationId,request.operatorId);
  return completePrivateEffect(changed?{ok:true,lines:['The actual pilot accepted the changed destination on the same privately held craft.',
    'The old historical course and its caused stop remain. The new accepted course starts at the actual current reached point; nobody was landed at an endpoint.']}
   :{ok:false,lines:['The actual pilot, craft, point, available capacity or native fuel changed. No changed course began.']});
 }
 if(request.kind==='onward' && request.receiptId && request.destinationId && request.service==='owned')
  return completePrivateEffect(agreeToPilotsOnward(game,body,request.receiptId,request.operatorId,request.destinationId));
 if(request.kind==='onward' && request.receiptId && request.destinationId && request.service==='carriage')
  return agreeToDriversOnward(game,body,request.receiptId,request.operatorId,request.destinationId);
 if(request.kind==='onward' && request.receiptId && request.destinationId)
  return agreeToOnwardPublicPassage(game,body,request.receiptId,request.operatorId,request.destinationId);
 if(request.kind==='return'&&request.service==='carriage'&&request.receiptId&&request.destinationId){
  const leg=returnActualCarriageAfterAgreement(world!,request.receiptId,body.id,request.destinationId,routineTime(world!));
  if(!leg)return {ok:false,lines:['The actual directed reverse road, driver or hull is no longer feasible; the old course remains.']};
  game.theWorldMoved();return {ok:true,lines:['The same actual driver began the agreed reverse road from the reached edge. No second fare was charged.',
   'Existing fellow passengers retain their own outstanding passage obligations; nobody was moved to an endpoint.']};
 }
 if(request.kind!=='return'||!request.receiptId) return {ok:false,lines:[request.reason??'No physically supported changed course was committed.']};
 const leg=returnPublicPassageAfterAgreement(world!,request.receiptId,routineTime(world!));
 if(!leg||leg.toId!==request.destinationId) return {ok:false,lines:['The actual return is no longer feasible. The old actual course remains.']};
 game.theWorldMoved();
 return {ok:true,lines:['The living operator began the actual agreed return aboard the same hull.',
   'The original fare and passage remain historical. Existing passengers retain their own purposes and outstanding obligations.',
   'The return takes '+(leg.arrivalDay-leg.departureDay)+' days from this actual boundary; nobody was moved to the port.']};
}

function privateOwnedService(game:GameService,body:Cultivator,operatorId:string){
 const claim=ownedPassageClaim(game.db,body.id),data=game.atHand&&claim&&witnessIndexFor(game.atHand).byId.get(claim.receiptId)?.data;
 return data?.ownedPassage===true&&data.pilotId===operatorId;
}
