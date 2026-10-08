/** Actual Watch15 native full proof found raw59.416666666666664 days became
 * WAIT59 before a real one-day summons interruption. Its scripted actual printed
 * post title was rejected because the target exceeded80 characters. Neither
 * restriction came from body, route or world. This shared reader/schema slice
 * retains finite positive fractions and actual emitted names; the existing
 * precise body/world iterator already spends fractional spans. Native controls
 * keep time and living body costs, model/floor routes and the ordinary lifespan
 * refusal. The board catalog emitter supplies the same real long title field without requiring any unaccepted Watch source.
 * Independent red arms restore only the original target cap OR the original
 * integer schema plus shared rounding. ScriptedProvider is a routing mock,
 * never live-model prose acceptance. Full watch service remains a separate gap.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { prepareWorldClockForPreciseSpan, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { validatePlan } from '../../src/web/planned-action.js';
import { parseDuration } from '../../src/web/sentence-parts.js';
import { HOUSE_MISSIONS } from '../../src/data/cultivation/what-a-house-posts-for-its-own.js';
import { aMissionAsAnOffer } from '../../src/engine/encounters/what-a-house-has-on-its-board.js';

async function atAnActualClock(model=false){
 const plans:string[]=[],h=await makeGameInWorld({seed:'coherent-native-fraction',worldSeed:'precise-owned-ocean-world',...(model?{provider:new ScriptedProvider({plans,narrations:[]})}:{})});
 await h.game.newRun('Span Reader');const now=h.game.currentRun();
 h.game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
 return {...h,plans};
}
it('native fractional floor wait spends the actual requested half-day',async()=>{
 const h=await atAnActualClock();try{
  const before=h.game.currentRun(),moment=routineTime(h.game.atHand!);
  const act=await h.game.act('I wait for 0.5 days.');
  expect(parseDuration('I wait for 0.5 days.')).toBe(.5);
  expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.5,9);
  expect(routineTime(h.game.atHand!)-moment).toBeCloseTo(.5,7);
  expect(h.game.currentRun().cultivator.alive).toBe(true);
  expect(act.toolCalls.some(c=>c.name==='storage.applyTimeSkip'&&c.ok)).toBe(true);
 }finally{h.db.close();resetCultivationWorlds();}
},120000);
it('native fractional model wait retains the finite sub-day plan',async()=>{
 const h=await atAnActualClock(true);try{
  const before=h.game.currentRun();h.plans.push(JSON.stringify({action:'wait',days:.5}));
  const act=await h.game.act('I wait for half a day.');
  expect(act.toolCalls.some(c=>c.name==='narrator.plan'&&c.source==='model')).toBe(true);
  expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.5,9);
  expect(h.game.currentRun().cultivator.alive).toBe(true);
 }finally{h.db.close();resetCultivationWorlds();}
},120000);
it('native finite span still reaches the actual body lifespan refusal before time',async()=>{
 const h=await atAnActualClock(true);try{
  const before=h.game.currentRun(),moment=routineTime(h.game.atHand!);
  h.plans.push(JSON.stringify({action:'seclude',days:1000*365}));
  const act=await h.game.act('I seclude for a thousand years.');
  expect(act.toolCalls.some(c=>c.name==='engine.aSpanPastTheEnd'&&!c.ok)).toBe(true);
  expect(act.narration).toContain('1000 years');
  expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
  expect(routineTime(h.game.atHand!)).toBe(moment);
  expect(h.game.currentRun().cultivator.alive).toBe(before.cultivator.alive);
 }finally{h.db.close();resetCultivationWorlds();}
},120000);
it('native plan schema rejects nonfinite and nonpositive spans',()=>{
 for(const days of [NaN,Infinity,-Infinity,0,-.5])expect(validatePlan({action:'wait',days}).ok).toBe(false);
});

it('native actual board emitter retains its complete long title in a validated plan',async()=>{
 const h=await atAnActualClock();try{
  const world=h.game.atHand!,house=world.factions.find(house=>house.dissolvedOnDay===null&&house.seatLocationId!==null)!;
  expect(house).toBeDefined();const seat=world.locations.find(place=>place.id===house.seatLocationId)!;
  expect(seat).toBeDefined();
  const offer=HOUSE_MISSIONS.map(mission=>aMissionAsAnOffer(mission,house,seat.name))
    .find(offer=>offer.name.length>80)!;
  expect(offer,'native board emitter must exercise the measured target ceiling').toBeDefined();
  const before=h.game.currentRun(),moment=routineTime(world);
  const result=validatePlan({action:'sect',intent:'duty',target:offer.name});
  expect(result.ok,'the engine emitted title must remain a complete model plan target').toBe(true);
  if(result.ok)expect(result.action.target).toBe(offer.name);
  expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
  expect(routineTime(world)).toBe(moment);
 }finally{h.db.close();resetCultivationWorlds();}
});
