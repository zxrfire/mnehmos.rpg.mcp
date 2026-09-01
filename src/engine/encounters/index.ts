/**
 * The encounter layer. See `README.md` in this directory for the contract.
 *
 * One entry point for play - {@link rollEncounters} - plus the pieces the
 * design guards and any future caller need to ask questions without rolling.
 */

export {
    ENCOUNTER_GRID_DAYS,
    SPAN_ENCOUNTER_CHANCE,
    TURN_ENCOUNTER_CHANCE,
    ARRIVAL_PER_FACT_CHANCE,
    MAX_OCCURRENCES_PER_WINDOW,
    ENCOUNTER_ACTIVITIES,
    activityProfile,
    arrivalExposure,
    sealedDoorFraction,
    concealmentScale,
    biasFor,
    interruptsThrough,
    locatabilityApplies,
    needsToFindYou,
    socialReach,
    placeKindBias,
    placeRateMultiplier,
    reaches,
    type ActivityProfile
} from './activity.js';

export { valenceOf, valenceWeights } from './valence.js';

export {
    CONTACT_SPAN_CHANCE,
    CONTACT_STRENGTH_STEP,
    CONTACT_TURN_CHANCE,
    contactFor,
    kindFor,
    tieFor,
    socialWeightFor,
    withinSocialRange,
    type Contact,
    type ContactInput,
    type ContactKind,
    type ContactPerson,
    type Standing,
    type TieChange
} from './contact.js';

export {
    CONTRIBUTION_BASE,
    CONTRIBUTION_PER_ORDINAL,
    COMMISSION_ENTRIES,
    SUMMONS_ENTRIES,
    boardRefusals,
    callsOn,
    commissionBoard,
    dutyTermsFor,
    isCommission,
    postureFor,
    scaleFor,
    summonable,
    summonsPool,
    type DutyCandidate,
    type DutyAccess,
    type DutyOrigin,
    type DutyPosture,
    type DutyScale,
    type DutyTerms,
    type RefusalTerms
} from './duties.js';

export {
    PROTECTION_REACH_RUNGS,
    approachFrom,
    approachesTo,
    beyondRecruiting,
    houseStanding,
    protectionOffered,
    recruitmentShapeAt,
    seatOfferedBy,
    type Approach,
    type HouseStanding,
    type OfferKind,
    type RecruitmentShape
} from './what-a-house-asks-of-somebody-it-cannot-order.js';

export {
    THREAT_BAND_WEIGHT,
    drawEncounter,
    encounterPool,
    outgrown,
    poolDirections,
    type PoolInput,
    type WeightedEntry
} from './select.js';

export {
    HAZARD_DAMAGE_SHARE,
    INCIDENTAL_SHARE,
    resolveOccurrence,
    stanceFor,
    type ResolveInput
} from './resolve.js';

export { fillTokens, type FillContext, type FillResult } from './tokens.js';

export {
    assessFit,
    bestFor,
    mayHoldAFit,
    pillPotencyFor,
    PILL_GRADE_FACTOR,
    PILL_HALVING_RUNGS,
    type Find,
    type FindKind,
    type Fit,
    type PillGrade,
    type FitAxis,
    type Seeker,
    type Suitability
} from './suitability.js';

export {
    assessAcquisition,
    bestAcquisition,
    canTransmit,
    extensionOption,
    findFromManual,
    type AcquisitionInput,
    type AcquisitionRefusal,
    type AcquisitionReport,
    type AcquisitionRoute,
    type ManualLike,
    type TransmissionCheck,
    type TransmissionRefusal,
    type Transmitter
} from './acquisition.js';

export {
    readQualityFor,
    sendOffFor,
    unattachedSignFor,
    type Assessment,
    type ReadQuality,
    type SendOff
} from './sendoff.js';

export {
    ARRIVAL_MIN_MAGNITUDE,
    arrivableFromUnheard,
    type ArrivableInput,
    type FactLike
} from './arrivals.js';

export {
    ARRIVAL_INTERRUPT_MAGNITUDE,
    SUMMONS_SPAN_CHANCE,
    SUMMONS_TURN_CHANCE,
    PASSES_BY_BASE,
    PASSES_BY_PER_FORTUNE,
    WINDOW_SHUT_BASE,
    WINDOW_SHUT_PER_FORTUNE,
    rollEncounters
} from './window.js';

export type {
    ArrivableFact,
    Confrontation,
    Duty,
    InProgress,
    Locatability,
    DutyMouth,
    Membership,
    Scene,
    EncounterActivity,
    EncounterDeltas,
    EncounterName,
    EncounterNamePools,
    EncounterOccurrence,
    EncounterPerson,
    EncounterPlace,
    EncounterRoll,
    EncounterRollInput,
    EncounterStance,
    EncounterValence,
    KnowledgeGrant
} from './types.js';
