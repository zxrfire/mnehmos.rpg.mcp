/** CalendarAudit01 root native1PASS measured world365000.333/run.333,
 * partyDay365000, phase0 period9/open4. Local0 quote was open; persistent365000
 * quote shut until365004 with4days wait. Actual board falsely said running today;
 * clocks did not change. Board/purchase/NPC directions were mutually consistent
 * but read a new life's age instead of their world's date. These native controls
 * reuse that world's existing date/quote and real available listener. Source
 * only changes the date read; no authored schedule/fare/recovery/clock changes.
 * Scripted/no-model mechanics are not model prose acceptance. Unrun candidate. */
import { expect,it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { prepareWorldClockForPreciseSpan,resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { routesFrom } from '../../src/engine/world/where-the-measured-span-still-answers.js';
import { quotePassageAtACounter } from '../../src/engine/world/buying-passage-at-a-measured-span-counter.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { theWayTo } from '../../src/web/the-way-to-somewhere-asked-of-somebody.js';
async function scene(){
 const h=await makeGameInWorld({seed:'guided-route',worldSeed:'road-world',worldEnabled:true});await h.game.newRun('A counter reader');const opened=h.game.currentRun();
 h.game.atHand=await prepareWorldClockForPreciseSpan(opened.run,opened.cultivator);const world=h.game.atHand!;
 const row=world.locations.flatMap(from=>routesFrom(from.name).map(route=>({from,route}))).find(row=>worldLocationFor(world,row.route.toPlace)&&world.npcs.some(n=>n.status==='alive'&&n.locationId===row.from.id));
 expect(row,'existing counter with actual living people').toBeDefined();h.repos.cultivators.update(opened.cultivator.id,{location:row!.from.name,standingIn:null});
 let now=h.game.currentRun();const people=peopleInThisPlace(h.repos,now.cultivator,world,row!.from);
 const id=[...people.whereIs.keys()][0];expect(id).toBeDefined();h.repos.cultivators.standIn(now.cultivator.id,people.whereIs.get(id!)!);now=h.game.currentRun();
 const speaker=h.game.present(now.cultivator).find(n=>n.id===id);expect(speaker).toBeDefined();
 const quote=quotePassageAtACounter(row!.route,{heads:1,worstPassengerOrdinal:now.cultivator.realmOrdinal,cashPerWalkedDayReplaced:1,onDay:h.game.theDayAPartyIsOn()!});
 const local=quotePassageAtACounter(row!.route,{heads:1,worstPassengerOrdinal:now.cultivator.realmOrdinal,cashPerWalkedDayReplaced:1,onDay:Math.floor(now.run.elapsedDays)});
 expect(quote.openToday).toBe(false);expect(local.openToday).toBe(true);
 return {...h,row:row!,speaker:speaker!,quote,now};
}
it('actual counter board publishes the persistent closed date without spending time',async()=>{
 const h=await scene();try{
  const moment=routineTime(h.game.atHand!);const result=await h.game.passage(h.now.run,h.now.cultivator,h.row.route.toPlace,'read');
  expect(result.outcome).toBe('executed');const line=result.facts.lines.find(s=>s.startsWith(h.row.route.toPlace+' - '));expect(line).toBeDefined();
  expect(line).toContain('next departure day '+h.quote.nextDepartureDay);expect(line).not.toContain('running today');
  expect(routineTime(h.game.atHand!)).toBe(moment);expect(h.game.currentRun().run.elapsedDays).toBe(h.now.run.elapsedDays);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);
it('actual local listener gives the same published world departure date',async()=>{
 const h=await scene();try{
  const moment=routineTime(h.game.atHand!);const answer=theWayTo(h.game,h.now.run,h.now.cultivator,h.speaker,h.row.route.toPlace);
  expect(answer.calls.some(c=>c.name==='engine.theWayTo'&&c.ok)).toBe(true);
  expect(answer.facts.lines.join('\n')).toContain('The next published departure is day '+h.quote.nextDepartureDay+'.');
  expect(answer.facts.lines.join('\n')).not.toContain('The published span runs today.');
  expect(routineTime(h.game.atHand!)).toBe(moment);expect(h.game.currentRun().run.elapsedDays).toBe(h.now.run.elapsedDays);
 }finally{h.db.close();resetCultivationWorlds();}
},180000);
