/**
 * A thing the player asked for that the turn did not do.
 *
 * Found by playing. The sentence was `I buy a month of rations and eat`, and
 * the rations were bought, and nothing ate. The hunger banner stayed up and
 * NOTHING SAID SO - the second clause was not refused, it was dropped, and a
 * dropped instruction does not even have the courtesy of a refusal. This
 * project already holds that a refusal must name its cause; silence is worse
 * than a refusal, because the player has no way to tell it apart from the
 * action having happened and done nothing.
 *
 * ── AND IT HAPPENS IN BOTH DIRECTIONS ────────────────────────────────────
 *
 * The first version of this only looked at clauses standing AFTER the one that
 * ran, and it was wrong in a way worth recording, because the version it
 * shipped as looked complete. The parser takes whichever verb its table
 * reaches first, and that is not always the first verb in the sentence:
 *
 *     I gather herbs and go to the market      -> market. The gathering is gone.
 *     I go to Nine Peaks and look for a teacher -> teacher. The journey is gone.
 *     I cultivate and eat when I am hungry      -> eat. The years are gone.
 *
 * That is the same defect from the other end and it is the worse end. When the
 * SECOND thing is dropped the player at least watches the first one happen and
 * can guess; when the FIRST is dropped, the expensive thing they typed vanishes
 * without a trace and a cheap read runs in its place.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────
 *
 * It is not command chaining, and deliberately so. The game's character is
 * that you say what you mean to do in your own words and the engine prices it;
 * a syntax for sequencing verbs would be a different game, and it would also
 * be dishonest about time - two verbs can legitimately cost two spans, and a
 * player who typed one sentence did not agree to spend two.
 *
 * So the turn still runs exactly one action. What changes is that the clause
 * it did not run is SAID OUT LOUD, with the sentence that would work beside
 * it - the same shape as every other refusal in the package.
 *
 * ── THE ONE RULE, AND HOW IT WAS SETTLED ─────────────────────────────────
 *
 * > **A clause is worth reporting only if it would have COST something.**
 *
 * Free reads are never reported, on either side, and the reason is not
 * tuning: nothing was taken from the player. `look`, `market`, `status`,
 * `interact` and the rest of {@link READ_ONLY_ACTIONS} spend no day, no ration
 * and no stone, so a player who wanted one can simply say it next turn and
 * have it for nothing. Telling them it "was not done" would be true and
 * useless.
 *
 * That single guard is what makes the rule safe in both directions, and it was
 * arrived at by measurement rather than by taste. Against a corpus of 60
 * ordinary one-intent sentences that merely contain the word "and":
 *
 *   - reporting any clause whose reading differs from the turn's: **7 false
 *     reports**, every one of them a free read - `I speak to the elder and ask
 *     about a manual` is one act, not two, and so are `tell me about the market
 *     and the prices` and `I introduce myself and ask to join the sect`;
 *   - the same rule with the cost guard: **0 false reports**, while still
 *     catching all six of the mirror cases above and every costly clause the
 *     after-side version caught.
 *
 * The guard also removed a false report the after-side version was already
 * shipping: `I go to the ruin and look inside` announced that the looking had
 * not been done, when going into a ruin and looking inside it is one act.
 *
 * **What it costs, stated plainly.** Two sentences that used to be reported no
 * longer are - `I work for a season and then go to the market` and `I treat my
 * injuries and then go to the market` - because browsing a board is free. That
 * trade is deliberate: a lie about half the player's sentence is worse than
 * silence about something they can have next turn at no price.
 */

import { parseIntent, READ_ONLY_ACTIONS, type ActionName } from './actions.js';

/**
 * Where one instruction ends and the next begins.
 *
 * Only the words people actually use to bolt a second act onto a sentence.
 * A bare comma is NOT on this list: it separates the items of a list far more
 * often than it separates two intentions, and "I ask about pills, medicine and
 * herbs" must not read as three turns.
 */
const A_SECOND_INSTRUCTION_STARTS = /\s+(?:and then|and also|then also|and|then)\s+|\s*;\s*/;

/**
 * The verbs that take nothing from anybody.
 *
 * A `Set` rather than a repeated `includes`, and read off the register in
 * `actions.ts` rather than restated here - a second list of free verbs would go
 * stale the first time somebody reclassified one, and the failure would be
 * silent in both directions.
 */
const COSTS_NOTHING: ReadonlySet<ActionName> = new Set(READ_ONLY_ACTIONS);

/** What a clause is once the punctuation somebody typed after it is off. */
function tidy(clause: string): string {
    return clause.trim().replace(/[.,;!?]+$/, '').trim();
}

export interface ClauseNotRun {
    /** The player's own words for the thing that did not happen. */
    clause: string;
    /** What it would have been, had it been said on its own. */
    action: ActionName;
    /** Which side of the clause that ran it stood on. */
    side: 'before' | 'after';
}

/**
 * The clause this turn did not run, or null when the sentence held only one.
 *
 * `ran` is the action the turn actually executed - which is the parser's
 * reading on the deterministic path and the model's on the other, and this
 * works either way because it never assumes where the verb came from.
 *
 * Three conditions, all of them narrowing:
 *
 *   1. The sentence splits into more than one clause.
 *   2. Some clause, read on its own, IS the action that ran. If none is, the
 *      split changed the meaning and the whole sentence is the only reading
 *      worth trusting.
 *   3. Some other clause reads as a different, recognised action that would
 *      have cost something.
 *
 * The clause standing AFTER the one that ran is preferred, because that is the
 * commonest shape and it reads in the order the player wrote. Only one is ever
 * returned: somebody who typed three verbs is told about the next one, not
 * handed a list - the answer to all of them is the same sentence, and saying it
 * once is saying it.
 */
export function theClauseThisTurnDidNotRun(input: string, ran: ActionName): ClauseNotRun | null {
    const clauses = input.split(A_SECOND_INSTRUCTION_STARTS).map(tidy).filter(Boolean);
    if (clauses.length < 2) return null;

    const read = clauses.map(clause => ({ clause, action: parseIntent(clause).action }));
    const itsIndex = read.findIndex(entry => entry.action === ran);
    if (itsIndex === -1) return null;

    const worthSaying = (entry: { action: ActionName }): boolean =>
        entry.action !== 'unclear' && entry.action !== ran && !COSTS_NOTHING.has(entry.action);

    const after = read.slice(itsIndex + 1).find(worthSaying);
    if (after) return { ...after, side: 'after' };

    const before = read.slice(0, itsIndex).find(worthSaying);
    if (before) return { ...before, side: 'before' };

    return null;
}

/**
 * What the player is told, in their own words and the world's voice.
 *
 * Names the thing that did not happen, says why one and not both, and says the
 * sentence that would work - which is the whole of what makes this a refusal
 * rather than a shrug. No mention of parsers, clauses or turns: a person
 * standing in a village is being told that they cannot do two things at once.
 *
 * The ordinal changes with the side. Getting it wrong is not cosmetic - a
 * player told "only the first was done" when it was the second will go looking
 * for the wrong thing to have happened.
 */
export function sayingWhatWasNotDone(dropped: ClauseNotRun): string {
    const whichRan = dropped.side === 'after' ? 'first' : 'second';
    return `You said two things, and only the ${whichRan} of them was done. `
        + `"${dropped.clause}" was not. `
        + 'One act at a time - each has its own price in days and in food, and nothing here will '
        + `spend either on your behalf. Say "${dropped.clause}" on its own and it will happen.`;
}

/** The same fact for the log and the inspector, where precision is the point. */
export function theStructureLineFor(dropped: ClauseNotRun, ran: ActionName): string {
    return `Ran ${ran}. Not run: "${dropped.clause}", standing ${dropped.side} it, `
        + `which on its own reads as ${dropped.action}. `
        + 'One action is executed per turn; the clause was reported rather than dropped.';
}
