/**
 * The closed action set — phase 1 of the narrator loop.
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

/**
 * Every verb the engine can execute. Adding one here is a deliberate act that
 * requires a matching deterministic implementation in game.ts; the model can
 * never widen this list at runtime.
 */
export const ACTION_NAMES = [
    'cultivate',
    'breakthrough',
    'travel',
    'eat',
    'train_technique',
    'talk',
    'look',
    'status',
    'wait'
] as const;

export type ActionName = typeof ACTION_NAMES[number];

/** Actions that pass no in-world time and change no cultivator state. */
export const READ_ONLY_ACTIONS: readonly ActionName[] = ['look', 'status', 'talk'] as const;

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
     * Free text: a destination for `travel`, a person for `talk`, an art for
     * `train_technique`. Never a number, never a stat, never persisted anywhere
     * the engine reasons about — `Cultivator.location` is explicitly a name the
     * engine stores and lists but never computes with.
     */
    target: z.string().trim().min(1).max(80).optional(),
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
 * the cultivator to a place called "I set out." — the engine would dutifully
 * store it, and the run would be quietly nonsense from then on.
 */
function extractDestination(input: string): string | undefined {
    const prepositional = /\b(?:to|towards?|into|for)\s+(.{2,80}?)\s*[.!?]?$/i.exec(input);
    if (prepositional) return cleanPlace(prepositional[1]);

    // "travel Scarwater" — a bare destination straight after the verb.
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
 * Turn free text into one action, with no model involved.
 *
 * Order is significance-first, not frequency-first: "break through" contains
 * "through", "train" appears in both technique practice and cultivation, and
 * the specific reading must win. Anything unrecognised resolves to `look`,
 * which passes no time and changes nothing — an intent the engine did not
 * understand must never cost the player a year of their life.
 */
export function parseIntent(input: string): PlannedAction {
    const text = input.toLowerCase().trim();

    if (/\b(?:break\s*through|breakthrough|strike the barrier|push (?:past|through) the (?:barrier|bottleneck)|attempt the (?:next )?rank|advance a rank)\b/.test(text)) {
        return { action: 'breakthrough' };
    }

    if (/\b(?:eat|food|meal|dine|rations?|breakfast|supper|feed myself|buy food)\b/.test(text)) {
        return { action: 'eat' };
    }

    if (/\b(?:travel|go to|head (?:to|for|out)|walk to|journey|set out|depart|move to|leave for|make (?:my|his|her) way)\b/.test(text)) {
        return { action: 'travel', target: extractDestination(input) };
    }

    if (/\b(?:practi[cs]e|drill|rehearse|work on|refine)\b.*\b(?:art|technique|manual|stance|form)\b/.test(text)
        || /\b(?:train|practi[cs]e)\s+(?:the\s+)?[a-z-]+\s+(?:art|technique|manual|stance)\b/.test(text)) {
        return { action: 'train_technique', target: extractTarget(input) };
    }

    if (/\b(?:talk|speak|ask|greet|converse|say|tell|bargain|haggle|negotiate)\b/.test(text)) {
        return { action: 'talk', target: extractTarget(input) };
    }

    if (/\b(?:cultivat|meditat|seclusion|secluded|circulate|gather qi|refine qi|sit\b|sits\b|sat\b|absorb)\b/.test(text)) {
        return { action: 'cultivate', days: parseDuration(text) ?? DEFAULT_CULTIVATION_DAYS };
    }

    if (/\b(?:status|sheet|stats|how am i|my (?:rank|realm|progress|cultivation)|check myself)\b/.test(text)) {
        return { action: 'status' };
    }

    if (/\b(?:wait|rest|sleep|pass the time|do nothing|linger)\b/.test(text)) {
        return { action: 'wait' };
    }

    // A duration with no verb — "ten years" — is a request for seclusion. It is
    // the single most common thing a player types in this genre.
    const bareDuration = parseDuration(text);
    if (bareDuration !== null) return { action: 'cultivate', days: bareDuration };

    return { action: 'look' };
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

    // `days` is meaningless on any verb but seclusion, and letting it ride along
    // would make a `look` action look like it consumed a decade in the log.
    const action: PlannedAction = { action: parsed.data.action };
    if (parsed.data.action === 'cultivate') {
        action.days = parsed.data.days ?? DEFAULT_CULTIVATION_DAYS;
    }
    if (parsed.data.target && (parsed.data.action === 'travel' || parsed.data.action === 'talk' || parsed.data.action === 'train_technique')) {
        action.target = parsed.data.target;
    }
    if (parsed.data.reason) action.reason = parsed.data.reason;

    return { ok: true, action };
}
