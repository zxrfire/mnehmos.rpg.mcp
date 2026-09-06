/**
 * A QI SEAL IS PUT ON A PERSON.
 *
 * The seal follows the person it is laid on - out of the hall, down a road,
 * into somebody else's custody. A first cut put it on the ROOM instead, which
 * would have worked and was the wrong shape: a seal that lives on a location
 * can only be true of whoever happens to be standing there.
 *
 * So the seal is a fact about somebody and the discipline hall is a place with
 * poor ground, and being held is both at once rather than either doing the
 * other's job.
 *
 * WHAT IT TAKES. It caps what they can HOLD at a tenth and takes what they can
 * DRAW down to almost nothing. It does not touch the CEILING - cultivation set
 * that and only cultivation moves it. A seal is a lid, not a wound, so coming
 * off one gives everything back with no re-cultivating.
 *
 * AND A TENTH IS EXACTLY RIGHT. `maxQiForOrdinal` doubles the pool each realm,
 * so a tenth of a realm is a FIFTH of what a whole cultivator one realm below
 * carries - the same ratio at every rung. One guard a realm under their
 * prisoner is the arrangement whether the prisoner is a disciple or an
 * ascendant.
 *
 * ONE CAST, AND IT FELL OUT RATHER THAN BEING TUNED. `EXHAUSTED_QI_FRACTION` is
 * also a tenth, so a sealed cultivator stands exactly on the exhaustion line:
 * they may spend once, and the moment anything leaves the pool they are under
 * it and locked out until the ground gives it back - which, on the ground a
 * house holds people on, does not happen.
 *
 * NOT A DRAIN. Nothing is taken from anywhere and nothing given to anywhere
 * else. The qi is still in the ground; the person cannot reach it.
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
 * What a sealed person can hold, off the ceiling their cultivation set.
 *
 * A tenth. The ceiling itself is untouched - `maxQiForOrdinal` still says what
 * they are, and coming off the seal gives it all back with no re-cultivating -
 * because a seal is a lid and not a wound.
 */
export function whatASealLeavesInThePool(maxQi: number): number {
    return Math.floor(Math.max(0, maxQi) * WHAT_A_SEAL_LEAVES_IN_THE_POOL);
}

/**
 * How much of their own pool a sealed person keeps.
 *
 * A tenth, and it is a ratio rather than a figure on purpose: the pool doubles
 * every realm, so a tenth stays a fifth of the realm below at every rung, and
 * the arrangement that holds an ascendant is the same arrangement that holds a
 * disciple.
 */
export const WHAT_A_SEAL_LEAVES_IN_THE_POOL = 0.1;

/**
 * The pool this person may actually hold right now.
 *
 * Applied on the way in AND on the way out: a seal laid on somebody full has to
 * take the surplus at once, and a seal that is still on has to stop them
 * climbing back over the lid however they came by it.
 */
export function whatThisPersonMayHold(input: {
    maxQi: number;
    seal: AQiSeal | null;
    onDay: number;
}): number {
    return theSealStillHolds(input.seal, input.onDay)
        ? whatASealLeavesInThePool(input.maxQi)
        : input.maxQi;
}

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
        return 'A qi seal, with no day on it. A tenth of what they are is all they may hold, '
            + 'and it comes back at the rate the ground allows, which is nothing worth counting.';
    }
    const left = Math.max(0, Math.ceil(held.liftsOnDay - onDay));
    return `A qi seal, ${left} day${left === 1 ? '' : 's'} left on it. A tenth of what they `
        + 'are is all they may hold, and it refills at the rate the ground allows.';
}
