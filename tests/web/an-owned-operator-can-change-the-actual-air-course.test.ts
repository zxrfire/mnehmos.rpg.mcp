import {passageRunMoment} from '../../src/engine/world/passage-moment.js';
/** The actual PC at the controls changes a feasible owned craft course directly;
 * an actual NPC pilot changes it only after ordinary consent. Both start at the
 * same metric airborne point, retain actual hull custody and people/local area,
 * and leave caused historic course/stop facts. ADMIN in the NPC positive only
 * lands consent. Native body/world/fuel/movement and actual expiry remain live.
 * This is a scratch unrun candidate; a frontdoor interruption is measured, never
 * silently converted into endpoint arrival. Ordinary owned-water-only geometry
 * remains a separate gap; these controls use a real direct-air spirit boat.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld,ScriptedProvider } from './harness.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { createNpc, setRealm } from '../../src/engine/world/npc-state.js';
import { aVehicleOf, takeItAlong, whoItIsWith } from '../../src/engine/world/a-vehicle.js';
import { requireConveyance } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { quoteAnAirJourney } from '../../src/engine/world/what-an-air-journey-takes.js';
import { witnessIndexFor } from '../../src/engine/world/witness-reaction-index.js';
import { LI_PER_WALKING_DAY } from '../../src/engine/world/the-metric-ground-under-a-journey.js';
import { acceptOwnedPassage, ownedCarrierAt,ownedPassageClaim } from '../../src/web/an-owned-passage.js';
import { passHours } from '../../src/web/routine-invitations.js';
import {ProviderNarrator} from '../../src/web/narrator.js';
import {withTheAttemptLanding} from '../../src/server/consolidated/forcing-an-attempt-to-land.js';
import {metricGroundRead} from '../../src/engine/world/the-metric-ground-under-a-journey.js';
import {createInjury} from '../../src/engine/cultivation/injuries.js';
import {forStream} from '../../src/engine/cultivation/rng.js';
import {bodilyTroubleAboard} from '../../src/engine/world/a-captain-answers-trouble.js';
import {actualPersonFor} from '../../src/web/the-actual-person-behind-a-world-row.js';

async function departure(companion:boolean) {
    const plans:string[]=[];
    const h=await makeGameInWorld({seed:'actual-owned-air',worldSeed:'road-world',narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-review',timeoutMs:0})});
    await h.game.newRun('Actual air hull owner');
    let now=h.game.currentRun();
    h.repos.cultivators.update(now.cultivator.id,{realmOrdinal:29,spiritStones:10000,hp:1000,maxHp:1000,satiety:100});
    now=h.game.currentRun();
    h.game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
    const world=h.game.atHand,day=routineTime(world),from=worldLocationFor(world,now.cultivator.location);
    if(!from)throw new Error('Actual departure ground absent');
    const bundle=h.game.buyProvisions(now.cultivator,120);
    h.game.putBackWhatWasNotEaten(bundle.cultivator,{endState:{rationsRemaining:bundle.rations}});
    const boat=aVehicleOf({id:'operator-arranged-air-hull',conveyanceId:'conv-spirit-boat',
        ownerId:now.cultivator.id,ownerName:now.cultivator.name,at:from.id});
    world.objects.push(boat);takeItAlong(world.objects,boat,now.cultivator.id);
    let pilot=companion?setRealm(createNpc(world.seed,{id:'operator-arranged-air-pilot',
        onDay:day,bornOnDay:day-40*365,locationId:from.id}),29,day):null;
    if(pilot){pilot.activity={kind:'out_with_a_party',note:'Operator-arranged existing company',
        withIds:[now.cultivator.id],sinceDay:day,untilDay:day+100};world.npcs.push(pilot);}
    const kind=requireConveyance('conv-spirit-boat');
    const choice=world.locations.map(to=>({to,quote:quoteAnAirJourney(world.locations,from.id,to.id,
        kind,boat.power,companion?2:1,{facts:witnessIndexFor(world).byId,onDay:day})}))
        .find(row=>row.to.kind==='settlement'&&!row.to.tags.includes('interior')&&row.quote
            &&row.quote.trips===1&&row.quote.daysOneWay>.25&&row.quote.daysOneWay<10);
    if(!choice?.quote)throw new Error('Actual metric catalog lacks bounded air-hull route');
    now=h.game.currentRun();
    const receiptId=acceptOwnedPassage(h.game,now.run,now.cultivator,{vesselId:boat.id,
        pilotId:pilot?.id??now.cultivator.id,fromId:from.id,toId:choice.to.id,
        walkingDays:choice.quote.distanceLi/LI_PER_WALKING_DAY,days:choice.quote.daysOneWay,
        conveyanceId:kind.id,power:boat.power,companions:pilot?[pilot.id]:[],air:true});
    const site=world.locations.find(place=>place.originFactId===receiptId&&place.tags.includes('air-course'));
    if(!site)throw new Error('Accepted actual hull has no physical air site');
    pilot=pilot&&world.npcs.find(person=>person.id===pilot!.id)!;
    h.game.knowledge.learnIfNew({holderId:now.cultivator.id,kind:'place',id:from.id,name:from.name,onDay:now.run.elapsedDays,
        sourceKind:'told',sourceNote:'Explicit native arrangement supplies the route to the actual departure.',stage:'placed',statement:'The route to '+from.name+' is known.'});
    world.factions=[];world.schedule=[];world.npcs=world.npcs.filter(n=>n.id===pilot?.id||n.id===now.cultivator.id);
    const part=await passHours(h.game,h.game.currentRun().run,h.game.currentRun().cultivator,3);
    expect(part.finished,JSON.stringify(part.spent?.calls)).toBe(true);
    return {...h,plans,world,day,from,to:choice.to,quote:choice.quote,boat,pilot,receiptId,site};
}


it('an actual NPC pilot notices serious injury and diverts the same craft to a known nearby landing',async()=>{
 const h=await departure(true);try{
  const now=h.game.currentRun(),day=routineTime(h.world);
  const pilot=h.world.npcs.find(person=>person.id===h.pilot!.id)!;
  const wound=createInjury({severity:'serious',source:'combat',turn:now.run.turn},forStream(h.world.seed,'captain-air-injury'));
  h.repos.cultivators.addInjury(now.cultivator.id,wound);
  h.repos.cultivators.update(now.cultivator.id,{hp:Math.floor(now.cultivator.maxHp*.6)});
  const patient=actualPersonFor(h.game,now.cultivator.id)!;
  const trouble=bodilyTroubleAboard(patient,day)!;
  expect(trouble).not.toBeNull();
  for(let sample=0;sample<10000;sample++){
   const seed=`pilot-diverts-${sample}`;
   if(forStream(seed,'captain-duty-decision',pilot.id,trouble.key).next()<.01){h.world.seed=seed;break;}
  }
  h.plans.push(JSON.stringify({action:'look'}));
  const said=await h.game.act('I look around');
  expect(said.narration).toContain('for care');
  const claim=ownedPassageClaim(h.db,now.cultivator.id)!;
  expect(claim.receiptId).not.toBe(h.receiptId);
  const changed=witnessIndexFor(h.world).byId.get(claim.receiptId)!;
  expect(changed.data.vesselId).toBe(h.boat.id);
  expect(changed.data.pilotId).toBe(pilot.id);
  expect(changed.data.fromLocationId).toBe(h.site.id);
  expect(h.game.currentRun().cultivator.location).not.toBe(h.from.name);
  expect(h.game.currentRun().cultivator.injuries.some(injury=>injury.id===wound.id&&!injury.treated)).toBe(true);
 }finally{h.db.close();}
},120_000);

it('the actual PC steers the owned craft through the played frontdoor without an NPC captain or self-consent',async()=>{
 const h=await departure(false);try{
  const before=h.game.currentRun(),point=metricGroundRead(h.world.locations,{facts:witnessIndexFor(h.world).byId,onDay:routineTime(h.world)}).point(h.site.id);
  h.plans.push(JSON.stringify({action:'ride',target:h.from.name}));
  const result=await h.game.act('I steer my spirit boat back to '+h.from.name+'.');
  expect(result.toolCalls.find(c=>c.name==='narrator.plan')?.source,JSON.stringify(result.toolCalls)).toBe('model');
  const changed=h.world.history.facts.filter(f=>f.data.ownedPassage===true&&f.causes.includes(h.receiptId));
  expect(changed,JSON.stringify(result.toolCalls)).toHaveLength(1);const next=changed[0]!;
  expect(passageRunMoment(h.world,next.id)).toEqual(passageRunMoment(h.world,h.receiptId));
   expect(next.data.pilotId).toBe(before.cultivator.id);expect(next.data.vesselId).toBe(h.boat.id);
  expect(next.data.fromLocationId).toBe(h.site.id);expect(next.data.toLocationId).toBe(h.from.id);
  expect(h.world.history.facts.some(f=>f.data.airCourseStopped===h.receiptId)).toBe(true);
  expect(metricGroundRead(h.world.locations,{facts:witnessIndexFor(h.world).byId,onDay:routineTime(h.world)}).point(h.site.id)).toEqual(point);
  expect(result.toolCalls.some(c=>c.name==='engine.resolveAttempt')).toBe(false);
  expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeGreaterThan(0);
  expect(h.game.currentRun().run.turn-before.run.turn).toBe(1);
  expect(h.game.currentRun().cultivator.spiritStones).toBeLessThan(before.cultivator.spiritStones);
  expect(whoItIsWith(h.world.objects.find(o=>o.id===h.boat.id)!)).toBe(before.cultivator.id);
  const active=ownedPassageClaim(h.db,before.cultivator.id);
  if(active)expect(active.receiptId).toBe(next.id);
  else expect(h.game.currentRun().cultivator.location).toBe(h.from.name);
 }finally{h.db.close();}
},180000);
for(const expires of [false,true])it(expires?'does not change the owned air course after the actual NPC pilot expires during the request':'asks the actual pilot and changes the owned course from its current air point',async()=>{
 const h=await departure(true);try{
  const before=h.game.currentRun(),at=routineTime(h.world),pilot=h.world.npcs.find(n=>n.id===h.pilot!.id)!;
  if(expires)pilot.cultivation.lifespanEndsOnDay=at+.0625;
  h.plans.push(JSON.stringify({action:'request',target:'captain',intent:'course_change',topic:'take me back to '+h.from.name}));
  const result=(await withTheAttemptLanding('request',()=>h.game.act('I ask the captain to take me back to '+h.from.name+'.'))).result;
  expect(result.toolCalls.find(c=>c.name==='narrator.plan')?.source,JSON.stringify(result.toolCalls)).toBe('model');
  const changed=h.world.history.facts.filter(f=>f.data.ownedPassage===true&&f.causes.includes(h.receiptId));
  if(expires){expect(changed).toHaveLength(0);expect(h.world.npcs.find(n=>n.id===h.pilot!.id)?.status).not.toBe('alive');}
  else{
   expect(result.toolCalls.some(c=>c.name==='engine.actualCaptainCourse'&&c.ok),JSON.stringify(result.toolCalls)).toBe(true);
   expect(changed).toHaveLength(1);const next=changed[0]!;
   expect(passageRunMoment(h.world,next.id)).toEqual(passageRunMoment(h.world,h.receiptId));
   expect(next.data.pilotId).toBe(h.pilot!.id);expect(next.data.vesselId).toBe(h.boat.id);
   expect(next.data.fromLocationId).toBe(h.site.id);expect(next.data.toLocationId).toBe(h.from.id);
   expect(ownedPassageClaim(h.db,before.cultivator.id)?.receiptId).toBe(next.id);
   const nextSite=h.world.locations.find(p=>p.originFactId===next.id)!;
   expect(ownedCarrierAt(h.world,next.id,h.game.currentRun().cultivator,routineTime(h.world))?.locationId).toBe(nextSite.id);
   expect(h.game.currentRun().cultivator.location).toBe(nextSite.id);
   expect(pilot.activity?.withIds).toEqual(h.world.npcs.find(n=>n.id===h.pilot!.id)!.activity?.withIds);
  }
  expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeGreaterThan(0);
  expect(h.game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeLessThanOrEqual(.125);
  expect(h.game.currentRun().run.turn-before.run.turn).toBe(1);
  expect(h.game.currentRun().cultivator.spiritStones).toBeLessThanOrEqual(before.cultivator.spiritStones);
 }finally{h.db.close();}
},180000);
