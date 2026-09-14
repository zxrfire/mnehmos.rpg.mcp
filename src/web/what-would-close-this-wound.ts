/**
 * The medicine that would actually close this wound, named, and priced.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 *
 * Found by playing, and it is the same defect `docs/world/things/items.md` closes with
 * a warning about - one layer up. That build's commonest cause of death had no
 * reachable cure while the formula sat in the catalog. This time the cure IS
 * reachable, affordable, and in the player's own price range, and its NAME is
 * not: the run that found it was carrying a crippling torn meridian and four
 * more wounds, holding 194 spirit stones against a 54-stone cure, and got:
 *
 *   the seclusion summary   "a healing pill does it faster" - which pill?
 *   `buy a healing pill`    a Lesser Healing Pill. 6 HP. Closes nothing.
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
 *
 * ── AND IT SAYS ONLY AS MUCH AS THE PERSON ASKING ACTUALLY HOLDS ──────────
 *
 * This file had no holder and no knowledge gate, so it told everybody the same
 * thing: a Qi Condensation cultivator standing in a village, carrying a
 * crippling tear, was handed the name, the grade and the barter terms of a
 * medicine refined above the Lid. Nobody in the game was ever told "nothing can
 * be done" while that was the honest answer from where they stand - which is
 * the whole of the shape the design owner asked for, where a verdict is refused
 * and somebody far enough up eventually names the thing.
 *
 * WHAT IS TRUE DID NOT MOVE. The wound rows still state the state of the art,
 * the catalog still holds the medicine, the houses still hold their doses, and
 * `whatSomebodyWouldGoAndGet` still finds the same pill. What changed is that
 * {@link TheCure} carries whether this holder has heard of it, and
 * {@link whatToSayAboutTheCure} has an honest sentence for each answer.
 *
 * ONE RULE, ASKED IN ONE PLACE: {@link aMedicineThisHolderCouldName}. A thing
 * on open sale needs no telling; anything past the cash line does, and the gate
 * is the only thing that says whether it happened.
 *
 * AND THE GATE CAN ONLY EVER BITE ON A BARTER-TIER MEDICINE, which is the
 * invariant that holds the blast radius down. `whatSomebodyWouldGoAndGet` sorts
 * cash before barter, so a barter pill is named only where nothing cheaper
 * reached the wound at all - and a barter pill's `stones` is null by
 * construction, so no caller composing a sentence out of `cure.name` and
 * `cure.stones` can be handed a name it must not say.
 */

import { PILLS, getPillsByEffect } from '../data/cultivation/pills.js';
import { currentWoundKey, getWoundType, isPermanentWound } from '../data/cultivation/wounds.js';
import type {
    StructuralRepairMedicine
} from '../data/cultivation/structural-repair-medicine.js';
import { cashToStones, PRICES } from '../data/cultivation/mortal-world.js';
import { localPrice } from '../data/cultivation/regions.js';
import {
    medicineNeededFor,
    medicineRank,
    medicineReaches
} from '../engine/cultivation/what-grade-of-medicine-a-wound-needs.js';
import { cashRefusalReason } from '../engine/cultivation/buying-and-bartering-pills.js';
import {
    cheapestMedicineFor,
    repairWeightInStones,
    cashRefusalReason as repairCashRefusalReason
} from '../engine/cultivation/what-structural-repair-medicine-can-reach.js';
import {
    aThingOnOpenSale,
    whoWouldHaveHeardOfIt
} from '../engine/cultivation/who-has-heard-of-a-thing-past-the-counter.js';
import { canName } from '../engine/social/discovery.js';
import type { KnowledgeGate } from './knowledge.js';
import type { Injury, Pill, TechniqueGrade } from '../schema/cultivation.js';

/** What would close a wound, as much of it as the world will say. */
export interface TheCure {
    /** The pill's catalog name, which is the name a player has to be able to type. */
    name: string;
    grade: TechniqueGrade;
    /**
     * What a counter HERE asks, in spirit stones, or null where money is not
     * the medium.
     *
     * ── This field used to be the board figure, and that was wrong ────────
     *
     * It said so in its own docstring: deliberately the BOARD's price and not a
     * local one, on the reasoning that this is the sentence "there is a thing
     * that would work and it costs about this", said before the player walks to
     * a counter, and that `buy` quoting a different number was a difference the
     * two surfaces were allowed to have.
     *
     * They are not allowed to have it, and the reason is the field below.
     * `affordable` is a claim about THIS PURSE against THIS PRICE, and a purse
     * is only ever spent at a real counter - so an "about" that is not the
     * number the counter charges makes the affordability line a falsehood
     * rather than an approximation. Measured in the Silent Cliffs, whose
     * multiplier is 2.2: the advice read "about 420 spirit stones. You are
     * carrying enough for one" and `buy` then asked 924. Pre-existing, and
     * invisible until a catalog row put it on a large enough absolute number to
     * be noticed.
     *
     * So this is `localPrice` at the region the cultivator is standing in,
     * rounded up the same way `buy` rounds, and the two surfaces now agree by
     * construction rather than by coincidence. What has NOT changed is the rule
     * the old note was protecting: this file still invents no price of its own,
     * it reads the board and applies the region multiplier the board is already
     * charged through.
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
    /**
     * The catalog's own name for that wound, where it has one.
     *
     * Null for an ordinary tear, which is what the severity alone describes.
     * It exists because the sentence used to say "a crippling tear" whatever it
     * was talking about, and once a permanent wound can reach this read that is
     * a maiming being called a tear.
     */
    forWound: string | null;
    /** What a mortal physician would have to be, to close that one. */
    physicianNeeds: TechniqueGrade;
    /** Whether a mortal physician reaches it. False is why the counter refuses. */
    physicianReaches: boolean;
    /**
     * Whether the cultivator this was read for has ever heard the medicine
     * exists.
     *
     * True with no holder supplied, which is what keeps every engine-side
     * reading and every probe answering what it answered: a caller that names
     * nobody is asking what is true rather than what somebody holds.
     */
    heardOf: boolean;
}

/** Who the reading is for. Absent where the caller is asking after the truth. */
export interface WhoIsAsking {
    gate: KnowledgeGate;
    holderId: string;
    /** Their own rung, which is the half of the rule the gate cannot reach. */
    realmOrdinal: number;
}

/**
 * Whether this medicine may be named to this holder.
 *
 * THE ONE PLACE THAT DECIDES IT, and every surface that names a medicine asks
 * here: the physician's refusal, the situation panel, the alchemy receipt and
 * the line about a wound nothing closes. Four sentences, one answer, so the
 * game cannot tell somebody there is nothing to be done and name the thing two
 * lines later.
 */
export function aMedicineThisHolderCouldName(
    /**
     * Either catalog's row. A structural repair medicine is never on a counter,
     * so only a pill is asked the open-sale question - which is the whole of
     * what the two shapes differ by here.
     */
    pill: Pill | StructuralRepairMedicine,
    asking: WhoIsAsking | undefined
): boolean {
    if ('effect' in pill && aThingOnOpenSale(pill)) return true;
    if (!asking) return true;
    // The derivation first and the rows second, and both go through the same
    // two readers everybody else uses. The rung is asked here rather than at
    // the gate because the played cultivator has no world row for the gate's
    // own reading to find - see `whoWouldHaveHeardOfIt`.
    if (canName(whoWouldHaveHeardOfIt({
        thingId: pill.id,
        ordinal: asking.realmOrdinal,
        house: null
    }))) {
        return true;
    }
    return asking.gate.isAwareOf(asking.holderId, 'thing', pill.id);
}

/**
 * The medicine somebody would actually go and get for THIS wound on THIS body.
 *
 * ── TWO ROADS, AND THE WOUND SAYS WHICH ONE IT IS ON ─────────────────────
 *
 * This read considered `treat_injury` alone, so a permanent injury reached the
 * player down a line of its own and the two ends of "what would close this"
 * disagreed about what medicine exists. They do not now: one function, asked per
 * wound, answering out of whichever road the WOUND is on. Which road is the
 * wound's own property rather than a choice made here.
 *
 *   MENDS ON ITS OWN     the graded treat-injury ladder, by severity against
 *                        the body carrying it.
 *   DOES NOT            structural repair medicine, by RANK - and past the top
 *                        of that ladder, the chaos rung, which reaches any rank
 *                        and does not let you choose which wound it closes.
 *
 * The second road is the design owner's ruling and it overturned a pill written
 * against the opposite premise. The rank ladder is `cheapestMedicineFor`, whose
 * grades reach to 16, 20, 28 and 40; above 40 nothing on it reaches, and the
 * chaos rung is the only thing that does. So it is asked LAST rather than
 * cheapest-first: a dose you can point at a particular injury is worth more
 * than a dose that picks one for you, whatever either costs.
 *
 * On the graded road: everything below the wound's requirement is dropped
 * before anything is sorted, because a cheaper name is worse than no name when
 * the cheaper thing will be refused at the point of use. Among what reaches,
 * cash before barter and then cheapest first - a player who can walk to a
 * counter should be sent to the counter, and the barter tiers stay in the list
 * and sort last so a wound whose only answer is past money still produces a
 * NAME and a reason rather than silence.
 */
function whatSomebodyWouldGoAndGet(
    injury: Pick<Injury, 'severity' | 'woundType'>,
    realmOrdinal: number
): TheThingThatWouldDoIt | null {
    if (isPermanentWound(injury.woundType)) {
        const byRank = cheapestMedicineFor(currentWoundKey(injury.woundType), realmOrdinal);
        if (byRank) return { kind: 'repair', medicine: byRank };
        const drawn = theOneThatReachesAnyRank();
        return drawn ? { kind: 'pill', pill: drawn } : null;
    }
    const candidates = [...PILLS]
        .filter(pill => pill.effect === 'treat_injury')
        .filter(pill => medicineReaches(pill.grade, injury.severity, realmOrdinal))
        .sort((a, b) =>
            Number(cashRefusalReason(a) !== null) - Number(cashRefusalReason(b) !== null)
            || medicineRank(a.grade) - medicineRank(b.grade)
            || a.value - b.value);
    return candidates[0] ? { kind: 'pill', pill: candidates[0] } : null;
}

/** Either road's answer, normalised at the one place that has to report both. */
type TheThingThatWouldDoIt =
    | { kind: 'pill'; pill: Pill }
    | { kind: 'repair'; medicine: StructuralRepairMedicine };

/**
 * The chaos rung: the one thing that repairs a permanent injury at any rank.
 *
 * Read off the effect rather than named, so the catalog stays the authority on
 * which row it is. There is exactly one and `a-medicine-made-for-nothing-in-
 * particular.test.ts` is the ratchet on that.
 */
function theOneThatReachesAnyRank(): Pill | null {
    return getPillsByEffect('mends_what_will_not_close')[0] ?? null;
}

/** What either road's answer is called, at what grade, and on what terms. */
function howItIsGot(
    answer: TheThingThatWouldDoIt,
    regionId: string,
    groundMultiplier: number
): { id: string; name: string; grade: TechniqueGrade; stones: number | null; notForSale: string | null } {
    if (answer.kind === 'pill') {
        const notForSale = cashRefusalReason(answer.pill);
        return {
            id: answer.pill.id,
            name: answer.pill.name,
            grade: answer.pill.grade,
            stones: notForSale === null ? boardPrice(answer.pill, regionId, groundMultiplier) : null,
            notForSale
        };
    }
    // NEVER A PRICE, WHATEVER THE TERMS SAY. A repair medicine reaches no board
    // anywhere, so quoting a figure would send somebody to a counter that has
    // never held one - the contradiction `boardPrice` exists to prevent. Where
    // the terms are a private sale the sentence says so and says what it weighs,
    // because "there is no price" and "the price is between two houses" are
    // different answers and only one of them is true here.
    const medicine = answer.medicine;
    return {
        id: medicine.id,
        name: medicine.name,
        grade: medicine.grade,
        stones: null,
        notForSale: repairCashRefusalReason(medicine)
            ?? `No counter has ever held one. It moves between houses, privately, at about `
               + `${repairWeightInStones(medicine).toLocaleString('en-US')} spirit stones, and the `
               + 'houses that can pay that are a list somebody could write down.'
    };
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
function boardPrice(pill: Pill, regionId: string, groundMultiplier: number): number | null {
    const row = PRICES.find(price => price.name === pill.name);
    if (!row) return null;
    // The board is in cash and the purse is in stones, at the rate the whole
    // economy uses. 100 cash to the stone is stated on the board's own rows
    // ("Sixty stones" beside 6,000 cash), and rounding UP is the direction a
    // quote may be wrong in: a player must never be told a figure lower than
    // what they will be charged.
    //
    // `localPrice`, the ground term, and `Math.ceil(cashToStones(...))` are the
    // three calls `buy` makes, in the order `buy` makes them, deliberately: any
    // other arithmetic here - the board figure scaled afterwards, say, or
    // rounding before a multiplier - produces a number that is off by one
    // somewhere and puts the quote and the charge back into disagreement over
    // exactly the rows nobody checks.
    return Math.max(1, Math.ceil(cashToStones(
        Math.max(1, Math.round(localPrice(regionId, row.cash) * groundMultiplier))
    )));
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
    spiritStones: number,
    /**
     * Where the asking is being done. Required rather than defaulted: a
     * defaulted region is how the quote and the charge came to differ in the
     * first place, and a caller that has a cultivator has a region -
     * `standingOf(cultivator).regionId` is the whole of it.
     */
    regionId: string,
    /**
     * What is TRUE of the ground today, for medicine, over what the province is
     * LIKE. Defaulted to 1 only because a run can have no world at all, which
     * is a quiet market and not a missing argument - every caller standing
     * somewhere passes `groundPriceMultiplier(cultivator, 'medicine')`. A war
     * has healers being paid too much, `buy` charges it, and a quote that did
     * not would be the same lie `regionId` was added to end.
     */
    groundMultiplier = 1,
    /**
     * Who is being told. Omitted by a caller asking what is TRUE rather than
     * what somebody holds - every played surface passes one.
     */
    asking?: WhoIsAsking
): TheCure | null {
    if (untreated.length === 0) return null;

    // The worst one names the sentence, because it is the one that will still
    // be there after everything else has been dealt with - and, at the top of
    // the range, the one a physician will refuse.
    //
    // WORST OF THE ONES SOMETHING ANSWERS, and the qualifier is load-bearing
    // now that a permanent wound can be on the list. A rooted heart demon and a
    // burnt span are answered by nothing at all and they sort above everything;
    // picked as the worst they would return null and take the cure for the
    // tear beside them down with them. What the world has no answer for is a
    // fact the reads state separately, and it is not this read going quiet.
    const answered = untreated
        .map(injury => ({ injury, answer: whatSomebodyWouldGoAndGet(injury, realmOrdinal) }))
        .filter((row): row is { injury: Injury; answer: TheThingThatWouldDoIt } =>
            row.answer !== null)
        .map(row => ({ ...row, got: howItIsGot(row.answer, regionId, groundMultiplier) }))
        .sort((a, b) => medicineRank(b.got.grade) - medicineRank(a.got.grade));
    if (answered.length === 0) return null;

    const { injury: worst, answer, got } = answered[0]!;
    const stones = got.stones;

    return {
        name: got.name,
        grade: got.grade,
        stones,
        notForSale: got.notForSale,
        affordable: stones !== null && spiritStones >= stones,
        forSeverity: worst.severity,
        forWound: getWoundType(worst.woundType)?.name ?? null,
        // What the physician path requires. It used to be the OTHER half of the
        // sentence, in the sense of an apology - the counter says no while the
        // pill says yes - and now it is the same half said twice, because the
        // pill path enforces the identical rule. Kept because a refusal still
        // has to state what it is refusing on.
        physicianNeeds: medicineNeededFor(worst.severity, realmOrdinal),
        // A permanent wound is off the graded ladder entirely - no grade of
        // physician reaches one, at any rung - so the severity read is not
        // asked about it.
        physicianReaches: !isPermanentWound(worst.woundType)
            && medicineReaches('mortal', worst.severity, realmOrdinal),
        heardOf: aMedicineThisHolderCouldName(
            answer.kind === 'pill' ? answer.pill : answer.medicine, asking)
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
    // The catalog's word for it where the wound has one, because the severity
    // alone describes a tear and several of the things that reach this read are
    // not tears. The rows carry their own article where they want one.
    const wound = cure.forWound !== null
        ? cure.forWound.toLowerCase()
        : `a ${cure.forSeverity} tear`;
    // ── AND WHERE THEY HAVE NEVER HEARD OF IT, IT IS NOT NAMED ───────────
    //
    // Not a hedge and not a hint. The sentence says what is true from where
    // they are standing - nothing they can reach closes it - and says which
    // door would change that, which is the third of the three things
    // `AGENTS.md` requires of a refusal. A medicine nobody has mentioned to
    // them cannot be alluded to here, because an allusion is the engine
    // winking: the verdict has to be survivable as a verdict, or refusing it
    // is not something the player chose to do.
    if (!cure.heardOf) {
        return `Nothing you can reach closes ${wound}. No physician in reach will take the `
            + 'case and no counter here sells anything that would. Whether anything closes it '
            + 'at all is a question for somebody who works far higher up than anybody here.';
    }
    if (cure.notForSale !== null) {
        return `What closes ${wound} is a ${cure.name}, ${cure.grade} grade. ${cure.notForSale}`;
    }
    if (cure.stones === null) {
        return `What closes ${wound} is a ${cure.name}. Nothing on any board here quotes one.`;
    }
    // "about N spirit stones" was the old wording and it is retired with the
    // board price it went with: the figure is now what a counter in this
    // province actually charges, and hedging an exact number invites the reader
    // to expect the difference somewhere else.
    return `What closes ${wound} is a ${cure.name}, ${cure.stones} spirit stones at a counter here. `
        + (cure.affordable
            ? 'You are carrying enough for one.'
            : 'You are not carrying enough for one.');
}
