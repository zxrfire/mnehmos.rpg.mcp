/** Diagnostic72306 measured one day of a four-day B→midpoint edge followed by
 * a new A target priced at four rather than the actual seven. The actual actor
 * and fight were valid interruptions. These controls arrange that admitted
 * historical edge explicitly, then use the real front door without suppressing
 * any occasion. A stopped act must retain its physical cursor; a completed act
 * must consume the entire seven-day continuation. SQL reopening must retain
 * the same geometry. A coarse corridor label grants no endpoint room or crowd.
 * The pure sibling proves quiet/asymmetric/closed geometry; this file does not
 * demand that seven days of actual play be quiet. Diagnostic76661 later observed elapsed0 and knowledge.canPointAt refusal for an
 * accepted 3.875/4-day continuation. Only that admitted destination may bypass
 * fresh route learning; another supplied name still needs its own route.
 */
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { GameService } from '../../src/web/game.js';
import { DeterministicNarrator } from '../../src/web/narrator.js';
import { makeLocation, linkLocations, walkingRouteFrom } from '../../src/engine/world/locations.js';
import { positionOnRoad, roadContinuationTo, positionAfterRoadContinuation, sameRoadPosition } from '../../src/engine/world/road-course.js';
import { stoppedRoadFor, betweenRoadEndpoints, FLAG_ROAD_STOPPED } from '../../src/web/a-road-stopped-partway.js';
import { writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { roadPositionOfNpc, ROUTE_STOP, journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { prepareWorldClockForPreciseSpan, saveWorldForRun, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { theRestOfThisPlace } from '../../src/web/walking-across-a-place.js';
import { whereFoodComesFromHere } from '../../src/web/where-food-is-sold.js';

async function fixture(walked=1) {
    const {game,db}=await makeGameInWorld({seed:'cursor-admitted-edge',worldSeed:'cursor-admitted-edge-world'});
    await game.newRun('Walker');
    game.atHand=await prepareWorldClockForPreciseSpan(game.currentRun().run,game.currentRun().cultivator);
    const world=game.atHand!;
    const a=makeLocation({id:'cursor-a',name:'Old departure',kind:'settlement'});
    const m=makeLocation({id:'cursor-m',name:'Wayside clearing',kind:'settlement',tags:[ROUTE_STOP]});
    const b=makeLocation({id:'cursor-b',name:'Far destination',kind:'settlement'});
    linkLocations(a,m,'road',4);linkLocations(m,b,'road',4);
    world.locations=[a,m,b]; world.npcs=[]; world.factions=[]; world.objects=[]; world.schedule=[];
    const me=game.currentRun().cultivator;
    game.repos.cultivators.update(me.id,{location:m.name,realmOrdinal:20,hp:1000,maxHp:1000,spiritStones:5000});
    game.repos.cultivators.standIn(me.id,null);
    writeFlag(db,me.id,'rations_held','30');
    const position=positionOnRoad(walkingRouteFrom(world.locations,b.id,m.id)!,walked);
    writeFlag(db,me.id,FLAG_ROAD_STOPPED,JSON.stringify({to:m.name,from:m.name,road:4,walked,position}));
    // This is an explicit pre-existing admitted cursor, not a claim that a prior
    // front-door action completed quietly or that a displayed corridor was reached.
    game.noteEncounter(game.currentRun().cultivator,game.currentRun().run,
        {kind:'place',id:a.name,name:a.name},'told','The onward road is known.');
    game.theWorldMoved();
    return {game,db,world,a,m,b,position};
}

it('prices seven from the actual edge and commits only the real interrupted or completed span',async()=>{
    const {game,world,a,position}=await fixture();
    const before=game.currentRun();
    expect(game.daysOnTheRoadTo(before.cultivator,a.name)).toBe(7);
    const course=roadContinuationTo(world.locations,position,a.id)!;
    const result=await game.act(`I travel to ${a.name}`);
    const after=game.currentRun(),elapsed=after.run.elapsedDays-before.run.elapsedDays;
    const cursor=stoppedRoadFor(game.db,after.cultivator);
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(journeyTimeHasReached(7,elapsed)).toBe(true);
    if(cursor) {
        expect(cursor.road).toBe(7);
        expect(sameRoadPosition(cursor.position??null,positionAfterRoadContinuation(course,elapsed))).toBe(true);
        expect(after.cultivator.location).not.toBe(a.name);
        expect(result.toolCalls.some(call=>call.name==='engine.encounterWindow')).toBe(true);
    } else {
        expect(after.cultivator.alive).toBe(true);
        expect(after.cultivator.location).toBe(a.name);
        expect(journeyTimeHasReached(elapsed,7)).toBe(true);
    }
},120_000);

it('a matched independently dated traveller is reachable before endpoint residents can fill the three-person cap',async()=>{
    const {game,world,m,b,position}=await fixture();
    const now=routineTime(world);
    const traveller=createNpc(world.seed,{id:'cursor-traveller',name:'Passing merchant',locationId:b.id,
        onDay:now-1,bornOnDay:now-20*365,occupation:'merchant'});
    traveller.activity={kind:'travelling',fromLocationId:b.id,returnTo:m.id,sinceDay:now-1,untilDay:now+3,
        withIds:[],note:'Taking wares to the clearing.'};
    const residents=Array.from({length:6},(_,i)=>createNpc(world.seed,{id:`cursor-resident-${i}`,
        name:`Clearing resident ${i}`,locationId:m.id,onDay:now,bornOnDay:now-20*365}));
    world.npcs=[...residents,traveller];
    expect(sameRoadPosition(position,roadPositionOfNpc(world.locations,traveller,now))).toBe(true);
    const present=game.present(game.currentRun().cultivator);
    expect(present.map(row=>row.id)).toContain(traveller.id);
    expect(present.length).toBeLessThanOrEqual(3);
    for(const row of residents)expect(present.map(person=>person.id)).not.toContain(row.id);
    expect(game.worldPlaceOf(game.currentRun().cultivator)).toBeNull();
    expect(theRestOfThisPlace(game,game.currentRun().cultivator)).toEqual([]);
    expect(whereFoodComesFromHere(game,game.currentRun().cultivator).sold).toBe(false);
    expect(betweenRoadEndpoints(game.db,game.currentRun().cultivator)).toBe(true);
    const beforeRoom = game.currentRun();
    await game.act('I travel to clinic');
    expect(game.currentRun().cultivator.standingIn).toBeNull();
    expect(stoppedRoadFor(game.db,game.currentRun().cultivator)?.position).toEqual(position);
    expect(game.currentRun().run.elapsedDays).toBe(beforeRoom.run.elapsedDays);
    // The same independent itinerary has left this fraction three hours later.
    expect(sameRoadPosition(position,roadPositionOfNpc(world.locations,traveller,now+.125))).toBe(false);
},120_000);

it('fractional same-target progress costs its actual remaining eighth-day instead of local instant entry',async()=>{
    const {game,m}=await fixture(3.875),before=game.currentRun();
    expect(game.daysOnTheRoadTo(before.cultivator,m.name)).toBe(.125);
    const result=await game.act(`I travel to ${m.name}`);
    const after=game.currentRun(),elapsed=after.run.elapsedDays-before.run.elapsedDays;
    const cursor=stoppedRoadFor(game.db,after.cultivator);
    if(cursor) {
        expect(journeyTimeHasReached(.125,elapsed)).toBe(true);
        expect(result.toolCalls.some(call=>call.name==='engine.encounterWindow')).toBe(true);
        expect(betweenRoadEndpoints(game.db,after.cultivator)).toBe(true);
    } else {
        expect(after.cultivator.alive).toBe(true);
        expect(journeyTimeHasReached(elapsed,.125)).toBe(true);
        expect(journeyTimeHasReached(.125,elapsed)).toBe(true);
        expect(after.cultivator.location).toBe(m.name);
        expect(game.worldPlaceOf(after.cultivator)).toBe(m.id);
    }
},120_000);

it('reopening the actual database retains the one cursor and never guesses a missing legacy origin',async()=>{
    const {game,db,a,m,position}=await fixture();
    await saveWorldForRun(game.currentRun().run);
    const copy=new Database(db.serialize());resetCultivationWorlds();
    const reopened=new GameService({db:copy,narrator:new DeterministicNarrator(),worldEnabled:true});
    reopened.atHand=await reopened.loadWorld();
    expect(stoppedRoadFor(copy,reopened.currentRun().cultivator)?.position).toEqual(position);
    expect(reopened.daysOnTheRoadTo(reopened.currentRun().cultivator,a.name)).toBe(7);
    const old=stoppedRoadFor(copy,reopened.currentRun().cultivator)!;
    writeFlag(copy,reopened.currentRun().cultivator.id,FLAG_ROAD_STOPPED,JSON.stringify({...old,position:undefined}));
    expect(reopened.daysOnTheRoadTo(reopened.currentRun().cultivator,a.name)).toBeNull();
    expect(reopened.daysOnTheRoadTo(reopened.currentRun().cultivator,m.name)).toBe(3);
    const before=reopened.currentRun();
    const refused=await reopened.act(`I travel to ${a.name}`);
    expect(refused.toolCalls.some(call=>call.name==='engine.roadOriginUnknown')).toBe(true);
    expect(reopened.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
    copy.close();db.close();resetCultivationWorlds();
},120_000);

it('engine-only geometry cannot invent a vertex for a follower whose leader cursor is held by SQL',async()=>{
    const {game,world,m}=await fixture();const now=routineTime(world);
    const npc=createNpc(world.seed,{id:'cursor-follower',name:'Following merchant',locationId:m.id,
        onDay:now,bornOnDay:now-20*365});
    npc.activity={kind:'out_with_a_party',withIds:[game.currentRun().cultivator.id],sinceDay:now,
        untilDay:now+4,returnTo:m.id,note:'Travelling together.'};
    world.npcs=[npc];
    expect(roadPositionOfNpc(world.locations,npc,now)).toBeNull();
    expect(game.present(game.currentRun().cultivator).map(row=>row.id)).toContain(npc.id);
},120_000);

/** Integrated ground21 regression observed elapsed0 and knowledge.canPointAt
 * refusal for an already admitted 3.875/4-day course. The road's acceptance
 * authorises only its existing target; it teaches no route and cannot supply
 * another historical origin. The earlier fractional front-door control stays
 * unchanged and is the positive regression oracle. */
it('an admitted partial road grants no route to a newly named destination',async()=>{
    const {game,world,m,position}=await fixture(3.875);
    const c=makeLocation({id:'cursor-unknown',name:'Willow ferry',kind:'settlement'});
    linkLocations(m,c,'road',2);world.locations.push(c);
    const before=game.currentRun();
    const result=await game.act(`I travel to ${c.name}`);
    expect(result.toolCalls.some(call=>call.name==='knowledge.canPointAt'&&!call.ok)).toBe(true);
    expect(game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
    expect(stoppedRoadFor(game.db,game.currentRun().cultivator)?.position).toEqual(position);
    expect(game.canPointAtLocation(game.currentRun().cultivator,c)).toBe(false);
},120_000);

it('legacy missing-origin continuation cannot invent a route to another supplied name',async()=>{
    const {game,world,m}=await fixture(3.875);
    const old=stoppedRoadFor(game.db,game.currentRun().cultivator)!;
    writeFlag(game.db,game.currentRun().cultivator.id,FLAG_ROAD_STOPPED,JSON.stringify({...old,position:undefined}));
    const c=makeLocation({id:'cursor-legacy-unknown',name:'Reed village',kind:'settlement'});
    linkLocations(m,c,'road',2);world.locations.push(c);
    const before=game.currentRun();
    const result=await game.act(`I travel to ${c.name}`);
    expect(result.toolCalls.some(call=>call.name==='knowledge.canPointAt'&&!call.ok)).toBe(true);
    expect(game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
    expect(stoppedRoadFor(game.db,game.currentRun().cultivator)?.walked).toBe(old.walked);
    expect(stoppedRoadFor(game.db,game.currentRun().cultivator)?.position).toBeUndefined();
    expect(game.canPointAtLocation(game.currentRun().cultivator,c)).toBe(false);
},120_000);