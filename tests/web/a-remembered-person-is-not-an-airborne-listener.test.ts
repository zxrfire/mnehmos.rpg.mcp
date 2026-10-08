/**
 * Oct7 source audit: interact resolved a remembered SQL person, recorded a
 * witnessed approach and could introduce/reply before its topical branch
 * checked the actual current roster. A real accepted air-course site must not
 * inherit ground listeners at its nominal origin. The SQL player and an actual
 * seeded current NPC retain their native identity/physical authorities. No
 * present list is stubbed; successful dialogue still requires actual receipts.
 * The positive same-ground control prevents a blanket personal-interaction
 * refusal. A baseline removing only the new presence guard is required before
 * acceptance. Root Air09 native21920 reached 12PASS3FAIL across four files;
 * both listener controls failed, including same-ground. Root diagnostic9658
 * then proved both failed BEFORE act: a SQL-only fixture UUID was excluded from
 * actual world presence, whose two faces were genuine seeded NPCs. This successor
 * selects an actual living seeded person from that canonical roster and records
 * their name through the existing told-knowledge fixture authority. No roster is
 * overridden and no world person is fabricated. Runtime/assertions stay intact;
 * Root pair76463 then passed BOTH red2 and green2: a departed world NPC is
 * absent from the candidate union before the new guard. Those two controls stay.
 * The added repository-body control uses canonical no-world SQL presence, an
 * actual local name exchange, then native travel to a real catalog village.
 * A remembered remote SQL row still resolves before the guard; it must not gain
 * a new witnessed approach/reply at the new ground. This additional causal
 * control is unrun and scripts intent/prose only, never presence or outcomes.
 */
import { appendFileSync } from 'node:fs';

function recordListenerObservation(value: unknown): void {
    const file=process.env.RPG_AIR_LISTENER_DIAGNOSTIC_PATH;
    if(file) appendFileSync(file, JSON.stringify(value)+'\n');
}
import { expect, it } from 'vitest';
import { makeGame, makeGameInWorld, ScriptedProvider } from './harness.js';
import { PLACE } from '../../src/data/cultivation/place-names.js';
import { resolveParty } from '../../src/web/entities.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { worldLocationFor } from '../../src/engine/world/place-lookup.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { beginAnAirCourse } from '../../src/engine/world/an-air-course-in-the-world.js';
import { holdPersonalAirCourse } from '../../src/web/an-actual-personal-air-course.js';

for(const airborne of [false,true])it('a known native person is reachable only on the same actual ground; airborne='+airborne,async()=>{
    const plans:string[]=[];
    const h=await makeGameInWorld({seed:'actual-air-listener',worldSeed:'road-world',
        narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:['Actual engine facts.']}),
            {model:'test-model',timeoutMs:5000})});
    try{
        recordListenerObservation({stage:'opening',airborne});
        await h.game.newRun('Actual listener test');
        const initial=h.game.currentRun(),world=h.game.atHand!;
        const from=worldLocationFor(world,initial.cultivator.location);
        if(!from)throw new Error('Actual player ground absent');
        const physicallyHere=h.game.present(initial.cultivator);
        const listener=world.npcs.find(person=>person.status==='alive'
            && physicallyHere.some(face=>face.id===person.id));
        if(!listener)throw new Error('Actual opening roster has no living seeded listener');
        recordListenerObservation({stage:'initial-listener',airborne,body:{id:initial.cultivator.id,location:initial.cultivator.location,standingIn:initial.cultivator.standingIn},listener:{id:listener.id,name:listener.name,location:listener.locationId},worldClock:{day:world.currentDay,hour:world.currentHour},present:h.game.present(initial.cultivator).map(row=>({id:row.id,name:row.name})),knowledge:h.game.knowledge.awareness(initial.cultivator.id).filter(row=>row.id===listener.id)});
        expect(h.game.present(initial.cultivator).some(row=>row.id===listener.id)).toBe(true);
        // An actual named-body fixture heard about this person; that is not a
        // witnessed approach or a successful name-giving conversation.
        h.game.noteEncounter(initial.cultivator,initial.run,{kind:'cultivator',id:listener.id,name:listener.name},
            'told','Operator arrangement: this actual person was previously mentioned by name.');
        if(airborne){
            const to=world.locations.find(place=>place.kind==='settlement'&&place.id!==from.id);
            if(!to)throw new Error('Actual exterior target absent');
            const accepted=beginAnAirCourse(world,{bodyId:initial.cultivator.id,bodyName:initial.cultivator.name,
                fromId:from.id,toId:to.id,conveyanceId:'conv-body-flight',power:null,vesselId:null,artId:null,
                onDay:routineTime(world),runId:initial.run.id,runElapsedDays:initial.run.elapsedDays,heads:1});
            if(!accepted)throw new Error('Actual ground pair did not quote an air course');
            h.repos.cultivators.update(initial.cultivator.id,{realmOrdinal:29,location:accepted.location.id,standingIn:null});
            holdPersonalAirCourse(h.db,initial.cultivator.id,accepted.location.id);
        }
        const before=h.game.currentRun();
        const heardBefore=h.game.knowledge.awareness(before.cultivator.id).filter(row=>row.id===listener.id);
        recordListenerObservation({stage:'before-act',airborne,body:{id:before.cultivator.id,location:before.cultivator.location,standingIn:before.cultivator.standingIn},run:{id:before.run.id,turn:before.run.turn,elapsedDays:before.run.elapsedDays},listenerId:listener.id,present:h.game.present(before.cultivator).map(row=>({id:row.id,name:row.name})),heardBefore});
        expect(h.game.present(before.cultivator).some(row=>row.id===listener.id)).toBe(!airborne);
        plans.push(JSON.stringify({action:'interact',target:listener.name,intent:'talk',topic:'greeting'}));
        const turn=await h.game.act('I greet '+listener.name+'.');
        recordListenerObservation({stage:'after-act',airborne,input:'I greet '+listener.name+'.',plan:{action:'interact',target:listener.name,intent:'talk',topic:'greeting'},toolCalls:turn.toolCalls,body:{location:h.game.currentRun().cultivator.location,standingIn:h.game.currentRun().cultivator.standingIn},run:{turn:h.game.currentRun().run.turn,elapsedDays:h.game.currentRun().run.elapsedDays},present:h.game.present(h.game.currentRun().cultivator).map(row=>({id:row.id,name:row.name})),knowledge:h.game.knowledge.awareness(before.cultivator.id).filter(row=>row.id===listener.id)});
        if(airborne){
            expect(turn.toolCalls.some(call=>call.name==='engine.resolveParty'&&!call.ok)).toBe(true);
            expect(h.game.knowledge.awareness(before.cultivator.id).filter(row=>row.id===listener.id)).toEqual(heardBefore);
            expect(h.game.currentRun().cultivator.location).toBe(before.cultivator.location);
            expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        }else{
            expect(turn.toolCalls.some(call=>call.name==='engine.resolveParty'&&!call.ok)).toBe(false);
            expect(h.game.knowledge.awareness(before.cultivator.id).filter(row=>row.id===listener.id)
                .some(row=>row.sourceKind==='witnessed')).toBe(true);
        }
    }finally{h.db.close();}
},180000);

it('a genuinely met repository person cannot answer from their old ground after native movement',async()=>{
 const plans:string[]=[];
 const h=makeGame({seed:'actual-stored-listener',worldEnabled:false,
  narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:['Debug engine facts.']}),
   {model:'test-model',timeoutMs:5000})});
 try{
  const opened=await h.game.newRun('A travelling listener');
  const listener=h.repos.cultivators.create({...opened.cultivator,
   id:'beeb422c-3fc5-4b4b-8487-6514102ef7e7',name:'Shen Yuanqing',kind:'npc'});
  expect(h.game.atHand).toBeNull();
  expect(h.game.present(opened.cultivator).some(row=>row.id===listener.id)).toBe(true);
  plans.push(JSON.stringify({action:'interact',target:listener.name,intent:'talk',topic:'May I ask your name?'}));
  const met=await h.game.act('I greet '+listener.name+' and ask their name.');
  expect(met.toolCalls.some(call=>call.name==='engine.resolveParty'&&!call.ok)).toBe(false);
  expect(h.game.knowledge.awareness(opened.cultivator.id).some(row=>row.id===listener.id&&row.sourceKind==='witnessed')).toBe(true);
  const destination=opened.cultivator.location===PLACE.PLUM_VILLAGE?PLACE.CLEAR_CREEK_VILLAGE:PLACE.PLUM_VILLAGE;
  // Real purse arrangement supports the existing road/provisions authority.
  // The act itself chooses duration, resources and actual arrival.
  h.repos.cultivators.update(opened.cultivator.id,{spiritStones:1000});
  plans.push(JSON.stringify({action:'move',target:destination,intent:'travel'}));
  const movement=await h.game.act('I travel to '+destination+'.');
  const before=h.game.currentRun();
  expect(before.cultivator.alive).toBe(true);
  expect(before.cultivator.location).toBe(destination);
  expect(before.run.elapsedDays).toBeGreaterThan(opened.run.elapsedDays);
  expect(h.repos.cultivators.getById(listener.id)?.location).toBe(opened.cultivator.location);
  expect(h.game.present(before.cultivator).some(row=>row.id===listener.id)).toBe(false);
  // This is the real branch distinction the original world-NPC pair lacked.
  const resolved=resolveParty(h.repos,listener.name,before.cultivator,h.game.scopeFor(before.cultivator));
  expect(resolved?.id).toBe(listener.id);
  const knowledgeBefore=h.game.knowledge.awareness(before.cultivator.id).filter(row=>row.id===listener.id);
  recordListenerObservation({stage:'stored-actor-before-act',movement:movement.toolCalls,
   listener:{id:listener.id,location:listener.location},body:{location:before.cultivator.location},
   resolvedId:resolved?.id,present:h.game.present(before.cultivator).map(row=>({id:row.id,name:row.name})),knowledgeBefore});
  plans.push(JSON.stringify({action:'interact',target:listener.name,intent:'talk',topic:'greeting'}));
  const replied=await h.game.act('I greet '+listener.name+'.');
  const after=h.game.currentRun();
  const knowledgeAfter=h.game.knowledge.awareness(before.cultivator.id).filter(row=>row.id===listener.id);
  recordListenerObservation({stage:'stored-actor-after-act',toolCalls:replied.toolCalls,knowledgeAfter,
   body:{location:after.cultivator.location},elapsedDays:after.run.elapsedDays});
  expect(replied.toolCalls.some(call=>call.name==='engine.resolveParty'&&!call.ok)).toBe(true);
  expect(knowledgeAfter).toEqual(knowledgeBefore);
  expect(after.cultivator.location).toBe(before.cultivator.location);
  expect(after.run.elapsedDays).toBe(before.run.elapsedDays);
 }finally{h.db.close();}
},180000);
