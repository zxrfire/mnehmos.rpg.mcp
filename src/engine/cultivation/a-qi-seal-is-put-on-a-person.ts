/**
 * A QI SEAL IS PUT ON A PERSON.
 *
 * The design owner: *"seals already exist, so prisoners are just sealed and
 * thrown into a qi poor area"*, *"just call it qi seal"*, *"i mean, it can be a
 * person either - just do it as a person, make it easy"*, and *"hardcode the qi
 * levels there to low."*
 *
 * ── WHY A PERSON AND NOT A ROOM ──────────────────────────────────────────
 *
 * A first cut put it on the ROOM: a third meaning for `LocationRecord.sealed`,
 * beside the undrawn pocket and the locked door. It would have worked and it
 * was the wrong shape. A seal follows the person it is laid on - out of the
 * hall, down a road, into somebody else's custody - and a seal that lives on a
 * location can only ever be true of whoever happens to be standing there. It
 * also made a field that already carried two meanings carry three.
 *
 * So the seal is a fact about somebody, the hall is a place with poor ground,
 * and being held is BOTH of those at once rather than either one doing the
 * work of the other.
 *
 * ── WHAT IT TAKES, AND WHAT IT DOES NOT ──────────────────────────────────
 *
 * It takes the ability to DRAW. Not the pool, not the ceiling on the pool, and
 * not what is already in them.
 *
 * That distinction is the owner's, stated about techniques and true here for
 * the same reason: *"your cultivation sets your qi max, and techniques expend
 * your qi - but techniques shouldn't expend your qi max."* A sealed cultivator
 * is exactly as strong as they were the moment it went on. They can still
 * spend what they are holding, and once it is gone there is no more, because
 * getting more is the one thing the seal stops.
 *
 * Which is what makes a term bite without a single number being taken away:
 * no breakthrough, no recovering what you spend, and the years going by
 * anyway. The genre's own mechanism - what a sect does to somebody it holds is
 * cut them off from the qi of heaven and earth - rather than an invention.
 *
 * ── AND IT IS NOT A DRAIN ────────────────────────────────────────────────
 *
 * Nothing is taken from anywhere and nothing is given to anywhere else. There
 * is no transfer, no ledger, and no conservation to get wrong. The qi is still
 * in the ground; the person cannot reach it.
 */

/**
 * A seal on somebody, or null for the overwhelming majority who carry none.
 *
 * Stored, because it CHANGES - it goes on, it runs, and it comes off - which is
 * the same test this repo applies everywhere else to decide stored against
 * derived.
 */
export interface AQiSeal {
    /**
     * Absolute world day the seal lifts on, or null for one with no end.
     *
     * Null is a real answer and not an oversight: a house that seals somebody
     * without naming a day has said something specific about them, and the
     * engine should be able to hold it. Nothing lifts it but the hand that put
     * it on.
     */
    liftsOnDay: number | null;
    /** The house or person whose seal it is. Null where nobody will say. */
    byId: string | null;
    /** Why, in words. Free text, like `NpcGoal.text`. Never a category. */
    note: string;
    /** Absolute world day it went on. */
    sinceDay: number;
}

/** Whether this seal is still holding on the given day. */
export function theSealStillHolds(seal: AQiSeal | null, onDay: number): boolean {
    if (seal === null) return false;
    if (seal.liftsOnDay === null) return true;
    return onDay < seal.liftsOnDay;
}

/**
 * What is left to draw for somebody under a seal.
 *
 * FLOORED RATHER THAN ZEROED. Somebody held is not a mortal: they keep what is
 * in them, their body still mends, and they are still whatever realm they were.
 * A hard zero would make the seal a different kind of object - one that ends
 * people rather than holding them - and this world already has a word for that
 * and it is not this.
 *
 * Low enough that the band reads as the thinnest there is, so a sealed
 * cultivator is on the worst ground in the world however good the mountain
 * under the compound happens to be. That is the point: the hall is put on poor
 * ground AND the seal is laid on, and neither is doing the other's job.
 */
export function whatIsLeftToDrawUnderASeal(density: number): number {
    return Math.min(Math.max(0, density), WHAT_A_SEAL_LEAVES_YOU);
}

/**
 * The ceiling a seal puts on what anybody under it can draw.
 *
 * Hardcoded and deliberately not tuned. The owner: *"hardcode the qi levels
 * there to low."* A figure with a formula behind it invites somebody to argue
 * with the formula; this one is a wall.
 */
export const WHAT_A_SEAL_LEAVES_YOU = 0.02;

/**
 * The density to hand a skip for this person, given the ground they stand on.
 *
 * The one function callers need. It reads as the sentence it is: what is under
 * you, unless somebody has sealed you, in which case almost nothing.
 */
export function whatThisPersonCanDrawFrom(input: {
    /** The ground's own usable density, 0..1. */
    density: number;
    seal: AQiSeal | null;
    onDay: number;
}): number {
    return theSealStillHolds(input.seal, input.onDay)
        ? whatIsLeftToDrawUnderASeal(input.density)
        : input.density;
}

/** What a seal reads as, for somebody looking at the person carrying one. */
export function whatTheSealLooksLike(seal: AQiSeal | null, onDay: number): string | null {
    if (!theSealStillHolds(seal, onDay)) return null;
    const held = seal!;
    if (held.liftsOnDay === null) {
        return 'A qi seal, with no day on it. Whatever is in them is what they have, and '
            + 'nothing is going to be added to it.';
    }
    const left = Math.max(0, Math.ceil(held.liftsOnDay - onDay));
    return `A qi seal, ${left} day${left === 1 ? '' : 's'} left on it. They can spend what `
        + 'they are holding and they cannot draw a breath of anything to replace it.';
}
