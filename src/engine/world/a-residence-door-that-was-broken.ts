/**
 * Physical door damage, 2026-10-03: physical damage follows the actual residence,
 * not the resident. Material is native door-materials; force is native canUnmake.
 * An intact slab is not a claim that it is shut. Location.sealed, a formation,
 * a cycle and a person's qi seal are separate authorities and remain untouched.
 */
import { yourOwnDoor, type TheDoor } from './door-materials.js';
import { THE_TAG_A_RESIDENCE_CARRIES } from './somewhere-that-is-theirs.js';
import { applyLocationChange, type LocationRecord, type ChangeResult } from './locations.js';
import { canUnmake, type UnmakingReach } from '../cultivation/whether-a-weapon-survives-being-used.js';

export interface ActualResidenceDoor {
    readonly locationId: string;
    readonly material: TheDoor;
    readonly brokenOnDay: number | null;
}

/** Actual material plus one changing damage fact, never an entry permission. */
export function theActualResidenceDoor(location: LocationRecord): ActualResidenceDoor | null {
    if (!location.tags.includes(THE_TAG_A_RESIDENCE_CARRIES)) return null;
    const broken = location.data.doorBrokenOnDay;
    return { locationId: location.id, material: yourOwnDoor(location),
        brokenOnDay: typeof broken === 'number' && Number.isFinite(broken) ? broken : null };
}

/** A caller actually closing this residence cannot shut an already broken slab. */
export function theResidenceDoorThatCanBeShut(location: LocationRecord): TheDoor | null {
    const actual = theActualResidenceDoor(location);
    return actual && actual.brokenOnDay === null ? actual.material : null;
}

/** Shared by explicit player force and an actual NPC physical breach commit. */
export function whetherTheResidenceDoorCanBeBroken(location: LocationRecord, strength: number):
    { door: ActualResidenceDoor; force: UnmakingReach } | null {
    const door = theActualResidenceDoor(location);
    return door && door.brokenOnDay === null
        ? { door, force: canUnmake(strength, door.material.standsAt) } : null;
}

/**
 * Caller supplies a genuine appended deed and validates fresh body/target/reach.
 * No movement, ownership, key grant, inventory transfer or ward teardown occurs.
 */
export function breakTheResidenceDoor(location: LocationRecord, input: {
    strength: number; onDay: number; byName: string; causeFactId: string;
}): ChangeResult | null {
    const answer = whetherTheResidenceDoorCanBeBroken(location, input.strength);
    if (!answer?.force.reaches || !Number.isFinite(input.onDay) || !input.causeFactId) return null;
    return applyLocationChange(location, { onDay: input.onDay, kind: 'other',
        summary: `${input.byName} broke ${answer.door.material.name} at ${location.name}.`,
        causeFactId: input.causeFactId, causeKnown: true,
        patch: { data: { doorBrokenOnDay: input.onDay } } });
}
