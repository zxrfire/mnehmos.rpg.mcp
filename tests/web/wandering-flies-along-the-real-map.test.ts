/** Wandering supplies a heading, never a teleport or a remembered destination.
 * The native flight receipt holds its metric path and launch cost. A short
 * played span leaves the body between its ends; looking perceives unnamed
 * ground, and an explicit stop freezes that actual point without arriving. */
import {expect,it} from 'vitest';
import {makeGameInWorld,ScriptedProvider} from './harness.js';
import {airPositionAt} from '../../src/engine/world/an-air-course-in-the-world.js';
import {personalAirCourseClaim} from '../../src/web/an-actual-personal-air-course.js';
import {routineTime} from '../../src/engine/world/npc-routines.js';
import {metricGroundRead} from '../../src/engine/world/the-metric-ground-under-a-journey.js';
import {witnessIndexFor} from '../../src/engine/world/witness-reaction-index.js';
import {readJsonFlag} from '../../src/server/consolidated/cultivation-support.js';

it('wanders by bodily flight, sees unnamed ground, and stops at its actual airborne point',async()=>{
 const plans:string[]=[];
 const h=await makeGameInWorld({seed:'wandering-body-course-unknown',worldSeed:'road-world',
  provider:new ScriptedProvider({plans,narrations:[]})});
 try{
  await h.game.newRun('Wandering cultivator');
  let before=h.game.currentRun();
  h.repos.cultivators.update(before.cultivator.id,{realmOrdinal:29,qi:200,maxQi:200,hp:10000,maxHp:10000,satiety:100});
  before=h.game.currentRun();
  plans.push(JSON.stringify({action:'ride',target:'around',topic:'body flight',days:.001}));
  const flight=await h.game.act('I fly around at random for 0.001 days.');
  expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeLessThanOrEqual(.001+1e-7);
  expect(flight.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(flight.toolCalls)).toBe('model');
  expect(flight.toolCalls.some(call=>call.name==='engine.bodyFlightLaunch'&&call.ok&&call.summary.includes('25 qi'))).toBe(true);
  const world=h.game.atHand!,claim=personalAirCourseClaim(h.db,before.cultivator.id);
  expect(claim,JSON.stringify(flight.toolCalls)).not.toBeNull();
  const site=world.locations.find(place=>place.id===claim!.locationId)!;
  const receipt=witnessIndexFor(world).byId.get(String(site.data.airCourseId))!;
  const to=world.locations.find(place=>place.id===receipt.data.toLocationId)!;
  expect(h.game.canPointAtLocation(h.game.currentRun().cultivator,to),JSON.stringify({to:to.name,body:h.game.currentRun().cultivator.location,receipt:receipt.data})).toBe(false);
  expect(flight.narration).not.toContain(to.name);
  expect(JSON.stringify(flight.toolCalls)).not.toContain(to.name);
  const position=airPositionAt(world,site,routineTime(world))!;
  expect(position.fraction).toBeGreaterThan(0);expect(position.fraction).toBeLessThan(1);
  const metric=metricGroundRead(world.locations,{facts:witnessIndexFor(world).byId,onDay:routineTime(world)});
  expect(metric.point(site.id)).not.toEqual(metric.point(to.id));
  plans.push(JSON.stringify({action:'look'}));
  const look=await h.game.act('I look around.');
  expect(look.narration).not.toContain(to.name);
  expect(look.toolCalls.some(call=>call.name==='engine.whatCanBeSeenFromUpThere')).toBe(true);
  expect(readJsonFlag<unknown[]>(h.db,before.cultivator.id,'located_places')?.length).toBeGreaterThan(0);
  const elapsed=h.game.currentRun().run.elapsedDays,point=metric.point(site.id);
  plans.push(JSON.stringify({action:'move',intent:'stop'}));
  await h.game.act('I stop here.');
  expect(h.game.currentRun().run.elapsedDays).toBe(elapsed);
  expect(personalAirCourseClaim(h.db,before.cultivator.id)).toBeNull();
  expect(typeof site.data.airStoppedFactId).toBe('string');
  expect(metricGroundRead(world.locations,{facts:witnessIndexFor(world).byId,onDay:routineTime(world)+10}).point(site.id)).toEqual(point);
  expect(h.game.currentRun().cultivator.location).not.toBe(to.name);
  expect(h.game.canPointAtLocation(h.game.currentRun().cultivator,to)).toBe(false);
 }finally{h.db.close();}
},180000);
