/**
 * What a player says back while somebody is swinging at them.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THESE ARE NOT VERBS, AND THAT IS THE WHOLE DESIGN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Every member of `ACTION_NAMES` is an act a player STARTS. A probe of
 * twenty-nine ordinary play sentences found five that fell through the table
 * together, and they turned out to be one family rather than five gaps:
 *
 *     "I block his sword"       "I let him hit me"      "I back off"
 *     "I call for help"         "I shout for the wardens"
 *
 * Nobody types any of those out of nowhere. They are answers to something
 * already happening, and a verb that reached them from a standing start would
 * be reachable when there is nothing to block, nothing to back off from and
 * nobody coming - which is the case AGENTS.md warns is worse than no entry at
 * all, because it is confidently wrong exactly where it was reaching.
 *
 * So they are read the way `choosing-what-to-do-when-a-seclusion-is-broken.ts`
 * reads "I sit back down": matched against the raw sentence, BEFORE phase 1,
 * and only while a fight is actually standing. Outside a fight not one of these
 * patterns is consulted, so none of them can steal a turn from anything.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE FIVE, AND WHAT EACH ONE IS IN THE ENGINE
 * ═════════════════════════════════════════════════════════════════════════
 *
 *   "I block his sword"        `guard`      - spend the round on not being hit
 *                                             and have nothing left to swing.
 *   "I let him hit me"         `press`      - spend it on the blow and wear
 *                                             what comes back.
 *   "I back off"               `break_off`  - `attemptFlight`, priced, and it
 *                                             costs you whether or not it works.
 *   "I call for help"          `call_for_help`
 *   "I shout for the wardens"  `call_for_help` with somebody named.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * ANYTHING ELSE IS STILL AN ORDINARY TURN
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The crossroads is not a modal jail and neither is this. A player who types "I
 * cultivate" with somebody swinging at them has done a thing, and the world
 * answers by letting the round happen to them and then doing what they asked.
 * Refusing would be banning - the player may attempt anything - and silently
 * converting it to a strike would be worse, because it would be the reader
 * deciding what they meant.
 *
 * The one thing that is NOT read here is a fresh `attack` on the same person.
 * "I hit him again" is striking, and it is the ordinary posture, so it goes
 * through {@link THE_ANSWER_IS_TO_KEEP_SWINGING} and does not open a second
 * fight beside the first.
 */

import type { FightAnswer } from '../engine/cultivation/unfinished-fight.js';

// ─────────────────────────────────────────────────────────────────────────
// THE PHRASINGS
//
// Every one of these was written by asking how somebody would actually answer
// the sentence the engine prints, not by inverting a verb name. AGENTS.md: "if
// a near-synonym works, the phrasing that fails is a bug", and the failing half
// is usually the more natural one.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Covering up. The round goes on not being hit.
 *
 * Includes the phrasings for taking a blow on something - a blade, a bracer, an
 * arm - because that is what blocking IS, and a player who says which thing
 * they blocked with has said more than one who did not, not less.
 */
export const THE_ANSWER_IS_TO_GUARD =
    /\b(?:block(?:s|ing)?|parry(?:ing)?|parries|deflect(?:s|ing)?|guard(?:s|ing)?|defend(?:s|ing)?|brace(?:s|d|ing)?|cover(?:s|ing)? up|turn(?:s|ing)? (?:it|the blow|the strike|his|her|their)|catch(?:es|ing)? (?:it|the blow|the strike)|ward(?:s|ing)? (?:it|him|her|them) off|fend(?:s|ing)? (?:him|her|them|it) off|on the defensive|dodge(?:s|ing)?|evade(?:s|ing)?|duck(?:s|ing)?|weave(?:s|ing)?|get out of the way|stay out of (?:his|her|their|its) reach)\b/i;

/**
 * Taking the hit to land one.
 *
 * The genre's own move and the reason `press` exists: you eat what is coming so
 * that what you are throwing arrives. Note that this is NOT "I give up" - see
 * the guard list for what somebody who wants to stop being hit says.
 *
 * A bare `everything I have` used to be here and is not a fight word. Measured
 * once a fight could stand across the played corpus: "I hand her everything I
 * have" came back as pressing the attack, so a gift read as a swing. The
 * committing forms - `throw everything`, `go all in` - carry their own verb and
 * lose nothing.
 */
export const THE_ANSWER_IS_TO_PRESS =
    /\b(?:let(?:s|ting)? (?:him|her|them|it) (?:hit|strike|land|cut|through)|take(?:s|ing)? (?:the|his|her|their|it) (?:hit|blow|strike|cut)|eat(?:s|ing)? (?:the|his|her|their) (?:hit|blow|strike)|wear(?:s|ing)? (?:the|it|his|her|their) (?:hit|blow)|press(?:es|ing)? (?:in|on|forward|the attack)|push(?:es|ing)? (?:in|through|forward)|go(?:es|ing)? all in|throw(?:s|ing)? everything|commit(?:s|ting)?(?: to it| everything)?|ignore(?:s|ing)? the (?:pain|wound|blow)|do(?:es|ing)? not (?:defend|guard)|don'?t (?:defend|guard|block))\b/i;

/**
 * Getting out.
 *
 * The load-bearing one. Deliberately the most generous list here, because it is
 * the answer somebody reaches for when they are frightened and typing fast, and
 * a flight that fails to parse is the exact death the multi-turn fight exists
 * to make answerable.
 *
 * `move` already reaches "I flee", "I retreat" and "I run away" from a standing
 * start and routes them to travel. Inside a fight they are this instead, which
 * is the same act priced properly: travel does not turn your back on anybody.
 */
/**
 * SOMEBODY ELSE IS THE ONE LEAVING, OR NOBODY IS.
 *
 * FOUND BY PLAYING, and it is the most dangerous thing measured in this file.
 * `run` and `escape` are both in the list above as bare words with `\b` on each
 * side, which is correct for the frightened typist it was widened for and
 * catastrophic for everybody else. Ten sentences through the real reader, seven
 * of them wrong:
 *
 *     "I run him through"                        -> break_off
 *     "I run my blade through his chest"         -> break_off
 *     "I run him down"                           -> break_off
 *     "I strike him down before he can escape"   -> break_off
 *     "I cut off his escape"                     -> break_off
 *     "I block his escape route"                 -> break_off
 *     "I stop him running"                       -> break_off
 *
 * Every one of those is a player pressing an attack or closing off somebody
 * else's way out, and every one of them turned the player's own back and had
 * them flee. In a fight that is not a misread, it is a death: the header above
 * says a flight that fails to parse is the exact death the multi-turn fight
 * exists to make answerable, and this is the same failure pointed the other
 * way - a KILLING that parses as a flight.
 *
 * The distinction the list could not make is whose movement is being described.
 * `run` with something on the end of it is transitive - you run somebody
 * THROUGH, you run them DOWN - and an escape that belongs to `him` is one you
 * are almost always preventing. `my escape` is deliberately absent from that
 * rule, because making your escape is exactly what this is for.
 */
const IT_IS_NOT_YOU_LEAVING = new RegExp([
    // `run` taking an object. Running somebody through is the opposite of
    // leaving, and it is the commonest killing sentence in the genre.
    String.raw`\bruns?\s+(?:him|her|them|it|my|his|her|their|the|[A-Z][a-z]+)\b`,
    // Somebody ELSE's way out, which is a thing you close rather than take.
    String.raw`\b(?:his|her|their|its|the)\s+escape\b`,
    // Said about them rather than about you.
    String.raw`\b(?:he|she|they|it)\s+(?:can|could|might|will|would|tries? to|is trying to)\s+`
    + String.raw`(?:escape|run|flee|get away|withdraw|break off)\b`,
    // Preventing one. The verb in front is what says so.
    String.raw`\b(?:cut|cuts|cutting|block|blocks|blocking|stop|stops|stopping|prevent|prevents`
    + String.raw`|deny|denies|bar|bars|head|heads|close|closes|seal|seals)\b[^.!?]{0,24}`
    + String.raw`\b(?:escape|escaping|running|fleeing|getting away|retreat)\b`
].join('|'));

export const THE_ANSWER_IS_TO_BREAK_OFF =
    // Note the shape of the `run` clause. It was written `run(?:s|ning)? (?:for
    // it|away|off)?` - a REQUIRED space before an optional tail - so "I parry
    // and run" did not match and read as a guard. An optional group behind a
    // mandatory space is the commonest way to write a regex that cannot match
    // the bare word, and it fails silently on exactly the phrasing somebody
    // types when they are frightened.
    /\b(?:back(?:s|ing)? (?:off|away|out)|break(?:s|ing)? (?:off|away|contact)|disengage(?:s|ing)?|withdraw(?:s|ing)?|retreat(?:s|ing)?|flee(?:s|ing)?|fled|run(?:s|ning)?(?:\s+(?:for it|away|off))?|leg it|get(?:s|ting)? (?:out|away|clear)|got out|make(?:s|ing)? a run|give(?:s|ing)? ground|pull(?:s|ing)? (?:back|out)|clear(?:s|ing)? out|bolt(?:s|ing)?|escape(?:s|ing)?|(?:i'?m|i am) (?:out of here|leaving|going)|not worth (?:it|dying))\b/i;

/**
 * Shouting for somebody.
 *
 * Two shapes and they are the same answer: a shout into the air, and a shout
 * with a name in it. Who comes is a fact about who is standing there, so the
 * name changes what the engine LOOKS for and never what it finds.
 */
export const THE_ANSWER_IS_TO_SHOUT =
    /\b(?:call(?:s|ing)? (?:out )?for (?:help|aid|somebody|someone|anyone|anybody|the\b[\w\s]{0,24})|shout(?:s|ing)? for|scream(?:s|ing)? for|yell(?:s|ing)? for|cry(?:ing)? (?:out )?for (?:help|aid)|cries for|call(?:s|ing)? (?:the|for the|on)\s+[\w\s]{2,24}|shout(?:s|ing)? (?:out )?(?:to|at)\s+[\w\s]{2,24}|help[!.]*\s*$|somebody help|someone help|get help|(?:call|fetch|summon)(?:s|ing)? (?:the )?(?:guards?|wardens?|watch|elders?|sect|house))\b/i;

/**
 * Letting somebody go.
 *
 * ── THE HALF OF THE FIGHT VOCABULARY THAT DID NOT EXIST ──────────────────
 *
 * Measured against the genre's own tropes, `parseIntent` reached a verb for 15
 * of 20 TAKING sentences and 3 of 10 GIVING ones, and `I spare him` and `I let
 * him go` were both `unclear` - inside a fight AND out of one. `combat.ts` has
 * had the ending the whole time and calls it in its own words: *"beaten and
 * deliberately let go, in front of people. The genre's engine."* The only way
 * to ask for it was to declare at the OPENING that humiliating them was the
 * point, so a player who set out to kill somebody and then decided not to had
 * no sentence, and the fight ran to a body.
 *
 * ── IT SITS ABOVE THE STRIKE LIST AND BELOW EVERYTHING ELSE ──────────────
 *
 * Above `keep swinging`, which owns `finish him`, `end him` and `kill him` and
 * would take `I don't finish him` on the word `finish`. Below breaking off,
 * because `I let him go and back off` is somebody leaving. Below pressing and
 * guarding, because `let him hit me` is a press and shares the word `let`.
 *
 * Every phrasing needs a stopping word AND an object or a plain stop. `I spare`
 * with nothing after it is here; `I spare a thought` is not a fight answer and
 * matches nothing, because the object list is people.
 */
/**
 * The half of the list that names somebody, and is therefore readable with no
 * fight standing at all.
 *
 * Split because the two halves are safe in different places. Every phrasing
 * here carries a person or a hand and means one thing wherever it is said; the
 * bare stops below mean restraint only because something is already happening.
 * Outside a fight only this half is consulted, so "I buy enough" cannot become
 * an act of mercy.
 *
 * The last alternative takes a NAME rather than a pronoun, because the
 * affordance strip prints one and any name the game prints is a name the game
 * must accept. Its stop list is the words that make what follows an object
 * rather than a person - "I let the rope go" is not mercy. The pronouns are
 * matched by the alternative above it, which is why `her` and `his` can sit in
 * the stop list without costing "I let her go".
 */
const SOMEBODY_IS_LET_GO = [
    'spare(?:s|d)? (?:him|her|them|his life|her life|their life|the boy|the girl)',
    // `off` is NOT here. "I let him off what he owes" is forgiving a debt and
    // belongs to oath/release, which owned it and lost it the first time this
    // list was consulted outside a fight. Inside one it is still a sparing -
    // it sits in the bare half below, which only a standing fight consults.
    'let(?:s|ting)? (?:him|her|them) (?:go|live|be|walk|stand|up)',
    'let (?:him|her|them) (?:go|live)',
    'show(?:s|ing)? (?:(?:him|her|them) )?mercy',
    'have mercy',
    'mercy on (?:him|her|them)',
    'stay(?:s|ing)? my (?:hand|blade|sword)',
    'stay my hand',
    'hold(?:s|ing)? my (?:hand|blade|sword)',
    "do(?:es)? not finish (?:him|her|them)",
    "don'?t finish (?:him|her|them)",
    'will not finish (?:him|her|them)',
    "won'?t finish (?:him|her|them)",
    'leave(?:s|ing)? (?:him|her|them) (?:alive|be|breathing|standing)',
    "let(?:s|ting)? (?!it\\b|go\\b|the\\b|an?\\b|my\\b|his\\b|her\\b|their\\b|its\\b"
        + "|your\\b|our\\b|me\\b|us\\b|that\\b|this\\b)[\\w'-]+(?: [\\w'-]+)? (?:go|live|be|up)"
].join('|');

/** The bare stops, which are restraint only while something is happening. */
const THE_STOP_IS_BARE = [
    'spare(?:s|d)?\\s*$',
    'let(?:s|ting)? (?:him|her|them) off',
    'stop(?:s|ping)? short',
    'enough[.!]*\\s*$',
    "it(?:'s| is) enough"
].join('|');

export const THE_ANSWER_IS_TO_SPARE =
    new RegExp(`\\b(?:${SOMEBODY_IS_LET_GO}|${THE_STOP_IS_BARE})\\b`, 'i');

/** Letting somebody go, in the words that survive having no fight around them. */
export const LETTING_SOMEBODY_GO = new RegExp(`\\b(?:${SOMEBODY_IS_LET_GO})\\b`, 'i');

/**
 * Going down on one knee, which is not backing off and not blocking.
 *
 * The three it has to stay clear of are all in this file. Breaking off is
 * leaving and this is staying; guarding is spending the round on not being hit
 * and this is stopping; and `spare` is the same act from the other end, so
 * every phrasing here is about the speaker's OWN knees. That is why the object
 * forms are excluded: `make him kneel` is a coercion and belongs to
 * `how-a-player-says-each-coercion.ts`, which owns it and had all of it.
 */
export const THE_ANSWER_IS_TO_YIELD =
    /\b(?:i )?(?:yield(?:s|ing)?|surrender(?:s|ing)?|submit(?:s|ting)?|give(?:s)? (?:up|in)|giving (?:up|in)|stand(?:s|ing)? down|kneel(?:s|ing)?|go(?:es|ing)? down on (?:one|my) knee|beg(?:s|ging)? for (?:mercy|my life)|throw(?:s|ing)? (?:down )?my (?:sword|blade|weapon)|drop(?:s|ping)? my (?:sword|blade|weapon)|ask(?:s|ing)? for mercy|plead(?:s|ing)? for (?:mercy|my life)|spare me|let me live|i (?:am|'m) beaten|you win)\b/i;

/**
 * Somebody else's knees, which is the opposite act and shares every word.
 *
 * "I make him kneel" is a coercion, `how-a-player-says-each-coercion.ts` owns
 * it, and it read as a surrender until this was here - the sentence is about
 * kneeling and the reader had no way to tell whose.
 */
export const MAKING_SOMEBODY_ELSE_DO_IT =
    /\b(?:make|makes|making|made|force|forces|forcing|forced|beat|beats|beating|have|has)\s+(?:him|her|them|it|everyone|everybody)\b/i;

/** Swinging again, which is the ordinary round and needs no special handling. */
export const THE_ANSWER_IS_TO_KEEP_SWINGING =
    /\b(?:attack(?:s|ing)?|strike(?:s|ing)?|struck|hit(?:s|ting)?|swing(?:s|ing)?|cut(?:s|ting)?|stab(?:s|bing)?|slash(?:es|ing)?|punch(?:es|ing)?|kick(?:s|ing)?|fight(?:s|ing)? on|keep(?:s|ing)? (?:fighting|going|at it|swinging)|again\b|press(?:es|ing)? the attack|finish (?:him|her|them|it)|kill (?:him|her|them|it)|end (?:him|her|them|it))\b/i;

/** What the panel's controls send, typed the way a player would type them. */
export const SAY_TO_GUARD = 'I block';
export const SAY_TO_PRESS = 'I take the hit and swing';
export const SAY_TO_BREAK_OFF = 'I back off';
export const SAY_TO_SHOUT = 'I call for help';
export const SAY_TO_KEEP_SWINGING = 'I keep swinging';
export const SAY_TO_SPARE = 'I spare him';
export const SAY_TO_YIELD = 'I yield';

// ─────────────────────────────────────────────────────────────────────────
// READING ONE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Which of the five a sentence is, or null when it is an ordinary turn.
 *
 * ORDER IS THE WHOLE OF THE CORRECTNESS ARGUMENT HERE, and it runs from the
 * most specific to the least:
 *
 *   1. BREAKING OFF first, because it is the one whose failure kills somebody
 *      and because it is the least ambiguous - nothing else in a fight is
 *      spelled "back off".
 *   2. SHOUTING next, since "call for the wardens" contains no fighting word
 *      and would be reached by nothing else.
 *   3. PRESSING before GUARDING, because "I take the hit and swing" contains
 *      no guard word but several press ones, while "I block and step back"
 *      contains both - and somebody who says both is guarding.
 *   4. GUARDING.
 *   5. STRIKING last, because it is the default and reads the widest.
 *
 * A sentence matching NONE of them is not a fight answer and this returns null.
 * That is not a refusal: the caller lets the round happen and then does what
 * was actually asked.
 */
export function whatTheySaidInTheFight(said: string): FightAnswer | null {
    const line = said.trim();
    if (line.length === 0) return null;

    // BREAK-OFF IS READ FIRST AND SO ITS GUARD RUNS FIRST. See
    // `IT_IS_NOT_YOU_LEAVING`: the flight list is the widest in this file by
    // design, and its two widest words - `run` and `escape` - are also the two
    // that appear in the commonest KILLING sentences the genre has. Read
    // unguarded, "I run him through" turned the player's back on the person
    // they had just described running through.
    if (THE_ANSWER_IS_TO_BREAK_OFF.test(line) && !IT_IS_NOT_YOU_LEAVING.test(line)) {
        return { kind: 'break_off', toward: whereTheyAreHeaded(line) };
    }
    if (THE_ANSWER_IS_TO_SHOUT.test(line)) {
        return { kind: 'call_for_help', to: whoTheyCalledFor(line) };
    }
    // Above pressing and guarding, both of which own words a surrender uses -
    // "I give in" against "I give him the hit", "I stand down" against "I
    // stand my ground" - and below breaking off, which is the other way of
    // ending it and the one whose failure kills somebody.
    if (THE_ANSWER_IS_TO_YIELD.test(line) && !MAKING_SOMEBODY_ELSE_DO_IT.test(line)) {
        return { kind: 'yield' };
    }
    if (THE_ANSWER_IS_TO_PRESS.test(line)) return { kind: 'press' };
    if (THE_ANSWER_IS_TO_GUARD.test(line)) return { kind: 'guard' };
    // Above the strike list, which owns `finish him`, `end him` and `kill him`
    // and would take every negated form of all three.
    if (THE_ANSWER_IS_TO_SPARE.test(line)) return { kind: 'spare' };
    if (THE_ANSWER_IS_TO_KEEP_SWINGING.test(line)) return { kind: 'strike' };
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// AND THE SAME WORDS WITH NO FIGHT AROUND THEM
// ─────────────────────────────────────────────────────────────────────────

/**
 * Stepping into a fight between two OTHER people.
 *
 * The pattern exists so the engine can SAY it has no answer for this. A fight
 * here is an `UnfinishedFight`: one aggressor, one defender, and the player as
 * one of the two. Nothing in world state holds a fight between two other people
 * for a third to walk into, so "I stand between them" names a situation that
 * does not exist rather than a verb that is missing - and that is a different
 * refusal from the engine saying it could not read the words.
 *
 * THE OBJECT HAS TO BE THE TWO OF THEM. Written as a bare `stands between` it
 * took "what stands between me and Wen Shuyi", which is a read of the ledger
 * and belongs to `oath`. `between me and <somebody>` is one person and a
 * question; `between them` is two people and an act.
 */
export const THE_SENTENCE_STEPS_INTO_SOMEBODY_ELSES_FIGHT =
    /\b(?:(?:stand|step|get|move|jump|wade)(?:s|ing)? (?:in )?between (?:them|the two|these two|those two)|put(?:s|ting)? myself between (?:them|the two)|come(?:s|ing)? between (?:them|the two)|break(?:s|ing)? (?:it|them) up|break(?:s|ing)? up (?:the|their) fight|pull(?:s|ing)? (?:them|the two of them) apart|separate(?:s|ing)? (?:them|the two))\b/i;

/** The two acts of restraint a player can say when no fight is standing. */
export type HeldBack = 'let_them_go' | 'step_between_two_others';

/**
 * Restraint, read with no fight standing.
 *
 * Restraint only means anything when there is something to restrain, and the
 * engine holds two such situations: a fight, which `whatTheySaidInTheFight`
 * already answers, and somebody beaten and still standing in front of you,
 * which nothing could reach. Both of those and neither of them go through here;
 * what the answer IS belongs to the caller, which is the only thing that knows
 * whether anybody is on their knees.
 *
 * The sparing half DEFERS to `whatTheySaidInTheFight` rather than testing
 * `LETTING_SOMEBODY_GO` itself, so the precedence argument written above that
 * function is not restated here and cannot drift from it: "I let him hit me" is
 * a press and "I let him go and back off" is somebody leaving, and both share a
 * word with the sparing list.
 */
export function whatIsBeingHeldBack(said: string): HeldBack | null {
    const line = said.trim();
    if (line.length === 0) return null;
    if (THE_SENTENCE_STEPS_INTO_SOMEBODY_ELSES_FIGHT.test(line)) {
        return 'step_between_two_others';
    }
    return whatTheySaidInTheFight(line)?.kind === 'spare' && LETTING_SOMEBODY_GO.test(line)
        ? 'let_them_go'
        : null;
}

/**
 * Where a flight is making for, when the player said.
 *
 * A DESCRIPTION AND NEVER AN ID, which is the rule for every other target in
 * this game. What it resolves against is the list of roads the world says lead
 * out of here, and an unrecognised name does not refuse the flight - somebody
 * running toward a place they have misnamed is still running.
 */
export function whereTheyAreHeaded(said: string): string | null {
    const m = /\b(?:to(?:ward|wards)?|for|back to|into|up|down|out to)\s+(?:the\s+)?([a-z][\w' -]{2,40})/i
        .exec(said);
    if (!m) return null;
    const named = m[1].trim().replace(/[.!,]+$/, '');
    // "back off to safety" names a wish rather than a place, and handing it to
    // the road list would resolve it to whichever road happens to contain the
    // letters. Better to have named nowhere.
    if (/^(?:safety|cover|somewhere|anywhere|there|here|it|him|her|them)$/i.test(named)) return null;
    return named;
}

/** Who the shout named, when it named anybody. */
export function whoTheyCalledFor(said: string): string | null {
    const m = /\b(?:call(?:ing)?|shout(?:ing)?|scream(?:ing)?|yell(?:ing)?|cry(?:ing)?|fetch|summon)\s+(?:out\s+)?(?:for|to|at|on)\s+(?:the\s+)?([a-z][\w' -]{2,40})/i
        .exec(said);
    if (!m) return null;
    const named = m[1].trim().replace(/[.!,]+$/, '');
    if (/^(?:help|aid|somebody|someone|anyone|anybody|it)$/i.test(named)) return null;
    return named;
}

// ─────────────────────────────────────────────────────────────────────────
// THE FIGHT THE SERVICE IS HOLDING
// ─────────────────────────────────────────────────────────────────────────

/**
 * A fight the played layer is standing in, and everything its ENDING will need.
 *
 * The engine's `UnfinishedFight` knows about two bodies and a patch of ground.
 * It deliberately knows nothing about runs, rows, houses or what the player
 * agreed to before the first blow - and all four of those are read when the
 * fight ends, by `settleAFight`, `whatItDidToThem` and `whatFollowedTheBout`.
 * A fight that opened on turn one and finishes on turn six has to still know
 * them, so they are carried here rather than re-derived at the end: the person
 * standing in front of you can walk away between turns, and re-resolving the
 * party afterwards would settle the fight against whoever is there now.
 *
 * ── LIFETIME ─────────────────────────────────────────────────────────────
 *
 * In memory on the service, beside `crossroads` and for the same reason. A
 * fight is happening NOW; persisting one would let a player walk out mid-swing,
 * cultivate for ten years and come back to the same raised arm. Losing one to a
 * restart costs the player nothing they were not already losing, because losing
 * it is the fight ending where it stood.
 */
export interface StandingFight {
    /** The engine's half. Replaced wholesale each round. */
    state: import('../engine/cultivation/unfinished-fight.js').UnfinishedFight;
    runId: string;
    cultivatorId: string;
    /** Who is being fought, resolved once when it opened. */
    party: { id: string; name: string };
    /** Their world row, when they have one rather than a cultivator row. */
    theirRecord: import('../engine/world/npc-state.js').NpcRecord | null;
    /** Their `cultivators` row id, when they have one. Most people do not. */
    opponentIdOnRecord: string | null;
    /** Their ordinal as the square reported it, for the fallout layer. */
    standingOrdinal: number | null;
    /** Both bodies as they were priced when it opened. */
    self: import('../engine/cultivation/combat.js').CombatantInput;
    opponent: import('../engine/cultivation/combat.js').CombatantInput;
    /** The art actually being swung, for what the fight teaches. */
    techniqueId: string | null;
    /** What the two of them agreed to, which is what the fallout is priced off. */
    terms: string;
    /** `attack` or `coerce`, for the log and the record. */
    verb: 'attack' | 'coerce';
    /** What the compliance was for, when the verb was `coerce`. A label only. */
    wanted?: string;
    /**
     * The THING the sentence named, when it named one.
     *
     * `wanted` is the label the parser picked - swallow, hand over - and it
     * cannot say which pill. This is the phrase the player typed, unresolved,
     * because what the pouch holds is a fact about the moment the fight ends
     * and not about the moment it opened.
     */
    named?: string;
    /**
     * Whether the ways out of a hopeless fight have already been printed.
     *
     * FOUND BY PLAYING BLIND, swinging three times at a Sect Warden three
     * realms up. The routes block is appended to `required`, so it reaches the
     * player verbatim - and it was appended on EVERY round. Three consecutive
     * screens carried the same four options in the same 120 words, which was
     * most of what there was to read on any of them.
     *
     * The same defect `ambientIsNews` is for, one subject over: a STANDING
     * CONDITION narrated as news. The gap does not change between rounds, so
     * neither do the routes, and a player who has read them once is not being
     * offered anything the second time.
     *
     * Held on the fight rather than on the service because it is a fact about
     * THIS fight: walking into a second hopeless one is a new situation and
     * gets the list again.
     */
    routesAlreadyNamed?: boolean;
}

/** Whether a fight the service is holding is still this run's and this body's. */
export function theFightStillStands(
    held: StandingFight | null,
    runId: string,
    cultivatorId: string
): held is StandingFight {
    return held !== null && held.runId === runId && held.cultivatorId === cultivatorId;
}

/**
 * The fight as the state payload carries it.
 *
 * The client draws five controls off this and sends back one of the five
 * sentences, down the ordinary command path - the same shape `CrossroadsView`
 * uses, so if one of them stops parsing it stops for everybody at once and
 * `fight-answers.test.ts` catches it.
 *
 * NOTHING HERE IS THE INTERFACE. Typing anything at all still works, typing
 * something the fight has no answer for is still an ordinary turn, and the
 * controls exist because "you can find out what you could do" is a floor at
 * every reading tier - a player at the bottom rung who cannot see that backing
 * off is available is playing the one-call fight with extra steps.
 */
export interface FightView {
    /** Who is swinging at them. */
    them: string;
    yourHp: number;
    yourMaxHp: number;
    theirHp: number;
    theirMaxHp: number;
    roundsLeft: number;
    /** 0..1, what breaking off would come off at, before choosing it. */
    flightChance: number;
    /** The engine's own state line, verbatim. */
    where: string;
    /** What each control sends, verbatim. */
    guardSays: string;
    pressSays: string;
    breakOffSays: string;
    shoutSays: string;
    keepSwingingSays: string;
}

export function fightView(
    held: StandingFight,
    where: {
        yourHp: number; yourMaxHp: number;
        theirHp: number; theirMaxHp: number;
        roundsLeft: number;
        flight: { chance: number };
        line: string;
    }
): FightView {
    return {
        them: held.party.name,
        yourHp: where.yourHp,
        yourMaxHp: where.yourMaxHp,
        theirHp: where.theirHp,
        theirMaxHp: where.theirMaxHp,
        roundsLeft: where.roundsLeft,
        flightChance: where.flight.chance,
        where: where.line,
        guardSays: SAY_TO_GUARD,
        pressSays: SAY_TO_PRESS,
        breakOffSays: SAY_TO_BREAK_OFF,
        shoutSays: SAY_TO_SHOUT,
        keepSwingingSays: SAY_TO_KEEP_SWINGING
    };
}
