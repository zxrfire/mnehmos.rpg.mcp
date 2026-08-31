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
// ash, injuries and pills; mutated afterwards only by events that genuinely
// rework it (a body-refining inheritance, spending it, rebuilding it from
// wreckage). It is the engine's answer to "why did those two diverge".
// ─────────────────────────────────────────────────────────────────────────

export const FoundationQualitySchema = z.enum([
    'none',         // below Foundation Establishment; nothing laid yet
    'exceptional',  // laid in dense ash, unhurried, with the right pill
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

    // Talent — rolled once, permanent, never editable after creation.
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
     * how visible the cultivator is to the Vault at a boundary.
     */
    foundationQuality: FoundationQualitySchema.default('none'),

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

    /** Set the moment a death condition resolves. A dead cultivator is immutable. */
    alive: z.boolean().default(true),
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
// The Vault charges an instalment at every realm boundary - never at a
// sub-rank step. It is rolled, not guaranteed, and what it takes is never a
// stat: a bond, a memory, a mastered technique, or in the worst cases the
// cultivator's name. The cultivator does not choose. They are told.
// ─────────────────────────────────────────────────────────────────────────

export const TollKindSchema = z.enum(['bond', 'memory', 'technique', 'name']);
export type TollKind = z.infer<typeof TollKindSchema>;

export const TollOutcomeSchema = z.enum([
    'clean',        // the roll passed; the Vault went past without noticing
    'prepaid',      // the Severed already paid, on their own terms
    'taken',        // the roll failed and something that mattered is gone
    'nothing_left'  // the roll failed and there was nothing worth taking
]);
export type TollOutcome = z.infer<typeof TollOutcomeSchema>;

/**
 * Something the run actually accumulated, offered to the Vault as a candidate.
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
     * How much this mattered. The Vault takes what mattered, so a higher
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
    /** Final probability the Vault took something. */
    risk: z.number().min(0).max(1),
    /** Itemised, and sums exactly to `risk`. */
    modifiers: z.array(z.object({
        source: z.string(),
        delta: z.number()
    })).default([]),
    roll: z.number().min(0).max(1),
    /** Null unless `outcome` is 'taken'. */
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
     * Every instalment the Vault charged during the skip, in order. The caller
     * must apply these - delete the bond, the memory, the technique - because
     * the engine holds no database and cannot.
     */
    tolls: z.array(TollResultSchema).default([]),
    /**
     * Set if the skip crossed 12 -> 13. The caller persists it onto the
     * cultivator; it is not derivable from the ordinal afterwards.
     */
    foundationEstablished: FoundationQualitySchema.nullable().default(null)
});
export type TimeSkipResult = z.infer<typeof TimeSkipResultSchema>;

// ─────────────────────────────────────────────────────────────────────────
// BREAKTHROUGH
// ─────────────────────────────────────────────────────────────────────────

export const BreakthroughOutcomeSchema = z.enum([
    'success', 'failure_stable', 'failure_injured', 'failure_deviation', 'death'
]);
export type BreakthroughOutcome = z.infer<typeof BreakthroughOutcomeSchema>;

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
    narrationHint: z.string().default('')
});
export type BreakthroughResult = z.infer<typeof BreakthroughResultSchema>;
