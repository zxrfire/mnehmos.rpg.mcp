/**
 * A deed somebody did enters the world the same way the world's own events do.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE SEAM THIS CLOSES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The world writes facts about itself constantly. A played deed wrote almost
 * none, and the two places it did were reached by accident of one method
 * happening to hold both stores. Measured on this tree, over the 28 exported
 * functions in `src/engine/world/` that append a fact:
 *
 *     reached from outside src/engine/world/     4
 *     of those, reachable from a player action   3
 *
 * and the three are `settleAbode`, `descend` and `whatTheConfrontationDidToThem`
 * - an abode above the Lid, a descent, and a killing. Everything else a player
 * does that the world should contain went into the OBLIGATION LEDGER and
 * nowhere else: a house holds a robbery grudge about somebody and the world
 * does not contain the robbery.
 *
 * That is not a missing feature, it is a missing WRITER on one side of every
 * propagation system in the repository. `circulating` in
 * `what-people-are-saying.ts` reads `state.history.facts` and nothing else.
 * `digest.ts` reads `state.history.facts` and nothing else. Hearsay, rumour,
 * the market repeat, what a stranger two provinces away has heard about you -
 * every one of them is a reader over a table that the player could not write
 * to. So a deed that opened an account nobody could gossip about was, to the
 * rest of the world, something that had not happened.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE LEDGER AND THE RECORD ARE TWO QUESTIONS, NOT TWO MEMORIES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * This file does NOT open an account, settle one, or price one. The obligation
 * ledger already answers *how heavy a record does the aggrieved party hold*,
 * and `grudges.ts` requires that severity be decided exactly once, at creation.
 * Re-deciding it here would be a second opinion about the same number, which is
 * the failure this repository has had to undo before.
 *
 * What this answers is the other question - *what happened, on what day, in
 * front of whom* - and the two are joined rather than duplicated:
 *
 *     the fact       ground truth. Written first, so it has an id.
 *     the obligation `triggeringEventId`, which `grudges.ts` has carried since
 *                    the social migration, indexes by (`byEvent`), and which
 *                    NOTHING IN `src/web/` HAS EVER SET.
 *
 * So the caller writes the fact, then stamps its id on the row it was already
 * writing. One event, two views of it, and a query can walk from either to the
 * other. That is the reconciliation, and it costs a field that already exists.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHO DECIDES HOW HEAVY IT WAS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Exactly one of the two, never both:
 *
 *   `weight`   the caller already decided, for a record it is already writing.
 *              Passed through untouched. No pricing happens here at all.
 *   `price`    nothing has decided yet, so `whatADeedLeaves` decides - the one
 *              scoring function in the codebase for what a transfer was worth,
 *              in either direction, and the correct consumer for a deed that
 *              opens no account. A gift is priced by exactly the same machinery
 *              as a killing, which is that module's whole argument.
 *
 * Supplying both is a caller bug and is refused by the type.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE BRANCHES ON WHAT THE DEED WAS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The same law `what-a-deed-leaves.ts` states and for the same reason: a tenth
 * kind of deed must need no new branch. `kind` is the ledger's own
 * `HistoricalEventKind`, supplied by the caller - who knows what happened -
 * carried straight onto the row and never read. Grep it: there is no
 * `switch (kind)` in this file and no table keyed on one.
 *
 * Two things ARE read, and neither of them is the deed's name:
 *
 *   HOW HEAVY IT WAS    decides the fact's `magnitude`, which is the reporting
 *                       weight the digest filters on and the first term in what
 *                       gets repeated in a market.
 *   WHETHER ANYBODY
 *   WORKED IT OUT       decides `visibility`. `circulating` excludes `secret`
 *                       outright - "a secret that everybody is repeating is not
 *                       a secret" - so a deed nobody attributed is in the world,
 *                       is findable, and is not gossip. That is the deniable
 *                       case from `Deed.knownTo`, in the one field the rumour
 *                       layer already reads.
 *
 * Mutates `state` in place, as every write path in this layer does.
 */

import {
    makeFact,
    type EventScale,
    type HistoricalActor,
    type HistoricalFact,
    type HistoricalEventKind
} from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { WorldState } from './world-state.js';
import type { Severity } from '../social/grudges.js';
import {
    whatADeedLeaves,
    type Deed,
    type Party,
    type Reach,
    type WhatADeedLeaves
} from '../social-leverage/what-a-deed-leaves.js';

// ─────────────────────────────────────────────────────────────────────────
// HOW LOUD IT WAS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What each band is worth as reporting weight, 0..1.
 *
 * Written out rather than derived from `severityRank`, because that function
 * says in its own comment that it is for sorting and filtering and never for
 * weighting - and because the four numbers are a judgement about how far news
 * travels, which is worth being able to read and argue with in one place.
 *
 * The floor is deliberately above zero. A slight is still a thing that
 * happened, and `airtimeOf` adds its own terms on top - who was in it, how far
 * above the listener they stand, how long ago. A market that only repeats
 * atrocities is a market that tells the player nothing about anybody.
 */
const MAGNITUDE_AT: Readonly<Record<Severity, number>> = Object.freeze({
    slight: 0.2,
    serious: 0.4,
    grave: 0.65,
    unforgivable: 0.85
});

/** The band at which a deed is a regional event rather than a local one. */
const CARRIES_PAST_THE_TOWN: Severity = 'grave';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE CALLER SUPPLIES
// ─────────────────────────────────────────────────────────────────────────

/** The deed and the two people, for a caller that has not priced it. */
export interface DeedToPrice {
    deed: Deed;
    actor: Party;
    subject: Party;
    /** How far the wronged side can get at the actor. Ignored for a kindness. */
    reach?: Reach;
    /** True where the principal is dead or gone and their people hold it instead. */
    principalCannotHoldIt?: boolean;
}

interface Common {
    /**
     * The ledger's own word for the event. DATA: carried onto the row and never
     * read by anything in this file.
     */
    kind: HistoricalEventKind;
    /** Absolute WORLD day. Not the run's elapsed days. */
    day: number;
    locationId: string | null;
    /** Free-text place, where the world does not model where this happened. */
    place?: string | null;
    /** Everybody the event names. Roles are the caller's words. */
    actors: readonly HistoricalActor[];
    /** Houses on the record. Their people are who a faction-visible fact reaches. */
    factionIds?: readonly string[];
    /** Engine-authored factual statement. Never flavour, never a guess. */
    summary: string;
    /**
     * The name-free line somebody with no standing to be told gets instead.
     *
     * Required rather than optional, and that is the whole reason it is here:
     * `unattributedTextOf` falls back to "Something happened that nobody will
     * explain" for a kind it has not been taught, so a fact written without one
     * reaches every stranger in the province as a shrug. A vague TRUE line is a
     * better failure than a specific invented one - and a deliberately written
     * vague line is better than either.
     */
    unattributed: string;
    /**
     * Whether anybody who could name the actor knows they did it.
     *
     * False writes the fact `secret`: it happened, the world holds it, it is
     * findable by anybody who later works it out, and nobody repeats it.
     * Defaults to true, because most deeds are done in front of somebody.
     */
    workedOut?: boolean;
    /** How far the physical consequence reached. Personal unless the caller says. */
    scale?: EventScale;
    /** Extra columns for the row. Merged under the caller's own keys. */
    data?: Record<string, string | number | boolean | null>;
}

/**
 * A deed with its weight already decided, for a record already being written.
 *
 * `price` is forbidden here by the type rather than by a runtime check: two
 * answers to how heavy something was is the defect, so it should not be
 * expressible.
 */
export interface ADeedAlreadyPriced extends Common {
    weight: Severity;
    price?: never;
}

/** A deed nothing has priced. `whatADeedLeaves` prices it. */
export interface ADeedToPrice extends Common {
    weight?: never;
    price: DeedToPrice;
}

export type ADeedTheWorldShouldHold = ADeedAlreadyPriced | ADeedToPrice;

export interface TheWorldNowHoldsIt {
    /** The row. Its `id` is what belongs on the obligation's `triggeringEventId`. */
    fact: HistoricalFact;
    /** What it was worth, wherever that was decided. */
    weight: Severity;
    /**
     * Everything else the deed leaves - the records it would open, the shame,
     * how far it reached, whether it descends. Null where the caller priced it
     * elsewhere, because then this file never asked.
     *
     * Returned rather than written: opening an account is the obligation
     * ledger's job and this file does not have one to write to.
     */
    leaves: WhatADeedLeaves | null;
    /** Engine truth, one line, for the mechanical channel. Never narration. */
    line: string;
}

// ─────────────────────────────────────────────────────────────────────────
// THE WRITE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Put one deed into the world's own record.
 *
 * Appends through {@link appendWorldFact} and never through `appendFact`, so
 * the fact lands on the record of everybody it names and the people standing
 * there are drawn from the place - the two things that make a deed recoverable
 * from the person who did it rather than only from the person it was done to.
 *
 * `recur: false` always. Two deeds are two deeds however much their summaries
 * have in common, which is the same ruling the killing template already makes.
 */
export function aDeedEntersTheWorld(
    state: WorldState,
    input: ADeedTheWorldShouldHold
): TheWorldNowHoldsIt {
    const leaves = input.price
        ? whatADeedLeaves({
            deed: input.price.deed,
            actor: input.price.actor,
            subject: input.price.subject,
            ...(input.price.reach ? { reach: input.price.reach } : {}),
            ...(input.price.principalCannotHoldIt
                ? { principalCannotHoldIt: true }
                : {})
        })
        : null;
    const weight = input.weight ?? leaves!.weight;

    // Somebody worked it out unless the caller says otherwise. Where the deed
    // was priced here, the deed module has already answered the same question
    // off `knownTo` and its answer is the one that stands - one field, one
    // authority, and the caller does not have to say the same thing twice.
    const workedOut = leaves
        ? leaves.reached !== 'nobody has worked it out'
        : input.workedOut !== false;

    const heavy = MAGNITUDE_AT[weight] >= MAGNITUDE_AT[CARRIES_PAST_THE_TOWN];

    const fact = appendWorldFact(state, makeFact({
        day: input.day,
        kind: input.kind,
        scale: input.scale ?? (heavy ? 'local' : 'personal'),
        summary: input.summary,
        actors: [...input.actors],
        locationId: input.locationId,
        place: input.place ?? null,
        factionIds: [...(input.factionIds ?? [])],
        // The one read of the weight that changes anything downstream, and it
        // changes reporting rather than mechanics: `magnitude` is what the
        // digest filters on and the first term in `airtimeOf`.
        magnitude: MAGNITUDE_AT[weight],
        visibility: workedOut ? (heavy ? 'public' : 'regional') : 'secret',
        causeKnown: workedOut,
        data: {
            deedWeight: weight,
            unattributed: input.unattributed,
            ...(input.data ?? {})
        }
    }), { recur: false });

    return {
        fact,
        weight,
        leaves,
        line: workedOut
            ? `The world has it written down as ${weight}, on day ${input.day}, `
              + `and ${fact.witnessIds.length} `
              + `${fact.witnessIds.length === 1 ? 'person was' : 'people were'} there.`
            : 'The world has it written down. Nobody has put your name to it, so nobody '
              + 'is repeating it - which is not the same as nobody ever finding out.'
    };
}
