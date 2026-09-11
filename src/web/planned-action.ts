/**
 * The object both paths hand the engine.
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
import { parseDuration } from './sentence-parts.js';

/**
 * Intents the prompt suggests for `move`. Suggestions, not a schema: the field
 * accepts any short label, because the engine resolves movement from state and
 * reads the label only to describe what was attempted.
 */
export const MOVE_INTENTS = ['travel', 'flee', 'approach', 'enter', 'follow'] as const;

/**
 * Intents the prompt suggests for `interact`. Open by design; see above.
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
     * `refine`. Never a number, never a stat, never persisted anywhere the engine
     * reasons about - `Cultivator.location` is explicitly a name the engine stores
     * and lists but never computes with, and everything else is matched against a
     * catalog before it can reach a repository.
     */
    target: z.string().trim().min(1).max(80).optional(),
    /**
     * What the player was trying to do: `negotiate`, `deceive`, `flee`,
     * `interrogate`, anything. An open string, and it is only safe as an open
     * string because no engine path reads it to decide an outcome. It reaches the
     * log and the narrator; it never reaches a conditional that produces a result.
     * Truncated to a label in `validatePlan` rather than rejected on length: a
     * model that writes a sentence here has not done anything dangerous, and
     * throwing the whole plan away over it would cost the player a turn for no
     * gain.
     */
    intent: z.string().trim().min(1).max(400).optional(),
    /**
     * WHAT IS BEHIND THE ASK, set by the parser rather than translated later.
     */
    leverage: ApproachLeverageSchema.optional(),
    /**
     * WHAT THE TWO OF THEM SAID THE FIGHT WAS, set by the parser for the same
     * reason `leverage` is.
     */
    terms: z.enum(['agreed', 'open']).optional(),
    /**
     * HOW THE FIGHT WAS OPENED, set by the parser for the same reason `terms` is:
     * it is a fact about what the player did, not a label a model chooses.
     */
    opening: z.enum(['open', 'from_concealment']).optional(),
    /**
     * HOW THE BLOW WAS THROWN: what was in the hand, where it was aimed, and how
     * much was behind it. Set by the parser, for the same reason `opening` is.
     *
     * THIS FIELD EXISTS BECAUSE `intent` WAS BEING USED FOR IT, against the rule
     * stated on `intent` four fields up - *"no engine path reads it to decide an
     * outcome... it never reaches a conditional that produces a result."*
     * `combat-verbs.ts` read it to choose between `kill`, `subdue`, `humiliate`
     * and `drive_off`, which is a conditional that produces a result, and the
     * result was somebody's death.
     *
     * That was the mechanism. The design defect it carried is set out in full in
     * `engine/cultivation/how-a-blow-was-thrown.ts`: an ENDING was being read out
     * of the opening sentence, so *"I run him through"* came back as shooing
     * somebody away and a throat and a leg got identical answers.
     *
     *   *"just make attacks and drive away the same thing"* -
     *   *"like attacks have severity but it's all an attack"* -
     *   *"it depends on how you attack and how the NPC responds"*
     *
     * So it is three closed enums rather than an open string, and it describes
     * the SWING rather than the outcome. Nothing downstream may read it to pick
     * a winner; what it decides is what the blow can reach, which the engine
     * then weighs against the body it landed on.
     */
    /**
     * THE ART THEY NAMED, when they named one.
     *
     * FOUND BY PLAYING. "I attack him with Cross-Meridian Strike" extracted the
     * target as `him with Cross-Meridian Strike` - the art was folded into the
     * person's name, so it resolved to nobody clean AND was never read as an
     * art. `combat-verbs.ts` then called `artTheyWouldFightWith(cultivator)`
     * and picked whatever it liked.
     *
     * So naming an art in a fight did nothing at all, twice over: the sentence
     * lost the art and the engine chose for you. Every one of the 41 attack
     * arts in the catalog was reachable to learn and unreachable to AIM.
     */
    withArt: z.string().trim().min(2).max(80).optional(),
    thrown: z.object({
        with: z.enum(['in_hand', 'open_hand', 'fist', 'blunt', 'edge', 'art']),
        at: z.enum([
            'throat', 'head', 'spine', 'chest', 'gut', 'limb', 'hand', 'back', 'unstated'
        ]),
        force: z.enum(['a_poke', 'light', 'committed', 'everything'])
    }).optional(),
    /**
     * How many rations, where the sentence names a count rather than a span.
     */
    rations: z.number().int().min(1).max(100_000).optional(),
    /**
     * How many spirit stones are being handed over, where the sentence says.
     */
    stones: z.number().int().min(1).max(100_000_000).optional(),
    /**
     * What an approach is ABOUT, when the player asked about something.
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
 */
export function extractJsonObject(text: string): unknown | null {
    const start = text.indexOf('{');
    if (start === -1) return null;

    const open: string[] = [];
    /** Where the last value that finished inside the object ended, and the shape then. */
    let lastWhole: { at: number; open: string[] } | null = null;
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
        else if (ch === '{' || ch === '[') open.push(ch);
        else if (ch === '}' || ch === ']') {
            open.pop();
            if (open.length === 0) {
                try {
                    return JSON.parse(text.slice(start, i + 1));
                } catch {
                    return null;
                }
            }
            // A nested value that finished. Everything up to here is whole
            // whatever happens after it.
            lastWhole = { at: i + 1, open: [...open] };
        }
    }

    return whatSurvivedTheCut(text, start, lastWhole);
}

/**
 * The complete part of an answer that stopped in the middle.
 */
function whatSurvivedTheCut(
    text: string,
    start: number,
    lastWhole: { at: number; open: string[] } | null
): unknown | null {
    if (lastWhole === null) return null;

    // The trailing comma separates the value that survived from the one that
    // did not, and it is the one character JSON will not forgive.
    const kept = text.slice(start, lastWhole.at).replace(/,\s*$/, '');
    const closed = kept + lastWhole.open
        .slice()
        .reverse()
        .map(bracket => (bracket === '{' ? '}' : ']'))
        .join('');

    try {
        return JSON.parse(closed);
    } catch {
        return null;
    }
}

/**
 * Validate a model's phase-1 response into a plan, or report why it could not be.
 *
 * The `ok: false` branch is not exceptional. It is the boundary doing its job,
 * and every caller must respond to it by running {@link parseIntent} instead.
 */
/**
 * `null` is how a model says a field is absent, and absent is what we asked for.
 */
function absentRatherThanRejected(raw: unknown): unknown {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (value === null || value === undefined) continue;
        if (typeof value === 'string' && value.trim().length === 0) continue;
        out[key] = value;
    }
    return out;
}

export function validatePlan(raw: unknown): { ok: true; action: PlannedAction } | { ok: false; reason: string } {
    const parsed = PlannedActionSchema.safeParse(absentRatherThanRejected(raw));
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

    // The swing, kept on the one verb that can throw one. A model is not
    // expected to fill this in - the parser reads it off the sentence, and the
    // merge below carries it across - but a model that does say how somebody
    // struck has said something true, and dropping it would cost the reading.
    if (parsed.data.thrown && name === 'attack') action.thrown = parsed.data.thrown;
    if (parsed.data.withArt && (name === 'attack' || name === 'coerce')) {
        action.withArt = parsed.data.withArt;
    }

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
 */
export function carryWhatOnlyTheSentenceKnows(
    action: PlannedAction,
    input: string,
    /**
     * Who is standing in front of the player, when the caller knows.
     */
    whoIsStandingHere: readonly SomebodyStandingHere[] = []
): PlannedAction {
    const fromSentence = parseIntent(input);
    const merged: PlannedAction = { ...action };

    // THE NAME THE VERB DROPPED, FOR EVERY VERB
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

    // HOW THE BLOW WAS THROWN. Same reasoning as `opening` and `terms`, and it
    // matters more than either: this is the reading that decides what the swing
    // can reach. A model asked to plan "I run him through" returns `attack` and
    // a target and nothing about the thrust, so without this line the engine
    // would fall back to the bare swing and the thrust would be worth no more
    // than a shove - which is the exact defect this replaced.
    if (merged.thrown === undefined && fromSentence.thrown !== undefined) {
        merged.thrown = fromSentence.thrown;
    }

    // AND THE ART THEY NAMED. Same reasoning as `thrown`: a model asked to
    // plan "I attack him with Cross-Meridian Strike" returns `attack` and a
    // target, and says nothing about the art - so without this the parser's
    // reading is thrown away and the engine picks for the player again.
    if (merged.withArt === undefined && fromSentence.withArt !== undefined) {
        merged.withArt = fromSentence.withArt;
    }

    // WHAT THE COMPLIANCE WAS FOR
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

    // ── AND A SPAN THE PLAYER SAID IN SO MANY WORDS ──────────────────────
    //
    // The only field here that overrides a value the model DID supply, and it
    // is the field where doing anything else is indefensible.
    //
    // FOUND BY PLAYING BLIND. The sentence was `i cultivate for twenty years
    // anyway`. The parser reads that as 7300 days and cannot read it any other
    // way - `twenty` is in the table and `years` is the unit beside it. What
    // ran was a five-year stretch, and the fork that ended it reported *2.4
    // years of 5.0 are spent*, never mentioning the twenty.
    //
    // Fifteen years of a forty-year life, gone between the sentence and the
    // verb, with nothing on the screen saying a shorter stretch had been
    // substituted. And it goes both ways: a model rounding UP spends decades
    // nobody asked for, on a clock that kills.
    //
    // WHY THIS ONE IS NOT `=== undefined` LIKE THE REST. Every field above is
    // carried only where the model volunteered nothing, because the model is
    // the better reader of what a sentence MEANS. A number the player typed is
    // not a reading. It is the thing they put on the table, in the same class
    // as `stones` and `rations`, and the only reason those two can use the
    // weaker rule is that the phase-1 prompt never asks for them.
    //
    // Guarded on the text actually naming one: `fromSentence.days` is a
    // DEFAULT on most sentences - `DEFAULT_SECLUSION_DAYS` and its siblings -
    // and a default overriding a model's considered span would be this defect
    // pointing the other way.
    const saidOutright = parseDuration(input);
    if (saidOutright !== null && merged.days !== saidOutright) {
        merged.days = saidOutright;
    }

    return merged;
}
