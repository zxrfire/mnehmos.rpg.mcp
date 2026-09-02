/**
 * ASKING A PERSON FOR SOMETHING: WHO IT IS PUT TO, AND WHAT IS BEING ASKED.
 *
 * The verb the whole design rests on, and it did not exist. Measured over the
 * real endpoint, with named people standing in the same square as the player:
 *
 *   I ask Jiang Anyi to teach me                the roster of everyone above me
 *   I beg Jiang Anyi to take me as a disciple   a description of Jiang Anyi
 *   ask Jiang Anyi for the Lesser Qi-Gathering  the almanac entry for the book
 *   I offer Jiang Anyi 20 stones to teach me    the roster, again
 *   I bribe Han Peiru with 60 spirit stones     "Han Peiru agreed." Agreed to what?
 *
 * Four verbs, four different lookups, and not one of them reached the person.
 * The last line is the whole diagnosis in one sentence: **a request had no
 * object.** The pressure model that decides whether somebody says yes has been
 * finished and wired for a while; what was missing was any way to say what you
 * were asking them for.
 *
 * ── THE TWO DEFECTS THIS MODULE IS THE FIX FOR ───────────────────────────
 *
 * ONE PHRASE WAS BEING SWALLOWED HIGHER UP. `teach me` is a member of
 * `TEACHER_QUESTION`, correctly - "who can teach me" is a question about the
 * roster and it is one of the three questions a stuck player asks. But it was
 * tested before anything looked at whether a PERSON had been named, so putting
 * the same two words to somebody standing in front of you returned the register
 * of everybody standing above you. `AGENTS.md` is explicit that the repair for
 * that is precedence and never a wider pattern - the last widening in this file
 * stole sentences from `investigate` and from place resolution - so this module
 * changes no existing pattern at all. It sits in front of them and takes only
 * the sentences that name somebody AND say what is wanted of them.
 *
 * AND THE NAME WAS BEING READ OUT OF AN UNPARSED CLAUSE. `extractSubject` takes
 * everything after the verb, so "I bribe Han Peiru with 60 stones to introduce
 * me to the elder" resolved a party called
 *   "Han Peiru with 60 spirit stones to introduce me to the elder"
 * against a roster of two-word names, and matched nobody. That is the
 * shared-resolver problem in its most visible form: every social verb was
 * finding its own target its own way. Splitting the sentence ONCE, here, and
 * handing the two halves to the one party resolver is the fix, and it is why
 * this module returns a person and an ask rather than an action.
 *
 * ── WHAT IT MAY AND MAY NOT DECIDE ───────────────────────────────────────
 *
 * Pure. A string in, a shape out, no catalog, no repository, no I/O. It says
 * what SHAPE the sentence has and never what the world does about it:
 *
 *   - it names the person phrase, and does not resolve it
 *   - it names the object phrase, and does not resolve it
 *   - it classifies the ask into a closed set, and does not price it
 *
 * The closed set is the important part. `actions.ts` states the rule this
 * module was most at risk of breaking - nothing in the engine may branch on the
 * player's own verb to decide an outcome - and `RequestKind` is not that verb.
 * It is what is being asked FOR, which is the axis `AskWeight` already prices
 * and the axis `asking.md` says decides everything: *"Asking a gate guard for a
 * name and asking the same guard to leave the gate unwatched are the same
 * sentence with the same charm behind it, and they are not remotely the same
 * attempt."* Bribing, begging, offering and asking politely all produce the
 * same kinds here, which is the proof that the verb is not being read.
 *
 * Nothing here is a permission check. Anybody may ask anybody for anything;
 * `AGENTS.md` forbids the removed verb and requires the priced one, so a
 * sentence this module can shape is a sentence the engine will put to somebody,
 * however badly it is going to go.
 */

import type { AskWeight } from '../engine/social-leverage/index.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT IS BEING ASKED FOR
// ─────────────────────────────────────────────────────────────────────────

/**
 * The shape of the ask, which is not the verb it was asked with.
 *
 * Five, and each one exists because it ends somewhere different: teaching
 * writes an art onto the sheet, an introduction writes a name into the
 * knowledge table, discipleship writes a guide, telling routes to the answer
 * machinery that already works, and a thing is a thing.
 *
 *   teaching       be taught an art, or handed the book of one
 *   discipleship   be taken on - the person, not the art
 *   introduction   be put in front of somebody they can reach and you cannot
 *   telling        be told something they know
 *   a_thing        be given, lent or sold an object
 *   unstated       somebody was named and nothing was asked of them
 */
export type RequestKind =
    | 'teaching'
    | 'discipleship'
    | 'introduction'
    | 'telling'
    | 'a_thing'
    | 'unstated';

/**
 * What a request of each kind costs the person it is put to, before anything
 * about the specific thing is known.
 *
 * The floor and not the answer. `AskWeight`'s own definition of `a_courtesy` is
 * "a name, a direction, an introduction - costs them nothing", which is what
 * puts three of these where they are; and the caller RAISES teaching once it
 * knows whose art it is, because handing somebody a house's own road is not the
 * same act as handing them a primer every stall in the province sells. That
 * escalation is derived from `manuals.ts` rather than asserted here - see
 * `GameService.request`.
 */
export function baseWeightOf(kind: RequestKind): AskWeight {
    switch (kind) {
        case 'telling':
        case 'introduction':
        case 'unstated':
            return 'a_courtesy';
        case 'teaching':
        case 'discipleship':
        case 'a_thing':
            return 'a_real_favour';
    }
}

export interface DirectedRequest {
    /**
     * The person phrase, trimmed at the clause that stops naming them.
     *
     * Never empty: a request put to nobody is not a request, and this module
     * returns null rather than guessing who was meant. It may still be a
     * POINTING phrase - "the elder", "her" - which the caller resolves the same
     * way every other approach resolves one.
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
     * The ask in the player's own words, verbatim and capped.
     *
     * Echoed back so a refusal can be phrased in the terms it was asked in,
     * which is the whole texture of `petition` and is right here for the same
     * reason. Read by no conditional anywhere.
     */
    inTheirWords: string;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SPLIT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The verbs that put a request to a person.
 *
 * Two families and they are deliberately in one list. `ask`, `beg`, `entreat`
 * are asking; `bribe`, `offer`, `pay` are asking with something on the table.
 * The engine prices what is on the table through `leverage`, which the existing
 * parser already sets, and prices what is being ASKED through the kind - so
 * putting both families here is what makes "I ask him to teach me" and "I bribe
 * him to teach me" the same request with different money behind it, rather than
 * two unrelated sentences reaching two unrelated lookups. Which is what they
 * were.
 *
 * `petition` is absent on purpose. It is an institutional act with its own
 * verb, its own record and its own refusal, and taking its sentences here would
 * be the exact mistake `AGENTS.md` files under "fix the gap that was
 * demonstrated, not the one you imagined". `talk`, `speak` and `press` are
 * absent for the same reason from the other direction: they belong to
 * `interact`, they carry no ask, and every sentence they open is already
 * answered.
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
 *
 * The single most load-bearing regex in the module, and it is short because it
 * has to be: every one of these words can only introduce the ask, never part of
 * a name. `with` is here because a purse is stated with it - "bribe X with 60
 * spirit stones" - and dropping it is what produced a party phrase sixty
 * characters long.
 */
const WHERE_THE_ASK_STARTS = /\s+(?:to|for|with|into|about|regarding|concerning)\s+/i;

/**
 * The pivots that open a question rather than a request.
 *
 * "I ask her about the ruins" already reaches a person and gets a real answer
 * out of `askAround`, which reads what they could know, what they are placed to
 * say and what saying it would cost. That path is good and this module must not
 * take it: `AGENTS.md`'s rule about fixing the gap that was demonstrated cuts
 * exactly here.
 */
const A_QUESTION_RATHER_THAN_A_REQUEST = /^\s*(?:about|regarding|concerning)\b/i;

/** A sum on the table, in either of the two ways somebody writes one. */
const THE_MONEY = /\b(?:with|for)?\s*\d[\d,]*\s*(?:spirit\s+)?stones?\b/i;

/**
 * Leading and trailing noise a person phrase collects.
 *
 * The trailing half is the one that matters: "I offer Jiang Anyi 20 spirit
 * stones to teach me" puts the purse BETWEEN the name and the ask, so the split
 * lands after it and the name arrives with sixty spirit stones stuck to the end
 * of it.
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
 *
 * A request put to "someone" or "around" names no addressee, and the machinery
 * that answers those - `askAround`, `somebodyAtHand` - already exists and is
 * reached by falling through. Pointing phrases are deliberately NOT here: "the
 * elder" and "her" describe a person who is standing there, and the caller
 * resolves them the same way every other approach does.
 */
const NAMES_NOBODY =
    /^(?:around|about|it|this|that|these|those|nothing|anything|something|myself|me|someone|somebody|anyone|anybody|everyone|everybody|people|folk|locals|the locals|a stranger|a passerby|a local)$/i;

// ─────────────────────────────────────────────────────────────────────────
// CLASSIFYING THE ASK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Being taken on, which is a request about the PERSON and not about an art.
 *
 * Tested first, because "take me as your disciple and teach me the Iron Bell"
 * is one sentence and the discipleship is the bigger half of it: somebody who
 * agrees to take you on has agreed to the teaching as well, and somebody who
 * agrees to teach you one art has not agreed to take you on.
 */
const ASKING_TO_BE_TAKEN_ON =
    /\b(?:take me (?:on\b|as (?:a|your|his|her|their) (?:disciple|student|pupil|apprentice))|take me under|accept me as (?:a |your |his |her |their )?(?:disciple|student|pupil|apprentice)|make me (?:your|his|her|their|a) (?:disciple|student|pupil|apprentice)|be my (?:master|teacher|mentor|shifu|sifu)|become my (?:master|teacher|mentor)|(?:disciple|student|apprentice)ship|have me as (?:a|your|his|her|their) (?:disciple|student|pupil|apprentice))\b/i;

/**
 * Being taught, and being handed the book, which end in the same place.
 *
 * `manuals.md` treats them as one road with two surfaces - "a teacher and no
 * book at all" is one of the three shapes admission takes - and both resolve
 * through `handleLearn` with `provenance: 'taught_by_a_person'`. Keeping them
 * apart here would be a distinction the engine could not act on.
 */
const ASKING_TO_BE_TAUGHT =
    /\b(?:teach me|teach it to me|train me|tutor me|instruct me|show me|guide me|guide my cultivation|carry me (?:through|across)|take me through|walk me through|teach)\b/i;

/** The phrase that names WHICH art, once the clause is known to be a teaching. */
const AFTER_THE_TEACHING_VERB =
    /\b(?:teach me|teach it to me|train me in|train me|tutor me in|tutor me|instruct me in|instruct me|show me|guide me in|guide me through|guide me|take me through|walk me through|carry me through|carry me across|teach)\b\s*(?:the|a|an|in|how to|about)?\s*/i;

/**
 * Being put in front of somebody.
 *
 * The cheapest thing in the game and the most valuable, because
 * `whoWouldTeach` already ends on the sentence this is the answer to: *"You
 * have no name to ask for, which is the whole of what is stopping you."*
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
 *
 * Order is by how much the answer would change if it were wrong, which is the
 * same rule `resolveAnything` orders by. Being taken on outranks being taught
 * outranks being introduced, because each of those is a superset of the next in
 * what it commits the other person to.
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
 *
 * Null is the common case and it is deliberately easy to reach. This runs ahead
 * of a dozen working branches, so anything it is not certain about must fall
 * through to them: no request verb, no person, a question rather than a
 * request, or nothing actually asked for all return null and leave the sentence
 * exactly where it was.
 *
 * The last of those is what keeps the existing bribe path intact. "I bribe the
 * gate steward" names a person and asks for nothing, and it has its own guiding
 * refusal - *"a bribe is a number said out loud"* - which this must not take
 * away from it.
 */
export function requestPutToSomebody(input: string): DirectedRequest | null {
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
