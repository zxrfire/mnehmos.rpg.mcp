/** The existing advertised public ship becomes an ordinary object only at accepted boarding.
 * Its position derives from the actual operator, never an independent fleet coordinate.
 */
import {forStream} from '../cultivation/rng.js';
import {aVehicleOf,whoItIsWith} from './a-vehicle.js';
import type {WorldState} from './world-state.js';
import type {NpcRecord} from './npc-state.js';
import {isRuined,type ObjectRecord} from './possessions.js';
import type {PublicPassageLeg} from './public-shipping.js';
import {locationOnNpcJourney} from './places-on-the-way.js';

/** The exact existing crew-factory stream, shared for cold berth admission. */
export function shipHandsForHull(seed:string,vesselId:string):number {
    return forStream(seed,'the-crew-of-a-ship',vesselId).int(2,3);
}

/** Pure admission reads actual custody before any crew/activity/body debit commits. */
export function publicShipHullCanBeBoarded(world: {objects:readonly WorldState['objects'][number][];npcs:readonly WorldState['npcs'][number][];locations:readonly WorldState['locations'][number][]},
    leg: Pick<PublicPassageLeg,'vesselId'|'fromId'|'departureDay'>): boolean {
    const hull=world.objects.find(object=>object.id===leg.vesselId);
    if (!hull) return true; // first accepted boarding, not quote-time realisation
    if (isRuined(hull) || hull.data?.conveyanceId!=='conv-water-ship') return false;
    const operator=world.npcs.find(npc=>npc.status==='alive' && npc.tags.includes('crew-of:'+leg.vesselId)
        && npc.identity.occupation==='shipmaster');
    return !!operator && locationOnNpcJourney(world.locations,operator,leg.departureDay)===leg.fromId
        && (hull.possessorId===operator.id || hull.possessorId===null && whoItIsWith(hull)===operator.id);
}

export function realiseAcceptedPublicShipHull(world: WorldState,leg: PublicPassageLeg,operator: NpcRecord): ObjectRecord | null {
    if (operator.status!=='alive' || !operator.tags.includes('crew-of:'+leg.vesselId)
        || operator.activity?.kind!=='travelling' || operator.activity.vesselId!==leg.vesselId
        || operator.activity.fromLocationId!==leg.fromId || operator.activity.returnTo!==leg.toId
        || operator.activity.sinceDay!==leg.departureDay || operator.activity.untilDay!==leg.arrivalDay) return null;
    const existing=world.objects.find(object=>object.id===leg.vesselId);
    if (existing) return existing.data?.conveyanceId==='conv-water-ship'
        && !isRuined(existing)
        && (existing.possessorId===operator.id || existing.possessorId===null && whoItIsWith(existing)===operator.id)
        ? existing : null;
    const hull=aVehicleOf({id:leg.vesselId,conveyanceId:'conv-water-ship',ownerId:operator.id,
        ownerName:operator.name,at:leg.fromId});
    world.objects.push(hull);
    return hull;
}
