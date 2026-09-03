/**
 * One turn of memory, so a sentence may refer to the turn before it.
 *
 * ── THE DEFECT THIS EXISTS TO REMOVE ─────────────────────────────────────
 *
 * The reader sees one sentence and nothing else. Everything it knows comes
 * from the current input plus world state, so a sentence whose meaning lives in
 * the turn before has nothing to resolve against. Played, on this branch:
 *
 *     > I stay where I am and keep at it for ten years
 *     "The thought does not resolve."
 *
 *     > I keep cultivating for ten years          <- same turn, same intent
 *     Qi Condensation Layer 3 to Qi Condensation Layer 4.   [ran]
 *
 * The verb was never the problem. **"Keep at it" is what failed**, and it is
 * the plainest English there is for *carry on with what I was doing* - in a
 * game whose core loop is long stretches of the same act, it is the commonest
 * sentence a player will type. The other half of the same gap:
 *
 *     > The cheaper one leaves me something to eat with. I will take that one.
 *     "Not something anybody here sells."
 *
 * one turn after the game itself had said *"a copy of the Lesser Qi-Gathering
 * Manual sits there for eighteen spirit stones, and a Five-Breath Circulation
 * Scripture is listed at twenty-nine."* The player referred to one of them the
 * way a person would.
 *
 * ── ONE TURN BACK, AND IT IS A PARAMETER RATHER THAN A SESSION ───────────
 *
 * The design owner's shape, and it is why the bound is not a limitation to work
 * around but the design:
 *
 *   > "you could send this to the llm again, the previous turn's info? and
 *   >  clear the context between turns so it doesn't pollute"
 *
 * So the call stays stateless. Exactly one turn of it is composed fresh into
 * the phase-1 prompt by {@link describeTheLastTurn} and thrown away; nothing
 * accumulates, and there is no conversation history anywhere. A reader given
 * ten turns starts writing continuity - remembering intentions the player never
 * had, carrying forward a mood, inventing what happened in between - and this
 * architecture's whole defence is that the reader has no authority. One turn is
 * enough to resolve *keep at it* and *the cheaper one* and structurally cannot
 * become a narrative.
 *
 * ── INFORMATION, NEVER AUTHORITY ─────────────────────────────────────────
 *
 * Handing the reader what the last turn RULED does not touch the authority
 * line. The engine still rules, every step still goes through `validatePlan`,
 * and a resolved back-reference reaches phase 2 as an ordinary member of the
 * closed enum. What changes is only that the reader can see what "it" refers
 * to.
 *
 * ── AND IT WORKS WITH NO MODEL AT ALL ────────────────────────────────────
 *
 * The vocabulary is small and closed - *keep at it, carry on, again, the same,
 * that one, the cheaper one* - and it is resolved against ONE previous action
 * and ONE previous list. That is a lookup, not an inference, so the same record
 * that goes into the prompt is also read here with no model in the room. It
 * has to be: `docs` and `AGENTS.md` both hold that the deterministic tier is a
 * shipping mode, and a back-reference that only resolves when a good model is
 * attached is a feature the bottom three reading tiers do not have.
 *
 * ── REPEATING AN ACT IS NEVER A DISCOUNT ─────────────────────────────────
 *
 * A carried-on act is the SAME `PlannedAction` the player ran last turn, handed
 * to the same executor. "Keep at it for ten years" spends ten years exactly as
 * "I cultivate for ten years" does, because it becomes that. Nothing here
 * prices anything, and there is no path by which naming an act a second way
 * makes it cheaper.
 *
 * The danger check that stops a model escalating a turn is satisfied by
 * construction rather than by being asked again. Its invariant is *a player
 * must never meet a bigger bill for the same words*, and the continuation is
 * resolved BEFORE phase 1, with no model in the room - so "do it again" after
 * an attack is a second attack at every reading tier, produced from the
 * player's own previous turn rather than from anything a model said. If the
 * last turn was refused there is nothing to repeat, and
 * {@link nothingToCarryOnWith} says so plainly and spends nothing.
 *
 * ── AND THE READING IS SHOWN ─────────────────────────────────────────────
 *
 * `AGENTS.md`: where a reading is a judgement call, show it. Resolving a
 * back-reference is one, so the turn says what it resolved to - *carrying on
 * with sitting down to cultivate* - and a player who meant something else can
 * see it and say so.
 *
 * ── WHERE IT IS HELD ─────────────────────────────────────────────────────
 *
 * In memory on `GameService`, beside `crossroads`, `fight` and
 * `whichComesFirst`, and for the same reasons those three are: it is a fact
 * about a turn in flight rather than a fact about the world, it stands for
 * exactly one turn, and losing it costs the player nothing, because nothing was
 * spent recording it. A PERSISTED one would be worse than useless - it would
 * let somebody close the tab, come back, and refer to a turn from last week.
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
 *
 * Written by the branches that LIST things - the market board, the copyist's
 * stall - rather than recovered by reading prose back, because parsing the
 * narrator's output would make the narrator authoritative over what exists,
 * which is the one thing it may never be.
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
 *
 * `acts` is what actually RAN. A step the world refused is not in it, so a
 * refused turn leaves an empty list and there is nothing to carry on with -
 * which is the honest answer and is the one this file gives.
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
 *
 * ── ONE BOOK NAMED TWICE IS NOT TWO BOOKS ────────────────────────────────
 *
 * Measured on a real market board: the copyist's stall listed the Lesser
 * Qi-Gathering Manual at 8 and the Five-Breath Circulation Scripture at 13, and
 * somebody standing in the square was also holding a Five-Breath at 8. Three
 * lines, two books, and "the cheaper one" against the raw list picked the
 * Five-Breath - the DEARER of the two the player had just been shown - because
 * the same title appeared twice at two prices.
 *
 * The first mention wins because it is the one the player read first, and the
 * price kept with it is the one they were quoted. That price is a label rather
 * than an authority: it decides which NAME the phrase means, and what the
 * purchase actually costs is settled afterwards by the resolver, which looks
 * for the best route to the named thing exactly as it would for a typed name.
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
 * Whether a record still belongs to the cultivator and run in front of us, and
 * is still only one turn old.
 *
 * The same shape and the same reasoning as `theQuestionStillStands` and
 * `stillStands` next door, plus the one thing those two do not need: an age
 * check, and an EXACT one.
 *
 * `onTurn` is the run's turn counter as the recording turn left it, and a turn
 * about to be taken reads that same number - so the record is current exactly
 * when the two are equal. That is not a formality. The service has other doors
 * that take a turn without passing through `act` at all: the panel's Cultivate
 * button, the panel's Strike-the-barrier button. Each of them moves the counter
 * and none of them records anything, so an equality check lapses the memory
 * across them for free, where any tolerance at all would let "keep at it" carry
 * on from the turn BEFORE whatever the player had just done with a button.
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
 *
 * Short and factual on purpose: what verb ran, what it was pointed at, and what
 * the turn TOLD the player. Both kinds of back-reference need it - *what I just
 * did* comes off the first, *what you just told me* off the second - and
 * nothing else about the turn is any of the reader's business. In particular no
 * prose, no outcome figures and no narration: the reader is choosing what was
 * attempted, and a paragraph of last turn's results is an invitation to write
 * continuity out of it.
 *
 * Null when there is nothing to say, so the caller leaves the block out
 * entirely rather than sending a header with "nothing" under it - a model shown
 * an empty section reliably invents something to put in it.
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
 *
 * Matched against ONE CLAUSE rather than against the sentence, and the clause
 * has to be the whole of it, give or take a span. That is what keeps "I keep
 * going north" out: after "keep going" there is a destination, so the clause is
 * about going north and not about carrying on. "I stay where I am and keep at
 * it for ten years" cuts into two clauses and the second one is exactly this
 * phrase plus a span, which is the sentence this whole file was built for.
 *
 * Deliberately generous inside that frame, because `AGENTS.md` is explicit that
 * where a near-synonym works the phrasing that fails is a bug, and the failing
 * half is usually the more natural one.
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
 *
 * A local copy rather than the composition module's `theClausesOf`, and the
 * difference is the whole reason: that one drops any piece under two words,
 * because a one-word fragment cannot be an act with an object. Here a one-word
 * clause is the commonest case there is - "again" - and dropping it would lose
 * the sentence this exists to read. It also cuts on the full stop, because
 * *"The cheaper one leaves me something to eat with. I will take that one."* is
 * two sentences a player typed as one turn.
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
 *
 * The costly one, when there was one, and otherwise the last thing that ran.
 * That is not a preference - it is what the words mean. A turn that looked at a
 * board and then sat down for a year was a turn spent sitting down; "keep at
 * it" is about the year. Free reads are the frame around an act and never the
 * act, which is the same rule `A_SENTENCE_MAY_CONTAIN_A_PLAN` states for the
 * reader and `theClausesNoStepAccountsFor` measures for the executor.
 */
export function theActToCarryOn(record: WhatTheLastTurnDid): PlanStep | null {
    const costly = record.acts.filter(step => !costsTheAskerNothing(step.action));
    const chosen = costly.length > 0 ? costly[costly.length - 1] : record.acts[record.acts.length - 1];
    return chosen ?? null;
}

/**
 * The act to run, with the span taken from THIS sentence.
 *
 * "Keep at it for ten years" is ten years, not another one of whatever the last
 * stretch was. Where the sentence names no span the last one's is used, which
 * is what "again" means, and where neither says anything the verb's own default
 * applies downstream exactly as it would for a typed sentence.
 *
 * Nothing else is carried across. The target, the intent and the leverage are
 * the last act's because they are what "it" refers to; the duration is the one
 * thing the player has just said out loud, and taking the old one over it would
 * be the reader deciding how much of somebody's life to spend.
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
 *
 * A refusal that names a route, which is what a refusal owes anybody here. It
 * spends nothing: saying "there is nothing to repeat" is a free turn, and the
 * act the player wanted is still theirs the moment they name it.
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
 *
 * Closed and short, exactly like `A_PRONOUN_FOR_THE_LAST_THING` next door and
 * for the same reason: anything outside it is a name the resolvers already
 * handle, and widening it would start rewriting objects the player named
 * explicitly.
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
 *
 * Only ever true of a phrase that names nothing on its own. "the cheaper one"
 * is not an object in any catalog and never will be; "Lesser Qi-Gathering
 * Manual" is, and nothing here will touch it.
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
 *
 * ── THE SENTENCE IS CONSULTED, NOT ONLY THE FIELD ────────────────────────
 *
 * Measured on the sentence this exists for:
 *
 *   > The cheaper one leaves me something to eat with. I will take that one.
 *
 * The reference the reader hands over is "that one", and "that one" against two
 * listed manuals decides nothing. The thing that decides it is sitting in the
 * player's own sentence one clause earlier. So a bare demonstrative falls back
 * to the whole of what they typed - which is reading the player's words, the
 * same move `anyClauseReadsAsThisVerb` makes and safe for the same reason: the
 * model contributes nothing to it.
 *
 * ── AND IT NEVER GUESSES ─────────────────────────────────────────────────
 *
 * "That one" against two things with nothing to tell them apart returns null,
 * and null means the phrase goes to the resolver exactly as the player typed it
 * and is refused in the ordinary way. Picking one would be the reader deciding
 * which manual somebody bought.
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
 *
 * Only ever fills a field that is EXACTLY a reference - never one carrying a
 * name the player wrote - and only from a list the ENGINE printed last turn.
 * So this cannot invent an object, cannot override one, and cannot make a step
 * point at something nobody mentioned. It decides no outcome: the substituted
 * name goes to the same resolver the typed name would have gone to, and is
 * refused by it in the ordinary way if the thing has since gone.
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
