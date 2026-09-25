/**
 * Put a major event on the books for a date the player may or may not be around
 * for.
 *
 * Nothing the game runs books a `concurrent_event` yet; the kind resolves in
 * `advanceTime` like every other booking, and tests that exercise that
 * resolution book one through `schedule()`, whose contract this is.
 */

import type { EventScale } from '../../src/engine/world/history.js';
import { schedule, type WorldState } from '../../src/engine/world/world-state.js';

export interface ConcurrentEventInput {
    /** Absolute day it happens. May be far in the future. */
    onDay: number;
    summary: string;
    scale?: EventScale;
    locationId?: string | null;
    factionId?: string | null;
    actorIds?: string[];
    /** Probability it actually comes off. Resolved by the engine, not the LLM. */
    chance?: number;
    magnitude?: number;
}

export function scheduleConcurrentEvent(
    state: WorldState,
    input: ConcurrentEventInput
): { state: WorldState; effectId: string } {
    const booked = schedule(state, {
        kind: 'concurrent_event',
        dueOnDay: input.onDay,
        summary: input.summary,
        actorIds: input.actorIds ?? [],
        locationId: input.locationId ?? null,
        factionId: input.factionId ?? null,
        chance: input.chance ?? 1,
        data: {
            scale: input.scale ?? 'regional',
            magnitude: input.magnitude ?? 0.6
        }
    });
    return { state: booked.state, effectId: booked.effect.id };
}
