/**
 * A match, and what comes of one.
 *
 * The words a player says about a marriage, a refusal and a child, and the one
 * step that routes them. Lifted whole out of the pattern table in `actions.ts`,
 * where it needed nothing from its neighbours and its neighbours needed nothing
 * from it but `familyStep` - the shape `leaving-things-for-the-next-life.ts`
 * already established for `legacyStep`, and which four blocks of that table fit
 * without being reshaped.
 *
 * `planIntent` keeps its one-line call and the ordering around it untouched.
 * Nothing here was reordered, rewritten or widened.
 *
 * Single reason to change: how a player says something about a match.
 */

import { PlannedAction } from './planned-action.js';
import { cleanPlace, extractSubject } from './sentence-parts.js';

// ─────────────────────────────────────────────────────────────────────────
// A MATCH, AND WHAT COMES OF ONE
//
// Three verbs a person types, and the reason they are three rather than one is
// that they are three different questions to the engine: what would a house
// take, what does saying no leave, and what do the years cost. Everything they
// reach was already built and had no route to it.
//
// ── THE VOCABULARY TAKES BOTH OF EVERYTHING ──────────────────────────────
//
// Words like `son` and `daughter` appear below in pairs, and that is the
// opposite of the asymmetry the design forbids: a player says the word they
// say, and a parser that accepted one and not the other would decide something
// about the world at the keyboard. Nothing downstream of here has any idea
// which word was typed - the plan carries a name and a verb, and the engine
// module that resolves it uses one type for both sides of a match.
// ─────────────────────────────────────────────────────────────────────────

/** The nouns that make a sentence about a match rather than about anything else. */
export const A_MATCH_NOUN =
    /\b(?:marriages?|marriage|match|matches|betrothals?|betrothed|engagements?|engaged|proposals?|unions?|weddings?|suitors?|in-?laws?)\b/;

/** Saying it as a verb rather than as a noun. */
export const MARRYING_VERBS =
    /\b(?:marry|marries|marrying|married|wed|weds|wedding|betroth|betroths|betrothed)\b/;

/** Putting a match to somebody, or saying yes to one already put to you. */
export const PROPOSING_VERBS =
    /\b(?:propose|proposes|proposing|offer|offers|offering|seek|seeks|seeking|ask|asks|asking|beg|begs|begging|approach|approaches|approaching|arrange|arranges|arranging|negotiate|negotiates|negotiating|accept|accepts|accepting|agree|agrees|agreeing|consent|consents|consenting|take|takes|taking)\b/;

/** Saying yes, which is the same negotiation from the other side of the table. */
export const AGREEING_TO_A_MATCH =
    /\b(?:accept|accepts|accepting|agree|agrees|agreeing|consent|consents|consenting|say yes)\b/;

/**
 * Saying no, and walking out, in one vocabulary.
 *
 * One verb because they are one act pointed at two moments, and one
 * implementation downstream because the rule that binds NPCs binds the player.
 */
export const DECLINING_VERBS =
    /\b(?:decline|declines|declining|refuse|refuses|refusing|reject|rejects|rejecting|turn down|turns down|turning down|turn away|say no|says no|break off|breaks off|breaking off|call off|calls off|calling off|walk out|walks out|walking out|walk away|back out|backs out|run|runs|running|flee|flees|fleeing|escape|escapes|escaping|leave|leaves|leaving|will not|wont)\b/;

/** What somebody is having, raising or placing. Both of every pair. */
export const CHILD_NOUNS =
    /\b(?:child|children|kid|kids|baby|babies|infant|infants|son|sons|daughter|daughters|heir|heirs|offspring|famil(?:y|ies)|household)\b/;

/** Having one, and the decades that follow. */
export const HAVING_A_CHILD =
    /\b(?:have|has|having|raise|raises|raising|rear|rears|rearing|bring up|bringing up|brings up|start|starts|starting|found|founds|founding|bear|bears|bearing)\b/;

/**
 * Placing one, which is the favour reaching a player for the first time.
 *
 * `spendAWord` has written the obligation a placer carries since it was
 * written, the world has used it for NPCs, and nothing has ever let the person
 * playing spend one. For somebody with no house it is the only road there is.
 */
export const PLACING_A_CHILD =
    /\b(?:place|places|placing|send|sends|sending|enrol|enrols|enroll|enrolls|enrolling|apprentice|apprentices|apprenticing)\b/;

/** Who is being asked, out of the two shapes a proposal is said in. */
export const PROPOSE_SUBJECT_VERBS =
    /propose (?:a )?(?:match|marriage|union|betrothal)? ?(?:to|with)|propose to|propose|marriage to|marriage with|marriage into|match with|match for|match to|betrothal to|marry|marries|wed|weds|betroth|union with/;

/** What is being put on the table, when the sentence names it. */
export const WHAT_IS_BEING_OFFERED =
    /\b(?:offer|offers|offering|put down|puts down|putting down|put up|pay|pays|paying|give|gives|giving|hand over)\s+(.{2,70}?)\s+(?:for|to|in exchange|in return)\b/i;

/**
 * Who a proposal is aimed at, including the shape `extractSubject` cannot read.
 *
 * "I ask X to marry me" puts the name in the middle of the sentence, and a
 * trailing-noun extractor answers "X to marry me". That phrasing is the most
 * natural one a person types, so it gets its own read rather than being lost.
 */
export function whoTheMatchIsWith(input: string): string | undefined {
    const inTheMiddle =
        /\b(?:ask|asks|asking|beg|begs|begging|approach|approaches|approaching|want|wants|wanted)\s+(.{2,60}?)\s+(?:to marry|to wed|to be my|for (?:a |their |the )?(?:match|marriage|hand))/i
            .exec(input);
    if (inTheMiddle) return cleanPlace(inTheMiddle[1]);
    const theirHouse =
        /\b(?:match|marriage|betrothal|union)\s+(?:with|into|to)\s+(?:the\s+)?(.{2,60}?)\s*[.!?]?$/i
            .exec(input);
    if (theirHouse) return cleanPlace(theirHouse[1]);
    return extractSubject(input, PROPOSE_SUBJECT_VERBS);
}

/**
 * A match, a refusal, or a child - or null, which is the usual answer.
 *
 * Placed high in the table because a sentence about a match is full of other
 * verbs' nouns - a house, a name, a purse, a favour - and every branch needs
 * BOTH a verb and its own noun, so nothing here can fire on a sentence that
 * merely mentions a family.
 */
export function familyStep(text: string, input: string): PlannedAction | null {
    // Asking ABOUT a match is a question, and the mood post-pass cannot help
    // here because it would already have been handed a verb that costs
    // something. Checked first and once.
    const merelyAsking = /\b(?:about|whether|what|which|who|why|how)\b/.test(text);

    // ── LEAVING, WHICH IS THE HALF THAT MAKES THE REST MEAN ANYTHING ─────
    if (DECLINING_VERBS.test(text) && A_MATCH_NOUN.test(text) && !merelyAsking) {
        return {
            action: 'decline',
            target: extractSubject(
                input,
                /(?:from|out of|off) (?:the |this |my |our )?(?:match|marriage|betrothal|engagement|union)|decline|refuse|reject|turn down|say no to/
            ),
            // What kind of no it is. Read for dispatch and never to decide an
            // outcome - what leaving costs is the same function either way.
            intent: /\b(?:run|runs|running|flee|flees|fleeing|escape|escapes|escaping|walk out|walks out|walking out|walk away|leave|leaves|leaving|break off|breaks off|call off)\b/.test(text)
                ? 'leave'
                : 'refuse'
        };
    }

    // ── A CHILD: HAVING ONE, AND PLACING ONE ─────────────────────────────
    if (CHILD_NOUNS.test(text) && !merelyAsking) {
        if (PLACING_A_CHILD.test(text) && /\b(?:at|with|into|in|to)\b/.test(text)) {
            return {
                action: 'child',
                intent: 'place',
                // The house, not the child. Placing is a question put to a
                // door, and the door is what has to resolve.
                target: extractSubject(
                    input,
                    /place .{0,40} (?:at|with|in|into)|send .{0,40} to|enrol .{0,40} (?:at|in|with)|apprentice .{0,40} to|at|with/
                )
            };
        }
        if (HAVING_A_CHILD.test(text)) {
            return {
                action: 'child',
                intent: 'have',
                target: extractSubject(
                    input,
                    /(?:child|children|son|daughter|kid|famil(?:y|ies)|heir)s? (?:with|by)|with|by/
                )
            };
        }
    }

    // ── PROPOSING, AND AGREEING, WHICH ARE ONE NEGOTIATION ───────────────
    const proposing = MARRYING_VERBS.test(text)
        || (PROPOSING_VERBS.test(text) && A_MATCH_NOUN.test(text));
    if (proposing && !merelyAsking) {
        const offered = WHAT_IS_BEING_OFFERED.exec(input);
        return {
            action: 'propose',
            target: whoTheMatchIsWith(input),
            // Which side of the table the sentence is spoken from. Dispatch
            // only; the price and the answer are the same either way.
            intent: AGREEING_TO_A_MATCH.test(text) && !/\b(?:propose|offer)\b/.test(text)
                ? 'accept'
                : 'propose',
            // What is being put down, in the player's own words. NOTHING
            // downstream branches on what kind of thing it is - it is asked one
            // question, which is how high it carries whoever receives it - so
            // the list of what may go here is open and always was.
            ...(offered ? { topic: cleanPlace(offered[1]) } : {})
        };
    }

    return null;
}

// -------------------------------------------------------------------------
// AND SITTING AN ART WITH THE PERSON YOU MARRIED
//
// A dao partnership is the household layer's own subject seen from the
// cultivation side, which is why its vocabulary sits here beside the match's
// rather than in the cultivation block: the words a player says about it are
// `wife`, `husband`, `partner` - the match's nouns - and the verb they attach
// to is the ordinary sitting verb.
// -------------------------------------------------------------------------

/**
 * Who is sitting the art alongside them, or undefined.
 *
 * Two shapes, and the second is why this is a function rather than one
 * alternation: a player names a person ("with Shen Yuqing") or names the role
 * ("with my wife"), and a role has to come back as a searchable string the
 * caller can match a roster row against. The role words come back verbatim
 * for that reason - resolving `my wife` to a row needs the tie table, which
 * this layer does not have and must not guess at.
 *
 * `with` or `alongside` is REQUIRED. A bare trailing noun on a sitting verb is
 * a place far more often than a person, and reading "I cultivate in the
 * eastern cave" as a partner would answer an ordinary request with a refusal
 * about a marriage.
 */
export function whoIsSittingWithThem(input: string): string | undefined {
    const named =
        /\b(?:with|alongside|beside|together with)\s+(?:my\s+)?(.{2,60}?)\s*[.!?]?$/i
            .exec(input);
    if (!named) return undefined;
    const who = cleanPlace(named[1]);
    if (who === undefined || who.length < 2) return undefined;
    // A partner noun on its own is the answer. Anything else is taken as a
    // name and handed on for the roster to resolve or refuse by name.
    return who;
}
