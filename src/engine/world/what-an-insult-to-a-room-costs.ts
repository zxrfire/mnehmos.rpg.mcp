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
 * INSULTING A ROOM IS INSULTING EACH OF THEM, TO A LESSER DEGREE. Said to
 * nobody in particular it reaches everybody there, and every one of them takes
 * it - but being one of the crowd somebody swore at is not being the man they
 * named. Naming one of them is the full weight on that person alone.
 *
 * AND WHAT THE REST OF THE ROOM MAKES OF IT IS FACE, NOT A SECOND STANDING
 * MOVE. Watching somebody be rude in front of you is exactly what this game
 * already prices by witness count, so it is priced there and nowhere else. A
 * bystander delta beside it would be two mechanisms for one fact.
 *
 * YOU CAN SWEAR AT SOMEBODY WHO IS NOT HERE. They did not hear it, so nothing
 * moves on their row, and neither does anybody else's: what the room makes of
 * you for saying it - that the man is their master, or that they never liked
 * him either - is `hearing-of-a-wrong.ts`'s question, off ties that already
 * exist. WHAT YOU SAY IS YOURS AND HOW THEY RESPOND IS THEIRS. This function
 * writes the saying.
 */

import type { WorldState } from './world-state.js';
import { indexById } from './world-state.js';
import { upsertRelationship } from './npc-state.js';
import {
    A_PUBLIC_WIN,
    theirFaceMoves,
    whatBeingWatchedIsWorth
} from './what-a-face-is-worth.js';
import { GRUDGE_STANDING } from './gatherings.js';

/**
 * What being insulted does to how somebody stands toward you.
 *
 * DERIVED AND NOT PICKED: half of `GRUDGE_STANDING`, so one insult is not a
 * grudge and two are. That is the whole of the arithmetic and it says the
 * thing worth saying - a man can be rude to you once.
 */
export const WHAT_BEING_INSULTED_COSTS = GRUDGE_STANDING / 2;

/**
 * And what one of a crowd takes, when the crowd was what was sworn at.
 *
 * Half again, by the same arithmetic: two insults to your face are a grudge
 * and four thrown at the room you were standing in are. Being one of the
 * people somebody swore at is not being the man they named, and it is not
 * nothing either.
 */
export const WHAT_BEING_ONE_OF_THEM_COSTS = WHAT_BEING_INSULTED_COSTS / 2;

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
        const listener = state.npcs[index]!;

        // WHAT IS SAID IS THE ACT. WHO IT WAS SAID TO IS WHO IT LANDS ON.
        //
        // Somebody not addressed is not moved here, and that is deliberate
        // rather than unfinished: a bystander deciding they now think less of
        // you - because the man you swore at is their master, or because they
        // never liked him either - is the hearsay layer's question and it
        // already answers it. `hearing-of-a-wrong.ts` reads who carries for
        // whom off ties that exist; a second opinion written here would be a
        // bespoke copy of a thing this engine has.
        const [standing, note] = at === null
            ? [WHAT_BEING_ONE_OF_THEM_COSTS, 'Said it to the room they were standing in.'] as const
            : at === id
                ? [WHAT_BEING_INSULTED_COSTS, 'Said it to their face, in front of people.'] as const
                : [0, ''] as const;

        if (standing === 0) continue;
        state.npcs[index] = upsertRelationship(listener, {
            targetId: input.speakerId,
            targetName: input.speakerName,
            kind: 'rival',
            standing: Number(standing.toFixed(2)),
            note
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
