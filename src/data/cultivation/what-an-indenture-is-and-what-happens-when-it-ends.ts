/**
 * What an indenture is, what the years are for, and what a person walks out
 * into on the day the term is served.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ONE DISTINCTION, AND IT IS NOT THE WORK
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Every house in the catalog with a menial tier already has a servant at the
 * bottom of its ladder - a Sword Servant, a Herb Boy, a Coal Hand, a Barrow
 * Hand. The indentured sit below that floor, and what separates them from the
 * person sweeping the same yard is one sentence:
 *
 *   A SERVANT CHOSE IT AND MAY LEAVE. AN INDENTURED PERSON DID NEITHER.
 *
 * The work can be identical. The stipend can be identical. What is different
 * is that one of them cleared a bar and can walk down the mountain this
 * afternoon, and the other is held by a word they were made to give.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * SO IT IS A CONTRACT AND NOT A STATUS, AND THE CONTRACT ALREADY EXISTS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * NOTHING HERE IS NEW MACHINERY. An indenture is written as the shape
 * `beasts.ts` already named when it listed what a contract needs - *"an oath
 * record with a penalty clause and a witnessing faction, which is the Dao house
 * contract shape rather than a new one"*:
 *
 *   THE ROW          `kind: 'oath'` on the obligation ledger, cause
 *                    `service_term`, which has been in `OathCause` since long
 *                    before this file existed and which nothing has ever
 *                    written.
 *   THE HOLDER       The person bound. They are the one answerable, which is
 *                    the direction `settleItWithABinding` already uses for a
 *                    binding extracted by a house.
 *   THE TERM         `dueOnDay`, or null where there is no end. See below.
 *   THE ENFORCEMENT  The witnessing house. `faction-character.ts` on the House
 *                    of the Bound Word: *"A broken oath is structural rather
 *                    than punitive - removing it removes some of the person."*
 *                    Nothing here has to invent a penalty. Walking out is
 *                    priced by `whatWalkingOutOfItCosts`, which was written for
 *                    exactly this and has never had a caller.
 *
 * WHICH MEANS THE INDENTURED NEED NO SPECIAL CASE ANYWHERE STANDING IS READ.
 * `authorityTier` already answers `ordered` for anybody at the bottom of a
 * house, and that is correct for a servant and for an indentured person alike:
 * nobody has to do what either of them says. What separates them is a live row
 * on the ledger, which is queryable from both sides and readable in two
 * centuries. There is no rank below rank zero and there must not be one -
 * `rankRealmBand` derives every band in the catalog from position in
 * `sect.ranks`, and inserting a rung under it would re-band every member in the
 * world.
 *
 * An indentured person therefore holds NO rank index at all. `faction-roll.ts`
 * already models that shape for a court's parallel offices and for an honorary
 * seat, and calls it being outside the ladder rather than beneath it. This is
 * the third instance of it and the only one that reads downward, because the
 * oath says why they are standing there.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * EVERY HOUSE DOES THIS. THE ALIGNMENT DECIDES WHAT THE YEARS ARE FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner's ruling: *"the indentured servant thing works for all
 * sects, all have a good reason to."* So alignment is not a gate on whether
 * somebody is taken. It is the reason given, and the three reasons are
 * genuinely different rather than one euphemism wearing three coats - which is
 * the test this whole axis has to pass to be worth having.
 *
 * A righteous house means the correction. That is not a softer answer than the
 * other two and it is not mercy with a discount: it is years of a life, taken,
 * without the person's agreement. What makes it righteous is that the house
 * believes it is putting somebody right and would say so to their face.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOBODY IS TAKEN WHO IS NOT WORTH KEEPING
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The gate on all three, and it is not in this file - it is
 * `what-a-house-does-when-it-catches-you.ts`, which asks whether a reprisal is
 * worth mounting before it asks what kind. Taking somebody means feeding,
 * housing and watching them for decades. A house does that for somebody it can
 * use. It does not do it for a nobody who gave offence, and a house that did
 * would be doing something no house would do.
 *
 * Inert data. Nothing here rolls, resolves or decides.
 */

import type { SectAlignment } from '../../schema/cultivation.js';
import type { Severity } from '../../engine/social/grudges.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE YEARS ARE FOR
// ─────────────────────────────────────────────────────────────────────────

export interface IndentureReason {
    /** What the house calls the arrangement, in its own mouth. */
    theHousesWord: string;
    /** What the years are actually for, stated so the three cannot be swapped. */
    whatTheYearsAreFor: string;
    /**
     * Whether the house states a term at all.
     *
     * Not a severity dial. A term is a limit on what the house may take, and
     * whether a body is willing to write one down is a fact about that body -
     * see {@link WHY_ONE_OF_THE_THREE_STATES_NO_TERM}.
     */
    statesATerm: boolean;
    /** What the person is called while it runs. Never a rank. */
    whatTheyAreCalled: string;
}

export const WHY_AN_INDENTURE_IS_TAKEN: Readonly<Record<
    NonNullable<SectAlignment>,
    IndentureReason
>> = Object.freeze({
    righteous: {
        theHousesWord: 'Correction.',
        whatTheYearsAreFor:
            'Putting somebody right. The house holds that a person who did this did it because '
            + 'nobody had ever stood over them while they learned better, and that standing over '
            + 'them for long enough is a thing it owes the province rather than a thing it is '
            + 'owed. It means it, it says so to the person\'s face, and it does not ask whether '
            + 'they would prefer the alternative - which is the part that makes it a punishment '
            + 'and not a kindness.',
        statesATerm: true,
        whatTheyAreCalled: 'held for correction'
    },
    neutral: {
        theHousesWord: 'The account.',
        whatTheYearsAreFor:
            'Working off what the offence cost. The house is not interested in what the person '
            + 'becomes and does not pretend to be: something was taken out of it, the person who '
            + 'took it has hands and years, and hands and years are what it will accept instead. '
            + 'The term is quoted the way a debt is quoted, and it ends when it ends.',
        statesATerm: true,
        whatTheyAreCalled: 'held against the account'
    },
    demonic: {
        theHousesWord: 'Nothing. It does not explain.',
        whatTheYearsAreFor:
            'Whatever the house has a use for. The axis every demonic body in the catalog is '
            + 'placed on is who pays and whether they agreed, and this is that axis with the '
            + 'answer at its bluntest: the person pays, they did not agree, and the house is '
            + 'under no obligation to say what for. A demonic house that offered a reason would '
            + 'be conceding that one was owed.',
        statesATerm: false,
        whatTheyAreCalled: 'held'
    }
});

/**
 * Why the third states no term, and why that is derived rather than a severity
 * setting.
 *
 * A stated term is a limit on what the house may take, published in advance and
 * witnessed by somebody who will hold it to the figure. Two of the three write
 * one because their whole standing rests on being the kind of body that does.
 * The third has no such standing to protect, and writing a term would be
 * volunteering a constraint nobody is in a position to demand.
 *
 * Note what this is NOT. It is not "demonic is worse". A term of sixty years at
 * a righteous house is sixty years of somebody's life and they did not agree to
 * one of them. What differs is whether there is a day on the far side of it.
 */
export const WHY_ONE_OF_THE_THREE_STATES_NO_TERM =
    'A term is a limit the house accepts on itself and lets somebody else hold it to. Two of '
    + 'the three write one because being the kind of body that keeps its word is most of what '
    + 'they trade on. The third has nothing of the sort at stake, so there is nothing to be '
    + 'bought by conceding a date.';

// ─────────────────────────────────────────────────────────────────────────
// HOW LONG
// ─────────────────────────────────────────────────────────────────────────

/**
 * The term, in years, for an account of this weight.
 *
 * READ OFF WHAT THE DEED WAS WORTH, NEVER OFF WHO CAUGHT YOU.
 * `whatItWasWorth` in `what-a-deed-leaves.ts` already computes the weight from
 * what the deed cost, whether it comes back and whether a word was given first,
 * and that is the magnitude of the thing. The alignment decides the kind of
 * answer and touches this table nowhere.
 *
 * `slight` is null and that is a ruling rather than a gap: a house does not
 * feed, house and watch somebody for years over an unpleasantness. It would be
 * paying for the privilege of being annoyed. Somebody who gave slight offence
 * is put out and that is the end of it.
 *
 * THE FIGURES. Long enough that a cultivator notices, short enough that they
 * come out with a life. Thirty years is most of a mortal working life and a
 * seventh of a Foundation Establishment one, which is the band this actually
 * lands on: the people worth keeping are the people who have already crossed
 * something. Pinned by test, because a term of years is a decision that lives
 * only as a number.
 */
export const YEARS_OF_A_TERM: Readonly<Record<Severity, number | null>> = Object.freeze({
    slight: null,
    serious: 10,
    grave: 30,
    unforgivable: 60
});

/**
 * The term this house would write for an account of this weight, in years, or
 * null where there is no end to it and null where nothing would be taken.
 *
 * The two nulls mean opposite things and the caller has to know which it has,
 * so {@link isHeldWithoutEnd} says so separately rather than by inspecting this.
 */
export function termOfYearsFor(
    alignment: SectAlignment | null,
    weight: Severity
): number | null {
    if (YEARS_OF_A_TERM[weight] === null) return null;
    return WHY_AN_INDENTURE_IS_TAKEN[alignment ?? 'neutral'].statesATerm
        ? YEARS_OF_A_TERM[weight]
        : null;
}

/** True where the house writes no end date into the oath. */
export function isHeldWithoutEnd(alignment: SectAlignment | null): boolean {
    return !WHY_AN_INDENTURE_IS_TAKEN[alignment ?? 'neutral'].statesATerm;
}

/** True where the weight is too light for anybody to be worth taking at all. */
export function tooLightToBeWorthTaking(weight: Severity): boolean {
    return YEARS_OF_A_TERM[weight] === null;
}

// ─────────────────────────────────────────────────────────────────────────
// WHO WITNESSES IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The oathwright house, and the reason two indentures identical on paper are
 * not the same arrangement.
 *
 * An unwitnessed contract binds nobody - `beasts.ts` says so about a beast
 * contract and it is the same law here. Who signed it is therefore a real fact
 * about the oath, and the premier oathwright is not universally available: a
 * founding oath forbids the House of the Bound Word from witnessing for the
 * Severed, which it has honoured at the cost of a fortune it can see and cannot
 * touch (`faction-character.ts`, its own stated grievance).
 *
 * So a house that cannot get the best witness uses a lesser one, and the person
 * held under that oath is held by something correspondingly easier to argue
 * with. Nothing here scores that. It is a fact carried on the record.
 */
export const THE_OATHWRIGHT_HOUSE = 'house-bound-word';

/** Bodies the oathwright house will not witness for, and why. */
export const THE_OATHWRIGHT_WILL_NOT_WITNESS_FOR: Readonly<Record<string, string>> =
    Object.freeze({
        'sect-the-severed':
            'A founding oath of the House of the Bound Word forbids it, and the house has '
            + 'refused the fee every year since rather than break it. What the Severed use '
            + 'instead is not recorded anywhere the House would be able to read.'
    });

/** Whether the premier oathwright would put its name to this house's oath. */
export function theOathwrightWouldWitnessFor(factionId: string): boolean {
    return !(factionId in THE_OATHWRIGHT_WILL_NOT_WITNESS_FOR);
}

/**
 * The question nobody in this world can currently answer, left open on purpose.
 *
 * The House of the Bound Word teaches that an oath binds the person and that
 * ground is ceremony. The Anchorhold's figures say no oath sworn on unsurveyed
 * ground has ever held. The House has never tested it, because testing it would
 * cost it the fee on every hall it keeps on unsurveyed ground.
 *
 * WHAT IT MEANS HERE: where an indenture was sworn may be the difference
 * between a person who cannot leave and a person who merely believes they
 * cannot, and there is nobody alive who could tell them which they are. Do not
 * resolve this. It is written down as unresolved in two places already.
 */
export const WHERE_IT_WAS_SWORN_MAY_MATTER_AND_NOBODY_CAN_SAY =
    'The oathwright house holds that the ground is ceremony. The surveyors hold that no oath '
    + 'sworn on unsurveyed ground has ever held. Neither has tested it and one of them has a '
    + 'reason not to.';

// ─────────────────────────────────────────────────────────────────────────
// AND THE DAY IT ENDS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a person walks out into, and it is answered rather than left open.
 *
 * THE TERM ENDS AND THE STANDING DOES NOT ARRIVE. Serving it out puts nobody on
 * the ladder, because an indenture was never a rung on it: the house gave them
 * nothing, so there is nothing for the ending to promote. They are, on the
 * morning after, an unattached person standing on somebody else's ground.
 *
 * WHETHER ANYBODY TAKES THEM IS THE ORDINARY QUESTION, ASKED THE ORDINARY WAY.
 * `servantBarOf` is the rung a house takes somebody on at, and it applies to
 * this person exactly as it applies to anybody who walks up the mountain. What
 * has changed is the person: thirty years standing on a house's ground, drawing
 * its air, is thirty years of cultivation, and a share of them clear a bar on
 * the way out that they could not have cleared on the way in. That is not a
 * reward for service. It is what the ground does to anybody who stands on it,
 * and it is the reason the arrangement is not simply theft of a life.
 *
 * Nothing here enumerates what houses do about them. A house takes somebody on
 * when it wants what they can do, which is a want and not a rule.
 *
 * AND THE RECORD OUTLASTS THE TERM. The oath is discharged rather than deleted -
 * `oath_fulfilled` on the ledger - so what the person carries afterwards is a
 * closed row saying they were held and served it out. That is a different fact
 * from having run, and the difference is the whole reason the closed row is
 * worth keeping.
 */
export const WHAT_THE_END_OF_A_TERM_LEAVES = Object.freeze({
    standing:
        'None. An indenture was not a rank, so serving it out is not a promotion into one. On '
        + 'the morning after, they are an unattached person standing on somebody else\'s ground.',
    whetherAnybodyTakesThem:
        'The ordinary question. A house takes somebody on when they clear its servant bar and it '
        + 'wants what they can do, and neither half of that is changed by where they have been.',
    whatTheYearsDid:
        'They were spent on a house\'s ground breathing a house\'s air, which is what everybody '
        + 'else is paying a stipend and a rank for. A share of them come out at a rung they could '
        + 'not have reached outside, and the house that held them knows it.',
    theRecord:
        'The oath is closed rather than removed. What they carry is a discharged term, which says '
        + 'they were held and did not run, and is worth what the house that witnessed it is worth.'
});

/**
 * What running from it costs, in one line, pointing at the thing that prices it.
 *
 * Nothing in this file prevents leaving and nothing anywhere else does either.
 * `whatWalkingOutOfItCosts` already writes both records - the account the oath
 * was closing reopens, and a second one opens naming the person - and the
 * witnessing house's enforcement is structural rather than punitive: removing
 * the oath removes some of the person.
 */
export const WHAT_RUNNING_COSTS =
    'The oath does not stop anybody walking. What it does is make walking a broken word with a '
    + 'named holder, a witnessing house and a penalty clause that is structural rather than '
    + 'punitive - and the account the term was closing is open again besides.';
