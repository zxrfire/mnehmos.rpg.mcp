/**
 * Root native passenger06/ship07, Oct7: greeting Jiang Jingping really gave
 * her name. Witnessed provenance was certain afterward, but a .125-day reply
 * moved her/master/hand from foredeck to stern while the unchanged SQL foredeck
 * presented unrelated water-region people. Hour-bucket area draws repacked a
 * finite accepted hull, and coarse water was being mistaken for co-location.
 * An ordinary passenger is not crew or a recruited party member. This played
 * control buys actual NPC/player berths, greets an unknown visible face, and
 * checks stable physical company, name, body clock and the same paid course.
 * It scripts intent only; no engine answer, forced consent or narration is supplied.
 * The local-room guard additionally arranges the existing remembered shore
 * lodging flag at departure: it is real shore entitlement, never a hull cabin.
 * Local room fallback must refuse it without spending or clearing passage.
 * Root Deck04 native: both large-boat controls passed; the ship test stopped
 * before dialogue because an exact headline assertion expected No such room
 * while facts carried The remembered shore room does not place you inside.
 * Refusal/reach/body/clock/fare/receipt are the rule, not headline position.
 * Verification: root Deck04 native84364 passed both large-boat controls;
 * root Deck05 native92877 passed the original ship conversation/current-deck
 * control and shore-room refusal. All runtime modules loaded, mirror/hash
 * integrity held. These are native mechanics proofs, not model prose proof.
 */
import { expect, it } from 'vitest';
import { makeGame, ScriptedProvider } from './harness.js';
import { ProviderNarrator } from '../../src/web/narrator.js';
import { createWorld, prepareWorldClockForPreciseSpan, resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { createNpc } from '../../src/engine/world/npc-state.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import { quotePublicPassage, recordPublicPassage } from '../../src/engine/world/public-shipping.js';
import { commitNpcPublicPassage, ensureShipCrew, bindShipCrewToPassage } from '../../src/engine/world/ship-crew.js';
import { startNpcPassage, journeyTimeHasReached, isWater } from '../../src/engine/world/places-on-the-way.js';
import { shipPassengerAt } from '../../src/engine/world/passenger-on-a-vessel.js';
import { worldLocationFor } from '../../src/web/entities.js';
import { whatRunsFromHere } from '../../src/web/a-seat-on-a-ship-or-a-carriage.js';
import { writeTheVoyage, recordedVoyage } from '../../src/web/a-ship-at-sea.js';
import { passHours } from '../../src/web/routine-invitations.js';
import { peopleInThisPlace } from '../../src/web/hearsay.js';
import { writeFlag } from '../../src/server/consolidated/cultivation-support.js';
import { whereTheyAreLodged } from '../../src/web/a-room-at-an-inn.js';
import { aWalkAcrossThePlace, namesALocalArea } from '../../src/web/walking-across-a-place.js';
import { thePlayerIsSureItIsThem } from '../../src/web/the-narrator-plays-the-world.js';

it('keeps an actual ordinary ship passenger on the chosen deck through stranger and given-name replies', async () => {
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
    const receipt=recordPublicPassage(world,playerQuote,playerQuote.departureDay,from.id,[now.cultivator.id,...crew.map(one=>one.id)]);
    game.repos.cultivators.applyDeltas(now.cultivator.id,{spiritStones:-playerQuote.fareStones});
    writeTheVoyage(db,now.cultivator.id,{receiptId:receipt.id,from:from.name,bound:to.name,lane:playerQuote.lane,
        sailed:0,days:playerQuote.days,quoted:playerQuote.days,hullRationDays:playerQuote.provision.rationDaysAboard,crew:crew.length});
    game.theWorldMoved();
    try {
        const boarding = game.currentRun();
        // Existing durable lodging arrangement, not a new room or purchase rule.
        writeFlag(db, boarding.cultivator.id, 'lodged_at', JSON.stringify({place:from.name,paidThroughDay:10}));
        expect(whereTheyAreLodged(game, boarding.cultivator)).not.toBeNull();
        const boardingMoment = routineTime(world);
        expect(namesALocalArea(game, boarding.cultivator, 'my room')).toBe(false);
        const noCabin = await aWalkAcrossThePlace(game, boarding.run, boarding.cultivator, 'my room');
        expect(noCabin?.outcome).toBe('refused');
        expect(noCabin?.facts.lines.join(' ')).toMatch(/\b(?:room|local area)\b/);
        expect(noCabin?.calls.some(call => call.name === 'engine.walkAcrossThePlace' && !call.ok)).toBe(true);
        expect(game.currentRun()).toEqual(boarding);
        expect(routineTime(world)).toBe(boardingMoment);
        expect(recordedVoyage(db, boarding.cultivator.id)?.receiptId).toBe(receipt.id);
        const approach=await passHours(game,game.currentRun().run,game.currentRun().cultivator,3);
        expect(approach.finished,JSON.stringify(approach.spent?.calls)).toBe(true);
        const body=game.currentRun().cultivator,ground=worldLocationFor(world,body.location)!;
        expect(isWater(ground)).toBe(true);
        const read=peopleInThisPlace(game.repos,body,world,ground),deck=read.whereIs.get(passenger.id)!;
        expect(deck).toBeTruthy();game.repos.cultivators.standIn(body.id,deck);
        expect(game.present(game.currentRun().cultivator).some(one=>one.id===passenger.id)).toBe(true);
        const description=['the man','the woman','the first man','the last man','the first woman','the last woman']
            .find(said=>game.somebodyAtHand(said,game.currentRun().cultivator)?.id===passenger.id)!;
        expect(description).toBeTruthy();
        expect(thePlayerIsSureItIsThem(passenger.name,game.knowledge.provenanceOf(body.id,'cultivator',passenger.id))).toBe(false);
        const before=game.currentRun(),moment=routineTime(world);
        plans.push(JSON.stringify({action:'interact',target:description,intent:'talk',topic:'hello'}));
        const greeting=await game.act('I greet '+description+' beside me.');
        expect(greeting.toolCalls.some(call=>call.name==='engine.askedAbout'&&call.ok&&call.summary.startsWith('Asked '+passenger.name+' about ')),JSON.stringify(greeting.toolCalls)).toBe(true);
        expect(greeting.narration).toContain(passenger.name);
        expect(thePlayerIsSureItIsThem(passenger.name,game.knowledge.provenanceOf(body.id,'cultivator',passenger.id))).toBe(true);
        expect(game.currentRun().cultivator.standingIn).toBe(deck);
        expect(game.present(game.currentRun().cultivator).some(one=>one.id===passenger.id)).toBe(true);
        plans.push(JSON.stringify({action:'interact',target:passenger.name,intent:'talk',topic:'Where are you bound?'}));
        const reply=await game.act('I ask '+passenger.name+' where they are bound.');
        expect(reply.toolCalls.some(call=>call.name==='engine.askedAbout'&&call.ok&&call.summary.startsWith('Asked '+passenger.name+' about ')),JSON.stringify(reply.toolCalls)).toBe(true);
        const after=game.currentRun(),source=shipPassengerAt(world,receipt.id,routineTime(world))!;
        expect(journeyTimeHasReached(after.run.elapsedDays-before.run.elapsedDays,.25)&&journeyTimeHasReached(.25,after.run.elapsedDays-before.run.elapsedDays)).toBe(true);
        expect(journeyTimeHasReached(routineTime(world)-moment,.25)&&journeyTimeHasReached(.25,routineTime(world)-moment)).toBe(true);
        expect(after.run.turn-before.run.turn).toBe(2);
        expect(after.cultivator.spiritStones).toBe(before.cultivator.spiritStones);
        expect(after.cultivator.standingIn).toBe(deck);
        expect(recordedVoyage(db,body.id)?.receiptId).toBe(receipt.id);
        expect(source.arrived).toBe(false);expect(source.vesselId).toBe(playerQuote.vesselId);
        expect(source.locationId).toBe(worldLocationFor(world,after.cultivator.location)!.id);
        const acceptedIds=new Set(world.npcs.filter(one=>one.activity?.vesselId===source.vesselId&&one.activity.sinceDay===source.departureDay).map(one=>one.id));
        expect(game.present(after.cultivator).every(one=>acceptedIds.has(one.id))).toBe(true);
        expect(game.present(after.cultivator).length).toBeLessThanOrEqual(3);
    } finally {db.close();resetCultivationWorlds();}
});
