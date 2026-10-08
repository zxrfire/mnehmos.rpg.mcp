/**
 * Root paired12175 (2026-10-07), same frozen command: actual inn-counter
 * baseline5 PASS, Staff06 0 PASS/5 FAIL. The working-person reader silently
 * discarded real repository-only listeners and every no-world listener.
 * These are real bodies, not invented NpcRecord/routine stand-ins. Complete
 * canonical place/area reads feed the one counter deal; a world actor's own
 * off-duty activity still cannot be licensed by its mirrored SQL row.
 * Existing inn payment/coverage5 and native world-mouth4 remain dependencies.
 * Scripted/native proof is not actual model narration acceptance.
 */
import {expect,it} from 'vitest';
import {makeGame,makeGameInWorld} from './harness.js';
import {theCounterWorkersHere,whoKeepsTheCounter} from '../../src/web/who-keeps-a-counter-here.js';
import {takeARoom} from '../../src/web/a-room-at-an-inn.js';
import {peopleInThisPlace} from '../../src/web/hearsay.js';
import {theAreaTheyAreIn,theAreaNamed} from '../../src/web/walking-across-a-place.js';
import {workersAtPublicCounters} from '../../src/engine/world/who-is-working-at-a-public-counter.js';

it.each([false,true])('keeps an actual SQL-only inn listener with worldEnabled=%s and credits that physical body',async worldEnabled=>{
    const h=worldEnabled?await makeGameInWorld({seed:'road-5',worldSeed:'road-world'}):makeGame({seed:'road-5'});
    const {cultivator}=await h.game.newRun('Actual guest');
    const keeper=h.repos.cultivators.create({...cultivator,id:'actual-repository-only-counter',name:'Actual counter person',kind:'npc'});
    if(h.game.atHand){h.game.atHand.npcs=[];h.game.theWorldMoved();}
    h.repos.cultivators.update(cultivator.id,{spiritStones:1000});
    const body=h.repos.cultivators.getById(cultivator.id)!;
    const where=theAreaTheyAreIn(h.game.atHand,body);
    if(worldEnabled){
        if(!h.game.atHand||!where)throw new Error('Actual inn fixture has no place');
        const inn=theAreaNamed(peopleInThisPlace(h.repos,body,h.game.atHand,where.place).areas,'inn');
        if(!inn)throw new Error('Actual public inn is absent');
        h.repos.cultivators.standIn(keeper.id,inn.id);
    }
    const before=h.repos.cultivators.getById(keeper.id)!.spiritStones;
    const booked=await takeARoom(h.game,h.game.currentRun().run,body,2);
    expect(booked.outcome).toBe('executed');
    const after=h.game.currentRun().cultivator;
    expect(body.spiritStones-after.spiritStones).toBeGreaterThan(0);
    expect(h.repos.cultivators.getById(keeper.id)!.spiritStones-before).toBe(body.spiritStones-after.spiritStones);
    expect(whoKeepsTheCounter(h.game,after,'inn',['inn'])?.id).toBe(keeper.id);
    h.repos.cultivators.update(keeper.id,{alive:false});
    expect(theCounterWorkersHere(h.game,after,undefined,['inn']).size).toBe(0);
});

it('does not license off-duty actual world bodies through repository listener support',async()=>{
    const h=await makeGameInWorld({seed:'road-5',worldSeed:'road-world'});
    const {cultivator}=await h.game.newRun('Routine reader');
    const world=h.game.atHand??await h.game.loadWorld();
    if(!world)throw new Error('No actual routine world');
    const person=world.npcs.find(n=>n.status==='alive');
    if(!person)throw new Error('No actual ordinary body');
    const off={...person,activity:{kind:'at_a_table' as const,note:'Eating.',withIds:[],sinceDay:world.currentDay,untilDay:world.currentDay+1}};
    expect(workersAtPublicCounters(world,cultivator.location??'',[off],['inn','landing','carriage_station','span_counter']).size).toBe(0);
});
