/** CalendarPhase10 red unexpectedly passed ten controls; dead failed at an
 * absent-row observer. Actual native Phase12 proved genuine boundaries at
 * 365001 (world task), 365002 (npc23 due), 365003 (npc52 due) before the quoted
 * crossing365004.375, even with the explicit departure boundary removed.
 * Such existing appointments mask the missing generic departure split and can
 * lawfully prune a waiting dead mortal before crossing. They are not deleted.
 * Phase13 asks existing nextWorldClockBoundary for a genuinely quiet interval
 * on an actual closed authored date, advancing ordinary passHours while it is
 * not yet quiet. The finite search uses the same existing authored schedule
 * period bound; actual body survival/provisions/world effects remain native.
 * Original eleven physical/calendar controls and production source are kept.
 * Selected quote/boundary provenance is compactly recorded when requested.
 * Neither expected red counts nor source policy is evidence until root runs it.
 */
import { nextWorldClockBoundary } from '../../src/engine/world/world-clock-boundaries.js';
/** CalendarAudit01 native measured persistent365000 closed versus local0 open;
 * Calendar01 root native78131 independently proved shared board/directions/
 * purchase world-date reads (board red3/directions red1, green4). Phase08's
 * separate nine-case physical-boundary proof passed, but its fixture still
 * selected closed dates using local run age. This composition asks the existing
 * party/world date authority for every quote and naturally spends ordinary
 * passHours only while that actual authored schedule is open. It changes no
 * route/schedule/clock or physical assertion; old local-calendar proofs remain
 * preserved. Full composition needs fresh root compiler/native acceptance. */
/** Clock09 fixed the native hour/quote mismatch, but SQL stayed at origin through
 * passenger recovery. These native counter purchases observe actual committed
 * world boundaries: origin before crossing, destination from crossing onward.
 * The recovery/death controls preserve actual total quote, fare and final custody.
 * Phase02 native produced 2 retained PASS and 7 setup FAIL: day zero opens
 * every authored four-days-in-nine route, so a closed-route selector was impossible.
 * Phase03 arranges the initial body/place, then genuinely spends ordinary native
 * waiting time until the existing counter quote says closed. Run/body/world clocks
 * and actual quotes are optionally recorded to a JSONL diagnostic file. No calendar
 * or route is changed. Native Phase04 then reached 5 PASS/4 FAIL: absent other
 * appointments, one world portion included the whole wait plus crossing, so no
 * waiting consequence ran before paid companions moved. Phase06 supplies the
 * actual published departure and crossing boundaries from the same quote and
 * existing SPAN_CROSSING_DAYS; original wait/death/course/fare assertions remain.
 * Phase06 paired native reached the intended 4 red FAIL/5 PASS, then green
 * 8 PASS/1 observer failure. Diagnostic07 measured actual realm10 paid NPC:
 * alive at origin after wait, native markDead physically_dead at origin, and
 * crossingTruth still at origin. The first crossing advance lawfully removed
 * this unremembered mortal under FOUNDATION_ORDINAL13. A final array lookup
 * therefore has no row. Phase08 observes actual dead status at crossing and
 * accepts that final legitimate absence or retained physically_dead row, while
 * retaining no-body-transfer, fare, time and all other original controls.
 * Production/pruning/fixture ordinal are unchanged.
 * The death control explicitly applies a
 * native recorded body death AFTER the real world crossing boundary; it proves
 * custody and stopping, not an organically encountered cause. No model is used.
 */
import { expect, it, vi } from 'vitest';
import { appendFileSync } from 'node:fs';
import { passHours } from '../../src/web/routine-invitations.js';
import { makeGameInWorld } from './harness.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { routesFrom, SPAN_CASH_PER_WALKED_DAY } from '../../src/engine/world/where-the-measured-span-still-answers.js';
import { quotePassageAtACounter } from '../../src/engine/world/buying-passage-at-a-measured-span-counter.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { localPrice } from '../../src/data/cultivation/regions.js';
import { cashToStones } from '../../src/data/cultivation/mortal-world.js';
import { takeThemWithYou } from '../../src/engine/world/who-is-on-the-road-with-you.js';
import { companyDuringPassage } from '../../src/engine/world/company-during-a-passage.js';
import { markDead, setLocation } from '../../src/engine/world/npc-state.js';
import { standingOf } from '../../src/server/consolidated/cultivation-mortal.js';

async function arrangement() {
 const h=await makeGameInWorld({seed:'guided-route',worldSeed:'road-world',worldEnabled:true});
 await h.game.newRun('Counter passenger');
 const native=h.game.currentRun();
 h.game.atHand=await prepareWorldClockForPreciseSpan(native.run,native.cultivator);
 let world=h.game.atHand;
 if(!world)throw Error('Actual counter world missing');
 const candidates=world.locations.flatMap(from=>routesFrom(from.name).map(route=>({from,route})))
  .filter(({route})=>worldLocationFor(world!,route.toPlace));
 const first=candidates[0];
 if(!first)throw Error('Actual counter catalog has no reachable authored route');
 const observe=(stage:string,extra:Record<string,unknown>={})=>{
  const path=process.env.PORTAL_PHASE_OBSERVATIONS;
  if(path)appendFileSync(path,JSON.stringify({stage,runElapsed:h.game.currentRun().run.elapsedDays,
   body:{id:h.game.currentRun().cultivator.id,location:h.game.currentRun().cultivator.location,alive:h.game.currentRun().cultivator.alive,hp:h.game.currentRun().cultivator.hp,spiritStones:h.game.currentRun().cultivator.spiritStones},worldMoment:routineTime(h.game.atHand!),
   routes:candidates.map(({from,route})=>({from:from.name,to:route.toPlace,schedule:route.schedule,
    quote:quotePassageAtACounter(route,{heads:1,worstPassengerOrdinal:0,
     onDay:h.game.theDayAPartyIsOn()??Math.floor(h.game.currentRun().run.elapsedDays),cashPerWalkedDayReplaced:1})})),...extra})+'\n');
 };
 observe('initial-open-calendar');
 h.repos.cultivators.update(native.cultivator.id,{realmOrdinal:0,spiritStones:5000,
  location:first.from.name,standingIn:null});
 const provisions=h.game.buyProvisions(h.game.currentRun().cultivator,first.route.schedule.periodDays);
 h.game.putBackWhatWasNotEaten(provisions.cultivator,{endState:{rationsRemaining:provisions.rations}});
 for(let attempt=0;attempt<first.route.schedule.periodDays*4;attempt++) {
  const beforeWait=h.game.currentRun();
  const quote=quotePassageAtACounter(first.route,{heads:1,worstPassengerOrdinal:0,
   onDay:h.game.theDayAPartyIsOn()??Math.floor(beforeWait.run.elapsedDays),cashPerWalkedDayReplaced:1});
  const start=routineTime(h.game.atHand!),crossingDay=start+quote.daysSpent-quote.settlingDays;
  const boundary=nextWorldClockBoundary(h.game.atHand!,start,crossingDay);
  observe('actual-quiet-interval-read',{partyDay:h.game.theDayAPartyIsOn(),quote,interval:{from:start,to:crossingDay},nextBoundary:boundary});
  if(!quote.openToday&&boundary===null)break;
  const advanced=await passHours(h.game,beforeWait.run,beforeWait.cultivator,24);
  observe('actual-preparatory-wait',{execution:advanced.spent});
  expect(h.game.currentRun().cultivator.alive,'native preparatory wait retains a living passenger').toBe(true);
  expect(h.game.currentRun().run.elapsedDays,'actual preparatory waiting makes progress').toBeGreaterThan(beforeWait.run.elapsedDays);
 }
 world=h.game.atHand;
 if(!world)throw Error('Actual counter world missing after native preparatory wait');
 const quotedDay=h.game.theDayAPartyIsOn()??Math.floor(h.game.currentRun().run.elapsedDays);
 observe('actual-closed-calendar');
 const selected=world.locations.flatMap(from=>routesFrom(from.name).map(route=>({from,route})))
  .find(({route})=>{
   if(!worldLocationFor(world!,route.toPlace))return false;
   const quote=quotePassageAtACounter(route,{heads:1,worstPassengerOrdinal:0,onDay:quotedDay,cashPerWalkedDayReplaced:1});
   const start=routineTime(world!);
   return !quote.openToday&&nextWorldClockBoundary(world!,start,start+quote.daysSpent-quote.settlingDays)===null;
  });
 if(!selected)throw Error('Authored schedule search reached no actual living closed-date quiet crossing interval');
 h.repos.cultivators.update(native.cultivator.id,{realmOrdinal:0,spiritStones:5000,
  location:selected.from.name,standingIn:null});
 let before=h.game.currentRun();
 const here=standingOf(before.cultivator,world);
 const quoted=quotePassageAtACounter(selected.route,{heads:1,worstPassengerOrdinal:0,onDay:quotedDay,
  cashPerWalkedDayReplaced:localPrice(here.regionId,SPAN_CASH_PER_WALKED_DAY)});
 // Native operator provisions become actual unopened pack stock, not a second food allowance.
 const provision=h.game.buyProvisions(before.cultivator,quoted.daysSpent);
 h.game.putBackWhatWasNotEaten(provision.cultivator,{endState:{rationsRemaining:provision.rations}});
 before=h.game.currentRun();
 const crossing=quoted.daysSpent-quoted.settlingDays;
 observe('actual-selected-quiet-quote',{partyDay:quotedDay,quote:quoted,interval:{from:routineTime(world),to:routineTime(world)+crossing},nextBoundary:nextWorldClockBoundary(world,routineTime(world),routineTime(world)+crossing)});
 expect(quoted.settlingDays).toBeGreaterThan(0);
 return {...h,selected,before,quoted,crossing,moment:routineTime(world),
  destination:h.game.whereTheRoadEndsIn(selected.route.toPlace).name};
}

for(const deathAtCrossing of [false,true])it('native counter '+(deathAtCrossing?'death retains reached ground':'waits at origin and recovers at destination'),async()=>{
 const h=await arrangement();
 try {
  const observations:{elapsed:number;bodyLocation:string|null;worldMoment:number}[]=[];
  const actualAdvance=h.game.advanceWorld.bind(h.game);
  let elapsed=0,killed=false;
  vi.spyOn(h.game,'advanceWorld').mockImplementation(async(...args)=>{
   const report=await actualAdvance(...args);
   elapsed+=args[0];
   const body=h.game.repos.cultivators.getById(h.before.cultivator.id)!;
   if(!h.game.atHand)throw Error('Native world lost at passage boundary');
   observations.push({elapsed,bodyLocation:body.location,worldMoment:routineTime(h.game.atHand)});
   if(deathAtCrossing&&!killed&&journeyTimeHasReached(elapsed,h.crossing)) {
    killed=true;
    h.repos.cultivators.markDead(body.id,'combat_defeat',h.before.run.turn+1,'Explicit actual crossing boundary fixture');
   }
   return report;
  });
  const result=await h.game.passage(h.before.run,h.before.cultivator,h.selected.route.toPlace,'buy');
  const after=h.game.currentRun();
  const reached=observations.find(row=>journeyTimeHasReached(row.elapsed,h.crossing));
  expect(reached,'native crossing produces an actual committed boundary').toBeDefined();
  expect(reached!.elapsed).toBeCloseTo(h.crossing,9);
  expect(reached!.bodyLocation).toBe(h.destination);
  const waiting=observations.filter(row=>!journeyTimeHasReached(row.elapsed,h.crossing));
  expect(waiting.length,'actual wait has native world appointments before crossing').toBeGreaterThan(0);
  for(const row of waiting)expect(row.bodyLocation).toBe(h.selected.from.name);
  expect(after.cultivator.location).toBe(h.destination);
  const fare=Math.max(1,Math.ceil(cashToStones(h.quoted.fareCash)));
  expect(after.cultivator.spiritStones).toBe(h.before.cultivator.spiritStones-fare);
  if(deathAtCrossing) {
   expect(killed).toBe(true);
   expect(after.cultivator.alive).toBe(false);
   expect(after.run.elapsedDays-h.before.run.elapsedDays).toBeCloseTo(h.crossing,9);
   expect(routineTime(h.game.atHand!)-h.moment).toBeCloseTo(h.crossing,9);
  } else {
   expect(result.outcome).toBe('executed');
   expect(after.cultivator.alive).toBe(true);
   expect(after.run.elapsedDays-h.before.run.elapsedDays).toBeCloseTo(h.quoted.daysSpent,9);
   expect(routineTime(h.game.atHand!)-h.moment).toBeCloseTo(h.quoted.daysSpent,9);
   const recovery=observations.filter(row=>journeyTimeHasReached(row.elapsed,h.crossing)&&row.elapsed>h.crossing);
   expect(recovery.length).toBeGreaterThan(0);
   for(const row of recovery)expect(row.bodyLocation).toBe(h.destination);
  }
 } finally {h.db.close();}
},240000);

/** Company arrangements use actual seeded bodies and native agreement activity.
 * Mid-wait death/course changes are explicit boundary consequences after native
 * advance, not a claim that the random world generated them. A new agreement
 * after payment must not buy an extra place. No end-of-recovery teleport is allowed.
 */
for(const state of ['available','expired','dead','independent','new_join'] as const)it('paid counter companion boundary: '+state,async()=>{
 const h=await arrangement();
 try {
  const world=h.game.atHand!;
  const people=world.npcs.filter(person=>person.status==='alive'&&person.cultivation.realmOrdinal>=8).slice(0,2);
  if(people.length!==2)throw Error('Actual world lacks two grown companion bodies');
  const paidId=people[0]!.id,newId=people[1]!.id;
  for(const person of people){
   const index=world.npcs.findIndex(row=>row.id===person.id);
   world.npcs[index]={...setLocation(person,h.selected.from.id,h.moment),activity:null};
  }
  const until=state==='expired'?h.moment+h.crossing:h.moment+h.quoted.daysSpent+2;
  const changed=takeThemWithYou(world.npcs,{leaderId:h.before.cultivator.id,party:[people[0]!],
   note:'Explicit established company fixture',onDay:h.moment,untilDay:until});
  for(const person of changed)world.npcs[world.npcs.findIndex(row=>row.id===person.id)]=person;
  h.game.theWorldMoved();
  expect(h.game.whoIsWithYouOnTheRoad(h.before.cultivator).map(person=>person.id)).toContain(paidId);
  const actualAdvance=h.game.advanceWorld.bind(h.game);
  let elapsed=0,altered=false;
  const atCrossing:{location:string|null;kind:string|undefined;updatedOn:number;status:string}[]=[];
  vi.spyOn(h.game,'advanceWorld').mockImplementation(async(...args)=>{
   const nextElapsed=elapsed+args[0];
   // Before native world consequences, the held body already reached this actual boundary.
   if(journeyTimeHasReached(nextElapsed,h.crossing)&&!journeyTimeHasReached(elapsed,h.crossing)) {
    const actual=h.game.atHand!.npcs.find(person=>person.id===paidId)!;
    atCrossing.push({location:actual.locationId,kind:actual.activity?.kind,updatedOn:actual.updatedOnDay,status:actual.status});
   }
   const report=await actualAdvance(...args);
   elapsed=nextElapsed;
   if(!altered&&!journeyTimeHasReached(elapsed,h.crossing)) {
    altered=true;
    const current=h.game.atHand!;
    const index=current.npcs.findIndex(person=>person.id===paidId),person=current.npcs[index]!;
    const onDay=routineTime(current);
    if(state==='dead')current.npcs[index]=markDead(person,onDay,'Explicit waiting boundary death fixture');
    if(state==='independent') {
     const other=current.locations.find(place=>place.kind==='settlement'&&place.id!==h.selected.from.id
      &&place.name!==h.destination);
     if(!other)throw Error('Actual world lacks independent-course endpoint');
     current.npcs[index]={...person,activity:companyDuringPassage(person.activity,{kind:'travelling',
      note:'Explicit independent course fixture',withIds:[],sinceDay:onDay,untilDay:onDay+h.quoted.daysSpent+20,
      fromLocationId:h.selected.from.id,returnTo:other.id},onDay)};
    }
    if(state==='new_join')for(const joined of takeThemWithYou(current.npcs,{leaderId:h.before.cultivator.id,
     party:[current.npcs.find(row=>row.id===newId)!],note:'Explicit later company fixture',onDay,
     untilDay:onDay+h.quoted.daysSpent+2}))current.npcs[current.npcs.findIndex(row=>row.id===joined.id)]=joined;
    h.game.theWorldMoved();
   }
   return report;
  });
  const result=await h.game.passage(h.before.run,h.before.cultivator,h.selected.route.toPlace,'buy');
  expect(result.outcome).toBe('executed');
  const crossingTruth=atCrossing.at(-1);
  if(!crossingTruth)throw Error('Actual passage never reached its crossing boundary');
  const destination=worldLocationFor(h.game.atHand!,h.destination);
  if(!destination)throw Error('Actual destination missing');
  if(state==='available'||state==='new_join'){
   expect(crossingTruth.location).toBe(destination.id);
   expect(crossingTruth.updatedOn).toBeCloseTo(h.moment+h.crossing,9);
   expect(h.game.atHand!.npcs.find(person=>person.id===paidId)!.locationId).toBe(destination.id);
  }else{
   expect(crossingTruth.location).not.toBe(destination.id);
   const actual=h.game.atHand!.npcs.find(person=>person.id===paidId)!;
   if(state==='dead'){
    expect(crossingTruth.status).toBe('physically_dead');
    expect(actual?.status).not.toBe('alive');
    if(actual)expect(actual.status).toBe('physically_dead');
   }
   if(state==='independent')expect(actual.activity?.kind).toBe('travelling');
   expect(actual?.locationId).not.toBe(destination.id);
  }
  if(state==='new_join')expect(h.game.atHand!.npcs.find(person=>person.id===newId)!.locationId).toBe(h.selected.from.id);
  const fare=quotePassageAtACounter(h.selected.route,{heads:2,worstPassengerOrdinal:0,
   onDay:h.game.theDayAPartyIsOn()??Math.floor(h.before.run.elapsedDays),cashPerWalkedDayReplaced:localPrice(
    standingOf(h.before.cultivator,h.game.atHand).regionId,SPAN_CASH_PER_WALKED_DAY)});
  expect(h.game.currentRun().cultivator.spiritStones).toBe(h.before.cultivator.spiritStones-
   Math.max(1,Math.ceil(cashToStones(fare.fareCash))));
  expect(h.game.currentRun().run.elapsedDays-h.before.run.elapsedDays).toBeCloseTo(h.quoted.daysSpent,9);
 }finally{h.db.close();}
},240000);
