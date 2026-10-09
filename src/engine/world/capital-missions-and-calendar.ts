/** Cities receive dated house business; attendance is a stint, never a new home. */
import { loadExchangeConsignment } from './wares-at-a-capital-exchange.js';
import { COMPETITION_CALENDARS } from '../../data/cultivation/competition-calendars.js';
import { whatKindOfPlace } from '../../data/cultivation/regions.js';
import { theDayItFallsIn } from './a-competition-anybody-may-enter.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream } from '../cultivation/rng.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { whatTheHouseCanSpare } from './who-goes-out-for-a-house-and-what-comes-back.js';
import { theProvinceAround } from './ground-holder.js';
import { isBelowTheLid } from './layers.js';
import { isAwayOnSomething, isTheWorldsToMove, setLocation, type NpcRecord } from './npc-state.js';
import { routeQueriesFor, walkingDaysFrom, type RouteQueries } from './locations.js';
import { departureSceneFor, beginActualDepartureApproach, finishActualDepartureApproach, readActualDepartureApproach, exteriorGroundOfDeparture } from './departure-approach.js';
import { LOCAL_WALK_DAYS } from './local-walking-cost.js';
import { departureAreaAt } from './where-in-a-place-somebody-is-standing.js';
import { journeyNeedsWater, locationOnNpcJourney } from './places-on-the-way.js';
import { earliestQuotedPublicPassage, onSponsoredPublicPassage, publicShipLinesFrom,
    quotePublicPassage, recordPublicPassage, thePortsShipsPutInAt,
    type PublicPassageLeg, type PublicPassageQuote } from './public-shipping.js';
import { realiseAcceptedPublicShipHull, publicShipHullCanBeBoarded } from './a-public-ship-hull.js';
import { bindShipCrewToPassage, ensureShipCrew } from './ship-crew.js';
import { witnessIndexFor } from './witness-reaction-index.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { LocationRecord } from './locations.js';
import type { FactionRecord, WorldState } from './world-state.js';

export interface CapitalOccasion {
    venueId: string;
    hostId: string;
    kind: 'auction' | 'competition';
    opensOnDay: number;
    onDay: number;
    endsOnDay: number;
}

interface MissionLeg { fromId: string; toId: string; by: 'land' | 'ship' }
type MissionService = { days: number } | { untilDay: number; eventDay: number };
type PublicRoutesInOnePass = Map<string, MissionLeg[] | null>;

/** Route results live only for one unchanged-graph sending pass. */
function publicRoute(state: WorldState, fromId: string, toId: string, graph: RouteQueries,
    routes: PublicRoutesInOnePass): MissionLeg[] | null {
    const key = `${fromId}|${toId}`;
    if (routes.has(key)) return routes.get(key)!;
    const byName = new Map(state.locations.map(place => [place.name, place]));
    const ports = thePortsShipsPutInAt(state,graph).map(name => byName.get(name)).filter(
        (place): place is LocationRecord => place !== undefined);
    const outward = walkingDaysFrom(state.locations, fromId, undefined, graph);
    const inward = walkingDaysFrom(state.locations, toId, undefined, graph);
    const nodes = new Set([fromId, toId, ...ports.map(port => port.id)]);
    const links = new Map<string, { toId: string; days: number; by: MissionLeg['by'] }[]>();
    const add = (from: string, to: string, days: number, by: MissionLeg['by']) => {
        if (from === to) return;
        const row = links.get(from) ?? [];
        row.push({ toId: to, days, by });
        links.set(from, row);
    };
    for (const port of ports) {
        const first = outward.get(port.id);
        if (first !== undefined && !journeyNeedsWater(state.locations, fromId, port.id, graph))
            add(fromId, port.id, first, 'land');
        const last = inward.get(port.id);
        if (last !== undefined && !journeyNeedsWater(state.locations, port.id, toId, graph))
            add(port.id, toId, last, 'land');
        for (const line of publicShipLinesFrom(state, port.name, 0,graph)) {
            const other = byName.get(line.to);
            if (other && nodes.has(other.id)) add(port.id, other.id, line.days, 'ship');
        }
    }
    const direct = outward.get(toId);
    if (direct !== undefined && !journeyNeedsWater(state.locations, fromId, toId, graph))
        add(fromId, toId, direct, 'land');
    const distance = new Map([[fromId, 0]]);
    const previous = new Map<string, MissionLeg>();
    const open = new Set([fromId]);
    while (open.size) {
        const from = [...open].sort((a, b) => (distance.get(a) ?? Infinity) - (distance.get(b) ?? Infinity)
            || a.localeCompare(b))[0]!;
        open.delete(from);
        if (from === toId) break;
        for (const edge of links.get(from) ?? []) {
            const cost = distance.get(from)! + edge.days;
            if (cost >= (distance.get(edge.toId) ?? Infinity)) continue;
            distance.set(edge.toId, cost);
            previous.set(edge.toId, { fromId: from, toId: edge.toId, by: edge.by });
            open.add(edge.toId);
        }
    }
    const legs: MissionLeg[] = [];
    for (let at = toId; at !== fromId && previous.has(at); at = previous.get(at)!.fromId)
        legs.unshift(previous.get(at)!);
    const route = legs.length && legs[0]!.fromId === fromId && legs.at(-1)!.toId === toId ? legs : null;
    routes.set(key, route);
    return route;
}

function homeRoute(outward: readonly MissionLeg[]): MissionLeg[] {
    return [...outward].reverse().map(leg => ({ ...leg, fromId: leg.toId, toId: leg.fromId }));
}

/** Quote both real directions before committing a house to the errand. */
function quotedRoute(state: WorldState, legs: readonly MissionLeg[], fromDay: number,
    heads: number, considered: PublicPassageQuote[], latestArrival: number, graph: RouteQueries,
    initialWalk?: number): number | null {
    let day = fromDay;
    for (const [step, leg] of legs.entries()) {
        day += step === 0 ? initialWalk ?? (leg.by === 'ship' ? LOCAL_WALK_DAYS : 0)
            : leg.by === 'ship' && legs[step - 1]?.by === 'land' ? LOCAL_WALK_DAYS : 0;
        if (leg.by === 'land') {
            const distance = walkingDaysFrom(state.locations, leg.fromId, undefined, graph).get(leg.toId);
            if (distance === undefined || journeyNeedsWater(state.locations, leg.fromId, leg.toId, graph)) return null;
            day += Math.max(1, Math.ceil(distance));
            if (day > latestArrival) return null;
            continue;
        }
        const from = state.locations.find(place => place.id === leg.fromId);
        const to = state.locations.find(place => place.id === leg.toId);
        const line = from && to ? publicShipLinesFrom(state, from.name, day,graph).find(row => row.to === to.name) : undefined;
        if (!line) return null;
        const quote = earliestQuotedPublicPassage(state, leg.fromId, leg.toId,
            day, latestArrival, heads, considered,graph);
        if (!quote) return null;
        considered.push(quote);
        day = quote.arrivalDay;
    }
    return day;
}

/** A mission's paid ship seats and ordinary walking legs share one dated itinerary. */
function startPublicMissionLeg(state: WorldState, missionId: string,
    members: NpcRecord[], legs: readonly MissionLeg[], step: number, day: number,
    onDue?: (memberId: string, day: number) => void, missionStep = step,
    graph?: RouteQueries): boolean {
    const leg = legs[step];
    if (!leg || members.length === 0) return false;
    const from = state.locations.find(place => place.id === leg.fromId);
    const to = state.locations.find(place => place.id === leg.toId);
    if (!from || !to) return false;
    graph ??= routeQueriesFor(state.locations);
    const station=leg.by==='land'?null:departureAreaAt(state,from,'landing',graph);
    {
        const request={intentId:missionId,target:{locationId:from.id,areaId:station?.id}};
        const scene=departureSceneFor(state,graph);
        const arrivals=members.map(member=>member.activity?.note==='Walking to the departure point.'&&member.activity.capitalMissionId===missionId
            ?finishActualDepartureApproach(state,member.id,request,day,graph,scene)
            :beginActualDepartureApproach(state,member.id,request,day,member,graph,scene));
        if(arrivals.some(result=>result.kind==='refused'||result.kind==='needs_geographic_leg'))return false;
        let walking=false;
        for(const result of arrivals)if('actor' in result){
            const at=state.npcs.findIndex(n=>n.id===result.actor.id);
            if(result.kind==='waiting'){walking=true;onDue?.(result.actor.id,result.actor.activity!.untilDay!);}
            if(result.kind==='approaching'){
                walking=true;state.npcs[at]={...result.actor,activity:{...result.actor.activity!,
                    capitalMissionLeg:missionStep,capitalMissionWaiting:true}};
                onDue?.(result.actor.id,result.actor.activity!.untilDay!);
            }else if(result.kind==='ready')state.npcs[at]=result.actor;
        }
        if(walking)return true;
        members=members.map(member=>state.npcs.find(n=>n.id===member.id)!);
    }
    if(members.some(member => locationOnNpcJourney(state.locations, member, day, graph) !== from.id))return false;
    let due: number;
    let quote: PublicPassageQuote | null = null;
    if (leg.by === 'land') {
        const distance = graph?.locations === state.locations
            ? graph.treeFrom(from.id).days.get(to.id)
            : walkingDaysFrom(state.locations, from.id).get(to.id);
        if (distance === undefined || journeyNeedsWater(state.locations, from.id, to.id, graph)) return false;
        due = day + Math.max(1, Math.ceil(distance));
    } else {
        const line = publicShipLinesFrom(state, from.name, day,graph).find(row => row.to === to.name);
        if (!line) return false;
        const mission = witnessIndexFor(state).byId.get(missionId);
        const reservations = mission?.data.publicReservations;
        const reserved = typeof reservations === 'string'
            ? (JSON.parse(reservations) as PublicPassageLeg[]).find(row =>
                row.fromId === from.id && row.toId === to.id && row.departureDay >= day)
            : undefined;
        const departure = reserved?.departureDay ?? line.runsFromDay ?? day;
        if (departure > day) {
            for (const member of members) {
                const at = state.npcs.findIndex(n => n.id === member.id);
                state.npcs[at] = { ...setLocation(member, from.id, day), activity: { kind: 'out_with_a_party',
                    capitalMissionId: missionId, capitalMissionLeg: missionStep, capitalMissionWaiting: true,
                    note: `Waiting for a ship to ${to.name}.`, withIds: members.filter(n => n.id !== member.id).map(n => n.id),
                    standingIn: station?.id ?? null, sinceDay: day, untilDay: departure } };
                onDue?.(member.id, departure);
            }
            return true;
        }
        quote = quotePublicPassage(state, from.id, to.id, departure, members.length, [], undefined, members.map(member=>member.id),graph);
        if (!quote) {
            const retry = day + 30;
            for (const member of members) {
                const at = state.npcs.findIndex(n => n.id === member.id);
                state.npcs[at] = { ...setLocation(member, from.id, day), activity: { kind: 'out_with_a_party',
                    capitalMissionId: missionId, capitalMissionLeg: missionStep, capitalMissionWaiting: true,
                    note: `Waiting for a ship to ${to.name}.`, withIds: members.filter(n => n.id !== member.id).map(n => n.id),
                    standingIn: station?.id ?? null, sinceDay: day, untilDay: retry } };
                onDue?.(member.id, retry);
            }
            return true;
        }
        due = quote.arrivalDay;
        if (!publicShipHullCanBeBoarded(state,quote)) return false;
        ensureShipCrew(state, quote.lane, from.id, day);
        bindShipCrewToPassage(state, quote);
        const operator=state.npcs.find(npc=>npc.status==='alive' && npc.tags.includes('crew-of:'+quote!.vesselId)
            && npc.identity.occupation==='shipmaster');
        if (!operator || !realiseAcceptedPublicShipHull(state,quote,operator)) throw new Error('Accepted public ship custody changed synchronously.');
    }
    for (const member of members) {
        const at = state.npcs.findIndex(n => n.id === member.id);
        const peers = members.filter(n => n.id !== member.id).map(n => n.id);
        const moved = quote
            ? onSponsoredPublicPassage(state, member, quote, `On house business to ${to.name}.`, peers)
            : { ...member, activity: { kind: 'travelling' as const, note: `On house business to ${to.name}.`,
                withIds: peers, fromLocationId: from.id, returnTo: to.id, sinceDay: day, untilDay: due } };
        if (!moved?.activity) return false;
        state.npcs[at] = { ...setLocation(moved, to.id, day), activity: {
            ...moved.activity, capitalMissionId: missionId, capitalMissionLeg: missionStep } };
        onDue?.(member.id, due);
    }
    if (quote) recordPublicPassage(state, quote, day, from.id, members.map(n => n.id),undefined,undefined,
        members.map(n=>({id:n.id,name:n.name})));
    return true;
}

function sendByPublicPassage(state: WorldState, house: FactionRecord, venue: LocationRecord,
    party: NpcRecord[], reason: string, day: number, service: MissionService,
    onDue?: (memberId: string, day: number) => void, graph?: RouteQueries,
    routes?: PublicRoutesInOnePass): void {
    if (!house.seatLocationId) return;
    graph ??= routeQueriesFor(state.locations);
    routes ??= new Map();
    const route = publicRoute(state, house.seatLocationId, venue.id, graph, routes);
    if (!route) return;
    const departureGround = state.locations.find(place => place.id === route[0]?.fromId);
    if (!departureGround) return;
    const departureArea = route[0]?.by === 'ship'
        ? departureAreaAt(state,departureGround,'landing',graph)?.id : null;
    const scene = departureSceneFor(state,graph);
    const approaches = party.map(member => readActualDepartureApproach(state, member.id,
        {intentId: 'public-mission-quote', target: {locationId: departureGround.id, areaId: departureArea}}, day,undefined,graph,scene));
    if (approaches.some(read => read.kind !== 'ready' && read.kind !== 'local_walk')) return;
    const initialWalk = approaches.some(read => read.kind === 'local_walk') ? LOCAL_WALK_DAYS : 0;
    const considered: PublicPassageQuote[] = [];
    const lifespan = Math.min(...party.map(member => member.cultivation.lifespanEndsOnDay));
    const outwardDeadline = 'eventDay' in service ? Math.min(service.eventDay, lifespan)
        : lifespan - service.days;
    const arrived = quotedRoute(state, route, day, party.length, considered, outwardDeadline, graph, initialWalk);
    if (arrived === null || 'eventDay' in service && arrived > service.eventDay) return;
    const serviceEnd = 'days' in service ? arrived + service.days : Math.max(arrived + 1, service.untilDay);
    const home = quotedRoute(state, homeRoute(route), serviceEnd, party.length, considered, lifespan, graph);
    if (home === null) return;
    const fare = considered.reduce((sum, leg) => sum + leg.fareStones, 0);
    const purse = Number(house.resources.spirit_stones ?? 0);
    if (fare > purse) return;
    house.resources.spirit_stones = purse - fare;
    const dispatch = appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: 'faction',
        summary: `${house.name} sent ${party.length} to ${venue.name} for ${reason}.`,
        locationId: house.seatLocationId, factionIds: [house.id],
        actors: party.map(n => ({ id: n.id, name: n.name, role: 'delegate' })),
        data: { capitalMission: true, publicMission: true, destinationId: venue.id, reason,
            publicRoute: JSON.stringify(route), publicServiceEnd: serviceEnd,
            publicServiceDays: 'days' in service ? service.days : null,
            publicReservations: JSON.stringify(considered.map(leg => ({
                lane: leg.lane, vesselId: leg.vesselId, fromId: leg.fromId, toId: leg.toId,
                departureDay: leg.departureDay, arrivalDay: leg.arrivalDay
            }))),
            publicFareStones: fare, plannedReturnDay: home } }), { recur: false });
    const ready = party.map(member => state.npcs.find(n => n.id === member.id)!);
    if (!startPublicMissionLeg(state, dispatch.id, ready, route, 0, day, onDue, 0, graph))
        throw new Error(`The paid route from ${house.seatLocationId} to ${venue.id} could not begin.`);
    for (const member of party) {
        const at = state.npcs.findIndex(n => n.id === member.id);
        loadExchangeConsignment(state, state.npcs[at]!, day, graph);
    }
}

/** A receiving house pays a selected disciple's one-way passage to its grounds. */
export function journeySelectedToHouseSeat(state: WorldState, house: FactionRecord,
    npc: NpcRecord, day: number): NpcRecord | null {
    if (!house.seatLocationId || !npc.locationId) return null;
    const graph = routeQueriesFor(state.locations);
    const physical = locationOnNpcJourney(state.locations, npc, day, graph);
    const from = physical && exteriorGroundOfDeparture(state, physical,graph.places)?.id;
    if (!from) return null;
    if (from === house.seatLocationId && physical === npc.locationId && (npc.activity?.kind !== 'travelling'
        || npc.activity.untilDay != null && npc.activity.untilDay <= day))
        return {...npc, activity: null, updatedOnDay: day};
    const route = publicRoute(state, from, house.seatLocationId, graph, new Map());
    if (!route) return null;
    const departureGround = state.locations.find(place => place.id === from)!;
    const departureArea = route[0]?.by === 'ship'
        ? departureAreaAt(state,departureGround,'landing',graph)?.id : null;
    const approach = readActualDepartureApproach(state, npc.id,
        {intentId: 'selected-passage-quote', target: {locationId: from, areaId: departureArea}}, day,undefined,graph);
    if (approach.kind !== 'ready' && approach.kind !== 'local_walk') return null;
    const considered: PublicPassageQuote[] = [];
    const arrival = quotedRoute(state, route, day, 1, considered, npc.cultivation.lifespanEndsOnDay, graph,
        approach.kind === 'local_walk' ? LOCAL_WALK_DAYS : 0);
    if (arrival === null || arrival >= npc.cultivation.lifespanEndsOnDay) return null;
    const fare = considered.reduce((total, leg) => total + leg.fareStones, 0);
    const purse = Number(house.resources.spirit_stones ?? 0);
    if (fare > purse) return null;
    const at = state.npcs.findIndex(person => person.id === npc.id);
    if (at < 0) return null;
    house.resources.spirit_stones = purse - fare;
    const dispatch = appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: 'faction',
        summary: `${house.name} paid for ${npc.name} to travel to its grounds.`,
        locationId: from, factionIds: [house.id],
        actors: [{ id: npc.id, name: npc.name, role: 'selected disciple' }],
        data: { capitalMission: true, publicMission: true, publicOneWay: true,
            destinationId: house.seatLocationId, reason: 'joining the receiving house',
            publicRoute: JSON.stringify(route),
            publicReservations: JSON.stringify(considered.map(leg => ({
                lane: leg.lane, vesselId: leg.vesselId, fromId: leg.fromId, toId: leg.toId,
                departureDay: leg.departureDay, arrivalDay: leg.arrivalDay
            }))), publicFareStones: fare, plannedArrivalDay: arrival } }), { recur: false });
    if (!startPublicMissionLeg(state, dispatch.id, [state.npcs[at]!], route, 0, day, undefined, 0, graph))
        throw new Error(`The paid journey to ${house.name} could not begin.`);
    return state.npcs[at]!;
}

/** Continue a paid mission at its next physical arrival or service end. */
export function advancePublicCapitalMission(state: WorldState, personId: string, day: number,
    onDue?: (memberId: string, day: number) => void, graph?: RouteQueries): boolean {
    const person = state.npcs.find(n => n.id === personId);
    const activity = person?.activity;
    if (!person || !activity?.capitalMissionId || activity.untilDay == null || activity.untilDay > day) return false;
    const mission = witnessIndexFor(state).byId.get(activity.capitalMissionId);
    if (mission?.data.publicMission !== true || typeof mission.data.publicRoute !== 'string') return false;
    const route = JSON.parse(mission.data.publicRoute) as MissionLeg[];
    const home = homeRoute(route);
    const n = route.length;
    const step = activity.capitalMissionLeg ?? 0;
    if (!mission.factionIds[0] || !n) return false;
    const members = state.npcs.filter(npc => npc.status === 'alive'
        && npc.activity?.capitalMissionId === mission.id && npc.activity.capitalMissionLeg === step
        && npc.activity.untilDay != null && npc.activity.untilDay <= day);
    if (!members.length) return false;
    if (!graph || graph.locations !== state.locations) graph = routeQueriesFor(state.locations);
    if (activity.capitalMissionWaiting) {
        const returning = step > n;
        const legs = returning ? home : route;
        const at = returning ? step - n - 1 : step;
        // A changed door can hold an already paid intention at its real origin.
        startPublicMissionLeg(state, mission.id, members, legs, at, day, onDue, step, graph);
        return true;
    }
    if (step < n - 1) {
        startPublicMissionLeg(state, mission.id, members, route, step + 1, day, onDue, step + 1, graph);
        return true;
    }
    if (step === n - 1) {
        const venue = state.locations.find(place => place.id === mission.data.destinationId);
        if (!venue) return true;
        if (mission.data.publicOneWay === true) {
            for (const member of members) {
                const at = state.npcs.findIndex(npc => npc.id === member.id);
                state.npcs[at] = { ...setLocation(member, venue.id, day), activity: {
                    kind: 'travelling', note: `Arrived at ${venue.name}.`, withIds: [],
                    fromLocationId: venue.id, returnTo: venue.id, sinceDay: day, untilDay: day } };
            }
            return false;
        }
        const untilDay = typeof mission.data.publicServiceDays === 'number'
            ? day + mission.data.publicServiceDays
            : Math.max(day + 1, Number(mission.data.publicServiceEnd ?? day + 1));
        for (const member of members) {
            const at = state.npcs.findIndex(npc => npc.id === member.id);
            state.npcs[at] = { ...setLocation(member, venue.id, day), activity: {
                kind: 'out_with_a_party', capitalMissionId: mission.id, capitalMissionLeg: n,
                note: `On ${mission.data.reason} at ${venue.name}.`,
                withIds: members.filter(npc => npc.id !== member.id).map(npc => npc.id),
                sinceDay: day, untilDay } };
            onDue?.(member.id, untilDay);
        }
        return true;
    }
    if (step === n || step < n * 2) {
        const next = step === n ? 0 : step - n;
        startPublicMissionLeg(state, mission.id, members, home, next, day,
            onDue, n + 1 + next, graph);
        return true;
    }
    const homeId = route[0]!.fromId;
    for (const member of members) {
        const at = state.npcs.findIndex(npc => npc.id === member.id);
        state.npcs[at] = { ...setLocation(member, homeId, day), activity: {
            kind: 'out_with_a_party', note: `Returned from ${mission.data.reason}.`,
            withIds: members.filter(npc => npc.id !== member.id).map(npc => npc.id),
            sinceDay: mission.day, untilDay: day, returnTo: homeId } };
    }
    return false;
}

/** The geography reader includes capitals whose catalog kind is a market town. */
export function capitalPlaces(state: WorldState): LocationRecord[] {
    return state.locations.filter(l => l.kind === 'settlement' && isBelowTheLid(l)
        && (l.tags.includes('city') || whatKindOfPlace(l.name) === 'provincial capital'));
}

/** One auction a year, one inter-house board every three years, with seeded dates. */
export function capitalCalendar(state: WorldState, year: number): CapitalOccasion[] {
    const occasions: CapitalOccasion[] = [];
    for (const venue of capitalPlaces(state)) {
        const province = theProvinceAround(state.locations, venue.id);
        const houses = state.factions.filter(h => h.dissolvedOnDay === null && isBelowTheLid(h));
        const host = houses.find(h => h.id === venue.controllingFactionId)
            ?? houses.filter(h => theProvinceAround(state.locations, h.seatLocationId) === province)
                .sort((a, b) => Number(b.resources.power_ordinal ?? 0) - Number(a.resources.power_ordinal ?? 0)
                    || a.id.localeCompare(b.id))[0];
        if (!host) continue;
        const rng = forStream(state.seed, 'capital-calendar', venue.id);
        const auctionDay = year * DAYS_PER_YEAR + 100 + rng.int(0, 35);
        const row = COMPETITION_CALENDARS.find(r => r.open && r.venueName === venue.name);
        const contestDay = theDayItFallsIn(state.seed, { id: row?.id ?? `open:${venue.id}`,
            name: venue.name, everyYears: row?.everyYears ?? 3 }, year);
        occasions.push({ venueId: venue.id, hostId: host.id, kind: 'auction',
            opensOnDay: auctionDay - 45, onDay: auctionDay, endsOnDay: auctionDay + 7 });
        if (contestDay !== null) {
            const day = contestDay;
            occasions.push({ venueId: venue.id, hostId: host.id, kind: 'competition',
                opensOnDay: day - (row?.noticeDays ?? 90), onDay: day, endsOnDay: day + 14 });
        }
    }
    return occasions;
}

/** Free hands, after the existing head, gate and room reads have kept their people. */
function spareFor(state: WorldState, house: FactionRecord, day: number,graph:RouteQueries): NpcRecord[] {
    const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id && isTheWorldsToMove(n));
    const grounds = new Map(roll.map(n => {
        const physical = locationOnNpcJourney(state.locations,n,day,graph);
        return [n.id,physical ? exteriorGroundOfDeparture(state,physical,graph.places)?.id : null];
    }));
    const rooms = portfoliosIn({ locations: state.locations, sectId: house.id,
        roll: roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex })), rankCount: house.ranks.length });
    const officers = new Set(rooms.map(r => r.holderId).filter(Boolean));
    const spare = whatTheHouseCanSpare({ seatLocationId: house.seatLocationId, rankCount: house.ranks.length,
        onDay: day, roster: roll.map(n => ({ id: n.id, name: n.name, ordinal: n.cultivation.realmOrdinal,
            rankIndex: n.factionRankIndex, locationId: grounds.get(n.id) ?? null,
            committedUntilDay: n.activity && (isAwayOnSomething(n.activity.kind)
                || n.activity.untilDay != null) ? n.activity.untilDay ?? Infinity : null })) });
    const free = new Set(spare.free.map(n => n.id));
    return roll.filter(n => free.has(n.id) && !officers.has(n.id)
        && grounds.get(n.id) === house.seatLocationId && (n.activity?.withIds.length ?? 0) === 0);
}

function send(state: WorldState, house: FactionRecord, venue: LocationRecord, party: NpcRecord[],
    reason: string, day: number, service: MissionService,
    onDue?: (memberId: string, day: number) => void, graph?: RouteQueries,
    routes?: PublicRoutesInOnePass): void {
    // The actual itinerary owns doors, routes, seats, fares and arrival.
    sendByPublicPassage(state, house, venue, party, reason, day, service, onDue, graph, routes);
}

/** Four opportunities per house-year, one seeded dispatch draw each, no daily steps. */
export function sendCapitalBusiness(state: WorldState, year: number, quarter: number, day: number,
    onDue?: (memberId: string, day: number) => void): void {
    const cities = capitalPlaces(state);
    if (!cities.length) return;
    // One dated sending pass changes people and stores, not the roads they use.
    const graph = routeQueriesFor(state.locations);
    const routes: PublicRoutesInOnePass = new Map();
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !house.seatLocationId || !isBelowTheLid(house)) continue;
        const rng = forStream(state.seed, 'capital-business', house.id, year, quarter);
        if (!rng.chance(0.35)) continue;
        const province = theProvinceAround(state.locations, house.seatLocationId);
        const nearby = cities.filter(l => theProvinceAround(state.locations, l.id) === province);
        const venues = nearby.length && rng.chance(0.8) ? nearby : cities;
        const venue = venues[rng.int(0, venues.length - 1)]!;
        const spare = spareFor(state, house, day,graph);
        if (!spare.length) continue;
        const reason = ['trade and purchases', 'carrying the house report', 'escorting the house envoy'][rng.int(0, 2)]!;
        const party = [...spare].sort((a, b) => forStream(state.seed, 'capital-business-hand', house.id,
            year, quarter, a.id).next() - forStream(state.seed, 'capital-business-hand', house.id,
            year, quarter, b.id).next()).slice(0, reason.startsWith('escorting') ? 2 : 1);
        send(state, house, venue, party, reason, day, { days: rng.int(40, 80) }, onDue, graph, routes);
    }
}

/** Delegations use ordinary away activities and ordinary competition entries. */
export function sendCapitalDelegations(state: WorldState, occasion: CapitalOccasion,
    onDue?: (memberId: string, day: number) => void): void {
    const venue = state.locations.find(l => l.id === occasion.venueId);
    const host = state.factions.find(h => h.id === occasion.hostId && h.dissolvedOnDay === null);
    if (!venue || !host) return;
    const day = occasion.opensOnDay;
    const graph = routeQueriesFor(state.locations);
    const routes: PublicRoutesInOnePass = new Map();
    const province = theProvinceAround(state.locations, venue.id);
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !house.seatLocationId || !isBelowTheLid(house)) continue;
        const rng = forStream(state.seed, 'capital-delegation', venue.id, occasion.kind, occasion.onDay, house.id);
        const near = theProvinceAround(state.locations, house.seatLocationId) === province;
        if (!rng.chance(near ? 0.75 : 0.2)) continue;
        const spare = spareFor(state, house, day,graph);
        const interest = (n: NpcRecord) => 1 + n.goals.filter(g => g.status === 'active'
            && (occasion.kind === 'auction' ? g.kind === 'wealth' || g.kind === 'cultivation'
                : g.kind === 'status' || g.kind === 'cultivation')).reduce((s, g) => s + g.priority, 0)
            + (occasion.kind === 'competition' && n.factionRankIndex < house.ranks.length - 3 ? 1 : 0);
        const party = [...spare].sort((a, b) => -Math.log(Math.max(1e-9,
            forStream(state.seed, 'capital-delegate-hand', venue.id, occasion.onDay, a.id).next())) / interest(a)
            + Math.log(Math.max(1e-9,
                forStream(state.seed, 'capital-delegate-hand', venue.id, occasion.onDay, b.id).next())) / interest(b))
            .slice(0, rng.int(1, 2));
        if (party.length) send(state, house, venue, party,
            occasion.kind === 'auction' ? 'the auction delegation' : 'the inter-house competition',
            day, { untilDay: occasion.endsOnDay + 14, eventDay: occasion.onDay }, onDue, graph, routes);
    }
    appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: 'public', scale: 'regional',
        summary: `${venue.name} holds an ${occasion.kind === 'auction' ? 'auction' : 'inter-house competition'} on day ${occasion.onDay}.`,
        locationId: venue.id, factionIds: [host.id], magnitude: 0.4,
        actors: [],
        data: { capitalOccasion: true, hostId: host.id, occasionKind: occasion.kind, onDay: occasion.onDay, endsOnDay: occasion.endsOnDay } }));
}
