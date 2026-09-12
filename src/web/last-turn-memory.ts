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
    /**
     * What the turn answered with, and how it arrived there.
     *
     * The two fields "why" is answered out of, and the reason it could not be
     * answered before: the previous screen is gone by the time the next
     * sentence arrives, so this record is the only place either can live.
     * `account` is the structure channel, which is the engine's own one-line
     * report of every routine that ran - the same text the inspector shows.
     */
    readonly headline?: string;
    readonly account?: readonly string[];
    /**
     * How many the listing was a cut OF, where what was printed was a sample.
     *
     * Eight of forty-three on offer, four arts of a hundred and fifty-five.
     * {@link named} holds the sample because the sample is what the player
     * read; this holds the figure that makes "more" an honest answer rather
     * than a relist.
     */
    readonly namedOutOf?: number | null;
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
        "  RESOLVING A REFERENCE IS YOUR JOB AND NOT THE ENGINE'S. If the sentence below",
        '  points back at any of that - "it", "that one", "the second one", "the cheaper',
        '  one", "the intake", "the manual", "keep at it", "again", "the same", "carry on"',
        '  - work out WHICH of the things above it means and put that REAL name in',
        '  "target". Never leave a demonstrative or a category word there.',
        '',
        '  Two of them fit and you have to pick? Pick. You can see the sentence, the list',
        '  and the square, and you are the only reader here that can weigh them: a player',
        '  standing at a stall who says "the manual" means a manual on that stall, and one',
        '  who has just read a wall and says "the intake" means a house on that wall. The',
        '  engine cannot tell those apart and will not try - where you leave a reference',
        '  unresolved the field is DROPPED and the verb answers the general question, so',
        '  a guess you can defend is better than a blank every time.',
        '',
        '  If nothing above answers the reference at all, route what you can and leave the',
        '  rest alone rather than inventing a referent.'
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
// A QUESTION ABOUT THE ANSWER YOU JUST GAVE
// ─────────────────────────────────────────────────────────────────────────

/**
 * A follow-up that is about the previous ANSWER rather than about anything in
 * it.
 *
 * Every other back-reference in this file points at an item in a listing, and
 * the resolver has read those all along. These two do not resolve because they
 * have no referent to resolve to: "why" asks the engine to account for what it
 * said, and "more" asks for the rest of what it showed. Both were measured as
 * the blank look on every turn of a 3472-turn probe, with and without a listing
 * behind them.
 */
export type AFollowUpAboutTheAnswer = 'more' | 'why';

/**
 * The whole sentence and nothing else, which is the same guard
 * {@link theSentenceIsNothingButAPointer} keeps and for the same reason.
 *
 * "more rations" is a quantity, "I ask why she left" is a question put to a
 * person, and "more of the same" already means carry on with the act - an older
 * reading, and the right one. A follow-up about the answer is a whole turn
 * spent asking about the turn before it.
 */
const ASKING_FOR_THE_REST = new RegExp(
    '^(?:'
    + '(?:tell me |show me |give me |i want |let me (?:see|have) )?more(?: of (?:them|those|it all))?'
    + '|(?:is there |are there |any(?:thing)? )?(?:any )?more(?: of (?:them|those))?'
    + '|what else(?: is there)?'
    + '|anything else'
    + '|(?:and |show me |what about )?the rest(?: of (?:it|them|those))?'
    + ')(?:\\s+please)?$',
    'i'
);

const ASKING_WHY = new RegExp(
    '^(?:'
    + 'why(?:\\s+(?:not|though|is that|was that|is it|so|then))?'
    + '|how come'
    + '|(?:for|on) what (?:reason|grounds)'
    + '|says? who'
    + ')$',
    'i'
);

/** Which of the two this sentence is, or null. */
export function theSentenceAsksAboutTheLastAnswer(
    input: string
): AFollowUpAboutTheAnswer | null {
    const said = input.trim().replace(/[.!?]+$/, '').trim();
    if (said.length === 0) return null;
    if (ASKING_WHY.test(said)) return 'why';
    if (ASKING_FOR_THE_REST.test(said)) return 'more';
    return null;
}

/** The four channels an answer to a follow-up is put back on. */
export interface AnAnswerAboutTheAnswer {
    headline: string;
    prose: string;
    lines: string[];
    structure: string;
}

/** How much of the engine's own account of a turn goes back to the player. */
export const MOST_ACCOUNT_LINES_PUT_BACK = 8;

/**
 * "Why", answered out of what the engine did rather than out of a reading of it.
 *
 * The structure channel is the engine's report of every routine that ran, and
 * it is the only honest answer to this question: anything else would be the
 * engine reasoning in prose about a refusal nothing computed, which is a
 * narrator settling an outcome. Where the account is empty the answer says so
 * rather than filling it.
 */
export function askingWhyThatAnswer(
    record: WhatTheLastTurnDid | null
): AnAnswerAboutTheAnswer {
    if (record === null) {
        return {
            headline: 'There is no answer behind this one.',
            prose: 'Nothing is remembered past the turn just gone, and there is no turn just '
                + 'gone to account for. Say the thing itself and it will run. Nothing was spent '
                + 'finding that out.',
            lines: [],
            structure: 'why: no turn is remembered - the memory is one turn deep and is cleared '
                + 'with the run. No day passed and nothing was spent.'
        };
    }
    const account = (record.account ?? []).slice(0, MOST_ACCOUNT_LINES_PUT_BACK);
    const said = record.headline?.trim();
    const answered = said ? `The turn before this one answered: ${said}` : 'The turn before this one.';
    if (account.length === 0) {
        return {
            headline: 'That is all there is to it.',
            prose: `${answered} There is nothing behind it that is not in it - the engine kept no `
                + 'account of that turn beyond what it printed. Nothing was spent finding that out.',
            lines: [],
            structure: `why: the turn on ${record.onTurn} ${record.outcome === 'refused' ? 'was refused' : 'ran'} `
                + 'and filed no structure lines. No day passed and nothing was spent.'
        };
    }
    return {
        headline: 'Why that answer.',
        prose: `${answered} What the engine did to arrive at it is below, and that is the whole `
            + 'of it. Nothing was spent finding that out.',
        lines: account,
        structure: `why: the turn on ${record.onTurn} ${record.outcome === 'refused' ? 'was refused' : 'ran'} `
            + `${record.acts.length} act(s) and filed ${record.account?.length ?? 0} account line(s), `
            + `of which ${account.length} are put back. No day passed and nothing was spent.`
    };
}

/**
 * "More", answered honestly in the three situations it arrives in.
 *
 * The memory holds what was NAMED, which is what was printed - so where a
 * listing was whole, the whole of it goes back, and where it was a cut the
 * engine says how big a cut and what gets a different one. What it never does
 * is produce the rows it did not print: it does not hold them, and a listing
 * conjured here would be a second answer to what is on a board.
 */
export function askingForTheRestOfIt(
    record: WhatTheLastTurnDid | null
): AnAnswerAboutTheAnswer {
    if (record === null) {
        return {
            headline: 'There is nothing to have more of.',
            prose: 'Nothing is remembered past the turn just gone, and there is no turn just '
                + 'gone. Say what you want to see and it will run. Nothing was spent finding '
                + 'that out.',
            lines: [],
            structure: 'more: no turn is remembered - the memory is one turn deep and is cleared '
                + 'with the run. No day passed and nothing was spent.'
        };
    }
    const named = record.named;
    if (named.length === 0) {
        return {
            headline: 'There is no more of it.',
            prose: 'The turn before this one did not put a list in front of you, so there is '
                + 'nothing more of it to give. Say the thing itself and it will run. Nothing was '
                + 'spent finding that out.',
            lines: [],
            structure: `more: the turn on ${record.onTurn} named 0 things. No day passed and `
                + 'nothing was spent.'
        };
    }
    const lines = named.map((thing, at) =>
        `${at + 1}. ${thing.name}`
        + (thing.stones === undefined ? '' : ` - ${thing.stones} spirit stones`)
        + (thing.from === undefined ? '' : `, from ${thing.from}`));
    const outOf = record.namedOutOf ?? null;
    const wasACut = outOf !== null && outOf > named.length;
    return {
        headline: wasACut ? `${named.length} of ${outOf}.` : 'That is all of it.',
        prose: wasACut
            ? `You were shown ${named.length} of ${outOf}. The engine holds the ${named.length} it `
              + 'put in front of you and not the rest of the board: naming a kind of thing is '
              + 'what gets a different cut of it. Nothing was spent finding that out.'
            : `The turn before this one named ${named.length}, and that is all of them. The `
              + 'memory is one turn deep and holds what was named, not the board behind it. '
              + 'Nothing was spent finding that out.',
        lines,
        structure: `more: the turn on ${record.onTurn} named ${named.length} thing(s)`
            + (outOf === null ? '' : ` out of ${outOf}`)
            + '. Put back in the order they were named, so an ordinal counts against the same '
            + 'list twice. No day passed and nothing was spent.'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE THING YOU JUST TOLD ME ABOUT
// ─────────────────────────────────────────────────────────────────────────

/**
 * A phrase that points at something the last turn listed rather than naming it.
 */
const A_BARE_ONE = /^(?:the\s+)?(?:that|this|it|one|same|other)(?:\s+one)?$/i;

/**
 * A thing named by what it IS, where the last turn printed only one of them.
 *
 * FOUND BY PLAYING BLIND. Two recruiting notices were read off a wall, one of
 * them holding its intake the next day. `i present myself at the intake` came
 * back with the generic listing of every house that would take somebody of this
 * standing, and *none of this has happened* - because `the intake` is not a
 * demonstrative and nothing recognised it as pointing at anything.
 *
 * These are not pronouns. They are the CATEGORY a listing was about, used the
 * way anybody uses it once the thing has been named: the game says two houses
 * are holding intakes and the player says *the intake*. Resolved exactly the
 * way `it` is, which means the ambiguity rule applies unchanged - two notices
 * on the wall and the phrase points at nothing, and the turn says so.
 *
 * ── AND IT IS THE PAPER WORDS AND NOTHING ELSE ───────────────────────────
 *
 * The first cut was wider. It held `manual`, `book`, `job`, `work` and `offer`
 * too, and that broke on the next turn of the next session: `i buy a manual`,
 * one turn after a WALL read, came back with *"manual" could be Cold Sword Sect
 * or Hollow Bell Wanderers*.
 *
 * `ThingNamed` carries a name and a price and no KIND, so the resolver cannot
 * tell a house from a book and matched the word against whatever the last turn
 * happened to print. The paper words are safe because exactly one read produces
 * them - the bills - so the listing a paper word points into is the only
 * listing that kind can come from. Widening this list again wants a kind on the
 * row, not more nouns here.
 */
const A_THING_BY_ITS_KIND =
    /^(?:the\s+|that\s+|this\s+)?(?:intake|intakes|notice|notices|bill|bills|poster|posters|posting|postings)$/i;

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
    if (A_THING_BY_ITS_KIND.test(text)) return true;
    if (THE_LAST_ONE.test(text)) return true;
    if (THE_CHEAPER.test(text) || THE_DEARER.test(text)) return true;
    return AN_ORDINAL.some(([pattern]) => pattern.test(text)) && /\bone\b/i.test(text);
}

/**
 * The frames a pointer arrives wrapped in when somebody is choosing off a list.
 *
 * Stripped in order, outermost first, so "I'll have the cheaper one" comes down
 * to the three words that do the pointing.
 */
const A_POINTER_IS_WRAPPED_IN: readonly RegExp[] = [
    /^(?:i(?:'ll|'d)?|let me|give me|hand me|just)\s+/i,
    /^(?:will|would|shall|want to|would like to)\s+/i,
    /^(?:take|takes|have|has|want|wants|pick|picks|choose|chooses|go with|buy|buys|read|reads|do|does|try|tries|use|uses|study|studies|learn|learns)\s+/i
];

/**
 * The pointer a sentence is made of, when it is made of nothing else.
 *
 * {@link standsForSomethingNamedLastTurn} answers this about a FIELD of a plan,
 * and that is the half that was built: a plan whose `target` is "the second
 * one" has the reference substituted before any verb sees it. A sentence that
 * is ONLY a pointer never reaches a verb, so it never acquires a field, so the
 * substitution had nothing to substitute into - and 60 turns of a 744-turn
 * replay came back as a blank look at a listing the game itself had printed one
 * turn earlier.
 *
 * The WHOLE sentence is the guard. A pointer inside a sentence that also says
 * what to do with it - "I buy the second manual" - is an ordinary sentence and
 * stays with the field-level resolver, which has always handled it.
 */
export function theSentenceIsNothingButAPointer(input: string): string | null {
    let pointer = input.trim().replace(/[.!?]+$/, '').trim();
    if (pointer.length === 0) return null;
    for (const frame of A_POINTER_IS_WRAPPED_IN) pointer = pointer.replace(frame, '').trim();
    if (pointer.length === 0) return null;
    return standsForSomethingNamedLastTurn(pointer) ? pointer : null;
}

/**
 * The one thing at the extreme price, or null where two share it.
 *
 * See the note at the call site: a comparative that ties is a phrase with no
 * answer, and answering it anyway is how a player buys the wrong book.
 */
function theOnlyOneAt(
    priced: readonly ThingNamed[],
    extreme: (...values: number[]) => number
): ThingNamed | null {
    const at = extreme(...priced.map(thing => thing.stones!));
    const there = priced.filter(thing => thing.stones === at);
    return there.length === 1 ? there[0]! : null;
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
    if (phrase === undefined
        || A_BARE_ONE.test(phrase.trim())
        || A_THING_BY_ITS_KIND.test(phrase.trim())) {
        texts.push(input);
    }

    for (const text of texts) {
        if (text.trim().length === 0) continue;

        const priced = named.filter(thing => typeof thing.stones === 'number');
        if (priced.length >= 2) {
            // A TIE POINTS AT NOTHING, which is the demonstrative rule below
            // applied to a comparative.
            //
            // FOUND BY PLAYING BLIND. A stall listed the Lesser Qi-Gathering
            // Manual at 8 and the Five-Breath Circulation Scripture at 13, and
            // a man beside it offered his own copy of the Five-Breath at 8.
            // `i buy the cheaper one` handed over the Five-Breath: `reduce`
            // keeps whichever of two equal prices it met first, so the phrase
            // settled on an ordering nobody had said anything about, and the
            // player walked away with a book they cannot open for five more
            // rungs instead of the one they can open today.
            //
            // "The cheaper one" of two things that cost the same is not a
            // phrase with an answer, and picking one is the failure this file
            // already refuses for `it`.
            if (THE_CHEAPER.test(text)) return theOnlyOneAt(priced, Math.min);
            if (THE_DEARER.test(text)) return theOnlyOneAt(priced, Math.max);
        }
        if (THE_LAST_ONE.test(text)) return named[named.length - 1]!;
        for (const [pattern, at] of AN_ORDINAL) {
            if (pattern.test(text) && /\bone\b/i.test(text) && named[at]) return named[at]!;
        }
        // A demonstrative with one thing to point at points at it. With two it
        // points at nothing, and saying so is better than choosing.
        if ((A_BARE_ONE.test(text.trim()) || A_THING_BY_ITS_KIND.test(text.trim()))
            && named.length === 1) {
            return named[0]!;
        }
    }
    return null;
}

/**
 * What is put back when a pointer could not be turned into an act.
 *
 * Three states and they are different events, which is the distinction
 * `taught-what-is-a-question-and-not-a-refusal.test.ts` drew for a request and
 * is drawn again here:
 *
 *   nothing was listed  there is no answer to give. Names the route.
 *   it settled          the pointer HAS a referent and what is missing is what
 *                       to do with it. Saying which one it was and asking what
 *                       about it is what a game master does; asking "which of
 *                       them" over a pointer that settled is the engine
 *                       contradicting itself on one screen.
 *   it did not settle   the listing goes back in the order it was PRINTED,
 *                       because that is the order {@link whichOfTheNamedThings}
 *                       counts an ordinal against - so "the second one" in
 *                       answer to this question lands on the second line of it.
 */
/**
 * A pointer with no turn behind it at all, which is not the same news.
 *
 * The branch below for a record that named nothing has existed since this file
 * was written and was gated on there BEING a record - so the case a player
 * actually meets, saying "the second one" on the first turn of a run or two
 * turns after the listing, fell past it to the blank look. Measured: all eight
 * of the pointer sentences on the refusal probe came back *"it does not resolve
 * into anything you could actually do standing here"* with nothing behind them,
 * and all eight resolve with a listing one turn back.
 *
 * Worded apart from that branch on purpose. *The turn before this one listed
 * nothing* and *there is no turn before this one* are different facts, and a
 * player who has just watched their listing lapse is owed the second one.
 */
export function nothingBehindThisPointer(pointer: string): AnAnswerAboutTheAnswer {
    return {
        headline: 'That points at nothing.',
        prose: `"${pointer}" points back at the turn before this one, and there is no turn `
            + 'before this one - nothing is remembered past the turn just gone. Name the thing '
            + 'itself and it will run. Nothing was spent finding that out.',
        lines: [],
        structure: `"${pointer}" read as a pointer and no turn is remembered: the memory is one `
            + 'turn deep and is cleared with the run. No day passed and nothing was spent.'
    };
}

export function askingWhichOfWhatWasNamed(
    record: WhatTheLastTurnDid,
    pointer: string,
    settledOn: ThingNamed | null
): { headline: string; prose: string; lines: string[]; structure: string } {
    const named = record.named.slice(0, MOST_NAMED_THINGS_RECALLED);
    if (named.length === 0) {
        return {
            headline: 'That points at nothing.',
            prose: `"${pointer}" points back at the turn before this one, and the turn before `
                + 'this one listed nothing to point at. Name the thing itself and it will run. '
                + 'Nothing was spent finding that out.',
            lines: [],
            structure: `"${pointer}" read as a pointer at the turn before this one, which named `
                + '0 things. No day passed and nothing was spent.'
        };
    }
    if (settledOn !== null) {
        return {
            headline: `${settledOn.name}, then.`,
            prose: `"${pointer}" is ${settledOn.name}. What you would do about it is the half `
                + 'the sentence did not carry, and saying it is the whole of what is left. '
                + 'Nothing was spent finding that out.',
            lines: [settledOn.name
                + (settledOn.stones === undefined ? '' : ` - ${settledOn.stones} spirit stones`)],
            structure: `"${pointer}" settled on ${settledOn.name} off the listing the turn before `
                + 'this one printed. The act was not carried over: the turn before this one '
                + 'named no target and is not a free read, so re-running it at a name would be '
                + 'choosing an act nobody typed. No day passed and nothing was spent.'
        };
    }
    return {
        headline: 'Which of them.',
        prose: `"${pointer}" could be any of ${named.length}. They are in the order they were `
            + 'said, so an ordinal answers this. Nothing was spent finding that out.',
        lines: named.map((thing, at) =>
            `${at + 1}. ${thing.name}`
            + (thing.stones === undefined ? '' : ` - ${thing.stones} spirit stones`)
            + (thing.from === undefined ? '' : `, from ${thing.from}`)),
        structure: `"${pointer}" read as a pointer and settled on none of the ${named.length} `
            + 'things the turn before this one named. Printed in that order so the next sentence '
            + 'can count against it. No day passed and nothing was spent.'
    };
}

/** One phrase that was resolved, for the inspector and for the player. */
export interface AReferenceResolved {
    readonly from: string;
    readonly to: string;
}

export interface ResolvedAgainstTheLastTurn {
    readonly plan: PlanWithSteps;
    readonly resolutions: readonly AReferenceResolved[];
    /**
     * Phrases that ARE references and could not be settled.
     *
     * FOUND BY PLAYING BLIND. A stall had just listed two manuals by name and
     * price. The player typed `i study it`, and the answer was:
     *
     *     You search the streets and alleys of Six Li, looking for a trace of
     *     it... Nothing here answers to the thing you seek. It is either in
     *     another place entirely, or it does not exist.
     *
     * The engine had just printed both books. It went looking for a PLACE
     * called "it" and then told the player the thing did not exist.
     *
     * `whichOfTheNamedThings` was right to decline: *a demonstrative with one
     * thing to point at points at it. With two it points at nothing, and saying
     * so is better than choosing.* What was missing is the saying so. The
     * resolver knew the phrase was a reference, knew it could not settle it,
     * and dropped both facts on the floor - so the verb ran on the literal word
     * and answered confidently about nothing.
     */
    readonly unsettled: readonly string[];
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
    const unsettled: string[] = [];

    const resolve = (action: PlannedAction): PlannedAction => {
        let changed: PlannedAction = action;
        for (const field of ['target', 'topic'] as const) {
            const value = changed[field];
            if (!standsForSomethingNamedLastTurn(value)) continue;
            const thing = whichOfTheNamedThings(value, input, record.named);
            if (thing === null) {
                // ── AND THE FIELD COMES OFF ──────────────────────────────
                //
                // A reference nobody could settle used to reach the verb as
                // the LITERAL WORD, and every verb then answered about a thing
                // by that name: "I study it" searched the town for a place
                // called `it` and reported that it did not exist.
                //
                // Dropping it is not losing anything. The field was never a
                // name - `standsForSomethingNamedLastTurn` has already said it
                // is a reference - so what reaches the verb is a sentence that
                // named nothing, which every verb here already answers well:
                // the listing, the board, the whole square. A phrase nobody
                // could bind is closer to silence than it is to a name.
                //
                // `asking-about-a-named-thing.test.ts` had already ruled this
                // for one sentence shape, at the parse layer: *points at the
                // paper rather than at a name, so the admissible listing
                // answers rather than a refusal about a house that does not
                // exist.* This is the same ruling, moved to where it can also
                // let the reference RESOLVE when there is something to resolve
                // it against.
                //
                // And the player is told, by the line `unsettled` carries.
                if (record.named.length > 1 && !unsettled.includes(value!)) unsettled.push(value!);
                changed = { ...changed };
                delete changed[field];
                continue;
            }
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
    // A DROP IS A CHANGE TOO. This used to return the untouched plan whenever
    // nothing RESOLVED, which would put the literal reference straight back.
    if (resolutions.length === 0 && action === plan.action) {
        return { plan, resolutions, unsettled };
    }
    return {
        plan: { ...plan, action, ...(steps ? { steps } : {}) },
        resolutions,
        unsettled
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
