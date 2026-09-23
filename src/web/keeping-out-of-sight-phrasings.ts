/**
 * How a player says they are getting out of sight, in either sense.
 *
 * The reader for the `conceal` verb. Two acts that share a word and are not the
 * same thing: putting your BODY somewhere it is not seen, and putting your
 * WEIGHT away so the body that is seen reads as somebody smaller.
 *
 * ── THE PHRASINGS FOR THE SECOND ONE ALREADY EXISTED ─────────────────────
 *
 * `what-you-are-not-showing.ts` has read "I hide my cultivation", "I conceal my
 * aura", "I mask my realm", "I pass for a mortal" and a dozen more since it was
 * written - as a MANNER riding on some other act. What it had no answer for was
 * the sentence that is only the declaration, which is the one somebody types
 * before they walk into a town. `theFragmentIsOnlyTheDeclaration` is that
 * question, already exported from that file, so nothing is restated here.
 *
 * ── AND THE THREE SENTENCES THIS MUST NOT TAKE ───────────────────────────
 *
 * "I hide FROM them" is a flight, and the flee row owns it: who you are hiding
 * from is a person you are getting away from. `HIDING FROM SOMEBODY` is the
 * guard, and it is the whole of the difference for the bare sense.
 *
 * "I hide the manual" is putting a THING somewhere, which is the pouch or the
 * room, not this. A noun after the verb that is not part of the body settles
 * it - the bare sense takes no object at all.
 *
 * And a sentence that declares the concealment AND does something else keeps
 * going to the act, because `theFragmentIsOnlyTheDeclaration` says so.
 */

import {
    theFragmentIsOnlyTheDeclaration,
    whatYouAreNotShowing
} from './what-you-are-not-showing.js';

/** The label the `conceal` verb dispatches on. */
export type ConcealIntent = 'self' | 'cultivation' | 'show';

/**
 * Getting out of sight yourself, with no object and nobody named.
 *
 * Deliberately narrow. `hide` with anything after it is one of the other
 * readings above; what is left is the bare act and the two ways of saying where
 * ("behind", "out of sight"), neither of which names a person.
 */
const OUT_OF_SIGHT =
    /^\s*(?:i\s+)?(?:hide|hides|hiding|conceal\s+myself|hide\s+myself|keep\s+out\s+of\s+sight|stay\s+out\s+of\s+sight|get\s+out\s+of\s+sight|take\s+cover|lie\s+low|keep\s+my\s+head\s+down)(?:\s+(?:behind|under|among|amongst|in|inside|beside)\s+[\w' -]{2,40})?\s*[.!?]*$/i;

/**
 * Who you are hiding FROM, which makes it a flight and not this.
 *
 * The flee row has owned `hide from` since it was written, and it should: what
 * you are doing is getting away from a named person, and the mover prices that.
 */
const HIDING_FROM_SOMEBODY = /\bhid(?:e|es|ing)\s+from\b/i;

/** Carrying it openly again, which has to be read before the declaration. */
const SHOWING_IT_AGAIN =
    /\b(?:stop|stops|stopping|quit|quits|no longer|give up|gives up)\s+(?:\w+\s+){0,2}?(?:hiding|concealing|masking|suppressing|banking|veiling)\b|\b(?:let|lets|letting|drop|drops|dropping|release|releases)\s+(?:my|our)\s+(?:qi|aura|presence|cultivation|realm|rung|strength|power|base|foundation|weight|breath|core)\s+(?:out|go|show|loose|free)\b|\b(?:show|shows|showing|reveal|reveals|revealing|stop hiding)\s+(?:them\s+|him\s+|her\s+)?(?:what|who)\s+i\s+am\b|\bi\s+(?:show|reveal)\s+(?:my|our)\s+(?:cultivation|realm|rung|strength|power|aura|weight)\b/i;

/**
 * What this sentence conceals, or null for every other sentence.
 *
 * ORDER: showing it again first, because every phrasing of it contains a word
 * from the hiding list. Then the declaration on its own. Then the bare act.
 */
export function whatIsBeingKeptOutOfSight(
    input: string
): { action: 'conceal'; intent: ConcealIntent } | null {
    if (SHOWING_IT_AGAIN.test(input)) return { action: 'conceal', intent: 'show' };
    if (HIDING_FROM_SOMEBODY.test(input)) return null;
    if (whatYouAreNotShowing(input) !== null && theFragmentIsOnlyTheDeclaration(input)) {
        return { action: 'conceal', intent: 'cultivation' };
    }
    if (OUT_OF_SIGHT.test(input)) return { action: 'conceal', intent: 'self' };
    return null;
}
