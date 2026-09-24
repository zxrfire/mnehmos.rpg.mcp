/**
 * What is learned when somebody is carried home, and what it is worth.
 *
 * A search ends one of two ways and they are not the same event. The design
 * owner: *"if they died of an accident, no grudge, instead you get gratitude
 * and face. if they were killed, grudge."*
 *
 * WHICH ONE IT WAS IS READ AND NOT STORED. A killing writes a fact with a
 * `killer` and a `victim` on it, so the body's account of itself is already in
 * the ledger - and an `endNote` is free text that cannot be asked a question.
 * No third state: a death the world never recorded as a killing is an
 * accident, which is the honest reading rather than an unknown.
 *
 * THE NAME IS THE ONE THING THAT MAY BE MISSING, and the tree already has the
 * shape for that: an account with no name on it opens a search of its own
 * (`accounts-with-no-name.ts`), and a name attaching later turns it into an
 * ordinary grudge. So a house that knows one of its own was killed and does
 * not know by whom carries a real account rather than nothing.
 */

import type { WorldState } from './world-state.js';
import { createObligation, type Severity } from '../social/grudges.js';
import { withNoNameOnIt } from '../social/accounts-with-no-name.js';
import { theirFaceMoves, A_PUBLIC_WIN, whatBeingWatchedIsWorth } from './what-a-face-is-worth.js';

/** What the body says about how it got that way. */
export type WhatTheBodySays =
    | { it: 'an accident' }
    | { it: 'a killing'; killerId: string | null; killerName: string | null };

/**
 * Read the ledger for a killing this person was the victim of.
 *
 * The LAST one, because a person is the victim of a killing once and a fact
 * naming them again is the world correcting itself rather than a second death.
 */
export function whatTheBodySaysAbout(state: WorldState, deadId: string): WhatTheBodySays {
    let killerId: string | null = null;
    let killerName: string | null = null;
    let found = false;
    for (const fact of state.history.facts) {
        if (!fact.actors.some(a => a.id === deadId && a.role === 'victim')) continue;
        found = true;
        const killer = fact.actors.find(a => a.role === 'killer');
        killerId = killer?.id ?? null;
        killerName = killer?.name ?? null;
    }
    return found ? { it: 'a killing', killerId, killerName } : { it: 'an accident' };
}

/**
 * What a house gains for each of its own when a search comes home well.
 *
 * Small per person and large in aggregate, which is what a house's standing is
 * made of - the same shape `theHouseWasSeenToWin` uses, because it is the same
 * kind of credit: the house did right by one of its own and was seen to.
 */
export const WHAT_BRINGING_SOMEBODY_HOME_IS_WORTH = 0.25;

/** How many people a recovery is assumed to be talked about in front of. */
const A_HOUSE_HEARS_ABOUT_IT = 12;

/** What a killing of one of a house's own is worth as an account. */
const WHAT_A_DEAD_SECTMATE_IS_WORTH: Severity = 'grave';

export interface WhatCameBack {
    /** What the body said. */
    said: WhatTheBodySays;
    /** People whose face moved, where it was an accident. */
    faceMoved: number;
    /** Whether an account was opened, and whether it has a name on it. */
    account: 'none' | 'named' | 'no name on it';
}

/**
 * Settle a search that came home, on the house that sent it.
 *
 * GRATITUDE IS FACE AND NOT A SEPARATE CURRENCY. A house that went and got its
 * dead back is a house people want to belong to, and this world already
 * measures that. It moves for everybody on the roll rather than for the
 * searcher alone, per the owner: the sect as a whole.
 *
 * AND A KILLING IS THE HOUSE'S ACCOUNT, not the searcher's. The person who
 * carried the body home did not lose a sectmate; the house did, and it is the
 * house that will still be carrying it in two hundred years. The account is
 * held by the head where there is one, because an obligation needs somebody to
 * hold it and a house's own is whoever answers for it.
 */
export function whatASearchBroughtBack(
    state: WorldState,
    input: {
        deadId: string;
        houseId: string;
        /** Who holds the account for the house. Its head, usually. */
        holderId: string;
        day: number;
        deadName: string;
    }
): WhatCameBack {
    const said = whatTheBodySaysAbout(state, input.deadId);

    if (said.it === 'an accident') {
        let faceMoved = 0;
        const each = A_PUBLIC_WIN * WHAT_BRINGING_SOMEBODY_HOME_IS_WORTH
            * whatBeingWatchedIsWorth(A_HOUSE_HEARS_ABOUT_IT);
        for (const npc of state.npcs) {
            if (npc.factionId !== input.houseId || npc.status !== 'alive') continue;
            theirFaceMoves(state, npc.id, Number(each.toFixed(2)), input.day);
            faceMoved++;
        }
        return { said, faceMoved, account: 'none' };
    }

    const row = {
        kind: 'grudge' as const,
        holderId: input.holderId,
        subjectId: said.killerId,
        cause: 'killed_sectmate' as const,
        severity: WHAT_A_DEAD_SECTMATE_IS_WORTH,
        onDay: input.day,
        description: said.killerName === null
            ? `${input.deadName} was killed, and was carried home by their own. `
                + 'Nobody has put a name to it.'
            : `${input.deadName} was killed by ${said.killerName}, and was carried home `
                + 'by their own.'
    };
    state.obligations.push(
        createObligation(said.killerId === null ? withNoNameOnIt(row) : row)
    );
    return {
        said,
        faceMoved: 0,
        account: said.killerId === null ? 'no name on it' : 'named'
    };
}
