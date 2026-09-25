/**
 * A vehicle: a mount, a cart, a carriage, a boat. An item, standing somewhere, that a person
 * rides and keeps things in.
 *
 * The owner: "separate inventory (what is handy to me right now) from ownership (I can leave
 * things in my sect abode or ride in my vehicle)". So a vehicle is not in anybody's pack. It stands
 * at a place (`locationId`) and either goes with its owner or stays where it was left:
 *
 *   - "when you buy it, you take it with you" - bought or built, it is with you;
 *   - "I leave my cart here" leaves it, and it stays;
 *   - riding it needs it where you are, "unless you fit it in a storage ring": a vehicle put in a
 *     ring is the ring's, and taken out it stands where you are;
 *   - it is a container like a ring: a thing put in it is the vehicle's, reached only when you are
 *     with it.
 *
 * A VEHICLE GOING WITH SOMEBODY IS WHEREVER THEY ARE. That is derived, not written on every
 * journey: only a vehicle that was left has a place of its own (`locationId`, set when it is left),
 * so no road, walk, fold or passage can forget to bring it.
 *
 * What it takes up is in berths, the design's own unit for a hull: a person, their gear and their
 * share of deck and rail, about 4,000 litres a head. A heaven-grade ring holds a spirit boat.
 */

import { getConveyance } from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import type { Conveyance } from './what-a-conveyance-does-to-a-journey.js';
import { makeObject, type ObjectRecord } from './possessions.js';

/** Litres a head of a vehicle takes up: a berth. */
export const WHAT_A_BERTH_TAKES = 4_000;

/**
 * What a vehicle carries for each head it seats: cargo, not the berth itself. The owner: "a cart
 * isn't infinite storage tho", "once you max out a cart you gotta do a spirit boat". A drawn
 * carriage takes twenty swords easily and a season of food, and not a spirit beast's carcass.
 */
export const WHAT_A_HEAD_OF_CARGO = { volume: 250, weight: 200 } as const;

/**
 * And a spirit boat's hold, which is a flying ship's: "spirit boat = genre flying boat". Thirty
 * heads of it carry a thousand-year tortoise's belly-plate, which is what a boat is for.
 */
export const WHAT_A_HEAD_OF_A_SPIRIT_BOAT_CARRIES = { volume: 2_000, weight: 2_400 } as const;

/** What a vehicle's hold carries in all, by the heads it seats. */
export function whatAVehicleHolds(vehicle: Pick<ObjectRecord, 'data'>): { volume: number; weight: number } {
    const kind = getConveyance(String(vehicle.data?.conveyanceId ?? ''));
    const heads = kind?.heads ?? 1;
    const each = kind?.crossesGroundThatCannotBeWalked ? WHAT_A_HEAD_OF_A_SPIRIT_BOAT_CARRIES : WHAT_A_HEAD_OF_CARGO;
    return { volume: heads * each.volume, weight: heads * each.weight };
}

/** The hold still free across these vehicles, after what is already in them. */
export function theFreeHoldOf(objects: readonly ObjectRecord[], vehicles: readonly ObjectRecord[]): { volume: number; weight: number } {
    let volume = 0;
    let weight = 0;
    for (const vehicle of vehicles) {
        const holds = whatAVehicleHolds(vehicle);
        const inside = whatIsInTheVehicle(objects, vehicle.id);
        volume += Math.max(0, holds.volume - inside.reduce((sum, o) => sum + o.volume, 0));
        weight += Math.max(0, holds.weight - inside.reduce((sum, o) => sum + o.weight, 0));
    }
    return { volume, weight };
}

/** Whether this is a vehicle. The same field `kindOfCraft` reads. */
export function isAVehicle(object: Pick<ObjectRecord, 'data'>): boolean {
    return typeof object.data?.conveyanceId === 'string';
}

/** Who a vehicle is going with, or null where it was left. */
export function whoItIsWith(vehicle: Pick<ObjectRecord, 'data'>): string | null {
    const with_ = vehicle.data?.withId;
    return typeof with_ === 'string' ? with_ : null;
}

/** A vehicle somebody has just bought or built: going with them. */
export function aVehicleOf(input: {
    id: string;
    conveyanceId: string;
    ownerId: string;
    ownerName: string;
    at: string | null;
}): ObjectRecord {
    const kind = getConveyance(input.conveyanceId) as Conveyance;
    return makeObject({
        id: input.id,
        name: kind.name.replace(/^./, (c: string) => c.toLowerCase()),
        kind: 'other',
        significance: kind.holding === 'tracked' ? 'significant' : 'notable',
        possessorId: null,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        locationId: input.at,
        volume: kind.heads * WHAT_A_BERTH_TAKES,
        weight: kind.heads * 250,
        tags: ['conveyance'],
        data: { conveyanceId: input.conveyanceId, withId: input.ownerId, mooredAt: input.at ?? '' }
    });
}

/** Where a vehicle stands: its place, or the mooring an older craft row names. */
export function whereItStands(vehicle: Pick<ObjectRecord, 'locationId' | 'data'>): string | null {
    if (vehicle.locationId) return vehicle.locationId;
    const moored = vehicle.data?.mooredAt;
    return typeof moored === 'string' && moored.length > 0 ? moored : null;
}

/**
 * Whether this person is with this vehicle: it is going with them, or it was left standing where
 * they are. A vehicle in a ring is the ring's and nobody is with it until it is taken out.
 */
export function isWithThem(vehicle: ObjectRecord, personId: string, here: string | null): boolean {
    if (!isAVehicle(vehicle)) return false;
    // Taken into their hands - stolen, handed over - it is with them, whoever's it is.
    if (vehicle.possessorId === personId) return true;
    if (vehicle.possessorId !== null) return false;
    const with_ = whoItIsWith(vehicle);
    if (with_ !== null) return with_ === personId;
    return here !== null && whereItStands(vehicle) === here;
}

/** The vehicles they could ride or reach into from here: theirs, or in their hands. */
export function theVehiclesTheyAreWith(objects: readonly ObjectRecord[], personId: string, here: string | null): ObjectRecord[] {
    return objects.filter(object => (object.ownerId === personId || object.possessorId === personId)
        && isWithThem(object, personId, here));
}

/** The vehicles of theirs they are not with: left somewhere else, or put away in a ring. */
export function theVehiclesLeftElsewhere(objects: readonly ObjectRecord[], personId: string, here: string | null): ObjectRecord[] {
    return objects.filter(object => isAVehicle(object) && object.ownerId === personId && !isWithThem(object, personId, here));
}

/** Leaving a vehicle where it stands: it stops going with them. */
export function leaveItHere(objects: ObjectRecord[], vehicle: ObjectRecord, here: string | null): void {
    const at = objects.findIndex(object => object.id === vehicle.id);
    objects[at] = { ...vehicle, locationId: here ?? vehicle.locationId, data: { ...vehicle.data, withId: null, mooredAt: here ?? '' } };
}

/** Taking a vehicle along again: it goes with them from here. */
export function takeItAlong(objects: ObjectRecord[], vehicle: ObjectRecord, personId: string): void {
    const at = objects.findIndex(object => object.id === vehicle.id);
    objects[at] = { ...vehicle, data: { ...vehicle.data, withId: personId } };
}

/** What is in a vehicle: the things it holds, the way a ring holds what is put in it. */
export function whatIsInTheVehicle(objects: readonly ObjectRecord[], vehicleId: string): ObjectRecord[] {
    return objects.filter(object => object.possessorId === vehicleId);
}
