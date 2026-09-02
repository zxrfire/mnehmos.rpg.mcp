/**
 * The medicine that would actually close this wound, named, and priced.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 *
 * Found by playing, and it is the same defect `docs/world/items.md` closes with
 * a warning about - one layer up. That build's commonest cause of death had no
 * reachable cure while the formula sat in the catalog. This time the cure IS
 * reachable, affordable, and in the player's own price range, and its NAME is
 * not: the run that found it was carrying a crippling torn meridian and four
 * more wounds, holding 194 spirit stones against a 54-stone cure, and got:
 *
 *   the seclusion summary   "a healing pill does it faster" - which pill?
 *   `buy a healing pill`    a Minor Healing Pill. 6 HP. Closes nothing.
 *   `see a physician`       "cannot touch a meridian" - which is FALSE. Mortal
 *                           care closed two torn meridians and two scorched
 *                           channels in that same run. What it cannot touch is
 *                           a CRIPPLING one.
 *   what would close it     the Clear Meridian Pill, 54 stones, in the purse's
 *                           reach - and reachable only by reading `pills.ts`.
 *
 * Every one of those is the engine being right and silent at once. Nothing in
 * this file changes what a wound needs, what medicine reaches it, or what it
 * costs. It reads the three catalogs that already answer those questions and
 * says the answer out loud, with the name in it.
 *
 * ── It names WHAT WORKS, not what a table says should ─────────────────────
 *
 * This file used to carry a warning here and the warning has been answered, so
 * what it found is kept and what it concluded is corrected.
 *
 * WHAT IT FOUND. The grade ladder in `what-grade-of-medicine-a-wound-needs.ts`
 * was enforced in exactly one place, `GameService.treat`, the mortal physician.
 * The PILL path had no grade gate at all - `alchemy-manage.ts`'s `treat_injury`
 * branch called `treatWorstInjury` and nothing else - so a 60-stone mortal
 * Clear Meridian Pill demonstrably closed a crippling tear that a physician
 * would not touch. Measured in play, twice: the refusal and the pill disagreed,
 * and the pill won.
 *
 * WHAT IT CONCLUDED, AND WHAT CHANGED. It said the question was a design one to
 * be put to a person rather than settled in passing, which was right, and it
 * has now been put and answered: the design owner asked for the grade system to
 * have teeth, and `treat_injury` passes `medicineReaches` into
 * `treatWorstInjury`. The pill and the physician now agree.
 *
 * SO THE JOB OF THIS FILE IS UNCHANGED AND ITS ANSWER IS NOT. It names the
 * cheapest medicine somebody will sell you **that actually reaches the wound**,
 * where it used to name the cheapest one on the treat-injury line full stop.
 * Those were the same pill while nothing was enforced. They are not any more,
 * and naming the cheap one now would be the worst sentence in the game: a
 * player sent to a counter, charged sixty stones, and handed something the
 * resolver will refuse to spend. Where the medicine that reaches is above the
 * cash line, the honest answer is its name plus `cashRefusalReason` - told what
 * would mend you and why you cannot have it yet, which is the sentence `buy`
 * already gives.
 */

import { PILLS } from '../data/cultivation/pills.js';
import { PRICES } from '../data/cultivation/mortal-world.js';
import {
    medicineNeededFor,
    medicineRank,
    medicineReaches
} from '../engine/cultivation/what-grade-of-medicine-a-wound-needs.js';
import { cashRefusalReason } from '../engine/cultivation/buying-and-bartering-pills.js';
import type { Injury, Pill, TechniqueGrade } from '../schema/cultivation.js';

/** What would close a wound, as much of it as the world will say. */
export interface TheCure {
    /** The pill's catalog name, which is the name a player has to be able to type. */
    name: string;
    grade: TechniqueGrade;
    /**
     * What the board asks, in spirit stones, or null where money is not the
     * medium.
     *
     * Deliberately the BOARD's figure and not a local one: this is the sentence
     * "there is a thing that would work and it costs about this", said before
     * the player walks to a counter. `buy` applies `localPrice` and quotes the
     * real number, and the two are allowed to differ - what must never happen
     * is this file inventing a price of its own.
     */
    stones: number | null;
    /**
     * Why a counter will not name a figure, when it will not. Never null and a
     * price at the same time.
     */
    notForSale: string | null;
    /** Whether the purse covers the board price. False whenever `stones` is null. */
    affordable: boolean;
    /** The severity that set the requirement, so the sentence can say which wound. */
    forSeverity: Injury['severity'];
    /** What a mortal physician would have to be, to close that one. */
    physicianNeeds: TechniqueGrade;
    /** Whether a mortal physician reaches it. False is why the counter refuses. */
    physicianReaches: boolean;
}

/**
 * The medicine somebody would actually go and get for THIS wound on THIS body.
 *
 * `treat_injury` is a five-rung ladder - 60, 380, 4,000, 36,000, 400,000 - and
 * the cheapest rung of it no longer answers every wound, so the filter is
 * `medicineReaches` and not merely the effect. Everything below the wound's
 * requirement is dropped before anything is sorted, because a cheaper name is
 * worse than no name when the cheaper thing will be refused at the point of
 * use.
 *
 * Among what reaches, cash before barter and then cheapest first: a player who
 * can walk to a counter should be sent to the counter. The barter tiers stay in
 * the list and sort last so that a wound whose only answer is past money still
 * produces a NAME and a reason rather than silence.
 */
function whatSomebodyWouldGoAndGet(
    severity: Injury['severity'],
    realmOrdinal: number
): Pill | null {
    const candidates = [...PILLS]
        .filter(pill => pill.effect === 'treat_injury')
        .filter(pill => medicineReaches(pill.grade, severity, realmOrdinal))
        .sort((a, b) =>
            Number(cashRefusalReason(a) !== null) - Number(cashRefusalReason(b) !== null)
            || medicineRank(a.grade) - medicineRank(b.grade)
            || a.value - b.value);
    return candidates[0] ?? null;
}

/**
 * The board's asking price in stones for a named medicine, or null if it lists
 * none.
 *
 * DELIBERATELY THE BOARD AND NOT THE CATALOG, and the temptation to fall
 * through to `pillCashPrice` was tried and rejected. `buy` sells what is on the
 * board; a figure quoted for anything else sends a player to a counter that
 * will tell them the thing is not sold here, which is the same contradiction
 * this file exists to end, wearing a helpful face.
 *
 * So the invariant is on the board rather than on this function: every
 * commodity-tier treat-injury medicine has a row, and
 * `tests/data/every-purchasable-cure-is-on-the-board.test.ts` fails if one is
 * added to the catalog and not to the board. That is what caught the
 * Marrow-Washing Pill, which is the earth-grade answer an ordinary tear on a
 * Core Formation body needs and had never been quoted anywhere.
 */
function boardPrice(pill: Pill): number | null {
    const row = PRICES.find(price => price.name === pill.name);
    if (!row) return null;
    // The board is in cash and the purse is in stones, at the rate the whole
    // economy uses. 100 cash to the stone is stated on the board's own rows
    // ("Sixty stones" beside 6,000 cash), and rounding UP is the direction a
    // quote may be wrong in: a player must never be told a figure lower than
    // what they will be charged.
    return Math.max(1, Math.ceil(row.cash / 100));
}

/**
 * What would close the worst untreated wound this cultivator is carrying.
 *
 * Null when there is nothing untreated, which is a different answer from "there
 * is no cure" and reads differently everywhere it is used.
 */
export function whatWouldCloseThisWound(
    untreated: readonly Injury[],
    realmOrdinal: number,
    spiritStones: number
): TheCure | null {
    if (untreated.length === 0) return null;

    // The worst one names the sentence, because it is the one that will still
    // be there after everything else has been dealt with - and, at the top of
    // the severity range, the one a physician will refuse.
    const worst = [...untreated].sort((a, b) =>
        medicineRank(medicineNeededFor(b.severity, realmOrdinal))
        - medicineRank(medicineNeededFor(a.severity, realmOrdinal)))[0];

    const pill = whatSomebodyWouldGoAndGet(worst.severity, realmOrdinal);
    if (!pill) return null;

    const notForSale = cashRefusalReason(pill);
    const stones = notForSale === null ? boardPrice(pill) : null;

    return {
        name: pill.name,
        grade: pill.grade,
        stones,
        notForSale,
        affordable: stones !== null && spiritStones >= stones,
        forSeverity: worst.severity,
        // What the physician path requires. It used to be the OTHER half of the
        // sentence, in the sense of an apology - the counter says no while the
        // pill says yes - and now it is the same half said twice, because the
        // pill path enforces the identical rule. Kept because a refusal still
        // has to state what it is refusing on.
        physicianNeeds: medicineNeededFor(worst.severity, realmOrdinal),
        physicianReaches: medicineReaches('mortal', worst.severity, realmOrdinal)
    };
}

/**
 * The sentence a player needs, built from the cure.
 *
 * One place, so the physician's refusal, the `help` read and the situation
 * panel say the same thing about the same wound. The shape is the one the
 * project already got right on the Cultivate control, which names the Lesser
 * Qi-Gathering Manual when there is no method: a refusal is only finished when
 * it names the thing that would work.
 */
export function whatToSayAboutTheCure(cure: TheCure): string {
    const wound = `a ${cure.forSeverity} tear`;
    if (cure.notForSale !== null) {
        return `What closes ${wound} is a ${cure.name}, ${cure.grade} grade. ${cure.notForSale}`;
    }
    if (cure.stones === null) {
        return `What closes ${wound} is a ${cure.name}. Nothing on any board here quotes one.`;
    }
    return `What closes ${wound} is a ${cure.name}, about ${cure.stones} spirit stones. `
        + (cure.affordable
            ? 'You are carrying enough for one.'
            : 'You are not carrying enough for one, which is a thing that can be changed.');
}
