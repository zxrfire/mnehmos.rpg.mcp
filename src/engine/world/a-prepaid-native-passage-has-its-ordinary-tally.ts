/** Already paid native fares settle to real crew through ordinary physical tallies. */
import type {WorldState} from './world-state.js';
import type {HistoricalFact} from './history.js';
import {makeFact} from './history.js';
import {appendWorldFact} from './who-was-there-when-it-happened.js';
import {factsWithDataValue,witnessIndexFor} from './witness-reaction-index.js';
import {PLAYER_ROW_TAG} from './npc-state.js';
import {makePassageTally,theHeldPassageTally,passageTalliesForDeparture,passageTallyTerms} from './a-passage-tally-is-the-seat-you-own.js';
import {publicShipLinesFrom,publicShipPassengerBerths,type PublicPassageLeg} from './public-shipping.js';
import {stonesFor} from './the-fare-and-calendar-of-a-passage.js';

/** The personal debit is held by its activity until this actual receipt exists.
 * A mission's existing dispatch is its prepaid authority; neither is charged twice. */
export function settlePrepaidNativeBoardingTallies(world:WorldState,leg:PublicPassageLeg,receipt:HistoricalFact,
    receiverId:string,people:readonly {id:string;name:string}[],onDay:number):void {
    if(receipt.data.publicPassage!==true||receipt.data.actualBoarding!==true)return;
    const terms={...leg,service:'ship' as const,departureDay:leg.tallyDepartureDay??leg.departureDay};
    const from=world.locations.find(p=>p.id===leg.fromId),to=world.locations.find(p=>p.id===leg.toId);
    if(!from||!to)return;
    const listed=publicShipLinesFrom(world,from.name,leg.departureDay).find(l=>l.to===to.name);
    if(!listed)return;
    const fare=stonesFor(listed.cashPerSeat);
    const related=factsWithDataValue(world,'vesselId',leg.vesselId).filter(f=>f.data.fromLocationId===leg.fromId
        &&f.data.toLocationId===leg.toId&&f.data.departureDay===terms.departureDay);
    const prior=related.filter(f=>f.data.passageTallyPurchase===true);
    const used=new Set([...passageTalliesForDeparture(world,terms).map(o=>passageTallyTerms(o)!.seat),
        ...prior.flatMap(f=>typeof f.data.seat==='number'?[f.data.seat]:[])]);
    const currentIds=new Set(people.map(p=>p.id)),alreadyTicketed=new Set(prior.flatMap(f=>f.actors.filter(a=>a.role==='buyer').map(a=>a.id)));
    const crew=new Set(world.npcs.filter(p=>p.tags.includes('crew-of:'+leg.vesselId)).map(p=>p.id));
    const unticketedOthers=new Set(related.filter(f=>f.data.publicPassage===true&&f.data.actualBoarding===true)
        .flatMap(f=>f.actors.filter(a=>a.role==='aboard'&&!crew.has(a.id)&&!currentIds.has(a.id)&&!alreadyTicketed.has(a.id)).map(a=>a.id)));
    const capacity=publicShipPassengerBerths(world,leg.vesselId);
    const freeSeat=()=>Array.from({length:capacity},(_,i)=>i+1).find(n=>!used.has(n));
    for(const ignored of unticketedOthers){void ignored;const seat=freeSeat();if(seat)used.add(seat);}
    for(const who of people) {
        const person=world.npcs.find(p=>p.id===who.id);
        if(!person||person.tags.includes(PLAYER_ROW_TAG)||theHeldPassageTally(world,person.id,terms))continue;
        if(prior.some(f=>f.actors.some(a=>a.id===person.id&&a.role==='buyer')))continue;
        const own=person.activity?.publicFarePaid;
        const funding=person.activity?.capitalMissionId?witnessIndexFor(world).byId.get(person.activity.capitalMissionId):undefined;
        const prepaid=typeof own==='number'&&Number.isFinite(own)&&own>=0?own:null;
        const sponsor=prepaid===null&&funding?.data.publicMission===true&&typeof funding.data.publicFareStones==='number'
            &&Number.isFinite(funding.data.publicFareStones)&&funding.data.publicFareStones>=0
            &&funding.actors.some(a=>a.id===person.id)?funding:undefined;
        if(prepaid===null&&!sponsor)continue;
        const allocated=sponsor?factsWithDataValue(world,'publicFareFundingId',sponsor.id)
            .reduce((sum,f)=>sum+(typeof f.data.fareStones==='number'?f.data.fareStones:0),0):0;
        if(sponsor&&allocated+fare>Number(sponsor.data.publicFareStones))continue;
        const payerId=prepaid!==null?person.id:typeof sponsor!.data.publicPayerId==='string'?sponsor!.data.publicPayerId:sponsor!.factionIds[0];
        const payer=world.npcs.find(p=>p.id===payerId)??world.factions.find(h=>h.id===payerId);
        const carrier=world.npcs.find(p=>p.id===receiverId&&p.status==='alive'),seat=freeSeat();
        if(!payer||!carrier||!seat)continue;
        const paid=prepaid??fare;used.add(seat);
        // The payer's canonical debit already happened. Credit the actual current carrier before facts replace NPC rows.
        carrier.spiritStones+=paid;
        const purchase=appendWorldFact(world,makeFact({day:onDay,kind:'gathering',visibility:'secret',locationId:leg.fromId,
            witnessIds:[person.id,carrier.id],causes:sponsor?[sponsor.id]:[],
            actors:[{id:person.id,name:person.name,role:'buyer'},{id:payer.id,name:payer.name,role:'payer'},
                {id:carrier.id,name:carrier.name,role:'carrier'}],summary:'The prepaid native public passage supplied its physical tally at boarding.',
            data:{passageTallyPurchase:true,nativePaidBoardingTally:true,service:'ship',vesselId:leg.vesselId,
                fromLocationId:leg.fromId,toLocationId:leg.toId,departureDay:terms.departureDay,seat,fareStones:paid,
                stones:prepaid!==null?paid:0,payerId:payer.id,receiverId:carrier.id,
                ...(sponsor?{publicFareFundingId:sponsor.id}:{})}}),{bystanders:false,recur:false});
        world.objects.push(makePassageTally({terms:{...terms,seat,fareStones:paid},buyer:person,purchase,
            onDay,fromName:from.name,toName:to.name}));
        const at=world.npcs.findIndex(p=>p.id===person.id),current=world.npcs[at]!;
        if(current.activity){const activity={...current.activity};delete activity.publicFarePaid;world.npcs[at]={...current,activity};}
    }
}
