/**
 * An act the engine understood perfectly and cannot carry out, because it was
 * a stupid thing to try.
 *
 * The design owner, drawing the line this module exists on:
 *
 *   > SOME INVALID ACTS ARE INCOHERENT. OTHERS ARE COHERENT AND STUPID
 *   > not everything should be a blank look. that's way too fucking boring
 *
 * The two are not the same failure and they were getting the same answer.
 * *"I seduce the rock"* is not an unreadable sentence - it is a completely
 * clear one - and it was reaching `blankLook`, which exists for a player who
 * typed a NAME and got it wrong. Measured, five different absurdities came back
 * with the identical paragraph about somebody waiting a moment in case the rest
 * of it was coming:
 *
 *     I seduce the rock          I ask the mountain for its name
 *     I seduce my sword          I marry the tree
 *     I threaten the door
 *
 * ── WHAT MAKES IT COHERENT ───────────────────────────────────────────────
 *
 * The sentence reached a VERB and a TARGET. That is the whole test, and it is
 * why this is not a list of stupid things: the engine already knows what the
 * player wanted, and the only thing missing is somebody able to receive it.
 * Nothing here asks what the target IS - a rock, a sword, a mountain, a house,
 * a dead man, an idea. It asks what the ACT needed, which the intent already
 * says.
 *
 * ── AND THE JOKE IS NOT WRITTEN HERE ─────────────────────────────────────
 *
 * It is written by the square. Somebody was standing there when the player
 * tried to seduce a rock, and saying who is funnier than anything this module
 * could invent, truer, and different every time because the square is. That is
 * the same reason `scene-person-readings.ts` exists: the world is already
 * generating the material and the writing is in choosing to look at it.
 */

import { INTERACT_INTENTS } from './planned-action.js';
import type { InteractIntent } from './unresolved-attempt-denials.js';

/**
 * What each act needs from whatever it is aimed at.
 *
 * A `Record` over the intent union rather than a lookup with a fallback, for
 * the reason `unresolved-attempt-denials.ts` gives about its own table: an
 * intent added tomorrow does not compile until somebody has said what it
 * needs, and a default here would be a plausible sentence that says nothing.
 */
const WHAT_THE_ACT_NEEDED: Readonly<Record<InteractIntent, string>> = {
    talk: 'somebody who can hear it',
    negotiate: 'somebody who wants something',
    trade: 'somebody with hands and a reason',
    deceive: 'somebody who can be wrong about something',
    interrogate: 'somebody who knows something and would rather not say',
    threaten: 'somebody with something to lose',
    bribe: 'somebody who can be bought',
    recruit: 'somebody who could turn up',
    apologise: 'somebody who was owed one',
    seduce: 'somebody who could say yes',
    steal: 'somebody holding it'
};

/**
 * What the act wanted, and that nobody here was it.
 *
 * One sentence, out of the intent's own clause. It is true whatever the player
 * aimed at - a rock, a door, a steward who is not standing here - which is the
 * point: classifying the target was tried and dropped, because "the rock" and
 * "the gate steward" are the same shape to a parser and only one of them is
 * absurd. Saying what the ACT needed lets the player see which they typed.
 *
 * `watching` is who is here, and it is the second half: somebody was standing
 * there. That is funnier than any invention, truer, and different every time.
 */
export function whatCameOfTryingIt(
    intent: InteractIntent,
    watching: readonly string[]
): string {
    return `That wants ${WHAT_THE_ACT_NEEDED[intent]}, and nothing here is that.`
        + ` ${whoSawIt(watching)}`;
}

/**
 * Whether this intent needs somebody on the other end of it at all.
 *
 * Every member of the interact union does, which is what makes the check a
 * membership test rather than a list: `INTERACT_INTENTS` is the closed set of
 * acts put TO a person, so an intent that is in it is an intent that wanted
 * one.
 */
export function isASocialIntent(intent: string): intent is InteractIntent {
    return (INTERACT_INTENTS as readonly string[]).includes(intent);
}

/**
 * The player's own phrase for the target, where they introduced it as a THING.
 *
 * An article or a possessive in front of it, and the phrase comes back WITH it,
 * because "the rock" is what they wrote and "Rock" is the engine talking.
 * `cleanPlace` strips the article before a target reaches any resolver - right
 * for a name, which does not carry one - so the words as typed are the only
 * place left to read it.
 */
export function theSentenceCalledItAThing(said: string, target: string): string | null {
    const at = target.trim().toLowerCase();
    if (at.length === 0) return null;
    const escaped = at.replace(/[\.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp(
        `\\b(?:the|a|an|my|his|her|its|their|this|that|these|those)\\s+${escaped}\\b`,
        'i'
    ).exec(said);
    return found === null ? null : found[0].toLowerCase();
}

/**
 * The square's part in it, which is the whole joke and none of it invented.
 *
 * Nobody here is worse than an audience: a thing nobody saw did not cost the
 * player anything except the doing of it.
 */
function whoSawIt(watching: readonly string[]): string {
    if (watching.length === 0) {
        return 'Nobody sees it, which is the only mercy in the arrangement.';
    }
    if (watching.length === 1) {
        return `${watching[0]} watches the whole thing and does not look away, which is worse `
            + 'than looking away.';
    }
    if (watching.length === 2) {
        return `${watching[0]} and ${watching[1]} both watch. Neither says anything to the `
            + 'other, which means they will later.';
    }
    return `${watching[0]}, ${watching[1]} and ${watching.length - 2} `
        + `other${watching.length - 2 === 1 ? '' : 's'} watch the whole thing. One of them will `
        + 'tell it wrong somewhere else, and their version is the one that travels.';
}
