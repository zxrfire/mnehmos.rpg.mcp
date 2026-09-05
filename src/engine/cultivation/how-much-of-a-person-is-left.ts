/**
 * How much of a person is left, and the soul that says so.
 */

import type { SoulState } from '../../schema/cultivation.js';
import { worseSoulState } from './what-goes-wrong-at-a-realm-boundary.js';

/**
 * The most of a person a soul in this condition can still be.
 */
export const CONTINUITY_CEILING_BY_SOUL_STATE: Readonly<Record<SoulState, number>> = {
    intact: 1,
    damaged: 0.85,
    fragmented: 0.5,
    fading: 0.2
};

export function continuityCeilingFor(soul: SoulState): number {
    return CONTINUITY_CEILING_BY_SOUL_STATE[soul] ?? 1;
}

/** True where the pair could not both be true of one person. */
export function soulAndSelfDisagree(
    self: { soulState: SoulState; identityContinuity: number }
): boolean {
    return self.identityContinuity > continuityCeilingFor(self.soulState) + 1e-9;
}

/**
 * Push a soul down to at least `floor`, and bring how much of the person is left
 * down with it.
 */
export function ruinSoul<T extends { soulState: SoulState; identityContinuity: number }>(
    self: T,
    floor: SoulState
): T {
    const soulState = worseSoulState(self.soulState, floor);
    return {
        ...self,
        soulState,
        identityContinuity: Math.max(
            0,
            Math.min(self.identityContinuity, continuityCeilingFor(soulState))
        )
    };
}

/**
 * Bring a pair that was written independently back into agreement. A fading soul
 * at 100% continuity is incoherent on its face, and it is the same defect
 * `applyCrossingConsequence` fixes at the other end: consequences that ASSIGN
 * rather than compound, so the second ruin undoes the first. The two fields are
 * pinned to each other, so a writer that moves one cannot leave the other.
 */
export function reconcileSoulAndSelf<T extends { soulState: SoulState; identityContinuity: number }>(
    self: T
): T {
    return {
        ...self,
        identityContinuity: Math.max(
            0,
            Math.min(self.identityContinuity, continuityCeilingFor(self.soulState))
        )
    };
}
