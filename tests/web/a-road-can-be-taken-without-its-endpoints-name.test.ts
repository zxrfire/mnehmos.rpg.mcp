/** A visible road needs no remembered destination. The ordinary foot cursor
 * holds a partial journey; arrival teaches the name, and stopping does not. */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { makeLocation } from '../../src/engine/world/locations.js';
import { metricGroundRead } from '../../src/engine/world/the-metric-ground-under-a-journey.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { stoppedRoadFor } from '../../src/web/a-road-stopped-partway.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { addPlacesOnTheWay } from '../../src/engine/world/places-on-the-way.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { setLocation, PLAYER_ROW_TAG } from '../../src/engine/world/npc-state.js';
import { startNpcJourney } from '../../src/engine/world/dao-ground-stints.js';

it('sets out, stops on the actual road, looks, and reaches its previously unknown settlement', async () => {
    const plans: string[] = [];
    const h = await makeGameInWorld({ seed: 'unnamed-road-body', worldSeed: 'unnamed-road-world',
        provider: new ScriptedProvider({ plans, narrations: [] }) });
    try {
        await h.game.newRun('Road traveller');
        let now = h.game.currentRun();
        h.repos.cultivators.update(now.cultivator.id, { realmOrdinal: 20, hp: 10000, maxHp: 10000, satiety: 100 });
        now = h.game.currentRun();
        h.game.atHand = await prepareWorldClockForPreciseSpan(now.run, now.cultivator);
        const world = h.game.atHand, from = worldLocationFor(world, now.cultivator.location)!;
        const point = metricGroundRead(world.locations).point(from.id)!;
        const town = makeLocation({ id: 'road-next-settlement', name: 'Reed Lantern Ford', kind: 'settlement',
            parentId: from.parentId, data: { metricXLi: point.xLi + 40, metricYLi: point.yLi } });
        world.locations.push(town);
        from.links = [{ toLocationId: town.id, kind: 'road', travelDays: 2, open: true, requiresKeyId: null, note: '' }];
        town.links = [{ toLocationId: from.id, kind: 'road', travelDays: 2, open: true, requiresKeyId: null, note: '' }];
        addPlacesOnTheWay(world.locations);
        h.game.theWorldMoved();
        expect(h.game.canPointAtLocation(now.cultivator, town)).toBe(false);
        plans.push(JSON.stringify({ action: 'move', target: 'east road', days: .125 }));
        const out = await h.game.act('I walk along the east road for three hours.');
        expect(out.toolCalls.find(call => call.name === 'narrator.plan')?.source, JSON.stringify(out.toolCalls)).toBe('model');
        const cursor = stoppedRoadFor(h.db, h.game.currentRun().cultivator, h.game.atHand);
        expect(cursor?.position?.kind, JSON.stringify(out.toolCalls)).toBe('edge');
        expect(cursor?.walked).toBeGreaterThan(0);
        expect(out.narration).not.toContain(town.name);
        expect(JSON.stringify(out.toolCalls)).not.toContain(town.name);
        expect(h.game.canPointAtLocation(h.game.currentRun().cultivator, town)).toBe(false);
        const beforeStop=h.game.currentRun().run.elapsedDays;
        plans.push(JSON.stringify({action:'move',intent:'stop'}));
        await h.game.act('I stop here.');
        expect(h.game.currentRun().run.elapsedDays).toBe(beforeStop);
        plans.push(JSON.stringify({ action: 'look' }));
        const look = await h.game.act('I look along the road.');
        expect(look.narration).not.toContain(town.name);
        expect(look.toolCalls.some(call=>call.name==='engine.whatCanBeSeenFromUpThere')).toBe(true);
        plans.push(JSON.stringify({ action: 'move' }));
        const arrival = await h.game.act('I keep walking along this road.');
        expect(h.game.currentRun().cultivator.location, JSON.stringify(arrival.toolCalls)).toBe(town.name);
        expect(stoppedRoadFor(h.db, h.game.currentRun().cultivator, h.game.atHand)).toBeNull();
        expect(h.game.canPointAtLocation(h.game.currentRun().cultivator, town)).toBe(true);
    } finally { h.db.close(); }
}, 180000);

/** A road is a pointer, not a leaked endpoint name. A stranger can fail to place
 * it; somebody returning to their own town can supply its actual name and route. */
it('asks where the actual road leads and learns only what the person knows',async()=>{
 const plans:string[]=[],h=await makeGameInWorld({seed:'ask-the-road-body',worldSeed:'unnamed-road-world',
  provider:new ScriptedProvider({plans,narrations:[]})});
 try {
  await h.game.newRun('Road traveller');
  let now=h.game.currentRun();h.repos.cultivators.update(now.cultivator.id,{realmOrdinal:20,hp:10000,maxHp:10000,satiety:100});
  now=h.game.currentRun();h.game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
  let world=h.game.atHand;
  const from=worldLocationFor(world,now.cultivator.location)!;
  const point=metricGroundRead(world.locations).point(from.id)!;
  const town=makeLocation({id:'road-question-town',name:'Reed Lantern Ford',kind:'settlement',parentId:from.parentId,
   data:{metricXLi:point.xLi+40,metricYLi:point.yLi}});
  world.locations.push(town);from.links=[{toLocationId:town.id,kind:'road',travelDays:2,open:true,requiresKeyId:null,note:''}];
  town.links=[{toLocationId:from.id,kind:'road',travelDays:2,open:true,requiresKeyId:null,note:''}];
  addPlacesOnTheWay(world.locations);h.game.theWorldMoved();
  plans.push(JSON.stringify({action:'move',target:'east road',days:.125}));
  await h.game.act('I walk along the east road for three hours.');
  expect(h.game.canPointAtLocation(h.game.currentRun().cultivator,town)).toBe(false);
  for(const knows of [false,true]) {
   world=h.game.atHand!;
   const body=h.game.currentRun().cultivator,day=routineTime(world),ground=worldLocationFor(world,body.location)!;
   const cursor=stoppedRoadFor(h.db,body,world)!;
   const departure=day-cursor.walked;
   const person=createNpc(world.seed,{id:'road-question-person-'+knows,locationId:knows?town.id:from.id,
    onDay:day,bornOnDay:day-30*365,takenNames:new Set(world.npcs.map(one=>one.name))});
   person.activity={kind:'travelling',note:knows?'Returning to their own town.':'Following the visible road.',withIds:[],
    fromLocationId:from.id,returnTo:town.id,sinceDay:departure,untilDay:departure+cursor.road};
   world.npcs.push(person);
   const area=peopleInThisPlace(h.game.repos,body,world,ground).whereIs.get(person.id);
   expect(area,JSON.stringify({knows,location:body.location,person:person.locationId,activity:person.activity,day})).toBeTruthy();
   h.repos.cultivators.standIn(body.id,area!);
   const descriptor=h.game.reachFrom(h.game.currentRun().cultivator).find(one=>one.id===person.id)?.alsoCalled
    .find(said=>h.game.somebodyAtHand(said,h.game.currentRun().cultivator)?.id===person.id);
   expect(descriptor).toBeTruthy();
   plans.push(JSON.stringify({action:'interact',intent:'talk',target:descriptor,topic:'where does this road lead'}));
   const answer=await h.game.act('I ask '+descriptor+' where does this road lead.');
   expect(answer.toolCalls.some(call=>call.name==='engine.theWayTo'&&call.ok),JSON.stringify(answer.toolCalls)).toBe(true);
   expect(h.game.canPointAtLocation(h.game.currentRun().cultivator,town)).toBe(knows);
   if(knows)expect(answer.narration).toContain(town.name);else expect(answer.narration).not.toContain(town.name);
  }
 }finally{h.db.close();}
},180000);

/** Staying leaves the body's cursor fixed. Existing journey traffic supplies
 * a crossing appointment; the person is neither spawned nor made a companion. */
it('stays on a road, waits for an existing traveller, and talks while they pass',async()=>{
 const plans:string[]=[],h=await makeGameInWorld({seed:'living-on-the-road',worldSeed:'unnamed-road-world',
  provider:new ScriptedProvider({plans,narrations:[]})});
 try{
  await h.game.newRun('Road dweller');
  let now=h.game.currentRun();
  h.repos.cultivators.update(now.cultivator.id,{realmOrdinal:20,hp:10000,maxHp:10000,satiety:100});
  now=h.game.currentRun();h.game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
  const world=h.game.atHand,from=worldLocationFor(world,now.cultivator.location)!;
  const point=metricGroundRead(world.locations).point(from.id)!;
  const town=makeLocation({id:'road-home-beyond',name:'Reed Lantern Ford',kind:'settlement',parentId:from.parentId,
   data:{metricXLi:point.xLi+40,metricYLi:point.yLi}});
  world.locations.push(town);
  from.links=[{toLocationId:town.id,kind:'road',travelDays:2,open:true,requiresKeyId:null,note:''}];
  town.links=[{toLocationId:from.id,kind:'road',travelDays:2,open:true,requiresKeyId:null,note:''}];
  addPlacesOnTheWay(world.locations);h.game.theWorldMoved();
  plans.push(JSON.stringify({action:'move',target:'east road',days:.125}));
  await h.game.act('I follow the east road for three hours.');
  plans.push(JSON.stringify({action:'move',intent:'stop'}));await h.game.act('I stop and stay here.');
  const held=stoppedRoadFor(h.db,h.game.currentRun().cultivator,h.game.atHand)!;
  expect(held.position?.kind).toBe('edge');
  const state=h.game.atHand!,day=routineTime(state);
  const prior=state.npcs.find(person=>person.status==='alive'&&!person.tags.includes(PLAYER_ROW_TAG)
   &&person.cultivation.realmOrdinal<13&&!person.factionId)!;
  expect(prior).toBeDefined();
  const person={...setLocation(prior,from.id,day),activity:{kind:'idle' as const,note:'Setting out on their own road.',
   withIds:[],sinceDay:day,untilDay:null,standingIn:from.id+'#street#the-street'}};
  state.npcs[state.npcs.findIndex(one=>one.id===person.id)]=person;
  const journey=startNpcJourney(state,person,town.id,day,'Travelling to the ford.');
  expect(journey.activity?.kind).toBe('travelling');
  expect(journey.activity?.withIds).not.toContain(now.cultivator.id);
  state.npcs[state.npcs.findIndex(one=>one.id===person.id)]=journey;h.game.theWorldMoved();
  expect(h.game.present(h.game.currentRun().cultivator).some(one=>one.id===person.id)).toBe(false);
  const before=h.game.currentRun().run.elapsedDays;
  plans.push(JSON.stringify({action:'wait',days:.5}));
  const waited=await h.game.act('I wait here for half a day.');
  expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(before);
  expect(waited.narration,JSON.stringify(waited.toolCalls)).toContain('Another traveller is here on this road.');
  expect(stoppedRoadFor(h.db,h.game.currentRun().cultivator,h.game.atHand)?.position).toEqual(held.position);
  expect(h.game.present(h.game.currentRun().cultivator).some(one=>one.id===person.id)).toBe(true);
  const descriptor=h.game.reachFrom(h.game.currentRun().cultivator).find(one=>one.id===person.id)?.alsoCalled
   .find(said=>h.game.somebodyAtHand(said,h.game.currentRun().cultivator)?.id===person.id);
  expect(descriptor).toBeTruthy();expect(waited.narration).not.toContain(person.name);
  plans.push(JSON.stringify({action:'interact',target:descriptor,intent:'talk',topic:'hello'}));
  const greeting=await h.game.act('I greet '+descriptor+' passing along the road.');
  expect(greeting.toolCalls.some(call=>call.name==='engine.askedAbout'&&call.ok
   &&call.summary.startsWith('Asked '+person.name+' about ')),JSON.stringify(greeting.toolCalls)).toBe(true);
  expect(h.game.whoIsWithYouOnTheRoad(h.game.currentRun().cultivator).some(one=>one.id===person.id)).toBe(false);
  expect(stoppedRoadFor(h.db,h.game.currentRun().cultivator,h.game.atHand)?.position).toEqual(held.position);
  plans.push(JSON.stringify({action:'wait',days:.125}));await h.game.act('I remain here for three more hours.');
  expect(stoppedRoadFor(h.db,h.game.currentRun().cultivator,h.game.atHand)?.position).toEqual(held.position);
 }finally{h.db.close();}
},120000);
