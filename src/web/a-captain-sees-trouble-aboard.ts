/** Actual bodily trouble reaches the actual operator; their decision never moves a player mirror. */
import type { GameService } from './turn-engine.js';
import { actualCarrierScene } from './the-actual-carrier-scene.js';
import { recordedVoyage } from './a-ship-at-sea.js';
import { thePaidCarriageClaim } from './a-paid-carriage-on-the-road.js';
import { ownedPassageClaim } from './an-owned-passage.js';
import { actualPersonFor } from './the-actual-person-behind-a-world-row.js';
import { publicCaptainMedicalResponse, publicCaptainPassageHazard } from '../engine/world/a-public-captain-protects-their-passengers.js';
import { bodilyTroubleAboard, captainAnswersTrouble, captainHasAnswered } from '../engine/world/a-captain-answers-trouble.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { quoteOwnedAirCourseChange, changeOwnedAirCourse } from './changing-the-owned-air-course.js';
import { quoteOwnedSeaCourseChange, changeOwnedSeaCourse } from './changing-the-owned-sea-course.js';
import { quoteOwnedRoadCourseChange,changeOwnedRoadCourse } from './changing-the-owned-road-course.js';
import {makeFact} from '../engine/world/history.js';
import {appendWorldFact} from '../engine/world/who-was-there-when-it-happened.js';
import {DAYS_PER_YEAR} from '../engine/cultivation/cultivation.js';
import {isStatusRunningOn} from '../engine/world/what-is-true-of-a-place-right-now.js';
import {isTheWorldsToMove} from '../engine/world/npc-state.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from '../engine/world/what-one-of-the-worlds-own-people-knows.js';
import { canPointAt } from '../engine/social/discovery.js';
import { projectActualPassengers } from './passengers-at-the-actual-clock.js';
import { readJsonFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import { witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { statusesInArea,STOPS_PASSAGE } from '../engine/world/what-is-true-of-a-place-right-now.js';

const HEARD = 'captain_decisions_heard';

export function captainSeesTroubleAboard(game: GameService): string[] {
    const world = game.atHand, body = game.currentRun().cultivator;
    if (!world || !body.alive || game.fight) return [];
    const day = routineTime(world), source = actualCarrierScene(game.repos, body, world, day);
    const operator = source && world.npcs.find(person => person.id === source.operatorId);
    if (!source || !operator || operator.id === body.id) return [];
    const actual = actualPersonFor(game, body.id);
    if (!actual) return [];
    const patient = { ...actual, cultivation: { ...actual.cultivation, plague: body.plague },
        actualBodyHealth:{hp:body.hp,maxHp:body.maxHp} };
    const publicClaim = recordedVoyage(game.db, body.id)?.receiptId ?? thePaidCarriageClaim(game.db, body.id)?.receiptId;
    const factsBefore = world.history.facts.length;
    if (publicClaim) {
        publicCaptainPassageHazard(world, publicClaim, day);
        publicCaptainMedicalResponse(world, publicClaim, day, patient);
    }
    else {
        const owned = ownedPassageClaim(game.db, body.id);
        const receipt = owned && witnessIndexFor(world).byId.get(owned.receiptId);
        const people = [patient, ...world.npcs.filter(person => isTheWorldsToMove(person)&&source.accepts(person))];
        const medical = people.map(person => bodilyTroubleAboard(person, day)).find(trouble => !!trouble && !captainHasAnswered(world,operator.id,trouble));
        const heldDanger=typeof receipt?.data.heldOwnedForStatusId==='string'
            &&world.statuses.find(status=>status.id===receipt.data.heldOwnedForStatusId&&isStatusRunningOn(status,day));
        const danger = statusesInArea(world.statuses,world.locations,source.locationId,day).find(status=>status.stops.includes(STOPS_PASSAGE))
            ??(heldDanger||undefined);
        const trouble = medical ?? (danger?{key:`owned-passage:${danger.id}:${danger.reviewOnDay}${receipt?.data.heldOwnedForStatusId?':'+receipt.id:''}`,person:operator,reason:danger.statement}:null);
        if (receipt && receipt.data.airCourse!==true && receipt.data.seaCourse!==true) {
            const d=receipt.data,held=typeof d.heldOwnedForStatusId==='string'
                &&world.statuses.find(status=>status.id===d.heldOwnedForStatusId);
            if(held&&!isStatusRunningOn(held,day)&&typeof d.departureDay==='number'&&d.departureDay>=day
                &&typeof d.toLocationId==='string'&&changeOwnedRoadCourse(game,body,d.toLocationId,operator.id,undefined,null,()=>true))
                appendWorldFact(world,makeFact({day,kind:'gathering',visibility:'public',locationId:source.locationId,
                    causes:[receipt.id],actors:[{id:operator.id,name:operator.name,role:'operator'}],
                    summary:`${operator.name} resumed the accepted voyage after the passage danger ended.`,
                    data:{captainTrouble:`${operator.id}:resume:${receipt.id}`,vesselId:source.vesselId}}),{recur:false,bystanders:false});
            else if(danger&&!medical&&(typeof d.departureDay!=='number'||d.departureDay<=day)&&typeof d.toLocationId==='string'){
                const recheck=danger.reviewOnDay>day?danger.reviewOnDay:(Math.floor(day/DAYS_PER_YEAR)+1)*DAYS_PER_YEAR;
                captainAnswersTrouble(world,operator,trouble!,receipt.id,source.locationId,day,
                    `hold the carriage and check the passage again in ${recheck-day} days.`,
                    ()=>!!changeOwnedRoadCourse(game,body,d.toLocationId as string,operator.id,recheck,danger.id,()=>true));
            }else if(medical){
                const knows=whatOneOfTheWorldsOwnPeopleKnows(world);
                const known=(place:import('../engine/world/locations.js').LocationRecord)=>place.id===d.fromLocationId
                    ||place.id===d.toLocationId||canPointAt(knows(operator.id,'place',place.id));
                const landing=world.locations.filter(place=>(place.kind==='settlement'||place.kind==='sect_seat'||place.tags.includes('city'))
                    &&known(place))
                    .flatMap(place=>{const quote=quoteOwnedRoadCourseChange(game,body,place.id,known);return quote?[{place,quote}]:[];})
                    .sort((a,b)=>a.quote.days-b.quote.days)[0];
                if(landing)captainAnswersTrouble(world,operator,medical,receipt.id,source.locationId,day,
                    `put in at ${landing.place.name} for care.`,()=>landing.place.id===d.toLocationId
                        ||!!changeOwnedRoadCourse(game,body,landing.place.id,operator.id,undefined,null,known));
            }
        }
        if (receipt?.data.seaCourse === true && trouble && typeof receipt.data.fromLocationId === 'string') {
            const from = world.locations.find(place=>place.id===receipt.data.fromLocationId);
            const to = world.locations.find(place=>place.id===receipt.data.toLocationId);
            const known = (place:import('../engine/world/locations.js').LocationRecord)=>place.id===receipt.data.fromLocationId;
            const reverse = from && quoteOwnedSeaCourseChange(game,body,from.id,known);
            const onward = typeof receipt.data.arrivalDay==='number'?receipt.data.arrivalDay-day:Infinity;
            const returning = reverse && (danger || reverse.days<onward);
            const landing = returning ? from : to;
            if (landing) captainAnswersTrouble(world,operator,trouble,receipt.id,source.locationId,day,
                `put in at ${landing.name} ${medical?'for care':'clear of the passage danger'}.`,
                ()=>!returning||!!changeOwnedSeaCourse(game,body,landing.id,operator.id,known));
        }
        if (receipt?.data.airCourse === true && trouble) {
            const knows = whatOneOfTheWorldsOwnPeopleKnows(world);
            const known = (place: import('../engine/world/locations.js').LocationRecord) => canPointAt(knows(operator.id, 'place', place.id));
            const landings = world.locations.filter(place => !place.tags.includes('air-course')
                && (place.tags.includes('city') || place.kind === 'settlement'))
                .flatMap(place => {
                    const quote = quoteOwnedAirCourseChange(game, body, place.id, known);
                    return quote ? [{ place, days: quote.quote.daysOneWay, keep: false }]
                        : place.id === receipt.data.toLocationId && typeof receipt.data.arrivalDay === 'number'
                            ? [{ place, days: receipt.data.arrivalDay - day, keep: true }] : [];
                }).sort((a, b) => a.days - b.days);
            const landing = landings[0];
            if (landing) captainAnswersTrouble(world, operator, trouble, receipt.id, source.locationId, day,
                `land at ${landing.place.name} ${medical?'for care':'clear of the passage danger'}.`, () => landing.keep
                    || !!changeOwnedAirCourse(game, body, landing.place.id, operator.id, known));
        }
    }
    if (world.history.facts.length !== factsBefore) {
        projectActualPassengers(game.db, world, body.id, day);
        game.theWorldMoved();
    }
    const heard = readJsonFlag<{day:number;ids:string[]}>(game.db, body.id, HEARD);
    const originalReceipt = publicClaim ?? ownedPassageClaim(game.db, body.id)?.receiptId;
    let boarding = originalReceipt ? witnessIndexFor(world).byId.get(originalReceipt) : undefined;
    const visited = new Set<string>();
    while(boarding?.data.changedOwnedCourse===true&&!visited.has(boarding.id)){
        visited.add(boarding.id);
        const previous=boarding.causes.map(id=>witnessIndexFor(world).byId.get(id)).find(fact=>fact?.data.ownedPassage===true
            &&fact.data.ownerId===boarding!.data.ownerId&&fact.data.vesselId===boarding!.data.vesselId);
        if(!previous)break;boarding=previous;
    }
    const boarded = boarding?.data.departureDay;
    const announcements = world.history.facts.filter(fact => typeof fact.data.captainTrouble === 'string'
        && fact.data.vesselId === source.vesselId
        && fact.actors.some(actor => actor.id === operator.id && actor.role === 'operator')
        && (typeof boarded !== 'number' || fact.day >= boarded)
        && fact.day <= day && (!heard || fact.day > heard.day || fact.day === heard.day && !heard.ids.includes(fact.id)));
    if (!announcements.length) return [];
    const latest = Math.max(...announcements.map(fact => fact.day));
    writeFlag(game.db, body.id, HEARD, JSON.stringify({ day: latest,
        ids: [...(heard?.day === latest ? heard.ids : []), ...announcements.filter(fact => fact.day === latest).map(fact => fact.id)] }));
    return announcements.map(fact => captainDecisionHeard(game, fact));
}

export function captainDecisionHeard(game: GameService, fact: import('../engine/world/history.js').HistoricalFact): string {
    const body = game.currentRun().cultivator, visible = game.present(body);
    const heard = readJsonFlag<{day:number;ids:string[]}>(game.db, body.id, HEARD);
    if (!heard || fact.day > heard.day || fact.day === heard.day && !heard.ids.includes(fact.id))
        writeFlag(game.db, body.id, HEARD, JSON.stringify({day:fact.day,
            ids:[...(heard?.day===fact.day?heard.ids:[]),fact.id]}));
    return fact.actors.reduce((line,actor) => actor.id === body.id ? line
        : line.replaceAll(actor.name,visible.find(person=>person.id===actor.id)?.name
            ?? (actor.role==='operator'?'The captain':'a person aboard')),fact.summary);
}
