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
import { LOW_SATIETY, stagnationRemaining, turnsUntilStarvation } from '../engine/cultivation/survival.js';
import type { ManualQuality } from '../schema/cultivation.js';
import type { ManualBand } from '../engine/cultivation/cultivation.js';
import type Database from 'better-sqlite3';
import {
    SATIETY_MAX,
    // The settling clock, which `stagnation_aging` kills on. Read for the
    // ceiling report so a player is told about it before it is spent, rather
    // than in the death line.
    stagnationYearsForOrdinal,
    // `STARTING_SPIRIT_STONES` is deliberately gone from here: what a run opens
    // with is now a property of the birth rather than a constant, and nine
    // births in ten still draw about that figure. The constant stays exported
    // from the schema as the thin-county tier's own number.
    type AmbientQi,
    type BreakthroughResult,
    type Cultivator,
    type Run,
    type SimEvent,
    type TimeSkipResult
} from '../schema/cultivation.js';
import { ambientForBlock } from '../engine/cultivation/ambient.js';
import { attemptBreakthrough, canAttemptBreakthrough } from '../engine/cultivation/breakthrough.js';
import { MAX_ORDINAL, rankName } from '../engine/cultivation/realms.js';
import { forStream } from '../engine/cultivation/rng.js';
import { describeBirth, drawBirth, groundDensityFor } from '../engine/birth/birth.js';
import { rollAttributes, rollSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import { SATIETY_COST_PER_ACTION } from '../schema/cultivation.js';
 import {
    ACTIONS_PER_FULL_SATIETY,
    describeDeath,
    evaluateDeathConditions,
    satietyBurnMultiplier,
    stillNeedsToEat
} from '../engine/cultivation/survival.js';
import { simulateTimeSkip } from '../engine/cultivation/time-skip.js';
import { rollHerb } from '../data/cultivation/index.js';
import {
    PRICES,
    cashToStones,
    findWorkForOrdinal,
    getPrice
} from '../data/cultivation/mortal-world.js';
import {
    localPrice, canAdvanceHere, requireRegion, REGIONS
} from '../data/cultivation/regions.js';
import {
    treatWorstInjuries,
    untreatedInjuries,
    untreatedInjuryCount
} from '../engine/cultivation/injuries.js';
import { isPermanentWound } from '../data/cultivation/wounds.js';
import { FOUNDATION_ORDINAL } from '../engine/cultivation/realms.js';
import { InjurySchema, type Injury } from '../schema/cultivation.js';
import { ladderOddsReport, type LadderOddsReport } from '../engine/world/ladder-odds.js';
import { round2 } from '../server/consolidated/cultivation-support.js';
import { setDb } from '../storage/index.js';
import { resetCultivationWorlds } from '../server/state/cultivation-world.js';
import { SECTS, getSect, getTechnique } from '../data/cultivation/index.js';
import { capOf, classOf } from '../data/cultivation/techniques.js';
import { NO_MANUAL_CEILING, carryingCapacityFor, techniqueCeiling } from '../engine/cultivation/cultivation.js';
import { getSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import { getMembersOf } from '../data/cultivation/members.js';
import {
    auditAncestralClaim,
    getSectAncestry,
    getSectsTeaching,
    sectThreat
} from '../data/cultivation/sects.js';
import {
    APEX_INSTITUTIONS,
    COURTS,
    chainToApex,
    getApexInstitution,
    getCourt,
    getParentage
} from '../data/cultivation/hierarchy.js';
import { getChannel } from '../data/cultivation/crossings.js';
import { getHoldingsOf } from '../data/cultivation/immortal-items.js';
import { DISASTER_RESPONSES } from '../data/cultivation/catastrophe.js';
// `OPENLY_OR_IN_SECRET` moved out of `catastrophe.ts` into `standoff.ts` while
// this was being written. Imported from where it lives rather than from the
// file it used to live in.
import { OPENLY_OR_IN_SECRET } from '../data/cultivation/standoff.js';
import { IMMORTAL_MOTIVE } from '../data/cultivation/crossings.js';
import { baseReservesFor } from '../engine/cultivation/embezzlement.js';
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
    requiredOrdinalForRank,
    requiredContributionForRank
} from '../server/consolidated/sect-manage.js';
import {
    handleAdmission,
    handleCurriculum,
    handleExpel,
    handleOrder,
    handleRecruit
} from '../server/consolidated/sect-leadership.js';
import {
    handlePetition,
    handleWake
} from '../server/consolidated/sect-politics.js';
import { handleResolve } from '../server/consolidated/combat-manage.js';
import {
    handleLearn,
    handleListAvailable,
    handlePractise,
    holdsACopyOf,
    recordACopyHeld
} from '../server/consolidated/technique-manage.js';
import {
    isSoldAtAStall,
    manualsAStallCarries,
    stallPriceStones
} from '../engine/world/what-a-copy-of-a-manual-costs-at-a-stall.js';
import {
    FLAG_NAME_TAKEN,
    FLAG_PENDING_PILL,
    clearFlag,
    ensureCultivationDb,
    addToPouch,
    discoveryContextFor,
    listPouch,
    removeFromPouch,
    type PouchEntry,
    type PouchItemKind,
    isGuidingErrorBody,
    listTolls,
    persistFoundation,
    persistToll,
    readFlag,
    readJsonFlag,
    writeFlag,
    tollConditionsFor,
    type CultivationRepos,
    type PendingPill,
    type TollLedgerEntry
} from '../server/consolidated/cultivation-support.js';
import { applyTimeSkip, tollLine } from './apply.js';
import {
    DEFAULT_BURIAL_DAYS,
    DEFAULT_CULTIVATION_DAYS,
    DEFAULT_ERRAND,
    DEFAULT_SECLUSION_DAYS,
    DEFAULT_WORK_DAYS,
    GATHERING_DAYS,
    MAX_CULTIVATION_DAYS,
    TRAINING_DAYS,
    DEFAULT_RECALL_INTENT,
    DEFAULT_SITE_INTENT,
    DEFAULT_OFFER_INTENT,
    DEFAULT_PETITION_INTENT,
    DEFAULT_POSTURE_INTENT,
    DEFAULT_SEAL_INTENT,
    OFFER_INTENTS,
    PETITION_INTENTS,
    POSTURE_INTENTS,
    RECALL_INTENTS,
    SEAL_INTENTS,
    SITE_INTENTS,
    parseCount,
    durationAskedFor,
    type ActionName,
    type OfferIntent,
    type PetitionIntent,
    type Plan,
    type PlanSource,
    type PlannedAction,
    type PostureIntent,
    type RecallIntent,
    type SealIntent,
    type SiteIntent
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
    elderRungTitle,
    mayCommitTheHouse,
    offeringKey,
    opensAtRung,
    positionIn,
    creditIn,
    spendStanding,
    rankDoesNotReach,
    readOffering,
    readPosture,
    readSpentSeal,
    sealKey,
    servesNoHouse,
    postureKey,
    rankAndIndex,
    standingStructure,
    type HousePosition
} from './standing.js';
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
    DEFAULT_LEGACY_INTENT,
    LEGACY_INTENTS,
    LegacyLedger,
    handleLegacy,
    phraseIn,
    pouchStacks,
    type LegacyIntent
} from './leaving-things-for-the-next-life.js';
import {
    SiteLedger,
    awarenessOfSite,
    claimantOf,
    faceOf,
    forceAt,
    forceOrdinalOf,
    nameableSites,
    prizeImmortalItemIds,
    prizeOther,
    prizeTechniqueIds,
    // What the GROUND does, before any gate somebody built. Two of the three
    // ways the catalog closes ground had never fired for a player.
    readAccess,
    groundForceOrdinalOf,
    readGates,
    resolveSite,
    type FateEvidence,
    type GateVerdict
} from './trials.js';
import {
    SITES,
    enterSite,
    type AdmissionReading,
    type Site
} from '../data/cultivation/inheritance-trials.js';
import {
    assessPower,
    combatPowerForOrdinal,
    resolveExchange
} from '../engine/cultivation/combat.js';
import { quotePouchSale, type SaleLot } from '../engine/cultivation/market.js';
import { getHerb } from '../data/cultivation/herbs.js';
import { PILLS, getPill } from '../data/cultivation/pills.js';
// Above a certain grade a pill has a value and no price. The refusal that says
// so already existed and nothing asked it.
import { cashRefusalReason } from '../engine/cultivation/buying-and-bartering-pills.js';
import { askedAbout } from './asked.js';
import {
    THE_ANSWER_IS_TO_GO,
    THE_ANSWER_IS_TO_KEEP_SITTING,
    crossroadsView,
    howTheyAreReferredTo,
    stillStands,
    whatGoingCost,
    whatStayingCommittedTo,
    whatTheForkAsks,
    whatTheForkAsksStructurally,
    type CrossroadsView,
    type SeclusionCrossroads,
    type WhoIsClose
} from './choosing-what-to-do-when-a-seclusion-is-broken.js';
import {
    hearingProse,
    offerHearing,
    othersPresent,
    recordHearing,
    type AnswerReach,
    type Hearing,
    type HearingIntent
} from './hearsay.js';
import { askAround, factsForNews } from './asking-what-people-are-saying.js';
import { facesFromHome } from './who-a-life-like-this-grew-up-knowing.js';
import type { OriginTierKey } from '../engine/cultivation/origin.js';
import { observableHere, observedLine } from './practices.js';
import {
    acceptDuty,
    activityForVerb,
    PLAYER_ROLL_IDENTITY,
    arrivableForSpan,
    completeDuty,
    consumeArrivals,
    cutTo,
    daysActuallySpent,
    deltasDroppedBy,
    dutyFromOffer,
    encounterCalls,
    encountersFor,
    recordEncounters,
    refuseDuty,
    fitOf,
    seekerFor,
    sectBoardFor,
    writeObligation,
    rosterFor,
    type DatabaseHandle,
    withEncounterDeltas,
    type DutyLedgerInput
} from './encounters.js';
// The three reads that answer a stuck player. Each is a renderer over numbers
// computed elsewhere; see the banner in each file for what it may and may not
// say. Wired here because this is where the state they restate is already read.
import { whyProgressHasStopped, type SeatStanding } from './why-progress-has-stopped.js';
import { whoWouldTeach, type SomebodyAbove } from './who-would-teach-this-cultivator.js';
import {
    requestPutToSomebody,
    type RequestKind
} from './what-a-request-asks-and-of-whom.js';
import {
    whatItWouldCostThem,
    type RequestCosting,
    type TheOneAsking,
    type TheOneBeingAsked
} from './what-asking-this-person-for-this-would-cost-them.js';
import { transmissionsBy } from '../data/cultivation/techniques.js';
import { createObligation, settleObligation } from '../engine/social/grudges.js';
import type { AttemptResult } from '../engine/social-leverage/index.js';
import { whereCouldTheyGo, type Destination } from './where-this-cultivator-could-go.js';
// The fourth, and the one a player asks first: what kinds of thing are live at
// all, standing here, in this state. Prompts rather than a menu - see the
// banner in the module for why that distinction is the whole design.
import {
    whatIsWorthDoingStandingHere,
    theMostPressing,
    linesFor,
    ASKING_WHAT_IS_POSSIBLE,
    ABOUT_A_MANUAL,
    type StandingHere,
    type Affordance
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
    describeFoundGround,
    foundGroundIn,
    readFoundGroundAccess,
    resolveFoundGround,
    type FoundGround
} from './ground-the-world-found.js';
import { assessAcquisition, sealedDoorFraction, concealmentScale, type AcquisitionRoute } from '../engine/encounters/index.js';
import type { EncounterRoll } from '../engine/encounters/types.js';
import { wardHalfLifeYears } from '../engine/world/how-far-gone-a-formation-is.js';
import type {
    ArrivableFact,
    DutyCandidate,
    EncounterActivity
} from '../engine/encounters/index.js';
import { unattributedTextOf } from '../engine/world/digest.js';
import type { RosterEntry } from '../storage/repos/cultivator.repo.js';
import {
    advanceWorldForCultivator,
    saveWorldForRun,
    worldForRun
} from '../server/state/cultivation-world.js';
import { planNextRun, recordRun, lastFinishedRun } from '../engine/world/legacy.js';
import type { PlayerDigest } from '../engine/world/digest.js';
import type { WorldState } from '../engine/world/world-state.js';
import { createBloodFeud, createGrudge, type Severity } from '../engine/social/grudges.js';
// A finished pressure model that had no route from the player to it. The
// resolver reads  and never , which is the whole design.
//
// `whatFollowsFromTheBout` is the same shape for a fight two people arranged:
// the wound is the resolver's and is untouched, and what an agreement changes
// is who holds an account about it afterwards.
import {
    oddsOf,
    resolveAttempt,
    whatFollowsFromTheBout,
    // Who this particular person is about parting with things, which the
    // resolver would derive on its own. Read here so the PROSE can say it: a
    // term in an odds breakdown is legible to somebody reading the mechanical
    // channel and invisible to somebody reading the sentence, and the ruling
    // this serves is that a generous elder should READ as generous.
    openHandednessOf,
    howTheyHoldWhatTheyHave,
    type AskWeight,
    type BoutTerms
} from '../engine/social-leverage/index.js';
import type { ConfrontationOutcome } from '../engine/cultivation/combat.js';
// The board's own exchange rate, in closed form. See the function's comment.
import { contributionPerStoneOverDays } from '../engine/encounters/duties.js';
import { factsForAttempt, factsForRequest, factsForWeighingARequest } from './facts.js';
import { whatTheAskCameTo } from './saying-what-an-ask-cost-and-how-likely-it-was.js';
import {
    openLedgerBetween,
    recordTheTieAnAttemptLeft,
    tieFrom
} from './encounters.js';
import type { ApproachLeverage } from '../schema/cultivation.js';
import type { GroundConditions } from '../engine/cultivation/cultivation.js';
import { locationHistory } from '../engine/world/locations.js';
import { npcsAt, npcsInFaction } from '../engine/world/world-state.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import {
    whatTheConfrontationDidToThem
} from '../engine/world/what-a-confrontation-does-to-somebody-the-world-holds.js';
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
import { QI_DENSITY_DEFAULT, QI_DENSITY_MAX, ordinaryBandFor } from '../engine/world/qi-scale.js';
import { DEATH_IN_WORLD,
    factsForBreakthrough,
    factsForEat,
    factsForGather,
    factsForInteraction,
    factsForCompany,
    factsForInvestigation,
    factsForLook,
    factsForMove,
    factsForPlaceHistory,
    factsForGateRefused,
    factsForSiteFace,
    factsForSiteInterior,
    factsForSiteListing,
    factsForDao,
    factsForHolding,
    factsForRecall,
    factsForSiteTaken,
    factsForTreatment,
    factsForUnsupported,
    type Company,
    type SiteFace,
    factsForRefusal,
    factsForStatus,
    factsForGroundRefused,
    factsForGroundSurvived,
    factsForGroundTime,
    factsForTimeSkip,
    factsForToolResult,
    humanDays,
    placeName,
    rungAndOrdinal,
    type EngineFacts
} from './facts.js';
import {
    canExistBeyondTheLid,
    evaluateLidTransit,
    resolveDescentStrikes
} from '../engine/cultivation/existence.js';
import {
    BREATHS_IN_THE_LOWER_REALM,
    OBJECT_CEILING_BELOW_THE_LID
} from '../engine/cultivation/realms.js';
// Aliased because this package already has a `descend` method and a `sendAcross`
// would read as one too. The world functions are the authority; the methods
// beside them are wiring, and the names should say which is which.
import {
    descend as worldDescend,
    sendAcross as worldSendAcross
} from '../engine/world/immortal-world.js';
import { daoOf } from '../engine/cultivation/dao.js';
import { effectiveCapOf, writtenTo } from '../engine/cultivation/escapes.js';
import { stagesHeldBy, stagesWrittenSince } from './stages.js';
import { PlayLog, type LogEntry } from './log.js';
import type { FiledOutcome, Narrator } from './narrator.js';
import { composeStateSummary } from './prompt.js';
import { handleAdminManage, isAdminModeEnabled, parseAdminCommand } from '../server/consolidated/admin-manage.js';
import {
    cultivatorView,
    derivedView,
    ledgerRowView,
    refusalText,
    rosterRowView,
    runView,
    worldRosterRow,
    daoView,
    type DerivedView,
    type LedgerRowView,
    type RosterRowView,
    type RunView
} from './view.js';

// ─────────────────────────────────────────────────────────────────────────
// CHARACTER CREATION
// Not engine constants: the cultivation engine has no opinion about starting
// HP, and inventing one inside src/engine would be inventing a game rule in a
// module whose whole claim is that it only computes. They live here, where the
// web deployment's own choices belong.
// ─────────────────────────────────────────────────────────────────────────

export const STARTING_AGE = 16;
export const STARTING_LOCATION = 'Sweptground';
/** Base HP plus ten per point of Might: 30 to 50 at creation. */
export const BASE_HP = 20;
export const HP_PER_MIGHT = 10;
/** Base qi plus five per point of Insight: 15 to 30 at creation. */
export const BASE_QI = 10;
export const QI_PER_INSIGHT = 5;

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

/**
 * Where rations bought ahead of time are kept.
 *
 * A per-cultivator counter rather than a new table: the engine already owns
 * a flag store keyed exactly this way, and a schema change to hold one
 * integer would be a migration this layer has no business writing.
 */
const FLAG_RATIONS_HELD = 'rations_held';

/**
 * Who agreed to teach this cultivator, and where they stand.
 *
 * `<personId>:<ordinal>`. Read by `guideFor`, which is what turns it into a
 * number: a house supplies a guide because somebody in it is above you, and a
 * person who took you on supplies one for exactly the same reason and by
 * exactly the same arithmetic. `manuals.md` calls this the third and most
 * demanding shape a teaching takes - "a teacher and no book at all... their
 * progress now runs through somebody's goodwill rather than an object they
 * hold".
 */
const FLAG_MASTER = 'master_who_took_them_on';

/**
 * The request kinds a plan may name. Anything else falls to the cheapest
 * reading, which is the rule every other intent-carrying action here obeys.
 */
const REQUEST_KINDS: ReadonlySet<string> = new Set<RequestKind>([
    'teaching', 'discipleship', 'introduction', 'telling', 'a_thing', 'nothing'
]);

/**
 * How many times this cultivator has already put a request to somebody.
 *
 * Per pair, and it is what stops six identical refusals in a row. The state was
 * changing under all six - a refusal writes a record and the next attempt reads
 * it - and the text did not know, which reads as a broken loop rather than as a
 * person saying no again. The same defect was fixed in the wound warning
 * earlier, and the fix is the same: let the text know what the state knows.
 */
const askedBeforeKey = (personId: string, kind: string): string => `asked:${kind}:${personId}`;
/** Spirit stones for one meal at `eat`. */
export const MEAL_COST_STONES = 1;

/** Days a `travel` or `wait` action consumes. */
export const SHORT_ACTION_DAYS = 1;
/**
 * Days spent going into an inheritance ground.
 *
 * A deployment choice like `SHORT_ACTION_DAYS`, not an engine constant: the
 * engine has no opinion about how long a shaft is. What it buys is that going
 * in is never free - the food clock runs, the world moves, and a cultivator
 * who walks into a grave on their last ration can die of the walk rather than
 * of the grave, through exactly the survival layer everything else dies
 * through.
 */
export const ENTERING_DAYS = 3;
/**
 * A course of mortal care, in days.
 *
 * The catalog names it: `price-splint-and-month` is "Splint and a month of
 * care", and its note says it is the mortal alternative to a healing pill -
 * slower, cheaper, and it leaves you out of the fight for a season. The month
 * is the catalog's number; the season is what it feels like after two of them.
 */
export const TREATMENT_DAYS = 30;
/** Focus multipliers for time spent on something other than sealed seclusion. */
export const TRAVEL_FOCUS = 0.15;
export const GATHERING_FOCUS = 0.2;
export const WAITING_FOCUS = 0.25;
/** Nobody gathers qi while climbing down a lined shaft in the dark. */
export const ENTERING_FOCUS = 0.05;
/**
 * Lying still with a torn meridian is not seclusion.
 *
 * Not zero: the month passes and the body is doing something with it. Low
 * enough that nobody treats an infirmary as a cheap cave, which they would at
 * five stones a month if it cultivated.
 */
export const TREATMENT_FOCUS = 0.1;

/**
 * A price as the mortal-economy tool reports it.
 *
 * Both currencies, because the world has two on purpose: `mortal-world.ts`
 * anchors a hundred cash to the spirit stone precisely so that ordinary life
 * is priced in cash and cultivation is priced in stones.
 */
interface MarketPrice {
    name?: string;
    category?: string;
    unit?: string;
    cash?: number;
    spiritStones?: number;
    affordable?: boolean;
}

/**
 * Categories that belong to ordinary life and are priced in cash.
 *
 * Rendering a bowl of millet as 0.01 spirit stones throws away the whole point
 * of the second currency and produces a number nobody can hold in their head.
 * One cash for the millet, a hundred and twenty for a month of rations: those
 * are figures a player can reason with.
 */
const MORTAL_CATEGORIES = new Set(['food', 'lodging', 'transport', 'medicine', 'service']);

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

const MARKET_LINES = 8;

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
    'bribe', 'threaten', 'seduce', 'deceive', 'negotiate', 'interrogate', 'recruit'
]);

/**
 * How heavy the thing being asked for is, from the player's own sentence.
 *
 * `AskWeight` is what the resolver prices resistance and duration off, and it
 * must come from what was asked rather than from the verb: bribing somebody for
 * directions and bribing them to open their house's vault are the same verb and
 * are not the same ask.
 *
 * Defaults to `a_courtesy`, which is the forgiving direction. Reading a
 * betrayal into a sentence that asked for directions would price an afternoon
 * as a season and a half, and the cost of being wrong the other way is that an
 * attempt is cheaper than it should have been.
 */
function askWeightOf(text: string): AskWeight {
    const said = text.toLowerCase();
    if (/\b(?:betray|turn on|sell out|inform on|give (?:me )?(?:up|them up)|open the (?:vault|reserves|treasury)|hand over the|let me in(?:to)? the (?:vault|treasury|reserves)|denounce)\b/.test(said)) {
        return 'a_betrayal';
    }
    if (/\b(?:against (?:his|her|their) (?:own )?interest|lie for me|cover for me|break (?:the )?(?:rule|rules|oath)|risk (?:his|her|their)|take the blame|falsify|forge)\b/.test(said)) {
        return 'against_their_interest';
    }
    if (/\b(?:lend|loan|give me|hand me|spare me|pay for|put in a word|vouch for|introduce me to|teach me|train me|escort|come with me|fight|help me)\b/.test(said)) {
        return 'a_real_favour';
    }
    return 'a_courtesy';
}

/**
 * Which lines of a price board get read out, when it will not all fit.
 *
 * NOT the cheapest eight, which is what it used to be and which hid an entire
 * category of goods from every player in the game. `handleMarket` sorts by
 * price ascending; medicine runs 2,000-6,000 cash against a bowl of millet at
 * 1, so a board of 41 things showed millet, a ferry, salt, an inn, a letter, a
 * night's lodging, firewood and a bell - and the pills that close a torn
 * meridian sat thirty lines below the fold.
 *
 * That is not a cosmetic problem. Untreated meridian injuries are the leading
 * cause of death in this game, the cure is ON THIS BOARD, and a playtester
 * reading this list concluded across dozens of runs that no settlement sells
 * pills at all. They were there the whole time and off the bottom of the page.
 *
 * One line per category first, cheapest of each, so nothing a market sells can
 * be invisible; then the cheapest of whatever is left, so the board still opens
 * with what a poor cultivator can actually afford. The order within the result
 * is by price, because that is how a board reads.
 */
function boardSample(prices: MarketPrice[]): MarketPrice[] {
    if (prices.length <= MARKET_LINES) return prices;

    const firstOfCategory = new Map<string, MarketPrice>();
    for (const item of prices) {
        const category = String(item.category ?? 'other');
        if (!firstOfCategory.has(category)) firstOfCategory.set(category, item);
    }

    const chosen = new Set<MarketPrice>([...firstOfCategory.values()].slice(0, MARKET_LINES));
    for (const item of prices) {
        if (chosen.size >= MARKET_LINES) break;
        chosen.add(item);
    }
    return prices.filter(item => chosen.has(item));
}

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

function priceOf(item: MarketPrice): string {
    const unit = item.unit ? ` the ${item.unit}` : '';
    const mortal = item.category === undefined || MORTAL_CATEGORIES.has(item.category);

    if (mortal && typeof item.cash === 'number') {
        return `${Math.round(item.cash)} cash${unit}`;
    }
    // NOTHING IS PRICED IN A FRACTION OF A STONE.
    //
    // A stone is a large denomination - a hundred cash - so a bolt of cloth
    // came out as "0.5 spirit stones the bolt", which is not a price anybody
    // says out loud. It was invisible while the board only ever showed its
    // eight cheapest lines, all of which are food and lodging and quoted in
    // cash; surfacing one line per category brought it straight up, and
    // `presence.test.ts` had the rule written down waiting for it.
    //
    // Sub-stone goods are quoted in cash whatever their category. Cultivator
    // goods that genuinely cost stones still read in stones, which is the
    // distinction the currency exists to make.
    if (typeof item.spiritStones === 'number') {
        if (item.spiritStones < 1 && typeof item.cash === 'number') {
            return `${Math.round(item.cash)} cash${unit}`;
        }
        return `${round2(item.spiritStones)} spirit stones${unit}`;
    }
    return `an unmarked price${unit}`;
}

/**
 * The purse, in both currencies.
 *
 * The conversion appears here and almost nowhere else, which is where it
 * belongs: changing a stone for cash is the small moment a cultivator has when
 * they discover their savings are somebody's month of dinners.
 */
function describePurseCash(purse: { cash?: number; spiritStones?: number }): string {
    const stones = typeof purse.spiritStones === 'number' ? purse.spiritStones : 0;
    const cash = typeof purse.cash === 'number' ? purse.cash : stones * 100;
    if (stones === 0) return `${Math.round(cash)} cash and no stones`;
    return `${stones} spirit stones, which is ${Math.round(cash)} cash`;
}

/** Market board categories the parser can narrow to. */
const MARKET_CATEGORIES = [
    'food', 'lodging', 'transport', 'medicine', 'land', 'service', 'tool', 'information'
] as const;

/** Engine event summaries appended to the log per action, at most. */
const MAX_LOGGED_EVENTS = 40;

/**
 * How prepared a crossing counts as, 0..1.
 *
 * The engine wants a number for "a chosen site, a cleared schedule, nobody
 * hunting you". This deployment models one of those honestly - whether the
 * purse actually covered the food for the whole stretch - so a fully
 * provisioned seclusion is half-prepared and nothing else is. Striking the
 * barrier on command is a deliberate but unaided choice.
 */
export const PROVISIONED_PREPARATION = 0.5;
export const DELIBERATE_PREPARATION = 0.25;
/** A shut door, a chosen site, and nobody coming through it. */
export const SEALED_PREPARATION = 0.75;
/** Below this, a crossing counts as hurried: too little time to sit properly. */
export const HURRIED_BELOW_DAYS = 30;

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
    'work', 'market', 'provision', 'eat', 'gather', 'interact', 'sect', 'move',
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
 * What a house's declaration would actually require, said to somebody who has
 * no house to declare with.
 *
 * The refusal a rogue gets has to be about POSITION rather than about rank -
 * they are not junior, they are outside - and it has to name the thing they
 * would have to go and get. "You lack authority" tells a player nothing they
 * can act on; "a war is a thing between two houses, and you are one person"
 * tells them what the missing piece is.
 */
const THE_DECLARATION_REQUIRES: Readonly<Record<'war' | 'alliance' | 'defect' | 'tribute', string>> = {
    tribute:
        'a levy is collected by somebody who is already owed it. What makes a payment due is a '
        + 'house holding from another house on stated terms, in writing, with everybody in the '
        + 'province able to name the arrangement. You are not at either end of one.',
    war:
        'a war is a thing between two houses. It needs a house on this side of it - people who '
        + 'answer when the name is used, ground that can be taken off them, and somebody entitled '
        + 'to spend both. One person saying it out loud in a square is a person saying something '
        + 'out loud in a square.',
    alliance:
        'an alliance is two parties who can each promise something and be held to it. What you '
        + 'have to offer is yourself, which is a thing you could offer by asking to be taken on, '
        + 'and that is a different sentence with a different answer.',
    defect:
        'defecting is a house changing who it holds from. You hold from nobody, so there is '
        + 'nothing to move and nobody who would notice it moving.'
};

/** How a declaration is recorded, in the world's voice rather than the schema's. */
const DECLARED: Readonly<Record<'war' | 'alliance' | 'defect' | 'tribute', (mine: string, theirs: string) => string>> = {
    war: (mine, theirs) => `${mine} is at war with ${theirs}.`,
    alliance: (mine, theirs) => `${mine} has offered ${theirs} an alliance, in the open.`,
    defect: (mine, theirs) => `${mine} holds from ${theirs} now, and said so.`,
    tribute: (mine, theirs) => `${mine} has sent to ${theirs} for a payment.`
};

/**
 * Months of a house's own payroll that an offering costs.
 *
 * A decade, which is the figure `IMMORTAL_MOTIVE.whatTheOfferingActuallyIs`
 * states in so many words: a body that spends its principal for a decade to
 * receive two words is being answered at the minimum rate. It is expressed in
 * months so that it sits in the same unit as `RESERVE_MONTHS` in
 * `embezzlement.ts`, which is twelve years of the same payroll - so the rite
 * costs five sixths of everything a house is holding, and a house that makes
 * one is a house that could not survive a bad decade afterwards.
 *
 * Here rather than in `schema/cultivation.ts` for the reason the leadership and
 * embezzlement constants are where they are: it prices one act, and it belongs
 * beside the act it prices.
 */
const OFFERING_MONTHS = 120;

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
 * What emptying a piece of ground is worth to whoever holds it, by the rung the
 * ground is pitched at.
 *
 * Bands rather than a curve, and read off the site's own ordinal, so the same
 * table prices a Qi Condensation grave and the interment of somebody at the top
 * of the ladder. Aligned to the realm boundaries the rest of the game already
 * uses rather than chosen: `serious` opens at Foundation, `grave` at Core
 * Formation, `unforgivable` where the ladder stops producing people who can be
 * quietly robbed.
 */
const GRAVE_SERIOUS_ORDINAL = 13;
const GRAVE_GRAVE_ORDINAL = 21;
const GRAVE_UNFORGIVABLE_ORDINAL = 33;

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
 * Which volumes of a work a holder has, for a work they already KNOW.
 *
 * All of them, and that is a statement rather than a stub. A scattered manual
 * is scattered at the point of ACQUISITION - the volumes are objects, they sit
 * in three different places, and finding them is the search. Nothing in the
 * learning path models that yet: `handleLearn` puts an id in `knownTechniques`
 * and there is no cultivator-side object table for a volume to live in, so the
 * only honest reading of "they know it" today is that they have the work.
 *
 * Asserting the opposite would be a silent nerf rather than a mechanic: exactly
 * one cultivation manual in the catalog is scattered, and pretending every
 * holder of it lacks every volume would quietly drop its ceiling by three rungs
 * for a reason no player could see or act on.
 *
 * When acquisition grows a volume model this becomes a read of it, and
 * `effectiveCapOf` already computes the unbroken run from a gapped set.
 */
function wholeWorkVolumes(art: { volumes?: readonly string[] | null }): readonly string[] {
    return art.volumes ?? [];
}

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
 * How many things done to a place are read out at once.
 *
 * A place that has been fought over for three thousand years has a long log,
 * and a wall of them is a chronicle rather than an answer. The most recent
 * changes are the ones that made it what it is now.
 */
const PLACE_CHANGES_SHOWN = 3;

/** The ways of saying "here" that are not the name of anywhere. */
const HERE_ITSELF =
    /^(?:this|that|the)?\s*(?:place|ground|village|town|city|region|area|spot|here|it|ruin|ruins)$/i;

/**
 * The words that mean "the site in front of me" rather than naming one.
 *
 * The same defect `GENERIC_LIBRARY_PHRASE` exists for, and the same fix. The
 * parser hands over the noun phrase it found after the verb, and for the
 * commonest phrasings that phrase is generic - "the door", "the grave", "what
 * is behind the plate". Handing one of those to a fuzzy matcher resolves it:
 * "door" is contained in "The Door That Wants Somebody Not In the Record" and
 * scores over the threshold, so "I study the door" would open a specific
 * fate-gated trial three provinces away that the player has never heard of.
 * A generic phrase names nothing and falls through to the site at hand.
 */
const GENERIC_SITE_PHRASE =
    /^(?:the |a |an |this |that |it |what |whatever )*(?:door|doorway|gate|gateway|gate frame|threshold|marker|headstone|entrance|shaft|plate|standing stone|site|sites|place|trial|trials|grave|graves|tomb|tombs|crypt|crypts|barrow|barrows|undercroft|interment|inheritance|inheritance ground|inheritance grounds|grave goods?|prize|contents|manuals?|is behind.*|is inside.*|is in there|is left|behind.*|inside.*)$/i;

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

export class GameError extends Error {
    constructor(message: string, readonly status = 400) {
        super(message);
        this.name = 'GameError';
    }
}

export interface StateView {
    run: RunView;
    cultivator: Cultivator;
    ambient: AmbientQi;
    derived: DerivedView;
    /** Everything the crossings have cut away from this cultivator, oldest first. */
    tolls: TollLedgerEntry[];
    log: LogEntry[];
    /**
     * A seclusion the engine stopped and has NOT resolved, waiting on an answer.
     *
     * Null on every ordinary turn. When it is set, the run is standing at a
     * fork the engine deliberately did not take: somebody broke a long sitting
     * and the two things that were always physically available - go, or sit
     * back down - are both still open. See
     * `choosing-what-to-do-when-a-seclusion-is-broken.ts`.
     *
     * The client renders two controls off this. It is emphatically not a modal
     * jail: free text is still the whole game, and anything that is not sitting
     * back down is going.
     */
    crossroads: CrossroadsView | null;
}

/**
 * One step the engine actually took, for the client's inspector.
 *
 * This list is the visible proof of the project's central claim. A player who
 * suspects the narration of flattering them can open it and read the engine's
 * own one-line account of every routine that ran - `summary` is always sourced
 * from facts.ts or from a `SimEvent.summary`, never from narrator prose.
 */
export interface ToolCallRecord {
    /** The engine routine or repository call that ran. */
    name: string;
    /** What it was doing: the player-facing verb, or the kind of ruling. */
    action: string;
    /** The engine's factual one-liner. Never narration. */
    summary: string;
    /** False when the engine declined to act - an ineligible attempt, a refusal. */
    ok: boolean;
    /** Present on the routing step: whether the model or the parser chose. */
    source?: PlanSource;
    /** Present when a fallback ran, saying why. */
    note?: string;
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
    'set_ambient', 'set_location', 'advance_days', 'set_realm', 'audit_log'
] as const;

export interface ActResult {
    narration: string;
    events: SimEvent[];
    toolCalls: ToolCallRecord[];
    state: StateView;
}

export interface CultivateResult {
    timeSkip: TimeSkipResult;
    state: StateView;
    /**
     * EVERYTHING that happened in the span, merged and in order.
     *
     * `timeSkip.events` is only the cultivation engine's half. `runSeclusion`
     * merges the encounter layer's occurrences into `Execution.events`, and
     * only `act` was returning those - so a player who clicked the seclusion
     * button in the GUI saw NO ENCOUNTERS AT ALL, while the same build reached
     * through the typed endpoint produced 1.63 summonses a sect life and made
     * `npc_event` the commonest event kind in the game. One design, two front
     * doors, and the door with a button on it was showing half the world.
     *
     * Measured as zero summonses across 200 lives on this endpoint against
     * 1.63 per sect life on the other, on the same build.
     */
    events: SimEvent[];
    /**
     * Why the span stopped short, when it did.
     *
     * Provisions ran out, a wound opened, something walked in. No endpoint
     * returned it, so "the ten years you asked for were three" arrived with no
     * reason attached.
     */
    interruptReason: string | null;
    /**
     * The same prose a typed command would have produced.
     *
     * This was always being written - narrated, and appended to the log -
     * and then dropped on the floor before the response was built, so a
     * player who clicked got a table of deltas and a player who typed got
     * the game. One design, two front doors, and only one of them had it.
     */
    narration: string;
}

export interface BreakthroughApiResult {
    result: BreakthroughResult;
    state: StateView;
    /** As above: the click path narrates the same way the typed path does. */
    narration: string;
}

export interface GameServiceOptions {
    db: Database.Database;
    narrator: Narrator;
    /**
     * Whether the world advances alongside the cultivator.
     *
     * The world itself is owned by `src/server/state/cultivation-world.ts` and
     * is addressed by run, not held here. This flag exists only so a test can
     * run the cultivation engine on its own without paying to seed several
     * hundred people it is not asserting anything about.
     */
    worldEnabled?: boolean;
    adminMode?: boolean;
    /** Injectable for tests that need a reproducible run. */
    seedFactory?: () => string;
}

/** What an action did, before it is narrated. */
interface Execution {
    facts: EngineFacts;
    events: SimEvent[];
    timeSkip: TimeSkipResult | null;
    breakthrough: BreakthroughResult | null;
    outcome: 'executed' | 'refused';
    /** Every engine call this action made, in the order it made them. */
    calls: ToolCallRecord[];
    /**
     * A name somebody said in this scene, decided and recorded by the engine.
     *
     * Carried on the execution rather than fetched during narration so that the
     * knowledge record is written in phase 2, where writes belong, and phase 3
     * only ever receives a licence to mention what is already true.
     */
    hearing?: Hearing | null;
}

// ─────────────────────────────────────────────────────────────────────────
// THE SERVICE
// ─────────────────────────────────────────────────────────────────────────

/**
 * How much of an open seclusion gets through a door over the whole sitting.
 *
 * A shut door is not a ward, and it is not a constant either. `wardIntegrityOf`
 * halves a formation every `wardHalfLifeYears`, so the door somebody sat down
 * behind is weaker every year they stay behind it - which is the same clock the
 * world reads when it decides that an old sealed place has become enterable.
 *
 * Averaged across the stretch rather than sampled at either end, because the
 * time-skip takes ONE scale for the whole span: sampling at the start would
 * price a three-hundred-year sitting as though the ward were still fresh, and
 * sampling at the end would price the first decade as though it were already
 * gone. The mean of a halving curve over [0, Y] has a closed form and there is
 * no reason to approximate it.
 *
 * At full integrity this is the flat fraction the encounter tables use. At zero
 * integrity it is 1 - no reduction at all - because a formation that is
 * entirely gone is a person sitting in an open cave who believes otherwise.
 */
export function doorScaleOverStretch(
    setByOrdinal: number,
    days: number,
    hidden = false
): number {
    const years = Math.max(0, days) / 365;
    const halfLife = wardHalfLifeYears(setByOrdinal);
    const meanIntegrity = years <= 0
        ? 1
        : (halfLife / (years * Math.LN2)) * (1 - Math.pow(0.5, years / halfLife));
    const held = Math.min(1, Math.max(0, meanIntegrity));
    const fraction = sealedDoorFraction();
    // Linear between "the door is as set" and "there is no door".
    const throughTheDoor = fraction + (1 - fraction) * (1 - held);
    // A HIDDEN DOOR IS A DIFFERENT KIND OF PROTECTION AND MULTIPLIES WITH IT.
    //
    // The ward decides whether somebody who is standing at the door gets
    // through it. Concealment decides whether they are standing there at all,
    // and it filters by RUNG rather than by rate - hide the entrance and only
    // somebody at your own realm or above finds the place. The two are
    // independent, so they multiply: a decayed ward on a hidden cave is still
    // hidden, and a fresh ward on an obvious one is still obvious.
    return hidden ? throughTheDoor * concealmentScale(setByOrdinal) : throughTheDoor;
}

export class GameService {
    private readonly db: Database.Database;
    /**
     * The same repository bundle the MCP tools use, so the two front doors
     * cannot drift apart about what a crossing took or how a skip is written.
     */
    private readonly repos: CultivationRepos;
    private readonly log: PlayLog;
    /**
     * What each cultivator has heard of.
     *
     * The enforcement behind docs/world/discovery.md: everything that reaches a
     * prompt or an entity resolver is filtered through this first, so the
     * narrator is never handed a name the player has not earned.
     */
    private readonly knowledge: KnowledgeGate;
    /**
     * What this run has done to the inheritance grounds it has found.
     *
     * Over `cultivation_sites`, which the schema already keeps for exactly
     * this and whose own comment says a site outlives the run that turned it
     * up. Same posture as `KnowledgeGate` over `knowledge_records`: a narrow
     * reader and writer, not a second table.
     */
    private readonly sites: SiteLedger;
    private readonly legacy: LegacyLedger;
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
    private atHand: WorldState | null = null;
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
    private pendingArrivals: ArrivableFact[] = [];
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
    private crossroads: SeclusionCrossroads | null = null;
    /**
     * Set when an action changed the world without spending a day.
     *
     * Every other world write rides on the time skip, which persists at the end
     * of a span. The far-side actions do not spend days and are all real state -
     * an abode settled, a seam opened and closed inside fifteen breaths, an
     * object put down a channel - so they say so here and `act` writes once,
     * after phase 2, before anything is narrated.
     */
    private worldDirty = false;
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
        const attributeStream = forStream(seed, 'creation', 'attributes');
        const attributes = rollAttributes([
            attributeStream.next(),
            attributeStream.next(),
            attributeStream.next(),
            attributeStream.next()
        ]);

        const maxHp = BASE_HP + attributes.might * HP_PER_MIGHT;
        const maxQi = BASE_QI + attributes.insight * QI_PER_INSIGHT;

        const created = this.db.transaction(() => {
            const cultivator = this.repos.cultivators.create({
                id: randomUUID(),
                name: trimmed,
                kind: 'pc',
                spiritRoot: root.key,
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
    async act(input: string): Promise<ActResult> {
        this.useOwnDb();
        const trimmed = input.trim();
        if (trimmed.length === 0) throw new GameError('Say something.');
        if (trimmed.length > 2000) throw new GameError('That is too long. Two thousand characters at most.');

        const { run, cultivator } = this.requireLiveRun();

        // ADMIN is an operator surface, not a game action, so it is answered
        // before the narrator ever sees the input. context.md: it lifts content
        // gates and never the authority rule - every action below performs a
        // real audited mutation and returns what the engine actually did.
        const admin = ADMIN_PREFIX.exec(trimmed);
        if (admin) return await this.adminAct(trimmed.slice(admin[0].length), run, cultivator);

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
        const standing = stillStands(this.crossroads, run.id, cultivator)
            ? this.crossroads
            : null;
        const clockOnEntry = run.elapsedDays;
        const answered = standing === null
            ? null
            : THE_ANSWER_IS_TO_KEEP_SITTING.test(trimmed)
                ? 'stay' as const
                : THE_ANSWER_IS_TO_GO.test(trimmed)
                    ? 'go' as const
                    : null;

        // ── phase 1 ──
        const plan: Plan = answered !== null
            ? {
                action: { action: answered === 'stay' ? 'cultivate' : 'wait' },
                source: 'fallback',
                note: answered === 'stay'
                    ? 'an open seclusion crossroads, answered by sitting back down'
                    : 'an open seclusion crossroads, answered by getting up'
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
                })
            );

        // ── phase 2 ──
        const execution = answered === 'stay'
            ? await this.sitBackDown(run, cultivator, ambient, standing!)
            : answered === 'go'
                ? this.getUpAndGo(run, standing!)
                : await this.execute(plan.action, run, cultivator, ambient, trimmed);

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
        const dropped = theClauseThisTurnDidNotRun(trimmed, plan.action.action);
        if (dropped) {
            const said = sayingWhatWasNotDone(dropped);
            // All three channels, because they are read by three different
            // people. `lines` is what the narrator may know, `prose` is what
            // the deterministic narrator ships verbatim, and `structure` is the
            // log, which is the only one of the three that cannot be dressed.
            execution.facts.lines.push(said);
            execution.facts.prose = `${execution.facts.prose}\n\n${said}`;
            execution.facts.structure.push(theStructureLineFor(dropped, plan.action.action));
            execution.calls.push({
                name: 'engine.parseIntent',
                action: plan.action.action,
                summary: theStructureLineFor(dropped, plan.action.action),
                ok: false
            });
        }

        const after = this.currentRun();
        // And again, now the turn is over, BEFORE the write below. The refresh
        // at the top is what the world reads while the span runs - the player
        // as they were when it began, which is correct - and this one is what
        // gets stored, so a row read between turns or after a restart says what
        // the sheet says rather than what it said a turn ago.
        this.refreshThePlayerRow(after.cultivator);

        // A world changed inside one turn is written before anything is
        // narrated, so a restart cannot lose an abode, a descent or a thing
        // that went down a channel. Nothing here reads the narration; the
        // ordering is only about durability.
        if (this.worldDirty) {
            this.worldDirty = false;
            await saveWorldForRun(run);
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

        this.log.append(run.id, [
            { role: 'player', turn: run.turn, text: trimmed },
            ...this.engineEntries(execution, after.run.turn),
            { role: 'narrator', turn: after.run.turn, text: narration.text }
        ]);

        return {
            narration: narration.text,
            events: execution.events,
            toolCalls: [
                routingCall(plan),
                ...execution.calls,
                narrationCall(narration)
            ],
            state: this.stateView(after.run, after.cultivator)
        };
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
            ...this.engineEntries(execution, after.run.turn),
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
            throw new GameError(refusalText(eligibility.reason, eligibility.progressAvailable, eligibility.progressRequired));
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
            ...this.engineEntries(execution, after.run.turn),
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
                        refusalText(eligibility.reason, eligibility.progressAvailable, eligibility.progressRequired)
                    ));
                }
                return this.strikeBarrier(run, cultivator, ambient);
            }

            case 'move':
                return this.move(run, cultivator, ambient, action.target, action.intent ?? 'travel');

            case 'investigate':
                return this.investigate(run, cultivator, ambient, action.target);

            case 'attack':
                // `terms` reaches the consequence layer and nothing else. See
                // the header on `attack` and on `whatFollowedTheBout`.
                return this.attack(
                    run, cultivator, action.target, action.intent ?? 'drive_off',
                    action.terms ?? 'open'
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
                return this.train(cultivator, action.target);

            case 'refine':
                return this.refine(run, cultivator, action.target);

            case 'gather':
                return this.gather(run, cultivator, ambient, action.target);

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
                        cultivator.realmOrdinal, this.rateTermsFor(cultivator).techniqueCap
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
                return this.work(cultivator, action.days ?? DEFAULT_WORK_DAYS, action.target);

            case 'market':
                return this.market(cultivator, action.target);

            case 'sect':
                return this.sect(run, cultivator, ambient, action.target, action.intent, action.topic, action.days);

            case 'recall':
                return this.recall(run, cultivator, action.target, action.intent);

            case 'news':
                return this.news(run, cultivator);

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

            case 'inventory':
                return this.inventory(run, cultivator);

            case 'consume_pill':
                return this.consumePill(cultivator, action.target, rawInput);

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

                const company = this.company(cultivator);
                const standing = this.standingHere(cultivator);
                const looking = this.freeAction(
                    run, 'look',
                    action.intent === 'company'
                        ? factsForCompany(cultivator, company, standing)
                        : factsForLook(cultivator, ambient, company, standing)
                );
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

    /**
     * Going somewhere, however it was meant.
     *
     * One engine path for every intent. `flee`, `enter`, `approach` and
     * `travel` all resolve identically because the engine has no basis yet for
     * treating them differently, and manufacturing one in this layer would be a
     * mechanic invented in the narration tier.
     *
     * TODO(world): route through `assessCapability` once `world_locations` is
     * populated, so entering a sealed ruin is answered by "can attempt / can
     * survive / can succeed" against that location's thresholds. The rule then
     * stays the same: the attempt is always permitted, circumstances decide.
     */
    private async move(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string
    ): Promise<Execution> {
        const place = resolvePlace(target);
        if (!place) {
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'Nowhere in particular.',
                `You get as far as the edge of ${placeName(cultivator)} before it occurs to you ` +
                'that you have not decided where you are going, and there is nothing out there ' +
                'obliging enough to decide it for you.',
                'No destination named; location unchanged and no time passed.'
            ));
        }

        // A destination has to be somewhere.
        //
        // `resolvePlace` accepts any string, because a place in this engine
        // is free text and always has been. That is fine for describing one
        // and catastrophic for travelling to one: "I follow the cultivator"
        // parsed the trailing noun as a destination and the engine dutifully
        // moved the player to a location called `cultivator`, spent the
        // travel days, and then described its ambient qi. A name the world
        // has never heard of is not a place; it is a misparse with a
        // location row behind it.
        //
        // Checked against three registers, any of which is enough: the
        // world's own locations, anywhere a person is standing, and
        // anywhere this cultivator has heard of. The third is what keeps
        // this from being a discovery leak in reverse - the player may go
        // where they have been told about, and the refusal below never says
        // where that is.
        // Only where there is a register to check against. With the world
        // driver off, places in this engine are documented free text and
        // there is nothing that could say a name is wrong; refusing then
        // would make travel impossible rather than safe.
        if (this.atHand && !this.somewhereReal(place.name, cultivator)) {
            return refused('engine.resolvePlace', 'move', factsForRefusal(
                'No road goes there.',
                `You ask after ${place.name} and get the look people give a name that is not a ` +
                'place. Nobody sets you right, because nobody is sure what you meant.',
                `Unresolved destination "${place.name}": matches no world location, no ` +
                'occupied place and nothing this cultivator has heard of. Location unchanged, ' +
                'no time passed.'
            ));
        }

        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, SHORT_ACTION_DAYS, {
            seed: run.seed,
            // The row id is a randomUUID; without this the run is not
            // reproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: TRAVEL_FOCUS,
                ...this.rateTermsFor(cultivator),
                ground: this.groundFor(cultivator)
            },
            understanding: this.understandingFor(run, cultivator),
            // What is in the pack feeds them here too. Only seclusion tops the
            // pack up from the purse; this eats what is already carried.
            rations: this.drawFromPack(cultivator, SHORT_ACTION_DAYS),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, {
            before: cultivator, run, skip, location: place.name
        });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        // Standing somewhere is how a place stops being a rumour. Recorded with
        // its source so a place walked to and a place read about stay different
        // facts.
        this.noteEncounter(
            applied.cultivator, run, { kind: 'place', id: place.name, name: place.name },
            'witnessed', `Arrived on day ${Math.round(applied.run.elapsedDays)}.`
        );

        const ambientAfter = this.ambientFor(applied.cultivator, applied.run);

        return {
            facts: factsForMove(cultivator, applied.cultivator, place.name, intent, skip, ambient, ambientAfter),
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                {
                    name: 'cultivator.update',
                    action: 'move',
                    summary: `Location set to "${place.name}" (intent: ${intent}); ambient qi there is ${ambientAfter}.`,
                    ok: true
                },
                ...skipCalls('move', skip, null),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ]
        };
    }

    /**
     * Examining something.
     *
     * Reads state and reports it. The subject must resolve to a real row or a
     * real catalog entry, so a player cannot examine a person the world does
     * not contain and receive a description of them.
     *
     * TODO(world): once `assessCapability` is wired, run the `understand`
     * predicate over the subject so that an inscription above the cultivator's
     * comprehension yields partial or wrong readings rather than the full
     * record. Comprehension is archaeology, and it should be able to fail.
     */
    private investigate(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined
    ): Execution {
        const query = (target ?? '').trim();
        if (query.length < 2) {
            return this.freeAction(
                run, 'investigate',
                factsForLook(cultivator, ambient, this.company(cultivator))
            );
        }

        const scope = this.scopeFor(cultivator);
        // Ruins are load-bearing: origin.md closes on them being the one door
        // in this world that opens on nerve rather than standing, and the only
        // route a poor cultivator has. "The ruins" is how a player refers to
        // the one they are standing near, and it is not a proper name, so it
        // resolved to nothing and the most obvious sentence about the most
        // important feature in the game did nothing at all.
        const subject = this.ruinAtHand(query, cultivator)
            ?? resolveAnything(this.repos, query, cultivator, scope);
        if (!subject) {
            // Worded so that it does not confirm existence either. "You have
            // never heard of it" and "it is not there" have to look the same
            // from inside, or the refusal itself becomes the answer key. And it
            // is written as a scene, because an error message reaching the
            // player is a scene that failed to get written.
            return refused('engine.resolveEntity', 'investigate', factsForRefusal(
                'Nothing here answers to it.',
                // Searching a place fails differently from addressing a person.
                // This used to hand back the conversational brush-off, so "I
                // explore the ruins" was answered with somebody looking up from
                // their work - which named a stranger the player had not met and
                // described a social act nobody had attempted.
                `You go over ${placeName(cultivator)} looking for it and it is not the kind of ` +
                'place that has one. Either it is somewhere else, or it is nowhere, and standing ' +
                'here turning it over is not going to settle which.',
                `Unresolved subject "${query}": no knowledge record and nothing co-located. ` +
                `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        // Examining a thing is a source. Record it with its provenance rather
        // than letting the knowledge exist only in the transcript.
        const learned = this.noteEncounter(
            cultivator, run, subject, 'witnessed', `Examined at ${placeName(cultivator)}.`
        );

        // `subject.facts` is what was perceived and goes to the narrator.
        // `subject.structure` is the schema behind it - governance, ordinals,
        // grades - and goes only to the inspector below. A category handed to a
        // narrator becomes a briefing, and there is no briefing in this world.
        const facts = factsForInvestigation(cultivator, ambient, subject.name, subject.facts);
        facts.structure.push(...subject.structure);
        if (learned) {
            facts.lines.push(
                `${subject.name} is now a name this cultivator holds, learned by looking at it.`
            );
        }

        const execution = this.freeAction(run, 'investigate', facts);
        execution.calls = [
            {
                name: 'engine.readState',
                action: 'investigate',
                summary: `Resolved "${query}" to ${subject.kind} ${subject.id}. Read only: no time passed, nothing changed.`,
                ok: true
            },
            ...structureCalls(subject.structure)
        ];
        if (learned) {
            execution.calls.push({
                name: 'knowledge.learn',
                action: 'name_surfaced',
                summary: `${subject.name} recorded as known (source: witnessed, at ${placeName(cultivator)}).`,
                ok: true
            });
        }
        return execution;
    }


    /**
     * Hitting somebody.
     *
     * Routed to `combat_manage.resolve`, which owns power assessment, edges,
     * the exchange, the wounds and the obligations that come out the far side.
     * Nothing about the outcome is decided here, and nothing about it may be:
     * this is the single most consequential thing a player can do in one turn
     * and a second opinion about who wins would be the drift the whole design
     * is built to prevent.
     *
     * The target must resolve to a real person who is actually present. A
     * confrontation with somebody the player cannot see is not a scene, and
     * fuzzy-matching a description into a name would pick the fight for them.
     *
     * `terms` says whether the two of them arranged this, and it reaches
     * exactly one thing: `whatFollowedTheBout`, on the far side of the resolve.
     * It is not passed to `combat_manage`, it does not touch `goal`, and there
     * is deliberately no branch on it above this line. A bout is combat with
     * both sides agreeing to be gentle; the agreement lives in what the outcome
     * MEANT and never in what the blows did.
     */
    private async attack(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        goal: string,
        terms: BoutTerms = 'open'
    ): Promise<Execution> {
        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();

        if (query.length < 2) {
            return refused('engine.resolveParty', 'attack', factsForRefusal(
                'Nobody in particular.',
                this.whoIsAbout(cultivator),
                'Unresolved party: no subject named for a confrontation. Nothing was resolved and ' +
                'no exchange was run.'
            ));
        }

        // ── a house is not a person ──
        //
        // `combat_manage.resolve` takes an opponent, and a faction is not one -
        // so "I attack the Nine Abyss Flame Sect" resolved to nothing and came
        // back `Unresolved party "Nine Abyss Flame Sect" for a confrontation`,
        // identically at every rung from a rogue to an apex seat. That reads as
        // a considered refusal and is not one: standing was never consulted,
        // because the noun never resolved.
        //
        // What is actually true is a fact about the world rather than about the
        // resolver, and both halves of it are already modelled. You cannot
        // fight a house, because a house is not standing anywhere - you fight
        // somebody in it, which is the confrontation resolver, or you set your
        // house against theirs, which is `posture` and opens at the seat. So
        // the refusal says that, names both routes, and prices the target out
        // of `sectThreat` where the player can name them.
        const asFaction = this.factionMeant(query, cultivator);
        if (asFaction && !this.somebodyAtHand(query, cultivator)) {
            const theirs = sectThreat(asFaction.id)?.acting
                ?? getCourt(asFaction.id)?.powerOrdinal
                ?? getApexInstitution(asFaction.id)?.powerOrdinal
                ?? null;
            const position = positionIn(this.repos, cultivator.id);
            return refused('engine.resolveParty', 'attack', factsForRefusal(
                'A house is not standing in front of you.',
                `${asFaction.name} is a name, a roll and some ground. There is nobody called that `
                + 'to swing at. What there is instead is people who answer to it - and any one of '
                + 'them can be fought by somebody standing in the same place as them - or the '
                + 'thing a house does to another house, which is a decision made by whoever holds '
                + 'the seat and not by whoever is angry.'
                + (theirs === null
                    ? ''
                    : ` The strongest person they will actually put in a room stands at `
                      + `${rankName(theirs)}.`)
                + (position
                    ? ''
                    : ' You hold no seat anywhere, so the second route is not open to you either.'),
                `"${query}" resolved to the faction ${asFaction.id}, and a faction is not a `
                + 'combatant: the confrontation resolver takes a person. '
                + (theirs === null
                    ? 'What the strongest person they would put in a room stands at is not '
                      + 'recorded anywhere this read can see.'
                    : `The strongest person they will put in a room stands at `
                      + `${rungAndOrdinal(theirs)}.`)
                + (position
                    ? ` This cultivator serves ${position.sectId}, so the other route is open to `
                      + 'them: what a house does to a house is decided from the seat.'
                    : ' This cultivator holds no membership anywhere, so the other route - what a '
                      + 'house does to a house, decided from the seat - is not open to them either.')
                + ' What is open is attacking a named member standing in the same place as them.'
            ));
        }

        // ── SOMEBODY OF MY OWN HEIGHT ────────────────────────────────────
        //
        // `somebodyAtHand` answers a gesture with whoever is NEAREST, which for
        // a fight is the wrong body: the nearest person is usually far above,
        // and the categorical-gap rule then correctly declines. So every route
        // into combat was suicide or a refusal and a player never fought
        // anybody, in a setting where a bout between equals is how a disciple
        // measures themselves.
        //
        // A peer phrase asks for a HEIGHT rather than a person, so it is
        // answered with the closest match on the ladder among the people
        // actually here. It never invents anybody: an empty square still falls
        // through to the same refusal below.
        const peer = GameService.SOMEBODY_OF_MY_OWN_HEIGHT.test(query)
            ? [...this.present(cultivator)]
                .sort((a, b) =>
                    Math.abs(a.realmOrdinal - cultivator.realmOrdinal)
                    - Math.abs(b.realmOrdinal - cultivator.realmOrdinal)
                    || (a.id < b.id ? -1 : 1))[0]
            : undefined;

        // A gesture at somebody in the square resolves to somebody in the
        // square. A name resolves to that name or to nothing.
        const pointed = peer ?? this.somebodyAtHand(query, cultivator);
        const party = pointed
            ? { kind: 'cultivator' as const, id: pointed.id, name: pointed.name }
            : resolveCultivator(this.repos, query, cultivator.id, scope, cultivator.realmOrdinal);
        const present = party ? this.present(cultivator).some(row => row.id === party.id) : false;
        if (!party || !present) {
            return refused('engine.resolveParty', 'attack', factsForRefusal(
                'Nothing to swing at.',
                // Not the conversational brush-off. A fight that does not
                // happen fails differently from a question nobody answers.
                'You look for them and the moment goes past you. There is nobody in front of ' +
                'you that the thought fits, and standing here deciding is its own answer.',
                `Unresolved party "${query}" for a confrontation` +
                `${party ? ', resolved but not co-located' : ''}. No exchange was run.`
            ));
        }

        // `goal` decides which endings the engine will reach for. It is passed
        // straight through; nothing in this layer reads it to pick a winner.
        const intent = goal === 'kill' || goal === 'subdue' || goal === 'humiliate'
            ? goal
            : 'drive_off';

        // Half the people in a square exist only in the world state, not in the
        // cultivators table, and `combat_manage` looks its opponent up by id.
        // Passing an id it cannot find produced "No cultivator with id npc-95."
        // as the answer to a player swinging at somebody standing in front of
        // them. Where there is no row, the opponent is described instead -
        // which is what `OpponentSchema` has the name and ordinal fields for.
        const onRecord = this.repos.cultivators.getById(party.id) !== undefined
            && this.repos.cultivators.getById(party.id) !== null;
        const standing = this.present(cultivator).find(row => row.id === party.id);

        // ── THE PERSON THE WORLD ACTUALLY HOLDS ──────────────────────────
        //
        // Where there is no row there is usually still a RECORD, and it is the
        // one the world has been keeping: their attributes, and what they are
        // carrying from every fight, crossing and tribulation before this one.
        // Describing them as a bare name and an ordinal handed the resolver a
        // stunt double - might 2, insight 2, unwounded - so a man who was
        // crippled here last week stood up fresh, and no wound this layer wrote
        // could ever be read back. Only the fields `OpponentSchema` already has
        // are filled; nothing about the tool's surface changes for this.
        const theirRecord = !onRecord && this.atHand
            ? this.atHand.npcs.find(npc => npc.id === party.id) ?? null
            : null;

        const result = await handleResolve({
            action: 'resolve',
            cultivatorId: cultivator.id,
            opponent: onRecord
                ? { cultivatorId: party.id }
                : {
                    name: party.name,
                    ...(standing ? { realmOrdinal: standing.realmOrdinal } : {}),
                    ...(theirRecord
                        ? {
                            realmOrdinal: theirRecord.cultivation.realmOrdinal,
                            // Clamped to the schema's bands rather than passed
                            // raw: an out-of-range attribute is a validation
                            // error, and a fight that fails to start is a worse
                            // answer than one fought on the nearest legal body.
                            might: Math.max(1, Math.min(3, theirRecord.cultivation.attributes.might)),
                            insight: Math.max(1, Math.min(4, theirRecord.cultivation.attributes.insight)),
                            untreatedInjuries: Math.max(0, Math.min(
                                10, Math.floor(theirRecord.cultivation.untreatedInjuries)
                            ))
                        }
                        : {})
                },
            goal: intent,
            vector: 'body',
            edges: [],
            opponentEdges: [],
            fightToTheEnd: false
        });

        // Seeing somebody well enough to fight them is seeing them.
        this.noteEncounter(
            cultivator, run, party, 'witnessed',
            `Fought at ${placeName(cultivator)}.`
        );

        const execution = this.fromToolResult('combat_manage.resolve', 'attack', result, party.name);

        // ── AND WHAT IT DID TO THEM ──────────────────────────────────────
        //
        // The other side of the boundary, crossed here because this is the only
        // layer that holds both stores. `combat_manage` wrote the player's half
        // and, for an opponent with a row, theirs; for everybody else it wrote
        // nothing, which is most of the people a player ever swings at. This
        // carries the findings it already made to the record that holds them.
        // Nothing is re-decided - see the module header - and it runs after the
        // resolve for the same reason the fallout does.
        const inTheWorld = this.whatItDidToThem(cultivator, theirRecord, result);
        execution.calls.push(...inTheWorld.calls);

        // ── AND WHAT THE ROOM MAKES OF IT ────────────────────────────────
        //
        // After the resolve, never before it and never instead of it. Every
        // number this reads was decided by `combat_manage` and the survival
        // layer and is already written down; this only says who else now holds
        // something about it.
        const fallout = this.whatFollowedTheBout(
            run, cultivator, party, standing ?? null, terms, result, inTheWorld.died
        );
        fallout.lines.unshift(...inTheWorld.lines);
        if (fallout.lines.length > 0) {
            // Into `prose` as well as `lines`, and this is not belt and braces.
            // `lines` is what a narrator may know and `prose` is the
            // deterministic rendering, and appending to only the first is how a
            // consequence gets computed, written to the ledger and never shown
            // to anybody playing without a model attached.
            //
            // And `required`, which is reserved for facts a player cannot play
            // without. This is one: the whole of the ruling is that the world
            // answers, so a narrator that drops the line leaves a player
            // believing they got away with it - which is the invisible version
            // of softening and is worse than the visible kind.
            execution.facts.lines.push(...fallout.lines);
            execution.facts.required = [...(execution.facts.required ?? []), ...fallout.lines];
            execution.facts.prose = [execution.facts.prose, ...fallout.lines].join('\n');
        }
        execution.calls.push(...fallout.calls);
        return execution;
    }

    /**
     * Carry what the resolver decided to the record that holds the person.
     *
     * ── THE BOUNDARY, AND WHY IT IS CROSSED HERE ─────────────────────────
     *
     * `combat_manage.resolve` persists its opponent's half only for an opponent
     * with a row in the `cultivators` table. Everybody else - which is most of a
     * square, and effectively all of the people a player actually spars with -
     * is DESCRIBED to it, because there is no id to pass, and everything it then
     * decided about them was thrown away on the way out. Beat somebody bloody
     * and they were whole the next turn; kill them and they were standing there.
     *
     * Neither side could close that alone. The tool owns one store, runs its
     * writes in one synchronous transaction, and has no run handle at all when
     * it is driven off the MCP surface - so it cannot reach an async per-run
     * world. The world layer has never heard of a run or a played cultivator.
     * This method is the only place that holds both, so this is where the two
     * are joined, and it does no deciding of its own: it reads the findings out
     * of the body the resolver returned and hands them to the world layer's own
     * write path.
     *
     * ── WHAT IT DOES NOT CARRY ───────────────────────────────────────────
     *
     * Hit points. The world does not store them and `gatherings.ts` explains at
     * `BOUT_BODY` why it must not start: damage is a fraction of a maximum, so
     * the absolute number is arbitrary, and a body model here would be a second
     * one beside the cultivation engine's. What a fight leaves that the world
     * can hold is wounds, and those are carried in full.
     */
    private whatItDidToThem(
        cultivator: Cultivator,
        theirRecord: NpcRecord | null,
        result: object
    ): { died: boolean; lines: string[]; calls: ToolCallRecord[] } {
        const nothing = { died: false, lines: [] as string[], calls: [] as ToolCallRecord[] };
        if (!theirRecord || !this.atHand || isGuidingErrorBody(result)) return nothing;

        const body = result as Record<string, unknown>;
        const outcome = body.outcome;
        if (typeof outcome !== 'string') return nothing;

        // The synthetic id the tool minted for a described body. Everything
        // about who lost is read against it rather than inferred from who won,
        // because a stalemate has a winner of neither.
        const them = body.opponent as { id?: unknown } | undefined;
        const theirRollId = typeof them?.id === 'string' ? them.id : null;
        const loserId = typeof body.loserId === 'string' ? body.loserId : null;

        // Parsed, not cast. These rows came from `summariseInjury` one call away
        // and are going onto a permanent record, so they go through the schema
        // that owns their shape - a body that does not parse writes no wounds
        // rather than writing invented ones.
        const reported = (body.injuries as { opponent?: unknown } | undefined)?.opponent;
        const parsed = InjurySchema.array().safeParse(reported ?? []);
        const wounds: Injury[] = parsed.success ? parsed.data : [];

        const wrote = whatTheConfrontationDidToThem(this.atHand, {
            npcId: theirRecord.id,
            byId: cultivator.id,
            byName: cultivator.name,
            day: Math.floor(this.atHand.currentDay),
            wounds,
            outcome: outcome as ConfrontationOutcome,
            lost: loserId !== null && theirRollId !== null && loserId === theirRollId,
            finished: body.finished === true
        });
        if (!wrote.wrote) return nothing;

        // A world changed inside one turn. `act` persists on this flag before
        // anything is narrated, so a restart cannot lose a killing.
        this.worldDirty = true;

        const calls: ToolCallRecord[] = [{
            name: 'world.whatTheConfrontationDidToThem',
            action: 'attack',
            summary:
                `${theirRecord.id} (${theirRecord.name}) in world state: `
                + `${wrote.wounds} wound ${wrote.wounds === 1 ? 'row' : 'rows'} written, `
                + `died=${wrote.died}, facts=${wrote.facts.length}`
                + (wrote.handoff?.primaryHeirId
                    ? `, heir=${wrote.handoff.primaryHeirId} inheriting `
                      + `${wrote.handoff.goalsInherited.length} goals`
                    : '')
                + `. outcome=${outcome}; finished=${body.finished === true}. No hit points are `
                + 'written: the world stores wounds, not a bar.',
            ok: true
        }];
        if (!parsed.success && Array.isArray(reported) && reported.length > 0) {
            // Loud rather than silent. A body that stopped parsing means the
            // resolver's projection changed shape, and a quietly unwounded world
            // is exactly the failure this whole method exists to end.
            calls.push({
                name: 'world.whatTheConfrontationDidToThem',
                action: 'attack',
                summary:
                    `${reported.length} reported opponent wounds did not parse as injuries and `
                    + 'were NOT written. The resolve body\'s shape has drifted from InjurySchema.',
                ok: false
            });
        }

        return { died: wrote.died, lines: wrote.lines, calls };
    }

    /**
     * Who else holds something about a fight, once it is over.
     *
     * ── THE RULING ───────────────────────────────────────────────────────
     *
     * AGENTS.md: **"Kill somebody during an agreed bout and you will obviously
     * face consequences."** Nothing above this line prevents it and nothing
     * above this line softened it. The bout ran through the same resolver a
     * killing runs through, with the same exchanges, the same wounds and the
     * same death gate, and this is where - and the only place where - the
     * difference between having agreed and not having agreed is charged.
     *
     * ── WHAT WAS ACTUALLY MISSING ────────────────────────────────────────
     *
     * All of it. "I spar with him" and "I pin him" both parsed to `subdue` and
     * were indistinguishable from that point on; `seedObligations` keys on the
     * outcome alone, so a bout that ruined somebody wrote exactly the record a
     * mugging writes; and a killing wrote NOTHING, because the resolver is
     * right that the dead hold nothing and nobody else was ever asked. A house
     * could lose a member in a friendly bout and the ledger would not contain
     * the fact.
     *
     * ── WHAT IT WRITES ───────────────────────────────────────────────────
     *
     * Two ordinary rows in tables that already exist, both in the direction the
     * rest of the codebase writes - the aggrieved party HOLDS it, the offender
     * is the SUBJECT of it - so every query that reads obligations finds them,
     * inheritance carries them, and a descendant three generations on can still
     * be carrying it:
     *
     *   THEIR HOUSE   an obligation row against whoever went too far. The loser
     *                 already has their own record from the resolver and this
     *                 does not touch it; where the loser is dead they have no
     *                 record at all, which is exactly the hole this fills.
     *   YOUR HOUSE    standing, through `spendStanding`, which is the same
     *                 arithmetic every other act inside a house runs on. Only
     *                 where the player is the one who went too far, because a
     *                 house ledger is a thing the played cultivator has and an
     *                 NPC in a square does not.
     *
     * Nothing is invented for this and nothing is grave-specific or bout-
     * specific in either table. `attentionFor` writes a robbery the same way.
     */
    private whatFollowedTheBout(
        run: Run,
        cultivator: Cultivator,
        party: { id: string; name: string },
        theirRow: RosterEntry | null,
        terms: BoutTerms,
        result: object,
        /**
         * Whether the world recorded the opponent's death, for an opponent the
         * world holds and the cultivators table does not.
         *
         * The resolve body's own `opponentDied` covers the other half. Both are
         * the survival layer's answer about the same person reaching this by
         * different routes, because the person is stored in different places.
         */
        diedInTheWorld = false
    ): { lines: string[]; calls: ToolCallRecord[] } {
        const nothing = { lines: [] as string[], calls: [] as ToolCallRecord[] };
        if (isGuidingErrorBody(result)) return nothing;

        const body = result as Record<string, unknown>;
        const outcome = body.outcome;
        if (typeof outcome !== 'string') return nothing;

        // Which of the two of them came off worst, read off the resolver's own
        // answer rather than inferred from the numbers. A stalemate and a
        // no-contest name nobody, and neither of them is anything to answer for.
        const loserId = typeof body.loserId === 'string' ? body.loserId : null;
        if (loserId === null) return nothing;

        // `died` is the survival layer's word, written before this ran, and it
        // is THE PLAYER's - `combat_manage.resolve` has always read that way and
        // its callers read it that way.
        //
        // The opponent's has two homes because the opponent does. Somebody with
        // a cultivator row is answered by the tool's own death gate and arrives
        // as `opponentDied`; somebody the world holds is answered on the far
        // side of the boundary and arrives as `diedInTheWorld`. Both are the
        // same ruling by the same layer about the same event.
        //
        // This is what the header's ruling was waiting for. Until an opponent
        // could die at all, `loserDied` could only ever be false for the person
        // a player actually spars with, so the killed-somebody-in-an-agreed-bout
        // consequence was unreachable against the entire population a player
        // meets. It is reachable now, and nothing else about the charge changed.
        const playerDied = body.died === true;
        const opponentDied = body.opponentDied === true || diedInTheWorld;
        const loserIsThePlayer = loserId === cultivator.id || playerDied;
        const loserDied = loserIsThePlayer ? playerDied : opponentDied;

        // Everybody standing here who is not one of the two of them. The room
        // is what `look` already lists, so this claims no witness the player
        // could not have seen for themselves.
        const witnesses = this.present(cultivator)
            .filter(row => row.id !== party.id && row.id !== cultivator.id).length;

        const theirHouseId = loserIsThePlayer
            ? positionIn(this.repos, cultivator.id)?.sectId ?? null
            : theirRow?.sectId ?? this.repos.cultivators.getById(party.id)?.sectId ?? null;
        const theirHouse = theirHouseId ? this.repos.sects.getById(theirHouseId) : null;

        const followed = whatFollowsFromTheBout({
            terms,
            outcome: outcome as ConfrontationOutcome,
            loserDied,
            witnesses,
            theirHouse: theirHouse
                ? {
                    alignment: theirHouse.alignment,
                    // Somebody the house has invested in. A named rank is the
                    // engine's existing statement of that and the one
                    // `whenItIsDoneToOneOfOurs` already asks for.
                    ranked: loserIsThePlayer
                        ? positionIn(this.repos, cultivator.id) !== null
                        : (theirRow?.sectRank ?? null) !== null
                }
                : null
        });

        if (followed.howFar === 'kept') return nothing;

        const lines: string[] = [];
        const calls: ToolCallRecord[] = [];
        const onDay = Math.floor(run.elapsedDays);
        // Who went too far, and who it was done to. One of them is the player
        // and which one is not fixed: a bout the player loses badly is the same
        // event with the names the other way round.
        const actorId = loserIsThePlayer ? party.id : cultivator.id;
        const actorName = loserIsThePlayer ? party.name : cultivator.name;
        const hurtName = loserIsThePlayer ? cultivator.name : party.name;

        if (followed.against && theirHouseId && theirHouse) {
            // `blood_feud` is a different KIND and not a heavier grudge -
            // `grudges.ts` keeps them apart because a feud runs between lines,
            // is expected to be inherited, and everybody involved knows it is
            // running. Calling `createGrudge` for both wrote every killing into
            // the ledger as a grudge whatever the engine had decided, which is
            // the caller overruling the decision it just asked for.
            const write = followed.against.kind === 'blood_feud'
                ? createBloodFeud : createGrudge;
            const record = write({
                holderId: theirHouseId,
                subjectId: actorId,
                cause: followed.against.cause,
                severity: followed.against.severity,
                onDay,
                description:
                    `${followed.against.description} ${hurtName} was ${theirHouse.name}'s, and `
                    + `${actorName} is the name on it.`,
                terms: null,
                dueOnDay: null,
                participants: [cultivator.id, party.id],
                tags: [...followed.against.tags]
            });
            writeObligation(this.db as unknown as DatabaseHandle, record);

            calls.push({
                name: followed.against.kind === 'blood_feud'
                    ? 'social.createBloodFeud' : 'social.createGrudge',
                action: 'attack',
                summary:
                    `${theirHouseId} now holds a ${followed.against.severity} `
                    + `${followed.against.kind} about ${actorId} (${followed.against.cause}). `
                    + `terms=${terms}; outcome=${outcome}; witnesses=${witnesses}. Written to `
                    + 'obligations; permanent until settled, and inheritable.',
                ok: true
            });

            // Said as a fact about the world rather than as a warning, and only
            // where the player can name the house. Not knowing who is coming is
            // itself the fact, and the discovery layer owns that rule.
            const known = this.knowledge.isAwareOf(cultivator.id, 'sect', theirHouseId);
            lines.push(
                known
                    ? `${hurtName} was ${theirHouse.name}'s. ${followed.note}`
                    : `${hurtName} answered to somebody, and you do not know who. They will be `
                      + 'told what was agreed and what happened instead.'
            );
        } else if (followed.brokenPromise) {
            lines.push(
                `${hurtName} answered to nobody, so there is nobody to come for it. That is a `
                + 'fact about who they were and not a thing you were spared.'
            );
        }

        // ── AND WHAT YOUR OWN PEOPLE MAKE OF IT ──────────────────────────
        //
        // Only when the player is the one who went too far. A house that put a
        // disciple in a friendly bout and got a body back has been told
        // something about that disciple, and standing is where a house keeps
        // what it thinks. `spendStanding` runs the house's own arithmetic - the
        // discount a following buys, the floor - so nothing here invents a
        // curve; this supplies the raw figure and says where it came from.
        const mine = loserIsThePlayer ? null : positionIn(this.repos, cultivator.id);
        if (mine && followed.ownHouseCost > 0) {
            const credit = creditIn(this.repos, cultivator.id, mine, run.elapsedDays, false);
            const spent = spendStanding(
                this.repos, cultivator.id, mine, credit, followed.ownHouseCost, run.elapsedDays
            );
            lines.push(
                `Your own people heard what it was supposed to be before they heard how it ended.`
            );
            calls.push({
                name: 'house.spendStanding',
                action: 'attack',
                summary:
                    `${mine.sectId} standing ${credit.standing.toFixed(2)} to `
                    + `${spent.landedAt.toFixed(2)} (raw ${followed.ownHouseCost}, spent `
                    + `${spent.spent.toFixed(2)}, backlash ${spent.level}). Charged for an agreed `
                    + `bout that ended ${followed.howFar}, not for the fight.`,
                ok: true
            });
        }

        return { lines, calls };
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
    private partyPutTo(
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
    private nobodyByThatName(
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
    private interact(
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
        const spoken = party.kind === 'cultivator'
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
        target: string | undefined
    ): Promise<Execution> {
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
        const occupation = named ?? (anyWork
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
    private askAround(
        run: Run,
        cultivator: Cultivator,
        asked: RosterEntry,
        topic: string,
        scope: KnowledgeScope
    ): Execution {
        // What the question was about, resolved against the same catalogs
        // everything else uses. Unresolvable is a real outcome, not an error:
        // people are asked about things that do not exist all the time.
        const subject = resolveAnything(this.repos, topic, cultivator, scope);

        // Whether the player can put a name to the person they are talking
        // to, decided BEFORE the answer, so a stranger stays a stranger
        // through the part where they decline to help.
        const knownAlready = this.knowledge.isAwareOf(cultivator.id, 'cultivator', asked.id);

        const answer = askedAbout({
            asker: cultivator,
            asked,
            speakerName: knownAlready ? asked.name : null,
            subject,
            rawTopic: topic,
            holdsIt: subject !== null
                && (subject.kind === 'cultivator' || subject.kind === 'sect' || subject.kind === 'place')
                && this.knowledge.isAwareOf(asked.id, subject.kind, subject.id),
            priorDealings: this.dealingsWith(cultivator, asked.id)
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
    private dealingsWith(cultivator: Cultivator, otherId: string): number {
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
            case 'order': {
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
                    const line = held
                        ? `Walking out is a thing you say out loud and it is done the day you say `
                          + `it. What it costs is the seat and the ${held.contribution} `
                          + `contribution: neither travels, and coming back later does not come `
                          + `back above ${held.rankTitle}.`
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

            const result = await handleJoin({
                action: 'join',
                sectId: named.id,
                cultivatorId: cultivator.id
            });
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

        const all = (listing as { sects?: Array<{ id: string; name: string; admissible?: boolean | null; guestDoorOpen?: boolean | null }> }).sects ?? [];
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
            occasion: 'news'
        });

        for (const hearing of asked.hearings) recordHearing(this.knowledge, cultivator, run, hearing);

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
        }];
        return execution;
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
    private factionMeant(
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
    private namedButUnresolved(
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
    private noPartyNamed(
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

    /**
     * Asking an institution for a thing.
     *
     * Three forms, selected by the label and never by what the answer turns out
     * to be. `grant` sends it up the chain through `handlePetition`, which has
     * been in `sect-politics.ts` the whole time and which nothing typed could
     * reach; `stock` is the application against something the holder cannot
     * reorder, which is the Requisition and the schedule amendment and anything
     * else shaped like them; `descent` is a claim of a line, which is an
     * application for recognition and is adjudicated rather than granted.
     */
    private async petition(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string | undefined,
        matter: string | undefined
    ): Promise<Execution> {
        const which: PetitionIntent = PETITION_INTENTS.includes(intent as PetitionIntent)
            ? intent as PetitionIntent
            : DEFAULT_PETITION_INTENT;

        if (which === 'stock') return this.requisition(run, cultivator, target, matter);
        if (which === 'descent') return this.claimDescent(run, cultivator, target);

        const position = positionIn(this.repos, cultivator.id);
        const named = this.factionMeant(target, cultivator);

        // A body was named and it resolved to nothing, so the request has not
        // been made. Falling through to the player's own chain here would send
        // a petition somewhere they did not ask about and report back on it.
        if (this.namedButUnresolved(target, named)) {
            return this.noPartyNamed(
                'petition', target, cultivator,
                'No such door.',
                'You have named somebody to put it to, and it is not a name you hold. Nobody has '
                + 'said it in front of you, and a petition goes to a body you can find.'
            );
        }

        // Nobody to ask, and nobody to ask through. The gate here is POSITION
        // rather than rank: a petition is carried by people who are already
        // carrying things for you, and an unbacked cultivator has none.
        if (!position && !named) {
            return refused('engine.petitionChain', 'petition', factsForRefusal(
                'Nowhere for it to go.',
                servesNoHouse(
                    cultivator.name,
                    'a petition is not a thing you send - it is a thing somebody carries. It goes '
                    + 'up over the name of a house, through whoever that house holds from, as far '
                    + 'as each of them is willing to pass it. With no house above you and nobody '
                    + 'named to receive it, there is nothing for it to travel along.'
                ),
                standingStructure(null, null)
            ));
        }

        // The chain is the house's, so the petition starts at the house. A
        // named body that is not on it is not above this cultivator, and saying
        // which bodies ARE is the useful half of the refusal.
        const startId = position?.sectId ?? named?.id ?? null;
        if (named && position) {
            const chain = chainToApex(position.sectId);
            if (!chain.includes(named.id)) {
                const nameable = chain
                    .slice(1)
                    .filter(id => this.knowledge.isAwareOf(cultivator.id, 'sect', id))
                    .map(id => this.repos.sects.getById(id)?.name
                        ?? getCourt(id)?.name
                        ?? getApexInstitution(id)?.name
                        ?? id);
                return refused('engine.petitionChain', 'petition', factsForRefusal(
                    'Not above you.',
                    `${named.name} is not somebody ${position.sectName} holds from, so there is `
                    + 'nobody between you and them whose business it is to carry anything. '
                    + (nameable.length === 0
                        ? 'Who your own house answers to is not something you have been told.'
                        : `What is above ${position.sectName}, as far as you have been told, is `
                          + `${nameable.join(', then ')}.`),
                    `The chain of houses ${position.sectId} answers up does not contain `
                    + `${named.id} at any link. ${standingStructure(position, null)}`
                ));
            }
        }

        const result = await handlePetition({
            action: 'petition',
            cultivatorId: cultivator.id,
            ...(startId ? { sectId: startId } : {}),
            matter: (matter ?? target ?? 'a hearing').slice(0, 400)
        });
        const execution = this.fromToolResult(
            'sect_politics.petition', 'petition', result, 'The petition'
        );
        // Whose name it went up under. Not a gate - a petition may be sent from
        // any rung - but the receiving body reads the rank off the letter, and
        // a player is entitled to know what it says about them.
        execution.facts.structure.push(
            position
                ? `Sent over ${rankAndIndex(position)}.`
                : 'Sent by somebody who serves no house. There is no rank on the letter.'
        );
        return execution;
    }

    /**
     * The application against something a holder cannot reorder.
     *
     * The Requisition Against Standing Stock is the named instance and it is
     * DATA rather than a rule: `theForm`, `sufficientReason`, `decidedBy`,
     * `releaseMode` and `recordedRefusal` are fields on `Holding`, so a
     * schedule amendment at another body runs through the same code and comes
     * back in that body's own terms. Nothing here names a faction.
     *
     * IT IS ALWAYS REFUSED, and the refusal is the content. Not because a grant
     * is forbidden - one has been made - but because the engine holds no state
     * that satisfies `sufficientReason`, and a caller asserting that it does is
     * exactly the affordance the authority boundary exists to refuse. So the
     * form's own standard comes back, with the applicant's own words beside it,
     * and with the recorded precedent where the holder kept one. `savingTheSect`
     * says what would actually change the answer, which makes the refusal a
     * route rather than a wall.
     */
    private requisition(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        matter: string | undefined
    ): Execution {
        const named = this.factionMeant(target, cultivator);
        if (!named) {
            return this.noPartyNamed(
                'petition', target, cultivator,
                'Filed against whom?',
                'A form is filed against a body that is holding something, and you have not said '
                + 'which body.'
            );
        }

        const holdings = getHoldingsOf(named.id);
        const withForm = holdings.filter(h => h.theForm !== null);
        if (withForm.length === 0) {
            // Never "they hold nothing". The count is known to the people the
            // catalog says it is known to, and an outsider learning that a body
            // holds nothing is learning the same shape of secret as an outsider
            // learning that it holds something.
            return refused('engine.requisition', 'petition', factsForRefusal(
                'No such form there.',
                `${named.name} keeps no procedure of the kind. Whether that is because there is `
                + 'nothing behind it to apply for, or because they have never written one down, '
                + 'is not something anybody outside could tell you.',
                `${named.id} holds ${holdings.length} line item(s) of the kind, and not one of them `
                + 'carries a stated form to fill in. What the counts are is not disclosed either '
                + 'way: who a count is known to is a property of the holding, and it does not '
                + 'include this cultivator.'
            ));
        }

        const asked = (matter ?? '').trim();
        const lines: string[] = [];
        for (const holding of withForm) {
            lines.push(holding.theForm as string);
            lines.push(holding.sufficientReason);
            lines.push(holding.decidedBy);
            if (holding.anyoneMayRefuse) {
                lines.push(
                    'Any one of them can refuse without giving a reason, and the instrument does '
                    + 'not require them to.'
                );
            }
            if (holding.recordedRefusal) {
                lines.push(holding.recordedRefusal.theCase);
                lines.push(holding.recordedRefusal.refusedBy);
                lines.push(holding.recordedRefusal.afterwards);
            }
            if (holding.savingTheSect) lines.push(holding.savingTheSect);
        }
        // The applicant's own words, shown back. Being refused in the terms you
        // asked in is the interaction; nothing branches on the string.
        lines.push(asked.length >= 2
            ? `What you have put on the form is: ${asked}. It is filed as written.`
            : 'The matter line is blank. It is filed as written.');
        lines.push(
            'It is receipted. Nothing else happens today, and nothing else was ever going to.'
        );

        const facts = factsForToolResult(`${named.name}: the form is filed.`, lines);
        facts.structure.push(
            `${withForm.length} line item(s) at ${named.id} carry a form to fill in. `
            + withForm.map(h =>
                h.releaseMode === 'written_instruction'
                    ? 'One is released on a written instruction somebody left, which means '
                      + 'somebody can act on those terms'
                      + (h.anyoneMayRefuse ? ', and any single member may still end it.' : '.')
                    : 'One is released by a body deciding together'
                      + (h.anyoneMayRefuse
                          ? ', and any single member of that body may end it.'
                          : ', and no single member may end it alone.')).join(' ')
            + ' The counts and the grades are withheld: who the count is known to does not '
            + 'include this cultivator.'
        );
        facts.structure.push(
            'Refused by construction. No state this engine can reach satisfies what the holder '
            + 'counts as a sufficient reason, and no argument may assert that it has been met.'
        );
        // Whose name is on the form. NOT a gate, and deliberately not one: the
        // catalog says clerks are taught the Requisition as a single procedure
        // and that it permits an application nobody has made, so the form is
        // open to anybody who can find the counter. What standing changes here
        // is the letterhead, and the answer is the same either way - which is
        // the honest shape of an instrument that has been granted once in four
        // hundred years.
        const filedBy = positionIn(this.repos, cultivator.id);
        facts.structure.push(
            filedBy
                ? `Filed over ${rankAndIndex(filedBy)}.`
                : 'Filed by somebody who serves no house. The form does not require one.'
        );

        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'refused',
            calls: [{
                name: 'engine.requisition',
                action: 'petition',
                summary:
                    `Filed against ${named.id}. Answered out of the holder's own form. Not `
                    + 'granted: sufficientReason is a fact about the world and nothing here may '
                    + 'claim it has been met.',
                ok: false
            }]
        };
    }

    /**
     * Claiming a line, which is an application for recognition.
     *
     * `auditAncestralClaim` exists to adjudicate a FACTION's claim and the
     * Ninefold Ledger opens a lineage audit unasked, so the world already had
     * both halves of this - and a player had no way to make the claim that
     * would be audited.
     *
     * The gate is the knowledge gate and it is the whole of it: the ancestor is
     * matched against the ancestral records of houses this cultivator can
     * already name, so there is no path from a name they type to a name they
     * have not been told. An unheard ancestor and an invented one come back
     * identical, and only the quoted string differs.
     */
    private claimDescent(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Execution {
        const wanted = (target ?? '').trim();

        let line: { sectId: string; sectName: string; ancestorName: string } | null = null;
        if (wanted.length >= 3) {
            for (const sect of SECTS) {
                if (!this.knowledge.isAwareOf(cultivator.id, 'sect', sect.id)) continue;
                const records = getSectAncestry(sect.id);
                for (const ancestor of records?.ancestors ?? []) {
                    if (matchScore(wanted, ancestor.name) > MATCH_THRESHOLD) {
                        line = {
                            sectId: sect.id,
                            sectName: sect.name,
                            ancestorName: ancestor.name
                        };
                        break;
                    }
                }
                if (line) break;
            }
        }

        if (!line) {
            return refused('engine.claimDescent', 'petition', factsForRefusal(
                'A name and nothing behind it.',
                'You can say it. Saying it is free, and it is also all that happens: there is '
                + 'nobody in front of you who has heard the name, no roll it appears on that you '
                + 'have ever been shown, and nothing you are carrying that would connect you to '
                + 'it. A claim is worth what somebody can certify, and nobody certifies this.',
                `Unresolved ancestor "${wanted.slice(0, 60)}": no match in the ancestral records `
                + 'of any faction this cultivator is aware of. An unheard name and an invented '
                + 'one are answered identically here, by construction.'
            ));
        }

        // `claimIsTrue` is ground truth and is never surfaced. What is public
        // is whether a claim was MADE, which is what `claimed` reports.
        const audit = auditAncestralClaim(line.sectId);
        const lines = [
            `${line.ancestorName} is on ${line.sectName}'s wall, and you have said you are of `
            + 'that line.',
            'It is filed the way any claim is filed: written down, dated, and left standing until '
            + 'somebody has a reason to test it.',
            audit
                ? `${line.sectName} makes a claim of its own about what became of that line, and `
                  + 'has done for a long time. Whether a claim is true is not a thing anybody '
                  + 'settles by asserting it - it is a thing one house in the world sells an '
                  + 'answer to, and it sells that answer to the claimant or to a rival with equal '
                  + 'willingness.'
                : `${line.sectName} makes no claim about that line at all, which is not the same `
                  + 'as denying yours and is not evidence for it either.',
            'Nothing has changed about what you can do, where you can stand, or what anybody owes '
            + 'you. That is what an unexamined claim is worth.'
        ];

        const facts = factsForToolResult('The claim is made.', lines);
        facts.structure.push(
            `Matched "${wanted.slice(0, 40)}" to an ancestor of ${line.sectId} within this `
            + 'cultivator\'s knowledge. claimIsTrue and afterCrossing are ground truth and are '
            + 'not read here.'
        );
        facts.structure.push(
            'No state supports a personal lineage in this engine: there is no descent edge from a '
            + 'player to a catalogued ancestor, so the claim is recorded as an assertion and '
            + 'nothing derives from it. Certification is the only instrument that would.'
        );

        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'refused',
            calls: [{
                name: 'engine.claimDescent',
                action: 'petition',
                summary:
                    `Claim of descent from an ancestor of ${line.sectId}, filed and unsupported. `
                    + 'No lineage state exists to support or contradict it.',
                ok: false
            }]
        };
    }

    /**
     * What one house is to another: war, alliance, defection - or the read.
     *
     * The three that commit are the seat's, for one reason stated once: each of
     * them binds the house to something it cannot quietly walk back, and there
     * is exactly one person in a house entitled to do that. A rogue is told what
     * a declaration would require; a junior is told the rung it opens at in
     * their own house's title; the seat's declaration happens and is recorded.
     *
     * WHAT IT COSTS IS STATED AND NOT INVENTED. `DISASTER_RESPONSES` prices war
     * and aid in consequences rather than numbers, and `sectThreat` supplies the
     * two ordinals that decide whether this was sane. No standing figure is
     * charged, deliberately: the catalog holds no number for what a declaration
     * costs a head with their own people, and manufacturing one here would be a
     * balance decision made in the narration tier - the specific thing AGENTS.md
     * forbids. It is a real gap and it belongs in `leadership.ts`.
     */
    private posture(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string | undefined
    ): Execution {
        const which: PostureIntent = POSTURE_INTENTS.includes(intent as PostureIntent)
            ? intent as PostureIntent
            : DEFAULT_POSTURE_INTENT;

        const named = this.factionMeant(target, cultivator);
        const position = positionIn(this.repos, cultivator.id);

        if (which === 'stance') {
            if (!named) {
                return this.noPartyNamed(
                    'posture', target, cultivator,
                    'Toward whom?',
                    'A house takes a position toward somebody in particular, and you have not '
                    + 'said who.'
                );
            }
            return this.standingToward(run, cultivator, position, named);
        }

        // ── the gate ──
        //
        // BEFORE the target is resolved, and that ordering is deliberate. Both
        // of these refusals are about the speaker and disclose nothing whatever
        // about who was named, so they are safe to give to somebody who has
        // never heard of the house in the sentence - and a rogue at the bottom
        // of the ladder learns what a declaration would take, which is a thing
        // they can go and get. Resolving first would have answered them with
        // the knowledge gate instead, which is correct and teaches nothing.
        //
        // Position, then rank. Two failures and two sentences: somebody who
        // serves nothing has nothing to declare with, and somebody junior has a
        // house whose decision this is not.
        if (!position) {
            return refused('engine.housePosture', 'posture', factsForRefusal(
                'You speak for nobody.',
                servesNoHouse(cultivator.name, THE_DECLARATION_REQUIRES[which]),
                standingStructure(null, null)
            ));
        }
        if (!mayCommitTheHouse(position)) {
            const opens = opensAtRung(position);
            const elder = elderRungTitle(position);
            return refused('engine.housePosture', 'posture', factsForRefusal(
                'Not your decision.',
                rankDoesNotReach(position, opens)
                + (elder && elder !== position.ranks[opens]
                    ? ` What ${elder} does with a thing like this is put it in front of them.`
                    : ''),
                standingStructure(position, opens)
            ));
        }

        // Only now: the seat is entitled to declare, and the question is
        // whether they have named anybody they could actually have meant.
        if (!named) {
            return this.noPartyNamed(
                'posture', target, cultivator,
                'Against nobody.',
                'A house takes a position toward somebody in particular, and you have not said who.'
            );
        }

        // ── it happens ──
        const own = sectThreat(position.sectId);
        const theirActing = sectThreat(named.id)?.acting
            ?? getCourt(named.id)?.powerOrdinal
            ?? getApexInstitution(named.id)?.powerOrdinal
            ?? null;
        const theirSeal = sectThreat(named.id);

        const cost = DISASTER_RESPONSES.find(
            r => r.response === (which === 'war' ? 'war' : 'aid')
        );

        // A levy is only a levy where the paying house already holds from the
        // asking one. That is `getParentage`, and it means whether this is a
        // right being exercised or a threat being made is a fact about the two
        // parties rather than about the word the player used.
        const theirParentage = getParentage(named.id);
        const theyHoldFromUs = theirParentage?.parentFactionId === position.sectId;

        const lines: string[] = [DECLARED[which](position.sectName, named.name)];
        if (cost) lines.push(cost.cost);

        // The measured half, and the only place a number appears. Both figures
        // are the catalog's own `powerOrdinal`, read through `sectThreat` so the
        // acting number and the one-off ceiling are never conflated.
        if (own && theirActing !== null) {
            const gap = theirActing - own.acting;
            lines.push(
                gap > 0
                    ? `The strongest person ${named.name} will actually put in a room stands `
                      + `${gap} rung${gap === 1 ? '' : 's'} above the strongest person `
                      + `${position.sectName} can.`
                    : gap < 0
                        ? `${position.sectName} can put somebody in a room that ${named.name} `
                          + 'cannot answer.'
                        : 'Neither house can put somebody in a room the other cannot answer.'
            );
            // A ceiling is disclosed only where the world already knows about
            // it. A sealed ancestor nobody has heard of stays unheard of, and
            // the silence is not a tell, because most houses have nothing.
            if (theirSeal?.sealedIsPublic && theirSeal.ceiling > theirSeal.acting) {
                lines.push(
                    'And it is common talk that they are holding something they have never '
                    + 'spent. Whether that is true, and what it is, was somebody else\'s problem '
                    + 'until today.'
                );
            }
        }

        if (which === 'alliance') lines.push(OPENLY_OR_IN_SECRET.theAllianceIsVisible);
        if (which === 'tribute') {
            lines.push(theyHoldFromUs
                ? `${named.name} holds from ${position.sectName} already, on terms everybody in `
                  + `the province can name: ${theirParentage?.holds ?? 'the arrangement is on record.'} `
                  + 'Asking is the ordinary exercise of it, and being refused would be the news.'
                : `${named.name} holds from nobody you can call on, so there is nothing behind the `
                  + 'asking except what happens if they say no. That is not a levy. Everybody who '
                  + 'hears about it will read it as the sentence before a different one.');
        }
        if (which === 'defect') {
            const parentage = getParentage(position.sectId);
            lines.push(parentage?.holds
                ?? 'Whoever the house currently holds from will hear about it from somebody other '
                   + 'than you.');
        }

        const onDay = Math.floor(run.elapsedDays);
        writeFlag(
            this.repos.db,
            cultivator.id,
            postureKey(position.sectId, named.id),
            JSON.stringify({
                stance: which,
                towardId: named.id,
                towardName: named.name,
                onDay,
                // All three are said out loud. A stance nobody can see is a
                // conspiracy, which is a different instrument with a different
                // failure mode - see OPENLY_OR_IN_SECRET - and this engine has
                // no way to keep one secret.
                openly: true
            })
        );

        const facts = factsForToolResult(DECLARED[which](position.sectName, named.name), lines);
        facts.structure.push(
            `The posture ${position.sectName} holds toward ${named.name} (${named.id}) is now `
            + `"${which}", recorded on day ${onDay} against the pair of them. Declared by `
            + `${rankAndIndex(position)}, which is the seat.`
        );
        if (own && theirActing !== null) {
            facts.structure.push(
                `What each house can actually put in a room: ${position.sectName} at `
                + `${rungAndOrdinal(own.acting)}, ${named.name} at ${rungAndOrdinal(theirActing)}. `
                + (theirSeal?.sealedIsPublic
                    ? `The one-off they could wake on top of that reaches `
                      + `${rungAndOrdinal(theirSeal.ceiling)}, and they do not keep it quiet.`
                    : 'Whether they hold a one-off to wake on top of that is not disclosed.')
            );
        }
        facts.structure.push(
            'No standing is charged. The catalog holds no figure for what a declaration costs a '
            + 'head with their own people, and inventing one here would be a balance decision '
            + 'made in the narration tier.'
        );

        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'engine.housePosture',
                action: 'posture',
                summary:
                    `${position.sectId} -> ${named.id}: ${which}, recorded on day ${onDay} by the `
                    + 'seat. There is no verb anywhere that unsays it.',
                ok: true
            }]
        };
    }

    /** Where two houses already stand. A read, and the cheapest branch of `posture`. */
    private standingToward(
        run: Run,
        cultivator: Cultivator,
        position: HousePosition | null,
        named: { id: string; name: string }
    ): Execution {
        const lines: string[] = [];
        const entry = position ? getSect(position.sectId) : null;

        const declared = position
            ? readPosture(this.repos.db, cultivator.id, position.sectId, named.id)
            : null;
        if (declared && position) {
            lines.push(
                `${position.sectName} has already taken a position toward ${named.name}, and it `
                + `was ${declared.stance === 'war'
                    ? 'war'
                    : declared.stance === 'alliance'
                        ? 'an alliance'
                        : 'a change of who the house holds from'}. `
                + 'That was said out loud and cannot be unsaid.'
            );
        }

        if (entry) {
            if (entry.rivals.includes(named.id)) {
                lines.push(
                    'There is a feud, and it is old enough that nobody argues about who started it.'
                );
            }
            if (entry.ambition?.contestedWith.includes(named.id)) {
                lines.push(
                    `Both houses have a hand on the same thing: ${entry.ambition.wants} `
                    + `${entry.ambition.wouldCost}`
                );
            }
            if (entry.ambition?.blockedBy.includes(named.id)) {
                lines.push(`They are what stands between ${entry.name} and what it is after.`);
            }
        }

        // Whether anybody stands above both of them, which is what decides
        // whether a quarrel is allowed to become anything.
        if (position) {
            const mine = chainToApex(position.sectId);
            const theirs = chainToApex(named.id);
            const shared = mine.find(id => theirs.includes(id) && id !== position.sectId);
            if (shared && this.knowledge.isAwareOf(cultivator.id, 'sect', shared)) {
                const name = this.repos.sects.getById(shared)?.name
                    ?? getCourt(shared)?.name
                    ?? getApexInstitution(shared)?.name
                    ?? shared;
                lines.push(
                    `Both of you hold from ${name} somewhere above, which means whatever happens `
                    + 'between you is something they will have an opinion about.'
                );
            }
        }

        if (lines.length === 0) {
            lines.push(
                `Nothing stands between ${position?.sectName ?? cultivator.name} and ${named.name} `
                + 'that anybody has written down, and nothing has been said either way.'
            );
        }

        const facts = factsForToolResult(`${named.name}: where you stand.`, lines);
        facts.structure.push(
            position
                ? `${standingStructure(position, opensAtRung(position))} A declaration opens at `
                  + `${position.ranks[opensAtRung(position)] ?? 'the seat'}.`
                : 'No membership row. Nothing to declare with; see the refusal on the acting intents.'
        );
        return this.freeAction(run, 'posture', facts);
    }

    /**
     * The thing under the mountain.
     *
     * WHOSE mountain it is decides which act this is, and it is read off the
     * membership row rather than off the sentence - so no phrasing can choose
     * between a legal decision and a crime. Waking your own house's is a
     * decision with a stated cost. Breaking somebody else's is not a decision at
     * all: it is theft of the most dangerous object in the region, and it is
     * gated on GETTING TO IT rather than on standing, which is exactly what
     * `handleWake`'s capability assessment against the seal already answers.
     *
     * The read is the default and the read is `handleWake` unchanged, which has
     * been in `sect-politics.ts` the whole time: it discloses nothing about a
     * house whose seal is not public unless the caller is senior in that house,
     * and it says "nothing this cultivator knows of" for a house with nothing
     * under it in exactly the same words - so the shape of the answer is not the
     * answer. None of that is weakened here.
     */
    private async seal(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string | undefined
    ): Promise<Execution> {
        const which: SealIntent = SEAL_INTENTS.includes(intent as SealIntent)
            ? intent as SealIntent
            : DEFAULT_SEAL_INTENT;

        const position = positionIn(this.repos, cultivator.id);
        const named = this.factionMeant(target, cultivator);

        // A mountain was named and it is not one this cultivator can find.
        // Falling back to their own house here would answer a question about
        // somebody else's seal with an answer about theirs, which is the
        // elder-dismissal rule applied to mountains.
        if (this.namedButUnresolved(target, named)) {
            return this.noPartyNamed(
                'seal', target, cultivator,
                'No mountain you know of.',
                'You have named a house, and it is not a name you hold.'
            );
        }

        const sectId = named?.id ?? position?.sectId ?? null;

        if (!sectId) {
            return refused('engine.wakeSeal', 'seal', factsForRefusal(
                'No mountain in particular.',
                servesNoHouse(
                    cultivator.name,
                    'there is no mountain that is yours to have anything under. Whatever is asleep '
                    + 'anywhere else is asleep under somebody, and getting to it is a matter of '
                    + 'walking past them first.'
                ),
                standingStructure(null, null)
            ));
        }

        const isOwn = position !== null && position.sectId === sectId;

        // Somebody else's. Not a decision, and no rank anywhere makes it one -
        // so the gate is the seal itself, priced by the engine's own capability
        // predicates rather than by anything this layer decides.
        if (which === 'wake' && !isOwn) {
            const assessment = await handleWake({
                action: 'wake', sectId, cultivatorId: cultivator.id
            });
            const execution = this.fromToolResult(
                'sect_politics.wake', 'seal', assessment, 'The seal'
            );
            execution.outcome = 'refused';
            // Pushed onto BOTH channels. `lines` is what a provider narrator is
            // handed and `prose` is what the deterministic one ships, and the
            // two are separate fields on `EngineFacts` - appending to one and
            // not the other means the sentence exists for a player with a model
            // configured and not for a player without one, which is the exact
            // asymmetry `facts.ts` says must never appear.
            const notYours =
                'Whatever is down there is not yours to wake. There is no rank in any house that '
                + 'entitles somebody to break somebody else\'s seal, because it is not a decision '
                + 'anybody is entitled to make - it is a theft, and the only question it turns on '
                + 'is whether you could get to it.';
            execution.facts.lines.push(notYours);
            execution.facts.prose = `${execution.facts.prose}\n\n${notYours}`;
            execution.facts.structure.push(
                `The seal belongs to ${sectId}, and this cultivator `
                + (position
                    ? `serves ${position.sectId}, which is a different house.`
                    : 'serves no house at all.')
                + ' Nothing here is gated on rank; it is gated on reaching the seal.'
            );
            execution.calls.push({
                name: 'engine.wakeSeal',
                action: 'seal',
                summary:
                    `${sectId} is not this cultivator's house. Routed to the capability assessment `
                    + 'against the seal; no authority path exists and none should.',
                ok: false
            });
            return execution;
        }

        // The read, which is where a player finds out what the condition and the
        // cost are before spending either.
        if (which === 'read') {
            return this.fromToolResult(
                'sect_politics.wake', 'seal',
                await handleWake({ action: 'wake', sectId, cultivatorId: cultivator.id }),
                'The seal'
            );
        }

        // Your own house's. The rank gate, in the house's own titles.
        if (position && !mayCommitTheHouse(position)) {
            const opens = opensAtRung(position);
            return refused('engine.wakeSeal', 'seal', factsForRefusal(
                'Not your decision.',
                `${rankDoesNotReach(position, opens)} It is not a thing the house votes on and not `
                + 'a thing an elder does quietly. One person decides, and if you were that person '
                + 'you would already have been shown where it is.',
                standingStructure(position, opens)
            ));
        }

        return this.breakTheGlass(run, cultivator, position as HousePosition);
    }

    /**
     * The seat spends the house's last card.
     *
     * The one method in this package that changes a `powerOrdinal`, and the
     * sharpest expression of what `sectThreat` has always modelled: `acting` is
     * the strongest member who will answer, `ceiling` is the strongest thing the
     * house can put in the world at all including one it can spend once, and
     * waking is the event that turns the second into the first. Permanently,
     * and once.
     *
     * The cost is the catalog's, verbatim, because the catalog wrote it as a
     * cost rather than as colour: nearly every `wakeCost` in the file says the
     * ancestor is spent, and several say the arrangement that made the house
     * survivable ends with them.
     */
    private breakTheGlass(
        run: Run,
        cultivator: Cultivator,
        position: HousePosition
    ): Execution {
        const dormant = getSectAncestry(position.sectId)?.dormant ?? null;
        const already = readSpentSeal(this.repos.db, cultivator.id, position.sectId);

        if (!dormant) {
            // Phrased the way `handleWake` phrases a house with nothing under
            // it, because a seat being told "there is nothing" and a seat being
            // told "there is nothing you have been shown" must not be
            // distinguishable from outside this method.
            return refused('engine.wakeSeal', 'seal', factsForRefusal(
                'Nothing to wake.',
                `There is nothing under ${position.sectName} that you have ever been shown, and `
                + 'you would have been shown it. That is not the same as nothing being there, and '
                + 'nobody alive can tell you which.',
                `The ancestry the catalog holds for ${position.sectId} records nobody dormant. `
                + 'The negative is phrased identically to a withheld positive by construction, so '
                + 'this answer does not distinguish the two.'
            ));
        }

        if (already) {
            return refused('engine.wakeSeal', 'seal', factsForRefusal(
                'Spent.',
                `${dormant.name} came up once, on the day you sent for them, and there is no `
                + 'second time. A seal is a thing you have until you use it.',
                `seal_spent:${position.sectId} recorded on day ${already.onDay}. Single use, by `
                + 'construction.'
            ));
        }

        const sect = this.repos.sects.getById(position.sectId);
        const before = sect?.powerOrdinal ?? 0;
        const onDay = Math.floor(run.elapsedDays);

        // The state change. `powerOrdinal` is what every other surface in the
        // engine reads to decide whether this house can be fought, refused or
        // leaned on, so raising it to the woken ancestor's ordinal is all that
        // waking means - and recording the spend is what stops a card from
        // quietly becoming a resource.
        if (sect) {
            this.repos.sects.upsert({ ...sect, powerOrdinal: dormant.realmOrdinal });
        }
        writeFlag(
            this.repos.db,
            cultivator.id,
            sealKey(position.sectId),
            JSON.stringify({
                onDay,
                ancestorName: dormant.name,
                ordinal: dormant.realmOrdinal
            })
        );

        const lines = [
            `${dormant.name} is awake, at ${dormant.restingPlace.replace(/\.$/, '')}.`,
            `${dormant.dormantYears} years asleep, and everybody who arranged it is dead.`,
            // The cost, in the catalog's own words. It is not a warning about
            // what might happen; it is the account of what this has done.
            dormant.wakeCost,
            dormant.sealReason === 'final_breath'
                ? 'What came up is shaped around one act and cannot be pointed at a second one. '
                  + 'Whatever they were kept for is what you have, whether or not it is what you '
                  + 'wanted.'
                : 'They were banked whole and can be spent on anything worth a weapon, which is '
                  + 'the reading a house does not say out loud about its own last card.',
            'The circumstance the house told itself this was for was not met. It was not '
            + 'consulted. You decided, and the record will say so for as long as there is a record.'
        ];

        const facts = factsForToolResult(`${dormant.name} is awake.`, lines);
        facts.structure.push(
            `What ${position.sectId} can put in a room has gone from `
            + `${rungAndOrdinal(before)} to ${rungAndOrdinal(dormant.realmOrdinal)}. The ceiling `
            + 'has become the acting figure and cannot be spent a second time.'
        );
        facts.structure.push(
            `The seal is recorded as spent at ${position.sectId} on day ${onDay}. It was a `
            + `${dormant.sealGrade} seal holding somebody `
            + (dormant.sealReason === 'protector'
                ? 'banked whole and deliberately, as a reserve'
                : 'kept at the end, because they were ending anyway')
            + ', and outsiders '
            + (dormant.publiclyKnown ? 'already knew there was something under the mountain.' : 'did not know there was anything under the mountain.')
            + ` Decided by ${rankAndIndex(position)}, which is the seat.`
        );
        facts.structure.push(
            'The condition the house wrote down for waking this one was not met and was not '
            + `consulted. It reads: ${dormant.wakeCondition}`
        );

        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'engine.wakeSeal',
                action: 'seal',
                summary:
                    `${position.sectId}: seal spent by the seat on day ${onDay}. power_ordinal `
                    + `${before} -> ${dormant.realmOrdinal}, permanently, once.`,
                ok: true
            }]
        };
    }

    /**
     * The offering upward, and the reading of a silence.
     *
     * `IMMORTAL_MOTIVE` is unusually blunt about what this is: not a great
     * honour a sect has earned, but the cheapest possible acknowledgement,
     * costing the giver nothing whatsoever, which the sects have built entire
     * ceremonies around because it is all they were ever going to get. A body
     * that spends its principal for a decade to receive two words is being
     * answered at the minimum rate.
     *
     * So this method charges the decade and produces the silence, and says
     * plainly that the silence is consistent with several things without saying
     * which. `afterCrossing` and `claimIsTrue` are ground truth the catalog
     * holds precisely so that nobody in the world can read them, and nothing
     * here looks at either. There is no roll, because there is nothing to roll:
     * whether an ancestor answers is not a thing this engine decides.
     */
    private offer(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        intent: string | undefined,
        /** What goes with it, where the sender said. Carried, never branched on. */
        message?: string
    ): Execution {
        const which: OfferIntent = OFFER_INTENTS.includes(intent as OfferIntent)
            ? intent as OfferIntent
            : DEFAULT_OFFER_INTENT;

        // The other end of the same pipe. Which end the speaker is standing at
        // is STATE rather than the word they used, so a player below who types
        // "send" gets the offering and a player above who types "offering" gets
        // the sending - both of them reach the thing they can actually do.
        if (canExistBeyondTheLid(cultivator)) {
            return this.sendDown(run, cultivator, target, message);
        }

        const position = positionIn(this.repos, cultivator.id);
        const named = this.factionMeant(target, cultivator);

        // A line was named and it is not one this cultivator can find. An
        // offering sent up the wrong wall is not a smaller version of the right
        // one; it is a different act.
        if (this.namedButUnresolved(target, named)) {
            return this.noPartyNamed(
                'offer', target, cultivator,
                'No line you know of.',
                'You have named a house whose ancestors you would be addressing, and it is not a '
                + 'name you hold.'
            );
        }

        const sectId = named?.id ?? position?.sectId ?? null;

        if (!sectId) {
            return refused('engine.offering', 'offer', factsForRefusal(
                'To whom?',
                servesNoHouse(
                    cultivator.name,
                    'an offering goes up a line, and a line is a thing a house keeps. There is no '
                    + 'wall with your name at the bottom of it, no rite anybody would recognise '
                    + 'you performing, and nothing to pay for one with - what an offering costs is '
                    + 'a decade of a house\'s principal, and it is spent whether or not anything '
                    + 'answers.'
                ),
                standingStructure(null, null)
            ));
        }

        const records = getSectAncestry(sectId);
        const ascended = (records?.ancestors ?? []).filter(a => a.fate === 'ascended');
        const sect = this.repos.sects.getById(sectId) ?? getSect(sectId) ?? null;
        const isOwn = position !== null && position.sectId === sectId;

        if (which === 'channel' || !isOwn) {
            return this.readTheChannel(run, sectId, sect, records, ascended, isOwn);
        }

        // Your own house's line, and the seat's decision, for the reason every
        // other commitment here is: it comes out of the principal, and one
        // person in a house signs for the principal.
        if (position && !mayCommitTheHouse(position)) {
            const opens = opensAtRung(position);
            return refused('engine.offering', 'offer', factsForRefusal(
                'Not yours to spend.',
                `${rankDoesNotReach(position, opens)} You can stand at the back of the hall while `
                + 'it is done. Everybody does.',
                standingStructure(position, opens)
            ));
        }

        const seat = position as HousePosition;
        const stipend = sect?.stipend ?? [];
        const reserves = baseReservesFor(stipend);
        // The house's monthly payroll, defined EXACTLY as `baseReservesFor`
        // defines it - the sum of the ladder, not the ladder weighted by how
        // many people stand on each rung.
        //
        // The first version here weighted it by `rosterByRung`, which is the
        // more realistic figure and was wrong for the only reason that matters:
        // the reserve it is compared against is not weighted, so the comparison
        // was between two different quantities and the rite priced out as
        // unaffordable for every house in the world. A verb that can never fire
        // is a verb that is not there. Two definitions of one number is the
        // defect, not the choice of definition.
        const monthly = stipend.reduce((sum, s) => sum + Math.max(0, s), 0);
        // A decade of it, which is the figure IMMORTAL_MOTIVE states in years
        // and the stipend ladder states in stones. Against a reserve of twelve
        // years, an offering is five sixths of everything the house is holding.
        const cost = monthly * OFFERING_MONTHS;

        const alreadySent = readOffering(this.repos.db, cultivator.id, sectId);
        if (alreadySent) {
            return refused('engine.offering', 'offer', factsForRefusal(
                'Once.',
                'It was done, and it was answered the way it was answered. A house that goes back '
                + 'up the line inside one lifetime is a house that has misunderstood what the '
                + 'first one was, and everybody senior would say so.',
                `offering:${sectId} recorded on day ${alreadySent.onDay}, ${alreadySent.stones} `
                + 'stones out of the principal.'
            ));
        }

        if (ascended.length === 0) {
            return refused('engine.offering', 'offer', factsForRefusal(
                'Nobody up there to address it to.',
                `${sect?.name ?? 'The house'} has a wall of names and not one of them went `
                + 'through. A rite performed to a name that is only a dead person is a rite; it is '
                + 'just not an offering, and the elders who would have to conduct it would want to '
                + 'know who you thought it was for.',
                `The ancestry the catalog holds for ${sectId} lists nobody who crossed. An `
                + 'offering has to be addressed to somebody on the far side, and there is nobody '
                + 'there to address.'
            ));
        }

        if (cost > reserves) {
            return refused('engine.offering', 'offer', factsForRefusal(
                'It cannot be paid for.',
                `What the rite costs is a decade of everything ${sect?.name ?? 'the house'} pays `
                + 'out, and the house does not hold a decade of everything it pays out. Making it '
                + 'anyway would not be an offering; it would be the end of the house with an '
                + 'offering in the middle of it.',
                `The rite costs ${cost} stones against reserves of ${reserves} at ${sectId}, `
                + `which is ${cost - reserves} more than the house holds. The reserves figure is `
                + 'the same one the stipend is paid out of; there is not a second purse.'
            ));
        }

        const onDay = Math.floor(run.elapsedDays);
        writeFlag(
            this.repos.db, cultivator.id, offeringKey(sectId),
            JSON.stringify({ onDay, stones: cost, response: null })
        );

        const lines = [
            `It is made, in the name of ${sect?.name ?? 'the house'}, to ${ascended[0].name}, who `
            + `went through ${ascended[0].yearsAgo} years ago.`,
            `It costs ${cost} spirit stones out of the principal, which is about a decade of `
            + 'everything the house pays out, and it is spent before anybody knows whether it '
            + 'bought anything.',
            IMMORTAL_MOTIVE.whatTheOfferingActuallyIs,
            'Nothing answers. Not that day, not that season, not that year.',
            // The four readings, none of them ranked and none of them resolved.
            // The engine holds which is true and this method does not read it,
            // which is the whole reason working it out is a prize.
            'And nothing about the silence tells the possibilities apart, which is what everybody '
            + 'who has ever done this has had to live with: that they died up there long ago; '
            + 'that they are alive and have no reason at all to answer a house full of strangers '
            + 'born two thousand years after they left; that the name at the top of the page has '
            + 'been wrong for so long that an answer would arrive addressed to somebody nobody '
            + 'here would recognise; or that it was heard, weighed, and found not worth the ten '
            + 'breaths a reply would cost.'
        ];
        const previous = records?.lastOffering ?? null;
        if (previous) {
            lines.push(
                `The house has done this before, ${previous.yearsAgo} years ago. ${previous.cost} `
                + (previous.response === null
                    ? 'Nothing came back that time either, and what the house did about it is on '
                      + `the record: ${previous.consequence}`
                    : `What came back was: ${previous.response} ${previous.consequence}`)
            );
        }

        const facts = factsForToolResult('The offering is made.', lines);
        facts.structure.push(
            `The offering is recorded at ${sectId} on day ${onDay}. It cost ${cost} stones, which `
            + `is ${OFFERING_MONTHS} months of payroll at ${monthly} a month, taken against `
            + `reserves of ${reserves} and leaving ${reserves - cost}. Decided by `
            + `${rankAndIndex(seat)}, which is the seat.`
        );
        facts.structure.push(
            'Response is null and is not rolled. Nothing in this engine decides whether an '
            + 'ancestor answers; SectAncestor.afterCrossing is ground truth the world cannot read, '
            + 'and this method does not read it either.'
        );
        facts.structure.push(
            'The reserve is NOT decremented. `siphon_taken:<sectId>` owns that figure inside '
            + 'sect-manage.ts behind a key this module does not reach into, and a second ledger '
            + 'only one side reads is worse than no ledger. Unifying them is outstanding.'
        );

        this.repos.runs.incrementTurn(run.id, 1);
        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: null,
            outcome: 'executed',
            calls: [{
                name: 'engine.offering',
                action: 'offer',
                summary:
                    `${sectId}: offering made by the seat on day ${onDay} at ${cost} stones. No `
                    + 'response, and no response was rolled for.',
                ok: true
            }]
        };
    }

    /** What the line is, before anybody spends a decade on it. Free. */
    private readTheChannel(
        run: Run,
        sectId: string,
        sect: { name: string } | null,
        records: ReturnType<typeof getSectAncestry>,
        ascended: ReadonlyArray<{ name: string; yearsAgo: number; rememberedFor: string }>,
        isOwn: boolean
    ): Execution {
        const lines: string[] = [];
        const name = sect?.name ?? 'the house';

        if (ascended.length === 0) {
            lines.push(
                `${name} has a wall of names, and as far as anybody will say out loud, that is all `
                + 'it is. Genealogy does not keep realms.'
            );
        } else {
            for (const one of ascended.slice(0, 2)) {
                lines.push(`${one.name}, ${one.yearsAgo} years ago. ${one.rememberedFor}`);
            }
        }

        // A public claim is public. Whether it is TRUE is `claimIsTrue`, which
        // is ground truth and is read nowhere in this package.
        if (records?.claimsLivingAncestor) {
            lines.push(
                `${name} says the line still answers. Every house that says this says it the same `
                + 'way, and no house that says it can show you.'
            );
        }

        // What the house has actually received is house business. An outsider
        // gets the claim and the ceremony; a member gets the ledger.
        if (isOwn) {
            const channel = getChannel(sectId);
            if (channel) {
                lines.push(channel.cadence);
                lines.push(channel.usability);
            }
            const previous = records?.lastOffering ?? null;
            if (previous) {
                lines.push(
                    `The last offering was ${previous.yearsAgo} years ago. ${previous.cost} `
                    + (previous.response === null
                        ? `Nothing came back. ${previous.consequence}`
                        : `What came back was: ${previous.response} ${previous.consequence}`)
                );
            }
        }

        lines.push(
            'What an offering costs is a decade of a house\'s principal, and it is paid before '
            + 'anybody knows whether it bought anything.'
        );

        const facts = factsForToolResult(`${name}: the line upward.`, lines);
        facts.structure.push(
            `The ancestry the catalog holds for ${sectId} lists ${ascended.length} who crossed, `
            + `and the house ${records?.claimsLivingAncestor ? 'claims one of them is still alive up there' : 'makes no claim that any of them is still alive up there'}. `
            + `The detail of how a house reaches them is ${isOwn ? 'disclosed here, because the caller is of this house' : 'withheld here, because the caller is not of this house'}. `
            + 'Whether the claim is true, and what became of any of them after crossing, are held '
            + 'by the engine and are not read on this path.'
        );
        return this.freeAction(run, 'offer', facts);
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
    private residentNow(cultivator: Cultivator, run: Run): Resident | null {
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
    private sendDown(
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

    /** Sites this cultivator could put a name to. The gate under everything. */
    private nameableFor(cultivator: Cultivator): Site[] {
        return nameableSites(siteId => this.knowledge.isAwareOf(cultivator.id, 'place', siteId));
    }

    /**
     * The world state a fate gate is allowed to turn on.
     *
     * Counted off the obligations ledger, which is real rows written by things
     * that happened. `generation > 0` is business inherited rather than
     * incurred, which is exactly what "carrying an obligation you did not take
     * on" means, and it is not a number that rises because somebody repeated an
     * activity - which is the test `FATE_IS_NOT_A_STAT` sets.
     */
    private fateEvidence(cultivator: Cultivator): FateEvidence {
        const row = this.db
            .prepare(
                "SELECT COUNT(*) AS n FROM obligations WHERE holder_id = ? AND status = 'open' AND generation > 0"
            )
            .get(cultivator.id) as { n: number } | undefined;
        return { obligationsNotTakenOn: row?.n ?? 0 };
    }

    /**
     * Which site a sentence meant.
     *
     * A name resolves against the ones this cultivator may name and nothing
     * else, so a player cannot type their way into a grave they have never
     * heard of. A generic phrase - "the door", "the grave", "what is behind the
     * plate" - names nothing and falls through to the site they went to most
     * recently, which is a row rather than a guess, exactly the way "what
     * happened here" falls through to the ground underfoot.
     */
    private siteMeant(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): { site: Site | null; namedSomethingUnknown: boolean } {
        const permitted = this.nameableFor(cultivator);
        const query = (target ?? '').trim();

        if (query.length >= 3 && !GENERIC_SITE_PHRASE.test(query)) {
            const named = resolveSite(query, permitted);
            // A specific name that resolved to nothing does NOT fall through to
            // the site at hand. Naming a grave the player has only heard
            // rumoured must not quietly open the one they were standing at an
            // hour ago - that is the same class of mistake as fuzzy-matching an
            // elder and dismissing the wrong person.
            return { site: named, namedSomethingUnknown: named === null };
        }

        const record = this.sites.atHand(run.id);
        const site = record ? permitted.find(entry => entry.id === record.catalogId) ?? null : null;
        return { site, namedSomethingUnknown: false };
    }

    /**
     * Ground the world found, in this province, that this cultivator may name.
     *
     * Gated on `isAwareOf` exactly as the authored sites are: the world knowing
     * about a ruin is not the player knowing about it, and listing every find
     * the moment it is uncovered would spend somebody else's discovery.
     */
    private foundGroundFor(cultivator: Cultivator): FoundGround[] {
        if (!this.atHand) return [];
        const region = this.atHand.locations.find(
            row => row.kind === 'region'
                && loosePlaceKey(row.name) === loosePlaceKey(standingOf(cultivator).regionName)
        );
        return foundGroundIn(
            this.atHand,
            region?.id ?? null,
            id => this.knowledge.isAwareOf(cultivator.id, 'place', id)
        );
    }

    /**
     * Standing outside something the world uncovered.
     *
     * Free, like the authored approach: looking at a door costs nothing. What
     * it reports is STRUCTURE - character, scale, whose it was, what the ground
     * does - because that is what a find carries. There is no authored interior
     * to quote and none is invented; see `ground-the-world-found.ts`.
     *
     * The access read is the same `readAdmission` the authored sites use, so a
     * cap here refuses for the same reason a cap there does and the player
     * learns one rule rather than two.
     */
    private approachFoundGround(
        run: Run,
        cultivator: Cultivator,
        ground: FoundGround
    ): Execution {
        const lines = describeFoundGround(ground);
        const reading = readFoundGroundAccess(ground, cultivator.realmOrdinal);
        if (reading) {
            lines.push(
                reading.admitted && reading.survives
                    ? 'At your rung it would let you in, and let you out again.'
                    : reading.admitted
                        ? 'At your rung it would let you in. It would not let you out.'
                        : 'At your rung it would not have you at all.'
            );
        }

        const facts = factsForToolResult(`${ground.name}, from outside.`, lines);
        const floor = ground.access?.floorOrdinal;
        facts.structure.push(
            `Ground of ${ground.character} character`
            + `${ground.origin ? `, ${ground.origin} in origin` : ', of no origin the record states'}`
            + `${ground.scale ? `, at ${ground.scale} scale` : ', at no scale the record states'}. `
            + (ground.access
                ? `It admits ${ground.access.admits}`
                  + `${floor === undefined || floor === null
                      ? ' and states no floor'
                      : ` from no lower than ${rungAndOrdinal(floor)}`}. `
                : 'Nothing about who it admits is recorded on the find. ')
            + (ground.discoveredOnDay === undefined || ground.discoveredOnDay === null
                ? 'The day the world found it is unrecorded.'
                : `The world found it on day ${ground.discoveredOnDay}.`)
        );

        const execution = this.freeAction(run, 'site', facts);
        execution.calls = [{
            name: 'engine.foundGroundIn',
            action: 'site',
            summary:
                `${ground.id} was found by the world's own prospecting and is nameable by this `
                + `cultivator. ${reading
                    ? `readAdmission at ordinal ${cultivator.realmOrdinal}: `
                      + `admitted=${reading.admitted}, survives=${reading.survives}.`
                    : 'No access recorded on the find; nothing read.'}`,
            ok: true
        }];
        return execution;
    }

    /** The pre-entry face, at whatever awareness this cultivator holds. */
    private faceFor(site: Site, cultivator: Cultivator): SiteFace | null {
        const awareness = awarenessOfSite(site, this.knowledge.isAwareOf(cultivator.id, 'place', site.id));
        const view = faceOf(site, awareness);
        if (!view) return null;
        return {
            name: view.name,
            kind: view.kind,
            marker: view.outside.marker,
            rumour: view.outside.rumour,
            attributedTo: view.outside.attributedTo,
            lastPartySaid: view.outside.lastPartySaid,
            whatAKnowledgeablePartyReads: view.outside.whatAKnowledgeablePartyReads,
            whatAnIgnorantPartyConcludes: view.outside.whatAnIgnorantPartyConcludes,
            advertisedOrdinal: view.outside.advertisedOrdinal,
            grave: view.kind === 'grave'
                ? {
                    mannerOfDeath: view.mannerOfDeath,
                    burial: view.burial,
                    occupantOrdinal: view.occupantOrdinal,
                    yearsDead: view.yearsDead
                }
                : null
        };
    }

    /** The refusal every step gives when no site resolved. Costs nothing. */
    private noSiteAtHand(action: ActionName, query: string | undefined): Execution {
        return refused('engine.resolveSite', action, factsForRefusal(
            'Nothing here to go into.',
            'You turn to the thing you meant and there is no thing you meant. Ground worth opening '
            + 'is ground somebody told you about, and you are not standing at any of it.',
            `Unresolved site "${(query ?? '').trim() || '(none named)'}": no nameable site matched and `
            + 'no site has been approached in this run.'
        ));
    }

    /**
     * Putting things beyond your own death, and collecting what somebody else
     * put beyond theirs.
     *
     * The whole surface lives in `leaving-things-for-the-next-life.ts`, on the
     * `trials.ts` precedent: this method supplies the clock, the mover and the
     * company, and decides nothing about how a cache or a deposit turns out.
     *
     * The phrase comes off the RAW INPUT and never off a planned action's
     * `topic`. A model asked to fill a field paraphrases, and a paraphrased
     * phrase does not open the entry - so the one thing a player has to carry
     * across a death is the one thing no model touches.
     */
    private async legacyAct(
        run: Run,
        cultivator: Cultivator,
        intent: string | undefined,
        target: string | undefined,
        rawInput: string,
        days: number | undefined
    ): Promise<Execution> {
        const label = (intent ?? '').trim().toLowerCase() as LegacyIntent;
        const chosen: LegacyIntent =
            LEGACY_INTENTS.includes(label) ? label : DEFAULT_LEGACY_INTENT;

        const outcome = handleLegacy(
            {
                ledger: this.legacy,
                mover: {
                    stones: (id, delta) => {
                        this.repos.cultivators.applyDeltas(id, { spiritStones: delta });
                    },
                    add: (id, stack) => addToPouch(this.db, id, stack.itemId, stack.kind, stack.quantity),
                    take: (id, stack) => removeFromPouch(this.db, id, stack.itemId, stack.quantity)
                },
                cultivator,
                here: cultivator.location ?? '',
                // The world clock, because a run's clock restarts every life
                // and the gap between two of them is the whole subject.
                worldSeed: this.atHand?.seed ?? null,
                worldDay: this.atHand?.currentDay ?? null,
                runId: run.id,
                // Anybody standing close enough to watch, read off the same
                // roster `look` reads, and recorded once at the moment of
                // burial rather than re-decided whenever somebody asks.
                watchers: this.present(cultivator).length,
                pouch: pouchStacks(this.db, cultivator.id),
                // Why they are at the counter. Settling is not a mood - it is
                // the allowance running down at a rung they are not leaving.
                road: {
                    settlingYearsLeft: stagnationRemaining(cultivator),
                    lifespanYearsLeft: null
                }
            },
            chosen,
            target,
            phraseIn(rawInput),
            days ?? DEFAULT_BURIAL_DAYS
        );

        // A read costs nothing and returns here. Digging and burying spend
        // days, and days are spent the way `gather` spends them, so the food
        // clock and the toll run through them exactly as they do anywhere else.
        if (outcome.daysSpent === 0) {
            const free = this.freeAction(run, 'legacy', outcome.facts);
            free.calls = outcome.calls;
            free.outcome = outcome.refused ? 'refused' : 'executed';
            return free;
        }

        // RE-READ BEFORE THE SKIP, because the goods have already moved.
        //
        // `handleLegacy` empties the purse into the ground first, and
        // `applyTimeSkip` writes `end.spiritStones - mid.spiritStones` where
        // `end` is derived from whatever cultivator it was handed. Handed the
        // pre-burial row, it computes a delta that puts every buried stone
        // straight back. Found by playing this integration: buried 28 of 30
        // stones, came out of the week holding 30.
        const afterGoods = this.repos.cultivators.getById(cultivator.id) ?? cultivator;

        const skip = simulateTimeSkip(afterGoods, outcome.daysSpent, {
            seed: run.seed,
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(afterGoods),
            turn: run.turn,
            startDay: Math.floor(run.elapsedDays),
            options: { ...this.rateTermsFor(afterGoods), ground: this.groundFor(afterGoods) },
            understanding: this.understandingFor(run, afterGoods),
            rations: this.drawFromPack(afterGoods, outcome.daysSpent),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, afterGoods)
        });
        const applied = applyTimeSkip(this.repos, { before: afterGoods, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        return {
            facts: outcome.facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: outcome.refused ? 'refused' : 'executed',
            calls: [
                ...outcome.calls,
                ...skipCalls('legacy', skip, null),
                ...tollCalls(applied.tollLines),
                ...worldCalls(world)
            ]
        };
    }

    /**
     * The trials and the graves: reaching one, reading it, going in, taking it.
     *
     * `intent` selects WHICH of the four runs and nothing else, on the same
     * terms as `sect` and `look`: the label is matched against a closed set of
     * literals, an unrecognised one falls through to the default, and every
     * outcome on the far side is computed from the catalog and from this
     * cultivator's own rows. What is different here is that one of the four
     * spends days and can kill, so the default is deliberately the CHEAPEST of
     * them. A model that answers `{"action":"site","intent":"go in and get it"}`
     * gets the listing.
     */
    private async site(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string | undefined
    ): Promise<Execution> {
        const step: SiteIntent = SITE_INTENTS.includes(intent as SiteIntent)
            ? intent as SiteIntent
            : DEFAULT_SITE_INTENT;

        const meant = this.siteMeant(run, cultivator, target);
        const site = meant.site;

        // A named site that resolved to nothing is refused on every step that
        // does something, and answered with the listing on the step that is a
        // question. "I go to the eighth stone" from somebody who has only ever
        // heard it rumoured is a real sentence with an honest answer, and the
        // honest answer is what they DO have names for.
        if (!site && meant.namedSomethingUnknown && step !== 'approach') {
            return this.noSiteAtHand('site', target);
        }

        if (step === 'approach' && !site) {
            // Naming none is a question rather than a failure: it asks what
            // there is, and the honest answer is what has reached this person.
            const known = this.nameableFor(cultivator);

            // ── AND WHAT THE WORLD HAS FOUND SINCE ───────────────────────
            //
            // This read used to be the catalog and nothing else, so the
            // thirty authored sites were the only places that could ever be
            // named - while the discovery engine steadily uncovered ground into
            // a table nothing player-facing read. See
            // `ground-the-world-found.ts` for the measurement.
            const found = this.foundGroundFor(cultivator);
            const facts = factsForSiteListing(
                cultivator,
                [
                    ...known.map(entry => ({ name: entry.name, kind: entry.kind })),
                    ...found.map(entry => ({ name: entry.name, kind: entry.character }))
                ]
            );
            for (const ground of found) facts.structure.push(...describeFoundGround(ground));

            const listing = this.freeAction(run, 'site', facts);
            const total = known.length + found.length;
            listing.outcome = total === 0 ? 'refused' : 'executed';
            listing.calls = [{
                name: 'engine.nameableSites',
                action: 'site',
                summary:
                    `${known.length} of ${SITES.length} catalogued site(s) are nameable by this `
                    + `cultivator, plus ${found.length} the world has found and this cultivator `
                    + 'has a record for. Filtered by awareness; the catalog holds no locations, so '
                    + 'nothing here was filtered by distance.',
                ok: total > 0
            }];
            return listing;
        }

        // A find, named. Answered before the catalog's own refusal, because a
        // place the world uncovered is a real place and "no site by that name"
        // would be false about it.
        if (!site) {
            const named = resolveFoundGround(
                (target ?? '').trim(), this.foundGroundFor(cultivator)
            );
            if (named) return this.approachFoundGround(run, cultivator, named);
        }

        if (!site) return this.noSiteAtHand('site', target);

        const face = this.faceFor(site, cultivator);
        if (!face) return this.noSiteAtHand('site', target);

        switch (step) {
            case 'approach':
            case 'outside':
                return this.readSiteFromOutside(run, cultivator, site, face, step === 'approach');
            case 'enter':
                return this.enterTheSite(run, cultivator, ambient, site);
            case 'take':
                return this.takeFromSite(run, cultivator, site);
        }
    }

    /**
     * Reaching one, and reading it without going in.
     *
     * Both steps return the same disclosure because the gate between outside
     * and inside is a door rather than a distance, and both are reads: no time
     * passes, nothing is spent, and being refused costs what being answered
     * costs. What the approach additionally does is write down that this
     * cultivator has been here, which is what makes "I go inside" a sentence
     * that resolves to something afterwards.
     */
    private readSiteFromOutside(
        run: Run,
        cultivator: Cultivator,
        site: Site,
        face: SiteFace,
        arriving: boolean
    ): Execution {
        this.sites.write(run.id, site, run.elapsedDays, { soughtOnDay: Math.floor(run.elapsedDays) });

        // Standing at a thing is knowing it is there. Written by the engine,
        // in phase 2, so the narrator is never the reason a name is available.
        const learned = face.name !== null && this.knowledge.learnIfNew({
            holderId: cultivator.id,
            kind: 'place',
            id: site.id,
            name: site.name,
            onDay: Math.floor(run.elapsedDays),
            sourceKind: 'witnessed',
            sourceNote: 'Stood at it.',
            stance: 'knows',
            confidence: 1
        });

        const facts = factsForSiteFace(cultivator, face, arriving);
        const execution = this.freeAction(run, 'site', facts);
        execution.calls = [
            {
                name: 'engine.outsideViewOf',
                action: arriving ? 'approach' : 'assess_from_outside',
                summary:
                    `${site.id}: pre-entry view returned at awareness `
                    + `${awarenessOfSite(site, true) === 'named' ? 'named' : site.outside.startingAwareness}. `
                    + 'The returned type has no interior key, so the inside could not have been read '
                    + 'here even by mistake. Read only: no time passed, nothing changed.',
                ok: true
            },
            ...(learned ? [{
                name: 'knowledge.learn',
                action: 'place_witnessed',
                summary: `"${site.name}" recorded as witnessed: this cultivator has now stood at it.`,
                ok: true
            }] : [])
        ];
        return execution;
    }

    /**
     * Going in.
     *
     * Three things happen, in this order, and the order is the design.
     *
     * FIRST the days are spent, through `simulateTimeSkip` and `applyTimeSkip`
     * like every other stretch of time in this package. That is what makes
     * entering cost something even at a site that turns out to be empty, and it
     * is why a cultivator on their last ration can die of the walk in - through
     * the survival layer, on the same code path as starving anywhere else.
     * Nothing about that death is asserted here.
     *
     * SECOND the gates are read, in the order the catalog puts them in, and the
     * first one that does not open stops it. Which kind refused decides what
     * the player is told, because the three are not three settings of one dial:
     * strength names a shortfall, talent names what was wanted and says power
     * does not substitute, and fate names nothing at all.
     *
     * THIRD, and only for a strength gate, the thing does what it was built to
     * do. A strength gate is the one kind that states an ordinal of force, so
     * it is the one kind that puts force into a body, and it is resolved by
     * `resolveExchange` - the engine's own combat model, priced at the gate's
     * ordinal - rather than by a damage formula invented in this layer. Death
     * from it goes through `evaluateDeathConditions` and `markDead`, which is
     * the same pair `technique_manage.learn` uses when a deviation kills
     * somebody. A talent gate is indifferent to how hard the claimant can be
     * hit and a fate gate is not about the claimant at all, so neither of them
     * is turned into damage: the bench's own `howItKills` opens "It does not,
     * and that is the trap", and the engine agrees with it.
     */
    private async enterTheSite(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        site: Site
    ): Promise<Execution> {
        const startDay = Math.floor(run.elapsedDays);
        const skip = simulateTimeSkip(cultivator, ENTERING_DAYS, {
            seed: run.seed,
            // The row id is a randomUUID; without this the run is not
            // reproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: ENTERING_FOCUS,
                ...this.rateTermsFor(cultivator),
                ground: this.groundFor(cultivator)
            },
            understanding: this.understandingFor(run, cultivator),
            rations: this.drawFromPack(cultivator, ENTERING_DAYS),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, { before: cultivator, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);
        const spentLine =
            `${humanDays(skip.simulatedDays)} went on getting in and being in there, and they came `
            + 'off the same clock everything else comes off.';

        const baseCalls: ToolCallRecord[] = [
            ...skipCalls('site', skip, null),
            ...tollCalls(applied.tollLines),
            ...worldCalls(world)
        ];

        // Killed by the trip rather than by the door. The survival layer has
        // already written it; this only reports what it found.
        if (!applied.cultivator.alive) {
            const facts = factsForTimeSkip(cultivator, applied.cultivator, skip, ambient, 'Going in');
            return {
                facts,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                outcome: 'executed',
                calls: baseCalls
            };
        }

        const claimant = claimantOf(applied.cultivator, {
            // Years actually spent at it. `STARTING_AGE` is the age this
            // deployment starts a cultivator at, so the difference is the time
            // the run has put in - which is the thing a talent gate asks about
            // and the thing that cannot be borrowed on the day.
            yearsCultivated: applied.cultivator.age - STARTING_AGE,
            fate: this.fateEvidence(applied.cultivator)
        });
        // ── WHAT THE GROUND DOES, BEFORE ANY GATE ────────────────────────
        //
        // `readGates` answers whether this claimant satisfies the locks
        // somebody built. This is the prior question - what the place does to a
        // body of this size - and nothing player-facing read it, so two of the
        // three ways the catalog closes ground had never once fired for a
        // player. The catalog holds 30 sites across 14 characters, 6 origins
        // and 4 scales, and all of the cap and elder-floor writing in it was
        // unreachable.
        //
        // Above the line first, because a cap turns somebody away at the
        // threshold and a gate inside is not consulted for somebody who never
        // got in. It costs the days and nothing else: being measured and found
        // too large is not an injury, which is why `groundForceOrdinalOf`
        // returns null for it.
        const access = readAccess(site, claimant);
        if (!access.admitted) {
            const facts = factsForGroundRefused(
                applied.cultivator, site.name, access, skip.simulatedDays
            );
            facts.lines.push(...world.lines);
            facts.structure.push(...world.structure);
            return {
                facts,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                outcome: 'executed',
                calls: [...baseCalls, {
                    name: 'engine.readAdmission',
                    action: 'ground_capped',
                    summary:
                        `${site.id} admits ${site.access.admits}; ordinal `
                        + `${applied.cultivator.realmOrdinal} is above the line. Turned away at `
                        + 'the threshold, no gate consulted, no force applied.',
                    ok: false
                }]
            };
        }


        const reading = readGates(site, claimant);
        const gateCalls: ToolCallRecord[] = reading.verdicts.map(verdict => ({
            name: 'engine.evaluateGate',
            action: `gate_${verdict.kind}`,
            summary: verdict.structure,
            ok: verdict.met
        }));

        if (reading.blockedBy) {
            const blocked = reading.blockedBy;
            const hurt = await this.gateForce(run, applied.cultivator, ambient, site, blocked);
            const facts = factsForGateRefused(
                applied.cultivator,
                site.name,
                { kind: blocked.kind, account: blocked.account, shortfall: blocked.shortfall },
                spentLine
            );
            facts.lines.push(...hurt.lines);
            facts.lines.push(...world.lines);
            facts.structure.push(...world.structure);
            if (hurt.lines.length > 0) facts.prose = `${facts.prose}\n\n${hurt.lines.join('\n\n')}`;

            return {
                facts,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                // The days were spent and, at a strength gate, a body was hurt.
                // Marking this refused would say nothing happened, and something
                // did. The gate's own call carries the ok: false.
                outcome: 'executed',
                calls: [...baseCalls, ...gateCalls, ...hurt.calls]
            };
        }

        // ── AND THEN THE DEPTH, WHICH IS AFTER THE DOOR AND NOT BEFORE IT ──
        //
        // Admitted and not surviving is the ORDINARY case for a minimum, and it
        // is not a locked door: `readAdmission` says so in as many words - "the
        // door is not what stops them". So it is read AFTER the gates rather
        // than before them, which is not where this was first written.
        //
        // The specification said to put the whole access check ahead of
        // `readGates`, and half of it belongs there: a CAP turns somebody away
        // at the threshold, so no lock inside is consulted for a body that
        // never got in. A FLOOR is the opposite - the door opened, they walked
        // through it, and the place is deeper than they are. Evaluating it
        // first made the gate unreachable for anybody under the floor, and
        // `misparse.test.ts` caught it immediately: a strength gate stopped
        // producing a reading at all.
        //
        // The two halves are ordered by what physically happens: refused at the
        // door, then the lock, then the depth beyond it.
        if (!access.survives) {
            const hurt = await this.groundForce(run, applied.cultivator, ambient, site, access);
            const facts = factsForGroundRefused(
                applied.cultivator, site.name, access, skip.simulatedDays
            );
            facts.lines.push(...hurt.lines);
            facts.lines.push(...world.lines);
            facts.structure.push(...world.structure);
            if (hurt.lines.length > 0) facts.prose = `${facts.prose}\n\n${hurt.lines.join('\n\n')}`;
            return {
                facts,
                events: skip.events,
                timeSkip: skip,
                breakthrough: null,
                outcome: 'executed',
                calls: [...baseCalls, {
                    name: 'engine.readAdmission',
                    action: 'ground_floor',
                    summary:
                        `${site.id} floor is ${site.access.floorOrdinal}; ordinal `
                        + `${applied.cultivator.realmOrdinal} is under it. Admitted and not `
                        + 'survived - the door is not what stops them.',
                    ok: false
                }, ...hurt.calls]
            };
        }
        // Every gate opened. This is the one place in the package that calls
        // `enterSite`, and it is below a recorded entry by construction.
        const record = this.sites.write(run.id, site, run.elapsedDays, {
            soughtOnDay: this.sites.get(run.id, site.id)?.soughtOnDay ?? startDay,
            enteredOnDay: startDay
        });
        // A trial and a grave hold different records on purpose - one was
        // calibrated for a claimant who was expected to arrive, the other was
        // arranged for nobody - so the three lines are taken from whichever
        // shape this entry actually has rather than flattened into one.
        const whole = enterSite(site.id)!;
        const interior = whole.kind === 'trial'
            ? {
                scene: whole.interior.chamber,
                arrangement: whole.interior.setBy,
                whatItDoesToPeople: whole.interior.howItKills
            }
            : {
                scene: whole.interior.scene,
                arrangement: whole.interior.arrangedForAFinder
                    ? 'Somebody arranged this for whoever found it. That is the exception rather than the rule.'
                    : 'Nobody arranged this for anybody. Nothing in it was the right size for whoever turned up.',
                whatItDoesToPeople: whole.interior.whatTheDeathDidToTheContents
            };
        const facts = factsForSiteInterior(applied.cultivator, site.name, {
            ...interior,
            onOffer: [...prizeOther(whole), ...this.prizeNames(whole)],
            afterwards: record.takenOnDay !== null ? whole.interior.afterwards : null
        });
        // WHAT STANDING AT ITS DEPTH IS LIKE, before the room is described.
        //
        // Clearing a floor is an event, not silence. An elder floor in
        // particular says who the errand is FOR - the sentence that makes a
        // senior's trip somebody else's inheritance - and it is written per
        // site, so it goes in ahead of the interior rather than being folded
        // into it.
        const held = factsForGroundSurvived(applied.cultivator, site.name, access);
        facts.lines.unshift(...held.lines);
        facts.structure.push(...held.structure);

        facts.lines.unshift(spentLine);
        facts.lines.push(...world.lines);
        facts.structure.push(...world.structure);

        return {
            facts,
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                ...baseCalls,
                ...gateCalls,
                {
                    name: 'engine.enterSite',
                    action: 'site',
                    summary:
                        `${site.id}: every gate opened, entry recorded on day ${startDay}. The interior `
                        + 'was read only after the row existed.',
                    ok: true
                }
            ]
        };
    }

    /**
     * What a strength gate does to somebody who is under it.
     *
     * Priced by `assessPower` and resolved by `resolveExchange`, which are the
     * engine's own, so a gate hits exactly as hard as a person at that ordinal
     * would and no harder. Nothing about the arithmetic lives here; what lives
     * here is the decision that a strength gate is the only kind that applies
     * force at all, which is the catalog's own distinction and not a new one.
     */
    private async gateForce(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        site: Site,
        blocked: GateVerdict
    ): Promise<{ lines: string[]; calls: ToolCallRecord[] }> {
        const ordinal = forceOrdinalOf(site, blocked);
        if (ordinal === null) return { lines: [], calls: [] };
        return this.forceAtOrdinal(run, cultivator, ambient, site, ordinal, 'site_gate');
    }

    /**
     * The depth of the ground itself, applied to somebody short of it.
     *
     * The sibling `gateForce` needed and did not have. A GATE is something a
     * person built and is priced off a gate ordinal; a FLOOR is geology, and is
     * priced off the floor. Same exchange, same resolver, same writes - what
     * differs is only where the number comes from, which is why this splits at
     * the ordinal rather than duplicating the body.
     *
     * A separate RNG stream from the gate's, so that a place which both has a
     * floor and has gates does not draw the same sample twice for two different
     * hazards.
     */
    private async groundForce(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        site: Site,
        access: AdmissionReading
    ): Promise<{ lines: string[]; calls: ToolCallRecord[] }> {
        const ordinal = groundForceOrdinalOf(site, access);
        if (ordinal === null) return { lines: [], calls: [] };
        return this.forceAtOrdinal(run, cultivator, ambient, site, ordinal, 'site_ground');
    }

    private async forceAtOrdinal(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        site: Site,
        ordinal: number,
        stream: string
    ): Promise<{ lines: string[]; calls: ToolCallRecord[] }> {

        const rng = forStream(run.seed, stream, Math.floor(run.elapsedDays), site.id);
        const context = { ambient };
        const gate = assessPower(forceAt(site, ordinal), context);
        const body = assessPower(
            {
                id: cultivator.id,
                name: cultivator.name,
                realmOrdinal: cultivator.realmOrdinal,
                immortalStatus: cultivator.immortalStatus,
                traditionId: cultivator.traditionId,
                spiritRoot: cultivator.spiritRoot,
                attributes: cultivator.attributes,
                injuries: cultivator.injuries,
                insights: cultivator.insights,
                foundationQuality: cultivator.foundationQuality,
                soulState: cultivator.soulState,
                hp: cultivator.hp,
                maxHp: cultivator.maxHp,
                qi: cultivator.qi,
                maxQi: cultivator.maxQi,
                battlesSurvived: cultivator.battlesSurvived
            },
            context
        );
        const exchange = resolveExchange(gate, body, cultivator.maxHp, {
            rng,
            ambient,
            turn: run.turn,
            vector: 'body'
        });

        let death: { cause: string; description: string } | null = null;
        const persist = this.db.transaction(() => {
            if (exchange.injury) {
                this.repos.cultivators.addInjury(cultivator.id, {
                    id: exchange.injury.id,
                    severity: exchange.injury.severity,
                    source: exchange.injury.source,
                    description: exchange.injury.description,
                    sustainedOnTurn: exchange.injury.sustainedOnTurn,
                    woundType: exchange.injury.woundType
                });
            }
            this.repos.cultivators.applyDeltas(cultivator.id, { hp: -exchange.damage });

            const after = this.repos.cultivators.getById(cultivator.id)!;
            const cause = evaluateDeathConditions(after);
            if (cause) {
                death = { cause, description: describeDeath(cause, after) };
                this.repos.cultivators.markDead(cultivator.id, cause, run.turn + 1, death.description);
            }
        });
        persist();

        const lines = [
            `It cost ${exchange.damage} of what ${cultivator.name} had to give.`
            + (exchange.injury
                ? ` It left a ${exchange.injury.severity} injury that will not close on its own.`
                : '')
        ];
        if (death) lines.push((death as { description: string }).description);

        return {
            lines,
            calls: [
                {
                    name: 'engine.resolveExchange',
                    action: 'gate_strength',
                    summary:
                        `The gate at ordinal ${ordinal} applied force to a body at `
                        + `${cultivator.realmOrdinal}. ${exchange.narrationHint} Roll `
                        + `${exchange.roll.toFixed(4)}, advantage ${exchange.advantage.toFixed(2)}.`,
                    ok: true
                },
                ...(death ? [{
                    name: 'engine.evaluateDeathConditions',
                    action: 'death',
                    summary:
                        `${(death as { cause: string }).cause}. Written by the survival layer after the `
                        + 'damage landed, on the same path every other death in this package takes.',
                    ok: true
                }] : [])
            ]
        };
    }

    /** Catalogued arts a site is holding, by name rather than by id. */
    private prizeNames(site: Site): string[] {
        const arts = prizeTechniqueIds(site)
            .map(id => getTechnique(id)?.name ?? id);
        const items = prizeImmortalItemIds(site);
        const lines: string[] = [];
        if (arts.length > 0) {
            lines.push(`Written down here, in full: ${arts.join(', ')}.`);
        }
        if (items.length > 0) {
            lines.push('There is also a thing here that did not come from any forge in this world.');
        }
        return lines;
    }

    /**
     * Taking it, which is the act that empties the place.
     *
     * Entry has to be on record first. That is not ceremony: the whole surface
     * is built so a player cannot learn what is inside without going in, and a
     * take that worked from the threshold would be a route around that.
     *
     * The grant itself goes through `technique_manage.learn` rather than
     * through anything reimplemented here, so a manual the claimant cannot read
     * comes back as the engine's own refusal - which is not a bug and is the
     * world's stated design: the top grades are written for somebody who has
     * walked a road, which is why they sit in ruins unread.
     */
    private async takeFromSite(run: Run, cultivator: Cultivator, site: Site): Promise<Execution> {
        const record = this.sites.get(run.id, site.id);

        if (!record || record.enteredOnDay === null) {
            return refused('engine.siteLedger', 'site', factsForRefusal(
                'You are not in there.',
                'You reach for it from where you are standing, which is outside, and the reaching '
                + 'stops at the door. Whatever is behind it is behind it.',
                `No entry on record for ${site.id} in this run. The interior was not read and the `
                + 'prize was not resolved.'
            ));
        }

        if (record.takenOnDay !== null) {
            const whole = enterSite(site.id)!;
            return refused('engine.siteLedger', 'site', factsForRefusal(
                `${site.name}: already emptied.`,
                whole.interior.afterwards,
                `${site.id} was taken on day ${record.takenOnDay}${record.takenBy ? ` by ${record.takenBy}` : ''}. `
                + `${record.granted.length} thing(s) left the site then and are not here now.`
            ));
        }

        const whole = enterSite(site.id)!;
        const granted: string[] = [];
        const withheld: string[] = [];
        const calls: ToolCallRecord[] = [];

        for (const techniqueId of prizeTechniqueIds(whole)) {
            const result = await handleLearn({
                action: 'learn',
                techniqueId,
                cultivatorId: cultivator.id,
                // A prize out of a sealed place. The book is IN THE ROOM,
                // which is the whole reason anybody goes into one - so this
                // path says where it came from and the ownership gate in
                // `handleLearn` stands aside for it.
                provenance: 'found_in_place'
            });
            const name = getTechnique(techniqueId)?.name ?? techniqueId;
            if (isGuidingErrorBody(result)) {
                withheld.push(result.message);
                calls.push({
                    name: 'technique_manage.learn',
                    action: 'site_prize',
                    summary: `${techniqueId}: ${result.error}. ${result.message}`,
                    ok: false
                });
                continue;
            }
            granted.push(name);
            calls.push({
                name: 'technique_manage.learn',
                action: 'site_prize',
                summary: `${techniqueId} learned off the site. Written by the same handler the tool surface uses.`,
                ok: true
            });
        }

        // The one immortal item in the whole catalog that is a grave good. It
        // leaves the site - the row below says so - and there is nowhere on a
        // cultivator to put it, because nothing in the storage layer models a
        // person holding one. Reported rather than faked: an item the player is
        // told they are carrying and that no query can find is worse than a
        // hole that says it is a hole.
        const items = prizeImmortalItemIds(whole);
        for (const itemId of items) {
            withheld.push(
                'There is a thing here that did not come from any forge in this world. It comes away '
                + 'with you, and there is nothing in your life that is the right shape to keep it in.'
            );
            calls.push({
                name: 'engine.possessions',
                action: 'site_prize',
                summary:
                    `${itemId} left ${site.id} and is recorded against the site. There is no `
                    + 'cultivator-side possession row for an immortal item in the storage layer, so '
                    + 'nothing was written on the cultivator. This is a gap, reported rather than faked.',
                ok: false
            });
        }

        const other = prizeOther(whole);
        this.sites.write(run.id, site, run.elapsedDays, {
            takenOnDay: Math.floor(run.elapsedDays),
            takenBy: cultivator.id,
            granted: [...prizeTechniqueIds(whole), ...items]
        });

        // ── AND TAKE THE ATTENTION ───────────────────────────────────────
        //
        // `tone.md` states the dilemma as two things the world will make you
        // regret: "rob the grave and TAKE THE ATTENTION, or stay poor and stay
        // slow." Only half of it existed. A site could be emptied and the
        // emptying was recorded against the site and against nobody else, so
        // there was no second half and therefore no decision - taking was
        // strictly better than not taking, every time.
        //
        // No new rule and no grave-specific branch. `factionIds` is an ordinary
        // column on every site, trial and grave alike; a house whose name is on
        // the ground notices what came off it, and the record is held BY that
        // house ABOUT this cultivator - the same direction `refuseDuty` and
        // `combat-manage` already write in.
        //
        // The reason an unclaimed grave is safe to rob is therefore structural
        // rather than merciful: there is nobody on the row to notice.
        const noticed = this.attentionFor(run, cultivator, site);
        for (const line of noticed.lines) withheld.push(line);
        calls.push(...noticed.calls);

        const facts = factsForSiteTaken(cultivator, site.name, {
            granted,
            withheld,
            other,
            afterwards: whole.interior.afterwards
        });

        const execution = this.freeAction(run, 'site', facts);
        execution.calls = [
            ...calls,
            {
                name: 'engine.siteLedger',
                action: 'site',
                summary:
                    `${site.id} marked taken on day ${Math.floor(run.elapsedDays)}. The next party to `
                    + 'reach it finds what `afterwards` says they find.',
                ok: true
            }
        ];
        return execution;
    }

    /**
     * The engine's own account of this turn, for the output-side check.
     *
     * Built from the `Execution` the caller already holds, so it cannot drift
     * from what was actually filed: a rank counted off the skip's own deltas, a
     * breakthrough attempt counted by whether one was RESOLVED at all, and a
     * death read off the row rather than off anybody's sentence.
     *
     * `breakthroughAttempted` is deliberately true for a FAILURE as well as a
     * success. Prose about a failed attempt legitimately contains the words a
     * successful one would, and refusing that would throw away good writing
     * about the most dramatic thing in the game.
     */
    private filedOutcome(execution: Execution): FiledOutcome {
        return {
            ranksGained: Math.max(0, execution.timeSkip?.deltas.realmOrdinal ?? 0)
                + (execution.breakthrough?.outcome === 'success' ? 1 : 0),
            breakthroughAttempted: execution.breakthrough !== null,
            // Read off the row rather than off anybody's sentence, which is the
            // whole point of this object.
            died: execution.timeSkip?.died === true
                || execution.breakthrough?.outcome === 'death'
                || !this.currentRun().cultivator.alive
        };
    }

    /**
     * Who notices that a piece of ground was emptied.
     *
     * Every house named on the site, and nobody else. The severity is read off
     * what the ground is pitched at rather than chosen: emptying a Qi
     * Condensation grave is a slight and emptying somebody at the top of the
     * ladder is not, and the same table prices both. Nothing here is written
     * about graves in particular.
     *
     * The record is an ordinary `grudge` row on the `obligations` tables, so
     * it is discoverable by every query that already reads them, it inherits
     * the ordinary inheritance rules, and a descendant three generations later
     * can still be carrying it.
     */
    private attentionFor(
        run: Run,
        cultivator: Cultivator,
        site: Site
    ): { lines: string[]; calls: ToolCallRecord[] } {
        const onDay = Math.floor(run.elapsedDays);
        // The rung the ground is pitched at. A grave states the occupant's; a
        // trial states what it advertises, and a trial that advertises nothing
        // is priced at the bottom, which is honest - nobody can be indignant
        // about a theft nobody can size.
        const pitch = site.kind === 'grave'
            ? site.occupantOrdinal
            : site.outside.advertisedOrdinal ?? 0;
        const severity: Severity =
            pitch >= GRAVE_UNFORGIVABLE_ORDINAL ? 'unforgivable'
                : pitch >= GRAVE_GRAVE_ORDINAL ? 'grave'
                    : pitch >= GRAVE_SERIOUS_ORDINAL ? 'serious'
                        : 'slight';

        const lines: string[] = [];
        const calls: ToolCallRecord[] = [];
        /** Claimants this cultivator has no name for. Counted, then said once. */
        let nameless = 0;

        for (const factionId of site.factionIds) {
            const house = this.repos.sects.getById(factionId);
            if (!house) continue;

            const record = createGrudge({
                holderId: factionId,
                subjectId: cultivator.id,
                cause: 'robbery',
                severity,
                onDay,
                description:
                    `${site.name} was emptied on day ${onDay}. The ground is ${house.name}'s and `
                    + 'what came off it did not.',
                terms: null,
                dueOnDay: null,
                tags: ['site', site.kind, site.id]
            });
            writeObligation(this.db as unknown as DatabaseHandle, record);

            // Said to the player as a fact about the world, not as a warning.
            // Whether they can name the house is the discovery layer's
            // question, and it is asked here rather than assumed.
            const known = this.knowledge.isAwareOf(cultivator.id, 'sect', factionId);
            if (known) {
                lines.push(
                    `${house.name} holds this ground, and what came off it did not come off it `
                    + 'quietly.'
                );
            } else {
                nameless++;
            }
            calls.push({
                name: 'social.createGrudge',
                action: 'site',
                summary:
                    `${factionId} now holds a ${severity} robbery grudge about ${cultivator.id}, `
                    + `off ${site.id} at pitch ${pitch}. Written to obligations; permanent until `
                    + 'settled, and inheritable.',
                ok: true
            });
        }

        // Said once, however many of them there are. Three separate sentences
        // reading "somebody will notice" is three copies of one fact, and the
        // discovery layer's rule is that not knowing who is ITSELF the fact.
        if (nameless > 0) {
            lines.push(
                lines.length === 0 && nameless === 1
                    ? 'This ground was somebody\'s. Whoever they are, they will find it emptied, '
                      + 'and they will not have to wonder whether somebody was here.'
                    : `${nameless} part${nameless === 1 ? 'y has' : 'ies have'} a claim on this `
                      + 'ground and you have no name for any of them. They will find it emptied '
                      + 'all the same.'
            );
        }

        return { lines, calls };
    }

    /**
     * What was done to this ground, and who says why.
     *
     * `engine/world/locations.ts` has carried the whole of this from the
     * start - origin, an append-only change log, and a current state that is
     * the two folded together, patched in place so the map scars rather than
     * growing - and nothing in this layer reached any of it. A player could
     * stand in a scar for a hundred turns and never be able to ask about it.
     *
     * Three things are read out and one is withheld:
     *
     *  - what the place IS, which anybody with eyes has;
     *  - that it CHANGED, and when, which is legible in the ground itself;
     *  - what the people here BELIEVE, which is `attributedCauses` and is
     *    stored as belief because that is what it is;
     *  - and the CAUSE, only when `causeKnown` says the world has surrendered
     *    it. `causeFactId` is deliberately not consulted when it has not: the
     *    seeded ruins all carry a cause fact that nobody has recovered, and an
     *    answer that read differently in that case would be an answer.
     *
     * A read. No time passes, nothing is spent, and being refused costs the
     * same as being answered.
     */
    private placeHistory(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Execution {
        const asked = (target ?? '').trim();
        // "what happened to this place" names nowhere. It means underfoot.
        const wanted = asked.length >= 2 && !HERE_ITSELF.test(asked)
            ? asked
            : (cultivator.location ?? '');
        const place = this.atHand ? worldLocationFor(this.atHand, wanted) : null;

        if (!place) {
            // Worded so that it does not confirm anything either way. A place
            // the world does not model and a place with nothing on record have
            // to look the same from inside, for the same reason the cause gate
            // does: the shape of the refusal must not be the answer.
            return refused('engine.locationHistory', 'look', factsForRefusal(
                'The ground keeps nothing.',
                `You look over ${placeName(cultivator)} for the mark of whatever made it this way, ` +
                'and there is no mark and nobody to ask. Ground that has had something done to it ' +
                'usually shows it, and this does not.',
                `No world location record for "${wanted || placeName(cultivator)}"` +
                `${this.atHand ? '' : ' (world simulation is off for this run)'}.`
            ));
        }

        const rows = locationHistory(place);
        const origin = rows.find(row => row.changeId === null) ?? null;
        const facts = this.repos && this.atHand ? this.atHand.history.facts : [];

        // Newest first: the thing that made this place what it is now is the
        // last thing that happened to it, not the first.
        const changes = rows
            .filter(row => row.changeId !== null)
            .slice()
            .reverse()
            .slice(0, PLACE_CHANGES_SHOWN)
            .map(row => ({
                year: row.year,
                summary: row.summary,
                causeKnown: row.causeKnown,
                cause: row.causeKnown && row.causeFactId
                    ? facts.find(fact => fact.id === row.causeFactId)?.summary ?? null
                    : null,
                attributed: row.attributedCauses
            }));

        const rendered = factsForPlaceHistory(
            { name: place.name, kind: place.kind, description: place.description },
            origin && origin.onDay > Number.NEGATIVE_INFINITY
                ? { kind: place.origin.kind, year: origin.year }
                : { kind: place.origin.kind, year: null },
            changes
        );
        rendered.structure.push(`world location ${place.id}; ${place.changes.length} change(s) on record.`);

        const execution = this.freeAction(run, 'look', rendered);
        execution.calls = [{
            name: 'world.locationHistory',
            action: 'look',
            summary:
                `${place.id}: ${place.changes.length} change(s); ` +
                `${changes.filter(c => c.causeKnown).length} with a cause on record, ` +
                `${changes.reduce((n, c) => n + c.attributed.length, 0)} explanation(s) held locally. ` +
                'Read only: no time passed, nothing changed.',
            ok: true
        }];
        return execution;
    }

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
     */
    private async market(cultivator: Cultivator, target: string | undefined): Promise<Execution> {
        const category = MARKET_CATEGORIES.find(c => (target ?? '').toLowerCase().includes(c));
        const result = await handleMarket({
            action: 'market',
            cultivatorId: cultivator.id,
            ...(category ? { category } : {})
        });
        return this.fromToolResult('cultivation_mortal.market', 'market', result, 'The market');
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

        const result = await handleAssess({
            action: 'assess',
            cultivatorId: cultivator.id,
            against: 'place',
            place: query
        });
        return this.fromToolResult('cultivation_perception.assess', 'assess', result, 'The reckoning');
    }

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
    private async train(cultivator: Cultivator, target: string | undefined): Promise<Execution> {
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

        const result = await handlePractise({
            action: 'practise',
            techniqueId: technique.id,
            cultivatorId: cultivator.id,
            days: TRAINING_DAYS
        });

        return this.fromToolResult('technique_manage.practise', 'train_technique', result, technique.name);
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

        const pouched = found && found.harvestOrdinal <= applied.cultivator.realmOrdinal ? found : null;
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
                    : found
                        ? `${found.name} grows here but wants ${found.harvestOrdinal} ordinal to take safely. Left where it was.`
                        : 'The catalog offered nothing within reach at this realm.',
                ok: true
            }
        ];

        return {
            facts: factsForGather(
                cultivator, applied.cultivator, skip, ambient,
                pouched ? { name: pouched.name, grade: pouched.grade, value: pouched.value } : null
            ),
            events: skip.events,
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls
        };
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

        this.log.append(run.id, [
            { role: 'player', turn: run.turn, text: `ADMIN ${request.trim()}` },
            { role: 'narrator', turn: after.run.turn, text }
        ]);

        return {
            narration: text,
            events: [],
            toolCalls: [],
            state: this.stateView(after.run, after.cultivator)
        };
    }

    private fromToolResult(
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

    /**
     * Cultivating, provisioned out of the purse.
     *
     * The engine's food clock is not a nuisance to be routed around: a full
     * belly covers fifty turn-consuming actions, so a decade of unattended
     * cultivation genuinely is impossible without provisions, and buying them
     * is the "eat, or keep the stones" choice made concrete. Provisions are
     * bought up front at whatever the purse covers; when it does not cover the
     * whole stretch, the engine starves the remainder, which is correct.
     *
     * `sealed` is what separates `seclude` from `cultivate`, and it is a real
     * bargain rather than a flavour: closed-door seclusion turns off random
     * events, which buys safety from encounters at the price of every
     * opportunity that would have found you. Both halves are the engine's.
     */
    private async runSeclusion(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        days: number,
        options: {
            sealed?: boolean;
            acknowledged?: boolean;
            askedFor?: number;
            /**
             * The fork this sitting is the second half of, when it is one.
             *
             * Set only by `sitBackDown`. It carries the rations the interrupted
             * half left in the pack, so the resumed span is not charged a
             * second time for food that was already bought, and it carries the
             * sentence saying what the player committed to.
             */
            resuming?: SeclusionCrossroads;
        } = {}
    ): Promise<Execution> {
        const sealed = options.sealed ?? false;
        const startDay = Math.floor(run.elapsedDays);

        // ── A STRETCH WHOSE RETURN IS ZERO IS NOT SOLD SILENTLY ──────────
        //
        // `techniqueCeiling` is a HARD zero, not a taper, and the engine knows
        // it on day zero. It used to say so on day zero and then spend the
        // years anyway, at full hazard, which is the single worst thing this
        // game does to a player. Two live runs, at opposite ends of the ladder:
        //
        //   a beginner with no manual sat 900 days for exactly 0 progress,
        //   collected a disturbance and a serious deviation on the way, then
        //   found a manual and died on the next action of the wounds the
        //   pointless stretch had given them. Turn 9.
        //
        //   ordinal 13, healthy, 100 years of rations, sat down for thirty
        //   years against an exhausted manual. The engine printed "it is
        //   stopped, and no amount of sitting with it changes that" on Day 0,
        //   ran thirteen more years, aged them 122 to 148 and killed them by
        //   stagnation.
        //
        // The second case is the general one and it will hit every player
        // repeatedly, because every cultivator reaches the end of a book many
        // times in a career. The cost is lifespan, which is the resource the
        // whole game is about.
        //
        // A refusal rather than a free pass. Making a zero-return stretch cost
        // nothing would be worse: it turns "sit until something happens" into a
        // dominant move and it lies about the cave, which is dangerous whether
        // or not anybody is making progress. So the years are still real and
        // still spendable - the player just has to mean it. Same shape as the
        // wasted-pill override, and for the same reason: this layer cannot ask
        // a question and wait for an answer.
        const wall = techniqueCeiling(
            cultivator.realmOrdinal, this.rateTermsFor(cultivator).techniqueCap
        );
        if (wall.multiplier === 0 && !options.acknowledged) {
            return this.sittingWouldReturnNothing(cultivator, wall, days);
        }

        // `cultivate` reaches here without an action-level world load, and the
        // encounter layer reads the place and the people standing in it.
        this.atHand = await this.loadWorld();

        // BEFORE anything is spent. Provisioning is priced per day, and a
        // seclusion cut short in year eight should not have been provisioned
        // for twenty.
        const enc = encountersFor(
            { repos: this.repos, knowledge: this.knowledge, world: this.atHand },
            {
                seed: run.seed,
                startDay,
                days,
                activity: sealed ? 'sealed' : 'seclusion',
                cultivator,
                arrivable: this.pendingArrivals,
                // The row id is a randomUUID and would make the run
                // irreproducible from its seed. See PLAYER_ROLL_IDENTITY.
                rollIdentity: PLAYER_ROLL_IDENTITY
            }
        );
        const lived = daysActuallySpent(enc, startDay, days);

        const provisioning = this.buyProvisions(
            cultivator, lived, options.resuming?.rationsLeft ?? 0
        );
        const provisioned = withEncounterDeltas(provisioning.cultivator, enc);
        const prepared = provisioning.covered >= lived;
        // Held rather than inlined: the ceiling is reported in the preamble
        // below off the same terms the rate was computed from, so the sentence
        // a player reads and the number the engine used cannot disagree.
        const terms = this.rateTermsFor(provisioned);

        const skip = simulateTimeSkip(provisioned, lived, {
            seed: run.seed,
            // The row id is a randomUUID; without this the run is not
            // reproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(provisioned),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: 1,
                ...terms,
                ground: this.groundFor(provisioned)
            },
            understanding: this.understandingFor(run, provisioned),
            techniqueElement: null,
            rations: provisioning.rations,
            grainAbstinence: false,
            autoBreakthrough: true,
            // A SHUT DOOR IS NOT A WARD.
            //
            // Sealing used to switch the encounter tables off entirely, and
            // that made closed-door seclusion a dominant strategy rather than
            // a trade: everything that can kill a cultivator in a long stretch
            // arrives through those tables, so a player who sealed was simply
            // safe. Found by playing - three runs died to wounds and to a
            // fight, and the fourth survived by never opening the door.
            //
            // The world does not stop at the threshold. A rogue cultivator
            // barges into the cave; somebody arrives at it needing help. Being
            // behind a door changes what happens next and does not decide
            // whether anything happens at all.
            //
            // What sealing still buys is real and is priced below: a sealed
            // crossing is a PREPARED one - the door is shut, the site was
            // chosen, and `SEALED_PREPARATION` is worth more than
            // `PROVISIONED_PREPARATION` at the toll and at the foundation.
            //
            // Nothing wanders into a True Immortal's seclusion, and that guard
            // stays: the encounter tables are the mortal world's and they do
            // not reach above the Lid.
            randomEvents: !canExistBeyondTheLid(cultivator),
            // The door is a rate, not a switch, and the rate is not constant:
            // a formation is a thing somebody built, and it goes. Over a long
            // enough sitting the ward the cultivator set on their own door
            // decays under them, and a door that is gone is not a door.
            //
            // Both ends of this now read the SAME arithmetic. A prospector
            // standing at a sealed ruin asking whether they can get in, and a
            // cultivator sitting behind their own seal wondering what can
            // reach them, are asking one question about one object - from
            // outside, a live cultivator's sealed cave and a dead one's are
            // indistinguishable, which is most of why anybody opens either.
            //
            // The half-life carries the cultivator's own rung, so this scales
            // with power the way the setting says it should: a seal set near
            // the bottom is largely gone within a lifetime, and one set near
            // the top holds for tens of thousands of years.
            randomEventScale: sealed ? doorScaleOverStretch(cultivator.realmOrdinal, lived) : 1,
            // A boundary crossed inside this stretch exacts its price, and it
            // can only take what the run actually owns. Handing it the real
            // rows is what makes the price a delete rather than an assertion.
            toll: {
                ...tollConditionsFor(this.repos, provisioned),
                // A sealed crossing is a prepared one: the door is shut, the
                // site was chosen, nobody is coming through it.
                preparation: prepared ? (sealed ? SEALED_PREPARATION : PROVISIONED_PREPARATION) : 0,
                hurried: lived < HURRIED_BELOW_DAYS
            },
            foundation: {
                preparation: prepared ? (sealed ? SEALED_PREPARATION : PROVISIONED_PREPARATION) : 0,
                hurried: lived < HURRIED_BELOW_DAYS
            }
        });

        const applied = applyTimeSkip(this.repos, { before: provisioned, run, skip });
        // The world spends exactly the days the cultivator spent. Not the days
        // that were asked for: a skip cut short by a wound stops the world at
        // the same hour it stopped the cultivator.
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);
        const verb: ActionName = sealed ? 'seclude' : 'cultivate';

        // ── WHAT ACTUALLY HAPPENED, AGAINST WHAT WAS GOING TO ───────────
        //
        // `lived` is the encounter layer's own truncation and it is not the
        // last word: `simulateTimeSkip` then stops wherever IT likes - a wound,
        // a deviation threshold, a major encounter, a death - and everything
        // rolled between the two is a span nobody reached. Until this cut, all
        // of it was recorded, narrated and consumed off the arrivals list
        // anyway. Three playtests found it independently; the plainest was a
        // cultivator who died on day 5 and read a mission board on day 2995.
        //
        // Everything downstream reads `happened` rather than `enc`.
        const happened = cutTo(enc, startDay, skip.simulatedDays);
        this.handBackWhatNeverHappened(applied.cultivator, enc, happened);

        // AFTER the skip, because a knowledge grant is a write and writes belong
        // in phase 2. Phase 3 then only ever gets a licence to mention something
        // that is already true.
        const enc2 = recordEncounters(
            this.knowledge, applied.cultivator, applied.run.elapsedDays, happened, this.repos
        );
        this.pendingArrivals = consumeArrivals(this.pendingArrivals, happened);

        const facts = factsForTimeSkip(
            provisioned, applied.cultivator, skip, ambient,
            sealed ? 'Closed-door seclusion' : 'Seclusion',
            // `lived` was already cut down by the encounter layer before the
            // skip saw it, so the skip's own idea of what was requested is the
            // truncated figure. `days` is what the player actually said.
            days,
            // And what they said before the parser's own ceiling took a
            // thousandfold bite out of it without mentioning that it had.
            options.askedFor !== undefined && options.askedFor > days
                ? options.askedFor
                : undefined
        );
        facts.lines.unshift(provisioning.line);

        // ── WHAT THE CAVE MOUTH CHARGED, SAID OUT LOUD ───────────────────
        //
        // This line has been built and thrown away since it was written, and it
        // killed runs. `buyProvisions` tops the pack up at the door and charges
        // for it; the sentence describing the purchase went into `lines`, which
        // is a LICENCE, and a narrator that would rather write about the
        // mountain simply did not use it. Observed on a live server: a purse
        // going 24 -> 6 -> 0 across two seclusions with nothing said either
        // time, then starvation on the third turn, by a sixteen-year-old who
        // started with thirty stones.
        //
        // The playtester who found it first logged those two deaths as their
        // own harness error, which is the measure of how invisible it was.
        //
        // A purse being spent is the definition of a fact a player cannot play
        // without, so it takes the same treatment `method_ceiling` already has.
        (facts.required ??= []).push(provisioning.line);

        // ── AND ANYTHING THAT STOPPED THE STRETCH ────────────────────────
        //
        // Same failure, same span, and worse. A serious qi deviation was rolled
        // with `interrupts: true` - "cultivation is halted until the deviation
        // is cleansed" - and did not appear in the narration at all. An event
        // that ENDED the thing the player paid for is not a detail a stylist
        // may drop for pacing: it is the reason the stretch came back short,
        // and without it the player reads a truncated seclusion as the engine
        // miscounting.
        //
        // Only the interrupting ones. A digest of forty lines all marked
        // required is a digest with nothing required in it.
        for (const event of skip.events) {
            if (event.interrupts) facts.required.push(event.summary);
        }

        // ── AND IF IT STOPPED BECAUSE OF SOMEBODY, IT IS A QUESTION ──────
        //
        // The one interrupt in the whole file that is not a fact about the
        // cultivator's own body. A wound, a deviation, an empty pack - those
        // have happened and the only honest thing to do is report them. A
        // person at the cave mouth has not happened yet, and `time-skip.ts`
        // already writes two sentences saying so and naming both costs.
        //
        // What it could not do was hold the question open, so the engine
        // answered it: "You came out early. 5.3 years of the 40 years were
        // spent; the rest was not yours to spend." The player was told they had
        // a choice and then shown the outcome of a choice somebody else made.
        //
        // `raiseTheCrossroads` puts it back. Nothing here changes what was
        // rolled, what it cost, or the chance of anything - the stretch stopped
        // exactly where it stopped, and both branches out of it were always
        // physically there. What changes is who takes one.
        if (options.resuming) {
            // Said before the fork is possibly raised again, so a second
            // interruption reads as a second question rather than as the first
            // one repeating.
            const committed = whatStayingCommittedTo(
                options.resuming,
                howTheyAreReferredTo(
                    options.resuming.whoIsClose,
                    options.resuming.whoIsClose
                        ? rankName(options.resuming.whoIsClose.realmOrdinal)
                        : null
                )
            );
            facts.lines.unshift(committed);
            (facts.required ??= []).push(committed);
        }
        // `applied.run`, not `run`: the skip has already booked its turn, and a
        // question stamped with the turn before the one it was asked on reads
        // as a stale record to anybody auditing the log.
        this.raiseTheCrossroads(applied.run, applied.cultivator, skip, facts, {
            sealed,
            acknowledged: options.acknowledged ?? false,
            daysAsked: lived,
            startDay
        });

        // ── THE CEILING, BEFORE THE DECADE RATHER THAN AFTER ─────────────
        //
        // The engine files a `method_ceiling` event and it arrives inside a
        // digest of forty other lines, which is the worst possible place for
        // the only fact in the span a player can act on. Said here as well, at
        // the top, in its own right - and marked required, so it survives a
        // narrator that would rather write about the weather.
        //
        // Not an interrupt, deliberately. Being told is not a reason to stop a
        // seclusion out from under somebody who chose it knowingly, and an
        // interrupt every chunk would leave a stalled cultivator unable to pass
        // time at all.
        const ceiling = techniqueCeiling(cultivator.realmOrdinal, terms.techniqueCap);
        if (ceiling.line !== null) {
            facts.lines.unshift(ceiling.line);
            (facts.required ??= []).push(ceiling.line);
        }

        if (sealed) {
            // ── THE PROSE YIELDS TO THE MEASUREMENT ──────────────────────
            //
            // This used to read "no encounter and no opportunity could reach
            // this stretch", and it had been false since the door became a rate
            // rather than a switch. `randomEvents` is on behind a seal, scaled
            // by `doorScaleOverStretch`, and the comment at that call site says
            // in full why: a door that made a cultivator simply safe made
            // closed-door seclusion the dominant strategy rather than a trade.
            //
            // A player who reads the old sentence and is then interrupted has
            // been told the engine lied to them, which is worse than being
            // interrupted. So this says what the seal actually buys - a rate,
            // and a better crossing - and it says that the rate is not zero and
            // does not stay where it was set.
            facts.lines.unshift(
                'The door was sealed. Less reaches you behind it and it is not nothing: a seal '
                + 'is a thing somebody built, it thins what finds you rather than stopping it, '
                + 'and over a long enough sitting it goes on its own. What it certainly buys is '
                + 'the crossing - a shut door and a chosen site are worth more at the boundary '
                + 'than provisions alone.'
            );
        }
        facts.lines.push(...applied.tollLines);
        facts.lines.push(...enc2.lines);
        facts.lines.push(...world.lines);
        facts.structure.push(...enc2.structure);
        facts.structure.push(...world.structure);
        if (world.lines.length > 0) {
            facts.prose = `${facts.prose}\n\n${world.lines.join('\n')}`;
        }

        return {
            facts,
            events: [...skip.events, ...enc2.events].sort((a, b) => a.dayOffset - b.dayOffset),
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                ...skipCalls(verb, skip, provisioning.line),
                ...tollCalls(applied.tollLines),
                ...encounterCalls(happened, verb, enc),
                ...worldCalls(world)
            ]
        };
    }

    /**
     * Take back what the cultivator was credited for a span they never spent.
     *
     * `withEncounterDeltas` runs BEFORE the skip, because the skip needs a
     * starting HP and a starting purse. So by the time `cutTo` works out which
     * days were actually lived, the HP and stones of occurrences that never
     * happened are already folded in. Left alone, the sheet would disagree with
     * the account the player just read - which is the same defect as the events
     * themselves, one layer down.
     *
     * A write rather than a re-run of the skip: re-running it with different
     * starting HP is a balance change wearing a bug fix's clothes, and it can
     * shift where the skip stops, which is the very thing being measured here.
     *
     * Silent when nothing was dropped, which is the ordinary case. Never on a
     * cultivator the run has already closed: a death is final and the repo
     * refuses the write in any case.
     */
    private handBackWhatNeverHappened(
        after: Cultivator,
        rolled: EncounterRoll,
        happened: EncounterRoll
    ): void {
        if (!after.alive) return;
        const dropped = deltasDroppedBy(rolled, happened);
        if (dropped.hp === 0 && dropped.spiritStones === 0) return;
        this.repos.cultivators.applyDeltas(after.id, {
            hp: -dropped.hp,
            spiritStones: -dropped.spiritStones
        });
    }

    // ── A BROKEN SECLUSION IS A QUESTION ─────────────────────────────────
    //
    // Everything from here to `settleAnyStandingCrossroads` is one feature and
    // it is described in full in
    // `choosing-what-to-do-when-a-seclusion-is-broken.ts`. The short version:
    // the engine stops a long sitting when somebody comes near, writes two very
    // good sentences about the two things the cultivator could do, and then did
    // one of them without asking. These four methods are the asking.

    /**
     * Hold the fork open for one turn, if the stretch stopped because of a person.
     *
     * Only `major_encounter`. Every other interrupt is a fact about the
     * cultivator's own body that has already happened - a torn channel, a
     * deviation, an empty pack - and there is nothing to decide about a thing
     * that is already true. A person at the cave mouth has not arrived yet, and
     * that is the entire difference.
     *
     * `canWithdraw` is READ off the event the engine filed, never re-rolled. It
     * was decided by a sample drawn against the cultivator's own Fortune inside
     * `simulateTimeSkip` and re-deciding it here would be a second opinion on
     * something that already has one - the exact shape of defect the authority
     * rule exists to forbid.
     */
    private raiseTheCrossroads(
        run: Run,
        cultivator: Cultivator,
        skip: TimeSkipResult,
        facts: EngineFacts,
        context: {
            sealed: boolean;
            acknowledged: boolean;
            /** The span the skip was handed, after the encounter layer's own cut. */
            daysAsked: number;
            startDay: number;
        }
    ): void {
        // Whatever question was standing has been answered by getting here at
        // all: this turn was a seclusion, which is either the resumption or a
        // fresh sitting, and both settle the old one.
        this.crossroads = null;

        if (skip.interruptReason !== 'major_encounter') return;
        if (!cultivator.alive) return;

        const remaining = Math.floor(context.daysAsked - skip.simulatedDays);
        // A stretch that stopped on its own last day has nothing left to
        // decide about. Offering a fork over zero days would be a panel with
        // nothing behind either button.
        if (remaining < 1) return;

        const filed = [...skip.events].reverse().find(event =>
            event.kind === 'encounter' && event.data?.severity === 'major');
        if (!filed) return;

        const crossroads: SeclusionCrossroads = {
            runId: run.id,
            cultivatorId: cultivator.id,
            raisedOnTurn: run.turn,
            canWithdraw: filed.data?.canWithdraw === true,
            sealed: context.sealed,
            acknowledged: context.acknowledged,
            daysAsked: Math.floor(context.daysAsked),
            daysSpent: Math.floor(skip.simulatedDays),
            daysRemaining: remaining,
            stoppedOnDay: Math.floor(context.startDay + skip.simulatedDays),
            rationsLeft: Math.max(0, Math.floor(skip.endState.rationsRemaining ?? 0)),
            whoIsClose: this.whoIsCloseNow(cultivator)
        };
        this.crossroads = crossroads;

        // ── AND THE SENTENCE THAT USED TO ANSWER IT COMES OUT ────────────
        //
        // `factsForTimeSkip` closes every interrupted stretch with "You came
        // out early. 5.3 years of the 40 years were spent; the rest was not
        // yours to spend." That is exactly right for a torn channel or an empty
        // pack, where the stretch ended because something already happened. It
        // is the defect itself when the stretch ended on a QUESTION: read live,
        // it announced the outcome of a decision two paragraphs before the
        // decision was put to the player, and it says the years are not theirs
        // in the same breath as offering them.
        //
        // Removed here rather than conditioned at source because the condition
        // is not knowable there - `factsForTimeSkip` sees an interrupt and not
        // whether anybody is going to be asked about it. When these two files
        // are next open together the branch belongs in `facts.ts`, keyed on the
        // same fact this method tests.
        const CAME_OUT_EARLY = 'You came out early.';
        facts.prose = facts.prose
            .split('\n\n')
            .filter(paragraph => !paragraph.startsWith(CAME_OUT_EARLY))
            .join('\n\n');

        const question = whatTheForkAsks(crossroads, this.howToReferToThem(crossroads));
        facts.lines.push(question);
        // Required, for the same reason the provisioning line and every
        // interrupting event are required: a narrator that drops the question
        // leaves the player reading an outcome nobody chose, which is the whole
        // defect this exists to close.
        (facts.required ??= []).push(question);
        facts.structure.push(whatTheForkAsksStructurally(crossroads));
    }

    /**
     * Who the world says is close enough to matter.
     *
     * A READ, and nothing but a read. `present` is the same crowd the hearsay
     * layer and every pointing phrase resolve against, in the same single total
     * order, and the last of it is what `somebodyAtHand` already means by "the
     * nearest cultivator" - see `oneCrowd` for why that order exists and why it
     * must not be recomputed here.
     *
     * `combatPowerForOrdinal` prices both of them off the ladder alone. Deeper
     * pricing would need attributes, wounds and what they are carrying, and the
     * roster carries none of those - `assessPower` on a half-built combatant
     * would be a worse number than an honest coarse one. What this is for is
     * the operator's line saying who was outside and roughly what they were
     * worth; nothing reads it back and nothing resolves against it.
     *
     * Null when the world is off or the place holds nobody, and the sentences
     * degrade to the engine's own "whoever that is" rather than inventing a
     * person to fill the slot.
     */
    private whoIsCloseNow(cultivator: Cultivator): WhoIsClose | null {
        const here = this.present(cultivator);
        if (here.length === 0) return null;
        const them = here[here.length - 1];
        return {
            id: them.id,
            name: them.name,
            realmOrdinal: them.realmOrdinal,
            theirPower: combatPowerForOrdinal(them.realmOrdinal),
            yourPower: combatPowerForOrdinal(cultivator.realmOrdinal),
            known: this.knowledge.isAwareOf(cultivator.id, 'cultivator', them.id)
        };
    }

    /** A name only if it has been earned; otherwise the rung, which anybody can feel. */
    private howToReferToThem(crossroads: SeclusionCrossroads): string {
        return howTheyAreReferredTo(
            crossroads.whoIsClose,
            crossroads.whoIsClose ? rankName(crossroads.whoIsClose.realmOrdinal) : null
        );
    }

    /**
     * The player sat back down. Spend the rest of the sitting.
     *
     * The whole of staying is one call into the ordinary seclusion path for the
     * remaining days, starting from the day it stopped - which the run's clock
     * is already standing on, because the first half advanced it. Every roll in
     * `time-skip.ts` and in `src/engine/encounters/` is keyed to an ABSOLUTE
     * day, so the surviving days give exactly what they were always going to
     * give and a forty-year sitting split into 5.3 and 34.7 is the same forty
     * years. There is no second simulation and no modifier anywhere in it.
     *
     * It can be interrupted again, and if it is, that is a second question and
     * not the first one repeating.
     */
    private async sitBackDown(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        crossroads: SeclusionCrossroads
    ): Promise<Execution> {
        this.crossroads = null;
        return await this.runSeclusion(run, cultivator, ambient, crossroads.daysRemaining, {
            sealed: crossroads.sealed,
            // Already answered for this sitting. Asking again would refuse the
            // second half of a stretch the player has explicitly recommitted to.
            acknowledged: crossroads.acknowledged,
            resuming: crossroads
        });
    }

    /**
     * The player got up. Say what that cost, and take no day for saying it.
     *
     * A turn of attention and nothing else. The remaining days are already
     * gone - they were never spent, and this is the sentence that says so - and
     * charging a day on top would be billing somebody for the act of answering.
     */
    private getUpAndGo(
        run: Run,
        crossroads: SeclusionCrossroads
    ): Execution {
        this.crossroads = null;
        const them = this.howToReferToThem(crossroads);
        const cost = whatGoingCost(crossroads, them);
        const facts = factsForToolResult(
            crossroads.canWithdraw
                ? 'Up, and out by the road that does not cross them.'
                : 'On your feet, which is all getting up buys.',
            [cost],
            cost
        );
        facts.required = [cost];
        facts.structure.push(
            `The crossroads raised on turn ${crossroads.raisedOnTurn} was answered by leaving. `
            + `${crossroads.daysSpent} of ${crossroads.daysAsked} days stand spent and `
            + `${crossroads.daysRemaining} were forfeited unspent. No day passed answering: the `
            + 'remainder was never simulated, so there is nothing to take back and nothing to '
            + 'refund. '
            + (crossroads.canWithdraw
                ? 'A clean withdrawal had been rolled available, so nobody saw the place.'
                : 'No clean withdrawal had been rolled, so the only thing that changed is '
                  + 'posture.')
        );
        const execution = this.freeAction(run, 'wait', facts);
        execution.calls = [{
            name: 'engine.seclusionCrossroads',
            action: 'leave',
            summary:
                `The interrupted sitting was ended by the player. ${crossroads.daysRemaining} `
                + 'unspent days forfeited; nothing was rolled and no day passed.',
            ok: true
        }];
        return execution;
    }

    /**
     * Anything that spends a day instead of sitting is going, and it says so.
     *
     * The fork is not a modal jail. A player who answers it by travelling, by
     * eating, by taking work or by walking down the mountain has made the
     * decision - they are not sitting any more - and the engine's job is to say
     * what that cost rather than to refuse every verb until the question has
     * been answered in the approved words. AGENTS.md, agency: do not ban.
     *
     * A FREE ACTION IS NOT GOING. The test is whether THE CLOCK MOVED, not
     * whether a turn was taken. `freeAction` exists because "looking around
     * must never be able to kill you, and in a permadeath game that is a rule,
     * not a courtesy" - and charging thirty-four years for "what am I
     * carrying", for a refusal, or for a sentence the parser could not resolve
     * would break that rule harder than anything it was written against. None
     * of those take the cultivator off the seat and none of them bring the
     * person outside a day closer, so the question is still open and still
     * theirs.
     *
     * Called after phase 2 and before phase 3 on every path that can take a
     * turn, so the sentence is in the facts the narrator is handed rather than
     * bolted onto prose that has already been written.
     */
    private settleAnyStandingCrossroads(
        execution: Execution,
        crossroads: SeclusionCrossroads,
        cultivator: Cultivator,
        clockMoved: boolean
    ): void {
        if (!clockMoved) return;
        if (execution.outcome === 'refused') return;
        // Identity, not a blanket clear. A player who answered by starting a
        // FRESH sitting has had a new question raised inside this same turn by
        // `raiseTheCrossroads`, and nulling the field here would throw it away
        // and resolve the new fork silently - which is this bug, reintroduced
        // one turn later by its own fix.
        if (this.crossroads === crossroads) this.crossroads = null;
        if (!cultivator.alive) return;

        const cost = whatGoingCost(crossroads, this.howToReferToThem(crossroads));
        execution.facts.lines.push(cost);
        (execution.facts.required ??= []).push(cost);
        execution.facts.structure.push(
            `The crossroads raised on turn ${crossroads.raisedOnTurn} was answered by doing `
            + `something else, which is leaving. ${crossroads.daysRemaining} unspent days of the `
            + `${crossroads.daysAsked} were forfeited. Nothing was refunded and nothing further `
            + 'was rolled for them.'
        );
    }

    /**
     * The zero-return refusal, and where the next volume is.
     *
     * Honest was never the problem - `techniqueCeiling.line` is one of the best
     * sentences in the game and it was already being printed. The problem was
     * that it was printed and then ignored, and that it stopped at the
     * diagnosis. "What is missing is the next volume" is true and leaves the
     * player standing in the same cave with no idea where a volume comes from.
     *
     * So the refusal carries the pointer. The candidates come out of the same
     * catalog read `list_techniques` uses, filtered to cultivation arts that
     * carry FURTHER than this cultivator currently stands, which is the exact
     * definition of "the next volume". Naming one is worth more than naming
     * four: a player who has been stopped needs a next step, not a menu.
     *
     * Free, like every refusal: no time, no food, no roll.
     */
    private async sittingWouldReturnNothing(
        cultivator: Cultivator,
        wall: ReturnType<typeof techniqueCeiling>,
        days: number
    ): Promise<Execution> {
        const next = await this.theNextVolume(cultivator);

        const wouldBe = wall.state === 'no_method'
            ? 'There is no road for the qi to take, so the whole stretch returns exactly nothing.'
            : 'The book has ended, so the whole stretch returns exactly nothing.';

        const pointer = next
            ? `${next} carries further than you stand, and you could be taught it. `
              + 'Ask who would teach you, or what there is to learn.'
            : 'Ask what there is to learn, and who would teach you. Neither costs a day.';

        return refused('engine.techniqueCeiling', 'cultivate', factsForRefusal(
            `${humanDays(days)} of sitting would produce nothing.`,
            `${wall.line} ${wouldBe} ${pointer} `
            + 'Say it again with "anyway" and the years go by regardless - they are yours to spend.',
            (wall.state === 'no_method'
                ? 'No method is practised, so the rate multiplier at '
                : 'The manual has ended, so the rate multiplier at ')
            + `${rungAndOrdinal(cultivator.realmOrdinal)} is 0 and the stretch returns exactly `
            + 'nothing. '
            + `${days} day${days === 1 ? ' was' : 's were'} refused before anything was spent: `
            + 'no provisioning, no encounter roll, no time passed.'
        ));
    }

    /**
     * The best art in reach that carries further than this cultivator stands.
     *
     * Returns a NAME or null, and nothing else - this is a pointer inside a
     * refusal, not a second listing verb. Reads through the same handler
     * `list_techniques` uses so the two cannot come to disagree about what is
     * available, and stays silent rather than guessing if that read fails.
     */
    private async theNextVolume(cultivator: Cultivator): Promise<string | null> {
        try {
            const listed = await handleListAvailable({
                action: 'list_available',
                cultivatorId: cultivator.id,
                includeConflicting: false,
                includeForbidden: false
            });
            if (isGuidingErrorBody(listed)) return null;

            const compatible = (listed as {
                compatible?: {
                    name?: string;
                    known?: boolean;
                    class?: string;
                    carriesToOrdinal?: number | null;
                }[];
            }).compatible ?? [];

            const reaching = compatible
                .filter(row =>
                    row.known !== true
                    && row.class === 'cultivation'
                    && typeof row.name === 'string'
                    && (row.carriesToOrdinal ?? -1) > cultivator.realmOrdinal)
                .sort((a, b) => (b.carriesToOrdinal ?? 0) - (a.carriesToOrdinal ?? 0));

            return reaching[0]?.name ?? null;
        } catch {
            // A pointer that cannot be read is a pointer the refusal does
            // without. It must never be the reason the refusal fails to arrive.
            return null;
        }
    }

    private async shortSkip(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        focus: number,
        label: string,
        days = SHORT_ACTION_DAYS,
        activity: EncounterActivity = activityForVerb(label)
    ): Promise<Execution> {
        const startDay = Math.floor(run.elapsedDays);

        const enc = encountersFor(
            { repos: this.repos, knowledge: this.knowledge, world: this.atHand },
            {
                seed: run.seed,
                startDay,
                days,
                activity,
                cultivator,
                arrivable: this.pendingArrivals,
                // The row id is a randomUUID and would make the run
                // irreproducible from its seed. See PLAYER_ROLL_IDENTITY.
                rollIdentity: PLAYER_ROLL_IDENTITY
            }
        );
        const lived = daysActuallySpent(enc, startDay, days);
        const before = withEncounterDeltas(cultivator, enc);

        const skip = simulateTimeSkip(before, lived, {
            seed: run.seed,
            // The row id is a randomUUID; without this the run is not
            // reproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rollIdentity: PLAYER_ROLL_IDENTITY,
            locationId: placeName(cultivator),
            turn: run.turn,
            startDay,
            options: {
                focusMultiplier: focus,
                ...this.rateTermsFor(before),
                ground: this.groundFor(before)
            },
            understanding: this.understandingFor(run, before),
            // What is in the pack feeds them here too. Only seclusion tops the
            // pack up from the purse; this eats what is already carried.
            rations: this.drawFromPack(cultivator, lived),
            grainAbstinence: false,
            autoBreakthrough: false,
            randomEvents: true,
            toll: tollConditionsFor(this.repos, cultivator)
        });

        const applied = applyTimeSkip(this.repos, { before, run, skip });
        const world = await this.advanceWorld(skip.simulatedDays, applied.cultivator, applied.run);

        // The same cut the long path takes, and for the same reason: a short
        // action can still be stopped early by the skip, and an occurrence past
        // that day did not happen. See `cutTo`.
        const happened = cutTo(enc, startDay, skip.simulatedDays);
        this.handBackWhatNeverHappened(applied.cultivator, enc, happened);

        const enc2 = recordEncounters(
            this.knowledge, applied.cultivator, applied.run.elapsedDays, happened, this.repos
        );
        this.pendingArrivals = consumeArrivals(this.pendingArrivals, happened);

        const facts = factsForTimeSkip(before, applied.cultivator, skip, ambient, label);
        facts.lines.push(...enc2.lines);
        facts.lines.push(...world.lines);
        facts.structure.push(...enc2.structure);
        facts.structure.push(...world.structure);
        if (world.lines.length > 0) {
            facts.prose = `${facts.prose}\n\n${world.lines.join('\n')}`;
        }

        return {
            facts,
            events: [...skip.events, ...enc2.events].sort((a, b) => a.dayOffset - b.dayOffset),
            timeSkip: skip,
            breakthrough: null,
            outcome: 'executed',
            calls: [
                ...skipCalls(label.toLowerCase().startsWith('practice') ? 'train_technique' : 'wait', skip, null),
                ...encounterCalls(happened, label.toLowerCase(), enc),
                ...worldCalls(world)
            ]
        };
    }

    /**
     * One breakthrough attempt, applied.
     *
     * `advanceRealm` is deliberately not used: it zeroes accumulated progress,
     * and the engine's own rule is that a successful attempt consumes exactly
     * `progressConsumed` and the overflow carries. Writing the absolute state
     * keeps this layer agreeing with `simulateTimeSkip`, which does the same.
     */
    private strikeBarrier(run: Run, cultivator: Cultivator, ambient: AmbientQi): Execution {
        const absDay = Math.floor(run.elapsedDays);

        // ── the pill, which could not reach this ──
        //
        // The old comment here read "striking the barrier on command is
        // deliberate but unaided: the cultivator chose the moment, and nothing
        // was bought for it", and no `pill` was passed at all. That is not a
        // house rule about deliberateness, it is the largest modifier in the
        // game switched off on the only path a player can reach:
        // `MAX_PILL_BONUS` is 0.35, five catalogued pills exist to supply it,
        // and it is the designed mitigation for the rungs the Ladder panel
        // itself calls the ones that kill. Four deaths at the 12->13 Foundation
        // boundary, all funded, healthy and inside the stagnation clock, were
        // spent on a preparation that could not be applied.
        //
        // The MCP path has always read it, and this now reads it the same way,
        // from the same flag, and spends it on the same terms: the pill is
        // recorded when it is SWALLOWED, no caller passes a potency, and the
        // attempt consumes what was actually taken.
        const pending = readJsonFlag<PendingPill>(this.db, cultivator.id, FLAG_PENDING_PILL);

        const result = attemptBreakthrough(cultivator, {
            // ── why the attempt count is in the stream ──
            //
            // A failed attempt advances the turn and not the clock, so `absDay`
            // and `realmOrdinal` were both unchanged on a retry and the next
            // attempt was the SAME ROLL. Measured at 400 consecutive identical
            // failures against a rung whose base odds are about 85%, with no
            // signal to the player that clicking again could not help.
            //
            // It also crashed. Injury ids are drawn from this stream, so the
            // second attempt regenerated an id already in the table and the
            // endpoint 500'd on `UNIQUE constraint failed:
            // cultivator_injuries.id` - reachable by double-clicking the
            // button. One stream fix answers both, because both were the same
            // fact: the engine could not tell two attempts apart.
            //
            // `run.turn` is the discriminator rather than a new counter,
            // because it is already the thing that advances on a failure and is
            // already persisted. Determinism is untouched: the same run
            // replayed makes the same attempts in the same order.
            rng: forStream(
                run.seed, 'breakthrough', absDay, cultivator.realmOrdinal, run.turn
            ),
            ambient,
            turn: run.turn,
            pill: pending ? {
                name: pending.name,
                potency: pending.potency,
                // Both carried straight off the record written when it was
                // swallowed. A graded pill takes the real band curve; the
                // count is what makes the fifth one worth less than the first.
                ...(pending.grade ? { grade: pending.grade } : {}),
                priorPillsTaken: pending.priorPillsTaken ?? 0
            } : null,
            ranksGainedThisTurn: 0,
            // Deliberate, and now aided where the cultivator prepared for it.
            toll: {
                ...tollConditionsFor(this.repos, cultivator),
                preparation: DELIBERATE_PREPARATION
            },
            foundation: { preparation: DELIBERATE_PREPARATION, hurried: false }
        });

        const tollLines: string[] = [];
        const after = this.db.transaction((): Cultivator => {
            for (const injury of result.injuriesSustained) {
                this.repos.cultivators.addInjury(cultivator.id, {
                    id: injury.id,
                    severity: injury.severity,
                    source: injury.source,
                    description: injury.description,
                    sustainedOnTurn: injury.sustainedOnTurn,
                    woundType: injury.woundType
                });
            }

            const advanced = result.outcome === 'success';
            let updated = this.repos.cultivators.update(cultivator.id, {
                realmOrdinal: result.toOrdinal,
                cultivationProgress: Math.max(0, cultivator.cultivationProgress - result.progressConsumed),
                yearsAtCurrentRealm: advanced ? 0 : cultivator.yearsAtCurrentRealm
            });
            if (!updated) throw new GameError('Cultivator vanished mid-breakthrough.', 500);

            // The engine cannot re-derive the foundation from the ordinal
            // later, so persisting it is the caller's job.
            if (result.foundationEstablished) {
                persistFoundation(this.repos, cultivator.id, result.foundationEstablished);
                updated = this.repos.cultivators.getById(cultivator.id) ?? updated;
            }

            // ── The crossing, and the field it was being dropped in ──
            //
            // `attemptBreakthrough` decides this and nothing here was writing
            // it down, so a cultivator could survive the last crossing, be told
            // in the narration that they had gone through, and still be
            // `immortalStatus: 'none'` on the next read. Everything the far
            // side is gated on reads that field - `canExistBeyondTheLid`,
            // `evaluateLidTransit`, `hasCrossedTheLid`, the sheet's own "the
            // ladder is finished for you" - so the whole of the top of the game
            // was unreachable by one missing assignment, which is why it took
            // playing at 46 with an admin-set status to notice anything else
            // was wrong up there.
            if (result.immortalStatusGained) {
                updated = this.repos.cultivators.update(cultivator.id, {
                    immortalStatus: result.immortalStatusGained
                } as never) ?? updated;
            }

            // Spent, whether it helped or not. A pill swallowed for a crossing
            // is gone the moment the crossing is attempted, and leaving the flag
            // set would make one pill boost every future attempt for free.
            if (pending) clearFlag(this.db, cultivator.id, FLAG_PENDING_PILL);

            // The instalment, charged in the same transaction as the crossing
            // that triggered it.
            if (result.toll) {
                persistToll(this.repos, run, cultivator.id, result.toll);
                tollLines.push(tollLine(result.toll));
                updated = this.repos.cultivators.getById(cultivator.id) ?? updated;
            }

            this.repos.runs.incrementTurn(run.id, 1);
            if (updated.realmOrdinal > run.peakOrdinal) {
                this.repos.runs.updatePeakOrdinal(run.id, updated.realmOrdinal);
            }

            if (result.outcome === 'death') {
                const cause = result.tribulation ? 'heavenly_tribulation' : 'failed_breakthrough';
                return this.repos.cultivators.markDead(
                    cultivator.id, cause, run.turn + 1, describeDeath(cause, updated)
                ) ?? updated;
            }
            return updated;
        })();

        const calls: ToolCallRecord[] = [{
            name: 'engine.attemptBreakthrough',
            action: 'breakthrough',
            summary:
                `${(result.finalChance * 100).toFixed(1)}% final chance, rolled ${result.roll.toFixed(4)} - ` +
                `${result.outcome}. ${result.narrationHint}`,
            ok: true
        }];
        for (const injury of result.injuriesSustained) {
            calls.push({
                name: 'cultivator.addInjury',
                action: 'injury_sustained',
                summary: `${injury.severity} meridian injury recorded: ${injury.description}`,
                ok: true
            });
        }
        calls.push({
            name: 'cultivator.update',
            action: 'persist',
            summary:
                `Rank ${cultivator.realmOrdinal} → ${after.realmOrdinal}; ` +
                `${Math.round(result.progressConsumed)} qi-units consumed, ` +
                `${Math.round(after.cultivationProgress)} left banked.`,
            ok: true
        });
        if (result.foundationEstablished) {
            calls.push({
                name: 'engine.assessFoundation',
                action: 'foundation_established',
                summary: `Foundation laid: ${result.foundationEstablished}. It is what every later rank stands on.`,
                ok: true
            });
        }
        if (pending) {
            calls.push({
                name: 'cultivator.consumePill',
                action: 'pill_spent',
                summary:
                    `${pending.name} was spent on this attempt at potency ${pending.potency}. `
                    + 'Read from the flag it was recorded on when it was swallowed; no caller '
                    + 'passes a potency, and it is cleared whether the attempt landed or not.',
                ok: true
            });
        }
        if (result.immortalStatusGained) {
            calls.push({
                name: 'cultivator.update',
                action: 'crossing_recorded',
                summary:
                    `immortalStatus = ${result.immortalStatusGained}. `
                    + (result.immortalStatusGained === 'true_immortal'
                        ? 'The ladder is finished and the layer has changed. Mortal-world verbs '
                          + 'stop applying and the two that replace them - descend, and the '
                          + 'channel - open.'
                        : 'The crossing was survived and not completed. The Lid does not open '
                          + 'twice for the same name, and rank stops moving here.'),
                ok: true
            });
        }
        calls.push(...tollCalls(tollLines));
        if (result.outcome === 'death') {
            calls.push({
                name: 'cultivator.markDead',
                action: 'death',
                summary: `Run closed: ${result.tribulation ? 'heavenly_tribulation' : 'failed_breakthrough'}. Permadeath - no reload.`,
                ok: true
            });
        }

        const facts = factsForBreakthrough(cultivator, after, result, ambient);
        facts.lines.push(...tollLines);

        return {
            facts,
            events: [],
            timeSkip: null,
            breakthrough: result,
            outcome: 'executed',
            calls
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

        const resolved = query.length >= 3 ? resolvePrice(query) : null;
        const price = resolved ? getPrice(resolved.id) : undefined;

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
            return this.freeAction(run, 'buy', facts);
        }

        if (query.length < 3) return null;
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
    private async sell(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined
    ): Promise<Execution> {
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
     * What is in the pouch.
     *
     * `handleInventory` has been complete since alchemy was written and no
     * sentence reached it. Rendered here rather than left to the summariser,
     * for the same reason `list_recipes` is: the handler returns rows and no
     * `narrationHint`, and the last-resort line for a body nobody can summarise
     * is "It is done. Nothing about it drew attention." - which is what a
     * player asking what they were carrying was actually told.
     */
    private async inventory(run: Run, cultivator: Cultivator): Promise<Execution> {
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

        const lines: string[] = [];
        if (pills.length === 0 && herbs.length === 0) {
            lines.push(
                'Nothing in the pouch at all. What is on you is what you are standing in and '
                + `${stones} spirit stone${stones === 1 ? '' : 's'}.`
            );
        } else {
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

        const tox = body.toxicity;
        if (tox && typeof tox.accumulated === 'number' && tox.accumulated > 0) {
            lines.push(
                `Pill toxicity stands at ${tox.accumulated.toFixed(2)} against a tolerance of `
                + `${tox.tolerance ?? '?'}. It does not clear on its own.`
            );
        }

        const facts = factsForToolResult(
            pills.length + herbs.length === 0 ? 'An empty pouch.' : 'What is on you.',
            lines
        );
        facts.structure.push(
            `alchemy_manage.inventory: ${pills.length} pill row(s), ${herbs.length} herb row(s), `
            + `${stones} stone(s).`
        );
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
                    subject: manual.subject ?? null,
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
     * Why nothing is accumulating, with the binding gate named first.
     *
     * The pieces were all present and none of them was reachable. The manual
     * axis was on the STATUS read - forty lines down a sheet a player asks for
     * when they want their hit points - and the province, the seat and the
     * settling clock were reachable by no sentence at all.
     *
     * Free, and that is load-bearing: a player at a wall has to be able to ask
     * what it is as many times as they like. The whole design rests on the
     * pressure being legible, and pressure a player is charged to look at is
     * pressure they will stop looking at.
     */
    private ceiling(run: Run, cultivator: Cultivator, ambient: AmbientQi): Execution {
        const terms = this.rateTermsFor(cultivator);
        const manual = techniqueCeiling(cultivator.realmOrdinal, terms.techniqueCap);
        const eligibility = canAttemptBreakthrough(cultivator);
        const where = standingOf(cultivator);
        const region = requireRegion(where.regionId);

        // The seat, read off the same two functions `handlePromote` gates on.
        // Absent for somebody who serves nobody, which is not a gate - it is
        // the ordinary condition of most people alive.
        let seat: SeatStanding | null = null;
        const membership = this.repos.sects.getMembership(cultivator.id);
        if (membership) {
            const sect = this.repos.sects.getById(membership.sectId);
            if (sect) {
                const next = membership.rankIndex + 1;
                const atTop = next >= sect.ranks.length;
                seat = {
                    sectName: sect.name,
                    rankTitle: membership.rankTitle,
                    nextRankTitle: atTop ? null : sect.ranks[next],
                    requiredOrdinal: atTop
                        ? 0
                        : requiredOrdinalForRank(sect.admissionOrdinal, next),
                    requiredContribution: atTop ? 0 : requiredContributionForRank(next),
                    contribution: membership.contribution
                };
            }
        }

        const read = whyProgressHasStopped({
            name: cultivator.name,
            ordinal: cultivator.realmOrdinal,
            manual,
            manualCap: terms.techniqueCap,
            regionName: region.name,
            localCeilingOrdinal: region.localCeilingOrdinal,
            canAdvanceHere: canAdvanceHere(where.regionId, cultivator.realmOrdinal),
            ambient,
            seat,
            progressRequired: eligibility.progressRequired,
            progressAvailable: eligibility.progressAvailable,
            eligible: eligibility.eligible,
            yearsAtCurrentRealm: cultivator.yearsAtCurrentRealm,
            stagnationYears: stagnationYearsForOrdinal(cultivator.realmOrdinal)
        });

        const facts = factsForToolResult(read.headline, read.lines);
        facts.structure.push(...read.structure);
        // A hard gate is exactly the kind of fact `required` was built for: the
        // measured failure was a model receiving "without a manual there is no
        // road for the qi to take" inside a long digest and dropping it, after
        // which a cultivator sat for fifty years and was never told why.
        if (read.required.length > 0) facts.required = read.required;

        const execution = this.freeAction(run, 'ceiling', facts);
        execution.calls = [{
            name: 'engine.whyProgressHasStopped',
            action: 'ceiling',
            summary:
                `${read.gates.length} gate(s) read, `
                + `${read.gates.filter(g => g.hard).length} hard. `
                + `Every figure restated from techniqueCeiling, canAdvanceHere, `
                + `requiredOrdinalForRank, canAttemptBreakthrough and `
                + `stagnationYearsForOrdinal. Nothing computed here.`,
            ok: true
        }];
        return execution;
    }

    /**
     * Who stands above them and would teach, said only of people they know of.
     *
     * Two populations, joined and then gated the same way:
     *
     *   THE ROLL   `rosterFor` returns the house's catalog roster with `known`
     *              already resolved against the knowledge rows, plus the
     *              `master` role and the three teaching limits.
     *   THE ROOM   `present()` is who is physically here, which includes
     *              people from no house at all. Gated on `isAwareOf`, the same
     *              predicate `company()` uses for a face in a square.
     *
     * Somebody in both is reported once, from the roster, because the roster
     * row carries strictly more - and `here` is set from the room, so "they
     * are here" is a fact about the present rather than about the catalog.
     */
    private teacher(run: Run, cultivator: Cultivator): Execution {
        const inTheRoom = new Map(this.present(cultivator).map(row => [row.id, row]));
        const above: SomebodyAbove[] = [];
        const counted = new Set<string>();

        const deps = { repos: this.repos, knowledge: this.knowledge, world: this.atHand };
        const membership = this.repos.sects.getMembership(cultivator.id);
        // The catalog rows behind the roster, indexed once. `rosterFor` carries
        // the role and `teaching.knows`; the other two limits and the seat
        // title are only on the catalog entry, and reading them per person
        // through `getMembersOf` was a scan of the whole house per member.
        const catalog = new Map(
            getMembersOf(membership?.sectId ?? '').map(m => [m.id, m])
        );

        for (const person of rosterFor(deps, cultivator)) {
            if (person.id === cultivator.id) continue;
            if (person.realmOrdinal <= cultivator.realmOrdinal) continue;
            counted.add(person.id);
            const member = catalog.get(person.id);
            above.push({
                // The gate. A roster row is not permission to say a name.
                name: person.known ? person.name : null,
                realmOrdinal: person.realmOrdinal,
                rankTitle: person.known ? (member?.rank ?? null) : null,
                willTeach: person.role === 'master',
                // The three limits stay separate - merging them is how a
                // master becomes an oracle. Null when they are not one.
                knows: person.known ? (member?.teaching?.knows ?? null) : null,
                mayNotSay: person.known ? (member?.teaching?.mayNotSay ?? null) : null,
                costsThem: person.known ? (member?.teaching?.costsThem ?? null) : null,
                here: inTheRoom.has(person.id)
            });
        }

        // Anybody standing here who is not on the roll. A wanderer four rungs
        // up is as real a teacher as an elder, and a rogue cultivator has no
        // roster to read at all - which is most of the reason this half exists.
        for (const [id, row] of inTheRoom) {
            if (counted.has(id)) continue;
            if (row.realmOrdinal <= cultivator.realmOrdinal) continue;
            above.push({
                name: this.knowledge.isAwareOf(cultivator.id, 'cultivator', id)
                    ? row.name
                    : null,
                realmOrdinal: row.realmOrdinal,
                rankTitle: null,
                // Nothing on the roster row says they teach, and this layer
                // will not guess. `willTeach` is a catalog fact or it is false.
                willTeach: false,
                knows: null,
                mayNotSay: null,
                costsThem: null,
                here: true
            });
        }

        above.sort((a, b) =>
            Number(b.willTeach) - Number(a.willTeach)
            || Number(b.here) - Number(a.here)
            || a.realmOrdinal - b.realmOrdinal);

        const terms = this.rateTermsFor(cultivator);
        const read = whoWouldTeach({
            name: cultivator.name,
            ordinal: cultivator.realmOrdinal,
            placeName: placeName(cultivator),
            sectName: membership
                ? this.repos.sects.getById(membership.sectId)?.name ?? null
                : null,
            above,
            manualState: techniqueCeiling(cultivator.realmOrdinal, terms.techniqueCap).state
        });

        const facts = factsForToolResult(read.headline, read.lines);
        facts.structure.push(...read.structure);

        const execution = this.freeAction(run, 'teacher', facts);
        execution.calls = [{
            name: 'engine.whoWouldTeach',
            action: 'teacher',
            summary:
                `${above.length} above this cultivator, ${read.nameable} of them nameable. `
                + `Every name gated on isAwareOf; the rest reported as a count and an `
                + `altitude. Teaching limits read from members.ts, never composed.`,
            ok: true
        }];
        return execution;
    }

    /**
     * Where they could go, priced, with the qi and the province's ceiling.
     *
     * The discovery gate here is `canPointAt` rather than `isAwareOf`, and the
     * difference is the whole point: `REACHABLE_FROM` is `placed`, and a name
     * caught through a wall is a name and not a destination. `somewhereReal`
     * already applies exactly this predicate when the player tries to TRAVEL
     * to a place, so listing on any looser rule would advertise destinations
     * the move verb would then refuse.
     *
     * The names below `placed` are counted and never listed. Listing them would
     * quietly promote a whisper into a road and spend a discovery the player
     * was supposed to earn.
     */
    private destinations(run: Run, cultivator: Cultivator): Execution {
        const here = standingOf(cultivator);
        const fromRegion = requireRegion(here.regionId);

        // What it costs to reach each other province, off the region's own
        // `connections`. Absent means no stated road, which is a real state.
        const cost = new Map<string, number>();
        for (const link of fromRegion.connections) {
            const known = cost.get(link.otherRegionId);
            if (known === undefined || link.travelDays < known) {
                cost.set(link.otherRegionId, link.travelDays);
            }
        }

        const reachable: Destination[] = [];
        let unplaceable = 0;

        // ── ONE ROW PER PLACE, WHATEVER TAG IT ARRIVED UNDER ─────────────
        //
        // A place can hold TWO knowledge records under two different ids and
        // one display name: the catalog's own id, and the world location row
        // the seeder wrote for the same ground. `awareness` dedupes by
        // `claim_key`, which is correct at its own level and is not a dedupe
        // by PLACE - so `exists:place:the-dead-verge` and
        // `exists:place:loc-region-quiet-marches-the-dead-verge` are two rows,
        // both resolve to the same catalog place, and both were pushed.
        //
        // Reproduced before fixing, on an ordinary opening turn: two of seven
        // destinations were emitted twice, byte-identical, in the prose AND on
        // the engine channel - "The Dead Verge" and "The Gapwater face". The
        // quiet-ground loop below already guarded against this for its own
        // rows; nothing guarded the two loops above it.
        //
        // First writer wins, which is the catalog row: it carries the authored
        // `kind` and the region the place actually sits in.
        const remember = (destination: Destination): void => {
            const key = loosePlaceKey(destination.name);
            if (reachable.some(row => loosePlaceKey(row.name) === key)) return;
            reachable.push(destination);
        };

        for (const row of this.knowledge.awareness(cultivator.id, 'place')) {
            if (!this.knowledge.canPointAt(cultivator.id, 'place', row.id)) {
                unplaceable++;
                continue;
            }
            const wanted = loosePlaceKey(row.name);

            // A PROVINCE, which is the scale the catalog actually prices. This
            // half was missing from the first build and it was the whole of the
            // travel answer: "The Low Fall" and "The Drowned Reach" are names
            // in the knowledge table like any other, they are the only names
            // with a stated `travelDays` beside them, and looking up
            // settlements only dropped every one of them on the floor. The
            // read listed five towns in the player's own province, each of them
            // zero days away, and the cost map below never once returned a row.
            const province = REGIONS.find(region => loosePlaceKey(region.name) === wanted);
            if (province) {
                remember({
                    name: province.name,
                    kind: 'province',
                    // Deliberately null. A region's `ambientProfile` is a
                    // distribution across its settlements, and flattening it to
                    // one band would state a fact about ground nobody has stood
                    // on. The settlements inside it carry their own.
                    ambient: null,
                    regionName: province.name,
                    travelDays: province.id === fromRegion.id
                        ? null
                        : cost.get(province.id) ?? null,
                    localCeilingOrdinal: province.localCeilingOrdinal,
                    hereNow: false,
                    sameProvince: province.id === fromRegion.id,
                    // A province is a container; nobody stands in one, so there
                    // is no occupancy to report and inventing an average across
                    // its settlements would be the same error as flattening
                    // their ambient bands.
                    occupants: null,
                    supportedDraw: null
                });
                continue;
            }

            // A SETTLEMENT. A place the player has a record for that the
            // catalog does not describe is skipped rather than guessed at:
            // this read prices roads, and it has no price for somewhere it
            // cannot find.
            const found = REGIONS
                .flatMap(region => region.places.map(place => ({ region, place })))
                .find(candidate => loosePlaceKey(candidate.place.name) === wanted);
            if (!found) continue;

            remember({
                name: found.place.name,
                kind: found.place.kind,
                ambient: found.place.ambient,
                regionName: found.region.name,
                // Never zero for "somewhere in this province". Nothing in the
                // catalog prices a road between two settlements of one region,
                // and a fabricated zero is a number a player plans around.
                travelDays: found.region.id === fromRegion.id
                    ? null
                    : cost.get(found.region.id) ?? null,
                localCeilingOrdinal: found.region.localCeilingOrdinal,
                hereNow: wanted === loosePlaceKey(cultivator.location ?? ''),
                sameProvince: found.region.id === fromRegion.id,
                ...this.occupancyOf(found.place.name)
            });
        }

        // ── GROUND THAT IS NOT A TOWN ────────────────────────────────────
        //
        // The read listed settlements and nothing else, so a player asking
        // where they could go was answered with the two market towns they had
        // names for - both crowded, both thin - while a DENSE vein with nobody
        // on it sat in the same province. Measured on a live world: 34 caves,
        // wilds and veins, all of them already `discovered` by the world, 31 of
        // them with zero occupancy, the best at qiDensity 70 against a
        // settlement's 35.
        //
        // Nothing was stopping the player travelling there either - `move`
        // accepts any world location by name, and has all along. They were
        // simply never told the names, so "I look for a quiet cave in the
        // mountains" and "I seek an uninhabited place to cultivate" both
        // reached nothing and the busiest ground in the world stayed the only
        // ground they could name.
        //
        // Own province only, and only what the world has already discovered.
        // This is local geography - a farm boy knows where the caves are - and
        // not the hard discovery that finding a lone rich cave is meant to be.
        //
        // ── AND IT IS STILL GATED, WHICH IT WAS NOT ──────────────────────
        //
        // "A farm boy knows where the caves are" is a reason to GRANT a record,
        // not a reason to skip the gate, and this loop read the world's own
        // location table straight into a player-facing list with no knowledge
        // check anywhere in it. `seedTheGroundAroundHome` grants the ordinary
        // ground at birth so the farm boy keeps his caves; everything else has
        // to be learned like anything else.
        //
        // Measured before this: a fresh cultivator holding no record for any of
        // them was handed The Glass Field and The Nine-City Assize by name.
        // Those are DAO GROUNDS - `how-a-cultivator-comes-by-a-road.ts` seeds
        // its `open` catalog rows as ordinary `wilds`, discovered - and this
        // read was the only place in the game they appear at all, ungated,
        // stripped of everything that makes them what they are. The same hole
        // would have handed over any prospected find that landed on one of
        // these three kinds.
        //
        // The gate is `canPointAt`, the same predicate the rest of this read
        // and `foundGroundIn` already use. Default-deny: the loop asks whether
        // this cultivator can point at the row, rather than asking whether the
        // row is one of the kinds somebody remembered to exclude.
        let unnamed = 0;
        for (const record of this.quietGroundIn(fromRegion.name)) {
            // Named already, under its catalog id. Checked before the gate so
            // that a place already on the list is not also counted as ground
            // the world holds and this cultivator cannot point at.
            if (reachable.some(row => loosePlaceKey(row.name) === loosePlaceKey(record.name))) continue;
            if (!this.canPointAtLocation(cultivator, record)) {
                unnamed++;
                continue;
            }
            remember({
                name: record.name,
                kind: record.kind,
                ambient: ordinaryBandFor(record.qiDensity),
                regionName: fromRegion.name,
                travelDays: null,
                localCeilingOrdinal: fromRegion.localCeilingOrdinal,
                hereNow: loosePlaceKey(record.name) === loosePlaceKey(cultivator.location ?? ''),
                sameProvince: true,
                ...this.occupancyOf(record.name)
            });
        }

        // ── AND THE GATES ────────────────────────────────────────────────
        //
        // Same gate, same shape, different half of the map. A house's ground is
        // where the people worth asking actually stand - measured on 5 seeds,
        // every one of the 88 cultivators at Foundation Establishment and above
        // is on one - and until it appeared here the read that answers "where
        // can I go" could not name a single one of the 34.
        //
        // Counted into `unnamed` when the gate refuses, exactly like quiet
        // ground. That counter reaches the engine channel and never the prose,
        // which is right: `unplaceable` is the player-facing "and two further
        // names you cannot place", and it is about names they HOLD. A gate they
        // have never been told about is not a name they are carrying, and
        // saying "there are eight things here you cannot see" would advertise
        // the discovery instead of gating it.
        for (const record of this.housesWithGroundIn(fromRegion.name)) {
            if (reachable.some(row => loosePlaceKey(row.name) === loosePlaceKey(record.name))) continue;
            if (!this.canPointAtLocation(cultivator, record)) {
                unnamed++;
                continue;
            }
            remember({
                name: record.name,
                kind: record.kind,
                ambient: ordinaryBandFor(record.qiDensity),
                regionName: fromRegion.name,
                travelDays: null,
                localCeilingOrdinal: fromRegion.localCeilingOrdinal,
                hereNow: loosePlaceKey(record.name) === loosePlaceKey(cultivator.location ?? ''),
                sameProvince: true,
                ...this.occupancyOf(record.name)
            });
        }

        const read = whereCouldTheyGo({
            ordinal: cultivator.realmOrdinal,
            placeName: placeName(cultivator),
            regionName: fromRegion.name,
            localCeilingOrdinal: fromRegion.localCeilingOrdinal,
            reachable,
            unplaceable
        });

        const facts = factsForToolResult(read.headline, read.lines);
        facts.structure.push(...read.structure);

        const execution = this.freeAction(run, 'destinations', facts);
        execution.calls = [{
            name: 'engine.whereCouldTheyGo',
            action: 'destinations',
            summary:
                `${reachable.length} place(s) this cultivator can point at, `
                + `${unplaceable} name(s) held and unplaceable, `
                + `${unnamed} piece(s) of ground in this province held by the world and `
                + `not by them. Gated on canPointAt, the same predicate the move verb `
                + `enforces. Travel days off region connections; qi bands off the region `
                + `catalog.`,
            ok: true
        }];
        return execution;
    }

    // ─────────────────────────────────────────────────────────────────────
    // WHAT IS LIVE STANDING HERE
    //
    // The fourth question, and it turned out to be the one a new player asks
    // first: not "why am I stuck" but "what are the kinds of thing I can do
    // at all". Found by playing a full run in the browser, where `help` and
    // `what can I do` - the two most universal inputs in the history of text
    // games - both landed on the unclear refusal while a dozen good verbs sat
    // one guess away.
    //
    // Nothing below computes an outcome. It is a GATHERING, in the same shape
    // as `ceiling`, `teacher` and `destinations` above it: six facts this
    // class already reads for other purposes, handed to a pure function that
    // holds no thresholds of its own beyond the schema's. See
    // `what-is-worth-doing-standing-here.ts` for what it may and may not say.
    // ─────────────────────────────────────────────────────────────────────

    /**
     * The state that decides what is worth offering, as scalars.
     *
     * Every field is read through the function that already owns it -
     * `techniqueCeiling` for the road, `medicineReaches` for what a physician
     * can close, `canAttemptBreakthrough` for the crossing - so this cannot
     * disagree with the verb it points at. A second opinion about whether a
     * wound is treatable would be a second medicine system.
     *
     * Cheap enough to run on every state read: one pouch query, one roster
     * read that is already in hand, and arithmetic.
     */
    private whatIsLiveHere(
        cultivator: Cultivator,
        ambient: AmbientQi,
        run: Run
    ): StandingHere {
        const terms = this.rateTermsFor(cultivator);
        const road = techniqueCeiling(cultivator.realmOrdinal, terms.techniqueCap);

        const hurt = untreatedInjuries(cultivator.injuries);
        const mendable = hurt.filter(injury => !isPermanentWound(injury.woundType));

        return {
            satiety: cultivator.satiety,
            starvationTurns: cultivator.starvationTurns,
            // The engine's own clock, which folds in the realm's burn
            // multiplier and the grace after the belly empties. Dividing
            // satiety by the per-action cost here would be a second, wrong
            // hunger model living beside the real one.
            turnsUntilStarvation: turnsUntilStarvation(
                { satiety: cultivator.satiety, starvationTurns: cultivator.starvationTurns },
                cultivator.realmOrdinal
            ),
            spiritStones: cultivator.spiritStones,
            mealCost: MEAL_COST_STONES,
            treatableWounds: mendable.filter(injury =>
                medicineReaches('mortal', injury.severity, cultivator.realmOrdinal)).length,
            woundsPastMortalCare: mendable.filter(injury =>
                !medicineReaches('mortal', injury.severity, cultivator.realmOrdinal)).length,
            cure: whatWouldCloseThisWound(
                hurt,
                cultivator.realmOrdinal,
                cultivator.spiritStones,
                // The province they are standing in, so the panel quotes the
                // figure `buy` will charge rather than the board's base.
                standingOf(cultivator).regionId
            ),
            battered: cultivator.hp < cultivator.maxHp,
            practisesAMethod: road.state !== 'no_method',
            methodExhausted: road.state === 'exhausted',
            breakthroughReady: canAttemptBreakthrough(cultivator).eligible,
            inASect: this.repos.sects.getMembership(cultivator.id) !== null,
            sellableGoods: listPouch(this.db, cultivator.id).length,
            peopleAboveHere: this.present(cultivator)
                .filter(row => row.realmOrdinal > cultivator.realmOrdinal).length,
            thinGround: ambient === 'thin',
            aboveTheLid: canExistBeyondTheLid(cultivator),
            // The one entry here that is gone next turn whatever happens. See
            // the field's note in the affordance module for why it is offered
            // ahead of the body, which nothing else is.
            brokenSeclusion: stillStands(this.crossroads, run.id, cultivator)
                ? {
                    daysRemaining: this.crossroads.daysRemaining,
                    canWithdraw: this.crossroads.canWithdraw
                }
                : null
        };
    }

    /**
     * The same list, for the sheet.
     *
     * On the state payload rather than only in narration because the player
     * who most needs it is the one who has not thought to ask: the run that
     * found this pressed Cultivate, because it was the only obvious control on
     * the screen, and died. Two or three of these beside it are the difference
     * between a trap and a decision.
     *
     * Never throws and never blocks a state read. A sheet that fails to render
     * because the suggestion list could not be built would be a far worse bug
     * than the one this fixes, and `present()` in particular depends on a world
     * that a bare state read may not have loaded.
     */
    private affordancesFor(cultivator: Cultivator, run: Run): Affordance[] {
        try {
            return whatIsWorthDoingStandingHere(
                this.whatIsLiveHere(cultivator, this.ambientFor(cultivator, run), run)
            );
        } catch {
            return [];
        }
    }

    /**
     * `help`, `what can I do`, and everything that means them.
     *
     * Free, and that is load-bearing for the same reason `ceiling` is free: a
     * player who is charged a turn to ask what their options are will stop
     * asking, and this is the one read a player in trouble asks repeatedly.
     *
     * It is deliberately situated rather than a catalog. A fixed command list
     * would flatten the whole character of the game, which is that you say
     * what you do in your own words; what comes back is the handful of things
     * that are live in THIS state, so the player learns the shape of the space
     * and then phrases it themselves.
     */
    private guidance(run: Run, cultivator: Cultivator, ambient: AmbientQi): Execution {
        const here = this.whatIsLiveHere(cultivator, ambient, run);
        const live = whatIsWorthDoingStandingHere(here);

        const standing =
            `${placeName(cultivator)}, at ${rankName(cultivator.realmOrdinal)}. `
            + 'What is live for you here:';
        const facts = factsForToolResult(
            `${placeName(cultivator)} at ${rankName(cultivator.realmOrdinal)}: `
            + `${live.length} thing(s) live.`,
            [standing, ...linesFor(live)],
            // The closing line is not decoration. It is the difference between
            // a prompt and a menu, and a player who reads this as the list of
            // accepted commands has learned the wrong game.
            [
                standing,
                linesFor(live).map(line => `  ${line}`).join('\n'),
                'That is not a list of what you may say. It is what is live standing here. '
                + 'Say what you actually mean to do, in your own words, and find out what '
                + 'it costs.'
            ].join('\n\n')
        );
        facts.structure.push(
            `${live.length} thing${live.length === 1 ? ' is' : 's are'} live standing here, `
            + `${live.filter(a => a.urgency === 'now').length} of them pressing. Satiety `
            + `${here.satiety} of 100, ${here.spiritStones} spirit stones, `
            + `${here.treatableWounds} wound${here.treatableWounds === 1 ? '' : 's'} a `
            + `physician could still close and ${here.woundsPastMortalCare} past what mortal `
            + `care reaches. `
            + (here.practisesAMethod
                ? (here.methodExhausted
                    ? 'The method being practised has stopped carrying them.'
                    : 'The method being practised is still carrying them.')
                : 'No method is being practised at all.')
        );

        const execution = this.freeAction(run, 'unclear', facts);
        execution.calls = [{
            name: 'engine.whatIsWorthDoingStandingHere',
            action: 'help',
            summary: live.map(a => `${a.urgency}:${a.id}`).join(', '),
            ok: true
        }];
        return execution;
    }

    /**
     * A manual's real ceiling for this holder, stages and volumes folded in.
     *
     * The single place this layer is allowed to answer "how far does this book
     * carry them". Never `manual.cap`: that is the CATALOG's ceiling and it
     * stops being the manual's real one the moment anybody writes a stage.
     */
    private reachOf(
        cultivator: Cultivator,
        art: { id: string; name: string; cap?: number | null; volumes?: readonly string[] | null }
    ) {
        const manual = {
            id: art.id,
            name: art.name,
            cap: art.cap ?? capOf(art as never),
            volumes: art.volumes ?? null
        };
        const held = effectiveCapOf(
            manual,
            wholeWorkVolumes(art),
            stagesHeldBy(this.repos, cultivator.id, art.id)
        );

        // TWO DIFFERENT NUMBERS, and they need two calls.
        //
        // `EffectiveCap.writtenTo` is computed from the count it was GIVEN, so
        // handing it this holder's stages makes both fields the holder's and
        // the world's ceiling never appears. The world's is `writtenTo` over
        // the row count, which is what `stagesWrittenSince` is for - and the
        // gap between them is the sentence worth having: it goes further than
        // you can follow it.
        return {
            ...held,
            worldWrittenTo: writtenTo(manual, stagesWrittenSince(this.repos, art.id))
        };
    }

    /**
     * What standing between this cultivator and one named book actually is.
     *
     * The answer to a QUESTION about learning, and it changes nothing. Returns
     * null when the name is not an art at all, so the caller falls through to
     * the listing rather than refusing a sentence it merely failed to resolve.
     *
     * Every line is a restatement of something the engine already computed:
     * the rung the book opens at, what a stall asks for a copy, whether one is
     * already held, and how many houses teach it. Nothing here decides
     * anything - that is `handleLearn`'s - which is what keeps the answer to
     * "may I" and the answer to "I do" from drifting apart.
     */
    private whatItWouldTake(
        run: Run,
        cultivator: Cultivator,
        query: string
    ): Execution | null {
        const art = resolveTechnique(this.repos, query, cultivator.id);
        if (!art) return null;
        const catalog = getTechnique(art.id);
        if (!catalog) return null;

        const lines: string[] = [];
        const cap = catalog.cap ?? capOf(catalog as never);
        lines.push(
            `${catalog.name} opens at ${rankName(catalog.requiredOrdinal)}`
            + (classOf(catalog) === 'cultivation'
                ? cap === null
                    ? ' and carries a cultivator the whole way.'
                    : ` and carries a cultivator as far as ${rankName(cap)}.`
                : '. It carries nobody anywhere; it is an art, not a road.')
        );
        if (catalog.requiredOrdinal > cultivator.realmOrdinal) {
            lines.push(
                `You stand at ${rankName(cultivator.realmOrdinal)}, which is `
                + `${catalog.requiredOrdinal - cultivator.realmOrdinal} rung(s) under it. `
                + 'Nothing about the book changes that; you do.'
            );
        }

        if (this.repos.techniques.knows(cultivator.id, art.id)) {
            lines.push('You already practise it. What is left is mastery, and that is sitting with it.');
        } else if (holdsACopyOf(this.db, cultivator.id, art.id)) {
            lines.push('The copy is already yours. Nothing stands between you and it but the work.');
        } else {
            const stall = stallPriceStones(art.id);
            const house = cultivator.sectId ? getSect(cultivator.sectId) : undefined;
            if (house?.teaches.includes(art.id)) {
                lines.push(`${house.name} teaches it, which is what wearing their colours buys.`);
            } else if (stall !== null) {
                lines.push(
                    `A stall sells a copy for about ${stall} spirit stone`
                    + `${stall === 1 ? '' : 's'}. You are carrying ${cultivator.spiritStones}`
                    + (cultivator.spiritStones >= stall
                        ? ', so it is a decision rather than a wish. What the stones do not then '
                          + 'buy is the food.'
                        : `, which is ${stall - cultivator.spiritStones} short.`)
                );
            } else {
                const taughtBy = getSectsTeaching(art.id).length;
                lines.push(
                    'Nobody sells it. '
                    + (taughtBy > 0
                        ? `${taughtBy} house${taughtBy === 1 ? '' : 's'} teach${taughtBy === 1 ? 'es' : ''} `
                          + 'it, to their own, and being one of their own is the whole of the price.'
                        : 'No house is known to teach it either, so what is left is finding a copy '
                          + 'somewhere nobody has been.')
                );
            }
        }

        const facts = factsForToolResult(`${catalog.name}, and what stands in the way.`, lines);
        facts.structure.push(
            `${catalog.name} opens at ${rungAndOrdinal(catalog.requiredOrdinal)} and `
            + `${cap === null || cap === undefined
                ? 'nothing caps how far this cultivator may be taught'
                : `this cultivator may be taught no further than ${rungAndOrdinal(cap)}`}. `
            + `${isSoldAtAStall(art.id) ? 'A stall sells it' : 'No stall sells it'}, and `
            + `${holdsACopyOf(this.db, cultivator.id, art.id)
                ? 'they already hold a copy'
                : 'they hold no copy'}. `
            + 'Reading this cost nothing: no time passed, nothing spent, nothing learned.'
        );
        return this.freeAction(run, 'list_techniques', facts);
    }

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
            compatible.length === 0 && conflicting.length === 0
                ? 'Nothing within reach.'
                : `${compatible.length + conflicting.length} art(s) you could be taught.`,
            lines
        );
        facts.structure.push(
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

        const result = await handleLearn({
            action: 'learn',
            techniqueId: technique.id,
            cultivatorId: cultivator.id
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

        const describe = (offer: DutyCandidate): string =>
            `${offer.entry.name}: ${humanDays(offer.terms.days)}, `
            + `${offer.terms.contribution} contribution and ${offer.terms.stones} spirit stone`
            + `${offer.terms.stones === 1 ? '' : 's'} on completion`
            + (offer.terms.cohort > 0 ? `, with ${offer.terms.cohort} of the house alongside` : '')
            + '.';

        // ── the wall, read ──
        if (wanted.length < 3 || GameService.BOARD_IN_GENERAL.test(wanted)) {
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
            execution.facts.lines.push(settled.line);
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
        } else {
            const walked = refuseDuty({ ...settlement, outcome: 'failed' });
            execution.facts.lines.push(walked.line);
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

    /**
     * A phrase that names a HEIGHT rather than a person.
     *
     * "somebody of my own realm", "a disciple of my rank", "someone my equal" -
     * all of them are a request for a fair fight rather than for a particular
     * body, and answering them with whoever happened to be nearest is what made
     * every duel in the game either suicide or a refusal.
     *
     * Deliberately requires the possessive or the word `equal`: "a Nascent Soul
     * cultivator" names a height too and names a DIFFERENT one, and must go on
     * resolving the way it always has.
     */
    private static readonly SOMEBODY_OF_MY_OWN_HEIGHT =
        /\b(?:my (?:own )?(?:realm|rank|rung|level|height|standing)|my equal|an equal|someone equal|of equal (?:rank|realm)|the same (?:realm|rank|rung) as me|my own kind)\b/i;

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
    private rateTermsFor(cultivator: Cultivator): {
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
    private occupancyOf(name: string): { occupants: number | null; supportedDraw: number | null } {
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
    private quietGroundIn(regionName: string): LocationRecord[] {
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
    private housesWithGroundIn(regionName: string): LocationRecord[] {
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
    private canPointAtLocation(cultivator: Cultivator, record: LocationRecord): boolean {
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

    /**
     * An attempt to move somebody, resolved rather than described.
     *
     * `engine/social-leverage/` has been finished and unreachable: a pressure
     * model with four outcomes - taken, refused, reported, turned - tone,
     * leverage, audience, concealment, patience, alignment-dependent fallout
     * and delayed discovery, with 34 passing tests and no player route into it.
     * NPCs ran it on each other while "I bribe the gate guard" came back "they
     * look at you the way people look at a sentence with a hole in it".
     *
     * Three things this has to get right, all learned elsewhere the hard way:
     *
     *   THE DAYS REACH THE CLOCK. An attempt that costs nothing is not play,
     *   and `result.days` is the engine's own figure for what it took.
     *   THE TERMS REACH THE INSPECTOR. `result.terms` is the only thing that
     *   will ever reveal that a term has gone wrong.
     *   THE OUTCOME REACHES THE PROSE. A `turned` result coming back as "It is
     *   done. Nothing about it drew attention." is the invisible-fallback
     *   failure this codebase has now had four times.
     *
     * The ask is read from the player's sentence and defaults to `a_courtesy`,
     * which is the forgiving direction: assuming somebody asked for a betrayal
     * when they asked for directions would price an afternoon as a season.
     */
    private async pressSomebody(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        party: ResolvedEntity,
        intent: string,
        leverage: ApproachLeverage | undefined,
        rawInput: string,
        spoken: Hearing | null
    ): Promise<Execution> {
        const them = party.party!;
        const membership = this.repos.sects.getMembership(cultivator.id);
        const mySect = membership ? this.repos.sects.getById(membership.sectId) : null;
        const theirSect = them.factionId ? getSect(them.factionId) : null;

        // ── A BRIBE IS A NUMBER ──────────────────────────────────────────
        //
        // Measured in play: "I bribe Kong Kelin" came back "Kong Kelin agreed.
        // It was taken." with the purse at 6043 before and 6043 after. Nothing
        // was named, nothing was priced, nothing moved. That is the softening
        // the agency rule forbids and it is the invisible kind - the player
        // believes they spent something.
        //
        // The resolver's own contract has carried `stonesOffered` from the
        // start, documented as "spirit stones actually put down. Only spent
        // when the attempt lands", and this caller never filled it. So the sum
        // comes off the player's own sentence, which is where it belongs: what
        // somebody is willing to put down is a decision and not a derivation,
        // and an engine that picked a figure would be choosing for them.
        //
        // Not banning. A coin approach with no sum in it is a sentence with a
        // hole in it, and the refusal names the hole and the purse rather than
        // shrugging - the same shape as every other guiding refusal here.
        const offered = leverage === 'coin' ? stonesNamedIn(rawInput) : null;
        if (leverage === 'coin' && offered === null) {
            return refused('engine.resolveAttempt', 'interact', factsForRefusal(
                'You did not say how much.',
                `You get as far as suggesting there is money in it and then find you have not `
                + `decided on a figure, which ${party.name} notices before you do. A bribe is a `
                + `number said out loud. You are carrying ${cultivator.spiritStones} spirit `
                + 'stones; say what you are putting down.',
                `Coin leverage with no sum in the sentence. resolveAttempt.stonesOffered is `
                + '"spirit stones actually put down"; without one the attempt would resolve at '
                + 'full odds and charge nothing, which is what it did for as long as this '
                + 'caller left the field unset.'
            ));
        }
        if (offered !== null && offered > cultivator.spiritStones) {
            return refused('engine.resolveAttempt', 'interact', factsForRefusal(
                'You do not have it.',
                `The figure is out of your mouth before you have counted it. You said ${offered} `
                + `and you are carrying ${cultivator.spiritStones}, which leaves you `
                + `${offered - cultivator.spiritStones} short of what you have just promised. `
                + `${party.name} waits for the rest of it and then stops waiting.`,
                `Offered ${offered} against a purse of ${cultivator.spiritStones}. Refused before `
                + 'the resolver, so no days were spent and no mark was written.'
            ));
        }

        const result = resolveAttempt({
            actor: {
                id: cultivator.id,
                name: cultivator.name,
                ordinal: cultivator.realmOrdinal,
                charm: cultivator.attributes.charm,
                factionId: membership?.sectId ?? null,
                alignment: mySect?.alignment ?? null,
                ranked: membership !== null
            },
            subject: {
                id: party.id,
                name: party.name,
                ordinal: them.realmOrdinal,
                ...(them.charm === undefined ? {} : { charm: them.charm }),
                factionId: them.factionId,
                alignment: theirSect?.alignment ?? null,
                ranked: them.ranked
            },
            onDay: Math.floor(run.elapsedDays),
            // The same three terms `request` supplies, for the same reason: a
            // bribe from somebody who has done you a favour is not the same
            // sentence as a bribe from a stranger, and until these were passed
            // the engine could not tell the two apart.
            theirTie: tieFrom(this.repos, party.id, cultivator.id),
            yourTie: tieFrom(this.repos, cultivator.id, party.id),
            ledger: openLedgerBetween(this.repos, cultivator.id, party.id),
            ask: askWeightOf(rawInput),
            ...(offered === null ? {} : { stonesOffered: offered }),
            approach: {
                // The player's own words, recorded and echoed, never parsed for
                // an outcome. `leverage` is what the resolver actually reads.
                intent: rawInput.slice(0, 400),
                ...(leverage ? { leverage } : {})
            },
            // The row id is a randomUUID; keying on it would make the run
            // irreproducible from its seed. See PLAYER_ROLL_IDENTITY.
            rng: forStream(run.seed, 'social_leverage', Math.floor(run.elapsedDays), party.id)
        });

        // AND THE MONEY IS REAL. The resolver's contract is that stones are
        // spent only when the attempt LANDS - somebody who refuses you does not
        // keep the purse - so this is the one write and it is on `stonesSpent`
        // rather than on what was offered, because those two are the same
        // number only on a take and the resolver owns the difference.
        if (result.stonesSpent > 0) {
            this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -result.stonesSpent });
        }

        // THE DAYS ARE REAL. Pressing somebody for a betrayal is a season and a
        // half of work, and an attempt that costs no time is not a decision.
        // Run through `shortSkip` rather than by adding to a counter, so the
        // food, the world and the bleed clock all move the way they move for
        // every other span in the game.
        const spent = await this.shortSkip(
            run, cultivator, ambient, TRAVEL_FOCUS, `Pressing ${party.name}`, result.days
        );

        const marks = this.recordWhatTheAskLeft(run, cultivator, party, result, 'interact').calls;

        const facts = factsForAttempt(cultivator, party.name, intent, result, party.facts);
        if (spoken) addHearing(facts, spoken);

        // ── AND WHAT, EXACTLY, DID THEY AGREE TO ─────────────────────────
        //
        // Measured: `I bribe Han Peiru with 60 spirit stones` came back "Han
        // Peiru agreed." - agreed to WHAT, and nothing followed. The resolver
        // is right not to know; it prices the weight of an ask and must never
        // read the player's verb. What was missing is that the sentence never
        // said. `request` is the verb that carries an object, so a sentence
        // that reaches HERE is one that put something on the table and named
        // nothing to spend it on, and the honest answer is to say so and say
        // what the sentence with an object looks like.
        //
        // A line and not a refusal. `AGENTS.md` forbids the removed verb: the
        // approach still happens, the stones still move, and what is added is
        // the thing the player needs in order to ask for something next time.
        if (requestPutToSomebody(rawInput) === null) {
            const unnamed =
                `Nothing was named to go with it, so what ${party.name} agreed to or refused was `
                + `the approach itself. Asking for a thing is "ask ${party.name} to teach me `
                + `<an art>", "ask ${party.name} to introduce me to <somebody>", or "ask `
                + `${party.name} to take me as a disciple" - and those have outcomes this does `
                + 'not.';
            facts.lines.push(unnamed);
            facts.prose = `${facts.prose}

${unnamed}`;
            facts.structure.push(
                'The sentence put leverage on the table and named no object, so `ask` weighed '
                + 'the approach rather than a request. See `request` and '
                + '`what-a-request-asks-and-of-whom.ts`.'
            );
        }
        // The span's own account underneath the attempt's: what the days cost.
        facts.lines.push(...spent.facts.lines);
        facts.structure.push(...spent.facts.structure);

        const execution: Execution = {
            ...spent,
            facts,
            outcome: result.outcome === 'taken' ? 'executed' : 'refused'
        };
        execution.hearing = spoken;
        execution.calls = [
            {
                name: 'engine.resolveAttempt',
                action: 'interact',
                // Every term, named, and named in words. The only thing that
                // will ever reveal that one of them has gone wrong, and it is
                // worth nothing if the person reading it has to know the field
                // names to see it.
                summary: whatTheAskCameTo({
                    subject: party.name,
                    kind: intent,
                    ask: askWeightOf(rawInput),
                    leverage,
                    odds: result.odds,
                    terms: result.terms,
                    outcome: result.outcome,
                    days: result.days,
                    stonesSpent: result.stonesSpent,
                    priorAsks: 0,
                    reachedTheHouse: result.marks.reachedTheHouse
                }),
                ok: result.outcome === 'taken'
            },
            ...structureCalls(party.structure),
            ...spent.calls,
            ...marks
        ];
        return execution;
    }


    // ─────────────────────────────────────────────────────────────────────
    // ASKING A PERSON FOR SOMETHING
    // ─────────────────────────────────────────────────────────────────────

    /**
     * A request put to a person, with an object.
     *
     * THE VERB THE DESIGN RESTS ON, and it did not exist. The engine says,
     * correctly and often, that there are exactly two ways past a manual's
     * ceiling - another book, or somebody willing to teach you - and it says it
     * well: *"You have no name to ask for, which is the whole of what is
     * stopping you"*, *"A book or a teacher is the only thing that does."* The
     * book half works; a common primer costs about eight spirit stones at a
     * stall. The teacher half had no verb at all, and four phrasings of it
     * reached four different lookups, none of which was a person.
     *
     * THREE THINGS THIS HAS TO GET RIGHT.
     *
     *   THE REQUEST HAS AN OBJECT. `resolveAttempt` has always priced the ask
     *   and never known what the ask WAS, so a landed bribe came back as
     *   "Han Peiru agreed." - agreed to what, and nothing followed. What is
     *   being asked for is resolved here, said in the prose, and carried into
     *   the mechanical channel.
     *
     *   A TAKE CHANGES SOMETHING. `handleLearn` has carried
     *   `provenance: 'taught_by_a_person'` since it was written and nothing in
     *   the codebase has ever passed it. This is that caller. A teaching that
     *   lands puts the art on the sheet through the same gate every other route
     *   uses, so being taught is still subject to rank, root, dao and what has
     *   surfaced in this run - `manuals.md`'s two gates and not one: *"rank says
     *   what the house will give you; the manual's own entry requirement says
     *   what you can open, and being favoured does not lift it."*
     *
     *   A REFUSAL NAMES WHAT WOULD WORK. Every one of them, without exception.
     *   `what-asking-this-person-for-this-would-cost-them.ts` owns those
     *   sentences and each carries the next move: what they are actually
     *   carrying, who teaches it, that a stall sells a copy, that an
     *   introduction runs along a line somebody is already standing on.
     */
    private async request(
        run: Run,
        cultivator: Cultivator,
        ambient: AmbientQi,
        target: string | undefined,
        intent: string,
        topic: string | undefined,
        leverage: ApproachLeverage | undefined,
        rawInput: string
    ): Promise<Execution> {
        const scope = this.scopeFor(cultivator);
        const query = (target ?? '').trim();

        // What was asked for. The plan carries it; the sentence is re-read only
        // where the plan came from a model that gave a label and no shape, and
        // for the `weigh` read, which deliberately drops the kind so that the
        // interrogative cannot reach the attempt by carrying it along.
        const reread = requestPutToSomebody(rawInput);
        const weighing = intent === 'weigh';
        const kind: RequestKind = REQUEST_KINDS.has(intent)
            ? intent as RequestKind
            : reread?.kind ?? 'a_thing';
        const named = (topic ?? reread?.object ?? '').trim();

        if (query.length < 2) {
            return refused('engine.resolveParty', 'request', factsForRefusal(
                'Asked of whom?',
                'A request is put to somebody. You have not said who, and there is nobody the '
                + `sentence could have meant. ${this.whoIsAbout(cultivator)}`,
                'Unresolved party: request with no subject named. '
                + `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

        const party = this.partyPutTo(cultivator, query, scope);
        if (!party) return this.nobodyByThatName(cultivator, query, scope, 'request');

        // ── A HOUSE IS NOT A PERSON ──────────────────────────────────────
        //
        // Asking an institution for something is `petition`, which has its own
        // record and its own refusal, and asking one informally is the approach
        // that describes it. Neither is this: `resolveAttempt` prices one person
        // against another, and a faction has no rung, no charm and no afternoon
        // to spend.
        if (party.kind !== 'cultivator' || !party.party) {
            return this.interact(
                run, cultivator, ambient, query, 'negotiate',
                named.length >= 2 ? named : undefined, leverage, rawInput
            );
        }

        this.noteEncounter(
            cultivator, run, party, 'witnessed',
            `Asked for something at ${placeName(cultivator)}.`
        );

        // ── BEING TOLD SOMETHING THEY KNOW ───────────────────────────────
        //
        // Already answered, and answered well: `askAround` reads what this
        // person could know, what they are placed to say and what saying it
        // would cost - `asking.md`'s three limits, all applied at once. Routing
        // here rather than reimplementing it is the point.
        if (kind === 'telling' && named.length >= 2) {
            const who = this.present(cultivator).find(row => row.id === party.id);
            if (who) return this.askAround(run, cultivator, who, named, scope);
        }

        // Asking somebody FOR a named art is asking to be taught it: a copy and
        // an afternoon end in the same place, and `handleLearn` cannot tell them
        // apart either. Anything else that is merely a thing falls back to the
        // approach that already handles it, rather than inventing a way to hand
        // objects over.
        const asArt = named.length >= 2 && kind !== 'nothing'
            ? resolveTechnique(this.repos, named, cultivator.id)
            : null;
        let shape: RequestKind = kind;
        if (kind === 'a_thing' || kind === 'telling') {
            if (asArt) shape = 'teaching';
            else {
                return this.interact(
                    run, cultivator, ambient, query, 'negotiate',
                    named.length >= 2 ? named : undefined, leverage, rawInput
                );
            }
        }

        // ── AND HOW MANY TIMES THEY HAVE HEARD IT ────────────────────────
        //
        // Read before anything is decided, so the outcome can be described as
        // the second time rather than as the first again. Incremented once the
        // attempt is actually made, which is why it is read here and written
        // below rather than in one place.
        // Keyed on the KIND as well as the person, because "they have heard this
        // from you before" is a claim about the thing being asked for. Somebody
        // who bought a stranger three drinks and then asks to be taught has
        // asked for that once.
        const askedKey = askedBeforeKey(party.id, kind);
        const priorAsks = Number(readFlag(this.db, cultivator.id, askedKey) ?? '0');

        const holds = this.whatTheyAreCarrying(party.id);
        const asked: TheOneBeingAsked = {
            id: party.id,
            name: party.name,
            ordinal: party.party.realmOrdinal,
            factionId: party.party.factionId,
            holds,
            memberId: party.id.startsWith('npc-') ? party.id.slice(4) : null
        };
        const asking: TheOneAsking = {
            name: cultivator.name,
            ordinal: cultivator.realmOrdinal,
            factionId: cultivator.sectId ?? null,
            holds: cultivator.knownTechniques
        };

        // Who they would be putting you in front of, when that is the ask.
        const toMeet = shape === 'introduction' && named.length >= 2
            ? resolveCultivator(this.repos, named, cultivator.id, scope, cultivator.realmOrdinal)
            : null;
        const meeting = toMeet && toMeet.party
            ? {
                id: toMeet.id,
                name: toMeet.name,
                factionId: toMeet.party.factionId,
                here: this.present(cultivator).some(row => row.id === toMeet.id)
            }
            : null;

        const costing = whatItWouldCostThem({
            kind: shape as 'teaching' | 'introduction' | 'discipleship' | 'nothing',
            asking,
            asked,
            techniqueId: asArt?.id ?? null,
            toMeet: meeting,
            namedButUnresolved: named
        });

        // ── A REQUEST THAT CANNOT BE PUT ─────────────────────────────────
        //
        // Not a ban. Every one of these is the sentence having a hole in it -
        // no such art, nobody of that name to be introduced to, they are
        // carrying nothing you have not got - and every one names what would
        // work instead. Refused BEFORE the resolver, so no day is spent and no
        // mark is written, which is the same shape the missing-sum refusal on a
        // bribe already has.
        if (costing.refusal) {
            return refused('engine.priceTheAsk', 'request', factsForRefusal(
                costing.refusal.headline,
                costing.refusal.prose,
                costing.refusal.structure
            ));
        }

        const offered = leverage === 'coin' ? stonesNamedIn(rawInput) : null;
        if (offered !== null && offered > cultivator.spiritStones) {
            return refused('engine.resolveAttempt', 'request', factsForRefusal(
                'You do not have it.',
                `You said ${offered} and you are carrying ${cultivator.spiritStones}, which `
                + `leaves you ${offered - cultivator.spiritStones} short of what you have just `
                + `promised. ${party.name} waits for the rest of it and then stops waiting.`,
                `Offered ${offered} against a purse of ${cultivator.spiritStones}. Refused before `
                + 'the resolver, so no days were spent and no mark was written.'
            ));
        }

        const membership = this.repos.sects.getMembership(cultivator.id);
        const mySect = membership ? this.repos.sects.getById(membership.sectId) : null;
        const theirSect = asked.factionId ? getSect(asked.factionId) : null;

        // Read once and used twice: the resolver prices it, and the refusal
        // reads it to know whether telling the player to turn up again is still
        // advice or has become a loop.
        const heldTie = tieFrom(this.repos, party.id, cultivator.id);
        const tieStrength = heldTie?.active ? heldTie.strength : 0;

        // ── AND WHO THIS PARTICULAR PERSON IS ────────────────────────────
        //
        // Read from their id and from nothing else, which is the whole of the
        // ruling: *"kind elders exist just as greedy demonic cultivators
        // exist."* Two people at the same rung of the same house, equally owed
        // and equally fond of you, answered identically before this.
        //
        // The resolver would derive the same number on its own if this were not
        // passed; it is read here so the SENTENCES can say it, in the facts
        // before the outcome and in the refusal after it. A term nobody can see
        // is a term nobody can play against.
        const openHandedness = openHandednessOf(party.id);
        const holdsThings = howTheyHoldWhatTheyHave(openHandedness);
        const aboutThem = holdsThings === null
            ? party.facts
            : [...party.facts, `${party.name} ${holdsThings}.`];

        // ── ONE INPUT, PRICED ONCE, ROLLED AT MOST ONCE ──────────────────
        //
        // Built before the read branches off, because the read and the attempt
        // have to be the same arithmetic or the read is a second opinion. The
        // resolver exports `oddsOf` for exactly this - "a probe that cannot see
        // the breakdown cannot tell a tuning problem from a bug" - so weighing
        // an approach runs every term the attempt would run and stops at the
        // roll. Nothing can drift, because there is nothing to drift from.
        const attempt = {
            actor: {
                id: cultivator.id,
                name: cultivator.name,
                ordinal: cultivator.realmOrdinal,
                charm: cultivator.attributes.charm,
                factionId: membership?.sectId ?? null,
                alignment: mySect?.alignment ?? null,
                ranked: membership !== null
            },
            subject: {
                id: party.id,
                name: party.name,
                ordinal: asked.ordinal,
                ...(party.party.charm === undefined ? {} : { charm: party.party.charm }),
                factionId: asked.factionId,
                alignment: theirSect?.alignment ?? null,
                ranked: party.party.ranked,
                openHandedness
            },
            onDay: Math.floor(run.elapsedDays),
            // ── AND WHAT THE TWO OF THEM ALREADY ARE TO EACH OTHER ───────
            //
            // Three of the resolver's seven terms - their view of you, what is
            // owed either way, and what they hold against you - are worth up to
            // half again as much as the purse put together, and NO CALLER IN
            // THIS LAYER HAS EVER SUPPLIED ONE. So every approach any player
            // has ever made was made by a stranger, however many times the two
            // of them had dealt with each other, and `asking.md`'s "cheapest
            // lever in the game, available to a cultivator with nothing"
            // reached nothing at all.
            //
            // Both are read off rows and neither is invented: the ledger is the
            // obligations table, and the tie is what THIS resolver wrote the
            // last time an attempt landed.
            theirTie: heldTie,
            yourTie: tieFrom(this.repos, cultivator.id, party.id),
            ledger: openLedgerBetween(this.repos, cultivator.id, party.id),
            // THE ASK IS THE THING BEING ASKED FOR, and it is derived rather
            // than read off the sentence. Whether teaching somebody an art is
            // an afternoon or the end of their standing is a fact about the
            // book and the house, and `betrayalOfSelling` already decides it for
            // every NPC in the world.
            ask: costing.ask,
            ...(offered === null ? {} : { stonesOffered: offered }),
            approach: {
                intent: rawInput.slice(0, 400),
                ...(leverage ? { leverage } : {})
            },
            rng: forStream(run.seed, 'social_leverage', Math.floor(run.elapsedDays), party.id)
        };

        // ── WHAT IT WOULD TAKE, WITHOUT DOING IT ─────────────────────────
        //
        // "Could I ask her to teach me" is a question, and `request` spends days
        // and can spend the purse. The read now carries the REAL odds and the
        // real breakdown rather than a description of them, which is the whole
        // reason it is worth having: a player who is told a thing comes off one
        // time in eight can decide whether to spend the afternoon.
        if (weighing) {
            const weighed = oddsOf(attempt);
            const weighing = this.freeAction(run, 'request', factsForWeighingARequest(
                cultivator, party.name, shape, costing, aboutThem, offered, priorAsks,
                tieStrength, weighed.odds
            ));
            // Filed as a call rather than only onto `structure`, so the read
            // shows its arithmetic in the same place the attempt shows its own.
            // A read whose breakdown is harder to find than the attempt's is a
            // read nobody checks.
            weighing.calls.push({
                name: 'engine.priceTheAsk',
                action: 'request',
                summary: whatTheAskCameTo({
                    subject: party.name,
                    kind: shape,
                    ask: costing.ask,
                    leverage,
                    odds: weighed.odds,
                    terms: weighed.terms,
                    priorAsks
                }),
                ok: true
            }, ...costing.structure.map(line => ({
                name: 'engine.priceTheAsk',
                action: 'request' as ActionName,
                summary: line,
                ok: true
            })));
            return weighing;
        }

        const result = resolveAttempt(attempt);

        if (result.stonesSpent > 0) {
            this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -result.stonesSpent });
        }

        const spent = await this.shortSkip(
            run, cultivator, ambient, TRAVEL_FOCUS, `Asking ${party.name}`, result.days
        );

        writeFlag(this.db, cultivator.id, askedKey, String(priorAsks + 1));

        const calls: ToolCallRecord[] = [
            {
                name: 'engine.resolveAttempt',
                action: 'request',
                // Composed after the records are written, below, because one
                // clause of it is a claim about the ledger.
                summary: '',
                ok: result.outcome === 'taken'
            },
            ...structureCalls(party.structure),
            ...costing.structure.map(line => ({
                name: 'engine.priceTheAsk',
                action: 'request' as ActionName,
                summary: line,
                ok: true
            })),
            ...spent.calls
        ];

        // ── AND WHAT THE ATTEMPT LEFT BEHIND ─────────────────────────────
        //
        // `factsForAttempt` has said "it is on somebody's ledger now, and
        // ledgers here are kept" since it was written, and nothing wrote to the
        // ledger. That is the narrator asserting an outcome the database never
        // took, which is the one thing this codebase forbids outright. The
        // resolver hands back the records; this persists them.
        const left = this.recordWhatTheAskLeft(
            run, cultivator, party, result, 'request', shape !== 'nothing'
        );
        calls.push(...left.calls);

        // The engine's own account of the whole attempt, every figure kept and
        // every enum resolved. Filled in here rather than above because it says
        // whether anything reached the ledger, and the only honest source for
        // that is whether anything did.
        calls[0].summary = whatTheAskCameTo({
            subject: party.name,
            kind: shape,
            ask: costing.ask,
            leverage,
            odds: result.odds,
            terms: result.terms,
            outcome: result.outcome,
            days: result.days,
            stonesSpent: result.stonesSpent,
            priorAsks,
            wroteToTheLedger: left.wroteToTheLedger,
            reachedTheHouse: result.marks.reachedTheHouse
        });

        // Built AFTER the records are written, because one of its lines is a
        // claim about the ledger and the only honest source for that claim is
        // whether anything went into it.
        const facts = factsForRequest(
            cultivator, party.name, shape, named, costing, result, aboutThem, priorAsks,
            left.wroteToTheLedger, tieStrength, openHandedness
        );
        facts.lines.push(...spent.facts.lines);
        facts.structure.push(...spent.facts.structure);

        const execution: Execution = {
            ...spent,
            facts,
            outcome: result.outcome === 'taken' ? 'executed' : 'refused'
        };
        execution.calls = calls;

        // ── AND THE THING ACTUALLY HAPPENS ───────────────────────────────
        if (result.outcome === 'taken' || result.outcome === 'turned') {
            const done = await this.whatTheyAgreedTo(
                run, cultivator, party, shape, costing, meeting
            );
            facts.lines.push(...done.lines);
            facts.prose = `${facts.prose}

${done.lines.join(' ')}`;
            execution.calls.push(...done.calls);
        }

        return execution;
    }

    /**
     * Every art a person could actually walk somebody down, from both of the
     * places one is written.
     *
     * A cultivator row carries `knownTechniques` and a world NPC carries
     * `cultivation.techniqueIds`, and most of the people standing in a square
     * are the second kind - `othersPresent` unions the two, and a reader that
     * looked at only one of them would find the roster empty in exactly the
     * places a player actually stands.
     */
    private whatTheyAreCarrying(personId: string): string[] {
        const held = new Set<string>(
            this.repos.cultivators.getById(personId)?.knownTechniques ?? []
        );
        if (this.atHand) {
            for (const npc of this.atHand.npcs) {
                if (npc.id !== personId) continue;
                for (const id of npc.cultivation.techniqueIds) held.add(id);
            }
        }
        // The five people in the world who are worth more than the shelf they
        // stand beside. `LIVING_TRANSMISSIONS` is read by the catalog and by the
        // register and by nothing in `src/engine/` or `src/web/` - AGENTS.md
        // lists it first among the modules nothing calls. This is the route a
        // player takes to it.
        const memberId = personId.startsWith('npc-') ? personId.slice(4) : personId;
        for (const carried of transmissionsBy(memberId)) {
            for (const id of carried.techniqueIds) held.add(id);
        }
        return [...held];
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
    private recordWhatTheAskLeft(
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
        somethingWasAsked = true
    ): { calls: ToolCallRecord[]; wroteToTheLedger: boolean } {
        const calls: ToolCallRecord[] = [];
        let wroteToTheLedger = false;
        for (const [which, mark] of [
            ['obligation', result.marks.obligation],
            ['counterObligation', result.marks.counterObligation]
        ] as const) {
            if (!mark) continue;
            if (!somethingWasAsked && mark.kind === 'grudge') continue;
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
        if (result.marks.tie) {
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
    private async whatTheyAgreedTo(
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

    private groundFor(cultivator: Cultivator): GroundConditions | null {
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
    private understandingFor(
        run: Run,
        cultivator: Cultivator,
        practisingTechniqueId: string | null = null
    ) {
        return discoveryContextFor(this.repos, cultivator, {
            runId: run.id,
            practisingTechniqueId
        }).context;
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
    private freeAction(run: Run, action: ActionName, facts: EngineFacts): Execution {
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

    private drawFromPack(
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

    private buyProvisions(
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
    private ambientFor(cultivator: Cultivator, run: Run): AmbientQi {
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
    private currentRun(): { run: Run; cultivator: Cultivator } {
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
    private scopeFor(cultivator: Cultivator): KnowledgeScope {
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
    private somewhereReal(name: string, cultivator: Cultivator): boolean {
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
    private ruinAtHand(query: string, cultivator: Cultivator): ResolvedEntity | null {
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

    private somebodyAtHand(query: string, cultivator: Cultivator): RosterEntry | null {
        const wanted = query.trim();
        if (!POINTING.test(wanted)) return null;
        const here = this.present(cultivator);

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

    private present(cultivator: Cultivator): RosterEntry[] {
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

    private company(cultivator: Cultivator): Company {
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
    private async advanceWorld(days: number, cultivator: Cultivator, run: Run): Promise<WorldReport> {
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
     */
    private blankLook(cultivator: Cultivator): string {
        const here = this.present(cultivator);
        const where = placeName(cultivator);
        if (here.length === 0) {
            return `You say it aloud in ${where} and ${where} carries on as it was. ` +
                'Whatever you meant by it, there is nothing here that answers to it.';
        }
        const witness = here[0].name;
        return `You put the words to ${witness}. They look at you the way people look at a ` +
            'sentence with a hole in it, and then go back to what they were doing.';
    }

    /**
     * What is actually about, briefly, when the player named nobody.
     *
     * Says what is there and stops. A list of who could be approached is a
     * developer affordance wearing a sentence.
     */
    private whoIsAbout(cultivator: Cultivator): string {
        const here = this.present(cultivator);
        const where = placeName(cultivator);
        if (here.length === 0) {
            return `There is nobody about in ${where} at all, and you had not settled on who you ` +
                'were looking for before you noticed that.';
        }
        if (here.length === 1) {
            return `${here[0].name} is the only person in ${where}, and you have not decided ` +
                'whether it was them you wanted.';
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
    private knownNamesLine(cultivator: Cultivator, scope: KnowledgeScope): string {
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
    private noteEncounter(
        cultivator: Cultivator,
        run: Run,
        entity: { kind: string; id: string; name: string },
        sourceKind: 'witnessed' | 'told' | 'read',
        note: string
    ): boolean {
        const kind = entity.kind;
        if (kind !== 'cultivator' && kind !== 'sect' && kind !== 'place') return false;
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

    private stateView(run: Run, cultivator: Cultivator): StateView {
        return {
            run: runView(run),
            cultivator: cultivatorView(cultivator),
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
    private engineEntries(execution: Execution, turn: number): LogEntry[] {
        const entries: LogEntry[] = [{ role: 'engine', turn, text: execution.facts.headline }];
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

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * A structure line, with the name of the function that produced it taken off.
 *
 * Reported across several sessions and it keeps surviving because it looks like
 * debug output somebody meant to remove. It is not - it is a deliberate
 * mechanical channel that the player also reads. Four occurrences in eleven
 * turns of ordinary play, on the two commonest early actions:
 *
 *   technique_manage.list_available: 4 compatible, 0 conflicting, 134 gated...
 *   encounters.assessFit: suited at grade ordinal 0; reach=match, element=match
 *
 * The playtester's diagnosis is the fix: "The content is fine and arguably
 * useful; it's the `module.function:` prefix that shouldn't be in the story."
 * Being told what is compatible, what is gated by realm, and that an art suits
 * you on reach and on element is genuinely worth knowing. Being told which MCP
 * handler said so is not.
 *
 * Done here rather than at the several dozen `structure.push` sites, because
 * one place cannot go stale and a convention across dozens will. Nothing is
 * lost to an operator: every `calls[]` entry still carries its handler in
 * `name`, which is where a handler name belongs.
 *
 * Narrow on purpose. It requires a lowercase identifier, at least one dot, no
 * spaces, and a colon - so "Day 3: ..." and any ordinary sentence are untouched.
 */
const A_HANDLER_NAME_AT_THE_FRONT = /^[a-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+:\s*/;

/**
 * The sum somebody said they were putting down, off their own sentence.
 *
 * Read here rather than in the parser because it is not a routing decision:
 * `actions.ts` chooses a verb, and how much money is in a bribe is a parameter
 * of the act. Keeping it out of the plan object also keeps a model from ever
 * being in a position to name a figure that leaves the purse - the enum's whole
 * discipline - since this reads the PLAYER'S raw sentence and nothing else.
 *
 * Requires the noun. A bare number in "I bribe the third guard" is not an offer,
 * and reading it as one would have somebody paying three stones for a sentence
 * about a person.
 */
export function stonesNamedIn(sentence: string): number | null {
    const said = /\b(\d[\d,]*)\s*(?:spirit\s+)?stones?\b/i.exec(sentence);
    if (!said) return null;
    const value = Number.parseInt(said[1].replace(/,/g, ''), 10);
    return Number.isFinite(value) && value > 0 ? value : null;
}

export function withoutTheHandlerName(line: string): string {
    const stripped = line.replace(A_HANDLER_NAME_AT_THE_FRONT, '');
    if (stripped === line) return line;
    return stripped.length > 0 ? stripped[0].toUpperCase() + stripped.slice(1) : line;
}

/**
 * A time-skip, broken into the calls it actually made.
 *
 * Every `summary` here is either composed from the digest's own numbers or is a
 * `SimEvent.summary` verbatim - engine strings, not prose. The per-event rows
 * are what make the inspector worth opening: a decade of seclusion shows up as
 * the breakthroughs, deviations and opportunities the engine ruled, in order,
 * next to whatever the narration made of them.
 */
function skipCalls(action: string, skip: TimeSkipResult, provisioning: string | null): ToolCallRecord[] {
    const calls: ToolCallRecord[] = [];

    if (provisioning) {
        calls.push({
            name: 'cultivator.applyDeltas',
            action: 'buy_provisions',
            summary: provisioning,
            ok: true
        });
    }

    calls.push({
        name: 'engine.simulateTimeSkip',
        action,
        summary:
            `${skip.simulatedDays} of ${skip.requestedDays} day(s) resolved in one deterministic pass` +
            (skip.interrupted ? `, interrupted: ${skip.interruptReason ?? 'unspecified'}` : '') +
            `. ${skip.events.length} event(s); ` +
            `${skip.deltas.realmOrdinal >= 0 ? '+' : ''}${skip.deltas.realmOrdinal} rank, ` +
            `${Math.round(skip.deltas.cultivationProgress)} progress, ` +
            `${skip.deltas.injuriesGained} injury(ies).`,
        ok: true
    });

    for (const event of skip.events.slice(0, MAX_LOGGED_EVENTS)) {
        calls.push({
            name: 'engine.simulateTimeSkip',
            action: event.kind,
            summary: `Day ${Math.round(event.dayOffset)}: ${event.summary}`,
            ok: true
        });
    }
    if (skip.events.length > MAX_LOGGED_EVENTS) {
        calls.push({
            name: 'engine.simulateTimeSkip',
            action: 'events_elided',
            summary: `${skip.events.length - MAX_LOGGED_EVENTS} further event(s) are in the seclusion digest.`,
            ok: true
        });
    }

    calls.push({
        name: 'storage.applyTimeSkip',
        action: 'persist',
        summary:
            `Wrote the result: ${skip.simulatedDays} day(s) of in-world time, ` +
            `${skip.deltas.injuriesGained} injury row(s), one turn.`,
        ok: true
    });

    if (skip.died) {
        calls.push({
            name: 'cultivator.markDead',
            action: 'death',
            summary: `Run closed: ${skip.deathCause}. Permadeath - no reload, no revival.`,
            ok: true
        });
    }

    return calls;
}

/**
 * The handful of fields worth reading off an MCP handler's result.
 *
 * Deliberately a small allowlist rather than a dump of the whole body: these
 * results are large, and everything not listed here is either an id the player
 * cannot use or a projection the sheet already shows.
 */
/**
 * Strip the deliberate-override word out of a named target.
 *
 * "I take the pill anyway" parses to `target: "pill anyway"`, and the override
 * is not part of the pill's name - left in, confirming a wasted pill refused a
 * second time for an entirely different reason ("no pill called pill anyway on
 * you"), which is a worse answer than the one being confirmed.
 *
 * A module function rather than a static on the class: the same word will want
 * stripping wherever an override is offered, and a target is a string rather
 * than anything the game service owns.
 */
export function withoutTheOverride(target: string): string {
    return target.replace(/\b(?:anyway|anyhow|regardless|even so)\b/gi, '').replace(/\s+/g, ' ').trim();
}

function summariseToolBody(body: Record<string, unknown>): string[] {
    const lines: string[] = [];

    // ── THE TERMS OF A GUEST PLACE ───────────────────────────────────────
    //
    // The sixth verb to land on the shrug, caught on its first played run:
    // "can I study at the House of the Narrow Hour" came back as one sentence
    // saying the house would let you sit in, and said nothing whatever about
    // what it would show you, what it would keep, how long it would watch you,
    // or the five things the place is not. All of that was in the body.
    //
    // The order below is the order somebody deciding actually wants it: what is
    // on the table, then what is not, then what the position does not carry -
    // because that last is the part that has to be read BEFORE accepting rather
    // than discovered afterwards.
    if (typeof body.hostName === 'string' && Array.isArray(body.opens)) {
        const opens = body.opens as Array<{ name?: string; carriesTo?: string | null; requiredRank?: string }>;
        const kept = (body.keepsBack ?? []) as Array<{ name?: string; why?: string }>;
        const notYet = (body.openedButOutOfReach ?? []) as Array<{ name?: string; requiredRank?: string }>;

        lines.push(
            opens.length === 0
                ? `${body.hostName} would put nothing in front of you that you can open as you stand.`
                : `What they would show you: ${opens.map(o =>
                    `${o.name}${o.carriesTo ? `, which carries to ${o.carriesTo}` : ''}`
                ).join('; ')}.`
        );
        if (notYet.length > 0) {
            lines.push(
                `On the same shelf and out of your reach for now: ${notYet.map(o =>
                    `${o.name} (${o.requiredRank})`
                ).join('; ')}.`
            );
        }
        if (kept.length > 0) {
            lines.push(
                `They keep ${kept.length} thing${kept.length === 1 ? '' : 's'} back, `
                + `starting with ${kept[0].name}. ${kept[0].why ?? ''}`
            );
        }
        if (typeof body.watchesForYears === 'number') {
            lines.push(
                `They would watch you for ${body.watchesForYears} years before saying anything `
                + 'about what you are. That is not a price for the shelf - it is how long a '
                + 'house looks at somebody before it is willing to have an opinion.'
            );
        }
        for (const line of (body.notOffered ?? []) as string[]) lines.push(line);
        if (typeof body.yourOwnHouse === 'string') lines.push(body.yourOwnHouse);
        if (typeof body.stillOf === 'string') lines.push(`Still of: ${body.stillOf}`);
    }

    // ── WHERE SOMEBODY STANDS IN THEIR OWN HOUSE ─────────────────────────
    //
    // `handleStanding` returns rank, contribution and exactly what the next
    // rung wants, and this function had no branch for that shape - so asking
    // came back "It is done. Nothing about it drew attention." The fallback
    // defect again, on the read that answers "how much contribution do I have",
    // which is the number gating every promotion in the game.
    //
    // The promotion refusal already states both requirements and both current
    // values and is the best sentence of its kind in the codebase. This says
    // the same thing before the player is refused rather than after.
    // A house taking somebody back at the seat they left. Said, not merely
    // applied: a returning member seated below what their rung would otherwise
    // buy has to be told why, or the house looks as though it has misjudged
    // them. See the entry cap in `sect-manage.ts`.
    const returning = body.returning as { note?: string } | null | undefined;
    if (returning?.note) lines.push(returning.note);

    // ── BEING RAISED A RUNG ──────────────────────────────────────────────
    //
    // `handlePromote` returns the old title, the new one, the contribution it
    // cost and the new stipend, and this function had no branch for that shape.
    // Measured in play:
    //
    //     > I ask to be promoted to Outer Disciple
    //     It is done. Nothing about it drew attention.
    //
    // The state changed correctly and one of the few structural events in a
    // career came back as the last-resort line. It is the fifth time this
    // fallback has swallowed a verb, which is why the shrug is the thing worth
    // hunting rather than any one of the verbs.
    //
    // The contribution is the part a player most needs said: a promotion is
    // BOUGHT, the ledger is spent rather than merely met, and somebody who does
    // not know that will plan the next twenty years off a balance they no
    // longer have.
    if (body.promoted === true) {
        const sect = body.sect as { name?: string } | undefined;
        const to = typeof body.toRank === 'string' ? body.toRank : null;
        const from = typeof body.fromRank === 'string' ? body.fromRank : null;
        if (to) {
            lines.push(
                `${from ? `${from} no longer; ` : ''}${to}`
                + `${sect?.name ? ` of ${sect.name}` : ''}.`
                + (typeof body.contributionSpent === 'number'
                    ? ` It cost ${body.contributionSpent} contribution, which is gone rather than met.`
                    : '')
                + (typeof body.newStipendPerMonth === 'number'
                    ? ` The seat draws ${body.newStipendPerMonth} spirit stones a month.`
                    : '')
            );
        }
    }

    const rank = body.rank as { title?: string; stipendPerMonth?: number } | undefined;
    if (body.member === true && rank?.title) {
        const sect = body.sect as { id?: string; name?: string; memberCount?: number } | undefined;
        lines.push(
            `${rank.title}${sect?.name ? ` of ${sect.name}` : ''}`
            + `${typeof body.contribution === 'number' ? `, ${body.contribution} contribution` : ''}`
            + `${typeof rank.stipendPerMonth === 'number' ? `, ${rank.stipendPerMonth} spirit stones a month` : ''}.`
        );
        // WHO LEADS IT. "who leads this sect" came back with the generic
        // "knowing a name is not an introduction" line - the stranger's answer,
        // to a member, about their own house - and named two houses when the
        // player belongs to one. The roll is in the catalog and nothing read it.
        const head = [...getMembersOf(String(sect?.id ?? ''))]
            .sort((a, b) => b.realmOrdinal - a.realmOrdinal)[0];
        if (head) {
            lines.push(
                `${head.name} stands highest in it, at ${rankName(head.realmOrdinal)}`
                + `${head.rank ? ` and titled ${head.rank}` : ''}.`
            );
        }

        const next = body.nextRank as {
            title?: string; requiredRank?: string; requiredContribution?: number;
            ordinalShortfall?: number; contributionShortfall?: number;
        } | null | undefined;
        if (next?.title) {
            const wants: string[] = [];
            if ((next.ordinalShortfall ?? 0) > 0 && next.requiredRank) {
                wants.push(`${next.requiredRank}, which is ${next.ordinalShortfall} rung(s) up`);
            }
            if ((next.contributionShortfall ?? 0) > 0) {
                wants.push(`${next.requiredContribution} contribution, which is ${next.contributionShortfall} more`);
            }
            lines.push(wants.length === 0
                ? `${next.title} is open: the house has no further requirement to state.`
                : `${next.title} wants ${wants.join(' and ')}.`);
        } else if (body.nextRank === null) {
            lines.push('There is no rung above this one in the house.');
        }
    }
    if (body.member === false && typeof body.note === 'string') {
        lines.push(body.note);
    }

    const odds = body.odds as { finalChancePercent?: number; roll?: number } | undefined;
    if (odds && typeof odds.finalChancePercent === 'number') {
        lines.push(`Odds were ${odds.finalChancePercent}%, rolled ${odds.roll ?? 'unrecorded'}.`);
    }

    const produced = body.produced as { name?: string; effect?: string } | null | undefined;
    if (produced?.name) {
        lines.push(`Produced: ${produced.name}${produced.effect ? ` (${produced.effect})` : ''}.`);
    }

    const consumed = body.ingredientsConsumed as Array<{ name?: string; quantity?: number }> | undefined;
    if (Array.isArray(consumed) && consumed.length > 0) {
        lines.push(
            'Consumed whether it worked or not: ' +
            consumed.map(i => `${i.quantity ?? 1} x ${i.name ?? 'unknown'}`).join(', ') + '.'
        );
    }

    if (typeof body.masteryBefore === 'number' && typeof body.masteryAfter === 'number') {
        lines.push(
            `Mastery ${(body.masteryBefore * 100).toFixed(0)}% to ${(body.masteryAfter * 100).toFixed(0)}%.`
        );
    }
    const deviation = body.deviation as { deviated?: boolean; summary?: string } | undefined;
    if (deviation?.deviated && deviation.summary) lines.push(deviation.summary);

    // ── what a fight cost ──
    //
    // `combat_manage.resolve` returns a rich body - every exchange with its
    // damage, the HP left afterwards, the wounds each side picked up, the
    // lethal-injury threshold - and NONE of it reached the player, because
    // this function had no combat branch and the handler's `narrationHint` is
    // atmosphere rather than accounting.
    //
    // Found by playing. One swing at somebody standing in the square came back
    // as "Broken off. Both parties are worse than they were, the wounds are
    // real, and nothing is settled." - which is true, and reads well, and does
    // not mention that it took two thirds of the HP off a sixteen-year-old and
    // left an untreated wound behind. The player had to read /api/state to find
    // out they had nearly died.
    //
    // This is the same defect the work path carried until it was played too,
    // and it is worse here: work drains you over years and combat does it in a
    // turn, and the injury threshold is the fastest way to die in the game.
    if (typeof body.outcome === 'string' && Array.isArray(body.exchanges)) {
        const them = body.opponent as { id?: string; name?: string } | undefined;
        const exchanges = body.exchanges as Array<{
            damage?: number; defenderId?: string;
        }>;

        // Whose id is on the receiving end decides whose damage it was. The
        // opponent's id is the one field guaranteed present on both sides.
        const taken = exchanges
            .filter(x => x.defenderId !== undefined && x.defenderId !== them?.id)
            .reduce((sum, x) => sum + (x.damage ?? 0), 0);
        const dealt = exchanges
            .filter(x => x.defenderId !== undefined && x.defenderId === them?.id)
            .reduce((sum, x) => sum + (x.damage ?? 0), 0);

        const mine = body.cultivator as {
            vitals?: { hp?: number; maxHp?: number };
            mortality?: {
                untreatedInjuries?: number;
                crippledInjuryThreshold?: number;
                atCrippledInjuryThreshold?: boolean;
                injuryRatePenalty?: number;
            };
        } | undefined;
        const hp = mine?.vitals?.hp;
        const maxHp = mine?.vitals?.maxHp;

        if (taken > 0 || dealt > 0) {
            lines.push(
                `${exchanges.length} exchange${exchanges.length === 1 ? '' : 's'}: `
                + `${dealt} dealt, ${taken} taken`
                + `${typeof hp === 'number' && typeof maxHp === 'number'
                    ? `, which leaves ${hp} of ${maxHp}.` : '.'}`
            );
        }

        // The wounds by name. A player who does not know they are carrying one
        // cannot decide to have it treated, and untreated is the state that
        // kills.
        const hurt = body.injuries as {
            self?: Array<{ severity?: string; description?: string }>;
        } | undefined;
        const fresh = hurt?.self ?? [];
        if (fresh.length > 0) {
            // The descriptions are written as sentences and already carry a
            // full stop. Appending another produced "taken in combat..".
            const said = fresh
                .map(i => (i.description ?? i.severity ?? 'something').replace(/\.\s*$/, ''))
                .join('; ');
            lines.push(
                `Came away with ${fresh.length === 1 ? 'a wound' : `${fresh.length} wounds`}: ${said}.`
            );
        }

        // AND SAY WHAT CARRYING THEM COSTS.
        //
        // These two lines used to say the wounds would kill and count down to
        // it. They do not kill - a torn channel is a torn muscle - and a threat
        // the engine never carries out teaches a player to ignore the line.
        //
        // The true version is not softer. Untreated wounds accumulate, nothing
        // closes them, and at the threshold the body stops mending itself
        // altogether, so every scratch after that one is permanent until
        // somebody is paid. That is what a player needs in order to decide to
        // go and have them treated, which is the decision this line exists for.
        const carried = mine?.mortality?.untreatedInjuries;
        const crippledAt = mine?.mortality?.crippledInjuryThreshold;
        const rateLoss = mine?.mortality?.injuryRatePenalty;
        const cost = typeof rateLoss === 'number' && rateLoss > 0
            ? ` They are taking ${Math.round(rateLoss * 100)}% of the cultivation rate.`
            : '';
        if (typeof carried === 'number' && typeof crippledAt === 'number' && carried > 0) {
            lines.push(
                mine?.mortality?.atCrippledInjuryThreshold === true
                    ? `${carried} untreated wounds, which is the count at which the body stops mending `
                      + `itself. Nothing closes them on its own and nothing heals from here.${cost}`
                    : `${carried} untreated wound${carried === 1 ? '' : 's'} of the ${crippledAt} at `
                      + `which the body stops mending. They do not close on their own.${cost}`
            );
        }
    }

    // ── the mortal economy ──
    //
    // `work` and `market` return figures rather than a narration hint, because
    // the tool surface's caller is a model that will phrase them. Here they
    // have to become sentences or a player gets "The work is done." and nothing
    // else, which is how the first live check of this path read.
    if (body.worked === true) {
        const occupation = body.occupation as { name?: string } | undefined;
        const days = typeof body.daysWorked === 'number' ? body.daysWorked : 0;
        const paid = typeof body.spiritStonesEarned === 'number' ? body.spiritStonesEarned : 0;
        const now = typeof body.spiritStonesNow === 'number' ? body.spiritStonesNow : null;

        lines.push(
            `${humanDays(days)} of ${occupation?.name ?? 'whatever was going'}, ` +
            `and ${paid > 0 ? `${paid} spirit stones for it` : 'nothing to show for it'}` +
            `${now === null ? '.' : `, which leaves ${now}.`}`
        );
        lines.push(
            'Nothing was gathered in that time. That is what the money costs, and it is why a ' +
            'sect stipend is worth more than the stipend.'
        );
        if (typeof body.unpaid === 'string') lines.push(body.unpaid);

        // AND SAY IF THEY ARE STARVING.
        //
        // The time-skip path has warned at this threshold since it was written;
        // the work path never did, and work is where a player spends years.
        // Found by playing: fourteen consecutive years of innkeeping took HP
        // from 30 to 15 and satiety to 20, the purse to twelve hundred stones,
        // and said nothing but the wages each time. A meal costs one stone.
        //
        // The information was not even hidden - `status` prints "Satiety
        // 20/100" - but a player has no reason to open a status sheet while a
        // job is going fine, and nothing in the job's own account suggested it
        // was not.
        const satietyNow = typeof body.satiety === 'number' ? body.satiety : null;
        if (satietyNow !== null && satietyNow <= LOW_SATIETY) {
            const hpNow = typeof body.hp === 'number' ? body.hp : null;
            const hpMax = typeof body.maxHp === 'number' ? body.maxHp : null;
            lines.push(
                `Satiety is down to ${satietyNow}. The work pays and it does not feed you, `
                + 'and qi feeds the meridians rather than the body.'
                // Name the cost in the same breath. A player told they are
                // hungry, and separately that they are hurt, has to join the two
                // themselves - and nothing on the work board suggests they are
                // the same fact. Measured by playing: health slid from thirty to
                // fifteen across twenty years and the only warning was a number
                // about food.
                + (hpNow !== null && hpMax !== null && hpNow < hpMax
                    ? ` It is being taken out of you: ${hpNow} of ${hpMax} left.`
                    : '')
            );
        }

        // AND THE WOUNDS THE SPAN LEFT BEHIND.
        //
        // Work runs the ordinary event layer, so a labourer picks up wounds
        // across years like anybody else. This branch reported wages, food and
        // health and said nothing about them at all.
        //
        // Found by playing. An innkeeper worked three spans across four years,
        // was told the pay every time, and died of `untreated_injuries` without
        // one sentence about a wound. The satiety warning above was written
        // after the same discovery about hunger.
        //
        // That death is retired - a torn channel does not kill anybody - and
        // the line is still needed, for the reason that was underneath the
        // original one. Untreated is a state that does not improve on its own,
        // it takes a growing share of everything the body does, and at the
        // threshold the body stops mending itself at all. A player who is never
        // told cannot decide to go and have them treated.
        const carried = typeof body.untreatedInjuries === 'number'
            ? body.untreatedInjuries : null;
        const crippledAt = typeof body.crippledInjuryThreshold === 'number'
            ? body.crippledInjuryThreshold : null;
        if (carried !== null && carried > 0) {
            lines.push(
                crippledAt !== null && carried >= crippledAt
                    ? `${carried} untreated wounds, which is the count at which the body stops `
                      + 'mending itself. Nothing about the work will close them.'
                    : `${carried} untreated wound${carried === 1 ? '' : 's'}`
                      + `${crippledAt !== null ? ` of the ${crippledAt} at which a body stops mending` : ''}, `
                      + 'picked up along the way. They do not close on their own.'
            );
        }
    }

    // -- the sects --
    //
    // `sect_manage.join` and `.leave` return a membership record rather than a
    // narration hint. Without this the last-resort line reached a player as
    // "The Gleaners' Company is done." - which reads as the sect being
    // finished, not as the joining having happened. Same defect class as the
    // work and market boards: a tool surface written for a model that will
    // phrase the figures, called here by something that has to phrase them
    // itself.
    if (body.joined === true) {
        const joinedSect = body.sect as { name?: string } | undefined;
        const membership = body.membership as { rankTitle?: string } | undefined;
        lines.push(
            // "at ${rankTitle}" read as a place. Barrow Hand is the lowest
            // rank in the Gleaners' Company and it is also a town, so the line
            // told a player standing in Sweptground that they were somewhere
            // else. A rank has to be named as a rank.
            `Taken on by ${joinedSect?.name ?? 'the sect'}` +
            `${membership?.rankTitle ? `, ranked ${membership.rankTitle}` : ''}. ` +
            'No journey was involved and none is implied: being on their roll and being on their ' +
            'ground are two different things.'
        );
        if (typeof body.defectedFrom === 'string' && body.defectedFrom.length > 0) {
            lines.push(
                'Whatever standing was built at the last door stayed there. ' +
                'Contribution does not travel.'
            );
        }
    }

    // An art taken up. `handleLearn` returns the projection and no narration
    // hint, so without this the single most consequential thing a cultivator
    // can do to their own body lands in the generic catch-all.
    if (body.learned === true) {
        const art = body.technique as { name?: string; element?: string | null; grade?: string } | undefined;
        lines.push(
            `${art?.name ?? 'The art'} is held now, at nothing like mastery` +
            `${art?.element ? `, and it runs on ${art.element}` : ''}. ` +
            'Knowing a method and being able to use it are different distances, and practice is ' +
            'the only thing that closes the second one.'
        );
        if (body.elementConflict === true) {
            lines.push(
                'It fights the root rather than running with it. That is a permanent condition of '
                + 'carrying it, not a one-off risk that has now passed.'
            );
        }
        const dev = body.deviation as { deviated?: boolean; summary?: string } | null | undefined;
        if (dev?.summary) lines.push(dev.summary);
    }

    // The stipend, which is the whole reason a poor cultivator joins a house.
    //
    // `handleStipend` returns `spiritStonesPaid` and no narration hint, so a
    // payment of a hundred and fifty stones reached a player as "It is done.
    // Nothing about it drew attention." - the last-resort line, on the single
    // largest sum a low cultivator ever sees. Same defect class as `work` and
    // `join`: a tool surface written for a model that will phrase the figures,
    // called by something that has to phrase them itself.
    // A pill swallowed. `handleConsumePill` returns the applied effect and no
    // narration hint, so the single most consequential object in the game -
    // and, through FLAG_PENDING_PILL, the largest modifier in it - landed in
    // the generic catch-all as "It is done. Nothing about it drew attention."
    if (body.consumed === true) {
        const swallowed = body.pill as { name?: string; grade?: string } | undefined;
        lines.push(
            `${swallowed?.name ?? 'The pill'}`
            + `${swallowed?.grade ? `, ${swallowed.grade} grade` : ''}, swallowed. It is gone `
            + 'whether it did anything or not.'
        );
        if (typeof body.applied === 'string') lines.push(body.applied);

        if (body.pendingBreakthroughPill) {
            lines.push(
                'It is held for the next bottleneck rather than spent now, and the engine prices it '
                + 'at the moment of the attempt - spent whether the attempt succeeds or not.'
            );
        }

        const tox = body.toxicity as {
            after?: number; tolerance?: number; crossedThreshold?: boolean;
        } | undefined;
        if (tox && typeof tox.after === 'number') {
            lines.push(tox.crossedThreshold
                ? `Toxicity is past ${tox.tolerance ?? 'the tolerance'} at `
                  + `${tox.after.toFixed(2)}. The medicine has become the injury, and that is a `
                  + 'real wound on a real body.'
                : `Toxicity stands at ${tox.after.toFixed(2)} of ${tox.tolerance ?? '?'}. `
                  + 'It does not clear on its own.');
        }
    }

    // A master's read of a student, which is a sentence about a person and not
    // about a place. `handleAssess` returns rows and no narration hint.
    if (body.against === 'student') {
        const stall = body.stall as {
            yearsAtCurrentRealm?: number; stagnationYears?: number;
            stalled?: boolean; yearsPast?: number; yearsRemaining?: number;
        } | undefined;
        const assessor = body.assessor as
            { name?: string; rank?: string; rungsAbove?: number } | null | undefined;

        lines.push(assessor
            ? `${assessor.name ?? 'Somebody'} stands ${assessor.rungsAbove ?? 0} rung`
              + `${assessor.rungsAbove === 1 ? '' : 's'} above you, at ${assessor.rank ?? 'an unnamed rank'}, `
              + 'and is qualified to say anything at all about where you are.'
            : 'Nobody standing over you is standing above you. Whatever comes next is not in '
              + 'this house, and nobody in it is in a position to tell you what it is.');

        if (stall) {
            lines.push(stall.stalled
                ? `${Math.round(stall.yearsAtCurrentRealm ?? 0)} years at this rung against the `
                  + `${Math.round(stall.stagnationYears ?? 0)} the ladder credits. You are `
                  + `${Math.round(stall.yearsPast ?? 0)} years past the point where sitting still `
                  + 'stops being patience.'
                : `${Math.round(stall.yearsAtCurrentRealm ?? 0)} years at this rung, of the `
                  + `${Math.round(stall.stagnationYears ?? 0)} the ladder credits. `
                  + `${Math.round(stall.yearsRemaining ?? 0)} still counted.`);
        }
        if (typeof body.note === 'string') lines.push(body.note);
    }

    // ── a petition, and how far it actually got ──
    //
    // `sect_politics.petition` returns where it went, how far up it climbed,
    // every stop on the way, what asking is like in that house's own terms and
    // when an answer might come - and none of it reached the player, because
    // this function had no branch for it. Petitioning a sect came back as "It
    // is done. Nothing about it drew attention.", which is the last-resort line
    // this file already calls out as a defect: a sentence about the software,
    // shipped to somebody who had just asked an institution for something.
    //
    // Found by playing. Same shape as combat and the work board before them.
    if (body.petitioned === true) {
        const from = body.from as { name?: string } | undefined;
        const stops = typeof body.chainLength === 'number' ? body.chainLength : null;
        const reached = typeof body.reachedTier === 'string' ? body.reachedTier : null;

        lines.push(
            `Put to ${from?.name ?? 'them'}`
            + `${stops !== null ? `, and passed along ${stops === 1 ? 'once' : `${stops} times`}` : ''}`
            + `${reached ? `, reaching ${reached}` : ''}.`
        );
        // The house's own account of what asking is like. Written in the
        // world's voice by the tool layer, so it goes through as it stands.
        if (typeof body.whatAskingIsLike === 'string') lines.push(body.whatAskingIsLike);
        if (typeof body.howLong === 'string') lines.push(body.howLong);

        // A petition that travelled learned you names on the way, which is the
        // one thing a player takes from it whatever the answer.
        const learned = body.namesLearned;
        if (Array.isArray(learned) && learned.length > 0) {
            lines.push(
                `Names picked up passing it along: ${learned.map(n => String(n)).join(', ')}.`
            );
        }
        if (typeof body.note === 'string') lines.push(body.note);
    }

    if (body.paid === true) {
        const payingSect = body.sect as { name?: string } | undefined;
        const stones = typeof body.spiritStonesPaid === 'number' ? body.spiritStonesPaid : 0;
        const months = typeof body.monthsPaid === 'number' ? body.monthsPaid : 0;
        const now = typeof body.spiritStonesNow === 'number' ? body.spiritStonesNow : null;
        lines.push(
            `${stones} spirit stone${stones === 1 ? '' : 's'} drawn from ` +
            `${payingSect?.name ?? 'the sect'}` +
            `${months > 0 ? `, being ${months} month${months === 1 ? '' : 's'} of stipend` : ''}` +
            `${typeof body.rank === 'string' ? ` at ${body.rank}` : ''}` +
            `${now === null ? '.' : `. The purse holds ${now}.`}`
        );
        lines.push(
            'Drawing it is service rendered and the house marks it down. Nothing was gathered ' +
            'to earn it, which is exactly what a stipend is for.'
        );
        if (typeof body.daysCarriedForward === 'number' && body.daysCarriedForward > 0) {
            lines.push(
                `${Math.round(body.daysCarriedForward)} day(s) carry forward toward the next payment.`
            );
        }
    }

    if (body.left === true) {
        const formerSect = body.sect as { name?: string } | undefined;
        const formerRank = typeof body.formerRank === 'string' ? body.formerRank : null;
        lines.push(
            `No longer of ${formerSect?.name ?? 'the sect'}` +
            `${formerRank ? `, where the rank was ${formerRank}` : ''}.`
        );
        if (typeof body.note === 'string') lines.push(body.note);
    }

    const offered = body.work as Array<{ name?: string; cashPerMonth?: number; monthsLodgingItCovers?: number; risk?: string }> | undefined;
    if (Array.isArray(offered)) {
        if (offered.length === 0) {
            lines.push(
                'Nobody here is hiring anyone, for anything. Somewhere with more people in it ' +
                'will have something.'
            );
        } else {
            lines.push('What is going, for somebody standing where they are standing:');
            for (const job of offered.slice(0, 6)) {
                const keep = typeof job.monthsLodgingItCovers === 'number'
                    ? `, and a month of it keeps them about ${job.monthsLodgingItCovers} months`
                    : '';
                lines.push(`  ${job.name ?? 'unnamed work'}${keep}${job.risk ? ` (${job.risk})` : ''}.`);
            }
            lines.push(
                'A month spent earning is a month not spent cultivating. That is the whole of the choice.'
            );
        }
    }

    const prices = body.prices as MarketPrice[] | undefined;
    if (Array.isArray(prices)) {
        if (prices.length === 0) {
            lines.push(
                'Nobody here is selling anything. It is a road, or a hillside, and the nearest ' +
                'person with a stall is a long way off.'
            );
        } else {
            // The board is read out in full or it is not read out at all.
            //
            // It used to list eight and then count against twenty-five, so the
            // sentence underneath compared the purse to seventeen things the
            // player could not see. Either number can be right; having both on
            // screen cannot be.
            const shown = boardSample(prices);
            lines.push(
                shown.length === prices.length
                    ? 'What is on offer, and what it costs here:'
                    : `What is nearest to hand, of ${prices.length} things on offer:`
            );
            for (const item of shown) {
                lines.push(`  ${item.name ?? 'unnamed'}, ${priceOf(item)}.`);
            }

            // Said once, about the purse, rather than eleven times about the
            // goods. Whether a bowl of millet is out of reach is a fact about
            // the player, and repeating it on every line turns a market board
            // into a wall of the same sentence.
            const purse = body.purse as { cash?: number; spiritStones?: number } | undefined;
            const afford = shown.filter(item => item.affordable !== false).length;
            if (purse) {
                lines.push(
                    afford === 0
                        ? `The purse holds ${describePurseCash(purse)}, which is not enough for anything here.`
                        : afford === shown.length
                            ? `The purse holds ${describePurseCash(purse)}, which covers all of that.`
                            : `The purse holds ${describePurseCash(purse)}: ${afford} of those ${shown.length} are within it.`
                );
            }
        }
        // ── THE STALL NEXT TO THE COOKING POTS ───────────────────────────
        //
        // Rendered on its own rather than folded into the board above, because
        // the first question a player has about a book is not what it costs. It
        // is where the book stops and whether they can open it today, and
        // neither of those is a fact about any other line on a market board.
        //
        // Written from the defect: the game refused "buy a manual" with the
        // look people give somebody asking for a thing that is not sold, and
        // then listed millet, inns and ferry crossings - so the correct verb
        // was blocked, the free one worked, and the board never once mentioned
        // the only object in the world a beginner actually needs.
        const books = body.manuals as Array<MarketPrice & {
            openAtThisRung?: boolean; note?: string;
        }> | undefined;
        if (Array.isArray(books) && books.length > 0) {
            lines.push('On the stall beside the cooking pots, block-printed and much copied:');
            for (const book of books) {
                lines.push(
                    `  ${book.name ?? 'unnamed'}, ${priceOf({ ...book, category: 'tool' })}`
                    + `${book.openAtThisRung === false ? ', which opens above where you stand' : ''}`
                    + `. ${book.note ?? ''}`.trimEnd()
                );
            }
            lines.push(
                'Block-printed and plainly set down. What a house\'s own canon has that these do '
                + 'not is four hundred years of its teachers writing into it, which is a large '
                + 'part of what anybody sweeps a courtyard for.',
                'A book or the food. Whichever the stones go on, they do not go on the other.'
            );
        }

        // Whether this ground can still take them anywhere is the one thing a
        // price board actually decides, and it is why leaving is a goal.
        if (body.groundHereStillGives === false) {
            lines.push(
                'Whatever else is true of this place, the ground here has nothing further to give ' +
                'somebody at this rank.'
            );
        }
    }

    // AND IF THEY DIED DOING IT, SAY SO.
    //
    // Every verb that consumes time can kill somebody - untreated injuries, a
    // disturbance that lands, starvation - and only the seclusion path ever
    // reported it. `facts.ts` has rendered death since it was written and is
    // reached from the time-skip narration alone, so a cultivator who died
    // working got the wages line and then, on every turn afterwards, nothing at
    // all. Found by playing: fourteen years of farm work ended in
    // `untreated_injuries` and the game never said a word.
    //
    // Here rather than in each verb, because the next verb added would have the
    // same hole and nobody would notice.
    if (body.died === true || body.alive === false) {
        const cause = typeof body.deathCause === 'string' ? body.deathCause : null;
        lines.push(
            cause === null
                ? 'And that was the end of it.'
                : `That was the end of it: ${DEATH_IN_WORLD[cause as keyof typeof DEATH_IN_WORLD] ?? cause.replace(/_/g, ' ')}.`
        );
    }

    return lines;
}


/**
 * Put a hearing into both channels a player can reach it through.
 *
 * `lines` is the narrator's licence to have somebody say it. `prose` is the
 * zero-provider rendering, and a name that only existed in the prompt would
 * simply not happen for an operator running without a model - which would make
 * the whole mechanism a paid feature.
 */
function addHearing(facts: EngineFacts, hearing: Hearing): void {
    const fact = hearingFact(hearing);
    facts.lines.push(fact);
    facts.prose = `${facts.prose}

${fact}`;
}

/**
 * The fact of having heard a name, for the narrator's fact list.
 *
 * Says that a word was said and withholds everything else, because that is
 * genuinely all the player has. What the thing is does not travel with the
 * name, and stating it here would put the meaning in the narrator's hands one
 * sentence after the design took it out.
 */
function hearingFact(hearing: Hearing): string {
    return hearingProse(hearing);
}

export interface WorldReport {
    /** Narratable. Every line is already safe to name what it names. */
    lines: string[];
    /** Inspector only: the shape of what was withheld. */
    structure: string[];
}

/**
 * Turn a digest into the two channels the rest of this layer uses.
 *
 * The lines go to the narrator verbatim, because the world layer has already
 * done the redaction on its own side and doing it twice would only risk
 * disagreeing with it. The counts go to the inspector: how much of a span the
 * player never heard about is a fact about the simulation, and a curious player
 * can go and look, but it must not become a sentence in the prose. The moment
 * it does, "the world is mostly none of your business" becomes a status line.
 */
export function reportFromDigest(digest: PlayerDigest | null): WorldReport {
    if (!digest || digest.lines.length === 0) {
        return {
            lines: [],
            structure: digest
                ? [`World digest: nothing reached this cultivator. ${digest.unheard} event(s) passed unheard.`]
                : []
        };
    }

    return {
        lines: digest.lines.map(line => {
            const many = line.occurrences > 1 ? ` (${line.occurrences} times over the span)` : '';
            return `Year ${line.year}: ${line.text}${many}`;
        }),
        structure: [
            `World digest: ${digest.lines.length} line(s) reached this cultivator; ` +
            `${digest.unheard} event(s) reached them by no channel at all.`,
            ...digest.lines.map(line =>
                `  A ${line.kind.replace(/_/g, ' ')} reached them via ${line.channel}, in `
                + `${line.form} form, at magnitude ${line.magnitude}`
                + `${line.occurrences === 1 ? '.' : `, ${line.occurrences} times over the span.`}`)
        ]
    };
}

/**
 * What the world did while the player was busy, as inspectable rows.
 *
 * Only the structural half. The digest lines themselves are already in the
 * narration facts, and repeating them here would double every world event in
 * the play log.
 */
function worldCalls(world: WorldReport): ToolCallRecord[] {
    return world.structure.map(line => ({
        name: 'world.advanceWorldForPlay',
        action: 'world_time',
        summary: line,
        ok: true
    }));
}

/**
 * Structural truth, as inspectable rows.
 *
 * These are the categories the narrator is never shown: ordinals, grades,
 * governance, rank ladders. They are precisely what an operator auditing a run
 * wants, and precisely what would turn a scene into a lecture.
 */
function structureCalls(lines: readonly string[]): ToolCallRecord[] {
    return lines.map(line => ({
        name: 'engine.structure',
        action: 'not_narrated',
        summary: line,
        ok: true
    }));
}

/** What the crossings cut away, as inspectable rows. */
function tollCalls(lines: readonly string[]): ToolCallRecord[] {
    return lines.map(line => ({
        name: 'engine.evaluateToll',
        action: 'toll_charged',
        summary: line,
        ok: true
    }));
}

function refused(name: string, action: string, facts: EngineFacts): Execution {
    return {
        facts,
        events: [],
        timeSkip: null,
        breakthrough: null,
        outcome: 'refused',
        // The inspector gets the mechanical account, not the scene. A developer
        // reading this row wants to know exactly what failed to resolve; the
        // player already got the version where somebody looked at them blankly.
        calls: [{
            name,
            action,
            summary: facts.structure[0] ?? facts.headline,
            ok: false
        }]
    };
}

/**
 * The routing step, as an inspectable row.
 *
 * Deliberately first in the list and deliberately explicit about where the verb
 * came from: this is the one place a model influenced anything, and a player
 * auditing the run should be able to see that it influenced only this.
 */
function routingCall(plan: { action: PlannedAction; source: PlanSource; note?: string }): ToolCallRecord {
    const args = [
        plan.action.days !== undefined ? `days=${plan.action.days}` : null,
        plan.action.target !== undefined ? `target="${plan.action.target}"` : null
    ].filter(Boolean).join(', ');

    return {
        name: 'narrator.plan',
        action: plan.action.action,
        summary:
            (plan.source === 'model'
                ? 'Intent routed by the model to '
                : 'Intent parsed deterministically to ') +
            `${plan.action.action}${args ? `(${args})` : '()'}` +
            (plan.note ? ` - ${plan.note}` : '') +
            '. The verb is a member of a closed set; nothing else from the response was read.',
        ok: true,
        source: plan.source,
        ...(plan.note ? { note: plan.note } : {})
    };
}

/** The prose step. Listed so it is visibly separate from, and after, the engine. */
function narrationCall(narration: { source: 'model' | 'fallback'; note: string | null }): ToolCallRecord {
    return {
        name: 'narrator.narrate',
        action: 'narrate',
        summary: narration.source === 'model'
            ? 'Prose written by the model from the engine facts above. Not read back into state.'
            : `Prose rendered directly from the engine's own account${narration.note ? ` (${narration.note})` : ''}.`,
        ok: true,
        source: narration.source,
        ...(narration.note ? { note: narration.note } : {})
    };
}

