/**
 * The producer that says who a member has just been shown, on their own roll.
 *
 * `the-people-you-serve-with.ts` holds the rule and the argument for it. This is
 * the half that knows where the rows live: it joins the house's roster to who is
 * physically here, hands both to the rule, and returns a {@link Perception} for
 * the turn boundary to write.
 *
 * ── IT DECLARES, IT DOES NOT WRITE ───────────────────────────────────────
 *
 * Which is the whole point of the seam in `shown-this-turn.ts`. Knowledge used
 * to be written by whoever happened to be holding the player, and a verb that
 * forgot was indistinguishable from a verb that decided not to. A producer says
 * what it showed; one writer records it.
 *
 * ── AND MEMBERSHIP IS THE TRIGGER, NOT THE JOIN ──────────────────────────
 *
 * A one-shot write when `handleJoin` completes would be a snapshot of a moving
 * roster: it would miss everybody already enrolled when it landed, everybody who
 * joins the house afterwards, and every promotion that puts a member in a
 * different room. Deriving it wherever a member's situation is read costs one
 * roster join and cannot go stale, which is the same reason the ground holder is
 * asked at the moment somebody stands there rather than stamped at seeding.
 */

import type { Cultivator } from '../schema/cultivation.js';
import {
    howServingTogetherPutIt,
    thePeopleYouServeWith,
    type SomebodyStandingHere
} from '../engine/social/the-people-you-serve-with.js';
import type { Perception } from './shown-this-turn.js';

export interface MeetingYourOwnHouse {
    /** The house's display name, for the row's own sentence. */
    houseName: string;
    /** Everybody standing here, with their own house on the row. */
    here: readonly SomebodyStandingHere[];
}

/**
 * What standing among your own house shows you, or null when it shows nothing.
 *
 * Null rather than an empty perception, so a caller can skip the declaration
 * entirely on the ordinary turn where nobody new is in the room.
 */
export function whatStandingAmongYourOwnShows(
    cultivator: Cultivator,
    factionId: string | null,
    input: MeetingYourOwnHouse
): { perception: Perception; hiddenByHeight: number } | null {
    const read = thePeopleYouServeWith({
        factionId,
        realmOrdinal: cultivator.realmOrdinal,
        selfId: cultivator.id,
        here: input.here
    });
    if (read.theyMayName.length === 0) return null;

    return {
        hiddenByHeight: read.hiddenByHeight,
        perception: {
            names: read.theyMayName.map(person => ({
                kind: 'cultivator' as const,
                id: person.id,
                name: person.name,
                // `named` and never more. Serving with somebody tells you who
                // they are; it tells you nothing about their art, their
                // grievance or what they want, all of which are on the same
                // catalog row and none of which this licenses.
                stage: 'named' as const,
                statement: howServingTogetherPutIt(input.houseName, person)
            })),
            note: `Serving at ${input.houseName}, and in the room.`,
            // You were there and so were they. The ceiling is `known`; this
            // aims below it deliberately, exactly as the ground writer does.
            sourceKind: 'witnessed'
        }
    };
}
