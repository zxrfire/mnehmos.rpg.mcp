/** Existing sea authority commitDayOf says that turning back beyond it is
 * longer, not impossible. Captain05 deliberately proved only the shorter-way
 * convenience. These controls extend explicit native consent to the
 * longer actual return, preserving its accepted storm-duration progress, real
 * operator/hull/fare/history and original provision expiry. Fixture advancement
 * below is the real independent world driver (other actors can advance the
 * shared world); it does not pretend the played body lived that unasked span.
 * The request itself must still spend its actual .125 body/world span once.
 * ADMIN landing proves the agreed effect, not natural consent frequency.
 */
import {expect,it} from 'vitest';
import {atTheActualCaptain} from './fixtures/at-the-real-captain.js';
import {withTheAttemptLanding} from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
import {advanceWorldForPlay} from '../../src/engine/world/driver.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {commitDayOf} from '../../src/engine/world/what-a-sea-crossing-costs.js';
import {shipPassengerAt,turnBackPublicPassage} from '../../src/engine/world/passenger-on-a-vessel.js';
import {projectActualPassengers} from '../../src/web/passengers-at-the-actual-clock.js';
import {paidCarrierSource} from '../../src/web/an-actual-paid-passage.js';
import {recordedVoyage,theRationsAboard} from '../../src/web/a-ship-at-sea.js';
import {worldLocationFor} from '../../src/web/entities.js';
import {isWater,journeyTimeHasReached,locationOnNpcJourney} from '../../src/engine/world/places-on-the-way.js';
import {markDead,setLocation} from '../../src/engine/world/npc-state.js';
import {ruin} from '../../src/engine/world/possessions.js';
async function pastMiddle(){
 const f=await atTheActualCaptain(),actual=shipPassengerAt(f.world,f.receipt.id,routineTime(f.world))!;
 const quote=recordedVoyage(f.db,f.game.currentRun().cultivator.id)!;
 const elapsed=Math.max(commitDayOf(quote.lane)+.25,(actual.arrivalDay-actual.departureDay)*.6);
 expect(elapsed).toBeLessThan(actual.arrivalDay-actual.departureDay-.25);
 advanceWorldForPlay(f.world,{days:actual.departureDay+elapsed-routineTime(f.world),preciseDays:true,stopOnInterrupt:false});
 projectActualPassengers(f.db,f.world,f.game.currentRun().cultivator.id,routineTime(f.world));f.game.theWorldMoved();
 const now=shipPassengerAt(f.world,f.receipt.id,routineTime(f.world))!;
 expect(now.sailed).toBeGreaterThan(commitDayOf(quote.lane));expect(now.arrived).toBe(false);
 expect(isWater(worldLocationFor(f.world,f.game.currentRun().cultivator.location)!)).toBe(true);
 return f;
}
it('accepts a longer return after the midpoint without port teleport, new fare or fresh free rations',async()=>{
 const {game,db,plans,world,from,to,receipt}=await pastMiddle();
 try{
  const before=game.currentRun(),moment=routineTime(world),claim=recordedVoyage(db,before.cultivator.id)!;
  const originalExpiry=Number(receipt.data.departureDay)+claim.hullRationDays;
  expect(turnBackPublicPassage(world,receipt.id,moment)).toBeNull(); // old shorter-way convenience only
  plans.push(JSON.stringify({action:'request',target:'captain',intent:'course_change',topic:'turn back to '+from.name}));
  const asked=(await withTheAttemptLanding('request',()=>game.act('I ask the captain to turn back to '+from.name+'.'))).result;
  expect(asked.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
 expect(asked.toolCalls.some(c=>c.name==='engine.actualCaptainCourse'&&c.ok),JSON.stringify(asked.toolCalls)).toBe(true);
  const after=game.currentRun(),actual=shipPassengerAt(world,receipt.id,routineTime(world))!;
  expect(actual.toId).toBe(from.id);expect(actual.arrived).toBe(false);
  expect(actual.vesselId).toBe(receipt.data.vesselId);
  const returnDays=actual.arrivalDay-actual.departureDay;
  const forwardRemaining=Number(receipt.data.arrivalDay)-actual.departureDay;
  expect(returnDays).toBeGreaterThan(forwardRemaining);
  expect(returnDays).toBeCloseTo(actual.departureDay-Number(receipt.data.departureDay),12);
  expect(after.cultivator.location).not.toBe(from.name);expect(after.cultivator.location).not.toBe(to.name);
  expect(isWater(worldLocationFor(world,after.cultivator.location)!)).toBe(true);
  expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  expect(after.run.turn-before.run.turn).toBe(1);expect(after.run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.125,12);
  expect(journeyTimeHasReached(routineTime(world)-moment,.125)&&journeyTimeHasReached(.125,routineTime(world)-moment)).toBe(true);
  expect(paidCarrierSource(game,after.cultivator.id,undefined,recordedVoyage(db,after.cultivator.id)!)!.providedFoodUntilDay).toBe(Math.min(actual.arrivalDay,originalExpiry));
  expect(theRationsAboard(db,after.cultivator,world)).toBeCloseTo(Math.max(0,originalExpiry-routineTime(world)),12);
  expect(actual.receipt.causes).toContain(receipt.id);
 }finally{db.close();}
});
for(const loss of ['operator','hull'] as const)it('keeps the old actual course when '+loss+' is lost during the longer-return request',async()=>{
 const {game,db,plans,world,from,receipt,captain}=await pastMiddle();
 try{
  const before=game.currentRun(),advance=game.advancePreparedWorld.bind(game);
  game.advancePreparedWorld=(...args:Parameters<typeof game.advancePreparedWorld>)=>{
   const report=advance(...args),day=routineTime(world);
   if(loss==='operator'){
    const at=world.npcs.findIndex(n=>n.id===captain.id),npc=world.npcs[at]!;
    if(npc.status==='alive')world.npcs[at]=markDead(setLocation(npc,locationOnNpcJourney(world.locations,npc,day)!,day),day,'Actual boundary loss.');
   }else{
    const at=world.objects.findIndex(o=>o.id===receipt.data.vesselId);
    world.objects[at]=ruin(world.objects[at]!,{onDay:day,source:'Actual boundary hull loss.'});
   }
   return report;
  };
  plans.push(JSON.stringify({action:'request',target:'captain',intent:'course_change',topic:'turn back to '+from.name}));
  const asked=(await withTheAttemptLanding('request',()=>game.act('I ask the captain to turn back to '+from.name+'.'))).result;
  expect(asked.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
  expect(asked.toolCalls.some(c=>c.name==='engine.actualCaptainCourse'&&!c.ok),JSON.stringify(asked.toolCalls)).toBe(true);
  expect(world.history.facts.some(f=>f.causes.includes(receipt.id)&&f.data.toLocationId===from.id)).toBe(false);
  expect(game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  expect(game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.125,12);
  expect(game.currentRun().cultivator.location).not.toBe(from.name);
 }finally{db.close();}
});
