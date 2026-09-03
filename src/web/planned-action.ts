/**
 * The object both paths hand the engine.
 *
 * There are two ways a sentence becomes a plan - the deterministic table reads
 * it, or a model answers phase 1 and `validatePlan` checks the answer - and the
 * whole architecture rests on those two producing the same thing. So the schema,
 * the validator that checks a model's answer against it, and the pass that puts
 * back what that answer cannot carry are one piece: adding a field means editing
 * all three, every time. The banner below said as much inside `actions.ts` while
 * the three sat three thousand lines apart in it.
 *
 * Single reason to change: a field is added to what a plan carries.
 *
 * ── THE DEPENDENCY RUNS ONE WAY AT RUNTIME ───────────────────────────────
 *
 * `carryWhatOnlyTheSentenceKnows` calls `parseIntent`, so this module imports
 * the pattern table. The table imports only the TYPE back, which erases, so
 * there is no cycle once the code is running. `LEVERAGE_BEHIND_INTENT` stayed
 * in the table deliberately for the same reason: it is read where a verb is
 * recognised, and moving it here would have made the edge run both ways for
 * nothing.
 */

import { z } from 'zod';

import { ApproachLeverageSchema } from '../schema/cultivation.js';
import {
    type SomebodyStandingHere,
    theNameTheVerbDropped
} from './the-name-the-verb-dropped.js';
import {
    ACTION_NAMES,
    TIMED_ACTIONS,
    TARGETED_ACTIONS,
    TOPIC_ACTIONS,
    INTENT_ACTIONS
} from './action-set.js';
import {
    MAX_CULTIVATION_DAYS,
    DEFAULT_CULTIVATION_DAYS,
    DEFAULT_SECLUSION_DAYS,
    DEFAULT_WORK_DAYS
} from './verb-day-costs.js';
import { parseIntent } from './actions.js';

/**
 * Intents the prompt suggests for `move`. Suggestions, not a schema: the field
 * accepts any short label, because the engine resolves movement from state and
 * reads the label only to describe what was attempted.
 */
export const MOVE_INTENTS = ['travel', 'flee', 'approach', 'enter', 'follow'] as const;

/**
 * Intents the prompt suggests for `interact`. Open by design; see above.
 *
 * `petition` used to be on this list and is deliberately gone. It was the
 * clearest single expression of the defect the four verbs above exist to fix:
 * the prompt was actively suggesting that a model route a petition to the verb
 * that walks the player over and describes the building, and a player who filed
 * one got a paragraph about architecture.
 */

export const INTERACT_INTENTS = [
    'talk', 'negotiate', 'trade', 'deceive', 'interrogate',
    'threaten', 'bribe', 'recruit', 'apologise', 'seduce', 'steal'
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
     * WHAT IS BEHIND THE ASK, set by the parser rather than translated later.
     *
     * The social-leverage resolver reads `leverage` and never `intent` - that
     * is the whole design of it, and it is what keeps seduction priced by the
     * same machine that prices a purse or a threat instead of becoming a
     * subsystem with its own rules. Setting it HERE, where the verb is already
     * being recognised, keeps that rule strictly true: `game.ts` passes it
     * through and does not translate a word into a mechanic.
     *
     * Optional and defaulted to `none` downstream, because most sentences put
     * nothing on the table.
     */
    leverage: ApproachLeverageSchema.optional(),
    /**
     * WHAT THE TWO OF THEM SAID THE FIGHT WAS, set by the parser for the same
     * reason `leverage` is.
     *
     * `agreed` is a bout both parties consented to - a spar, a duel, a
     * challenge. Absent is `open`: nobody promised anybody anything, which
     * covers a brawl and a planned murder alike.
     *
     * It changes NOTHING about the fight. The goal handed to the resolver is
     * `subdue` either way, the exchanges are the same exchanges, the wounds are
     * the same wounds and the death gate is the same gate - the ruling in
     * AGENTS.md is that a bout is combat with both sides agreeing to be gentle,
     * and that nothing may quietly make it unable to kill. What this decides is
     * downstream and only downstream: whether a killing was also a broken word,
     * which is a question about people and not about a body.
     */
    terms: z.enum(['agreed', 'open']).optional(),
    /**
     * HOW THE FIGHT WAS OPENED, set by the parser for the same reason `terms`
     * is: it is a fact about what the player did, not a label a model chooses.
     *
     * Opening from concealment is a different act from squaring up. It reaches
     * `resolveConfrontation`'s own `opening`, where it gives the first exchange
     * the `ambush` edge the table has priced since before this field existed
     * and takes the target's answering swing in that round away - because they
     * did not know they were in a fight, which is the whole content of it.
     *
     * What it does NOT change is what a blow does to a body. That would be two
     * sets of physics reachable by choosing your words. What it changes besides
     * the opening is what the deed says about the person who did it, which is
     * the consequence layer's and is where an ambush actually costs something.
     */
    opening: z.enum(['open', 'from_concealment']).optional(),
    /**
     * How many rations, where the sentence names a count rather than a span.
     *
     * Separate from `days` because they are different asks and the conversion
     * between them is not the parser's to make: how long a ration lasts depends
     * on the body carrying it, since hunger tapers by realm. Bounded so a model
     * answering `1e9` cannot ask the purse for a heat-death of provisions.
     */
    rations: z.number().int().min(1).max(100_000).optional(),
    /**
     * How many spirit stones are being handed over, where the sentence says.
     *
     * Only `give` reads it, and it is here for the reason `rations` is: it is a
     * fact the SENTENCE carries and the phase-1 prompt does not ask for, so
     * `carryWhatOnlyTheSentenceKnows` puts it back on the model path. Without
     * it "I put ten stones on the table" hands the engine a gift with no
     * amount, and a gift with no amount is a different act.
     */
    stones: z.number().int().min(1).max(100_000_000).optional(),
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
    const { action: name, days, target, intent, topic, terms, reason } = parsed.data;
    const action: PlannedAction = { action: name };

    // Kept only on the verb that owns it, like everything else here. A model
    // that says a fight was agreed has said something the consequence layer
    // needs; a model that says a journey was agreed has said nothing, and
    // letting it ride along would put a word in the ledger that means nothing.
    if (terms && name === 'attack') action.terms = terms;

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
    // The sect surface carries two extras the other actions do not: the
    // siphoning pace on `topic`, and how long to run it on `days`. Preserved
    // here as well as in the deterministic parser, or a model-planned theft
    // would silently lose its pace and run for one month at the default.
    if (topic && TOPIC_ACTIONS.includes(name)) {
        action.topic = topic.toLowerCase().replace(/[^a-z0-9 _-]/g, '').trim().slice(0, 40) || undefined;
    }
    if (days && name === 'sect') action.days = days;

    if (reason) action.reason = reason;

    return { ok: true, action };
}

// ─────────────────────────────────────────────────────────────────────────
// THE TWO PATHS MUST HAND THE ENGINE THE SAME OBJECT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Put back the facts about the SENTENCE that a model's answer cannot carry.
 *
 * ── THE DEFECT THIS FIXES ────────────────────────────────────────────────
 *
 * There are two ways a sentence becomes a `PlannedAction`: {@link parseIntent}
 * reads it here, or a model answers phase 1 and {@link validatePlan} checks
 * the answer. The whole architecture rests on those two producing the same
 * thing, because otherwise a configured provider and an unconfigured one are
 * two different games.
 *
 * They did not. Measured over twenty sentences, four reached the engine as a
 * different action object depending on which path ran:
 *
 *     "I threaten the steward into handing over the ledger"
 *          parser  {action:'interact', intent:'threaten', leverage:'force'}
 *          model   {action:'interact', intent:'threaten'}
 *
 *     "I buy 200 rations"
 *          parser  {action:'provision', rations:200}
 *          model   {action:'provision', days:30}
 *
 * `leverage` and `rations` are not in the phase-1 schema the model is shown,
 * and `validatePlan` drops both. The first case matters because the social
 * resolver reads `leverage` and never `intent` - that is the whole design of
 * it - so with a provider configured a threat was priced as a bare ask. The
 * second is worse than a dropped field: `provision` is a timed action, so the
 * stripped `rations` was replaced by a defaulted thirty days. A player who
 * asked for two hundred rations got a month, silently, and only with a
 * narrator running.
 *
 * ── WHY THE FIX IS HERE AND NOT IN THE PROMPT ────────────────────────────
 *
 * The tempting fix is to teach the model to emit `leverage`. That is the
 * wrong direction and it breaks a rule this package is built on: leverage is
 * a fact about what the player put on the table, decided by the parser
 * precisely so that nothing downstream translates a word into a mechanic. A
 * model choosing it would be a model deciding how an approach is priced.
 *
 * So the model keeps the job it is good at - reading which VERB a sentence
 * meant - and the sentence keeps the job it has always had. This never
 * overrides the model: it only fills fields the model left empty, and only
 * when both paths already agree on the verb. Where they disagree the model's
 * verb stands untouched and nothing is carried, because a leverage read off a
 * sentence the parser understood as a different action is a fact about a
 * different action.
 */
export function carryWhatOnlyTheSentenceKnows(
    action: PlannedAction,
    input: string,
    /**
     * Who is standing in front of the player, when the caller knows.
     *
     * Empty by default so the two callers that have no room in scope - the
     * narrator and the sentence splitter - keep working unchanged and simply
     * do not recover a name. The dispatch is the one place that holds the
     * roster, and it is the one place that passes it.
     */
    whoIsStandingHere: readonly SomebodyStandingHere[] = []
): PlannedAction {
    const fromSentence = parseIntent(input);
    const merged: PlannedAction = { ...action };

    // ── THE NAME THE VERB DROPPED, FOR EVERY VERB ────────────────────────
    //
    // Measured at 16% of turns arriving with a bare target - a verb chosen
    // correctly and the person it was against deleted on the way. Half of
    // those were `coerce` and had a different cause, since fixed at the root:
    // `validatePlan` was stripping the target because `coerce` was missing
    // from `TARGETED_ACTIONS`. The rest are spread across verbs, which is the
    // harder half to find by playing, and this is what answers them.
    //
    // ── AND IT SITS ABOVE THE VERB CHECK, WHICH IS DELIBERATE ────────────
    //
    // Everything below this runs only when both readings agree on the verb,
    // because a `leverage` read off a sentence the table understood as a
    // different action is a fact about a different action. A NAME is not like
    // that. "Claire" is Claire whichever verb won, the matcher reads the raw
    // sentence rather than any parse of it, and a player who wrote somebody's
    // name has named them however the rest of the sentence was read. So the
    // name is carried even where the verbs disagree, and it is the only field
    // here that is.
    //
    // ── THE TWO PROPERTIES THAT MAKE IT SAFE TO WIDEN ────────────────────
    //
    // NOT KNOWLEDGE-GATED: the player supplied the name, so nothing is
    // revealed to them that they did not already write down. It is not a
    // lookup, it is a recovery.
    //
    // NO GUESSING: `theNameTheVerbDropped` matches whole words exactly and
    // returns one person or nobody. Two different people named is null, not a
    // choice. Loosen either and this becomes a machine for acting on people
    // nobody named - which at 16% of turns would do far more harm than the
    // refusals it prevents.
    if (
        whoIsStandingHere.length > 0
        && (merged.target ?? '').trim().length < 2
        && TARGETED_ACTIONS.includes(merged.action)
    ) {
        const who = theNameTheVerbDropped(input, whoIsStandingHere);
        if (who) merged.target = who.name;
    }

    if (fromSentence.action !== action.action) return merged;

    // What the player put on the table. Read by `resolveAttempt`, and by
    // nothing that a model is allowed to influence.
    if (merged.leverage === undefined && fromSentence.leverage !== undefined) {
        merged.leverage = fromSentence.leverage;
    }

    // Whether both parties agreed to the fight. In the schema but absent from
    // the phase-1 prompt, so a model never says it and the consequence layer
    // could not tell a spar from an ambush unless the parser had run.
    if (merged.terms === undefined && fromSentence.terms !== undefined) {
        merged.terms = fromSentence.terms;
    }

    // Whether the fight was opened from cover. Same reasoning as `terms`, and
    // the same measurement behind it: "I sneak up on him and strike" and "I
    // attack him while he is not looking" both came back as a plain fight from
    // the model, so the one act the genre is most fond of was invisible until
    // the parser's reading was carried across.
    if (merged.opening === undefined && fromSentence.opening !== undefined) {
        merged.opening = fromSentence.opening;
    }

    // ── WHAT THE COMPLIANCE WAS FOR ──────────────────────────────────────
    //
    // `intent` IS in the phase-1 schema, and a model still leaves it empty:
    // measured on "I make Qiu Wanbo hand over what they carry", where the
    // table reads `{coerce, hand_over}` and the model answered a bare
    // `coerce`. That is not a harmless omission any more. `hand_over` moves a
    // purse and opens a grudge, so a dropped intent is the difference between
    // a robbery and a person kneeling while nothing happens - and the strip
    // offers the sentence, so the commonest way to type it went through the
    // model.
    //
    // Filled, never overridden, on the same rule as every field above: where
    // the model named an intent the model's intent stands.
    if (merged.intent === undefined && fromSentence.intent !== undefined) {
        merged.intent = fromSentence.intent;
    }

    // A count of rations is a different ask from a span of days, and the
    // conversion between them is not the parser's to make - how long a ration
    // lasts depends on the body carrying it. So where the sentence named a
    // count, the count wins and the DEFAULTED span goes: leaving both on would
    // hand `provision` two contradictory instructions.
    if (merged.rations === undefined && fromSentence.rations !== undefined) {
        merged.rations = fromSentence.rations;
        if (fromSentence.days === undefined) delete merged.days;
    }

    // How many stones a gift is. Same reasoning as `rations`: the phase-1
    // prompt does not ask for it, so no model will ever volunteer it, and a
    // gift that loses its amount is a different act from the one that was
    // typed.
    if (merged.stones === undefined && fromSentence.stones !== undefined) {
        merged.stones = fromSentence.stones;
    }

    return merged;
}
