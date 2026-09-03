/**
 * How somebody asks what they have.
 *
 * The most basic question in any roleplaying game, and the one this parser was
 * worst at. Played at Dragonvein Rock on a fresh build, with a model narrating:
 *
 *     > how much do I have left?
 *     "The thought does not resolve."
 *     > how many spirit stones do I have?
 *     "You turn the thought over, searching for a tally, but the numbers do
 *      not come."
 *
 * The number was on the screen at the time, in the sheet panel beside the
 * prose. `inventory` reads it, prints it, and had no line in the table for the
 * way the player asked.
 *
 * ── WHY THE PHRASINGS LIVE HERE RATHER THAN IN THE TABLE ─────────────────
 *
 * Same arrangement as `sect-phrasings.ts`, `site-phrasings.ts` and
 * `match-phrasings.ts`: the words a verb answers to are that verb's business,
 * and `verb-pattern-table.ts` keeps the ORDER. One predicate call in the table,
 * and every phrasing question is settled in one file that says which sentences
 * it deliberately leaves alone.
 *
 * ── AND WHY THE MONEY WORDS ARE HERE ─────────────────────────────────────
 *
 * {@link NAMES_STONES} was written for `give` - "I give her my purse" has to
 * know that a purse is not a thing in the pouch - and it is the same list twice
 * if this file writes its own. Two enumerations of how people name money is the
 * defect this repository repeats most, so `handing-somebody-a-thing.ts` imports
 * it from here. The direction is the natural one: money is a thing you have,
 * and giving it away is one thing you can do with it.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT REACH ────────────────────────────────
 *
 * A near-miss is worse than a refusal. A player who is told "the thought does
 * not resolve" knows they were not understood; a player answered confidently
 * about the wrong thing learns something false. So every rule here requires the
 * FIRST PERSON and either a money word or no other noun at all, and these stay
 * where they are:
 *
 *   how much does it cost / how much is the manual   -> `market`, a price
 *   how much do they want for it                     -> `market`
 *   how much do I know about him                     -> `recall`
 *   how much time / qi / life do I have left         -> not this verb
 *   how many years do I have left                    -> `status`
 *   I give her my spirit stones                      -> `give`
 *   I want stones for what I am carrying             -> `sell`
 *   I take stock of a life that has gone nowhere     -> a man and his life
 *
 * The three that are checked by test rather than by reading are the last
 * three: each contains both a money word and a first-person carrying phrase,
 * and each belongs to a different verb.
 *
 * ── THE ONE GENUINE AMBIGUITY, AND WHERE THE LINE IS DRAWN ───────────────
 *
 * "how much do I have left" has two readings in a cultivation game: the purse,
 * and the years. It is routed to the purse, on the evidence of the sentence
 * rather than a coin toss - every lifespan phrasing this game has ever been
 * asked names its noun ("how much TIME", "how many YEARS", "how much LONGER"),
 * and a bare quantity with no noun at all is money in every register English
 * has. {@link ASKED_AS_A_BARE_QUANTITY} therefore fires only when nothing sits
 * between the quantifier and the having, which is what keeps the lifespan
 * family out by construction rather than by a veto list that would go stale.
 */

/**
 * Whether the words name the purse rather than a thing in the pouch.
 *
 * Moved here from `handing-somebody-a-thing.ts`, unchanged, and still read
 * there. It is applied to two different spans by its two callers - `give`
 * tests the noun phrase the player named, this file tests the whole sentence -
 * which is why it is a bare alternation with no anchors in it.
 */
export const NAMES_STONES = /\b(?:spirit\s+)?stones?\b|\bcoin\b|\bmoney\b|\bpurse\b|\bmy purse\b/i;

/** The money words again, as a fragment, for building the rules below. */
const MONEY = '(?:(?:spirit\\s+)?stones?|coins?|money|cash|purse|wealth)';

/** A container a person carries, by every name the game and its players use. */
const CARRIED = '(?:inventory|pouch|pouches|bag|bags|pack|packs|purse|purses|pockets?|belongings|possessions)';

/**
 * Opening the thing up and looking, by every verb somebody uses for it.
 *
 * Required in front of a container name, so that a sentence merely MENTIONING
 * a pouch is not a question about one. The rule this file replaces did not ask
 * for a verb, which is how a bare "Shen Liefeng my purse" came to read as
 * somebody asking what they had.
 */
const LOOKED_INTO =
    '(?:check|checks|see|look at|look in|look inside|look through|show|list|open|empty|'
    + 'search|go through|going through|rummage in|rummage through|count|count out|turn out)';

/** Saying that the having is yours: the first person, in every tense people use. */
const I_HAVE = '(?:do i have|have i got|has i got|do i carry|am i carrying|i am carrying|i have got|i have|i carry|i hold|am i holding)';

/**
 * A quantity asked with no noun in it at all.
 *
 * The whole rule is the ABSENCE between the quantifier and the having. "how
 * much do I have" fires; "how much TIME do I have" does not, and neither does
 * any other resource this game might one day count, without anybody having to
 * remember to add it to a veto list.
 *
 * `left` is allowed through because it is not a noun - it is the same question
 * asked by somebody who has been spending.
 */
const ASKED_AS_A_BARE_QUANTITY =
    /\bhow (?:much|many)\s+(?:do i (?:have|carry)|have i got|am i carrying|i(?:'ve| have) got)\b/;

/**
 * "how much do I have to pay", which is a price and not a purse.
 *
 * The only sentence the bare-quantity rule above gets wrong, because "have to"
 * is a modal wearing the having verb's clothes. "how much do I have to spend"
 * is left alone: that one really is the purse.
 */
const HAVING_TO_PART_WITH_IT =
    /\bhave to (?:pay|give|hand|offer|put down|part with|find|come up with)\b/;

/**
 * The sentence is an act of handing something over, not a question about it.
 *
 * `give` and `sell` sit below this branch in the table, so without this a
 * sentence naming money and the first person would be answered with a pouch
 * listing instead of moving anything.
 */
const HANDING_IT_OVER =
    /\b(?:i (?:give|gave|hand|handed|offer|offered|pay|paid|spend|spent|sell|sold|put down|part with|count out)|giving|handing|paying|selling)\b/;

/** Every way of asking, checked in no particular order because none of them overlap. */
const ASKING_WHAT_I_HAVE: readonly RegExp[] = [
    // ── the phrasings that already worked, unchanged ──────────────────────
    //
    // Carried over verbatim from the inline rule in `verb-pattern-table.ts`,
    // with `purse`, `purses` and `pockets` added to the container list. Those
    // three were the only names of a carried container the rule did not know,
    // and `purse` is the one the game itself prints: the inventory read ends
    // "N spirit stones in the purse", and typing that word back reached the
    // bequest-counter lecture. Any name the game prints is a name it must
    // accept.
    //
    // ── AND WHY THE BARE ONE IS ANCHORED TO THE WHOLE LINE ────────────────
    //
    // The rule this replaces read `my (inventory|pouch|bag|pack|...)` anywhere
    // in the sentence, and adding `purse` to that list broke
    // `forcing-an-attempt-to-land.test.ts`: `ADMIN force give Shen Liefeng my
    // purse` decides whether to keep the operator's word by asking whether the
    // REMAINDER reaches a verb on its own, and "Shen Liefeng my purse" started
    // reaching this one. A fragment naming a recipient and a thing is not
    // somebody asking what they have.
    //
    // So the bare form has to BE the line - "my purse", and nothing else - and
    // every other way of naming the container carries a verb of looking with
    // it. That is stricter than the rule it replaces and it loses nothing:
    // `LOOKED_INTO` covers the sentences the loose version was really there
    // for, by name rather than by accident.
    new RegExp(`^(?:just |only )?my ${CARRIED}\\s*[?.!]*$`),
    /\bwhat am i carrying\b/,
    /\bwhat do i (?:have|carry)\b/,
    new RegExp(`\\b(?:what(?:'s| is| was)?|anything|something) (?:in|inside|left in) (?:my|the) ${CARRIED}\\b`),
    new RegExp(`\\b${LOOKED_INTO} (?:me )?(?:my |the )?${CARRIED}\\b`),
    /\bcheck (?:my |the )?(?:stones?|spirit stones?|purse)\b/,
    /\bturn out (?:my )?(?:pouch|purse|pockets)\b/,
    /\bcount (?:my|the) (?:stones?|spirit stones?|coins?|money|things|belongings)\b/,
    /\b(?:check|see) what i (?:am|'m) carrying\b/,

    // ── what am I holding ─────────────────────────────────────────────────
    //
    // Named in `turn-engine.ts`'s own account of this defect as one of the
    // three sentences that were tried and answered "Nothing in the pouch at
    // all" - and it never reached the verb at all. A rated object is the thing
    // somebody asking this usually means, and the read lists those.
    //
    // `on me` is spelled out separately from the bare form because `on` is the
    // word `recall` uses for dirt on a person - "what have I got on him" - and
    // the table's knowledge patterns are vetoed on exactly `me` and `myself`
    // for the same reason. Two halves of one line, and they have to agree.
    /\bwhat (?:am i holding|do i hold|have i got|do i have) on (?:me|myself)\b/,
    /\bwhat (?:am i holding|do i hold|have i got)\b(?!\s+(?:of|about|on)\b)/,

    // ── the quantity family, which is how the defect was played ───────────
    ASKED_AS_A_BARE_QUANTITY,

    // A quantity, a money word, and the first person. Either order, because
    // "how many stones do I have" and "do I have any stones" are the same
    // question and people type both.
    new RegExp(`\\b(?:how (?:much|many)|what|which)\\b[^.?!]*\\b${MONEY}\\b[^.?!]*\\b${I_HAVE}\\b`),
    new RegExp(`\\b${I_HAVE}\\b[^.?!]*\\b(?:any |enough |the |my )?${MONEY}\\b`),

    // "how much is in my purse", "what is left in the purse". The container is
    // required: "how much is left" on its own names nothing and stays where it
    // is.
    new RegExp(`\\bhow much is (?:in|left in) (?:my|the) ${CARRIED}\\b`),
    new RegExp(`\\bhow(?:'s| is) (?:my|the) ${CARRIED}\\b`),

    // ── am I broke ────────────────────────────────────────────────────────
    //
    // The same question asked about the answer rather than the number. It is a
    // free read either way, so answering it with the purse costs the player
    // nothing even when they meant it rhetorically.
    /\bam i (?:broke|skint|penniless|destitute|poor|rich|out of (?:money|coin|stones|spirit stones))\b/,
    /\bhow (?:rich|poor|broke) am i\b/,
    /\bam i carrying (?:anything|any)\b/,

    // "can I afford it", with nothing named. Where a THING is named - "can I
    // afford the manual" - the question is that thing's price and belongs to
    // `market`, which does not reach it today either; that gap is market's and
    // is deliberately not closed here.
    /\b(?:can|could) i afford (?:it|that|this|them|anything|one)\b(?!\s+\w)/,
    /\bdo i have enough\b(?!\s+(?:\w))/
];

/**
 * The words that narrow the question to what is physically on the person.
 *
 * ── THE TWO QUESTIONS, AND WHY THEY ARE NOT THE SAME ONE ─────────────────
 *
 * Ruled by the design owner: **a human DM answers "what do I have" with "on
 * you, this; in the vault, that."** They do not answer "nothing, technically"
 * and wait to be asked a second question. So `what do I have` reaches
 * everything the player owns, with the location attached, and goods lodged with
 * a custody house or buried in the ground are named.
 *
 * `what am I carrying` stays strictly what is on the body, because that
 * phrasing genuinely means something narrower and preserving the distinction is
 * better than flattening it. A player who asks the narrow question and is told
 * about a vault three provinces away has been answered about something
 * adjacent - which is the failure this whole file exists to stop, pointed the
 * other way.
 *
 * ── THE RULE IS THE ABSENCE, NOT A LIST ──────────────────────────────────
 *
 * Wide by default; narrowed only where the sentence names the BODY or a
 * container ON it. That way a phrasing added tomorrow gets the fuller answer
 * unless somebody deliberately says it is about the pouch, and the failure mode
 * of forgetting to think about it is the honest one rather than the misleading
 * one.
 */
const ABOUT_THE_BODY = new RegExp(
    `\\b(?:carrying|carry|holding|hold|on me|on myself|on my person|`
    + `(?:in|inside|left in|through) (?:my|the) ${CARRIED}|`
    + `${LOOKED_INTO} (?:me )?(?:my |the )?${CARRIED}|`
    + `my ${CARRIED})\\b`
);

/**
 * Which of the two questions was asked, or null for neither.
 *
 * Read off the RAW INPUT by the handler rather than carried in an `intent`,
 * and that is deliberate: `legacyAct` takes the one thing a player has to get
 * exactly right off the typed sentence for the same reason, because a model
 * asked to fill a field paraphrases. Which question was asked is a property of
 * the words, and this file is where the words live.
 */
export type WhatWasAskedAfter = 'on the body' | 'everything owned';

export function whichHavingWasAskedAbout(text: string): WhatWasAskedAfter | null {
    if (!asksWhatYouAreCarrying(text)) return null;
    return ABOUT_THE_BODY.test(text) ? 'on the body' : 'everything owned';
}

/**
 * Whether this sentence is somebody asking what they have.
 *
 * Takes the lower-cased text the table works in. Returns a boolean and nothing
 * else: this verb has no target, no topic and no argument, which is what makes
 * it safe to put a wide question family behind one call.
 */
export function asksWhatYouAreCarrying(text: string): boolean {
    // "I take stock of a life that has gone nowhere in forty years" is carried
    // by `misparse.test.ts` and is a man looking at his own life, not at his
    // pockets. It is kept out by absence rather than by a veto - "take stock"
    // is simply not a phrasing here - and this comment survives from the
    // original rule so that nobody adds it back.
    if (HANDING_IT_OVER.test(text)) return false;
    if (HAVING_TO_PART_WITH_IT.test(text)) return false;
    return ASKING_WHAT_I_HAVE.some(pattern => pattern.test(text));
}
