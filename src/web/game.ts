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
import { LOW_SATIETY, stagnationRemaining } from '../engine/cultivation/survival.js';
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
import type { Injury } from '../schema/cultivation.js';
import { ladderOddsReport, type LadderOddsReport } from '../engine/world/ladder-odds.js';
import { round2 } from '../server/consolidated/cultivation-support.js';
import { setDb } from '../storage/index.js';
import { resetCultivationWorlds } from '../server/state/cultivation-world.js';
import { SECTS, getSect, getTechnique } from '../data/cultivation/index.js';
import { capOf, classOf } from '../data/cultivation/techniques.js';
import { NO_MANUAL_CEILING, techniqueCeiling } from '../engine/cultivation/cultivation.js';
import { getSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import { getMembersOf } from '../data/cultivation/members.js';
import {
    auditAncestralClaim,
    getSectAncestry,
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
    handlePractise
} from '../server/consolidated/technique-manage.js';
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
    type ActionName,
    type OfferIntent,
    type PetitionIntent,
    type PlanSource,
    type PlannedAction,
    type PostureIntent,
    type RecallIntent,
    type SealIntent,
    type SiteIntent
} from './actions.js';
import {
    holderOf,
    linesDownward,
    residentAbove,
    theTwoWaysDown,
    theTwoWaysStructure,
    type Resident
} from './above.js';
import {
    elderRungTitle,
    mayCommitTheHouse,
    offeringKey,
    opensAtRung,
    positionIn,
    rankDoesNotReach,
    readOffering,
    readPosture,
    readSpentSeal,
    sealKey,
    servesNoHouse,
    postureKey,
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
    readGates,
    resolveSite,
    type FateEvidence,
    type GateVerdict
} from './trials.js';
import { SITES, enterSite, type Site } from '../data/cultivation/inheritance-trials.js';
import { assessPower, resolveExchange } from '../engine/cultivation/combat.js';
import { quotePouchSale, type SaleLot } from '../engine/cultivation/market.js';
import { getHerb } from '../data/cultivation/herbs.js';
import { PILLS, getPill } from '../data/cultivation/pills.js';
import { askedAbout } from './asked.js';
import {
    hearingProse,
    offerHearing,
    othersPresent,
    recordHearing,
    type AnswerReach,
    type Hearing,
    type HearingIntent
} from './hearsay.js';
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
import { whereCouldTheyGo, type Destination } from './where-this-cultivator-could-go.js';
import { assessAcquisition, sealedDoorFraction, type AcquisitionRoute } from '../engine/encounters/index.js';
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
import { createGrudge, type Severity } from '../engine/social/grudges.js';
import type { GroundConditions } from '../engine/cultivation/cultivation.js';
import { locationHistory } from '../engine/world/locations.js';
import { npcsAt } from '../engine/world/world-state.js';
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
    factsForTimeSkip,
    factsForToolResult,
    humanDays,
    placeName,
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
import { handleAdminManage, isAdminModeEnabled } from '../server/consolidated/admin-manage.js';
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
const POINTING = /^(?:the |that |this |a |an |some )?(?:nearest |closest |nearby |other |old |young |first )*(?:cultivator|cultivators|person|people|man|woman|men|women|elder|stranger|passerby|local|villager|guard|steward|merchant|trader|monk|beggar|one|fellow|him|her|them|they)$/i;

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

export const PROVISION_COST_STONES = 2;

/**
 * Where rations bought ahead of time are kept.
 *
 * A per-cultivator counter rather than a new table: the engine already owns
 * a flag store keyed exactly this way, and a schema change to hold one
 * integer would be a migration this layer has no business writing.
 */
const FLAG_RATIONS_HELD = 'rations_held';
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
const MARKET_LINES = 8;

function priceOf(item: MarketPrice): string {
    const unit = item.unit ? ` the ${item.unit}` : '';
    const mortal = item.category === undefined || MORTAL_CATEGORIES.has(item.category);

    if (mortal && typeof item.cash === 'number') {
        return `${Math.round(item.cash)} cash${unit}`;
    }
    if (typeof item.spiritStones === 'number') {
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
    'petition', 'posture', 'seal'
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
export function doorScaleOverStretch(setByOrdinal: number, days: number): number {
    const years = Math.max(0, days) / 365;
    const halfLife = wardHalfLifeYears(setByOrdinal);
    const meanIntegrity = years <= 0
        ? 1
        : (halfLife / (years * Math.LN2)) * (1 - Math.pow(0.5, years / halfLife));
    const held = Math.min(1, Math.max(0, meanIntegrity));
    const fraction = sealedDoorFraction();
    // Linear between "the door is as set" and "there is no door".
    return fraction + (1 - fraction) * (1 - held);
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
        const previousRun = this.repos.runs.deathLedger(1)[0] ?? null;
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

        // ── phase 1 ──
        const plan = await this.narrator.plan(
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
        const execution = await this.execute(plan.action, run, cultivator, ambient, trimmed);

        // A world changed inside one turn is written before anything is
        // narrated, so a restart cannot lose an abode, a descent or a thing
        // that went down a channel. Nothing here reads the narration; the
        // ordering is only about durability.
        if (this.worldDirty) {
            this.worldDirty = false;
            await saveWorldForRun(run);
        }

        const after = this.currentRun();
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
        const execution = await this.runSeclusion(
            run, cultivator, ambient, requested, { acknowledged: options.anyway === true }
        );
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
            ?? this.repos.runs.deathLedger(1)[0]?.cultivatorId
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
        const run = this.repos.runs.getActiveRun() ?? this.repos.runs.deathLedger(1)[0] ?? null;
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
            case 'cultivate':
                return this.runSeclusion(
                    run, cultivator, ambient, action.days ?? DEFAULT_CULTIVATION_DAYS,
                    { acknowledged: GameService.TAKE_IT_ANYWAY.test(rawInput) }
                );

            case 'seclude':
                return this.runSeclusion(
                    run, cultivator, ambient, action.days ?? DEFAULT_SECLUSION_DAYS,
                    { sealed: true, acknowledged: GameService.TAKE_IT_ANYWAY.test(rawInput) }
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
                return this.attack(run, cultivator, action.target, action.intent ?? 'drive_off');

            case 'interact':
                return this.interact(
                    run, cultivator, action.target, action.intent ?? 'talk', action.topic
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
                return this.provision(run, cultivator, action.days);

            case 'status': {
                const eligibility = canAttemptBreakthrough(cultivator);
                // The ceiling belongs on the status read, not only in a
                // digest forty lines long that a player sees after the decade
                // is already spent. Asking "how am I doing" and being told
                // "0 of 100 toward the next rank" while the true answer is
                // "nothing will ever accumulate" is a status screen that lies
                // by omission.
                return this.freeAction(run, 'status', factsForStatus(
                    cultivator, ambient, eligibility.progressRequired, eligibility.eligible,
                    techniqueCeiling(
                        cultivator.realmOrdinal, this.rateTermsFor(cultivator).techniqueCap
                    ).line
                ));
            }

            case 'work':
                return this.work(cultivator, action.days ?? DEFAULT_WORK_DAYS, action.target);

            case 'market':
                return this.market(cultivator, action.target);

            case 'sect':
                return this.sect(run, cultivator, ambient, action.target, action.intent, action.topic, action.days);

            case 'recall':
                return this.recall(run, cultivator, action.target, action.intent);

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
                return this.listTechniques(run, cultivator);

            case 'acquisition':
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
                // The cheapest action available, and the whole reason it is in
                // the closed set: no time, no food, no roll, no death. A player
                // may type something ambiguous a hundred times and lose nothing
                // but a moment.
                const unread = this.freeAction(run, 'unclear', factsForRefusal(
                    'The thought does not resolve.',
                    'You turn the thought over and it does not resolve into anything you could ' +
                    'actually do standing here.'
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
     */
    private async attack(
        run: Run,
        cultivator: Cultivator,
        target: string | undefined,
        goal: string
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
                `"${query}" resolved to faction ${asFaction.id}, not to a combatant. `
                + `combat_manage.resolve takes a person. acting ordinal=${theirs ?? 'unknown'}; `
                + `membership=${position?.sectId ?? 'none'}. Routes: attack a named member, or `
                + 'posture/war from the seat.'
            ));
        }

        // A gesture at somebody in the square resolves to somebody in the
        // square. A name resolves to that name or to nothing.
        const pointed = this.somebodyAtHand(query, cultivator);
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

        const result = await handleResolve({
            action: 'resolve',
            cultivatorId: cultivator.id,
            opponent: onRecord
                ? { cultivatorId: party.id }
                : {
                    name: party.name,
                    ...(standing ? { realmOrdinal: standing.realmOrdinal } : {})
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

        return this.fromToolResult('combat_manage.resolve', 'attack', result, party.name);
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
        target: string | undefined,
        intent: string,
        topic?: string
    ): Execution {
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

        const party = pointedAt
            ? resolveCultivator(this.repos, pointedAt.name, cultivator.id, scope, cultivator.realmOrdinal)
            : resolveParty(this.repos, query, cultivator, scope);
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
        if (!party) {
            return refused('engine.resolveParty', 'interact', factsForRefusal(
                'Nobody by that name.',
                this.blankLook(cultivator),
                `Unresolved party "${query}": no knowledge record and nobody co-located. ` +
                `${this.knownNamesLine(cultivator, scope)}`
            ));
        }

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
        const offered = findWorkForOrdinal(cultivator.realmOrdinal);
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
        // that is actually being PUT TO THEM, which is `findWorkForOrdinal`'s
        // own answer narrowed by its own regard. A tie is broken by id so the
        // choice is reproducible.
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

        // The last mile. `asked.ts` decides how far the answer got; what falls
        // out of it is a name said flatly, which discovery.md calls the primary
        // way names enter a player's world. Written before the prose exists.
        const dropped = this.hear(
            cultivator, run, `ask:${asked.id}:${topic}`, asked.id,
            { intent: 'asked', reach: answer.reach });

        const facts = factsForToolResult(
            `${knownAlready || met ? asked.name : 'Somebody'}, asked about ${subject?.name ?? topic}.`,
            answer.lines
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
            case 'standing':
                return this.fromToolResult(
                    'sect_manage.standing', 'sect',
                    await handleStanding({ action: 'standing', cultivatorId: cultivator.id }),
                    'The standing'
                );
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
        const named = query.length >= 3 ? resolveSect(this.repos, query, scope, cultivator.sectId) : null;

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
            const held = positionIn(this.repos, cultivator.id);
            if (held && held.sectId !== named.id) {
                return refused('sect_manage.join', 'sect', factsForRefusal(
                    'You are already somebody\'s.',
                    `You stand as ${held.rankTitle} of ${held.sectName}, and nobody is taken on `
                    + 'twice. Whatever you have earned there is earned there and does not travel; '
                    + 'walking out is a thing you do first, and out loud, and it costs what it '
                    + 'costs.',
                    `sect_members holds ${held.sectId} at rank_index=${held.rankIndex} `
                    + `(contribution=${held.contribution}). addMember would delete that row `
                    + 'silently; the departure path owns the forfeiture and says so.'
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

        const all = (listing as { sects?: Array<{ id: string; name: string; admissible?: boolean | null }> }).sects ?? [];
        const heard = all.filter(s => this.knowledge.isAwareOf(cultivator.id, 'sect', s.id));

        const facts = heard.length === 0
            ? factsForRefusal(
                'No door you know of.',
                'You do not know the name of a single order that takes people on. Somebody would ' +
                'have to say one in front of you first, and nobody has.',
                `sect_manage.list returned ${all.length} admissible sect(s); none are known to this cultivator.`)
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
                        .filter(x => x.admissible === false)
                        .map(x => `${x.name} would not take you as you stand.`),
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
                    `chainToApex(${position.sectId}) does not contain ${named.id}. `
                    + `${standingStructure(position, null)}`
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
                ? `Sent over ${position.rankTitle} of ${position.sectName} `
                  + `(rank_index=${position.rankIndex} of ${position.rankCount}).`
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
                `getHoldingsOf(${named.id}): ${holdings.length} holding(s), 0 with a stated form. `
                + 'Counts are not disclosed either way - see Holding.countIsKnownTo.'
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
            `Holding.theForm present on ${withForm.length} line item(s) at ${named.id}; `
            + `releaseMode=${withForm.map(h => h.releaseMode).join(',')}, `
            + `anyoneMayRefuse=${withForm.map(h => String(h.anyoneMayRefuse)).join(',')}. `
            + 'Counts and grades withheld: countIsKnownTo does not include this cultivator.'
        );
        facts.structure.push(
            'Refused by construction. No state in this engine satisfies '
            + 'Holding.sufficientReason, and no argument may assert that it has been met.'
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
                ? `Filed over ${filedBy.rankTitle} of ${filedBy.sectName} `
                  + `(rank_index=${filedBy.rankIndex} of ${filedBy.rankCount}).`
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
            `posture:${position.sectId}:${named.id} = ${which}, day ${onDay}, declared by `
            + `${position.rankTitle} (rank_index=${position.rankIndex} of ${position.rankCount}, `
            + 'seat).'
        );
        if (own && theirActing !== null) {
            facts.structure.push(
                `acting ordinals: ${position.sectName}=${own.acting}, ${named.name}=${theirActing}. `
                + `Their one-off ceiling ${theirSeal?.sealedIsPublic ? `is ${theirSeal.ceiling}` : 'is not disclosed'}.`
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
                `Not this cultivator's house: membership=${position?.sectId ?? 'none'}, `
                + `target=${sectId}. Gated on reaching the seal, never on rank.`
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
                `SECT_ANCESTRY[${position.sectId}].dormant is null. The negative is phrased `
                + 'identically to a withheld positive by construction.'
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
            `sects.power_ordinal ${before} -> ${dormant.realmOrdinal} at ${position.sectId}. `
            + 'sectThreat.ceiling has become sectThreat.acting and cannot be spent again.'
        );
        facts.structure.push(
            `seal_spent:${position.sectId} written on day ${onDay}. `
            + `sealGrade=${dormant.sealGrade}, sealReason=${dormant.sealReason}, `
            + `publiclyKnown=${dormant.publiclyKnown}. Decided by ${position.rankTitle} `
            + `(rank_index=${position.rankIndex} of ${position.rankCount}, seat).`
        );
        facts.structure.push(
            `wakeCondition, unmet and not consulted: ${dormant.wakeCondition}`
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
                `SECT_ANCESTRY[${sectId}]: 0 ancestors with fate='ascended'.`
            ));
        }

        if (cost > reserves) {
            return refused('engine.offering', 'offer', factsForRefusal(
                'It cannot be paid for.',
                `What the rite costs is a decade of everything ${sect?.name ?? 'the house'} pays `
                + 'out, and the house does not hold a decade of everything it pays out. Making it '
                + 'anyway would not be an offering; it would be the end of the house with an '
                + 'offering in the middle of it.',
                `offering cost ${cost} vs baseReservesFor(stipend)=${reserves} at ${sectId}.`
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
            `offering:${sectId} written on day ${onDay}, ${cost} stones (${OFFERING_MONTHS} months `
            + `of payroll at ${monthly}/month) against reserves of ${reserves}. Decided by `
            + `${seat.rankTitle} (rank_index=${seat.rankIndex} of ${seat.rankCount}, seat).`
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
            `SECT_ANCESTRY[${sectId}]: ${ascended.length} ascended, `
            + `claimsLivingAncestor=${records?.claimsLivingAncestor ?? false}. Channel detail `
            + `${isOwn ? 'disclosed: caller is of this house' : 'withheld: caller is not of this house'}. `
            + 'claimIsTrue and afterCrossing are not read.'
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
            `layer=immortal, abode=${resident.abode?.id ?? 'none'}, `
            + `standing=${(resident.standing?.standing ?? 0).toFixed(2)} `
            + `(rank ${resident.standing?.rankAmongResidents ?? '?'} of `
            + `${resident.standing?.residentCount ?? '?'}). `
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
                `immortalStanding=${(resident.standing?.standing ?? 0).toFixed(2)}, `
                + `rank ${resident.standing?.rankAmongResidents ?? '?'} of `
                + `${resident.standing?.residentCount ?? '?'} residents. `
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
                `evaluateLidTransit(down) refused: ${transit.reason}. ${transit.detail}`
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
                `world.descend refused: ${visit.reason}.`
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
            `descent: ${weathered.struck}/${weathered.strikes} strikes landed at `
            + `${(weathered.perStrike * 100).toFixed(0)}% per strike; breaths=${visit.breaths} `
            + `(window ${BREATHS_IN_THE_LOWER_REALM.min}-${BREATHS_IN_THE_LOWER_REALM.max}); `
            + `carriedBack=${visit.carriedBack.length}, leftBehind=${visit.leftBehind.length}, `
            + `refused=${visit.refused.length}.`
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
                `world.sendAcross refused: ${result.reason}.`
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
            const facts = factsForSiteListing(
                cultivator,
                known.map(entry => ({ name: entry.name, kind: entry.kind }))
            );
            const listing = this.freeAction(run, 'site', facts);
            listing.outcome = known.length === 0 ? 'refused' : 'executed';
            listing.calls = [{
                name: 'engine.nameableSites',
                action: 'site',
                summary:
                    `${known.length} of ${SITES.length} catalogued site(s) are nameable by this `
                    + 'cultivator. Filtered by awareness; the catalog holds no locations, so nothing '
                    + 'here was filtered by distance.',
                ok: known.length > 0
            }];
            return listing;
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

        const rng = forStream(run.seed, 'site_gate', Math.floor(run.elapsedDays), site.id);
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
        const found = wanted && rolled && rolled.id === wanted.id ? rolled : rolled;

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
     */
    private async adminAct(request: string, run: Run, cultivator: Cultivator): Promise<ActResult> {
        if (!isAdminModeEnabled()) {
            throw new GameError(
                'ADMIN is off for this process. Start the server with ADMIN_MODE=true to enable it.',
                403
            );
        }

        const words = request.trim().split(/\s+/).filter(Boolean);
        const action = words.shift() ?? '';
        if (!action) {
            throw new GameError(
                `ADMIN needs an action: ${ADMIN_ACTIONS.join(', ')}. ` +
                'Arguments are key=value, for example: ADMIN spawn_site kind=grave ordinal=41'
            );
        }

        const args: Record<string, unknown> = {
            action,
            cultivatorId: cultivator.id,
            runId: run.id
        };
        for (const word of words) {
            const at = word.indexOf('=');
            if (at <= 0) continue;
            const key = word.slice(0, at);
            const raw = word.slice(at + 1);
            const asNumber = Number(raw);
            args[key] = raw !== '' && Number.isFinite(asNumber) ? asNumber : raw;
        }

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
            // `hint` is a tool invocation for a developer, and never goes to a
            // player: it names the API rather than anything in the fiction.
            const hint = typeof result.hint === 'string' ? result.hint : null;
            return refused(name, action, factsForRefusal(
                `${subject}: refused.`,
                result.message,
                `${result.error}${hint ? `. ${hint}` : ''}`
            ));
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
        options: { sealed?: boolean; acknowledged?: boolean } = {}
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

        const provisioning = this.buyProvisions(cultivator, lived);
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
            days
        );
        facts.lines.unshift(provisioning.line);

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
            facts.lines.unshift(
                'The door was sealed: no encounter and no opportunity could reach this stretch. ' +
                'Safety was bought with every chance that would have found you.'
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
            `techniqueCeiling state=${wall.state}, multiplier=0 at ordinal `
            + `${cultivator.realmOrdinal}. ${days} day(s) refused before anything was spent: `
            + 'no provisioning, no encounter roll, no time.'
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
        const dueNow = hurt.length === 0 ? restingPrice : perWound;

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
        const courses = Math.min(hurt.length, Math.floor(cultivator.spiritStones / perWound));
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
        const triage = treatWorstInjuries(applied.cultivator.injuries, courses);
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
        const resolved = query.length >= 3 ? resolvePrice(query) : null;
        const price = resolved ? getPrice(resolved.id) : undefined;

        if (!price) {
            const board = PRICES.slice(0, MARKET_LINES).map(row => row.name).join(', ');
            return refused('engine.resolvePrice', 'buy', factsForRefusal(
                'Not something anybody here sells.',
                'You ask for it and get the look people give somebody asking for a thing that is '
                + `not sold. What is: ${board}, and a dozen more besides.`,
                `Unresolved price "${query || '(nothing named)'}" against ${PRICES.length} board `
                + 'line(s). Nothing bought, nothing spent, no time passed.'
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

        const facts = factsForToolResult(`${pill.name}, bought.`, [
            `One ${pill.name}, ${cash} cash the ${price.unit}, which is ${stones} spirit `
            + `stone${stones === 1 ? '' : 's'} of the ${cultivator.spiritStones} you had.`,
            price.note,
            `${after.spiritStones} left in the purse, and the pill is in the pouch.`
        ]);
        facts.structure.push(
            `${price.id} -> ${pill.id}: ${cash} cash at the ${regionId} multiplier, charged as `
            + `${stones} stone(s). One added to cultivator_pouch.`
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
        for (const { route, how } of routes) {
            const report = assessAcquisition({
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
            });

            lines.push(
                `${how}: ${report.usable ? 'open.' : 'not open.'} ${report.headline}`
            );
            for (const line of report.lines) lines.push(`  ${line}`);

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
                reachable.push({
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
                    sameProvince: province.id === fromRegion.id
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

            reachable.push({
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
                sameProvince: found.region.id === fromRegion.id
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
                + `${unplaceable} name(s) held and unplaceable. Gated on canPointAt, the `
                + `same predicate the move verb enforces. Travel days off region `
                + `connections; qi bands off the region catalog.`,
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
     * The arts that could be learned, filtered by everything that decides it.
     *
     * Realm, spirit root, dao standing and the run's own scarcity are all the
     * handler's, and this layer chooses none of them. The conflicting list is
     * shown WITH its warning rather than hidden: an art that fights the root is
     * learnable, and it is the trade the genre is actually about.
     */
    private async listTechniques(run: Run, cultivator: Cultivator): Promise<Execution> {
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
                `Unresolved technique "${query || '(nothing named)'}". `
                + 'technique_manage.list_available answers the general form.'
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
        if (catalog) {
            const fit = fitOf(cultivator, catalog);
            execution.facts.lines.push(fit.line);
            // Into the prose as well as the lines. `factsForToolResult` builds
            // `prose` once from the lines it was given, so a line pushed
            // afterwards reaches the narrator's licence and never reaches a
            // player running without a model.
            execution.facts.prose = `${execution.facts.prose}

${fit.line}`;
            execution.facts.structure.push(
                `encounters.assessFit: ${fit.fit} at grade ordinal ${fit.gradeOrdinal}; `
                + fit.axes.map(a => `${a.axis}=${a.verdict}`).join(', ') + '.'
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
        const chosen = board.offers.find(offer =>
            matchScore(wanted, offer.entry.name) > MATCH_THRESHOLD);
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
        const held = this.repos.sects.getMembership(cultivator.id);
        if (!held) return null;
        let best: number | null = null;
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
    private provision(run: Run, cultivator: Cultivator, days?: number): Execution {
        // No span named means "as much as I can carry sensibly": enough for the
        // default seclusion, which is the thing they are about to do.
        const wanted = Math.max(
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
        const facts = factsForToolResult(
            `${bought} ration${bought === 1 ? '' : 's'} bought.`,
            [
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
        if (!stillNeedsToEat(cultivator.realmOrdinal)) return cultivator;
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
        cultivator: Pick<Cultivator, 'id' | 'realmOrdinal' | 'satiety'>,
        days: number
    ): number {
        const multiplier = satietyBurnMultiplier(cultivator.realmOrdinal);
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

    private buyProvisions(
        cultivator: Cultivator,
        days: number
    ): { cultivator: Cultivator; rations: number; covered: number; line: string } {
        const wanted = Math.ceil(days / ACTIONS_PER_FULL_SATIETY);

        // What is already in the pack comes first. A player who stocked up
        // deliberately must not be charged again at the cave mouth for food
        // they are carrying, and the ones they carried in are the ones the
        // time skip eats.
        const carried = Math.min(wanted, this.rationsHeld(cultivator));
        const short = wanted - carried;
        const affordable = Math.floor(cultivator.spiritStones / PROVISION_COST_STONES);
        const topUp = Math.max(0, Math.min(short, affordable));
        const rations = carried + topUp;
        const cost = topUp * PROVISION_COST_STONES;
        if (carried > 0) this.setRationsHeld(cultivator, this.rationsHeld(cultivator) - carried);

        if (rations === 0) {
            return {
                cultivator,
                rations: 0,
                covered: Math.floor(cultivator.satiety / 2),
                line:
                    'Nothing in the pack and nothing the purse will buy: ' +
                    `${cultivator.spiritStones} spirit stones against ${PROVISION_COST_STONES} ` +
                    `per ration. The belly covers ${Math.floor(cultivator.satiety / 2)} days ` +
                    'and then starvation begins.'
            };
        }

        const updated = cost > 0
            ? this.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -cost })
            : cultivator;
        if (!updated) throw new GameError('Cultivator vanished while buying provisions.', 500);

        const covered = rations * ACTIONS_PER_FULL_SATIETY + Math.floor(cultivator.satiety / 2);
        return {
            cultivator: updated,
            rations,
            covered,
            line: (carried > 0
                ? `${carried} ration${carried === 1 ? '' : 's'} came out of the pack` +
                  `${topUp > 0 ? `, and ${topUp} more was bought for ${cost} spirit stones` : ' and nothing had to be bought'}. `
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
        const run = this.repos.runs.getActiveRun() ?? this.repos.runs.deathLedger(1)[0] ?? null;
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
                nameTaken: this.nameTaken(cultivator)
            }),
            // "You can look at the ledger and see the shape of who you used to
            // be" is a design requirement, so the ledger is on the wire.
            tolls: listTolls(this.db, cultivator.id),
            log: this.log.list(run.id)
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
            entries.push({ role: 'engine', turn, text: line });
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
                lethalInjuryThreshold?: number;
                atLethalInjuryThreshold?: boolean;
                turnsUntilBleedOut?: number | null;
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

        // AND SAY HOW CLOSE THE THRESHOLD IS.
        //
        // Untreated wounds accumulate and the count that kills is fixed. A
        // player one short of it is one fight from dying and should be told so
        // in the words the engine uses, not left to infer it from a number they
        // never saw.
        const carried = mine?.mortality?.untreatedInjuries;
        const lethalAt = mine?.mortality?.lethalInjuryThreshold;
        if (typeof carried === 'number' && typeof lethalAt === 'number' && carried > 0) {
            lines.push(
                mine?.mortality?.atLethalInjuryThreshold === true
                    ? `${carried} untreated wounds, which is the count that kills. `
                      + 'Anything further is fatal, and nothing closes them on its own.'
                    : `${carried} untreated wound${carried === 1 ? '' : 's'} of the `
                      + `${lethalAt} that kill. They do not close on their own.`
            );
        }
        const bleed = mine?.mortality?.turnsUntilBleedOut;
        if (typeof bleed === 'number') {
            lines.push(`Bleeding. ${bleed} turn${bleed === 1 ? '' : 's'} before the meridians give out.`);
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
        // after the same discovery about hunger; the wounds were the other half
        // of it and are the faster killer, because untreated is a state that
        // does not improve and the count that kills is small.
        const carried = typeof body.untreatedInjuries === 'number'
            ? body.untreatedInjuries : null;
        const lethalAt = typeof body.lethalInjuryThreshold === 'number'
            ? body.lethalInjuryThreshold : null;
        if (carried !== null && carried > 0) {
            lines.push(
                lethalAt !== null && carried >= lethalAt
                    ? `${carried} untreated wounds, which is the count that kills. `
                      + 'Nothing about the work will close them.'
                    : `${carried} untreated wound${carried === 1 ? '' : 's'}`
                      + `${lethalAt !== null ? ` of the ${lethalAt} that kill` : ''}, `
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
            const shown = prices.slice(0, MARKET_LINES);
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
                `  ${line.kind} via ${line.channel}, form=${line.form}, ` +
                `magnitude=${line.magnitude}, occurrences=${line.occurrences}.`)
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

