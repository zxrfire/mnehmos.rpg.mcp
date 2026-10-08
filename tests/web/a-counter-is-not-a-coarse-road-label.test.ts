/** An unfinished road cursor can use a landing/station's name as its coarse
 * SQL display label. The public board previously read that label directly,
 * advertised its endpoint lines and could debit/mint a passage before the body
 * reached the counter. The native road-world/road-5 opening advertises a genuine
 * carriage service; these controls first ask that actual board for its line, then
 * arrange an admitted partial edge at that same real place. No fare or service is
 * invented. Its passing actor is independently dated, not a stationary prop.
 * Database reopening must retain the guard, while a true reached vertex keeps
 * the same advertised service. Red plan: remove only the board/action edge guard.
 * Foot11 native run passed the geometry/scene/relocation controls but failed
 * these two counter scenes. Diagnostic01 proved the actor already occupied the
 * capped #here area while the observer still held an endpoint market-area id.
 * Present must derive its fallback from the cursor-filtered areas, retaining any
 * genuinely accepted area in that read; it must not redraw endpoint areas.
 * Native repaired controls and the narrow red arm remain pending.
 */
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { makeGameInWorld } from './harness.js';
import { GameService } from '../../src/web/game.js';
import { DeterministicNarrator } from '../../src/web/narrator.js';
import { makeLocation, linkLocations } from '../../src/engine/world/locations.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { ROUTE_STOP } from '../../src/engine/world/places-on-the-way.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { prepareWorldClockForPreciseSpan, saveWorldForRun, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { stoppedRoadFor, betweenRoadEndpoints, FLAG_ROAD_STOPPED } from '../../src/web/a-road-stopped-partway.js';
import { whatRunsFromHere, theBoothsHere } from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';

async function fixture() {
    const {game,db}=await makeGameInWorld({seed:'road-5',worldSeed:'road-world'});
    await game.newRun('Actual station visitor');
    game.atHand=await prepareWorldClockForPreciseSpan(game.currentRun().run,game.currentRun().cultivator);
    const world=game.atHand!,body=game.currentRun().cultivator,now=routineTime(world);
    const line=whatRunsFromHere(game,body,now).find(row=>row.service==='carriage');
    expect(line).toBeDefined();
    const endpoint=world.locations.find(row=>row.name===body.location)!;
    expect(endpoint).toBeDefined();
    // It remains the actual advertised endpoint. The adjacent corridor marker
    // chooses this coarse label while geometry still explicitly says edge.
    endpoint.tags.push(ROUTE_STOP);
    const origin=makeLocation({id:'counter-approach',name:'Station approach',kind:'wilds'});
    linkLocations(origin,endpoint,'road',4);world.locations.push(origin);
    const traveller=createNpc(world.seed,{id:'counter-moving',name:'Passing merchant',locationId:origin.id,
        onDay:now-1,bornOnDay:now-20*365,occupation:'merchant'});
    traveller.activity={kind:'travelling',fromLocationId:origin.id,returnTo:endpoint.id,
        sinceDay:now-1,untilDay:now+3,withIds:[],note:'Taking wares to the station.'};
    world.npcs=[traveller];world.schedule=[];
    game.repos.cultivators.update(body.id,{standingIn:null,spiritStones:5000});
    const cursor={from:endpoint.name,to:endpoint.name,road:4,walked:1,
        position:{kind:'edge',originLocationId:origin.id,fromId:origin.id,toId:endpoint.id,fraction:.25,admittedDays:4}};
    writeFlag(db,body.id,FLAG_ROAD_STOPPED,JSON.stringify(cursor));game.theWorldMoved();
    return {game,db,world,endpoint,origin,traveller,line:line!,cursor};
}

for(const reopen of [false,true])it('an '+(reopen?'SQL-reopened':'active')+' unfinished edge cannot read or buy its unreached endpoint counter',async()=>{
    const arranged=await fixture();let {game,db}=arranged;let copy:Database.Database|undefined;
    try {
        if(reopen) {
            await saveWorldForRun(game.currentRun().run);copy=new Database(db.serialize());resetCultivationWorlds();
            game=new GameService({db:copy,narrator:new DeterministicNarrator(),worldEnabled:true});
            game.atHand=await game.loadWorld();db=copy;
        }
        const before=game.currentRun(),objects=game.atHand!.objects.map(row=>row.id);
        const passages=game.atHand!.history.facts.filter(fact=>fact.data.publicPassage===true).map(fact=>fact.id);
        expect(betweenRoadEndpoints(db,before.cultivator)).toBe(true);
        expect(whatRunsFromHere(game,before.cultivator,routineTime(game.atHand!))).toEqual([]);
        expect(theBoothsHere(game,before.cultivator)).toEqual([]);
        expect(game.present(before.cultivator).map(person=>person.id)).toContain(arranged.traveller.id);
        for(const said of ['what carriages are there','I book a carriage to '+arranged.line.to]) {
            const result=await game.act(said);
            expect(result.toolCalls.some(call=>call.name==='engine.passageCounterReach')).toBe(true);
            expect(result.narration).toMatch(/landing or station has not been reached|between road endpoints/i);
            expect(game.currentRun().cultivator.location).toBe(before.cultivator.location);
            expect(game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
            expect(game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
            expect(stoppedRoadFor(db,game.currentRun().cultivator)).toEqual(arranged.cursor);
        }
        expect(game.atHand!.objects.map(row=>row.id)).toEqual(objects);
        expect(game.atHand!.history.facts.filter(fact=>fact.data.publicPassage===true).map(fact=>fact.id)).toEqual(passages);
        expect(game.present(game.currentRun().cultivator).map(person=>person.id)).toContain(arranged.traveller.id);
    } finally {copy?.close();arranged.db.close();resetCultivationWorlds();}
},120_000);

it('a reached advertised wayside vertex retains its ordinary public board',async()=>{
    const {game,db,endpoint,origin,line,cursor}=await fixture();
    try {
        writeFlag(db,game.currentRun().cultivator.id,FLAG_ROAD_STOPPED,JSON.stringify({...cursor,walked:4,
            position:{kind:'place',locationId:endpoint.id,originLocationId:origin.id}}));
        expect(betweenRoadEndpoints(db,game.currentRun().cultivator)).toBe(false);
        expect(whatRunsFromHere(game,game.currentRun().cultivator,routineTime(game.atHand!)))
            .toContainEqual(line);
        const result=await game.act('what carriages are there');
        expect(result.toolCalls.some(call=>call.name==='engine.passageCounterReach')).toBe(false);
        expect(result.narration).toContain(line.to);
        expect(game.currentRun().cultivator.location).toBe(endpoint.name);
    } finally {db.close();}
},120_000);
