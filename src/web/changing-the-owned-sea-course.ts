/** The actual private ship operator can return on the real sailed course.
 * commitDayOf says a later return is longer, not impossible. This changes one
 * accepted itinerary at its actual water boundary, never a second position.
 * An unrelated target needs a native endpoint/onward course; no ocean shortcut.
 */
import type {Cultivator} from '../schema/cultivation.js';
import type {GameService} from './turn-engine.js';
import {ownedPassageClaim,ownedCarrierAt} from './an-owned-passage.js';
import {readAcceptedSeaLane} from '../engine/world/an-owned-sea-course.js';
import {witnessIndexFor} from '../engine/world/witness-reaction-index.js';
import {routineTime} from '../engine/world/npc-routines.js';
import {journeyTimeHasReached} from '../engine/world/places-on-the-way.js';
import {requireConveyance} from '../data/cultivation/what-a-house-moves-its-people-on.js';
import {whatTheChestBurns} from '../engine/world/what-a-conveyance-does-to-a-journey.js';
import {makeFact} from '../engine/world/history.js';
import {appendWorldFact} from '../engine/world/who-was-there-when-it-happened.js';
import {writeFlag} from '../server/consolidated/cultivation-support.js';

export function quoteOwnedSeaCourseChange(game:GameService,body:Cultivator,targetId:string,
 known?:(place:import('../engine/world/locations.js').LocationRecord)=>boolean){
 const world=game.atHand,claim=ownedPassageClaim(game.db,body.id),fresh=game.repos.cultivators.getById(body.id);
 if(!world||!claim||!fresh?.alive)return null;
 const fact=witnessIndexFor(world).byId.get(claim.receiptId),d=fact?.data,day=routineTime(world);
 if(!fact||d?.seaCourse!==true||typeof d.vesselId!=='string'||typeof d.pilotId!=='string'
  ||typeof d.conveyanceId!=='string'||typeof d.departureDay!=='number'||typeof d.arrivalDay!=='number'
  ||typeof d.fromLocationId!=='string'||typeof d.toLocationId!=='string'||targetId!==d.fromLocationId
  ||journeyTimeHasReached(day,d.arrivalDay)||day<=d.departureDay)return null;
 const lane=readAcceptedSeaLane(d.seaLane),source=ownedCarrierAt(world,fact.id,fresh,day);
 if(!lane||!source||source.unavailable||!source.locationId)return null;
 const target=world.locations.find(p=>p.id===targetId);
 if(!target||!(known?known(target):game.canPointAtLocation(fresh,target)))return null;
 const people=world.npcs.filter(n=>n.status==='alive'&&n.activity?.kind==='travelling'
  &&n.activity.vesselId===d.vesselId&&n.activity.fromLocationId===d.fromLocationId&&n.activity.returnTo===d.toLocationId
  &&n.activity.sinceDay===d.departureDay&&n.activity.untilDay===d.arrivalDay);
 if(d.pilotId!==body.id&&!people.some(n=>n.id===d.pilotId))return null;
 const days=day-d.departureDay,kind=requireConveyance(d.conveyanceId),heads=1+people.length;
 if(!kind.waterOnly||heads>kind.heads||whatTheChestBurns({conveyance:kind,daysOneWay:days,heads,trips:1})>fresh.spiritStones)return null;
 return {fact,lane,day,days,people,target,fromId:source.locationId,body:fresh,pilotId:d.pilotId,vesselId:d.vesselId};
}

/** Fresh same-source revalidation follows either PC steering or ordinary NPC
 * consent. No await separates this check from acceptance. No public fare debit. */
export function changeOwnedSeaCourse(game:GameService,body:Cultivator,targetId:string,operatorId:string,
 known?:(place:import('../engine/world/locations.js').LocationRecord)=>boolean){
 const read=quoteOwnedSeaCourseChange(game,body,targetId,known),world=game.atHand;
 if(!read||!world||read.pilotId!==operatorId)return null;
 const run=game.currentRun().run;
 const receipt=appendWorldFact(world,makeFact({day:read.day,kind:'gathering',locationId:read.fromId,
  visibility:'secret',summary:'The private ship operator began the agreed return on the same hull.',
  actors:read.fact.actors,causes:[read.fact.id],data:{...read.fact.data,changedOwnedCourse:true,
   fromLocationId:read.fromId,toLocationId:targetId,departureDay:read.day,arrivalDay:read.day+read.days,
   heads:1+read.people.length,runId:run.id,boardingRunElapsedDays:run.elapsedDays}}),{recur:false,bystanders:false});
 for(const person of read.people){const i=world.npcs.findIndex(n=>n.id===person.id);if(i<0)continue;
  world.npcs[i]={...person,activity:{...person.activity!,fromLocationId:read.fromId,returnTo:targetId,
   sinceDay:read.day,untilDay:read.day+read.days,seaLaneId:read.lane.id}};
 }
 writeFlag(game.db,body.id,'owned_passage',JSON.stringify({receiptId:receipt.id}));game.theWorldMoved();
 return {fact:receipt,days:read.days,fromId:read.fromId};
}
