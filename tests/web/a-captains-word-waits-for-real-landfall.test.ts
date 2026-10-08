/** An agreed onward word cannot make A→C a port teleport. The existing
 * scheduled meeting names an immutable word; actual B projection precedes its
 * fresh hull/operator, berth and each person's native fare admission. The
 * ordinary merchant booked only A→B disembarks at B, without incidental party
 * membership or a silently extended claim. ADMIN request landing proves the
 * consent effect, never the ordinary captain's willingness. These controls use
 * the actual independent world driver to reach B (no unasked played-body span).
 * Changes at that real boundary must defeat admission without new fare/crew.
 */
import {expect,it} from 'vitest';
import {atTheActualCaptain} from './fixtures/at-the-real-captain.js';
import {withTheAttemptLanding} from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
import {publicShipLinesFrom,quotePublicPassageOnActualHull} from '../../src/engine/world/public-shipping.js';
import {shipPassengerAt} from '../../src/engine/world/passenger-on-a-vessel.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {advanceWorldForPlay} from '../../src/engine/world/driver.js';
import {projectActualPassengers} from '../../src/web/passengers-at-the-actual-clock.js';
import {recordedVoyage} from '../../src/web/a-ship-at-sea.js';
import {worldLocationFor} from '../../src/web/entities.js';
import {journeyTimeHasReached,locationOnNpcJourney} from '../../src/engine/world/places-on-the-way.js';
import {markDead,setLocation} from '../../src/engine/world/npc-state.js';
async function agreed(){
 const f=await atTheActualCaptain(),now=f.game.currentRun(),current=shipPassengerAt(f.world,f.receipt.id,routineTime(f.world))!;
 const onward=publicShipLinesFrom(f.world,f.to.name,current.arrivalDay).map(line=>{
  const target=worldLocationFor(f.world,line.to)!;
  return target.id===f.from.id?null:quotePublicPassageOnActualHull(f.world,current.vesselId,f.to.id,target.id,current.arrivalDay,1,[],undefined,[now.cultivator.id]);
 }).find(q=>q!==null);
 expect(onward,'The authored dock must offer one feasible onward passage on this real hull.').toBeTruthy();
 const c=f.world.locations.find(p=>p.id===onward!.toId)!;
 f.plans.push(JSON.stringify({action:'request',target:'captain',intent:'course_change',topic:'take me to '+c.name}));
 const asked=(await withTheAttemptLanding('request',()=>f.game.act('I ask the captain to take me to '+c.name+'.'))).result;
 expect(asked.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
 expect(asked.toolCalls.some(call=>call.name==='engine.actualCaptainCourse'&&call.ok),JSON.stringify(asked.toolCalls)).toBe(true);
 expect(shipPassengerAt(f.world,f.receipt.id,routineTime(f.world))!.toId).toBe(f.to.id);
 expect(f.game.currentRun().cultivator.spiritStones).toBe(now.cultivator.spiritStones);
 expect(f.game.currentRun().run.elapsedDays-now.run.elapsedDays).toBeCloseTo(.125,12);
 expect(f.game.currentRun().run.turn-now.run.turn).toBe(1);
 const word=f.world.history.facts.find(fact=>fact.data.captainOnwardAgreement===true&&fact.data.fromReceiptId===f.receipt.id)!;
 expect(word).toBeTruthy();
 expect(f.world.history.facts.some(fact=>fact.data.onwardAgreementId===word.id)).toBe(false);
 return {...f,c,word,onward:onward!};
}
function reachB(f:Awaited<ReturnType<typeof agreed>>,atB?:()=>void){
 const day=shipPassengerAt(f.world,f.receipt.id,routineTime(f.world))!.arrivalDay;
 advanceWorldForPlay(f.world,{days:day-routineTime(f.world),preciseDays:true,stopOnInterrupt:false,atWorldBoundary:(world,onDay)=>{
  if(journeyTimeHasReached(onDay,day))atB?.();
  projectActualPassengers(f.db,world,f.game.currentRun().cultivator.id,onDay);
 }});
 f.game.theWorldMoved();
}
it('admits only the consenting passenger at actual B and leaves the other real passenger there',async()=>{
 const f=await agreed();try{
  const purse=f.game.currentRun().cultivator.spiritStones,crewIds=f.world.npcs.filter(n=>n.tags.includes('crew-of:'+f.receipt.data.vesselId)).map(n=>n.id).sort();
  reachB(f);
  const body=f.game.currentRun().cultivator,newClaim=recordedVoyage(f.db,body.id)!;
  expect(body.location).toBe(f.to.name);expect(newClaim.receiptId).not.toBe(f.receipt.id);
  const actual=shipPassengerAt(f.world,newClaim.receiptId!,routineTime(f.world))!;
  expect(actual.fromId).toBe(f.to.id);expect(actual.toId).toBe(f.c.id);
  expect(actual.vesselId).toBe(f.receipt.data.vesselId);
  expect(actual.receipt.causes).toContain(f.receipt.id);
  expect(actual.receipt.data.onwardAgreementId).toBe(f.word.id);
  expect(body.spiritStones).toBe(purse-f.onward.fareStones);
  expect(f.world.npcs.filter(n=>n.tags.includes('crew-of:'+f.receipt.data.vesselId)).map(n=>n.id).sort()).toEqual(crewIds);
  const ordinary=f.world.npcs.find(n=>n.id===f.passenger.id)!;
  expect(locationOnNpcJourney(f.world.locations,ordinary,routineTime(f.world))).toBe(f.to.id);
  expect(ordinary.activity?.untilDay).not.toBe(actual.arrivalDay);
  expect(actual.crew.some(n=>n.id===f.captain.id)).toBe(true);
  expect(f.world.history.facts.some(fact=>fact.data.onwardAgreementId===f.word.id&&fact.actors.some(a=>a.id===ordinary.id))).toBe(false);
 }finally{f.db.close();}
});
for(const change of ['operator','purse'] as const)it('rechecks actual '+change+' at B before charging or creating a new boarding',async()=>{
 const f=await agreed();try{
  let changed=false;
  reachB(f,()=>{if(changed)return;changed=true;
   if(change==='purse')f.game.repos.cultivators.update(f.game.currentRun().cultivator.id,{spiritStones:0});
   else{const at=f.world.npcs.findIndex(n=>n.id===f.captain.id),npc=f.world.npcs[at]!;
    f.world.npcs[at]=markDead(setLocation(npc,f.to.id,routineTime(f.world)),routineTime(f.world),'Actual landfall boundary death.');}
  });
  expect(changed).toBe(true);
  expect(f.world.history.facts.some(fact=>fact.data.onwardAgreementId===f.word.id)).toBe(false);
  expect(f.world.history.facts.some(fact=>fact.data.onwardAgreementResolved===f.word.id&&fact.data.onwardBoarded===false)).toBe(true);
  expect(f.game.currentRun().cultivator.location).not.toBe(f.c.name);
  if(change==='purse')expect(f.game.currentRun().cultivator.spiritStones).toBe(0);
 }finally{f.db.close();}
});
