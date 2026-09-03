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

import { ACTIONS_PER_FULL_SATIETY, stillNeedsToEat } from '../engine/cultivation/survival.js';
import type { Injury } from '../schema/cultivation.js';

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
    /**
     * The body has stopped taking meals, so there is nothing here to buy.
     *
     * A separate flag rather than something a caller infers from `wanted === 0`,
     * because the two states that produce a zero purchase are opposites and
     * used to print the same sentence. **Nothing to buy** is this one: hunger
     * has stopped, the stretch is covered end to end, and the purse is
     * irrelevant. **Nothing affordable** is `wanted > 0` with `toBuy === 0`,
     * where the food exists, is needed, and cannot be paid for - and that one
     * ends in starvation. A caller that cannot tell them apart tells somebody
     * who does not eat that their belly covers fifty days.
     */
    hungerHasStopped: boolean;
}

/**
 * The provisioning arithmetic, and the only copy of it.
 *
 * ── WHERE THE REALM COMES INTO IT, AND WHERE IT STILL DOES NOT ────────────
 *
 * This used to say it deliberately never consulted the realm at all, on the
 * grounds that a preview which priced a stretch differently from the purchase
 * is worse than no preview, and that if the flat rate was wrong it should be
 * fixed in one place with both halves moving together. This is that fix, and
 * it is narrowed to the one case where the flat rate was not merely coarse but
 * false.
 *
 * `SATIETY_BURN_BY_REALM` is ZERO from Deity Transformation up: a cultivator
 * that high has stopped eating, `burnSatiety` burns nothing, and starvation
 * cannot occur. Priced flat, the same body was sold 365 rations for a year in
 * a cave and warned that the belly covered fifty days - a bill for food that
 * cannot be eaten, followed by a starvation warning for a death that cannot
 * happen. {@link ProvisioningPlan.hungerHasStopped} is how a caller says the
 * true thing instead.
 *
 * The predicate is {@link stillNeedsToEat}, imported rather than restated -
 * one table, one reader. It is preferred over `daysPerRation` here because it
 * takes the wound list, and a partial transformation takes the meals back
 * (`satietyBurnMultiplier`); `feedFromPack` and `drawFromPack` in `game.ts`
 * already read it that way, so all three agree about who eats.
 *
 * BELOW that line the rate is still flat, and that is still deliberate.
 * `buyProvisions` has never scaled the purchase by realm, so a Foundation
 * cultivator is sold roughly twenty-four times the food they will open. That
 * is over-buying rather than a false statement, it costs stones and never a
 * life, and moving it moves the early-game economy - a bigger change than the
 * one this was for.
 */
export function whatFeedingThisStretchCosts(
    body: {
        satiety: number;
        spiritStones: number;
        /**
         * The rung, which decides whether there is anything to price at all.
         * Optional and defaulting to the bottom of the ladder, where the flat
         * rate is exactly right: every caller with a real body passes a whole
         * `Cultivator` and gets the true answer.
         */
        realmOrdinal?: number;
        /** Read only by `stillNeedsToEat`. See the note above. */
        injuries?: readonly Injury[];
    },
    rationsHeld: number,
    days: number
): ProvisioningPlan {
    const stretch = Math.max(0, Math.floor(days));
    const stonesBefore = Math.max(0, Math.floor(body.spiritStones));
    const held = Math.max(0, Math.floor(rationsHeld));
    const satiety = Math.max(0, Math.floor(body.satiety));

    // Nothing to price. Not "cheap" and not "already covered by the pack":
    // there is no purchase to make, the stretch is fed end to end by a body
    // that does not draw on it, and the purse is not part of this decision.
    if (!stillNeedsToEat(body.realmOrdinal ?? 0, body.injuries)) {
        return {
            days: stretch,
            wanted: 0,
            carried: 0,
            toBuy: 0,
            short: 0,
            cost: 0,
            stonesBefore,
            stonesAfter: stonesBefore,
            covered: stretch,
            coversTheWholeStretch: true,
            shareOfThePurse: 0,
            worthAsking: false,
            hungerHasStopped: true
        };
    }

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
        worthAsking: cost > 0 && shareOfThePurse >= A_PURCHASE_BIG_ENOUGH_TO_ASK_ABOUT,
        hungerHasStopped: false
    };
}
