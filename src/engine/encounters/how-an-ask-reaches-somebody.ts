/**
 * Whether a house's work is read off a wall or brought to you by a person.
 *
 * The design owner: *"the board is for disciples"* - elder tasks are word of
 * mouth. `whatAHouseHasOnItsBoard` feeds both channels, correctly, and the
 * DELIVERY was not split, so an elder both read their orders off a wall and was
 * sent for.
 *
 * The boundary is `HOW_WIDE_A_NOTICE_READS` rather than a new number: a posting
 * whose readable band reaches the top of what a house can field IS that house's
 * top work. No branch on rank, and it falls out at both ends - somebody far
 * below their house's ceiling reads a wall, and nobody nails up a notice to tell
 * the patriarch what to do.
 *
 * Off the wall is not out of the world. {@link whyItIsNotOnTheWall} names the
 * road instead of dropping the row, which is `boardRefusals`' discipline.
 */

import { HOW_WIDE_A_NOTICE_READS } from './what-a-house-has-on-its-board.js';
import { whatWouldPutYouThere } from '../social-leverage/who-can-put-your-name-up-for-a-posting.js';

/** The two ways a house's work gets to somebody. */
export type HowItReaches =
    /** Posted. Anybody standing in front of it can read the terms. */
    | 'the_wall'
    /** Somebody is sent, or says it at a council. A person with a name. */
    | 'word_of_mouth';

/**
 * Which road this ask comes by.
 *
 * A caller that does not know the house's reach gets `the_wall`, because the
 * ordinary answer is the honest one where nothing is known - the alternative is
 * silently treating every posting as elder business.
 */
export function howAnAskReaches(input: {
    /** The rung the duty is priced against. */
    pitchOrdinal: number;
    /** The highest rung the house has anybody standing on, when the caller knows. */
    reachOfTheHouse?: number;
}): HowItReaches {
    const reach = input.reachOfTheHouse;
    if (reach === undefined) return 'the_wall';
    return input.pitchOrdinal + HOW_WIDE_A_NOTICE_READS >= reach
        ? 'word_of_mouth'
        : 'the_wall';
}

/**
 * What the wall says about work that is not on it.
 *
 * Three things a good refusal carries: what is actually here, why it is not
 * yours off this wall, and what would change that.
 */
/**
 * What a body with no door says to somebody reading its work.
 *
 * The sibling of {@link whyItIsNotOnTheWall}, and it exists because the
 * ordinary refusal - a place on the roll is what changes that - is FALSE at the
 * two bodies that admit nobody. Telling somebody to earn a place on a roll that
 * has never once been joined is worse than telling them nothing, because it is
 * a road that does not exist.
 *
 * An appointment is not an admission, so the leverage is on whoever nominates
 * and never on the gate.
 *
 * NAMING THE ROAD AND NAMING NOBODY ON IT IS STILL A WALL. The first cut said a
 * nomination was the instrument and stopped there, so a reader learned that
 * there was a road and could not have found it - which is the same defect as the
 * empty duty board, one layer up. `reader` is optional because a caller with no
 * cultivator in hand (a catalog read, a test) still wants the general sentence;
 * where there is one, the specific half comes from
 * `who-can-put-your-name-up-for-a-posting.ts` and is derived, so a house that
 * changes patrons changes what this says.
 */
export function whyYouCannotBePostedThere(
    houseName: string,
    reader?: {
        bodyId: string;
        ordinal: number;
        houseId?: string | null;
        namesTheyKnow?: readonly string[];
    }
): string {
    const general = `${houseName} has the work and nobody applies for it. There is no bar here to `
        + 'clear and no application anybody has ever made: people stand at that gate because '
        + 'somebody decided it about them, elsewhere. What puts you there is a nomination - '
        + 'from the power above it, or from a house below it that is on good enough terms to '
        + 'have its names taken - so whatever would move one of those is the road, and the '
        + 'gate itself is not.';
    if (!reader) return general;

    const specifics = whatWouldPutYouThere({
        intoBodyId: reader.bodyId,
        readerOrdinal: reader.ordinal,
        readerHouseId: reader.houseId ?? null,
        ...(reader.namesTheyKnow ? { namesTheReaderKnows: reader.namesTheyKnow } : {})
    });
    return specifics.length === 0 ? general : `${general} ${specifics.join(' ')}`;
}

export function whyItIsNotOnTheWall(houseName: string): string {
    return `${houseName} has this in hand, and it is not board work. Nothing at the top of a `
        + 'house goes up on a wall: word is carried to the people who stand there, by somebody '
        + 'sent to say it or by a peer at a council. Being one of those people is what puts it '
        + 'in front of you.';
}
