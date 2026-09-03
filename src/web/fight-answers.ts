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
 */
export const THE_ANSWER_IS_TO_PRESS =
    /\b(?:let(?:s|ting)? (?:him|her|them|it) (?:hit|strike|land|cut|through)|take(?:s|ing)? (?:the|his|her|their|it) (?:hit|blow|strike|cut)|eat(?:s|ing)? (?:the|his|her|their) (?:hit|blow|strike)|wear(?:s|ing)? (?:the|it|his|her|their) (?:hit|blow)|press(?:es|ing)? (?:in|on|forward|the attack)|push(?:es|ing)? (?:in|through|forward)|go(?:es|ing)? all in|everything (?:i|I) (?:have|have got|ve got)|throw(?:s|ing)? everything|commit(?:s|ting)?(?: to it| everything)?|ignore(?:s|ing)? the (?:pain|wound|blow)|do(?:es|ing)? not (?:defend|guard)|don'?t (?:defend|guard|block))\b/i;

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

/** Swinging again, which is the ordinary round and needs no special handling. */
export const THE_ANSWER_IS_TO_KEEP_SWINGING =
    /\b(?:attack(?:s|ing)?|strike(?:s|ing)?|struck|hit(?:s|ting)?|swing(?:s|ing)?|cut(?:s|ting)?|stab(?:s|bing)?|slash(?:es|ing)?|punch(?:es|ing)?|kick(?:s|ing)?|fight(?:s|ing)? on|keep(?:s|ing)? (?:fighting|going|at it|swinging)|again\b|press(?:es|ing)? the attack|finish (?:him|her|them|it)|kill (?:him|her|them|it)|end (?:him|her|them|it))\b/i;

/** What the panel's controls send, typed the way a player would type them. */
export const SAY_TO_GUARD = 'I block';
export const SAY_TO_PRESS = 'I take the hit and swing';
export const SAY_TO_BREAK_OFF = 'I back off';
export const SAY_TO_SHOUT = 'I call for help';
export const SAY_TO_KEEP_SWINGING = 'I keep swinging';

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

    if (THE_ANSWER_IS_TO_BREAK_OFF.test(line)) {
        return { kind: 'break_off', toward: whereTheyAreHeaded(line) };
    }
    if (THE_ANSWER_IS_TO_SHOUT.test(line)) {
        return { kind: 'call_for_help', to: whoTheyCalledFor(line) };
    }
    if (THE_ANSWER_IS_TO_PRESS.test(line)) return { kind: 'press' };
    if (THE_ANSWER_IS_TO_GUARD.test(line)) return { kind: 'guard' };
    if (THE_ANSWER_IS_TO_KEEP_SWINGING.test(line)) return { kind: 'strike' };
    return null;
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
