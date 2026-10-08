import { witnessIndexFor } from './witness-reaction-index.js';
/** Actual appointments bound a physical span; nothing here invents a cadence. */
import { nextPressureTaskOn, type PressureOptions } from './pressure.js';
import { whenThisFallsDue, bodyLifespanEndsOn } from './time.js';
import type { WorldState } from './world-state.js';

export interface WorldClockBoundary {
    onDay: number;
    cause: 'appointment' | 'scheduled_effect' | 'body_expiry' | 'journey_due' | 'passage_boundary';
    sourceId: string;
}

/** Public callers read the same queue the world executor consumes. */
export function nextWorldClockBoundary(world: WorldState, fromDay: number, untilDay: number,
    passageDates: readonly number[] = [], pressure: PressureOptions = {},
    scope: 'all' | 'transport' = 'all'): WorldClockBoundary | null {
    if (!(untilDay > fromDay)) return null;
    let next: WorldClockBoundary | null = null;
    const consider = (onDay: number, cause: WorldClockBoundary['cause'], sourceId: string): void => {
        if (!Number.isFinite(onDay) || onDay <= fromDay || onDay > untilDay) return;
        if (!next || onDay < next.onDay) next = { onDay, cause, sourceId };
    };
    const appointment = nextPressureTaskOn(world, fromDay, untilDay, pressure);
    if (appointment !== null) consider(appointment, 'appointment', 'world-task');
    for (const effect of world.schedule) {
        if (effect.fired) continue;
        for (const day of whenThisFallsDue(effect, fromDay, untilDay)) {
            consider(day, 'scheduled_effect', effect.id);
            break;
        }
    }
    const airSites=new Map(world.locations.filter(place=>place.tags.includes('air-course')).map(place=>[place.id,place]));
    for (const npc of world.npcs) {
        const transport = npc.activity?.departureApproach || npc.activity?.capitalMissionId
            || npc.activity?.capitalMissionWaiting || npc.activity?.airCourseLocationId || npc.activity?.vesselId;
        if (scope === 'transport' && (npc.status !== 'alive' || !transport)) continue;
        const expires = bodyLifespanEndsOn(world, npc);
        if (expires !== null) consider(expires, 'body_expiry', npc.id);
        const airSite=npc.activity?.airCourseLocationId ? airSites.get(npc.activity.airCourseLocationId) : undefined;
        const airFact=airSite && typeof airSite.data.airCourseId==='string'
            ? witnessIndexFor(world).byId.get(airSite.data.airCourseId) : undefined;
        if(npc.status==='alive' && airSite && typeof airSite.data.airStoppedFactId!=='string'
            && typeof airFact?.data.arrivalDay==='number')
            consider(airFact.data.arrivalDay,'journey_due',npc.id);
        if (npc.activity?.untilDay != null)
            consider(npc.activity.untilDay, 'journey_due', npc.id);
    }
    for (const day of passageDates) consider(day, 'passage_boundary', 'accepted-passage');
    return next;
}
