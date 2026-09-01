/**
 * Who was there when it happened, and the fact finding its way back to them.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A seeded world advanced four hundred years, 2,624 people, 3,856 facts:
 *
 *     facts with no witnesses                        3,798 / 3,856
 *     fact ids on the record of the most-tied person      0
 *
 * The ledger could be walked from a fact to the people it named. It could not be
 * walked the other way. Pick anybody in the world and ask what happened to them
 * and the answer was nothing, because `historyFactIds` - the field whose own
 * comment calls it "the trajectory, as durable facts" - was written by exactly
 * one path in the entire world layer and every other path appended straight to
 * the ledger.
 *
 * `recordEvent` in `world-state.ts` has always done the back-link correctly and
 * nothing in the world's own advancement went through it: the pressure table,
 * the immortal layer, inheritance, absence and the party passes all called
 * `appendFact` directly, because `appendFact` takes a ledger and the ledger does
 * not know what an NPC is. So the linking was optional, and every one of them
 * skipped it - which is the shape of the defect rather than a set of oversights.
 * The answer is a world-level append that CANNOT skip it.
 *
 * ── Presence is a fact about the world ───────────────────────────────────
 *
 * `witnessIds` is stored rather than derived, and `history.ts` says why: whether
 * an event was witnessed is then a question about an observer rather than a
 * label on the event. But nothing was writing it, so `visibilityOf` could only
 * ever answer 'historical' or 'concurrent' - never 'witnessed' - for anybody at
 * all, including the two people in the room.
 *
 * Three kinds of presence, and the file draws all three from state that already
 * exists rather than inventing a scene:
 *
 *   THE PARTIES     everybody the fact names as an actor, who is somebody the
 *                   world holds. A killer was present at the killing. This is
 *                   the half that makes a killing recoverable from the killer's
 *                   record instead of only from the victim's `endNote` string.
 *   THE BYSTANDERS  living people standing in the same place that day. Bounded -
 *                   see BYSTANDERS_AT_MOST - because the engine does not model
 *                   who was standing where inside a market town, and naming two
 *                   hundred witnesses to a back-alley killing would be a
 *                   fabrication with the same shape as naming none.
 *   NOBODY          a secret event has the parties and no one else. That is what
 *                   `visibility: 'secret'` means, and it is why the killing
 *                   template already carries an `unattributed` line about a body
 *                   found on the low road.
 *
 * Everybody else in the province learns it as news. That is the knowledge
 * layer's question and not this one's, and conflating the two is how a witness
 * list becomes a mailing list.
 */

import { forStream } from '../cultivation/rng.js';
import { appendFact, type HistoricalFact, type PendingFact } from './history.js';
import type { NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

/**
 * How many people the engine will name as having been present beyond the
 * parties themselves.
 *
 * Not a crowd size and not a claim about how many people were in the town. It is
 * the number the engine can defend naming: presence is drawn from `locationId`,
 * and a location record is a settlement rather than a room, so past a handful
 * the list stops being a statement about who saw anything.
 */
export const BYSTANDERS_AT_MOST = 6;

export interface PresenceInput {
    /** Absolute day, for excluding the unborn and the already dead. */
    day: number;
    /** Where it happened. Null means nowhere the world models, so nobody. */
    locationId: string | null;
    /** Who the event names. Present by definition where they are real people. */
    actorIds: readonly string[];
    /** Secret events have the parties and no one else. */
    visibility: HistoricalFact['visibility'];
    /** When set, bystanders are drawn only from these houses. */
    factionIds?: readonly string[];
}

/**
 * Who was physically present, as ids that resolve.
 *
 * Deterministic: the bystander draw is seeded off the world seed and the place
 * and day, so a world replays with the same people standing in the same street.
 * Sorted, so the stored list does not depend on roster order.
 */
export function whoWasThere(state: WorldState, input: PresenceInput): string[] {
    const present = new Set<string>();

    // The parties. An id that resolves to nobody is dropped rather than stored,
    // because a witness list that does not resolve is the defect this file is
    // about, pointing the other way.
    for (const id of input.actorIds) {
        if (state.npcs.some(n => n.id === id)) present.add(id);
    }

    if (input.visibility === 'secret' || input.locationId === null) {
        return Array.from(present).sort();
    }

    const houses = input.factionIds && input.factionIds.length > 0
        ? new Set(input.factionIds)
        : null;
    const candidates = state.npcs.filter(n =>
        n.status === 'alive' &&
        n.locationId === input.locationId &&
        !present.has(n.id) &&
        n.identity.bornOnDay <= input.day &&
        (input.visibility !== 'faction' || !houses || houses.has(n.factionId ?? ''))
    );
    if (candidates.length === 0) return Array.from(present).sort();

    // Sorted before drawing, so the draw does not inherit roster order.
    candidates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const rng = forStream(state.seed, 'who-was-there', `${input.locationId}:${input.day}`);
    const take = Math.min(BYSTANDERS_AT_MOST, candidates.length);
    const chosen = new Set<number>();
    while (chosen.size < take) chosen.add(rng.int(0, candidates.length - 1));
    for (const at of chosen) present.add(candidates[at].id);

    return Array.from(present).sort();
}

/**
 * Append a world fact, name who was there, and put the fact on their record.
 *
 * The world-level counterpart of `appendFact`, and the only one the world's own
 * advancement should use. Mutates `state` in place, because every caller in this
 * layer already does and cloning a four-thousand-record roster per event costs
 * more than the events do.
 *
 * `witnessIds` supplied by the caller is taken as given - `gatherings.ts` knows
 * exactly who attended and should not have that overwritten by a draw. Left
 * empty, presence is worked out from the place.
 */
export function appendWorldFact(
    state: WorldState,
    pending: PendingFact,
    opts: { bystanders?: boolean } = {}
): HistoricalFact {
    const witnessIds = pending.witnessIds.length > 0
        ? pending.witnessIds
        : whoWasThere(state, {
            day: pending.day,
            locationId: opts.bystanders === false ? null : pending.locationId,
            actorIds: pending.actors.map(a => a.id),
            visibility: pending.visibility,
            factionIds: pending.factionIds
        });

    const stored = appendFact(state.history, { ...pending, witnessIds });
    linkFactToWhoItNames(state, stored);
    return stored;
}

/**
 * Put a fact id onto the record of everybody it names.
 *
 * Separate from the append so that a fact written by some other path can still
 * be linked, and so that the linking can be tested without a ledger.
 */
export function linkFactToWhoItNames(state: WorldState, fact: HistoricalFact): void {
    const named = new Set<string>([...fact.actors.map(a => a.id), ...fact.witnessIds]);
    for (const id of named) {
        const at = state.npcs.findIndex(n => n.id === id);
        if (at < 0) continue;
        const npc = state.npcs[at];
        if (npc.historyFactIds.includes(fact.id)) continue;
        state.npcs[at] = {
            ...npc,
            historyFactIds: npc.historyFactIds.concat(fact.id),
            // Somebody who was standing there was, demonstrably, still around.
            lastConfirmedOnDay: Math.max(npc.lastConfirmedOnDay, fact.day)
        };
    }
}

/**
 * Every fact on somebody's record, in the order they happened.
 *
 * The read side of the same link, and the thing a follower of a trajectory
 * actually wants. Reads `historyFactIds` rather than scanning the ledger for
 * mentions, so the cost is the length of one life rather than the length of the
 * world's history.
 */
export function trajectoryOf(state: WorldState, npc: NpcRecord): HistoricalFact[] {
    const wanted = new Set(npc.historyFactIds);
    return state.history.facts
        .filter(f => wanted.has(f.id))
        .sort((a, b) => a.day - b.day || (a.id < b.id ? -1 : 1));
}
