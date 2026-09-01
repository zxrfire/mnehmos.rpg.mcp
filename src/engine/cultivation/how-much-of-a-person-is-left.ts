/**
 * How much of a person is left, and the soul that says so.
 *
 * `soulState` and `identityContinuity` are two readings of one thing. The first
 * is the condition of the soul - intact, damaged, fragmented, fading. The second
 * is the fraction of the original person this still is, and its own comment says
 * what it is for: stopping a remnant from being mistaken for the person who left
 * it.
 *
 * ── The measurement this exists for ──────────────────────────────────────
 *
 * They were free to disagree, because every path that wrote one left the other
 * alone. `markDead` set `soulState: 'fading'` and never touched continuity, so a
 * four-hundred-year run of a seeded world produced:
 *
 *     non-intact soul at full continuity   2054
 *     ... which is every corpse in the world
 *
 * A fading soul at 100% continuity is incoherent on its face, and it is the same
 * defect `applyCrossingConsequence` was written to fix at the other end of the
 * engine: consequences that ASSIGN rather than compound, so the second ruin
 * undoes the first. There the fix was a worse-of floor for the soul and a
 * multiplying factor for continuity. Here it is the missing half of the same
 * rule - the two fields are pinned to each other, so a writer that moves one
 * cannot leave the other where it was.
 *
 * ── Ceilings, not assignments ────────────────────────────────────────────
 *
 * The numbers below are the MOST of a person a soul in that condition can still
 * be. Nothing here raises continuity; it only refuses to let a broken soul carry
 * a whole person. The crossing table's own calibrated figures - `mad` at
 * fragmented/0.35, `heart_demon_rooted` at damaged/0.75 - sit under their
 * ceilings and pass through untouched, which is the test that the ceilings are
 * describing the same world the failure table already describes.
 */

import type { SoulState } from '../../schema/cultivation.js';
import { worseSoulState } from './what-goes-wrong-at-a-realm-boundary.js';

/**
 * The most of a person a soul in this condition can still be.
 *
 * `fading` is deliberately not zero. A fading soul is a remnant with a name, a
 * grudge and somewhere it wanted to be, and the whole inheritance layer depends
 * on there being enough left of the dead to hand something on.
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
 * Push a soul down to at least `floor`, and bring how much of the person is
 * left down with it.
 *
 * The half of the compounding rule that is not about crossings. Anything that
 * damages a soul - dying, being spent, having a body taken, being pulled out of
 * a ruin as something less than went in - goes through here, so a new path that
 * can break somebody cannot forget the rule by forgetting a field.
 *
 * Never restores either value. Pure: returns the new pair, spread over whatever
 * record it was handed.
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
 * Bring a pair that was written independently back into agreement.
 *
 * For the writers that set both fields at once - an existence transition
 * carrying a soul state and a continuity figure from a caller that computed them
 * separately. The soul is taken as given and the continuity is capped to it,
 * rather than the other way round: a caller that says "fragmented" is making a
 * claim about the person, and a continuity figure above what that state can hold
 * is the half that is wrong.
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
