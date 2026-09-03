/**
 * Reading the parts of a sentence.
 *
 * How many, how long, and which stretch of the words is the name - and nothing
 * at all about which verb was meant. Every one of these serves every verb, and
 * the signatures are the proof: `extractSubject(input, verbs)`,
 * `usedAsVerb(text, verbs)`, `namedAfter(input, verbs)`,
 * `partyAfter(input, markers)` and `matchIntent(text, table)` all take the
 * vocabulary as an ARGUMENT. `leaving-things-for-the-next-life.ts` already has
 * `usedAsVerb` passed in to it for exactly this reason and says so in its own
 * comment; this file is that arrangement made general.
 *
 * Single reason to change: how a phrase is cut out of English. A name coming
 * back wrong is an edit here. A verb being added is not.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────
 *
 * `LOOKED_AT` and `THE_SCENE_ITSELF` sat in the middle of this material in
 * `actions.ts` and stayed behind, because they are `look`'s own patterns
 * wearing a grammar block's clothes. `MOVE_INTENT_PATTERNS` likewise. A
 * pattern that names a verb belongs with the table that routes it.
 *
 * ── AND WHAT THE EXPORTS HERE DO NOT DO ──────────────────────────────────
 *
 * Eight of these were file-private in `actions.ts` and carry an `export` now
 * only because the pattern table calls them across a file boundary. That is
 * invisible to the spelling repair, which harvests the namespace of
 * `actions.ts` alone - and `actions.ts` re-exports from here BY NAME, never
 * with `export *`, so `ANYBODY` and `WORD_NUMBER_ALTERNATION` do not enter the
 * repair's dictionary. See the commit that split `verb-day-costs.ts` for the
 * 204 / 1497 check that holds this true.
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
 *
 * Separate from `WORD_NUMBERS` because they behave differently: `five` is a
 * count and `hundred` is a scale, and a scanner that treats them alike takes
 * whichever it meets first.
 */
const WORD_MAGNITUDES: Readonly<Record<string, number>> = { hundred: 100, thousand: 1_000 };

/**
 * How many were named, from the two tokens before the unit.
 *
 * ── MEASURED, AND IT WAS SILENT ──────────────────────────────────────────
 *
 * The old scan walked the tokens right to left and stopped at the first one
 * that resolved, so in "five hundred years" it met `hundred`, took 100, and
 * threw the `five` away:
 *
 *     five hundred years   ->  100 years
 *     two hundred years    ->  100 years
 *     a thousand years     ->    1 year     (`thousand` was in no table, so the
 *                                            `a` behind it answered instead)
 *
 * A player asking for a millennium of seclusion got a year and was told
 * nothing, which is the worst shape a parse error takes: the sentence was
 * understood, the number was not, and the turn looked ordinary.
 *
 * So a magnitude no longer ends the scan - it sets a scale and the scan
 * continues to the count in front of it. `a` and `an` no longer end it either,
 * which also repairs "half a year", where the `a` was answering for the
 * `half` behind it.
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
 * The same table as a regex alternation, longest first so `fifteen` is not
 * eaten by `five`.
 *
 * Built rather than typed, because a hand-written list of number words next to
 * a table of number words goes stale exactly once and then silently: "ten years
 * of provisions" did not parse, because a provisioning rule enumerated
 * `a|one|two|three` and stopped, so the sentence fell through to `buy` and died
 * at the price board. Anything that needs to spell out a count in a pattern
 * should splice this in.
 */
export const WORD_NUMBER_ALTERNATION = Object.keys(WORD_NUMBERS)
    .sort((a, b) => b.length - a.length)
    .map(word => `${word} `)
    .join('|');

/**
 * Days named in a phrase, or null when none is.
 *
 * Handles "90 days", "three years", "a decade", "half a year". Deliberately
 * greedy about the unit and conservative about the count: an unparseable count
 * next to a recognised unit means one of that unit, which is always a smaller
 * commitment than the player might have meant, and undershooting a permadeath
 * time-skip is the forgiving direction to be wrong in.
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
 *
 * `parseDuration` clamps to {@link MAX_CULTIVATION_DAYS} and says nothing about
 * having done so, which is the invisible-fallback defect in numeric form:
 * "I cultivate for 100000 years" came back as "Seclusion of 100 years was
 * intended", a thousandfold silent correction that reads like the engine
 * agreeing with you. The ceiling is real - it is the longest stretch this
 * engine resolves in a single pass - and it has to be SAID.
 *
 * Returns null on the same sentences `parseDuration` returns null for, so a
 * caller can compare the two and only speak when they differ.
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
 *
 * Separate from {@link parseDuration} because a count is not a span and must
 * never be read as one: "three disciples" is three people, and answering it
 * with three days of anything would be the same class of error as reading "a
 * season" out of a sentence about employment. Deliberately refuses a bare zero
 * and anything that is not a plain count, so the caller falls back to the
 * tool's own default rather than to a guess made here.
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
 *
 * Returns undefined rather than guessing. "I set out." names no destination,
 * and a parser that answers "I set out." to the question *where to?* would send
 * the cultivator to a place called "I set out." - the engine would dutifully
 * store it, and the run would be quietly nonsense from then on.
 */
export function extractDestination(input: string): string | undefined {
    const prepositional = /\b(?:to|towards?|into|for)\s+(.{2,80}?)\s*[.!?]?$/i.exec(input);
    if (prepositional) return cleanPlace(prepositional[1]);

    // "travel Scarwater" - a bare destination straight after the verb.
    const bare = /^\s*(?:i\s+)?(?:travel|go|walk|head|journey|move|depart|leave|set out)\s+(.{2,80}?)\s*[.!?]?$/i
        .exec(input);
    return bare ? cleanPlace(bare[1]) : undefined;
}

/**
 * WHERE A NAME STOPS.
 *
 * ── ONE BUG, SIX SENTENCES ───────────────────────────────────────────────
 *
 * Every extractor in this file captures `(.{2,80}?)` against `$`. Lazy against
 * an end anchor still runs to the end of the string when nothing else closes
 * the match, so the "name" is everything the player said after the verb.
 * Measured on one probe of ordinary play sentences:
 *
 *   "I warn him to stay away from her"  -> "stay away from her"
 *   "I read the manual again"           -> "manual again"
 *   "I practise <an art> for a year"    -> "<an art> for a year"
 *   "I take Cao Antao's purse, press it into Shen Liefeng's hand, and walk away"
 *                                       -> "it into Shen Liefeng's hand, and walk away"
 *
 * Each one then reaches a resolver that looks the whole phrase up against a
 * catalog, fails, and refuses in terms of the phrase - "the approach to it into
 * Shen Liefeng's hand, and walk away". A wrong name is worse than no name,
 * because the refusal is about something the player did not say.
 *
 * ── WHAT IS CUT, AND WHY EACH OF THEM IS SAFE ────────────────────────────
 *
 * Only the tail, and only where the tail cannot be part of a name:
 *
 *   a clause boundary   nothing past a comma is part of who or what.
 *   ` to <verb>`        "warn him TO STAY AWAY" - purpose, not the person.
 *   ` and ...`          a second act. `theClauseThisTurnDidNotRun` reports it.
 *   a span              "for a year" is how long, and `parseDuration` has
 *                       already read it off the whole sentence.
 *   a bare adverb       "again", "properly", "first" - how, not what.
 *
 * Nothing in the CATALOGS contains a comma, and no art, place, person or item
 * in this world is named "... for a year" or "... again". A name that genuinely
 * contains one of these words keeps it: the cuts are anchored to the END of the
 * phrase, so "Nine Peaks" and "The Gate Frame With No Gate In It" are untouched.
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
 *
 * "search the ruin", "look into the inscription", "haggle with the broker",
 * "refine a Meridian Knitting Pill" all reduce to the noun phrase. Undefined
 * when there is no noun phrase, which every caller treats as a refusal rather
 * than a guess.
 */

/**
 * Generic ways of saying "a person", which are not names.
 *
 * "someone" resolved against the roster and came back with a specific
 * cultivator, which handed the player a name they had not earned off a word
 * that named nobody. A generic person means whoever is at hand, and who that
 * turns out to be is the engine's to decide.
 */
export const ANYBODY = /^(?:around|about|someone|somebody|anyone|anybody|people|folk|the locals|the people|a passerby|a stranger|a local|them|him|her|somebody else)$/i;

/** Where a question stops naming who and starts naming what. */
const ASK_PIVOT = /\s+(?:about|after|regarding|concerning|whether|if|what|where|who|how|why|for)\s+/i;

/** The verbs that put a question to a person. */
const ASK_VERB = /\b(?:ask|asking|asks|enquire of|inquire of|put it to|question|press)\b\s*/i;

/**
 * Split "ask the old woman about the ruins" into who and what about.
 *
 * Returns null when nothing was asked of anybody. Either half may come back
 * empty and that is meaningful: "I ask around about the sects" names no
 * individual, "I ask the gate steward" names no topic, and both still reach a
 * person, which is the whole point of routing them here.
 */
export function parseAsk(input: string): { person?: string; topic?: string } | null {
    const verb = ASK_VERB.exec(input);
    if (!verb) return null;

    const rest = input.slice(verb.index + verb[0].length).replace(/[.!?]+$/, '').trim();
    if (rest.length === 0) return {};

    // ── THE PIVOT CAN BE THE FIRST WORD ──────────────────────────────────
    //
    // `ASK_PIVOT` requires whitespace on both sides, and `rest` is trimmed - so
    // a sentence that names no person at all and goes straight to the topic had
    // no pivot to find. "I ask about the ruins" came out with a PERSON called
    // "about the ruins", who then failed to resolve, and the player was told
    // nobody by that name was here.
    const leading = /^(?:about|after|regarding|concerning|whether|if|for)\s+/i.exec(rest);
    const pivot = leading ? null : ASK_PIVOT.exec(rest);
    const who = leading ? '' : (pivot ? rest.slice(0, pivot.index) : rest).trim();
    const about = leading
        ? rest.slice(leading[0].length).trim()
        : pivot ? rest.slice(pivot.index + pivot[0].length).trim() : '';

    const person = who.length >= 2 && !ANYBODY.test(who) ? cleanPlace(who) : undefined;
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
        // ── A WORD THAT STANDS IN FOR SOMETHING ALREADY NAMED ────────────
        //
        // "I write out a copy of the Lesser Qi-Gathering Manual and sell it"
        // came out of here as `it`, and `it` resolves to nothing, so the sale
        // fell through to pricing the whole pouch. Same for "I copy out X and
        // sell the copy", and it is not about copying: "I take the manual and
        // sell it" is wrong in exactly the same way and always was.
        //
        // The set is closed and holds only words for THINGS. `him`, `her` and
        // `them` are deliberately absent: those are how a player points at a
        // person who is standing here, the party resolver already reads them,
        // and redirecting one at a noun earlier in the sentence would break
        // every "I strike at him" in the game.
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
 * The last thing NAMED before the verb, for a sentence whose object is a
 * stand-in.
 *
 * Two shapes, in order, and both are ordinary English rather than anything to
 * do with any one verb: "a copy OF the manual, and sell it" puts the thing
 * after a preposition, and "the manual and sell it" puts it behind an article.
 * Returns undefined when there is nothing named, and the caller then keeps the
 * stand-in - which resolves to nothing and is refused, exactly as it was.
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
 *
 * This exists because of the worst bug this parser has produced. The
 * cultivation branch matched `cultivat\w*`, and "cultivator" is one of the
 * most common nouns in the setting - so "I attack the nearest cultivator" was
 * answered by sitting the player down to meditate for a month. They had asked
 * to hit somebody. It burned satiety, it passed time, and it killed a
 * character during testing.
 *
 * The general defect is matching bare substrings against player prose in a
 * world whose core vocabulary - cultivator, cultivation, sect, elder, market,
 * work - appears far more often as the OBJECT of a sentence than as the thing
 * being asked for. So position has to matter: a verb counts when it opens the
 * sentence, or follows a subject or a modal, and does not count when it is
 * sitting behind an article or a preposition where only a noun can be.
 *
 * Deliberately permissive about what may precede the verb and strict about
 * what may not. Missing a real command costs a turn; acting on a noun costs a
 * month of a life.
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
         *
         * "is it possible to learn the Lesser Qi-Gathering Manual" and "what
         * would it cost to learn it" both reached `unclear` - the parser knew
         * "I learn X" and "could I learn X" and not the two phrasings somebody
         * uses when they are being careful, which is exactly the shape
         * `AGENTS.md` files under "if a near-synonym works, the phrasing that
         * fails is a bug". The failing half was the more natural one.
         *
         * Safe to widen here because these are all subordinate infinitives,
         * which is a verb position in English and nothing else; and because
         * every sentence that reaches the parser through one of them also
         * matches `ASKING_RATHER_THAN_DOING`, so what it reaches is the read.
         */
        + 'able to|possible to|allowed to|permitted to|supposed to|cost to|take to)\\s+)'
        + '(?:just |now |quietly |carefully |instead )?'
        + '(?:' + verbs + ')' + '\\b',
        'i'
    ).test(text);
}

/**
 * The noun phrase a leadership verb is aimed at.
 *
 * Trimmed at the clause that says WHERE rather than WHO: "Elder Fang from the
 * sect" is one person and a preposition, and handing the whole string to a
 * matcher resolves nobody. Returns undefined when nothing usable followed the
 * verb, and every caller treats that as a request for the LISTING rather than
 * as a guess - seeing which elders there are and what each would cost is the
 * sentence before the one that dismisses somebody, and it is the right answer
 * to a sentence that named nobody.
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
 *
 * Trimmed at the clause that says WHAT WAS ASKED FOR rather than WHO OF:
 * "petition the Third Sill Court for a grant" is a party and a matter, and
 * handing the whole string to a faction matcher resolves nobody. Wider than
 * {@link namedAfter}'s trim list on purpose - `for`, `about` and `over` all
 * introduce the matter here, and none of them can introduce a faction.
 *
 * Returns undefined when nothing usable followed, and every caller treats that
 * as meaning THEIR OWN HOUSE or as a request for the read, never as a guess.
 * Declaring war on nobody in particular must not pick somebody.
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
 *
 * A phone, a word processor and most chat boxes turn an apostrophe into U+2019
 * as you type it, and the phrase tables are written with ASCII. So
 * "is this the Azure Cloud Pavilion's art" reached the recognition verb and
 * the same sentence with a curly apostrophe reached nothing at all - in a
 * world whose houses are called things like The Gleaners' Company, where a
 * possessive is the natural way to ask about almost anything.
 *
 * These are variants of the same character rather than different content, so
 * this is a spelling of the input and not a reading of it. Entity resolution
 * already tolerated both, which is why a NAME with a curly apostrophe resolved
 * while the verb around it did not.
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
 *
 * Strips the number words, the unit words and the filler above; if anything
 * substantive is left, the sentence was about something other than the passage
 * of time and must not be read as a request to sit still for it.
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
