/**
 * The sentence that carries news of a wrong to the person it was done to.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE GAP THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `hearing-of-a-wrong.ts` is the receiving half and it works: being told opens
 * the account, dated to the day you were told, at the deed's own weight, against
 * whoever the telling named. Its live caller was `news` - a square repeating
 * something in front of the player.
 *
 * The other direction had no sentence at all. Measured on the deterministic
 * reader before this existed:
 *
 *   "I tell him that Cao Antao killed his brother"
 *       -> interact(target="him that Cao Antao killed his brother", intent=talk)
 *   "I tell her that Cao Antao stole from her"
 *       -> interact(target="her that Cao Antao stole from her", intent=steal,
 *                   leverage=force)
 *
 * The first swallowed the whole proposition into a party name and answered with
 * a shrug. The second is worse: the reader saw `stole` and routed a TELLING
 * ABOUT A THEFT as the player committing one, against the person they were
 * warning - an attempt intent that spends a day and reaches `resolveAttempt`.
 *
 * So the act existed in the world, an NPC could receive it, and the player could
 * not perform it. AGENTS.md, *if an NPC can do it, you can*.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE DECIDES AND WHAT IT REFUSES TO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * It decides that a sentence is a telling, who it is addressed to, and which
 * words in it are being offered as the name of whoever did it. That is reading.
 *
 * IT VERIFIES NOTHING. The name the player used is handed on exactly as typed,
 * whether or not that person did it, whether or not anybody did anything, and
 * whether or not the player has any grounds at all. AGENTS.md, *the parser names
 * the act, the engine is the one that says no* - and `hearing-of-a-wrong.ts` is
 * explicit that a hearer who could tell a true telling from a false one would
 * need the omniscient view the whole knowledge layer exists to deny.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THREE CUTS, AND EACH ONE IS A SENTENCE THIS DELIBERATELY DOES NOT TAKE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * THE ADDRESSEE IS NOT THE ASKER. "tell me about X" is the plainest question in
 * the language and it already reaches `investigate`; every pattern here requires
 * a second party, so none of them can move it. That is the same discriminator
 * the table's own `tell me about` block uses, applied from the other side.
 *
 * THE WRONG IS IN THE PAST. A telling is about something that has already
 * happened; a threat is about something that has not. So the clause words are
 * past-tense wrongs - killed, betrayed, is dead - and nothing here matches a
 * promise of harm. This is why `warn` is absent from the verbs: *"I warn him
 * that Cao Antao killed his brother"* and *"I warn him that I will break his
 * arm"* open with the same five words, and AGENTS.md's rule for a phrasing that
 * is ambiguous by nature is that the table leaves it alone and lets a reading
 * tier that can see the situation have it.
 *
 * IT MUST NAME A WRONG, NOT A SUBJECT. "I tell him about his brother" carries no
 * claim that anything was done, so it stays where it was. The narrowing is
 * AGENTS.md's *fix the gap that was demonstrated*: what was demonstrated is a
 * player reporting a deed, and widening this to any sentence naming a person
 * would take `interact`'s ordinary conversation with it.
 *
 * Pure. No state, no world, no I/O - which is why it is separate from
 * `what-a-telling-lands-on.ts`, the half that reads the world.
 */

/**
 * A telling, as the sentence gives it.
 *
 * Every field is words the player typed. Nothing here is an id and nothing here
 * has been checked against anything.
 */
export interface ATelling {
    /**
     * Who is being told, as they were named or pointed at.
     *
     * Never empty. A telling that reaches nobody is not a telling, and this
     * module returns null rather than guessing who was meant - the caller
     * resolves a pointing phrase ("him", "the elder") the same way every other
     * approach resolves one.
     */
    person: string;
    /**
     * What is being said, verbatim and capped.
     *
     * Carried onto the record and echoed back in the answer, so the player is
     * told what landed in the terms they said it in. Read by no conditional
     * except the one below that looks for a name in it.
     */
    claim: string;
}

// ─────────────────────────────────────────────────────────────────────────
// THE WORDS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The words that say a wrong was done, in the past.
 *
 * Deliberately past tense and deliberately narrow. Every entry is a word that
 * can only report a deed: `took`, `beat` and `struck` were drafted and dropped
 * because each of them opens as many ordinary sentences as wrongs - *"I tell him
 * that I took the north road"* - and a pattern that steals ordinary conversation
 * from `interact` is worse than no pattern at all.
 *
 * The state forms - `is dead`, `died` - are here because they are how somebody
 * actually says it, and neither of them names a doer. That is not a gap: it is
 * the middle state `hearing-of-a-wrong.ts` exists for, an open account with
 * nobody's name on it.
 *
 * Nothing about a FUTURE harm is here. See the header.
 */
const SOMEBODY_DID_IT =
    String.raw`killed|kills|murdered|murders|slew|slain|had\s+\S+\s+killed`
    + String.raw`|stole|steals|robbed|robs|poisoned|poisons|framed`
    + String.raw`|betrayed|betrays|sold\s+(?:him|her|them|you)\s+out|informed\s+on`;

/**
 * The forms that report the same wrongs with NOBODY in the subject.
 *
 * Split from the list above because of what {@link whoTheClaimBlames} does with
 * each. Under an active verb the words in front are the doer. Under `is dead`
 * the words in front are the person it was DONE TO, and under a bare noun -
 * *"the killing"*, *"his brother's death"* - the words in front are not a party
 * at all. Both were measured reading a name out of the wrong slot: *"his brother
 * is dead"* offered `his brother` as the killer, and *"the killing"* offered
 * `the`. A telling in one of these forms names no doer, and that is the correct
 * answer rather than a gap - it is the account with no name on it.
 */
const NOBODY_IS_NAMED_FOR_IT =
    String.raw`is\s+dead|are\s+dead|was\s+killed|were\s+killed|died|is\s+missing`
    + String.raw`|what\s+happened\s+to|who\s+killed|who\s+did\s+it|who\s+was\s+behind`
    + String.raw`|death|murder|killing|theft|robbery|betrayal`;

const A_WRONG_WAS_DONE = new RegExp(
    String.raw`\b(?:${SOMEBODY_DID_IT}|${NOBODY_IS_NAMED_FOR_IT})\b`, 'i'
);

/** Only the forms with a doer in front of them. See the note above. */
const A_DOER_IS_NAMED = new RegExp(String.raw`\b(?:${SOMEBODY_DID_IT})\b`, 'i');

/**
 * The addressees a telling cannot have.
 *
 * The asker, first and above all - "tell me about the Hollow Court" is a
 * question, and reaching it from here would be this repo's commonest parser
 * defect: a widened pattern stealing the verb next door. The rest are here
 * because a telling is put to one person who can then hold something;
 * announcing it to a square is a different act with nobody at the end of it,
 * and there is no verb for that yet.
 */
const NOT_AN_ADDRESSEE =
    /^(?:me|myself|us|ourselves|everyone|everybody|anyone|anybody|someone|somebody|people|the (?:crowd|square|room|world|others)|nobody|no one)$/i;

/**
 * Where the addressee stops and the claim starts.
 *
 * Two shapes in one pattern, and the difference is whether the pivot word
 * belongs to the claim. `that` and `about` are pure hinges and are dropped;
 * a bare wh-word IS the claim's first word - "I tell him who killed his
 * brother" - so the split lands in front of it and keeps it.
 */
const WHERE_THE_CLAIM_STARTS =
    /\s+(?:(?:that|about|of|regarding|concerning)\s+|(?=(?:who|what|how|why)\b))/i;

/** The head of a plain telling. `let X know` is a different shape; see below. */
const A_TELLING = new RegExp(
    String.raw`^\s*(?:i\s+|i'?ll\s+|i\s+will\s+|i\s+want\s+to\s+|i\s+am\s+going\s+to\s+|let\s+me\s+)?`
    + String.raw`(?:tells?|telling|informs?|informing)\s+(.+)$`,
    'i'
);

/**
 * "I let He Peiyi know that ...", which puts the addressee inside the verb.
 *
 * Its own pattern rather than an alternation inside the one above, because the
 * name sits between two halves of the verb and a name in this world is two words
 * as often as one. Folded in, `let\s+\w+\s+know` matched only single-word names
 * and quietly dropped every "He Peiyi" - which is the kind of miss nothing fails
 * on.
 */
const LET_THEM_KNOW = new RegExp(
    String.raw`^\s*(?:i\s+|i'?ll\s+|i\s+will\s+|i\s+want\s+to\s+|i\s+am\s+going\s+to\s+)?`
    + String.raw`lets?\s+(.+?)\s+know\s+(.+)$`,
    'i'
);

/** The claim, cleaned of a hinge word if it arrived with one. */
function cleanClaim(raw: string): string | undefined {
    const cleaned = raw
        .replace(/^(?:that|about|of|regarding|concerning)\s+/i, '')
        .replace(/[,;:.!?]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned.length >= 3 ? cleaned.slice(0, 120) : undefined;
}

/** Leading and trailing noise the addressee collects. */
function cleanAddressee(raw: string): string | undefined {
    const cleaned = raw
        .replace(/^to\s+/i, '')
        .replace(/[,;:.!?]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (cleaned.length < 2 || NOT_AN_ADDRESSEE.test(cleaned)) return undefined;
    return cleaned.slice(0, 80);
}

// ─────────────────────────────────────────────────────────────────────────
// THE READ
// ─────────────────────────────────────────────────────────────────────────

/**
 * Whether this sentence is somebody being told that a wrong was done, and to
 * whom.
 *
 * Null for everything else, which is nearly everything: three conditions have to
 * hold together - a telling verb at the head, an addressee who is not the asker,
 * and a clause saying something was DONE. Any one of them missing and the
 * sentence goes back to the table untouched.
 */
export function whatIsBeingTold(input: string): ATelling | null {
    const trimmed = input.trim();

    const letForm = LET_THEM_KNOW.exec(trimmed);
    if (letForm !== null) {
        return assemble(letForm[1], letForm[2]);
    }

    const head = A_TELLING.exec(trimmed);
    if (head === null) return null;

    const rest = head[1];
    const split = WHERE_THE_CLAIM_STARTS.exec(rest);
    if (split === null || split.index === 0) return null;

    return assemble(rest.slice(0, split.index), rest.slice(split.index + split[0].length));
}

function assemble(rawPerson: string, rawClaim: string): ATelling | null {
    const person = cleanAddressee(rawPerson);
    if (person === undefined) return null;
    const claim = cleanClaim(rawClaim);
    if (claim === undefined) return null;
    // The whole of the narrowing, and it is checked against the CLAIM rather
    // than the whole sentence, so a wrong word sitting inside the addressee's
    // name cannot make an ordinary conversation into a telling.
    if (!A_WRONG_WAS_DONE.test(claim)) return null;
    return { person, claim };
}

/**
 * The name the claim puts it on, or null where it names nobody for it.
 *
 * Read off the subject position of the wrong verb, because that is the only
 * place a doer can be in an English sentence of this shape. Null is not a
 * degenerate case and is most of the interest: *"your brother is dead"* and
 * *"what happened to your brother"* name a loss and nobody for it, which is the
 * account with no name on it that sends its holder asking - and a name arriving
 * later attaches to that same row rather than opening a second.
 *
 * WORDS, NOT AN ID, AND UNCHECKED. The caller resolves it against the same
 * knowledge-gated party lookup every other verb uses, and if it resolves to
 * somebody who was nowhere near the deed then that is who the account opens
 * against. There is no comparison against the ledger here or anywhere on this
 * path; see the header, and `hearing-of-a-wrong.ts` for why there must not be.
 */
export function whoTheClaimBlames(claim: string): string | null {
    const at = A_DOER_IS_NAMED.exec(claim);
    if (at === null) return null;
    // Nothing in front of the verb. "Killed my brother", said flat.
    if (at.index === 0) return null;

    const before = claim
        .slice(0, at.index)
        .replace(/^(?:that|about)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (before.length < 2) {
        // One letter, and only one of them is a person: "I tell him that I
        // killed his brother" is a confession and has to reach the engine as
        // one. Everything else this short is noise.
        return /^i$/i.test(before) ? 'I' : null;
    }
    // A pronoun points at somebody the sentence never named, and in a sentence
    // of this shape the person being pointed at is the ADDRESSEE - so resolving
    // it would blame the person being told. `hearing-of-a-wrong.ts` already
    // refuses a telling that names its own hearer; refusing to guess here is
    // the same rule one step earlier, and it leaves the account with no name on
    // it, which is a true description of what the player said.
    //
    // `who` and `whoever` are here for a different reason and it matters: "I
    // tell him WHO killed his brother" is the player claiming to have the name
    // and then not saying it. Reading `who` as a name would send the engine
    // looking for a person called "who"; treating it as no name at all is the
    // truthful description of the sentence, and the answer says so and names
    // the route - say the name and it attaches to the same account.
    if (/^(?:we|you|he|she|they|it|him|her|them|who|whoever|someone|somebody|nobody|no one)$/i.test(before)) {
        return null;
    }
    return before.slice(0, 80);
}
