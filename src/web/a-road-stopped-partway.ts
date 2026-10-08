import type { AcceptedPassageMoment } from '../engine/world/passage-moment.js';
/** The sole partial road position lives in the existing SQLite stopped-road flag. */
import type Database from 'better-sqlite3';
import type { Cultivator } from '../schema/cultivation.js';
import type { RoadPosition } from '../engine/world/road-course.js';
import { readJsonFlag } from '../server/consolidated/cultivation-support.js';

export const FLAG_ROAD_STOPPED = 'road_stopped';
export interface StoppedRoad {
    readonly to: string;
    /** Coarse displayed ground used only to reject a cursor after actual relocation. */
    readonly from: string;
    readonly road: number;
    readonly walked: number;
    readonly position?: RoadPosition;
    /** Historical admission moment, not the body's current clock. */
    readonly acceptedMoment?: AcceptedPassageMoment;
}

/** Reopening a service reads this same durable record; memory is not an authority. */
export function stoppedRoadFor(db: Database.Database,
    body: Pick<Cultivator, 'id' | 'location'>): StoppedRoad | null {
    const cursor = readJsonFlag<StoppedRoad>(db, body.id, FLAG_ROAD_STOPPED);
    if (!cursor || cursor.from !== body.location || typeof cursor.to !== 'string'
        || !Number.isFinite(cursor.road) || cursor.road <= 0
        || !Number.isFinite(cursor.walked) || cursor.walked < 0 || cursor.walked > cursor.road) return null;
    const point = cursor.position;
    if (point && (typeof point.originLocationId !== 'string'
        || (point.kind === 'place' ? typeof point.locationId !== 'string'
            : point.kind !== 'edge' || typeof point.fromId !== 'string' || typeof point.toId !== 'string'
                || !Number.isFinite(point.fraction) || point.fraction <= 0 || point.fraction >= 1
                || !Number.isFinite(point.admittedDays) || point.admittedDays <= 0))) return null;
    if (cursor.acceptedMoment && (typeof cursor.acceptedMoment.runId !== 'string'
        || !Number.isFinite(cursor.acceptedMoment.elapsedDays) || cursor.acceptedMoment.elapsedDays < 0
        || !Number.isFinite(cursor.acceptedMoment.boardedOnDay))) return null;
    return cursor;
}

/** Old incomplete cursors cannot prove endpoint entry or reconstruct their origin. */
export function betweenRoadEndpoints(db: Database.Database,
    body: Pick<Cultivator, 'id' | 'location'>): boolean {
    const cursor = stoppedRoadFor(db, body);
    return cursor?.position?.kind === 'edge'
        || !!cursor && !cursor.position && cursor.walked > 0 && cursor.walked < cursor.road;
}
