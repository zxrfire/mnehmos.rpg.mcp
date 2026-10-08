/** Oct7 hull-room review found native boarding spread an old activity slot.
 * A local chosen area is a changing fact, not cabin entitlement. A fresh
 * boarding clears stale choice; a real prior-leg rebinding retains it. These
 * use the actual crew factory/catalog and binder, without a fabricated public
 * cabin or a second roster. This leaf tests binding only: actual water/room
 * reach and native body clocks remain the separate played room controls.
 * New controls UNRUN; breaking the prior-leg gate is the planned narrow red.
 */
import {expect,it} from 'vitest';
import {SEA_LANES} from '../../../src/data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import {ensureShipCrew,bindShipCrewToPassage} from '../../../src/engine/world/ship-crew.js';
import {shipIdForLane} from '../../../src/engine/world/the-ship-on-a-lane.js';
import type {NpcRecord} from '../../../src/engine/world/npc-state.js';
import type {PublicPassageLeg} from '../../../src/engine/world/public-shipping.js';
function actualCrew(){
 const lane=SEA_LANES[0]!,world={seed:'hull-local-area',npcs:[] as NpcRecord[]};
 const crew=ensureShipCrew(world,lane,lane.fromPlace,100);
 const master=crew.find(one=>one.identity.occupation==='shipmaster')!;
 const leg:PublicPassageLeg={lane,vesselId:shipIdForLane(lane),fromId:lane.fromPlace,toId:lane.toPlace,
  departureDay:100,arrivalDay:100+lane.expectedDays};
 return {world,master,leg};
}
it('does not inherit a stale local slot when an actual crew member freshly boards',()=>{
 const {world,master,leg}=actualCrew();
 master.activity={kind:'the_work_of_their_rank',note:'Keeping the ship.',withIds:[],
  sinceDay:99,untilDay:null,standingIn:leg.fromId+'#deck#the-foredeck'};
 bindShipCrewToPassage(world,leg);
 const aboard=world.npcs.find(one=>one.id===master.id)!;
 expect(aboard.activity!.standingIn).toBeNull();
 expect(aboard.activity!.vesselId).toBe(leg.vesselId);
 expect(aboard.activity!.fromLocationId).toBe(leg.fromId);
});
it('keeps the chosen slot while the same actual prior leg changes course',()=>{
 const {world,master,leg}=actualCrew();
 bindShipCrewToPassage(world,leg);
 const aboard=world.npcs.find(one=>one.id===master.id)!;
 const chosen=(leg.lane.water??leg.fromId)+'#deck#the-foredeck';
 aboard.activity={...aboard.activity!,standingIn:chosen};
 const changed:PublicPassageLeg={...leg,fromId:leg.lane.water??leg.fromId,toId:leg.fromId,
  departureDay:101,arrivalDay:102};
 bindShipCrewToPassage(world,changed,101,leg.departureDay);
 const onward=world.npcs.find(one=>one.id===master.id)!;
 expect(onward.activity!.standingIn).toBe(chosen);
 expect(onward.activity!.vesselId).toBe(leg.vesselId);
 expect(onward.activity!.returnTo).toBe(leg.fromId);
 expect(onward.activity!.sinceDay).toBe(101);
});

it('does not borrow an expired leg slot for a later boarding even with its old departure supplied',()=>{
 const {world,master,leg}=actualCrew();
 bindShipCrewToPassage(world,leg);
 const aboard=world.npcs.find(one=>one.id===master.id)!;
 aboard.activity={...aboard.activity!,standingIn:leg.toId+'#deck#the-foredeck'};
 const later:PublicPassageLeg={...leg,fromId:leg.toId,toId:leg.fromId,
  departureDay:leg.arrivalDay,arrivalDay:leg.arrivalDay+leg.lane.expectedDays};
 bindShipCrewToPassage(world,later,later.departureDay,leg.departureDay);
 expect(world.npcs.find(one=>one.id===master.id)!.activity!.standingIn).toBeNull();
});
