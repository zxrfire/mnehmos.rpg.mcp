/**
 * Pressure: the world changing on its own.
 */

import { searchingMastersTakeADisciple } from './the-disciples-a-world-opens-with.js';
import { isLostTrackOf } from './who-a-house-has-lost-track-of.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { applyWhoOwnsThemNow } from './what-becomes-of-a-houses-things-when-the-house-ends.js';
import { whatASearchBroughtBack } from './what-a-search-brings-back.js';
import { theHousesSendSomebodyLooking } from './a-house-sends-somebody-looking.js';
import { beastsOnThisGround, bandOf, whatComesOffTheBody } from './hunting-a-spirit-beast.js';
import { whatGroundThisIs } from './what-ground-a-place-is.js';
import { whoIsInChargeOfWhat, type APortfolio } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { theRoomsThisHouseHas } from '../social-leverage/authority-for-an-order.js';
import { rankName, triggersHeavenlyTribulation } from '../cultivation/realms.js';
// Pressure is the LOWER world's own affairs, and only its own. Every selection
// in this file is filtered to the mortal layer, because politics above the Lid
// has been running uninterrupted for a very long time and is not something this
// module gets to reorganise on a fifty-five-events-per-century budget. The far
// side is `advanceImmortalLayer`, which the driver runs on the same slice.
import { IMMORTAL_LAYER, isBelowTheLid } from './layers.js';
import {
    FALSE_IMMORTAL_ORDINAL,
    LAST_CROSSING_ORDINAL,
    TRUE_IMMORTAL_ORDINAL,
    baseBreakthroughChance,
    lifespanForOrdinal,
    realmForOrdinal
} from '../cultivation/realms.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import {
    fillConsequences,
    makeFact,
    yearOfDay,
    type EventConsequences,
    type HistoricalFact
} from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import {
    groundAPartyCanBeSentTo,
    theGroundAHouseHolds,
    whereASendingGoes,
    groundTheseHousesHold,
    whichHousesAReasonIsAbout
} from './who-goes-out-for-a-house-and-what-comes-back.js';
import {
    armItsOwn,
    howTheWarGoesFor,
    type HandedOut
} from './what-a-house-opens-its-treasury-for.js';
import { HALLS_DOWN } from './what-a-year-of-war-does-to-a-compound.js';
import { transferPossession, type ObjectRecord } from './possessions.js';
import { theArtLeftInThisGround } from './a-legacy-has-a-name-on-it-and-a-treasury-has-stock.js';
import { recordCrossing } from './recording-what-a-crossing-did.js';
import { aCrossingEntersTheWorld } from './a-crossing-enters-the-world-as-news.js';
import {
    asItStandsNow,
    theRungThisRowShouldBeAt
} from './a-beast-climbs-by-sitting-where-it-is.js';
import {
    theNameItTookAtTheChange,
    theSpeciesItIs
} from './a-beast-with-a-core-is-somebody-in-particular.js';
import { recordPromotion } from './recording-where-somebody-stands-in-a-house.js';
import {
    applyLocationChange,
    aSealHereMeansAnUndrawnPocket,
    forbidZone,
    isOpenOn,
    LEFT_TO_BE_FOUND,
    nextClosingDay,
    nextOpeningDay,
    populationWeightOf,
    whatATownPaysItsHolder,
    qiFraction,
    walkingDaysFrom,
    windowStartOn,
    type LocationRecord
} from './locations.js';
import { WHAT_SHUTS_IT, whatShutsThisDoor } from './a-door-that-closes-is-not-a-door-nobody-opened.js';
import {
    theErrandADoorIs,
    whoSendsWhenADoorOpens,
    type AHouseOnTheRoad
} from './a-door-that-opens-is-a-race.js';
import {
    whatOneOfTheWorldsOwnPeopleKnows,
    type WhatSomebodyKnowsOfIt
} from './what-one-of-the-worlds-own-people-knows.js';
import { runCascade } from './cascade.js';
import {
    howThePurseIsRunning,
    whetherTheHouseReaches,
    whichGroundWouldPayIt,
    type GroundThatPays
} from './what-a-house-does-when-it-cannot-pay.js';
import { ruinFromFallenSeat } from './provenance.js';
import {
    WHEN_IT_IS_AN_OLD_WOUND,
    WHERE_THE_OLD_MONSTERS_BEGIN,
    howManyLivingHoldEachArt,
    theArtsOnlyTheyHold,
    theWakeOfADeath,
    theirDeathWouldRearrangeTheWorld,
    whatADeathIsWorth,
    whatTheyHeldUp
} from './what-a-death-at-this-height-is-worth.js';
import { claimOpportunity, nextWindow, years } from './opportunities.js';
import {
    activeGoals,
    addGoal,
    createNpc,
    isAwayOnSomething,
    isTheWorldsToMove,
    theWorldEnds,
    theWorldLoses,
    theWorldMayEnd,
    relationshipWith,
    setLocation,
    whereTheyGoBackTo,
    setRealm,
    theTieBecomes,
    upsertRelationship,
    type NpcRecord
} from './npc-state.js';
import { andLetGoAtTheOtherEnd, andTheOtherEnd } from './a-tie-has-two-ends.js';
import { enterWhoeverHasReachedTheHouse } from './a-recruit-is-given-their-lamp-at-the-house.js';
import { theyOweTheHouseAReport } from './a-house-expects-somebody-it-took-on.js';
import { theRoadsOntoARollThisYear } from './the-world-joins-a-house-the-way-a-player-does.js';
import { FACTION_PARENTAGE } from '../../data/cultivation/governance-and-water-rights.js';
import {
    haveTheyWorkedItOut,
    resolveAttempt,
    theGroundUnderYou,
    whatTheyDoAboutIt,
    type AskWeight
} from '../social-leverage/index.js';
import { whoHoldsTheGround } from './ground-holder.js';
import { whoAHouseWillTake } from '../../data/cultivation/the-three-floors-a-house-admits-at.js';
import { applyRuinProspecting } from './how-the-world-keeps-finding-more-ruins.js';
import { repairRetiredWoundKeys } from './recording-the-day-a-wound-was-taken.js';
import { deriveOrdinal, whatItCanPutOnTheGround } from './seeding.js';
import {
    guidanceFor,
    readyToStrike,
    strikeAtTheWall,
    whatTeachingLeavesOfAMastersRate
} from './an-npc-striking-at-the-next-wall.js';
import { standsOnAnUnreachableClock } from './who-sits-in-the-hollow-court.js';
import { stillHasPeopleNobodyModels, theHousesTakeInTheirOwn } from './a-house-takes-in-one-of-its-own.js';
import { theHousesAreCounted } from './how-many-people-a-house-has.js';
import { theHousesTakeInEldersFromOutside } from './a-house-takes-in-an-elder-from-outside.js';
import { coverTheEmptyChairs } from './somebody-covers-a-house-with-no-head.js';
import { theTopOfAHouseChangesHands } from './a-house-changes-who-leads-it.js';
import { theConclavesAreContested } from './a-conclave-seat-is-won-in-a-tournament.js';
import { theChallengesThisYear } from './a-challenge-is-answered-on-the-yard.js';
import { aChildTakesTheirParentsLine } from './a-child-takes-their-parents-line.js';
import { getOrigin } from '../cultivation/origin.js';
import {
    groundRateAt, groundTimeShares, houseFallbackRate, rateOverTheYear, roomsHeldBy,
    type GroundClaimant
} from './the-ground-somebody-is-actually-standing-on.js';
import { manualQualityRank } from '../cultivation/manual-quality.js';
import {
    DAO_GROUND_TAG,
    applyRoadsComprehended,
    groundAtLocation,
    howSomebodyStandsToAGround,
    roadsInReachOf,
    standingOfNpc,
    type GroundAsTheRuleReadsIt
} from './how-a-cultivator-comes-by-a-road.js';
import { houseTeachingCeiling } from '../../data/cultivation/index.js';
import {
    whereTheyWouldGo,
    howMuchTheirReasonsWeigh,
    whetherTheyGoThisYear,
    whatLeavingTheirHouseCosts,
    whoWouldGoWithThem,
    whyTheyWouldLeave,
    type SomewhereWorthGoing,
    type WhyTheyWentOut
} from './why-somebody-walks-out-of-a-compound.js';
import type { AmbientQi, ApproachLeverage } from '../../schema/cultivation.js';
import {
    applyManualCopying,
    handOnWhatTheyAreEntitledTo, refreshChosen, reachableCeilingFor,
    mightFindARoad, roadTheyFound, librariesCarriedOutBy, BOOKLESS_CEILING
} from './manuals.js';
import { applyWhatThePartyCarriedOut } from './what-a-ruin-has-on-its-shelves.js';
import { giveThisYearsAttention } from './who-is-given-attention-this-year.js';
import { creditMerit, whatServiceIsWorth } from './what-a-house-counts-in-somebodys-favour.js';
import {
    OUT_LOOKING_FOR, peopleTakeWorkOffTheirHousesBoard, theBoardWorkTheyAreOn,
    whatFinishingBoardWorkPays, whoTheyWereSentAfter
} from './a-disciple-takes-work-off-the-board.js';
import { peopleTurnInWhatTheirHouseWants } from './what-a-house-gives-merit-for.js';
import { assessPromotions } from './promotion-inside-a-house.js';
import {
    howHardBeingHeldBackPresses,
    noteWhoIsHeldBack,
    whereTheyAreHeldBack
} from './being-held-back-in-a-house.js';
import { whoSplitsAHouse } from './who-splits-a-house-and-who-goes-with-them.js';
import { howLoudALeavingIs, whatTheirLeavingStirs } from './what-somebody-senior-leaving-stirs.js';
import { theWanderersGoAbout } from './the-wanderer-the-catalog-names-is-somebody.js';
import { peopleWithNoHouseMoveOn } from './where-somebody-with-no-house-goes.js';
import { woundsCloseThisYear } from './what-a-house-does-about-its-people-being-hurt.js';
import {
    A_ROOM_SAW_IT,
    theHouseWasSeenToWin,
    theirDiscipleCrossed
} from './what-being-seen-to-do-well-is-worth.js';
import { TURNED_AWAY_AT_A_GATE, WHAT_A_GATE_REFUSES_FOR_GOOD, wasTurnedAwayAtAGate } from './the-rogues-a-world-opens-with.js';
import { peopleActOnWhyTheyWouldKill, seatsThePeopleHeldBackWant } from './a-year-of-people-acting-on-why-they-would-kill.js';
import { peopleBringWhatTheyKnowToTheRoom, theRoomWouldDealToThemAgain } from './bringing-what-you-know-about-somebody-to-the-room.js';
import { whatComesToLightThisYear } from './what-comes-to-light-about-a-killing.js';
import {
    ROGUE_FLED,
    ROGUE_HOUSE_FELL,
    aHouseWouldTakeThemAnyway,
    CAME_OFF_A_ROLL_AT,
    whatTakingInSomebodysCastOffStirs,
    offTheRoll,
    releaseTheRoll,
    whereTheyRunTo,
    whetherTheyFall
} from './what-becomes-of-a-houses-people-when-it-is-gone.js';
import { theOathOnTheWayOut } from './the-word-an-npc-gave.js';
import {
    applyOrdinaryLifeTies,
    applyPassedOver,
    bindNewbornToHousehold,
    couldParent,
    rosterOf,
    type Roster
} from './the-ties-an-ordinary-life-produces.js';
import {
    assessTheReturn,
    fosterTheChild,
    isConcealed,
    wasFostered,
    whoCouldBeAsked,
    whyTheirOwnHouseWillNotKeepThem,
    type FosterCandidate,
    type FosteringReason
} from './a-child-their-own-house-will-not-keep.js';
import { shameTag } from '../social/shame.js';
import { fosterageTermsOf } from '../../data/cultivation/sects.js';
import type { OriginTierKey } from '../cultivation/origin.js';
import { applyDoorsAndTheirPlaces, type ADoorsYear } from './a-year-at-the-doors.js';
import { convergenceOf } from './convergence.js';
import {
    whatAHouseWouldSell,
    type AHouseAtTheTable
} from './a-house-sells-what-it-built.js';
import { boughtFromItsOwner } from './ownership-transfer.js';
import { applyGatherings, circleCandidatesFor } from './gatherings.js';
import {
    fightTheWarsThisYear,
    highestRankAlive,
    whatAHouseCanPutOut,
    areAtWarWithEachOther
} from './war-melee.js';
import type { ObligationInput } from '../social/grudges.js';
import {
    isInTheAirFor,
    // CIRCULATION'S OWN SPELLING OF IT, and not the `regionOf` further down this
    // file. The two walk the parent chain to different stopping points, and
    // `howFarOff` compares the fact's region - computed with this one - against
    // `teller.regionId`. A teller built with the local one would be measured
    // against a region it was never in, and the whole province would go quiet.
    regionOf as theRegionNewsIsMeasuredIn,
    whereThisPersonIsStanding,
    type TellerStanding
} from './what-people-are-saying.js';
import type { OnTheRoll } from '../social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import {
    ALLIED_STANDING,
    WORTH_REPEATING,
    aFindThisHouseCouldSendFor,
    forbiddenGroundInTheProvinceOf,
    whatAHousesOwnErrandsBringBack,
    whatAnybodyCouldHaveOfTheGround,
    whatStandingOnItGives,
    whatTheAirCarriesOfTheGround,
    whereTheOpenGroundIs,
    postingFor,
    reasonsOpenTo,
    resolveSending,
    newsOfASending,
    newsOfAPartyStillOut,
    whatAFailedSendingTakes,
    whenTheErrandHappened,
    isImpossibleTier,
    lostChance,
    notFinishedChance,
    partyOrdinal,
    tierFor,
    whatTheHouseCanSpare,
    whoTheHouseCanSend,
    whoThisErrandIsPitchedFor,
    type OnTheRollForAnErrand,
    type Candidate,
    type HouseAsItStands
} from './who-goes-out-for-a-house-and-what-comes-back.js';
import { regardFor } from '../cultivation/regard.js';
import { wellBeneathYou } from '../encounters/duties.js';
import {
    WHAT_A_MEAL_IS_WORTH,
    aPieceOfABodyNobodyHasTaken,
    theGroundHasABodyOnIt,
    whatIsWorthARowOffABody
} from './a-beast-that-climbs-also-fights-and-dies.js';
import {
    CARRIAGES_BY_GRADE,
    CONVEYANCE_RECIPES,
    WHAT_A_CRAFT_COSTS_TO_COMMISSION,
    adjustCountedHolding,
    countedHolding,
    getConveyance,
    requireConveyance
} from '../../data/cultivation/what-a-house-moves-its-people-on.js';
import {
    bestForThisRoad,
    type Conveyance
} from './what-a-conveyance-does-to-a-journey.js';
import {
    conveyanceKeptAs,
    deliver,
    launch,
    layDownKeel,
    mintCraft,
    readyToLaunch,
    workOn,
    type Berth,
    type MaterialLot
} from './building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import { canRefineGrade } from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import { BEAST_CORE_ORDINAL } from '../../data/cultivation/beasts.js';
import { getTechnique, gradeForOrdinal } from '../../data/cultivation/techniques.js';
import { STOCK_GRADES } from './what-a-place-still-has-in-the-ground.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';
import {
    recordGroundDraw,
    whatThePeopleHereTake
} from './what-a-place-still-has-in-the-ground.js';
import {
    statusKey,
    whatIsWrongWithPlacesToday,
    type GroundAsItStands
} from './what-goes-wrong-with-a-place-and-what-ends-it.js';
import {
    extendStatus,
    liftStatus,
    makeAreaStatus,
    statusesInArea,
    type AreaStatus
} from './what-is-true-of-a-place-right-now.js';
import { settleNpcDeath, type DeathHandoff } from './time.js';
import {
    theMakerThisIs,
    whatCuttingForTheHouseLands,
    whatCuttingPays,
    wordFromThePeopleAway
} from './what-a-house-hears-from-its-people-away.js';
import {
    indexById,
    getLocation,
    makeFaction,
    schedule,
    type FactionRecord,
    type WorldState
} from './world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// SHAPE
// ─────────────────────────────────────────────────────────────────────────

export type PressureKind =
    /**
     * A house is ended by another house, and then the survivors choose.
     */
    | 'house_destroyed'
    /**
     * Something sealed came open on its own schedule, with nobody's intent behind
     * it.
     */
    | 'convergence_opened'
    | 'convergence_closed'
    /**
     * The chosen of allied houses met, and something came of it.
     */
    | 'gathering'
    | 'vein_lost'
    | 'elder_died'
    | 'killing'
    | 'ruin_opened'
    | 'opportunity_taken'
    | 'border_moved'
    | 'deference_tested'
    | 'faction_fell'
    | 'faction_founded'
    | 'technique_lost'
    | 'market_shifted'
    | 'war_opened'
    | 'war_settled'
    /**
     * A year of a war was fought, and the resolver said what happened.
     */
    | 'war_fought'
    /**
     * A war ended and the losing side's hold changed hands.
     */
    | 'spoils_taken'
    /**
     * A house at war opened its vault and put its own good weapons into its
     * own people's hands. Lent, never given.
     */
    | 'house_armed_its_own'
    /** Something came off the ground and into a town people live in. */
    | 'beast_came_down'
    /**
     * Somebody is late back, and the person whose job it is has said so.
     */
    | 'overdue'
    | 'zone_forbidden'
    | 'migration'
    | 'disappearance'
    /**
     * Somebody worked on somebody: a purse, a house's weight, an account, or
     * nothing but themselves, put down in front of a person to get something out of
     * them.
     */
    | 'leverage_applied'
    /**
     * And years later, the other party understood what it had been for.
     */
    | 'leverage_understood';

export interface PressureEvent {
    kind: PressureKind;
    onDay: number;
    fact: HistoricalFact;
    /** Ids of anything whose state this actually moved. */
    touched: { factions: string[]; locations: string[]; npcs: string[] };
    deaths: DeathHandoff[];
    /**
     * Accounts this event opened, ready for the ledger. Usually none.
     */
    opens?: ObligationInput[];
}

export interface PressureResult {
    events: PressureEvent[];
    /** Years actually stepped. Zero when no year began inside the span. */
    yearsStepped: number;
    /** People born into the world across the span. */
    born: number;
}

/**
 * Events per year for a world of this size.
 */
export const EVENTS_PER_FACTION_YEAR = 0.055;
/** Floor, so even a nearly dead world is not silent. */
export const MIN_EVENTS_PER_YEAR = 0.15;
/** Ceiling, so a large world does not become a newsfeed. */
export const MAX_EVENTS_PER_YEAR = 3;

/**
 * What a house feels toward the people who just embarrassed its rival.
 */
export const SYMPATHY_AT_A_SCHISM = 0.25;

export interface PressureOptions {
    /** Multiplier on the event rate. For tests and for tuning. */
    intensity?: number;
    /** Cap on events applied in one call, whatever the span. */
    maxEvents?: number;
    /**
     * Whether a house that could not pay its own people may act on it.
     *
     * Defaults to true and the game never turns it off. It exists because
     * AGENTS.md is explicit that a stash-and-rerun is not a control arm and
     * both arms have to run in one command: this is the only lever that removes
     * the motive without removing anything else, so the world either side of it
     * is the same world.
     */
    housesActOnAnEmptyPurse?: boolean;
    /**
     * Whether somebody on a roll may decide for themselves to leave it.
     *
     * The second arm, and separate from the one above on purpose: the two
     * mechanisms share a reading of the purse and are otherwise unrelated, and
     * one flag for both would have measured their sum.
     */
    peopleWalkOutOnTheirOwnAccount?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Advance the world's own affairs across a span.
 */
export function applyPressure(
    state: WorldState,
    fromDay: number,
    toDay: number,
    opts: PressureOptions = {}
): PressureResult {
    const events: PressureEvent[] = [];
    const intensity = opts.intensity ?? 1;
    const actOnAnEmptyPurse = opts.housesActOnAnEmptyPurse ?? true;
    const peopleWalkOut = opts.peopleWalkOutOnTheirOwnAccount ?? true;
    const maxEvents = opts.maxEvents ?? 4000;

    // ── WHICH YEARS THIS SPAN OWNS ───────────────────────────────────────
    //
    // A year belongs to the span holding its FIRST day: `fromDay <= year*365 <
    // toDay`. Adjacent spans therefore partition the year starts between them,
    // so every chopping of a span steps each year exactly once and in the same
    // order - which is the whole of decomposability here.
    //
    // This was `yearOfDay(fromDay) + 1` to `yearOfDay(toDay)`, numbering the
    // year ONE AHEAD of the span it was handed. Every line below dates itself
    // at `year*365 + offset` with `offset` under 365 and `withinSpan` clamps
    // the rest, so on the 365-day slices the driver runs, `year*365` WAS the
    // last day of the slice and a whole year of the world landed on it. Seeds
    // alpha, beta and gamma at 200 played years: 1.05 distinct days per year,
    // 2852 of 2862 facts on a year boundary. A 200-year bulk span is off by
    // one year in two hundred, which is why only the played path showed it.
    //
    // WHAT THIS STILL HAS NO ANSWER FOR: a year is simulated atomically, so a
    // span shorter than one steps the whole year or none of it, and on a world
    // whose day is off the year grid the rest of the year clamps to the span's
    // end. Spreading one year's schedule over several calls needs a cursor
    // this layer does not keep - the same gap `whenTheErrandHappened` writes
    // down from its own end.
    const firstYear = Math.ceil(fromDay / DAYS_PER_YEAR);
    const lastYear = Math.ceil(toDay / DAYS_PER_YEAR) - 1;
    let yearsStepped = 0;
    let born = 0;

    // Worlds are persisted, so retiring a wound key in the catalog does not
    // retire the rows already carrying it. Once per pass rather than per year:
    // it is idempotent and it has nothing to do after the first sweep.
    repairRetiredWoundKeys(state);

    for (let year = firstYear; year <= lastYear && events.length < maxEvents; year++) {
        yearsStepped++;
        const rng = forStream(state.seed, 'pressure', year);
        /** The last day of the year being reported on, which is not the span's. */
        const yearEndsOn = year * 365 + 364;

        // People go out looking, and sometimes they find something the Late Age
        // left. BEFORE the event draw, so a ruin found this year is a ruin this
        // year's `ruin_opened` can open - discovery and opening are two stages of
        // one thing and the ordering is what makes them separable.
        applyRuinProspecting(state, year, withinSpan(year * 365 + 40, fromDay, toDay));

        const live = state.factions.filter(f => f.dissolvedOnDay === null && isBelowTheLid(f)).length;
        const rate = clamp(
            live * EVENTS_PER_FACTION_YEAR * intensity,
            MIN_EVENTS_PER_YEAR * intensity,
            MAX_EVENTS_PER_YEAR * intensity
        );

        // Whole events plus a fractional chance at one more. Cheap, stable, and
        // it lets a rate below one still produce something occasionally.
        let count = Math.floor(rate);
        if (rng.chance(rate - count)) count++;

        for (let i = 0; i < count && events.length < maxEvents; i++) {
            // The draw is unconditional so the stream does not depend on where
            // the span happens to end; the DATE is clamped, because a fact
            // dated after the world's own clock is incoherent and the soak
            // rightly refuses it.
            const day = withinSpan(year * 365 + rng.int(0, 364), fromDay, toDay);
            const event = fireOne(state, day, forStream(state.seed, 'pressure-event', year, i));
            if (event) events.push(event);
        }

        // Windows open and shut on their own clock, not on the event budget.
        // Deliberately outside the draw loop and outside `maxEvents`: a
        // convergence that only happens when the year had a slot free is not a
        // schedule, and "the world did something, and nobody did it" is the
        // entire content of this one.
        events.push(...applyConvergences(state, year, fromDay, toDay));

        // Then the parts of a year that are arithmetic rather than incident: people
        // advance, institutions pay their bills, and children are born. Births
        // last, so a year's dead are counted before its replacements. The ground
        // under everybody, worked for a year by the people standing on it. FIRST of
        // the arithmetic passes, so what a place has left is true of it before
        // anybody advances, is recruited or is born onto it.
        applyGroundPressure(state, withinSpan(year * 365 + 60, fromDay, toDay));
        // And the wars themselves, fought. A war is a group fight between the
        // parties the two houses put in the field, and `war-melee.ts` is the whole
        // of it: it decides nothing and only puts the two rosters in front of
        // `resolveMelee`. On its own seeded stream so no existing draw anywhere
        // moves.
        // AND THE PEOPLE WITH A REASON TO KILL SOMEBODY, acting on it. Not a
        // template drawn over the population: see
        // `why-one-cultivator-kills-another.ts`. On its own streams.
        // THE ROOM FIRST: somebody held back for a seat goes after the holder's
        // record before anybody goes after their life. See
        // `bringing-what-you-know-about-somebody-to-the-room.ts`.
        // AND WHAT COMES OUT ABOUT AN OLD ONE. A killing somebody hid is a deed
        // the world holds and nobody has worked out; this is the year asking
        // whether anybody did. See `what-comes-to-light-about-a-killing.ts`.
        whatComesToLightThisYear(state, year, withinSpan(year * 365 + 88, fromDay, toDay));
        const seatsWanted = seatsThePeopleHeldBackWant(state);
        peopleBringWhatTheyKnowToTheRoom(
            state, year, withinSpan(year * 365 + 89, fromDay, toDay), seatsWanted);
        for (const written of peopleActOnWhyTheyWouldKill(
            state, year, withinSpan(year * 365 + 90, fromDay, toDay), seatsWanted
        ).written) {
            events.push({
                kind: 'killing',
                onDay: written.fact.day,
                fact: written.fact,
                touched: { factions: [...written.fact.factionIds], locations: written.fact.locationId ? [written.fact.locationId] : [], npcs: written.npcs },
                deaths: written.deaths
            });
        }
        const war = fightTheWarsThisYear(
            state,
            withinSpan(year * 365 + 61, fromDay, toDay),
            forStream(state.seed, 'war-melee', year)
        );
        for (const engagement of war.fought) {
            events.push({
                kind: 'war_fought',
                onDay: engagement.fact.day,
                fact: engagement.fact,
                touched: {
                    factions: [engagement.aId, engagement.bId],
                    locations: engagement.fact.locationId ? [engagement.fact.locationId] : [],
                    npcs: engagement.fact.actors.map(a => a.id)
                },
                deaths: engagement.deaths,
                opens: engagement.opens
            });
        }
        // And what the ENDING of one did, which is where a house's things
        // mostly go. The design owner: they are *typically left as spoils of
        // war*, so the fighting breaks the few things somebody carried out and
        // the settlement moves everything that stayed in the hold. One event
        // per settlement, never per object.
        for (const settled of war.settled) {
            events.push({
                kind: 'spoils_taken',
                onDay: settled.fact.day,
                fact: settled.fact,
                touched: {
                    factions: [settled.loserId, settled.winnerId],
                    locations: settled.fact.locationId ? [settled.fact.locationId] : [],
                    npcs: settled.moved
                        .map(m => m.toId)
                        .filter((id): id is string => id !== null && id !== settled.winnerId)
                },
                deaths: [],
                // A hold changing hands is the other thing a war leaves, and
                // for a long time it left nothing: measured over three worlds
                // at two hundred years, 193 things changed hands and not one
                // account of any object cause was ever opened.
                opens: settled.opens
            });
        }
        // AND WHAT A HOUSE DID ABOUT LOSING ONE. A treasury that is only ever
        // spent on payroll and rebuilding is a savings account; what makes it a
        // war chest is that a house watching the thing end opens it. The
        // decision is not the treasury's - it is the elders' and the
        // patriarch's - and `what-a-house-opens-its-treasury-for.ts` puts it to
        // them through the same room that decides whether one sword leaves the
        // armoury.
        events.push(...housesOpeningTheirVaults(
            state,
            withinSpan(year * 365 + 62, fromDay, toDay)
        ));

        // WHOEVER IS DUE BACK COMES BACK, and it happens BEFORE anybody is
        // called late. A party whose term ran out three months ago and which
        // nothing has processed yet is not overdue, it is unprocessed, and an
        // office that cannot tell those apart raises the alarm about everybody.
        //
        // It also skips anybody nobody can find, which is what makes the pass
        // below reach anybody at all. See the guard inside.
        bringHomeWhoeverIsDue(state, withinSpan(year * 365 + 62, fromDay, toDay));
        // AND THEN A HOUSE SENDS SOMEBODY AFTER WHOEVER IT HAS LOST. After the
        // homecoming, because somebody who walked back in this morning is not
        // somebody to go looking for.
        theHousesSendSomebodyLooking(state, withinSpan(year * 365 + 62.5, fromDay, toDay));

        // AND WHO THE HOUSE HAS PUT SOMEWHERE. Postings run in years and are
        // taken by the people a house can spare - which an elder holding no
        // room is, by design, because there are fewer rooms than elders.
        applyPostings(state, year, withinSpan(year * 365 + 64, fromDay, toDay));

        // AND THEN WHO HAS NOT COME BACK. Internal Affairs' job is personnel: they
        // are the one who knows a week's errand has taken a month, and the one
        // who tells everybody else something is wrong. It goes out as an
        // ordinary fact, so it reaches people the way every other thing does.
        events.push(...whatInternalAffairsNotices(
            state,
            withinSpan(year * 365 + 63, fromDay, toDay)
        ));

        // Wars that reached the day they were scheduled to end. BEFORE the
        // statuses, so a war that ended this year is a road open this year.
        events.push(...settleWarsThatAreOver(state, withinSpan(year * 365 + 62, fromDay, toDay)));
        // And then what is WRONG with the places that ground is under. After
        // the pressure, so a district worked out this year is a district its
        // holder can close this year - the count is the cause and the closing
        // is the consequence, and they are one year apart only if the ordering
        // says so.
        applyAreaStatuses(state, year, withinSpan(year * 365 + 65, fromDay, toDay));
        applyResettlement(state, year, withinSpan(year * 365 + 70, fromDay, toDay));
        applyFoundRoads(state, year, withinSpan(year * 365 + 80, fromDay, toDay));
        // BEFORE THE PROMOTIONS, so a chair a retirement or a removal changes
        // hands on is settled by the time anything reads it. A vacancy resolved
        // later in the year would be covered first and resolved second.
        theTopOfAHouseChangesHands(state, withinSpan(year * 365 + 89, fromDay, toDay));
        applyPromotions(state, withinSpan(year * 365 + 90, fromDay, toDay));
        // And a HOUSE whose chair the year's promotions left empty is covered by
        // one of its own elders, where the room agrees to it. Not a promotion
        // and not a rank: see `somebody-covers-a-house-with-no-head.ts`. After
        // the promotions, because a house that just seated a proper head has
        // nothing to cover.
        coverTheEmptyChairs(state, withinSpan(year * 365 + 90.5, fromDay, toDay));
        // And an office whose chair the year's promotions left empty is filled
        // from outside. See `a-house-takes-in-an-elder-from-outside.ts`.
        theHousesTakeInEldersFromOutside(state, withinSpan(year * 365 + 91, fromDay, toDay));
        // And the one rung that rotates settles itself, on the house's own
        // cycle. See `a-conclave-seat-is-won-in-a-tournament.ts`.
        // AND A HOUSE THAT WON ITS OWN CONTEST IS SEEN TO HAVE WON IT. The
        // owner: *"having your sect win a tournament"* - the house, not only
        // whoever took the seat. See `what-being-seen-to-do-well-is-worth.ts`.
        for (const settled of theConclavesAreContested(
            state, year, withinSpan(year * 365 + 92, fromDay, toDay))
        ) {
            if (settled.raised.length === 0) continue;
            theHouseWasSeenToWin(state, settled.houseId, settled.entrants,
                withinSpan(year * 365 + 92, fromDay, toDay));
        }
        // Somebody who mastered an art writes it out for the people coming up
        // behind them. BEFORE the handout, so a copy written this year is a copy
        // somebody can be given this year - and before advancement, so the ceiling
        // it raises is the ceiling this year's review reads. See
        // `applyManualCopying`: it is the only thing in the engine that puts a book
        // back into circulation, and the only route to the top of the ladder that
        // runs through a person rather than through luck.
        applyManualCopying(state, year, withinSpan(year * 365 + 95, fromDay, toDay));
        // Who teaches whom this year: masters their present disciples, and a
        // lecture in the compound. BEFORE the handout and the review, which are
        // the two things that read it.
        // The catalog's wanderers first, so a lecture at the Court or a look in
        // on one of theirs is attention this year's reads find.
        // See `the-wanderer-the-catalog-names-is-somebody.ts`.
        theWanderersGoAbout(state, year, withinSpan(year * 365 + 96, fromDay, toDay));
        giveThisYearsAttention(state, year, withinSpan(year * 365 + 97, fromDay, toDay));
        applyBookAcquisition(state, year, withinSpan(year * 365 + 100, fromDay, toDay));
        // Ground gets dug open, a material comes out of a hole, and a house
        // spends one of the things it can never replace on the disciple who is
        // standing at a wall they cannot pass for want of a road. BEFORE
        // advancement for the same reason manual copying is: a road come by
        // this year is a road this year's crossing can stand on.
        // See `how-a-cultivator-comes-by-a-road.ts`.
        applyRoadsComprehended(state, year, withinSpan(year * 365 + 110, fromDay, toDay));
        applyAdvancement(state, year, withinSpan(year * 365 + 120, fromDay, toDay));
        // And the one answer a fostered person ever gets, on their own sending
        // house's terms. AFTER advancement, so a rung reached this year is a
        // rung the assessment reads; before recruitment, so somebody who went
        // back is on the right roll when the year's admissions run.
        applyFosterageReturns(state, withinSpan(year * 365 + 130, fromDay, toDay));
        applyRecruitment(state, year, withinSpan(year * 365 + 150, fromDay, toDay));
        // And a house of hundreds whose roll has thinned has one of its own come
        // forward. See `a-house-takes-in-one-of-its-own.ts`.
        theHousesTakeInTheirOwn(state, year, withinSpan(year * 365 + 150, fromDay, toDay));
        // Joined where they stood; entered on the roll, robed and a lamp lit
        // at the house. See `a-recruit-is-given-their-lamp-at-the-house.ts`.
        enterWhoeverHasReachedTheHouse(state, withinSpan(year * 365 + 151, fromDay, toDay));
        // And then the people those two passes produced meet each other. After
        // books and after recruitment, so a chosen named this year can be sent
        // this year rather than waiting a turn of the clock; before the economy,
        // so the house that hosted pays for it out of the same year's purse.
        for (const held of applyGatherings(
            state, year, withinSpan(year * 365 + 160, fromDay, toDay)
        )) {
            events.push({
                kind: 'gathering',
                onDay: held.onDay,
                fact: held.fact,
                touched: {
                    factions: held.factionIds,
                    locations: held.locationId ? [held.locationId] : [],
                    npcs: held.attendeeIds
                },
                deaths: []
            });
        }
        // And then the doors. Who comes to stand at one, and who among a
        // house's own is given a place at the ones that admit a count.
        //
        // AFTER the gatherings, so somebody who placed at a competition this
        // year is on the board the conclave reads when it decides who goes;
        // before the economy, so the levy a held door takes is in the purse
        // the same year counts.
        const doorsDay = withinSpan(year * 365 + 165, fromDay, toDay);
        const doorsYear = applyDoorsAndTheirPlaces(state, year, doorsDay);
        for (const door of doorsYear) {
            if (door.shut === null || door.storedFact === null) continue;
            events.push({
                kind: 'zone_forbidden',
                onDay: door.storedFact.day,
                fact: door.storedFact,
                touched: {
                    factions: [door.shut.patch?.controllingFactionId ?? '', ...door.shut.angered]
                        .filter(id => id.length > 0),
                    locations: [door.doorId],
                    npcs: door.shut.posted.map(p => p.id)
                },
                deaths: [],
                opens: [...door.accounts]
            });
        }
        // AND THE PEOPLE THE CONCLAVES CHOSE ACTUALLY GO. The allocation above
        // is the whole of the decision and none of the walking; see
        // `thePeopleAConclaveChoseWalkThrough`. The year's own last day, so a
        // party whose term outruns the span is still standing in the doorway
        // rather than reported back after the world's clock.
        thePeopleAConclaveChoseWalkThrough(
            state, doorsYear, doorsDay, Math.min(yearEndsOn, toDay));
        // And then the ties an ordinary life produces, on the same yearly line.
        applyOrdinaryLifeTies(state, year, withinSpan(year * 365 + 170, fromDay, toDay));
        // And a master looking for a disciple takes one standing in front of them.
        searchingMastersTakeADisciple(state, withinSpan(year * 365 + 170, fromDay, toDay));
        applyFactionEconomy(state);
        // And a house that could not pay its people sells what it built, to
        // somebody it would sit down with. AFTER the economy, so the purse it
        // is read against is this year's, and before the sendings, so what it
        // got for the thing is in the chest the party is sent out of.
        applyWhatAHouseHadToSell(state, withinSpan(year * 365 + 172, fromDay, toDay));
        // And then the house spends some of what it just counted on putting
        // people on the road. AFTER the economy, so a house buys the carriage
        // out of the purse this year filled, and after recruitment, so
        // somebody admitted this year can be on the party.
        // An errand's two bounds are the YEAR reported on, never the call's
        // span. `fromDay` was the first of them, and it made an errand's dates
        // a property of how the caller chopped its span: one sixty-year call
        // backdated nothing, sixty one-year calls backdated every long term.
        // `year * 365` is inside the span by construction - see the windowing
        // note above - so this cannot date anything before what was advanced.
        applySendings(
            state, year, withinSpan(year * 365 + 175, fromDay, toDay),
            year * 365, Math.min(yearEndsOn, toDay), actOnAnEmptyPurse);
        // And what the people away send home, after the sendings so whoever set
        // out this year has been handed a stack. See
        // `what-a-house-hears-from-its-people-away.ts`.
        wordFromThePeopleAway(state, { day: withinSpan(year * 365 + 176, fromDay, toDay) });
        // And the yard works on what the last party brought home. AFTER the
        // sendings, so material that came back this year is material this
        // year's work can go into - a hull is a schedule, and a house hunts
        // for it the whole time it is building it.
        applyConveyanceBuilding(state, year, withinSpan(year * 365 + 178, fromDay, toDay));
        // And whoever is on no roll moves on, to a road, a ruin or a market.
        // See `where-somebody-with-no-house-goes.ts`.
        peopleWithNoHouseMoveOn(state, year, withinSpan(year * 365 + 178, fromDay, toDay));
        // AND WOUNDS CLOSE. A house sees to its own out of the purse, time takes
        // the small ones for everybody, and the permanent family is never picked
        // up at all - so who is still carrying a wound is a statement about who
        // is standing behind them. AFTER the economy, because the stones a house
        // spends on its people are this year's stones. See
        // `what-a-house-does-about-its-people-being-hurt.ts`.
        woundsCloseThisYear(state, year, withinSpan(year * 365 + 179, fromDay, toDay));
        // AND THE PEOPLE WHO DECIDED FOR THEMSELVES. After the economy, so the
        // stipend they did or did not get is this year's, and after the house's
        // own sendings, so somebody the house put on the road this year is out
        // on the house's business rather than weighing whether to leave.
        applyPeopleWalkingOut(
            state, year, withinSpan(year * 365 + 179, fromDay, toDay), peopleWalkOut);
        born += applyDemography(state, year, withinSpan(year * 365 + 180, fromDay, toDay), rng).length;
        // The longest project in the world, on its own clock. It will almost
        // never fire in five hundred years, and that is the point of it.
        applyLastCrossing(state, year, withinSpan(year * 365 + 200, fromDay, toDay));
        // And the house's own take work off its board, last, so the year's
        // lessons and reviews found them at home and the term is paid next year
        // before promotions. See `a-disciple-takes-work-off-the-board.ts`.
        peopleTakeWorkOffTheirHousesBoard(state, year, withinSpan(year * 365 + 201, fromDay, toDay));
        // And what anybody on a roll carries that their house wants, handed in.
        // See `what-a-house-gives-merit-for.ts`.
        peopleTurnInWhatTheirHouseWants(state, withinSpan(year * 365 + 202, fromDay, toDay));
        // And what two of them could not carry any further gets taken to the
        // ground in front of the house. See `a-challenge-is-answered-on-the-yard.ts`.
        theChallengesThisYear(state, year, withinSpan(year * 365 + 203, fromDay, toDay));
        // And every house counted, last, so the count moves by the whole year's
        // joining, dying and leaving. See `how-many-people-a-house-has.ts`.
        theHousesAreCounted(state);
    }

    return { events, yearsStepped, born };
}

// WHERE PEOPLE ARE

/**
 * The region a location sits in, or itself when it is one.
 *
 * Walks the parent chain with a visited guard, so a cycle introduced by a bad
 * patch returns an answer instead of hanging a five-century soak.
 */
function regionOf(state: WorldState, locationId: string | null): string | null {
    let cursor = locationId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const location = getLocation(state, cursor);
        if (!location) return null;
        if (location.kind === 'region' || location.parentId === null) return location.id;
        cursor = location.parentId;
    }
    return null;
}

/** Every location id at or beneath this one. Containers included. */
function locationIdsUnder(state: WorldState, regionId: string): Set<string> {
    const under = new Set<string>([regionId]);
    // Two passes is enough for region -> place, and the loop is bounded by the
    // location count so a malformed parent chain cannot hang the world tick.
    for (let pass = 0; pass < state.locations.length; pass++) {
        let grew = false;
        for (const location of state.locations) {
            if (location.parentId && under.has(location.parentId) && !under.has(location.id)) {
                under.add(location.id);
                grew = true;
            }
        }
        if (!grew) break;
    }
    return under;
}

/**
 * Somewhere in this region a person can actually be born.
 */
function birthplacesIn(state: WorldState, region: LocationRecord): LocationRecord[] {
    const under = locationIdsUnder(state, region.id);
    return state.locations.filter(l =>
        l.id !== region.id &&
        under.has(l.id) &&
        (l.kind === 'settlement' || l.kind === 'sect_seat') &&
        !l.sealed &&
        l.thresholds.entry <= 0 &&
        l.thresholds.survival <= 0 &&
        populationWeightOf(l) > 0
    );
}

/** Weighted draw over birthplaces. Seeded, so a world replays identically. */
function drawBirthplace(
    places: readonly LocationRecord[],
    rng: CultivationRNG
): LocationRecord | null {
    if (places.length === 0) return null;
    const total = places.reduce((sum, l) => sum + populationWeightOf(l), 0);
    if (total <= 0) return places[rng.int(0, places.length - 1)];
    let cursor = rng.next() * total;
    for (const place of places) {
        cursor -= populationWeightOf(place);
        if (cursor < 0) return place;
    }
    return places[places.length - 1];
}

/**
 * People keep being born.
 */
function applyDemography(
    state: WorldState,
    year: number,
    day: number,
    rng: CultivationRNG
): NpcRecord[] {
    const target = state.populationTarget;
    if (target <= 0) return [];

    let living = 0;
    for (const npc of state.npcs) if (npc.status === 'alive' && isBelowTheLid(npc)) living++;
    const deficit = target - living;
    if (deficit <= 0) return [];

    // A fraction of the gap each year, so a plague is felt for a generation
    // rather than papered over the following spring.
    const count = Math.min(24, Math.max(1, Math.round(deficit * 0.08)));
    const regions = state.locations.filter(l => l.kind === 'region' && isBelowTheLid(l));
    if (regions.length === 0) return [];
    // Who took each of the year's children on, where anybody did.
    const roads = theRoadsOntoARollThisYear(state, year);
    const tookOn = new Map<string, string>();

    // One walk of the roster for the whole cohort. Without it every birth in
    // the year re-scanned `state.npcs`, which holds the dead as well and is
    // four thousand records deep by year five hundred.
    const roster = rosterOf(state);

    const born: NpcRecord[] = [];
    for (let i = 0; i < count; i++) {
        const id = `npc-${state.nextNpcSeq++}`;
        const own = forStream(state.seed, 'birth', id);
        const region = regions[own.int(0, regions.length - 1)];
        const age = own.int(16, 22);

        // A place, not the container - and never the container.
        const habitable = birthplacesIn(state, region);
        const somewhere = habitable.length > 0
            ? { region, places: habitable }
            : (() => {
                for (const alt of regions) {
                    const places = birthplacesIn(state, alt);
                    if (places.length > 0) return { region: alt, places };
                }
                return null;
            })();
        if (!somewhere) break;
        const home = drawBirthplace(somewhere.places, own) ?? somewhere.places[0];
        const under = locationIdsUnder(state, somewhere.region.id);
        // Read off the province they are actually born in, not the one first
        // drawn - a child born in the next province over grows up under its
        // ceiling and its ground.
        const ceiling = Number(somewhere.region.data.localCeilingOrdinal ?? 20);
        const rateMultiplier = Number(somewhere.region.data.ambientRateMultiplier ?? 1);

        let npc = createNpc(state.seed, {
            id,
            bornOnDay: day - years(age),
            onDay: day,
            locationId: home.id,
            occupation: 'unknown',
            // Two people with one name breaks the knowledge system, which is
            // keyed by id while everything the player reads is keyed by name.
            takenNames: new Set(state.npcs.map(n => n.name)),
            tags: [`region:${String(somewhere.region.data.catalogRegionId ?? somewhere.region.id)}`]
        });
        const ordinal = deriveOrdinal(
            npc.cultivation.spiritRoot,
            npc.cultivation.attributes,
            age,
            rateMultiplier,
            ceiling,
            own
        );
        npc = setRealm(npc, ordinal, day);
        npc = addGoal(npc, {
            kind: 'cultivation',
            text: 'Get somewhere. Anywhere.',
            priority: 0.5,
            obstacles: ['Born here.']
        }, day);

        // A parent, where the world has one to offer: same region, old enough, and
        // alive. Lineage is what long time-skips land on.
        const oldEnough = (n: NpcRecord) => day - n.identity.bornOnDay >= years(age + 18);
        const here = couldParent(
            roster.living.filter(n => oldEnough(n) && n.locationId === home.id), age, day);
        const candidates = here.length > 0
            ? here
            : couldParent(
                roster.living.filter(n =>
                    oldEnough(n) && n.locationId !== null && under.has(n.locationId)), age, day);
        const parent = candidates.length > 0
            ? candidates[own.int(0, candidates.length - 1)]
            : null;
        if (parent) {
            // WHAT THE LINE COMES TO IN THIS CHILD. See `a-child-takes-their-parents-line.ts`.
            npc = aChildTakesTheirParentsLine(state, npc, parent, roster);
        }

        // A faction that takes applicants takes applicants. Without this the rolls
        // only ever shrink: every founding member dies inside two centuries and
        // nobody replaces them, and the institutions fold for a reason that is
        // arithmetic rather than history. Seats moved, and this did not follow
        // them.
        //
        // AND THROUGH A DOOR, the way a player joins: the design owner, *"NPCs
        // join the same way you do."* A house takes a local child only where it
        // has a road to them this year - somebody of it out looking for
        // disciples where they are, its grounds open for a selection, or the
        // intake its notice named held where they live
        // (`the-world-joins-a-house-the-way-a-player-does.ts`).
        //
        // EXCEPT A FAMILY'S OWN CHILD. `governance-and-water-rights.ts`: "the seven
        // family houses, whose intake is kinship and whose name is the family's,
        // are `bloodline`", against "a sect with an admission day". A child born
        // to a member of a `bloodline` house is of it by kinship, with the parent
        // as the one who took them on and no bar to meet; a child born to a member
        // of a sect goes through the sect's door like anybody else, and fostering
        // below still applies where the catalog states terms.
        const parentsFamily = parent?.factionId
            ? state.factions.find(f => f.id === parent.factionId && f.dissolvedOnDay === null
                && isBelowTheLid(f) && FACTION_PARENTAGE[f.id]?.governance === 'bloodline'
                && (whoAHouseWillTake(f.id) ?? npc.identity.sex) === npc.identity.sex) ?? null
            : null;
        if (parentsFamily !== null && parent) {
            npc = { ...npc, factionId: parentsFamily.id, factionRankIndex: 0 };
            tookOn.set(npc.id, parent.id);
        } else {
            const admitting = state.factions.filter(
                f => f.dissolvedOnDay === null && isBelowTheLid(f) &&
                    f.tags.includes('recruits') &&
                    f.seatLocationId !== null && under.has(f.seatLocationId) &&
                    ordinal >= Number(f.resources.admission_ordinal ?? 0) &&
                    // Same door, same rule. A house that takes one sex does not
                    // take the local children of the other one either.
                    (whoAHouseWillTake(f.id) ?? npc.identity.sex) === npc.identity.sex
            );
            const withARoad = admitting
                .map(f => ({ house: f, road: roads.roadFor(f, { id: npc.id, locationId: home.id }) }))
                .filter(row => row.road !== null);
            if (withARoad.length > 0 && own.chance(0.45)) {
                const joined = withARoad[own.int(0, withARoad.length - 1)]!;
                npc = { ...npc, factionId: joined.house.id, factionRankIndex: 0 };
                tookOn.set(npc.id, joined.road!.recruiterId);
            }
        }

        // FOSTERING, before the household is written and after the lineage edge is.
        // A child whose parent's own house will not keep them, or whose birth the
        // household will not own, is placed with somebody the parent personally
        // knows - which is the whole of where they end up, and is decided by the
        // parent's ties rather than by any list.
        const fostered = parent
            ? placeAChildTheirHouseWillNotKeep(
                state, npc, parent, ordinal, day, forStream(state.seed, 'fostering', id), roster)
            : null;
        if (fostered) {
            npc = fostered;
            // Taken in on a word, by the person who took them in.
            const taker = fostered.relationships.find(r => r.kind === 'client')?.targetId;
            if (taker) tookOn.set(npc.id, taker); else tookOn.delete(npc.id);
        }

        // The household the birth actually created, written last so the child's own
        // record is finished before anybody is bound to it. The parent's half and
        // the siblings' halves go into `state.npcs` in place; the child's half
        // comes back on the record about to be pushed.
        if (parent && !fostered) {
            npc = bindNewbornToHousehold(state, npc, parent.id, day, roster).child;
        }

        roster.at.set(npc.id, state.npcs.length);
        roster.living.push(npc);
        state.npcs.push(npc);
        born.push(npc);
    }
    // Taken on by a house, or placed in one, and whoever of it took them on owes
    // it a report. See `a-house-expects-somebody-it-took-on.ts`. After the loop,
    // so no row is written while the roster above still holds it.
    for (const child of born) {
        const recruiterId = tookOn.get(child.id);
        if (child.factionId === null || recruiterId === undefined) continue;
        theyOweTheHouseAReport(state, recruiterId, {
            houseId: child.factionId,
            person: { id: child.id, name: child.name },
            placeId: child.locationId,
            onDay: day
        });
    }
    void rng;
    void year;
    return born;
}

// ─────────────────────────────────────────────────────────────────────────
// FOSTERING
// ─────────────────────────────────────────────────────────────────────────

/**
 * How often a birth is one the household will not own.
 */
const BORN_OUTSIDE_THE_HOUSEHOLD = 0.05;

/**
 * The world's own reason a child has to go somewhere else, or null.
 */
function whyThisChildCannotStay(
    parent: NpcRecord,
    rng: CultivationRNG
): FosteringReason | null {
    const house = whyTheirOwnHouseWillNotKeepThem(parent.factionId);
    if (house) return house;
    const married = parent.relationships.some(r => r.kind === 'spouse');
    if (married && rng.chance(BORN_OUTSIDE_THE_HOUSEHOLD)) return 'the birth';
    return null;
}

/** A word already spent on this person. Once means once. */
const PLACED_WITH = 'placed-a-child-with:';

/** The house a fostered person was sent OUT of, which is not the one they are in. */
const FOSTERED_FROM = 'fostered-from:';

/** The answer, once given. There is no second assessment and no appeal. */
const ASSESSED = 'assessed:';

/**
 * A child placed with somebody their parent knows, in the running world.
 */
function placeAChildTheirHouseWillNotKeep(
    state: WorldState,
    child: NpcRecord,
    parent: NpcRecord,
    ordinal: number,
    day: number,
    rng: CultivationRNG,
    roster: Roster
): NpcRecord | null {
    // Never the player's own mirror row. Placing your child is a decision a
    // person makes, and a world pass that made it for them would be the engine
    // taking the decision - the exact shape the agency rule forbids.
    if (!isTheWorldsToMove(parent)) return null;

    const reason = whyThisChildCannotStay(parent, rng);
    if (!reason) return null;

    // Who this parent actually knows. Their own rows, nobody else's, and the
    // house comes off the person rather than off a list of houses.
    const candidates: FosterCandidate[] = [];
    const asked = new Set(
        parent.tags.filter(t => t.startsWith(PLACED_WITH)).map(t => t.slice(PLACED_WITH.length))
    );
    for (const tie of parent.relationships) {
        const at = roster.at.get(tie.targetId);
        if (at === undefined) continue;
        const person = state.npcs[at];
        if (person.status !== 'alive' || !person.factionId) continue;
        // A house that has folded takes nobody. `whoCouldBeAsked` asks the
        // catalog whether a bar moves; whether the body still exists is the
        // world's own question and is answered here.
        const house = state.factions.find(f => f.id === person.factionId);
        if (!house || house.dissolvedOnDay !== null || !isBelowTheLid(house)) continue;
        candidates.push({
            personId: person.id,
            personName: person.name,
            houseId: person.factionId,
            standing: tie.standing,
            alreadyAsked: asked.has(person.id)
        });
    }

    const willing = whoCouldBeAsked(candidates, { fostererHouseId: parent.factionId });
    if (willing.length === 0) return null;

    // The other parent, where there is one AND they are a party to it. A
    // household's own child placed because the house has no room for them is a
    // thing both parents did; a birth the household will not own is precisely
    // the one the spouse is not on the list for.
    const spouseId = isConcealed(reason)
        ? null
        : parent.relationships.find(r => r.kind === 'spouse')?.targetId ?? null;

    const placed = fosterTheChild({
        fostererId: parent.id,
        askedOf: willing[0],
        childId: child.id,
        reason,
        onDay: day,
        childOrdinal: ordinal,
        fostererHouseId: parent.factionId,
        otherParentId: spouseId
    });
    if (!wasFostered(placed)) return null;

    const takerAt = roster.at.get(placed.askedOfId);
    const parentAt = roster.at.get(parent.id);
    if (takerAt === undefined || parentAt === undefined) return null;
    const taker = state.npcs[takerAt];

    // The child is on the receiving house's roll, at the bottom of it, WITHOUT
    // having met its admission ordinal. That exception is the whole of what the
    // word bought, and `barSkipped` on the result is the figure it skipped.
    let updated: NpcRecord = {
        ...child,
        factionId: placed.houseId,
        factionRankIndex: 0,
        tags: [
            ...child.tags,
            'fostered',
            ...(parent.factionId ? [`${FOSTERED_FROM}${parent.factionId}`] : [])
        ]
    };

    // The deference the arrangement produces, expressed as the tie it actually
    // is: the person who took them in is their patron, and they are that
    // person's client. The child holds no tie to the parent at all.
    updated = upsertRelationship(updated, {
        targetId: taker.id,
        targetName: taker.name,
        kind: 'client',
        standing: 0.5,
        note: 'Took them in. They have never been told why.'
    }, day);
    state.npcs[takerAt] = upsertRelationship(taker, {
        targetId: updated.id,
        targetName: updated.name,
        kind: 'patron',
        standing: 0.5,
        note: 'Took them in on a word, and knows whose they are.'
    }, day);

    // And what the parent now is to the person they asked. `spendAWord`'s own
    // reading of it, in the world's vocabulary.
    const holder = state.npcs[parentAt];
    state.npcs[parentAt] = upsertRelationship(
        {
            ...holder,
            tags: [
                ...holder.tags,
                `${PLACED_WITH}${taker.id}`,
                ...(placed.shame ? [shameTag(placed.shame.cause)] : [])
            ]
        },
        {
            targetId: taker.id,
            targetName: taker.name,
            kind: 'client',
            standing: Math.max(0, relationshipWith(holder, taker.id)?.standing ?? 0.5),
            note: 'Asked, and was not refused.'
        },
        day
    );
    andTheOtherEnd(state.npcs, holder, { targetId: taker.id, kind: 'client', standing: 0.5 }, day,
        { note: 'Was asked, and did not refuse.' });

    // Secret, because the people who hold it are the people on it. Nobody else
    // in the world has a record, which is what `unaware` means for the child.
    //
    // AND THE CHILD IS NOT ON THE ROSTER YET. `applyDemography` pushes them
    // after this returns, so `linkFactToWhoItNames` cannot find them and the
    // one fact about their own origin was left off the one person it is about.
    // The id is put on by hand below, which is what that linker would have
    // done: everybody else this names IS on the roster and is linked normally.
    const placing = appendWorldFact(state, makeFact({
        day,
        kind: 'birth',
        scale: 'personal',
        actors: [
            { id: parent.id, name: parent.name, role: 'parent' },
            { id: taker.id, name: taker.name, role: 'took the child' },
            { id: updated.id, name: updated.name, role: 'child' }
        ],
        locationId: updated.locationId,
        factionIds: [placed.houseId],
        summary:
            `${updated.name} was placed at ${placed.houseId} through ${taker.name}, ` +
            `on ${parent.name}'s word. ${reasonSummary(reason)}`,
        visibility: 'secret',
        fidelity: 'partial',
        magnitude: 0.2,
        data: {
            fostering: reason,
            barSkipped: placed.barSkipped,
            askedOfId: taker.id,
            fostererId: parent.id,
            // The one person with no record of their own origin.
            withheldFrom: placed.withheldFrom.join(','),
            childStage: placed.childStage,
            terms: placed.terms ? placed.terms.factionId : null
        }
    }));

    return {
        ...updated,
        historyFactIds: updated.historyFactIds.includes(placing.id)
            ? updated.historyFactIds
            : [...updated.historyFactIds, placing.id]
    };
}

/**
 * The one assessment a fostered person ever gets, on the terms their own house set
 * when it sent them away.
 */
function applyFosterageReturns(state: WorldState, day: number): number {
    let assessed = 0;
    let roads: ReturnType<typeof theRoadsOntoARollThisYear> | undefined;
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc.status !== 'alive') continue;
        const from = npc.tags.find(t => t.startsWith(FOSTERED_FROM));
        if (!from) continue;
        if (npc.tags.some(t => t.startsWith(ASSESSED))) continue;
        const terms = fosterageTermsOf(from.slice(FOSTERED_FROM.length));
        if (!terms) continue;

        const age = (day - npc.identity.bornOnDay) / DAYS_PER_YEAR;
        const ordinal = npc.cultivation.realmOrdinal;
        if (ordinal < terms.returnOrdinal && age < terms.returnByAge) continue;

        const answer = assessTheReturn(terms, ordinal, age);
        // TAKEN BACK THROUGH THE DOOR. The Hollow Court's children "may come back
        // only on a stranger's terms", and a stranger comes in through the house's
        // intake: somebody of it where they are, its grounds open, or its intake.
        // No road this year and the assessment waits; the terms still run out.
        const house = answer.returns
            ? state.factions.find(f => f.id === terms.factionId && f.dissolvedOnDay === null) ?? null
            : null;
        const road = house === null ? null : (roads ??= theRoadsOntoARollThisYear(state, Math.floor(day / DAYS_PER_YEAR)))
            .roadFor(house, npc);
        if (answer.returns && road === null) continue;
        assessed++;
        const outcome = answer.returns ? 'returned' : 'stayed';
        let updated: NpcRecord = { ...npc, tags: [...npc.tags, `${ASSESSED}${outcome}`] };
        if (answer.returns) {
            // Back onto the sending house's roll, at the bottom of it. The
            // assessment moved a person; it conferred nothing.
            updated = { ...updated, factionId: terms.factionId, factionRankIndex: 0 };
        }
        state.npcs[i] = updated;
        if (answer.returns && road !== null) {
            // Taken back on, and whoever of the house did it owes it a report.
            theyOweTheHouseAReport(state, road.recruiterId, {
                houseId: terms.factionId,
                person: { id: updated.id, name: updated.name },
                placeId: updated.locationId,
                onDay: day
            });
        }

        appendWorldFact(state, makeFact({
            day,
            kind: 'inheritance',
            scale: 'personal',
            actors: [{ id: updated.id, name: updated.name, role: 'assessed' }],
            locationId: updated.locationId,
            factionIds: [terms.factionId],
            summary: answer.returns
                ? `${updated.name} was assessed and went back to ${terms.factionId}.`
                : `${updated.name} was assessed and stayed where they were raised.`,
            visibility: 'secret',
            fidelity: 'partial',
            magnitude: 0.2,
            data: {
                fosterageAssessment: outcome,
                metOrdinal: answer.metOrdinal,
                inTime: answer.inTime,
                atOrdinal: ordinal,
                atAge: Math.round(age),
                terms: terms.factionId
            }
        }));
    }
    return assessed;
}

function reasonSummary(reason: FosteringReason): string {
    switch (reason) {
        case 'the bar':
            return 'Their own house does not lower its bar for anybody, including its own.';
        case 'no door':
            return 'Their own house has no intake at all; nobody joins it.';
        case 'the birth':
            return 'The household would not own the birth.';
    }
}

/**
 * People keep cultivating.
 */
const ADVANCEMENT_REVIEW_YEARS = 12;

/** Stable, seedless, and cheap: which review year this person's id belongs to. */
function reviewSlot(id: string, period: number): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % period;
}

function applyAdvancement(state: WorldState, year: number, day: number): NpcRecord[] {
    const slot = ((year % ADVANCEMENT_REVIEW_YEARS) + ADVANCEMENT_REVIEW_YEARS)
        % ADVANCEMENT_REVIEW_YEARS;
    const due: number[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        // The player climbs on their own sheet, through `time-skip.ts`.
        // Reviewing their mirror row here would advance them a second time and
        // - worse, because a refresh cannot undo it - write a breakthrough into
        // the world's chronicle that the character never made.
        if (!isTheWorldsToMove(npc)) continue;
        if (reviewSlot(npc.id, ADVANCEMENT_REVIEW_YEARS) !== slot) continue;
        due.push(i);
    }
    if (due.length === 0) return [];

    const advanced: NpcRecord[] = [];
    // ONE index for the whole pass, not one lookup per person. The strike pass
    // needs the rung of whoever is teaching them, and a scan of the roster per
    // reviewed NPC would turn a linear pass quadratic over five hundred people
    // for the whole life of the world.
    const byId = new Map(state.npcs.map(n => [n.id, n]));
    // GROUND TIME, INDEXED ONCE PER PASS.
    //
    // Every house allocates days in its own chambers by standing, and this is
    // asked of every living cultivator every year - a per-person recomputation
    // would be quadratic over the whole life of the world, the same reason
    // `shelfOf` and `teachableIn` are indexed.
    const roomsByFaction = new Map<string, ReturnType<typeof roomsHeldBy>>();
    const membersByFaction = new Map<string, GroundClaimant[]>();
    for (const n of state.npcs) {
        if (n.status !== 'alive' || !n.factionId) continue;
        const at2 = membersByFaction.get(n.factionId);
        if (at2) at2.push(n); else membersByFaction.set(n.factionId, [n]);
    }
    const groundShare = new Map<string, number>();
    const bestRoomRate = new Map<string, number | null>();
    for (const [factionId, members] of membersByFaction) {
        const rooms = roomsHeldBy(state.locations, factionId);
        roomsByFaction.set(factionId, rooms);
        bestRoomRate.set(factionId, groundRateAt(rooms[0]));
        for (const [id, share] of groundTimeShares(members, rooms)) groundShare.set(id, share);
    }

    for (const at of due) {
        const npc = state.npcs[at];

        // ── A BEAST CLIMBS BY SITTING, AND THAT IS CHEAPER THAN THIS PASS ──
        //
        // Taken before anything below it, because everything below it is the
        // human road and a beast is on none of it: no book, no teacher, no
        // house ground, no province ceiling. `applyAdvancement` was computing
        // four of those for a beast row and then refusing it at a ceiling of
        // 20, so nothing the world held at 24 could ever move. One call
        // replaces all of it - see `a-beast-climbs-by-sitting-where-it-is.ts`,
        // which is a reading rather than a sweep and costs the same at year
        // one and at year five thousand.
        const moved = aBeastGoesOnSitting(state, at, day);
        if (moved !== null) {
            if (moved) advanced.push(state.npcs[at]);
            // AND THE LID ON THAT CLIMB, WHICH IS THE ONE EVERYBODY HAS.
            oneOfTheseFoughtOnItsOwnGround(state, at, year, day);
            continue;
        }

        const regionTag = npc.tags.find(t => t.startsWith('region:'))?.slice(7);
        const region = state.locations.find(
            l => l.kind === 'region' && isBelowTheLid(l) &&
                String(l.data.catalogRegionId ?? '') === regionTag
        ) ?? state.locations.find(l => l.id === npc.locationId);
        const regionCeiling = Number(region?.data.localCeilingOrdinal ?? 20);
        // THE GROUND THEY ACTUALLY GET, WHICH IS A FRACTION OF A YEAR.
        const provinceRate = Number(region?.data.ambientRateMultiplier ?? 1);

        // The days they are NOT in the vein chamber are spent on their own

        // house ordinary ground, not in a field outside it. See

        // `houseFallbackRate` - without this an apex outer disciple came out

        // worse than a village one, measured.

        const rooms = npc.factionId ? roomsByFaction.get(npc.factionId) ?? [] : [];

        const rateMultiplier = rateOverTheYear(

            groundShare.get(npc.id) ?? 0,

            npc.factionId ? bestRoomRate.get(npc.factionId) ?? null : null,

            houseFallbackRate(rooms, provinceRate)

        ) * whatTeachingLeavesOfAMastersRate(npc, byId, day);
        const age = Math.floor((day - npc.identity.bornOnDay) / 365);

        // THE BOOK IS THE HARDER OF THE TWO CEILINGS.
        const manualCeiling = reachableCeilingFor(state, npc) || BOOKLESS_CEILING;
        const ceiling = Math.min(regionCeiling, manualCeiling);
        if (ceiling <= npc.cultivation.realmOrdinal) continue;

        // THE SHELF THEY CAN ACTUALLY REACH, not a default one.
        const membership: OriginTierKey = !npc.factionId
            ? 'thin_county'
            : npc.factionRankIndex >= 3 ? 'dao_house_bloodline'
                : npc.factionRankIndex >= 1 ? 'established_clan'
                    : 'sect_retainer';

        // AND THE BETTER OF THAT AND WHAT THEY WERE BORN WITH - WHILE SOMEBODY
        // IS ON A ROLL.
        //
        // A shelf is a road being opened to somebody now: the arts, the pills,
        // the vein time, a master's attention. Being born into a dao house six
        // hundred years ago is not a road anybody is still opening, and taking
        // the better of the two let a rogue keep drawing on a birth for the
        // whole of a very long life. The design owner, on why a sect cultivator
        // climbs further: *"it's easier to rank up to 41 in a sect"* - and on
        // what leaving must not do: *"a rogue who was a sect cultivator keeps
        // what they already have"*, which is the rung they stand on and the
        // arts they learned, neither of which this touches. It changes only
        // what they can still gain.
        //
        // UNMEASURED. Queued: rogues above 29 against house people above 29, on
        // the seed that produced 15 of 66.
        const born = npc.identity.origin;
        const shelf: OriginTierKey =
            npc.factionId !== null
                && manualQualityRank(getOrigin(born).roadQuality)
                    > manualQualityRank(getOrigin(membership).roadQuality)
                ? born
                : membership;

        const derived = deriveOrdinal(
            npc.cultivation.spiritRoot,
            npc.cultivation.attributes,
            age,
            rateMultiplier,
            ceiling,
            forStream(state.seed, 'advance-npc', npc.id),
            { origin: shelf }
        );
        if (derived > npc.cultivation.realmOrdinal) {
            state.npcs[at] = setRealm(npc, derived, day);
            advanced.push(state.npcs[at]);
            continue;
        }

        // THE DERIVATION HAS RUN OUT. THE LADDER TAKES OVER.
        const guidance = guidanceFor(npc, byId, day);
        const conditions = {
            ambient: ambientAround(state, npc, region),
            rateMultiplier,
            guideOrdinal: guidance?.ordinal ?? null,
            guideListeners: guidance?.listeners ?? 1,
            manualCeiling
        };
        const readiness = readyToStrike(npc, day, conditions);
        if (!readiness.ready) continue;

        const strike = strikeAtTheWall(
            npc,
            day,
            readiness,
            // Keyed on the person and the year, so a world replayed from its
            // seed strikes the same walls with the same outcomes, and adding
            // this pass perturbed no other stream.
            forStream(state.seed, 'strike-the-wall', npc.id, year),
            conditions.ambient,
            // THE ROADS, read against the world rather than against the record.
            // The arts in their hands are one channel of four and cannot reach
            // past three domains; the ground their house lets them onto, the
            // ground their province leaves standing open, the ruin somebody dug
            // out and the material that was spent on them are the rest of it.
            roadsInReachOf(state, npc)
        );
        if (!strike) continue;

        // The ledger gets the crossing whichever way it went. This is the single
        // richest event in a cultivator's life and it used to leave no trace at
        // all: `attemptBreakthrough` returned the trial, the roll, the wound, the
        // years burned and whether they would ever cross again, the record took
        // every one of them, and the world's own history said nothing happened. A
        // failure is written as fully as a success, because a cultivator who
        // cracked at a wall and is standing at their rung finished is the
        // population the failure table exists to produce. See
        // `recording-what-a-crossing-did.ts`.
        if (strike.died) {
            const dead = theWorldEnds(
                npc,
                day,
                // NAME WHAT KILLED THEM. A death at this height has to be an event
                // the world can account for rather than an entry in a pool: the
                // design's rule is that nothing ordinary may end somebody at
                // Tribulation Transcendence, and "the wall did not open" said
                // nothing about which wall or what came down. At ordinals 40 to 44
                // every step summons lightning, so a death there IS the tribulation
                // - one of the ends the design permits - and below that it is the
                // crossing itself.
                triggersHeavenlyTribulation(npc.cultivation.realmOrdinal)
                    ? `Called down the tribulation at ${rankName(npc.cultivation.realmOrdinal)} `
                      + 'and did not hold it.'
                    : `The crossing out of ${rankName(npc.cultivation.realmOrdinal)} `
                      + 'did not open, and closed.'
            );
            // NOTHING IS WRITTEN WHEN THE WORLD MAY NOT END THEM, and that
            // includes the crossing. `recordCrossing` files a death outcome as
            // a `death` fact naming them deceased, so recording this one would
            // put exactly the artefact the seam exists to prevent into the
            // ledger - a death in the record with nobody dead in it. The wall
            // came down, it took nothing (`strikeAtTheWall` returns the
            // untouched record on a death), and the year leaves no trace.
            if (!dead) continue;
            state.npcs[at] = dead;
            // AND WHAT THEY LEFT. `markDead` alone stops a heart; it passes
            // nothing on. The two deaths that skipped this were the deaths at a
            // WALL and at the LAST CROSSING - the two highest-ordinal ways to
            // die in the world, and therefore the deaths most likely to have
            // heirs and accounts worth inheriting. A grudge that took a
            // century to earn ended with the person holding it.
            settleNpcDeath(state, state.npcs[at], day);
            recordCrossing(state, npc, strike.result, day);
            continue;
        }
        state.npcs[at] = strike.npc;
        andLetGoAtTheOtherEnd(state.npcs, npc, strike.npc);
        recordCrossing(state, state.npcs[at], strike.result, day);
        if (strike.result.outcome === 'success') {
            advanced.push(state.npcs[at]);
            // AND WHOEVER TAUGHT THEM IS SEEN TO HAVE TAUGHT THEM. The owner's
            // own example of face away from a fight: *"teaching someone"*. Read
            // off the tie the student holds, so it is the master they actually
            // answer to rather than anybody senior nearby.
            for (const tie of state.npcs[at]!.relationships) {
                if (tie.kind !== 'master' && tie.kind !== 'teacher') continue;
                const teacher = byId.get(tie.targetId);
                if (teacher === undefined || teacher.status !== 'alive') continue;
                theirDiscipleCrossed(state, teacher, state.npcs[at]!, A_ROOM_SAW_IT, day);
            }
        }
    }
    return advanced;
}

/**
 * What another twelve years on the same ground did to the thing on it.
 *
 * Returns null for anybody who is not one of these, which is how the caller
 * tells a beast row from a person without asking twice.
 *
 * ── THE CLIMB IS READ, THE CROSSING IS AN EVENT ─────────────────────────
 *
 * The rung is a function of the species, the ground and the world's age, so
 * nothing accumulates and a row revisited after eight hundred years is what
 * eight hundred years made rather than what sixty-six reviews added up to. What
 * the pass is for is the CROSSING: something that takes a human shape is news a
 * province hears, and it reaches the world's record through
 * `aCrossingEntersTheWorld` - the same door a cultivator's crossing goes
 * through, which is `recording-what-a-crossing-did.ts`'s own rule that nothing
 * branches on how a crossing was reached.
 *
 * AND IT TAKES A NAME AT THE CHANGE. A row minted below the change carries its
 * species name, and one past it named itself. `theNameItTookAtTheChange` closes
 * the gap between those two states without taking anything away - the species
 * name stays reachable because it is derived from the row's tag.
 */
/**
 * What ends the climb, and it is not a ceiling.
 *
 * A tracked row goes up the ladder by sitting, with no cap anywhere, because
 * the design owner ruled the lid is the one every NPC has: it fights, and it
 * dies, and what follows from a death is what follows from anybody's.
 *
 * ── ON THE REVIEW THAT ALREADY WALKS THIS ROW, NOT ON THE EVENT TABLE ───
 *
 * The first cut was a `Template` with a weight. It was wrong for a measured
 * reason rather than a stylistic one: rows exist only where somebody has
 * hunted, so in a world nobody has been out in the template could never fire
 * and still sat in the weighted draw, shifting the cursor for every other
 * event. `driver.test.ts` went red on it - `vein_lost` stopped happening in a
 * 120-year window on a seed where it always had. A world with no beast rows in
 * it must draw exactly what it drew before, and the only way to promise that is
 * to be somewhere the beast-less world never reaches.
 *
 * So it lives here, inside the branch `applyAdvancement` already takes for
 * these rows, and it costs nothing at all when there are none.
 *
 * ── AND WHO WINS IS PRICED WHERE EVERY OTHER GAP IS ─────────────────────
 *
 * `regardFor` and the two chances a house's sending reads off it. One uniform
 * draw nests the outcomes, because `lostChance` is the square of
 * `notFinishedChance`. There is no beast branch in any of it.
 *
 * A house sending a party out after a core is deliberately NOT this: that
 * errand has its own module and its own wiring, and a second one here would be
 * the same decision made twice. What this is is the ordinary condition of a
 * ledge - whoever else is standing on it.
 */
function oneOfTheseFoughtOnItsOwnGround(
    state: WorldState,
    at: number,
    year: number,
    day: number
): void {
    const it = state.npcs[at];
    const species = theSpeciesItIs(it);
    if (!it || !species || it.status !== 'alive' || it.locationId === null) return;

    const itsRung = it.cultivation.realmOrdinal;
    // Close enough that either of them could have won, which is the condition
    // for a fight happening at all. `CASUAL_KILL_MAX_GAP` is this file's own
    // figure for that, read in both directions.
    const challengers = state.npcs.filter(n =>
        n.status === 'alive' && n.id !== it.id && n.locationId === it.locationId
        && isTheWorldsToMove(n)
        && Math.abs(n.cultivation.realmOrdinal - itsRung) <= CASUAL_KILL_MAX_GAP);
    if (challengers.length === 0) return;

    const rng = forStream(state.seed, 'beast-fought', it.id, year);
    if (!rng.chance(WHETHER_IT_COMES_TO_A_FIGHT)) return;
    const challenger = challengers[rng.int(0, challengers.length - 1)];
    if (!challenger) return;

    const theirRung = challenger.cultivation.realmOrdinal;
    const regard = regardFor(itsRung, theirRung);

    // AND SOMEBODY AT HEIGHT DOES NOT TAKE A FIGHT THEY MIGHT LOSE. Nobody
    // chose this one: it is whoever was standing on the ledge, within
    // `CASUAL_KILL_MAX_GAP`, and the regard band decides it. That is a
    // background rate, and at `WHERE_THE_OLD_MONSTERS_BEGIN` there is not
    // supposed to be one - *"these old monsters value their lives"*. Caution is
    // a trait at that height rather than an exception to a rule, so unless the
    // odds are decisively theirs they are simply not there for it, and nothing
    // is written. The same posture as "why would they" one file over.
    if ((theirRung >= WHERE_THE_OLD_MONSTERS_BEGIN
        || theirDeathWouldRearrangeTheWorld(state, challenger))
        && !wellBeneathYou(regardFor(theirRung, itsRung).band)) return;

    const roll = rng.next();
    const itLived = roll < notFinishedChance(regard);
    const theyDied = roll < lostChance(regard);
    if (itLived && !theyDied) return;

    const place = getLocation(state, it.locationId);
    const placeName = place?.name ?? it.locationId;
    const winner = itLived ? it : challenger;
    const deadAt = indexById(state.npcs, itLived ? challenger.id : it.id);
    if (deadAt < 0) return;
    const dead = state.npcs[deadAt]!;
    const cause = `Killed by ${winner.name} at ${placeName}.`;

    const ended = theWorldEnds(dead, day, cause);
    // The challenge resolved no way at all rather than that way. Everything
    // below - the meal, what came off the body, the fact - is downstream of
    // somebody having died here.
    if (!ended) return;
    state.npcs[deadAt] = ended;
    settleNpcDeath(state, state.npcs[deadAt]!, day);

    // A KILL IS A MEAL. Whichever of the two won, if what won is one of these
    // it climbs for it - and that sticks without being stored twice, because
    // the climb reading takes the higher of where a row stands and what sitting
    // would have given it, and so never reads this rung back down.
    const winnerAt = indexById(state.npcs, winner.id);
    const ateIt = winnerAt >= 0 && theSpeciesItIs(state.npcs[winnerAt]!) !== null;
    if (ateIt) {
        state.npcs[winnerAt] = setRealm(
            state.npcs[winnerAt]!,
            state.npcs[winnerAt]!.cultivation.realmOrdinal + WHAT_A_MEAL_IS_WORTH,
            day
        );
    }

    // AND WHAT IS LEFT OF IT WHERE IT FELL. Nothing is left of one another of
    // these ate. Where a person did it, what they could reach came off with
    // them and what stood above them did not - `whatComesOffTheBody` is already
    // the function that answers that, asked with the killer over the body.
    const worthARow = whatIsWorthARowOffABody(species);
    const left = !itLived && !ateIt
        ? whatComesOffTheBody({
            beast: asItStandsNow(species, itsRung),
            takerOrdinal: theirRung,
            killed: true
        }).leftBehind
            .map(b => b.material)
            .filter(m => worthARow.some(w => w.id === m.id))
        : [];

    const fact = appendWorldFact(state, makeFact({
        day,
        kind: 'catastrophe',
        scale: 'local',
        summary: itLived
            ? `${challenger.name} went at ${it.name} at ${placeName} and did not come back.`
            : `${it.name} was killed at ${placeName} by ${challenger.name}.`,
        actors: [
            { id: winner.id, name: winner.name, role: 'killed them' },
            { id: dead.id, name: dead.name, role: 'died' }
        ],
        locationId: it.locationId,
        visibility: 'public',
        magnitude: 0.3 + Math.min(0.4, Math.max(itsRung, theirRung) / 100),
        data: {
            unattributed:
                'Something was fought over on the high ground, and only one of the two of '
                + 'them walked off it.'
        }
    }));

    for (const material of left) {
        state.objects.push(aPieceOfABodyNobodyHasTaken({
            npcId: dead.id,
            material,
            asItStands: asItStandsNow(species, itsRung),
            itsName: dead.name,
            locationId: it.locationId,
            placeName,
            onDay: day,
            endedBy: cause
        }));
    }
    if (left.length > 0) {
        state.statuses.push(makeAreaStatus(theGroundHasABodyOnIt({
            npcId: dead.id,
            areaId: it.locationId,
            itsName: dead.name,
            ordinal: itsRung,
            onDay: day,
            cause,
            factId: fact.id,
            endedById: challenger.id,
            causeKnownLocally: false
        })));
    }
}

/**
 * Whether a review that finds somebody on this ledge comes to a fight.
 *
 * A row is reviewed every {@link ADVANCEMENT_REVIEW_YEARS}, so this is a fight
 * about once a century on ground that has anybody on it who could try, and
 * never at all on ground that has nobody. Stated as odds rather than simulated,
 * which is the sanctioned method.
 */
export const WHETHER_IT_COMES_TO_A_FIGHT = 0.12;

/**
 * The same thing, asked of one row by id, for a caller outside the yearly pass.
 *
 * The hunt needs it: a row is reviewed once every `ADVANCEMENT_REVIEW_YEARS`,
 * and somebody walking up to a ledge has to meet what is standing on it today
 * rather than what the last review left. The climb is a reading, so asking
 * costs the reading and nothing else - and asking through this rather than
 * re-deriving means the crossing, the name it takes and the news of it all
 * happen once, here, however the question arrived.
 */
export function bringABeastRowUpToWhereItShouldBe(
    state: WorldState,
    npcId: string,
    day: number
): boolean {
    const at = indexById(state.npcs, npcId);
    if (at < 0) return false;
    return aBeastGoesOnSitting(state, at, day) === true;
}

function aBeastGoesOnSitting(state: WorldState, at: number, day: number): boolean | null {
    const npc = state.npcs[at];
    const species = theSpeciesItIs(npc);
    if (species === null) return null;

    const here = npc.locationId === null
        ? undefined
        : state.locations.find(l => l.id === npc.locationId);
    const was = npc.cultivation.realmOrdinal;
    const now = theRungThisRowShouldBeAt({
        beast: species,
        locationId: npc.locationId ?? species.id,
        worldSeed: state.seed,
        onAVein: here ? here.qiDensity >= 60 : false,
        bornOnDay: npc.identity.bornOnDay,
        day,
        standingAt: was
    });
    if (now <= was) return false;

    state.npcs[at] = setRealm(state.npcs[at], now, day);
    const named = theNameItTookAtTheChange(
        state.npcs[at],
        state.seed,
        new Set(state.npcs.map(n => n.name))
    );
    if (named !== null) {
        state.npcs[at] = { ...state.npcs[at], name: named, updatedOnDay: day };
    }
    aCrossingEntersTheWorld(state, {
        who: { id: npc.id, name: state.npcs[at].name, role: 'crossed' },
        fromOrdinal: was,
        toOrdinal: now,
        day: Math.floor(day),
        locationId: npc.locationId
    });
    return true;
}

/**
 * The band of the ground somebody is actually standing on.
 */
function ambientAround(
    state: WorldState,
    npc: NpcRecord,
    region: LocationRecord | undefined
): AmbientQi {
    const here = npc.locationId === null
        ? undefined
        : state.locations.find(l => l.id === npc.locationId);
    return here?.ambient ?? region?.ambient ?? 'normal';
}

/**
 * Sects take people on as they become worth taking on.
 */
/**
 * Books move after seeding, and not because anybody joined anything.
 */
/**
 * Houses raise people, and the seats above them run out.
 */
/**
 * Somebody standing at the end of their shelf finds a way past it.
 */
/**
 * People move back into ruined ground, because they have nowhere else to go.
 */
/**
 * A year of the world's own people working the ground they stand on.
 */
function applyGroundPressure(state: WorldState, day: number): number {
    const standing = new Map<string, number[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.locationId || !isBelowTheLid(npc)) continue;
        const at = standing.get(npc.locationId);
        if (at) at.push(npc.cultivation.realmOrdinal);
        else standing.set(npc.locationId, [npc.cultivation.realmOrdinal]);
    }
    if (standing.size === 0) return 0;

    let pressed = 0;
    for (const place of state.locations) {
        const ordinals = standing.get(place.id);
        if (!ordinals) continue;
        const worked = whatThePeopleHereTake(place, {
            ordinals,
            days: DAYS_PER_YEAR,
            onDay: day
        });
        for (const draw of worked.draws) {
            if (recordGroundDraw(place, draw)) pressed++;
        }
    }
    return pressed;
}

/**
 * What is wrong with the world's places, opened, extended and lifted.
 */
/**
 * Wars that have reached the day they were scheduled to end, ended.
 */
function settleWarsThatAreOver(state: WorldState, day: number): PressureEvent[] {
    const events: PressureEvent[] = [];
    for (const effect of state.schedule) {
        if (effect.data.kind !== 'war_resolution') continue;
        if (effect.dueOnDay > day) continue;
        const sideA = state.factions.find(f => f.id === String(effect.data.sideA ?? ''));
        const sideB = state.factions.find(f => f.id === String(effect.data.sideB ?? ''));
        const stillFighting = [sideA, sideB].filter(
            (f): f is FactionRecord => f !== undefined && f.tags.includes('at_war')
        );
        if (stillFighting.length === 0) continue;
        for (const side of stillFighting) {
            side.tags = side.tags.filter(t => t !== 'at_war');
        }
        events.push(emit(state, 'war_settled', day, {
            day,
            kind: 'war',
            scale: 'regional',
            summary: effect.summary,
            factionIds: stillFighting.map(f => f.id),
            visibility: 'public',
            magnitude: 0.5,
            unattributed:
                'The road east is being used again, and the people who were sleeping outside '
                + 'the walls have mostly gone somewhere.',
            consequences: {
                immediate: 'Both sides have stopped.',
                physical: 'The trade road is passable.',
                tenYearsLater: 'Whichever side lost is still smaller.'
            }
        }, { factions: stillFighting.map(f => f.id) }));
    }
    return events;
}

function applyAreaStatuses(state: WorldState, year: number, day: number): AreaStatus[] {
    const atWar = new Set(
        state.factions.filter(f => f.dissolvedOnDay === null && f.tags.includes('at_war'))
            .map(f => f.id)
    );
    const byFaction = new Map(state.factions.map(f => [f.id, f]));
    const standing = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.locationId) continue;
        standing.set(npc.locationId, (standing.get(npc.locationId) ?? 0) + 1);
    }

    const ground: GroundAsItStands[] = [];
    const regions: LocationRecord[] = [];
    for (const place of state.locations) {
        if (!isBelowTheLid(place)) continue;
        if (place.kind === 'region') { regions.push(place); continue; }
        const holderRow = place.controllingFactionId
            ? byFaction.get(place.controllingFactionId) ?? null
            : null;
        const holder = holderRow && holderRow.dissolvedOnDay === null
            ? { id: holderRow.id, name: holderRow.name }
            : null;
        ground.push({
            place,
            peopleHere: standing.get(place.id) ?? 0,
            holder,
            holderIsAtWar: holder !== null && atWar.has(holder.id),
            holderFightingNames: holder === null || !atWar.has(holder.id)
                ? []
                : [...atWar].filter(id => id !== holder.id)
                    .map(id => byFaction.get(id)?.name ?? '')
                    .filter(name => name.length > 0)
                    .slice(0, 1),
            isTheHoldersSeat: holderRow !== null && holderRow.seatLocationId === place.id
        });
    }

    const proposed = whatIsWrongWithPlacesToday({
        ground,
        regions,
        onDay: day,
        rng: forStream(state.seed, 'area-status', year)
    });

    // WHAT IS ALREADY TRUE
    const endedToday = new Map<string, number>();
    for (const status of state.statuses) {
        if (status.liftedOnDay === null) continue;
        const key = statusKey(status.areaId, status.kind);
        endedToday.set(key, Math.max(endedToday.get(key) ?? 0, status.liftedOnDay));
    }

    const opened: AreaStatus[] = [];
    for (let i = 0; i < state.statuses.length; i++) {
        const status = state.statuses[i];
        // Something already ended is ended. It may be proposed again, and then
        // it opens as a new row with its own dates, because a famine and the
        // famine eighty years before it are two famines.
        if (status.liftedOnDay !== null) continue;
        const key = statusKey(status.areaId, status.kind);
        const still = proposed.get(key);
        // Whatever is on the books holds this key. A second row for the same
        // thing in the same place is one thing, not two.
        proposed.delete(key);
        // THE REVIEW WINDOW IS THE PASS INTERVAL, AND IT HAS TO BE.
        if (day + DAYS_PER_YEAR < status.reviewOnDay) continue;
        // AND A CAUSE THAT NEVER GOES AWAY DOES NOT BUY A STATUS THAT NEVER
        // ENDS. The layer's own line is that a status is what is true of a
        // place for a WHILE, and what a place permanently became belongs in
        // `LocationChange`. Ground hunted out by a population that is still
        // standing on it stays hunted out, so the tide over it was extended
        // every year forever - measured at 182,135 days, which is not a tide.
        const overrun = day - status.beganOnDay >= (still?.mayRunForDays ?? 0);
        state.statuses[i] = still && !overrun
            ? extendStatus(status, Math.max(status.reviewOnDay + 1, day + still.reviewInDays))
            : liftStatus(status, Math.max(day, status.beganOnDay + 1));
        if (overrun) endedToday.set(key, day);
    }

    // ── AND WHAT HAS JUST BECOME TRUE ──
    for (const [key, candidate] of proposed) {
        const lastEnded = endedToday.get(key);
        if (lastEnded !== undefined && day - lastEnded < candidate.quietForDaysAfter) continue;
        // The cause on the record BEFORE the status, so `cause.factId` points
        // at something. A status that appeared from nowhere is the thing
        // `BEAST_TIDES` was written to forbid.
        const fact = appendWorldFact(state, makeFact({
            day,
            kind: candidate.factKind,
            scale: 'regional',
            summary: candidate.cause.what,
            locationId: candidate.areaId,
            factionIds: candidate.cause.decidedById ? [candidate.cause.decidedById] : [],
            actors: [],
            visibility: 'regional',
            fidelity: candidate.causeKnownLocally ? 'full' : 'partial',
            causeKnown: candidate.causeKnownLocally,
            magnitude: 0.5,
            data: { areaStatus: candidate.kind, areaId: candidate.areaId }
        }));

        const status = makeAreaStatus({
            id: `as-${year}-${key}`,
            areaId: candidate.areaId,
            kind: candidate.kind,
            statement: candidate.statement,
            cause: { ...candidate.cause, factId: fact.id },
            signs: candidate.signs,
            causeKnownLocally: candidate.causeKnownLocally,
            beganOnDay: day,
            reviewOnDay: day + Math.max(1, Math.round(candidate.reviewInDays)),
            stops: candidate.stops,
            priceMultiplier: candidate.priceMultiplier,
            priceMultiplierByCategory: candidate.priceMultiplierByCategory,
            dangerDelta: candidate.dangerDelta
        });
        state.statuses.push(status);
        opened.push(status);
    }
    return opened;
}

function applyResettlement(state: WorldState, year: number, day: number): number {
    const regions = state.locations.filter(l => l.kind === 'region' && isBelowTheLid(l));
    let settled = 0;

    for (const region of regions) {
        const under = locationIdsUnder(state, region.id);
        const habitable = state.locations.filter(l =>
            under.has(l.id) && (l.kind === 'settlement' || l.kind === 'sect_seat')
            && !l.sealed && l.thresholds.entry <= 0 && l.thresholds.survival <= 0);
        const people = state.npcs.filter(n =>
            n.status === 'alive' && n.locationId !== null && under.has(n.locationId)).length;
        if (people === 0) continue;

        // One habitable place per fifty people is thin but not desperate. Below
        // that the province is short of anywhere to live and somebody moves
        // into a ruin; above it nobody bothers, because a ruin is a worse place
        // to live than a village and everybody knows it.
        const wanted = Math.max(1, Math.ceil(people / 50));
        if (habitable.length >= wanted) continue;

        const candidates = state.locations.filter(l =>
            under.has(l.id) && l.kind === 'ruin' && !l.sealed
            && l.thresholds.entry <= 0 && l.thresholds.survival <= 0);
        if (candidates.length === 0) continue;

        const rng = forStream(state.seed, 'resettle', region.id, year);
        // Rare per year even under pressure. A province does not repopulate its
        // wreckage in a decade, and a world that did would never feel emptied.
        if (!rng.chance(0.04)) continue;

        const site = candidates[rng.int(0, candidates.length - 1)];
        const at = indexById(state.locations, site.id);
        state.locations[at] = {
            ...site,
            kind: 'settlement',
            description: site.description
                + ' People live here again, in and among what was here before.',
            data: { ...site.data, populationWeight: 1, resettledOnDay: day }
        };
        settled++;
    }
    return settled;
}

function applyFoundRoads(state: WorldState, year: number, day: number): number {
    let found = 0;
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        const ceiling = reachableCeilingFor(state, npc) || BOOKLESS_CEILING;
        if (npc.cultivation.realmOrdinal < ceiling) continue;
        const luck = forStream(state.seed, 'found-a-road', npc.id, year);
        if (!mightFindARoad(npc, ceiling, luck)) continue;
        const road = roadTheyFound(npc, ceiling, luck);
        if (!road) continue;
        state.npcs[i] = {
            ...npc,
            cultivation: {
                ...npc.cultivation,
                techniqueIds: [...npc.cultivation.techniqueIds, road]
            },
            updatedOnDay: day
        };
        found++;
    }
    return found;
}

function applyPromotions(state: WorldState, day: number): number {
    const { promotions, blocked } = assessPromotions(state);
    // WHO THE HOUSE COULD NOT RAISE, AND SINCE WHEN. Before the early return,
    // because a year with no promotion in it is a year everybody blocked waited.
    noteWhoIsHeldBack(state, blocked, day, isTheWorldsToMove);
    if (promotions.length === 0) return 0;
    const roster = rosterOf(state);
    const at = roster.at;
    for (const p of promotions) {
        const i = at.get(p.npcId);
        if (i === undefined) continue;
        // NOT THE PLAYER'S. This was the one pass that wrote the player's world
        // row without asking, and it did not only write a field: it appended a
        // chronicle fact saying the house had raised them, which the next
        // refresh of that row cannot take back. A promotion the player never
        // earned, on the record, permanently.
        if (!isTheWorldsToMove(state.npcs[i])) continue;
        state.npcs[i] = { ...state.npcs[i], factionRankIndex: p.toRank, updatedOnDay: day };
        recordPromotion(state, state.npcs[i], p, day);
    }
    // The other half of a promotion, which this call has always computed and
    // always discarded: everybody who had met the bar and watched somebody else
    // take the seat. `blocked` carries the reason, and `outranked` is the one
    // with a person in it.
    applyPassedOver(state, promotions, blocked, day, roster);
    return promotions.length;
}

/**
 * HOUSES AT WAR, OPENING WHAT THEY HOLD.
 *
 * One pass, once a year, over the houses a war names. Nothing here decides
 * anything: it reads how the war is going off the compound (`HALLS_DOWN`, which
 * `what-a-year-of-war-does-to-a-compound.ts` already counts), puts the question
 * to the house's own elders, and moves what they agreed to move.
 *
 * ARMING IS THE DISCRETE HALF and the only half that produces an event. Stones
 * leaving for a war are a rate - nobody remembers the year the house paid for
 * arrows - but a house taking its good weapons out of the vault and putting
 * them in disciples' hands is a thing everybody who was there remembers, and it
 * is a LOAN: ownership never moves and the house can call every one back in.
 */
function housesOpeningTheirVaults(state: WorldState, day: number): PressureEvent[] {
    const out: PressureEvent[] = [];
    const onDay = Math.floor(day);

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        if (!house.tags.includes('at_war')) continue;

        const how = howTheWarGoesFor({
            atWar: true,
            hallsDown: Number(house.resources[HALLS_DOWN] ?? 0)
        });
        const members = state.npcs.filter(npc =>
            npc.factionId === house.id && npc.status === 'alive');
        if (members.length === 0) continue;

        const armed = armItsOwn({
            how,
            roll: members.map(npc => ({ id: npc.id, rankIndex: npc.factionRankIndex })),
            rankCount: house.ranks.length,
            holds: state.objects.filter(o => o.ownerId === house.id),
            takers: members.map(npc => ({
                id: npc.id,
                name: npc.name,
                ordinal: npc.cultivation.realmOrdinal
            })),
            houseName: house.name,
            onDay
        });
        if (armed.lent.length === 0) continue;

        // The rows, moved. One write per object that actually left.
        const moved = new Map<string, ObjectRecord>(
            armed.objects.map(o => [o.id, o] as const));
        for (let i = 0; i < state.objects.length; i++) {
            const next = moved.get(state.objects[i].id);
            if (next) state.objects[i] = next;
        }

        const fact = appendWorldFact(state, makeFact({
            day: onDay,
            kind: 'war',
            scale: 'local',
            summary: `${house.name} opened its vault and armed its own: `
                + `${armed.lent.length} of its own things into its own hands, lent.`,
            actors: armed.lent.slice(0, 4).map((l: HandedOut) => ({
                id: l.toId, name: l.toName, role: 'armed'
            })),
            locationId: house.seatLocationId ?? null,
            factionIds: [house.id],
            visibility: 'faction',
            magnitude: how === 'about_to_lose' ? 0.7 : 0.45,
            data: { how, lent: armed.lent.length }
        }));

        out.push({
            kind: 'house_armed_its_own',
            onDay,
            fact,
            touched: {
                factions: [house.id],
                locations: [],
                npcs: armed.lent.map((l: HandedOut) => l.toId)
            },
            deaths: []
        });
    }

    return out;
}

function applyBookAcquisition(state: WorldState, year: number, day: number): number {
    const rng = forStream(state.seed, 'books', year);
    const living: number[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        if (state.npcs[i].status === 'alive' && isBelowTheLid(state.npcs[i])
            // What the player has read is on their own sheet, and `manuals.ts`
            // is emphatic that a book they never earned is the defect this
            // whole layer exists to close. The row would take one and lose it
            // again at the next refresh, having spent a draw on the way.
            && isTheWorldsToMove(state.npcs[i])) living.push(i);
    }
    if (living.length === 0) return 0;

    // Name replacements first, so somebody promoted this year can be handed
    // the shelf in the same pass rather than waiting another turn of the clock.
    const npcAt = new Map(state.npcs.map((n, i) => [n.id, i]));
    for (const pick of refreshChosen(state)) {
        const i = npcAt.get(pick.id);
        if (i === undefined) continue;
        state.npcs[i] = { ...state.npcs[i], tags: [...state.npcs[i].tags, 'chosen'], updatedOnDay: day };
    }

    let handed = 0;
    const looks = Math.max(1, Math.round(living.length / 8));
    for (let s = 0; s < looks; s++) {
        const at = living[rng.int(0, living.length - 1)];
        if (handOnWhatTheyAreEntitledTo(state, at, day)) handed++;
    }
    return handed;
}

function applyRecruitment(state: WorldState, year: number, day: number): number {
    const admitting = state.factions.filter(
        f => f.dissolvedOnDay === null && isBelowTheLid(f) && f.tags.includes('recruits')
    );
    if (admitting.length === 0) return 0;

    const rng = forStream(state.seed, 'recruitment', year);
    let joined = 0;

    // A sample rather than the whole roster: joining is rare per person per
    // year, and the cost has to stay a constant across five centuries.
    const free: number[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        // And never the player. Which house they are in is a decision they make
        // at a gate, through `sects`, and a world pass that quietly enrolled
        // them would be the engine taking the decision - the exact shape the
        // agency rule forbids.
        // AND NOT A BEAST. This pass reads a rung and a province and nothing
        // else, so the moment a beast row could climb into an admission band it
        // started being enrolled: measured on seed `beast-advance`, a White
        // Tiger that reached Nascent Soul was taken onto the Storm Tyrant
        // Court's roll at rank 3 and then killed by the `elder_died` pass,
        // which only looks at people with a house and a rank. The row's own
        // file already states the rule - it takes no orders and holds no purse,
        // and a house that has an arrangement with one did not buy it.
        // AND NOT SOMEBODY A GATE HAS ALREADY TURNED AWAY. What they were
        // refused for does not change, and the intake does not come back to
        // them: see `the-rogues-a-world-opens-with.ts`.
        if (npc.status === 'alive' && isBelowTheLid(npc) && npc.factionId === null
            && isTheWorldsToMove(npc) && theSpeciesItIs(npc) === null
            // A RECORD IS NOT READ HERE ANY MORE. It used to strike anybody a
            // house had expelled off every intake in the world for ever, with
            // no read of which house was looking. It is an opinion, and the
            // house doing the looking is the one who holds it: see
            // `aHouseWouldTakeThemAnyway` below.
            && !wasTurnedAwayAtAGate(npc)) free.push(i);
    }
    if (free.length === 0) return 0;

    // THE STRONGEST ON EACH ROLL. A house does not take in at its bottom rung
    // somebody who stands above everybody on it: there is nothing it could tell
    // them and no rung it could hold them on. Measured on `shape-a`: the world's
    // one False Immortal was enrolled as an outer disciple in his first year,
    // and a Hollow Court Seat who had walked out joined a splinter at rung zero.
    const strongest = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId === null) continue;
        strongest.set(npc.factionId, Math.max(strongest.get(npc.factionId) ?? -1, npc.cultivation.realmOrdinal));
    }

    const roads = theRoadsOntoARollThisYear(state, year);
    const looks = Math.max(1, Math.round(free.length / 12));
    for (let s = 0; s < looks; s++) {
        const at = free[rng.int(0, free.length - 1)];
        const npc = state.npcs[at];
        if (npc.factionId !== null || npc.status !== 'alive') continue;

        // In reach of the gate, which means the same province.
        //
        // Not "the seat IS the npc's location, or its direct parent". That
        // holds only while factions sit on region nodes and everybody stands
        // on one; with real settlements and real sect grounds the seat is a
        // SIBLING of the npc's village, and such a filter matches nobody.
        const home = regionOf(state, npc.locationId);
        const options = admitting.filter(f =>
            npc.cultivation.realmOrdinal >= Number(f.resources.admission_ordinal ?? 0) &&
            // The one floor that is not a rung. A house that takes one sex and
            // not the other refuses at the door, and the world's own intake has
            // to be bound by it or the rule binds the player and nobody else -
            // which is this repository's signature defect, inverted.
            (whoAHouseWillTake(f.id) ?? npc.identity.sex) === npc.identity.sex &&
            // AND A HOUSE WITH NOBODY MODELLED ON IT IS JUDGED BY WHAT IT CLAIMS.
            // This read an empty roll as no ceiling at all, so a house the year
            // had emptied would take anybody: the world's False Immortal was
            // enrolled by the Sweptground Temple within ten years of a pass that
            // scattered it.
            npc.cultivation.realmOrdinal
                <= (strongest.get(f.id) ?? Number(f.resources.power_ordinal ?? 0)) &&
            (f.seatLocationId === null ||
                (home !== null && regionOf(state, f.seatLocationId) === home))
        );
        // AND ONLY THROUGH A DOOR. The design owner: *"NPCs join the same way
        // you do."* A house in reach takes somebody only where it has a road to
        // them this year - somebody of it out looking for disciples where they
        // stand, its grounds open for a selection, or the intake its notice named
        // held where they live - and whoever that is took them on. See
        // `the-world-joins-a-house-the-way-a-player-does.ts`.
        const withARoad = options
            .map(f => ({ house: f, road: roads.roadFor(f, npc) }))
            .filter(row => row.road !== null);
        if (withARoad.length === 0) continue;
        if (!rng.chance(0.35)) {
            // AND A HOUSE THAT LOOKED AND PASSED DOES NOT COME BACK. `rogues.ts`
            // on where the unaffiliated come from: refused at admission is *"the
            // commonest origin by a wide margin"*, *"usually for root quality"* -
            // which does not change, so neither does the answer. Without this,
            // everybody who reached Foundation was eventually taken by somebody
            // and the world held no rogues to speak of.
            if (rng.chance(WHAT_A_GATE_REFUSES_FOR_GOOD)) {
                state.npcs[at] = {
                    ...npc,
                    tags: Array.from(new Set([...npc.tags, TURNED_AWAY_AT_A_GATE])),
                    updatedOnDay: day
                };
            }
            continue;
        }

        const chosen = withARoad[rng.int(0, withARoad.length - 1)]!;
        // AND WHAT THIS HOUSE MAKES OF WHAT IT HAS HEARD ABOUT THEM.
        if (!aHouseWouldTakeThemAnyway(state, npc, chosen.house, rng)) continue;
        state.npcs[at] = { ...npc, factionId: chosen.house.id, factionRankIndex: 0, updatedOnDay: day };
        whatTakingInSomebodysCastOffStirs(state, npc, chosen.house, day);
        // Whoever of the house took them on owes it a report, which is what
        // lets them in at the gate. See `a-house-expects-somebody-it-took-on.ts`.
        theyOweTheHouseAReport(state, chosen.road!.recruiterId, {
            houseId: chosen.house.id,
            person: { id: npc.id, name: npc.name },
            placeId: npc.locationId,
            onDay: day
        });
        joined++;
    }
    return joined;
}

/**
 * Factions pay for themselves, or they do not.
 */
/**
 * How often a house puts a party on the road, per year.
 */
const SENDINGS_PER_HOUSE_YEAR = 0.2;

/** The one reason a house has only because it could not make payroll. */
const BECAUSE_IT_CANNOT_PAY = 'ground_that_pays_somebody_else';

/**
 * Every piece of ground in the world that pays whoever stands on it.
 *
 * Priced by the two functions the yearly economy itself reads, so a house
 * cannot reach for a town believing it is worth something the economy would not
 * then collect. Built once for the whole pass: it is asked by every house whose
 * purse has run out, and there are about twenty-five such places in a world.
 *
 * A VEIN IS PRICED TO THE HOUSE THAT WOULD HOLD IT and a town is not, which is
 * the economy's own asymmetry rather than one invented here - `share` scales
 * what a house draws out of a rock and does not scale what the people of a town
 * pay to be on somebody's books.
 */
function groundThatPaysSomebody(
    state: WorldState,
    regionFor: (locationId: string | null) => string | null
): { place: LocationRecord; provinceId: string | null; townPays: number }[] {
    const out: { place: LocationRecord; provinceId: string | null; townPays: number }[] = [];
    for (const place of state.locations) {
        if (!isBelowTheLid(place)) continue;
        if (place.kind !== 'settlement' && place.kind !== 'vein') continue;
        if (place.tags.includes('forbidden')) continue;
        const townPays = whatATownPaysItsHolder(place);
        if (place.kind === 'settlement' && townPays <= 0) continue;
        out.push({ place, provinceId: regionFor(place.id), townPays });
    }
    return out;
}

/**
 * The ground THIS house would reach for, priced to it.
 *
 * Its own province, because the thing that makes a house walk its people out to
 * a piece of ground is the ground being near enough to walk to - the same
 * scoping `forbiddenGroundInTheProvinceOf` states for the same reason.
 *
 * Nobody's, or somebody's this house owes nothing to. An ally's town is not on
 * the table: a body that would ruin the one relationship it has is a body
 * making a different decision, and `ALLIED_STANDING` is the world's own line.
 */
function groundThisHouseCouldTake(
    paying: readonly { place: LocationRecord; provinceId: string | null; townPays: number }[],
    faction: FactionRecord,
    byId: ReadonlyMap<string, FactionRecord>,
    provinceOfTheSeat: string | null
): GroundThatPays[] {
    const share = whatItCanPutOnTheGround(Number(faction.resources.reliable_ordinal ?? 0));
    const out: GroundThatPays[] = [];
    for (const row of paying) {
        if (provinceOfTheSeat === null || row.provinceId !== provinceOfTheSeat) continue;
        const holderId = row.place.controllingFactionId;
        if (holderId === faction.id) continue;
        const holder = holderId === null ? null : byId.get(holderId) ?? null;
        if (holder && holder.dissolvedOnDay !== null) continue;
        if (holder && (faction.standing[holder.id] ?? 0) >= ALLIED_STANDING) continue;
        out.push({
            locationId: row.place.id,
            name: row.place.name,
            paysAYear: row.place.kind === 'vein'
                ? Math.round(whatAVeinPaysItsHolder(share))
                : row.townPays,
            heldById: holder?.id ?? null,
            heldByName: holder?.name ?? null,
            theirPowerOrdinal: Number(holder?.resources.power_ordinal ?? 0)
        });
    }
    return out;
}

/**
 * What a house's purse says about what it has a reason to do.
 *
 * ONE READING, and it exists because there are two callers: the yearly pass
 * below, which hoists the two halves out of the loop because it asks for every
 * house in the world, and the board a player is standing in front of, which
 * asks about one. A second answer in the web layer would be a second opinion
 * about whether a house is broke, and the board and the world would come apart.
 */
export function howAHouseStandsForMoney(
    state: WorldState,
    faction: FactionRecord
): { cannotPayItsPeople: boolean; knowsGroundThatWouldPayIt: boolean } {
    let members = 0;
    for (const npc of state.npcs) {
        if (npc.status === 'alive' && npc.factionId === faction.id) members++;
    }
    const payroll = members * A_STIPEND_PER_MEMBER_PER_YEAR;
    const purse = howThePurseIsRunning(
        Number(faction.resources.spirit_stones ?? 0), payroll);
    if (purse !== 'cannot_pay') {
        return { cannotPayItsPeople: false, knowsGroundThatWouldPayIt: false };
    }
    const could = groundThisHouseCouldTake(
        groundThatPaysSomebody(state, id => regionOf(state, id)),
        faction,
        new Map(state.factions.map(f => [f.id, f] as const)),
        regionOf(state, faction.seatLocationId)
    );
    return {
        cannotPayItsPeople: true,
        knowsGroundThatWouldPayIt: whichGroundWouldPayIt(could, payroll) !== null
    };
}

/**
 * Everything this house could put a party on, counted and tracked alike.
 *
 * THE YARD WAS THE CARRIAGES AND NOTHING ELSE, and the two halves of a house's
 * transport are kept in two different places by design - a counted craft is a
 * line in `resources`, a tracked one is a row in `state.objects` with a past -
 * so the pass that asks what a house is taking asked one of them. A house that
 * built or bought a hull walked its people out on a carriage.
 *
 * Walking is not a row here. Nothing offered is `bestForThisRoad`'s null, and
 * null is what the caller already reads as walking.
 */
function whatThisHouseCouldTakeOut(
    state: WorldState,
    faction: FactionRecord
): { conveyance: Conveyance; power: number | null }[] {
    const out: { conveyance: Conveyance; power: number | null }[] = [];
    for (const id of CARRIAGES_BY_GRADE) {
        if (countedHolding(faction.resources, id) > 0) {
            out.push({ conveyance: requireConveyance(id), power: null });
        }
    }
    for (const thing of state.objects) {
        if (thing.ownerId !== faction.id) continue;
        const id = thing.data.conveyanceId;
        if (typeof id !== 'string') continue;
        const kind = getConveyance(id);
        if (kind === undefined) continue;
        out.push({ conveyance: kind, power: thing.power ?? null });
    }
    return out;
}

/**
 * A house that could not pay its people sells the thing it built.
 *
 * The decision is `whatAHouseWouldSell`'s and the whole of it; this moves the
 * stones, the register and the row in the ledger. It runs after the economy so
 * the purse it reads is this year's, and before the sendings so a house that
 * sold something this year can put people on the road with the proceeds.
 *
 * ONE SALE A HOUSE A YEAR. A body clearing out its yard in an afternoon is a
 * body dissolving, which the world already has a pass for.
 */
function applyWhatAHouseHadToSell(state: WorldState, day: number): number {
    const roll = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        roll.set(npc.factionId, (roll.get(npc.factionId) ?? 0) + 1);
    }

    const asAtTheTable = (f: FactionRecord): AHouseAtTheTable => ({
        id: f.id,
        name: f.name,
        purse: Number(f.resources.spirit_stones ?? 0)
    });

    let sold = 0;
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        const payroll = (roll.get(faction.id) ?? 0) * A_STIPEND_PER_MEMBER_PER_YEAR;
        const purse = Number(faction.resources.spirit_stones ?? 0);
        if (howThePurseIsRunning(purse, payroll) !== 'cannot_pay') continue;

        const deal = whatAHouseWouldSell({
            seller: asAtTheTable(faction),
            owns: state.objects.filter(o => o.ownerId === faction.id),
            circle: circleCandidatesFor(state, faction).map(asAtTheTable),
            shortBy: payroll - purse
        });
        if (deal === null) continue;

        const buyer = state.factions.find(f => f.id === deal.buyer.id);
        if (!buyer) continue;
        const index = indexById(state.objects, deal.craft.id);
        if (index < 0) continue;

        buyer.resources.spirit_stones = Math.max(
            0, Number(buyer.resources.spirit_stones ?? 0) - deal.price);
        faction.resources.spirit_stones = purse + deal.price;
        state.objects[index] = boughtFromItsOwner(state.objects[index]!, {
            buyer: { id: buyer.id, name: buyer.name },
            seller: { id: faction.id, name: faction.name },
            onDay: day,
            price: deal.price,
            source: `${faction.name}'s yard`
        });
        sold++;

        appendWorldFact(state, makeFact({
            day,
            kind: 'treasure_found',
            scale: 'regional',
            // WHAT A WATCHER SEES, which is the thing moored somewhere else. A
            // house's insolvency is not visible from outside it, and a public
            // row stating the motive is the engine reading its own column
            // aloud - the narrator then writes it as something a stranger
            // observed. The figure and the shortfall stay in `data`, where the
            // two houses' own reading of it can reach them.
            summary:
                `${deal.craft.name} is moored on ${buyer.name}'s ground. `
                + `It was ${faction.name}'s.`,
            locationId: faction.seatLocationId,
            factionIds: [faction.id, buyer.id],
            actors: [],
            visibility: 'public',
            magnitude: 0.5,
            data: {
                craftId: deal.craft.id,
                conveyanceId: String(deal.craft.data.conveyanceId ?? ''),
                price: deal.price,
                shortBy: deal.shortBy
            }
        }));
    }
    return sold;
}

/**
 * Houses put people on the road, and what comes back is news.
 */
function applySendings(
    state: WorldState,
    year: number,
    day: number,
    /**
     * The first day of the YEAR this pass is reporting on.
     *
     * An errand is dated inside the year rather than projected past the end of
     * it. {@link whenTheErrandHappened} carries the whole argument. The year
     * rather than the caller's span because a bound that is a property of how a
     * span was chopped up makes the errand's dates one too.
     */
    yearStartsOn: number,
    /**
     * The last day the world will have reached when this year is over.
     *
     * An errand whose term does not fit inside the year is a party still out
     * rather than one that came back. This was the sending line's own day,
     * which was that number ONLY because the clamped year index had already
     * pushed that day to the end of the span. Un-clamping it would have
     * shortened every errand's window from the year to the 175 days before the
     * line runs, and taken the two longest rows of the fifteen in
     * `SENDING_REASONS` - 180 days and 720 - out of the world's reach instead
     * of the one the gap in `whenTheErrandHappened` is written for.
     */
    yearEndsOn: number,
    actOnAnEmptyPurse: boolean
): number {
    const rng = forStream(state.seed, 'sendings', year);
    const roster = new Map<string, OnTheRollForAnErrand[]>();
    const roll = new Map<string, OnTheRoll[]>();
    const at = new Map<string, number>();
    // Where each name on a roll is standing, for whether the province's talk
    // reaches them. Built once and memoised on both halves: `regionOf` walks a
    // location's parents, and this is asked once per person per piece of ground.
    const province = new Map<string | null, string | null>();
    const regionFor = (locationId: string | null): string | null => {
        const had = province.get(locationId);
        if (had !== undefined) return had;
        const found = theRegionNewsIsMeasuredIn(state, locationId);
        province.set(locationId, found);
        return found;
    };
    const tellers = new Map<string, TellerStanding | null>();
    const tellerAt = (holderId: string): TellerStanding | null => {
        const had = tellers.get(holderId);
        if (had !== undefined) return had;
        const index = at.get(holderId);
        const npc = index === undefined ? undefined : state.npcs[index];
        const built = npc ? whereThisPersonIsStanding(state, npc, regionFor) : null;
        tellers.set(holderId, built);
        return built;
    };
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        at.set(npc.id, i);
        if (npc.status !== 'alive' || !npc.factionId) continue;
        // WHO THE HOUSE KNOWS THROUGH IS EVERYBODY ON THE ROLL, including the
        // player's mirror row, which the party below still excludes. Knowing
        // something is not being spent on an errand, and a house does not stop
        // knowing what one of its people knows because that person is not the
        // world's to move.
        const knowers = roll.get(npc.factionId);
        const who = { id: npc.id, rankIndex: npc.factionRankIndex };
        if (knowers) knowers.push(who); else roll.set(npc.factionId, [who]);
        // The player's mirror row is never spent by the world. Sending the
        // character on an errand they did not take is the engine taking a
        // decision that is theirs.
        if (!isTheWorldsToMove(npc)) continue;
        const bucket = roster.get(npc.factionId);
        // THREE COLUMNS THE ROSTER NEVER CARRIED, all read off the npc already
        // in hand. Where somebody is standing and what rank they hold are what
        // `whatTheHouseCanSpare` needs to know who must stay at the seat; the
        // term is what stops a house drafting somebody it has already sent
        // somewhere. `isAwayOnSomething` is this pass's own predicate, so
        // nothing new decides what being spent means.
        const row = {
            id: npc.id,
            name: npc.name,
            ordinal: npc.cultivation.realmOrdinal,
            rankIndex: npc.factionRankIndex,
            locationId: npc.locationId,
            committedUntilDay: npc.activity && isAwayOnSomething(npc.activity.kind)
                ? npc.activity.untilDay ?? null
                : null
        };
        if (bucket) bucket.push(row); else roster.set(npc.factionId, [row]);
    }

    // Both built once for the whole pass. The reading below is per house per
    // ruin, and each half of it walks something long: the ledger of a
    // two-hundred-year world, and every location in it.
    const standingOnIt = whatStandingOnItGives(state.history.facts);
    // The other half of what a house knows of the ground near it: not who stood
    // there, but which of its own parties came back and said so.
    const cameBack = whatAHousesOwnErrandsBringBack(state.history.facts);
    const knowsTheGround = whatAnybodyCouldHaveOfTheGround(
        standingOnIt,
        whatTheAirCarriesOfTheGround({
            facts: state.history.facts,
            inTheAirFor: (fact, holderId) => {
                const teller = tellerAt(holderId);
                return teller !== null && isInTheAirFor(state, fact, teller, day);
            }
        })
    );
    const openGround = whereTheOpenGroundIs(state.locations, state.currentDay);
    // WHAT THE WORLD HAS THAT PAYS, once for the whole pass. Asked only by the
    // houses that could not pay their own people, and there are usually none.
    const paying = groundThatPaysSomebody(state, regionFor);
    const houseById = new Map(state.factions.map(f => [f.id, f] as const));

    let sent = 0;
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        const party0 = roster.get(faction.id);
        if (!party0 || party0.length === 0) continue;

        // AND WHAT THE HOUSE CAN ACTUALLY SPARE. Three bounds already applied -
        // the errand's hands, the craft's heads, the chest - and none of them
        // asked whether anybody was left. Measured before this: a third of
        // seated houses had every living member standing somewhere that was
        // not their own seat after a single day, and the gate then told a
        // visitor there was nobody of the house to ask.
        const spare = whatTheHouseCanSpare({
            roster: party0,
            rankCount: faction.ranks.length,
            seatLocationId: faction.seatLocationId,
            onDay: day
        });

        // A solvent house keeps something in the yard, and WHICH something is
        // what it can afford. The writer `adjustCountedHolding` never had, and
        // what it changes is how long a posting takes - so a house that can
        // only run to a drawn carriage is a house whose people arrive later,
        // which is the whole point of there being three grades.
        const yard = CARRIAGES_BY_GRADE
            .map(id => requireConveyance(id))
            .filter(row => countedHolding(faction.resources, row.id) > 0);
        if (yard.length === 0) {
            const purse = faction.resources.spirit_stones ?? 0;
            const bought = CARRIAGES_BY_GRADE.find(id => purse >= WHAT_A_CRAFT_COSTS_TO_COMMISSION[id]!);
            if (bought !== undefined) {
                faction.resources = adjustCountedHolding(faction.resources, bought, 1);
                faction.resources.spirit_stones = purse - WHAT_A_CRAFT_COSTS_TO_COMMISSION[bought]!;
            }
        }

        if (!rng.chance(SENDINGS_PER_HOUSE_YEAR)) continue;

        // ── WHAT THE PURSE SAYS, WHICH IS A REASON THIS HOUSE HAS ────────
        //
        // The yearly economy has already run and has already clamped this
        // house's purse at whatever it could pay, so both terms are this year's.
        // A house that could not pay its people has a reason no solvent house
        // has, and `NEED_PREDICATES` is where that lives - nothing below
        // branches on being broke.
        const onTheRoll = roll.get(faction.id) ?? [];
        const payroll = onTheRoll.length * A_STIPEND_PER_MEMBER_PER_YEAR;
        const purse = howThePurseIsRunning(
            Number(faction.resources.spirit_stones ?? 0), payroll);
        const couldTake = actOnAnEmptyPurse && purse === 'cannot_pay'
            ? groundThisHouseCouldTake(
                paying, faction, houseById, regionFor(faction.seatLocationId))
            : [];
        const wouldPayIt = whichGroundWouldPayIt(couldTake, payroll);

        // KEPT, NOT THROWN AWAY. This was asked as a predicate and the answer
        // discarded, so the errand a house opened because it knew of a door
        // sent the party somewhere else entirely and the door stayed unvisited.
        const find = aFindThisHouseCouldSendFor({
            ground: openGround,
            houseId: faction.id,
            seatLocationId: faction.seatLocationId,
            roll: roll.get(faction.id) ?? [],
            rankCount: faction.ranks.length,
            stageFor: knowsTheGround,
            errands: cameBack
        });

        const house: HouseAsItStands = {
            id: faction.id,
            name: faction.name,
            holdsGround: faction.controlledLocationIds.length > 0,
            standing: faction.standing,
            // The same three readings the player's board takes, so a house does
            // not visit somebody the world would not have put it in a room with,
            // and does not open a find the board would say it does not know of.
            hasAFind: find !== null,
            sitsDownWith: circleCandidatesFor(state, faction).map(f => f.id),
            standsNearForbiddenGround:
                forbiddenGroundInTheProvinceOf(state.locations, faction.seatLocationId),
            cannotPayItsPeople: purse === 'cannot_pay',
            knowsGroundThatWouldPayIt: wouldPayIt !== null
        };
        const reasons = reasonsOpenTo(house);
        if (reasons.length === 0) continue;
        const reason = weighted(rng, reasons, r => r.weight);
        if (!reason) continue;

        // What the errand is pitched at, where the ground does not say. AROUND THE
        // HOUSE'S OWN MIDDLE, and not its best: pitched off the best, every
        // errand a house had was work for its apex, and the Court's Seats went
        // looking for disciples "at ordinal 45". The draw still reaches a rung
        // above the middle now and again, which is where a sending becomes a
        // story.
        const middle = [...spare.free].sort((a, b) => a.ordinal - b.ordinal)[Math.floor(spare.free.length / 2)]?.ordinal ?? 0;

        // ── WHERE THEY GO, AND IT IS DECIDED BEFORE THE POSTING IS WRITTEN ───
        //
        // The party stands there until the term is up. Before this a sending was
        // resolved without anybody moving: measured, 74 of 76 NPCs who survived
        // two hundred years never changed location once. `setLocation` is the
        // mover, and it had no caller anywhere in the repository.
        //
        // AND THE POSTING IS SITED HERE RATHER THAN AT THE HALL THEY LEFT FROM.
        // `posting.locationId` says what it is for - "the place, carried for the
        // sighting" - and it was handed the house's own seat, so the ledger row
        // for every errand in the world said the errand happened at home and
        // `sighted.locationId` named the courtyard the party walked out of
        // rather than the ground it reached and could not take. Nothing in the
        // world's own record then said anybody had been anywhere, which is why a
        // house's knowledge of its own province stopped at whoever happened to
        // die there.
        //
        // AND THE ONE ERRAND THAT NAMES ITS OWN GROUND. A house reaching for the
        // ground that would pay its people already knows which piece: it is the
        // smallest thing in its own province that would cover the payroll. There
        // is nothing to draw.
        const named = reason.needs === BECAUSE_IT_CANNOT_PAY ? wouldPayIt : null;
        // DRAWN WHATEVER THE REASON IS, so the stream does not depend on which
        // reason came up - the same rule the event draw at the top of this file
        // keeps, and the reason a control arm for the motive is comparable to
        // the world without it at all.
        // THE HOUSES THE REASON IS ABOUT, which is what `seatsInPlay` has asked
        // for since it was written and what no caller passed: every seat in the
        // world went in, so the party sent to collect on a grant was received
        // at a hall drawn at random and the subsidiary that owed it never saw
        // anybody. Read once now rather than twice, because the stake wants the
        // same list: an errand's standing and its terms are with whoever was at
        // the far end of it.
        const aboutHouses = whichHousesAReasonIsAbout(reason.needs, house)
            .filter(id => id !== faction.id);
        const drawn = whereASendingGoes({
            needs: reason.needs,
            fromLocationId: faction.seatLocationId,
            theFind: find?.locationId ?? null,
            seatsInPlay: aboutHouses
                .map(id => state.factions.find(
                    f => f.id === id && f.dissolvedOnDay === null
                )?.seatLocationId ?? null)
                .filter((id): id is string => id !== null),
            // AND WHERE THEY ARE WHEN THEY HAVE NO HALL. The line above drops a
            // seatless house, so without this the errand fell through to ground
            // drawn at random and stopped being the errand it was opened for.
            groundNearThem: groundTheseHousesHold(state.locations, aboutHouses),
            // AND THE ERRAND ABOUT THIS HOUSE'S OWN GROUND ENDS ON IT.
            ownGround: theGroundAHouseHolds(state.locations, faction.id),
            elsewhere: groundAPartyCanBeSentTo(state.locations),
            pick: count => rng.int(0, Math.max(0, count - 1))
        });
        const goingTo = named?.locationId ?? drawn;
        // AND WHERE THE GROUND DOES SAY, IT IS THE GROUND. What a place asks of
        // somebody who means to live through it, which is the pitch a door's
        // race already reads: Fallen Wall asks 12 of anybody, whoever the house
        // has. The rung is drawn whatever the ground, so the stream does not
        // depend on where the party is going.
        const drawnOffTheMiddle = middle + rng.int(-5, 1);
        const groundAsks = goingTo === null
            ? 0
            : state.locations.find(l => l.id === goingTo)?.thresholds.survival ?? 0;
        const pitchDrawn = groundAsks > 0 ? groundAsks : drawnOffTheMiddle;

        // WHAT SUITS THIS ROAD AND THIS CHEST. Asked with the WORK's own head
        // count rather than with the party, because the party is not decided
        // yet and is decided BY this: `postingFor` fills the craft out to what
        // it holds. Asking with the finished party would be circular, and
        // asking with the craft's capacity would price a house out of the very
        // thing that makes its parties big.
        const inTheChest = Number(faction.resources.spirit_stones ?? 0);
        const taking = bestForThisRoad(
            whatThisHouseCouldTakeOut(state, faction),
            reason.days,
            reason.hands,
            false,
            inTheChest
        );

        const posting = postingFor({
            reason,
            house,
            // WHAT THE GROUND WOULD TAKE TO HOLD, when the errand is a piece of
            // ground somebody is standing on. Not the house's own best: the
            // question a party walking onto a town faces is whoever is already
            // there, and for ground nobody holds it is what the place itself
            // asks of anybody standing on it.
            pitchOrdinal: named === null
                ? pitchDrawn
                : Math.max(
                    named.theirPowerOrdinal,
                    state.locations.find(l => l.id === named.locationId)?.thresholds.mastery ?? 0
                ),
            locationId: goingTo ?? faction.seatLocationId,
            // ── WHAT THEY WENT ON, AND WHAT THE CHEST WILL COVER ─────────
            //
            // Not "the best thing in the yard" any more, which was a grade
            // order read off a list and knew nothing about the road or the
            // purse. `bestForThisRoad` is the one answer to which craft suits a
            // journey, it is the answer the player's own `ride` takes, and its
            // `purse` argument is what prices a house out: a hull whose burn
            // this chest will not cover is not an option, so the house takes
            // the carriage and arrives late. That is a consequence the world
            // already models rather than a refusal.
            conveyance: taking?.conveyance ?? null,
            conveyancePower: taking?.power ?? null,
            purse: inTheChest,
            // Whom this house actually has for this errand, read through the
            // module's own eligibility filter rather than a second copy of it.
            available: named === null
                ? whoThisErrandIsPitchedFor(
                    { ceilingOrdinal: reason.ceilingOrdinal, hands: Number.MAX_SAFE_INTEGER, pitchOrdinal: pitchDrawn },
                    spare.free
                ).length
                : whoTheHouseCanSend(
                    { ceilingOrdinal: reason.ceilingOrdinal, hands: Number.MAX_SAFE_INTEGER },
                    spare.free
                ).length
        });
        // AND THE CHEST PAYS FOR THE GROUND THAT IS NOT THERE. One debit, off
        // the figure the posting itself carries, so what a house is charged and
        // what a board would quote cannot come apart. Zero on anything standing
        // on a vein, which is every carriage in the world.
        if (posting.stonesBurned > 0) {
            faction.resources.spirit_stones = Math.max(
                0, Number(faction.resources.spirit_stones ?? 0) - posting.stonesBurned
            );
        }
        // Whom it is pitched for, and nobody it is beneath. The one exception is
        // the ground that would pay: that is the elders reaching past the
        // house's weight with whoever it has, decided just below.
        const party = named === null
            ? whoThisErrandIsPitchedFor(posting, spare.free)
            : whoTheHouseCanSend(posting, spare.free);
        if (party.length === 0) continue;

        // WALKING ONTO SOMEBODY'S GROUND IS A DECISION, and it is the elders'.
        // A broke house having the reason is not the same as the house acting on
        // it: the room is what makes one house march and the house next door sit
        // still with the same empty purse, and the difference is who is in it.
        if (named !== null) {
            const said = whetherTheHouseReaches({
                what: 'taking_ground_that_pays',
                purse,
                roll: onTheRoll,
                rankCount: faction.ranks.length,
                asOfDay: day
            });
            if (!said.reaches) continue;
        }

        // A HOUSE DOES NOT SEND PEOPLE AT SOMETHING IT EXPECTS TO LOSE THEM TO.
        // `duties.ts` has said so since it was written and the sending module names
        // the same two bands - the difference between the two files is the whole
        // ruling: the house declines to send, and a board may still carry one, and
        // the world declines to stop somebody taking it off the wall. This is the
        // house's half, and it is the module's own predicate rather than a
        // threshold invented here.
        //
        // AND THAT `continue` WAS THE RISK AVERSION, which is correct for a house
        // with something to lose and was being applied to one that has nothing.
        // A house that could not pay its people this year does not decline; it
        // asks its own elders, who are moved by the empty purse the same way a
        // war moves them in `what-a-house-opens-its-treasury-for.ts`.
        let reachedPastItsWeight = false;
        if (isImpossibleTier(tierFor(posting, party).band)) {
            if (!actOnAnEmptyPurse || purse !== 'cannot_pay') continue;
            const said = whetherTheHouseReaches({
                what: 'reaching_past_its_weight',
                purse,
                roll: onTheRoll,
                rankCount: faction.ranks.length,
                asOfDay: day
            });
            if (!said.reaches) continue;
            reachedPastItsWeight = true;
        }

        // ── WHEN THE ERRAND HAPPENED ─────────────────────────────────────
        //
        // This pass reports on a year, and an errand whose term fits inside it
        // is one that happened during it. Before this the party left on the day
        // the pass ran - which `withinSpan` clamped to the last day of the span,
        // because the year index was a year ahead of it - and the news of its
        // return was dated after the world's own clock. `whenTheErrandHappened`
        // carries the measurement.
        const when = whenTheErrandHappened({
            notBefore: yearStartsOn,
            reportedOn: day,
            spanEndsOn: yearEndsOn,
            term: posting.days
        });
        const partyIds = party.map(p => p.id);

        // AND A PARTY THAT CANNOT BE BACK BY THE END OF THE SPAN IS STILL OUT.
        // Nothing about the errand is resolved, because nothing about it has
        // happened: no outcome, nobody lost, nothing taken off the house.
        if (when.stillOut) {
            sent++;
            const due = day + posting.days;
            if (goingTo !== null) {
                for (const member of party) {
                    const index = at.get(member.id);
                    if (index === undefined) continue;
                    const row = state.npcs[index];
                    if (row === undefined || !isTheWorldsToMove(row)) continue;
                    state.npcs[index] = {
                        ...setLocation(row, goingTo, day),
                        activity: {
                            kind: 'out_with_a_party',
                            note: `Out for the ${houseName(faction.name)} on `
                                + `${reason.name.toLowerCase()}.`,
                            withIds: partyIds.filter(id => id !== member.id),
                            sinceDay: day,
                            untilDay: due,
                            returnTo: whereTheyGoBackTo(row)
                        }
                    };
                }
            }
            appendWorldFact(state, newsOfAPartyStillOut({
                posting, party, departsOnDay: day, dueOnDay: due
            }));
            continue;
        }

        const sending = resolveSending({
            posting,
            party,
            departsOnDay: when.departsOnDay,
            rng,
            // The ground they reached, for the date it next stands open. Asking
            // the seat for that answered when the house's own front door opens.
            location: goingTo
                ? state.locations.find(l => l.id === goingTo) ?? null
                : null
        });
        sent++;

        if (goingTo !== null) {
            // EVERYBODY WHO WENT, including the ones who will not come back.
            // The lost went out on the same errand to the same place; they are
            // marked missing a few lines below and `markMissing` leaves the
            // activity standing, so what is on their record is the errand that
            // took them. That is also the only thing Internal Affairs has to notice -
            // a house whose people all come home has nothing to raise an alarm
            // about.
            for (const member of party) {
                const index = at.get(member.id);
                if (index === undefined) continue;
                const row = state.npcs[index];
                if (row === undefined || !isTheWorldsToMove(row)) continue;
                state.npcs[index] = {
                    ...setLocation(row, goingTo, when.departsOnDay),
                    // `mustering` is the kind whose own doc names this
                    // machinery, and the one where `withIds` is the party
                    // rather than a companion. The term is what makes a party
                    // still out tellable from a party that never came home.
                    activity: {
                        // `out_with_a_party` and not `mustering`: mustering is
                        // getting people together, and these have gone. The
                        // kind's own doc names this exact machinery.
                        kind: 'out_with_a_party',
                        note: `Out for the ${houseName(faction.name)} on ${reason.name.toLowerCase()}.`,
                        withIds: partyIds.filter(id => id !== member.id),
                        sinceDay: when.departsOnDay,
                        untilDay: sending.returnsOnDay,
                        // Where they came from, which is not their house's
                        // front door. A disciple who lives in a village comes
                        // back to the village - and one drafted out of a
                        // posting comes back to wherever that posting would
                        // have sent them.
                        returnTo: whereTheyGoBackTo(row)
                    }
                };
            }
        }

        for (const missing of sending.lost) {
            const index = at.get(missing.id);
            if (index === undefined) continue;
            // They came back. The sending's own count still says how many
            // were lost, which over-reports by one here - the alternative is
            // re-deriving the party's losses from the rows, which is the
            // second copy of a fact this repo is made of warnings about.
            const gone = theWorldLoses(
                state.npcs[index],
                sending.returnsOnDay,
                `Went out for ${faction.name} on ${reason.name.toLowerCase()} and did not come back.`
            );
            if (!gone) continue;
            state.npcs[index] = gone;
        }

        // AND ONLY WHAT IS WORTH REPEATING BECOMES NEWS
        if (sending.outcome === 'finished' && reason.id === 'sending-for-materials') {
            creditWhatCameBack(faction, partyOrdinal(party), party.length);
        }

        // ── AND A PARTY THAT OPENED A HOLE CARRIES OUT WHAT WAS IN IT ────
        //
        // RUINS YIELD MANUALS, which the setting has asserted in as many words
        // since it was written and which no pass performed: `applyRoadsComprehended`
        // yields dao ground and materials, the spoils pass moves what a house
        // already held, and nothing anywhere put a book into anybody's hands out
        // of the ground. So the road that opens at rung 37 and is taught nowhere
        // was content the world could not reach, and the ladder stopped under it.
        //
        // Only the errand that is about a find, because that is the errand that
        // gets somebody through a door. Nothing here decides how often - the
        // frequency is how often a house has a find standing open in its own
        // province and draws that reason, and what is behind the door is what
        // `what-a-ruin-has-on-its-shelves.ts` says the ground was holding.
        const carriedOut = sending.outcome === 'finished'
            && reason.needs === 'a_find' && goingTo !== null
            ? applyWhatThePartyCarriedOut(state, {
                locationId: goingTo,
                house: {
                    id: faction.id, name: faction.name, seatLocationId: faction.seatLocationId
                },
                readers: party
                    .map(member => at.get(member.id))
                    .filter((index): index is number => index !== undefined)
                    .map(index => state.npcs[index])
                    .filter(row => row !== undefined && isTheWorldsToMove(row)),
                onDay: sending.returnsOnDay
            })
            : [];

        // AND THE GROUND CHANGES HANDS, OR IT DOES NOT. The whole of what the
        // house went for, and the same three writes `vein_lost` makes - the
        // place, the two holds, and what the people who lost it now carry.
        if (named !== null) {
            theGroundWasTakenOrItWasNot(state, {
                faction, named, sending, day: sending.returnsOnDay,
                rng: forStream(state.seed, 'taking-what-pays', faction.id, year)
            });
        }

        // AND THE HOUSE LOSES WHAT IT SAID WAS AT STAKE.
        //
        // Skipped for the one errand that already has its own settlement: a
        // house reaching for ground that pays is answered by
        // `theGroundWasTakenOrItWasNot` above, which is the same stake applied
        // by the path that knows which piece of ground and who was standing on
        // it. Running both would charge it twice.
        const took = named !== null || sending.outcome === 'finished'
            ? null
            : theHouseLostWhatItStaked(state, {
                faction,
                sending,
                onDay: sending.returnsOnDay,
                counterparties: whoTheErrandWasWith(state, aboutHouses, goingTo),
                onTheRoll: onTheRoll.length
            });

        const news = newsOfASending(sending, { onDay: sending.returnsOnDay });
        if (took !== null) news.data = { ...news.data, ...took };
        if (carriedOut.length > 0) {
            news.data = {
                ...news.data,
                roadsCarriedOut: carriedOut.map(b => b.techniqueId).join(' ')
            };
        }
        if (sending.outcome !== 'finished' || news.magnitude >= WORTH_REPEATING
            || reachedPastItsWeight || named !== null || carriedOut.length > 0) {
            appendWorldFact(state, news);
        }
    }
    return sent;
}

/**
 * Which houses this errand was actually with.
 *
 * `whichHousesAReasonIsAbout` answers who a reason is OPEN toward, which for an
 * ally or a counterpart is everybody a house would sit down with. The errand
 * went to one of them, and a failure is only with the house at the far end of
 * it - charging every ally in the province for one botched visit would be a
 * standing rule about a relationship nobody was in.
 *
 * The seat first, because a seat errand's destination was drawn from exactly
 * these houses' seats; then whoever holds the ground, for the houses with no
 * hall. Empty where the errand was about nobody, which is most of them.
 */
function whoTheErrandWasWith(
    state: WorldState,
    aboutHouses: readonly string[],
    goingTo: string | null
): readonly string[] {
    if (goingTo === null || aboutHouses.length === 0) return [];
    const bySeat = aboutHouses.filter(
        id => state.factions.find(f => f.id === id)?.seatLocationId === goingTo);
    if (bySeat.length > 0) return bySeat;
    const holder = state.locations.find(l => l.id === goingTo)?.controllingFactionId ?? null;
    return holder !== null && aboutHouses.includes(holder) ? [holder] : [];
}

/**
 * What a failed sending took off the house, applied.
 *
 * The arithmetic is `whatAFailedSendingTakes`, which is pure and knows nothing
 * about a world; this is the four writes it produces, and the row the ledger
 * carries so the loss can be read back off the chronicle rather than believed.
 *
 * AND THE GROUND LEAVES BY THE DOOR GROUND ALREADY LEAVES BY -
 * `applyLocationChange` plus the two holds - which is what `vein_lost` and
 * `theGroundWasTakenOrItWasNot` both do, so a piece of ground given up on a
 * failed errand reads like every other piece of ground that changed hands.
 */
function theHouseLostWhatItStaked(
    state: WorldState,
    input: {
        faction: FactionRecord;
        sending: ReturnType<typeof resolveSending>;
        onDay: number;
        counterparties: readonly string[];
        onTheRoll: number;
    }
): Record<string, string | number | boolean | null> {
    const { faction, sending, onDay } = input;
    // WHOSE GROUND IT IS, off `theGroundAHouseHolds` and not off the house's
    // own `controlledLocationIds`. The two are not the same set - measured on a
    // seeded world, 64 places are on both and 1,019 carry the location column
    // without being on anybody's list - and the destination for an errand about
    // a house's own ground is drawn off the same reading, so a second one here
    // had every such failure reporting there was nothing to take.
    const took = whatAFailedSendingTakes({
        sending,
        holds: theGroundAHouseHolds(state.locations, faction.id),
        purse: Number(faction.resources.spirit_stones ?? 0),
        onTheRoll: input.onTheRoll,
        counterparties: input.counterparties
    });

    if (took.stones > 0) {
        faction.resources.spirit_stones =
            Math.max(0, Number(faction.resources.spirit_stones ?? 0) - took.stones);
    }

    for (const id of took.regardFalls) {
        const other = state.factions.find(f => f.id === id);
        if (other) adjustStandingBetween(faction, other, -took.regardBy);
    }

    for (const id of took.groundGivenUp) {
        const place = state.locations.find(l => l.id === id);
        if (!place) continue;
        const changed = applyLocationChange(place, {
            onDay,
            kind: 'abandoned',
            summary: `${place.name} stopped answering to the ${houseName(faction.name)}.`,
            causeKnown: true,
            patch: { controllingFactionId: null, addTags: ['changed_hands'] }
        });
        replaceLocation(state, changed.location);
        faction.controlledLocationIds =
            faction.controlledLocationIds.filter(held => held !== id);
        if (place.kind === 'vein') {
            faction.resources.veins = Math.max(0, Number(faction.resources.veins ?? 0) - 1);
        }
    }

    for (const id of took.instrumentsLapsed) {
        const below = state.factions.find(f => f.id === id);
        if (!below) continue;
        const owed = Number(below.resources.tribute_owed_per_year ?? 0);
        below.resources.tribute_owed_per_year =
            Math.max(0, Math.round(owed * (1 - took.instrumentLapsedBy)));
    }

    return {
        errand: sending.posting.reason.id,
        atStake: sending.posting.atStake,
        whatItTook: took.nothingToTake ? 'nothing the world holds' : took.landsOn,
        howBadly: Number(took.howBadly.toFixed(3)),
        stonesLost: took.stones,
        regardFellWith: took.regardFalls.length,
        groundGivenUp: took.groundGivenUp.join(' '),
        instrumentsLapsed: took.instrumentsLapsed.length
    };
}

/**
 * A house walked onto ground that pays, and either it holds it now or it does
 * not.
 *
 * WHAT IT COSTS EITHER WAY. The party is the strongest people the house has -
 * `whoTheHouseCanSend` sorts that way - and whoever did not come back is
 * already `markMissing` by the time this runs. What is left is the ground and
 * what the people who were standing on it think about the house that came.
 */
function theGroundWasTakenOrItWasNot(
    state: WorldState,
    input: {
        faction: FactionRecord;
        named: GroundThatPays;
        sending: ReturnType<typeof resolveSending>;
        day: number;
        rng: CultivationRNG;
    }
): void {
    const { faction, named, sending, day, rng } = input;
    const holder = named.heldById === null
        ? null : state.factions.find(f => f.id === named.heldById) ?? null;
    const took = sending.outcome === 'finished';
    const place = state.locations.find(l => l.id === named.locationId) ?? null;
    if (!place) return;

    if (took) {
        const changed = applyLocationChange(place, {
            onDay: day,
            kind: 'conquered',
            summary: holder
                ? `${place.name} passed to the ${houseName(faction.name)}.`
                : `${place.name} answers to the ${houseName(faction.name)} now, and did not `
                  + 'answer to anybody before.',
            causeKnown: true,
            patch: {
                controllingFactionId: faction.id,
                addTags: ['changed_hands']
            }
        });
        replaceLocation(state, changed.location);

        if (holder) {
            holder.controlledLocationIds =
                holder.controlledLocationIds.filter(id => id !== place.id);
            if (place.kind === 'vein') {
                holder.resources.veins = Math.max(0, (holder.resources.veins ?? 0) - 1);
            }
            adjustStandingBetween(faction, holder, -0.3);
            openPersonalAccount(
                state, holder.id, faction.id, day, `Took ${place.name}.`, rng);
        }
        if (!faction.controlledLocationIds.includes(place.id)) {
            faction.controlledLocationIds.push(place.id);
        }
        if (place.kind === 'vein') {
            faction.resources.veins = (faction.resources.veins ?? 0) + 1;
        }
    } else if (holder) {
        // They came anyway. Whoever was standing there knows who it was.
        adjustStandingBetween(faction, holder, -0.3);
    }

    appendWorldFact(state, makeFact({
        day,
        kind: 'resource_contested',
        scale: 'regional',
        summary: took
            ? `The ${houseName(faction.name)} could not pay its own people and took `
              + `${place.name}` + (holder ? ` off the ${houseName(holder.name)}.` : '.')
            : `The ${houseName(faction.name)} could not pay its own people and walked onto `
              + `${place.name}` + (holder ? ` while the ${houseName(holder.name)} held it` : '')
              + `. ${sending.lost.length} of the ${sending.party.length} it sent did not come back.`,
        actors: [],
        locationId: place.id,
        factionIds: holder ? [faction.id, holder.id] : [faction.id],
        visibility: 'public',
        magnitude: took ? 0.7 : 0.5,
        data: {
            becauseItCannotPay: true,
            took,
            paysAYear: named.paysAYear,
            lost: sending.lost.length,
            unattributed: took
                ? 'The people collecting at that gate are not the ones who were there last '
                  + 'year, and nobody local will say what happened to the ones who were.'
                : 'A column went up the road in good order and came back down it in less '
                  + 'than good order, and fewer.'
        }
    }));
}

/**
 * How often somebody's own reasons are weighed against staying.
 *
 * Five years, the same shape `ADVANCEMENT_REVIEW_YEARS` uses and for the same
 * reason: this is asked of every person on every roll, and a world runs for
 * thousands of years. A person is considered in one year of five and their
 * reasons are a fact about them, so the cadence changes when they leave and
 * never whether they would.
 */
const HOW_OFTEN_SOMEBODY_WEIGHS_IT = 5;

/**
 * People decide for themselves, and go.
 *
 * THE HOUSE DOES NOT DECIDE THIS ONE. Every other way somebody in this world
 * ends up on the road is an institution dispatching them - a posting, an
 * errand, a race to a door that opened. This is the other half, and the test
 * for every line of it is who decided: the person, and the house finds out.
 *
 * WHERE THE PAYOFF COMES FROM, and it is why this is wiring rather than a
 * feature: `roadsInReachOf` is read by `applyAdvancement` off the person's
 * CURRENT location, and `howSomebodyStandsToAGround` already answers
 * `somewhere_else` for every dao ground in a province they are not in. Walking
 * there is the whole of the change. Nothing had ever walked.
 */
function applyPeopleWalkingOut(
    state: WorldState,
    year: number,
    day: number,
    enabled: boolean
): number {
    if (!enabled) return 0;
    const slot = ((year % HOW_OFTEN_SOMEBODY_WEIGHS_IT) + HOW_OFTEN_SOMEBODY_WEIGHS_IT)
        % HOW_OFTEN_SOMEBODY_WEIGHS_IT;

    // THE GROUND THAT TEACHES A ROAD, read once. There are two dozen of these
    // in the world and this is asked of everybody on every roll.
    const teaching: { place: LocationRecord; ground: GroundAsTheRuleReadsIt }[] = [];
    for (const place of state.locations) {
        if (!place.tags.includes(DAO_GROUND_TAG)) continue;
        const ground = groundAtLocation(place);
        if (ground) teaching.push({ place, ground });
    }

    // AND THE DOORS STANDING OPEN, by province, so somebody with no road to
    // walk to still has something local worth leaving for.
    const ruinsByProvince = new Map<string, LocationRecord[]>();
    for (const place of state.locations) {
        if (place.kind !== 'ruin' || !place.discovered || place.sealed) continue;
        if (!isBelowTheLid(place) || place.tags.includes('forbidden')) continue;
        const province = regionOf(state, place.id);
        if (province === null) continue;
        const here = ruinsByProvince.get(province);
        if (here) here.push(place); else ruinsByProvince.set(province, [place]);
    }

    // What each house could pay, and what it teaches. One read per house
    // rather than one per person.
    const paidThisYear = new Map<string, boolean>();
    const teachesTo = new Map<string, number | null>();
    const rollSize = new Map<string, number>();
    // AND NOT A MAP OF EVERY STATUS IN THE WORLD. It was one, and it cost a
    // `Map.set` per person per year over a roster that holds the dead - twelve
    // million of them across a five-century soak - to answer a question asked
    // only of the handful of people whose slot comes up. `indexById` is
    // memoised and answers the same thing for the ties that are actually read.
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        rollSize.set(npc.factionId, (rollSize.get(npc.factionId) ?? 0) + 1);
    }
    for (const house of state.factions) {
        const payroll = (rollSize.get(house.id) ?? 0) * A_STIPEND_PER_MEMBER_PER_YEAR;
        // THE SAME READING THE HOUSE'S OWN MOTIVE TAKES, so a house that could
        // not pay and a disciple who was not paid are one fact rather than two.
        paidThisYear.set(house.id, howThePurseIsRunning(
            Number(house.resources.spirit_stones ?? 0), payroll) !== 'cannot_pay');
        teachesTo.set(house.id, houseTeachingCeiling(house.id));
    }

    // WHO DECIDED IT, IN ONE PASS, BEFORE ANYBODY MOVES. The group is people
    // who each decided, so everybody's own answer has to exist before it can be
    // asked who is walking the same way.
    const leaving: {
        at: number;
        npc: NpcRecord;
        why: readonly WhyTheyWentOut[];
        to: SomewhereWorthGoing;
    }[] = [];

    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc.status !== 'alive' || npc.factionId === null) continue;
        // THE SLOT BEFORE THE EXPENSIVE READS. Four in five people are not
        // being asked this year and everything below costs more than a hash.
        if (reviewSlot(npc.id, HOW_OFTEN_SOMEBODY_WEIGHS_IT) !== slot) continue;
        if (!isBelowTheLid(npc)) continue;
        // Never the player's row: which house they are in and whether they
        // walk out of it are theirs, and a pass that decided it would be the
        // engine taking the decision the whole of this file is about.
        if (!isTheWorldsToMove(npc)) continue;
        // AND NOT A BEAST. It holds no purse, is taught nothing, and the roll
        // it is on is an arrangement rather than a membership.
        if (theSpeciesItIs(npc) !== null) continue;
        // Somebody already out on the house's business is out on the house's
        // business. They decide when they are back.
        if (npc.activity && isAwayOnSomething(npc.activity.kind)) continue;
        const house = state.factions.find(f => f.id === npc.factionId);
        if (!house || house.dissolvedOnDay !== null) continue;
        // The head of a house is the house. Nobody walks out of their own hall.
        if (npc.factionRankIndex >= house.ranks.length - 1) continue;

        const standing = standingOfNpc(state, npc);
        const roads: SomewhereWorthGoing[] = [];
        for (const row of teaching) {
            const how = howSomebodyStandsToAGround(row.ground, standing);
            if (how.shortBy !== 'somewhere_else') continue;
            if (npc.cultivation.realmOrdinal < row.ground.fromOrdinal) continue;
            roads.push({
                locationId: row.place.id,
                name: row.place.name,
                why: `The ${row.ground.domain} road is taught by standing at `
                    + `${row.place.name}, and nothing nearer teaches it.`,
                survivalOrdinal: row.place.thresholds.survival
            });
        }

        const province = regionOf(state, npc.locationId);
        const ruins: SomewhereWorthGoing[] = (
            province === null ? [] : ruinsByProvince.get(province) ?? []
        // NOT FOR SOMETHING BENEATH THEM. Ground calibrated at or under where
        // they stand holds nothing past it, and nobody leaves a house for that.
        ).filter(place => place.thresholds.mastery > npc.cultivation.realmOrdinal)
        .map(place => ({
            locationId: place.id,
            name: place.name,
            why: `${place.name} is standing open a few days from here.`,
            survivalOrdinal: place.thresholds.survival
        }));

        const to = whereTheyWouldGo(roads, ruins);
        if (to === null) continue;

        let didNotComeBack = 0;
        for (const tie of npc.relationships) {
            const other = indexById(state.npcs, tie.targetId);
            const was = other < 0 ? null : state.npcs[other]!.status;
            if (was === 'physically_dead' || (other >= 0 && isLostTrackOf(state, state.npcs[other]!))) didNotComeBack++;
        }

        // Stamped by the promotion pass, which runs before this one each year,
        // and read against the life they have: `being-held-back-in-a-house.ts`.
        const lifespan = lifespanForOrdinal(npc.cultivation.realmOrdinal);
        const heldBack = howHardBeingHeldBackPresses(whereTheyAreHeldBack(npc), day, lifespan);
        const why = whyTheyWouldLeave({
            ordinal: npc.cultivation.realmOrdinal,
            houseTeachingCeiling: teachesTo.get(house.id) ?? null,
            theHousePaidThem: paidThisYear.get(house.id) ?? true,
            peopleTheyKnewWhoDidNotComeBack: didNotComeBack,
            factionRankIndex: npc.factionRankIndex,
            spiritStones: npc.spiritStones,
            aRoadAProvinceAway: roads.length > 0,
            beingHeldBack: heldBack
        });
        if (!whetherTheyGoThisYear(
            why, forStream(state.seed, 'walks-out', npc.id, year),
            howMuchTheirReasonsWeigh(why, heldBack),
            lifespan,
            // AND WHAT GOING WOULD COST THEM: their house's arts and the years
            // of taking up another road. `whatLeavingTheirHouseCosts`.
            whatLeavingTheirHouseCosts({
                npc, house, lifespanYears: lifespan, day,
                onTheRoll: id => {
                    const j = indexById(state.npcs, id);
                    return j >= 0 && state.npcs[j]!.status === 'alive' && state.npcs[j]!.factionId === house.id;
                }
            }))) continue;

        leaving.push({ at: i, npc, why, to });
    }
    if (leaving.length === 0) return 0;

    // AND WHO IS WALKING THE SAME WAY. Each of these decided on their own
    // account; what puts them on one road is that they already knew each other
    // and were already standing in the same place.
    const spoken = new Set<string>();
    let out = 0;
    for (const who of leaving) {
        if (spoken.has(who.npc.id)) continue;
        const withThem = whoWouldGoWithThem(leaving
            .filter(other => other.npc.id !== who.npc.id && !spoken.has(other.npc.id))
            .map(other => ({
                id: other.npc.id,
                goingTheSameWay: other.to.locationId === who.to.locationId,
                // Off the same roll counts as knowing each other: two people
                // walking out of one hall in one year have stood in the same
                // rooms whether or not the ledger wrote a row about it.
                knownToThem: other.npc.factionId === who.npc.factionId
                    || relationshipWith(who.npc, other.npc.id) !== null
                    || relationshipWith(other.npc, who.npc.id) !== null
            })));
        const onTheRoad = new Set(withThem.fellInOnTheRoad);
        const withIds = [...withThem.setOutTogether, ...withThem.fellInOnTheRoad];
        const party = [who, ...leaving.filter(o => withIds.includes(o.npc.id))];
        for (const member of party) spoken.add(member.npc.id);
        out += party.length;

        const partyIds = party.map(m => m.npc.id);
        const houseId = who.npc.factionId;
        const houseRow = houseId === null
            ? null : state.factions.find(f => f.id === houseId) ?? null;

        // AND WHAT THEIR GOING STIRS, as big as how high they stood. Read off
        // the rows as they were, before anybody is off the roll.
        // See `what-somebody-senior-leaving-stirs.ts`.
        let tiesCooled = 0;
        let loudest = 0;
        if (houseRow !== null) {
            const going = new Set(partyIds);
            for (const member of party) {
                tiesCooled += whatTheirLeavingStirs(state, member.npc, houseRow, day, going);
                loudest = Math.max(loudest, howLoudALeavingIs(member.npc.factionRankIndex, houseRow.ranks.length));
            }
        }

        for (const member of party) {
            // THE OATH AT THE DOOR, before the roll forgets them. A house asks
            // for silence about its arts on the way out and the answer is the
            // person's own: `the-word-an-npc-gave.ts` writes either the oath or
            // the grudge a refusal leaves, onto the world's own ledger.
            const houseAtTheDoor = member.npc.factionId === null
                ? null : state.factions.find(f => f.id === member.npc.factionId) ?? null;
            if (houseAtTheDoor !== null) {
                theOathOnTheWayOut(state, member.npc, houseAtTheDoor, day);
            }
            const gone: NpcRecord = {
                // The row as it now stands: what their going stirred wrote the other
                // end of a tie onto it, and the snapshot would put that back.
                ...setLocation(state.npcs[member.at]!, who.to.locationId, day),
                // Off the roll. Nobody released them; they are simply not there
                // any more, and `WHY_UNAFFILIATED` in `rogues.ts` has said since
                // it was written that this is how most of that population
                // arrives.
                factionId: null,
                factionRankIndex: -1,
                tags: [...member.npc.tags, `${WALKED_OUT}${member.why[0]}`,
                    `${CAME_OFF_A_ROLL_AT}${member.npc.cultivation.realmOrdinal}`],
                activity: {
                    // Chasing a thing they need, which is the kind's own words.
                    // NOT `out_with_a_party`: that has a term and a place to
                    // come back to, and Internal Affairs would call them overdue for
                    // a journey nobody sent them on.
                    kind: 'their_own_business',
                    note: `Left the compound. ${who.to.why}`,
                    withIds: partyIds.filter(id => id !== member.npc.id),
                    sinceDay: day,
                    untilDay: null,
                    returnTo: null
                }
            };
            state.npcs[member.at] = addGoal(gone, {
                kind: 'cultivation',
                text: who.to.why,
                priority: 0.7,
                obstacles: [...member.why]
            }, day);
        }

        // AND THE GROUND ASKS WHAT IT ASKS. Nobody underwrote this trip: a
        // party a house sends is pitched at what the house thinks it can
        // survive, and these people pitched themselves. `thresholds.survival`
        // is the world's own bar and is the only one applied.
        const lost: NpcRecord[] = [];
        for (const member of party) {
            if (member.npc.cultivation.realmOrdinal >= who.to.survivalOrdinal) continue;
            const gone = theWorldLoses(
                state.npcs[member.at], day,
                `Walked out of ${houseRow ? houseRow.name : 'a compound'} for `
                + `${who.to.name} and did not come out of it.`
            );
            // They walked out and they came out of it.
            if (!gone) continue;
            state.npcs[member.at] = gone;
            lost.push(member.npc);
        }

        // AND THE TIE A ROAD WRITES. Two people out of two different halls who
        // were going the same way and are now walking it together: the whole of
        // what falling in with somebody is, and it is an ordinary relationship
        // row rather than a second notion of company.
        for (const member of party) {
            if (!onTheRoad.has(member.npc.id)) continue;
            const a = state.npcs[who.at];
            const b = state.npcs[member.at];
            state.npcs[who.at] = upsertRelationship(a, {
                targetId: b.id, targetName: b.name, kind: 'ally', standing: 0.2,
                note: 'Fell in with them on the road.'
            }, day);
            state.npcs[member.at] = upsertRelationship(b, {
                targetId: a.id, targetName: a.name, kind: 'ally', standing: 0.2,
                note: 'Fell in with them on the road.'
            }, day);
        }

        appendWorldFact(state, makeFact({
            day,
            kind: 'migration',
            scale: 'local',
            summary:
                `${party.map(m => m.npc.name).join(', ')} left `
                + `${houseRow ? `the ${houseName(houseRow.name)}` : 'the roll'} `
                + `for ${who.to.name}. `
                + `${reasonSaidPlainly(who.why[0])}`
                + (lost.length > 0
                    ? ` ${lost.length} of them did not come out of it.` : ''),
            actors: party.map(m => ({ id: m.npc.id, name: m.npc.name, role: 'left' })),
            locationId: who.to.locationId,
            factionIds: houseId ? [houseId] : [],
            visibility: loudest > WORTH_REPEATING ? 'regional' : 'faction',
            magnitude: loudest,
            data: {
                walkedOut: true,
                tiesCooled,
                why: who.why.join('; '),
                party: party.length,
                fellInOnTheRoad: onTheRoad.size,
                lost: lost.length,
                unattributed:
                    'A compound is a name or two short this season and is not saying which, '
                    + 'and somebody on the road is wearing robes with the badge cut off.'
            }
        }));
    }
    return out;
}

/** A tag saying somebody left of their own accord, and what for. */
const WALKED_OUT = 'walked-out:';

/** The reason, as somebody in the world would say it. */
function reasonSaidPlainly(why: WhyTheyWentOut | undefined): string {
    switch (why) {
        case 'the house cannot teach them further':
            return 'There was nothing left in that hall to learn.';
        case 'a road a province away':
            return 'What they wanted is taught by standing somewhere, and not there.';
        case 'the house did not pay them':
            return 'The stipend did not come this year.';
        case 'somebody they knew did not come back':
            return 'Somebody they went in with is still out there.';
        case 'nothing in the hall is theirs':
            return 'They held no room and had nothing put by.';
        case 'the house has no room for them to rise':
            return 'They had outgrown their place in that hall, and it had nowhere higher to put them.';
        default:
            return '';
    }
}

/**
 * HOW LATE SOMEBODY HAS TO BE BEFORE THE HOUSE SAYS IT OUT LOUD.
 *
 * The design owner: *"the keeper knows x has been away for a month, their
 * mission should've only taken a week. That's their job - personnel. They're
 * the ones who tell other people something is wrong."*
 *
 * The office is INTERNAL AFFAIRS, which is what this world already calls the
 * people who handle a house's own - see
 * `a-communication-talisman-carries-word-home.ts`, where Internal Affairs cuts
 * the talismans and reads what comes back. "Keeper" was the word in the ruling
 * above and it is taken many times over: a bell keeper, a formation keeper, a
 * waystation keeper, a ledger keeper, a Namekeeper. One word, one meaning.
 *
 * A share of the term rather than a fixed span, because a week late off a
 * forty-day errand is a delay and a week late off a two-year war is nothing.
 */
const LATE_ENOUGH_TO_SAY_SO = 0.5;

/**
 * Internal Affairs notices, and it goes out the way everything goes out.
 *
 * NOT A NEW CHANNEL. It is a world fact with an `unattributed` line on it, so
 * it reaches a player who cannot name the missing person as "a compound has
 * been asking after somebody" and reaches one who can by name - which is the
 * hearsay layer doing exactly what it already does for every other event.
 *
 * DERIVED FROM THE TERM. Nothing marks anybody overdue: a party's activity
 * carries the day it is due back, so being late is arithmetic, and Internal Affairs
 * cannot forget to notice.
 *
 * Said ONCE. The activity is cleared when it is said, because the point is the
 * house raising the alarm rather than a compound announcing the same absence
 * every year for a century.
 *
 * WHO IT ACTUALLY SEES. `bringHomeWhoeverIsDue` runs a day earlier and closes
 * the errand of everybody at or past their due day - a superset of what this
 * looks at - so what is left is whoever that pass will not touch: the people
 * who are not `alive`. That is the right population and it was not chosen;
 * this reads the state deliberately now.
 *
 * Measured, 200 years, two seeds (`scripts/zz-internal-affairs.probe.ts`):
 * 365/169 notices about 21/15 people, beside 35/25 from the absence pass.
 * Counting it needs `data.lostTrackOf` to split the two, because both write
 * the same sentence, and `'overdue'` is a `PressureKind` rather than a
 * `HistoricalEventKind` - a filter on `f.kind` silently matches nothing.
 */
function whatInternalAffairsNotices(state: WorldState, day: number): PressureEvent[] {
    const out: PressureEvent[] = [];
    const houseOf = new Map(state.factions.map(f => [f.id, f]));

    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc === undefined || npc.status === 'physically_dead') continue;
        const doing = npc.activity;
        if (!doing || !isAwayOnSomething(doing.kind)) continue;
        if (doing.untilDay === null || doing.untilDay === undefined) continue;

        const term = Math.max(1, doing.untilDay - doing.sinceDay);
        if (day < doing.untilDay + term * LATE_ENOUGH_TO_SAY_SO) continue;

        const house = npc.factionId === null ? null : houseOf.get(npc.factionId) ?? null;
        const late = Math.max(0, Math.floor((day - doing.untilDay) / 30));

        // Said, and then not said again. Whatever happened to them is somebody
        // else's to find out.
        state.npcs[i] = { ...npc, activity: null };

        out.push(emit(state, 'overdue', day, {
            day,
            // Internal Affairs SAYS it. That is the act - a house learning one of
            // its own has not come back is a person telling everybody.
            kind: 'said_in_public',
            scale: 'local',
            summary:
                `${npc.name} was due back` + (house ? ` at the ${houseName(house.name)}` : '')
                + ` and is ${late === 0 ? 'overdue' : `${late} month${late === 1 ? '' : 's'} overdue`}. `
                + 'The hall has started asking.',
            actors: [{ id: npc.id, name: npc.name, role: 'missing' }],
            locationId: npc.locationId,
            factionIds: house ? [house.id] : [],
            visibility: 'faction',
            magnitude: 0.3 + Math.min(0.3, npc.cultivation.realmOrdinal * 0.01),
            unattributed:
                'Somebody at the compound has been asking after a name, in the tone of '
                + 'a person who has already asked everybody easier.',
            consequences: {
                immediate: 'The house knows one of its own has not come back.',
                tenYearsLater:
                    'Either they came back with an account of it, or the name is one the '
                    + 'hall says on a particular day of the year.'
            }
        }, {
            factions: house ? [house.id] : [],
            locations: npc.locationId ? [npc.locationId] : [],
            npcs: [npc.id, ...doing.withIds]
        }));
    }
    return out;
}

/**
 * HOW LONG A POSTING RUNS.
 *
 * Years, and that is the whole difference from an errand. A sending is measured
 * in weeks and comes back with an account of itself; a station is somebody the
 * house has put in a town and largely stopped thinking about.
 */
const A_POSTING_RUNS_FOR_YEARS = 12;

/**
 * HOW MANY PLACES A HOUSE KEEPS SOMEBODY AT.
 *
 * Off its own weight, because that is what reach IS: a hill sect holds the one
 * town under it and a court has somebody in every market worth the name. Never
 * a share of its people - the first cut of this took a fifth of whoever was
 * idle every year and the idle never recovered, so 175 people ended up posted
 * out of a world of 525 and the sendings pass, which draws on the same hands,
 * starved.
 *
 * A house tops up to the PLACES it holds, and it obviously does not hold every
 * city.
 */
export function howManyPostsAHouseKeeps(powerOrdinal: number): number {
    return Math.max(1, Math.min(6, Math.floor(powerOrdinal / 8)));
}

/**
 * PEOPLE A HOUSE HAS PUT SOMEWHERE.
 *
 * The design owner: *"a sect stations their people outside the sect too"*, and
 * on who: *"maybe no office elders go outside"*. An elder holding a room stays
 * and approves things; an elder holding none is exactly who a house can spare -
 * and there are deliberately fewer rooms than elders, so being spare is the
 * ordinary condition rather than a failure.
 *
 * Measured before this pass: 57 of 68 living elders had no activity at all, and
 * 516 of 541 living people had none. The world's top half was standing still.
 *
 * NOT A SENDING. A sending is an errand with a party and a term in weeks. This
 * is one person, one place, and years, and it is why a house has somebody in a
 * town it does not own.
 */
function applyPostings(state: WorldState, year: number, day: number): number {
    const rng = forStream(state.seed, 'postings', year);
    // NOT ANYBODY'S SEAT, by id and not by kind. A house's `seatLocationId` is
    // not always a location of kind `sect_seat` - some houses are seated in a
    // town - so filtering on the kind alone posted people into halls that
    // somebody lives in, which is not a posting, it is a visit.
    const seats = new Set(state.factions
        .map(f => f.seatLocationId)
        .filter((id): id is string => id !== null));
    // AND A POST IS KEPT WHERE PEOPLE ARE. `populationWeightOf` defaults to 1
    // for any row that does not carry the key, so it says "somebody lives here"
    // about every place that is not a container - which was harmless only while
    // the unpopulated kinds were in no province and this pass filters by parent.
    // `settleTheSeededPastIntoProvinces` gave the prior ages provinces and the
    // pass immediately began posting people into sealed ruins and onto
    // tribulation scars: measured over the `demography` seed at eighty years,
    // 59 of 575 living people were stationed in a ruin, 16 more were standing on
    // dead ground, settlements fell from 466 to 366, and a village emptied.
    // A house keeps somebody in a TOWN, which is what the name here has always
    // said. Where a party GOES is a different question and `whereASendingGoes`
    // answers it - a ruin is a fine place to send an expedition and no place to
    // keep a resident.
    const towns = state.locations.filter(l =>
        !seats.has(l.id)
        && l.kind === 'settlement'
        && isBelowTheLid(l)
        && populationWeightOf(l) > 0);
    if (towns.length === 0) return 0;

    // THE ROLLS, GATHERED ONCE. This was two `state.npcs.filter` sweeps per
    // house, so a world with seventy houses and seven thousand people walked
    // the population a hundred and forty times a year. Grouping first is the
    // same answer: a person belongs to one house, so nothing this pass does to
    // one house's roll can change another's, and within a house both readings
    // are taken before anybody is moved. Measured with `--cpu-prof` on one
    // seed at 1,200 years, the two sweeps were 3.9ms per simulated year, the
    // largest remaining term in the advance.
    const at = new Map<string, number>();
    const rolls = new Map<string, NpcRecord[]>();
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        if (!at.has(npc.id)) at.set(npc.id, i);
        if (npc.status !== 'alive' || npc.factionId === null) continue;
        const roll = rolls.get(npc.factionId);
        if (roll) roll.push(npc); else rolls.set(npc.factionId, [npc]);
    }

    let posted = 0;
    for (const faction of liveFactions(state)) {
        const ranks = faction.ranks.length;
        if (ranks === 0) continue;

        const roll = rolls.get(faction.id) ?? [];
        // WHO THE HOUSE CAN SPARE. Anybody already away is already spared, and
        // an elder holding a room is not - `whoIsInChargeOfWhat` deals the
        // rooms out and the people it did not reach are the ones with nothing
        // keeping them at the seat.
        const members = roll.filter(n => n.activity === null && isTheWorldsToMove(n));
        if (members.length === 0) continue;

        const rooms = whoIsInChargeOfWhat({
            rooms: theRoomsThisHouseHas(state.locations, faction.id),
            // A ROOM TAKEN OFF SOMEBODY IS A WEIGHT AGAINST THEM, NOT A DOOR
            // BRICKED UP. The owner, asked whether a removal is permanent:
            // *"depends on your influence so not permanent"*. This filtered
            // them out for ever; now it asks every year whether what they are
            // worth to the house today outweighs what the disgrace still does.
            roll: members.filter(n => theRoomWouldDealToThemAgain(state, n, faction, day))
                .map(n => ({ id: n.id, rankIndex: n.factionRankIndex })),
            rankCount: ranks
        });
        const holdingARoom = new Set(
            rooms.map((r: APortfolio) => r.holderId)
                .filter((id): id is string => id !== null));

        // THE PLACES THIS HOUSE KEEPS SOMEBODY AT, and the ones that are empty.
        //
        // Its own region first, because reach starts at home, and only as many
        // as its weight carries. A post nobody is at is a post to fill; a post
        // somebody is already at is not.
        // The province the house is seated in, read off its seat's parent -
        // there is no region field on a house and inventing one would be a
        // second answer to a question the map already holds.
        const seatRegion = faction.seatLocationId === null
            ? null
            : getLocation(state, faction.seatLocationId)?.parentId ?? null;
        const near = seatRegion === null
            ? []
            : towns.filter(t => t.parentId === seatRegion);
        const posts = (near.length > 0 ? near : towns)
            .slice(0, howManyPostsAHouseKeeps(Number(faction.resources.power_ordinal ?? 0)));
        const held = new Set(roll
            .filter(n => n.activity?.kind === 'stationed')
            .map(n => n.locationId));
        const empty = posts.filter(t => !held.has(t.id));
        if (empty.length === 0) continue;

        const spare = members.filter(n => !holdingARoom.has(n.id));
        if (spare.length === 0) continue;
        const wanted = Math.min(empty.length, spare.length);

        for (let i = 0; i < wanted; i++) {
            const who = spare[i];
            const town = empty[i];
            if (who === undefined || town === undefined) continue;
            const index = at.get(who.id);
            if (index === undefined || state.npcs[index]?.id !== who.id) continue;

            const years = rng.int(Math.ceil(A_POSTING_RUNS_FOR_YEARS / 2), A_POSTING_RUNS_FOR_YEARS * 2);
            state.npcs[index] = {
                ...setLocation(state.npcs[index]!, town.id, day),
                activity: {
                    kind: 'stationed',
                    note: `Holding the ${houseName(faction.name)}'s interest at ${town.name}.`,
                    withIds: [],
                    sinceDay: day,
                    untilDay: day + years * DAYS_PER_YEAR,
                    // THE HOUSE, NOT WHEREVER THEY WERE. A posting is the
                    // house putting somebody in a town, so it ends at the
                    // house. Measured before: members standing at their own
                    // seat fell from four in five at world open to one in ten
                    // at a century, and they were not dead, they were in towns.
                    returnTo: faction.seatLocationId ?? whereTheyGoBackTo(who)
                }
            };
            posted++;
        }
    }
    return posted;
}

/**
 * Everybody whose errand is over, standing where they started.
 *
 * Reads the term off the activity rather than off a list of who is out, so a
 * world loaded from disk mid-sending brings the right people home without
 * anything having had to persist a roster of parties.
 *
 * Home is whatever the activity was written with, and the writer decides it: an
 * errand brings somebody back to where they set out from, and a posting brings
 * them back to the house (`applyPostings`). A place that has since ceased to
 * exist leaves them where they are.
 */
function bringHomeWhoeverIsDue(state: WorldState, day: number): number {
    const standing = new Set(state.locations.map(l => l.id));
    let home = 0;
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc === undefined || npc.status !== 'alive') continue;
        const doing = npc.activity;
        // Board work done at the house closes here too, and goes nowhere.
        if (!doing || (!isAwayOnSomething(doing.kind) && theBoardWorkTheyAreOn(npc, doing.untilDay) === null)) continue;
        if (doing.untilDay === null || doing.untilDay === undefined) continue;
        if (day < doing.untilDay) continue;
        // A PERSON NOBODY CAN FIND DOES NOT COME HOME, and this is the line
        // that made Internal Affairs dead for the life of the repo.
        //
        // `markMissing` leaves the activity standing on purpose - see
        // `theWorldLoses`: *"they are marked missing a few lines below and
        // markMissing leaves the activity standing, so what is on their record
        // is the errand that took them. That is also the only thing Internal Affairs
        // has to notice."* It did not touch `status` either, so somebody the
        // world had lost was still `alive` and still due back, and this pass
        // walked them home and cleared the very field the next pass reads -
        // one day before it reads it.
        //
        // HOW OFTEN IT ACTUALLY REFUSES IS NOT MEASURED, and it is probably
        // rarely: `whatHousesLearnOfTheirOwn` resolves a lost person in the
        // same slice it marks them, either sending them walking home on a
        // fresh term or cutting them loose with no activity at all, so by the
        // time this pass sees them there is usually nothing left to refuse.
        // The guard is kept because it is true, not because it is load-bearing.
        if (isLostTrackOf(state, npc)) continue;

        // A place that has since ceased to exist leaves them standing where
        // the errand took them, which is truer than teleporting them into a
        // location the world no longer holds.
        const back = doing.returnTo ?? null;
        // A TERM SERVED IS SERVICE. A sending or a posting that ran its term
        // and came home is counted by the house it was for; a journey to a
        // house that took them is not service yet.
        const served = doing.kind === 'travelling' ? npc
            : whatFinishingBoardWorkPays(npc, doing)
                ?? creditMerit(npc, whatServiceIsWorth(npc.cultivation.realmOrdinal, doing.untilDay - doing.sinceDay));
        // And what the work made, where it made something, paid for what landed.
        const landed = whatCuttingForTheHouseLands(state, theMakerThisIs(npc), doing);
        const paid = whatCuttingPays(landed, npc.cultivation.realmOrdinal);
        const paidFor = paid > 0 ? { ...served, spiritStones: (served.spiritStones ?? 0) + paid } : served;
        // AND A SEARCH PARTY COMES HOME WITH SOMETHING OR WITH NOTHING.
        //
        // The same shape as any other party a house sends out: the term runs,
        // the term closes here, and what it was FOR is read off the tag it was
        // sent with. `whatASearchBroughtBack` decides what it was worth - face
        // across the house for a death nobody caused, an account against a name
        // for one somebody did.
        const sought = whoTheyWereSentAfter(npc);
        const settled = sought === null || npc.factionId === null
            ? paidFor
            : { ...paidFor, tags: paidFor.tags.filter(t => !t.startsWith(OUT_LOOKING_FOR)) };
        state.npcs[i] = {
            ...(back !== null && standing.has(back) ? setLocation(settled, back, day) : settled),
            activity: null
        };
        if (sought !== null && npc.factionId !== null) {
            // WHO HOLDS IT FOR THE HOUSE. An obligation needs somebody to
            // hold it, and a house's own is whoever answers for it: the
            // highest rung still standing, which is the head where there is
            // one and the senior elder where there is not.
            let head: string | null = null;
            let highest = -1;
            for (const one of state.npcs) {
                if (one.factionId !== npc.factionId || one.status !== 'alive') continue;
                if (one.factionRankIndex > highest) {
                    highest = one.factionRankIndex;
                    head = one.id;
                }
            }
            const dead = state.npcs.find(n => n.id === sought) ?? null;
            if (head !== null && dead !== null) {
                whatASearchBroughtBack(state, {
                    deadId: sought,
                    houseId: npc.factionId,
                    holderId: head,
                    day,
                    deadName: dead.name
                });
            }
        }
        home++;
    }
    return home;
}

// THE YARD

/**
 * How many of one kind a house keeps before it starts building the next one up.
 */
const ENOUGH_IN_THE_YARD = 2;

/** What the yard holds, at a grade. Plain material, and cores separately. */
function yardKey(grade: TechniqueGrade, core: boolean): string {
    return `yard.${core ? 'core' : 'material'}.${grade}`;
}

/** How far the slip has got. One cell per line of the bill, plus the work. */
function berthKey(recipeId: string, what: string): string {
    return `berth.${recipeId}.${what}`;
}

/**
 * What a finished sending after materials brought home.
 */
const WHAT_A_PARTY_BRINGS_BACK = 6;

function creditWhatCameBack(faction: FactionRecord, partyOrdinal: number, hands: number): void {
    const grade = gradeForOrdinal(partyOrdinal);
    const bulk = Math.max(1, Math.round(WHAT_A_PARTY_BRINGS_BACK * Math.max(1, hands) / 5));
    const key = yardKey(grade, false);
    faction.resources[key] = (faction.resources[key] ?? 0) + bulk;
    if (partyOrdinal >= BEAST_CORE_ORDINAL) {
        const cores = yardKey(gradeForOrdinal(partyOrdinal), true);
        faction.resources[cores] = (faction.resources[cores] ?? 0) + 1;
    }
}

/** The yard, in the three fields a bill reads. Nothing else is looked at. */
function lotsInTheYard(faction: FactionRecord): MaterialLot[] {
    const lots: MaterialLot[] = [];
    for (const grade of STOCK_GRADES) {
        for (const core of [false, true]) {
            const count = faction.resources[yardKey(grade, core)] ?? 0;
            if (count > 0) lots.push({ id: yardKey(grade, core), grade, core, count });
        }
    }
    return lots;
}

/**
 * Houses build, and now and again one of them launches.
 */
function applyConveyanceBuilding(state: WorldState, year: number, day: number): number {
    let launched = 0;
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;

        const hands: number[] = [];
        for (const npc of state.npcs) {
            if (npc.status === 'alive' && npc.factionId === faction.id) {
                hands.push(npc.cultivation.realmOrdinal);
            }
        }
        if (hands.length === 0) continue;
        const best = hands.reduce((n, o) => Math.max(n, o), 0);

        // The deepest bill this house could work at all. `canRefineGrade` is the
        // gate and it is the same one that decides who refines a grade of medicine
        // - a hull is made of the same four grades a pill is, and a second table
        // here would be a second opinion about the ladder.
        const recipe = [...CONVEYANCE_RECIPES]
            .filter(r => canRefineGrade(r.grade, best))
            .filter(r => conveyanceKeptAs(r.grade) === 'tracked'
                ? !state.objects.some(o =>
                    o.ownerId === faction.id
                    && o.data.conveyanceId === r.producesConveyanceId)
                : countedHolding(faction.resources, r.producesConveyanceId) < ENOUGH_IN_THE_YARD)
            // CHEAPEST FIRST, which is the progression the craft module describes
            // rather than an ordering chosen here: a house that gets one craft gets
            // its next one faster, because the craft carries the party that takes
            // the next core. Deepest-first had every qualified house laying a keel
            // for a spirit boat on day one and still short of the bill five
            // centuries later, so no tracked craft was ever built by anybody.
            .sort((a, b) => a.workDays - b.workDays)[0];
        if (!recipe) continue;

        // The slip, off the cells that hold it. `spent` is not carried across
        // years: what it is for is the argument about a build that failed, and
        // the argument the world can have is the fact this writes.
        let berth: Berth = {
            ...layDownKeel(recipe),
            delivered: recipe.components.map(
                (_, i) => faction.resources[berthKey(recipe.id, `line${i}`)] ?? 0
            ),
            workDaysDone: faction.resources[berthKey(recipe.id, 'work')] ?? 0
        };

        berth = deliver(berth, recipe, lotsInTheYard(faction));
        // What went onto the slip came out of the yard. `deliver` reports it by
        // lot id and the lot ids ARE the ledger keys, which is why they are
        // built from `yardKey` rather than named.
        for (const [key, taken] of Object.entries(berth.spent)) {
            faction.resources[key] = Math.max(0, (faction.resources[key] ?? 0) - taken);
        }
        const worked = workOn(berth, recipe, { days: DAYS_PER_YEAR, hands });
        berth = worked.berth;

        for (let i = 0; i < recipe.components.length; i++) {
            faction.resources[berthKey(recipe.id, `line${i}`)] = berth.delivered[i] ?? 0;
        }
        faction.resources[berthKey(recipe.id, 'work')] = berth.workDaysDone;

        if (!readyToLaunch(berth, recipe)) continue;

        // Seeded per house per year, so two houses working the same bill with
        // the same best hand do not get the same answer - which they would off
        // the recipe and the ordinal alone.
        const outcome = launch(`${state.seed}:${faction.id}:${year}`, berth, recipe, best);
        for (let i = 0; i < recipe.components.length; i++) {
            faction.resources[berthKey(recipe.id, `line${i}`)] = 0;
        }
        faction.resources[berthKey(recipe.id, 'work')] = 0;
        if (!outcome.launched) {
            // A failure consumes the materials and leaves the yard with
            // nothing. That is the honest price and it is why a heaven-grade
            // launch is an event a house remembers.
            appendWorldFact(state, makeFact({
                day,
                kind: 'catastrophe',
                scale: 'local',
                summary:
                    `${faction.name} lost ${recipe.name.toLowerCase()} on the slip. `
                    + outcome.narrationHint,
                locationId: faction.seatLocationId,
                factionIds: [faction.id],
                actors: [],
                visibility: 'regional',
                magnitude: 0.3,
                data: { conveyanceRecipe: recipe.id, launched: 0 }
            }));
            continue;
        }
        launched++;

        // WHICH SIDE OF THE LINE IT LANDS ON IS THE GRADE'S AND NOTHING MOVES
        // IT. `conveyanceKeptAs` is the single authority and every caller asks
        // it rather than deciding separately - a counted craft increments a
        // line, and only a tracked one becomes a row with a past.
        const trackedNow = conveyanceKeptAs(recipe.grade) === 'tracked';
        if (trackedNow) {
            const record = mintCraft(recipe, {
                id: `obj-craft-${faction.id}-${year}`,
                name: recipe.name,
                ownerId: faction.id,
                ownerName: faction.name,
                wrightId: faction.id,
                wrightName: faction.name,
                bestHandOrdinal: best,
                onDay: day,
                mooredAt: faction.seatLocationId ?? '',
                description: `Built at ${faction.name}'s own yard.`
            });
            if (record) state.objects.push(record);
        } else {
            faction.resources = adjustCountedHolding(
                faction.resources, recipe.producesConveyanceId, 1
            );
        }

        appendWorldFact(state, makeFact({
            day,
            kind: 'treasure_found',
            scale: trackedNow ? 'regional' : 'local',
            summary:
                `${faction.name} launched ${recipe.name.toLowerCase()} out of its own yard, at `
                + `${recipe.grade} grade, over ${recipe.workDays} days of work.`,
            locationId: faction.seatLocationId,
            factionIds: [faction.id],
            actors: [],
            visibility: trackedNow ? 'public' : 'regional',
            magnitude: trackedNow ? 0.6 : 0.25,
            data: {
                conveyanceRecipe: recipe.id,
                launched: 1,
                keptAs: conveyanceKeptAs(recipe.grade),
                ratedAt: outcome.ratedAt ?? 0
            }
        }));
    }
    return launched;
}

/** A weighted draw over a small list. Seeded, so a world replays identically. */
function weighted<T>(rng: CultivationRNG, rows: readonly T[], weightOf: (row: T) => number): T | null {
    if (rows.length === 0) return null;
    const total = rows.reduce((sum, row) => sum + Math.max(0, weightOf(row)), 0);
    if (total <= 0) return rows[rng.int(0, rows.length - 1)];
    let cursor = rng.next() * total;
    for (const row of rows) {
        cursor -= Math.max(0, weightOf(row));
        if (cursor < 0) return row;
    }
    return rows[rows.length - 1];
}

/**
 * What a house pays each member on its roll, per year.
 *
 * Not a new number: it is the `members * 45` this function has always charged
 * itself. It is named now because it is paid to somebody.
 */
export const A_STIPEND_PER_MEMBER_PER_YEAR = 45;

/**
 * How much of it goes straight back out again.
 *
 * A STIPEND IS SPENT. Crediting the whole of it would be as wrong as crediting
 * none of it, in the other direction: two hundred years of untouched wages
 * would make every long-lived disciple in the world enormously rich for having
 * done nothing, and `spiritStones` is read as a live gate on what somebody can
 * be leaned on with. What accumulates is the SURPLUS - what somebody did not
 * need this year - which is small, and is why a purse is worth something.
 */
export const WHAT_A_MEMBER_LIVES_ON = 0.8;

/**
 * What one vein pays the house standing on it, in stones a year.
 *
 * Named rather than inlined because a house reaching for ground has to be able
 * to ask what that ground is worth, and a second spelling of this product is a
 * second opinion about what a rock is. The figure itself is unchanged: it is
 * the `veins * 5_000 * (0.5 + share)` term this pass has always charged.
 *
 * `share` is `whatItCanPutOnTheGround` of the holder's reliable rung - so the
 * same vein is worth more to a house that can work it, which is the ordering
 * the rest of the economy is built on.
 */
export function whatAVeinPaysItsHolder(share: number): number {
    return 5_000 * (0.5 + share);
}

function applyFactionEconomy(state: WorldState): void {
    // One pass over the locations for the whole world rather than one per
    // house: this runs every simulated year, and a filter per faction is
    // thirty-eight walks of a thousand rows a year.
    const townIncome = new Map<string, number>();
    for (const location of state.locations) {
        const holder = location.controllingFactionId;
        if (!holder) continue;
        const paid = whatATownPaysItsHolder(location);
        if (paid <= 0) continue;
        townIncome.set(holder, (townIncome.get(holder) ?? 0) + paid);
    }

    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null || !isBelowTheLid(faction)) continue;
        const roll: number[] = [];
        for (let i = 0; i < state.npcs.length; i++) {
            const npc = state.npcs[i];
            if (npc.status === 'alive' && npc.factionId === faction.id) roll.push(i);
        }
        const members = roll.length;
        const veins = faction.resources.veins ?? 0;
        // ── WHAT A HOUSE WITH NO VEIN LIVES ON ──────────────────────────
        //
        // The vein term was the only one that varied, and it did not: every
        // faction was seeded with one vein and a `production` of 0.5, so the
        // whole of this line was `5_000 + members * 30` for every house in the
        // world every year. With the catalog's own answer in, 26 of 38 houses
        // hold no vein at all - they hold an auction charter, an assay
        // monopoly, rented cutting houses, nine gate stations - and a flat 30
        // a head does not cover a 45 a head payroll, so a world of traders
        // would have quietly gone bankrupt.
        //
        // So the per-member term is what the members are worth, which is the
        // same rung the ground term scales by. Nothing states what a house
        // sells; what it can put in front of somebody is stated.
        const share = whatItCanPutOnTheGround(Number(faction.resources.reliable_ordinal ?? 0));
        // ── AND WHAT IT TAKES AT A GATE ─────────────────────────────────
        //
        // The third term, and for most of this catalog it is the only one that
        // is not zero. A fee at a gate, a toll at a ford, a cut of what crosses
        // a weigh rail, a published assay everybody has to buy: ordinary
        // furniture of the genre, and this function collected not one stone
        // from any of it, so a house holding nine city gates was modelled as
        // destitute. Priced once at seeding by `whatALevyBringsIn`.
        //
        // Deliberately NOT scaled by `share`, unlike the two terms beside it.
        // What passes a gate is what passes a gate.
        const levy = Number(faction.resources.levy_per_year ?? 0);
        // ── AND WHAT IT TAKES OFF THE TOWNS IT GOVERNS ──────────────────
        //
        // The fourth term, and the one the levy work left behind: a house that
        // administers a city took from it exactly what a house that
        // administers nothing takes. `controllingFactionId` was null on all
        // twenty-three settlements and no house listed one among what it
        // controlled, so there was nobody to collect.
        //
        // Recomputed here rather than read off `resources`, unlike the levy
        // beside it, because ground changes hands inside a century - twice in
        // this file - and a figure written at seeding would go on stating what
        // the house held then.
        const towns = townIncome.get(faction.id) ?? 0;
        const income = veins * whatAVeinPaysItsHolder(share)
            + levy + towns + members * 30 * (1 + share);
        const payroll = members * A_STIPEND_PER_MEMBER_PER_YEAR;
        const upkeep = payroll + (faction.resources.tribute_owed_per_year ?? 0) * 0.1;
        const before = faction.resources.spirit_stones ?? 0;
        faction.resources.spirit_stones = Math.max(0, Math.round(before + income - upkeep));
        faction.resources.members = members;

        // ═══════════════════════════════════════════════════════════════════
        // AND SOMEBODY RECEIVES THE PAYROLL
        // ═══════════════════════════════════════════════════════════════════
        //
        // This charged `members * 45` a year and credited NOBODY, so the wages
        // of every house in the world left it. `NpcRecord.spiritStones` was
        // written once at seeding and never again - and read as a live gate on
        // whether somebody can be leaned on with money, a few thousand lines
        // down. So the gate was asking about a number that had not moved in two
        // hundred years.
        //
        // ONLY WHAT THE HOUSE COULD ACTUALLY PAY. A house whose purse is empty
        // does not pay its disciples, and that has always been silently true
        // here - the `Math.max(0, ...)` above absorbed the shortfall and said
        // nothing. Now it is the members who go without, which is who actually
        // goes without.
        //
        // The tribute half is NOT paid to anybody: it goes to whoever the
        // tribute is owed to, and that is a different house's business.
        const affordable = Math.max(0, Math.min(payroll, before + income));
        const each = members > 0 ? (affordable / members) * (1 - WHAT_A_MEMBER_LIVES_ON) : 0;
        if (each >= 1) {
            const kept = Math.round(each);
            for (const at of roll) {
                // AND NOT INTO THE PLAYER'S PURSE, which is the sheet's and not
                // this row's. The row is a projection refreshed off the sheet
                // every turn (`the-player-as-a-row-the-world-can-invite.ts`), so
                // stones paid here are wiped before anybody could spend them -
                // measured at 1,080 stones written and thrown away over 120
                // years. What the player is owed they draw, through
                // `sect_manage.stipend`, which pays the sheet.
                if (!isTheWorldsToMove(state.npcs[at]!)) continue;
                state.npcs[at] = {
                    ...state.npcs[at],
                    spiritStones: state.npcs[at].spiritStones + kept
                };
            }
        }
    }
}

/**
 * Draw a template, bind it, apply it.
 */
function fireOne(state: WorldState, day: number, rng: CultivationRNG): PressureEvent | null {
    const table = TEMPLATES;
    const total = table.reduce((sum, t) => sum + t.weight, 0);

    for (let attempt = 0; attempt < 6; attempt++) {
        let cursor = rng.next() * total;
        let chosen = table[table.length - 1];
        for (const t of table) {
            cursor -= t.weight;
            if (cursor < 0) {
                chosen = t;
                break;
            }
        }
        const event = chosen.apply(state, day, rng);
        if (event) return event;
    }
    return null;
}

interface Template {
    kind: PressureKind;
    weight: number;
    /** Returns null when the world offers nothing for this template to act on. */
    apply(state: WorldState, day: number, rng: CultivationRNG): PressureEvent | null;
}

/** One event template by kind, for a test that has to fire it on a world it arranged. */
export function aPressureTemplate(kind: PressureKind): Pick<Template, 'apply'> | undefined {
    return TEMPLATES.find(t => t.kind === kind);
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function liveFactions(state: WorldState): FactionRecord[] {
    return state.factions.filter(f => f.dissolvedOnDay === null && isBelowTheLid(f));
}

// WHO IS OLD ENOUGH TO DIE OF BEING OLD

/**
 * The most rungs a killer can give away and still manage it.
 */
const CASUAL_KILL_MAX_GAP = 3;

/**
 * The advantage at which one house can simply end another.
 */
const DECISIVE_MARGIN = CASUAL_KILL_MAX_GAP + 1;

// THE LONGEST PROJECT IN THE WORLD

/** The realm at which somebody stops being ordinary institutional life. */
const LAST_PROJECT_REALM = 'tribulation_transcendence';

/** Whether this person is in the middle of the longest project in the world. */
function isOnTheLastProject(npc: NpcRecord): boolean {
    return realmForOrdinal(npc.cultivation.realmOrdinal).key === LAST_PROJECT_REALM;
}

/**
 * Years one attempt at the last crossing consumes.
 */
const LAST_CROSSING_YEARS = 35_000;

/**
 * The attempt, and its three endings.
 */
function applyLastCrossing(
    state: WorldState,
    year: number,
    day: number
): NpcRecord[] {
    const out: NpcRecord[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        if (npc.status !== 'alive' || !isBelowTheLid(npc)) continue;
        if (npc.cultivation.realmOrdinal !== LAST_CROSSING_ORDINAL) continue;

        const rng = forStream(state.seed, 'last-crossing', year, npc.id);
        if (!rng.chance(1 / LAST_CROSSING_YEARS)) continue;

        // The engine's own figure for what the crossing is worth, rather than
        // one invented here. Everything it does not take is split between the
        // half-failure and the tribulation, weighted toward the tribulation,
        // because seven of the eight False Immortals anybody can name are
        // historical and the graveyard is not enumerable at all.
        const roll = rng.next();
        const crossed = baseBreakthroughChance(LAST_CROSSING_ORDINAL);
        const halfFailed = crossed + (1 - crossed) * 0.35;

        if (roll < crossed) {
            state.npcs[i] = {
                ...npc,
                cultivation: { ...npc.cultivation, realmOrdinal: TRUE_IMMORTAL_ORDINAL },
                layer: IMMORTAL_LAYER,
                updatedOnDay: day
            };
        } else if (roll < halfFailed) {
            state.npcs[i] = {
                ...npc,
                cultivation: { ...npc.cultivation, realmOrdinal: FALSE_IMMORTAL_ORDINAL },
                updatedOnDay: day
            };
        } else {
            const dead = theWorldEnds(
                npc,
                day,
                'Did not survive the last crossing.'
            );
            // Refused, and the row is left exactly as it stood: they did not
            // cross and they did not die of it. The two branches above are the
            // only ways this pass moves anybody.
            if (dead) {
                state.npcs[i] = dead;
                // See the wall, above: a death that settles nothing passes
                // nothing on, and this is the other end of the ladder doing it.
                settleNpcDeath(state, state.npcs[i], day);
            }
        }
        out.push(state.npcs[i]);
    }
    return out;
}

// THE WORLD OPENS SOMETHING, AND NOBODY DID IT
//
// The schedule decides and this pass announces. Both ends of a window are
// arithmetic on the cycle, so no flag and no tag is consulted to find them, and
// nothing has to go and re-shut a door by hand: a door on a season shuts itself
// when the season turns.
//
// It used to read `nextOpeningDay`, which answered null for anything sealed -
// and every seeded cycled ruin is sealed - so across twelve pinned worlds run
// two hundred years each the world opened or shut ZERO doors. The `open_now`
// tag the opening added was also the gate on the half that shut them, so both
// halves were unreachable together and each was the other's excuse.
//
// AND A WINDOW IS SHORTER THAN THE PASS THAT RUNS IT. Windows run days against
// a yearly pass, so a door can open and shut inside one call and a window can
// straddle a year end. `windowStartOn` tells an opening from a door that was
// already standing open when the year turned, and the closing half only shuts a
// window this pass was present for the opening of - otherwise a run that begins
// mid-window announces a closing nobody was told about.

/**
 * The people a conclave chose walk through the door it chose them for.
 *
 * ── WHAT WAS DECIDED AND THEN DROPPED ────────────────────────────────────
 *
 * `applyDoorsAndTheirPlaces` runs the whole allocation: the holder deals the
 * places it has, each house that got any ranks its own people for them,
 * `creditWhatTheyLearned` pays out the training, and `whatBeingPassedOverDoes`
 * opens the grudge and writes the goal against whoever took the last place. It
 * returns `deal`, `conclaves` and `andTheyDid`, and the yearly pass read
 * `shut` and `storedFact` and nothing else.
 *
 * So a house ranked its people for a door, four of them were passed over and
 * resented it, three were told they were going - and nobody went. Nobody moved,
 * nobody was at risk, nothing came out, and the place at the door that the
 * grudge is ABOUT was worth nothing to the person who won it.
 *
 * ── AND THE PARTY IS THE CONCLAVE'S, NOT THE ROSTER'S ────────────────────
 *
 * `whoTheHouseCanSend` is not asked here and that is the whole point. It takes
 * the strongest names off the roll, which is the right answer for an errand the
 * house invents and the wrong one for a door: the conclave already decided,
 * over a ranked field, and it is the decision the grudges are written against.
 * Sending anybody else would make those grudges false.
 *
 * Everything after that is the ordinary errand road - the term, the term
 * running past the end of the span, the move, the loss, the news - because a
 * place at a door is an errand a house was given rather than one it opened.
 */
function thePeopleAConclaveChoseWalkThrough(
    state: WorldState,
    doors: readonly ADoorsYear[],
    day: number,
    /** The last day of the year being reported on. */
    spanEndsOn: number
): number {
    const at = new Map<string, number>();
    for (let i = 0; i < state.npcs.length; i++) at.set(state.npcs[i]!.id, i);
    const errand = theErrandADoorIs();
    let walked = 0;

    for (const row of doors) {
        if (row.conclaves.length === 0) continue;
        const door = getLocation(state, row.doorId);
        if (!door) continue;

        for (const decided of row.conclaves) {
            const faction = state.factions.find(f => f.id === decided.factionId);
            if (!faction || faction.dissolvedOnDay !== null) continue;
            // The world's to move, and alive. A conclave ranks whoever was on
            // the roll when it sat; the player's mirror row is never spent by
            // the world, and neither is somebody the year has since killed.
            const party: Candidate[] = [];
            for (const going of decided.going) {
                const index = at.get(going.npcId);
                const npc = index === undefined ? undefined : state.npcs[index];
                if (!npc || npc.status !== 'alive' || !isTheWorldsToMove(npc)) continue;
                party.push({ id: npc.id, name: npc.name, ordinal: npc.cultivation.realmOrdinal });
            }
            if (party.length === 0) continue;

            // THE TERM IS THE WINDOW, the same reading `whoSendsWhenADoorOpens`
            // takes off the same schedule, because it is the same door shutting.
            const window = convergenceOf(door, day);
            const term = {
                ...errand,
                days: Math.max(1, Math.min(errand.days, window.windowDays || errand.days))
            };
            const purse = Number(faction.resources.spirit_stones ?? 0);
            const taking = bestForThisRoad(
                whatThisHouseCouldTakeOut(state, faction), term.days, party.length, false, purse);
            const posting = postingFor({
                reason: term,
                house: { id: faction.id, name: faction.name },
                pitchOrdinal: door.thresholds.survival,
                locationId: door.id,
                conveyance: taking?.conveyance ?? null,
                conveyancePower: taking?.power ?? null,
                purse,
                // The door's count, dealt by the holder and then by the
                // conclave. Neither the errand nor the craft moves it.
                hands: party.length
            });
            if (posting.stonesBurned > 0) {
                faction.resources.spirit_stones = Math.max(0, purse - posting.stonesBurned);
            }

            const when = whenTheErrandHappened({
                notBefore: day, reportedOn: day, spanEndsOn, term: posting.days
            });
            const partyIds = party.map(p => p.id);
            const note = `At ${door.name} for the ${houseName(faction.name)}, on a place the `
                + 'house was dealt.';
            const moveThem = (untilDay: number): void => {
                for (const member of party) {
                    const index = at.get(member.id);
                    const npc = index === undefined ? undefined : state.npcs[index];
                    if (index === undefined || !npc || !isTheWorldsToMove(npc)) continue;
                    state.npcs[index] = {
                        ...setLocation(npc, door.id, day),
                        activity: {
                            kind: 'out_with_a_party',
                            note,
                            withIds: partyIds.filter(id => id !== member.id),
                            sinceDay: day,
                            untilDay,
                            returnTo: whereTheyGoBackTo(npc)
                        }
                    };
                }
            };

            walked++;
            if (when.stillOut) {
                moveThem(when.returnsOnDay);
                appendWorldFact(state, newsOfAPartyStillOut({
                    posting, party, departsOnDay: day, dueOnDay: when.returnsOnDay
                }));
                continue;
            }

            const sending = resolveSending({
                posting,
                party,
                departsOnDay: when.departsOnDay,
                rng: forStream(state.seed, 'a-place-at-a-door', door.id, faction.id, String(day)),
                location: door
            });
            moveThem(sending.returnsOnDay);
            for (const missing of sending.lost) {
                const index = at.get(missing.id);
                if (index === undefined) continue;
                const gone = theWorldLoses(
                    state.npcs[index]!,
                    sending.returnsOnDay,
                    `Went into ${door.name} on ${faction.name}'s place and did not come back.`
                );
                if (!gone) continue;
                state.npcs[index] = gone;
            }

            const news = newsOfASending(sending, { onDay: sending.returnsOnDay });
            if (sending.outcome !== 'finished' || news.magnitude >= WORTH_REPEATING) {
                appendWorldFact(state, news);
            }
        }
    }
    return walked;
}

/**
 * A door stands open and the houses that can reach it send people.
 *
 * WHO GOES IS NOT DECIDED HERE. `whoSendsWhenADoorOpens` is the reading, and it
 * is the same reading the player's own door gets - which is what keeps the
 * window, rather than a rate, in charge of whether this is a private find or a
 * scramble. This half is the world moving: parties stand at the door until the
 * term is up, and what happens to them is `resolveSending` on the reason the
 * house opened, exactly as for every other errand.
 *
 * NEAREST SEAT FIRST, which is arrival order. Nothing here spends the ground:
 * a door on a season comes round, and the `emptied` tag belongs to ground
 * somebody opened for good. See `a-door-that-opens-is-a-race.ts`.
 *
 * AND WHETHER A HOUSE WAS ALREADY WALKING is its own people's reading, supplied
 * here and derived nowhere else. `whatOneOfTheWorldsOwnPeopleKnows` is the one
 * answer to what somebody has of a piece of ground, so the board a player reads
 * and the date a house sets out on cannot come apart.
 */
function theProvinceGoes(
    state: WorldState,
    door: LocationRecord,
    day: number,
    /** The last day of the year being reported on, or the day the world reaches. */
    spanEndsOn: number,
    peopleKnow: WhatSomebodyKnowsOfIt
): readonly AHouseOnTheRoad[] {
    const roster = new Map<string, Candidate[]>();
    const at = new Map<string, number>();
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i];
        at.set(npc.id, i);
        if (npc.status !== 'alive' || !npc.factionId) continue;
        // The player's mirror row is never spent by the world. Walking their
        // character to a door they did not set out for is the engine taking a
        // decision that is theirs.
        if (!isTheWorldsToMove(npc)) continue;
        const on = roster.get(npc.factionId);
        const who = { id: npc.id, name: npc.name, ordinal: npc.cultivation.realmOrdinal };
        if (on) on.push(who); else roster.set(npc.factionId, [who]);
    }

    const reach = walkingDaysFrom(state.locations, door.id);
    const going = whoSendsWhenADoorOpens({
        door,
        onDay: day,
        houses: state.factions
            .filter(f => f.dissolvedOnDay === null && isBelowTheLid(f))
            .map(f => ({
                id: f.id,
                name: f.name,
                seatLocationId: f.seatLocationId,
                roster: roster.get(f.id) ?? [],
                // The same two columns the yearly sendings pass reads, so a
                // house at a door and a house on an errand cannot disagree
                // about what it owns or what it can afford to run.
                yard: whatThisHouseCouldTakeOut(state, f),
                purse: Number(f.resources.spirit_stones ?? 0)
            })),
        walkingDaysTo: id => reach.get(id),
        hasAnythingOfTheGround: personId =>
            peopleKnow(personId, 'place', door.id) !== 'unaware'
    });

    for (const house of going) {
        const rng = forStream(state.seed, 'a-door-opens', door.id, house.houseId, String(day));
        // AND THE CHEST PAYS FOR THE GROUND THAT IS NOT THERE, by the same
        // debit the yearly errand takes and off the same figure.
        if (house.posting.stonesBurned > 0) {
            const chest = state.factions.find(f => f.id === house.houseId);
            if (chest) {
                chest.resources.spirit_stones = Math.max(
                    0, Number(chest.resources.spirit_stones ?? 0) - house.posting.stonesBurned
                );
            }
        }
        // A RACE CANNOT BE BACKDATED. The party could not have set out before
        // the door opened, so `notBefore` is the opening and not the span - and
        // an errand whose term runs past the end of the span is a party still
        // standing in a doorway rather than one that came back.
        const when = whenTheErrandHappened({
            notBefore: day,
            reportedOn: day,
            spanEndsOn,
            term: house.posting.days
        });
        const partyIds = house.party.map(p => p.id);
        const moveThem = (untilDay: number, note: string): void => {
            for (const member of house.party) {
                const index = at.get(member.id);
                const row = index === undefined ? undefined : state.npcs[index];
                if (index === undefined || row === undefined || !isTheWorldsToMove(row)) continue;
                state.npcs[index] = {
                    ...setLocation(row, door.id, day),
                    activity: {
                        kind: 'out_with_a_party',
                        note,
                        withIds: partyIds.filter(id => id !== member.id),
                        sinceDay: day,
                        untilDay,
                        returnTo: whereTheyGoBackTo(row)
                    }
                };
            }
        };
        const atTheDoor = `At ${door.name} for the ${houseName(house.houseName)} `
            + 'while it stands open.';

        if (when.stillOut) {
            moveThem(when.returnsOnDay, atTheDoor);
            appendWorldFact(state, newsOfAPartyStillOut({
                posting: house.posting,
                party: house.party,
                departsOnDay: day,
                dueOnDay: when.returnsOnDay
            }));
            continue;
        }

        const sending = resolveSending({
            posting: house.posting,
            party: house.party,
            departsOnDay: when.departsOnDay,
            rng,
            location: door
        });

        moveThem(sending.returnsOnDay, atTheDoor);
        for (const missing of sending.lost) {
            const index = at.get(missing.id);
            if (index === undefined) continue;
            const gone = theWorldLoses(
                state.npcs[index],
                sending.returnsOnDay,
                `Went into ${door.name} for ${house.houseName} while it stood open `
                + 'and did not come back.'
            );
            if (!gone) continue;
            state.npcs[index] = gone;
        }

        // AND THE SAME STAKE, BY THE SAME DOOR. A race is an errand a house
        // opened on a reason like any other, and the reason declares what it
        // loses. The door is nobody's counterpart, so an errand that stakes a
        // neighbour's regard has nothing to take - which is the declaration
        // being read rather than substituted.
        const faction = sending.outcome === 'finished'
            ? null : state.factions.find(f => f.id === house.houseId) ?? null;
        const took = faction === null ? null : theHouseLostWhatItStaked(state, {
            faction,
            sending,
            onDay: sending.returnsOnDay,
            counterparties: [],
            onTheRoll: (roster.get(house.houseId) ?? []).length
        });

        const news = newsOfASending(sending, { onDay: sending.returnsOnDay });
        if (took !== null) news.data = { ...news.data, ...took };
        if (sending.outcome !== 'finished' || news.magnitude >= WORTH_REPEATING) {
            appendWorldFact(state, news);
        }
    }

    return going;
}

/**
 * Doors on a cycle, opening and shutting.
 *
 * THIS PASS HAD A CALLER AND STILL NEVER RAN. Every other unreachable system
 * found in this tree was a capability with nothing routed to it, and every one
 * of those was findable by grepping for callers. This one is called every year
 * by the driver and could not fire: it clips the year to the caller's span with
 * `from` and `until` below, and the year index was a year AHEAD of that span, so
 * both collapsed onto one calendar date and the pass asked whether a door opened
 * TODAY, once a year, instead of over the 365 days in it. Measured over 200
 * years on four seeds through `advanceWorldForPlay`: no door opened or shut, on
 * any of them. After: 14 to 21 openings and 9 to 12 closings a world.
 *
 * Everything downstream went with it - `theProvinceGoes`, the race a window
 * opens, `whoSendsWhenADoorOpens`. All of it had tests, and every one of those
 * tests drives `applyPressure` over a single multi-century span, which is the
 * shape no caller in the game uses.
 *
 * Having a caller is not proof that anything runs.
 */
function applyConvergences(
    state: WorldState,
    year: number,
    fromDay: number,
    toDay: number
): PressureEvent[] {
    const out: PressureEvent[] = [];
    const yearStart = year * 365;
    const yearEnd = yearStart + 364;

    // BUILT ONCE, AND ONLY IF A DOOR ACTUALLY OPENS. The reader indexes the
    // whole ledger, which is long in an old world, and most years open nothing.
    let peopleKnow: WhatSomebodyKnowsOfIt | null = null;
    const whatPeopleKnow = (): WhatSomebodyKnowsOfIt =>
        (peopleKnow ??= whatOneOfTheWorldsOwnPeopleKnows(state));

    for (let i = 0; i < state.locations.length; i++) {
        const location = state.locations[i];
        // A CYCLE IS NOT ALWAYS A DOOR. A hall carries one so that a house which
        // hears petitions three days a month is expressible without a field for
        // it, and those come round monthly - so a pass that announced every
        // cycle would file a province-wide opportunity every time a reception
        // room opened. `location.sealed` used to stand in for this and is no
        // longer a bar; what is actually meant is closed GROUND, which the
        // record already knows how to say.
        if (!location.cycle
            || !isBelowTheLid(location)
            || !aSealHereMeansAnUndrawnPocket(location.kind)) continue;

        const from = Math.max(yearStart, fromDay);
        const until = Math.min(yearEnd, toDay);

        const opensOn = nextOpeningDay(location, from);
        const opened = opensOn !== null && opensOn <= until
            && windowStartOn(location, opensOn) === opensOn;

        if (opened) {
            const day = withinSpan(opensOn!, fromDay, toDay);
            const years = Math.round(location.cycle.periodDays / DAYS_PER_YEAR);
            const changed = applyLocationChange(location, {
                onDay: day,
                kind: 'unsealed',
                summary: `${location.name} is open. It was last open ${years} years ago.`,
                // The cause is known and is nobody: it is the cycle. That is a
                // different thing from an unexplained change and should not be
                // filed as one.
                causeKnown: true,
                witnessed: false,
                // The column and the usable density are the world's record that
                // the door moved, not a second answer about whether it is open:
                // `isOpenOn` reads the schedule and ignores both.
                patch: {
                    sealed: false,
                    discovered: true,
                    environment: { spiritualDensity: qiFraction(location.qiDensity) }
                }
            });
            state.locations[i] = changed.location;

            // AND THE PROVINCE GOES, OR DOES NOT, AND THE WINDOW DECIDES WHICH.
            // A week is whoever is standing there; a season is a race. The
            // scaling is the window's own, through the read that already prices
            // a road against it - see `a-door-that-opens-is-a-race.ts`.
            // THE YEAR'S LAST DAY, NOT THE CALL'S. Whether a party at a door is
            // back or still standing in it decided the world differently
            // depending on how many years the caller asked for in one go: in a
            // sixty-year call every race resolved, and in sixty one-year calls
            // the long terms did not. Clamped to `toDay` so nothing is ever
            // reported back after the day the world has actually reached, which
            // for a whole-year span is the year's own end.
            const going = theProvinceGoes(
                state, state.locations[i], day,
                Math.min(yearEnd, toDay), whatPeopleKnow());

            out.push(emit(state, 'convergence_opened', day, {
                day,
                kind: 'opportunity',
                scale: 'regional',
                summary: changed.change.summary,
                locationId: location.id,
                locationChangeIds: [changed.change.id],
                factionIds: going.map(h => h.houseId),
                visibility: 'public',
                magnitude: 0.7,
                data: {
                    openDays: location.cycle.openDays,
                    periodYears: years,
                    housesOnTheRoad: going.length,
                    housesThatKnewTheDate: going.filter(h => h.knewTheDate).length
                },
                unattributed:
                    'The pass that has never gone anywhere goes somewhere this season. '
                    + 'Nobody arranged it and nobody local can say how long it lasts.',
                consequences: {
                    immediate: going.length === 0
                        ? 'It is open, and whoever left it is not coming.'
                        : `${going.length} house${going.length === 1 ? '' : 's'} `
                            + 'put people on the road for it.',
                    physical: `${location.name} is reachable.`,
                    opportunitiesOpened: [
                        `${location.cycle.openDays} days inside ${location.name}.`
                    ],
                    tenYearsLater: 'Shut again, and the people who did not go are still '
                        + 'explaining why they did not.'
                }
            }, { locations: [location.id] }));
        }

        // And it shuts, which is the half that makes the opening mean anything.
        // Read off the record as it now stands, so a window that opened and ran
        // out inside this same span shuts inside it too.
        //
        // WHETHER IT IS OPEN IS THE RECORD'S ANSWER, NOT AN ARITHMETIC ONE. The
        // guard here was `windowOpenedOn >= fromDay` - pair a closing with an
        // opening announced by THIS CALL - and a window straddling a year
        // boundary therefore shut in a sixty-year call and never shut at all in
        // sixty one-year ones, which is every span the driver actually runs.
        // Measured on seed beta at sixty years: two doors stayed recorded open
        // for good, and people went on migrating to ground that had closed.
        const standing = state.locations[i];
        const closesOn = nextClosingDay(standing, from);
        if (closesOn !== null && closesOn <= until && !standing.sealed) {
            const day = withinSpan(closesOn, fromDay, toDay);
            const shuts = whatShutsThisDoor(standing);
            const changed = applyLocationChange(standing, {
                onDay: day,
                kind: 'sealed',
                summary: shuts === null
                    ? `${standing.name} is shut again.`
                    : `${standing.name} is shut again. ${WHAT_SHUTS_IT[shuts]}`,
                // Known, and it is nobody: the place closes itself. Filing it as
                // unexplained would put a hand on it that nobody's on.
                causeKnown: true,
                witnessed: false,
                patch: {
                    sealed: true,
                    environment: { spiritualDensity: 0.05 }
                }
            });
            state.locations[i] = changed.location;

            out.push(emit(state, 'convergence_closed', day, {
                day,
                kind: 'opportunity',
                scale: 'local',
                summary: changed.change.summary,
                locationId: standing.id,
                locationChangeIds: [changed.change.id],
                visibility: 'public',
                magnitude: 0.4,
                unattributed: 'The pass does not go anywhere any more.',
                consequences: {
                    immediate: 'Anybody still inside is still inside.',
                    opportunitiesClosed: [`${standing.name}, for a very long time.`],
                    tenYearsLater: 'A list of who went in and a shorter list of who came out.'
                }
            }, { locations: [standing.id] }));
        }
    }
    return out;
}

/** How much of their own realm's span this person has spent, 0..1. */
function lifeSpent(npc: NpcRecord, day: number): number {
    const span = lifespanForOrdinal(npc.cultivation.realmOrdinal);
    if (!Number.isFinite(span) || span <= 0) return 1;
    const age = (day - npc.identity.bornOnDay) / DAYS_PER_YEAR;
    return Math.max(0, Math.min(1, age / span));
}

/**
 * Pick somebody to have died of their own mortality, or nobody.
 */
function pickByMortality(
    rng: CultivationRNG,
    candidates: readonly NpcRecord[],
    day: number
): NpcRecord | null {
    if (candidates.length === 0) return null;
    const weights = candidates.map(n => {
        const spent = lifeSpent(n, day);
        return spent * spent;
    });
    const total = weights.reduce((sum, w) => sum + w, 0);
    // Nobody in the pool is anywhere near the end of themselves. That is not a
    // failure of the event; it is the event correctly declining to fire.
    if (total <= 0) return null;
    let cursor = rng.next() * total;
    let chosen = candidates[candidates.length - 1];
    for (let i = 0; i < candidates.length; i++) {
        cursor -= weights[i];
        if (cursor < 0) { chosen = candidates[i]; break; }
    }

    // AND AN ACCEPTANCE ROLL, which is the half that matters.
    return rng.chance(lifeSpent(chosen, day)) ? chosen : null;
}

function pick<T>(rng: CultivationRNG, items: readonly T[]): T | null {
    return items.length === 0 ? null : items[rng.int(0, items.length - 1)];
}

/**
 * The people the world may pick to DO something.
 */
function theWorldsPeople(state: WorldState): NpcRecord[] {
    return state.npcs.filter(isTheWorldsToMove);
}

/**
 * Whether a house has failed: it cannot pay, or nobody is left to carry its name.
 *
 * NOT BECAUSE ITS ROLL IS SHORT - see `faction_fell`, where the counts that
 * judged the slice were measured and removed. And an EMPTY roll is not nobody
 * left either: a house whose compound stands and sleeps people nobody models
 * still has them (`stillHasPeopleNobodyModels`), and takes one of its own in
 * (`a-house-takes-in-one-of-its-own.ts`). An empty roll ends a house that has
 * nobody else.
 *
 * AND NOT A BODY WHOSE PEOPLE OUTLAST INSTITUTIONS. Counting heads is the right
 * test for a house that runs on succession and the wrong one at the top of the
 * ladder, where a single survivor holds tens of thousands of years and
 * rebuilding after losing three of four Seats to a crossing is not a body dying
 * - it is the only thing that body does. The Hollow Court dissolved on every
 * seed inside three centuries against members who cannot die of time.
 */
export function whetherAHouseHasFailed(state: WorldState, f: FactionRecord): boolean {
    if (standsOnAnUnreachableClock(state, f.id)) return false;
    if ((f.resources.spirit_stones ?? 0) < 400) return true;
    if (membersOf(state, f.id).length > 0) return false;
    return !stillHasPeopleNobodyModels(state, f);
}

function membersOf(state: WorldState, factionId: string): NpcRecord[] {
    return state.npcs.filter(
        n => n.factionId === factionId && n.status === 'alive' && isBelowTheLid(n)
    );
}

function veinsOf(state: WorldState, factionId: string): LocationRecord[] {
    return state.locations.filter(
        l => l.kind === 'vein' && isBelowTheLid(l) && l.controllingFactionId === factionId
    );
}

function replaceLocation(state: WorldState, next: LocationRecord): void {
    const at = indexById(state.locations, next.id);
    if (at >= 0) state.locations[at] = next;
}

function replaceNpc(state: WorldState, next: NpcRecord): void {
    const at = indexById(state.npcs, next.id);
    if (at >= 0) state.npcs[at] = next;
}

/**
 * Somebody takes it personally.
 */
function openPersonalAccount(
    state: WorldState,
    loserId: string,
    winnerId: string,
    day: number,
    note: string,
    rng: CultivationRNG
): string[] {
    const aggrieved = pick(rng, membersOf(state, loserId));
    const taker = pick(rng, membersOf(state, winnerId));
    if (!aggrieved || !taker) return [];
    const at = indexById(state.npcs, aggrieved.id);
    if (at < 0) return [];
    state.npcs[at] = upsertRelationship(state.npcs[at], {
        targetId: taker.id,
        targetName: taker.name,
        kind: 'enemy',
        standing: -0.75,
        note
    }, day);
    andTheOtherEnd(state.npcs, aggrieved, { targetId: taker.id, kind: 'enemy', standing: -0.75 }, day);
    return [aggrieved.id, taker.id];
}

function adjustStandingBetween(a: FactionRecord, b: FactionRecord, delta: number): void {
    a.standing[b.id] = clamp((a.standing[b.id] ?? 0) + delta, -1, 1);
    b.standing[a.id] = clamp((b.standing[a.id] ?? 0) + delta, -1, 1);
}

/** Factions that have a reason to move against this one. */
function rivalsOf(state: WorldState, faction: FactionRecord): FactionRecord[] {
    return liveFactions(state).filter(
        f => f.id !== faction.id && (f.standing[faction.id] ?? 0) <= -0.3
    );
}

function emit(
    state: WorldState,
    kind: PressureKind,
    day: number,
    fact: Omit<Parameters<typeof makeFact>[0], 'consequences'> & {
        consequences?: Partial<EventConsequences>;
        /**
         * What a player who cannot name any of the actors would notice instead.
         * Stored on the fact so the digest can render an unattributed
         * consequence without inventing one.
         */
        unattributed: string;
    },
    touched: Partial<PressureEvent['touched']> = {},
    deaths: DeathHandoff[] = []
): PressureEvent {
    const { consequences, unattributed, ...rest } = fact;
    const stored = appendWorldFact(state, makeFact({
        ...rest,
        consequences: consequences ? fillConsequences(consequences) : null,
        data: { ...(rest.data ?? {}), unattributed, pressure: kind }
    }));
    return {
        kind,
        onDay: day,
        fact: stored,
        touched: {
            factions: touched.factions ?? [],
            locations: touched.locations ?? [],
            npcs: touched.npcs ?? []
        },
        deaths
    };
}

/**
 * Keep a generated date inside the span that was actually advanced.
 */
function withinSpan(day: number, fromDay: number, toDay: number): number {
    return Math.max(fromDay, Math.min(toDay, day));
}

/**
 * A house name with its article stripped, for summaries that supply their own.
 */
function houseName(name: string): string {
    return name.replace(/^[Tt]he\s+/, '');
}

function clamp(n: number, lo: number, hi: number): number {
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}

// ─────────────────────────────────────────────────────────────────────────
// THE TABLE
// Weights are relative. Ordinary institutional churn is common; a faction
// ending is rare; a region turning forbidden is rarer still.
// ─────────────────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
    // A house is ended by another house, and then the survivors choose.
    {
        kind: 'house_destroyed',
        weight: 2,
        apply(state, day, rng) {
            // Bind to a pair the world already contains: somebody hostile, and
            // decisively stronger. Nothing is chosen; if the province has no
            // such pair this year, nothing happens, which is correct.
            const live = liveFactions(state);
            const pairs: { victim: FactionRecord; aggressor: FactionRecord }[] = [];
            for (const victim of live) {
                if (victim.tags.includes('destroyed_by')) continue;
                const victimPower = Number(victim.resources.power_ordinal ?? 0);
                for (const aggressor of rivalsOf(state, victim)) {
                    // IN A WAR, NOT OUT OF ONE. A house that comes for another
                    // and leaves nobody standing below its own height is the
                    // end of a war somebody declared, never a draw over every
                    // pair of rivals with a wide enough gap. Drawn over rivals,
                    // it ended 12 of the 38 catalog houses in 2,500 years on
                    // `shape-a`, most of them at peace with the house that came.
                    if (!areAtWarWithEachOther(state, victim.id, aggressor.id)) continue;
                    if (Number(aggressor.resources.power_ordinal ?? 0)
                        >= victimPower + DECISIVE_MARGIN) {
                        pairs.push({ victim, aggressor });
                    }
                }
            }
            const pair = pick(rng, pairs);
            if (!pair) return null;
            const { victim, aggressor } = pair;

            // What was actually taken. Read off the roster and the treasury
            // rather than declared: severity is how much of the house is gone.
            const before = membersOf(state, victim.id);
            const attackerOrdinal = Number(aggressor.resources.power_ordinal ?? 0);
            const below = before.filter(n =>
                n.cultivation.realmOrdinal < attackerOrdinal - CASUAL_KILL_MAX_GAP
            );
            // SOME FALL AND THE REST RUN. Everybody below the line died, and a
            // house destroyed left nobody to scatter: Nine Peaks ended with
            // nobody. Each person's own rung against the height that came decides
            // whether they fall, and whoever gets out is on no roll. See
            // `what-becomes-of-a-houses-people-when-it-is-gone.ts`.
            const losses = below.filter(n => whetherTheyFall(state, n, attackerOrdinal, day));
            const fled = below.filter(n => !losses.includes(n));
            const runTo = whereTheyRunTo(state, victim);
            for (const npc of fled) {
                const at = indexById(state.npcs, npc.id);
                if (at < 0 || !isTheWorldsToMove(state.npcs[at]!)) continue;
                state.npcs[at] = offTheRoll(state.npcs[at]!, day, `${ROGUE_FLED}${victim.id}`, runTo);
            }
            const deaths: DeathHandoff[] = [];
            // READ THE ROW BACK BEFORE WRITING IT. `losses` is a snapshot taken
            // before any of them died, and `settleNpcDeath` writes onto the
            // OTHER people it names - a disciple whose master died two lines
            // ago carries the fact that says so. Killing them off the snapshot
            // put the pre-death row back and the link went with it, which is
            // what `what-a-world-must-never-contain.test.ts` reads as a fact
            // naming somebody who does not carry it. One house losing twelve
            // people in a day is where master and disciple are most likely to
            // both be on the list.
            for (const npc of losses) {
                const at = indexById(state.npcs, npc.id);
                const fresh = at >= 0 ? state.npcs[at] : npc;
                const dead = theWorldEnds(
                    fresh, day, `Killed when the ${houseName(aggressor.name)} came.`);
                // One of the people the house came for and did not get. The
                // severity below is the share of the roll that fell, so it
                // moves with this rather than having to be corrected.
                if (!dead) continue;
                replaceNpc(state, dead);
                deaths.push(settleNpcDeath(
                    state, at >= 0 ? state.npcs[at] : fresh, day));
            }
            const severity = before.length === 0
                ? 1 : Math.min(1, (losses.length + fled.length) / before.length);

            victim.resources.spirit_stones = Math.round(
                Number(victim.resources.spirit_stones ?? 0) * (1 - severity)
            );
            victim.tags = Array.from(new Set(victim.tags.concat('destroyed_by')));
            adjustStandingBetween(victim, aggressor, -0.6);

            // The seat is a place afterwards, and the world just made a new
            // ruin. Provenance documented, because people watched it happen,
            // and no cycle, because it is a place you can walk to.
            const changeIds: string[] = [];
            const seat = victim.seatLocationId
                ? state.locations.find(l => l.id === victim.seatLocationId) ?? null : null;
            // Same guard as `applyExpend`: a region is a container and does not
            // become a ruin. See the block there for what happened without it.
            if (seat && seat.kind !== 'region' && severity >= 0.5) {
                const ruined = ruinFromFallenSeat(seat, {
                    onDay: day,
                    houseName: victim.name,
                    houseId: victim.id
                });
                replaceLocation(state, ruined.location);
                changeIds.push(ruined.change.id);
            }

            const opening = emit(state, 'house_destroyed', day, {
                day,
                kind: 'catastrophe',
                scale: 'regional',
                summary:
                    `The ${houseName(aggressor.name)} came for the ${houseName(victim.name)}. `
                    + `${losses.length} of ${before.length} dead`
                    + (fled.length > 0 ? `, and ${fled.length} fled.` : '.')
                    + (changeIds.length > 0 ? ` The compound is a ruin.` : ''),
                locationId: seat?.id ?? null,
                factionIds: [victim.id, aggressor.id],
                locationChangeIds: changeIds,
                visibility: 'public',
                magnitude: 0.85,
                unattributed:
                    'The valley road is full of people going the other way, and none of '
                    + 'them are stopping to explain.',
                consequences: {
                    immediate: `The ${victim.name} has ${before.length - losses.length - fled.length} people left.`,
                    physical: changeIds.length > 0 ? 'The compound is standing and empty.' : '',
                    beneficiaries: [{ id: aggressor.id, name: aggressor.name, role: 'aggressor' }],
                    losers: [{ id: victim.id, name: victim.name, role: 'stricken' }],
                    opportunitiesOpened: ['A compound nobody is holding, and it fell this year.'],
                    tenYearsLater: 'Somebody is living in it, and did not build it.'
                }
            }, {
                factions: [victim.id, aggressor.id],
                locations: seat ? [seat.id] : [],
                npcs: [...losses, ...fled].map(n => n.id)
            }, deaths);

            // And now the survivors choose. Everything past this point is the
            // cascade's, and its steps are separate facts with their own ids.
            const chain = runCascade(state, {
                strickenId: victim.id,
                aggressorId: aggressor.id,
                day,
                causeFactId: opening.fact.id,
                severity
            }, forStream(state.seed, 'cascade', victim.id, day));

            // The chain's touched ids and deaths fold into the opening event,
            // because a caller that reads `touched` is asking what moved and
            // the honest answer includes everything the chain moved.
            opening.touched.factions.push(...chain.touched.factions);
            opening.touched.locations.push(...chain.touched.locations);
            opening.touched.npcs.push(...chain.touched.npcs);
            opening.deaths.push(...chain.deaths);
            return opening;
        }
    },

    // ── A vein changes hands. The single most consequential thing that can
    //    happen to a sect, because the vein is its whole ability to produce
    //    cultivators. ────────────────────────────────────────────────────
    {
        kind: 'vein_lost',
        weight: 12,
        apply(state, day, rng) {
            const holders = liveFactions(state).filter(f => veinsOf(state, f.id).length > 0);
            const loser = pick(rng, holders);
            if (!loser) return null;
            const vein = pick(rng, veinsOf(state, loser.id));
            if (!vein) return null;

            const contenders = rivalsOf(state, loser);
            const federatedSeizure = loser.tags.includes('federated') && contenders.length === 0;
            const winner = pick(rng, contenders);
            if (!winner && !federatedSeizure) return null;

            const changed = applyLocationChange(vein, {
                onDay: day,
                kind: 'conquered',
                summary: winner
                    ? `${vein.name} passed to the ${houseName(winner.name)}.`
                    : `${vein.name} was withdrawn from the ${houseName(loser.name)}; the grant was not renewed.`,
                causeKnown: true,
                patch: {
                    controllingFactionId: winner ? winner.id : null,
                    addTags: ['changed_hands']
                }
            });
            replaceLocation(state, changed.location);

            loser.controlledLocationIds = loser.controlledLocationIds.filter(id => id !== vein.id);
            loser.resources.veins = Math.max(0, (loser.resources.veins ?? 0) - 1);
            loser.resources.spirit_stones = Math.round((loser.resources.spirit_stones ?? 0) * 0.6);
            loser.tags = Array.from(new Set(loser.tags.concat('lost_vein')));
            if (winner) {
                winner.controlledLocationIds.push(vein.id);
                winner.resources.veins = (winner.resources.veins ?? 0) + 1;
                adjustStandingBetween(loser, winner, -0.3);

                openPersonalAccount(state, loser.id, winner.id, day, `Took ${vein.name}.`, rng);
            }

            return emit(state, 'vein_lost', day, {
                day,
                kind: 'resource_contested',
                scale: 'regional',
                summary: changed.change.summary,
                locationId: vein.id,
                factionIds: winner ? [loser.id, winner.id] : [loser.id],
                locationChangeIds: [changed.change.id],
                visibility: 'public',
                magnitude: 0.75,
                unattributed:
                    'The road up the gorge is closed to anyone without a token, and the ' +
                    'people collecting the toll are not the ones who were there before.',
                consequences: {
                    immediate: changed.change.summary,
                    physical: `Control of ${vein.name} moved.`,
                    beneficiaries: winner ? [{ id: winner.id, name: winner.name, role: 'holder' }] : [],
                    losers: [{ id: loser.id, name: loser.name, role: 'dispossessed' }],
                    factionReactions: [{ factionId: loser.id, reaction: 'Recalled its outer disciples.' }],
                    relationshipChanges: winner
                        ? [{ aId: loser.id, bId: winner.id, change: 'open hostility' }] : [],
                    opportunitiesOpened: ['Work for anyone who can survey a vein.'],
                    opportunitiesClosed: [`Admission to the ${houseName(loser.name)} on the old terms.`],
                    rumours: ['That the grant was sold rather than lost.'],
                    tenYearsLater:
                        `The ${loser.name} produces fewer cultivators every decade, and everyone local knows it.`
                }
            }, {
                factions: winner ? [loser.id, winner.id] : [loser.id],
                locations: [vein.id]
            });
        }
    },

    // ── Somebody who mattered locally is gone. ───────────────────────────
    {
        kind: 'elder_died',
        weight: 16,
        apply(state, day, rng) {
            // A DEATH IS AN OUTCOME, NOT A RATE. The owner: *"people don't
            // randomly die at 5% at a uniform rate, we simulate what happened
            // in x years based on their current traits, whether they chose to
            // advance or what. and if they died in a war."*
            //
            // This drew somebody by how much of their span they had spent and
            // then invented one of three reasons for them. Both halves were
            // wrong. The cause has to exist before the person is chosen - and
            // AGE IS NOT THIS PASS'S TO GIVE: `time.ts` already ends everybody
            // on the exact day `lifespanEndsOnDay` passes, so drawing on the
            // share of a span spent was a rate that killed people BEFORE their
            // span ran out, a second earlier copy of a death the world already
            // does properly. It is gone, and so is the breakthrough that did
            // not hold, which `applyAdvancement` does for real.
            //
            // What is left is a wound somebody was already carrying - and not
            // for anybody whose dying would rearrange the world. The owner:
            // *"patriarchs obviously don't have a 5% chance of dying every
            // year"*, and a patriarch is not necessarily high-ordinal, so the
            // guard is the same property the wake reads rather than a second
            // threshold beside it: how high they stood, what they held, who
            // leaned on them, what only they carried. An untreated wound is
            // also not something those people carry about for centuries; it is
            // the thing they would spend anything to have treated. Everybody
            // else may keep a rate, and should, because the world has to stay
            // dangerous. `theWorldMayEnd` is asked FIRST, so a stated row is
            // not a wasted event, and the property is read last because it is
            // the only expensive question here.
            //
            // AND THE LINE AND THE PROPERTY ARE BOTH GUARDS, NOT ONE INSTEAD OF
            // THE OTHER. Measured on `afford-a` at a thousand years with only
            // the property here: half a wound-death a century in the 29-40
            // band. The property's height road reads `whatArrivingInIsWorth`,
            // which does not reach the institutional band until Grand
            // Ascension, so ordinals 29 to 36 sat outside both guards at a
            // height the owner says has no background rate at all. The line
            // catches the old monsters by their rung; the property catches the
            // patriarch of a modest house who never gets near it.
            const wounded = theWorldsPeople(state).filter(
                n => n.status === 'alive' && isBelowTheLid(n) &&
                    n.factionId != null && n.factionRankIndex >= 3 &&
                    theWorldMayEnd(n) && !isOnTheLastProject(n) &&
                    n.cultivation.realmOrdinal < WHERE_THE_OLD_MONSTERS_BEGIN &&
                    n.cultivation.untreatedInjuries > 0
            ).filter(n => !theirDeathWouldRearrangeTheWorld(state, n));
            const npc = wounded.length > 0 && rng.chance(WHEN_IT_IS_AN_OLD_WOUND)
                ? wounded[rng.int(0, wounded.length - 1)] ?? null
                : null;
            if (!npc) return null;
            const faction = state.factions.find(f => f.id === npc.factionId) ?? null;

            const cause = 'an old wound';
            const dead = theWorldEnds(npc, day, `Died of ${cause}.`);
            // A draw that came up with somebody the world may not end is a draw
            // that produced nothing, exactly like an empty candidate pool two
            // lines above.
            if (!dead) return null;
            replaceNpc(state, dead);
            const handoff = settleNpcDeath(state, npc, day);

            // HOW BIG A DEATH IS READS WHO DIED. A constant here made an outer
            // hall's elder and the ceiling of the world the same event. See
            // `what-a-death-at-this-height-is-worth.ts`, which also moves the
            // things that stood in their shadow.
            const worth = whatADeathIsWorth(npc, faction, whatTheyHeldUp(state, npc));
            const wake = theWakeOfADeath(state, state.npcs[indexById(state.npcs, npc.id)] ?? npc,
                day, `They died of ${cause}.`);

            return emit(state, 'elder_died', day, {
                day,
                kind: 'death',
                scale: worth.scale,
                summary:
                    `${npc.name}, ${rankName(npc.cultivation.realmOrdinal)}` +
                    (faction ? ` of the ${houseName(faction.name)}` : '') + `, died of ${cause}.`,
                actors: [{ id: npc.id, name: npc.name, role: 'deceased' }],
                locationId: npc.locationId,
                factionIds: faction ? [faction.id] : [],
                visibility: worth.visibility,
                magnitude: worth.magnitude,
                unattributed:
                    'A compound on the ridge has been in white for a month, and nobody there ' +
                    'is taking visitors.',
                consequences: {
                    immediate: wake?.seatEmptied === true
                        ? `The chair ${npc.name} held is empty, and the house stands lower than it did.`
                        : `The seat ${npc.name} held is empty.`,
                    physical: '',
                    losers: handoff.primaryHeirId
                        ? [{ id: handoff.primaryHeirId, name: handoff.primaryHeirId, role: 'heir' }] : [],
                    tenYearsLater: wake !== null && wake.housesThatMoved > 0
                        ? 'The houses that stood with them and the houses that stood against them '
                            + 'have both had to decide what this one is worth now.'
                        : handoff.goalsInherited.length > 0
                            ? 'What they were owed, and what they were owed for, is somebody else\'s now.'
                            : 'The account closed with them.'
                }
            }, {
                factions: faction ? [faction.id] : [],
                npcs: [npc.id]
            }, [handoff]);
        }
    },

    // Somebody killed somebody: not a template. Nobody is drawn to kill; the
    // people with a reason act on it in their own pass. See
    // `why-one-cultivator-kills-another.ts`.

    // ── Someone else got there first. ────────────────────────────────────
    {
        kind: 'ruin_opened',
        weight: 8,
        apply(state, day, rng) {
            // WHAT IS LEFT TO BE OPENED, AND WHAT WAS NEVER ANYBODY'S TO OPEN.
            // A door on a season can be walked through and emptied like any
            // other ground, but only while it is standing open, and going
            // through it does not take the seal off: the place shuts itself when
            // the window ends. This pass used to take the flag off a cycled ruin
            // for good, which left it reading shut-until-its-season with the
            // column saying open and nothing in the world to reconcile them.
            //
            // AND THE THIRD KIND, WHICH THIS PASS COULD NOT SEE AT ALL. Ground
            // that never shut carries no cycle, is not sealed and is not
            // `ruined`, so it fell through every arm of the test below and the
            // world emptied 1 of 13 of them in 1800 years across nine pinned
            // worlds - a category the simulation could not touch. A legacy
            // waiting for a person is the design; a legacy nobody in the world
            // is ever able to take is the pass being blind to it.
            const openable = state.locations.filter(l =>
                isBelowTheLid(l) && !l.tags.includes('emptied') && l.discovered &&
                (l.cycle !== null
                    ? l.kind === 'ruin' && isOpenOn(l, day)
                    : (l.kind === 'ruin' && l.sealed) || l.tags.includes('ruined')
                        || l.tags.includes(LEFT_TO_BE_FOUND))
            );
            const ruin = pick(rng, openable);
            if (!ruin) return null;
            const throughADoorThatWasStandingOpen = ruin.cycle !== null;
            const standingOpenAndAlwaysHas = ruin.tags.includes(LEFT_TO_BE_FOUND);
            // THE TRIAL IS THE GATE, AND THE BAR IS MASTERY. `evaluateAccess`
            // reads this ground on five levels and only the top one is being up
            // to the whole of it: below survival is `lethal`, at survival is
            // `surviving`, which is coming back out rather than coming out with
            // anything. The formation is still running at the setting it was
            // left at and `thresholds.mastery` IS that setting, so beating it is
            // what taking the place means. The other two kinds keep the bar they
            // had, because a door is what stops those and a door does not care
            // how strong anybody is.
            //
            // AND THE CLAIMANT IS DRAWN BEFORE THEY ARE TESTED, which is the
            // whole of the rate. `killing` above takes the same shape for the
            // same reason. Drawing out of the people who already qualify makes
            // the gate decide only whether the category is touchable at all, and
            // it fires every time anybody in the world qualifies - measured, all
            // seven never-shut grounds over four pinned worlds were gone inside
            // 400 years, 25% of the category a century, which is the world
            // clearing the shelf before the player reaches it. Drawing from
            // everybody makes the rate the world's own distribution of strength:
            // ground set at a rung waits for a world that produces that rung,
            // and what turns up is usually somebody it would kill.
            const living = theWorldsPeople(state)
                .filter(n => n.status === 'alive' && isBelowTheLid(n));
            const opener = standingOpenAndAlwaysHas
                ? pick(rng, living)
                : pick(rng, living.filter(n =>
                    n.cultivation.realmOrdinal >= Math.max(0, ruin.thresholds.survival - 2)));
            // Nothing shut it and nothing will. It stands there until somebody
            // who is up to it walks in, and while nobody is, nothing happens to
            // it - which is not the same as nobody having been.
            if (standingOpenAndAlwaysHas
                && (!opener || opener.cultivation.realmOrdinal < ruin.thresholds.mastery)) {
                return null;
            }

            // Nothing was shut here, so there is no seal to take off and no gap
            // between what the vein holds and what anybody can reach.
            const nothingWasSealedHere =
                throughADoorThatWasStandingOpen || standingOpenAndAlwaysHas;

            const changed = applyLocationChange(ruin, {
                onDay: day,
                kind: nothingWasSealedHere ? 'depleted' : 'unsealed',
                summary: standingOpenAndAlwaysHas
                    ? `${ruin.name} has stood open since it was built, and ${opener!.name} `
                        + 'went in and came out.'
                    : throughADoorThatWasStandingOpen
                        ? opener
                            ? `${ruin.name} stood open and ${opener.name} went through it.`
                            : `${ruin.name} stood open and somebody went through it. Nobody admits to it.`
                        : opener
                            ? `${ruin.name} was opened by ${opener.name}.`
                            : `${ruin.name} was found open. Nobody admits to it.`,
                causeKnown: opener != null,
                witnessed: false,
                patch: nothingWasSealedHere
                    ? { discovered: true, addTags: ['emptied'] }
                    : {
                        sealed: false,
                        discovered: true,
                        addTags: ['emptied'],
                        environment: { spiritualDensity: qiFraction(ruin.qiDensity) }
                    }
            });
            replaceLocation(state, changed.location);

            // WHAT A LEGACY HANDS OVER IS THE ART, and it is the art the
            // catalog already holds for exactly this - `provenance: 'ruin'`,
            // the set no living institution transmits. A treasury hands over
            // what is standing in it instead, which is the ordinary object
            // layer and not a second kind of prize.
            const artInTheGround = standingOpenAndAlwaysHas
                ? theArtLeftInThisGround(ruin)
                : null;
            if (opener && artInTheGround !== null) {
                replaceNpc(state, {
                    ...opener,
                    cultivation: {
                        ...opener.cultivation,
                        techniqueIds: opener.cultivation.techniqueIds.concat(artInTheGround)
                    }
                });
            }

            // ── AND RUINS YIELD MANUALS ──────────────────────────────────
            //
            // Every other branch used to hand the opener `recovered-${ruin.id}`
            // - an id in no catalog, which `getTechnique` returns undefined for,
            // which sets no ceiling and which nobody can be taught from. So the
            // world opened a ruin, wrote down that somebody had been through it,
            // and the person came out holding a string. That is gone: what comes
            // out of a hole is what was in the hole, and what was in the hole is
            // an object. See `what-a-ruin-has-on-its-shelves.ts` for why that
            // matters more than the technique id - a book is a thing a house
            // shelves, teaches off and copies, and a technique id is one person.
            //
            // BEFORE the sweep below, so a book is already possessed when the
            // generic pass walks past it and the two do not both move it.
            if (opener) {
                const row = state.npcs.find(n => n.id === opener.id) ?? opener;
                const house = row.factionId
                    ? state.factions.find(f => f.id === row.factionId && f.dissolvedOnDay === null)
                    : undefined;
                applyWhatThePartyCarriedOut(state, {
                    locationId: ruin.id,
                    house: house
                        ? { id: house.id, name: house.name, seatLocationId: house.seatLocationId }
                        : null,
                    readers: [row],
                    onDay: day
                });
            }

            // And the stock comes off the ground with them. Only on this
            // branch, so the cost of the walk lands on the kind of ground that
            // was just declared empty: a place tagged `emptied` with its goods
            // still lying in it is the world saying two things at once.
            if (standingOpenAndAlwaysHas && opener) {
                for (let i = 0; i < state.objects.length; i++) {
                    const object = state.objects[i];
                    if (object.locationId !== ruin.id || object.possessorId !== null) continue;
                    state.objects[i] = {
                        ...transferPossession(object, {
                            onDay: day,
                            toHolderId: opener.id,
                            toHolderName: opener.name,
                            how: 'found',
                            source: ruin.name,
                            note: 'Carried out of ground that never shut.'
                        }),
                        // The same tag `applyRoadsComprehended` strips when a
                        // house brings one out. Left on, the recovery pass
                        // would take it out of a hole it is no longer in.
                        tags: object.tags.filter(t => t !== 'unrecovered')
                    };
                }
            }

            return emit(state, 'ruin_opened', day, {
                day,
                kind: 'ruin_opened',
                scale: 'local',
                summary: changed.change.summary,
                actors: opener ? [{ id: opener.id, name: opener.name, role: 'opener' }] : [],
                locationId: ruin.id,
                locationChangeIds: [changed.change.id],
                causes: ruin.originFactId ? [ruin.originFactId] : [],
                visibility: 'regional',
                magnitude: 0.55,
                unattributed:
                    'There is a new track up to the old compound, and somebody has been selling ' +
                    'things in the market town that nobody local knows how to make.',
                consequences: {
                    immediate: standingOpenAndAlwaysHas
                        ? artInTheGround
                            ? 'Somebody was up to the trial, and what was written down there is '
                                + 'in one head now.'
                            : 'Somebody was up to the trial, and what was in there came out with them.'
                        : throughADoorThatWasStandingOpen
                            ? 'Somebody was inside before the window ran out.'
                            : 'The seal is off.',
                    physical: nothingWasSealedHere
                        ? throughADoorThatWasStandingOpen
                            ? `${ruin.name} has been gone through, and it shuts on its own schedule.`
                            : `${ruin.name} has been gone through. It still stands open.`
                        : `${ruin.name} is open.`,
                    opportunitiesClosed: ['Whatever was in there, for whoever comes next.'],
                    rumours: ['That most of it was already gone before they got in.'],
                    tenYearsLater: 'The site is picked over and the track has grown back.'
                }
            }, { locations: [ruin.id], npcs: opener ? [opener.id] : [] });
        }
    },

    // ── A window closed with somebody else standing in it. ───────────────
    {
        kind: 'opportunity_taken',
        weight: 9,
        apply(state, day, rng) {
            const open = state.opportunities.filter(o => {
                if (o.claimed && o.recurrenceDays === null) return false;
                const w = nextWindow(o, day - 30);
                return w != null && w.opensOnDay <= day && w.closesOnDay > day;
            });
            const opp = pick(rng, open);
            if (!opp) return null;
            const taker = pick(rng, theWorldsPeople(state).filter(
                n => n.status === 'alive' && isBelowTheLid(n)));
            if (!taker) return null;

            const claim = claimOpportunity(opp, taker.id, day);
            if (!claim.ok) return null;
            const at = state.opportunities.findIndex(o => o.id === opp.id);
            if (at >= 0) state.opportunities[at] = claim.opportunity;

            return emit(state, 'opportunity_taken', day, {
                day,
                kind: 'opportunity',
                scale: 'local',
                summary: `${taker.name} took ${opp.name}.`,
                actors: [{ id: taker.id, name: taker.name, role: 'claimant' }],
                locationId: opp.locationId,
                factionIds: opp.factionIds.slice(),
                visibility: 'regional',
                magnitude: 0.4,
                unattributed:
                    'The price of what that ground produces has gone up, and the people who ' +
                    'usually gather it came back with nothing.',
                consequences: {
                    immediate: `${opp.name} is taken.`,
                    opportunitiesClosed: [opp.name],
                    tenYearsLater: 'Whoever took it is a little harder to refuse now.'
                }
            }, { npcs: [taker.id] });
        }
    },

    // ── A border moves, which mostly means a market town changes who it
    //    pays. ─────────────────────────────────────────────────────────────
    {
        kind: 'border_moved',
        weight: 7,
        apply(state, day, rng) {
            const settlements = state.locations.filter(
                l => l.kind === 'settlement' && isBelowTheLid(l)
            );
            const place = pick(rng, settlements);
            if (!place) return null;
            const claimant = pick(rng, liveFactions(state));
            if (!claimant || claimant.id === place.controllingFactionId) return null;
            const previousId = place.controllingFactionId;
            const previous = previousId
                ? state.factions.find(f => f.id === previousId) ?? null : null;

            const changed = applyLocationChange(place, {
                onDay: day,
                kind: 'conquered',
                summary: `${place.name} answers to the ${houseName(claimant.name)} now.`,
                causeKnown: true,
                patch: {
                    controllingFactionId: claimant.id,
                    environment: { politicalControl: `the ${houseName(claimant.name)}` }
                }
            });
            replaceLocation(state, changed.location);
            claimant.controlledLocationIds = Array.from(
                new Set(claimant.controlledLocationIds.concat(place.id))
            );
            if (previous) {
                previous.controlledLocationIds = previous.controlledLocationIds.filter(id => id !== place.id);
                adjustStandingBetween(previous, claimant, -0.2);
                openPersonalAccount(
                    state, previous.id, claimant.id, day,
                    `Was collecting at ${place.name} until they were not.`, rng
                );
            }

            return emit(state, 'border_moved', day, {
                day,
                kind: 'territory_changed',
                scale: 'local',
                summary: changed.change.summary,
                locationId: place.id,
                factionIds: previous ? [previous.id, claimant.id] : [claimant.id],
                locationChangeIds: [changed.change.id],
                visibility: 'regional',
                magnitude: 0.45,
                unattributed:
                    'The people collecting the market tax are wearing a different colour, and ' +
                    'the rate is not what it was.',
                consequences: {
                    immediate: changed.change.summary,
                    physical: 'The boundary marker was moved.',
                    beneficiaries: [{ id: claimant.id, name: claimant.name, role: 'holder' }],
                    losers: previous ? [{ id: previous.id, name: previous.name, role: 'dispossessed' }] : [],
                    tenYearsLater: 'The older people still give directions using the old boundary.'
                }
            }, {
                factions: previous ? [previous.id, claimant.id] : [claimant.id],
                locations: [place.id]
            });
        }
    },

    // ── Somebody found out how far the zone actually runs. ───────────────
    {
        kind: 'deference_tested',
        weight: 6,
        apply(state, day, rng) {
            // The tag was `deference`, which was a governance value; it is
            // `holds_by_reputation` now, which is the same fact stated as a
            // property of the hold rather than as a way of being backed.
            const deference = liveFactions(state).filter(f => f.tags.includes('holds_by_reputation'));
            const held = pick(rng, deference);
            if (!held) return null;
            const tester = pick(rng, liveFactions(state).filter(f => f.id !== held.id));
            if (!tester) return null;

            // Deference is respect, and respect is only real while it is not
            // being tested. Whether it holds is the roll; why anyone tried is
            // not this module's business.
            const holds = rng.chance(clamp(0.35 + (held.resources.power_ordinal ?? 17) / 60, 0.2, 0.9));
            adjustStandingBetween(held, tester, holds ? -0.15 : -0.35);
            if (!holds) {
                held.tags = Array.from(new Set(held.tags.concat('zone_shrunk')));
                held.resources.spirit_stones = Math.round((held.resources.spirit_stones ?? 0) * 0.85);
                openPersonalAccount(
                    state, held.id, tester.id, day,
                    'Moved a marker in and was not made to move it back.', rng
                );
            }

            return emit(state, 'deference_tested', day, {
                day,
                kind: 'territory_changed',
                scale: 'local',
                summary: holds
                    ? `The ${houseName(tester.name)} moved a lease inward on the ${houseName(held.name)} and was made to move it back.`
                    : `The ${houseName(tester.name)} moved a lease inward on the ${houseName(held.name)} and nothing happened.`,
                factionIds: [held.id, tester.id],
                visibility: 'faction',
                magnitude: holds ? 0.35 : 0.55,
                unattributed: holds
                    ? 'A survey party came back down the valley in a hurry and would not say why.'
                    : 'There are new markers on the north side of the valley, further in than they were.',
                consequences: {
                    immediate: holds ? 'The zone held.' : 'The zone is smaller than it was.',
                    tenYearsLater: holds
                        ? 'Nobody tries that side again for a generation.'
                        : 'Two more leases move inward, and nobody is told.'
                }
            }, { factions: [held.id, tester.id] });
        }
    },

    // ── An institution stops existing. ───────────────────────────────────
    {
        kind: 'faction_fell',
        weight: 3,
        apply(state, day, rng) {
            // Bind to whoever the economy has already ruined. Nobody is
            // chosen: a faction is here because it cannot pay, or because
            // there is nobody left to carry its name.
            //
            // NOT BECAUSE ITS ROLL IS SHORT. This read `members < 3`, and
            // `lost_vein` with fewer than six, off the roll - and a roll is the
            // ten or twenty people a player could come to know out of a house
            // of hundreds (`a-house-and-who-is-in-it.md`), so the test judged
            // the slice rather than the house. Measured on `shape-a` over 1,000
            // years: of the 24 houses the catalog wrote that fell, 21 fell on
            // one of those two counts, most holding hundreds of thousands of
            // stones and a member with a thousand years or more to live;
            // 3 fell broke and 1 to a war. The two counts are gone; what is left
            // of them is nobody at all to carry the name, which
            // `whetherAHouseHasFailed` reads off the house and not its roll.
            const failing = liveFactions(state).filter(f => whetherAHouseHasFailed(state, f));
            const faction = pick(rng, failing);
            if (!faction) return null;

            faction.dissolvedOnDay = day;
            const orphans = membersOf(state, faction.id);
            // THE NEXT HOUSE TAKES SOME, AND THE REST ARE ROGUES. See
            // `what-becomes-of-a-houses-people-when-it-is-gone.ts`.
            const went = releaseTheRoll(state, faction, day, ROGUE_HOUSE_FELL);

            // AND WHAT IT OWNED STOPS BEING ITS.
            //
            // This cut every member loose and left the compound ruined, and
            // said nothing about the treasury - so every object a fallen
            // house owned kept pointing at an institution that no longer
            // existed, for the rest of the world's life. Ownership here is a
            // live fact and not a label: whoever walked out with a thing owns
            // it, because there is nobody left to say otherwise, and whatever
            // nobody carried has no owner at all, which is what makes a ruin
            // a ruin. See
            // `what-becomes-of-a-houses-things-when-the-house-ends.ts`.
            //
            // Through the shared applier, because this was one of THREE places
            // a house stops existing and the only one that ran the rule. See
            // `applyWhoOwnsThemNow`.
            applyWhoOwnsThemNow(state, faction.id);

            const seat = faction.seatLocationId
                ? state.locations.find(l => l.id === faction.seatLocationId) ?? null : null;
            const changeIds: string[] = [];
            // A compound another house is still seated at is not left empty by
            // this one leaving it. A splinter is seated where its founder stood,
            // which is usually the grounds of the house it split from.
            const stillSeatedThere = seat !== null && state.factions.some(other =>
                other.id !== faction.id && other.dissolvedOnDay === null
                && other.seatLocationId === seat.id);
            if (seat && !stillSeatedThere) {
                const changed = applyLocationChange(seat, {
                    onDay: day,
                    kind: 'abandoned',
                    summary: `The ${faction.name}'s compound at ${seat.name} was left standing and empty.`,
                    causeKnown: true,
                    patch: {
                        controllingFactionId: null,
                        addTags: ['ruined'],
                        addHazards: ['formation'],
                        environment: { politicalControl: 'nobody, now' }
                    }
                });
                replaceLocation(state, changed.location);
                changeIds.push(changed.change.id);
            }

            return emit(state, 'faction_fell', day, {
                day,
                kind: 'faction_fallen',
                scale: 'regional',
                summary:
                    `The ${faction.name} ended after ` +
                    `${Math.max(0, yearOfDay(day) - yearOfDay(faction.foundedOnDay ?? day))} years. ` +
                    `${went.rogues.length} people are nobody's disciples`
                    + (went.takenIn.length > 0 ? `, and ${went.takenIn.length} were taken in elsewhere.` : '.'),
                locationId: seat?.id ?? null,
                factionIds: [faction.id],
                locationChangeIds: changeIds,
                visibility: 'public',
                magnitude: 0.85,
                unattributed:
                    'A compound up the valley has been empty for a season, and people have ' +
                    'started taking the roof tiles.',
                consequences: {
                    immediate: 'The rolls are dissolved.',
                    physical: 'The compound stands empty and the formations are unlit.',
                    losers: [{ id: faction.id, name: faction.name, role: 'dissolved' }],
                    opportunitiesOpened: ['An empty compound, and whatever is still in it.'],
                    opportunitiesClosed: ['Admission, stipends, and the library.'],
                    rumours: ['That the last elder walked out with the treasury.'],
                    tenYearsLater: 'Somebody else is living in it, and did not build it.'
                }
            }, {
                factions: [faction.id],
                locations: seat ? [seat.id] : [],
                npcs: orphans.map(n => n.id)
            });
        }
    },

    // ── A splinter. Institutions do not only die; they divide. ───────────
    {
        kind: 'faction_founded',
        weight: 3,
        apply(state, day, rng) {
            // Somebody decides it, and the people tied to them go too. See
            // `who-splits-a-house-and-who-goes-with-them.ts`.
            const split = whoSplitsAHouse(state, day, rng);
            if (!split) return null;
            const { parent, founder, leavers } = split;
            const id = `sect-splinter-${founder.id}`;
            if (state.factions.some(f => f.id === id)) return null;

            const splinter = makeFaction({
                id,
                // No article INSIDE the name. Every summary in this layer
                // supplies its own - "of the ${name}" - so a name carrying one
                // produced "of the the Wei Hall" in the middle of a biography,
                // and the catalog's own names do not carry one either.
                name: `${founder.name.split(' ')[0]} Hall`,
                kind: 'sect',
                alignment: parent.alignment,
                seatLocationId: founder.locationId,
                ranks: parent.ranks.slice(),
                resources: {
                    spirit_stones: Math.round((parent.resources.spirit_stones ?? 0) * 0.2),
                    veins: 0,
                    // A house a day old turns out nobody, so what it can put on
                    // the ground is the person who walked out with the roll.
                    // Left unset this reads zero, and a house with no vein and
                    // a zero here cannot cover its own payroll.
                    reliable_ordinal: founder.cultivation.realmOrdinal,
                    power_ordinal: founder.cultivation.realmOrdinal
                },
                description: `Split from the ${houseName(parent.name)}.`,
                foundedOnDay: day,
                tags: ['unbacked', 'recruits', 'splinter']
            });
            splinter.standing[parent.id] = -0.5;
            parent.standing[splinter.id] = -0.5;

            // THE ENEMY OF THEIR ENEMY, AND THE ONLY THING IN THIS PASS THAT ADDS A
            // POSITIVE EDGE BETWEEN TWO HOUSES.
            for (const glad of rivalsOf(state, parent)) {
                if (glad.id === splinter.id) continue;
                splinter.standing[glad.id] = SYMPATHY_AT_A_SCHISM;
                glad.standing[splinter.id] = SYMPATHY_AT_A_SCHISM;
            }

            parent.resources.spirit_stones = Math.round((parent.resources.spirit_stones ?? 0) * 0.8);
            state.factions.push(splinter);

            // AND THE BOOKS THEY WALKED OUT WITH, WHICH IS WHY THIS IS A HOUSE AND
            // NOT A BUILDING.
            librariesCarriedOutBy(state, splinter, [founder, ...leavers], day);

            // What their going stirs in the house they split from, read off the
            // rows as they stood. See `what-somebody-senior-leaving-stirs.ts`.
            const going = new Set([founder.id, ...leavers.map(n => n.id)]);
            for (const npc of [founder, ...leavers]) whatTheirLeavingStirs(state, npc, parent, day, going);

            for (const npc of [founder, ...leavers]) {
                replaceNpc(state, {
                    // As it now stands, for the reason the walk-out above gives.
                    ...(state.npcs.find(row => row.id === npc.id) ?? npc),
                    factionId: splinter.id,
                    factionRankIndex: npc.id === founder.id ? splinter.ranks.length - 1 : 1,
                    updatedOnDay: day
                });
            }

            return emit(state, 'faction_founded', day, {
                day,
                kind: 'faction_founded',
                scale: 'regional',
                summary:
                    `${founder.name} left the ${houseName(parent.name)} with ${leavers.length} others and ` +
                    `set up on their own.`,
                actors: [{ id: founder.id, name: founder.name, role: 'founder' }],
                locationId: founder.locationId,
                factionIds: [parent.id, splinter.id],
                visibility: 'public',
                magnitude: 0.6,
                unattributed:
                    'There is a second compound going up on the far side of the ridge, and the ' +
                    'people building it will not say who for.',
                consequences: {
                    immediate: `The ${parent.name} is smaller and angrier.`,
                    physical: 'A new compound.',
                    beneficiaries: [{ id: founder.id, name: founder.name, role: 'founder' }],
                    losers: [{ id: parent.id, name: parent.name, role: 'diminished' }],
                    relationshipChanges: [{ aId: parent.id, bId: splinter.id, change: 'a standing feud' }],
                    opportunitiesOpened: ['A sect that will take almost anybody, for now.'],
                    tenYearsLater: 'One of the two is clearly winning, and everyone local has an opinion.'
                }
            }, {
                factions: [parent.id, splinter.id],
                npcs: [founder.id, ...leavers.map(n => n.id)]
            });
        }
    },

    // ── The last person who could do a thing is gone. ────────────────────
    //
    // WHY THE POOL IS THE RULE RATHER THAN A TEST AFTER IT. This drew a holder
    // from everybody carrying any art at all, then threw the draw away unless
    // the art happened to be one nobody else held - and it had never fired in
    // the history of this repo. Neither rule was wrong. `pickByMortality`
    // correctly hunts people near the end of themselves; being the last holder
    // of an art is correctly a HIGH-REALM property, because a house teaches its
    // low shelves to dozens and its deepest manual to one; and a high realm is
    // an enormous lifespan. So the weight sat almost entirely off the eligible
    // set and the product of two correct rules was zero.
    //
    // MEASURED ON THE SHIPPED CATALOG (`loadCultivationCatalog`, seedWorld
    // defaults, seeds `tl-a` and `tl-b`), NOT the driver fixture:
    //
    //   people alive below the lid holding any art      991 / 1001
    //   arts held by exactly one living person           22 / 23
    //   people who are the last holder of one            12 / 13   <- the pool
    //   median realm ordinal, those people               36 / 34
    //   median realm ordinal, everybody else             10 / 10
    //   share of the mortality weight on the eligible  0.023% / 0.029%
    //   P(fire) per draw, as it was written            1.0e-5 / 1.3e-5
    //   technique_lost events in 500 played years          0 / 0
    //
    // At 0.08 draws a year that was one firing per ~1.2 million years. Drawing
    // FROM the eligible set instead leaves the acceptance roll inside
    // `pickByMortality` as the whole of the rate - about two or three per
    // millennium on this cohort's spans - so no constant was added to reach it,
    // and nobody should add one.
    //
    // AND WHAT THIS EVENT ACTUALLY CLAIMS, which the first cut got wrong in its
    // strings. `theWorldLoses` does NOT take anybody out of the world:
    // `markMissing` leaves `status` alone and tags the person, because missing
    // is not a state of a person here - `who-a-house-has-lost-track-of.ts`
    // carries the ruling, *"Missing people are still somewhere physical, just
    // the sect doesn't know."* So the art is not destroyed and the last holder
    // is alive and still carrying it. What happened is that the only person who
    // could teach it cannot be found, which is the lost art of the genre and is
    // why the rumour row about a mislabelled copy fits. The consequences said
    // *"Nobody living has been taught it"*, which was false about a living
    // person on the roll; they now say what is true.
    {
        kind: 'technique_lost',
        weight: 5,
        apply(state, day, rng) {
            // The rule IS the pool: everybody carrying something nobody else
            // alive carries. One walk of the roll, shared by every candidate.
            //
            // Not somebody anybody has already lost track of. Losing the same
            // person twice writes the same loss twice, and their house has not
            // found them since.
            //
            // `isLostTrackOf` AND NOT the tag on the person, which was the first
            // cut and was wrong in a way only a long run shows. There are two
            // marks: the world's, which sits on the person for ONE SLICE, and
            // the house's, which is durable - `who-a-house-has-lost-track-of.ts`
            // says so in its header, and the absence pass clears the first as it
            // writes the second. Reading only the person's mark, this pass found
            // the same sole holder unmarked again the next year and lost them
            // again, every year, for ever. Measured as
            // `the-hall-starts-asking` going red on a hall that asked after one
            // person five times: *says it once, and not every year forever*.
            const counts = howManyLivingHoldEachArt(state);
            const holders = theWorldsPeople(state).filter(
                n => !isLostTrackOf(state, n) &&
                    theArtsOnlyTheyHold(state, n, counts).length > 0
            );
            // Weighted the same way `elder_died` is. Going out and not coming
            // back is a thing that happens to people who were running out of
            // time anyway; somebody with seventy thousand years in front of
            // them does not simply fail to return.
            const npc = pickByMortality(rng, holders, day);
            if (!npc) return null;
            const techniqueId = pick(rng, theArtsOnlyTheyHold(state, npc, counts));
            if (!techniqueId) return null;

            const gone = theWorldLoses(npc, day, 'Went out and did not come back.');
            if (!gone) return null;
            replaceNpc(state, gone);

            // The art by the name a person would say, not by its id. The id had
            // never reached a player only because this pass had never fired.
            const artName = getTechnique(techniqueId)?.name ?? techniqueId;

            return emit(state, 'technique_lost', day, {
                day,
                kind: 'technique_lost',
                scale: 'regional',
                summary:
                    `${npc.name} was the last person anybody could name who could work the ` +
                    `${artName}, and nobody knows where they are.`,
                actors: [{ id: npc.id, name: npc.name, role: 'last_holder' }],
                locationId: npc.locationId,
                // Their own house, so `faction` visibility means the people who
                // would know. Handed nothing, `whoWasThere` falls through to
                // everybody standing nearby and the word does no work.
                factionIds: npc.factionId ? [npc.factionId] : [],
                visibility: 'faction',
                fidelity: 'partial',
                causeKnown: false,
                magnitude: 0.5,
                unattributed:
                    'The formation on the east gate has stopped working and nobody has been ' +
                    'able to restart it.',
                data: { techniqueId },
                consequences: {
                    immediate: 'Nobody who can be found has been taught it.',
                    opportunitiesClosed: ['Learning it from anybody anyone can reach.'],
                    rumours: ['That there is a copy in the archive, mislabelled.'],
                    tenYearsLater: 'It is spoken of as something the sect used to be able to do.'
                }
            }, {
                npcs: [npc.id],
                factions: npc.factionId ? [npc.factionId] : []
            });
        }
    },

    // ── Prices move, which is how most people experience politics. ───────
    {
        kind: 'market_shifted',
        weight: 10,
        apply(state, day, rng) {
            const regions = state.locations.filter(l => l.kind === 'region' && isBelowTheLid(l));
            const region = pick(rng, regions);
            if (!region) return null;
            const up = rng.chance(0.5);
            const factor = up ? rng.float(1.15, 1.9) : rng.float(0.55, 0.88);

            const changed = applyLocationChange(region, {
                onDay: day,
                kind: 'other',
                summary: up
                    ? `What ${region.name} sells got dearer.`
                    : `What ${region.name} sells got cheaper, and nobody there is pleased about it.`,
                causeKnown: false,
                patch: {
                    data: { priceFactor: Number(factor.toFixed(3)) }
                }
            });
            replaceLocation(state, changed.location);

            return emit(state, 'market_shifted', day, {
                day,
                kind: 'opportunity',
                scale: 'local',
                summary: changed.change.summary,
                locationId: region.id,
                locationChangeIds: [changed.change.id],
                visibility: 'public',
                fidelity: 'partial',
                causeKnown: false,
                magnitude: 0.3,
                unattributed: up
                    ? 'Everything in the market costs more than it did and nobody can say why.'
                    : 'The market is full of things nobody is buying.',
                // The factor is NOT repeated here. It is stored on the location
                // change this fact cites, which is the record that owns it and the
                // one anybody reading a price actually consults - nothing has ever
                // read it off the fact.
                consequences: {
                    immediate: 'Prices moved.',
                    tenYearsLater: 'The old price is what people quote when they are complaining.'
                }
            }, { locations: [region.id] });
        }
    },

    // ── A war opens now and settles later. The world generating its own
    //    future, which is what a schedule is for. ────────────────────────
    {
        kind: 'war_opened',
        weight: 5,
        apply(state, day, rng) {
            const live = liveFactions(state);
            const a = pick(rng, live);
            if (!a) return null;
            const b = pick(rng, rivalsOf(state, a));
            if (!b || a.tags.includes('at_war') || b.tags.includes('at_war')) return null;

            a.tags = a.tags.concat('at_war');
            b.tags = b.tags.concat('at_war');
            adjustStandingBetween(a, b, -0.3);

            const resolvesIn = years(rng.int(2, 25));
            // Booked through `schedule()`, whose contract this is, and written
            // back onto the world this template was handed.
            Object.assign(state, schedule(state, {
                kind: 'war_resolves',
                dueOnDay: day + resolvesIn,
                summary: `The war between the ${houseName(a.name)} and the ${houseName(b.name)} came to an end.`,
                // ── A WAR IS FOUGHT OVER GROUND, AND THIS WAS NULL ───────
                //
                // `advanceTime` fires this effect and writes the fact for it at
                // the effect's own location, and `InterruptPolicy.locationIds`
                // is what hands control back to somebody sitting there. With no
                // location, the end of a war the player has been living through
                // reached nobody standing anywhere: it was a faction row moving
                // and a line in a digest for whoever happened to be on the roll.
                //
                // The seat of the side the effect is already filed under. A war
                // has two doors and this field has room for one, so it is the
                // one the rest of the row already names rather than a choice
                // made here - and a house with no seat still resolves, at
                // nowhere, exactly as it did.
                locationId: a.seatLocationId ?? null,
                factionId: a.id,
                // THE BASELINE, AND WHY IT IS STORED RATHER THAN DERIVED. How badly
                // a house is losing is what it can put out now against what it
                // could put out on the day the fighting started, and that second
                // figure stops being recoverable the moment somebody dies. It is a
                // fact about ONE DAY, so it cannot go stale - which is the case
                // where storing is right and deriving is impossible. Everything
                // computed from it is derived on demand: see `howAHouseIsFaring` in
                // `war-melee.ts`.
                data: {
                    kind: 'war_resolution',
                    sideA: a.id,
                    sideB: b.id,
                    magnitude: 0.7,
                    openedOnDay: day,
                    musteredA: whatAHouseCanPutOut(state, a.id).summed,
                    musteredB: whatAHouseCanPutOut(state, b.id).summed,
                    ledA: highestRankAlive(state, a.id),
                    ledB: highestRankAlive(state, b.id)
                }
            }).state);

            return emit(state, 'war_opened', day, {
                day,
                kind: 'war',
                scale: 'regional',
                summary: `The ${houseName(a.name)} and the ${houseName(b.name)} are openly fighting.`,
                factionIds: [a.id, b.id],
                visibility: 'public',
                magnitude: 0.7,
                unattributed:
                    'The road east is not safe, the caravans have stopped, and there are more ' +
                    'people sleeping outside the walls than there were.',
                consequences: {
                    immediate: 'Both sides have recalled everyone they can reach.',
                    physical: 'The trade road is unusable.',
                    opportunitiesClosed: ['Travel east; the harvest contract.'],
                    opportunitiesOpened: ['Work for anyone who can fight, and pay for anyone who can heal.'],
                    rumours: ['That it is really about a vein, and the insult was arranged.'],
                    tenYearsLater: 'Whichever side lost is still smaller.'
                }
            }, { factions: [a.id, b.id] });
        }
    },

    // ── Ground stops being usable. Rare, permanent, and it makes geography.
    {
        kind: 'zone_forbidden',
        weight: 2,
        apply(state, day, rng) {
            const candidates = state.locations.filter(
                l => (l.kind === 'wilds' || l.kind === 'vein') &&
                    isBelowTheLid(l) && !l.tags.includes('forbidden')
            );
            const place = pick(rng, candidates);
            if (!place) return null;

            const { location, change } = forbidZone(place, {
                onDay: day,
                summary: `Something happened at ${place.name} and the ground has not been right since.`,
                survivalOrdinal: Math.min(29, place.thresholds.mastery + 6),
                hazards: ['corrosive', 'thin_qi'],
                causeKnown: false,
                attributedCauses: [
                    'A cultivator died here badly',
                    'An old formation finally failed',
                    'Somebody buried something'
                ]
            });
            replaceLocation(state, location);
            const holder = place.controllingFactionId
                ? state.factions.find(f => f.id === place.controllingFactionId) ?? null : null;
            if (holder) {
                holder.controlledLocationIds = holder.controlledLocationIds.filter(id => id !== place.id);
                holder.resources.veins = Math.max(0, (holder.resources.veins ?? 0) - 1);
            }

            return emit(state, 'zone_forbidden', day, {
                day,
                kind: 'zone_forbidden',
                scale: 'regional',
                summary: change.summary,
                locationId: place.id,
                factionIds: holder ? [holder.id] : [],
                locationChangeIds: [change.id],
                visibility: 'public',
                fidelity: 'partial',
                causeKnown: false,
                magnitude: 0.8,
                unattributed:
                    'Two villages on that side have moved, the animals will not go in, and the ' +
                    'people who went to look have not come back.',
                consequences: {
                    immediate: 'Nobody goes in.',
                    physical: `${place.name} is lethal to anyone local.`,
                    losers: holder ? [{ id: holder.id, name: holder.name, role: 'dispossessed' }] : [],
                    opportunitiesOpened: ['Whatever is in there, for somebody far stronger.'],
                    opportunitiesClosed: ['Everything that used to be gathered there.'],
                    rumours: ['Three different explanations, none of them checkable.'],
                    tenYearsLater: 'It is on the maps as a blank, and children are told not to.'
                }
            }, { locations: [place.id], factions: holder ? [holder.id] : [] });
        }
    },

    // ── Something comes off the ground and into a town. ─────────────────
    {
        kind: 'beast_came_down',
        weight: 10,
        apply(state, day, rng) {
            // A PLACE PEOPLE ARE, because a beast in empty wilds is not an
            // event - it is the ordinary condition of the wilds. `crowding`
            // is not consulted: what makes this worth telling is that there
            // was a town here, not how full it was.
            const towns = state.locations.filter(l =>
                l.kind === 'settlement' && isBelowTheLid(l) && !l.sealed);
            const town = pick(rng, towns);
            if (!town) return null;

            // WHAT COULD BE STANDING THERE AT ALL, off the module that already
            // decides it. Nothing new says what lives where - including the
            // ground, which `whatGroundThisIs` answers for the played hunt and
            // has to answer identically here. A beast coming down on a town in
            // the ice province and one coming down on a rice terrace were the
            // same draw, and the player would have met the difference only by
            // hunting for themselves.
            const could = beastsOnThisGround({
                sealed: false,
                onAVein: town.kind === 'vein',
                grounds: whatGroundThisIs(state, town) ?? undefined
            });
            const beast = pick(rng, could.filter(b => bandOf(b) !== 'person'));
            if (!beast) return null;

            // WHO IT REACHES. The people standing there, and the ones who can
            // answer it are the ones who do - which is why a beast that comes
            // down on a town holding a Foundation cultivator is a story and one
            // that comes down on a hamlet is a bereavement.
            const here = state.npcs.filter(n =>
                n.status === 'alive' && n.locationId === town.id && isTheWorldsToMove(n));
            const answered = here.filter(n => n.cultivation.realmOrdinal >= beast.ordinal);

            // AND WHOSE PEOPLE ARE HERE.
            //
            // The design owner, on what a stationed elder is for: they defend
            // the disciples of their own house who are here on their own
            // errands - at a distance, with their spirit sense, rather than by
            // following anybody around - and they write reports to the sect.
            //
            // Both are the same fact and neither needs machinery. Somebody
            // POSTED here is standing here, so they are already in `here` and
            // already answer it if they can; and naming their house on the
            // event is what makes the house know, because a fact that names a
            // house reaches it. That IS the report - a house does not learn
            // about a town it has nobody in.
            const watching = new Set(here
                .filter(n => n.activity?.kind === 'stationed' && n.factionId !== null)
                .map(n => n.factionId!));

            const taken: NpcRecord[] = [];
            if (answered.length === 0) {
                // Nobody there could stop it. It takes what it came for.
                const couldTake = here.filter(n => n.cultivation.realmOrdinal < beast.ordinal);
                const howMany = Math.min(couldTake.length, rng.int(1, 3));
                for (let i = 0; i < howMany; i++) {
                    const who = couldTake[i];
                    if (who === undefined) continue;
                    const at = indexById(state.npcs, who.id);
                    if (at < 0) continue;
                    const dead = theWorldEnds(state.npcs[at]!, day,
                        `Taken when ${beast.name} came down on ${town.name}.`);
                    // `taken` is what the fact below counts, so somebody it did
                    // not get is simply not in it.
                    if (!dead) continue;
                    state.npcs[at] = dead;
                    settleNpcDeath(state, state.npcs[at]!, day);
                    taken.push(state.npcs[at]!);
                }
            }

            const held = answered.length > 0;
            return emit(state, 'beast_came_down', day, {
                day,
                kind: 'catastrophe',
                scale: 'local',
                summary: held
                    ? `${beast.name} came down on ${town.name} and was put back. `
                      + `${answered.length} stood to it.`
                    : `${beast.name} came down on ${town.name}. `
                      + (taken.length === 0
                          ? 'There was nobody in it to take.'
                          : `${taken.length} did not get away from it.`),
                actors: (held ? answered : taken).slice(0, 4)
                    .map(n => ({ id: n.id, name: n.name, role: held ? 'stood to it' : 'taken' })),
                locationId: town.id,
                // The houses with somebody posted here. A house learns what
                // happens where it has people and does not learn what happens
                // where it has none, which is the whole value of a station.
                factionIds: [...watching],
                visibility: 'public',
                magnitude: held ? 0.4 : 0.55 + Math.min(0.25, taken.length * 0.08),
                unattributed: held
                    ? 'Something came out of the treeline at a town on the low road, and the '
                      + 'town is still there.'
                    : 'A town on the low road is short of people, and the ones left will not '
                      + 'say what it was.',
                consequences: {
                    immediate: held
                        ? 'The town holds, and knows who held it.'
                        : 'Fewer people, and a reason to want somebody sent.',
                    tenYearsLater: held
                        ? 'The people who stood to it are the people that town asks for.'
                        : 'The ground is worked by whoever came afterwards.'
                }
            }, {
                factions: [...watching],
                locations: [town.id],
                npcs: (held ? answered : taken).map(n => n.id)
            });
        }
    },

    // ── People leave. ───────────────────────────────────────────────────
    {
        kind: 'migration',
        weight: 8,
        apply(state, day, rng) {
            const regions = state.locations.filter(l => l.kind === 'region' && isBelowTheLid(l));
            if (regions.length < 2) return null;
            const from = pick(rng, regions);
            const to = pick(rng, regions.filter(r => r.id !== from?.id));
            if (!from || !to) return null;

            const movers = theWorldsPeople(state).filter(
                n => n.status === 'alive' && isBelowTheLid(n) &&
                    n.locationId === from.id && n.factionId === null
            ).slice(0, rng.int(3, 12));
            if (movers.length === 0) return null;

            for (const npc of movers) {
                replaceNpc(state, { ...npc, locationId: to.id, updatedOnDay: day });
            }

            return emit(state, 'migration', day, {
                day,
                kind: 'migration',
                scale: 'local',
                summary: `${movers.length} people left ${from.name} for ${to.name}.`,
                locationId: from.id,
                visibility: 'public',
                magnitude: 0.25,
                unattributed:
                    'Two of the hamlets on the low road are empty, and the fields have not been ' +
                    'turned this year.',
                consequences: {
                    immediate: 'Fewer hands, and fewer people drawing on the same ground.',
                    tenYearsLater: 'The ones who stayed cultivate slightly faster, and nobody says so.'
                }
            }, { locations: [from.id, to.id], npcs: movers.map(n => n.id) });
        }
    },

    // ── Somebody is simply not there any more, and nothing is resolved.
    {
        kind: 'disappearance',
        weight: 6,
        apply(state, day, rng) {
            const candidates = theWorldsPeople(state).filter(
                n => n.status === 'alive' && isBelowTheLid(n) && n.cultivation.realmOrdinal >= 13
            );
            // Weighted by how much of themselves is left, and this is the one that
            // mattered most: the pool is everybody above ordinal 13, which is about
            // fifty people, and the world's entire high-realm cohort lives in it.
            // Picking uniformly meant thirteen of the seventeen strongest people
            // alive walked into the hills inside three centuries. An elder
            // vanishing into seclusion and never being seen again is good xianxia
            // and should stay possible; it should not be the ordinary fate of
            // everybody who ever climbed.
            const npc = pickByMortality(rng, candidates, day);
            if (!npc) return null;
            const gone = theWorldLoses(
                npc, day, 'Went into the hills and was not seen again.');
            if (!gone) return null;
            replaceNpc(state, gone);

            return emit(state, 'disappearance', day, {
                day,
                kind: 'death',
                scale: 'personal',
                summary: `${npc.name} has not been seen since.`,
                actors: [{ id: npc.id, name: npc.name, role: 'missing' }],
                locationId: npc.locationId,
                factionIds: npc.factionId ? [npc.factionId] : [],
                visibility: 'faction',
                // The engine does not know either, and says so.
                truth: 'unresolved',
                claimedOutcomes: [
                    'died in the hills',
                    'went into seclusion and did not tell anyone',
                    'was killed over an old account',
                    'left the province'
                ],
                causeKnown: false,
                fidelity: 'rumour',
                magnitude: 0.35,
                unattributed:
                    'Somebody who used to be a fixture at the market has stopped coming, and ' +
                    'the stall has been taken over.',
                consequences: {
                    immediate: 'Their affairs are unsettled and nobody can close them.',
                    tenYearsLater: 'Treated as dead by everyone except one person.'
                }
            }, { npcs: [npc.id] });
        }
    },

    // Somebody worked on somebody.
    {
        kind: 'leverage_applied',
        weight: 12,
        apply(state, day, rng) {
            const living = theWorldsPeople(state).filter(n => n.status === 'alive' && isBelowTheLid(n));

            // A MANOEUVRE ALREADY RUNNING IS PICKED UP AGAIN.
            const continuations: { actor: NpcRecord; subjectId: string }[] = [];
            for (const person of living) {
                for (const tie of person.relationships) {
                    if (tie.kind !== 'patron') continue;
                    if (!tie.factIds.some(id => isLeverageFact(state, id))) continue;
                    const other = living.find(n => n.id === tie.targetId);
                    // Only an ATTACHMENT chain is picked up again. A purse is a
                    // transaction and finishes when it is paid; an attachment
                    // is the one that is built over visits, and it is the only
                    // one there is anything to work out about later.
                    // The `ally` row itself, not whatever else stands between
                    // them: ties are keyed by the pair AND the kind.
                    if (relationshipWith(other ?? person, person.id, 'ally') === null) continue;
                    if (!other) continue;
                    continuations.push({ actor: person, subjectId: tie.targetId });
                }
            }
            const carryOn = continuations.length > 0 && rng.next() < LEVERAGE_CONTINUATION_SHARE;
            const continuation = carryOn ? pick(rng, continuations) : null;

            const actor = continuation ? continuation.actor : pick(rng, living);
            if (!actor) return null;

            const actorFaction = actor.factionId
                ? state.factions.find(f => f.id === actor.factionId) ?? null : null;
            const hostileIds = actorFaction
                ? Object.entries(actorFaction.standing)
                    .filter(([, v]) => v <= -0.3).map(([k]) => k)
                : [];

            // The person they are already working, or - starting fresh -
            // somebody they could be standing in front of, or somebody at a
            // house theirs is at odds with. The same two reasons `killing`
            // uses, because they are the same two reasons.
            const subject = continuation
                ? living.find(n => n.id === continuation.subjectId) ?? null
                : pick(rng, living.filter(n =>
                    n.id !== actor.id &&
                    (hostileIds.includes(n.factionId ?? '') || n.locationId === actor.locationId)
                ));
            if (!subject) return null;
            const subjectFaction = subject.factionId
                ? state.factions.find(f => f.id === subject.factionId) ?? null : null;

            // WHAT IS ON THE TABLE, read off what this person has. Never a
            // free choice, and never a verb.
            const available: ApproachLeverage[] = ['none'];
            if (actor.spiritStones >= LEVERAGE_PURSE) available.push('coin');
            if (actorFaction && !subjectFaction) available.push('sect');
            if (relationshipWith(subject, actor.id)) available.push('favour');
            // Everybody always has themselves. This is the one channel with no
            // precondition, which is exactly why it is the poor man's lever.
            available.push('attachment');
            // A second visit uses the lever that worked the first time. Coming
            // back with a different one is starting again, not escalating.
            const theirExisting = relationshipWith(subject, actor.id);
            const leverage: ApproachLeverage = continuation
                ? 'attachment'
                : pick(rng, available) ?? 'none';

            // WHAT IS BEING ASKED ESCALATES WITH THE TIE.
            const built = Math.max(0, theirExisting?.standing ?? 0);
            const ask: AskWeight =
                built >= 0.6
                    ? (hostileIds.includes(subject.factionId ?? '')
                        ? 'a_betrayal' : 'against_their_interest')
                    : built >= 0.25 ? 'a_real_favour'
                        : 'a_courtesy';

            // AND WHERE THIS IS HAPPENING.
            const ground = theGroundUnderYou(
                whoHoldsTheGround(state.locations, subject.locationId),
                statusesInArea(state.statuses, state.locations, subject.locationId, day)
            );

            const result = resolveAttempt({
                actor: {
                    id: actor.id, name: actor.name,
                    ordinal: actor.cultivation.realmOrdinal,
                    charm: actor.cultivation.attributes.charm,
                    factionId: actor.factionId,
                    alignment: actorFaction?.alignment ?? null
                },
                where: ground,
                subject: {
                    id: subject.id, name: subject.name,
                    ordinal: subject.cultivation.realmOrdinal,
                    charm: subject.cultivation.attributes.charm,
                    factionId: subject.factionId,
                    alignment: subjectFaction?.alignment ?? null,
                    ranked: Boolean(subject.factionId)
                },
                onDay: day,
                ask,
                approach: { leverage, audience: 'few' },
                // The whole translation between the two tie models: the world
                // layer stores standing from -1 to +1, and what the resolver
                // wants is how consequential the tie is, which is the positive
                // half of it.
                theirTie: theirExisting
                    ? { active: true, strength: Math.max(0, theirExisting.standing) }
                    : null,
                theyWantSomethingFromYou: activeGoals(subject).length > 0,
                rng
            });

            // ONE EVENT IS A CAMPAIGN, NOT A CONVERSATION.
            let campaign = result;
            // The furthest the tie actually got. Kept apart from the final
            // outcome because a campaign that builds an attachment over three
            // visits and is turned down on the fourth has still built the
            // attachment - and reading the tie off the last result threw all
            // of it away, which is why every campaign came back refused.
            let landed = result.marks.tie ? result : null;
            let built2 = Math.max(0, theirExisting?.standing ?? 0);
            if (leverage === 'attachment') {
                for (let visit = 0; visit < LEVERAGE_VISITS_PER_YEAR; visit++) {
                    if (campaign.outcome === 'refused' || campaign.outcome === 'reported') break;
                    built2 = campaign.marks.tie?.theirs.strength ?? built2;
                    // Within one year the manoeuvre BUILDS. Cashing it in is
                    // what a later year is for, and asking for the thing on
                    // the same afternoon you finished earning it is how the
                    // campaign was destroying itself.
                    const nextAsk: AskWeight = built2 >= 0.25 ? 'a_real_favour' : 'a_courtesy';
                    const next = resolveAttempt({
                        actor: {
                            id: actor.id, name: actor.name,
                            ordinal: actor.cultivation.realmOrdinal,
                            charm: actor.cultivation.attributes.charm,
                            factionId: actor.factionId,
                            alignment: actorFaction?.alignment ?? null
                        },
                        where: ground,
                        subject: {
                            id: subject.id, name: subject.name,
                            ordinal: subject.cultivation.realmOrdinal,
                            charm: subject.cultivation.attributes.charm,
                            factionId: subject.factionId,
                            alignment: subjectFaction?.alignment ?? null,
                            ranked: Boolean(subject.factionId)
                        },
                        onDay: day,
                        ask: nextAsk,
                        approach: { leverage, audience: 'few' },
                        theirTie: { active: true, strength: built2 },
                        yourTie: campaign.marks.tie
                            ? { active: true, strength: campaign.marks.tie.yours.strength }
                            : null,
                        theyWantSomethingFromYou: activeGoals(subject).length > 0,
                        rng
                    });
                    campaign = next;
                    if (next.marks.tie) landed = next;
                }
            }

            // The arrangement is real if ANY visit landed; the final outcome is
            // what the summary and the grudge are written from.
            const took = landed !== null;
            const subjectAt = indexById(state.npcs, subject.id);
            if (subjectAt < 0) return null;

            const fact = emit(state, 'leverage_applied', day, {
                day,
                // An arrangement when it lands, a grudge when it does not. Both
                // are existing kinds; nothing new was needed for any of this.
                kind: took ? 'debt_incurred' : 'grudge_opened',
                scale: 'personal',
                summary:
                    `${actor.name} wanted something from ${subject.name}` +
                    (subjectFaction ? ` of the ${houseName(subjectFaction.name)}` : '') +
                    `. ${campaign.line}`,
                actors: [
                    { id: actor.id, name: actor.name, role: 'asked' },
                    { id: subject.id, name: subject.name, role: 'was asked' }
                ],
                locationId: subject.locationId,
                factionIds: subjectFaction ? [subjectFaction.id] : [],
                // Private by nature. Being asked is not news; being asked in
                // front of the wrong person is, and that is the audience term.
                visibility: took ? 'secret' : 'faction',
                magnitude: took ? 0.2 : 0.3,
                unattributed: took
                    ? 'Somebody who could not have afforded it last season has paid for something, ' +
                      'and is not saying who arranged it.'
                    : 'Two people had a short conversation at the edge of the market and one of ' +
                      'them walked off without finishing it.',
                consequences: {
                    immediate: campaign.line,
                    tenYearsLater: took
                        ? 'One of them is still assuming the other will help again.'
                        : 'The one who was asked has never once forgotten being asked.'
                }
            }, { npcs: [actor.id, subject.id] });

            // The marks. Written onto the world's own tie rows, carrying the
            // fact id, so the discovery template below has a causal chain to
            // read rather than a flag somebody invented for it.
            if (took) {
                state.npcs[subjectAt] = upsertRelationship(state.npcs[subjectAt], {
                    targetId: actor.id,
                    targetName: actor.name,
                    kind: leverage === 'attachment' ? 'ally' : 'client',
                    standing: landed?.marks.tie?.theirs.strength ?? 0.3,
                    note: `Came to an arrangement at ${subject.locationId ?? 'somewhere'}.`,
                    factIds: [fact.fact.id]
                }, day);
                const actorAt = indexById(state.npcs, actor.id);
                if (actorAt >= 0) {
                    state.npcs[actorAt] = upsertRelationship(state.npcs[actorAt], {
                        targetId: subject.id,
                        targetName: subject.name,
                        kind: 'patron',
                        // The asymmetry IS the record. Nothing else marks this
                        // as instrumental and nothing else needs to.
                        standing: landed?.marks.tie?.yours.strength ?? 0,
                        note: 'Useful.',
                        factIds: [fact.fact.id]
                    }, day);
                }
            } else {
                // Turned down. The aggrieved party holds it, as everywhere.
                state.npcs[subjectAt] = upsertRelationship(state.npcs[subjectAt], {
                    targetId: actor.id,
                    targetName: actor.name,
                    kind: 'rival',
                    standing: campaign.outcome === 'reported' ? -0.5 : -0.3,
                    note: 'Asked for something they had no business asking for.',
                    factIds: [fact.fact.id]
                }, day);
                andTheOtherEnd(state.npcs, subject, { targetId: actor.id, kind: 'rival', standing: -0.3, factIds: [fact.fact.id] }, day);
            }

            return fact;
        }
    },

    // And years later, somebody works out what it was.
    {
        kind: 'leverage_understood',
        weight: 5,
        apply(state, day, rng) {
            const candidates: { subject: NpcRecord; actor: NpcRecord; sinceDay: number }[] = [];
            for (const subject of state.npcs) {
                if (subject.status !== 'alive' || !isBelowTheLid(subject)) continue;
                for (const tie of subject.relationships) {
                    if (tie.kind !== 'ally') continue;
                    if (tie.standing < LEVERAGE_ATTACHED_FLOOR) continue;
                    if (!tie.factIds.some(id => isLeverageFact(state, id))) continue;
                    // The actor does NOT have to still be alive, and requiring it
                    // was measured to be the gate that kept this template at zero
                    // firings in five hundred years: qualifying ties existed, and
                    // by the time anybody looked at them the person who had built
                    // them was dead. Working out that somebody used you does not
                    // require them to be breathing, and in a world where the ledger
                    // is inherited it is the more interesting case - the account
                    // opens against a name whose heirs are the ones who will have
                    // to answer it.
                    const actor = state.npcs.find(n => n.id === tie.targetId);
                    if (!actor) continue;
                    // Did they ever return it. This is the whole tell.
                    const back = relationshipWith(actor, subject.id);
                    if (back && back.standing >= LEVERAGE_RETURNED_FLOOR) continue;
                    candidates.push({ subject, actor, sinceDay: tie.sinceDay });
                }
            }
            const found = pick(rng, candidates);
            if (!found) return null;

            const { subject, actor, sinceDay } = found;
            const subjectFaction = subject.factionId
                ? state.factions.find(f => f.id === subject.factionId) ?? null : null;
            const back = relationshipWith(actor, subject.id);
            const tie = relationshipWith(subject, actor.id);

            const worked = haveTheyWorkedItOut({
                truth: {
                    heldById: actor.id,
                    aboutId: subject.id,
                    theirStrength: tie?.standing ?? 0.5,
                    yourStrength: Math.max(0, back?.standing ?? 0),
                    ask: 'against_their_interest',
                    audience: 'few',
                    formedOnDay: sinceDay
                },
                onDay: day,
                daysElapsed: Math.max(0, day - sinceDay),
                subjectInsight: subject.cultivation.attributes.insight,
                rng
            });
            if (!worked) return null;

            const outcome = whatTheyDoAboutIt({
                truth: {
                    heldById: actor.id,
                    aboutId: subject.id,
                    theirStrength: tie?.standing ?? 0.5,
                    yourStrength: Math.max(0, back?.standing ?? 0),
                    ask: 'against_their_interest',
                    audience: 'few',
                    formedOnDay: sinceDay
                },
                onDay: day,
                actorName: actor.name,
                subjectName: subject.name,
                subjectAlignment: subjectFaction?.alignment ?? null,
                subjectRanked: Boolean(subject.factionId),
                subjectFactionId: subject.factionId
            });

            const at = indexById(state.npcs, subject.id);
            if (at < 0) return null;
            // The attachment BECOMES enmity rather than standing beside it.
            // `theTieBecomes` keeps `sinceDay`, so an eleven-year attachment
            // that turns hostile is still eleven years old - which is what makes
            // it read as betrayal rather than as dislike - and everything else
            // between the two (kin, a bond) is left where it is.
            const held = relationshipWith(state.npcs[at], actor.id, 'ally')
                ?? relationshipWith(state.npcs[at], actor.id, 'acquaintance');
            if (held !== null) {
                state.npcs[at] = theTieBecomes(state.npcs[at], actor.id, held.kind, 'enemy', day, {
                    standing: outcome.grudge.severity === 'unforgivable' ? -1
                        : outcome.grudge.severity === 'grave' ? -0.85 : -0.6,
                    note: outcome.grudge.description
                });
            } else {
                state.npcs[at] = upsertRelationship(state.npcs[at], {
                    targetId: actor.id,
                    targetName: actor.name,
                    kind: 'enemy',
                    standing: outcome.grudge.severity === 'unforgivable' ? -1
                        : outcome.grudge.severity === 'grave' ? -0.85 : -0.6,
                    note: outcome.grudge.description
                }, day);
            }
            andTheOtherEnd(state.npcs, subject, { targetId: actor.id, kind: 'enemy', standing: -0.6 }, day);

            // A righteous house takes it up, which is what turns one person's
            // account into a house's. A demonic one does not, and prices the
            // member instead. Both are read from the same alignment column.
            if (outcome.verdict.houseIsAParty && subjectFaction && actor.factionId) {
                const other = state.factions.find(f => f.id === actor.factionId);
                if (other) adjustStandingBetween(subjectFaction, other, -0.15);
            }

            return emit(state, 'leverage_understood', day, {
                day,
                kind: 'betrayal',
                scale: 'personal',
                summary: `${subject.name} worked out what ${actor.name} had wanted all along.`,
                actors: [
                    { id: subject.id, name: subject.name, role: 'used' },
                    { id: actor.id, name: actor.name, role: 'used them' }
                ],
                locationId: subject.locationId,
                factionIds: outcome.verdict.houseIsAParty && subjectFaction
                    ? [subjectFaction.id] : [],
                visibility: outcome.verdict.houseIsAParty ? 'faction' : 'secret',
                magnitude: 0.4,
                unattributed:
                    'Two people who were seen together for years are not seen together any more, ' +
                    'and only one of them will say why.',
                consequences: {
                    immediate: outcome.verdict.note,
                    losers: [{ id: subject.id, name: subject.name, role: 'used' }],
                    tenYearsLater: 'It has not stopped mattering to the one it happened to.'
                }
            }, {
                npcs: [subject.id, actor.id],
                factions: outcome.verdict.houseIsAParty && subjectFaction ? [subjectFaction.id] : []
            });
        }
    }
];

/** Follow-up visits a single year's manoeuvre can contain beyond the first. */
const LEVERAGE_VISITS_PER_YEAR = 3;

/** How often a manoeuvre already in progress is picked up again rather than a new one started. */
const LEVERAGE_CONTINUATION_SHARE = 0.75;

/** Spirit stones that count as having a purse to put on a table. */
const LEVERAGE_PURSE = 200;

/** How attached one side has to be before the shape is worth reading at all. */
const LEVERAGE_ATTACHED_FLOOR = 0.45;

/** Above this on the other side, it was returned and there is nothing to find out. */
const LEVERAGE_RETURNED_FLOOR = 0.3;

/** Whether a fact id in a tie's causal chain is one of these manoeuvres. */
function isLeverageFact(state: WorldState, factId: string): boolean {
    const fact = state.history.facts.find(f => f.id === factId);
    return fact?.data?.pressure === 'leverage_applied';
}

/** The table, for tests and for tuning. Read-only. */
export function pressureTemplates(): { kind: PressureKind; weight: number }[] {
    return TEMPLATES.map(t => ({ kind: t.kind, weight: t.weight }));
}
