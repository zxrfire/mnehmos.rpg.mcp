import type { RouteQueries } from './locations.js';
import type { HistoricalFact } from './history.js';
/** A retained term reads the original activity, actual native legs and their
 * bound receipts. Due dates and nominal destinations establish neither service
 * nor return. There is no second attendance timer or independent history log. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import { locationOnNpcJourney, siteIntervalOnAnNpcPosting, journeyTimeHasReached } from './places-on-the-way.js';
import { witnessIndexFor } from './witness-reaction-index.js';
import { isLostTrackOf } from './who-a-house-has-lost-track-of.js';
import { getConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import { quoteAnAirJourney, conveyanceOfPersonalFlight } from './what-an-air-journey-takes.js';
import { admitPaidHouseAirReturn } from './a-house-party-takes-an-actual-air-leg.js';
import {aShuttleMemberActuallyServed,actualShuttleReturnDay,nextActualHouseShuttleBoundary,continueActualHouseAirShuttle} from './a-house-party-takes-an-actual-air-shuttle.js';
type RetainedSending = NonNullable<WorldState['pendingSendings']>[number];

export function stillOnThisRetainedSending(npc: NpcRecord, row: RetainedSending): boolean {
    const doing = npc.activity;
    if(row.dispatchFactId)return doing?.capitalMissionId===row.dispatchFactId;
    return doing?.kind === 'out_with_a_party' && doing.sinceDay === row.departsOnDay
        && doing.untilDay === row.departsOnDay + row.posting.days;
}
function stopped(state: WorldState, receiptId: string) {
    return [...(witnessIndexFor(state).references.get(receiptId) ?? [])].some(fact => fact.data.airCourseStopped === receiptId);
}
/** The exact original activity or actual admitted paid return binds a member. */
function airDutyOf(state: WorldState, npc: NpcRecord, row: RetainedSending) {
    const doing = npc.activity, index = witnessIndexFor(state);
    if (!doing) return null;
    let returning: HistoricalFact | null = null;
    let receipt = doing.airDutyReceiptId ? index.byId.get(doing.airDutyReceiptId) : undefined;
    if (doing.kind === 'travelling') {
        const matches = [...index.byId.values()].filter(fact => fact.data.airCourse === true
            && typeof fact.data.houseDutyReturnOf === 'string' && fact.data.vesselId === doing.vesselId
            && fact.data.departureDay === doing.sinceDay && fact.data.arrivalDay === doing.untilDay
            && fact.data.fromLocationId === row.locationId);
        if (matches.length !== 1) return null;
        returning = matches[0]!;
        if (receipt && receipt.id !== returning.data.houseDutyReturnOf) return null;
        receipt = index.byId.get(String(returning.data.houseDutyReturnOf));
    } else if (!stillOnThisRetainedSending(npc, row)) return null;
    const data = receipt?.data;
    if (!receipt || data?.airCourse !== true || data.houseDutyHouseId !== row.posting.houseId
        || data.toLocationId !== row.locationId || data.departureDay !== row.departsOnDay
        || typeof data.fromLocationId !== 'string' || typeof data.arrivalDay !== 'number'
        || typeof data.conveyanceId !== 'string' || data.vesselId !== (doing.vesselId ?? null)
        || !receipt.actors.some(actor => actor.id === (data.vesselId == null ? npc.id : data.pilotId))
        || !row.party.some(member => member.id === (data.vesselId == null ? npc.id : data.pilotId))
        || stopped(state, receipt.id)) return null;
    const craft = data.vesselId == null
        ? conveyanceOfPersonalFlight(typeof data.artId === 'string' ? data.artId : null)
        : getConveyance(data.conveyanceId);
    const back = craft && row.locationId ? quoteAnAirJourney(state.locations, row.locationId,
        data.fromLocationId, craft, typeof data.conveyancePower === 'number' ? data.conveyancePower : null,
        new Set([npc.id, ...doing.withIds]).size, { facts: index.byId, onDay: state.currentDay },
        data.vesselId == null ? 0 : 1) : null;
    if (!back) return null;
    const departure = returning?.data.departureDay;
    const untilDay = typeof departure === 'number' ? departure : row.departsOnDay + row.posting.days - back.daysOneWay;
    return { receipt, returning, fromDay: data.arrivalDay, untilDay, homeId: data.fromLocationId };
}
export function stillOnAnActualRetainedReturn(state: WorldState, npc: NpcRecord, row: RetainedSending): boolean {
    return airDutyOf(state, npc, row)?.returning != null;
}
function enoughService(row: RetainedSending, fromDay: number, untilDay: number) {
    return untilDay > fromDay && (row.posting.reason.termBasis !== 'on_site'
        || journeyTimeHasReached(untilDay, fromDay + row.posting.reason.days));
}
export function aRetainedMemberActuallyServed(state: WorldState, npc: NpcRecord, row: RetainedSending,routes?:RouteQueries): boolean {
    if (npc.status !== 'alive' || isLostTrackOf(state, npc) || !row.locationId) return false;
    if(row.dispatchFactId)return aShuttleMemberActuallyServed(state,npc,row);
    const air = airDutyOf(state, npc, row);
    if (air) {
        if (!enoughService(row, air.fromDay, air.untilDay) || !journeyTimeHasReached(state.currentDay, air.untilDay)) return false;
        // A real return could only be admitted from the actual service site.
        // The current bound return receipt establishes that departure; a
        // nominal destination or an unlanded outgoing site does not.
        return air.returning != null || npc.locationId === row.locationId && !npc.activity?.airCourseLocationId;
    }
    if (!stillOnThisRetainedSending(npc, row)) return false;
    const site = siteIntervalOnAnNpcPosting(state.locations, npc,routes);
    return !!site && site.locationId === row.locationId && enoughService(row, site.fromDay, site.untilDay)
        && journeyTimeHasReached(state.currentDay, site.untilDay)
        && locationOnNpcJourney(state.locations, npc, (site.fromDay + site.untilDay) / 2,routes) === row.locationId;
}
export function actualRetainedReturnDay(state: WorldState, npc: NpcRecord, row: RetainedSending,routes?:RouteQueries): number | null {
    if(row.dispatchFactId)return actualShuttleReturnDay(state,npc,row);
    const doing = npc.activity;
    if (!doing || npc.status !== 'alive' || isLostTrackOf(state, npc)) return null;
    const air = airDutyOf(state, npc, row);
    if (air) {
        const arrival = air.returning?.data.arrivalDay;
        return air.returning && typeof arrival === 'number' && !stopped(state, air.returning.id)
            && journeyTimeHasReached(state.currentDay, arrival) && !doing.airCourseLocationId
            && npc.locationId === air.homeId ? arrival : null;
    }
    const due = row.departsOnDay + row.posting.days;
    return stillOnThisRetainedSending(npc, row) && journeyTimeHasReached(state.currentDay, due)
        && locationOnNpcJourney(state.locations, npc, state.currentDay,routes) === (doing.returnTo ?? npc.locationId)
        ? due : null;
}
export function aRetainedMemberActuallyReturned(state: WorldState, npc: NpcRecord, row: RetainedSending,routes?:RouteQueries): boolean {
    return actualRetainedReturnDay(state, npc, row,routes) != null;
}
/** A native appointment at the service boundary, not a stored watch timer. */
export function retainedAirReturnBoundary(state: WorldState, row: RetainedSending): number | null {
    if(row.dispatchFactId)return nextActualHouseShuttleBoundary(state,row);
    for (const member of row.party) {
        const npc = state.npcs.find(person => person.id === member.id);
        if (!npc || !stillOnThisRetainedSending(npc, row)) continue;
        const air = airDutyOf(state, npc, row);
        if (air && !air.returning && air.receipt.data.pilotId === npc.id) return air.untilDay;
    }
    return null;
}
/** The ordinary paid-return authority keeps title, real custody, group/capacity
 * and prepaid commitment checks. No new fare or returning party is invented. */
export function continueActualRetainedAirReturns(state: WorldState, onDay: number): void {
    for (const row of state.pendingSendings ?? []) {
        if(row.dispatchFactId){continueActualHouseAirShuttle(state,row,onDay);continue;}
        const readyAt = retainedAirReturnBoundary(state, row);
        if (readyAt == null || !journeyTimeHasReached(onDay, readyAt) || !row.locationId) continue;
        const people = row.party.map(member => state.npcs.find(person => person.id === member.id));
        if (people.some(npc => !npc || npc.status !== 'alive' || npc.locationId !== row.locationId
            || !aRetainedMemberActuallyServed(state, npc, row))) continue;
        const group = people.filter((npc): npc is NpcRecord => npc !== undefined);
        const pilot = group.find(npc => airDutyOf(state, npc, row)?.receipt.data.pilotId === npc.id);
        if (!pilot) continue;
        const air = airDutyOf(state, pilot, row);
        if (!air) continue;
        admitPaidHouseAirReturn(state, pilot, onDay, {
            kind: 'travelling', note: 'Returning home from a house sending.',
            withIds: group.filter(npc => npc.id !== pilot.id).map(npc => npc.id), sinceDay: onDay,
            untilDay: onDay, fromLocationId: row.locationId, returnTo: air.homeId,
            conveyanceId: pilot.activity?.conveyanceId, conveyancePower: pilot.activity?.conveyancePower
        }, group.filter(npc => npc.id !== pilot.id));
    }
}
