/**
 * What a house does about a manoeuvre run on one of its own, and what it does
 * about one of its own running one.
 *
 * THE ATTEMPT IS NOT GATED. THIS IS WHERE THE DIFFERENCE LIVES.
 * -----------------------------------------------------------
 * The design owner's ruling, and it is the load-bearing sentence for this
 * whole directory: *"obviously charm works anywhere, the fallout just hits
 * different."* So `an-attempt-to-move-somebody.ts` reads no faction and no
 * alignment at all - a righteous elder, a demonic cultivator and a free-port
 * factor are resolved by the same function against the same terms, and there
 * is no house anywhere in this world where somebody cannot be asked.
 *
 * Everything that varies is downstream and is in this file: who finds out,
 * what they call it, whether it opens a grudge and how heavy, and whether the
 * person's own house treats them as a victim, an embarrassment or a liability.
 *
 * TWO QUESTIONS, AND THEY ARE ALLOWED TO DISAGREE
 * -----------------------------------------------
 * A house that would refuse to do this to somebody still has to decide what
 * it does when it is done to one of its own, and those two answers need not
 * match. That mismatch is more interesting than either answer alone, so they
 * are two functions rather than one alignment table.
 *
 *   WILL IT BACK YOU RUNNING ONE          {@link willTheHouseBackThis}
 *   WHAT DOES IT DO WHEN IT IS DONE TO
 *   SOMEBODY OF ITS OWN                   {@link whenItIsDoneToOneOfOurs}
 *
 * The shape is `ifCaughtPractising` in `world/manuals.ts`, deliberately: one
 * rule keyed on alignment turning into three quite different situations with
 * no branch on any faction's name. Nothing here is bespoke to a house. Take
 * the alignment column away and this file has nothing to say, which is the
 * test AGENTS.md sets for whether a piece of lore is a real system.
 *
 * WHY A RIGHTEOUS HOUSE REFUSING IS NOT A MORAL GESTURE
 * ----------------------------------------------------
 * It is a rule with a price attached, and the price is what makes it play. A
 * righteous cultivator running an instrumental attachment is doing it WITHOUT
 * their house: no leverage supplied, nobody to take a refusal to, and a second
 * exposure waiting if their own people ever work out what they did. They can
 * still do it. It is simply more expensive for them than for somebody at a
 * house that would have handed them the money.
 *
 * And the demonic answer is the ugly one on purpose. A demonic house does not
 * avenge a member who was worked; it prices them. Somebody who was moved and
 * did not notice has demonstrated something about themselves, and the house's
 * answer lands on THEM. It is the reason a demonic house is dangerous to
 * belong to and not only to cross.
 *
 * Pure lookup. No state, no rolls, no I/O.
 */

import type { ApproachLeverage, SectAlignment } from '../../schema/cultivation.js';
import type { Severity } from '../social/grudges.js';
import type { AskWeight } from './an-attempt-to-move-somebody.js';

// ─────────────────────────────────────────────────────────────────────────
// WILL YOUR HOUSE BACK YOU
// ─────────────────────────────────────────────────────────────────────────

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
 *
 * Keyed on WHAT IS ON THE TABLE, never on the verb. The channels a house
 * objects to are the ones that use a person as the instrument - an attachment
 * spent on an ask, and a held secret - and not the ones that spend a thing.
 * Coin is coin at every house in the world.
 */
export function willTheHouseBackThis(
    alignment: SectAlignment | null,
    leverage: ApproachLeverage,
    ask: AskWeight
): HouseBacking {
    // No house, no position. A wanderer answers to nobody, which is most of
    // what being a wanderer is worth.
    if (alignment === null) return 'tolerated';

    const usesAPerson = leverage === 'attachment' || leverage === 'secret';
    const heavy = ask === 'against_their_interest' || ask === 'a_betrayal';

    switch (alignment) {
        case 'demonic':
            // Nothing is off the table, and a heavy ask run on a person is the
            // method the house is best at. It will fund it.
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

// ─────────────────────────────────────────────────────────────────────────
// WHEN IT IS DONE TO SOMEBODY OF OURS
// ─────────────────────────────────────────────────────────────────────────

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
     * business until the peace is affected - the free port's answer, and the
     * answer of any body with no interest in what its people do at home.
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
 *
 * `known` is the gate and it is not automatic: a manoeuvre nobody worked out
 * produces no verdict at all, which is why the discovery module and this one
 * are separate. `ranked` matters because a house has an interest in what
 * happens to the people it has invested in and very little in what happens to
 * the people it pays by the season.
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
 *
 * This is not a recalculation and `grudges.ts` is not being violated: severity
 * is still decided once, at the moment the record is created, by whoever
 * creates it. This is that decision, made in one place so two callers cannot
 * make it differently.
 */
export function severityWithHouse(
    personal: Severity,
    floor: Severity | null
): Severity {
    if (floor === null) return personal;
    const order: readonly Severity[] = ['slight', 'serious', 'grave', 'unforgivable'];
    return order.indexOf(floor) > order.indexOf(personal) ? floor : personal;
}
