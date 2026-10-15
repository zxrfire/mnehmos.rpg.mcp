/** Public folding tickets use the same held-token and actual counter hand-in authorities. */
import type {GameService} from './turn-engine.js';
import type {Cultivator,Run} from '../schema/cultivation.js';
import type {Execution} from './turn-wire-shapes.js';
import {publicFoldingDepartures,offerPublicFoldingDeparture,purchasePublicFoldingTally,handInPublicFoldingTally}
    from '../engine/world/public-folding-departures.js';
import {passageTallyTerms,theHeldPassageTally} from '../engine/world/a-passage-tally-is-the-seat-you-own.js';
import {quotePassageAtACounter,SPAN_CROSSING_DAYS,type SpanRoute,type PassageQuoteAtACounter} from '../engine/world/buying-passage-at-a-measured-span-counter.js';
import {routineTime} from '../engine/world/npc-routines.js';
import {publicCountersAt} from '../engine/world/public-transport-at-a-place.js';
import {whoKeepsTheCounter} from './who-keeps-a-counter-here.js';
import {transferActualSpiritStones} from './transferring-actual-spirit-stones.js';
import {worldLocationFor} from './entities.js';
import {factsForToolResult,factsForRefusal} from './facts.js';
import {refused} from './tool-result-prose.js';
import {theSlowestOfThem} from '../engine/world/who-is-on-the-road-with-you.js';
import type {NpcRecord} from '../engine/world/npc-state.js';
export function preparePublicFoldingTallies(game:GameService,run:Run,body:Cultivator,route:SpanRoute,intent:string,
    companions:readonly NpcRecord[],quote:PassageQuoteAtACounter,stones:number,rate:number):
    {execution:Execution}|{paid:Cultivator;quote:PassageQuoteAtACounter} {
    const world=game.atHand,origin=world&&worldLocationFor(world,body.location);
    const blocked=(why:string)=>({execution:refused('engine.publicFoldingTally','passage',factsForRefusal(why,why,'No tally was handed in and no crossing was accepted.'))});
    if(!world||!origin)return blocked('There is no actual folding counter here.');
    const keeper=whoKeepsTheCounter(game,body,'span_counter',publicCountersAt(world,origin.name,routineTime(world)));
    if(!keeper)return blocked('Nobody is here to take payment or receive a passage tally at the folding counter.');
    let tally=world.objects.find(o=>o.possessorId===body.id&&passageTallyTerms(o)?.service==='portal'
        &&passageTallyTerms(o)?.vesselId==='span-route:'+route.id);
    let departure=tally?publicFoldingDepartures(world).find(d=>d.route.id===route.id&&d.terms.departureDay===passageTallyTerms(tally!)!.departureDay):null;
    const lines:string[]=[];
    if(intent==='ticket'||!tally) {
        if(body.spiritStones<stones)return blocked('The fare is '+stones+' spirit stones; you have '+body.spiritStones+'. Nothing spent.');
        const immediateDay=intent==='ticket'?undefined:routineTime(world)+quote.daysSpent-quote.settlingDays-SPAN_CROSSING_DAYS;
        departure=offerPublicFoldingDeparture(world,route,keeper.id,immediateDay);
        if(!departure)return blocked('The actual folding attendant cannot accept that departure.');
        const people=[body,...companions],share=Math.floor(stones/people.length),extra=stones%people.length;
        for(let i=0;i<people.length;i++) {
            const person=people[i]!,item=purchasePublicFoldingTally(world,departure,person,body,share+(i<extra?1:0),
                (carrier,fare,commit)=>transferActualSpiritStones(game,body.id,carrier,fare,commit).ok,
                [body.id,...game.present(body).map(p=>p.id)]);
            if(!item)return blocked('The actual carrier or purse changed before the tally could be bought.');
            if(person.id===body.id)tally=item;lines.push(item.name+': '+passageTallyTerms(item)!.fareStones+' spirit stones paid.');
        }
        game.theWorldMoved();
    }
    if(!tally||!departure)return blocked('This tally has no accepted departure at this counter.');
    if(intent==='ticket')return {execution:game.freeAction(run,'passage',factsForToolResult('The bought passage tally is in your pack.',lines))};
    if(departure.operatorId!==keeper.id)return blocked('The person receiving this departure is not here at the counter.');
    const people=[body,...companions];
    if(people.some(p=>!theHeldPassageTally(world,p.id,departure!.terms)))return blocked('Your company does not hold seats on the same folding departure.');
    const base=quotePassageAtACounter(route,{heads:people.length,worstPassengerOrdinal:theSlowestOfThem(body.realmOrdinal,companions),
        cashPerWalkedDayReplaced:rate,onDay:Math.max(routineTime(world),departure.terms.departureDay)});
    // The accepted session supplies the wait. The existing authority supplies crossing and recovery.
    const leaves=base.nextDepartureDay??Math.max(routineTime(world),departure.terms.departureDay);
    const wait=Math.max(0,leaves-routineTime(world));
    quote={...base,openToday:wait===0,nextDepartureDay:wait===0?null:leaves,
        daysSpent:wait+SPAN_CROSSING_DAYS+base.settlingDays,daysSavedAgainstWalking:Math.max(0,route.walkedDaysItReplaces-wait-SPAN_CROSSING_DAYS-base.settlingDays)};
    for(const person of people)if(!handInPublicFoldingTally(world,departure,person))return blocked('The actual folding attendant cannot receive that tally.');
    game.theWorldMoved();return {paid:game.repos.cultivators.getById(body.id)??body,quote};
}

export function heldFoldingDestination(game:GameService,body:Cultivator):string|undefined {
    const world=game.atHand;if(!world)return undefined;
    const origin=game.worldPlaceOf(body);
    const terms=world.objects.filter(o=>o.possessorId===body.id).map(passageTallyTerms).find(t=>t?.service==='portal'&&t.fromId===origin);
    return terms?world.locations.find(p=>p.id===terms.toId)?.name:undefined;
}
