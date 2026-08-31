/**
 * Cultivation domain schemas.
 *
 * This is the shared contract for the entire cultivation surface: the
 * cultivator record, the survival layer (satiety / injuries / lifespan), the
 * technique and alchemy systems, sects, and the permadeath run ledger.
 *
 * Everything here is engine-authoritative. The runtime agent may read these
 * shapes and narrate them; it may never assert them.
 */

import { z } from 'zod';
import { MAX_ORDINAL } from '../engine/cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// SURVIVAL CONSTANTS
// The numbers that decide how runs end. Centralised so balance changes are
// one edit, and so tests can assert against the same source as the engine.
// ─────────────────────────────────────────────────────────────────────────

/** Satiety at a full belly. */
export const SATIETY_MAX = 100;
/** Satiety burned by any turn-consuming action. */
export const SATIETY_COST_PER_ACTION = 2;
/** Consecutive turns at zero satiety before death by starvation. */
export const STARVATION_TURNS = 5;
/** Untreated meridian injuries at which forcing another fight becomes fatal. */
export const LETHAL_UNTREATED_INJURIES = 3;
/** Years at the same realm before death by aging. */
export const STAGNATION_YEARS = 50;
/** Spirit stones every cultivator starts with. */
export const STARTING_SPIRIT_STONES = 30;
/** HP fraction below which continuing to fight without medicine is flagged suicidal. */
export const SUICIDAL_HP_FRACTION = 0.1;
/** Hard cap on rank advancement per turn, regardless of accumulated progress. */
export const MAX_RANKS_PER_TURN = 1;

// ─────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────

export const ElementSchema = z.enum([
    'metal', 'wood', 'water', 'fire', 'earth', 'lightning', 'ice'
]);
export type Element = z.infer<typeof ElementSchema>;

export const SpiritRootKeySchema = z.enum([
    'single_metal', 'single_wood', 'single_water', 'single_fire', 'single_earth',
    'dual_water_fire', 'dual_metal_wood',
    'muddled_five_element',
    'mutated_lightning', 'mutated_ice'
]);
export type SpiritRootKey = z.infer<typeof SpiritRootKeySchema>;

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
export const AmbientQiSchema = z.enum(['thin', 'normal', 'dense', 'spirit_tide']);
export type AmbientQi = z.infer<typeof AmbientQiSchema>;

/** Distribution of ambient qi. Weights are out of 100. */
export const AMBIENT_QI_WEIGHTS: Record<AmbientQi, number> = {
    thin: 50,
    normal: 35,
    spirit_tide: 10,
    dense: 5
};

/** Breakthrough-odds modifier contributed by ambient conditions. */
export const AMBIENT_QI_BREAKTHROUGH_MOD: Record<AmbientQi, number> = {
    thin: -0.15,
    normal: 0,
    dense: 0.1,
    spirit_tide: 0.2
};

/** Cultivation-rate multiplier contributed by ambient conditions. */
export const AMBIENT_QI_RATE_MULTIPLIER: Record<AmbientQi, number> = {
    thin: 0.5,
    normal: 1,
    dense: 2,
    spirit_tide: 3
};

// ─────────────────────────────────────────────────────────────────────────
// INJURIES
// Meridian damage is the game's ratchet: it accumulates, it does not heal on
// its own, and it is what turns a survivable run into a fatal one.
// ─────────────────────────────────────────────────────────────────────────

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
    /** False until treated by pill, healer, or seclusion. Untreated injuries kill. */
    treated: z.boolean().default(false),
    /** Multiplier penalty applied to cultivation speed while untreated. */
    cultivationPenalty: z.number().min(0).max(1).default(0.1),
    /** Flat penalty to breakthrough odds while untreated. */
    breakthroughPenalty: z.number().min(0).max(1).default(0.05)
});
export type Injury = z.infer<typeof InjurySchema>;

/** Penalty weights by severity, applied when an injury is created. */
export const INJURY_WEIGHTS: Record<InjurySeverity, { cultivationPenalty: number; breakthroughPenalty: number }> = {
    minor: { cultivationPenalty: 0.1, breakthroughPenalty: 0.05 },
    serious: { cultivationPenalty: 0.25, breakthroughPenalty: 0.12 },
    crippling: { cultivationPenalty: 0.5, breakthroughPenalty: 0.25 }
};

// ─────────────────────────────────────────────────────────────────────────
// FOUNDATION QUALITY
// A rank says where a cultivator stands. It does not say what they are
// standing on. Two people at Core Formation Early can have entirely different
// futures, and the difference is usually the foundation they laid at ordinal
// 12 -> 13 and what has happened to it since.
//
// Set once at the Foundation Establishment crossing from preparation, ambient
// qi, injuries and pills; mutated afterwards only by events that genuinely
// rework it (a body-refining inheritance, spending it, rebuilding it from
// wreckage). It is the engine's answer to "why did those two diverge".
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// UNDERSTANDING
//
// The third quantity, kept separate from accumulation and from foundation
// quality. Held as named insights with a degree, never as a single number and
// never as a fixed tree: which insights exist for a given cultivator is
// computed from their root, techniques, location and history, so two people
// may hold sets with no overlap.
//
// The load-bearing constraint is provenance. `InsightProvenance` has no
// default and is not optional, so an insight that cannot say which event
// produced it fails to parse at the storage boundary rather than being quietly
// written. See `engine/cultivation/understanding.ts` for why the id is derived
// from the achievement id as a second lock on the same rule.
// ─────────────────────────────────────────────────────────────────────────

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
    /**
     * First contact with a Dao this cultivator was always going to be
     * extraordinary at. Unmistakable to them; to everyone else they went
     * quiet. Nothing announced it beforehand, because nothing knew.
     */
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
 * 1 glimpse, 2 grasp, 3 intent, 4 heart, 5 dao.
 *
 * Qualitative states with names rather than levels, which is why "sword
 * intent" and "sword heart" are different things in the fiction and different
 * things here.
 */
export const InsightDegreeSchema = z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)
]);
export type InsightDegree = z.infer<typeof InsightDegreeSchema>;

/**
 * Where an insight came from. REQUIRED, with no default and no optional: an
 * insight that cannot name the event that produced it is a bug, and this is
 * the boundary that makes it impossible to persist one.
 */
export const InsightProvenanceSchema = z.object({
    /**
     * The achievement that ORIGINATED this comprehension. Stable for the life
     * of the insight, and the id the insight's own id is derived from - which
     * is what makes an untraceable insight unrepresentable rather than merely
     * discouraged.
     */
    achievementId: z.string().min(1),
    achievementKind: AchievementKindSchema,
    onDay: z.number().int().min(0),
    /**
     * Achievements that later DEEPENED it, in order. Understanding does not
     * restart at a higher degree, it goes further, so the history is a chain
     * rather than a pointer that gets overwritten.
     */
    deepenedBy: z.array(z.string().min(1)).default([]),
    /** Engine-authored account of how this understanding was arrived at. */
    account: z.string().min(1)
});
export type InsightProvenance = z.infer<typeof InsightProvenanceSchema>;

/**
 * A temporal phenomenon, shaped to be handed straight to the knowledge layer's
 * `recordKnowledge`.
 *
 * The field that matters is `factId`, which is always null: a vision is a
 * BELIEF WITH NO GROUND TRUTH BEHIND IT. The epistemics layer already
 * separates what is true from what someone holds to be true, so a prophecy is
 * just a held belief whose matching fact does not exist and may never - it can
 * be acted on, traded, doubted, and turn out to have been wrong, using
 * machinery that already exists.
 *
 * `stance` and `source.kind` are narrowed to the only values a vision can
 * have. Both are subsets of the knowledge layer's own unions, so a VisionSeed
 * remains assignable to KnowledgeInput; `understanding.ts` proves that at
 * compile time.
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

// ─────────────────────────────────────────────────────────────────────────
// EXISTENCE
//
// At low realms, body destroyed = dead. Nascent Soul breaks that equivalence,
// and above it a cultivator is better modelled as a persistent identity that
// may occupy several physical states over time than as one body plus one row.
//
// This is a small authoritative field set, not a metaphysics engine. The
// engine decides whether a transition is LEGAL; the narrator interprets what
// it means. Everything here is additive with defaults, so a row written before
// existence states existed loads as an ordinary living person.
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// THE LAST CROSSING
// Tribulation Transcendence is the approach to the Lid, not the summit. The
// attempt from its Perfection rank resolves three ways: through (True
// Immortal, ordinal 45), half-through (False Immortal, which is a STATUS and
// not a rank - they stay at 44 forever), or dead.
//
// False Immortal is a status precisely because those cultivators did not
// arrive anywhere. They are standing where they were, changed and barred.
// ─────────────────────────────────────────────────────────────────────────

export const ImmortalStatusSchema = z.enum([
    'none',            // has not attempted the last crossing
    'false_immortal',  // survived it, did not complete it, permanently barred
    'true_immortal'    // went through; ordinal 45
]);
export type ImmortalStatus = z.infer<typeof ImmortalStatusSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE CULTIVATOR
// ─────────────────────────────────────────────────────────────────────────

export const DeathCauseSchema = z.enum([
    'combat_defeat',
    'obviously_fatal_choice',
    'lifespan_exhausted',
    'stagnation_aging',
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

    // Position on the ladder.
    realmOrdinal: z.number().int().min(0).max(MAX_ORDINAL).default(0),
    /** Qi-units accumulated toward the next rank. */
    cultivationProgress: z.number().min(0).default(0),
    /**
     * What the rank is standing on. Defaults to 'none' so rows written before
     * foundations existed still parse; set at the Foundation Establishment
     * crossing and thereafter modifies cultivation rate, breakthrough odds and
     * how much a boundary crossing takes.
     */
    foundationQuality: FoundationQualitySchema.default('none'),
    /**
     * Named comprehensions, each with a degree and a traceable origin. The
     * third quantity: two cultivators at identical progress and identical
     * foundation can still have entirely different prospects, and this is why.
     *
     * Defaults to empty, which is the ordinary case - most cultivators live
     * and die having comprehended nothing anyone would record.
     */
    insights: z.array(InsightSchema).default([]),
    /** Remarkable things that actually happened, and produced the insights above. */
    achievements: z.array(AchievementSchema).default([]),
    /**
     * Result of the last crossing, if it has been attempted. Defaults to 'none'
     * so rows written before the crossing existed still parse.
     *
     * A 'false_immortal' is at ordinal 44 and permanently barred from trying
     * again - the Lid does not open twice for the same name - and carries a
     * vast but finite lifespan instead of Tribulation Transcendence's.
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
     * Where the cultivator currently is, as a free-text place name
     * ("Azure Cloud Sect outer courtyard", "the Scorched Wastes"). Deliberately
     * not an enum: this world's geography is narrative, invented by the agent
     * as the run goes, and an enum would force the engine to own a map it does
     * not simulate. The engine stores and lists it; it never reasons about it.
     */
    location: z.string().nullable().default(null),
    /** Names/ids of parties who have a standing grudge. Feuds get you killed. */
    feuds: z.array(z.string()).default([]),

    knownTechniques: z.array(z.string()).default([]),

    /**
     * Convenience boolean, kept truthful so the hundreds of existing call sites
     * that ask "is this person still a going concern" keep working.
     *
     * `existenceState` is AUTHORITATIVE. When the two could disagree, trust the
     * state and recompute this from `isGoingConcern()` in
     * `engine/cultivation/existence.ts`. A soul with no body is not `alive` in
     * any ordinary sense and is very much still playing.
     */
    alive: z.boolean().default(true),
    /**
     * What kind of existence this identity currently has. Authoritative.
     * Defaults to 'alive', so rows written before this field existed load as
     * ordinary living people.
     */
    existenceState: ExistenceStateSchema.default('alive'),
    /** Condition of the soul itself, which survives some things the body does not. */
    soulState: SoulStateSchema.default('intact'),
    /**
     * How much of the original person this actually is, 0..1.
     *
     * The field that stops a remnant being mistaken for the cultivator who left
     * it. A remnant may say "I founded this sect" in perfect sincerity and be
     * wrong, and that distinction is frequently the whole point of the
     * encounter, so it lives in state rather than in prose.
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

// ─────────────────────────────────────────────────────────────────────────
// TECHNIQUES (ARTS)
// The cultivation replacement for spells. Tiered against the realm ladder.
// ─────────────────────────────────────────────────────────────────────────

export const TechniqueCategorySchema = z.enum([
    'attack',      // offensive arts
    'defense',     // shields, body-tempering
    'movement',    // qinggong, teleportation
    'support',     // healing, buffs
    'cultivation', // qi-gathering manuals that raise cultivation rate
    'forbidden'    // powerful, corrupting, usually stolen
]);
export type TechniqueCategory = z.infer<typeof TechniqueCategorySchema>;

/** Technique grades, low to high, mirroring conventional xianxia manual tiers. */
export const TechniqueGradeSchema = z.enum(['mortal', 'earth', 'heaven', 'immortal', 'chaos']);
export type TechniqueGrade = z.infer<typeof TechniqueGradeSchema>;

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
    /** Mastery 0..1. Raised by practice, gates the technique's full effect. */
    mastery: z.number().min(0).max(1).default(0),
    description: z.string().default(''),
    /** Turns before the art may be used again. */
    cooldown: z.number().int().min(0).default(0)
});
export type Technique = z.infer<typeof TechniqueSchema>;

// ─────────────────────────────────────────────────────────────────────────
// ALCHEMY
// Pills are the only reliable way to undo damage, and they are scarce.
// ─────────────────────────────────────────────────────────────────────────

export const PillEffectSchema = z.enum([
    'heal_hp',
    'restore_qi',
    'treat_injury',
    'boost_breakthrough',
    'advance_progress',
    'extend_lifespan',
    'sate_hunger',
    'grain_abstinence',  // removes the need to eat, the logistics solution
    'cleanse_deviation'
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
    description: z.string().default('')
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
    requiredOrdinal: z.number().int().min(0).max(MAX_ORDINAL).default(0)
});
export type Recipe = z.infer<typeof RecipeSchema>;

// ─────────────────────────────────────────────────────────────────────────
// SECTS
// ─────────────────────────────────────────────────────────────────────────

export const SectAlignmentSchema = z.enum(['righteous', 'neutral', 'demonic']);

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
    description: z.string().default('')
});
export type Sect = z.infer<typeof SectSchema>;

// ─────────────────────────────────────────────────────────────────────────
// PERMADEATH RUN + DEATH LEDGER
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// THE TOLL
// A crossing exacts a price at every realm boundary - never at a
// sub-rank step. It is rolled, not guaranteed, and what it takes is never a
// stat: a bond, a memory, a mastered technique, or in the worst cases the
// cultivator's name. The cultivator does not choose. They are told.
// ─────────────────────────────────────────────────────────────────────────

export const TollKindSchema = z.enum(['bond', 'memory', 'technique', 'name']);
export type TollKind = z.infer<typeof TollKindSchema>;

export const TollOutcomeSchema = z.enum([
    'clean',        // the roll passed; the crossing passed over without taking
    'prepaid',      // the Severed already paid, on their own terms
    'taken',        // the roll failed and something that mattered is gone
    'nothing_left', // the roll failed and there was nothing worth taking
    /**
     * The True Immortal crossing. Not an instalment - the account is closed.
     * Everything the cultivator still had is taken at once, and what falls back
     * is the spirit tide a whole region will remember as a golden year.
     */
    'collected_in_full'
]);
export type TollOutcome = z.infer<typeof TollOutcomeSchema>;

/**
 * Something the run actually accumulated, offered to the crossing as a candidate.
 * The caller supplies these from real rows - real NPC bonds, real memories,
 * real techniques - because the engine layer holds no database.
 */
export const TollCandidateSchema = z.object({
    kind: z.enum(['bond', 'memory', 'technique']),
    /** Stable id of the underlying row, so the caller can delete exactly it. */
    id: z.string().min(1),
    /** Human-facing label: an NPC's name, a memory's summary, a technique's name. */
    label: z.string().min(1),
    /**
     * How much this mattered. The severance takes what mattered, so a higher
     * weight is MORE likely to be taken, not less. Defaults to 1.
     */
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
     * 'taken'; the cultivator's whole remaining ledger for 'collected_in_full'.
     */
    takenAll: z.array(TollTakenSchema).default([]),
    /**
     * Convenience view of a single instalment: always `takenAll[0] ?? null`.
     * Do not use it to decide what to delete - a True Immortal crossing takes
     * more than one thing and this field would silently under-report it.
     */
    taken: TollTakenSchema.nullable().default(null),
    narrationHint: z.string().default('')
});
export type TollResult = z.infer<typeof TollResultSchema>;

// ─────────────────────────────────────────────────────────────────────────
// TIME-SKIP SIMULATION
// "I cultivate for ten years" must resolve in one deterministic pass and hand
// back a digest the agent can narrate. It must never require per-day LLM calls.
// ─────────────────────────────────────────────────────────────────────────

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
    'lifespan_warning',
    'toll_charged',
    'foundation_established',
    /**
     * Something was there and is not any more. A distinct kind rather than a
     * flag on 'opportunity', so that counting opportunities counts things that
     * actually happened - and so the narrator can render a missed window as
     * what it is, which is one of the more characteristic experiences of a low
     * Fortune run.
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
     * Every wound the skip actually produced, in chronological order, as real
     * Injury records carrying their own ids, severity, source, description,
     * turn and penalties.
     *
     * Persist these directly. Callers must never reconstruct wounds by reading
     * the engine's own narration - severity scraped out of a summary string is
     * a database write that silently changes the next time someone rewords a
     * sentence. `deltas.injuriesGained` is the count of this array and exists
     * only for a compact summary line.
     */
    injuriesSustained: z.array(InjurySchema).default([]),
    /**
     * Every price the crossings in this skip exacted, in order. The caller
     * must apply these - delete the bond, the memory, the technique - because
     * the engine holds no database and cannot.
     */
    tolls: z.array(TollResultSchema).default([]),
    /**
     * ABSOLUTE end-of-skip values, not deltas.
     *
     * These two counters both RESET during a skip - starvation clears the
     * moment there is food again, and years-at-realm returns to zero on any
     * rank advance - so a delta against the starting value is meaningless and
     * cannot be inverted. The caller writes these straight onto the cultivator.
     */
    endState: z.object({
        /** Consecutive turns at zero satiety as the skip ended. */
        starvationTurns: z.number().int().min(0).default(0),
        /** Years at the current realm as the skip ended. */
        yearsAtCurrentRealm: z.number().min(0).default(0)
    }).default({ starvationTurns: 0, yearsAtCurrentRealm: 0 }),
    /**
     * Set if the skip crossed 12 -> 13. The caller persists it onto the
     * cultivator; it is not derivable from the ordinal afterwards.
     */
    foundationEstablished: FoundationQualitySchema.nullable().default(null),
    /**
     * Set if the skip resolved the last crossing. The caller persists it; a
     * 'false_immortal' must be written, because it is what bars the cultivator
     * from ever attempting again.
     */
    immortalStatusGained: ImmortalStatusSchema.nullable().default(null),
    /**
     * Remarkable things that actually occurred during the skip. Every one was
     * produced by an event the simulation had already resolved; nothing here
     * is handed out because a cultivator was due an advance.
     */
    achievements: z.array(AchievementSchema).default([]),
    /**
     * Understanding formed or deepened, each entry carrying the achievement
     * that produced it. Apply these to the cultivator's `insights`, keyed by
     * (domain, subject) - a repeat is a deepening, not a duplicate.
     */
    insightsGained: z.array(InsightSchema).default([]),
    /**
     * Temporal phenomena, shaped to feed the knowledge layer's
     * `recordKnowledge`. Each is a BELIEF with `factId: null` - there is no
     * fact behind it and there may never be. These grant information, never
     * capability, and nothing in the engine reads them back as a bonus.
     */
    visions: z.array(VisionSeedSchema).default([])
});
export type TimeSkipResult = z.infer<typeof TimeSkipResultSchema>;

// ─────────────────────────────────────────────────────────────────────────
// BREAKTHROUGH
// ─────────────────────────────────────────────────────────────────────────

export const BreakthroughOutcomeSchema = z.enum([
    'success', 'failure_stable', 'failure_injured', 'failure_deviation', 'death',
    /**
     * The last crossing only. The tribulation was survived and the Lid opened,
     * but the crossing did not complete. Neither a success nor a failure: the
     * ordinal does not move, and the cultivator is permanently barred from
     * trying again.
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
     * Present only on a SUCCESSFUL realm-boundary crossing, and only when the
     * caller supplied a toll context. Null everywhere else - sub-rank steps are
     * never charged.
     */
    toll: TollResultSchema.nullable().default(null),
    /**
     * Set only on the successful 12 -> 13 crossing: the foundation that was
     * actually laid, which the caller must persist onto the cultivator.
     */
    foundationEstablished: FoundationQualitySchema.nullable().default(null),
    /**
     * Set only by the last crossing: 'true_immortal' on completion,
     * 'false_immortal' on the half-failure. Null everywhere else. The caller
     * persists it onto the cultivator; for a False Immortal it is the record
     * that permanently bars any further attempt.
     */
    immortalStatusGained: ImmortalStatusSchema.nullable().default(null),
    narrationHint: z.string().default('')
});
export type BreakthroughResult = z.infer<typeof BreakthroughResultSchema>;
