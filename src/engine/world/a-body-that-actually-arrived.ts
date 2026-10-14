/** Immutable physical arrival history; current membership and booking are not arrival. */
import type { HistoricalFact } from './history.js';
import { makeFact } from './history.js';
import type { NpcActivity, NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { factsWithDataValue, witnessIndexFor } from './witness-reaction-index.js';
import { journeyTimeHasReached } from './places-on-the-way.js';
import { spreadPlagueAfterArrival } from './plague-in-a-place.js';

/** Snapshot of the actual accepted finite leg, not another current course. */
export interface ActualArrivalCourse {
    fromLocationId: string;
    toLocationId: string;
    departureDay: number;
    arrivalDay: number;
    vesselId?: string;
    seaLaneId?: string;
    conveyanceId?: string;
}
export interface ActualArrivalBody { id: string; name: string; alive: boolean; locationId: string | null }

function finiteCourse(course: ActualArrivalCourse): boolean {
    return course.fromLocationId.length > 0 && course.toLocationId.length > 0
        && course.fromLocationId !== course.toLocationId && Number.isFinite(course.departureDay)
        && Number.isFinite(course.arrivalDay) && course.arrivalDay > course.departureDay;
}

/** Read the original leg before its activity is restored or replaced. */
export function arrivalCourseOfActivity(activity: NpcActivity | null | undefined): ActualArrivalCourse | null {
    if (activity?.kind !== 'travelling' || !activity.fromLocationId || !activity.returnTo || activity.untilDay == null) return null;
    const course = { fromLocationId: activity.fromLocationId, toLocationId: activity.returnTo,
        departureDay: activity.sinceDay, arrivalDay: activity.untilDay,
        ...(activity.vesselId ? { vesselId: activity.vesselId } : {}),
        ...(activity.seaLaneId ? { seaLaneId: activity.seaLaneId } : {}),
        ...(activity.conveyanceId ? { conveyanceId: activity.conveyanceId } : {}) };
    return finiteCourse(course) ? course : null;
}

/** Historical accepted course or actual-arrival fact, never a passenger roster. */
export function arrivalCourseOfFact(fact: HistoricalFact): ActualArrivalCourse | null {
    const data = fact.data;
    if (data.publicPassage !== true && data.ownedPassage !== true && data.actualBodyArrival !== true
        && typeof data.followingPartyFootCourse !== 'string') return null;
    if (typeof data.fromLocationId !== 'string' || typeof data.toLocationId !== 'string'
        || typeof data.departureDay !== 'number' || typeof data.arrivalDay !== 'number') return null;
    const course = { fromLocationId: data.fromLocationId, toLocationId: data.toLocationId,
        departureDay: data.departureDay, arrivalDay: data.arrivalDay,
        ...(typeof data.vesselId === 'string' ? { vesselId: data.vesselId } : {}),
        ...(typeof data.seaLaneId === 'string' ? { seaLaneId: data.seaLaneId } : {}),
        ...(typeof data.conveyanceId === 'string' ? { conveyanceId: data.conveyanceId } : {}) };
    return finiteCourse(course) ? course : null;
}

/** Separate tickets can carry bodies on the same exact physical course. */
export function sameActualArrivalCourse(a: ActualArrivalCourse, b: ActualArrivalCourse): boolean {
    return a.fromLocationId === b.fromLocationId && a.toLocationId === b.toLocationId
        && a.departureDay === b.departureDay && a.arrivalDay === b.arrivalDay
        && a.vesselId === b.vesselId && a.seaLaneId === b.seaLaneId && a.conveyanceId === b.conveyanceId;
}

export function recordActualBodyArrival(world: WorldState, body: ActualArrivalBody,
    course: ActualArrivalCourse | null, onDay: number, cause?: HistoricalFact): HistoricalFact | null {
    if (!body.alive || !course || !finiteCourse(course) || !Number.isFinite(onDay)
        || !journeyTimeHasReached(onDay, course.arrivalDay) || body.locationId !== course.toLocationId
        || !world.locations.some(place => place.id === course.toLocationId)) return null;
    if (cause) {
        const accepted = arrivalCourseOfFact(cause);
        if (!accepted || cause.data.actualBodyArrival === true || !sameActualArrivalCourse(course, accepted)) return null;
    }
    const prior = factsWithDataValue(world, 'bodyId', body.id).find(fact => {
        const arrived = arrivalCourseOfFact(fact);
        return fact.data.actualBodyArrival === true && arrived && sameActualArrivalCourse(course, arrived)
            && (cause ? fact.causes.includes(cause.id) : fact.causes.length === 0);
    });
    if (prior) return prior;
    return appendWorldFact(world, makeFact({ day: onDay, kind: 'gathering', locationId: course.toLocationId,
        visibility: 'secret', summary: `${body.name} reached the destination of an actual journey.`,
        actors: [{ id: body.id, name: body.name, role: 'arrived' }], causes: cause ? [cause.id] : [],
        data: { actualBodyArrival: true, bodyId: body.id, ...course }
    }), { recur: false, bystanders: false });
}

/** Called after the actual NPC location write, before its old leg is forgotten. */
export function recordNpcActualArrival(world: WorldState, npc: NpcRecord, leg: NpcActivity, onDay: number): HistoricalFact | null {
    const course = arrivalCourseOfActivity(leg);
    if (!course) return null;
    const cause = course.vesselId ? factsWithDataValue(world, 'vesselId', course.vesselId)
        .filter(fact => fact.data.actualBodyArrival !== true)
        .reverse().find(fact => {
            const accepted = arrivalCourseOfFact(fact);
            return accepted !== null && sameActualArrivalCourse(course, accepted);
        }) : undefined;
    const arrival = recordActualBodyArrival(world, { id: npc.id, name: npc.name, alive: npc.status === 'alive',
        locationId: npc.locationId }, course, onDay, cause);
    if (arrival) spreadPlagueAfterArrival(world, npc.id, onDay, course.toLocationId);
    return arrival;
}

/** An oath names its bodies and destination once; this reader asks only what actually arrived. */
export function actualBodiesArrivedTogether(world: WorldState, bodies: readonly ActualArrivalBody[],
    destinationId: string, acceptedOnDay: number, acceptsCourse?: (fact: HistoricalFact) => boolean): boolean {
    if (!Number.isFinite(acceptedOnDay) || bodies.length === 0 || new Set(bodies.map(body => body.id)).size !== bodies.length
        || bodies.some(body => !body.alive || body.locationId !== destinationId)) return false;
    const receipts = bodies.map(body => factsWithDataValue(world, 'bodyId', body.id).flatMap(fact => {
        const course = arrivalCourseOfFact(fact);
        if (acceptsCourse && (!course || !fact.causes.some(id => {
            const accepted = witnessIndexFor(world).byId.get(id);
            const original = accepted && arrivalCourseOfFact(accepted);
            return !!accepted && accepted.data.actualBodyArrival !== true && !!original
                && sameActualArrivalCourse(course, original) && acceptsCourse(accepted);
        }))) return [];
        return fact.data.actualBodyArrival === true && course && course.toLocationId === destinationId
            && fact.day >= acceptedOnDay && !journeyTimeHasReached(acceptedOnDay, course.arrivalDay) ? [course] : [];
    }));
    return receipts[0]!.some(course => receipts.every(body => body.some(arrived => sameActualArrivalCourse(course, arrived))));
}
