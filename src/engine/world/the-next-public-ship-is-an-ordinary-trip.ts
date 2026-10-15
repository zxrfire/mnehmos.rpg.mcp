import {workersAtPublicCounters} from './who-is-working-at-a-public-counter.js';
import {publicCountersAt} from './public-transport-at-a-place.js';
/** Bought public sailings are finite ordinary appointments on the existing lane hull. */
import {makeScheduledEffect,type ScheduledEffect,type WorldState} from './world-state.js';
import {routineTime} from './npc-routines.js';
import {LOCAL_WALK_DAYS} from './local-walking-cost.js';
import {publicShipLinesFrom,publicShipPassengerBerths,quotePublicPassage,earliestQuotedPublicPassage,
    recordPublicPassage,onSponsoredPublicPassage,type PublicPassageQuote,type PublicPassageLeg} from './public-shipping.js';
import {shipIdForLane} from './the-ship-on-a-lane.js';
import {passageDepartureKey,passageTalliesForDeparture,passageTallyTerms,theHeldPassageTally,makePassageTally,unusedPassageTalliesGoToDust,whatStopsHandingInPassageTally,type TallyDeparture} from './a-passage-tally-is-the-seat-you-own.js';
import {factsWithDataValue} from './witness-reaction-index.js';
import {locationOfNpcOnItsJourney} from './places-on-the-way.js';
import {makeFact,type HistoricalFact} from './history.js';
import {appendWorldFact} from './who-was-there-when-it-happened.js';
import {ensureShipCrew,bindShipCrewToPassage} from './ship-crew.js';
import {realiseAcceptedPublicShipSource,publicShipHullCanBeBoarded} from './a-public-ship-hull.js';
import {companyAgreement} from './company-during-a-passage.js';
import {PLAYER_ROW_TAG,activeGoals,type NpcRecord} from './npc-state.js';
import type {PassageRunMoment} from './passage-moment.js';
import {readActualDepartureApproach} from './departure-approach.js';
import {theAreasOf} from './where-in-a-place-somebody-is-standing.js';
import {isRuined,type ObjectRecord} from './possessions.js';
import {whoItIsWith} from './a-vehicle.js';

export interface PublicShipDeparture {
    effect:ScheduledEffect;terms:TallyDeparture;operatorId:string|null;
    arrivalDay:number;fareStones:number;leg:PublicPassageLeg;
}
export function shipDepartureIn(world:WorldState,effect:ScheduledEffect):PublicShipDeparture|null {
    const d=effect.data;
    if(d.publicCarrierDeparture!==true||d.service!=='ship'||typeof d.vesselId!=='string'
        ||typeof d.fromLocationId!=='string'||typeof d.toLocationId!=='string'
        ||typeof d.arrivalDay!=='number'||typeof d.fareStones!=='number'||typeof d.seaLaneId!=='string')return null;
    const from=world.locations.find(p=>p.id===d.fromLocationId),to=world.locations.find(p=>p.id===d.toLocationId);
    const line=from&&to?publicShipLinesFrom(world,from.name,effect.dueOnDay).find(l=>l.to===to.name&&l.lane.id===d.seaLaneId):null;
    if(!line||shipIdForLane(line.lane)!==d.vesselId)return null;
    const terms:TallyDeparture={service:'ship',vesselId:d.vesselId,fromId:d.fromLocationId,toId:d.toLocationId,departureDay:effect.dueOnDay};
    return {effect,terms,operatorId:typeof d.operatorId==='string'?d.operatorId:null,arrivalDay:d.arrivalDay,fareStones:d.fareStones,
        leg:{lane:line.lane,vesselId:terms.vesselId,fromId:terms.fromId,toId:terms.toId,departureDay:terms.departureDay,arrivalDay:d.arrivalDay}};
}
export function publicShipDepartures(world:WorldState,vesselId?:string):PublicShipDeparture[] {
    return world.schedule.flatMap(effect=>{
        const departure=shipDepartureIn(world,effect);
        return departure&&(!vesselId||departure.terms.vesselId===vesselId)
            &&!factsWithDataValue(world,'publicDepartureCompleted',effect.id).length?[departure]:[];
    }).sort((a,b)=>a.terms.departureDay-b.terms.departureDay);
}
export function freePublicShipSeats(world:WorldState,departure:PublicShipDeparture):number[] {
    const used=new Set(passageTalliesForDeparture(world,departure.terms).map(o=>passageTallyTerms(o)!.seat));
    for(const f of factsWithDataValue(world,'publicDepartureId',departure.effect.id)) {
        if(f.data.publicPassage!==true||typeof f.data.passageTallySeats!=='string')continue;
        const rows:unknown=JSON.parse(f.data.passageTallySeats);
        if(Array.isArray(rows))for(const row of rows)if(typeof row?.seat==='number')used.add(row.seat);
    }
    return Array.from({length:publicShipPassengerBerths(world,departure.terms.vesselId)},(_,i)=>i+1).filter(n=>!used.has(n));
}
export interface PublicShipOffer {departure:PublicShipDeparture;newAppointments:ScheduledEffect[];seat:number;fullDepartureDay:number|null}

/** Quoting the next load creates neither a crew nor a hull nor a passenger. */
export function offerTheNextPublicShip(world:WorldState,fromId:string,toId:string,heads=1):PublicShipOffer|null {
    const now=routineTime(world),from=world.locations.find(p=>p.id===fromId),to=world.locations.find(p=>p.id===toId);
    const line=from&&to?publicShipLinesFrom(world,from.name,now).find(l=>l.to===to.name):null;
    if(!line)return null;
    const vesselId=shipIdForLane(line.lane);
    if(!Number.isInteger(heads)||heads<1||heads>publicShipPassengerBerths(world,vesselId))return null;
    const jobs=publicShipDepartures(world,vesselId);
    let fullDepartureDay:number|null=null;
    for(const departure of jobs) {
        if(departure.terms.fromId!==fromId||departure.terms.toId!==toId)continue;
        const free=freePublicShipSeats(world,departure);
        if(free.length>=heads)return {departure,newAppointments:[],seat:free[0]!,fullDepartureDay};
        fullDepartureDay??=departure.terms.departureDay;
    }
    const hull=world.objects.find(o=>o.id===vesselId);
    const operator=world.npcs.find(p=>p.status==='alive'&&p.identity.occupation==='shipmaster'&&p.tags.includes('crew-of:'+vesselId));
    if(hull&&(isRuined(hull)||!operator||whoItIsWith(hull)!==operator.id))return null;
    const last=jobs.at(-1),doing=operator?.activity;
    let ready=now,position=operator?locationOfNpcOnItsJourney(world,operator,now):fromId;
    if(doing?.kind==='travelling'&&doing.vesselId===vesselId&&doing.untilDay!=null&&doing.untilDay>now) {
        ready=doing.untilDay;position=doing.returnTo??null;
    }
    if(last){ready=Math.max(ready,last.arrivalDay);position=last.terms.toId;}
    if(position!==fromId&&position!==toId)return null;
    const considered:PublicPassageLeg[]=jobs.map(d=>d.leg),additions:ScheduledEffect[]=[];
    const propose=(origin:string,destination:string,after:number):PublicShipDeparture|null=>{
        const q:PublicPassageQuote|null=earliestQuotedPublicPassage(world,origin,destination,after,Number.MAX_SAFE_INTEGER,1,considered);
        if(!q||q.vesselId!==vesselId)return null;
        const terms:TallyDeparture={service:'ship',vesselId,fromId:origin,toId:destination,departureDay:q.departureDay};
        const effect=makeScheduledEffect({id:'public-departure:'+passageDepartureKey(terms),kind:'meeting',dueOnDay:q.departureDay,
            locationId:origin,actorIds:operator?[operator.id]:[],summary:'The accepted public ship departure falls due.',
            data:{publicCarrierDeparture:true,service:'ship',vesselId,operatorId:operator?.id??null,
                fromLocationId:origin,toLocationId:destination,arrivalDay:q.arrivalDay,seaLaneId:q.lane.id,fareStones:q.fareStones}});
        additions.push(effect);considered.push(q);return shipDepartureIn(world,effect);
    };
    if(position!==fromId) {
        const back=propose(position!,fromId,ready+LOCAL_WALK_DAYS);if(!back)return null;ready=back.arrivalDay;
    }
    const departure=propose(fromId,toId,ready+LOCAL_WALK_DAYS);
    return departure?{departure,newAppointments:additions,seat:1,fullDepartureDay}:null;
}

/** A held tally's boarding asks the existing sailing authority again at its actual clock. */
export function quoteBoardingThePublicShip(world:WorldState,departure:PublicShipDeparture,ids:readonly string[]):PublicPassageQuote|null {
    const quote=quotePublicPassage({...world,schedule:world.schedule.filter(e=>e.id!==departure.effect.id)},departure.terms.fromId,departure.terms.toId,
        Math.max(routineTime(world),departure.terms.departureDay),ids.length,[],undefined,ids,undefined,departure.terms.departureDay);
    return quote?{...quote,publicDepartureId:departure.effect.id,tallyDepartureDay:departure.terms.departureDay}:null;
}

/** A bought run is real work promised by the same master and ordinary crew. */
export function acceptPublicShipOffer(world:WorldState,offer:PublicShipOffer,publish=true):NpcRecord|null {
    let master=world.npcs.find(p=>p.status==='alive'&&p.tags.includes('crew-of:'+offer.departure.terms.vesselId)&&p.identity.occupation==='shipmaster');
    if(!world.objects.some(o=>o.id===offer.departure.terms.vesselId)) {
        const crew=ensureShipCrew(world,offer.departure.leg.lane,offer.departure.terms.fromId,routineTime(world));
        master=crew.find(p=>p.identity.occupation==='shipmaster');
    }
    if(!master||!realiseAcceptedPublicShipSource(world,offer.departure.leg,master))return null;
    if(!publish)return master;
    for(const effect of offer.newAppointments)if(!world.schedule.some(old=>old.id===effect.id)) {
        effect.data.operatorId=master.id;effect.actorIds=[master.id];world.schedule.push(effect);
    }
    return world.npcs.find(p=>p.id===master!.id)!;
}

export function waitForThePublicShip(world:WorldState,person:NpcRecord,tally:ObjectRecord):void {
    if(person.tags.includes(PLAYER_ROW_TAG))return;
    const terms=passageTallyTerms(tally)!,at=world.npcs.findIndex(p=>p.id===person.id);
    const company=companyAgreement(person.activity,routineTime(world));
    world.npcs[at]={...person,activity:{kind:'waiting_for_a_departure',note:'Waiting to use the bought passage tally.',
        withIds:company?.withIds??[],sinceDay:routineTime(world),untilDay:terms.departureDay,
        returnTo:terms.toId,passageTallyId:tally.id,publicDepartureId:'public-departure:'+passageDepartureKey(terms),
        standingIn:person.activity?.standingIn,
        ...(person.activity?.capitalMissionId?{capitalMissionId:person.activity.capitalMissionId,capitalMissionLeg:person.activity.capitalMissionLeg,capitalMissionWaiting:person.activity.capitalMissionWaiting}:{}),
        ...(company?{passageCompany:company}:{})}};
}

/** The ordinary purse writer pays the actual carrier; the item remains with its buyer. */
export function purchaseAcceptedPublicShipTally(world:WorldState,offer:PublicShipOffer,
    buyer:{id:string;name:string},payer:{id:string;name:string},
    pay:(carrierId:string,stones:number,commit:()=>void)=>boolean,witnessIds:readonly string[]=[]):ObjectRecord|null {
    if(!freePublicShipSeats(world,offer.departure).includes(offer.seat))return null;
    const master=acceptPublicShipOffer(world,offer,false);if(!master||master.id===buyer.id)return null;
    let tally:ObjectRecord|null=null;
    const paid=pay(master.id,offer.departure.fareStones,()=>{
        acceptPublicShipOffer(world,offer);
        const t=offer.departure.terms;
        const purchase=appendWorldFact(world,makeFact({day:routineTime(world),kind:'gathering',visibility:'secret',
            locationId:t.fromId,witnessIds:[...witnessIds],actors:[{...buyer,role:'buyer'},{...payer,role:'payer'},
                {id:master.id,name:master.name,role:'carrier'}],summary:'A passage tally was bought for its named public ship departure.',
            data:{passageTallyPurchase:true,publicDepartureId:offer.departure.effect.id,service:t.service,vesselId:t.vesselId,
                fromLocationId:t.fromId,toLocationId:t.toId,departureDay:t.departureDay,seat:offer.seat,
                fareStones:offer.departure.fareStones,stones:buyer.id===payer.id?offer.departure.fareStones:0,
                payerId:payer.id,receiverId:master.id}}),{bystanders:false,recur:false});
        tally=makePassageTally({terms:{...t,seat:offer.seat,fareStones:offer.departure.fareStones},buyer,purchase,
            onDay:routineTime(world),fromName:world.locations.find(p=>p.id===t.fromId)!.name,toName:world.locations.find(p=>p.id===t.toId)!.name});
        world.objects.push(tally);const person=world.npcs.find(p=>p.id===buyer.id);if(person)waitForThePublicShip(world,person,tally);
    });return paid?tally:null;
}

/** An exact native counter purchase also settles a fare allocated by the rates planner. */
export function buyTheNextPublicShipForANative(world:WorldState,id:string,fromId:string,toId:string):NpcRecord|null {
    const person=world.npcs.find(p=>p.id===id&&p.status==='alive'&&!p.tags.includes(PLAYER_ROW_TAG));
    const from=world.locations.find(p=>p.id===fromId),landing=from&&theAreasOf(world,from).areas.find(a=>a.for==='landing');
    if(!person||!from||!landing||person.locationId!==fromId)return null;
    const paid=person.activity?.publicFarePaid??0;
    if(!Number.isFinite(paid)||paid<0||person.activity?.standingIn&&person.activity.standingIn!==landing.id)return null;
    if(!paid&&readActualDepartureApproach(world,id,{intentId:'buy-next-native-public-ship',target:{locationId:fromId,areaId:landing.id}},routineTime(world)).kind!=='ready')return null;
    const locals=world.npcs.filter(p=>p.status==='alive'&&locationOfNpcOnItsJourney(world,p,routineTime(world))===fromId);
    const keeper=workersAtPublicCounters(world,from.name,locals,publicCountersAt(world,from.name,routineTime(world))).get('landing');
    if(!keeper)return null;
    let offer:PublicShipOffer|null=null;
    const doing=person.activity;
    if(paid>0&&doing?.kind==='travelling'&&doing.sinceDay>routineTime(world)&&doing.fromLocationId===fromId&&doing.returnTo===toId) {
        // Other unresolved rate estimates are not physical tickets or actual boardings.
        const quotedWorld={...world,npcs:world.npcs.filter(p=>p.activity?.publicFarePaid===undefined)};
        const quote=quotePublicPassage(quotedWorld,fromId,toId,doing.sinceDay,1,[],undefined,[]);
        if(quote) {
            const terms:TallyDeparture={service:'ship',vesselId:quote.vesselId,fromId,toId,departureDay:quote.departureDay};
            const existing=publicShipDepartures(world,quote.vesselId).find(d=>d.terms.fromId===fromId&&d.terms.toId===toId&&d.terms.departureDay===quote.departureDay);
            const operator=world.npcs.find(p=>p.status==='alive'&&p.tags.includes('crew-of:'+quote.vesselId)&&p.identity.occupation==='shipmaster');
            const effect=existing?.effect??makeScheduledEffect({id:'public-departure:'+passageDepartureKey(terms),kind:'meeting',
                dueOnDay:quote.departureDay,locationId:fromId,actorIds:operator?[operator.id]:[],summary:'The accepted public ship departure falls due.',
                data:{publicCarrierDeparture:true,service:'ship',vesselId:quote.vesselId,operatorId:operator?.id??null,
                    fromLocationId:fromId,toLocationId:toId,arrivalDay:quote.arrivalDay,seaLaneId:quote.lane.id,fareStones:quote.fareStones}});
            const departure=existing??shipDepartureIn(world,effect);
            const seat=departure?freePublicShipSeats(world,departure)[0]:undefined;
            if(departure&&seat)offer={departure,newAppointments:existing?[]:[effect],seat,fullDepartureDay:null};
        }
    }
    offer??=offerTheNextPublicShip(world,fromId,toId);
    if(!offer||person.spiritStones+paid<offer.departure.fareStones)return null;
    const tally=purchaseAcceptedPublicShipTally(world,offer,person,person,(carrierId,stones,commit)=>{
        const payer=world.npcs.find(p=>p.id===id)!,carrier=world.npcs.find(p=>p.id===carrierId);
        if(!carrier||payer.spiritStones+paid<stones||(payer.activity?.publicFarePaid??0)!==paid)return false;
        payer.spiritStones+=paid-stones;carrier.spiritStones+=stones;commit();return true;
    },[person.id,keeper.id]);
    if(!tally)return null;
    const at=world.npcs.findIndex(p=>p.id===id),current=world.npcs[at]!;
    if(current.activity)world.npcs[at]={...current,activity:{...current.activity,standingIn:landing.id}};
    return world.npcs[at]!;
}

/** Boarding binds only actual passengers and crew, leaving the SQL player's body to its adapter. */
export function boardThePublicShip(world:WorldState,departure:PublicShipDeparture,
    people:readonly {id:string;name:string}[],moment?:PassageRunMoment):{receipt:HistoricalFact;quote:PublicPassageQuote;crew:number}|null {
    const master=world.npcs.find(p=>p.status==='alive'&&p.tags.includes('crew-of:'+departure.terms.vesselId)&&p.identity.occupation==='shipmaster');
    if(!master||locationOfNpcOnItsJourney(world,master,routineTime(world))!==departure.terms.fromId)return null;
    if(people.some(p=>whatStopsHandingInPassageTally(world,p.id,departure.terms,master.id)))return null;
    const quote=quoteBoardingThePublicShip(world,departure,people.map(p=>p.id));
    if(!quote||!publicShipHullCanBeBoarded(world,quote))return null;
    const natives=people.flatMap(p=>{const native=world.npcs.find(n=>n.id===p.id);return native&&!native.tags.includes(PLAYER_ROW_TAG)?[native]:[];});
    const boarded=natives.map(p=>onSponsoredPublicPassage(world,p,quote,'Travelling on the paid ship to its destination.',p.activity?.withIds??[]));
    if(boarded.some(p=>!p))return null;
    for(const person of boarded)world.npcs[world.npcs.findIndex(p=>p.id===person!.id)]=person!;
    const crew=world.npcs.filter(p=>p.status==='alive'&&p.tags.includes('crew-of:'+quote.vesselId));
    bindShipCrewToPassage(world,quote,routineTime(world));
    const receipt=recordPublicPassage(world,quote,routineTime(world),quote.fromId,[...people.map(p=>p.id),...crew.map(p=>p.id)],
        undefined,moment,people);
    return {receipt,quote,crew:crew.length};
}

/** A sold or given seat does not erase an already accepted native route intention. */
export function settleNativeShipTallyIntentions(world:WorldState,day=routineTime(world),contacts?:ReadonlySet<string>):boolean {
    const jobs=publicShipDepartures(world);if(!jobs.length)return false;
    let changed=false;
    for(const id of world.npcs.filter(p=>p.status==='alive'&&!p.tags.includes(PLAYER_ROW_TAG)
        &&p.activity?.kind==='waiting_for_a_departure'&&(!contacts||contacts.has(p.id))).map(p=>p.id)) {
        const person=world.npcs.find(p=>p.id===id)!,doing=person.activity!;
        const original=jobs.find(d=>d.effect.id===doing.publicDepartureId);if(!original)continue;
        if(world.objects.some(o=>o.id===doing.passageTallyId&&o.possessorId===id))continue;
        const from=world.locations.find(p=>p.id===original.terms.fromId)!,landing=theAreasOf(world,from).areas.find(a=>a.for==='landing');
        if(readActualDepartureApproach(world,id,{intentId:'continue-paid-public-route',target:{locationId:from.id,areaId:landing?.id??null}},day).kind!=='ready')continue;
        const offer=offerTheNextPublicShip(world,from.id,original.terms.toId);if(!offer||person.spiritStones<offer.departure.fareStones)continue;
        const keeper=world.npcs.find(p=>p.id===offer.departure.operatorId&&p.status==='alive');
        if(!keeper||locationOfNpcOnItsJourney(world,keeper,day)!==from.id)continue;
        const tally=purchaseAcceptedPublicShipTally(world,offer,person,person,(carrierId,stones,commit)=>{
            const payer=world.npcs.find(p=>p.id===id)!,carrier=world.npcs.find(p=>p.id===carrierId);
            if(!carrier||payer.spiritStones<stones)return false;
            payer.spiritStones-=stones;carrier.spiritStones+=stones;commit();return true;
        });changed ||= !!tally;
    }return changed;
}

/** Finite accepted jobs settle on the ordinary world boundary, including an unladen return. */
export function settleDuePublicShips(world:WorldState,day=routineTime(world)):void {
    settleNativeShipTallyIntentions(world,day);
    for(const departure of publicShipDepartures(world)) {
        if(departure.terms.departureDay>day)continue;
        const master=world.npcs.find(p=>p.id===departure.operatorId&&p.status==='alive');
        if(!master)continue;
        let receipt=factsWithDataValue(world,'publicDepartureId',departure.effect.id).find(f=>f.data.publicPassage===true&&f.data.actualBoarding===true);
        if(!receipt) {
            const from=world.locations.find(p=>p.id===departure.terms.fromId)!;
            const station=theAreasOf(world,from).areas.find(a=>a.for==='landing');
            const passengers=world.npcs.filter(p=>p.status==='alive'&&!p.tags.includes(PLAYER_ROW_TAG)
                &&theHeldPassageTally(world,p.id,departure.terms)
                &&(p.activity?.kind==='waiting_for_a_departure'&&p.activity.returnTo===departure.terms.toId
                    ||activeGoals(p).some(g=>g.targetId===departure.terms.toId))
                &&readActualDepartureApproach(world,p.id,{intentId:departure.effect.id,target:{locationId:from.id,areaId:station?.id??null}},day).kind==='ready');
            const boarded=boardThePublicShip(world,departure,passengers);if(!boarded)continue;receipt=boarded.receipt;
        }
        const doing=world.npcs.find(p=>p.id===master.id)!.activity;
        if(doing?.kind!=='travelling'||doing.vesselId!==departure.terms.vesselId||doing.fromLocationId!==departure.terms.fromId
            ||doing.returnTo!==departure.terms.toId||doing.sinceDay>day)continue;
        unusedPassageTalliesGoToDust(world,departure.terms,doing.sinceDay);
        appendWorldFact(world,makeFact({day:doing.sinceDay,kind:'gathering',visibility:'public',locationId:departure.terms.fromId,
            actors:[{id:master.id,name:master.name,role:'shipmaster'}],causes:[receipt.id],
            summary:'The ship left for its accepted public destination.',data:{publicCarrierDeparture:true,
                publicDepartureCompleted:departure.effect.id,boardingReceiptId:receipt.id}}),{recur:false});
        world.schedule=world.schedule.filter(e=>e.id!==departure.effect.id);
        for(let at=0;at<world.npcs.length;at++) {
            const p=world.npcs[at]!;if(p.activity?.kind==='waiting_for_a_departure'&&p.activity.publicDepartureId===departure.effect.id)
                world.npcs[at]={...p,activity:companyAgreement(p.activity,day)};
        }
    }
}
