/**
 * Cultivation domain schemas: the cultivator record, the survival layer, the
 * technique and alchemy systems, sects, and the permadeath run ledger.
 *
 * Everything here is engine-authoritative. The runtime agent may read these
 * shapes and narrate them; it may never assert them.
 */

import { z } from 'zod';
import {
    FALSE_IMMORTAL_ORDINAL,
    LAST_CROSSING_ORDINAL,
    MAX_ORDINAL,
    TRUE_IMMORTAL_ORDINAL,
    lifespanForOrdinal
} from '../engine/cultivation/realms.js';
import { TraditionIdSchema } from '../engine/cultivation/tradition.js';
import {
    SEX_A_LEGACY_ROW_READS_AS,
    SexSchema
} from '../engine/birth/what-sex-somebody-is-and-what-it-is-for.js';

// SURVIVAL CONSTANTS. Centralised so balance changes are one edit and tests
// assert against the same source as the engine.

/** Satiety at a full belly. */
export const SATIETY_MAX = 100;
/** Satiety burned by any turn-consuming action. */
export const SATIETY_COST_PER_ACTION = 2;
/** Consecutive turns at zero satiety before death by starvation. */
export const STARVATION_TURNS = 5;
/**
 * Open channel wounds at which a body stops mending on its own and everything it
 * tries costs more. NOT A DEATH THRESHOLD, and it used to be. Design owner:
 * "torn meridians should not kill, they don't make you bleed out... very VERY
 * annoying, but you don't die."
 *
 * Measured under the old meaning, with the food problem bought off: FIFTEEN of
 * fifteen runs died of `untreated_injuries`, every one at median age 21 and
 * median peak ordinal 2 of 47. `docs/world/climbing/injuries.md`.
 */
export const CRIPPLING_UNTREATED_INJURIES = 3;
/**
 * @deprecated Nothing lethal reads this any more - see
 * CRIPPLING_UNTREATED_INJURIES, which is the same number under the name that
 * describes what it now does. Kept so importers migrate as they come free.
 */
export const LETHAL_UNTREATED_INJURIES = CRIPPLING_UNTREATED_INJURIES;
/**
 * Days a channel has to be left open before it counts as fully neglected.
 * Ninety - a season, and far shorter than anything cultivation is denominated
 * in, so "treat it and then cultivate" stays the order that works.
 *
 * NOBODY DIES ON THIS CLOCK any more; it is severed in
 * `evaluateDeathConditions`. The counter it drives (`bleedingTurns`) is kept
 * because how long somebody has carried an open channel is a true fact about
 * them, and is what the player is shown in place of a countdown.
 */
export const BLEED_OUT_TURNS = 90;

/**
 * Fraction of maximum HP a body mends per day on its own. HP is fatigue and comes
 * back; untreated injuries are torn meridians and never do. Disabled outright at
 * the lethal untreated count - see the recovery block in `time-skip.ts`.
 *
 * HP ONLY EVER WENT DOWN, and it killed people: a cultivator at Qi Condensation
 * Layer 13, full belly, ZERO injuries, died on a three-point scratch the engine
 * says nothing followed, because the running total from every prior seclusion had
 * never come back up.
 *
 * THE RATE IS SET BY WHAT IT MUST NOT BREAK. The first attempt was 1% a day and
 * `care-ladder.test.ts` caught it: a month of mortal care hands back a FIXED
 * amount, so the calendar was handing back 30% of a body beside it and on a
 * 300-HP Nascent Soul frame the free half was three times the paid half - the
 * graded-healing-pill ladder made pointless. At 0.0005 a day a full bar takes
 * about five and a half years and a three-point scratch on a fifty-point frame
 * comes back in about four months.
 */
export const HP_RECOVERY_FRACTION_PER_DAY = 0.0005;
/**
 * Floor on the years a cultivator may plateau before settling kills them. The
 * mortal-scale figure, and the only one that applies through Qi Condensation and
 * Foundation Establishment, where 84% of runs end.
 */
export const STAGNATION_YEARS = 50;

/**
 * Fraction of a realm's own lifespan that plateau may consume.
 *
 * Capped above at 0.25 by a hard constraint: Foundation Establishment must stay
 * at exactly the STAGNATION_YEARS floor (50/200). Within that, 0.20 was measured
 * rather than guessed: at 0.15 the Void Refinement boundary (ordinal 32) missed
 * by 6%, a razor edge any later tuning would flip; 0.20 clears it with margin.
 */
export const STAGNATION_LIFESPAN_FRACTION = 0.2;

/**
 * Years at the same rank before death by aging. Flat 50 was a WALL, not a curve:
 * rank cost grows at 1.35^ordinal while the allowance stayed flat, so past
 * roughly ordinal 17 a single rank cost more years than settling permitted. A
 * seeded sweep through the real `attemptBreakthrough` measured the chance of ever
 * reaching Nascent Soul at 0.00% in thin, normal AND dense qi, with 84-92% of all
 * runs ending in settling.
 *
 * Scaling to the realm's lifespan with STAGNATION_YEARS as a floor leaves Qi
 * Condensation and Foundation at 50y exactly as they were. Deliberately NOT a
 * relaxation of the early game, where most runs end and should keep ending.
 */
export function stagnationYearsForOrdinal(ordinal: number): number {
    return Math.max(
        STAGNATION_YEARS,
        lifespanForOrdinal(ordinal) * STAGNATION_LIFESPAN_FRACTION
    );
}
/** Spirit stones every cultivator starts with. */
export const STARTING_SPIRIT_STONES = 30;
/** HP fraction below which continuing to fight without medicine is flagged suicidal. */
export const SUICIDAL_HP_FRACTION = 0.1;
/** Hard cap on rank advancement per turn, regardless of accumulated progress. */
export const MAX_RANKS_PER_TURN = 1;

// PRIMITIVES

export const ElementSchema = z.enum([
    'metal', 'wood', 'water', 'fire', 'earth', 'lightning', 'ice'
]);
export type Element = z.infer<typeof ElementSchema>;

export const SpiritRootKeySchema = z.enum([
    'single_metal', 'single_wood', 'single_water', 'single_fire', 'single_earth',
    'dual_water_fire', 'dual_metal_wood',
    'triple_metal_wood_earth', 'quad_metal_wood_earth_water',
    'muddled_five_element',
    'mutated_lightning', 'mutated_ice'
]);
export type SpiritRootKey = z.infer<typeof SpiritRootKeySchema>;

/**
 * The body somebody was born as, or null - which is 98 births in a hundred.
 *
 * Restated rather than imported from `engine/cultivation/physiques.ts` for the
 * same reason `SpiritRootKeySchema` is, and pinned against that catalog in
 * `tests/engine/cultivation/physiques.test.ts`. Only the key is persisted; rate,
 * span and cost are derived from the frozen catalog.
 */
export const PhysiqueKeySchema = z.enum([
    'profound_yin',
    'pure_yang',
    'hollow_marrow'
]);
export type PhysiqueKey = z.infer<typeof PhysiqueKeySchema>;

/**
 * Where a cultivator was born. Restated rather than imported from
 * `engine/cultivation/origin.ts` because this file is the wire contract and must
 * not depend on engine values at module-evaluation time; the two lists agreeing
 * is asserted in `tests/engine/cultivation/origin.test.ts`.
 *
 * It carries NO rank. An origin decides what somebody was handed on the day they
 * were born, and never where they stand on the ladder.
 */
export const OriginTierKeySchema = z.enum([
    'thin_county',
    'market_town',
    'minor_clan',
    'sect_retainer',
    'established_clan',
    'dao_house_bloodline',
    'apex_sect_members_child',
    'fostered_on_a_word'
]);
export type OriginTierKey = z.infer<typeof OriginTierKeySchema>;

export const InnateAttributesSchema = z.object({
    might: z.number().int().min(1).max(3).describe('Physical force. Locked at creation.'),
    insight: z.number().int().min(1).max(4).describe('Comprehension. Locked at creation.'),
    fortune: z.number().int().min(0).max(3).describe('Luck. May legally be zero.'),
    charm: z.number().int().min(1).max(3).describe('Social first impression. Locked at creation.')
});
export type InnateAttributes = z.infer<typeof InnateAttributesSchema>;

/**
 * Ambient spiritual energy where the cultivator currently stands. Directly
 * modifies cultivation rate and breakthrough odds.
 */
export const AmbientQiSchema = z.enum([
    'thin', 'normal', 'dense', 'spirit_tide',
    /**
     * A pocket of qi that nothing has drawn on: a sealed vein, an unopened ruin,
     * a secret realm.
     *
     * NOT REACHABLE BY TRAVEL. Weight 0 and deliberately absent from
     * AMBIENT_QI_ORDER, so `rollAmbientQi` can never return it however long a
     * cultivator wanders. It exists only where a caller declares a site sealed -
     * see `ambientForLocationOnDay`.
     */
    'sealed_vein'
]);
export type AmbientQi = z.infer<typeof AmbientQiSchema>;

/** Distribution of ambient qi. Weights are out of 100. */
export const AMBIENT_QI_WEIGHTS: Record<AmbientQi, number> = {
    thin: 50,
    normal: 35,
    spirit_tide: 10,
    dense: 5,
    // Zero, and it stays zero. A sealed vein is not a band the world rolls; it
    // is a place, and the only way into one is to find it.
    sealed_vein: 0
};

/** Breakthrough-odds modifier contributed by ambient conditions. */
export const AMBIENT_QI_BREAKTHROUGH_MOD: Record<AmbientQi, number> = {
    thin: -0.15,
    normal: 0,
    dense: 0.1,
    spirit_tide: 0.2,
    sealed_vein: 0.25
};

/** Cultivation-rate multiplier contributed by ambient conditions. */
export const AMBIENT_QI_RATE_MULTIPLIER: Record<AmbientQi, number> = {
    thin: 0.5,
    normal: 1,
    dense: 2,
    spirit_tide: 3,
    /**
     * Measured, not chosen: at a best-realistic sustained build the Body
     * Integration boundary needs about 1.32x more rate than dense qi supplies and
     * the two boundaries above it about 1.47x. 4x clears all three with roughly a
     * quarter margin. `docs/world/history/the-late-age.md`.
     */
    sealed_vein: 4
};

// INJURIES. Meridian damage is the game's ratchet: it accumulates and does not
// heal on its own.

export const InjurySeveritySchema = z.enum(['minor', 'serious', 'crippling']);
export type InjurySeverity = z.infer<typeof InjurySeveritySchema>;

export const InjurySourceSchema = z.enum([
    'combat', 'qi_deviation', 'failed_breakthrough', 'tribulation', 'poison', 'backlash', 'other'
]);
export type InjurySource = z.infer<typeof InjurySourceSchema>;

export const InjurySchema = z.object({
    id: z.string().uuid(),
    severity: InjurySeveritySchema,
    source: InjurySourceSchema,
    description: z.string().min(1),
    /** Turn on which the injury was sustained. */
    sustainedOnTurn: z.number().int().min(0),
    /** False until treated by pill, healer, or seclusion. */
    treated: z.boolean().default(false),
    /** Multiplier penalty applied to cultivation speed while untreated. */
    cultivationPenalty: z.number().min(0).max(1).default(0.1),
    /** Flat penalty to breakthrough odds while untreated. */
    breakthroughPenalty: z.number().min(0).max(1).default(0.05),
    /**
     * Which authored wound this is, as a key into `data/cultivation/wounds.ts`.
     * THE FIELD THAT STOPS WOUNDS BEING INVENTED: the narrator reads the row and
     * may not make one up. Mental wounds are rows in that table with
     * `nature: 'mental'` carried in THIS array - one list, two natures.
     *
     * Null means "an ordinary wound of its severity", which is what every row
     * written before the table existed is; `getWoundType` returns null for it and
     * callers treat that as the plain case. Only the KEY is persisted.
     */
    woundType: z.string().nullable().default(null)
});
export type Injury = z.infer<typeof InjurySchema>;

/** Penalty weights by severity, applied when an injury is created. */
export const INJURY_WEIGHTS: Record<InjurySeverity, { cultivationPenalty: number; breakthroughPenalty: number }> = {
    minor: { cultivationPenalty: 0.1, breakthroughPenalty: 0.05 },
    serious: { cultivationPenalty: 0.25, breakthroughPenalty: 0.12 },
    crippling: { cultivationPenalty: 0.5, breakthroughPenalty: 0.25 }
};

// FOUNDATION QUALITY. Set once at the Foundation Establishment crossing (12 ->
// 13) from preparation, ambient qi, injuries and pills; mutated afterwards only
// by events that genuinely rework it. It is the engine's answer to "why did two
// cultivators at the same rank diverge".

export const FoundationQualitySchema = z.enum([
    'none',         // below Foundation Establishment; nothing laid yet
    'exceptional',  // laid in dense qi, unhurried, with the right pill
    'stable',       // the ordinary good outcome
    'unstable',     // it holds, but it complains
    'incomplete',   // rushed; part of the structure was never formed
    'damaged',      // laid over untreated injuries, and it shows
    'transformed',  // reworked by something inhuman; fast, and noticed
    'rebuilt',      // destroyed and laid again; serviceable, never pristine
    'sacrificed'    // spent deliberately for something else
]);
export type FoundationQuality = z.infer<typeof FoundationQualitySchema>;

// UNDERSTANDING. The third quantity, held as named insights with a degree, never
// as a single number and never as a fixed tree.
//
// The load-bearing constraint is provenance: `InsightProvenance` has no default
// and is not optional, so an insight that cannot say which event produced it
// fails to parse at the storage boundary rather than being quietly written.

export const AchievementKindSchema = z.enum([
    'meditative_state',        // a rare state entered, not a session completed
    'enlightenment',           // it arrived; nobody schedules these
    'survived_extraordinary',  // still standing after something that kills people
    'profound_principle',      // comprehended something about how it all works
    'met_something_ancient',   // a powerful spirit, or worse, something older
    'extraordinary_instruction', // taught by someone who did not have to
    'witnessed_phenomenon',    // saw something that changed what is believed true
    'resolved_obstacle',       // a personal or dao obstacle, finally answered
    'unusual_opportunity',     // a cultivation opportunity that does not recur
    /** First contact with a Dao this cultivator was always going to be extraordinary at. */
    'recognition'
]);
export type AchievementKind = z.infer<typeof AchievementKindSchema>;

export const AchievementSchema = z.object({
    id: z.string().min(1),
    kind: AchievementKindSchema,
    /** Absolute day the event occurred on. */
    onDay: z.number().int().min(0),
    turn: z.number().int().min(0),
    /** Engine-authored factual account of what actually happened. */
    summary: z.string().min(1),
    detail: z.record(z.union([z.string(), z.number()])).default({})
});
export type Achievement = z.infer<typeof AchievementSchema>;

/** What kind of comprehension this is. Not a class, not a tree node. */
export const InsightDomainSchema = z.enum([
    'element',     // water-dao comprehension, a grasp of fire
    'weapon',      // sword intent, a profound grasp of the spear
    'body',        // body tempering mastery
    'formation',   // formation comprehension
    'alchemy',
    'karma',       // karmic insight
    'life_death',  // what it is to nearly not be
    'time',
    'void'
]);
export type InsightDomain = z.infer<typeof InsightDomainSchema>;

/**
 * 1 glimpse, 2 grasp, 3 intent, 4 heart, 5 dao. Qualitative states with names
 * rather than levels, which is why "sword intent" and "sword heart" are
 * different things here as well as in the fiction.
 */
export const InsightDegreeSchema = z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)
]);
export type InsightDegree = z.infer<typeof InsightDegreeSchema>;

/**
 * Where an insight came from. REQUIRED, with no default and no optional: an
 * insight that cannot name the event that produced it is a bug, and this is the
 * boundary that makes it impossible to persist one.
 */
export const InsightProvenanceSchema = z.object({
    /** The achievement that ORIGINATED this comprehension, and the id the insight's own id is derived from. */
    achievementId: z.string().min(1),
    achievementKind: AchievementKindSchema,
    onDay: z.number().int().min(0),
    /** Achievements that later DEEPENED it, in order. A chain, not an overwritten pointer. */
    deepenedBy: z.array(z.string().min(1)).default([]),
    /** Engine-authored account of how this understanding was arrived at. */
    account: z.string().min(1)
});
export type InsightProvenance = z.infer<typeof InsightProvenanceSchema>;

/**
 * A temporal phenomenon, shaped to be handed straight to the knowledge layer's
 * `recordKnowledge`. `factId` is always null: a vision is a BELIEF WITH NO
 * GROUND TRUTH BEHIND IT, so it can be acted on, traded, doubted and turn out
 * wrong using machinery that already exists.
 *
 * `stance` and `source.kind` are narrowed to subsets of the knowledge layer's own
 * unions, so a VisionSeed stays assignable to KnowledgeInput;
 * `understanding.ts` proves that at compile time.
 */
export const VisionSeedSchema = z.object({
    holderId: z.string().min(1),
    claimKey: z.string().min(1),
    stance: z.literal('believes'),
    statement: z.string().min(1),
    onDay: z.number().int().min(0),
    source: z.object({
        kind: z.literal('divined'),
        note: z.string().optional()
    }),
    /** Always null. There is nothing behind this, and there may never be. */
    factId: z.null(),
    confidence: z.number().min(0).max(1),
    tags: z.array(z.string())
});
export type VisionSeed = z.infer<typeof VisionSeedSchema>;

export const InsightSchema = z.object({
    /** Derived from the achievement id, so it cannot exist without one. */
    id: z.string().min(1),
    domain: InsightDomainSchema,
    /** What specifically: an element, a weapon, a craft, a principle. */
    subject: z.string().min(1),
    degree: InsightDegreeSchema,
    provenance: InsightProvenanceSchema
});
export type Insight = z.infer<typeof InsightSchema>;

// EXISTENCE. At low realms, body destroyed = dead; Nascent Soul breaks that
// equivalence. A small authoritative field set, not a metaphysics engine: the
// engine decides whether a transition is LEGAL, the narrator interprets what it
// means. Everything is additive with defaults, so a row written before existence
// states existed loads as an ordinary living person.

export const ExistenceStateSchema = z.enum([
    'alive',            // one body, occupied, working
    'physically_dead',  // the body went and nothing survived it: terminal
    'soul_preserved',   // consciousness persists with no body to put it in
    'remnant',          // an imprint left behind. NOT the person
    'sealed',           // intact and unable to act, for as long as that lasts
    'possessing',       // occupying a body that was not theirs
    'reincarnated',     // a genuinely new life, not a respawn
    'reconstructed',    // a rebuilt body, rarely identical to the first
    'missing',          // whereabouts unknown; aliveness genuinely unresolved
    'unknown'           // the engine has not decided, and does not have to
]);
export type ExistenceState = z.infer<typeof ExistenceStateSchema>;

export const SoulStateSchema = z.enum(['intact', 'damaged', 'fragmented', 'fading']);
export type SoulState = z.infer<typeof SoulStateSchema>;

// THE LAST CROSSING. The attempt from Tribulation Transcendence Perfection
// resolves three ways: through (True Immortal, ordinal 46), half-through (False
// Immortal, a STATUS and not a rank - they stay at 44 forever), or dead.

export const ImmortalStatusSchema = z.enum([
    'none',            // has not attempted the last crossing
    'false_immortal',  // survived it, did not complete it, permanently barred
    'true_immortal'    // went through; ordinal 46
]);
export type ImmortalStatus = z.infer<typeof ImmortalStatusSchema>;

// THE CULTIVATOR

export const DeathCauseSchema = z.enum([
    'combat_defeat',
    'obviously_fatal_choice',
    'lifespan_exhausted',
    'stagnation_aging',
    /**
     * RETIRED. Nothing produces this any more - `evaluateDeathConditions` no
     * longer returns it. Kept in the enum only so ledgers written before the
     * ruling still parse. `docs/world/climbing/injuries.md`.
     */
    'untreated_injuries',
    'starvation',
    'failed_breakthrough',
    'qi_deviation',
    'heavenly_tribulation'
]);
export type DeathCause = z.infer<typeof DeathCauseSchema>;

export const CultivatorKindSchema = z.enum(['pc', 'npc', 'enemy', 'neutral']);

export const CultivatorSchema = z.object({
    id: z.string(),
    runId: z.string().optional().describe('Permadeath run this cultivator belongs to'),
    name: z.string().min(1).max(100),
    kind: CultivatorKindSchema.default('pc'),

    // Talent - rolled once, permanent, never editable after creation.
    spiritRoot: SpiritRootKeySchema,
    attributes: InnateAttributesSchema,
    /**
     * Where they were born. Dealt at creation and permanent. Defaults to
     * 'thin_county', which is both the overwhelming majority of births and the
     * honest reading of every row written before this axis existed. Everything
     * the tier is worth is derived from the frozen table in
     * `engine/cultivation/origin.ts` rather than stored per row.
     */
    origin: OriginTierKeySchema.default('thin_county'),
    /**
     * A plain fact, dealt at creation and permanent. It moves no number, gates no
     * art, and has no bearing on who may marry whom - see
     * `engine/birth/what-sex-somebody-is-and-what-it-is-for.ts`. Two things read
     * it, and both are doors rather than modifiers: whether a child is of both
     * parents' blood, and the two Courts that admit one sex
     * (`A_HOUSE_THAT_TAKES_ONE_SEX`).
     *
     * The default means "a row written before the axis existed" and nothing more;
     * unlike `origin`'s `thin_county` it is not an honest majority of anything.
     */
    sex: SexSchema.default(SEX_A_LEGACY_ROW_READS_AS),
    /**
     * The body they were born as. Null for almost everybody.
     *
     * There is no branch anywhere on WHICH one this is and there must never be
     * one - `engine/cultivation/physiques.ts` carries that rule and the test that
     * holds it. Three things read it and each reads a number off the catalog row.
     */
    physique: PhysiqueKeySchema.nullable().default(null),
    /**
     * Which of the two roads this cultivator walks. Not flavour: it decides
     * whether a soul-directed art does anything to them and what destroying their
     * body accomplishes. Defaults to the Drawn Road, which every row written
     * before the Cut Road existed always was.
     */
    traditionId: TraditionIdSchema.default('tradition-drawn'),

    // Position on the ladder.
    realmOrdinal: z.number().int().min(0).max(MAX_ORDINAL).default(0),
    /** Qi-units accumulated toward the next rank. */
    cultivationProgress: z.number().min(0).default(0),
    /**
     * What the rank is standing on. Set at the Foundation Establishment crossing;
     * thereafter modifies cultivation rate, breakthrough odds and what a boundary
     * crossing takes.
     */
    foundationQuality: FoundationQualitySchema.default('none'),
    /** Named comprehensions, each with a degree and a traceable origin. Empty is the ordinary case. */
    insights: z.array(InsightSchema).default([]),
    /** Remarkable things that actually happened, and produced the insights above. */
    achievements: z.array(AchievementSchema).default([]),
    /**
     * Result of the last crossing. A 'false_immortal' is at ordinal 44,
     * permanently barred from trying again, and carries a vast but finite
     * lifespan instead of Tribulation Transcendence's.
     */
    immortalStatus: ImmortalStatusSchema.default('none'),

    // Vitals.
    hp: z.number().int().min(0),
    maxHp: z.number().int().min(1),
    qi: z.number().int().min(0),
    maxQi: z.number().int().min(0),
    satiety: z.number().int().min(0).max(SATIETY_MAX).default(SATIETY_MAX),
    /** Consecutive turns spent at zero satiety. Five is fatal. */
    starvationTurns: z.number().int().min(0).default(0),
    /**
     * Consecutive turns at or above CRIPPLING_UNTREATED_INJURIES open channel
     * wounds. NOT FATAL AT ANY VALUE - see BLEED_OUT_TURNS. An odometer rather
     * than a clock, cleared by treatment the moment the open count drops below
     * the threshold.
     */
    bleedingTurns: z.number().int().min(0).default(0),

    // Time and mortality.
    age: z.number().min(0).default(16).describe('Age in years'),
    /** Years spent at the current realm without advancing. Fifty is fatal. */
    yearsAtCurrentRealm: z.number().min(0).default(0),

    injuries: z.array(InjurySchema).default([]),

    // Wealth and standing.
    spiritStones: z.number().int().min(0).default(STARTING_SPIRIT_STONES),
    sectId: z.string().nullable().default(null),
    sectRank: z.string().nullable().default(null),
    /**
     * Where the cultivator currently is, as a free-text place name. Deliberately
     * not an enum: this world's geography is narrative, invented by the agent as
     * the run goes. The engine stores and lists it; it never reasons about it.
     */
    location: z.string().nullable().default(null),
    /** Names/ids of parties who have a standing grudge. */
    feuds: z.array(z.string()).default([]),

    knownTechniques: z.array(z.string()).default([]),

    /**
     * Confrontations survived, and how many were won. Counted rather than
     * recalled because `assessPower` reads `battlesSurvived` on every exchange.
     * Denormalised from `combat_records`, which stays authoritative.
     */
    battlesSurvived: z.number().int().min(0).default(0),
    battlesWon: z.number().int().min(0).default(0),

    /**
     * Convenience boolean. `existenceState` is AUTHORITATIVE: when the two could
     * disagree, trust the state and recompute this from `isGoingConcern()` in
     * `engine/cultivation/existence.ts`. A soul with no body is not `alive` in
     * any ordinary sense and is very much still playing.
     */
    alive: z.boolean().default(true),
    /** What kind of existence this identity currently has. Authoritative. */
    existenceState: ExistenceStateSchema.default('alive'),
    /** Condition of the soul itself, which survives some things the body does not. */
    soulState: SoulStateSchema.default('intact'),
    /**
     * How much of the original person this actually is, 0..1. The field that stops
     * a remnant being mistaken for the cultivator who left it: a remnant may say
     * "I founded this sect" in perfect sincerity and be wrong, so it lives in
     * state rather than in prose.
     */
    identityContinuity: z.number().min(0).max(1).default(1),
    /** Which body this identity currently occupies, if any. Null for the bodiless. */
    bodyId: z.string().nullable().default(null),
    deathCause: DeathCauseSchema.nullable().default(null),
    diedOnTurn: z.number().int().min(0).nullable().default(null),

    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
});
export type Cultivator = z.infer<typeof CultivatorSchema>;

// REGARD. How the world answers somebody, as a function of how far above or
// below the ask they are standing.
//
// THE DEFECT THIS EXISTS TO FIX: every content catalog already carries one number
// saying what rung it is pitched at - `harvestOrdinal`, `minOrdinal`,
// `requiredOrdinal`, `ordinal` - and every one was used as a floor and nothing
// else, so a False Immortal asking the ground for herbs got the same seven days
// and the same single stalk a beginner got. The only thing that moved across
// forty-five rungs was WHICH row came back.
//
// The fix is one generic quantity - gap = asker's ordinal minus the rung the
// thing is pitched at - and the one table below, which every ordinary resolver
// reads for yields, durations, prices and damage. There is no per-catalog rule
// and there must never be one: a catalog that wants a different answer moves its
// gate or sets `span` on its own record, never grows a branch.
//
// The table refuses at BOTH ends and says why at both ends. An empty list with no
// reason attached is the bug this replaces.

/**
 * The seven answers the world has, ordered from "far above them" to "far below
 * them". The windows are disjoint and cover the whole integer line.
 */
export const RegardBandSchema = z.enum([
    'unreachable',  // so far above them it is not shown, and asking does not produce it
    'overmatched',  // above them; reachable, and the margin is against them
    'stretch',      // just above them; can be had, at a price in time and risk
    'matched',      // pitched at where they stand
    'assured',      // below them; quicker, cheaper, more of it
    'beneath',      // far below them; not treated as an ask, simply done
    'dismissed'     // so far below them it is not put to them at all
]);
export type RegardBand = z.infer<typeof RegardBandSchema>;

/**
 * One row of the answer table. `minGap`/`maxGap` are inclusive and in rungs. The
 * multipliers are what the ordinary resolvers multiply their own base figure by;
 * there is no second arithmetic anywhere.
 */
export interface RegardBandRow {
    readonly band: RegardBand;
    readonly minGap: number;
    readonly maxGap: number;
    /** Whether the world puts this forward unprompted. */
    readonly offered: boolean;
    /** Whether the world declines to transact even when asked directly. */
    readonly refused: boolean;
    /** How much comes back, against a base of one. */
    readonly yieldMultiplier: number;
    /** How long it takes, against the base duration. */
    readonly durationMultiplier: number;
    /** What it costs to buy, against the list price. */
    readonly priceMultiplier: number;
    /** What a fight or a hazard here costs, against the base damage. */
    readonly damageMultiplier: number;
    /** Engine-authored factual line with a `{gap}` slot. The narrator phrases it; it never invents it. */
    readonly reaction: string;
}

/**
 * THE TABLE. Every catalog in the game reads these seven rows and only these, so
 * widening a window here changes the whole world at once.
 */
export const REGARD_BANDS: readonly RegardBandRow[] = [
    {
        band: 'unreachable',
        minGap: -Infinity,
        maxGap: -9,
        offered: false,
        refused: true,
        yieldMultiplier: 0,
        durationMultiplier: 3,
        priceMultiplier: 3,
        damageMultiplier: 6,
        reaction:
            'Pitched {gap} rungs from where they stand, which is far enough above that it is not '
            + 'put in front of them. Asking does not produce it, and being told so is the whole answer.'
    },
    {
        band: 'overmatched',
        minGap: -8,
        maxGap: -4,
        offered: false,
        refused: false,
        yieldMultiplier: 0.5,
        durationMultiplier: 2,
        priceMultiplier: 2,
        damageMultiplier: 3,
        reaction:
            'Pitched {gap} rungs from where they stand. It is within reach of a hand and the margin '
            + 'is against them; nobody offers it, and nobody stops them either.'
    },
    {
        band: 'stretch',
        minGap: -3,
        maxGap: -1,
        offered: true,
        refused: false,
        yieldMultiplier: 1,
        durationMultiplier: 1.4,
        priceMultiplier: 1.35,
        damageMultiplier: 1.6,
        reaction:
            'Pitched {gap} rungs from where they stand: just above. It can be had, and it costs more '
            + 'time and more risk than it would cost the person it was meant for.'
    },
    {
        band: 'matched',
        minGap: 0,
        maxGap: 3,
        offered: true,
        refused: false,
        yieldMultiplier: 1,
        durationMultiplier: 1,
        priceMultiplier: 1,
        damageMultiplier: 1,
        reaction:
            'Pitched {gap} rungs from where they stand, which is to say at them. Ordinary terms, '
            + 'ordinary price, ordinary risk.'
    },
    {
        band: 'assured',
        minGap: 4,
        maxGap: 9,
        offered: true,
        refused: false,
        yieldMultiplier: 3,
        durationMultiplier: 0.55,
        priceMultiplier: 0.8,
        damageMultiplier: 0.45,
        reaction:
            'Pitched {gap} rungs below where they stand. It goes quickly, it goes well, and the '
            + 'people involved adjust their terms without being asked to.'
    },
    {
        band: 'beneath',
        minGap: 10,
        maxGap: 16,
        offered: true,
        refused: false,
        yieldMultiplier: 7,
        durationMultiplier: 0.25,
        priceMultiplier: 0.55,
        damageMultiplier: 0.12,
        reaction:
            'Pitched {gap} rungs below where they stand. Nobody present treats this as a thing being '
            + 'attempted. It is simply done, and the room rearranges itself around that.'
    },
    {
        band: 'dismissed',
        minGap: 17,
        maxGap: Infinity,
        offered: false,
        refused: true,
        yieldMultiplier: 14,
        durationMultiplier: 0.1,
        priceMultiplier: 0.3,
        damageMultiplier: 0,
        reaction:
            'Pitched {gap} rungs below where they stand. Nothing here is worth their time and '
            + 'everyone can see what they are, so it is not put to them at all. If they take it '
            + 'anyway it costs them nothing, and that is its own kind of answer.'
    }
] as const;

/**
 * The optional generic column every content record may carry. Absent on almost
 * everything, which is correct: the default answer is the table above read
 * against the record's own existing gate.
 */
export const RegardProfileSchema = z.object({
    /**
     * The rung this record is pitched at. Omit to use the record's own gate
     * column - `harvestOrdinal`, `minOrdinal`, `requiredOrdinal`, `ordinal`.
     */
    gate: z.number().int().min(0).max(MAX_ORDINAL).optional(),
    /**
     * How slowly the world stops caring, against an ordinary 1. `span: 4` is
     * still taken seriously four times as far up the ladder, which is how
     * "nothing is ever fully outgrown" is said in data rather than in a branch.
     */
    span: z.number().min(0.25).max(8).optional(),
    /** Never put forward, whatever the gap says. A thing you must ask for. */
    neverOffered: z.boolean().optional(),
    /** Always put forward, at any gap. Use sparingly; it defeats the point. */
    alwaysOffered: z.boolean().optional(),
    /** Replaces the band's generic reaction line. Facts only, and may carry the same `{gap}` slot. */
    reaction: z.string().optional()
});
export type RegardProfile = z.infer<typeof RegardProfileSchema>;

// APPROACH - the half of the situation the engine cannot infer from a row. All
// of it is optional context and NONE of it is an outcome: the engine turns an
// approach into two bounded numbers - an apparent ordinal and a pressure in
// [-2, +2] - and decides everything else itself.

export const ApproachToneSchema = z.enum([
    'deferential',  // asking as a lesser. Costs standing, buys patience
    'plain',        // no posture at all. The default
    'firm',         // stating rather than asking
    'imperious',    // as an order. Reads as absurd from below and as normal from above
    'pleading',     // asking as a supplicant
    'threatening'   // with the consequence of refusal made explicit
]);
export type ApproachTone = z.infer<typeof ApproachToneSchema>;

export const ApproachLeverageSchema = z.enum([
    'none',
    'coin',    // money on the table
    'favour',  // something done for them previously
    'debt',    // something they owe and cannot deny
    'name',    // the asker's own reputation
    'sect',    // an affiliation standing behind the ask
    'force',   // the credible ability to take it
    'secret',  // something the other party would pay not to have said aloud
    /**
     * The asker themselves - an attachment, offered or already standing. A member
     * of this enum rather than a subsystem of its own, so seduction is priced by
     * the machine that already prices a purse and a threat and nothing branches
     * on the word a player typed. Leverage the asker does not have is a lie the
     * room will price.
     */
    'attachment'
]);
export type ApproachLeverage = z.infer<typeof ApproachLeverageSchema>;

export const ApproachAudienceSchema = z.enum([
    'alone',       // nobody watching. Concealment holds
    'few',         // a handful, none of them qualified to look closely
    'crowd',       // a market, a road, a hall
    'peers',       // people at the asker's own rung, who can read one another
    'superiors',   // somebody above them is present
    'enemies'      // people with a reason to look hard
]);
export type ApproachAudience = z.infer<typeof ApproachAudienceSchema>;

export const ApproachPatienceSchema = z.enum(['hurried', 'normal', 'unhurried']);
export type ApproachPatience = z.infer<typeof ApproachPatienceSchema>;

/**
 * What the narrator hands the engine about the attempt itself. Every field is
 * optional and defaulted, so a caller that knows none of this gets exactly the
 * behaviour it got before the field existed.
 */
export const ApproachSchema = z.object({
    intent: z.string().max(400).optional()
        .describe('What the player said they are attempting, in their own words. Recorded and echoed back; never parsed for an outcome.'),
    tone: ApproachToneSchema.optional()
        .describe('How it is being put. deferential | plain | firm | imperious | pleading | threatening. Defaults to plain.'),
    leverage: ApproachLeverageSchema.optional()
        .describe('What is actually behind the ask. none | coin | favour | debt | name | sect | force | secret. Defaults to none. Leverage the asker does not have is a lie the room will price.'),
    audience: ApproachAudienceSchema.optional()
        .describe('Who is watching. alone | few | crowd | peers | superiors | enemies. Decides whether a concealed rung holds.'),
    concealed: z.boolean().optional()
        .describe('True when the asker is deliberately not showing what they are. Pair with presentedAs.'),
    presentedAs: z.number().int().min(0).max(MAX_ORDINAL).optional()
        .describe('The rung they are letting the room believe. Only read when concealed is true, and only while the audience cannot see through it.'),
    patience: ApproachPatienceSchema.optional()
        .describe('hurried | normal | unhurried. Scales how long the attempt takes and how much comes out of it. Defaults to normal.'),
    witnessOrdinal: z.number().int().min(0).max(MAX_ORDINAL).optional()
        .describe('The highest rung present and paying attention, if the narrator knows it. A witness at or above the real rung sees through any concealment.'),
    note: z.string().max(400).optional()
        .describe('Anything else about the situation the engine has no column for. Carried through to the result; never acted on.')
});
export type Approach = z.infer<typeof ApproachSchema>;

/** Pressure contributed by tone. Summed with leverage, then clamped. */
export const APPROACH_TONE_PRESSURE: Record<ApproachTone, number> = {
    deferential: -1,
    plain: 0,
    firm: 1,
    imperious: 1,
    pleading: -1,
    threatening: 2
} as const;

/** Pressure contributed by what is actually behind the ask. */
export const APPROACH_LEVERAGE_PRESSURE: Record<ApproachLeverage, number> = {
    none: 0,
    coin: 1,
    favour: 1,
    debt: 1,
    name: 1,
    sect: 2,
    force: 2,
    secret: 2,
    /**
     * One, the same as coin and a favour. Somebody four rungs above you is still
     * four rungs above you however they feel about it.
     */
    attachment: 1
} as const;

/**
 * The whole of what an approach can move, in rungs. An approach changes how
 * somebody is met; it never changes what they are.
 */
export const APPROACH_PRESSURE_LIMIT = 2;

/** How long it takes and how much comes out, by how much time they gave it. */
export const APPROACH_PATIENCE_EFFECT: Record<ApproachPatience, { duration: number; yield: number }> = {
    hurried: { duration: 0.5, yield: 0.5 },
    normal: { duration: 1, yield: 1 },
    unhurried: { duration: 1.75, yield: 1.4 }
} as const;

/** Audiences that can see through a concealed rung on their own. */
export const APPROACH_PIERCING_AUDIENCES: readonly ApproachAudience[] = ['peers', 'superiors', 'enemies'] as const;

// TECHNIQUES (ARTS). The cultivation replacement for spells, tiered against the
// realm ladder.

/**
 * The two kinds of art. One is what you PRACTISE to rank up, the other is what
 * you USE to fight; `category` says what an art does mechanically, `class` says
 * which of the two kinds it is, and only one of them carries a ceiling.
 */
export const TechniqueClassSchema = z.enum([
    'cultivation', // a manual you practise to raise your rank. Carries a `cap`
    'dao'          // an art you use. No cap: what you can DO is not what you ARE
]);
export type TechniqueClass = z.infer<typeof TechniqueClassSchema>;

export const TechniqueCategorySchema = z.enum([
    'attack',      // offensive arts
    'defense',     // shields, body-tempering
    'movement',    // qinggong, teleportation
    'support',     // healing, buffs
    'cultivation', // qi-gathering manuals that raise cultivation rate
    'forbidden',   // powerful, corrupting, usually stolen
    'dual_cultivation' // requires an opposite-sex partner to function at all; see `furnace`
]);
export type TechniqueCategory = z.infer<typeof TechniqueCategorySchema>;

/** Technique grades, low to high, mirroring conventional xianxia manual tiers. */
export const TechniqueGradeSchema = z.enum(['mortal', 'earth', 'heaven', 'immortal', 'chaos']);
export type TechniqueGrade = z.infer<typeof TechniqueGradeSchema>;

/**
 * How well the book is written, worst to best; each tier names its CAUSE.
 * `engine/cultivation/manual-quality.ts` is the single authority on what a tier
 * is worth and nothing else may interpret these names.
 *
 * DO NOT FOLD THIS INTO `grade`, which is a statement about HEIGHT pinned there
 * by an enforced invariant: `GRADE_ORDINAL_BANDS` binds grade to
 * `requiredOrdinal` and `GRADE_QI_BANDS` binds it to `qiCost`, both checked on
 * every row. A market primer and an apex house's intake canon cover identical
 * rungs and are BOTH necessarily `mortal` - the exact pair this axis separates.
 */
export const ManualQualitySchema = z.enum(['corrupt', 'crude', 'sound', 'refined', 'pristine']);
export type ManualQuality = z.infer<typeof ManualQualitySchema>;

/**
 * How many people one use of an art lands on. A property of the ART and never of
 * the person holding it - what makes somebody devastating is the ordinary power
 * arithmetic applied once per person the art reached.
 *
 * Absent means `single`, which is what every art written before this existed is.
 */
export const TechniqueReachSchema = z.enum([
    /** One person. The overwhelming majority of arts, and the default. */
    'single',
    /** The one you meant and the people either side of them. A wide swing, a lash, a spray. */
    'several',
    /** It lands on a PLACE rather than a person, and everyone in it is in it. */
    'field'
]);
export type TechniqueReach = z.infer<typeof TechniqueReachSchema>;

// WHAT AN ART IS ALLOWED TO ADDRESS
//
// The one ladder in the catalog that escalates IN KIND rather than in magnitude.
// Grade says how late and how costly, `reach` says how many people, dice say how
// hard; all three are quantities, and a catalog built only out of quantities
// produces a top rung that is the bottom rung with more zeroes on it - which is
// what the arts above ordinal thirty had become.
//
//   body       A body. Yours, or the one in front of you.
//   place      A place, and a span of it. The same KIND of effect a `body` art
//              has, landed on a location instead of a person.
//   condition  What a place is LIKE rather than what is standing in it. Nobody is
//              the target; the target is the terms everybody is operating under.
//   settled    What is already FIXED about somebody: a name given, an oath sworn,
//              a debt inherited, a death decided. Frequently a SMALLER effect
//              than `condition` - what makes it a rung up is that no `condition`
//              art of any size reaches a fact. It also has no small version: you
//              cannot slightly sever a name.
//   decree     A statement, and the world is obliged. Nothing has to already be
//              there. See `DECREE_IS_NOT_A_LARGER_SETTLED` and
//              `WHAT_A_DECREE_CANNOT_SAY`.
//
// INDEPENDENT OF `era`, AND THIS IS THE GUARD THAT MATTERS. An ancient art must
// NEVER buy a higher rung on THIS ladder, or old art becomes strictly better and
// the whole era axis collapses into "old is stronger". The floors below bind both
// eras identically.
//
// INDEPENDENT OF `class`, AND THAT ONE IS AN INVARIANT. A cultivation manual
// addresses the person practising it, at every rung, for ever. What you practise
// to rank up never escalates in kind; only what you USE does.

export const TechniqueAddressSchema = z.enum([
    'body',
    'place',
    'condition',
    'settled',
    'decree'
]);
export type TechniqueAddress = z.infer<typeof TechniqueAddressSchema>;

/** The ladder, lowest first. Index is the comparison. */
export const ADDRESS_ORDER: readonly TechniqueAddress[] = [
    'body',
    'place',
    'condition',
    'settled',
    'decree'
] as const;

/** Index of an address on the ladder, for comparisons. */
export function addressRank(address: TechniqueAddress): number {
    return ADDRESS_ORDER.indexOf(address);
}

/**
 * The rung at which each address becomes permissible, anchored on realm
 * boundaries rather than on round numbers.
 *
 *   body       0   Qi Condensation.
 *   place     21   Nascent Soul, the first realm at which a cultivator stops
 *                  being a local matter.
 *   condition 33   Body Integration, where damage stops meaning what it used to.
 *   settled   44   Tribulation Transcendence Perfection: the one rung below the
 *                  Lid from which somebody looks at the boundary rather than up
 *                  at it.
 *   decree    46   True Immortal, and nothing under it.
 *
 * The bands narrow as they rise - twenty-one rungs, twelve, eleven, two, one -
 * which is the corridor thesis arriving on a second axis.
 */
export const ADDRESS_ORDINAL_FLOORS: Record<TechniqueAddress, number> = {
    body: 0,
    place: 21,
    condition: 33,
    settled: LAST_CROSSING_ORDINAL,
    decree: TRUE_IMMORTAL_ORDINAL
} as const;

/**
 * The highest address a rung permits. An art may always address something SMALLER
 * than its rung allows - most do - and may never address something larger.
 */
export function addressCeilingForOrdinal(ordinal: number): TechniqueAddress {
    let ceiling: TechniqueAddress = 'body';
    for (const address of ADDRESS_ORDER) {
        if (ordinal >= ADDRESS_ORDINAL_FLOORS[address]) ceiling = address;
    }
    return ceiling;
}

/**
 * What an art addresses when it has not said. Deliberately NOT the ceiling for
 * the rung: a row that says nothing is a row nobody has thought about, and
 * defaulting those to the top of what their rung allows would declare the ladder
 * already climbed. Read this way the catalog tops out at `place`.
 *
 * `several` IS STILL A BODY ART - three bodies is three bodies. Only `field`,
 * which lands on a place rather than a person, crosses onto the second rung; had
 * `several` implied `place`, every bandit art with a broad stroke would be
 * claiming a rung it has no business at.
 */
export function defaultAddressFor(
    t: Pick<Technique, 'class' | 'reach'>
): TechniqueAddress {
    // The invariant, not a default: a manual you practise addresses you.
    if (t.class === 'cultivation') return 'body';
    return t.reach === 'field' ? 'place' : 'body';
}

/** What this art addresses: its own answer where it has one, otherwise the default. */
export function addressOf(
    t: Pick<Technique, 'class' | 'reach' | 'addresses'>
): TechniqueAddress {
    return t.addresses ?? defaultAddressFor(t);
}

/**
 * Whether an art's declared address is legal for its rung and kind. Asserted by
 * the catalog suite rather than by a Zod refinement, for the same reason the
 * grade bands are: it is a statement about content, and content is where a
 * violation should be reported.
 */
export function addressIsLegal(
    t: Pick<Technique, 'class' | 'reach' | 'addresses' | 'requiredOrdinal'>
): boolean {
    const address = addressOf(t);
    if (t.class === 'cultivation') return address === 'body';
    return addressRank(address) <= addressRank(addressCeilingForOrdinal(t.requiredOrdinal));
}

/**
 * Why the top rung is not the rung below it with more behind it - the failure the
 * whole ladder exists to prevent. The rung below EDITS the record; this one
 * WRITES it.
 */
export const DECREE_IS_NOT_A_LARGER_SETTLED = {
    settled: 'reaches a fact the world has already fixed, and can reach nothing else at any magnitude',
    decree: 'fixes one, and needs nothing to have been true beforehand',
    theTest: 'ask what had to already be true. A decree answers nothing.'
} as const;

/**
 * The three things a decree may not say, and none of them is a balance patch: it
 * cannot speak a rung (`WHAT_AN_ART_BUYS` is the same ruling from the other
 * direction), cannot be amended (it is spoken inside
 * `BREATHS_IN_THE_LOWER_REALM` and the speaker is gone), and cannot govern -
 * which is why the world below survives the existence of the rung.
 */
export const WHAT_A_DECREE_CANNOT_SAY = {
    aRung: 'A rung is what a body is, not a thing the world has an opinion about. Stating one changes nothing, in either direction, about anybody.',
    anAmendment: 'One sentence, spoken inside the breaths. There is no second one, and no revision, ever, by anyone.',
    anAdministration: 'The world obeys the statement and not the speaker, so a decree that needs ongoing judgement receives none and runs on its flat reading for ever.'
} as const;

/**
 * The same act at forty-four, forty-five and forty-six, and what changes is not
 * volume. Forty-five is the one rung at which a statement reliably gets a reply
 * and the reply is a refusal, which is what a False Immortal IS.
 */
export const THE_WORD_AT_THE_TOP = {
    petition: { ordinal: LAST_CROSSING_ORDINAL, outcome: 'heard, and the heavens are not obliged' },
    refusal: { ordinal: FALSE_IMMORTAL_ORDINAL, outcome: 'heard, answered, and the answer is no' },
    decree: { ordinal: TRUE_IMMORTAL_ORDINAL, outcome: 'obliged' }
} as const;

/**
 * Where the qi an art runs on comes from - see {@link TechniqueSchema.runsOn}.
 * Ordered from the practitioner outwards. `'self'` is the default and the
 * ordinary case.
 */
export const TechniqueFuelSchema = z.enum([
    'self',
    'own_lifespan',
    'the_others',
    'everyone',
    'the_dead'
]);
export type TechniqueFuel = z.infer<typeof TechniqueFuelSchema>;

export const TechniqueSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    category: TechniqueCategorySchema,
    grade: TechniqueGradeSchema,
    element: ElementSchema.nullable().default(null)
        .describe('Null for elementless arts, which any root may cultivate safely'),
    /** Minimum realm ordinal required to begin learning. */
    requiredOrdinal: z.number().int().min(0).max(MAX_ORDINAL).default(0),
    /** Qi spent per use. */
    qiCost: z.number().int().min(0).default(0),
    /** Dice expression resolved by the existing dice engine, e.g. "2d6+4". */
    damage: z.string().nullable().default(null),
    /**
     * The roads this art is on: 'sword', 'formation', 'body'. Empty for an art
     * that is not on one.
     *
     * A SET, because an art is routinely on more than one road. Design owner:
     * "obviously sword formations exist so techniques can have more than one."
     *
     * Do NOT add a scalar `subject` beside it - two sources of truth, one goes
     * stale, and that is this repo's most-repeated defect.
     * `CultivationOptions.techniqueSubject` stays a scalar and
     * {@link primaryRoadOf} answers it.
     *
     * On `Technique` and not on `TechniqueEntry` deliberately: a derived art has
     * no catalog row at all, and the roads are what make a derived manual suited
     * by construction. `SUBJECT_BY_CATEGORY` in the catalog supplies the road when
     * a row does not name one; an EXTRA road is always explicit.
     */
    subjects: z.array(z.string()).default([]),
    /**
     * How many living people one practice needs, the practitioner included. 1 for
     * almost the whole catalog, 2 for the `dual_cultivation` arts. A COUNT and not
     * a two-valued flag on purpose: a cult array worked by nine is the same
     * statement with a different number in it.
     */
    requiresPeople: z.number().int().min(1).default(1),
    /**
     * Where the qi one practice runs on actually comes from. Read together with
     * {@link TechniqueSchema.requiresPeople} - `requiresPeople: 2` alone does not
     * distinguish two people sharing a road from one person spending another.
     *
     *   `'self'`          `qiCost` is the whole price. The ordinary case.
     *   `'own_lifespan'`  the practitioner pays in span.
     *   `'the_others'`    the other participants supply it and gain nothing.
     *   `'everyone'`      every participant supplies it and gains. A dao partnership.
     *   `'the_dead'`      it runs on something that is not alive.
     *
     * Read by `cultivateWithADaoPartner` and `useAFurnaceTechnique` in
     * `engine/social-leverage/an-art-that-needs-two-people.ts`, and by
     * `findTechniquesForOrdinal`'s `excludeForbidden`.
     */
    runsOn: TechniqueFuelSchema.default('self'),
    /** Mastery 0..1. Raised by practice, gates the technique's full effect. */
    mastery: z.number().min(0).max(1).default(0),
    description: z.string().default(''),
    /** Turns before the art may be used again. */
    cooldown: z.number().int().min(0).default(0),
    /** How many people one use lands on. Absent means `single`. */
    reach: TechniqueReachSchema.optional(),
    /**
     * What the art is aimed at, on the ladder that escalates in kind. Absent means
     * `defaultAddressFor` reads `class` and `reach`. Declared only where an entry
     * genuinely reaches higher, and never higher than
     * `addressCeilingForOrdinal` allows for its rung.
     */
    addresses: TechniqueAddressSchema.optional(),
    /**
     * The generic column. Absent means the ordinary bands read `requiredOrdinal`.
     * A manual worth teaching long past its band says so with `span`.
     */
    regard: RegardProfileSchema.optional(),
    /** Which kind of art this is. Resolved by the catalog's authoring helper. */
    class: TechniqueClassSchema.default('dao'),
    /**
     * THE CEILING. The rung past which this manual cannot take anybody, however
     * long they practise. Only ever set on `class: 'cultivation'`; null means
     * uncapped, which is vanishingly rare.
     *
     * This is what makes the faction catalog's `reliableOrdinal` true BY
     * CONSTRUCTION. A low-tier house teaches a low-tier manual, so it
     * structurally cannot produce a high-realm cultivator. Nothing branches on the
     * sect; the cap belongs to the book rather than to whoever handed it over.
     *
     * INDEPENDENT OF SUITABILITY, and do not fold one into the other: a perfectly
     * suited manual still runs out, and an ill-suited one teaches nothing at any
     * height.
     *
     * `techniqueExhausted` in `engine/cultivation/cultivation.ts` stops dead at
     * the cap rather than tapering toward it - a ceiling that gets gradually
     * stickier reads as bad luck, one that stops dead reads as a fact about the
     * book in your hands.
     */
    cap: z.number().int().min(0).max(MAX_ORDINAL).nullable().default(null),
    /**
     * How well this particular book is written. See `ManualQualitySchema`.
     * Orthogonal to `cap` in exactly the way `cap` is orthogonal to suitability.
     * Defaulted to `sound`, the identity element.
     */
    quality: ManualQualitySchema.default('sound'),
    /**
     * Root grades the manual will take at all. Empty means any root may read it.
     * Mirrors `SpiritRootGrade` in `engine/cultivation/spirit-roots.ts` as strings
     * rather than as an import, because `Find.rootGrades` in the encounters layer
     * is already `readonly string[]`.
     *
     * Authored because it was NOT: only `element` was filled in, so the root axis
     * never fired and every suitability miss a player saw read as an element miss.
     */
    rootGrades: z.array(z.string()).default([]),
    /**
     * Comprehension domain the manual cannot be worked without, or null. Read by
     * `assessFit`, which already judges it and had nothing to judge because
     * nothing populated it.
     */
    domain: InsightDomainSchema.nullable().default(null),
    /** Minimum degree in that domain. Ignored when `domain` is null. */
    domainDegree: z.number().min(0).default(1),
    /**
     * Ordered ids of the OBJECT rows that carry this work in parts, or null for a
     * single-volume work. A volume is a physical copy of a piece of the book, so
     * it lives in the object catalog with a holder and a provenance; its power is
     * one rung below the whole by `shardPower`, the same arithmetic that turns a
     * broken blade into a worse blade.
     *
     * There is deliberately NO second cap field: the cap of a partial set is
     * derived by the engine from how many volumes are held.
     */
    volumes: z.array(z.string()).nullable().default(null),
    /**
     * Whether somebody at sufficient dao standing could write the continuation
     * themselves rather than finding it. False on almost everything: derivation is
     * the prodigy's road, not the way missing content gets papered over.
     */
    derivable: z.boolean().default(false),
    /**
     * THE HARD OPENING. What it costs to begin a method far beyond the reader, or
     * null for a book that simply works when you sit down.
     *
     * `requiredOrdinal` is the wrong instrument for a treasure: gating a cap-33
     * book behind ordinal 29 is exactly what makes it unable to skip anything,
     * which is the whole point of finding one. So a wide-span book is gated on
     * COMPREHENSION instead - `domain` and `domainDegree` - the one axis money
     * cannot buy.
     *
     * `rungs` is how far up from `requiredOrdinal` the difficult stretch runs and
     * `rateMultiplier` is what progress is worth inside it, well below 1. Somebody
     * handed a great canon at Foundation crawls through the opening and then it
     * opens up.
     */
    opening: z.object({
        rungs: z.number().int().min(1).max(MAX_ORDINAL),
        rateMultiplier: z.number().min(0.05).max(1)
    }).nullable().default(null)
});
export type Technique = z.infer<typeof TechniqueSchema>;

/**
 * Whether this art is on a given road - the only way anything should ask. Written
 * here rather than in the catalog so the engine can ask without importing
 * content, and defensive about a missing array because `GatedTechnique` and
 * friends are `Pick`s that predate the widening.
 */
export function isOnRoad(
    technique: { subjects?: readonly string[] | null },
    road: string
): boolean {
    return (technique.subjects ?? []).includes(road);
}

/**
 * The one road to name when only one may be named, or null for an art on none.
 *
 * FIRST, NOT BEST, and the ordering is the catalog's: the road an art is
 * primarily on is written first. `CultivationOptions.techniqueSubject` wants
 * exactly this - a single road to match a comprehension against for a bonus - and
 * giving it a set would make one art match several insights, which is a balance
 * change rather than a widening.
 */
export function primaryRoadOf(
    technique: { subjects?: readonly string[] | null }
): string | null {
    return (technique.subjects ?? [])[0] ?? null;
}

// ALCHEMY. Pills are the only reliable way to undo damage, and they are scarce.

export const PillEffectSchema = z.enum([
    'heal_hp',
    'restore_qi',
    'treat_injury',
    'boost_breakthrough',
    'advance_progress',
    'extend_lifespan',
    'sate_hunger',
    'grain_abstinence',  // removes the need to eat, the logistics solution
    'cleanse_deviation',
    /**
     * Ends the soul, and the body with it. The only entry that is not a benefit,
     * and the only one whose potency figure means nothing.
     *
     * Not suicide with extra steps: dying leaves knowledge rows filed under the id
     * and a body a Nascent Soul can still read, whereas this makes
     * `whatASoulSearchTakes` answer `nothing_left`. It is the difference between
     * being killed and taking it with you.
     */
    'end_the_soul',
    /**
     * Breaks the soul open and leaves the body walking. The far end of the axis
     * `end_the_soul` sits on: one puts a soul out, the other hollows one and keeps
     * it.
     *
     * The pill hollows and appoints nobody. Whose hand the body is under is a
     * separate fact - see `a-body-under-somebody-elses-hand.ts` - so swallowing
     * one alone leaves somebody emptied and belonging to no one.
     */
    'hollow_the_soul'
]);
export type PillEffect = z.infer<typeof PillEffectSchema>;

export const PillSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    grade: TechniqueGradeSchema.describe('Pill grade uses the same tier ladder as techniques'),
    effect: PillEffectSchema,
    /** Effect magnitude; units depend on effect (HP, qi, progress, odds, years). */
    potency: z.number().default(0),
    /** Toxicity accumulates; too many pills of too high a grade poisons the body. */
    toxicity: z.number().min(0).default(0),
    /** Base market value in spirit stones. */
    value: z.number().int().min(0).default(1),
    description: z.string().default(''),
    /**
     * The generic column. A pill carries no rung column of its own, so this is
     * where its gate lives when one matters. Absent means it is met as `matched`
     * by everybody.
     */
    regard: RegardProfileSchema.optional()
});
export type Pill = z.infer<typeof PillSchema>;

export const RecipeSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    producesPillId: z.string(),
    /** Ingredient item ids and counts. */
    ingredients: z.array(z.object({
        itemId: z.string(),
        quantity: z.number().int().min(1)
    })).default([]),
    /** Base success rate before alchemy skill and cauldron quality. */
    baseSuccessRate: z.number().min(0).max(1).default(0.5),
    requiredOrdinal: z.number().int().min(0).max(MAX_ORDINAL).default(0),
    /** The generic column. Absent means the bands read `requiredOrdinal`. */
    regard: RegardProfileSchema.optional()
});
export type Recipe = z.infer<typeof RecipeSchema>;

// SECTS

export const SectAlignmentSchema = z.enum(['righteous', 'neutral', 'demonic']);
export type SectAlignment = z.infer<typeof SectAlignmentSchema>;

// THE PROTECTOR. One post, off the ladder, carrying one duty: stand for this
// house when something comes for it.
//
// NOT ON THE LADDER. `THE_OFFICE.whatItIsNot` in
// `data/cultivation/false-immortals.ts`: "not on the house's ladder at all - the
// office sits outside the ranks rather than above them, because a seat is a
// position in an order of precedence and there is no order that could contain
// one." So it is a field beside `ranks` and never an entry in it - which also
// keeps it clear of the index contract, where `ranks[rankCount - 1]` is the head,
// `rankRealmBand` derives every band from array position, and `members.ts` pins
// every member to a `rankIndex`. A rank inserted anywhere moves all three.
//
// NOT THE GUEST FLOOR (`the-three-floors-a-house-admits-at.ts`), which is
// honorary and obligation-free in both directions. The duty is what separates
// them.
//
// A MEMBER DOES NOT KNOW WHETHER THEIR HOUSE HAS ONE, OR WHO IT IS. Ruled by the
// design owner: YOU ARE ONLY TOLD WHO IS ON THE LADDER. So anything that shows a
// house's people to a player reads `ranks` and must NOT read this field - no
// roster, hall description or "who is senior here" answer may name the protector
// or say whether the chair is filled. There is no hidden-knowledge check to pass,
// because the ordinary member genuinely does not know.

/**
 * Who a house will let stand in its protector's chair.
 *
 *   filled     Anybody the house can actually bind - a retired head, a veteran
 *              who does not travel, or somebody the house RAISED. THERE MUST BE
 *              NO BRANCH ON WHICH ONE: a changed beast is a person with an
 *              ordinary row, and
 *              `a-family-that-came-down-from-a-changed-beast.ts` is explicit that
 *              a branch on "is this a beast" near a social question means the
 *              design has gone wrong. What the seat reads is what somebody owes.
 *
 *   reserved   A False Immortal, and nobody else. The house declines to seat the
 *              retired heads who are right there and qualified by any normal
 *              standard, which makes the emptiness a refusal rather than a
 *              shortage of bodies. A reserved chair is ALWAYS empty.
 *
 * THE TWO SILENCES ARE DIFFERENT AND THE ENGINE MUST NOT CONFLATE THEM:
 *
 *   reserved + heldBy null   "We will take nobody less." Eight hundred years old.
 *   filled   + heldBy null   "Nobody is in it right now." This week's news, and
 *                            says nothing about what the house would accept.
 *
 * So never render an empty chair without its policy, and never infer a
 * reservation from a vacancy. The same applies to the GRAND ELDER, which is a
 * rung rather than an office: an empty rung is not a statement.
 */
export const ProtectorPolicySchema = z.enum(['filled', 'reserved']);
export type ProtectorPolicy = z.infer<typeof ProtectorPolicySchema>;

export const HouseProtectorSchema = z.object({
    /** The house's own word for the post. No two houses used the same title. */
    title: z.string().min(3),
    policy: ProtectorPolicySchema,
    /**
     * Member id of whoever stands in it, or null for a vacant post.
     *
     * A DECLARED NULL IS NOT A MISSING FIELD. An absent `protector` means the
     * house has no such office; `heldBy: null` means the office exists and nobody
     * is in it. `THE_VACANCY` calls the reserved post "a vacancy rather than a
     * history", and a vacancy has to be representable as one.
     */
    heldBy: z.string().nullable(),
    /** Why this house holds the post the way it does. */
    note: z.string().min(80)
}).superRefine((val, ctx) => {
    // There are no serving protectors anywhere in the world, and there have
    // been none for eight hundred years. `FalseImmortalRecord.servingNow` is a
    // `z.literal(false)` for the same reason: seating one should fail a test
    // rather than pass quietly.
    if (val.policy === 'reserved' && val.heldBy !== null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['heldBy'],
            message:
                'A reserved protector post is empty by construction. Only a False Immortal may hold '
              + 'one, and there is no False Immortal standing in any house in the world. If this is '
              + 'meant to change, it is a world event and not a catalog edit.'
        });
    }
});
export type HouseProtector = z.infer<typeof HouseProtectorSchema>;

export const SectSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    alignment: SectAlignmentSchema.default('neutral'),
    /** Realm ordinal of the sect's strongest member; sets who it can bully. */
    powerOrdinal: z.number().int().min(0).max(MAX_ORDINAL).default(17),
    /** Ordered rank titles, outer disciple upward. */
    ranks: z.array(z.string()).default([
        'Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Elder', 'Grand Elder', 'Patriarch'
    ]),
    /** Minimum realm ordinal to be accepted at all. */
    admissionOrdinal: z.number().int().min(0).max(MAX_ORDINAL).default(3),
    /** Monthly spirit-stone stipend by rank index. */
    stipend: z.array(z.number().int().min(0)).default([5, 15, 40, 120, 400, 1000]),
    /**
     * The protector's chair, where this house keeps one. Deliberately NOT parallel
     * to `ranks` or `stipend`: it sits beside the ladder, so adding it moves no
     * index and re-bands nobody.
     */
    protector: HouseProtectorSchema.optional(),
    description: z.string().default('')
});
export type Sect = z.infer<typeof SectSchema>;

// PERMADEATH RUN + DEATH LEDGER

export const RunStatusSchema = z.enum(['active', 'dead', 'ascended']);

export const RunSchema = z.object({
    id: z.string(),
    cultivatorId: z.string(),
    /** Seed for every stochastic system in this run. Reproducibility is a feature. */
    seed: z.string(),
    status: RunStatusSchema.default('active'),
    /** Turns elapsed. Unlimited - this deployment has no metering. */
    turn: z.number().int().min(0).default(0),
    /** In-world elapsed time in days since the run began. */
    elapsedDays: z.number().min(0).default(0),
    startedAt: z.string(),
    endedAt: z.string().nullable().default(null),
    deathCause: DeathCauseSchema.nullable().default(null),
    deathDescription: z.string().nullable().default(null),
    /** Highest realm ordinal reached, preserved for the ledger after death. */
    peakOrdinal: z.number().int().min(0).max(MAX_ORDINAL).default(0)
});
export type Run = z.infer<typeof RunSchema>;

// THE TOLL. A crossing exacts a price at every realm boundary and never at a
// sub-rank step. It is rolled, not guaranteed, and what it takes is never a stat.
// The cultivator does not choose; they are told.

export const TollKindSchema = z.enum(['bond', 'memory', 'technique', 'name']);
export type TollKind = z.infer<typeof TollKindSchema>;

export const TollOutcomeSchema = z.enum([
    'clean',        // the roll passed; the crossing passed over without taking
    'prepaid',      // the Severed already paid, on their own terms
    'taken',        // the roll failed and something that mattered is gone
    'nothing_left', // the roll failed and there was nothing worth taking
    /** The True Immortal crossing. Not an instalment - everything still held is taken at once. */
    'collected_in_full'
]);
export type TollOutcome = z.infer<typeof TollOutcomeSchema>;

/**
 * Something the run actually accumulated, offered to the crossing as a candidate.
 * The caller supplies these from real rows because the engine layer holds no
 * database.
 */
export const TollCandidateSchema = z.object({
    kind: z.enum(['bond', 'memory', 'technique']),
    /** Stable id of the underlying row, so the caller can delete exactly it. */
    id: z.string().min(1),
    /** Human-facing label: an NPC's name, a memory's summary, a technique's name. */
    label: z.string().min(1),
    /** How much this mattered. The severance takes what mattered, so a higher weight is MORE likely to be taken. */
    weight: z.number().min(0).default(1)
});
export type TollCandidate = z.infer<typeof TollCandidateSchema>;

export const TollTakenSchema = z.object({
    kind: TollKindSchema,
    /** Null for a taken name, which is not a row the caller stores. */
    id: z.string().nullable().default(null),
    label: z.string(),
    /** Engine-authored statement of why this one, for the ledger. */
    reason: z.string()
});
export type TollTaken = z.infer<typeof TollTakenSchema>;

export const TollResultSchema = z.object({
    outcome: TollOutcomeSchema,
    fromOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    toOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** Which boundary this was, counting from 0 at 12 -> 13. */
    boundaryIndex: z.number().int().min(0),
    /** Final probability the crossing took something. */
    risk: z.number().min(0).max(1),
    /** Itemised, and sums exactly to `risk`. */
    modifiers: z.array(z.object({
        source: z.string(),
        delta: z.number()
    })).default([]),
    roll: z.number().min(0).max(1),
    /**
     * EVERYTHING this charge took, and the field callers should persist from.
     * Empty for 'clean', 'prepaid' and 'nothing_left'; exactly one entry for
     * 'taken'; the whole remaining ledger for 'collected_in_full'.
     */
    takenAll: z.array(TollTakenSchema).default([]),
    /**
     * Convenience view of a single instalment: always `takenAll[0] ?? null`. Do
     * not use it to decide what to delete - a True Immortal crossing takes more
     * than one thing and this field would silently under-report it.
     */
    taken: TollTakenSchema.nullable().default(null),
    narrationHint: z.string().default('')
});
export type TollResult = z.infer<typeof TollResultSchema>;

// TIME-SKIP SIMULATION. "I cultivate for ten years" must resolve in one
// deterministic pass and hand back a digest the agent can narrate. It must never
// require per-day LLM calls.

export const SimEventKindSchema = z.enum([
    'breakthrough_success',
    'breakthrough_failure',
    'qi_deviation',
    'injury_sustained',
    'injury_healed',
    'encounter',
    'opportunity',
    'sect_event',
    'npc_event',
    'resource_depleted',
    'starvation_warning',
    /** The meridians are open and the clock on them has started. A countdown that can still be stopped. */
    'bleeding_warning',
    'lifespan_warning',
    /**
     * The method is not carrying this cultivator any further, and `data.state`
     * says which reason: `no_method` for somebody practising nothing at all,
     * `exhausted` for a manual that has ended.
     *
     * Its own kind because this one never resolves on its own and never resolves
     * with time. Eleven of twelve measured lives died of stagnation at ordinal 0
     * without the game once mentioning it, because an ABSENCE has no natural event
     * to hang off - see `techniqueCeiling` in
     * `engine/cultivation/cultivation.ts`.
     */
    'method_ceiling',
    /**
     * The gate was open and the skip did not walk through it, because sitting
     * longer is still worth more than striking now would be.
     *
     * A standing condition the player can act on and would otherwise never learn.
     * An unattended skip strikes the instant `canAttemptBreakthrough` says yes,
     * which is by construction the WORST legal moment - no overflow has
     * accumulated, so the odds are at their minimum for that rung. Measured in
     * play: a realm boundary attempted at 2%, the floor of the whole scale,
     * killing a healthy provisioned cultivator by way of the meridian injuries a
     * boundary failure inflicts. Nobody chose it and nobody was told.
     */
    'crossing_deferred',
    'toll_charged',
    'foundation_established',
    /**
     * Something was there and is not any more. A distinct kind rather than a flag
     * on 'opportunity', so counting opportunities counts things that actually
     * happened.
     */
    'opportunity_missed',
    /** Something remarkable actually happened. Not a reward; a record. */
    'achievement',
    /** Understanding was formed or deepened, always from an achievement. */
    'insight_gained',
    /** A temporal phenomenon: information with no ground truth behind it. */
    'vision',
    'death'
]);
export type SimEventKind = z.infer<typeof SimEventKindSchema>;

export const SimEventSchema = z.object({
    kind: SimEventKindSchema,
    /** Days into the skip at which this occurred. */
    dayOffset: z.number().min(0),
    /** Engine-authored factual summary. The agent narrates from this. */
    summary: z.string(),
    /** Whether this event should interrupt the skip and return control. */
    interrupts: z.boolean().default(false),
    /**
     * How many identical events this line stands for. Printing a repeated warning
     * six times reads as a bug and buries whatever mattered; dropping five loses
     * the scale. `dayOffset` is the FIRST occurrence; `lastDayOffset` in `data` is
     * the most recent.
     */
    occurrences: z.number().int().min(1).default(1),
    data: z.record(z.unknown()).default({})
});
export type SimEvent = z.infer<typeof SimEventSchema>;

export const TimeSkipResultSchema = z.object({
    requestedDays: z.number().min(0),
    /** May be less than requested if an interrupting event or death occurred. */
    simulatedDays: z.number().min(0),
    interrupted: z.boolean().default(false),
    interruptReason: z.string().nullable().default(null),
    events: z.array(SimEventSchema).default([]),
    /** Net deltas applied over the skip, for a compact summary line. */
    deltas: z.object({
        cultivationProgress: z.number().default(0),
        realmOrdinal: z.number().int().default(0),
        hp: z.number().int().default(0),
        qi: z.number().int().default(0),
        satiety: z.number().int().default(0),
        spiritStones: z.number().int().default(0),
        age: z.number().default(0),
        injuriesGained: z.number().int().default(0)
    }),
    died: z.boolean().default(false),
    deathCause: DeathCauseSchema.nullable().default(null),
    /**
     * Every wound the skip produced, in chronological order, as real Injury
     * records. Persist these directly: callers must never reconstruct wounds by
     * reading the engine's own narration - severity scraped out of a summary
     * string is a database write that silently changes the next time somebody
     * rewords a sentence. `deltas.injuriesGained` is just the count of this array.
     */
    injuriesSustained: z.array(InjurySchema).default([]),
    /**
     * Every price the crossings in this skip exacted, in order. The caller must
     * apply these, because the engine holds no database and cannot.
     */
    tolls: z.array(TollResultSchema).default([]),
    /**
     * ABSOLUTE end-of-skip values, not deltas. These counters all RESET during a
     * skip - starvation clears when there is food, the bleed clock clears when the
     * untreated count drops back under the threshold, years-at-realm returns to
     * zero on any rank advance - so a delta against the starting value is
     * meaningless and cannot be inverted.
     */
    endState: z.object({
        /** Consecutive turns at zero satiety as the skip ended. */
        starvationTurns: z.number().int().min(0).default(0),
        /** Consecutive turns at the lethal untreated count as the skip ended. */
        bleedingTurns: z.number().int().min(0).default(0),
        /** Years at the current realm as the skip ended. */
        yearsAtCurrentRealm: z.number().min(0).default(0),
        /**
         * Rations still in the pack as the skip ended. Provisions are bought per
         * stretch, at the cave mouth, for the whole span, so a sitting that is
         * interrupted and then RESUMED would otherwise be charged a second purse
         * of food for days already paid for. Nothing in the engine reads this
         * back; the caller decides whether anything is owed.
         */
        rationsRemaining: z.number().int().min(0).default(0)
    }).default({
        starvationTurns: 0, bleedingTurns: 0, yearsAtCurrentRealm: 0, rationsRemaining: 0
    }),
    /** Set if the skip crossed 12 -> 13. Not derivable from the ordinal afterwards. */
    foundationEstablished: FoundationQualitySchema.nullable().default(null),
    /**
     * Set if the skip resolved the last crossing. A 'false_immortal' must be
     * written, because it is what bars the cultivator from ever attempting again.
     */
    immortalStatusGained: ImmortalStatusSchema.nullable().default(null),
    /**
     * Remarkable things that actually occurred during the skip. Every one was
     * produced by an event the simulation had already resolved; nothing here is
     * handed out because a cultivator was due an advance.
     */
    achievements: z.array(AchievementSchema).default([]),
    /**
     * Understanding formed or deepened. Apply these to the cultivator's
     * `insights`, keyed by (domain, subject) - a repeat is a deepening, not a
     * duplicate.
     */
    insightsGained: z.array(InsightSchema).default([]),
    /**
     * Temporal phenomena, shaped to feed the knowledge layer's `recordKnowledge`.
     * Each is a BELIEF with `factId: null`. These grant information, never
     * capability, and nothing in the engine reads them back as a bonus.
     */
    visions: z.array(VisionSeedSchema).default([])
});
export type TimeSkipResult = z.infer<typeof TimeSkipResultSchema>;

// BREAKTHROUGH

export const BreakthroughOutcomeSchema = z.enum([
    'success', 'failure_stable', 'failure_injured', 'failure_deviation', 'death',
    /**
     * The last crossing only. Neither a success nor a failure: the tribulation was
     * survived and the Lid opened, the ordinal does not move, and the cultivator
     * is permanently barred from trying again.
     */
    'false_immortal'
]);
export type BreakthroughOutcome = z.infer<typeof BreakthroughOutcomeSchema>;

/** The four outcomes produced by a failed attempt, as opposed to a stalled one. */
export const BreakthroughFailureSchema = z.enum([
    'failure_stable', 'failure_injured', 'failure_deviation', 'death'
]);
export type BreakthroughFailure = z.infer<typeof BreakthroughFailureSchema>;

export const BreakthroughResultSchema = z.object({
    outcome: BreakthroughOutcomeSchema,
    fromOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    toOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** Final probability used, after every modifier. Exposed for transparency. */
    finalChance: z.number().min(0).max(1),
    /** Itemised modifier breakdown so the UI can show its work. */
    modifiers: z.array(z.object({
        source: z.string(),
        delta: z.number()
    })).default([]),
    roll: z.number().min(0).max(1),
    injuriesSustained: z.array(InjurySchema).default([]),
    progressConsumed: z.number().min(0).default(0),
    /** Present only for Tribulation Transcendence attempts. */
    tribulation: z.object({
        strikes: z.number().int().min(0),
        survived: z.boolean()
    }).nullable().default(null),
    /**
     * Present only on a SUCCESSFUL realm-boundary crossing with a toll context.
     * Null everywhere else - sub-rank steps are never charged.
     */
    toll: TollResultSchema.nullable().default(null),
    /** Set only on the successful 12 -> 13 crossing. The caller must persist it. */
    foundationEstablished: FoundationQualitySchema.nullable().default(null),
    /**
     * Set only by the last crossing. For a False Immortal it is the record that
     * permanently bars any further attempt, so the caller must persist it.
     */
    immortalStatusGained: ImmortalStatusSchema.nullable().default(null),
    /**
     * What a FAILED realm boundary did beyond the wound already in
     * `injuriesSustained`. Present only on a boundary failure below Tribulation
     * Transcendence - lightning is authored separately and never fills this in,
     * and a sub-rank step has no trial.
     *
     * Every field is a write to state that existed before this did, and the caller
     * applies them the way it applies `foundationEstablished`. See
     * `engine/cultivation/what-goes-wrong-at-a-realm-boundary.ts`.
     */
    crossing: z.object({
        /** Which trial this wall is. Decided by ordinal alone. */
        trial: z.string(),
        /** Which row of the outcome registry was drawn. */
        outcome: z.string(),
        foundationQuality: FoundationQualitySchema.nullable().default(null),
        /** Years to ADD to age. The span spent rather than lived. */
        yearsBurned: z.number().min(0).default(0),
        /** Soul state this outcome drags them DOWN to. A floor, never an assignment. */
        soulStateFloor: SoulStateSchema.nullable().default(null),
        /**
         * What to MULTIPLY `identityContinuity` by, in (0, 1]. A factor, never an
         * assignment: ruin compounds and never restores, and written as an
         * absolute a second ruin healed the first. See `applyCrossingConsequence`.
         */
        identityContinuityFactor: z.number().min(0).max(1).nullable().default(null),
        /** True when this cultivator will never cross a realm boundary again. */
        halted: z.boolean().default(false)
    }).nullable().default(null),
    /**
     * What arriving cost the body, as a FRACTION of the pool.
     *
     * Design owner, verbatim: *"don't forget that crossing deals damage too
     * (unless via admin panel) or the immortal pill that lets you skip a ordinal -
     * that's the diff between the immortal pill and the ones that give you qi, the
     * qi ones you still have to cross and risk it."*
     *
     * Measured before this existed: six commanded crossings, ordinal 0 to 6,
     * health 40 of 40 the whole way. A crossing was free, so the one thing
     * separating the Unearned Step from a qi pill separated nothing.
     *
     * A FRACTION rather than a figure: forty points is a whole newborn and a
     * rounding error at Nascent Soul, so an absolute would mean four different
     * things on one ladder. `whatTheyDoAboutBeingWronged.hpFraction` is the
     * precedent.
     *
     * ZERO ON EVERY FAILURE - a failure has its own far more expensive wound table
     * and charging both would price one event twice. This is what ARRIVING costs.
     *
     * THE CALLER CLAMPS, and must: current health does not rise when the pool
     * does, so a cultivator low on a large frame can owe more than they have, and
     * a crossing that SUCCEEDED must not kill by arithmetic. Both callers leave at
     * least one point - see `GameService.strikeBarrier` and the auto-breakthrough
     * in `time-skip.ts`.
     */
    bodyCost: z.number().min(0).max(1).default(0),
    /**
     * A broken status this crossing ARRIVED with, when it did not land clean. The
     * cultivator is at `toOrdinal` carrying it - see the broken statuses in
     * `data/cultivation/wounds.ts`. The wound itself is already in
     * `injuriesSustained`; this names it so a caller does not have to search.
     */
    arrivedBroken: z.string().nullable().default(null),
    /**
     * A broken status this crossing REPAIRED, which the caller must now drop from
     * the wound list with `clearBrokenStatus`. Legend-rare, because the odds of
     * clearing anything while carrying a break are at the floor. Never set for a
     * broken step, which no crossing repairs.
     */
    brokenStatusCleared: z.string().nullable().default(null),
    narrationHint: z.string().default('')
});
export type BreakthroughResult = z.infer<typeof BreakthroughResultSchema>;
