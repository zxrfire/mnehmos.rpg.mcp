/**
 * What an indenture is, what the years are for, and what a person walks out into on
 * the day the term is served.
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
 */
export const YEARS_OF_A_TERM: Readonly<Record<Severity, number | null>> = Object.freeze({
    slight: null,
    serious: 10,
    grave: 30,
    unforgivable: 60
});

/**
 * The term this house would write for an account of this weight, in years, or null
 * where there is no end to it and null where nothing would be taken.
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
 * The oathwright house, and the reason two indentures identical on paper are not
 * the same arrangement.
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
 */
export const WHAT_RUNNING_COSTS =
    'The oath does not stop anybody walking. What it does is make walking a broken word with a '
    + 'named holder, a witnessing house and a penalty clause that is structural rather than '
    + 'punitive - and the account the term was closing is open again besides.';
