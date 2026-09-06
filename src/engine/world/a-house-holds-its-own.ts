/**
 * A HOUSE HOLDS ITS OWN, AND IT IS NOT ANYBODY'S POCKET.
 *
 * The design owner: *"ensure each sect has their own treasury of items and
 * spirit stones, separate from people's own stuff."*
 *
 * ── WHAT WAS THERE BEFORE, WHICH WAS NOT A TREASURY ──────────────────────
 *
 * The reserves a player can siphon from were a FORMULA and a per-thief counter.
 * `baseReservesFor(sect.stipend)` multiplies the whole payroll by a hundred and
 * forty-four months and returns a number; the only state anywhere was a flag on
 * the CULTIVATOR saying how much that particular person had taken. So:
 *
 *   - Two members could each drain the reserves in full, separately, and
 *     neither would find the other had been there.
 *   - Nothing the house ever earned, was paid, inherited or was robbed of
 *     changed the figure, because the figure was arithmetic on the payroll.
 *   - A house held no THINGS at all. The one possessions table has rows owned
 *     by factions, and nothing anywhere could answer *what does this house
 *     have*.
 *
 * ── AND IT IS ONE STORE, WHICH IS THE POINT ──────────────────────────────
 *
 * A treasury is a place, not a per-person allowance. Everything that touches
 * it - a stipend paid out, a donation in, a siphon, a war indemnity, the cost
 * of putting a hall back up - moves the SAME number, so a house that has been
 * bled cannot pay its people and a house that has just been paid can rebuild.
 * That is what makes any of the rest of it mean anything.
 *
 * ── WHAT SEEDS IT, SO NOTHING CHANGES ON THE DAY THIS LANDS ──────────────
 *
 * `baseReservesFor` stays, and becomes the OPENING BALANCE rather than a
 * standing answer. A house that has never been touched holds exactly what the
 * old formula said it held, so no existing balance moves and every existing
 * test about siphoning still describes the same world. What changes is that the
 * number is now somewhere, and can go down.
 */

import type { AcquisitionMode } from './possessions.js';

/** What a house is holding, at a moment. */
export interface WhatAHouseHolds {
    factionId: string;
    /** The house's own stones. Never a member's. */
    stones: number;
    /**
     * Ids of the things it owns, as `state.objects` files them.
     *
     * Ids rather than rows, because the one possessions table is the record and
     * a second copy of an object here is the mistake `items.md` names. This
     * says WHICH are the house's; the rows say what they are and where they
     * have been.
     */
    holds: readonly string[];
}

/** A movement of stones, and what it was for. */
export type WhyItMoved =
    | 'stipend'
    | 'donation'
    | 'siphoned'
    | 'rebuilding'
    | 'indemnity'
    | 'upkeep';

export interface WhatTheMovementDid {
    before: number;
    after: number;
    /** What actually moved, which is not what was asked for when short. */
    moved: number;
    /** True where the house did not have it and the movement was cut short. */
    cameUpShort: boolean;
    why: WhyItMoved;
    account: string;
}

/**
 * Take from a house, never past empty.
 *
 * A house cannot be overdrawn: there is no credit in this world and a treasury
 * at zero is a house that cannot pay, which is a real and interesting state
 * rather than a negative number. What a caller does about the shortfall is the
 * caller's business, and `cameUpShort` is how it finds out.
 */
export function takeFromTheHouse(
    held: number,
    asked: number,
    why: WhyItMoved
): WhatTheMovementDid {
    const before = Math.max(0, Math.floor(held));
    const wanted = Math.max(0, Math.floor(asked));
    const moved = Math.min(before, wanted);
    return {
        before,
        after: before - moved,
        moved,
        cameUpShort: moved < wanted,
        why,
        account: moved < wanted
            ? `${why}: ${wanted} asked of a treasury holding ${before}. ${moved} moved and the `
              + `house is empty, ${wanted - moved} short.`
            : `${why}: ${moved} out of ${before}, leaving ${before - moved}.`
    };
}

/** Put into a house. The mirror, and there is no ceiling. */
export function putIntoTheHouse(
    held: number,
    paid: number,
    why: WhyItMoved
): WhatTheMovementDid {
    const before = Math.max(0, Math.floor(held));
    const moved = Math.max(0, Math.floor(paid));
    return {
        before,
        after: before + moved,
        moved,
        cameUpShort: false,
        why,
        account: `${why}: ${moved} into a treasury holding ${before}, leaving ${before + moved}.`
    };
}

// ═════════════════════════════════════════════════════════════════════════
// AND WHOSE A THING IS, WHICH IS THREE STATES AND NOT TWO
// ═════════════════════════════════════════════════════════════════════════

/**
 * WHOSE IT IS, over anything a house has ever had its hands on.
 *
 * The design owner, correcting a version of this that had been written for
 * cauldrons: *"a sect may be given too - that's the distinction between the
 * sect treasury and a personal item (perhaps bestowed by the sect). THIS ISN'T
 * BESPOKE. This is true for everything in the sect treasury."*
 *
 * So it is stated once, here, over `ObjectRecord` and not over any particular
 * noun. A lent furnace, a lent manual, a lent sword and a lent token are one
 * fact with four nouns in front of it.
 *
 * ── AND THE FIELDS FOR IT ALREADY EXISTED ────────────────────────────────
 *
 * `possessions.ts` has carried `ownerId` and `possessorId` as SEPARATE fields
 * since it was written, and this is the whole reason it does: a disciple at a
 * house furnace, or reading a house manual, is holding a thing that is not
 * theirs. Nothing needs a loan table and nothing needs a flag. The house's id
 * in `ownerId` and somebody else's in `possessorId` IS the loan.
 *
 * ── WHY THE THIRD STATE IS THE ONE THAT MATTERS ──────────────────────────
 *
 * Bestowed and lent look identical the day they happen and are not the same
 * thing at all, and the difference is the leverage. A house that lent you
 * something can stop lending it, at the moment it would cost you most. A house
 * that GAVE you something has spent it: taking it back is a seizure, which is
 * a thing houses do and is not a thing they can do quietly. Every read of a
 * disciple's standing that treats the two alike is reading a person as richer
 * or freer than they are.
 */
export type WhoseThisIs =
    /** Theirs outright. However it got there, nobody can simply want it back. */
    | 'their_own'
    /** A house owns it and nobody has it out. */
    | 'in_a_treasury'
    /** A house owns it, somebody else holds it, and the house handed it over. */
    | 'lent_by_their_house'
    /** A house owns it, somebody else holds it, and the house did not. */
    | 'taken_from_their_house'
    /**
     * A house owns it, somebody else holds it, and nothing on the record says
     * how it got there.
     *
     * NOT A SHRUG AND NOT A THIRD GUESS. The design owner: *"there does need a
     * distinction between borrowing and stealing."* There does - and the
     * engine does not get to invent one it cannot show. An object whose chain
     * says nothing is not evidence of a theft and is not proof of a loan; it
     * is the exact state that makes a quartermaster start asking, which is a
     * more useful thing for the world to be able to say than either guess.
     */
    | 'unaccounted_for';

export function whoseThisIs(input: {
    /** The object's `ownerId`. Null is a real answer: nobody's. */
    ownerId: string | null;
    /** The object's `possessorId`. Null where it is in the ground or lost. */
    possessorId: string | null;
    /** Which ids name houses rather than people. */
    houseIds: ReadonlySet<string>;
    /**
     * The object's `provenance`, oldest first, as `possessions.ts` keeps it.
     *
     * THE CHAIN AND NOT A FIELD ON THE ROW. Whether this was lent or taken is
     * a fact about an EVENT. A field would have to be maintained by every code
     * path that ever moves a thing, and the one that forgot would quietly turn
     * a theft into a loan; the chain is written once, at the transfer, by
     * whoever made it.
     */
    provenance?: readonly { holderId: string | null; how: AcquisitionMode }[];
}): WhoseThisIs {
    const { ownerId, possessorId, houseIds } = input;
    // Nobody's, or a person's. Either way no house has a call on it, and a
    // bestowed thing is exactly this: the house is no longer in the field.
    if (ownerId === null || !houseIds.has(ownerId)) return 'their_own';
    if (possessorId === null || possessorId === ownerId) return 'in_a_treasury';

    // How THIS holder came by it, which is the last link naming them. Reading
    // backwards matters: a thing lent, returned, and later taken carries both
    // words on its chain, and only the most recent one is about now.
    const chain = input.provenance ?? [];
    for (let at = chain.length - 1; at >= 0; at--) {
        const link = chain[at];
        if (link === undefined || link.holderId !== possessorId) continue;
        if (link.how === 'lent') return 'lent_by_their_house';
        if (link.how === 'stolen' || link.how === 'looted') return 'taken_from_their_house';
        // Bought, inherited, awarded and the rest do not describe a thing the
        // house still owns, so they say nothing about how this one got here.
        break;
    }
    return 'unaccounted_for';
}

/**
 * What holding it on those terms actually means, said plainly.
 *
 * Not a number, and not advice. The cost of working out of a house's furnace
 * is that the house can stop letting you, and an engine that reported only
 * what the thing was worth would be telling half of it.
 */
export function whatHoldingItMeans(whose: WhoseThisIs): string | null {
    switch (whose) {
        case 'their_own':
            return null;
        case 'lent_by_their_house':
            return 'It is the house’s. Everything it is worth to you is worth exactly as '
                + 'much to whoever could decide you have had it long enough.';
        case 'in_a_treasury':
            return 'It is in the treasury and nobody has it out, which is not the same as '
                + 'being free to take.';
        case 'taken_from_their_house':
            return 'The house owns it, the house did not hand it over, and the chain says so '
                + 'to anybody who thinks to read it.';
        case 'unaccounted_for':
            return 'The house owns it and nothing on the record says how it left the treasury. '
                + 'That is not the same as nobody noticing.';
    }
}

/**
 * Whether a house could call this back without it being a seizure.
 *
 * True of a loan, because a loan ends. NOT true of a thing that was taken: a
 * house recovering stolen property is doing something the world has its own
 * word for, and letting that read as routine would lose the distinction this
 * type exists to make.
 */
export function couldBeCalledBackIn(whose: WhoseThisIs): boolean {
    return whose === 'lent_by_their_house';
}

/** Whether the house has something here to ask somebody about. */
export function isSomethingTheHouseWouldAskAbout(whose: WhoseThisIs): boolean {
    return whose === 'taken_from_their_house' || whose === 'unaccounted_for';
}

// ═════════════════════════════════════════════════════════════════════════
// AND WHAT PUTTING IT BACK UP COSTS
// ═════════════════════════════════════════════════════════════════════════

/**
 * What one building costs to raise again, in spirit stones.
 *
 * The owner: *"and then they'd have to pay spirit stones and rebuild."*
 *
 * Priced off the same thing the buildings are rated off - ORDINARY MATERIALS -
 * so it is one figure for every hall in the world, for the reason the rating is
 * one figure: stone is stone, and what makes a great house's seat impressive is
 * its scale and its ward rather than the price per wall. A house with more
 * standing loses more because it HAS more, which comes out of the count rather
 * than out of a rate.
 */
export const WHAT_ONE_BUILDING_COSTS_TO_RAISE = 4_000;

export interface WhatRebuildingWouldCost {
    buildingsDown: number;
    stones: number;
    /** Whether the house can pay for it out of what it holds. */
    affordable: boolean;
    /** What it is short by, or zero. */
    short: number;
    account: string;
}

export function whatRebuildingWouldCost(input: {
    buildingsDown: number;
    treasuryHolds: number;
}): WhatRebuildingWouldCost {
    const down = Math.max(0, Math.floor(input.buildingsDown));
    const stones = down * WHAT_ONE_BUILDING_COSTS_TO_RAISE;
    const held = Math.max(0, Math.floor(input.treasuryHolds));
    return {
        buildingsDown: down,
        stones,
        affordable: held >= stones,
        short: Math.max(0, stones - held),
        account:
            `${down} building(s) at ${WHAT_ONE_BUILDING_COSTS_TO_RAISE} each is ${stones} `
            + `against a treasury of ${held}`
            + (held >= stones
                ? '. The house can put it back up.'
                : `, which is ${stones - held} short. Some of it stays down.`)
    };
}

/**
 * How many of a house's buildings a flattening actually brings down.
 *
 * NOT ALL OF THEM, and the reason is the genre rather than mercy. Somebody who
 * can beat the walls does not thereby knock every wall over: what a flattening
 * is, is the compound stopping being defensible, and that happens well before
 * the last shed goes. How much comes down is how far past the walls the
 * attacker reaches - which is the one number this whole layer is built on, so
 * nothing new decides it.
 */
export function howMuchComesDown(input: {
    /** Buildings the compound has. */
    buildings: number;
    theirReach: number;
    buildingsStandAt: number;
}): number {
    const buildings = Math.max(0, Math.floor(input.buildings));
    if (buildings === 0) return 0;
    const past = Math.max(0, input.theirReach - input.buildingsStandAt);
    // A tenth of the compound per rung past the walls, and never all of it
    // short of overwhelming force. Somebody one rung over does token damage;
    // somebody ten rungs over levels the place.
    const share = Math.min(1, past / 10);
    return Math.max(1, Math.round(buildings * share));
}
