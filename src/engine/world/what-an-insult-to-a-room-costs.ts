/**
 * Telling a room what you think of it.
 *
 * A playtest handed this over as a sentence with no route: *"fuck you all"*
 * read three ways across three runs, twice as a question put to six people who
 * each answered something nobody had asked. A provocation is not a question and
 * it is not nothing; it is an act, and the room is entitled to take offence.
 *
 * WHAT IT COSTS IS STANDING, NOT A FIGHT. Nobody draws on a man for being rude,
 * and that is the point of having the verb: it is the cheapest way in this game
 * to make a room dislike you, and the only one that costs no days, no stones
 * and no blood. What it spends is the one thing a cultivator cannot buy back
 * quickly.
 *
 * TO THE ROOM OR TO ONE PERSON. Naming somebody is worse for them and cheaper
 * for everybody else: a room watching one man be insulted is a room watching,
 * and a room being insulted is a room that was all addressed. The engine says
 * which happened and how far it reached; what anybody does about it is theirs.
 */

import type { WorldState } from './world-state.js';
import { indexById } from './world-state.js';
import { upsertRelationship } from './npc-state.js';
import {
    A_PUBLIC_WIN,
    theirFaceMoves,
    whatBeingWatchedIsWorth
} from './what-a-face-is-worth.js';

/**
 * What being insulted in front of people does to how somebody stands toward
 * you.
 *
 * Cold enough to be worth avoiding and short of a grudge: an insult is an
 * insult. A house's own machinery decides whether it becomes anything, and
 * saying it twice is what makes it one.
 */
export const WHAT_BEING_INSULTED_COSTS = -0.35;

/** And to everybody who only watched it happen. */
export const WHAT_WATCHING_IT_COSTS = -0.15;

/**
 * What it costs the mouth it came out of.
 *
 * A public act anybody saw, priced the way every other public act is - so a
 * room of twelve is worse than a room of two, and saying it to an empty yard
 * costs almost nothing because nobody was there.
 */
export const WHAT_SAYING_IT_COSTS_YOU = -A_PUBLIC_WIN;

export interface WhatTheRoomMadeOfIt {
    /** People whose standing toward the speaker moved. */
    tookOffence: number;
    /** Whether it was addressed to one of them rather than to all. */
    atSomebodyInParticular: boolean;
    /** What it cost the speaker's own face. */
    faceLost: number;
}

/**
 * Say it, and let the room hear it.
 *
 * `atId` names one of them; leaving it null is the whole room. Nobody is moved
 * twice and the speaker is never moved toward themselves.
 */
export function anInsultLandsOnTheRoom(
    state: WorldState,
    input: {
        speakerId: string;
        speakerName: string;
        /** Everybody who heard it, the speaker included or not. */
        presentIds: readonly string[];
        atId?: string | null;
        onDay: number;
    }
): WhatTheRoomMadeOfIt {
    const heard = input.presentIds.filter(id => id !== input.speakerId);
    const at = input.atId ?? null;
    let tookOffence = 0;

    for (const id of heard) {
        const index = indexById(state.npcs, id);
        if (index < 0) continue;
        const aimedHere = at === null || at === id;
        state.npcs[index] = upsertRelationship(state.npcs[index]!, {
            targetId: input.speakerId,
            targetName: input.speakerName,
            kind: 'rival',
            standing: aimedHere ? WHAT_BEING_INSULTED_COSTS : WHAT_WATCHING_IT_COSTS,
            note: aimedHere
                ? 'Said it to their face, in front of people.'
                : 'Said it to the room they were standing in.'
        }, input.onDay);
        tookOffence++;
    }

    // AND IT COSTS THE SPEAKER, WHICH IS WHY IT IS AN ACT. A room that heard
    // you say it is a room that saw you say it, and this game already prices
    // being seen.
    const faceLost = heard.length === 0
        ? 0
        : Number((WHAT_SAYING_IT_COSTS_YOU * whatBeingWatchedIsWorth(heard.length)).toFixed(2));
    if (faceLost !== 0) theirFaceMoves(state, input.speakerId, faceLost, input.onDay);

    return { tookOffence, atSomebodyInParticular: at !== null, faceLost };
}
