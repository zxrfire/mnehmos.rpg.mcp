/** Exact native Captain05 arrangement; no mocked resolver or hull source. */
import {expect} from 'vitest';
import {makeGame,ScriptedProvider} from '../harness.js';
import {ProviderNarrator} from '../../../src/web/narrator.js';
import {createWorld,prepareWorldClockForPreciseSpan,resetCultivationWorlds} from '../../../src/server/state/cultivation-world.js';
import {createNpc} from '../../../src/engine/world/npc-state.js';
import {routineTime} from '../../../src/engine/world/npc-routines.js';
import {quotePublicPassage,recordPublicPassage} from '../../../src/engine/world/public-shipping.js';
import {commitNpcPublicPassage,ensureShipCrew,bindShipCrewToPassage} from '../../../src/engine/world/ship-crew.js';
import {startNpcPassage,isWater} from '../../../src/engine/world/places-on-the-way.js';
import {worldLocationFor} from '../../../src/web/entities.js';
import {whatRunsFromHere} from '../../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import {writeTheVoyage} from '../../../src/web/a-ship-at-sea.js';
import {passHours} from '../../../src/web/routine-invitations.js';
export async function atTheActualCaptain(){
    const plans:string[]=[];
    const {game,db}=makeGame({seed:'ordinary-fellow-ship',worldEnabled:true,
        narrator:new ProviderNarrator(new ScriptedProvider({plans,narrations:[]}),{model:'native-review',timeoutMs:0})});
    resetCultivationWorlds();
    await createWorld({seed:'precise-sea-world',presentYear:0});
    await game.newRun('Passage traveller');
    let now=game.currentRun();
    game.repos.cultivators.update(now.cultivator.id,{location:'Emerald Water City',standingIn:null,
        realmOrdinal:20,spiritStones:5000,hp:1000,maxHp:1000,satiety:12});
    now=game.currentRun();game.atHand=await prepareWorldClockForPreciseSpan(now.run,now.cultivator);
    const world=game.atHand,from=worldLocationFor(world,now.cultivator.location)!;
    const line=whatRunsFromHere(game,now.cultivator,routineTime(world)).find(one=>one.service==='ship'&&one.runsFromDay===null&&one.days>1)!;
    const to=worldLocationFor(world,line.to)!;
    const original=createNpc(world.seed,{id:'fellow-passenger-ship',locationId:from.id,onDay:routineTime(world),
        bornOnDay:routineTime(world)-25*365,occupation:'merchant',takenNames:new Set(world.npcs.map(one=>one.name))});
    const quote=quotePublicPassage(world,from.id,to.id,routineTime(world),1)!;
    const passenger=startNpcPassage(world.locations,{...original,spiritStones:5000},{lane:quote.lane,
        destinationId:to.id,onDay:quote.departureDay,days:quote.days,fareStones:quote.fareStones,purpose:'Taking wares to '+to.name+'.'})!;
    world.npcs.push(passenger);
    expect(commitNpcPublicPassage(world,passenger)).toBe(true);
    expect(passenger.tags.some(tag=>tag.startsWith('crew-of:'))).toBe(false);
    expect(passenger.spiritStones).toBe(5000-quote.fareStones);
    const playerQuote=quotePublicPassage(world,from.id,to.id,routineTime(world),1)!;
    const crew=ensureShipCrew(world,playerQuote.lane,from.id,playerQuote.departureDay);
    bindShipCrewToPassage(world,playerQuote);
    const receipt=recordPublicPassage(world,playerQuote,playerQuote.departureDay,from.id,[now.cultivator.id,...crew.map(one=>one.id)],undefined,
        {runId:now.run.id,elapsedDays:now.run.elapsedDays},[{id:now.cultivator.id,name:now.cultivator.name}]);
    game.repos.cultivators.applyDeltas(now.cultivator.id,{spiritStones:-playerQuote.fareStones});
    writeTheVoyage(db,now.cultivator.id,{receiptId:receipt.id,from:from.name,bound:to.name,lane:playerQuote.lane,
        sailed:0,days:playerQuote.days,quoted:playerQuote.days,hullRationDays:playerQuote.provision.rationDaysAboard,crew:crew.length});
    game.theWorldMoved();

    const moved=await passHours(game,game.currentRun().run,game.currentRun().cultivator,3);
    expect(moved.finished,JSON.stringify(moved.spent?.calls)).toBe(true);
    expect(isWater(worldLocationFor(world,game.currentRun().cultivator.location)!)).toBe(true);
    const captain=game.somebodyAtHand('captain',game.currentRun().cultivator)!;
    expect(captain).toBeTruthy();
    plans.push(JSON.stringify({action:'interact',target:'captain',intent:'talk',topic:'hello'}));
    const greeted=await game.act('I greet the captain.');
    expect(greeted.toolCalls.some(call=>call.name==='engine.askedAbout'&&call.ok&&call.summary.startsWith('Asked '+captain.name+' about ')),JSON.stringify(greeted.toolCalls)).toBe(true);
    return {game,db,plans,world,from,to,receipt,passenger,captain};
}
