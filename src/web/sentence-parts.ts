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

/**
 * ── EVERY NUMBER WORD, BECAUSE A MISSING ONE IS SILENTLY ONE ─────────────
 *
 * This held nineteen entries and stopped at fifty, skipping eleven, thirteen,
 * fourteen, sixteen through nineteen, and sixty through ninety. An
 * unrecognised word does not fail here - `howManyWereNamed` starts at 1 and
 * returns it - so a span written in a word the table lacked was silently the
 * smallest possible span, with nothing on the screen to say so.
 *
 * Measured through the real parser, in matched pairs:
 *
 *     "I cultivate for fifty years"  -> 18250 days   (fifty was in the table)
 *     "I cultivate for sixty years"  ->   365 days   (one year)
 *     "I cultivate for eighty years" ->   365 days   (one year)
 *     "I wait fifteen days"          ->    15 days
 *     "I wait fourteen days"         ->     1 day
 *     "I wait seventy days"          ->     1 day
 *
 * In a game whose core loop is deciding how long to sit down, and where time
 * does not come back, a span quietly reduced to its minimum is the worst shape
 * a defect can have: no error, a wrong answer, and nothing to undo it with.
 */
const WORD_NUMBERS: Readonly<Record<string, number>> = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
    seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1_000
};

/** The tens, which are the half of a compound that comes first. */
const A_ROUND_TEN = (word: number): boolean => word >= 20 && word < 100 && word % 10 === 0;

/**
 * The words that multiply the word before them.
 */
const WORD_MAGNITUDES: Readonly<Record<string, number>> = { hundred: 100, thousand: 1_000 };

/**
 * How many were named, from the two tokens before the unit.
 *
 * A COMPOUND IS TWO WORDS AND THE READ STOPPED AT THE FIRST. `twenty five
 * days` broke on `five` and came back as five days, because the loop takes the
 * first number it meets going backwards and stops. The tens word is the one
 * standing behind it, and the caller already passes the two tokens before the
 * unit - which is exactly a compound and no more.
 */
function howManyWereNamed(tail: readonly string[]): number {
    let count = 1;
    let magnitude = 1;
    // Whether a units word (one to nine) has been read and could still have a
    // tens word standing in front of it.
    let awaitingTheTens = false;
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
        if (word === undefined) break;
        // The front half of `twenty five`, and the only thing that may be read
        // after a units word rather than instead of it.
        if (awaitingTheTens && A_ROUND_TEN(word)) { count += word; break; }
        count = word;
        if (word >= 1 && word <= 9) { awaitingTheTens = true; continue; }
        break;
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
    // ── AN ARTICLE IS THE LAST RESORT AND WAS THE FIRST ──────────────────
    //
    // `a` and `an` are in the table because "a stone" is one stone. Read in
    // sentence order they also won every race they were in: "a thousand
    // stones" came back as ONE, because `a` is the first token and the loop
    // returned on it.
    //
    // So a real number word is looked for first, and the article answers only
    // when the sentence names no other number.
    const words = input.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    let magnitude = 1;
    let named: number | null = null;
    let joined = false;
    for (const token of words) {
        const scale = WORD_MAGNITUDES[token];
        if (scale !== undefined) { magnitude = Math.max(magnitude, scale); continue; }
        if (token === 'a' || token === 'an') continue;
        const word = WORD_NUMBERS[token];
        if (word === undefined || word < 1) continue;
        if (named === null) { named = word; continue; }
        // AND THE SECOND HALF OF A COMPOUND, so this agrees with
        // `howManyWereNamed` about `twenty five`. Only a units word directly
        // after a round ten joins it; anything else is a second number in the
        // sentence, and the first one said is the one meant.
        if (!joined && A_ROUND_TEN(named) && word <= 9) { named += word; joined = true; }
    }
    if (named !== null) return Math.round(named * magnitude);
    if (magnitude > 1) return Math.round(magnitude);
    // And the article, where it was all the sentence said.
    for (const token of words) {
        const word = WORD_NUMBERS[token];
        if (word !== undefined && word >= 1) return Math.round(word);
    }
    return null;
}

/**
 * A trailing "for <however long>", which is a SPAN and never a destination.
 *
 * FOUND BY PLAYING, and it is systematic rather than one phrasing. `for` has to
 * be a movement preposition - *I set out for Clear River Ford* - and it is also
 * how everybody says how long they are going for. Where the sentence carried no
 * `to`, `for` won the race and the span became the place:
 *
 *     i travel north for a while    ->  move to "a while"
 *     i walk north for a few days   ->  move to "a few days"
 *     i head north for three days   ->  move to "three days"
 *     i go north for a bit          ->  move to "a bit"
 *
 * The direction is dropped on the floor and the engine is sent looking for a
 * place nobody named. `theNounPhrase` already knows how to cut this tail, but it
 * only ever saw the CAPTURE - by which point the tail was the whole of it, and
 * there was nothing left to cut back to.
 *
 * So it comes off the SENTENCE, before any preposition is read. A time noun is
 * required, so "I set out for Clear River Ford" is untouched.
 */
const A_SPAN_AND_NOT_A_PLACE =
    /\s+for\s+(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|several|some|many|a few|the next|\d+)?\s*(?:while|bit|spell|stretch|day|days|week|weeks|month|months|season|seasons|year|years|decade|decades|lifetime|age|ages)\b.*$/i;

/**
 * Text following a movement preposition, cleaned into a place name.
 */
export function extractDestination(input: string): string | undefined {
    // The span comes off first. See `A_SPAN_AND_NOT_A_PLACE`.
    //
    // No fallback to the untrimmed sentence. "I travel for a while" names no
    // destination at all, and handing the span back as one because nothing else
    // was said is the defect above with an extra step - a caller that gets
    // `undefined` asks where, which is the right question.
    const said = input.replace(A_SPAN_AND_NOT_A_PLACE, '').trim();

    const prepositional = /\b(?:to|towards?|into|for)\s+(.{2,80}?)\s*[.!?]?$/i.exec(said);
    if (prepositional) return cleanPlace(prepositional[1]);

    // "travel Clear River Ford" - a bare destination straight after the verb.
    const bare = /^\s*(?:i\s+)?(?:travel|go|walk|head|journey|move|depart|leave|set out)\s+(.{2,80}?)\s*[.!?]?$/i
        .exec(said);
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

/**
 * A phrase that is nothing but a length of time.
 *
 * The other end of `A_SPAN_AND_NOT_A_PLACE`. That one cuts a span off a
 * sentence before a preposition is read; this catches the case where the span
 * is ALL that was captured, because every extractor in this file reads the text
 * after a preposition and `for` is both a destination preposition and the word
 * everybody says how long for with.
 *
 * Measured: "I travel for a while" named no destination, so the move branch
 * fell through to `extractSubject`, which read past `for` and handed back "a
 * while" as the place. Anchored whole-string on purpose - a name with a time
 * word in it ("Nine Seasons Hall") has other words in it and is untouched.
 */
const NOTHING_BUT_A_LENGTH_OF_TIME =
    // `next` and `coming` are here without `the` in front of them because
    // `cleanPlace` takes a leading "the" off before this runs, so "the next
    // season" arrives as "next season".
    /^(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|several|some|many|a few|next|last|coming|following|\d+)?\s*(?:while|bit|spell|stretch|day|days|week|weeks|month|months|season|seasons|year|years|decade|decades|lifetime|age|ages)$/i;

export function cleanPlace(raw: string): string | undefined {
    const cleaned = theNounPhrase(raw).replace(/^\s*the\s+/i, '').trim();
    if (NOTHING_BUT_A_LENGTH_OF_TIME.test(cleaned)) return undefined;
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
export const ASKING_GENERALLY = /^(?:around|about)$/i;

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

/**
 * The object of one of `verbs`, out of the sentence it was used in.
 *
 * ── AND SOMETIMES THE NOUN COMES FIRST ───────────────────────────────────
 *
 * FOUND BY PLAYING BLIND. Standing over a freshly gathered mushroom:
 *
 *     > what is this worth
 *     What is nearest to hand, of 43 things on offer:
 *       Bowl of millet, 1 cash each. ...
 *
 * Forty-three lines of ferry fares and inn beds, in answer to a question about
 * the one thing in the player's own pouch - which the engine had priced twice
 * on the two screens either side of that one.
 *
 * The routing was right all along: `verb-pattern-table.ts` reads every one of
 * those phrasings and sends them to `sell`, whose free read is the market. What
 * went missing was the NOUN. This looked for the object AFTER the marker word,
 * and English puts it before in the commonest shape there is - *what is my
 * sword worth*, *what are my herbs worth*, *what would the manual fetch*. The
 * branch's own comment names "what is my sword worth" as a sentence it handles,
 * and the name was being dropped on the floor one function later.
 *
 * So when nothing follows the marker, look in front of it, with the reader
 * already written for a stand-in object. A bare demonstrative still resolves to
 * nothing - "what is this worth" carries no name, and a back-reference is phase
 * one's to settle rather than this tier's.
 *
 * Strictly a widening: it runs only where this returned `undefined`.
 */
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
    return extractTarget(input) ?? whatWasNamedEarlier(input, verbs);
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
    // ── THE ARTICLE HAS TO BE A WHOLE WORD, AND IT WAS NOT ───────────────
    //
    // This was `(?:the|a|an|our|its|their|his|her)?\s*`, and `\s*` matches
    // NOTHING - so the optional article was free to eat the first letter of the
    // name behind it. Measured on the trope corpus against a live narrator:
    //
    //     I will end the Azure Cloud Pavilion   ->   "zure Cloud Pavilion"
    //
    // `a` took the A of Azure, `\s*` matched the empty string, and the capture
    // started one character in. The declaration then resolved nobody, and what
    // the player got back was a person asking who they meant - on a sentence
    // that had named a house of the catalog in full.
    //
    // Seven of the thirty-six houses in the world start with one of these
    // words - three Azure, the Ashen Forge Clan, the Ancient Bough Grove, The
    // Hollow Court, The Severed - and every one of them was being mangled by
    // every one of this function's thirteen callers.
    //
    // Requiring the whitespace INSIDE the optional group is the whole fix: an
    // article is a word, and a word is followed by a space.
    const found = new RegExp(
        `\\b(?:${markers})\\s+(?:(?:the|a|an|our|its|their|his|her)\\s+)?`
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

/**
 * THE SENTENCE WITH ITS PROPER NAMES TAKEN OUT.
 *
 * A word doing duty inside a NAME is not that word being used as a category,
 * and this table is full of branches that anchor on a category noun. Every one
 * of them is a place a proper name can be eaten.
 *
 * ── MEASURED, FIVE TIMES, BEFORE IT WAS GENERALISED ──────────────────────
 *
 * It was found once - "I travel to Four Graves" reached the inheritance-site
 * listing and never moved anybody, because `graves` is a site noun - and fixed
 * locally, inside `siteStep`. A pass over the whole catalog immediately found
 * four more that the local fix did not reach, each with the same shape and a
 * different verb family:
 *
 *   Knife Edge     `knife`    12 of 12 phrasings became an ATTACK on "Edge"
 *   Wind Market    `market`   7 of 12 reached the board and never moved
 *   Stone Shadow   `shadow`   every travel phrasing became move/FOLLOW
 *   Iron Ridge Mission `mission`  "what does it teach" reached the errand board
 *
 * Those names were changed, which fixes those names. This fixes the CLASS: any
 * branch that anchors on a category noun can ask the sentence with its names
 * removed, and stop eating the next one somebody writes.
 *
 * ── A NAME IS TWO CAPITALISED WORDS OR MORE ──────────────────────────────
 *
 * Deliberately. One would take the first word of every sentence and every
 * over-capitalised noun a player types. Two is what a place in this world is
 * actually called - and a name the catalog knows is unaffected either way,
 * because the readers that resolve a name by name run first and anchor it.
 *
 * KNOWN LIMIT, stated rather than hidden: somebody typing entirely in lower
 * case gives no signal to read, and "i travel to four graves" still anchors.
 * Fixing that wants the world's own place list, which a pattern table does not
 * have and should not hold a copy of. It is the reason those five names moved
 * as well: this narrows the class, and a name that carries no category word
 * cannot be eaten by either route.
 */
export function outsideAnyName(input: string): string {
    return input.replace(A_NAME_RATHER_THAN_A_NOUN, ' ').toLowerCase();
}

/** Two or more capitalised words in a row. What a place in this world is called. */
const A_NAME_RATHER_THAN_A_NOUN =
    /\b[A-Z][a-z']+(?:\s+(?:of|the|and|a)\s+|\s+)(?:[A-Z][a-z']+)(?:\s+[A-Z][a-z']+)*\b/g;
