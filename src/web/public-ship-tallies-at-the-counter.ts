/** A public ship's bought tally stays an ordinary item until actual boarding. */
import type {GameService} from './turn-engine.js';
import type {Cultivator,Run} from '../schema/cultivation.js';
import type {Execution} from './turn-wire-shapes.js';
import {actualSpiritStones,transferActualSpiritStones} from './transferring-actual-spirit-stones.js';
import {offerTheNextPublicShip,purchaseAcceptedPublicShipTally,publicShipDepartures,freePublicShipSeats,boardThePublicShip,type PublicShipOffer}
    from '../engine/world/the-next-public-ship-is-an-ordinary-trip.js';
import {passageTallyTerms,theHeldPassageTally} from '../engine/world/a-passage-tally-is-the-seat-you-own.js';
import {quotePublicPassage} from '../engine/world/public-shipping.js';
import {routineTime,hourOnTheClock} from '../engine/world/npc-routines.js';
import {readActualDepartureApproach} from '../engine/world/departure-approach.js';
import {locationOfNpcOnItsJourney} from '../engine/world/places-on-the-way.js';
import {theAreasOf} from '../engine/world/where-in-a-place-somebody-is-standing.js';
import {worldLocationFor} from './entities.js';
import {factsForToolResult} from './facts.js';
import {writeTheVoyage,type AVoyage} from './a-ship-at-sea.js';
import type {ObjectRecord} from '../engine/world/possessions.js';
function when(day:number):string{return 'day '+Math.floor(day)+' at '+hourOnTheClock((day%1)*24);}

export function buyPublicShipTally(game:GameService,fromId:string,toId:string,
    buyer:{id:string;name:string},payer:{id:string;name:string},keeperId?:string,acceptedOffer?:PublicShipOffer):
    {ok:true;tally:ObjectRecord;offer:PublicShipOffer}|{ok:false;reason:string} {
    const world=game.atHand;if(!world)return {ok:false,reason:'There is no actual public ship here.'};
    const from=world.locations.find(p=>p.id===fromId),landing=from&&theAreasOf(world,from).areas.find(a=>a.for==='landing');
    if(!from||!landing)return {ok:false,reason:'There is no landing here.'};
    const played=game.currentRun().cultivator;
    if(buyer.id===played.id) {
        if(game.worldPlaceOf(played)!==fromId||played.standingIn!==landing.id)return {ok:false,reason:'You have not reached the landing counter.'};
    } else if(readActualDepartureApproach(world,buyer.id,{intentId:'buy-public-ship-tally',target:{locationId:fromId,areaId:landing.id}},routineTime(world)).kind!=='ready')
        return {ok:false,reason:'The buyer has not reached the landing counter.'};
    const keeper=world.npcs.find(p=>p.id===keeperId&&p.status==='alive');
    if(!keeper||locationOfNpcOnItsJourney(world,keeper,routineTime(world))!==fromId||readActualDepartureApproach(world,keeper.id,
        {intentId:'sell-public-ship-tally',target:{locationId:fromId,areaId:landing.id}},routineTime(world)).kind!=='ready')return {ok:false,reason:'Nobody is here to sell the public ship passage.'};
    const offer=acceptedOffer?{...acceptedOffer,seat:freePublicShipSeats(world,acceptedOffer.departure)[0]??0}:offerTheNextPublicShip(world,fromId,toId);if(!offer)return {ok:false,reason:'The actual public ship cannot accept another run on that route.'};
    const purse=actualSpiritStones(game,payer.id);
    if(purse===null||purse<offer.departure.fareStones)return {ok:false,reason:'The departure on '+when(offer.departure.terms.departureDay)
        +' costs '+offer.departure.fareStones+' spirit stones; the payer has '+purse+'.'};
    const nativeArea=theAreasOf(world,from,undefined,{id:buyer.id,standingIn:landing.id});
    const witnesses=[...nativeArea.whereIs].filter(([,area])=>area===landing.id).map(([id])=>id);
    if(game.worldPlaceOf(played)===fromId&&played.standingIn===landing.id)witnesses.push(played.id,...game.present(played).map(p=>p.id));
    const tally=purchaseAcceptedPublicShipTally(world,offer,buyer,payer,
        (carrier,stones,commit)=>transferActualSpiritStones(game,payer.id,carrier,stones,commit).ok,[...new Set(witnesses)]);
    if(!tally)return {ok:false,reason:'The actual carrier, seat or purses changed before this purchase.'};
    game.theWorldMoved();return {ok:true,tally,offer};
}

export async function publicShipTalliesAtCounter(game:GameService,run:Run,body:Cultivator,toName:string,
    intent:string,said:string,keeperId:string|undefined,boardingAdmission:(purchases?:readonly string[])=>Execution|null):Promise<Execution|null> {
    const world=game.atHand,from=world&&worldLocationFor(world,body.location),to=world&&worldLocationFor(world,toName);
    if(!world||!from||!to)return null;
    const company=game.whoIsWithYouOnTheRoad(body);
    const noImmediateSeat=!quotePublicPassage(world,from.id,to.id,routineTime(world),1+company.length,[],undefined,[body.id,...company.map(p=>p.id)]);
    if(intent!=='ticket'&&intent!=='embark'&&!(intent==='buy'&&(noImmediateSeat||publicShipDepartures(world).some(d=>d.terms.fromId===from.id&&d.terms.toId===to.id))))return null;
    let tally=world.objects.filter(o=>o.possessorId===body.id).find(o=>{const t=passageTallyTerms(o);return t?.service==='ship'&&t.fromId===from.id&&t.toId===to.id;});
    const lines:string[]=[];
    if(intent==='ticket'||!tally) {
        const companions=intent!=='ticket'||/\b(?:tickets|tallies|for us|our)\b/i.test(said)?company:[];
        const groupOffer=offerTheNextPublicShip(world,from.id,to.id,1+companions.length);
        if(!groupOffer)return game.freeAction(run,'passage',factsForToolResult('No single public ship departure can take this requested company.',['Nothing spent; choose who is to travel on the first load.']));
        if(body.spiritStones<groupOffer.departure.fareStones*(1+companions.length))return game.freeAction(run,'passage',factsForToolResult('The payer cannot buy all the requested passage tallies.',
            [(1+companions.length)+' passage tallies cost '+groupOffer.departure.fareStones*(1+companions.length)+' spirit stones; the payer has '+body.spiritStones+'. Nothing spent.']));
        for(const person of [body,...companions]) {
            const purchase=buyPublicShipTally(game,from.id,to.id,person,body,keeperId,groupOffer);
            if(!purchase.ok)return game.freeAction(run,'passage',factsForToolResult(purchase.reason,[...lines,purchase.reason]));
            if(person.id===body.id)tally=purchase.tally;
            if(purchase.offer.fullDepartureDay!==null)lines.push(companions.length?'The departure on '+when(purchase.offer.fullDepartureDay)+' cannot take all the requested passengers.':'The departure on '+when(purchase.offer.fullDepartureDay)+' has no passenger seat.');
            lines.push(purchase.tally.name+': '+purchase.offer.departure.fareStones+' spirit stones paid.');
        }
    }
    if(!tally)return null;
    if(intent==='ticket')return game.freeAction(run,'passage',factsForToolResult('The bought passage tally is in your pack.',lines));
    const t=passageTallyTerms(tally)!,departure=publicShipDepartures(world,t.vesselId).find(d=>d.terms.departureDay===t.departureDay&&d.terms.fromId===t.fromId&&d.terms.toId===t.toId);
    if(!departure)return game.freeAction(run,'passage',factsForToolResult('This tally has no accepted departure here.',['No tally was handed in.']));
    const admission=boardingAdmission(lines);if(admission)return admission;
    const companions=company.filter(p=>theHeldPassageTally(world,p.id,t));
    if(companions.length!==company.length)return game.freeAction(run,'passage',factsForToolResult('Your company does not hold seats on the same departure.',[...lines,'No tally was handed in.']));
    const accepted=boardThePublicShip(world,departure,[body,...companions],{runId:run.id,elapsedDays:run.elapsedDays});
    if(!accepted)return game.freeAction(run,'passage',factsForToolResult('This departure cannot board here yet.',[...lines,
        'The actual ship or its crew cannot receive this departure here now.','Your tally remains for departure on '+when(t.departureDay)+'.']));
    const q=accepted.quote,voyage:AVoyage={receiptId:accepted.receipt.id,from:from.name,bound:to.name,lane:q.lane,sailed:0,
        days:q.days,quoted:q.days,hullRationDays:q.provision.rationDaysAboard,crew:accepted.crew};
    writeTheVoyage(game.db,body.id,voyage);game.theWorldMoved();
    return game.takeTheSeat(run,game.repos.cultivators.getById(body.id)??body,{service:'ship',to:to.name,
        days:q.arrivalDay-routineTime(world),walkingDays:0,stones:0,escort:accepted.crew,sea:voyage,departureOccasion:true,
        bought:'The paid passage tally was handed to the actual crew for boarding.'});
}
