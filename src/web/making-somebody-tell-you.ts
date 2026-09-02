/**
 * THE THIRD WAY THE WORLD REACHES A PLAYER: YOU MAKE SOMEBODY TELL YOU.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   "you can DEMAND knowledge. whether it succeeds is whether people respect
 *    you - either via power or something else."
 *
 * Discovery now has three ways in and they are genuinely different questions,
 * governed by different state:
 *
 *   BEING TOLD    proximity, and whether they are willing. `asked.ts`.
 *   SEEING        your rung. `what-you-can-see-from-up-there.ts`.
 *   DEMANDING     your standing, and whether they can refuse you. This file.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT IS AN ASK WITH A DIFFERENT SUBJECT. THERE IS NO RESOLVER HERE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Nothing in this file decides whether a demand works. `resolveAttempt` does,
 * and it was already pricing every term the ruling names, which is why building
 * a second one would have been the mistake:
 *
 *   standing   the gap, from `regard.ts` - "who you are outweighs how you ask"
 *   charm      the attribute
 *   the tie    how strongly they already regard you
 *   owed       open favours and debts on the obligation ledger, their way
 *   grudges    what they hold against you
 *   the purse  what was actually put down
 *   the room   who is watching
 *   who they   how freely this particular person parts with anything
 *    are
 *
 * "either via power or something else" is that list. The **something else** is
 * the load-bearing half and it is already the majority of the arithmetic: an
 * elder at no great rung who is owed a great deal can demand successfully, and
 * a strong stranger with a bad name may not. So this module contributes exactly
 * two things the resolver cannot know - **what the ask weighs**, and **whether
 * there was ever anything to be got** - and then gets out of the way.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT DOES NOT BYPASS THE GATE. IT CHANGES WHO OPENS IT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `asking.md` gives three limits and `asked.ts` applies all three:
 *
 *   1  what this person could know
 *   2  what they are in a position to say
 *   3  what saying it would cost them
 *
 * **A demand reaches two and three. It cannot reach one**, and the guarantee is
 * structural: `compelled` is read below the limit-one test inside `askedAbout`,
 * so a compelled answer out of somebody who does not know is not a case that
 * exists to be got wrong.
 *
 *   > Somebody who does not know cannot be made to know, however far above them
 *   > you stand.
 *
 * And that refusal has to READ differently from an unwilling one, which is why
 * {@link WhatStandsInTheWay} is three values and not two. Leaning on somebody
 * who is holding out on you is a thing that can work. Leaning on somebody who
 * has never heard the name is a different event and the player must be able to
 * tell, or the two collapse and the whole channel becomes a coin flip.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND A FAILED DEMAND IS NOT A FAILED ASK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Being turned down costs a day. **Leaning on somebody and being told no is a
 * different event**: you have shown them what you believe your standing to be
 * and been corrected on it, in front of whoever was in the room. The resolver
 * already writes that half - a refused attempt leaves marks, and `reported`
 * reaches their house - so what this file adds is the SENTENCE, because a cost
 * nobody can see is a cost that is not being charged.
 *
 * The same in the other direction, and it is the funnier one: leaning on
 * somebody who was going to tell you anyway is a pure loss. You spent standing
 * to buy a thing that was free, and they now know something about you.
 */

import type { ApproachLeverage } from '../schema/cultivation.js';
import type { AskWeight, AttemptResult } from '../engine/social-leverage/index.js';
import type { Answer } from './asked.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT A DEMAND IS ACTUALLY UP AGAINST
// ─────────────────────────────────────────────────────────────────────────

/**
 * Which of `asking.md`'s limits is in the way, read off the ordinary ask.
 *
 * Derived from an `Answer` and nothing else, so the demand path and the ask
 * path can never come to different conclusions about what this person knows.
 */
export type WhatStandsInTheWay =
    /** Limit one. There is nothing here to be got, at any standing. */
    | 'they_do_not_know'
    /** Nothing is. They would have said it for the asking. */
    | 'they_were_going_to_say_it'
    /** Limits two and three. They know, and telling costs them. */
    | 'they_are_withholding';

export function whatStandsInTheWay(answer: Answer): WhatStandsInTheWay {
    if (!answer.couldKnow) return 'they_do_not_know';
    return answer.reach === 'deflects' ? 'they_are_withholding' : 'they_were_going_to_say_it';
}

/**
 * What a demand for something somebody is sitting on weighs.
 *
 * `a_real_favour` - "time, money, or a word put in somewhere; costs them
 * something" - and a name somebody is reticent about is literally a word put in
 * somewhere. It is not `a_courtesy`, which is what `AskWeight` calls a name
 * given freely and is what the ordinary polite ask already is; pricing a
 * withheld answer as one would make the whole channel free.
 *
 * ── CORRECTED, AND THE FIRST ANSWER IS KEPT BECAUSE THE REASONING WAS THE BUG ──
 *
 * This was `against_their_interest` - "they end up worse off, and they can see
 * that while agreeing" - on the reasoning that `asked.ts` describes the
 * deflection it is aimed at as *"the account they owe costs more than the
 * telling"*, which sounds like exactly that sentence.
 *
 * **Measured in play at ordinal 36 against somebody reading as "plainly beneath
 * notice", and it was wrong.** The terms came back:
 *
 * ```text
 *   base                                        35
 *   the gap in standing between them            +30   (the cap; an approach
 *                                                      never changes what
 *                                                      somebody IS)
 *   charm                                        -6
 *   the weight of the thing asked for           -50
 *   how freely this person parts with things     -1
 *                                              ----
 *                                                8 in a hundred, 14 days
 * ```
 *
 * A Body Integration cultivator leaning on a nobody for a sect's name, at eight
 * percent, over a fortnight. **The ask term alone outweighed the entire standing
 * gap, so no amount of power could ever have carried it** - which is the exact
 * opposite of the ruling this file exists to implement. The mistake was reading
 * the flavour text instead of the ladder: being reticent and ending up worse off
 * are different facts, and `against_their_interest` belongs to asking somebody
 * to act against their own house rather than to asking them to say a name they
 * would rather not.
 *
 * At `a_real_favour` (resistance 0.25, three days) the same matchup reads about
 * a third, which is a live decision rather than a formality, and it leaves the
 * fortnight and the near-impossibility where they belong: on the sentences that
 * really are asking somebody to damage themselves.
 *
 * Stated as a constant rather than derived from the player's wording on
 * purpose. `askWeightOf` reads the sentence, which is right for an open-ended
 * approach and wrong here: what this ask costs them is a fact about their
 * position, and letting the phrasing move it would be the softening the agency
 * rule forbids, reachable by choosing your words.
 */
export const WHAT_A_WITHHELD_ANSWER_WEIGHS: AskWeight = 'a_real_favour';

/**
 * What is behind a demand that named nothing else.
 *
 * FOUND BY PLAYING, and it was the whole channel not working. A Void Refinement
 * cultivator leaning on a Carrier who reads as "plainly beneath notice, and
 * aware of it" came back refused at 18%, and the resolver's own account said
 * why: *"asked interrogate with nothing on the table but the asking"*. The
 * parser sets `leverage` off words like bribe and threaten, an ordinary demand
 * uses neither, so every demand went in at `none` - pressure zero - and the
 * ruling's first half was simply not being read.
 *
 *   > "whether it succeeds is whether people respect you - either via power or
 *   >  something else."
 *
 * `name` is the enum member for exactly that: **the asker's own reputation.**
 * And it is the honest one rather than a convenient one, which is the test that
 * matters here, because `ApproachLeverageSchema` is explicit that *"leverage the
 * asker does not have is a lie the room will price"*:
 *
 * - It is **not invented**. Somebody who demands a thing and puts nothing else
 *   on the table has put THEMSELVES on it. That is what the sentence means.
 * - It is **not `force`**, which is worth two and is "the credible ability to
 *   take it". That is a threat, it is a different sentence, and the parser
 *   already labels it as one. Backing a demand with force by default would let
 *   every player make an implicit threat without saying so.
 * - It is **only ever a default**. A demand that named coin, a debt, a secret or
 *   a house keeps what it named, because the player said what they were using.
 *
 * Worth one point of pressure, like coin and a favour, so it moves how somebody
 * is met and does not move what they are - which is the constraint
 * `APPROACH_PRESSURE_LIMIT` exists to hold, and it means a nobody demanding
 * things is still a nobody demanding things.
 */
export const WHAT_A_BARE_DEMAND_IS_BACKED_BY: ApproachLeverage = 'name';

// ─────────────────────────────────────────────────────────────────────────
// THE REFUSAL THAT IS NOT ABOUT STANDING AT ALL
// ─────────────────────────────────────────────────────────────────────────

export interface RefusalCopy {
    headline: string;
    prose: string;
    structure: string;
}

/**
 * Nothing to be got, so nothing is attempted.
 *
 * Refused BEFORE the resolver - no day spent, no mark written, no grudge - on
 * the same reasoning the missing-sum refusal on a bribe already uses: the
 * sentence has a hole in it, and charging somebody for an attempt that could
 * not have succeeded is charging them for the engine's inability to say so.
 *
 * And it names what would work, which every refusal here owes: somebody who
 * does know is what would work, and finding out who that is is the other two
 * channels' job.
 */
export function nothingToBeGotFrom(who: string, about: string): RefusalCopy {
    return {
        headline: 'They do not have it to give.',
        prose:
            `You put weight behind it, and ${who} looks at you with the particular blankness of `
            + `somebody being leaned on about a thing they have never heard of. Whatever you are `
            + `to them, it does not reach into their head and put ${about} in it. You can make a `
            + 'person talk. You cannot make them know.\n\n'
            + 'Somebody who does hold it is what you want, and finding out who that is comes off '
            + 'a name said in front of you or off your own eyes.',
        structure:
            'Refused at limit one (could they know) before the resolver ran, so no day was spent, '
            + 'no attempt was recorded and no mark was left. `compelled` is read below this test '
            + 'inside askedAbout and cannot reach it: standing moves what somebody will say and '
            + 'never what they hold.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT LEANING ON THEM COST, WHICHEVER WAY IT WENT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The sentence that makes a demand a different event from an ask.
 *
 * One line, always said, on every outcome. It is not a second penalty - the
 * resolver's marks are the penalty and they are already written - it is the
 * player being able to see what the marks are for.
 *
 * The four cases are the resolver's four outcomes crossed with the one thing
 * this module knows that it does not, and the case worth reading is the last:
 * leaning on somebody who was going to answer anyway costs everything a failed
 * demand costs and buys a thing that was free.
 */
export function whatLeaningOnThemCost(
    who: string,
    standing: WhatStandsInTheWay,
    result: AttemptResult
): { lines: string[]; structure: string[] } {
    if (standing === 'they_were_going_to_say_it') {
        return {
            lines: [
                `${who} would have told you if you had asked. You did not ask, and they have `
                + 'noticed which of the two you thought was necessary.'
            ],
            structure: [
                'Demand against a willing speaker: the answer was reachable at `a_courtesy` and '
                + 'was bought at `against_their_interest`. The attempt still resolved and still '
                + 'left its marks, which is the whole of the cost.'
            ]
        };
    }

    if (result.outcome === 'taken' || result.outcome === 'turned') {
        return {
            lines: [
                `${who} answers because the alternative was worse, and both of you know which `
                + 'of those it was. It is not a thing they will forget having done.'
            ],
            structure: [
                `Compelled answer: resolveAttempt returned ${result.outcome} at odds `
                + `${result.odds.toFixed(2)}, and askedAbout was re-read with compelled=true, so `
                + 'limit two did not bite. The knowledge write is the ordinary one.'
            ]
        };
    }

    return {
        lines: [
            `${who} declines, and the declining is the part that will be remembered. You have `
            + 'said out loud what you believe you are worth here, and been told otherwise, and '
            + 'there were people in the room.'
        ],
        structure: [
            `Refused demand: resolveAttempt returned ${result.outcome} at odds `
            + `${result.odds.toFixed(2)}. Different from a refused ASK, which costs a day - a `
            + 'refused demand additionally leaves the marks the resolver wrote, because standing '
            + 'was claimed in public and not conceded.'
        ]
    };
}
