/** Oct7 captain ruling: the real pilot/driver is captain. Fare is no command
 * right. Other passengers and duties normally oppose a new course, but existing
 * native traits/ties/odds may consent; an always-no branch is wrong. This uses
 * the already native-proven public-passenger boarding arrangement, keeps the
 * merchant's actual different purpose, scripts intention only, and demands a
 * real .125 exchange plus the original hull/fare/history. Controls are UNRUN.
 * Root authorised existing withTheAttemptLanding ADMIN positive arrangements;
 * these prove accepted effects and boundary gates, not natural consent frequency.
 * Engine odds, actor traits, marks and counter-obligation are still native.
 * TURNED is genuine agreement plus a counter-obligation, not a false refusal.
 * Both accepted-effect controls use that ADMIN seam; the boundary-death
 * control must actually accept before testing its fresh-source rejection.
 * Separate ordinary unforced refusal below preserves the user's usual-no case.
 * Supported shorter-way return is existing canTurnBack/turnBackPublicPassage.
 * Arbitrary ports, carriage partial-edge and owned course-change remain gaps.
 */
import { expect, it } from 'vitest';
import { withTheAttemptLanding } from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
import { makeGame, ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { createWorld, prepareWorldClockForPreciseSpan, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { createNpc, upsertRelationship, markDead, setLocation } from '../../src/engine/world/npc-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { quotePublicPassage, recordPublicPassage } from '../../src/engine/world/public-shipping.js';
import { commitNpcPublicPassage, ensureShipCrew, bindShipCrewToPassage } from '../../src/engine/world/ship-crew.js';
import { startNpcPassage, journeyTimeHasReached, isWater, locationOnNpcJourney } from '../../src/engine/world/places-on-the-way.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { whatRunsFromHere } from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import { writeTheVoyage, recordedVoyage } from '../../src/web/a-ship-at-sea.js';
import { passHours } from '../../src/web/routine-invitations.js';


async function atTheActualCaptain(){
    const plans:string[]=[];
    const {game,db}=makeGame({seed:'ordinary-fellow-ship',worldEnabled:true,
        narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-review',timeoutMs:0})});
    resetCultivationWorlds();
    await createWorld({seed:'precise-sea-world',presentYear:0});
    await game.newRun('Passage traveller');
    let now=game.currentRun();
    game.repos.cultivators.update(now.cultivator.id,{location:'Emerald Water City',standingIn:null,
        realmOrdinal:20,spiritStones:5000,hp:1000,maxHp:1000,satiety:12});
    now=game.currentRun();game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
    const world=game.atHand,from=worldLocationFor(world,now.cultivator.location)!;
    const line=whatRunsFromHere(game,now.cultivator,routineTime(world)).find(one=>one.service==='ship'&&one.runsFromDay===null&&one.days>1)!;
    const to=worldLocationFor(world,line.to)!;
    const original=createNpc(world.seed,{id:'fellow-passenger-ship',locationId:from.id,onDay:routineTime(world),
        bornOnDay:routineTime(world)-25*365,occupation:'merchant',takenNames:new Set(world.npcs.map(one=>one.name))});
    const quote=quotePublicPassage(world,from.id,to.id,routineTime(world),1)!;
    const passenger=startNpcPassage(world.locations,{...original,spiritStones:5000},{lane:quote.lane,
        destinationId:to.id,onDay:quote.departureDay,days:quote.days,fareStones:quote.fareStones,purpose:'Taking wares to '+to.name+'.'})!;
    world.npcs.push(passenger);
    expect(commitNpcPublicPassage(world,passenger)).toBe(true);
    expect(passenger.tags.some(tag=>tag.startsWith('crew-of:'))).toBe(false);
    expect(passenger.spiritStones).toBe(5000-quote.fareStones);
    const playerQuote=quotePublicPassage(world,from.id,to.id,routineTime(world),1)!;
    const crew=ensureShipCrew(world,playerQuote.lane,from.id,playerQuote.departureDay);
    bindShipCrewToPassage(world,playerQuote);
    const receipt=recordPublicPassage(world,playerQuote,playerQuote.departureDay,from.id,[now.cultivator.id,...crew.map(one=>one.id)]);
    game.repos.cultivators.applyDeltas(now.cultivator.id,{spiritStones:-playerQuote.fareStones});
    writeTheVoyage(db,now.cultivator.id,{receiptId:receipt.id,from:from.name,bound:to.name,lane:playerQuote.lane,
        sailed:0,days:playerQuote.days,quoted:playerQuote.days,hullRationDays:playerQuote.provision.rationDaysAboard,crew:crew.length});
    game.theWorldMoved();

    const moved=await passHours(game,game.currentRun().run,game.currentRun().cultivator,3);
    expect(moved.finished,JSON.stringify(moved.spent?.calls)).toBe(true);
    expect(isWater(worldLocationFor(world,game.currentRun().cultivator.location)!)).toBe(true);
    const captain=game.somebodyAtHand('captain',game.currentRun().cultivator)!;
    expect(captain).toBeTruthy();
    plans.push(JSON.stringify({action:'interact',target:'captain',intent:'talk',topic:'hello'}));
    const greeted=await game.act('I greet the captain.');
    expect(greeted.toolCalls.some(call=>call.name==='engine.askedAbout'&&call.ok&&call.summary.startsWith('Asked '+captain.name+' about ')),JSON.stringify(greeted.toolCalls)).toBe(true);
    return {game,db,plans,world,from,to,receipt,passenger,captain};
}
it('uses the native ADMIN positive to return the same hull after a course request without fare or port teleport',async()=>{
 const {game,db,plans,world,from,receipt,passenger,captain}=await atTheActualCaptain();
 try {
  const before=game.currentRun(),moment=routineTime(world),index=world.npcs.findIndex(npc=>npc.id===captain.id);
  world.npcs[index]=upsertRelationship(world.npcs[index]!,{targetId:before.cultivator.id,
    targetName:before.cultivator.name,kind:'ally',standing:1,note:'A trusted ally.'},moment);
  plans.push(JSON.stringify({action:'request',target:'captain',intent:'course_change',topic:'turn back to '+from.name}));
  const asked=(await withTheAttemptLanding('request',()=>game.act('I ask the captain to turn back to '+from.name+'.'))).result;
  // ADMIN chooses a landing only for this positive mechanics fixture. The
  // normal odds and any counter-obligation are neither overwritten nor erased.
  expect(asked.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
 expect(asked.toolCalls.some(call=>call.name==='engine.resolveAttempt'),JSON.stringify(asked.toolCalls)).toBe(true);
  expect(asked.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
  expect(asked.toolCalls.some(call=>call.name==='engine.actualCaptainCourse'&&call.ok),JSON.stringify(asked.toolCalls)).toBe(true);
  const now=game.currentRun(),actual=shipPassengerAt(world,receipt.id,routineTime(world))!;
  expect(actual.toId).toBe(from.id);expect(actual.arrived).toBe(false);
  expect(actual.vesselId).toBe(String(receipt.data.vesselId));
  expect(isWater(worldLocationFor(world,now.cultivator.location)!)).toBe(true);
  expect(recordedVoyage(db,now.cultivator.id)?.receiptId).toBe(receipt.id);
  expect(world.history.facts.some(fact=>fact.causes.includes(receipt.id)&&fact.data.vesselId===receipt.data.vesselId)).toBe(true);
  expect(world.npcs.find(npc=>npc.id===passenger.id)!.activity!.note).toBe(passenger.activity!.note);
  expect(now.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  expect(now.run.turn-before.run.turn).toBe(1);
  expect(journeyTimeHasReached(routineTime(world)-moment,.125)&&journeyTimeHasReached(.125,routineTime(world)-moment)).toBe(true);
 } finally {db.close();resetCultivationWorlds();}
});
it('keeps native consent historical but does not start a changed course after the actual captain dies',async()=>{
 const {game,db,plans,world,from,receipt,captain}=await atTheActualCaptain();
 try {
  const before=game.currentRun(),moment=routineTime(world),index=world.npcs.findIndex(npc=>npc.id===captain.id);
  world.npcs[index]=upsertRelationship(world.npcs[index]!,{targetId:before.cultivator.id,
   targetName:before.cultivator.name,kind:'ally',standing:1,note:'A trusted ally.'},moment);
  const nativeAdvance=game.advanceWorld.bind(game);
  game.advanceWorld=async(...args:Parameters<typeof game.advanceWorld>)=>{
   const report=await nativeAdvance(...args);
   const current=world.npcs.findIndex(npc=>npc.id===captain.id);
   if(world.npcs[current]?.status==='alive') {
    const actualGround=locationOnNpcJourney(world.locations,world.npcs[current]!,routineTime(world));
    expect(actualGround).toBeTruthy();
    world.npcs[current]=markDead(setLocation(world.npcs[current]!,actualGround!,routineTime(world)),routineTime(world),
      'An arranged actual boundary death.');
   }
   return report;
  };
  plans.push(JSON.stringify({action:'request',target:'captain',intent:'course_change',topic:'turn back to '+from.name}));
  const asked=(await withTheAttemptLanding('request',()=>game.act('I ask the captain to turn back to '+from.name+'.'))).result;
  expect(asked.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
  expect(asked.toolCalls.some(call=>call.name==='engine.resolveAttempt'),JSON.stringify(asked.toolCalls)).toBe(true);
  expect(asked.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
  expect(asked.toolCalls.some(call=>call.name==='engine.actualCaptainCourse'&&!call.ok),JSON.stringify(asked.toolCalls)).toBe(true);
  expect(world.history.facts.some(fact=>fact.causes.includes(receipt.id)&&fact.data.toLocationId===from.id)).toBe(false);
  expect(world.npcs.find(npc=>npc.id===captain.id)?.status).not.toBe('alive');
  expect(game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  expect(game.currentRun().run.turn-before.run.turn).toBe(1);
  expect(journeyTimeHasReached(routineTime(world)-moment,.125)&&journeyTimeHasReached(.125,routineTime(world)-moment)).toBe(true);
 } finally {db.close();resetCultivationWorlds();}
});

it('can refuse an ordinary unforced course request without altering the accepted hull or charging another fare',async()=>{
 const {game,db,plans,world,from,receipt}=await atTheActualCaptain();
 try {
  const before=game.currentRun(),moment=routineTime(world),oldTo=String(receipt.data.toLocationId);
  plans.push(JSON.stringify({action:'request',target:'captain',intent:'course_change',topic:'turn back to '+from.name}));
  const asked=await game.act('I ask the captain to turn back to '+from.name+'.');
  expect(asked.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
  expect(asked.toolCalls.some(call=>call.name==='engine.resolveAttempt'),JSON.stringify(asked.toolCalls)).toBe(true);
  // Unforced native outcome is a measured fixture precondition. If the actual
  // actor agrees, investigate/report it rather than changing resolver odds.
  expect(asked.toolCalls.find(call=>call.name==='narrator.plan')?.source,JSON.stringify(asked.toolCalls)).toBe('model');
  expect(asked.toolCalls.some(call=>call.name==='engine.actualCaptainCourse'&&call.ok),JSON.stringify(asked.toolCalls)).toBe(false);
  expect(shipPassengerAt(world,receipt.id,routineTime(world))!.toId).toBe(oldTo);
  expect(game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
  expect(recordedVoyage(db,before.cultivator.id)?.receiptId).toBe(receipt.id);
  expect(game.currentRun().run.turn-before.run.turn).toBe(1);
  expect(journeyTimeHasReached(routineTime(world)-moment,.125)&&journeyTimeHasReached(.125,routineTime(world)-moment)).toBe(true);
 } finally {db.close();resetCultivationWorlds();}
});
