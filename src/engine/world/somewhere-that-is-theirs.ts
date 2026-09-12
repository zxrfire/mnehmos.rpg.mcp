/**
 * Somewhere that is theirs, and the pack it keeps.
 *
 * `settleAbode` built this and built it on the far side of the Lid, so the
 * ruling in `docs/world/climbing/capability-gaps-by-realm.md` had two halves:
 * *"Below the Lid a cultivator has nowhere that is theirs, no place to store
 * anything, nothing to defend"*, and then, on what to do about it, *"the
 * generic machinery is all present, so this is a CALL SITE, not a subsystem"*.
 *
 * So this module is the generic half and `settleAbode` is now one caller of
 * it with the immortal layer's parameters. A residence is a location somebody
 * holds, at any height, and `residenceOf` is the one read for both - a second
 * read for the layer below would be the second copy of a fact.
 *
 * AND THE PACK IS NOT A NEW STORE. `cultivator_pouch` is keyed on a free-form
 * `holder_id`, so a residence holds things by BEING a holder and every read
 * written over what somebody is carrying answers for a residence unchanged.
 * That is what `whereTheyKeepTheirThings` hands out: a holder key, not a
 * table. NPCs get one on the same footing, which is what makes somebody
 * else's residence worth walking to.
 */

import {
    getLocation,
    getNpc,
    upsertLocation,
    upsertNpc,
    type WorldState
} from './world-state.js';
import { makeLocation, type LocationRecord } from './locations.js';
import type { LayerKey } from './layers.js';

/**
 * What marks a place as somebody's own.
 *
 * A tag rather than a kind, because the KIND is what it physically is - a cave
 * on one layer, a courtyard on another - and whose it is is a separate fact.
 * Asked for by this constant everywhere so the two cannot drift.
 */
export const THE_TAG_A_RESIDENCE_CARRIES = 'residence';

/** One residence per resident per layer, keyed by them, so settling twice is settling once. */
export const residenceLocationId = (residentId: string): string => `loc-residence-${residentId}`;

/** Whether this place is somebody's own, and whose. */
export function whoHoldsThisPlace(location: LocationRecord): string | null {
    if (!location.tags.includes(THE_TAG_A_RESIDENCE_CARRIES)) return null;
    const held = (location.data as { heldById?: unknown }).heldById;
    return typeof held === 'string' && held.length > 0 ? held : null;
}

/**
 * The place that is theirs, or null.
 *
 * Derived off the location table rather than stored on the person, so it
 * cannot drift and there is no call site that can forget. Somebody who has
 * crossed the Lid holds ground on both sides; the one they are ON wins, and
 * the most recently settled otherwise.
 */
export function residenceOf(state: WorldState, personId: string): LocationRecord | null {
    const theirs = state.locations.filter(l => whoHoldsThisPlace(l) === personId);
    if (theirs.length === 0) return null;
    const standingIn = getNpc(state, personId)?.locationId ?? null;
    return theirs.find(l => l.id === standingIn)
        ?? theirs.reduce((latest, l) => (settledOn(l) >= settledOn(latest) ? l : latest));
}

function settledOn(location: LocationRecord): number {
    const day = (location.data as { settledOnDay?: unknown }).settledOnDay;
    return typeof day === 'number' ? day : 0;
}

/**
 * The holder key their residence's pack is kept under, or null for no residence.
 *
 * The whole of the storage answer. Pass it to `everythingInThePouch`,
 * `addToPouch` or `removeFromPouch` and a place holds things the way a person
 * does, because it is the same store.
 */
export function whereTheyKeepTheirThings(state: WorldState, personId: string): string | null {
    return residenceOf(state, personId)?.id ?? null;
}

export interface TakeGroundInput {
    residentId: string;
    onDay: number;
    /** What they call it. A plain description when they have not said. */
    name?: string;
    /** Where it is. Defaults to wherever they are standing. */
    parentId?: string | null;
    /** The layer it sits on. Defaults to the layer they are on. */
    layer?: LayerKey;
    /** The location id to use, for a caller that keys its own layer. */
    locationId?: string;
    /** Everything else about the place, for a caller that knows its layer. */
    shape?: Partial<LocationRecord>;
}

export interface TakeGroundResult {
    ok: boolean;
    reason: string | null;
    detail: string;
    state: WorldState;
    residence: LocationRecord | null;
    /** False when they already had one. Settling twice is settling once. */
    created: boolean;
}

/**
 * Take ground and make it yours.
 *
 * Idempotent on the id, and the thing it still does for somebody who already
 * had one is put them in it: a resident who wandered off has a residence they
 * are simply not standing in.
 */
export function theyTakeGroundAndMakeItTheirs(
    state: WorldState,
    input: TakeGroundInput
): TakeGroundResult {
    const npc = getNpc(state, input.residentId);
    const base: TakeGroundResult = {
        ok: false, reason: null, detail: '', state, residence: null, created: false
    };

    if (!npc) {
        return { ...base, reason: 'no_such_person', detail: 'Nobody by that id is in this world.' };
    }

    const id = input.locationId ?? residenceLocationId(npc.id);
    const already = getLocation(state, id);
    if (already) {
        return {
            ...base,
            ok: true,
            residence: already,
            created: false,
            state: upsertNpc(state, { ...npc, locationId: already.id, updatedOnDay: input.onDay }),
            detail: `${already.name} is already theirs, and has been since they made it.`
        };
    }

    const standingIn = npc.locationId ? getLocation(state, npc.locationId) : null;
    const shape = input.shape ?? {};
    const residence = makeLocation({
        kind: 'cave',
        description:
            'Ground taken out of the open and made into somewhere. What it is worth is that '
            + 'it is theirs, which is a thing somebody with nowhere to put anything has none of.',
        ...shape,
        id,
        name: input.name?.trim() || shape.name || 'the cave they cut for themselves',
        ...(input.layer ?? shape.layer ?? standingIn?.layer
            ? { layer: input.layer ?? shape.layer ?? standingIn!.layer }
            : {}),
        parentId: input.parentId ?? shape.parentId ?? npc.locationId ?? null,
        discovered: true,
        tags: [...(shape.tags ?? []), THE_TAG_A_RESIDENCE_CARRIES],
        data: {
            ...(shape.data ?? {}),
            heldById: npc.id,
            heldByName: npc.name,
            settledOnDay: input.onDay
        }
    });
    residence.origin.fromDay = input.onDay;

    let next = upsertLocation(state, residence);
    next = upsertNpc(next, { ...npc, locationId: residence.id, updatedOnDay: input.onDay });

    return {
        ok: true,
        reason: null,
        detail: `${residence.name} is theirs, and there is somewhere to put a thing down.`,
        state: next,
        residence,
        created: true
    };
}
