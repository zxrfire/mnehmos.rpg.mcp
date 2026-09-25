/**
 * What a member says to their own house, and what a seat may order.
 */

import { PlannedAction } from './planned-action.js';
import { usedAsVerb, namedAfter, matchIntent, WORD_NUMBER_ALTERNATION } from './sentence-parts.js';
import {
    A_HOUSE_BEING_ASKED_ABOUT,
    A_HOUSE_IS_NAMED,
    A_HOUSE_TYPE_NOUN_ALONE_OR_PLURAL
} from './what-a-house-is-called.js';

/**
 * What a member calls their own body, when they do not say its name.
 *
 * Five words were written out by hand in four rows of this file, so `what does
 * my sect teach` reached the shelf and `what does my hall teach`, `my court`,
 * `my cult` and `my pavilion` all reached nothing - for members of Lantern
 * Hall, Orchid Court, the Bone Lantern Cult and Azure Cloud Pavilion. Worse on
 * the summons row, which answered `what does the hall want of me` by going to
 * look for a person called `hall`.
 */
const A_HOUSE_WORD = A_HOUSE_TYPE_NOUN_ALONE_OR_PLURAL;

/** The things a member can do about their sect, in the order they are tested. */
export type SectIntent =
    | 'leave' | 'promote' | 'stipend' | 'standing' | 'join' | 'siphon' | 'order'
    // What the rungs above `order` buy. Same defect as `order` had: implemented,
    // gated, tested, and unreachable from anything a player could type.
    | 'recruit' | 'admission' | 'curriculum' | 'expel'
    /**
     * The mission board, and taking something off it.
     */
    | 'duty'
    /**
     * Paying into the house's ledger instead of serving it.
     */
    | 'donate'
    /**
     * Handing a THING in to the house, which it credits where it wants it. See
     * `handing-in-phrasings.ts` for what separates it from paying money in.
     */
    | 'hand_in'
    /**
     * Being let to sit in at a house that has not taken you.
     */
    | 'guest'
    /**
     * What the house has asked of you, and what saying no would cost.
     */
    | 'summons'
    /**
     * Saying yes to it, which is the answer the whole mechanism was missing.
     * `acceptDuty` had one caller - the noticeboard - so a house could send for
     * somebody by name and the only sentence they had back was no.
     */
    | 'accept'
    /**
     * Saying no to it.
     */
    | 'refuse'
    /**
     * Saying nothing to it, which is not the same act and does not cost the
     * same thing. Refusing spends standing today; ignoring spends nothing until
     * the due day goes, and then lands as a lapse rather than a refusal.
     */
    | 'ignore'
    /**
     * Putting a hand on a thing the house owns.
     */
    | 'take'
    /**
     * Which rooms of the house are yours to speak for.
     */
    | 'authority'
    /**
     * The same order, given in the house's name rather than in your own.
     */
    | 'decree'
    /**
     * What the house is holding against its own, read and decided by whoever holds
     * the room complaints go to.
     */
    | 'complaints'
    /**
     * Speaking for somebody the house is holding something against, to whoever
     * decides it. The other end of `complaints`: one is deciding a case and this
     * is asking somebody else to decide it differently.
     */
    | 'plead';

/**
 * Which sect verb a sentence is asking for.
 */
/**
 * The two that need no noun. "Promote me" and "my stipend" are about a sect whether
 * or not the sentence says so - there is nothing else in the game that promotes
 * anybody or pays an allowance - so these are tested early, ahead of the verbs that
 * would otherwise swallow them ("collect my pay" reads as gathering, "ask for a
 * promotion" reads as asking somebody a question).
 */
export const SECT_INTENT_UNAMBIGUOUS: ReadonlyArray<[SectIntent, RegExp]> = [
    ['promote', /\b(?:promote|promotes|promoted|promotion|raise me|elevate me|advance my rank|higher rank|next rank up|rise in rank)\b/],
    // `for what I am owed` is somebody ASKING a body for it, which is a petition
    // and is resolved by a different instrument that answers in its own terms.
    // Drawing a stipend is a member collecting; petitioning is somebody putting a
    // case. The corpus's own phrasing - "I ask the house for what I am owed" - was
    // answered with the collection, so the ask never happened and the refusal that
    // is the whole point of a petition was never written. Bare "what am I owed" is
    // untouched and still reaches the read.
    // ── AND ASKING WHAT A HOUSE PAYS IS NOT PAYING IT ────────────────────
    //
    // "What does the Azure Dew Sect pay" reached `sect/donate` for 33 of the 38
    // houses - the confident opposite of what was said, a player asking what
    // they would be paid answered with the machinery for handing money over. It
    // reached the donation branch because `pay` is one of `HOUSE_GIVING_VERBS`
    // and a house was named beside it. "What is the stipend at the X" already
    // answered correctly, so the right read was here all along and only the
    // commonest phrasing of the question could not find it.
    //
    // Four of the five that did NOT reach `donate` were worse again: the house
    // NAME carried the figure, so "what does the Six Li Patrol pay" arrived as
    // a donation of 6 stones and "the Thousand Treasure Pavilion" as one of
    // 1000. That is recorded here because the number-out-of-a-name read is
    // still live for any sentence this row does not now claim.
    ['stipend', new RegExp(
        String.raw`\b(?:stipend|allowance|my dues|collect my pay|draw my pay|(?<!for )what (?:i am|i'm) owed)\b`
        // A HOUSE IS REQUIRED, and it is what keeps this off "what did I earn"
        // and "how much did that pay" - both of which are the purse's question
        // and are read far below this row.
        // The ASKED-ABOUT form of the name, not the general one: "what does the
        // X pay" says a body is the subject before X is read, which is the
        // shape `what-a-house-is-called.ts` states may afford a one-word name.
        // Without it The Severed - the catalog's only such house - was the one
        // house this question could not be asked of.
        + String.raw`|\bwhat\s+(?:do|does|would|will)\s+(?:the\s+|my\s+|our\s+|this\s+|that\s+)?`
        + String.raw`(?:${A_HOUSE_BEING_ASKED_ABOUT})\b[^.?!]{0,30}\bpays?\b`,
        'i'
    )],
    // ── SAYING YES, WHICH HAD NO WORDS AT ALL ────────────────────────────
    //
    // Measured in play: a senior of the house came in person, named the work,
    // the days, the pay and what declining would be written down as - and "I
    // accept", "I accept and go", "I obey", "I will go", "I do as I am told"
    // and "I answer the summons" were six blank looks. The only answer the
    // game had to an order was to refuse it.
    //
    // AHEAD OF THE `summons` ROW BECAUSE ASKING IS NOT DOING. That row takes
    // `what ... asked of me`, and `what` is a relative pronoun as often as it
    // is a question word: "I do what the elder asked of me" was answered with
    // the price of refusing, which is the confident opposite of what was said.
    // The doing forms are all subject-first and no question wears one.
    //
    // `it`, `that` and `this` are safe here for the reason the `ignore` row
    // below gives: `pending-summons.ts` allows exactly ONE standing ask, so
    // the pronoun has one referent.
    //
    // `the duty` is deliberately NOT an object here. It is the board's own
    // word - "I accept the duty" has meant taking a line off the wall since
    // that verb was written - and claiming it would answer somebody standing
    // at a noticeboard by telling them nobody has sent for them.
    ['accept', new RegExp(
        // WHOSE ORDER IT IS SITS BETWEEN THE VERB AND THE NOUN.
        //
        // Measured against the parser: `i accept the order` matched and `i accept
        // the elder's order` reached `unclear`, because the noun list had to sit
        // immediately after the verb. That is the near-synonym trap AGENTS.md
        // names - naming who sent for you is the more natural sentence, and it was
        // the one that failed. Two words of slack, so a possessive or an adjective
        // fits and a second clause does not.
        String.raw`\b(?:accept|accepts|accepting|agree|agrees|agreeing|consent|consents)\s+(?:to\s+)?`
        + String.raw`(?:it|that|this|(?:the|his|her|their|my|our)\s+(?:\w+(?:'s|’s)?\s+){0,2}`
        + String.raw`(?:summons|call|order|orders|errand|task|assignment|posting|sending|`
        + String.raw`instruction|instructions))\b`
        // TAKING IT IS ACCEPTING IT, for the things that can only have been put
        // TO you.
        //
        // `posting` AND `post` ARE THE BOARD'S, AND THEY STAY THE BOARD'S. They
        // were on this row for one sweep. The sweep measured "I take the post"
        // reaching `work` and read that as a defect, which it is not: a line on
        // a wall is a posting, taking one is work, and
        // `a-board-you-can-read-and-cannot-answer` has pinned "i take the
        // posting" to `work` since before any of this. The word carries both
        // senses in this genre and the board had it first. A summons put to you
        // by name is said with the words below, none of which a wall can wear.
        //
        // The noun list here is deliberately SHORTER than the one above.
        // `task` and `assignment` are the board's words - the comment above
        // says why `duty` is not on this row at all - and taking one off a
        // wall is `sect/duty`, a different act with a different answer.
        //
        // AND THE NOUN HAS TO BE THERE. `it|that|this` are deliberately absent
        // from this arm although the arm above has them: with them, "I take
        // that sword" was a summons accepted. The bare pronoun forms of the
        // ACCEPT verb are safe because accepting names no object of its own;
        // taking names one in every sentence it appears in.
        + String.raw`|\b(?:take|takes|taking|took)\s+(?:on\s+)?`
        + String.raw`(?:the|his|her|their|my|our|that|this)\s+(?:\w+(?:'s|’s)?\s+){0,2}`
        + String.raw`(?:summons|errand|sending|call)\b`
        + String.raw`|\bi\s+(?:accept|agree|consent)\b\s*(?:and\s+(?:go|do it|set out|leave))?\s*[.!?]?$`
        + String.raw`|\b(?:obey|obeys|obeying|comply|complies|complying)\b`
        + String.raw`|\bdo\s+(?:as|what)\s+(?:i\s+(?:am|was)\s+)?(?:told|bid|asked|instructed|ordered)\b`
        + String.raw`|\bi\s+(?:do|will do|shall do|go and do)\s+(?:as|what)\s+(?:the|my|our|she|he|they)\b[^.!?]*\b(?:asked|ordered|instructed|told|wanted|said)\b`
        + String.raw`|\banswer(?:s|ing)?\s+(?:the\s+)?(?:summons|call|sending)\b`
        + String.raw`|\bi\s+(?:will|shall)\s+go\s*[.!?]?$`
        + String.raw`|\bgo\s+(?:as\s+(?:ordered|instructed|told|asked)|when\s+(?:the|my|our)\s+\w+\s+(?:calls|sends|asks))\b`
        + String.raw`|\bi\s+take\s+it\s+on\b`
    )],
    // ANSWERING A SUMMONS, AND SAYING NO TO ONE
    // A SUMMONS IS ALWAYS THE PLAYER'S OWN. "what happens if he refuses" is the
    // condition on a threat, and it reached this row because the row asks only
    // for a question word and a refusal word somewhere after it. Same guard as
    // the refuse row below and for the same reason.
    ['summons', new RegExp(
        String.raw`\b(?:what|which|why|whether|how much|how bad)\b[^.!?]*\b(?<!he )(?<!she )(?<!they )(?<!it )(?<!anyone )(?<!anybody )(?<!someone )(?<!somebody )(?:refus\w+|declin\w+|saying no|turn(?:ing)? (?:it|them) down)\b`
        + String.raw`|\b(?:what|which)\b[^.!?]*\b(?:summons|called me in|sent for me|been asked of me|they want of me|asked of me)\b`
        + String.raw`|\b(?:what (?:am i|have i) been (?:asked|called)|who sent for me|what was i (?:asked|called) (?:for|in for)|what does (?:the|my|our) (?:${A_HOUSE_WORD}) want (?:of|from) me)\b`
        // ASKING WHETHER ANYBODY HAS, which is the shape a player uses when they
        // do not already know one is standing. The pattern above needs a `what`
        // or a `which` in front of it, so every yes-or-no form of the same
        // question reached nothing: measured on the trope corpus, "has anybody
        // sent for me", "am I summoned" and "who has sent for me" were three
        // blank looks over a summons the house may actually have sent.
        //
        // A ONE-DIRECTIONAL READ, closed. `refuseWhatTheHouseAsked` already
        // handles the nobody-asked case and already runs in a weigh-only mode,
        // so a player could REFUSE a summons and could not ASK whether one
        // existed.
        + String.raw`|\b(?:has|have)\s+(?:anybody|anyone|somebody|someone|my \w+|the \w+)\s+(?:sent for|called for|summoned|asked for)\s+me\b`
        + String.raw`|\bwho\s+(?:has|have)\s+sent\s+for\s+me\b`
        + String.raw`|\bam\s+i\s+(?:summoned|being summoned|wanted|called (?:for|in)|sent for)\b`
        + String.raw`|\b(?:any|is there a)\s+summons\b`
    )],
    // `turn ... down` takes its object in the middle - "I turn them down" is how a
    // person says it and "I turn down them" is not - so the particle has to be
    // reachable across a short object. Bounded at two words so it cannot span a
    // clause and catch a `down` belonging to something else. A REFUSAL IS SOMETHING
    // THE SPEAKER DOES. "I will make him an offer he cannot refuse" contains the
    // word and is neither a refusal nor the speaker's - measured, it reached
    // `sect/refuse` and answered a threat with a summons. The negated idiom is the
    // whole of the false positive, so the guard is on it and nothing else.
    // AND THE SPEAKER IS THE ONE REFUSING. "I make it clear what happens if he
    // refuses" is a threat with a condition in it, and it reached a summons
    // because the word was there. A third-person subject in front of the verb
    // is somebody else's refusal, and a summons is only ever the player's own.
    // AND STANDING WHERE YOU ARE IS A NO. What is being answered is not always
    // the house: somebody already working a ruin tells an arrival to get off it,
    // and the answer to that is the same word. Which ask is being refused is a
    // question about the situation and not about the sentence, so it is settled
    // where the situation is - see `somebody-tells-you-to-get-off-this-ground.ts`.
    // AND STANDING YOUR GROUND WHERE IT IS SEEN IS A STANCE, NOT A NO. `posture`
    // already owns "I stand my ground where they can see it" in the corpus, and
    // the bare arm took it: what the corpus phrasing is about is the SHOWING,
    // which is what a stance between houses is. The tail is the whole
    // difference, so the guard is on the tail and nothing else - "I stand my
    // ground" and "I stand my ground against him" are still a refusal.
    ['refuse', /(?<!cannot )(?<!can not )(?<!can't )(?<!could not )(?<!couldn't )(?<!unable to )(?<!he )(?<!she )(?<!they )(?<!it )(?<!anyone )(?<!anybody )(?<!someone )(?<!somebody )\b(?:refuse|refuses|refusing|decline|declines|declining|turns?\s+(?:\w+\s+){0,2}down|turning\s+(?:\w+\s+){0,2}down|say no|says no|saying no|will not go|wont go|won't go|not going|do not answer|don'?t answer|no answer|(?:stand|stands|standing|hold|holds|holding) my ground\b(?!\s+(?:where|so|openly|plainly|publicly|in front of|in the open))|stay(?:ing)? (?:right )?where i am|not moving|i do not move|i don'?t move)\b/],
    // ── AND SAYING NOTHING, WHICH IS NOT SAYING NO ───────────────────────
    //
    // `I ignore it`, typed straight after the house had sent for somebody, came
    // back a shrug on the trope corpus - the commonest answer anybody gives a
    // summons in this genre, with no verb. It is deliberately its own intent
    // rather than a phrasing of `refuse`: refusing spends standing now and
    // ignoring costs nothing until the due day goes, and folding them together
    // would charge somebody for a decision they have not made.
    //
    // A THING AND NEVER A PERSON. `it`, `that`, `this` and the summons by name;
    // never `him`, `her` or `them`. Ignoring somebody standing in front of you
    // is a different act with a different subject, and routing it here would
    // answer a snub with a house's paperwork - measured, `I ignore him` reached
    // this row before the pronouns were cut out of it.
    //
    // Bare `it` is safe for the reason the summons layer is built the way it
    // is: `pending-summons.ts` allows exactly ONE standing ask at a time, so
    // the pronoun has one referent. Where nothing is standing the verb says so
    // and writes nothing, which is a better answer than a shrug.
    ['ignore', /\b(?:ignore|ignores|ignoring)\s+(?:it|that|this|the summons|the call|the letter|the message|the order|what (?:they|the house|the sect) (?:want|wants|asked|asks))\b|\bi (?:do|will do|am doing) nothing about (?:it|that|this)\b|\b(?:let|leave) it (?:lie|be|sit)\s*[.!?]?$/],
];

// ─────────────────────────────────────────────────────────────────────────
// TAKING A THING THE HOUSE OWNS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Putting a hand on it, as a verb rather than as a noun.
 */
export const HOUSE_TAKING_VERBS =
    'take|takes|taking|steal|steals|stealing|pocket|pockets|pocketing|'
    + 'help myself to|helps himself to|make off with|makes off with|'
    + 'walk off with|walks off with|walk out with|walks out with';

/**
 * Where a house keeps the things that are one thing each.
 *
 * Nouns only an institution has, which is why this arm needs no house word:
 * there is no library in this game that is not somebody's.
 */
export const HOUSE_SHELF_NOUNS =
    /\b(?:librar\w+|archives?|scripture pavilion|book ?shelf|shelves)\b/;

/**
 * The counted tier, which `siphon` has owned since it was written.
 */
export const COUNTED_TIER_NOUNS =
    /\b(?:treasur\w+|coffers|reserves?|spirit stones?|stones|funds|money|silver|vault|strongroom|storehouse)\b/;

/** Said outright, which is how the sentence that found this defect was typed. */
export const WITHOUT_ASKING = /\bwithout (?:asking|permission|leave|a word)\b/;

/**
 * Whether a sentence is somebody taking a thing off their own house's shelf.
 *
 * A function rather than a condition written out at its one call site, because
 * it now has two: the general taking branch in `verb-pattern-table.ts` runs
 * ABOVE this file's step and has to yield to it. Measured: "I help myself to
 * the archives" reached `interact/take` - a taking from a person - while "I
 * help myself to the SECT archives" reached `sect/take`, so whether the house's
 * own shelf answered depended on a word the player had no reason to type.
 *
 * Written once so the two branches cannot drift into disagreeing about which
 * sentences belong to which, which is the failure this repo's own rule about
 * a fact living in one place exists to stop.
 */
export function aTakingOffTheHousesShelf(text: string): boolean {
    return usedAsVerb(text, HOUSE_TAKING_VERBS)
        && !COUNTED_TIER_NOUNS.test(text)
        && (HOUSE_SHELF_NOUNS.test(text)
            || (A_HOUSE_IS_NAMED.test(text) && WITHOUT_ASKING.test(text)));
}

// ─────────────────────────────────────────────────────────────────────────
// ON WHAT AUTHORITY
// ─────────────────────────────────────────────────────────────────────────

/**
 * A sentence reaching for the house's own authority rather than its speaker's.
 */
export const CLAIMING_THE_HOUSES_AUTHORITY = new RegExp(
    String.raw`\b(?:by (?:the )?order of|in the name of|on the authority of|by the authority of|by decree of|as (?:the )?(?:${A_HOUSE_WORD})'?s?)\b`
    + String.raw`|\b(?:${A_HOUSE_WORD}) (?:orders?|decrees?|commands?)\b`
);

// ─────────────────────────────────────────────────────────────────────────
// WHAT HAS BEEN BROUGHT TO YOU
// ─────────────────────────────────────────────────────────────────────────

/**
 * Complaints the house is holding against its own, read by whoever holds the room
 * they go to.
 */
export const COMPLAINTS_BROUGHT_TO_ME =
    /\b(?:what has been brought (?:to me|before me)|what complaints?|who has been reported|what is (?:outstanding|open) against|complaints? against|reports? against|who has been brought (?:to|before) me|what am i being asked to judge)\b/;

/** Deciding one. The two verdicts the ledger already has words for. */
export const COMPLAINT_VERDICTS: ReadonlyArray<[string, RegExp]> = [
    ['dismissed', /\b(?:dismiss\w*|throw (?:it|this|them) out|throws out|let (?:him|her|them) go|clear\w*|acquit\w*|no case|drop (?:it|the))\b/],
    ['upheld', /\b(?:uphold\w*|upheld|find (?:him|her|them) guilty|guilty|punish\w*|make (?:an )?example|it stands|confirm\w*)\b/]
];

/**
 * Speaking for somebody in front of the room.
 *
 * `for` and `on behalf of` carry the whole of it: the sentence names a person
 * who is not the speaker and asks the room to go easier on them. Kept off the
 * bare words "ask" and "beg", which belong to every petition in the game, so
 * this fires on the shape rather than on the register.
 */
/**
 * Asking a third party to speak, which is a request and not a plea.
 *
 * `I want him to`, `ask her to`, `get the elder to`, `have somebody` - a verb of
 * wanting, a person who is not the speaker, and only then the pleading.
 */
export const SOMEBODY_ELSE_WOULD_SPEAK =
    /\b(?:want|ask|asking|get|have|need|tell|persuade|beg)\s+(?:\w+\s+){0,3}?to\s+(?:speak|plead|vouch|intercede|put in a word|say a word|stand)\b/i;

export const SPEAKING_FOR_SOMEBODY = new RegExp(
    String.raw`\b(?:(?:speak|speaks|speaking|plead|pleads|pleading|vouch|vouches|vouching|intercede|intercedes|interceding|put in a word|say a word|stand)\s+(?:up\s+)?(?:for|on behalf of)|ask (?:them|him|her|the elder|the hall)? ?to (?:go easy on|show (?:mercy|leniency) to|let \w+ off|spare)|beg (?:for )?(?:mercy|leniency|clemency) for)\b`
);

/** Asking who runs what, which is the sentence before the one that claims it. */
/**
 * ── EVERY ALTERNATIVE HERE IS ABOUT THE SPEAKER ──────────────────────────
 */
export const ASKING_ON_WHAT_AUTHORITY =
    /\b(?:on whose authority|on what authority|by what right|what am i in charge of|what do i run|which rooms? (?:are|is) mine|what is my office|what office do i hold)\b/;

/**
 * What is being taken, with the shelf and the confession trimmed off.
 */
export function whatIsBeingTaken(input: string): string | undefined {
    const phrase = namedAfter(input, HOUSE_TAKING_VERBS);
    if (!phrase) return undefined;
    const cut = phrase
        .replace(/\s+(?:from|out of|off|in|at)\s+.*$/i, '')
        .replace(/\s+without\s+.*$/i, '')
        .replace(/^(?:the|a|an|some|one of the|my|our|its|their)\s+/i, '')
        .trim();
    return cut.length >= 3 ? cut : undefined;
}

/**
 * Sentences about taking the house's property, which are NOT sentences about
 * resigning from it even though most of them contain the word "leave".
 */
/**
 * How greedily, when the sentence says. Order matters: the careful words are
 * checked first because "quietly and steadily" is a sentence about care.
 */
export const SIPHON_PACE_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['careful', /\b(?:careful\w*|slow\w*|quiet\w*|patient\w*|little at a time|a bit at a time|cautious\w*|discreet\w*)\b/],
    ['greedy', /\b(?:greedy|greedily|fast|quickly|hard|as much as|everything|all of it|empty|drain|clean out)\b/],
    ['steady', /\b(?:steady|steadily|regular\w*|month by month|bit by bit|over time)\b/]
];

/**
 * Reading the books, which is not the same as taking anything out of them.
 */
/**
 * PUTTING IN, which is the mirror of {@link SIPHON_TAKING_VERBS}.
 *
 * Needed because the theft pattern matches on the NOUNS as well as the verbs -
 * treasury, coffers, reserves - which is what makes "what do the sect reserves
 * hold" a sentence about the treasury at all. The cost of that is that any
 * sentence with the word in it lands on the theft branch, and measured:
 *
 *     I give 2000 stones to the sect treasury   ->   sect/siphon
 *
 * A player paying INTO the house was answered by the engine reading it as a
 * robbery. That is the inversion `tests/web/exemplars/questions-a-sentence-cannot-carry.ts` names
 * as the dangerous shape - *the confident opposite* - arriving by a different
 * route than the one that file guards.
 *
 * So the theft branch yields to a giving verb in verb position, exactly as the
 * donation branch already yields to a taking one. Two lists, checked both ways,
 * and neither direction can claim a sentence that plainly says the other.
 */
export const HOUSE_GIVING_VERBS =
    'donate|donates|donating|donated|gift|gifts|gifting|gifted|contribute|contributes|'
    + 'contributing|contributed|give|gives|giving|gave|pay|pays|paying|paid|'
    + 'hand over|hands over|handing over|put in|puts in|putting in';

export const SIPHON_TAKING_VERBS =
    'steal|steals|stealing|stole|rob|robs|robbing|loot|loots|looting|plunder|plunders|'
    + 'pilfer|pilfers|siphon|siphons|siphoning|skim|skims|skimming|embezzle|embezzles|'
    + 'embezzling|divert|diverts|diverting|empty|empties|emptying|drain|drains|draining|'
    + 'clean out|take|takes|taking|help myself to|make off with|dip into|dips into';

/**
 * The pace an unpaced theft runs at.
 */
export const DEFAULT_SIPHON_PACE = 'careful';

/**
 * Sending somebody below you somewhere, which is the first thing a rank buys.
 */
export const SECT_ORDER_VERBS =
    'order|orders|command|commands|send|sends|dispatch|dispatches|detail|details|assign|assigns|task|tasks';

/**
 * GIVING an order, where the order is the object rather than the verb.
 *
 * `usedAsVerb` is what gates the list above, and it is right to: "the order of
 * the thing" is not somebody commanding anybody. But "I give an order to the
 * outer disciples" has no verb in that list at all - and measured, it reached
 * `sect/donate`, because `give` next to a named house is how somebody pays in.
 * A player issuing an order was answered by handing over money.
 *
 * The article is required, which is what keeps this off "give order to the
 * ranks" as a phrase about tidiness and off "in order to".
 */
export const GIVING_AN_ORDER =
    /\b(?:give|gives|giving|gave|issue|issues|issuing|issued)\s+(?:an?|the)\s+(?:order|command|instruction)s?\b/;

export const SECT_SUBORDINATE_NOUNS =
    /\b(?:disciples?|servants?|juniors?|underlings?|subordinates?|acolytes?|attendants?|initiates?|the ranks? below|my line|my people)\b/;

/**
 * Sending something rather than somebody. "I send word to the disciples" is a
 * message and costs nobody a day; only the errand branch may claim it.
 */
export const SENDING_A_MESSAGE =
    /\b(?:send|sends|sending|dispatch|dispatches)\s+(?:word|a message|a letter|a note|a reply|an invitation|my regards|for help)\b/;

/**
 * Which of the three errands an order is for.
 */
export const SECT_ERRAND_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['gather', /\b(?:herbs?|roots?|plants?|ingredients?|reagents?|flowers?|mushrooms?|grasses|forage|foraging|gather\w*|harvest\w*|pick\w*)\b/],
    ['carry', /\b(?:carry|carrying|carts?|haul\w*|freight|porter\w*|transport\w*|deliver\w*|fetch\w*|move the|shift the|stones?|ore|timber)\b/],
    ['labour', /\b(?:labour|labor|repair\w*|rebuild\w*|build\w*|sweep\w*|dig\w*|clean\w*|maintain\w*|drill\w*|chores?|the yard|the wall)\b/]
];

/** What an order is for when the sentence does not say. */
export const DEFAULT_ERRAND = 'labour';

// THE SEAT'S OWN POWERS

/**
 * Taking somebody INTO a house, which is the opposite of asking to be let in.
 */
export const SECT_RECRUIT_VERBS =
    'recruit|recruits|recruiting|take on|takes on|taking on|take in|takes in|taking in|'
    + 'bring in|brings in|bringing in|enlist|enlists|enlisting|induct|inducts|inducting|'
    + 'sign on|signs on|signing on|'
    /**
     * The bare verb with a counted object, which "take on" does not cover and which
     * is how anybody actually says it. "I take a disciple" fell through the entire
     * table and reached nothing, while "I take on a disciple" - the same act, one
     * word longer - worked. That is a PHRASING GAP rather than a missing mechanic:
     * `sect_manage.recruit` already puts a disciple under this cultivator's own
     * line, is gated at the elder rung, and prices the intake. A second verb for it
     * would have been a second implementation of one act, which is how two answers
     * to the same question get into a save.
     *
     * ── AND A SECOND COPY OF THE NUMBER TABLE, WHICH IS ITS OWN DEFECT ──
     *
     * This spelled out `one|two|three|...|ten` by hand and stopped there, and
     * spelled it out for `take` only. Measured:
     *
     *     "I take three disciples"      -> recruit
     *     "I take twelve disciples"     -> UNCLEAR
     *     "I take twenty disciples"     -> UNCLEAR
     *     "I am taking three disciples" -> UNCLEAR
     *
     * `WORD_NUMBER_ALTERNATION` is the repo's one list of these words and
     * cannot go stale against `parseCount`, which is what actually reads the
     * figure out of the sentence afterwards. A hand-written second copy can
     * only ever drift from it, and had - by seventeen words and two verb
     * forms.
     */
    + `take (?:a|an|on|in|another|${WORD_NUMBER_ALTERNATION.replace(/ /g, '')}|[0-9]+)|`
    + `takes (?:a|an|another|${WORD_NUMBER_ALTERNATION.replace(/ /g, '')}|[0-9]+)|`
    + `taking (?:a|an|another|${WORD_NUMBER_ALTERNATION.replace(/ /g, '')}|[0-9]+)|`
    /**
     * And taking a NAMED PERSON, which the counted form above does not reach.
     *
     * The same phrasing gap one step over: "I take a disciple" was fixed and "I
     * take HIM as my disciple" still fell through the whole table, which is the
     * form anybody uses when the person is standing in front of them. Measured
     * on the trope corpus as four blank looks in a row - "I take him as my
     * disciple", "I make him my disciple", "I take him on as a disciple", "I
     * take the youngest one here on as my disciple".
     *
     * Safe without a second guard because `SECT_INTAKE_NOUNS` still has to
     * match: the sentence must name a disciple, a student, an apprentice. "I
     * take him down" names none of those and is not this act.
     */
    + 'take (?:him|her|them|the|that|this)|takes (?:him|her|them|the|that)|'
    + 'taking (?:him|her|them|the|that)|'
    + 'make (?:him|her|them)|makes (?:him|her|them)|making (?:him|her|them)';

/** Who is being taken in. Without one of these the sentence is not about intake. */
export const SECT_INTAKE_NOUNS =
    /\b(?:disciples?|elders?|students?|followers?|apprentices?|novices?|initiates?|acolytes?|intake|new blood)\b/;

/**
 * Asking to be taken in yourself, which is `join` and never `recruit`.
 */
/** The nouns a posted intake is pointed at by. No house is named any of them. */
export const A_POSTED_INTAKE =
    '(?:intakes?|recruiting (?:events?|days?|drives?)|admission days?|open days?'
    + '|recruit(?:ing|ment) (?:bills?|notices?|posters?))';

/**
 * Going to one, as opposed to reading about it.
 */
const GOING_TO_AN_INTAKE =
    'take|takes|taking|go to|goes to|going to|attend|attends|attending|'
    + 'sign up (?:at|for|with)|signs up (?:at|for|with)|signing up (?:at|for|with)|'
    + 'put myself (?:forward|in front of)|present myself (?:at|to|for)|'
    + 'turn up (?:at|to|for)|show up (?:at|to|for)|apply at|be there for|'
    + 'walk in at|walk into';

export const TAKING_A_POSTED_INTAKE = new RegExp(
    `\\b(?:${GOING_TO_AN_INTAKE})\\b[^.!?]{0,40}?\\b${A_POSTED_INTAKE}\\b`,
    'i'
);

/** Saying it in so many words. */
const THE_WORDS_A_CANDIDATE_USES =
    '\\b(?:take me|takes me|taking me|taken on|taken in|admit me|accept me'
    + '|have me|be admitted|join|joins|joining)\\b';

/**
 * WHICH SIDE OF THE DOOR THE SPEAKER IS ON.
 *
 * A house takes people in, and a candidate turns up to be taken in, and English
 * hands both of them the verb `take`. Every branch that prices a house's intake
 * POWER has to know which of the two it is looking at, so the question is asked
 * once and the branches read the answer off it.
 *
 * MEASURED, AND IT IS WHY THE PATTERNS NOW SIT TOGETHER. "I take the intake at
 * the Silver Island Market" came back as the house RECRUITING somebody called
 * "intake at the Silver Island Market" - a person who does not exist, paid for
 * out of a purse the speaker does not control. `take` is a recruiting verb and
 * `intake` is an intake noun, so the branch that prices taking a disciple ON
 * fired on a sentence about turning up to be considered AS one. The two
 * readings are exact opposites and they matched the same words.
 *
 * `TAKING_A_POSTED_INTAKE` was already written and already right, and it lived
 * in the other file - so the recruit branch could not consult it. Moving it
 * beside this one is the whole fix, and this guard is what it buys.
 */
export const ASKING_TO_BE_TAKEN_IN = new RegExp(
    THE_WORDS_A_CANDIDATE_USES
    // AND TURNING UP TO ONE, which is the same request made by walking to it.
    + '|' + TAKING_A_POSTED_INTAKE.source,
    'i'
);

/** Dismissing an elder: the only leadership act that lands the day it is said. */
export const SECT_EXPEL_VERBS =
    'expel|expels|expelling|dismiss|dismisses|dismissing|throw out|throws out|'
    + 'cast out|casts out|drive out|drives out|remove|removes|removing|oust|ousts|'
    + 'sack|sacks|purge|purges|get rid of|turn out|turns out';

/**
 * Only an elder can be dismissed by this power, so the noun is the gate. A
 * sentence about removing a seal, a disciple or a rival is not this act, and
 * routing it here would price a dismissal nobody asked for.
 */
export const SECT_ELDER_NOUN = /\b(?:elders?)\b/;

/** The house somebody is being put out of, said as the house. */
const OUT_OF_THE_HOUSE =
    `(?:the|my|our|this|his|her|their)\\s+(?:${A_HOUSE_WORD}|roll|ranks)`;

/**
 * Somebody being put off a house's roll, however the sentence says it: thrown
 * out, removed, struck off, or expelled outright.
 *
 * Two shapes rather than one, because they are two different sentences: DOING
 * it - "I throw him out of the sect" - and HAVING it done - "I have her removed
 * from the house", "I want him expelled". Both name the same act, because the
 * difference between them is who does it, and who may is the house's own rule
 * rather than a fact about the words. The engine answers that and names whoever
 * holds it.
 */
const PUT_OFF_THE_ROLL: readonly RegExp[] = [
    // Had done: "I have her removed", "I want him expelled", "I have him thrown out".
    new RegExp(
        '\\b(?:want|wants|have|has|had|get|gets|got)\\s+(.+?)\\s+'
        + '(?:expelled|removed|dismissed|thrown out|cast out|put out|struck off|kicked out|turned out)\\b',
        'i'
    ),
    // Done: out of the house by name of the house.
    new RegExp(
        '\\b(?:throw|throws|kick|kicks|turn|turns|put|puts|drive|drives|force|forces)\\s+(.+?)\\s+'
        + `out\\s+of\\s+${OUT_OF_THE_HOUSE}\\b`,
        'i'
    ),
    new RegExp(
        '\\b(?:expel|expels|expelling|dismiss|dismisses|remove|removes|oust|ousts|purge|purges)\\s+(.+?)\\s+'
        + `(?:from|off)\\s+${OUT_OF_THE_HOUSE}\\b`,
        'i'
    ),
    // Struck off the roll, which names the roll rather than the house.
    /\bstrike\s+(.+?)(?:'s)?(?:\s+name)?\s+(?:off|from)\s+(?:the\s+)?(?:roll|register|rolls)\b/i,
    // And the bare word, which belongs to no other act in this world.
    /\b(?:expel|expels|expelling)\s+(.+?)\s*$/i
];

/** A word that names nobody the house could look up. */
const NAMES_NOBODY_ON_THE_ROLL =
    /^(?:him|her|them|he|she|they|it|me|us|his|hers|their|theirs|its|somebody|someone|anybody|anyone|people)$/i;

export function somebodyIsPutOffTheRoll(input: string): { person?: string } | null {
    const text = input.trim();
    if (/\b(?:expel|dismiss|remove|throw out|get rid of|turn out|kick out)\s+me\b/i.test(text)) return null;
    for (const pattern of PUT_OFF_THE_ROLL) {
        const hit = pattern.exec(text);
        const said = hit?.[1]?.replace(/[.!?,]+\s*$/, '').trim();
        if (!said) continue;
        const bare = said.replace(/^(?:the|a|an|that|this)\s+/i, '').trim();
        return NAMES_NOBODY_ON_THE_ROLL.test(bare) ? {} : { person: bare };
    }
    return null;
}

/**
 * Where the house sets its bar.
 */
export const SECT_ADMISSION_NOUNS = new RegExp(
    String.raw`\b(?:admissions?|entry (?:bar|standard|standards|requirements?)|the (?:admission )?bar|intake (?:bar|standard)|standard (?:for|of) (?:entry|admission)|who (?:we|(?:the|my|our) (?:${A_HOUSE_WORD})) admits?|admit(?:s)? from)\b`
);

export const SECT_ADMISSION_VERBS =
    'raise|raises|raising|lower|lowers|lowering|set|sets|setting|change|changes|changing|'
    + 'tighten|tightens|tightening|loosen|loosens|loosening|relax|relaxes|drop|drops|'
    + 'move|moves|moving|reset|resets';

/** Asking where the bar sits, which is the sentence before the one that moves it. */
export const SECT_ADMISSION_QUESTION = new RegExp(
    String.raw`\b(?:what (?:is|are) (?:our|the|my) (?:admission|entry|intake)|where does (?:(?:the|my|our) (?:${A_HOUSE_WORD})|it) admit from|how high is (?:the|our) bar)\b`
);

/**
 * What the house hands its intake, which is the most consequential thing about
 * it over a century and the only one of the four that is a generational act.
 */
/**
 * `my sect` is in this list, and its absence was the whole bug.
 */
export const SECT_CURRICULUM_NOUNS = new RegExp(
    String.raw`\b(?:curriculum|curricula|what (?:we|they|(?:the|my|our) (?:${A_HOUSE_WORD})) teach(?:es)?|(?:working )?library|the shelf|teaching list|what is taught|methods (?:we|(?:the|my|our) (?:${A_HOUSE_WORD})) teach(?:es)?|(?:my|our) (?:${A_HOUSE_WORD}) teach(?:es)?)\b`
);

export const SECT_CURRICULUM_VERBS =
    'change|changes|changing|set|sets|setting|rewrite|rewrites|rewriting|revise|revises|'
    + 'decree|decrees|reform|reforms|add|adds|adding|retire|retires|retiring|drop|drops|'
    + 'stop teaching|start teaching|teach|teaches|teaching';

/**
 * Sitting down to learn something, which is `train_technique` and never a
 * decree. "I practise what the sect teaches" satisfies the curriculum rule and
 * means the player is doing the drill, not rewriting the shelf.
 */
export const LEARNING_RATHER_THAN_DECREEING =
    /\b(?:learn|learns|learning|study|studies|studying|practi[cs]e|practi[cs]es|practi[cs]ing|train|trains|training|drill|drills|rehearse)\b/;

/** Which side of the shelf a curriculum sentence is on. Order: the narrower first. */
export const SECT_CURRICULUM_SIDE: ReadonlyArray<[string, RegExp]> = [
    ['retire', /\b(?:retire|retires|retiring|stop teaching|stops teaching|take (?:it )?off the shelf|remove|removes|removing|drop|drops|dropping|no longer teach)\b/],
    ['teach', /\b(?:teach|teaches|teaching|add|adds|adding|put (?:it )?on the shelf|start teaching|hand them)\b/]
];

/**
 * One of the four powers a seat holds, or null when the sentence is about something
 * else entirely.
 */
export function leadershipIntent(text: string, input: string): PlannedAction | null {
    // ── SPEAKING FOR SOMEBODY ELSE ───────────────────────────────────────
    //
    // Ahead of the verdict read. A plea is not a verdict - one is a person
    // without the room asking somebody who has it to change their mind, and the
    // other is the person with the room making it up - and the two sets of words
    // overlap: `let ... off` and `drop` are both in `COMPLAINT_VERDICTS`. Only
    // the ones this pattern already claims are affected today, so the ordering
    // is a guard on the next phrasing somebody adds rather than a live fix.
    // ── AND ASKING SOMEBODY ELSE TO DO IT IS NOT DOING IT ────────────────
    //
    // `put in a word for` is the plea, and it is also half of "I want him to put
    // in a word for me" - which is a REQUEST put to a person, not a word this
    // cultivator is speaking in a room. The corpus caught it: that exemplar is
    // authored under `request` and started arriving at `sect`.
    //
    // The tell is a second party between the wanting and the speaking. It is
    // read here rather than written into `SPEAKING_FOR_SOMEBODY`, because the
    // pattern's job is to recognise the act and this is a question about who is
    // performing it.
    // ── AND ASKING WHO WOULD IS NOT DOING IT EITHER ─────────────────────
    //
    // The same distinction one step further out. "Who would vouch for him" is a
    // question about who stands behind that person, and
    // `WHO_STANDS_BEHIND_THEM` has had a `vouches for` arm since it was
    // written - but this branch runs first and took the sentence, so the asker
    // was answered by SPEAKING FOR HIM. A question opening with `who` is asking
    // who performs the act; no sentence that performs it opens that way.
    if (SPEAKING_FOR_SOMEBODY.test(text)
        && !/^\s*(?:so\s+|and\s+)?who\b/.test(text)
        && !SOMEBODY_ELSE_WOULD_SPEAK.test(text)) {
        // `namedAfter` stops at the prepositions its other callers need and "in
        // front of" is not among them, so "I speak for Wen Shu in front of the
        // punishment elder" carried the room into the name. Trimmed here rather
        // than in the shared reader, whose exact stop list every other
        // leadership verb is built against.
        const who = namedAfter(input, 'for|on behalf of|easy on|mercy to|leniency to')
            ?.replace(/\s+\b(?:in front of|before)\b.*$/i, '').trim();
        return {
            action: 'sect',
            intent: 'plead',
            ...(who && who.length >= 2 ? { target: who } : {})
        };
    }

    // WHAT HAS BEEN BROUGHT TO YOU, AND DECIDING IT
    const verdict = matchIntent(text, COMPLAINT_VERDICTS);
    // `charge` is deliberately NOT a complaint noun. "who is in charge here" is a
    // question about who runs the room and it belongs to `look/holder`, which had
    // it first - the word is a preposition there rather than a noun. Measured:
    // including it stole that sentence, which is the failure
    // `verb-pattern-table.ts` warns about in its own header, committed inside the
    // file that quotes the warning.
    if (COMPLAINTS_BROUGHT_TO_ME.test(text)
        || (verdict !== undefined
            && /\b(?:complaints?|reports?|charges|the charge|accusation)\b/.test(text))) {
        const who = namedAfter(input, 'against|about|concerning');
        return {
            action: 'sect',
            intent: 'complaints',
            ...(verdict ? { topic: verdict } : {}),
            ...(who ? { target: who } : {})
        };
    }

    // ── ASKING WHAT YOU RUN ──────────────────────────────────────────────
    //
    // Free, and the sentence before the one that spends. A player who cannot
    // find out which rooms are theirs cannot know whether claiming the house's
    // authority is true, and an engine that let them find out only by being
    // caught would be a trap rather than a decision.
    if (ASKING_ON_WHAT_AUTHORITY.test(text)) {
        return { action: 'sect', intent: 'authority' };
    }

    // AN ORDER GIVEN IN THE HOUSE'S NAME
    if (CLAIMING_THE_HOUSES_AUTHORITY.test(text)
        && SECT_SUBORDINATE_NOUNS.test(text)
        && !SENDING_A_MESSAGE.test(text)) {
        return {
            action: 'sect',
            intent: 'decree',
            topic: matchIntent(text, SECT_ERRAND_PATTERNS) ?? DEFAULT_ERRAND
        };
    }

    // TAKING A THING THE HOUSE OWNS
    if (aTakingOffTheHousesShelf(text)) {
        const what = whatIsBeingTaken(input);
        return { action: 'sect', intent: 'take', ...(what ? { target: what } : {}) };
    }

    // Dismissal, where the sentence says an elder: this row keeps the name
    // extraction the power was written with.
    if (usedAsVerb(text, SECT_EXPEL_VERBS)
        && SECT_ELDER_NOUN.test(text)
        && !/\b(?:expel|dismiss|remove|throw out|get rid of|turn out) me\b/.test(text)) {
        const who = namedAfter(input, SECT_EXPEL_VERBS);
        return { action: 'sect', intent: 'expel', ...(who ? { target: who } : {}) };
    }

    // AND WHERE IT SAYS THE HOUSE INSTEAD OF AN ELDER. The elder noun used to
    // be the whole gate, on the grounds that the power reaches elders and
    // nothing else - which is the ENGINE's answer, and the parser was giving it
    // by shrugging. Measured: "I throw him out of the sect", "I have her
    // removed from the house", "I expel Yun Zhi from the sect" and "I want him
    // expelled" were four blank looks, and two of them are the corpus's own
    // exemplars for this intent. The act is named here and the house says who
    // may: see `who-could-put-somebody-off-the-roll.ts`.
    {
        const put = somebodyIsPutOffTheRoll(input);
        if (put) return { action: 'sect', intent: 'expel', ...(put.person ? { target: put.person } : {}) };
    }

    // Intake. Which rung is being taken in decides which power is being used
    // and what it costs: a disciple goes under your own line and is paid for
    // out of your own purse, an elder is bought in from outside and only the
    // seat may do it.
    if (usedAsVerb(text, SECT_RECRUIT_VERBS)
        && SECT_INTAKE_NOUNS.test(text)
        && !ASKING_TO_BE_TAKEN_IN.test(text)) {
        const kind = /\belders?\b/.test(text) && !/\bdisciples?\b/.test(text) ? 'elder' : 'disciple';
        const phrase = namedAfter(input, SECT_RECRUIT_VERBS);
        return {
            action: 'sect',
            intent: 'recruit',
            topic: kind,
            ...(phrase ? { target: phrase } : {})
        };
    }

    // The bar. A question about where it sits is the same action as a decree
    // that moves it - the tool prices the move when no rank is named - so both
    // phrasings come here rather than one of them falling through.
    if (SECT_ADMISSION_QUESTION.test(text)
        || (usedAsVerb(text, SECT_ADMISSION_VERBS) && SECT_ADMISSION_NOUNS.test(text))) {
        const phrase = namedAfter(input, SECT_ADMISSION_VERBS);
        return { action: 'sect', intent: 'admission', ...(phrase ? { target: phrase } : {}) };
    }

    // WHAT MY OWN HOUSE TEACHES, WHICH IS A QUESTION AND NOT A DECREE
    if (SECT_CURRICULUM_NOUNS.test(text)
        && /\b(?:what|which|does|do|is|are|list|show|tell me)\b/.test(text)
        && !LEARNING_RATHER_THAN_DECREEING.test(text)
        && !usedAsVerb(text, 'change|set|rewrite|revise|decree|reform|add|retire|drop|stop teaching|start teaching')) {
        return { action: 'sect', intent: 'curriculum' };
    }

    // The shelf. Vetoed by the learning verbs: "I practise what the sect
    // teaches" satisfies this rule completely and is a sentence about doing the
    // drill, not about rewriting the library.
    if (usedAsVerb(text, SECT_CURRICULUM_VERBS)
        && SECT_CURRICULUM_NOUNS.test(text)
        && !LEARNING_RATHER_THAN_DECREEING.test(text)) {
        const side = matchIntent(text, SECT_CURRICULUM_SIDE);
        const phrase = namedAfter(input, SECT_CURRICULUM_VERBS);
        return {
            action: 'sect',
            intent: 'curriculum',
            ...(side ? { topic: side } : {}),
            ...(phrase ? { target: phrase } : {})
        };
    }

    return null;
}
