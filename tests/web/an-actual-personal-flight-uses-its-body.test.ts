/**
 * Oct7 prototype: body flight was not granted at29 and held flight arts priced
 * walking detours. The fixture arranges an actual SQL body, unopened provisions
 * and a real catalog exterior destination through existing operator/knowledge
 * authority; it does not claim that a direction conversation occurred.
 * Scripted planning supplies intent only; game.act owns route checks, native
 * art debit/cooldown, accepted course, body time and actual arrival. The art
 * control reads the real native known-art receipt rather than reproducing qi
 * recovery. A separate accepted-course fixture proves ground people do not
 * become airborne listeners and a stop cannot drift to its intended target.
 * Root Air09 native21920 measured 12PASS3FAIL across four files. The body29
 * receipt differed from its quote by 1.419182826811749e-11 days after subtracting
 * epoch365000, above the old 5e-13 assertion. Absolute arrival comparisons use
 * the existing canonical floating-boundary reader in both directions; no body
 * clock, price or world-time policy changes. Native/model successor unrun.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { journeyTimeHasReached } from '../../src/engine/world/places-on-the-way.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { quoteAnAirJourney, conveyanceOfPersonalFlight } from '../../src/engine/world/what-an-air-journey-takes.js';
import { witnessIndexFor } from '../../src/engine/world/witness-reaction-index.js';
import { beginAnAirCourse, airPositionAt, stopAnAirCourse } from '../../src/engine/world/an-air-course-in-the-world.js';
import { holdPersonalAirCourse, projectPersonalAirPassenger, launchPersonalAirJourney } from '../../src/web/an-actual-personal-air-course.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { getTechnique, TECHNIQUES } from '../../src/data/cultivation/techniques.js';
import { primaryRoadOf } from '../../src/schema/cultivation.js';

async function fixture(ordinal:number, artId:string|null=null) {
    const plans:string[]=[];
    const h=await makeGameInWorld({seed:'actual-personal-air',worldSeed:'road-world',
        narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:['Actual engine facts.']}),
            {model:'test-model',timeoutMs:5000})});
    await h.game.newRun('Actual flying body');
    const opened=h.game.currentRun(), world=h.game.atHand!;
    h.repos.cultivators.update(opened.cultivator.id,{realmOrdinal:ordinal,qi:200,maxQi:200,
        spiritStones:1000,satiety:100});
    if(artId){
        const art=getTechnique(artId);
        if(!art)throw new Error('Real flight art is absent');
        const school=TECHNIQUES.find(row=>row.id!==art.id && primaryRoadOf(row)===primaryRoadOf(art));
        if(!school)throw new Error('Real flight art has no school control');
        for(const held of [art,school]){h.repos.techniques.upsert(held);expect(h.repos.techniques.learn(opened.cultivator.id,held.id,1)).not.toBeNull();}
    }
    let body=h.game.currentRun().cultivator;
    const bundle=h.game.buyProvisions(body,120);
    h.game.putBackWhatWasNotEaten(bundle.cultivator,{endState:{rationsRemaining:bundle.rations}});
    body=h.game.currentRun().cultivator;
    const from=worldLocationFor(world,body.location);
    const conveyance=conveyanceOfPersonalFlight(artId);
    if(!from||!conveyance)throw new Error('Real opening ground or conveyance absent');
    const selected=world.locations.map(to=>({to,quote:quoteAnAirJourney(world.locations,from.id,to.id,
        conveyance,null,1,{facts:witnessIndexFor(world).byId,onDay:routineTime(world)})}))
        .find(row=>row.to.kind==='settlement'&&row.to.id!==from.id&&!row.to.tags.includes('interior')
            &&row.quote&&row.quote.daysOneWay>0&&row.quote.daysOneWay<.125);
    if(!selected?.quote)throw new Error('Real catalog has no short exterior air course');
    h.game.noteEncounter(body,h.game.currentRun().run,{kind:'place',id:selected.to.id,name:selected.to.name},
        'told','Operator fixture: this body already has actual directions to the selected exterior.');
    expect(h.game.canPointAtLocation(body,selected.to)).toBe(true);
    return {...h,plans,from,to:selected.to,quote:selected.quote};
}

for(const ordinal of [28,29])it('body flight gate and actual native arrival at ordinal '+ordinal,async()=>{
    const h=await fixture(ordinal);
    try{
        const before=h.game.currentRun();
        const worldBefore=routineTime(h.game.atHand!);
        h.plans.push(JSON.stringify({action:'ride',target:h.to.name,topic:'body flight'}));
        const turn=await h.game.act('I fly to '+h.to.name+'.');
        const after=h.game.currentRun();
        if(ordinal===28){
            expect(turn.toolCalls.some(call=>call.name==='engine.airJourney'&&!call.ok)).toBe(true);
            expect(after.cultivator.location).toBe(before.cultivator.location);
            expect(after.cultivator.qi).toBe(before.cultivator.qi);
            expect(after.run.elapsedDays).toBe(before.run.elapsedDays);
        }else{
            expect(turn.toolCalls.some(call=>call.name==='engine.bodyFlightLaunch'&&call.ok&&call.summary.includes('25 qi'))).toBe(true);
            expect(after.cultivator.location).toBe(h.to.name);
            const quotedArrival=worldBefore+h.quote.daysOneWay;
            const runArrival=worldBefore+(after.run.elapsedDays-before.run.elapsedDays);
            const worldArrival=routineTime(h.game.atHand!);
            for(const arrival of [runArrival,worldArrival]) {
                expect(journeyTimeHasReached(arrival,quotedArrival)).toBe(true);
                expect(journeyTimeHasReached(quotedArrival,arrival)).toBe(true);
            }
            expect(after.run.turn-before.run.turn).toBe(1);
        }
    }finally{h.db.close();}
},180000);

for(const id of ['gale-riding-sword-flight','thousand-li-cloud-tread'])it('actual held art charges and cooldown once: '+id,async()=>{
    const art=getTechnique(id);if(!art)throw new Error('Actual flight art absent');
    const h=await fixture(art.requiredOrdinal,id);
    try{
        const before=h.game.currentRun();
        h.plans.push(JSON.stringify({action:'ride',target:h.to.name,topic:id.includes('cloud')?'cloud flight':'sword flight'}));
        const turn=await h.game.act('I fly to '+h.to.name+' on my '+(id.includes('cloud')?'cloud':'sword')+'.');
        expect(turn.toolCalls.some(call=>call.name==='technique_manage.use'&&call.ok
            &&call.summary.includes(art.qiCost+' qi'))).toBe(true);
        expect(h.repos.techniques.getKnown(before.cultivator.id,id)?.cooldownRemaining).toBeGreaterThan(0);
        expect(h.game.currentRun().run.turn-before.run.turn).toBe(1);
        expect(h.game.currentRun().cultivator.location).toBe(h.to.name);
    }finally{h.db.close();}
},180000);

it('an actual stopped airborne body has no ground listeners and never receives a target write',async()=>{
    const h=await fixture(29);
    try{
        const before=h.game.currentRun(),world=h.game.atHand!,day=routineTime(world);
        const accepted=beginAnAirCourse(world,{bodyId:before.cultivator.id,bodyName:before.cultivator.name,
            fromId:h.from.id,toId:h.to.id,conveyanceId:'conv-body-flight',power:null,vesselId:null,artId:null,
            onDay:day,runId:before.run.id,runElapsedDays:before.run.elapsedDays,heads:1});
        if(!accepted)throw new Error('Actual course fixture absent');
        h.repos.cultivators.update(before.cultivator.id,{location:accepted.location.id,standingIn:null});
        holdPersonalAirCourse(h.db,before.cultivator.id,accepted.location.id);
        const middle=day+accepted.quote.daysOneWay/2;
        const position=airPositionAt(world,accepted.location,middle);
        stopAnAirCourse(world,accepted.location,middle,'Actual interruption fixture');
        const body=h.game.currentRun().cultivator;
        expect(peopleInThisPlace(h.repos,body,world,accepted.location).people).toEqual([]);
        projectPersonalAirPassenger(h.db,world,body.id,middle+100);
        expect(h.game.currentRun().cultivator.location).toBe(accepted.location.id);
        expect(airPositionAt(world,accepted.location,middle+100)?.point).toEqual(position?.point);
        expect(h.game.groundFor(h.game.currentRun().cultivator)?.density).toBe(0);
    }finally{h.db.close();}
},180000);

for (const startInside of [false,true]) it('actual sealed interior cannot become a launch or landing, startInside='+startInside,async()=>{
    const h=await fixture(29);
    try{
        const room=h.game.atHand!.locations.find(place=>place.sealed&&place.tags.includes('interior'));
        if(!room)throw new Error('Real world lacks sealed interior control');
        if(startInside)h.repos.cultivators.update(h.game.currentRun().cultivator.id,{location:room.name,standingIn:null});
        const before=h.game.currentRun(),factsBefore=h.game.atHand!.history.facts.length;
        const result=await launchPersonalAirJourney(h.game,before.run,before.cultivator,
            startInside?h.to.name:room.name,null);
        expect(result.outcome).toBe('refused');
        expect(result.calls.some(call=>call.name==='engine.airExterior'&&!call.ok)).toBe(true);
        expect(h.game.currentRun().cultivator.qi).toBe(before.cultivator.qi);
        expect(h.game.currentRun().cultivator.location).toBe(before.cultivator.location);
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        expect(h.game.atHand!.history.facts.length).toBe(factsBefore);
        expect(room.sealed).toBe(true);
    }finally{h.db.close();}
},180000);
