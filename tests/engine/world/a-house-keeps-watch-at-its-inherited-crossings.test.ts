/**
 * Owner 2026-10-07: real inherited terminals of the span house need actual
 * disciples on watch. Courier-only counters and empty ordinary ruins are not
 * portal watch sites. The existing postings pass already owns spare members,
 * vacancy, route/fuel, physical arrival, term and relief; this adds only real
 * service-owned targets, not a second staffing loop or guaranteed actor.
 *
 * This small native geography arranges the catalog provider house and genuine
 * surveyed terminal names, connected by ordinary finite roads. No portal is
 * invented. Canonical body projection must keep a dispatched watcher in transit
 * before arrival, and native relief waits for the replacement's physical body.
 * Missing spares/closed routes remain real absence. No live model is claimed.
 */
import { describe,expect,it } from 'vitest';
import { createWorld,makeFaction } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc,setRealm } from '../../../src/engine/world/npc-state.js';
import { applyPostings } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { locationOnNpcJourney } from '../../../src/engine/world/places-on-the-way.js';
import { theyAreRelieved } from '../../../src/engine/world/a-house-posts-the-one-being-played.js';
import { publicWatchTargetsOf,publicWatchTargetForPost,missionPostId } from '../../../src/engine/world/where-a-house-keeps-its-public-watch.js';
import { SPAN_ROUTES,THE_SPAN_HOUSE_ID } from '../../../src/engine/world/where-the-measured-span-still-answers.js';
import { workersAtPublicCounters } from '../../../src/engine/world/who-is-working-at-a-public-counter.js';

function fixture(){
    const state=createWorld({seed:'inherited-crossing-watch',skipPriorAges:true,regionCount:0});
    const day=1000;state.currentDay=day;state.currentHour=10;
    const region=makeLocation({id:'watch-region',name:'The Watch Province',kind:'region'});
    const seat=makeLocation({id:'watch-seat',name:'Shrinking Earth Pavilion',kind:'sect_seat',parentId:region.id});
    const towns=makeLocation({id:'watch-town',name:'Salt Market',kind:'settlement',parentId:region.id});
    const names=[...new Set(SPAN_ROUTES.map(route=>route.fromPlace))];
    const sites=names.map((name,i)=>makeLocation({id:'surveyed-site-'+i,name,kind:'ruin',parentId:region.id}));
    const destinations=[towns,...sites];
    for(const place of destinations){
        seat.links.push({toLocationId:place.id,kind:'road',travelDays:2,requiresKeyId:null,open:true,note:'The arranged ordinary road.'});
        place.links.push({toLocationId:seat.id,kind:'road',travelDays:2,requiresKeyId:null,open:true,note:'The arranged ordinary road.'});
    }
    state.locations.push(region,seat,towns,...sites);
    state.factions.push(makeFaction({id:THE_SPAN_HOUSE_ID,name:'Shrinking Earth Pavilion',seatLocationId:seat.id,
        resources:{power_ordinal:24,spirit_stones:50000}}));
    for(let i=0;i<5;i++)state.npcs.push({...setRealm(createNpc(state.seed,{id:'watch-disciple-'+i,
        bornOnDay:day-20*365,onDay:day,locationId:seat.id,occupation:'disciple'}),14,day),
        factionId:THE_SPAN_HOUSE_ID,factionRankIndex:1});
    return {state,day,seat,sites};
}

describe('inherited crossing watch',()=>{
    it('projects only provider-owned inherited terminals and dispatches actual spare members with finite arrival and relief',()=>{
        const {state,day,seat}=fixture();
        const targets=publicWatchTargetsOf(state,THE_SPAN_HOUSE_ID);
        expect(targets.length).toBeGreaterThan(0);
        for(const target of targets)expect(SPAN_ROUTES.some(r=>r.fromPlace===target.name&&r.inheritedTerminal)).toBe(true);
        expect(publicWatchTargetsOf(state,'another-house')).toEqual([]);
        expect(publicWatchTargetForPost(state,THE_SPAN_HOUSE_ID,missionPostId('mission-crossing-watch',THE_SPAN_HOUSE_ID,'not-a-site'))).toBeNull();
        const arrivals=new Map<string,number>();
        expect(applyPostings(state,2,day,{onArrival:(id,at)=>arrivals.set(id,at)})).toBeGreaterThan(0);
        const posted=state.npcs.find(n=>n.activity?.kind==='stationed'&&targets.some(t=>t.id===n.locationId));
        if(!posted)throw new Error('Native posting pass dispatched no inherited crossing watcher');
        const target=targets.find(t=>t.id===posted.locationId)!;
        const arrival=arrivals.get(posted.id);
        if(arrival===undefined)throw new Error('Native posting has no arrival receipt');
        expect(arrival).toBeGreaterThan(day);
        expect(locationOnNpcJourney(state.locations,posted,day)).toBe(seat.id);
        expect(locationOnNpcJourney(state.locations,posted,arrival)).toBe(target.id);
        expect(posted.activity!.returnTo).toBe(seat.id);
        expect(posted.activity!.untilDay).toBeGreaterThan(arrival);
        state.currentDay=arrival;
        expect(workersAtPublicCounters(state,target.name,[posted],['span_counter']).get('span_counter')?.id).toBe(posted.id);
        expect(workersAtPublicCounters({...state,currentDay:day},target.name,[posted],['span_counter']).size).toBe(0);
        // End this actual tour and let the SAME pass choose/dispatch a spare.
        const at=state.npcs.findIndex(n=>n.id===posted.id);
        state.npcs[at]={...posted,activity:{...posted.activity!,untilDay:arrival}};
        const replacementArrivals=new Map<string,number>();
        expect(applyPostings(state,3,arrival,{onArrival:(id,at)=>replacementArrivals.set(id,at)})).toBeGreaterThan(0);
        const replacement=state.npcs.find(n=>n.id!==posted.id&&n.locationId===target.id&&n.activity?.kind==='stationed');
        if(!replacement)throw new Error('No real spare replacement for expired crossing watch');
        expect(theyAreRelieved(state,{relievedId:posted.id,townId:target.id,today:arrival,replacementId:replacement.id})).toBe(false);
        const replacementArrival=replacementArrivals.get(replacement.id);
        if(replacementArrival===undefined)throw new Error('Replacement has no native arrival receipt');
        expect(theyAreRelieved(state,{relievedId:posted.id,townId:target.id,today:replacementArrival,replacementId:replacement.id})).toBe(true);
        expect(state.history.facts.some(f=>f.data.postRelief===true&&f.data.outgoingId===posted.id&&f.data.replacementId===replacement.id)).toBe(true);
    });
    it('does not manufacture a watcher when members are absent or no actual route exists',()=>{
        const {state,day,sites}=fixture();
        state.npcs=state.npcs.map(n=>({...n,locationId:sites[0]!.id}));
        expect(applyPostings(state,2,day)).toBe(0);
        expect(state.npcs.some(n=>n.activity?.kind==='stationed')).toBe(false);
        const blocked=fixture();for(const place of blocked.state.locations)place.links=[];
        // Parent-region walking remains an actual route, so remove physical parent
        // approaches too; a closed explicit edge alone is not an isolated site.
        for(const place of blocked.sites)place.parentId=null;
        applyPostings(blocked.state,2,blocked.day);
        expect(blocked.state.npcs.some(n=>n.activity?.kind==='stationed'&&blocked.sites.some(s=>s.id===n.locationId))).toBe(false);
    });
});
