/**
 * What the ground under two people does to whether one moves the other. The design
 * owner: *"the trust system, it should also depend on WHERE YOU ARE. a righteous
 * sect's town is much easier for you to trust in than a demonic sect town."*
 */

import type { WhoHoldsThisGround } from '../world/ground-holder.js';
import type { AreaStatus } from '../world/what-is-true-of-a-place-right-now.js';
import type { ApproachLeverage } from '../../schema/cultivation.js';
import type { AskWeight } from './an-attempt-to-move-somebody.js';
import { whenItIsDoneToOneOfOurs, type HouseResponse } from './what-a-house-will-do-about-it.js';

/**
 * What happens here when somebody is wronged. {@link HouseResponse} answers it
 * for held ground; the two rows beside it are the ones no house can answer.
 * One field and not two, because the caller has one question and a reading that
 * answered it twice would need a rule for which answer wins.
 */
export type GroundRecourse =
    | HouseResponse
    /**
     * Nobody's name is against this ground, and the province around it has a
     * survey, a bench and a register. A complaint has somewhere to go and
     * nothing obliges anybody to hear it.
     */
    | 'unheld_inside_a_province'
    /**
     * The record does not say. Not a vacuum - an absence of record, over
     * ground somebody may well hold, among people who probably know who.
     */
    | 'the_record_does_not_say';

export interface TheGroundUnderYou {
    /** What happens here when somebody is wronged. The whole of the axis. */
    recourse: GroundRecourse;
    placeName: string | null;
    holderName: string | null;
    /** True when something the world had to write down is running here. */
    underDuress: boolean;
    /** Why, in the words a refusal would use. The player is owed the route. */
    why: string;
}

/**
 * What is running here that bites. Three properties and NEVER a `kind`: that
 * field is free-form content and nothing may branch on it. A tenth kind of
 * trouble needs no code here.
 */
function bites(status: AreaStatus): boolean {
    return status.stops.length > 0 || status.priceMultiplier > 1 || status.dangerDelta > 0;
}

/**
 * The ground, read for what it does to being believed. `statuses` is whatever is
 * RUNNING today: this file does not date-filter, because deciding what is current
 * is `statusesInArea`'s job and doing it twice is how two clocks drift. Counted
 * once however many are running - a town with three troubles is a town in trouble,
 * not three times as suspicious.
 */
export function theGroundUnderYou(
    holding: WhoHoldsThisGround,
    statuses: readonly AreaStatus[] = []
): TheGroundUnderYou {
    const recourse = whatThereIsToTakeItTo(holding);
    const underDuress = statuses.some(bites);

    return {
        recourse,
        placeName: holding.placeName,
        holderName: holding.holderName,
        underDuress,
        why: `${holding.why} ${WHAT_THAT_MEANS_FOR_A_STRANGER[recourse]}`
            + (underDuress
                ? ' And the place is having a bad year, which is not when anybody here is at '
                  + 'their most trusting.'
                : '')
    };
}

/**
 * Which of the six answers this ground gives. The FOUR `GroundHolding` readings
 * are not interchangeable and must not collapse onto `none`: `unrecorded` is a
 * gap in the paper, not a vacuum in the world.
 */
function whatThereIsToTakeItTo(holding: WhoHoldsThisGround): GroundRecourse {
    switch (holding.holding) {
        case 'held':
            // A holder the sect catalog cannot place is still a holder. Do not
            // let a null alignment fall through to `whenItIsDoneToOneOfOurs`,
            // which answers `none` - the vacuum - for it.
            if (holding.alignment === null) return 'the_record_does_not_say';
            // `ranked` is true by construction: a house that holds ground has
            // something invested in it.
            return whenItIsDoneToOneOfOurs({
                alignment: holding.alignment,
                ranked: true,
                wasAnAttachment: false,
                ask: 'a_real_favour'
            }).response;
        case 'no_holder_of_record':
            return 'unheld_inside_a_province';
        case 'no_authority':
            return 'none';
        case 'unrecorded':
            return 'the_record_does_not_say';
    }
}

/** What each answer means for a stranger. Keyed on the response, never on an alignment. */
const WHAT_THAT_MEANS_FOR_A_STRANGER: Readonly<Record<GroundRecourse, string>> = {
    taken_up:
        'Somebody answers for what is done here, which is the whole of why a stranger gets '
        + 'the benefit of the doubt: lying to you would cost the liar something.',
    collected:
        'Whoever holds this writes down what happens on it and takes nobody\'s side, so a '
        + 'stranger is neither vouched for nor suspected.',
    the_member_is_priced:
        'The house that holds this does not answer for its own people when they are taken '
        + 'in, so it certainly does not answer for you. Being had here is your own failure '
        + 'and everybody knows it, which is why nobody takes a stranger\'s word.',
    unheld_inside_a_province:
        'There is nobody here who answers for the ground itself. The province around it keeps '
        + 'a survey, a bench and a register, and whoever keeps this place working was never '
        + 'appointed to and would rather it went on working - so a complaint has somewhere to '
        + 'go and nothing at all obliges anybody to hear it, which leaves a stranger neither '
        + 'vouched for nor written off.',
    the_record_does_not_say:
        'What is open is what would actually happen to somebody who lied to you here, and that '
        + 'is a gap in the paper rather than a hole in the world - the people standing on this '
        + 'ground would be able to tell you. So it says nothing about a stranger in either '
        + 'direction, and a word is worth what the person saying it is worth.',
    none:
        'Nobody answers for anything here. There is no house to complain to, nothing anybody '
        + 'could be made to pay, and a stranger\'s word is worth exactly what it can be '
        + 'checked against, which is nothing.'
};

/**
 * The most the ground can ever be worth. Under `PER_RUNG * RUNG_CLAMP` (0.30),
 * `TIE_WEIGHT` (0.30), `PURSE_MAX` (0.20) and `DISPOSITION_MAX` (0.18). One
 * number for both readings on purpose: two caps would be two designs.
 */
export const GROUND_MAX = 0.12;

/** What a place in trouble costs a stranger, on top of whatever the ground is. */
export const GROUND_UNDER_DURESS = 0.05;

/**
 * How much recourse there is, on -1..+1. ORDERED by how much of an address there is
 * that can be made to answer, which is the catalog's own argument: a demonic house
 * that will not avenge its own still beats a vacuum, because it keeps a fixed
 * address and can be arbitrated against. Unheld ground is the floor, not demonic
 * ground.
 */
const RECOURSE: Readonly<Record<GroundRecourse, number>> = {
    taken_up: 1,
    collected: 0.25,
    the_record_does_not_say: 0,
    unheld_inside_a_province: -0.25,
    the_member_is_priced: -0.6,
    none: -1
};

/**
 * The same axis, read for what it means to the TARGET. The design owner: *"I agree,
 * the more lawless somewhere is, the more credible the threat."*
 */
const RECOURSE_AGAINST_A_THREAT: Readonly<Record<GroundRecourse, number>> = {
    taken_up: -1,
    collected: -0.25,
    the_member_is_priced: -0.2,
    the_record_does_not_say: 0,
    unheld_inside_a_province: 0.15,
    none: 1
};

/**
 * Whether what is on the table is a promise of harm. Keys on the LEVERAGE and never
 * on a verb, so a verb added tomorrow gets this with no code.
 */
function isAPromiseOfHarm(leverage: ApproachLeverage | undefined): boolean {
    return leverage === 'force';
}

/**
 * How far the ground reaches into what is being asked. Same kind of table as
 * `PURSE_REACH` and `DISPOSITION_REACH`. Never zero at the far end, because
 * "typically does not" is not "never".
 */
const GROUND_REACH: Readonly<Record<AskWeight, number>> = {
    a_courtesy: 1,
    a_real_favour: 1,
    against_their_interest: 0.5,
    a_betrayal: 0.2
};

function clamp(n: number, lo: number, hi: number): number {
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}

/** What the ground is worth to this attempt, as odds. Exported so a probe can
 * price the term without resolving an attempt. */
export function groundWeight(input: {
    ground: TheGroundUnderYou | null | undefined;
    ask: AskWeight;
    /**
     * How strong the SUBJECT's existing view of the asker is, 0..1. The damper,
     * and it applies to TRUST ONLY: a friend on ground nobody holds is exactly
     * as unanswerable for as a stranger on it.
     */
    theirTieStrength?: number;
    /** The discriminator, and it is the leverage rather than the verb. */
    leverage?: ApproachLeverage;
}): number {
    if (!input.ground) return 0;
    const threat = isAPromiseOfHarm(input.leverage);
    const reach = GROUND_REACH[input.ask];
    const stranger = threat ? 1 : 1 - clamp(input.theirTieStrength ?? 0, 0, 1);
    const recourse = (threat ? RECOURSE_AGAINST_A_THREAT : RECOURSE)[input.ground.recourse]
        * GROUND_MAX;
    // Off what the ground is worth to the ASKER in BOTH readings, which for a
    // threat means it comes off a positive number.
    const duress = input.ground.underDuress ? -GROUND_UNDER_DURESS : 0;
    const worth = clamp(
        (recourse + duress) * reach * stranger,
        -(GROUND_MAX + GROUND_UNDER_DURESS),
        GROUND_MAX
    );
    // Do not simplify away: a damped term reaches negative zero, and this number
    // is printed. "-0 points" in the mechanical channel reads as a defect.
    return worth === 0 ? 0 : worth;
}


/** Exported so a probe can print the bars without restating them. */
export const GROUND_CONSTANTS = Object.freeze({
    GROUND_MAX,
    GROUND_UNDER_DURESS,
    RECOURSE,
    RECOURSE_AGAINST_A_THREAT,
    GROUND_REACH
});
