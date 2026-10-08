/** Oct7 owner: ALL BUILT means a venue can actually be reached, addressed,
 * quoted, paid and used. Earlier web keepers came from a capped current-area
 * roster, while physical workers stayed in market/street areas. A label did
 * not make that clerk exist. These native controls select actual opening work
 * and canonical routes, arrange only the player, then use ordinary played acts.
 * Counter work and addressed identity derive from one deal. No new worker,
 * personal spatial capability, free name or guaranteed attendance is arranged.
 * Paid folding is the institution's surveyed service, not the clerk's rung.
 * Existing unavailable-ticket controls remain dependencies of this package.
 * Root native run70039 (2026-10-07): all four controls passed actual reach,
 * address, directions, fare, arrival and empty-counter guards; compiler63495
 * had zero errors. Scripted intents/prose are native proof, not live model
 * narration acceptance. Paired12175 then found5 baseline inn passes became5
 * failures because repository-only listeners were lost; successor08 repairs
 * that path without licensing off-duty world actors. Broader inn checks pending.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider, refusedCall } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { publicCountersAt, publicTransportFrom, type PublicHubKind } from '../../src/engine/world/public-transport-at-a-place.js';
import { workersAtPublicCounters } from '../../src/engine/world/who-is-working-at-a-public-counter.js';
import { npcsStandingIn } from '../../src/engine/world/where-inside-a-house-somebody-is-standing.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { whoKeepsTheCounter } from '../../src/web/who-keeps-a-counter-here.js';
import { prepareWorldClockForPreciseSpan } from '../../src/server/state/cultivation-world.js';
import { routesFrom } from '../../src/engine/world/where-the-measured-span-still-answers.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { FALSE_IMMORTAL_ORDINAL } from '../../src/engine/cultivation/realms.js';
const description: Record<PublicHubKind,string> = { landing:'the landing clerk', carriage_station:'the station clerk', span_counter:'the folding attendant' };
async function fixture() {
    const plans: string[] = [];
    const provider = new ScriptedProvider({ plans, narrations:['The actual engine result is shown.'] });
    const h = await makeGameInWorld({ seed:'guided-route', worldSeed:'road-world', worldEnabled:true,
        narrator:new ProviderNarrator(provider,{model:'test-model',timeoutMs:5000}) });
    await h.game.newRun('A counter visitor');
    const native=h.game.currentRun();
    // An ordinary strong body and an actual purse, not an outcome or knowledge grant.
    h.repos.cultivators.update(native.cultivator.id,{ realmOrdinal:FALSE_IMMORTAL_ORDINAL, spiritStones:5000 });
    h.game.atHand=await prepareWorldClockForPreciseSpan(h.game.currentRun().run,h.game.currentRun().cultivator);
    if(!h.game.atHand)throw Error('Native counter world missing');
    // Native clock arrangement, never a rewind or worker teleport. Starting a
    // six-hour local walk at nine reaches the ordinary afternoon work period.
    const now=routineTime(h.game.atHand);
    const nextNine=Math.floor(now)+(now%1<9/24?0:1)+9/24;
    const waited=await passHours(h.game,h.game.currentRun().run,h.game.currentRun().cultivator,(nextNine-now)*24);
    if(!waited.finished)throw Error('Native setup wait interrupted before the counter chapter');
    if(!h.game.atHand)throw Error('Native wait lost the counter world');
    return {...h,plans,provider,world:h.game.atHand};
}
for(const kind of ['carriage_station','landing','span_counter'] as const) {
    it('reaches actual '+kind+' work, asks its attendant, pays and arrives through the native service',async()=>{
        const h=await fixture();
        try {
            const id=h.game.currentRun().cultivator.id;
            let selected: {place:typeof h.world.locations[number]; destination:string; area:string; worker:string; venueName:string}|null=null;
            for(const place of h.world.locations) {
                const counters=publicCountersAt(h.world,place.name,h.world.currentDay);
                if(!counters.includes(kind))continue;
                const worker=workersAtPublicCounters(h.world,place.name,npcsStandingIn(h.world,place.id),counters).get(kind);
                if(!worker)continue;
                const reading=theAreasOf(h.world,place);
                const area=reading.areas.find(area=>area.id===reading.whereIs.get(worker.id)&&area.for===kind);
                const destination=kind==='span_counter'?routesFrom(place.name)[0]?.toPlace
                    :publicTransportFrom(h.world,place.name,h.world.currentDay).find(line=>line.service===(kind==='landing'?'ship':'carriage')&&line.runsFromDay===null)?.to;
                if(!area||!destination||!worldLocationFor(h.world,destination))continue;
                selected={place,destination,area:area.id,worker:worker.id,venueName:area.name};break;
            }
            if(!selected)throw Error('Opening native scene has no actually staffed '+kind+' and published route');
            const {place,destination,area,worker,venueName}=selected;
            const entrance=theAreasOf(h.world,place).areas.find(room=>room.for!==kind&&room.for!=='room');
            if(!entrance)throw Error('Actual public approach missing');
            h.repos.cultivators.update(id,{location:place.name,standingIn:entrance.id});
            h.plans.push(JSON.stringify({action:'move',target:venueName}));
            const moved=await h.game.act('I walk to '+venueName+'.');
            expect(refusedCall(moved)).toBeNull();
            expect(h.game.currentRun().cultivator.standingIn).toBe(area);
            // Movement may honestly change the shift. Re-read the real current duty.
            const body=h.game.currentRun().cultivator;
            const current=whoKeepsTheCounter(h.game,body,kind,publicCountersAt(h.game.atHand,place.name,h.game.atHand!.currentDay));
            expect(current,'native crossing must actually reach a working mouth').not.toBeNull();
            const actualArea=theAreasOf(h.game.atHand!,place).whereIs.get(current!.id);
            expect(actualArea).toBe(body.standingIn);
            const before=h.game.currentRun();
            h.plans.push(JSON.stringify({action:'interact',target:description[kind],intent:'ask',topic:'the way to '+destination}));
            const spoken=await h.game.act('I ask '+description[kind]+' how to get to '+destination+'.');
            expect(refusedCall(spoken)).toBeNull();
            expect(spoken.toolCalls.some(call=>call.name==='engine.theWayTo'&&call.ok)).toBe(true);
            expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
            const beforePayment=h.game.currentRun();
            h.plans.push(JSON.stringify(kind==='span_counter'?{action:'passage',target:destination}:{action:'ride',target:destination,topic:kind==='landing'?'ship':'carriage'}));
            const paid=await h.game.act(kind==='span_counter'?'I buy passage to '+destination+'.':'I ride a '+(kind==='landing'?'ship':'carriage')+' to '+destination+'.');
            console.log(JSON.stringify({kind,place:place.name,initialWorker:worker,currentWorker:current?.id,destination,moved:moved.toolCalls,spoken:spoken.toolCalls,paid:paid.toolCalls}));
            expect(paid.toolCalls.find(call=>call.name==='narrator.plan')?.source).toBe('model');
            expect(refusedCall(paid)).toBeNull();
            expect(h.game.currentRun().cultivator.spiritStones).toBeLessThan(beforePayment.cultivator.spiritStones);
            expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(beforePayment.run.elapsedDays);
            expect(h.game.currentRun().cultivator.location).toBe(h.game.whereTheRoadEndsIn(destination).name);
        }finally{h.db.close();}
    },180_000);
}
it('an empty actual counter supplies no invented listener or conversation purchase',async()=>{
    const h=await fixture();
    try {
        const id=h.game.currentRun().cultivator.id;
        let chosen:{place:typeof h.world.locations[number];area:string;kind:PublicHubKind}|null=null;
        for(const place of h.world.locations){
            const counters=publicCountersAt(h.world,place.name,h.world.currentDay);
            const workers=workersAtPublicCounters(h.world,place.name,npcsStandingIn(h.world,place.id),counters);
            for(const kind of ['span_counter','landing','carriage_station'] as const){
                const area=theAreasOf(h.world,place).areas.find(area=>area.for===kind);
                if(counters.includes(kind)&&!workers.has(kind)&&area){chosen={place,area:area.id,kind};break;}
            }
            if(chosen)break;
        }
        if(!chosen)throw Error('Native world has no empty counter control');
        h.repos.cultivators.update(id,{location:chosen.place.name,standingIn:chosen.area});
        const before=h.game.currentRun();
        expect(h.game.somebodyAtHand(description[chosen.kind],before.cultivator)).toBeNull();
        h.plans.push(JSON.stringify({action:'interact',target:description[chosen.kind],intent:'ask',topic:'the way to an advertised destination'}));
        const answer=await h.game.act('I ask '+description[chosen.kind]+' about passage.');
        expect(refusedCall(answer)).not.toBeNull();
        expect(h.game.currentRun().cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(h.game.currentRun().cultivator.location).toBe(before.cultivator.location);
        expect(answer.toolCalls.some(call=>call.name==='engine.theWayTo'&&call.ok)).toBe(false);
    }finally{h.db.close();}
},120_000);
