/**
 * What a member says to their own house, and what a seat may order.
 */

import { PlannedAction } from './planned-action.js';
import { usedAsVerb, namedAfter, matchIntent } from './sentence-parts.js';

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
     * Being let to sit in at a house that has not taken you.
     */
    | 'guest'
    /**
     * What the house has asked of you, and what saying no would cost.
     */
    | 'summons'
    /**
     * Saying no to it.
     */
    | 'refuse'
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
    | 'complaints';

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
    ['stipend', /\b(?:stipend|allowance|my dues|collect my pay|draw my pay|(?<!for )what (?:i am|i'm) owed)\b/],
    // ANSWERING A SUMMONS, AND SAYING NO TO ONE
    // A SUMMONS IS ALWAYS THE PLAYER'S OWN. "what happens if he refuses" is the
    // condition on a threat, and it reached this row because the row asks only
    // for a question word and a refusal word somewhere after it. Same guard as
    // the refuse row below and for the same reason.
    ['summons', /\b(?:what|which|why|whether|how much|how bad)\b[^.!?]*\b(?<!he )(?<!she )(?<!they )(?<!it )(?<!anyone )(?<!anybody )(?<!someone )(?<!somebody )(?:refus\w+|declin\w+|saying no|turn(?:ing)? (?:it|them) down)\b|\b(?:what|which)\b[^.!?]*\b(?:summons|called me in|sent for me|been asked of me|they want of me|asked of me)\b|\b(?:what (?:am i|have i) been (?:asked|called)|who sent for me|what was i (?:asked|called) (?:for|in for)|what does the (?:house|sect|order|clan|school) want (?:of|from) me)\b/],
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
    ['refuse', /(?<!cannot )(?<!can not )(?<!can't )(?<!could not )(?<!couldn't )(?<!unable to )(?<!he )(?<!she )(?<!they )(?<!it )(?<!anyone )(?<!anybody )(?<!someone )(?<!somebody )\b(?:refuse|refuses|refusing|decline|declines|declining|turns?\s+(?:\w+\s+){0,2}down|turning\s+(?:\w+\s+){0,2}down|say no|says no|saying no|will not go|wont go|won't go|not going|ignore the summons|ignores the summons|do not answer|don'?t answer|no answer)\b/],
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

// ─────────────────────────────────────────────────────────────────────────
// ON WHAT AUTHORITY
// ─────────────────────────────────────────────────────────────────────────

/**
 * A sentence reaching for the house's own authority rather than its speaker's.
 */
export const CLAIMING_THE_HOUSES_AUTHORITY =
    /\b(?:by (?:the )?order of|in the name of|on the authority of|by the authority of|by decree of|as (?:the )?(?:sect|house|clan|school|order)'?s?)\b|\b(?:sect|house|clan|school|order) (?:orders?|decrees?|commands?)\b/;

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
     */
    + 'take (?:a|an|on|in|another|one|two|three|four|five|six|seven|eight|nine|ten|[0-9]+)|'
    + 'takes (?:a|an|another|[0-9]+)|taking (?:a|an|another|[0-9]+)';

/** Who is being taken in. Without one of these the sentence is not about intake. */
export const SECT_INTAKE_NOUNS =
    /\b(?:disciples?|elders?|students?|followers?|apprentices?|novices?|initiates?|acolytes?|intake|new blood)\b/;

/**
 * Asking to be taken in yourself, which is `join` and never `recruit`.
 */
export const ASKING_TO_BE_TAKEN_IN =
    /\b(?:take me|takes me|taking me|taken on|taken in|admit me|accept me|have me|be admitted|join|joins|joining)\b/;

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

/**
 * Where the house sets its bar.
 */
export const SECT_ADMISSION_NOUNS =
    /\b(?:admissions?|entry (?:bar|standard|standards|requirements?)|the (?:admission )?bar|intake (?:bar|standard)|standard (?:for|of) (?:entry|admission)|who (?:we|the house|the sect|the school) admits?|admit(?:s)? from)\b/;

export const SECT_ADMISSION_VERBS =
    'raise|raises|raising|lower|lowers|lowering|set|sets|setting|change|changes|changing|'
    + 'tighten|tightens|tightening|loosen|loosens|loosening|relax|relaxes|drop|drops|'
    + 'move|moves|moving|reset|resets';

/** Asking where the bar sits, which is the sentence before the one that moves it. */
export const SECT_ADMISSION_QUESTION =
    /\b(?:what (?:is|are) (?:our|the|my) (?:admission|entry|intake)|where does (?:the (?:house|sect|school)|it) admit from|how high is (?:the|our) bar)\b/;

/**
 * What the house hands its intake, which is the most consequential thing about
 * it over a century and the only one of the four that is a generational act.
 */
/**
 * `my sect` is in this list, and its absence was the whole bug.
 */
export const SECT_CURRICULUM_NOUNS =
    /\b(?:curriculum|curricula|what (?:we|they|the house|the sect|the school|my (?:sect|house|school|clan|order)) teach(?:es)?|(?:working )?library|the shelf|teaching list|what is taught|methods (?:we|the house|the sect) teach(?:es)?|(?:my|our) (?:sect|house|school|clan|order) teach(?:es)?)\b/;

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
    if (usedAsVerb(text, HOUSE_TAKING_VERBS)
        && !COUNTED_TIER_NOUNS.test(text)
        && (HOUSE_SHELF_NOUNS.test(text)
            || (/\b(?:sect|house|clan|school|order)\b/.test(text) && WITHOUT_ASKING.test(text)))) {
        const what = whatIsBeingTaken(input);
        return { action: 'sect', intent: 'take', ...(what ? { target: what } : {}) };
    }

    // Dismissal. The noun is the gate: this power reaches elders and nothing
    // else, so "I remove the seal" and "I throw the disciple out" are
    // deliberately not this rather than being answered with the wrong price.
    if (usedAsVerb(text, SECT_EXPEL_VERBS)
        && SECT_ELDER_NOUN.test(text)
        && !/\b(?:expel|dismiss|remove|throw out|get rid of|turn out) me\b/.test(text)) {
        const who = namedAfter(input, SECT_EXPEL_VERBS);
        return { action: 'sect', intent: 'expel', ...(who ? { target: who } : {}) };
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
