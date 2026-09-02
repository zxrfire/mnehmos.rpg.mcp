/**
 * The standard a house applies when somebody in it cracks.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS IS A RULE, NOT A STORY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every rescue in this world is a decision somebody made, and it is tempting to
 * write each one as a scene. That would be bespoke, and it would be wrong. A
 * house has a standard for who is worth a dose, it applies that standard to its
 * own people, and who gets mended falls out of it. The drama is in the standard
 * being what it is, not in anybody's judgement on the day.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BAR SITS ABOVE WHERE A COMMONER CAN EVER BE - BY CONSTRUCTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This is the load-bearing part and it is not a matter of degree. The standard
 * is defined in terms of things a commoner does not have: blood in the house,
 * a place among its chosen, or decades of the house's own investment already
 * sunk into them. There is no branch here on wealth, and there is deliberately
 * no path where saving enough, arriving with enough, or being sufficiently
 * remarkable gets an outsider a dose.
 *
 * So a commoner who cracks is NOT a buyer who cannot meet the price. They are
 * outside the market entirely: the object is not sold to them at any figure,
 * because it is not sold at all - it is spent by houses on their own. That
 * distinction is the whole design, and a version of this file with a
 * `couldAfford` branch in it would quietly destroy it.
 *
 * The population consequence is the point and should be allowed to stand: the
 * provinces are full of people who cracked at a wall, stopped, and lived out
 * whatever the rung granted them without anybody ever considering the question.
 * For a great many of them "living with it" means dying at that wall, because
 * the road is shut and there is no further crossing to buy more span with.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE CLAIMS, AND THE THIRD IS THE INTERESTING ONE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   BLOOD        a child or grandchild of somebody who matters in the house.
 *                The obvious case and the commonest. This is the concrete
 *                mechanism behind the advantage of birth: a well-born child who
 *                cracks is mended and goes on, and everybody else stops.
 *
 *   CHOSEN       the house's favoured disciple. An institutional reason rather
 *                than a familial one - a chosen who cracks is the house's own
 *                investment failing, and mending them is mending what the house
 *                has spent decades building. It makes rescue not purely
 *                hereditary, and it produces a different debt: the disciple owes
 *                the house rather than a grandfather.
 *
 *                Note the compounding. A chosen is already the person a house
 *                has been pouring resources into - the good manuals, the
 *                materials, a teacher's attention - so the same people most
 *                likely to be handed a deep road are the people most likely to
 *                be mended if that road breaks them. That is consistent with
 *                everything else the setting says about backing, and it is why
 *                adding this claim does not meaningfully widen the rescuable
 *                class: {@link CHOSEN_PER_HOUSE} is small, on purpose.
 *
 *   SUNK COST    somebody the house has already spent so long on that stopping
 *                now wastes the spending. Weakest of the three, requires the
 *                longest history, and is how an unremarkable birth occasionally
 *                gets over the bar - after a century of being useful.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND THE HOUSE MUST ACTUALLY HAVE ONE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two independent scarcities, and both are required. This file is the second
 * one; `who-holds-the-structural-repair-medicine.ts` is the first. A dose
 * existing somewhere in the world does nothing whatsoever for somebody standing
 * in front of a house that does not have one, and the great majority of houses
 * do not.
 *
 * Pure. Facts in, a decision out. Nothing here reads the world or rolls.
 */

import { brokenStatusKeyOf } from './what-goes-wrong-at-a-realm-boundary.js';

// ─────────────────────────────────────────────────────────────────────────
// THE STANDARD
// ─────────────────────────────────────────────────────────────────────────

export type RepairClaim = 'blood' | 'chosen' | 'sunk_cost' | 'none';

/**
 * How many people a house may hold as chosen at one time.
 *
 * Three. A house with more chosen than it could ever have doses is not
 * choosing, it is labelling - and the label is what makes the claim mean
 * anything. This is the whole of what keeps the second rescue route from
 * widening the rescuable class.
 */
export const CHOSEN_PER_HOUSE = 3;

/**
 * Years of a house's own investment that make somebody worth finishing.
 *
 * A century, which is longer than a Qi Condensation lifespan and roughly half a
 * Foundation Establishment one. The point is that this route is not available
 * to anybody young, so it never becomes the ordinary path - it is how a house
 * occasionally mends somebody it has simply had for a very long time.
 */
export const SUNK_COST_YEARS = 100;

/**
 * What a house knows about somebody standing in front of it, broken.
 *
 * Deliberately small and deliberately all facts a house's own records would
 * hold. There is no field here for merit, promise, or how much the elders like
 * them, because a standard built on those is a standard nobody can apply twice
 * the same way.
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
 *
 * Ordered strongest claim first, because a house that could justify a dose two
 * ways records the stronger one - which matters two centuries later when
 * somebody reads the grant book and wants to know whether the house was
 * looking after its own blood or its own investment.
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
 *
 * The strongest few who are not its elders, capped at {@link CHOSEN_PER_HOUSE}.
 * A derivation rather than a field, so a house cannot acquire more chosen by
 * somebody writing more of them down, and so this stays in step with whatever
 * the roll actually holds.
 *
 * `elderFloor` is the rung at which somebody stops being a prospect and starts
 * being the establishment. Callers pass the house's own figure.
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
