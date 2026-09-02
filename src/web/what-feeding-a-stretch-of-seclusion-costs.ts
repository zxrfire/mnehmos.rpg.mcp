/**
 * What the food for a stretch of seclusion will cost, worked out BEFORE it is
 * entered.
 *
 * The mechanic this serves is right and is not being softened here: you cannot
 * cultivate longer than you can eat, and topping the pack up at the cave mouth
 * is the thing that makes a long stretch possible at all. Nothing in this file
 * changes a price, a rate or an outcome.
 *
 * What was wrong was the ORDER. Found by playing: a player entered seclusion
 * holding 54 spirit stones and came out holding none, and read about it
 * afterwards - "1 ration came out of the pack, and 27 more was bought for 54
 * spirit stones". The arithmetic was correct and honestly reported, and it was
 * still a surprise bill, because the rest of the game asks about a purchase
 * that size first.
 *
 * So the same arithmetic runs twice: once here, where the player can still
 * decline, and once in `GameService.buyProvisions`, which spends the stones.
 * **They are the same function**, and that is the whole discipline of this
 * module - a preview computed by a second implementation is a second economy,
 * and it would drift from the real one the first time either was touched.
 */

import { ACTIONS_PER_FULL_SATIETY } from '../engine/cultivation/survival.js';

/**
 * What one ration costs at any market in the world.
 *
 * Lives here rather than in `game.ts` because this is now the module that owns
 * the provisioning arithmetic; `game.ts` re-exports it so every existing
 * importer is untouched.
 */
export const PROVISION_COST_STONES = 2;

/**
 * How much of a purse a purchase has to take before the game ought to ask.
 *
 * A judgement, and stated as one. Below it, the figure printed in the seclusion
 * picker is enough - the player sees the bill above the button and presses the
 * button. At or above it the purchase is effectively the whole purse, which is
 * a different kind of decision: it is the one the player cannot walk back and
 * cannot pay for anything else after. `Sit anyway` is the shape this project
 * already uses for exactly that, and it is the shape used here.
 */
export const A_PURCHASE_BIG_ENOUGH_TO_ASK_ABOUT = 0.75;

export interface ProvisioningPlan {
    /** The stretch this was worked out for. */
    days: number;
    /** Whole rations the stretch asks for. */
    wanted: number;
    /** Of those, how many are already in the pack and cost nothing. */
    carried: number;
    /** How many would be bought at the cave mouth. */
    toBuy: number;
    /** What the purse cannot afford, and so goes unfed. */
    short: number;
    /** What the buying costs, in spirit stones. */
    cost: number;
    /** The purse before the purchase, and what would be left after it. */
    stonesBefore: number;
    stonesAfter: number;
    /** Days of food the stretch would actually have, the belly included. */
    covered: number;
    /** True when `covered` reaches the whole stretch. */
    coversTheWholeStretch: boolean;
    /** How much of the purse the purchase takes, 0 to 1. Zero when nothing is bought. */
    shareOfThePurse: number;
    /** True when this is a purchase the picker should stop and ask about. */
    worthAsking: boolean;
}

/**
 * The provisioning arithmetic, and the only copy of it.
 *
 * Deliberately does NOT consult the realm's satiety burn: `buyProvisions` has
 * never done so - it buys one ration per {@link ACTIONS_PER_FULL_SATIETY} days
 * flat - and a preview that priced the stretch differently from the purchase
 * would be worse than no preview at all. If that flat rate is wrong it is wrong
 * in one place and should be fixed there, with both halves moving together.
 */
export function whatFeedingThisStretchCosts(
    body: { satiety: number; spiritStones: number },
    rationsHeld: number,
    days: number
): ProvisioningPlan {
    const stretch = Math.max(0, Math.floor(days));
    const stonesBefore = Math.max(0, Math.floor(body.spiritStones));
    const held = Math.max(0, Math.floor(rationsHeld));
    const satiety = Math.max(0, Math.floor(body.satiety));

    const wanted = Math.ceil(stretch / ACTIONS_PER_FULL_SATIETY);
    const carried = Math.min(wanted, held);
    const shortOfWhatIsWanted = wanted - carried;
    const affordable = Math.floor(stonesBefore / PROVISION_COST_STONES);
    const toBuy = Math.max(0, Math.min(shortOfWhatIsWanted, affordable));
    const cost = toBuy * PROVISION_COST_STONES;
    const rations = carried + toBuy;

    // The belly covers the first stretch on its own, which is why a short
    // seclusion off a full stomach buys nothing at all.
    const covered = rations * ACTIONS_PER_FULL_SATIETY + Math.floor(satiety / 2);
    const shareOfThePurse = stonesBefore > 0 ? cost / stonesBefore : 0;

    return {
        days: stretch,
        wanted,
        carried,
        toBuy,
        short: shortOfWhatIsWanted - toBuy,
        cost,
        stonesBefore,
        stonesAfter: stonesBefore - cost,
        covered,
        coversTheWholeStretch: covered >= stretch,
        shareOfThePurse,
        worthAsking: cost > 0 && shareOfThePurse >= A_PURCHASE_BIG_ENOUGH_TO_ASK_ABOUT
    };
}
