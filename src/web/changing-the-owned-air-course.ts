/** Steering retains the actual craft and accepted air point. It does not give a
 * passenger command over an NPC pilot: that branch is called after ordinary
 * consent. A PC already at the controls uses the same feasible-course read.
 * A changed destination does not clear the old claim or park anybody at an
 * endpoint. The new historical acceptance causes the previous actual course.
 */
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import { ownedPassageClaim, ownedCarrierAt } from './an-owned-passage.js';
import { worldLocationFor } from './entities.js';
import { witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { requireConveyance } from '../data/cultivation/what-a-house-moves-its-people-on.js';
import { quoteAnAirJourney } from '../engine/world/what-an-air-journey-takes.js';
import { beginAnAirCourse, stopAnAirCourse } from '../engine/world/an-air-course-in-the-world.js';
import { writeFlag } from '../server/consolidated/cultivation-support.js';

export function quoteOwnedAirCourseChange(game:GameService,body:Cultivator,targetId:string,
    known?: (target: import('../engine/world/locations.js').LocationRecord) => boolean){
 const world=game.atHand,claim=ownedPassageClaim(game.db,body.id);
 const fresh=game.repos.cultivators.getById(body.id);
 if(!world||!claim||!fresh?.alive)return null;
 const fact=witnessIndexFor(world).byId.get(claim.receiptId),d=fact?.data,day=routineTime(world);
 const source=ownedCarrierAt(world,claim.receiptId,fresh,day),site=worldLocationFor(world,fresh.location);
 if(!fact||d?.airCourse!==true||typeof d.vesselId!=='string'||typeof d.pilotId!=='string'
  ||typeof d.conveyanceId!=='string'||typeof d.departureDay!=='number'||typeof d.arrivalDay!=='number'
  ||!source||source.unavailable||!site?.tags.includes('air-course')||source.locationId!==site.id
  ||day>=source.endsOnDay||targetId===d.toLocationId)return null;
 const target=world.locations.find(p=>p.id===targetId);
 if(!target||!(known ? known(target) : game.canPointAtLocation(fresh,target)))return null;
 const people=world.npcs.filter(n=>n.status==='alive'&&n.activity?.kind==='travelling'
  &&n.activity.vesselId===d.vesselId&&n.activity.sinceDay===d.departureDay&&n.activity.untilDay===d.arrivalDay
  &&n.activity.airCourseLocationId===site.id);
 if(d.pilotId!==body.id&&!people.some(n=>n.id===d.pilotId))return null;
 const power=typeof d.conveyancePower==='number'?d.conveyancePower:null;
 const quote=quoteAnAirJourney(world.locations,site.id,targetId,requireConveyance(d.conveyanceId),power,
  1+people.length,{facts:witnessIndexFor(world).byId,onDay:day});
 if(!quote||!(quote.daysForEverybody>0)||quote.trips!==1||quote.stonesBurned>fresh.spiritStones)return null;
 return {fact,site,target,quote,people,power,pilotId:d.pilotId,vesselId:d.vesselId,
  conveyanceId:d.conveyanceId,day,body:fresh};
}

/** The caller either is the actual PC operator or has resolved NPC consent.
 * There is no await between the final physical quote and its acceptance. */
export function changeOwnedAirCourse(game:GameService,body:Cultivator,targetId:string,operatorId:string,
    known?: (target: import('../engine/world/locations.js').LocationRecord) => boolean){
 const read=quoteOwnedAirCourseChange(game,body,targetId,known),world=game.atHand;
 if(!read||!world||read.pilotId!==operatorId)return null;
 const run=game.currentRun().run;
 const accepted=beginAnAirCourse(world,{bodyId:body.id,bodyName:read.body.name,fromId:read.site.id,
  toId:targetId,conveyanceId:read.conveyanceId,power:read.power,vesselId:read.vesselId,
  artId:null,onDay:read.day,runId:run.id,runElapsedDays:run.elapsedDays,heads:1+read.people.length,
  owned:{ownerId:body.id,pilotId:operatorId},priorReceiptId:read.fact.id,changedCourse:true});
 if(!accepted)return null;
 stopAnAirCourse(world,read.site,read.day,'The actual operator accepted a changed destination at this physical point.');
 for(const person of read.people){const at=world.npcs.findIndex(n=>n.id===person.id);if(at<0)continue;
  world.npcs[at]={...person,locationId:accepted.location.id,activity:{...person.activity!,
   fromLocationId:read.site.id,returnTo:targetId,sinceDay:read.day,untilDay:read.day+accepted.quote.daysOneWay,
   airCourseLocationId:accepted.location.id}};
 }
 game.repos.cultivators.update(body.id,{location:accepted.location.id,standingIn:read.body.standingIn});
 writeFlag(game.db,body.id,'owned_passage',JSON.stringify({receiptId:accepted.fact.id}));
 game.theWorldMoved();
 return accepted;
}
