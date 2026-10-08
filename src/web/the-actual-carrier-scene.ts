/** One transient physical hull read; accepted receipts and their operators own movement. */
import type { Cultivator } from '../schema/cultivation.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import { witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { journeyTimeHasReached, locationOnNpcJourney } from '../engine/world/places-on-the-way.js';
import { shipPassengerAt } from '../engine/world/passenger-on-a-vessel.js';
import { publicCarriagePassage } from '../engine/world/public-carriages.js';
import { ownedPassageClaim, ownedCarrierAt } from './an-owned-passage.js';
import { recordedVoyage } from './a-ship-at-sea.js';
import { thePaidCarriageClaim } from './a-paid-carriage-on-the-road.js';
import { worldLocationFor } from './entities.js';
import { requireConveyance } from '../data/cultivation/what-a-house-moves-its-people-on.js';
import { theAreasOf, type APlaceReadIntoAreas } from '../engine/world/where-in-a-place-somebody-is-standing.js';

export interface ActualCarrierScene {
    key: string;
    vesselId: string;
    operatorId: string;
    locationId: string;
    areaKind: 'deck' | 'here';
    /** Real current movement, not a passenger roster or copied physical position. */
    accepts: (npc: NpcRecord) => boolean;
}

/** No quote, booking, recruitment, location write or presence widening happens here. */
export function actualCarrierScene(repos: Pick<CultivationRepos, 'db'>, body: Cultivator,
    world: WorldState, onDay: number): ActualCarrierScene | null {
    if (!body.alive) return null;
    const ground = worldLocationFor(world, body.location)?.id;
    const owned = ownedPassageClaim(repos.db, body.id);
    if (owned) {
        const source = ownedCarrierAt(world, owned.receiptId, body, onDay);
        const data = witnessIndexFor(world).byId.get(owned.receiptId)?.data;
        if (!source || source.unavailable || source.locationId !== ground
            || journeyTimeHasReached(onDay, source.endsOnDay) || !data
            || typeof data.vesselId !== 'string' || typeof data.pilotId !== 'string'
            || typeof data.fromLocationId !== 'string' || typeof data.toLocationId !== 'string'
            || typeof data.departureDay !== 'number' || typeof data.arrivalDay !== 'number'
            || typeof data.conveyanceId !== 'string') return null;
        return onThisLeg(data.vesselId, data.pilotId, ground!, data.fromLocationId,
            data.toLocationId, data.departureDay, data.arrivalDay, world, onDay,
            requireConveyance(data.conveyanceId).crossesGroundThatCannotBeWalked ? 'deck' : 'here');
    }
    const voyage = recordedVoyage(repos.db, body.id);
    if (voyage?.receiptId) {
        const source = shipPassengerAt(world, voyage.receiptId, onDay);
        const operator = source?.crew.find(npc => npc.identity.occupation === 'shipmaster') ?? source?.crew[0];
        if (!source || source.unavailable || source.arrived || source.locationId !== ground || !operator) return null;
        return onThisLeg(source.vesselId, operator.id, ground!, source.fromId,
            source.toId, source.departureDay, source.arrivalDay, world, onDay, 'deck');
    }
    const road = thePaidCarriageClaim(repos.db, body.id);
    if (road) {
        const source = publicCarriagePassage(world, road.receiptId, body.id, onDay);
        if (!source || source.arrived || source.locationId !== ground) return null;
        return onThisLeg(source.leg.vesselId, source.driver.id, ground!, source.leg.fromId,
            source.leg.toId, source.leg.departureDay, source.leg.arrivalDay, world, onDay, 'here');
    }
    return null;
}

function onThisLeg(vesselId: string, operatorId: string, locationId: string,
    fromId: string, toId: string, departureDay: number, arrivalDay: number,
    world: WorldState, onDay: number, areaKind: 'deck' | 'here'): ActualCarrierScene {
    return { key: JSON.stringify([vesselId, fromId, toId, departureDay, arrivalDay]),
        vesselId, operatorId, locationId, areaKind,
        accepts: npc => {
            const leg = npc.activity;
            return npc.status === 'alive' && leg?.kind === 'travelling'
                && leg.vesselId === vesselId && leg.fromLocationId === fromId && leg.returnTo === toId
                && leg.sinceDay === departureDay && leg.untilDay === arrivalDay
                && locationOnNpcJourney(world.locations, npc, onDay) === locationId;
        } };
}

/** The same accepted-hull packing is used by scene reads and passenger projection. */
export function areasOfActualCarrier(world: WorldState, scene: ActualCarrierScene,
    observer: Pick<Cultivator, 'id' | 'standingIn' | 'sectId'>): APlaceReadIntoAreas | null {
    const place = world.locations.find(one => one.id === scene.locationId);
    if (!place) return null;
    return theAreasOf(world, place, undefined, { id:observer.id,
        standingIn:observer.standingIn, sectId:observer.sectId,
        physical:{ accepts:scene.accepts, betweenEndpoints:false,
            hull:{key:scene.key,operatorId:scene.operatorId,areaKind:scene.areaKind} } });
}

/** Only an actual offered hull area may survive a clock or coarse-ground boundary. */
export function selectedAreaOnActualCarrier(world: WorldState, scene: ActualCarrierScene,
    observer: Pick<Cultivator, 'id' | 'standingIn' | 'sectId'>): string | null {
    const read = areasOfActualCarrier(world, scene, observer);
    if (!read) return null;
    const selected = read.areas.find(area => area.for === scene.areaKind && area.id === observer.standingIn);
    if (selected) return selected.id;
    // A moving hull may enter a different geographical row. The existing SQL
    // area's local deck suffix names the same offered place aboard this claim.
    const marker = '#' + scene.areaKind + '#';
    const suffix = observer.standingIn?.includes(marker)
        ? observer.standingIn.slice(observer.standingIn.indexOf(marker)) : null;
    const carried = suffix && read.areas.find(area => area.for === scene.areaKind && area.id.endsWith(suffix));
    return carried ? carried.id : read.whereIs.get(scene.operatorId)
        ?? read.areas.find(area => area.for === scene.areaKind)?.id ?? null;
}
