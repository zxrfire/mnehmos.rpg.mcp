/**
 * Cultivation combat.
 *
 * The thesis of the setting is that realm gaps are categorical, so the first
 * thing this module does is refuse to hold a fight that is not one. Everything
 * else is built on that refusal.
 *
 * FIVE RULES, IN THE ORDER THEY BIND
 * ----------------------------------
 *
 * 1. THE GAP IS CATEGORICAL. A cultivator two or more major realms below
 *    another is not underdog, they are irrelevant. `assessGap` returns
 *    `helpless` and `resolveConfrontation` returns `no_contest` with the list
 *    of things that would actually work - flee, hide, negotiate, seek
 *    protection, exploit terrain, a specialised counter, a third party,
 *    preparation, or not being found. That list is the content of the
 *    encounter. Cleverness does not dissolve the hierarchy; it routes around
 *    it.
 *
 * 2. UPSETS ARE POSSIBLE AND EXCEPTIONAL. Within one realm of each other, a
 *    weaker cultivator can win, and only by carrying an `Edge`: superior
 *    technique, an artifact, preparation, terrain, an ambush, poison, a
 *    formation, numbers, or an injury the other one was already carrying. The
 *    total edge multiplier is capped at `MAX_EDGE_MULTIPLIER`, which is set
 *    above one realm's power ratio and far below two. That single constant is
 *    where "possible, and never routine" is actually enforced.
 *
 * 3. POWER IS COMPOSITE. Realm is the spine and never the whole. `assessPower`
 *    returns an itemised list of named factors - body, soul, comprehension,
 *    technique mastery, artifacts, battle experience, environment, condition -
 *    which MULTIPLY in listed order to exactly the reported total. Two
 *    cultivators at one ordinal can differ enormously, and the engine can say
 *    which line did it.
 *
 * 4. THE TRADITIONS DIFFER ABOUT DYING. `killRequirement` is consulted at the
 *    moment a lethal blow lands, and soul-directed arts are checked against
 *    the target's tradition before they are allowed to do anything at all. A
 *    Drawn cultivator above Nascent Soul does not die to a destroyed body; a
 *    Cut cultivator takes literally nothing from a soul attack at any rank.
 *
 * 5. DEATH IS ONE OUTCOME AMONG SEVERAL. Withdrawal, capture, humiliation, a
 *    crippling injury and a standing feud are the usual results. This module
 *    NEVER declares anyone dead - it reports damage, injuries and whether the
 *    finishing requirement was met, and `survival.ts` remains the only place
 *    in this engine that decides a cultivator is dead.
 *
 * Deterministic and seeded throughout: every draw comes from a `CultivationRNG`
 * the caller derived from the run seed. Nothing here reads the clock, touches a
 * database, or knows an LLM exists. No branch anywhere favours the player; the
 * same function decides an NPC ambush and the player's last stand.
 */

import {
    type AmbientQi,
    type Cultivator,
    type Injury,
    type InjurySeverity,
    type Technique
} from '../../schema/cultivation.js';
import {
    REALM_TIERS,
    effectivePowerMultiplier,
    rankName,
    realmForOrdinal,
    type ImmortalStatus
} from './realms.js';
import { aggregateInjuryPenalties, createInjury, scarTempering } from './injuries.js';
import { foundationEffect, foundationOf } from './foundation.js';
import { understandingEffects, type RelevanceContext } from './understanding.js';
import { getSpiritRoot } from './spirit-roots.js';
import { ambientBreakthroughMod } from './ambient.js';
import {
    killRequirement,
    soulAttacksAffect,
    traditionOrDefault,
    type KillRequirement,
    type TraditionId
} from './tradition.js';
import type { CultivationRNG } from './rng.js';

// ═════════════════════════════════════════════════════════════════════════
// TUNING
// Every constant here is a design statement. Read the comment before changing
// the number; several of them are load-bearing for rules 1 and 2.
// ═════════════════════════════════════════════════════════════════════════

/**
 * Major-realm gap at which a direct confrontation stops being a fight.
 *
 * Two. One realm below is outmatched and can be overturned by someone who
 * brought something; two realms below is `powerMultiplierForOrdinal` reporting
 * a sixteenfold difference before anything else is counted, and no stack of
 * edges this module permits comes near closing it.
 */
export const HELPLESS_REALM_GAP = 2;

/**
 * How much a cultivator gains across the sub-ranks of their own realm.
 *
 * A realm's Perfection is `WITHIN_REALM_PEAK` times its Early. Set to 2 so a
 * peak cultivator of one realm sits at half the power of the weakest of the
 * next, which is the genre's "can threaten, will probably still lose".
 */
export const WITHIN_REALM_PEAK = 2;

/**
 * Hard ceiling on everything the weaker side brought, multiplied together.
 *
 * The realm ratio is 4x per rung. Six is comfortably enough to overturn one
 * realm and nowhere near the sixteen needed for two. This is the constant that
 * makes upsets exceptional rather than a tactic, and it is checked by test.
 */
export const MAX_EDGE_MULTIPLIER = 6;

/** What each edge is worth. A cultivator carries the ones they actually earned. */
export const EDGE_VALUES: Readonly<Record<Edge, number>> = {
    // A profoundly mastered art against a half-learned one. The commonest
    // honest upset and the one the genre likes best.
    superior_technique: 1.5,
    // Somebody else's work, usually somebody dead and better than both of you.
    artifact: 1.6,
    // Days of it. Knowing who, where, when, and what they cannot do.
    preparation: 1.4,
    // Ground that suits one of you. Free, and nobody thinks of it.
    terrain: 1.3,
    // Once. Never twice against the same person.
    ambush: 1.5,
    // Slow, dishonourable, and it does not care what realm you are.
    poison: 1.7,
    // Weeks to lay and a fortune in stones, and then it does not miss.
    formation: 1.8,
    // Bodies. The cheapest edge and the one that gets the most people killed.
    numbers: 1.35,
    // They were already carrying something. Half of all upsets are this.
    existing_injury: 1.4
};

/** Ceilings on the composite factors, so no single line can run away with a fight. */
export const MAX_BODY_FACTOR = 1.8;
export const MAX_SOUL_FACTOR = 1.6;
export const MAX_COMPREHENSION_FACTOR = 1.7;
export const MAX_TECHNIQUE_FACTOR = 1.9;
export const MAX_ARTIFACT_FACTOR = 1.8;
export const MAX_EXPERIENCE_FACTOR = 1.4;

/** Battles survived at which battle experience saturates. Veterans, not immortals. */
export const EXPERIENCE_SATURATION = 40;

/**
 * Exchanges a confrontation runs before it is called a stalemate.
 *
 * Bounded so a resolution always terminates, and short because cultivation
 * fights are decided quickly - the long ones are the exception and they are
 * exhausting rather than dramatic.
 *
 * Set against `EXCHANGE_DAMAGE_*` so that a genuinely even fight only just
 * runs out of exchanges: a stalemate has to be REACHABLE, or the outcome is
 * decoration. A lopsided one finishes in three or four.
 */
export const MAX_EXCHANGES = 8;

/** Fraction of the defender's maximum a single even exchange takes, floor and span. */
export const EXCHANGE_DAMAGE_FLOOR = 0.14;
export const EXCHANGE_DAMAGE_SPAN = 0.24;

/** Fraction of max HP below which a combatant will break off rather than die. */
export const WITHDRAW_HP_FRACTION = 0.25;

/** Qi below this fraction of maximum and the arts stop being available. */
export const EXHAUSTED_QI_FRACTION = 0.1;

// ═════════════════════════════════════════════════════════════════════════
// COMPOSITE POWER
// ═════════════════════════════════════════════════════════════════════════

export type Edge =
    | 'superior_technique'
    | 'artifact'
    | 'preparation'
    | 'terrain'
    | 'ambush'
    | 'poison'
    | 'formation'
    | 'numbers'
    | 'existing_injury';

export const ALL_EDGES: readonly Edge[] = Object.freeze([
    'superior_technique', 'artifact', 'preparation', 'terrain', 'ambush',
    'poison', 'formation', 'numbers', 'existing_injury'
] as const);

/**
 * One line of the power breakdown.
 *
 * `factor` is multiplicative. Multiplying every factor in listed order, starting
 * from `realmBase`, reproduces `total` exactly - that identity is the whole
 * point of the shape and it is tested.
 */
export interface PowerFactor {
    source: string;
    factor: number;
    /** Engine-authored account of why this line reads the way it does. */
    note: string;
}

export interface CombatantPower {
    ordinal: number;
    rank: string;
    realmKey: string;
    /** Index of the realm on the ladder. Gaps are counted in these, not ordinals. */
    realmIndex: number;
    tradition: TraditionId;
    /** Realm multiplier including sub-rank position within the realm. */
    realmBase: number;
    /** Itemised and multiplicative. Multiplies with realmBase to exactly `total`. */
    factors: PowerFactor[];
    total: number;
    /** What ending this combatant requires, given tradition and rank. */
    kill: KillRequirement;
}

/**
 * What the engine needs to know about someone to price them.
 *
 * Deliberately a subset of `Cultivator` plus the things the database holds and
 * the pure layer cannot: artifacts, and how many fights they have lived
 * through. Nothing here is optional-with-a-default that hides a missing fact -
 * a caller who does not know a combatant's battle history passes zero and gets
 * a novice, which is honest.
 */
export interface CombatantInput {
    id: string;
    name: string;
    realmOrdinal: number;
    immortalStatus?: ImmortalStatus;
    traditionId?: TraditionId;
    spiritRoot: Cultivator['spiritRoot'];
    attributes: Cultivator['attributes'];
    injuries: readonly Injury[];
    insights?: Cultivator['insights'];
    foundationQuality?: Cultivator['foundationQuality'];
    soulState?: Cultivator['soulState'];
    hp: number;
    maxHp: number;
    qi: number;
    maxQi: number;
    /**
     * Combined grade of everything they are carrying that helps, 0 for nothing.
     * The caller reads this off real inventory rows; the engine does not own an
     * artifact catalog and must not invent one.
     */
    artifactGrade?: number;
    /** Confrontations survived. Experience is a form of power and it is tracked. */
    battlesSurvived?: number;
    /** The art they are actually fighting with, if any. */
    technique?: Technique | null;
    /** Mastery of that art as THIS combatant holds it, 0..1. */
    techniqueMastery?: number;
}

export interface PowerContext {
    ambient: AmbientQi;
    /** What is being practised, which decides which insights bear on this. */
    relevance?: Partial<RelevanceContext>;
}

/**
 * Realm multiplier including position within the realm.
 *
 * `powerMultiplierForOrdinal` gives the categorical step between realms;
 * this interpolates across the sub-ranks so that a Perfection cultivator is
 * `WITHIN_REALM_PEAK` times their realm's Early. Both halves matter: the step
 * is what makes the hierarchy real, the interpolation is what makes climbing
 * inside a realm worth doing.
 */
export function combatPowerForOrdinal(ordinal: number, status: ImmortalStatus = 'none'): number {
    const base = effectivePowerMultiplier(ordinal, status);
    if (status === 'false_immortal') return base;
    const tier = realmForOrdinal(ordinal);
    const span = tier.ordinalEnd - tier.ordinalStart;
    if (span <= 0) return base;
    const position = (Math.max(tier.ordinalStart, Math.min(tier.ordinalEnd, Math.floor(ordinal))) - tier.ordinalStart) / span;
    return base * (1 + position * (WITHIN_REALM_PEAK - 1));
}

function realmIndexOf(ordinal: number): number {
    const key = realmForOrdinal(ordinal).key;
    return REALM_TIERS.findIndex(t => t.key === key);
}

function clampFactor(raw: number, max: number): number {
    return Math.max(1 / max, Math.min(max, raw));
}

/**
 * Price a combatant.
 *
 * Realm first, then everything the charter says must be able to separate two
 * people standing on the same rung. Each line is capped on its own so that a
 * fight is never decided entirely by one number, and the product is what the
 * confrontation actually compares.
 */
export function assessPower(combatant: CombatantInput, ctx: PowerContext): CombatantPower {
    const ordinal = combatant.realmOrdinal;
    const status = combatant.immortalStatus ?? 'none';
    const tradition = traditionOrDefault(combatant.traditionId);
    const tier = realmForOrdinal(ordinal);
    const realmBase = combatPowerForOrdinal(ordinal, status);

    const injuries = aggregateInjuryPenalties(combatant.injuries);
    const tempering = scarTempering(combatant.injuries);
    const root = getSpiritRoot(combatant.spiritRoot);
    const understanding = understandingEffects(combatant.insights ?? [], {
        rootElements: root.elements,
        techniqueElement: ctx.relevance?.techniqueElement ?? combatant.technique?.element ?? null,
        techniqueSubject: ctx.relevance?.techniqueSubject ?? null
    });
    const foundation = foundationOf(combatant);

    const factors: PowerFactor[] = [];

    // ── BODY ──────────────────────────────────────────────────────────────
    // Might is how much qi the body can hold before it starts holding you, and
    // closed wounds are the judgement of someone who has been hurt and paid to
    // stop being hurt. A carver's body was built by physical work and reads as
    // body-tempering without anyone having trained for it.
    const bodyRaw =
        1 +
        (combatant.attributes.might - 2) * 0.12 +
        tempering.breakthroughBonus * 2 +
        (tradition === 'tradition-cut' ? 0.15 : 0);
    factors.push({
        source: 'body',
        factor: clampFactor(bodyRaw, MAX_BODY_FACTOR),
        note:
            `Might ${combatant.attributes.might}, ${tempering.scars} closed wound(s)` +
            (tradition === 'tradition-cut' ? ', and a body built by working a face' : '')
    });

    // ── SOUL ──────────────────────────────────────────────────────────────
    // Above Nascent Soul the soul is a real part of what a cultivator can
    // bring, and a damaged one is a real part of what they cannot. A carver has
    // no detachable soul at all: nothing to bring, and nothing to hit.
    const soulRaw = tradition === 'tradition-cut'
        ? 1
        : 1 + soulContribution(ordinal) + soulStatePenalty(combatant.soulState);
    factors.push({
        source: 'soul',
        factor: clampFactor(soulRaw, MAX_SOUL_FACTOR),
        note: tradition === 'tradition-cut'
            ? 'A carver has no detachable soul. Nothing to bring and nothing to attack.'
            : `${tier.name}, soul ${combatant.soulState ?? 'intact'}`
    });

    // ── COMPREHENSION ─────────────────────────────────────────────────────
    // Understanding is the third quantity and it is not a second experience
    // bar. Only insights that BEAR on what is being done here count, which is
    // why the same cultivator prices differently against different opponents.
    const comprehensionRaw =
        1 + understanding.breakthroughModifier * 3 + (combatant.attributes.insight - 2) * 0.06;
    factors.push({
        source: 'comprehension',
        factor: clampFactor(comprehensionRaw, MAX_COMPREHENSION_FACTOR),
        note: `Insight ${combatant.attributes.insight}, ${understanding.contributing.length} bearing insight(s)`
    });

    // ── TECHNIQUE MASTERY ─────────────────────────────────────────────────
    // A quarter-learned art half-works. A mastered art of a matched element is
    // the difference the genre is actually about.
    const technique = combatant.technique ?? null;
    const mastery = Math.max(0, Math.min(1, combatant.techniqueMastery ?? technique?.mastery ?? 0));
    const matched =
        technique?.element != null && root.elements.includes(technique.element);
    const techniqueRaw = technique === null
        ? 0.85
        : (0.6 + 0.6 * mastery) * (matched ? root.matchedTechniqueBonus : 1);
    factors.push({
        source: 'technique',
        factor: clampFactor(techniqueRaw, MAX_TECHNIQUE_FACTOR),
        note: technique === null
            ? 'Fighting bare, with no art at all'
            : `${technique.name} at ${(mastery * 100).toFixed(0)}% mastery${matched ? ', element matched to the root' : ''}`
    });

    // ── ARTIFACTS ─────────────────────────────────────────────────────────
    const artifactRaw = 1 + Math.max(0, combatant.artifactGrade ?? 0) * 0.12;
    factors.push({
        source: 'artifacts',
        factor: clampFactor(artifactRaw, MAX_ARTIFACT_FACTOR),
        note: (combatant.artifactGrade ?? 0) > 0
            ? `Carrying work of grade ${combatant.artifactGrade}`
            : 'Carrying nothing that helps'
    });

    // ── BATTLE EXPERIENCE ─────────────────────────────────────────────────
    // A veteran and a novice at identical cultivation must not fight
    // identically. Saturating, because there is a point past which having
    // survived more fights stops teaching you anything.
    const battles = Math.max(0, combatant.battlesSurvived ?? 0);
    const experienceRaw = 1 + 0.4 * (Math.min(battles, EXPERIENCE_SATURATION) / EXPERIENCE_SATURATION);
    factors.push({
        source: 'experience',
        factor: clampFactor(experienceRaw, MAX_EXPERIENCE_FACTOR),
        note: `${battles} confrontation(s) survived`
    });

    // ── ENVIRONMENT ───────────────────────────────────────────────────────
    // Where you are standing. A Drawn cultivator on ground with nothing in the
    // air is a cultivator with a problem; a carver does not care, because their
    // qi was in the rock before it was in them.
    const environmentRaw = tradition === 'tradition-cut'
        ? 1
        : 1 + ambientBreakthroughMod(ctx.ambient) * 1.5;
    factors.push({
        source: 'environment',
        factor: clampFactor(environmentRaw, 1.4),
        note: tradition === 'tradition-cut'
            ? `Ambient qi is ${ctx.ambient}, which a carver does not draw on`
            : `Ambient qi is ${ctx.ambient}`
    });

    // ── CONDITION ─────────────────────────────────────────────────────────
    // What they are actually able to do right now: open wounds, blood, qi in
    // the meridians. The ratchet arriving in a fight.
    const hpFraction = combatant.maxHp > 0 ? Math.max(0, combatant.hp) / combatant.maxHp : 0;
    const qiFraction = combatant.maxQi > 0 ? Math.max(0, combatant.qi) / combatant.maxQi : 1;
    const foundationMod = foundation === 'none' ? 0 : foundationEffect(foundation).breakthroughModifier;
    const conditionRaw =
        (1 - injuries.cultivationPenalty * 0.5) *
        (0.5 + 0.5 * hpFraction) *
        (0.75 + 0.25 * Math.min(1, qiFraction)) *
        (1 + foundationMod);
    factors.push({
        source: 'condition',
        factor: clampFactor(conditionRaw, 1.5),
        note:
            `HP ${combatant.hp}/${combatant.maxHp}, qi ${combatant.qi}/${combatant.maxQi}, ` +
            `${injuries.untreatedCount} untreated injuries, foundation ${foundation}`
    });

    // The reported total is the running product in listed order, so replaying
    // the list reproduces it exactly rather than approximately.
    let total = realmBase;
    for (const f of factors) total *= f.factor;

    return {
        ordinal,
        rank: rankName(ordinal),
        realmKey: tier.key,
        realmIndex: realmIndexOf(ordinal),
        tradition,
        realmBase,
        factors,
        total,
        kill: killRequirement(tradition, ordinal)
    };
}

/** Above Nascent Soul the soul starts being part of what you can throw. */
function soulContribution(ordinal: number): number {
    const index = realmIndexOf(ordinal);
    const nascentSoulIndex = REALM_TIERS.findIndex(t => t.key === 'nascent_soul');
    if (index < nascentSoulIndex) return 0;
    return Math.min(0.4, (index - nascentSoulIndex + 1) * 0.08);
}

function soulStatePenalty(state: Cultivator['soulState'] | undefined): number {
    switch (state) {
        case 'damaged': return -0.15;
        case 'fragmented': return -0.3;
        case 'fading': return -0.45;
        default: return 0;
    }
}

// ═════════════════════════════════════════════════════════════════════════
// THE GAP
// ═════════════════════════════════════════════════════════════════════════

export type GapVerdict = 'contested' | 'outmatched' | 'helpless';

/**
 * What a weaker party can actually do about a stronger one. Not consolation
 * text - these are the branches the world genuinely permits, and every one of
 * them is a different tool call.
 */
export const REAL_OPTIONS: readonly string[] = Object.freeze([
    'flee, and accept being hunted',
    'hide, and accept being found eventually',
    'negotiate, and accept the terms',
    'seek protection, and accept the debt',
    'exploit terrain that suits you and not them',
    'find the specialised counter their road has no answer to',
    'manipulate a third party who can actually reach them',
    'prepare, for as long as it takes, and come back',
    'avoid detection entirely, which is usually the correct answer'
] as const);

export interface GapAssessment {
    verdict: GapVerdict;
    /** Difference in major realms. Negative when the subject is the stronger one. */
    realmGap: number;
    /** Raw ratio of composite power, stronger over weaker. */
    powerRatio: number;
    /** Present only for `helpless`. The branches that are actually open. */
    options: readonly string[];
    /** Engine-authored statement of what the gap means. */
    summary: string;
}

/**
 * Read the gap between two priced combatants.
 *
 * Counted in major realms rather than ordinals, because that is the unit the
 * setting is built in: thirteen sub-ranks of Qi Condensation are one realm, and
 * the step out of it is worth more than all thirteen.
 */
export function assessGap(subject: CombatantPower, opponent: CombatantPower): GapAssessment {
    const realmGap = opponent.realmIndex - subject.realmIndex;
    const ratio = subject.total > 0 ? opponent.total / subject.total : Infinity;

    if (realmGap >= HELPLESS_REALM_GAP) {
        return {
            verdict: 'helpless',
            realmGap,
            powerRatio: ratio,
            options: REAL_OPTIONS,
            summary:
                `${realmGap} major realms is not a fight. ${opponent.rank} against ${subject.rank} is ` +
                'a decision the stronger party makes alone, and nothing carried into a direct confrontation changes that.'
        };
    }

    if (realmGap === 1) {
        return {
            verdict: 'outmatched',
            realmGap,
            powerRatio: ratio,
            options: [],
            summary:
                `A realm down. ${subject.rank} can beat ${opponent.rank}, and will not do it by fighting fair: ` +
                'it takes something brought to the encounter that the other one did not expect.'
        };
    }

    return {
        verdict: realmGap <= -HELPLESS_REALM_GAP ? 'contested' : 'contested',
        realmGap,
        powerRatio: ratio,
        options: [],
        summary:
            `${subject.rank} against ${opponent.rank}. Close enough that everything else decides it: ` +
            'the art, the ground, the wounds either of them is already carrying, and who moved first.'
    };
}

// ═════════════════════════════════════════════════════════════════════════
// EDGES
// ═════════════════════════════════════════════════════════════════════════

export interface EdgeAssessment {
    edges: readonly Edge[];
    /** Itemised. Multiplying these in order reproduces `multiplier` exactly. */
    items: Array<{ source: Edge; factor: number }>;
    multiplier: number;
    /** True when the cap bit, which is the rule that keeps upsets exceptional. */
    capped: boolean;
}

/**
 * Price what somebody brought.
 *
 * Duplicates are ignored - bringing two ambushes is bringing one ambush - and
 * the product is capped hard. When the cap bites it is reported, because a
 * player who lost a fight they had stacked nine advantages into is owed the
 * explanation that nine advantages is not a realm.
 */
export function assessEdges(edges: readonly Edge[]): EdgeAssessment {
    const unique = [...new Set(edges)].filter(e => e in EDGE_VALUES);
    const items = unique.map(source => ({ source, factor: EDGE_VALUES[source] }));

    let raw = 1;
    for (const item of items) raw *= item.factor;

    const multiplier = Math.min(raw, MAX_EDGE_MULTIPLIER);
    return { edges: unique, items, multiplier, capped: multiplier < raw };
}

// ═════════════════════════════════════════════════════════════════════════
// SOUL-DIRECTED ARTS
// ═════════════════════════════════════════════════════════════════════════

/** First ordinal at which soul techniques proper become possible at all. */
export const SOUL_ART_MIN_ORDINAL = REALM_TIERS.find(t => t.key === 'nascent_soul')!.ordinalStart;

export type AttackVector = 'body' | 'soul';

/**
 * Whether an art can be directed at a soul rather than at a body.
 *
 * Derived from the catalog fields rather than from a second table: elemental qi
 * has to travel through flesh to arrive, so only an elementless art can reach
 * past a body, and soul techniques proper do not exist below Nascent Soul. Both
 * halves are the world bible's, not this module's invention.
 */
export function canDirectAtSoul(technique: Technique | null | undefined): boolean {
    if (!technique) return false;
    return technique.element === null && technique.requiredOrdinal >= SOUL_ART_MIN_ORDINAL;
}

// ═════════════════════════════════════════════════════════════════════════
// ONE EXCHANGE
// ═════════════════════════════════════════════════════════════════════════

export interface ExchangeContext {
    rng: CultivationRNG;
    ambient: AmbientQi;
    /** Turn number, stamped onto any injury sustained. */
    turn: number;
    /** What the attacker brought. Priced by `assessEdges`. */
    attackerEdges?: readonly Edge[];
    /** What the defender brought. */
    defenderEdges?: readonly Edge[];
    /** Where the attacker is aiming. Defaults to the body. */
    vector?: AttackVector;
}

export interface ExchangeResult {
    /** Damage actually dealt to the defender, after everything. */
    damage: number;
    /** Injury the exchange produced, or null. */
    injury: Injury | null;
    /** True when the strike found nothing to act on at all. */
    nullified: boolean;
    /** Why it was nullified, when it was. */
    nullifiedReason: string | null;
    vector: AttackVector;
    /** Attacker power over defender power, after edges. The number that decided it. */
    advantage: number;
    /** Raw [0,1) sample. Exposed so a player can see the roll that hurt them. */
    roll: number;
    /** Itemised and multiplicative, reproducing `advantage` in order. */
    modifiers: Array<{ source: string; factor: number }>;
    narrationHint: string;
}

/**
 * Resolve one exchange between two priced combatants.
 *
 * Pure with respect to both: nothing is mutated, and the caller applies the
 * damage. The defender's tradition is consulted BEFORE anything is rolled,
 * because a soul-directed art against a carver is not a weak attack, it is not
 * an attack.
 */
export function resolveExchange(
    attacker: CombatantPower,
    defender: CombatantPower,
    defenderMaxHp: number,
    ctx: ExchangeContext
): ExchangeResult {
    const vector: AttackVector = ctx.vector ?? 'body';

    // ── The one check that happens before the dice. ──
    if (vector === 'soul' && !soulAttacksAffect(defender.tradition)) {
        return {
            damage: 0,
            injury: null,
            nullified: true,
            nullifiedReason: 'no_soul_to_reach',
            vector,
            advantage: 0,
            roll: 0,
            modifiers: [],
            narrationHint:
                'The art passes through and finds no purchase. A carver has no detachable soul at any rank, ' +
                'and soul-directed work does nothing to them whatsoever. This is the single most dangerous ' +
                'fact about the Cut Road and the one outsiders discover last.'
        };
    }

    const attackerEdges = assessEdges(ctx.attackerEdges ?? []);
    const defenderEdges = assessEdges(ctx.defenderEdges ?? []);

    const modifiers: Array<{ source: string; factor: number }> = [
        { source: `attacker:${attacker.rank}`, factor: attacker.total },
        { source: `defender:${defender.rank}`, factor: 1 / defender.total }
    ];
    if (attackerEdges.multiplier !== 1) {
        modifiers.push({ source: `attacker_edges:${attackerEdges.edges.join('+')}`, factor: attackerEdges.multiplier });
    }
    if (defenderEdges.multiplier !== 1) {
        modifiers.push({ source: `defender_edges:${defenderEdges.edges.join('+')}`, factor: 1 / defenderEdges.multiplier });
    }

    let advantage = 1;
    for (const m of modifiers) advantage *= m.factor;

    // Damage is a fraction of the defender's maximum, scaled by the advantage
    // and one seeded sample. Expressed as a fraction rather than a flat number
    // so the same arithmetic works at Qi Condensation and at Grand Ascension,
    // where the absolute HP numbers are not comparable.
    const roll = ctx.rng.next();
    const share = advantage / (1 + advantage);
    const fraction = share * (EXCHANGE_DAMAGE_FLOOR + EXCHANGE_DAMAGE_SPAN * roll);
    const damage = Math.max(1, Math.round(defenderMaxHp * fraction));

    // A wound that lands hard enough leaves something that does not heal on its
    // own. Severity climbs with how one-sided the exchange was, so being
    // outclassed is how cultivators acquire the injuries that kill them later.
    let injury: Injury | null = null;
    const injuryThreshold = injuryChance(advantage, fraction);
    if (ctx.rng.next() < injuryThreshold) {
        injury = createInjury(
            {
                severity: exchangeInjurySeverity(advantage, ctx.rng),
                source: ctx.attackerEdges?.includes('poison') ? 'poison' : 'combat',
                turn: ctx.turn
            },
            ctx.rng
        );
    }

    return {
        damage,
        injury,
        nullified: false,
        nullifiedReason: null,
        vector,
        advantage,
        roll,
        modifiers,
        narrationHint:
            `${attacker.rank} strikes at ${defender.rank}${vector === 'soul' ? ', at the soul' : ''}. ` +
            `Advantage ${advantage.toFixed(2)}; ${damage} damage` +
            (injury ? `, and a ${injury.severity} meridian injury that will not close on its own.` : '.')
    };
}

/** Lopsided exchanges tear things. Even exchanges mostly bruise. */
function injuryChance(advantage: number, fraction: number): number {
    const lopsided = Math.max(0, Math.min(1, (advantage - 1) / 4));
    return Math.max(0, Math.min(0.85, fraction * 1.5 + lopsided * 0.35));
}

function exchangeInjurySeverity(advantage: number, rng: CultivationRNG): InjurySeverity {
    const roll = rng.next();
    if (advantage >= 3) {
        if (roll < 0.2) return 'minor';
        if (roll < 0.65) return 'serious';
        return 'crippling';
    }
    if (advantage >= 1.5) {
        if (roll < 0.5) return 'minor';
        if (roll < 0.9) return 'serious';
        return 'crippling';
    }
    if (roll < 0.75) return 'minor';
    if (roll < 0.97) return 'serious';
    return 'crippling';
}

// ═════════════════════════════════════════════════════════════════════════
// THE CONFRONTATION
// ═════════════════════════════════════════════════════════════════════════

/**
 * How a confrontation ended.
 *
 * Death is one of eight, and the ordinary results are the other seven. A
 * cultivation world where every fight ends in a corpse has no feuds in it, and
 * feuds are most of what makes it a world.
 */
export type ConfrontationOutcome =
    /** The gap was categorical. Nothing was resolved because nothing was contested. */
    | 'no_contest'
    /** One side broke off and got away. Injuries stand; so does the grudge. */
    | 'withdrawal'
    /** The loser was taken alive, which is usually worse for them than not. */
    | 'capture'
    /** Beaten and deliberately let go, in front of people. The genre's engine. */
    | 'humiliation'
    /** An injury that never heals right. They walk away and they are not the same. */
    | 'crippled'
    /** The body went. Whether that is an ending depends on tradition and rank. */
    | 'body_destroyed'
    /** The finishing requirement for this person was actually met. */
    | 'lethal'
    /** Neither could finish it. Both are worse off and nothing is settled. */
    | 'stalemate';

/** What the loser gets to hold about it afterwards, handed to the social layer. */
export interface ObligationSeed {
    kind: 'grudge' | 'blood_feud';
    holderId: string;
    subjectId: string;
    cause: 'humiliation' | 'injury' | 'crippled' | 'killed_kin' | 'robbery' | 'betrayal' | 'other';
    severity: 'slight' | 'serious' | 'grave' | 'unforgivable';
    description: string;
}

export interface ConfrontationIntent {
    /** What the aggressor is actually trying to do. Decides which endings are reachable. */
    goal: 'kill' | 'subdue' | 'drive_off' | 'humiliate';
    /** Whether the loser will break off rather than be finished. Usually yes. */
    willWithdraw?: boolean;
}

export interface ConfrontationContext extends ExchangeContext {
    intent: ConfrontationIntent;
    /** Where the aggressor is aiming, when they have an art that can choose. */
    vector?: AttackVector;
}

export interface ExchangeRecord {
    index: number;
    attackerId: string;
    defenderId: string;
    result: ExchangeResult;
    /** Defender HP after the exchange was applied to the running total. */
    defenderHpAfter: number;
}

export interface ConfrontationResult {
    outcome: ConfrontationOutcome;
    /** Null for `no_contest` and `stalemate`. */
    winnerId: string | null;
    loserId: string | null;
    aggressor: CombatantPower;
    defender: CombatantPower;
    gap: GapAssessment;
    exchanges: ExchangeRecord[];
    /** Final HP, keyed by combatant id. The caller writes these. */
    hp: Record<string, number>;
    /** Every wound the confrontation produced, keyed by combatant id. */
    injuries: Record<string, Injury[]>;
    /**
     * True when the loser's finishing requirement was met in full.
     *
     * NOT a death. `survival.ts` is the only place a cultivator is declared
     * dead, and the caller must hand it the resulting state and ask.
     */
    finished: boolean;
    /** What finishing this person would have taken, whether or not it happened. */
    killRequirement: KillRequirement;
    /** Set when the body went and the person did not: 'soul' or 'seam'. */
    remnant: 'soul' | 'seam' | null;
    obligations: ObligationSeed[];
    narrationHint: string;
}

/**
 * Resolve a confrontation between two combatants.
 *
 * The order of business is the order of the rules at the top of this file: the
 * gap is checked first and can end the whole thing before a die is rolled; then
 * exchanges alternate until somebody breaks, is finished, or nobody can; then
 * the tradition decides whether what happened to the loser's body was an
 * ending; then the social consequences are seeded.
 *
 * Nothing in here is adjusted because a run is going badly. The player may lose
 * this, and if they walked into it they will.
 */
export function resolveConfrontation(
    aggressorInput: CombatantInput,
    defenderInput: CombatantInput,
    ctx: ConfrontationContext
): ConfrontationResult {
    const powerCtx: PowerContext = { ambient: ctx.ambient };
    const aggressor = assessPower(aggressorInput, powerCtx);
    const defender = assessPower(defenderInput, powerCtx);
    const gap = assessGap(aggressor, defender);

    const hp: Record<string, number> = {
        [aggressorInput.id]: aggressorInput.hp,
        [defenderInput.id]: defenderInput.hp
    };
    const injuries: Record<string, Injury[]> = {
        [aggressorInput.id]: [],
        [defenderInput.id]: []
    };

    // ── RULE 1. The gap can end this before anything is rolled. ──
    // Checked in both directions: an aggressor who is helpless against their
    // target achieves nothing, and an aggressor several realms above one does
    // not have a fight either - they have a decision.
    const reverseGap = assessGap(defender, aggressor);
    if (gap.verdict === 'helpless') {
        return noContest(aggressor, defender, gap, hp, injuries, aggressorInput.id, defenderInput.id,
            `${aggressorInput.name} cannot reach ${defenderInput.name}. ${gap.summary}`);
    }
    if (reverseGap.verdict === 'helpless') {
        return oneSided(aggressor, defender, gap, ctx, aggressorInput, defenderInput, hp, injuries);
    }

    // ── Exchanges. ──
    const exchanges: ExchangeRecord[] = [];
    let outcome: ConfrontationOutcome = 'stalemate';
    let winnerId: string | null = null;
    let loserId: string | null = null;

    const vector: AttackVector = ctx.vector ?? 'body';
    const willWithdraw = ctx.intent.willWithdraw ?? true;

    for (let i = 0; i < MAX_EXCHANGES; i++) {
        // The aggressor swings, then the defender swings back if still standing.
        const order: Array<[CombatantPower, CombatantPower, CombatantInput, CombatantInput, AttackVector, readonly Edge[], readonly Edge[]]> = [
            [aggressor, defender, aggressorInput, defenderInput, vector, ctx.attackerEdges ?? [], ctx.defenderEdges ?? []],
            [defender, aggressor, defenderInput, aggressorInput, 'body', ctx.defenderEdges ?? [], ctx.attackerEdges ?? []]
        ];

        for (const [striker, target, strikerIn, targetIn, strikeVector, strikerEdges, targetEdges] of order) {
            if (hp[strikerIn.id] <= 0) continue;

            const result = resolveExchange(striker, target, targetIn.maxHp, {
                ...ctx,
                vector: strikeVector,
                attackerEdges: strikerEdges,
                defenderEdges: targetEdges,
                turn: ctx.turn
            });

            hp[targetIn.id] = Math.max(0, hp[targetIn.id] - result.damage);
            if (result.injury) injuries[targetIn.id].push(result.injury);

            exchanges.push({
                index: exchanges.length,
                attackerId: strikerIn.id,
                defenderId: targetIn.id,
                result,
                defenderHpAfter: hp[targetIn.id]
            });

            if (hp[targetIn.id] <= 0) {
                winnerId = strikerIn.id;
                loserId = targetIn.id;
                break;
            }

            // Breaking off is the ordinary end of a cultivation fight. Somebody
            // decides the price has stopped being worth it and goes.
            if (willWithdraw && hp[targetIn.id] < targetIn.maxHp * WITHDRAW_HP_FRACTION) {
                winnerId = strikerIn.id;
                loserId = targetIn.id;
                outcome = 'withdrawal';
                break;
            }
        }

        if (winnerId !== null) break;
    }

    if (winnerId === null) {
        return stalemate(aggressor, defender, gap, exchanges, hp, injuries, aggressorInput, defenderInput);
    }

    const loserInput = loserId === aggressorInput.id ? aggressorInput : defenderInput;
    const loserPower = loserId === aggressorInput.id ? aggressor : defender;
    const requirement = loserPower.kill;

    // ── RULE 5 and RULE 4. What actually happened to the loser. ──
    if (outcome !== 'withdrawal') {
        outcome = finishOutcome(ctx.intent.goal, vector, requirement);
    }

    const remnant =
        outcome === 'body_destroyed' ? requirement.remnant : null;
    const finished = outcome === 'lethal';

    // A crippling wound in the record turns a beating into something the loser
    // carries. Checked after the outcome so a withdrawal can still be the fight
    // that ruined them.
    const loserInjuries = injuries[loserInput.id];
    if (outcome === 'withdrawal' && loserInjuries.some(i => i.severity === 'crippling')) {
        outcome = 'crippled';
    }

    return {
        outcome,
        winnerId,
        loserId,
        aggressor,
        defender,
        gap,
        exchanges,
        hp,
        injuries,
        finished,
        killRequirement: requirement,
        remnant,
        obligations: seedObligations(outcome, winnerId, loserId, loserInput.name, loserInjuries),
        narrationHint: describeOutcome(outcome, requirement, remnant)
    };
}

/**
 * Which ending the aggressor's goal and the loser's tradition actually permit.
 *
 * A goal of `kill` against a Drawn cultivator above Nascent Soul with a
 * body-directed art destroys the body and does not end them, and the winner
 * does not necessarily know that. That gap between what happened and what the
 * winner believes happened is how feuds continue after a funeral.
 */
function finishOutcome(
    goal: ConfrontationIntent['goal'],
    vector: AttackVector,
    requirement: KillRequirement
): ConfrontationOutcome {
    if (goal === 'subdue') return 'capture';
    if (goal === 'humiliate') return 'humiliation';
    if (goal === 'drive_off') return 'withdrawal';

    // goal === 'kill'
    if (vector === 'soul') {
        // Already checked that the art reaches; a soul that can be reached and
        // is ended is ended, whatever the body is doing.
        return requirement.soulAttackWorks ? 'lethal' : 'body_destroyed';
    }
    return requirement.bodyIsEnough ? 'lethal' : 'body_destroyed';
}

function seedObligations(
    outcome: ConfrontationOutcome,
    winnerId: string | null,
    loserId: string | null,
    loserName: string,
    loserInjuries: readonly Injury[]
): ObligationSeed[] {
    if (!winnerId || !loserId) return [];

    // The dead hold nothing. Everything else does, and the record is the point:
    // an NPC must be able to conclude "I cannot defeat him now, I will remember
    // this" and act on it forty years later.
    switch (outcome) {
        case 'humiliation':
            return [{
                kind: 'grudge',
                holderId: loserId,
                subjectId: winnerId,
                cause: 'humiliation',
                severity: 'grave',
                description: `${loserName} was beaten and deliberately let go, where it could be seen.`
            }];
        case 'crippled':
            return [{
                kind: 'blood_feud',
                holderId: loserId,
                subjectId: winnerId,
                cause: 'crippled',
                severity: 'unforgivable',
                description: `${loserName} took a wound in this confrontation that will not close.`
            }];
        case 'capture':
            return [{
                kind: 'grudge',
                holderId: loserId,
                subjectId: winnerId,
                cause: 'other',
                severity: 'grave',
                description: `${loserName} was taken alive.`
            }];
        case 'withdrawal':
            return [{
                kind: 'grudge',
                holderId: loserId,
                subjectId: winnerId,
                cause: loserInjuries.length > 0 ? 'injury' : 'humiliation',
                severity: loserInjuries.length > 0 ? 'serious' : 'slight',
                description: `${loserName} broke off and got away.`
            }];
        case 'body_destroyed':
            // They are still in the world, and now they have nothing else to do.
            return [{
                kind: 'blood_feud',
                holderId: loserId,
                subjectId: winnerId,
                cause: 'crippled',
                severity: 'unforgivable',
                description: `${loserName}'s body was destroyed and ${loserName} was not.`
            }];
        default:
            return [];
    }
}

function describeOutcome(
    outcome: ConfrontationOutcome,
    requirement: KillRequirement,
    remnant: 'soul' | 'seam' | null
): string {
    switch (outcome) {
        case 'lethal':
            return `The finishing requirement was met in full. ${requirement.note}`;
        case 'body_destroyed':
            return remnant === 'soul'
                ? 'The body is gone and the person is not. The soul left intact and can persist for months, ' +
                  'shortening every day it stays out. Anyone who walks away believing this was a killing is wrong, ' +
                  'and will find out.'
                : 'The body is gone and the seam is not. A large enough seam-bearing piece regrows over years into ' +
                  'somebody who remembers the argument, which is why the Marches distinguishes a funeral from a scattering.';
        case 'withdrawal':
            return 'Broken off. Both parties are worse than they were, the wounds are real, and nothing is settled.';
        case 'crippled':
            return 'They walked away carrying something that will not close. That is the ratchet, and it is what ' +
                'eventually kills most cultivators who survive their fights.';
        case 'capture':
            return 'Taken alive. What happens next is a negotiation, and the terms are not theirs.';
        case 'humiliation':
            return 'Beaten and let go, deliberately, where it could be seen. The cheapest way to make a permanent enemy.';
        case 'stalemate':
            return 'Neither could finish it. Both are hurt, both are still standing, and both now know exactly ' +
                'how the other fights.';
        case 'no_contest':
            return 'Not a fight. A decision the stronger party made alone.';
    }
}

// ── Terminal shapes, kept together so every early return has the same fields. ──

function noContest(
    aggressor: CombatantPower,
    defender: CombatantPower,
    gap: GapAssessment,
    hp: Record<string, number>,
    injuries: Record<string, Injury[]>,
    _aggressorId: string,
    _defenderId: string,
    hint: string
): ConfrontationResult {
    return {
        outcome: 'no_contest',
        winnerId: null,
        loserId: null,
        aggressor,
        defender,
        gap,
        exchanges: [],
        hp,
        injuries,
        finished: false,
        killRequirement: defender.kill,
        remnant: null,
        obligations: [],
        narrationHint: hint
    };
}

/**
 * The aggressor is several realms above the defender.
 *
 * Not a fight either, but it is not nothing: the stronger party gets what they
 * came for, at no risk, in one action. The defender is hurt in proportion to
 * what was actually intended rather than to a die roll, because nothing about
 * this was uncertain.
 */
function oneSided(
    aggressor: CombatantPower,
    defender: CombatantPower,
    gap: GapAssessment,
    ctx: ConfrontationContext,
    aggressorInput: CombatantInput,
    defenderInput: CombatantInput,
    hp: Record<string, number>,
    injuries: Record<string, Injury[]>
): ConfrontationResult {
    const vector: AttackVector = ctx.vector ?? 'body';
    const requirement = defender.kill;

    if (vector === 'soul' && !soulAttacksAffect(defender.tradition)) {
        // Even a Grand Ascension cultivator cannot soul-attack a carver. Realm
        // does not enter into it; there is nothing there to attack.
        return noContest(aggressor, defender, gap, hp, injuries, aggressorInput.id, defenderInput.id,
            'The art finds nothing to act on. A carver has no detachable soul at any rank, and being ' +
            'several realms above one does not create one.');
    }

    const goal = ctx.intent.goal;
    const outcome: ConfrontationOutcome = goal === 'kill'
        ? finishOutcome('kill', vector, requirement)
        : goal === 'subdue' ? 'capture'
            : goal === 'humiliate' ? 'humiliation'
                : 'withdrawal';

    if (goal === 'kill') {
        hp[defenderInput.id] = 0;
    } else {
        hp[defenderInput.id] = Math.max(1, Math.floor(defenderInput.maxHp * 0.2));
        injuries[defenderInput.id].push(
            createInjury({ severity: 'serious', source: 'combat', turn: ctx.turn }, ctx.rng)
        );
    }

    return {
        outcome,
        winnerId: aggressorInput.id,
        loserId: defenderInput.id,
        aggressor,
        defender,
        gap,
        exchanges: [],
        hp,
        injuries,
        finished: outcome === 'lethal',
        killRequirement: requirement,
        remnant: outcome === 'body_destroyed' ? requirement.remnant : null,
        obligations: seedObligations(outcome, aggressorInput.id, defenderInput.id, defenderInput.name, injuries[defenderInput.id]),
        narrationHint:
            `${aggressorInput.name} stands ${-gap.realmGap} major realms above ${defenderInput.name}. ` +
            'There was no exchange to resolve. ' + describeOutcome(outcome, requirement, outcome === 'body_destroyed' ? requirement.remnant : null)
    };
}

function stalemate(
    aggressor: CombatantPower,
    defender: CombatantPower,
    gap: GapAssessment,
    exchanges: ExchangeRecord[],
    hp: Record<string, number>,
    injuries: Record<string, Injury[]>,
    aggressorInput: CombatantInput,
    defenderInput: CombatantInput
): ConfrontationResult {
    return {
        outcome: 'stalemate',
        winnerId: null,
        loserId: null,
        aggressor,
        defender,
        gap,
        exchanges,
        hp,
        injuries,
        finished: false,
        killRequirement: defender.kill,
        remnant: null,
        obligations: [
            {
                kind: 'grudge',
                holderId: defenderInput.id,
                subjectId: aggressorInput.id,
                cause: 'injury',
                severity: 'serious',
                description: `${aggressorInput.name} and ${defenderInput.name} fought to a standstill and both walked away.`
            },
            {
                kind: 'grudge',
                holderId: aggressorInput.id,
                subjectId: defenderInput.id,
                cause: 'injury',
                severity: 'serious',
                description: `${defenderInput.name} would not go down.`
            }
        ],
        narrationHint: describeOutcome('stalemate', defender.kill, null)
    };
}

// ═════════════════════════════════════════════════════════════════════════
// DISENGAGEMENT
// ═════════════════════════════════════════════════════════════════════════

export interface FleeResult {
    escaped: boolean;
    chance: number;
    /** Itemised and additive, summing exactly to `chance`, clamp line included. */
    modifiers: Array<{ source: string; delta: number }>;
    roll: number;
    /** Cost of getting away, if they did. Fleeing is not free. */
    damage: number;
    injury: Injury | null;
    narrationHint: string;
}

/** Fleeing is never certain and never impossible. Same reasoning as the breakthrough clamp. */
export const MIN_FLEE_CHANCE = 0.05;
export const MAX_FLEE_CHANCE = 0.95;

/**
 * Try to break off and get away.
 *
 * The first entry on `REAL_OPTIONS` and the one a weaker cultivator reaches for
 * most, so it gets real arithmetic rather than a coin flip. A movement art is
 * worth more here than anything else a cultivator can be carrying, which is why
 * qinggong manuals sell.
 */
export function attemptFlight(
    fleeing: CombatantPower,
    pursuer: CombatantPower,
    ctx: {
        rng: CultivationRNG;
        turn: number;
        maxHp: number;
        /** A movement art, if they have one ready. */
        movementTechnique?: Technique | null;
        movementMastery?: number;
        edges?: readonly Edge[];
    }
): FleeResult {
    const modifiers: Array<{ source: string; delta: number }> = [
        { source: 'base', delta: 0.45 }
    ];

    // The gap cuts both ways here, and this is the one place it helps the
    // weaker party: a Deity Transformation cultivator chasing a Qi Condensation
    // one is not interested enough to chase properly for long.
    const realmGap = pursuer.realmIndex - fleeing.realmIndex;
    modifiers.push({
        source: `realm_gap:${realmGap}`,
        delta: -realmGap * 0.12
    });

    const movement = ctx.movementTechnique ?? null;
    if (movement && movement.category === 'movement') {
        const mastery = Math.max(0, Math.min(1, ctx.movementMastery ?? movement.mastery));
        modifiers.push({ source: `movement_art:${movement.name}`, delta: 0.1 + 0.3 * mastery });
    }

    const edges = assessEdges(ctx.edges ?? []);
    if (edges.edges.includes('terrain')) {
        modifiers.push({ source: 'edge:terrain', delta: 0.12 });
    }
    if (edges.edges.includes('preparation')) {
        modifiers.push({ source: 'edge:preparation', delta: 0.15 });
    }

    const condition = fleeing.factors.find(f => f.source === 'condition');
    if (condition && condition.factor < 1) {
        modifiers.push({ source: 'condition', delta: (condition.factor - 1) * 0.4 });
    }

    const raw = modifiers.reduce((sum, m) => sum + m.delta, 0);
    const chance = Math.max(MIN_FLEE_CHANCE, Math.min(MAX_FLEE_CHANCE, raw));
    if (chance !== raw) {
        modifiers.push({ source: chance > raw ? 'clamp:floor' : 'clamp:ceiling', delta: chance - raw });
    }

    const roll = ctx.rng.next();
    const escaped = roll < chance;

    // Turning your back on somebody costs something whether or not it works.
    const damage = Math.max(1, Math.round(ctx.maxHp * (escaped ? 0.08 : 0.22)));
    const injury = !escaped && ctx.rng.next() < 0.4
        ? createInjury({ severity: 'serious', source: 'combat', turn: ctx.turn }, ctx.rng)
        : null;

    return {
        escaped,
        chance,
        modifiers,
        roll,
        damage,
        injury,
        narrationHint: escaped
            ? `Broke away at ${(chance * 100).toFixed(0)}%, and paid ${damage} for the turn of the back.`
            : `Did not get clear: ${(chance * 100).toFixed(0)}% was not enough. ${damage} taken` +
              (injury ? `, and a ${injury.severity} injury with it.` : '.')
    };
}

// ═════════════════════════════════════════════════════════════════════════
// INITIATIVE
// Retained substrate, re-expressed. Order of action is decided by rank and
// then by a seeded sample, because in this world the question "who moves
// first" is mostly answered by "who is further up the ladder".
// ═════════════════════════════════════════════════════════════════════════

export interface InitiativeEntry {
    id: string;
    name: string;
    /** Higher acts first. Realm-dominated, with a bounded seeded component. */
    initiative: number;
    ordinal: number;
}

export interface InitiativeInput {
    id: string;
    name: string;
    /** Realm ordinal, or 0 for anyone who is not a cultivator. */
    ordinal?: number;
    /** Flat bonus for anything the ladder does not describe. */
    bonus?: number;
}

/**
 * Roll initiative for a confrontation.
 *
 * Ties break on id so the order is total and stable: a replay of the same seed
 * with the same participants produces the same sequence, which is what makes a
 * confrontation reproducible at all.
 */
export function rollInitiative(
    participants: readonly InitiativeInput[],
    rng: CultivationRNG
): InitiativeEntry[] {
    const rolled = participants.map(p => {
        const ordinal = Math.max(0, Math.floor(p.ordinal ?? 0));
        return {
            id: p.id,
            name: p.name,
            ordinal,
            // Rank dominates and the sample decides between neighbours, so a
            // Core Formation cultivator never loses the first move to a mortal.
            initiative: ordinal * 4 + (p.bonus ?? 0) + rng.next() * 3
        };
    });

    return rolled.sort((a, b) =>
        b.initiative - a.initiative ||
        b.ordinal - a.ordinal ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
}

// ═════════════════════════════════════════════════════════════════════════
// QI AND ARTS
// ═════════════════════════════════════════════════════════════════════════

/** Whether a combatant can actually use this art right now, and why not. */
export function canUseTechnique(
    combatant: Pick<CombatantInput, 'qi' | 'maxQi' | 'realmOrdinal'>,
    technique: Technique,
    cooldownRemaining = 0
): { usable: boolean; reason: string | null } {
    if (cooldownRemaining > 0) {
        return { usable: false, reason: `on_cooldown:${cooldownRemaining}` };
    }
    if (technique.requiredOrdinal > combatant.realmOrdinal) {
        return { usable: false, reason: 'realm_too_low' };
    }
    if (combatant.qi < technique.qiCost) {
        return { usable: false, reason: 'insufficient_qi' };
    }
    if (combatant.maxQi > 0 && combatant.qi / combatant.maxQi < EXHAUSTED_QI_FRACTION) {
        return { usable: false, reason: 'exhausted' };
    }
    return { usable: true, reason: null };
}
