/**
 * The world arriving instead of being reported.
 */

import type { HowFarOff } from '../world/what-people-are-saying.js';
import type { ArrivableFact } from './types.js';

/** A world fact, reduced to what deciding on arrival actually needs. */
export interface FactLike {
    id: string;
    day: number;
    magnitude: number;
    kind?: string;
}

export interface ArrivableInput<F extends FactLike> {
    /** Everything that happened in the span. `PlayAdvanceResult.events`. */
    facts: readonly F[];
    /** Fact ids the digest already reported. Those were heard; they need no door. */
    reportedFactIds: Iterable<string>;
    /** The fact's authored name-free consequence. `unattributedTextOf`. */
    consequenceText: (fact: F) => string;
    /** Below this, a thing is too small to turn up on anybody. */
    minMagnitude?: number;
}

/**
 * Default magnitude floor for arrival.
 */
export const ARRIVAL_MIN_MAGNITUDE = 0.3;

/**
 * The unheard events that are large enough to turn up on somebody.
 *
 * Chronological and stable. Nothing is drawn here - this is the candidate list,
 * and `window.ts` decides whether the day was one on which something arrived.
 */
export function arrivableFromUnheard<F extends FactLike>(
    input: ArrivableInput<F>
): ArrivableFact[] {
    const reported = new Set(input.reportedFactIds);
    const floor = input.minMagnitude ?? ARRIVAL_MIN_MAGNITUDE;

    const out: ArrivableFact[] = [];
    for (const fact of input.facts) {
        if (reported.has(fact.id)) continue;
        if (!Number.isFinite(fact.magnitude) || fact.magnitude < floor) continue;
        const text = input.consequenceText(fact);
        if (!text || text.trim().length === 0) continue;
        out.push({
            factId: fact.id,
            day: fact.day,
            text,
            magnitude: fact.magnitude,
            kind: fact.kind
        });
    }

    out.sort((a, b) => a.day - b.day || (a.factId < b.factId ? -1 : 1));
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHERE IT HAPPENED
//
// The list above filters on size and on whether the digest already reported it,
// and on nothing else, so a war on the far side of the continent was exactly as
// likely to land on a sitting as two juniors brawling in the next courtyard -
// and, because `ARRIVAL_INTERRUPT_MAGNITUDE` reads the raw figure, exactly as
// likely to stop it. The same missing axis `what-people-are-saying.ts` had,
// pointed at a different consumer, and fixed with the same read.
//
// It is applied where the list is CONSUMED rather than where it is built, and
// that is not an implementation convenience: how near a thing is depends on
// where the cultivator is standing NOW, and a fact filed while they were in one
// province may be consumed while they are sitting in another.
//
// Nothing here is gated on standing. Delivery is - a rogue with no house and no
// disciple gets no post, and `digest.ts` says why - but the world happening next
// to somebody who is trying to concentrate reaches them whoever they are.
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much of a thing's size is felt where somebody is actually standing.
 *
 * Near is amplified and far is damped rather than cut: something a province away
 * still turns up, and it turns up as a thing somebody mentions instead of a
 * thing that gets you off the mat. The two bands the engine cannot place any
 * better than "somewhere in this province" and "nowhere it models" are left at
 * one, so a fact with no site behaves exactly as it always has.
 */
export const HOW_MUCH_OF_IT_REACHES: Readonly<Record<HowFarOff, number>> = Object.freeze({
    here: 1.6,
    'in the region': 1,
    'a region away': 0.45,
    unplaceable: 1
});

/**
 * The same things, sized by how near they happened to where somebody is sitting.
 *
 * Branches on nothing but the distance. The ruling is explicitly non-exhaustive,
 * so a kind of event nobody has written yet is weighted exactly like one that
 * exists, and a table of interruption types would be the thing it warns against.
 *
 * Copies rather than mutates, because the pending list outlives one window and a
 * cultivator who walks to another province has to be able to be handed the same
 * facts at a different distance.
 */
export function asItReachesWhereTheyAre<F extends ArrivableFact>(
    arrivable: readonly F[],
    howFar: (fact: F) => HowFarOff
): F[] {
    return arrivable.map(fact => ({
        ...fact,
        magnitude: Math.max(0, Math.min(1, fact.magnitude * HOW_MUCH_OF_IT_REACHES[howFar(fact)]))
    }));
}
