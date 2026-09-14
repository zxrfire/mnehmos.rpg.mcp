/**
 * Whether a house is walking to a door to ARRIVE, or hearing it is open.
 *
 * `beingAtADoorOnTheDayItOpens` has always split those two roads and the
 * difference is the largest number in the whole convergence design - measured
 * over twelve pinned worlds, 60 scheduled sites: 75.0% of house seats can walk
 * in and back out knowing the date against 43.9% hearing it. Nothing could ask
 * for the first arm, because nothing anywhere held a house's reading of a cycle.
 *
 * ── A HOUSE HOLDS NO SUCH THING. ITS PEOPLE DO ───────────────────────────
 *
 * The standing ruling on where knowledge lives: an institution has no awareness
 * record, the people in it do, and they tell other people. So there is no
 * schedule column on a faction here and there must not be one. The house acts on
 * what somebody on its roll can say, and who that is falls out of rows the world
 * already keeps.
 *
 * ── IT IS A READING, NOT A ROW ───────────────────────────────────────────
 *
 * The same shape as `what-one-of-the-worlds-own-people-knows.ts`, and for the
 * same measured reason: a row per person per site is the combinatorial walk that
 * file was written to avoid. Two questions, both already answered elsewhere, and
 * nothing added between them:
 *
 *   CAN THEY READ A SCHEDULE   `readSchedule`, unchanged. A rung against the
 *                              site's own `scheduleReadOrdinal`, or notes that
 *                              satisfy its `scheduleKey`. It is the gate the
 *                              player's own door already goes through, so a
 *                              house and a player are held to one bar.
 *
 *   IS THIS THEIR GROUND       `KnownEntityKind: 'place'` through the world's
 *                              own people reading. Working out when a place is
 *                              next due takes records about THAT place, and
 *                              somebody who has never heard of it has none. This
 *                              is where the house enters: their own house's seat
 *                              and the ground it holds, the errands it has sent,
 *                              what the province is saying - all of it already
 *                              composed by `whatAnybodyCouldHaveOfTheGround`.
 *
 * Neither half is new and neither is stored. A house whose best scholar has
 * never heard of a pass cannot be early for it, and a house that has worked that
 * ground for centuries but keeps nobody who can read a calendar cannot either.
 *
 * ── THE STRONGEST READER IS THE ONE THE HOUSE ACTS ON ────────────────────
 *
 * Not a vote and not an average: one person says when it opens and the house
 * walks. Strongest first so the answer does not depend on roster order, and the
 * rung that answers is carried out, because `readSchedule` is asked again by the
 * caller against the same site.
 *
 * Pure. Records and a day in, a reading out. Nothing here moves anybody.
 */

import type { CapabilityActor } from './capability.js';
import { readSchedule } from './convergence.js';
import type { LocationRecord } from './locations.js';
import type { Candidate } from './who-goes-out-for-a-house-and-what-comes-back.js';

/**
 * Whether this person has anything of a piece of ground at all.
 *
 * `whatOneOfTheWorldsOwnPeopleKnows(state)(personId, 'place', locationId)` above
 * `unaware` is the caller the world supplies. It is a function rather than a
 * `WorldState` so this module cannot acquire one by accident.
 */
export type HasAnythingOfTheGround = (personId: string) => boolean;

export interface WhoHoldsTheDate {
    /** Whether anybody on this roll can say when it is next due. */
    known: boolean;
    /** Whose reading it is. Null when it is nobody's. */
    readerId: string | null;
    readerName: string | null;
    /**
     * What the house sets out on, for `beingAtADoorOnTheDayItOpens`.
     *
     * The reader's own rung and notes where there is a reader, and a party that
     * can read nothing where there is not - which is the arm the world asked for
     * before anything held this, and stays the answer for a house with nobody.
     */
    party: CapabilityActor;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Who on this roll can say when this door is next due.
 *
 * A house with nobody comes back `known: false` and a party that reads nothing,
 * so a caller that does nothing with the answer behaves exactly as it did before
 * this existed.
 */
export function whoInTheHouseKnowsWhenItOpens(input: {
    door: LocationRecord;
    onDay: number;
    /** Used as the party's id, because it is the house that sets out. */
    houseId: string;
    roster: readonly Candidate[];
    hasAnythingOfTheGround: HasAnythingOfTheGround;
    /** Notes somebody holds that a schedule could be keyed to. Rarely anything. */
    whatTheyHold?: (personId: string) => readonly string[];
}): WhoHoldsTheDate {
    const nobody: CapabilityActor = { id: input.houseId, realmOrdinal: 0 };

    // Strongest first, then by id, so the answer is a property of the roll
    // rather than of the order it was handed over in.
    const byReach = [...input.roster].sort((a, b) =>
        b.ordinal - a.ordinal || (a.id < b.id ? -1 : 1));

    for (const person of byReach) {
        const knowledgeIds = input.whatTheyHold?.(person.id) ?? [];
        const party: CapabilityActor = {
            id: person.id,
            realmOrdinal: person.ordinal,
            knowledgeIds
        };
        if (!readSchedule(input.door, party, input.onDay).known) {
            // WITH NOTHING CARRIED, THE BAR IS THE RUNG AND NOTHING ELSE, so
            // the strongest failing it means every weaker one fails it too and
            // the rest of the roll is not worth an assessment each. A roll where
            // somebody holds notes is walked to the end.
            if (input.whatTheyHold === undefined) break;
            continue;
        }
        // AND THE SECOND HALF, ASKED LAST BECAUSE IT IS THE EXPENSIVE ONE. A
        // rung is a number on the row in front of us; what somebody has of a
        // piece of ground is a walk over the ledger.
        if (!input.hasAnythingOfTheGround(person.id)) continue;

        return {
            known: true,
            readerId: person.id,
            readerName: person.name,
            party: { ...party, id: input.houseId },
            line: `${person.name} can say when ${input.door.name} is next due, and has `
                + 'something of the ground to say it about.'
        };
    }

    return {
        known: false,
        readerId: null,
        readerName: null,
        party: nobody,
        line: `Nobody on this roll can both read ${input.door.name}'s schedule and place `
            + 'the ground. The house finds out when everybody else does.'
    };
}
