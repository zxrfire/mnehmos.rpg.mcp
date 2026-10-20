/** Native ruin records an exact lost provenance day. Surviving crew used to
 * keep projecting an accepted public ship toward its port after the real hull
 * was ruined. A current read must stop at dated reached water; normal settlement
 * retains that caused physical receipt before actors are forgotten. No new
 * ship/captain, corpse movement, ownership exception or successful water-arrival
 * is introduced. Tests use real boarding and native ruin, not a failed quote or
 * manufactured resolver result. The ordinary request/body/world control remains
 * through game.act and its actual committed boundary.
 */
import {expect,it} from 'vitest';
import {atTheActualCaptain} from './fixtures/at-the-real-captain.js';
import {ruin} from '../../src/engine/world/possessions.js';
import {shipPassengerAt,settleLostPublicPassages} from '../../src/engine/world/passenger-on-a-vessel.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {locationOnNpcJourney,isWater} from '../../src/engine/world/places-on-the-way.js';
import {advanceWorldForPlay} from '../../src/engine/world/driver.js';
import {projectActualPassengers} from '../../src/web/passengers-at-the-actual-clock.js';
import {worldLocationFor} from '../../src/web/entities.js';
function wreck(f:Awaited<ReturnType<typeof atTheActualCaptain>>){
 const at=f.world.objects.findIndex(o=>o.id===f.receipt.data.vesselId),before=f.world.objects[at]!;
 f.world.objects[at]=ruin(before,{onDay:routineTime(f.world),source:'Actual boundary loss of the hull.'});return before;
}
it('clamps the pure current read and the surviving real crew at the dated wreck ground',async()=>{
 const f=await atTheActualCaptain();try{
  const day=routineTime(f.world),before=shipPassengerAt(f.world,f.receipt.id,day)!,object=wreck(f);
  expect(before.arrived).toBe(false);expect(isWater(f.world.locations.find(p=>p.id===before.locationId)!)).toBe(true);
  const seen=shipPassengerAt(f.world,f.receipt.id,day+.125)!;
  expect(seen.unavailable).toBeTruthy();expect(seen.arrived).toBe(false);expect(seen.locationId).toBe(before.locationId);
  settleLostPublicPassages(f.world,day);
  const stopped=shipPassengerAt(f.world,f.receipt.id,day+.125)!;
  expect(stopped.receipt.data.publicPassageLost).toBe(true);expect(stopped.receipt.causes.length).toBeGreaterThan(0);
  expect(stopped.locationId).toBe(before.locationId);expect(stopped.arrived).toBe(false);
  for(const person of before.crew){const actual=f.world.npcs.find(n=>n.id===person.id)!;
   expect(actual.status).toBe('alive');expect(locationOnNpcJourney(f.world.locations,actual,day+10)).toBe(before.locationId);
  }
  projectActualPassengers(f.db,f.world,f.game.currentRun().cultivator.id,day);
  expect(worldLocationFor(f.world,f.game.currentRun().cultivator.location)!.id).toBe(before.locationId);
  expect(f.world.objects.find(o=>o.id===object.id)!.ownerId).toBe(object.ownerId);
  const losses=f.world.history.facts.filter(fact=>fact.data.publicPassageLost===true).length;
  settleLostPublicPassages(f.world,day+1);expect(f.world.history.facts.filter(fact=>fact.data.publicPassageLost===true)).toHaveLength(losses);
 }finally{f.db.close();}
});
it('stops an actual played continuation at loss without spending its later course or arriving at the port',async()=>{
 const f=await atTheActualCaptain();try{
  const before=f.game.currentRun(),advance=f.game.advancePreparedWorld.bind(f.game);let lost=false;
  f.game.advancePreparedWorld=(...args:Parameters<typeof f.game.advancePreparedWorld>)=>{const report=advance(...args);if(!lost){lost=true;wreck(f);}return report;};
  f.plans.push(JSON.stringify({action:'move',target:f.to.name,intent:'travel'}));
  const continued=await f.game.act('I continue sailing to '+f.to.name+'.');
  expect(lost,JSON.stringify(continued.toolCalls)).toBe(true);
  const after=f.game.currentRun(),actual=shipPassengerAt(f.world,f.receipt.id,routineTime(f.world))!;
  expect(actual.unavailable).toBeTruthy();expect(actual.arrived).toBe(false);
  expect(after.cultivator.location).not.toBe(f.to.name);
  expect(after.run.elapsedDays-before.run.elapsedDays).toBeLessThan(Number(f.receipt.data.arrivalDay)-Number(f.receipt.data.departureDay));
  expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  expect(continued.toolCalls.some(call=>call.name==='engine.actualCaptainCourse'&&call.ok)).toBe(false);
 }finally{f.db.close();}
});
it('does not retroactively lose an already completed passenger when the hull is later ruined',async()=>{
 const f=await atTheActualCaptain();try{
  const arrival=Number(f.receipt.data.arrivalDay);
  advanceWorldForPlay(f.world,{days:arrival-routineTime(f.world),preciseDays:true,stopOnInterrupt:false,atWorldBoundary:(world,day)=>projectActualPassengers(f.db,world,f.game.currentRun().cultivator.id,day)});
  expect(shipPassengerAt(f.world,f.receipt.id,routineTime(f.world))!.arrived).toBe(true);
  advanceWorldForPlay(f.world,{days:.125,preciseDays:true,stopOnInterrupt:false});wreck(f);
  const old=shipPassengerAt(f.world,f.receipt.id,routineTime(f.world))!;
  expect(old.arrived).toBe(true);expect(old.locationId).toBe(f.to.id);expect(old.unavailable).toBeNull();
 }finally{f.db.close();}
});
