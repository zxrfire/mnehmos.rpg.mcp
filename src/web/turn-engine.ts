/**
 * The game service - phase 2, and the only thing in this package that writes.
 */

import { randomUUID } from 'crypto';
import type { ManualQuality, SectAlignment } from '../schema/cultivation.js';
import type { ManualBand } from '../engine/cultivation/cultivation.js';
import type Database from 'better-sqlite3';
import {
    SATIETY_MAX,
    // The settling clock, which `stagnation_aging` kills on. Read for the ceiling
    // report so a player is told about it before it is spent, rather than in the
    // death line. `STARTING_SPIRIT_STONES` is deliberately gone from here: what a
    // run opens with is now a property of the birth rather than a constant, and
    // nine births in ten still draw about that figure. The constant stays exported
    // from the schema as the thin-county tier's own number.
    type AmbientQi,
    type Cultivator,
    type Run,
    type TimeSkipResult
} from '../schema/cultivation.js';
import { AMBIENT_QI_ORDER, ambientForBlock } from '../engine/cultivation/ambient.js';
import {
    canAttemptBreakthrough
} from '../engine/cultivation/breakthrough.js';
import { MAX_ORDINAL, rankName } from '../engine/cultivation/realms.js';
import { forStream } from '../engine/cultivation/rng.js';
import { describeBirth, drawBirth, groundDensityFor } from '../engine/birth/birth.js';
import { rollAttributes, rollSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import { rollSex } from '../engine/birth/what-sex-somebody-is-and-what-it-is-for.js';
import { rollPhysique } from '../engine/cultivation/physiques.js';
import { SATIETY_COST_PER_ACTION } from '../schema/cultivation.js';
import { primaryRoadOf } from '../schema/cultivation.js';
 import {
    ACTIONS_PER_FULL_SATIETY,
    satietyBurnMultiplier,
    stillNeedsToEat
} from '../engine/cultivation/survival.js';
import { simulateTimeSkip } from '../engine/cultivation/time-skip.js';
import { rollHerb } from '../data/cultivation/index.js';
import { BEASTS, getBeastMaterial, type Beast } from '../data/cultivation/beasts.js';
import {
    whatIsOnThisGround,
    whatComesOffTheBody,
    objectForBeastMaterial,
    readsAsSomebody,
    readTheThing,
    bandOf,
    type GroundForBeasts
} from '../engine/world/hunting-a-spirit-beast.js';
// Who answers for a beast that was killed. The whole module had no caller
// anywhere in `src/`, and with it went the only live read of `disposition` -
// the catalog sets righteous, neutral or demonic on every row and nothing in
// the running world ever asked. This is the hunt's side of that.
import {
    answerabilityOf,
    whatTheKillLeft
} from '../engine/world/who-answers-for-a-beast-that-was-killed.js';
import type { Party } from '../engine/social-leverage/what-a-deed-leaves.js';
import {
    drawFromTheGround,
    recordGroundDraw,
    whatIsLeftOutThere,
    type StockKind
} from '../engine/world/what-a-place-still-has-in-the-ground.js';
import {
    PRICES,
    cashToStones,
    findWorkForOrdinal,
    getPrice
} from '../data/cultivation/mortal-world.js';
import {
    localPrice, requireRegion, REGIONS
} from '../data/cultivation/regions.js';
import {
    treatWorstInjuries,
    untreatedInjuries,
    untreatedInjuryCount
} from '../engine/cultivation/injuries.js';
import { isPermanentWound } from '../data/cultivation/wounds.js';
import { FOUNDATION_ORDINAL } from '../engine/cultivation/realms.js';
import { type Injury } from '../schema/cultivation.js';
import { ladderOddsReport, type LadderOddsReport } from '../engine/world/ladder-odds.js';
import { round2, writeAdminAudit } from '../server/consolidated/cultivation-support.js';
import { setDb } from '../storage/index.js';
import { resetCultivationWorlds } from '../server/state/cultivation-world.js';
import { SECTS, getSect, getTechnique } from '../data/cultivation/index.js';
import {
    IMMORTAL_ITEMS,
    ImmortalGradeSchema,
    type ImmortalGrade
} from '../data/cultivation/immortal-items.js';
import {
    NOTHING_IS_GIVEN_AT_OR_ABOVE,
    STEP_CEILING_BY_GRADE,
    takeTheUnearnedStep
} from '../engine/cultivation/taking-the-unearned-step.js';
import {
    couldTheyTellItIs,
    whatTheirReferenceAffords,
    whereThisArtWasLearned,
    type ArtObserver,
    type ClaimVerdict
} from '../engine/world/recognising-whose-art-you-just-watched.js';
import {
    betrayalOfSelling,
    couldWriteOutACopy,
    manualsOf,
    masteryBarFor,
    unauthorisedPractice,
    whoseArt,
    FULLY_MASTERED
} from '../engine/world/manuals.js';
import {
    theLeakAsADeed,
    theStageAWitnessReaches
} from '../engine/social-leverage/selling-a-copy-of-somebody-elses-art.js';
import { whatTheHouseDoesAboutIt } from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import { whatTheBodyWants } from '../engine/social-leverage/what-a-body-wants-is-what-its-deciders-want.js';
import { renownReading } from '../engine/social-leverage/entry-offer.js';
import { canPointAt, highestStage, type KnowingStage } from '../engine/social/discovery.js';
import { monthsToCopy } from '../engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import { quoteSale } from '../engine/cultivation/market.js';
import { whatOneCopyIsWorth } from './who-here-is-offering-something.js';
import { capOf, classOf } from '../data/cultivation/techniques.js';
import { DAYS_PER_YEAR, NO_MANUAL_CEILING, carryingCapacityFor, techniqueCeiling } from '../engine/cultivation/cultivation.js';
import { getSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import { getMembersOf } from '../data/cultivation/members.js';
import {
    getSectsTeaching
} from '../data/cultivation/sects.js';
import {
    APEX_INSTITUTIONS,
    COURTS
} from '../data/cultivation/hierarchy.js';
// `OPENLY_OR_IN_SECRET` moved out of `catastrophe.ts` into `standoff.ts` while
// this was being written. Imported from where it lives rather than from the
// file it used to live in.
import {
    handleConsumePill,
    handleInventory,
    handleListRecipes,
    handleRefine
} from '../server/consolidated/alchemy-manage.js';
import { handleCultivate } from '../server/consolidated/cultivation-manage.js';
import { handleMarket, handleWork, standingOf } from '../server/consolidated/cultivation-mortal.js';
import { SECT_BONUS_PER_RANK } from '../server/consolidated/cultivation-manage.js';
import { handleAssess } from '../server/consolidated/cultivation-perception.js';
import { handleGuest } from '../server/consolidated/sect-guest.js';
import { applyProbation, probationOf, recallDueFor } from '../server/consolidated/sect-probation.js';
import {
    handleJoin,
    handleLeave,
    handleSiphon,
    handleList,
    handlePromote,
    handleStanding,
    handleStipend,
    // The two bars `handlePromote` itself gates on. Read rather than restated,
    // so what the ceiling report tells a player about their next seat and what
    // the promotion actually enforces cannot drift apart.
} from '../server/consolidated/sect-manage.js';
import {
    handleAdmission,
    handleCurriculum,
    handleExpel,
    handleOrder,
    handleRecruit
} from '../server/consolidated/sect-leadership.js';
import {
    handleResolve
} from '../server/consolidated/combat-manage.js';
import {
    copiesHeldBy,
    handleLearn,
    handleListAvailable,
    handlePractise,
    recordACopyHeld
} from '../server/consolidated/technique-manage.js';
import {
    manualsAStallCarries
} from '../engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import {
    FLAG_NAME_TAKEN,
    ensureCultivationDb,
    addToPouch,
    discoveryContextFor,
    listCarriedArtifacts,
    listPouch,
    removeFromPouch,
    type PouchEntry,
    type PouchItemKind,
    isGuidingErrorBody,
    listTolls,
    persistFoundation,
    readFlag,
    writeFlag,
    tollConditionsFor,
    type CultivationRepos
} from '../server/consolidated/cultivation-support.js';
import { getArtifact } from '../data/cultivation/artifacts.js';
import { applyTimeSkip } from './apply.js';
import { settleWhatTheyWereCarrying, type EstateOutcome } from './estate-settlement.js';
import { somebodyDidThis } from '../engine/world/estate-at-death.js';
import {
    DEFAULT_CULTIVATION_DAYS,
    DEFAULT_ERRAND,
    DEFAULT_SECLUSION_DAYS,
    DEFAULT_WORK_DAYS,
    GATHERING_DAYS,
    HUNTING_DAYS,
    MAX_CULTIVATION_DAYS,
    TRAINING_DAYS,
    DEFAULT_RECALL_INTENT,
    DEFAULT_PASSAGE_INTENT,
    DEFAULT_OATH_INTENT,
    RECALL_INTENTS,
    parseCount,
    parseIntent,
    durationAskedFor,
    type ActionName,
    type PlannedAction,
    type RecallIntent
} from './actions.js';
import {
    theClauseThisTurnDidNotRun,
    sayingWhatWasNotDone,
    theStructureLineFor
} from './the-part-of-the-sentence-that-was-not-run.js';
import { carryWhatOnlyTheSentenceKnows } from './planned-action.js';
import {
    PROVISION_COST_STONES,
    whatFeedingThisStretchCosts,
    type ProvisioningPlan
} from './what-feeding-a-stretch-of-seclusion-costs.js';
import {
    holderOf,
    linesDownward,
    residentAbove,
    theTwoWaysDown,
    theTwoWaysStructure,
    type Resident
} from './above.js';
import { standInTheWorld } from './the-player-as-a-row-the-world-can-invite.js';
import { DAO_GROUND_TAG } from '../engine/world/how-a-cultivator-comes-by-a-road.js';
import { FOUND_BY_PROSPECTING_TAG } from '../engine/world/how-the-world-keeps-finding-more-ruins.js';
import {
    positionIn,
    rankAndIndex,
    spendStanding
} from './standing.js';
// Saying no to what the house asked. `pending-summons.ts` keeps the ask and
// prices the refusal; `resolveAct` is the one procedure that spends the
// standing and reports the escalation, the same one every leadership verb runs
// through. Nothing about a refusal is resolved here - this file chooses which
// branch and composes the sentence.
import { resolveAct } from '../engine/cultivation/leadership.js';
import {
    clearPendingSummons,
    priceOfRefusing,
    readPendingSummons,
    summonsIsOverdue
} from './pending-summons.js';
// Taking a thing the house owns. The act and the reasoning are there; what is
// here is the sentence, the two facts about the played world a pure function
// cannot have, and the writes.
import { portfoliosIn } from '../engine/social-leverage/authority-for-an-order.js';
import {
    type APortfolio,
    whatTheyHold,
    whoAnswersAbout
} from '../engine/social-leverage/what-an-elder-is-in-charge-of.js';
import {
    THE_ROOM_COMPLAINTS_GO_TO
} from '../engine/social-leverage/reporting-what-you-saw.js';
// Somebody walking up the hill with the player's name, and the same rows read
// from the other end by whoever holds the room complaints go to.
import {
    complaintsBroughtTo,
    reportWhatTheySaw,
    settleAComplaint,
    whoSawIt
} from './false-decree-reports.js';
import type { ContactPerson } from '../engine/encounters/contact.js';
import type { HousePosition } from './standing.js';
import {
    THE_HOUSE_ANSWERS,
    aTakenCopyOf,
    takeFromYourOwnHouse,
    whatThisHouseHolds,
    whichHoldingTheyMeant
} from './house-property-theft.js';
import {
    knownTechniqueNames,
    nearbyNames,
    pouchNames,
    resolveAnything,
    resolveCultivator,
    worldLocationFor,
    type ResolvedEntity,
    resolveHerb,
    resolveKnownPlace,
    resolveParty,
    resolvePill,
    resolvePlace,
    resolvePrice,
    resolveRecipe,
    resolveSect,
    resolveTechnique,
    matchScore,
    MATCH_THRESHOLD,
    type KnowledgeScope
} from './entities.js';
import { KnowledgeGate, loosePlaceKey, placeKey, type AwarenessRow } from './knowledge.js';
import {
    LegacyLedger,
    pouchStacks,
    nameOfStack,
    whatThisRunHasPutAside
} from './leaving-things-for-the-next-life.js';
import { whichHavingWasAskedAbout } from './inventory-phrasings.js';
import { handOver } from './handing-somebody-a-thing.js';
import {
    SiteLedger,
    // What the GROUND does, before any gate somebody built. Two of the three
    // ways the catalog closes ground had never fired for a player.
} from './trials.js';
import {
    whereThisFightStands
} from '../engine/cultivation/unfinished-fight.js';
import {
    fightView,
    theFightStillStands,
    whatTheySaidInTheFight,
    type StandingFight
} from './fight-answers.js';
import { quotePouchSale, type SaleLot } from '../engine/cultivation/market.js';
import { getHerb, type Herb } from '../data/cultivation/herbs.js';
import { PILLS, getPill } from '../data/cultivation/pills.js';
// Above a certain grade a pill has a value and no price. The refusal that says
// so already existed and nothing asked it.
import { cashRefusalReason } from '../engine/cultivation/buying-and-bartering-pills.js';
import { askedAbout } from './asked.js';
import {
    selfFactFromTopic,
    whatTheySayAboutThemselves
} from '../engine/social/what-somebody-knows-about-themselves.js';
import {
    THE_ANSWER_IS_TO_GO,
    THE_ANSWER_IS_TO_KEEP_SITTING,
    crossroadsView,
    stillStands,
    type SeclusionCrossroads
} from './choosing-what-to-do-when-a-seclusion-is-broken.js';
import {
    offerHearing,
    othersPresent,
    recordHearing,
    type AnswerReach,
    type Hearing,
    type HearingIntent
} from './hearsay.js';
import { askAround, factsForNews } from './asking-what-people-are-saying.js';
// The other direction of the same act: the player carrying news of a wrong TO
// somebody, rather than a square repeating one in front of them. Same join,
// same ledger, same rule that the account opens against whoever was named.
import { whoTheClaimBlames } from './telling-a-wrong.js';
import {
    couldPointAtIt,
    factsForTelling,
    whatATellingLandsOn
} from './what-a-telling-lands-on.js';
import { facesFromHome } from './who-a-life-like-this-grew-up-knowing.js';
import type { OriginTierKey } from '../engine/cultivation/origin.js';
// What a year of somebody's life earns, which is what bounds a purse-lift.
// See `whatALiftTook`.
import { observableHere, observedLine } from './practices.js';
import {
    acceptDuty,
    PLAYER_ROLL_IDENTITY,
    arrivableForSpan,
    completeDuty,
    dutyFromOffer,
    refuseDuty,
    fitOf,
    seekerFor,
    sectBoardFor,
    writeObligation,
    rosterFor,
    type DatabaseHandle,
    type DutyLedgerInput
} from './encounters.js';
// The three reads that answer a stuck player. Each is a renderer over numbers
// computed elsewhere; see the banner in each file for what it may and may not
// say. Wired here because this is where the state they restate is already read.
import {
    type RequestKind
} from './what-a-request-asks-and-of-whom.js';
import {
    type RequestCosting
} from './what-asking-this-person-for-this-would-cost-them.js';
import {
    createObligation,
    settleObligation,
    type OathCause,
    type ObligationRecord
} from '../engine/social/grudges.js';
import { obligationFromRow, type ObligationRow } from '../storage/repos/obligation.repo.js';
// What is WRONG with a place, as against what is still in the ground under it. The
// area-status layer had no importer anywhere in `src/web`, so a famine, a shut pass
// or a worked-out district changed prices and danger and said nothing. THE THREE
// WAYS OF COVERING GROUND THAT ARE NOT WALKING
import {
    adjustCountedHolding,
    conveyanceSoldAs,
    priceRowForSomethingToRide,
    countedConveyancesHeld,
    countedHoldingKey
} from '../data/cultivation/what-a-house-moves-its-people-on.js';
// ── AND A WORD GIVEN, CARRIED, OR NOT KEPT ───────────────────────────────
import { openOathsHeldBy } from './encounters.js';
import { whatWalkingOutOfItCosts } from '../engine/social-leverage/what-would-settle-an-account-this-heavy.js';
import {
    THE_OATHWRIGHT_HOUSE,
    THE_OATHWRIGHT_WILL_NOT_WITNESS_FOR,
    WHAT_RUNNING_COSTS,
    WHAT_THE_END_OF_A_TERM_LEAVES,
    WHERE_IT_WAS_SWORN_MAY_MATTER_AND_NOBODY_CAN_SAY,
    theOathwrightWouldWitnessFor
} from '../data/cultivation/what-an-indenture-is-and-what-happens-when-it-ends.js';
// The pricing half of the deed module, without the record-opening half. It is
// exported separately for exactly this: a caller that already knows who holds
// what, and needs only the weight, priced from what the deed COST against what
// the payer had. See `whatTheWrongedPartyDid`.
// What a look at a PERSON is worth, which is the reference axis `trust.md`
// keeps apart from the perceptual one. Read in `investigate`.
import type { AttemptResult } from '../engine/social-leverage/index.js';
// The third discovery channel: you make somebody tell you, and standing decides
// whether that works. An ask with a different subject - there is no resolver in it,
// and `resolveAttempt` below is the only thing that settles one. The perceptual
// half of discovery, beside the social one above it. See that module's banner for
// the line between them: it gives the world and never gives people. The fourth, and
// the one a player asks first: what kinds of thing are live at all, standing here,
// in this state. Prompts rather than a menu - see the banner in the module for why
// that distinction is the whole design.
import {
    whatIsWorthDoingStandingHere,
    theMostPressing,
    linesFor,
    ASKING_WHAT_IS_POSSIBLE,
    ABOUT_A_MANUAL
} from './what-is-worth-doing-standing-here.js';
// A refusal is finished when it names the thing that would work. This is that,
// for wounds - the one axis where the engine was right at every step and silent
// at the step that mattered.
import {
    whatWouldCloseThisWound,
    whatToSayAboutTheCure
} from './what-would-close-this-wound.js';
// The strongest environmental lever in the game, stated in the one place the
// rate itself reads. See the file header for the measurement that forced it.
import { howCrowdedThisGroundIs, type CrowdingRead } from './how-crowded-this-ground-is.js';
// Reading a vein is a skill and it arrives with the ladder. The measurement
// above is unchanged; this decides how much of it the person standing on it
// can actually make out, and who could read it for them.
import { READS_A_VEIN, groundAsPerceivedRead } from './what-you-can-tell-about-the-ground.js';
// The world uncovers closed ground and nothing player-facing read it.
import {
    groundUnderfoot,
    howAPlayerStands,
    thingsCarriedThatTeachARoad
} from './ground-that-teaches-a-road.js';
import {
    readTheWall
} from './what-is-posted-on-the-wall-here.js';
// `billsOnTheWall` and not `readTheWall` for the affordance gathering below.
// The two answer the same question and only one of them WRITES: reading the
// wall grants every house on it through `learnIfNew`, and this runs on every
// state read, so using it there would hand a player the whole province by
// standing still. The derivation is pure; the granting stays where somebody
// actually walked over and looked.
import {
    whatIsBeingOfferedHere,
    readWhatIsOnOfferHere,
    linesForWhatWillNotMove
} from './who-here-is-offering-something.js';
import {
    WHY_THEY_ARE_SELLING,
    type AnOfferStandingHere
} from '../engine/world/what-somebody-standing-here-would-part-with.js';
import { assessAcquisition, type AcquisitionRoute } from '../engine/encounters/index.js';
import type {
    ArrivableFact,
    DutyCandidate
} from '../engine/encounters/index.js';
import { unattributedTextOf } from '../engine/world/digest.js';
import { type RosterEntry } from '../storage/repos/cultivator.repo.js';
import {
    advanceWorldForCultivator,
    saveWorldForRun,
    worldForRun
} from '../server/state/cultivation-world.js';
import { planNextRun, recordRun, lastFinishedRun } from '../engine/world/legacy.js';
import type { WorldState } from '../engine/world/world-state.js';
// A finished pressure model that had no route from the player to it. The
// resolver reads  and never , which is the whole design.
//
// `whatFollowsFromTheBout` is the same shape for a fight two people arranged:
// the wound is the resolver's and is untouched, and what an agreement changes
// is who holds an account about it afterwards.
import {
    // Who this particular person is about parting with things, which the resolver
    // would derive on its own. Read here so the PROSE can say it: a term in an odds
    // breakdown is legible to somebody reading the mechanical channel and invisible
    // to somebody reading the sentence, and the ruling this serves is that a
    // generous elder should READ as generous. What the person on the other end does
    // about having been coerced, lied to or leaned on. Decided after the attempt
    // and reading only what the resolver decided; see `whatTheWrongedPartyDid`.
    type Wrong
} from '../engine/social-leverage/index.js';
// The board's own exchange rate, in closed form. See the function's comment.
import { contributionPerStoneOverDays } from '../engine/encounters/duties.js';
// The board's own word for a tier. `who-goes-out-for-a-house-and-what-comes-back.ts`
// had zero references anywhere in `src/`, so a board printed no tier at all -
// and the tier is the first thing a person reads off a notice.
import {
    isImpossibleTier,
    tierNameFor
} from '../engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import {
    openLedgerBetween,
    recordTheTieAnAttemptLeft
} from './encounters.js';
import type { ApproachLeverage } from '../schema/cultivation.js';
import type { GroundConditions } from '../engine/cultivation/cultivation.js';
import { npcsAt, npcsInFaction } from '../engine/world/world-state.js';
// The seventh term of the attempt resolver, and the last one no caller here
// had ever supplied. See `what-they-want-that-you-could-reach.ts` for what it
// may read and, more importantly, for the one thing it refuses to.
import {
    whatTheyWantThatYouCouldReach
} from '../engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';
// A match, a refusal and a child. Every function it exports is a join onto
// something that already existed and had no caller; see the directory's README. The
// world's own bar for a tie that decides what somebody does. Read, never restated -
// see `whetherTheyGoAlongWithIt`. The favour that skips an admission bar, and the
// catalog that says which houses will take one. Both have been complete since they
// were written and neither has ever been reachable by the person playing.
import type {
    AWantYouCouldReach
} from '../engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';
// A played deed goes into the world's own record, not only into the ledger.
// See the module header for the measurement: before it, three player actions
// in the whole game wrote a world fact, and every propagation system in the
// repo - digest, rumour, hearsay, the market repeat - reads that table alone.
import {
    aDeedEntersTheWorld
} from '../engine/world/a-deed-enters-the-world-as-a-fact.js';
// The owner's two axes: severity of the wound, realm of the wounded.
import {
    medicineNeededFor,
    medicineRank,
    medicineReaches
} from '../engine/cultivation/what-grade-of-medicine-a-wound-needs.js';
// The first concrete thing rank buys: days a year on the house's own ground.
import {
    groundEntitlementFor,
    roomsHeldBy,
    type GroundClaimant,
    type GroundEntitlement
} from '../engine/world/the-ground-somebody-is-actually-standing-on.js';
import type { LocationRecord } from '../engine/world/locations.js';
// The ONE banding table, from `qi-scale.ts`. A second one in the encounter
// tokens is how an encounter line and the sheet beside it came to disagree
// about the same ground; this read is not going to be the third.
import { QI_DENSITY_DEFAULT, QI_DENSITY_MAX } from '../engine/world/qi-scale.js';
import { whatDidNotHappen } from './unresolved-attempt-denials.js';
import { theSetThisNames } from './acts-over-a-set.js';
import {
    theDescriptionThisIs,
    whoTheDescriptionFits
} from './a-target-can-be-a-description.js';
import {
    factsForEat,
    factsForGather,
    factsForInteraction,
    factsForCompany,
    factsForLook,
    factsForDao,
    factsForHolding,
    factsForRecall,
    factsForRecognisingAnArt,
    factsForTreatment,
    factsForUnsupported,
    type Company,
    describeAmbientPerceived,
    factsForRefusal,
    factsForStatus,
    factsForGroundTime,
    factsForTimeSkip,
    factsForToolResult,
    humanDays,
    placeName,
    rungAndOrdinal,
    sayThisWhateverTheNarratorDoes,
    type EngineFacts
} from './facts.js';
import {
    canExistBeyondTheLid,
    evaluateLidTransit,
    resolveDescentStrikes
} from '../engine/cultivation/existence.js';
import {
    BREATHS_IN_THE_LOWER_REALM,
    OBJECT_CEILING_BELOW_THE_LID,
    maxHpForOrdinal,
    maxQiForOrdinal
} from '../engine/cultivation/realms.js';
// Aliased because this package already has a `descend` method and a `sendAcross`
// would read as one too. The world functions are the authority; the methods
// beside them are wiring, and the names should say which is which.
import {
    descend as worldDescend,
    sendAcross as worldSendAcross
} from '../engine/world/immortal-world.js';
import { daoOf } from '../engine/cultivation/dao.js';
import { effectiveCapOf } from '../engine/cultivation/escapes.js';
import { stagesHeldBy } from './stages.js';
import { PlayLog, type LogEntry } from './log.js';
import type { Narrator } from './narrator.js';
// One sentence can contain a plan. The law that bounds how much of the player's
// life it may spend lives in this module, not here; what `game.ts` owns is
// running the steps in order against the live world. See `carryOutThePlan`.
import {
    foldTheCallsIntoOneTurn,
    sayingWhatTheBoundCutOff,
    sayingWhereItStopped,
    stepsOfThePlan,
    theQuestionStillStands,
    carryingTheReferentForward,
    howTheStepWent,
    whatTheChoiceFoundNobody,
    whatTheChoiceLandedOn,
    whatTheChoiceLandedOnStructurally,
    sayingWhatIsStillToCome,
    sayingWhatItCostTheRest,
    sayingWhatTheReadingDropped,
    theRowForAChoice,
    theRowForADroppedClause,
    theseWereThePlayersOwnWords,
    theRowForAStatedReason,
    theRowForAStepOverTheBound,
    theRowForSomethingStillToCome,
    theRowThatAsksWhichFirst,
    theRowForAResolvedPronoun,
    theRowThatOpensAStep,
    theThingThisStepNamed,
    theRowThatSaysWhereItStopped,
    whatTheQuestionAsks,
    whatTheQuestionAsksStructurally,
    whatThisTurnMayRun,
    whichOneTheyChose,
    type ASelection,
    type PlanStep,
    type PlanWithSteps,
    type WhichComesFirst
} from './a-sentence-can-be-more-than-one-call.js';
// One turn of memory, so "keep at it for ten years" and "I will take the
// cheaper one" have something to refer to. The record is held on this service
// beside `crossroads` and `whichComesFirst`; what it means is that module's.
import {
    carryingOnFromTheLastTurn,
    describeTheLastTurn,
    nothingToCarryOnWith,
    resolvingAgainstTheLastTurn,
    sayingWhatItWasTakenToMean,
    sayingWhatWasCarriedOn,
    theLastTurnStillStands,
    theRowForAResolvedReference,
    theRowForCarryingOn,
    theRowForNothingToCarryOnWith,
    theSentenceCarriesOn,
    withoutSayingTheSameThingTwice,
    type ThingNamed,
    type WhatTheLastTurnDid
} from './last-turn-memory.js';
import { announceMode } from './which-mode-this-session-is-playing-in.js';
import { composeStateSummary } from './prompt.js';
import {
    handleAdminManage,
    isAdminModeEnabled,
    parseAdminCommand,
    readAForcedVerb,
    type ForcedVerbLine
} from '../server/consolidated/admin-manage.js';
import {
    FORCEABLE_DECISIONS,
    theAttemptInFlight,
    whatWouldArrangeIt,
    withTheAttemptLanding
} from '../server/consolidated/forcing-an-attempt-to-land.js';
import {
    cultivatorView,
    derivedView,
    ledgerRowView,
    refusalText,
    rosterRowView,
    runView,
    worldRosterRow,
    daoView,
    type LedgerRowView,
    type RosterRowView,
    type RunView
} from './view.js';
import { type ObligationDb, ledgerAbout } from '../storage/repos/obligation.repo.js';
import { whatTheWorldHoldsAbout } from './personal-record.js';

// TURNING A RESULT INTO SENTENCES MOVED OUT
import {
    addHearing,
    MAX_LOGGED_EVENTS,
    narrationCall,
    refused,
    reportFromDigest,
    routingCall,
    skipCalls,
    stonesNamedIn,
    structureCalls,
    summariseToolBody,
    tollCalls,
    withoutTheHandlerName,
    withoutTheOverride,
    worldCalls
} from './tool-result-prose.js';

// ── THE DEPLOYMENT'S OWN NUMBERS MOVED OUT ───────────────────────────────
//
// Character creation, what an action costs in days and focus, and how prepared
// a crossing counts as, are in `turn-constants.ts` now. Re-exported below so
// this module's export surface is what it was.
import {
    BASE_HP,
    BASE_QI,
    CALLING_IN_A_FAVOUR,
    DELIBERATE_PREPARATION,
    ENTERING_DAYS,
    ENTERING_FOCUS,
    GATHERING_FOCUS,
    HP_PER_MIGHT,
    HURRIED_BELOW_DAYS,
    MEAL_COST_STONES,
    PROVISIONED_PREPARATION,
    QI_PER_INSIGHT,
    RAISING_FOCUS,
    SEALED_PREPARATION,
    SHORT_ACTION_DAYS,
    STARTING_AGE,
    STARTING_LOCATION,
    TRAVEL_FOCUS,
    TREATMENT_DAYS,
    TREATMENT_FOCUS,
    WAITING_FOCUS,
    WRONG_BEHIND_INTENT
} from './turn-constants.js';
import {
    FLAG_LAST_ADDRESSED,
    FLAG_MASTER,
    FLAG_RATIONS_HELD,
    FLAG_STEP_TAKEN
} from './flag-keys.js';
import { wholeWorkVolumes } from './manual-volumes.js';
import { whatIsWrongWithThisGround } from './ground-status-lines.js';
import { whoAnswersForThisGround } from './ground-holder-lines.js';
import { recordPerception } from './shown-this-turn.js';
import {
    theBearingsThisTurnCanRead,
    whatThePeopleHereAreAnswering,
    whoThePlanPointedAt,
    type BodyInAFight,
    type DeclaredMovement
} from './scene-person-readings.js';
import {
    howStandingHerePutIt,
    whoBeingHereIntroducesYouTo
} from '../engine/world/being-on-their-ground.js';
import { situatedReads } from './situated-reads.js';
import { seclusionVerbs } from './seclusion-verbs.js';
import { crossingVerb } from './crossing.js';
// `doorScaleOverStretch` moved with the seclusion verbs, whose only reader it
// is. Re-exported so this module's export surface is what it was.
export { doorScaleOverStretch } from './seclusion-verbs.js';
import { combatVerbs } from './combat-verbs.js';
import {
    theirHalfOfTheRite,
    whyTheRiteWillNotOpen
} from './an-art-that-needs-both-of-them.js';
// 护法 - standing over somebody else's crossing. The giving half of the verb
// surface, and the whole of `standing-guard-over-somebody-elses-crossing.ts`,
// which had no caller anywhere in `src/`.
import { guardVerbs, GUARD_IS_A_QUESTION } from './standing-guard.js';
import { craftVerbs } from './craft-verbs.js';
import { investigateVerb } from './investigate-verb.js';
import { askingVerbs } from './asking-verbs.js';
// Whose the thing is, asked of the world before anything calls a taking a theft.
import { takingVerbs } from './a-taking-is-decided-by-ownership.js';
import { travelVerbs } from './travel-verbs.js';

export {
    BASE_HP,
    BASE_QI,
    CALLING_IN_A_FAVOUR,
    DELIBERATE_PREPARATION,
    ENTERING_DAYS,
    ENTERING_FOCUS,
    GATHERING_FOCUS,
    HP_PER_MIGHT,
    HURRIED_BELOW_DAYS,
    MEAL_COST_STONES,
    PROVISIONED_PREPARATION,
    QI_PER_INSIGHT,
    RAISING_FOCUS,
    SEALED_PREPARATION,
    SHORT_ACTION_DAYS,
    STARTING_AGE,
    STARTING_LOCATION,
    TRAVEL_FOCUS,
    TREATMENT_DAYS,
    TREATMENT_FOCUS,
    WAITING_FOCUS
};
import type { WorldReport } from './tool-result-prose.js';

// Re-exported so this module's export surface is what it was before the move.
export { reportFromDigest, stonesNamedIn, withoutTheHandlerName, withoutTheOverride };
export type { WorldReport };

// ── THE PRICE BOARD MOVED OUT ────────────────────────────────────────────
//
// `MarketPrice`, `MORTAL_CATEGORIES`, `MARKET_LINES`, `boardSample`, `priceOf`,
// `describePurseCash` and `MARKET_CATEGORIES` are in `market-prices.ts` now.
// What a board line says is its own reason to change, and two callers here
// depend on the two of them agreeing.
import {
    boardSample,
    MARKET_CATEGORIES
} from './market-prices.js';
import type { MarketPrice } from './market-prices.js';

// THE WIRE SHAPES AND THE REFUSAL MOVED OUT
import { GameError } from './turn-wire-shapes.js';
import { matchVerbs } from './match-verbs.js';
import { daoPartnerVerbs } from './what-a-dao-partner-is-for.js';
import { siteVerbs } from './site-verbs.js';
import { institutionVerbs } from './institution-verbs.js';
import type {
    ActResult,
    BreakthroughApiResult,
    CultivateResult,
    Execution,
    GameServiceOptions,
    StateView,
    ToolCallRecord
} from './turn-wire-shapes.js';

export { GameError };
export type {
    ActResult,
    BreakthroughApiResult,
    CultivateResult,
    GameServiceOptions,
    StateView,
    ToolCallRecord
};

/** Spirit stones for one ration. A ration refills the belly to full: 50 days. */
/**
 * Whose database is currently the ambient one.
 */
let ambientDb: Database.Database | null = null;

/**
 * Phrases that point at a person rather than naming one.
 */
const POINTING = /^(?:the |that |this |a |an |some )?(?:nearest |closest |nearby |other |old |young |first )*(?:someone|somebody|anyone|anybody|cultivator|cultivators|person|people|man|woman|men|women|elder|stranger|passerby|local|villager|guard|steward|merchant|trader|monk|beggar|one|fellow|him|her|them|they|everyone|everybody|all of them|the lot of them|every person|the rest of them)(?: here| nearby| about| around| present| in the room| in front of me| in the square)?$/i;

/**
 * A word that refers BACK to somebody, rather than describing anybody.
 */
const A_PRONOUN_FOR_SOMEBODY_ALREADY_NAMED =
    /^(?:him|her|them|they|his|hers|their|theirs)$/i;

/**
 * An Unearned Step in the pouch, with the grade it was made at.
 */
function theUnearnedStepIn(
    itemId: string
): { id: string; name: string; grade: ImmortalGrade } | null {
    const [id, grade] = itemId.split(':');
    const item = IMMORTAL_ITEMS.find(row => row.id === id);
    if (!item || item.effect !== 'promote_realm') return null;
    const parsed = ImmortalGradeSchema.safeParse(grade);
    return {
        id: item.id,
        name: item.name,
        // A copy with no grade written on it is the commonest one in the world.
        // `knownByGrade` is 1 higher, 3 middle, 9 lower.
        grade: parsed.success ? parsed.data : 'lower'
    };
}

/**
 * A pointer that names no role at all, which is the commonest one typed.
 */
const POINTING_AT_NOBODY_IN_PARTICULAR = /\b(?:someone|somebody|anyone|anybody)\b/i;

/**
 * Pointers that are a RANK rather than a description, and must land on somebody who
 * actually holds it.
 */
const POINTING_AT_A_RANK = /\b(elder|disciple|master|warden|head)\b/i;

/**
 * Kept at this path for every importer that already reads it. The figure -
 * and the whole of the provisioning arithmetic around it - now lives in
 * `what-feeding-a-stretch-of-seclusion-costs.ts`, so the seclusion picker can
 * price a stretch out of the same function that spends the stones.
 */
export { PROVISION_COST_STONES };

/** What a thing costs, in whichever currency it is actually sold in. */
/**
 * How many lines of a price board get read out.
 */
/**
 * What a donation is worth against the same money earned by serving.
 */
const DONATION_DISCOUNT = 1 / 3;

/** Reference span when a house is offering nothing to take a median of. */
const DEFAULT_DUTY_DAYS = 20;

/**
 * The interact intents that are ATTEMPTS TO MOVE SOMEBODY.
 */
const ATTEMPT_INTENTS: ReadonlySet<string> = new Set([
    'bribe', 'threaten', 'seduce', 'deceive', 'negotiate', 'interrogate', 'recruit',
    // Taking something off a person, which is an attempt on them whatever else
    // it is. It resolves through the same machine and at the same price as
    // leaning on one; what separates it is what it LEAVES, and that is decided
    // in `recordWhatTheAskLeft` off the closed wrongs table rather than here.
    'steal'
]);

/**
 * What the pill just bought will not close, said on the receipt.
 */
function whatThisPurchaseWillNotReach(
    cultivator: Cultivator,
    pillId: string,
    regionId: string
): { lines: string[]; structure: string[] } {
    const none = { lines: [], structure: [] };
    const bought = getPill(pillId);
    if (!bought || bought.effect !== 'treat_injury') return none;

    // Permanent wounds are excluded for the reason `alchemy-manage.ts` gives:
    // `treatWorstInjury` skips them at every grade, so counting them here would
    // have the receipt promise a cure that does not exist.
    const mendable = untreatedInjuries(cultivator.injuries)
        .filter(injury => !isPermanentWound(injury.woundType));
    if (mendable.length === 0) return none;

    const beyond = mendable.filter(injury =>
        !medicineReaches(bought.grade, injury.severity, cultivator.realmOrdinal));
    if (beyond.length === 0) return none;

    const needed = beyond
        .map(injury => medicineNeededFor(injury.severity, cultivator.realmOrdinal))
        .sort((a, b) => medicineRank(b) - medicineRank(a))[0];
    const cure = whatWouldCloseThisWound(
        beyond, cultivator.realmOrdinal, cultivator.spiritStones, regionId);
    const reached = mendable.length - beyond.length;

    // Said in whichever of the two shapes is TRUE. A pill that closes two of
    // three wounds and cannot touch the third is not a wasted pill, and telling
    // somebody it will "close nothing" is the same species of falsehood as
    // telling them nothing at all - it just points the other way.
    const whatItMisses = beyond.length === mendable.length
        ? (mendable.length === 1 ? 'the wound you are carrying' : 'any of the wounds you are carrying')
        : `${beyond.length} of the ${mendable.length} wounds you are carrying`;
    const whatBecomesOfIt = reached === 0
        ? 'Swallowing it will spend it and close nothing.'
        : `Swallowing it closes the ${reached === 1 ? 'other one' : `other ${reached}`} and leaves `
          + `${beyond.length === 1 ? 'that one' : 'those'} exactly as ${beyond.length === 1 ? 'it is' : 'they are'}.`;

    return {
        lines: [
            `It will not reach ${whatItMisses}. ${bought.name} is ${bought.grade} grade and `
            + `${beyond.length === 1 ? 'that tear wants' : 'the worst of them wants'} `
            + `${needed}-grade medicine on a body at your height. ${whatBecomesOfIt}`
            + (cure ? `\n\n${whatToSayAboutTheCure(cure)}` : ''),
            'You were sold it anyway, because it is your money and there may be a wound tomorrow it '
            + 'does answer. Nobody at the counter pretended otherwise.'
        ],
        structure: [
            `medicineReaches(${bought.grade}): ${beyond.length} of ${mendable.length} untreated `
            + `wound(s) out of reach at ordinal ${cultivator.realmOrdinal}; highest requirement `
            + `${needed}. The pill is in the pouch and treat_injury will refuse it on those.`
        ]
    };
}

/**
 * Whether what somebody typed names a title by a piece of it.
 */
function sharesADistinctivePhrase(query: string, title: string): boolean {
    const words = (s: string) => s.toLowerCase().match(/[a-z]{3,}/g) ?? [];
    const asked = words(query).filter(w => !DUTY_STOPWORDS.has(w));
    const named = words(title).filter(w => !DUTY_STOPWORDS.has(w));
    if (asked.length < 2 || named.length < 2) return false;

    for (let i = 0; i < asked.length - 1; i++) {
        for (let j = 0; j < named.length - 1; j++) {
            if (asked[i] === named[j] && asked[i + 1] === named[j + 1]) return true;
        }
    }
    return false;
}

/** Words that name nothing on their own, so a shared one means nothing. */
const DUTY_STOPWORDS: ReadonlySet<string> = new Set([
    'the', 'and', 'for', 'has', 'have', 'that', 'this', 'with', 'from', 'what',
    'into', 'take', 'taking', 'accept', 'one', 'ones', 'job', 'jobs', 'mission',
    'missions', 'commission', 'duty', 'task', 'work', 'sect', 'house'
]);

// ─────────────────────────────────────────────────────────────────────────
// ERRORS AND WIRE SHAPES
// ─────────────────────────────────────────────────────────────────────────

/** A refusal with an HTTP status. The message is safe to show a player. */
/**
 * The actions that only mean anything among mortals.
 */
const MORTAL_WORLD_ACTIONS: readonly ActionName[] = [
    'work', 'market', 'provision', 'eat', 'gather', 'hunt', 'interact', 'sect', 'move',
    /**
     * A yard is somewhere in the province, and everything that goes into one comes
     * off a body a hunting party carried home. `OBJECT_CEILING_BELOW_THE_LID` is
     * the other half of why: what a True Immortal could make down there is capped
     * at a rung below them, so the sentence is re-offered as the two ways an
     * immortal does anything below rather than answered by looking for a bench in a
     * place where there is nobody.
     */
    'craft',
    // An inheritance ground is a hole in a hillside in the province. A True
    // Immortal is not standing near one, and the trip back down costs nine
    // strikes of the heaviest tribulation there is.
    'site',
    /**
     * Hitting somebody, which is the user's own worked example of what this list
     * should DO rather than refuse: "if you say you wanna attack the sect you could
     * send an immortal weapon down to your sect below and a message, or you could
     * do it yourself." Both of those are real and both are reachable, so a sentence
     * about a fight in the province is re-offered here rather than answered by
     * looking for somebody to swing at in a place where there is nobody.
     */
    'attack',
    /**
     * Three of the four institutional verbs. A petition travels along a chain of
     * people; a declaration is made to somebody who has to hear it; a seal is under
     * a mountain in the province. None of the three is reachable from the far side
     * except by going.
     */
    'petition', 'posture', 'seal',
    /**
     * Asking a square what it has heard.
     */
    'news'
] as const;

/**
 * The words that mean "the library" rather than naming anything in it.
 */
const GENERIC_LIBRARY_PHRASE =
    /\b(?:what|which|curriculum|curricula|library|shelf|taught|teach|teaches|teaching|methods|list|everything|anything|else)\b/i;

/**
 * The words that mean "a house" rather than naming one.
 */
/**
 * The words that mean "a pill" rather than naming one.
 */
/** How many formulas the listing reads out before it starts counting. */
const RECIPES_SHOWN = 8;

/** The same, for the arts. Two lists, one convention. */
const TECHNIQUES_SHOWN = 8;

/** And for the wall. Offers and refusals are counted separately. */
const DUTIES_SHOWN = 8;

/**
 * What a FULL month of mortal care puts back, as a flat quantity of HP.
 */
const CARE_RESTORES_HP = Math.max(
    1,
    ...PILLS
        .filter(pill => pill.effect === 'heal_hp' && pill.grade === 'mortal')
        .map(pill => pill.potency)
);

/**
 * The rung a cultivator with no cultivation manual is carried to.
 */

/**
 * How much of a day sect work leaves for cultivation.
 */
const DUTY_FOCUS = 0.25;

/**
 * How a name reached this cultivator, for the inspector.
 */
function hearingCall(heard: Hearing): ToolCallRecord {
    const name = heard.names[0].name;
    if (heard.mode === 'told') {
        return {
            name: 'knowledge.learn',
            action: 'name_told',
            summary:
                `"${name}" was said to this cultivator by somebody who assumed they already `
                + 'knew it. Recorded from a source that can be named.',
            ok: true
        };
    }
    if (heard.mode === 'passing') {
        return {
            name: 'knowledge.learn',
            action: 'name_in_passing',
            summary:
                `"${name}" was said by somebody moving through, with a road and a number of `
                + 'days attached to it. Where they came from can be pointed at; anything else '
                + 'they mentioned cannot.',
            ok: true
        };
    }
    return {
        name: 'knowledge.learn',
        action: 'name_overheard',
        summary:
            `"${name}" was overheard from people who did not know they were heard. Recorded at `
            + 'the lowest stance: acting on it would reveal where this cultivator was standing.',
        ok: true
    };
}


/** One row of `alchemy_manage.list_recipes`, as much of it as this layer reads. */
interface RecipeRow {
    name: string;
    estimatedSuccessRate?: number;
    produces: { name: string } | null;
    ingredients: { name: string; required: number; short: number }[];
}

const GENERIC_PILL_PHRASE =
    /^(?:a |an |any |some |the |one |another )*(?:pills?|elixirs?|medicines?|formulae?|formulas?|recipes?|concoctions?|something|anything)\b\s*$/i;

const GENERIC_HOUSE_PHRASE =
    /^(?:any |some |a |an |one |another |new |good |strong |nearby |local )*(?:sects?|orders?|schools?|clans?|houses?|cults?|somewhere|somebody|someone|anyone|anybody)\b/i;

/**
 * The same words, but only where they are the WHOLE of what was said.
 */
const GENERIC_HOUSE_CATEGORY_ONLY =
    /^(?:any |some |a |an |one |another |new |good |strong |nearby |local |the )*(?:guest (?:student|studentship|place|pupil)|sects?|orders?|schools?|clans?|houses?|cults?|somewhere|anywhere|somebody|someone|anyone|anybody)(?:\s+(?:somewhere|anywhere|near(?:by)?|around(?: here)?|here|about|else))?$/i;

/**
 * Which elder a sentence meant, out of the ones the house actually holds.
 */
function elderNamed(listing: object, query: string | undefined): string | null {
    const wanted = (query ?? '').trim();
    if (wanted.length < 3 || ANY_ELDER_AT_ALL.test(wanted)) return null;

    const elders = (listing as {
        elders?: Array<{ elderId?: string; name?: string | null; rankTitle?: string | null }>;
    }).elders ?? [];

    const pick = (nameOf: (e: { name?: string | null; rankTitle?: string | null }) => string | null) => {
        let winner: string | null = null;
        let winningScore = 0;
        for (const elder of elders) {
            const candidate = elder.elderId ? nameOf(elder) : null;
            if (!candidate) continue;
            const score = matchScore(wanted, candidate);
            if (score >= MATCH_THRESHOLD && score > winningScore) {
                winner = elder.elderId!;
                winningScore = score;
            }
        }
        return winner;
    };

    return pick(e => e.name ?? null) ?? pick(e => e.rankTitle ?? null);
}

/** "an elder", "one of the elders" - a rung, not a person. */
const ANY_ELDER_AT_ALL =
    /^(?:one of\s+)?(?:the|an?|any|some|my|our)?\s*elders?$/i;

/**
 * Verbs that are two names for one act, so a sentence naming both named one.
 */
const SAME_ACT_UNDER_TWO_NAMES: ReadonlyArray<readonly [ActionName, ActionName]> = [
    // Both reach `runSeclusion`. One names the posture, the other names what
    // the posture is for.
    ['cultivate', 'seclude']
];

function sameActUnderTwoNames(ran: ActionName, other: ActionName): boolean {
    return SAME_ACT_UNDER_TWO_NAMES.some(([a, b]) =>
        (a === ran && b === other) || (b === ran && a === other));
}

/**
 * ADMIN, spoken in play. Matched at the head of the input only, so a sentence
 * that merely contains the word is an ordinary turn - "the admin of the sect
 * refused me" must not open a tool surface.
 */
const ADMIN_PREFIX = /^admin(?![a-z])[:\s-]*/i;

/** Mirrors `admin_manage`'s own action list, for the guiding error only. */
const ADMIN_ACTIONS = [
    'roster', 'spawn_encounter', 'spawn_site', 'grant_item',
    'set_ambient', 'set_location', 'advance_days', 'set_realm', 'set_age',
    'grant_progress', 'grant_knowledge', 'audit_log', 'help',
    // Not an `admin_manage` action. It is handled here because runs are
    // written here and nowhere else; see `adminReset`.
    'reset',
    // Nor this one, and for a related reason: forcing runs an ORDINARY VERB,
    // an ordinary verb runs inside a run, and only this file has one. See the
    // ADMIN branch of `act`, and `forcing-an-attempt-to-land.ts` for the law.
    '<any playable verb>'
] as const;

/**
 * ADMIN's one run-lifecycle verb, spelled the several ways people spell it.
 */
const ADMIN_RESET = /^(?:reset|restart|regenerate|reroll|new_run|newrun)(?![a-z_])[:\s-]*/i;

// ─────────────────────────────────────────────────────────────────────────
// THE SERVICE
// ─────────────────────────────────────────────────────────────────────────

export class GameService {
    readonly db: Database.Database;
    /**
     * The same repository bundle the MCP tools use, so the two front doors
     * cannot drift apart about what a crossing took or how a skip is written.
     */
    readonly repos: CultivationRepos;
    private readonly log: PlayLog;
    /**
     * What each cultivator has heard of.
     */
    readonly knowledge: KnowledgeGate;
    /**
     * What this run has done to the inheritance grounds it has found.
     */
    readonly sites: SiteLedger;
    readonly legacy: LegacyLedger;
    /** Whether time passing for the cultivator also passes for everyone else. */
    readonly worldEnabled: boolean;
    /**
     * The world, loaded once per action.
     */
    atHand: WorldState | null = null;
    /**
     * World facts that reached this player by no channel at all, still eligible to
     * turn up on them.
     */
    pendingArrivals: ArrivableFact[] = [];
    /**
     * A seclusion that stopped because of somebody, with the answer still owed.
     */
    crossroads: SeclusionCrossroads | null = null;
    /**
     * A fight that has started and has not ended.
     */
    fight: StandingFight | null = null;
    /**
     * Two costly acts in one sentence, with the choice still owed.
     */
    private whichComesFirst: WhichComesFirst | null = null;
    /**
     * What the turn before this one did, and what it told the player.
     */
    private lastTurn: WhatTheLastTurnDid | null = null;
    /**
     * Steps that ran this turn, being collected for {@link lastTurn}.
     */
    private ranThisTurn: PlanStep[] = [];
    /**
     * Things this turn named to the player, being collected for {@link lastTurn}.
     */
    private namedThisTurn: ThingNamed[] = [];
    /**
     * Set when an action changed the world without spending a day.
     */
    worldDirty = false;
    private readonly narrator: Narrator;
    private readonly seedFactory: () => string;

    readonly adminMode: boolean;

    constructor(options: GameServiceOptions) {
        this.db = options.db;
        this.narrator = options.narrator;
        this.adminMode = options.adminMode ?? false;
        this.seedFactory = options.seedFactory ?? (() => randomUUID());

        // This deployment is single-operator against one database, so the
        // injected handle IS the process database. Installing it as the
        // ambient one lets `ensureCultivationDb` build the exact repository
        // bundle the MCP tools use - including its auxiliary tables - instead
        // of this layer growing a parallel set that could drift.
        setDb(this.db);
        this.repos = ensureCultivationDb();
        this.log = new PlayLog(this.db);
        this.knowledge = new KnowledgeGate(this.db);
        this.sites = new SiteLedger(this.db);
        this.legacy = new LegacyLedger(this.db);
        this.worldEnabled = options.worldEnabled ?? true;
    }

    // ── run lifecycle ────────────────────────────────────────────────────

    /**
     * Roll a cultivator and open a run.
     */
    /**
     * Point the ambient handle at this service's database.
     */
    private useOwnDb(): void {
        if (ambientDb === this.db) return;
        setDb(this.db);
        // The world layer holds process-global caches - which world is the active
        // one, which world a run belongs to, the catalog - and none of them are
        // keyed by database. Swapping the handle underneath them without saying so
        // means the next run joins whichever world was created first in this
        // process, from whichever database that was. `resetCultivationWorlds`
        // exists for exactly this and says so; the worlds are in SQLite and come
        // back on the next touch.
        resetCultivationWorlds();
        ambientDb = this.db;
    }

    async newRun(name: string): Promise<{ run: RunView; cultivator: Cultivator }> {
        this.useOwnDb();
        const trimmed = name.trim();
        if (trimmed.length === 0) throw new GameError('A cultivator needs a name.');
        if (trimmed.length > 60) throw new GameError('That name is too long; sixty characters at most.');

        const active = this.repos.runs.getActiveRun();
        if (active) {
            throw new GameError(
                'A run is already in progress. Runs end when the cultivator dies; there is no abandoning one.',
                409
            );
        }

        // The next life begins in the world the last one left behind, not in a
        // fresh one. `planNextRun` decides the seed, so a run is a life lived
        // inside this world rather than a world of its own - which is what makes
        // the ruins the new cultivator digs through the previous cultivator's. When
        // there is no world, the seed factory stands in. `latestFinishedRun` rather
        // than the ledger. "Which world does this life begin in" and "what does
        // this world's record of deaths say" are different questions, and the
        // ledger now excludes admin-rigged runs in SQL - so reading lineage off it
        // would have handed a fresh run a null world the moment an operator flagged
        // the run before it.
        const previousRun = this.repos.runs.latestFinishedRun();
        const world = this.worldEnabled && previousRun ? await worldForRun(previousRun) : null;
        const plan = world
            ? planNextRun(world, {
                index: world.runs.length,
                onDay: world.currentDay,
                previous: lastFinishedRun(world)
            })
            : null;
        const seed = plan ? plan.seed : this.seedFactory();

        // Where this life opens, and what it opens with.
        const birth = drawBirth(seed);

        const root = rollSpiritRoot(forStream(seed, 'creation', 'spirit_root').next());
        // Its own named stream, beside the root and the attributes rather than
        // inside either: a draw added to one of those would have moved every
        // talent every existing run seed produces. Dealt once and permanent,
        // like the two above it, and it decides no number - what it decides is
        // whether a child can be of both parents' blood, and which of two
        // Courts would ever have opened their door.
        const sex = rollSex(forStream(seed, 'creation', 'sex').next());
        // The body itself, on its own named stream beside the other three, and
        // dealt exactly once. Null for 98 births in a hundred; where it lands it
        // is read by the cultivation rate, by the lifespan ceiling, and by what
        // an art that runs on the others takes out of this body. Nothing
        // anywhere branches on which one it is -
        // `engine/cultivation/physiques.ts` carries that rule.
        const physique = rollPhysique(forStream(seed, 'creation', 'physique').next());
        const attributeStream = forStream(seed, 'creation', 'attributes');
        const attributes = rollAttributes([
            attributeStream.next(),
            attributeStream.next(),
            attributeStream.next(),
            attributeStream.next()
        ]);

        // ONE DERIVATION, AND THIS WAS THE SECOND COPY OF IT
        const maxHp = maxHpForOrdinal(attributes.might, 0);
        const maxQi = maxQiForOrdinal(attributes.insight, 0);

        const created = this.db.transaction(() => {
            const cultivator = this.repos.cultivators.create({
                id: randomUUID(),
                name: trimmed,
                kind: 'pc',
                spiritRoot: root.key,
                sex,
                physique: physique?.key ?? null,
                attributes,
                realmOrdinal: 0,
                cultivationProgress: 0,
                hp: maxHp,
                maxHp,
                qi: maxQi,
                maxQi,
                satiety: SATIETY_MAX,
                starvationTurns: 0,
                age: STARTING_AGE,
                yearsAtCurrentRealm: 0,
                origin: birth.origin,
                spiritStones: birth.spiritStones,
                location: birth.place.name,
                // A MEMBER FROM BIRTH, AT NO RANK IN IT.
                ...(birth.raisedInside?.onTheRoll
                    ? { sectId: birth.raisedInside.house.id }
                    : {}),
                alive: true
            });
            const run = this.repos.runs.startRun({ cultivatorId: cultivator.id, seed });
            return { cultivator: this.repos.cultivators.getById(cultivator.id)!, run };
        })();

        // What this life starts holding, in two layers that do different jobs.
        this.knowledge.seedStartingAwareness(created.cultivator.id, 0, birth.place.name, null);
        for (const row of birth.knowledge) {
            this.knowledge.learn({ ...row, holderId: created.cultivator.id, onDay: 0 });
        }

        // AND THE PEOPLE. Measured on three seeds before this existed: nine to
        // fourteen places known and not one person, with thirteen, five and
        // seventeen bodies standing in the square. `company()` reports anybody with
        // no record as an ordinal and nothing else, so every person in the world
        // was a permanent stranger and the four verbs that need somebody to be
        // pointed at could not find one.
        await this.seedTheFacesFromHome(created.cultivator, birth.origin, seed);

        // AND THE GROUND. The same ruling, applied to geography: somebody who grew
        // up here can point at the caves and the wild ground outside the village.
        // That was previously handled by `destinations` listing the world's own
        // location table without asking the gate anything, which handed over dao
        // ground and prospected finds along with the caves. The knowledge is real
        // now, and the gate is closed. Needs the world, which the call above has
        // just brought into being.
        this.seedTheGroundAroundHome(created.cultivator);

        // And the roster, so the world can put them on a list from the first
        // day rather than from the first turn. See the banner in `act`.
        this.refreshThePlayerRow(created.cultivator);

        const awareness = this.knowledge.awareness(created.cultivator.id);

        const ambient = this.ambientFor(created.cultivator, created.run);
        const facts = factsForLook(created.cultivator, ambient, this.company(created.cultivator));
        const opening = await this.narrator.narrate(facts, {
            place: placeName(created.cultivator),
            ambient,
            awareness
        });

        // What the world contributes to this life, in the world's own words.
        // A stranger is told they are a stranger; a descendant is told whose.
        if (plan && world) {
            recordRun(world, {
                id: created.run.id,
                seed,
                index: plan.index,
                cultivatorId: created.cultivator.id,
                cultivatorName: created.cultivator.name,
                startedOnDay: world.currentDay,
                endedOnDay: null,
                outcome: 'active',
                peakOrdinal: 0,
                graveLocationId: null,
                successorRelation: null
            });
        }

        this.log.append(created.run.id, [
            ...(plan ? [{ role: 'narrator' as const, turn: 0, text: plan.note }] : []),
            // WHICH OF THE TWO WAYS OF PLAYING THIS IS, in the log rather than only
            // in a status bar. Without a key the bar read "narrator
            // anthropic/claude-opus-5 (not configured)", which is a diagnostic
            // about an environment variable and reads as a broken install. It is
            // not one: the whole game is playable here. Said in both directions on
            // purpose - a line that only appears when something is missing is an
            // apology rather than a mode.
            { role: 'engine' as const, turn: 0, text: announceMode(this.narrator).line },
            {
                role: 'engine',
                turn: 0,
                text:
                    `${created.cultivator.name} begins at ${rankName(0)}, age ${STARTING_AGE}. ` +
                    `${describeBirth(birth)} ` +
                    `${root.name}; Might ${attributes.might}, Insight ${attributes.insight}, ` +
                    `Fortune ${attributes.fortune}, Charm ${attributes.charm}. ` +
                    'Talent is rolled once and never redrawn.'
            },
            { role: 'narrator', turn: 0, text: opening.text }
        ]);

        return { run: runView(created.run), cultivator: cultivatorView(created.cultivator) };
    }

    /** The current run, whether it is still live or already in the ledger. */
    state(): StateView {
        this.useOwnDb();
        const { run, cultivator } = this.currentRun();
        return this.stateView(run, cultivator);
    }

    // ── actions ──────────────────────────────────────────────────────────

    /**
     * Free-text intent, resolved in three strictly separated phases.
     */
    /**
     * @param forced Set only by the ADMIN dispatcher below, never by a caller
     *   outside this file and never by anything a model can reach. It names the
     *   verb, which replaces phase 1, and marks the turn as arranged so the
     *   receipt and the audit row say so.
     */
    async act(input: string, forced: ForcedVerbLine | null = null): Promise<ActResult> {
        this.useOwnDb();
        const trimmed = input.trim();
        if (trimmed.length === 0) throw new GameError('Say something.');
        if (trimmed.length > 2000) throw new GameError('That is too long. Two thousand characters at most.');

        // RESET SURVIVES DEATH, AND HAS TO
        if (isAdminModeEnabled()) {
            const head = ADMIN_PREFIX.exec(trimmed);
            if (head) {
                const rest = trimmed.slice(head[0].length).trim();
                const wantsReset = ADMIN_RESET.exec(rest);
                if (wantsReset) {
                    const now = this.currentRun();
                    return await this.adminReset(
                        rest.slice(wantsReset[0].length).trim(), now.run, now.cultivator
                    );
                }
            }
        }

        const { run, cultivator } = this.requireLiveRun();

        // ADMIN is an operator surface, not a game action, so it is answered
        // before the narrator ever sees the input. context.md: it lifts content
        // gates and never the authority rule - every action below performs a
        // real audited mutation and returns what the engine actually did.
        const admin = ADMIN_PREFIX.exec(trimmed);
        if (admin) {
            const rest = trimmed.slice(admin[0].length);
            // ADMIN <VERB> IS AN ORDINARY TURN WITH ONE ANSWER PINNED
            const forced = isAdminModeEnabled() ? readAForcedVerb(rest) : null;
            if (forced !== null) {
                const ran = await withTheAttemptLanding(
                    forced.verb, () => this.act(forced.sentence, forced)
                );
                return ran.result;
            }
            return await this.adminAct(rest, run, cultivator);
        }

        const ambient = this.ambientFor(cultivator, run);
        this.atHand = await this.loadWorld();

        // THE PLAYER IS ON THE ROSTER, AND THE SHEET IS THE SOURCE
        this.refreshThePlayerRow(cultivator);

        // A QUESTION THE ENGINE LEFT OPEN IS ANSWERED FIRST
        const inAFight = theFightStillStands(this.fight, run.id, cultivator.id)
            ? this.fight
            : null;
        const fightAnswer = inAFight === null ? null : whatTheySaidInTheFight(trimmed);

        const standing = stillStands(this.crossroads, run.id, cultivator)
            ? this.crossroads
            : null;
        const clockOnEntry = run.elapsedDays;
        const answered = standing === null || inAFight !== null
            ? null
            : THE_ANSWER_IS_TO_KEEP_SITTING.test(trimmed)
                ? 'stay' as const
                : THE_ANSWER_IS_TO_GO.test(trimmed)
                    ? 'go' as const
                    : null;

        // AND SO IS "WHICH OF THOSE TWO FIRST"
        const asked = theQuestionStillStands(this.whichComesFirst, run.id, cultivator.id)
            ? this.whichComesFirst
            : null;
        this.whichComesFirst = null;
        const picked = asked === null ? null : whichOneTheyChose(trimmed, asked);

        // AND THE TURN BEFORE THIS ONE, WHICH IS ALL THERE IS
        const before = theLastTurnStillStands(
            this.lastTurn, run.id, cultivator.id, run.turn
        ) ? this.lastTurn : null;
        this.lastTurn = null;
        this.ranThisTurn = [];
        this.namedThisTurn = [];

        // "KEEP AT IT" IS A VERB THE PLAYER ALREADY SAID
        const carriesOn = fightAnswer === null && picked === null
            && forced === null && answered === null
            ? theSentenceCarriesOn(trimmed)
            : null;
        const carryingOn = carriesOn === null || before === null
            ? null
            : carryingOnFromTheLastTurn(before, trimmed);

        // phase 1
        const plan: PlanWithSteps = fightAnswer !== null
            ? {
                // No model reads a sentence said inside a fight, and that is
                // deliberate rather than a saving. A fight answer is one of five
                // things and it was already read deterministically; sending it
                // to phase 1 could only turn "I back off" into `move` and walk
                // the player calmly out of a fight they are still in.
                action: { action: 'attack' },
                source: 'fallback',
                note: `a fight is standing and the sentence answered it: ${fightAnswer.kind}.`
            }
            : picked !== null
            ? {
                action: picked.action,
                steps: [picked],
                source: 'fallback',
                note: 'two costly acts were read out of the previous sentence and the player '
                    + 'chose this one. No model read this line; the plan was already validated.'
            }
            : forced !== null
            ? {
                action: {
                    ...parseIntent(forced.sentence),
                    action: forced.verb
                },
                source: 'fallback',
                note: `ADMIN named the verb: ${forced.verb}. No model read the line.`
            }
            : answered !== null
            ? {
                action: { action: answered === 'stay' ? 'cultivate' : 'wait' },
                source: 'fallback',
                note: answered === 'stay'
                    ? 'an open seclusion crossroads, answered by sitting back down'
                    : 'an open seclusion crossroads, answered by getting up'
            }
            : carryingOn !== null
            ? {
                action: carryingOn.action,
                steps: [carryingOn],
                source: 'fallback',
                note: `the sentence carried on from the turn before it ("${carriesOn}"), which `
                    + `ran ${carryingOn.action.action}. No model read this line; the act is the `
                    + 'one the player themselves ran, charged in full.'
            }
            : carriesOn !== null
            // NOTHING TO CARRY ON WITH, AND NO MODEL IS ASKED ABOUT IT.
            // "Keep at it" has no second meaning to fall back on: either there
            // is an act behind it or there is not, and that is a fact about the
            // record rather than about the sentence. Phase 2 answers it below.
            ? {
                action: { action: 'unclear' },
                source: 'fallback',
                note: `the sentence carried on ("${carriesOn}") and the turn before it left `
                    + 'nothing to carry on with. No model read this line.'
            }
            : await this.narrator.plan(
                trimmed,
                composeStateSummary({
                    cultivator,
                    run,
                    ambient,
                    sectName: this.sectNameFor(cultivator),
                    knownTechniques: this.knownTechniqueNames(cultivator),
                    awareness: this.awarenessOf(cultivator),
                    // The square, gated. Without it the classifier is asked to
                    // bind "everyone here" against a list of every name in the
                    // cultivator's world with no mark on which are in front of
                    // them. See `describeWhoIsHere`.
                    present: this.company(cultivator)
                }),
                describeTheLastTurn(before)
            );

        // AND "THAT ONE" MEANS ONE OF THE THINGS YOU WERE JUST SHOWN
        const resolved = before === null || carryingOn !== null
            ? null
            : resolvingAgainstTheLastTurn(plan, before, trimmed);
        const theTurnsPlan: PlanWithSteps = resolved && resolved.resolutions.length > 0
            ? resolved.plan
            : plan;

        // WHO WAS STANDING HERE BEFORE ANY OF IT
        const squareBefore = this.present(cultivator);
        // And the body on the other side of a fight already standing, whose
        // hit points live in the fight rather than on any row a snapshot of
        // the square can reach.
        const bodyOpposite = this.theBodyOpposite(inAFight);

        // ── phase 2 ──
        const execution = fightAnswer !== null
            ? await this.answerTheFight(run, cultivator, ambient, inAFight!, fightAnswer)
            : answered === 'stay'
            ? await this.sitBackDown(run, cultivator, ambient, standing!)
            : answered === 'go'
            ? this.getUpAndGo(run, standing!)
            : carriesOn !== null && carryingOn === null
            // NOTHING TO CARRY ON WITH, AND SAYING SO IS THE WHOLE ANSWER.
            // A refused turn leaves no act behind, and neither does a memory
            // that has lapsed. The refusal names the route - say the thing
            // itself - and spends nothing, because a question is a free turn.
            ? this.freeAction(run, 'unclear', factsForRefusal(
                'There is nothing there to carry on with.',
                nothingToCarryOnWith(before),
                `The sentence read as carrying on ("${carriesOn}") and the turn before this one `
                + 'left no act to carry on with. No day passed and nothing was spent.'
            ))
            : await this.takeTheRoundFirst(
                inAFight,
                () => this.carryOutThePlan(theTurnsPlan, run, cultivator, ambient, trimmed),
                run, cultivator, ambient, theTurnsPlan.action.action
            );

        if (carriesOn !== null && carryingOn === null) {
            execution.calls.push(theRowForNothingToCarryOnWith(before));
        }

        // WHERE A READING IS A JUDGEMENT CALL, SHOW IT. AGENTS.md's rule, and
        // resolving a back-reference is one of the clearest cases of it: the
        // player is owed the chance to see that "keep at it" was taken to mean
        // sitting down for another decade, and to say otherwise if it was not.
        if (carryingOn !== null && carriesOn !== null) {
            sayThisWhateverTheNarratorDoes(
                execution.facts, sayingWhatWasCarriedOn(carriesOn, carryingOn)
            );
            execution.calls.push(theRowForCarryingOn(carriesOn, carryingOn));
        }
        if (resolved && resolved.resolutions.length > 0) {
            sayThisWhateverTheNarratorDoes(
                execution.facts, sayingWhatItWasTakenToMean(resolved.resolutions)
            );
            execution.calls.push(theRowForAResolvedReference(resolved.resolutions, before!));
        }

        // Doing something else with a day in it is going, and going says what
        // it cost. Before phase 3, so the sentence is in the facts the narrator
        // is handed. `clockOnEntry` is compared against the run as it stands
        // NOW: a read that spent no day leaves the question open.
        if (answered === null && standing !== null) {
            const now = this.currentRun();
            this.settleAnyStandingCrossroads(
                execution, standing, now.cultivator, now.run.elapsedDays > clockOnEntry
            );
        }

        // AND THE PART OF THE SENTENCE THAT DID NOT RUN
        const naming = theClauseThisTurnDidNotRun(trimmed, theTurnsPlan.action.action);
        const dropped = stepsOfThePlan(theTurnsPlan).length > 1
            || (naming !== null && sameActUnderTwoNames(theTurnsPlan.action.action, naming.action))
            ? null
            : naming;
        if (dropped) {
            const said = sayingWhatWasNotDone(dropped);
            // All three channels, because they are read by three different
            // people. `lines` is what the narrator may know, `prose` is what
            // the deterministic narrator ships verbatim, and `structure` is the
            // log, which is the only one of the three that cannot be dressed.
            execution.facts.lines.push(said);
            execution.facts.prose = `${execution.facts.prose}\n\n${said}`;
            execution.facts.structure.push(
                theStructureLineFor(dropped, theTurnsPlan.action.action)
            );
            execution.calls.push({
                name: 'engine.parseIntent',
                action: theTurnsPlan.action.action,
                summary: theStructureLineFor(dropped, theTurnsPlan.action.action),
                ok: false
            });
        }

        const after = this.currentRun();

        // AND THIS TURN BECOMES THE ONE THE NEXT ONE MAY REFER TO
        this.lastTurn = {
            runId: after.run.id,
            cultivatorId: after.cultivator.id,
            onTurn: after.run.turn,
            outcome: execution.outcome,
            acts: this.ranThisTurn,
            named: withoutSayingTheSameThingTwice(this.namedThisTurn)
        };
        // And again, now the turn is over, BEFORE the write below. The refresh
        // at the top is what the world reads while the span runs - the player
        // as they were when it began, which is correct - and this one is what
        // gets stored, so a row read between turns or after a restart says what
        // the sheet says rather than what it said a turn ago.
        this.refreshThePlayerRow(after.cultivator);

        // AND IF THIS TURN KILLED THEM, THE WORLD IS TOLD
        const died = this.settleTheEstateIfTheyDied();
        if (died) {
            execution.calls.push({
                name: 'world.settleWhatTheyWereCarrying',
                action: 'death',
                summary: died.facts.structure.join(' '),
                ok: true
            });
            // Required rather than offered. Where what somebody was carrying
            // went is the last thing that happens to them and the narrator may
            // not decline to mention it.
            for (const line of died.facts.lines) {
                sayThisWhateverTheNarratorDoes(execution.facts, line);
            }
        }

        // A world changed inside one turn is written before anything is
        // narrated, so a restart cannot lose an abode, a descent or a thing
        // that went down a channel. Nothing here reads the narration; the
        // ordering is only about durability.
        if (this.worldDirty) {
            this.worldDirty = false;
            await saveWorldForRun(run);
        }

        // EVERYTHING THIS TURN SHOWED, WRITTEN DOWN
        for (const perceived of execution.perceived ?? []) {
            const learned = recordPerception(this.knowledge, after.cultivator, after.run, perceived);
            if (learned.length > 0) {
                execution.facts.structure.push(
                    `shown this turn: ${learned.map(name => name.name).join(', ')} `
                    + `(${perceived.sourceKind}). ${perceived.note}`
                );
            }
        }

        // AND THE PEOPLE WHO WERE IN IT
        this.sayWhoWasInIt(
            execution, squareBefore, cultivator, after.cultivator,
            theBearingsThisTurnCanRead(
                bodyOpposite,
                this.theBodyOpposite(
                    theFightStillStands(this.fight, after.run.id, after.cultivator.id)
                        ? this.fight
                        : null
                ),
                whoThePlanPointedAt(
                    stepsOfThePlan(theTurnsPlan).map(step => step.action.target),
                    squareBefore
                )
            )
        );

        const scene = {
            place: placeName(after.cultivator),
            ambient: this.ambientFor(after.cultivator, after.run),
            awareness: this.awarenessOf(after.cultivator),
            hearing: execution.hearing ?? null,
            // Asking turns on what was said, so the words reach phase 3. They
            // are shown to the narrator and never read back: no key matching,
            // no phrase table, no engine surface. The judgement is narration.
            playerSaid: trimmed,
            // What the engine actually filed. Phase 3 may dress this and may
            // not contradict it; see the banner in `narrator.ts`.
            filed: this.filedOutcome(execution)
        };

        // ── phase 3 ──
        const narration = await this.narrator.narrate(execution.facts, scene);

        // AND A FORCED TURN SAYS SO, ABOVE THE STORY
        const receipt = forced === null
            ? null
            : this.receiptForAForcedVerb(forced, execution, after.run.id);

        this.log.append(run.id, [
            { role: 'player', turn: run.turn, text: forced === null ? trimmed : `ADMIN ${trimmed}` },
            ...(receipt ? [{ role: 'engine' as const, turn: after.run.turn, text: receipt }] : []),
            ...this.engineEntries(execution, after.run.turn, narration.text),
            { role: 'narrator', turn: after.run.turn, text: narration.text }
        ]);

        return {
            narration: receipt === null ? narration.text : `${receipt}\n\n${narration.text}`,
            events: execution.events,
            toolCalls: [
                routingCall(plan),
                ...execution.calls,
                narrationCall(narration)
            ],
            state: this.stateView(after.run, after.cultivator)
        };
    }

    /**
     * What ADMIN arranged, said out of world, and written to the audit trail.
     */
    private receiptForAForcedVerb(
        forced: ForcedVerbLine,
        execution: Execution,
        runId: string
    ): string {
        const call = execution.calls[0];
        const refused = execution.outcome === 'refused';
        // A tool refusal files its guiding-error code as the head of the
        // summary; an engine refusal has only the call name. Both are the
        // refusal's own identity rather than a reading of its prose.
        const code = refused && typeof call?.summary === 'string'
            ? (/^([a-z0-9_]+)/.exec(call.summary)?.[1] ?? null)
            : null;

        const lines: string[] = [`ADMIN - FORCED ${forced.verb.toUpperCase()}`];

        // WHAT WAS DECIDED IS A FACT ABOUT THE DECISIONS, NOT THE VERB
        const landed = [...(theAttemptInFlight()?.landed ?? [])];

        if (landed.length > 0) {
            lines.push(
                'Decided by ADMIN: ' + landed
                    .map(name => FORCEABLE_DECISIONS[name].decides)
                    .join('; ') + '.'
            );
            lines.push(
                'Every gate it met, it cleared on its own. Nothing was skipped and nothing was ' +
                'made cheaper: what the verb charges, it charged.'
            );
        } else if (!refused) {
            lines.push(
                'Nothing was decided by ADMIN. This verb reached no uncertain question on this ' +
                'turn, so it ran exactly as ordinary play runs it - which is worth saying rather ' +
                'than leaving to be assumed.'
            );
        } else {
            const arrange = whatWouldArrangeIt(call?.name ?? '', code);
            lines.push(
                'Nothing was decided. The world refused before any uncertain question arose, ' +
                'which means what stopped this was a PRECONDITION and not a roll. Forcing ' +
                'decides an uncertain outcome; it does not make an illegal action legal.'
            );
            if (arrange.kind === 'route') {
                lines.push('What would arrange it:');
                for (const line of arrange.lines) lines.push(`    ${line}`);
            } else if (arrange.kind === 'no_route') {
                lines.push(`There is no arrangement of ADMIN calls that produces this. ${arrange.reason}`);
            } else {
                lines.push(
                    'No route is recorded for this refusal. It is either a precondition nothing ' +
                    'on this surface arranges or a shape the world cannot hold, and ADMIN does ' +
                    'not guess which. ADMIN help lists what it can arrange.'
                );
            }
        }

        writeAdminAudit(this.repos, `force.${forced.verb}`, runId, {
            verb: forced.verb,
            sentence: forced.sentence,
            spelled: forced.spelled,
            outcome: execution.outcome,
            decidedByAdmin: landed,
            refusedBy: refused ? (call?.name ?? null) : null,
            refusalCode: code
        });

        lines.push(
            'ADMIN - out of world. The paragraph after this one is not: it is the world as it ' +
            'now stands, told by whichever narrator this process was started with. This run is ' +
            'flagged and is excluded from the death ledger and from balance data.'
        );
        return lines.join('\n\n');
    }

    /** Seclusion, requested directly by the UI rather than through free text. */
    async cultivate(days: number, options: { anyway?: boolean } = {}): Promise<CultivateResult> {
        this.useOwnDb();
        const requested = Math.floor(Number(days));
        if (!Number.isFinite(requested) || requested < 1) {
            throw new GameError('Cultivation needs a whole number of days, at least one.');
        }
        if (requested > MAX_CULTIVATION_DAYS) {
            throw new GameError(`The longest seclusion this engine will resolve in one pass is ${MAX_CULTIVATION_DAYS} days.`);
        }

        const { run, cultivator } = this.requireLiveRun();
        const ambient = this.ambientFor(cultivator, run);
        // Pressing Cultivate with a fork standing is going, and then sitting
        // down again for a fresh stretch. Captured before `runSeclusion` clears
        // it, for the same reason as in `act`.
        const standing = stillStands(this.crossroads, run.id, cultivator)
            ? this.crossroads
            : null;
        const clockOnEntry = run.elapsedDays;
        const squareBefore = this.present(cultivator);
        const execution = await this.runSeclusion(
            run, cultivator, ambient, requested, { acknowledged: options.anyway === true }
        );
        if (standing !== null) {
            const now = this.currentRun();
            this.settleAnyStandingCrossroads(
                execution, standing, now.cultivator, now.run.elapsedDays > clockOnEntry
            );
        }
        // The zero-return gate answers here too, and it is a refusal rather
        // than a failure: the button path has no sentence to put "anyway" into,
        // so it comes back as the engine's own words for the caller to show and
        // to offer again with `anyway: true`. Refusing loudly is the same shape
        // `breakthrough()` takes.
        if (execution.outcome === 'refused') throw new GameError(execution.facts.prose);
        if (!execution.timeSkip) throw new GameError('The simulation produced no result.', 500);

        const after = this.currentRun();
        // The same channel the typed turn runs, for the same reason: which
        // control the player pressed must not decide whether the people around
        // them are in the account of it.
        this.sayWhoWasInIt(execution, squareBefore, cultivator, after.cultivator);
        const narration = await this.narrator.narrate(execution.facts, {
            place: placeName(after.cultivator),
            ambient: this.ambientFor(after.cultivator, after.run),
            awareness: this.awarenessOf(after.cultivator),
            filed: this.filedOutcome(execution)
        });

        this.log.append(run.id, [
            { role: 'player', turn: run.turn, text: `Seclusion - ${humanDays(requested)}.` },
            ...this.engineEntries(execution, after.run.turn, narration.text),
            { role: 'narrator', turn: after.run.turn, text: narration.text }
        ]);

        return {
            timeSkip: execution.timeSkip,
            state: this.stateView(after.run, after.cultivator),
            narration: narration.text,
            // The merged list, not `timeSkip.events`. See the note on the type.
            events: execution.events,
            interruptReason: execution.timeSkip.interruptReason ?? null
        };
    }

    /** Strike the barrier now. Refuses loudly when the engine says it is not legal. */
    async breakthrough(): Promise<BreakthroughApiResult> {
        this.useOwnDb();
        const { run, cultivator } = this.requireLiveRun();
        const eligibility = canAttemptBreakthrough(cultivator);
        if (!eligibility.eligible) {
            // The fourth argument is the dao gate's own figures. Without it
            // `insufficient_dao` - the gate that stops most of the upper half of
            // the ladder - falls to a default that reads like a sentence and says
            // nothing: "The barrier does not move." See `refusalText`.
            throw new GameError(refusalText(
                eligibility.reason, eligibility.progressAvailable, eligibility.progressRequired,
                { held: eligibility.daoHeld, required: eligibility.daoRequired }
            ));
        }

        const ambient = this.ambientFor(cultivator, run);
        const squareBefore = this.present(cultivator);
        const execution = this.strikeBarrier(run, cultivator, ambient);
        if (!execution.breakthrough) throw new GameError('The engine produced no breakthrough result.', 500);

        const after = this.currentRun();
        // A barrier struck in a crowded square is one of the loudest things
        // that happens in front of anybody, and it used to happen in front of
        // nobody. `A_RUNG_MOVED` is what prices it for the people watching.
        this.sayWhoWasInIt(execution, squareBefore, cultivator, after.cultivator);
        const narration = await this.narrator.narrate(execution.facts, {
            place: placeName(after.cultivator),
            ambient: this.ambientFor(after.cultivator, after.run),
            awareness: this.awarenessOf(after.cultivator),
            filed: this.filedOutcome(execution)
        });

        this.log.append(run.id, [
            { role: 'player', turn: run.turn, text: 'Strike the barrier.' },
            ...this.engineEntries(execution, after.run.turn, narration.text),
            { role: 'narrator', turn: after.run.turn, text: narration.text }
        ]);

        return {
            result: execution.breakthrough,
            state: this.stateView(after.run, after.cultivator),
            narration: narration.text
        };
    }

    // ── read-only surfaces ───────────────────────────────────────────────

    /**
     * Refuse an operator surface when admin mode is off.
     */
    assertAdmin(what: string): void {
        if (!this.adminMode) {
            throw new GameError(`Admin mode is off. Set ADMIN_MODE=true to enable ${what}.`, 403);
        }
    }

    ledger(limit = 50): { runs: LedgerRowView[] } {
        const rows = this.repos.runs.deathLedger(limit).map(run => {
            const cultivator = this.repos.cultivators.getById(run.cultivatorId);
            return ledgerRowView(run, cultivator?.name ?? 'Unnamed');
        });
        return { runs: rows };
    }

    /**
     * Every cultivator in the world, read-only.
     */
    async roster(): Promise<{ roster: RosterRowView[] }> {
        this.useOwnDb();
        if (!this.adminMode) {
            throw new GameError('Admin mode is off. Set ADMIN_MODE=true to enable the roster.', 403);
        }
        const player = this.repos.runs.getActiveRun()?.cultivatorId
            ?? this.repos.runs.latestFinishedRun()?.cultivatorId
            ?? null;
        // Both populations. The database holds the player and whoever a run
        // wrote down; the world holds the several hundred people who were
        // already here. An operator asking who is in this world wants the
        // world, not the subset that happens to have a row.
        const stored = this.repos.cultivators.roster().map(entry => rosterRowView(entry, player));
        const world = await this.loadWorld();
        const inWorld = world
            ? world.npcs.map(npc => worldRosterRow(npc, world.currentDay))
            : [];

        return {
            roster: [...stored, ...inWorld].sort((a, b) =>
                Number(b.alive) - Number(a.alive) ||
                b.realmOrdinal - a.realmOrdinal ||
                a.name.localeCompare(b.name))
        };
    }

    /**
     * How far anybody actually gets, three ways.
     */
    async ladderOdds(): Promise<LadderOddsReport> {
        this.useOwnDb();
        if (!this.adminMode) {
            throw new GameError('Admin mode is off. Set ADMIN_MODE=true to read the ladder odds.', 403);
        }
        const world = await this.loadWorld();
        return ladderOddsReport(world?.seed ?? 'no-world', {}, world ?? undefined);
    }

    /**
     * The world the current run is standing in.
     */
    async loadWorld(): Promise<WorldState | null> {
        this.useOwnDb();
        if (!this.worldEnabled) return null;
        const run = this.repos.runs.getActiveRun() ?? this.repos.runs.latestFinishedRun() ?? null;
        return run ? worldForRun(run) : null;
    }

    // ── engine execution (phase 2) ───────────────────────────────────────

    /**
     * Run one action.
     */
    /**
     * A sentence that contained a plan, carried out in the order it was said.
     */
    private async carryOutThePlan(
        plan: PlanWithSteps,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        rawInput: string
    ): Promise<Execution> {
        const steps = stepsOfThePlan(plan);
        // The old single-call path, byte for byte - but only when there is
        // genuinely nothing else to say. A turn whose OTHER clauses were dropped
        // by the reading layer still has to report them, and taking the shortcut
        // is what left the narrator as the only thing that knew they existed.
        if (steps.length === 1 && !(plan.droppedClauses?.length)) {
            const only = await this.execute(steps[0]!.action, run, cultivator, ambient, rawInput);
            // What the next turn may refer to, read off the classifier the
            // executor already uses rather than off a second judgement. A step
            // the world refused is not something to carry on with, so a refused
            // turn leaves nothing behind and says so.
            if (howTheStepWent(only, steps[0]!) !== 'did_not_come_off') {
                this.ranThisTurn.push(steps[0]!);
            }
            return only;
        }

        const budget = whatThisTurnMayRun(steps, rawInput);
        const done: Execution[] = [];
        let stoppedOn: PlanStep | null = null;
        /** Whether the step that stopped the plan had LANDED. See `howTheStepWent`. */
        let stoppedHavingLanded = false;
        let notReached: readonly PlanStep[] = [];

        // What the clause before this one was about, so "press IT into his hand"
        // reaches the purse rather than a pouch row called "it".
        let lastThingNamed: string | null = null;

        for (let i = 0; i < budget.toRun.length; i++) {
            const asPlanned = budget.toRun[i]!;
            const step = carryingTheReferentForward(asPlanned, lastThingNamed);

            // A CLAUSE THAT ONLY CHOOSES RUNS NO VERB
            if (step.selects) {
                const picked = this.whoTheChoiceLandsOn(cultivator, step.selects);
                if (picked !== null) lastThingNamed = picked.name;
                done.push(this.freeAction(run, 'look', factsForRefusal(
                    picked === null ? 'Nobody here to pick from.' : `You settle on ${picked.name}.`,
                    picked === null
                        ? whatTheChoiceFoundNobody(step.selects)
                        : whatTheChoiceLandedOn(step.selects, picked.name, picked.because),
                    whatTheChoiceLandedOnStructurally(step.selects, picked)
                )));
                done[done.length - 1]!.calls.unshift(
                    theRowThatOpensAStep(step, i, steps.length),
                    theRowForAChoice(step.selects, picked)
                );
                continue;
            }

            lastThingNamed = theThingThisStepNamed(step) ?? lastThingNamed;
            // The world the last step left, re-read rather than remembered.
            const now = this.currentRun();
            const one = await this.execute(
                step.action, now.run, now.cultivator,
                this.ambientFor(now.cultivator, now.run), rawInput
            );
            // Read BEFORE the bookkeeping row goes on, as well as excluding it
            // there. Two guards for one mistake, because the mistake read as a
            // successful theft and cost a played turn to find.
            const went = howTheStepWent(one, step);
            if (went !== 'did_not_come_off') this.ranThisTurn.push(step);
            one.calls.unshift(theRowThatOpensAStep(step, i, steps.length));
            if (step !== asPlanned) {
                one.calls.splice(1, 0, theRowForAResolvedPronoun(asPlanned, step));
            }
            done.push(one);

            // TWO WAYS A PLAN ENDS EARLY, AND THEY ARE DIFFERENT
            const stillAlive = this.currentRun().cultivator.alive;
            if (went === 'did_not_come_off' || !stillAlive) {
                stoppedOn = step;
                stoppedHavingLanded = went !== 'did_not_come_off';
                notReached = budget.toRun.slice(i + 1);
                break;
            }
        }

        // TWO COSTLY ACTS: ASK, AND SAY IT EXACTLY ONCE
        const fork: WhichComesFirst | null = budget.askAbout.length > 0
            ? {
                runId: run.id,
                cultivatorId: cultivator.id,
                raisedOnTurn: this.currentRun().run.turn,
                acts: budget.askAbout
            }
            : null;

        let alreadySaid = false;
        if (fork !== null) {
            this.whichComesFirst = fork;
            if (done.length === 0) {
                done.push(this.freeAction(run, plan.action.action, factsForRefusal(
                    'Both of those take time.',
                    whatTheQuestionAsks(fork),
                    whatTheQuestionAsksStructurally(fork)
                )));
                alreadySaid = true;
            }
        }

        const folded: Execution = foldTheCallsIntoOneTurn(done);

        if (stoppedOn !== null && notReached.length > 0) {
            const said = stoppedHavingLanded
                ? sayingWhatItCostTheRest(stoppedOn, notReached)
                : sayingWhereItStopped(stoppedOn, notReached);
            sayThisWhateverTheNarratorDoes(folded.facts, said);
            folded.calls.push(
                theRowThatSaysWhereItStopped(stoppedOn, notReached, stoppedHavingLanded)
            );
        }

        // Held by the budget, and said WHETHER OR NOT the turn also stopped -
        // they are separate facts about separate steps, and an `else if` here
        // meant a plan that stopped never mentioned what the player had queued.
        if (fork === null && budget.heldForTheQuestion.length > 0) {
            // THE PLAYER ALREADY SAID WHICH COMES FIRST, so nothing was asked -
            // the first act ran and the rest is next turn's. Said once, as a
            // fact about where they now stand rather than as a report about the
            // executor, and on `required` because a player who is not told the
            // second half is still owed will believe it happened.
            sayThisWhateverTheNarratorDoes(
                folded.facts, sayingWhatIsStillToCome(budget.heldForTheQuestion)
            );
            for (const step of budget.heldForTheQuestion) {
                folded.calls.push(theRowForSomethingStillToCome(step));
            }
        } else if (fork !== null) {
            if (alreadySaid) {
                // Already the whole of `prose`, so saying it again is the
                // double-printed ruling a played turn caught. What it still needs
                // is the `required` channel: measured, a model handed nothing but
                // this question wrote "You reach for Cao Antao's purse and press it
                // into Shen Liefeng's hand. Then you walk away." - three acts, none
                // of which happened, off a turn whose only fact was that it was
                // ASKING. `withRequiredLines` appends what the prose left out, at
                // both front doors, so the question reaches the player whatever the
                // narrator felt like writing.
                (folded.facts.required ??= []).push(whatTheQuestionAsks(fork));
            } else {
                sayThisWhateverTheNarratorDoes(folded.facts, whatTheQuestionAsks(fork));
                folded.facts.structure.push(whatTheQuestionAsksStructurally(fork));
            }
            folded.calls.push(theRowThatAsksWhichFirst(fork));
        }

        // One clause the reader read two ways. The losing reading is shown
        // rather than swallowed - AGENTS.md asks for a judgement call to be
        // visible - and it goes to the engine channel only, because it is a
        // fact about the reading rather than about the world.
        for (const { taken, alsoRead } of budget.secondReadings) {
            const line = `One clause, two readings: it was taken as ${taken.action.action}`
                + `${taken.action.target ? `(${taken.action.target})` : '()'}`
                + ` and could also have been read as ${alsoRead.action.action}. `
                + 'One clause is one act, so this was not counted as a second thing to do.';
            folded.facts.structure.push(line);
            folded.calls.push({ name: 'engine.step', action: taken.action.action, summary: line, ok: true });
        }

        // A clause that said WHY rather than naming an act. Shown for the same
        // reason a second reading is - it is a judgement about the sentence and
        // the player is owed the chance to see it - and in the engine channel
        // only, because nothing was declined and nothing was spent. Without
        // this the reason is discounted correctly and silently, which is the
        // half of the rule that the rest of this file exists to refuse.
        for (const reason of budget.statedReasons) {
            folded.calls.push(theRowForAStatedReason(reason));
            folded.facts.structure.push(
                `"${reason.said ?? ''}" was read as the reason for the act beside it rather than `
                + `as a second act. Said on its own it is a request to ${reason.action.action}.`
            );
        }

        for (const over of budget.overTheBound) {
            folded.calls.push(theRowForAStepOverTheBound(over));
        }

        // A CLAUSE THE READING LAYER DROPPED IS SAID TOO.
        if (plan.droppedClauses && plan.droppedClauses.length > 0) {
            // Only what the player actually typed reaches the player. A step the
            // reader ADDED and the check then declined is an inspector row and
            // nothing else - telling somebody an act they never asked for "was
            // not part of what happened" invites them to say it again.
            const theirs = plan.droppedClauses.filter(
                step => theseWereThePlayersOwnWords(step, rawInput)
            );
            if (theirs.length > 0) {
                sayThisWhateverTheNarratorDoes(folded.facts, sayingWhatTheReadingDropped(theirs));
            }
            for (const step of plan.droppedClauses) {
                folded.calls.push(
                    theRowForADroppedClause(step, theirs.includes(step))
                );
            }
        }
        if (budget.overTheBound.length > 0) {
            sayThisWhateverTheNarratorDoes(
                folded.facts, sayingWhatTheBoundCutOff(budget.overTheBound)
            );
        }

        return folded;
    }

    /**
     * Who a choice like "the strongest one" lands on, out of the people here.
     */
    private whoTheChoiceLandsOn(
        cultivator: Cultivator,
        selection: ASelection
    ): { name: string; because: string } | null {
        // GROUND is a choice over PLACES rather than over people, so it has its
        // own row set. Played: "take the road to whichever of them has the best
        // air" - the read had just listed ten places with the band printed on
        // every one of them, and the selection still came out `unspecified`.
        if (selection.field === 'ambient') return this.whereTheGroundIsBest(cultivator, selection);
        if (selection.field !== 'rung' && selection.field !== 'age') return null;

        const nameable = this.present(cultivator).filter(
            person => this.knowledge.isAwareOf(cultivator.id, 'cultivator', person.id)
        );
        if (nameable.length === 0) return null;

        const valueOf = (person: RosterEntry): number =>
            selection.field === 'rung' ? person.realmOrdinal : person.age;
        const best = nameable.reduce((held, person) =>
            (selection.want === 'most' ? valueOf(person) > valueOf(held) : valueOf(person) < valueOf(held))
                ? person
                : held);

        return {
            name: best.name,
            because: selection.field === 'rung'
                ? rankName(best.realmOrdinal)
                : `${Math.floor(best.age)} years old`
        };
    }

    /**
     * The place with the best ground, out of the places this cultivator knows.
     */
    private whereTheGroundIsBest(
        cultivator: Cultivator,
        selection: ASelection
    ): { name: string; because: string } | null {
        const here = loosePlaceKey(cultivator.location ?? '');
        const known = new Set(
            this.awarenessOf(cultivator)
                .filter(row => row.kind === 'place')
                .map(row => loosePlaceKey(row.name))
        );

        const candidates: Array<{ name: string; band: AmbientQi }> = [];
        for (const region of REGIONS) {
            for (const place of region.places) {
                const key = loosePlaceKey(place.name);
                // Somewhere they already are is not somewhere to go.
                if (key === here || !known.has(key)) continue;
                if (AMBIENT_QI_ORDER.indexOf(place.ambient) === -1) continue;
                candidates.push({ name: place.name, band: place.ambient });
            }
        }
        if (candidates.length === 0) return null;

        const depth = (band: AmbientQi): number => AMBIENT_QI_ORDER.indexOf(band);
        const best = candidates.reduce((held, place) =>
            (selection.want === 'most' ? depth(place.band) > depth(held.band) : depth(place.band) < depth(held.band))
                ? place
                : held);

        return { name: best.name, because: describeAmbientPerceived(best.band) };
    }

    private async execute(
        action: PlannedAction,
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        rawInput = ''
    ): Promise<Execution> {
        // A True Immortal is not standing in the province any more.
        if (canExistBeyondTheLid(cultivator) && MORTAL_WORLD_ACTIONS.includes(action.action)) {
            return this.aboveTheLid(run, cultivator, action.action);
        }

        // THE NAME THE VERB DROPPED, PUT BACK BEFORE ANYTHING READS IT
        if (rawInput && (action.target ?? '').trim().length < 2) {
            action = carryWhatOnlyTheSentenceKnows(action, rawInput, this.present(cultivator));
        }

        switch (action.action) {
            // `durationAskedFor` is the UNCLAMPED span in the sentence.
            // `action.days` has already been through `parseDuration`, which
            // silently caps at MAX_CULTIVATION_DAYS - so "I cultivate for 100000
            // years" arrived here as 36500 and the player was told "Seclusion of
            // 100 years was intended", which is the engine reporting its own
            // ceiling as somebody else's intention. Carried so the account can say
            // what was asked and what was capped.
            case 'cultivate':
                // A target on `cultivate` is somebody named as sitting it with
                // them, and the shared road is the only thing that reads it -
                // an ordinary stretch names nobody. Every condition on the
                // partnership is checked there, so a player who names somebody
                // who is not their dao partner is told which condition failed
                // rather than quietly given an ordinary sitting.
                return action.target && action.target.trim().length >= 2
                    ? this.cultivateWithYourDaoPartner(
                        run, cultivator, ambient, action.days ?? DEFAULT_CULTIVATION_DAYS,
                        action.target,
                        {
                            acknowledged: GameService.TAKE_IT_ANYWAY.test(rawInput),
                            askedFor: durationAskedFor(rawInput) ?? undefined
                        }
                    )
                    : this.runSeclusion(
                        run, cultivator, ambient, action.days ?? DEFAULT_CULTIVATION_DAYS,
                        {
                            acknowledged: GameService.TAKE_IT_ANYWAY.test(rawInput),
                            askedFor: durationAskedFor(rawInput) ?? undefined
                        }
                    );

            case 'seclude':
                return this.runSeclusion(
                    run, cultivator, ambient, action.days ?? DEFAULT_SECLUSION_DAYS,
                    {
                        sealed: true,
                        acknowledged: GameService.TAKE_IT_ANYWAY.test(rawInput),
                        askedFor: durationAskedFor(rawInput) ?? undefined
                    }
                );

            case 'breakthrough': {
                const eligibility = canAttemptBreakthrough(cultivator);
                if (!eligibility.eligible) {
                    return refused('engine.canAttemptBreakthrough', 'breakthrough', factsForRefusal(
                        'The barrier does not move.',
                        refusalText(
                            eligibility.reason, eligibility.progressAvailable,
                            eligibility.progressRequired,
                            { held: eligibility.daoHeld, required: eligibility.daoRequired }
                        )
                    ));
                }
                return this.strikeBarrier(run, cultivator, ambient);
            }

            case 'move':
                return this.move(run, cultivator, ambient, action.target, action.intent ?? 'travel');

            case 'ride':
                return this.ride(run, cultivator, action.target, action.topic);

            case 'fold':
                return this.fold(run, cultivator, action.target);

            case 'passage':
                return this.passage(
                    run, cultivator, action.target,
                    action.intent ?? DEFAULT_PASSAGE_INTENT
                );

            case 'oath':
                return this.oath(
                    run, cultivator, action.target, action.intent ?? DEFAULT_OATH_INTENT,
                    action.topic, rawInput
                );

            case 'guard':
                // 护法. Naming somebody spends the span and resolves THEIR crossing;
                // naming nobody is the free read of who would stand over the
                // player's own. Both live in `standing-guard.ts`, and the split is
                // here rather than inside the verb so the free half never touches
                // `loadWorld`.
                return action.intent === GUARD_IS_A_QUESTION
                    ? this.whoWouldStandOverYourCrossing(run, cultivator)
                    : await this.standGuard(
                        run, cultivator, ambient, action.target, action.days
                    );

            case 'investigate':
                return this.investigate(run, cultivator, ambient, action.target);

            case 'attack':
                // `terms` reaches the consequence layer and nothing else. See
                // the header on `attack` and on `whatFollowedTheBout`.
                // `opening` reaches the resolver and decides who gets the first
                // round; it decides nothing about what a blow does to a body.
                return this.attack(
                    run, cultivator, ambient, action.target, action.intent ?? 'drive_off',
                    action.terms ?? 'open', action.opening ?? 'open'
                );

            case 'coerce': {
                // ── THE ART NEEDS BOTH OF THEM ───────────────────────────
                //
                // Before the resolver, because a furnace use that cannot open
                // is not a fight somebody lost - it is a thing that was never
                // available, and saying so is the answer. See
                // `an-art-that-needs-both-of-them.ts`.
                if (action.intent === 'furnace') {
                    const whoWith = this.somebodyAtHand(action.target ?? '', cultivator)
                        ?? (action.target
                            ? this.present(cultivator).find(row =>
                                row.name.toLowerCase() === action.target!.trim().toLowerCase())
                            : undefined);
                    const why = whyTheRiteWillNotOpen(
                        theirHalfOfTheRite(this.repos, cultivator.id),
                        whoWith
                            ? theirHalfOfTheRite(this.repos, whoWith.id)
                            : { takingArt: null, spendingArt: null, stage: 0 },
                        whoWith?.name ?? 'them'
                    );
                    if (why) {
                        return this.freeAction(run, 'coerce', factsForRefusal(
                            why.headline, why.said, why.account
                        ));
                    }
                }
                return this.attack(
                    run, cultivator, ambient, action.target, 'coerce', 'open',
                    action.opening ?? 'open', action.intent ?? 'submit'
                );
            }

                // The same resolver as `attack`, at a different goal. Hands
                // rather than words, and the aggressor wants them complying and
                // still standing rather than stopped - see the header on
                // `coerce` in `actions.ts` for why it is its own verb and not a
                // second door onto `threaten`.
                return this.attack(
                    run, cultivator, ambient, action.target, 'coerce', 'open',
                    action.opening ?? 'open', action.intent ?? 'submit'
                );

            case 'interact':
                return this.interact(
                    run, cultivator, ambient, action.target, action.intent ?? 'talk', action.topic,
                    // The leverage the parser recognised, and the player's own
                    // sentence. The resolver reads the first and echoes the
                    // second; neither is a branch on the verb.
                    action.leverage, rawInput
                );

            case 'train_technique':
                // The span the player named, which this dropped entirely. See
                // `train`.
                return this.train(cultivator, action.target, action.days);

            case 'craft':
                // `days` is a span the player named and nothing else; absent,
                // `planTheBuild` spends `DAYS_AT_THE_BENCH` and says the figure
                // out loud. `rawInput` is read for one question - whether they
                // are walking away from what is on the stocks - because the
                // word that says so is never the object of the verb.
                return this.craft(
                    run, cultivator, ambient, action.target, action.days, rawInput
                );

            case 'refine':
                return this.refine(run, cultivator, action.target);

            case 'gather':
                return this.gather(run, cultivator, ambient, action.target);

            case 'hunt':
                return this.hunt(run, cultivator, ambient, action.target);

            case 'wait': {
                const waiting = await this.shortSkip(
                    run, cultivator, ambient, WAITING_FOCUS, 'Waiting',
                    action.days ?? SHORT_ACTION_DAYS
                );
                const noticedWaiting = this.notice(cultivator, run, 'wait');
                if (noticedWaiting) {
                    waiting.facts.lines.push(noticedWaiting);
                    waiting.facts.prose = `${waiting.facts.prose}

${noticedWaiting}`;
                }
                const heard = this.hear(cultivator, run, 'wait', null, { intent: 'listening' });
                if (heard) {
                    waiting.hearing = heard;
                    addHearing(waiting.facts, heard);
                    waiting.calls.push(hearingCall(heard));
                }
                return waiting;
            }

            case 'eat':
                return this.eat(run, cultivator);

            case 'provision':
                return this.provision(run, cultivator, action.days, action.rations, {
                    // The unclamped span in the sentence, so a request the
                    // engine had to cut down can be said rather than silently
                    // reduced. Same source `cultivate` uses.
                    askedFor: durationAskedFor(rawInput) ?? undefined
                });

            case 'status': {
                const eligibility = canAttemptBreakthrough(cultivator);
                // The ceiling belongs on the status read, not only in a
                // digest forty lines long that a player sees after the decade
                // is already spent. Asking "how am I doing" and being told
                // "0 of 100 toward the next rank" while the true answer is
                // "nothing will ever accumulate" is a status screen that lies
                // by omission.
                const sheet = this.freeAction(run, 'status', factsForStatus(
                    cultivator, ambient, eligibility.progressRequired, eligibility.eligible,
                    techniqueCeiling(
                        cultivator.realmOrdinal, this.rateTermsFor(cultivator).techniqueCap,
                        // Or the sheet sends somebody to buy a book that is in
                        // their bag. See `techniqueCeiling`.
                        copiesHeldBy(this.db, cultivator.id).length > 0
                    ).line
                ));
                // AND A PROBATIONER IS NOT SOMEBODY WHO SERVES NO HOUSE
                const onProbation = probationOf(this.repos, cultivator, run);
                if (onProbation) {
                    // AND IF IT HAS BEEN DECIDED, IT HAS BEEN DECIDED. The
                    // scoring happens on the house's clock rather than on a
                    // turn, and the commonest sentence a person in this
                    // position types is this one - so a placement that only
                    // fired on the word "guest" would be reachable in a test
                    // and not in a life.
                    const applied = onProbation.outcome === 'carried'
                        ? null
                        : applyProbation(this.repos, cultivator, run, onProbation);
                    const line = applied
                        ? applied.narrationHint
                        : `On ${onProbation.factionName}'s intake roll, `
                          + `${Math.round(onProbation.yearsOnTheRoll)} years in, and on nobody's `
                          + 'house roll. Fed and taught and holding no rung, with no claim on the '
                          + 'house and no claim to its name.';
                    sheet.facts.lines.push(line);
                    sheet.facts.prose = `${sheet.facts.prose}\n${line}`;
                    sheet.facts.structure.push(
                        applied
                            ? `sect probation ${applied.outcome}`
                              + `${applied.band ? ` (${applied.band})` : ''}: `
                              + `${applied.yearsOnTheRoll}y on the roll, taken at `
                              + `${applied.ageAtIntake}, now ${applied.ageNow}; apex ceiling `
                              + `${applied.apexAgeCeiling}. ${applied.reason}`
                            : `sect probation carried: ${onProbation.reason}`
                    );
                }
                return sheet;
            }

            case 'work':
                return this.work(
                    cultivator, action.days ?? DEFAULT_WORK_DAYS, action.target, action.intent
                );

            case 'market':
                return this.market(run, cultivator, action.target);

            case 'sect':
                return this.sect(run, cultivator, ambient, action.target, action.intent, action.topic, action.days);

            case 'recall':
                return this.recall(run, cultivator, action.target, action.intent);

            case 'recognise':
                return this.recognise(run, cultivator, action.target, action.topic);

            case 'news':
                return this.news(run, cultivator);

            // Carrying the news the other way. `news` is the player finding out;
            // this is the player being the person somebody else finds out from,
            // through the same join and into the same ledger.
            case 'tell': {
                // The telling is read against the world's own history, so the
                // world has to be in hand. Loaded the way `roads` loads it.
                this.atHand = this.atHand ?? await this.loadWorld();
                return this.tellSomebody(run, cultivator, action.target, action.topic);
            }

            // ── institutions acting on each other, and on the dead ──
            //
            // Four verbs, one shape, and one rule they all obey: the intent
            // label selects which routine runs and never what came of it, and
            // an unrecognised label falls through to the READ rather than to
            // the commitment. See the four DEFAULT_* constants in actions.ts.
            case 'petition':
                return this.petition(run, cultivator, action.target, action.intent, action.topic);

            case 'posture':
                return this.posture(run, cultivator, action.target, action.intent);

            case 'seal':
                return this.seal(run, cultivator, action.target, action.intent);

            case 'offer':
                return this.offer(run, cultivator, action.target, action.intent, action.topic);

            // Going back down, which is the one thing at the top of the ladder
            // that is a decision rather than a fact about what you already are.
            case 'descend':
                return this.descend(run, cultivator, ambient, action.target);

            case 'treat':
                return this.treat(run, cultivator, ambient);

            case 'buy':
                return this.buy(run, cultivator, ambient, action.target);

            case 'sell':
                return this.sell(run, cultivator, action.target);

            case 'give':
                return this.giveSomething(
                    run, cultivator, action.target, action.topic, action.stones
                );

            case 'inventory':
                // The RAW sentence, because which of the two questions was
                // asked - what is ON me, or what do I HAVE - is a property of
                // the words and not of a field a model filled in. Same rule
                // `legacyAct` keeps for the form of words.
                return this.inventory(run, cultivator, rawInput);

            case 'propose':
                // `topic` is what is being put on the table, in the player's
                // own words, and nothing downstream branches on what kind of
                // thing it is. The list of what may go there is open.
                return this.proposeAMatch(
                    run, cultivator, ambient, action.target, action.topic,
                    action.intent ?? 'propose', action.leverage, rawInput
                );

            case 'decline':
                return this.declineAMatch(run, cultivator, action.target, rawInput);

            case 'child':
                return this.haveAChild(
                    run, cultivator, ambient, action.target, action.days,
                    action.intent ?? 'have'
                );

            case 'consume_pill':
                return this.consumePill(run, cultivator, action.target, rawInput);

            case 'list_techniques':
                return this.listTechniques(run, cultivator, action.target);

            case 'acquisition':
                // "what are my options" is understood as a question about how the
                // manual in your hands could go further. That is a good read and it
                // is the wrong one for somebody who has just started and is asking
                // what the game is - measured in a real run, where the sentence
                // answered about the manual only. The two are told apart by whether
                // the sentence is about a book; anything that mentions one keeps
                // the answer it had.
                if (ASKING_WHAT_IS_POSSIBLE.test(rawInput) && !ABOUT_A_MANUAL.test(rawInput)) {
                    return this.guidance(run, cultivator, ambient);
                }
                return this.acquisition(run, cultivator, action.target);

            // ── the three questions a stuck player asks ──
            //
            // All reads, all free. See the ACTION_NAMES entries for the
            // measurement that made them necessary, and the banner in each
            // module for what it may and may not say.
            case 'ceiling':
                return this.ceiling(run, cultivator, ambient);

            case 'teacher':
                return this.teacher(run, cultivator);

            // Asking a named person for a named thing. The read the roster
            // question gives is the answer to "who could teach me"; this is
            // what happens when you walk up to one of them.
            case 'request':
                return this.request(
                    run, cultivator, ambient, action.target, action.intent ?? 'a_thing',
                    action.topic, action.leverage, rawInput
                );

            case 'destinations':
                return this.destinations(run, cultivator);

            case 'roads':
                this.atHand = this.atHand ?? await this.loadWorld();
                return this.roadsWithinReach(run, cultivator);

            case 'learn_technique':
                return this.learnTechnique(cultivator, action.target);

            case 'site':
                return this.site(run, cultivator, ambient, action.target, action.intent);

            case 'legacy':
                return this.legacyAct(
                    run, cultivator, action.intent, action.target, rawInput, action.days
                );

            case 'assess':
                return this.assess(cultivator, action.target);

            case 'unclear': {
                // `help` and `what can I do` land here, and until now they got
                // the refusal. Those are the two most universal inputs in the
                // history of text games; a game that refuses both has hidden
                // its own verb space behind a guess. Answered before the
                // refusal is composed, because they are not a failure to parse
                // - they are the one question the parser was never asked.
                if (ASKING_WHAT_IS_POSSIBLE.test(rawInput)) {
                    return this.guidance(run, cultivator, ambient);
                }

                // The cheapest action available, and the whole reason it is in the
                // closed set: no time, no food, no roll, no death. A player may
                // type something ambiguous a hundred times and lose nothing but a
                // moment.
                const pressing = theMostPressing(
                    whatIsWorthDoingStandingHere(this.whatIsLiveHere(cultivator, ambient, run)),
                    3
                );
                const unread = this.freeAction(run, 'unclear', factsForRefusal(
                    'The thought does not resolve.',
                    'You turn the thought over and it does not resolve into anything you could ' +
                    'actually do standing here.\n\n' +
                    'Things that would, at this moment:\n' +
                    linesFor(pressing).map(line => `  ${line}`).join('\n') + '\n\n' +
                    // World voice, and `voice.test.ts` is why: naming the
                    // software here would put a sentence about the program in
                    // front of somebody who is meant to be standing in a
                    // village. Say what is true instead - the list is not a
                    // list of permitted words.
                    'Those are not the only words that work. Say what you mean to do, '
                    + 'and find out what it costs.'
                ));
                // The sentence itself goes to the inspector, where somebody
                // tuning the parser can read exactly what it failed on.
                unread.calls = [{
                    name: 'engine.parseIntent',
                    action: 'unclear',
                    summary: `Intent not recognised; no action taken. Raw input: "${rawInput.slice(0, 160)}"`,
                    ok: false
                }];
                return unread;
            }

            case 'look': {
                // Looking round on the far side of the Lid is a different read from
                // looking round in a province, and it used to be the same one. What
                // that produced, found by playing at 46: the ambient description of
                // a layer whose qi density is 1.0 by definition, a Dao house's
                // practice observed among people who are not there, and two names
                // overheard through a wall in a province on the other side of a
                // hole. Every one of those is a mortal -layer read applied to
                // somebody who has left it.
                if (canExistBeyondTheLid(cultivator)) {
                    return this.lookAbove(run, cultivator);
                }

                // Why the ground is like this, which is a different read from
                // what is standing on it. Answered out of the location's own
                // change log, and gated: what the place is and when it changed
                // are physical, and the cause is knowledge.
                if (action.intent === 'history') {
                    return this.placeHistory(run, cultivator, action.target);
                }

                // WHO ELSE IS DRAWING ON THIS GROUND.
                if (action.intent === 'ground_time') {
                    this.atHand = this.atHand ?? await this.loadWorld();
                    return this.freeAction(run, 'look', factsForGroundTime(
                        cultivator,
                        this.sectNameFor(cultivator),
                        this.groundEntitlement(cultivator)
                    ));
                }

                // WHO ANSWERS FOR THIS GROUND, ASKED FOR DELIBERATELY.
                if (action.intent === 'holder') {
                    this.atHand = this.atHand ?? await this.loadWorld();
                    return this.whoAnswersHere(run, cultivator);
                }

                if (action.intent === 'crowding') {
                    this.atHand = this.atHand ?? await this.loadWorld();
                    const crowding = this.crowdingHere(cultivator);
                    return this.freeAction(run, 'look', crowding
                        ? factsForToolResult(
                            `${crowding.heads === 1 ? 'You have it to yourself.' : 'You are not alone on it.'}`,
                            [crowding.line]
                        )
                        : factsForRefusal(
                            'Nothing here is measurable.',
                            'You take the measure of the ground and of who is standing on it, and '
                            + 'there is nothing here the engine holds a reading for.'
                        ));
                }

                // WHAT IS NAILED TO THE WALL, ASKED FOR DELIBERATELY.
                if (action.intent === 'bills') {
                    const wall = readTheWall(this.knowledge, cultivator, run);
                    return this.freeAction(run, 'look', wall.lines.length > 0
                        ? factsForToolResult(
                            `There is paper up in ${placeName(cultivator)}.`,
                            wall.lines
                        )
                        : factsForRefusal(
                            'Nothing is posted here.',
                            'You go looking for a wall with paper on it. Either there is no '
                            + 'wall, or nobody who needs people has been through lately.'
                        ));
                }

                const company = this.company(cultivator);
                const standing = this.standingHere(cultivator);
                // AND WHETHER ANYTHING IS WRONG WITH THIS GROUND
                const groundHere = this.worldPlaceOf(cultivator);
                const wrong = this.atHand && groundHere
                    ? whatIsWrongWithThisGround({
                        statuses: this.atHand.statuses,
                        locations: this.atHand.locations,
                        locationId: groundHere,
                        day: Math.floor(this.atHand.currentDay),
                        heldStage: this.knowledge.stageOf(cultivator.id, 'place', groundHere),
                        standingHere: true
                    })
                    : null;
                // And the quiet-day fallback is a claim about the GROUND, so
                // it does not get to stand above a war. Everything `look` says
                // about the person is untouched; `factsForLook` drops only the
                // nothing-is-wrong line, and only when the ground contradicts
                // it.
                const groundIsQuiet = !wrong || wrong.lines.length === 0;
                const looking = this.freeAction(
                    run, 'look',
                    action.intent === 'company'
                        ? factsForCompany(cultivator, company, standing)
                        : factsForLook(cultivator, ambient, company, standing, groundIsQuiet)
                );
                if (wrong) {
                    for (const line of wrong.lines) {
                        looking.facts.lines.push(line);
                        looking.facts.prose = `${looking.facts.prose}

${line}`;
                    }
                    looking.facts.structure.push(
                        `whatIsWrongWithThisGround: ${wrong.lines.length} line(s) at stage `
                        + `${wrong.stage} over ${wrong.running} status(es) running here.`
                    );
                }
                // AND WHO ANSWERS FOR IT, WHERE NOBODY DOES
                if (this.atHand && groundHere) {
                    const holder = whoAnswersForThisGround({
                        locations: this.atHand.locations,
                        locationId: groundHere,
                        standingHere: true,
                        // The second caller, and the one that was bypassing the
                        // gate. `whoAnswersHere` in `situated-reads.ts` has
                        // passed this since the gate landed; this did not, so
                        // walking to a door refused the holder's name while
                        // looking round from outside handed it over - measured
                        // at 220 of 220 barred held locations.
                        readerOrdinal: cultivator.realmOrdinal
                    });
                    for (const line of holder.lines) {
                        looking.facts.lines.push(line);
                        looking.facts.prose = `${looking.facts.prose}

${line}`;
                    }
                    looking.facts.structure.push(holder.structure);

                    // AND BEING HERE IS HEARING OF THEM
                    const introduced = whoBeingHereIntroducesYouTo(
                        this.atHand.locations, groundHere
                    );
                    if (introduced && introduced.factionName) {
                        (looking.perceived ??= []).push({
                            names: [{
                                kind: 'sect',
                                id: introduced.factionId,
                                name: introduced.factionName,
                                stage: 'named',
                                statement: howStandingHerePutIt(introduced)
                            }],
                            note: 'They hold the ground this cultivator was standing on.',
                            sourceKind: 'witnessed'
                        });
                    }
                }
                // And the wall, but only where it has something the player has
                // not already read. Looking round a market town every day for a
                // season must not reprint the same two posters; a bill whose
                // house is already held writes nothing through `learnIfNew` and
                // is dropped here on exactly that signal, so nothing has to
                // remember that this player has stood here before.
                const posted = readTheWall(this.knowledge, cultivator, run);
                for (const line of posted.newLines) {
                    looking.facts.lines.push(line);
                    looking.facts.prose = `${looking.facts.prose}

${line}`;
                }
                // AND WHO IN THE SQUARE IS TRADING
                const trading = readWhatIsOnOfferHere(
                    cultivator, this.atHand, this.alreadyHasACopyOf(cultivator)
                );
                const cheapest = trading.offers[0];
                if (cheapest) {
                    const sellers = new Set(trading.offers.map(o => o.sellerId)).size;
                    const line =
                        `${sellers === 1 ? 'Somebody here is' : `${sellers} people here are`} `
                        + 'carrying something they would rather have the stones for, and not '
                        + `hiding it. A copy of ${cheapest.name} is going for `
                        + `${cheapest.askStones}. "what is for sale" is the whole of what is `
                        + 'being asked here, stalls and people both.';
                    looking.facts.lines.push(line);
                    looking.facts.prose = `${looking.facts.prose}

${line}`;
                }
                // Two people talking on the far side of a wall, who were having
                // the conversation anyway. Nothing here is staged for the
                // player, which is exactly why it is worth anything.
                const noticed = this.notice(cultivator, run, 'look');
                if (noticed) {
                    looking.facts.lines.push(noticed);
                    looking.facts.prose = `${looking.facts.prose}

${noticed}`;
                }
                const heard = this.hear(cultivator, run, 'look', null);
                if (heard) {
                    looking.hearing = heard;
                    addHearing(looking.facts, heard);
                    looking.calls.push(hearingCall(heard));
                }
                return looking;
            }
        }
    }

    // ── the three semantic actions ───────────────────────────────────────

    // A WORD GIVEN, CARRIED, OR NOT KEPT

    /**
     * What kind of word this is, out of the causes the ledger already carries.
     */
    private whatKindOfOath(said: string): OathCause {
        if (/\b(?:brother|brotherhood|sister|sibling|sworn kin)\b/.test(said)) {
            return 'sworn_brotherhood';
        }
        if (/\b(?:silence|say nothing|never speak|keep .*secret|not to tell)\b/.test(said)) {
            return 'silence';
        }
        if (/\b(?:blood pact|blood oath|in blood)\b/.test(said)) return 'blood_pact';
        if (/\b(?:life|saved me|owe (?:him|her|them) my life)\b/.test(said)) return 'debt_of_life';
        if (/\b(?:service|serve|years|term|indenture)\b/.test(said)) return 'service_term';
        if (/\b(?:sect|house|school|order|clan)\b/.test(said)) return 'sect_vow';
        return 'other';
    }

    /**
     * Swearing one, reading what you carry, and not keeping it.
     */
    private oath(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string,
        topic: string | undefined,
        rawInput: string
    ): Execution {
        const today = Math.floor(run.elapsedDays);
        const carried = openOathsHeldBy(this.repos, cultivator.id);
        const nameOf = (id: string): string =>
            this.repos.cultivators.getById(id)?.name
            ?? SECTS.find(s => s.id === id)?.name
            ?? id;

        // ── WHAT THEY ARE ALREADY UNDER ──────────────────────────────────
        if (intent === 'read' || (intent !== 'swear' && intent !== 'break')) {
            const lines: string[] = carried.length === 0
                ? [
                    'Nothing. No word of yours is on anybody\'s ledger, which is a lighter thing '
                    + 'to be than it sounds: nobody is owed your service and nobody has your '
                    + 'name written against a penalty clause.'
                ]
                : carried.map(row => {
                    const owed = nameOf(row.subjectId);
                    const term = row.dueOnDay === null
                        ? 'No day is written into it.'
                        : `Due on day ${row.dueOnDay}, which is `
                            + `${Math.max(0, Math.round((row.dueOnDay - today) / 365))} year(s) off.`;
                    return `${row.cause.replace(/_/g, ' ')}, at ${row.severity}, owed to ${owed}. `
                        + `${row.terms ?? row.description} ${term}`;
                });

            if (carried.length > 0) {
                lines.push(WHAT_RUNNING_COSTS);
                if (carried.some(row => row.cause === 'service_term')) {
                    lines.push(
                        WHAT_THE_END_OF_A_TERM_LEAVES.standing,
                        WHAT_THE_END_OF_A_TERM_LEAVES.whatTheYearsDid
                    );
                }
                lines.push(WHERE_IT_WAS_SWORN_MAY_MATTER_AND_NOBODY_CAN_SAY);
            }

            const facts = factsForToolResult(
                carried.length === 0
                    ? 'You are bound by nothing.'
                    : `${carried.length} open oath${carried.length === 1 ? '' : 's'}.`,
                lines
            );
            facts.structure.push(
                `openOathsHeldBy: ${carried.length} row(s) - `
                + `${carried.map(r => `${r.id}:${r.cause}:${r.severity}`).join(', ') || 'none'}.`
            );
            return this.freeAction(run, 'oath', facts);
        }

        // ── NOT KEEPING ONE ──────────────────────────────────────────────
        if (intent === 'break') {
            if (carried.length === 0) {
                return refused('engine.openOathsHeldBy', 'oath', factsForRefusal(
                    'There is nothing to break.',
                    'You go looking for the word you gave and cannot find one. Nobody holds a '
                    + 'penalty clause with your name on it, and a thing nobody is owed cannot '
                    + 'be walked out of.',
                    'No open oath held by this cultivator. Nothing written, no time passed.'
                ));
            }
            const wanted = (target ?? '').trim().toLowerCase();
            const binding = (wanted.length >= 2
                ? carried.find(row => nameOf(row.subjectId).toLowerCase().includes(wanted))
                : undefined)
                ?? carried[0];

            const cost = whatWalkingOutOfItCosts({
                binding,
                leaverId: cultivator.id,
                leaverName: cultivator.name,
                onDay: today
            });

            const written: string[] = [];
            for (const row of [cost.reopened, cost.opened]) {
                if (!row) continue;
                const record = createObligation(row);
                writeObligation(this.db as unknown as DatabaseHandle, record);
                written.push(`${record.kind} at ${record.severity}, held by ${record.holderId}`);
            }
            writeObligation(
                this.db as unknown as DatabaseHandle,
                settleObligation(binding, {
                    resolution: 'oath_released',
                    onDay: today,
                    byId: cultivator.id,
                    note: 'Not by agreement. They stopped keeping it.'
                })
            );

            const facts = factsForToolResult(
                `The word to ${nameOf(binding.subjectId)} is not being kept.`,
                [
                    cost.note,
                    cost.opened.description,
                    WHAT_RUNNING_COSTS,
                    'Nothing came out to stop you, and nothing was going to. What the witnessing '
                    + 'house does about a broken word is structural rather than punitive, and it '
                    + 'is not a thing that happens in an afternoon.'
                ]
            );
            facts.structure.push(
                `whatWalkingOutOfItCosts: broke ${binding.id} (${binding.cause} at `
                + `${binding.severity}); wrote ${written.join('; ') || 'nothing'}; the oath is `
                + 'closed as oath_released rather than deleted.'
            );

            return {
                facts,
                events: [],
                timeSkip: null,
                breakthrough: null,
                outcome: 'executed',
                calls: [{
                    name: 'engine.whatWalkingOutOfItCosts',
                    action: 'oath',
                    summary:
                        `${binding.id} released; a ${cost.opened.severity} grudge for broken_oath `
                        + `now stands with ${cost.opened.holderId} against ${cultivator.name}`
                        + `${cost.reopened ? ', and what it was closing is open again' : ''}.`,
                    ok: true
                }]
            };
        }

        // ── GIVING ONE ───────────────────────────────────────────────────
        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();
        if (query.length < 2) {
            return refused('engine.resolveParty', 'oath', factsForRefusal(
                'A word given to whom?',
                'An oath is sworn TO somebody. An unwitnessed word binds nobody and is not a '
                + `contract, it is a sentence said out loud. ${this.whoIsAbout(cultivator)}`,
                'Unresolved party: oath sworn with no subject named. No time passed.'
            ));
        }
        const party = this.partyPutTo(cultivator, query, scope);
        if (!party) return this.nobodyByThatName(cultivator, query, scope, 'oath');

        const said = `${topic ?? ''} ${rawInput}`.toLowerCase();
        const cause = this.whatKindOfOath(said);

        // WHO PUTS THEIR NAME TO IT
        const witnessed = party.kind === 'sect'
            ? theOathwrightWouldWitnessFor(party.id)
            : true;
        const oathwright = getSect(THE_OATHWRIGHT_HOUSE)?.name ?? 'the oathwright house';
        const witnessNote = witnessed
            ? `Witnessed by ${oathwright}, which is what makes it a contract rather than a `
                + 'sentence said out loud. An unwitnessed word binds nobody.'
            : THE_OATHWRIGHT_WILL_NOT_WITNESS_FOR[party.id];

        const already = carried.find(row => row.subjectId === party.id && row.cause === cause);
        if (already) {
            return refused('engine.openOathsHeldBy', 'oath', factsForRefusal(
                'That word is already given.',
                `You are already bound to ${party.name} on exactly this, from day `
                + `${already.incurredOnDay}. Saying it twice adds nothing: the ledger has one `
                + 'row, and one row is what a witness will read out.',
                `Open oath ${already.id} already stands. Nothing written, no time passed.`
            ));
        }

        // WHAT WAS SWORN, in the swearer's own words where they said, and in
        // the engine's where they did not. Never the raw sentence: `terms` is
        // read back by the oath read and by anybody looking at the ledger in
        // eighty years, and "I swear an oath to the Azure Dew Sect" quoted back
        // as the terms of the oath is the transcript leaking into the record.
        const terms = (topic ?? '').trim().length >= 2
            ? (topic as string).trim()
            : `${cultivator.name} gave their word to ${party.name} and did not say what for. `
                + 'That is a real oath and a thin one: what a witness can hold anybody to is '
                + 'what was said in front of them.';
        const record = createObligation({
            kind: 'oath',
            holderId: cultivator.id,
            subjectId: party.id,
            cause,
            // A witnessed word with nothing behind it. The heavier weights belong
            // to an oath that CLOSES something - `settleItWithABinding` writes one
            // exactly as heavy as the account it discharged, on the argument that a
            // lighter oath would be cheaper to break than what it replaced. Nothing
            // is being discharged here, so nothing licenses a heavier row, and
            // `slight` is the ledger's word for an unpleasantness rather than for a
            // promise.
            severity: 'serious',
            onDay: today,
            description:
                `${cultivator.name} swore to ${party.name}. ${witnessed
                    ? 'It was witnessed.'
                    : 'The premier oathwright would not put its name to it.'}`,
            terms,
            dueOnDay: null,
            participants: [party.id, ...(witnessed ? [THE_OATHWRIGHT_HOUSE] : [])],
            tags: ['sworn', `cause:${cause}`, witnessed ? 'witnessed' : 'unwitnessed']
        });
        writeObligation(this.db as unknown as DatabaseHandle, record);

        const facts = factsForToolResult(
            `A word given to ${party.name}.`,
            [
                `${cause.replace(/_/g, ' ')}, at ${record.severity}, and there is no day written `
                + 'into it. It stands until it is discharged or until it is not kept.',
                terms,
                witnessNote,
                WHAT_RUNNING_COSTS,
                WHERE_IT_WAS_SWORN_MAY_MATTER_AND_NOBODY_CAN_SAY
            ]
        );
        facts.structure.push(
            `createObligation: oath ${record.id}, cause ${cause}, severity ${record.severity}, `
            + `holder ${cultivator.id}, subject ${party.id}, `
            + `witness ${witnessed ? THE_OATHWRIGHT_HOUSE : 'none'}. `
            + 'Permanent until settled, and inheritable.'
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'social.createObligation',
                action: 'oath',
                summary:
                    `${cultivator.name} holds an oath (${cause}) about ${party.id}, open from `
                    + `day ${today}, ${witnessed ? 'witnessed' : 'unwitnessed'}. `
                    + 'It does not settle on its own.',
                ok: true
            }]
        };
    }


    // ONE TARGET RESOLVER, FOR EVERY VERB AIMED AT A PERSON

    /**
     * The party a sentence is aimed at: a pointed-at face, a named person, or a
     * faction. Null when it is none of those.
     */
    partyPutTo(
        cultivator: Cultivator,
        query: string,
        scope: KnowledgeScope,
        pointedAt: RosterEntry | null = this.somebodyAtHand(query, cultivator)
    ): ResolvedEntity | null {
        return pointedAt
            ? resolveCultivator(
                this.repos, pointedAt.name, cultivator.id, scope, cultivator.realmOrdinal
            )
            : resolveParty(this.repos, query, cultivator, scope);
    }

    /**
     * The refusal for a name that resolved to nobody, with the room attached.
     */
    nobodyByThatName(
        cultivator: Cultivator,
        query: string,
        scope: KnowledgeScope,
        action: ActionName
    ): Execution {
        const here = this.present(cultivator);
        const nameable = here
            .filter(row => this.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id))
            .map(row => row.name);

        // Two different states, and only one of them is the player's fault.
        // Naming people they already know leaks nothing - `look` lists exactly
        // those - and saying "there are people here and you have no name for any
        // of them" leaks nothing either, which is the sentence `whoWouldTeach`
        // already uses for the same situation.
        const nextMove = nameable.length > 0
            ? ` Whoever you meant, the people here you could actually put it to are `
              + `${nameable.slice(0, 4).join(', ')}.`
            : here.length > 0
                ? ` There are ${here.length} people about and you have a name for none of them. `
                  + 'Somebody has to be introduced, or overheard, before they can be asked for '
                  + 'anything.'
                : '';

        return refused('engine.resolveParty', action, factsForRefusal(
            'Nobody by that name.',
            this.blankLook(cultivator) + nextMove,
            `"${query}" matched nobody: no knowledge record for that name and nobody `
            + `standing here it could have meant. ${here.length} `
            + `${here.length === 1 ? 'person is' : 'people are'} present and `
            + `${nameable.length} of them can be named. `
            + `${this.knownNamesLine(cultivator, scope)}`
        ));
    }

    /**
     * Approaching a person or a faction.
     */
    interact(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string,
        topic?: string,
        leverage?: ApproachLeverage,
        rawInput = ''
        // Every branch but one is still synchronous and free; the attempt path
        // spends real days and has to await the span.
    ): Execution | Promise<Execution> {
        const scope = this.scopeFor(cultivator);

        // WHOSE IT IS, ASKED OF THE WORLD, BEFORE IT IS CALLED A THEFT
        if (intent === 'take') {
            const thing = (topic ?? '').trim();
            topic = undefined;
            if ((target ?? '').trim().length >= 2) {
                intent = 'steal';
                topic = thing;
            } else {
                const decided = this.whoseThingIsBeingTaken(cultivator, thing, rawInput);
                if (decided.state !== 'theirs' || !decided.holder) {
                    return this.aTakingThatWasNotOne(run, cultivator, decided);
                }
                intent = 'steal';
                topic = thing;
                target = decided.holder.name;
            }
            leverage = leverage ?? 'force';
        }

        const query = (target ?? '').trim();

        // A SET IS NOT ONE PERSON, AND THAT IS TRUE OF EVERY VERB
        //
        // The design owner, having listed the ways a set gets named - everyone
        // here, somebody's family, a whole house, all the righteous sects -
        // *and replace kill with other verb too*. `attack` had the loop and
        // nothing else did, so "I rob his whole family" resolved to the last of
        // the crowd order and the other four went unrobbed.
        const asASet = query.length >= 2 ? theSetThisNames(query) : null;
        if (asASet) {
            return this.actOverASet(
                cultivator,
                asASet,
                'interact',
                member => {
                    const now = this.currentRun();
                    return Promise.resolve(this.interact(
                        now.run, now.cultivator, this.ambientFor(now.cultivator, now.run),
                        member.name, intent, topic, leverage, rawInput
                    ));
                },
                {
                    headline: 'Nobody that fits is standing here.',
                    prose: 'You look for them and the moment goes past you. There is nobody in '
                        + 'front of you that the thought fits, and standing here deciding is its '
                        + 'own answer.',
                    note: 'Nothing was put to anybody.'
                },
                false
            );
        }

        // A THEFT'S TOPIC IS A THING, NOT A QUESTION
        const named = intent === 'steal' ? topic : undefined;
        if (named !== undefined) topic = undefined;

        // A QUESTION WITH WEIGHT BEHIND IT IS NOT A QUESTION
        if (topic && topic.length >= 2 && ATTEMPT_INTENTS.has(intent)) {
            // A NAME IS NOT A DESCRIPTION, AND THE DIFFERENCE IS THE WHOLE GUARD
            const atHand = this.present(cultivator);
            const namedParty = query.length >= 2
                ? this.partyPutTo(cultivator, query, scope)
                : null;
            const mayReachForABystander = query.length < 2 || POINTING.test(query);
            const who = namedParty
                ? atHand.find(row => row.id === namedParty.id) ?? null
                : mayReachForABystander
                    ? atHand[atHand.length - 1] ?? null
                    : null;
            const leanedOn = namedParty
                ?? (who ? this.partyPutTo(cultivator, who.name, scope, who) : null);
            if (who && leanedOn && leanedOn.kind === 'cultivator' && leanedOn.party) {
                return this.demandOf(
                    run, cultivator, ambient, leanedOn, who, intent, leverage, topic, rawInput, scope
                );
            }
            // Nobody here to lean on, or a name that resolved to nobody. Falls
            // through deliberately: the paths below already own every refusal
            // for a person who is not there, and duplicating one here would be
            // a second wrong answer to keep in step with the first.
        }

        // A question put to nobody in particular is still put to somebody:
        // asking around a village means asking whoever is at hand. Only
        // when a question was actually asked, though - an approach with no
        // subject and no topic is the player not having said who.
        if (query.length < 2 && topic && topic.length >= 2) {
            const atHand = this.present(cultivator);
            if (atHand.length > 0) {
                return this.askAround(run, cultivator, atHand[atHand.length - 1], topic, scope);
            }
        }

        if (query.length < 2) {
            return refused('engine.resolveParty', 'interact', factsForRefusal(
                'Nobody in particular.',
                this.whoIsAbout(cultivator),
                'Unresolved party: no subject named, and nobody is co-located to have meant. ' +
                `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        // Pointed at rather than named: whoever is at hand is who they meant.
        const pointedAt = this.somebodyAtHand(query, cultivator);
        if (pointedAt && topic && topic.length >= 2) {
            return this.askAround(run, cultivator, pointedAt, topic, scope);
        }

        const party = this.partyPutTo(cultivator, query, scope, pointedAt);
        // A DESCRIPTION is not a name. "The old woman" resolves to nobody in the
        // roster and should not be fuzzy-matched into one; what it does mean is
        // that there is a person in front of the player, and a person can be asked
        // something.
        if (!party && topic && topic.length >= 2 && POINTING.test(query)) {
            const atHand = this.present(cultivator);
            if (atHand.length > 0) {
                return this.askAround(run, cultivator, atHand[atHand.length - 1], topic, scope);
            }
        }
        if (!party) return this.nobodyByThatName(cultivator, query, scope, 'interact');

        this.noteEncounter(
            cultivator, run, party, 'witnessed', `Approached at ${placeName(cultivator)}.`
        );

        // A question was asked of a person, so a person answers it. This
        // used to reach the sect register instead, which replied with a
        // list and a policy note and called the player "this cultivator".
        if (topic && topic.length >= 2 && party.kind === 'cultivator') {
            const who = this.present(cultivator).find(row => row.id === party.id);
            if (who) return this.askAround(run, cultivator, who, topic, scope);
        }

        // They may say something they assume the player already knows. The engine
        // picks it and writes it down; the narrator only gets a licence to have
        // them say it.
        const spoken = party.kind === 'cultivator' && WRONG_BEHIND_INTENT[intent] === undefined
            ? this.hear(cultivator, run, `interact:${party.id}`, party.id)
            : null;

        // AN ATTEMPT TO MOVE SOMEBODY, ACTUALLY RESOLVED
        if (party.kind === 'cultivator' && party.party && ATTEMPT_INTENTS.has(intent)) {
            return this.pressSomebody(
                run, cultivator, ambient, party, intent, leverage, rawInput, spoken,
                // No demand, and the thing the sentence named. The parser puts
                // it on `topic` for a theft and nothing else reads it here.
                undefined, named
            );
        }

        // The player gets the honest in-fiction shape of it - an approach made,
        // nothing settled. Why it is not settled is a fact about this codebase,
        // not about the world, and it belongs on the mechanical channel.
        const unresolved =
            'Nothing is settled by it. Nobody agreed to anything, nothing changed hands, and ' +
            'no standing shifted one way or the other.';

        const facts = factsForInteraction(cultivator, party.name, intent, party.facts, unresolved);

        // AND THE ACT ITSELF DID NOT HAPPEN, SAID SO IT CANNOT BE DROPPED
        sayThisWhateverTheNarratorDoes(facts, whatDidNotHappen(intent, cultivator.name));

        if (spoken) addHearing(facts, spoken);

        const execution = this.freeAction(run, 'interact', facts);
        execution.hearing = spoken;
        execution.outcome = 'refused';
        execution.calls = [
            {
                name: 'engine.resolveParty',
                action: 'interact',
                summary: `Resolved "${query}" to ${party.kind} ${party.id}. ${party.facts[0]}`,
                ok: true
            },
            ...structureCalls(party.structure),
            ...(spoken ? [{
                name: 'knowledge.learn',
                action: 'name_spoken',
                summary:
                    `${spoken.speaker ?? 'Somebody'} said "${spoken.names[0].name}" in passing. ` +
                    'Recorded at the lowest stance, source told. The player has the word and nothing else.',
                ok: true
            }] : []),
            {
                name: 'engine.resolveInteraction',
                action: intent,
                summary:
                    'Attempt recorded; outcome not resolvable yet. No agreement, no exchange, no ' +
                    'change of standing. The intent label was carried to the narrator and read by ' +
                    'no conditional.',
                ok: false
            }
        ];
        return execution;
    }

    // ── logistics ────────────────────────────────────────────────────────

    /**
     * Taking work, through the tool layer that owns the mortal economy.
     */
    private async work(
        cultivator: Cultivator,
        days: number,
        target: string | undefined,
        /**
         * `board` reads what is going and takes nothing. Anything else takes.
         */
        intent?: string
    ): Promise<Execution> {
        const readingTheBoard = intent === 'board';
        // A named trade has to become a catalog id, or the tool reads it as
        // "no occupation named" and lists the board instead of doing the work.
        // Matched against what is going HERE, at this realm: naming a trade the
        // village does not offer should reach the tool's own refusal, which
        // knows why, rather than being silently dropped here.
        const wanted = (target ?? '').trim();
        // WHAT IS GOING *HERE*
        const here = standingOf(cultivator).settlementKind ?? undefined;
        const offered = findWorkForOrdinal(cultivator.realmOrdinal, here);
        const named = wanted.length >= 3
            ? offered.find(o => wanted.toLowerCase().includes(o.name.toLowerCase())
                || o.name.toLowerCase().includes(wanted.toLowerCase()))
            : undefined;

        // "take any work" means take any work
        const anyWork = named === undefined && GameService.WORK_UNSPECIFIED.test(wanted);
        // Reading the board is not taking anything off it, so no occupation
        // reaches `handleWork` - which is the branch that already answers
        // "What is going, for somebody standing where they are standing", and
        // already spends nothing. One line rather than a second routine,
        // because there is nothing about the listing that differs.
        const occupation = readingTheBoard ? undefined : named ?? (anyWork
            ? [...offered].sort((a, b) =>
                b.cashPerMonth - a.cashPerMonth || (a.id < b.id ? -1 : 1))[0]
            : undefined);

        // Eat before the shift. `handleWork`'s own `rations` argument means BUY
        // that many, so the pack cannot be handed to it - but a player who
        // stocked up and then took work should not go to it hungry, and before
        // this they finished the season at zero and died on the next action.
        cultivator = this.feedFromPack(cultivator);

        const result = await handleWork(
            {
                action: 'work',
                cultivatorId: cultivator.id,
                days,
                ...(occupation ? { occupationId: occupation.id } : {})
            },
            // The same span `cultivate` runs, injected the same way the tool
            // layer injects it: there is one time skip in the cultivation
            // surface and `handleCultivate` owns it. Wiring a second one here
            // would be a second answer to how a day costs a cultivator.
            async args => await handleCultivate(args as never) as Record<string, unknown>
        );
        return this.fromToolResult('cultivation_mortal.work', 'work', result, 'The work');
    }


    /**
     * Somebody was asked something, and answers.
     */
    askAround(
        run: Run,
        cultivator: Cultivator,
        asked: RosterEntry,
        topic: string,
        scope: KnowledgeScope,
        // Set only by `demandOf`, off a landed `resolveAttempt`. See
        // `making-somebody-tell-you.ts`: it moves what somebody is WILLING to
        // say and can never move what they hold, and the guarantee for that is
        // where `askedAbout` reads the flag rather than anything written here.
        compelled = false
    ): Execution {
        // What the question was about, resolved against the same catalogs
        // everything else uses. Unresolvable is a real outcome, not an error:
        // people are asked about things that do not exist all the time.
        const subject = resolveAnything(this.repos, topic, cultivator, scope);

        // Whether the player can put a name to the person they are talking
        // to, decided BEFORE the answer, so a stranger stays a stranger
        // through the part where they decline to help.
        const knownAlready = this.knowledge.isAwareOf(cultivator.id, 'cultivator', asked.id);

        // Whether the question was about THEM. Read off the canonical topic the
        // parser emits, which is a closed lookup rather than a scan of the player's
        // prose - see `what-somebody-knows-about-themselves.ts`.
        const ownFact = selfFactFromTopic(topic);
        const aboutThemselves = ownFact === null
            ? null
            : whatTheySayAboutThemselves(ownFact, {
                name: asked.name,
                age: asked.age,
                sex: asked.sex,
                houseName: asked.sectName,
                rankName: asked.sectRank
            });

        const answer = askedAbout({
            asker: cultivator,
            asked,
            speakerName: knownAlready ? asked.name : null,
            subject,
            rawTopic: topic,
            aboutThemselves,
            holdsIt: subject !== null
                && (subject.kind === 'cultivator' || subject.kind === 'sect' || subject.kind === 'place')
                && this.knowledge.isAwareOf(asked.id, subject.kind, subject.id),
            priorDealings: this.dealingsWith(cultivator, asked.id),
            compelled
        });

        // Written before narration, deliberately. The alternative is a name
        // that exists only inside a paragraph, which is the failure mode the
        // whole knowledge layer is here to prevent.
        // Somebody who answers you has told you who they are. Somebody who
        // hears you out and goes back to work has not, and that asymmetry is
        // the cheapest introduction in the game: it costs a question.
        const met = answer.introduces && !knownAlready
            ? this.noteEncounter(
                cultivator, run,
                { kind: 'cultivator', id: asked.id, name: asked.name },
                'told',
                `Answered a question at ${placeName(cultivator)}, and gave a name doing it.`)
            : false;

        const learned = answer.teaches && subject
            ? this.noteEncounter(
                cultivator, run, subject, 'told',
                `${asked.name} said it at ${placeName(cultivator)}.`)
            : false;

        // ASKING IN THE REGION GIVES IT
        const gate = subject?.kind === 'sect' && this.atHand
            ? this.atHand.locations.find(row =>
                row.kind === 'sect_seat' && row.controllingFactionId === subject.id)
            : undefined;
        // Both provinces read off the WORLD, not off the gazetteer. `standingOf` is
        // a name match against the static places and answers with the HOME region
        // for anything it does not name - which is every sect ground, every cave
        // and every ruin. Asking somebody a question while standing on a house's
        // ground would then have been priced as though the player were back where
        // they were born, and the gate a province away would have opened for free.
        // A fallback written in ordinary English is invisible; this one is a wrong
        // answer that never looks like one.
        const provinceOf = (locationId: string | null | undefined): string | null => {
            if (!this.atHand || !locationId) return null;
            const row = this.atHand.locations.find(l => l.id === locationId);
            if (!row) return null;
            return row.kind === 'region' ? row.id : row.parentId ?? null;
        };
        const standingIn = this.atHand
            ? provinceOf(worldLocationFor(this.atHand, cultivator.location)?.id)
            : null;
        const gateIsLocal = gate !== undefined
            && standingIn !== null
            && provinceOf(gate.id) === standingIn;
        const showed = gate && gateIsLocal
            ? this.noteEncounter(
                cultivator, run, { kind: 'place', id: gate.id, name: gate.name }, 'told',
                `Asked after the ${subject!.name} at ${placeName(cultivator)}, which is in the `
                + 'province the house keeps its gate in. Ordinary local knowledge here.')
            : false;

        // The last mile. `asked.ts` decides how far the answer got; what falls
        // out of it is a name said flatly, which discovery.md calls the primary
        // way names enter a player's world. Written before the prose exists.
        const dropped = this.hear(
            cultivator, run, `ask:${asked.id}:${topic}`, asked.id,
            { intent: 'asked', reach: answer.reach });

        // Said out loud, and said BEFORE the facts are built rather than pushed
        // onto `lines` afterwards - `factsForToolResult` composes the prose from
        // the array it is handed, so a line appended after the call reaches the
        // engine channel and never reaches the player. Measured exactly that way
        // once: the grant landed, the destinations read listed the gate on the next
        // turn, and the turn that granted it said nothing at all.
        const said = showed && gate
            ? [
                ...answer.lines,
                `Whatever else they had to say, where the ${subject!.name} keeps its gate is `
                + `not news in this province - anybody would have pointed. ${gate.name} is a `
                + 'place you could set out for now.'
            ]
            : answer.lines;

        const facts = factsForToolResult(
            `${knownAlready || met ? asked.name : 'Somebody'}, asked about ${subject?.name ?? topic}.`,
            said
        );
        facts.structure.push(...answer.structure);
        if (dropped) addHearing(facts, dropped);

        const execution = this.freeAction(run, 'interact', facts);
        execution.hearing = dropped;
        execution.calls = [
            {
                name: 'engine.askedAbout',
                action: 'talk',
                summary:
                    `Asked ${asked.name} about "${topic}"` +
                    `${subject ? ` (resolved to ${subject.kind} ${subject.id})` : ' (unresolved)'}. ` +
                    `Reach: ${answer.reach}.`,
                ok: answer.reach === 'answers' || answer.reach === 'partial'
            }
        ];
        if (met) {
            execution.calls.push({
                name: 'knowledge.learn',
                action: 'name_given',
                summary:
                    `${asked.name} recorded as believed, source told: they answered, and answering ` +
                    'is how a stranger stops being one. A shrug would not have written this row.',
                ok: true
            });
        }
        if (dropped) {
            execution.calls.push({
                name: 'knowledge.learn',
                action: 'name_dropped',
                summary:
                    `"${dropped.names[0].name}" fell out of the answer and was recorded at the ` +
                    `lowest stance, source ${dropped.sourceKind}. The player has the word and ` +
                    'nothing else.',
                ok: true
            });
        }
        if (learned && subject) {
            execution.calls.push({
                name: 'knowledge.learn',
                action: 'name_told',
                summary:
                    `${subject.name} recorded as believed, source told, from ${asked.name}. ` +
                    'The player earned this one by asking somebody who would say it.',
                ok: true
            });
        }
        if (showed && gate) {
            execution.calls.push({
                name: 'knowledge.learn',
                action: 'gate_placed',
                summary:
                    `${gate.name} recorded at stage placed, source told. Asked about a house `
                    + 'in the province its gate stands in, which is the third of the three ways '
                    + "`seedSectGround` says its own name is given. `canPointAt` now passes, so "
                    + 'the destinations read names it and the move verb accepts it.',
                ok: true
            });
        }
        return execution;
    }

    /**
     * How many times this cultivator has dealt with somebody before.
     */
    dealingsWith(cultivator: Cultivator, otherId: string): number {
        return this.knowledge
            .awareness(cultivator.id, 'cultivator')
            .filter(row => row.id === otherId)
            .length;
    }

    /**
     * Sects: which ones would take them, and joining one.
     */
    private async sect(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string | undefined,
        topic?: string,
        days?: number
    ): Promise<Execution> {
        // The four member verbs. `sect_manage` has had all of them the whole
        // time and none of them was reachable: "I ask for a promotion", "I draw
        // my stipend", "where do I stand in the sect" and "I leave the sect" all
        // parsed to `unclear`, so a player could join a house and then do
        // nothing whatever about it for the rest of the run.
        switch (intent) {
            case 'duty':
                return this.duty(run, cultivator, ambient, target);

            // Answering the house, or not.
            case 'summons':
                return this.refuseWhatTheHouseAsked(run, cultivator, true);

            case 'refuse':
                return this.refuseWhatTheHouseAsked(run, cultivator, false);

            // Putting a hand on something the house owns. `siphon` two cases
            // up is the same crime against the counted tier and stays exactly
            // where it is; this is the tracked one, and the two are separated
            // by `keptAs` rather than by a list of nouns.
            case 'take':
                return this.takeFromTheHouse(run, cultivator, target);

            // Which rooms are yours to speak for. Free, and the sentence before
            // the one that claims: an order given in the house's name is only a
            // decision if the player could have found out whether it was true.
            case 'authority':
                return this.whatIRunHere(run, cultivator);

            // The same rows from the other end. A verdict on the topic and the
            // person on the target; with neither it is a read of the pile.
            case 'complaints':
                return this.complaintsBrought(
                    run, cultivator, target,
                    topic === 'upheld' || topic === 'dismissed' ? topic : null
                );

            case 'siphon': {
                // The pace rides in on the plan's topic and the span on its
                // days, both optional: naming neither is a request to see the
                // position without taking anything, which is what a player
                // should be able to do before committing to a crime that runs
                // on a clock.
                const pace = topic === 'careful' || topic === 'steady' || topic === 'greedy'
                    ? topic
                    : undefined;
                return this.fromToolResult(
                    'sect_manage.siphon', 'sect',
                    await handleSiphon({
                        action: 'siphon',
                        cultivatorId: cultivator.id,
                        ...(pace ? { pace } : {}),
                        months: Math.max(1, Math.min(240, Math.round((days ?? 30) / 30)))
                    }),
                    'The reserves'
                );
            }
            // Two footings, one routine. `order` is somebody's own rank and
            // `decree` is the house's authority being claimed - the parser
            // separates them on the words the player used, and the engine tests
            // the claim rather than consulting a table of who may say what.
            // Same errand, same rung, same price on the ladder.
            case 'order':
            case 'decree': {
                // The errand rides in on the plan's topic and how long they are
                // out on its days. Both are the ORDERED rung's, not the
                // caller's: `handleOrder` advances the turn and nothing else,
                // which is the whole difference between having a rank and
                // doing the work yourself.
                const errand = topic === 'gather' || topic === 'carry' || topic === 'labour'
                    ? topic
                    : DEFAULT_ERRAND;
                const body = await handleOrder({
                    action: 'order',
                    cultivatorId: cultivator.id,
                    errand,
                    authority: intent === 'decree' ? 'delegated' : 'personal',
                    days: Math.max(1, Math.min(365, Math.round(days ?? 7)))
                });
                const given = this.fromToolResult('sect_manage.order', 'sect', body, 'The order');

                // AND SOMEBODY WATCHED
                const claim = (body as { authority?: { legitimate?: boolean } }).authority;
                if (claim && claim.legitimate === false) {
                    await this.somebodyWatchedThatDecree(run, cultivator, body, given);
                }
                return given;
            }
            // the four powers a rank buys above `order`
            case 'recruit': {
                const kind = topic === 'elder' ? 'elder' : 'disciple';
                // "three disciples" is three people. Read off the same phrase
                // the parser handed over, bounded by the tool's own schema.
                const count = Math.max(1, Math.min(50, parseCount(target ?? '') ?? 1));
                return this.fromToolResult(
                    'sect_manage.recruit', 'sect',
                    await handleRecruit({
                        action: 'recruit', cultivatorId: cultivator.id, kind, count
                    }),
                    kind === 'elder' ? 'The seating' : 'The intake'
                );
            }
            case 'admission': {
                // A rank the sentence actually names, or nothing. There is no
                // reading of "raise the bar" that tells the engine HOW FAR, and
                // inventing one here would be a balance decision made in the
                // narration tier. With no ordinal the tool prices the move and
                // changes nothing, which is the honest answer to a sentence
                // that did not say where to put it.
                const ordinal = this.ordinalNamed(target);
                return this.fromToolResult(
                    'sect_manage.admission', 'sect',
                    await handleAdmission({
                        action: 'admission',
                        cultivatorId: cultivator.id,
                        ...(ordinal !== null ? { ordinal } : {})
                    }),
                    'The standard'
                );
            }
            case 'curriculum': {
                const art = this.artNamed(target, cultivator);
                const retiring = topic === 'retire';
                return this.fromToolResult(
                    'sect_manage.curriculum', 'sect',
                    await handleCurriculum({
                        action: 'curriculum',
                        cultivatorId: cultivator.id,
                        ...(art && retiring ? { retire: [art] } : {}),
                        ...(art && !retiring ? { teach: [art] } : {})
                    }),
                    'The library'
                );
            }
            case 'expel': {
                // Two calls, and the first one is free. `expel` with no elderId
                // reads the house and prices every elder in it without
                // dismissing anybody, which is both how the argument gets
                // resolved and the right thing to show a player who named
                // nobody the house recognises.
                const roll = await handleExpel({ action: 'expel', cultivatorId: cultivator.id });
                const elderId = isGuidingErrorBody(roll) ? null : elderNamed(roll, target);
                if (elderId === null) {
                    return this.fromToolResult('sect_manage.expel', 'sect', roll, 'The elders');
                }
                return this.fromToolResult(
                    'sect_manage.expel', 'sect',
                    await handleExpel({ action: 'expel', cultivatorId: cultivator.id, elderId }),
                    'The dismissal'
                );
            }
            case 'promote':
                return this.fromToolResult(
                    'sect_manage.promote', 'sect',
                    await handlePromote({ action: 'promote', cultivatorId: cultivator.id }),
                    'The promotion'
                );
            case 'stipend':
                return this.fromToolResult(
                    'sect_manage.stipend', 'sect',
                    await handleStipend({ action: 'stipend', cultivatorId: cultivator.id }),
                    'The stipend'
                );
            // SITTING IN SOMEWHERE THAT HAS NOT TAKEN YOU
            case 'guest': {
                if (topic === 'depart') {
                    return this.fromToolResult(
                        'sect_manage.guest', 'sect',
                        await handleGuest({
                            action: 'guest', cultivatorId: cultivator.id,
                            accept: false, depart: true
                        }),
                        'The guest roll'
                    );
                }
                const asked = (target ?? '').trim();
                // A HOUSE WHOSE NAME BEGINS "House of" IS NOT A CATEGORY
                const generic = GENERIC_HOUSE_CATEGORY_ONLY.test(asked);
                const house = asked.length >= 3 && !generic
                    ? resolveSect(this.repos, asked, this.scopeFor(cultivator), cultivator.sectId)
                    : null;
                // The same rule the join path already follows: a specific name
                // that resolves to nothing must not fall through to the
                // listing, because being shown a house you did not ask about
                // reads exactly like an answer.
                if (!house && asked.length >= 3 && !generic) {
                    return refused('engine.resolveSect', 'sect', factsForRefusal(
                        'Not a name you hold.',
                        'You have said a name and it is not one anybody has said to you. A guest '
                        + 'place starts where every other door starts, which is somebody saying '
                        + 'the name in front of you.',
                        `Unresolved sect "${asked.slice(0, 60)}": no knowledge record. The guest `
                        + 'listing is deliberately NOT offered as a substitute.'
                    ));
                }
                return this.fromToolResult(
                    'sect_manage.guest', 'sect',
                    await handleGuest({
                        action: 'guest',
                        cultivatorId: cultivator.id,
                        ...(house ? { sectId: house.id } : {}),
                        accept: house !== null && topic === 'accept',
                        depart: false
                    }),
                    house ? house.name : 'The guest roll'
                );
            }

            case 'donate':
                return this.donate(run, cultivator, days);

            case 'standing': {
                const read = this.fromToolResult(
                    'sect_manage.standing', 'sect',
                    await handleStanding({ action: 'standing', cultivatorId: cultivator.id }),
                    'The standing'
                );
                // ANSWERING "COULD I LEAVE" WITHOUT LEAVING
                const held = positionIn(this.repos, cultivator.id);
                if (topic === 'leaving') {
                    // "Seat" was the Hollow Court's own word for a rung, swept out
                    // of generic code by `652a66e` everywhere except this file,
                    // which was dirty at the time. Note WHICH sense this one was:
                    // not the head of the house, because the person asking is any
                    // member at any rung - it is the RANK sense that commit
                    // separated out, and the house's own word for the rank is
                    // already in hand as `rankTitle`. Saying it once and referring
                    // back is what removes the repetition the old sentence had.
                    const line = held
                        ? `Walking out is a thing you say out loud and it is done the day you say `
                          + `it. What it costs is ${held.rankTitle} and the ${held.contribution} `
                          + `contribution: neither travels, and coming back later does not come `
                          + `back above it.`
                        : 'You belong to nothing, so there is nothing to walk out of.';
                    read.facts.lines.push(line);
                    read.facts.prose = `${read.facts.prose}\n\n${line}`;
                    read.facts.structure.push(
                        'Asked whether they could leave rather than told to. Read only: '
                        + 'sect_members untouched, no turn spent.'
                    );
                }
                return read;
            }
            case 'leave':
                return this.fromToolResult(
                    'sect_manage.leave', 'sect',
                    await handleLeave({ action: 'leave', cultivatorId: cultivator.id }),
                    'The departure'
                );
            default:
                break;
        }

        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();

        // A CATEGORY IS NOT A NAME, AND IT MUST NOT BECOME ONE
        const named = query.length >= 3 && !GENERIC_HOUSE_PHRASE.test(query)
            ? resolveSect(this.repos, query, scope, cultivator.sectId)
            : null;

        if (named) {
            // Joining a second house is leaving the first, and it must say so
            const sentUp = recallDueFor(this.repos, cultivator);
            const held = positionIn(this.repos, cultivator.id);
            if (held && held.sectId !== named.id
                && !(sentUp !== null && sentUp.toFactionId === named.id)) {
                return refused('sect_manage.join', 'sect', factsForRefusal(
                    'You are already somebody\'s.',
                    `You stand as ${held.rankTitle} of ${held.sectName}, and nobody is taken on `
                    + 'twice. Whatever you have earned there is earned there and does not travel; '
                    + 'walking out is a thing you do first, and out loud, and it costs what it '
                    + 'costs.',
                    `The membership record already holds ${held.sectId}: ${rankAndIndex(held)}, `
                    + `with ${held.contribution} contribution earned there. Being taken on `
                    + 'elsewhere would delete that row in the same transaction and say nothing; '
                    + 'the departure path owns the forfeiture and says it out loud.'
                ));
            }

            // AND WHAT THE HOUSE MAKES OF THEM
            const world = this.atHand ?? await this.loadWorld();
            const council = whatTheBodyWants({
                readingOf: renownReading([]),
                roll: (world?.npcs ?? [])
                    .filter(n => n.factionId === named.id && n.status === 'alive')
                    .map(n => ({ id: n.id, rankIndex: n.factionRankIndex })),
                rankCount: getSect(named.id)?.ranks.length ?? 0,
                asking: cultivator.id,
                ledger: ledgerAbout(this.repos.db as unknown as ObligationDb, cultivator.id),
                asOfDay: Math.floor(run.elapsedDays)
            });
            const result = await handleJoin({
                action: 'join',
                sectId: named.id,
                cultivatorId: cultivator.id
            }, { leaning: council.leaning });
            return this.fromToolResult('sect_manage.join', 'sect', result, named.name);
        }

        // A house was named and it resolved to nothing, so the listing below is an
        // answer to a question nobody asked.
        if (query.length >= 3 && !GENERIC_HOUSE_PHRASE.test(query)) {
            return refused('engine.resolveSect', 'sect', factsForRefusal(
                'Not a name you hold.',
                'You have said a name and it is not one anybody has said to you. Somebody would '
                + 'have to put it in front of you first - a name is where a door starts, and you '
                + 'do not have this one.',
                `Unresolved sect "${query.slice(0, 60)}": no knowledge record. The listing is `
                + 'deliberately NOT offered as a substitute; naming a house you have not heard '
                + 'of must not quietly enrol you somewhere else.'
            ));
        }

        const listing = await handleList({
            action: 'list',
            cultivatorId: cultivator.id,
            admissibleOnly: true
        });
        if (isGuidingErrorBody(listing)) {
            return this.fromToolResult('sect_manage.list', 'sect', listing, 'The sects');
        }

        const all = (listing as { sects?: Array<{ id: string; name: string; admissible?: boolean | null; guestDoorOpen?: boolean | null; wouldEnterAtRank?: string | null }> }).sects ?? [];
        const heard = all.filter(s => this.knowledge.isAwareOf(cultivator.id, 'sect', s.id));

        const facts = heard.length === 0
            ? factsForRefusal(
                'No door you know of.',
                'You do not know the name of a single order that takes people on. Somebody would ' +
                'have to say one in front of you first, and nobody has.',
                `${all.length} order(s) in the world would admit somebody. None of them is a name `
                + 'this cultivator holds, and the listing is not offered as a substitute for '
                + 'having heard one.')
            : factsForToolResult(
                `${heard.length} order${heard.length === 1 ? '' : 's'} you could put yourself in front of.`,
                [
                    // This used to be a register with a policy note attached,
                    // addressed to an operator and calling the player "this
                    // cultivator" in the third person. Nobody in the world
                    // speaks like that, and nothing in the world is a list.
                    heard.length === 1
                        ? `There is one name you have for this: ${heard[0].name}.`
                        : `The names you have for this are ${heard.slice(0, -1).map(x => x.name).join(', ')} ` +
                          `and ${heard[heard.length - 1].name}.`,
                    // AND THE HOUSES THAT WOULD, AND ON WHAT FOOTING
                    ...heard
                        .filter(x => x.admissible === true && typeof x.wouldEnterAtRank === 'string')
                        .map(x => `${x.name} would take you, and would seat you as `
                            + `${x.wouldEnterAtRank}.`),
                    ...heard
                        .filter(x => x.admissible === false && x.guestDoorOpen !== true)
                        .map(x => `${x.name} would not take you as you stand.`),
                    // The house that will not take you as a disciple and will
                    // take you today. Said as one sentence, because said as
                    // two it reads as a contradiction, and because a player
                    // who is only told the first half has been shown a closed
                    // door in front of an open one.
                    ...heard
                        .filter(x => x.admissible === false && x.guestDoorOpen === true)
                        .map(x => `${x.name} would not take you as a disciple as you stand, and `
                            + 'its intake is open to you now - it takes people at the floor, '
                            + 'carries them, and decides about them later.'),
                    // AND HOW MANY YOU HAVE NO NAME FOR
                    ...(all.length > heard.length
                        ? [`There are ${all.length - heard.length} more that would take somebody `
                            + 'like you and that you have no name for. Nobody has said them in '
                            + 'front of you yet.']
                        : []),
                    'Knowing a name is not an introduction. Somebody would have to put you in front of them, ' +
                    'or you would have to walk up on your own.'
                ]);

        // AND NOBODY HAS JOINED ANYTHING, SAID SO IT CANNOT BE DROPPED
        if (heard.some(x => x.admissible === true)) {
            sayThisWhateverTheNarratorDoes(
                facts,
                'None of this has happened. You are not on anybody\'s roll and no house has '
                + 'been asked yet - this is what the doors would do if you walked up to them.'
            );
        }

        facts.structure.push(
            `sect_manage.list: ${all.length} admissible, ${heard.length} known to this cultivator.`
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: heard.length === 0 ? 'refused' : 'executed',
            calls: [{
                name: 'sect_manage.list',
                action: 'sect',
                summary: `${all.length} admissible sect(s); ${heard.length} within this cultivator's knowledge.`,
                ok: heard.length > 0
            }]
        };
    }

    /**
     * What the people standing here say is happening somewhere else.
     */
    private news(run: Run, cultivator: Cultivator): Execution {
        const asked = askAround({
            cultivator,
            run,
            present: this.present(cultivator),
            world: this.atHand,
            occasion: 'news',
            // Themselves, which is the floor: the person a wrong was done to is
            // always somebody they carry for. Kin belong here too and the world
            // holds them; adding them is a wider read, not a different rule.
            carriesFor: { hearerId: cultivator.id, ids: [cultivator.id] },
            heldAbout: factId => this.accountCarriedAbout(cultivator.id, factId)
        });

        for (const hearing of asked.hearings) recordHearing(this.knowledge, cultivator, run, hearing);

        // AND FINDING OUT IS WHAT OPENS THE ACCOUNT
        const opened: ToolCallRecord[] = [];
        for (const account of asked.opens) {
            const record = createObligation(account.row);
            writeObligation(this.db as unknown as DatabaseHandle, record);
            opened.push({
                name: 'social.createObligation',
                action: 'news',
                summary:
                    `${record.holderId} now holds a ${record.severity} ${record.kind} about `
                    + `${record.subjectId} (${record.cause}), opened on being told by `
                    + `${account.speakerId} on day ${record.incurredOnDay}. `
                    + `triggeringEventId=${record.triggeringEventId ?? 'none'}; `
                    + `fromBelief=${record.fromBelief}. ${account.note}`,
                ok: true
            });
        }

        const facts = factsForNews(asked);
        const execution = this.freeAction(run, 'news', facts);
        execution.outcome = asked.heard.length === 0 ? 'refused' : 'executed';
        execution.calls = [{
            name: 'world.whatTheySay',
            action: 'news',
            summary: asked.heard.length === 0
                ? 'Nobody present, or nothing in the ledger loud enough to be repeated here.'
                : `${asked.heard.length} rumour(s) drawn off the world ledger and recorded at `
                + 'stage "whisper" with the speaker attached. No fact was taken as read.',
            ok: asked.heard.length > 0
        }, ...opened];
        return execution;
    }

    /**
     * Telling somebody that a wrong was done to them, and putting a name on it.
     */
    private tellSomebody(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        claim: string | undefined
    ): Execution {
        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();
        const said = (claim ?? '').trim();

        if (query.length < 2 || said.length < 3) {
            return refused('engine.resolveParty', 'tell', factsForRefusal(
                'Nobody to say it to.',
                this.whoIsAbout(cultivator),
                'tell: no addressee or no claim. Both halves are required - a telling with '
                + 'nobody at the end of it opens nothing for anybody.'
            ));
        }

        // WHO IS BEING TOLD, AND THEY HAVE TO BE HERE
        const pointedAt = this.somebodyAtHand(query, cultivator);
        const party = this.partyPutTo(cultivator, query, scope, pointedAt);
        const here = this.present(cultivator);
        const hearer = party && party.kind === 'cultivator'
            ? here.find(row => row.id === party.id) ?? null
            : null;
        if (hearer === null) {
            return this.nobodyByThatName(cultivator, query, scope, 'tell');
        }

        // AND WHO THEY ARE PUTTING IT ON
        const named = whoTheClaimBlames(said);
        const blamed = named === null
            ? null
            : /^i$/i.test(named)
                ? { id: cultivator.id, name: cultivator.name }
                : (found => found && found.kind === 'cultivator'
                    ? { id: found.id, name: found.name }
                    : null)(this.partyPutTo(cultivator, named, scope));

        const landedOn = whatATellingLandsOn({
            world: this.atHand,
            hearerId: hearer.id,
            hearer: this.atHand?.npcs.find(npc => npc.id === hearer.id) ?? null,
            tellerId: cultivator.id,
            blamedId: blamed?.id ?? null,
            // The RUN's clock. Every obligation in this table is dated in it,
            // and two clocks in one table is a row nobody can read.
            onDay: Math.floor(run.elapsedDays),
            canPointAt: fact => couldPointAtIt(fact, cultivator.id,
                id => this.knowledge.isAwareOf(cultivator.id, 'cultivator', id)),
            heldAbout: factId => this.accountCarriedAbout(hearer.id, factId)
        });

        const calls: ToolCallRecord[] = [];
        if (landedOn.opens !== null) {
            const record = createObligation(landedOn.opens);
            writeObligation(this.db as unknown as DatabaseHandle, record);
            calls.push({
                name: 'social.createObligation',
                action: 'tell',
                summary:
                    `${record.holderId} now holds a ${record.severity} ${record.kind} about `
                    + `${record.subjectId} (${record.cause}), opened on being told by `
                    + `${cultivator.name} on day ${record.incurredOnDay}. `
                    + `triggeringEventId=${record.triggeringEventId ?? 'none'}; `
                    + `fromBelief=${record.fromBelief}. ${landedOn.note}`,
                ok: true
            });
        }

        const facts = factsForTelling({
            landedOn,
            hearer: hearer.name,
            blamed: blamed?.name ?? named,
            claim: said
        });
        const execution = this.freeAction(run, 'tell', facts);
        // EXECUTED either way, and that is the ruling rather than an oversight.
        // The words were said and the person heard them; whether anything came
        // of it is a fact about the world and not a failure of the turn. Marking
        // it refused would put it back in the class of answers a player reads as
        // "the game did not understand me", which is the whole defect this verb
        // was built to stop producing.
        execution.outcome = 'executed';
        execution.calls = [{
            name: 'world.whatATellingLandsOn',
            action: 'tell',
            summary: landedOn.opens === null
                ? `Nothing opened: ${landedOn.landed}. ${landedOn.note}`
                : `${landedOn.did} against ${landedOn.againstAsTold ?? 'nobody'}, `
                  + `off fact ${landedOn.factId}.`,
            ok: true
        }, ...calls];
        return execution;
    }

    /**
     * The account this holder already carries about this event, or null.
     */
    private accountCarriedAbout(holderId: string, factId: string | null): ObligationRecord | null {
        if (factId === null) return null;
        const row = (this.db as unknown as DatabaseHandle).prepare(
            'SELECT * FROM obligations WHERE holder_id = ? AND triggering_event_id = ? '
            + "AND status = 'open' ORDER BY subject_id LIMIT 1"
        ).get(holderId, factId);
        return row ? obligationFromRow(row as ObligationRow) : null;
    }

    // what this cultivator is carrying

    /**
     * What this cultivator holds about a name, or about everything.
     */
    private recall(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string | undefined
    ): Execution {
        const which: RecallIntent = RECALL_INTENTS.includes(intent as RecallIntent)
            ? intent as RecallIntent
            : DEFAULT_RECALL_INTENT;

        if (which === 'dao') return this.recallDao(run, cultivator);

        const held = this.knowledge.awareness(cultivator.id);
        const query = (target ?? '').trim();

        if (query.length < 2) {
            const facts = factsForHolding(
                cultivator,
                held.map(row => ({ kind: row.kind, name: row.name }))
            );
            const listing = this.freeAction(run, 'recall', facts);
            listing.outcome = held.length === 0 ? 'refused' : 'executed';
            listing.calls = [{
                name: 'knowledge.awareness',
                action: 'recall',
                summary:
                    `${held.length} knowledge record(s) held by this cultivator. Read only, and read `
                    + 'from their own rows: no catalog was consulted, so nothing here could be new.',
                ok: held.length > 0
            }];
            return listing;
        }

        // The gate, in one line. Scored against what they hold, never against
        // what exists. Every row that matches comes back - a cultivator
        // carrying four incompatible stories is carrying four, and collapsing
        // them into one would hand over the resolution that is the prize.
        const matches = held.filter(row => matchScore(query, row.name) >= MATCH_THRESHOLD);
        const scope = this.scopeFor(cultivator);

        const facts = factsForRecall(cultivator, query, matches.map(row => ({
            name: row.name,
            statement: row.statement,
            stance: row.stance,
            sourceKind: row.sourceKind,
            sourceNote: row.sourceNote,
            acquiredOnDay: row.acquiredOnDay,
            earned: this.earnedAbout(cultivator, scope, row)
        })));

        const execution = this.freeAction(run, 'recall', facts);
        execution.outcome = matches.length === 0 ? 'refused' : 'executed';
        execution.calls = [{
            name: 'knowledge.awareness',
            action: 'recall',
            summary:
                `"${query}" scored against ${held.length} held record(s); ${matches.length} matched at or `
                + `above ${MATCH_THRESHOLD}. The catalogs were not searched, which is what makes this `
                + 'read incapable of teaching anybody anything.',
            ok: matches.length > 0
        }];
        return execution;
    }

    /**
     * Anything further they have actually earned about it.
     */
    private earnedAbout(
        cultivator: Cultivator,
        scope: KnowledgeScope,
        row: AwarenessRow
    ): string[] {
        if (row.stance !== 'knows') return [];
        if (row.kind === 'sect') {
            return resolveSect(this.repos, row.name, scope, cultivator.sectId)?.facts ?? [];
        }
        if (row.kind === 'cultivator') {
            return resolveCultivator(
                this.repos, row.name, cultivator.id, scope, cultivator.realmOrdinal
            )?.facts ?? [];
        }
        // Places are free text in this engine and events have no resolver.
        // Nothing to add, and inventing something would be the leak.
        return [];
    }

    /**
     * What this cultivator has understood, which is the other axis entirely.
     */
    private recallDao(run: Run, cultivator: Cultivator): Execution {
        const insights = cultivator.insights ?? [];
        const dao = daoOf(insights);
        const panel = daoView(cultivator);

        const facts = factsForDao(cultivator, {
            standing: dao.standing,
            name: dao.name,
            subject: dao.subject,
            depth: dao.depth,
            breadth: dao.breadth
        }, panel);

        const execution = this.freeAction(run, 'recall', facts);
        execution.calls = [{
            name: 'engine.daoOf',
            action: 'recall',
            summary:
                `standing=${dao.standing}, subject=${dao.subject ?? 'none'}, depth=${dao.depth}, `
                + `insights=${panel.insights.length}, totalDegrees=${panel.totalDegrees}. `
                + 'Read only: understanding is formed by exposure, never by asking about it.',
            ok: true
        }];
        return execution;
    }

    /**
     * WHOSE ART THAT WAS.
     */
    private recognise(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        topic: string | undefined
    ): Execution {
        const scope = this.scopeFor(cultivator);
        const askedHouse = (target ?? '').trim();
        const askedArt = (topic ?? '').trim();

        // Gated, like every other name read: a house this cultivator has never
        // heard of does not resolve, and that is itself one of the answers.
        const house = askedHouse.length >= 2
            ? resolveSect(this.repos, askedHouse, scope, cultivator.sectId)
            : null;
        const art = askedArt.length >= 2
            ? resolveTechnique(this.repos, askedArt, cultivator.id)
            : null;

        // The art the sentence is about. Named outright, or the signature of
        // the house that was named - and where a house carries no signature,
        // the top of its own shelf, which is the same thing said by the shelf.
        const houseSignature = house
            ? (getSect(house.id) as { signatureTechniqueId?: string | null } | undefined)?.signatureTechniqueId
                ?? manualsOf(house.id).at(-1)?.id
                ?? null
            : null;
        const artId = art?.id ?? houseSignature;

        if (!artId && askedHouse.length > 0) {
            // A house they cannot name is a house they hold no reference for, and
            // that IS the answer rather than a failure to compute one. It goes down
            // the graded path with the rest so the player gets the same honest
            // sentence they would get if the name had resolved: never a "no" they
            // have not earned, and never a refusal, because asking yourself whether
            // you recognise something is always a legitimate thing to do.
            const facts = factsForRecognisingAnArt({
                artName: 'whatever that was',
                claimedHouseName: askedHouse,
                verdict: 'would_not_know_it',
                placedTo: [],
                perceivedButCouldNotPlaceIt: false,
                nobodysArt: false,
                revealsTheReader: false,
                structure: [
                    `"${askedHouse}" is not a name this cultivator holds, so there is no reference `
                    + 'to read the demonstration against and no rung that would supply one. The '
                    + 'reader stands at '
                    + `${rankName(cultivator.realmOrdinal)} (ordinal ${cultivator.realmOrdinal}), `
                    + 'which is the whole of the point: the perceptual axis does not buy reference.'
                ]
            });
            const execution = this.freeAction(run, 'recognise', facts);
            execution.calls = [{
                name: 'world.whereThisArtWasLearned',
                action: 'recognise',
                summary:
                    `No house resolved from "${askedHouse}" for a reader at ordinal `
                    + `${cultivator.realmOrdinal}. Verdict would_not_know_it: reference afforded `
                    + 'nothing, and realm cannot substitute for it. Read only; nothing was spent '
                    + 'and no row was written.',
                ok: true
            }];
            return execution;
        }

        if (!artId) {
            // Nothing named at all. Not a refusal of an action and not a parse
            // error: a character who has not said what they mean. Said in the
            // world's voice, because an error message reaching the player is a
            // scene that failed to get written.
            const facts = factsForRefusal(
                'Nothing to hold it up against.',
                'You would have to know which art you meant. Watching somebody move is not '
                + 'the same as having a name for what they did.',
                'No technique resolved from the sentence, and no house whose signature could stand '
                + 'in for one. Read only; nothing was spent and no row was written.'
            );
            const listing = this.freeAction(run, 'recognise', facts);
            listing.outcome = 'refused';
            return listing;
        }

        const technique = getTechnique(artId) as
            { name?: string; requiredOrdinal?: number } | undefined;
        const artName = art?.name ?? technique?.name ?? artId;
        // The rung the demonstration is priced at: the art's own floor, which
        // is the LOWEST anybody could be performing it at. So the perceptual
        // half of the answer is if anything generous to the reader, and that is
        // stated here rather than left for whoever reads the number to assume.
        const performedAtOrdinal = Number(technique?.requiredOrdinal ?? 0);

        const observer: ArtObserver = {
            realmOrdinal: cultivator.realmOrdinal,
            referenceFor: (factionId: string) => this.knowledge.stageOf(cultivator.id, 'sect', factionId)
        };
        const demonstration = { techniqueId: artId, performedAtOrdinal };

        const learned = whereThisArtWasLearned(demonstration, observer);
        const claim = house ? couldTheyTellItIs(demonstration, observer, house.id) : null;

        // With no house named, the strongest house they could place it to
        // stands in as the subject, which is what "whose art is that" asks.
        const standIn = learned.houses[0] ?? null;
        const verdict: ClaimVerdict = claim
            ? claim.verdict
            : !learned.perceived ? 'could_not_follow'
                : standIn === null || standIn.reading === 'nothing' ? 'would_not_know_it'
                    : standIn.reading === 'certain' ? 'it_is' : 'consistent';

        const nameOf = (factionId: string): string =>
            (getSect(factionId) as { name?: string } | undefined)?.name ?? factionId;
        const claimedHouseName = house?.name
            ?? (claim === null && standIn !== null ? nameOf(standIn.factionId) : null)
            ?? (askedHouse.length > 0 ? askedHouse : null);

        // Only houses this reader can actually place it to. Listing the rest
        // would hand over the catalog, which is the one thing a read of the
        // holder's own head must never do.
        const placedTo = learned.houses
            .filter(h => h.reading !== 'nothing')
            .map(h => nameOf(h.factionId));

        const fromRealm = claim?.fromRealm ?? standIn?.fromRealm ?? 'nothing';
        const fromReference = claim?.fromReference ?? standIn?.fromReference ?? 'nothing';
        const atStage = claim?.reference ?? standIn?.reference ?? 'unaware';

        const facts = factsForRecognisingAnArt({
            artName,
            claimedHouseName,
            verdict,
            placedTo,
            perceivedButCouldNotPlaceIt: learned.perceivedButCouldNotPlaceIt,
            nobodysArt: learned.nobodysArt,
            revealsTheReader: learned.revealsTheReader,
            structure: [
                `${artName} is priced as performed at ${rankName(performedAtOrdinal)} `
                + `(ordinal ${performedAtOrdinal}), which is the lowest rung anybody could be doing `
                + `it at rather than this performer's own. The reader stands at `
                + `${rankName(cultivator.realmOrdinal)} (ordinal ${cultivator.realmOrdinal}).`,
                `Realm afforded ${fromRealm}; reference afforded ${fromReference}, at stage `
                + `${atStage}. The reading is the lower of the two, because neither axis rescues `
                + 'the other - which is why a confident answer needs both a rung and a life.',
                `${learned.houses.length} house(s) teach it and this reader could place it to `
                + `${placedTo.length} of them. Verdict ${verdict}.`
            ]
        });

        const execution = this.freeAction(run, 'recognise', facts);
        execution.outcome = 'executed';
        execution.calls = [{
            name: 'world.whereThisArtWasLearned',
            action: 'recognise',
            summary:
                `${artId} at ordinal ${performedAtOrdinal}, read by a cultivator at ordinal `
                + `${cultivator.realmOrdinal}. Verdict ${verdict}. Realm and reference are read `
                + 'separately and the answer is the lower of them. Read only: no time passed, '
                + 'nothing was written, and the technique catalog was consulted only for the art '
                + 'already named in the sentence.',
            ok: true
        }];
        return execution;
    }


    // institutions acting on each other, and on the dead

    /**
     * A faction the player can actually name: a sect, a court, or an apex.
     */
    factionMeant(
        query: string | undefined,
        cultivator: Cultivator
    ): { id: string; name: string; kind: 'sect' | 'court' | 'apex' } | null {
        const wanted = (query ?? '').trim();
        if (wanted.length < 3) return null;

        const heard = (id: string): boolean =>
            this.knowledge.isAwareOf(cultivator.id, 'sect', id);

        const scope = this.scopeFor(cultivator);
        const asSect = resolveSect(this.repos, wanted, scope, cultivator.sectId);
        if (asSect) return { id: asSect.id, name: asSect.name, kind: 'sect' };

        let best: { id: string; name: string; kind: 'court' | 'apex' } | null = null;
        let bestScore = MATCH_THRESHOLD;
        for (const court of COURTS) {
            if (!heard(court.id)) continue;
            const score = matchScore(wanted, court.name);
            if (score > bestScore) {
                bestScore = score;
                best = { id: court.id, name: court.name, kind: 'court' };
            }
        }
        for (const apex of APEX_INSTITUTIONS) {
            if (!heard(apex.id)) continue;
            const score = matchScore(wanted, apex.name);
            if (score > bestScore) {
                bestScore = score;
                best = { id: apex.id, name: apex.name, kind: 'apex' };
            }
        }
        return best;
    }

    /**
     * Whether a sentence named a body and got nothing back.
     */
    namedButUnresolved(
        query: string | undefined,
        resolved: { id: string } | null
    ): boolean {
        return resolved === null && (query ?? '').trim().length >= 3;
    }

    /** What the player could put a name to, for a refusal that lists rather than shrugs. */
    private factionsKnown(cultivator: Cultivator): string[] {
        const heard = (id: string): boolean =>
            this.knowledge.isAwareOf(cultivator.id, 'sect', id);
        return [
            ...SECTS.filter(s => heard(s.id)).map(s => s.name),
            ...COURTS.filter(c => heard(c.id)).map(c => c.name),
            ...APEX_INSTITUTIONS.filter(a => heard(a.id)).map(a => a.name)
        ];
    }

    /**
     * A refusal for a sentence that named nobody this cultivator could mean.
     *
     * Identical whether the string was an unheard name or an invented one, and
     * it lists only what the player already holds.
     */
    noPartyNamed(
        action: ActionName,
        query: string | undefined,
        cultivator: Cultivator,
        headline: string,
        scene: string
    ): Execution {
        const known = this.factionsKnown(cultivator);
        return refused('engine.resolveFaction', action, factsForRefusal(
            headline,
            known.length === 0
                ? `${scene} You could not name one if you had to. Nobody has said one in front of you.`
                : `${scene} The names you have for anything of the kind are `
                  + `${known.slice(0, 6).join(', ')}${known.length > 6 ? ', and others' : ''}.`,
            `Unresolved faction "${(query ?? '').slice(0, 60)}": no knowledge record. `
            + `${known.length} faction name(s) held by this cultivator.`
        ));
    }

    // the far side of the Lid

    /**
     * The player, as somebody the far side has a row for.
     */
    residentNow(cultivator: Cultivator, run: Run): Resident | null {
        if (!this.atHand) return null;
        const resident = residentAbove(this.atHand, cultivator, Math.floor(run.elapsedDays));
        if (resident?.settledJustNow) this.worldDirty = true;
        return resident;
    }

    /**
     * Where an immortal actually is, which is somewhere rather than nowhere.
     */
    private lookAbove(run: Run, cultivator: Cultivator): Execution {
        const resident = this.residentNow(cultivator, run);
        if (!resident) {
            return this.freeAction(run, 'look', factsForToolResult(
                'The far side of the Lid.',
                [
                    'Open ground under a sky that does not weather, and nothing on it that is '
                    + 'yours. What is being kept track of for this run stops at the Lid, so what '
                    + 'is out there is not being counted.'
                ]
            ));
        }

        const lines: string[] = [];
        if (resident.abode) {
            lines.push(
                `${resident.abode.name}. ${resident.abode.description}`
            );
        }
        lines.push(
            'The seam is in sight from here, and so is the landing everybody arrives on. Nobody '
            + 'has ever needed to say which way it is.'
        );
        // Both readings. The lower one is a measured division over the living
        // roster and the upper is a rank among residents, and the whole point of
        // returning both is that a person at this height is two incompatible
        // things depending on where the question is asked from.
        if (resident.readings) {
            lines.push(resident.readings.below.statement);
            lines.push(resident.readings.above.statement);
        }

        const facts = factsForToolResult('The far side of the Lid.', lines);
        facts.structure.push(
            'This read is taken on the immortal layer. '
            + (resident.abode
                ? `The abode being stood in is ${resident.abode.id}. `
                : 'Nothing has been settled here yet, so there is no abode to stand in. ')
            + `Standing among the residents reads ${(resident.standing?.standing ?? 0).toFixed(2)}, `
            + `which is rank ${resident.standing?.rankAmongResidents ?? 'unranked'} of `
            + `${resident.standing?.residentCount ?? 'an unrecorded number of'} residents. `
            + 'No mortal-layer reader is called on this path: no practice, no hearsay, no '
            + 'province ambient.'
        );
        return this.freeAction(run, 'look', facts);
    }

    /**
     * A mortal-world sentence, re-offered in the two forms an immortal has.
     */
    private aboveTheLid(run: Run, cultivator: Cultivator, attempted: ActionName): Execution {
        const resident = this.residentNow(cultivator, run);
        const abode = resident?.abode ?? null;

        const lines = theTwoWaysDown(abode?.name ?? null);
        if (resident?.settledJustNow && abode) {
            lines.unshift(
                `You have made ${abode.name} out of ground nobody was using, which is the first `
                + 'thing anybody does up here and the first thing you have owned since the Lid '
                + 'took the rest.'
            );
        }

        const facts = factsForToolResult('Not from here. From here there are two ways.', lines);
        facts.structure.push(...theTwoWaysStructure(attempted, abode?.id ?? null));
        if (!this.atHand) {
            facts.structure.push(
                'World simulation is off for this run, so there is no layer to stand on and no '
                + 'abode was settled. The two routes are still real; nothing can be resolved '
                + 'against a world that is not running.'
            );
        }
        if (resident) {
            // Both readings, because both are true at once and neither is the
            // answer. Measured against the world they left they are beyond
            // comprehension; measured against the world they arrived in they
            // are a newcomer with no tenure, no house and no holdings - and the
            // ladder is not one of the axes, because everybody up here is 46.
            facts.structure.push(
                `Standing on the immortal layer reads `
                + `${(resident.standing?.standing ?? 0).toFixed(2)}, which is rank `
                + `${resident.standing?.rankAmongResidents ?? 'unranked'} of `
                + `${resident.standing?.residentCount ?? 'an unrecorded number of'} residents. `
                + `${resident.readings?.below.statement ?? ''}`.trim()
            );
        }
        return this.freeAction(run, attempted, facts);
    }

    /**
     * Going back down, at nine strikes, for ten to fifteen breaths.
     */
    private descend(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Execution {
        const transit = evaluateLidTransit(cultivator, 'down');
        if (!transit.permitted) {
            return refused('engine.evaluateLidTransit', 'descend', factsForRefusal(
                'There is nothing to come down from.',
                'You are standing in the world. Going down from here is a staircase, and there '
                + 'is not one.',
                `The transit was refused going down, and the reason filed is `
                + `${String(transit.reason ?? 'not recorded').replace(/_/g, ' ')}. ${transit.detail}`
            ));
        }

        const resident = this.residentNow(cultivator, run);
        if (!resident || !this.atHand) {
            return refused('engine.descend', 'descend', factsForRefusal(
                'The way is there and the world is not.',
                'The seam is where it always was. What is on the other side of it is not being '
                + 'kept track of for this run, so there is nowhere in particular to arrive.',
                'World simulation is off for this run. `descend` resolves against real locations '
                + 'and real objects and will not be approximated.'
            ));
        }

        // Where they are forcing it. A place they can name, or the ground they
        // came from - never a guess, and never somewhere they have not heard of.
        const wanted = (target ?? '').trim();
        const named = wanted.length >= 3
            ? resolveKnownPlace(wanted, cultivator, this.scopeFor(cultivator))
            : null;
        const toLocationId = named?.id
            ?? worldLocationFor(this.atHand, cultivator.location)?.id
            ?? null;
        if (!toLocationId) {
            return refused('engine.descend', 'descend', factsForRefusal(
                'Down to where?',
                'The seam opens where you put it, and you have not said where. Somewhere you '
                + 'could point to, which above the Lid means somewhere you can still name.',
                `Unresolved destination "${wanted.slice(0, 60)}" and no last mortal location on `
                + 'record. A descent is not aimed by guessing.'
            ));
        }

        // ── the strikes ──
        //
        // Rolled before the visit, because a descent that is not survived never
        // arrives and there is nothing at the bottom of it for anybody to find.
        const rng = forStream(run.seed, 'descent', cultivator.id, Math.floor(run.elapsedDays));
        const weathered = resolveDescentStrikes(cultivator, ambient, rng, run.turn);

        const calls: ToolCallRecord[] = [{
            name: 'engine.evaluateLidTransit',
            action: 'descend',
            summary: `Permitted, at ${transit.strikes} strikes. ${transit.detail}`,
            ok: true
        }, {
            name: 'engine.resolveDescentStrikes',
            action: 'descend',
            summary: weathered.detail,
            ok: weathered.survived
        }];

        // One transaction, because a save that holds the injuries and not the
        // death is worse than a save that holds neither.
        this.db.transaction((): void => {
            for (const injury of weathered.injuries) {
                this.repos.cultivators.addInjury(cultivator.id, {
                    id: injury.id,
                    severity: injury.severity,
                    source: injury.source,
                    description: injury.description,
                    sustainedOnTurn: injury.sustainedOnTurn,
                    woundType: injury.woundType
                });
            }
            this.repos.runs.incrementTurn(run.id, 1);
            if (!weathered.survived) {
                this.repos.cultivators.markDead(
                    cultivator.id, 'heavenly_tribulation', run.turn + 1,
                    'The seam discharged on the way in and there was nothing left to arrive.'
                );
            }
        })();

        if (!weathered.survived) {
            calls.push({
                name: 'cultivator.markDead',
                action: 'death',
                summary:
                    `Run closed: heavenly_tribulation on the descent. ${weathered.struck} of `
                    + `${weathered.strikes} strikes struck home. Permadeath - no reload.`,
                ok: true
            });
            return {
                facts: factsForToolResult('It did not open for you twice.', [
                    'The seam takes the same thing on the way in that it takes on the way out, '
                    + 'and it does not care that you have already weathered a crossing.',
                    weathered.detail,
                    'Nobody below saw anything. The sky did something over a hillside and then '
                    + 'stopped, and the only people who could have said what it was are not there.'
                ]),
                events: [],
                timeSkip: null,
                breakthrough: null,
                outcome: 'executed',
                calls
            };
        }

        // ── the visit ──
        const visit = worldDescend(this.atHand, {
            residentId: cultivator.id,
            toLocationId,
            onDay: Math.floor(run.elapsedDays),
            reason: wanted.length >= 3
                ? `They came for ${wanted.slice(0, 120)}.`
                : 'Nobody who was there could say why.'
        });
        if (!visit.ok) {
            calls.push({
                name: 'world.descend',
                action: 'descend',
                summary: `${visit.reason}: ${visit.detail}`,
                ok: false
            });
            return refused('world.descend', 'descend', factsForRefusal(
                'It does not open there.',
                visit.detail,
                `The descent was refused, and the reason filed is `
                + `${String(visit.reason).replace(/_/g, ' ')}.`
            ));
        }

        this.worldDirty = true;
        calls.push({
            name: 'world.descend',
            action: 'descend',
            summary:
                `${visit.breaths} breaths at ${toLocationId}; ${visit.carriedBack.length} object(s) `
                + `taken back by the lightning, ${visit.leftBehind.length} left. `
                + 'Layer unchanged: the expulsion is the whole visit.',
            ok: true
        });

        const lines = [
            weathered.detail,
            visit.detail,
            `${visit.breaths} breaths. Everybody within forty li stopped being able to stand up, `
            + 'and nobody agrees on what was in it.',
            visit.carriedBack.length > 0
                ? `Whatever you were carrying went back up with you. Nothing above `
                  + `${OBJECT_CEILING_BELOW_THE_LID} can sit in the lower world, and the same `
                  + 'lightning that takes you takes it.'
                : 'You went down carrying nothing, which is the only way anything of yours could '
                  + 'have stayed.'
        ];
        if (visit.leftBehind.length > 0) {
            lines.push(
                `${visit.leftBehind.length} thing(s) stayed, because they were under the ceiling. `
                + 'That is how every object of that grade in the world got there.'
            );
        }

        const facts = factsForToolResult('You went down.', lines);
        facts.structure.push(
            `Coming down, ${weathered.struck} of ${weathered.strikes} strikes landed, each one `
            + `${(weathered.perStrike * 100).toFixed(0)}% to land. The visit lasted `
            + `${visit.breaths} breaths, out of a window that runs `
            + `${BREATHS_IN_THE_LOWER_REALM.min} to ${BREATHS_IN_THE_LOWER_REALM.max}. `
            + `${visit.carriedBack.length} object(s) went back up with them, `
            + `${visit.leftBehind.length} stayed under the ceiling, and `
            + `${visit.refused.length} were refused passage either way.`
        );
        facts.structure.push(
            'Layer unchanged by design. The expulsion is not a second action: the visit is '
            + 'resolved atomically because the pressure is pushing them out for the whole of it.'
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls
        };
    }

    /**
     * The immortal end of the channel: send something down, and a word with it.
     */
    sendDown(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        message: string | undefined
    ): Execution {
        const resident = this.residentNow(cultivator, run);
        if (!resident || !this.atHand) {
            return refused('world.sendAcross', 'offer', factsForRefusal(
                'Nothing to send it through.',
                'What is below is not being kept track of for this run, so there is nobody in '
                + 'particular at the other end.',
                'World simulation is off for this run. `sendAcross` moves real objects between '
                + 'real holders and will not be approximated.'
            ));
        }

        const lines = linesDownward(this.atHand, cultivator.id);
        if (lines.length === 0) {
            // The most interesting refusal on this layer, and it is a fact
            // about what they left rather than about what they are.
            return refused('world.sendAcross', 'offer', factsForRefusal(
                'There is no line.',
                'Nothing carries it. A line through the Lid is an object, held by somebody down '
                + 'there, left by somebody who went up - and you left nothing that anybody is '
                + 'holding. The bodies below that receive anything at all receive it because '
                + 'somebody on the way out cared enough about a specific house to put something '
                + 'in its hands, and a claim to hold one is usually a claim.',
                'No object tagged `lid_channel` is held by anybody below. See `ascend`, which '
                + 'marks a parting gift as one on the way out.'
            ));
        }

        // Which line. Named, or the only one there is - never a guess between
        // several, because the object names the recipient.
        const wanted = (target ?? '').trim();
        const chosen = wanted.length >= 3
            ? lines.find(line =>
                matchScore(wanted, line.name) > MATCH_THRESHOLD
                || matchScore(wanted, holderOf(this.atHand!, line)?.name ?? '') > MATCH_THRESHOLD)
            : lines.length === 1 ? lines[0] : undefined;
        if (!chosen) {
            return refused('world.sendAcross', 'offer', factsForRefusal(
                'Down which line?',
                'You hold more than one way of reaching down and they do not go to the same '
                + 'person. A channel reaches exactly one, which is what makes it a channel '
                + 'rather than an announcement.',
                `${lines.length} channel object(s) available; "${wanted.slice(0, 40)}" matched none.`
            ));
        }

        const holder = holderOf(this.atHand, chosen);
        if (!holder) {
            return refused('world.sendAcross', 'offer', factsForRefusal(
                'Nobody is holding it.',
                'The line is lying somewhere nobody has picked it up from. A channel with nobody '
                + 'at the far end is an object.',
                `${chosen.id} has no possessor.`
            ));
        }

        const said = (message ?? '').trim();
        const result = worldSendAcross(this.atHand, {
            fromId: cultivator.id,
            toId: holder.id,
            onDay: Math.floor(run.elapsedDays),
            channelObjectId: chosen.id,
            subject: 'information',
            message: said.length >= 2
                ? said.slice(0, 400)
                : 'Nothing was said with it, which is its own instruction.'
        });

        if (!result.ok) {
            return refused('world.sendAcross', 'offer', factsForRefusal(
                'It does not go.',
                result.detail,
                `Sending it across was refused, and the reason filed is `
                + `${String(result.reason).replace(/_/g, ' ')}.`
            ));
        }

        this.worldDirty = true;
        const facts = factsForToolResult(`${chosen.name} answered.`, [
            `Whatever you put through it reached ${holder.name} and nobody else. A channel does `
            + 'not announce; one person will know, and every account of it after this will be '
            + 'somebody repeating what they were told.',
            said.length >= 2
                ? `What went with it: ${said}`
                : 'Nothing went with it but the fact that it moved, which is a message of a kind.',
            'And that is all you have done. It will be acted on by people who are not you, who '
            + 'will do what they think you meant, and you will not be told what came of it '
            + 'unless somebody sends back.'
        ]);
        facts.structure.push(
            `sendAcross: information down ${chosen.id} (${chosen.name}) to ${holder.id}. `
            + 'Stored as their memory and as a secret fact. No public knowledge is created.'
        );
        facts.structure.push(
            `Object ceiling not exercised: nothing material was sent. An object would be capped `
            + `at power ${OBJECT_CEILING_BELOW_THE_LID} to remain below.`
        );

        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'world.sendAcross',
                action: 'offer',
                summary:
                    `Information sent down ${chosen.id} to ${holder.id}. No tribulation drawn: `
                    + 'nothing of the sender crossed.',
                ok: true
            }]
        };
    }

    // inheritance grounds

    /**
     * The realm rank a sentence names, or null when it names none.
     */
    private ordinalNamed(text: string | undefined): number | null {
        const query = (text ?? '').toLowerCase().trim();
        if (query.length < 3) return null;
        for (let ordinal = MAX_ORDINAL; ordinal >= 0; ordinal--) {
            if (query.includes(rankName(ordinal).toLowerCase())) return ordinal;
        }
        return null;
    }

    /**
     * The art a curriculum sentence named, or null when it named none.
     */
    private artNamed(text: string | undefined, cultivator: Cultivator): string | null {
        const query = (text ?? '').trim();
        if (query.length < 3 || GENERIC_LIBRARY_PHRASE.test(query)) return null;
        return resolveTechnique(this.repos, query, cultivator.id)?.id ?? null;
    }

    /**
     * What is for sale where they are standing.
     */
    private async market(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
        const category = MARKET_CATEGORIES.find(c => (target ?? '').toLowerCase().includes(c));
        const result = await handleMarket({
            action: 'market',
            cultivatorId: cultivator.id,
            ...(category ? { category } : {})
        });
        const board = this.fromToolResult(
            'cultivation_mortal.market', 'market', result, 'The market'
        );
        if (board.outcome !== 'executed') return board;

        this.atHand = this.atHand ?? await this.loadWorld();
        const offered = whatIsBeingOfferedHere(
            this.knowledge, cultivator, run, this.atHand, this.alreadyHasACopyOf(cultivator)
        );
        // AND WHEN NOBODY IS SELLING, WHY NOT
        const shownLines = offered.offers.length > 0
            ? offered.lines
            : linesForWhatWillNotMove(offered.read);
        for (const line of shownLines) {
            board.facts.lines.push(line);
            board.facts.prose = `${board.facts.prose}

${line}`;
        }
        // The cost half goes to `lines`, and it has to.
        board.facts.lines.push(
            'You read what is on offer here. Nothing was bought and no time passed.'
        );
        board.facts.structure.push(
            `${offered.peopleHere} person(s) standing here; ${offered.offers.length} offer(s) `
            + 'after the cut, priced between what a counter would give the holder and what the '
            + 'copy is worth. Reading them costs nothing: nothing bought, no time passed.'
        );
        // WHAT WAS NAMED IS WHAT "THE CHEAPER ONE" CAN MEAN NEXT TURN.
        const stall = (result as { manuals?: MarketPrice[] }).manuals;
        if (Array.isArray(stall)) {
            for (const book of stall) {
                if (typeof book.name !== 'string') continue;
                this.namedThisTurn.push({
                    name: book.name,
                    ...(typeof book.spiritStones === 'number' ? { stones: book.spiritStones } : {})
                });
            }
        }
        this.namedThisTurn.push(...offered.offers.map(offer => ({
            name: offer.name,
            stones: offer.askStones,
            from: offer.sellerName
        })));
        if (offered.offers.length > 0) {
            board.calls.push({
                name: 'engine.whatThisPersonWouldPartWith',
                action: 'market',
                summary: offered.offers
                    .map(o => `${o.sellerName} -> ${o.name} at ${o.askStones} (list `
                        + `${o.listStones}, counter ${o.counterStones}, why ${o.why}, `
                        + `awkward ${o.awkwardToHold})`)
                    .join('; '),
                ok: true
            });
        }
        return board;
    }

    /**
     * What happens if they try.
     */
    private async assess(cultivator: Cultivator, target: string | undefined): Promise<Execution> {
        const query = (target ?? '').trim();

        // a master reading a student
        if (query.length === 0 || GameService.ASSESSING_THEMSELVES.test(query)) {
            const read = await handleAssess({
                action: 'assess',
                cultivatorId: cultivator.id,
                against: 'student'
            });
            return this.fromToolResult(
                'cultivation_perception.assess', 'assess', read, 'The reckoning'
            );
        }

        // "HERE" IS A PLACE, AND IT IS THE ONE THEY ARE STANDING IN
        const place = GameService.THE_GROUND_UNDER_THEIR_FEET.test(query)
            ? placeName(cultivator)
            : query;

        const result = await handleAssess({
            action: 'assess',
            cultivatorId: cultivator.id,
            against: 'place',
            place
        });
        return this.fromToolResult('cultivation_perception.assess', 'assess', result, 'The reckoning');
    }

    /**
     * Words that mean the place the asker is standing in, and cannot mean a name.
     */
    private static readonly THE_GROUND_UNDER_THEIR_FEET =
        /^(?:here|this place|where i am|where i(?:'m| am) standing|around here|this ground|the ground(?: here)?)$/i;

    /**
     * An assessment with no subject, or with the asker as the subject.
     */
    private static readonly ASSESSING_THEMSELVES =
        /^(?:my ?self|me|my (?:progress|standing|position|cultivation|prospects)|where i (?:am|stand)|whether i(?:'m| am)? (?:ready|stuck|stalled|finished|done)|if i(?:'m| am)? (?:ready|stuck|stalled)|ready|stuck|stalled)$/i;

    /**
     * Alchemy, through the same handler the MCP tool surface calls.
     */
    private async refine(run: Run, cultivator: Cultivator, target: string | undefined): Promise<Execution> {
        const query = (target ?? '').trim();

        // "what can I make"
        if (query.length < 2 || GENERIC_PILL_PHRASE.test(query)) {
            const listed = await handleListRecipes({
                action: 'list_recipes',
                cultivatorId: cultivator.id,
                includeOutOfReach: false
            });
            if (isGuidingErrorBody(listed)) {
                return this.fromToolResult(
                    'alchemy_manage.list_recipes', 'refine', listed, 'The formulas'
                );
            }

            // Rendered here rather than left to `fromToolResult`'s summariser.
            // `handleListRecipes` returns rows and no `narrationHint`, and the
            // generic fallback for a body it cannot summarise is "It is done.
            // Nothing about it drew attention." - which is what a player asking
            // what they can make was actually told. A read that reports nothing is
            // worse than no read: it says the answer is empty when the answer is
            // forty-two formulas.
            const rows = (listed as { recipes?: RecipeRow[] }).recipes ?? [];
            const lines = rows.length === 0
                ? [
                    'Nothing you could work. Every method you have ever been shown wants a rank '
                    + 'you have not reached, and the cauldron does not care how badly you want it.'
                ]
                : rows.slice(0, RECIPES_SHOWN).map(row => {
                    const short = row.ingredients.filter(i => i.short > 0);
                    return `${row.name}, for ${row.produces?.name ?? 'something'}. `
                        + `${row.ingredients.map(i => `${i.required} x ${i.name}`).join(', ')}. `
                        + (short.length === 0
                            ? 'You are holding everything it wants.'
                            : `Short of ${short.map(i => `${i.short} x ${i.name}`).join(', ')}.`)
                        + ` About ${Math.round((row.estimatedSuccessRate ?? 0) * 100)} in a hundred `
                        + 'come out as a pill rather than as slag.';
                });
            if (rows.length > RECIPES_SHOWN) {
                lines.push(
                    `${rows.length - RECIPES_SHOWN} more you could attempt, and the pouch is the `
                    + 'limit rather than the knowing.'
                );
            }

            const facts = factsForToolResult(
                rows.length === 0
                    ? 'Nothing within reach.'
                    : `${rows.length} formula${rows.length === 1 ? '' : 's'} you could work.`,
                lines
            );
            facts.structure.push(
                `alchemy_manage.list_recipes: ${rows.length} within reach at ordinal `
                + `${cultivator.realmOrdinal}; out-of-reach formulas withheld.`
            );
            return this.freeAction(run, 'refine', facts);
        }

        const recipe = resolveRecipe(query);
        if (!recipe) {
            const held = pouchNames(this.db, cultivator.id);
            return refused('engine.resolveRecipe', 'refine', factsForRefusal(
                query.length >= 2 ? `No formula called ${query}.` : 'No formula named.',
                held.length > 0
                    ? 'You turn out the pouch and look at what is in it for a while. Nothing in ' +
                      'there adds up to the thing you had in mind, and there is no method for it ' +
                      'that you were ever taught.'
                    : 'The pouch is empty and the cauldron is cold, and wanting a pill is not a ' +
                      'method for making one.',
                `Unresolved recipe "${query}". Pouch: ${held.join(', ') || 'empty'}.`
            ));
        }

        const result = await handleRefine({
            action: 'refine',
            recipeId: recipe.id,
            cultivatorId: cultivator.id,
            supplements: []
        });

        return this.fromToolResult('alchemy_manage.refine', 'refine', result, recipe.name);
    }

    /**
     * Practising an art, through `technique_manage.practise`.
     */
    private async train(
        cultivator: Cultivator,
        target: string | undefined,
        /**
         * How long they said, and it was being thrown away.
         */
        days?: number
    ): Promise<Execution> {
        const query = (target ?? '').trim();
        let technique = query.length >= 2 ? resolveTechnique(this.repos, query, cultivator.id) : null;

        // THE ONE ART THEY HAVE.
        if (!technique && query.length === 0) {
            const held = this.repos.techniques.listKnown(cultivator.id);
            // Resolved by name through the same path a typed name takes, so the
            // sole art arrives as the same shape and nothing downstream has to
            // know it was inferred.
            if (held.length === 1) {
                technique = resolveTechnique(this.repos, held[0].name, cultivator.id);
            }
        }

        const known = technique ? this.repos.techniques.getKnown(cultivator.id, technique.id) : null;

        if (!technique || !known) {
            const knows = knownTechniqueNames(this.repos, cultivator.id);
            return refused('engine.resolveTechnique', 'train_technique', factsForRefusal(
                technique ? `${technique.name} is not known.` : 'No art named.',
                technique
                    ? `You know the name and that is the whole of what you have of it. Nobody ever ` +
                      `taught you ${technique.name}, and going through the motions of something you ` +
                      'have not been shown is just moving.'
                    : knows.length > 0
                        // Name them. A player told they are undecided, without
                        // being told between what, has to go and look.
                        ? 'You settle to practise, and then cannot decide which of them you meant: ' +
                          `${knows.join(', ')}.`
                        : 'You settle to practise, and it comes to you that you have never actually ' +
                          'been taught anything.',
                `Unresolved or unlearned technique. Known: ${knows.join(', ') || 'none'}.`
            ));
        }

        const spent = Math.max(1, Math.round(days ?? TRAINING_DAYS));
        const result = await handlePractise({
            action: 'practise',
            techniqueId: technique.id,
            cultivatorId: cultivator.id,
            days: spent
        });

        const execution = this.fromToolResult(
            'technique_manage.practise', 'train_technique', result, technique.name
        );
        if (execution.outcome === 'executed') {
            execution.facts.structure.push(
                `Practised ${technique.name} for ${spent} day(s), `
                + `${days === undefined
                    ? `off TRAINING_DAYS because the sentence named no span`
                    : 'off the span in the sentence'}. `
                + 'The days are real: `handlePractise` ages the cultivator by them, rolls one '
                + 'deviation check and advances the run.'
            );
            if (days === undefined) {
                // Required, because it is a correction to the player's own
                // sentence: they asked for something open-ended, or for nothing
                // in particular, and got a figure the engine picked. A route,
                // not an apology - the span is theirs to name.
                sayThisWhateverTheNarratorDoes(
                    execution.facts,
                    `You did not say for how long, so it came to ${humanDays(spent)} - which is `
                    + 'what a stretch runs when nobody names one, and is not long enough to be '
                    + 'the answer to anything. Say the span and it runs that: "I practise it for '
                    + 'ten years".'
                );
            }
        }
        return execution;
    }

    /**
     * Foraging.
     */
    private async gather(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Promise<Execution> {
        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, GATHERING_DAYS, {
            seed: run.seed,
            // The row id is a randomUUID; without this the run is not
            // reproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: GATHERING_FOCUS,
                ...this.rateTermsFor(cultivator),
                ground: this.groundFor(cultivator)
            },
            understanding: this.understandingFor(run, cultivator),
            // What is in the pack feeds them here too. Only seclusion tops the
            // pack up from the purse; this eats what is already carried.
            rations: this.drawFromPack(cultivator, GATHERING_DAYS),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, { before: cultivator, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        // A named herb narrows the draw to that herb if it is within reach;
        // otherwise the catalog's weighted table decides, which is the honest
        // answer to "I look for something useful".
        const wanted = (target ?? '').trim().length >= 2 ? resolveHerb(target!.trim()) : null;
        const rng = forStream(run.seed, 'web_forage', startDay, placeName(cultivator));
        const rolled = rollHerb(applied.cultivator.realmOrdinal, rng.next());
        // NAMING A HERB HAS TO NARROW THE DRAW, and this line used to return
        // `rolled` from both branches - so "I gather Blood Millet" rolled the
        // weighted table and handed back Qi Grass, and the comment above it
        // described a behaviour the code did not have.
        const named = wanted ? getHerb(wanted.id) : undefined;
        const found = named && named.harvestOrdinal <= applied.cultivator.realmOrdinal
            ? named
            : rolled;

        const withinReach = found && found.harvestOrdinal <= applied.cultivator.realmOrdinal
            ? found
            : null;

        // ── AND THE GROUND HAS A NUMBER ──────────────────────────────────
        //
        // What the catalog offers is a statement about the searcher. What is
        // still here is a statement about the place, and it goes down.
        const ground = withinReach
            ? this.takeFromTheGround(applied.cultivator, 'herb', withinReach.grade, 1)
            : { taken: 1, line: null };
        const pouched = withinReach && ground.taken > 0 ? withinReach : null;
        if (pouched) {
            addToPouch(this.db, cultivator.id, pouched.id, 'herb', 1);
        }

        const calls: ToolCallRecord[] = [
            ...skipCalls('gather', skip, null),
            ...tollCalls(applied.tollLines),
            ...worldCalls(world),
            {
                name: pouched ? 'storage.addToPouch' : 'engine.rollHerb',
                action: 'gather',
                summary: pouched
                    ? `One ${pouched.name} (${pouched.grade}) added to the pouch.`
                    : withinReach
                        ? `${withinReach.name} (${withinReach.grade}) is what grows here and the `
                          + 'ground has none of that grade left. Nothing taken.'
                        : found
                            ? `${found.name} grows here but wants ${found.harvestOrdinal} ordinal to take safely. Left where it was.`
                            : 'The catalog offered nothing within reach at this realm.',
                ok: true
            }
        ];

        const facts = factsForGather(
            cultivator, applied.cultivator, skip, ambient,
            pouched ? { name: pouched.name, grade: pouched.grade, value: pouched.value } : null
        );
        if (ground.line) {
            facts.lines.push(ground.line);
            facts.prose = `${facts.prose}\n\n${ground.line}`;
        }

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls
        };
    }

    /**
     * Going out after something that is not a person.
     */
    private async hunt(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Promise<Execution> {
        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, HUNTING_DAYS, {
            seed: run.seed,
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: GATHERING_FOCUS,
                ...this.rateTermsFor(cultivator),
                ground: this.groundFor(cultivator)
            },
            understanding: this.understandingFor(run, cultivator),
            rations: this.drawFromPack(cultivator, HUNTING_DAYS),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, { before: cultivator, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);
        const me = applied.cultivator;
        const here = placeName(me);
        const ground = this.beastGroundFor(me);
        const today = Math.floor(applied.run.elapsedDays);

        // Naming something narrows the draw to it, exactly as naming a herb
        // narrows foraging - and for the same reason. A refusal that tells a
        // player which beast a material comes off is worth nothing if the game
        // then ignores the name it just told them to go and find.
        const named = this.beastMeant(target);
        const rng = forStream(run.seed, 'web_hunt', startDay, here);
        const found = whatIsOnThisGround(ground, me.realmOrdinal, rng.next());
        const met: Beast | null = named ?? found.met;

        const calls: ToolCallRecord[] = [
            ...skipCalls('hunt', skip, null),
            ...tollCalls(applied.tollLines),
            ...worldCalls(world)
        ];
        const lines: string[] = [];

        // WHAT THE HUNTING HAS DONE TO THIS GROUND
        const worked = this.atHand ? worldLocationFor(this.atHand, here) : null;
        const emptied = worked
            ? whatIsLeftOutThere(worked, Math.floor(this.atHand!.currentDay))
            : null;
        if (emptied) lines.push(emptied);

        // WHAT IS ABOVE THEM ON THIS GROUND, AND WHERE IT GOES
        const reachable = found.worst !== null && found.worst.band !== 'unreachable';
        const whatElseIsOutHere = found.above.length > 0 && found.worst
            ? (() => {
                const worst = found.above.reduce((a, b) => (b.ordinal > a.ordinal ? b : a));
                return `Also out here and above you: ${found.above.length} `
                    + `${found.above.length === 1 ? 'thing' : 'things'}, the worst of them `
                    + `${worst.name} at ${rankName(worst.ordinal)}.`
                    + (reachable ? ` ${found.worst!.reaction}` : '');
            })()
            : null;

        if (!met) {
            lines.push(
                `${humanDays(skip.simulatedDays)} out on the ground around ${here} and nothing `
                + 'came of it. What lives here has either been taken already or is not worth '
                + 'the walk.'
            );
            // Nothing was found, so what is standing over the ground IS the
            // answer rather than a footnote to one.
            if (whatElseIsOutHere) lines.push(whatElseIsOutHere);
            calls.push({
                name: 'engine.whatIsOnThisGround',
                action: 'hunt',
                summary:
                    `No beast drawn at ${here} (sealed=${ground.sealed}, vein=${ground.onAVein}) `
                    + `for ordinal ${me.realmOrdinal}. ${found.above.length} above them here.`,
                ok: true
            });
            return this.huntResult(me, skip, ambient, 'Nothing came of it.', lines, calls);
        }

        lines.push(
            `${humanDays(skip.simulatedDays)} out from ${here}. `
            + readTheThing(met, me.realmOrdinal)
        );
        if (whatElseIsOutHere) lines.push(whatElseIsOutHere);
        calls.push({
            name: 'engine.whatIsOnThisGround',
            action: 'hunt',
            summary:
                `${met.id} (${met.name}, ordinal ${met.ordinal}, band ${bandOf(met)}, `
                + `speaks=${met.speaks}) met at ${here}. `
                + (named ? 'Named by the player, not drawn.' : 'Drawn on the weighted table.'),
            ok: true
        });

        // ── SOMETHING THAT COULD HAVE ANSWERED YOU ───────────────────────
        //
        // Not a refusal of the killing - see the header. A refusal to do it on
        // the player's behalf when they did not ask for it by name.
        if (readsAsSomebody(met) && !named) {
            lines.push(
                'You did not come out here to kill somebody, and that is what this is. If you '
                + 'mean to, say so by name and it will go the way those go.'
            );
            return this.huntResult(
                me, skip, ambient,
                `${met.name}, and it is a party rather than a problem.`, lines, calls
            );
        }

        const result = await handleResolve({
            action: 'resolve',
            cultivatorId: me.id,
            // A name and an ordinal. Nothing else is passed, because nothing
            // else is authored: `ordinal` is the only measure of danger this
            // catalog carries, and inventing attributes for a beast would be a
            // second stat block in a repo that deleted the first.
            opponent: { name: met.name, realmOrdinal: met.ordinal },
            goal: 'kill',
            vector: 'body',
            edges: [],
            opponentEdges: [],
            fightToTheEnd: false
        });

        const fight = this.fromToolResult('combat_manage.resolve', 'hunt', result, met.name);
        calls.push(...fight.calls);
        lines.push(...fight.facts.lines);

        const body = isGuidingErrorBody(result) ? null : result as Record<string, unknown>;

        // FOR A BEAST, `finished` IS THE DEATH
        const killed = body?.opponentDied === true
            || (body?.finished === true && bandOf(met) !== 'person');

        const harvest = whatComesOffTheBody({
            beast: met, takerOrdinal: me.realmOrdinal, killed
        });
        lines.push(...this.takeFromTheBody(harvest, met, me, here, today, killed, calls));

        // ── AND WHO ANSWERS FOR IT ───────────────────────────────────────
        //
        // After the body, because what came off it is what the player came for
        // and the account is what it cost them. See `whoAnswersForTheKill`.
        if (killed) {
            const answered = this.whoAnswersForTheKill(run, me, met, here, today);
            lines.push(...answered.lines);
            calls.push(...answered.calls);
        }

        return this.huntResult(
            me, skip, ambient,
            killed ? `${met.name} is down.` : `${met.name}, and it is still standing.`,
            lines, calls
        );
    }

    /**
     * Who answers for a beast that was killed, and only where somebody found out.
     */
    private whoAnswersForTheKill(
        run: Run,
        cultivator: Cultivator,
        beast: Beast,
        here: string,
        today: number
    ): { lines: string[]; calls: ToolCallRecord[] } {
        const lines: string[] = [];
        const calls: ToolCallRecord[] = [];
        if (!this.atHand) return { lines, calls };

        const row = worldLocationFor(this.atHand, here);
        const holderId = row?.controllingFactionId ?? null;
        const holder = holderId
            ? this.atHand.factions.find(f => f.id === holderId && f.dissolvedOnDay === null) ?? null
            : null;

        // Whoever was standing behind it. NEVER the beast: below the change
        // the thing killed is an animal and cannot hold a record about
        // anybody, and whose ground it was under is a property question this
        // layer owns.
        const standing: Party | null = holder
            ? {
                id: holder.id,
                name: holder.name,
                houseId: holder.id,
                houseName: holder.name,
                alignment: holder.alignment,
                ranked: true
            }
            : null;

        const answerability = answerabilityOf(beast, standing);
        // Nothing to answer for and nothing to say. Most hunts.
        if (answerability === 'not_an_individual' || answerability === 'nobody_stood_behind_it') {
            calls.push({
                name: 'engine.answerabilityOf',
                action: 'hunt',
                summary:
                    `${beast.id} at ordinal ${beast.ordinal} (${beast.disposition}) reads `
                    + `${answerability} at ${here}`
                    + (holder ? ` (held by ${holder.id})` : ' (ground nobody holds)')
                    + '. No party, no account, nothing written.',
                ok: true
            });
            return { lines, calls };
        }

        const mySectId = positionIn(this.repos, cultivator.id)?.sectId ?? null;
        const mySect = mySectId ? this.repos.sects.getById(mySectId) : null;
        const killer: Party = {
            id: cultivator.id,
            name: cultivator.name,
            houseId: mySectId,
            houseName: mySect?.name ?? null,
            alignment: mySect?.alignment ?? null,
            ranked: mySectId !== null
        };

        // Who was on this ground, and therefore what the holder can say. Read
        // off `NpcRecord.locationId`, which is the one record of who is where.
        const theirPeopleHere = row
            ? npcsAt(this.atHand, row.id).filter(n => n.factionId === holder!.id)
            : [];
        const stages = new Map<string, KnowingStage>();
        stages.set(holder!.id, theirPeopleHere.length > 0 ? 'placed' : 'named');
        for (const person of theirPeopleHere) stages.set(person.id, 'placed');

        const left = whatTheKillLeft({
            beast,
            standing,
            killer,
            stages,
            onDay: today,
            description:
                `${beast.name} was killed on ${holder!.name}'s ground at ${here} on day ${today}.`,
            witnesses: theirPeopleHere.length,
            // Somebody in a house answers to a body the aggrieved side can
            // deal with; somebody in none answers to nobody, and it is settled
            // directly or not at all.
            reach: mySectId ? 'answerable' : 'unbacked'
        });

        lines.push(left.line);
        calls.push({
            name: 'engine.whatTheKillLeft',
            action: 'hunt',
            summary:
                `${beast.id} (${beast.disposition}, ordinal ${beast.ordinal}) killed on `
                + `${holder!.id}'s ground. ${left.answerability}; they lost `
                + `"${left.whatTheyLost}"; ${left.knownTo.length} party/parties can name it. `
                + `Deed paid by ${left.deed?.paidBy}, cost `
                + `${left.deed?.cost.toFixed(3)}, weight ${left.leaves?.weight}, reached `
                + `${left.leaves?.reached}.`,
            ok: true
        });

        // AND THE WORLD CONTAINS THE KILLING
        const deed = aDeedEntersTheWorld(this.atHand, {
            kind: 'resource_contested',
            weight: left.leaves!.weight,
            workedOut: left.knownTo.length > 0,
            day: Math.floor(this.atHand.currentDay),
            locationId: row?.id ?? null,
            place: here,
            actors: [{ id: cultivator.id, name: cultivator.name, role: 'killed it' }],
            factionIds: [holder!.id],
            summary:
                `${cultivator.name} killed ${beast.name} on ${holder!.name}'s ground at ${here}. `
                + `What they lost is ${left.whatTheyLost}.`,
            unattributed:
                'Something that was out there is not out there any more, and the people who '
                + 'counted on it are the ones who noticed first.',
            data: {
                beastId: beast.id,
                disposition: beast.disposition,
                ordinal: beast.ordinal,
                answerability: left.answerability
            }
        });
        this.worldDirty = true;
        calls.push({
            name: 'world.aDeedEntersTheWorld',
            action: 'hunt',
            summary:
                `${deed.fact.id} (resource_contested, ${deed.weight}, magnitude `
                + `${deed.fact.magnitude.toFixed(2)}, ${deed.fact.visibility}) written on day `
                + `${deed.fact.day}. ${deed.fact.witnessIds.length} witness id(s).`,
            ok: true
        });

        // AND THE ACCOUNTS IT OPENS
        for (const opens of left.leaves!.opens) {
            const record = createObligation({ ...opens, triggeringEventId: deed.fact.id });
            writeObligation(this.db as unknown as DatabaseHandle, record);
            calls.push({
                name: 'social.createObligation',
                action: 'hunt',
                summary:
                    `${record.id}: ${record.holderId} holds a ${record.severity} ${record.kind} `
                    + `about ${record.subjectId} for ${record.cause}, off ${deed.fact.id}. `
                    + 'Permanent until settled, and inheritable.',
                ok: true
            });
        }

        // Whether they can name the house is the discovery layer's question, asked
        // here rather than assumed - the same rule the site verb keeps.
        if (left.knownTo.length > 0) {
            const known = this.knowledge.isAwareOf(cultivator.id, 'sect', holder!.id);
            // The guard from `ground-holder.ts`, and here it is the ordinary
            // case rather than the edge one: of the 34 held locations in a
            // seeded world with the holder's own people standing on them, ALL
            // 34 are named after the house that holds them. Naming both naively
            // would print "Azure Cloud Pavilion holds Azure Cloud Pavilion
            // grounds" on every single one.
            const groundCarriesTheirName =
                here.toLowerCase().includes(holder!.name.toLowerCase());
            lines.push(known
                ? groundCarriesTheirName
                    ? `${here} is held by the house it is named for, and they keep a count of `
                      + 'what is on it.'
                    : `${holder!.name} holds ${here}, and they keep a count of what is on it.`
                : `Somebody holds ${here} and keeps a count of what is on it. You have no `
                  + 'name for them, which does not make the count any shorter.');
        }
        void run;
        return { lines, calls };
    }

    /**
     * Move what came off the body into the world, in the shape it deserves.
     */
    private takeFromTheBody(
        harvest: ReturnType<typeof whatComesOffTheBody>,
        beast: Beast,
        cultivator: Cultivator,
        here: string,
        today: number,
        killed: boolean,
        calls: ToolCallRecord[]
    ): string[] {
        const lines: string[] = [];

        for (const { material, shape } of harvest.taken) {
            // WHAT THE DISTRICT STILL HAS
            const ground = this.takeFromTheGround(
                cultivator, 'beast_material', material.grade, 1
            );
            if (ground.line) lines.push(ground.line);
            if (ground.taken <= 0) {
                // Named, for the same reason as the two lines in
                // `whoAnswersForTheKill`: `here` is the place, it is already on
                // the object record three statements down as `place: here`, and
                // a sentence about ground that is worked out is exactly the one
                // a player needs to be able to attach to somewhere.
                lines.push(
                    `The ${material.name} is what ${here} used to give up, and it has none `
                    + 'left to give.'
                );
                calls.push({
                    name: 'engine.drawFromTheGround',
                    action: 'hunt',
                    summary:
                        `${material.id} (${material.grade}) refused: the beast_material band is `
                        + 'worked out here.',
                    ok: true
                });
                continue;
            }

            if (shape === 'counted') {
                addToPouch(this.db, cultivator.id, material.id, 'herb', 1);
                lines.push(
                    `${material.name} (${material.grade}, about ${material.value} stones) `
                    + 'into the pouch.'
                );
                calls.push({
                    name: 'storage.addToPouch',
                    action: 'hunt',
                    summary: `${material.id} x1 (counted, ${material.grade}) to ${cultivator.id}.`,
                    ok: true
                });
                continue;
            }

            // Tracked. A row in the world, with an origin.
            const record = objectForBeastMaterial({
                id: `obj-${material.id}-${cultivator.id}-${today}`,
                material,
                beast,
                takerId: cultivator.id,
                takerName: cultivator.name,
                place: here,
                onDay: today
            });
            if (this.atHand) {
                this.atHand.objects.push(record);
                this.worldDirty = true;
            }
            // And the pouch entry beside it, which is the player-facing half
            // and not a second copy: the object row is which one this is and
            // where it has been, the pouch row is the thing a counter quotes.
            addToPouch(this.db, cultivator.id, material.id, 'herb', 1);
            lines.push(
                `${material.name} (${material.grade}, about ${material.value} stones) comes off `
                + 'it. This one is on the record: whose it is, where it came from, and what it '
                + 'was taken off.'
            );
            calls.push({
                name: 'world.transferPossession',
                action: 'hunt',
                summary:
                    `${record.id} (${material.name}, ${material.grade}, significance `
                    + `${record.significance}) minted off ${beast.id} and moved to `
                    + `${cultivator.id} as looted on day ${today}. `
                    + `${record.provenance.length} provenance link(s). `
                    + `Tags: ${record.tags.join(', ')}.`,
                ok: true
            });
        }

        for (const { material, because, needs } of harvest.leftBehind) {
            lines.push(because === 'realm'
                ? `The ${material.name} is there and taking it wants ${rankName(needs)}. `
                  + 'Left where it was.'
                : `The ${material.name} only comes off a body, and there is no body.`);
        }

        if (harvest.taken.length === 0 && killed) {
            lines.push('Nothing on it you can take at your realm.');
        }
        return lines;
    }

    /**
     * Take counted stock out of the ground under somebody.
     */
    private takeFromTheGround(
        cultivator: Cultivator,
        kind: StockKind,
        grade: Herb['grade'],
        wanted: number
    ): { taken: number; line: string | null } {
        const place = this.atHand ? worldLocationFor(this.atHand, cultivator.location) : null;
        if (!place || !this.atHand) return { taken: wanted, line: null };

        // The WORLD's clock, never the run's. Worlds outlive runs, so a stock
        // ticking on `elapsedDays` would grow back to full every time somebody
        // died and a new life opened.
        const draw = drawFromTheGround(place, {
            kind, grade, wanted, onDay: Math.floor(this.atHand.currentDay)
        });
        if (recordGroundDraw(place, draw)) this.worldDirty = true;
        return { taken: draw.taken, line: draw.line };
    }

    /** The ground under them, in the facts the beast catalog reads. */
    private beastGroundFor(cultivator: Cultivator): GroundForBeasts {
        const record = this.atHand
            ? worldLocationFor(this.atHand, cultivator.location)
            : null;
        if (!record) return { sealed: false, onAVein: false };
        return {
            sealed: record.sealed,
            // Geology, not usability - `qiDensity` is what the vein under this
            // place holds and `spiritualDensity` is what anybody can draw. A
            // beast sits on the first, which is why a sealed pocket nobody can
            // use is exactly the ground something has been growing on.
            onAVein: record.qiDensity >= 60
                || record.environment.resources.includes('qi')
        };
    }

    private huntResult(
        after: Cultivator,
        skip: TimeSkipResult,
        ambient: AmbientQi,
        headline: string,
        lines: string[],
        calls: ToolCallRecord[]
    ): Execution {
        const facts = factsForToolResult(headline, lines);
        facts.structure.push(
            ...factsForTimeSkip(after, after, skip, ambient, 'Hunting').structure
        );
        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls
        };
    }

    /**
     * A named beast, resolved the way the game prints it.
     */
    private beastMeant(target: string | undefined): Beast | null {
        const wanted = (target ?? '').trim().toLowerCase();
        if (wanted.length < 3) return null;
        const exact = BEASTS.find(b => b.name.toLowerCase() === wanted || b.id === wanted);
        if (exact) return exact;
        const contains = BEASTS.filter(b =>
            wanted.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(wanted));
        if (contains.length === 1) return contains[0];
        const byWord = BEASTS.filter(b => b.name.toLowerCase().split(/\s+/)
            .some(word => word.length >= 4 && wanted.includes(word)));
        return byWord.length === 1 ? byWord[0] : null;
    }

    /**
     * Fold an MCP handler's return value into an Execution.
     */
    /**
     * ADMIN, the exploratory testing surface.
     */
    private async adminAct(request: string, run: Run, cultivator: Cultivator): Promise<ActResult> {
        if (!isAdminModeEnabled()) {
            throw new GameError(
                'ADMIN is off for this process. Start the server with ADMIN_MODE=true to enable it.',
                403
            );
        }

        // Reset is dispatched in `act`, BEFORE the live-run guard, because it
        // is the one admin verb that has to work on a corpse. See the banner
        // there. Anything reaching here has a live run behind it.
        const parsed = parseAdminCommand(request);
        if (!parsed.action) {
            throw new GameError(
                `ADMIN needs an action: ${ADMIN_ACTIONS.join(', ')}. ` +
                'Arguments are key=value, for example: ADMIN spawn_site kind=grave ordinal=41'
            );
        }

        const args: Record<string, unknown> = {
            cultivatorId: cultivator.id,
            runId: run.id,
            // The operator's own ids win over anything typed, and `action` is
            // last so a `action=` in the arguments cannot redirect the call.
            ...parsed.args,
            action: parsed.action
        };

        const response = await handleAdminManage(args);
        const text = response.content?.[0]?.text ?? 'The admin surface returned nothing.';
        const after = this.currentRun();

        // AND THEN THE WORLD IS LOOKED AT
        let estate: EstateOutcome | null = null;
        if (!after.cultivator.alive && after.cultivator.deathCause) {
            this.atHand = this.atHand ?? await this.loadWorld();
            estate = this.settleTheEstateIfTheyDied();
            if (this.worldDirty) {
                this.worldDirty = false;
                await saveWorldForRun(after.run);
            }
        }

        const told = response.changed
            ? await this.lookAfterAdmin(after.cultivator, after.run)
            : null;

        this.log.append(run.id, [
            { role: 'player', turn: run.turn, text: `ADMIN ${request.trim()}` },
            // The engine's own words, filed AS the engine. This used to go in
            // as `narrator`, which put a field report in the slot the story is
            // told from and left the transcript claiming a narrator had said
            // "Action performed: spawned".
            { role: 'engine', turn: after.run.turn, text },
            ...(told ? [{ role: 'narrator' as const, turn: after.run.turn, text: told.text }] : [])
        ]);

        return {
            narration: told ? `${text}\n\n${told.text}` : text,
            events: [],
            // The estate row goes in the ENGINE channel and not into the receipt's
            // prose. An operator whose `advance_days` starved somebody needs to be
            // able to see where what they were carrying went - it is exactly the
            // post-state ADMIN exists to show - and it is a field report rather
            // than something a character perceived, so it belongs in the inspector
            // beside every other call this turn made.
            toolCalls: [
                ...(estate ? [{
                    name: 'world.settleWhatTheyWereCarrying',
                    action: 'death',
                    summary: estate.facts.structure.join(' '),
                    ok: true
                }] : []),
                ...(told ? [narrationCall(told)] : [])
            ],
            state: this.stateView(after.run, after.cultivator)
        };
    }

    /**
     * The world as it now stands, told by whatever narrator this process has.
     */
    /**
     * End this run and begin another, from the top.
     */
    private async adminReset(name: string, run: Run, cultivator: Cultivator): Promise<ActResult> {
        const wanted = name.length > 0 ? name : cultivator.name;

        writeAdminAudit(this.repos, 'reset', run.id, {
            endedCultivator: cultivator.name,
            atOrdinal: cultivator.realmOrdinal,
            onTurn: run.turn,
            rebornAs: wanted
        });
        this.repos.runs.endRun(
            run.id,
            null,
            `Reset by the operator on turn ${run.turn}. Not a death.`,
            'dead'
        );

        // `newRun` writes the birth, seeds the world around it and narrates the
        // opening into the NEW run's log. Nothing here re-narrates: a second
        // call would be a second opening for the same life, and they would not
        // agree with each other.
        const created = await this.newRun(wanted);
        const opened = this.log.list(created.run.id)
            .filter(entry => entry.role === 'narrator')
            .pop();

        const receipt = [
            `reset - ${cultivator.name} closed, ${created.cultivator.name} born`,
            // AND IT MUST NOT CLAIM NOBODY DIED WHEN SOMEBODY DID
            `Ended: run ${run.id} on turn ${run.turn}, at ordinal ${cultivator.realmOrdinal}. `
                + (run.status === 'active'
                    ? 'No death cause was filed, because there was no death. '
                    : `That run was already closed - ${run.deathCause ?? 'cause unrecorded'} - `
                      + 'and the reset did not overwrite it. ')
                + 'That run is flagged admin and is not in the ledger.',
            `Begun: run ${created.run.id}, in the same world.`,
            'ADMIN - out of world. Everything ABOVE this line is the engine reporting, and '
                + 'no part of it is a claim about what a character perceives. What follows it is '
                + 'the new life opening, and that is narration.'
        ].join('\n\n');

        this.log.append(run.id, [
            { role: 'player', turn: run.turn, text: `ADMIN reset${name.length > 0 ? ` ${name}` : ''}` },
            { role: 'engine', turn: run.turn, text: receipt }
        ]);

        const after = this.currentRun();
        return {
            narration: opened ? `${receipt}

${opened.text}` : receipt,
            events: [],
            toolCalls: [],
            state: this.stateView(after.run, after.cultivator)
        };
    }

    private async lookAfterAdmin(cultivator: Cultivator, run: Run) {
        const ambient = this.ambientFor(cultivator, run);
        return await this.narrator.narrate(
            factsForLook(cultivator, ambient, this.company(cultivator)),
            {
                place: placeName(cultivator),
                ambient,
                awareness: this.awarenessOf(cultivator)
            }
        );
    }

    fromToolResult(
        name: string,
        action: ActionName,
        result: object,
        subject: string
    ): Execution {
        if (isGuidingErrorBody(result)) {
            // `message` is written in the world's voice by the tool layer.
            const hint = typeof result.hint === 'string' ? result.hint : null;
            const execution = refused(name, action, factsForRefusal(
                `${subject}: refused.`,
                result.message,
                'The engine declined, and the reason it filed is '
                + `${String(result.error).replace(/_/g, ' ')}.`
            ));
            execution.calls[0].summary = `${result.error}${hint ? `. ${hint}` : ''}`;
            return execution;
        }

        const body = result as Record<string, unknown>;
        const hint = typeof body.narrationHint === 'string' ? body.narrationHint : null;

        // The handler's own `narrationHint` is written in the world's voice and
        // is the whole account. What used to lead this list was
        // "${subject}: the engine resolved it." - a sentence about the software,
        // shipped to a player, which is the exact defect the refusal sweep was
        // for and which no test caught because these verbs did not exist yet.
        const detail = summariseToolBody(body);
        const lines = hint
            ? [hint, ...detail]
            : detail.length > 0 ? detail : ['It is done. Nothing about it drew attention.'];

        return {
            facts: factsForToolResult(hint ?? lines[0], lines),
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{ name, action, summary: hint ?? lines.join(' '), ok: true }]
        };
    }

    private eat(run: Run, cultivator: Cultivator): Execution {
        if (cultivator.satiety >= SATIETY_MAX && cultivator.starvationTurns === 0) {
            return refused('cultivator.applyDeltas', 'eat', factsForRefusal(
                'Already fed.',
                'You are not hungry, and eating for the sake of it is a habit for people with more ' +
                'stones than you have.',
                `Satiety already ${cultivator.satiety}/${SATIETY_MAX}; no purchase made.`
            ));
        }
        if (cultivator.spiritStones < MEAL_COST_STONES) {
            return refused('cultivator.applyDeltas', 'eat', factsForRefusal(
                'Nothing to buy it with.',
                'You count what you are carrying twice, which does not change it. A bowl costs ' +
                'more than that, and nobody here is in the business of charity.',
                `Meal costs ${MEAL_COST_STONES}; purse holds ${cultivator.spiritStones}.`
            ));
        }

        const restored = SATIETY_MAX - cultivator.satiety;
        const after = this.db.transaction((): Cultivator => {
            const updated = this.repos.cultivators.applyDeltas(cultivator.id, {
                satiety: restored,
                starvationTurns: -cultivator.starvationTurns,
                spiritStones: -MEAL_COST_STONES
            });
            if (!updated) throw new GameError('Cultivator vanished mid-meal.', 500);
            this.repos.runs.incrementTurn(run.id, 1);
            return updated;
        })();

        return {
            facts: factsForEat(after, restored, MEAL_COST_STONES),
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'cultivator.applyDeltas',
                action: 'eat',
                summary:
                    `Satiety +${restored} to ${after.satiety}/100, starvation counter cleared, ` +
                    `${MEAL_COST_STONES} spirit stone spent (${after.spiritStones} left).`,
                ok: true
            }]
        };
    }

    // being hurt, and the shop that was always there

    /**
     * The two lines on the board that answer "I am hurt".
     */
    private static readonly PRICE_PHYSICIAN_VISIT = 'price-doctor-visit';
    private static readonly PRICE_COURSE_OF_CARE = 'price-splint-and-month';

    /**
     * Getting a wound seen to.
     */
    private async treat(run: Run, cultivator: Cultivator, ambient: AmbientQi): Promise<Execution> {
        const hurt = untreatedInjuries(cultivator.injuries);
        const visit = getPrice(GameService.PRICE_PHYSICIAN_VISIT)!;
        const course = getPrice(GameService.PRICE_COURSE_OF_CARE)!;
        const regionId = standingOf(cultivator).regionId;
        const courseCash = localPrice(regionId, course.cash);
        // Rounded UP to whole stones. The purse holds whole stones and a
        // player must never be charged less than the board quoted.
        const perWound = Math.max(1, Math.ceil(cashToStones(courseCash)));

        // WHAT A PHYSICIAN IS ACTUALLY FOR
        const battered = cultivator.hp < cultivator.maxHp;

        // WHAT A PHYSICIAN CAN ACTUALLY REACH, PRICED BEFORE IT IS SOLD
        const reachable = hurt.filter(injury =>
            !isPermanentWound(injury.woundType)
            && medicineReaches('mortal', injury.severity, cultivator.realmOrdinal));
        const outOfReach = hurt.filter(injury =>
            !isPermanentWound(injury.woundType)
            && !medicineReaches('mortal', injury.severity, cultivator.realmOrdinal));

        if (reachable.length === 0 && outOfReach.length > 0 && !battered) {
            const needed = outOfReach
                .map(injury => medicineNeededFor(injury.severity, cultivator.realmOrdinal))
                .sort((a, b) => medicineRank(b) - medicineRank(a))[0];
            // AND IT NAMES THE THING THAT WOULD WORK.
            const cure = whatWouldCloseThisWound(
                hurt, cultivator.realmOrdinal, cultivator.spiritStones, regionId);
            return refused('engine.medicineNeededFor', 'treat', factsForRefusal(
                'Past what a physician can do.',
                `They look at what you are carrying and put their hands in their sleeves. `
                + `${cultivator.realmOrdinal >= FOUNDATION_ORDINAL
                    ? 'A body at this height does not mend on splints and boiled roots'
                    : 'Damage this deep does not close under ordinary care'}`
                // "nothing below it will reach" was the old clause, and with the
                // cure named underneath it the page then contradicted itself:
                // a heaven-grade requirement stated, and a mortal-grade pill
                // offered in the next breath. The requirement is the
                // PHYSICIAN'S - `medicineReaches` is consulted here and nowhere
                // on the pill path - so the sentence says whose it is.
                + `: it wants ${needed}-grade medicine, and there is none of it in a `
                + 'village surgery. They will not take money for a month that would '
                + 'change nothing.'
                + (cure ? `\n\n${whatToSayAboutTheCure(cure)}` : ''),
                `${outOfReach.length} untreated wound(s) beyond mortal grade at ordinal `
                + `${cultivator.realmOrdinal}; highest requirement ${needed}. `
                + (cure
                    ? `Cure named: ${cure.name}, ${cure.stones ?? 'not sold for stones'}. `
                    : '')
                + 'Nothing bought, nothing spent, no time passed.'
            ));
        }

        if (hurt.length === 0 && !battered) {
            return refused('engine.untreatedInjuries', 'treat', factsForRefusal(
                'Nothing to see to.',
                'You take stock of yourself and find nothing anybody could charge you for. '
                + 'Whatever is wrong with your life today, it is not a wound and it is not the body.',
                `No untreated injuries on record and HP is full at ${cultivator.hp}/${cultivator.maxHp}. `
                + `${course.name} would have cost ${perWound} spirit stone(s) a wound. `
                + 'Nothing bought, nothing spent, no time passed.'
            ));
        }

        // Being put back on your feet is the cheaper line on the same board.
        // A course of care closes a meridian; a visit sets what is ordinary
        // about a body, and somebody with no torn meridians is buying the
        // second one.
        const visitCash = localPrice(regionId, visit.cash);
        const restingPrice = Math.max(1, Math.ceil(cashToStones(visitCash)));
        // Priced on what can be REACHED, not on what is being carried: a wound
        // past mortal grade is not a course anybody is going to sell.
        const dueNow = reachable.length === 0 ? restingPrice : perWound;

        if (cultivator.spiritStones < dueNow) {
            return refused('engine.localPrice', 'treat', factsForRefusal(
                'Not for what you are carrying.',
                `${hurt.length === 0 ? visit.name : course.name} is `
                + `${hurt.length === 0 ? visitCash : courseCash} cash, which is ${dueNow} spirit `
                + `stone${dueNow === 1 ? '' : 's'}. You are carrying ${cultivator.spiritStones}, `
                + `which is ${dueNow - cultivator.spiritStones} short. ${visit.note} None of it is `
                + 'sold on credit, and lying down somewhere for free is not the same thing.',
                `${hurt.length === 0 ? visit.id : course.id} = ${dueNow} stone(s); purse holds `
                + `${cultivator.spiritStones}. HP ${cultivator.hp}/${cultivator.maxHp}, `
                + `${hurt.length} untreated injury(ies).`
            ));
        }

        // How many meridians get closed, and what the whole stay costs. A stay
        // with no wounds in it still costs the visit: somebody was paid to keep
        // a body alive for a month.
        const courses = Math.min(reachable.length, Math.floor(cultivator.spiritStones / perWound));
        const cost = Math.max(restingPrice, courses * perWound);

        // A month under somebody's roof, fed out of the purse the same way a
        // seclusion is. The clock runs through it: the world moves, the food
        // is bought or it is not, and a cultivator who cannot pay for both can
        // still starve during the stay - through the survival layer, exactly
        // as they would anywhere else.
        const provisioning = this.buyProvisions(cultivator, TREATMENT_DAYS);
        const paid = this.repos.cultivators.applyDeltas(provisioning.cultivator.id, { spiritStones: -cost });
        if (!paid) throw new GameError('Cultivator vanished on the physician\'s table.', 500);

        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(paid, TREATMENT_DAYS, {
            seed: run.seed,
            // The row id is a randomUUID; without this the run is not
            // reproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(paid),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: TREATMENT_FOCUS,
                ...this.rateTermsFor(paid),
                ground: this.groundFor(paid)
            },
            understanding: this.understandingFor(run, paid),
            rations: provisioning.rations,
            grainAbstinence: false,
            autoBreakthrough: false,
            // Lying still under a roof. Nothing wanders in, and no opportunity
            // finds somebody who cannot stand up, which is the same bargain
            // closed-door seclusion makes.
            randomEvents: false,
            toll: tollConditionsFor(this.repos, paid)
        });

        const applied = applyTimeSkip(this.repos, { before: paid, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        // The month can kill: the bleed clock runs through it, and so does the
        // food clock. The survival layer has already written it and nothing
        // here may treat a corpse's wounds or report a recovery over the top
        // of a death.
        if (!applied.cultivator.alive) {
            const dead = factsForTimeSkip(paid, applied.cultivator, skip, ambient, 'Under a physician');
            dead.lines.unshift(provisioning.line);
            dead.lines.push(
                `The ${cost} spirit stone${cost === 1 ? '' : 's'} for the care was paid up front and `
                + 'nobody is going to refund it.'
            );
            return {
                facts: dead,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                outcome: 'executed',
                calls: [...skipCalls('treat', skip, provisioning.line), ...worldCalls(world)]
            };
        }

        // The engine's own triage decides which wounds, worst first. This layer
        // decides only how many were paid for. MORTAL GRADE, because that is what a
        // village physician is. The two axes are the owner's ruling - the rarity of
        // the medicine scales with the severity of the injury and the realm of the
        // injured - and before this the resolver had neither, so a Nascent Soul
        // with crippling torn meridians bought thirty days of splints for fourteen
        // stones and walked out whole. See
        // `what-grade-of-medicine-a-wound-needs.ts`.
        const triage = treatWorstInjuries(
            applied.cultivator.injuries,
            courses,
            severity => medicineReaches('mortal', severity, applied.cultivator.realmOrdinal)
        );
        const treated = applied.cultivator.injuries.filter(
            (before: Injury) => !before.treated
                && triage.injuries.some((closed: Injury) => closed.id === before.id && closed.treated)
        );
        // AND THE BODY, A FIXED AMOUNT FOR A FULL MONTH
        const lay = Math.max(0, Math.min(1, skip.simulatedDays / TREATMENT_DAYS));
        const missing = applied.cultivator.maxHp - applied.cultivator.hp;
        const mended = Math.max(0, Math.min(missing, Math.round(CARE_RESTORES_HP * lay)));

        const persist = this.db.transaction(() => {
            for (const injury of treated) {
                this.repos.cultivators.treatInjury(injury.id, run.turn + 1);
            }
            if (mended > 0) this.repos.cultivators.applyDeltas(cultivator.id, { hp: mended });
        });
        persist();

        const after = this.repos.cultivators.getById(cultivator.id)!;
        const stillHurt = untreatedInjuryCount(after.injuries);
        const facts = factsForTreatment(cultivator, after, {
            what: course.name,
            note: course.note,
            cashEach: courseCash,
            stonesEach: perWound,
            stonesSpent: cost,
            days: skip.simulatedDays,
            treated: treated.map(injury => injury.description),
            stillUntreated: stillHurt,
            mended
        });
        facts.lines.unshift(provisioning.line);

        // WHAT THE STAY COULD NOT REACH, AND WHAT WOULD
        const beyond = untreatedInjuries(after.injuries)
            .filter(injury => !isPermanentWound(injury.woundType))
            .filter(injury => !medicineReaches('mortal', injury.severity, after.realmOrdinal));
        if (beyond.length > 0) {
            const needed = beyond
                .map(injury => medicineNeededFor(injury.severity, after.realmOrdinal))
                .sort((a, b) => medicineRank(b) - medicineRank(a))[0];
            facts.lines.push(
                `${beyond.length} of them ${beyond.length === 1 ? 'is' : 'are'} past what a `
                + `physician can do. ${after.realmOrdinal >= FOUNDATION_ORDINAL
                    ? 'A body at this height does not mend on splints and boiled roots'
                    : 'Damage this deep does not close under ordinary care'}`
                + `: it wants ${needed}-grade medicine, and nothing below it will reach.`
            );
            facts.structure.push(
                `medicineNeededFor: ${beyond.length} wound(s) beyond mortal grade at ordinal `
                + `${after.realmOrdinal}; highest requirement ${needed}.`
            );
        }

        facts.lines.push(...applied.tollLines);
        facts.lines.push(...world.lines);
        facts.structure.push(...world.structure);

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'cultivator.applyDeltas',
                    action: 'treat',
                    summary:
                        `${courses} course(s) of ${course.name} at ${courseCash} cash (${perWound} stone(s)) `
                        + `each = ${cost} stones. Priced through localPrice(${regionId}), the same call `
                        + 'the market board prices with.',
                    ok: true
                },
                ...skipCalls('treat', skip, provisioning.line),
                {
                    name: 'engine.treatWorstInjuries',
                    action: 'treat',
                    summary:
                        `${treated.length} injury(ies) treated worst-first by the engine's own triage; `
                        + `${stillHurt} still untreated. Treated wounds stay on the record as scar `
                        + 'tissue and contribute no penalty.',
                    ok: treated.length > 0
                },
                {
                    // CARE'S OWN CONTRIBUTION, ON A CHANNEL THAT IS NOT PROSE.
                    name: 'engine.mortalCare',
                    action: 'treat',
                    summary:
                        `${mended} HP restored by the stay itself: a full month restores `
                        + `${CARE_RESTORES_HP}, scaled by the ${lay.toFixed(2)} of one actually lain `
                        + `still, capped at the ${missing} the body was missing. The same month's `
                        + 'ambient mending is a separate figure and belongs to the skip above.',
                    ok: true
                },
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ]
        };
    }

    /**
     * Buying a line off the price board.
     */
    private async buy(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Promise<Execution> {
        const query = (target ?? '').trim();

        // A BOOK, WHICH IS THE ONE THING ON THE BOARD THAT WAS NOT
        const bought = await this.buyAManual(run, cultivator, query);
        if (bought) return bought;

        // SOMETHING TO GET ON, AHEAD OF THE BOARD'S OWN MATCH
        const asRide = priceRowForSomethingToRide(query);
        const resolved = asRide === undefined && query.length >= 3
            ? resolvePrice(query)
            : null;
        const price = asRide !== undefined
            ? getPrice(asRide)
            : resolved ? getPrice(resolved.id) : undefined;

        if (!price) {
            // ABOVE A CERTAIN LINE, CASH IS NOT THE MEDIUM
            const asPill = query.length >= 3 ? resolvePill(query) : null;
            const pill = asPill ? getPill(asPill.id) : undefined;
            const notForSale = pill ? cashRefusalReason(pill) : null;
            if (pill && notForSale) {
                return refused('engine.pillTradeTier', 'buy', factsForRefusal(
                    `${pill.name} is not bought with money.`,
                    `${notForSale} What ${pill.name} does is not in question, and neither is your `
                    + 'purse: it is that a counter is the wrong place to be standing.',
                    `${pill.id} trades by barter at ${pill.grade} grade, so no cash price exists `
                    + 'to quote. Nothing bought, nothing spent, no time passed.'
                ));
            }

            // One line per category, not the first eight rows of the catalog.
            const board = boardSample(
                PRICES.map(row => ({ ...row } as unknown as MarketPrice))
            ).map(row => row.name).join(', ');
            return refused('engine.resolvePrice', 'buy', factsForRefusal(
                'Not something anybody here sells.',
                'You ask for it and get the look people give somebody asking for a thing that is '
                + `not sold. What is: ${board}, and a dozen more besides.`,
                'Nothing bought, nothing spent, no time passed.'
            ));
        }

        // Medicine that is a course of care rather than an object routes to the
        // treatment path, so the physician on the board and the sentence "I get
        // my injuries treated" reach the same code and cannot disagree about
        // what a wound costs.
        if (price.id === GameService.PRICE_COURSE_OF_CARE || price.id === GameService.PRICE_PHYSICIAN_VISIT) {
            return this.treat(run, cultivator, ambient);
        }

        const regionId = standingOf(cultivator).regionId;
        const cash = localPrice(regionId, price.cash);
        const stones = Math.max(1, Math.ceil(cashToStones(cash)));

        // What the engine actually holds a row for. A pill goes in the pouch;
        // a ferry crossing and a night at an inn do not, and saying so beats
        // taking the money for a state change that never happens.
        const pill = price.category === 'medicine' ? resolvePill(price.name.replace(/,.*$/, '')) : null;

        // A THING YOU CAN ACTUALLY PUT UNDER YOU
        const rideable = conveyanceSoldAs(price.id);
        if (rideable) {
            // The catalog names carry their own article - "A drawn carriage" -
            // so anything writing "a ${name}" reads "a a drawn carriage".
            const what = rideable.name.replace(/^an?\s+/i, '').toLowerCase();
            if (cultivator.spiritStones < stones) {
                return refused('engine.localPrice', 'buy', factsForRefusal(
                    'Not for what you are carrying.',
                    `${price.name} is ${cash} cash here, which is ${stones} spirit `
                    + `stone${stones === 1 ? '' : 's'}. You are carrying `
                    + `${cultivator.spiritStones}, and nobody is offering terms on a `
                    + `${what}.`,
                    `${price.id} at ${cash} cash = ${stones} stone(s); purse holds `
                    + `${cultivator.spiritStones}.`
                ));
            }
            const before = this.whatIsInTheirYard(cultivator);
            const after0 = adjustCountedHolding(before, rideable.id, 1);
            addToPouch(
                this.db, cultivator.id, rideable.id, 'artifact',
                (after0[countedHoldingKey(rideable.id)] ?? 0)
                    - (before[countedHoldingKey(rideable.id)] ?? 0)
            );
            this.repos.cultivators.update(cultivator.id, {
                spiritStones: cultivator.spiritStones - stones
            });
            const after = this.repos.cultivators.getById(cultivator.id)!;
            const facts = factsForToolResult(
                `${price.name} bought.`,
                [
                    `${price.name} for ${stones} spirit stone${stones === 1 ? '' : 's'}. `
                    + `${price.note}`,
                    `It covers ${rideable.crossesGroundThatCannotBeWalked ? 'ground nothing '
                        + 'walks up as readily as a road' : 'a road and nothing else'}, it is `
                    + `${rideable.seenComing ? 'seen coming' : 'nothing anybody remarks on'}, and `
                    + `it carries ${rideable.heads}. `
                    + `You are carrying ${after.spiritStones} now.`,
                    'Say where you are going and that you are riding, and it will be under you.'
                ]
            );
            facts.structure.push(
                `adjustCountedHolding: ${rideable.id} `
                + `${before[countedHoldingKey(rideable.id)] ?? 0} -> `
                + `${after0[countedHoldingKey(rideable.id)] ?? 0} on ${cultivator.id}; `
                + `${stones} stone(s) spent, ${after.spiritStones} left. Counted, not tracked - `
                + 'there is nothing to recognise and nobody to be asked about it.'
            );
            const execution = this.freeAction(run, 'buy', facts);
            execution.calls = [{
                name: 'world.adjustCountedHolding',
                action: 'buy',
                summary:
                    `${price.id} resolved to ${rideable.id} (${rideable.grade} grade, `
                    + `${rideable.range} range, counted). +1 on the player's own row.`,
                ok: true
            }];
            return execution;
        }

        if (!pill) {
            const facts = factsForUnsupported(
                `buying ${price.name}`,
                `${price.name} is priced and quoted and there is no row in this engine for holding `
                + 'one, so nothing was charged.'
            );
            facts.lines.push(
                `${price.name} is ${cash} cash the ${price.unit} here, which is about ${stones} `
                + `spirit stone${stones === 1 ? '' : 's'}. ${price.note}`,
                'You could pay it. Nothing in your life would be different afterwards, so you keep '
                + 'the money.'
            );
            facts.prose = facts.lines.join('\n\n');
            return refused('engine.possessions', 'buy', facts);
        }

        if (cultivator.spiritStones < stones) {
            return refused('engine.localPrice', 'buy', factsForRefusal(
                'Not for what you are carrying.',
                `${price.name} is ${cash} cash the ${price.unit} here, which is ${stones} spirit `
                + `stone${stones === 1 ? '' : 's'}. You are carrying ${cultivator.spiritStones}. `
                + `You are ${stones - cultivator.spiritStones} short and nobody is offering terms.`,
                `${price.id} at ${cash} cash = ${stones} stone(s); purse holds `
                + `${cultivator.spiritStones}. Short by ${stones - cultivator.spiritStones}.`
            ));
        }

        const after = this.db.transaction((): Cultivator => {
            const updated = this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -stones });
            if (!updated) throw new GameError('Cultivator vanished mid-purchase.', 500);
            addToPouch(this.db, cultivator.id, pill.id, 'pill', 1);
            this.repos.runs.incrementTurn(run.id, 1);
            return updated;
        })();

        // THE ALMANAC IS NOT THE LEDGER
        const shortfall = whatThisPurchaseWillNotReach(cultivator, pill.id, regionId);

        const facts = factsForToolResult(`${pill.name}, bought.`, [
            `One ${pill.name}, ${cash} cash the ${price.unit}, which is ${stones} spirit `
            + `stone${stones === 1 ? '' : 's'} of the ${cultivator.spiritStones} you had.`,
            `${after.spiritStones} left in the purse, and the pill is in the pouch.`,
            ...shortfall.lines
        ]);
        facts.structure.push(
            `${price.id} -> ${pill.id}: ${cash} cash at the ${regionId} multiplier, charged as `
            + `${stones} stone(s). One added to cultivator_pouch.`,
            ...shortfall.structure
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'storage.addToPouch',
                action: 'buy',
                summary:
                    `One ${pill.name} for ${stones} spirit stone(s), priced through `
                    + `localPrice(${regionId}) - the same call the market board prices with.`,
                ok: true
            }]
        };
    }

    /** "a manual", "a book", "a cultivation technique" - a category, not a name. */
    private static readonly BOOK_IN_GENERAL =
        /^(?:a |an |one |the |some |any |my )?\s*(?:cultivation |gathering |qi )?(?:manual|manuals|book|books|scripture|scriptures|canon|canons|primer|primers|art|arts|technique|techniques|method|methods)\s*$/i;

    /**
     * Buying a copy of a manual, which is the first real decision in the game. ──
     * THREE ANSWERS, AND THE MIDDLE ONE IS THE GOOD WRITING ────────────
     */
    private async buyAManual(
        run: Run,
        cultivator: Cultivator,
        query: string
    ): Promise<Execution | null> {
        const stock = manualsAStallCarries();
        const regionId = standingOf(cultivator).regionId;
        const askingFor = (book: { id: string; cash: number }): number =>
            Math.max(1, Math.ceil(cashToStones(localPrice(regionId, book.cash))));

        // the stall, read
        if (query.length === 0 || GameService.BOOK_IN_GENERAL.test(query)) {
            const lines = stock.length === 0
                ? ['Nobody within a day of here copies books for a living.']
                : [
                    'Beside the cooking pots, block-printed and much copied:',
                    ...stock.map(book =>
                        `  ${book.name}, ${askingFor(book)} spirit stones. Opens at `
                        + `${rankName(book.requiredOrdinal)} and carries as far as `
                        + `${rankName(book.cap)}`
                        + (book.requiredOrdinal > cultivator.realmOrdinal
                            ? ', which is above where you stand.'
                            : '.')),
                    `You are carrying ${cultivator.spiritStones} spirit stones. Name one and it `
                    + 'is yours; the stones will not then be.'
                ];
            const facts = factsForToolResult(
                stock.length === 0 ? 'No stall, and no books on it.' : 'What the stall has.',
                lines
            );
            facts.structure.push(
                `${stock.length} title${stock.length === 1 ? '' : 's'} on the stall, each `
                + `priced at this region's own rate rather than a catalog list price. `
                + 'Reading the stall costs nothing: nothing bought, nothing spent, no time passed.'
            );
            // A name the game printed is a name the next turn may point at with
            // "the cheaper one". Recorded where the listing is decided; see the
            // note in `market`.
            this.namedThisTurn.push(...stock.map(book => ({
                name: book.name,
                stones: askingFor(book)
            })));
            return this.freeAction(run, 'buy', facts);
        }

        if (query.length < 3) return null;

        // BUYING IT OFF THE PERSON HOLDING IT
        this.atHand = this.atHand ?? await this.loadWorld();
        const fromAPerson = whatIsBeingOfferedHere(
            this.knowledge, cultivator, run, this.atHand, this.alreadyHasACopyOf(cultivator)
        ).offers.find(offer => matchScore(query, offer.name) > MATCH_THRESHOLD);
        if (fromAPerson) {
            const bought = await this.buyOffSomebodyStandingHere(run, cultivator, fromAPerson);
            if (bought) return bought;
        }

        const named = stock.find(book => matchScore(query, book.name) > MATCH_THRESHOLD);
        if (!named) {
            // A real art, and not one anybody sells. The refusal `items.md`
            // asks for, plus the thing the old one never said: what would work.
            const art = resolveTechnique(this.repos, query, cultivator.id);
            if (!art) return null;
            const taughtBy = getSectsTeaching(art.id).length;
            return refused('engine.stallPriceCash', 'buy', factsForRefusal(
                `${art.name} is not bought with money.`,
                'You ask for it at a counter and get the look people give somebody who has not '
                + 'understood what they are looking at. Books like this move between people who '
                + 'know each other. '
                + (taughtBy > 0
                    ? `${taughtBy} house${taughtBy === 1 ? '' : 's'} teach${taughtBy === 1 ? 'es' : ''} `
                      + 'it, and each of them teaches it to its own.'
                    : 'Nobody alive is known to teach it, which is a different problem and a worse '
                      + 'one.')
                + (stock.length > 0
                    ? ` What IS on the stall: ${stock.map(b => `${b.name}, ${askingFor(b)} stones`).join('; ')}.`
                    : ''),
                `${art.id} is not stall stock: cap above COMMON_MANUAL_CAP, or fewer than `
                + 'COMMON_HOUSE_COUNT houses teach it. Nothing bought, nothing spent, no time passed.'
            ));
        }

        const stones = askingFor(named);
        if (cultivator.spiritStones < stones) {
            return refused('engine.stallPriceCash', 'buy', factsForRefusal(
                'Not for what you are carrying.',
                `${named.name} is ${stones} spirit stone${stones === 1 ? '' : 's'} here. You are `
                + `carrying ${cultivator.spiritStones}, which is ${stones - cultivator.spiritStones} `
                + 'short. The stallholder has copied it out by hand and is not moved by how badly '
                + 'you want it.',
                `${named.id} at ${stones} stone(s) through localPrice(${regionId}); purse holds `
                + `${cultivator.spiritStones}. Nothing bought, nothing spent.`
            ));
        }

        const after = this.db.transaction((): Cultivator => {
            const updated = this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -stones });
            if (!updated) throw new GameError('Cultivator vanished mid-purchase.', 500);
            recordACopyHeld(this.db, cultivator.id, named.id);
            this.repos.runs.incrementTurn(run.id, 1);
            return updated;
        })();

        const facts = factsForToolResult(`${named.name}, bought.`, [
            `${stones} spirit stone${stones === 1 ? '' : 's'} of the ${cultivator.spiritStones} `
            + `you had, and the copy is yours. ${after.spiritStones} left.`,
            `It opens at ${rankName(named.requiredOrdinal)} and carries as far as `
            + `${rankName(named.cap)}. Owning it and having read it are different facts: sitting `
            + 'down with it is a separate thing you have not done yet.'
        ]);
        facts.structure.push(
            `${named.name} bought for ${stones} spirit stone${stones === 1 ? '' : 's'}, at this `
            + 'region\'s own multiplier rather than a catalog list price. The copy is now held '
            + 'and the art is not: owning it and having sat down with it are separate facts, and '
            + 'only the second one teaches anybody anything.'
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'technique_manage.recordACopyHeld',
                action: 'buy',
                summary:
                    `One copy of ${named.name} for ${stones} spirit stone(s), priced through `
                    + `localPrice(${regionId}) - the same call the market board prices with. `
                    + 'The art is NOT learned by this; the book is held.',
                ok: true
            }]
        };
    }

    /**
     * Whether a copy of this is already on them, one way or another.
     */
    private alreadyHasACopyOf(cultivator: Cultivator): (thingId: string) => boolean {
        const held = new Set(copiesHeldBy(this.db, cultivator.id));
        const known = new Set(cultivator.knownTechniques);
        return (thingId: string) => held.has(thingId) || known.has(thingId);
    }

    /**
     * Buying a copy off the cultivator standing in front of you.
     */
    private async buyOffSomebodyStandingHere(
        run: Run,
        cultivator: Cultivator,
        offer: AnOfferStandingHere
    ): Promise<Execution | null> {
        if (cultivator.spiritStones < offer.askStones) return null;
        if (this.alreadyHasACopyOf(cultivator)(offer.thingId)) return null;

        const after = this.db.transaction((): Cultivator => {
            const updated = this.repos.cultivators.applyDeltas(
                cultivator.id, { spiritStones: -offer.askStones }
            );
            if (!updated) throw new GameError('Cultivator vanished mid-purchase.', 500);
            recordACopyHeld(this.db, cultivator.id, offer.thingId);
            this.repos.runs.incrementTurn(run.id, 1);
            return updated;
        })();

        const facts = factsForToolResult(`${offer.name}, off ${offer.sellerName}.`, [
            `${offer.askStones} spirit stone${offer.askStones === 1 ? '' : 's'} of the `
            + `${cultivator.spiritStones} you had, and the copy is yours. `
            + `${after.spiritStones} left.`,
            WHY_THEY_ARE_SELLING[offer.why],
            offer.usefulUntil > offer.usableFrom
                ? `It opens at ${rankName(offer.usableFrom)} and carries as far as `
                  + `${rankName(offer.usefulUntil)}. Owning it and having read it are different `
                  + 'facts.'
                : `It opens at ${rankName(offer.usableFrom)} and carries nobody past it. Owning `
                  + 'it and having read it are different facts.',
            // WHO WILL WANT A WORD WITH YOU, WHICH IS NOT WHOSE IT IS
            ...(() => {
                const answerable = unauthorisedPractice(
                    { factionId: cultivator.sectId ?? null }, offer.thingId
                );
                if (answerable === null) return [];
                const named = answerable
                    .map(id => (getSect(id) as { name?: string } | undefined)?.name ?? id);
                return [
                    `The art is the ${named.join(' and the ')}'s, and you are not one of theirs. `
                    + 'Practising it is a visible thing that people who know it recognise on '
                    + 'sight, and it stays recognisable for as long as you keep climbing on it. '
                    + `Nothing here stops you; what changes is that ${named[0]} now `
                    + 'has a question about you that they have not asked yet.'
                ];
            })()
        ]);
        facts.structure.push(
            `${offer.name} bought off ${offer.sellerName} for ${offer.askStones} stone(s): `
            + `list ${offer.listStones}, what a counter would have given them `
            + `${offer.counterStones}, reason ${offer.why}, betrayalOfSelling rung `
            + `${offer.awkwardToHold}. A copy was written out; the seller keeps theirs where the `
            + 'book is commonly held. The art is NOT learned by this - the book is held. '
            + `unauthorisedPractice against ${cultivator.sectId ?? 'no house'}: `
            + `${(unauthorisedPractice({ factionId: cultivator.sectId ?? null }, offer.thingId)
                ?? ['nobody']).join(', ')}.`
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'engine.whatThisPersonWouldPartWith',
                action: 'buy',
                summary:
                    `${offer.sellerName} -> ${offer.name} at ${offer.askStones} stone(s), between `
                    + `a counter's ${offer.counterStones} and a list of ${offer.listStones}, `
                    + `because ${offer.why.replace(/_/g, ' ')}.`,
                ok: true
            }]
        };
    }

    /**
     * Putting something on the counter.
     */
    /**
     * Handing somebody a thing you already hold, for nothing.
     */
    private async giveSomething(
        run: Run,
        cultivator: Cultivator,
        to: string | undefined,
        thing: string | undefined,
        stones: number | undefined
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const scope = this.scopeFor(cultivator);
        // Nobody named means whoever is at hand, which is what `interact`
        // already means by an absent target and what "I put ten stones on the
        // table" actually says.
        const here = this.present(cultivator);
        const party = to === undefined
            ? (here[0] ? { id: here[0].id, name: here[0].name } : null)
            : (() => {
                const found = this.partyPutTo(cultivator, to, scope);
                return found ? { id: found.id, name: found.name } : null;
            })();

        const outcome = handOver(
            {
                giver: cultivator,
                recipient: party,
                namedRecipient: to,
                othersHere: here.map(row => row.name),
                pouch: pouchStacks(this.db, cultivator.id)
                    .map(stack => ({ ...stack, name: nameOfStack({ ...stack, quantity: 1 }) })),
                // Read only so the refusal can be honest about a book they
                // really are carrying. See `handOver`.
                heldArts: copiesHeldBy(this.db, cultivator.id)
                    .map(id => getTechnique(id)?.name ?? id),
                onDay: this.atHand?.currentDay ?? run.elapsedDays
            },
            thing ?? '',
            stones
        );

        if (!outcome.refused) {
            this.db.transaction(() => {
                if (outcome.stones > 0) {
                    this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -outcome.stones });
                    // The recipient is a stored row or a world NPC, and both
                    // have to be able to receive - the same split
                    // `whatALiftTook` makes for the same reason.
                    const stored = this.repos.cultivators.getById(party!.id);
                    if (stored) {
                        this.repos.cultivators.applyDeltas(party!.id, { spiritStones: outcome.stones });
                    } else {
                        const npc = (this.atHand?.npcs ?? []).find(row => row.id === party!.id);
                        if (npc) {
                            npc.spiritStones += outcome.stones;
                            this.worldDirty = true;
                        }
                    }
                }
                if (outcome.lot) {
                    removeFromPouch(this.db, cultivator.id, outcome.lot.itemId, outcome.lot.quantity);
                    if (this.repos.cultivators.getById(party!.id)) {
                        addToPouch(
                            this.db, party!.id, outcome.lot.itemId, outcome.lot.kind, outcome.lot.quantity
                        );
                    }
                }
            })();

            if (outcome.favour) {
                const record = createObligation(outcome.favour);
                writeObligation(this.db as unknown as DatabaseHandle, record);
                outcome.calls.push({
                    name: 'social.createObligation',
                    action: 'give',
                    summary:
                        `${record.id}: ${record.holderId} holds a ${record.severity} `
                        + `${record.kind} about ${record.subjectId} for ${record.cause}. `
                        + 'Permanent until settled, and inheritable.',
                    ok: true
                });
            }
        }

        const free = this.freeAction(run, 'give', outcome.facts);
        free.calls = outcome.calls;
        free.outcome = outcome.refused ? 'refused' : 'executed';
        return free;
    }

    private async sell(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
        // AHEAD OF THE POUCH, BECAUSE A BOOK WAS NEVER IN IT
        const asACopy = await this.sellACopyOfAnArt(run, cultivator, (target ?? '').trim());
        if (asACopy) return asACopy;

        const held = listPouch(this.db, cultivator.id);
        if (held.length === 0) {
            return refused('storage.listPouch', 'sell', factsForRefusal(
                'Nothing on you worth a counter.',
                'You go through the pouch and there is nothing in it anybody would put a price '
                + 'on. Selling requires having something first.',
                `cultivator_pouch is empty for ${cultivator.id}. Nothing quoted, nothing written.`
            ));
        }

        const query = (target ?? '').trim();
        // "my herbs", "everything", "the lot" - the commonest ask, and it is
        // not a name. Anything that reads as a category empties the pouch.
        const wholePouch = query.length < 3 || GameService.SELL_EVERYTHING.test(query);

        const lots = wholePouch
            ? held.map(entry => this.lotFor(entry)).filter((lot): lot is SaleLot & { kind: PouchItemKind } => lot !== null)
            : (() => {
                const named = this.pouchEntryFor(held, query);
                if (!named) return [];
                const lot = this.lotFor(named);
                return lot ? [lot] : [];
            })();

        if (lots.length === 0) {
            const carried = held.map(entry => this.lotFor(entry)?.name ?? entry.itemId).join(', ');
            return refused('engine.resolveHerb', 'sell', factsForRefusal(
                'Not something you are carrying.',
                `You reach for it and it is not there. What is in the pouch: ${carried}.`,
                `Unresolved sale "${query}" against ${held.length} pouch row(s). `
                + 'Nothing quoted, nothing written.'
            ));
        }

        const regionId = standingOf(cultivator).regionId;
        // The same multiplier the buy board is quoted through, so a province
        // where things cost more is a province where things fetch more.
        const local = localPrice(regionId, 100) / 100;
        const quote = quotePouchSale(lots, { ordinal: cultivator.realmOrdinal }, local);

        if (quote.offeredStones <= 0) {
            return refused('engine.quotePouchSale', 'sell', factsForRefusal(
                'Not enough there to count out.',
                quote.lots[0]?.line
                ?? 'Worth something in principle, and not enough of it survives a buyer\'s '
                + 'margin to be worth counting.',
                `quotePouchSale: gross ${quote.grossStones}, offered ${quote.offeredStones}. `
                + 'Nothing removed, nothing paid.'
            ));
        }

        const after = this.db.transaction((): Cultivator => {
            for (const lot of lots) {
                if (!removeFromPouch(this.db, cultivator.id, lot.itemId, lot.quantity)) {
                    throw new GameError(`The pouch was short of ${lot.name} mid-sale.`, 500);
                }
            }
            const updated = this.repos.cultivators.applyDeltas(cultivator.id, {
                spiritStones: quote.offeredStones
            });
            if (!updated) throw new GameError('Cultivator vanished mid-sale.', 500);
            this.repos.runs.incrementTurn(run.id, 1);
            return updated;
        })();

        const facts = factsForToolResult(
            wholePouch ? 'The pouch, sold.' : `${lots[0].name}, sold.`,
            [
                ...quote.lots.map(lot => `${lot.name}: ${lot.line}`),
                `${quote.offeredStones} spirit stone${quote.offeredStones === 1 ? '' : 's'} `
                + `counted out. ${after.spiritStones} in the purse now.`
            ]
        );
        facts.structure.push(
            `quotePouchSale over ${lots.length} lot(s) at the ${regionId} multiplier (x${local}): `
            + `gross ${Math.round(quote.grossStones)}, offered ${quote.offeredStones}. `
            + `Removed from cultivator_pouch: ${lots.map(l => `${l.itemId} x${l.quantity}`).join(', ')}.`
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'engine.quotePouchSale',
                action: 'sell',
                summary:
                    `${lots.length} lot(s) sold for ${quote.offeredStones} spirit stone(s) against `
                    + `a list of ${Math.round(quote.grossStones)}, priced by regard at ordinal `
                    + `${cultivator.realmOrdinal}.`,
                ok: true
            }]
        };
    }

    /**
     * Writing out a copy of an art and selling it.
     */
    private async sellACopyOfAnArt(
        run: Run,
        cultivator: Cultivator,
        query: string
    ): Promise<Execution | null> {
        if (query.length < 3 || GameService.SELL_EVERYTHING.test(query)) return null;
        const art = resolveTechnique(this.repos, query, cultivator.id);
        if (!art) return null;
        // A name that is also in the pouch is the pouch's. The fuzzy matcher
        // works over the whole technique catalog and a herb whose name happens
        // to score above the threshold against some art must not have its sale
        // stolen; the pouch is the more specific reading of the sentence.
        if (this.pouchEntryFor(listPouch(this.db, cultivator.id), query)) return null;

        const row = getTechnique(art.id) as
            { name?: string; cap?: number | null; requiredOrdinal?: number } | undefined;
        const opens = Number(row?.requiredOrdinal ?? 0);
        const carriesTo = row?.cap == null ? opens : Number(row.cap);
        const known = this.repos.techniques.getKnown(cultivator.id, art.id);

        if (!known) {
            return refused('technique.getKnown', 'sell', factsForRefusal(
                `You have never been taught ${art.name}.`,
                'Writing a method out is not copying a shape off a page. It is putting down what '
                + 'you understood of it, in an order somebody else can walk, and you understood '
                + 'none of it. There is nothing in your hand to sell.',
                `No cultivator_techniques row for ${cultivator.id} x ${art.id}. Nothing written, `
                + 'nothing paid, no time passed.'
            ));
        }

        // ── THE ONE GATE, AND IT IS ABILITY RATHER THAN PERMISSION ───────
        if (!couldWriteOutACopy(
            { realmOrdinal: cultivator.realmOrdinal, masteryOfIt: known.mastery }, art.id
        )) {
            const bar = masteryBarFor(art.id);
            return refused('world.couldWriteOutACopy', 'sell', factsForRefusal(
                `You do not hold ${art.name} well enough to write it out.`,
                `You have ${(known.mastery * 100).toFixed(0)} parts in a hundred of it, and what `
                + 'you would put on paper is the parts. Somebody reading it would learn your gaps '
                + 'along with everything else, which is worse than learning nothing. Take it to '
                + 'the end first - nobody writes out a thing they have not finished.',
                `couldWriteOutACopy refused ${art.id}: mastery ${known.mastery.toFixed(2)} against `
                + `${FULLY_MASTERED}${bar === null ? '' : `, or the ordinal bar of ${bar}`}. `
                + 'Nothing written, nothing paid, no time passed.'
            ));
        }

        const list = whatOneCopyIsWorth(art.id);
        if (list === null) {
            return refused('world.whatOneCopyIsWorth', 'sell', factsForRefusal(
                'Nobody around here copies at that height.',
                `There is no going rate for a copy of ${art.name}, because at the rung it opens `
                + 'at there is nobody doing that kind of work for a living and nothing to price '
                + 'the months against.',
                `copyistMonthlyCash returned null at requiredOrdinal ${opens}. Nothing written, `
                + 'nothing paid, no time passed.'
            ));
        }

        // ── WHOSE IT IS, AND HOW BADLY THIS IS TAKEN ─────────────────────
        const membership = this.repos.sects.getMembership(cultivator.id);
        const mine = membership?.sectId ?? cultivator.sectId ?? null;
        const owners = whoseArt(art.id);
        // The holder's own house wins when it is on the list, which is the
        // reading that matters: selling your own house's is the betrayal
        // proper and must not be softened into somebody else's.
        const ownerFactionId = mine && owners.includes(mine) ? mine : owners[0] ?? null;
        const rung = betrayalOfSelling({ factionId: mine }, art.id, ownerFactionId);
        const ownerSect = ownerFactionId ? getSect(ownerFactionId) : null;

        // ── WHAT A COUNTER GIVES, THROUGH THE ONE SALE AUTHORITY ─────────
        const regionId = standingOf(cultivator).regionId;
        const local = localPrice(regionId, 100) / 100;
        const quote = quoteSale({
            item: { requiredOrdinal: opens },
            listStones: list,
            quantity: 1,
            seller: { ordinal: cultivator.realmOrdinal },
            localMultiplier: local
        });
        const paid = Math.max(1, quote.offeredStones);
        const months = monthsToCopy(opens, carriesTo);
        const days = Math.max(1, Math.round(months * (DAYS_PER_YEAR / 12)));

        // AND WHO, STANDING HERE, COULD SAY WHOSE IT WAS
        this.atHand = this.atHand ?? await this.loadWorld();
        const place = this.atHand ? worldLocationFor(this.atHand, cultivator.location) : null;
        const here = this.atHand && place
            ? npcsAt(this.atHand, place.id).filter(npc => npc.id !== cultivator.id)
            : [];
        let houseStage: KnowingStage = 'unaware';
        let sawIt = 0;
        if (ownerFactionId) {
            for (const npc of here) {
                // Their reference for the house that owns it, off the roster
                // and nothing else: one of theirs was taught out of this book,
                // somebody who practises the art has held a copy, and everybody
                // else has never been in the room. `whatTheirReferenceAffords`
                // is the calibration and it is not restated here.
                const reference: KnowingStage =
                    npc.factionId === ownerFactionId ? 'known'
                        : (npc.cultivation.techniqueIds ?? []).includes(art.id)
                            ? 'encountered'
                            : 'unaware';
                const reached = theStageAWitnessReaches(whatTheirReferenceAffords(reference));
                if (reached !== 'unaware') sawIt++;
                houseStage = highestStage(houseStage, reached);
            }
        }

        // ── THE MONTHS, THE STONES, AND THE ROW ──────────────────────────
        const ambient = this.ambientFor(cultivator, run);
        const spent = await this.shortSkip(
            run, cultivator, ambient, TRAVEL_FOCUS, `Copying out ${art.name}`, days
        );
        const after = this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: paid })
            ?? cultivator;
        this.repos.runs.incrementTurn(run.id, 1);

        const facts = factsForToolResult(`A copy of ${art.name}, written out and sold.`, [
            `${months} month${months === 1 ? '' : 's'} at the desk, and ${paid} spirit `
            + `stone${paid === 1 ? '' : 's'} for the finished thing. ${after.spiritStones} in the `
            + 'purse now. What you sold is a copy; you still hold the art.',
            ...(rung === 0
                ? [
                    'Nobody owns it. Enough houses hand it out that no one of them can call it '
                    + 'theirs, and copying it for money is a living rather than a wrong.'
                ]
                : [
                    `It is the ${ownerSect?.name ?? ownerFactionId}'s`
                    + (rung >= 2 ? ', and you are one of theirs.' : ' and you are not one of theirs.')
                    + ' Once it is out it is out, and there is no version of this that they undo.'
                ])
        ]);
        facts.structure.push(
            `${art.id}: mastery ${known.mastery.toFixed(2)}, copied in ${months} month(s) `
            + `(monthsToCopy ${opens} -> ${carriesTo}). quoteSale against a list of ${list} at the `
            + `${regionId} multiplier (x${local}) offered ${quote.offeredStones}; paid ${paid}. `
            + `betrayalOfSelling rung ${rung}`
            + (ownerFactionId ? ` against ${ownerFactionId}.` : ', nobody\'s property.')
        );

        const calls: ToolCallRecord[] = [
            {
                name: 'engine.quoteSale',
                action: 'sell',
                summary:
                    `One copy of ${art.name} for ${paid} spirit stone(s) against a list of `
                    + `${list}, priced by regard at ordinal ${cultivator.realmOrdinal}. `
                    + `${months} month(s) of copying. The art stays where it was: what moved is `
                    + 'a copy.',
                ok: true
            },
            ...spent.calls
        ];

        const answered = ownerFactionId
            ? this.whatTheHouseDidAboutTheLeak({
                run, cultivator, art, rung, ownerFactionId, mine, paid,
                houseStage, witnesses: sawIt, facts
            })
            : [];

        return {
            facts,
            events: spent.events,
            timeSkip: spent.timeSkip,
            breakthrough: null,
            outcome: 'executed',
            calls: [...calls, ...answered]
        };
    }

    /**
     * What the house whose art it was does about it.
     */
    private whatTheHouseDidAboutTheLeak(input: {
        run: Run;
        cultivator: Cultivator;
        art: ResolvedEntity;
        rung: 0 | 1 | 2 | 3;
        ownerFactionId: string;
        mine: string | null;
        paid: number;
        houseStage: KnowingStage;
        witnesses: number;
        facts: EngineFacts;
    }): ToolCallRecord[] {
        const { run, cultivator, art, rung, ownerFactionId, mine, facts } = input;
        const onDay = Math.floor(run.elapsedDays);
        const sellerIsOfTheHouse = mine === ownerFactionId;
        const sect = getSect(ownerFactionId) as
            { name?: string; alignment?: SectAlignment; powerOrdinal?: number } | undefined;
        const houseName = sect?.name ?? ownerFactionId;

        const deed = theLeakAsADeed({
            rung,
            ownerFactionId,
            sellerIsOfTheHouse,
            sellerName: cultivator.name,
            artName: art.name,
            stones: input.paid,
            onDay,
            knownTo: canPointAt(input.houseStage) ? [ownerFactionId] : [],
            witnesses: input.witnesses
        });
        if (deed === null) return [];

        const mySect = mine ? getSect(mine) as { name?: string; alignment?: SectAlignment } | undefined : null;
        const answer = whatTheHouseDoesAboutIt({
            deed,
            offender: {
                id: cultivator.id,
                name: cultivator.name,
                houseId: mine,
                houseName: mySect?.name ?? mine,
                alignment: mySect?.alignment ?? null,
                ranked: mine !== null
            },
            answering: {
                id: ownerFactionId,
                name: houseName,
                houseId: ownerFactionId,
                houseName,
                alignment: sect?.alignment ?? null,
                ranked: true
            },
            // A house is never deterred by the house standing in front of it
            // when that house is ITSELF - there is nothing between it and you,
            // which is why a complaint is worse than a beating. Anybody else's
            // house is a body it would have to deal with first.
            backing: mine !== null && mine !== ownerFactionId ? 'backed' : 'none',
            stages: new Map([[ownerFactionId, input.houseStage]]),
            theirOrdinal: Number(sect?.powerOrdinal ?? 0),
            yourOrdinal: cultivator.realmOrdinal,
            // DERIVED, AND IT IS WHAT DECIDES WHICH OF THE TWO LANDS
            worth: {
                holdsSomethingWanted: mine !== ownerFactionId,
                wouldBeMissed: mine !== null
            },
            onDay
        });

        facts.lines.push(answer.line);
        facts.prose = `${facts.prose}\n\n${answer.line}`;
        facts.structure.push(
            `whatTheHouseDoesAboutIt: knowing stage ${input.houseStage} `
            + `(canPointAt ${canPointAt(input.houseStage)}), acting ${answer.acting}, `
            + `bother ${answer.bother}, weight ${answer.weight}, takes ${answer.takes}.`
        );

        const calls: ToolCallRecord[] = [{
            name: 'social.whatTheHouseDoesAboutIt',
            action: 'sell',
            summary: answer.line,
            ok: true
        }];

        // Nobody worked it out. No name, no account, and the resolver has
        // already said so in the line above - so nothing is written, which is
        // the point of `Deed.knownTo` rather than a shortfall in it.
        if (answer.knownTo.length === 0) return calls;

        const held = createObligation({
            kind: 'grudge',
            id: `grudge_${ownerFactionId}_${cultivator.id}_leaked_${art.id}`,
            holderId: ownerFactionId,
            subjectId: cultivator.id,
            cause: deed.cause,
            severity: answer.weight,
            onDay,
            description: `${deed.description} ${answer.line}`,
            participants: [ownerFactionId],
            tags: [
                'leaked_an_art',
                `art:${art.id}`,
                `rung:${rung}`,
                `takes:${answer.takes.replace(/\s+/g, '_')}`,
                ...(sellerIsOfTheHouse ? ['their_own_house'] : [])
            ]
        });
        writeObligation(this.db as unknown as DatabaseHandle, held);
        calls.push({
            name: 'social.createObligation',
            action: 'sell',
            summary:
                `${houseName} now holds a ${held.severity} grudge about ${cultivator.name} for `
                + `${held.cause}, open from day ${onDay}. It is what the house has whatever else `
                + 'it can or cannot reach, and it does not settle on its own.',
            ok: true
        });

        if (answer.cripples) {
            this.repos.cultivators.addInjury(cultivator.id, {
                severity: answer.cripples.severity,
                source: 'combat',
                description: answer.cripples.line,
                sustainedOnTurn: run.turn,
                woundType: answer.cripples.woundKey
            });
            calls.push({
                name: 'cultivator.addInjury',
                action: 'sell',
                summary:
                    `${answer.cripples.woundKey}, ${answer.cripples.severity}. The exact capability `
                    + 'that was misused, taken off them, and it does not come back on its own.',
                ok: true
            });
        }

        if (answer.indenture) {
            writeObligation(
                this.db as unknown as DatabaseHandle,
                createObligation(answer.indenture.oath)
            );
            calls.push({
                name: 'social.createObligation',
                action: 'sell',
                summary:
                    `A term of service, held by ${houseName}. `
                    + `${answer.indenture.termYears === null
                        ? 'No day is written into it.'
                        : `${answer.indenture.termYears} years, due on day ${answer.indenture.dueOnDay}.`}`
                    + `${answer.indenture.witnessFactionId === null
                        ? ' The premier oathwright would not witness it.'
                        : ' Witnessed, with a penalty clause.'}`,
                ok: true
            });
        }

        return calls;
    }

    /**
     * What is in the pouch.
     */
    private async inventory(
        run: Run,
        cultivator: Cultivator,
        rawInput = ''
    ): Promise<Execution> {
        const listed = await handleInventory({
            action: 'inventory',
            cultivatorId: cultivator.id
        });
        if (isGuidingErrorBody(listed)) {
            return this.fromToolResult('alchemy_manage.inventory', 'inventory', listed, 'The pouch');
        }

        const body = listed as {
            spiritStones?: number;
            pills?: { name?: string; quantity?: number; value?: number }[];
            herbs?: { name?: string; quantity?: number; value?: number }[];
            totalValue?: number;
            toxicity?: { accumulated?: number; tolerance?: number };
        };
        const pills = body.pills ?? [];
        const herbs = body.herbs ?? [];
        const stones = body.spiritStones ?? 0;

        // AND WHAT IS BEING CARRIED THAT IS NOT MEDICINE
        const carried = listCarriedArtifacts(this.db, cultivator.id)
            .map(entry => ({ entry, record: getArtifact(entry.itemId) }))
            .filter((row): row is { entry: typeof row.entry; record: NonNullable<typeof row.record> } =>
                row.record !== undefined);

        // AND WHAT IS IN THE YARD
        const yard = countedConveyancesHeld(this.whatIsInTheirYard(cultivator));

        // AND THE BOOKS, WHICH ARE THE COMMONEST THING A PLAYER BUYS
        const books = copiesHeldBy(this.db, cultivator.id)
            .map(id => getTechnique(id))
            .filter((art): art is NonNullable<typeof art> => art !== undefined);

        // AND WHAT IS NOT ON YOU AT ALL
        const asked = whichHavingWasAskedAbout(rawInput.toLowerCase().trim());
        const elsewhere = asked === 'on the body'
            ? []
            : whatThisRunHasPutAside(this.legacy.leftByRun(run.id));

        const lines: string[] = [];
        if (pills.length === 0 && herbs.length === 0 && carried.length === 0
            && books.length === 0 && yard.length === 0) {
            // "Nothing at all" would be a lie with a cache in the ground, and
            // it is exactly the lie this read was ruled against: technically
            // true, and it sends the player away.
            lines.push(
                `Nothing in the pouch${elsewhere.length > 0 ? '' : ' at all'}. What is on you is `
                + `what you are standing in and ${stones} spirit stone${stones === 1 ? '' : 's'}.`
            );
        } else {
            if (books.length > 0) {
                lines.push('Books: ' + books.map(b => {
                    const road = classOf(b) === 'cultivation';
                    const cap = road ? (b.cap !== undefined ? b.cap : capOf(b)) : null;
                    return `${b.name}${cap === null
                        ? ''
                        : `, which carries as far as ${rankName(cap)}`}`;
                }).join('; ') + '. Holding a copy and having sat down with it are separate facts.');
            }
            if (yard.length > 0) {
                lines.push('In the yard: ' + yard.map(row => {
                    // The catalog names carry their own article - "A drawn
                    // carriage" - so a count in front of one reads "1 a drawn
                    // carriage" unless it is taken off first.
                    const what = row.conveyance.name.replace(/^an?\s+/i, '').toLowerCase();
                    return `${row.count} ${what}${row.count === 1 ? '' : 's'}, which `
                        + `${row.count === 1 ? 'carries' : 'carry'} ${row.conveyance.heads} `
                        + `and ${row.count === 1 ? 'reaches' : 'reach'} across a `
                        + `${row.conveyance.range}`;
                }).join(', ') + '. Say where you are going and that you are riding.');
            }
            if (carried.length > 0) {
                lines.push('Carrying: ' + carried.map(c =>
                    `${c.record.name}${c.record.power !== null && c.record.power !== undefined
                        ? ` (rated ${c.record.power}, ${rankName(c.record.power)})`
                        : ''}`
                ).join(', ') + '.');
            }
            if (pills.length > 0) {
                lines.push('Pills: ' + pills.map(p => `${p.quantity ?? 1} x ${p.name ?? 'unnamed'}`).join(', ') + '.');
            }
            if (herbs.length > 0) {
                lines.push('Herbs: ' + herbs.map(h => `${h.quantity ?? 1} x ${h.name ?? 'unnamed'}`).join(', ') + '.');
            }
            if (typeof body.totalValue === 'number' && body.totalValue > 0) {
                lines.push(
                    `About ${Math.round(body.totalValue)} spirit stones of list value in there, `
                    + 'and a buyer pays less than list.'
                );
            }
            lines.push(`${stones} spirit stone${stones === 1 ? '' : 's'} in the purse.`);
        }

        // Marked and separated, and after the purse, so that nothing here can
        // be mistaken for something spendable standing where you are.
        if (elsewhere.length > 0) {
            lines.push(
                'Not on you, and not reachable from where you are standing: '
                + elsewhere.map(row => row.line).join('; ')
                + '. Getting any of it back is its own journey.'
            );
        }

        const tox = body.toxicity;
        if (tox && typeof tox.accumulated === 'number' && tox.accumulated > 0) {
            lines.push(
                `Pill toxicity stands at ${tox.accumulated.toFixed(2)} against a tolerance of `
                + `${tox.tolerance ?? '?'}. It does not clear on its own.`
            );
        }

        const facts = factsForToolResult(
            pills.length + herbs.length + carried.length + books.length === 0
                ? (elsewhere.length > 0 ? 'An empty pouch, and what is not on you.' : 'An empty pouch.')
                : (elsewhere.length > 0 ? 'What is on you, and what is not.' : 'What is on you.'),
            lines
        );
        facts.structure.push(
            `alchemy_manage.inventory: ${pills.length} pill row(s), ${herbs.length} herb row(s), `
            + `${stones} stone(s).`,
            `Held off the pouch entirely: ${carried.length} rated object(s) through `
            + `listCarriedArtifacts, ${books.length} book(s) through copiesHeldBy. A copy of a `
            + 'manual is a knowledge row with a provenance rather than a counted pouch row, so '
            + 'the alchemy reader cannot see one however long it looks.',
            asked === 'on the body'
                ? 'Asked about the body, so the legacy ledger was not read. "what do I have" '
                + 'reaches it; "what am I carrying" is the narrower question and does not.'
                : `legacyLedger.leftByRun: ${elsewhere.length} thing(s) put aside and still `
                + 'standing. Not in the purse, not spendable here, and each one a journey away.'
        );
        for (const row of elsewhere) facts.structure.push(row.structure);
        return this.freeAction(run, 'inventory', facts);
    }

    /**
     * Swallowing a pill.
     */
    private async consumePill(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        rawInput = ''
    ): Promise<Execution> {
        const held = listPouch(this.db, cultivator.id).filter(row => row.kind === 'pill');
        if (held.length === 0) {
            return refused('storage.listPouch', 'consume_pill', factsForRefusal(
                'Nothing in the pouch to take.',
                'You go through the pouch for it and there is no pill in there. Wanting one is not '
                + 'a method for having one.',
                `No pill rows in cultivator_pouch for ${cultivator.id}. Nothing swallowed.`
            ));
        }

        // The override word is not part of the pill's name. "I take the pill
        // anyway" extracted `the pill anyway`, which matched no pouch row and
        // no category, so confirming a wasted pill refused a second time for an
        // entirely different reason.
        const query = withoutTheOverride(target ?? '');
        // A bare "I take a pill" with exactly one in the pouch is not
        // ambiguous, and refusing it to make a player retype the name they can
        // already see in their inventory is the same defect as a board that
        // can be read and not bought from.
        const chosen = query.length >= 3 && !GameService.PILL_IN_GENERAL.test(query)
            ? this.pouchEntryFor(held, query)
            : held.length === 1 ? held[0] : null;

        if (!chosen) {
            const carried = held.map(e => this.lotFor(e)?.name ?? e.itemId).join(', ');
            return refused('engine.resolvePill', 'consume_pill', factsForRefusal(
                query.length >= 3 ? `No pill called ${query} on you.` : 'Which one.',
                `What is in the pouch: ${carried}.`,
                `Unresolved pill "${query || '(nothing named)'}" against ${held.length} pill row(s). `
                + 'Nothing swallowed, nothing spent.'
            ));
        }

        const name = this.lotFor(chosen)?.name ?? chosen.itemId;

        // THE ONE PILL THAT IS NOT A PILL
        const step = theUnearnedStepIn(chosen.itemId);
        if (step) return this.spendTheUnearnedStep(run, cultivator, chosen, step);

        // ASK BEFORE WASTING IT
        const pill = getPill(chosen.itemId);

        // -- AND THE ONE THAT IS NOT A WASTE BUT AN ENDING ----------------
        if (pill?.effect === 'end_the_soul' && !GameService.TAKE_IT_ANYWAY.test(rawInput)) {
            return refused('engine.thisOneEndsYou', 'consume_pill', factsForRefusal(
                `${name} is not medicine.`,
                'It puts the soul out, and then the body. There is no version of this you walk '
                + 'away from and nothing anybody can do about it afterwards - not a physician, '
                + 'not a house, not a pill. What it buys is that whoever takes your body finds '
                + 'nothing in it.',
                'Say it again with "anyway" and it goes down.'
            ));
        }

        const wasted =
            (pill?.effect === 'restore_qi' && cultivator.qi >= cultivator.maxQi)
                ? { what: 'qi', at: cultivator.qi, of: cultivator.maxQi }
                : (pill?.effect === 'heal_hp' && cultivator.hp >= cultivator.maxHp)
                    ? { what: 'HP', at: cultivator.hp, of: cultivator.maxHp }
                    : null;

        if (wasted && !GameService.TAKE_IT_ANYWAY.test(rawInput)) {
            return refused('engine.pillWouldBeWasted', 'consume_pill', factsForRefusal(
                `${name} would do nothing.`,
                `Your ${wasted.what} is already ${wasted.at} of ${wasted.of}. `
                + `${name} restores ${wasted.what} and there is none to restore, so it would be `
                + 'gone for nothing and the toxicity would stay. Say it again with "anyway" and '
                + 'it goes down.',
                `${chosen.itemId} is ${pill?.effect} and ${wasted.what} is at maximum. `
                + 'Nothing swallowed, nothing spent.'
            ));
        }

        const result = await handleConsumePill({
            action: 'consume_pill',
            pillId: chosen.itemId,
            cultivatorId: cultivator.id
        });
        return this.fromToolResult('alchemy_manage.consume_pill', 'consume_pill', result, name);
    }

    /**
     * Spend an Unearned Step: the one crossing that is given rather than made.
     */
    private spendTheUnearnedStep(
        run: Run,
        cultivator: Cultivator,
        row: { itemId: string },
        step: { id: string; name: string; grade: ImmortalGrade }
    ): Execution {
        const alreadyTaken = readFlag(this.db, cultivator.id, FLAG_STEP_TAKEN) === '1';
        const verdict = takeTheUnearnedStep({
            fromOrdinal: cultivator.realmOrdinal,
            grade: step.grade,
            alreadyTaken
        });

        // Aiming it is not spending it. Everything else is.
        const consumed = verdict.taken || verdict.refusal !== 'not_at_a_boundary';

        if (!verdict.taken) {
            if (consumed) removeFromPouch(this.db, cultivator.id, row.itemId, 1);
            return refused('engine.takeTheUnearnedStep', 'consume_pill', factsForRefusal(
                `${step.name}: nothing moved.`,
                `${verdict.line}${consumed
                    ? ' It is gone either way. There is no version of this object that can be put '
                      + 'back in the box.'
                    : ' It is still in the pouch: you did not take it, you only considered where '
                      + 'you were standing.'}`,
                `takeTheUnearnedStep refused: ${verdict.refusal}. `
                + `${step.grade} grade at ordinal ${cultivator.realmOrdinal}; ceiling `
                + `${STEP_CEILING_BY_GRADE[step.grade]}; nothing above `
                + `${NOTHING_IS_GIVEN_AT_OR_ABOVE} is given to anybody by anything. `
                + `Pouch row ${consumed ? 'consumed' : 'left'}.`
            ));
        }

        const before = cultivator;
        const after = this.db.transaction((): Cultivator => {
            removeFromPouch(this.db, cultivator.id, row.itemId, 1);
            writeFlag(this.db, cultivator.id, FLAG_STEP_TAKEN, '1');
            // THE NEUTRAL DOOR, and it is the point. `advanceRealm` re-derives
            // the pools and carries the share across and does nothing else - no
            // roll, no wound, no toll, no body cost - because none of those
            // belong to a crossing nobody made.
            let updated = this.repos.cultivators.advanceRealm(cultivator.id, 1) ?? cultivator;
            if (verdict.foundationQuality) {
                persistFoundation(this.repos, cultivator.id, verdict.foundationQuality);
                updated = this.repos.cultivators.getById(cultivator.id) ?? updated;
            }
            this.repos.runs.incrementTurn(run.id, 1);
            return updated;
        })();

        const facts = factsForToolResult(
            `${rankName(before.realmOrdinal)} to ${rankName(after.realmOrdinal)}, given.`,
            [
                verdict.line,
                `The body it has to be carried in is larger than it was: ${before.maxHp} before, `
                + `${after.maxHp} now, and ${after.hp} of that is what you are standing in. `
                + 'Nothing was taken out of you getting here, because you did not get here.',
                'Everybody who has watched you for a decade can do the arithmetic, and the '
                + 'conclusion arrives in about a week.'
            ]
        );
        // The one thing a player cannot play without: they have spent the only
        // one they will ever be given.
        (facts.required ??= []).push(
            'That was the only crossing anybody will ever be handed you. A second one of these '
            + 'does nothing to a body that has taken one, whatever grade it is and whoever gives '
            + 'it to you.'
        );
        facts.structure.push(
            `takeTheUnearnedStep: ordinal ${verdict.fromOrdinal} -> ${verdict.toOrdinal} through `
            + '`advanceRealm`, which re-derives the pools and carries the share across. NOT '
            + 'through `attemptBreakthrough`: no roll, no failure table, no tribulation, no toll '
            + `and no bodyCost, because none of those code paths is entered. Foundation left: `
            + `${verdict.foundationQuality ?? 'unchanged - it was taken from Perfection, so '
                + 'nothing was skipped'}.`,
            'What the Price of Advancement does about a boundary crossed without accumulation is '
            + 'deliberately unanswered - see the note on the `promote_realm` row in '
            + '`immortal-items.ts`, which states that content settled the social half and not the '
            + 'arithmetic. This charges no toll because it never reaches one, which is the honest '
            + 'state of it rather than a ruling.'
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'engine.takeTheUnearnedStep',
                action: 'consume_pill',
                summary:
                    `${step.name} (${step.grade}) spent: ${rankName(verdict.fromOrdinal)} to `
                    + `${rankName(verdict.toOrdinal)}. One per life, and the flag is now set.`,
                ok: true
            }]
        };
    }

    /** The word that turns the wasted-pill refusal into a deliberate act. */
    private static readonly TAKE_IT_ANYWAY = /\b(?:anyway|anyhow|regardless|even so|i don'?t care)\b/i;

    /** "a pill", "one", "the medicine" - a category, not a name. */
    private static readonly PILL_IN_GENERAL =
        /^(?:a |one |the |my |some )?\s*(?:pill|pills|elixir|elixirs|medicine|medicines|tablet|pellet|one|it)\s*$/i;

    /**
     * How a manual could go further, by every route there is.
     */
    private async acquisition(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
        const held = cultivator.knownTechniques
            .map(id => getTechnique(id))
            .filter((t): t is NonNullable<typeof t> => !!t && classOf(t) === 'cultivation');

        if (held.length === 0) {
            return refused('engine.assessAcquisition', 'acquisition', factsForRefusal(
                'There is no book to carry further.',
                'Every one of these routes is about a method you already practise. Without one '
                + 'the question is not how to go further, it is how to begin.',
                `No cultivation-class manual known by ${cultivator.id}. Nothing assessed.`
            ));
        }

        const wanted = (target ?? '').trim();
        const named = wanted.length >= 3
            ? held.find(t => matchScore(wanted, t.name) > MATCH_THRESHOLD)
            : undefined;
        // Otherwise the one that has actually stopped carrying them, which is
        // the occasion for asking at all.
        const stalled = held
            .map(art => ({ art, reach: this.reachOf(cultivator, art) }))
            .filter(row => row.reach.cap !== null && cultivator.realmOrdinal >= row.reach.cap)
            .sort((a, b) => (b.reach.cap ?? 0) - (a.reach.cap ?? 0))[0];
        const manual = named ?? stalled?.art ?? held[0];

        const reach = this.reachOf(cultivator, manual);
        const dao = daoOf(cultivator.insights ?? []);
        const seeker = seekerFor(cultivator);

        const lines: string[] = [reach.line];

        // The world's ceiling against this holder's, when they differ. A good
        // sentence to have available and one no single number can say.
        if (reach.worldWrittenTo !== null && reach.cap !== null && reach.worldWrittenTo > reach.cap) {
            lines.push(
                `It has been written as far as ${rankName(reach.worldWrittenTo)} by somebody. `
                + `It goes further than you can follow it, and the difference is `
                + `${reach.worldWrittenTo - reach.cap} rung`
                + `${reach.worldWrittenTo - reach.cap === 1 ? '' : 's'} of somebody else's work.`
            );
        }

        const routes: { route: AcquisitionRoute; how: string }[] = [
            { route: 'found', how: 'Finding the rest of it' },
            { route: 'taught', how: 'Being taught it' },
            { route: 'derived', how: 'Writing what comes next yourself' }
        ];

        const calls: ToolCallRecord[] = [];
        const assessed = routes.map(({ route, how }) => ({
            how,
            route,
            report: assessAcquisition({
                manual: {
                    id: manual.id,
                    name: manual.name,
                    requiredOrdinal: manual.requiredOrdinal,
                    cap: manual.cap ?? capOf(manual),
                    volumes: manual.volumes ?? null,
                    grade: manual.grade,
                    element: manual.element ?? null,
                    subject: primaryRoadOf(manual),
                    category: manual.category,
                    domain: manual.domain ?? null,
                    domainDegree: manual.domainDegree,
                    opening: manual.opening ?? null,
                    derivable: manual.derivable
                } as never,
                seeker,
                route,
                realmOrdinal: cultivator.realmOrdinal,
                heldVolumeIds: wholeWorkVolumes(manual),
                dao
            })
        }));

        // SAY EACH SENTENCE ONCE
        const shared = assessed[0].report.lines
            .filter(line => assessed.every(({ report }) => report.lines.includes(line)));
        for (const line of shared) if (!lines.includes(line)) lines.push(line);

        for (const { how, report } of assessed) {
            const own = report.lines.filter(line => !shared.includes(line));
            lines.push(
                `${how}: ${report.usable ? 'open.' : 'not open.'}`
                + (own.length > 0 ? ` ${own[0]}` : '')
            );
            for (const line of own.slice(1)) lines.push(`  ${line}`);
        }

        for (const { route, report } of assessed) {
            calls.push({
                name: 'encounters.assessAcquisition',
                action: 'acquisition',
                summary:
                    `${route}: usable=${report.usable}, `
                    + `techniqueCap=${report.techniqueCap ?? 'uncapped'}, `
                    + `raisesTheCeiling=${report.raisesTheCeiling}`
                    + (report.refusals.length
                        ? `, refused on ${report.refusals.join(', ')}`
                        : ''),
                ok: report.usable
            });
        }

        const facts = factsForToolResult(`${manual.name}, and how it could go further.`, lines);
        facts.structure.push(
            `acquisition on ${manual.id}: cap ${reach.cap ?? 'uncapped'}, `
            + `writtenTo ${reach.writtenTo ?? 'uncapped'}, `
            + `stagesHeld ${reach.stagesHeld}, volumes ${reach.volumesHeld}/${reach.volumesTotal}.`
        );
        const execution = this.freeAction(run, 'acquisition', facts);
        execution.calls = calls;
        return execution;
    }

    // THE THREE QUESTIONS A STUCK PLAYER ASKS

    /**
     * The arts that could be learned, filtered by everything that decides it.
     */
    private async listTechniques(
        run: Run,
        cultivator: Cultivator,
        target?: string
    ): Promise<Execution> {
        // ASKING ABOUT ONE BOOK, WHICH IS NOT ASKING FOR IT
        const asked = (target ?? '').trim();
        if (asked.length >= 3 && !GameService.BOOK_IN_GENERAL.test(asked)) {
            const named = this.whatItWouldTake(run, cultivator, asked);
            if (named) return named;
        }

        const listed = await handleListAvailable({
            action: 'list_available',
            cultivatorId: cultivator.id,
            includeConflicting: true,
            includeForbidden: false
        });
        if (isGuidingErrorBody(listed)) {
            return this.fromToolResult(
                'technique_manage.list_available', 'list_techniques', listed, 'The arts'
            );
        }

        type Listed = {
            name?: string;
            grade?: string;
            element?: string | null;
            known?: boolean;
            class?: string;
            carriesToOrdinal?: number | null;
            carriesToRank?: string | null;
        };
        const body = listed as {
            compatible?: Listed[];
            conflicting?: Listed[];
            counts?: { gatedByRealm?: number; unavailableInThisRun?: number };
            note?: string;
        };

        // WHERE IT STOPS, SAID BEFORE THE DECADE IS SPENT.
        const carries = (row: Listed): string =>
            row.class !== 'cultivation'
                ? ' It carries nobody anywhere; it is an art, not a road.'
                : row.carriesToRank
                    ? ` It carries a cultivator as far as ${row.carriesToRank} and no further.`
                    : ' It carries a cultivator the whole way.';
        const compatible = (body.compatible ?? []).filter(row => row.known !== true);
        const conflicting = body.conflicting ?? [];

        const lines: string[] = [];

        // WHAT YOU ARE ALREADY PRACTISING, WHICH IS THE QUESTION
        const held = cultivator.knownTechniques
            .map(id => getTechnique(id))
            .filter((art): art is NonNullable<typeof art> => art !== undefined);
        if (held.length > 0) {
            lines.push(
                held.length === 1
                    ? 'What you are practising:'
                    : `What you are practising, ${held.length} of them:`
            );
            for (const art of held) {
                // The same two calls `technique_manage` prices its own listing
                // with, rather than a second reading of the catalog: what a
                // book carries you to must not depend on which surface asked.
                const road = classOf(art) === 'cultivation';
                const cap = road ? (art.cap !== undefined ? art.cap : capOf(art)) : null;
                lines.push(
                    `  ${art.name}${art.element ? `, an art of ${art.element}` : ''}`
                    + `${art.grade ? ` (${art.grade} grade)` : ''}.`
                    + (!road
                        ? ' It carries nobody anywhere; it is an art, not a road.'
                        : cap === null
                            ? ' It carries a cultivator the whole way.'
                            : cap <= cultivator.realmOrdinal
                                // The fact a player most needs and is least
                                // likely to find out any other way: at or past
                                // the cap, progress is zero rather than slow.
                                ? ` It stops at ${rankName(cap)}, which is where you stand. `
                                  + 'Sitting with it accumulates nothing from here, and no amount '
                                  + 'of years changes that - what does is another book, or '
                                  + 'somebody willing to teach you.'
                                : ` It carries a cultivator as far as ${rankName(cap)} and no further.`)
                );
            }
        } else {
            lines.push(
                'No method is being practised. Sitting in a quiet room and breathing is not '
                + 'cultivation: without a road for the qi to take, nothing accumulates.'
            );
        }

        if (compatible.length === 0 && conflicting.length === 0) {
            lines.push(
                'Nothing you could be taught. Every method within reach of this root either wants '
                + 'a rank you have not reached or has surfaced nowhere in this life.'
            );
        } else {
            if (compatible.length > 0) {
                lines.push('What a root like yours could take up:');
                for (const row of compatible.slice(0, TECHNIQUES_SHOWN)) {
                    lines.push(
                        `  ${row.name ?? 'unnamed'}`
                        + `${row.element ? `, an art of ${row.element}` : ''}`
                        + `${row.grade ? ` (${row.grade} grade)` : ''}.`
                        + carries(row)
                    );
                }
                if (compatible.length > TECHNIQUES_SHOWN) {
                    lines.push(`  and ${compatible.length - TECHNIQUES_SHOWN} more besides.`);
                }
            }
            if (conflicting.length > 0) {
                lines.push(
                    'And these, which fight the root rather than run with it. They can be learned. '
                    + 'Learning one can tear the meridians on the spot:'
                );
                for (const row of conflicting.slice(0, TECHNIQUES_SHOWN)) {
                    lines.push(
                        `  ${row.name ?? 'unnamed'}${row.element ? `, of ${row.element}` : ''}.`
                        + carries(row)
                    );
                }
            }
        }
        const gated = body.counts?.gatedByRealm ?? 0;
        if (gated > 0) {
            lines.push(`${gated} more exist and want a rank above yours.`);
        }
        if (typeof body.note === 'string' && body.note.length > 0) lines.push(body.note);

        const facts = factsForToolResult(
            held.length > 0
                ? `${held.length} art${held.length === 1 ? '' : 's'} held, and what else is within reach.`
                : compatible.length === 0 && conflicting.length === 0
                    ? 'Nothing within reach.'
                    : `${compatible.length + conflicting.length} art(s) you could be taught.`,
            lines
        );
        facts.structure.push(
            `Held: ${held.length > 0 ? held.map(a => a.id).join(', ') : 'none'}. These are `
            + 'filtered out of the learnable list below by `known !== true`, which is why the '
            + 'listing has to open with them rather than leaving them to it.',
            `technique_manage.list_available: ${compatible.length} compatible, `
            + `${conflicting.length} conflicting, ${gated} gated by realm, `
            + `${body.counts?.unavailableInThisRun ?? 0} absent from this run by seed.`
        );
        return this.freeAction(run, 'list_techniques', facts);
    }

    /**
     * Learning an art, which is not practising one.
     */
    private async learnTechnique(
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
        const query = (target ?? '').trim();
        const technique = query.length >= 2 ? resolveTechnique(this.repos, query, cultivator.id) : null;
        if (!technique) {
            return refused('engine.resolveTechnique', 'learn_technique', factsForRefusal(
                query.length >= 2 ? `No art called ${query}.` : 'No art named.',
                'You turn the name over and it is not a method anybody was ever taught. Asking for '
                + 'what there is to learn is a different question, and it has an answer.',
                `Unresolved technique "${query || '(nothing named)'}". Asking what there is to `
                + 'learn is a different read and it has an answer.'
            ));
        }

        // A COPY THEY TOOK IS A COPY THEY HAVE
        this.atHand = this.atHand ?? await this.loadWorld();
        const took = aTakenCopyOf(this.atHand, cultivator.id, technique.id);

        const result = await handleLearn({
            action: 'learn',
            techniqueId: technique.id,
            cultivatorId: cultivator.id,
            ...(took ? { provenance: 'taken' as const } : {})
        });
        const execution = this.fromToolResult(
            'technique_manage.learn', 'learn_technique', result, technique.name
        );

        // WHETHER IT IS FOR THEM, IN THE SAME BREATH
        const catalog = getTechnique(technique.id);
        // AND A SUITABILITY LINE MUST NOT ARGUE WITH A REFUSAL
        const suitedButRefused = (fit: ReturnType<typeof fitOf>): boolean =>
            fit.fit === 'suited' && execution.outcome === 'refused';
        if (catalog && !suitedButRefused(fitOf(cultivator, catalog))) {
            const fit = fitOf(cultivator, catalog);
            execution.facts.lines.push(fit.line);
            // Into the prose as well as the lines. `factsForToolResult` builds
            // `prose` once from the lines it was given, so a line pushed
            // afterwards reaches the narrator's licence and never reaches a
            // player running without a model.
            execution.facts.prose = `${execution.facts.prose}

${fit.line}`;
            execution.facts.structure.push(
                `It reads as ${fit.fit} for this body at `
                + `${rungAndOrdinal(fit.gradeOrdinal)}, judged on `
                + `${fit.axes.length} axis${fit.axes.length === 1 ? '' : 'es'}: `
                + fit.axes.map(a => `${a.axis} ${a.verdict}`).join(', ') + '.'
            );
            execution.calls.push({
                name: 'encounters.assessFit',
                action: 'learn_technique',
                summary: `${technique.name}: ${fit.fit}. ${fit.line}`,
                ok: fit.fit === 'suited' || fit.fit === 'partly'
            });
        }
        return execution;
    }

    /**
     * The house's roll, its portfolios, and who sits at the top of it.
     */
    private async theHouseAround(cultivator: Cultivator, held: HousePosition): Promise<{
        roster: ContactPerson[];
        portfolios: APortfolio[];
        headId: string | null;
    }> {
        const world = this.atHand ?? await this.loadWorld();
        this.atHand = world;
        const roster = rosterFor(
            { repos: this.repos, knowledge: this.knowledge, world }, cultivator
        );
        const roll = [
            { id: cultivator.id, rankIndex: held.rankIndex },
            ...roster.map(person => ({ id: person.id, rankIndex: person.rankIndex ?? 0 }))
        ];
        const portfolios = portfoliosIn({
            locations: world?.locations ?? [],
            sectId: held.sectId,
            roll,
            rankCount: held.rankCount
        });
        const top = Math.max(0, held.rankCount - 1);
        const headId = roll.find(person => person.rankIndex >= top)?.id ?? null;
        return { roster, portfolios, headId };
    }

    /**
     * Somebody was standing there when the false decree was given.
     */
    private async somebodyWatchedThatDecree(
        run: Run,
        cultivator: Cultivator,
        body: object,
        execution: Execution
    ): Promise<void> {
        const held = positionIn(this.repos, cultivator.id);
        if (!held) return;

        const sentTo = (body as { sentRank?: { index?: number } }).sentRank?.index ?? 0;
        const { roster, portfolios, headId } = await this.theHouseAround(cultivator, held);
        const witness = whoSawIt(roster, sentTo, cultivator.id);
        if (!witness) {
            execution.facts.structure.push(
                `false-decree-reports.whoSawIt: nobody named on rung ${sentTo} at `
                + `${held.sectId}. The hands are real and the catalog does not name them, so `
                + 'there is no witness anybody could be reported by.'
            );
            return;
        }

        const report = reportWhatTheySaw({
            repos: this.repos,
            offenderId: cultivator.id,
            offenderName: cultivator.name,
            offenderOrdinal: cultivator.realmOrdinal,
            houseId: held.sectId,
            houseName: held.sectName,
            alignment: getSect(held.sectId)?.alignment ?? null,
            portfolios,
            headId,
            witness,
            onDay: Math.floor(run.elapsedDays),
            what: `${cultivator.name} gave an order in ${held.sectName}'s name and holds none of `
                + 'its authority.'
        });

        const nameOf = (id: string | null): string =>
            id === null
                ? 'nobody'
                : roster.find(person => person.id === id)?.name ?? 'somebody senior';

        const line = report.what.does === 'reports'
            ? `${witness.name} does not argue with you. They walk up the hill and tell `
              + `${nameOf(report.toId)}, who holds the room that hears this kind of thing.`
            : report.what.does === 'swallows_it'
                ? `${witness.name} looks at you for a moment longer than is comfortable and lets `
                  + 'it go. They owe you, and both of you know the number.'
                : report.what.does === 'says_nothing_and_remembers'
                    ? `${witness.name} says nothing, and does not forget. That is not the same as `
                      + 'nothing having happened.'
                    : `${witness.name} saw it and there is nobody in this house to tell.`;

        execution.facts.lines.push(line);
        execution.facts.prose = `${execution.facts.prose}\n\n${line}`;
        execution.facts.required = [...(execution.facts.required ?? []), line];

        if (report.record && report.what.does === 'reports') {
            const answer = THE_HOUSE_ANSWERS[report.doing](held.sectName);
            execution.facts.lines.push(answer);
            execution.facts.prose = `${execution.facts.prose}\n\n${answer}`;
        }

        execution.facts.structure.push(
            `reporting-what-you-saw: ${report.what.line} `
            + `does=${report.what.does}, to=${report.toId ?? 'nobody'}, `
            + `house does=${report.doing}, row=${report.record?.id ?? 'none'}.`
        );
        execution.calls.push({
            name: 'false-decree-reports.reportWhatTheySaw',
            action: 'sect',
            summary: `${witness.name} ${report.what.does}. ${report.what.line}`,
            ok: report.what.does !== 'reports'
        });
    }

    /**
     * What has been brought to you about the house's own people.
     */
    private async complaintsBrought(
        run: Run,
        cultivator: Cultivator,
        verdictOn: string | undefined,
        verdict: 'upheld' | 'dismissed' | null
    ): Promise<Execution> {
        const held = positionIn(this.repos, cultivator.id);
        if (!held) {
            return this.freeAction(run, 'sect', factsForRefusal(
                'Nobody brings you anything.',
                'Complaints go to whoever holds the room that hears them, and you are on '
                + 'nobody\'s roll.',
                `No membership for ${cultivator.id}.`
            ));
        }

        const { roster, portfolios } = await this.theHouseAround(cultivator, held);
        const mine = whatTheyHold(portfolios, cultivator.id);
        if (!mine.includes(THE_ROOM_COMPLAINTS_GO_TO)) {
            const holder = whoAnswersAbout(portfolios, THE_ROOM_COMPLAINTS_GO_TO);
            return this.freeAction(run, 'sect', factsForRefusal(
                'That is not your room.',
                holder === null
                    ? `${held.sectName} has nobody holding the room complaints go to, so they go `
                      + 'to the head of the house or nowhere.'
                    : `${roster.find(p => p.id === holder)?.name ?? 'Somebody else'} holds it. `
                      + 'What you would need is the room, not the rank - they are different '
                      + 'things and only one of them is given to you.',
                `${cultivator.id} holds [${mine.join(', ') || 'nothing'}]; `
                + `${THE_ROOM_COMPLAINTS_GO_TO} is ${holder ?? 'unheld'}.`
            ));
        }

        const open = complaintsBroughtTo(this.repos, held.sectId);
        const nameOf = (id: string | null): string =>
            id === cultivator.id
                ? cultivator.name
                : roster.find(person => person.id === id)?.name ?? 'somebody on the roll';

        // ── DECIDING ONE ─────────────────────────────────────────────────
        if (verdict !== null && (verdictOn ?? '').trim().length > 0) {
            const wanted = (verdictOn ?? '').trim();
            // NOBODY DECIDES THEIR OWN CASE
            const theirs = open.filter(row => row.subjectId !== cultivator.id);
            const chosen = theirs.find(row =>
                matchScore(wanted, nameOf(row.subjectId)) > MATCH_THRESHOLD)
                ?? (theirs.length === 1 ? theirs[0] : undefined);
            if (!chosen && open.some(row => row.subjectId === cultivator.id
                && matchScore(wanted, cultivator.name) > MATCH_THRESHOLD)) {
                return refused('false-decree-reports.settleAComplaint', 'sect', factsForRefusal(
                    'That one is about you.',
                    'Holding the room does not mean deciding your own case. It goes over your '
                    + 'head, and somebody else says what happens - which is the whole reason '
                    + 'the room is worth holding when the name on the complaint is not yours.',
                    `${cultivator.id} is the subject of that row and also holds `
                    + `${THE_ROOM_COMPLAINTS_GO_TO}. Refused at the deciding end, the same way `
                    + '`whereAComplaintGoes` refuses at the routing end.'
                ));
            }
            if (!chosen) {
                return refused('false-decree-reports.settleAComplaint', 'sect', factsForRefusal(
                    `Nothing open about ${wanted}.`,
                    open.length === 0
                        ? 'Nothing has been brought to you.'
                        : `What has: ${open.map(row => nameOf(row.subjectId)).join(', ')}.`,
                    `Unresolved subject "${wanted}" against ${open.length} open row(s).`
                ));
            }
            const settled = settleAComplaint(this.repos, chosen, {
                verdict,
                byId: cultivator.id,
                onDay: Math.floor(run.elapsedDays),
                note: `Decided by ${cultivator.name}, who holds the room.`
            });
            const line = verdict === 'upheld'
                ? `You uphold it. ${nameOf(chosen.subjectId)} is answerable to `
                  + `${held.sectName} for it, and the record says who decided that.`
                : `You throw it out. ${nameOf(chosen.subjectId)} walks, the row closes as `
                  + 'proven false, and your name is on that too.';
            const facts = factsForToolResult(
                verdict === 'upheld' ? 'Upheld.' : 'Dismissed.', [line]
            );
            facts.required = [line];
            facts.structure.push(
                `false-decree-reports.settleAComplaint: ${settled.id} -> `
                + `${settled.settlement?.resolution}, by ${cultivator.id}. `
                + 'This is the office being exercised rather than held.'
            );
            return this.freeAction(run, 'sect', facts);
        }

        // ── READING THE PILE ─────────────────────────────────────────────
        const lines = open.length === 0
            ? [`Nothing is outstanding. ${held.sectName} has nobody's name in front of you, `
               + 'which is either a quiet season or a house nobody is watching.']
            : [
                `${held.sectName} has these open against its own, and they are yours to decide:`,
                ...open.slice(0, DUTIES_SHOWN).map(row =>
                    `  ${nameOf(row.subjectId)} - ${row.severity}. ${row.description}`
                    + (row.subjectId === cultivator.id
                        // Shown, because a player must be able to see what the
                        // house is holding about them. Not decidable, because
                        // holding the room is not a way of closing your own row.
                        ? ' (this one is about you, and is not yours to decide)'
                        : ''))
            ];
        const facts = factsForToolResult(
            open.length === 0 ? 'Nothing brought.' : `${open.length} in front of you.`, lines
        );
        facts.structure.push(
            `false-decree-reports.complaintsBroughtTo: ${open.length} open AGAINST_THEIR_OWN `
            + `row(s) held by ${held.sectId}. Read only. Holder of the room: ${cultivator.id}.`
        );
        return this.freeAction(run, 'sect', facts);
    }

    /**
     * Which rooms of the house this person speaks for.
     */
    private async whatIRunHere(run: Run, cultivator: Cultivator): Promise<Execution> {
        const held = positionIn(this.repos, cultivator.id);
        if (!held) {
            return this.freeAction(run, 'sect', factsForRefusal(
                'You run nothing, because you are of nothing.',
                'Rooms belong to houses and you are on nobody\'s roll. There is no door here '
                + 'with your name on it and nobody would recognise the claim if you made one.',
                `No membership for ${cultivator.id}; no portfolio to read.`
            ));
        }

        const world = this.atHand ?? await this.loadWorld();
        this.atHand = world;
        const roll = rosterFor(
            { repos: this.repos, knowledge: this.knowledge, world }, cultivator
        ).map(person => ({ id: person.id, rankIndex: person.rankIndex ?? 0 }));
        const portfolios = portfoliosIn({
            locations: world?.locations ?? [],
            sectId: held.sectId,
            roll: [{ id: cultivator.id, rankIndex: held.rankIndex }, ...roll],
            rankCount: held.rankCount
        });
        const mine = whatTheyHold(portfolios, cultivator.id);

        const lines = mine.length === 0
            ? [
                `You hold ${held.rankTitle} of ${held.sectName} and you run none of it. A rung `
                + 'is what you are addressed as; a room is what you answer for, and those are '
                + 'different things.',
                'Anything you tell somebody to do, you tell them yourself. Saying it is the '
                + 'house speaking would be a claim people in the room can check.'
            ]
            : [
                `${held.sectName} answers to you about ${mine.join(', ')}.`,
                'An order about any of that can be given in the house\'s name and will stand. '
                + 'Anything else is you asking.'
            ];
        const others = portfolios.filter(p => p.holderId !== null && p.holderId !== cultivator.id);
        if (others.length > 0) {
            lines.push(`Held by others: ${others.map(p => p.purpose).join(', ')}.`);
        }

        const facts = factsForToolResult(
            mine.length === 0 ? 'You run nothing here.' : `You run ${mine.length} of it.`,
            lines
        );
        facts.structure.push(
            `authority-for-an-order.portfoliosIn: ${portfolios.length} sealed room(s) at `
            + `${held.sectId}, ${mine.length} held by ${cultivator.id}. Read only. `
            + 'Portfolios only - `Sect.office` is the Protector\'s chair and is not read here.'
        );
        return this.freeAction(run, 'sect', facts);
    }

    /**
     * Taking a thing your own house owns.
     */
    private async takeFromTheHouse(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
        const held = positionIn(this.repos, cultivator.id);
        if (!held) {
            return this.freeAction(run, 'sect', factsForRefusal(
                'You are on nobody\'s roll.',
                'Taking from your own house is a thing you can only do to a house that is '
                + 'yours. What you are describing is robbing strangers, and walking into a '
                + 'compound you do not belong to is a different sentence with a worse answer.',
                `No membership for ${cultivator.id}. This verb is the member-facing one; `
                + 'nothing outside a house routes here.'
            ));
        }

        // Held in a local as well as on the field: `atHand` is nullable and the
        // narrowing does not survive the calls below, and a world this method
        // has already loaded is not a world it should re-check for null four
        // times.
        const world = this.atHand ?? await this.loadWorld();
        this.atHand = world;
        const holdings = whatThisHouseHolds(world, held.sectId);
        const wanted = (target ?? '').trim();

        // ── A READ WHEN NOTHING WAS NAMED ────────────────────────────────
        //
        // The same split every committing verb in this file uses. Standing in
        // front of a shelf and saying you would like to take something is not
        // the sentence that takes it, and a player who has not been told what
        // is on the shelf cannot name a line off it.
        if (wanted.length < 3) {
            const takeable = holdings.filter(h => h.takeable);
            const lines = takeable.length === 0
                ? [`${held.sectName} is holding nothing you could put a hand on. What a house `
                   + 'keeps in quantity is not a thing you take one of.']
                : [`${held.sectName} holds these, and each of them is one object with a name on `
                   + 'it:',
                    ...takeable.slice(0, DUTIES_SHOWN).map(h => `  ${h.object.name}.`)];
            const facts = factsForToolResult(
                takeable.length === 0
                    ? 'Nothing here is a thing.'
                    : `${takeable.length} thing${takeable.length === 1 ? '' : 's'} with a name on it.`,
                lines
            );
            facts.structure.push(
                `house-property-theft.whatThisHouseHolds: ${holdings.length} row(s) at `
                + `${held.sectId}, ${takeable.length} tracked. Read only; nothing moved.`
            );
            return this.freeAction(run, 'sect', facts);
        }

        const holding = whichHoldingTheyMeant(holdings, wanted);
        if (!holding) {
            const going = holdings.filter(h => h.takeable).map(h => h.object.name).join(', ');
            return refused('house-property-theft.whichHoldingTheyMeant', 'sect', factsForRefusal(
                `${held.sectName} is not holding anything called ${wanted}.`,
                going.length > 0
                    ? `What it does hold, with a name on each: ${going}.`
                    : 'It holds nothing that is one object rather than a quantity of something.',
                `Unresolved holding "${wanted.slice(0, 60)}" against ${holdings.length} row(s) `
                + `possessed by ${held.sectId}. Nothing moved.`
            ));
        }

        // ── THE COUNTED TIER IS SOMEBODY ELSE'S VERB ─────────────────────
        //
        // `keptAs` is the single answer to which tier a row is in, so this
        // refusal is the boundary with `siphon` rather than a second opinion
        // about it - and it names the verb that does work, which is what a
        // refusal owes.
        if (!holding.takeable) {
            // The refusal has to name the TRUE reason, and for a shelf of common
            // primers that reason is not "go and siphon it". A house holds several
            // copies of an ordinary manual and none of a deep one, so what is being
            // refused here is that there is no single row to move - not that the
            // player should reach for the other crime. Pointing at `siphon` for a
            // book would be a sentence that reads like help and sends somebody to a
            // verb that takes stones.
            return refused('house-property-theft.keptAs', 'sect', factsForRefusal(
                `${holding.object.name} is not a thing you take one of.`,
                'The house keeps that in copies rather than as one object with a history behind '
                + 'it. There is nothing to slip out under a sleeve and nothing anybody would '
                + 'miss: what is on the shelf is a quantity, and a quantity is not stolen so '
                + 'much as drawn on.',
                `${holding.object.id} is significance=${holding.object.significance}, which `
                + '`keptAs` puts in the counted tier. Nothing here decrements a count - the '
                + 'counted tier has no identity to move and no provenance to write.'
            ));
        }

        // ── WHO IS STANDING HERE, WHICH IS THE ONLY NOTICE THERE IS ──────
        //
        // Not a roll and not a clock. Detection is ruled to be what happens
        // when somebody next reads the shelf, and nothing here forecloses
        // that: what this asks is the narrower question of whether one of the
        // house's own people watched it happen.
        const watching = othersPresent(this.repos, cultivator, world)
            .find(person => person.sectId === held.sectId && person.alive) ?? null;

        const taken = takeFromYourOwnHouse({
            takerId: cultivator.id,
            takerName: cultivator.name,
            houseId: held.sectId,
            houseName: held.sectName,
            alignment: getSect(held.sectId)?.alignment ?? null,
            holding,
            onDay: Math.floor(run.elapsedDays),
            seenBy: watching ? { id: watching.id, name: watching.name } : null
        });

        // THE ROW MOVES. Everything below this line is reporting; if this write
        // did not happen, the narration would be the original defect again.
        const at = world ? world.objects.findIndex(o => o.id === taken.object.id) : -1;
        if (world && at >= 0) world.objects[at] = taken.object;
        this.worldDirty = true;

        if (taken.record) {
            writeObligation(
                this.repos.db as unknown as DatabaseHandle,
                createObligation(taken.record)
            );
        }

        const lines = [
            taken.seenBy
                ? `You take ${holding.object.name}. ${taken.seenBy.name} is standing there and `
                  + 'says nothing at all, which is worse than being shouted at.'
                : `You take ${holding.object.name}. Nobody is in the room, and nothing happens `
                  + 'that you can see.',
            `It is ${held.sectName}'s and it stays ${held.sectName}'s: what you are holding is `
            + 'their property, and the record of how it came to you travels with it.'
        ];
        if (taken.doing !== 'nothing') {
            lines.push(THE_HOUSE_ANSWERS[taken.doing](held.sectName));
        } else if (!taken.seenBy) {
            lines.push(
                'The shelf will be read by somebody eventually, and what they find is a gap '
                + 'where this was.'
            );
        }

        const facts = factsForToolResult(
            taken.seenBy ? 'Taken, and seen.' : 'Taken.', lines
        );
        facts.required = [lines[0], lines[1]];
        facts.structure.push(
            `possessions.transferPossession: ${taken.object.id} possessor `
            + `${held.sectId} -> ${cultivator.id}, how=stolen, transfersOwnership=false so `
            + `owner stays ${taken.object.ownerId}. Provenance now `
            + `${taken.object.provenance.length} link(s).`
        );
        facts.structure.push(
            taken.record
                ? `what-a-house-does-when-it-catches-you: seen by ${taken.seenBy?.id}, `
                  + `doing=${taken.doing}, severity=${taken.severity}; obligation written with `
                  + `${held.sectId} as holder and ${cultivator.id} as subject.`
                : 'Nobody of the house was present. No record opened - which is a fact about '
                  + 'notice and not about whether the taking happened.'
        );

        const execution = this.freeAction(run, 'sect', facts);
        execution.calls.push({
            name: 'possessions.transferPossession',
            action: 'sect',
            summary: `${taken.object.name} moved to ${cultivator.name}, ownership unmoved.`,
            ok: true
        });
        return execution;
    }

    /**
     * Being asked by your own house, and saying no.
     */
    private async refuseWhatTheHouseAsked(
        run: Run,
        cultivator: Cultivator,
        pricingOnly: boolean
    ): Promise<Execution> {
        const today = Math.floor(run.elapsedDays);
        const pending = readPendingSummons(this.repos, cultivator.id);

        // NOBODY ASKED
        if (!pending) {
            const held = positionIn(this.repos, cultivator.id);
            return this.freeAction(run, 'sect', factsForRefusal(
                'Nothing is being asked of you.',
                held
                    ? `Nothing is outstanding. ${held.sectName} has not sent for you, and a `
                      + 'refusal is an answer to somebody who asked - you cannot get out in '
                      + 'front of it.'
                    : 'You belong to nothing. Nobody sends for somebody they have no claim on, '
                      + 'which is the other half of what a house is: being findable is the cost '
                      + 'and being worth sending for is the benefit.',
                `No ${'summons'} flag for ${cultivator.id}`
                + `${held ? ` at ${held.sectId}` : '; no membership'}. `
                + 'Read only, nothing written, no turn spent.'
            ));
        }

        const price = priceOfRefusing(this.repos, cultivator, pending, run.elapsedDays);
        if (!price) {
            // The membership went while the ask was standing. `readPendingSummons`
            // clears the flag in that case, so this is unreachable in ordinary
            // play and is here because a null is a null.
            clearPendingSummons(this.repos, cultivator.id);
            return this.freeAction(run, 'sect', factsForRefusal(
                'There is no house to answer.',
                'Whoever sent for you is not somebody you belong to any more.',
                'priceOfRefusing returned null: membership gone under a standing summons.'
            ));
        }

        const duty = pending.duty;
        const overdue = summonsIsOverdue(pending, today);
        const whoAsked = duty.spokenBy ? duty.spokenBy.name : duty.factionName ?? 'the house';

        // ── WHAT IT WOULD COST, WITHOUT SPENDING IT ──────────────────────
        if (pricingOnly) {
            const lines = [
                `${whoAsked} asked, and it is still standing: ${pending.what}`,
                `${duty.days} days, ${duty.contribution} contribution and ${duty.stones} spirit `
                + `stone${duty.stones === 1 ? '' : 's'} on completion`
                + (duty.cohort > 0 ? `, with ${duty.cohort} of the house alongside` : '')
                + `. Due by day ${duty.dueOnDay}`
                + (overdue ? `, which has gone.` : '.'),
                `Saying no costs ${price.spends} standing and would leave you at `
                + `${Math.round(price.wouldLandAt)} with ${price.position.sectName}. `
                + `The house writes it down as ${duty.refusal.severity}.`
            ];
            if (price.wouldBeDismissed) {
                lines.push(
                    'That is past the point a house keeps somebody. Refuse this and you are '
                    + `out of ${price.position.sectName}, and what you have earned there does `
                    + 'not travel.'
                );
            } else if (!price.safe) {
                lines.push(
                    'That is past the point where the house does what you ask of it. You would '
                    + 'still be a member, and you would start finding things take longer than '
                    + 'they take other people.'
                );
            }

            const facts = factsForToolResult(`Refusing costs ${price.spends} standing.`, lines);
            facts.structure.push(
                `leadership.affordable: act=refuse severity=${duty.refusal.severity} `
                + `raw=${price.cost.standingCost} shielded=${price.spends} `
                + `from=${Math.round(price.credit.standing)} to=${Math.round(price.wouldLandAt)} `
                + `level=${price.wouldTrigger} dismissed=${price.wouldBeDismissed}. `
                + 'Priced only: no flag cleared, no standing spent, no obligation written.'
            );
            return this.freeAction(run, 'sect', facts);
        }

        // SAYING IT
        const outcome = resolveAct(
            {
                standing: price.credit.standing,
                elders: [],
                houseSize: price.credit.houseSize,
                ownFollowing: price.credit.ownFollowing,
                hasPatron: false,
                isHead: price.position.head
            },
            price.cost
        );
        spendStanding(
            this.repos, cultivator.id, price.position, price.credit,
            price.cost.standingCost, run.elapsedDays
        );

        // `'lapsed'` where the day it had to be answered by has already gone,
        // and `'refused'` where they are answering in time. The ledger keeps the
        // difference because it is a real one - one of them is a decision and
        // the other is what happens to somebody who made none - and this is the
        // first caller either has ever had.
        const walked = refuseDuty({
            repos: this.repos,
            cultivator,
            duty,
            onDay: today,
            entryId: pending.entryId,
            what: pending.what,
            outcome: overdue ? 'lapsed' : 'refused'
        });
        clearPendingSummons(this.repos, cultivator.id);

        // THE DISMISSAL HAPPENS BEFORE IT IS SAID
        const forfeited = price.position.contribution;
        if (outcome.dismissedFromTheHouse) {
            this.repos.sects.removeMember(price.position.sectId, cultivator.id);
        }

        const lines = [
            overdue
                ? `The day it had to be answered by has gone. ${walked.line}`
                : `You tell ${whoAsked} no. ${walked.line}`,
            `${price.spends} standing spent with ${price.position.sectName}; you stand at `
            + `${Math.round(outcome.standingAfter)} with them now.`
        ];
        if (outcome.dismissedFromTheHouse) {
            lines.push(
                `${price.position.sectName} does not keep a ${price.position.rankTitle} nobody `
                + 'below will work for. You are off the roll'
                // "the 0 contribution stays with the house" is a sentence about
                // nothing. Somebody thrown out on their first month has no
                // ledger to forfeit, and saying so as though they did makes the
                // loss sound larger than it was.
                + (forfeited > 0
                    ? `, and the ${forfeited} contribution stays with the house.`
                    : ', and there was nothing on the ledger to lose.')
            );
        } else if (outcome.ownFollowingLost > 0) {
            lines.push(
                `${outcome.ownFollowingLost} of the people who came in under your name have `
                + 'gone elsewhere.'
            );
        } else if (outcome.obstructionChance > 0) {
            lines.push(
                'Nothing is said. Things simply take longer than they take other people, and '
                + 'they will go on doing so until this is a while ago.'
            );
        }

        const facts = factsForToolResult(
            overdue ? 'It lapsed.' : 'You refused.', lines
        );
        // REQUIRED, WITHOUT BEING SAID TWICE
        facts.required = [
            lines[0],
            ...(outcome.dismissedFromTheHouse ? [lines[lines.length - 1]] : [])
        ];
        facts.structure.push(
            `leadership.resolveAct: act=refuse spent=${outcome.standingSpent} `
            + `${Math.round(outcome.standingBefore)} -> ${Math.round(outcome.standingAfter)}, `
            + `level=${outcome.level}, obstruction=${outcome.obstructionChance.toFixed(2)}, `
            + `ownFollowingLost=${outcome.ownFollowingLost}, `
            + `dismissed=${outcome.dismissedFromTheHouse}.`
        );
        facts.structure.push(
            `encounters.refuseDuty: obligation ${walked.obligation.id} written as `
            + `${overdue ? 'lapsed' : 'refused'}, cause ${duty.refusal.cause}, severity `
            + `${duty.refusal.severity}, held by ${duty.factionId} against ${cultivator.id}. `
            + 'The summons flag is cleared.'
        );

        const execution = this.freeAction(run, 'sect', facts);
        execution.calls.push({
            name: 'encounters.refuseDuty',
            action: 'sect',
            summary: `${pending.entryId} ${overdue ? 'lapsed' : 'refused'}. ${walked.line}`,
            ok: false
        });
        return execution;
    }

    /**
     * The mission board, and taking a line off it.
     */
    private async duty(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const deps = { repos: this.repos, knowledge: this.knowledge, world: this.atHand };
        const board = sectBoardFor(deps, cultivator);
        const wanted = (target ?? '').trim();

        // WHAT THE BOARD CALLS IT
        const describe = (offer: DutyCandidate): string =>
            `${offer.entry.name} - ${tierNameFor(offer.terms.regard.band).toLowerCase()} at `
            + `${rankName(offer.terms.pitchOrdinal)}: ${humanDays(offer.terms.days)}, `
            + `${offer.terms.contribution} contribution and ${offer.terms.stones} spirit stone`
            + `${offer.terms.stones === 1 ? '' : 's'} on completion`
            + (offer.terms.cohort > 0 ? `, with ${offer.terms.cohort} of the house alongside` : '')
            + '.';

        // A SENTENCE THAT POINTS AT THE ONE LINE IS NOT A REQUEST TO READ
        const pointedAtTheOnlyOne =
            wanted.length > 0
            && board.offers.length === 1
            && GameService.THE_ONE_ON_THE_BOARD.test(wanted);

        // ── the wall, read ──
        if (!pointedAtTheOnlyOne
            && (wanted.length < 3 || GameService.BOARD_IN_GENERAL.test(wanted))) {
            const lines: string[] = [];
            if (board.offers.length === 0) {
                lines.push(board.membership
                    ? 'Nothing on the wall is being put to somebody at this rank. That is not the '
                      + 'same as an empty wall, and everyone who walks past it knows the difference.'
                    : 'You belong to nothing, so there is no wall. Commission work goes to people '
                      + 'somebody can send for.');
            } else {
                lines.push(board.membership
                    ? 'What the house is asking for, and what it pays:'
                    : 'What is being contracted out, and what it pays. None of it touches anybody\'s '
                      + 'ledger, because you are on nobody\'s:');
                for (const offer of board.offers.slice(0, DUTIES_SHOWN)) {
                    lines.push(`  ${describe(offer)}`);
                }
            }
            for (const refused of board.refusals.slice(0, DUTIES_SHOWN)) {
                lines.push(`  ${refused.name}: not put to you. ${refused.reason}`);
            }

            const facts = factsForToolResult(
                board.offers.length === 0 ? 'Nothing going for you.' :
                    `${board.offers.length} thing${board.offers.length === 1 ? '' : 's'} going.`,
                lines
            );
            facts.structure.push(
                `encounters.sectBoardFor: ${board.offers.length} offer(s), `
                + `${board.refusals.length} withheld, membership=`
                + `${board.membership ? `${board.membership.factionId}@${board.membership.rankIndex}` : 'none'}.`
            );
            return this.freeAction(run, 'sect', facts);
        }

        // a line, taken
        const chosen = board.offers.length === 1 && GameService.THE_ONE_ON_THE_BOARD.test(wanted)
            ? board.offers[0]
            : board.offers.find(offer => matchScore(wanted, offer.entry.name) > MATCH_THRESHOLD)
                ?? board.offers.find(offer => sharesADistinctivePhrase(wanted, offer.entry.name));
        if (!chosen) {
            const going = board.offers.map(offer => offer.entry.name).join(', ');
            return refused('encounters.sectBoardFor', 'sect', factsForRefusal(
                `Nothing on the wall called ${wanted}.`,
                going.length > 0
                    ? `You read it twice and it is not there. What is: ${going}.`
                    : 'You read it twice. There is nothing on it for somebody standing where you '
                      + 'are standing, whatever you came in wanting.',
                `Unresolved duty "${wanted}" against ${board.offers.length} offer(s) at ordinal `
                + `${cultivator.realmOrdinal}. Nothing accepted, nothing written.`
            ));
        }

        const startDay = Math.floor(run.elapsedDays);
        const duty = dutyFromOffer(chosen, board.membership, startDay);
        const what = `${chosen.entry.name}, off the board at ${placeName(cultivator)}.`;
        const ledger: DutyLedgerInput = {
            repos: this.repos,
            cultivator,
            duty,
            onDay: startDay,
            entryId: chosen.entry.id,
            what
        };

        // The oath is written BEFORE the span. That ordering is the whole
        // reason accepting is a decision rather than free money: a run that
        // ends in the middle leaves a standing obligation somebody can read in
        // forty years, and `refuseDuty` is what settles it the other way.
        acceptDuty(ledger);

        const execution = await this.shortSkip(
            run, cultivator, ambient, DUTY_FOCUS, `Sect duty: ${chosen.entry.name}`,
            duty.days, 'labour'
        );

        const after = this.repos.cultivators.getById(cultivator.id)!;
        const doneOn = Math.floor(this.repos.runs.getById(run.id)!.elapsedDays);
        const settlement: DutyLedgerInput = { ...ledger, cultivator: after, onDay: doneOn };

        // Paid for finishing it, never for taking it on. Somebody who did not
        // come back is not owed, and the house records that rather than
        // forgetting it - which is the same answer the wage already gives.
        if (after.alive) {
            const settled = completeDuty(settlement);
            // BEING PAID IS NOT AN INCIDENTAL DETAIL OF THE STRETCH
            sayThisWhateverTheNarratorDoes(execution.facts, settled.line);
            execution.facts.structure.push(
                `encounters.completeDuty: obligation ${settled.obligation.id} fulfilled; `
                + `contribution +${settled.contribution}, stones +${settled.stones}.`
            );
            execution.calls.push({
                name: 'encounters.completeDuty',
                action: 'sect',
                summary:
                    `${chosen.entry.name} completed. ${settled.contribution} contribution credited `
                    + `and ${settled.stones} spirit stone(s) paid, both off the duty's own terms.`,
                ok: true
            });

            // AND IT BECOMES SOMETHING PEOPLE REPEAT
            const band = chosen.terms.regard.band;
            const said = this.atHand
                ? aDeedEntersTheWorld(this.atHand, {
                    kind: 'opportunity',
                    weight: isImpossibleTier(band) ? 'grave'
                        : band === 'stretch' ? 'serious' : 'slight',
                    day: Math.floor(this.atHand.currentDay),
                    locationId: this.worldPlaceOf(cultivator),
                    place: placeName(cultivator),
                    actors: [{ id: cultivator.id, name: cultivator.name, role: 'finished it' }],
                    factionIds: board.membership ? [board.membership.factionId] : [],
                    summary:
                        `${cultivator.name} took ${chosen.entry.name} off the board at `
                        + `${placeName(cultivator)} - ${tierNameFor(band).toLowerCase()} at `
                        + `${rankName(chosen.terms.pitchOrdinal)} - and finished it in `
                        + `${humanDays(duty.days)}.`,
                    unattributed:
                        'Something that had been on the wall a while is not on the wall any '
                        + 'more, and whoever took it down is not saying much about it.',
                    data: {
                        duty: chosen.entry.id,
                        tier: band,
                        pitchOrdinal: chosen.terms.pitchOrdinal,
                        days: duty.days
                    }
                })
                : null;
            if (said) {
                this.worldDirty = true;
                execution.facts.structure.push(
                    `world.aDeedEntersTheWorld: ${said.fact.id} (opportunity, ${said.weight}, `
                    + `magnitude ${said.fact.magnitude.toFixed(2)}, ${said.fact.visibility}) at `
                    + `the ${band} tier, written where circulating, retell and the digest read it.`
                );
                execution.calls.push({
                    name: 'world.aDeedEntersTheWorld',
                    action: 'sect',
                    summary:
                        `${said.fact.id} written on day ${said.fact.day}. `
                        + `${said.fact.witnessIds.length} witness id(s). What a player does off `
                        + 'the board is now a thing the world contains.',
                    ok: true
                });
            }
        } else {
            const walked = refuseDuty({ ...settlement, outcome: 'failed' });
            // The other half of the same fact, and the one that lasts: a duty
            // sworn and not finished leaves a standing obligation somebody can
            // read in forty years.
            sayThisWhateverTheNarratorDoes(execution.facts, walked.line);
            execution.calls.push({
                name: 'encounters.refuseDuty',
                action: 'sect',
                summary: `${chosen.entry.name} not finished. ${walked.line}`,
                ok: false
            });
        }

        execution.facts.lines.unshift(describe(chosen));
        execution.calls.unshift({
            name: 'encounters.acceptDuty',
            action: 'sect',
            summary:
                `${chosen.entry.name} taken on: ${duty.days} day(s), due on day ${duty.dueOnDay}. `
                + 'An oath row, held by the person who swore it.',
            ok: true
        });
        return execution;
    }

    /**
     * "the mission", "it", "that one" - a line, when there is only one line.
     */
    private static readonly THE_ONE_ON_THE_BOARD =
        /^(?:the |that |this |it|one)?\s*(?:mission|missions|commission|job|duty|task|assignment|errand|contract|one|it)?\s*$/i;

    /** "the board", "sect work", "whatever is going" - a wall, not a line. */
    private static readonly BOARD_IN_GENERAL =
        /^(?:the |my |a |any |some )?\s*(?:board|wall|duty|duties|work|sect work|commissions?|assignments?|jobs?|whatever(?:'s| is)? going|anything)\s*$/i;

    /**
     * The two terms the cultivation rate wants and this layer never supplied: what
     * the manual can carry them to, and who is teaching them.
     */
    rateTermsFor(cultivator: Cultivator): {
        techniqueCap: number | null;
        guideOrdinal: number | null;
        techniqueBonus: number;
        sectBonus: number;
    } {
        let cap: number | null = null;
        let anyManual = false;
        for (const id of cultivator.knownTechniques) {
            const art = getTechnique(id);
            if (!art || classOf(art) !== 'cultivation') continue;
            anyManual = true;
            // THE LINE. Never `art.cap` - that is the CATALOG ceiling, and it stops
            // being the manual's real one the moment somebody writes a stage onto
            // it. A derivation does not spawn a book; it extends this one, so the
            // ceiling has to be composed rather than read.
            const reach = effectiveCapOf(
                { id: art.id, name: art.name, cap: art.cap ?? capOf(art), volumes: art.volumes ?? null },
                wholeWorkVolumes(art),
                stagesHeldBy(this.repos, cultivator.id, art.id)
            );
            const theirs = reach.cap;
            // One uncapped manual is enough. A book rated to the top of the
            // ladder ends the question for every other book they own.
            if (theirs === null || theirs === undefined) return {
                techniqueCap: null,
                guideOrdinal: this.guideFor(cultivator),
                ...this.multipliersFor(cultivator)
            };
            cap = cap === null ? theirs : Math.max(cap, theirs);
        }

        return {
            // NO_MANUAL_CEILING when they hold none. Not null - see above.
            techniqueCap: anyManual ? cap : NO_MANUAL_CEILING,
            guideOrdinal: this.guideFor(cultivator),
            ...this.multipliersFor(cultivator)
        };
    }

    /**
     * The two ORDINARY multipliers, which this layer was also not supplying.
     */
    private multipliersFor(cultivator: Cultivator): {
        techniqueBonus: number;
        techniqueQuality: ManualQuality | null;
        techniqueSpan: ManualBand | null;
        sectBonus: number;
    } {
        const root = getSpiritRoot(cultivator.spiritRoot);
        let techniqueBonus = 1;
        // HOW WELL THE BOOK IS WRITTEN, AND HOW MUCH LADDER IT TRIES TO COVER.
        let techniqueQuality: ManualQuality | null = null;
        let techniqueSpan: ManualBand | null = null;

        // The best cultivation manual they actually hold, at the mastery they
        // actually hold it. Nothing is declared per-action here because
        // seclusion declares no art; what a cultivator sits down with is the
        // best road they own.
        for (const id of cultivator.knownTechniques) {
            const catalog = getTechnique(id);
            if (!catalog || classOf(catalog) !== 'cultivation') continue;
            const known = this.repos.techniques.getKnown(cultivator.id, id);
            if (!known) continue;
            const matched =
                catalog.element !== null && root.elements.includes(catalog.element);
            const bonus =
                1 + known.mastery * 0.5 * (matched ? root.matchedTechniqueBonus / 2 : 1);
            if (bonus >= techniqueBonus) {
                techniqueBonus = bonus;
                // Read off the same book the bonus came from, so the three
                // terms always describe one manual rather than a best-of each.
                techniqueQuality = catalog.quality ?? null;
                // A BAND, not a number of rungs. `openingPenalty` needs both
                // ends and the authored opening, because how much ladder a book
                // covers is only half the question - where it starts decides
                // how many realm boundaries the reader is being asked to hold
                // in their head at once.
                techniqueSpan = {
                    requiredOrdinal: catalog.requiredOrdinal ?? 0,
                    cap: catalog.cap ?? capOf(catalog) ?? null,
                    opening: catalog.opening ?? null
                };
            }
        }

        const membership = this.repos.sects.getMembership(cultivator.id);
        return {
            techniqueBonus,
            techniqueQuality,
            techniqueSpan,
            sectBonus: membership
                ? 1 + SECT_BONUS_PER_RANK * (membership.rankIndex + 1)
                : 1
        };
    }

    /**
     * The ground they are sitting on, and everybody else sitting on it.
     */
    /**
     * Who else is drawing on this ground, as a sentence and as numbers.
     */
    /**
     * Who is drawing on a named place, for the destinations read.
     */
    occupancyOf(name: string): { occupants: number | null; supportedDraw: number | null } {
        const record = this.atHand ? worldLocationFor(this.atHand, name) : null;
        if (!record) return { occupants: null, supportedDraw: null };
        return {
            occupants: npcsAt(this.atHand!, record.id).length,
            supportedDraw: carryingCapacityFor(record.environment.spiritualDensity)
        };
    }

    /**
     * Caves, wilds and veins in one province - the ground that is not a town.
     */
    quietGroundIn(regionName: string): LocationRecord[] {
        if (!this.atHand) return [];
        const region = this.atHand.locations.find(
            row => row.kind === 'region' && loosePlaceKey(row.name) === loosePlaceKey(regionName)
        );
        if (!region) return [];
        return this.atHand.locations
            .filter(row =>
                (row.kind === 'wilds' || row.kind === 'cave' || row.kind === 'vein')
                && row.discovered !== false
                && row.parentId === region.id)
            .sort((a, b) => b.qiDensity - a.qiDensity || (a.name < b.name ? -1 : 1));
    }

    /**
     * The gates of the houses that hold ground in one province.
     */
    housesWithGroundIn(regionName: string): LocationRecord[] {
        if (!this.atHand) return [];
        const region = this.atHand.locations.find(
            row => row.kind === 'region' && loosePlaceKey(row.name) === loosePlaceKey(regionName)
        );
        if (!region) return [];
        return this.atHand.locations
            .filter(row => row.kind === 'sect_seat' && row.parentId === region.id)
            .sort((a, b) => (a.name < b.name ? -1 : 1));
    }

    /**
     * Whether this cultivator could set out for a world location.
     */
    canPointAtLocation(cultivator: Cultivator, record: LocationRecord): boolean {
        if (this.knowledge.canPointAt(cultivator.id, 'place', record.id)) return true;
        const wanted = loosePlaceKey(record.name);
        return this.knowledge
            .awareness(cultivator.id, 'place')
            .some(row =>
                (loosePlaceKey(row.name) === wanted || loosePlaceKey(row.id) === wanted)
                && this.knowledge.canPointAt(cultivator.id, 'place', row.id));
    }

    /**
     * The ground around home, as records rather than as a hole in a gate.
     */
    private seedTheGroundAroundHome(cultivator: Cultivator): number {
        if (!this.atHand) return 0;
        const home = requireRegion(standingOf(cultivator).regionId);

        let granted = 0;
        for (const record of this.quietGroundIn(home.name)) {
            if (record.tags.includes(DAO_GROUND_TAG)) continue;
            if (record.tags.includes(FOUND_BY_PROSPECTING_TAG)) continue;
            const wrote = this.knowledge.learnIfNew({
                holderId: cultivator.id,
                kind: 'place',
                id: record.id,
                name: record.name,
                onDay: 0,
                sourceKind: 'told',
                sourceNote:
                    'Ordinary local ground. People here have been cutting across it, '
                    + 'grazing on it or staying off it since before this one could walk.',
                stage: 'placed',
                statement: `${record.name} is out past the edge of ${home.name}'s settled ground.`
            });
            if (wrote) granted++;
        }
        return granted;
    }

    /**
     * What this cultivator's standing entitles them to on their house's ground.
     */
    private groundEntitlement(cultivator: Cultivator): GroundEntitlement | null {
        if (!this.atHand) return null;
        const held = this.repos.sects.getMembership(cultivator.id);
        if (!held) return null;
        const sect = this.repos.sects.getById(held.sectId);
        if (!sect) return null;

        const rooms = roomsHeldBy(this.atHand.locations, held.sectId);
        if (rooms.length === 0) return null;

        // The house's own people, the player included, because a share is a
        // share OF something and everybody standing in the queue counts.
        const others: GroundClaimant[] = npcsInFaction(this.atHand, held.sectId).map(npc => ({
            id: npc.id,
            tags: npc.tags ?? [],
            factionRankIndex: npc.factionRankIndex,
            cultivation: { realmOrdinal: npc.cultivation.realmOrdinal }
        }));
        const me: GroundClaimant = {
            id: cultivator.id,
            tags: [],
            factionRankIndex: held.rankIndex,
            cultivation: { realmOrdinal: cultivator.realmOrdinal }
        };

        return groundEntitlementFor(
            me,
            held.sectId,
            [...others.filter(o => o.id !== cultivator.id), me],
            rooms,
            groundDensityFor(placeName(cultivator)) ?? QI_DENSITY_DEFAULT / QI_DENSITY_MAX,
            sect.ranks.length
        );
    }

    // A MATCH, A REFUSAL, AND A CHILD

    /**
     * The `wants` term, supplied from rows for the first time.
     */
    whatTheyWantOfYou(
        cultivator: Cultivator,
        personId: string
    ): AWantYouCouldReach | null {
        const them = this.theirOpenBusiness(personId);
        if (!them) return null;
        const membership = this.repos.sects.getMembership(cultivator.id);
        return whatTheyWantThatYouCouldReach(them, {
            id: cultivator.id,
            factionId: membership?.sectId ?? cultivator.sectId ?? null,
            ranked: membership !== null,
            spiritStones: cultivator.spiritStones,
            holds: cultivator.knownTechniques
        });
    }

    /**
     * The records an attempt leaves, written down.
     */
    recordWhatTheAskLeft(
        run: Run,
        cultivator: Cultivator,
        party: ResolvedEntity,
        result: AttemptResult,
        action: ActionName = 'request',
        /**
         * Whether anything was actually asked for.
         */
        somethingWasAsked = true,
        /**
         * What the attempt was, when what it was is a WRONG.
         */
        wrong: Wrong | null = null
    ): { calls: ToolCallRecord[]; wroteToTheLedger: boolean } {
        const calls: ToolCallRecord[] = [];
        let wroteToTheLedger = false;
        const landed = result.outcome === 'taken' || result.outcome === 'turned';
        const aWrongThatCameOff = wrong !== null && landed;
        for (const [which, mark] of [
            ['obligation', result.marks.obligation],
            ['counterObligation', result.marks.counterObligation]
        ] as const) {
            if (!mark) continue;
            if (!somethingWasAsked && mark.kind === 'grudge') continue;
            // A favour is owed TO its holder, and the resolver writes one to
            // the ACTOR on any landed non-courtesy ask - correct for a bought
            // official and false for somebody who was robbed. Nobody does you a
            // favour by being unable to stop you.
            if (aWrongThatCameOff && mark.kind === 'favor' && mark.holderId === cultivator.id) {
                calls.push({
                    name: 'social.createObligation',
                    action,
                    summary:
                        `Not written: the resolver offered a ${mark.severity} favour owed to `
                        + `${cultivator.name} by ${party.name}, which is the record a landed ask `
                        + 'leaves. This was not an ask. What it leaves is on the other side of '
                        + 'the ledger.',
                    ok: false
                });
                continue;
            }
            // ONE STANDING RECORD, NOT ONE A DAY
            const record = createObligation(
                mark.kind === 'grudge'
                    ? {
                        ...mark,
                        id: `grudge_${mark.holderId}_${mark.subjectId}_${mark.cause}`
                    }
                    : mark
            );
            writeObligation(this.db as unknown as DatabaseHandle, record);
            wroteToTheLedger = true;
            calls.push({
                name: 'social.createObligation',
                action,
                summary:
                    `${party.name} now holds a ${record.severity} ${record.kind} about `
                    + `${cultivator.name} for the asking`
                    + `${which === 'counterObligation'
                        ? ', pointing the other way: they did it and are keeping what it cost to '
                          + 'ask'
                        : ''}. `
                    + `Written down on day ${Math.floor(run.elapsedDays)} and open until it is `
                    + 'settled.',
                ok: true
            });
        }
        if (result.marks.tie && aWrongThatCameOff) {
            // The whole of the fix, and it is a refusal to write rather than a
            // second record: `tieForTransaction` types the subject's side
            // `patron` and their roles `was_bought`, which is exactly right for
            // a bought official and is a lie about somebody who was leaned on.
            // See the note on `wrong` above for why the sign cannot simply be
            // flipped on the row.
            calls.push({
                name: 'social.recordTie',
                action,
                summary:
                    `No tie written. The resolver offered ${party.name} a `
                    + `${result.marks.tie.theirs.type} tie to ${cultivator.name} at `
                    + `${round2(result.marks.tie.theirs.strength)} - the record this engine keeps `
                    + 'for two people who are getting on, and worth up to 30 points in favour of '
                    + `${cultivator.name} on every later approach. ${party.name} was ${wrong}. `
                    + 'It goes on the ledger instead, on the side facing the other way.',
                ok: false
            });
        } else if (result.marks.tie) {
            recordTheTieAnAttemptLeft(
                this.repos, cultivator.id, party.id, Math.floor(run.elapsedDays),
                result.marks.tie
            );
            calls.push({
                name: 'social.recordTie',
                action,
                summary:
                    `${party.name}'s side of the tie now stands at `
                    + `${round2(result.marks.tie.theirs.strength)} out of 1 and `
                    + `${cultivator.name}'s at ${round2(result.marks.tie.yours.strength)}. The `
                    + 'two are allowed to disagree, and the gap between them is what somebody '
                    + 'works out years later. Read back on every later approach, where it is '
                    + 'worth up to 30 points of the odds.',
                ok: true
            });
        }
        // AND WHAT TURNING UP AGAIN PUTS RIGHT
        if (!somethingWasAsked && (result.outcome === 'taken' || result.outcome === 'turned')) {
            for (const open of openLedgerBetween(this.repos, cultivator.id, party.id)) {
                if (open.kind !== 'grudge') continue;
                if (open.holderId !== party.id || open.subjectId !== cultivator.id) continue;
                if (!open.tags.includes('refused_approach')) continue;
                writeObligation(this.db as unknown as DatabaseHandle, settleObligation(open, {
                    resolution: 'forgiven',
                    onDay: Math.floor(run.elapsedDays),
                    byId: party.id,
                    note:
                        `${cultivator.name} kept turning up wanting nothing, and ${party.name} `
                        + 'stopped holding the asking against them.'
                }));
                calls.push({
                    name: 'social.settleObligation',
                    action,
                    summary:
                        `The ${open.severity} grudge ${party.name} was holding is settled as `
                        + 'forgiven. It was costing 10 points on every later approach, including '
                        + 'on the courtesy that has just settled it, and it had no other route '
                        + 'to being closed.',
                    ok: true
                });
            }
        }

        if (result.marks.reachedTheHouse) {
            calls.push({
                name: 'engine.resolveAttempt',
                action,
                summary:
                    `The refusal did not stay in the room: it reached ${party.name}'s house, and `
                    + `${cultivator.name} is now a name somebody there has heard in a sentence `
                    + 'they did not like.',
                ok: true
            });
        }
        return { calls, wroteToTheLedger };
    }

    /**
     * What agreeing to it actually does, which is the whole difference between a
     * verb and a paragraph.
     */
    async whatTheyAgreedTo(
        run: Run,
        cultivator: Cultivator,
        party: ResolvedEntity,
        kind: RequestKind,
        costing: RequestCosting,
        meeting: { id: string; name: string; factionId: string | null; here: boolean } | null
    ): Promise<{ lines: string[]; calls: ToolCallRecord[] }> {
        const lines: string[] = [];
        const calls: ToolCallRecord[] = [];

        if (kind === 'teaching' && costing.techniqueId) {
            const art = getTechnique(costing.techniqueId);
            // THE SECOND GATE. `manuals.md`: rank says what a house will give
            // you and the manual's own entry requirement says what you can
            // open, and being favoured does not lift it. So somebody agreeing
            // to teach you is not the same event as the art going in, and where
            // it does not go in the reason is `handleLearn`'s own and is stated.
            const taught = await handleLearn({
                action: 'learn',
                techniqueId: costing.techniqueId,
                cultivatorId: cultivator.id,
                provenance: 'taught_by_a_person'
            });
            if (isGuidingErrorBody(taught)) {
                lines.push(`They sit down with you, and it does not go in. ${taught.message}`);
                calls.push({
                    name: 'technique_manage.learn',
                    action: 'request',
                    summary:
                        `${party.name} agreed and `
                        + `${art?.name ?? costing.techniqueId} still did not go in: `
                        + `${taught.message} Two gates, and this is the second one - what a `
                        + 'person will give you and what you can open are different questions, '
                        + 'and being favoured does not lift the book\'s own bar.',
                    ok: false
                });
            } else {
                lines.push(
                    `${party.name} teaches you ${art?.name ?? 'it'}, and it goes in. It is on you `
                    + 'now, for as long as you keep climbing on it.'
                );
                calls.push({
                    name: 'technique_manage.learn',
                    action: 'request',
                    summary:
                        `${art?.name ?? costing.techniqueId} is on `
                        + `${cultivator.name}'s sheet, recorded as having been taught by a `
                        + 'person rather than bought, found or inherited.',
                    ok: true
                });
            }
            return { lines, calls };
        }

        if (kind === 'introduction' && meeting) {
            // The sentence `whoWouldTeach` ends on, answered. A name arrives
            // through the ordinary knowledge gate, at the stance somebody holds
            // for a face they have been walked up to, with its source on it.
            const learned = this.noteEncounter(
                cultivator, run,
                { kind: 'cultivator', id: meeting.id, name: meeting.name },
                'told',
                `Introduced by ${party.name} at ${placeName(cultivator)}.`
            );
            lines.push(
                learned
                    ? `${party.name} walks you over and says your name to ${meeting.name}, and `
                      + `${meeting.name}'s to you. You can ask for them now.`
                    : `${party.name} makes the introduction and you already had the name. What `
                      + 'you have that you did not is that they now know somebody sent you.'
            );
            calls.push({
                name: 'knowledge.learn',
                action: 'request',
                summary:
                    `${cultivator.name} can name ${meeting.name} now, on the strength of being `
                    + `told by ${party.name} in person. `
                    + `${learned ? 'A record they did not have before.' : 'They already had it.'}`,
                ok: true
            });
            return { lines, calls };
        }

        if (kind === 'discipleship') {
            const theirOrdinal = party.party?.realmOrdinal ?? 0;
            writeFlag(this.db, cultivator.id, FLAG_MASTER, `${party.id}:${theirOrdinal}`);
            lines.push(
                theirOrdinal > cultivator.realmOrdinal
                    ? `${party.name} takes you on. What that is worth is not a title: somebody who `
                      + 'has stood further up than you can tell you what you are doing wrong '
                      + 'while you are still doing it, and it shows in the rate from here.'
                    : `${party.name} agrees, and it changes nothing about how fast you climb. `
                      + 'Guidance is the gap between the guide and the guided, and there is none.'
            );
            calls.push({
                name: 'engine.takeAMaster',
                action: 'request',
                summary:
                    `${party.name}, standing at ${rungAndOrdinal(theirOrdinal)}, is recorded as `
                    + `${cultivator.name}'s master. It is read on every cultivation span from `
                    + `here, and is worth `
                    + `${theirOrdinal > cultivator.realmOrdinal
                        ? 'up to half again on the rate'
                        : 'nothing at all, the guide standing no higher than the guided'}.`,
                ok: true
            });
            return { lines, calls };
        }

        return { lines, calls };
    }

    /**
     * Paying into the house's ledger instead of serving it.
     */
    private donate(run: Run, cultivator: Cultivator, amount: number | undefined): Execution {
        const held = this.repos.sects.getMembership(cultivator.id);
        const sect = held ? this.repos.sects.getById(held.sectId) : null;
        if (!held || !sect) {
            return refused('engine.donate', 'sect', factsForRefusal(
                'There is no ledger with your name on it.',
                'Contribution is a record a house keeps of what its own people have done for it. '
                + 'You are on nobody\'s roll, so there is nothing to pay into and nobody who would '
                + 'know what to do with the money.',
                `${cultivator.name} holds no membership; contribution is per-house.`
            ));
        }

        const floor = Math.max(1, this.repos.sects.stipendForRank(sect.id, 0));
        const board = sectBoardFor(
            { repos: this.repos, knowledge: this.knowledge, world: this.atHand },
            cultivator
        );
        const spans = board.offers.map(offer => offer.terms.days).sort((a, b) => a - b);
        const reference = spans.length > 0 ? spans[Math.floor(spans.length / 2)] : DEFAULT_DUTY_DAYS;
        const rate = contributionPerStoneOverDays(reference) * DONATION_DISCOUNT;

        if (amount === undefined) {
            return this.freeAction(run, 'sect', factsForToolResult(
                `${sect.name} takes donations, at a price.`,
                [
                    `Nothing under ${floor} spirit stones is worth writing down - that is what the `
                    + 'house pays its least important member in a month, and a clerk is not going '
                    + 'to open the book for less.',
                    `Above it, ${sect.name} credits about ${rate.toFixed(2)} contribution the `
                    + `stone. The board pays better: the same money earned by serving is worth `
                    + `${(rate / DONATION_DISCOUNT).toFixed(2)} the stone, because contribution is `
                    + 'a record of service and buying it is not serving.',
                    `You are carrying ${cultivator.spiritStones}. Name a sum.`
                ]
            ));
        }

        const offered = Math.max(0, Math.floor(amount));
        if (offered < floor) {
            return refused('engine.donate', 'sect', factsForRefusal(
                'Not worth opening the book for.',
                `${offered} spirit stones is under what ${sect.name} pays its least important `
                + `member in a month. It is not refused out of pride - it is refused because `
                + `somebody would have to write it down. ${floor} is where the ledger starts.`,
                `Donation ${offered} below floor ${floor} (stipend at rank 0). Nothing spent.`
            ));
        }
        if (offered > cultivator.spiritStones) {
            return refused('engine.donate', 'sect', factsForRefusal(
                'You are not carrying it.',
                `${offered} spirit stones is more than the ${cultivator.spiritStones} on you, and `
                + 'a house does not take a promise from somebody at your rank.',
                `Donation ${offered} exceeds purse ${cultivator.spiritStones}. Nothing spent.`
            ));
        }

        const credited = Math.max(1, Math.round(offered * rate));
        const persist = this.db.transaction(() => {
            this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -offered });
            this.repos.sects.addContribution(sect.id, cultivator.id, credited);
            this.repos.runs.incrementTurn(run.id, 1);
        });
        persist();

        const after = this.repos.sects.getMembership(cultivator.id);
        const facts = factsForToolResult(
            `${credited} contribution, bought.`,
            [
                `${offered} spirit stones into ${sect.name}'s coffers, credited as ${credited} `
                + `contribution at ${rate.toFixed(2)} the stone. The ledger now reads `
                + `${after?.contribution ?? credited}.`,
                'It is worth less than the same money earned on the board, and everybody who '
                + 'reads the ledger can see which of the two it was.'
            ]
        );
        facts.structure.push(
            `donate: ${offered} stones -> ${credited} contribution at ${rate} `
            + `(median duty span ${reference} days, discount ${DONATION_DISCOUNT}, floor ${floor}).`
        );

        const execution = this.freeAction(run, 'sect', facts);
        execution.calls = [{
            name: 'engine.donate',
            action: 'sect',
            summary:
                `${offered} stone(s) -> ${credited} contribution. Rate ${rate} the stone, derived `
                + `from contributionPerStoneOverDays(${reference}) x ${DONATION_DISCOUNT}. `
                + `Floor ${floor} = stipend at rank 0.`,
            ok: true
        }];

        // AND WHETHER IT WAS ANYTHING WORTH REMEMBERING
        const purseBefore = cultivator.spiritStones;
        const gift = this.atHand
            ? aDeedEntersTheWorld(this.atHand, {
                kind: 'debt_incurred',
                day: Math.floor(this.atHand.currentDay),
                locationId: this.worldPlaceOf(cultivator),
                place: placeName(cultivator),
                actors: [{ id: cultivator.id, name: cultivator.name, role: 'paid it in' }],
                factionIds: [sect.id],
                summary:
                    `${cultivator.name} paid ${offered} spirit stones into ${sect.name}'s `
                    + `coffers, out of the ${purseBefore} they were carrying.`,
                unattributed:
                    'A house has money it did not have, and nobody at the gate will say who '
                    + 'brought it.',
                price: {
                    deed: {
                        cause: 'gifted_resource',
                        paidBy: 'actor',
                        // Against what they had, which is the whole of the
                        // model being fair in both directions.
                        cost: purseBefore > 0 ? offered / purseBefore : 1,
                        onDay: Math.floor(run.elapsedDays),
                        description:
                            `${offered} spirit stones into ${sect.name}'s coffers, credited as `
                            + `${credited} contribution.`,
                        // A house takes money in front of the people who keep
                        // its books. This is not a secret gift, and the deed
                        // module weighs an unwitnessed kindness higher for a
                        // reason that does not apply to a clerk's ledger.
                        witnesses: 1
                    },
                    actor: {
                        id: cultivator.id,
                        name: cultivator.name,
                        houseId: sect.id,
                        houseName: sect.name,
                        alignment: sect.alignment,
                        ranked: true
                    },
                    subject: {
                        id: sect.id,
                        name: sect.name,
                        houseId: sect.id,
                        houseName: sect.name,
                        alignment: sect.alignment,
                        ranked: true
                    }
                },
                data: { stones: offered, contribution: credited }
            })
            : null;
        if (gift) {
            this.worldDirty = true;
            execution.facts.lines.push(gift.line);
            execution.calls.push({
                name: 'world.aDeedEntersTheWorld',
                action: 'sect',
                summary:
                    `${gift.fact.id} (debt_incurred, ${gift.weight}, magnitude `
                    + `${gift.fact.magnitude.toFixed(2)}, ${gift.fact.visibility}) written to the `
                    + `world's history on day ${gift.fact.day}. Priced by whatADeedLeaves at cost `
                    + `${(purseBefore > 0 ? offered / purseBefore : 1).toFixed(2)} of the purse; `
                    + `it reached ${gift.leaves?.reached}. No obligation row was opened - the `
                    + 'record it would open is returned, not written.',
                ok: true
            });
        }
        return execution;
    }

    /**
     * The ground under them, as far as they can actually make it out.
     */
    private crowdingHere(cultivator: Cultivator): CrowdingRead | null {
        const ground = this.groundFor(cultivator);
        if (!ground) return null;
        const measured = howCrowdedThisGroundIs({
            placeName: placeName(cultivator),
            density: ground.density,
            occupantOrdinals: ground.occupantOrdinals ?? []
        });
        return groundAsPerceivedRead(measured, {
            realmOrdinal: cultivator.realmOrdinal,
            toldBy: this.whoCouldReadTheGroundForYou(cultivator)
        });
    }

    /**
     * Somebody who can read a vein and would read it for you, by name.
     */
    private whoCouldReadTheGroundForYou(cultivator: Cultivator): string | null {
        if (cultivator.realmOrdinal >= READS_A_VEIN) return null;

        const deps = { repos: this.repos, knowledge: this.knowledge, world: this.atHand };
        const roll = rosterFor(deps, cultivator)
            .filter(person => person.id !== cultivator.id)
            .filter(person => person.known && person.role === 'master')
            .filter(person => person.realmOrdinal >= READS_A_VEIN)
            .sort((a, b) => b.realmOrdinal - a.realmOrdinal);
        if (roll.length > 0) return roll[0].name;

        // Nobody on the roll, but a senior of the same house standing right
        // here would answer the question. A rogue matches neither and that is
        // what being unaffiliated costs on this axis.
        const sectId = cultivator.sectId;
        if (!sectId) return null;
        const here = this.present(cultivator)
            .filter(row => row.sectId === sectId && row.realmOrdinal >= READS_A_VEIN)
            .filter(row => this.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id))
            .sort((a, b) => b.realmOrdinal - a.realmOrdinal);
        return here.length > 0 ? here[0].name : null;
    }

    /**
     * Load the world if it is not already loaded, and answer nothing.
     */
    async warmWorld(): Promise<void> {
        this.useOwnDb();
        if (!this.worldEnabled || this.atHand) return;
        this.atHand = await this.loadWorld();
    }

    groundFor(cultivator: Cultivator): GroundConditions | null {
        if (!this.atHand) return null;
        const record = worldLocationFor(this.atHand, cultivator.location);
        if (!record) return null;
        return {
            density: record.environment.spiritualDensity,
            occupantOrdinals: [
                ...npcsAt(this.atHand, record.id).map(npc => npc.cultivation.realmOrdinal),
                cultivator.realmOrdinal
            ]
        };
    }

    /**
     * The strongest person in this cultivator's own house who is above them.
     */
    private guideFor(cultivator: Cultivator): number | null {
        let best: number | null = null;

        // AND SOMEBODY WHO TOOK THEM ON
        const took = readFlag(this.db, cultivator.id, FLAG_MASTER);
        if (took) {
            const ordinal = Number(took.split(':').pop());
            if (Number.isFinite(ordinal) && ordinal > cultivator.realmOrdinal) best = ordinal;
        }

        const held = this.repos.sects.getMembership(cultivator.id);
        if (!held) return best;
        for (const member of getMembersOf(held.sectId)) {
            if (member.id === cultivator.id) continue;
            if (member.realmOrdinal <= cultivator.realmOrdinal) continue;
            if (best === null || member.realmOrdinal > best) best = member.realmOrdinal;
        }
        return best;
    }

    /**
     * What this cultivator is currently near enough to comprehend.
     */
    understandingFor(
        run: Run,
        cultivator: Cultivator,
        practisingTechniqueId: string | null = null
    ) {
        const context = discoveryContextFor(this.repos, cultivator, {
            runId: run.id,
            practisingTechniqueId
        }).context;

        // AND WHAT THEY ARE CARRYING
        const world = this.atHand;
        if (!world) return context;
        const carried = thingsCarriedThatTeachARoad(world, {
            ...howAPlayerStands(
                world,
                groundUnderfoot(world, cultivator.location, loosePlaceKey)
                    ?? worldLocationFor(world, cultivator.location),
                cultivator
            ),
            id: cultivator.id
        }).filter(thing => thing.standing.inReach);
        if (carried.length === 0) return context;

        return {
            ...context,
            daoGrounds: [
                ...(context.daoGrounds ?? []),
                ...carried.map(thing => ({
                    domain: thing.domain,
                    subject: thing.subject,
                    label: thing.name,
                    id: thing.id,
                    how: 'artifact' as const
                }))
            ]
        };
    }

    /**
     * "any work", "whatever is going", "" - a request rather than a name.
     *
     * Deliberately includes the empty string: somebody who typed "find work"
     * and named no trade wants work, not a menu.
     */
    private static readonly WORK_UNSPECIFIED =
        /^(?:any|some|whatever|anything|work|a job|any work|some work|whatever (?:is |'s )?going|whatever i can (?:get|find)|hard work|honest work|day labour|day labor)?$/i;

    /** "everything", "my herbs", "the lot" - a category, never a name. */
    private static readonly SELL_EVERYTHING =
        /^(?:all|everything|the lot|my |all my |the )?\s*(?:stuff|things?|goods|wares|herbs?|plants?|pills?|elixirs?|medicines?|ingredients?|reagents?|loot|haul|pouch|inventory|what i (?:have|gathered|found|picked)|whatever i have)\s*$/i;

    /** The pouch row a free-text name refers to, or null. */
    private pouchEntryFor(held: readonly PouchEntry[], query: string): PouchEntry | null {
        let best: { entry: PouchEntry; score: number } | null = null;
        for (const entry of held) {
            const named = this.lotFor(entry);
            if (!named) continue;
            const score = matchScore(query, named.name);
            if (score > MATCH_THRESHOLD && (!best || score > best.score)) {
                best = { entry, score };
            }
        }
        return best?.entry ?? null;
    }

    /**
     * A pouch row joined to its catalog, priced.
     */
    private lotFor(entry: PouchEntry): (SaleLot & { kind: PouchItemKind }) | null {
        if (entry.kind === 'herb') {
            // A BEAST MATERIAL IS A REAGENT AND SELLS AS ONE
            const material = getBeastMaterial(entry.itemId);
            if (material) {
                return {
                    itemId: material.id,
                    name: material.name,
                    item: material,
                    listStones: material.value,
                    quantity: entry.quantity,
                    kind: 'herb'
                };
            }
            const herb = getHerb(entry.itemId);
            if (!herb) return null;
            return {
                itemId: herb.id,
                name: herb.name,
                item: herb,
                listStones: herb.value,
                quantity: entry.quantity,
                kind: 'herb'
            };
        }
        const pill = getPill(entry.itemId);
        if (!pill) return null;
        return {
            itemId: pill.id,
            name: pill.name,
            item: pill,
            listStones: pill.value,
            quantity: entry.quantity,
            kind: 'pill'
        };
    }

    /**
     * An action that costs a turn of attention and nothing else. No day passes,
     * no satiety is burned, no roll is made - looking around must never be able
     * to kill you, and in a permadeath game that is a rule, not a courtesy.
     */
    freeAction(run: Run, action: ActionName, facts: EngineFacts): Execution {
        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'engine.readState',
                action,
                summary: `${facts.headline} Read only - no time passed and no value changed.`,
                ok: true
            }]
        };
    }


    /**
     * Buying food before it is needed, and carrying it.
     */
    private provision(
        run: Run,
        cultivator: Cultivator,
        days?: number,
        /** A count of rations, where the sentence named one instead of a span. */
        rations?: number,
        options: { askedFor?: number } = {}
    ): Execution {
        // A COUNT IS TAKEN AS ITSELF. "Buy twenty rations" names twenty things to
        // carry, not a span to be fed for, and converting one into the other in the
        // parser would be wrong in both directions - how long a ration lasts
        // depends on the body, because hunger tapers by realm.
        const wanted = rations !== undefined
            ? Math.max(1, Math.floor(rations))
            : Math.max(
                1,
                Math.ceil((days ?? DEFAULT_CULTIVATION_DAYS) / ACTIONS_PER_FULL_SATIETY)
            );
        const affordable = Math.floor(cultivator.spiritStones / PROVISION_COST_STONES);
        const bought = Math.min(wanted, affordable);

        if (bought === 0) {
            return refused('cultivator.applyDeltas', 'provision', factsForRefusal(
                'Not for what you have.',
                'You price a month of dry rations and put it back. The seller does not comment, ' +
                'which is its own kind of comment.',
                `Provisions: ${PROVISION_COST_STONES} spirit stones per ration; purse holds ` +
                `${cultivator.spiritStones}. Nothing bought, nothing spent.`
            ));
        }

        const cost = bought * PROVISION_COST_STONES;
        const updated = this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -cost });
        if (!updated) throw new GameError('Cultivator vanished while buying provisions.', 500);

        const held = this.rationsHeld(cultivator) + bought;
        this.setRationsHeld(cultivator, held);
        this.repos.runs.incrementTurn(run.id, 1);

        const covers = held * ACTIONS_PER_FULL_SATIETY;

        // THE CEILING, SAID RATHER THAN APPLIED IN SILENCE.
        const askedFor = options.askedFor;
        const clamped = days !== undefined && askedFor !== undefined && askedFor > days
            ? `${humanDays(askedFor)} was asked for. The most this engine will provision against `
              + `in one go is ${humanDays(days)}, and that is what was priced.`
            : null;

        const facts = factsForToolResult(
            `${bought} ration${bought === 1 ? '' : 's'} bought.`,
            [
                ...(clamped ? [clamped] : []),
                `${bought} ration${bought === 1 ? '' : 's'} of dry food, ${cost} spirit stones, ` +
                `and ${updated.spiritStones} left in the purse.`,
                `That is ${humanDays(covers)} of eating in the pack` +
                `${bought < wanted ? ', which is less than you went in for' : ''}.`,
                // Said plainly once, because it is the thing the whole early
                // game turns on and no interrupt can teach it in time.
                'Food does not come to a cave. Whatever is in the pack when the door shuts is ' +
                'the whole of what there is.'
            ]
        );
        facts.structure.push(
            `provision: bought ${bought} of ${wanted} wanted at ${PROVISION_COST_STONES} stones each; ` +
            `held now ${held} (${covers} days).`
        );

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'cultivator.applyDeltas',
                action: 'provision',
                summary:
                    `${bought} ration(s) for ${cost} spirit stones. Held: ${held}. ` +
                    'Carried on the cultivator and spent by the time skip.',
                ok: true
            }]
        };
    }

    /** Rations in the pack. Carried across turns, travel and changes of mind. */
    private rationsHeld(cultivator: Pick<Cultivator, 'id'>): number {
        const raw = readFlag(this.db, cultivator.id, FLAG_RATIONS_HELD);
        const held = raw === null ? 0 : Number(raw);
        return Number.isFinite(held) && held > 0 ? Math.floor(held) : 0;
    }

    /**
     * Hand a stretch of days what it needs out of the pack, and deduct it.
     */
    /**
     * Open a ration if the belly is low and the pack has one.
     */
    private feedFromPack(cultivator: Cultivator): Cultivator {
        // The wound list is consulted here too: a failed transformation does
        // not get the realm's own ability to stop eating. See
        // `satietyBurnMultiplier`.
        if (!stillNeedsToEat(cultivator.realmOrdinal, cultivator.injuries)) return cultivator;
        if (cultivator.satiety >= SATIETY_MAX / 2) return cultivator;
        const held = this.rationsHeld(cultivator);
        if (held <= 0) return cultivator;

        this.setRationsHeld(cultivator, held - 1);
        const updated = this.repos.cultivators.applyDeltas(cultivator.id, {
            satiety: SATIETY_MAX - cultivator.satiety,
            starvationTurns: -cultivator.starvationTurns
        });
        return updated ?? cultivator;
    }

    drawFromPack(
        // `injuries` is in the Pick because `satietyBurnMultiplier` reads it: a
        // failed transformation does not get the realm's own freedom from food,
        // so it changes how many rations a span actually draws.
        cultivator: Pick<Cultivator, 'id' | 'realmOrdinal' | 'satiety' | 'injuries'>,
        days: number
    ): number {
        const multiplier = satietyBurnMultiplier(cultivator.realmOrdinal, cultivator.injuries);
        if (multiplier <= 0) return 0;
        const perRation = Math.max(1, Math.floor(ACTIONS_PER_FULL_SATIETY / multiplier));
        // Only the shortfall. The belly covers the first stretch on its own,
        // and opening a ration to cover days already paid for wastes food the
        // player bought deliberately.
        const bellyCovers = Math.floor(cultivator.satiety / (SATIETY_COST_PER_ACTION * multiplier));
        const wanted = Math.ceil(Math.max(0, days - bellyCovers) / perRation);
        const held = this.rationsHeld(cultivator);
        const taken = Math.max(0, Math.min(wanted, held));
        if (taken > 0) this.setRationsHeld(cultivator, held - taken);
        return taken;
    }

    private setRationsHeld(cultivator: Pick<Cultivator, 'id'>, held: number): void {
        writeFlag(this.db, cultivator.id, FLAG_RATIONS_HELD, String(Math.max(0, Math.floor(held))));
    }

    /**
     * What this stretch would cost to eat, without buying anything.
     */
    provisionsForAStretch(days: number): ProvisioningPlan {
        this.useOwnDb();
        const requested = Math.floor(Number(days));
        if (!Number.isFinite(requested) || requested < 1) {
            throw new GameError('A stretch is a whole number of days, at least one.');
        }
        if (requested > MAX_CULTIVATION_DAYS) {
            throw new GameError(`The longest seclusion this engine will resolve in one pass is ${MAX_CULTIVATION_DAYS} days.`);
        }
        const { cultivator } = this.currentRun();
        return whatFeedingThisStretchCosts(cultivator, this.rationsHeld(cultivator), requested);
    }

    buyProvisions(
        cultivator: Cultivator,
        days: number,
        /**
         * Rations an interrupted half of THIS SAME sitting left unopened.
         */
        stillUnopened = 0
    ): { cultivator: Cultivator; rations: number; covered: number; line: string } {
        // The arithmetic is not done here. It is done in
        // `what-feeding-a-stretch-of-seclusion-costs.ts`, which is also what the
        // picker asks before the player commits - so what the door quotes and what
        // the cave charges cannot drift apart.
        const alsoAtTheCaveMouth = Math.max(0, Math.floor(stillUnopened));
        const plan = whatFeedingThisStretchCosts(
            cultivator, this.rationsHeld(cultivator) + alsoAtTheCaveMouth, days
        );
        // NOTHING TO BUY IS NOT NOTHING AFFORDABLE, AND THEY USED TO PRINT THE SAME
        // SENTENCE.
        if (plan.hungerHasStopped) {
            return {
                cultivator,
                rations: 0,
                covered: plan.covered,
                line:
                    'The pack is not opened and nothing is bought. At this rung the body has ' +
                    'stopped taking meals, and the pantry is not what stands between you and ' +
                    'the far end of this.'
            };
        }

        const { carried, toBuy, cost } = plan;
        const rations = carried + toBuy;
        // The unopened ones are already at the cave mouth and were never in the
        // pack, so only the remainder comes off the flag. Taking `carried` off
        // it wholesale would delete rations the player bought for a later trip.
        const fromThePack = Math.max(0, carried - alsoAtTheCaveMouth);
        if (fromThePack > 0) {
            this.setRationsHeld(cultivator, this.rationsHeld(cultivator) - fromThePack);
        }

        if (rations === 0) {
            return {
                cultivator,
                rations: 0,
                covered: plan.covered,
                line:
                    'Nothing in the pack and nothing the purse will buy: ' +
                    `${cultivator.spiritStones} spirit stones against ${PROVISION_COST_STONES} ` +
                    `per ration. The belly covers ${plan.covered} days ` +
                    'and then starvation begins.'
            };
        }

        const updated = cost > 0
            ? this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -cost })
            : cultivator;
        if (!updated) throw new GameError('Cultivator vanished while buying provisions.', 500);

        const covered = plan.covered;
        return {
            cultivator: updated,
            rations,
            covered,
            line: (carried > 0
                ? `${carried} ration${carried === 1 ? '' : 's'} came out of the pack` +
                  `${toBuy > 0 ? `, and ${toBuy} more was bought for ${cost} spirit stones` : ' and nothing had to be bought'}. `
                : `${rations} ration${rations === 1 ? '' : 's'} bought for ${cost} spirit stones. `)
                // AND WHAT IS LEFT, ON BOTH BRANCHES
                + (covered >= days
                    ? `That covers the whole stretch. ${updated.spiritStones} stones left.`
                    : `That is food for about ${humanDays(covered)} of the ${humanDays(days)} asked for. ` +
                      'After that the belly is empty and five turns later it is fatal. ' +
                      `${updated.spiritStones} stones left.`)
        };
    }

    // ── plumbing ─────────────────────────────────────────────────────────

    /**
     * What the qi is doing where this cultivator is standing.
     */
    ambientFor(cultivator: Cultivator, run: Run): AmbientQi {
        const place = placeName(cultivator);
        const here = this.atHand ? worldLocationFor(this.atHand, place) : null;
        const density = here
            ? here.environment.spiritualDensity
            : groundDensityFor(place) ?? undefined;

        return ambientForBlock(run.seed, place, Math.floor(run.elapsedDays), {
            ...(density === undefined ? {} : { density }),
            ...(here ? { sealed: here.sealed } : {})
        });
    }

    /** The newest run - live if there is one, otherwise the last one to end. */
    currentRun(): { run: Run; cultivator: Cultivator } {
        const run = this.repos.runs.getActiveRun() ?? this.repos.runs.latestFinishedRun() ?? null;
        if (!run) throw new GameError('No run has been started yet.', 404);
        const cultivator = this.repos.cultivators.getById(run.cultivatorId);
        if (!cultivator) throw new GameError('This run has no cultivator. The save is inconsistent.', 500);
        return { run, cultivator };
    }

    /**
     * Who is asking, and what they have heard of.
     */
    scopeFor(cultivator: Cultivator): KnowledgeScope {
        return {
            gate: this.knowledge,
            holderId: cultivator.id,
            here: cultivator.location,
            present: this.present(cultivator)
        };
    }

    /**
     * Everybody standing where the player is standing.
     */

    /**
     * What the player's membership looks like from where they are standing.
     */
    private standingHere(cultivator: Cultivator): string | null {
        if (!cultivator.sectId) return null;
        const sect = this.repos.sects.getById(cultivator.sectId);
        if (!sect) return null;

        const membership = this.repos.sects.getMembership(cultivator.id);
        const rank = membership?.rankTitle ?? 'a member';

        // Deliberately NOT "you are at your sect's headquarters". The catalog
        // records a territory in prose - "no fixed seat", "cutting houses at
        // the edge of six cities, all of them rented" - and matching a free
        // text location against that would be inventing a fact the content
        // does not state. What is certain is the membership and what it is
        // worth, and what it is worth is local.
        const territory = getSect(sect.id)?.territory ?? null;

        return `${sect.name} has you down as ${rank}. ` +
            (territory
                ? `${territory} Whether that means anything where you are standing depends on who is ` +
                  'standing in front of you.'
                : 'Whether that means anything where you are standing depends on who is standing in ' +
                  'front of you.');
    }


    /**
     * Whether a name is anywhere the world would recognise.
     */
    somewhereReal(name: string, cultivator: Cultivator): boolean {
        // Loose on both sides. The parser strips a leading article and
        // `placeKey` keeps it, so a strict comparison could never match any
        // location whose name begins with "the" - and in a generated world that
        // is 26 of 33, including every ruin, every scar and all four sites at
        // the qi ceiling. See `loosePlaceKey`.
        const wanted = loosePlaceKey(name);
        if (wanted.length === 0) return false;
        if (loosePlaceKey(cultivator.location ?? '') === wanted) return true;

        if (this.atHand && worldLocationFor(this.atHand, name)) return true;

        const occupied = this.repos.cultivators.roster()
            .some(row => row.location && loosePlaceKey(row.location) === wanted);
        if (occupied) return true;

        // Knowing a name is not knowing a way there.
        return this.knowledge
            .awareness(cultivator.id, 'place')
            .some(row =>
                (loosePlaceKey(row.name) === wanted || loosePlaceKey(row.id) === wanted)
                && this.knowledge.canPointAt(cultivator.id, 'place', row.id));
    }


    /**
     * Somebody standing here, when the player pointed rather than named.
     */
    /**
     * The ruin the player means when they say "the ruins".
     */
    /**
     * The ground under their feet, when the sentence says "here" rather than a
     * name.
     */
    groundAtHand(query: string, cultivator: Cultivator): ResolvedEntity | null {
        if (!/^(?:the |this |round |around )?(?:here|place|ground|town|village|city|province|region|district|land|area|settlement|surroundings)$/i
            .test(query.trim())) {
            return null;
        }
        const here = (cultivator.location ?? '').trim();
        return here.length >= 2 ? resolvePlace(here) : null;
    }

    ruinAtHand(query: string, cultivator: Cultivator): ResolvedEntity | null {
        if (!/^(?:the |that |these |those |a )?(?:old |broken |sealed |dead )*(?:ruins?|wreck|remains|rubble|old place)$/i
            .test(query.trim())) {
            return null;
        }
        if (!this.atHand) return null;

        const here = placeKey(cultivator.location ?? '');
        const ruin = this.atHand.locations.find(loc =>
            /ruin|wreck|remnant|broken|derelict/i.test(loc.name)
            && (placeKey(loc.name).includes(here) || here.length === 0 || placeKey(loc.name) === here));

        // Failing that, any ruin the cultivator has heard named. A player who
        // was told about one and walks off to search it is doing the right
        // thing and should not be told it does not exist.
        const known = ruin ?? this.atHand.locations.find(loc =>
            /ruin|wreck|remnant|derelict/i.test(loc.name)
            && this.knowledge.isAwareOf(cultivator.id, 'place', loc.id));
        if (!known) return null;

        return {
            kind: 'place',
            id: known.id,
            name: known.name,
            facts: [
                `${known.name} is there, and has been longer than anyone standing near it.`,
                'Nothing about it is arranged for a visitor. What is still in it is still in it ' +
                'because getting it out was harder than it was worth to whoever tried last.'
            ],
            structure: [`world location ${known.id}; matched on "${query}".`]
        };
    }

    /**
     * A face they can place, nearest their own height, and only then anybody.
     */
    whoTheNearestFaceIs(cultivator: Cultivator, here: readonly RosterEntry[]): RosterEntry | null {
        if (here.length === 0) return null;
        const byHeight = [...here].sort((a, b) =>
            Math.abs(a.realmOrdinal - cultivator.realmOrdinal)
            - Math.abs(b.realmOrdinal - cultivator.realmOrdinal)
            || (a.id < b.id ? -1 : 1));
        return byHeight.find(row =>
            this.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id)) ?? byHeight[0];
    }

    somebodyAtHand(query: string, cultivator: Cultivator): RosterEntry | null {
        const wanted = query.trim();
        const here = this.present(cultivator);

        // A TARGET IS A DESCRIPTION, AND EVERY VERB THAT TAKES ONE GETS IT HERE.
        //
        // Asked before POINTING because POINTING is a LIST OF NOUNS and this is
        // the general question. "the youngest girl", "the oldest man", "you,
        // void refinement cultivator" are on no list and never will be, and the
        // design owner's point about them is that the verb is beside the point:
        // *and replace kill with other verb too*.
        //
        // A pronoun is excluded because it is an anaphor and not a description -
        // see the branch below, which is the one place "her" may be answered.
        const described = A_PRONOUN_FOR_SOMEBODY_ALREADY_NAMED.test(wanted)
            ? null
            : theDescriptionThisIs(wanted);
        if (described) {
            const narrowed = described.sex !== null || described.rank !== null
                || described.alignment !== null || described.realmKey !== null
                || described.standing !== null || described.sameHouse
                || described.tie !== null;
            // An ordering with nothing narrowed is what `whoTheNearestFaceIs`
            // already answers, and it answers it better: it prefers a face the
            // player can put a name to. One reading of "nearest", not two.
            if (!narrowed && described.end === 'nearest') {
                return this.whoTheNearestFaceIs(cultivator, here);
            }
            const mine = positionIn(this.repos, cultivator.id);
            const fits = whoTheDescriptionFits({
                description: described,
                candidates: here,
                observer: {
                    ordinal: cultivator.realmOrdinal,
                    sectId: mine?.sectId ?? null,
                    rankIndex: mine?.rankIndex ?? null
                },
                alignmentOf: sectId =>
                    sectId ? this.repos.sects.getById(sectId)?.alignment ?? null : null,
                rankIndexOf: (sectId, rankTitle) => {
                    if (!sectId || !rankTitle) return null;
                    const at = this.repos.sects.getById(sectId)?.ranks
                        .findIndex(rung => rung.toLowerCase() === rankTitle.toLowerCase());
                    return at === undefined || at < 0 ? null : at;
                },
                tiesTo: id => (this.atHand?.npcs ?? [])
                    .find(npc => npc.id === cultivator.id)?.relationships
                    .filter(tie => tie.targetId === id)
                    .map(tie => tie.kind)
                    ?? []
            });
            if (fits.length > 0) {
                return here.find(row => row.id === fits[0].id) ?? null;
            }
            // A description that fits nobody standing here is an ANSWER. Falling
            // through would hand back the last of the crowd order, which is the
            // silent retarget `acts-over-a-set.ts` measured on a set.
            if (narrowed) return null;
        }

        if (!POINTING.test(wanted)) return null;

        // A pronoun is an ANAPHOR and never a description. See
        // `A_PRONOUN_FOR_SOMEBODY_ALREADY_NAMED`: the only person "her" can
        // mean is the one the player was already dealing with, and where there
        // is nobody it means nobody. Falling through to the crowd order below
        // is what put a marriage proposal to a stranger the player had never
        // mentioned.
        if (A_PRONOUN_FOR_SOMEBODY_ALREADY_NAMED.test(wanted)) {
            const last = readFlag(this.db, cultivator.id, FLAG_LAST_ADDRESSED);
            const addressed = last ? here.find(row => row.id === last) : undefined;
            if (addressed) return addressed;

            // AND OTHERWISE THE NEAREST, WHICH IS NOT THE CROWD ORDER
            return this.whoTheNearestFaceIs(cultivator, here);
        }

        // A rank pointer has to land on somebody who holds the rank. See
        // POINTING_AT_A_RANK: without this, "I kill the elder" fought whoever
        // was standing nearest and wrote the wounds to the character.
        const rank = POINTING_AT_A_RANK.exec(wanted);
        if (rank) {
            const holding = here.filter(row =>
                (row.sectRank ?? '').toLowerCase().includes(rank[1].toLowerCase()));
            return holding.length > 0 ? holding[holding.length - 1] : null;
        }

        // Nobody in particular means somebody they could actually walk up to.
        // See POINTING_AT_NOBODY_IN_PARTICULAR: a face they can name, nearest
        // their own height, and only if neither of those exists does it fall
        // through to the crowd order. This is the half of the resolver that the
        // starting-knowledge seeding pays for - a player who opens a run
        // knowing three people from home has three people "someone" can mean.
        if (POINTING_AT_NOBODY_IN_PARTICULAR.test(wanted) && here.length > 0) {
            return this.whoTheNearestFaceIs(cultivator, here);
        }

        // The last of a list that has ONE order, which is the whole of what makes
        // this reproducible. See `oneCrowd` in `hearsay.ts`: this used to read the
        // last element of two independently-sorted halves stuck together, so the
        // same seed on the same day could hand `combat_manage.resolve` a different
        // opponent, and the stream is seeded on the opponent's id. Nothing about
        // "nearest" is computed here - there is no distance in this world model -
        // and the honest version of that is a stated arbitrary order rather than an
        // unstated one.
        return here.length > 0 ? here[here.length - 1] : null;
    }

    present(cultivator: Cultivator): RosterEntry[] {
        return othersPresent(this.repos, cultivator, this.atHand);
    }

    /**
     * The body the fight this turn is standing in is being fought against.
     */
    private theBodyOpposite(held: StandingFight | null): BodyInAFight | null {
        if (!held) return null;
        const hp = held.state.hp[held.opponent.id];
        if (!Number.isFinite(hp)) return null;
        return {
            personId: held.party.id,
            hp,
            maxHp: Math.max(1, held.opponent.maxHp)
        };
    }

    /**
     * Anybody who was standing here as the turn opened and is now dead.
     */
    private theFallenAmong(
        before: readonly RosterEntry[],
        now: readonly RosterEntry[]
    ): RosterEntry[] {
        const standing = new Set(now.map(row => row.id));
        const gone = before.filter(row => !standing.has(row.id));
        if (gone.length === 0) return [];

        const inWorld = new Map((this.atHand?.npcs ?? []).map(npc => [npc.id, npc.status]));
        const stored = new Map(this.repos.cultivators.roster().map(row => [row.id, row.alive]));
        return gone.filter(row => {
            const rowAlive = stored.get(row.id);
            if (rowAlive !== undefined) return !rowAlive;
            const status = inWorld.get(row.id);
            return status !== undefined && status !== 'alive';
        });
    }

    /**
     * Put the people who were in this turn into the account of it.
     */
    private sayWhoWasInIt(
        execution: Execution,
        squareBefore: readonly RosterEntry[],
        playerBefore: Cultivator,
        playerNow: Cultivator,
        declared: readonly DeclaredMovement[] = []
    ): void {
        const now = this.present(playerNow);
        for (const said of whatThePeopleHereAreAnswering({
            before: squareBefore,
            now,
            fallen: this.theFallenAmong(squareBefore, now),
            playerBefore,
            playerNow,
            gate: this.knowledge,
            declared
        })) {
            execution.facts.lines.push(said);
            execution.facts.prose = execution.facts.prose.length > 0
                ? `${execution.facts.prose}\n\n${said}`
                : said;
        }
    }

    /**
     * Who is here, split by whether the player can name them.
     */
    /**
     * Write down the faces a life like this grew up around.
     */
    private async seedTheFacesFromHome(
        cultivator: Cultivator,
        origin: OriginTierKey,
        seed: string
    ): Promise<void> {
        const world = await this.loadWorld();
        if (!world) return;
        this.atHand = world;

        for (const face of facesFromHome({ world, cultivator, origin, seed })) {
            this.knowledge.learnIfNew({
                holderId: cultivator.id,
                kind: 'cultivator',
                id: face.id,
                name: face.name,
                onDay: 0,
                sourceKind: 'witnessed',
                sourceNote: face.sourceNote,
                stance: 'knows',
                statement: face.statement,
                confidence: 1
            });
        }
    }

    company(cultivator: Cultivator): Company {
        const here = this.present(cultivator);
        const named: Company['named'] = [];
        const strangers: Company['strangers'] = [];

        for (const person of here) {
            if (this.knowledge.isAwareOf(cultivator.id, 'cultivator', person.id)) {
                named.push({
                    name: person.name,
                    ordinal: person.realmOrdinal,
                    sex: person.sex ?? null,
                    age: person.age,
                    rank: person.sectRank ?? null
                });
            } else {
                strangers.push({ ordinal: person.realmOrdinal });
            }
        }

        // Deepest first: in a square, the person you notice is the one the
        // others are being careful around.
        named.sort((a, b) => b.ordinal - a.ordinal);
        strangers.sort((a, b) => b.ordinal - a.ordinal);

        return { named, strangers, total: here.length };
    }

    /**
     * Move the world the same span the cultivator just spent.
     */
    async advanceWorld(days: number, cultivator: Cultivator, run: Run): Promise<WorldReport> {
        if (!this.worldEnabled || days <= 0) return { lines: [], structure: [] };

        const advance = await advanceWorldForCultivator(run, cultivator, days);

        // The half of the span nobody mentioned. It is not discarded: an
        // unheard consequence keeps its one lifetime chance of turning up on
        // this player, in this window or a later one.
        this.pendingArrivals.push(...arrivableForSpan(
            advance?.result.events ?? [],
            (advance?.result.digest?.lines ?? []).map(line => line.factId),
            unattributedTextOf
        ));

        return reportFromDigest(advance?.result.digest ?? null);
    }

    /**
     * Put the player on the world's roster, or refresh the row already there.
     */
    private refreshThePlayerRow(cultivator: Cultivator): void {
        if (!this.atHand) return;
        const membership = this.repos.sects.getMembership(cultivator.id);
        standInTheWorld(this.atHand, cultivator, {
            factionId: membership?.sectId ?? null,
            rankIndex: membership?.rankIndex ?? -1
        }, this.atHand.currentDay);
    }

    /**
     * If this turn ended the life, put the death and the estate into the world. ──
     * WHY IT IS HERE AND NOT AT EACH DEATH SITE ────────────────────────
     */
    settleTheEstateIfTheyDied(): EstateOutcome | null {
        const now = this.currentRun();
        if (now.cultivator.alive || !now.cultivator.deathCause) return null;

        const settled = settleWhatTheyWereCarrying({
            db: this.db,
            world: this.atHand,
            ledger: this.legacy,
            cultivator: now.cultivator,
            runId: now.run.id,
            // The engine's own sentence, written by `markDead` a moment ago.
            // Never composed here: how somebody died is not this method's to
            // phrase, and a second phrasing beside the stored one is two
            // accounts of one death.
            causeNote: now.run.deathDescription
                ?? `Died of ${now.cultivator.deathCause}.`,
            // Who is standing over the body is who ends up with what was on
            // it - and `somebodyDidThis` is the ruling about who that is.
            // Being in the same town when somebody starves is not standing
            // over them; killing them is. Everything else goes into the
            // ground, which is what the Late Age is made of.
            standingOver: somebodyDidThis(now.cultivator.deathCause)
                ? this.present(now.cultivator).map(row => ({ id: row.id, name: row.name }))
                : [],
            // A failed crossing leaves a scar and nothing to search.
            leavesBody: now.cultivator.deathCause !== 'heavenly_tribulation'
        });
        if (settled.worldDirty) this.worldDirty = true;
        return settled;
    }

    /**
     * Where a deed by this cultivator happened, as a location id the world
     * resolves.
     */
    worldPlaceOf(cultivator: Cultivator): string | null {
        if (!this.atHand) return null;
        return worldLocationFor(this.atHand, cultivator.location)?.id ?? null;
    }

    /**
     * Whether a name gets said in this scene, and the record for it if so.
     */
    private hear(
        cultivator: Cultivator,
        run: Run,
        occasion: string,
        addressingId: string | null,
        listening?: { intent: HearingIntent; reach?: AnswerReach }
    ): Hearing | null {
        const addressing = addressingId
            ? this.present(cultivator).find(row => row.id === addressingId) ?? null
            : null;

        const offered = offerHearing({
            repos: this.repos,
            gate: this.knowledge,
            cultivator,
            run,
            addressing,
            occasion,
            world: this.atHand,
            ...(listening ?? {})
        });
        if (!offered) return null;

        const learned = recordHearing(this.knowledge, cultivator, run, offered);
        return learned.length > 0 ? { ...offered, names: learned } : null;
    }

    /**
     * One thing worth noticing about the people here.
     */
    private notice(cultivator: Cultivator, run: Run, occasion: string): string | null {
        const seen = observableHere({
            present: this.present(cultivator),
            gate: this.knowledge,
            holderId: cultivator.id,
            rng: forStream(run.seed, 'web_practice', Math.floor(run.elapsedDays), occasion, cultivator.id)
        });
        return seen ? observedLine(seen) : null;
    }

    /** Everything this cultivator has heard of. The narrator's whitelist. */
    private awarenessOf(cultivator: Cultivator): AwarenessRow[] {
        return this.knowledge.awareness(cultivator.id);
    }

    /**
     * The blank look, which is the answer.
     */
    private blankLook(cultivator: Cultivator): string {
        const here = this.present(cultivator);
        const where = placeName(cultivator);
        if (here.length === 0) {
            return `You say it aloud in ${where} and ${where} carries on as it was. ` +
                'Whatever you meant by it, there is nothing here that answers to it.';
        }

        const witness = here.find(
            row => this.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id)
        );
        if (!witness) {
            return `Nobody in ${where} answers to that name. The nearest person hears the ` +
                'words out the way people hear out a sentence with a hole in it, and goes ' +
                'back to what they were doing.';
        }

        return `Nobody in ${where} answers to that name. ${witness.name} hears you say it ` +
            'and waits a moment, in case the rest of it is coming, and then goes back to ' +
            'what they were doing.';
    }

    /**
     * What is actually about, briefly, when the player named nobody.
     */
    whoIsAbout(cultivator: Cultivator): string {
        const here = this.present(cultivator);
        const where = placeName(cultivator);
        if (here.length === 0) {
            return `There is nobody about in ${where} at all, and you had not settled on who you ` +
                'were looking for before you noticed that.';
        }
        if (here.length === 1) {
            return this.knowledge.isAwareOf(cultivator.id, 'cultivator', here[0].id)
                ? `${here[0].name} is the only person in ${where}, and you have not decided ` +
                  'whether it was them you wanted.'
                : `There is one other person in ${where}, and you have not decided whether it ` +
                  'was them you wanted. You could not put a name to them if it was.';
        }
        return `There are people about in ${where}, and you get as far as opening your mouth ` +
            'before realising you had not picked one.';
    }

    /**
     * What the player could have meant, drawn only from what they know.
     */
    knownNamesLine(cultivator: Cultivator, scope: KnowledgeScope): string {
        const names = nearbyNames(this.repos, cultivator, scope);
        return names.length > 0
            ? `Known to this cultivator, or standing here: ${names.join(', ')}.`
            : 'This cultivator has heard of nobody and nowhere but the ground under them.';
    }

    /**
     * Record that the player has now encountered something.
     */
    noteEncounter(
        cultivator: Cultivator,
        run: Run,
        entity: { kind: string; id: string; name: string },
        sourceKind: 'witnessed' | 'told' | 'read',
        note: string
    ): boolean {
        const kind = entity.kind;
        if (kind !== 'cultivator' && kind !== 'sect' && kind !== 'place') return false;
        // WHO "HER" MEANS ON THE NEXT TURN. Every verb that resolves a person
        // passes through here, which is what makes this the one place the
        // referent can be kept without eight call sites remembering to. See
        // `A_PRONOUN_FOR_SOMEBODY_ALREADY_NAMED`.
        if (kind === 'cultivator') {
            writeFlag(this.db, cultivator.id, FLAG_LAST_ADDRESSED, entity.id);
        }
        return this.knowledge.learnIfNew({
            holderId: cultivator.id,
            kind,
            id: entity.id,
            name: entity.name,
            onDay: Math.floor(run.elapsedDays),
            sourceKind,
            sourceNote: note,
            // A stage rather than a bare stance, so meeting somebody can RAISE
            // a name that arrived as a whisper. Mapped onto the same stance
            // vocabulary underneath, so nothing about the row changes shape -
            // but `told` used to land at `named`, which cannot license travel,
            // and being told where somewhere is by a person standing in front of
            // you plainly can.
            stage: sourceKind === 'witnessed' ? 'encountered' : 'placed'
        });
    }

    /** True once a crossing has taken this cultivator's name. */
    private nameTaken(cultivator: Pick<Cultivator, 'id'>): boolean {
        return readFlag(this.db, cultivator.id, FLAG_NAME_TAKEN) === '1';
    }

    /**
     * The run, for a caller that intends to change it.
     *
     * Death is terminal. Refusing every mutating call afterwards is enforced
     * here rather than in each handler, so a new endpoint cannot forget it.
     */
    private requireLiveRun(): { run: Run; cultivator: Cultivator } {
        const current = this.currentRun();
        if (current.run.status !== 'active' || !current.cultivator.alive) {
            throw new GameError(
                `${current.cultivator.name} is dead (${current.run.deathCause ?? current.cultivator.deathCause ?? 'unrecorded'}). ` +
                'The run is closed: there is no reload, no revival, and no continuation. Begin a new run.',
                409
            );
        }
        return current;
    }

    /**
     * The sect's display name for a cultivator's `sectId`.
     */
    sectNameFor(cultivator: Pick<Cultivator, 'sectId'>): string | null {
        if (!cultivator.sectId) return null;
        return this.repos.sects.getById(cultivator.sectId)?.name
            ?? getSect(cultivator.sectId)?.name
            ?? null;
    }

    /**
     * Display names for the arts the cultivator knows, resolved through the same
     * two sources as sects. An id the catalog does not hold is passed through
     * as-is rather than dropped: an unknown art the player nonetheless owns is
     * worth mentioning, and inventing a name for it would be worse.
     */
    private knownTechniqueNames(cultivator: Cultivator): string[] {
        return cultivator.knownTechniques.map(id => getTechnique(id)?.name ?? id);
    }

    /**
     * Who is actually holding something against this cultivator, derived.
     */
    private whoIsHuntingThisCultivator(cultivator: Cultivator): string[] {
        const npcs = this.atHand?.npcs ?? [];
        return [...whatTheWorldHoldsAbout({
            db: this.db as unknown as ObligationDb,
            person: {
                id: cultivator.id,
                ordinal: cultivator.realmOrdinal,
                // `Backing`'s own three values, read off the roll: a house that
                // would have to be dealt with, a roll whose house would not put
                // its weight behind you, and nobody at all.
                backing: cultivator.sectId === null
                    ? 'none'
                    : cultivator.sectRank ? 'backed' : 'unclaimable'
            },
            lookUpHolder: id => {
                const npc = npcs.find(row => row.id === id);
                if (npc) {
                    return {
                        id: npc.id,
                        name: npc.name,
                        ordinal: npc.cultivation.realmOrdinal,
                        houseId: npc.factionId
                    };
                }
                const row = this.repos.cultivators.getById(id);
                if (row) {
                    return {
                        id: row.id,
                        name: row.name,
                        ordinal: row.realmOrdinal,
                        houseId: row.sectId ?? null
                    };
                }
                const house = this.repos.sects.getById(id);
                // A house is a holder like any other and has a rung: whoever
                // answers for it. Without this every institutional account read
                // as a holder nobody could place and was silently dropped.
                return house
                    ? { id: house.id, name: house.name, ordinal: house.powerOrdinal, houseId: house.id }
                    : null;
            }
        }).feuds];
    }

    private stateView(run: Run, cultivator: Cultivator): StateView {
        return {
            run: runView(run),
            cultivator: {
                ...cultivatorView(cultivator),
                feuds: this.whoIsHuntingThisCultivator(cultivator)
            },
            ambient: this.ambientFor(cultivator, run),
            derived: derivedView(cultivator, {
                sectName: this.sectNameFor(cultivator),
                nameTaken: this.nameTaken(cultivator),
                // The strongest environmental lever in the game, and it was on
                // no screen anywhere. Null rather than zeroes when no world is
                // loaded: "nobody is here" and "nobody has looked" are
                // different facts and only one of them is measured.
                ground: this.crowdingHere(cultivator),
                // What is live standing here, so the situation panel can offer
                // two or three of them beside Cultivate and Status. The same
                // list `help` prints and the same list a refusal teaches from,
                // computed once here - three copies of this would drift, and
                // the player would be shown one set of options by the panel and
                // a different set by the game a moment later.
                standingHere: this.affordancesFor(cultivator, run)
            }),
            // "You can look at the ledger and see the shape of who you used to
            // be" is a design requirement, so the ledger is on the wire.
            tolls: listTolls(this.db, cultivator.id),
            log: this.log.list(run.id),
            // The fork, when one is standing. The client draws two controls off
            // it; nothing about it is a gate, and free text is still the whole
            // game. Re-checked against this run and this cultivator on every
            // read rather than trusted, so a stale one cannot offer a decade
            // that no longer exists.
            fight: theFightStillStands(this.fight, run.id, cultivator.id)
                ? fightView(this.fight, whereThisFightStands(this.fight.state, this.ambientFor(cultivator, run)))
                : null,
            crossroads: stillStands(this.crossroads, run.id, cultivator)
                ? crossroadsView(this.crossroads, this.howToReferToThem(this.crossroads))
                : null
        };
    }

    /**
     * Engine rulings, as log lines. Sourced only from facts.ts and SimEvents.
     */
    private engineEntries(execution: Execution, turn: number, narration?: string): LogEntry[] {
        // The headline goes in UNLESS the narration already opens with it.
        const opensWithIt = typeof narration === 'string'
            && narration.trimStart().startsWith(execution.facts.headline.trim());
        const entries: LogEntry[] = opensWithIt
            ? []
            : [{ role: 'engine', turn, text: execution.facts.headline }];
        for (const line of execution.facts.structure) {
            entries.push({ role: 'engine', turn, text: withoutTheHandlerName(line) });
        }
        for (const event of execution.events.slice(0, MAX_LOGGED_EVENTS)) {
            entries.push({ role: 'engine', turn, text: `Day ${Math.round(event.dayOffset)}: ${event.summary}` });
        }
        if (execution.events.length > MAX_LOGGED_EVENTS) {
            entries.push({
                role: 'engine',
                turn,
                text: `(${execution.events.length - MAX_LOGGED_EVENTS} further events are in the seclusion digest.)`
            });
        }
        return entries;
    }
}

// THE VERB FAMILIES ARE MERGED ONTO THE CLASS HERE
export interface GameService extends TravelVerbs, CombatVerbs, CraftVerbs, InvestigateVerb, AskingVerbs, SituatedReads, SeclusionVerbs, CrossingVerb, MatchVerbs, SiteVerbs, InstitutionVerbs, DaoPartnerVerbs, TakingVerbs, GuardVerbs {}
type TravelVerbs = typeof travelVerbs;
type CombatVerbs = typeof combatVerbs;
type CraftVerbs = typeof craftVerbs;
type InvestigateVerb = typeof investigateVerb;
type AskingVerbs = typeof askingVerbs;
type SituatedReads = typeof situatedReads;
type SeclusionVerbs = typeof seclusionVerbs;
type CrossingVerb = typeof crossingVerb;
type MatchVerbs = typeof matchVerbs;
type SiteVerbs = typeof siteVerbs;
type InstitutionVerbs = typeof institutionVerbs;
type DaoPartnerVerbs = typeof daoPartnerVerbs;
type TakingVerbs = typeof takingVerbs;
type GuardVerbs = typeof guardVerbs;
Object.assign(GameService.prototype, travelVerbs, combatVerbs, craftVerbs, investigateVerb, askingVerbs, situatedReads, seclusionVerbs, crossingVerb, matchVerbs, siteVerbs, institutionVerbs, daoPartnerVerbs, takingVerbs, guardVerbs);
