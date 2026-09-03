/**
 * The game service - phase 2, and the only thing in this package that writes.
 *
 * Read the method bodies with one question in mind: *where does a value from a
 * model response become a row?* The answer is nowhere. A narrator can reach
 * this class in exactly one way - `Narrator.plan()` returns a member of a closed
 * enum plus a bounded `days` and an 80-character place name - and every number
 * that lands in SQLite after that comes out of `simulateTimeSkip`,
 * `attemptBreakthrough` or `applyDeltas`.
 *
 * `Narrator.narrate()` is called *after* the write, with the result of the
 * write, and its return value goes to exactly one place: the play log, as prose.
 * There is no branch anywhere below that inspects it.
 *
 * The service takes its `Database` by injection, so tests drive a real engine
 * over an in-memory database with no HTTP and no network. It then installs that
 * handle as the process database and builds its repositories through
 * `ensureCultivationDb`, which is what keeps this front door and the MCP tool
 * front door writing the same rows the same way - a second implementation of
 * "what a crossing took" would eventually disagree with the first, and the
 * disagreement would be a corrupted save rather than a failing test.
 */

import { randomUUID } from 'crypto';
import type { ManualQuality, SectAlignment } from '../schema/cultivation.js';
import type { ManualBand } from '../engine/cultivation/cultivation.js';
import type Database from 'better-sqlite3';
import {
    SATIETY_MAX,
    // The settling clock, which `stagnation_aging` kills on. Read for the
    // ceiling report so a player is told about it before it is spent, rather
    // than in the death line.
    // `STARTING_SPIRIT_STONES` is deliberately gone from here: what a run opens
    // with is now a property of the birth rather than a constant, and nine
    // births in ten still draw about that figure. The constant stays exported
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
import { whatTheyHold } from '../engine/social-leverage/what-an-elder-is-in-charge-of.js';
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
// What is WRONG with a place, as against what is still in the ground under it.
// The area-status layer had no importer anywhere in `src/web`, so a famine, a
// shut pass or a worked-out district changed prices and danger and said nothing.
// ── THE THREE WAYS OF COVERING GROUND THAT ARE NOT WALKING ───────────────
//
// Every module below was complete, tested and had no caller in `src/`. Each of
// them records its own gap in its own file - `FOLD_TRAVEL_ENGINE_GAP` names
// this handler by name - and the verbs below are what read them.
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
// whether that works. An ask with a different subject - there is no resolver in
// it, and `resolveAttempt` below is the only thing that settles one.
// The perceptual half of discovery, beside the social one above it. See that
// module's banner for the line between them: it gives the world and never
// gives people.
// The fourth, and the one a player asks first: what kinds of thing are live at
// all, standing here, in this state. Prompts rather than a menu - see the
// banner in the module for why that distinction is the whole design.
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
    // Who this particular person is about parting with things, which the
    // resolver would derive on its own. Read here so the PROSE can say it: a
    // term in an odds breakdown is legible to somebody reading the mechanical
    // channel and invisible to somebody reading the sentence, and the ruling
    // this serves is that a generous elder should READ as generous.
    // What the person on the other end does about having been coerced, lied to
    // or leaned on. Decided after the attempt and reading only what the
    // resolver decided; see `whatTheWrongedPartyDid`.
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
// something that already existed and had no caller; see the directory's README.
// The world's own bar for a tie that decides what somebody does. Read, never
// restated - see `whetherTheyGoAlongWithIt`.
// The favour that skips an admission bar, and the catalog that says which
// houses will take one. Both have been complete since they were written and
// neither has ever been reachable by the person playing.
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

// ── TURNING A RESULT INTO SENTENCES MOVED OUT ────────────────────────────
//
// `summariseToolBody` and the call-record builders around it are in
// `tool-result-prose.ts` now. A result gaining a shape that needs a sentence
// is its own reason to change, and the branch table is worth being able to
// read in one place - a verb missing from it does not fail, it falls through
// to "It is done." and says nothing. `MAX_LOGGED_EVENTS` went with them
// because both halves of the event-log cap have to be the same number.
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
import { investigateVerb } from './investigate-verb.js';
import { askingVerbs } from './asking-verbs.js';
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

// ── THE WIRE SHAPES AND THE REFUSAL MOVED OUT ────────────────────────────
//
// `GameError`, `StateView`, `ToolCallRecord`, `ActResult`, `CultivateResult`,
// `BreakthroughApiResult`, `GameServiceOptions` and `Execution` were declared
// in this file. They are the contract between this service and the browser,
// which is a different reason to change from anything a turn does, so they
// live in `turn-wire-shapes.ts` now. Re-exported below, so this module's own
// export surface is exactly what it was before the move.
import { GameError } from './turn-wire-shapes.js';
import { matchVerbs } from './match-verbs.js';
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
 *
 * `setDb` installs a PROCESS-global handle, and so do the world caches
 * downstream of it. One service per process is the deployment and never
 * notices; two in one process silently share whichever was built last,
 * which is how a run in one database ended up standing in a crowd of a
 * hundred and forty-three people from another.
 */
let ambientDb: Database.Database | null = null;

/**
 * Phrases that point at a person rather than naming one.
 *
 * Kept deliberately narrow. Everything here is a role, a pronoun or a
 * demonstrative - words that cannot be somebody's name - so a misspelled
 * real name never lands here and quietly gets the wrong person.
 */
const POINTING = /^(?:the |that |this |a |an |some )?(?:nearest |closest |nearby |other |old |young |first )*(?:someone|somebody|anyone|anybody|cultivator|cultivators|person|people|man|woman|men|women|elder|stranger|passerby|local|villager|guard|steward|merchant|trader|monk|beggar|one|fellow|him|her|them|they)(?: here| nearby| about| around| present| in the room| in front of me)?$/i;

/**
 * A word that refers BACK to somebody, rather than describing anybody.
 *
 * ── A PRONOUN WITH NO REFERENT WAS SILENTLY BECOMING SOMEBODY ELSE ───
 *
 * Played in the browser, and it is worse than any refusal:
 *
 *   > I offer her family everything I have for her hand
 *   "You put the words to Shen Liefeng..."
 *
 * The player had spent the two previous turns on Gu Peiyan. "her" fell into
 * `POINTING`, which answers a pointer with the crowd order's last element, and
 * the proposal was made to a different person - with nothing anywhere saying
 * the addressee had been swapped.
 *
 * The rest of `POINTING` is right to use the crowd order and this is not, and
 * the difference is grammatical rather than a matter of degree. *"The elder"*
 * and *"the stranger"* DESCRIBE somebody the player is looking at, so any
 * person answering the description is a legitimate reading. A pronoun
 * describes nobody: it stands in for a name that was already said, and the
 * only honest answer is the person it was said about. Reaching for the nearest
 * body instead is the substitution defect, which
 * `POINTING_AT_A_RANK` and `POINTING_AT_NOBODY_IN_PARTICULAR` were both
 * written to stop in their own corners of the same regex.
 *
 * So a pronoun resolves to whoever the player last dealt with, and where there
 * is no such person it resolves to NOBODY and the caller refuses by name -
 * which says the sentence could not be read, instead of reading it as somebody
 * the player never mentioned.
 */
const A_PRONOUN_FOR_SOMEBODY_ALREADY_NAMED =
    /^(?:him|her|them|they|his|hers|their|theirs)$/i;

/**
 * An Unearned Step in the pouch, with the grade it was made at.
 *
 * ── WHY THE GRADE IS IN THE ID ───────────────────────────────────────────
 *
 * The catalog holds ONE row for the object and three grades on it, because
 * grade is a property of the copy rather than of the kind - and the pouch
 * stores a count against an item id and has nowhere else to put one. So a
 * carried copy is `immortal-unearned-step:lower`, and this is the one place
 * that convention is read.
 *
 * It is a stop-gap and the catalog says what the real answer is:
 * `NOT_YET_KEPT_AS_OBJECTS` states that every one of these should be an
 * `ObjectRecord` with a holder chain and a provenance, that a count "cannot
 * answer which one moved, who moved it, or what was given for it", and that the
 * worked precedent is `who-holds-the-structural-repair-medicine.ts` next door.
 * That is a seeding job in files this does not own. What this buys in the
 * meantime is that the EFFECT exists and a player can reach it, which is the
 * difference between a rule and a paragraph.
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
 *
 * Measured in one room on one turn, before this existed:
 *
 *     "I spar with someone here"      There is nobody in front of you that the
 *                                     thought fits.
 *     "I introduce myself to someone" You put the words to Tang Shuwu.
 *
 * Two failures from one cause. `someone` was in neither `POINTING` nor the
 * roster, so the fight path found nobody and the conversation path fell through
 * to a FUZZY NAME MATCH and silently landed on a specific person - the same
 * defect `POINTING_AT_A_RANK` was written for, in different clothes. Meanwhile
 * the room knew perfectly well that forty-nine people were in it.
 *
 * The indefinite case wants a different answer from the rest of `POINTING`, and
 * this is why it is a set of its own. "The elder" and "him" describe SOMEBODY
 * SPECIFIC that the player is looking at, so the arbitrary crowd order is the
 * honest answer. "Someone" describes nobody in particular, and answering it
 * with the crowd order hands a Qi Condensation disciple the strongest person in
 * the square to pick a fight with - a footgun dressed as a resolution. What
 * somebody means by "someone" is a person they could actually walk up to, so
 * that is what it resolves to: a face they can name, nearest their own height.
 */
const POINTING_AT_NOBODY_IN_PARTICULAR = /\b(?:someone|somebody|anyone|anybody)\b/i;

/**
 * Pointers that are a RANK rather than a description, and must land on
 * somebody who actually holds it.
 *
 * Found by a standing sweep, and it was a state-changing false positive rather
 * than a cosmetic one. "I kill the elder", typed by a rogue at ordinal 2 with
 * no house and no elder anywhere in the square, resolved: `elder` is in
 * {@link POINTING}, `somebodyAtHand` returns whoever happens to be standing
 * nearest to a pointing phrase, and the confrontation ran against a person the
 * sentence was not about. Real wounds were written to the character.
 *
 * The difference from the rest of that list is the whole point. "the man",
 * "the stranger", "him" are descriptions of whoever is there and cannot be
 * wrong about who they are; "the elder" PRESUPPOSES A LADDER, and a sentence
 * naming a rung must not be answered by somebody who is not on it. So a rank
 * pointer is checked against `sectRank` on the roster row, and where nobody
 * present holds it the pointer resolves to nothing - which every caller
 * already handles by refusing and saying what it could not find.
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
 *
 * Every count in the paragraph underneath is taken against this same
 * slice. A board that lists eight and reasons about twenty-five is telling
 * the player about goods they cannot see.
 */
/**
 * What a donation is worth against the same money earned by serving.
 *
 * The one judgement in the donation path, which is why it is named and stated
 * rather than folded into an expression. The design owner's rule: "somebody who
 * pays instead of serving should get a worse rate than the duty board implies,
 * or contribution stops meaning service rendered and becomes a second
 * currency."
 *
 * A third, which is steep on purpose. Paying is meant to be the expensive way
 * to do it - the route for somebody who has stones and no years - and a shallow
 * discount would make the board pointless for anybody who ever finds money.
 */
const DONATION_DISCOUNT = 1 / 3;

/** Reference span when a house is offering nothing to take a median of. */
const DEFAULT_DUTY_DAYS = 20;

/**
 * The interact intents that are ATTEMPTS TO MOVE SOMEBODY.
 *
 * `talk` and `apologise` are not on it: putting words to a person and saying
 * sorry are things that happen and do not have a pressure outcome, and running
 * them through the resolver would price a greeting as an attempt on somebody.
 * Everything here is a sentence where the player wants something and is using
 * something to get it.
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
 *
 * ── The defect, found by playing ─────────────────────────────────────────
 *
 * The `help` read named a Meridian Rebirth Pill as what the wound wanted, and
 * `I buy a Clear Meridian Pill` then took 132 spirit stones for something
 * `treat_injury` refuses to spend on that wound - because `treatWorstInjury`
 * enforces `medicineReaches` and the counter did not. Nothing in the sale said
 * so. The player learned it later, holding the pill, out the money.
 *
 * ── Why this is a sentence and not a refusal ─────────────────────────────
 *
 * `AGENTS.md` is explicit that the fix for an action that seems unwise is a
 * price or a warning, never a removed verb: banning is a decision taken away
 * from the person playing, and it is indistinguishable from the feature being
 * missing. There are real reasons to buy a pill that will not touch today's
 * wound - a lighter one tomorrow, a body that is not yet past the grade, a
 * sale a player wants for its own sake - and the engine is not entitled to
 * decide which of those they are having. So the pill is sold, the stones are
 * taken, and the receipt says what it will and will not reach, with the name
 * of the medicine that would in it.
 *
 * Nothing here decides anything. `medicineReaches` is the same call the
 * physician and `treat_injury` already make, and the sentence is the one
 * `whatToSayAboutTheCure` already writes for the other two surfaces, so the
 * counter cannot disagree with either about the same wound.
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
 *
 * The commission titles in this game are long and good - "What a Poor District
 * Has Instead of Monsters" - and a player refers to one the way people refer to
 * anything long: by the memorable part. Whole-string matching made the best
 * writing in the content files into an obstacle.
 *
 * Two words or more, and only words that carry meaning: a shared "the" or "of"
 * is not a reference to anything, and one shared noun would collide the moment
 * two commissions both mention a village. Three or more letters per word, and
 * at least two of them adjacent in the title, which is what makes it a phrase
 * rather than a bag of coincidences.
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
 *
 * Everything left out is still legal above the Lid: looking at where you are,
 * reading your own sheet, sitting down to cultivate, weighing an attempt. What
 * is here is the mortal economy and mortal society, neither of which a True
 * Immortal is standing in.
 */
const MORTAL_WORLD_ACTIONS: readonly ActionName[] = [
    'work', 'market', 'provision', 'eat', 'gather', 'hunt', 'interact', 'sect', 'move',
    // An inheritance ground is a hole in a hillside in the province. A True
    // Immortal is not standing near one, and the trip back down costs nine
    // strikes of the heaviest tribulation there is.
    'site',
    /**
     * Hitting somebody, which is the user's own worked example of what this
     * list should DO rather than refuse: "if you say you wanna attack the sect
     * you could send an immortal weapon down to your sect below and a message,
     * or you could do it yourself." Both of those are real and both are
     * reachable, so a sentence about a fight in the province is re-offered here
     * rather than answered by looking for somebody to swing at in a place where
     * there is nobody.
     */
    'attack',
    /**
     * Three of the four institutional verbs. A petition travels along a chain
     * of people; a declaration is made to somebody who has to hear it; a seal
     * is under a mountain in the province. None of the three is reachable from
     * the far side except by going.
     *
     * `offer` is deliberately NOT here, and it is the one exception on the
     * list. It is the same verb from the other end: below the Lid it is an
     * offering going up, above it a thing going down a line somebody is
     * holding, and which of those a player gets is decided by state rather
     * than by the word. Putting it here would have refused an immortal the one
     * mortal-world action they can actually perform.
     */
    'petition', 'posture', 'seal',
    /**
     * Asking a square what it has heard.
     *
     * Gossip is a mortal-world channel by construction: it reads the lower
     * world's ledger, weights a fact up for how far ABOVE the listener the
     * people in it stand, and picks its tellers out of the crowd standing here.
     * Every one of those is wrong on the far side of the Lid - there is no
     * crowd, nobody up there is above a True Immortal in the sense the weight
     * means, and the reason `look` has an above-the-Lid branch at all is that
     * the ordinary readers happily overheard two names through a wall on the
     * wrong layer. Re-offered rather than answered.
     */
    'news'
] as const;

/**
 * The words that mean "the library" rather than naming anything in it.
 *
 * A curriculum sentence carries the noun phrase the parser found after the
 * verb, and for the commonest phrasing that phrase IS the question - "what the
 * sect teaches". Refusing to resolve it is what keeps a request to see the
 * shelf from becoming a generational decree about an art nobody named.
 */
const GENERIC_LIBRARY_PHRASE =
    /\b(?:what|which|curriculum|curricula|library|shelf|taught|teach|teaches|teaching|methods|list|everything|anything|else)\b/i;

/**
 * The words that mean "a house" rather than naming one.
 *
 * The same problem `GENERIC_LIBRARY_PHRASE` solves, one verb over. "I look for
 * a sect that will take me" carries the noun phrase "sect that will take me",
 * which is a question about the whole category and not a name that failed to
 * resolve - and the two need opposite answers. A name that resolves to nothing
 * must be refused as unheard; a category has to reach the listing, which is the
 * only thing in the game that answers it.
 *
 * Anchored at the start on purpose. An unanchored noun test would swallow every
 * real house whose name ends in one of these words, which is most of them.
 */
/**
 * The words that mean "a pill" rather than naming one.
 *
 * Third instance of the same rule, after the library and the house. A category
 * has to reach the listing and a name has to reach the formula, and treating
 * the first as the second is how "I refine a pill" quietly became a Minor
 * Healing Pill - one arbitrary row out of forty-two, chosen by containment.
 *
 * Anchored, so `Foundation-Guiding Pill Formula` is still a name.
 */
/** How many formulas the listing reads out before it starts counting. */
const RECIPES_SHOWN = 8;

/** The same, for the arts. Two lists, one convention. */
const TECHNIQUES_SHOWN = 8;

/** And for the wall. Offers and refusals are counted separately. */
const DUTIES_SHOWN = 8;

/**
 * What a FULL month of mortal care puts back, as a flat quantity of HP.
 *
 * FIXED, not a fraction, and that is the whole of the design. The user's
 * ruling: wounds are not forever, they are answered by a graded ladder of
 * healing pills at the same rank requirement, "where a lower should heal almost
 * nothing - it'll heal a fixed hp amount and as you get up the amount becomes
 * a lot."
 *
 * A fixed amount self-scales in exactly that way with no rule saying so.
 * Twenty-four HP is most of a novice's body and a rounding error on a
 * Nascent Soul one, so the same village physician who mends a Qi Condensation
 * cultivator is a person applying a splint to a mountain four realms up. Being
 * weak after a seclusion is allowed to stay true.
 *
 * This was a FRACTION for one commit - "a full month restores a body
 * completely" - and that was wrong for a reason worth recording: it made the
 * entire pill ladder pointless. Nobody buys a 1,200-potency Undying Flesh Pill
 * when a month and a few stones does more, so the graded consumable the whole
 * medicine layer is built around had no customers at any rung.
 *
 * DERIVED FROM THE LADDER, not chosen beside it: the strongest mortal-grade
 * `heal_hp` pill in the catalog. Mortal care IS the bottom rung, and pricing it
 * as its own constant would let the two drift until a month of rest quietly
 * beat a pill again. If the data layer retunes the band, this follows.
 *
 * A shorter stay mends proportionally less, off `simulatedDays`, so this is a
 * ceiling on a month rather than a grant - and it can never exceed what the
 * body is actually missing.
 */
const CARE_RESTORES_HP = Math.max(
    1,
    ...PILLS
        .filter(pill => pill.effect === 'heal_hp' && pill.grade === 'mortal')
        .map(pill => pill.potency)
);

/**
 * The rung a cultivator with no cultivation manual is carried to.
 *
 * Re-exported from the cultivation engine rather than restated. It was a local
 * constant here for one commit, which is exactly the drift AGENTS.md warns
 * about: `techniqueCeiling` branches on this exact value to tell "there is no
 * book" apart from "the book is spent", and two copies of it would eventually
 * disagree about which sentence a player is shown.
 */

/**
 * How much of a day sect work leaves for cultivation.
 *
 * Below `WAITING_FOCUS` and above nothing. A commission is somebody else's
 * errand run at their pace, and the whole reason contribution is worth
 * anything is that earning it costs the thing it buys.
 */
const DUTY_FOCUS = 0.25;

/**
 * How a name reached this cultivator, for the inspector.
 *
 * Both call sites used to hardcode `name_overheard` and 'from people who did
 * not know they were heard'. There are three channels now - somebody says it to
 * you, somebody says it near you, and a traveller says it in passing with a
 * number of days on it - and two of those three summaries were simply false. An
 * inspector row that misdescribes where a name came from is worse than no row:
 * the whole discovery layer is about provenance, and this is where somebody
 * reads it back.
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
 *
 * `GENERIC_HOUSE_PHRASE` is unanchored at its end and has to stay that way for
 * the joining path it was written for. Six of the seven dao houses are called
 * "The House of ...", so once the leading article comes off the subject the
 * remainder begins with `house` and the unanchored test reads a specific name
 * as the whole category. Anchored at both ends it cannot: "a sect" is a
 * category, "House of the Narrow Hour" is a name, and no house in the catalog
 * is called any of these words on its own.
 */
const GENERIC_HOUSE_CATEGORY_ONLY =
    /^(?:any |some |a |an |one |another |new |good |strong |nearby |local |the )*(?:guest (?:student|studentship|place|pupil)|sects?|orders?|schools?|clans?|houses?|cults?|somewhere|anywhere|somebody|someone|anyone|anybody)(?:\s+(?:somewhere|anywhere|near(?:by)?|around(?: here)?|here|about|else))?$/i;

/**
 * Which elder a sentence meant, out of the ones the house actually holds.
 *
 * Matched against the roster the tool just returned rather than against
 * anything the player asserted, and a query that names nobody resolves to
 * nobody so the listing stands. Names are tried before rank titles and never
 * mixed with them: every elder in a house shares a title, so scoring the two
 * together lets "Elder Fang" match the word "Elder" on somebody else and
 * dismiss a person the player never named. This is the one leadership act that
 * lands the day it is spoken, and it takes the elder's whole line out with
 * them - a near miss here is not a near miss, it is the wrong person gone.
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
 *
 * ── A DECLINED CLAUSE THAT DEMONSTRABLY RAN ──────────────────────────────
 *
 * Played: `I go into seclusion for a year and gather qi` reported
 * *"Ran seclude. Not run: 'gather qi'"* over a year in which qi went 0 to 6.
 * Seclusion is how qi is gathered - `cultivate` and `seclude` are two doors
 * onto `runSeclusion` - so the honest-reporting line, which is the one thing a
 * player is being asked to trust about what a turn did, taught them that a year
 * of sitting still accumulates nothing.
 *
 * A CLOSED TABLE OF DISPATCH FACTS, not a similarity test. Each pair below is
 * two `case` labels in `execute` that call the same method with the same
 * arguments, and that is the only thing that puts a pair here: if the two ever
 * stop reaching one handler, the row is wrong and should go. Which is why it is
 * here, next to the dispatch, rather than in
 * `the-part-of-the-sentence-that-was-not-run.ts` - that module reads the verb
 * TABLE and has no way to know what two verbs resolve to.
 *
 * Symmetric on purpose: which of the two the player happened to type first is
 * not a fact about whether they asked for two things.
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
 *
 * Separate from `parseAdminCommand` because `admin_manage` arranges the world
 * and does not own runs - `game.ts` does, and a tool handler reaching in to
 * end one would be the second writer this file exists to prevent.
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
     *
     * The enforcement behind docs/world/houses/discovery.md: everything that reaches a
     * prompt or an entity resolver is filtered through this first, so the
     * narrator is never handed a name the player has not earned.
     */
    readonly knowledge: KnowledgeGate;
    /**
     * What this run has done to the inheritance grounds it has found.
     *
     * Over `cultivation_sites`, which the schema already keeps for exactly
     * this and whose own comment says a site outlives the run that turned it
     * up. Same posture as `KnowledgeGate` over `knowledge_records`: a narrow
     * reader and writer, not a second table.
     */
    readonly sites: SiteLedger;
    readonly legacy: LegacyLedger;
    /** Whether time passing for the cultivator also passes for everyone else. */
    readonly worldEnabled: boolean;
    /**
     * The world, loaded once per action.
     *
     * Resolving who is standing in front of the player needs the world, and it
     * is asked several times in the course of one action - by the scope, by the
     * hearing check, by a refusal deciding whether anybody is about. Loading it
     * once at the top of the action and holding it is the difference between
     * one rebuild and five.
     */
    atHand: WorldState | null = null;
    /**
     * World facts that reached this player by no channel at all, still eligible
     * to turn up on them.
     *
     * The digest counts what nobody told them - thirty-five events in one live
     * five-year seclusion - and that counter is correct: a world that is mostly
     * none of your business is the design. Arrival is the other door, and it is
     * rolled once per FACT and stable forever, so a fact that turned up has to
     * come OUT of this list or it turns up again in every subsequent window.
     * `consumeArrivals` is what takes it out, and it is not optional.
     */
    pendingArrivals: ArrivableFact[] = [];
    /**
     * A seclusion that stopped because of somebody, with the answer still owed.
     *
     * Beside `pendingArrivals` and for the same reason: it is a fact about a
     * turn in flight rather than a fact about the world, and the world layer
     * has nothing to say about it. See
     * `choosing-what-to-do-when-a-seclusion-is-broken.ts` for what each branch
     * costs and why losing this is not a way to cheat - losing it is going, and
     * going is what the engine did unasked before any of this existed.
     */
    crossroads: SeclusionCrossroads | null = null;
    /**
     * A fight that has started and has not ended.
     *
     * Beside `crossroads` and for the same reason, and it is the one piece of
     * turn-in-flight state that is NOT owed an answer: the crossroads stands for
     * exactly one turn and this stands until somebody is down, somebody is out,
     * or the round budget runs out. What the two share is the lifetime - in
     * memory, this run, this body - and the argument for it is in
     * `unfinished-fight.ts`: a persisted fight would let a player walk out
     * mid-swing, cultivate for a decade and come back to the same raised arm.
     *
     * UNLIKE the crossroads, an ordinary sentence does not end it. A player who
     * types "I cultivate" with somebody swinging at them takes the round and
     * then does what they asked - see `takeTheRoundFirst`. A fight is a
     * situation, not a mode you are trapped in.
     */
    fight: StandingFight | null = null;
    /**
     * Two costly acts in one sentence, with the choice still owed.
     *
     * Beside `crossroads` and for the same reasons, down to the lifetime: it is
     * a fact about a turn in flight, it stands for exactly one turn, and losing
     * it costs the player nothing, because nothing was spent raising it. See
     * `a-sentence-can-be-more-than-one-call.ts`.
     */
    private whichComesFirst: WhichComesFirst | null = null;
    /**
     * What the turn before this one did, and what it told the player.
     *
     * Beside `crossroads` and `whichComesFirst` and for the same reasons: a
     * fact about a turn in flight rather than about the world, one turn deep,
     * in memory, and worth nothing to lose - losing it costs the player a
     * back-reference and never an act, because the act is still theirs the
     * moment they name it.
     *
     * ONE TURN, AND THE BOUND IS THE DESIGN. It is composed into the phase-1
     * prompt and thrown away, so nothing accumulates and there is no
     * conversation history anywhere. A reader given ten turns starts writing
     * continuity; one turn is enough to resolve "keep at it" and "the cheaper
     * one" and structurally cannot become a narrative. See
     * `last-turn-memory.ts`.
     */
    private lastTurn: WhatTheLastTurnDid | null = null;
    /**
     * Steps that ran this turn, being collected for {@link lastTurn}.
     *
     * Written where the executor already classifies how a step went, so a step
     * the world refused never lands here and a refused turn leaves nothing to
     * carry on with. That is the honest answer and it is the one the player
     * gets.
     */
    private ranThisTurn: PlanStep[] = [];
    /**
     * Things this turn named to the player, being collected for {@link lastTurn}.
     *
     * Written by the branches that LIST things - the market board, the
     * copyist's stall - rather than recovered by reading the narration back.
     * Parsing prose for what exists would make the narrator authoritative over
     * the world, which is the one thing it may never be.
     */
    private namedThisTurn: ThingNamed[] = [];
    /**
     * Set when an action changed the world without spending a day.
     *
     * Every other world write rides on the time skip, which persists at the end
     * of a span. The far-side actions do not spend days and are all real state -
     * an abode settled, a seam opened and closed inside fifteen breaths, an
     * object put down a channel - so they say so here and `act` writes once,
     * after phase 2, before anything is narrated.
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
     *
     * Talent is rolled here, from a seed minted here, using the engine's own
     * `rollSpiritRoot` and `rollAttributes`. The request body carries a name and
     * nothing else that is read: a client that posts
     * `{name, spiritRoot: 'mutated_lightning', attributes: {...}}` gets the same
     * roll it would have got by posting the name alone. Talent is not earned,
     * cannot be improved, and is not negotiable - that is the genre, and it is
     * also why the client is not trusted with it.
     */
    /**
     * Point the ambient handle at this service's database.
     *
     * Called at the top of every public entry point rather than once in the
     * constructor. Production has one service and never notices; two in one
     * process silently share whichever was built last, which is how three
     * separate suite runs produced three different sets of failures from
     * the same code.
     */
    private useOwnDb(): void {
        if (ambientDb === this.db) return;
        setDb(this.db);
        // The world layer holds process-global caches - which world is the
        // active one, which world a run belongs to, the catalog - and none of
        // them are keyed by database. Swapping the handle underneath them
        // without saying so means the next run joins whichever world was
        // created first in this process, from whichever database that was.
        // `resetCultivationWorlds` exists for exactly this and says so; the
        // worlds are in SQLite and come back on the next touch.
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
        // inside this world rather than a world of its own - which is what
        // makes the ruins the new cultivator digs through the previous
        // cultivator's. When there is no world, the seed factory stands in.
        // `latestFinishedRun` rather than the ledger. "Which world does this
        // life begin in" and "what does this world's record of deaths say" are
        // different questions, and the ledger now excludes admin-rigged runs in
        // SQL - so reading lineage off it would have handed a fresh run a null
        // world the moment an operator flagged the run before it.
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
        //
        // Pure and deterministic off the same seed, and what it confers is a
        // place, a purse and a handful of knowledge rows - never a realm, a
        // rank, a membership or a foundation. That line is what keeps an origin
        // an OPENING POSITION rather than a head start: nine births in ten are
        // still a thin county, and what the other one in ten buys is being
        // somewhere better with more in the purse and more names already said
        // in front of them.
        const birth = drawBirth(seed);

        const root = rollSpiritRoot(forStream(seed, 'creation', 'spirit_root').next());
        // Its own named stream, beside the root and the attributes rather than
        // inside either: a draw added to one of those would have moved every
        // talent every existing run seed produces. Dealt once and permanent,
        // like the two above it, and it decides no number - what it decides is
        // whether a child can be of both parents' blood, and which of two
        // Courts would ever have opened their door.
        const sex = rollSex(forStream(seed, 'creation', 'sex').next());
        const attributeStream = forStream(seed, 'creation', 'attributes');
        const attributes = rollAttributes([
            attributeStream.next(),
            attributeStream.next(),
            attributeStream.next(),
            attributeStream.next()
        ]);

        // ── ONE DERIVATION, AND THIS WAS THE SECOND COPY OF IT ───────────
        //
        // `realms.ts` says it in as many words - "the one derivation of a
        // cultivator's HP pool. Nobody may write another" - and names this
        // exact line as the thing it has to agree with: "`maxHpForOrdinal(might,
        // 0)` must equal what the birth path writes." It did, because the
        // constants were kept in step by hand across two files. That is a
        // coincidence maintained by attention, and the ladder's body curve was
        // rewritten twice while this sat here.
        //
        // Same numbers, one source. A newborn is ordinal 0, and the multiplier
        // there is 1, so nothing about an opening sheet moves.
        const maxHp = maxHpForOrdinal(attributes.might, 0);
        const maxQi = maxQiForOrdinal(attributes.insight, 0);

        const created = this.db.transaction(() => {
            const cultivator = this.repos.cultivators.create({
                id: randomUUID(),
                name: trimmed,
                kind: 'pc',
                spiritRoot: root.key,
                sex,
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
                //
                // `sectId` without `sectRank` is not a new state and needs no
                // new column: `entities.ts` already prints "at the rank of X"
                // against "at no rank in it", and `factionRankIndex` in
                // `ground-that-teaches-a-road.ts` reads -1 when there is no
                // rank title, so a born member draws no share of the house's
                // chambers. No `sect_members` row is written either, which is
                // what leaves the ladder in front of them: being taken ON is
                // `join`, and `join` checks the house's own floor.
                //
                // Set only where the house's own roll carries them - a lineage
                // for its own children, or a house that took somebody in. An
                // apex sect member's child gets nothing here, because an apex
                // is joined rather than born into and its bar has never moved
                // for anybody.
                ...(birth.raisedInside?.onTheRoll
                    ? { sectId: birth.raisedInside.house.id }
                    : {}),
                alive: true
            });
            const run = this.repos.runs.startRun({ cultivatorId: cultivator.id, seed });
            return { cultivator: this.repos.cultivators.getById(cultivator.id)!, run };
        })();

        // What this life starts holding, in two layers that do different jobs.
        //
        // THE COUNTY first. Everybody can name the ground they grew up on and
        // the market town two days off, whoever their parents were, and that has
        // nothing to do with standing - it is what `seedStartingAwareness` and
        // `localGeographyFor` are for. Home at `known`, every other settlement in
        // the province at `placed`, the province at `placed`, provinces over the
        // border at `named`. Being able to point at the next town is not a
        // privilege a birth confers; it is the fix for a cultivator being trapped
        // in their birthplace for life, measured across seven playthroughs and
        // fatal in every one.
        //
        // It goes FIRST so that the ground somebody grew up on is written by the
        // one thing that knows what growing up somewhere means. Two writers both
        // claiming the birthplace is how home ended up at `encountered` - a place
        // somebody has been rather than a place they are from, which reads as a
        // traveller who arrived last week. The floor property comes from
        // `learnIfNew` inside the seeder rather than from the ordering, so
        // nothing is lost by running it here.
        //
        // THE BIRTH'S OWN ROWS on top. `drawBirth` decides which names a family
        // of that standing would have said in front of a child, and they are
        // written as ordinary knowledge records with ordinary stances and sources
        // - so the gate that governs every other name governs these, and a
        // Dao house birth knows more because of who raised them rather than
        // because of a special case. `learn` supersedes, so a name the county
        // only placed is still upgraded by a birth that genuinely knew it.
        this.knowledge.seedStartingAwareness(created.cultivator.id, 0, birth.place.name, null);
        for (const row of birth.knowledge) {
            this.knowledge.learn({ ...row, holderId: created.cultivator.id, onDay: 0 });
        }

        // AND THE PEOPLE. Measured on three seeds before this existed: nine to
        // fourteen places known and not one person, with thirteen, five and
        // seventeen bodies standing in the square. `company()` reports anybody
        // with no record as an ordinal and nothing else, so every person in the
        // world was a permanent stranger and the four verbs that need somebody
        // to be pointed at could not find one.
        //
        // The design owner's ruling: "you aren't dropped as a nobody, you have
        // presumably grown up in the area you are in. you at least know
        // SOMETHING to start." The blank slate was never neutrality - it was a
        // person with no past, in a setting where everybody else has one.
        //
        // It needs the world, which for the first run of a database does not
        // exist yet, so this is the call that brings it into being. Cheap on a
        // warm process, and `warmWorld` was going to do it on the next request
        // anyway.
        await this.seedTheFacesFromHome(created.cultivator, birth.origin, seed);

        // AND THE GROUND. The same ruling, applied to geography: somebody who
        // grew up here can point at the caves and the wild ground outside the
        // village. That was previously handled by `destinations` listing the
        // world's own location table without asking the gate anything, which
        // handed over dao ground and prospected finds along with the caves.
        // The knowledge is real now, and the gate is closed. Needs the world,
        // which the call above has just brought into being.
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
            // WHICH OF THE TWO WAYS OF PLAYING THIS IS, in the log rather than
            // only in a status bar. Without a key the bar read
            // "narrator anthropic/claude-opus-5 (not configured)", which is a
            // diagnostic about an environment variable and reads as a broken
            // install. It is not one: the whole game is playable here. Said in
            // both directions on purpose - a line that only appears when
            // something is missing is an apology rather than a mode.
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
     *
     * Phase 1 chooses a verb (model, validated, or deterministic parser).
     * Phase 2 runs it through the engine and writes the result.
     * Phase 3 describes what phase 2 decided.
     *
     * The state returned to the client is re-read from the database after
     * phase 2 and is not touched by phase 3.
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

        // ── RESET SURVIVES DEATH, AND HAS TO ─────────────────────────────
        //
        // `requireLiveRun` below refuses every call once the cultivator is
        // dead, and the refusal it throws ends "Begin a new run." - which was
        // then the one thing that could not be done, because ADMIN was
        // dispatched AFTER the guard. Measured: a lethal reprisal closed the
        // run and every subsequent `ADMIN reset` was answered with the death
        // notice, so testing anything past a death meant restarting the
        // process. Reset is the verb that answers that refusal, so it is read
        // before it.
        //
        // Nothing else moves up here. Arranging the world around a corpse is
        // meaningless and the guard is right to refuse it; this is the single
        // exception, and it is a run-lifecycle write rather than a world one.
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
            // ── ADMIN <VERB> IS AN ORDINARY TURN WITH ONE ANSWER PINNED ───
            //
            // Not a second execution path, and the recursion is the point:
            // everything below this line - phase 2, the crossroads, the dropped
            // clause, the world write, phase 3, the log - runs exactly as it
            // runs for a typed sentence. The ONLY difference is that phase 1 is
            // skipped, because the operator named the verb, and that no model
            // has read the line.
            //
            // What is decided inside is one question and it is named:
            // `withTheAttemptLanding` opens a context that the uncertain
            // decisions consult, every gate is left standing, and the bill is
            // whatever the verb charges. See `forcing-an-attempt-to-land.ts`.
            //
            // AND IT IS BEHIND THE SAME ONE GATE AS EVERYTHING ELSE HERE.
            // `adminAct` is what refuses when the mode is off, and the forced
            // path does not go through it - so without this line ADMIN <verb>
            // was reachable with ADMIN_MODE unset, which is the one thing this
            // whole surface may never be. Falling through rather than throwing
            // here keeps a single refusal voice: `adminAct` says it, in its own
            // words, for every admin line there is.
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

        // ── THE PLAYER IS ON THE ROSTER, AND THE SHEET IS THE SOURCE ─────
        //
        // Before phase 1, which is before any span this turn could spend. The
        // world's systems are keyed on `state.npcs` - most sharply
        // `gatherings.ts`, whose entire invitation list is drawn from it - so
        // without a row the person playing was structurally uninvitable to
        // every meeting, bout, competition and expedition the world holds.
        //
        // HERE rather than in `advanceWorld`, which is the tempting place and
        // is not sufficient: `work` spends its days through the consolidated
        // tool, which calls `advanceWorldForCultivator` itself and never passes
        // through this class's span helper. A turn is the thing every path has
        // in common.
        //
        // And a row rewritten from the `Cultivator` at the top of every turn
        // cannot drift from it: whatever the world wrote to it last turn is
        // gone, and the sheet is the only thing that can ever set a rung. See
        // `the-player-as-a-row-the-world-can-invite.ts` for the two simulation
        // passes that additionally skip it, and why those two and no others.
        this.refreshThePlayerRow(cultivator);

        // ── A QUESTION THE ENGINE LEFT OPEN IS ANSWERED FIRST ────────────
        //
        // Captured here, before anything can clear it, because BOTH answers
        // have to be findable afterwards: the two explicit ones below, and the
        // implicit one, which is every other sentence in the language. See
        // `settleAnyStandingCrossroads`.
        //
        // The two answers are matched before phase 1 rather than routed through
        // it because they are not verbs. "I sit back down" would route to
        // `cultivate` and start a FRESH sitting at the default length, which
        // would hand the player back the years they had just been asked to
        // choose about and charge them for a new stretch on top - the exact
        // double-count the clock rule forbids.
        // ── AND SO IS SOMEBODY WHO IS SWINGING AT YOU ────────────────────
        //
        // A fight the service is holding takes the sentence before phase 1, for
        // the same reason the crossroads does: these are not verbs. "I block his
        // sword" means nothing standing in an empty road and everything with a
        // blade coming at you, so it is read against the situation rather than
        // added to a table that has no situation in it.
        //
        // ── AND A SENTENCE THE FIGHT HAS NO ANSWER FOR IS NOT A REFUSAL ──
        //
        // This is the more important half. `whatTheySaidInTheFight` returns null
        // for "I cultivate", "I look around", "I buy a pill" - and the answer is
        // NOT to tell the player no. The round lands on them, and then the thing
        // they asked for happens. Anything else is banning: a player may attempt
        // anything, and standing in a fight does not make that untrue. It is
        // simply a very poor moment to read a wall.
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

        // ── AND SO IS "WHICH OF THOSE TWO FIRST" ─────────────────────────
        //
        // Read and cleared here, before phase 1, for the same reason the
        // crossroads is: the answer is not a verb. It stands for exactly one
        // turn and any other sentence is an ordinary turn, so clearing it
        // unconditionally is the whole of its lifetime management - a player who
        // said something else has not answered, and nothing is owed to them.
        const asked = theQuestionStillStands(this.whichComesFirst, run.id, cultivator.id)
            ? this.whichComesFirst
            : null;
        this.whichComesFirst = null;
        const picked = asked === null ? null : whichOneTheyChose(trimmed, asked);

        // ── AND THE TURN BEFORE THIS ONE, WHICH IS ALL THERE IS ──────────
        //
        // Captured and CLEARED here, before anything can add to it, which is
        // the whole of its lifetime management: the memory is one turn deep, it
        // is replaced at the bottom of this method, and a turn that never gets
        // there leaves nothing behind. `theLastTurnStillStands` additionally
        // refuses a record that is two turns old, because a turn that threw
        // could otherwise leave one wearing the clothes of a fresh one.
        //
        // Two things read it and they read it for different reasons. The
        // deterministic path below resolves "keep at it" and "the cheaper one"
        // against it with no model in the room, because the vocabulary is
        // closed and the list is one list, and the bottom reading tiers are a
        // shipping mode. Phase 1 is additionally SHOWN it, as one labelled
        // block composed fresh and thrown away - information, never authority.
        const before = theLastTurnStillStands(
            this.lastTurn, run.id, cultivator.id, run.turn
        ) ? this.lastTurn : null;
        this.lastTurn = null;
        this.ranThisTurn = [];
        this.namedThisTurn = [];

        // ── "KEEP AT IT" IS A VERB THE PLAYER ALREADY SAID ───────────────
        //
        // Read before phase 1 and not by it, for the same reason the crossroads
        // answer is: it is not a verb, and the act it means is one the player
        // themselves ran a turn ago rather than one anything inferred. That
        // ordering is also what makes the danger check unnecessary here rather
        // than skipped - there is no model in this reading, so "do it again"
        // after an attack is a second attack at every reading tier, produced
        // from the player's own previous turn. It costs exactly what saying it
        // out in full costs; see `last-turn-memory.ts`.
        const carriesOn = fightAnswer === null && picked === null
            && forced === null && answered === null
            ? theSentenceCarriesOn(trimmed)
            : null;
        const carryingOn = carriesOn === null || before === null
            ? null
            : carryingOnFromTheLastTurn(before, trimmed);

        // ── phase 1 ──
        //
        // Skipped outright when ADMIN named the verb. The rest of the sentence
        // still goes through the ordinary deterministic parser, so the target,
        // the intent, the topic and the duration are read the way they are read
        // for anybody - what the operator settled is WHICH VERB, and that is
        // the one thing phase 1 exists to answer.
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
                    awareness: this.awarenessOf(cultivator)
                }),
                describeTheLastTurn(before)
            );

        // ── AND "THAT ONE" MEANS ONE OF THE THINGS YOU WERE JUST SHOWN ───
        //
        // After phase 1 rather than inside it, so it holds at every reading
        // tier: the model is TOLD the list and will usually name the thing
        // outright, and a reader that hands back the player's demonstrative
        // instead - which is what both deterministic tiers do, and what a model
        // did on the played turn this exists for - gets it substituted here.
        // Only a phrase that names nothing on its own is touched, and only from
        // a list the ENGINE printed last turn.
        const resolved = before === null || carryingOn !== null
            ? null
            : resolvingAgainstTheLastTurn(plan, before, trimmed);
        const theTurnsPlan: PlanWithSteps = resolved && resolved.resolutions.length > 0
            ? resolved.plan
            : plan;

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

        // ── AND THE PART OF THE SENTENCE THAT DID NOT RUN ────────────────
        //
        // One turn is one action, and that stays true: nothing below runs a
        // second verb. What it does is SAY that another verb was there, which
        // is the whole defect - `I buy a month of rations and eat` bought and
        // did not eat, and said nothing about the eating, so the player learned
        // it from a hunger banner that would not go away.
        //
        // It runs in both directions, and the other one is the worse of the
        // two: the parser takes whichever verb its table reaches first, so
        // `I gather herbs and go to the market` browses a board and the
        // gathering disappears. The expensive half is the half that goes.
        //
        // Here rather than inside `execute` because it is a fact about the
        // sentence and not about any one verb: put in one branch it would cover
        // one verb, and the next verb somebody adds would drop clauses again.
        //
        // AND IT IS OFF WHEN THE TURN RAN A PLAN. This helper answers one
        // question - "one verb ran; was there a second one in the sentence?" -
        // and a turn that ran three verbs has already answered it, in the
        // affirmative, by running them. Left on, it reports a clause a LATER
        // STEP EXECUTED as though it had been declined, which is worse than the
        // silence it was written to replace: the whole value of the honest
        // report is that a player can trust it.
        //
        // AND IT IS OFF WHEN THE TWO CLAUSES ARE ONE ACT. Played, against a
        // local model, and it is the worst shape this report can take:
        //
        //   > I go into seclusion for a year and gather qi
        //   "Ran seclude. Not run: 'gather qi' [...] which on its own reads as
        //    cultivate."
        //
        // Qi went 0 to 6 over that year. Seclusion IS gathering qi - `cultivate`
        // and `seclude` are two names for one handler, `runSeclusion`, and the
        // player was told that the thing that demonstrably happened had not
        // happened. That is worse than a wrong number, because this line is
        // precisely the thing the player is now being asked to trust.
        //
        // `SAME_ACT_UNDER_TWO_NAMES` is a closed table of verb pairs that reach
        // one handler, not a similarity test. Two verbs that resolve to the same
        // engine call cannot be two things a turn had to choose between, and
        // that is a fact about the dispatch above rather than about the words.
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

        // ── AND THIS TURN BECOMES THE ONE THE NEXT ONE MAY REFER TO ──────
        //
        // Recorded LAST, after everything that could have added to either list,
        // and it replaces rather than appends: the memory is exactly one turn
        // deep by construction rather than by being trimmed. `onTurn` is the
        // counter as this turn leaves it, and the next turn reads that same
        // number - so a turn taken by any other door moves the counter past it
        // and the memory lapses on its own. See `last-turn-memory.ts`.
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

        // ── AND IF THIS TURN KILLED THEM, THE WORLD IS TOLD ──────────────
        //
        // AFTER the refresh above, and that ordering is load-bearing rather
        // than tidy: the refresh writes the world row from the sheet, and the
        // settlement marks that row dead. The other way round, the refresh
        // would resurrect it inside the same turn. `standInTheWorld` no longer
        // writes `alive` over a dead sheet either, so this is belt and braces
        // and both halves are wanted.
        //
        // ONE PLACE, at the end of the turn, because six separate lines in
        // this package can end a life - the two skips, the crossing, the
        // reprisal, the fight and the alchemy path - and a settlement per
        // death site is six chances to forget the seventh. It runs at most
        // once per run: `requireLiveRun` refuses every later act.
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

        // ── EVERYTHING THIS TURN SHOWED, WRITTEN DOWN ────────────────────
        //
        // THE ONE WRITER. Producers declare what they put in front of the
        // player on `execution.perceived`; this is where it becomes a row, in
        // phase 2, before anything is narrated and before phase 3 is handed a
        // licence to mention any of it.
        //
        // It replaces remembering. Knowledge used to be written by whoever
        // happened to be holding the player - fourteen `noteEncounter` call
        // sites across six files - and a verb that forgot was indistinguishable
        // from a verb that decided not to. That is how a house named to the
        // player three times in one session was still `unaware` when they tried
        // to ask it for something.
        //
        // It widens nothing. Every gate upstream still rules; this records what
        // they let through, at a stage the source has already clamped.
        for (const perceived of execution.perceived ?? []) {
            const learned = recordPerception(this.knowledge, after.cultivator, after.run, perceived);
            if (learned.length > 0) {
                execution.facts.structure.push(
                    `shown this turn: ${learned.map(name => name.name).join(', ')} `
                    + `(${perceived.sourceKind}). ${perceived.note}`
                );
            }
        }

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

        // ── AND A FORCED TURN SAYS SO, ABOVE THE STORY ────────────────────
        //
        // Written here and not in `adminAct`, because a forced turn IS an
        // ordinary turn - everything above ran for it exactly as it runs for a
        // typed sentence, and the only thing left to do is say what was
        // arranged. The receipt goes in as the ENGINE's own words, the way
        // every other admin call is filed, and the narration underneath it is
        // untouched: the world as it now stands, told by whichever narrator
        // this process was started with.
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
     *
     * Two jobs and they are the same job. It TELLS the operator which of the
     * two things happened - the roll was decided, or the world refused before
     * any roll arose - and it RECORDS it, because the audit rows are the admin
     * flag and a run holding an arranged success must never reach the death
     * ledger or the balance data as though it had earned one.
     *
     * The refusal half is the useful half, and the design owner asked for it in
     * these terms: *"it should say no, you can do it by setting your realm to
     * 29 and your age."* So it names every route it has for the refusal that
     * actually happened, keyed on that refusal's own identity - and where there
     * is no route it says that flatly, because a helpful-sounding alternative
     * to an impossibility is worse than a plain no.
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

        // ── WHAT WAS DECIDED IS A FACT ABOUT THE DECISIONS, NOT THE VERB ──
        //
        // This used to read `execution.outcome` and nothing else, and it was
        // wrong in a way a played transcript showed plainly: a forced theft
        // that LANDED - the money moved, the reprisal fired - was reported as
        // "Nothing was decided. The world refused before any uncertain question
        // arose." A verb can file a refusal on its way through and still have
        // reached the roll this was pointed at, and one that spends its turn
        // being answered by an injured Nascent Soul is exactly such a verb.
        //
        // So the receipt asks the CONTEXT what it was actually asked, which is
        // the only thing that knows. A refusal only means "nothing was decided"
        // when nothing was in fact decided.
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
        const execution = this.strikeBarrier(run, cultivator, ambient);
        if (!execution.breakthrough) throw new GameError('The engine produced no breakthrough result.', 500);

        const after = this.currentRun();
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
     *
     * Shared so every admin endpoint refuses in the same words and with the
     * same status. It does not guard state - nothing behind it writes - it
     * guards *disclosure*: these surfaces state plainly what the world spends
     * a great deal of effort keeping unstated.
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
     *
     * Gated on ADMIN mode, which per context.md lifts content gates and never
     * the authority rule: this endpoint reads rows and adds display names. It
     * has no write path, so there is nothing here for ADMIN to be dangerous
     * with.
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
     *
     * Belief, model and measurement side by side, plus what this particular
     * world contains today. Admin only, and a balance instrument rather than a
     * play surface: it answers "is the ladder doing what we think it does" and
     * nothing a player would ever ask.
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
     *
     * Rebuilt from the run's seed and caught up to the run's clock by the
     * owning module, so this is cheap on a warm process and correct on a cold
     * one. Null when there is no run yet, or when the world is switched off.
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
     *
     * Exhaustive over the closed set by construction: adding a name to
     * ACTION_NAMES without adding a case here is a compile error, which is the
     * point of the enum being closed in the first place.
     *
     * Read the `interact` and `move` branches with one thing in mind: neither
     * of them looks at `action.intent` to decide anything. The intent is passed
     * to the facts so the narrator can say what was attempted, and that is all
     * it is ever allowed to do. An outcome selected by the word the player
     * typed would be an outcome the engine did not compute.
     */
    /**
     * A sentence that contained a plan, carried out in the order it was said.
     *
     * ── WHY THIS IS HERE AND WHY IT IS THIS SHORT ────────────────────────
     *
     * The law - what may run, how many, and what happens when two acts both
     * cost - is `a-sentence-can-be-more-than-one-call.ts` and is pure. What
     * `game.ts` owns is the only thing it can own: **running each step against
     * the live world**, re-reading the run and the cultivator between steps so
     * that a step sees what the step before it left. That is the difference
     * between a sequence and a batch, and it is the whole reason the design
     * owner's example works:
     *
     *   > I take his purse, hand it to the man beside him, and walk away
     *
     * Three acts the game already has, and the framing falls out of the ORDER
     * rather than out of a `frame` verb. Nobody composed it; the player did.
     *
     * ── AND A PLAN THAT STOPS HALFWAY IS ONE OF THE ANSWERS ──────────────
     *
     * Caught taking it, caught passing it, or gone with the purse in another
     * man's hand: three different worlds out of one sentence, and none of them
     * needs a branch. When the world stops a step, the plan stops there and the
     * account says so in the world's terms - *the theft did not come off, so
     * there was nothing to hand over* - rather than in the executor's.
     *
     * ── THE SINGLE-STEP PATH IS THE OLD PATH, UNTOUCHED ──────────────────
     *
     * One step returns `this.execute(...)` with the same arguments the same way
     * it always did. Both deterministic tiers produce exactly one step, so no
     * draw order anywhere moves for a player with no model configured - which
     * is the determinism claim, and it is structural rather than measured.
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

            // ── A CLAUSE THAT ONLY CHOOSES RUNS NO VERB ─────────────────
            //
            // "pick the strongest one" is a selection from the rows the turn is
            // already holding, not an act against anybody, so it resolves a
            // NAME and spends nothing. What it picks becomes what the clauses
            // after it are talking about, which is the whole reason the third
            // clause of that sentence used to reach a placeholder.
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

            // ── TWO WAYS A PLAN ENDS EARLY, AND THEY ARE DIFFERENT ───
            //
            // The step did not come off, or it came off and the run did not
            // survive it. Told apart because the player has to be able to tell
            // them apart: see `howTheStepWent`, where a live turn reported a
            // theft that plainly landed as one that "did not come off".
            //
            // `notReached` is only what THIS TURN was going to run. Steps held
            // by the budget were never this turn's and are not collateral of
            // anything - reporting them here is what made a journey the player
            // had sequenced for later read as a casualty of the theft.
            const stillAlive = this.currentRun().cultivator.alive;
            if (went === 'did_not_come_off' || !stillAlive) {
                stoppedOn = step;
                stoppedHavingLanded = went !== 'did_not_come_off';
                notReached = budget.toRun.slice(i + 1);
                break;
            }
        }

        // ── TWO COSTLY ACTS: ASK, AND SAY IT EXACTLY ONCE ────────────
        //
        // Raised AFTER the free reads have run, so the question can name
        // whoever they resolved. The turn still has to BE a turn, so where
        // nothing ran at all the question is itself the free read - and in that
        // case the wording is already the whole of `facts.prose`, so appending
        // it again is what printed the same ruling twice on a played turn.
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
                // double-printed ruling a played turn caught. What it still
                // needs is the `required` channel: measured, a model handed
                // nothing but this question wrote "You reach for Cao Antao's
                // purse and press it into Shen Liefeng's hand. Then you walk
                // away." - three acts, none of which happened, off a turn whose
                // only fact was that it was ASKING. `withRequiredLines` appends
                // what the prose left out, at both front doors, so the question
                // reaches the player whatever the narrator felt like writing.
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
        //
        // The executor cannot report a step it was never given, so without this
        // the narrator is the only thing in the turn that knows the clause
        // existed - and measured, it filled the gap: handed a turn whose only
        // ruling was a refusal, a model wrote "You take the purse from Cao Antao
        // and press it into Shen Liefeng's hand". The same treatment a clause
        // the budget declined already gets.
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
     *
     * ── IT NAMES ONLY PEOPLE THE PLAYER COULD ALREADY NAME ───────────────
     *
     * The discovery gate, applied to a comparison. The candidates are the faces
     * this cultivator has a record for and nobody else, so a choice can never
     * be the thing that hands over a name - which it would be, silently and
     * every time, if it sorted the whole square. Where the deepest person
     * present is a stranger the choice lands on the deepest person they can
     * NAME, and the sentence says so, which is honest and discloses nothing.
     *
     * ── AND ONLY OVER FIELDS THIS TURN ACTUALLY HOLDS ROWS FOR ───────────
     *
     * A rung and an age are on the roster row. A distance and a price are not
     * rows this method has, and it returns null for them rather than guessing -
     * the refusal names what would work, which is the standard every other
     * refusal in this package is held to.
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
     *
     * ── SAME ROWS THE READ PRINTS, SAME GATE ────────────────────────────
     *
     * A projection of this cultivator's own place awareness onto the catalog,
     * which is the join `destinations` opens with and is the only part of it a
     * choice needs - roads, ruins, occupancy and province ceilings are that
     * read's business and none of them decides which ground is thickest.
     *
     * The gate is the same one everywhere else in this package: a place the
     * player has no record for is not a candidate, so a choice can never be the
     * thing that hands over a name. `sealed_vein` is deliberately absent from
     * the ordering - it is not reachable by travelling, so offering it as the
     * answer to "somewhere the air is thick" would be naming a door rather than
     * a destination.
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
        //
        // `existence.ts` has modelled this the whole time - `canExistBeyondTheLid`
        // and `evaluateLidTransit`, which prices a descent at nine tribulation
        // strikes - but nothing in this layer consulted it, so a True Immortal
        // could look over a market stall and hire themselves out as a porter for
        // twenty-nine spirit stones. The mortal world is not somewhere they are.
        // Coming down is possible and it is the most expensive thing they can
        // do; it is not the default state of the run.
        // ── A True Immortal is not standing in the province any more ──
        //
        // This used to be a flat refusal and the refusal was correct and empty:
        // "Not from here", every time, with nothing on the other side of it.
        // Played cold at ordinal 46 that reads as the game ending rather than
        // as the game moving, which is exactly backwards - the layer above the
        // Lid is one of the most complete systems in the project and none of it
        // was reachable.
        //
        // The sentence a player typed HAS answers up here. There are two, they
        // are the two the setting has always described, and both resolve
        // through machinery that already exists: send something down a line
        // somebody is holding, or go yourself at nine strikes for ten to
        // fifteen breaths. So the mortal-world verbs are RE-OFFERED rather than
        // refused, and the two verbs that carry them are in the closed set.
        if (canExistBeyondTheLid(cultivator) && MORTAL_WORLD_ACTIONS.includes(action.action)) {
            return this.aboveTheLid(run, cultivator, action.action);
        }

        switch (action.action) {
            // `durationAskedFor` is the UNCLAMPED span in the sentence.
            // `action.days` has already been through `parseDuration`, which
            // silently caps at MAX_CULTIVATION_DAYS - so "I cultivate for
            // 100000 years" arrived here as 36500 and the player was told
            // "Seclusion of 100 years was intended", which is the engine
            // reporting its own ceiling as somebody else's intention. Carried
            // so the account can say what was asked and what was capped.
            case 'cultivate':
                return this.runSeclusion(
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

            case 'coerce':
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
                // ── AND A PROBATIONER IS NOT SOMEBODY WHO SERVES NO HOUSE ──
                //
                // Found by playing. The sheet reads whose roll somebody is on
                // off `cultivator.sectId`, which a probationer correctly does
                // not have - so a person in year twelve of an apex's intake
                // asked "where do I stand" and was told "Serves no house.
                // Nothing is owed to them and nothing is asked of them." Both
                // sentences are true of a probationer and together they are
                // the wrong answer, because the interesting fact about that
                // person is the one they omit.
                //
                // Appended rather than threaded into `standingLines`: that
                // function is pure and has no database, and the probation is a
                // flag rather than a column on the row.
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
                // "what are my options" is understood as a question about how
                // the manual in your hands could go further. That is a good
                // read and it is the wrong one for somebody who has just
                // started and is asking what the game is - measured in a real
                // run, where the sentence answered about the manual only. The
                // two are told apart by whether the sentence is about a book;
                // anything that mentions one keeps the answer it had.
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

                // The cheapest action available, and the whole reason it is in
                // the closed set: no time, no food, no roll, no death. A player
                // may type something ambiguous a hundred times and lose nothing
                // but a moment.
                //
                // AND IT TEACHES. A refusal that names its cause is the rule
                // this project already holds; a refusal with nothing after it
                // is a dead end, and this is the single most common thing a new
                // player sees. So the engine says what KINDS of thing work
                // standing here - the two or three that are live in this state,
                // from the same source `help` reads - rather than leaving them
                // to guess again. Nothing is unlocked and nothing is cheapened:
                // the sentence they typed still did nothing at all.
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
                // Looking round on the far side of the Lid is a different read
                // from looking round in a province, and it used to be the same
                // one. What that produced, found by playing at 46: the ambient
                // description of a layer whose qi density is 1.0 by definition,
                // a Dao house's practice observed among people who are not
                // there, and two names overheard through a wall in a province
                // on the other side of a hole. Every one of those is a mortal
                // -layer read applied to somebody who has left it.
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
                //
                // The question a player asks the moment they learn occupancy
                // matters, and it reached nothing at all: "how crowded is it
                // here" did not resolve into any action in the set. Answered
                // off the same `GroundConditions` the rate is computed from,
                // and free, because looking around you costs nothing.
                // WHAT MY STANDING BUYS ME ON MY HOUSE'S GROUND.
                //
                // "I ask for time on the vein", "where can I cultivate in the
                // sect" and "I go to the sect cultivation chamber" all reached
                // nothing - the last one refused as a name that is not a place,
                // which is true and useless, because the chamber is real and
                // the player's standing already entitles them to days in it.
                if (action.intent === 'ground_time') {
                    this.atHand = this.atHand ?? await this.loadWorld();
                    return this.freeAction(run, 'look', factsForGroundTime(
                        cultivator,
                        this.sectNameFor(cultivator),
                        this.groundEntitlement(cultivator)
                    ));
                }

                // WHO ANSWERS FOR THIS GROUND, ASKED FOR DELIBERATELY.
                //
                // The volunteer at the foot of this case speaks only where
                // nobody holds the ground. Somebody who ASKED is owed the
                // answer whichever of the four readings it is - including "the
                // record does not say", which is the one that used to be priced
                // as a vacuum.
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
                //
                // A house that needs bodies advertises, and a house that does
                // not need them has no reason to. So a wall is a discovery
                // channel that runs the opposite way to every other one in the
                // game: instead of the player having to find a name, the houses
                // that are short come looking. Free, because reading a wall is
                // free everywhere; the price is at the door, where the bar on
                // the paper is the real bar.
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
                // ── AND WHETHER ANYTHING IS WRONG WITH THIS GROUND ───────
                //
                // The second caller `ground-status-lines.ts` was extracted for,
                // and it had never been wired: the module sat with no caller in
                // `src/` while `investigate` carried a verbatim copy. Its own
                // header holds the measurement - standing on the seat of a live
                // war, with `stops: ['passage']`, `priceMultiplier: 2` and
                // `dangerDelta: 0.5` all running, `I look around` ended "It is
                // an ordinary day and it intends to stay one."
                //
                // Both verbs read the identical module now, which is the point:
                // a famine must not be something a player learns only by
                // guessing the other verb.
                //
                // `standingHere` is true by construction here. Looking round IS
                // the ground under your own feet, and that is the floor case
                // the stage rule exists for.
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
                // ── AND WHO ANSWERS FOR IT, WHERE NOBODY DOES ────────────
                //
                // The trust term has been moving the player's odds off this
                // since it landed and the game would not say it: both callers
                // of `whoHoldsTheGround` were inside the NPC simulation. A
                // fresh run opens at the Meet on The Blown Ground, so this is
                // turn-one ground.
                //
                // Volunteered only where nobody holds it. An absent register is
                // a fact about paper, not about the world, and it would print
                // over most of the map: measured on a seeded world, 113 of 435
                // people stand on ground the record does not describe. Asked
                // for deliberately, all four readings answer - `whoAnswersHere`
                // in `situated-reads.ts`.
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

                    // ── AND BEING HERE IS HEARING OF THEM ────────────
                    //
                    // FOUND BY PLAYING, standing inside the Azure Cloud
                    // Pavilion's own compound: "can I join this sect?" -
                    // never the name, a deictic - resolved to the Pavilion
                    // and was refused with "Not a name you hold", because
                    // the knowledge table had no row and NOTHING WROTE ONE
                    // FOR BEING THERE.
                    //
                    // The guard that refused is right and stays exactly as
                    // it is - naming a house off a listing must not enrol
                    // anybody. What changes is that a player standing in
                    // somebody's courtyard genuinely does hold the name, so
                    // it stops firing on its own accord rather than being
                    // given an exception.
                    //
                    // `named` and no further: `being-on-their-ground.ts`
                    // says why it grants below its own source ceiling.
                    // DECLARED, NOT WRITTEN. This was the first producer to
                    // move onto the seam, and it is the one that proved the
                    // gap: it used to call `learnIfNew` here, which worked and
                    // meant every future perception had to remember to do the
                    // same. The rule it grants is unchanged - `named` from
                    // `witnessed`, deliberately below the source ceiling,
                    // because being somewhere tells you whose ground it is and
                    // nothing about their politics.
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
                // ── AND WHO IN THE SQUARE IS TRADING ─────────────────────
                //
                // The owner's complaint in one sentence: *being somewhere is so
                // limiting if you know nothing.* A look named three people and
                // said nothing about the fact that one of them was carrying a
                // book they would sell, so the whole of the ordinary business
                // of a settlement was invisible to somebody with no vocabulary.
                //
                // Gated on the same signal as the wall above, and for the same
                // reason: `whatIsBeingOfferedHere` grants the seller's name
                // through `learnIfNew`, so a seller already known writes
                // nothing and is dropped here without anything having to
                // remember that this player has stood here before. Standing in
                // one market town for a season does not reprint the offer.
                //
                // ONE LINE, not the block. A look is a look; the board is where
                // the asks are read out, and the sentence that gets there is
                // named rather than left to be guessed.
                //
                // NO NAMES, AND NOTHING LEARNED. Seeing somebody is not knowing
                // them, and a LOOK is not a source a name may arrive through -
                // `presence.test.ts` guards exactly that, and the first version
                // of this line broke it by handing over four. What a look can
                // honestly report is the SHAPE: somebody in this square is
                // hawking something, and the cheapest of it is going for this
                // much. Who they are is what walking over to them buys, and the
                // board is where the name is granted, through the ordinary gate.
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

    // ─────────────────────────────────────────────────────────────────────
    // A WORD GIVEN, CARRIED, OR NOT KEPT
    //
    // The oath contract shape was complete and had no player path. A house
    // could put one on somebody - `whatTheHouseDoesAboutIt` writes an indenture
    // when it catches you - and nobody could swear one, be told what they were
    // carrying, or break one.
    //
    // NOTHING HERE IS NEW MACHINERY. `grudges.ts` has carried `kind: 'oath'`
    // and every cause on it since it was written; `what-an-indenture-...` says
    // what a term is and who witnesses it; `whatWalkingOutOfItCosts` prices
    // walking away and was written for exactly this. The one rule the whole
    // section is built on is the design's own, from `faction-character.ts` on
    // the House of the Bound Word: *a broken oath is structural rather than
    // punitive - removing it removes some of the person.* So nothing below
    // prevents anybody leaving. It says what leaving is.
    // ─────────────────────────────────────────────────────────────────────

    /**
     * What kind of word this is, out of the causes the ledger already carries.
     *
     * A CLOSED SET, read off the sentence, and nothing anywhere branches on it
     * to decide an outcome - the weight, the witness and what breaking it costs
     * are identical whichever of these it is. It is the label the record
     * carries so that somebody reading the ledger in eighty years can tell a
     * brotherhood from a silence, which is exactly what `grudges.ts` keeps the
     * causes for.
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

        // ── WHO PUTS THEIR NAME TO IT ────────────────────────────────────
        //
        // The premier oathwright is not universally available and the reason is
        // its own founding oath, which it has honoured at the cost of a fortune
        // it can see and cannot touch. A house that cannot get the best witness
        // uses a lesser one, and the person held under that oath is held by
        // something correspondingly easier to argue with. Nothing here scores
        // that; it is a fact carried on the record.
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
            // A witnessed word with nothing behind it. The heavier weights
            // belong to an oath that CLOSES something - `settleItWithABinding`
            // writes one exactly as heavy as the account it discharged, on the
            // argument that a lighter oath would be cheaper to break than what
            // it replaced. Nothing is being discharged here, so nothing licenses
            // a heavier row, and `slight` is the ledger's word for an
            // unpleasantness rather than for a promise.
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


    // ── ONE TARGET RESOLVER, FOR EVERY VERB AIMED AT A PERSON ────────────
    //
    // The owner flagged long ago that spar, bribe, threaten, favour and
    // introduce should share one of these, and the symptom of not having one
    // was measurable: three phrasings of the same request reached three
    // different lookups, and a fourth resolved a party called
    //
    //   "Han Peiru with 60 spirit stones to introduce me to the elder"
    //
    // against a roster of two-word names and matched nobody. `interact` and
    // `request` both come through the two methods below, so a name that
    // resolves for one resolves for the other and a refusal reads the same
    // whichever verb produced it.

    /**
     * The party a sentence is aimed at: a pointed-at face, a named person, or a
     * faction. Null when it is none of those.
     *
     * `pointedAt` is passed in rather than recomputed because the caller has
     * usually already needed it to decide whether a question was being asked of
     * somebody standing there.
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
     *
     * The blank look is right about the NAME and says nothing about the room,
     * so every failed approach read identically whatever was attempted and
     * whoever was standing there. Played live, "I bribe the gate guard" in a
     * town with no gate guard came back "a sentence with a hole in it" - and a
     * reviewer comparing it against a working seduction concluded the leverage
     * mapping was missing. It was not: the verb parsed correctly and the person
     * did not exist. A refusal that cannot be told apart from a broken feature
     * is a bad refusal.
     *
     * Naming who is visibly present leaks nothing - `look` already lists exactly
     * these people - and it is the difference between a dead end and a next
     * move. `blankLook`'s own rule stands: it still never confirms whether the
     * NAME exists, and this adds no name the player could not already see by
     * looking up.
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
     *
     * Two halves, and the split is the design. The engine CAN state, from real
     * rows, who this party is and what stands between them; it CANNOT yet
     * resolve what came of the approach, because the social layer that would
     * decide it - relationships, obligations, what each side knows and wants -
     * is not something this layer may invent.
     *
     * So the attempt is recorded and the facts are reported, and the result is
     * marked unresolved rather than narrated. "I try to sneak into the sect" is
     * an attempt, not an infiltration.
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
        const query = (target ?? '').trim();

        // ── A QUESTION WITH WEIGHT BEHIND IT IS NOT A QUESTION ───────────
        //
        //   "you can DEMAND knowledge. whether it succeeds is whether people
        //    respect you - either via power or something else."
        //
        // Every one of the `askAround` short-circuits below took a topic to the
        // polite path whatever was behind it, so "I question the elder about
        // the Nine Peaks" and "I press him about the Sill" - attempt intents
        // with real topics, both of which the parser produces today - were
        // silently downgraded to requests and answered by the other party's
        // willingness alone. The player's standing, the ledger, what they are
        // owed and every other term the pressure model prices had no bearing
        // whatever on whether they found anything out.
        //
        // Asked FIRST, ahead of all three, because being downgraded is the
        // defect and each of those branches is one of the ways it happened.
        //
        // Routed on the set this file already means by "an attempt to move
        // somebody". Nothing here reads `intent` to decide an OUTCOME: what
        // settles a demand is `resolveAttempt`, the same call a bribe and a
        // threat go through, and there is no second resolver on this path.
        // See `making-somebody-tell-you.ts`.
        if (topic && topic.length >= 2 && ATTEMPT_INTENTS.has(intent)) {
            // ── A NAME IS NOT A DESCRIPTION, AND THE DIFFERENCE IS THE WHOLE
            //    GUARD ──
            //
            // Caught by `misparse.test.ts` on the first build of this branch,
            // which is the test that exists for exactly this mistake: "I ask
            // the Hollow Court about the crossing", from somebody who has never
            // heard of the Court, got re-aimed at whoever was standing nearest.
            // A name that resolves to nothing must NOT substitute a bystander -
            // the refusal below owns that case and has to keep owning it.
            //
            // So the same three shapes the polite path already separates, on
            // the same predicate: nothing said, a POINTING phrase, or a name.
            // Only the first two may reach for whoever is at hand.
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
        // that there is a person in front of the player, and a person can be
        // asked something.
        //
        // A NAME that resolves to nothing is the opposite case and used to take
        // the same branch, which is the defect a live from-scratch run caught.
        // "I ask the Hollow Court for an immortal pill", typed at ordinal 0 by
        // somebody who has never heard of the Hollow Court, threw the Court away
        // and put the question to whoever was standing nearest - a Qi
        // Condensation clerk - and came back byte-identical to an unrelated
        // question asked of the same person. The addressee was silently
        // replaced, and the player had no way to see it.
        //
        // `POINTING` is the closed set of phrases that describe somebody rather
        // than naming them, and it is the right discriminator here for the same
        // reason it is the right one in `somebodyAtHand`: everything in it is a
        // role, a pronoun or a demonstrative, so a name can never land in it.
        // Everything else falls through to the refusal below - which is
        // deliberately the SAME refusal an invented name gets, so an unheard
        // faction and a made-up one stay indistinguishable.
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

        // They may say something they assume the player already knows. The
        // engine picks it and writes it down; the narrator only gets a licence
        // to have them say it.
        //
        // ── NOT WHILE YOU ARE ROBBING THEM ───────────────────────────────
        //
        // Played, on the second theft off the same person:
        //
        //   "Fang Shutao answers being robbed in the body. Shen Wu does not
        //    walk away from it whole.
        //    Fang Shutao mentions The Fired Terraces the way you would mention
        //    a bridge - it is out in The Quiet Marches, and people who have
        //    business with it go and stand on it."
        //
        // The person who had just broken a meridian handed over a place name,
        // and `this.hear` WROTE THE KNOWLEDGE ROW for it - so a hostile
        // encounter was a reliable way to farm the map. Hearsay is somebody
        // talking to you as though you were somebody they talk to; being robbed
        // is the state in which nobody is.
        //
        // Gated on `WRONG_BEHIND_INTENT` rather than on a list of verbs written
        // here: it is the same closed table the reprisal and the ledger read,
        // so "was that a wrong" continues to have one answer in this file and
        // not three. And it is read BEFORE the offer, because `hear` writes as
        // it picks - a hearing suppressed afterwards would already be on the
        // knowledge table.
        const spoken = party.kind === 'cultivator' && WRONG_BEHIND_INTENT[intent] === undefined
            ? this.hear(cultivator, run, `interact:${party.id}`, party.id)
            : null;

        // ── AN ATTEMPT TO MOVE SOMEBODY, ACTUALLY RESOLVED ───────────────
        //
        // `engine/social-leverage/` is a finished pressure model - four
        // outcomes, tone, leverage, audience, concealment, patience,
        // alignment-dependent fallout, delayed discovery - with 34 passing
        // tests and no route from the player to it. NPCs ran it on each other
        // and "I bribe the gate guard" came back "They look at you the way
        // people look at a sentence with a hole in it", with the inspector
        // saying `Stated intent: bribe. Carried for the narrator; read by no
        // conditional.` That is the AGENTS.md defect named first in the file.
        //
        // The resolver reads `leverage` and never `intent`, which is what keeps
        // seduction priced by the machine that prices a purse and a threat.
        // The parser sets the leverage; nothing here translates a verb.
        if (party.kind === 'cultivator' && party.party && ATTEMPT_INTENTS.has(intent)) {
            return this.pressSomebody(
                run, cultivator, ambient, party, intent, leverage, rawInput, spoken
            );
        }

        // The player gets the honest in-fiction shape of it - an approach made,
        // nothing settled. Why it is not settled is a fact about this codebase,
        // not about the world, and it belongs on the mechanical channel.
        const unresolved =
            'Nothing is settled by it. Nobody agreed to anything, nothing changed hands, and ' +
            'no standing shifted one way or the other.';

        const facts = factsForInteraction(cultivator, party.name, intent, party.facts, unresolved);

        // ── AND THE ACT ITSELF DID NOT HAPPEN, SAID SO IT CANNOT BE DROPPED ──
        //
        // Played, as a member of the Azure Cloud Pavilion standing on its
        // ground:
        //
        //   > I take a manual from the sect library without asking
        //   "You move through the library, your hand closing around a manual.
        //    You take it without asking."
        //
        // Nothing was stolen. No object moved, nobody noticed, no ledger row.
        //
        // WHERE IT CAME FROM, MEASURED, because the obvious answer is wrong.
        // The suspicion was that `intent` leaks to phase 3 - the inspector line
        // says "Stated intent: steal. Carried for the narrator; read by no
        // conditional." It does not. `factsForInteraction` puts the label on
        // `structure`, and `composeNarrationUser` sends `lines` alone;
        // captured off a recording provider, the word "steal" appears nowhere
        // in the phase-3 message. The theft reached the narrator through
        // `THE PLAYER SAID, WORD FOR WORD`, which is the player's own sentence
        // and has to be there - asking turns on what was said.
        //
        // So the model was not leaking a field. It was filling a silence, and
        // the line above is the silence: *"Nothing is settled by it"* is a
        // sentence about SETTLEMENT, and a model reads it as "the social
        // outcome is open" rather than as "the taking did not occur". Every
        // other fix in this family landed the same way - the turn has to name
        // the thing that did not happen, in terms of the ACT.
        //
        // Not one verb's bug. Measured across every member of
        // `INTERACT_INTENTS` against a faction target: all eleven reach this
        // branch, and eight of them are `PRESSING_SOMEBODY` acts a narrator
        // will render as done because the player's own sentence says they did
        // it. Stealing from your own house is getting a real resolver
        // elsewhere; until it has one, the prose may not claim it happened.
        //
        // AND IT DENIES THE ACT RATHER THAN REPORTING A CONDITION, which is
        // the whole of why it works. The first version of this line said the
        // approach was all that happened and nothing had been settled - true,
        // and a model can narrate the hand closing and the outcome pending
        // against it without contradicting itself, which is exactly what it
        // did. `whatDidNotHappen` names the shelf, the purse, the unsaid word:
        // a fact the player's own sentence collides with. See
        // `unresolved-attempt-denials.ts` for the measurement behind that, and
        // for why all eleven intents get one rather than `steal` alone.
        //
        // On `required` rather than on `lines`: `lines` is a licence and
        // `withRequiredLines` is a duty, so a model that omits this gets it
        // appended verbatim instead of leaving the player believing they took
        // something.
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
     *
     * Half the deaths in this world are logistical, and this is the verb that
     * answers that: it is how a cultivator with an empty purse buys the food
     * that stops the starvation clock. It advances the run's own time, which is
     * why `handleWork` owns the whole thing rather than this layer approximating
     * it - the days, the wage, the rations bought and the qi not gathered while
     * bent over somebody else's field are one calculation.
     */
    private async work(
        cultivator: Cultivator,
        days: number,
        target: string | undefined,
        /**
         * `board` reads what is going and takes nothing. Anything else takes.
         *
         * The label exists because a QUESTION about work was buying a season.
         * Measured, on a fresh run: `any work going?` spent ninety days as a
         * Shipmaster, because naming no trade is deliberately read as *take any
         * work* so that "I take whatever the village will give me" is not
         * answered with a menu. Both readings are right and they are different
         * sentences; this is what tells them apart, and it is the only thing it
         * does. See `ASKING_AFTER_WORK` for which phrasings set it.
         *
         * The default is the COSTLY branch, which inverts the rule every other
         * intent-carrying verb follows, and deliberately: the bare form is what
         * somebody types when they are out of stones, and answering that with a
         * listing costs them a turn they may not have.
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
        // ── WHAT IS GOING *HERE* ─────────────────────────────────────────
        //
        // The settlement argument is not optional in practice and omitting it
        // was fatal. `findWorkForOrdinal(ordinal)` answers for the whole world
        // at that rung, so "take any work" picked the best-paying line
        // anywhere - Shipmaster, at 2,600 cash a month - and `handleWork`,
        // which DOES filter by settlement, then refused it. Eighteen
        // consecutive attempts across two towns, every one burning a turn and
        // earning nothing, each refusal listing the jobs that were on offer in
        // the same sentence that declined to give one:
        //
        //   "Nobody in Nine Peaks is hiring for Shipmaster. What is going
        //    here: Porter, Scribe, Physician (mortal), Innkeeper..."
        //
        // Work is the only income an unbacked cultivator has, so this killed
        // a run by starvation while the answer was on screen throughout.
        const here = standingOf(cultivator).settlementKind ?? undefined;
        const offered = findWorkForOrdinal(cultivator.realmOrdinal, here);
        const named = wanted.length >= 3
            ? offered.find(o => wanted.toLowerCase().includes(o.name.toLowerCase())
                || o.name.toLowerCase().includes(wanted.toLowerCase()))
            : undefined;

        // ── "take any work" means take any work ──────────────────────────
        //
        // Naming nothing lists the board, which is right for a player asking
        // what is going and wrong for the sentence this action exists to serve.
        // "I take whatever work the village will give me" is what somebody
        // types when they are out of stones and out of options, and answering
        // it with a menu costs them a turn they cannot afford - which is the
        // same class of defect as the board that could be read and not bought
        // from.
        //
        // The engine picks, not this layer: the best-paying line on the board
        // that is actually being PUT TO THEM HERE, which is
        // `findWorkForOrdinal`'s own answer narrowed by its own regard and by
        // the settlement. A tie is broken by id so the choice is reproducible.
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
     *
     * The engine's part is small and strictly bounded: work out what this
     * person could know, what they are placed to say, and what saying it would
     * cost - three separate limits, all read off rows - and then hand the
     * narrator observable behaviour. `asked.ts` holds that reasoning; this
     * method is the wiring, plus the one consequential bit: when something is
     * actually said, the knowledge record is written HERE, before the prose
     * exists. A name the player was told is a name they have, whether or not
     * the sentence describing it ever gets written.
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

        // Whether the question was about THEM. Read off the canonical topic
        // the parser emits, which is a closed lookup rather than a scan of the
        // player's prose - see `what-somebody-knows-about-themselves.ts`.
        //
        // It reaches `askedAbout` as an input rather than being decided there,
        // for the same reason `compelled` is: this file knows who is standing
        // in front of the player and that file knows what the three limits are,
        // and neither should be doing the other's job.
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

        // ── ASKING IN THE REGION GIVES IT ────────────────────────────────
        //
        // `seedSectGround` states the rule about its own location in as many
        // words: "A name you have to be given. Joining gives it; being told
        // gives it; asking in the region gives it." The first two clauses were
        // reachable and the third was not, so a player who had been told a
        // house existed - which is where every fresh cultivator starts, at
        // stage `named`, "exists somewhere out there and takes disciples" -
        // could name the house forever and never learn where its gate was.
        //
        // The consequence was not cosmetic. Every catalog figure in the world
        // stands on their house's ground, so a route that cannot reach a gate
        // cannot reach anybody worth asking, and the listing's own closing line
        // - "or you would have to walk up on your own" - described a thing the
        // game did not let you do.
        //
        // IN THE REGION is the whole of the condition, and it is doing real
        // work rather than decorating one. Where a house's gate stands is
        // ordinary local knowledge to the people who live in that province and
        // is not ordinary anywhere else, so this grants the gates around you
        // and never a map of the world. A house three provinces over stays a
        // name until somebody who knows says otherwise.
        //
        // AND IT DOES NOT HANG OFF `answer.teaches`, which is the version that
        // was written first and measured as a dead branch. `teaches` requires
        // `holdsIt` - a knowledge row on the NPC being asked - and a villager in
        // a square has no row for the house up the gorge, so a player who
        // travelled six days to the right province and asked got "agrees that it
        // is a good question, agrees that people do ask it, and has finished
        // speaking" and learned nothing. That is the correct answer about the
        // house's BUSINESS and the wrong one about the mountain it is on. This
        // is the same principle as `seedTheGroundAroundHome`: a farm boy knows
        // where the caves are, and everybody in a province knows which valley
        // the local house keeps its gate in, whether or not the particular
        // person asked has anything else to say.
        const gate = subject?.kind === 'sect' && this.atHand
            ? this.atHand.locations.find(row =>
                row.kind === 'sect_seat' && row.controllingFactionId === subject.id)
            : undefined;
        // Both provinces read off the WORLD, not off the gazetteer. `standingOf`
        // is a name match against the static places and answers with the HOME
        // region for anything it does not name - which is every sect ground,
        // every cave and every ruin. Asking somebody a question while standing
        // on a house's ground would then have been priced as though the player
        // were back where they were born, and the gate a province away would
        // have opened for free. A fallback written in ordinary English is
        // invisible; this one is a wrong answer that never looks like one.
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
        // engine channel and never reaches the player. Measured exactly that
        // way once: the grant landed, the destinations read listed the gate on
        // the next turn, and the turn that granted it said nothing at all.
        //
        // A knowledge row the player is never told about is a grant they cannot
        // use. This is the sentence that turns a house they can name into a door
        // they can walk to.
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
     *
     * Counted off the knowledge table rather than a relationship stat, because
     * there is no relationship stat and inventing one here would put a number
     * on something the design is explicit should stay a judgement. Turning up
     * twice leaves two rows; that is the whole of it.
     */
    dealingsWith(cultivator: Cultivator, otherId: string): number {
        return this.knowledge
            .awareness(cultivator.id, 'cultivator')
            .filter(row => row.id === otherId)
            .length;
    }

    /**
     * Sects: which ones would take them, and joining one.
     *
     * Two halves, decided by whether a sect was actually named. Listing is a
     * read and costs nothing; joining is one of the most consequential things
     * a low cultivator can do, and both belong to `sect_manage` rather than to
     * anything reimplemented here.
     *
     * The listing is discovery-gated on the way out. `sect_manage.list` returns
     * every sect in the campaign, which is the correct answer for a tool whose
     * caller is an operator and exactly the wrong one for a villager: a
     * starting cultivator has heard of one, and handing them the register would
     * spend a hundred turns of revelation on a single query.
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
            //
            // Split from `duty` because the board is a wall anybody may read and
            // this is a thing that was said to one person by name: no target is
            // meaningful, and there is at most one ask standing.
            //
            // Two intents rather than one with a topic, which is the same read
            // versus act split every other committing verb in this file uses.
            // `summons` asks what is outstanding and what saying no would cost,
            // and is free; `refuse` spends it. A model answering with the
            // cheaper of the two gets the price rather than the grudge.
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
                return this.fromToolResult(
                    'sect_manage.order', 'sect',
                    await handleOrder({
                        action: 'order',
                        cultivatorId: cultivator.id,
                        errand,
                        authority: intent === 'decree' ? 'delegated' : 'personal',
                        days: Math.max(1, Math.min(365, Math.round(days ?? 7)))
                    }),
                    'The order'
                );
            }
            // ── the four powers a rank buys above `order` ──
            //
            // Each takes an argument out of free text, and each has a LISTING
            // mode reached by omitting it. That is not a fallback: a player who
            // has not been told which elders there are, or what the bar costs
            // to move, cannot sensibly name one, and being shown the price is
            // the sentence before the one that spends it. So an argument that
            // does not resolve prices the act rather than guessing at it.
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
            // ── SITTING IN SOMEWHERE THAT HAS NOT TAKEN YOU ──────────────
            //
            // The one institutional verb here that is not gated on holding a
            // rung, and the reason it exists: the game tells a player
            // constantly that a teacher is one of the two ways past a manual's
            // ceiling, and then gives a nobody nobody to ask. A guest place is
            // a route somebody with no house and no name can actually walk.
            //
            // Free, and correctly so - `fromToolResult` advances no clock, and
            // being entered on a roll is a conversation rather than a span. The
            // years are spent afterwards, cultivating on what you were shown.
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
                // ── A HOUSE WHOSE NAME BEGINS "House of" IS NOT A CATEGORY ──
                //
                // `GENERIC_HOUSE_PHRASE` is unanchored at its end, so once the
                // leading article is stripped off "the House of the Narrow
                // Hour" the remainder starts with `house` and reads as the
                // whole category. Played: "can I study at the House of the
                // Narrow Hour" was answered with the listing of every house
                // that takes guests, which is the deflection failure - it looks
                // like an answer and is a reply to a question nobody asked.
                //
                // Fixed here rather than in the shared constant, because the
                // constant is doing its job elsewhere and six of the seven dao
                // houses are named this way. The category words only mean the
                // category when they are the WHOLE of what was said.
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
                // ── ANSWERING "COULD I LEAVE" WITHOUT LEAVING ────────────
                //
                // The question used to be routed to the executor and it
                // RESIGNED THE MEMBERSHIP - permanently, forfeiting the
                // contribution, to somebody who had asked what their options
                // were. It is answered here instead, and the answer has to be
                // an answer: a standing read alone says where they stand and
                // never says what the door costs.
                //
                // Every figure is `handleStanding`'s own. Nothing below
                // recomputes a forfeiture; it names the number the read
                // already returned and says what happens to it.
                const held = positionIn(this.repos, cultivator.id);
                if (topic === 'leaving') {
                    // "Seat" was the Hollow Court's own word for a rung, swept
                    // out of generic code by `652a66e` everywhere except this
                    // file, which was dirty at the time. Note WHICH sense this
                    // one was: not the head of the house, because the person
                    // asking is any member at any rung - it is the RANK sense
                    // that commit separated out, and the house's own word for
                    // the rank is already in hand as `rankTitle`. Saying it
                    // once and referring back is what removes the repetition
                    // the old sentence had.
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

        // ── A CATEGORY IS NOT A NAME, AND IT MUST NOT BECOME ONE ─────────
        //
        // Found in a played run and it is the sharpest half of the join defect.
        // "I want to join a sect" carried the word `sect` as its subject, the
        // fuzzy matcher scored it against the register, and the player was
        // enrolled in the Azure Dew Sect - one input after the game had told
        // them, correctly, that knowing a name is not an introduction and
        // somebody would have to put them in front of the house.
        //
        // The generic phrase was already recognised twenty lines below, where
        // it decides whether an unresolved name deserves a refusal. It was
        // simply asked too late, so a word that means "the whole category"
        // never reached it. Asked here, "a sect" reaches the listing, which is
        // the answer to a question about the whole set - the same rule
        // `GENERIC_PILL_PHRASE` and `GENERIC_LIBRARY_PHRASE` already follow.
        const named = query.length >= 3 && !GENERIC_HOUSE_PHRASE.test(query)
            ? resolveSect(this.repos, query, scope, cultivator.sectId)
            : null;

        if (named) {
            // ── Joining a second house is leaving the first, and it must say so ──
            //
            // `SectRepository.addMember` removes the existing membership row in
            // the same transaction, correctly - membership is exclusive - and
            // nothing anywhere told the player. A Dew Servant of the Azure Dew
            // Sect applied to the Pavilion, the Azure Dew row vanished, and the
            // narration mentioned neither the departure nor the contribution
            // that went with it.
            //
            // The right behaviour already exists one verb over. `leave` says
            // "contribution does not travel; whatever was earned here stays
            // here", which is exactly the fact being silently applied. So this
            // refuses until the player has actually left, rather than
            // duplicating the departure path and eventually disagreeing with it.
            // ── UNLESS THE HOUSE ABOVE SENT FOR THEM ─────────────────────
            //
            // The refusal below is right for a defection and wrong for a
            // recall. Somebody at the Mist or the Dew who has outrun what
            // their house can teach is on a roll the terraces keep, and going
            // back up the gorge is not walking out on anybody - the grant
            // terms say the Mist owes the Pavilion "every disciple the
            // terraces ask for, on the day they ask". Telling them they are
            // already somebody's would be the world enforcing a rule it does
            // not enforce on its own people, which is the oldest defect here.
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

            // ── AND WHAT THE HOUSE MAKES OF THEM ─────────────────────────
            //
            // The offer rule has read the house's own roster since it was
            // written and had nothing to say about the PERSON, because neither
            // door could reach a council: `sect-manage.ts` has no world handle
            // and `worldForRun` calls `catchUp`, which can advance time and is
            // therefore not a read. So a probationer the house had watched for
            // twenty years and a stranger off the road got identical offers -
            // the renown half of the design built, tested, and reachable by
            // nobody, which is this repo's most-repeated defect.
            //
            // This is the caller that has the state. `whatTheBodyWants` is the
            // same aggregate `match-verbs.ts` already runs on the same two
            // inputs: the house's roll off the world, and every open row naming
            // the player. Nothing new decides anything - the leaning comes back
            // and `entryOfferFor` bands it.
            //
            // THE LEDGER IS WHERE THE DIFFERENCE COMES FROM, and it is the
            // honest source rather than a bonus. Somebody the house carried on
            // probation has rows with its deciders - favours done, wrongs held,
            // a sponsor who staked something - and a stranger has none. Nobody
            // is given anything for having been a probationer; what they have
            // is a history, and the history is what the room reads.
            // AND THE READING HAS TO BE SUPPLIED, WHICH IS THE WHOLE TRAP.
            //
            // `whatTheBodyWants` defaults `readingOf` to `openHandednessOf` -
            // how freely a person parts with what they have, drawn off their
            // id. That is the right default for the barter and match callers
            // and it is the WRONG QUESTION here, and it does not fail loudly:
            // measured on a four-person roll, an indifferent council read
            // +0.37 purely because the head's id happened to draw high, which
            // bands as `level_with_their_own` - so every walk-up would have
            // been seated at their peers' rank and the whole 299/140/3
            // correction would have been silently undone by wiring it.
            //
            // Renown is the reading this door wants, and an unknown stranger
            // reads exactly 0 on it, which is the ordinary offer. Empty today:
            // `whatIsSaidAbout` needs tellings per decider, and the rumour
            // shape in `what-people-are-saying.ts` is a different `Told` that
            // wants an adapter. Passing it empty is honest - nobody has heard
            // of them - and it is what keeps the default from creeping in.
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

        // A house was named and it resolved to nothing, so the listing below is
        // an answer to a question nobody asked.
        //
        // Found in a live run and it is the subtle one, because the listing is
        // GOOD - "there is one name you have for this: Azure Dew Sect. Knowing a
        // name is not an introduction." A player who typed "I apply to the
        // Thousand Treasure Pavilion" read that, saw a sensible refusal, and had
        // no way to tell that the Pavilion had been silently swapped for the
        // one house they happened to know. The same rule the inheritance
        // grounds already follow: a specific name that resolves to nothing does
        // not fall through to whatever was at hand.
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
                    // ── AND THE HOUSES THAT WOULD, AND ON WHAT FOOTING ──
                    //
                    // This listing said which doors were SHUT and never which
                    // were open, so the one question somebody standing outside
                    // a house actually has - would they have me - went
                    // unanswered by the read written to answer it.
                    //
                    // Found by playing, from the other end: "if they'll have
                    // me, I'll join" enrolled the player on the spot. A
                    // conditional is now routed here instead of to the door,
                    // and this is the sentence it is routed here FOR. The rung
                    // is half the answer and not decoration - entering a house
                    // at its floor and entering it near its top are different
                    // decisions, and a player told only "yes" has to ask again.
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
                    'Knowing a name is not an introduction. Somebody would have to put you in front of them, ' +
                    'or you would have to walk up on your own.'
                ]);

        // ── AND NOBODY HAS JOINED ANYTHING, SAID SO IT CANNOT BE DROPPED ──
        //
        // Played, immediately after the listing learned to say who would take
        // you. The engine was right - no membership row, no rank, no day spent -
        // and ollama wrote:
        //
        //   > if they'll have me, I'll join
        //   "The offer was met. You are a Lamp Novice of Sweptground Temple."
        //
        // It collapsed *would seat you as Lamp Novice* into *you are a Lamp
        // Novice*, which is the very failure this whole family is about,
        // committed one layer along: a conditional read as an accomplishment.
        // The rank in the sentence is what makes it so easy - a rung named
        // beside the player reads as theirs.
        //
        // `sayThisWhateverTheNarratorDoes` rather than another line on `lines`,
        // because `lines` is a licence and `required` is a duty:
        // `withRequiredLines` appends this verbatim when the prose does not
        // already carry it, so a model that omits it cannot leave the player
        // believing they were taken on.
        //
        // Only when somebody WOULD take them. Where every door is shut there is
        // nothing to mistake for an offer, and saying it anyway would be the
        // engine talking to itself.
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
     *
     * The inverse of `recall`, and the gap it closes is the one the playtest
     * report is entirely about: the world writes rankings, refusals, duels and
     * houses opening closed ground into the ledger every year, and the only
     * route any of it had to a player was the digest - which is gated on
     * standing, arrives only after a span of days, and is a report. Nobody
     * finds out that two of the world's tallest fell out by being briefed.
     *
     * Free, and the write is the same one standing near a conversation already
     * makes: knowledge records at `whisper`, with the SPEAKER on them and the
     * rumour's own sentence as the statement. So checking a rumour is not a
     * mechanic anybody had to build - ask a second person, then ask your own
     * head, and the knowledge layer hands back both accounts without ranking
     * them.
     *
     * Phase 3 is handed what was said and by whom. It is never handed the
     * distortion; that goes to the inspector, in `structure`.
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

        // ── AND FINDING OUT IS WHAT OPENS THE ACCOUNT ────────────────────
        //
        // AGENTS.md, *a fact reaches a person, and reaching them is an event*.
        // The deed was already true and already on the record; what was missing
        // was somebody who could act on it. `hearing-of-a-wrong.ts` decides
        // whether this telling supplied that, and the row it hands back is
        // dated to today rather than to the day it happened - which is the
        // whole of the ruling, in one field.
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
     *
     * ── THE SAME JOIN, ENTERED AT THE OTHER DOOR ─────────────────────────
     *
     * `news` is this cultivator finding something out. This is them being the
     * person somebody else finds out from, and it deliberately runs through
     * `whatBeingToldOpens` rather than writing a second path into the ledger:
     * the date, the weight, the three states and the rule that the account opens
     * against whoever was NAMED are all decided there and are not re-decided
     * here. What this method contributes is the two things the join cannot know
     * - who the player meant, and whether they had any business saying it.
     *
     * ── BOTH HALVES HAVE TO BE REAL, WHICH IS WHAT MAKES IT FREE ─────────
     *
     * A person who is actually standing here, and a wrong the world priced that
     * this cultivator could point at. Neither is supplied by a sentence the
     * parser guessed at, which is the same protection `give` has and the reason
     * this verb spends no day. It can still be wrong about everything else, and
     * that is the design: the name the player used is carried through untouched
     * whether or not that person did it.
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

        // ── WHO IS BEING TOLD, AND THEY HAVE TO BE HERE ──────────────────
        //
        // The same resolution every verb aimed at a person uses, and then the
        // co-location check on top of it: a name that resolves to somebody four
        // provinces away is a person this cultivator cannot speak to, and news
        // does not travel because somebody said it into the air. `interact`'s
        // demand path makes the identical check for the identical reason.
        const pointedAt = this.somebodyAtHand(query, cultivator);
        const party = this.partyPutTo(cultivator, query, scope, pointedAt);
        const here = this.present(cultivator);
        const hearer = party && party.kind === 'cultivator'
            ? here.find(row => row.id === party.id) ?? null
            : null;
        if (hearer === null) {
            return this.nobodyByThatName(cultivator, query, scope, 'tell');
        }

        // ── AND WHO THEY ARE PUTTING IT ON ───────────────────────────────
        //
        // Read out of the claim and resolved through the same knowledge-gated
        // lookup, so a name this cultivator has never heard reaches nothing here
        // exactly as it reaches nothing anywhere else. THE RESOLUTION IS THE
        // ONLY CHECK: nothing compares the name against who actually did it, and
        // nothing may - see `hearing-of-a-wrong.ts`.
        //
        // A name that resolves to nobody does not throw the turn away. It leaves
        // the telling with no name in it, which is a true description of what
        // the hearer received, and the middle state is a real state rather than
        // a failure.
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
     *
     * Keyed on what it rests on rather than on who it is against, because the
     * row worth finding is the one with NO name on it: that is the account they
     * opened when they learned something had been done and could not say by
     * whom, and a telling that supplies a name belongs on it rather than beside
     * it.
     */
    private accountCarriedAbout(holderId: string, factId: string | null): ObligationRecord | null {
        if (factId === null) return null;
        const row = (this.db as unknown as DatabaseHandle).prepare(
            'SELECT * FROM obligations WHERE holder_id = ? AND triggering_event_id = ? '
            + "AND status = 'open' ORDER BY subject_id LIMIT 1"
        ).get(holderId, factId);
        return row ? obligationFromRow(row as ObligationRow) : null;
    }

    // ── what this cultivator is carrying ─────────────────────────────────
    //
    // Found by a rank-band sweep, and the dead sentences were at the CEILING:
    // "what do I know of Lu Sheng", "what do I know of the Hollow Court" and
    // "what is my dao" all parsed to nothing at ordinals 37-46, where the
    // ladder is finished and comprehension is the only thing still moving.
    //
    // The gate this must not weaken is the one the whole knowledge layer
    // rests on, so the defence is structural rather than careful: the query is
    // matched against THE HOLDER'S OWN ROWS and the catalogs are never
    // searched. There is no code path from a name the player typed to a name
    // they have not been told, which means no phrasing of this can teach
    // anybody anything - and it also means an unheard name and an invented one
    // come back identical, which is required. The shape of the answer must not
    // be the answer.

    /**
     * What this cultivator holds about a name, or about everything.
     *
     * `intent` selects which of the two tables is read - what they have HEARD,
     * or what they have UNDERSTOOD - on the same terms as `sect`, `look` and
     * `site`. Both are free, so unlike `site` there is no expensive default to
     * steer away from; an unrecognised label falls through to the wider read.
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
     *
     * Only for a record held at `knows` - having overheard a word in a market
     * buys the word and nothing else - and only through the same scoped
     * resolvers `investigate` uses, which are already awareness-gated. So this
     * discloses nothing a second sentence could not already have got, and a
     * record at any lower stance discloses nothing at all.
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
     *
     * Composed from `daoOf` and from the SAME `daoView` the sheet's panel is
     * built from, so the sentence and the panel cannot drift. That matters
     * more here than anywhere: at the last two rungs the ladder is shut and
     * this is the only thing still moving, so a player reading two different
     * accounts of it is reading two different accounts of their whole
     * remaining life.
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
     *
     * The trust hierarchy's strongest check, put to the character by the player.
     * `docs/world/houses/trust.md` says a house's arts are the closest thing it has to
     * an identity and that watching somebody cultivate goes straight to the
     * thing in question - and the whole of it was unaskable, with both of the
     * numbers that decide the answer sitting in the database and no question
     * pointed at them.
     *
     * Free, and never refused. Looking at what is in front of you and thinking
     * about it is always a legitimate thing to do, so this spends no day and
     * takes nothing. Like `recall` it reads the holder's own rows and the
     * catalog they can already name, so it cannot teach anybody anything they
     * had no route to.
     *
     * THE ANSWER IS GRADED BY THE TWO AXES AND NEVER FAKES CONFIDENCE. Somebody
     * with no reference is told they would not know it rather than handed a
     * "no" they have not earned; somebody with a reference and too low a rung
     * is told what it matches AND that they could not tell a good imitation.
     * At the top it is one flat sentence, and that terseness is the reward.
     *
     * "is this the Azure Cloud's art" names a house and no art, which is the
     * ordinary phrasing rather than a shortfall in it: the art the sentence
     * means is that house's signature, so the house's own catalog row supplies
     * it.
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
            // A house they cannot name is a house they hold no reference for,
            // and that IS the answer rather than a failure to compute one. It
            // goes down the graded path with the rest so the player gets the
            // same honest sentence they would get if the name had resolved:
            // never a "no" they have not earned, and never a refusal, because
            // asking yourself whether you recognise something is always a
            // legitimate thing to do.
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


    // ── institutions acting on each other, and on the dead ────────────────
    //
    // Four verbs, one shape. A party asks something of another party, of the
    // dead, or of somebody above the Lid - and most of the time the answer is
    // NO, in terms the asker can act on. That is the point rather than a
    // shortfall: the Requisition Against Standing Stock has been granted once
    // in four hundred years and refused ten times, and the catalog says the
    // refusals are filed with the same care as the grant.
    //
    // THE GATE IS THE FEATURE, AND IT SPEAKS. Every one of these produces a
    // different answer for a rogue, for a junior in a house, and for the seat,
    // and each names its own reason: somebody who serves nothing is told what
    // the act would require, somebody junior is told the rung it opens at IN
    // THEIR OWN HOUSE'S TITLE, and the seat is told what it cost. The refusals
    // come from `standing.ts`, which copies `sect-leadership.ts` sentence for
    // sentence so that the ladder reads the same however a player runs into it.
    //
    // NONE OF THEM WEAKENS THE KNOWLEDGE GATE. Every faction goes through
    // `factionMeant`, which filters by `isAwareOf` before it scores anything,
    // so a house the player has not been told about resolves to nothing and is
    // refused identically to one that does not exist. Asking about a thing
    // must not teach that the thing is there.

    /**
     * A faction the player can actually name: a sect, a court, or an apex.
     *
     * `resolveSect` covers the sect catalog and the sects table. Courts and
     * apexes live in `hierarchy.ts` and have no rows at all, and three of the
     * twelve dead sentences named one - so they are matched here on the same
     * terms and through the same gate, filed under the `sect` knowledge kind
     * exactly as `sect-politics.ts` already files them.
     *
     * Returns null for an unheard name and for an invented one, and the two are
     * indistinguishable to every caller. That equivalence is required rather
     * than incidental; the shape of a refusal must never be the answer.
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
     *
     * The distinction every one of these verbs turns on, and the one a live
     * playtest caught them getting wrong. "I make an offering" with no
     * addressee means the player's own house and is a complete sentence. "I ask
     * the Hollow Court for a pill" NAMES SOMEBODY, and if that name resolves to
     * nothing the request has not been made - falling through to the player's
     * own house instead is the engine quietly answering a different question,
     * which is the whole failure mode this batch of verbs exists to remove.
     *
     * True only where a name was actually typed. A short or empty string is not
     * a failed resolution; it is no addressee at all.
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

    // ── the far side of the Lid ──────────────────────────────────────────
    //
    // Ordinal 46 is the one point where progression is also geographic, and the
    // layer on the other side is one of the most complete systems in the
    // project - the seam, the landing, five houses older than the lower world's
    // records, residents, standing built on tenure and holdings rather than on
    // a second power ladder, a peril clock, `descend` and `sendAcross`.
    //
    // NOTHING IN THE CODEBASE CALLED ANY OF IT, and what a player got instead
    // was one refusal, correct and empty, in front of an empty room. That is
    // the same defect as `treat`, `buy`, `site` and the four institutional
    // verbs, at the one height where there is nothing else to do at all.

    /**
     * The player, as somebody the far side has a row for.
     *
     * Null when the world simulation is off for this run, which is the only
     * reason the far side would have nothing to say - and the refusal below
     * says so rather than pretending the layer is empty.
     */
    residentNow(cultivator: Cultivator, run: Run): Resident | null {
        if (!this.atHand) return null;
        const resident = residentAbove(this.atHand, cultivator, Math.floor(run.elapsedDays));
        if (resident?.settledJustNow) this.worldDirty = true;
        return resident;
    }

    /**
     * Where an immortal actually is, which is somewhere rather than nowhere.
     *
     * The abode first, because it is the only thing on this layer that is
     * theirs; then both readings of what they are worth, because both are true
     * at once and neither is the answer. Nothing from the mortal layer is drawn
     * on - no practice, no overheard name, no province ambient - and that is
     * enforced by not calling those readers rather than by filtering them,
     * which is the difference between a rule and a hope.
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
     *
     * Not a refusal, and the difference is the point: what the player asked for
     * is available, twice, in forms that cost different things. Both are
     * resolved by machinery that already existed; all this does is say so, and
     * settle the abode on the way past, because standing in a field is not what
     * happens to somebody who comes through.
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
     *
     * The most expensive action in the game and the only one at the top of the
     * ladder that is a decision. Three separate pieces of the engine resolve it
     * and this method owns none of them:
     *
     *   `evaluateLidTransit(down)`   whether it is permitted, and what it draws
     *   `resolveDescentStrikes`      the nine strikes, through the same
     *                                per-strike odds every tribulation uses
     *   `descend(state, ...)`        the breaths, the object ceiling, and the
     *                                fact the province gets - which names
     *                                nobody, because nobody down there could
     *                                say what was in it
     *
     * The expulsion is not a second action and is not something the player has
     * to remember: `descend` resolves the visit atomically and the resident's
     * layer never changes, because a True Immortal in the lower world is a
     * thing being pushed back out for the whole time they are there.
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
     *
     * The cheap route and the unreliable one. Nothing of the sender crosses, so
     * nothing is drawn on them - and nothing of them is there to see it done,
     * which is the trade. What arrives is acted on by people who are not them.
     *
     * The gate is the LINE, and it is an object rather than a permission:
     * `sendAcross` requires a channel carrying `lid_channel`, held by somebody
     * on the other side. That is the whole difference between a house that
     * receives and a house that hears nothing, and it is why an ascending
     * cultivator's parting gift matters long after they have forgotten it.
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

    // ── inheritance grounds ──────────────────────────────────────────────
    //
    // `data/cultivation/inheritance-trials.ts` is roughly nineteen hundred
    // lines of finished, tested content - twenty-odd sites, three unrelated
    // kinds of gate, an interior the type system keeps out of the pre-entry
    // view - and until these methods existed nothing a typed English sentence
    // could do reached one line of it. The systems playtest reported it in its
    // own friction block as the largest unplayable system in the game.
    //
    // Four steps, and the split between the first two and the last two is the
    // one guarantee this whole surface exists to keep: a cultivator who has
    // not gone in cannot learn what is inside, THROUGH ANY PHRASING. That is
    // enforced three times over - `outsideViewOf` returns a type with no
    // `interior` key, `SiteFace` in `facts.ts` has no field that could hold
    // one, and the single call to `enterSite` in this package sits below a
    // recorded entry in a method that has already spent the days.

    /**
     * The realm rank a sentence names, or null when it names none.
     *
     * Read by containment against the ladder's own names rather than parsed,
     * so `realms.ts` stays the authority for what a rank is called and this
     * cannot go stale when the ladder changes. Scanned from the top down so a
     * longer name wins over a shorter one it contains.
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
     *
     * The generic phrase is refused rather than matched. "What the sect
     * teaches" is the question, not an answer to it, and handing it to a fuzzy
     * matcher is how a sentence about the shelf ends up decreeing whichever
     * art happened to share a word with it - for a generation, at the price of
     * every elder's standing.
     */
    private artNamed(text: string | undefined, cultivator: Cultivator): string | null {
        const query = (text ?? '').trim();
        if (query.length < 3 || GENERIC_LIBRARY_PHRASE.test(query)) return null;
        return resolveTechnique(this.repos, query, cultivator.id)?.id ?? null;
    }

    /**
     * What is for sale where they are standing.
     *
     * A read. Nothing is bought by looking at a board, no time passes, and a
     * place with no market says so - which is most places, and is the reason
     * getting out of a poor region is the first real goal anybody has.
     *
     * ── AND WHO IS SELLING, WHICH IS NOT THE SAME QUESTION ───────────────
     *
     * `handleMarket` knows the region and the purse and nothing about the
     * people, because it is an MCP handler with no world in front of it. So the
     * board it returns is a price list with no seller attached - millet, a
     * ferry, an inn, a copyist's stall - and standing in a square full of
     * cultivators told a player nothing about any of them.
     *
     * The design owner's word for what was missing: *random cultivators selling
     * stuff they found or do not need any more.* That is the block appended
     * here, and it is composed in this layer because this is the only layer
     * that holds all three of the world, the knowledge gate and the square.
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
        // ── AND WHEN NOBODY IS SELLING, WHY NOT ──────────────────────────
        //
        // `AGENTS.md`: prefer a refusal that names a way out. A square where
        // everybody is holding their own house's manual is not an empty square,
        // and "nobody here is trading" would be a true sentence that teaches
        // nothing. What is actually true - *that one is his own house's, and no
        // figure you can name moves it; the road to it is the house* - is a
        // door, and it is the door the whole recruitment half of the game is
        // about. Only when there is nothing on offer, because a player who can
        // buy something does not need the lecture.
        const shownLines = offered.offers.length > 0
            ? offered.lines
            : linesForWhatWillNotMove(offered.read);
        for (const line of shownLines) {
            board.facts.lines.push(line);
            board.facts.prose = `${board.facts.prose}

${line}`;
        }
        // The cost half goes to `lines`, and it has to.
        //
        // This whole sentence used to live in `structure`, which
        // `composeNarrationUser` never sends - so a model narrating a market
        // read was never told the turn had spent nothing. Played against
        // ollama, the sentence "I look over the stalls, ask who is selling a
        // manual, and buy the cheapest one they have" returned prose saying
        // "You trade eleven spirit stones for the copy" over a ruling that said
        // nothing was bought, and the player believed they owned the one object
        // that unblocks the opening of this game.
        //
        // The prompt now forbids that, but a prompt cannot be obeyed by a model
        // that is not shown the ruling. And this fact belongs on `lines` by that
        // channel's own test: it is OBSERVABLE. Somebody who spends an afternoon
        // at the stalls and buys nothing knows both of those things without
        // being told a single number.
        //
        // The counts and the pricing band stay in `structure`, where they are
        // read by an operator and would only be paraphrased into exposition.
        board.facts.lines.push(
            'You read what is on offer here. Nothing was bought and no time passed.'
        );
        board.facts.structure.push(
            `${offered.peopleHere} person(s) standing here; ${offered.offers.length} offer(s) `
            + 'after the cut, priced between what a counter would give the holder and what the '
            + 'copy is worth. Reading them costs nothing: nothing bought, no time passed.'
        );
        // WHAT WAS NAMED IS WHAT "THE CHEAPER ONE" CAN MEAN NEXT TURN.
        //
        // Recorded here, where the engine decides what to print, rather than
        // recovered by reading the narration back: parsing prose for what
        // exists would make the narrator authoritative over the world, which is
        // the one thing it may never be. See `last-turn-memory.ts`.
        //
        // IN THE ORDER THE BOARD PRINTS THEM, which is the order the player
        // reads them - the stall block first, then whoever is standing here
        // holding something. Only the nameable objects: a bowl of millet is a
        // price and an availability with no row anywhere, and "the cheaper one"
        // is never about the ferry.
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
     *
     * The capability predicates, asked rather than discovered by dying. It
     * reports odds and never resolves anything: an attempt is always permitted,
     * and this is the difference between a player who chose badly and one who
     * was not told the ground was lethal.
     */
    private async assess(cultivator: Cultivator, target: string | undefined): Promise<Execution> {
        const query = (target ?? '').trim();

        // ── a master reading a student ──
        //
        // A different question from "could I survive that cave", answered off
        // different rows: who in this house is standing above them, and whether
        // the ladder has stopped crediting the years they have spent at this
        // rung. `AssessSchema` had three subjects and none of them was a person
        // being TAUGHT, which left the send-off - the sentence a master says
        // when a disciple has taken what there is here - unreachable and
        // unaskable.
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

        // ── "HERE" IS A PLACE, AND IT IS THE ONE THEY ARE STANDING IN ────
        //
        // Played: `what can I gather here` came back "Shen Wu has never heard
        // of \"here\"." - about the ground under their feet, in a word the game
        // itself uses in almost every sentence it prints. `AGENTS.md`: the
        // player must be able to type back what the game printed, and a refusal
        // that names no route is the feature missing said politely. This one
        // managed both at once.
        //
        // Resolved to the location rather than added to a noun list, because
        // there is nothing to look up: the cultivator row already says where
        // they are. Narrow to the words that can only mean the present place -
        // a name is never in this set, so nothing that used to resolve stops.
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
     *
     * Deliberately closed and deliberately anchored. "Here" is the whole of the
     * case that was found; the others are the same deixis spelled the two other
     * ways a person spells it. Nothing here is a place name in any catalog, so
     * a real name can never fall into it.
     */
    private static readonly THE_GROUND_UNDER_THEIR_FEET =
        /^(?:here|this place|where i am|where i(?:'m| am) standing|around here|this ground|the ground(?: here)?)$/i;

    /**
     * An assessment with no subject, or with the asker as the subject.
     *
     * "Am I ready", "how am I doing here", "have I stopped" - a question about
     * the person asking rather than about any ground. Previously these fell to
     * the place read and were answered with the weather at the cultivator's own
     * location, which is a true statement and not an answer.
     */
    private static readonly ASSESSING_THEMSELVES =
        /^(?:my ?self|me|my (?:progress|standing|position|cultivation|prospects)|where i (?:am|stand)|whether i(?:'m| am)? (?:ready|stuck|stalled|finished|done)|if i(?:'m| am)? (?:ready|stuck|stalled)|ready|stuck|stalled)$/i;

    /**
     * Alchemy, through the same handler the MCP tool surface calls.
     *
     * Not reimplemented here. `alchemy_manage.refine` owns the odds, the
     * ingredient burn and the pouch write, and a second implementation would
     * eventually disagree with the first about what a failed cauldron costs.
     */
    private async refine(run: Run, cultivator: Cultivator, target: string | undefined): Promise<Execution> {
        const query = (target ?? '').trim();

        // ── "what can I make" ──
        //
        // A generic noun is not a name, and it used to be treated as one:
        // "I refine a pill" scored "pill" against the recipe catalog, matched
        // `Minor Healing Pill Formula` on containment, and silently picked one
        // arbitrary formula out of forty-two. Same class as
        // `GENERIC_LIBRARY_PHRASE` and `GENERIC_HOUSE_PHRASE` - a category is a
        // question about the whole set and has to reach the listing.
        //
        // And the listing is the half of the loop that was missing entirely.
        // `handleListRecipes` has been in `alchemy-manage.ts` the whole time,
        // filtered by the cultivator's own realm, and nothing typed reached it -
        // so a player could not find out which formulas they could attempt, and
        // therefore could not know which herbs to gather. `MAX_PILL_BONUS` is
        // 0.35, the largest modifier in the game and the intended way past the
        // rungs that kill, and the whole of the road to it was dark.
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
            // what they can make was actually told. A read that reports nothing
            // is worse than no read: it says the answer is empty when the answer
            // is forty-two formulas.
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
     *
     * That handler owns mastery accrual and rolls a deviation check on the same
     * terms the time-skip uses, so practising a conflicting art is not free
     * just because it is short. The target must be an art the cultivator
     * actually knows.
     */
    private async train(
        cultivator: Cultivator,
        target: string | undefined,
        /**
         * How long they said, and it was being thrown away.
         *
         * ── A SPAN NOBODY NAMED IS NOT A SPAN THE PLAYER CHOSE ───────────
         *
         * Played: `I sit down and practise it until I can break through` spent
         * SEVEN DAYS and moved mastery 0% to 3%. "Until I can break through" is
         * an open request; a week is not an answer to it, and the player had no
         * way to tell they had been handed a default.
         *
         * Two things were wrong and the second is the larger. This method never
         * read `action.days` at all - it passed the constant to `handlePractise`
         * unconditionally - so `I practise for a year` spent a week too, and
         * every duration the parser lifted off a practice sentence went in the
         * bin. `handlePractise` has taken days, months and years since it was
         * written, spends them, ages the cultivator by them and advances the
         * run; nothing was reaching it.
         *
         * And where nobody named one, the default is SAID. An engine that
         * quietly substitutes a figure and then reports it back as what was
         * intended is telling the player their own intention, and it is the
         * same defect as the truncated span in `shortSkip`, one layer up.
         */
        days?: number
    ): Promise<Execution> {
        const query = (target ?? '').trim();
        let technique = query.length >= 2 ? resolveTechnique(this.repos, query, cultivator.id) : null;

        // THE ONE ART THEY HAVE.
        //
        // "I train" names nothing, and a cultivator who knows exactly one
        // method has said everything that needs saying. This refused with "you
        // cannot decide which of the things you know you meant to practise" to
        // somebody holding a single manual, which is not a choice they were
        // failing to make. Found by playing: learn the first book, type "I
        // train", get told you are undecided between one thing.
        //
        // Only when the naming is genuinely empty. A query that resolved to
        // nothing is a different failure and keeps its own refusal below,
        // because guessing at what somebody meant to type is worse than saying
        // it did not resolve.
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
     *
     * Time passes through the simulator; what the ground gives up is drawn from
     * the herb catalog's own weighted table on a seeded sub-stream, and lands in
     * the shared pouch. The whole point of the Late Age is that you might not
     * out-cultivate a prodigy but you can out-dig them, and nothing else in the
     * verb set reaches that.
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
        //
        // It matters more than it did: the alchemy refusal is the thing that
        // tells a player which herb a formula wants, and the game was then
        // ignoring the name it had just told them to go and pick.
        //
        // Still gated on reach below - naming a herb you cannot harvest yet
        // does not make it harvestable, it just means you looked for the right
        // thing and could not take it.
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
     *
     * The counterpart to `gather`, and it exists for the same reason: the Late
     * Age's promise is that you may not out-cultivate a prodigy but you can
     * out-dig them, and until this verb there was exactly one way to act on
     * that. Foraging is the safe half. This is the half with a body on the
     * other end of it, and it is where the top of the material ladder comes
     * from - `beasts.ts` carries the only supply of heaven-grade and above
     * that the world actually produces.
     *
     * ── WHAT THIS DOES NOT DO ────────────────────────────────────────────
     *
     * It does not resolve a fight. `combat_manage.resolve` does, and a beast
     * reaches it as a described opponent - a name and a realm ordinal, the
     * fields `OpponentSchema` already has - so it goes through `assessPower`,
     * the categorical-gap refusal, `killRequirement` and the same seeded
     * exchange stream a person goes through. There is no second resolver and
     * there must not be: a beast fight that did not replay from its seed
     * would break a stated law of this engine.
     *
     * ── THE RUNG DECIDES WHICH SCENE THIS IS ─────────────────────────────
     *
     * Anything that speaks stands at `BEAST_CHANGE_ORDINAL` or above and is a
     * party rather than a problem. Setting out to hunt is not setting out to
     * kill somebody, so meeting one on a general hunt ENDS THE SCENE with a
     * meeting: the engine does not swing on the player's behalf at something
     * that could have been spoken to.
     *
     * That is intent, not a ban. Name it - "I hunt the White Ape of the
     * Gorge" - and the confrontation runs exactly as it would against a
     * person, because anybody may attempt anything and the engine's job is to
     * say what it cost. What changes is what the world then knows: the core
     * carries a provenance saying it came off something that could answer.
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

        // ── WHAT THE HUNTING HAS DONE TO THIS GROUND ─────────────────────
        //
        // Depletion as a cause rather than a chore, and the sentence a player
        // needs before they understand why the encounters got worse. Hunt a
        // district out and what has been removed is the bottom of its food
        // chain; what is left is what was eating it, and it is still here.
        //
        // Nothing has changed grade and nothing has crossed the counted line -
        // a hare is still a hare. What changed is the PLACE.
        const worked = this.atHand ? worldLocationFor(this.atHand, here) : null;
        const emptied = worked
            ? whatIsLeftOutThere(worked, Math.floor(this.atHand!.currentDay))
            : null;
        if (emptied) lines.push(emptied);

        // ── WHAT IS ABOVE THEM ON THIS GROUND, AND WHERE IT GOES ─────────
        //
        // The read that keeps people alive, and it is free: walking the ground
        // tells you what has left it. What it must not be is the FIRST thing
        // said. It led, at length, about a thing the same sentence declares
        // will not be put in front of them - so somebody who asked for a hare
        // was answered with three lines about a Void Refinement cultivator
        // twenty-nine rungs up before the hare was mentioned. Reported three
        // times in one night by three different readers, which is what a lead
        // that answers a question nobody asked looks like from outside.
        //
        // So the quarry goes first and this is a footnote after it. And the
        // footnote is short where the gap is unbridgeable: `reaction` is the
        // resolver's own account of what the ground does about the gap, and it
        // is worth reading when the thing could actually reach you. When it is
        // an entire realm above, the count and the name are the whole of the
        // warning and the rest is the engine explaining itself.
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

        // ── FOR A BEAST, `finished` IS THE DEATH ─────────────────────────
        //
        // `opponentDied` is the survival layer's answer and it is only ever
        // written for an opponent with a row in the `cultivators` table. A
        // beast is DESCRIBED to the resolver - a name and an ordinal - so it
        // has no row, and reading `opponentDied` alone meant a beast could be
        // killed outright and yield nothing. Measured in a played run: an
        // ordinal 27 cultivator against the White Tiger at 20 came back
        // "the finishing requirement was met in full" and then "the White
        // Tiger Core only comes off a body, and there is no body."
        //
        // `finished` is the right field and not a workaround, because of what
        // a beast is. `THE_BEAST_ROAD.death` states it: the body is the whole
        // of them, no nascent soul leaves, nothing comes back. For a
        // cultivator the finishing requirement being met is not yet an ending
        // - that is the whole reason the survival layer gets a second say -
        // and for a beast there is nothing left to have a second say about.
        // The distinction the two fields draw is exactly the distinction
        // between the two kinds of thing.
        //
        // AND THE BAND DECIDES WHICH OF THE TWO FIELDS GOVERNS. A beast at
        // `BEAST_CHANGE_ORDINAL` is a person, so a person's rules apply to its
        // death as much as to its life - measured in a played run: killing The
        // Reader at Sweptground came back "the body is gone and the person is
        // not, the soul left intact", which is the nascent soul path working
        // correctly on somebody who has one. Reading `finished` there would
        // have handed the player a core off a body whose owner walked away.
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
     * Who answers for a beast that was killed, and only where somebody found
     * out.
     *
     * `who-answers-for-a-beast-that-was-killed.ts` had no caller anywhere in
     * `src/`, and it took something bigger down with it: `Beast.disposition` is
     * read in exactly one file and it is that one, so the catalog set
     * righteous, neutral or demonic on every row in the world and nothing live
     * ever asked. This is the caller.
     *
     * ── WHAT THIS DECIDES AND WHAT IT DOES NOT ───────────────────────────
     *
     * Nothing here refuses a killing and nothing anywhere else does either.
     * What is decided is the three facts the engine layer cannot know because
     * they are about locations and rosters, and that module says so in its own
     * header:
     *
     *   who was standing behind it   the house that holds this ground. A beast
     *                                on open ground is nobody's, which is most
     *                                of the hunting trade and the reason it is
     *                                a trade.
     *   who can put a name to it     a `KnowingStage` per party. Below `placed`
     *                                nobody can, and no account opens because
     *                                there is nobody for it to be against.
     *   how far they can reach       whether the killer answers to a body.
     *
     * The direction is not decided here either. `whoPaidFor` reads the
     * disposition, and killing a demonic beast off somebody's ground opens a
     * FAVOUR they owe you through the identical call - one expression, both
     * signs, and no branch in this file on what the thing was.
     *
     * ── WHY THE STAGE IS THIS AND NOT A DRAW ─────────────────────────────
     *
     * A new draw here would move every later draw on whatever stream it
     * borrowed, which this repo treats as a regression until proved
     * byte-identical. It does not need one. A house that holds ground and has
     * people standing on it can say who was out there; a house that holds it
     * and has nobody on it knows the thing is dead and cannot put a name to
     * that - which is `named`, the deniable rung, exactly as written.
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

        // ── AND THE WORLD CONTAINS THE KILLING ───────────────────────────
        //
        // Written FIRST, so the records below can carry its id. The same
        // ordering `attentionFor` keeps and for the same reason: an account
        // whose triggering event is not in the ledger is a house being owed
        // something for an event nobody can repeat.
        //
        // The weight is `whatADeedLeaves`'s and is not decided twice - this is
        // the "priced elsewhere" path, so `aDeedEntersTheWorld` never asks.
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

        // ── AND THE ACCOUNTS IT OPENS ────────────────────────────────────
        //
        // `whatADeedLeaves` already decided every one of them, holder-first,
        // in both directions - a wrong they hold about you, or a favour you
        // hold about them where the thing had been taking from them. None of
        // it is re-decided here; the rows are written with the fact's id on
        // them, and nothing about the killing is re-weighed.
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

        // Whether they can name the house is the discovery layer's question,
        // asked here rather than assumed - the same rule the site verb keeps.
        //
        // ── AND BOTH SENTENCES NAME THE GROUND ───────────────────────────
        //
        // `461535a`'s rule, applied to the two lines it did not reach: name the
        // place whenever the game knows it. `here` is the place name, it is two
        // statements above on the deed as `place: here`, and it is in the
        // summary of every call this method pushes - so the operator's record
        // named the ground and the player's sentence said "this ground".
        // Played on Azure Cloud Pavilion grounds, which the same paragraph had
        // just named, both branches.
        //
        // The two silences stay apart, exactly as that commit left them. "X
        // holds it" is information and "somebody holds it and you have no name
        // for them" is a warning; only the place name was missing from each.
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
     *
     * The counted/tracked line from `items.md`, and the two halves are stored
     * differently on purpose. A pelt is a quantity in a pouch. A core is a row
     * with a holder and a history, made and then MOVED through
     * `transferPossession` so the provenance chain has a first link - an
     * object that arrives with no chain behind it is indistinguishable from
     * something stolen, which is exactly what that document cares about.
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
            // ── WHAT THE DISTRICT STILL HAS ──────────────────────────────
            //
            // Both shapes draw the band down, because both came off a body
            // that was standing on this ground. What differs is what is
            // STORED - a number against the place for the counted half, a row
            // with a history for the tracked one - and not whether the world
            // is one animal poorer for it.
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
     *
     * The world's own row is the ceiling and never the floor: the draw upstream
     * has already decided what a person of this rung would find, and this can
     * only ever reduce it. When it does, the reason is said out loud - a place
     * that has been worked out has to say so rather than quietly hand back
     * less. See `what-a-place-still-has-in-the-ground.ts`.
     *
     * With the world off there is no row and nothing binds, which is the same
     * shape every other world-backed guard here has.
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
     *
     * Any name the game prints is a name the game must accept, and this verb
     * prints beast names constantly - in the threats-above line, in the
     * meeting, in every refusal. Matched on the whole name and on any word of
     * it long enough to be meant, so "the white tiger", "White Tiger" and
     * "tiger" all land on the same row.
     *
     * Ambiguity resolves to nothing rather than to a guess. Picking which
     * thing somebody meant to fight is the one thing this must not do.
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
     *
     * Those handlers return either a guiding error body or a result object with
     * an engine-authored `narrationHint`. Both are facts; the error is simply
     * the fact that the engine declined, and it is passed through rather than
     * softened.
     */
    /**
     * ADMIN, the exploratory testing surface.
     *
     * Deliberately NOT narrated. The operator is asking the engine what it did,
     * and wrapping that in prose would put a model between them and the answer,
     * which is the one thing this surface exists to avoid. Output is whatever
     * `admin_manage` returned, verbatim.
     *
     * Arguments are explicit `key=value` pairs rather than parsed from prose.
     * That is the whole safety property: there is no inference here to be wrong,
     * and an unrecognised action is answered with the list rather than a guess.
     *
     * A VALUE ENDS AT THE NEXT KEY, NOT AT THE NEXT SPACE. This used to split on
     * whitespace, so `set_location location=The Dead Verge` sent `"The"` and
     * quoting it sent `"The` - and most of this world's gazetteer is multi-word,
     * so most of the map was unreachable from the operator surface. Booleans had
     * the same shape of problem: `fill=true` arrived as a string and every
     * boolean field in the admin schemas rejected it. `parseAdminCommand` owns
     * both, beside the schemas it has to satisfy.
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

        // ── AND THEN THE WORLD IS LOOKED AT ───────────────────────────────
        //
        // ADMIN exists to stand the world in a state ordinary play would take
        // four hundred years to reach. Arranging it and then saying nothing
        // left the operator holding a receipt: the encounter existed, and there
        // was no way to see it exist. So a call that CHANGED something is
        // followed by a look at what it changed into - phase 3 over the
        // post-state, the same call `newRun` opens a life with.
        //
        // This is NOT the admin output being narrated. The receipt is untouched
        // and still verbatim; what follows it is the world as it now stands,
        // and the newly-stood-up person is in it because `company` reads the
        // world rather than the command. The engine decided, the narrator
        // describes, and the narrator is not told what to say about it. The
        // authority rule is exactly as it was.
        //
        // It is also the only place the engine -> narrator seam is exercised
        // against arbitrary state. Ordinary play reaches Core Formation in one
        // run in a hundred and eighty, so phase 3 has barely run above
        // Foundation at all; from here it is one line.
        //
        // No flag guards it. Which narrator answers is settled at startup and
        // ADMIN gets whatever the process was started with, so testing the
        // engine alone is "start it without a model" rather than a mode.
        //
        // A read - `roster`, `audit_log`, `help` - changed nothing and gets
        // nothing, because describing an unchanged room after printing a list
        // is noise.
        // ── AND AN ADMIN LINE CAN KILL SOMEBODY TOO ──────────────────────
        //
        // `adminAct` returns before the turn's own tail, so the settlement
        // that runs at the end of `act` never reaches an operator's death -
        // and `advance_days` at idle focus is the commonest way anybody in
        // this project has ever seen a cultivator starve. An operator standing
        // a world in a state and then killing somebody in it is a real death
        // in a real world, exactly as `spawn_encounter` produces a real
        // person, so the world hears about it on the same terms.
        //
        // BEFORE the look below, so the world the operator is shown afterwards
        // is one that already knows. The world handle is loaded here because
        // the admin branch returns above the line in `act` that loads it, so
        // on an ADMIN-only turn there may be nothing in hand yet.
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
            // The estate row goes in the ENGINE channel and not into the
            // receipt's prose. An operator whose `advance_days` starved
            // somebody needs to be able to see where what they were carrying
            // went - it is exactly the post-state ADMIN exists to show - and
            // it is a field report rather than something a character
            // perceived, so it belongs in the inspector beside every other
            // call this turn made.
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
     *
     * Deliberately `factsForLook` and not a fact list assembled from the admin
     * result: what an operator wants to see after arranging something is the
     * arrangement, from inside, and `look` is the engine's existing answer to
     * that question. It reads the post-state, so a spawned opponent is present
     * because they are present rather than because the command mentioned them.
     */
    /**
     * End this run and begin another, from the top.
     *
     * "Runs end when the cultivator dies; there is no abandoning one" is a rule
     * about PLAY, and it is still enforced for players in `newRun`. It is not a
     * rule about the operator surface: testing a game whose interesting states
     * are four hundred years apart means starting over constantly, and the only
     * way to do that was to stop the process and delete the database.
     *
     * The dead run is flagged admin FIRST and closed with no death cause,
     * because it did not die - a reset is not evidence about how cultivators
     * end, and `writeAdminAudit` is what keeps it out of the ledger. It stays
     * in `latestFinishedRun`, deliberately: the next life begins in the world
     * this one left behind, which is what makes reset "start this world over
     * from a new birth" rather than "throw the world away".
     *
     * The name carries over unless one is given, so `ADMIN reset` is the whole
     * command and `ADMIN reset Shen Yuan` is the whole command with a name.
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
            // ── AND IT MUST NOT CLAIM NOBODY DIED WHEN SOMEBODY DID ──────
            //
            // This line said "no death cause was filed, because there was no
            // death" unconditionally, which was true of the case it was
            // written for and a lie about the commonest one: reset is reached
            // from the death screen more than anywhere else, and it was
            // reporting a killing as a bookkeeping close. `endRun` already
            // declines to overwrite a recorded death - the ledger was right
            // and only the receipt was wrong - so this reads the run rather
            // than assuming it.
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
            //
            // `hint` is a tool invocation for a developer - this comment said so
            // already, and said "never goes to a player" - and it was going
            // straight onto the mechanical line anyway, together with the bare
            // error code. That was written when the structure channel was
            // believed not to reach anybody: it does, `engineEntries` renders
            // every line of it into the play log, and the result was read in
            // play as
            //
            //   nothing_accrued. Time is advanced by
            //   cultivation_manage.cultivate. Calling stipend twice does not
            //   pay twice.
            //
            // - a database key and an MCP tool name, in the transcript, on the
            // commonest refusal a house member meets. So the hint now goes to
            // the inspector, where a tool name is exactly the right word, and
            // the log gets the ruling said as a ruling. Every refusal this
            // engine files goes through here, so this one branch is most of the
            // remaining surface.
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

    // ── being hurt, and the shop that was always there ───────────────────
    //
    // The softlock, found by playing cold in a browser and reproduced in full:
    //
    //   turn 11  3 untreated meridian injuries. Any further combat is fatal.
    //   turn 12  "I cultivate for twenty years"
    //            Day 30 - Qi deviation: a minor meridian injury.
    //            Day 30 - 4 untreated meridian injuries.
    //            You came out early. 30 days of the 20 years were spent.
    //
    // Untreated injuries raise deviation risk, deviation adds another injury
    // and ejects the cultivator from seclusion after about a month, and the
    // next attempt goes wrong slightly sooner. He could not advance, could not
    // heal, and could not die - the only exit the engine named was combat and
    // the engine had already said combat was fatal. All of it with three
    // hundred and forty-five spirit stones in the purse, standing in a market
    // whose board advertised a physician at forty cash.
    //
    // Both halves of that are fixed here and both were the same defect: a
    // price the player has been shown that no sentence can spend money on.

    /**
     * The two lines on the board that answer "I am hurt".
     *
     * Ids rather than a rule. Everything about what they cost, what they are
     * worth against a pill and what a mortal physician can and cannot do is
     * read off the catalog rows themselves - including the one fact that
     * decides which of them is any use, which is the physician's own note
     * saying he cannot touch a meridian.
     */
    private static readonly PRICE_PHYSICIAN_VISIT = 'price-doctor-visit';
    private static readonly PRICE_COURSE_OF_CARE = 'price-splint-and-month';

    /**
     * Getting a wound seen to.
     *
     * Priced off the same rows `market` prints, through the same
     * `localPrice`, so the number the player was quoted is the number they
     * pay. Nothing about the price or the effect is authored here.
     *
     * The physician is refused for the commonest case and it is the catalog
     * that refuses him: every injury this engine produces is a meridian
     * injury, and `price-doctor-visit` says in its own note that a mortal
     * physician "sets a bone, stitches a cut, cannot touch a meridian". What
     * the mortal world does sell for a meridian is the course of care, which
     * calls itself the alternative to a healing pill - slower, cheaper, and it
     * leaves you out of the fight for a season. So the answer to "I am hurt"
     * is a real choice with a real price on both sides, and it came out of the
     * price list rather than out of this method.
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

        // ── WHAT A PHYSICIAN IS ACTUALLY FOR ─────────────────────────────
        //
        // A design decision, made deliberately and written down here because it
        // is a decision and not a tuning constant.
        //
        // Measured across 1,058 lives: HP was a strictly monotonic decreasing
        // resource. Forty controlled ten-year skips from 5/50 with full rations
        // restored exactly zero, and 75% of all combat deaths had NO untreated
        // wounds - nothing to treat, no verb to use, no way back. The frontier
        // sat at ordinal 17 of 46 with a median age at death of 23 against a
        // hundred-year lifespan. That is not a hard road; it is a bleed-out,
        // and a bleed-out is not a decision anybody gets to make.
        //
        // The rule chosen, and the reason it does not contradict anything:
        //
        //   A WOUND DOES NOT MEND ON ITS OWN. A BODY DOES, UNDER CARE -
        //   BY A FIXED AMOUNT, WHICH IS THE BOTTOM RUNG OF A LADDER.
        //
        // The user's ruling settled the second half: wounds are not forever,
        // they are answered by graded healing pills at the same rank
        // requirement, "where a lower should heal almost nothing - it'll heal a
        // fixed hp amount and as you get up the amount becomes a lot." So care
        // restores `CARE_RESTORES_HP` and not a share of the wound, and being
        // weak after a seclusion stays true at every rung above the first.
        //
        // `injuries.ts` is explicit that there is no long rest and no hit dice,
        // and that stays exactly true: a torn meridian is permanent until
        // somebody is paid to close it, it never closes by waiting, and it
        // still ratchets the odds of the next one. What changes is that being
        // BATTERED and being WOUNDED stop being the same thing. Lying still
        // under a roof for a month, fed, having paid for it, puts a body back
        // on its feet - which is what every physician in the world has ever
        // been for, and is the one service the board already advertises and
        // nothing could buy.
        //
        // It is not free and it is not fast. A month is a month, the clock runs
        // through it, the food is bought or the stay kills them, and a broke
        // cultivator cannot have it at all. What it is not any more is
        // impossible.
        const battered = cultivator.hp < cultivator.maxHp;

        // ── WHAT A PHYSICIAN CAN ACTUALLY REACH, PRICED BEFORE IT IS SOLD ──
        //
        // The two axes gate what mortal care closes, and a gate without a price
        // change reintroduces the exact defect the whole meridian pass was for:
        // eleven stones taken, a month spent, "Nothing closed." A treatment
        // sold against a wound it cannot touch is worse than a refusal, and the
        // refusal has to name the grade that would work.
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
            //
            // This refusal was correct, well written, and a dead end. Measured
            // in play: a cultivator carrying a crippling tear, holding 194
            // spirit stones against a 54-stone cure, was told what grade of
            // medicine it wanted and never told that the medicine has a name,
            // is on a board, and was inside their purse. They found it by
            // reading `pills.ts`, which is not a thing a player can do.
            //
            // The shape copied here is the one this project already got right
            // on the Cultivate control, which names the Lesser Qi-Gathering
            // Manual when there is no method. A refusal is finished when it
            // names the alternative.
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

        // The engine's own triage decides which wounds, worst first. This
        // layer decides only how many were paid for.
        // MORTAL GRADE, because that is what a village physician is. The two
        // axes are the owner's ruling - the rarity of the medicine scales with
        // the severity of the injury and the realm of the injured - and before
        // this the resolver had neither, so a Nascent Soul with crippling torn
        // meridians bought thirty days of splints for fourteen stones and
        // walked out whole. See `what-grade-of-medicine-a-wound-needs.ts`.
        //
        // Nothing here narrows the bottom of the ladder: at Qi Condensation and
        // Foundation Establishment a minor or serious tear is still mortal
        // grade, still a month and a few stones, and still the cheapest cure in
        // the game. What is gated is height and severity.
        //
        // Passed as a PREDICATE rather than as a grade, so `injuries.ts` never
        // has to know what a pill grade is. It imports the wound table and the
        // schema and nothing else; the medicine ladder lives one layer out and
        // reaches `breakthrough.ts`, which imports `injuries.ts` back. Handing
        // the rule down as a function is what keeps that from being a cycle.
        const triage = treatWorstInjuries(
            applied.cultivator.injuries,
            courses,
            severity => medicineReaches('mortal', severity, applied.cultivator.realmOrdinal)
        );
        const treated = applied.cultivator.injuries.filter(
            (before: Injury) => !before.treated
                && triage.injuries.some((closed: Injury) => closed.id === before.id && closed.treated)
        );
        // ── AND THE BODY, A FIXED AMOUNT FOR A FULL MONTH ────────────────
        //
        // `CARE_RESTORES_HP` of it, scaled only by the days actually lain
        // still: a stay cut short by starvation or by a boundary crossing mends
        // the fraction of a month it lasted, off the same `simulatedDays` every
        // other consequence of this stretch is priced from. Never more than the
        // body is missing.
        //
        // A FLAT quantity rather than a share of the wound, so that a month of
        // mortal care is most of a novice and almost nothing at height, and the
        // graded healing pills are the actual answer once a body is large. It
        // is the bottom rung of that ladder, not a substitute for it.
        //
        // Nothing here touches a meridian. `treatWorstInjuries` above owns
        // those, is the only thing that closes one, and is unchanged - a wound
        // and a battering are two different problems with two different
        // answers, and this is only the second one.
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

        // ── WHAT THE STAY COULD NOT REACH, AND WHAT WOULD ────────────────
        //
        // A wound left open by a mortal physician must say so and must name the
        // grade that would close it, or the player pays, reads a success, and
        // walks out still carrying the thing that is going to kill them. This
        // is the same rule the technique ceiling and the bleed warning now
        // follow: name the blocker AND the fix.
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
                    //
                    // The HP a stay puts back was visible only in the sentence
                    // describing it, so the inspector could not show it and
                    // nothing could measure it - which matters now that the
                    // month a stay costs ALSO mends the body ambiently. Those
                    // are two systems and the sheet delta is their sum; this
                    // row is the paid half on its own, which is the half the
                    // healing ladder is a statement about.
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
     *
     * The board is the only list in this game the player has actually been
     * shown, so a name off it is the one free-text subject they can be certain
     * they typed correctly - and until this existed, twenty-two advertised
     * lines had four verbs between them covering three of them. The rest went
     * to the party resolver, which answered "nobody by that name" to somebody
     * trying to pay a physician.
     *
     * Three outcomes, and the third is the honest one rather than the lazy
     * one: what the engine models, it does; what it does not model, it says so
     * and charges nothing. A player who is billed for a night at an inn that
     * changes no row has been robbed by the software.
     */
    private async buy(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Promise<Execution> {
        const query = (target ?? '').trim();

        // ── A BOOK, WHICH IS THE ONE THING ON THE BOARD THAT WAS NOT ─────
        //
        // Ahead of `resolvePrice`, because `PRICES` has no manual row and never
        // will: what a stall carries is derived from the technique catalog, so
        // a book added to the content files is buyable the day it lands.
        //
        // Found by playing. "buy a manual" was refused with the look people
        // give somebody asking for a thing that is not sold - and then "I want
        // to learn the Lesser Qi-Gathering Manual" handed the road over for
        // nothing. The correct verb was blocked and the free one worked, which
        // is exactly backwards, and this is the half that fixes the blocking.
        const bought = await this.buyAManual(run, cultivator, query);
        if (bought) return bought;

        // ── SOMETHING TO GET ON, AHEAD OF THE BOARD'S OWN MATCH ──────────
        //
        // The board calls it a mule and a player says horse, so "I buy a
        // horse" was refused with the look people give somebody asking for a
        // thing that is not sold - over an animal that is priced, stocked and
        // rideable. That is the near-synonym rule exactly.
        //
        // FIRST, because a whole word against a closed list is stronger
        // evidence than a prefix against a name: `resolvePrice` matched "I buy
        // a carriage" to Carriage of a body, which is the fixed rate for
        // moving a corpse, and quoted it at one stone.
        const asRide = priceRowForSomethingToRide(query);
        const resolved = asRide === undefined && query.length >= 3
            ? resolvePrice(query)
            : null;
        const price = asRide !== undefined
            ? getPrice(asRide)
            : resolved ? getPrice(resolved.id) : undefined;

        if (!price) {
            // ── ABOVE A CERTAIN LINE, CASH IS NOT THE MEDIUM ─────────────
            //
            // `pillTradeTier` already computes that heaven grade and above is
            // not for sale at any price, and gives the reason. The refusal
            // never asked it, so "I buy a Meridian Rebirth Pill" - the medicine
            // the catalog says is the only thing below immortal grade that
            // touches crippling damage - answered "a thing that is not sold"
            // and listed millet and ferry crossings.
            //
            // This is the sentence the high corner wanted: told what would mend
            // you and why you cannot have it yet. It is also the `items.md`
            // rule reaching a player for the first time.
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
            //
            // `PRICES` is authored in category order, so slicing the top of it
            // listed food, lodging and transport and stopped - and a player who
            // asked for a healing pill by a name the catalog does not use was
            // told what IS sold in a sentence that never mentioned medicine.
            // The refusal was the second place the board hid its own medicine
            // from a dying player; `boardSample` is the first.
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

        // ── A THING YOU CAN ACTUALLY PUT UNDER YOU ───────────────────────
        //
        // Played and reported: "I buy a horse" and "I hire a mount for the
        // road" both answered with the look people give somebody asking for a
        // thing that is not sold. Both halves of that were already written -
        // the board has carried a mule at fourteen stones and a cart at thirty
        // since it was authored, and `what-a-conveyance-does-to-a-journey.ts`
        // has carried what a mount does to a road - and nothing joined them,
        // so `whatTheyCouldRide` offered a tracked craft nobody had any way to
        // come to own and the counted tier had no holder in the whole engine.
        //
        // `adjustCountedHolding` is where it lands, which is the arithmetic
        // that file insists on rather than `transferPossession`: a carriage
        // leaving somebody is a number going down by one, there is nothing to
        // recognise and nobody to be asked about it.
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

        // ── THE ALMANAC IS NOT THE LEDGER ────────────────────────────────
        //
        // `price.note` used to be spliced in here and it is almanac copy: it
        // says what a KIND of thing is, in the third person, to a reader who is
        // browsing. Dropped into a transaction it produced this, verbatim, on
        // buying one pill:
        //
        //   "18 spirit stones of the 65 you had. Twenty stones. Every run
        //    starts with exactly one, and it is worth a mule and a half.
        //    47 left in the purse."
        //
        // - a second price contradicting the one just charged, and a sentence
        // about what every run starts with, in the middle of a receipt.
        //
        // `items.md` names the rule: the almanac says what a thing IS and the
        // ledger says WHO HAS IT, they are different questions, and a surface
        // that answers both answers neither. The note belongs on the board,
        // where it already is, and the receipt says what was bought, what it
        // cost, and what is left.
        // What the counter has just sold, and what it will not close. Built
        // BEFORE the facts so the sentence is in `prose` rather than appended
        // to a receipt that has already been rendered.
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
     * Buying a copy of a manual, which is the first real decision in the game.
     *
     * ── WHAT THIS CLOSES ─────────────────────────────────────────────────
     *
     * Two defects that were each other's mirror image, both found by playing
     * the opening. "buy a manual" was refused - the look people give somebody
     * asking for a thing that is not sold, followed by a list of millet, inns
     * and ferry crossings - while "I want to learn the Lesser Qi-Gathering
     * Manual" simply handed the road over: technique held, thirty stones
     * untouched, no teacher, no time, no house. The correct verb was blocked
     * and the free one worked.
     *
     * `items.md` has always said what should happen instead: below the line,
     * common manuals sell at a market stall next to the cooking pots, and a
     * poor cultivator's first real decision is whether the money goes on a book
     * or on food. That decision did not exist anywhere in the game.
     *
     * ── THREE ANSWERS, AND THE MIDDLE ONE IS THE GOOD WRITING ────────────
     *
     * A name that is not a book at all falls through to the ordinary price
     * board, which is why this returns null rather than refusing.
     *
     * A book the stall does not carry keeps the refusal it already had, and
     * that refusal is CORRECT for it - `items.md`: above the line, cash is
     * simply not the medium, not "expensive" but not for sale. What is added is
     * that it now names what would work instead, which the old one did not.
     *
     * A book the stall does carry is sold, for stones, priced through the same
     * `localPrice` the market board quotes with.
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

        // ── the stall, read ──
        //
        // A category is a question about the whole set and must reach the
        // listing rather than be handed to a fuzzy matcher, which is the rule
        // `GENERIC_PILL_PHRASE` and `GENERIC_HOUSE_PHRASE` already follow. This
        // is the sentence a player types first and it is the one the old
        // refusal answered worst.
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

        // ── BUYING IT OFF THE PERSON HOLDING IT ──────────────────────────
        //
        // Ahead of the stall, so somebody standing in front of you asking less
        // than the counter is who you deal with. A listing nobody can act on is
        // the defect this repo calls a refusal that names no door, and the
        // whole point of a market of people is that the price has a person
        // behind it.
        //
        // WHAT MOVES IS A COPY, AND THAT IS WHY IT IS ALLOWED TO. Every offer
        // reachable this way is `isCommonlyHeld` or awkwardness rung 1, and
        // `manuals.md` says a common book may be written out by anybody holding
        // one. Nothing is duplicated that the world is short of: rungs 2 and 3
        // never appear as an offer at all, so no house's inner shelf leaves
        // through here at any price.
        //
        // AND THE PROVENANCE TRAVELS. `recordACopyHeld` is the same write the
        // stall makes, and the seller's name goes onto the knowledge row beside
        // it - so *where did you get that* has an answer two centuries later,
        // which is half of what `items.md` means by holding being a signature.
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
     *
     * Both ways count. A held copy is the obvious one; an art already PRACTISED
     * is the one that was nearly missed, and buying a second copy of something
     * you have known for a century is the sort of sale a market should not
     * offer and a player should not be charged for.
     */
    private alreadyHasACopyOf(cultivator: Cultivator): (thingId: string) => boolean {
        const held = new Set(copiesHeldBy(this.db, cultivator.id));
        const known = new Set(cultivator.knownTechniques);
        return (thingId: string) => held.has(thingId) || known.has(thingId);
    }

    /**
     * Buying a copy off the cultivator standing in front of you.
     *
     * The other half of the stall, and the half with a person on it. What
     * separates the two is not the price - it is that this one comes with a
     * reason attached, and the reason is a fact about the seller the buyer can
     * act on: somebody who needs stones is a cheaper afternoon than a counter,
     * and somebody who should not be seen holding a thing is a cheaper
     * afternoon still and a worse decade.
     *
     * ── WHAT IS AND IS NOT DUPLICATED ────────────────────────────────────
     *
     * A copy. `manuals.md` is explicit that a common book may be written out
     * again by anybody who has read it to its end, which is what makes them
     * plentiful, and every offer that reaches here is either common or the
     * awkwardness rung `betrayalOfSelling` calls "somebody will want to know
     * where you got it". Rungs 2 and 3 - a house's own working manual, and the
     * top of any shelf - are withheld upstream and never appear as an offer, so
     * nothing scarce is manufactured here.
     *
     * ── AND THE SELLER IS ON THE RECORD ──────────────────────────────────
     *
     * The knowledge row written when the offer was heard says who this came
     * off, which is what makes *where did you get that* answerable later. The
     * art itself is the other half of that record and always was:
     * `unauthorisedPractice` names the houses who would want a word with
     * anybody practising something that is not theirs.
     *
     * Returns null rather than a refusal when the purse will not cover it, so
     * the caller falls through to the stall - a player who cannot afford the
     * person may still be able to afford the counter, and being told "no" by
     * the first of two sellers is not an answer to the question they asked.
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
            // ── WHO WILL WANT A WORD WITH YOU, WHICH IS NOT WHOSE IT IS ──
            //
            // `unauthorisedPractice` is the join, and this is the site it is
            // right for. It answers who will want a word with the person SEEN
            // PRACTISING a thing that is not theirs, and it drops your own
            // house from the list because being one of theirs is the answer to
            // the question. That filter makes it the wrong join for a leak -
            // selling your own house's art is the case it would have gone
            // silent on - and exactly the right one here, where the buyer is
            // acquiring somebody else's signature and will be wearing it for
            // the rest of their climb.
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
     *
     * The other half of `buy`, and the missing half of gathering. `forage`
     * prices every herb it turns up and puts it in the pouch; until this
     * existed, nothing anywhere converted a pouch back into stones, so a
     * cultivator who spent a season foraging was exactly as poor afterwards
     * and carrying more.
     *
     * Resolved against THE POUCH and never against the party resolver. That is
     * the whole reason this action exists as its own verb: "I sell a Qi Grass"
     * used to reach the INTERACT table, where the engine went looking for a
     * person by that name and reported that nobody was there.
     *
     * `quoteSale` decides the number. There is no roll in a sale - the ladder
     * decides, through `regardOf`, so somebody standing well above the counter
     * is not cheated and somebody holding a thing they visibly cannot defend
     * is. This method chooses nothing except which lots go on the counter.
     */
    /**
     * Handing somebody a thing you already hold, for nothing.
     *
     * The decision half is `handing-somebody-a-thing.ts`, which opens no
     * database handle and returns deltas; this applies them. The same seam
     * `legacyAct` keeps, and for the same reason.
     *
     * Free, and every branch out of here returns through `freeAction`: nothing
     * is attempted against the recipient, so there is no roll to lose and no
     * day to spend. What it leaves is a favour they hold about the giver, which
     * is the only account in this engine that opens without leverage.
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
        // ── AHEAD OF THE POUCH, BECAUSE A BOOK WAS NEVER IN IT ───────────
        //
        // "I sell a copy of the Void-Piercing Sword Domain" is a sale and it
        // reached `Nothing on you worth a counter` - the pouch holds herbs and
        // pills, an art is a row on `cultivator_techniques`, and nothing
        // anywhere converted the second into stones. So the world's NPCs sold
        // copies to each other through `whatIsInTheirHands` while the player
        // had no path to the act at all: the rule bound everybody except the
        // person playing, which is this repo's commonest defect with the halves
        // swapped.
        //
        // Returns null when the sentence is not about an art, so a name that is
        // a herb falls through to the pouch exactly as before.
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
     *
     * ═════════════════════════════════════════════════════════════════════
     * THE ACT IS NEVER REFUSED FOR BEING WRONG. IT IS PRICED
     * ═════════════════════════════════════════════════════════════════════
     *
     * `AGENTS.md`, on agency: do not ban it and do not soften it, and the
     * answer to *may I* is *yes, and here is what it costs*. The design owner
     * said the same thing about this exact act - *"if a disciple had the gall
     * to write it out without approval the sect would easily punish them"* -
     * and the operative word is punish rather than prevent. So nothing below
     * checks permission. There are two refusals and both are about CAPABILITY:
     * you have never been taught it, or you have not taken it to the end.
     *
     * ═════════════════════════════════════════════════════════════════════
     * WHICH MAKES IT SELF-LIMITING WITHOUT A PROHIBITION ANYWHERE
     * ═════════════════════════════════════════════════════════════════════
     *
     * `couldWriteOutACopy` is the whole gate, and it is the owner's second
     * ruling: *"you'd have to master it, which would mean you are at sect
     * leader or higher"*. An ordinary disciple is not turned away from this
     * verb - they simply have nothing to write out, by the same fact that makes
     * them an ordinary disciple.
     *
     * And the consequence falls out of the reprisal resolver with nothing added
     * to it. The people who CAN leak a house's signature art are the people at
     * its own summit, and `whetherYouAreWorthTheTrouble` answers `beyond_them`
     * for exactly those people: *"stands where nothing they could do about it
     * would reach. There is a record and there is no reprisal."* A house that
     * knows precisely who did it and can do nothing is the scene, and no branch
     * anywhere produces it.
     *
     * ═════════════════════════════════════════════════════════════════════
     * AND WHETHER ANYBODY WORKED IT OUT IS NOT A NEW SYSTEM
     * ═════════════════════════════════════════════════════════════════════
     *
     * `couldTheyTellItIs` already answers whether one person watching could
     * place one art to one house, on the two axes it was written for - a rung
     * to follow what is happening, and a reference for what that house's work
     * looks like. Every person standing in the square is asked, the best answer
     * becomes the house's `KnowingStage`, and `whatTheHouseDoesAboutIt` reads
     * `canPointAt` off it. Nothing was written here to make a deed nobody
     * worked out come back as *"nobody can put a name to it"*; that is what the
     * resolver says on its own when the stage map is empty.
     *
     * Returns null when the sentence is not about an art this cultivator could
     * be selling, so the pouch sale below is reached unchanged.
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

        // ── AND WHO, STANDING HERE, COULD SAY WHOSE IT WAS ───────────────
        //
        // No witness table. `couldTheyTellItIs` is asked of everybody in the
        // square, and their reference for the house is read off the roster
        // rather than invented: one of theirs knows it whole, somebody who
        // practises the art has watched it done, and everybody else has never
        // been in the room.
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
     *
     * Three existing things joined and nothing invented: the leak as an
     * ordinary `Deed`, the reprisal resolver, and the ledger. The resolver is
     * handed the two parties and the stage map and its answer is written down
     * whatever it is - including *nothing*, which is the commonest answer and
     * the one this exists to be able to produce honestly.
     *
     * WHAT IS AND IS NOT PERSISTED. A record is always written where somebody
     * can point at the deed, because a house that knows is a house that holds
     * it in eighty years and that is the half that lasts. A crippling or a term
     * of years is written ONLY where the resolver actually landed one - the
     * design owner's *"maybe cripple their cultivation"* and *"or a dao oath"* -
     * and where the offender stands beyond what the house could reach, the
     * answer is standing and rumour, which is what the record IS.
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
            // ── DERIVED, AND IT IS WHAT DECIDES WHICH OF THE TWO LANDS ───
            //
            // `whatTheHouseTakes` reads this as an investment question - is
            // there something in them the house can still use - and the answer
            // is genuinely different for the two kinds of leaker, which is why
            // both of the owner's answers are reachable from one call.
            //
            //   AN OUTSIDER holds a thing the house wants back: the copy, and
            //   the account of who put it in their hands. Keeping them is worth
            //   something, so it takes the years.
            //   ONE OF THEIR OWN holds nothing the house has not got. There is
            //   no question about where they got it and nothing to be gained by
            //   feeding them for sixty years, so it takes the capability -
            //   *"maybe cripple their cultivation so they couldn't do it
            //   again"*, which is the sentence this whole task began with.
            //
            // `wouldBeMissed` is whether anybody would write about them, which
            // is what wearing colours means, and it only steps the band that
            // decides whether they are worth noticing at all.
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
     *
     * `handleInventory` has been complete since alchemy was written and no
     * sentence reached it. Rendered here rather than left to the summariser,
     * for the same reason `list_recipes` is: the handler returns rows and no
     * `narrationHint`, and the last-resort line for a body nobody can summarise
     * is "It is done. Nothing about it drew attention." - which is what a
     * player asking what they were carrying was actually told.
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

        // ── AND WHAT IS BEING CARRIED THAT IS NOT MEDICINE ────────────────
        //
        // Found by playing, by the design owner, and it read as the surface
        // lying: `ADMIN grant_item ordinal=46 kind=artifact` answered GRANTED
        // with the catalog id, and then `what am I carrying`, `what am I
        // holding` and `inventory` all said "Nothing in the pouch at all".
        //
        // The grant was real. `addToPouch` wrote the row, and it is still
        // there - what could not see it is this read, because `handleInventory`
        // is an ALCHEMY tool and `listPouch` filters to pills and herbs by
        // design. `listCarriedArtifacts` is the accessor for the other kind and
        // it has had exactly one caller, `carriedArtifact`, which prices a
        // fight nothing has ever asked it to price.
        //
        // So a rated object was in the database, invisible to every sentence a
        // player can type, and worth nothing in a fight. A write nobody can
        // read is indistinguishable from a write that did not happen, and this
        // is the verb whose whole job is to say what you have.
        const carried = listCarriedArtifacts(this.db, cultivator.id)
            .map(entry => ({ entry, record: getArtifact(entry.itemId) }))
            .filter((row): row is { entry: typeof row.entry; record: NonNullable<typeof row.record> } =>
                row.record !== undefined);

        // ── AND WHAT IS IN THE YARD ──────────────────────────────────────
        //
        // A third shelf in the same table, and the same defect a third time:
        // a bought mule is a row `getArtifact` cannot name, so the filter
        // above dropped it and the verb whose whole job is to say what you
        // have said "nothing in the pouch at all" over something that cost
        // thirteen stones. A counted conveyance is not a rated object and has
        // no artifact row and never will - it is an AMOUNT, which is exactly
        // why it reads through the counted accessors instead.
        const yard = countedConveyancesHeld(this.whatIsInTheirYard(cultivator));

        // ── AND THE BOOKS, WHICH ARE THE COMMONEST THING A PLAYER BUYS ────
        //
        // The same defect as the artifact one above, one shelf over, and found
        // the same way. Played:
        //
        //   > I buy the Lesser Qi-Gathering Manual
        //   "11 spirit stones of the 30 you had, and the copy is yours."
        //   > what do I have
        //   "Nothing in the pouch at all."
        //
        // The purchase is real and the provenance line is exact; what could not
        // see it is this read. `recordACopyHeld` writes to the knowledge table
        // rather than to `cultivator_pouch`, which is right - a copy has a
        // history and a person it came from, and `items.md` is clear that is
        // what separates a tracked thing from a counted one - and it means the
        // pouch reader will never find one however long it looks.
        //
        // So the verb whose whole job is to say what you have asks the other
        // shelf too. Nothing is moved and no second row is written: the same
        // accessor `holdsACopyOf` reads, rendered.
        const books = copiesHeldBy(this.db, cultivator.id)
            .map(id => getTechnique(id))
            .filter((art): art is NonNullable<typeof art> => art !== undefined);

        // ── AND WHAT IS NOT ON YOU AT ALL ────────────────────────────────
        //
        // Ruled by the design owner, against the narrower reading this file
        // shipped with: a human DM answers "what do I have" with "on you,
        // this; in the vault, that." They do not answer "nothing, technically"
        // and wait to be asked a second question. A true answer that misleads
        // is the same defect as a confident wrong one.
        //
        // So the wide question reaches the legacy ledger. `what am I carrying`
        // does not, and the split is deliberate rather than an oversight -
        // that phrasing means something narrower and the distinction is worth
        // keeping. `inventory-phrasings.ts` decides which was asked, off the
        // player's own sentence.
        //
        // `leftByRun` is the ledger's one run-scoped read and it had NO CALLER
        // ANYWHERE IN `src/` before this line. A read of what somebody has put
        // beyond their own reach that nothing in the running game ever asks
        // for is the defect AGENTS.md names as the most-repeated here, and it
        // was sitting one shelf over from the verb whose whole job is to say
        // what you have.
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
     *
     * Two systems were dark behind this one missing case, and the second is
     * the larger. The six `heal_hp` pills could be BOUGHT and never taken - a
     * new cultivator could spend 28 of their 30 stones on a Minor Healing Pill
     * and carry it to their death - and `handleConsumePill` is the ONLY writer
     * of `FLAG_PENDING_PILL`, so `ctx.pill` at every breakthrough in every
     * played life was null and `MAX_PILL_BONUS`, the largest modifier in the
     * game and the intended way past the rungs that kill, had never fired.
     *
     * Resolved against the POUCH, for the same reason `sell` is: a pill is a
     * thing you are carrying, and the alternative reading of the sentence is a
     * person by that name.
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

        // ── THE ONE PILL THAT IS NOT A PILL ──────────────────────────────
        //
        // Before `getPill`, because it is not in that catalog and never will
        // be: an Unearned Step is an object that came down from over the Lid,
        // and `alchemy_manage.consume_pill` prices medicine somebody refined.
        //
        // This is the exemption that gives the crossing toll its meaning. The
        // design owner's ruling is that a crossing costs the body *"unless via
        // admin panel or the immortal pill that lets you skip a ordinal - that's
        // the diff between the immortal pill and the ones that give you qi, the
        // qi ones you still have to cross and risk it."* Every qi pill in the
        // pouch hands over accumulation and leaves the wall exactly where it
        // was; this one hands over the far side.
        //
        // It goes through `advanceRealm` and never through `attemptBreakthrough`,
        // which is the whole of how the exemption is expressed - no roll, no
        // failure table, no tribulation, no toll and no `bodyCost`, because none
        // of those code paths is entered. An exemption implemented as a flag on
        // the resolver would be a second set of rules for one act; this is the
        // absence of the act.
        const step = theUnearnedStepIn(chosen.itemId);
        if (step) return this.spendTheUnearnedStep(run, cultivator, chosen, step);

        // ── ASK BEFORE WASTING IT ──
        //
        // A restorative swallowed at full does nothing, is gone anyway, and
        // leaves toxicity - so it is strictly worse than not taking it. The
        // engine says so afterwards now, which was an improvement on saying
        // nothing, but afterwards is the wrong moment: the pill is already
        // spent. Found by playing, at eighteen of the thirty spirit stones a
        // cultivator starts with.
        //
        // A refusal rather than a prompt, because this layer has no way to ask
        // a question and wait. The player says it again with `anyway` and it
        // goes through, which is the same shape every other deliberate
        // override in this game takes.
        const pill = getPill(chosen.itemId);
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
     *
     * `takeTheUnearnedStep` decides all of it off the catalog's own contract -
     * one boundary, grade caps the destination, 41 is a hard stop, once per
     * life, and a crossing taken short of Perfection leaves an `incomplete`
     * foundation. Nothing is re-decided here; this writes.
     *
     * ── SPENT ON EVERY BRANCH, INCLUDING THE ONES THAT DO NOTHING ────────
     *
     * `ONCE_IN_A_LIFE` is explicit: *"a second one of either does nothing at
     * all to somebody who has already taken one - it is simply consumed against
     * a body that will not take it twice."* So the pouch row goes on a refusal
     * as well, and the refusal says so, because a player who does not know that
     * has been handed a trap rather than a rule. The one exception is the wall
     * refusal: standing in the wrong place is not a decision they have taken
     * yet, and charging for it would make the object impossible to aim.
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
     *
     * ONE COMMAND, THREE COSTS. Finding the next volume, being taught it, and
     * writing it yourself are the same question - how does this book get
     * further - asked of a world that answers differently depending on what you
     * have. `assessAcquisition` funnels all three and returns the same
     * `AcquisitionReport` whatever the route, so this layer picks no winner: it
     * asks about each and prints what came back.
     *
     * The read is free and it is the point. A player standing at a ceiling has
     * three things they might do and no way to compare them; the engine has
     * always been able to price all three and nothing ever asked it to.
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

        // ── SAY EACH SENTENCE ONCE ───────────────────────────────────────
        //
        // Found by playing: "what are my options" printed one sentence SIX
        // times. Two multiplications on top of each other, and neither is a
        // fault in the assessment.
        //
        // `AcquisitionReport.headline` is `lines[0]` by construction, so
        // rendering the headline and then the whole of `lines` says the first
        // sentence twice per route. And most of what the assessment returns is
        // a fact about the MANUAL rather than about the route - whether it
        // suits this cultivator, where it ends, what its opening costs - so the
        // same sentence comes back from all three.
        //
        // The fix is to render on that split rather than to trim a duplicate:
        // what every route says is said once, above them, and each route then
        // carries only what is true of that route. Three bare "open."s under a
        // shared reason is the honest shape of the answer - the routes really
        // are equivalent here - and it is one screen rather than six lines of
        // the same clause.
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

    // ─────────────────────────────────────────────────────────────────────
    // THE THREE QUESTIONS A STUCK PLAYER ASKS
    //
    // Measured dead by `scripts/playtest-the-drive.mjs` over the real
    // endpoint, in the words a person types. Every one of the three is a
    // GATHERING of state this class already reads for other purposes, handed
    // to a renderer that holds no thresholds of its own. Nothing below
    // computes a ceiling, decides who teaches, or prices a road; it reads six
    // engine functions and repeats what they said.
    // ─────────────────────────────────────────────────────────────────────

    /**
     * The arts that could be learned, filtered by everything that decides it.
     *
     * Realm, spirit root, dao standing and the run's own scarcity are all the
     * handler's, and this layer chooses none of them. The conflicting list is
     * shown WITH its warning rather than hidden: an art that fights the root is
     * learnable, and it is the trade the genre is actually about.
     */
    private async listTechniques(
        run: Run,
        cultivator: Cultivator,
        target?: string
    ): Promise<Execution> {
        // ── ASKING ABOUT ONE BOOK, WHICH IS NOT ASKING FOR IT ────────────
        //
        // "can I learn the Lesser Qi-Gathering Manual" and "what would it cost
        // to learn it" are questions, and until this existed the first of them
        // LEARNED IT and the second reached nothing at all. See
        // `ASKING_RATHER_THAN_DOING` in `actions.ts` for the routing; this is
        // where the question gets its answer.
        //
        // Free by construction. It is a read of the same three facts the
        // refusal in `handleLearn` is built from - what the stall asks, what
        // this cultivator is carrying, and who teaches it - so the answer to
        // "may I" and the answer to "I do" can never disagree.
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
        //
        // A cultivation manual is a hard ceiling: at or past its cap, progress
        // is zero, not slow. Before this, the only way to find out that the
        // book you picked up ends at seventeen was to reach seventeen. That is
        // not difficulty, it is a trap, and it is also the reason the corridor
        // above the middle of the ladder reads as a wall instead of as a road.
        const carries = (row: Listed): string =>
            row.class !== 'cultivation'
                ? ' It carries nobody anywhere; it is an art, not a road.'
                : row.carriesToRank
                    ? ` It carries a cultivator as far as ${row.carriesToRank} and no further.`
                    : ' It carries a cultivator the whole way.';
        const compatible = (body.compatible ?? []).filter(row => row.known !== true);
        const conflicting = body.conflicting ?? [];

        const lines: string[] = [];

        // ── WHAT YOU ARE ALREADY PRACTISING, WHICH IS THE QUESTION ───────
        //
        // Played, and it is a hole rather than a wording problem: "what arts do
        // I know", "what techniques do I have", "list my techniques" and "what
        // am I practising" all reach THIS surface, and every one of them was
        // answered with the LEARNABLE list - which filters `known !== true`, so
        // the art the player is actually practising is the one row guaranteed
        // to be missing. After `I learn the Lesser Qi-Gathering Manual`, the
        // Lesser Qi-Gathering Manual vanished from every listing in the game
        // and no sentence anywhere named the method being practised.
        //
        // The filter above is right for the list it makes - a road you are
        // already on is not a road you could be taught - and the fix is not to
        // stop filtering it. It is that the answer opens with what is held,
        // because that is what four of the five ways of asking were asking for,
        // and because a method's CEILING is the fact a player most needs and
        // this is the only surface that prints one.
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
     *
     * Every gate is `handleLearn`'s - realm, dao standing, element, and whether
     * a copy exists in this run at all - and every one of them refuses with the
     * measured reason. This layer resolves the name against the whole catalog
     * rather than against what is already known, because the sentence is about
     * something they do NOT have yet.
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

        // ── A COPY THEY TOOK IS A COPY THEY HAVE ────────────────────────
        //
        // `handleLearn`'s upper gate refuses anything above the common shelf
        // unless `provenance` says how it was got, and its own refusal names
        // the third road: "or find a copy. `provenance` records which of those
        // it was." A stolen manual is that road, and until the enum had a word
        // for it the theft moved the row and left the book shut.
        //
        // `taken` rather than `found_in_place`, ruled: a copy that reads as
        // found is a copy nobody can ever be caught holding, which deletes the
        // consequence the taking exists for. The book opens; what stays true is
        // that `ownerId` still names the house and the chain still says stolen.
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

        // ── WHETHER IT IS FOR THEM, IN THE SAME BREATH ───────────────────
        //
        // A miss has to be legible in the MOMENT. `assessFit` writes the
        // sentence - "it is sound. It is written for water. This cultivator
        // draws fire. Sitting with it will teach them nothing, however long
        // they sit" - and nothing returned it, so a player who picked up an art
        // that did not suit them learned the wrong lesson: sit longer, rather
        // than go somewhere else. That inversion is the exact thing the
        // suitability layer exists to prevent.
        //
        // Said on success as well as on refusal, deliberately. Being told what
        // you have just taken on is worth more than being told what you were
        // stopped from taking, because the thing you took on is the one you are
        // about to spend a decade with.
        const catalog = getTechnique(technique.id);
        // ── AND A SUITABILITY LINE MUST NOT ARGUE WITH A REFUSAL ─────────
        //
        // `suitability.ts` writes, for a book that suits somebody, "there is
        // nothing standing between them and it except the work" - which is
        // true about FIT and false about acquisition, and appending it under a
        // refusal produced this, in play:
        //
        //   "A stall asks about 8 spirit stones for a copy, and Lin Baoqing is
        //    carrying 30. ... There is nothing standing between them and it
        //    except the work."
        //
        // Two sentences of the same paragraph disagreeing about whether the
        // player can have the book. The miss cases still say their piece under
        // a refusal, because a miss is exactly what the layer exists to make
        // legible in the moment and it never contradicts one; the SUITED line
        // is the only one that claims the road is open, so it is the only one
        // withheld when the road is not.
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
     * Which rooms of the house this person speaks for.
     *
     * The read that makes an order given in the house's name a decision rather
     * than a trap. `whoIsInChargeOfWhat` deals portfolios deterministically and
     * with no RNG for exactly this reason - *"a player has to be able to work
     * out whose door to knock on before knocking"* - so the answer here is
     * knowable in advance and stays the same when asked twice.
     *
     * ── IT READS PORTFOLIOS AND NEVER `Sect.office` ──────────────────────
     *
     * The hard rule, restated at the point of the read because this is where
     * somebody would break it. Jurisdiction is `APortfolio`. `Sect.office` is
     * the Protector's chair, sits off the ladder, and the design owner ruled
     * that a member does not know whether their house has one - *"an empty
     * chair and a filled one look identical from inside the house."* Naming it
     * here would tell a member the one thing they are not told, and the two
     * fields are one word apart.
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
     *
     * Found by playing: "I take a manual from the sect library without asking"
     * was answered with prose saying the hand closed around it, and NOTHING
     * MOVED. `steal` is an intent on `interact`, `factsForInteraction` says
     * outright that the intent is "carried for the narrator; read by no
     * conditional", and `transferPossession` - the one function that moves a
     * row - had callers for trade, bequest, estate, hunting and legacy, and not
     * one for a taking.
     *
     * `house-property-theft.ts` holds the act and the reasoning. This resolves
     * the sentence, supplies the two facts about the played world that a pure
     * function cannot have - who is holding what, and who is standing here -
     * and writes what comes back.
     *
     * THE ORDER IS THE WHOLE THING. The object moves because the player took
     * it; notice is decided after and separately; the record opens only if it
     * was noticed. Backwards, an unnoticed theft becomes a theft that did not
     * happen, which is the defect this verb exists to close wearing different
     * clothes.
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
            // primers that reason is not "go and siphon it". A house holds
            // several copies of an ordinary manual and none of a deep one, so
            // what is being refused here is that there is no single row to
            // move - not that the player should reach for the other crime.
            // Pointing at `siphon` for a book would be a sentence that reads
            // like help and sends somebody to a verb that takes stones.
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
     *
     * ── WHAT WAS MISSING ─────────────────────────────────────────────────
     *
     * `encounters/duties.ts` promises this in its own opening lines - "the
     * house calls on you. You may refuse, and refusing is a row in the
     * obligations ledger rather than a shrug" - and every piece of it was built
     * except the answer. `recordEncounters` discarded `occurrence.duty`, so a
     * summons interrupted a span, printed a sentence and was gone; `refuseDuty`
     * was called exactly once in the repository, with `'failed'`, on the branch
     * where the cultivator had died. `'refused'` and `'lapsed'` had no caller.
     *
     * `pending-summons.ts` keeps the ask. This chooses which of three things
     * the player is doing with it and composes the sentence; the outcome is
     * `resolveAct`'s and the ledger row is `refuseDuty`'s.
     *
     * ── THE PRICE IS SHOWN BEFORE IT IS SPENT ────────────────────────────
     *
     * Ruled by the design owner: *a player should be able to see what saying no
     * will cost - otherwise it is a trap rather than a decision.* So the free
     * branch is not a fallback, it is half the verb, and it is `affordable`'s
     * figures verbatim. Nothing here recomputes a curve.
     *
     * ── AND IT IS THE ONE ACT THE BOTTOM RUNG CAN PERFORM ────────────────
     *
     * `POWERS_BY_TIER.ordered` is empty, so before this an ordinary member could
     * spend no standing and their credit with the house only ever recovered.
     * Refusing runs through the same `resolveAct` as every leadership act, which
     * lights the non-head branch of an escalation ladder that was written and
     * unreachable: obstruction, then their own line walking, then
     * `dismissedFromTheHouse`. A member being thrown out by their own house is
     * that existing branch finally having an input, not a new mechanic.
     */
    private async refuseWhatTheHouseAsked(
        run: Run,
        cultivator: Cultivator,
        pricingOnly: boolean
    ): Promise<Execution> {
        const today = Math.floor(run.elapsedDays);
        const pending = readPendingSummons(this.repos, cultivator.id);

        // ── NOBODY ASKED ─────────────────────────────────────────────────
        //
        // A refusal with nothing to refuse is not an error and must not be
        // answered like one. `positionIn` separates the two reasons, because
        // they want opposite things from the player: somebody in no house is
        // told what would have to be true for anybody to send for them, and a
        // member is told that nothing is outstanding, which is a fact about
        // their house rather than about their sentence.
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

        // ── SAYING IT ────────────────────────────────────────────────────
        //
        // The order matters and is the same order `completeDuty` uses: the
        // house's answer is resolved, the standing is spent, and the ledger row
        // is written, before anything is narrated. A refusal the player reads
        // about that is not in the database is the failure mode the whole
        // authority rule exists to prevent.
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

        // ── THE DISMISSAL HAPPENS BEFORE IT IS SAID ──────────────────────
        //
        // `resolveAct` decides it; the row has to go for it to be true.
        // Narrating a dismissal off an `ActOutcome` field while the membership
        // sat untouched would be the engine asserting an outcome with no state
        // change behind it, which is the one thing the authority rule forbids
        // outright - and it would have read perfectly in the prose.
        //
        // `removeMember` is `handleLeave`'s own call, so being thrown out and
        // walking out forfeit identically. The contribution is read off the
        // position taken before the removal, because after it there is no row
        // to read it from.
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
        // ── REQUIRED, WITHOUT BEING SAID TWICE ───────────────────────────
        //
        // Set directly rather than through `sayThisWhateverTheNarratorDoes`,
        // which PUSHES onto `lines` and `prose` as well - and these lines are
        // already in both. Played, that helper printed the refusal, then
        // printed it again underneath itself. `combat-verbs.ts` assigns this
        // field the same way and for the same reason: the line is already
        // narrated, and what `required` adds is that it survives a model that
        // would otherwise summarise it away.
        //
        // Kept to two. `README.md` is explicit that this channel is for what a
        // player cannot play without, and that a line stapled to the end of
        // good prose is a cost - so the outcome and the dismissal qualify, and
        // the obstruction flavour does not.
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
     *
     * `sect_members.contribution` is one of three independent axes of standing
     * and until this existed it had NO EARNER. `handlePromote` spends it,
     * `handleStipend` credits a trickle of it, and nothing anywhere could add
     * to it deliberately - so "I do sect work for contribution" was answered
     * with the mortal job board, which pays in cash and moves no standing at
     * all. A ladder with a rung nobody can climb is a ladder with a ceiling
     * nobody was told about.
     *
     * Two halves, and the split is the same one every other committing verb in
     * this file uses: an unnamed duty is a READ of the wall, and a named one is
     * an oath. The read shows the refusals too, each carrying the engine's own
     * line about why - because an empty board and a board full of work beneath
     * somebody are different facts, and an Elder standing in front of the
     * second one should be told which it is.
     *
     * Every number is `sectBoardFor`'s. This method chooses which line, and
     * nothing else.
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

        // ── WHAT THE BOARD CALLS IT ──────────────────────────────────────
        //
        // The tier, first, because it is the first thing a person reads off a
        // notice and the board had never printed one. `tierNameFor` is the
        // house's own word for the band, and the band is `dutyTermsFor`'s -
        // already computed, already carried on `terms.regard`, and rendered
        // here rather than paraphrased. There is no second difficulty scale
        // and there must not be: the tier IS the regard band.
        const describe = (offer: DutyCandidate): string =>
            `${offer.entry.name} - ${tierNameFor(offer.terms.regard.band).toLowerCase()} at `
            + `${rankName(offer.terms.pitchOrdinal)}: ${humanDays(offer.terms.days)}, `
            + `${offer.terms.contribution} contribution and ${offer.terms.stones} spirit stone`
            + `${offer.terms.stones === 1 ? '' : 's'} on completion`
            + (offer.terms.cohort > 0 ? `, with ${offer.terms.cohort} of the house alongside` : '')
            + '.';

        // ── A SENTENCE THAT POINTS AT THE ONE LINE IS NOT A REQUEST TO READ ──
        //
        // `AGENTS.md` cites this by name under "if a near-synonym works, the
        // phrasing that fails is a bug". Played: `I take a duty`, `I take the
        // duty` and `I accept the commission` all re-listed the wall, while
        // `I take What a Poor District Has Instead of Monsters` ran - so the
        // whole subsystem was reachable only by retyping a seven-word title
        // the player had just been shown.
        //
        // The discriminator was already in the plan and was being thrown away
        // one line below. `what duties are there` carries NO target;
        // `I take a duty` carries the target "duty". Both then hit
        // `BOARD_IN_GENERAL`, which matches the bare noun either way, and the
        // early return took the reading branch before `THE_ONE_ON_THE_BOARD` -
        // written for exactly these words, twenty lines down - could be
        // reached at all.
        //
        // Narrow, on the rule about fixing the gap that was demonstrated: a
        // target has to have been typed, it has to be one of the words that
        // POINT at a line rather than at the wall - "board", "work" and
        // "whatever is going" are not in that set and go on reading - and
        // there has to be exactly one thing on the wall for "the duty" to be
        // unambiguous. With two on it, reading the wall IS the route, and that
        // is what a refusal here owes.
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

        // ── a line, taken ──
        //
        // THE DEFINITE ARTICLE RESOLVES WHEN THERE IS ONE THING TO RESOLVE TO.
        //
        // "I take the mission" against a board holding exactly one commission
        // was refused with "You read it twice and it is not there" - and then
        // named it in the next clause, which is a refusal arguing with itself.
        // A player should not have to retype a seven-word title to accept the
        // only job on the wall. Same rule `consume_pill` already follows for a
        // pouch holding one pill.
        //
        // And a DISTINCTIVE FRAGMENT is a name. The board prints "What a Poor
        // District Has Instead of Monsters"; "the poor district one" is how a
        // person refers to it, and matching only the whole string made the
        // titles - which are one of the best things in the game - a liability.
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
            // ── BEING PAID IS NOT AN INCIDENTAL DETAIL OF THE STRETCH ────
            //
            // Played: a duty ran, `completeDuty` credited contribution and
            // took the purse from 30 to 43, and the whole narration was the
            // no-manual paragraph plus "You stand at Qi Condensation Layer 1,
            // 16 years old." Not one word about the pay, on the turn that paid.
            //
            // `lines` is a LICENCE and `prose` is what the deterministic
            // narrator ships, and `shortSkip` composed the prose before this
            // ran - so pushing onto `lines` alone reached nobody at either
            // tier. The same class of omission as the starvation one fixed in
            // `b22bf98`, and the same answer: a payment is something the player
            // must end up reading, so it goes on `required`, which both front
            // doors honour.
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

            // ── AND IT BECOMES SOMETHING PEOPLE REPEAT ───────────────────
            //
            // Played and reported: two untreated wounds given to somebody in
            // the square, then `what news is there` and `what are people
            // saying about me` returned the identical unrelated line, before
            // and after. Nothing a player did ever reached the ledger the
            // whole propagation layer reads - `circulating`, `retell`, the
            // digest and `whatIsSaidAbout` all read `state.history.facts` -
            // so the board was a wage and never a reputation.
            //
            // The weight is the TIER's and is not decided twice. A commission
            // pitched where the cultivator already stands is work; one pitched
            // past what a house would send anybody at is what somebody in a
            // courtyard is still repeating. That is `Regard`'s own band read
            // into the ledger's own vocabulary, joined rather than invented,
            // and it is the same band the board printed at the top of the
            // notice.
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
     *
     * Distinct from BOARD_IN_GENERAL, which is a request to READ the wall.
     * These are somebody pointing at the single thing on it, which is only
     * ambiguous when there is more than one, and the caller checks that first.
     */
    private static readonly THE_ONE_ON_THE_BOARD =
        /^(?:the |that |this |it|one)?\s*(?:mission|missions|commission|job|duty|task|assignment|errand|contract|one|it)?\s*$/i;

    /** "the board", "sect work", "whatever is going" - a wall, not a line. */
    private static readonly BOARD_IN_GENERAL =
        /^(?:the |my |a |any |some )?\s*(?:board|wall|duty|duties|work|sect work|commissions?|assignments?|jobs?|whatever(?:'s| is)? going|anything)\s*$/i;

    /**
     * The two terms the cultivation rate wants and this layer never supplied:
     * what the manual can carry them to, and who is teaching them.
     *
     * `computeCultivationRate` reads both and both default to "not declared",
     * which is why nothing was visibly wrong - a cultivator with no manual and
     * no master cultivated exactly as fast as one with the best of both, and
     * the two most important reasons to join a house did nothing.
     *
     * Neither is invented here. `capOf` is the manual's own rated band, read
     * off the catalog row for an art this cultivator has actually been taught;
     * the guide is a real person on their own house's roster who is genuinely
     * standing above them.
     *
     * `techniqueCap` is a HARD ceiling - at or past it, progress is zero - so
     * it is deliberately the HIGHEST cap among the arts they hold, and null the
     * moment any one of them is rated to the top. Reading it any other way
     * would have a cultivator who learned a second, better manual stopped by
     * the first one.
     *
     * ── NO MANUAL IS A CEILING OF ZERO, NOT AN ABSENT CEILING ────────────
     *
     * This was the other way round for one commit and it inverted the whole
     * design. `null` means UNCAPPED, so a cultivator holding no cultivation
     * manual climbed for ever while one who took up the Lesser Qi-Gathering
     * Manual was stopped at 13 on the spot - measured at ordinal 28 as
     * `no manual -> perDay 24.0` against `cap 13 -> perDay 0.0`. The incentive
     * was to learn nothing, and a life did exactly that: ordinal 28 with zero
     * known techniques, out of a sect whose ceiling is 14.
     *
     * Zero is the honest number. A cultivator practising no method is carried
     * as far as no method carries anybody, and `techniqueExhausted` reads
     * `ordinal >= 0` as true at every rung, which is the hard stop the engine
     * and the lore both state. It is safe to be this hard because the first
     * manual is genuinely reachable: measured 30 fresh lives out of 30 able to
     * learn the Lesser Qi-Gathering Manual on turn one, so the gate costs a
     * sentence rather than a run.
     *
     * KNOWN PROSE DEFECT, reported to whoever owns `cultivation.ts`: with a cap
     * of zero the breakdown line reads "The manual ends at <first rung>", which
     * implies a manual. The factor is right and the sentence is not; it wants a
     * distinct label for "there is no manual".
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
            // THE LINE. Never `art.cap` - that is the CATALOG ceiling, and it
            // stops being the manual's real one the moment somebody writes a
            // stage onto it. A derivation does not spawn a book; it extends
            // this one, so the ceiling has to be composed rather than read.
            //
            // `effectiveCapOf` also applies contiguity, which is why the
            // holder's stage count goes in rather than the world's: a stage
            // past the end of the book is worth nothing to somebody who has
            // not reached the end of the book, and `writtenTo` on the report
            // is the separate number for what the world has managed.
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
     *
     * `CultivationOptions` has four rate terms and the six skip sites here
     * passed one of them. `techniqueBonus` and `sectBonus` both defaulted to 1,
     * which is why 30 promotions and 5,376 contribution across 52 measured sect
     * lives moved the outcome by approximately zero: `rankIndex` reaches the
     * rate through `sectBonus` and through nothing else, so climbing socially
     * was arithmetically free of effect.
     *
     * The two cultivate paths were computing disjoint halves of the same
     * options object - the MCP surface supplied these two and no ceilings, this
     * one supplied the ceilings and neither of these - so the same cultivator
     * progressed at two different rates depending on which door they came
     * through. Same derivation as `cultivationOptionsFor`, deliberately: a
     * manual half understood is half a manual, and a rank is worth what
     * `SECT_BONUS_PER_RANK` says it is worth.
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
        //
        // Two terms `computeCultivationRate` accepts and this path never sent,
        // so every manual in the played game cultivated at exactly the same
        // speed however good or bad it was. `manual-quality.ts` calls quality
        // the largest non-realm term in the game and measures a x2.13 spread
        // across its five tiers; all of it was being discarded here. The MCP
        // path in `cultivation-manage.ts` has passed `techniqueQuality` since
        // it was written, so the two front ends disagreed about the same book.
        //
        // Span is the counterweight to quality and was equally absent: nothing
        // in `src/` passed it, so `OPENING_COST_PER_EXCESS_REALM` never fired
        // and the three wide-span manuals in the catalog opened at full rate.
        // One of them reaches nine realms and should open at roughly a seventh
        // of it. Without the penalty, "find the widest book" is the whole game,
        // which is exactly what that constant exists to prevent.
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
     *
     * Two rules ride on this one field and both were inert because nothing
     * passed it, which is the same state the technique ceiling was in.
     *
     *   CONTESTED QI. Qi drawn by one person is not available to another, so
     *   occupancy is summed as DRAW rather than heads - one Deity
     *   Transformation elder crowds out sixteen mortals. A valley that
     *   comfortably carries thirty carries three hundred at a tenth of the
     *   rate, which is why a sect's elders live apart from its disciples and
     *   why putting an ancient on your own vein is a decision.
     *
     *   THE THIN-REGION CEILING. Ground poorer than the middle of the thin band
     *   carries nobody past ordinal 12 - a hard zero, not a slower multiplier,
     *   because "whole provinces exist where nobody has passed Qi Condensation
     *   in living memory" is a ceiling and a multiplier never stops anybody.
     *   All thirteen Qi Condensation rungs stay climbable on dead ground, so a
     *   cultivator born there has a full realm of runway before the ground is
     *   the thing in their way, and the answer is to move.
     *
     * The cultivator's own ordinal is in the list, because they are one of the
     * people drawing on it. Null without a loaded world, which degrades to
     * "nobody is competing and the ground is not known to be poor" - the old
     * behaviour, and honest about being a lack of information rather than a
     * measurement of an empty valley.
     */
    /**
     * Who else is drawing on this ground, as a sentence and as numbers.
     *
     * Reads `groundFor` - the SAME `GroundConditions` the rate is computed
     * from - so the sheet and the engine cannot come to disagree about how
     * crowded a place is. That is not a hypothetical: the encounter line said
     * "Sweptground comfortably carries 3 cultivators and currently holds 9"
     * while the sheet said `Ambient qi: THIN` and nothing else, and a player
     * had no way to know the second sentence was the smaller half of the story.
     *
     * Null without a loaded world, which is honest and not a failure.
     */
    /**
     * Who is drawing on a named place, for the destinations read.
     *
     * Both fields or neither: a row with a headcount and no capacity is a
     * number with nothing to compare it to. Nulls where the world holds no
     * record, which is the honest answer for a settlement the gazetteer names
     * and the world has not instantiated.
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
     *
     * Only what the world has already discovered, which is every one of them on
     * a fresh world: these are local geography rather than the hard find a rich
     * lone cave is supposed to be. Sorted by what the ground holds, because the
     * question this answers is where to go and sit.
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
     *
     * WHY THIS IS A SEPARATE READ FROM `quietGroundIn`. That one lists ground
     * nobody holds and is filtered on `discovered`, which is true of all of it
     * on a fresh world - local geography, and a farm child knows where the
     * caves are. A sect's ground is the opposite case in both halves. It is
     * seeded `discovered: false` on purpose, because its own header says so:
     * "A name you have to be given. Joining gives it; being told gives it;
     * asking in the region gives it." So the `discovered` flag is not the gate
     * here; the caller's `canPointAtLocation` is, and this read is deliberately
     * permissive so that the gate is the only thing deciding.
     *
     * WHY IT EXISTS AT ALL. `sectGroundId` had exactly two references in `src/`
     * - its own definition and the one line that builds the location - which is
     * the shape `AGENTS.md` calls a module nothing calls. 34 seats, each with a
     * generated compound inside it, road-linked to their province, and no
     * player-facing read in the game named one. The listing said "Knowing a
     * name is not an introduction. Somebody would have to put you in front of
     * them, or you would have to walk up on your own" and there was nothing to
     * walk up to.
     *
     * Sorted by name rather than by qi: this is a list of doors, and which door
     * is worth knocking on is not a question about ground.
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
     *
     * The location-record form of the predicate `somewhereReal` already applies
     * to a typed name. Both keys are tried because place records are written
     * against both over the life of a database - `seedStartingAwareness` writes
     * the birthplace under its NAME and the province under its ID, and a record
     * written under either has to satisfy this.
     *
     * `canPointAt` rather than `isAwareOf`, for the reason `destinations`
     * states at length: a name caught through a wall is a name and not a
     * destination.
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
     *
     * `seedStartingAwareness` deals out the county - the birthplace, the
     * province, the neighbouring towns - off the static gazetteer, and stops
     * there. The world's own caves, wilds and veins are not in that catalog, so
     * a new cultivator held no record for a single piece of open ground in the
     * province they grew up in, and `destinations` covered for it by listing
     * them ungated. That is the wrong half to fix: what a farm child knows is
     * where the local caves are, and knowing something is a record.
     *
     * So the ordinary ground of the home province is granted at `placed`, the
     * same stage and for the same reason as the next town along - it is not an
     * advantage, it is what everybody has.
     *
     * TWO KINDS ARE DELIBERATELY WITHHELD, and they are the two the world means
     * somebody to find:
     *
     *   DAO GROUND    `how-a-cultivator-comes-by-a-road.ts` seeds The Glass
     *                 Field, The Nine-City Assize and their siblings as
     *                 ordinary `wilds`. Nobody is born knowing where a road
     *                 teaches itself.
     *   PROSPECTED    what the world uncovered while somebody was alive.
     *                 `foundGroundIn` already refuses to name one without a
     *                 record, and this keeps the two surfaces agreeing.
     *
     * Every write is `learnIfNew`, so this is a floor and never a replacement,
     * and calling it twice writes nothing the second time.
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
     *
     * THE FIRST CONCRETE THING RANK HAS EVER BOUGHT IN THIS GAME. The world
     * seeds hundreds of chambers, each with a controlling house and its own
     * qiDensity; houses allocate days on them by standing; and ground is the
     * largest multiplier in the model - reaching ordinal 29 costs 317 years on
     * ordinary ground against 79 on a sealed vein. Every NPC in the world was
     * already getting this and the player had no route to it at all, which is
     * the AGENTS.md defect running in the direction nobody watches for: not the
     * world binding NPCs and sparing the player, but the world REWARDING NPCs
     * and excluding them.
     *
     * `groundEntitlementFor` is the identical arithmetic the advancement pass
     * runs for every member of the same house on the same day, so the player is
     * told about the world they are actually in rather than a parallel one.
     * It decides nothing about what may be asked for and writes no prose; the
     * phrasing and the refusals are this layer's.
     *
     * Null for anybody in no house, or where the world is not loaded.
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

    // ─────────────────────────────────────────────────────────────────────
    // A MATCH, A REFUSAL, AND A CHILD
    //
    // The three verbs that make the second half of a life in this world
    // playable, and between them they add no mechanism at all. Every piece was
    // built, argued out and left with no caller:
    //
    //   the price of somebody a house was not going to give up
    //                             `whatItWouldTake`, the same function the
    //                             barter verb above already runs, on the same
    //                             one scale, with no list of currencies
    //   the `marriage_pact` oath  `grudges.ts` has carried the cause since it
    //                             was written and nothing ever produced one
    //   walking out of it         `whatWalkingOutOfItCosts`, no caller in src/
    //   what a line does          `bloodlineTierForChild`, no caller in src/
    //   what a refusal leaves     `whatADeedLeaves`, which prices any deed at
    //                             all off what it cost against what they had
    //   placing a child on a word `spendAWord`, used by the world for NPCs and
    //                             reachable by no player until now
    //
    // See `src/engine/household/README.md` for the argument. Nothing in this
    // section reads which party is the played one, and nothing anywhere in it
    // branches on anybody's gender: the engine module uses ONE type for both
    // sides of a match and a test scans it for a vocabulary that would.
    // ─────────────────────────────────────────────────────────────────────

    /**
     * The `wants` term, supplied from rows for the first time.
     *
     * `resolveAttempt` has priced this since it was written and every caller in
     * this layer left it unset, so "they have an open goal you could move" was
     * FALSE in every social attempt any player has ever made - a whole term of
     * a seven-term resolver, worth as much as the tie, reading zero for the
     * life of the verb. It is the last of the three that were missing;
     * `theirTie` and `ledger` were wired when the same audit found them.
     *
     * Note what is NOT gated here. Whether somebody wants something the player
     * could reach is a fact about the world and applies whether or not the
     * player has any idea of it - the knowledge gate belongs on the READ, which
     * is `what-somebody-is-after.ts`, and putting it here would mean a player
     * who had not asked was quietly resolved against different arithmetic.
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
     *
     * `AttemptMarks` is the resolver saying what the world is now carrying that
     * it was not before, and its own header says every field is a record the
     * caller persists. Nothing persisted any of them, while `factsForAttempt`
     * told the player "it is on somebody's ledger now, and ledgers here are
     * kept" - the narrator asserting an outcome the database never took.
     *
     * Ties are still not written, and that is a stated gap rather than an
     * oversight: this layer has no relationship repository, `dealingsWith`
     * counts knowledge rows precisely because there is no relationship stat, and
     * inventing one here would put a number on the thing the design is explicit
     * should stay a judgement.
     */
    recordWhatTheAskLeft(
        run: Run,
        cultivator: Cultivator,
        party: ResolvedEntity,
        result: AttemptResult,
        action: ActionName = 'request',
        /**
         * Whether anything was actually asked for.
         *
         * False for the courtesy that asks for nothing, and it is the one place
         * this layer declines to write a record the resolver handed it. The
         * reason is that the record does not describe the event: `refusalGrudge`
         * writes "came to X with nothing but the asking and was turned down",
         * and there was no asking - somebody who does not take you up on a
         * drink has not been imposed on. Writing it would also make the cheapest
         * lever in the game self-defeating, since a missed afternoon would cost
         * the same -0.1 that a refused favour does.
         *
         * Stated rather than silent because it IS the caller second-guessing
         * the engine, which `AGENTS.md` warns about by name. The narrow version
         * of the same judgement belongs inside `refusalGrudge` and should move
         * there; this is the smallest place to hold it in the meantime.
         */
        somethingWasAsked = true,
        /**
         * What the attempt was, when what it was is a WRONG.
         *
         * ── COERCION WAS REGISTERING AS RELATIONSHIP-BUILDING ────────────
         *
         * Measured in play, at ordinal 29 against a stranger: a threat landed
         * and a theft landed, and the only thing either wrote was a `patron`
         * tie from the victim to the player, strength 0.1, roles `was_bought`,
         * with the history line "X got something out of Y". The ledger was
         * empty. So robbing somebody made you closer to them, and the standing
         * model - which reads this table - would have treated extortion as
         * rapport for as long as anybody kept doing it.
         *
         * The engine already knew better on the OTHER branch: a refused threat
         * writes a grudge, through `whatARefusalLeaves`. The successful path is
         * made to agree with it here.
         *
         * WHY THE SIGN CANNOT LIVE ON THE TIE. `relationships.ts` has hostile
         * types - `enemy`, `rival`, `sworn_enemy` - so a hostile ROW is
         * expressible. What is not expressible is a hostile STRENGTH: `strength`
         * is documented as how much the tie matters to its holder, and
         * `oddsOf` reads it as `theirTie.strength * TIE_WEIGHT`, unsigned and
         * positive, worth up to 30 points on every later approach. A row typed
         * `enemy` carrying 0.1 would therefore make the next thing you asked
         * the person you just robbed EASIER, which is the same defect wearing
         * the right word. The sign this layer really supports is the ledger's
         * KIND - `grudges.ts` names robbery and humiliation in as many words -
         * so that is where it is put, and no tie is written at all.
         *
         * `null` for everything that is not a wrong. A bribe, a courtship, a
         * recruitment pitch and a refused request are not wrongs however badly
         * they land, and `WRONG_BEHIND_INTENT` is the closed table that decides
         * which is which - the same one the reprisal reads, so there is one
         * answer to "was that a wrong" and not two.
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
            // ── ONE STANDING RECORD, NOT ONE A DAY ───────────────────────
            //
            // `createObligation` derives its id from the pair, the cause AND
            // THE DAY, so a second refusal a week later is a second row rather
            // than the same fact restated. The odds do not spiral - the
            // resolver reads the WORST open grudge and never the count - but
            // six asks left six grudges, and anything that counts what somebody
            // is carrying would have read that as six separate injuries.
            //
            // "X asked me for something and I said no" is one standing fact
            // about two people, so it is given one id. Severity is not
            // recomputed, which is the rule `grudges.ts` actually states; only
            // the identity is collapsed, and the newest refusal is the one the
            // row ends up describing.
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
        // ── AND WHAT TURNING UP AGAIN PUTS RIGHT ─────────────────────────
        //
        // Measured, and it was a soft lock wearing a mechanic. One refused
        // request writes a slight grudge worth -0.1, and -0.1 takes the
        // COURTESY - the thing the refusal itself tells the player to go and do
        // - from about 29% to about 9%. So the route out of a refusal was
        // poisoned by the refusal that named it, permanently, because nothing
        // in the player's path had ever called `settleObligation`.
        //
        // `asking.md` already says what settles it, and it is the same act:
        // *"a carter you bought a drink for last month talks more freely...
        // because he has no position to protect and you are now someone he
        // knows."* Somebody who keeps coming back wanting nothing is not
        // somebody you are still annoyed with. So a courtesy that LANDS
        // forgives the open refusal grudge between the two of them - one
        // record, settled, by the engine's own function and with its own
        // resolution vocabulary.
        //
        // It is not free and it is not automatic: the courtesy has to land, and
        // at 9% that is eleven days of turning up. That is the price of having
        // asked badly, and it is a price rather than a wall.
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
     * What agreeing to it actually does, which is the whole difference between
     * a verb and a paragraph.
     *
     * `AGENTS.md` names this failure and lists eight instances of it: a
     * subsystem built, tested, sometimes rendered, and never reached by anybody
     * in the running world. A request that lands and changes no row is that
     * failure wearing a success message.
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
     *
     * The other half of the contribution economy. Missions were the only
     * earner, so a player with stones and no time had no route to a promotion -
     * a rich cultivator and a poor one had exactly the same one.
     *
     * THE RATE IS DERIVED AND NOT PICKED. `contributionPerStoneOverDays` falls
     * out of `dutyTermsFor`'s own two lines in closed form: the base, the pitch
     * and the regard all cancel, leaving `days / 28`. The reference span is the
     * MEDIAN of what this house is actually offering right now, so the rate
     * follows the board as content changes and there is no second opinion about
     * what contribution is worth anywhere in the codebase.
     *
     * TWO RULES ON TOP OF IT, both the design owner's:
     *
     *   A DONATION IS WORTH LESS THAN THE WORK. Otherwise contribution stops
     *   meaning service rendered and becomes a second currency. The discount is
     *   the one number here that is a judgement rather than a derivation, which
     *   is why it is named, and it is steep on purpose: paying should be the
     *   expensive way to do it, taken by somebody who has stones and no years.
     *
     *   A HOUSE THAT TAKES ANY SUM FROM ANYBODY READS AS A SHOP. The floor is
     *   the lowest rank's monthly stipend, read off the sect's own table: below
     *   what the house pays its least important member in a month is below what
     *   it is worth a clerk's time to write down.
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

        // ── AND WHETHER IT WAS ANYTHING WORTH REMEMBERING ────────────────
        //
        // The kindness direction, and the one place in this file where nothing
        // has priced the deed already - so `whatADeedLeaves` prices it, which
        // is what that module is for. Its whole argument is that a gift and a
        // killing are one transfer with the sign flipped, and the weight is
        // COST AGAINST WHAT THE PAYER HAD: a hundred stones off somebody
        // carrying a hundred and one is most of a life, and off somebody
        // carrying ten thousand it is a gesture. That is exactly the
        // distinction that decides whether a house tells anybody, and it is
        // unreachable from the sum alone.
        //
        // No account is opened. `whatADeedLeaves` says what the record WOULD
        // be and the obligation ledger is not this method's to write; the
        // engine's answer here is only that the world now contains the gift.
        // A slight one is a slight fact, which is what `magnitude` is for.
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
     *
     * The measurement is unchanged and is still `howCrowdedThisGroundIs`. What
     * is new is that it is read through somebody: the design owner's ruling is
     * that reading a vein is a skill and arrives with the ladder, so a Qi
     * Condensation cultivator gets a feeling and not a capacity figure, and the
     * sheet's percentage is masked rather than a second rendering path being
     * written. See `what-you-can-tell-about-the-ground.ts`.
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
     *
     * The other half of the ruling: "this is where a master can help tell you."
     * A disciple who cannot yet feel more than heavy or thin still gets the
     * figures, because they asked somebody and were told - which is the first
     * concrete, same-day benefit a master has ever had, at the bottom of the
     * ladder where the teaching multiplier is otherwise a number nobody can see.
     *
     * Three conditions, and each one is doing work:
     *
     *   THEY CAN READ IT      `READS_A_VEIN`. Somebody who cannot survey ground
     *                         themselves has nothing to pass on.
     *   THEY WOULD SAY SO     a master on the house roll, or somebody standing
     *                         here who is in the same house. A stranger four
     *                         rungs up does not stop to explain the county.
     *   THEY CAN BE NAMED     the discovery gate, unweakened. Being told
     *                         something by somebody you cannot name is not a
     *                         thing that happens.
     *
     * It degrades on its own, which is the point: a student whose masters have
     * died, or who walks out of their house, loses the reading with everything
     * else, and nothing here has to know that happened.
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
     *
     * `state()` is synchronous and has 64 call sites in the tests alone, so it
     * is not becoming async for this. The endpoint awaits this first instead,
     * which puts the ground read on the sheet from the first paint rather than
     * from the first action.
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
     *
     * A house is worth joining because somebody in it knows more than you do,
     * and `guidanceMultiplier` is where that becomes a number - saturating at
     * about +50% eight rungs up, and falling to exactly 1 when the guide is at
     * or below you, which is the honest answer for the head of a small sect.
     *
     * `members.ts` holds 164 real people with real rungs, so nobody is
     * invented: a house with nobody above the player supplies no guide, and
     * that is a fact about the house.
     */
    private guideFor(cultivator: Cultivator): number | null {
        let best: number | null = null;

        // ── AND SOMEBODY WHO TOOK THEM ON ────────────────────────────────
        //
        // A house supplies a guide because somebody in it stands above you. A
        // person who agreed to take you on supplies one for exactly the same
        // reason, by exactly the same arithmetic, and until `request` existed
        // there was no way for a player to acquire one - so the whole of the
        // guidance term was reachable only by joining something.
        //
        // `manuals.md` calls this the third and most demanding shape a teaching
        // takes: a teacher and no book at all, where progress runs through
        // somebody's goodwill rather than an object you hold. What is stored is
        // the rung they had when they agreed, which is the honest reading -
        // somebody who climbs after taking you on has not thereby taught you
        // more, and somebody who agreed at or below your rung supplies a
        // multiplier of exactly 1 by `guidanceMultiplier`'s own definition.
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
     *
     * THE SINGLE LARGEST GAP IN THIS FILE, and it was an omission rather than
     * a bug. `simulateTimeSkip` takes an `understanding` context and this layer
     * never supplied one, on any of its six skip paths - so
     * `discoverableInsights` was handed an empty room every time. The only
     * comprehensions a played life could reach were the three that need no
     * access at all: `body` off a survived deviation, and `life_death`/`void`
     * off a survived tribulation. Three, and only by being badly hurt.
     *
     * What that cost is not confined to dao. The dao gate had to ship switched
     * OFF, because enforcing it against a world where nobody can comprehend
     * anything stops every cultivator alive at Foundation or Deity. Suitability
     * never ran, because it filters a set that was always empty. Every escape
     * route out of a stalled ladder runs through here.
     *
     * `discoveryContextFor` has been complete the whole time and is what the
     * MCP tool surface already calls, so this is the same context assembled
     * from the same rows - manuals they can actually read, a sect that will
     * teach, ground somebody has already found, and where they were born. The
     * engine supplies `runSeed` and `affinityOf` itself, which is what turns
     * suitability and the prodigy path on.
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

        // ── AND WHAT THEY ARE CARRYING ──────────────────────────────────
        //
        // `roadsCarriedByObjectsInReachOf` has supplied this to every NPC in
        // the world since it was written, and to nobody at the keyboard:
        // `discoveryContextFor` holds no `WorldState` and objects live in one,
        // so an object fit for somebody's path was a channel that bound the
        // simulation and not the played game. This layer has the world, which
        // is why the join is here.
        //
        // It goes into the SAME list as ground, tagged `artifact`, because it
        // is the same fact - what is within this cultivator's reach to
        // comprehend - and `simulateTimeSkip` reads the list back out as
        // `roadsWithinReach`. A second field beside it would be a second
        // exposure system, and the two would disagree inside a month.
        //
        // A body at a great height arrives through here and needs no code: it
        // is an object with a `power` and a `daoDomain`, and both gates the
        // ruling asks for - high enough to impart, close enough to receive -
        // are the two this reader already applies.
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
     *
     * The catalog row itself is carried on `item`, not just its value, because
     * `regardOf` reads whatever gate column that catalog uses. Passing an
     * ordinal instead would quietly drop every `regard` profile a record
     * carries.
     */
    private lotFor(entry: PouchEntry): (SaleLot & { kind: PouchItemKind }) | null {
        if (entry.kind === 'herb') {
            // ── A BEAST MATERIAL IS A REAGENT AND SELLS AS ONE ───────────
            //
            // Counted beast materials go into the pouch under `herb`, which
            // is the reagent kind - `PouchItemKind` is 'pill' | 'herb' |
            // 'artifact', it is declared in a shared file with a CHECK
            // constraint behind it, and widening a shared union for one
            // caller is not worth what it costs everybody else. The catalog
            // agrees with the choice in its own header: beast materials are
            // written in the herb catalog's idiom deliberately, same five
            // grades, same value bands, same rarity ceilings, so that an
            // alchemist buying a core and an alchemist buying a root run the
            // same arithmetic.
            //
            // Resolved BEFORE `getHerb`, and without this line the whole
            // hunting yield is dead weight: `getHerb` returns undefined for a
            // beast material, `lotFor` returns null, and `sell` silently
            // drops the row - so a player fills a pouch with pelts and cores
            // and no counter in the world will quote them. That is the same
            // half-wired shape this file's hunting verb exists to fix,
            // reproduced one layer down.
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
     *
     * The stock is held on the cultivator rather than reconstructed at the
     * moment of seclusion, which is the whole difference. Rations bought here
     * survive travel, survive a change of mind about how long to sit, and are
     * spent by the time skip - so `provisions_exhausted` becomes a fact about
     * a decision the player made rather than a warning about a resource they
     * were never allowed to hold.
     *
     * Priced off the same catalog entry the market board quotes, so the number
     * on the board and the number charged here cannot drift.
     */
    private provision(
        run: Run,
        cultivator: Cultivator,
        days?: number,
        /** A count of rations, where the sentence named one instead of a span. */
        rations?: number,
        options: { askedFor?: number } = {}
    ): Execution {
        // A COUNT IS TAKEN AS ITSELF. "Buy twenty rations" names twenty things
        // to carry, not a span to be fed for, and converting one into the other
        // in the parser would be wrong in both directions - how long a ration
        // lasts depends on the body, because hunger tapers by realm.
        //
        // No span and no count means "as much as I can carry sensibly": enough
        // for the default seclusion, which is the thing they are about to do.
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
        //
        // `parseDuration` caps at MAX_CULTIVATION_DAYS, so "nine thousand years
        // of rations" arrived here as a hundred years and the account reported
        // a hundred years as though that were what was asked. Exactly the
        // defect already fixed for seclusion, and the honest form is a few lines
        // below this one: a purse that covers less than the ask already says
        // "which is less than you went in for".
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
     *
     * Seclusion has `buyProvisions`, which also tops the pack up at the door.
     * The ordinary actions - working, gathering, travelling - do not buy
     * anything on the player's behalf; they eat what is already carried.
     * Before this existed they ate nothing at all, and a player could starve to
     * death holding fifteen rations because they had spent the week earning the
     * stones rather than sitting in a cave.
     */
    /**
     * Open a ration if the belly is low and the pack has one.
     *
     * Nobody carrying food starts a season of hauling hungry. Found by
     * playtesting: a player who did the sensible thing - buy two years of
     * rations, then take work to afford more - finished the shift at exactly
     * zero satiety and died of starvation on their next action, with a
     * fortnight of food still on their back.
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
     *
     * A read, and the one the seclusion picker prices its preview from. It runs
     * the same function `buyProvisions` runs, so the figure shown at the door
     * is the figure charged inside it.
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
         *
         * Not in the pack, because the time skip ate out of a count it was
         * handed rather than out of the flag, and the leftovers of a stretch
         * that stopped early have never gone back. Passed in by `sitBackDown`
         * so a sitting split into two halves buys food once for the whole
         * span - the alternative is charging a second purse for days that
         * were already paid for, which is a price for staying that has
         * nothing to do with the person outside and would quietly make going
         * the correct answer every time.
         */
        stillUnopened = 0
    ): { cultivator: Cultivator; rations: number; covered: number; line: string } {
        // The arithmetic is not done here. It is done in
        // `what-feeding-a-stretch-of-seclusion-costs.ts`, which is also what
        // the picker asks before the player commits - so what the door quotes
        // and what the cave charges cannot drift apart.
        //
        // What is already in the pack comes first. A player who stocked up
        // deliberately must not be charged again at the cave mouth for food
        // they are carrying, and the ones they carried in are the ones the
        // time skip eats.
        //
        // `stillUnopened` counts with the pack for the purposes of the
        // arithmetic - it is food that exists and has been paid for - and
        // separately for the purposes of the WRITE below.
        const alsoAtTheCaveMouth = Math.max(0, Math.floor(stillUnopened));
        const plan = whatFeedingThisStretchCosts(
            cultivator, this.rationsHeld(cultivator) + alsoAtTheCaveMouth, days
        );
        // NOTHING TO BUY IS NOT NOTHING AFFORDABLE, AND THEY USED TO PRINT THE
        // SAME SENTENCE.
        //
        // A cultivator from Deity Transformation up has stopped eating -
        // `SATIETY_BURN_BY_REALM` is zero there and `burnSatiety` burns nothing
        // - so there is no purchase to make and no clock to warn about. Priced
        // flat, the same body was charged 730 stones for a year of rations it
        // could not open, and when the purse was empty it was told the belly
        // covered fifty days and then starvation began. Both were false: the
        // measured run sat 1320 days at satiety 100 with the starvation counter
        // never leaving zero, and was interrupted by wounds.
        //
        // Nothing comes off the pack and nothing comes out of the purse. What is
        // carried stays carried, because the time skip will not eat it either.
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
                + (covered >= days
                    ? `That covers the whole stretch. ${updated.spiritStones} stones left.`
                    : `That is food for about ${humanDays(covered)} of the ${humanDays(days)} asked for. ` +
                      'After that the belly is empty and five turns later it is fatal.')
        };
    }

    // ── plumbing ─────────────────────────────────────────────────────────

    /**
     * What the qi is doing where this cultivator is standing.
     *
     * THE DENSITY IS PASSED, and until now it never was - by this caller or by
     * any other in the repository. `ambient.ts` has been correct the whole time
     * (at density 1.0 it puts 98.4% of the weight on `dense`) and every caller
     * omitted the figure, so everything fell through to `impliedDensityFor`,
     * which hashes the NAME of the place. Measured over the map that produced:
     * 64.1% of places typically thin, 25.2% normal, 10.8% dense, and
     * `sealed_vein` - a 4x rate - unreachable in play at any location.
     *
     * What it looked like from inside a run: six consecutive thin months
     * standing on ground whose usable density is 1.0, and a ladder that stops
     * being climbable around ordinal 16 for every character, because a 6x rate
     * swing existed in the engine and nobody could ever reach it. The engine
     * half was written long ago; this is the half that was missing, which is
     * why `geology.test.ts` passed while the game stayed thin.
     *
     * Two sources, in order of authority. The world's own location record is
     * the real answer and carries `sealed` with it - a sealed ruin sits on a
     * pocket nothing has drawn on and offers nobody any of it, so the vein is
     * rich and the usable density is nil, and only the record knows that. The
     * birth catalog's band is the fallback for a run with the world simulation
     * off, or for a place name the world has no row for. Undefined, and only
     * undefined, falls back to the hash.
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
     *
     * Passed to every entity resolver so that a sect the player has never heard
     * named simply does not resolve. `here` lets anyone standing in the same
     * place resolve regardless, which is the `encountered` stage of
     * discovery.md: you can see who is in the room without being told a name.
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
     *
     * Both populations, joined on the place name. This is the call that was
     * missing: nineteen people were at Sweptground and every social path
     * dead-ended, because the only population anybody asked about was the
     * `cultivators` table and the world's people were not in it.
     */

    /**
     * What the player's membership looks like from where they are standing.
     *
     * Joining an order is the most consequential thing a low cultivator can
     * do, and until this existed the world never mentioned it again: the seat
     * of your own sect read exactly like a strange town. Two facts, both off
     * rows - whether they belong to anything, and whether this is its ground.
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
     *
     * Three registers, and any one of them is enough. The world's own location
     * table is authoritative where it is populated; the roster covers places
     * that have people in them but no record yet; and the cultivator's own
     * knowledge covers everywhere they have been told about, which is how a
     * player reaches somewhere they have only heard named.
     *
     * Where they are already standing counts too - "I go back to Sweptground"
     * from Sweptground is a no-op, not a refusal.
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
        //
        // Two predicates now exist and the difference is deliberate:
        // `isAwareOf` licenses SAYING the name, and opens at `whisper`;
        // `canPointAt` licenses SETTING OUT, and opens at `placed`. A name
        // caught through a wall is a name and not a destination, and travelling
        // to one used to work - which meant the overheard channel, whose whole
        // design is fragments a player cannot yet place, was quietly a travel
        // itinerary.
        return this.knowledge
            .awareness(cultivator.id, 'place')
            .some(row =>
                (loosePlaceKey(row.name) === wanted || loosePlaceKey(row.id) === wanted)
                && this.knowledge.canPointAt(cultivator.id, 'place', row.id));
    }


    /**
     * Somebody standing here, when the player pointed rather than named.
     *
     * "The nearest cultivator", "the old woman", "him" - these are not names
     * and must never be fuzzy-matched into one, because that hands the player
     * an identity they have not earned and, in a fight, picks the opponent for
     * them. What they ARE is a gesture at a person in the square, which is a
     * legitimate way to indicate somebody standing in front of you.
     *
     * Returns null when the phrase looks like an actual name, so a typo in a
     * real name still fails honestly rather than hitting whoever is closest.
     */
    /**
     * The ruin the player means when they say "the ruins".
     *
     * Looked up in the world's own locations rather than invented: a place
     * whose name or kind says ruin, at or adjacent to where they are standing.
     * Returns null when the world is off or there is nothing of the sort here,
     * and the refusal above then says so as a search that came up empty.
     */
    /**
     * The ground under their feet, when the sentence says "here" rather than a
     * name.
     *
     * A CLOSED SET, and deliberately a short one. Every word in it is a way of
     * saying "where I am standing" and none of them can ever be somebody's
     * name - which is the same construction `THE_SCENE_ITSELF` uses in the
     * parser, for the same reason: a name must never land in it.
     *
     * Narrow on purpose, and this is the rule `AGENTS.md` states as fixing the
     * gap that was demonstrated. It does NOT accept "the ruins", "the shrine",
     * "the market" or anything else with a subject in it - those either resolve
     * as themselves or fail as themselves, and widening this to catch them
     * would steal sentences from `ruinAtHand` and from ordinary place
     * resolution, which is exactly the mistake that entry records.
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

    somebodyAtHand(query: string, cultivator: Cultivator): RosterEntry | null {
        const wanted = query.trim();
        if (!POINTING.test(wanted)) return null;
        const here = this.present(cultivator);

        // A pronoun is an ANAPHOR and never a description. See
        // `A_PRONOUN_FOR_SOMEBODY_ALREADY_NAMED`: the only person "her" can
        // mean is the one the player was already dealing with, and where there
        // is nobody it means nobody. Falling through to the crowd order below
        // is what put a marriage proposal to a stranger the player had never
        // mentioned.
        if (A_PRONOUN_FOR_SOMEBODY_ALREADY_NAMED.test(wanted)) {
            const last = readFlag(this.db, cultivator.id, FLAG_LAST_ADDRESSED);
            return (last ? here.find(row => row.id === last) : undefined) ?? null;
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
            const byHeight = [...here].sort((a, b) =>
                Math.abs(a.realmOrdinal - cultivator.realmOrdinal)
                - Math.abs(b.realmOrdinal - cultivator.realmOrdinal)
                || (a.id < b.id ? -1 : 1));
            return byHeight.find(row =>
                this.knowledge.isAwareOf(cultivator.id, 'cultivator', row.id)) ?? byHeight[0];
        }

        // The last of a list that has ONE order, which is the whole of what
        // makes this reproducible. See `oneCrowd` in `hearsay.ts`: this used to
        // read the last element of two independently-sorted halves stuck
        // together, so the same seed on the same day could hand
        // `combat_manage.resolve` a different opponent, and the stream is
        // seeded on the opponent's id. Nothing about "nearest" is computed
        // here - there is no distance in this world model - and the honest
        // version of that is a stated arbitrary order rather than an unstated
        // one.
        return here.length > 0 ? here[here.length - 1] : null;
    }

    present(cultivator: Cultivator): RosterEntry[] {
        return othersPresent(this.repos, cultivator, this.atHand);
    }

    /**
     * Who is here, split by whether the player can name them.
     *
     * The discovery rule, applied to people. Being in the room is permission to
     * see somebody; it is not permission to know who they are. So a face the
     * player has a record for gets a name and everybody else gets a reading of
     * how they carry themselves, and the count of the rest is a crowd rather
     * than a cast list.
     */
    /**
     * Write down the faces a life like this grew up around.
     *
     * The gate is untouched and this is deliberately an ordinary write through
     * it: `learnIfNew`, at the stance somebody holds for a face they have known
     * since before either of them was anybody, with the source and the note on
     * the row like every other record in the table. A player still cannot name
     * anybody nobody has said in front of them - what has changed is who has.
     *
     * Silent when the world is off, when the birthplace is somewhere the world
     * does not model, or when the hamlet holds nobody but the player. All three
     * are real answers and none of them is an error.
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
                named.push({ name: person.name, ordinal: person.realmOrdinal });
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
     *
     * Called from every path that consumes days, so that forty years in a cave
     * come out into a world that had forty years. The digest is built against
     * this cultivator's own knowledge, which means the same span reaching two
     * different people would tell them different things - and tell most people
     * nothing at all, which is the intended ratio and not a bug to fix.
     *
     * The count of what never reached them goes to the inspector and never to
     * the narrator. Surfacing it would turn "the world is mostly none of your
     * business" into a status line.
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
     *
     * Thin on purpose: everything about what the row contains and what the
     * world may do to it lives in
     * `the-player-as-a-row-the-world-can-invite.ts`. What this knows is the two
     * things only this layer can answer - which world is loaded, and which
     * house the sect repository says they are in.
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
     * If this turn ended the life, put the death and the estate into the world.
     *
     * ── WHAT THIS CLOSES ─────────────────────────────────────────────────
     *
     * Measured by playing, before it existed, on a cultivator who starved
     * holding two pills, three herbs, a rated object and thirty stones: every
     * pouch row still on the corpse, the purse still at thirty, zero rows in
     * `world_object_provenance` naming them, zero rows in
     * `world_chronicle_actors` naming them, their own world row still reading
     * `alive`, `world_runs` still `active`, and no grave anywhere.
     *
     * The cultivation layer had the death right - run closed, cause and
     * description written, every later act 409 - and the WORLD was told none
     * of it, because `enshrineRun` had no caller in `src/` at all.
     *
     * ── WHY IT IS HERE AND NOT AT EACH DEATH SITE ────────────────────────
     *
     * This is the only line in the package that has, at once, the closed run,
     * the dead sheet, the loaded world, the ledger, who is standing here and
     * the persist flag. Every place that can kill somebody has some of those
     * and none has all of them.
     *
     * Idempotent, which is what makes the second call site below safe: the
     * cache id is derived from the run and `LegacyLedger.write` upserts on it,
     * and `enshrineRun` will not place a second grave for an id it has already
     * placed. Returns null where nobody died, which is nearly every turn.
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
     *
     * A fact carries a location ID and the character sheet carries a NAME, so
     * the two are joined by `worldLocationFor` the way every other read in this
     * file does it. Null is honest and handled: `whoWasThere` answers a deed
     * somewhere the world does not model with the parties and no one else.
     *
     * NOT read off the player's own world row, which was the first version and
     * is wrong. `the-player-as-a-row-the-world-can-invite.ts` states outright
     * that the row's `locationId` is null and is never set - presence belongs
     * to the play layer, and a second stored source of it cost four separate
     * defects in one afternoon. This resolves the play layer's answer at write
     * time and stores nothing, so the row still stands nowhere.
     */
    worldPlaceOf(cultivator: Cultivator): string | null {
        if (!this.atHand) return null;
        return worldLocationFor(this.atHand, cultivator.location)?.id ?? null;
    }

    /**
     * Whether a name gets said in this scene, and the record for it if so.
     *
     * The write happens here, in phase 2. Phase 3 receives only a licence to
     * mention something the database already holds, which keeps the dependency
     * pointing the right way: prose can fail to use a name without the name
     * failing to exist.
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
     *
     * A practice names nothing, so unlike a name it is safe in the narrator's
     * own voice - it is the "show the world, never explain it" half of the
     * doctrine rather than the discovery half. `practices.ts` holds the one
     * narrow gate that does apply.
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
     *
     * Somebody in the same place has never heard the words, or there is nobody
     * to have not heard them. Either way the player learns the same thing - the
     * name gets them nothing here - without being told that a rule was applied.
     * Never confirms whether the thing exists, and never lists what would have
     * worked.
     *
     * ── WHY THE WITNESS IS GATED ─────────────────────────────────────────
     *
     * This sentence used to name `here[0]` outright, and that was two defects
     * in one line. Reproduced: at a settlement of fifteen strangers,
     * `I negotiate with Kong Lanwu` - somebody real and somewhere else - came
     * back "You put the words to Liang Fuhe", and the very next sentence of
     * the same refusal said "you have a name for none of them". The paragraph
     * contradicted itself because the first half was ungated and the second
     * half was not.
     *
     * The first defect is the discovery leak: `Liang Fuhe` is a name this
     * cultivator has no record for, handed over by the ERROR path, which is
     * the door discovery.md is shutting. The second is worse and is the reason
     * this is fixed ahead of the other two. The player asked for one person
     * and read the name of another, in a sentence that describes the words
     * being delivered - so what a refusal looks like from inside the game is a
     * REDIRECT, and the player now believes they spoke to somebody they did
     * not. A refusal that names a way out is this repo's pattern; a refusal
     * that quietly picks a different target is not a refusal at all.
     *
     * So: name the witness only where the player could already name them,
     * which is what makes it an earned name rather than a free one, and
     * otherwise say plainly that nobody here answers to it. Seeing that
     * somebody is standing there is not knowing who they are - the same rule
     * `nobodyByThatName` applies to the list it appends after this.
     *
     * ── AND THE DELIVERY CLAIM WAS THE SAME DEFECT, ONE LINE LOWER ───────
     *
     * The gate above fixed WHICH name is printed and left the sentence around
     * it saying `You put the words to X` - so the paragraph still told the
     * player their sentence had been delivered to somebody they never named,
     * which is the redirect this whole note forbids, surviving inside the fix
     * for it.
     *
     * **Both branches now open with the fact this refusal is actually about:
     * the NAME reached nobody.** A bystander may be named as somebody who heard
     * a stranger say something, never as the person it was said to. That
     * ordering also stops the paragraph reading as *I did not understand you* -
     * which it is not, and must not imply, because the sentence that reaches
     * here is often perfectly clear and simply names nobody who is here.
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
     *
     * Says what is there and stops. A list of who could be approached is a
     * developer affordance wearing a sentence.
     *
     * The lone-person branch is gated for the same reason `blankLook` is: one
     * stranger in an empty square is still a stranger, and printing their name
     * because they happen to be the only one there would be the discovery leak
     * arriving through arithmetic instead of through a lookup.
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
     *
     * A refusal that listed every recruiting sect in the catalog would leak the
     * world through the error path, which is exactly the door discovery.md is
     * shutting. This lists people in the room and names already held.
     *
     * INSPECTOR ONLY. It used to be appended to the refusal the player reads,
     * which made every dead end end in a list of valid targets - a developer
     * affordance, and an invitation to play the parser instead of the game.
     */
    knownNamesLine(cultivator: Cultivator, scope: KnowledgeScope): string {
        const names = nearbyNames(this.repos, cultivator, scope);
        return names.length > 0
            ? `Known to this cultivator, or standing here: ${names.join(', ')}.`
            : 'This cultivator has heard of nobody and nowhere but the ground under them.';
    }

    /**
     * Record that the player has now encountered something.
     *
     * discovery.md is explicit that each step up the ladder of knowing needs a
     * source, and that a name learned from a drunk and a name read in an
     * archive are different facts. So awareness is written with its provenance
     * rather than left to exist only in the transcript, which is where it would
     * be unauditable and unrevisable.
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
     *
     * Two sources, in the order that respects an operator's own edits: a sect
     * written into this database wins, and the shipped catalog in
     * `src/data/cultivation` answers for the ids that were never persisted. An
     * id that resolves to neither yields null rather than itself - the sheet
     * shows "unaffiliated" instead of a database key.
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
     *
     * ── THE FIELD THAT NOTHING WROTE ─────────────────────────────────────
     *
     * `Cultivator.feuds` is a stored JSON array with exactly ONE writer in the
     * whole of `src/` - `combat-manage.ts`, on the MCP tool path - so the
     * played game has never written one. The sheet's Feuds panel therefore said
     * *"No one is currently hunting you"* for the entire life of this game,
     * whatever the player did to anybody. AGENTS.md's *a field nothing writes*
     * in its purest form: not inert, reading as a value, and the value is a lie
     * with a straight face.
     *
     * The same entry prescribes the fix - *prefer deriving to storing where the
     * answer moves* - and the answer moves constantly, because whether somebody
     * can come for you changes every time either of you crosses a rung.
     *
     * ── WHAT IS ON THE PANEL, AND WHAT IS NOT ────────────────────────────
     *
     * Only the people who may act AND think it worth doing. Somebody holding a
     * grave account who cannot reach you is not hunting you, and putting them
     * on a panel headed Feuds would say they were. `whoIsComingForYou` keeps
     * the two apart and the second list is on the same return value for
     * whenever the sheet grows a place to say *they have written your name down
     * and there is nothing behind it*, which is the better half of the fact.
     *
     * The stored array is not read and not written. Its one MCP writer is left
     * alone rather than deleted, because deleting a column somebody else's
     * front door writes to is a different change with a different owner.
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
     *
     * The structure channel is included here and NOT in the narrator prompt.
     * The log is the operator's record, where a rank ordinal and a governance
     * category are exactly the right words; the prose is where they would
     * become a briefing the world does not contain.
     */
    private engineEntries(execution: Execution, turn: number, narration?: string): LogEntry[] {
        // The headline goes in UNLESS the narration already opens with it.
        //
        // With no model configured the narrator is this engine, so the prose
        // begins with the very sentence the ruling row states - and the player
        // read the same line twice, in two styles, on every single turn. The
        // ruling row exists so prose and engine can be compared and "the two
        // should never disagree"; where they are the same string there is
        // nothing to compare and the row is only noise.
        //
        // Self-correcting on purpose: a model's narration will not open with
        // the headline verbatim, so configuring one brings the row straight
        // back with no flag to set and nothing to remember.
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

// ── THE VERB FAMILIES ARE MERGED ONTO THE CLASS HERE ─────────────────────
//
// `travelVerbs` holds `GameService` methods that live in `travel-verbs.ts`.
// The declaration merge below adds their signatures to the class type and the
// `Object.assign` puts them on the prototype, so `this.move(...)` above
// resolves and typechecks exactly as it did when the bodies sat in this file.
//
// This is what lets a body be MOVED rather than rewritten: `this` stays
// `this`, so every line of a moved method is the line it was and a reviewer
// can diff it against the original. The price is that the members those
// methods reach are no longer marked `private`. That is a compile-time
// annotation and nothing else - it is erased entirely, so no runtime
// behaviour changes and nothing becomes reachable that `(service as any)`
// could not already reach.
export interface GameService extends TravelVerbs, CombatVerbs, InvestigateVerb, AskingVerbs, SituatedReads, SeclusionVerbs, CrossingVerb, MatchVerbs, SiteVerbs, InstitutionVerbs {}
type TravelVerbs = typeof travelVerbs;
type CombatVerbs = typeof combatVerbs;
type InvestigateVerb = typeof investigateVerb;
type AskingVerbs = typeof askingVerbs;
type SituatedReads = typeof situatedReads;
type SeclusionVerbs = typeof seclusionVerbs;
type CrossingVerb = typeof crossingVerb;
type MatchVerbs = typeof matchVerbs;
type SiteVerbs = typeof siteVerbs;
type InstitutionVerbs = typeof institutionVerbs;
Object.assign(GameService.prototype, travelVerbs, combatVerbs, investigateVerb, askingVerbs, situatedReads, seclusionVerbs, crossingVerb, matchVerbs, siteVerbs, institutionVerbs);
