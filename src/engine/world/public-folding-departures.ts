/** Accepted crossings use the published opening and the ordinary departure queue. */
import {makeScheduledEffect,type WorldState,type ScheduledEffect} from './world-state.js';
import {routineTime} from './npc-routines.js';
import {LOCAL_WALK_DAYS} from './local-walking-cost.js';
import {SPAN_ROUTES} from './where-the-measured-span-still-answers.js';
import {quotePassageAtACounter,SPAN_CROSSING_DAYS,settlingDaysForPassenger,type SpanRoute} from './buying-passage-at-a-measured-span-counter.js';
import {worldLocationFor} from './place-lookup.js';
import {passageDepartureKey,passageTallyTerms,passageTalliesForDeparture,makePassageTally,theHeldPassageTally,
    handInPassageTally,unusedPassageTalliesGoToDust,type TallyDeparture} from './a-passage-tally-is-the-seat-you-own.js';
import {makeFact} from './history.js';
import {appendWorldFact} from './who-was-there-when-it-happened.js';
import {factsWithDataValue} from './witness-reaction-index.js';
import {locationOfNpcOnItsJourney} from './places-on-the-way.js';
import {theAreasOf} from './where-in-a-place-somebody-is-standing.js';
import {readActualDepartureApproach} from './departure-approach.js';
import {PLAYER_ROW_TAG,setLocation} from './npc-state.js';
import {companyAgreement} from './company-during-a-passage.js';
import type {ObjectRecord} from './possessions.js';
export interface FoldingDeparture {effect:ScheduledEffect;terms:TallyDeparture;route:SpanRoute;operatorId:string}
export function foldingDepartureIn(world:WorldState,effect:ScheduledEffect):FoldingDeparture|null {
    const d=effect.data,route=SPAN_ROUTES.find(r=>r.id===d.spanRouteId);
    if(d.publicCarrierDeparture!==true||d.service!=='portal'||!route||typeof d.operatorId!=='string')return null;
    const from=worldLocationFor(world,route.fromPlace),to=worldLocationFor(world,route.toPlace);
    if(!from||!to||d.fromLocationId!==from.id||d.toLocationId!==to.id)return null;
    return {effect,route,operatorId:d.operatorId,terms:{service:'portal',vesselId:'span-route:'+route.id,
        fromId:from.id,toId:to.id,departureDay:effect.dueOnDay}};
}
export function publicFoldingDepartures(world:WorldState):FoldingDeparture[]{return world.schedule.flatMap(e=>{const d=foldingDepartureIn(world,e);return d?[d]:[];}).sort((a,b)=>a.terms.departureDay-b.terms.departureDay);}
/** Advance buying has the existing loading walk; an immediate crossing keeps its quoted departure. */
export function offerPublicFoldingDeparture(world:WorldState,route:SpanRoute,operatorId:string,immediateDay?:number):FoldingDeparture|null {
    const from=worldLocationFor(world,route.fromPlace),to=worldLocationFor(world,route.toPlace),now=routineTime(world);
    if(!from||!to)return null;
    const keeper=world.npcs.find(p=>p.id===operatorId&&p.status==='alive');
    if(!keeper||locationOfNpcOnItsJourney(world,keeper,now)!==from.id)return null;
    const existing=publicFoldingDepartures(world).find(d=>d.route.id===route.id&&d.terms.departureDay>=now&&d.operatorId===operatorId);
    if(existing)return existing;
    const ready=immediateDay??now+LOCAL_WALK_DAYS,q=quotePassageAtACounter(route,{heads:1,worstPassengerOrdinal:0,cashPerWalkedDayReplaced:1,onDay:ready});
    const day=q.nextDepartureDay??ready,terms:TallyDeparture={service:'portal',vesselId:'span-route:'+route.id,fromId:from.id,toId:to.id,departureDay:day};
    const effect=makeScheduledEffect({id:'public-departure:'+passageDepartureKey(terms),kind:'meeting',locationId:from.id,dueOnDay:day,
        actorIds:[operatorId],summary:'The accepted public folding crossing falls due.',data:{publicCarrierDeparture:true,service:'portal',
            spanRouteId:route.id,operatorId,fromLocationId:from.id,toLocationId:to.id}});
    return {effect,route,terms,operatorId};
}
export function purchasePublicFoldingTally(world:WorldState,departure:FoldingDeparture,buyer:{id:string;name:string},payer:{id:string;name:string},
    fare:number,pay:(carrier:string,stones:number,commit:()=>void)=>boolean,witnessIds:readonly string[]=[]):ObjectRecord|null {
    if(!Number.isInteger(fare)||fare<0||buyer.id===departure.operatorId)return null;
    const t=departure.terms;
    const used=[...passageTalliesForDeparture(world,t).map(o=>passageTallyTerms(o)!.seat),
        ...factsWithDataValue(world,'publicDepartureId',departure.effect.id).flatMap(f=>typeof f.data.seat==='number'?[f.data.seat]:[])];
    const seat=Math.max(0,...used)+1;let tally:ObjectRecord|null=null;
    const paid=pay(departure.operatorId,fare,()=>{
        if(!world.schedule.some(e=>e.id===departure.effect.id))world.schedule.push(departure.effect);
        const f=appendWorldFact(world,makeFact({day:routineTime(world),kind:'gathering',visibility:'secret',locationId:t.fromId,witnessIds:[...witnessIds],
            actors:[{...buyer,role:'buyer'},{...payer,role:'payer'}],summary:'A passage tally was bought for its named public folding departure.',
            data:{passageTallyPurchase:true,publicDepartureId:departure.effect.id,service:'portal',vesselId:t.vesselId,
                fromLocationId:t.fromId,toLocationId:t.toId,departureDay:t.departureDay,seat,fareStones:fare,stones:buyer.id===payer.id?fare:0,
                receiverId:departure.operatorId,payerId:payer.id}}),{bystanders:false,recur:false});
        tally=makePassageTally({terms:{...t,seat,fareStones:fare},buyer,purchase:f,onDay:routineTime(world),fromName:departure.route.fromPlace,toName:departure.route.toPlace});world.objects.push(tally);
        const at=world.npcs.findIndex(p=>p.id===buyer.id),person=world.npcs[at];
        if(person&&!person.tags.includes(PLAYER_ROW_TAG))world.npcs[at]={...person,activity:{kind:'waiting_for_a_departure',
            note:'Waiting to use the bought passage tally.',withIds:person.activity?.withIds??[],sinceDay:routineTime(world),untilDay:t.departureDay,
            returnTo:t.toId,passageTallyId:tally.id,publicDepartureId:departure.effect.id,standingIn:person.activity?.standingIn,
            passageCompany:companyAgreement(person.activity,routineTime(world))??undefined}};
    });return paid?tally:null;
}
/** The actual counter hand-in is an ordinary transfer followed by deletion. */
export function handInPublicFoldingTally(world:WorldState,departure:FoldingDeparture,person:{id:string;name:string}):boolean {
    const terms=handInPassageTally(world,person.id,departure.terms,departure.operatorId);if(!terms)return false;
    appendWorldFact(world,makeFact({day:routineTime(world),kind:'gathering',visibility:'secret',locationId:terms.fromId,
        actors:[{...person,role:'passenger'}],summary:'A paid passenger handed in the passage tally at the folding counter.',
        data:{publicDepartureId:departure.effect.id,publicFoldingBoarding:true,seat:terms.seat,fromLocationId:terms.fromId,toLocationId:terms.toId,
            departureDay:terms.departureDay}}),{bystanders:false,recur:false});return true;
}
/** A staffed published opening runs its accepted crossing; no printed-day item sweep. */
export function settleDuePublicFoldingDepartures(world:WorldState,day=routineTime(world)):void {
    for(const effect of [...world.schedule])if(effect.data.publicFoldingArrival===true&&effect.dueOnDay<=day) {
        const id=effect.actorIds[0],at=world.npcs.findIndex(p=>p.id===id),person=world.npcs[at];
        if(person?.status==='alive'&&!person.tags.includes(PLAYER_ROW_TAG)&&typeof effect.data.toLocationId==='string'
            &&person.activity?.kind==='waiting_for_a_departure'&&person.activity.publicDepartureId===effect.data.departureId
            &&person.activity.untilDay===effect.dueOnDay&&person.locationId===null) {
            const end=effect.dueOnDay+settlingDaysForPassenger(person.cultivation.realmOrdinal);
            world.npcs[at]={...setLocation(person,effect.data.toLocationId,effect.dueOnDay),activity:{kind:'mending',note:'Recovering after the public folding crossing.',
                withIds:[],sinceDay:effect.dueOnDay,untilDay:end}};
        }
        world.schedule=world.schedule.filter(e=>e.id!==effect.id);
    }
    for(const departure of publicFoldingDepartures(world)) {
        if(departure.terms.departureDay>day)continue;
        const worker=world.npcs.find(p=>p.id===departure.operatorId&&p.status==='alive');
        const from=world.locations.find(p=>p.id===departure.terms.fromId)!,area=theAreasOf(world,from).areas.find(a=>a.for==='span_counter');
        if(!worker||readActualDepartureApproach(world,worker.id,{intentId:departure.effect.id,target:{locationId:from.id,areaId:area?.id??null}},day).kind!=='ready')continue;
        const q=quotePassageAtACounter(departure.route,{heads:1,worstPassengerOrdinal:0,cashPerWalkedDayReplaced:1,onDay:day});
        if(!q.openToday)continue;
        for(const id of world.npcs.filter(p=>p.status==='alive'&&!p.tags.includes(PLAYER_ROW_TAG)&&p.activity?.kind==='waiting_for_a_departure'
            &&p.activity.publicDepartureId===departure.effect.id&&theHeldPassageTally(world,p.id,departure.terms)).map(p=>p.id)) {
            const at=world.npcs.findIndex(p=>p.id===id),person=world.npcs[at]!;
            if(readActualDepartureApproach(world,id,{intentId:departure.effect.id,target:{locationId:from.id,areaId:area?.id??null}},day).kind!=='ready')continue;
            if(!handInPublicFoldingTally(world,departure,person))continue;
            const current=world.npcs.find(p=>p.id===id)!;
            world.npcs[at]={...setLocation(current,null,day),activity:{kind:'waiting_for_a_departure',note:'Crossing through the public fold.',
                withIds:current.activity?.withIds??[],sinceDay:day,untilDay:day+SPAN_CROSSING_DAYS,returnTo:departure.terms.toId,publicDepartureId:departure.effect.id,
                passageCompany:companyAgreement(current.activity,day)??undefined}};
            world.schedule.push(makeScheduledEffect({id:departure.effect.id+':arrival:'+id,kind:'meeting',dueOnDay:day+SPAN_CROSSING_DAYS,
                locationId:departure.terms.toId,actorIds:[id],summary:'The public folding crossing reaches its surveyed destination.',
                data:{publicFoldingArrival:true,toLocationId:departure.terms.toId,departureId:departure.effect.id,publicCarrierDeparture:true}}));
        }
        unusedPassageTalliesGoToDust(world,departure.terms,day);
        appendWorldFact(world,makeFact({day,kind:'gathering',locationId:from.id,actors:[{id:worker.id,name:worker.name,role:'carrier'}],
            summary:'The public folding departure crossed to its surveyed destination.',data:{publicDepartureCompleted:departure.effect.id,publicCarrierDeparture:true,
                service:'portal',fromLocationId:from.id,toLocationId:departure.terms.toId}}),{recur:false});
        world.schedule=world.schedule.filter(e=>e.id!==departure.effect.id);
    }
}
