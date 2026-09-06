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
