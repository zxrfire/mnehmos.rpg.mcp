/**
 * The clause after *or I will*, and which of the world's wrongs it promises.
 *
 * The design owner: *"coerce isn't necessarily an action, you could coerce
 * someone too: tell me or i'll soul search. for info"* - a demand for
 * information with an act promised behind it, which is neither an attack nor a
 * bare interrogation and reached neither.
 *
 * ── IT IS THE READ `WRONG_BEHIND_INTENT` ONLY HAD ONE DIRECTION OF ────────
 *
 * The engine could answer *given this act, what wrong does it carry* and could
 * not answer *given these words, what wrong is being promised*. Same table of
 * wrongs, read backwards, which is what AGENTS.md asks of any one-way read.
 *
 * So the SET of things that can be promised is `Wrong` - the eight the world
 * can already price - and never a list of threatenable acts. A promise this
 * file does not recognise is still a promise and lands on `threatened`, which
 * is the floor and is priced like everything else. A ninth phrasing needs no
 * code; a ninth KIND of harm is a row in `SHAPE_OF` and this follows it.
 *
 * How heavy each one is is not decided here. `severityOfTheWrong` derives that
 * from the shape of the wrong, so a promised soul search outweighs a promised
 * shove because one of them cannot be given back - and nothing anywhere knows
 * what a soul search is.
 */

import type { ThePromiseYouMade } from '../engine/social-leverage/index.js';
import type { Wrong } from '../engine/social-leverage/index.js';

/**
 * Where a sentence stops asking and starts promising.
 *
 * The promise has to be CONDITIONAL on the refusal - `or`, `or else`,
 * `otherwise` - because a sentence that merely mentions harm is not offering it
 * as the reason to comply, and that distinction is the whole of what `force`
 * means in `ApproachLeverage`.
 */
const WHERE_THE_PROMISE_STARTS =
    /\b(?:or\s+else\b|or\s+(?:i|we)(?:'ll|'m going to| will| shall| am going to)\b|otherwise\s+(?:i|we)(?:'ll| will)\b)/i;

/**
 * What each of the world's wrongs sounds like when it is promised rather than
 * done. Ordered worst-first: a sentence that says both is promising the worse.
 *
 * Every row is a phrasing somebody would actually type, per the verb corpus's
 * own three rules. Nothing here decides how heavy a wrong is.
 */
const WHAT_IS_BEING_PROMISED: ReadonlyArray<readonly [Wrong, RegExp]> = [
    ['killed', /\b(?:kill|end|finish|put (?:you|him|her|them) down|cut (?:you|him|her|them) down|bury|have (?:your|his|her|their) head|leave (?:you|him|her|them) (?:here )?dead)\b/i],
    // Everything that takes something out of a person and does not give it
    // back: the soul, the core, the channels they cultivate with. Nothing
    // below knows which of those it is looking at.
    ['violated', /\b(?:soul[- ]?search|search (?:your|his|her|their) soul|read (?:your|his|her|their) (?:soul|mind|memories)|take (?:your|his|her|their) (?:core|soul|memories|nascent soul)|tear (?:it|the truth) out of (?:you|him|her|them)|cripple|break (?:your|his|her|their) (?:core|dantian|channels|meridians)|geld|unmake)\b/i],
    ['interfered_with_a_crossing', /\b(?:(?:interrupt|break|spoil|ruin|come for)\s+(?:you|him|her|them)?\s*(?:in|during|at|on)?\s*(?:your|his|her|their)?\s*(?:crossing|tribulation|breakthrough|barrier)|be there when (?:you|he|she|they) cross)\b/i],
    ['wounded', /\b(?:break (?:your|his|her|their)|hurt|wound|injure|maim|cut|stab|beat|thrash|flog|put a (?:knife|blade|sword) (?:in|through)|open (?:you|him|her|them) up|take (?:your|his|her|their) (?:arm|hand|leg|eye|ear|tongue))\b/i],
    ['robbed', /\b(?:take (?:it|everything|the lot|what)|strip|rob|help myself|empty (?:your|his|her|their) (?:purse|pockets|pouch)|leave (?:you|him|her|them) with nothing)\b/i]
];

export interface AThreatBehindAnAsk {
    /** The wrong promised, for `whatYouBringToBear` and the resolver. */
    readonly promised: ThePromiseYouMade;
    /** The clause, verbatim and capped, for the mechanical channel. */
    readonly said: string;
    /** The sentence with the promise taken off, for the ordinary readers. */
    readonly withoutThePromise: string;
}

/**
 * The promise a sentence makes if it is refused, or null when it makes none.
 *
 * `threatened` is the floor and not a failure: force offered as the reason to
 * comply is itself one of the wrongs the world prices, so a promise nobody
 * wrote a phrasing for still weighs what a bare threat weighs.
 */
export function whatAThreatPromises(input: string): AThreatBehindAnAsk | null {
    const at = WHERE_THE_PROMISE_STARTS.exec(input);
    if (!at) return null;

    const before = input.slice(0, at.index).replace(/[,;\s]+$/, '').trim();
    const clause = input.slice(at.index).trim();
    if (before.length < 2 || clause.length < 4) return null;

    const wrong = WHAT_IS_BEING_PROMISED.find(([, pattern]) => pattern.test(clause))?.[0]
        ?? 'threatened';

    return {
        promised: { wrong },
        said: clause.slice(0, 160),
        withoutThePromise: before
    };
}
