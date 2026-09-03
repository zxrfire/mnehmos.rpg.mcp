/**
 * What a member says to their own house, and what a seat may order.
 *
 * The third verb family lifted out of the pattern table in `actions.ts`, on the
 * shape `leaving-things-for-the-next-life.ts` established for `legacyStep`.
 * Measured before the move: this block needs NOTHING from the rest of that
 * file, and the rest needs only vocabulary it was already reading plus
 * `leadershipIntent`.
 *
 * `planIntent` keeps its one-line call and the ordering around it untouched.
 *
 * Three sect patterns did NOT come with it - `SECT_THEFT_PATTERN`,
 * `SECT_DUTY_PATTERN` and `SECT_INTENT_PATTERNS` - because they live in the
 * theft, duty and guest-student neighbourhoods of the table respectively, and
 * each is read by the branch it sits beside. Moving a pattern away from the
 * branch that reads it would be reshaping the table rather than lifting a piece
 * of it whole.
 *
 * Single reason to change: how a player says something to or about their house.
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
     *
     * `sect_members.contribution` is one of three independent axes of standing
     * and it had NO EARNER: promotion spends it, `handleStipend` credits a
     * trickle of it, and nothing else in the game could add to it, so
     * "I do sect work for contribution" returned the generic mortal job board.
     * `commissionBoard`, `boardRefusals` and the accept/complete/refuse ledger
     * are what answer it, and none of them was reachable.
     */
    | 'duty'
    /**
     * Paying into the house's ledger instead of serving it.
     *
     * The other half of the contribution economy. Missions were the only
     * earner, and a player with stones and no time had no way to convert one
     * into the other - so a rich cultivator and a poor one had exactly the same
     * route to a promotion, which is not what money is for in this setting.
     */
    | 'donate'
    /**
     * Being let to sit in at a house that has not taken you.
     *
     * The roll that is not the house roll. A guest keeps their own membership,
     * holds no rung, draws nothing, and is shown the shallow end of somebody
     * else's shelf - which is the only route past a manual's ceiling that does
     * not require a favour from an apex or a decade of contribution. See
     * `src/engine/encounters/what-a-house-will-teach-somebody-it-has-not-taken.ts`.
     */
    | 'guest'
    /**
     * What the house has asked of you, and what saying no would cost.
     *
     * The read half of a summons. `duty` is the WALL - anybody standing in
     * front of it sees the same lines - and this is the thing that was said to
     * one person by name, which is a different question with a different
     * answer.
     *
     * Free, and that is load-bearing rather than incidental. The design owner's
     * ruling on the refusal was that the cost has to be legible before it is
     * paid, "otherwise it is a trap rather than a decision" - so being shown the
     * price is the sentence before the one that spends it, exactly as it is for
     * `recruit`, `admission`, `curriculum` and `expel`.
     */
    | 'summons'
    /**
     * Saying no to it.
     *
     * `encounters/duties.ts` has promised this in its opening lines the whole
     * time - "you may refuse, and refusing is a row in the obligations ledger
     * rather than a shrug" - and `refuseDuty` has taken `'refused'` and
     * `'lapsed'` outcomes that nothing in the repository ever passed. The only
     * caller anywhere passed `'failed'`, on the branch where the cultivator had
     * died, so the sole way to not finish a duty was to be killed doing it.
     */
    | 'refuse'
    /**
     * Putting a hand on a thing the house owns.
     *
     * Found by playing: "I take a manual from the sect library without asking"
     * was answered with prose saying the hand closed around it, and nothing
     * moved - `steal` is an intent on `interact` and `factsForInteraction` says
     * outright that it is "carried for the narrator; read by no conditional".
     *
     * `siphon` is the same crime against the other tier and keeps every
     * sentence it had. The two are separated by `keptAs`, which is the existing
     * single answer to whether a row is an amount or an object: stones out of
     * the treasury are taken over months at a pace, and a manual off the shelf
     * is one thing with a provenance that moves once.
     */
    | 'take';

/**
 * Which sect verb a sentence is asking for.
 *
 * `sect_manage` has had promote, stipend, standing and leave the whole time,
 * fully implemented and gated - and until this existed, none of them could be
 * reached from the command bar. A player could join a sect and then never be
 * promoted, never draw a stipend, never ask where they stood and never resign,
 * because every one of those sentences parsed to `unclear`.
 *
 * Order matters. Leaving is tested first because "I leave the sect and join
 * another" is a sentence about leaving; standing is tested before joining
 * because "what is my standing" contains no join verb but does contain the
 * noun, and the join branch matches on the noun.
 */
/**
 * The two that need no noun. "Promote me" and "my stipend" are about a sect
 * whether or not the sentence says so - there is nothing else in the game that
 * promotes anybody or pays an allowance - so these are tested early, ahead of
 * the verbs that would otherwise swallow them ("collect my pay" reads as
 * gathering, "ask for a promotion" reads as asking somebody a question).
 */
export const SECT_INTENT_UNAMBIGUOUS: ReadonlyArray<[SectIntent, RegExp]> = [
    ['promote', /\b(?:promote|promotes|promoted|promotion|raise me|elevate me|advance my rank|higher rank|next rank up|rise in rank)\b/],
    // `for what I am owed` is somebody ASKING a body for it, which is a
    // petition and is resolved by a different instrument that answers in its
    // own terms. Drawing a stipend is a member collecting; petitioning is
    // somebody putting a case. The corpus's own phrasing - "I ask the house for
    // what I am owed" - was answered with the collection, so the ask never
    // happened and the refusal that is the whole point of a petition was never
    // written. Bare "what am I owed" is untouched and still reaches the read.
    ['stipend', /\b(?:stipend|allowance|my dues|collect my pay|draw my pay|(?<!for )what (?:i am|i'm) owed)\b/],
    // ── ANSWERING A SUMMONS, AND SAYING NO TO ONE ────────────────────────
    //
    // Both sit here rather than beside `SECT_DUTY_PATTERN` in the table for the
    // reason this file exists: they need nothing from the table's
    // neighbourhood, and the consumer at the `SECT_INTENT_UNAMBIGUOUS` site
    // iterates this array generically. Adding a member is a row here.
    //
    // ORDER: the price question is tested BEFORE the act, because "what would
    // refusing cost me" contains the word "refusing" and must not be answered
    // by refusing. Same rule `SIPHON_PACE_PATTERNS` follows for "careful"
    // before "greedy" - the qualified reading is checked first.
    //
    // A MATCH IS ALREADY GONE BY HERE. `familyStep` runs at the top of the
    // table and claims every declining verb that carries a match noun, so
    // "I refuse the betrothal" never reaches this. The two are separated by
    // their nouns, which is the table's own way of keeping verbs apart, and
    // that is why a bare "I refuse" is safe to take: anything about a marriage
    // has already been answered.
    ['summons', /\b(?:what|which|why|whether|how much|how bad)\b[^.!?]*\b(?:refus\w+|declin\w+|saying no|turn(?:ing)? (?:it|them) down)\b|\b(?:what|which)\b[^.!?]*\b(?:summons|called me in|sent for me|been asked of me|they want of me|asked of me)\b|\b(?:what (?:am i|have i) been (?:asked|called)|who sent for me|what was i (?:asked|called) (?:for|in for)|what does the (?:house|sect|order|clan|school) want (?:of|from) me)\b/],
    // `turn ... down` takes its object in the middle - "I turn them down" is how
    // a person says it and "I turn down them" is not - so the particle has to be
    // reachable across a short object. Bounded at two words so it cannot span a
    // clause and catch a `down` belonging to something else.
    ['refuse', /\b(?:refuse|refuses|refusing|decline|declines|declining|turns?\s+(?:\w+\s+){0,2}down|turning\s+(?:\w+\s+){0,2}down|say no|says no|saying no|will not go|wont go|won't go|not going|ignore the summons|ignores the summons|do not answer|don'?t answer|no answer)\b/],
];

// ─────────────────────────────────────────────────────────────────────────
// TAKING A THING THE HOUSE OWNS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Putting a hand on it, as a verb rather than as a noun.
 *
 * `take` is the commonest verb in this game - a duty, a commission, a road, a
 * seat, a dose - so nothing here fires on the verb alone. The nouns below are
 * what make it this act.
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
 *
 * A veto rather than an ordering. `siphon` is tested inside the sect block far
 * below this one, so without an explicit refusal here "I take the sect treasury
 * and leave in the night" would be claimed by the taking branch and answered
 * with a shelf listing - stealing a working sentence from a finished verb,
 * which is the failure `verb-pattern-table.ts` warns about in its own header.
 *
 * The line is `keptAs`'s and not a second opinion about it: an amount on a
 * holder is taken over months at a pace, and a thing with a provenance moves
 * once.
 */
export const COUNTED_TIER_NOUNS =
    /\b(?:treasur\w+|coffers|reserves?|spirit stones?|stones|funds|money|silver|vault|strongroom|storehouse)\b/;

/** Said outright, which is how the sentence that found this defect was typed. */
export const WITHOUT_ASKING = /\bwithout (?:asking|permission|leave|a word)\b/;

/**
 * What is being taken, with the shelf and the confession trimmed off.
 *
 * `namedAfter` hands back everything following the verb - "the Lesser
 * Qi-Gathering Manual from the sect library without asking" - and the holding
 * is only the first clause of that. Cut at the prepositions that introduce
 * WHERE it was and at the clause that says HOW it was done, both of which are
 * facts about the act rather than parts of the name.
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
 *
 * Found by playtesting: "I take the sect treasury and leave in the night" was
 * matched by the leave pattern and quietly resigned the player's membership.
 * They asked to rob the place and the engine processed a resignation, without
 * the theft, without a refusal, and without anything saying so.
 *
 * There is no theft action in the closed set, so the honest answer to these is
 * that the thought does not resolve. Silently doing something adjacent and
 * irreversible instead is the one answer that is worse than saying no.
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
 *
 * `handleSiphon` with no pace reports the position and takes NOTHING - a
 * player is entitled to see what the reserves hold and what the house has
 * already half-noticed before committing to a crime that runs on a clock.
 * That branch is right and it was reached by everything, including
 * "I steal the sect treasury".
 *
 * What that produced, measured across 21 positions and scored on database
 * writes: the prose escalated perfectly by rank - `not_a_member`, then
 * "opens them at Dew Elder, and not before", then "Azure Dew Sect keeps 54,864
 * spirit stones in reserve, and Dew Elder can sign for them" - and at EVERY
 * rank the verdict was `wrote: []`. The ladder was consulted and not obeyed,
 * which is worse than silence, because the prose looks like it worked.
 *
 * So the two sentences are separated here. A question about the reserves is a
 * look. A sentence that says somebody is TAKING is an act, and an act with no
 * pace named falls through to {@link DEFAULT_SIPHON_PACE} - the same rule
 * `site`, `petition`, `posture`, `seal` and `offer` follow, and the same
 * direction: the default is the cheapest branch that still does what was
 * asked, never the most expensive one.
 */
export const SIPHON_TAKING_VERBS =
    'steal|steals|stealing|stole|rob|robs|robbing|loot|loots|looting|plunder|plunders|'
    + 'pilfer|pilfers|siphon|siphons|siphoning|skim|skims|skimming|embezzle|embezzles|'
    + 'embezzling|divert|diverts|diverting|empty|empties|emptying|drain|drains|draining|'
    + 'clean out|take|takes|taking|help myself to|make off with|dip into|dips into';

/**
 * The pace an unpaced theft runs at.
 *
 * `careful` takes half a per cent a month and buys years. It is the LEAST
 * dangerous thing the verb can do while still being the verb, which is exactly
 * what a default has to be when the branch it is choosing between is
 * "irreversible crime" and "nothing at all".
 */
export const DEFAULT_SIPHON_PACE = 'careful';

/**
 * Sending somebody below you somewhere, which is the first thing a rank buys.
 *
 * `sect_manage.order` has had the whole of this the whole time - authority read
 * off the rank index, hands read off the roster taper, the errand resolved
 * against the rung sent, the standing it costs and the obstruction it earns -
 * and none of it could be reached from the command bar. Worse than unreachable:
 * "I order the disciples to gather herbs" was caught by the FORAGING branch, so
 * a sentence about spending somebody else's week spent the player's own instead.
 * That is the same defect as "I attack the nearest cultivator" resolving to a
 * month of meditation, and it is checked here for the same reason.
 *
 * Both halves are required. The verbs alone are too common to trust ("send word
 * to the elder" is a message, not an errand), and the nouns alone appear in
 * every second sentence in the setting. A verb aimed at a rung below is the only
 * thing this matches.
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
 *
 * Tested in this sequence because the sentences overlap: "gather stone for the
 * wall" is haulage that mentions gathering, so what is being FETCHED decides it
 * before the verb does. Nothing named means the generic thing a house asks of
 * the rung below, which is work booked against the caller's own name.
 */
export const SECT_ERRAND_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['gather', /\b(?:herbs?|roots?|plants?|ingredients?|reagents?|flowers?|mushrooms?|grasses|forage|foraging|gather\w*|harvest\w*|pick\w*)\b/],
    ['carry', /\b(?:carry|carrying|carts?|haul\w*|freight|porter\w*|transport\w*|deliver\w*|fetch\w*|move the|shift the|stones?|ore|timber)\b/],
    ['labour', /\b(?:labour|labor|repair\w*|rebuild\w*|build\w*|sweep\w*|dig\w*|clean\w*|maintain\w*|drill\w*|chores?|the yard|the wall)\b/]
];

/** What an order is for when the sentence does not say. */
export const DEFAULT_ERRAND = 'labour';

// ─── THE SEAT'S OWN POWERS ────────────────────────────────────────────────
//
// Four more verbs with the `order` defect. `sect_manage` has had recruit,
// admission, curriculum and expel the whole time - implemented, tiered by
// POWERS_BY_TIER, each returning a narrationHint, each tested - and none of
// them could be reached from the command bar. "I expel an elder from the sect"
// and "I raise the sect's admission standard" parsed to `unclear`; "I take on
// new disciples" was taken by the INTERACT table, whose `recruit` label matches
// "take on"; "I change what the sect teaches" was taken by the sect LISTING,
// because the listing rule fires on the noun plus a question word and this
// sentence has both. So three of the four did something, and none of the three
// was the thing asked for.
//
// The rule the whole group follows is the one the order branch established: a
// verb aimed at somebody below you, plus the noun that says who or what. Both
// halves are required. The verbs alone are far too common - "take on", "raise",
// "change", "remove" are in every second sentence - and the nouns alone are the
// setting's own vocabulary.

/**
 * Taking somebody INTO a house, which is the opposite of asking to be let in.
 *
 * `admit` and `accept` are deliberately absent. "I want to be admitted as a
 * disciple" is a sentence about joining, contains the intake noun, and would
 * have been read as the head of a house buying an elder.
 */
export const SECT_RECRUIT_VERBS =
    'recruit|recruits|recruiting|take on|takes on|taking on|take in|takes in|taking in|'
    + 'bring in|brings in|bringing in|enlist|enlists|enlisting|induct|inducts|inducting|'
    + 'sign on|signs on|signing on|'
    /**
     * The bare verb with a counted object, which "take on" does not cover and
     * which is how anybody actually says it. "I take a disciple" fell through
     * the entire table and reached nothing, while "I take on a disciple" - the
     * same act, one word longer - worked. That is a PHRASING GAP rather than a
     * missing mechanic: `sect_manage.recruit` already puts a disciple under
     * this cultivator's own line, is gated at the elder rung, and prices the
     * intake. A second verb for it would have been a second implementation of
     * one act, which is how two answers to the same question get into a save.
     *
     * The determiner is required and is not decoration. Bare `take` next to
     * the intake nouns collides head-on with the siphoning rule, whose own
     * pattern is `take the|its|their|all|what`: "I take the elders' reserves"
     * would have been read as buying an elder in from outside.
     */
    + 'take (?:a|an|on|in|another|one|two|three|four|five|six|seven|eight|nine|ten|[0-9]+)|'
    + 'takes (?:a|an|another|[0-9]+)|taking (?:a|an|another|[0-9]+)';

/** Who is being taken in. Without one of these the sentence is not about intake. */
export const SECT_INTAKE_NOUNS =
    /\b(?:disciples?|elders?|students?|followers?|apprentices?|novices?|initiates?|acolytes?|intake|new blood)\b/;

/**
 * Asking to be taken in yourself, which is `join` and never `recruit`.
 *
 * Checked as a veto rather than an ordering, because the sentence that needs it
 * ("see whether the hall will take me on as a disciple") satisfies the recruit
 * rule completely and means the exact opposite of it.
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
 *
 * "the bar" is safe next to the breakthrough vocabulary: the word boundary
 * after `bar` does not fall inside `barrier`, so "I strike at the barrier" is
 * not a sentence about admissions. "standard" is likewise not "standing" - the
 * member's status read is a different verb and is tested elsewhere.
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
 *
 * The pattern knew "what the sect teaches" and not "what does MY sect teach",
 * which is how a member phrases it - and a member is the only person for whom
 * the question has an answer. Two words apart, and the sentence fell past the
 * curriculum block entirely into the rule that finds you a sect to join, so a
 * disciple asking what their own house teaches was told that knowing a name is
 * not an introduction.
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
 * One of the four powers a seat holds, or null when the sentence is about
 * something else entirely.
 *
 * Every branch needs a verb IN VERB POSITION and the noun that says what it is
 * aimed at, for the reason {@link usedAsVerb} exists: "elder", "disciple",
 * "admission" and "teaches" are ordinary nouns in this setting and appear far
 * more often as the object of somebody else's sentence than as the subject of
 * this one. Two of the four also carry an explicit veto, because the sentence
 * that would misfire means the OPPOSITE of the power - asking to be taken on is
 * not recruiting, and practising what a house teaches is not decreeing it.
 */
export function leadershipIntent(text: string, input: string): PlannedAction | null {
    // ── TAKING A THING THE HOUSE OWNS ────────────────────────────────────
    //
    // Here rather than in `SECT_INTENT_UNAMBIGUOUS` because this act needs a
    // TARGET and that table returns an intent alone. Measured: routed there,
    // "I take the Lesser Qi-Gathering Manual from the sect library without
    // asking" arrived with no subject and was answered with a listing of the
    // shelf - which reads like an answer and takes nothing.
    //
    // First in this function, and the counted-tier veto is what makes that
    // safe: every sentence `siphon` had, it keeps.
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

    // ── WHAT MY OWN HOUSE TEACHES, WHICH IS A QUESTION AND NOT A DECREE ──
    //
    // "what does my sect teach" is the single most useful fact about belonging
    // to one, and it answered with the stranger's line: "There is one name you
    // have for this: Azure Dew Sect. Knowing a name is not an introduction."
    // The player IS a member. The branch below owns REWRITING the shelf, which
    // is a patriarch's act, and nothing owned reading it - so the question fell
    // past this block entirely and was picked up by the find-me-a-sect rule.
    //
    // `handleCurriculum` with neither `teach` nor `retire` is already the free
    // read; it had no sentence pointing at it. Ahead of the decree branch and
    // gated on a question shape, so "I stop teaching the Cinder Form" is untouched.
    //
    // Vetoed by the learning verbs for the same reason the decree branch below
    // is: "I train in what the sect teaches" satisfies the noun and the
    // question word completely and is a sentence about doing the drill. A guard
    // in `misparse.test.ts` caught that within one run of adding this, which is
    // exactly what it is there for.
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
