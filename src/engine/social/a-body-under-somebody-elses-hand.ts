/**
 * Somebody kept walking around after the part that would say no is gone.
 *
 * NO REFUSAL STEP AT ALL - not one that always fails, not a compliance cost of
 * zero. Which is why this does not go through `canOrder`, on the design owner's
 * explicit ruling: `canOrder` encodes INSTITUTIONAL authority, and "on what
 * authority?" is the whole of it. A held body claims no authority, there is a
 * pill. A branch there would also hand your house authority over your zombie,
 * and let the punishment elder give it instructions.
 *
 * The holder lives on `NpcRecord.tags` and not a new column, because being held
 * is rare and a migration for a state almost nobody is in is paid by everybody.
 * If held bodies stop being rare, promote it to a field.
 *
 * READ THIS BEFORE CHANGING EITHER END: you cannot both control somebody and
 * read them. It is not written anywhere, it falls out of `identityContinuity: 0`
 * reading as `nothing_left` to `whatASoulSearchTakes`. Give a held body a
 * readable soul, or let a search survive a hollowing, and the choice between
 * owning a courier who walks home and learning where the children went quietly
 * stops existing.
 */

import type { ObligationInput } from './grudges.js';
import type { SoulState } from '../world/npc-state.js';

/** Namespace on `NpcRecord.tags`. One holder, written as one tag. */
const HELD_BY = 'held_by:';

export function tagForHolder(holderId: string): string {
    return `${HELD_BY}${holderId}`;
}

/** Whose hand this body is under, or null for everybody who is their own. */
export function whoseHandThisBodyIsUnder(tags: readonly string[]): string | null {
    const held = tags.find(tag => tag.startsWith(HELD_BY));
    return held ? held.slice(HELD_BY.length) : null;
}

export interface WhatIsLeftOfThem {
    readonly soulState: SoulState;
    readonly identityContinuity: number;
    readonly tags: readonly string[];
}

/**
 * What the pill leaves, on the record. `fragmented` and not `fading`: the soul
 * is not going out, it is broken open and kept, which is how the poison and
 * this share a field without sharing an outcome. `identityContinuity` at zero
 * is the honest number, and is also what makes a held body unreadable.
 */
export function whatTheHollowingLeaves(before: WhatIsLeftOfThem): WhatIsLeftOfThem {
    return {
        ...before,
        soulState: 'fragmented',
        identityContinuity: 0,
        tags: before.tags.filter(tag => !tag.startsWith(HELD_BY))
    };
}

/**
 * And whose hand it is under, which is a SEPARATE FACT. The pill hollows, it
 * does not appoint: somebody who swallows one alone is emptied and belongs to
 * nobody, and a hand can be taken off without the hollowing being undone.
 */
export function whatTheHandLeaves(
    before: WhatIsLeftOfThem,
    holderId: string
): WhatIsLeftOfThem {
    const hollow = whatTheHollowingLeaves(before);
    return { ...hollow, tags: [...hollow.tags, tagForHolder(holderId)] };
}

/** Undoing the holding. It does not undo the hollowing. */
export function takeTheHandOff(before: WhatIsLeftOfThem): WhatIsLeftOfThem {
    return { ...before, tags: before.tags.filter(tag => !tag.startsWith(HELD_BY)) };
}

export type WhatAHeldBodyDoes =
    /** Nobody is holding them. Every ordinary route applies and this one does not. */
    | 'their_own'
    /** Somebody else is holding them; an instruction from you is not theirs to take. */
    | 'held_by_another'
    /** It happens. There is nothing between the instruction and the act. */
    | 'it_happens';

/**
 * What a held body does with an instruction. There is no fourth answer where
 * they decline, and no number anywhere in this function - no roll, no loyalty,
 * no standing, no cost. `held_by_another` is not a refusal either; it is
 * answered the way a locked door is answered.
 */
export function whatAHeldBodyDoesWith(
    tags: readonly string[],
    instructingId: string
): WhatAHeldBodyDoes {
    const holder = whoseHandThisBodyIsUnder(tags);
    if (holder === null) return 'their_own';
    return holder === instructingId ? 'it_happens' : 'held_by_another';
}

export interface WhatWasDoneToThem {
    readonly victimId: string;
    readonly holderId: string;
    readonly holderName: string;
    readonly victimName: string;
    readonly onDay: number;
    /** Anybody who saw it. A wrong nobody saw still happened to them. */
    readonly knownTo?: readonly string[];
}

/**
 * The row the ledger opens, which is the largest one it writes. `unforgivable`
 * and not computed: every other severity here is priced because those are
 * matters of degree, and there is no slight version of being made into a thing.
 *
 * Held by the victim, and taking the hand off does not settle it - freeing
 * somebody is not restitution, it is stopping. Nor does the holder dying:
 * `grudges.ts` inheritance carries the open account to whoever holds it next.
 */
export function whatBeingMadeIntoAThingOpens(what: WhatWasDoneToThem): ObligationInput {
    return {
        kind: 'grudge',
        id: `grudge_${what.victimId}_${what.holderId}_violated`,
        holderId: what.victimId,
        subjectId: what.holderId,
        cause: 'violated',
        severity: 'unforgivable',
        onDay: what.onDay,
        description:
            `${what.holderName} put ${what.victimName} under their hand with a pill, and moved `
            + 'them about afterwards. What was taken was the part that would have said no.',
        participants: [],
        tags: [
            'wrong:held',
            'by:pill',
            // So a later reader can tell "is still held" from "was held once".
            // The second does not stop being true when the first stops.
            'irreversible:identity'
        ],
        ...(what.knownTo && what.knownTo.length > 0 ? { knownTo: [...what.knownTo] } : {})
    };
}
