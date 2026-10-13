import { finishPrivatePartyHunt } from './private-party-hunt.js';
/** Cities receive dated house business; attendance is a stint, never a new home. */
import { loadExchangeConsignment } from './wares-at-a-capital-exchange.js';
import { collectPrivatePartyFinds } from './private-party-finds.js';
import { privateWorkTerms, settlePrivateWork } from './private-paid-work.js';
import { servePrivateWork } from './private-work-is-served.js';
import { COMPETITION_CALENDARS } from '../../data/cultivation/competition-calendars.js';
import { whatKindOfPlace } from '../../data/cultivation/regions.js';
import { theDayItFallsIn } from './a-competition-anybody-may-enter.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { forStream } from '../cultivation/rng.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { whatTheHouseCanSpare } from './who-goes-out-for-a-house-and-what-comes-back.js';
import { theProvinceAround } from './ground-holder.js';
import { isBelowTheLid } from './layers.js';
import { isAwayOnSomething, isTheWorldsToMove, setLocation, type NpcRecord, type NpcActivity } from './npc-state.js';
import { routeQueriesFor, walkingDaysFrom, walkingRouteFrom, type RouteQueries } from './locations.js';
import { departureSceneFor, beginActualDepartureApproach, finishActualDepartureApproach, readActualDepartureApproach, exteriorGroundOfDeparture } from './departure-approach.js';
import { LOCAL_WALK_DAYS } from './local-walking-cost.js';
import { stonesFor } from './the-fare-and-calendar-of-a-passage.js';
import { departureAreaAt } from './where-in-a-place-somebody-is-standing.js';
import { journeyNeedsWater, locationOnNpcJourney } from './places-on-the-way.js';
import { earliestQuotedPublicPassage, onSponsoredPublicPassage, publicShipLinesFrom,
    quotePublicPassage, recordPublicPassage, thePortsShipsPutInAt,
    type PublicPassageLeg, type PublicPassageQuote } from './public-shipping.js';
import { realiseAcceptedPublicShipHull, publicShipHullCanBeBoarded } from './a-public-ship-hull.js';
import { bindShipCrewToPassage, ensureShipCrew } from './ship-crew.js';
import { witnessIndexFor, factsWithDataValue } from './witness-reaction-index.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { LocationRecord } from './locations.js';
import type { FactionRecord, WorldState } from './world-state.js';
import { isPlayerInvolved, drawBackgroundIncidents } from './background-incident-draw.js';
import { alliesOf, circleCandidatesFor, receiveHouseVisitors } from './gatherings.js';
import { theBodyItAnswersTo } from '../../data/cultivation/governance-and-water-rights.js';
import { getSendingReason } from '../../data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { makeObject, transferPossession, isHeld, isWorn } from './possessions.js';
import { whatLeadingDisciplesIsWorth, creditMeritWith } from './what-a-house-counts-in-somebodys-favour.js';
import { theirFaceMoves, whatBeingWatchedIsWorth } from './what-a-face-is-worth.js';
import { regardFor } from '../cultivation/regard.js';
import { lostChance, postingFor, resolveSending } from './who-goes-out-for-a-house-and-what-comes-back.js';
import { theReasonBehind } from '../encounters/what-a-house-has-on-its-board.js';
import { theWorldLoses } from './npc-state.js';
import { whatFinishingBoardWorkPays } from './a-disciple-takes-work-off-the-board.js';
import { recordNpcActualArrival } from './a-body-that-actually-arrived.js';
import { discoverableInsights, integrateInsight, recordAchievement } from '../cultivation/understanding.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import { DAO_HOUSES } from '../../data/cultivation/sects.js';
import { withAttentionRecorded } from './who-is-given-attention-this-year.js';
import { landSuccessfulHouseWork } from './the-world-changing-on-its-own.js';
import { whoTheySayTookThemOn } from './a-house-expects-somebody-it-took-on.js';
import { pathTo, reachThrough } from './architecture.js';
import { theDoorKeysTheyActuallyCarry } from './door-key-custody.js';

export interface CapitalOccasion {
    venueId: string;
    hostId: string;
    kind: 'auction' | 'competition';
    opensOnDay: number;
    onDay: number;
    endsOnDay: number;
}

interface MissionLeg { fromId: string; toId: string; by: 'land' | 'ship' }
type MissionService = ({ days: number } | { untilDay: number; eventDay: number }) & { returnByDay?: number };
type PublicRoutesInOnePass = Map<string, MissionLeg[] | null>;
type PublicDockRead = { ports: LocationRecord[];
    lines: Map<string, { toId: string; days: number }[]> };
const DOCKS_IN_ONE_PASS = new WeakMap<PublicRoutesInOnePass, PublicDockRead>();
const ROUTES_ON_THIS_GRAPH = new WeakMap<RouteQueries, Map<string, PublicRoutesInOnePass>>();

function routesOnThisGraph(state: WorldState, graph: RouteQueries): PublicRoutesInOnePass {
    let seeds = ROUTES_ON_THIS_GRAPH.get(graph);
    if (!seeds) { seeds = new Map(); ROUTES_ON_THIS_GRAPH.set(graph, seeds); }
    let routes = seeds.get(state.seed);
    if (!routes) { routes = new Map(); seeds.set(state.seed, routes); }
    return routes;
}

/** A sending pass changes people and bookings, not its geographic dock connections. */
function publicDocksInOnePass(state: WorldState, graph: RouteQueries, routes: PublicRoutesInOnePass): PublicDockRead {
    let read = DOCKS_IN_ONE_PASS.get(routes);
    if (read) return read;
    const byName = new Map(state.locations.map(place => [place.name, place]));
    const ports = thePortsShipsPutInAt(state, graph).map(name => byName.get(name))
        .filter((place): place is LocationRecord => place !== undefined);
    const lines = new Map(ports.map(port => [port.id, publicShipLinesFrom(state, port.name, 0, graph)
        .flatMap(line => { const other = byName.get(line.to);
            return other ? [{ toId: other.id, days: line.days }] : []; })]));
    read = { ports, lines };
    DOCKS_IN_ONE_PASS.set(routes, read);
    return read;
}

/** Route results live only for one unchanged-graph sending pass. */
function publicRoute(state: WorldState, fromId: string, toId: string, graph: RouteQueries,
    routes: PublicRoutesInOnePass): MissionLeg[] | null {
    const key = `${fromId}|${toId}`;
    if (routes.has(key)) return routes.get(key)!;
    const { ports, lines } = publicDocksInOnePass(state, graph, routes);
    const outward = graph.treeFrom(fromId).days;
    const inward = graph.treeFrom(toId).days;
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
        for (const line of lines.get(port.id) ?? []) {
            if (nodes.has(line.toId)) add(port.id, line.toId, line.days, 'ship');
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
    initialWalk?: number, batch?: Parameters<typeof earliestQuotedPublicPassage>[8], people?: readonly NpcRecord[]): number | null {
    let day = fromDay;
    for (const [step, leg] of legs.entries()) {
        day += step === 0 ? initialWalk ?? (leg.by === 'ship' ? LOCAL_WALK_DAYS : 0)
            : leg.by === 'ship' && legs[step - 1]?.by === 'land' ? LOCAL_WALK_DAYS : 0;
        if (leg.by === 'land') {
            const distance = graph.treeFrom(leg.fromId).days.get(leg.toId);
            if (distance === undefined || journeyNeedsWater(state.locations, leg.fromId, leg.toId, graph)) return null;
            day += Math.max(1, Math.ceil(distance));
            if (day > latestArrival) return null;
            continue;
        }
        const from = state.locations.find(place => place.id === leg.fromId);
        const to = state.locations.find(place => place.id === leg.toId);
        const line = from && to ? publicShipLinesFrom(state, from.name, day,graph).find(row => row.to === to.name) : undefined;
        if (!line) return null;
        if (people && !people.some(person => isPlayerInvolved(state, person))) {
            day = Math.max(day, line.runsFromDay ?? day) + line.days;
            if (day > latestArrival) return null;
            continue;
        }
        const quote = earliestQuotedPublicPassage(state, leg.fromId, leg.toId,
            day, latestArrival, heads, considered,graph,batch);
        if (!quote) return null;
        considered.push(quote);
        day = quote.arrivalDay;
    }
    return day;
}

/** Listed fares bound the purse before any expensive dated hull search. */
function listedRouteFare(state: WorldState, legs: readonly MissionLeg[], day: number,
    heads: number, graph: RouteQueries): number {
    let fare = 0;
    for (const leg of legs) {
        if (leg.by !== 'ship') continue;
        const from = graph.places.get(leg.fromId), to = graph.places.get(leg.toId);
        const line = from && to ? publicShipLinesFrom(state, from.name, day, graph).find(row => row.to === to.name) : undefined;
        if (line) fare += stonesFor(line.cashPerSeat) * heads;
    }
    return fare;
}

function openPrivateWorkReference(state: WorldState, activity: NpcActivity | null | undefined): string | undefined {
    const id = activity?.privateWorkId ?? activity?.passageCompany?.privateWorkId;
    return id && state.obligations.some(word => word.id === id && word.status === 'open') ? id : undefined;
}

/** A mission's paid ship seats and ordinary walking legs share one dated itinerary. */
function startPublicMissionLeg(state: WorldState, missionId: string,
    members: NpcRecord[], legs: readonly MissionLeg[], step: number, day: number,
    onDue?: (memberId: string, day: number) => void, missionStep = step,
    graph?: RouteQueries, readScene?: ReturnType<typeof departureSceneFor>): boolean {
    const leg = legs[step];
    if (!leg || members.length === 0) return false;
    const from = state.locations.find(place => place.id === leg.fromId);
    const to = state.locations.find(place => place.id === leg.toId);
    if (!from || !to) return false;
    const purpose = `${typeof witnessIndexFor(state).byId.get(missionId)?.data.privateSponsorId === 'string'
        ? 'Travelling' : 'On house business'} to ${to.name}.`;
    const privateWordOf = (activity: NpcActivity | null | undefined) => openPrivateWorkReference(state, activity);
    if (!members.some(member => isPlayerInvolved(state, member))) {
        const line = leg.by === 'ship'
            ? publicShipLinesFrom(state, from.name, day, graph).find(row => row.to === to.name) : undefined;
        const walking = leg.by === 'land'
            ? (graph ?? routeQueriesFor(state.locations)).treeFrom(from.id).days.get(to.id) : undefined;
        if (leg.by === 'ship' ? !line : walking === undefined) return false;
        const transfer = leg.by === 'ship' && step > 0 && legs[step - 1]?.by === 'land' ? LOCAL_WALK_DAYS : 0;
        const leaves = line ? Math.max(day + transfer, line.runsFromDay ?? day) : day;
        const due = leaves + (line?.days ?? Math.max(1, Math.ceil(walking!)));
        for (const member of members) {
            const at = state.npcs.findIndex(n => n.id === member.id);
            state.npcs[at] = { ...setLocation(member, from.id, day), activity: {
                kind: 'travelling', capitalMissionId: missionId, capitalMissionLeg: missionStep,
                privateWorkId: privateWordOf(member.activity),
                note: purpose, withIds: members.filter(n => n.id !== member.id).map(n => n.id),
                sinceDay: leaves, untilDay: due, fromLocationId: from.id, returnTo: to.id,
                seaLaneId: line?.lane.id
            } };
        }
        return true;
    }
    graph ??= routeQueriesFor(state.locations);
    const station=leg.by==='land'?null:departureAreaAt(state,from,'landing',graph);
    {
        const request={intentId:missionId,target:{locationId:from.id,areaId:station?.id}};
        const scene=readScene??departureSceneFor(state,graph);
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
                    privateWorkId: privateWordOf(members.find(member => member.id === result.actor.id)?.activity),
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
                    privateWorkId: privateWordOf(member.activity),
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
                    privateWorkId: privateWordOf(member.activity),
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
            ? onSponsoredPublicPassage(state, member, quote, purpose, peers)
            : { ...member, activity: { kind: 'travelling' as const, note: purpose,
                withIds: peers, fromLocationId: from.id, returnTo: to.id, sinceDay: day, untilDay: due } };
        if (!moved?.activity) return false;
        state.npcs[at] = { ...setLocation(moved, to.id, day), activity: {
            ...moved.activity, capitalMissionId: missionId, capitalMissionLeg: missionStep,
            ...(!moved.activity.passageCompany?.privateWorkId ? { privateWorkId: privateWordOf(member.activity) } : {}) } };
        onDue?.(member.id, due);
    }
    if (quote) recordPublicPassage(state, quote, day, from.id, members.map(n => n.id),undefined,undefined,
        members.map(n=>({id:n.id,name:n.name})));
    return true;
}

/** A house mission uses the same paid outward, service and home itinerary. */
export function sendHouseMission(state: WorldState, house: FactionRecord | null, venue: LocationRecord,
    party: NpcRecord[], reason: string, day: number, service: MissionService,
    onDue?: (memberId: string, day: number) => void, graph?: RouteQueries,
    routes?: PublicRoutesInOnePass, business?: Record<string, string | number | boolean | null>,
    personalSponsor?: NpcRecord): HistoricalFact | null {
    if (!party.length || !house && !personalSponsor) return null;
    graph ??= routeQueriesFor(state.locations);
    const originId = personalSponsor?.locationId
        ? exteriorGroundOfDeparture(state, personalSponsor.locationId, graph.places)?.id : house?.seatLocationId;
    if (!originId) return null;
    routes ??= routesOnThisGraph(state, graph);
    const route = publicRoute(state, originId, venue.id, graph, routes);
    if (!route) return null;
    const purse = personalSponsor ? personalSponsor.spiritStones : Number(house!.resources.spirit_stones ?? 0);
    if (listedRouteFare(state, route, day, party.length, graph)
        + listedRouteFare(state, homeRoute(route), day, party.length, graph) > purse) return null;
    const departureGround = state.locations.find(place => place.id === route[0]?.fromId);
    if (!departureGround) return null;
    const exact = party.some(member => isPlayerInvolved(state, member));
    const departureArea = exact && route[0]?.by === 'ship'
        ? departureAreaAt(state,departureGround,'landing',graph)?.id : null;
    const scene = departureSceneFor(state,graph);
    const approaches = exact ? party.map(member => readActualDepartureApproach(state, member.id,
        {intentId: 'public-mission-quote', target: {locationId: departureGround.id, areaId: departureArea}}, day,undefined,graph,scene)) : [];
    if (approaches.some(read => read.kind !== 'ready' && read.kind !== 'local_walk')) return null;
    const initialWalk = approaches.some(read => read.kind === 'local_walk') ? LOCAL_WALK_DAYS : 0;
    const considered: PublicPassageQuote[] = [];
    const batch: Parameters<typeof earliestQuotedPublicPassage>[8] = {};
    const lifespan = Math.min(...party.map(member => member.cultivation.lifespanEndsOnDay), service.returnByDay ?? Infinity);
    const outwardDeadline = 'eventDay' in service ? Math.min(service.eventDay, lifespan)
        : lifespan - service.days;
    const arrived = quotedRoute(state, route, day, party.length, considered, outwardDeadline, graph, initialWalk,batch,party);
    if (arrived === null || 'eventDay' in service && arrived > service.eventDay) return null;
    const serviceEnd = 'days' in service ? arrived + service.days : Math.max(arrived + 1, service.untilDay);
    const home = quotedRoute(state, homeRoute(route), serviceEnd, party.length, considered, lifespan, graph,undefined,batch,party);
    if (home === null) return null;
    const fare = exact ? considered.reduce((sum, leg) => sum + leg.fareStones, 0)
        : listedRouteFare(state, route, day, party.length, graph)
            + listedRouteFare(state, homeRoute(route), serviceEnd, party.length, graph);
    if (fare > purse) return null;
    if (personalSponsor) {
        const at = state.npcs.findIndex(person => person.id === personalSponsor.id);
        if (at < 0 || !isTheWorldsToMove(personalSponsor)) return null;
        state.npcs[at] = { ...state.npcs[at]!, spiritStones: purse - fare };
    } else house!.resources.spirit_stones = purse - fare;
    const dispatch = appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: personalSponsor ? 'secret' : 'faction',
        summary: personalSponsor ? `${personalSponsor.name} set out with ${party.length} to ${venue.name} for ${reason}.`
            : `${house!.name} sent ${party.length} to ${venue.name} for ${reason}.`,
        locationId: originId, factionIds: personalSponsor ? [] : [house!.id],
        actors: party.map(n => ({ id: n.id, name: n.name, role: business?.leaderId === n.id ? 'leader' : 'delegate' })),
        data: { ...business, ...(personalSponsor ? { privateSponsorId: personalSponsor.id } : {}),
            capitalMission: !business, publicMission: true, destinationId: venue.id, reason,
            publicRoute: JSON.stringify(route), publicServiceEnd: serviceEnd,
            publicServiceDays: 'days' in service ? service.days : null,
            publicReservations: JSON.stringify(considered.map(leg => ({
                lane: leg.lane, vesselId: leg.vesselId, fromId: leg.fromId, toId: leg.toId,
                departureDay: leg.departureDay, arrivalDay: leg.arrivalDay
            }))),
            publicFareStones: fare, plannedReturnDay: home } }), { recur: false });
    const ready = party.map(member => state.npcs.find(n => n.id === member.id)!);
    if (!startPublicMissionLeg(state, dispatch.id, ready, route, 0, day, onDue, 0, graph, scene))
        throw new Error(`The paid route from ${originId} to ${venue.id} could not begin.`);
    if (!business && !personalSponsor) for (const member of party) {
        const at = state.npcs.findIndex(n => n.id === member.id);
        loadExchangeConsignment(state, state.npcs[at]!, day, graph);
    }
    return dispatch;
}

/** Admission uses the house's, member's or actual recruiter's affordable fare. */
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
    const route = publicRoute(state, from, house.seatLocationId, graph, routesOnThisGraph(state, graph));
    if (!route) return null;
    const purse = Number(house.resources.spirit_stones ?? 0);
    const personalPurse = npc.spiritStones;
    const takenOn = whoTheySayTookThemOn(npc, house.id);
    const recruiter = takenOn && isTheWorldsToMove(npc) ? state.npcs.find(person => person.id === takenOn.recruiterId
        && person.status === 'alive' && person.factionId === house.id && isTheWorldsToMove(person)
        && locationOnNpcJourney(state.locations, person, day, graph) === physical) : undefined;
    const available = Math.max(purse, personalPurse, recruiter?.spiritStones ?? 0);
    if (listedRouteFare(state, route, day, 1, graph) > available) return null;
    const departureGround = state.locations.find(place => place.id === from)!;
    const exact = isPlayerInvolved(state, npc);
    const departureArea = exact && route[0]?.by === 'ship'
        ? departureAreaAt(state,departureGround,'landing',graph)?.id : null;
    const scene = departureSceneFor(state, graph);
    const approach = exact ? readActualDepartureApproach(state, npc.id,
        {intentId: 'selected-passage-quote', target: {locationId: from, areaId: departureArea}}, day,undefined,graph,scene)
        : { kind: 'ready' as const };
    if (approach.kind !== 'ready' && approach.kind !== 'local_walk') return null;
    const considered: PublicPassageQuote[] = [];
    const batch: Parameters<typeof earliestQuotedPublicPassage>[8] = {};
    const arrival = quotedRoute(state, route, day, 1, considered, npc.cultivation.lifespanEndsOnDay, graph,
        approach.kind === 'local_walk' ? LOCAL_WALK_DAYS : 0,batch,[npc]);
    if (arrival === null || arrival >= npc.cultivation.lifespanEndsOnDay) return null;
    const fare = exact ? considered.reduce((total, leg) => total + leg.fareStones, 0)
        : listedRouteFare(state, route, day, 1, graph);
    if (fare > available) return null;
    const at = state.npcs.findIndex(person => person.id === npc.id);
    if (at < 0) return null;
    const sponsored = fare <= purse;
    const payer = fare <= personalPurse ? npc : recruiter;
    if (sponsored) house.resources.spirit_stones = purse - fare;
    else {
        const payerAt = state.npcs.findIndex(person => person.id === payer!.id);
        state.npcs[payerAt] = { ...state.npcs[payerAt]!, spiritStones: payer!.spiritStones - fare };
    }
    const dispatch = appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: 'faction',
        summary: sponsored ? `${house.name} paid for ${npc.name} to travel to its grounds.`
            : `${payer!.name} paid for ${npc.name}'s passage to ${house.name}'s grounds.`,
        locationId: from, factionIds: [house.id],
        actors: [{ id: npc.id, name: npc.name, role: 'selected disciple' }],
        data: { capitalMission: true, publicMission: true, publicOneWay: true,
            destinationId: house.seatLocationId, reason: 'joining the receiving house',
            publicRoute: JSON.stringify(route),
            publicReservations: JSON.stringify(considered.map(leg => ({
                lane: leg.lane, vesselId: leg.vesselId, fromId: leg.fromId, toId: leg.toId,
                departureDay: leg.departureDay, arrivalDay: leg.arrivalDay
            }))), publicFareStones: fare, publicPayerId: sponsored ? house.id : payer!.id,
            plannedArrivalDay: arrival } }), { recur: false });
    if (!startPublicMissionLeg(state, dispatch.id, [state.npcs[at]!], route, 0, day, undefined, 0, graph, scene))
        throw new Error(`The paid journey to ${house.name} could not begin.`);
    return state.npcs[at]!;
}

/** Continue a paid mission at its next physical arrival or service end. */
export function advancePublicCapitalMission(state: WorldState, personId: string, day: number,
    onDue?: (memberId: string, day: number) => void, graph?: RouteQueries): boolean {
    let person = state.npcs.find(n => n.id === personId);
    if (!person?.activity?.capitalMissionId) return false;
    recordProgressAlongRoad(state,person,day,graph);
    if (isPlayerInvolved(state, person)) return advanceMissionStep(state, personId, day, onDue, graph);
    // An offscreen itinerary catches up at its own dates in one read.
    while (person.activity?.capitalMissionId && person.activity.untilDay != null && person.activity.untilDay <= day) {
        const previous: NpcActivity = person.activity;
        if (!advanceMissionStep(state, personId, previous.untilDay!, undefined, graph)) return false;
        person = state.npcs.find(n => n.id === personId)!;
        recordProgressAlongRoad(state,person,day,graph);
        if (person.activity === previous) break;
    }
    return true;
}

function advanceMissionStep(state: WorldState, personId: string, day: number,
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
    if ((!mission.factionIds[0] && typeof mission.data.privateSponsorId !== 'string') || !n) return false;
    let members = state.npcs.filter(npc => npc.status === 'alive'
        && npc.activity?.capitalMissionId === mission.id && npc.activity.capitalMissionLeg === step
        && npc.activity.untilDay != null && npc.activity.untilDay <= day);
    if (!members.length) return false;
    if (!graph || graph.locations !== state.locations) graph = routeQueriesFor(state.locations);
    const expectedEndpoint = step < n ? route[step]?.toId
        : step === n ? mission.data.destinationId : home[step-n-1]?.toId;
    if (activity.kind === 'travelling' && activity.vesselId && typeof expectedEndpoint === 'string'
        && activity.returnTo !== expectedEndpoint) {
        for (const member of members) {
            const at = state.npcs.findIndex(person => person.id === member.id);
            const reached = locationOnNpcJourney(state.locations, member, day, graph);
            state.npcs[at] = { ...(isTheWorldsToMove(member) ? setLocation(member,reached,day) : member),activity: { ...member.activity!,
                kind:'their_own_business',untilDay:null,note:'The carrier reached another endpoint; the original undertaking is waiting.' } };
        }
        return false;
    }
    if (activity.capitalMissionWaiting) {
        const returning = step > n;
        const legs = returning ? home : route;
        const at = returning ? step - n - 1 : step;
        // A changed door can hold an already paid intention at its real origin.
        startPublicMissionLeg(state, mission.id, members, legs, at, day, onDue, step, graph);
        return true;
    }
    if (activity.kind === 'travelling') {
        const reached=graph.places.get(activity.returnTo ?? '');
        if (reached && mission.data.houseBusiness === 'progress') recordHouseProgress(state,mission,members,reached,day);
    }
    if (step < n - 1) {
        if (activity.kind === 'travelling') {
            const origin = route[step + 1]!.fromId;
            for (const member of members) {
                const at = state.npcs.findIndex(row => row.id === member.id);
                state.npcs[at] = setLocation(state.npcs[at]!, origin, day);
            }
            for (const member of members) recordNpcActualArrival(state, state.npcs.find(row => row.id === member.id)!, member.activity!, day);
            members = members.map(member => state.npcs.find(row => row.id === member.id)!);
        }
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
            for (const member of members) recordNpcActualArrival(state, state.npcs.find(row => row.id === member.id)!, member.activity!, day);
            return false;
        }
        const untilDay = typeof mission.data.publicServiceDays === 'number'
            ? day + mission.data.publicServiceDays
            : Math.max(day + 1, Number(mission.data.publicServiceEnd ?? day + 1));
        const blocked = privateMissionObstacle(state, mission, members, venue, day);
        if (blocked) recordPrivateMissionObstacle(state, mission, members, venue, day, blocked.reason);
        const groundId = blocked ? state.locations.find(place => place.id === blocked.stoppedAt)?.parentId ?? venue.id : venue.id;
        for (const member of members) {
            const at = state.npcs.findIndex(npc => npc.id === member.id);
            state.npcs[at] = { ...setLocation(member, groundId, day), activity: {
                kind: 'out_with_a_party', capitalMissionId: mission.id, capitalMissionLeg: n,
                privateWorkId: openPrivateWorkReference(state, member.activity),
                note: blocked ? `Stopped at the entrance to ${venue.name}: ${blocked.reason}` : `On ${mission.data.reason} at ${venue.name}.`,
                withIds: members.filter(npc => npc.id !== member.id).map(npc => npc.id),
                sinceDay: day, untilDay } };
            onDue?.(member.id, untilDay);
        }
        for (const member of members) recordNpcActualArrival(state, state.npcs.find(row => row.id === member.id)!, member.activity!, day);
        members = members.map(member => state.npcs.find(row => row.id === member.id)!);
        receiveMissionParty(state, mission, members, venue, day);
        serveMissionPrivateWork(state, mission, day);
        return true;
    }
    if (step === n || step < n * 2) {
        if (activity.kind === 'travelling') {
            const origin = home[step - n]!.fromId;
            for (const member of members) {
                const at = state.npcs.findIndex(row => row.id === member.id);
                state.npcs[at] = setLocation(state.npcs[at]!, origin, day);
            }
            for (const member of members) recordNpcActualArrival(state, state.npcs.find(row => row.id === member.id)!, member.activity!, day);
            members = members.map(member => state.npcs.find(row => row.id === member.id)!);
        }
        if (step === n) serveMissionPrivateWork(state, mission, day);
        const next = step === n ? 0 : step - n;
        const returning = step === n ? finishMissionWork(state, mission, members, day) : members;
        if (!returning.length) return false;
        startPublicMissionLeg(state, mission.id, returning, home, next, day,
            onDue, n + 1 + next, graph);
        return true;
    }
    const homeId = route[0]!.fromId;
    const workReason=typeof mission.data.boardEntryId==='string'?theReasonBehind(mission.data.boardEntryId):null;
    const sendingHouse=state.factions.find(house=>house.id===mission.factionIds[0]);
    if(workReason&&sendingHouse&&factsWithDataValue(state,'missionWork',mission.id).some(fact=>fact.data.finished===true))
        landSuccessfulHouseWork(state,sendingHouse,workReason,members.map(member=>({id:member.id,name:member.name,
            ordinal:member.cultivation.realmOrdinal})),String(mission.data.destinationId),day);
    rewardMissionLeadership(state, mission, members, day);
    for (const member of members) {
        const at = state.npcs.findIndex(npc => npc.id === member.id);
        const current = state.npcs[at]!;
        const paid = mission.data.boardEntryId ? whatFinishingBoardWorkPays(current,
            { ...activity, untilDay: Number(mission.data.plannedReturnDay) },
            factsWithDataValue(state,'missionWork',mission.id).some(fact => fact.data.finished === true)) ?? current : current;
        const privateWork = typeof mission.data.privateWorkId === 'string'
            ? state.obligations.find(term => term.id === mission.data.privateWorkId && term.status === 'open') : null;
        state.npcs[at] = { ...setLocation(paid, homeId, day), activity: {
            kind: mission.data.boardEntryId || mission.data.privateSponsorId ? 'travelling' : 'out_with_a_party', note: `Returned from ${mission.data.reason}.`,
            withIds: members.filter(npc => npc.id !== member.id).map(npc => npc.id),
            sinceDay: mission.day, untilDay: day, returnTo: homeId,
            ...(mission.data.boardEntryId || mission.data.privateSponsorId ? { fromLocationId: homeId } : {}),
            privateWorkId: openPrivateWorkReference(state, current.activity),
            ...(privateWork ? { kind: 'their_own_business', privateWorkId: privateWork.id,
                sinceDay: day, untilDay: privateWork.dueOnDay } : {}) } };
    }
    for (const member of members) recordNpcActualArrival(state, state.npcs.find(row => row.id === member.id)!, member.activity!, day);
    serveMissionPrivateWork(state, mission, day);
    return false;
}

function serveMissionPrivateWork(state: WorldState, mission: HistoricalFact, day: number): void {
    const term = state.obligations.find(word => word.id === mission.data.privateWorkId && word.status === 'open');
    const offer = term && witnessIndexFor(state).byId.get(term.triggeringEventId ?? '');
    const terms = offer && privateWorkTerms(offer);
    if (!term || !offer || !terms) return;
    servePrivateWork(state, offer, term, terms, day);
    settlePrivateWork(state, day, undefined, new Set([term.holderId]));
}

/** The geography reader includes capitals whose catalog kind is a market town. */
export function capitalPlaces(state: WorldState): LocationRecord[] {
    return state.locations.filter(l => l.kind === 'settlement' && isBelowTheLid(l)
        && (l.tags.includes('city') || whatKindOfPlace(l.name) === 'provincial capital'));
}

const CALENDAR_DATES = new WeakMap<WorldState, { seed: string;
    years: Map<number, Map<string, { auction: number; contest: number | null }>> }>();
/** Only seeded dates are shared; the current venue and living host are still read. */
function occasionDates(state: WorldState, venue: LocationRecord, year: number,
    row: (typeof COMPETITION_CALENDARS)[number] | undefined) {
    let held = CALENDAR_DATES.get(state);
    if (!held || held.seed !== state.seed) {
        held = { seed: state.seed, years: new Map() }; CALENDAR_DATES.set(state, held);
    }
    let dates = held.years.get(year);
    if (!dates) {
        dates = new Map(); held.years.set(year, dates);
        if (held.years.size > 3) held.years.delete(held.years.keys().next().value!);
    }
    const key = JSON.stringify([venue.id, venue.name, row?.id, row?.everyYears]);
    let drawn = dates.get(key);
    if (!drawn) {
        drawn = { auction: year * DAYS_PER_YEAR + 100 + forStream(state.seed, 'capital-calendar', venue.id).int(0, 35),
            contest: theDayItFallsIn(state.seed, { id: row?.id ?? `open:${venue.id}`,
                name: venue.name, everyYears: row?.everyYears ?? 3 }, year) };
        dates.set(key, drawn);
    }
    return drawn;
}
/** The oath house witnesses every hammer, so a sale on its floor is sworn rather than shaken on. */
export const THE_AUCTION_HOUSE_ID = 'house-vermilion-seal';
/**
 * Like the Span's counters, a capital auction belongs to one Dao house. If the Terrace has
 * fallen, the oldest Dao house still standing takes the floor; with none left there is no auction.
 */
export function whoHoldsTheAuctions(state: Pick<WorldState, 'factions'>): FactionRecord | null {
    const standing = new Map(state.factions.filter(h => h.dissolvedOnDay === null && isBelowTheLid(h)).map(h => [h.id, h]));
    if (standing.has(THE_AUCTION_HOUSE_ID)) return standing.get(THE_AUCTION_HOUSE_ID)!;
    const heir = [...DAO_HOUSES].sort((a, b) => b.foundedYearsAgo - a.foundedYearsAgo || a.id.localeCompare(b.id))
        .find(house => standing.has(house.id));
    return heir ? standing.get(heir.id)! : null;
}
/** One auction a year, one inter-house board every three years, with seeded dates. */
export function capitalCalendar(state: WorldState, year: number): CapitalOccasion[] {
    const occasions: CapitalOccasion[] = [];
    const graph = routeQueriesFor(state.locations);
    const auctioneer = whoHoldsTheAuctions(state);
    for (const venue of capitalPlaces(state)) {
        const province = theProvinceAround(state.locations, venue.id, graph);
        const houses = state.factions.filter(h => h.dissolvedOnDay === null && isBelowTheLid(h));
        const host = houses.find(h => h.id === venue.controllingFactionId)
            ?? houses.filter(h => theProvinceAround(state.locations, h.seatLocationId, graph) === province)
                .sort((a, b) => Number(b.resources.power_ordinal ?? 0) - Number(a.resources.power_ordinal ?? 0)
                    || a.id.localeCompare(b.id))[0];
        const row = COMPETITION_CALENDARS.find(r => r.open && r.venueName === venue.name);
        const { auction: auctionDay, contest: contestDay } = occasionDates(state, venue, year, row);
        if (auctioneer) occasions.push({ venueId: venue.id, hostId: auctioneer.id, kind: 'auction',
            opensOnDay: auctionDay - 45, onDay: auctionDay, endsOnDay: auctionDay + 7 });
        if (host && contestDay !== null) {
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
    sendHouseMission(state, house, venue, party, reason, day, service, onDue, graph, routes);
}

function recordHouseProgress(state:WorldState,mission:HistoricalFact,members:NpcRecord[],venue:LocationRecord,day:number):void {
    const sending=state.factions.find(house=>house.id===mission.factionIds[0]);
    if(!sending)return;
    const carrying=state.objects.filter(object=>(isHeld(object)||isWorn(object))
        &&members.some(member=>member.id===object.possessorId));
    appendWorldFact(state,makeFact({day,kind:'gathering',visibility:'public',scale:'regional',locationId:venue.id,
        factionIds:[sending.id],causes:[mission.id],actors:members.map(member=>({id:member.id,name:member.name,role:'on the progress'})),
        summary:`${sending.name}'s party of ${members.length} reached ${venue.name} carrying ${carrying.length} objects.`,
        data:{houseProgress:true,houseBusiness:'progress',carriedObjectIds:carrying.map(object=>object.id).join(',')}}));
}

/** A closed-form road read records only intermediate ground already reached. */
function recordProgressAlongRoad(state:WorldState,person:NpcRecord,day:number,graph?:RouteQueries):void {
    const activity=person.activity,mission=activity?.capitalMissionId?witnessIndexFor(state).byId.get(activity.capitalMissionId):null;
    if(mission?.data.houseBusiness!=='progress'||activity?.kind!=='travelling'||!activity.fromLocationId
        ||!activity.returnTo||activity.untilDay==null||activity.seaLaneId)return;
    graph??=routeQueriesFor(state.locations);
    const road=walkingRouteFrom(state.locations,activity.fromLocationId,activity.returnTo,graph);
    if(!road||road.length<3)return;
    const members=state.npcs.filter(member=>member.status==='alive'&&member.activity?.capitalMissionId===mission.id
        &&member.activity.capitalMissionLeg===activity.capitalMissionLeg);
    const recorded=witnessIndexFor(state).references.get(mission.id)??[];
    const total=road.at(-1)!.days;
    for(const stop of road.slice(1,-1)){
        const reached=activity.sinceDay+(activity.untilDay-activity.sinceDay)*stop.days/total;
        if(reached>day||[...recorded].some(fact=>fact.data.houseProgress===true&&fact.locationId===stop.locationId&&fact.day===reached))continue;
        const venue=graph.places.get(stop.locationId);
        if(venue)recordHouseProgress(state,mission,members,venue,reached);
    }
}

function receiveMissionParty(state: WorldState, mission: HistoricalFact, members: NpcRecord[],
    venue: LocationRecord, day: number): void {
    const host = state.factions.find(house => house.id === mission.data.receivingHouseId);
    const sending = state.factions.find(house => house.id === mission.factionIds[0]);
    if (!host || !sending) return;
    if (mission.data.houseBusiness === 'tribute') {
        for (let at = 0; at < state.objects.length; at++) {
            const cargo = state.objects[at]!;
            if (cargo.data.missionId !== mission.id || !members.some(member => member.id === cargo.possessorId)
                || !cargo.tags.includes('consignment')) continue;
            const stones = Number(cargo.data.tributeStones ?? 0);
            host.resources.spirit_stones = Number(host.resources.spirit_stones ?? 0) + stones;
            const receipt = appendWorldFact(state, makeFact({ day, kind: 'grant_renewed', visibility: 'faction',
                locationId: venue.id, factionIds: [sending.id, host.id], causes: [mission.id],
                actors: [{ id: cargo.possessorId!, name: members.find(member => member.id === cargo.possessorId)!.name,
                    role: 'delivered' }], summary: `${host.name} received ${stones} tribute stones from ${sending.name}.`,
                data: { tributeReceived: true, cargoId: cargo.id } }), { recur: false });
            state.objects[at] = { ...transferPossession(cargo, { onDay: day, toHolderId: host.id,
                toHolderName: host.name, how: 'gifted', transfersOwnership: true, factId: receipt.id }),
                locationId: venue.id, tags: cargo.tags.filter(tag => tag !== 'consignment'),
                data: { ...cargo.data, tributeStones: 0 } };
        }
    }
    if (mission.data.houseBusiness === 'envoy' || mission.data.houseBusiness === 'progress') {
        const received = receiveHouseVisitors(state, host, sending, members, day, mission);
        if (mission.data.houseBusiness === 'progress') {
            if (received) for (const member of members) theirFaceMoves(state, member.id,
                whatBeingWatchedIsWorth(received.witnessIds.length), day);
        }
    }
}

function finishMissionWork(state: WorldState, mission: HistoricalFact, members: NpcRecord[], day: number): NpcRecord[] {
    if (mission.data.privateHunt === true) {
        const venue = state.locations.find(place => place.id === mission.data.destinationId);
        return venue ? finishPrivatePartyHunt(state, mission, members, venue, day) : members;
    }
    const privateVenture = mission.data.privateVenture === true;
    if (typeof mission.data.boardEntryId !== 'string' && !privateVenture) return members;
    const reason = privateVenture ? getSendingReason(String(mission.data.privateReasonId))
        : theReasonBehind(String(mission.data.boardEntryId));
    const house = privateVenture ? state.npcs.find(row => row.id === mission.data.privateSponsorId)
        : state.factions.find(row => row.id === mission.factionIds[0]);
    const venue = state.locations.find(place => place.id === mission.data.destinationId);
    if (!reason || !house || !venue) return members;
    if (privateVenture) {
        if (factsWithDataValue(state, 'privateVentureBlocked', mission.id).length) return members;
        const blocked = privateMissionObstacle(state, mission, members, venue, day);
        if (blocked) {
            recordPrivateMissionObstacle(state, mission, members, venue, day, blocked.reason);
            return members;
        }
    }
    const posting = postingFor({ reason, house, locationId: venue.id, pitchOrdinal: Number(mission.data.pitchOrdinal),
        hands: members.length });
    const result = resolveSending({ posting: { ...posting, days: Number(mission.data.dutyDays) },
        party: members.map(member => ({ id: member.id, name: member.name, ordinal: member.cultivation.realmOrdinal })),
        departsOnDay: day - Number(mission.data.dutyDays), location: venue,
        rng: forStream(state.seed, 'board-mission-work', mission.id) });
    appendWorldFact(state, makeFact({ day, kind: reason.factKind, visibility: privateVenture ? 'secret' : 'faction', locationId: venue.id,
        factionIds: privateVenture ? [] : [house.id], causes: [mission.id], actors: members.map(member => ({ id: member.id, name: member.name,
            role: result.lost.some(lost => lost.id === member.id) ? 'did not return from the work' : 'worked' })),
        summary: `${house.name}'s ${reason.name.toLowerCase()} ${result.outcome === 'finished' ? 'was completed' : 'was not completed'}.`,
        data: { missionWork: mission.id, finished: result.outcome === 'finished' } }), { recur: false });
    for (const lost of result.lost) {
        const at = state.npcs.findIndex(person => person.id === lost.id);
        state.npcs[at] = theWorldLoses(state.npcs[at]!, day, `Lost on ${reason.name.toLowerCase()}.`) ?? state.npcs[at]!;
    }
    const returned = members.filter(member => !result.lost.some(lost => lost.id === member.id));
    if (privateVenture && result.outcome === 'finished')
        collectPrivatePartyFinds(state, venue.id, returned, typeof mission.data.leaderId === 'string' ? mission.data.leaderId : null,
            day, mission.id, mission.data.privateElderExpedition === true);
    if (result.outcome === 'finished' && (mission.data.houseBusiness === 'experience' || privateVenture)) {
        const senior = returned.find(member => member.id === mission.data.leaderId);
        if (senior) for (const disciple of returned.filter(member => member.id !== senior.id)) {
            const at = state.npcs.findIndex(person => person.id === disciple.id);
            const person = state.npcs[at]!;
            const teachers = senior.cultivation.techniqueIds.flatMap(id => {
                const art = getTechnique(id);
                return art ? [{ subject: art.name, element: art.element, label: senior.name, id: senior.id }] : [];
            });
            const candidate = discoverableInsights({ id: person.id, spiritRoot: person.cultivation.spiritRoot,
                insights: person.cultivation.insights ?? [] }, { teachers, locationTags: venue.tags, runSeed: state.seed })
                .find(row => row.access.kind !== 'own_root' && !(person.cultivation.insights ?? [])
                    .some(held => held.domain === row.domain && held.subject === row.subject));
            const achievement = candidate ? recordAchievement({ kind: 'extraordinary_instruction', onDay: day, turn: 0,
                    summary: `${senior.name} led ${person.name} through ${reason.name.toLowerCase()} at ${venue.name}.`,
                    detail: { missionId: mission.id } }, forStream(state.seed, 'mission-instruction', mission.id, person.id)) : null;
            const learned = candidate && achievement ? integrateInsight(person.cultivation.insights ?? [], candidate, achievement) : null;
            state.npcs[at] = { ...withAttentionRecorded(person, senior.id, day), cultivation: {
                ...person.cultivation, ...(learned && achievement ? { insights: learned.insights,
                    achievements: [...person.cultivation.achievements ?? [], achievement] } : {}) } };
        }
    }
    return returned.map(member => state.npcs.find(person => person.id === member.id)!);
}

function privateMissionObstacle(state: WorldState, mission: HistoricalFact, members: NpcRecord[],
    venue: LocationRecord, day: number) {
    if (mission.data.privateVenture !== true) return null;
    const path = pathTo(state.locations, venue.id);
    for (const member of members) {
        const access = reachThrough(path, { realmOrdinal: member.cultivation.realmOrdinal, onDay: day,
            keyIds: theDoorKeysTheyActuallyCarry(state.objects, member.id) });
        if (access.stoppedAt !== null) return access;
    }
    return null;
}

function recordPrivateMissionObstacle(state: WorldState, mission: HistoricalFact, members: NpcRecord[],
    venue: LocationRecord, day: number, reason: string): void {
    appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: venue.id,
        causes: [mission.id], actors: members.map(person => ({ id: person.id, name: person.name, role: 'stopped' })),
        summary: `The private expedition could not enter ${venue.name}. ${reason}`,
        data: { privateVentureBlocked: mission.id, missionWork: mission.id, finished: false } }), { recur: false });
}

function rewardMissionLeadership(state: WorldState, mission: HistoricalFact, members: NpcRecord[], day: number): void {
    if (mission.data.houseBusiness !== 'experience') return;
    if (!factsWithDataValue(state,'missionWork',mission.id).some(fact => fact.data.finished === true)) return;
    const senior = members.find(member => member.id === mission.data.leaderId);
    const juniors = members.filter(member => member.id !== mission.data.leaderId);
    if (!senior || !juniors.length || !mission.factionIds[0]) return;
    const reward = whatLeadingDisciplesIsWorth(senior.cultivation.realmOrdinal, day - mission.day,
        juniors.filter(member => member.factionId === mission.factionIds[0]).length, juniors.length,
        Math.max(...juniors.map(member => lostChance(regardFor(Number(mission.data.pitchOrdinal), member.cultivation.realmOrdinal)))));
    const at = state.npcs.findIndex(person => person.id === senior.id);
    state.npcs[at] = creditMeritWith(state.npcs[at]!, mission.factionIds[0], reward.merit);
    theirFaceMoves(state, senior.id, reward.face, day);
}

export interface HouseBusinessAppointment {
    houseId: string;
    receivingId: string;
    purpose: 'envoy' | 'tribute' | 'progress';
    onDay: number;
}

/** Actual allies and grants supply dates; populous, powerful houses progress more often. */
export function houseBusinessCalendar(state: WorldState, year: number): HouseBusinessAppointment[] {
    const appointments: HouseBusinessAppointment[] = [];
    const rolls = new Map<string, number>();
    for (const person of state.npcs) if (person.status === 'alive' && person.factionId)
        rolls.set(person.factionId, (rolls.get(person.factionId) ?? 0) + 1);
    const add = (houseId: string, receivingId: string, purpose: HouseBusinessAppointment['purpose']) => {
        const phase = forStream(state.seed, 'house-business-calendar', houseId, receivingId, purpose).int(0, 364);
        appointments.push({ houseId, receivingId, purpose, onDay: year * DAYS_PER_YEAR + phase });
    };
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !house.seatLocationId || !isBelowTheLid(house)) continue;
        for (const ally of alliesOf(state, house)) if (ally.seatLocationId) add(house.id, ally.id, 'envoy');
        const patron = theBodyItAnswersTo(house.id);
        if (patron && Number(house.resources.tribute_owed_per_year ?? 0) > 0
            && state.factions.some(other => other.id === patron && other.dissolvedOnDay === null && other.seatLocationId))
            add(house.id, patron, 'tribute');
        const count = rolls.get(house.id) ?? 0;
        const power = Number(house.resources.power_ordinal ?? 0);
        const cadence = count >= 12 && power >= 35 ? 1 : count >= 6 && power >= 23 ? 3 : 5;
        const phase = forStream(state.seed, 'house-progress-calendar', house.id).int(0, cadence - 1);
        if (count < 4 || year % cadence !== phase) continue;
        const recipients = circleCandidatesFor(state, house).filter(other => other.seatLocationId);
        if (recipients.length) add(house.id,
            recipients[forStream(state.seed, 'house-progress-destination', house.id, year).int(0, recipients.length - 1)]!.id,
            'progress');
    }
    const exact = new Set(state.npcs.filter(person => isPlayerInvolved(state, person)).map(person => person.factionId));
    const selected = appointments.filter(appointment => exact.has(appointment.houseId));
    for (let quarter = 0; quarter < 4; quarter++) selected.push(...drawBackgroundIncidents(appointments
        .filter(appointment => !exact.has(appointment.houseId)
            && Math.min(3, Math.floor((appointment.onDay - year * DAYS_PER_YEAR) / 91)) === quarter)
        .map(value => ({ value, rate: 1 })), forStream(state.seed, 'background-house-business', year, quarter), 8));
    return selected.sort((a, b) => a.onDay - b.onDay || a.houseId.localeCompare(b.houseId));
}

/** A calendar appoints a purpose; living ties, available hands and real fares still decide. */
export function sendScheduledHouseBusiness(state: WorldState, appointment: HouseBusinessAppointment,
    onDue?: (memberId: string, day: number) => void): HistoricalFact | null {
    const house = state.factions.find(row => row.id === appointment.houseId && row.dissolvedOnDay === null);
    const receiving = state.factions.find(row => row.id === appointment.receivingId && row.dissolvedOnDay === null);
    if (!house || !receiving?.seatLocationId) return null;
    if (appointment.purpose === 'envoy' && !alliesOf(state, house).some(ally => ally.id === receiving.id)) return null;
    if (appointment.purpose === 'tribute' && theBodyItAnswersTo(house.id) !== receiving.id) return null;
    const graph = routeQueriesFor(state.locations);
    const venue = graph.places.get(receiving.seatLocationId);
    if (!venue) return null;
    const spare = spareFor(state, house, appointment.onDay, graph)
        .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal || a.id.localeCompare(b.id));
    const reason = getSendingReason(appointment.purpose === 'envoy' ? 'sending-to-be-received'
        : appointment.purpose === 'tribute' ? 'sending-to-carry-tribute' : 'sending-on-a-progress')!;
    const roll = state.npcs.filter(person => person.status === 'alive' && person.factionId === house.id).length;
    const count = appointment.purpose === 'progress' ? Math.min(reason.hands, Math.max(4, Math.floor(roll / 4)))
        : appointment.purpose === 'tribute' ? reason.hands : Math.min(2, reason.hands);
    const party = spare.slice(0, count);
    if (!party.length || appointment.purpose === 'progress' && party.length < 4) return null;
    const tribute = appointment.purpose === 'tribute'
        ? Math.max(0, Math.round(Number(house.resources.tribute_owed_per_year ?? 0) * 0.1)) : 0;
    const purse = Number(house.resources.spirit_stones ?? 0);
    if (tribute > purse) return null;
    // Reserved stones become a real cargo row only after the route is admitted.
    house.resources.spirit_stones = purse - tribute;
    const sent = sendHouseMission(state, house, venue, party, reason.name.toLowerCase(), appointment.onDay,
        { days: reason.days }, onDue, graph, undefined,
        { houseBusiness: appointment.purpose, receivingHouseId: receiving.id, sendingReasonId: reason.id });
    if (!sent) { house.resources.spirit_stones = purse; return null; }
    if (tribute > 0) state.objects.push(makeObject({ id: `tribute:${sent.id}`, name: '贡匣 Tribute Casket', kind: 'other',
        ownerId: house.id, ownerName: house.name, possessorId: party[0]!.id, locationId: null,
        tags: ['consignment', `house:${house.id}`, `delivery-to:${receiving.id}`],
        data: { missionId: sent.id, tributeStones: tribute, toHouseId: receiving.id } }));
    return sent;
}

/** Four background sending decisions per appointment; nearby houses stay exact. */
function housesForCapitalPass(state: WorldState, eligible: FactionRecord[], stream: string,
    ...parts: (string | number)[]): Set<string> {
    const exact = new Set(state.npcs.filter(person => isPlayerInvolved(state, person))
        .map(person => person.factionId));
    const background = eligible.filter(house => !exact.has(house.id));
    const selected = background.length <= 4 ? background : drawBackgroundIncidents(
        background.map(value => ({ value, rate: 1 })), forStream(state.seed, stream, ...parts), 4);
    return new Set([...eligible.filter(house => exact.has(house.id)), ...selected].map(house => house.id));
}

/** Four opportunities per house-year, one seeded dispatch draw each, no daily steps. */
export function sendCapitalBusiness(state: WorldState, year: number, quarter: number, day: number,
    onDue?: (memberId: string, day: number) => void): void {
    const cities = capitalPlaces(state);
    if (!cities.length) return;
    // One dated sending pass changes people and stores, not the roads they use.
    const graph = routeQueriesFor(state.locations);
    const routes = routesOnThisGraph(state, graph);
    const selected = housesForCapitalPass(state, state.factions.filter(house => house.dissolvedOnDay === null
        && house.seatLocationId && isBelowTheLid(house)
        && forStream(state.seed, 'capital-business', house.id, year, quarter).chance(0.35)),
        'background-capital-business', year, quarter);
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !house.seatLocationId || !isBelowTheLid(house)) continue;
        if (!selected.has(house.id)) continue;
        const rng = forStream(state.seed, 'capital-business', house.id, year, quarter);
        if (!rng.chance(0.35)) continue;
        const province = theProvinceAround(state.locations, house.seatLocationId, graph);
        const nearby = cities.filter(l => theProvinceAround(state.locations, l.id, graph) === province);
        const venues = nearby.length && rng.chance(0.8) ? nearby : cities;
        const venue = venues[rng.int(0, venues.length - 1)]!;
        const spare = spareFor(state, house, day,graph);
        if (!spare.length) continue;
        const reason = ['trade and purchases', 'carrying the house report', 'escorting the house envoy'][rng.int(0, 2)]!;
        const party = [...spare].sort((a, b) => forStream(state.seed, 'capital-business-hand', house.id,
            year, quarter, a.id).next() - forStream(state.seed, 'capital-business-hand', house.id,
            year, quarter, b.id).next()).slice(0, reason.startsWith('escorting') ? 2 : 1);
        const serviceDays = reason === 'trade and purchases' ? rng.int(7, 21)
            : reason === 'carrying the house report' ? rng.int(1, 3) : rng.int(3, 7);
        send(state, house, venue, party, reason, day, { days: serviceDays }, onDue, graph, routes);
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
    const routes = routesOnThisGraph(state, graph);
    const province = theProvinceAround(state.locations, venue.id, graph);
    const selected = housesForCapitalPass(state, state.factions.filter(house => house.dissolvedOnDay === null
        && house.seatLocationId && isBelowTheLid(house)
        && forStream(state.seed, 'capital-delegation', venue.id, occasion.kind, occasion.onDay, house.id)
            .chance(theProvinceAround(state.locations, house.seatLocationId, graph) === province ? 0.75 : 0.2)),
        'background-capital-delegation', venue.id, occasion.kind, occasion.onDay);
    // The house holding an auction always sends its witnesses; nobody else's hammer binds.
    const witnessing = occasion.kind === 'auction' ? host.id : null;
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !house.seatLocationId || !isBelowTheLid(house)) continue;
        if (!selected.has(house.id) && house.id !== witnessing) continue;
        const rng = forStream(state.seed, 'capital-delegation', venue.id, occasion.kind, occasion.onDay, house.id);
        const near = theProvinceAround(state.locations, house.seatLocationId, graph) === province;
        if (house.id !== witnessing && !rng.chance(near ? 0.75 : 0.2)) continue;
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
            house.id === witnessing ? 'witnessing the auction'
                : occasion.kind === 'auction' ? 'the auction delegation' : 'the inter-house competition',
            day, { untilDay: occasion.endsOnDay + 14, eventDay: occasion.onDay }, onDue, graph, routes);
    }
    appendWorldFact(state, makeFact({ day, kind: 'gathering', visibility: 'public', scale: 'regional',
        summary: occasion.kind === 'auction' ? `${host.name} holds an auction at ${venue.name} on day ${occasion.onDay}.`
            : `${venue.name} holds an inter-house competition on day ${occasion.onDay}.`,
        locationId: venue.id, factionIds: [host.id], magnitude: 0.4,
        actors: [],
        data: { capitalOccasion: true, hostId: host.id, occasionKind: occasion.kind, onDay: occasion.onDay, endsOnDay: occasion.endsOnDay } }));
}
