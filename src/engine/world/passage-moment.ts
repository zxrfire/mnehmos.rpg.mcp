/** A historical execution moment belongs to its accepted passage fact, not a live clock. */
import type { WorldState } from './world-state.js';
import { witnessIndexFor } from './witness-reaction-index.js';

export interface PassageRunMoment {
    runId: string;
    elapsedDays: number;
}

export interface AcceptedPassageMoment extends PassageRunMoment {
    boardedOnDay: number;
}

/** Follow only the same real vessel's existing course lineage; old unknown moments stay unknown. */
export function passageRunMoment(world: WorldState, receiptId: string): AcceptedPassageMoment | null {
    const index = witnessIndexFor(world);
    let fact = index.byId.get(receiptId);
    const vesselId = fact?.data.vesselId;
    if (!fact || typeof vesselId !== 'string'
        || !(fact.data.publicPassage === true || fact.data.ownedPassage === true)) return null;
    const visited = new Set<string>();
    while (fact && !visited.has(fact.id)) {
        visited.add(fact.id);
        const data = fact.data;
        if (data.changedOwnedCourse !== true && typeof data.runId === 'string' && typeof data.boardingRunElapsedDays === 'number'
            && Number.isFinite(data.boardingRunElapsedDays) && data.boardingRunElapsedDays >= 0
            && typeof data.departureDay === 'number' && Number.isFinite(data.departureDay))
            return { runId: data.runId, elapsedDays: data.boardingRunElapsedDays, boardedOnDay: data.departureDay };
        const parents: (import('./history.js').HistoricalFact | undefined)[] = fact.causes.map(id => index.byId.get(id)).filter(parent => parent
            && parent.day <= fact!.day && parent.data.vesselId === vesselId
            && parent.data.publicPassage === data.publicPassage && parent.data.ownedPassage === data.ownedPassage
            && parent.data.seaLaneId === data.seaLaneId && parent.data.service === data.service);
        // No invented selection where historical lineage is ambiguous.
        if (parents.length !== 1) return null;
        fact = parents[0];
    }
    return null;
}

/** World advancement by another run never reconstructs an unknown past SQL clock. */
export function passageCheckFrame(moment: AcceptedPassageMoment | null, worldNow: number,
    currentRunElapsedDays: number, requestedDays: number): { runStart: number; boardedOnDay: number;
        elapsedOnThisCrossing: number; afterDay: number; throughDay: number; legacyUnknownMoment: boolean } {
    const boardedOnDay = moment?.boardedOnDay ?? worldNow;
    const elapsedOnThisCrossing = Math.max(0, worldNow - boardedOnDay);
    const runStart = Math.floor(moment?.elapsedDays ?? currentRunElapsedDays);
    return { runStart, boardedOnDay, elapsedOnThisCrossing,
        afterDay: runStart + elapsedOnThisCrossing,
        throughDay: runStart + elapsedOnThisCrossing + requestedDays,
        legacyUnknownMoment: moment === null };
}
