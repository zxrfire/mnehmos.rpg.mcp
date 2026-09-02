/**
 * Forcing an attempt to land - what ADMIN reaches inside an ordinary verb.
 *
 * ══ THE RULE, AND IT IS ONE LINE ══════════════════════════════════════════
 *
 *   FORCING DECIDES AN UNCERTAIN OUTCOME. IT DOES NOT MAKE AN ILLEGAL ACTION
 *   LEGAL.
 *
 * The design owner, on the case this was built for: a Qi Condensation
 * cultivator stealing from a Nascent Soul is a legal attempt with a terrible
 * chance, and forcing it makes the unlikely branch the one that happens -
 * *"if it works you can then see what happens next"*. That last clause is the
 * whole purpose. The feature is not the theft. It is that the reprisal, the
 * standing and the rumour systems then have to answer a state ordinary play
 * would take thousands of runs to reach, and those are the systems least
 * tested and likeliest to be wrong.
 *
 * The same sentence rules out the other half, and the owner ruled it out by
 * name: *"admin cannot promote you from no qi to qi using breakthrough (it can
 * set realms directly though)"*. Somebody with an empty accumulator cannot
 * cross, and `ADMIN breakthrough` must not hand them a rung.
 *
 * ── WHY A GATE STAYS A GATE ──────────────────────────────────────────────
 *
 * Two reasons, and both are load-bearing.
 *
 * FIRST, admin can already do it properly. `set_realm` places somebody on the
 * ladder through `advanceRealm`; `grant_progress` fills the accumulator the
 * engine reads; `grant_item`, `grant_knowledge` and `set_location` arrange the
 * other common preconditions. A verb forced past a precondition would be a
 * SECOND way to do a thing this surface already does, and two ways to do one
 * thing is how the forced path and the real path drift until admin stops
 * testing anything.
 *
 * SECOND, and worse: a state reached by removing a precondition is a state the
 * world cannot produce. An operator looking at it is looking at a lie, which is
 * the exact opposite of what admin exists for. `docs/admin.md` states it for
 * the surface as a whole - "admin must never simulate a law to make a
 * demonstration work" - and this is that rule pointed at a verb.
 *
 * So the split is not per verb, and there is no table of forty-six. It is per
 * FAILURE, and every refusal in this game is already one of two things:
 *
 *   A GATE    a precondition. Nothing was decided; the world refused before any
 *             uncertainty arose. Force leaves it standing and names the action
 *             that arranges it - see `THE_ACTION_THAT_ARRANGES_IT`.
 *   A ROLL    an uncertain outcome the engine sampled. Force lands it.
 *
 * Where a verb can fail both ways - and `sect` is the worked example, with an
 * admission bar in front of a house's own judgement - force reaches the roll
 * and leaves the bar exactly where it was.
 *
 * ── WHAT FORCING NEVER SKIPS ─────────────────────────────────────────────
 *
 * The bill. Force decides the ANSWER; the verb's own code writes the PRICE, and
 * it writes it because the verb is the same verb - there is no second
 * implementation here and there must never be one.
 *
 * So a forced crossing still spends the accumulator, still takes the Price of
 * Advancement, still risks the deviation. A forced approach still spends its
 * days and its stones, still writes the tie, the obligation and whatever the
 * other party now holds. A forced admission still writes the membership row at
 * the rung the house would have taken them at.
 *
 * AND THERE IS DELIBERATELY NO ARGUMENT THAT MAKES IT FREE. Not charging is not
 * something this layer can do without re-implementing the verb, which is the
 * one thing forbidden above; an operator who wants a success to be affordable
 * arranges affordability first, with the actions admin already has. That is
 * `AGENTS.md` on softening, arriving from the other side: *"the player thinks
 * they made a choice and the world silently declined to charge them for it."*
 *
 * ── AND IT IS ALWAYS MARKED ──────────────────────────────────────────────
 *
 * Every forced call is written to the admin audit trail, and those rows ARE the
 * admin flag - `run_manage.ledger` reads them to keep such a run out of the
 * death ledger and out of balance data. A run whose history contains an
 * arranged success is not the same evidence as one that earned it, and a played
 * test that cannot tell the two apart is testing nothing.
 *
 * ── THE DRAW IS STILL TAKEN ──────────────────────────────────────────────
 *
 * Every site below draws from its seeded stream and THEN asks whether the
 * attempt was forced. Skipping the draw would shift every later draw off that
 * stream, which `AGENTS.md` calls a regression until proved otherwise - so a
 * forced turn and an unforced one leave the RNG in the same place.
 *
 * ── WHY THIS IS A CONTEXT AND NOT AN ARGUMENT ────────────────────────────
 *
 * It could have been a field on the request. It is not, because a field on a
 * request is a field a MODEL can set, and a model is now in this path: an admin
 * line goes the same way as any other sentence, through whichever tier is
 * configured. That is deliberate and is itself a test - see `docs/admin.md` -
 * and it is precisely why the forcing switch must not be an argument. A model
 * may read the line and phrase the answer; it may never decide the outcome, and
 * an outcome-forcing boolean reachable from a tool call is exactly the
 * affordance the header of `admin-manage.ts` says must never exist.
 *
 * Nothing can enter this context except `withTheAttemptLanding`, which is
 * called in one place, behind `ADMIN_MODE`, on a verb the operator named.
 *
 * The pure engine layer does NOT read this. `AGENTS.md` requires engine
 * functions to be state-in, deltas-out, and a hidden ambient input is the
 * opposite of that - it would also make a pure function's answer depend on
 * something its seed does not carry. So a pure resolver takes an explicit
 * `theAttemptLands` input and its impure CALLER reads the context and fills it.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

// ═══════════════════════════════════════════════════════════════════════════
// THE DECISIONS FORCE REACHES
//
// A closed table, keyed on the decision's own name. Not on the verb: several
// verbs share one resolver, one verb reaches several resolvers, and the thing
// being forced is the QUESTION the engine asked rather than the sentence the
// operator typed. Same discipline as `PRIMARY_ARG` and `BARE_NUMBER_ARG` in
// `admin-manage.ts` - a lookup, never an inference.
//
// An entry here is a promise that the site really consults `theRollLands`. A
// name in this table with no consumer would be the defect `AGENTS.md` calls a
// module nothing calls, one size smaller: force would report that it reached
// something and the roll would have gone its own way.
// ═══════════════════════════════════════════════════════════════════════════

export interface ForceableDecision {
    /** What the engine was uncertain about. */
    readonly decides: string;
    /** What this decision landing means, in the world. */
    readonly landing: string;
    /** Where the draw is taken, so the promise above can be checked. */
    readonly where: string;
    /** The verbs whose ordinary play can reach it. */
    readonly reachedBy: readonly string[];
}

export const FORCEABLE_DECISIONS: Readonly<Record<string, ForceableDecision>> = Object.freeze({
    /**
     * The owner's own example, and the reason this exists: a Qi Condensation
     * cultivator taking something off a Nascent Soul. Legal, priced at
     * something close to nothing, and interesting only when it comes off.
     */
    an_approach_to_somebody: {
        decides: 'whether the person in front of you moved',
        landing: 'they did the thing that was asked, at whatever it costs them and you',
        where: 'resolveAttempt in engine/social-leverage/an-attempt-to-move-somebody.ts',
        reachedBy: ['interact', 'request', 'propose', 'decline']
    },
    /**
     * A house looking at a stranger who cleared its bar. The bar itself is a
     * GATE and is not touched: somebody below `admissionOrdinal` still gets the
     * bar back, and `set_realm` is the action for that.
     */
    a_house_looking_at_an_applicant: {
        decides: 'whether a house took somebody who walked up',
        landing: 'they are taken on, at the rung the house would have started them at',
        where: 'handleJoin in server/consolidated/sect-manage.ts',
        reachedBy: ['sect']
    },
    /**
     * The crossing itself, once it is legal to attempt. Eligibility is a GATE -
     * `canAttemptBreakthrough` - and stays one.
     */
    a_crossing: {
        decides: 'whether the barrier gave',
        landing: 'the crossing succeeds, and still pays the Price of Advancement',
        where: 'attemptBreakthrough in engine/cultivation/breakthrough.ts',
        reachedBy: ['breakthrough']
    }
});

export type ForceableDecisionName = keyof typeof FORCEABLE_DECISIONS;

// ═══════════════════════════════════════════════════════════════════════════
// WHEN A FORCED VERB REFUSES ANYWAY
//
// Nothing was decided: the world stopped before any uncertainty arose. Saying
// only "it refused" would leave the operator unable to tell a precondition from
// a coin toss, and which of the two they are looking at is a real fact about
// the design.
//
// ── AND THERE ARE TWO KINDS OF REFUSAL, NOT ONE ──────────────────────────
//
//   A GATE       a bar this person does not clear. It has a ROUTE: get to the
//                rung, be old enough, leave the house you are in first. The
//                refusal names every route it can.
//   AN INVARIANT a shape the world cannot hold at all. There is no route, and
//                the honest answer says so flatly. Inventing a helpful-sounding
//                alternative would be worse than a plain no, because the
//                operator would go and try it.
//
// Both are refusals and only one has directions after it. They are separate
// tables so that a reader can tell them apart in the code as well as in the
// prose - somebody who cannot will eventually add a way round the second.
//
// ── AND NEITHER TABLE IS A LIST OF WHAT IS IMPOSSIBLE ────────────────────
//
// This is the part worth being careful about. ADMIN keeps NO register of
// impossible states, and must not grow one: "one house has one patriarch" is a
// fact about how a roster is built rather than a constant somebody declared,
// and a hand-kept list of such facts is a list that goes stale - this file's
// own surface has had two confident sentences outlive the behaviour they
// described. What actually enforces an invariant is the ordinary write path,
// which refuses because it cannot express the thing; admin inherits that for
// free and stays correct as the write paths change.
//
// So both tables below are about SAYING SOMETHING USEFUL after a refusal that
// has already happened. Neither one performs a check, and a refusal in neither
// still gets an honest answer - see `whatWouldArrangeIt`.
//
// ── AND "IMPOSSIBLE" IS NOT "UNUSUAL" ────────────────────────────────────
//
// The line is possible against impossible, never typical against atypical. Two
// patriarchs is impossible. A patriarch who practises none of their house's
// arts is merely unheard of, and standing one up to see what the house does
// about it is exactly what this surface is for. If a check cannot say which of
// the two it is enforcing, it is the wrong check.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Refusals that are BARS, and the admin lines that clear each one.
 *
 * Keyed on the refusal's own identity - the engine call that filed it, or the
 * guiding-error code it filed - because that is a property of the refusal, not
 * a reading of its prose. Several lines where a bar has several conditions: an
 * operator handed all of them does the thing in two calls, and one handed the
 * first goes and reads a catalog.
 */
export const THE_ACTIONS_THAT_ARRANGE_IT: Readonly<Record<string, readonly string[]>> = Object.freeze({
    'engine.canAttemptBreakthrough': [
        'ADMIN grant_progress fill=true - fills the accumulator the engine already reads, which ' +
        'is what makes the attempt legal. Then the crossing can be forced.',
        'ADMIN set_realm ordinal=<rung> - if what is wanted is somebody STANDING at a rung ' +
        'rather than crossing to it, this is the action, and it claims no crossing.'
    ],
    below_admission_ordinal: [
        'ADMIN set_realm ordinal=<the bar named above> - the house admits from there, and the ' +
        'bar is the house\'s, not this surface\'s.'
    ],
    'engine.resolveSect': [
        'ADMIN grant_knowledge kind=sect - makes every house nameable. Knowing a name is not an ' +
        'introduction, and admission is still the house\'s own answer.'
    ],
    'engine.resolvePlace': [
        'ADMIN grant_knowledge kind=place - makes every place nameable.',
        'ADMIN set_location location=<name> - stands the cultivator there, with no road in between.'
    ],
    'engine.resolveParty': [
        'ADMIN spawn_encounter ordinal=<rung> - stands a real person in front of the cultivator, ' +
        'named, addressable and attackable.'
    ],
    'engine.resolveEntity': [
        'ADMIN spawn_site or ADMIN grant_knowledge - makes a thing nameable. ADMIN reveals what ' +
        'exists; it does not author.'
    ],
    'engine.evaluateLidTransit': [
        'ADMIN set_realm ordinal=46 - puts somebody above the Lid. Coming back down is the verb.'
    ],
    'storage.listPouch': [
        'ADMIN grant_item - puts a real catalog pill, herb or rated artifact into the real pouch.'
    ],
    'engine.localPrice': [
        'ADMIN set_location location=<somewhere that sells it>, or ADMIN grant_item for the ' +
        'thing itself.'
    ],
    'sect_manage.join': [
        'Membership is exclusive and walking out is its own act, at its own price. Leave first, ' +
        'out loud, and then the door is a door again.'
    ],
    'engine.untreatedInjuries': [
        'There is nothing to treat. A wound is arranged by taking one - ADMIN spawn_encounter ' +
        'ordinal=<well above you>, and then fight it.'
    ]
});

/**
 * Refusals with no route, and why each has none.
 *
 * Small on purpose, and it should stay small: an entry here is a claim that
 * nothing arranges the thing, which is exactly the kind of sentence that goes
 * stale. Every one of these is a shape the world cannot hold rather than a bar
 * somebody has not cleared.
 */
export const NOTHING_ARRANGES_IT: Readonly<Record<string, string>> = Object.freeze({
    admission_requirements_unmet:
        'The unmet requirement is an INNATE attribute. Those are rolled once, at birth, and ' +
        'never rise - nothing on this surface writes one, and the door does not open later.',
    sect_does_not_recruit:
        'There is no entrance requirement because there is no entrance. Nothing here makes one.',
    house_takes_by_adoption:
        'A house is a family and the way in is adoption, offered by the house to somebody who ' +
        'is already a prodigy in its dao. There is no application, so there is nothing to clear.'
});

/** What to say after a forced verb refused. */
export type WhatWouldArrangeIt =
    | { readonly kind: 'route'; readonly lines: readonly string[] }
    | { readonly kind: 'no_route'; readonly reason: string }
    | { readonly kind: 'unrecorded' };

/**
 * Look a refusal up by its own identity, and never by reading its prose.
 *
 * `call` is the engine call that filed it; `code` is the guiding-error code
 * where the refusal came from a tool. A refusal in neither table returns
 * `unrecorded`, and the caller says so plainly rather than guessing which kind
 * it was - guessing is how a bar starts being described as an impossibility,
 * and an impossibility as a bar.
 */
export function whatWouldArrangeIt(call: string, code: string | null): WhatWouldArrangeIt {
    for (const key of [code, call]) {
        if (key === null) continue;
        const noRoute = NOTHING_ARRANGES_IT[key];
        if (noRoute !== undefined) return { kind: 'no_route', reason: noRoute };
        const lines = THE_ACTIONS_THAT_ARRANGE_IT[key];
        if (lines !== undefined) return { kind: 'route', lines };
    }
    return { kind: 'unrecorded' };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/** One forced call, alive for exactly the duration of that call. */
export interface ForcedAttempt {
    /** The verb the operator named. A member of `ACTION_NAMES`. */
    readonly verb: string;
    /** Which decisions this verb's resolvers may reach. Closed, from the table. */
    readonly reaches: readonly ForceableDecisionName[];
    /** Which of them actually asked, in the order they asked. Filled as it runs. */
    readonly landed: ForceableDecisionName[];
}

const CURRENT = new AsyncLocalStorage<ForcedAttempt>();

/** Which decisions a verb's resolvers can reach. A lookup, never a guess. */
export function decisionsReachedBy(verb: string): ForceableDecisionName[] {
    return (Object.keys(FORCEABLE_DECISIONS) as ForceableDecisionName[])
        .filter(name => FORCEABLE_DECISIONS[name].reachedBy.includes(verb));
}

/**
 * Run `fn` with an attempt forced.
 *
 * The ONLY way into the context. Called in one place - the ADMIN dispatcher in
 * `game.ts` - behind `ADMIN_MODE`, on a verb the operator named. It returns
 * the attempt record alongside the result so the caller can say which
 * decisions were actually reached rather than which ones might have been.
 */
export async function withTheAttemptLanding<T>(
    verb: string,
    fn: () => Promise<T>
): Promise<{ result: T; forced: ForcedAttempt }> {
    const forced: ForcedAttempt = {
        verb,
        reaches: decisionsReachedBy(verb),
        landed: []
    };
    const result = await CURRENT.run(forced, fn);
    return { result, forced };
}

/**
 * The forced attempt in flight, or null.
 *
 * Read by the dispatcher after the verb has run, to say which decisions were
 * ACTUALLY reached rather than which ones could have been. The difference
 * matters: "this verb reached no uncertain question on this turn" is a true and
 * useful thing to tell an operator, and "decided by ADMIN" printed over a turn
 * where nothing was decided is the invisible-fallback defect wearing a receipt.
 */
export function theAttemptInFlight(): ForcedAttempt | null {
    return CURRENT.getStore() ?? null;
}

/**
 * Whether this named decision is being forced right now.
 *
 * Call it AFTER taking the draw, never instead of taking it:
 *
 *     const taken = look < chance || theRollLands('a_house_looking_at_an_applicant');
 *
 * A draw skipped is a draw the next caller on that stream gets instead, which
 * would make a forced turn and an unforced one diverge everywhere downstream.
 */
export function theRollLands(decision: ForceableDecisionName): boolean {
    const forced = CURRENT.getStore();
    if (forced === undefined) return false;
    if (!forced.reaches.includes(decision)) return false;
    if (!forced.landed.includes(decision)) forced.landed.push(decision);
    return true;
}

/**
 * The forced attempt in flight, for a caller that has to pass the answer on.
 *
 * Used by the impure layer to fill the explicit `theAttemptLands` input a pure
 * resolver takes, because a pure function must not read an ambient store. See
 * the header.
 */
export function theAttemptIsBeingForced(decision: ForceableDecisionName): boolean {
    return theRollLands(decision);
}
