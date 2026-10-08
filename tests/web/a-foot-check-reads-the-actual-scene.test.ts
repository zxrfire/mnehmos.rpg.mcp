/** Foot travel formerly reused its departure scene for every future check. The
 * actual native travel cadence has a three-day grid. This arrangement admits an
 * existing eight-day foot course at its real moment (so no new departure occurs)
 * and instruments, without replacing, the native iterator. At its first actual
 * grid check the player and independently dated traveller share the entered edge;
 * stationary origin/endpoint residents must not become its cast. No random draw,
 * horizon, actor or occurrence is suppressed. Same/new/unknown acceptance moments
 * are checked separately through the front door, retaining original-grid identity
 * only when it was actually recorded. Candidate controls have not been run.
 */
import { expect, it, vi } from 'vitest';
import { makeGameInWorld } from './harness.js';
import * as windows from '../../src/engine/encounters/window.js';
import { makeLocation, linkLocations } from '../../src/engine/world/locations.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { ROUTE_STOP, journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { FLAG_ROAD_STOPPED, stoppedRoadFor } from '../../src/web/a-road-stopped-partway.js';
import type { EncounterRollInput } from '../../src/engine/encounters/types.js';

async function arranged(momentKnown=true, walked=0) {
    const {game,db}=await makeGameInWorld({seed:'foot-current-phase',worldSeed:'foot-current-phase-world'});
    await game.newRun('Walking observer');
    game.atHand=await prepareWorldClockForPreciseSpan(game.currentRun().run,game.currentRun().cultivator);
    const world=game.atHand!, now=routineTime(world),run=game.currentRun().run;
    const a=makeLocation({id:'phase-a',name:'Near market',kind:'settlement'});
    const m=makeLocation({id:'phase-m',name:'Road clearing',kind:'wilds',tags:[ROUTE_STOP]});
    const b=makeLocation({id:'phase-b',name:'Far market',kind:'settlement'});
    const c=makeLocation({id:'phase-c',name:'Another market',kind:'settlement'});
    linkLocations(a,m,'road',4);linkLocations(m,b,'road',4);linkLocations(a,c,'road',5);
    world.locations=[a,m,b,c];world.npcs=[];world.factions=[];world.objects=[];world.schedule=[];
    const body=game.currentRun().cultivator;
    game.repos.cultivators.update(body.id,{location:a.name,standingIn:null,realmOrdinal:20,hp:1000,maxHp:1000,
        spiritStones:5000,sectId:null});
    writeFlag(db,body.id,'rations_held','30');
    const acceptedMoment={runId:run.id,elapsedDays:run.elapsedDays,boardedOnDay:now};
    writeFlag(db,body.id,FLAG_ROAD_STOPPED,JSON.stringify({from:a.name,to:b.name,road:8,walked,
        position:{kind:'place',locationId:a.id,originLocationId:a.id},
        ...(momentKnown?{acceptedMoment}:{})}));
    for(const to of [b,c])game.noteEncounter(game.currentRun().cultivator,run,
        {kind:'place',id:to.name,name:to.name},'told','The actual linked road is known.');
    game.theWorldMoved();
    return {game,db,world,a,m,b,c,now,acceptedMoment};
}

it('reads the currently matched dated traveller at the actual grid instead of departed or endpoint company',async()=>{
    const {game,db,world,a,m,b,now}=await arranged();
    try {
        const moving=createNpc(world.seed,{id:'phase-moving',name:'Moving merchant',locationId:a.id,
            onDay:now,bornOnDay:now-20*365,occupation:'merchant'});
        moving.activity={kind:'travelling',fromLocationId:a.id,returnTo:b.id,sinceDay:now,untilDay:now+8,
            withIds:[],note:'Taking wares to the far market.'};
        const origin=createNpc(world.seed,{id:'phase-origin',name:'Market resident',locationId:a.id,
            onDay:now,bornOnDay:now-20*365});
        const endpoint=Array.from({length:6},(_,i)=>createNpc(world.seed,{id:`phase-endpoint-${i}`,
            name:`Clearing resident ${i}`,locationId:m.id,onDay:now,bornOnDay:now-20*365}));
        world.npcs=[origin,...endpoint,moving];
        const native=windows.encountersAtChecks;
        const checked: {day:number;offset:number;bodyLocation:string|null;input:EncounterRollInput|undefined}[]=[];
        vi.spyOn(windows,'encountersAtChecks').mockImplementation(function*(input,options):ReturnType<typeof native>{
            expect(options?.departureOccasion).toBe(false);
            const held=native(input,options);let next=held.next();
            while(!next.done){
                const phase=next.value;
                const reply: EncounterRollInput|undefined=yield phase;
                if(phase.kind==='check')checked.push({day:routineTime(game.atHand!),offset:phase.dayOffset,
                    bodyLocation:game.currentRun().cultivator.location,input:reply});
                next=held.next(reply);
            }
            return next.value;
        });
        await game.act('I travel to '+b.name);
        expect(checked.length).toBeGreaterThan(0);
        const first=checked[0]!;
        expect(first.offset).toBe(3);
        expect(journeyTimeHasReached(first.day,now+3)).toBe(true);
        expect(journeyTimeHasReached(now+3,first.day)).toBe(true);
        expect(first.bodyLocation).toBe(m.name);
        expect(first.input?.cast?.map(person=>person.id)).toContain(moving.id);
        expect(first.input?.cast?.map(person=>person.id)).not.toContain(origin.id);
        for(const resident of endpoint)expect(first.input?.cast?.map(person=>person.id)).not.toContain(resident.id);
        expect(first.input?.cast?.length).toBeLessThanOrEqual(3);
        expect(game.currentRun().run.elapsedDays).toBeGreaterThanOrEqual(3);
    } finally {vi.restoreAllMocks();db.close();}
},120_000);

for(const kind of ['same','new','unknown'] as const)it('keeps '+kind+' course departure authority through the actual caller',async()=>{
    const {game,db,b,c,acceptedMoment}=await arranged(kind!=='unknown');
    try {
        const native=windows.encountersAtChecks;
        const admissions:{start:number;departure:boolean|undefined;after:number|undefined}[]=[];
        vi.spyOn(windows,'encountersAtChecks').mockImplementation(function*(input,options):ReturnType<typeof native>{
            admissions.push({start:input.startDay,departure:options?.departureOccasion,after:options?.afterDay});
            const held=native(input,options);let next=held.next();while(!next.done){
                const reply:EncounterRollInput|undefined=yield next.value;next=held.next(reply);
            }return next.value;
        });
        await game.act('I travel to '+(kind==='new'?c.name:b.name));
        expect(admissions.length).toBe(1);
        expect(admissions[0]!.departure).toBe(kind==='new');
        expect(admissions[0]!.start).toBe(Math.floor(acceptedMoment.elapsedDays));
        // Any genuine interruption retains its recorded known admission; unknown
        // legacy remains unknown, and no geometry/date is reconstructed from it.
        const cursor=stoppedRoadFor(db,game.currentRun().cultivator);
        if(cursor)expect(cursor.acceptedMoment).toEqual(kind==='unknown'?undefined:acceptedMoment);
    } finally {vi.restoreAllMocks();db.close();}
},120_000);

/** Actual committed boundaries may relocate the body or install a different
 * course. The old arrival tail used to re-anchor its cursor at that new place,
 * or announce its old destination after a fully consumed final fraction. These
 * additive controls wrap the real world advance (never replace its result), then
 * apply a selected SQL consequence at that boundary. Body/food/time already
 * committed by native mechanics must survive; no old target arrival is granted.
 * Red plan: remove only the fresh tail guard, retaining the boundary fixture.
 */
for(const kind of ['partial','final','replacement'] as const)it('preserves actual '+kind+' boundary relocation instead of restoring the departed course',async()=>{
    const {game,db,a,m,b,c,now,acceptedMoment}=await arranged();
    try {
        if(kind==='final') {
            game.repos.cultivators.update(game.currentRun().cultivator.id,{location:m.name});
            writeFlag(db,game.currentRun().cultivator.id,FLAG_ROAD_STOPPED,JSON.stringify({from:m.name,to:b.name,
                road:8,walked:7.875,acceptedMoment,
                position:{kind:'edge',originLocationId:a.id,fromId:m.id,toId:b.id,fraction:31/32,admittedDays:4}}));
        }
        const nativeAdvance=game.advanceWorld.bind(game);
        let committed:ReturnType<typeof game.currentRun>|null=null;
        let replacement:ReturnType<typeof stoppedRoadFor>=null;
        let stockAtBoundary: number|undefined;
        vi.spyOn(game,'advanceWorld').mockImplementation(async(...args)=>{
            const report=await nativeAdvance(...args);
            if(!committed) {
                game.repos.cultivators.update(game.currentRun().cultivator.id,{location:c.name,standingIn:null});
                game.repos.cultivators.applyDeltas(game.currentRun().cultivator.id,{hp:-7,spiritStones:-11});
                game.repos.cultivators.addInjury(game.currentRun().cultivator.id,{severity:'minor',
                    source:'other',description:'A wound sustained at the actual boundary.',
                    sustainedOnTurn:game.currentRun().run.turn});
                if(kind==='replacement') {
                    writeFlag(db,game.currentRun().cultivator.id,FLAG_ROAD_STOPPED,JSON.stringify({from:c.name,to:a.name,
                        road:5,walked:0,position:{kind:'place',locationId:c.id,originLocationId:c.id}}));
                    replacement=stoppedRoadFor(db,game.currentRun().cultivator);
                }
                committed=game.currentRun();stockAtBoundary=game.rationsHeld(committed.cultivator);
            }
            return report;
        });
        const before=game.currentRun();
        const result=await game.act('I travel to '+b.name);
        expect(committed).not.toBeNull();
        const atBoundary=committed! as ReturnType<typeof game.currentRun>;
        const after=game.currentRun();
        expect(after.cultivator.location).toBe(c.name);
        expect(after.cultivator.standingIn).toBeNull();
        expect(after.cultivator.age).toBe(atBoundary.cultivator.age);
        expect(after.cultivator.hp).toBe(atBoundary.cultivator.hp);
        expect(after.cultivator.injuries).toEqual(atBoundary.cultivator.injuries);
        expect(after.cultivator.satiety).toBe(atBoundary.cultivator.satiety);
        expect(game.rationsHeld(after.cultivator)).toBe(stockAtBoundary);
        expect(after.cultivator.spiritStones).toBe(atBoundary.cultivator.spiritStones);
        expect(after.run.elapsedDays).toBe(atBoundary.run.elapsedDays);
        expect(after.run.elapsedDays).toBeGreaterThan(before.run.elapsedDays);
        expect(result.toolCalls.some(call=>call.name==='cultivator.update'&&call.summary.includes('Location set to'))).toBe(false);
        expect(result.toolCalls.some(call=>call.name==='engine.encounterWindow'
            &&call.summary.includes('replacement course ended'))).toBe(true);
        expect(stoppedRoadFor(db,after.cultivator)).toEqual(kind==='replacement'?replacement:null);
        if(kind==='final') {
            expect(journeyTimeHasReached(after.run.elapsedDays-before.run.elapsedDays,.125)).toBe(true);
            expect(journeyTimeHasReached(.125,after.run.elapsedDays-before.run.elapsedDays)).toBe(true);
        } else expect(journeyTimeHasReached(now+8,routineTime(game.atHand!))).toBe(true);
    } finally {vi.restoreAllMocks();db.close();}
},120_000);
