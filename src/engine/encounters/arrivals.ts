/**
 * The world arriving instead of being reported.
 */

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
