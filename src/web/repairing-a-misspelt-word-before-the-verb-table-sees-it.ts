/**
 * `meditat` is `meditate`. `inventroy` is `inventory`.
 *
 * The local intent parser is a table of phrase patterns, and a table is exact:
 * one wrong letter and the word the table was built to see is not there any
 * more. Measured on the thirty-eight worked phrasings that `coverage.test.ts`
 * owns, perturbed with the four typos people actually make - a dropped last
 * letter, a dropped interior letter, two adjacent letters swapped, a doubled
 * letter:
 *
 *     224 perturbations
 *     100 (44.6%) still reach the same verb
 *     107 (47.8%) reach nothing at all
 *      17 ( 7.6%) reach a DIFFERENT verb
 *
 * Nearly half of one-typo sentences cost the player a turn. That is the gap
 * this module closes, and it closes it without a model, an embedding or a
 * network call: a bounded edit distance against the parser's own vocabulary.
 *
 * ─── THE VOCABULARY IS HARVESTED, NEVER WRITTEN DOWN ─────────────────────
 *
 * A hand-kept list of the parser's words would be a second source of truth
 * beside `actions.ts`, and it would go stale the first time somebody added a
 * verb without knowing this file existed - the exact failure this repository
 * has recorded over and over. So the vocabulary is read off the patterns
 * themselves: every exported RegExp in `actions.ts`, and every RegExp inside
 * an exported array of them, contributes its literal words. A verb added
 * tomorrow is covered the moment its pattern is exported, and its author
 * never has to know this file exists.
 *
 * Regex escapes are stripped before the words are taken. Left in, a
 * word-boundary escape donates its letter to the word after it and the
 * vocabulary fills up with `bteach`, `bwhat` and `bwithout` - words nobody
 * can type, which is exactly the sort of silent nonsense a hand-written list
 * would never have exposed.
 *
 * ─── WHAT IT REFUSES TO DO ───────────────────────────────────────────────
 *
 * A wrong guess is worse than a refusal that names a way out - this build's
 * standing rule, and the reason `unclear` answers with three sentences that
 * would have worked. So the repair is deliberately timid:
 *
 *   - It only ever runs on a sentence the parser already reached NOTHING
 *     with. A sentence that parses keeps its parse untouched, so nothing this
 *     repairs can swallow the verb next door, and none of the guards that
 *     watch for that can be moved by it.
 *   - It repairs at edit distance 1 only, and only for words of five letters
 *     or more. Below that, the distance-1 neighbourhood of an English word is
 *     other English words.
 *   - It repairs only where the nearest vocabulary word is UNIQUE. Two
 *     candidates tied at distance 1 is an ambiguity, and the honest answer to
 *     an ambiguity here is the refusal the player was already getting.
 *   - It leaves capitalised words alone. Those are names - a place, a person,
 *     a house - and a name is the one thing in the sentence the parser hands
 *     to the engine verbatim. `Low Fall` repaired into a verb is a corrupted
 *     destination, not a fixed typo.
 *   - It leaves alone any word that a vocabulary word is a prefix of. The
 *     patterns carry stems - `injur`, `centur`, `practi` - so that they match
 *     inflections, and `injury` is one edit from the stem `injur`. Those
 *     words are already understood, and "repairing" one would truncate a word
 *     that was spelt correctly in the first place.
 */

import { levenshtein } from '../utils/fuzzy-enum.js';

/**
 * Edit distance that counts a swap of two adjacent letters as ONE edit.
 *
 * `src/utils/fuzzy-enum.ts` has a plain Levenshtein and it is the wrong
 * instrument here: under it `inventroy` is two edits from `inventory` and
 * falls outside a distance-1 budget entirely. That word is the design owner's
 * own worked example of what this feature is for, and it was the measured
 * result - a transposition is the one common typo plain Levenshtein prices at
 * double. Damerau's addition is the single line marked below; everything else
 * is the same matrix, so the shared utility is left where it is rather than
 * widened for one caller.
 */
export function damerauLevenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0 || b.length === 0) return levenshtein(a, b);

    const d: number[][] = [];
    for (let i = 0; i <= a.length; i++) d[i] = [i];
    for (let j = 0; j <= b.length; j++) d[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            // The transposition. Two adjacent letters typed the wrong way
            // round is one mistake, and pricing it as two is what hid
            // `inventroy`, `culitvate` and `trvael`.
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
            }
        }
    }
    return d[a.length][b.length];
}

/** Shortest word worth repairing. Below this, a typo and a word are the same thing. */
const MIN_REPAIRABLE = 5;

/** How far a repair may reach. One letter, and no further. */
const MAX_EDITS = 1;

/** Any regex escape sequence, so the escaped character never joins a word. */
const ANY_ESCAPE = new RegExp('\\\\.', 'g');

/** A run of letters, plus the apostrophes and hyphens that live inside words. */
const WORDS = new RegExp("[A-Za-z][A-Za-z'-]*", 'g');

/**
 * Every literal word an intent-parser module's exported patterns key on.
 *
 * `actions.ts` calls this with a namespace import of ITSELF, lazily, on the
 * first sentence it is asked to parse. A self-import is a live binding, so by
 * the time anybody has typed anything every pattern in that file is
 * initialised and visible here - and nothing has to be listed twice.
 */
export function harvestVocabulary(moduleNamespace: Record<string, unknown>): Set<string> {
    const words = new Set<string>();

    const takeWordsFrom = (pattern: RegExp): void => {
        const literal = pattern.source.replace(ANY_ESCAPE, ' ');
        for (const match of literal.matchAll(/[a-z]{3,}/g)) words.add(match[0]);
    };

    const walk = (value: unknown, depth: number): void => {
        if (depth > 3) return;
        if (value instanceof RegExp) { takeWordsFrom(value); return; }
        // Exported STRINGS as well as patterns. A good half of the table is
        // built by interpolating alternation fragments - `study|studies|read`
        // - which are plain strings until a RegExp is assembled from them, so
        // walking patterns alone missed the words in them. Action names come
        // through the same door: `inventory` is a verb the player types and
        // exists nowhere in this file except the enum.
        if (typeof value === 'string' && value.length <= 400) {
            for (const match of value.toLowerCase().matchAll(/[a-z]{3,}/g)) words.add(match[0]);
            return;
        }
        if (Array.isArray(value)) { for (const item of value) walk(item, depth + 1); return; }
    };

    for (const value of Object.values(moduleNamespace)) walk(value, 0);
    return words;
}

/**
 * The one vocabulary word this is a typo for, or null if that is not decidable.
 *
 * Null covers three different "no" answers on purpose - the word is already
 * understood, nothing is close enough, or two things are equally close - and
 * every one of them means the same thing to the caller: leave the sentence
 * exactly as the player typed it.
 */
export function nearestVocabularyWord(word: string, vocabulary: ReadonlySet<string>): string | null {
    if (word.length < MIN_REPAIRABLE) return null;
    if (vocabulary.has(word)) return null;

    // A stem the patterns already match. `injury` against the stem `injur` is
    // a correctly spelt word one edit from the vocabulary, and truncating it
    // would be the repair breaking a sentence that already worked.
    for (const known of vocabulary) {
        if (known.length >= 4 && word.startsWith(known)) return null;
    }

    let best: string | null = null;
    let bestDistance = MAX_EDITS + 1;
    let tied = false;

    for (const known of vocabulary) {
        // Length alone rules out most of the vocabulary without the matrix.
        if (Math.abs(known.length - word.length) > MAX_EDITS) continue;
        const distance = damerauLevenshtein(word, known);
        if (distance > MAX_EDITS) continue;
        if (distance < bestDistance) { best = known; bestDistance = distance; tied = false; }
        else if (distance === bestDistance && known !== best) tied = true;
    }

    return tied ? null : best;
}

export interface Respelling {
    /** The sentence with its misspelt words put back, or the input unchanged. */
    text: string;
    /**
     * What was changed, as `fixed -> as the player typed it`.
     *
     * ── WHY THE CALLER NEEDS THIS AND NOT JUST THE TEXT ──────────────────
     *
     * The repair cannot tell a verb word from a NAME, and it is only ever
     * looking for verb words. `I examine the stele` respells to `I examine
     * the stole` - `stele` is not in the vocabulary, `stole` is, and they are
     * one edit apart. That sentence parses on its own so the repair never
     * runs on it, but the same collision waits inside any sentence that does
     * fail, and a `target` of "stole" sends the engine looking for an object
     * that is not there. A wrong guess, in other words, and this build's rule
     * is that a wrong guess is worse than a refusal.
     *
     * So the respelt sentence chooses the VERB, and every string handed on to
     * the engine is put back into the player's own spelling with this map.
     */
    restored: ReadonlyMap<string, string>;
}

/**
 * The player's sentence with its misspelt verb words put back.
 *
 * `text` is the input by identity when nothing was repairable, so a caller can
 * compare against the input to decide whether a second parse is worth running.
 */
export function respellForTheVerbTable(input: string, vocabulary: ReadonlySet<string>): Respelling {
    const restored = new Map<string, string>();
    if (vocabulary.size === 0) return { text: input, restored };

    const openingWordAt = input.length - input.trimStart().length;

    const out = input.replace(WORDS, (token: string, offset: number) => {
        // A capital anywhere but the very first character of the sentence
        // marks a name, and a name is the one thing here that is passed to
        // the engine verbatim. Sentence case on the opening word is ordinary
        // typing, and is repaired like any other word.
        if (/[A-Z]/.test(token.slice(1))) return token;
        if (/[A-Z]/.test(token) && offset > openingWordAt) return token;

        const fixed = nearestVocabularyWord(token.toLowerCase(), vocabulary);
        if (fixed === null) return token;
        if (!restored.has(fixed)) restored.set(fixed, token);
        return fixed;
    });

    return { text: restored.size > 0 ? out : input, restored };
}

/**
 * Put the player's own spelling back into a string the parser handed on.
 *
 * Applied to `target` and `topic`, which are the fields that reach the engine
 * as text and get matched against real catalog entries.
 */
export function inThePlayersOwnSpelling(value: string, restored: ReadonlyMap<string, string>): string {
    if (restored.size === 0) return value;
    return value.replace(WORDS, token => restored.get(token.toLowerCase()) ?? token);
}
