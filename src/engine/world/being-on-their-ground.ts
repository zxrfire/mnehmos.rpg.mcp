/**
 * Standing on a house's ground is hearing of them.
 *
 * ── THE DEFECT THIS EXISTS FOR ───────────────────────────────────────────
 *
 * Found by playing, standing inside the Azure Cloud Pavilion's own compound,
 * having been told in the same run that the ground was theirs. The player typed
 * **"can I join this sect?"** - a deictic, never the name - the reader resolved
 * *this sect* to the Pavilion correctly, and the engine answered:
 *
 *   Not a name you hold.
 *   Unresolved sect "Azure Cloud Pavilion": no knowledge record.
 *
 * and the narrator rendered it as *"a sound that has not been introduced to
 * this place"*, to somebody standing in their courtyard.
 *
 * **The guarded rule is right and its precondition was wrong.** *Naming a house
 * you have not heard of must not quietly enrol you somewhere else* is a real
 * hazard and that guard stays exactly as it is. What was wrong is that the
 * knowledge table had no row, because **nothing wrote one for being there** -
 * so the gate fired on a player who genuinely did hold the name, three ways
 * over: the ground read had told them, the location is called after the house,
 * and they were standing in it.
 *
 * This is the same shape as the 220-of-220 bypass, with the arms reversed. There
 * a free read handed over a name the door withheld. Here the world hands over
 * the name and the gate refuses to accept that the player has it. Both are a
 * gate applied to a FIELD instead of to the ANSWER.
 *
 * ── WHAT BEING THERE IS WORTH, AND WHAT IT IS NOT ────────────────────────
 *
 * `named`, and deliberately no more.
 *
 * The source is `witnessed` - you were there, and `stageCeilingFor` would allow
 * `known` - so this grants **below its own ceiling on purpose**. Being on
 * somebody's ground tells you whose it is. It does not tell you their politics,
 * their arts, who heads them, or what they would want from you. That is the
 * difference between a name you can say out loud and an introduction, and the
 * whole ladder in `discovery.ts` exists to keep those apart.
 *
 * So what it buys is exactly one thing: **the door starts.** A player can name
 * them, ask after them, and be refused on the merits instead of being told they
 * have never heard of the people whose gate they are standing at.
 *
 * ── AND IT IS THE HOUSE, NOT THE PAPERWORK ───────────────────────────────
 *
 * Read off `whoHoldsTheGround`, so it is the same answer the ground read gives
 * and the two cannot drift. Only a `held` reading introduces anybody: nobody is
 * introduced by ground the register carries with no name against it, and an
 * unrecorded row introduces nobody at all rather than introducing a mystery.
 *
 * Nothing about the authority chain is conveyed. Standing in a subsidiary's yard
 * is not being told whose gift it is in - that is the elder's half of the claim
 * and `ruin-gatekeepers.ts` owns it.
 *
 * PURE. Records in, a reading out. No I/O, no RNG, no mutation. The write is the
 * caller's, because this package holds no database.
 */

import { whoHoldsTheGround } from './ground-holder.js';
import type { LocationRecord } from './locations.js';

/** The house whose ground somebody is standing on, ready to be written down. */
export interface AnIntroductionByStandingHere {
    factionId: string;
    /**
     * Their name off the catalog row, or null where the catalog cannot place
     * them.
     *
     * A holder nothing can name introduces nobody: a knowledge row keyed to an
     * id the player can never say back is a row that makes a refusal look like
     * a bug. The caller skips those rather than writing an unsayable name.
     */
    factionName: string | null;
    /** The place that did the introducing, for the row's own note. */
    placeName: string | null;
}

/**
 * Who standing here introduces somebody to.
 *
 * Null where nobody holds this ground, which is most of the map a player walks
 * over and is the honest answer: an empty province introduces nobody.
 */
export function whoBeingHereIntroducesYouTo(
    locations: readonly LocationRecord[],
    locationId: string | null | undefined
): AnIntroductionByStandingHere | null {
    const holding = whoHoldsTheGround(locations, locationId);
    if (holding.holding !== 'held' || !holding.holderFactionId) return null;
    if (!holding.holderName) return null;
    return {
        factionId: holding.holderFactionId,
        factionName: holding.holderName,
        placeName: holding.placeName
    };
}

/**
 * The sentence the knowledge row carries, in the player's own terms.
 *
 * Written here rather than at the call site so the row reads the same whichever
 * caller wrote it - being on their ground and having been in their branch ruin
 * are one mechanism with two doors, and a row that says different things
 * depending on which door it came through is two mechanisms wearing one name.
 */
export function howStandingHerePutIt(intro: AnIntroductionByStandingHere): string {
    return intro.placeName
        ? `${intro.factionName} holds ${intro.placeName}, and you have stood on it.`
        : `${intro.factionName} holds ground you have stood on.`;
}
