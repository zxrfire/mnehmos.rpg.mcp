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
 *   terms          what would it take - the price asked before it is paid
 *   a_trade        something put down for it that is not money
 *   unstated       somebody was named and nothing was asked of them
 */
export type RequestKind =
    | 'teaching'
    | 'discipleship'
    | 'introduction'
    | 'telling'
    | 'a_thing'
    /**
     * ASKING WHAT IT WOULD TAKE, WHICH IS NOT ASKING FOR IT.
     *
     * The design owner's sentence, verbatim: *"just be like: I need xyz, what's
     * your price?"* Nothing in the game accepted it.
     *
     * The gap it closes was demonstrated in play. `see a physician` on a
     * crippling meridian tear names the medicine, names its grade, and then
     * says *"Nobody sells one of these for stones... a favour owed, something
     * out of a hole nobody else has been down, or an art."* That refusal is
     * correct and it meets the standard `asking.md` sets - and there was no
     * verb anywhere that took what it advised. Every heaven-grade and above
     * cure in the catalog was unobtainable, and the game said so in a sentence
     * a player could not act on.
     *
     * It is a courtesy in weight and that is not a convenience: asking somebody
     * what they want for a thing costs them a sentence, which is exactly what
     * `AskWeight.a_courtesy` means. What it is NOT is free of consequence -
     * they now know you are looking for it, and knowing that about somebody is
     * worth something to the sort of person who holds one.
     */
    | 'terms'
    /**
     * PUTTING SOMETHING DOWN THAT IS NOT MONEY.
     *
     * The other half, and the one that makes the first half worth having.
     * `items.md`: above the line cash *"is simply not the medium"*, and what
     * moves people is *"a favour owed"* or *"another singular thing"*. The
     * existing shapes all assume the thing being asked for is the whole of the
     * sentence; this is the shape with two objects in it - what you want and
     * what you are putting down for it - and it is the only one of the seven
     * where the player names something of their own.
     *
     * Nothing here decides whether the trade is a good one. That is
     * `what-somebody-would-take-for-a-thing-they-will-not-sell.ts`, which
     * prices both sides on one scale and never asks what kind of thing either
     * of them is.
     */
    | 'a_trade'
    /**
     * THE ONE THAT ASKS FOR NOTHING, and the reason the rest of them are
     * reachable at all.
     *
     * A refusal that names a route the game has not built is the defect this
     * whole verb was written to fix, arriving one layer deeper - and the first
     * draft of these refusals did exactly that. They said *"turn up twice, buy
     * somebody a drink, do a small thing for nothing, and ask again"*, which is
     * `asking.md` quoted almost verbatim and was three sentences the parser had
     * no branch for. Typed back, all three hit a wall.
     *
     * So this is the sentence those refusals name, and it is a real act with a
     * real cost: a day, and nothing else. `asking.md` is exact about why it has
     * to be free of everything except time - *"this is the cheapest lever in
     * the game and it is available to a cultivator with nothing"* - and about
     * what it buys, which is not information and not a favour. It is being
     * somebody they have met.
     */
    | 'nothing'
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
     * What the player is putting down for it, as they wrote it.
     *
     * Only ever set on `a_trade`, which is the one shape in this module with
     * two objects in it. Resolved by the caller against everything the player
     * actually holds - arts, objects, what they could undertake - and priced by
     * one question rather than by what kind of thing it turns out to be. See
     * `what-somebody-would-take-for-a-thing-they-will-not-sell.ts`.
     */
    putDown?: string;
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
// THE COURTESY THAT ASKS FOR NOTHING
//
// Its own matcher, because none of these sentences has a request verb in it.
// "I buy him a drink" is not asking for anything and the whole point of it is
// that it is not; putting it through `REQUEST_VERB` would be inventing an ask
// where the player deliberately made none.
//
// Every one of these is a phrasing the refusals SAY, and that is the rule this
// block exists to keep: a refusal may only name a door somebody can walk
// through. `asking.md`'s own list is "a round, a gift, a favour, turning up
// twice", and all four are here.
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * `help` is deliberately absent in its bare form. It is one of the commonest
 * words in the language and it is already a member of `askWeightOf`'s real
 * favour list, so taking every sentence with `help` in it would be the
 * widening `AGENTS.md` files under "fix the gap that was demonstrated".
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
 *
 * Null for everything else, and that includes every sentence where the phrase
 * that would be the person is not one: "buy a drink" has no second object and
 * does not match at all, and "sit with the fire" resolves to nobody later and
 * is refused with the room attached, the same as any other unresolvable name.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT SOMEBODY IS AFTER, WHICH IS A QUESTION AND NOT A REQUEST
//
// Its own matcher for the same reason the courtesy has one: none of these
// sentences has a request verb in the place the split expects, and the two
// that do - "ask her what she wants" - put a clause where an object should be,
// so `WHERE_THE_ASK_STARTS` never fires and every phrasing fell through to
// `unclear` or to a `talk` with the topic "she wants".
//
// Measured before this existed, at the real parser: "what does Jiang Anyi
// want", "what is Jiang Anyi after" and "what is Jiang Anyi looking for" all
// came back `{"action":"unclear"}`, while `resolveAttempt` was pricing a term
// for precisely that fact and reading `false` for it in every attempt ever
// made. A term the engine reads and the player has no sentence for is a term
// nobody can play toward.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The three ways somebody asks what another person is chasing.
 *
 * Every one requires the WORD that names the wanting - want, after, chasing,
 * looking for - so nothing here can take a sentence off `assess`, off
 * `askAround` or off the roster questions. "What does she know" and "who is
 * she" are untouched, which was checked rather than assumed.
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
 *
 * Returns the phrase and never resolves it: the caller puts it through the same
 * party resolver every other social verb uses, so a name that reaches nobody
 * gets the same guiding refusal here as it does anywhere else.
 */
export function askingWhatSomebodyIsAfter(input: string): string | null {
    // ── A PRICE QUESTION IS NOT A WANT QUESTION ──────────────────────────
    //
    // "ask Elder Xu what she wants" asks what she is chasing. "ask Elder Xu
    // what she wants FOR a Meridian Rebirth Pill" asks her price for a named
    // thing, and the first pattern below matches both - so without this the
    // price question is answered with her open goals and the thing she was
    // asked about is dropped on the floor.
    //
    // PRECEDENCE AND NOT A NARROWER PATTERN, which is the repair `AGENTS.md`
    // requires: the want patterns are unchanged, every sentence they used to
    // take they still take, and the only ones they lose are the ones that name
    // a thing to be priced - which is a sentence they were answering wrongly.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT WOULD IT TAKE
//
// Its own matchers, ahead of the generic split, for the reason the courtesy
// block above has its own: the split takes the FIRST of `to|for|with|...` and
// every sentence here has one of those words inside the part that names the
// person or inside the part that names the price. "ask Elder Xu what she wants
// for a Meridian Rebirth Pill" split on the first `for` resolves a party called
// "Elder Xu what she wants", which is the same defect the module header records
// for "bribe Han Peiru with 60 stones to introduce me".
//
// ── WHY THESE SENTENCES AND NOT A WIDER PATTERN ──────────────────────────
//
// `AGENTS.md`: fix the gap that was demonstrated, not the one you imagined.
// The demonstrated gap is one sentence the design owner wrote down - *"I need
// xyz, what's your price?"* - and the refusal that produced it names three
// media and no verb. Every pattern below requires a word that NAMES A PRICE
// (`price`, `want`, `take`, `accept`, `what it would take`) or a word that
// NAMES A SWAP (`for`, `in exchange for`, `in return for`) with two objects
// around it. None of them can take a sentence that reached something before:
// "what does she want" with no object is the want read and is left alone,
// "ask her for the manual" has no price word, and "I offer him 60 stones" has
// no second object.
// ─────────────────────────────────────────────────────────────────────────

/** How the price is named, in the ways somebody actually asks for it. */
const A_PRICE_WORD =
    '(?:what (?:it|that) would take|what (?:they|she|he|you) would (?:take|want|accept)'
    + '|what (?:they|she|he|you) wants?|what (?:their|her|his|your) price is'
    + '|(?:their|her|his|your|the) price|how much (?:they|she|he|you) wants?'
    + '|what (?:it|one) would cost|what (?:they|she|he|you) would need)';

/**
 * The verb-led form: a person is named, then the price is asked after.
 *
 * "ask Elder Xu what she wants for a Meridian Rebirth Pill", and the same
 * sentence with `her price`, `how much she wants`, `what it would take`.
 *
 * THE NAMED THING IS REQUIRED AND THAT IS THE WHOLE OF WHAT KEEPS THIS OFF
 * THE WANT READ. "ask Elder Xu what she wants" is a question about what she is
 * chasing and `askingWhatSomebodyIsAfter` answers it well; the same words plus
 * `for <a thing>` are a question about her price. Without the `for` clause this
 * pattern would take both, and the one it would take wrongly is the one that
 * already worked - which is precisely the swallowing `AGENTS.md` records this
 * file causing once already, from the other direction.
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
 *
 * *"I need xyz, what's your price?"* is said to whoever you are dealing with,
 * so it carries no name, and the module's contract already allows a POINTING
 * phrase in place of one - *"which the caller resolves the same way every other
 * approach resolves one"*. `someone` is a member of `POINTING` in `game.ts`, so
 * it lands on a face the player could actually walk up to rather than on
 * nobody, which is what every other nameless approach in the game already does.
 *
 * A refusal that names a door has to be typeable in the words it used, and this
 * is those words.
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
 *
 * Exported so a test can pin the phrasings without going through the whole
 * parser, and so that the "is this sentence a price question" answer is asked
 * once and in one place.
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

// ─────────────────────────────────────────────────────────────────────────
// PUTTING SOMETHING DOWN THAT IS NOT MONEY
//
// The shape with two objects in it. Everything else in this module asks for
// one thing; this names a thing wanted and a thing offered, and the swap word
// between them is what tells them apart.
//
// `THE_MONEY` is deliberately NOT stripped out of the offered half here, unlike
// everywhere else in the file. A player who offers stones for something above
// the cash line has made a real move and is owed the real answer - `items.md`
// says offering money up there *"reads as not understanding what you are
// looking at"*, and that is a sentence somebody should get back rather than a
// sentence the parser quietly prevents them from making.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The words that can only mean a swap, tried before the bare one.
 *
 * `for` is the word everybody actually types and it is also the commonest
 * preposition in the language, so a sentence like *"offer Elder Xu a place for
 * her daughter in return for the pill"* has two of them and only the second is
 * the swap. These are unambiguous, so they win outright; where none is present
 * the LAST `for` is taken, which gets the same sentence right for the same
 * reason and gets the ordinary one-`for` sentence right trivially.
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
 *
 * "offer Elder Xu the Iron Bell Manual" is a verb and three phrases with no
 * punctuation between them, and a non-greedy person phrase takes "Elder" and
 * leaves "Xu the Iron Bell Manual". The boundary that actually works is the
 * determiner: what somebody puts down is almost always introduced by one, and
 * a name almost never contains one.
 *
 * KNOWN LIMIT, WRITTEN DOWN RATHER THAN GUESSED AROUND: an offered thing that
 * opens on a bare noun - "offer Elder Xu passage through the pass for one" -
 * has no determiner to find, and the sentence falls through to the ordinary
 * request path rather than resolving a person wrongly. Falling through is the
 * safe direction: the player gets the answer they got before instead of an
 * attempt made on somebody the sentence was not about, which is the failure
 * `POINTING_AT_A_RANK` in `game.ts` exists because of.
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
 *
 * Returns null unless BOTH halves are there, because a sentence with one object
 * is one of the shapes that already worked and taking it would be the widening
 * `AGENTS.md` files under "fix the gap that was demonstrated".
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
    // The act that asks for nothing, first, because none of its phrasings has
    // a request verb in it and several of them contain words that other
    // branches want ("buy", "sit", "turn up").
    const courtesy = courtesyPaidTo(input);
    if (courtesy) return courtesy;

    // ── THE PRICE, AND THE THING PUT DOWN FOR IT ─────────────────────────
    //
    // Both ahead of the generic split for the reason their own banner gives:
    // the split takes the first `to|for|with`, and both of these shapes have
    // one of those words in the middle of what they are naming.
    //
    // The price question first. A sentence that asks what somebody would take
    // FOR a thing and a sentence that offers a thing for another are told apart
    // by whether a price word is in it, and "what would you take for the manual"
    // has one where "trade you the manual for the pill" does not.
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
