/** Actual ordinary counter work, derived once for placement and addressed keeper reads.
 * The former web deal selected a keeper from a capped observer roster; walking to
 * the counter could therefore remove its own keeper. Work derives from the same
 * local bodies/routines now. No employee, profession, capability or attendance is
 * minted. Stored areas, concrete tasks, company and private work keep their claim.
 */
import { forStream } from '../cultivation/rng.js';
import { placeSeedKey } from '../../data/cultivation/place-names.js';
import { isActing, PLAYER_ROW_TAG, type NpcRecord } from './npc-state.js';
import { routineOf } from './npc-routines.js';
import type { RouteQueries } from './locations.js';
import type { WorldState } from './world-state.js';
import { ordinaryProfessionOf } from './the-work-an-ordinary-mortal-does.js';
import type { PublicCounterKind } from './public-transport-at-a-place.js';
type State = Pick<WorldState, 'seed' | 'currentDay' | 'currentHour' | 'locations'>;
/** Transient actual worker facts, never persisted or promoted into an NPC record. */
export interface CounterWorkerFacts { id:string; realmOrdinal:number; trading:boolean; counters:readonly PublicCounterKind[] }
const order: readonly PublicCounterKind[] = ['inn', 'landing', 'carriage_station', 'span_counter'];
/** Callers supply actual local bodies; this reader neither finds nor moves remote workers. */
export function workingWorldCounterFacts(state: State,
    people: readonly NpcRecord[], counters: readonly PublicCounterKind[], routes?: RouteQueries): CounterWorkerFacts[] {
    const working = people.map(person => ({ person, routine: routineOf(state, person, routes) }))
        .filter(({ person, routine }) => isActing(person.status) && !person.tags.includes(PLAYER_ROW_TAG)
            && !routine.home && routine.activity?.withIds.length === 0
            && (routine.activity.kind === 'trade' || routine.activity.kind === 'the_work_of_their_rank'));
    const facts:CounterWorkerFacts[]=working.map(({person,routine})=>({
        id:person.id,realmOrdinal:person.cultivation.realmOrdinal,trading:routine.activity?.kind==='trade',
        counters:counters.filter(counter=>{
            if(routine.standingIn && !routine.standingIn.includes('#'+(counter==='inn'?'table':counter)+'#'))return false;
            const profession=ordinaryProfessionOf(person);
            return !profession || (counter==='inn'?profession.id==='job-innkeeper'
                : counter==='landing'&&['job-shipmaster','job-ferryman'].includes(profession.id));
        })
    }));
    return facts;
}

/** One canonical deal for all actual body sources; an observer cap is not a staffing rule. */
export function counterWorkerIds(seed:string,placeName:string,people:readonly CounterWorkerFacts[],
    counters:readonly PublicCounterKind[]):Map<PublicCounterKind,string> {
    const selected=new Map<PublicCounterKind,string>();
    const taken=new Set<string>();
    for(const counter of order.filter(kind=>counters.includes(kind))) {
        const ranked=people.filter(person=>!taken.has(person.id)&&person.counters.includes(counter))
            .map(person=>({person,tie:forStream(seed,'who-keeps-the-counter',counter,placeSeedKey(placeName.trim()).toLowerCase(),person.id).next()}))
            .sort((a,b)=>Number(!a.person.trading)-Number(!b.person.trading)||a.person.realmOrdinal-b.person.realmOrdinal||a.tie-b.tie);
        const id=ranked[0]?.person.id;
        if(id){selected.set(counter,id);taken.add(id);}
    }
    return selected;
}

export function workersAtPublicCounters(state:State,placeName:string,people:readonly NpcRecord[],
    counters:readonly PublicCounterKind[],routes?:RouteQueries):Map<PublicCounterKind,NpcRecord> {
    const byId=new Map(people.map(person=>[person.id,person]));
    const result=new Map<PublicCounterKind,NpcRecord>();
    for(const [counter,id] of counterWorkerIds(state.seed,placeName,workingWorldCounterFacts(state,people,counters,routes),counters)) {
        const person=byId.get(id);if(person)result.set(counter,person);
    }
    return result;
}
