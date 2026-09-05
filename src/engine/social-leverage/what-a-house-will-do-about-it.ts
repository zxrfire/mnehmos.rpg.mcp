/**
 * What a house does about a manoeuvre run on one of its own, and what it does about
 * one of its own running one.
 */

import type { ApproachLeverage, SectAlignment } from '../../schema/cultivation.js';
import type { Severity } from '../social/grudges.js';
import type { AskWeight } from './an-attempt-to-move-somebody.js';

export type HouseBacking =
    /** It supplies the leverage and may have set the task. */
    | 'supplied'
    /** It knows and does not object. The cost is yours; so is the return. */
    | 'tolerated'
    /**
     * It has a rule against this one. You may still do it, alone, and the
     * house finding out is a second exposure on top of the first.
     */
    | 'forbidden'
    /** It will do it if the return covers the exposure, and it prices both. */
    | 'priced';

/**
 * Whether the actor's own house stands behind the method they are using.
 */
export function willTheHouseBackThis(
    alignment: SectAlignment | null,
    leverage: ApproachLeverage,
    ask: AskWeight
): HouseBacking {
    // No house, no position. A wanderer answers to nobody.
    if (alignment === null) return 'tolerated';

    const usesAPerson = leverage === 'attachment' || leverage === 'secret';
    const heavy = ask === 'against_their_interest' || ask === 'a_betrayal';

    switch (alignment) {
        case 'demonic':
            // A heavy ask run on a person is the method the house is best at.
            return usesAPerson && heavy ? 'supplied' : 'tolerated';
        case 'righteous':
            // The objection is to the instrument, not to the ambition. A
            // righteous house will back a purse, a name and its own weight all
            // day, and will not put its hand to the other two.
            return usesAPerson ? 'forbidden' : 'tolerated';
        default:
            return usesAPerson ? 'priced' : 'tolerated';
    }
}

export type HouseResponse =
    /**
     * The house takes it up. The account stops being personal: the actor is a
     * name on a list, and the house is now a party to it.
     */
    | 'taken_up'
    /**
     * The house prices the member instead. They were moved and did not notice,
     * and that is information about them. The grudge stays theirs alone and
     * they carry a demotion besides.
     */
    | 'the_member_is_priced'
    /**
     * The exposure becomes leverage the house now holds over the actor. Not
     * vengeance - a debt.
     */
    | 'collected'
    /**
     * Nothing institutional. Somebody's private business is somebody's private
     * business until the peace is affected.
     */
    | 'none';

/** What the house calls it, in the words it would use. Factual, not narration. */
export interface HouseVerdict {
    response: HouseResponse;
    /**
     * Whether the grudge the aggrieved party opens should carry the house on
     * its `participants`, which is what makes it findable from the house's
     * side two centuries later.
     */
    houseIsAParty: boolean;
    /**
     * Severity floor the house's involvement imposes, or null when it imposes
     * none. A house taking something up is what turns a private injury into a
     * durable one; `grudges.ts` still writes severity exactly once.
     */
    severityFloor: Severity | null;
    /** One factual line for the mechanical channel. */
    note: string;
}

/**
 * What the subject's house does, once it knows.
 */
export function whenItIsDoneToOneOfOurs(input: {
    alignment: SectAlignment | null;
    /** Does the subject hold a rank the house cares about. */
    ranked: boolean;
    /** Did the manoeuvre reach an attachment, or only a transaction. */
    wasAnAttachment: boolean;
    ask: AskWeight;
}): HouseVerdict {
    const heavy = input.ask === 'against_their_interest' || input.ask === 'a_betrayal';

    if (input.alignment === null || !input.ranked) {
        return {
            response: 'none',
            houseIsAParty: false,
            severityFloor: null,
            note: input.alignment === null
                ? 'No house to take it anywhere. The account stays between the two of them.'
                : 'Not somebody the house has anything invested in. It stays personal.'
        };
    }

    switch (input.alignment) {
        case 'righteous':
            return {
                response: 'taken_up',
                houseIsAParty: true,
                // A righteous house treats one of its own being worked as a
                // wrong done to the house. That is what makes it durable.
                severityFloor: heavy ? 'grave' : 'serious',
                note:
                    'The house takes it up. What was one person\'s account is now the ' +
                    'house\'s, and the name is written down somewhere it will be read again.'
            };
        case 'demonic':
            return {
                response: 'the_member_is_priced',
                houseIsAParty: false,
                severityFloor: null,
                note:
                    'The house does not avenge it. Somebody who was moved and did not ' +
                    'notice has said something about themselves, and what the house does ' +
                    'about it lands on them. The account stays theirs alone, and they are ' +
                    'carrying it from lower down than they were.'
            };
        default:
            return {
                response: 'collected',
                houseIsAParty: true,
                severityFloor: input.wasAnAttachment && heavy ? 'serious' : null,
                note:
                    'The house does not take a side. It writes down what was done and who ' +
                    'did it, and that is a thing it now holds rather than a thing it will act on.'
            };
    }
}

/**
 * The severity a record should be written at, given the aggrieved party's own
 * reading and whatever floor their house imposes.
 */
export function severityWithHouse(
    personal: Severity,
    floor: Severity | null
): Severity {
    if (floor === null) return personal;
    const order: readonly Severity[] = ['slight', 'serious', 'grave', 'unforgivable'];
    return order.indexOf(floor) > order.indexOf(personal) ? floor : personal;
}
