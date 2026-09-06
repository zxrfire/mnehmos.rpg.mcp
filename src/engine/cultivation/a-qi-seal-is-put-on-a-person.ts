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
 * Two things, and the second was a correction. It caps what they can HOLD at a
 * tenth, and it takes what they can DRAW down to almost nothing. It does not
 * touch the CEILING: *"your cultivation sets your qi max, and techniques expend
 * your qi - but techniques shouldn't expend your qi max."* The same is true of
 * a seal. Cultivation set that number and only cultivation moves it; what the
 * seal does is stop them filling it.
 *
 * A first cut left the pool alone entirely, on the reasoning that a sealed
 * cultivator is as strong as they were when it went on. The owner corrected it:
 * *"a seal gives them 10% of their qi"*, *"and it replenishes VERY slowly
 * (thanks room)"*, *"like to a cultivator a realm below they're still
 * harmless."*
 *
 * AND THE TENTH IS EXACTLY RIGHT, WHICH IS WORTH SHOWING. `maxQiForOrdinal`
 * doubles the pool at each realm, so a tenth of a realm is a FIFTH of what a
 * whole cultivator one realm below is carrying:
 *
 *   Nascent Soul       160 full     16 sealed     vs 80 at Deity's realm below
 *   Void Tribulation   640 full     64 sealed     vs 320 one realm below
 *   Immortal        10,240 full  1,024 sealed  vs 5,120 one realm below
 *
 * Harmless at every rung on the ladder, and harmless by the same ratio at all
 * of them - so one guard a realm under their prisoner is the arrangement, and
 * it is the arrangement whether the prisoner is a disciple or an ascendant.
 *
 * Which is what makes a term bite with the ceiling untouched: a tenth of a
 * pool, refilling at the rate the thinnest ground in the world allows, no
 * breakthrough, and the years going by anyway. The genre's own mechanism -
 * what a sect does to somebody it holds is cut them off from the qi of heaven
 * and earth - rather than an invention.
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
