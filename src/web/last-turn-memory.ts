/**
 * One turn of memory, so a sentence may refer to the turn before it.
 */

import {
    costsTheAskerNothing,
    parseDuration,
    type PlannedAction
} from './actions.js';
import {
    whatThisStepIsCalled,
    type PlanStep,
    type PlanWithSteps,
    type ToolCallRecordish
} from './a-sentence-can-be-more-than-one-call.js';

// ─────────────────────────────────────────────────────────────────────────
// THE RECORD
// ─────────────────────────────────────────────────────────────────────────

/**
 * Something the turn told the player was here, by name.
 */
export interface ThingNamed {
    /** The name as the engine printed it, which is the name it will accept back. */
    readonly name: string;
    /** Spirit stones asked, when the listing quoted one. */
    readonly stones?: number;
    /** Who is offering it, when the listing said. Shown in the prompt block only. */
    readonly from?: string;
}

/**
 * What the turn before this one did, and what it told the player.
 */
export interface WhatTheLastTurnDid {
    readonly runId: string;
    readonly cultivatorId: string;
    /** The turn it was recorded on. The next turn may refer to it; the one after cannot. */
    readonly onTurn: number;
    /** Whether anything executed at all. */
    readonly outcome: 'executed' | 'refused';
    /** The acts that ran, in the order they ran. Empty when the turn was refused. */
    readonly acts: readonly PlanStep[];
    /** Things the turn named to the player, in the order it named them. */
    readonly named: readonly ThingNamed[];
}

/**
 * The same list with one entry per thing, keeping the first time it was named.
 */
export function withoutSayingTheSameThingTwice(
    named: readonly ThingNamed[]
): ThingNamed[] {
    const seen = new Set<string>();
    const kept: ThingNamed[] = [];
    for (const thing of named) {
        const key = thing.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (key.length === 0 || seen.has(key)) continue;
        seen.add(key);
        kept.push(thing);
    }
    return kept;
}

/**
 * Whether a record still belongs to the cultivator and run in front of us, and is
 * still only one turn old.
 */
export function theLastTurnStillStands(
    record: WhatTheLastTurnDid | null,
    runId: string,
    cultivatorId: string,
    turn: number
): record is WhatTheLastTurnDid {
    return record !== null
        && record.runId === runId
        && record.cultivatorId === cultivatorId
        && record.onTurn === turn;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE READER IS TOLD
// ─────────────────────────────────────────────────────────────────────────

/** How many listed things go into the prompt. A board can hold dozens; a sentence refers to a few. */
export const MOST_NAMED_THINGS_RECALLED = 10;

/**
 * The previous turn, as its own labelled block for the phase-1 prompt.
 */
export function describeTheLastTurn(record: WhatTheLastTurnDid | null): string | null {
    if (record === null) return null;

    const did = record.acts.length === 0
        ? record.outcome === 'refused'
            ? 'Nothing. The turn was refused, so there is nothing to repeat.'
            : 'Nothing that ran.'
        : record.acts.map(describeOneAct).join('; ');

    const lines = [
        'THE TURN BEFORE THIS ONE (one turn only - there is no history behind it)',
        `  What they did: ${did}`
    ];

    if (record.named.length > 0) {
        lines.push('  What the game told them was here, by name:');
        for (const thing of record.named.slice(0, MOST_NAMED_THINGS_RECALLED)) {
            lines.push(
                `    ${thing.name}`
                + (thing.stones === undefined ? '' : ` - ${thing.stones} spirit stones`)
                + (thing.from === undefined ? '' : `, from ${thing.from}`)
            );
        }
    }

    lines.push(
        '  If the sentence below refers back to any of that - "keep at it", "again", "the',
        '  same", "carry on", "that one", "the cheaper one" - it means one of the things',
        '  above. Answer with the ordinary action and put the REAL name in "target"; never',
        '  leave a demonstrative there. If nothing above answers the reference, route what',
        '  you can and leave the rest alone rather than inventing a referent.'
    );
    return lines.join('\n');
}

function describeOneAct(step: PlanStep): string {
    const at = step.action.target ? ` (${step.action.target})` : '';
    const span = step.action.days ? `, for ${step.action.days} days` : '';
    return `${step.action.action}${at}${span}`;
}

// ─────────────────────────────────────────────────────────────────────────
// CARRYING ON WITH WHAT YOU WERE DOING
// ─────────────────────────────────────────────────────────────────────────

/**
 * The ways somebody says *carry on with what I was doing*.
 */
const CARRYING_ON = new RegExp(
    '^\\s*(?:i\\s+(?:just\\s+)?(?:will\\s+|shall\\s+|would\\s+like to\\s+|want to\\s+)?|just\\s+|let me\\s+)?'
    + '(?:'
    + 'keep (?:at|on with|going with|at it with) (?:it|that|this|the same|the same thing)'
    + '|keep (?:at it|going|on|it up|doing (?:it|that|the same))'
    + '|carry on(?: with (?:it|that|this|the same|the same thing))?'
    + '|continu(?:e|ing)(?: (?:with|on with|doing))? ?(?:it|that|this|the same|the same thing)?'
    + '|press on(?: with (?:it|that|this))?'
    + '|stick (?:with|at|to) (?:it|that|this)'
    + '|stay (?:at|with|on) (?:it|that|this)'
    + '|go on(?: with (?:it|that|this))?'
    + '|(?:get |go |head )?back to (?:it|that|the same|what i was doing)'
    + '|do (?:it|that|the same|the same thing|likewise|so) again'
    + '|do (?:it|that|the same|the same thing) (?:once more|one more time|another time)'
    + '|do the same(?: thing)?(?: again)?'
    + '|(?:the )?same again'
    + '|(?:once |one )?(?:more|again) of (?:the same|that|it)'
    + '|more of (?:the same|that|it)'
    + '|another (?:go|round|stretch|bout) (?:of|at) (?:it|that|the same)'
    + '|again'
    + '|as before'
    + '|the same as (?:before|last time)'
    + ')'
    // A span, a purpose, or nothing. Anything ELSE after the phrase means the
    // clause was about that other thing and this matched a fragment of it.
    + '(?:\\s+(?:for|over|another|a further|the next)\\b[^,;]*)?'
    + '\\s*[.!]*\\s*$',
    'i'
);

/**
 * Clauses of a sentence, cut where a person would cut one.
 */
export function theClausesOfATurn(input: string): string[] {
    return input
        .split(/[,;.!?]|\band then\b|\bthen\b|\band\b|\bbut\b|\bafter that\b|\bbefore that\b/i)
        .map(part => part.trim())
        .filter(part => part.length > 0);
}

/**
 * The clause of this sentence that says *carry on*, or null.
 *
 * Returned rather than a bare boolean so the turn can quote the player's own
 * words back to them when it says what it took the sentence to mean.
 */
export function theSentenceCarriesOn(input: string): string | null {
    for (const clause of theClausesOfATurn(input)) {
        if (CARRYING_ON.test(clause)) return clause;
    }
    return null;
}

/**
 * Which of the last turn's acts *it* means.
 */
export function theActToCarryOn(record: WhatTheLastTurnDid): PlanStep | null {
    const costly = record.acts.filter(step => !costsTheAskerNothing(step.action));
    const chosen = costly.length > 0 ? costly[costly.length - 1] : record.acts[record.acts.length - 1];
    return chosen ?? null;
}

/**
 * The act to run, with the span taken from THIS sentence.
 */
export function carryingOnFromTheLastTurn(
    record: WhatTheLastTurnDid,
    input: string
): PlanStep | null {
    const carried = theActToCarryOn(record);
    if (carried === null) return null;

    const said = parseDuration(input);
    const action: PlannedAction = said === null
        ? { ...carried.action }
        : { ...carried.action, days: said };

    return { action, said: carried.said };
}

/**
 * What the player reads when there is nothing to carry on with.
 */
export function nothingToCarryOnWith(record: WhatTheLastTurnDid | null): string {
    if (record === null) {
        return 'There is nothing to carry on with. Nothing is remembered past the turn just '
            + 'gone, and there is no turn just gone to remember - so say the thing itself and '
            + 'it will run. Nothing was spent finding that out.';
    }
    if (record.outcome === 'refused' || record.acts.length === 0) {
        return 'There is nothing to repeat. The turn before this one did not do anything - it '
            + 'was refused - so there is no act to carry on with. Say the thing itself and it '
            + 'will run. Nothing was spent finding that out.';
    }
    return 'There is nothing to carry on with. Say the thing itself and it will run, and '
        + 'nothing was spent finding that out.';
}

/** The same, for the engine channel. */
export function theRowForNothingToCarryOnWith(
    record: WhatTheLastTurnDid | null
): ToolCallRecordish {
    return {
        name: 'engine.carryingOn',
        action: 'unclear',
        summary: 'The sentence referred back to the turn before it and there is nothing there: '
            + (record === null
                ? 'no turn is remembered - the memory is one turn deep and is cleared with the run.'
                : `the turn on ${record.onTurn} ${record.outcome === 'refused' ? 'was refused' : 'ran nothing'}`
                  + ` and recorded ${record.acts.length} act(s).`)
            + ' No day passed and nothing was spent.',
        ok: false
    };
}

/** What the player reads when a back-reference was resolved into an act. */
export function sayingWhatWasCarriedOn(said: string, step: PlanStep): string {
    return `Carrying on with ${whatThisStepIsCalled(step)}. That is what "${said.trim()}" was `
        + 'taken to mean, off the turn before this one, and it costs exactly what saying it out '
        + 'in full would have cost. Name the act instead if it was something else.';
}

/** The same, as an inspector row. */
export function theRowForCarryingOn(said: string, step: PlanStep): ToolCallRecordish {
    return {
        name: 'engine.carryingOn',
        action: step.action.action,
        summary: `"${said.trim()}" was resolved against the turn before this one and became `
            + `${step.action.action}${step.action.target ? `(${step.action.target})` : '()'}`
            + `${step.action.days ? `, ${step.action.days} days` : ''}. No model read the line; `
            + 'the act is the one the player themselves ran last turn, and it is charged in full.',
        ok: true
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE THING YOU JUST TOLD ME ABOUT
// ─────────────────────────────────────────────────────────────────────────

/**
 * A phrase that points at something the last turn listed rather than naming it.
 */
const A_BARE_ONE = /^(?:the\s+)?(?:that|this|it|one|same|other)(?:\s+one)?$/i;

/** Comparatives. Cheaper is tested first so "less expensive" is not read as expensive. */
const THE_CHEAPER = /\b(?:cheap(?:er|est)|less expensive|least expensive|lower priced|lowest priced|more affordable)\b/i;
const THE_DEARER = /\b(?:dear(?:er|est)|most expensive|more expensive|expensive|pricier|priciest|costlier|costliest|higher priced|highest priced)\b/i;

const AN_ORDINAL: ReadonlyArray<[RegExp, number]> = [
    [/\b(?:the\s+)?(?:first|1st|former)\b/i, 0],
    [/\b(?:the\s+)?(?:second|2nd|latter)\b/i, 1],
    [/\b(?:the\s+)?(?:third|3rd)\b/i, 2]
];
const THE_LAST_ONE = /\b(?:the\s+)?(?:last|final)\s+one\b/i;

/**
 * Whether this field is a reference rather than a name.
 */
export function standsForSomethingNamedLastTurn(value: string | undefined): boolean {
    if (value === undefined) return false;
    const text = value.trim();
    if (text.length === 0) return false;
    if (A_BARE_ONE.test(text)) return true;
    if (THE_LAST_ONE.test(text)) return true;
    if (THE_CHEAPER.test(text) || THE_DEARER.test(text)) return true;
    return AN_ORDINAL.some(([pattern]) => pattern.test(text)) && /\bone\b/i.test(text);
}

/**
 * Which of the things the last turn named this phrase means, or null.
 */
export function whichOfTheNamedThings(
    phrase: string | undefined,
    input: string,
    named: readonly ThingNamed[]
): ThingNamed | null {
    if (named.length === 0) return null;

    const texts = [phrase ?? ''];
    if (phrase === undefined || A_BARE_ONE.test(phrase.trim())) texts.push(input);

    for (const text of texts) {
        if (text.trim().length === 0) continue;

        const priced = named.filter(thing => typeof thing.stones === 'number');
        if (priced.length >= 2) {
            if (THE_CHEAPER.test(text)) {
                return priced.reduce((a, b) => (b.stones! < a.stones! ? b : a));
            }
            if (THE_DEARER.test(text)) {
                return priced.reduce((a, b) => (b.stones! > a.stones! ? b : a));
            }
        }
        if (THE_LAST_ONE.test(text)) return named[named.length - 1]!;
        for (const [pattern, at] of AN_ORDINAL) {
            if (pattern.test(text) && /\bone\b/i.test(text) && named[at]) return named[at]!;
        }
        // A demonstrative with one thing to point at points at it. With two it
        // points at nothing, and saying so is better than choosing.
        if (A_BARE_ONE.test(text.trim()) && named.length === 1) return named[0]!;
    }
    return null;
}

/** One phrase that was resolved, for the inspector and for the player. */
export interface AReferenceResolved {
    readonly from: string;
    readonly to: string;
}

export interface ResolvedAgainstTheLastTurn {
    readonly plan: PlanWithSteps;
    readonly resolutions: readonly AReferenceResolved[];
}

/**
 * The same plan with any bare reference replaced by what the last turn named.
 */
export function resolvingAgainstTheLastTurn(
    plan: PlanWithSteps,
    record: WhatTheLastTurnDid,
    input: string
): ResolvedAgainstTheLastTurn {
    const resolutions: AReferenceResolved[] = [];

    const resolve = (action: PlannedAction): PlannedAction => {
        let changed: PlannedAction = action;
        for (const field of ['target', 'topic'] as const) {
            const value = changed[field];
            if (!standsForSomethingNamedLastTurn(value)) continue;
            const thing = whichOfTheNamedThings(value, input, record.named);
            if (thing === null) continue;
            resolutions.push({ from: value!, to: thing.name });
            changed = { ...changed, [field]: thing.name };
        }
        return changed;
    };

    const steps = plan.steps?.map(step => {
        const action = resolve(step.action);
        return action === step.action ? step : { ...step, action };
    });

    const action = resolve(plan.action);
    if (resolutions.length === 0) return { plan, resolutions };
    return {
        plan: { ...plan, action, ...(steps ? { steps } : {}) },
        resolutions
    };
}

/** What the player reads when a reference was resolved into a name. */
export function sayingWhatItWasTakenToMean(
    resolutions: readonly AReferenceResolved[]
): string {
    const said = resolutions
        .map(one => `"${one.from}" was taken to mean ${one.to}`)
        .join('; ');
    return `${said}, off what you were told a turn ago. Name it outright if it was something `
        + 'else.';
}

/** The same, as an inspector row. */
export function theRowForAResolvedReference(
    resolutions: readonly AReferenceResolved[],
    record: WhatTheLastTurnDid
): ToolCallRecordish {
    return {
        name: 'engine.lastTurn',
        action: 'reference',
        summary: resolutions.map(one => `"${one.from}" -> "${one.to}"`).join('; ')
            + `, resolved against the ${record.named.length} thing(s) the turn before this one `
            + 'named. The phrase is matched against a list the ENGINE printed, never against a '
            + 'catalog, and whether anything still matches the name is the resolver\'s answer '
            + 'rather than this one\'s.',
        ok: true
    };
}
