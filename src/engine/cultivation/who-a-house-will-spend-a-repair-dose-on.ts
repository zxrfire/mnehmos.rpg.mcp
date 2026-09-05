/**
 * The standard a house applies when somebody in it cracks.
 */

import { brokenStatusKeyOf } from './what-goes-wrong-at-a-realm-boundary.js';

// THE STANDARD

export type RepairClaim = 'blood' | 'chosen' | 'sunk_cost' | 'none';

/**
 * How many people a house may hold as chosen at one time.
 */
export const CHOSEN_PER_HOUSE = 3;

/**
 * Years of a house's own investment that make somebody worth finishing.
 */
export const SUNK_COST_YEARS = 100;

/**
 * What a house knows about somebody standing in front of it, broken.
 */
export interface RepairCandidate {
    id: string;
    /** The rung they are standing at, carrying the break. */
    realmOrdinal: number;
    /** The structural break. Anything else is not this decision. */
    woundKey: string | null;
    /** The house being asked, or null where there is nobody to ask. */
    houseId: string | null;
    /** On the house's own roll at all. An outsider is not a candidate. */
    onTheHouseRoll: boolean;
    /** Blood of somebody senior in the house - a child, a grandchild. */
    kinOfSomebodyWhoMatters: boolean;
    /** Formally one of the house's chosen. At most `CHOSEN_PER_HOUSE` are. */
    chosenOfTheHouse: boolean;
    /** Years the house has already put into them. */
    yearsTheHouseHasSpent: number;
}

export interface RepairDecision {
    claim: RepairClaim;
    /** Whether the standard is met. The house still has to have a dose. */
    meetsTheStandard: boolean;
    /** What the house would actually say, which is rarely the whole reason. */
    because: string;
}

/**
 * Whether this person clears the bar, and on what ground.
 */
export function willTheHouseSpendOnThem(candidate: RepairCandidate): RepairDecision {
    if (brokenStatusKeyOf(candidate.woundKey) === null) {
        return {
            claim: 'none',
            meetsTheStandard: false,
            because: 'Nothing here is structural. Whatever is wrong with this person is a matter for the infirmary and the ordinary pharmacopoeia, and a house that spent a dose on it would have wasted it.'
        };
    }
    if (!candidate.houseId || !candidate.onTheHouseRoll) {
        return {
            claim: 'none',
            meetsTheStandard: false,
            because: 'Not ours. There is no figure attached to this refusal and no counter-offer that changes it - the medicine is not sold, it is spent, and it is spent on the house\'s own. Somebody standing outside a house with a broken structure is not being outbid; they are outside the question.'
        };
    }
    if (candidate.kinOfSomebodyWhoMatters) {
        return {
            claim: 'blood',
            meetsTheStandard: true,
            because: 'Blood. The house does not debate this one and does not minute the debate it did not have, which is why the grant books read so thin on exactly these entries.'
        };
    }
    if (candidate.chosenOfTheHouse) {
        return {
            claim: 'chosen',
            meetsTheStandard: true,
            because: 'The house has been building this person for decades and a broken structure is that spending failing rather than that person failing. Mending them is mending the investment, and everybody in the room can say so out loud, which is precisely what makes this claim easier to grant than blood and easier to argue about afterwards.'
        };
    }
    if (candidate.yearsTheHouseHasSpent >= SUNK_COST_YEARS) {
        return {
            claim: 'sunk_cost',
            meetsTheStandard: true,
            because: 'A century of somebody being useful is itself an argument, and it is the only argument in this list available to a person who arrived with nothing. It is also the one most often lost, because the elder making it is asking the house to spend on somebody nobody in the room is related to.'
        };
    }
    return {
        claim: 'none',
        meetsTheStandard: false,
        because: 'On the roll, and not near enough to anything. This is the ordinary answer and it is given kindly: they keep their place, their rung and their students, and they are told plainly that the box will not be opened for them. Most of the broken in this world are told exactly this.'
    };
}

/**
 * The chosen of a house, off its own roll.
 */
export function chosenOf<T extends { id: string; realmOrdinal: number }>(
    roll: readonly T[],
    elderFloor: number
): T[] {
    return roll
        .filter(m => m.realmOrdinal < elderFloor)
        .slice()
        .sort((a, b) => b.realmOrdinal - a.realmOrdinal || a.id.localeCompare(b.id))
        .slice(0, CHOSEN_PER_HOUSE);
}
