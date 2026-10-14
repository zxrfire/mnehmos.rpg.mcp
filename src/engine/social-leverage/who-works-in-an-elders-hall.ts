/** Hypothetical staff layout and room remits. Actual appointments are read by
 * theHallStaff in the world layer; this planning deal does not post anybody. */

import type { RoomPurpose } from '../world/architecture.js';
import type { APortfolio } from './what-an-elder-is-in-charge-of.js';
import { inTheOrderOfficesAreDealt, whoAnswersAbout } from './what-an-elder-is-in-charge-of.js';
import type { OnTheRoll } from './what-a-body-wants-is-what-its-deciders-want.js';
import { whoDecidesIn } from './what-a-body-wants-is-what-its-deciders-want.js';

/** Somebody's sub-job: a person, and the room they work in. */
export interface APost {
    purpose: RoomPurpose;
    personId: string;
    /**
     * Whoever holds the room, which is whose call the selection was. Null where
     * nobody holds it, and then nobody selected anybody either.
     */
    selectedById: string | null;
}

/**
 * Who works in each of this house's rooms.
 *
 * Rooms in the order offices are dealt, disciples heaviest-first, round robin - the same deal
 * `whoIsInChargeOfWhat` makes, so the archive's disciple is a more senior
 * disciple than the mission hall's for the same reason the archive's elder is a
 * more senior elder. One rule, read twice.
 *
 * Empty where the house has no disciples, which is the honest answer for a body
 * that admits nobody: its rooms are run by the people who decide in it and
 * there is nobody else in them.
 */
export function whoStaffsWhat(input: {
    portfolios: readonly APortfolio[];
    roll: readonly OnTheRoll[];
    rankCount: number;
}): APost[] {
    const deciders = new Set(
        whoDecidesIn({ roll: input.roll, rankCount: input.rankCount }).map(p => p.id)
    );
    // Everybody on the roll who is not one of the people who decide, heaviest
    // first. `rankIndex < 0` is somebody unaffiliated standing in the list.
    const hands = input.roll
        .filter(person => person.rankIndex >= 0 && !deciders.has(person.id))
        .sort((a, b) => b.rankIndex - a.rankIndex || a.id.localeCompare(b.id));
    if (hands.length === 0) return [];

    const rooms = [...input.portfolios]
        .sort((a, b) => inTheOrderOfficesAreDealt(a.purpose, b.purpose));

    return rooms.map((room, i) => ({
        purpose: room.purpose,
        personId: hands[i % hands.length]!.id,
        selectedById: room.holderId
    }));
}

/** Everybody posted to this room. */
export function whoWorksIn(posts: readonly APost[], purpose: RoomPurpose): string[] {
    return posts.filter(post => post.purpose === purpose).map(post => post.personId);
}

/**
 * What somebody's standing in a room lets them touch.
 *
 * TWO VALUES AND NO TABLE OF FAVOURS. The distinction is between deciding about
 * a room and handling what goes through it, and every concrete case falls out
 * of it rather than being listed: the elder over the discipline hall can alter
 * what happens to somebody held there; the disciple posted to it can carry
 * something in, carry something out, and be slow. Asking this about a room the
 * world has not built yet still answers, which is what makes it safe to point
 * at something that does not exist yet.
 */
export type Remit =
    /** Theirs to settle. The room's holder. */
    | 'decides_about_the_room'
    /** Theirs to carry, admit, delay or add to. The room's staff. */
    | 'handles_what_passes_through'
    /** Neither. They have no standing in this room at all. */
    | 'nothing_here';

export function remitOf(input: {
    purpose: RoomPurpose;
    personId: string;
    portfolios: readonly APortfolio[];
    posts: readonly APost[];
}): Remit {
    if (whoAnswersAbout(input.portfolios, input.purpose) === input.personId) {
        return 'decides_about_the_room';
    }
    return whoWorksIn(input.posts, input.purpose).includes(input.personId)
        ? 'handles_what_passes_through'
        : 'nothing_here';
}

/**
 * Who a report about this room's business is made to.
 *
 * The design owner, on taking board work: *"EITHER REPORT TO THAT ELDER OR TO A
 * DISCIPLE WORKING IN HIS HALL."* The elder where the house has one, and
 * otherwise whoever is posted there - which is what makes a hall a place that
 * is open rather than one person who might be out.
 *
 * Null where the house has neither, and that is a real answer: a house with
 * nobody over the room and nobody in it has no counterparty, and a caller
 * should say so rather than inventing a clerk.
 */
export function whoTakesAReportAt(input: {
    purpose: RoomPurpose;
    portfolios: readonly APortfolio[];
    posts: readonly APost[];
}): { personId: string; remit: Remit } | null {
    const holder = whoAnswersAbout(input.portfolios, input.purpose);
    if (holder !== null) return { personId: holder, remit: remitOf({ ...input, personId: holder }) };
    const posted = whoWorksIn(input.posts, input.purpose)[0];
    return posted === undefined
        ? null
        : { personId: posted, remit: remitOf({ ...input, personId: posted }) };
}
