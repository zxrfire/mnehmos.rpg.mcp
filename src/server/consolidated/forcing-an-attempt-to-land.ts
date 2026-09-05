/**
 * Forcing an attempt to land - what ADMIN reaches inside an ordinary verb.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import {
    whatTheOperatorReachedPast,
    withTheOperatorReaching
} from '../../web/operator-knowledge-reach.js';
import { ensureCultivationDb, writeAdminAudit } from './cultivation-support.js';

// THE DECISIONS FORCE REACHES

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

// WHEN A FORCED VERB REFUSES ANYWAY

/**
 * Refusals that are BARS, and the admin lines that clear each one.
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
 * Run `fn` with an attempt forced, and with the operator reaching.
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
    const playing = whoIsPlaying();
    const ran = await withTheOperatorReaching(
        playing?.cultivatorId ?? null,
        () => CURRENT.run(forced, fn)
    );
    if (playing && ran.reach && ran.reach.reached.length > 0) {
        writeAdminAudit(ensureCultivationDb(), `reach.${verb}`, playing.runId, {
            verb,
            holderId: playing.cultivatorId,
            reachedPast: ran.reach.reached,
            what: whatTheOperatorReachedPast(ran.reach)
        });
    }
    return { result: ran.result, forced };
}

/**
 * The cultivator an operator line is being typed for, or null.
 */
function whoIsPlaying(): { runId: string; cultivatorId: string } | null {
    try {
        const run = ensureCultivationDb().runs.getActiveRun();
        if (!run || !run.cultivatorId) return null;
        return { runId: run.id, cultivatorId: run.cultivatorId };
    } catch {
        return null;
    }
}

/**
 * The forced attempt in flight, or null.
 */
export function theAttemptInFlight(): ForcedAttempt | null {
    return CURRENT.getStore() ?? null;
}

/**
 * Whether this named decision is being forced right now.
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
 */
export function theAttemptIsBeingForced(decision: ForceableDecisionName): boolean {
    return theRollLands(decision);
}
