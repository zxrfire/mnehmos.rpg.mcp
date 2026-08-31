/**
 * The closed action set - phase 1 of the narrator loop.
 *
 * The model is never asked "what happens?". It is asked exactly one question:
 * *which of these nine verbs did the player mean, and with what duration?* The
 * answer comes back as JSON, is parsed by the schema below, and anything that
 * does not fit is thrown away in favour of the deterministic parser at the
 * bottom of this file.
 *
 * Two properties make this the authority boundary rather than a suggestion:
 *
 *  1. THE ENUM IS CLOSED. `action` is a Zod enum over ACTION_NAMES. A model
 *     that answers `"ascend"`, `"gain_spirit_stones"` or `"set_realm"` fails
 *     validation, and a failed validation is not an error path the player
 *     notices - it falls back to the keyword parser and the game continues.
 *
 *  2. THE OBJECT STRIPS. Zod's default object mode drops unknown keys, so a
 *     response of `{"action":"cultivate","realmOrdinal":24,"spiritStones":9999}`
 *     yields exactly `{action:'cultivate'}`. There is no code path anywhere in
 *     src/web that reads a number out of a model response and writes it to the
 *     database; the only numeric field that survives here is `days`, and `days`
 *     is an *input* to a deterministic simulation, not an outcome of one.
 */

import { z } from 'zod';

/** Longest stretch of seclusion that may be requested in one call: 100 years. */
export const MAX_CULTIVATION_DAYS = 36_500;

/** Days of seclusion assumed when the player says "cultivate" with no duration. */
export const DEFAULT_CULTIVATION_DAYS = 30;

/** Days a stretch of technique practice consumes. */
export const TRAINING_DAYS = 7;

/** Days a stretch of foraging consumes. */
export const GATHERING_DAYS = 7;

/** Days sealed closed-door seclusion runs for when no duration is named. */
export const DEFAULT_SECLUSION_DAYS = 365;

/**
 * Days of work assumed when the player says "take work" with no duration.
 *
 * A season. Long enough to be worth the walk and short enough that a hungry
 * cultivator is not committing the rest of their life to a granary.
 */
export const DEFAULT_WORK_DAYS = 90;

/**
 * Every action the engine can execute. Closed, and short on purpose.
 *
 * ── Why it is not a verb list ─────────────────────────────────────────────
 * A flat taxonomy of verbs only grows. `negotiate, deceive, trade, flee`
 * becomes `bribe, threaten, spy, interrogate, steal, sabotage, recruit,
 * intimidate`, and every social nuance ends up as an engine mechanic. So the
 * expressive range lives in PARAMETERS instead:
 *
 *   interact      target + intent   dealing with a person or a faction
 *   investigate   target            examining a place, record, object, person
 *   move          target + intent   going somewhere, by whatever means
 *
 * alongside the world-facing operations that genuinely are distinct engine
 * routines with distinct state effects.
 *
 * `intent` is a free-ish label, and it is safe precisely because NOTHING in
 * the engine branches on it to decide an outcome. It is carried for the
 * narrator to reason about and for the log to record. The moment a line of
 * code reads `if (intent === 'bribe')` to pick a result, the design has
 * failed: the outcome must come from state - who these people are, what they
 * want, what they know, what is owed - not from the word the player used.
 *
 * The closed enum is the protection that stays. A model cannot widen this list
 * at runtime, so it cannot invent an action; adding a member is a deliberate
 * act that the compiler forces into `GameService.execute`.
 */
export const ACTION_NAMES = [
    // Semantic actions. The expressive surface, held open by parameters.
    'interact',
    'investigate',
    'move',
    // World-facing operations: distinct engine routines, distinct state effects.
    /**
     * Hitting somebody, which for a long time had no route at all.
     *
     * The engine has carried a full confrontation model the whole time -
     * power assessment, edges, vectors, obligations, wounds that persist -
     * and the only thing a player could do with it was assess. Meanwhile
     * "I attack the nearest cultivator" fell through the entire table and
     * was caught by the cultivation branch, which sat them down to breathe
     * for a month. An enum member that plain English cannot reach is bad;
     * a missing one that lets another verb eat the sentence is worse.
     */
    'attack',
    'cultivate',
    'seclude',
    'breakthrough',
    'train_technique',
    'refine',
    'gather',
    'eat',
    /**
     * Laying in food before it is needed.
     *
     * The engine has modelled provisions the whole time - the time skip
     * consumes rations, `provisions_exhausted` fires when they run out, the
     * price of a month of them is in the catalog and on the market board -
     * and the only food verb a player could reach was `eat`, which buys one
     * meal and refuses when they are not already hungry. So the interrupt
     * was warning them about a resource they had no way to acquire, and the
     * correct opening move in this game was unavailable.
     *
     * Satiety burns about two a day against a hundred, so a character
     * starves at about fifty days and the default seclusion is thirty. Two
     * cultivations and a death was the likeliest first session.
     */
    'provision',
    'wait',
    // The mortal economy. Half the deaths in this world are logistical, and
    // these are the two verbs that answer that - so they must be reachable
    // from plain English or the logistics layer might as well not exist.
    'work',
    'market',
    // Joining a sect is one of the most consequential things a low cultivator
    // can do - access to comprehension, to a stipend, and to knowing what is
    // out there - and it was unreachable from plain English.
    'sect',
    // Pure reads.
    'look',
    'status',
    'assess',
    /**
     * The parser did not understand, and nothing happens.
     *
     * A member of the closed set rather than a special case, so the exhaustive
     * switch in `GameService.execute` is forced to handle it and no future verb
     * can quietly become the fallback again. The model should never CHOOSE it -
     * the glossary says so - but a model that does costs the player nothing,
     * which is the entire point of it being here.
     */
    'unclear'
] as const;

export type ActionName = typeof ACTION_NAMES[number];

/** Actions that pass no in-world time and change no cultivator state. */
export const READ_ONLY_ACTIONS: readonly ActionName[] = [
    'look', 'status', 'investigate', 'interact', 'assess', 'market', 'unclear'
] as const;

/**
 * `sect` is not in either list on purpose.
 *
 * Listing what would take you costs nothing; being taken costs a life's worth
 * of allegiance. Which one happened depends on whether a sect was named, so it
 * is classified at the point of execution rather than here.
 */

/**
 * Actions that spend in-world time, and can therefore kill.
 *
 * The list exists to be asserted against. An intent the engine did not
 * understand must never resolve to anything in it: a misparse that costs a
 * season costs a starving cultivator their run, and a player should be able to
 * type something ambiguous a hundred times and lose nothing but a moment.
 */
export const TIME_CONSUMING_ACTIONS: readonly ActionName[] = [
    'cultivate', 'seclude', 'breakthrough', 'train_technique',
    'move', 'gather', 'wait', 'work', 'refine', 'eat',
    // Not because it spends days. Because it can end the run inside one
    // turn, which is the thing this list is actually protecting against.
    'attack'
] as const;

/** What an unparseable sentence resolves to. Inert, by construction. */
export const FALLBACK_ACTION: ActionName = 'unclear';

/** Actions that take a duration in days. Every other action ignores one. */
export const TIMED_ACTIONS: readonly ActionName[] = ['cultivate', 'seclude', 'work', 'provision'] as const;

/**
 * Actions that take a subject. The subject must resolve to a real entity - a
 * cultivator row, a sect, a catalogued art, formula or herb, a place - or the
 * action fails. An unresolvable target is never narrated as though it worked.
 */
export const TARGETED_ACTIONS: readonly ActionName[] = [
    'interact', 'investigate', 'move', 'train_technique', 'refine', 'gather',
    'work', 'market', 'assess', 'sect', 'attack'
] as const;

/** Actions that carry a free-text intent. Never branched on for an outcome. */
export const INTENT_ACTIONS: readonly ActionName[] = ['interact', 'move', 'attack'] as const;

/**
 * Intents the prompt suggests for `move`. Suggestions, not a schema: the field
 * accepts any short label, because the engine resolves movement from state and
 * reads the label only to describe what was attempted.
 */
export const MOVE_INTENTS = ['travel', 'flee', 'approach', 'enter', 'follow'] as const;

/** Intents the prompt suggests for `interact`. Open by design; see above. */
export const INTERACT_INTENTS = [
    'talk', 'negotiate', 'trade', 'deceive', 'interrogate',
    'threaten', 'bribe', 'recruit', 'petition', 'apologise'
] as const;

export const PlannedActionSchema = z.object({
    action: z.enum(ACTION_NAMES),
    /**
     * Duration for `cultivate`, in days. Bounded on both ends so a model that
     * answers `1e9` cannot ask the simulator for a heat-death-of-the-universe
     * loop, and one that answers `0` cannot produce a no-op the player paid a
     * turn for.
     */
    days: z.number().int().min(1).max(MAX_CULTIVATION_DAYS).optional(),
    /**
     * Free text: a destination for `travel`, a person for `talk`, a thing for
     * `investigate` or `search`, an art for `train_technique`, a formula for
     * `refine`. Never a number, never a stat, never persisted anywhere the
     * engine reasons about - `Cultivator.location` is explicitly a name the
     * engine stores and lists but never computes with, and everything else is
     * matched against a catalog before it can reach a repository.
     */
    target: z.string().trim().min(1).max(80).optional(),
    /**
     * What the player was trying to do: `negotiate`, `deceive`, `flee`,
     * `interrogate`, anything. An open string, and it is only safe as an open
     * string because no engine path reads it to decide an outcome. It reaches
     * the log and the narrator; it never reaches a conditional that produces a
     * result. Truncated to a label in `validatePlan` rather than rejected on
     * length: a model that writes a sentence here has not done anything
     * dangerous, and throwing the whole plan away over it would cost the player
     * a turn for no gain.
     */
    intent: z.string().trim().min(1).max(400).optional(),
    /**
     * What an approach is ABOUT, when the player asked about something.
     *
     * Separate from `target`, which is who they asked. Both are needed and
     * neither substitutes: who you ask decides what you get, so the engine
     * has to know both before it can say what came back. Like `intent`,
     * nothing branches on it to produce an outcome - it selects which facts
     * the person in front of the player could plausibly hold, and the
     * holding is read off state.
     */
    topic: z.string().trim().min(1).max(120).optional(),
    /** The model's one-line justification. Logged for transparency, never executed. */
    reason: z.string().trim().max(200).optional()
});

export type PlannedAction = z.infer<typeof PlannedActionSchema>;

/** Where a plan came from. Surfaced to the client so the seam is visible. */
export type PlanSource = 'model' | 'fallback';

export interface Plan {
    action: PlannedAction;
    source: PlanSource;
    /** Why the fallback ran, when it ran. Diagnostic, shown in `toolCalls`. */
    note?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// DETERMINISTIC INTENT PARSING
// The zero-configuration path, and the safety net under the model. It must be
// good enough to play the whole game with, because with no provider reachable
// it *is* the whole game.
// ─────────────────────────────────────────────────────────────────────────

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

        let count = 1;
        for (const token of tail.reverse()) {
            const digits = Number(token.replace(/[^0-9.]/g, ''));
            if (Number.isFinite(digits) && digits > 0) { count = digits; break; }
            if (token === 'half') { count = 0.5; break; }
            const word = WORD_NUMBERS[token];
            if (word !== undefined) { count = word; break; }
        }

        const days = Math.round(count * unitDays);
        return Math.max(1, Math.min(MAX_CULTIVATION_DAYS, days));
    }

    // A bare number with no unit is not a duration. "I strike the barrier 3
    // times" must not become three days of seclusion.
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
function extractDestination(input: string): string | undefined {
    const prepositional = /\b(?:to|towards?|into|for)\s+(.{2,80}?)\s*[.!?]?$/i.exec(input);
    if (prepositional) return cleanPlace(prepositional[1]);

    // "travel Scarwater" - a bare destination straight after the verb.
    const bare = /^\s*(?:i\s+)?(?:travel|go|walk|head|journey|move|depart|leave|set out)\s+(.{2,80}?)\s*[.!?]?$/i
        .exec(input);
    return bare ? cleanPlace(bare[1]) : undefined;
}

function cleanPlace(raw: string): string | undefined {
    const cleaned = raw.replace(/^\s*the\s+/i, '').trim();
    return cleaned.length >= 2 ? cleaned.slice(0, 80) : undefined;
}

/** Text following a conversational verb, cleaned into a name. */
function extractTarget(input: string): string | undefined {
    const match = /\b(?:to|with|at)\s+(.{2,80}?)\s*[.!?]?$/i.exec(input);
    const cleaned = (match?.[1] ?? '').trim();
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
 * Intent tables for the deterministic parser.
 *
 * Note carefully what these do and do not do. They label what the player was
 * trying to do so the narrator can describe it; they never select an engine
 * path. Every `move` resolves through the same movement routine and every
 * `interact` through the same interaction routine, whichever label matched -
 * which is the whole reason the label is allowed to be an open string.
 */
const MOVE_INTENT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['flee', /\b(?:flee|escape|run away|get away|disengage|retreat|break off|withdraw|hide from)\b/],
    ['enter', /\b(?:enter|go inside|step into|climb into|breach|infiltrate|sneak into|slip into)\b/],
    ['approach', /\b(?:approach|draw near|walk up to|close on|come to)\b/],
    ['follow', /\b(?:follow|shadow|trail|tail)\b/],
    ['travel', /\b(?:travel|go to|head (?:to|for|out|north|south|east|west|upriver|downriver|inland|back|on|home)|walk to|journey|set out|set off|press on|carry on to|depart|move to|leave for|make (?:my|his|her) way)\b/]
];

const ATTACK_SUBJECT_VERBS = /attack|strike at|strike|hit|fight|kill|cut down|draw on|swing at|go for|set upon|set on|jump|ambush|assault|take on|put down|finish/;

const MOVE_SUBJECT_VERBS = /flee|escape|run|retreat|hide|withdraw|enter|infiltrate|sneak into|approach|follow|travel|go|head|walk|journey|depart|move/;

const INTERACT_INTENT_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['deceive', /\b(?:lie to|deceive|mislead|misdirect|bluff|pretend|disguise|pose as|feign|trick)\b/],
    ['threaten', /\b(?:threaten|intimidate|menace|warn (?:him|her|them)|make (?:him|her|them) afraid)\b/],
    ['bribe', /\b(?:bribe|pay off|grease|buy (?:his|her|their) silence)\b/],
    ['interrogate', /\b(?:interrogate|question|press (?:him|her|them)|demand to know|grill)\b/],
    ['trade', /\b(?:trade|buy|sell|purchase|barter|haggle|market|shop|price)\b/],
    ['negotiate', /\b(?:negotiate|bargain|make terms|come to terms|strike a deal|petition|ally|alliance|swear|join|apply to|seek protection|beg)\b/],
    ['recruit', /\b(?:recruit|hire|take on|enlist|bring (?:him|her|them) in)\b/],
    ['apologise', /\b(?:apologi[sz]e|make amends|beg (?:his|her|their) pardon)\b/],
    ['talk', /\b(?:talk|speak|ask|greet|converse|say|tell|introduce myself)\b/]
];

/**
 * Generic ways of saying "a person", which are not names.
 *
 * "someone" resolved against the roster and came back with a specific
 * cultivator, which handed the player a name they had not earned off a word
 * that named nobody. A generic person means whoever is at hand, and who that
 * turns out to be is the engine's to decide.
 */
const ANYBODY = /^(?:around|about|someone|somebody|anyone|anybody|people|folk|the locals|the people|a passerby|a stranger|a local|them|him|her|somebody else)$/i;

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

    const pivot = ASK_PIVOT.exec(rest);
    const who = (pivot ? rest.slice(0, pivot.index) : rest).trim();
    const about = pivot ? rest.slice(pivot.index + pivot[0].length).trim() : '';

    const person = who.length >= 2 && !ANYBODY.test(who) ? cleanPlace(who) : undefined;
    const topic = about.length >= 2 ? cleanPlace(about) : undefined;
    return { ...(person ? { person } : {}), ...(topic ? { topic } : {}) };
}

const INTERACT_SUBJECT_VERBS = /interact with|deceive|mislead|bluff|pose as|trick|lie to|threaten|intimidate|bribe|interrogate|question|trade|buy|sell|barter|haggle|negotiate|bargain|petition|ally with|join|apply to|swear to|beg|recruit|hire|apologi[sz]e to|talk|speak|ask|greet|tell/;

function matchIntent(text: string, table: ReadonlyArray<[string, RegExp]>): string | undefined {
    for (const [label, pattern] of table) {
        if (pattern.test(text)) return label;
    }
    return undefined;
}

function extractSubject(input: string, verbs: RegExp): string | undefined {
    const afterVerb = new RegExp(
        `\\b(?:${verbs.source})\\b\\s*(?:the|a|an|for|into|at|with|about|to|on|through|around)?\\s+(.{2,80}?)\\s*[.!?]?$`,
        'i'
    ).exec(input);
    if (afterVerb) return cleanPlace(afterVerb[1]);
    return extractTarget(input);
}

/**
 * Turn free text into one action, with no model involved.
 *
 * Order is significance-first, not frequency-first: "break through" contains
 * "through", "train" appears in both technique practice and cultivation,
 * "gather qi" is cultivating while "gather herbs" is foraging, and the specific
 * reading must win in each case. Anything unrecognised resolves to `unclear`,
 * which passes no time and changes nothing - an intent the engine did not
 * understand must never cost the player a year of their life. It used to
 * say `look` here, and it used to be true; a fallthrough that quietly
 * became `cultivate` is what this comment was describing when it was
 * wrong.
 */

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
        + 'would like to|had better|am going to|set out to|mean to)\\s+)'
        + '(?:just |now |quietly |carefully |instead )?'
        + '(?:' + verbs + ')' + '\\b',
        'i'
    ).test(text);
}

export function parseIntent(input: string): PlannedAction {
    const text = input.toLowerCase().trim();

    // -- attacking somebody, which had no route at all --
    //
    // The engine has had combat the whole time: `resolveExchange`,
    // `resolveConfrontation`, `battlesSurvived` on the row. The parser had no
    // way to reach any of it, so "I attack the nearest cultivator" fell
    // through the whole table until the cultivation branch caught the noun.
    // First, because every sentence about a fight is full of other verbs' nouns.
    if (usedAsVerb(text, 'attack|attacks|strike|strikes|hit|hits|fight|fights|kill|kills|'
        + 'cut down|draw on|swing at|go for|set (?:on|upon)|jump|ambush|assault|'
        + 'take (?:him|her|them) on|put (?:him|her|them) down|finish (?:him|her|them)')
        || /\bstrike (?:at )?(?:him|her|them|the [a-z])/.test(text)) {
        return {
            action: 'attack',
            target: extractSubject(input, ATTACK_SUBJECT_VERBS),
            intent: /\b(?:kill|finish|cut down|put (?:him|her|them) down)\b/.test(text)
                ? 'kill'
                : /\b(?:subdue|pin|restrain|capture|take alive)\b/.test(text)
                    ? 'subdue'
                    : /\b(?:humiliate|shame|embarrass|make an example)\b/.test(text)
                        ? 'humiliate'
                        : 'drive_off'
        };
    }

    if (/\b(?:break\s*through|breakthrough|strike (?:at )?the barrier|push (?:past|through|against) the (?:barrier|bottleneck)|force (?:the |my way through the )?(?:barrier|bottleneck)|assault the barrier|attempt the (?:next )?rank|advance a rank|(?:try|attempt) (?:to |for )?(?:the )?(?:next realm|advancement))\b/.test(text)) {
        return { action: 'breakthrough' };
    }

    // Closed-door seclusion before ordinary cultivation: it is the more
    // specific reading of the same sentence, and it is a different bargain -
    // sealed against encounters, and against opportunities with them.
    if (/\b(?:closed[- ]?door|seal (?:myself|the (?:cave|door))|sealed seclusion|enter seclusion|go into seclusion|shut myself)\b/.test(text)) {
        return { action: 'seclude', days: parseDuration(text) ?? DEFAULT_SECLUSION_DAYS };
    }

    // ── the mortal economy, before anything that spends time ──
    //
    // Deliberately ahead of `eat`, `trade` and `cultivate`. A player with no
    // stones who types "take work for a season" is asking for the only action
    // that saves them, and every slower reading of that sentence is fatal.
    if (/\b(?:take (?:any |whatever |some )?work|(?:look|looking|hunt|hunting|cast about|casting about|ask|asking) (?:around )?for (?:any |some |paid )?(?:work|a job|jobs|employment|hire)|find (?:me |myself |a |some )?(?:work|job|employment)|hire (?:myself|on|out)|take a job|get a job|odd jobs?|day labour|day labor|earn (?:some |a few |my )?(?:stones?|keep|coin|money|living|wages?)|work (?:for|in|at|the|a|as)|labour|labor|make myself useful|work off)\b/.test(text)
        // `work on` is practice, not employment. Without this guard
        // "I work on my technique" was answered with a season of hauling.
        || /^\s*(?:i\s+)?works?\b(?!\s+on\b)/.test(text)) {
        return {
            action: 'work',
            days: parseDuration(text) ?? DEFAULT_WORK_DAYS,
            target: extractSubject(input, /work as|hire (?:myself )?(?:out )?as|take work as|job as/)
        };
    }

    // -- asking somebody, which is not the same as consulting a register --
    //
    // Requires a person: `someone`, `the old woman`, `around`, `the locals`.
    // Without one the sentence is a query about the world rather than a
    // question put to anybody, and the surfaces below answer it.
    const asked = /\b(?:ask|asking|asks|enquire|inquire|put it to|question|press)\b/.test(text)
        ? parseAsk(input)
        : null;
    if (asked && !/\bjoin(?:ing)?\b/.test(text)) {
        return {
            action: 'interact',
            intent: matchIntent(text, INTERACT_INTENT_PATTERNS) ?? 'talk',
            ...(asked.person ? { target: asked.person } : {}),
            ...(asked.topic ? { topic: asked.topic } : {})
        };
    }

    // The noun `market` is a place people stand in and steal from and talk
    // about. Asking to SEE the board is a different sentence, and it is
    // either a question about what things cost or a verb aimed at a stall.
    if (/\b(?:what(?:'s| is) (?:for sale|on offer)|what can i buy|going rate|how much (?:is|are|does)|price of|cost of|the prices?)\b/.test(text)
        || (usedAsVerb(text, 'browse|shop|buy|sell|barter|haggle|price|visit|check|see|find|go to|look at|look over|head to|walk to')
            && /\b(?:market|marketplace|bazaar|stalls?|prices?|shops?|traders?)\b/.test(text))) {
        return { action: 'market', target: extractSubject(input, /market for|price of|cost of|buy|sell/) };
    }

    // Stocking up comes before eating, because "buy food" is ambiguous and
    // the expensive reading of getting it wrong is one-directional: a
    // player who meant one meal and got a month of rations has lost some
    // stones, and a player who meant a month and got one meal starves.
    if (/\b(?:stock up|lay in|load up|provision myself|buy provisions|buy (?:some |a |my )?(?:rations?|supplies|provisions)|(?:buy|get|pick up|purchase) (?:a |one |two |three |[0-9]+ )?(?:months?|weeks?|days?|years?|seasons?) (?:of |worth of )?(?:food|rations?|provisions|supplies)|provisions? for|rations? for|food for the (?:road|trip|journey|way))\b/.test(text)) {
        return { action: 'provision', days: parseDuration(text) ?? undefined };
    }

    if (/\b(?:eat|meal|dine|breakfast|supper|feed myself|buy food)\b/.test(text)
        || /\b(?:food|rations?)\b/.test(text)) {
        return { action: 'eat' };
    }

    if (/\b(?:refine|concoct|brew|distil|distill|alchemy|cauldron)\b/.test(text)
        && /\b(?:pill|elixir|medicine|formula|recipe|cauldron|alchemy)\b/.test(text)) {
        return { action: 'refine', target: extractSubject(input, /refine|concoct|brew|distil|distill|make/) };
    }

    if ((/\b(?:gather|forage|harvest|pick|collect|dig up)\b/.test(text)
            || (/\b(?:look|looking|hunt|hunting|search|searching|out) for\b/.test(text)
                && /\b(?:herbs?|roots?|plants?|ingredients?|reagents?|flowers?|mushrooms?|grasses|moss)\b/.test(text)))
        && !/\bgather (?:qi|energy|my qi)\b/.test(text)) {
        return { action: 'gather', target: extractSubject(input, /gather|forage|harvest|pick|collect|dig up/) };
    }

    if (/\b(?:practi[cs]e|drill|rehearse|work on)\b.*\b(?:art|technique|manual|stance|form)\b/.test(text)
        || /\b(?:train|practi[cs]e)\s+(?:the\s+)?[a-z-]+\s+(?:art|technique|manual|stance)\b/.test(text)) {
        return {
            action: 'train_technique',
            target: extractSubject(input, /practi[cs]e|train|drill|rehearse|work on/)
        };
    }

    // ── move: one action, several ways of going ──
    const moveIntent = matchIntent(text, MOVE_INTENT_PATTERNS);
    if (moveIntent) {
        const destination = extractDestination(input);

        // Following and approaching take a PERSON. "I follow the cultivator"
        // used to hand `cultivator` to the mover as a destination, and the
        // engine dutifully spent the travel days, wrote the location, and then
        // described the ambient qi of a place called `cultivator`. A verb
        // whose object is a person must not produce a place, so when no
        // destination preposition was used these go to the person instead -
        // where they cost nothing and can be refused honestly.
        if (!destination && (moveIntent === 'follow' || moveIntent === 'approach')) {
            return {
                action: 'interact',
                target: extractSubject(input, MOVE_SUBJECT_VERBS),
                intent: moveIntent
            };
        }

        return {
            action: 'move',
            target: destination ?? extractSubject(input, MOVE_SUBJECT_VERBS),
            intent: moveIntent
        };
    }

    if (/\b(?:join|joining|apply to|applying to|swear to|take me on|taken on|would (?:take|have) me|accept me|admit me|be admitted)\b/.test(text)
        || (/\b(?:sects?|order|school|clan)\b/.test(text) && /\b(?:look for|find|near|nearby|around here|what|which|who)\b/.test(text))) {
        return { action: 'sect', target: extractSubject(input, /joining|join|applying to|apply to|swear to|enter|find|look for/) };
    }

    // ── assess: what happens if I try, which is not the same as looking ──
    if (/\b(?:size up|weigh (?:my|the) chances|assess|how dangerous|could i (?:survive|take|handle|manage)|what (?:would|will) happen if i|am i (?:strong|ready) enough|is it safe|do i stand a chance|judge the odds)\b/.test(text)) {
        return {
            action: 'assess',
            target: extractSubject(input, /assess|size up|survive|take|handle|manage|against|enough for/)
        };
    }

    // ── investigate: examining, reading, searching a place ──
    if (/\b(?:investigate|examine|inspect|study|decipher|appraise|look into|find out about|search|scour|comb|explore|delve|survey|read the|check the|poke (?:about|around)|nose (?:about|around)|rummage|sift|pick through|dig through|dig about|look (?:over|through)|go through|walk the|climb (?:into|down into)|venture into|case the|scavenge|loot|salvage)\b/.test(text)) {
        return {
            action: 'investigate',
            target: extractSubject(input, /investigate|examine|inspect|study|decipher|appraise|look into|find out about|search|scour|comb|explore|delve|survey|read|check|poke (?:about|around)|nose (?:about|around)|rummage|sift|pick through|dig through|dig about|look over|look through|go through|walk|climb into|venture into|case|scavenge|loot|salvage/)
        };
    }

    // ── interact: everything done to or with a person or a faction ──
    const interactIntent = matchIntent(text, INTERACT_INTENT_PATTERNS);
    if (interactIntent) {
        return {
            action: 'interact',
            target: extractSubject(input, INTERACT_SUBJECT_VERBS),
            intent: interactIntent
        };
    }

    if (/\b(?:status|sheet|stats|how am i|my (?:rank|realm|progress|cultivation)|check myself|where do i stand)\b/.test(text)) {
        return { action: 'status' };
    }

    // `cultivat\\w*` used to be the pattern here, and it matched
    // "cultivator" - the commonest noun in the setting. Any sentence about
    // another person became a month of seclusion. The verb forms are
    // enumerated now, and they must be in verb position; the noun forms
    // (`cultivator`, `cultivators`) are deliberately absent from the list.
    if (usedAsVerb(text, 'cultivate|cultivates|cultivating|meditate|meditates|meditating|'
        + 'seclude|secludes|circulate|circulates|circulating|absorb|absorbs|absorbing|'
        + 'breathe|breathes|breathing|sit|sits|settle|settles')
        || /\b(?:in seclusion|into seclusion|gather qi|refine qi|closed[- ]?door cultivation|my cultivation practice)\b/.test(text)) {
        return { action: 'cultivate', days: parseDuration(text) ?? DEFAULT_CULTIVATION_DAYS };
    }

    if (/\b(?:wait|rest|sleep|pass the time|do nothing|linger|loiter|listen|listening|eavesdrop|hang about|hang around)\b/.test(text)) {
        return { action: 'wait' };
    }

    // ── look ──
    //
    // This branch used to not exist: `look` was reachable only as the
    // fallthrough, so the moment the fallback became inert, "I look around"
    // stopped working. A verb that is only reachable by accident is a verb
    // waiting to be deleted by an unrelated change.
    //
    // Two questions, one action, and they must not return the same
    // paragraph. Somebody scanning a square for a face is not asking about
    // the weather, and answering both with the room made the narrower
    // question pointless to ask.
    if (/\b(?:who(?:'s| is| are)? (?:here|around|about|nearby)|is (?:anyone|anybody|somebody) (?:here|about|around)|look for (?:someone|somebody|anyone)|who else is|anybody about|see (?:anyone|anybody|who is here))\b/.test(text)) {
        return { action: 'look', intent: 'company' };
    }

    if (/\b(?:look (?:around|about|up|out)|have a look|glance (?:around|about)|survey|take (?:it|the place) in|where am i|what do i see|what is (?:here|around))\b/.test(text)
        || /^\s*(?:i\s+)?looks?\b/.test(text)) {
        return { action: 'look' };
    }

    // A duration and NOTHING ELSE - "ten years" - is a request for seclusion,
    // and it is the single most common thing a player types in this genre.
    //
    // The `nothing else` is load-bearing and was learned the hard way. This
    // used to fire on any sentence containing a duration, so "I take whatever
    // work the village will give me for a season" matched on "a season" and
    // became three months of cultivation. The player was five days from
    // starving, asked for the one action that earns food money, and was given
    // the one action that kills. The run closed permanently.
    if (isBareDuration(text)) {
        const bare = parseDuration(text);
        if (bare !== null) return { action: 'cultivate', days: bare };
    }

    // Nothing matched. The fallback is inert BY RULE: an action the engine is
    // not confident about must be the cheapest one available, never the most
    // expensive. No time passes, no food is eaten, nothing dies.
    return { action: FALLBACK_ACTION };
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

/**
 * Pull the first balanced JSON object out of a model response.
 *
 * Models wrap JSON in prose, in fences, and in apologies. Scanning for a
 * balanced brace pair is more forgiving than a fence regex and cannot be
 * tricked into returning a fragment: an unbalanced response yields null, and
 * null means the deterministic parser runs instead.
 */
export function extractJsonObject(text: string): unknown | null {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(text.slice(start, i + 1));
                } catch {
                    return null;
                }
            }
        }
    }
    return null;
}

/**
 * Validate a model's phase-1 response into a plan, or report why it could not be.
 *
 * The `ok: false` branch is not exceptional. It is the boundary doing its job,
 * and every caller must respond to it by running {@link parseIntent} instead.
 */
export function validatePlan(raw: unknown): { ok: true; action: PlannedAction } | { ok: false; reason: string } {
    const parsed = PlannedActionSchema.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const path = issue?.path.join('.') || 'response';
        return { ok: false, reason: `${path}: ${issue?.message ?? 'did not validate'}` };
    }

    // Fields are kept only on the actions that own them. Letting `days` ride
    // along on a `look` would make an examination read, in the log, as though
    // it had consumed a decade.
    const { action: name, days, target, intent, reason } = parsed.data;
    const action: PlannedAction = { action: name };

    if (TIMED_ACTIONS.includes(name)) {
        action.days = days ?? (
            name === 'seclude' ? DEFAULT_SECLUSION_DAYS
                : name === 'work' ? DEFAULT_WORK_DAYS
                    : DEFAULT_CULTIVATION_DAYS);
    }
    if (target && TARGETED_ACTIONS.includes(name)) {
        action.target = target;
    }
    if (intent && INTENT_ACTIONS.includes(name)) {
        // Normalised to a bare label. It is going into a log line and a prompt,
        // never into a conditional, so the only thing that matters is that it
        // stays short and unpunctuated.
        action.intent = intent.toLowerCase().replace(/[^a-z0-9 _-]/g, '').trim().slice(0, 40) || undefined;
    }
    if (reason) action.reason = reason;

    return { ok: true, action };
}
