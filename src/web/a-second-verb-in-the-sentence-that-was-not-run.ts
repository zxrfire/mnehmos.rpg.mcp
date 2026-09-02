/**
 * A second thing the player asked for that the turn did not do.
 *
 * Found by playing. The sentence was `I buy a month of rations and eat`, and
 * the rations were bought, and nothing ate. The hunger banner stayed up and
 * NOTHING SAID SO - the second clause was not refused, it was dropped, and a
 * dropped instruction does not even have the courtesy of a refusal. This
 * project already holds that a refusal must name its cause; silence is worse
 * than a refusal, because the player has no way to tell it apart from the
 * action having happened and done nothing.
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
 * ── WHY IT ONLY LOOKS AFTER THE CLAUSE THAT RAN ──────────────────────────
 *
 * The rule is narrow because the alternative was measured and it is chatty.
 * Reporting ANY clause whose own reading differs from the turn's - which would
 * also catch the mirror case, where the parser takes the last verb and drops
 * the first - fired on four ordinary single-intent sentences in a corpus of
 * thirty-four:
 *
 *     "tell me about the market and the prices"     -> "tell me about the market"
 *     "I speak to the elder and ask about a manual" -> "I speak to the elder"
 *     "I introduce myself and ask to join the sect" -> "I introduce myself"
 *
 * Every one of those is ONE act described in two halves, and telling the
 * player half their sentence was ignored would be a lie. Restricted to clauses
 * standing after the one that ran, the same corpus produced no false report at
 * all.
 *
 * The cost of the narrowness is honest and worth writing down: **where the
 * parser takes the LAST verb in the sentence and drops the first, this says
 * nothing.** `I gather herbs and go to the market` resolves to `market` and
 * the gathering is silently lost, which is the same defect from the other end.
 * The engine has no answer for that one yet, and guessing at it costs more
 * than it buys.
 */

import { parseIntent, type ActionName } from './actions.js';

/**
 * Where one instruction ends and the next begins.
 *
 * Only the words people actually use to bolt a second act onto a sentence.
 * A bare comma is NOT on this list: it separates the items of a list far more
 * often than it separates two intentions, and "I ask about pills, medicine and
 * herbs" must not read as three turns.
 */
const A_SECOND_INSTRUCTION_STARTS = /\s+(?:and then|and also|then also|and|then)\s+|\s*;\s*/;

/** What a clause is once the punctuation somebody typed after it is off. */
function tidy(clause: string): string {
    return clause.trim().replace(/[.,;!?]+$/, '').trim();
}

export interface ClauseNotRun {
    /** The player's own words for the thing that did not happen. */
    clause: string;
    /** What it would have been, had it been said on its own. */
    action: ActionName;
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
 *   2. The FIRST clause, read on its own, is still the action that ran. If it
 *      is not, the split changed the meaning and the whole sentence is the
 *      only reading worth trusting.
 *   3. Some later clause reads as a different, recognised action.
 *
 * Only the first such clause is returned. A player who typed three verbs is
 * told about the next one, not handed a list - the answer to all of them is
 * the same sentence, and saying it once is saying it.
 */
export function theClauseThisTurnDidNotRun(input: string, ran: ActionName): ClauseNotRun | null {
    const clauses = input.split(A_SECOND_INSTRUCTION_STARTS).map(tidy).filter(Boolean);
    if (clauses.length < 2) return null;

    const first = clauses[0];
    if (first === undefined || parseIntent(first).action !== ran) return null;

    for (const clause of clauses.slice(1)) {
        const action = parseIntent(clause).action;
        if (action === 'unclear' || action === ran) continue;
        return { clause, action };
    }
    return null;
}

/**
 * What the player is told, in their own words and the world's voice.
 *
 * Names the thing that did not happen, says why one and not both, and says the
 * sentence that would work - which is the whole of what makes this a refusal
 * rather than a shrug. No mention of parsers, clauses or turns: a person
 * standing in a village is being told that they cannot do two things at once.
 */
export function sayingWhatWasNotDone(dropped: ClauseNotRun): string {
    return `You said two things, and only the first of them was done. "${dropped.clause}" was not. `
        + 'One act at a time - each has its own price in days and in food, and nothing here will '
        + `spend either on your behalf. Say "${dropped.clause}" on its own and it will happen.`;
}

/** The same fact for the log and the inspector, where precision is the point. */
export function theStructureLineFor(dropped: ClauseNotRun, ran: ActionName): string {
    return `Ran ${ran}. Not run: "${dropped.clause}", which on its own reads as ${dropped.action}. `
        + 'One action is executed per turn; the clause was reported rather than dropped.';
}
