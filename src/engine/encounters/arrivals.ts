/**
 * The world arriving instead of being reported.
 *
 * `digest.ts` already answers "what would have reached them", and it counts
 * what did not: a five-year seclusion in a live run produced one line that
 * reached the player and thirty-five events that reached them by no channel at
 * all. That counter is correct and should stay correct - a world that is mostly
 * none of your business is the design. What was missing is the other door.
 *
 * A channel is somebody telling you. ARRIVAL is not a channel: it is the thing
 * turning up. `docs/world/discovery.md` is explicit that this is allowed and is
 * in fact the preferred shape -
 *
 *   > The consequence arrives without attribution: a road is closed, a price
 *   > moves, a village is empty, a body is found. The world may act on a player
 *   > who cannot name what acted.
 *
 * - so the text an arrival carries is the fact's own authored, name-free
 * consequence, which is exactly what `unattributedTextOf` returns and exactly
 * what the digest hands to a player who can name nobody involved. No name the
 * player lacks a record for can appear, because no name appears at all.
 *
 * This module holds no world types on purpose. The caller does the join.
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
 *
 * Above `SECT_MAGNITUDE` and below `MARKET_MAGNITUDE` in `digest.ts`, which
 * puts it in the exact band the digest is worst at: too big to be nothing, too
 * small for anybody to mention. Those are the events that should stop being
 * silent by turning up instead.
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
