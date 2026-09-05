/**
 * Reading the parts of a sentence.
 */

import { MAX_CULTIVATION_DAYS } from './verb-day-costs.js';

const DURATION_UNITS: ReadonlyArray<[RegExp, number]> = [
    [/\b(?:day|days)\b/, 1],
    [/\b(?:week|weeks)\b/, 7],
    [/\b(?:month|months)\b/, 30],
    [/\b(?:season|seasons)\b/, 90],
    [/\b(?:year|years|yr|yrs)\b/, 365],
    [/\b(?:decade|decades)\b/, 3650],
    [/\b(?:century|centuries)\b/, 36_500]
];

const WORD_NUMBERS: Readonly<Record<string, number>> = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
    forty: 40, fifty: 50, hundred: 100
};

/**
 * The words that multiply the word before them.
 */
const WORD_MAGNITUDES: Readonly<Record<string, number>> = { hundred: 100, thousand: 1_000 };

/**
 * How many were named, from the two tokens before the unit.
 */
function howManyWereNamed(tail: readonly string[]): number {
    let count = 1;
    let magnitude = 1;
    for (const token of [...tail].reverse()) {
        const digits = Number(token.replace(/[^0-9.]/g, ''));
        if (Number.isFinite(digits) && digits > 0) { count = digits; break; }
        if (token === 'half') { count = 0.5; break; }
        const scale = WORD_MAGNITUDES[token];
        if (scale !== undefined) { magnitude = scale; continue; }
        // An article carries no count of its own. Left to answer, it swallowed
        // the word behind it.
        if (token === 'a' || token === 'an') continue;
        const word = WORD_NUMBERS[token];
        if (word !== undefined) { count = word; break; }
    }
    return count * magnitude;
}

/**
 * The same table as a regex alternation, longest first so `fifteen` is not eaten by
 * `five`.
 */
export const WORD_NUMBER_ALTERNATION = Object.keys(WORD_NUMBERS)
    .sort((a, b) => b.length - a.length)
    .map(word => `${word} `)
    .join('|');

/**
 * Days named in a phrase, or null when none is.
 */
export function parseDuration(input: string): number | null {
    // "half a year" reads as one token to a scanner walking backwards from the
    // unit, and "a" means one. Normalising it up front is cheaper than teaching
    // the scanner to look two words back.
    const text = input.toLowerCase().replace(/\bhalf\s+an?\b/g, '0.5');

    for (const [unitPattern, unitDays] of DURATION_UNITS) {
        const match = unitPattern.exec(text);
        if (!match) continue;

        const before = text.slice(0, match.index).trim();
        const tail = before.split(/[\s,]+/).filter(Boolean).slice(-2);

        const count = howManyWereNamed(tail);

        const days = Math.round(count * unitDays);
        return Math.max(1, Math.min(MAX_CULTIVATION_DAYS, days));
    }

    // A bare number with no unit is not a duration. "I strike the barrier 3
    // times" must not become three days of seclusion.
    return null;
}

/**
 * The span the sentence ASKED for, with no ceiling applied.
 */
export function durationAskedFor(input: string): number | null {
    const text = input.toLowerCase().replace(/\bhalf\s+an?\b/g, '0.5');

    for (const [unitPattern, unitDays] of DURATION_UNITS) {
        const match = unitPattern.exec(text);
        if (!match) continue;

        const before = text.slice(0, match.index).trim();
        const tail = before.split(/[\s,]+/).filter(Boolean).slice(-2);

        const count = howManyWereNamed(tail);

        return Math.max(1, Math.round(count * unitDays));
    }

    return null;
}

/**
 * How many were asked for, or null when the sentence does not say.
 */
export function parseCount(input: string): number | null {
    const digits = /\b([0-9]{1,3})\b/.exec(input);
    if (digits) {
        const n = Number(digits[1]);
        if (n >= 1) return n;
    }
    for (const token of input.toLowerCase().split(/[^a-z]+/).filter(Boolean)) {
        const word = WORD_NUMBERS[token];
        if (word !== undefined && word >= 1) return Math.round(word);
    }
    return null;
}

/**
 * Text following a movement preposition, cleaned into a place name.
 */
export function extractDestination(input: string): string | undefined {
    const prepositional = /\b(?:to|towards?|into|for)\s+(.{2,80}?)\s*[.!?]?$/i.exec(input);
    if (prepositional) return cleanPlace(prepositional[1]);

    // "travel Clear River Ford" - a bare destination straight after the verb.
    const bare = /^\s*(?:i\s+)?(?:travel|go|walk|head|journey|move|depart|leave|set out)\s+(.{2,80}?)\s*[.!?]?$/i
        .exec(input);
    return bare ? cleanPlace(bare[1]) : undefined;
}

/**
 * WHERE A NAME STOPS.
 */
export function theNounPhrase(raw: string): string {
    let said = raw.trim();

    // A clause boundary, and everything after it.
    said = said.split(/[,;.!?]/)[0] ?? said;

    // A tail that says what for, what next, how long, or how.
    const TAILS: readonly RegExp[] = [
        /\s+to\s+(?:stay|go|leave|come|keep|stop|hand|give|get|make|do|be|say|tell)\b.*$/i,
        /\s+(?:and|then|before|after|until|while|so that|in order to)\s+.*$/i,
        /\s+for\s+(?:a|an|one|two|three|several|the next|[0-9]+|[a-z]+)?\s*(?:while|day|days|week|weeks|month|months|season|seasons|year|years|decade|decades|lifetime)\b.*$/i,
        /\s+(?:again|properly|carefully|quickly|slowly|first|now|too|as well|instead|anyway|for good)\s*$/i
    ];
    let cut = true;
    while (cut) {
        cut = false;
        for (const tail of TAILS) {
            const shorter = said.replace(tail, '').trim();
            if (shorter.length >= 2 && shorter !== said) {
                said = shorter;
                cut = true;
            }
        }
    }
    return said.trim();
}

export function cleanPlace(raw: string): string | undefined {
    const cleaned = theNounPhrase(raw).replace(/^\s*the\s+/i, '').trim();
    return cleaned.length >= 2 ? cleaned.slice(0, 80) : undefined;
}

/** Text following a conversational verb, cleaned into a name. */
function extractTarget(input: string): string | undefined {
    const match = /\b(?:to|with|at)\s+(.{2,80}?)\s*[.!?]?$/i.exec(input);
    const cleaned = theNounPhrase(match?.[1] ?? '');
    return cleaned.length >= 2 ? cleaned.slice(0, 80) : undefined;
}

/**
 * The subject of a transitive verb: whatever follows it, or whatever follows a
 * preposition after it.
 */

/**
 * Generic ways of saying "a person", which are not names.
 */
export const ANYBODY = /^(?:around|about|someone|somebody|anyone|anybody|people|folk|the locals|the people|a passerby|a stranger|a local|them|him|her|somebody else)$/i;

/**
 * Asking GENERALLY, with nobody in the sentence at all.
 *
 * The two adverbs out of {@link ANYBODY}, and the split matters in `parseAsk`:
 * every other member of that set is a POINTER, and `somebodyAtHand` resolves
 * pointers - a pronoun to whoever was last dealt with, `someone` to the nearest
 * face. Dropping them as though they named nobody threw away who was being
 * asked. Measured: "I ask him where the sect is" came back with a topic and no
 * person at all, so the commonest pronoun in the game reached nobody.
 */
const ASKING_GENERALLY = /^(?:around|about)$/i;

/** Where a question stops naming who and starts naming what. */
/**
 * Where a question stops naming who and starts naming what.
 *
 * TWO KINDS, AND THE DIFFERENCE IS WHETHER THE WORD IS PART OF THE QUESTION.
 * `about`, `after`, `regarding`, `concerning`, `for` are prepositions and are
 * swallowed: "ask her about the ruins" is a question about the ruins. A
 * question word is not - it is the first word of what is being asked, and
 * swallowing it left the topic a fragment that reads as a noun and is not one.
 * Measured: "I ask the oldest man here who is in charge" came back with the
 * topic `is in charge`, and the ask verb then looked for somebody by that name
 * and reported that he had not heard of it.
 */
const ASK_PIVOT_PREPOSITION = /\s+(?:about|after|regarding|concerning|for)\s+/i;

/** Kept with the topic, because it is the first word of the question. */
const ASK_PIVOT_QUESTION = /\s+(?=(?:whether|if|what|where|who|whom|whose|how|why|when)\s+)/i;

/** The verbs that put a question to a person. */
const ASK_VERB = /\b(?:ask|asking|asks|enquire of|inquire of|put it to|question|press)\b\s*/i;

/**
 * Split "ask the old woman about the ruins" into who and what about.
 */
export function parseAsk(input: string): { person?: string; topic?: string } | null {
    const verb = ASK_VERB.exec(input);
    if (!verb) return null;

    const rest = input.slice(verb.index + verb[0].length).replace(/[.!?]+$/, '').trim();
    if (rest.length === 0) return {};

    // THE PIVOT CAN BE THE FIRST WORD
    const leading = /^(?:about|after|regarding|concerning|whether|if|for)\s+/i.exec(rest);
    // A preposition first, because "ask her about who holds this" pivots on
    // `about` and the question word after it belongs to the topic either way.
    const pivot = leading
        ? null
        : ASK_PIVOT_PREPOSITION.exec(rest) ?? ASK_PIVOT_QUESTION.exec(rest);
    const who = leading ? '' : (pivot ? rest.slice(0, pivot.index) : rest).trim();
    const about = leading
        ? rest.slice(leading[0].length).trim()
        : pivot ? rest.slice(pivot.index + pivot[0].length).trim() : '';

    const person = who.length >= 2 && !ASKING_GENERALLY.test(who)
        ? cleanPlace(who)
        : undefined;
    const topic = about.length >= 2 ? cleanPlace(about) : undefined;
    return { ...(person ? { person } : {}), ...(topic ? { topic } : {}) };
}

export function matchIntent(text: string, table: ReadonlyArray<[string, RegExp]>): string | undefined {
    for (const [label, pattern] of table) {
        if (pattern.test(text)) return label;
    }
    return undefined;
}

export function extractSubject(input: string, verbs: RegExp): string | undefined {
    const afterVerb = new RegExp(
        `\\b(?:${verbs.source})\\b\\s*(?:the|a|an|for|into|at|with|about|to|on|through|around)?\\s+(.{2,80}?)\\s*[.!?]?$`,
        'i'
    ).exec(input);
    if (afterVerb) {
        const got = cleanPlace(afterVerb[1]);
        // A WORD THAT STANDS IN FOR SOMETHING ALREADY NAMED
        if (got && STANDS_IN_FOR_SOMETHING_ALREADY_NAMED.test(got)) {
            return whatWasNamedEarlier(input, verbs) ?? got;
        }
        return got;
    }
    return extractTarget(input);
}

/**
 * Words that name nothing and refer back to something the sentence already
 * said. Things only - never a person. See {@link extractSubject}.
 */
const STANDS_IN_FOR_SOMETHING_ALREADY_NAMED =
    /^(?:it|one|the one|the copy|a copy|copy|the copies|the thing|the same|the lot)$/i;

/**
 * The last thing NAMED before the verb, for a sentence whose object is a stand-in.
 */
function whatWasNamedEarlier(input: string, verbs: RegExp): string | undefined {
    const upTo = new RegExp(`^(.*?)\\b(?:${verbs.source})\\b`, 'i').exec(input);
    const before = (upTo?.[1] ?? '').trim();
    if (before.length < 3) return undefined;
    const named =
        /\bof\s+(?:the\s+|a\s+|an\s+)?(.{2,70}?)\s*(?:,|\s+and\b|\s+then\b|$)/i.exec(before)
        ?? /\b(?:the|a|an|my|his|her)\s+(.{2,70}?)\s*(?:,|\s+and\b|\s+then\b|$)/i.exec(before);
    return named ? cleanPlace(named[1]) : undefined;
}

/**
 * Whether one of these verbs was USED, rather than merely mentioned.
 */
export function usedAsVerb(text: string, verbs: string): boolean {
    return new RegExp(
        // sentence start, or a subject, or a modal, or a conjunction - the
        // places an English verb actually goes
        '(?:^|[.;,]\\s*|\\b(?:i|we|you|they|lets|let me|then|and|so|now|will|shall|must|'
        + 'want to|wish to|need to|try to|going to|about to|decide to|intend to|hope to|'
        + 'would like to|had better|am going to|set out to|mean to|'
        /**
         * The infinitive markers a QUESTION puts in front of a verb.
         */
        + 'able to|possible to|allowed to|permitted to|supposed to|cost to|take to)\\s+)'
        + '(?:just |now |quietly |carefully |instead )?'
        + '(?:' + verbs + ')' + '\\b',
        'i'
    ).test(text);
}

/**
 * The noun phrase a leadership verb is aimed at.
 */
export function namedAfter(input: string, verbs: string): string | undefined {
    const after = new RegExp(
        // `an` before `a`, and a boundary after the article, or "an elder"
        // loses its n: the shorter alternative wins the race and the phrase
        // that comes back is a fragment of the word it was supposed to skip.
        `\\b(?:${verbs})\\b\\s*(?:the|an|a|any|some|all|my|our|its|their|new|more)?\\b\\s*`
        + `(.{2,80}?)`
        + `\\s*(?:\\b(?:from|out of|into|onto|to|under|because|so that|instead of)\\b.*)?[.!?]?$`,
        'i'
    ).exec(input);
    const cleaned = (after?.[1] ?? '').trim().replace(/^(?:the|a|an)\s+/i, '');
    return cleaned.length >= 2 ? cleaned.slice(0, 80) : undefined;
}

/**
 * The other party in a sentence about two institutions.
 */
export function partyAfter(input: string, markers: string): string | undefined {
    const found = new RegExp(
        `\\b(?:${markers})\\s+(?:the|a|an|our|its|their|his|her)?\\s*`
        + `(.{2,80}?)`
        + '\\s*(?:\\b(?:for|about|regarding|concerning|over|because|so that|'
        + 'instead of|in order|and then|asking)\\b.*)?[.!?]?$',
        'i'
    ).exec(input);
    // A leading preposition survives when the verb itself was the marker that
    // matched - "apply to the Thousand Treasure Pavilion" captures "to the
    // Thousand Treasure Pavilion" - and a faction matcher handed that string
    // resolves nobody. Stripped after the article rather than before, because
    // both can be there.
    const cleaned = (found?.[1] ?? '')
        .trim()
        .replace(/^(?:to|at|of|with|from|before|against|upon|on)\s+/i, '')
        .replace(/^(?:the|a|an)\s+/i, '');
    return cleaned.length >= 2 ? cleaned.slice(0, 80) : undefined;
}

/**
 * Typographic characters, put back to the ones the patterns are written in.
 */
export function inTheCharactersThePatternsUse(input: string): string {
    // Written as escapes rather than as the characters themselves. AGENTS.md
    // forbids an em-dash in this repo's source and the terminology test
    // enforces it - a rule this very function exists to serve, so it must not
    // be the one place that breaks it.
    return input
        .replace(/[\u2018\u2019\u201B]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2026/g, '...');
}

/**
 * Words that can surround a bare duration without making it a sentence.
 *
 * Everything else means the duration was a subordinate clause of some larger
 * intention, and the larger intention is the thing that did not parse.
 */
const DURATION_FILLER = new Set([
    'i', 'ill', 'me', 'my', 'we', 'for', 'the', 'a', 'an', 'and', 'then', 'next',
    'about', 'roughly', 'around', 'another', 'more', 'spend', 'spending', 'take',
    'takes', 'taking', 'pass', 'go', 'last', 'lasting', 'half', 'over', 'in', 'of'
]);

/**
 * Whether the input is a duration and essentially nothing else.
 */
export function isBareDuration(input: string): boolean {
    const tokens = input
        .toLowerCase()
        .replace(/[^a-z0-9. ]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

    if (tokens.length === 0) return false;

    for (const token of tokens) {
        if (DURATION_FILLER.has(token)) continue;
        if (/^[0-9]+(\.[0-9]+)?$/.test(token)) continue;
        if (token in WORD_NUMBERS) continue;
        if (DURATION_UNITS.some(([pattern]) => pattern.test(token))) continue;
        return false;
    }
    return true;
}
