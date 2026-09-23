/**
 * COMMISSIONING A CRAFT: asking somebody else's hands to make you a thing.
 *
 * The design owner: *"you should be able to ask your master to cut a slip or
 * craft something for you. and you should also be able to pay someone either $
 * or trade in expensive $ to do it."*
 *
 * Three questions - can they, will they, what does it cost - and the machinery
 * for all three already existed: `canRefineGrade` and
 * `couldCutATeleportationTalisman` for the gates, `openHandednessOf` and the obligation ledger for the leaning,
 * `gradeTradeTier` and `whatItWouldTake` for the medium and the bar.
 *
 * ── THE ONE FACT THIS FILE ADDS ──────────────────────────────────────────
 *
 * That asking somebody to spend their hands is read off two things at once:
 * WHAT THE ASKER IS TO THEM, and HOW MUCH OF WHAT THEY CAN DO IT ASKS FOR. A
 * master cuts their own disciple a roadside slip without looking up, and the
 * same master asked for the best thing their hands can make wants to know why.
 * Both enter through `readingOf`, the same door a war enters the treasury by,
 * so nothing downstream knows a commission from any other question.
 *
 * ── AND THE PRICE IS WHATEVER THE MAKER ASKS ─────────────────────────────
 *
 * The design owner: *"Whatever the maker asks. Their time is presumably
 * valuable, depends on realm."* So a commission comes to this maker's days at
 * the work, at this maker's own rate, and the materials they put in - see
 * `whatACommissionComesTo`. It used to be a property of the thing alone, a year
 * of the income of the rung that could only just make one: 54 spirit stones for
 * a mortal slip and 375 for earth-grade work, whoever made it, and heaven grade
 * had no figure at all. Every grade a hand below the Lid can make now has one;
 * only immortal and chaos, which nothing down here makes, are without.
 */

import { pillBandOrdinal } from '../cultivation/breakthrough.js';
import {
    couldFoldARing,
    whatARingCosts,
    whyTheFoldWillNotHold
} from '../world/what-a-body-can-carry-and-what-a-ring-holds.js';
import {
    EARNINGS_PER_ORDINAL,
    EARNINGS_RANK_CAP,
    PRICE_GROWTH_PER_ORDINAL,
    earningsPerYear
} from '../cultivation/origin.js';
import { MAX_ORDINAL } from '../cultivation/realms.js';
import {
    canRefineGrade,
    madeBelowTheLid,
    highestGradeRefinableAt,
    refiningOrdinalFor,
    whyTheCauldronRefuses
} from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import type { DayIndex } from '../social/common.js';
import type { ObligationInput, ObligationRecord, Severity } from '../social/grudges.js';
import { NEARNESS_ORDER, nearnessRank, type Nearness } from '../social/how-near-you-stand-to-somebody.js';
import {
    couldCutATeleportationTalisman,
    type WhatIsInTheSlip
} from '../world/a-talisman-is-one-act-somebody-already-paid-for.js';
import {
    whatItIsMadeOf,
    whatTheBenchIsShortOf,
    whatWouldFill,
    whyTheBenchIsShort,
    type ASlotNobodyFilled
} from '../../data/cultivation/what-an-artifact-is-made-of.js';
import { howMuchAGradeIsWorthTracking } from '../world/possessions.js';
import { DISPOSITION_BANDS, openHandednessOf } from './how-freely-somebody-parts-with-what-they-have.js';
import {
    whatTheyCarryAbout,
    type WhatMovedThem
} from './what-a-body-wants-is-what-its-deciders-want.js';
import {
    whatItWouldTake,
    type OnTheTable,
    type WhatItWouldTake
} from './what-somebody-would-take-for-a-thing-they-will-not-sell.js';
import { A_REASON_TO_SAY_NO } from './who-has-to-agree-before-it-leaves-the-store.js';
import {
    CUT_IN_A_SITTING,
    DAYS_A_SITTING_TAKES
} from '../../data/cultivation/communication-talismans.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';

// ═════════════════════════════════════════════════════════════════════════
// WHAT WAS ASKED FOR
// ═════════════════════════════════════════════════════════════════════════

/**
 * The thing somebody wants made. The grade is the whole of what decides who may
 * make it and what it is worth; a tenth kind of thing needs no code here.
 */
export interface WhatYouAskedThemToMake {
    /** Echoed into the line. Read by no conditional, as `OnTheTable.what` is not. */
    named: string;
    grade: TechniqueGrade;
    /** Set for a talisman. `a_teleportation` needs a hand that can already fold. */
    slip?: WhatIsInTheSlip | null;
    /**
     * True where what is being asked for is a STORAGE RING.
     *
     * A separate flag rather than a grade, because a ring's grade means
     * something else than every other grade in the world: a mortal-grade ring is
     * heaven-grade material to destroy and is called mortal for how much it
     * holds. Its gate is folding space rather than working the stuff, which is
     * why `couldFoldARing` answers it and `canRefineGrade` cannot.
     */
    aRing?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// CAN THEY
// ═════════════════════════════════════════════════════════════════════════

/** Which side of the same three gates a refusal is being read out to. */
export type WhoseHands = 'theirs' | 'yours';

export interface WhetherTheirHandsCanDoIt {
    theyCan: boolean;
    /** The best grade this hand could work instead. Null for none at all. */
    insteadTheyCouldMake: TechniqueGrade | null;
    /** Null where they can. Names the realm, never a judgement. */
    why: string | null;
    /**
     * The slots nothing on the bench reached. Empty where the materials were
     * whole AND where nobody said what was on the bench at all - those are two
     * different states and `theyCan` is the field that tells them apart.
     */
    theBenchIsShortOf: readonly ASlotNobodyFilled[];
}

/**
 * Whether this pair of hands could make it at all.
 *
 * THE RUNG FIRST, because it is the one that names a realm to reach for, and
 * because somebody who cannot work the grade has no use for a shopping list.
 * Then the folds, which are capabilities rather than stock. Then the stuff.
 *
 * The stuff gate did not exist. This function's comment said "the material gate
 * first" and then checked only the rung, so the whole material economy was
 * authored in prose and enforced nowhere: an elder at Void Tribulation turned
 * out heaven-grade work from an empty room.
 */
export function whetherTheirHandsCanDoIt(
    ask: WhatYouAskedThemToMake,
    makerOrdinal: number,
    /**
     * Catalog ids of what is actually on the bench. OMITTED IS NOT EMPTY: a
     * caller that does not know what anybody is holding gets the rung answer
     * and no material answer, rather than a refusal it has no grounds for.
     */
    materialsToHand?: readonly string[],
    /**
     * Whose hands the refusals are about.
     *
     * The same three gates answer both directions - a commission asks about
     * somebody else's hands, a player at a bench asks about their own - and the
     * only thing that differs is the PERSON the sentences are in. A refusal
     * saying "their hands" to the person whose hands they are is the engine
     * talking about the player in the third person, and it is a reading defect
     * rather than a cosmetic one: it sends them off to find somebody.
     */
    whoseHands: WhoseHands = 'theirs'
): WhetherTheirHandsCanDoIt {
    const yours = whoseHands === 'yours';
    const insteadTheyCouldMake = highestGradeRefinableAt(makerOrdinal);
    if (!canRefineGrade(ask.grade, makerOrdinal)) {
        return {
            theyCan: false,
            insteadTheyCouldMake,
            why: whyTheCauldronRefuses(ask.grade, makerOrdinal),
            theBenchIsShortOf: []
        };
    }
    if (ask.aRing && !couldFoldARing(ask.grade, makerOrdinal)) {
        return {
            theyCan: false,
            insteadTheyCouldMake,
            // The refusal that names the honest route, which had no caller
            // anywhere: nobody was ever told WHY a ring could not be made for
            // them, only that it could not.
            why: whyTheFoldWillNotHold(ask.grade, makerOrdinal),
            theBenchIsShortOf: []
        };
    }
    if (ask.slip === 'a_teleportation' && !couldCutATeleportationTalisman(makerOrdinal)) {
        return {
            theyCan: false,
            insteadTheyCouldMake,
            why: yours
                ? 'You can work the materials, and what you want folded into the paper is a road '
                  + 'you cannot walk yourself. Nobody folds a road into a teleportation talisman '
                  + 'they could not take. A strike slip of the same grade is within your hands.'
                : 'They can work the materials, and what you are asking them to fold into the '
                  + 'paper is a road they cannot walk themselves. Nobody folds a road into a '
                  + 'teleportation talisman they could not take. A strike slip of the same grade '
                  + 'is within their hands.',
            theBenchIsShortOf: []
        };
    }
    // A RING IS FOLDED AND NOT WORKED, so no recipe reaches it. Its grade names
    // how much it holds rather than what it is made of, which is the same
    // reason `couldFoldARing` answers it and `canRefineGrade` cannot, and the
    // same reason `whatACommissionComesTo` prices it as a fold.
    if (materialsToHand !== undefined && !ask.aRing) {
        const short = whatTheBenchIsShortOf(ask.grade, materialsToHand);
        if (short.length > 0) {
            return {
                theyCan: false,
                insteadTheyCouldMake,
                why: whyTheBenchIsShort(
                    ask.grade, materialsToHand, yours ? 'Your hands' : 'Their hands'
                ),
                theBenchIsShortOf: short
            };
        }
    }
    return { theyCan: true, insteadTheyCouldMake, why: null, theBenchIsShortOf: [] };
}

/**
 * How much of what this hand can do the work asks for, on 0..1. One at the gate
 * and nothing at the top of the ladder, which is why the same commission is an
 * afternoon to one person and a season to another.
 */
export function howMuchOfTheirReachItAsksFor(grade: TechniqueGrade, makerOrdinal: number): number {
    const gate = refiningOrdinalFor(grade);
    const roomAbove = MAX_ORDINAL - gate;
    if (roomAbove <= 0) return 1;
    const above = Math.max(0, makerOrdinal - gate);
    return clamp(1 - above / roomAbove, 0, 1);
}

// ═════════════════════════════════════════════════════════════════════════
// HOW LONG IT TAKES
// ═════════════════════════════════════════════════════════════════════════

/**
 * The days cutting one slip takes: a talisman, a strike slip, a way out.
 *
 * THE DESIGN OWNER'S, AND NOT THE GRADE'S. A communication talisman is mortal
 * grade and *"making a few takes little time"*: `CUT_IN_A_SITTING` of them in
 * `DAYS_A_SITTING_TAKES`, so a third of a day. A slip is the cheap single-use
 * kind of made thing, and the grade floors below are for making a pill or an
 * artifact; a slip is exempt from them by what it is.
 */
export const DAYS_TO_CUT_A_SLIP = DAYS_A_SITTING_TAKES / CUT_IN_A_SITTING;

/**
 * The days one pill or artifact of a grade takes the rung that can only just
 * make it.
 *
 * Each sits well above its grade's floor, so skill has room to save time:
 *
 *   mortal   two weeks, twice the week the floor holds
 *   earth    two months, as ruled: earth-grade work takes about a month whoever
 *            does it, and the hand that can only just do it takes about two
 *   heaven   nine years, the longest single work the world already states - what
 *            `YEARS_TO_COPY_THE_DEEPEST_ROAD` gives the deepest road in the
 *            catalog. A figure and not an import, so this file stays below the
 *            world; a test holds the two equal.
 */
export const DAYS_AT_THE_GATE: Readonly<Record<'mortal' | 'earth' | 'heaven', number>> = {
    mortal: 14,
    earth: 60,
    heaven: 9 * DAYS_PER_YEAR
};

/** The heaven anchor in years, which is what the test holds equal to the deepest road's copy. */
export const YEARS_TO_MAKE_A_HEAVEN_THING = DAYS_AT_THE_GATE.heaven / DAYS_PER_YEAR;

/**
 * The fewest days a pill or an artifact of a grade takes, however strong the hand.
 *
 * THE WORK HAS STEPS THAT TAKE THE TIME THEY TAKE: tempering, settling, letting
 * the qi set. A hand far past the grade does each step better and none of them
 * sooner. The design owner set the three: *"mortal-grade crafting takes at least
 * a week"*, earth-grade a month, heaven-grade a year. A slip is exempt, see
 * {@link DAYS_TO_CUT_A_SLIP}.
 */
export const THE_FEWEST_DAYS_THE_WORK_TAKES: Readonly<Record<'mortal' | 'earth' | 'heaven', number>> = {
    mortal: 7,
    earth: 30,
    heaven: DAYS_PER_YEAR
};

/**
 * How much of what a higher hand's time is worth goes into doing the work faster.
 *
 * HALF. A hand whose day is worth four times the gate maker's does the work in
 * half the days, and so asks twice as much for it: quicker, and dearer, which is
 * the design owner's ruling that a stronger maker's day is worth much more than
 * the days they save. Tying the saving to the worth is what keeps a stronger
 * maker from ever asking less for the same thing, at any rung.
 */
export const HOW_MUCH_OF_A_HANDS_WORTH_GOES_INTO_SPEED = 0.5;

/** The grade a made thing's days are read at. Nothing above heaven is made below the Lid. */
function theMadeGrade(grade: TechniqueGrade): 'mortal' | 'earth' | 'heaven' {
    return grade === 'mortal' || grade === 'earth' ? grade : 'heaven';
}

/**
 * The days making one thing takes this hand, as a fraction: what its time is
 * valued on. See {@link daysAtTheWork} for the whole days a span spends.
 */
export function daysAtTheWorkExactly(
    grade: TechniqueGrade,
    makerOrdinal: number,
    opts: { aSlip?: boolean } = {}
): number {
    if (opts.aSlip) return DAYS_TO_CUT_A_SLIP;
    const made = theMadeGrade(grade);
    const gate = refiningOrdinalFor(grade);
    const worthMore = whatAYearOfAMakersTimeIsWorth(Math.max(gate, makerOrdinal))
        / whatAYearOfAMakersTimeIsWorth(gate);
    return Math.max(
        THE_FEWEST_DAYS_THE_WORK_TAKES[made],
        DAYS_AT_THE_GATE[made] / Math.pow(worthMore, HOW_MUCH_OF_A_HANDS_WORTH_GOES_INTO_SPEED)
    );
}

/**
 * How many days making one thing of this grade takes this hand.
 *
 * The days at the gate for the grade, cut by how much more this hand's time is
 * worth than the gate maker's, never below the grade's floor; a slip is a third
 * of a day whatever the grade. Whole days, and at least one, because a span is
 * spent in days. The same days for a pill and a made thing: a grade is one
 * ladder (`howHighTheCommissionCarries`), and refining is making.
 */
export function daysAtTheWork(
    grade: TechniqueGrade,
    makerOrdinal: number,
    opts: { aSlip?: boolean } = {}
): number {
    return Math.max(1, Math.ceil(daysAtTheWorkExactly(grade, makerOrdinal, opts)));
}

// ═════════════════════════════════════════════════════════════════════════
// WHAT IT COSTS
// ═════════════════════════════════════════════════════════════════════════

/**
 * The rung at which `earningsPerYear` stops climbing: where its rank multiplier
 * reaches `EARNINGS_RANK_CAP`. Read off the curve's own constants, so it moves
 * if they do.
 */
export const WHERE_WAGES_ON_OFFER_STOP_CLIMBING = (EARNINGS_RANK_CAP - 1) / EARNINGS_PER_ORDINAL;

/**
 * What a year of a maker's own time is worth, at their realm, in spirit stones.
 *
 * THE DESIGN OWNER: *"how can stronger makers ask the same per day? Heaven
 * grade should be expensive because their time is vastly more expensive."*
 * `earningsPerYear` is the world's answer to what the work on offer pays a
 * rank, and it flattens at {@link WHERE_WAGES_ON_OFFER_STOP_CLIMBING}, because
 * nobody hires a Nascent Soul to guard a caravan. That is a fact about wages,
 * not about what a master's time is worth, so it is read up to where it
 * flattens and no further.
 *
 * PAST IT, EVERY RUNG IS WORTH `PRICE_GROWTH_PER_ORDINAL` MORE. Nothing in the
 * engine states a master's rate outright; what it does state is how steeply the
 * price of everything climbs with the rank it is for, which is the figure a
 * breakthrough pill and a torn meridian are priced on, and which
 * `origin-odds.ts` already ties a cultivator's own earning power to. So a hand
 * past the flat part asks what the flat part asked, times that growth for every
 * rung above it: continuous where the two meet, and never flat.
 */
export function whatAYearOfAMakersTimeIsWorth(makerOrdinal: number): number {
    const ordinal = Math.max(0, makerOrdinal);
    if (ordinal <= WHERE_WAGES_ON_OFFER_STOP_CLIMBING) return earningsPerYear(ordinal);
    return earningsPerYear(WHERE_WAGES_ON_OFFER_STOP_CLIMBING)
        * Math.pow(PRICE_GROWTH_PER_ORDINAL, ordinal - WHERE_WAGES_ON_OFFER_STOP_CLIMBING);
}

/**
 * What the maker's days at the work are worth, in spirit stones.
 *
 * THEIR OWN RATE, at their own realm, for as long as the work takes their
 * hand: {@link whatAYearOfAMakersTimeIsWorth} spread over the days of a year,
 * times `daysAtTheWork`. A higher hand spends fewer days on the thing, and each
 * of their days is worth far more than the days they save.
 */
export function whatTheMakersTimeComesTo(
    grade: TechniqueGrade,
    makerOrdinal: number,
    opts: { aSlip?: boolean } = {}
): number {
    return (whatAYearOfAMakersTimeIsWorth(makerOrdinal) / DAYS_PER_YEAR)
        * daysAtTheWorkExactly(grade, makerOrdinal, opts);
}

/**
 * What the materials of this grade come to, where the maker puts them in: the
 * cheapest thing that fills each slot of its recipe. Nothing for a grade no
 * recipe is worked for.
 */
export function whatTheMaterialsComeTo(grade: TechniqueGrade): number {
    const recipe = whatItIsMadeOf(grade);
    if (recipe === null) return 0;
    return recipe.reduce((sum, slot) => sum + (whatWouldFill(slot)[0]?.value ?? 0), 0);
}

/**
 * What a commission of this grade comes to in spirit stones, or null where
 * nobody below the Lid could make it: immortal and chaos grades are sent down
 * rather than made (`madeBelowTheLid`), so there is no maker to ask a price of.
 *
 * EVERY GRADE A HAND HERE CAN MAKE HAS A PRICE. The design owner, on heaven
 * grade: *"their time is vastly more expensive."* It used to stop at the grades
 * `gradeTradeTier` calls commodities and hand heaven-grade work to
 * `whatItWouldTake` with no figure at all.
 *
 * WHATEVER THE MAKER ASKS. The design owner: *"Whatever the maker asks. Their
 * time is presumably valuable, depends on realm."* So it is this maker's time at
 * this maker's rate, {@link whatTheMakersTimeComesTo}, and the materials they
 * put in. It was a year of the income of the rung that can only just make the
 * thing, whoever made it, which priced a master's afternoon as a novice's year.
 * With no maker named the hand is the one at the grade's own gate.
 */
export function whatACommissionComesTo(
    grade: TechniqueGrade,
    aRing = false,
    makerOrdinal: number = refiningOrdinalFor(grade),
    aSlip = false
): number | null {
    // A RING IS PRICED AS A FOLD, not as its materials. The design owner: a
    // heaven-grade ring is absurdly expensive, equivalent to a heaven-grade
    // spirit boat, and a court has maybe one - which is a statement about the
    // FOLD and not about the ore, and `whatARingCosts` is where it is made.
    if (aRing) return whatARingCosts(grade);
    if (!madeBelowTheLid(grade)) return null;
    if (aSlip) return Math.max(1, Math.round(whatASlipIsWorth(makerOrdinal, grade)));
    return Math.max(1, Math.round(
        whatTheMakersTimeComesTo(grade, makerOrdinal) + whatTheMaterialsComeTo(grade)
    ));
}

/**
 * What one slip is worth, in spirit stones: the cutter's time share and the
 * materials, as a fraction.
 *
 * THE SAME RULE AS ANY COMMISSION. A slip takes {@link DAYS_TO_CUT_A_SLIP} of the
 * cutter's day, so it is worth that share of their day's rate plus what its
 * grade's recipe puts in. A mortal slip asks for no recipe, so a communication
 * talisman is a third of its cutter's day and nothing else.
 *
 * AND NO PATH PAYS MORE. Slips are quick to cut and exempt from the grade floors
 * on days, so the guard against slips as a mint is the price: a slip sold,
 * turned in, or paid for off a board comes to this and never more. Nobody cuts a
 * day's slips and is paid more than their day. A caller paying whole stones
 * rounds down; a commission, which states a price, still states at least one.
 */
export function whatASlipIsWorth(cutterOrdinal: number, grade: TechniqueGrade = 'mortal'): number {
    return whatTheMakersTimeComesTo(grade, cutterOrdinal, { aSlip: true }) + whatTheMaterialsComeTo(grade);
}

/**
 * What a spirit stone put down is worth to this maker, as a share of a stone.
 *
 * The design owner: *"at ordinal 29 they want STUFF"*, *"nobody would take 20k
 * stones"*, and then *"generally, not a hard rule."* So it is not a rung at which
 * stones stop. It is the gap between what stones buy - the wages on offer,
 * `earningsPerYear`, which stop climbing at
 * {@link WHERE_WAGES_ON_OFFER_STOP_CLIMBING} - and what this maker's own year is
 * worth, {@link whatAYearOfAMakersTimeIsWorth}, which does not. Below that rung
 * the two are the same figure and a stone is a stone; every rung above it a
 * stone buys `PRICE_GROWTH_PER_ORDINAL` less of what this person's time is
 * worth, so by the Beast Change a stone is about a sixth of one to them and a
 * purse the size of the work's worth falls far short.
 *
 * AND THEIR WANTS DECIDE. A maker whose open want is wealth, or a debt to pay,
 * takes a stone as a stone however high they stand, which is the house short of
 * stones or the elder who needs a fortune.
 */
export function whatStonesAreWorthTo(
    makerOrdinal: number,
    whatTheyWant: { kind: string } | null
): number {
    if (whatTheyWant !== null && (whatTheyWant.kind === 'wealth' || whatTheyWant.kind === 'debt')) return 1;
    return clamp(earningsPerYear(makerOrdinal) / whatAYearOfAMakersTimeIsWorth(makerOrdinal), 0, 1);
}

/**
 * How high a thing of this grade carries whoever ends up with it. One ladder: a
 * made thing, a road and a medicine of one grade are worth the same height.
 */
export function howHighTheCommissionCarries(grade: TechniqueGrade): number {
    return pillBandOrdinal(grade);
}

// ═════════════════════════════════════════════════════════════════════════
// WILL THEY
// ═════════════════════════════════════════════════════════════════════════

/**
 * How far what somebody is to the asker can move them. Borrowed rather than
 * chosen: who you are to somebody weighs what being marked open-handed weighs.
 */
export const WHAT_A_TIE_IS_WORTH = DISPOSITION_BANDS.MARKED;

/** The range every reading is held to. */
const AXIS = 1;

/**
 * A nearness on -1..+1, so a stranger is a no before anybody has said anything.
 * The bands and their order are read from their own file, never restated.
 */
function howNearReads(nearness: Nearness): number {
    const last = NEARNESS_ORDER.length - 1;
    if (last <= 0) return 0;
    return (nearnessRank(nearness) / last) * 2 - 1;
}

export interface HowACommissionReads {
    ask: WhatYouAskedThemToMake;
    /** The maker's own rung, which decides how much of their reach it takes. */
    makerOrdinal: number;
    /** What the asker is to each person asked. Defaults to a stranger. */
    nearnessOf?: (personId: string) => Nearness;
    /** How far what is on the table reaches, 0..1. {@link howFarTheOfferReaches}. */
    paid?: number;
    /** What each person is, before any of this. Defaults to the world's reading. */
    base?: (personId: string) => number;
}

/**
 * Being asked to make something, as a reading of one person - the whole of what
 * this file contributes to a decision. Shaped to be handed to `whatTheBodyWants`
 * or `whetherItLeavesTheStore` as their `readingOf`, so a commission put to a
 * house runs through the offices and the room that can already refuse its own
 * patriarch, with no second approval path.
 *
 * The ledger is deliberately NOT in here: `whoDecidesIn` adds it on top of this
 * reading for every decider it weighs, and a favour must not be counted twice.
 */
export function howBeingAskedToMakeItReads(
    input: HowACommissionReads
): (personId: string) => number {
    const base = input.base ?? openHandednessOf;
    const nearnessOf = input.nearnessOf ?? (() => 'distant' as Nearness);
    const asksFor = howMuchOfTheirReachItAsksFor(input.ask.grade, input.makerOrdinal);
    const paid = clamp(input.paid ?? 0, 0, 1);
    return id => clamp(
        base(id) + WHAT_A_TIE_IS_WORTH * (howNearReads(nearnessOf(id)) - asksFor + paid),
        -AXIS,
        AXIS
    );
}

// ═════════════════════════════════════════════════════════════════════════
// AND THE WHOLE OF IT, PUT TO ONE PERSON
// ═════════════════════════════════════════════════════════════════════════

export interface AskingSomebodyToMakeYouSomething {
    ask: WhatYouAskedThemToMake;
    askerId: string;
    maker: { id: string; ordinal: number };
    /** What the maker is to the asker. Defaults to a stranger. */
    nearness?: Nearness;
    /**
     * Spirit stones put down. Counted at what stones are worth to this maker,
     * which is less the higher they stand: see {@link whatStonesAreWorthTo}.
     */
    stonesOffered?: number;
    /** Anything singular put down instead. Priced by `whatItWouldTake`. */
    onTheTable?: readonly OnTheTable[];
    /**
     * What this maker wants most, off their own open goals, or null where they
     * have stated none. The design owner: *"it depends on what a dude wants."*
     */
    whatTheyWant?: { text: string; kind: string } | null;
    /**
     * Things and favours put down, at their stone-equivalent worth, and whether
     * each is something this maker wants. Only a wanted thing counts toward the
     * work's worth: *"nobody would take 20k stones"*, and nobody takes a thing
     * they have no use for either.
     */
    thingsPutDown?: readonly { what: string; worthInStones: number; isWhatTheyWant: boolean }[];
    /**
     * Catalog ids of the material on the bench, from either side. Omitted means
     * nobody asked, which is not the same as an empty bench - see
     * `whetherTheirHandsCanDoIt`.
     *
     * Whose stuff it is is deliberately not a field here. A master who has the
     * stock and a disciple who walked in with it are the same bench as far as
     * the hands are concerned; who paid for it is the ledger's question, and the
     * ledger already reads it through `onTheTable`.
     */
    materialsToHand?: readonly string[];
    /** Open records between these two, in either direction. */
    ledger?: readonly ObligationRecord[];
    onDay: DayIndex;
    /** Ignore anything incurred after this day. Omit to read everything. */
    asOfDay?: DayIndex;
    /** How open-handed the maker is. Defaults to the world's own reading. */
    readingOf?: (personId: string) => number;
}

export interface WhetherTheyWillMakeIt {
    hands: WhetherTheirHandsCanDoIt;
    /**
     * What the work is worth, in stone-equivalent, or null where nobody below the
     * Lid could make it. A measure and not a price the maker must take: what is
     * put down is judged against it, and stones count at what they are worth to
     * this maker.
     */
    priceInStones: number | null;
    /** What a stone put down is worth to this maker, 0..1. */
    whatAStoneIsWorthToThem: number;
    /** The barter, priced. Null where the hands refused before it was read. */
    theTable: WhatItWouldTake | null;
    /** How far what was put down reaches, 0..1. */
    paid: number;
    /** The maker's leaning, -1..+1, or null where their hands refused. */
    reading: number | null;
    /** What the ledger did to them. Empty counts where it did nothing. */
    whatMovedThem: WhatMovedThem;
    agreed: boolean;
    /**
     * What the asker now owes them, where they agreed and it was not paid for.
     * A record and not a field: the next thing this asker wants from them reads
     * it through the same `whatTheyCarryAbout` every other ask reads.
     */
    owed: ObligationInput | null;
    /** Engine truth, one line. Never narration. */
    line: string;
}

/**
 * Whether they will make it, and what it would take. Every refusal names its own
 * route, because the four are four different things to do something about: a
 * realm they have not reached, a fold they cannot make, a figure that was not
 * met, and a person who does not care enough about the asker to spend a season.
 *
 * ── AND IT IS READ FROM BOTH SIDES ───────────────────────────────────────
 *
 * The design owner asked for the flip side - taking a commission yourself - and
 * there is no second function for it, deliberately. Put the player in `maker`
 * instead of `askerId` and this answers what SOMEBODY ELSE would have to bring
 * before the player agrees. It is the same three questions with the two people
 * swapped, and that is the whole point: a player and an NPC are the same kind of
 * thing being asked the same question, so one ladder is read in both directions
 * and what somebody would pay you is what you would pay them.
 *
 * The player is not exempt from the tie either. A master who asks you is not a
 * stranger asking you, and `nearness` says so from this side exactly as it does
 * from the other.
 */
export function askingSomebodyToMakeYouSomething(
    input: AskingSomebodyToMakeYouSomething
): WhetherTheyWillMakeIt {
    const hands = whetherTheirHandsCanDoIt(
        input.ask,
        input.maker.ordinal,
        input.materialsToHand
    );
    const priceInStones = whatACommissionComesTo(
        input.ask.grade, false, input.maker.ordinal, Boolean(input.ask.slip)
    );
    const stoneWorth = whatStonesAreWorthTo(input.maker.ordinal, input.whatTheyWant ?? null);

    if (!hands.theyCan) {
        return {
            hands,
            priceInStones,
            whatAStoneIsWorthToThem: stoneWorth,
            theTable: null,
            paid: 0,
            reading: null,
            whatMovedThem: { favoursOwed: 0, wrongsHeld: 0, heaviest: null },
            agreed: false,
            owed: null,
            // A HAND THAT CANNOT AND A BENCH THAT IS BARE ARE TWO ANSWERS. One
            // is a realm somebody has to reach and the other is a morning's
            // gathering, and a line that said "their hands cannot" about the
            // second would send the asker after the wrong thing entirely.
            line: hands.theBenchIsShortOf.length > 0
                ? `${input.ask.named}: their hands can and the stuff is not here. `
                  + `${hands.why ?? ''}`.trim()
                : `${input.ask.named}: their hands cannot. ${hands.why ?? ''}`.trim()
        };
    }

    const theTable = whatItWouldTake(
        {
            // Nobody is holding the thing yet, so there is no present need to be
            // refused over and nobody else's say to wait on. What is being asked
            // for is a person's time, and the price is the thing's own rung.
            theirClaimCanWait: true,
            theirsToGive: true,
            itCarriesTo: howHighTheCommissionCarries(input.ask.grade),
            theyReachTo: input.maker.ordinal
        },
        input.onTheTable ?? []
    );
    const paid = howFarTheOfferReaches({
        priceInStones,
        stonesOffered: (input.stonesOffered ?? 0) * stoneWorth,
        theTable,
        wantedWorthPutDown: (input.thingsPutDown ?? [])
            .filter(thing => thing.isWhatTheyWant)
            .reduce((sum, thing) => sum + Math.max(0, thing.worthInStones), 0)
    });

    const moved = whatTheyCarryAbout({
        deciderId: input.maker.id,
        askerId: input.askerId,
        ledger: input.ledger ?? [],
        ...(input.asOfDay === undefined ? {} : { asOfDay: input.asOfDay })
    });

    const leaning = howBeingAskedToMakeItReads({
        ask: input.ask,
        makerOrdinal: input.maker.ordinal,
        nearnessOf: () => input.nearness ?? 'distant',
        paid,
        ...(input.readingOf === undefined ? {} : { base: input.readingOf })
    })(input.maker.id);

    const reading = clamp(leaning + moved.moved, -AXIS, AXIS);
    const agreed = whetherThatIsAYes(reading, paid);

    return {
        hands,
        priceInStones,
        whatAStoneIsWorthToThem: stoneWorth,
        theTable,
        paid,
        reading,
        whatMovedThem: moved.whatMovedThem,
        agreed,
        owed: agreed && paid < 1 ? aFavourForTheWork(input, paid) : null,
        line: agreed
            ? `${input.ask.named}: they will, at ${reading.toFixed(2)}`
              + `${paid >= 1 ? ', paid for' : `, ${Math.round(paid * 100)}% paid for`}.`
            : `${input.ask.named}: they will not, at ${reading.toFixed(2)}. `
              + (paid >= 1
                  ? 'The price was met and they still would rather not, which is about them '
                    + 'and not about the figure.'
                  : whatWouldMeetIt(priceInStones, theTable, {
                      stonesOffered: input.stonesOffered ?? 0,
                      stoneWorth,
                      whatTheyWant: input.whatTheyWant ?? null
                  }))
    };
}

/**
 * Whether that reading is a yes.
 *
 * A MET PRICE IS THE ARMOURY ELDER'S RUBBER STAMP - below the line things have
 * prices, and somebody offered what a thing is worth says yes unless they
 * positively do not want to. `A_REASON_TO_SAY_NO` is borrowed rather than
 * chosen. Measured before it, at the old flat price: a stranger putting down the full 54 stones for a
 * mortal slip was agreed with 19% of the time, which is a wall wearing an
 * economy. Under-paying is unchanged, and where there is no maker to ask a price
 * of, a purse never meets one.
 */
export function whetherThatIsAYes(reading: number, paid: number): boolean {
    return paid >= 1 ? reading > -A_REASON_TO_SAY_NO : reading > 0;
}

/**
 * How far what was put down reaches, 0..1. Stones count for every grade a maker
 * has named a price for; where the price is null - nothing below the Lid makes
 * the thing - a purse is worth nothing however large, and the table is what
 * reaches.
 */
export function howFarTheOfferReaches(input: {
    priceInStones: number | null;
    /** Stones put down, already counted at what they are worth to the maker. */
    stonesOffered: number;
    theTable: WhatItWouldTake;
    /** The stone-equivalent worth of things put down that the maker wants. */
    wantedWorthPutDown?: number;
}): number {
    const stones = input.priceInStones !== null && input.priceInStones > 0
        ? clamp((Math.max(0, input.stonesOffered) + Math.max(0, input.wantedWorthPutDown ?? 0))
            / input.priceInStones, 0, 1)
        : 0;
    const bar = Math.max(1, input.theTable.theHeightToReach);
    const put = input.theTable.itIsATrade
        ? 1
        : clamp(input.theTable.theBestOnTheTable / bar, 0, 1);
    return Math.max(stones, put);
}

/**
 * What would meet it, for the refusal to name.
 *
 * Where stones were put down and stones are worth little to this maker, that is
 * said as the fact it is, and then what they would take instead: the thing they
 * want where they have stated one, and otherwise something singular worth what
 * the work is worth. Never a hard rule about a rung.
 */
function whatWouldMeetIt(
    priceInStones: number | null,
    theTable: WhatItWouldTake,
    offer: { stonesOffered: number; stoneWorth: number; whatTheyWant: { text: string; kind: string } | null }
): string {
    if (priceInStones === null) return theTable.line;
    const instead = offer.whatTheyWant !== null
        ? `What they want is ${offer.whatTheyWant.text}, and that, or something toward it worth what `
          + `${priceInStones} spirit stones would be, is what they would take.`
        : `What they would take is something singular, or a favour owed, worth what ${priceInStones} `
          + 'spirit stones would be.';
    if (offer.stonesOffered > 0 && offer.stoneWorth < A_STONE_COUNTS_IN_FULL) {
        return `Stones are worth little to a hand at this height against what they want: a stone put `
            + `down counts for ${Math.round(offer.stoneWorth * 1000) / 10}% of one to them. ${instead}`;
    }
    return `Nothing near what it is worth was put down: the work is worth what ${priceInStones} `
        + `spirit stones would be. ${instead}`;
}

/** At or above this share a stone counts as a stone. */
const A_STONE_COUNTS_IN_FULL = 0.999;

/**
 * How heavy a debt an unpaid commission is. The two four-step ladders read at
 * the same step, which is the claim: a debt is as heavy as the thing that made
 * it is worth keeping a record of.
 */
export function howHeavyAnUnpaidCommissionIs(grade: TechniqueGrade): Severity {
    switch (howMuchAGradeIsWorthTracking(grade)) {
        case 'mundane':
            return 'slight';
        case 'notable':
            return 'serious';
        case 'significant':
            return 'grave';
        case 'legendary':
            return 'unforgivable';
    }
}

/**
 * The row an unpaid commission opens, held by the maker. `gifted_resource`,
 * because a thing made and handed over for nothing is one - there is no
 * commission cause and there must not be one. This is the whole of the favour
 * route: the next thing this asker wants from them reads the row through
 * `whatTheyCarryAbout`, exactly as it reads any other.
 */
function aFavourForTheWork(
    input: AskingSomebodyToMakeYouSomething,
    paid: number
): ObligationInput {
    return {
        kind: 'favor',
        holderId: input.maker.id,
        subjectId: input.askerId,
        cause: 'gifted_resource',
        severity: howHeavyAnUnpaidCommissionIs(input.ask.grade),
        onDay: input.onDay,
        description: `Made ${input.ask.named} for them`
            + (paid > 0 ? ' for less than it was worth.' : ' and took nothing for it.'),
        tags: ['commission', input.ask.grade]
    };
}

function clamp(n: number, lo: number, hi: number): number {
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}
