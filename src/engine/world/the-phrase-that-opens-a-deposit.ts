/**
 * The form of words a deposit is opened with, and why the engine must not be
 * able to produce it.
 *
 * This is the one secret in the game that is kept from the ENGINE rather than
 * from the character. Everything else a player might want to carry across a
 * death - a rung, a technique, a name, a grudge - is state, and state is
 * exactly what a death is supposed to end. A phrase is different because it was
 * never in the database in the first place: the player typed it, and the player
 * is the only party who can type it again in eighty years of in-world time and
 * a fortnight of real ones.
 *
 * ── The rule ─────────────────────────────────────────────────────────────
 *
 * The plaintext is never persisted, never returned, never logged, and never
 * placed in an `EngineFacts` line, a `structure` line or a narration prompt.
 * What is stored is a one-way digest, and the only operation available against
 * it is "does this string produce the same digest". `sealPhrase` returns a
 * `SealedPhrase` whose only field is the digest; there is deliberately no
 * function in this module that takes a `SealedPhrase` and returns anything
 * resembling a word.
 *
 * That is not security theatre against an attacker. The player owns the
 * database and can read the whole thing, and if they want to grep for their own
 * phrase they are welcome to and it will not be there. The property being
 * protected is the FUN: a phrase the game will hand back on request is not a
 * thing the player has to remember, and remembering it is the entire mechanic.
 *
 * ── Being kind about typing ──────────────────────────────────────────────
 *
 * A phrase that fails on a capital letter is not a memory test, it is a typing
 * test, and it makes the feature feel broken rather than tense. So the digest
 * is taken over a normalised form: lower case, punctuation dropped, runs of
 * whitespace collapsed. "The Third Stone, By The Ford." and "the third stone by
 * the ford" are the same phrase, and the counter says so at the moment the
 * deposit is made, because a player who does not know that will hedge.
 *
 * What normalisation does NOT do is reorder, stem, or fuzzy-match. "the ford by
 * the third stone" is a different phrase and is refused, and that is correct:
 * the words in order are what was agreed.
 *
 * ── Getting it wrong ─────────────────────────────────────────────────────
 *
 * A wrong phrase is not free, and how expensive it is depends on the house.
 * `CustodyTerms.attemptsAllowed` is the count, and it is small at the houses
 * that keep books and generous at the ones that do not - which is the trade
 * stated as a rule rather than as flavour. Running out does not lose the goods
 * to nobody; it closes the entry against this claimant, and at a
 * record-keeping house the entry is marked contested, which means the next
 * person with the right words is refused too. A fraud who guesses badly enough
 * destroys the thing for the person who could have collected it.
 *
 * {@link hintFor} implements the counter's limit and cannot say anything else: it is handed
 * the record and never the phrase, so there is nothing in scope for it to leak.
 */

import { createHash } from 'crypto';

/**
 * The shortest phrase a house will write against an entry.
 *
 * Two characters is a typo and one word is a thing somebody guesses on the
 * fourth attempt. The floor is stated in characters rather than words because a
 * player who wants one long unusual word should be allowed one.
 */
export const SHORTEST_PHRASE_CHARACTERS = 6;

/** The longest a clerk will write down. A paragraph is not a phrase. */
export const LONGEST_PHRASE_CHARACTERS = 200;

/**
 * The stored form. One field, on purpose: there is nothing else here to leak,
 * and adding a `wordCount` to this object would put a fact about the phrase in
 * the same place as the digest, which is where it would eventually be read out
 * by something that thought it was being helpful.
 *
 * The word count IS recorded - a clerk counts words writing them down - but it
 * is recorded against the ENTRY, beside the day and the term, and not here.
 */
export interface SealedPhrase {
    /** Hex digest. Never reversed, never displayed, never narrated. */
    digest: string;
}

/**
 * Lower case, punctuation dropped, whitespace collapsed, ends trimmed.
 *
 * Exported because the deposit counter has to tell the player exactly what will
 * and will not matter, and the honest way to do that is to run the same
 * function and show them what was recorded. Showing them the normalised form of
 * their OWN phrase, once, at the moment they type it, is not a leak: they are
 * the person who typed it.
 */
export function normalisePhrase(phrase: string): string {
    return phrase
        .toLowerCase()
        // Anything that is not a letter, a digit or whitespace goes. Unicode
        // letters are kept, because a player is entitled to a phrase in their
        // own script and dropping it would be a silent corruption.
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Words a clerk would count, off the normalised form. */
export function wordCountOf(phrase: string): number {
    const normalised = normalisePhrase(phrase);
    return normalised.length === 0 ? 0 : normalised.split(' ').length;
}

export type PhraseRejection = 'too_short' | 'too_long';

/** Whether a house will write this down at all. */
export function phraseIsWritable(phrase: string): PhraseRejection | null {
    const normalised = normalisePhrase(phrase);
    if (normalised.length < SHORTEST_PHRASE_CHARACTERS) return 'too_short';
    if (normalised.length > LONGEST_PHRASE_CHARACTERS) return 'too_long';
    return null;
}

/**
 * Seal a phrase against one entry.
 *
 * The entry id is mixed in, so two entries opened with the same words do not
 * carry the same digest and a player cannot discover that they reused a phrase
 * by comparing two rows. It also means a digest lifted from one entry cannot be
 * pasted into another.
 */
export function sealPhrase(entryId: string, phrase: string): SealedPhrase {
    return {
        digest: createHash('sha256')
            .update(`cultivation-deposit${entryId}${normalisePhrase(phrase)}`)
            .digest('hex')
    };
}

/** Whether these words open that entry. The only question askable of a seal. */
export function phraseOpens(sealed: SealedPhrase, entryId: string, attempt: string): boolean {
    return sealPhrase(entryId, attempt).digest === sealed.digest;
}

// ─────────────────────────────────────────────────────────────────────────
// THE COUNTER'S SIDE
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a house records about an entry, as distinct from what it records about
 * the phrase. Every field here is something a clerk writing in a book would
 * have in front of them, and none of it narrows the words.
 */
export interface EntryFacts {
    /** Words agreed, counted when it was written down. */
    wordCount: number;
    /** World day the entry was lodged. */
    lodgedOnDay: number;
    /** Years the term was paid for. */
    termYears: number;
    /** Wrong phrases already heard against this entry. */
    wrongAttempts: number;
    /** What this house allows before it closes the entry. */
    attemptsAllowed: number;
    /** Whether this house has a book to read any of the above out of. */
    keepsWrittenRecord: boolean;
}

export interface Hint {
    /** Lines the clerk actually says. Never any part of the phrase. */
    lines: string[];
    attemptsLeft: number;
    /** True once the entry is closed against this claimant for good. */
    closed: boolean;
}

/**
 * What the counter says to somebody who got it wrong.
 *
 * Takes `EntryFacts` and not the phrase, so there is physically nothing in
 * scope that could be leaked by a careless edit here later. That is the design:
 * the guarantee is enforced by what this function can see rather than by
 * remembering not to say it.
 */
export function hintFor(entry: EntryFacts): Hint {
    const left = Math.max(0, entry.attemptsAllowed - entry.wrongAttempts);
    const closed = left <= 0;
    const lines: string[] = [];

    if (entry.keepsWrittenRecord) {
        lines.push(
            `The entry was lodged on day ${Math.floor(entry.lodgedOnDay)} and the term written was ${entry.termYears} years.`
        );
        lines.push(
            entry.wordCount === 1
                ? 'One word was agreed.'
                : `${entry.wordCount} words were agreed, in that order.`
        );
    } else {
        lines.push(
            'There is no book to consult. Nobody here can tell you the day, the term or how many words were agreed, because nobody wrote any of it down anywhere they can reach.'
        );
    }

    lines.push(
        closed
            ? 'That was the last attempt this house will hear. The entry is closed and will not be reopened for you or for anybody else who comes asking about it.'
            : left === 1
                ? 'One attempt remains.'
                : `${left} attempts remain.`
    );

    return { lines, attemptsLeft: left, closed };
}

/**
 * The line a house says at the moment a phrase is agreed.
 *
 * Shows the player their own normalised phrase back, once, so they know exactly
 * what has to come out of their mouth in a hundred years. This is the only
 * place in the whole feature where a phrase appears in output, it happens while
 * the player is looking at what they just typed, and it never happens again.
 */
export function whatWasWrittenDown(phrase: string): string {
    const normalised = normalisePhrase(phrase);
    const words = wordCountOf(phrase);
    return (
        `Written against the entry, in ${words === 1 ? 'one word' : `${words} words`}: "${normalised}". `
        + 'Capitals and punctuation are not written down and will not be asked for. The words themselves '
        + 'will be, in that order, and there is no other way to open it. Nobody in this house will ever '
        + 'tell them to you, including if you ask them tomorrow.'
    );
}
