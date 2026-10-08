import { journeyTimeHasReached, ROUTE_STOP } from './places-on-the-way.js';
/** A stopped road cursor is the sole partial physical position. The original
 * admitted edge cost is historical: closing a road later does not erase the
 * part already entered. Reversal admits the actual directed reverse edge now.
 * No path solver lives here; endpoint routes ask walkingRouteFrom.
 */
import { walkingRouteFrom, walkingStepDays, type LocationRecord } from './locations.js';
type Route = NonNullable<ReturnType<typeof walkingRouteFrom>>;
export type RoadPosition = { originLocationId: string } & (
    { kind: 'place'; locationId: string }
    | { kind: 'edge'; fromId: string; toId: string; fraction: number; admittedDays: number });
export interface RoadContinuation {
    readonly position: RoadPosition;
    readonly endpointId: string;
    readonly partialDays: number;
    readonly route: Route;
    readonly days: number;
}
/** Capture actual progress on the accepted priced route; never from its coarse
 * displayed corridor name. Legacy cursors with no origin are not guessed.
 */
export function positionOnRoad(route: Route, walked: number, originLocationId = route[0]!.locationId): RoadPosition {
    const last = route.at(-1)!;
    if (walked <= 0) return { originLocationId, kind: 'place', locationId: route[0]!.locationId };
    if (journeyTimeHasReached(walked, last.days)) return { originLocationId, kind: 'place', locationId: last.locationId };
    const next = route.findIndex(stop => stop.days >= walked);
    const b = route[next]!, a = route[next - 1]!;
    if (journeyTimeHasReached(b.days, walked) && journeyTimeHasReached(walked, b.days)) return { originLocationId, kind: 'place', locationId: b.locationId };
    return { originLocationId, kind: 'edge', fromId: a.locationId, toId: b.locationId,
        fraction: (walked - a.days) / (b.days - a.days), admittedDays: b.days - a.days };
}
/** Both legal endpoints are priced from the actual edge fraction. Equal quotes
 * prefer continuing the admitted direction. A shortest detour cannot reverse
 * the edge; it is available only after physically reaching a legal endpoint.
 */
export function roadContinuationTo(locations: readonly LocationRecord[], position: RoadPosition,
    targetId: string, allowReverse = true): RoadContinuation | null {
    const quote = (endpointId: string, partialDays: number, admitted = position): RoadContinuation | null => {
        const route = walkingRouteFrom(locations, endpointId, targetId);
        return route ? { position: admitted, endpointId, partialDays, route, days: partialDays + route.at(-1)!.days } : null;
    };
    if (position.kind === 'place') return quote(position.locationId, 0);
    if (!(position.fraction > 0 && position.fraction < 1 && position.admittedDays > 0)) return null;
    const ahead = quote(position.toId, (1 - position.fraction) * position.admittedDays);
    if (!allowReverse) return ahead;
    const reverseCost = walkingStepDays(locations, position.toId, position.fromId);
    const back = reverseCost === null ? null : quote(position.fromId, position.fraction * reverseCost,
        { ...position, fromId: position.toId, toId: position.fromId,
            fraction: 1 - position.fraction, admittedDays: reverseCost });
    return !ahead ? back : !back || ahead.days <= back.days ? ahead : back;
}
/** The next stopped cursor comes from the chosen actual course, including
 * turning back within the same edge. Reaching an endpoint is a physical fact;
 * before that, its room/company must not be granted by coarse ground display.
 */
export function positionAfterRoadContinuation(course: RoadContinuation, walked: number, departureDay?: number): RoadPosition {
    const start = course.position;
    if (walked <= 0) return start;
    // An exact scheduled vertex uses the accepted absolute clock before its
    // origin is subtracted. This changes no clock/body span or admitted edge.
    if (departureDay !== undefined) {
        const dates = roadVertexMoments(course.route, departureDay, course.days, course.partialDays);
        const at = dates.findIndex(day => journeyTimeHasReached(departureDay + walked, day)
            && journeyTimeHasReached(day, departureDay + walked));
        const reached = course.route.filter(stop => course.partialDays + stop.days > 0)[at];
        if (reached) return { originLocationId: start.originLocationId, kind: 'place', locationId: reached.locationId };
    }
    if (start.kind === 'edge' && !journeyTimeHasReached(walked, course.partialDays)) {
        const portion = walked / course.partialDays;
        return { ...start, fraction: course.endpointId === start.toId
            ? start.fraction + (1 - start.fraction) * portion : start.fraction * (1 - portion) };
    }
    return positionOnRoad(course.route, Math.max(0, walked - course.partialDays), start.originLocationId);
}

/** A continuation of the same accepted direction does not choose a reversal. */
export function roadContinuationAhead(locations: readonly LocationRecord[], position: RoadPosition,
    targetId: string): RoadContinuation | null {
    return roadContinuationTo(locations, position, targetId, false);
}

/** The physical fraction is compared after orienting the same actual edge. */
export function sameRoadPosition(a: RoadPosition | null, b: RoadPosition | null): boolean {
    if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === 'place' && b.kind === 'place') return a.locationId === b.locationId;
    if (a.kind !== 'edge' || b.kind !== 'edge') return false;
    const fraction = a.fromId === b.fromId && a.toId === b.toId ? b.fraction
        : a.fromId === b.toId && a.toId === b.fromId ? 1 - b.fraction : null;
    return fraction !== null && journeyTimeHasReached(a.fraction, fraction)
        && journeyTimeHasReached(fraction, a.fraction);
}

/** Exact reached-vertex moments on an already admitted ground course.
 * The existing route supplies ordering/distance; this is only its clock
 * projection. A partial initial edge reaches route[0] after initialDays.
 * Callers supply these transient moments to the existing boundary scheduler,
 * never as additional encounter checks or a second stored position.
 */
export function roadVertexMoments(route: Route, departureDay: number, travelDays: number, initialDays = 0): number[] {
    const total = route.at(-1)?.days ?? 0;
    if (!(travelDays > 0) || !(initialDays >= 0 && initialDays <= travelDays)) return [];
    return route.map(stop => departureDay + initialDays
        + (total > 0 ? (travelDays - initialDays) * stop.days / total : 0))
        .filter(day => day > departureDay);
}

/** One admitted changing ground course held by its actual operator activity.
 * Passenger activities refer to the operator, never copy this geometry. */
export interface AdmittedRoadCourse {
    position: RoadPosition;
    route: RoadContinuation['route'];
    initialTravelDays: number;
}
export function continuationOfAdmittedRoad(held:AdmittedRoadCourse):RoadContinuation {
    const partialDays=held.position.kind==='edge'?(1-held.position.fraction)*held.position.admittedDays:0;
    return {position:held.position,endpointId:held.route[0]!.locationId,partialDays,route:held.route,
        days:partialDays+(held.route.at(-1)?.days??0)};
}
export function positionOnAdmittedRoad(held:AdmittedRoadCourse,elapsed:number,travelDays:number):RoadPosition {
    const course=continuationOfAdmittedRoad(held),partial=held.initialTravelDays;
    const walking=elapsed<=partial&&partial>0?course.partialDays*Math.max(0,elapsed)/partial
        :course.partialDays+(held.route.at(-1)?.days??0)*Math.max(0,elapsed-partial)/Math.max(Number.MIN_VALUE,travelDays-partial);
    return positionAfterRoadContinuation(course,walking);
}
/** Existing foot display read, shared without granting either endpoint access. */
export function groundAtRoadPosition(locations:readonly LocationRecord[],point:RoadPosition):string {
    return point.kind==='place'?point.locationId:locations.find(row=>row.id===point.toId)?.tags.includes(ROUTE_STOP)
        ?point.toId:point.fromId;
}
