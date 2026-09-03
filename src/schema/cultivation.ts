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
/**
 * Open channel wounds at which a body stops coping: it no longer mends on its
 * own, and everything it tries costs more.
 *
 * ── IT IS NOT A DEATH THRESHOLD, AND IT USED TO BE ────────────────────────
 *
 * Design owner, reversing the original decision: "torn meridians should not
 * kill, they don't make you bleed out. it should be the same as a torn muscle
 * irl. very VERY annoying, but you don't die. but you probably lose combat
 * effectiveness of some sort or maybe cultivation speed (but not
 * comprehension)."
 *
 * This number used to mean "forcing another fight is fatal" and, with
 * BLEED_OUT_TURNS beside it, "and standing still is fatal too". Measured on the
 * sampled strategy with the food problem bought off so the wound was the only
 * thing left to end anybody: FIFTEEN of fifteen runs died of
 * `untreated_injuries`, every one at median age 21 and median peak ordinal 2 of
 * 47, and the three stretch lengths gave identical results because the ninety
 * day clock fired inside the first stretch whatever its length. A wound that
 * ends every life before it has begun is not a hazard, it is a wall in front of
 * the content. See `docs/world/climbing/injuries.md`.
 *
 * What it means now is what `mendingBlocked` in time-skip.ts already used it
 * for: a body carrying this many open channels has stopped healing itself and
 * has to be treated by somebody. Very annoying, entirely survivable.
 *
 * `LETHAL_UNTREATED_INJURIES` is kept as a deprecated alias below because a
 * dozen modules import it and renaming them all at once in a shared tree sweeps
 * up other people's work. New code should use this name.
 */
export const CRIPPLING_UNTREATED_INJURIES = 3;
/**
 * @deprecated Nothing lethal reads this any more - see
 * CRIPPLING_UNTREATED_INJURIES, which is the same number under the name that
 * describes what it now does. Kept so importers migrate as they come free.
 */
export const LETHAL_UNTREATED_INJURIES = CRIPPLING_UNTREATED_INJURIES;
/**
 * Days a channel has to be left open before it is considered fully neglected.
 * Ninety - a season.
 *
 * ── THIS IS NO LONGER A CLOCK ANYBODY DIES ON ─────────────────────────────
 *
 * It was: ninety consecutive days at the untreated threshold ended the run with
 * `deathCause: 'untreated_injuries'`. That is the mechanism the ruling above
 * reversed, and it is severed in `evaluateDeathConditions`. Nothing in the
 * engine now reads this number to kill anybody.
 *
 * The counter it drives (`bleedingTurns`) is kept and still advances, because
 * how long somebody has been carrying an open channel is a true and useful fact
 * about them - it is what the player is shown instead of a countdown, and it is
 * the mechanism a wound that genuinely haemorrhages would use if one is ever
 * written. The number itself keeps its size for the reason it was originally
 * chosen: it is far shorter than anything cultivation is denominated in, so
 * "treat it and then cultivate" stays the order that works.
 */
export const BLEED_OUT_TURNS = 90;

/**
 * Fraction of maximum HP a body mends per day on its own.
 *
 * HP ONLY EVER WENT DOWN, and it killed people. Measured in play: a cultivator
 * at Qi Condensation Layer 13, age 38 of a 100-year lifespan, full belly, ZERO
 * injuries, 22 of 50 settling years, died on this:
 *
 *     Day 90: A minor disturbance interrupted cultivation and cost 3 HP.
 *             Nothing followed it.
 *     Day 90: died at Qi Condensation Layer 13, age 38: combat defeat.
 *
 * Killed by a three-point scratch the engine itself says nothing followed,
 * because the running total from every prior seclusion had never come back up.
 * The design owner's ruling: "hp should recover ambiently (unless you are so
 * injured you are slowly dying). being medium injured and going into seclusion
 * to recover IS one way of fixing it."
 *
 * So the line is between two systems that already exist and had come to behave
 * like one:
 *
 *   HP                   fatigue and damage. Comes back. This constant.
 *   untreated injuries   torn meridians. Do NOT come back, ever, on their own,
 *                        and the bleed clock above is what they do instead.
 *
 * THE RATE IS SET BY WHAT IT MUST NOT BREAK, not by what would feel generous.
 * The first attempt at this was 1% a day - a full bar in a hundred days - and
 * `care-ladder.test.ts` caught it immediately, which is exactly what that file
 * exists for. A month of mortal care takes thirty days, so at 1% a day the
 * treatment was handing back a FIXED amount while the calendar handed back 30%
 * of a body beside it, and on a 300-HP Nascent Soul frame the free half was
 * three times the paid half. That is the "wounds are answered by graded healing
 * pills" ladder made pointless, which is the same mistake that file already
 * records having been made once.
 *
 * So: 0.0005 a day, a full bar from empty in about five and a half years.
 *
 *   - Seclusion is denominated in YEARS, and the owner's case is a cultivator
 *     who "goes into seclusion to recover". Five years of sitting for a whole
 *     body is a real answer at the scale this game actually runs at.
 *   - A month of care restores its fixed amount plus 1.5% of the frame, which
 *     is noise beside it. The ladder is untouched and a pill is still the only
 *     answer to a wound that is urgent.
 *   - The death this exists to prevent is chip damage carried across decades:
 *     three points off a fifty-point frame comes back in about four months, so
 *     the scratch never survives to meet the next one.
 *
 * It is also disabled outright at the lethal untreated count - see the recovery
 * block in `time-skip.ts` for that gate and the two beside it.
 */
export const HP_RECOVERY_FRACTION_PER_DAY = 0.0005;
/**
 * Floor on the years a cultivator may plateau before settling kills them.
 *
 * The mortal-scale figure, and the only one that applies through Qi
 * Condensation and Foundation Establishment - where 84% of runs end, and where
 * this cruelty is correct and load-bearing.
 */
export const STAGNATION_YEARS = 50;

/**
 * Fraction of a realm's own lifespan that plateau is permitted to consume.
 *
 * 0.20 - a fifth of the span the realm grants, and bounded above by a hard
 * constraint: Foundation Establishment must stay at exactly the STAGNATION_YEARS
 * floor, which caps the fraction at 50/200 = 0.25. Going higher would relax the
 * early game, where 84% of runs end and the cruelty is load-bearing.
 *
 * Within that ceiling, 0.20 was measured rather than guessed. At 0.15 the
 * Void Refinement boundary (ordinal 32) missed by 6% - a razor edge that any
 * later tuning would flip - while 0.20 clears it with margin and still leaves
 * headroom below the 0.25 cap. The allowance stays a real pressure throughout:
 * a Nascent Soul cultivator must still cross within 200 of their 1000 years.
 */
export const STAGNATION_LIFESPAN_FRACTION = 0.2;

/**
 * Years at the same rank before death by aging, for a cultivator at `ordinal`.
 *
 * ── Why this scales ──────────────────────────────────────────────────────
 *
 * Settling was written as a mortal-scale pressure, and as a flat 50 years it
 * was exactly right at Qi Condensation, where a cultivator has 100 years to
 * spend. It was incoherent everywhere above that: the realm grants 500 years,
 * or 1000, and then a constant with no relationship to that lifespan kills
 * them long before they have used it.
 *
 * Worse, it was not a difficulty curve but a WALL. Rank cost grows at
 * 1.35^ordinal while the allowance stayed flat, so past roughly ordinal 17 a
 * single rank cost more years of accumulation than settling permitted - and
 * nothing whatsoever could rescue it. Not insights, not pills, not dense qi,
 * not sect backing, not an inheritance. A seeded sweep through the real
 * `attemptBreakthrough` measured the chance of ever reaching Nascent Soul at
 * 0.00% in thin, normal AND dense qi, with 84-92% of all runs ending in
 * settling. The upper two thirds of the ladder were decorative, which quietly
 * contradicted a setting whose ancient sects and dormant ancestors have to
 * have come from somewhere.
 *
 * So the allowance is now proportional to the timescale the realm itself
 * grants, with STAGNATION_YEARS as a floor that leaves the early game exactly
 * as it was:
 *
 *   Qi Condensation    100y lifespan  ->   50y   (floor; unchanged)
 *   Foundation         200y           ->   50y   (floor; unchanged)
 *   Core Formation     500y           ->  100y
 *   Nascent Soul      1000y           ->  200y
 *   Deity             2000y           ->  400y
 *   Void Refinement   5000y           -> 1000y
 *
 * This is deliberately NOT a relaxation of the early game, which is where the
 * overwhelming majority of runs end and should keep ending.
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
    'triple_metal_wood_earth', 'quad_metal_wood_earth_water',
    'muddled_five_element',
    'mutated_lightning', 'mutated_ice'
]);
export type SpiritRootKey = z.infer<typeof SpiritRootKeySchema>;

/**
 * Where a cultivator was born, which is the third thing they are dealt.
 *
 * Restated here rather than imported from `engine/cultivation/origin.ts` for
 * the same reason `SpiritRootKeySchema` is: this file is the wire contract and
 * must not depend on engine values at module-evaluation time. The two lists
 * agreeing is asserted in `tests/engine/cultivation/origin.test.ts`.
 *
 * It carries NO rank. An origin decides what a cultivator was handed on the
 * day they were born - stones, placement, access, standing, and what a family
 * will fund somebody walking into somewhere lethal - and never where they
 * stand on the ladder.
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
     * A pocket of qi that nothing has drawn on: a sealed vein, an unopened
     * ruin, a secret realm. Denser than anything the open world can still
     * produce, because it is a piece of an older age that nobody has breathed.
     *
     * NOT REACHABLE BY TRAVEL. It carries weight 0 and is deliberately absent
     * from AMBIENT_QI_ORDER, so `rollAmbientQi` can never return it however
     * long a cultivator wanders. It exists only where a caller declares a site
     * to be sealed, which means it has to be found, opened and held rather
     * than stood in - see `ambientForLocationOnDay`.
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
     * 4x, and it is the only thing in the present day that makes the top of
     * the ladder passable at all.
     *
     * Measured rather than chosen: at a best-realistic sustained build the
     * Body Integration boundary needs about 1.32x more rate than dense qi
     * supplies, and the two boundaries above it need about 1.47x. 4x clears
     * all three with roughly a quarter margin, which is enough that a run can
     * plausibly do it and not so much that the site stops being the whole
     * story. See `docs/world/history/the-late-age.md`.
     */
    sealed_vein: 4
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
    breakthroughPenalty: z.number().min(0).max(1).default(0.05),
    /**
     * Which authored wound this is, as a key into `data/cultivation/wounds.ts`.
     *
     * THE FIELD THAT STOPS WOUNDS BEING INVENTED. A wound is a row with a name,
     * a nature, an authored description, a permanence and a stated treatment;
     * the narrator reads it and may not make one up. Heart demons, madness and
     * half-madness are rows in that table with `nature: 'mental'`, carried in
     * THIS array alongside the physical ones - one list, two natures - because
     * a second list beside this one is a list nothing downstream would read.
     *
     * Nullable and defaulted so every row written before the table existed
     * still parses. Null means "an ordinary wound of its severity", which is
     * exactly what those rows are; `getWoundType` returns null for it and every
     * caller treats that as the plain case rather than as an error.
     *
     * Only the KEY is persisted. Nature, permanence, treatment and presentation
     * are read from the catalog, so there is one source of truth for what a
     * wound is and no way for a stored row to drift from it.
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
    'true_immortal'    // went through; ordinal 46
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
    /**
     * RETIRED, AND KEPT ONLY SO OLD LEDGERS STILL PARSE.
     *
     * Nothing in the engine produces this any more: a channel wound is a torn
     * muscle and does not put anybody in the ground. `evaluateDeathConditions`
     * no longer returns it. It stays in the enum because a permadeath game's
     * run ledger is the only surviving account of a life, and saves written
     * before the ruling carry it. See `docs/world/climbing/injuries.md`.
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
     * Where they were born. Dealt at creation from the run seed, alongside the
     * root and the attributes, and permanent for the same reason.
     *
     * Backed by the `origin_tier` column. It defaults to 'thin_county', which
     * is both the overwhelming majority of births and the honest reading of
     * every row written before this axis existed: no teacher, no manual, no
     * vein, and nobody to vouch for them.
     *
     * Everything the tier is worth - stones, placement reach, access, vouchers,
     * supplied expeditions - is derived from the frozen table in
     * `engine/cultivation/origin.ts` rather than stored per row, so there is
     * exactly one persisted fact here and nothing that can drift from it.
     */
    origin: OriginTierKeySchema.default('thin_county'),
    /**
     * A plain fact, dealt at creation and permanent.
     *
     * It exists so a child can have two parents and a line can dilute
     * correctly - `engine/birth/what-sex-somebody-is-and-what-it-is-for.ts` is
     * the whole design and is emphatic about how little else it touches. It
     * moves no number, gates no art, and has no bearing on who may marry whom.
     *
     * Two things do read it, and both are doors rather than modifiers: whether
     * a child is of both parents' blood, and the two Courts that admit one sex
     * and not the other (`A_HOUSE_THAT_TAKES_ONE_SEX`).
     *
     * The default is the storage default and means the same thing: a row
     * written before the axis existed. Unlike `origin`'s `thin_county` it is
     * not the honest majority of anything - a coin flip has no majority - and
     * every row written since carries a rolled value.
     */
    sex: SexSchema.default(SEX_A_LEGACY_ROW_READS_AS),
    /**
     * Which of the two roads this cultivator walks.
     *
     * Not flavour: it decides whether a soul-directed art does anything to them
     * and what destroying their body actually accomplishes. Backed by the
     * `tradition_id` column, defaulting to the Drawn Road, which is what every
     * row written before the Cut Road existed always was.
     */
    traditionId: TraditionIdSchema.default('tradition-drawn'),

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
    /**
     * Consecutive turns spent at or above CRIPPLING_UNTREATED_INJURIES open
     * channel wounds. NOT FATAL AT ANY VALUE - see BLEED_OUT_TURNS.
     *
     * It used to be the sibling of `starvationTurns` and it is now an odometer
     * rather than a clock: how long this body has been carrying open channels,
     * which is what the player is shown in place of the countdown that used to
     * be there. Still persisted, because it is a fact about the body rather
     * than a derived quantity, and still cleared by treatment the moment the
     * open count drops below the threshold.
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
     * Confrontations survived, and how many of them were won.
     *
     * Experience is a form of power in this world, so it is a counted fact
     * rather than a recollection: `assessPower` reads `battlesSurvived` on
     * every exchange. Both are denormalised from `combat_records`, which stays
     * authoritative and holds who, when and how it went.
     */
    battlesSurvived: z.number().int().min(0).default(0),
    battlesWon: z.number().int().min(0).default(0),

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
// REGARD
// How the world answers somebody, as a function of how far above or below
// the ask they are standing.
//
// THE DEFECT THIS EXISTS TO FIX
// -----------------------------
// Every content catalog already carries exactly one number saying what rung
// it is pitched at - `harvestOrdinal` on a herb, `minOrdinal` on a job or an
// encounter, `requiredOrdinal` on a manual, `ordinal` on a beast. Every one
// of them was being used as a floor and nothing else, so a False Immortal
// asking the ground for herbs got the same seven days and the same single
// stalk of qi grass a beginner got. The only thing that moved across
// forty-five rungs was WHICH row came back.
//
// The fix is one generic quantity, read by every ordinary resolver:
//
//     gap = asker's ordinal - the rung the thing is pitched at
//
// and one table, below, that says what a given gap buys. Yields, durations,
// prices and damage all come off the same seven rows. There is no per-catalog
// rule anywhere and there must never be one: a catalog that wants a different
// answer says so by moving its gate or by setting `span` on its own record,
// never by growing a branch.
//
// BOTH DIRECTIONS, AND SILENCE IS NOT AN ANSWER
// ---------------------------------------------
// The table refuses at both ends and says why at both ends. Below
// `unreachable` the ask is over the asker's head and is not put in front of
// them. Above `dismissed` the ask is beneath them and is not put to them
// either - not out of reverence, but because everyone present can see what
// they are and nobody opens that conversation. Both refusals carry a reason.
// An empty list with no reason attached is the bug this replaces.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The seven answers the world has. Ordered from "far above them" to "far
 * below them"; the windows are disjoint and cover the whole integer line.
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
 * One row of the answer table.
 *
 * `minGap`/`maxGap` are inclusive and are expressed in rungs of the ladder.
 * The multipliers are what the ordinary resolvers multiply their own base
 * figure by - there is no second arithmetic anywhere.
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
    /**
     * Engine-authored factual line with a `{gap}` slot. Facts only: it states
     * the measured distance and what follows from it. The narrator phrases it;
     * it never invents it.
     */
    readonly reaction: string;
}

/**
 * THE TABLE. Seven rows, and every catalog in the game reads these and only
 * these. Widening a window here changes the whole world at once, which is the
 * point.
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
 * The optional generic column every content record may carry.
 *
 * Absent on almost everything, which is correct: the default answer is the
 * table above read against the record's own existing gate. A record sets this
 * only when its gate is not one of the ordinary columns, or when it outlives
 * its band (`span`), or when the generic reaction line is factually wrong for
 * it.
 */
export const RegardProfileSchema = z.object({
    /**
     * The rung this record is pitched at. Omit to use the record's own gate
     * column - `harvestOrdinal`, `minOrdinal`, `requiredOrdinal`, `ordinal`.
     */
    gate: z.number().int().min(0).max(MAX_ORDINAL).optional(),
    /**
     * How slowly the world stops caring, against an ordinary 1. A record at
     * `span: 4` is still being taken seriously four times as far up the ladder,
     * which is how "nothing is ever fully outgrown" is said in data rather than
     * in a branch. Below 1 it goes stale faster than usual.
     */
    span: z.number().min(0.25).max(8).optional(),
    /** Never put forward, whatever the gap says. A thing you must ask for. */
    neverOffered: z.boolean().optional(),
    /** Always put forward, at any gap. Use sparingly; it defeats the point. */
    alwaysOffered: z.boolean().optional(),
    /**
     * Replaces the band's generic reaction line for this record. Facts only,
     * never narration, and it may carry the same `{gap}` slot.
     */
    reaction: z.string().optional()
});
export type RegardProfile = z.infer<typeof RegardProfileSchema>;

// ─────────────────────────────────────────────────────────────────────────
// APPROACH - the half of the situation the engine cannot infer from a row
//
// The narrator knows things no stored state contains: what the player is
// actually attempting, in what tone, with what leverage, in front of whom,
// and what rung they are letting the room believe they are. All of it is
// optional and all of it is context. NONE of it is an outcome. The engine
// turns an approach into two bounded numbers - an apparent ordinal and a
// pressure in [-2, +2] - and decides everything else itself.
// ─────────────────────────────────────────────────────────────────────────

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
     * The asker themselves - an attachment, offered or already standing.
     *
     * A member of this enum rather than a subsystem of its own, and that is
     * the whole design: seduction is then priced by the machine that already
     * prices a purse and a threat, and no code anywhere branches on the word
     * a player typed to decide what came of it. Like every other entry, it is
     * a claim about what is actually behind the ask, and leverage the asker
     * does not have is a lie the room will price.
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
 * What the narrator hands the engine about the attempt itself.
 *
 * Every field is optional and defaulted, so a caller that knows none of this
 * gets exactly the behaviour it got before the field existed.
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
     * One, the same as coin and a favour. An attachment moves how somebody is
     * met by about as much as a purse does and no more - the ladder is still
     * not negotiable, and somebody four rungs above you is still four rungs
     * above you however they feel about it.
     */
    attachment: 1
} as const;

/**
 * The whole of what an approach can move, in rungs. Two. An approach changes
 * how somebody is met; it never changes what they are.
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

// ─────────────────────────────────────────────────────────────────────────
// TECHNIQUES (ARTS)
// The cultivation replacement for spells. Tiered against the realm ladder.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The two kinds of art, which the catalog had been conflating.
 *
 * They are different things and the difference is the whole of the
 * progression: one is what you PRACTISE to rank up, the other is what you USE
 * to fight. `category` says what an art does mechanically; `class` says which
 * of the two kinds it is, and only one of them carries a ceiling.
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
 * HOW WELL THE BOOK IS WRITTEN. The second axis, and it is not the grade.
 *
 * A manual has a coverage - `requiredOrdinal` to `cap`, one realm, ending at
 * Perfection - and it has a quality, and the two are independent. A trash Core
 * Formation manual and an excellent one carry a reader over exactly the same
 * rungs; one of them takes eighty years about it.
 *
 * WHY THIS IS NOT `grade`. It was tried, and grade cannot express it, because
 * grade is already a statement about HEIGHT and is pinned there by an enforced
 * invariant: `GRADE_ORDINAL_BANDS` in `data/cultivation/techniques.ts` binds
 * every art's grade to its `requiredOrdinal` (mortal 0-12, earth 13-20, ...)
 * and `GRADE_QI_BANDS` binds it to `qiCost`, and the content suite checks both
 * on every row. So a market primer and an apex house's intake canon, which
 * cover identical rungs and therefore both open at ordinal 0, are BOTH
 * necessarily `mortal`. That is the exact pair the axis exists to separate, and
 * grade is structurally unable to separate it. Calling the apex book `earth`
 * would require moving its `requiredOrdinal` to 13 - which is a lie about what
 * it covers - and repricing a gathering primer at Foundation qi costs.
 *
 * Ordered worst to best, and each tier names its CAUSE rather than a quantity,
 * because the causes are what the world produces:
 *
 *   corrupt   the text is damaged. Miscopied by hands that never mastered it,
 *             fragmentary, reassembled out of a wreck, or set down by somebody
 *             who did not survive what they were describing.
 *   crude     plainly set down, and honestly complete. Nothing wrong with it
 *             and nothing in it either. This is what a market stall sells and
 *             what a hedge-teacher hands over, and it WORKS - slowly.
 *   sound     a working book with a lineage behind it. The ordinary good case.
 *   refined   worked over by generations who each took it to its end and wrote
 *             down what they found there.
 *   pristine  the author's own hand, complete, nothing lost in transmission.
 *
 * Read by `engine/cultivation/manual-quality.ts`, which is the single authority
 * on what a tier is worth and on what it demands of a reader. Nothing else may
 * interpret these names.
 */
export const ManualQualitySchema = z.enum(['corrupt', 'crude', 'sound', 'refined', 'pristine']);
export type ManualQuality = z.infer<typeof ManualQualitySchema>;

/**
 * How many people one use of an art lands on.
 *
 * A property of the ART and never of the person holding it: the same word means
 * the same thing for a bandit with a wide swing and for somebody at the top of
 * the ladder. What makes one of them devastating is not this field, it is the
 * ordinary power arithmetic applied once per person the art reached.
 *
 * The catalog already describes the distinction in prose - a finger that severs
 * one name against a decree that drops a mountain on an inhabited place - so
 * this only writes down what those descriptions have always said.
 *
 * Optional, and absent means `single`. Every art written before this existed is
 * a single-target art, which is what it always was.
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

// ─────────────────────────────────────────────────────────────────────────
// WHAT AN ART IS ALLOWED TO ADDRESS
//
// The one ladder in the catalog that escalates IN KIND rather than in
// magnitude, and the reason it exists is that nothing else here does. Grade
// says how late and how costly. `reach` says how many people. Dice say how
// hard. All three are quantities, and a catalog built only out of quantities
// produces a top rung that is the bottom rung with more zeroes on it - which
// is exactly what the arts above ordinal thirty had become.
//
// This field answers a different question: what is the art AIMED AT. Not how
// big the effect is, but what kind of thing the effect is allowed to be about.
// And that is a question with a small number of answers, they are ordered, and
// the higher ones cannot be reached from the lower ones at any magnitude.
//
//   body       A body. Yours, or the one in front of you. The art is made of
//              fire or metal or nothing in particular, it happens, and then it
//              has happened. Everything at the bottom of the ladder is here and
//              most of the middle is too.
//
//   place      A place, and a span of it. Several people because they were
//              standing together, ground because it is ground, an hour because
//              the art holds for an hour. The effect is the same KIND of thing
//              a `body` art does; what changed is that it landed on a location
//              instead of a person.
//
//   condition  What a place is LIKE, rather than what is standing in it. The
//              qi in a valley, what the weather over a province does, whether
//              a road can be walked, whether an art of a given element works
//              here at all. Nobody is the target. The target is the terms
//              everybody in that space is operating under, and the people are
//              affected the way people are affected by a drought.
//
//   settled    What is already FIXED about somebody: a name that was given, an
//              oath that was sworn, a debt that was inherited, a span that was
//              granted, a death that has already been decided. It is not a
//              larger effect than `condition` and it is frequently a smaller
//              one - a single person, no display, nothing visible from a
//              distance. What makes it a rung up is that no `condition` art of
//              any size reaches a fact. Widen a drought as far as you like and
//              it never becomes a thing that unmakes an oath.
//
//              And it has no small version. You cannot slightly sever a name.
//              An art here either reaches the fact or does not, which is why
//              the rung it opens at is the rung it opens at and there is
//              nothing beneath it that is a weaker attempt at the same thing.
//
//   decree     A statement, and the world is obliged. There is no target, no
//              medium, no delivery and nothing that has to already be there.
//              See `DECREE_IS_NOT_A_LARGER_SETTLED` below, which is the whole
//              of why the top rung is not the rung below it with more behind
//              it - and `WHAT_A_DECREE_CANNOT_SAY`, which is what keeps it
//              inside the rules the ladder already had.
//
// INDEPENDENT OF `era`, AND THIS IS THE GUARD THAT MATTERS.
// An ancient art does something categorical - it moves a resource between
// bodies, it puts spears in the ground that somebody else can pick up, it
// makes a second body - and a modern art does something elemental that scales
// to the horizon. Neither is the stronger and the comparison is not coherent.
// What an ancient art must NEVER buy is a higher rung on THIS ladder, because
// that would make old art strictly better and collapse the whole era axis into
// "old is stronger". The floors below bind both eras identically. An ancient
// art at ordinal twenty-six addresses a place, the same as a fire art at
// twenty-six; what is ancient about it is what it does to that place.
//
// INDEPENDENT OF `class`, AND THAT ONE IS AN INVARIANT RATHER THAN A GUARD.
// A cultivation manual addresses the person practising it, at every rung, for
// ever. The catalog already said so in the note on the Canon of the Unwritten
// Span - a gathering canon lands on one person and stays one person at every
// rung of the ladder - and this is that sentence made checkable. What you
// practise to rank up never escalates in kind. Only what you USE does.
// ─────────────────────────────────────────────────────────────────────────

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
 *   body       0   Qi Condensation. Where everybody starts and most people
 *                  stay.
 *   place     21   Nascent Soul. The realm where the soul becomes a thing that
 *                  survives the body, and the first realm at which a cultivator
 *                  stops being a local matter. An art that lands on a location
 *                  rather than a person starts here.
 *   condition 33   Body Integration. "Damage stops meaning what it used to
 *                  mean" - and an art whose subject is no longer damage is an
 *                  art that has stopped addressing what is standing there.
 *   settled   44   Tribulation Transcendence Perfection: the last crossing
 *                  rung. The one place below the Lid from which somebody is
 *                  looking at the boundary rather than up at it, and the only
 *                  rung at which the world's fixed facts are legible enough to
 *                  be argued with.
 *   decree    46   True Immortal, and nothing under it. See below.
 *
 * The bands narrow as they rise - twenty-one rungs, twelve, eleven, two, one -
 * which is the corridor thesis arriving on a second axis without anybody
 * arranging it.
 */
export const ADDRESS_ORDINAL_FLOORS: Record<TechniqueAddress, number> = {
    body: 0,
    place: 21,
    condition: 33,
    settled: LAST_CROSSING_ORDINAL,
    decree: TRUE_IMMORTAL_ORDINAL
} as const;

/**
 * The highest address a rung permits. An art may always address something
 * SMALLER than its rung allows - most do, and a quiet single-target finger at
 * ordinal twenty-eight is one of the better entries in the catalog - and no art
 * may ever address something larger.
 */
export function addressCeilingForOrdinal(ordinal: number): TechniqueAddress {
    let ceiling: TechniqueAddress = 'body';
    for (const address of ADDRESS_ORDER) {
        if (ordinal >= ADDRESS_ORDINAL_FLOORS[address]) ceiling = address;
    }
    return ceiling;
}

/**
 * What an art addresses when it has not said.
 *
 * Deliberately conservative, and deliberately NOT the ceiling for the rung. A
 * catalog row that says nothing is a row nobody has thought about on this axis,
 * and defaulting those to the top of what their rung allows would silently
 * declare that the ladder is already climbed. It is not: read this way the
 * existing catalog tops out at `place`, which is a true and useful statement of
 * where the work is.
 *
 * `reach` carries the body/place distinction already, so it is read rather than
 * duplicated - but only at `field`, and the catalog is what settled that.
 *
 * `several` IS STILL A BODY ART, and the two mortal-grade entries that forced
 * the question are the reason to say so: a thunder clap at ordinal nine and a
 * swept fire arc at ordinal eleven both land on three people, and neither is
 * addressing anything but the three people. Three bodies is three bodies. What
 * `TechniqueReachSchema` says about `field` is the actual line - "it lands on a
 * PLACE rather than a person" - and only that crosses onto the second rung.
 *
 * Which is the distinction working rather than a patch: reach is a headcount
 * and address is a subject, and a wide swing raises the first without touching
 * the second. If `several` had implied `place`, every roadside bandit art with
 * a broad stroke in it would have been claiming a rung it has no business at.
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
 * Whether an art's declared address is legal for the rung it is written for
 * and the kind of art it is. Asserted by the catalog suite rather than by a
 * Zod refinement, in the same place and for the same reason the grade bands
 * are: the bands are a statement about content, and content is where a
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
 * Why the top rung is not the rung below it with more behind it.
 *
 * This is the failure the whole ladder exists to prevent, so it is written
 * down where the field is defined rather than left to the entries to imply.
 *
 * A `settled` art operates on a fact that is ALREADY THERE. It needs a name
 * that was given, an oath that was sworn, a death that was decided. Everything
 * it can do is bounded by what the world has already fixed, and no amount of
 * magnitude widens that bound: an infinitely powerful art for severing names
 * still cannot reach a person who was never named.
 *
 * A `decree` has no such requirement, and that is the entire difference. It
 * addresses nothing that is there. It states a thing, and the statement becomes
 * the case - about somebody who was never named, about a place that has not
 * been visited, about a condition nobody had thought to fix. The rung below
 * EDITS the record. This one WRITES it.
 *
 * So the two are not two sizes of one act, and the test of whether a given
 * entry has fallen back down the ladder is blunt: ask what already had to be
 * true for it to work. If the answer is anything at all, it is a `settled` art
 * with a large number on it and it belongs a rung down.
 */
export const DECREE_IS_NOT_A_LARGER_SETTLED = {
    settled: 'reaches a fact the world has already fixed, and can reach nothing else at any magnitude',
    decree: 'fixes one, and needs nothing to have been true beforehand',
    theTest: 'ask what had to already be true. A decree answers nothing.'
} as const;

/**
 * The three things a decree may not say, and none of them is a balance patch.
 *
 * 1. IT CANNOT SPEAK A RUNG. A statement that somebody is at an ordinal, or is
 *    above the Lid, or is not, does nothing - because a rung is not an opinion
 *    the world holds about a body, it is what the body is. This is the same
 *    ruling `WHAT_AN_ART_BUYS` already made from the other direction: an art is
 *    worth most of a rung inside a realm and nothing at all across the Lid, at
 *    any mastery. A decree is an art. It buys what an art buys.
 *
 * 2. IT CANNOT BE AMENDED. It is spoken inside `BREATHS_IN_THE_LOWER_REALM` and
 *    the speaker is gone before the world has finished complying. Nothing can
 *    be added, corrected, revoked or explained afterwards, by them or by
 *    anybody. Every ambiguity in the sentence resolves the way the world
 *    resolves it rather than the way it was meant, and the record of decrees
 *    below the Lid is substantially a record of that going badly.
 *
 * 3. IT CANNOT GOVERN. The world complies with the statement, not with the
 *    speaker, so a decree that would need somebody to keep judging it gets no
 *    judgement at all - it gets the flat reading, for ever. Ten to fifteen
 *    breaths is enough to fix a fact and is not enough to hold a province, and
 *    a fixed sentence cannot administer one afterwards. That is why the world
 *    below survives the existence of the rung, and it is the same sentence
 *    `BREATHS_IN_THE_LOWER_REALM` already says about retaliation, arriving on
 *    the axis of the word.
 */
export const WHAT_A_DECREE_CANNOT_SAY = {
    aRung: 'A rung is what a body is, not a thing the world has an opinion about. Stating one changes nothing, in either direction, about anybody.',
    anAmendment: 'One sentence, spoken inside the breaths. There is no second one, and no revision, ever, by anyone.',
    anAdministration: 'The world obeys the statement and not the speaker, so a decree that needs ongoing judgement receives none and runs on its flat reading for ever.'
} as const;

/**
 * The word at the top three rungs, which is the ladder's clearest worked
 * example and was already half-written in the catalog before this field
 * existed.
 *
 * The same act - a person states a thing about the world - at forty-four,
 * forty-five and forty-six, and what changes is not volume:
 *
 *   44  It is heard. The heavens are not obliged, and the record of outcomes
 *       is not encouraging and is not empty either. The Word of Continuance is
 *       this rung and has been in the catalog all along.
 *   45  It is heard and the answer is no. The one rung in the world at which a
 *       statement reliably gets a reply and the reply is a refusal - which is
 *       not a design flourish, it is what a False Immortal IS, said in the
 *       vocabulary of the word rather than in the vocabulary of the crossing.
 *   46  The world is obliged.
 *
 * Two rungs apart, three categorically different outcomes, and no quantity
 * anywhere in the progression.
 */
export const THE_WORD_AT_THE_TOP = {
    petition: { ordinal: LAST_CROSSING_ORDINAL, outcome: 'heard, and the heavens are not obliged' },
    refusal: { ordinal: FALSE_IMMORTAL_ORDINAL, outcome: 'heard, answered, and the answer is no' },
    decree: { ordinal: TRUE_IMMORTAL_ORDINAL, outcome: 'obliged' }
} as const;

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
     * ── A SET, BECAUSE AN ART IS ROUTINELY ON MORE THAN ONE ROAD ─────────
     *
     * This was `subject: string | null` and the cardinality was the bug. Ruled
     * by the design owner:
     *
     *   > some techniques both teach you fighting and formation, right?
     *   > that's kind of the point, they happen to give you this ability like
     *   > how sword cultivator techniques let you fly (except this one isn't
     *   > limited to sword). and obviously sword formations exist so techniques
     *   > can have more than one.
     *
     * A sword-and-formation art raises SWORD formations, which is the whole
     * interesting case and was unrepresentable while this held one string: the
     * five rows that say `'sword'` had no room left to say anything else.
     *
     * Widened rather than joined by a second field. A `subject` and a
     * `subjects` living side by side is two sources of truth, one of them goes
     * stale, and that is this repo's most-repeated defect.
     *
     * AND IT IS NOT A DEFAULT-BY-CATEGORY QUESTION. `SUBJECT_BY_CATEGORY` in
     * the catalog still supplies the road an art is on when the row does not
     * name one - so an attack art is on the weapon road without being told -
     * but an EXTRA road is always explicit. Nothing infers a second one.
     *
     * On `Technique` rather than on `TechniqueEntry` deliberately, and the
     * split is real: `TechniqueEntry` carries what the CATALOG knows about a
     * row - provenance, surviving copies, opacity - and `Technique` is what a
     * cultivator HOLDS. A derived art has no catalog row at all, so anything
     * that must survive onto a held instance has to live here. The roads are
     * the thing that made a derived manual suited by construction, because they
     * were taken from the deriver's own road; putting them on the entry would
     * lose them at exactly the moment it matters.
     *
     * `CultivationOptions.techniqueSubject` is a scalar and stays one - it asks
     * "which road is this, for a bonus" and {@link primaryRoadOf} answers it.
     */
    subjects: z.array(z.string()).default([]),
    /**
     * True for an art of `category: 'dual_cultivation'` that only works between
     * two people of different sex - the "furnace" trope. Read by
     * `worksBetween` in `engine/social-leverage/a-furnace-only-works-on-what-it-doesnt-share.ts`,
     * which is the single place that asks the question. Absent/false for every
     * other art, which is what every art written before this field existed was.
     */
    furnace: z.boolean().default(false),
    /** Mastery 0..1. Raised by practice, gates the technique's full effect. */
    mastery: z.number().min(0).max(1).default(0),
    description: z.string().default(''),
    /** Turns before the art may be used again. */
    cooldown: z.number().int().min(0).default(0),
    /**
     * How many people one use lands on. Absent means `single`, so every art in
     * the catalog keeps exactly the behaviour it had before this field existed.
     */
    reach: TechniqueReachSchema.optional(),
    /**
     * What the art is aimed at, on the ladder that escalates in kind. Absent
     * means `defaultAddressFor` reads `class` and `reach`, so every art written
     * before this field existed keeps exactly the behaviour it had - and the
     * catalog reads, correctly, as one that tops out at `place`.
     *
     * Declared only where an entry genuinely reaches higher, and never higher
     * than `addressCeilingForOrdinal` allows for its rung. See the block above
     * `TechniqueAddressSchema`.
     */
    addresses: TechniqueAddressSchema.optional(),
    /**
     * The generic column. Absent means the ordinary bands read `requiredOrdinal`,
     * which is what an art is pitched at. A manual that keeps being worth
     * teaching long past its band says so with `span` rather than with a rule.
     */
    regard: RegardProfileSchema.optional(),
    /**
     * Which kind of art this is. Resolved by the catalog's authoring helper
     * rather than repeated on every entry, so the split reads as one block.
     */
    class: TechniqueClassSchema.default('dao'),
    /**
     * THE CEILING. The rung past which this manual cannot take anybody,
     * however long they practise.
     *
     * Only ever set on `class: 'cultivation'`. Null means uncapped, which is
     * reserved for the handful of manuals that carry a cultivator the whole
     * way - the top prize in the setting, and vanishingly rare.
     *
     * This is what makes the faction catalog's `reliableOrdinal` true BY
     * CONSTRUCTION rather than by assertion. A low-tier house teaches a
     * low-tier manual, so it structurally cannot produce a high-realm
     * cultivator. Nothing branches on the sect; the manual is the manual, and
     * the cap belongs to the book rather than to whoever handed it over.
     *
     * INDEPENDENT OF SUITABILITY. A manual has both a cap and a fit to a
     * spirit root, and they do not interact: a perfectly suited manual still
     * runs out, and an ill-suited one teaches nothing at any height. Do not
     * fold one into the other.
     *
     * Read by `techniqueExhausted` in `engine/cultivation/cultivation.ts`,
     * which stops dead at the cap rather than tapering toward it - a ceiling
     * that gets gradually stickier reads as bad luck, and one that stops dead
     * reads as a fact about the book in your hands.
     */
    cap: z.number().int().min(0).max(MAX_ORDINAL).nullable().default(null),
    /**
     * HOW WELL THIS PARTICULAR BOOK IS WRITTEN. See `ManualQualitySchema`.
     *
     * The second axis, orthogonal to `cap` in exactly the way `cap` is
     * documented as orthogonal to suitability. Two manuals may cover the same
     * rungs and be nothing like the same object, which is the whole point: what
     * a house gives its intake is not a range of rungs - those are for sale at
     * a stall - it is a better-taught version of the same range.
     *
     * Defaulted to `sound`, the identity element: a row that says nothing about
     * its quality behaves exactly as it did before this field existed.
     */
    quality: ManualQualitySchema.default('sound'),
    /**
     * Root grades the manual will take at all. Empty means any root may read it.
     *
     * Mirrors `SpiritRootGrade` in `engine/cultivation/spirit-roots.ts` -
     * single, dual, triple, quad, muddled, mutated - as strings rather than as
     * an import, because `Find.rootGrades` in the encounters layer is already
     * `readonly string[]` and coupling the schema to the engine's root module
     * would buy nothing.
     *
     * Authored because it was NOT: only `element` was filled in, so the root
     * axis never fired and every suitability miss a player ever saw read as an
     * element miss. A manual that wants a mutated root and a manual that wants
     * a water root are different refusals and should sound different.
     */
    rootGrades: z.array(z.string()).default([]),
    /**
     * Comprehension domain the manual cannot be worked without, or null.
     * Read by `assessFit`, which already judges it and never had anything to
     * judge because nothing populated it.
     */
    domain: InsightDomainSchema.nullable().default(null),
    /** Minimum degree in that domain. Ignored when `domain` is null. */
    domainDegree: z.number().min(0).default(1),
    /**
     * Ordered ids of the OBJECT rows that carry this work in parts, or null
     * for a single-volume work.
     *
     * A volume is a physical copy of a piece of the book, so it lives in the
     * object catalog with a holder and a provenance, not here. Its power is one
     * rung below the whole by `shardPower`, which is the same arithmetic that
     * turns a broken blade into a worse blade - there is one piece of that
     * reasoning in the repo and this reuses it rather than adding a second.
     *
     * There is deliberately NO second cap field. The cap of a partial set is
     * derived, by the engine, from how many volumes are held.
     */
    volumes: z.array(z.string()).nullable().default(null),
    /**
     * Whether somebody at sufficient dao standing could write the continuation
     * themselves rather than finding it.
     *
     * False on almost everything, and that is the point: derivation is the
     * prodigy's road, not the way missing content gets papered over. Resolved
     * by the catalog's authoring helper from a named set, the way provenance
     * and surviving copies already are.
     */
    derivable: z.boolean().default(false),
    /**
     * THE HARD OPENING. What it costs to begin a method that is far beyond
     * the reader, or null for a book that simply works when you sit down.
     *
     * The other half of a wide-span manual. `requiredOrdinal` is the wrong
     * instrument for a treasure: gating a cap-33 book behind ordinal 29 is
     * exactly what makes it unable to skip anything, which is the whole point
     * of finding one. So a wide-span book is gated on COMPREHENSION instead -
     * `domain` and `domainDegree` - which is the one axis money cannot buy,
     * because it comes from what has happened to somebody rather than from
     * how long they have sat.
     *
     * And on this: the opening is genuinely hard. A legendary method does not
     * work the first time you try it. `rungs` is how far up from
     * `requiredOrdinal` the difficult stretch runs, and `rateMultiplier` is
     * what progress is worth inside it - well below 1. Somebody handed a great
     * canon at Foundation cannot coast on it; they crawl through the opening
     * and then it opens up.
     */
    opening: z.object({
        rungs: z.number().int().min(1).max(MAX_ORDINAL),
        rateMultiplier: z.number().min(0.05).max(1)
    }).nullable().default(null)
});
export type Technique = z.infer<typeof TechniqueSchema>;

/**
 * Whether this art is on a given road.
 *
 * The scalar-shaped read, and the only way anything should ask. Written here
 * rather than in the catalog so the engine can ask without importing content,
 * and defensive about a missing array because `GatedTechnique` and friends are
 * `Pick`s that predate the widening.
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
 * primarily on is written first and any extra ability it happens to grant comes
 * after. `CultivationOptions.techniqueSubject` wants exactly this - a single
 * road to match a comprehension against for a bonus - and giving it a set would
 * make one art match several insights, which is a balance change nobody asked
 * for rather than a widening.
 */
export function primaryRoadOf(
    technique: { subjects?: readonly string[] | null }
): string | null {
    return (technique.subjects ?? [])[0] ?? null;
}

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
    description: z.string().default(''),
    /**
     * The generic column. A pill carries no rung column of its own, so this is
     * where its gate lives when one matters - what realm the medicine is
     * pitched at. Absent means it is met as `matched` by everybody, which is
     * the identity answer and exactly the old behaviour.
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

// ─────────────────────────────────────────────────────────────────────────
// SECTS
// ─────────────────────────────────────────────────────────────────────────

export const SectAlignmentSchema = z.enum(['righteous', 'neutral', 'demonic']);
export type SectAlignment = z.infer<typeof SectAlignmentSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE PROTECTOR
//
// One post, off the ladder, carrying one duty: stand for this house when
// something comes for it. Two policies decide who may hold it, and the
// difference between them is the whole of the design.
//
// NOT ON THE LADDER, and this is authored rather than a convenience.
// `THE_OFFICE.whatItIsNot` in `data/cultivation/false-immortals.ts`:
//
//   "not on the house's ladder at all - the office sits outside the ranks
//    rather than above them, because a seat is a position in an order of
//    precedence and there is no order that could contain one."
//
// So it is a field beside `ranks` and never an entry in it. That also keeps
// it clear of the index contract: `ranks[rankCount - 1]` is the head,
// `rankRealmBand` derives every band from position in the array, and
// `members.ts` pins every member to a `rankIndex`. A rank inserted anywhere
// moves all three. A field does not.
//
// NOT THE GUEST FLOOR. A guest is an admission floor
// (`the-three-floors-a-house-admits-at.ts`), honorary and obligation-free in
// both directions - which is why the Hollow Court can keep Lu Sheng and a
// house cannot keep a protector. The duty is what separates them.
//
// AND A MEMBER DOES NOT KNOW WHETHER THEIR HOUSE HAS ONE, OR WHO IT IS.
// Ruled by the design owner, and it is the second reason the office sits off
// the ladder rather than on it: YOU ARE ONLY TOLD WHO IS ON THE LADDER. A rung
// is public by construction - it is what a member is addressed as, what the
// stipend paying them is indexed by, and what anybody in the house can recite.
// An office is not, and this one least of all.
//
// So anything that shows a house's people to a player reads `ranks` and must
// NOT read this field. A roster, a hall description, a "who is senior here"
// answer: none of them may name the protector or say whether the chair is
// filled. That is discretion rather than a secret with a lookup - there is no
// hidden-knowledge check to pass, because the ordinary member genuinely does
// not know, and neither does the narrator unless something in the world has
// shown it to them.
//
// It also means an empty chair and a filled one look identical from inside the
// house, which is the point: a house that would have to admit the chair is
// empty is a house that has told you it has one.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Who a house will let stand in its protector's chair.
 *
 *   filled     Anybody the house can actually bind. The binding is the whole
 *              qualification, and it has several roads into it:
 *
 *                - one of its own who has stopped leading - a retired head, or
 *                  the grand elder he retired into. The end of the retirement
 *                  path: the house's deepest person, no longer leading and no
 *                  longer administering, standing in the compound so somebody
 *                  is there when something arrives.
 *                - a veteran who does not travel, whose whole function is to
 *                  be here.
 *                - somebody the house RAISED. A spirit beast the sect took at
 *                  or above `BEAST_CHANGE_ORDINAL` and brought up is the
 *                  strongest version of this there is, because everything they
 *                  know as a person came from the house. A close relationship
 *                  qualifies somebody the way a crossing does.
 *
 *              THIS IS NOT A LIST OF KINDS, AND THERE MUST BE NO BRANCH ON
 *              WHICH ONE. A changed beast is a person with an ordinary row
 *              holding what any cultivator holds - see
 *              `a-family-that-came-down-from-a-changed-beast.ts`, which is
 *              explicit that a branch on "is this a beast" anywhere near a
 *              social question means the design has gone wrong. What the seat
 *              reads is what somebody owes the house, and being raised by it
 *              is one way to owe that much.
 *
 *   reserved   A False Immortal, and nobody else. The house declines to seat
 *              the retired heads who are right there and qualified by any
 *              normal standard, which is what makes the emptiness mean
 *              something: it is a refusal rather than a shortage of bodies.
 *              A reserved chair is therefore ALWAYS empty - see `heldBy`.
 *
 * THE TWO SILENCES ARE DIFFERENT AND THE ENGINE MUST NOT CONFLATE THEM.
 * An empty chair says two entirely different things depending on the policy,
 * and `policy` is what separates them:
 *
 *   reserved + heldBy null   "We will take nobody less." A statement about the
 *                            house's history, eight hundred years old, and
 *                            unchanged since before anybody living was born.
 *   filled   + heldBy null   "Nobody is in it right now." This week's news -
 *                            the last one died, nobody has been named yet, the
 *                            house is between people. It says nothing at all
 *                            about what the house would accept.
 *
 * So never render an empty chair without its policy, and never infer a
 * reservation from a vacancy. One is a boast and the other is an admission.
 *
 * The same applies to the GRAND ELDER, which is a rung rather than an office:
 * a house can simply have nobody standing there, and that is ordinary rather
 * than meaningful. An empty rung is not a statement.
 */
export const ProtectorPolicySchema = z.enum(['filled', 'reserved']);
export type ProtectorPolicy = z.infer<typeof ProtectorPolicySchema>;

export const HouseProtectorSchema = z.object({
    /**
     * The house's own word for the post. Every house names its own offices,
     * exactly as it names its own rungs, and no two used the same title.
     */
    title: z.string().min(3),
    policy: ProtectorPolicySchema,
    /**
     * Member id of whoever stands in it, or null for a vacant post.
     *
     * A DECLARED NULL IS NOT A MISSING FIELD. An absent `protector` means the
     * house has no such office; `heldBy: null` means the office exists and
     * nobody is in it. The distinction is the point of declaring it at all -
     * `THE_VACANCY` calls the reserved post "a vacancy rather than a history",
     * and a vacancy has to be representable as one.
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
     * The protector's chair, where this house keeps one.
     *
     * Optional because not every house has the office, and deliberately NOT
     * parallel to `ranks` or `stipend`: it sits beside the ladder rather than
     * on it, so adding it moves no index and re-bands nobody.
     */
    protector: HouseProtectorSchema.optional(),
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
    /**
     * The meridians are open and the clock on them has started. The sibling of
     * 'starvation_warning', and a separate kind for the same reason: it is a
     * countdown that can still be stopped, not a wound being taken.
     */
    'bleeding_warning',
    'lifespan_warning',
    /**
     * The method is not carrying this cultivator any further, and it says
     * which of the two reasons it is in `data.state`: `no_method` for somebody
     * practising nothing at all, `exhausted` for a manual that has ended.
     *
     * The sibling of the two warnings above and a separate kind for the same
     * reason they are separate from each other: this one never resolves on its
     * own and never resolves with time. Eleven of twelve measured lives died of
     * stagnation at ordinal 0 without the game once mentioning it, because an
     * ABSENCE has no natural event to hang off - see `techniqueCeiling` in
     * `engine/cultivation/cultivation.ts`, which authors both sentences.
     */
    'method_ceiling',
    /**
     * The gate was open and the skip did not walk through it, because sitting
     * longer is still worth more than striking now would be.
     *
     * The third sibling of the two warnings above, and it exists for the same
     * reason: a standing condition the player can act on and would otherwise
     * never learn. An unattended skip strikes the instant `canAttemptBreakthrough`
     * says yes, which is by construction the WORST legal moment - no overflow
     * has accumulated yet, so the odds are at their minimum for that rung.
     * Measured in play: a realm boundary attempted at 2%, the floor of the
     * whole scale, killing a healthy provisioned cultivator by way of the
     * meridian injuries a boundary failure inflicts. Nobody chose it and
     * nobody was told.
     */
    'crossing_deferred',
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
    /**
     * How many identical events this line stands for.
     *
     * A long skip repeats itself: the same warning, the same disturbance, the
     * same nothing-in-particular. Printing it six times reads as a bug and
     * buries whatever mattered, and dropping five of them loses the scale, so
     * identical lines collapse into one that knows how many. `dayOffset` is
     * the FIRST occurrence; `lastDayOffset` in `data` is the most recent.
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
     * These three counters all RESET during a skip - starvation clears the
     * moment there is food again, the bleed clock clears the moment the
     * untreated count drops back under the lethal threshold, and years-at-realm
     * returns to zero on any rank advance - so a delta against the starting
     * value is meaningless and cannot be inverted. The caller writes these
     * straight onto the cultivator.
     */
    endState: z.object({
        /** Consecutive turns at zero satiety as the skip ended. */
        starvationTurns: z.number().int().min(0).default(0),
        /** Consecutive turns at the lethal untreated count as the skip ended. */
        bleedingTurns: z.number().int().min(0).default(0),
        /** Years at the current realm as the skip ended. */
        yearsAtCurrentRealm: z.number().min(0).default(0),
        /**
         * Rations still in the pack as the skip ended.
         *
         * Reported so a caller that stops a stretch short can tell what the
         * span it never lived was still carrying. Provisions are bought per
         * stretch, at the cave mouth, for the whole span - so a sitting that
         * is interrupted and then RESUMED would otherwise be charged a second
         * purse of food for days that were already paid for. Nothing in the
         * engine reads this back; it is an end-of-skip absolute like the three
         * above it, and the caller decides whether anything is owed.
         */
        rationsRemaining: z.number().int().min(0).default(0)
    }).default({
        starvationTurns: 0, bleedingTurns: 0, yearsAtCurrentRealm: 0, rationsRemaining: 0
    }),
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
    /**
     * What a FAILED realm boundary did to this cultivator, beyond the wound
     * already in `injuriesSustained`.
     *
     * Present only on a boundary failure below Tribulation Transcendence -
     * lightning is authored separately and never fills this in, and a sub-rank
     * step has no trial. Null everywhere else.
     *
     * Every field is a write to state that existed before this did: the
     * foundation quality the crossing left, years to add to `age`, the soul
     * state and identity continuity of somebody who came back wrong, and
     * whether they will ever cross another boundary. The caller applies them
     * the way it applies `foundationEstablished`. See
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
         * What to MULTIPLY `identityContinuity` by, in (0, 1].
         *
         * A factor, never an assignment. Ruin compounds and never restores -
         * written as an absolute, a second ruin healed the first. See
         * `applyCrossingConsequence`.
         */
        identityContinuityFactor: z.number().min(0).max(1).nullable().default(null),
        /** True when this cultivator will never cross a realm boundary again. */
        halted: z.boolean().default(false)
    }).nullable().default(null),
    /**
     * What arriving cost the body, as a FRACTION of the pool.
     *
     * ── CROSSING DEALS DAMAGE, AND IT DID NOT ────────────────────────────
     *
     * The design owner's ruling, verbatim: *"don't forget that crossing deals
     * damage too (unless via admin panel) or the immortal pill that lets you
     * skip a ordinal - that's the diff between the immortal pill and the ones
     * that give you qi, the qi ones you still have to cross and risk it."*
     *
     * Measured before this existed: six commanded crossings, ordinal 0 to 6,
     * health 40 of 40 the whole way. `attemptBreakthrough` returned no body
     * cost at all, and injuries came only from tribulation strikes above 40 and
     * from a boundary that did not land clean. So a crossing was free, and the
     * one thing that separates the Unearned Step from a qi pill - that the qi
     * pill still makes you cross, and crossing costs - separated nothing.
     *
     * A FRACTION rather than a figure, for the reason every other pool-priced
     * number in this codebase is a fraction: forty points is a whole newborn
     * and a rounding error at Nascent Soul, so an absolute would mean four
     * different things on one ladder. `whatTheyDoAboutBeingWronged.hpFraction`
     * is the precedent and takes the same shape for the same reason.
     *
     * ZERO ON EVERY FAILURE. A failure has its own wound table, which is far
     * more expensive and is where the lethality belongs; charging both would be
     * pricing one event twice. This is what ARRIVING costs.
     *
     * THE CALLER CLAMPS, and must. Current health does not rise when the pool
     * does, so a cultivator standing low on a large frame can owe more than
     * they have - and a crossing that SUCCEEDED must not kill by arithmetic, or
     * `success` and `death` stop being separate answers. Both callers leave at
     * least one point. See `GameService.strikeBarrier` and the auto-breakthrough
     * in `time-skip.ts`.
     */
    bodyCost: z.number().min(0).max(1).default(0),
    /**
     * A broken status this crossing ARRIVED with, when it did not land clean.
     *
     * The cultivator is at `toOrdinal` carrying it. They crossed, they made it,
     * and the structure that crossing was for did not set - see the broken
     * statuses in `data/cultivation/wounds.ts`. The wound itself is already in
     * `injuriesSustained`; this names it so a caller does not have to search.
     */
    arrivedBroken: z.string().nullable().default(null),
    /**
     * A broken status this crossing REPAIRED, which the caller must now drop
     * from the wound list with `clearBrokenStatus`.
     *
     * The crucible: clearing a crossing while carrying a repairable break
     * reseats the structure that broke. Legend-rare, because the odds of
     * clearing anything while carrying one are at the floor. Never set for a
     * broken step, which no crossing repairs.
     */
    brokenStatusCleared: z.string().nullable().default(null),
    narrationHint: z.string().default('')
});
export type BreakthroughResult = z.infer<typeof BreakthroughResultSchema>;
