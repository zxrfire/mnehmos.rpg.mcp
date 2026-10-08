/**
 * One accepted air leg is read from its actual historical fact. A stop is another
 * caused fact at the actual stopped moment, never a copied point or a landing.
 * Consumers must distinguish an airborne point from an actual reached place.
 */
import type { HistoricalFact } from './history.js';
import type { LocationRecord } from './locations.js';
import type { MetricPoint } from '../../data/cultivation/regions/region-schema.js';
import { metricGroundRead, type MetricCourseContext } from './the-metric-ground-under-a-journey.js';
import type { AcceptedPassageMoment } from './passage-moment.js';

export interface AcceptedAirCourse {
    receiptId: string;
    bodyId: string;
    fromId: string;
    toId: string;
    conveyanceId: string;
    power: number | null;
    vesselId: string | null;
    artId: string | null;
    departureDay: number;
    arrivalDay: number;
    moment: AcceptedPassageMoment | null;
}

export type AirCoursePosition =
    | { kind: 'place'; locationId: string; point: MetricPoint; fraction: 0 | 1 }
    | { kind: 'air'; point: MetricPoint; layer: LocationRecord['layer']; fraction: number;
        courseId: string; stopped: boolean };

/** Unknown/malformed historical legs never become a physical source. */
export function acceptedAirCourse(fact: HistoricalFact, bodyId: string): AcceptedAirCourse | null {
    const d = fact.data;
    if (d.airCourse !== true || d.bodyId !== bodyId || typeof d.fromLocationId !== 'string'
        || typeof d.toLocationId !== 'string' || typeof d.conveyanceId !== 'string'
        || typeof d.departureDay !== 'number' || !Number.isFinite(d.departureDay)
        || typeof d.arrivalDay !== 'number' || !Number.isFinite(d.arrivalDay)
        || d.arrivalDay <= d.departureDay) return null;
    const worldClock = d.worldClockAirCourse === true && d.runId == null && d.boardingRunElapsedDays == null;
    if (!worldClock && (typeof d.runId !== 'string' || typeof d.boardingRunElapsedDays !== 'number'
        || !Number.isFinite(d.boardingRunElapsedDays))) return null;
    return { receiptId: fact.id, bodyId, fromId: d.fromLocationId, toId: d.toLocationId,
        conveyanceId: d.conveyanceId, power: typeof d.conveyancePower === 'number' ? d.conveyancePower : null,
        vesselId: typeof d.vesselId === 'string' ? d.vesselId : null,
        artId: typeof d.artId === 'string' ? d.artId : null,
        departureDay: d.departureDay, arrivalDay: d.arrivalDay,
        moment: typeof d.runId === 'string' && typeof d.boardingRunElapsedDays === 'number'
            ? { runId: d.runId, elapsedDays: d.boardingRunElapsedDays, boardedOnDay: d.departureDay } : null };
}

export function positionOnAcceptedAirCourse(locations: readonly LocationRecord[], course: AcceptedAirCourse,
    onDay: number, stopped?: HistoricalFact | null, courseContext?: MetricCourseContext): AirCoursePosition | null {
    if (!Number.isFinite(onDay)) return null;
    const read = metricGroundRead(locations, courseContext);
    const from = read.byId.get(course.fromId), to = read.byId.get(course.toId);
    const a = read.point(course.fromId), b = read.point(course.toId);
    if (!from || !to || from.layer !== to.layer || !a || !b) return null;
    const projected = interpolateAirCoursePoint(course, a, b, onDay, stopped);
    if (!projected) return null;
    const { fraction } = projected;
    if (fraction === 0) return { kind: 'place', locationId: from.id, point: a, fraction: 0 };
    if (fraction === 1) return { kind: 'place', locationId: to.id, point: b, fraction: 1 };
    return { kind: 'air', layer: from.layer, courseId: course.receiptId, stopped: !!stopped,
        fraction, point: projected.point };
}

/** One interpolation for all physical readers, including derived location geometry. */
export function interpolateAirCoursePoint(course: AcceptedAirCourse, a: MetricPoint, b: MetricPoint,
    onDay: number, stopped?: HistoricalFact | null): { fraction: number; point: MetricPoint } | null {
    if (!Number.isFinite(onDay)) return null;
    if (stopped && (stopped.data.airCourseStopped !== course.receiptId
        || stopped.data.bodyId !== course.bodyId || !stopped.causes.includes(course.receiptId)
        || stopped.day < course.departureDay || stopped.day > onDay)) return null;
    const actualDay = stopped?.day ?? onDay;
    const fraction = Math.max(0, Math.min(1,
        (actualDay - course.departureDay) / (course.arrivalDay - course.departureDay)));
    return { fraction, point: { xLi: a.xLi + (b.xLi - a.xLi) * fraction,
        yLi: a.yLi + (b.yLi - a.yLi) * fraction } };
}
