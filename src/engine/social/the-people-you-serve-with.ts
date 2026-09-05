/**
 * The people on your own house's roll, whom you have no excuse not to know.
 */

import { noticesThatTheyAreThere } from './presence-recognition.js';

/** One person standing here, reduced to what this rule reads. */
export interface SomebodyStandingHere {
    id: string;
    name: string;
    realmOrdinal: number;
    /** The house they serve, off their own row. Null for most people alive. */
    factionId: string | null;
    /** True where the player already holds a row about them. */
    known: boolean;
}

export interface WhoYouServeWith {
    /** The player's own house, or null when they serve nobody. */
    factionId: string | null;
    realmOrdinal: number;
    /** The player's own id, so they are never introduced to themselves. */
    selfId: string;
    /**
     * Everybody standing here, from both populations, with their house on them.
     */
    here: readonly SomebodyStandingHere[];
}

export interface ServingWithReading {
    /** The ones they may now name. Empty is the ordinary case. */
    theyMayName: SomebodyStandingHere[];
    /**
     * On your roll and in the room and still not named, because height alone
     * hides them. For the engine channel and never for the player: telling
     * somebody "there are two more here you cannot perceive" is the leak
     * wearing an apology.
     */
    hiddenByHeight: number;
}

/**
 * Who a member of this house may put a name to, standing where they are.
 * Already-known people are excluded rather than re-granted, so a caller can
 * tell meeting your house from walking through it for the hundredth time.
 */
export function thePeopleYouServeWith(input: WhoYouServeWith): ServingWithReading {
    if (!input.factionId) return { theyMayName: [], hiddenByHeight: 0 };

    const theyMayName: SomebodyStandingHere[] = [];
    let hiddenByHeight = 0;

    for (const person of input.here) {
        if (person.id === input.selfId) continue;
        // Standing in the same square is not enough, and must not be: that is
        // the case `presence.test.ts` guards.
        if (person.factionId !== input.factionId) continue;
        // Before anything else off the row, and it wins over the roll: being on
        // one list with somebody nine rungs up is not seeing they are there.
        if (!noticesThatTheyAreThere({
            theirOrdinal: person.realmOrdinal,
            yourOrdinal: input.realmOrdinal,
            known: person.known
        })) {
            hiddenByHeight += 1;
            continue;
        }
        if (person.known) continue;
        theyMayName.push(person);
    }

    return { theyMayName, hiddenByHeight };
}

/** What the knowledge row says, in the words a member would use. */
export function howServingTogetherPutIt(
    houseName: string,
    person: SomebodyStandingHere
): string {
    return `${person.name} serves ${houseName} as you do, and you have stood among them.`;
}
