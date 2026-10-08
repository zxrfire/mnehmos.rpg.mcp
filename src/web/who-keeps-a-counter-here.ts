/** Actual public counter keepers share the world's working-person deal with
 * physical venue placement. A listener must be present in the player's actual
 * area. There is no employee store, attendance guarantee or name disclosure;
 * ordinary current routines, concrete work and physical custody remain real.
 */

import { workingWorldCounterFacts, counterWorkerIds, type CounterWorkerFacts } from '../engine/world/who-is-working-at-a-public-counter.js';
import { publicCountersAt, type PublicCounterKind } from '../engine/world/public-transport-at-a-place.js';
import { npcsStandingIn } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import { worldLocationFor } from '../engine/world/place-lookup.js';
import { peopleInThisPlace } from './hearsay.js';
import { betweenRoadEndpoints } from './a-road-stopped-partway.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import { thePlayerIsSureItIsThem } from './the-narrator-plays-the-world.js';


export type ACounter = PublicCounterKind;

/** The words a player calls the keeper of each counter by. */
const WHAT_THEY_ARE_CALLED: Readonly<Record<ACounter, RegExp>> = {
    inn: /\b(?:inn-?keepers?|landlord|landlady|host of the inn|keeper of the inn)\b/i,
    landing: /\b(?:boatman|boatmen|ferryman|ferrymen|landing clerk|harbour ?master|shipmaster)\b/i,
    span_counter: /\b(?:folding clerk|span clerk|folding attendant|counter attendant|portal attendant)\b/i,
    carriage_station: /\b(?:carters?|coachman|coachmen|drivers?|station clerk|carriage clerk)\b/i
};

/** A clerk with no counter named is whichever ticket counter this place has. */
const A_TICKET_CLERK = /\b(?:ticket[- ]?clerks?|clerks?|ticket[- ]?sellers?|booth ?keepers?)\b/i;

export interface AKeeper {
    id: string;
    name: string;
}




/**
 * The person keeping this counter here, or null where nobody is standing in the place.
 *
 * `countersHere` is every counter the place keeps: each is dealt a keeper in
 * the shared canonical counter order, passing over whoever already keeps one, so the inn and
 * the station are two people wherever two people are standing.
 */
export function whoKeepsTheCounter(
    game: GameService,
    cultivator: Cultivator,
    counter: ACounter,
    countersHere: readonly ACounter[]
): AKeeper | null {
    return countersHere.includes(counter) ? theCounterWorkersHere(game, cultivator,undefined,countersHere).get(counter) ?? null : null;
}

/** What each counter's keeper is called by somebody who has no name for them. */
const THE_KEEPER_UNNAMED: Readonly<Record<ACounter, string>> = {
    inn: 'the innkeeper',
    landing: 'the landing clerk',
    carriage_station: 'the station clerk',
    span_counter: 'the folding attendant'
};

/**
 * The keeper as the player can say them: by name only when the player has one.
 * Played: the engine printed a stranger's name for the innkeeper, beside a census
 * saying nobody here could be named, and the narrator went on naming strangers.
 * Awareness alone is not a name: a look writes every face it sees as a name that
 * got said, so it is the narrator's own test, a name the player has lived.
 */
export function theKeeperAsTheyAreKnown(
    game: GameService,
    cultivator: Cultivator,
    keeper: AKeeper,
    counter: ACounter
): string {
    return thePlayerIsSureItIsThem(keeper.name, game.knowledge.awareness(cultivator.id))
        ? keeper.name
        : THE_KEEPER_UNNAMED[counter];
}

/**
 * The counter a phrase names its keeper by, where it names one this place has.
 */
export function theCounterThisKeeperKeeps(
    said: string,
    countersHere: readonly ACounter[]
): ACounter | null {
    for (const counter of countersHere) {
        if (WHAT_THEY_ARE_CALLED[counter].test(said)) return counter;
    }
    if (!A_TICKET_CLERK.test(said)) return null;
    return countersHere.find(counter => counter !== 'inn') ?? null;
}

/** The canonical deal filtered to actual listeners in this observer's area. */
export function theCounterWorkersHere(game: GameService, cultivator: Cultivator, observed?: readonly AKeeper[], available?:readonly ACounter[]): Map<ACounter, AKeeper> {
    const world=game.atHand,result=new Map<ACounter,AKeeper>();
    if(betweenRoadEndpoints(game.db,cultivator))return result;
    const present=new Map((observed??game.present(cultivator)).map(person=>[person.id,person]));
    const place=world?worldLocationFor(world,cultivator.location??''):null;
    const counters=available??(world&&place?publicCountersAt(world,place.name,world.currentDay):[]);
    const facts:CounterWorkerFacts[]=world&&place
        ? workingWorldCounterFacts(world,npcsStandingIn(world,place.id),counters):[];
    const inWorld=new Set(world?.npcs.map(person=>person.id)??[]);
    // Canonical uncapped physical placement retains repository-only bodies.
    // A world row's own current routine keeps authority; SQL cannot bypass it.
    if(world&&place){
        const reading=peopleInThisPlace(game.repos,cultivator,world,place);
        for(const person of reading.people){
            if(person.id===cultivator.id||!person.alive||inWorld.has(person.id))continue;
            const area=reading.areas.find(area=>area.id===reading.whereIs.get(person.id));
            const at=counters.filter(counter=>area?.for===(counter==='inn'?'table':counter));
            if(at.length>0)facts.push({id:person.id,realmOrdinal:person.realmOrdinal,trading:false,counters:at});
        }
    }else{
        // No-world scenes have no area/routine facts: preserve their existing
        // real local listener deal, using the complete alive repository crowd.
        const here=(cultivator.location??'').trim().toLowerCase();
        for(const person of game.repos.cultivators.roster()){
            if(person.id!==cultivator.id&&person.alive&&(person.location??'').trim().toLowerCase()===here)
                facts.push({id:person.id,realmOrdinal:person.realmOrdinal,trading:false,counters});
        }
    }
    for(const [counter,id] of counterWorkerIds(world?.seed??'no-world',place?.name??cultivator.location??'',facts,counters)){
        const actual=present.get(id);if(actual)result.set(counter,{id:actual.id,name:actual.name});
    }
    return result;
}
