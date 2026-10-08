import { companyDuringPassage } from './company-during-a-passage.js';
import { positionOnRoad, type RoadPosition } from './road-course.js';
/**
 * A road has ground between its ends. These are ordinary locations on the
 * existing graph; their two links divide the original price, never add one.
 * The description is a position, not a new named town or a staffed inn.
 */
import { makeLocation, walkingDaysFrom, walkingRouteFrom, type LocationRecord, type RouteQueries } from './locations.js';
import type { NpcRecord } from './npc-state.js';
import { isOpenWater } from '../../data/cultivation/regions.js';
import { SEA_LANES } from '../../data/cultivation/what-each-house-makes-and-what-crosses-the-water.js';
import { getConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import { priceJourney, type Conveyance } from './what-a-conveyance-does-to-a-journey.js';
import type { Posting } from './who-goes-out-for-a-house-and-what-comes-back.js';
import { waterUnderSeaPassage } from './the-water-under-a-passage.js';
import type { SeaLane } from './what-a-sea-crossing-costs.js';
import { shipIdForLane } from './the-ship-on-a-lane.js';
import { activityOfAPublicPassage, publicShipLinesFrom, quotePublicPassage } from './public-shipping.js';
import { isTerminal } from '../cultivation/existence.js';

export const ROUTE_STOP = 'route-stop';

/** Only floating point residue may close a travel clock; a shorter body/world span cannot. */
export function journeyTimeHasReached(actual: number, asked: number): boolean {
    return actual >= asked || asked - actual <= Number.EPSILON * Math.max(1, Math.abs(actual), Math.abs(asked)) * 8;
}

/** A public lane only joins its actual landfalls, in either direction. */
export function publicSeaLaneBetween(locations: readonly LocationRecord[], fromId: string, toId: string, seed = 'public-board'): SeaLane | null {
    const from = locations.find(place => place.id === fromId)?.name;
    const to = locations.find(place => place.id === toId)?.name;
    if (!from || !to) return null;
    return publicShipLinesFrom({ locations, seed }, from, 0).find(line => line.to === to)?.lane ?? null;
}

/** A hull already booked for this departure has one passage duration. */
export function daysOfABookedPassage(npcs: readonly NpcRecord[], lane: SeaLane,
    fromId: string, toId: string, departureDay: number): number | null {
    const person = npcs.find(npc => npc.activity?.kind === 'travelling'
        && npc.activity.vesselId === shipIdForLane(lane) && npc.activity.seaLaneId === lane.id
        && npc.activity.fromLocationId === fromId && npc.activity.returnTo === toId
        && npc.activity.sinceDay === departureDay && npc.activity.untilDay != null);
    return person?.activity?.untilDay == null ? null : person.activity.untilDay - departureDay;
}

/** The ordinary planner books the existing board's affordable, open passage once. */
export function bookNpcPassageForRoute(state: { locations: readonly LocationRecord[]; npcs?: readonly NpcRecord[]; seed?: string },
    npc: NpcRecord, destinationId: string, day: number, purpose: string): NpcRecord | null {
    if (!npc.locationId) return null;
    const quote = quotePublicPassage(typeof state.seed === 'string'
        ? state as typeof state & { seed: string } : { ...state, seed: npc.id }, npc.locationId, destinationId, day);
    if (!quote || npc.spiritStones < quote.fareStones) return null;
    return startNpcPassage(state.locations, npc, { lane: quote.lane, destinationId, onDay: day,
        days: quote.days, fareStones: quote.fareStones, purpose });
}

/** A finite berth on the existing hull; the caller supplies its actual fare and weather duration. */
export function startNpcPassage(locations: readonly LocationRecord[], npc: NpcRecord, input: {
    lane: SeaLane; destinationId: string; onDay: number; days: number; fareStones: number; purpose: string;
}): NpcRecord | null {
    const from = locations.find(place => place.id === npc.locationId);
    const to = locations.find(place => place.id === input.destinationId);
    if (npc.status !== 'alive' || !from || !to || from.id === to.id
        || !Number.isFinite(input.days) || input.days <= 0 || !Number.isFinite(input.fareStones)
        || input.fareStones <= 0 || npc.spiritStones < input.fareStones) return null;
    if (publicSeaLaneBetween(locations, from.id, to.id)?.id !== input.lane.id) return null;
    return { ...npc, spiritStones: npc.spiritStones - input.fareStones,
        activity: companyDuringPassage(npc.activity, activityOfAPublicPassage({ lane: input.lane, vesselId: shipIdForLane(input.lane),
            fromId: from.id, toId: to.id, departureDay: input.onDay, arrivalDay: input.onDay + input.days },
            input.purpose), input.onDay), updatedOnDay: input.onDay };
}

export function isWater(place: LocationRecord): boolean {
    return (place.kind === 'region' && typeof place.data.catalogRegionId === 'string'
        && isOpenWater(place.data.catalogRegionId))
        || SEA_LANES.some(lane => lane.water?.toLowerCase() === place.name.toLowerCase());
}

/** Add intermediate ground to long land links, once, without changing their distance. */
export function addPlacesOnTheWay(locations: LocationRecord[]): void {
    const byId = new Map(locations.map(place => [place.id, place]));
    const roads = locations.flatMap(from => from.links.flatMap(link => {
        const to = byId.get(link.toLocationId);
        return to && (from.id < to.id || !to.links.some(back => back.toLocationId === from.id && back.kind === link.kind))
            && link.travelDays > 1
            && (link.kind === 'road' || link.kind === 'path')
            && !from.tags.includes(ROUTE_STOP) && !to.tags.includes(ROUTE_STOP)
            ? [{ from, to, link }] : [];
    }));
    for (const { from, to, link } of roads) {
        const id = `loc-route-${from.id}-${to.id}-${link.kind}`;
        if (byId.has(id)) continue;
        const region = from.kind === 'region' ? from : byId.get(from.parentId ?? '');
        // A water crossing keeps its sea-lane and hull machinery. A road stop
        // cannot make water walkable, even when a legacy map calls it a road.
        if ([from, to, region].some(place => place && isWater(place))) continue;
        const stop = makeLocation({
            id, name: `Between ${from.name} and ${to.name}`, kind: 'wilds',
            parentId: region?.id ?? null, layer: from.layer,
            description: `The ${link.kind} between ${from.name} and ${to.name}.`,
            ambient: region?.ambient ?? from.ambient,
            qiDensity: region?.qiDensity ?? from.qiDensity,
            hazards: [...(region?.hazards ?? [])],
            tags: [ROUTE_STOP],
            data: { fromLocationId: from.id, toLocationId: to.id }
        });
        const first = link.travelDays / 2;
        const other = to.links.find(back => back.toLocationId === from.id && back.kind === link.kind);
        from.links = from.links.filter(one => one !== link);
        to.links = to.links.filter(one => one !== other);
        from.links.push({ ...link, toLocationId: id, travelDays: first });
        stop.links.push({ ...link, toLocationId: to.id, travelDays: link.travelDays - first });
        if (other) {
            const backFirst = other.travelDays / 2;
            to.links.push({ ...other, toLocationId: id, travelDays: backFirst });
            stop.links.push({ ...other, toLocationId: from.id, travelDays: other.travelDays - backFirst });
        }
        locations.push(stop);
        byId.set(id, stop);
    }
}

/** Historic departure and the activity's destination/date are the only journey state. */
export function locationOnNpcJourney(
    locations: readonly LocationRecord[], npc: NpcRecord, day: number, routes?: RouteQueries,
    capture?: (position: RoadPosition) => void
): string | null {
    if (!capture) return projectNpcJourney(locations, npc, day, routes);
    let captured = false;
    const location = projectNpcJourney(locations, npc, day, routes, point => {
        captured = true; capture(point);
    });
    if (!captured && location) capture({ kind: 'place', locationId: location, originLocationId: location });
    return location;
}

/** Exact geometry comes from the same capability-guarded route read as physical ground. */
export function roadPositionOfNpc(locations: readonly LocationRecord[], npc: NpcRecord,
    day: number, routes?: RouteQueries): RoadPosition | null {
    // A carried party with no admitted route has only a coarse marker here.
    // Its actual leader position must be supplied by the adapter that owns it.
    if (npc.activity?.kind === 'out_with_a_party' && npc.activity.fromLocationId == null
        && npc.activity.withIds.length > 0) return null;
    let position: RoadPosition | null = null;
    locationOnNpcJourney(locations, npc, day, routes, point => { position = point; });
    return position;
}

function projectNpcJourney(
    locations: readonly LocationRecord[], npc: NpcRecord, day: number, routes?: RouteQueries,
    capture?: (position: RoadPosition) => void
): string | null {
    if (isTerminal(npc.status)) return npc.locationId;
    const activity = npc.activity;
    // An admitted air leg has an ordinary physical site whose metric point is
    // derived from its course fact and current clock. Its duty term is not a
    // road duration; the world boundary settles actual arrival separately.
    if (activity?.airCourseLocationId === npc.locationId
        && locations.some(place => place.id === npc.locationId && place.tags.includes('air-course')))
        return npc.locationId;
    if (activity?.kind === 'stationed' && activity.fromLocationId != null) {
        const passage = passageToAPost(locations, npc, routes);
        if (!passage) return activity.fromLocationId;
        return positionOnHeldRoute(passage.route, passage.places, day - activity.sinceDay,
            passage.days, passage.craft?.crossesGroundThatCannotBeWalked, capture);
    }
    if (activity?.kind === 'out_with_a_party' && activity.fromLocationId != null
        && activity.untilDay != null && npc.locationId != null) {
        const from = activity.fromLocationId;
        const to = npc.locationId;
        const home = activity.returnTo ?? from;
        const craft = activity.conveyanceId ? getConveyance(activity.conveyanceId) : undefined;
        const outward = walkingRouteFrom(locations, from, to, routes);
        const returning = walkingRouteFrom(locations, to, home, routes);
        if (!outward || !returning) return from;
        const places = (routes?.locations === locations ? routes.places : new Map(locations.map(place => [place.id, place])));
        if ((waterOnHeldRoute(outward, places) || waterOnHeldRoute(returning, places))
            && !craft?.crossesGroundThatCannotBeWalked) return from;
        if (journeyTimeHasReached(day, activity.untilDay)) return home;
        const heads = new Set([npc.id, ...activity.withIds]).size;
        const out = daysOnHeldRoute(outward, craft, activity.conveyancePower, heads);
        const back = daysOnHeldRoute(returning, craft, activity.conveyancePower, heads);
        if (!journeyTimeHasReached(day, activity.sinceDay + out)) return positionOnHeldRoute(outward, places, day - activity.sinceDay, out,
            craft?.crossesGroundThatCannotBeWalked, capture);
        if (journeyTimeHasReached(day, activity.untilDay - back)) return positionOnHeldRoute(returning, places, day - (activity.untilDay - back), back,
            craft?.crossesGroundThatCannotBeWalked, capture);
        return to;
    }
    if (activity?.kind !== 'travelling' || activity.untilDay == null || !activity.returnTo) return npc.locationId;
    const from = activity.fromLocationId ?? npc.locationId;
    if (from === null || day <= activity.sinceDay) return from;
    if (activity.vesselId && activity.seaLaneId) {
        if (journeyTimeHasReached(day, activity.untilDay)) return activity.returnTo;
        const lane = SEA_LANES.find(one => one.id === activity.seaLaneId);
        const departure = locations.find(place => place.id === from);
        const bound = locations.find(place => place.id === activity.returnTo);
        if (!departure || !bound) return from;
        const water = waterUnderSeaPassage({ from: departure.name, bound: bound.name, lane,
            sailed: day - activity.sinceDay });
        return locations.find(place => place.name.toLowerCase() === water?.toLowerCase())?.id ?? from;
    }
    const craft = activity.conveyanceId ? getConveyance(activity.conveyanceId) : undefined;
    const route = walkingRouteFrom(locations, from, activity.returnTo, routes);
    if (!route) return from;
    const places = (routes?.locations === locations ? routes.places : new Map(locations.map(place => [place.id, place])));
    if (waterOnHeldRoute(route, places) && !craft?.crossesGroundThatCannotBeWalked) return from;
    if (journeyTimeHasReached(day, activity.untilDay)) return activity.returnTo;
    return positionOnHeldRoute(route, places, day - activity.sinceDay,
        activity.untilDay - activity.sinceDay, craft?.crossesGroundThatCannotBeWalked, capture, activity.sinceDay);
}

/** Water on the actual existing route requires a hull or an art that can cross it. */
export function journeyNeedsWater(locations: readonly LocationRecord[], from: string, to: string, routes?: RouteQueries): boolean {
    const route = walkingRouteFrom(locations, from, to, routes);
    return route ? waterOnHeldRoute(route, (routes?.locations === locations ? routes.places : new Map(locations.map(place => [place.id, place])))) : false;
}

type HeldRoute = NonNullable<ReturnType<typeof walkingRouteFrom>>;

/** A live posting has one initial passage. Its term never starts a return trip. */
function passageToAPost(locations: readonly LocationRecord[], npc: NpcRecord, routes?: RouteQueries) {
    const doing = npc.activity;
    if (doing?.kind !== 'stationed' || doing.fromLocationId == null || npc.locationId == null) return null;
    const route = walkingRouteFrom(locations, doing.fromLocationId, npc.locationId, routes);
    if (!route) return null;
    const places = (routes?.locations === locations ? routes.places : new Map(locations.map(place => [place.id, place])));
    const craft = doing.conveyanceId ? getConveyance(doing.conveyanceId) : undefined;
    if (waterOnHeldRoute(route, places) && !craft?.crossesGroundThatCannotBeWalked) return null;
    return { route, places, craft, days: daysOnHeldRoute(route, craft, doing.conveyancePower) };
}

function waterOnHeldRoute(route: HeldRoute, places: ReadonlyMap<string, LocationRecord>): boolean {
    return route.some(stop => {
        const place = places.get(stop.locationId);
        return place !== undefined && isWater(place);
    });
}

function daysOnHeldRoute(route: HeldRoute, craft?: Conveyance | null, power?: number | null, heads = 1): number {
    const walking = route.at(-1)?.days ?? 0;
    if (walking === 0) return 0;
    return craft ? priceJourney({ walkingDays: walking, conveyance: craft, power, heads }).daysForEverybody
        : Math.max(1, Math.ceil(walking));
}

export function locationOnRoute(locations: readonly LocationRecord[], from: string, to: string,
    elapsed: number, days: number, overWater = false): string {
    if (elapsed <= 0) return from;
    if (journeyTimeHasReached(elapsed, days)) return to;
    const route = walkingRouteFrom(locations, from, to);
    if (!route || route.length < 2) return from;
    return positionOnHeldRoute(route, new Map(locations.map(place => [place.id, place])), elapsed, days, overWater);
}

function positionOnHeldRoute(route: HeldRoute, places: ReadonlyMap<string, LocationRecord>,
    elapsed: number, days: number, overWater = false, capture?: (position: RoadPosition) => void, departureDay = 0): string {
    const from = route[0]!.locationId;
    if (capture) capture(positionOnRoad(route, journeyTimeHasReached(elapsed, days)
        ? route.at(-1)!.days : days > 0 ? route.at(-1)!.days * Math.max(0, elapsed) / days : 0));
    if (elapsed <= 0) return from;
    if (journeyTimeHasReached(elapsed, days)) return route.at(-1)!.locationId;
    const walked = route.at(-1)!.days * elapsed / days;
    // Clock subtraction can differ by machine residue at an exact vertex.
    // Use the same canonical equality as the captured RoadPosition above.
    // For dated NPC legs, compare their original absolute clock, where the
    // scheduler admitted this vertex; subtracting a large world origin first
    // would magnify residue relative to the small edge duration.
    const moment = departureDay + elapsed;
    const vertex = route.find(stop => {
        const due = departureDay + days * stop.days / route.at(-1)!.days;
        return journeyTimeHasReached(moment, due) && journeyTimeHasReached(due, moment);
    });
    if (vertex) {
        capture?.({ originLocationId: from, kind: 'place', locationId: vertex.locationId });
        return vertex.locationId;
    }
    const after = route.findIndex(stop => stop.days > walked);
    const at = after < 0 ? route.length - 1 : Math.max(0, after - 1);
    const prior = route[at];
    const next = route[at + 1];
    // A route stop is the corridor ground adjoining both split edges. A body
    // already walking that edge is out of town even before its midpoint.
    const nextPlace = next && places.get(next.locationId);
    if (next && nextPlace && (nextPlace.tags.includes(ROUTE_STOP) || (overWater && isWater(nextPlace)))) {
        return next.locationId;
    }
    return prior?.locationId ?? from;
}

/** A real geographic route priced by the craft selected for it. */
export function physicalJourneyDays(locations: readonly LocationRecord[], from: string | null,
    to: string | null, craft?: Conveyance | null, power?: number | null, heads = 1, routes?: RouteQueries): number {
    if (from === to) return 0;
    const walking = from && to ? (routes?.locations === locations
        ? routes.treeFrom(from).days.get(to) : walkingDaysFrom(locations, from).get(to)) ?? 1 : 1;
    return craft ? priceJourney({ walkingDays: walking, conveyance: craft, power, heads }).daysForEverybody
        : Math.max(1, Math.ceil(walking));
}

/** Reason.days is the entire away term; physical travel must fit inside it. */
export function aPostingThatCanReachItsGround(posting: Posting, locations: readonly LocationRecord[],
    from: string | null, to: string | null, craft?: Conveyance | null, power?: number | null): Posting {
    const walking = from && to ? walkingDaysFrom(locations, from).get(to) ?? 1 : 1;
    const quote = craft ? priceJourney({ walkingDays: walking, conveyance: craft,
        power, heads: posting.hands }) : null;
    const journey = quote?.daysForEverybody ?? physicalJourneyDays(locations, from, to);
    return { ...posting, days: Math.max(posting.days, 2 * journey),
        // The service term does not keep a parked hull under way. Both real
        // passages draw the same existing head/capacity/fuel quote.
        stonesBurned: quote ? 2 * quote.stonesBurned : 0 };
}

/** Whether the body is between its ends today, including an ordinary party's return leg. */
export function npcIsTravellingOnDay(locations: readonly LocationRecord[], npc: NpcRecord, day: number, routes?: RouteQueries): boolean {
    const doing = npc.activity;
    if (isTerminal(npc.status)) return false;
    if (doing?.kind === 'stationed') {
        const passage = passageToAPost(locations, npc, routes);
        return passage != null && day >= doing.sinceDay
            && !journeyTimeHasReached(day, doing.sinceDay + passage.days);
    }
    if (!doing || doing.untilDay == null || day < doing.sinceDay || journeyTimeHasReached(day, doing.untilDay)) return false;
    if (doing.kind === 'travelling') return true;
    if (doing.kind !== 'out_with_a_party' || doing.fromLocationId == null) return false;
    const craft = doing.conveyanceId ? getConveyance(doing.conveyanceId) : undefined;
    const heads = new Set([npc.id, ...doing.withIds]).size;
    const out = physicalJourneyDays(locations, doing.fromLocationId, npc.locationId, craft, doing.conveyancePower, heads, routes);
    const back = physicalJourneyDays(locations, npc.locationId, doing.returnTo ?? doing.fromLocationId, craft, doing.conveyancePower, heads, routes);
    return !journeyTimeHasReached(day, doing.sinceDay + out) || journeyTimeHasReached(day, doing.untilDay - back);
}

/** The current leg, for a traveller who can say where they set out and are bound. */
export function npcJourneyOnDay(locations: readonly LocationRecord[], npc: NpcRecord, day: number, routes?: RouteQueries): {
    from: string; to: string; sinceDay: number; untilDay: number;
} | null {
    if (!npcIsTravellingOnDay(locations, npc, day, routes)) return null;
    const doing = npc.activity!;
    const from = doing.fromLocationId ?? npc.locationId;
    if (doing.kind === 'stationed' && from && npc.locationId) {
        const passage = passageToAPost(locations, npc, routes)!;
        return { from, to: npc.locationId, sinceDay: doing.sinceDay, untilDay: doing.sinceDay + passage.days };
    }
    if (!from || !doing.returnTo || doing.untilDay == null) return null;
    if (doing.kind === 'travelling') return { from, to: doing.returnTo,
        sinceDay: doing.sinceDay, untilDay: doing.untilDay };
    if (!npc.locationId) return null;
    const craft = doing.conveyanceId ? getConveyance(doing.conveyanceId) : undefined;
    const heads = new Set([npc.id, ...doing.withIds]).size;
    const back = physicalJourneyDays(locations, npc.locationId, doing.returnTo, craft, doing.conveyancePower, heads, routes);
    return journeyTimeHasReached(day, doing.untilDay - back)
        ? { from: npc.locationId, to: doing.returnTo, sinceDay: doing.untilDay - back, untilDay: doing.untilDay }
        : { from, to: npc.locationId, sinceDay: doing.sinceDay,
            untilDay: doing.sinceDay + physicalJourneyDays(locations, from, npc.locationId, craft, doing.conveyancePower, heads, routes) };
}

/** An actual overlapping journey, including its real person and the ground under both. */
export function firstTravellerOnTheWay(input: {
    locations: readonly LocationRecord[]; npcs: readonly NpcRecord[];
    fromId: string; toId: string; onDay: number; days: number;
    exceptIds?: ReadonlySet<string>;
    /** Already priced canonical endpoint course, including an admitted partial edge. */
    route?: NonNullable<ReturnType<typeof walkingRouteFrom>>;
    /** A flying craft can share the ordinary water beneath its route. */
    overWater?: boolean;
}): { npc: NpcRecord; place: LocationRecord; afterDays: number } | null {
    if (input.days <= 0) return null;
    const route = input.route ?? walkingRouteFrom(input.locations, input.fromId, input.toId);
    if (!route) return null;
    const total = route.at(-1)!.days;
    if (total <= 0) return null;
    const byId = new Map(input.locations.map(place => [place.id, place]));
    // These are intervals on two routes, not independent encounter rolls.
    // Each candidate is considered at the moment the player reaches that ground.
    for (const stop of route) {
        const place = byId.get(stop.locationId);
        if (!place || (!place.tags.includes(ROUTE_STOP) && !(input.overWater && isWater(place)))
            || place.id === input.fromId) continue;
        const afterDays = Math.max(1, Math.ceil(input.days * stop.days / total));
        if (afterDays >= input.days) continue;
        const day = input.onDay + afterDays;
        const npc = input.npcs.find(person => person.status === 'alive'
            && !input.exceptIds?.has(person.id) && npcIsTravellingOnDay(input.locations, person, day)
            && locationOnNpcJourney(input.locations, person, day) === place.id
            && npcCrossesThisRouteSite(input.locations, person, place.id, day));
        if (npc) return { npc, place, afterDays };
    }
    return null;
}

/** Sharing a long corridor does not mean two bodies crossed at its same site. */
function npcCrossesThisRouteSite(locations: readonly LocationRecord[], npc: NpcRecord,
    placeId: string, day: number): boolean {
    const leg = npcJourneyOnDay(locations, npc, day);
    if (!leg) return false;
    const route = walkingRouteFrom(locations, leg.from, leg.to);
    const site = route?.find(stop => stop.locationId === placeId);
    const total = route?.at(-1)?.days;
    if (!site || !total) return false;
    const crossedOn = leg.sinceDay + (leg.untilDay - leg.sinceDay) * site.days / total;
    return journeyTimeHasReached(day, crossedOn) && journeyTimeHasReached(crossedOn, day);
}

/** Ground reached before a road is interrupted, scaled to the actual conveyance's days. */
export function placePartwayAlong(locations: readonly LocationRecord[], fromId: string, toId: string,
    spent: number, total: number, overWater = false): LocationRecord | null {
    if (total <= 0 || spent <= 0) return null;
    const id = locationOnRoute(locations, fromId, toId, spent, total, overWater);
    const place = locations.find(one => one.id === id);
    if (place && (place.tags.includes(ROUTE_STOP) || (overWater && isWater(place)))) return place;
    return null;
}

/** A real fellow passenger sharing the existing hull and passage clock. */
export function firstTravellerOnTheWater(input: {
    locations: readonly LocationRecord[]; npcs: readonly NpcRecord[];
    waterId: string; vesselId: string; onDay: number; days: number; exceptIds?: ReadonlySet<string>;
}): { npc: NpcRecord; afterDays: number } | null {
    for (let afterDays = 1; afterDays < input.days; afterDays++) {
        const day = input.onDay + afterDays;
        const npc = input.npcs.find(person => person.status === 'alive'
            && !input.exceptIds?.has(person.id) && person.activity?.vesselId === input.vesselId
            && npcIsTravellingOnDay(input.locations, person, day)
            && locationOnNpcJourney(input.locations, person, day) === input.waterId);
        if (npc) return { npc, afterDays };
    }
    return null;
}
