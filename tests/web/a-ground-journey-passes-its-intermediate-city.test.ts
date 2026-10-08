/** Oct7 actual-source audit found that foot cursor and actual carriage driver
 * project canonical routes, but clock deadlines held only encounter/contact and
 * final arrival dates. A quiet portion could skip a fractional intermediate city.
 * These native controls pin the full world/run, then arrange a sparse A→B→C
 * graph. Observers call the ORIGINAL world advance and only read actual SQL,
 * cursor/driver and service eligibility; no resolver or outcome is replaced.
 * The foot fixture resumes an explicitly accepted zero-progress course, so its
 * historical departure occasion is not replayed. Carriage uses real quotation,
 * accepted ordinary driver/hull, fare debit and existing passHours continuation.
 * A real dated driver expiry at B tests interruption and parked custody there.
 * Vertex deadlines add no encounter checks or mandatory intermediate action.
 * Direct airborne geometry/innate flight remain a separate unresolved gap.
 * Candidate is unrun; no seed outcome or model acceptance is claimed.
 */
import { expect, it, vi } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { prepareWorldClockForPreciseSpan, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { makeLocation, linkLocations, walkingRouteFrom } from '../../src/engine/world/locations.js';
import { journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { roadVertexMoments, positionOnRoad } from '../../src/engine/world/road-course.js';
import { makeScheduledEffect } from '../../src/engine/world/world-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { stoppedRoadFor, FLAG_ROAD_STOPPED, betweenRoadEndpoints } from '../../src/web/a-road-stopped-partway.js';
import { whereFoodComesFromHere } from '../../src/web/where-food-is-sold.js';
import { createNpc, PLAYER_ROW_TAG } from '../../src/engine/world/npc-state.js';
import { quotePublicCarriage, commitPublicCarriage, publicCarriagePassage } from '../../src/engine/world/public-carriages.js';
import { keepThePaidCarriage, thePaidCarriageClaim } from '../../src/web/a-paid-carriage-on-the-road.js';
import { passHours } from '../../src/web/routine-invitations.js';

async function arrangement() {
    const h = await makeGameInWorld({ seed: 'ground-vertex-run', worldSeed: 'ground-vertex-world' });
    await h.game.newRun('Ground traveller');
    h.game.atHand = await prepareWorldClockForPreciseSpan(h.game.currentRun().run, h.game.currentRun().cultivator);
    const world = h.game.atHand!;
    const a = makeLocation({ id: 'ground-a', name: 'Outer village', kind: 'settlement' });
    const b = makeLocation({ id: 'ground-b', name: 'Middle market', kind: 'settlement' });
    const c = makeLocation({ id: 'ground-c', name: 'Further city', kind: 'settlement' });
    linkLocations(a,b,'road',.3125); linkLocations(b,c,'road',.4375);
    world.locations=[a,b,c]; world.npcs=[]; world.factions=[]; world.objects=[]; world.schedule=[];
    const me=h.game.currentRun().cultivator;
    h.repos.cultivators.update(me.id,{location:a.name,standingIn:null,realmOrdinal:20,
        hp:1000,maxHp:1000,satiety:100,spiritStones:5000});
    writeFlag(h.db,me.id,'rations_held','30');
    h.game.noteEncounter(h.game.currentRun().cultivator,h.game.currentRun().run,
        {kind:'place',id:c.name,name:c.name},'told','The actual chain of roads is known.');
    h.game.theWorldMoved();
    return {...h,world,a,b,c,me,departure:routineTime(world)};
}

it('quiet foot continuation reaches the actual intermediate market before the destination, without a new action',async()=>{
    const h=await arrangement();const {game,world,a,b,c,departure}=h;
    try {
        const before=game.currentRun(), route=walkingRouteFrom(world.locations,a.id,c.id)!;
        expect(route.map(stop=>stop.locationId)).toEqual([a.id,b.id,c.id]);
        writeFlag(h.db,before.cultivator.id,FLAG_ROAD_STOPPED,JSON.stringify({
            from:a.name,to:c.name,road:.75,walked:0,position:positionOnRoad(route,0),
            acceptedMoment:{runId:before.run.id,elapsedDays:before.run.elapsedDays,boardedOnDay:departure}}));
        // A real dated harmless world appointment exposes an earlier mid-edge
        // read; it neither replaces encounters nor forces their outcomes.
        world.schedule.push(makeScheduledEffect({id:'ground-earlier-clock',kind:'custom',
            dueOnDay:departure+.125,summary:'An arranged earlier world appointment.',interrupts:false}));
        const visits:{day:number;ground:string|null;vertex:string|null;sold:boolean}[]=[];
        const advance=game.advanceWorld.bind(game);
        vi.spyOn(game,'advanceWorld').mockImplementation(async(...args)=>{
            const report=await advance(...args), body=game.currentRun().cultivator;
            const cursor=stoppedRoadFor(h.db,body);
            visits.push({day:routineTime(game.atHand!),ground:body.location,
                vertex:cursor?.position?.kind==='place'?cursor.position.locationId:null,
                sold:whereFoodComesFromHere(game,body).sold});
            return report;
        });
        const result=await game.act('I travel to '+c.name);
        expect(result.toolCalls.some(call=>!call.ok),JSON.stringify(result.toolCalls)).toBe(false);
        const between=visits.find(row=>journeyTimeHasReached(row.day,departure+.125)&&journeyTimeHasReached(departure+.125,row.day));
        expect(between,JSON.stringify(visits)).toBeDefined();
        expect(between!.vertex).toBeNull();expect(between!.sold).toBe(false);
        const atB=visits.find(row=>row.vertex===b.id);
        expect(atB,JSON.stringify(visits)).toBeDefined();
        expect(atB!.day-departure).toBeCloseTo(.3125,12);
        expect(atB!.ground).toBe(b.name);expect(atB!.sold).toBe(true);
        expect(game.currentRun().cultivator.location).toBe(c.name);
        expect(game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(.75,12);
        expect(game.currentRun().run.turn).toBe(before.run.turn+1);
        expect(stoppedRoadFor(h.db,game.currentRun().cultivator)).toBeNull();
    } finally {vi.restoreAllMocks();h.db.close();resetCultivationWorlds();}
},120_000);

async function boarding() {
    const h=await arrangement();const {game,world,a,c,me}=h;
    world.npcs=[createNpc(world.seed,{id:me.id,name:me.name,onDay:routineTime(world),
        bornOnDay:routineTime(world)-20*365,locationId:null,tags:[PLAYER_ROW_TAG]})];
    const quote=quotePublicCarriage(world,{fromId:a.id,toId:c.id,day:routineTime(world),
        conveyanceId:'conv-carriage-mortal',passengerIds:[me.id],fareStones:3,hired:false,
        playedPassenger:{id:me.id,locationId:a.id,alive:true}})!;
    expect(quote).not.toBeNull();const receipt=commitPublicCarriage(world,quote)!;
    expect(receipt).not.toBeNull();game.repos.cultivators.applyDeltas(me.id,{spiritStones:-quote.fareStones});
    keepThePaidCarriage(h.db,me.id,receipt.id);game.theWorldMoved();
    const route=walkingRouteFrom(world.locations,a.id,c.id)!;
    const middleOn=roadVertexMoments(route,quote.departureDay,quote.arrivalDay-quote.departureDay)[0]!;
    return {...h,quote,receipt,middleOn};
}

it('a quiet paid carriage physically carries its passenger through B before C on the same fare and hull',async()=>{
    const h=await boarding();const {game,b,c,quote,receipt,middleOn}=h;
    try {
        const before=game.currentRun();const visits:{day:number;body:string|null;driver:string|null}[]=[];
        const advance=game.advanceWorld.bind(game);
        vi.spyOn(game,'advanceWorld').mockImplementation(async(...args)=>{
            const report=await advance(...args), day=routineTime(game.atHand!);
            const passage=publicCarriagePassage(game.atHand!,receipt.id,h.me.id,day);
            visits.push({day,body:game.currentRun().cultivator.location,driver:passage?.locationId??null});return report;
        });
        const spent=await passHours(game,before.run,before.cultivator,(quote.arrivalDay-quote.departureDay)*24);
        expect(spent.finished,JSON.stringify(spent.spent)).toBe(true);
        const visit=visits.find(row=>row.driver===b.id);
        expect(visit,JSON.stringify(visits)).toBeDefined();expect(visit!.day).toBeCloseTo(middleOn,12);
        expect(visit!.body).toBe(b.name);expect(game.currentRun().cultivator.location).toBe(c.name);
        expect(game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(game.currentRun().run.turn).toBe(before.run.turn+1);
        expect(thePaidCarriageClaim(h.db,h.me.id)).toBeNull();
        expect(game.atHand!.history.facts.filter(f=>f.data.vesselId===quote.vesselId&&f.data.publicPassage===true)).toHaveLength(1);
    } finally {vi.restoreAllMocks();h.db.close();resetCultivationWorlds();}
},120_000);

it('actual driver expiry at B stops the paid span there, retaining its dated remaining course and parked hull',async()=>{
    const h=await boarding();const {game,b,c,world,quote,receipt,middleOn}=h;
    try {
        const driver=world.npcs.find(npc=>npc.id===quote.driverId)!;
        driver.cultivation.lifespanEndsOnDay=middleOn;
        const before=game.currentRun();
        const spent=await passHours(game,before.run,before.cultivator,(quote.arrivalDay-quote.departureDay)*24);
        expect(spent.finished).toBe(false);expect(spent.spent?.cutShort?.cause).toBe('the_world');
        expect(routineTime(game.atHand!)).toBeCloseTo(middleOn,12);
        expect(game.currentRun().cultivator.location).toBe(b.name);
        expect(game.currentRun().cultivator.location).not.toBe(c.name);
        expect(game.currentRun().run.elapsedDays-before.run.elapsedDays).toBeCloseTo(middleOn-quote.departureDay,12);
        expect(game.atHand!.objects.find(object=>object.id===quote.vesselId)?.locationId).toBe(b.id);
        expect(game.atHand!.npcs.some(npc=>npc.id===driver.id&&npc.status==='alive')).toBe(false);
        expect(thePaidCarriageClaim(h.db,h.me.id)).toBeNull();
        const fact=game.atHand!.history.facts.find(row=>row.id===receipt.id)!;
        expect(fact.data.arrivalDay).toBe(quote.arrivalDay);
        expect(quote.arrivalDay-middleOn).toBeGreaterThan(0);
        expect(game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(betweenRoadEndpoints(h.db,game.currentRun().cultivator)).toBe(false);
        expect(whereFoodComesFromHere(game,game.currentRun().cultivator).sold).toBe(true);
    } finally {h.db.close();resetCultivationWorlds();}
},120_000);
