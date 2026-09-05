/**
 * ASKING A PERSON FOR SOMETHING: WHO IT IS PUT TO, AND WHAT IS BEING ASKED.
 */

import type { AskWeight } from '../engine/social-leverage/index.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS BEING ASKED FOR
// ─────────────────────────────────────────────────────────────────────────

/**
 * The shape of the ask, which is not the verb it was asked with.
 */
export type RequestKind =
    | 'teaching'
    | 'discipleship'
    | 'introduction'
    | 'telling'
    | 'a_thing'
    /**
     * ASKING WHAT IT WOULD TAKE, WHICH IS NOT ASKING FOR IT.
     */
    | 'terms'
    /**
     * PUTTING SOMETHING DOWN THAT IS NOT MONEY.
     */
    | 'a_trade'
    /**
     * THE ONE THAT ASKS FOR NOTHING, and the reason the rest of them are reachable
     * at all.
     */
    | 'nothing'
    | 'unstated';

/**
 * What a request of each kind costs the person it is put to, before anything about
 * the specific thing is known.
 */
export function baseWeightOf(kind: RequestKind): AskWeight {
    switch (kind) {
        case 'telling':
        case 'introduction':
        case 'nothing':
        case 'unstated':
            return 'a_courtesy';
        // Asking what somebody wants for a thing costs them a sentence, which
        // is what `a_courtesy` is. It is not free of CONSEQUENCE - they now
        // know you are looking - and consequence is the resolver's business
        // rather than the weight's.
        case 'terms':
            return 'a_courtesy';
        case 'teaching':
        case 'discipleship':
        case 'a_thing':
        case 'a_trade':
            return 'a_real_favour';
    }
}

export interface DirectedRequest {
    /**
     * The person phrase, trimmed at the clause that stops naming them.
     */
    person: string;
    kind: RequestKind;
    /**
     * The art, the person to be introduced to, the subject, the thing - as the
     * player wrote it. Resolved by the caller against the same catalogs
     * everything else uses, and absent when the sentence named none.
     */
    object?: string;
    /**
     * What the player is putting down for it, as they wrote it.
     */
    putDown?: string;
    /**
     * The ask in the player's own words, verbatim and capped.
     */
    inTheirWords: string;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SPLIT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The verbs that put a request to a person.
 */
const REQUEST_VERB = new RegExp(
    '\\b(?:ask|asks|asking|beg|begs|begging|implore|implores|imploring|entreat|entreats'
    + '|beseech|beseeches|plead with|pleads with|pleading with|appeal to|appeals to'
    + '|prevail (?:up)?on|bribe|bribes|bribing|offer|offers|offering|pay|pays|paying'
    + '|persuade|persuades|persuading|petition (?!the )'
    + ')\\b\\s*',
    'i'
);

/**
 * Where the sentence stops naming WHO and starts saying WHAT.
 */
const WHERE_THE_ASK_STARTS = /\s+(?:to|for|with|into|about|regarding|concerning)\s+/i;

/**
 * The pivots that open a question rather than a request.
 */
const A_QUESTION_RATHER_THAN_A_REQUEST = /^\s*(?:about|regarding|concerning)\b/i;

/** A sum on the table, in either of the two ways somebody writes one. */
const THE_MONEY = /\b(?:with|for)?\s*\d[\d,]*\s*(?:spirit\s+)?stones?\b/i;

/**
 * Leading and trailing noise a person phrase collects.
 */
function cleanPerson(raw: string): string | undefined {
    const cleaned = raw
        .replace(THE_MONEY, ' ')
        .replace(/^(?:the|a|an|to|with|of|from|at|on|upon)\s+/i, '')
        .replace(/[,;:.!?]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned.length >= 2 ? cleaned.slice(0, 80) : undefined;
}

/** Trailing and leading noise an object phrase collects. */
function cleanObject(raw: string): string | undefined {
    const cleaned = raw
        .replace(/^(?:to|for|with|into|in|of)\s+/i, '')
        .replace(/^(?:the|a|an|any|some|his|her|their|your|my|one of)\s+/i, '')
        .replace(/\s+(?:please|if (?:you|they|he|she) would)\s*$/i, '')
        .replace(/[,;:.!?]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned.length >= 2 ? cleaned.slice(0, 100) : undefined;
}

/**
 * Words that name nobody.
 */
const NAMES_NOBODY =
    /^(?:around|about|it|this|that|these|those|nothing|anything|something|myself|me|someone|somebody|anyone|anybody|everyone|everybody|people|folk|locals|the locals|a stranger|a passerby|a local)$/i;


// THE COURTESY THAT ASKS FOR NOTHING

/**
 * Standing somebody a round. Ditransitive on purpose - "buy X a drink" has two
 * objects and "buy a drink" has one, so this cannot eat a trip to the market.
 */
const A_ROUND =
    /\b(?:buy|buys|buying|stand|stands|standing|get|gets|getting|order|orders|ordering)\s+(.{2,60}?)\s+(?:a|an|another|one)\s+(?:drink|round|cup|meal|bowl|dinner|supper|tea|wine)\b/i;

/** A gift, which is the same act with a different object. */
const A_GIFT =
    /\b(?:bring|brings|bringing|give|gives|giving|send|sends|sending|take|takes|taking)\s+(.{2,60}?)\s+(?:a|an|some)\s+(?:gift|present|token|something)\b/i;

/**
 * A small thing done for nothing.
 */
const A_SMALL_THING =
    /\b(?:do|does|doing)\s+(?:a\s+(?:small\s+|little\s+)?(?:thing|favour|favor|kindness)|something)\s+for\s+(.{2,60}?)\s*(?:for nothing|and ask nothing|without asking|expecting nothing)?\s*[.!?]?$/i;

const A_SMALL_THING_DITRANSITIVE =
    /\b(?:do|does|doing)\s+(.{2,60}?)\s+a\s+(?:small\s+|little\s+|quiet\s+)?(?:favour|favor|good turn|kindness)\b/i;

/**
 * Turning up, which is the cheapest of the four and the one somebody with
 * nothing at all can still do.
 */
const TURNING_UP =
    /\b(?:turn up|turns up|turning up|call|calls|calling)\s+(?:where|on|in on)\s+(.{2,60}?)\s*(?:is|are|lives|works|stands)?\s*[.!?]?$/i;

const KEEPING_COMPANY =
    /\b(?:sit|sits|sitting|drink|drinks|drinking|eat|eats|eating)\s+with\s+(.{2,60}?)\s*[.!?]?$/i;

const PAYING_A_VISIT =
    /\b(?:pay|pays|paying)\s+(.{2,60}?)\s+a\s+(?:visit|call)\b/i;

const KEEPING_THEM_COMPANY =
    /\b(?:keep|keeps|keeping)\s+(.{2,60}?)\s+company\b/i;

const SPENDING_TIME =
    /\b(?:spend|spends|spending)\s+(?:some\s+|a bit of\s+)?time\s+with\s+(.{2,60}?)\s*[.!?]?$/i;

/** Saying it in the words the refusal used, which must always work. */
const ASKING_NOTHING =
    /\b(?:ask|asks|asking)\s+(.{2,60}?)\s+for\s+nothing\b/i;

const COURTESIES: readonly RegExp[] = [
    A_ROUND,
    A_GIFT,
    A_SMALL_THING,
    A_SMALL_THING_DITRANSITIVE,
    TURNING_UP,
    PAYING_A_VISIT,
    KEEPING_THEM_COMPANY,
    KEEPING_COMPANY,
    SPENDING_TIME,
    ASKING_NOTHING
];

/**
 * A courtesy paid to somebody, or null.
 */
export function courtesyPaidTo(input: string): DirectedRequest | null {
    for (const pattern of COURTESIES) {
        const hit = pattern.exec(input);
        if (!hit) continue;
        const person = cleanPerson(hit[1] ?? '');
        if (!person || NAMES_NOBODY.test(person)) continue;
        return {
            person,
            kind: 'nothing',
            inTheirWords: input.trim().slice(0, 160)
        };
    }
    return null;
}

// WHAT SOMEBODY IS AFTER, WHICH IS A QUESTION AND NOT A REQUEST

/**
 * The three ways somebody asks what another person is chasing.
 */
const WHAT_ARE_THEY_AFTER: readonly RegExp[] = [
    // FIRST, because it is the only one that names the person BEFORE the word
    // "what". Left below the others it lost "ask Jiang Anyi what she wants" to
    // the bare pattern, which read the pronoun as the person and resolved a
    // party called "she" - the addressee silently replaced, which is the exact
    // defect the request parser was written to fix one layer up.
    /\b(?:ask|asks|asking|find out(?: from)?)\s+(.{2,60}?)\s+what\s+(?:he|she|they|it)\s+(?:wants?|is after|are after|is chasing)\b/i,
    /\bwhat\s+(?:does|do|is|are)\s+(.{2,60}?)\s+(?:want|wants|after|chasing|looking for|trying to (?:do|get))\b/i,
    /\bwhat\s+(.{2,60}?)\s+(?:wants|is after|is chasing|is looking for)\b/i
];

/**
 * The first person, who is not somebody you can ask this about.
 *
 * "What do I want" is a question for the person playing and "what does it
 * want" names no person at all. Both fall through untouched.
 */
const NOT_A_PERSON_TO_ASK_ABOUT =
    /^(?:i|me|my|we|us|you|your|it|this|that|everyone|everybody|anyone|anybody|people|folk|they|them)$/i;

/**
 * The person somebody is asking about, or null.
 */
export function askingWhatSomebodyIsAfter(input: string): string | null {
    // A PRICE QUESTION IS NOT A WANT QUESTION
    if (askingWhatItWouldTake(input) !== null) return null;

    for (const pattern of WHAT_ARE_THEY_AFTER) {
        const hit = pattern.exec(input);
        if (!hit) continue;
        const person = cleanPerson(hit[1] ?? '');
        if (!person) continue;
        if (NAMES_NOBODY.test(person) || NOT_A_PERSON_TO_ASK_ABOUT.test(person)) continue;
        return person;
    }
    return null;
}

// WHAT WOULD IT TAKE

/** How the price is named, in the ways somebody actually asks for it. */
const A_PRICE_WORD =
    '(?:what (?:it|that) would take|what (?:they|she|he|you) would (?:take|want|accept)'
    + '|what (?:they|she|he|you) wants?|what (?:their|her|his|your) price is'
    + '|(?:their|her|his|your|the) price|how much (?:they|she|he|you) wants?'
    + '|what (?:it|one) would cost|what (?:they|she|he|you) would need)';

/**
 * The verb-led form: a person is named, then the price is asked after.
 */
const ASKING_SOMEBODY_THEIR_PRICE = new RegExp(
    '\\b(?:ask|asks|asking|put it to|sound out|sounds out)\\s+(.{2,60}?)\\s+'
    + A_PRICE_WORD
    + '\\s+(?:for|to part with|to give up|to let go of)\\s+(.{2,100})$',
    'i'
);

/**
 * The interrogative form, which is how most people write it.
 *
 * "what would Elder Xu take for a Meridian Rebirth Pill", "what is Elder Xu's
 * price for one".
 */
const WHAT_WOULD_THEY_TAKE = new RegExp(
    '\\bwhat\\s+(?:would|will|does|do)\\s+(.{2,60}?)\\s+'
    + '(?:take|want|accept|ask)\\s+(?:for|in exchange for|in return for)\\s+(.{2,100})$',
    'i'
);

const WHAT_IS_THEIR_PRICE_FOR = new RegExp(
    '\\bwhat(?:\'s|s| is)\\s+(.{2,60}?)(?:\'s|s\')?\\s+price\\s+for\\s+(.{2,100})$',
    'i'
);

/**
 * The form that names the thing first and the person last, which is the one
 * somebody types straight after being told what would mend them.
 *
 * "what would it take to get a Meridian Rebirth Pill from Elder Xu".
 */
const WHAT_WOULD_IT_TAKE_TO_GET = new RegExp(
    '\\bwhat\\s+would\\s+it\\s+take\\s+to\\s+(?:get|obtain|have|acquire|be given|buy)\\s+'
    + '(.{2,100}?)\\s+(?:from|off|out of)\\s+(.{2,60})$',
    'i'
);

/**
 * THE OWNER'S OWN SENTENCE, WHICH NAMES NOBODY.
 */
const I_NEED_THIS_WHAT_IS_YOUR_PRICE = new RegExp(
    '\\bi\\s+(?:need|want|am after|am looking for)\\s+(.{2,100}?)\\s*[,.;:-]*\\s*'
    + '(?:so\\s+)?what(?:\'s|s| is| would be)?\\s+(?:your|their|his|her|the)\\s+price'
    + '(?:\\s+for\\s+(?:it|one|that))?\\s*[?.!]*$',
    'i'
);

/** The pointing phrase the nameless form is put to. See the pattern above. */
const WHOEVER_IS_HERE = 'someone';

/**
 * Somebody named, and what they would take for a named thing, or null.
 */
export function askingWhatItWouldTake(input: string): DirectedRequest | null {
    const straight: readonly (readonly [RegExp, 0 | 1])[] = [
        // [pattern, which capture is the PERSON]
        [ASKING_SOMEBODY_THEIR_PRICE, 0],
        [WHAT_WOULD_THEY_TAKE, 0],
        [WHAT_IS_THEIR_PRICE_FOR, 0],
        [WHAT_WOULD_IT_TAKE_TO_GET, 1]
    ];

    for (const [pattern, personAt] of straight) {
        const hit = pattern.exec(input);
        if (!hit) continue;
        const person = cleanPerson(hit[1 + personAt] ?? '');
        const thing = cleanObject(hit[1 + (personAt === 0 ? 1 : 0)] ?? '');
        if (!person || NAMES_NOBODY.test(person)) continue;
        return {
            person,
            kind: 'terms',
            ...(thing ? { object: thing } : {}),
            inTheirWords: input.trim().slice(0, 160)
        };
    }

    const nameless = I_NEED_THIS_WHAT_IS_YOUR_PRICE.exec(input);
    if (nameless) {
        const thing = cleanObject(nameless[1] ?? '');
        if (thing) {
            return {
                person: WHOEVER_IS_HERE,
                kind: 'terms',
                object: thing,
                inTheirWords: input.trim().slice(0, 160)
            };
        }
    }
    return null;
}

// PUTTING SOMETHING DOWN THAT IS NOT MONEY

/**
 * The words that can only mean a swap, tried before the bare one.
 */
const AN_UNAMBIGUOUS_SWAP = /\s+(?:in exchange for|in return for|in trade for|in place of)\s+/i;

/** The bare one. Read last-first, per the note above. */
const A_BARE_SWAP = /\s+(?:for|against)\s+/gi;

/**
 * Where the offered half stops and the wanted half starts, or null.
 *
 * Returns the index and length of the swap phrase in the input.
 */
function whereTheSwapIs(input: string): { index: number; length: number } | null {
    const clear = AN_UNAMBIGUOUS_SWAP.exec(input);
    if (clear) return { index: clear.index, length: clear[0].length };

    let last: { index: number; length: number } | null = null;
    for (const hit of input.matchAll(A_BARE_SWAP)) {
        last = { index: hit.index, length: hit[0].length };
    }
    return last;
}

/**
 * Where the person stops and the thing being put down starts.
 */
const WHERE_WHAT_IS_PUT_DOWN_STARTS = new RegExp(
    '\\b(?:offer|offers|offering|trade|trades|trading|swap|swaps|swapping'
    + '|exchange|exchanges|exchanging|give|gives|giving)\\s+(.{2,60}?)\\s+'
    + '(?=(?:the|a|an|my|his|her|their|your|our|its|one|some|any|this|that|these|those'
    + '|\\d+)\\b)(.{2,120})$',
    'i'
);

/**
 * A trade put to somebody, or null.
 */
export function puttingSomethingDownFor(input: string): DirectedRequest | null {
    // The swap is found on the whole sentence first, so that a `for` inside
    // what is being put down cannot be mistaken for the swap itself.
    const swap = whereTheSwapIs(input);
    if (!swap) return null;

    const left = input.slice(0, swap.index);
    const right = input.slice(swap.index + swap.length);

    const hit = WHERE_WHAT_IS_PUT_DOWN_STARTS.exec(left);
    if (!hit) return null;

    const person = cleanPerson(hit[1] ?? '');
    if (!person || NAMES_NOBODY.test(person)) return null;

    const putDown = cleanObject(hit[2] ?? '');
    const wanted = cleanObject(right);
    if (!putDown || !wanted) return null;

    return {
        person,
        kind: 'a_trade',
        object: wanted,
        putDown,
        inTheirWords: input.trim().slice(0, 160)
    };
}

// ─────────────────────────────────────────────────────────────────────────
// CLASSIFYING THE ASK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Being taken on, which is a request about the PERSON and not about an art.
 */
const ASKING_TO_BE_TAKEN_ON =
    /\b(?:take me (?:on\b|as (?:a|your|his|her|their) (?:disciple|student|pupil|apprentice))|take me under|accept me as (?:a |your |his |her |their )?(?:disciple|student|pupil|apprentice)|make me (?:your|his|her|their|a) (?:disciple|student|pupil|apprentice)|be my (?:master|teacher|mentor|shifu|sifu)|become my (?:master|teacher|mentor)|(?:disciple|student|apprentice)ship|have me as (?:a|your|his|her|their) (?:disciple|student|pupil|apprentice))\b/i;

/**
 * Being taught, and being handed the book, which end in the same place.
 */
const ASKING_TO_BE_TAUGHT =
    /\b(?:teach me|teach it to me|train me|tutor me|instruct me|show me|guide me|guide my cultivation|carry me (?:through|across)|take me through|walk me through|teach)\b/i;

/** The phrase that names WHICH art, once the clause is known to be a teaching. */
const AFTER_THE_TEACHING_VERB =
    /\b(?:teach me|teach it to me|train me in|train me|tutor me in|tutor me|instruct me in|instruct me|show me|guide me in|guide me through|guide me|take me through|walk me through|carry me through|carry me across|teach)\b\s*(?:the|a|an|in|how to|about)?\s*/i;

/**
 * Being put in front of somebody.
 */
const ASKING_FOR_AN_INTRODUCTION =
    /\b(?:introduce me|an introduction|put in a (?:good )?word|speak for me|vouch for me|recommend me|present me to|take me to (?:meet|see))\b/i;

const AFTER_THE_INTRODUCTION_PHRASE =
    /\b(?:introduce me to|introduce me|an introduction to|an introduction|put in a (?:good )?word with|put in a (?:good )?word to|speak for me (?:to|with)|vouch for me (?:to|with)|recommend me to|present me to|take me to (?:meet|see))\s*(?:the|a|an)?\s*/i;

/** Being told something. `about` never reaches here - see the pivot rule. */
const ASKING_TO_BE_TOLD =
    /\b(?:tell me|news of|word of|the name of|directions|the way to|what (?:he|she|they) knows?)\b/i;

const AFTER_THE_TELLING_PHRASE =
    /\b(?:tell me (?:about|of|where|who|what)|tell me|news of|word of|the name of|directions to|directions|the way to|what (?:he|she|they) knows? (?:about|of))\s*(?:the|a|an)?\s*/i;

/** What follows the phrase that named the KIND. Undefined when nothing does. */
function objectAfter(clause: string, marker: RegExp): string | undefined {
    const hit = marker.exec(clause);
    if (!hit) return cleanObject(clause);
    return cleanObject(clause.slice(hit.index + hit[0].length).trim());
}

/**
 * What kind of thing this clause is asking for, and what it names.
 */
function classify(clause: string): { kind: RequestKind; object?: string } {
    if (clause.trim().length === 0) return { kind: 'unstated' };

    if (ASKING_TO_BE_TAKEN_ON.test(clause)) return { kind: 'discipleship' };
    if (ASKING_TO_BE_TAUGHT.test(clause)) {
        return { kind: 'teaching', object: objectAfter(clause, AFTER_THE_TEACHING_VERB) };
    }
    if (ASKING_FOR_AN_INTRODUCTION.test(clause)) {
        return {
            kind: 'introduction',
            object: objectAfter(clause, AFTER_THE_INTRODUCTION_PHRASE)
        };
    }
    if (ASKING_TO_BE_TOLD.test(clause)) {
        return { kind: 'telling', object: objectAfter(clause, AFTER_THE_TELLING_PHRASE) };
    }

    // Everything else that named something is a THING being asked for. The
    // caller decides what it turns out to be - an art resolved out of this
    // branch is upgraded to `teaching`, because asking somebody for a book and
    // asking them to teach you it end in the same place.
    const named = cleanObject(clause);
    return named ? { kind: 'a_thing', object: named } : { kind: 'unstated' };
}

// ─────────────────────────────────────────────────────────────────────────
// THE ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────

/**
 * One request put to one person, or null when the sentence is not one.
 */
export function requestPutToSomebody(input: string): DirectedRequest | null {
    // The act that asks for nothing, first, because none of its phrasings has
    // a request verb in it and several of them contain words that other
    // branches want ("buy", "sit", "turn up").
    const courtesy = courtesyPaidTo(input);
    if (courtesy) return courtesy;

    // THE PRICE, AND THE THING PUT DOWN FOR IT
    const price = askingWhatItWouldTake(input);
    if (price) return price;

    const trade = puttingSomethingDownFor(input);
    if (trade) return trade;

    const verb = REQUEST_VERB.exec(input);
    if (!verb) return null;

    const rest = input
        .slice(verb.index + verb[0].length)
        .replace(/[.!?]+\s*$/, '')
        .trim();
    if (rest.length < 2) return null;

    const pivot = WHERE_THE_ASK_STARTS.exec(rest);
    if (!pivot) return null;

    const person = cleanPerson(rest.slice(0, pivot.index));
    if (!person || NAMES_NOBODY.test(person)) return null;

    // Everything from the pivot on, INCLUDING the pivot word, because "for the
    // Iron Bell Manual" and "to teach me the Iron Bell Manual" are different
    // asks and the difference is the word this would otherwise eat.
    const clause = rest.slice(pivot.index).trim();
    if (A_QUESTION_RATHER_THAN_A_REQUEST.test(clause)) return null;

    // ── THE PURSE IS NOT THE ASK ─────────────────────────────────────────
    //
    // "with 60 spirit stones to teach me the manual" contains both, and the
    // sum is already read by `stonesNamedIn` off the whole sentence. Dropping
    // the money clause here leaves the ask; leaving it in would classify a
    // teaching request as a request for sixty spirit stones.
    const withoutTheMoney = clause
        .replace(THE_MONEY, ' ')
        .replace(/^\s*(?:with|for)\s+/i, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const { kind, object } = classify(withoutTheMoney);
    if (kind === 'unstated') return null;

    return {
        person,
        kind,
        ...(object ? { object } : {}),
        inTheirWords: withoutTheMoney.slice(0, 160)
    };
}
